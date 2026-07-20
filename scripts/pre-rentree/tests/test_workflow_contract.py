from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = REPO_ROOT / ".github/workflows/pre-rentree-documents.yml"


def test_document_workflow_is_read_only_reproducible_and_uploads_two_packages():
    text = WORKFLOW.read_text(encoding="utf-8")

    assert "contents: read" in text
    assert "codex/pre-rentree-2026-v5-canonical" in text
    assert "npm ci" in text
    assert "requirements.lock" in text
    assert "npm run pre-rentree:ci" in text
    assert "pre-rentree-2026-parent-package" in text
    assert "pre-rentree-2026-owner-review-package" in text
    assert "retention-days: 14" in text
    assert "github.event_name" in text and "github.ref" in text
    assert "deploy" not in text.casefold()
    assert "release" not in text.casefold()
