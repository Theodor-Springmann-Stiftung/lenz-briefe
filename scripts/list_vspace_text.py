#!/usr/bin/env python3
"""List text following vspace before the next page/line marker; never edit XML.

Usage: python3 scripts/list_vspace_text.py [file.xml ...]
Defaults to briefe.xml and traditions.xml in this checkout. Uses document order,
including text inside formatting elements, and ignores comments and whitespace.
Checks stop at each letterText/letterTradition boundary. Trailing vspace without
text is not reported. Requires only Python's standard library.
"""
import argparse
from pathlib import Path
from xml.parsers import expat

ROOT = Path(__file__).resolve().parents[1]


def find_text_after_vspace(data):
    parser = expat.ParserCreate(namespace_separator='|')
    pending, findings, text_parts = [], [], []
    letter = None

    def flush_text():
        text = ' '.join(''.join(text_parts).split())
        text_parts.clear()
        if text and pending:
            findings.extend((line, letter, text[:160]) for line in pending)
            pending.clear()

    def local(name):
        namespace, _, tag = name.rpartition('|')
        return tag if namespace in ('', 'https://lenz-archiv.de') else ''

    def start(name, attrs):
        nonlocal letter
        flush_text()
        tag = local(name)
        if tag in ('letterText', 'letterTradition'):
            pending.clear()
            letter = attrs.get('letter', '?')
        elif tag in ('page', 'line'):
            pending.clear()
        elif tag == 'vspace':
            pending.append(parser.CurrentLineNumber)

    def end(name):
        nonlocal letter
        flush_text()
        if local(name) in ('letterText', 'letterTradition'):
            pending.clear()
            letter = None

    def reject_doctype(*args):
        raise ValueError('DTD declarations are not supported')

    parser.StartElementHandler = start
    parser.EndElementHandler = end
    parser.CharacterDataHandler = text_parts.append
    parser.StartDoctypeDeclHandler = reject_doctype
    parser.Parse(data, True)
    flush_text()
    return findings


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*', type=Path)
    args = parser.parse_args()
    files = args.files or [ROOT / 'data/xml/briefe.xml', ROOT / 'data/xml/traditions.xml']
    for path in files:
        findings = find_text_after_vspace(path.read_bytes())
        for line, letter, text in findings:
            print(f'{path}:{line}: Brief {letter}: {text}')
        print(f'# {path.name}: {len(findings)} occurrences')


if __name__ == '__main__':
    main()
