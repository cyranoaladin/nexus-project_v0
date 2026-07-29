import csv
import hashlib
import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
PEDAGOGY_SCRIPTS = REPO_ROOT / "scripts/pre-rentree/pedagogy"
IMPORT_SCRIPT = PEDAGOGY_SCRIPTS / "import_pedagogy_corpus.py"
sys.path.insert(0, str(PEDAGOGY_SCRIPTS))

from classification import (
    FINAL_CLASSIFICATIONS,
    HISTORICAL_PACKAGES,
    PENDING_DEDUPLICATION,
    classify,
)
from import_pedagogy_corpus import build_inventory, write_inventory


def _tree_digest(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        if path.is_symlink():
            digest.update(os.readlink(path).encode("utf-8"))
        elif path.is_file():
            digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _make_valid_zip(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("inside.txt", "archive content")


def _make_complete_import_root(import_root: Path) -> None:
    for package_name in HISTORICAL_PACKAGES:
        package = import_root / package_name
        package.mkdir(parents=True)
        (package / "fixture.md").write_text(f"# {package_name}\n", encoding="utf-8")


def _run_import_cli(import_root: Path, output_root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(IMPORT_SCRIPT),
            "--import-root",
            str(import_root),
            "--output-root",
            str(output_root),
        ],
        capture_output=True,
        text=True,
    )


def test_classification_contract_exposes_only_the_nine_final_classes():
    assert FINAL_CLASSIFICATIONS == frozenset(
        {
            "CANONICAL_SOURCE",
            "GENERATOR",
            "VALIDATOR",
            "GENERATED_OUTPUT",
            "HISTORICAL_VERSION",
            "ARCHIVE_PACKAGE",
            "DUPLICATE_IDENTICAL",
            "CONFLICT_REVIEW_REQUIRED",
            "UNCLASSIFIED",
        }
    )
    assert PENDING_DEDUPLICATION not in FINAL_CLASSIFICATIONS


@pytest.mark.parametrize(
    ("source", "destination"),
    [
        (
            "Nexus-PreRentree-2026-positionnement-17-modules-v3/maths-entree-quatrieme.yaml",
            "content/pre-rentree-2026/pedagogy/positioning/cps/maths-entree-quatrieme.yaml",
        ),
        (
            "Nexus-PreRentree-2026-positionnement-17-modules-v3/REFERENTIEL-CANONIQUE-2026.yaml",
            "content/pre-rentree-2026/pedagogy/positioning/REFERENTIEL-CANONIQUE-2026.yaml",
        ),
        (
            "Nexus-PreRentree-2026-positionnement-17-modules-v3/SPEC-tests-positionnement-pre-stage-2026.md",
            "content/pre-rentree-2026/pedagogy/positioning/SPEC-tests-positionnement-pre-stage-2026.md",
        ),
        (
            "Nexus-PreRentree-2026-85-seances/sources/curriculum-anchors.yaml",
            "content/pre-rentree-2026/pedagogy/positioning/curriculum-anchors.yaml",
        ),
        (
            "Nexus-PreRentree-2026-85-seances/corpus/MANIFESTE-SEANCES.csv",
            "content/pre-rentree-2026/pedagogy/session-kits/MANIFESTE-SEANCES.csv",
        ),
        (
            "Nexus-PreRentree-2026-85-seances/corpus/modules/quatrieme-mathematiques/README.md",
            "content/pre-rentree-2026/pedagogy/session-kits/modules/quatrieme-mathematiques/README.md",
        ),
        (
            "Nexus-PreRentree-2026-85-seances/corpus/modules/quatrieme-mathematiques/s01-test/banques-eleve.md",
            "content/pre-rentree-2026/pedagogy/session-kits/modules/quatrieme-mathematiques/s01-test/banques-eleve.md",
        ),
    ],
)
def test_classification_proposes_actual_canonical_destinations(
    source: str, destination: str
) -> None:
    assert classify(PurePosixPath(source)).proposed_destination == destination


def test_inventory_is_deterministic_and_records_required_file_metadata(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / HISTORICAL_PACKAGES[1]
    package.mkdir(parents=True)
    source = package / "course.yaml"
    source.write_text("module: maths\n", encoding="utf-8")
    (package / "README.md").write_text("# Package\n", encoding="utf-8")

    first_output = tmp_path / "first"
    second_output = tmp_path / "second"
    first = build_inventory(import_root)
    write_inventory(first, import_root, first_output)
    second = build_inventory(import_root)
    write_inventory(second, import_root, second_output)

    for name in ("INVENTAIRE-IMPORT.csv", "INVENTAIRE-IMPORT.json", "MANIFEST-SHA256.txt"):
        assert (first_output / name).read_bytes() == (second_output / name).read_bytes()

    payload = json.loads((first_output / "INVENTAIRE-IMPORT.json").read_text(encoding="utf-8"))
    paths = [item["relative_path"] for item in payload["files"]]
    assert paths == sorted(paths)
    row = next(item for item in payload["files"] if item["relative_path"].endswith("course.yaml"))
    assert row == {
        "relative_path": f"{HISTORICAL_PACKAGES[1]}/course.yaml",
        "size_bytes": len("module: maths\n".encode()),
        "extension": ".yaml",
        "mime_type": "application/yaml",
        "sha256": hashlib.sha256(b"module: maths\n").hexdigest(),
        "top_level_package": HISTORICAL_PACKAGES[1],
        "logical_role": "POSITIONING_SOURCE",
        "proposed_destination": "content/pre-rentree-2026/pedagogy/positioning/course.yaml",
        "provisional_classification": PENDING_DEDUPLICATION,
        "is_empty": False,
        "is_hidden": False,
        "is_symlink": False,
        "is_ambiguous_name": False,
        "is_archive": False,
        "archive_integrity": "NOT_ARCHIVE",
    }
    assert payload["summary"]["directory_count"] == 2
    assert payload["summary"]["file_count"] == 2
    assert payload["summary"]["hash_count"] == 2
    assert str(import_root) not in (first_output / "INVENTAIRE-IMPORT.json").read_text(encoding="utf-8")

    with (first_output / "INVENTAIRE-IMPORT.csv").open(encoding="utf-8", newline="") as handle:
        csv_rows = list(csv.DictReader(handle))
    assert [row["relative_path"] for row in csv_rows] == paths
    assert all(row["sha256"] for row in csv_rows)
    manifest_lines = (first_output / "MANIFEST-SHA256.txt").read_text(encoding="utf-8").splitlines()
    assert len(manifest_lines) == 2
    assert manifest_lines == sorted(manifest_lines, key=lambda line: line.split("  ", 1)[1])


def test_inventory_detects_empty_hidden_symlink_ambiguous_names_and_zip_integrity(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / HISTORICAL_PACKAGES[0]
    package.mkdir(parents=True)
    (package / "empty.md").touch()
    (package / ".hidden.yaml").write_text("hidden: true\n", encoding="utf-8")
    (package / "lesson copy.md").write_text("ambiguous\n", encoding="utf-8")
    _make_valid_zip(package / "valid.zip")
    (package / "broken.zip").write_bytes(b"not a zip")
    os.symlink("empty.md", package / "lesson-link.md")

    inventory = build_inventory(import_root)
    summary = inventory["summary"]

    assert summary["directory_count"] == 2
    assert summary["file_count"] == 5
    assert summary["hash_count"] == 5
    assert summary["empty_file_count"] == 1
    assert summary["hidden_entry_count"] == 1
    assert summary["symlink_count"] == 1
    assert summary["ambiguous_name_count"] == 1
    assert summary["archive_count"] == 2
    assert summary["valid_archive_count"] == 1
    assert summary["invalid_archive_count"] == 1
    assert inventory["symlinks"] == [
        {
            "relative_path": f"{HISTORICAL_PACKAGES[0]}/lesson-link.md",
            "target": "empty.md",
            "target_is_absolute": False,
            "is_hidden": False,
            "is_ambiguous_name": False,
        }
    ]
    archives = {
        Path(item["relative_path"]).name: item["archive_integrity"]
        for item in inventory["files"]
        if item["is_archive"]
    }
    assert archives == {"broken.zip": "INVALID", "valid.zip": "VALID"}


def test_inventory_counts_empty_directories_and_marks_every_directory(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / HISTORICAL_PACKAGES[0]
    empty_directory = package / "empty-directory"
    empty_directory.mkdir(parents=True)
    (package / "non-empty-directory").mkdir()
    (package / "non-empty-directory" / "lesson.md").write_text("lesson\n", encoding="utf-8")

    inventory = build_inventory(import_root)
    directories = {item["relative_path"]: item for item in inventory["directories"]}

    assert inventory["summary"]["directory_count"] == 4
    assert inventory["summary"]["empty_directory_count"] == 1
    assert directories["."]["is_empty"] is False
    assert directories[HISTORICAL_PACKAGES[0]]["is_empty"] is False
    assert directories[f"{HISTORICAL_PACKAGES[0]}/empty-directory"]["is_empty"] is True
    assert directories[f"{HISTORICAL_PACKAGES[0]}/non-empty-directory"]["is_empty"] is False


def test_known_packages_and_python_tools_receive_explicit_roles(tmp_path: Path):
    import_root = tmp_path / "import"
    for package_name in HISTORICAL_PACKAGES:
        package = import_root / package_name
        package.mkdir(parents=True)
        (package / "generate_resources.py").write_text("print('generate')\n", encoding="utf-8")
        (package / "validate_cps.py").write_text("print('validate')\n", encoding="utf-8")

    inventory = build_inventory(import_root)
    rows = {item["relative_path"]: item for item in inventory["files"]}

    for package_name in HISTORICAL_PACKAGES:
        generator = rows[f"{package_name}/generate_resources.py"]
        validator = rows[f"{package_name}/validate_cps.py"]
        assert generator["logical_role"] == "GENERATOR"
        assert generator["provisional_classification"] == "GENERATOR"
        assert validator["logical_role"] == "VALIDATOR"
        assert validator["provisional_classification"] == "VALIDATOR"
        assert generator["top_level_package"] == package_name


def test_inventory_redacts_absolute_symlink_targets(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / HISTORICAL_PACKAGES[0]
    package.mkdir(parents=True)
    outside = tmp_path / "outside.md"
    outside.write_text("outside\n", encoding="utf-8")
    os.symlink(outside, package / "absolute-link.md")

    inventory = build_inventory(import_root)

    assert inventory["symlinks"] == [
        {
            "relative_path": f"{HISTORICAL_PACKAGES[0]}/absolute-link.md",
            "target": "<ABSOLUTE_TARGET_REDACTED>",
            "target_is_absolute": True,
            "is_hidden": False,
            "is_ambiguous_name": False,
        }
    ]
    assert str(tmp_path) not in json.dumps(inventory)


def test_cli_never_writes_inside_import_root_and_preserves_source(tmp_path: Path):
    import_root = tmp_path / "import"
    _make_complete_import_root(import_root)
    package = import_root / HISTORICAL_PACKAGES[1]
    (package / "source.yaml").write_text("id: source\n", encoding="utf-8")
    _make_valid_zip(package / "bundle.zip")
    before = _tree_digest(import_root)

    forbidden_output = import_root / "inventory"
    rejected = _run_import_cli(import_root, forbidden_output)
    assert rejected.returncode != 0
    assert "outside --import-root" in rejected.stderr
    assert not forbidden_output.exists()

    output = tmp_path / "output"
    accepted = _run_import_cli(import_root, output)
    assert accepted.returncode == 0, accepted.stderr
    assert "DIRECTORY_COUNT=5" in accepted.stdout
    assert "FILE_COUNT=6" in accepted.stdout
    assert "HASH_COUNT=6" in accepted.stdout
    assert "ZIP_VALID_COUNT=1" in accepted.stdout
    assert _tree_digest(import_root) == before


def test_write_inventory_refuses_invalid_archive(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / HISTORICAL_PACKAGES[0]
    package.mkdir(parents=True)
    (package / "broken.zip").write_bytes(b"broken")
    inventory = build_inventory(import_root)

    with pytest.raises(ValueError, match="invalid ZIP"):
        write_inventory(inventory, import_root, tmp_path / "output")


def test_write_inventory_does_not_follow_predictable_temporary_symlink(tmp_path: Path):
    import_root = tmp_path / "import"
    package = import_root / HISTORICAL_PACKAGES[1]
    package.mkdir(parents=True)
    victim = package / "source.yaml"
    victim.write_text("id: immutable\n", encoding="utf-8")
    inventory = build_inventory(import_root)
    output = tmp_path / "output"
    output.mkdir()
    os.symlink(victim, output / ".INVENTAIRE-IMPORT.csv.tmp")

    write_inventory(inventory, import_root, output)

    assert victim.read_text(encoding="utf-8") == "id: immutable\n"
    assert not (output / "INVENTAIRE-IMPORT.csv").is_symlink()
    assert (output / "INVENTAIRE-IMPORT.csv").is_file()


def test_cli_rejects_empty_import_root(tmp_path: Path):
    import_root = tmp_path / "import"
    import_root.mkdir()
    output = tmp_path / "output"

    result = _run_import_cli(import_root, output)

    assert result.returncode != 0
    assert "missing top-level packages" in result.stderr
    assert not output.exists()


def test_cli_rejects_missing_top_level_package(tmp_path: Path):
    import_root = tmp_path / "import"
    _make_complete_import_root(import_root)
    missing_package = HISTORICAL_PACKAGES[-1]
    (import_root / missing_package / "fixture.md").unlink()
    (import_root / missing_package).rmdir()
    output = tmp_path / "output"

    result = _run_import_cli(import_root, output)

    assert result.returncode != 0
    assert f"missing top-level packages: {missing_package}" in result.stderr
    assert not output.exists()


def test_cli_rejects_unexpected_top_level_entry(tmp_path: Path):
    import_root = tmp_path / "import"
    _make_complete_import_root(import_root)
    (import_root / "unexpected-package").mkdir()
    output = tmp_path / "output"

    result = _run_import_cli(import_root, output)

    assert result.returncode != 0
    assert "unexpected top-level entries: unexpected-package" in result.stderr
    assert not output.exists()


def test_cli_rejects_control_characters_but_programmatic_inventory_flags_them(tmp_path: Path):
    import_root = tmp_path / "import"
    _make_complete_import_root(import_root)
    unsafe_name = "spoofed\nmanifest.md"
    (import_root / HISTORICAL_PACKAGES[0] / unsafe_name).write_text("unsafe\n", encoding="utf-8")
    output = tmp_path / "output"

    inventory = build_inventory(import_root)
    unsafe_row = next(
        item
        for item in inventory["files"]
        if item["relative_path"].endswith(unsafe_name)
    )
    result = _run_import_cli(import_root, output)

    assert unsafe_row["is_ambiguous_name"] is True
    assert result.returncode != 0
    assert "control characters in entry names" in result.stderr
    assert not output.exists()
