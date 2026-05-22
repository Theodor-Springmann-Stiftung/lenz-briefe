from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable

from lxml import etree

NS = "https://lenz-archiv.de"
NSMAP = {"l": NS}

PACKAGE_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = PACKAGE_DIR.parent.parent
DATA_DIR = ROOT_DIR / "data" / "xml"
XSLT_DIR = ROOT_DIR / "xslt"
CACHE_DIR = PACKAGE_DIR / ".cache"


class Timings:
    def __init__(self) -> None:
        self._totals: dict[str, float] = defaultdict(float)
        self._counts: dict[str, int] = defaultdict(int)

    def record(self, label: str, duration_ms: float) -> None:
        self._totals[label] += duration_ms
        self._counts[label] += 1

    def measure(self, label: str, fn: Callable[[], Any]) -> Any:
        started_at = time.perf_counter()
        try:
            return fn()
        finally:
            self.record(label, (time.perf_counter() - started_at) * 1000.0)

    def snapshot(self) -> list[dict[str, Any]]:
        rows = [
            {
                "label": label,
                "totalMs": total_ms,
                "count": self._counts[label],
            }
            for label, total_ms in self._totals.items()
        ]
        rows.sort(key=lambda row: row["totalMs"], reverse=True)
        return rows


def read_xml(file_name: str) -> etree._ElementTree:
    parser = etree.XMLParser(remove_blank_text=True, resolve_entities=False, strip_cdata=False)
    return etree.parse(str(DATA_DIR / file_name), parser)


def text_content(node: etree._Element | None) -> str:
    if node is None:
        return ""
    return re.sub(r"\s+", " ", "".join(node.itertext())).strip()


def get_attribute(node: etree._Element | None, name: str, fallback: Any = None) -> Any:
    if node is None:
        return fallback
    value = node.get(name)
    return fallback if value is None or value == "" else value


def slugify_letter(letter: str) -> str:
    return f"letter-{str(letter).zfill(3)}"


def serialize_node(node: etree._Element) -> str:
    return etree.tostring(node, encoding="unicode", with_tail=False)


def serialize_child_node(node: Any) -> str:
    if isinstance(node, etree._ElementUnicodeResult):
        return str(node)
    if isinstance(node, (etree._Comment, etree._ProcessingInstruction)):
        return etree.tostring(node, encoding="unicode", with_tail=False)
    if isinstance(node, etree._Element):
        return etree.tostring(node, encoding="unicode", with_tail=False)
    return str(node)


def ensure_dir(dir_path: Path) -> None:
    dir_path.mkdir(parents=True, exist_ok=True)


def reset_dir(dir_path: Path) -> None:
    if dir_path.exists():
        shutil.rmtree(dir_path)
    dir_path.mkdir(parents=True, exist_ok=True)


def write_text(target_path: Path, content: str) -> None:
    ensure_dir(target_path.parent)
    target_path.write_text(content, encoding="utf8")


def write_json(target_path: Path, payload: Any) -> None:
    write_text(target_path, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def remove_file_if_exists(target_path: Path) -> None:
    try:
        target_path.unlink()
    except FileNotFoundError:
        pass


def get_git_metadata() -> dict[str, str]:
    commit_hash = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    commit_date = subprocess.run(
        ["git", "show", "-s", "--format=%cI", "HEAD"],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return {"commitHash": commit_hash, "commitDate": commit_date}


def available_parallelism() -> int:
    return max(1, min(os.cpu_count() or 1, 8))
