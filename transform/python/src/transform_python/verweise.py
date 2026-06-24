from lxml import etree

NAMESPACE_MAP = {"lenz": "https://lenz-archiv.de"}


def _get_letter_desc_ids(meta_root: etree._Element) -> set[str]:
    return {
        str(desc.get("letter"))
        for desc in meta_root.xpath("//lenz:letterDesc", namespaces=NAMESPACE_MAP)
        if desc.get("letter")
    }


def _get_person_def_ids(ref_root: etree._Element) -> set[str]:
    return {
        str(elem.get("index"))
        for elem in ref_root.xpath("//lenz:personDef", namespaces=NAMESPACE_MAP)
    }


def _get_location_def_ids(ref_root: etree._Element) -> set[str]:
    return {
        str(elem.get("index"))
        for elem in ref_root.xpath("//lenz:locationDef", namespaces=NAMESPACE_MAP)
    }


def _get_app_def_ids(ref_root: etree._Element) -> set[str]:
    return {
        str(elem.get("index"))
        for elem in ref_root.xpath("//lenz:appDef", namespaces=NAMESPACE_MAP)
    }


def _check_doc_references(root: etree._Element, reference_data: dict[str, set[str]], file_name: str) -> list[dict]:
    errors: list[dict] = []

    def add_error(element: etree._Element, ref_type: str, ref_id: str) -> None:
        errors.append(
            {
                "kind": "verweise",
                "stage": "lintVerweise",
                "message": f"Invalid reference ({ref_type}:{ref_id})",
                "line": element.sourceline,
                "file": file_name,
            }
        )

    for letter_text in root.xpath("//letterText"):
        letter_id = str(letter_text.get("letter"))
        if letter_id not in reference_data["letterDesc"]:
            add_error(letter_text, "letterText", letter_id)

    for letter_tradition in root.xpath("//letterTradition"):
        letter_id = str(letter_tradition.get("letter"))
        if letter_id not in reference_data["letterDesc"]:
            add_error(letter_tradition, "letterTradition", letter_id)

    for location_elem in root.xpath("//lenz:location", namespaces=NAMESPACE_MAP):
        ref = str(location_elem.get("ref"))
        if ref not in reference_data["locationDef"]:
            add_error(location_elem, "location", ref)

    for person_elem in root.xpath("//lenz:person", namespaces=NAMESPACE_MAP):
        ref = str(person_elem.get("ref"))
        if ref not in reference_data["personDef"]:
            add_error(person_elem, "person", ref)

    for hand_elem in root.xpath("//hand", namespaces=NAMESPACE_MAP):
        ref = str(hand_elem.get("ref"))
        if ref not in reference_data["personDef"]:
            add_error(hand_elem, "person", ref)

    for app_elem in root.xpath("//app"):
        ref = str(app_elem.get("ref"))
        if ref not in reference_data["appDef"]:
            add_error(app_elem, "app", ref)

    return errors


def check_verweise(
    briefe_doc: etree._ElementTree,
    meta_doc: etree._ElementTree,
    traditions_doc: etree._ElementTree,
    references_doc: etree._ElementTree,
) -> list[dict]:
    meta_root = meta_doc.getroot()
    ref_root = references_doc.getroot()

    reference_data = {
        "letterDesc": _get_letter_desc_ids(meta_root),
        "personDef": _get_person_def_ids(ref_root),
        "locationDef": _get_location_def_ids(ref_root),
        "appDef": _get_app_def_ids(ref_root),
    }

    errors: list[dict] = []

    for doc, file_name in [
        (briefe_doc, "briefe.xml"),
        (meta_doc, "meta.xml"),
        (traditions_doc, "traditions.xml"),
    ]:
        errors += _check_doc_references(doc.getroot(), reference_data, file_name)

    return errors
