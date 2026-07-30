import hashlib
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = (
    REPO_ROOT
    / "scripts"
    / "pre-rentree"
    / "pedagogy"
    / "generate_human_validation_packets.py"
)


def _tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(file for file in root.rglob("*") if file.is_file()):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _generate(output: Path) -> dict:
    subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--repo-root",
            str(REPO_ROOT),
            "--output-root",
            str(output),
        ],
        check=True,
        cwd=REPO_ROOT,
    )
    return json.loads((output / "human-validation-index.json").read_text("utf-8"))


def test_generates_hash_bound_review_packets_without_fabricated_approvals(tmp_path):
    output = tmp_path / "first"
    index = _generate(output)

    assert index["schemaVersion"] == "1.0.0"
    assert index["moduleCount"] == 17
    assert len(index["modules"]) == 17
    assert len(list(output.glob("*.review.md"))) == 17
    assert all(module["status"] == "HUMAN_VALIDATION_REQUIRED" for module in index["modules"])
    assert all(module["pedagogicalOwner"] is None for module in index["modules"])
    assert all(module["subjectTeacher"] is None for module in index["modules"])
    assert all(module["decision"] is None for module in index["modules"])
    assert all(module["reviewedAt"] is None for module in index["modules"])
    assert all(module["validatedHash"] is None for module in index["modules"])
    assert all(module["definitionSha256"].startswith("sha256:") for module in index["modules"])
    assert all(module["sessions"] == 5 for module in index["modules"])
    assert all(module["items"] == 24 for module in index["modules"])
    assert all(
        "OFFICIAL_SOURCES_NOT_CITED" in module["blockers"]
        for module in index["modules"]
    )
    assert not any(
        module["level"] == "SECONDE" and module["subject"] == "PHYSIQUE_CHIMIE"
        for module in index["modules"]
    )


def test_review_packets_are_reproducible(tmp_path):
    first = tmp_path / "first"
    second = tmp_path / "second"
    _generate(first)
    _generate(second)

    assert _tree_hash(first) == _tree_hash(second)
