from pathlib import Path
import unittest
from lxml import etree
from transform_python.common import Timings
from transform_python.exporter import StylesheetRunner, PipelineFailure

NS = {'t': 'http://www.tei-c.org/ns/1.0'}
REFS = '''<opus xmlns="https://lenz-archiv.de"><definitions><personDefs>
<personDef index="1" name="A &amp; B" ref="https://d-nb.info/gnd/118571656"/>
<personDef index="2" name="Unknown correspondent"/>
</personDefs><locationDefs>
<locationDef index="1" name="Berka" ref="https://d-nb.info/gnd/4087284-1" geonames="https://www.geonames.org/2953363"/>
<locationDef index="2" name="GND place" ref="https://d-nb.info/gnd/123"/>
<locationDef index="3" name="Local place"/>
</locationDefs></definitions></opus>'''

class CmifTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = StylesheetRunner.create()
        cls.schema = etree.RelaxNG(etree.parse(str(Path(__file__).parent / 'fixtures/cmif/cmi-customization.rng')))

    def transform(self, body, refs=REFS):
        xml = self.runner.run_stylesheet('cmif', '<opus xmlns="https://lenz-archiv.de"><descriptions>' + body + '</descriptions></opus>',
            {'references': refs, 'updated': '2026-10-07T12:00:00Z'}, Timings())
        tree = etree.fromstring(xml.encode())
        self.assertTrue(self.schema.validate(tree), str(self.schema.error_log))
        # Execute the upstream XPath 2 Schematron assertions with Saxon.
        rules = etree.parse(str(Path(__file__).parent / 'fixtures/cmif/cmif.sch'))
        xpath = self.runner.processor.new_xpath_processor()
        xpath.declare_namespace('tei', NS['t'])
        xpath.declare_namespace('xs', 'http://www.w3.org/2001/XMLSchema')
        doc = self.runner.processor.parse_xml(xml_text=xml)
        for rule in rules.findall('.//{http://purl.oclc.org/dsdl/schematron}rule'):
            xpath.set_context(xdm_item=doc)
            nodes = xpath.evaluate('//' + rule.get('context'))
            if nodes is None:
                continue
            for node in nodes:
                xpath.set_context(xdm_item=node)
                for assertion in rule:
                    self.assertTrue(xpath.effective_boolean_value(assertion.get('test')), assertion.text)
        return tree

    def test_identifiers_names_uncertainty_multiple_people_and_escaping(self):
        tree = self.transform('''<letterDesc letter="1"><sent><person ref="1"/><person ref="2" cert="low"/>
          <location ref="1" cert="low"/><date when="1765-01-02">2. Januar 1765</date></sent>
          <received><person ref="2"/><location ref="2"/><location ref="3"/></received></letterDesc>''')
        desc = tree.find('.//t:correspDesc', NS)
        self.assertEqual(desc.get('ref'), 'https://lenz-briefe.de/briefe/1/')
        self.assertEqual(tree.find('.//t:bibl', NS).get('{http://www.w3.org/XML/1998/namespace}id'), desc.get('source')[1:])
        people = tree.findall('.//t:persName', NS)
        self.assertEqual(people[0].text, 'A & B')
        self.assertEqual(people[0].get('ref'), 'https://d-nb.info/gnd/118571656')
        self.assertEqual(people[1].get('ref'), 'https://lenz-briefe.de/?group=all&person=2')
        self.assertEqual(people[1].get('cert'), 'low')
        places = tree.findall('.//t:placeName', NS)
        self.assertEqual([p.get('ref') for p in places], ['https://www.geonames.org/2953363', 'https://d-nb.info/gnd/123', 'https://lenz-briefe.de/?group=all&place=3'])
        self.assertEqual(places[0].get('cert'), 'low')

    def test_date_forms_and_no_invented_receipt_date(self):
        for attrs in ['when="1765"', 'when="1765-01"', 'when="1765-01-02"',
                      'from="1765-01-02" to="1765-01-05"',
                      'notBefore="1765-01" notAfter="1765-03"', 'notAfter="1765"']:
            with self.subTest(attrs=attrs):
                tree = self.transform(f'<letterDesc letter="1"><sent><person ref="1"/><date {attrs} cert="low">Editorial date</date></sent><received/></letterDesc>')
                date = tree.find('.//t:correspAction/t:date', NS)
                original = etree.fromstring(f'<date {attrs} cert="low"/>')
                self.assertEqual(dict(date.attrib), dict(original.attrib))
                self.assertFalse(tree.xpath('//t:correspAction[@type="received"]/t:date', namespaces=NS))
                self.assertEqual(tree.xpath('string(//t:correspAction[@type="received"]/t:persName)', namespaces=NS), 'Unbekannt')

    def test_inline_markup_is_plain_text_and_place_labels_are_preserved(self):
        tree = self.transform('<letterDesc letter="1"><sent><person ref="1" cert="high"/><location ref="1">Historic village</location><date when="1765">before <wwwlink address="https://example.org">winter</wwwlink></date></sent></letterDesc>')
        self.assertEqual(tree.find('.//t:placeName', NS).text, 'Historic village')
        self.assertEqual(tree.find('.//t:correspAction/t:date', NS).text, 'before winter')
        self.assertIsNone(tree.find('.//t:persName', NS).get('cert'))

    def test_undated_letters_have_unknown_parties_without_invented_dates(self):
        tree = self.transform('<letterDesc letter="1"><sent><date>Undated</date></sent></letterDesc>')
        self.assertEqual(len(tree.findall('.//t:correspAction', NS)), 2)
        self.assertFalse(tree.findall('.//t:correspAction/t:date', NS))

    def test_invalid_dates_and_dangling_references_fail(self):
        for body in ['<person ref="999"/>', '<person ref="1"/><date when="1765-02-30"/>', '<person ref="1"/><date when="1765/1766"/>']:
            with self.subTest(body=body), self.assertRaises(PipelineFailure):
                self.transform(f'<letterDesc letter="1"><sent>{body}</sent></letterDesc>')

if __name__ == '__main__':
    unittest.main()
