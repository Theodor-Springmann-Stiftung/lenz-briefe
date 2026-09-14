#!/usr/bin/env python3
"""Replace empty-line runs without reserializing the surrounding XML.

Run from any directory; defaults to briefe.xml and traditions.xml in this checkout.
Without --write, report the planned changes only. Comments and other markup break
runs. Existing vspace elements are left unchanged, making the migration idempotent.
Requires only the Python standard library and UTF-8 XML.
"""
import argparse
from pathlib import Path
from xml.parsers import expat

ROOT = Path(__file__).resolve().parents[1]
NAMESPACES = {'', 'https://lenz-archiv.de'}


def tag_end(data, start):
    quote = None
    for i in range(start, len(data)):
        char = data[i]
        if quote:
            if char == quote:
                quote = None
        elif char in (34, 39):
            quote = char
        elif char == 62:
            return i + 1
    raise ValueError('Unclosed XML tag')


def migrate(data):
    """Return (UTF-8 XML bytes, number of replaced lines, number of runs)."""
    data.decode('utf-8')
    parser = expat.ParserCreate(namespace_separator='|')
    stack, spans = [], []

    def start(name, attrs):
        offset = parser.CurrentByteIndex
        end = tag_end(data, offset)
        ns, _, local = name.rpartition('|')
        target = ns in NAMESPACES and local == 'line' and attrs.get('type') == 'empty'
        if target and set(attrs) != {'type'}:
            raise ValueError(f'Empty line at byte {offset} has additional attributes; review manually')
        stack.append((offset, end, target))

    def end(name):
        offset, opening_end, target = stack.pop()
        if not target:
            return
        if data[offset:opening_end].rstrip().endswith(b'/>'):
            closing_end = opening_end
        else:
            if data[opening_end:parser.CurrentByteIndex].strip():
                raise ValueError(f'Empty line at byte {offset} contains content; review manually')
            closing_end = tag_end(data, parser.CurrentByteIndex)
        qname = data[offset + 1:opening_end].split(None, 1)[0]
        prefix = qname.rsplit(b':', 1)[0] + b':' if b':' in qname else b''
        spans.append((offset, closing_end, prefix))

    def reject_doctype(*args):
        raise ValueError('DTD declarations are not supported')

    parser.StartElementHandler = start
    parser.EndElementHandler = end
    parser.StartDoctypeDeclHandler = reject_doctype
    parser.Parse(data, True)
    spans.sort()
    runs = []
    for start, end, prefix in spans:
        if runs and runs[-1][3] == prefix and not data[runs[-1][1]:start].strip():
            first, _, count, _ = runs[-1]
            runs[-1] = (first, end, count + 1, prefix)
        else:
            runs.append((start, end, 1, prefix))
    result = data
    for start, end, count, prefix in reversed(runs):
        result = result[:start] + b'<' + prefix + b'vspace lines="' + str(count).encode() + b'"/>' + result[end:]
    expat.ParserCreate().Parse(result, True)
    return result, len(spans), len(runs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*', type=Path)
    parser.add_argument('--write', action='store_true', help='Apply changes in place')
    args = parser.parse_args()
    files = args.files or [ROOT / 'data/xml/briefe.xml', ROOT / 'data/xml/traditions.xml']
    # Parse all inputs before writing, so malformed input does not cause a partial migration.
    results = [(path, *migrate(path.read_bytes())) for path in files]
    for path, result, count, runs in results:
        if args.write and count:
            path.write_bytes(result)
        print(f'{path}: {count} empty lines -> {runs} vspace elements' + (' (written)' if args.write and count else ''))


if __name__ == '__main__':
    main()
