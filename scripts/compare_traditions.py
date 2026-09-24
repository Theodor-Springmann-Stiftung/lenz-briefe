"""Read-only Jev rerun with full letter XML and schemas; never applies decisions."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from lxml import etree

from classify_traditions import ROOT, NS, QUESTION, load_key, proposed_type, request_jev


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def serialize(node):
    return etree.tostring(node, encoding='unicode', with_tail=False)


def clean_metadata(node):
    clean = deepcopy(node)
    for result in clean.xpath('./l:traditions | ./l:hasOriginal', namespaces=NS):
        clean.remove(result)
    # Editorial comments are not letter metadata and may contain later judgments.
    for comment in clean.xpath('.//comment()'):
        comment.getparent().remove(comment)
    return serialize(clean)


def build_inputs(root, ids):
    parse = lambda name: etree.parse(str(root / 'data/xml' / name))
    meta = {n.get('letter'): n for n in parse('meta.xml').xpath('//l:letterDesc', namespaces=NS)}
    letters = {n.get('letter'): n for n in parse('briefe.xml').xpath('//l:letterText', namespaces=NS)}
    apparatus = {n.get('letter'): n for n in parse('traditions.xml').xpath('//l:letterTradition', namespaces=NS)}
    refs = parse('references.xml')
    definitions = {n.get('index'): n.get('name') for n in refs.xpath('//l:appDef', namespaces=NS)}
    states = {}
    for identifier in ids:
        node = apparatus[identifier]
        states[identifier] = {
            'letter': identifier,
            'metadata_xml': clean_metadata(meta[identifier]),
            'letter_text_xml': serialize(letters[identifier]),
            'apparatus_xml': serialize(node),
            'apparatus': [{'ref': n.get('ref'), 'label': definitions.get(n.get('ref')),
                           'text': ' '.join(''.join(n.itertext()).split())}
                          for n in node if isinstance(n.tag, str)],
        }
    return states


def comparison_markdown(records):
    changed = sum(r['previous_answer']['choice'] != r['response']['answers']['basis']['choice'] for r in records)
    threshold_changes = sum(r['previous_type_at_threshold'] != r['new_type_at_threshold'] for r in records)
    lines = [
        '# Jev-Vergleich mit erweitertem Kontext', '',
        f'{len(records)} Briefe; {changed} geänderte Modellfavoriten; {threshold_changes} geänderte Zuordnungen bei 80 %.', '',
        'Erneut gesendet: vollständiger Brieftext, Metadaten ohne `traditions`/`hasOriginal` und ohne Kommentare, '
        'Apparat sowie alle sechs aktuellen XSD-Dateien. Frühere Antworten und redaktionelle Entscheidungen '
        'wurden nicht gesendet. XML-Dateien und das erste Prüfprotokoll bleiben unverändert.', '',
        'Modell: `jev-1.13.0`. Die Frage behält die bisherigen Kategorien; der frühere Hinweis '
        '`isOriginal=false` wurde entfernt und die zusätzlichen Eingabefelder werden benannt. '
        'Verglichen wird mit den ursprünglichen Modellantworten, nicht mit späteren redaktionellen Korrekturen. '
        'Unterschiede können durch Kontext, die angepasste Frage oder Modellschwankungen entstehen; '
        'dies ist kein kontrollierter Genauigkeitstest.', '',
        'Die Kategorien `manuscript`, `print`, `unknown` können gemischte Grundlagen nicht einzeln abbilden '
        '(insbesondere Brief 39). Die Prozentwerte beziehen sich auf den jeweiligen Modellfavoriten, '
        'nicht auf das separate API-Feld `confidence`. Unter 80 % bleibt die Zuordnung `unknown`.', '',
        '| Brief | Früherer Favorit | Wahrscheinlichkeit | Neuer Favorit | Wahrscheinlichkeit | Früher bei 80 % | Neu bei 80 % |',
        '| --- | --- | --- | --- | --- | --- | --- |',
    ]
    for r in sorted(records, key=lambda r: int(r['letter'])):
        a = r['previous_answer']; b = r['response']['answers']['basis']
        lines.append(f"| {r['letter']} | {a['choice']} | {a['probabilities'][a['choice']]:.0%} | "
                     f"{b['choice']} | {b['probabilities'][b['choice']]:.0%} | "
                     f"{r['previous_type_at_threshold']} | {r['new_type_at_threshold']} |")
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/editorial/tradition-comparison.json')
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()
    baseline_path = ROOT / 'docs/editorial/tradition-classification.json'
    protected = list((ROOT / 'data/xml').glob('*.xml')) + list((ROOT / 'data/xsd').glob('*.xsd')) + [baseline_path, ROOT / 'docs/editorial/traditions.md']
    before = {p: p.read_bytes() for p in protected}
    protected_paths = {p.resolve() for p in protected}
    if (args.output.resolve() in protected_paths
            or args.output.with_suffix('.md').resolve() in protected_paths
            or args.output.suffix != '.json'):
        parser.error('Output must be a separate JSON comparison report')
    baseline = json.loads(baseline_path.read_text())
    if args.limit is not None:
        if args.limit < 1:
            parser.error('limit must be positive')
        baseline = baseline[:args.limit]
    states = build_inputs(ROOT, [r['letter'] for r in baseline])
    schemas = {p.name: p.read_text() for p in sorted((ROOT / 'data/xsd').glob('*.xsd'))}
    question = deepcopy(QUESTION)
    question['instructions'] = question['instructions'].replace(
        'the supplied metadata and apparatus. isOriginal=false is already established: do not change it.',
        'the supplied metadata, full letter text, apparatus and XML schemas. The schemas define markup, not evidence about a particular letter. Classification fields have been intentionally omitted from the metadata.')
    shared = {'model': 'jev-1.13.0', 'schemas': schemas, 'questions': {'basis': question}}
    report = {'shared_request_fields': shared, 'records': []}
    if args.output.exists():
        report = json.loads(args.output.read_text())
        if report['shared_request_fields'] != shared:
            parser.error('Existing report has different shared inputs; choose a new output path')
    cached = {r['request_sha256']: r for r in report['records']}
    records = []
    work = []
    for old in baseline:
        state = states[old['letter']]
        payload = {'model': shared['model'], 'state': {**state, 'schemas': schemas}, 'questions': shared['questions']}
        key = digest(payload)
        if key in cached:
            records.append(cached[key])
        else:
            work.append((old, state, payload, key))
    api_key = load_key(ROOT / 'jev_key.env') if work else None

    def evaluate(item):
        old, state, payload, key = item
        response = request_jev(payload, api_key)
        return {'letter': old['letter'], 'request_sha256': key,
                'created_at': datetime.now(timezone.utc).isoformat(), 'state': state,
                'response': response, 'previous_answer': old['response']['answers']['basis'],
                'previous_type_at_threshold': proposed_type(old['response'], .8),
                'new_type_at_threshold': proposed_type(response, .8), 'threshold': .8}

    def save():
        report['records'] = sorted(records, key=lambda r: int(r['letter']))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temp = args.output.with_suffix('.json.tmp')
        temp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        temp.replace(args.output)
        args.output.with_suffix('.md').write_text(comparison_markdown(records))

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            for future in as_completed([executor.submit(evaluate, item) for item in work]):
                record = future.result()
                records.append(record)
                save()
                a = record['response']['answers']['basis']
                print(f"{len(records)}/{len(baseline)} letter {record['letter']}: {a['choice']} ({a['probabilities'][a['choice']]:.0%})", flush=True)
        save()
    finally:
        for path, content in before.items():
            if path.read_bytes() != content:
                raise RuntimeError(f'Protected source changed during comparison: {path}')
    print('Comparison saved; all XML, XSD and original editorial reports unchanged.')


if __name__ == '__main__':
    main()
