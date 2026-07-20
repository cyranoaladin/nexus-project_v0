import sys
import json
from pathlib import Path

import pytest

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_model import (  # noqa: E402
    SnapshotValidationError,
    amount_html,
    derive_pack,
    escape_text,
    format_amount,
    load_snapshot,
    safe_url,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT_PATH = REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json"
SCHEMA_PATH = REPO_ROOT / "scripts/pre-rentree/schemas/publication-snapshot.schema.json"


def test_loads_the_canonical_snapshot_against_the_portable_schema():
    snapshot = load_snapshot(SNAPSHOT_PATH, SCHEMA_PATH)
    assert snapshot["sourceRepoSha"] == "a1192c8dccf8eaa6ae223265a3bc9ceb56a6fff0"
    assert len(snapshot["modules"]) == 12


def test_rejects_an_incomplete_snapshot(tmp_path: Path):
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}", encoding="utf-8")
    with pytest.raises(SnapshotValidationError):
        load_snapshot(invalid, SCHEMA_PATH)


def test_portable_schema_rejects_missing_business_and_output_fields(tmp_path: Path):
    canonical = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    del canonical["packs"][0]["price"]
    del canonical["document"]["outputs"]
    invalid = tmp_path / "missing-business-fields.json"
    invalid.write_text(json.dumps(canonical), encoding="utf-8")

    with pytest.raises(SnapshotValidationError):
        load_snapshot(invalid, SCHEMA_PATH)


def test_escapes_text_and_accepts_only_public_document_url_schemes():
    assert escape_text('<script>alert("x")</script>') == "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    assert safe_url("https://nexusreussite.academy/path") == "https://nexusreussite.academy/path"
    assert safe_url("mailto:contact@example.test") == "mailto:contact@example.test"
    assert safe_url("tel:+21600000000") == "tel:+21600000000"
    with pytest.raises(ValueError, match="Unsupported URL scheme"):
        safe_url("javascript:alert(1)")


def test_formats_amounts_with_a_non_breaking_separator_and_no_wrap_markup():
    assert format_amount(1350) == "1\u00a0350"
    assert format_amount(1800) == "1\u00a0800"
    assert format_amount(1260) == "1\u00a0260"
    markup = amount_html(1350)
    assert "1\u00a0350" in markup
    assert 'class="amount"' in markup


def test_derives_pack_from_subject_count_instead_of_an_independent_choice():
    snapshot = load_snapshot(SNAPSHOT_PATH, SCHEMA_PATH)
    assert derive_pack(snapshot, 3)["price"] == 1350
    with pytest.raises(ValueError, match="No canonical pack"):
        derive_pack(snapshot, 0)
