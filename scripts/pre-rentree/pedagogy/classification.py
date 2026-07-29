"""Deterministic, content-neutral classification for the historical import."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import PurePosixPath


FINAL_CLASSIFICATIONS = frozenset(
    {
        "CANONICAL_SOURCE",
        "GENERATOR",
        "VALIDATOR",
        "GENERATED_OUTPUT",
        "HISTORICAL_VERSION",
        "ARCHIVE_PACKAGE",
        "DUPLICATE_IDENTICAL",
        "CONFLICT_REVIEW_REQUIRED",
        "UNCLASSIFIED",
    }
)
PENDING_DEDUPLICATION = "PENDING_DEDUPLICATION"

HISTORICAL_PACKAGES = (
    "Nexus-PreRentree-2026-85-seances",
    "Nexus-PreRentree-2026-positionnement-17-modules-v3",
    "Nexus-positionnement",
    "Nexus-positionnement-2026-maths-francais-v2",
)
_OLDER_POSITIONING_PACKAGES = frozenset(
    {
        "Nexus-positionnement",
        "Nexus-positionnement-2026-maths-francais-v2",
    }
)
_AMBIGUOUS_COPY_MARKER = re.compile(
    r"(?:^|[ ._()-])(?:copy|copie|duplicate|duplicata)(?:$|[ ._()-])",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Classification:
    logical_role: str
    proposed_destination: str
    provisional_classification: str


def normalized_name(name: str) -> str:
    """Return the stable key used to identify visually ambiguous siblings."""

    return unicodedata.normalize("NFC", name).casefold()


def has_ambiguous_name(name: str) -> bool:
    """Flag copy markers, control characters, or surrounding whitespace."""

    return (
        name != name.strip()
        or has_control_characters(name)
        or _AMBIGUOUS_COPY_MARKER.search(name) is not None
    )


def has_control_characters(name: str) -> bool:
    return any(unicodedata.category(character).startswith("C") for character in name)


def is_hidden_path(relative_path: PurePosixPath) -> bool:
    return any(part.startswith(".") and part not in {".", ".."} for part in relative_path.parts)


def classify(relative_path: PurePosixPath) -> Classification:
    """Classify from names and structure only, without reading pedagogical content."""

    parts = relative_path.parts
    package = parts[0] if len(parts) > 1 else ""
    name = relative_path.name
    lower_name = name.casefold()
    lower_parts = tuple(part.casefold() for part in parts)
    suffix = relative_path.suffix.casefold()

    if suffix == ".zip":
        return Classification(
            logical_role="ARCHIVE_PACKAGE",
            proposed_destination=f".artifacts/pre-rentree-2026/pedagogy/packages/{name}",
            provisional_classification="ARCHIVE_PACKAGE",
        )

    if suffix == ".py":
        validator = lower_name.startswith(("validate", "verify", "audit"))
        role = "VALIDATOR" if validator else "GENERATOR"
        return Classification(
            logical_role=role,
            proposed_destination=(
                "scripts/pre-rentree/pedagogy/legacy/"
                f"{package}/{name}"
            ),
            provisional_classification=role,
        )

    generated = (
        "ressources-generees" in lower_parts
        or lower_name in {"cahier-eleve.md", "guide-enseignant.md"}
    )
    if generated:
        return Classification(
            logical_role="GENERATED_RESOURCE",
            proposed_destination=(
                ".artifacts/pre-rentree-2026/pedagogy/generated/"
                f"{relative_path.as_posix()}"
            ),
            provisional_classification="GENERATED_OUTPUT",
        )

    if package in _OLDER_POSITIONING_PACKAGES:
        return Classification(
            logical_role=_logical_role(relative_path),
            proposed_destination=(
                "content/pre-rentree-2026/pedagogy/history/"
                f"{relative_path.as_posix()}"
            ),
            provisional_classification="HISTORICAL_VERSION",
        )

    logical_role = _logical_role(relative_path)
    return Classification(
        logical_role=logical_role,
        proposed_destination=_destination(relative_path, logical_role),
        provisional_classification=PENDING_DEDUPLICATION,
    )


def _logical_role(relative_path: PurePosixPath) -> str:
    name = relative_path.name.casefold()
    parts = tuple(part.casefold() for part in relative_path.parts)
    suffix = relative_path.suffix.casefold()

    session_names = {
        "banques-eleve.md": "SESSION_STUDENT_BANK",
        "corrige-commente.md": "SESSION_ANSWER_KEY",
        "verification-eleve.md": "SESSION_STUDENT_CHECK",
        "verification-correction.md": "SESSION_CHECK_ANSWER_KEY",
    }
    if name in session_names:
        return session_names[name]
    if name == "manifeste-seances.csv":
        return "SESSION_MANIFEST"
    if name == "manifest-sha256.txt":
        return "CHECKSUM_MANIFEST"
    if suffix in {".yaml", ".yml"}:
        return "POSITIONING_SOURCE"
    if suffix in {".csv", ".json"}:
        return "STRUCTURED_DATA"
    if "sources" in parts and suffix == ".md":
        return "SOURCE_DOCUMENTATION"
    if suffix in {".md", ".txt"}:
        return "DOCUMENTATION"
    return "UNKNOWN"


def _destination(relative_path: PurePosixPath, logical_role: str) -> str:
    parts = relative_path.parts
    package_relative = PurePosixPath(*parts[1:]) if len(parts) > 1 else relative_path

    if logical_role == "POSITIONING_SOURCE":
        return f"content/pre-rentree-2026/pedagogy/positioning/{relative_path.name}"
    if logical_role.startswith("SESSION_"):
        session_parts = package_relative.parts
        if session_parts[:2] == ("corpus", "modules"):
            session_parts = session_parts[2:]
        return (
            "content/pre-rentree-2026/pedagogy/session-kits/"
            f"{PurePosixPath(*session_parts).as_posix()}"
        )
    if logical_role == "CHECKSUM_MANIFEST":
        return (
            ".artifacts/pre-rentree-2026/pedagogy/import/source-manifests/"
            f"{relative_path.as_posix()}"
        )
    if logical_role in {"DOCUMENTATION", "SOURCE_DOCUMENTATION"}:
        return (
            "docs/campaigns/pre-rentree-2026/pedagogy/import-reference/"
            f"{relative_path.as_posix()}"
        )
    return (
        "content/pre-rentree-2026/pedagogy/review/"
        f"{relative_path.as_posix()}"
    )
