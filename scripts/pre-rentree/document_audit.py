"""Evidence-backed content, accessibility, PDF, and manifest gates."""

from __future__ import annotations

import hashlib
import json
import math
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import weasyprint
from bs4 import BeautifulSoup
from PIL import Image, ImageChops, ImageDraw, ImageFont
from pypdf import PdfReader

from document_assets import decode_qr
from document_model import format_amount


BLOCKED_PUBLIC_PATTERNS = (
    ("RESERVATION_CTA", re.compile(r"\bréserver\b", re.IGNORECASE)),
    ("ANNUAL_CARRYOVER", re.compile(r"acompte reportable sur l[’']année suivante", re.IGNORECASE)),
    ("ANNUAL_DEDUCTION", re.compile(r"déductible du parcours annuel", re.IGNORECASE)),
    ("MARKET_COMPARISON", re.compile(r"même zone tarifaire que le marché", re.IGNORECASE)),
    ("FILMED_ORAL", re.compile(r"oral filmé", re.IGNORECASE)),
    ("DEPOSIT_PERCENT", re.compile(r"acompte\s*\(?(?:de\s*)?30\s*%", re.IGNORECASE)),
    ("INTERNAL_NOTE", re.compile(r"note interne|\bà valider\b", re.IGNORECASE)),
    ("DRAFT_TOKEN", re.compile(r"\bDRAFT\b")),
    ("STATUS_TOKEN", re.compile(r"PRE_REGISTRATION_OPEN")),
    ("PACK_CODE", re.compile(r"pre2026-pack-|\bPACK_[1-4]\b", re.IGNORECASE)),
    ("INTERNAL_ASSIGNMENT", re.compile(r"MATHS_NSI_SNT_TEACHER|FRENCH_TEACHER|PHYSICS_CHEMISTRY_TEACHER|salle-[12]", re.IGNORECASE)),
)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _pdf_links(reader: PdfReader) -> list[str]:
    targets: set[str] = set()
    for page in reader.pages:
        for reference in page.get("/Annots", []):
            annotation = reference.get_object()
            action = annotation.get("/A")
            if action and action.get("/URI"):
                targets.add(str(action["/URI"]))
    return sorted(targets)


def _font_identifiers(path: Path) -> list[str]:
    output = subprocess.run(["pdffonts", str(path)], check=True, capture_output=True, text=True).stdout
    lines = output.splitlines()[2:]
    return sorted({line.split()[0] for line in lines if line.split()})


