#!/usr/bin/env python3

import sys
from lxml import etree

def transform_sort_to_date(input_file, output_file):
    """
    Transform an XML file:
     - Move <date>'s "value" attr as text to <sort>
     - Remove that <date> element
     - Rename <sort> to <date> and rename its @value to @when
     - Preserve comments
    """
    # Use a parser that keeps comments
    parser = etree.XMLParser(remove_comments=False)
    tree = etree.parse(input_file, parser)
    root = tree.getroot()

    # If your XML has namespaces, you'll need namespace-aware searches.
    # This example assumes no default namespace is used for 'descriptions' or 'letterDesc'.
    descriptions = root.find("descriptions")
    if descriptions is not None:
        for letter_desc in descriptions.findall("letterDesc"):
            sent = letter_desc.find("sent")
            if sent is not None:
                # Locate <date> and <sort> inside <sent>
                old_date_el = sent.find("date")
                sort_el = sent.find("sort")

                # 1) Move the old <date> @value into <sort>.text and remove <date>
                if old_date_el is not None and sort_el is not None:
                    date_value = old_date_el.get("value")
                    if date_value:
                        sort_el.text = date_value
                    sent.remove(old_date_el)

                # 2) Rename <sort> to <date>, and rename @value to @when
                if sort_el is not None:
                    sort_el.tag = "date"  # rename element
                    old_value = sort_el.attrib.pop("value", None)
                    if old_value is not None:
                        sort_el.set("when", old_value)

    # Write the modified tree, preserving comments
    tree.write(output_file, encoding="UTF-8", xml_declaration=True, pretty_print=True)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: {} INPUT.xml OUTPUT.xml".format(sys.argv[0]))
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    transform_sort_to_date(input_file, output_file)
