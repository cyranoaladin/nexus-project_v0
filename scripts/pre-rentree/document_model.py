"""Validated, snapshot-only helpers shared by document renderers."""

from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from jsonschema import Draft202012Validator, FormatChecker


class SnapshotValidationError(ValueError):
    pass


def load_snapshot(snapshot_path: Path, schema_path: Path) -> dict[str, Any]:
    snapshot = json.loads(Path(snapshot_path).read_text(encoding="utf-8"))
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(snapshot), key=lambda error: list(error.path))
    if errors:
        detail = "; ".join(error.message for error in errors[:5])
        raise SnapshotValidationError(detail)
    return snapshot


def escape_text(value: Any) -> str:
    return html.escape(str(value), quote=True)


def safe_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"https", "mailto", "tel"}:
        raise ValueError(f"Unsupported URL scheme: {parsed.scheme or 'none'}")
    return escape_text(value)


def format_amount(value: int) -> str:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("Amounts must be non-negative integers")
    return f"{value:,}".replace(",", "\u00a0")


def amount_html(value: int, suffix: str = "TND") -> str:
    return f'<span class="amount">{format_amount(value)}&nbsp;{escape_text(suffix)}</span>'


def derive_pack(snapshot: dict[str, Any], subject_count: int) -> dict[str, Any]:
    matching = [pack for pack in snapshot["packs"] if pack["subjectCount"] == subject_count]
    if len(matching) != 1:
        raise ValueError(f"No canonical pack for {subject_count} selected subjects")
    return matching[0]

def claim_by_id(snapshot: dict[str, Any], claim_id: str) -> dict[str, Any]:
    matching = [claim for claim in snapshot["approvedPublicClaims"] if claim["id"] == claim_id]
    if len(matching) != 1:
        raise KeyError(f"Unknown or duplicate approved public claim: {claim_id}")
    return matching[0]
