import xml.etree.ElementTree as ET

def transform_dates_to_sort_text(input_file, output_file):
    tree = ET.parse(input_file)
    root = tree.getroot()

    # Find all <letterDesc> elements under <descriptions>
    descriptions = root.find("descriptions")
    if descriptions is not None:
        for letter_desc in descriptions.findall("letterDesc"):
            sent = letter_desc.find("sent")
            if sent is not None:
                # Locate the <date> and <sort> elements
                date_el = sent.find("date")
                sort_el = sent.find("sort")

                if date_el is not None and sort_el is not None:
                    # Move the date attribute's value into sort_el's text
                    date_value = date_el.get("value")
                    if date_value:
                        sort_el.text = date_value

                    # Remove the <date> element from <sent>
                    sent.remove(date_el)

    # Write the modified tree to a new file
    tree.write(output_file, encoding="UTF-8", xml_declaration=True)

if __name__ == "__main__":
    # Usage example:
    # transform_dates_to_sort_text("input.xml", "output.xml")
    transform_dates_to_sort_text("../data/xml/meta.xml", "output.xml")
