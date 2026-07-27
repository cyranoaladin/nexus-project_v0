import re
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
    assert "npm run pre-rentree:public-pdfs" in text
    assert "npm run pre-rentree:public-pdfs:verify" in text
    assert "tools/pdf-generator/Dockerfile" in text
    assert "nexus-pre-rentree-public-pdf:2.1.0" in text
    assert "git diff --exit-code" in text
    assert 'test -z "$(git status --short)"' in text
    assert "pre-rentree-2026-parent-package" in text
    assert "pre-rentree-2026-owner-review-package" in text
    assert "retention-days: 14" in text
    assert "github.event_name" in text and "github.ref" in text
    assert "- main" in text
    repository_sha_expression = "${{ github.event.pull_request.head.sha || github.sha }}"
    assert f"PRE_RENTREE_REPOSITORY_COMMIT_SHA: {repository_sha_expression}" in text
    assert f"ref: {repository_sha_expression}" in text
    pinned_actions = re.findall(
        r"uses:\s+(actions/(?:checkout|setup-node|upload-artifact))@([0-9a-f]{40})\s+#\s+v(\d+)\.",
        text,
    )
    assert {action for action, _, _ in pinned_actions} == {
        "actions/checkout",
        "actions/setup-node",
        "actions/upload-artifact",
    }
    assert all(int(major) >= 7 for _, _, major in pinned_actions)
    assert not any(f"actions/{name}@v" in text for name in ("checkout", "setup-node", "setup-python", "upload-artifact"))
    assert "deploy" not in text.casefold()
    assert "release" not in text.casefold()

    dockerfile = (REPO_ROOT / "tools/pdf-generator/Dockerfile").read_text(
        encoding="utf-8"
    )
    assert dockerfile.startswith("FROM node@sha256:")
    assert "\nFROM ubuntu@sha256:" in dockerfile
