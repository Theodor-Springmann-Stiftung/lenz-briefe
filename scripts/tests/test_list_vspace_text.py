import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('list_vspace_text', Path(__file__).resolve().parents[1] / 'list_vspace_text.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VspaceTextTests(unittest.TestCase):
    def scan(self, content):
        return module.find_text_after_vspace(('<opus xmlns="https://lenz-archiv.de"><document><letterText letter="7">' + content + '</letterText></document></opus>').encode())

    def test_nested_text_and_comments(self):
        self.assertEqual(self.scan('<vspace lines="2"/>\n<!-- ignore --> <align pos="right">A &amp; B</align>'), [(1, '7', 'A & B')])

    def test_markers_and_trailing_space(self):
        for content in ['<vspace lines="1"/><line/>Text', '<vspace lines="1"/><page index="2"/>Text', '<vspace lines="1"/>\n']:
            self.assertEqual(self.scan(content), [])

    def test_multiple_spaces_and_record_boundaries(self):
        self.assertEqual(len(self.scan('<vspace lines="1"/><vspace lines="2"/>Text')), 2)
        xml = b'<opus><letterTradition letter="1"><vspace lines="1"/></letterTradition><letterTradition letter="2">Text</letterTradition></opus>'
        self.assertEqual(module.find_text_after_vspace(xml), [])


if __name__ == '__main__':
    unittest.main()
