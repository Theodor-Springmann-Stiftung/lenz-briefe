"""Source-derived smoke checks; no snapshots of the editor's content or counts."""
from collections import Counter
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from lxml import html, etree

from transform_python.common import NSMAP, read_xml
from transform_python.exporter import run_export, StylesheetRunner
from test_flow_contract import assert_source_fragments


class CorpusExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.output = Path(cls.temp.name) / 'generated'
        cls.result = run_export(str(cls.output))
        cls.catalog = json.loads((cls.output / 'catalog.json').read_text())
        cls.source = read_xml('briefe.xml')

    def test_cmif_covers_source_metadata_and_preserves_all_machine_dates(self):
        from test_cmif import NS as CMIF_NS
        source = read_xml('meta.xml')
        result = etree.parse(str(self.output / 'CMIF.xml'))
        schema = etree.RelaxNG(etree.parse(str(Path(__file__).parent / 'fixtures/cmif/cmi-customization.rng')))
        self.assertTrue(schema.validate(result), str(schema.error_log))
        letters = source.findall('.//l:letterDesc', NSMAP)
        descriptions = result.findall('.//t:correspDesc', CMIF_NS)
        self.assertEqual([n.get('letter') for n in letters], [n.get('key') for n in descriptions])
        self.assertEqual(len({n.get('ref') for n in descriptions}), len(descriptions))
        for letter, description in zip(letters, descriptions):
            for kind in ('sent', 'received'):
                original = letter.find(f'l:{kind}', NSMAP)
                action = description.find(f't:correspAction[@type="{kind}"]', CMIF_NS)
                self.assertIsNotNone(action)
                if original is None:
                    continue
                self.assertEqual(len(original.findall('l:person', NSMAP)) or 1, len(action.findall('t:persName', CMIF_NS)))
                self.assertEqual(len(original.findall('l:location', NSMAP)), len(action.findall('t:placeName', CMIF_NS)))
                attrs = {'when', 'from', 'to', 'notBefore', 'notAfter'}
                expected = [{k: v for k, v in n.attrib.items() if k in attrs} for n in original.findall('l:date', NSMAP) if attrs.intersection(n.attrib)]
                actual = [{k: v for k, v in n.attrib.items() if k in attrs} for n in action.findall('t:date', CMIF_NS)]
                self.assertEqual(expected, actual)
        self.assertFalse((self.output / 'gnd.json').exists(), 'CMIF is generated before any enrichment')

    def test_catalog_matches_current_source_and_has_consistent_groups(self):
        letters = self.catalog['letters']
        source_ids = [node.get('letter') for node in self.source.findall('.//l:letterText', NSMAP)]
        self.assertCountEqual([letter['letter'] for letter in letters], source_ids)
        order = lambda letter: (letter['sort'] is None, (letter['sort'] or {}).get('key', []), int(letter['letter']))
        self.assertEqual(letters, sorted(letters, key=order))
        counts = Counter(letter['groupId'] for letter in letters)
        self.assertEqual(sum(group['count'] for group in self.catalog['groups']), len(source_ids))
        for group in self.catalog['groups']:
            self.assertEqual(group['count'], counts[group['id']])
        for letter in letters:
            with self.subTest(letter=letter['letter']):
                self.assertEqual(set(letter['personIds']), {
                    person['ref'] for event in letter['events'] for person in event['persons']
                })
                self.assertEqual(set(letter['placeIds']), {
                    place['ref'] for event in letter['events'] for place in event['locations']
                })

    def test_sidenotes_match_current_source_and_report_unresolved_pages(self):
        expected_warnings = []
        for letter in self.source.findall('.//l:letterText', NSMAP):
            identifier = letter.get('letter')
            grouped = json.loads((self.output / 'letters' / identifier / 'sidenotes.json').read_text())
            notes = sorted((note for group in grouped.values() for note in group), key=lambda note: note['sourceOrder'])
            source_notes = letter.findall('.//l:sidenote', NSMAP)
            pages = set(letter.xpath('.//l:page[not(ancestor::l:sidenote)]/@index', namespaces=NSMAP))
            self.assertEqual(len(notes), len(source_notes), identifier)
            for index, (note, source) in enumerate(zip(notes, source_notes), 1):
                with self.subTest(letter=identifier, sourceOrder=index):
                    page = source.get('page')
                    self.assertEqual(note['sourceOrder'], index)
                    self.assertEqual(note['page'], page)
                    self.assertEqual(note['pos'], source.get('pos'))
                    self.assertEqual(note['type'], source.get('type'))
                    self.assertEqual(note['anchorId'], f'page-{page}' if page in pages else None)
                    if page not in pages:
                        expected_warnings.append((identifier, page))
                    tree = html.fragment_fromstring(note['html'], create_parent='div')
                    hands = tree.xpath('.//*[contains(concat(" ", normalize-space(@class), " "), " hand ")]')
                    self.assertFalse([hand for hand in hands if any(ancestor in hands for ancestor in hand.iterancestors())])
        warnings = [(warning['letter'], warning['page']) for warning in self.result['warnings']
                    if warning['kind'] == 'unresolved-sidenote']
        self.assertCountEqual(warnings, expected_warnings)

    def test_search_destinations_exist_without_requiring_content_on_every_letter(self):
        index = json.loads((self.output / 'search.json').read_text())
        self.assertEqual(index['version'], 1)
        source_ids = {node.get('letter') for node in self.source.findall('.//l:letterText', NSMAP)}
        self.assertLessEqual({record['letter'] for record in index['blocks']}, source_ids)
        self.assertLessEqual({record['kind'] for record in index['blocks']}, {'text', 'sidenote', 'tradition'})
        for identifier in source_ids:
            directory = self.output / 'letters' / identifier
            fragments = [(directory / 'text.html').read_text()]
            notes = [note for group in json.loads((directory / 'sidenotes.json').read_text()).values() for note in group]
            fragments += [note['html'] for note in notes]
            fragments += [record['html'] for record in json.loads((directory / 'traditions.json').read_text())]
            tree = html.fragment_fromstring(''.join(fragments), create_parent='div')
            ids = tree.xpath('.//@id')
            records = [record for record in index['blocks'] if record['letter'] == identifier]
            self.assertEqual(len(ids), len(set(ids)), identifier)
            for record in records:
                self.assertIn(record['anchor'], ids)
                self.assertTrue(record['text'].strip())
            for note in notes:
                note_tree = html.fragment_fromstring(note['html'], create_parent='div')
                if note_tree.text_content().strip():
                    note_ids = set(note_tree.xpath('.//@id'))
                    self.assertTrue(any(record['kind'] == 'sidenote' and record['anchor'] in note_ids
                                        for record in records), (identifier, note['id']))

    def test_current_fragments_preserve_source_text_and_milestones(self):
        assert_source_fragments(self, StylesheetRunner.create(), read_xml)
