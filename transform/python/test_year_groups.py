import unittest
from lxml import etree

from transform_python.catalog import build_catalog, read_year_groups
from transform_python.common import read_xml, validate_xml


class YearGroupTests(unittest.TestCase):
    def test_xml_controls_order_labels_and_inclusive_membership(self):
        source = etree.fromstring('''<opus xmlns="https://lenz-archiv.de"><definitions><yearGroups>
          <yearGroup fromYear="1800" toYear="1800" label="Späte Phase"/>
          <yearGroup fromYear="1700" toYear="1702" label="Frühe Phase"/>
        </yearGroups></definitions></opus>''')
        groups = read_year_groups(source)
        entries = [{'letter': str(i), 'events': [{'type': 'sent', 'dates': [{'when': str(year)}],
                    'persons': [], 'locations': []}]} for i, year in enumerate([1700, 1702, 1703, 1800], 1)]
        entries.append({'letter': '5', 'events': []})
        catalog = build_catalog(entries, {'yearGroups': groups, 'personMap': {}, 'locationMap': {}})
        self.assertEqual([g['label'] for g in catalog['groups']],
                         ['1800 · Späte Phase', '1700–1702 · Frühe Phase', 'Weitere Jahre', 'Ohne Datierung'])
        self.assertEqual([g['count'] for g in catalog['groups']], [1, 2, 1, 1])
        self.assertEqual([l['groupId'] for l in catalog['letters']],
                         ['1700-1702', '1700-1702', 'other', '1800', 'undated'])

    def test_reversed_overlapping_and_missing_groups_are_rejected(self):
        for contents in ['', '<yearGroup fromYear="1776" toYear="1775" label="A"/>',
                         '<yearGroup fromYear="1771" toYear="1776" label="A"/>'
                         '<yearGroup fromYear="1776" toYear="1779" label="B"/>']:
            with self.subTest(contents=contents), self.assertRaises(ValueError):
                read_year_groups(etree.fromstring(f'<yearGroups xmlns="https://lenz-archiv.de">{contents}</yearGroups>'))

    def test_schema_requires_years_and_label(self):
        for attribute, value in [('fromYear', None), ('toYear', 'invalid'), ('label', '')]:
            source = read_xml('references.xml')
            group = source.find('.//{https://lenz-archiv.de}yearGroup')
            if value is None:
                del group.attrib[attribute]
            else:
                group.set(attribute, value)
            with self.subTest(attribute=attribute):
                self.assertTrue(validate_xml(source, 'references.xml'))
