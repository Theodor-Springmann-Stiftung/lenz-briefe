import unittest
from lxml import etree
from transform_python.exporter import resolve_refs


class LocationLabelTests(unittest.TestCase):
    def resolve(self, tag, text):
        node = etree.fromstring(
            f'<{tag} xmlns="https://lenz-archiv.de" ref="18" cert="low">{text}</{tag}>'
        )
        return resolve_refs([node], {'18': {'name': 'Kassel'}})[0]

    def test_location_label_preserves_canonical_filter_reference(self):
        place = self.resolve('location', 'Gegend um Kassel')
        self.assertEqual(place['ref'], '18')
        self.assertEqual(place['label'], 'Gegend um Kassel')
        self.assertEqual(place['resolved']['name'], 'Kassel')
        self.assertEqual(place['cert'], 'low')
        self.assertEqual(place['annotationParts'], [])

    def test_legacy_qualifiers_and_person_annotations_remain_annotations(self):
        for tag, text in [('location', 'vmtl.'), ('location', 'wahrscheinlich'),
                          ('location', 'oder'), ('person', 'annotation')]:
            entry = self.resolve(tag, text)
            self.assertEqual(entry['label'], 'Kassel')
            self.assertEqual(entry['annotationText'], text)

    def test_empty_location_uses_canonical_label(self):
        self.assertEqual(self.resolve('location', '')['label'], 'Kassel')
