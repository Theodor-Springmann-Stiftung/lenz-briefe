"""Behavioral regressions for reusable letter, sidenote and apparatus fragments."""
from collections import Counter
import unittest

from lxml import etree, html

from transform_python.common import Timings, read_xml, serialize_node
from transform_python.exporter import StylesheetRunner


PHRASING = {'span', 'strong', 'em', 'mark', 'del', 'sup', 'sub'}
FLOW = {'div', 'aside', 'section', 'address', 'hr', 'h2', 'h3'}


class FlowContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = StylesheetRunner.create()

    def render(self, body, kind='letter-text'):
        tag = {'letter-text': 'letterText', 'sidenotes': 'sidenote', 'traditions': 'letterTradition'}[kind]
        if kind == 'traditions':
            body = f'<app ref="4">{body}</app>'
        source = f'<{tag} xmlns="https://lenz-archiv.de" letter="1" page="1" pos="left">{body}</{tag}>'
        result = self.runner.run_stylesheet(kind, source, {'letter': '1'}, Timings())
        tree = html.fragment_fromstring(result, create_parent='div')
        self.assert_valid_nesting(result)
        return tree

    def assert_valid_nesting(self, fragment):
        # Inspect the serialized tree before an HTML parser can silently repair
        # invalid nesting. These are all tags emitted by the three stylesheets.
        xml_fragment = fragment.replace('<hr class="lb-rule">', '<hr class="lb-rule"/>')
        tree = etree.fromstring(('<root>' + xml_fragment + '</root>').encode())
        allowed = PHRASING | FLOW | {'root'}
        for e in tree.iter():
            self.assertIn(e.tag, allowed)
            if e.tag in PHRASING:
                self.assertFalse([d.tag for d in e.iterdescendants() if d.tag in FLOW], etree.tostring(e))

    def lines(self, tree):
        return tree.xpath('.//div[contains(concat(" ", @class, " "), " lb-line-block ")]')

    def page(self, tree, index='2'):
        pages = tree.xpath('.//span[@class="page-anchor"][@data-index=$index]', index=index)
        self.assertEqual(len(pages), 1)
        return pages[0]

    def test_inline_milestone_does_not_modify_a_word(self):
        tree = self.render('<page index="1"/><line/>Wor<page index="2"/>d')
        self.assertEqual(tree.text_content(), 'Word')
        self.assertEqual(len(self.lines(tree)), 1)
        self.assertEqual(self.page(tree).get('data-break'), 'inline')
        self.assertEqual(self.page(tree).text_content(), '')
        self.assertEqual(self.page(tree, '1').get('data-break'), 'block')
        self.assertFalse(tree.xpath('.//*[@class="lb-page"]'))

    def test_curved_rules_preserve_text_and_page_boundaries(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            for line_type in ['tilde', 'double-tilde']:
                with self.subTest(kind=kind, line_type=line_type):
                    tree = self.render(f'A<line type="{line_type}"/><page index="2"/>B', kind)
                    self.assertEqual(''.join(line.text_content() for line in self.lines(tree)), 'AB')
                    ornaments = tree.xpath('.//span[@role="img"]')
                    self.assertEqual(len(ornaments), 1)
                    self.assertEqual(ornaments[0].get('class'), f'lb-ornament lb-ornament--{line_type}')
                    self.assertTrue(ornaments[0].get('aria-label'))
                    self.assertEqual(self.page(tree).get('data-break'), 'block')
                    self.assertFalse(tree.xpath('.//hr'))

    def test_superscript_and_subscript_preserve_nested_formatting(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            with self.subTest(kind=kind):
                tree = self.render('A<sup><ul>B</ul></sup>C<sub><it>D</it></sub>E', kind)
                self.assertEqual(''.join(line.text_content() for line in self.lines(tree)), 'ABCDE')
                self.assertEqual(tree.xpath('.//sup/span[@class="ul"]/text()'), ['B'])
                self.assertEqual(tree.xpath('.//sub/em/text()'), ['D'])

    def test_anchor_only_raises_explicit_superscript(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            with self.subTest(kind=kind):
                tree = self.render('<anchor>A</anchor><anchor><sup>B</sup></anchor>', kind)
                anchors = tree.xpath('.//span[@class="anchor"]')
                self.assertEqual(anchors[0].text, 'A')
                self.assertEqual(len(anchors[0]), 0)
                self.assertEqual(anchors[1].xpath('./sup/text()'), ['B'])

    def test_semantic_page_boundaries(self):
        for body in [
            'A<page index="2"/><line/>B',
            'A<line/><page index="2"/>B',
            'A<page index="2"/><aq><line/>B</aq>',
            'A<page index="2"/><vspace lines="2"/>B',
            'A<vspace lines="2"/><page index="2"/>B',
            'A<page index="2"/><line type="line"/>B',
        ]:
            with self.subTest(body=body):
                tree = self.render(body)
                self.assertEqual(self.page(tree).get('data-break'), 'block')
                self.assertEqual(tree.text_content(), 'AB')

    def test_milestone_keeps_its_position_relative_to_spacer(self):
        for body, expected in [
            ('A<page index="2"/><vspace lines="2"/>B', ['page-anchor', 'lb-vspace']),
            ('A<vspace lines="2"/><page index="2"/>B', ['lb-vspace', 'page-anchor']),
        ]:
            tree = self.render(body)
            self.assertEqual(tree.xpath('.//*[@class="page-anchor" or @class="lb-vspace"]/@class'), expected)

    def test_classification_precedes_alignment_distribution(self):
        tree = self.render('<align pos="right"><ul>A</ul></align><page index="2"/><align pos="right">B</align>')
        marker = self.page(tree)
        self.assertEqual(marker.get('data-break'), 'inline')
        self.assertEqual(marker.getparent().get('class'), 'align-right')
        self.assertEqual(marker.getprevious().text_content(), 'A')
        self.assertEqual(marker.tail, 'B')
        self.assertEqual(tree.text_content(), 'AB')
        # An explicit semantic boundary remains a boundary, even when all
        # visible text uses the same right alignment on both lines.
        tree = self.render('<align pos="right">A</align><page index="2"/><line/><align pos="right">B</align>')
        self.assertEqual(self.page(tree).get('data-break'), 'block')
        self.assertEqual(len(self.lines(tree)), 2)

    def test_empty_marks_survive_alignment_and_count_as_content(self):
        for mark in ['<nr/>', '<nr> </nr>', '<nr extent="3"/>', '<tl/>']:
            for kind in ['letter-text', 'sidenotes', 'traditions']:
                with self.subTest(mark=mark, kind=kind):
                    tree = self.render(f'{mark}<align pos="right">B{mark}</align>', kind)
                    tag = 'tl' if 'tl' in mark else 'nr'
                    self.assertEqual(len(tree.xpath('.//span[@class=$tag]', tag=tag)), 2)
                    self.assertEqual(len(tree.xpath('.//*[@class="align-left"]/span[@class=$tag]', tag=tag)), 1)
                    self.assertEqual(len(tree.xpath('.//*[@class="align-right"]/span[@class=$tag]', tag=tag)), 1)
                    if tag == 'nr':
                        self.assertTrue(all(n.text_content() == '' for n in tree.xpath('.//span[@class="nr"]')))
                        self.assertEqual(tree.xpath('.//span[@class="nr"]/@data-extent'), ['3', '3'] if '3' in mark else ['1', '1'])
        tree = self.render('<nr/><page index="2"/><nr/>')
        self.assertEqual(self.page(tree).get('data-break'), 'inline')

    def test_annotations_escape_and_follow_split_insertions(self):
        tree = self.render('<insertion pos="top left" annotation="a &amp; &quot;b&quot;">A<line/>B</insertion>')
        self.assertEqual(tree.xpath('.//span[@class="insertion"]/@data-annotation'), ['a & "b"', 'a & "b"'])
        self.assertEqual(tree.xpath('.//span[@class="insertion"]/@data-pos'), ['top left', 'top left'])
        self.assertFalse(tree.xpath('.//*[@class="insertion-marker"]'))

    def test_address_is_transparent_even_in_formatting(self):
        tree = self.render('<aq>A<address>B<line/>C</address>D</aq>')
        self.assertEqual([n.text_content() for n in self.lines(tree)], ['AB', 'CD'])
        self.assertFalse(tree.xpath('.//address'))
        self.assertEqual(tree.xpath('.//span[@class="aq"]/text()'), ['AB', 'CD'])

    def test_substitution_keeps_both_readings_but_omits_insertion_arrow(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            with self.subTest(kind=kind):
                tree = self.render('<subst><del>old</del><insertion pos="top">new</insertion></subst><insertion pos="left">added</insertion>', kind)
                subst = tree.xpath('.//span[@class="subst"]')[0]
                self.assertEqual(subst.text_content(), 'oldnew')
                self.assertEqual([child.tag for child in subst], ['del', 'span'])
                self.assertEqual(subst[1].get('class'), 'insertion')
                self.assertEqual(subst[1].get('data-pos'), 'top')
                self.assertFalse(subst.xpath('.//span[@class="insertion-arrow"]'))
                self.assertEqual(len(tree.xpath('.//span[@class="insertion-arrow"]')), 1)

    def test_empty_footnote_marks_preserve_connection_without_inventing_text(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            for content in ['', '   ']:
                with self.subTest(kind=kind, content=content):
                    tree = self.render(f'A<fn index="2">{content}</fn>B<fn index="2"><anchor>*</anchor></fn>', kind)
                    markers = tree.xpath('.//span[@class="fn"]')
                    self.assertEqual([m.get('data-index') for m in markers], ['2', '2'])
                    self.assertEqual(markers[0].get('data-empty'), 'true')
                    self.assertEqual(markers[0].text_content(), '')
                    self.assertIsNone(markers[1].get('data-empty'))
                    self.assertEqual(''.join(line.text_content() for line in self.lines(tree)), 'AB*')

    def test_nested_formatting_is_carried_into_table_cells(self):
        for wrapper in ['aq', 'it', 'b', 'del', 'ul', 'undo']:
            with self.subTest(wrapper=wrapper):
                tree = self.render(f'<{wrapper}><ul>X<tabs><tab value="1-2">A</tab><tab value="2-2">B</tab><vspace lines="2"/><line/><tab value="1-2">C</tab></tabs>Y</ul></{wrapper}>')
                cells = tree.xpath('.//div[@class="tab"]')
                self.assertEqual([c.text_content() for c in cells], ['A', 'B', 'C'])
                self.assertTrue(all(c.xpath('.//span[@class="ul"]') for c in cells))
                self.assertEqual(tree.text_content(), 'XABCY')

    def test_nested_tables_and_cell_alignment_have_local_context(self):
        tree = self.render('<align pos="right">Outside</align><aq><tabs><tab value="1-2">Left<align pos="right">Right</align><tabs><tab value="1-2">Nested</tab></tabs></tab><tab value="2-2">Other</tab></tabs></aq>')
        table = tree.xpath('.//div[@class="tabs"]')[0]
        self.assertEqual(len(table.xpath('.//div[@class="tabs"]')), 1)
        self.assertEqual(table.xpath('./div[@class="lb-tab-row"]/div[@class="tab"][1]//div[@class="align-right"]')[0].text_content(), 'Right')
        self.assertEqual(len(tree.xpath('.//div[@class="align-right"][text()="Outside"]')), 1)
        self.assertEqual(len(table.xpath('.//div[@class="tab"][.//text()="Other"]')), 1)

    def test_interstitial_tab_content_stays_inside_preceding_cell(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            with self.subTest(kind=kind):
                tree = self.render('<tabs><line/><tab value="3-8">1</tab> – <tab value="4-8">Draconer</tab><note>Remark</note><tab value="7-8">350.</tab></tabs>', kind)
                row = tree.xpath('.//div[@class="lb-tab-row"]')[0]
                cells = row.xpath('./div[@class="tab"]')
                self.assertEqual([c.text_content() for c in cells], ['1 – ', 'DraconerRemark', '350.'])
                self.assertEqual(len(row), 3)
                self.assertEqual(cells[1].xpath('./span[@class="note"]/text()'), ['Remark'])
                self.assertIn('--cell-gap: 25%', cells[0].get('style'))
                self.assertIn('--cell-width: 12.5%', cells[0].get('style'))
                self.assertIn('--cell-width: 37.5%', cells[1].get('style'))
                self.assertIn('--cell-width: 25%', cells[2].get('style'))

    def test_tab_preamble_and_repeated_stops_preserve_order(self):
        tree = self.render('<tabs><note>Table</note><tab value="2-2">A</tab> tail<tab value="2-2">B</tab><tab value="1-2">C</tab></tabs>')
        row = tree.xpath('.//div[@class="lb-tab-row"]')[0]
        self.assertEqual(row[0].get('class'), 'lb-tab-prefix')
        self.assertEqual(row[0].text_content(), 'Table')
        cells = row.xpath('./div[@class="tab"]')
        self.assertEqual([c.text_content() for c in cells], ['A tail', 'B', 'C'])
        self.assertTrue(all('--cell-gap: 50%' in c.get('style') for c in cells[:2]))
        self.assertIn('--cell-width: 50%', cells[1].get('style'))

    def test_vertical_space_is_a_boundary_without_an_extra_line(self):
        for kind in ['letter-text', 'sidenotes', 'traditions']:
            for after in ['B', '<line/>B']:
                tree = self.render(f'<line tab="4"/><ul>A<vspace lines="2"/>{after}</ul>', kind)
                lines = self.lines(tree)
                self.assertEqual([n.text_content() for n in lines], ['A', 'B'])
                self.assertEqual([n.get('data-tab') for n in lines], ['4', None])
                self.assertTrue(all(n.xpath('.//span[@class="ul"]') for n in lines))

    def test_inline_whitespace_survives_without_serializer_indentation(self):
        for body in ['<aq><ul>A</ul> </aq>B', 'A<aq> </aq>B', '<aq>A</aq> <ul>B</ul>']:
            tree = self.render(body)
            self.assertEqual(tree.text_content(), 'A B')

    def test_sidenote_does_not_interrupt_or_duplicate_main_flow(self):
        tree = self.render('A<sidenote page="1" pos="left"><line/>Note</sidenote>B')
        self.assertEqual(tree.text_content(), 'AB')
        self.assertEqual(len(self.lines(tree)), 1)
        self.assertFalse(tree.xpath('.//*[@class="sidenote-marker"]'))

    def test_apparatus_page_ids_do_not_collide_with_main_text(self):
        tree = self.render('A<page index="2"/>B', 'traditions')
        self.assertEqual(self.page(tree).get('id'), 'app-1-page-2')
        self.assertEqual(self.page(tree).get('data-break'), 'inline')

    def test_corpus_fragments_have_valid_nesting_and_preserve_milestones(self):
        ns = {'l': 'https://lenz-archiv.de'}
        for filename, tag, kind in [
            ('briefe.xml', 'letterText', 'letter-text'),
            ('briefe.xml', 'sidenote', 'sidenotes'),
            ('traditions.xml', 'letterTradition', 'traditions'),
        ]:
            doc = read_xml(filename)
            for node in doc.findall('.//l:' + tag, ns):
                with self.subTest(file=filename, line=node.sourceline):
                    result = self.runner.run_stylesheet(kind, serialize_node(node), {}, Timings())
                    self.assert_valid_nesting(result)
                    tree = html.fragment_fromstring(result, create_parent='div')
                    ids = tree.xpath('.//*[@id]/@id')
                    self.assertEqual(len(ids), len(set(ids)))
                    source_pages = node.xpath('.//l:page/@index', namespaces=ns)
                    self.assertEqual(tree.xpath('.//*[@class="page-anchor"]/@data-index'), source_pages)
                    self.assertTrue(all(v in ['inline', 'block'] for v in tree.xpath('.//*[@class="page-anchor"]/@data-break')))
                    for mark in ['nr', 'tl']:
                        source = node.xpath('.//l:' + mark, namespaces=ns)
                        if kind == 'letter-text':
                            source = [m for m in source if not m.xpath('ancestor::l:sidenote', namespaces=ns)]
                        self.assertEqual(len(tree.xpath('.//span[@class=$mark]', mark=mark)), len(source))
                    # Alignment may reorder regions, but it must not lose or
                    # duplicate any transcribed characters. Ignore formatting
                    # whitespace and the apparatus headings generated from refs.
                    def source_text(element):
                        if not isinstance(element.tag, str):
                            return ''
                        if kind == 'letter-text' and element.tag == '{https://lenz-archiv.de}sidenote':
                            return ''
                        return (element.text or '') + ''.join(
                            source_text(child) + (child.tail or '') for child in element
                        )

                    for heading in tree.xpath('.//h2 | .//h3'):
                        heading.drop_tree()
                    self.assertEqual(
                        Counter(c for c in tree.text_content() if not c.isspace()),
                        Counter(c for c in source_text(node) if not c.isspace()),
                    )
