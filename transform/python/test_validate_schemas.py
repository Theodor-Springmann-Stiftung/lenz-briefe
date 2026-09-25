import contextlib
import io
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from transform_python.common import DATA_DIR, XSD_MAP, read_xml, validate_xml
from transform_python.validate_schemas import main


class ValidationGateTests(unittest.TestCase):
    def test_highlight_colors_are_restricted(self):
        for color, valid in [('yellow', True), ('red', True), ('blue', False), ('#ff0000', False), (None, False)]:
            with self.subTest(color=color):
                document = read_xml('briefe.xml')
                highlight = document.xpath('//*[local-name()="highlight"]')[0]
                if color is None:
                    del highlight.attrib['color']
                else:
                    highlight.set('color', color)
                self.assertEqual(not validate_xml(document, 'briefe.xml'), valid)

    def test_current_edition_passes(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(main(), 0)

    def test_invalid_malformed_or_missing_source_blocks_publication(self):
        for content in [
            '<opus xmlns="https://lenz-archiv.de"><invalid/></opus>',
            '<opus>',
            None,
        ]:
            with self.subTest(content=content), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                for filename in XSD_MAP:
                    shutil.copyfile(DATA_DIR / filename, root / filename)
                target = root / 'briefe.xml'
                if content is None:
                    target.unlink()
                else:
                    target.write_text(content, encoding='utf-8')
                output = io.StringIO()
                with patch('transform_python.common.DATA_DIR', root), contextlib.redirect_stdout(output):
                    self.assertEqual(main(), 1)
                self.assertIn('FAIL briefe.xml', output.getvalue())
                self.assertIn('PASS meta.xml', output.getvalue())


if __name__ == '__main__':
    unittest.main()
