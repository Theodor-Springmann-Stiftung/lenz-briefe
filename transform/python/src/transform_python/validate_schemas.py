"""Strict XSD validation for CI, before any transformation or deployment."""

from lxml import etree

from .common import XSD_MAP, read_xml, validate_xml


def main() -> int:
    failed = False
    for filename in XSD_MAP:
        try:
            errors = validate_xml(read_xml(filename), filename)
        except (etree.Error, OSError) as error:
            errors = [{"message": str(error)}]
        if errors:
            failed = True
            for error in errors:
                line = f":{error['line']}" if error.get("line") else ""
                print(f"FAIL {filename}{line}: {error['message']}")
        else:
            print(f"PASS {filename}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
