import json
import unittest

from lxml import html

from transform_python.common import Timings
from transform_python.exporter import StylesheetRunner


class TraditionHeadingsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runner = StylesheetRunner.create()

    def render(self, content, definitions):
        result = self.runner.run_stylesheet(
            "traditions",
            f'<letterTradition xmlns="https://lenz-archiv.de" letter="1">{content}</letterTradition>',
            {"letter": "1", "appDefinitions": json.dumps(definitions)},
            Timings(),
        )
        return html.fromstring(result)

    def test_definition_headings_and_editorial_content(self):
        tree = self.render(
            '<app ref="4">Vor <del>alt</del><insertion>neu</insertion><line/>danach</app>'
            '<app ref="5">Druck</app><app ref="11">Traduction</app>',
            {
                "4": {"name": "Provenienz", "category": "Überlieferung & Textkritik"},
                "5": {"name": "Bisherige Drucke", "category": "Überlieferung & Textkritik"},
                "11": {"name": "Übersetzung", "category": "Übersetzung"},
            },
        )
        self.assertEqual(tree.xpath(".//h2/text()"), ["Überlieferung & Textkritik", "Übersetzung"])
        self.assertEqual(tree.xpath(".//h3/text()"), ["Provenienz", "Bisherige Drucke"])
        self.assertEqual(tree.xpath('.//*[@class="tradition-app"]/@data-ref'), ["4", "5", "11"])
        self.assertEqual(tree.xpath(".//del/text()"), ["alt"])
        self.assertEqual(tree.xpath('.//span[@class="insertion"]/text()'), ["neu"])
        self.assertEqual(tree.xpath('.//*[@data-ref="4"]/*[@class="lb-line-block"]/text()'), ["Vor ", "danach"])

    def test_source_order_mixed_text_and_unresolved_definitions(self):
        tree = self.render(
            'Vorrede <app ref="4">A</app> Zwischenwort '
            '<app ref="11">B</app><app ref="4">C</app><app ref="99">D</app>',
            {
                "4": {"name": "Provenienz", "category": "Überlieferung & Textkritik"},
                "11": {"name": "Übersetzung", "category": "Übersetzung"},
            },
        )
        self.assertEqual(tree.xpath('.//*[@class="tradition-app"]/@data-ref'), ["4", "11", "4", "99"])
        self.assertIn("Vorrede ", tree.text_content())
        self.assertIn(" Zwischenwort ", tree.text_content())
        self.assertEqual(tree.xpath(".//h2/text()")[-1], "Weitere Angaben")
        self.assertEqual(tree.xpath(".//h3/text()")[-1], "Apparat 99")

    def test_definition_text_is_escaped_not_interpreted_as_html(self):
        tree = self.render('<app ref="4">Text</app>', {
            "4": {"name": "<script>name</script>", "category": "A & B"},
        })
        self.assertEqual(tree.xpath(".//h2/text()"), ["A & B"])
        self.assertEqual(tree.xpath(".//h3/text()"), ["<script>name</script>"])
        self.assertFalse(tree.xpath(".//script"))


if __name__ == "__main__":
    unittest.main()
