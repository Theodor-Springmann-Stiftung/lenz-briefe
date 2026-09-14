import unittest

from lxml import etree

from transform_python.exporter import resolve_refs


class MetadataAnnotationTests(unittest.TestCase):
    def resolve(self, content, tag="person", mapping=None):
        node = etree.fromstring(
            f'<{tag} xmlns="https://lenz-archiv.de" ref="1" cert="low" '
            f'erschlossen="true">{content}</{tag}>'
        )
        return resolve_refs([node], mapping or {})[0]

    def test_plain_annotations_and_existing_fields(self):
        definition = {"name": "Name", "index": "1"}
        for tag in ("person", "location"):
            for text in ("vmtl.", "wahrscheinlich", "oder", ""):
                with self.subTest(tag=tag, text=text):
                    result = self.resolve(text, tag, {"1": definition})
                    self.assertEqual(result, {
                        "ref": "1", "cert": "low", "erschlossen": "true",
                        "label": "Name", "resolved": definition,
                        "annotationText": text,
                        "annotationParts": [{"type": "text", "text": text}] if text else [],
                    })

    def test_mixed_content_unresolved_reference(self):
        result = self.resolve(
            ' vmtl. <!--not annotation--><![CDATA[oder ]]>'
            '<wwwlink address="https://example.org/?a=1&amp;b=2">A &amp; B'
            '<wwwlink address="https://example.org/inner"> innen</wwwlink>'
            '</wwwlink> danach\n'
        )
        self.assertIsNone(result["label"])
        self.assertIsNone(result["resolved"])
        self.assertEqual(result["annotationText"], "vmtl. oder A & B innen danach")
        self.assertEqual(result["annotationParts"], [
            {"type": "text", "text": " vmtl. oder "},
            {"type": "wwwlink", "address": "https://example.org/?a=1&b=2", "children": [
                {"type": "text", "text": "A & B"},
                {"type": "wwwlink", "address": "https://example.org/inner", "children": [
                    {"type": "text", "text": " innen"},
                ]},
            ]},
            {"type": "text", "text": " danach\n"},
        ])


if __name__ == "__main__":
    unittest.main()
