import os
import sys
from lxml import etree

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
XML_DIR = os.path.join(REPO_ROOT, "data", "xml")

sys.path.insert(0, os.path.join(REPO_ROOT, "transform", "python", "src"))

from transform_python.verweise import check_verweise


def parse_xml_file(filepath):
    try:
        parser = etree.XMLParser(remove_blank_text=True)
        return etree.parse(filepath, parser)
    except etree.ParseError as e:
        print(f"Error parsing {filepath}: {e}")
        return None


def main():
    briefe_doc = parse_xml_file(os.path.join(XML_DIR, "briefe.xml"))
    meta_doc = parse_xml_file(os.path.join(XML_DIR, "meta.xml"))
    traditions_doc = parse_xml_file(os.path.join(XML_DIR, "traditions.xml"))
    references_doc = parse_xml_file(os.path.join(XML_DIR, "references.xml"))

    if briefe_doc is None or meta_doc is None or traditions_doc is None or references_doc is None:
        print("Could not parse one or more XML files; aborting.")
        sys.exit(1)

    errors = check_verweise(briefe_doc, meta_doc, traditions_doc, references_doc)

    if errors:
        print("The linter found the following errors:")
        for error in errors:
            print(f"{error['file']}, Line {error['line']}: {error['message']}")

        for error in errors:
            print(f"::error file=data/xml/{error['file']},line={error['line']}::{error['message']}")

        sys.exit(1)
    else:
        print("No errors found.")


if __name__ == "__main__":
    main()