def audit_pdf(path: Path, snapshot: dict[str, Any]) -> dict[str, Any]:
    path = Path(path).resolve()
    reader = PdfReader(str(path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    language = str(reader.trailer["/Root"].get("/Lang", ""))
    a4_pages = sum(
        abs(float(page.mediabox.width) - 595.276) < 1
        and abs(float(page.mediabox.height) - 841.89) < 1
        for page in reader.pages
    )
    secret_patterns = (
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"\bAKIA[0-9A-Z]{16}\b",
        r"postgres(?:ql)?://[^\s]+",
        r"\b(?:sk|ghp)_[A-Za-z0-9]{20,}\b",
    )
    pii_test_patterns = (r"test@example\.", r"\b(?:Alice|Bob) Test\b", r"\b00000000\b")
    metadata = reader.metadata
    catalog = reader.trailer["/Root"]
    mark_info = catalog.get("/MarkInfo") or {}
    tagged_pdf = bool(catalog.get("/StructTreeRoot") and mark_info.get("/Marked"))
    xmp_stream = catalog.get("/Metadata")
    xmp = ""
    if xmp_stream:
        xmp = xmp_stream.get_object().get_data().decode("utf-8", errors="replace")
    return {
        "PDF_FILE": path.name,
        "PDF_SHA256": _sha256(path),
        "PAGE_COUNT": len(reader.pages),
        "FILE_SIZE": path.stat().st_size,
        "TITLE": metadata.title or "",
        "AUTHOR": metadata.author or "",
        "LANGUAGE": language,
        "A4_PAGE_COUNT": a4_pages,
        "TEXT_EXTRACTABLE": bool(_normalized(text)),
        "TAGGED_PDF": tagged_pdf,
        "PDF_UA_IDENTIFIER_PRESENT": "pdfuaid:part" in xmp,
        "BROKEN_GLYPH_COUNT": text.count("\ufffd"),
        "FONT_IDENTIFIERS": _font_identifiers(path),
        "LINK_TARGETS": _pdf_links(reader),
        "SECRET_FINDING_COUNT": sum(bool(re.search(pattern, text)) for pattern in secret_patterns),
        "PII_TEST_FINDING_COUNT": sum(bool(re.search(pattern, text, re.IGNORECASE)) for pattern in pii_test_patterns),
        "DOCUMENT_EDITION_DATE": snapshot["document"]["documentEditionDate"],
        "DOCUMENT_VERSION": snapshot["document"]["documentPackageVersion"],
        "PUBLIC_OR_PRIVATE": snapshot["document"]["publicClassification"],
    }


def audit_html_accessibility(path: Path) -> list[str]:
    soup = BeautifulSoup(Path(path).read_text(encoding="utf-8"), "html.parser")
    issues: list[str] = []
    if not soup.html or soup.html.get("lang") != "fr":
        issues.append("HTML_LANG_NOT_FR")
    if len(soup.find_all("h1")) != 1:
        issues.append("H1_COUNT_NOT_ONE")
    heading_levels = [int(node.name[1]) for node in soup.find_all(re.compile(r"^h[1-6]$"))]
    for previous, current in zip(heading_levels, heading_levels[1:]):
        if current > previous + 1:
            issues.append("HEADING_LEVEL_SKIPPED")
            break
    for index, table in enumerate(soup.find_all("table"), start=1):
        if not table.find("th", scope="col") and not table.find("th", scope="row"):
            issues.append(f"TABLE_{index}_WITHOUT_SCOPED_HEADER")
    for index, image in enumerate(soup.find_all("img"), start=1):
        if not image.get("alt", "").strip():
            issues.append(f"IMAGE_{index}_WITHOUT_ALT")
    for index, link in enumerate(soup.find_all("a", href=True), start=1):
        parsed = urlparse(link["href"])
        if parsed.scheme not in {"https", "mailto", "tel"} and not link["href"].startswith("#"):
            issues.append(f"LINK_{index}_UNSUPPORTED_SCHEME")
        if not link.get_text(" ", strip=True):
            issues.append(f"LINK_{index}_WITHOUT_TEXT")
    return issues


def _relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (0, 2, 4)]
    linear = [
        value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def _contrast_ratio(first: str, second: str) -> float:
    values = sorted((_relative_luminance(first), _relative_luminance(second)), reverse=True)
    return (values[0] + 0.05) / (values[1] + 0.05)


def audit_stylesheet_accessibility(path: Path) -> dict[str, Any]:
    text = Path(path).read_text(encoding="utf-8")
    colors = {
        name: value
        for name, value in re.findall(r"--([a-z-]+):\s*#([0-9a-fA-F]{6})", text)
    }
    text_color_names = ("navy", "ink", "muted", "maths", "francais", "nsi", "pc")
    contrast_records = [
        {
            "COLOR_TOKEN": name,
            "FOREGROUND": f"#{colors[name]}",
            "BACKGROUND": "#FFFFFF",
            "CONTRAST_RATIO": round(_contrast_ratio(colors[name], "FFFFFF"), 3),
            "WCAG_AA_NORMAL_TEXT": _contrast_ratio(colors[name], "FFFFFF") >= 4.5,
        }
        for name in text_color_names
        if name in colors
    ]
    point_sizes = [float(value) for value in re.findall(r"font-size:\s*([0-9.]+)pt", text)]
    minimum_size = min(point_sizes) if point_sizes else 0
    return {
        "CONTRAST_CHECKS": contrast_records,
        "CONTRAST_FAILURE_COUNT": sum(not record["WCAG_AA_NORMAL_TEXT"] for record in contrast_records),
        "MINIMUM_DECLARED_FONT_SIZE_PT": minimum_size,
        "MINIMUM_FONT_THRESHOLD_PT": 8,
        "MINIMUM_FONT_SIZE_PASS": minimum_size >= 8,
        "FOCUS_INDICATOR_PRESENT": ":focus-visible" in text,
        "PRINT_AND_SCREEN_STYLES_PRESENT": "@media print" in text and "@media screen" in text,
    }


def audit_social_visuals(snapshot: dict[str, Any], social_root: Path) -> dict[str, Any]:
    social_root = Path(social_root).resolve()
    names = snapshot["document"]["outputs"]["social"]
    expected_sizes = {"feed": (1080, 1350), "story": (1080, 1920), "monochrome": (1080, 1350)}
    evidence: list[dict[str, Any]] = []
    defects: list[dict[str, Any]] = []
    for key, expected_size in expected_sizes.items():
        path = social_root / names[key]
        if not path.is_file():
            defects.append({"CODE": "MISSING_SOCIAL_IMAGE", "IMAGE_KEY": key})
            continue
        with Image.open(path) as source:
            image = source.convert("RGB")
        content = image.convert("L").crop((0, 50, image.width, image.height))
        ink_box = content.point(lambda pixel: 255 if pixel < 100 else 0).getbbox()
        record = {
            "IMAGE_KEY": key,
            "IMAGE_FILE": path.name,
            "SHA256": _sha256(path),
            "WIDTH": image.width,
            "HEIGHT": image.height,
            "DARK_INK_BOUNDING_BOX": list(ink_box) if ink_box else None,
        }
        evidence.append(record)
        if image.size != expected_size:
            defects.append({"CODE": "SOCIAL_IMAGE_DIMENSION_MISMATCH", **record})
        if ink_box is None:
            defects.append({"CODE": "SOCIAL_IMAGE_WITHOUT_DARK_CONTENT", **record})
        elif ink_box[0] < 24 or ink_box[2] > image.width - 24:
            defects.append({"CODE": "SOCIAL_TEXT_OR_LOGO_EDGE_CLIPPED", **record})
        if key == "monochrome":
            red, green, blue = image.split()
            if ImageChops.difference(red, green).getbbox() or ImageChops.difference(red, blue).getbbox():
                defects.append({"CODE": "MONOCHROME_VARIANT_CONTAINS_COLOR", **record})

    alt_path = social_root / names["altText"]
    alt = json.loads(alt_path.read_text(encoding="utf-8")) if alt_path.is_file() else {}
    if set(alt) != set(expected_sizes) or any(not str(value).strip() for value in alt.values()):
        defects.append({"CODE": "SOCIAL_ALT_TEXT_INCOMPLETE", "ALT_TEXT_FILE": names["altText"]})
    return {
        "IMAGE_EVIDENCE": evidence,
        "ALT_TEXT_FILE": names["altText"],
        "AUTOMATED_DEFECTS": defects,
        "SOCIAL_VISUAL_DEFECT_COUNT": len(defects),
        "MANUAL_SOCIAL_REVIEW_REQUIRED": True,
    }


def _public_text_files(root: Path):
    for html_path in sorted(root.rglob("*.html")):
        soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
        yield html_path, soup.get_text(" ")
    for pdf in sorted(root.glob("*.pdf")):
        reader = PdfReader(str(pdf))
        yield pdf, "\n".join(page.extract_text() or "" for page in reader.pages)


def scan_blocked_public_terms(public_root: Path) -> list[dict[str, str]]:
    findings = []
    for item in _public_text_files(Path(public_root)):
        if isinstance(item, tuple):
            path, text = item
        else:
            path, text = item, item.read_text(encoding="utf-8")
        for code, pattern in BLOCKED_PUBLIC_PATTERNS:
            if match := pattern.search(text):
                findings.append({"file": path.name, "code": code, "match": match.group(0)})
    return findings


def _json_pointer_exists(document: Any, pointer: str) -> bool:
    if not pointer.startswith("/"):
        return False
    current = document
    for raw_part in pointer.lstrip("/").split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list) and part.isdigit() and int(part) < len(current):
            current = current[int(part)]
        else:
            return False
    return True


def _hardcoded_business_findings(
    snapshot: dict[str, Any], script_dir: Path,
) -> list[dict[str, str]]:
    sources = [
        script_dir / "document_model.py",
        script_dir / "document_templates.py",
        script_dir / "document_assets.py",
        script_dir / "document_renderer.py",
    ]
    findings: list[dict[str, str]] = []

    price_values = {
        str(value)
        for pack in snapshot["packs"]
        for value in (pack["price"], pack["deposit"], pack["balance"], pack["pricePerHour"])
        if value >= 100
    }
    campaign_values = {
        snapshot["campaign"]["startDate"],
        snapshot["campaign"]["endDate"],
        *snapshot["campaign"]["noClassDates"],
        snapshot["campaign"]["decisionDeadline"],
        snapshot["contact"]["phone"],
        snapshot["contact"]["phoneRaw"],
        snapshot["contact"]["email"],
        snapshot["contact"]["canonicalUrl"],
    }
    schedule_values = {
        value
        for session in snapshot["schedule"]["sessions"]
        for value in (session["date"], session["startTime"], session["endTime"])
    }
    program_values = {
        value
        for module in snapshot["modules"]
        for value in (
            module["id"],
            module["title"],
            module["subtitle"],
            *(
                session_value
                for session in module["sessions"]
                for session_value in (
                    session["title"], session["objective"], session["deliverable"],
                    *session["topics"],
                )
            ),
        )
    }

    def record_literals(source: Path, text: str, category: str, values: set[str]) -> None:
        for value in sorted(values):
            if value and value in text:
                findings.append({"file": source.name, "category": category, "match": value})

    for source in sources:
        text = source.read_text(encoding="utf-8")
        if source.name != "document_assets.py":
            record_literals(source, text, "PRICE", price_values)
        record_literals(source, text, "CAMPAIGN", campaign_values)
        record_literals(source, text, "SCHEDULE_SLOT", schedule_values)
        record_literals(source, text, "PROGRAM_SESSION", program_values)
    return findings


def build_content_gate_report(
    snapshot: dict[str, Any], package_root: Path, script_dir: Path,
) -> dict[str, Any]:
    package_root = Path(package_root).resolve()
    html_dir = package_root / "PUBLIC/HTML"
    names = snapshot["document"]["outputs"]["publicHtml"]
    html_text = {
        key: BeautifulSoup((html_dir / filename).read_text(encoding="utf-8"), "html.parser").get_text(" ")
        for key, filename in names.items()
    }
    html_soup = {
        key: BeautifulSoup((html_dir / filename).read_text(encoding="utf-8"), "html.parser")
        for key, filename in names.items()
    }
    module_id_mismatches = 0
    module_metadata_mismatches = 0
    session_title_mismatches = 0
    session_objective_mismatches = 0
    session_topic_mismatches = 0
    session_method_mismatches = 0
    session_deliverable_mismatches = 0
    level_to_key = {
        "SECONDE": "programSeconde",
        "PREMIERE": "programPremiere",
        "TERMINALE": "programTerminale",
    }
    for module in snapshot["modules"]:
        soup = html_soup[level_to_key[module["level"]]]
        article = soup.select_one(f'[data-module-id="{module["id"]}"]')
        if article is None:
            module_id_mismatches += 1
            module_metadata_mismatches += 5
            session_title_mismatches += len(module["sessions"])
            session_objective_mismatches += len(module["sessions"])
            session_topic_mismatches += sum(len(session["topics"]) for session in module["sessions"])
            session_method_mismatches += len(module["sessions"])
            session_deliverable_mismatches += len(module["sessions"])
            continue
        text = _normalized(article.get_text(" "))
        module_metadata_mismatches += sum(
            _normalized(value) not in text
            for value in (
            module["title"], module["subtitle"], module["prerequisites"],
            module["differentiation"], module["quickAssessment"],
            )
        )
        for session in module["sessions"]:
            session_title_mismatches += _normalized(session["title"]) not in text
            session_objective_mismatches += _normalized(session["objective"]) not in text
            session_topic_mismatches += sum(_normalized(topic) not in text for topic in session["topics"])
            session_method_mismatches += _normalized(session["method"]) not in text
            session_deliverable_mismatches += _normalized(session["deliverable"]) not in text

    module_mismatches = sum((
        module_id_mismatches,
        module_metadata_mismatches,
        session_title_mismatches,
        session_objective_mismatches,
        session_topic_mismatches,
        session_method_mismatches,
        session_deliverable_mismatches,
    ))

    pricing_text = html_text["pricing"]
    price_mismatches = sum(
        format_amount(value) not in pricing_text
        for pack in snapshot["packs"]
        for value in (pack["price"], pack["deposit"], pack["balance"], pack["pricePerHour"])
    )
    planning_text = _normalized(html_text["planning"])
    schedule_mismatches = sum(
        any(_normalized(value) not in planning_text for value in (
            week["label"], slot["subjectLabel"], slot["startTime"], slot["endTime"], slot["roomLabel"],
        ))
        for week in snapshot["schedule"]["weeks"]
        for slot in week["slots"]
    )
    contact_mismatches = sum(
        any(value not in text for value in (
            snapshot["contact"]["phone"], snapshot["contact"]["email"], snapshot["contact"]["domain"],
        ))
        for text in html_text.values()
    )
    approved_claim_ids = {claim["id"] for claim in snapshot["approvedPublicClaims"]}
    rendered_claim_ids = {
        node["data-claim-id"]
        for soup in html_soup.values()
        for node in soup.select("[data-claim-id]")
    }
    unknown_claims = rendered_claim_ids - approved_claim_ids
    rendered_source_paths = {
        pointer
        for soup in html_soup.values()
        for node in soup.select("[data-source-path]")
        for pointer in node["data-source-path"].split()
    }
    invalid_source_paths = {
        pointer for pointer in rendered_source_paths if not _json_pointer_exists(snapshot, pointer)
    }
    unmapped_claim_count = len(unknown_claims) + len(invalid_source_paths)
    blocked = scan_blocked_public_terms(package_root / "PUBLIC")
    contractual_codes = {
        "ANNUAL_CARRYOVER", "ANNUAL_DEDUCTION", "MARKET_COMPARISON", "DEPOSIT_PERCENT",
    }
    qr_path = package_root / "PUBLIC/ASSETS/qr-canonical.png"
    qr_mismatch = int(not qr_path.is_file() or decode_qr(qr_path) != snapshot["document"]["qrTarget"])
    qr_mismatch += int(snapshot["contact"]["canonicalUrl"] not in html_text["essential"])

    hardcoded_findings = _hardcoded_business_findings(snapshot, Path(script_dir))
    hardcoded_counts = {
        category: sum(item["category"] == category for item in hardcoded_findings)
        for category in ("CAMPAIGN", "PRICE", "SCHEDULE_SLOT", "PROGRAM_SESSION")
    }
    report = {
        "MODULE_COUNT": len(snapshot["modules"]),
        "SESSION_COUNT": sum(len(module["sessions"]) for module in snapshot["modules"]),
        "PUBLIC_CLAIM_WITHOUT_SOURCE_COUNT": unmapped_claim_count,
        "UNMAPPED_PUBLIC_CLAIM_COUNT": unmapped_claim_count,
        "RENDERED_CLAIM_ID_COUNT": len(rendered_claim_ids),
        "RENDERED_CANONICAL_POINTER_COUNT": len(rendered_source_paths),
        "INVALID_CANONICAL_POINTERS": sorted(invalid_source_paths),
        "MODULE_SESSION_MISMATCH_COUNT": module_mismatches,
        "MODULE_ID_MISMATCH_COUNT": module_id_mismatches,
        "SESSION_TITLE_MISMATCH_COUNT": session_title_mismatches,
        "SESSION_OBJECTIVE_MISMATCH_COUNT": session_objective_mismatches,
        "SESSION_TOPIC_MISMATCH_COUNT": session_topic_mismatches,
        "SESSION_DELIVERABLE_MISMATCH_COUNT": session_deliverable_mismatches,
        "PRICE_MISMATCH_COUNT": price_mismatches,
        "SCHEDULE_MISMATCH_COUNT": schedule_mismatches,
        "CONTACT_MISMATCH_COUNT": contact_mismatches,
        "LEGAL_POLICY_CONFLICT_COUNT": len(blocked),
        "HARDCODED_BUSINESS_VALUE_COUNT": len(hardcoded_findings),
        "HARDCODED_CAMPAIGN_VALUE_COUNT": hardcoded_counts["CAMPAIGN"],
        "HARDCODED_PRICE_COUNT": hardcoded_counts["PRICE"],
        "HARDCODED_SCHEDULE_SLOT_COUNT": hardcoded_counts["SCHEDULE_SLOT"],
        "HARDCODED_PROGRAM_SESSION_COUNT": hardcoded_counts["PROGRAM_SESSION"],
        "DEPOSIT_LABEL_MISMATCH_COUNT": sum("Acompte (30 %)" in text for text in html_text.values()),
        "UNAPPROVED_CONTRACTUAL_CLAIM_COUNT": sum(item["code"] in contractual_codes for item in blocked),
        "QR_LINK_MISMATCH_COUNT": qr_mismatch,
        "CONTRACTUAL_DOSSIER_PUBLICATION_BLOCKED": snapshot["legal"]["contractualDossierPublicationBlocked"],
        "blockedTermFindings": blocked,
        "hardcodedBusinessFindings": hardcoded_findings,
    }
    for index, pack in enumerate(snapshot["packs"], start=1):
        report[f"PRICE_{index}"] = pack["price"]
        report[f"DEPOSIT_{index}"] = pack["deposit"]
        report[f"BALANCE_{index}"] = pack["balance"]
        report[f"PRICE_PER_HOUR_{index}"] = pack["pricePerHour"]
    return report


def build_document_manifest(
    snapshot: dict[str, Any],
    package_root: Path,
    output_path: Path,
    snapshot_path: Path | None = None,
    generator_path: Path | None = None,
) -> dict[str, Any]:
    package_root = Path(package_root).resolve()
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parents[1]
    snapshot_path = Path(snapshot_path or repo_root / "generated/pre-rentree-2026/publication.snapshot.json").resolve()
    generator_path = Path(generator_path or script_dir / "generate_documents.py").resolve()
    if not generator_path.is_file():
        generator_path = script_dir / "document_renderer.py"
    pdf_records = [
        audit_pdf(package_root / "PUBLIC" / filename, snapshot)
        for filename in snapshot["document"]["outputs"]["publicPdf"].values()
    ]
    tool_versions = {
        "WEASYPRINT_VERSION": weasyprint.__version__,
        "QPDF_VERSION": subprocess.run(["qpdf", "--version"], check=True, capture_output=True, text=True).stdout.splitlines()[0],
    }
    manifest = {
        "REPO_SHA": subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, check=True, capture_output=True, text=True,
        ).stdout.strip(),
        "SOURCE_REPO_SHA": snapshot["sourceRepoSha"],
        "SNAPSHOT_SHA256": _sha256(snapshot_path),
        "GENERATOR_SHA256": _sha256(generator_path),
        "FONT_IDENTIFIERS": sorted({font for record in pdf_records for font in record["FONT_IDENTIFIERS"]}),
        **tool_versions,
        "QR_TARGET": snapshot["document"]["qrTarget"],
        "SOURCE_COMMIT_DATE": snapshot["sourceCommitDate"],
        "SNAPSHOT_BUILT_AT": snapshot["snapshotBuiltAt"],
        "DOCUMENT_EDITION_DATE": snapshot["document"]["documentEditionDate"],
        "DOCUMENTS_BUILT_AT": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "AUTOMATED_VISUAL_AUDIT_AT": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ASSISTANT_VISUAL_REVIEW_AT": None,
        "OWNER_REVIEWED_AT": snapshot["reviews"]["ownerReviewedAt"],
        "LEGAL_REVIEWED_AT": snapshot["reviews"]["legalReviewedAt"],
        "PRIVACY_REVIEWED_AT": snapshot["reviews"]["privacyReviewedAt"],
        "DOCUMENT_VERSION": snapshot["document"]["documentPackageVersion"],
        "PDF_FILES": pdf_records,
        "ALL_PDF_SHA256_RECORDED": len(pdf_records) == len(snapshot["document"]["outputs"]["publicPdf"]) and all(record["PDF_SHA256"] for record in pdf_records),
    }
    manifest["CREATED_AT"] = manifest["DOCUMENTS_BUILT_AT"]
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_name(f".{output_path.name}.tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output_path)
    return manifest


def _rasterize_pdf(pdf_path: Path, destination: Path, dpi: int) -> list[Path]:
    destination.mkdir(parents=True, exist_ok=True)
    prefix = destination / pdf_path.stem
    subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-r",
            str(dpi),
            str(pdf_path),
            str(prefix),
        ],
        check=True,
        capture_output=True,
    )
    pages = sorted(destination.glob(f"{pdf_path.stem}-*.png"))
    if not pages:
        raise ValueError(f"No raster page produced for {pdf_path.name}")
    return pages


