import unittest
from lxml import html
from transform_python.common import Timings
from transform_python.exporter import StylesheetRunner
from transform_python.search import index_fragment


class SearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = StylesheetRunner.create()

    def render(self, body, sidenote=False):
        tag = 'sidenote' if sidenote else 'letterText'
        source = f'<{tag} xmlns="https://lenz-archiv.de" page="1" pos="left">{body}</{tag}>'
        fragment = self.runner.run_stylesheet('sidenotes' if sidenote else 'letter-text', source,
                                             {'sidenoteId': 'note-1'} if sidenote else {}, Timings())
        rendered, records = index_fragment(fragment, '1', 'sidenote' if sidenote else 'text',
                                           'note-1' if sidenote else 'text', whole_block=sidenote)
        tree = html.fragment_fromstring(rendered, create_parent='div')
        for record in records:
            self.assertEqual(len(tree.xpath('.//*[@id=$anchor]', anchor=record['anchor'])), 1)
        return records

    def test_pages_and_inline_formatting_are_transparent_but_lines_and_space_are_boundaries(self):
        records = self.render('<page index="1"/><line/>Mein <ul>lieber</ul> Fre<page index="2"/>und'
                              '<line/>Neue Zeile<vspace lines="1"/>Weiter')
        self.assertEqual([r['text'] for r in records], ['Mein lieber Freund', 'Neue Zeile', 'Weiter'])
        self.assertEqual(records[0]['pages'], [[0, '1'], [15, '2']])
        self.assertEqual(records[1]['pages'], [[0, '2']])

    def test_page_offsets_follow_collapsed_whitespace_and_browser_unicode_offsets(self):
        records = self.render('<page index="1"/><line/>😀 Grüße, \n <page index="2"/>Freund')
        self.assertEqual(records[0]['text'], '😀 Grüße, Freund')
        self.assertEqual(records[0]['pages'], [[0, '1'], [9, '2']])

    def test_table_cells_never_merge_with_neighbors_or_surrounding_text(self):
        records = self.render('<line/>Vorher<tabs><line/><tab value="1-2">A</tab>'
                              '<tab value="2-2">B</tab><line/><tab value="1-2">C</tab>'
                              '</tabs>Nachher')
        self.assertEqual([r['text'] for r in records], ['Vorher', 'A', 'B', 'C', 'Nachher'])

    def test_nested_tables_keep_cell_boundaries(self):
        records = self.render('<tabs><tab value="1-2">A<tabs><tab value="1-2">B</tab>'
                              '<tab value="2-2">C</tab></tabs>D</tab></tabs>')
        self.assertEqual([r['text'] for r in records], ['A', 'B', 'C', 'D'])

    def test_sidenote_is_one_block_even_with_multiple_lines_and_vertical_space(self):
        records = self.render('Mein<line/>lieber<vspace lines="1"/>Freund', sidenote=True)
        self.assertEqual([r['text'] for r in records], ['Mein lieber Freund'])
        self.assertEqual(records[0]['pages'], [[0, '1']])

    def test_table_cells_remain_boundaries_even_inside_sidenotes(self):
        records = self.render('Vorher<tabs><tab value="1-2">A</tab><tab value="2-2">B</tab>'
                              '</tabs>Nachher', sidenote=True)
        self.assertEqual([r['text'] for r in records], ['Vorher', 'A', 'B', 'Nachher'])

    def test_editorial_notes_and_deleted_wording_survive_but_xml_comments_do_not(self):
        records = self.render('<line/>Ein <subst><del>altes</del><insertion>neues</insertion></subst>'
                              ' Wort <note>editorial</note><!-- excluded -->')
        self.assertEqual([r['text'] for r in records], ['Ein altesneues Wort editorial'])
