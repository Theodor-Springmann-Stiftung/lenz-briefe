from __future__ import annotations

from dataclasses import dataclass
import json
from html import escape
from pathlib import Path
import tempfile
from time import perf_counter
from typing import Any

from lxml import etree
from saxonche import PySaxonProcessor

from .common import (
    CACHE_DIR,
    NSMAP,
    Timings,
    assert_safe_output_dir,
    ensure_dir,
    get_attribute,
    get_git_metadata_safe,
    read_xml,
    replace_dir,
    reset_dir,
    serialize_node,
    slugify_letter,
    text_content,
    utc_iso_now,
    validate_xml,
    write_json,
    write_text,
    XSLT_DIR,
)

from .verweise import check_verweise
from .catalog import read_year_groups
from .search import index_fragment


def extract_date(node: etree._Element | None) -> dict[str, Any] | None:
    if node is None:
        return None
    return {
        "text": text_content(node),
        "when": get_attribute(node, "when"),
        "notBefore": get_attribute(node, "notBefore"),
        "notAfter": get_attribute(node, "notAfter"),
        "from": get_attribute(node, "from"),
        "to": get_attribute(node, "to"),
        "cert": get_attribute(node, "cert", "high"),
        "content": extract_annotation_parts(node),
    }


def build_reference_maps(references_doc: etree._ElementTree) -> dict[str, Any]:
    person_map: dict[str, dict[str, Any]] = {}
    location_map: dict[str, dict[str, Any]] = {}
    app_map: dict[str, dict[str, Any]] = {}

    for node in references_doc.xpath("//l:personDef", namespaces=NSMAP):
        index = str(get_attribute(node, "index"))
        person_map[index] = {
            "index": index,
            "name": get_attribute(node, "name"),
            "vorname": get_attribute(node, "vorname"),
            "nachname": get_attribute(node, "nachname"),
            "komm": get_attribute(node, "komm"),
            "ref": get_attribute(node, "ref"),
        }

    for node in references_doc.xpath("//l:locationDef", namespaces=NSMAP):
        index = str(get_attribute(node, "index"))
        location_map[index] = {
            "index": index,
            "name": get_attribute(node, "name"),
            "ref": get_attribute(node, "ref"),
        }

    for node in references_doc.xpath("//l:appDef", namespaces=NSMAP):
        index = str(get_attribute(node, "index"))
        app_map[index] = {
            "index": index,
            "name": get_attribute(node, "name"),
            "category": get_attribute(node, "category"),
        }

    return {"personMap": person_map, "locationMap": location_map, "appMap": app_map,
            "yearGroups": read_year_groups(references_doc)}


def extract_annotation_parts(node: etree._Element) -> list[dict[str, Any]]:
    """Preserve mixed-content order and whitespace without exporting XML comments."""
    parts: list[dict[str, Any]] = []

    def append_text(text: str | None) -> None:
        if not text:
            return
        if parts and parts[-1]["type"] == "text":
            parts[-1]["text"] += text
        else:
            parts.append({"type": "text", "text": text})

    append_text(node.text)
    for child in node:
        if child.tag == f"{{{NSMAP['l']}}}wwwlink":
            parts.append({
                "type": "wwwlink",
                "address": get_attribute(child, "address"),
                "children": extract_annotation_parts(child),
            })
        elif isinstance(child.tag, str):
            append_text("".join(child.itertext()))
        append_text(child.tail)
    return parts


