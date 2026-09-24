from __future__ import annotations

import argparse
import sys

from .exporter import run_export


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="transform")
    parser.add_argument("--out", required=True, dest="out")
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args(sys.argv[1:])
    try:
        result = run_export(args.out)
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1
    total_ms = result.get("totalMs")
    if isinstance(total_ms, (int, float)):
        print(f"Wall time: {total_ms:.1f}ms", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
