from __future__ import annotations

import ast
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_ROOT = REPO_ROOT / "scripts/pre-rentree/pedagogy"
CONTENT_ROOT = REPO_ROOT / "content/pre-rentree-2026/pedagogy"
GOVERNANCE_ROOT = REPO_ROOT / "docs/campaigns/pre-rentree-2026/pedagogy"
IMPORT_REDIRECT = REPO_ROOT / "docs/bilans/dossiers_tests_prerentree/README.md"

MARKDOWN_LINK = re.compile(r"!?\[[^\]]*]\(([^)]+)\)")
PYTHON_FENCE = re.compile(r"```python[ \t]*\n(.*?)```", re.DOTALL)
SENSITIVE_PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "credential assignment": re.compile(
        r"(?im)^\s*(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*\S+"
    ),
    "Tunisian phone": re.compile(
        r"(?<!\d)(?:\+?216[\s.-]*(?:\d[\s.-]*){8}|(?:\d{2}[\s.]){3}\d{2})(?!\d)"
    ),
}


def _markdown_files() -> list[Path]:
    return sorted(CONTENT_ROOT.rglob("*.md")) + sorted(GOVERNANCE_ROOT.glob("*.md")) + [
        IMPORT_REDIRECT
    ]


def _corpus_files() -> list[Path]:
    return sorted(path for path in CONTENT_ROOT.rglob("*") if path.is_file())


def test_generators_encode_only_canonical_sources_and_artifact_defaults():
    for name in ("generate_positioning_resources.py", "generate_session_kits.py"):
        text = (SCRIPT_ROOT / name).read_text(encoding="utf-8")
        assert "content/pre-rentree-2026/pedagogy" in text
        assert ".artifacts/pre-rentree-2026/pedagogy/generated" in text
        assert "docs/bilans/dossiers_tests_prerentree" not in text
        assert "/home/" not in text
        assert "public/" not in text
        assert "assets/" not in text
        assert "rmtree" not in text
        assert "datetime" not in text
    positioning = (
        SCRIPT_ROOT / "generate_positioning_resources.py"
    ).read_text(encoding="utf-8")
    assert "cartes-groupe" in positioning
    assert "cartes-parent" not in positioning


def test_default_build_creates_only_generated_review_and_packages(tmp_path: Path):
    artifact_root = tmp_path / ".artifacts/pre-rentree-2026/pedagogy"
    commands = (
        (
            SCRIPT_ROOT / "generate_positioning_resources.py",
            artifact_root / "generated/positioning",
        ),
        (
            SCRIPT_ROOT / "generate_session_kits.py",
            artifact_root / "generated/session-kits",
        ),
    )
    for script, output in commands:
        result = subprocess.run(
            [
                sys.executable,
                str(script),
                "--repo-root",
                str(REPO_ROOT),
                "--output-root",
                str(output),
            ],
            text=True,
            capture_output=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
    (artifact_root / "review").mkdir()
    (artifact_root / "packages").mkdir()
    assert {path.name for path in artifact_root.iterdir()} == {
        "generated",
        "review",
        "packages",
    }


def test_local_markdown_links_resolve_inside_the_repository():
    checked = 0
    canonical_checked = 0
    failures: list[str] = []
    for markdown in _markdown_files():
        text = markdown.read_text(encoding="utf-8")
        for match in MARKDOWN_LINK.finditer(text):
            raw_target = match.group(1).strip().split(maxsplit=1)[0].strip("<>")
            if not raw_target or raw_target.startswith(("#", "http://", "https://", "mailto:")):
                continue
            relative_target = unquote(raw_target.split("#", 1)[0])
            resolved = (markdown.parent / relative_target).resolve()
            checked += 1
            if markdown.is_relative_to(CONTENT_ROOT):
                canonical_checked += 1
            if not resolved.is_relative_to(REPO_ROOT.resolve()) or not resolved.exists():
                failures.append(f"{markdown.relative_to(REPO_ROOT)} -> {raw_target}")
    assert canonical_checked == 340
    assert checked == 349
    assert failures == []


def test_python_markdown_fences_are_syntactically_valid():
    checked = 0
    failures: list[str] = []
    for markdown in _markdown_files():
        for index, source in enumerate(
            PYTHON_FENCE.findall(markdown.read_text(encoding="utf-8")),
            start=1,
        ):
            checked += 1
            try:
                ast.parse(source)
            except SyntaxError as error:
                failures.append(
                    f"{markdown.relative_to(REPO_ROOT)} fence {index}: {error.msg}"
                )
    assert checked == 13
    assert failures == []


def test_corpus_text_is_utf8_with_stable_names_and_documented_line_endings():
    crlf_allowlist = {
        CONTENT_ROOT / "session-kits/MANIFESTE-SEANCES.csv",
    }
    failures: list[str] = []
    for path in _corpus_files():
        relative = path.relative_to(CONTENT_ROOT)
        raw = path.read_bytes()
        try:
            raw.decode("utf-8")
        except UnicodeDecodeError as error:
            failures.append(f"{relative}: invalid UTF-8 at byte {error.start}")
            continue
        if raw.startswith(b"\xef\xbb\xbf"):
            failures.append(f"{relative}: UTF-8 BOM")
        if b"\r\n" in raw and path not in crlf_allowlist:
            failures.append(f"{relative}: unexpected CRLF")
        for part in relative.parts:
            if part != unicodedata.normalize("NFC", part):
                failures.append(f"{relative}: non-NFC name")
            if any(ord(character) < 32 for character in part):
                failures.append(f"{relative}: control character in name")
    assert failures == []


def test_canonical_corpus_contains_no_contact_data_or_credentials():
    failures: list[str] = []
    for path in _corpus_files():
        text = path.read_text(encoding="utf-8")
        for label, pattern in SENSITIVE_PATTERNS.items():
            if pattern.search(text):
                failures.append(f"{path.relative_to(CONTENT_ROOT)}: {label}")
    assert failures == []
