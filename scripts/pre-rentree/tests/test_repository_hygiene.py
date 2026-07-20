import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from verify_repository_hygiene import audit_repository  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_repository_contains_no_tracked_document_outputs_or_duplicate_sources():
    report = audit_repository(REPO_ROOT)

    assert report["TRACKED_GENERATED_OUTPUT_COUNT"] == 0
    assert report["DUPLICATE_DOCUMENT_SOURCE_COUNT"] == 0
    assert report["TRACKED_PRIVATE_DIRECTORY_COUNT"] == 0
    assert report["PASS"] is True
