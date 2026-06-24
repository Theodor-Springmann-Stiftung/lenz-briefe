from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from lxml import etree

NS = "https://lenz-archiv.de"
NSMAP = {"l": NS}

PACKAGE_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = PACKAGE_DIR.parent.parent
DATA_DIR = ROOT_DIR / "data" / "xml"
XSLT_DIR = ROOT_DIR / "xslt"
XSD_DIR = ROOT_DIR / "data" / "xsd"
CACHE_DIR = PACKAGE_DIR / ".cache"

XSD_MAP = {
    "briefe.xml": "briefe.xsd",
    "meta.xml": "meta.xsd",
    "references.xml": "references.xsd",
    "traditions.xml": "briefe.xsd",
}


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


def _is_strict_descendant(path: Path, parent: Path) -> bool:
    try:
        return path.relative_to(parent) != Path(".")
    except ValueError:
        return False


def assert_safe_output_dir(dir_path: Path) -> Path:
    absolute_dir = dir_path.resolve()
    filesystem_root = Path(absolute_dir.anchor)
    repo_root = ROOT_DIR.resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()

    if absolute_dir == filesystem_root:
        raise ValueError(f"Refusing to write transform output to filesystem root: {absolute_dir}")

    if absolute_dir == repo_root:
        raise ValueError(f"Refusing to write transform output to repository root: {absolute_dir}")

    if absolute_dir == temp_root:
        raise ValueError(f"Refusing to write transform output to system temp root: {absolute_dir}")

    if not (_is_strict_descendant(absolute_dir, repo_root) or _is_strict_descendant(absolute_dir, temp_root)):
        raise ValueError(
            f"Refusing to write transform output outside the repository or system temp directory: {absolute_dir}"
        )

    return absolute_dir


def reset_dir(dir_path: Path) -> None:
    if dir_path.exists():
        shutil.rmtree(dir_path)
    dir_path.mkdir(parents=True, exist_ok=True)


def remove_dir_if_exists(dir_path: Path) -> None:
    if dir_path.exists():
        shutil.rmtree(dir_path)


def replace_dir(staging_dir: Path, target_dir: Path) -> None:
    backup_dir = target_dir.with_name(f"{target_dir.name}.backup")
    remove_dir_if_exists(backup_dir)

    if target_dir.exists():
        target_dir.rename(backup_dir)

    try:
        staging_dir.rename(target_dir)
    except Exception:
        if backup_dir.exists() and not target_dir.exists():
            backup_dir.rename(target_dir)
        raise
    finally:
        remove_dir_if_exists(backup_dir)


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
    commit_message = subprocess.run(
        ["git", "show", "-s", "--format=%s", "HEAD"],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return {"commitHash": commit_hash, "commitDate": commit_date, "commitMessage": commit_message}


def get_git_metadata_safe() -> dict[str, str]:
    try:
        return get_git_metadata()
    except Exception:
        return {"commitHash": "unknown", "commitDate": "unknown", "commitMessage": "unknown"}


def utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def available_parallelism() -> int:
    return max(1, min(os.cpu_count() or 1, 8))


def validate_xml(doc: etree._ElementTree, file_name: str) -> list[dict[str, str | int]]:
    try:
        xsd = etree.XMLSchema(etree.parse(str(XSD_DIR / XSD_MAP[file_name])))
    except etree.XMLSchemaParseError as error:
        return [{"kind": "xsd", "stage": f"validateXsd:{file_name.removesuffix('.xml')}", "message": str(error)}]

    if not xsd.validate(doc):
        return [
            {
                "kind": "xsd",
                "stage": f"validateXsd:{file_name.removesuffix('.xml')}",
                "message": error.message,
                "line": error.line if error.line > 0 else None,
                "file": file_name,
            }
            for error in xsd.error_log
        ]
    return []
