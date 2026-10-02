import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from classify_outer_pages import pages, apply, decision, request_state, original_letters, remove_nonoriginal_outer


class OuterPagesTests(unittest.TestCase):
    def test_cross_page_markup_and_letter_boundary(self):
        source = '<opus><letterText letter="1"><page index="1"/><aq>first<page index="2"/>second</aq></letterText><letterText letter="2"><page index="1"/>third</letterText></opus>'
        found = pages(source)
        self.assertEqual([p['page_xml'] for p in found], ['<page index="1"/><aq>first', '<page index="2"/>second</aq>', '<page index="1"/>third'])
        changed = apply(source, found, {'1:1': 'inner', '1:2': 'outer', '2:1': 'uncertain'})
        self.assertEqual(changed, source.replace('<page index="2"/>', '<page index="2" type="outer"/>'))

    def test_remove_wrong_outer_and_preserve_uncertain(self):
        source = '<letterText letter="4"><page index="1" type="outer" /><page index="2" type="outer" /></letterText>'
        self.assertEqual(apply(source, pages(source), {'4:1': 'inner', '4:2': 'uncertain'}), source.replace(' type="outer"', '', 1))

    def test_original_metadata_gate(self):
        from lxml import etree
        metadata = etree.fromstring(b'<opus xmlns="https://lenz-archiv.de"><letterDesc letter="1"><traditions><tradition isOriginal="false"/><tradition isOriginal="true"/></traditions></letterDesc><letterDesc letter="2"><traditions><tradition isOriginal="0"/></traditions></letterDesc><letterDesc letter="3"><traditions><tradition isOriginal="1"/></traditions></letterDesc></opus>')
        originals = original_letters(metadata)
        self.assertEqual(originals, {'1', '3'})
        source = '<letterText letter="1"><page index="1" type="outer"/></letterText><letterText letter="2"><page index="1" type="outer"/></letterText>'
        self.assertEqual(remove_nonoriginal_outer(source, originals), '<letterText letter="1"><page index="1" type="outer"/></letterText><letterText letter="2"><page index="1"/></letterText>')

    def test_request_strips_page_type_only(self):
        source = '<letterText letter="1"><page index="1" type="outer"/><note type="example">Text</note></letterText>'
        page = pages(source)[0]
        self.assertEqual(request_state(page)['page_xml'], '<page index="1"/><note type="example">Text</note>')
        self.assertIn('type="outer"', page['page_xml'])

    def test_reject_uncovered_page(self):
        with self.assertRaises(ValueError):
            pages('<page index="1"/>')

    def test_confidence_and_malformed_response(self):
        response = {'answers': {'outer': {'type': 'choice', 'choice': 'outer', 'confidence': .7, 'probabilities': {'outer': .7, 'inner': .2, 'uncertain': .1}}}}
        self.assertEqual(decision(response, .8), 'uncertain')
        self.assertEqual(decision(response, .6), 'outer')
        response['answers']['outer']['probabilities']['outer'] = float('nan')
        with self.assertRaises(ValueError):
            decision(response, .8)


if __name__ == '__main__':
    unittest.main()
