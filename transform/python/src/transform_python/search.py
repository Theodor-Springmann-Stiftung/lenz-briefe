"""Extract search units from the same semantic HTML that the edition displays."""
from __future__ import annotations

import unicodedata
from lxml import etree, html


def index_fragment(fragment: str, letter: str, kind: str, prefix: str,
                   label: str = "", whole_block: bool = False) -> tuple[str, list[dict]]:
    root = html.fragment_fromstring(fragment, create_parent="div")
    records: list[dict] = []
    pieces: list[tuple[str, str | None]] = []
    anchor = prefix
    counter = 0
    current_page: str | None = None

    def plain(value: str) -> str:
        return unicodedata.normalize("NFC", " ".join(value.split()))

    def flush() -> None:
        text = plain("".join(value for value, _ in pieces))
        if text:
            record = {"letter": letter, "kind": kind, "anchor": anchor, "text": text}
            pages = []
            preceding = ""
            for value, page in pieces:
                if page and (not pages or pages[-1][1] != page):
                    # Browser highlights use UTF-16 offsets in the normalized preview.
                    offset = len(plain(preceding).encode("utf-16-le")) // 2
                    if pages and pages[-1][0] == offset:
                        pages[-1][1] = page
                    else:
                        pages.append([offset, page])
                preceding += value
            if pages:
                record["pages"] = pages
            if label:
                record["label"] = label
            records.append(record)
        pieces.clear()

    def append(value: str | None, destination: str) -> None:
        nonlocal anchor
        if value:
            if not pieces:
                if not value.strip():
                    return
                anchor = destination
            pieces.append((value, current_page))

    def visit(node: etree._Element, destination: str) -> None:
        nonlocal counter, current_page
        if not isinstance(node.tag, str):
            return
        classes = set(node.get("class", "").split())
        if "page-anchor" in classes:
            current_page = node.get("data-index")
        elif "sidenote" in classes:
            current_page = node.get("data-page")
        cell = bool(classes & {"tab", "lb-tab-prefix"})
        line = "lb-line-block" in classes
        boundary = cell or bool(classes & {"tabs", "lb-tab-row"}) or (
            not whole_block and (line or "lb-vspace" in classes))
        if boundary:
            flush()
        if cell or (line and not whole_block):
            counter += 1
            destination = f"{prefix}-{'cell' if cell else 'block'}-{counter}"
            node.set("id", destination)
        # Within a sidenote, line breaks remain readable but do not split search units.
        if whole_block and (line or "lb-vspace" in classes):
            append(" ", destination)
        if classes & {"align-left", "align-center", "align-right"}:
            append(" ", destination)
        append(node.text, destination)
        for child in node:
            visit(child, destination)
            append(child.tail, destination)
        if whole_block and (line or "lb-vspace" in classes):
            append(" ", destination)
        if boundary:
            flush()

    visit(root, prefix)
    flush()
    rendered = (root.text or "") + "".join(
        etree.tostring(child, encoding="unicode", method="html") for child in root)
    return rendered, records
