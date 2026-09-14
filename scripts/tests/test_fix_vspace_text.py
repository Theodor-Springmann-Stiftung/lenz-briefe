from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fix_vspace_text import fix


class FixVspaceTests(unittest.TestCase):
    def test_line_before_alignment(self):
        source = b'<r>\n<vspace lines="2"/>\n<align pos="right"><aq>Text</aq></align>\n</r>'
        expected = b'<r>\n<vspace lines="1"/>\n<line /><align pos="right"><aq>Text</aq></align>\n</r>'
        self.assertEqual(fix(source), (expected, 1))
        self.assertEqual(fix(expected), (expected, 0))

    def test_minimum_and_formatting(self):
        output, count = fix(b'<r><vspace lines="1"/>  Text</r>')
        self.assertEqual(output, b'<r>\n<vspace lines="1"/>\n<line />Text</r>')
        self.assertEqual(count, 1)

    def test_existing_marker_and_comments(self):
        output, count = fix(b'<r><!-- <vspace lines="8"/> --><vspace lines="3"/><line/>Text</r>')
        self.assertIn(b'<!-- <vspace lines="8"/> -->', output)
        self.assertIn(b'\n<vspace lines="3"/>\n<line/>', output)
        self.assertEqual(count, 0)

    def test_wrappers_before_vspace_are_not_crossed(self):
        output, count = fix(b'<r><aq>A<vspace lines="3"/>B</aq></r>')
        self.assertIn(b'A\n<vspace lines="2"/>\n<line />B', output)
        self.assertEqual(count, 1)


if __name__ == '__main__':
    unittest.main()
