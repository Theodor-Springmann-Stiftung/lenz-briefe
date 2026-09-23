import sys
from pathlib import Path
import unittest
from lxml import etree

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from compare_traditions import clean_metadata, build_inputs, ROOT, NS


class ComparisonInputTests(unittest.TestCase):
    def test_removes_decisions_without_mutating_source(self):
        source = etree.fromstring('<letterDesc xmlns="https://lenz-archiv.de" letter="39"><sent><date when="1774-01-01"/></sent><!--editorial decision--><traditions><tradition isOriginal="false" type="print"/><tradition isOriginal="false" type="manuscript"/></traditions><hasOriginal value="false"/><isDraft value="true"/></letterDesc>')
        before = etree.tostring(source)
        clean = etree.fromstring(clean_metadata(source).encode())
        self.assertFalse(clean.xpath('./l:traditions | ./l:hasOriginal | .//comment()', namespaces=NS))
        self.assertEqual(clean.find('l:sent/l:date', NS).get('when'), '1774-01-01')
        self.assertEqual(etree.tostring(source), before)

    def test_full_input_excludes_classifications(self):
        states = build_inputs(ROOT, ['39', '326'])
        for state in states.values():
            self.assertNotIn('<traditions', state['metadata_xml'])
            self.assertNotIn('isOriginal', state['metadata_xml'])
            self.assertIn('<letterText', state['letter_text_xml'])
            self.assertIn('<letterTradition', state['apparatus_xml'])
            self.assertEqual(set(state), {'letter', 'metadata_xml', 'letter_text_xml', 'apparatus_xml', 'apparatus'})
