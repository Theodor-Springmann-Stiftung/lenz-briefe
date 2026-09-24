import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from lxml import etree, html
from transform_python.catalog import date_sort
from transform_python.common import Timings
from transform_python.exporter import extract_meta, run_export, StylesheetRunner


class SiteExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = TemporaryDirectory()
        cls.output = Path(cls.temp.name) / 'generated'
        cls.result = run_export(str(cls.output))
        cls.catalog = json.loads((cls.output / 'catalog.json').read_text())
        cls.runner = StylesheetRunner.create()

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_all_sidenotes_survive_with_explicit_unresolved_targets(self):
        notes = [n for p in self.output.glob('letters/*/sidenotes.json')
                 for group in json.loads(p.read_text()).values() for n in group]
        self.assertEqual(len(notes), 215)
        self.assertEqual({n['letter'] for n in notes if n['anchorId'] is None}, {'64','167'})
        warnings = [w for w in self.result['warnings'] if w['kind'] == 'unresolved-sidenote']
        self.assertEqual({w['letter'] for w in warnings}, {'64','167'})
        self.assertTrue(all(n['html'].strip() for n in notes))

    def test_catalog_chronology_groups_and_filters(self):
        letters = self.catalog['letters']
        self.assertEqual(len(letters),374)
        self.assertEqual([g['count'] for g in self.catalog['groups']], [7,85,177,53,52])
        self.assertEqual([n['sort']['key'] for n in letters], sorted(n['sort']['key'] for n in letters))
        self.assertEqual(letters[0]['letter'],'1')
        for letter in letters:
            self.assertEqual(set(letter['personIds']), {p['ref'] for e in letter['events'] for p in e['persons']})
            self.assertEqual(set(letter['placeIds']), {p['ref'] for e in letter['events'] for p in e['locations']})

    def test_multiple_events_dates_receiving_dates_and_boolean_one(self):
        source = '''<letterDesc xmlns="https://lenz-archiv.de" letter="999">
        <sent><date when="1776-01-03">First</date><date from="1776-01-02">Second</date><person ref="1"/></sent>
        <received><date when="1776-01-05">Received</date><person ref="2"/></received>
        <sent><date notBefore="1775-12-30">Third</date><person ref="3"/></sent>
        <received><person ref="4"/></received>
        <traditions><tradition isOriginal="1" type="manuscript"/></traditions>
        <isDraft value="1"/><isProofread value="1"/></letterDesc>'''
        result = extract_meta(etree.fromstring(source),{'personMap':{},'locationMap':{}})
        self.assertEqual([e['type'] for e in result['events']],['sent','received','sent','received'])
        self.assertEqual(len(result['events'][0]['dates']),2)
        self.assertEqual(result['events'][1]['dates'][0]['text'],'Received')
        self.assertTrue(result['isDraft'] and result['isProofread'] and result['hasOriginal'])
        self.assertEqual(date_sort(result['events'])['key'],[1775,12,30])

    def test_date_precedence_and_partial_dates(self):
        sort = date_sort([{'type':'sent','dates':[{'when':'1776','from':'1775-01-01'}]}])
        self.assertEqual(sort['key'],[1776,0,0])
        self.assertEqual(sort['attribute'],'when')
        self.assertIsNone(date_sort([{'type':'received','dates':[{'when':'1776'}]}]))

    def test_apparatus_interstitial_text_survives(self):
        for letter in ['185','348']:
            data = json.loads((self.output / f'letters/{letter}/traditions.json').read_text())
            self.assertTrue(any(r['type'] == 'text' and '.' in r['html'] for r in data))

    def test_search_records_all_have_real_unique_destinations(self):
        index = json.loads((self.output / 'search.json').read_text())
        self.assertEqual(index['version'], 1)
        self.assertEqual({r['kind'] for r in index['blocks']}, {'text', 'sidenote', 'tradition'})
        self.assertEqual({r['letter'] for r in index['blocks']}, {str(n) for n in range(1, 375)})
        for letter in self.catalog['letters']:
            directory = self.output / 'letters' / letter['letter']
            fragments = [(directory / 'text.html').read_text()]
            fragments += [n['html'] for group in json.loads((directory / 'sidenotes.json').read_text()).values() for n in group]
            fragments += [r['html'] for r in json.loads((directory / 'traditions.json').read_text())]
            tree = html.fragment_fromstring(''.join(fragments), create_parent='div')
            ids = tree.xpath('.//@id')
            self.assertEqual(len(ids), len(set(ids)))
            for record in (r for r in index['blocks'] if r['letter'] == letter['letter']):
                self.assertIn(record['anchor'], ids)
        # Sidenotes without matching page markers are still searchable.
        self.assertTrue(any(r['kind'] == 'sidenote' and r['letter'] == '64' for r in index['blocks']))

    def test_languages_standalone_notes_and_hand_origins(self):
        source = '''<letterText xmlns="https://lenz-archiv.de" letter="999"><page index="1"/><note>At page marker</note>
        <line/><note>Alone</note><line/>Text <note>Inline</note>
        <line tab="3"/><hand ref="1">A<line/>B</hand><aq>Latin</aq><gr>Greek</gr><hb>Hebrew</hb><ru>Russian</ru><fr>French</fr>
        <insertion pos="top">inserted</insertion><nr extent="4"/></letterText>'''
        result = self.runner.run_stylesheet('letter-text',source,{},Timings())
        tree = html.fragment_fromstring(result, create_parent='div')
        self.assertEqual(len(tree.xpath('.//div[contains(@class,"lb-line-block--note")]')),2)
        self.assertEqual(tree.xpath('.//*[@data-tab="3"]/@style'),['--indent-units: 3'])
        self.assertEqual(tree.xpath('.//@lang'),['la','grc','he','ru','fr'])
        origins = tree.xpath('.//span[@class="hand"]/@data-origin')
        self.assertEqual(len(origins),2)
        self.assertEqual(len(set(origins)),1)
        self.assertTrue(origins[0])
        self.assertEqual(len(tree.xpath('.//span[@class="insertion-arrow"]')),1)
        self.assertEqual(tree.xpath('.//span[@class="nr"]/@style'),['--extent: 4'])
