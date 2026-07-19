#!/usr/bin/env python3
"""Read-only provenance and page-level claim audit for the local v4 package."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REQUIRED_CLAIM_TYPES = {
    "DATE",
    "ENTRY_CLASS",
    "SUBJECT",
    "LEVEL_LABEL",
    "SCHEDULE_SLOT",
    "ROOM",
    "CAPACITY",
    "PRICE",
    "DEPOSIT",
    "BALANCE",
    "PROGRAM",
    "DELIVERABLE",
    "ASSESSMENT",
    "MATERIAL",
    "TEACHER_QUALIFICATION",
    "REFUND",
    "REPORT",
    "ABSENCE",
    "CANCELLATION",
    "FORCE_MAJEURE",
    "TEACHER_UNAVAILABILITY",
    "BALANCE_DEADLINE",
    "CTA",
    "PRE_REGISTRATION",
    "DATA_COLLECTION",
    "IMAGE_RIGHT",
}

MATRIX_COLUMNS = [
    "DOCUMENT",
    "PAGE",
    "CLAIM",
    "CLAIM_TYPE",
    "CANONICAL_SOURCE",
    "CANONICAL_VALUE",
    "MATCH",
    "SEVERITY",
    "ACTION",
]

V4_PDF_NAMES = (
    "NexusReussite_PreRentree2026_DossierAccueil_PRINT.pdf",
    "NexusReussite_PreRentree2026_Essentiel.pdf",
    "NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf",
    "NexusReussite_PreRentree2026_Programme_Premiere.pdf",
    "NexusReussite_PreRentree2026_Programme_Seconde.pdf",
    "NexusReussite_PreRentree2026_Programme_Terminale.pdf",
    "NexusReussite_PreRentree2026_Tarifs.pdf",
)


@dataclass(frozen=True)
class AuditResult:
    manifest_path: Path
    claim_matrix_path: Path
    content_diff_path: Path


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _pdf_pages(path: Path) -> list[str]:
    completed = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    pages = completed.stdout.split("\f")
    while pages and not pages[-1].strip():
        pages.pop()
    return pages


def _compact(value: Any, limit: int = 700) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return text if len(text) <= limit else f"{text[: limit - 1]}…"


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def _claim_type(line: str, document: str) -> str:
    value = line.casefold()
    patterns = (
        ("FORCE_MAJEURE", r"force majeure"),
        ("TEACHER_UNAVAILABILITY", r"indisponibilit.{0,10}(enseignant|professeur)|remplaçant"),
        ("BALANCE_DEADLINE", r"solde.{0,40}(avant|échéance|72\s*h|premi.{0,5}séance)"),
        ("REFUND", r"rembours|restitu"),
        ("REPORT", r"report|reportable"),
        ("ABSENCE", r"absence|rattrapage"),
        ("CANCELLATION", r"annulation|résiliation"),
        ("IMAGE_RIGHT", r"droit à l.image|photo|vidéo|témoignage"),
        ("DATA_COLLECTION", r"données|confidentialité|adresse|téléphone.{0,12}parent|courriel|e-mail"),
        ("PRE_REGISTRATION", r"pré[- ]?inscription|ne (réserve|bloque) pas|sans paiement|n.engage pas"),
        ("CTA", r"réserver|s.informer|se pré-inscrire|demander un conseil|contactez"),
        ("TEACHER_QUALIFICATION", r"certifié|agrégé|qualification|enseignant.{0,20}système français"),
        ("DEPOSIT", r"acompte"),
        ("BALANCE", r"\bsolde\b"),
        ("PRICE", r"\b(?:tnd|dinars?|prix|tarif|\d+\s*tnd/h)\b"),
        ("SCHEDULE_SLOT", r"\b(?:0?8:30|10:45|12:45|13:30|15:30|15:45|17:45)\b|créneau|horaire"),
        ("DATE", r"\b(?:17|18|19|20|21|22|23|24|25|26|27|28)\s+août\b|10\s+août|2026-08-"),
        ("ROOM", r"\bsalle\s*[12]\b|mutuelleville"),
        ("CAPACITY", r"\b(?:3|trois)\s+à\s+(?:5|cinq)\b|minimum.{0,8}3|maximum.{0,8}5|groupe.{0,20}élèves"),
        ("MATERIAL", r"matériel|cahier|trousse|calculatrice|ordinateur|supports?"),
        ("ASSESSMENT", r"évaluation|diagnostic|positionnement|bilan"),
        ("DELIVERABLE", r"livrable|fiche|carte mentale|grille|formulaire"),
        ("ENTRY_CLASS", r"entrée en (seconde|première|terminale)|classe d.entrée"),
        ("LEVEL_LABEL", r"maths eds|hors eds|eaf|voie générale|voie technologique|maths expertes|maths complémentaires"),
        ("SUBJECT", r"mathématiques|français|physique.?chimie|\bnsi\b|\bsnt\b|informatique"),
        ("PROGRAM", r"programme|séance|objectif|notions|méthode|film"),
    )
    for claim_type, pattern in patterns:
        if re.search(pattern, value, re.IGNORECASE):
            return claim_type
    if "programme" in document.casefold():
        return "PROGRAM"
    return "OTHER"


def _canonical_mapping(claim_type: str, snapshot: dict[str, Any]) -> tuple[str, Any]:
    campaign_source = "data/campaigns/pre-rentree-2026.json"
    mappings: dict[str, tuple[str, Any]] = {
        "DATE": (campaign_source, {
            "startDate": snapshot["campaign"]["startDate"],
            "endDate": snapshot["campaign"]["endDate"],
            "decisionDeadline": snapshot["campaign"]["decisionDeadline"],
        }),
        "ENTRY_CLASS": (campaign_source, snapshot["levels"]),
        "SUBJECT": (campaign_source, snapshot["subjects"]),
        "LEVEL_LABEL": (campaign_source, snapshot["academicProfiles"]),
        "SCHEDULE_SLOT": (campaign_source, snapshot["blocks"]),
        "ROOM": (campaign_source, ["Salle 1", "Salle 2"]),
        "CAPACITY": (campaign_source, snapshot["campaign"]["capacity"]),
        "PRICE": ("data/pricing.canonical.json", snapshot["packs"]),
        "DEPOSIT": ("data/pricing.canonical.json", {"label": snapshot["labels"]["deposit"], "packs": snapshot["packs"]}),
        "BALANCE": ("data/pricing.canonical.json", {"label": snapshot["labels"]["balance"], "packs": snapshot["packs"]}),
        "PROGRAM": ("content/pre-rentree-2026/modules.json", snapshot["modules"]),
        "DELIVERABLE": ("content/pre-rentree-2026/modules.json", snapshot["modules"]),
        "ASSESSMENT": ("content/pre-rentree-2026/modules.json + data/campaigns/pre-rentree-2026.json", snapshot["content"]["method"]),
        "MATERIAL": (campaign_source, snapshot["content"]["practical"]),
        "PRE_REGISTRATION": (campaign_source, snapshot["content"]["practical"]),
        "CTA": ("OWNER_MISSION + data/campaigns/pre-rentree-2026.json", snapshot["cta"]),
        "TEACHER_QUALIFICATION": ("NONE", None),
        "REFUND": (snapshot["legal"]["commercialTermsPath"], None),
        "REPORT": (snapshot["legal"]["commercialTermsPath"], None),
        "ABSENCE": (snapshot["legal"]["commercialTermsPath"], None),
        "CANCELLATION": (snapshot["legal"]["commercialTermsPath"], None),
        "FORCE_MAJEURE": (snapshot["legal"]["commercialTermsPath"], None),
        "TEACHER_UNAVAILABILITY": (snapshot["legal"]["commercialTermsPath"], None),
        "BALANCE_DEADLINE": (snapshot["legal"]["commercialTermsPath"], None),
        "DATA_COLLECTION": ("lib/legal.ts", None),
        "IMAGE_RIGHT": ("NONE", None),
    }
    return mappings.get(claim_type, ("STRUCTURAL_TEXT", None))


def _match_claim(line: str, claim_type: str, canonical_value: Any) -> bool | None:
    normalized = _normalize(line)
    if claim_type == "OTHER":
        return None
    if canonical_value is None:
        return False
    canonical_text = _normalize(_compact(canonical_value, limit=100_000))

    blocked = (
        r"réserver",
        r"30\s*%",
        r"reportable sur l.année suivante",
        r"déductible d.un parcours annuel",
        r"même zone tarifaire|marché",
        r"garantie",
        r"certifié|agrégé",
    )
    if any(re.search(pattern, line, re.IGNORECASE) for pattern in blocked):
        return False
    if claim_type in {"PRICE", "DEPOSIT", "BALANCE"}:
        amounts = [int(value.replace(" ", "")) for value in re.findall(r"\b\d[\d ]{1,5}\b", line)]
        packs_value = canonical_value.get("packs", []) if isinstance(canonical_value, dict) else canonical_value
        canonical_amounts = {
            number
            for pack in packs_value
            for number in (
                pack.get("price", -1),
                pack.get("deposit", -1),
                pack.get("balance", -1),
                pack.get("pricePerHour", -1),
                pack.get("totalHours", -1),
            )
        }
        meaningful = [amount for amount in amounts if amount not in {1, 2, 3, 4, 10, 20, 30, 40}]
        return bool(meaningful) and all(amount in canonical_amounts for amount in meaningful)
    if normalized and normalized in canonical_text:
        return True
    tokens = [token for token in normalized.split() if len(token) >= 4]
    if claim_type in {"SUBJECT", "ENTRY_CLASS", "LEVEL_LABEL", "MATERIAL", "ROOM", "CAPACITY"}:
        return bool(tokens) and sum(token in canonical_text for token in tokens) >= max(1, len(tokens) // 2)
    return False


def _row(document: str, page: int, line: str, snapshot: dict[str, Any]) -> dict[str, str]:
    claim_type = _claim_type(line, document)
    source, canonical_value = _canonical_mapping(claim_type, snapshot)
    match = _match_claim(line, claim_type, canonical_value)
    if match is True:
        severity, action = "NONE", "KEEP_CANONICAL"
    elif match is None:
        severity, action = "NONE", "STRUCTURAL_TEXT"
    else:
        critical_types = {
            "REFUND", "REPORT", "ABSENCE", "CANCELLATION", "FORCE_MAJEURE",
            "TEACHER_UNAVAILABILITY", "BALANCE_DEADLINE", "CTA", "TEACHER_QUALIFICATION",
            "IMAGE_RIGHT", "DATA_COLLECTION",
        }
        severity = "CRITICAL" if claim_type in critical_types else "HIGH"
        action = "REMOVE_OR_REPLACE_FROM_CANONICAL_SOURCE"
        if claim_type in {"REFUND", "REPORT", "ABSENCE", "CANCELLATION", "FORCE_MAJEURE", "TEACHER_UNAVAILABILITY", "BALANCE_DEADLINE"}:
            action = "REMOVE_UNTIL_APPROVED_LEGAL_SOURCE_EXISTS"
    return {
        "DOCUMENT": document,
        "PAGE": str(page),
        "CLAIM": line,
        "CLAIM_TYPE": claim_type,
        "CANONICAL_SOURCE": source,
        "CANONICAL_VALUE": "" if canonical_value is None else _compact(canonical_value),
        "MATCH": "n/a" if match is None else str(match).lower(),
        "SEVERITY": severity,
        "ACTION": action,
    }


def _file_record(path: Path, display_path: str, **extra: Any) -> dict[str, Any]:
    return {"path": display_path, "sha256": _sha256(path), "size": path.stat().st_size, **extra}


def build_v4_audit(repo_root: Path, v4_root: Path, snapshot_path: Path, output_dir: Path) -> AuditResult:
    repo_root = repo_root.resolve()
    v4_root = v4_root.resolve()
    snapshot_path = snapshot_path.resolve()
    output_dir = output_dir.resolve()
    pdf_paths = [v4_root / "outputs" / name for name in V4_PDF_NAMES]
    if len(pdf_paths) != 7 or not all(path.is_file() for path in pdf_paths):
        raise ValueError("Expected exactly seven v4 PDFs in the explicit v4 root")

    snapshot = _json(snapshot_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "v4-input-manifest.json"
    claim_matrix_path = output_dir / "pdf-claim-matrix.csv"
    content_diff_path = output_dir / "v4-content-diff.json"

    campaign_path = repo_root / snapshot["provenance"]["campaign"]["path"]
    modules_path = repo_root / snapshot["provenance"]["modules"]["path"]
    pricing_path = repo_root / snapshot["provenance"]["pricing"]["path"]
    legal_path = repo_root / snapshot["provenance"]["legal"]["path"]
    commercial_terms_path = repo_root / snapshot["legal"]["commercialTermsPath"]

    manifest = {
        "REPO_SHA": snapshot["sourceRepoSha"],
        "CAMPAIGN_VERSION": snapshot["provenance"]["campaign"]["version"],
        "CAMPAIGN_SOURCE_SHA256": _sha256(campaign_path),
        "MODULES_VERSION": snapshot["provenance"]["modules"]["version"],
        "MODULES_SOURCE_SHA256": _sha256(modules_path),
        "PRICING_VERSION": snapshot["provenance"]["pricing"]["version"],
        "PRICING_SOURCE_SHA256": _sha256(pricing_path),
        "LEGAL_SOURCE_STATUS": snapshot["legal"]["status"],
        "V4_ARTIFACT_COUNT": 7,
        "canonicalSources": [
            _file_record(campaign_path, "repo:data/campaigns/pre-rentree-2026.json", role="CAMPAIGN"),
            _file_record(modules_path, "repo:content/pre-rentree-2026/modules.json", role="MODULES"),
            _file_record(pricing_path, "repo:data/pricing.canonical.json", role="PRICING"),
            _file_record(legal_path, "repo:lib/legal.ts", role="LEGAL_AND_CONTACT"),
        ],
        "legalSources": [
            _file_record(legal_path, "repo:lib/legal.ts", status="PRESENT"),
            {
                "path": f"repo:{snapshot['legal']['commercialTermsPath']}",
                "status": "PRESENT" if commercial_terms_path.exists() else "MISSING",
                "sha256": _sha256(commercial_terms_path) if commercial_terms_path.exists() else None,
            },
        ],
        "logos": [
            _file_record(v4_root / "logo.png", "v4:logo.png", role="COMPACT"),
            _file_record(v4_root / "logo_slogan_nexus.png", "v4:logo_slogan_nexus.png", role="SLOGAN"),
        ],
        "v4Generators": [
            _file_record(v4_root / "outputs/generate_all_pdfs.py", "v4:outputs/generate_all_pdfs.py", role="PRIMARY_GENERATOR"),
            _file_record(v4_root / "outputs/essentiel.html", "v4:outputs/essentiel.html", role="SEPARATE_ESSENTIEL_PIPELINE"),
        ],
        "v4Pdfs": [
            _file_record(path, f"v4:outputs/{path.name}", pageCount=len(_pdf_pages(path)))
            for path in pdf_paths
        ],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rows: list[dict[str, str]] = []
    for path in pdf_paths:
        for page_number, page in enumerate(_pdf_pages(path), start=1):
            for raw_line in page.splitlines():
                line = re.sub(r"\s+", " ", raw_line).strip()
                if line:
                    rows.append(_row(path.name, page_number, line, snapshot))

    observed_types = {row["CLAIM_TYPE"] for row in rows}
    for claim_type in sorted(REQUIRED_CLAIM_TYPES - observed_types):
        source, canonical_value = _canonical_mapping(claim_type, snapshot)
        rows.append({
            "DOCUMENT": "AUDIT_COVERAGE",
            "PAGE": "0",
            "CLAIM": "ABSENT_DANS_V4",
            "CLAIM_TYPE": claim_type,
            "CANONICAL_SOURCE": source,
            "CANONICAL_VALUE": "" if canonical_value is None else _compact(canonical_value),
            "MATCH": "n/a",
            "SEVERITY": "NONE",
            "ACTION": "NO_V4_PUBLIC_CLAIM_OBSERVED",
        })

    with claim_matrix_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MATRIX_COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    mismatches = [row for row in rows if row["MATCH"] == "false"]
    diff = {
        "v4ClaimRowCount": len(rows),
        "v4MismatchCount": len(mismatches),
        "criticalMismatchCount": sum(row["SEVERITY"] == "CRITICAL" for row in mismatches),
        "actions": sorted({row["ACTION"] for row in mismatches}),
        "documents": {
            name: {
                "claimRows": sum(row["DOCUMENT"] == name for row in rows),
                "mismatches": sum(row["DOCUMENT"] == name and row["MATCH"] == "false" for row in rows),
            }
            for name in V4_PDF_NAMES
        },
    }
    content_diff_path.write_text(json.dumps(diff, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return AuditResult(manifest_path, claim_matrix_path, content_diff_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--v4-root", type=Path, required=True)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = build_v4_audit(args.repo_root, args.v4_root, args.snapshot, args.output)
    print(result.manifest_path)
    print(result.claim_matrix_path)


if __name__ == "__main__":
    main()
