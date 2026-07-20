import shutil
import sys
from pathlib import Path

import pytest
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_assets import generate_qr, prepare_assets  # noqa: E402
from document_audit import build_visual_qa  # noqa: E402
from document_model import load_snapshot  # noqa: E402
from document_renderer import render_public_pdfs, write_public_html  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
V4_ROOT = REPO_ROOT.parent / "outputs"
SNAPSHOT = load_snapshot(
    REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json",
    REPO_ROOT / "scripts/pre-rentree/schemas/publication-snapshot.schema.json",
)


@pytest.fixture(scope="module")
def rendered_package(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("visual-audit-package")
    assets = root / "SOURCES/ASSETS"
    css = root / "SOURCES/CSS"
    html = root / "PUBLIC/HTML"
    prepare_assets(SNAPSHOT, REPO_ROOT, assets)
    generate_qr(SNAPSHOT, assets)
    css.mkdir(parents=True)
    shutil.copyfile(SCRIPT_DIR / "templates/document.css", css / "document.css")
    write_public_html(SNAPSHOT, html)
    render_public_pdfs(SNAPSHOT, html, root / "PUBLIC")
    return root


def test_generates_200_dpi_page_checksums_contact_sheet_and_v4_comparison(
    rendered_package: Path, tmp_path: Path,
):
    report = build_visual_qa(
        SNAPSHOT,
        rendered_package / "PUBLIC",
        V4_ROOT,
        tmp_path,
        dpi=200,
    )

    assert report["DPI"] == 200
    assert report["PAGE_EVIDENCE"]
    assert all(len(page["SHA256"]) == 64 for page in report["PAGE_EVIDENCE"])
    assert all((tmp_path / page["IMAGE_PATH"]).is_file() for page in report["PAGE_EVIDENCE"])
    assert all(page["WIDTH"] > 1600 and page["HEIGHT"] > 2300 for page in report["PAGE_EVIDENCE"])
    assert all(page["CONTACT_SHEET_LABEL"] and len(page["CONTACT_SHEET_LABEL"]) < 48 for page in report["PAGE_EVIDENCE"])
    assert (tmp_path / report["CONTACT_SHEET"]).is_file()
    assert (tmp_path / report["V4_V5_COMPARISON_SHEET"]).is_file()
    assert (tmp_path / report["VISUAL_DIFF_REPORT"]).is_file()
    assert Image.open(tmp_path / report["CONTACT_SHEET"]).width > 500
    assert report["VISUAL_DEFECT_COUNT"] == 0
    assert report["MANUAL_PAGE_REVIEW_REQUIRED"] is True
