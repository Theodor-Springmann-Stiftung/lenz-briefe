import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('migrate_vspace', ROOT / 'scripts/migrate_vspace.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
migrate = module.migrate


class MigrationTests(unittest.TestCase):
    def test_runs_preserve_surrounding_bytes(self):
        original = b'''<?xml version="1.0" encoding="utf-8"?>\r\n<opus>Vor <aq>x</aq><line type='empty' />\r\n  <line type="empty"></line> nach &amp; mehr</opus>'''
        expected = b'''<?xml version="1.0" encoding="utf-8"?>\r\n<opus>Vor <aq>x</aq><vspace lines="2"/> nach &amp; mehr</opus>'''
        self.assertEqual(migrate(original), (expected, 2, 1))
        self.assertEqual(migrate(expected), (expected, 0, 0))

    def test_markup_and_text_interrupt_runs(self):
        for boundary in [b'Text', b'<!-- Kommentar -->', b'<page index="2"/>', b'<line/>', b'</aq><aq>', b'<?editor check?>']:
            with self.subTest(boundary=boundary):
                source = b'<opus><aq><line type="empty"/>' + boundary + b'<line type="empty"/></aq></opus>'
                output, count, runs = migrate(source)
                self.assertEqual((count, runs), (2, 2))
                self.assertIn(boundary, output)

    def test_namespaces_and_literal_examples(self):
        source = b'''<l:opus xmlns:l="https://lenz-archiv.de" xmlns:x="other"><!-- <line type="empty"/> --><![CDATA[<line type="empty"/>]]><x:line type="empty"/><l:line type="empty"/><l:line type="empty"/></l:opus>'''
        result, count, runs = migrate(source)
        self.assertEqual((count, runs), (2, 1))
        self.assertIn(b'<l:vspace lines="2"/>', result)
        self.assertIn(b'<x:line type="empty"/>', result)
        self.assertIn(b'<![CDATA[<line type="empty"/>]]>', result)

    def test_refuses_lossy_or_malformed_inputs(self):
        for source in [b'<opus><line type="empty" tab="2"/></opus>', b'<opus><line type="empty">text</line></opus>', b'<opus>', b'<!DOCTYPE opus><opus/>']:
            with self.subTest(source=source), self.assertRaises(Exception):
                migrate(source)


class SchemaTests(unittest.TestCase):
    def validate(self, fragment):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'sample.xml'
            path.write_text('<opus xmlns="https://lenz-archiv.de"><document><letterText letter="1"><page index="1"/>' + fragment + '</letterText></document></opus>')
            result = subprocess.run(['xmllint', '--noout', '--schema', str(ROOT / 'data/xsd/briefe.xsd'), str(path)], capture_output=True)
            return result.returncode == 0

    def test_valid_spacing_contexts(self):
        self.assertTrue(self.validate('<vspace lines="3"/><aq><vspace lines="1"/></aq><sidenote page="1" pos="left"><vspace lines="2"/></sidenote><tabs><tab value="1-2">A</tab><vspace lines="1"/><note>N</note><tab value="2-2">B</tab></tabs><line/><line type="line"/>'))

    def test_invalid_spacing(self):
        for fragment in ['<vspace/>', '<vspace lines="0"/>', '<vspace lines="-1"/>', '<vspace lines="1.5"/>', '<vspace lines="2">text</vspace>', '<line type="empty"/>']:
            with self.subTest(fragment=fragment):
                self.assertFalse(self.validate(fragment))


if __name__ == '__main__':
    unittest.main()
