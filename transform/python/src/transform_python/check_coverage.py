from __future__ import annotations

import re
from pathlib import Path

from .common import ROOT_DIR

TEXTELEMENTS_PATH = ROOT_DIR / "data" / "xsd" / "textelements.xsd"
COMMON_XSL_PATH = ROOT_DIR / "xslt" / "common.xsl"


def get_inline_refs(xsd: str) -> list[str]:
    inline_match = re.search(
        r'<xs:complexType name="inline"[\s\S]*?<xs:choice[^>]*>([\s\S]*?)</xs:choice>',
        xsd,
    )
    if not inline_match:
        raise RuntimeError("Could not locate inline complexType in textelements.xsd")
    return [match.group(1).split(":")[-1] for match in re.finditer(r'ref="([^"]+)"', inline_match.group(1))]


def get_handled_tags(xsl: str) -> set[str]:
    handled: set[str] = set()
    for match in re.finditer(r'match="([^"]+)"', xsl):
        for part in match.group(1).split("|"):
            token = part.strip()
            if token.startswith("lb:"):
                handled.add(token.removeprefix("lb:"))
    return handled


def main() -> int:
    xsd = Path(TEXTELEMENTS_PATH).read_text(encoding="utf8")
    xsl = Path(COMMON_XSL_PATH).read_text(encoding="utf8")
    refs = get_inline_refs(xsd)
    handled = get_handled_tags(xsl)
    missing = [ref for ref in refs if ref not in handled]
    if missing:
        print("Missing XSLT handlers for schema tags:")
        for tag in missing:
            print(f"- {tag}")
        return 1
    print(f"Coverage OK: {len(refs)} shared inline tags handled in common.xsl")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
