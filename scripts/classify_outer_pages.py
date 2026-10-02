"""Audit every edition page with JEV and apply supported outer/inner judgments.

Raw fragments are sliced at page milestones, never parsed/reserialized or repaired.
The JSON ledger stores complete requests/responses and supports resumable runs.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re

from lxml import etree
from classify_traditions import load_key, request_jev

ROOT = Path(__file__).resolve().parents[1]
PAGE = re.compile(r'<page\b[^>]*?/\s*>')
LETTER = re.compile(r'<letterText\b[^>]*\bletter="([^"]+)"[^>]*>([\s\S]*?)</letterText>')
TYPE = re.compile(r'\s+type\s*=\s*([\'"])(.*?)\1')
QUESTION = {
    'type': 'choice',
    'instructions': 'Was this page, or any part of it, plausibly exposed on the outside of the letter when folded up for delivery? The exposed surface could carry the recipient address, a wax seal, postal/delivery markings, but also small text fragments like greetings and such. Partial exposure counts as outer, even when the rest of the page contains ordinary letter prose, because you can fold a page up to cover parts of it. Use the text and XML tags/notes as evidence. A plausible evidence-based identification is enough; certainty or an explicit outside label is not required. Do not infer outside use from page number alone, but use the page number, or merely because any sheet could have been folded. Distinguish delivery addresses from salutations, signatures, quoted addresses, and a sender giving their own return/contact address. Mentions of seals or sending letters in the prose are not themselves physical evidence. A sidenote with a page attribute refers to that physical page, which may differ from its position in the XML. The complete raw target-page fragment is supplied; tags crossing page boundaries may make it invalid standalone XML. Read it as-is. Choose outer, inner, or uncertain.',
    'criteria': {
        'outer': 'Positive textual or markup evidence that all or part of this page was plausibly exposed outside the folded letter.',
        'inner': 'No substantive outside-use evidence; ordinary letter content, salutation, or other non-postal text.',
        'uncertain': 'Evidence of outside use is genuinely ambiguous or conflicting.'
    }
}


def pages(source):
    result = []
    for letter in LETTER.finditer(source):
        markers = list(PAGE.finditer(letter[2]))
        for i, marker in enumerate(markers):
            start = letter.start(2) + marker.start()
            end = letter.start(2) + (markers[i + 1].start() if i + 1 < len(markers) else len(letter[2]))
            index = re.search(r'\bindex="([^"]+)"', marker[0])[1]
            result.append({'id': f'{letter[1]}:{i + 1}', 'letter': letter[1], 'page_index': index,
                           'ordinal': i + 1, 'pages_in_letter': len(markers),
                           'page_xml': source[start:end], 'start': start, 'marker': marker[0]})
    if len(result) != len(PAGE.findall(source)):
        raise ValueError('Not every page was captured within a letter')
    if len({p['id'] for p in result}) != len(result):
        raise ValueError('Duplicate page identities')
    return result


def original_letters(metadata):
    ns = {'l': 'https://lenz-archiv.de'}
    return {letter.get('letter') for letter in metadata.xpath('//l:letterDesc', namespaces=ns)
            if any(t.get('isOriginal', '').strip() in {'true', '1'}
                   for t in letter.xpath('./l:traditions/l:tradition', namespaces=ns))}


def remove_nonoriginal_outer(source, originals):
    for page in reversed(pages(source)):
        match = TYPE.search(page['marker'])
        if page['letter'] not in originals and match and match[2] == 'outer':
            start = page['start']
            marker = TYPE.sub('', page['marker'])
            source = source[:start] + marker + source[start + len(page['marker']):]
    return source


def request_state(page):
    state = {k: v for k, v in page.items() if k not in {'start', 'marker'}}
    state['page_xml'] = PAGE.sub(lambda m: TYPE.sub('', m[0]), state['page_xml'])
    return state


def decision(response, threshold):
    answer = response['answers']['outer']
    probs = answer['probabilities']
    if answer.get('type') != 'choice' or set(probs) != set(QUESTION['criteria']):
        raise ValueError('Unexpected answer shape')
    for v in [*probs.values(), answer['confidence']]:
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1:
            raise ValueError('Invalid probability')
    choice = answer['choice']
    if choice not in probs or not math.isclose(sum(probs.values()), 1, abs_tol=.01) or probs[choice] != max(probs.values()):
        raise ValueError('Invalid choice distribution')
    return choice if probs[choice] >= threshold else 'uncertain'


def apply(source, all_pages, decisions):
    for page in reversed(all_pages):
        kind = decisions[page['id']]
        marker = page['marker']
        if kind == 'uncertain':
            continue
        existing = TYPE.search(marker)
        if existing:
            updated = (TYPE.sub('', marker) if kind == 'inner' else
                       marker[:existing.start(2)] + kind + marker[existing.end(2):])
        elif kind == 'outer':
            updated = re.sub(r'(\s*/\s*>)$', r' type="outer"\1', marker)
        else:
            continue  # Missing type defaults to inner in the schema.
        start = page['start']
        source = source[:start] + updated + source[start + len(marker):]
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/xml/briefe.xml')
    parser.add_argument('--metadata', type=Path, default=ROOT / 'data/xml/meta.xml')
    parser.add_argument('--key-file', type=Path, default=ROOT / '.env')
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--model', default='jev-latest')
    parser.add_argument('--workers', type=int, default=8)
    parser.add_argument('--threshold', type=float, default=.75)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not 0 <= args.threshold <= 1 or args.workers < 1 or (args.limit is not None and args.limit < 1):
        parser.error('Invalid threshold, workers, or limit')
    source = args.source.read_text()
    all_pages = pages(source)
    metadata_source = args.metadata.read_bytes()
    originals = original_letters(etree.fromstring(metadata_source))
    eligible = [p for p in all_pages if p['letter'] in originals]
    selected = eligible[:args.limit] if args.limit else eligible
    print(f'Sending {len(selected)} original pages; excluding {len(all_pages) - len(eligible)} non-original pages.')
    records = json.loads(args.report.read_text()) if args.report.exists() else []
    cache = {r['request_sha256']: r for r in records}
    key = load_key(args.key_file) if selected else None
    decisions = {p['id']: 'inner' for p in all_pages if p['letter'] not in originals}

    def classify(page):
        state = request_state(page)
        payload = {'model': args.model, 'state': state, 'questions': {'outer': QUESTION}}
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        if digest in cache:
            record = dict(cache[digest])
        else:
            response = request_jev(payload, key)
            record = {'page_id': page['id'], 'request_sha256': digest,
                      'created_at': datetime.now(timezone.utc).isoformat(),
                      'request': payload, 'response': response}
        record['decision'] = decision(record['response'], args.threshold)
        record['threshold'] = args.threshold
        return record

    args.report.parent.mkdir(parents=True, exist_ok=True)
    errors = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(classify, p): p for p in selected}
        for n, future in enumerate(as_completed(futures), 1):
            p = futures[future]
            try:
                record = future.result()
                cache[record['request_sha256']] = record
                decisions[p['id']] = record['decision']
                temporary = args.report.with_suffix('.tmp')
                temporary.write_text(json.dumps(list(cache.values()), ensure_ascii=False, indent=2) + '\n')
                temporary.replace(args.report)
                print(f"{n}/{len(selected)} {p['id']}: {record['decision']}", flush=True)
            except Exception as error:
                errors.append(p['id'])
                print(f"ERROR {p['id']}: {type(error).__name__}: {error}", flush=True)
    if errors:
        raise RuntimeError(f'{len(errors)} pages failed; resume with the same report. No XML changed.')
    if args.apply:
        if len(selected) != len(eligible):
            raise ValueError('Apply requires full corpus coverage; remove --limit')
        effective = {key: ('outer' if value == 'outer' else 'inner')
                     for key, value in decisions.items()}
        updated = apply(source, eligible, effective)
        updated = remove_nonoriginal_outer(updated, originals)
        schema = etree.XMLSchema(etree.parse(str(ROOT / 'data/xsd/briefe.xsd')))
        schema.assertValid(etree.fromstring(updated.encode()))
        if args.metadata.read_bytes() != metadata_source:
            raise RuntimeError('Metadata changed during audit; refusing overwrite')
        if args.source.read_text() != source:
            raise RuntimeError('Source changed during audit; refusing overwrite')
        args.source.write_text(updated)
    print(json.dumps({k: list(decisions.values()).count(k) for k in QUESTION['criteria']}))
    print(f'Applied: {args.apply}')


if __name__ == '__main__':
    main()
