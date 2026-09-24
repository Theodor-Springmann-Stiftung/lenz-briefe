import importlib.util
from pathlib import Path
import unittest
from lxml import etree
from transform_python.exporter import extract_meta

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('classify', ROOT / 'scripts/classify_traditions.py')
classify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(classify)


class TraditionMetadataTests(unittest.TestCase):
    def letter(self, content):
        return etree.fromstring(f'<letterDesc xmlns="https://lenz-archiv.de" letter="1"><sent/><received/>{content}<isProofread value="false"/><isDraft value="false"/></letterDesc>')

    def test_export_multiple_bases_and_boolean_lexical_forms(self):
        node = self.letter('<traditions><tradition isOriginal="0" type="print"/><tradition isOriginal="1" type="manuscript"/></traditions>')
        result = extract_meta(node, {'personMap': {}, 'locationMap': {}})
        self.assertTrue(result['hasOriginal'])
        self.assertEqual(result['traditions'], [{'isOriginal': False, 'type': 'print'}, {'isOriginal': True, 'type': 'manuscript'}])

    def test_schema_requires_typed_basis_and_rejects_old_flag(self):
        schema = etree.XMLSchema(etree.parse(str(ROOT / 'data/xsd/meta.xsd')))
        for content, valid in [
            ('<traditions><tradition isOriginal="false" type="unknown"/></traditions>', True),
            ('<traditions/>', False),
            ('<traditions><tradition type="print"/></traditions>', False),
            ('<traditions><tradition isOriginal="false" type="book"/></traditions>', False),
            ('<hasOriginal value="true"/>', False),
        ]:
            root = etree.fromstring('<opus xmlns="https://lenz-archiv.de"><descriptions/></opus>')
            root[0].append(self.letter(content))
            self.assertEqual(schema.validate(root), valid, content)

    def test_uncertainty_and_invalid_response(self):
        response = {'answers': {'basis': {'type': 'choice', 'choice': 'print', 'confidence': .8,
                    'probabilities': {'print': .9, 'manuscript': .05, 'unknown': .05}}}}
        self.assertEqual(classify.proposed_type(response, .95), 'unknown')
        self.assertEqual(classify.proposed_type(response, .85), 'print')
        response['answers']['basis']['probabilities'] = {'print': .8, 'manuscript': .1, 'unknown': .1}
        self.assertEqual(classify.proposed_type(response, .8), 'print')
        self.assertEqual(classify.proposed_type(response, .8001), 'unknown')
        response['answers']['basis']['probabilities']['print'] = float('nan')
        with self.assertRaises(ValueError):
            classify.proposed_type(response, .95)

    def test_surgical_application_preserves_other_content(self):
        source = '<!--keep-->\n<letterDesc letter="7"><sent> a  b </sent><traditions>\n<tradition isOriginal="false" type="unknown" />\n</traditions></letterDesc>'
        result = classify.apply_results(source, {'7': 'print'})
        self.assertEqual(result, source.replace('type="unknown"', 'type="print"'))
        self.assertEqual(classify.apply_results(source, {'7': 'unknown'}), source)


if __name__ == '__main__':
    unittest.main()
