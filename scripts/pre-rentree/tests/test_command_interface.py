import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_package_json_exposes_complete_pre_rentree_interface():
    scripts = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]
    expected = {
        "pre-rentree:clean",
        "pre-rentree:snapshot",
        "pre-rentree:test:ts",
        "pre-rentree:test:py",
        "pre-rentree:build",
        "pre-rentree:audit",
        "pre-rentree:package",
        "pre-rentree:verify",
        "pre-rentree:ci",
        "pre-rentree:public-pdfs",
        "pre-rentree:public-pdfs:verify",
        "pre-rentree:legacy-pdfs",
    }
    assert expected <= set(scripts)
    assert ".artifacts/pre-rentree-2026" in scripts["pre-rentree:clean"]
    assert ".artifacts/pre-rentree-2026/publication.snapshot.json" in scripts["pre-rentree:snapshot"]
    assert "scripts/pre-rentree/requirements.lock" not in scripts["pre-rentree:build"]
    assert "outputs-v5-canonical" not in "\n".join(scripts[name] for name in expected)
    assert scripts["pre-rentree:legacy-pdfs"] == "npm run pre-rentree:public-pdfs"
    assert "verify_public_pdfs.py" in scripts["pre-rentree:public-pdfs:verify"]


def test_package_json_exposes_canonical_pedagogy_pipeline():
    scripts = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]
    names = {
        "pre-rentree:pedagogy:import-check",
        "pre-rentree:pedagogy:validate",
        "pre-rentree:pedagogy:build",
        "pre-rentree:pedagogy:verify",
    }
    assert names <= set(scripts)
    commands = "\n".join(scripts[name] for name in names)
    assert "scripts/pre-rentree/pedagogy/" in commands
    assert ".artifacts/pre-rentree-2026/pedagogy/" in commands
    assert "PRE_RENTREE_PEDAGOGY_IMPORT_ROOT:?" in scripts[
        "pre-rentree:pedagogy:import-check"
    ]
    assert "docs/bilans/dossiers_tests_prerentree" not in commands
    assert "PRE_RENTREE_PEDAGOGY_IMPORT_ROOT" not in scripts[
        "pre-rentree:pedagogy:validate"
    ]
    assert "PRE_RENTREE_PEDAGOGY_IMPORT_ROOT" not in scripts[
        "pre-rentree:pedagogy:verify"
    ]
    assert "verify_pedagogy_reproducibility.py" in scripts[
        "pre-rentree:pedagogy:verify"
    ]
    assert "pre-rentree:pedagogy:verify" in scripts["pre-rentree:ci"]
