"""Developer-owned XML sources for behavioral tests; never read editorial data."""
from pathlib import Path

from lxml import etree


EDITION_FIXTURES = Path(__file__).parent / 'fixtures' / 'edition'


def read_fixture_xml(filename):
    return etree.parse(str(EDITION_FIXTURES / filename), etree.XMLParser(
        remove_blank_text=True, resolve_entities=False, strip_cdata=False,
    ))
