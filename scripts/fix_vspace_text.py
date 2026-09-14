#!/usr/bin/env python3
"""Insert line before text/its formatting wrapper after vspace; minimum one.

Preview by default; --write applies changes. Preserves XML bytes outside edits.
Defaults to this checkout's briefe.xml and traditions.xml.
"""
import argparse
from pathlib import Path
import re
from xml.parsers import expat
from migrate_vspace import tag_end

ROOT = Path(__file__).resolve().parents[1]


def fix(data):
    data.decode('utf-8')
    parser = expat.ParserCreate(namespace_separator='|')
    pending, edits, stack = [], [], []
    in_cdata = False
    passages = 0
    boundary = 0

    def local(name):
        ns, _, tag = name.rpartition('|')
        return tag if ns in ('', 'https://lenz-archiv.de') else ''

    def start(name, attrs):
        nonlocal boundary
        offset = parser.CurrentByteIndex
        end = tag_end(data, offset)
        opening = data[offset:end]
        qname = re.match(rb'<([^\s/>]+)', opening)[1]
        prefix = qname.rsplit(b':', 1)[0] + b':' if b':' in qname else b''
        stack.append((offset, prefix))
        tag = local(name)
        if tag in ('letterText', 'letterTradition', 'page', 'line'):
            pending.clear()
        elif tag == 'vspace':
            boundary = end
            lines = int(attrs['lines'])
            if lines < 1:
                raise ValueError('vspace lines must be positive')
            match = re.search(rb'\blines\s*=\s*([\'\"])([^\'\"]*)\1', opening)
            if not match:
                raise ValueError('Missing literal lines attribute')
            pending.append((offset + match.start(2), offset + match.end(2), str(max(1, lines - 1)).encode()))

    def end(name):
        if local(name) in ('letterText', 'letterTradition'):
            pending.clear()
        stack.pop()

    def text(value):
        nonlocal passages
        if not pending or not value.strip():
            return
        if in_cdata:
            raise ValueError('Text after vspace inside CDATA needs manual review')
        leading = value[:len(value) - len(value.lstrip())]
        offset = parser.CurrentByteIndex + len(leading.encode('utf-8'))
        # Keep the line outside wrappers opened after the vspace (e.g. align).
        wrappers = [entry for entry in stack if entry[0] >= boundary]
        prefix = stack[-1][1]
        if wrappers:
            offset, prefix = wrappers[0]
        edits.extend(pending)
        edits.append((offset, offset, b'<' + prefix + b'line />'))
        pending.clear()
        passages += 1

    def cdata_start():
        nonlocal in_cdata
        in_cdata = True

    def cdata_end():
        nonlocal in_cdata
        in_cdata = False

    def reject_doctype(*args):
        raise ValueError('DTD declarations are not supported')

    parser.StartElementHandler = start
    parser.EndElementHandler = end
    parser.CharacterDataHandler = text
    parser.StartCdataSectionHandler = cdata_start
    parser.EndCdataSectionHandler = cdata_end
    parser.StartDoctypeDeclHandler = reject_doctype
    parser.Parse(data, True)
    result = data
    for start, end, replacement in sorted(edits, reverse=True):
        result = result[:start] + replacement + result[end:]
    expat.ParserCreate().Parse(result, True)
    return format_vspaces(result), passages


def format_vspaces(data):
    """Place actual vspace elements on their own lines, leaving comments alone."""
    parser = expat.ParserCreate(namespace_separator='|')
    spans = []

    def start(name, attrs):
        ns, _, tag = name.rpartition('|')
        if ns not in ('', 'https://lenz-archiv.de') or tag != 'vspace':
            return
        begin = parser.CurrentByteIndex
        end = tag_end(data, begin)
        if not data[begin:end].rstrip().endswith(b'/>'):
            raise ValueError('Expected a self-closing vspace for source formatting')
        spans.append((begin, end))

    parser.StartElementHandler = start
    parser.Parse(data, True)
    newline = b'\r\n' if b'\r\n' in data else b'\n'
    for begin, end in reversed(spans):
        line_start = data.rfind(b'\n', 0, begin) + 1
        before = data[line_start:begin]
        prefix = b'' if not before.strip() else newline
        after = end
        while after < len(data) and data[after:after + 1] in (b' ', b'\t'):
            after += 1
        suffix = b'' if data[after:after + 1] in (b'\n', b'\r') else newline
        head = data[:begin].rstrip(b' \t') if prefix else data[:begin]
        data = head + prefix + data[begin:end] + suffix + data[after:]
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*', type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    files = args.files or [ROOT / 'data/xml/briefe.xml', ROOT / 'data/xml/traditions.xml']
    results = [(path, *fix(path.read_bytes())) for path in files]
    for path, result, count in results:
        if args.write and result != path.read_bytes():
            path.write_bytes(result)
        print(f'{path}: {count} passages' + (' (written)' if args.write and count else ''))


if __name__ == '__main__':
    main()