def _ink_geometry(path: Path) -> dict[str, Any]:
    with Image.open(path) as source:
        image = source.convert("RGB")
        grayscale = image.convert("L")
        dark_mask = grayscale.point(lambda value: 255 if value < 235 else 0)
        bbox = dark_mask.getbbox()
        histogram = dark_mask.histogram()
        dark_pixels = histogram[255]
        total_pixels = image.width * image.height
        footer_top = int(image.height * 0.91)
        footer_band = dark_mask.crop((0, footer_top, image.width, image.height))
        footer_ink = footer_band.histogram()[255]
        edge = max(2, round(min(image.size) * 0.0025))
        edge_regions = (
            dark_mask.crop((0, 0, image.width, edge)),
            dark_mask.crop((0, image.height - edge, image.width, image.height)),
            dark_mask.crop((0, 0, edge, image.height)),
            dark_mask.crop((image.width - edge, 0, image.width, image.height)),
        )
        edge_ink = sum(region.histogram()[255] for region in edge_regions)
        return {
            "WIDTH": image.width,
            "HEIGHT": image.height,
            "INK_BOUNDING_BOX": list(bbox) if bbox else None,
            "DARK_PIXEL_RATIO": round(dark_pixels / total_pixels, 8),
            "FOOTER_INK_PIXEL_COUNT": footer_ink,
            "EDGE_INK_PIXEL_COUNT": edge_ink,
            "BLANK_PAGE_SCORE": round(1 - (dark_pixels / total_pixels), 8),
        }


