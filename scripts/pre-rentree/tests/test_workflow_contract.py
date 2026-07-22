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
    assert "- main" in text
    pinned_actions = (
        "actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd",
        "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444",
        "actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1",
        "actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f",
    )
    for action in pinned_actions:
        assert action in text
    assert not any(f"actions/{name}@v" in text for name in ("checkout", "setup-node", "setup-python", "upload-artifact"))
    assert "deploy" not in text.casefold()
    assert "release" not in text.casefold()
