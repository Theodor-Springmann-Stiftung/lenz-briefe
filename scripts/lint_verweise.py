import os
import sys
from lxml import etree

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
XML_DIR = os.path.join(REPO_ROOT, 'data', 'xml')

# Namespace map for your "lenz" default namespace
NAMESPACE_MAP = {"lenz": "https://lenz-archiv.de"}

def parse_xml_file(filepath):
    """
    Parse an XML file using lxml and return the root element, or None on parse error.
    """
    try:
        parser = etree.XMLParser(remove_blank_text=True)
        tree = etree.parse(filepath, parser)
        return tree.getroot()
    except etree.ParseError as e:
        print(f"Error parsing {filepath}: {e}")
        return None

def get_letter_desc_ids(meta_root):
    """
    Retrieve all 'letter' attribute values from <letterDesc letter="..."> 
    in the meta.xml file, which uses the default namespace https://lenz-archiv.de.
    Returns a set of string IDs.
    """
    letter_ids = set()
    # Find all <letterDesc> in the lenz namespace
    letter_descs = meta_root.xpath("//lenz:letterDesc", namespaces=NAMESPACE_MAP)
    for desc in letter_descs:
        val = desc.get("letter")
        if val:
            letter_ids.add(val)
    return letter_ids

def get_person_def_ids(ref_root):
    """
    Retrieve all 'index' attributes from <personDef index="..."> in references.xml.
    If references.xml is un-namespaced, we can use a non-namespace XPath: //personDef
    Adjust if references.xml also has a namespace.
    """
    return set(elem.get("index") for elem in ref_root.xpath("//lenz:personDef", namespaces=NAMESPACE_MAP))

def get_location_def_ids(ref_root):
    """
    Retrieve all 'index' attributes from <locationDef index="..."> in references.xml.
    """
    return set(elem.get("index") for elem in ref_root.xpath("//lenz:locationDef", namespaces=NAMESPACE_MAP))

def get_app_def_ids(ref_root):
    """
    Retrieve all 'index' attributes from <appDef index="..."> in references.xml.
    """
    return set(elem.get("index") for elem in ref_root.xpath("//lenz:appDef", namespaces=NAMESPACE_MAP))

def check_references(root, reference_data, filepath):
    """
    Check various references across briefe.xml, meta.xml, and traditions.xml
    against known IDs from meta.xml (letterDesc) and references.xml (personDef, locationDef, appDef).
    """
    errors = []
    relative_path = os.path.relpath(filepath, REPO_ROOT)

    def add_error(element, ref_type, ref_id):
        line_number = element.sourceline
        msg = f"Invalid reference ({ref_type}:{ref_id})"
        errors.append({
            "file": relative_path,
            "line": line_number,
            "message": msg
        })

    # 1) Check <letterText letter="..."> references to meta.xml's letterDesc
    #    (Assumes <letterText> is un-namespaced, in briefe.xml or wherever.)
    for letter_text in root.xpath("//letterText"):
        letter_id = letter_text.get("letter")
        if letter_id not in reference_data["letterDesc"]:
            add_error(letter_text, "letterText", letter_id)

    # 2) Check <letterTradition letter="..."> references to meta.xml's letterDesc
    for letter_tradition in root.xpath("//letterTradition"):
        letter_id = letter_tradition.get("letter")
        if letter_id not in reference_data["letterDesc"]:
            add_error(letter_tradition, "letterTradition", letter_id)

    # 3) Check <location ref="..."> in the lenz namespace, referencing locationDef
    #    e.g. <location ref="3" />
    for location_elem in root.xpath("//lenz:location", namespaces=NAMESPACE_MAP):
        ref = location_elem.get("ref")
        if ref not in reference_data["locationDef"]:
            add_error(location_elem, "location", ref)

    # 4) Check <person ref="..."> in the lenz namespace, referencing personDef
    #    e.g. <person ref="1" />
    for person_elem in root.xpath("//lenz:person", namespaces=NAMESPACE_MAP):
        ref = person_elem.get("ref")
        if ref not in reference_data["personDef"]:
            add_error(person_elem, "person", ref)

    # 5) Check <person ref="..."> in the lenz namespace, referencing personDef
    #    e.g. <person ref="1" />
    for person_elem in root.xpath("//hand", namespaces=NAMESPACE_MAP):
        ref = person_elem.get("ref")
        if ref not in reference_data["personDef"]:
            add_error(person_elem, "person", ref)

    # 6) Check <app ref="..."> (un-namespaced?), referencing appDef
    for app_elem in root.xpath("//app"):
        ref = app_elem.get("ref")
        if ref not in reference_data["appDef"]:
            add_error(app_elem, "app", ref)

    return errors

def main():
    # Parse meta.xml (has letterDesc in default "lenz" namespace)
    meta_root = parse_xml_file(os.path.join(XML_DIR, "meta.xml"))
    if meta_root is None:
        print("Could not parse meta.xml; aborting.")
        sys.exit(1)

    # Parse references.xml for personDef, locationDef, appDef
    ref_root = parse_xml_file(os.path.join(XML_DIR, "references.xml"))
    if ref_root is None:
        print("Could not parse references.xml; aborting.")
        sys.exit(1)

    # Build our cross-file reference data
    reference_data = {
        "letterDesc": get_letter_desc_ids(meta_root),
        "personDef": get_person_def_ids(ref_root),
        "locationDef": get_location_def_ids(ref_root),
        "appDef": get_app_def_ids(ref_root),
    }

    all_errors = []

    # Check references in the following files
    files_to_check = ["briefe.xml", "meta.xml", "traditions.xml"]
    for filename in files_to_check:
        filepath = os.path.join(XML_DIR, filename)
        root = parse_xml_file(filepath)
        if root is not None:
            errors = check_references(root, reference_data, filepath)
            all_errors.extend(errors)

    # Report any errors
    if all_errors:
        print("The linter found the following errors:")
        for error in all_errors:
            print(f"{error['file']}, Line {error['line']}: {error['message']}")

        # Print GitHub Actions compatible error lines
        for error in all_errors:
            print(f"::error file={error['file']},line={error['line']}::{error['message']}")
        
        sys.exit(1)
    else:
        print("No errors found.")

if __name__ == "__main__":
    main()
