import hashlib
import json
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "assets" / "pedagogy" / "pre-rentree-2026" / "priority-resources"


def manifest():
    return json.loads((KIT / "manifest.json").read_text(encoding="utf-8"))


def test_priority_resource_manifest_is_complete_and_integral():
    data = manifest()
    assert data["version"] == "2026-priority-resources-v1"
    assert data["status"] == "READY_FOR_PEDAGOGICAL_REVIEW"
    assert len(data["modules"]) == 6
    assert len(data["assets"]) >= 90
    for asset in data["assets"]:
        path = KIT / asset["path"]
        assert path.is_file(), asset["path"]
        assert path.stat().st_size == asset["bytes"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]


def test_each_module_has_four_editable_sources_and_four_pdfs():
    data = manifest()
    for module in data["modules"]:
        assert set(module["documents"]) == {
            "positioningStudent",
            "positioningTeacher",
            "workbookStudent",
            "guideTeacher",
        }
        for document in module["documents"].values():
            assert (KIT / document["html"]).is_file()
            assert (KIT / document["pdf"]).is_file()
            assert document["pageCount"] >= 1


def test_priority_resource_pdfs_have_no_blank_pages_or_missing_fonts():
    for pdf_path in KIT.glob("pdf/**/*.pdf"):
        with fitz.open(pdf_path) as pdf:
            assert pdf.page_count >= 1
            assert all(len(page.get_text("text").strip()) > 120 for page in pdf), pdf_path
            fonts = {font[3] for page in pdf for font in page.get_fonts(full=True)}
            joined = " ".join(fonts).lower()
            assert "dm" in joined and "sans" in joined, pdf_path
            assert "fraunces" in joined, pdf_path


def test_priority_resource_page_renders_are_valid_pngs():
    rendered = list(KIT.glob("rendered/**/*.png"))
    assert len(rendered) >= 24
    for path in rendered:
        with Image.open(path) as image:
            assert image.format == "PNG"
            assert image.width >= 1200
            assert image.height >= 1600


def test_priority_resource_quality_report_has_no_technical_failure():
    qa = json.loads((KIT / "qa-report.json").read_text(encoding="utf-8"))
    assert qa["blankPageCount"] == 0
    assert qa["missingFontCount"] == 0
    assert qa["overflowCount"] == 0
    assert qa["missingAssetCount"] == 0
    assert qa["minimumContrastRatio"] >= 4.5
    assert qa["humanValidationPendingCount"] == 6