def resolve_refs(nodes: list[etree._Element], mapping: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    resolved_nodes = []
    for node in nodes:
        ref = str(get_attribute(node, "ref", ""))
        resolved = mapping.get(ref)
        resolved_nodes.append(
            {
                "ref": ref,
                "cert": get_attribute(node, "cert"),
                "erschlossen": get_attribute(node, "erschlossen"),
                "label": resolved["name"] if resolved else None,
                "resolved": resolved,
                "annotationText": text_content(node),
                "annotationParts": extract_annotation_parts(node),
            }
        )
    return resolved_nodes


def extract_meta(letter_desc: etree._Element, refs: dict[str, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    letter = str(get_attribute(letter_desc, "letter"))
    sent_node = letter_desc.xpath("./l:sent", namespaces=NSMAP)
    received_node = letter_desc.xpath("./l:received", namespaces=NSMAP)
    sent = sent_node[0] if sent_node else None
    received = received_node[0] if received_node else None

    sent_dates = sent.xpath("./l:date", namespaces=NSMAP) if sent is not None else []
    sent_locations = sent.xpath("./l:location", namespaces=NSMAP) if sent is not None else []
    sent_persons = sent.xpath("./l:person", namespaces=NSMAP) if sent is not None else []
    received_dates = received.xpath("./l:date", namespaces=NSMAP) if received is not None else []
    received_locations = received.xpath("./l:location", namespaces=NSMAP) if received is not None else []
    received_persons = received.xpath("./l:person", namespaces=NSMAP) if received is not None else []

    events = []
    for event in letter_desc:
        if not isinstance(event.tag, str) or etree.QName(event).localname not in ("sent", "received"):
            continue
        events.append({
            "type": etree.QName(event).localname,
            "dates": [extract_date(n) for n in event.findall("l:date", NSMAP)],
            "persons": resolve_refs(event.findall("l:person", NSMAP), refs["personMap"]),
            "locations": resolve_refs(event.findall("l:location", NSMAP), refs["locationMap"]),
        })
    return {
        "events": events,
        "letter": letter,
        "slug": slugify_letter(letter),
        "sent": {
            "date": extract_date(sent_dates[0] if sent_dates else None),
            "locations": resolve_refs(sent_locations, refs["locationMap"]),
            "persons": resolve_refs(sent_persons, refs["personMap"]),
        },
        "received": {
            "date": extract_date(received_dates[0] if received_dates else None),
            "locations": resolve_refs(received_locations, refs["locationMap"]),
            "persons": resolve_refs(received_persons, refs["personMap"]),
        },
        "traditions": [{"isOriginal": n.get("isOriginal") in ("true", "1"), "type": n.get("type")}
                       for n in letter_desc.xpath("./l:traditions/l:tradition", namespaces=NSMAP)],
        "hasOriginal": any(node.get("isOriginal") in ("true", "1") for node in letter_desc.xpath("./l:traditions/l:tradition", namespaces=NSMAP)),
        "isProofread": get_attribute(_first_xpath(letter_desc, "./l:isProofread"), "value") in ("true", "1"),
        "isDraft": get_attribute(_first_xpath(letter_desc, "./l:isDraft"), "value") in ("true", "1"),
    }


def _first_xpath(node: etree._Element, expr: str) -> etree._Element | None:
    matches = node.xpath(expr, namespaces=NSMAP)
    return matches[0] if matches else None


def collect_hand_order(letter_text: etree._Element, base_ref: str | None) -> list[str]:
    refs: dict[str, None] = {}

    def visit(node: etree._Element, hand: str | None) -> None:
        if not isinstance(node.tag, str):
            return
        tag = etree.QName(node).localname
        if tag in ('note', 'pe'):
            return
        if tag == 'hand':
            hand = node.get('ref')
            if hand:
                refs[hand] = None
        if node.text and node.text.strip() and hand:
            refs[hand] = None
        for child in node:
            visit(child, hand)
            if child.tail and child.tail.strip() and hand:
                refs[hand] = None

    visit(letter_text, base_ref)
    return list(refs)


def collect_sidenote_pages(letter_text: etree._Element) -> list[str]:
    pages = {str(get_attribute(note, "page")) for note in letter_text.xpath(".//l:sidenote", namespaces=NSMAP)}
    return sorted(pages, key=lambda page: int(page))


def collect_letter_pages(letter_text: etree._Element) -> list[str]:
    pages = [str(get_attribute(node, "index")) for node in letter_text.xpath(".//l:page[not(ancestor::l:sidenote)]", namespaces=NSMAP)]
    return sorted(pages, key=lambda page: int(page))


def build_sidenote_records(
    sidenotes: list[etree._Element], letter: str, page: str, html_items: list[str]
) -> list[dict[str, Any]]:
    return [
        {
            "id": f"{slugify_letter(letter)}-page-{page}-sidenote-{index + 1}",
            "order": index + 1,
            "letter": str(letter),
            "page": str(page),
            "pos": get_attribute(node, "pos"),
            "annotation": get_attribute(node, "annotation"),
            "html": html_items[index] if index < len(html_items) else "",
        }
        for index, node in enumerate(sidenotes)
    ]


def extract_tradition_presence(tradition_node: etree._Element | None) -> bool:
    if tradition_node is None:
        return False
    return bool(tradition_node.xpath("./*[local-name()='app']"))


def render_empty_traditions(letter: str) -> str:
    return f'<section class="traditions" data-letter="{letter}"></section>'


class PipelineFailure(Exception):
    def __init__(self, kind: str, stage: str, message: str, cause: Exception | None = None) -> None:
        super().__init__(f"{stage}: {message}")
        self.kind = kind
        self.stage = stage
        self.message = message
        self.cause = cause

    def with_context(self, **context: str | None) -> "PipelineFailure":
        details = ", ".join(f"{key}={value}" for key, value in context.items() if value is not None)
        message = f"{self.message} ({details})" if details else self.message
        return PipelineFailure(self.kind, self.stage, message, self)


def _build_success_status(
    generator: str, source: dict[str, str], counts: dict[str, int], warnings: list[dict[str, str]] | None = None
) -> dict[str, Any]:
    result = {
        "version": 1,
        "state": "success",
        "generator": generator,
        "generatedAt": utc_iso_now(),
        "source": source,
        "success": {
            "counts": counts,
        },
    }
    if warnings:
        result["warnings"] = warnings
    return result


def _build_failure_status(
    generator: str, source: dict[str, str], failure: PipelineFailure, warnings: list[dict[str, str]] | None = None
) -> dict[str, Any]:
    result = {
        "version": 1,
        "state": "failure",
        "generator": generator,
        "generatedAt": utc_iso_now(),
        "source": source,
        "failure": {
            "kind": failure.kind,
            "stage": failure.stage,
            "message": failure.message,
        },
    }
    if warnings:
        result["warnings"] = warnings
    return result


def _normalize_failure(error: Exception) -> PipelineFailure:
    if isinstance(error, PipelineFailure):
        return error
    return PipelineFailure("unknown", "export", str(error), error)


def _read_required_xml(file_name: str) -> etree._ElementTree:
    try:
        return read_xml(file_name)
    except Exception as error:
        stage = f"readXml:{file_name.removesuffix('.xml')}"
        raise PipelineFailure("xml", stage, str(error), error) from error


@dataclass
class StylesheetRunner:
    processor: Any
    xsltproc: Any
    executables: dict[str, Any]

    @classmethod
    def create(cls) -> "StylesheetRunner":
        processor = PySaxonProcessor(license=False)
        xsltproc = processor.new_xslt30_processor()
        executables: dict[str, Any] = {}
        return cls(processor=processor, xsltproc=xsltproc, executables=executables)

    def compile_stylesheet(self, name: str, timings: Timings) -> Any:
        executable = self.executables.get(name)
        if executable is not None:
            return executable

        def compile_now() -> Any:
            try:
                ensure_dir(CACHE_DIR)
                stylesheet_path = XSLT_DIR / f"{name}.xsl"
                sef_path = CACHE_DIR / f"{name}.sef.json"
                dependency_paths = [stylesheet_path]
                common_stylesheet_path = XSLT_DIR / "common.xsl"
                if name != "common":
                    dependency_paths.append(common_stylesheet_path)

                latest_dependency_mtime = max(path.stat().st_mtime for path in dependency_paths)
                should_compile = True
                if sef_path.exists():
                    should_compile = latest_dependency_mtime > sef_path.stat().st_mtime

                if should_compile:
                    self.xsltproc.compile_stylesheet(stylesheet_file=str(stylesheet_path), save=str(sef_path))

                return self.xsltproc.compile_stylesheet(stylesheet_file=str(stylesheet_path))
            except Exception as error:
                raise PipelineFailure("xslt", f"compile:{name}", str(error), error) from error

        executable = timings.measure("compileStylesheet", compile_now)
        self.executables[name] = executable
        return executable

    def run_stylesheet(self, name: str, source_text: str, stylesheet_params: dict[str, str], timings: Timings) -> str:
        executable = self.compile_stylesheet(name, timings)

        def run_now() -> str:
            try:
                executable.clear_parameters()
                document = self.processor.parse_xml(xml_text=source_text)
                executable.set_global_context_item(xdm_item=document)
                for key, value in stylesheet_params.items():
                    executable.set_parameter(key, self.processor.make_string_value(str(value)))
                result = executable.call_template_returning_string()
                return str(result).strip()
            except PipelineFailure:
                raise
            except Exception as error:
                raise PipelineFailure("xslt", f"transform:{name}", str(error), error) from error

        return timings.measure(f"transform:{name}", run_now)


def export_edition(out_dir: str) -> dict[str, Any]:
    timings = Timings()
    started_at = perf_counter()
    absolute_out_dir = Path(out_dir).resolve()
    runner = StylesheetRunner.create()

    briefe_doc = timings.measure("readXml:briefe", lambda: _read_required_xml("briefe.xml"))
    meta_doc = timings.measure("readXml:meta", lambda: _read_required_xml("meta.xml"))
    traditions_doc = timings.measure("readXml:traditions", lambda: _read_required_xml("traditions.xml"))
    references_doc = timings.measure("readXml:references", lambda: _read_required_xml("references.xml"))
    refs = timings.measure("buildReferenceMaps", lambda: build_reference_maps(references_doc))

    warnings: list[dict[str, str]] = []
    warnings += timings.measure("validateXsd:briefe", lambda: validate_xml(briefe_doc, "briefe.xml"))
    warnings += timings.measure("validateXsd:meta", lambda: validate_xml(meta_doc, "meta.xml"))
    warnings += timings.measure("validateXsd:traditions", lambda: validate_xml(traditions_doc, "traditions.xml"))
    warnings += timings.measure("validateXsd:references", lambda: validate_xml(references_doc, "references.xml"))
    warnings += timings.measure("lintVerweise", lambda: check_verweise(briefe_doc, meta_doc, traditions_doc, references_doc))
    for letter_node in briefe_doc.findall(".//l:letterText", NSMAP):
        targets = set(collect_letter_pages(letter_node))
        for note in letter_node.findall(".//l:sidenote", NSMAP):
            if note.get("page") not in targets:
                warnings.append({"kind": "unresolved-sidenote", "stage": "sidenoteTargets",
                                 "letter": letter_node.get("letter"), "page": note.get("page"),
                                 "line": note.sourceline,
                                 "message": "Sidenote retained without a matching page marker."})

    timings.measure("resetOutDir", lambda: reset_dir(absolute_out_dir))

    letter_text_nodes = timings.measure(
        "select:letterTextNodes",
        lambda: briefe_doc.xpath("/l:opus/l:document/l:letterText", namespaces=NSMAP),
    )
    meta_letter_nodes = timings.measure(
        "select:metaLetterNodes",
        lambda: meta_doc.xpath("/l:opus/l:descriptions/l:letterDesc", namespaces=NSMAP),
    )
    tradition_letter_nodes = timings.measure(
        "select:traditionLetterNodes",
        lambda: traditions_doc.xpath("/*[local-name()='opus']/*[local-name()='traditions']/*[local-name()='letterTradition']"),
    )

    meta_by_letter = {
        str(get_attribute(node, "letter")): extract_meta(node, refs) for node in meta_letter_nodes
    }
    traditions_by_letter = {
        str(get_attribute(node, "letter")): node for node in tradition_letter_nodes
    }

    app_definitions = json.dumps(refs["appMap"], ensure_ascii=False)
    index_entries: list[dict[str, Any]] = []
    search_records: list[dict[str, Any]] = []
    for letter_text in letter_text_nodes:
        entry = timings.measure(
            "processLetter",
            lambda lt=letter_text: _process_letter(lt, absolute_out_dir, runner, timings, meta_by_letter, traditions_by_letter, app_definitions, search_records),
        )
        index_entries.append(entry)

    from .catalog import build_catalog
    catalog = build_catalog(index_entries, refs)
    write_json(absolute_out_dir / "catalog.json", catalog)
    write_text(absolute_out_dir / "search.json", json.dumps(
        {"version": 1, "blocks": search_records}, ensure_ascii=False, separators=(",", ":")))
    index_entries.sort(key=lambda entry: int(entry["letter"]))
    timings.measure(
        "writeFile:indexJson",
        lambda: write_json(absolute_out_dir / "letters" / "index.json", index_entries),
    )

    return {
        "totalMs": (perf_counter() - started_at) * 1000.0,
        "counts": {
            "meta": len(meta_letter_nodes),
            "letterText": len(letter_text_nodes),
            "traditions": len(tradition_letter_nodes),
        },
        "timings": timings.snapshot(),
        "warnings": warnings,
    }


def run_export(out_dir: str, generator: str = "python") -> dict[str, Any]:
    absolute_out_dir = assert_safe_output_dir(Path(out_dir))
    ensure_dir(absolute_out_dir.parent)
    staging_dir = Path(tempfile.mkdtemp(prefix=f"{absolute_out_dir.name}-", dir=str(absolute_out_dir.parent)))
    source = get_git_metadata_safe()

    try:
        result = export_edition(str(staging_dir))
        write_json(staging_dir / "status.json", _build_success_status(generator, source, result["counts"], result.get("warnings")))
        replace_dir(staging_dir, absolute_out_dir)
        return result
    except Exception as error:
        failure = _normalize_failure(error)
        reset_dir(staging_dir)
        write_json(staging_dir / "status.json", _build_failure_status(generator, source, failure))
        replace_dir(staging_dir, absolute_out_dir)
        raise failure


def _process_letter(
    letter_text: etree._Element,
    absolute_out_dir: Path,
    runner: StylesheetRunner,
    timings: Timings,
    meta_by_letter: dict[str, dict[str, Any]],
    traditions_by_letter: dict[str, etree._Element],
    app_definitions: str,
    search_records: list[dict[str, Any]],
) -> dict[str, Any]:
    letter = str(get_attribute(letter_text, "letter"))
    slug = slugify_letter(letter)
    letter_dir = absolute_out_dir / "letters" / letter
    pages = timings.measure("collectLetterPages", lambda: collect_letter_pages(letter_text))

    tradition_node = traditions_by_letter.get(letter)
    has_traditions = extract_tradition_presence(tradition_node)
    if has_traditions and tradition_node is not None:
        try:
            traditions_html = runner.run_stylesheet(
                "traditions",
                serialize_node(tradition_node),
                {"letter": letter, "appDefinitions": app_definitions},
                timings,
            )
        except PipelineFailure as error:
            raise error.with_context(letter=letter) from error
    else:
        traditions_html = render_empty_traditions(letter)
    meta = meta_by_letter.get(letter) or {
        "letter": letter,
        "slug": slug,
        "events": [],
        "sent": {"date": None, "locations": [], "persons": []},
        "received": {"date": None, "locations": [], "persons": []},
        "traditions": [],
        "hasOriginal": False,
        "isProofread": False,
        "isDraft": False,
    }

    try:
        text_html = runner.run_stylesheet(
            "letter-text",
            serialize_node(letter_text),
            {},
            timings,
        )
    except PipelineFailure as error:
        raise error.with_context(letter=letter) from error
    text_html, blocks = index_fragment(text_html, letter, "text", "text")
    search_records.extend(blocks)
    timings.measure(
        "writeFile:textHtml",
        lambda text_value=text_html: write_text(letter_dir / "text.html", text_value + "\n"),
    )

    sidenotes_by_page: dict[str, list[dict[str, Any]]] = {}
    all_sidenotes = letter_text.findall('.//l:sidenote', NSMAP)
    source_orders = {node: index + 1 for index, node in enumerate(all_sidenotes)}
    for page in sorted(set(pages) | set(collect_sidenote_pages(letter_text)), key=int):
        sidenotes = timings.measure(
            "select:pageSidenotes",
            lambda page_value=page: [node for node in all_sidenotes if node.get('page') == page_value],
        )
        records = build_sidenote_records(
            sidenotes,
            letter,
            page,
            ["" for _ in sidenotes],
        )
        if sidenotes:
            try:
                html_items = [
                    runner.run_stylesheet(
                        "sidenotes",
                        serialize_node(sidenote),
                        {"letter": letter, "sidenoteId": records[index]["id"],
                         "inheritedHand": sidenote.xpath('string(ancestor::l:hand[1]/@ref)', namespaces=NSMAP)},
                        timings,
                    )
                    for index, sidenote in enumerate(sidenotes)
                ]
            except PipelineFailure as error:
                raise error.with_context(letter=letter, page=page) from error
            for index, html in enumerate(html_items):
                records[index]["html"], blocks = index_fragment(
                    html, letter, "sidenote", records[index]["id"],
                    label=f"Randnotiz · Seite {page}", whole_block=True)
                search_records.extend(blocks)
        for record, node in zip(records, sidenotes):
            record["anchorId"] = f"page-{page}" if page in pages else None
            record["sourceOrder"] = source_orders[node]
        sidenotes_by_page[page] = records
    timings.measure(
        "writeFile:sidenotesJson",
        lambda: write_json(letter_dir / "sidenotes.json", sidenotes_by_page),
    )

    sidenote_pages = timings.measure("collectSidenotePages", lambda: collect_sidenote_pages(letter_text))
    tradition_records = []
    definitions = json.loads(app_definitions)
    if tradition_node is not None:
        def add_text(value):
            if value and value.strip():
                tradition_records.append({"type": "text", "html": '<div class="lb-line-block">' + escape(value) + '</div>'})
        add_text(tradition_node.text)
        app_index = 0
        for app in tradition_node:
            if isinstance(app.tag, str) and etree.QName(app).localname == "app":
                app_index += 1
                ref = app.get("ref", "")
                definition = definitions.get(ref, {})
                tradition_records.append({
                    "type": "app", "id": f"app-{app_index}", "ref": ref,
                    "name": definition.get("name") or f"Apparat {ref}",
                    "category": definition.get("category") or "Weitere Angaben",
                    "html": runner.run_stylesheet("app-body", serialize_node(app),
                        {"pagePrefix": f"app-{app_index}-page-"}, timings),
                })
            add_text(app.tail)
    for index, record in enumerate(tradition_records):
        record["html"], blocks = index_fragment(
            record["html"], letter, "tradition", record.get("id", f"tradition-text-{index + 1}"),
            label=record.get("name", "Überlieferungsdaten"))
        search_records.extend(blocks)
    write_json(letter_dir / "traditions.json", tradition_records)
    meta_output = {
        **meta,
        "letter": letter,
        "slug": slug,
        "hasText": True,
        "hasTraditions": bool(tradition_records),
        "hasSidenotes": len(sidenote_pages) > 0,
        "pageCount": len(pages),
        "pages": pages,
        "handRefs": sorted(set(letter_text.xpath(".//l:hand/@ref", namespaces=NSMAP)), key=int),
        "handOrder": collect_hand_order(letter_text, next((person['ref'] for event in meta['events']
            if event['type'] == 'sent' for person in event['persons']), None)),
        "traditionsHtml": traditions_html,
    }
    timings.measure(
        "writeFile:metaJson",
        lambda: write_json(letter_dir / "meta.json", meta_output),
    )

    meta_output_without_html = dict(meta_output)
    meta_output_without_html.pop("traditionsHtml", None)
    return meta_output_without_html
