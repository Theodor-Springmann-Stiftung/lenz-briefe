from __future__ import annotations

import argparse
import filecmp
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from .common import ROOT_DIR

HTML_JSON_KEYS = {"traditionsHtml", "html"}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="benchmark-transform")
    parser.add_argument("--out-base", dest="out_base", default=None)
    return parser.parse_args(argv)


def normalize_html(value: str) -> str:
    return re.sub(r"\s+", "", value)


def normalize_json(value):
    if isinstance(value, dict):
        return {
            key: normalize_html(item) if key in HTML_JSON_KEYS and isinstance(item, str) else normalize_json(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [normalize_json(item) for item in value]
    return value


def files_match(left: Path, right: Path) -> bool:
    if left.suffix == ".html" and right.suffix == ".html":
        return normalize_html(left.read_text(encoding="utf8")) == normalize_html(right.read_text(encoding="utf8"))
    if left.suffix == ".json" and right.suffix == ".json":
        left_value = normalize_json(json.loads(left.read_text(encoding="utf8")))
        right_value = normalize_json(json.loads(right.read_text(encoding="utf8")))
        return left_value == right_value
    return left.read_bytes() == right.read_bytes()


def compare_trees(left: Path, right: Path) -> list[str]:
    mismatches: list[str] = []
    comparison = filecmp.dircmp(left, right)

    for item in sorted(comparison.left_only):
        mismatches.append(f"Only in {left}: {item}")
    for item in sorted(comparison.right_only):
        mismatches.append(f"Only in {right}: {item}")
    for item in sorted(comparison.common_files):
        left_file = left / item
        right_file = right / item
        if not files_match(left_file, right_file):
            mismatches.append(str(left_file.relative_to(left.parent)))
    for name in sorted(comparison.common_dirs):
        mismatches.extend(compare_trees(left / name, right / name))
    return mismatches


def main() -> int:
    args = parse_args(sys.argv[1:])
    if args.out_base:
        base_dir = Path(args.out_base).resolve()
        base_dir.mkdir(parents=True, exist_ok=True)
        temp_root = base_dir
        cleanup = False
    else:
        temp_root = Path(tempfile.mkdtemp(prefix="lenz-transform-benchmark-"))
        cleanup = True

    node_out = temp_root / "node"
    python_out = temp_root / "python"

    try:
        node_started = time.perf_counter()
        subprocess.run(
            ["node", "./src/cli.mjs", "--out", str(node_out)],
            cwd=ROOT_DIR / "transform" / "js",
            check=True,
        )
        node_ms = (time.perf_counter() - node_started) * 1000.0

        python_started = time.perf_counter()
        subprocess.run(
            ["uv", "run", "transform", "--out", str(python_out)],
            cwd=ROOT_DIR / "transform" / "python",
            check=True,
        )
        python_ms = (time.perf_counter() - python_started) * 1000.0

        mismatches = compare_trees(node_out, python_out)
        print(f"Node wall time: {node_ms:.1f}ms")
        print(f"Python wall time: {python_ms:.1f}ms")
        if mismatches:
            print("Parity mismatches:")
            for mismatch in mismatches:
                print(f"- {mismatch}")
            return 1
        print("Parity OK")
        return 0
    finally:
        if cleanup:
            shutil.rmtree(temp_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
