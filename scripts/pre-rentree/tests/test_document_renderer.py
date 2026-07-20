import hashlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

from pypdf import PdfReader

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_assets import generate_qr, prepare_assets  # noqa: E402
from document_model import load_snapshot  # noqa: E402
from document_renderer import render_public_pdfs, write_public_html  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = load_snapshot(
    REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json",
    REPO_ROOT / "scripts/pre-rentree/schemas/publication-snapshot.schema.json",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_fixture(root: Path) -> tuple[dict[str, Path], dict[str, Path]]:
    assets_dir = root / "SOURCES/ASSETS"
    css_dir = root / "SOURCES/CSS"
    html_dir = root / "PUBLIC/HTML"
    pdf_dir = root / "PUBLIC"
    prepare_assets(SNAPSHOT, REPO_ROOT, assets_dir)
    generate_qr(SNAPSHOT, assets_dir)
    css_dir.mkdir(parents=True)
    shutil.copyfile(SCRIPT_DIR / "templates/document.css", css_dir / "document.css")
    html = write_public_html(SNAPSHOT, html_dir)
    pdf = render_public_pdfs(SNAPSHOT, html_dir, pdf_dir)
    return html, pdf


def test_renders_exact_six_html_and_pdf_output_names(tmp_path: Path):
    html, pdf = build_fixture(tmp_path)

    assert {path.name for path in html.values()} == set(SNAPSHOT["document"]["outputs"]["publicHtml"].values())
    assert {path.name for path in pdf.values()} == set(SNAPSHOT["document"]["outputs"]["publicPdf"].values())
    assert all(path.stat().st_size > 10_000 for path in pdf.values())


def test_pdf_has_a4_pages_metadata_language_fonts_links_and_extractable_text(tmp_path: Path):
    _, pdfs = build_fixture(tmp_path)
    essential = pdfs["essential"]
    reader = PdfReader(str(essential))

    assert reader.metadata.title == "Pré-rentrée — L’essentiel"
    assert reader.metadata.author == "Nexus Réussite"
    assert str(reader.trailer["/Root"].get("/Lang", "")).casefold().startswith("fr")
    assert len(reader.pages) >= 1
    for page in reader.pages:
        assert abs(float(page.mediabox.width) - 595.28) < 1
        assert abs(float(page.mediabox.height) - 841.89) < 1
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert re.sub(r"\s+", " ", SNAPSHOT["content"]["hero"]["h1"]) in re.sub(r"\s+", " ", text)
    assert SNAPSHOT["contact"]["email"] in text
    assert any("/Annots" in page for page in reader.pages)
    fonts = subprocess.run(["pdffonts", str(essential)], check=True, capture_output=True, text=True).stdout
    assert "DM" in fonts or "Nexus" in fonts
    assert "yes" in fonts.casefold()


def test_repeated_render_is_byte_deterministic(tmp_path: Path):
    first_root = tmp_path / "first"
    second_root = tmp_path / "second"
    _, first = build_fixture(first_root)
    _, second = build_fixture(second_root)

    assert {key: sha256(path) for key, path in first.items()} == {
        key: sha256(path) for key, path in second.items()
    }
