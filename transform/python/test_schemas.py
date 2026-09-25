import unittest

from lxml import etree

from transform_python.common import XSD_DIR, XSD_MAP


class SeparateDocumentSchemaTests(unittest.TestCase):
    def test_hand_can_cross_pages_but_page_indices_remain_unique(self):
        schema = etree.XMLSchema(etree.parse(str(XSD_DIR / 'briefe.xsd')))
        for index, valid in [('2', True), ('1', False)]:
            with self.subTest(index=index):
                doc = etree.fromstring(
                    '<opus xmlns="https://lenz-archiv.de"><document><letterText letter="1">'
                    '<page index="1"/><hand ref="1">Before'
                    f'<page index="{index}" type="outer"/>After</hand>'
                    '</letterText></document></opus>')
                self.assertEqual(schema.validate(doc), valid)

    def test_page_type_is_optional_and_restricted(self):
        elements = etree.parse(str(XSD_DIR / 'textelements.xsd'))
        self.assertEqual(elements.xpath('string(//xs:element[@name="page"]//xs:attribute[@name="type"]/@default)',
                                        namespaces={'xs': 'http://www.w3.org/2001/XMLSchema'}), 'inner')
        for name, wrapper in [
            ('briefe.xsd', '<document><letterText letter="1">{}</letterText></document>'),
            ('traditions.xsd', '<traditions><letterTradition letter="1"><app ref="4">{}</app></letterTradition></traditions>'),
        ]:
            schema = etree.XMLSchema(etree.parse(str(XSD_DIR / name)))
            for attribute, expected in [('', 'inner'), (' type="outer"', 'outer'), (' type="inner"', 'inner'), (' type="other"', None), (' type=""', None)]:
                with self.subTest(schema=name, attribute=attribute):
                    body = wrapper.format(f'<page index="1"{attribute}/>')
                    doc = etree.fromstring(f'<opus xmlns="https://lenz-archiv.de">{body}</opus>')
                    self.assertEqual(schema.validate(doc), expected is not None)

    def test_sup_and_sub_are_allowed_in_formatting_contexts(self):
        content = (
            '<tabs><tab value="1-2">A<line/>B</tab><tab value="2-2">C<line/>D</tab></tabs>'
            '<sup><ul>hoch</ul></sup><sub><it>tief</it></sub>'
            '<ul><sup>hoch</sup><sub>tief</sub></ul>'
            '<align pos="right"><sup>hoch</sup><sub>tief</sub></align>'
            '<undo><sup>hoch</sup><sub>tief</sub></undo>'
        )
        documents = {
            'briefe.xsd': '<document><letterText letter="1"><page index="1"/>' + content +
                '<sidenote pos="left" page="1">' + content + '</sidenote></letterText></document>',
            'traditions.xsd': '<traditions><letterTradition letter="1"><app ref="4">' +
                content + '</app></letterTradition></traditions>',
        }
        for name, body in documents.items():
            with self.subTest(schema=name):
                schema = etree.XMLSchema(etree.parse(str(XSD_DIR / name)))
                schema.assertValid(etree.fromstring('<opus xmlns="https://lenz-archiv.de">' + body + '</opus>'))

    def test_each_schema_accepts_only_its_document_container(self):
        documents = {
            "briefe.xsd": '<document><letterText letter="1"><page index="1"/>Text</letterText></document>',
            "traditions.xsd": '<traditions><letterTradition letter="1"><app ref="4">Vor <del>alt</del><insertion>neu</insertion> nach</app></letterTradition></traditions>',
        }
        for schema_name in documents:
            schema = etree.XMLSchema(etree.parse(str(XSD_DIR / schema_name)))
            for document_name, content in documents.items():
                with self.subTest(schema=schema_name, document=document_name):
                    doc = etree.fromstring(f'<opus xmlns="https://lenz-archiv.de">{content}</opus>')
                    self.assertEqual(schema.validate(doc), schema_name == document_name)

    def test_app_allows_interleaved_pages_with_positive_indices(self):
        schema = etree.XMLSchema(etree.parse(str(XSD_DIR / 'traditions.xsd')))
        for content, valid in [
            ('Vor <page index="2"/><del>alt</del><line/>nach<page index="3"/> Ende', True),
            ('<page/>', False),
            ('<page index="0"/>', False),
            ('<page index="2">Text</page>', False),
        ]:
            with self.subTest(content=content):
                doc = etree.fromstring(
                    '<opus xmlns="https://lenz-archiv.de"><traditions>'
                    '<letterTradition letter="1"><app ref="4">' + content +
                    '</app></letterTradition></traditions></opus>'
                )
                self.assertEqual(schema.validate(doc), valid)

    def test_traditions_use_dedicated_schema(self):
        self.assertEqual(XSD_MAP['traditions.xml'], 'traditions.xsd')


if __name__ == '__main__':
    unittest.main()
