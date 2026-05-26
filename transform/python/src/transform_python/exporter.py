from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import tempfile
from time import perf_counter
from typing import Any

from lxml import etree
from saxonche import PySaxonProcessor

from .common import (
    CACHE_DIR,
    NS,
    NSMAP,
    Timings,
    ensure_dir,
    get_attribute,
    get_git_metadata_safe,
    read_xml,
    remove_file_if_exists,
    replace_dir,
    reset_dir,
    serialize_child_node,
    serialize_node,
    slugify_letter,
    text_content,
    utc_iso_now,
    write_json,
    write_text,
    XSLT_DIR,
)


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
        "cert": get_attribute(node, "cert"),
    }


def build_reference_maps(references_doc: etree._ElementTree) -> dict[str, dict[str, dict[str, Any]]]:
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

    return {"personMap": person_map, "locationMap": location_map, "appMap": app_map}


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

    return {
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
        "hasOriginal": get_attribute(_first_xpath(letter_desc, "./l:hasOriginal"), "value") == "true",
        "isProofread": get_attribute(_first_xpath(letter_desc, "./l:isProofread"), "value") == "true",
        "isDraft": get_attribute(_first_xpath(letter_desc, "./l:isDraft"), "value") == "true",
    }


def _first_xpath(node: etree._Element, expr: str) -> etree._Element | None:
    matches = node.xpath(expr, namespaces=NSMAP)
    return matches[0] if matches else None


def collect_sidenote_pages(letter_text: etree._Element) -> list[str]:
    pages = {str(get_attribute(note, "page")) for note in letter_text.xpath("./l:sidenote", namespaces=NSMAP)}
    return sorted(pages, key=lambda page: int(page))


def split_letter_text_by_page(letter_text: etree._Element, letter: str) -> dict[str, str]:
    page_map: dict[str, str] = {}
    current_page: str | None = None
    current_chunks: list[str] = []

    for node in letter_text.xpath("./node()", namespaces=NSMAP):
        if isinstance(node, etree._Element) and isinstance(node.tag, str) and etree.QName(node).localname == "page":
            if current_page is not None:
                page_map[current_page] = (
                    f'<letterPage xmlns="{NS}" letter="{letter}" page="{current_page}">'
                    + "".join(current_chunks)
                    + "</letterPage>"
                )
            current_page = str(get_attribute(node, "index"))
            current_chunks = [serialize_child_node(node)]
            continue
        if current_page is not None:
            current_chunks.append(serialize_child_node(node))

    if current_page is not None:
        page_map[current_page] = (
            f'<letterPage xmlns="{NS}" letter="{letter}" page="{current_page}">'
            + "".join(current_chunks)
            + "</letterPage>"
        )

    return page_map


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
    generator: str, source: dict[str, str], counts: dict[str, int]
) -> dict[str, Any]:
    return {
        "version": 1,
        "state": "success",
        "generator": generator,
        "generatedAt": utc_iso_now(),
        "source": source,
        "success": {
            "counts": counts,
        },
    }


def _build_failure_status(generator: str, source: dict[str, str], failure: PipelineFailure) -> dict[str, Any]:
    return {
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

    index_entries: list[dict[str, Any]] = []
    for letter_text in letter_text_nodes:
        entry = timings.measure(
            "processLetter",
            lambda lt=letter_text: _process_letter(lt, absolute_out_dir, runner, timings, meta_by_letter, traditions_by_letter),
        )
        index_entries.append(entry)

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
    }


def run_export(out_dir: str, generator: str = "python") -> dict[str, Any]:
    absolute_out_dir = Path(out_dir).resolve()
    ensure_dir(absolute_out_dir.parent)
    staging_dir = Path(tempfile.mkdtemp(prefix=f"{absolute_out_dir.name}-", dir=str(absolute_out_dir.parent)))
    source = get_git_metadata_safe()

    try:
        result = export_edition(str(staging_dir))
        write_json(staging_dir / "status.json", _build_success_status(generator, source, result["counts"]))
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
) -> dict[str, Any]:
    letter = str(get_attribute(letter_text, "letter"))
    slug = slugify_letter(letter)
    letter_dir = absolute_out_dir / "letters" / letter
    page_xml_map = timings.measure("splitLetterTextByPage", lambda: split_letter_text_by_page(letter_text, letter))

    tradition_node = traditions_by_letter.get(letter)
    has_traditions = extract_tradition_presence(tradition_node)
    if has_traditions and tradition_node is not None:
        try:
            traditions_html = runner.run_stylesheet(
                "traditions",
                serialize_node(tradition_node),
                {"letter": letter},
                timings,
            )
        except PipelineFailure as error:
            raise error.with_context(letter=letter) from error
    else:
        traditions_html = render_empty_traditions(letter)
    meta = meta_by_letter.get(letter) or {
        "letter": letter,
        "slug": slug,
        "sent": {"date": None, "locations": [], "persons": []},
        "received": {"date": None, "locations": [], "persons": []},
        "hasOriginal": False,
        "isProofread": False,
        "isDraft": False,
    }

    for page, page_xml in page_xml_map.items():
        try:
            text_html = runner.run_stylesheet(
                "letter-text",
                page_xml,
                {"letter": letter, "page": page},
                timings,
            )
        except PipelineFailure as error:
            raise error.with_context(letter=letter, page=page) from error
        timings.measure(
            "writeFile:textHtml",
            lambda page_value=page, text_value=text_html: write_text(letter_dir / page_value / "text.html", text_value + "\n"),
        )

        sidenotes = timings.measure(
            "select:pageSidenotes",
            lambda page_value=page: letter_text.xpath(f"./l:sidenote[@page='{page_value}']", namespaces=NSMAP),
        )
        sidenotes_path = letter_dir / page / "sidenotes.json"
        if sidenotes:
            records = build_sidenote_records(
                sidenotes,
                letter,
                page,
                ["" for _ in sidenotes],
            )
            try:
                html_items = [
                    runner.run_stylesheet(
                        "sidenotes",
                        serialize_node(sidenote),
                        {"letter": letter, "sidenoteId": records[index]["id"]},
                        timings,
                    )
                    for index, sidenote in enumerate(sidenotes)
                ]
            except PipelineFailure as error:
                raise error.with_context(letter=letter, page=page) from error
            for index, html in enumerate(html_items):
                records[index]["html"] = html
            timings.measure(
                "writeFile:sidenotesJson",
                lambda: write_json(sidenotes_path, records),
            )
        else:
            timings.measure("removeFile:sidenotesJson", lambda: remove_file_if_exists(sidenotes_path))

    sidenote_pages = timings.measure("collectSidenotePages", lambda: collect_sidenote_pages(letter_text))
    meta_output = {
        **meta,
        "letter": letter,
        "slug": slug,
        "hasText": True,
        "hasTraditions": has_traditions,
        "hasSidenotes": len(sidenote_pages) > 0,
        "pageCount": len(page_xml_map),
        "pages": sorted(page_xml_map.keys(), key=lambda page: int(page)),
        "traditionsHtml": traditions_html,
    }
    timings.measure(
        "writeFile:metaJson",
        lambda: write_json(letter_dir / "meta.json", meta_output),
    )

    meta_output_without_html = dict(meta_output)
    meta_output_without_html.pop("traditionsHtml", None)
    return meta_output_without_html
