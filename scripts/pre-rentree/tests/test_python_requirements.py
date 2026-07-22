from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_pdf_inspection_dependency_is_pinned_for_clean_ci_runners():
    requirements = (REPO_ROOT / "scripts/pre-rentree/requirements.lock").read_text(encoding="utf-8").splitlines()
    assert "PyMuPDF==1.27.2.3" in requirements