def _thumbnail(path: Path, size: tuple[int, int]) -> Image.Image:
    with Image.open(path) as source:
        image = source.convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "white")
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return canvas


def _contact_sheet(
    entries: list[tuple[str, Path]], destination: Path, columns: int = 4,
) -> Path:
    thumb_size = (248, 350)
    label_height = 42
    gap = 12
    rows = max(1, math.ceil(len(entries) / columns))
    sheet = Image.new(
        "RGB",
        (
            columns * (thumb_size[0] + gap) + gap,
            rows * (thumb_size[1] + label_height + gap) + gap,
        ),
        "#e8e8e8",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, (label, path) in enumerate(entries):
        row, column = divmod(index, columns)
        left = gap + column * (thumb_size[0] + gap)
        top = gap + row * (thumb_size[1] + label_height + gap)
        sheet.paste(_thumbnail(path, thumb_size), (left, top))
        draw.multiline_text(
            (left, top + thumb_size[1] + 4),
            label[:74],
            fill="black",
            font=font,
            spacing=2,
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, format="PNG", optimize=False, compress_level=9)
    return destination


def build_visual_qa(
    snapshot: dict[str, Any],
    public_root: Path,
    output_root: Path,
    dpi: int = 200,
) -> dict[str, Any]:
    """Rasterize every public page and build deterministic visual evidence.

    Automated findings are deliberately conservative. Subjective polish remains a
    mandatory page-by-page owner review recorded separately from defect counters.
    """

    if dpi < 72:
        raise ValueError("Visual QA requires at least 72 DPI")
    public_root = Path(public_root).resolve()
    output_root = Path(output_root).resolve()
    raster_root = output_root / "RASTERS_200_DPI"
    output_root.mkdir(parents=True, exist_ok=True)

    evidence: list[dict[str, Any]] = []
    contact_entries: list[tuple[str, Path]] = []
    defects: list[dict[str, Any]] = []
    for key, filename in snapshot["document"]["outputs"]["publicPdf"].items():
        pdf_path = public_root / filename
        if not pdf_path.is_file():
            raise FileNotFoundError(f"Missing public PDF for visual QA: {pdf_path}")
        reader = PdfReader(str(pdf_path))
        raster_pages = _rasterize_pdf(pdf_path, raster_root / key, dpi)
        if len(raster_pages) != len(reader.pages):
            defects.append({
                "CODE": "RASTER_PAGE_COUNT_MISMATCH",
                "PDF_FILE": filename,
                "EXPECTED": len(reader.pages),
                "ACTUAL": len(raster_pages),
            })
        for page_number, image_path in enumerate(raster_pages, start=1):
            geometry = _ink_geometry(image_path)
            page_text = reader.pages[page_number - 1].extract_text() or ""
            relative_path = image_path.relative_to(output_root).as_posix()
            contact_label = f"{key} · page {page_number}"
            record = {
                "PDF_FILE": filename,
                "PAGE": page_number,
                "IMAGE_PATH": relative_path,
                "SHA256": _sha256(image_path),
                "TEXT_SHA256": hashlib.sha256(_normalized(page_text).encode("utf-8")).hexdigest(),
                "CONTACT_SHEET_LABEL": contact_label,
                **geometry,
            }
            evidence.append(record)
            contact_entries.append((contact_label, image_path))
            expected_width = round(8.2677 * dpi)
            expected_height = round(11.6929 * dpi)
            if abs(geometry["WIDTH"] - expected_width) > 4 or abs(geometry["HEIGHT"] - expected_height) > 4:
                defects.append({"CODE": "UNEXPECTED_PAGE_DIMENSIONS", **record})
            if geometry["DARK_PIXEL_RATIO"] < 0.001 or not _normalized(page_text):
                defects.append({"CODE": "BLANK_OR_NON_EXTRACTABLE_PAGE", **record})
            normalized_page_text = re.sub(
                r"(?<=\w)-\s+(?=\w)",
                "-",
                _normalized(page_text),
            )
            footer_tokens = (snapshot["contact"]["phone"], snapshot["contact"]["domain"])
            if not all(token in normalized_page_text for token in footer_tokens):
                defects.append({"CODE": "MISSING_PAGE_FOOTER_METADATA", **record})
            page_counters = re.findall(
                r"(?<!\d)\d+\s+/\s+\d+(?!\d)",
                normalized_page_text,
            )
            if len(page_counters) != 1:
                defects.append({
                    "CODE": "MISSING_OR_DUPLICATE_PAGE_COUNTER",
                    "COUNTERS": page_counters,
                    **record,
                })

    contact_sheet = _contact_sheet(contact_entries, output_root / "visual-contact-sheet.png")

    report = {
        "DPI": dpi,
        "PAGE_EVIDENCE": evidence,
        "CONTACT_SHEET": contact_sheet.relative_to(output_root).as_posix(),
        "VISUAL_REPORT": "visual-qa-report.json",
        "AUTOMATED_DEFECTS": defects,
        "VISUAL_DEFECT_COUNT": len(defects),
        "AUTOMATED_VISUAL_CHECK": "PASS" if not defects else "FAIL",
        "ASSISTANT_VISUAL_REVIEW": "PENDING",
        "OWNER_VISUAL_REVIEW": "PENDING",
    }
    diff_path = output_root / report["VISUAL_REPORT"]
    diff_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report
