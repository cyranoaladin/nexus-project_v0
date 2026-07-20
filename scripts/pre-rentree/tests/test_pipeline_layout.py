from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = REPO_ROOT / "scripts/pre-rentree"
SCHEMA_DIR = SCRIPT_DIR / "schemas"


def test_document_contract_schemas_are_closed_and_centralized() -> None:
    expected = {
        "publication-snapshot.schema.json",
        "owner-approval.schema.json",
        "review-manifest.schema.json",
    }

    assert {path.name for path in SCHEMA_DIR.glob("*.json")} == expected
    for filename in expected:
        schema = json.loads((SCHEMA_DIR / filename).read_text(encoding="utf-8"))
        open_objects: list[str] = []

        def visit(value: object, path: str) -> None:
            if not isinstance(value, dict):
                return
            if value.get("type") == "object" and "properties" in value:
                if value.get("additionalProperties") is not False:
                    open_objects.append(path)
            for key, child in value.items():
                visit(child, f"{path}/{key}")

        visit(schema, "")
        assert open_objects == [], (filename, open_objects)


def test_release_entrypoints_are_explicit_cli_programs() -> None:
    for filename in (
        "generate_documents.py",
        "package_documents.py",
        "verify_release.py",
        "verify_reproducibility.py",
        "verify_repository_hygiene.py",
    ):
        result = subprocess.run(
            [sys.executable, str(SCRIPT_DIR / filename), "--help"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert "usage:" in result.stdout.lower()
