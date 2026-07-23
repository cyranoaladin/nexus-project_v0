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
    assert "pre-rentree-2026-parent-package" in text
    assert "pre-rentree-2026-owner-review-package" in text
    assert "retention-days: 14" in text
    assert "github.event_name" in text and "github.ref" in text
    assert "- main" in text
    repository_sha_expression = "${{ github.event.pull_request.head.sha || github.sha }}"
    assert f"PRE_RENTREE_REPOSITORY_COMMIT_SHA: {repository_sha_expression}" in text
    assert f"ref: {repository_sha_expression}" in text
    pinned_actions = re.findall(
        r"uses:\s+(actions/(?:checkout|setup-node|setup-python|upload-artifact))@([0-9a-f]{40})\s+#\s+v(\d+)\.",
        text,
    )
    assert {action for action, _, _ in pinned_actions} == {
        "actions/checkout",
        "actions/setup-node",
        "actions/setup-python",
        "actions/upload-artifact",
    }
    assert all(int(major) >= 7 for _, _, major in pinned_actions)
    assert not any(f"actions/{name}@v" in text for name in ("checkout", "setup-node", "setup-python", "upload-artifact"))
    assert "deploy" not in text.casefold()
    assert "release" not in text.casefold()
