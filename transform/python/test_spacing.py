import unittest
from lxml import html
from transform_python.common import Timings
from transform_python.exporter import StylesheetRunner


class SpacingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = StylesheetRunner.create()

    def render(self, text, sidenote=False):
        tag = 'sidenote' if sidenote else 'letterText'
        source = f'<{tag} xmlns="https://lenz-archiv.de" letter="1" page="1" pos="left">{text}</{tag}>'
        result = self.runner.run_stylesheet('sidenotes' if sidenote else 'letter-text', source, {'letter': '1'}, Timings())
        return html.fragment_fromstring(result, create_parent='div')

    def blocks(self, tree):
        return tree.xpath('.//div[contains(concat(" ", @class, " "), " lb-line-block ")]')

    def test_implicit_first_line_and_explicit_breaks(self):
        for sidenote in [False, True]:
            a = self.render('First<line/>Second<line type="break"/>Third', sidenote)
            self.assertEqual([n.text_content().strip() for n in self.blocks(a)], ['First', 'Second', 'Third'])
            self.assertEqual(len(self.blocks(self.render('First', sidenote))), 1)

    def test_consecutive_and_trailing_breaks_survive(self):
        tree = self.render('A<line/><line/>B<line/>')
        self.assertEqual([n.text_content().strip() for n in self.blocks(tree)], ['A', '', 'B', ''])

    def test_vspace_does_not_add_an_extra_line(self):
        for sidenote in [False, True]:
            tree = self.render('A<vspace lines="3"/><line/>B', sidenote)
            self.assertEqual([n.text_content().strip() for n in self.blocks(tree)], ['A', 'B'])
            self.assertEqual(tree.xpath('.//*[@class="lb-vspace"]/@style'), ['height: 3lh'])

    def test_page_marker_retained_before_vspace(self):
        tree = self.render('<page index="1"/><vspace lines="2"/><line/>A')
        self.assertEqual(tree.xpath('.//*[@id="page-1"]/@id'), ['page-1'])
        self.assertEqual(len(self.blocks(tree)), 1)

    def test_wrapped_text_and_table_spacing(self):
        tree = self.render('<aq>A<vspace lines="2"/><line/>B</aq><tabs><tab value="1-2">C</tab><vspace lines="1"/><line/><tab value="1-2">D</tab></tabs>')
        self.assertEqual(tree.xpath('.//*[@class="lb-vspace"]/@data-lines'), ['2', '1'])
        self.assertFalse(tree.xpath('.//span/div[@class="lb-vspace"]'))

    def test_aligned_table_keeps_spacing_and_empty_rows(self):
        tree = self.render('<tabs><tab value="1-2"><align pos="center">Heading</align></tab><line/><line/><tab value="1-2">A</tab><vspace lines="2"/><line/><tab value="1-2">B</tab></tabs>')
        self.assertEqual(tree.xpath('.//*[@class="lb-vspace"]/@data-lines'), ['2'])
        self.assertEqual(len(tree.xpath('.//*[@class="lb-tab-row"]')), 4)


if __name__ == '__main__':
    unittest.main()
