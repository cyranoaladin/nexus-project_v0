from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
PEDAGOGY_SCRIPTS = REPO_ROOT / "scripts/pre-rentree/pedagogy"
POSITIONING_GENERATOR = PEDAGOGY_SCRIPTS / "generate_positioning_resources.py"
SESSION_GENERATOR = PEDAGOGY_SCRIPTS / "generate_session_kits.py"
REPRODUCIBILITY_VERIFIER = (
    PEDAGOGY_SCRIPTS / "verify_pedagogy_reproducibility.py"
)


def _run(script: Path, repo_root: Path, output_root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(script),
            "--repo-root",
            str(repo_root),
            "--output-root",
            str(output_root),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def _tree_hashes(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def _minimal_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "checkout"
    shutil.copytree(
        REPO_ROOT / "content/pre-rentree-2026",
        repo / "content/pre-rentree-2026",
    )
    shutil.copytree(
        PEDAGOGY_SCRIPTS,
        repo / "scripts/pre-rentree/pedagogy",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    return repo


def test_generators_build_expected_resources_from_canonical_content(tmp_path: Path):
    positioning = tmp_path / "generated/positioning"
    sessions = tmp_path / "generated/session-kits"

    positioning_result = _run(POSITIONING_GENERATOR, REPO_ROOT, positioning)
    session_result = _run(SESSION_GENERATOR, REPO_ROOT, sessions)

    assert positioning_result.returncode == 0, positioning_result.stderr
    assert session_result.returncode == 0, session_result.stderr
    assert len(list((positioning / "tests-eleves").glob("*.md"))) == 17
    assert len(list((positioning / "corrections").glob("*.md"))) == 17
    assert len(list((positioning / "pilotage-enseignant").glob("*.md"))) == 17
    assert len(list((positioning / "cartes-parent").glob("*.md"))) == 17
    assert (positioning / "MANIFESTE.csv").is_file()
    assert len(list((sessions / "modules").glob("*/CAHIER-ELEVE.md"))) == 17
    assert len(list((sessions / "modules").glob("*/GUIDE-ENSEIGNANT.md"))) == 17

    forbidden_student_markers = (
        "**réponse attendue :**",
        "**réponse correcte :**",
        "**bonne réponse :**",
        "# corrigé",
        "**barème enseignant",
        "**diagnostic attendu",
        "**justification :**",
        "correcte: true",
    )
    for path in list((positioning / "tests-eleves").glob("*.md")) + list(
        (sessions / "modules").glob("*/CAHIER-ELEVE.md")
    ):
        lowered = path.read_text(encoding="utf-8").lower()
        assert not any(marker in lowered for marker in forbidden_student_markers), path


def test_generators_are_byte_reproducible_across_clean_output_roots(tmp_path: Path):
    outputs = []
    for name in ("a", "b"):
        root = tmp_path / name
        assert _run(POSITIONING_GENERATOR, REPO_ROOT, root / "generated/positioning").returncode == 0
        assert _run(SESSION_GENERATOR, REPO_ROOT, root / "generated/session-kits").returncode == 0
        outputs.append(_tree_hashes(root))

    assert outputs[0] == outputs[1]
    assert len(outputs[0]) == 103


def test_generation_is_independent_from_historical_import(tmp_path: Path):
    repo = _minimal_repo(tmp_path)
    assert not (repo / "docs/bilans/dossiers_tests_prerentree").exists()

    positioning = _run(
        repo / "scripts/pre-rentree/pedagogy/generate_positioning_resources.py",
        repo,
        tmp_path / "positioning",
    )
    sessions = _run(
        repo / "scripts/pre-rentree/pedagogy/generate_session_kits.py",
        repo,
        tmp_path / "session-kits",
    )

    assert positioning.returncode == 0, positioning.stderr
    assert sessions.returncode == 0, sessions.stderr


def test_generators_fail_closed_on_missing_or_conflicting_canonical_source(tmp_path: Path):
    missing_repo = _minimal_repo(tmp_path / "missing")
    cps_path = (
        missing_repo
        / "content/pre-rentree-2026/pedagogy/positioning/cps/maths-entree-quatrieme.yaml"
    )
    cps_path.unlink()
    missing = _run(
        missing_repo / "scripts/pre-rentree/pedagogy/generate_positioning_resources.py",
        missing_repo,
        tmp_path / "missing-output",
    )
    assert missing.returncode != 0
    assert "manquante" in (missing.stderr + missing.stdout).lower()

    conflict_repo = _minimal_repo(tmp_path / "conflict")
    manifest_path = conflict_repo / "content/pre-rentree-2026/pedagogy/manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    manifest["modules"][0]["editorialStatus"] = "CONFLICT_REVIEW_REQUIRED"
    manifest_path.write_text(
        yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    conflict = _run(
        conflict_repo / "scripts/pre-rentree/pedagogy/generate_session_kits.py",
        conflict_repo,
        tmp_path / "conflict-output",
    )
    assert conflict.returncode != 0
    assert "conflict" in (conflict.stderr + conflict.stdout).lower() or "statut" in (
        conflict.stderr + conflict.stdout
    ).lower()


def test_generators_reject_in_repo_escape_and_symlink_output(tmp_path: Path):
    forbidden = REPO_ROOT / "public/generated-pedagogy-test"
    result = _run(POSITIONING_GENERATOR, REPO_ROOT, forbidden)
    assert result.returncode != 0
    assert not forbidden.exists()

    target = tmp_path / "target"
    target.mkdir()
    link = tmp_path / "output-link"
    link.symlink_to(target, target_is_directory=True)
    result = _run(SESSION_GENERATOR, REPO_ROOT, link)
    assert result.returncode != 0
    assert not list(target.iterdir())

    traversal = _run(
        POSITIONING_GENERATOR,
        REPO_ROOT,
        Path("..") / "pedagogy-path-traversal",
    )
    assert traversal.returncode != 0


def test_generators_reject_conflicting_expected_output_contract(tmp_path: Path):
    repo = _minimal_repo(tmp_path)
    manifest_path = repo / "content/pre-rentree-2026/pedagogy/manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    manifest["modules"][0]["expectedOutputs"][0] = (
        ".artifacts/pre-rentree-2026/pedagogy/generated/positioning/"
        "tests-eleves/unexpected-test.md"
    )
    manifest_path.write_text(
        yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    result = _run(
        repo / "scripts/pre-rentree/pedagogy/generate_positioning_resources.py",
        repo,
        tmp_path / "output",
    )
    assert result.returncode != 0
    assert "sorties attendues" in (result.stderr + result.stdout).lower()


def test_generator_manifests_describe_every_output(tmp_path: Path):
    positioning = tmp_path / "positioning"
    sessions = tmp_path / "sessions"
    assert _run(POSITIONING_GENERATOR, REPO_ROOT, positioning).returncode == 0
    assert _run(SESSION_GENERATOR, REPO_ROOT, sessions).returncode == 0

    positioning_manifest = list(
        __import__("csv").DictReader(
            (positioning / "MANIFESTE.csv").open(encoding="utf-8", newline="")
        )
    )
    assert len(positioning_manifest) == 17
    assert {
        "moduleId",
        "cpsSha256",
        "testSha256",
        "correctionSha256",
        "pilotageSha256",
        "carteSha256",
        "statut",
    } <= set(positioning_manifest[0])
    assert len(list((sessions / "modules").glob("*/*.md"))) == 34


def test_reproducibility_verifier_compares_two_clean_generations():
    result = subprocess.run(
        [
            sys.executable,
            str(REPRODUCIBILITY_VERIFIER),
            "--repo-root",
            str(REPO_ROOT),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert '"fileCount": 103' in result.stdout
    assert '"reproducible": true' in result.stdout
