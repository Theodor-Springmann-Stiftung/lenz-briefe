import os
import json
from lxml import etree

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
XML_DIR = os.path.join(REPO_ROOT, 'data', 'xml')

def parse_xml_file(filepath):
    try:
        parser = etree.XMLParser(remove_blank_text=True)
        tree = etree.parse(filepath, parser)
        return tree.getroot()
    except etree.ParseError as e:
        print(f"Error parsing {filepath}: {e}")
        return None

def get_all_ids(root, tag):
    return set(elem.get('letter') for elem in root.xpath(f'.//{tag}'))

def get_all_refs(root, tag, attr):
    return set(elem.get(attr) for elem in root.xpath(f'.//{tag}'))

def check_references(root, reference_data, filepath):
    errors = []
    relative_path = os.path.relpath(filepath, REPO_ROOT)

    def add_error(element, ref_type, ref_id):
        line_number = element.sourceline
        error_message = f"Invalid reference ({ref_type}:{ref_id})"
        errors.append({
            "file": relative_path,
            "line": line_number,
            "message": error_message
        })

    # Check letterText in briefe to letterDesc in meta
    for letter_text in root.xpath('//letterText'):
        letter_id = letter_text.get('letter')
        if letter_id not in reference_data['letterDesc']:
            add_error(letter_text, 'letterText', letter_id)

    # Check letterTradition in traditions to letterDesc in meta
    for letter_tradition in root.xpath('//letterTradition'):
        letter_id = letter_tradition.get('letter')
        if letter_id not in reference_data['letterDesc']:
            add_error(letter_tradition, 'letterTradition', letter_id)

    # Check hand in briefe with personDef in references
    for hand in root.xpath('//hand'):
        ref = hand.get('ref')
        if ref not in reference_data['personDef']:
            add_error(hand, 'hand', ref)

    # Check sender and receiver in meta with personDef in references
    for person in root.xpath('//sender | //receiver'):
        ref = person.get('ref')
        if ref not in reference_data['personDef']:
            add_error(person, 'sender/receiver', ref)

    # Check location in meta with locationDef in references
    for location in root.xpath('//location'):
        ref = location.get('ref')
        if ref not in reference_data['locationDef']:
            add_error(location, 'location', ref)

    # Check app in traditions with appDef in references
    for app in root.xpath('//app'):
        ref = app.get('ref')
        if ref not in reference_data['appDef']:
            add_error(app, 'app', ref)

    return errors

def main():
    reference_data = {
        'letterDesc': get_all_ids(parse_xml_file(os.path.join(XML_DIR, 'meta.xml')), 'letterDesc'),
        'personDef': get_all_refs(parse_xml_file(os.path.join(XML_DIR, 'references.xml')), 'personDef', 'index'),
        'locationDef': get_all_refs(parse_xml_file(os.path.join(XML_DIR, 'references.xml')), 'locationDef', 'index'),
        'appDef': get_all_refs(parse_xml_file(os.path.join(XML_DIR, 'references.xml')), 'appDef', 'index'),
    }

    all_errors = []

    files_to_check = ['briefe.xml', 'meta.xml', 'traditions.xml']
    for filename in files_to_check:
        filepath = os.path.join(XML_DIR, filename)
        root = parse_xml_file(filepath)
        if root is not None:
            errors = check_references(root, reference_data, filepath)
            all_errors.extend(errors)

    if all_errors:
        print("The linter found the following errors:")
        for error in all_errors:
            print(f"{error['file']}, Line {error['line']}: {error['message']}")
        
        # GitHub Actions output
        for error in all_errors:
            print(f"::error file={error['file']},line={error['line']}::{error['message']}")
        
        exit(1)  # Exit with error code if errors were found
    else:
        print("No errors found.")

if __name__ == "__main__":
    main()
