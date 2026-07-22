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
    }
    assert expected <= set(scripts)
    assert ".artifacts/pre-rentree-2026" in scripts["pre-rentree:clean"]
    assert "generated/pre-rentree-2026/publication.snapshot.json" in scripts["pre-rentree:snapshot"]
    assert "scripts/pre-rentree/requirements.lock" not in scripts["pre-rentree:build"]
    assert "outputs-v5-canonical" not in "\n".join(scripts[name] for name in expected)
