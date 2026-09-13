"""Candidate personalization stays in derived exports; examples are fictional."""
import hashlib
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

fitz = pytest.importorskip("fitz")
RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import pack_candidat as PC

RELEASE = RACINE / "release" / "diagnostics-v2"
EXPORTS = RACINE / "exports_candidats"
NAME = "Camille EXEMPLE"
OTHER_NAME = "Élise TÉMOIN"
ENTRY_INTRO = (
    "Ne recopiez pas vos coordonnées personnelles dans les réponses : "
    "l’identification du dossier figure déjà sur la couverture. "
    "Les pièces justificatives sont transmises séparément."
)
# Le dossier d'entrée nominatif est recomposé depuis la source du formulaire (voir
# test_dossier_entree_personnalise) : ses pages ne se comparent pas au canonique.
ENTRY = "DOSSIER_D_ENTREE_NEXUS.pdf"
FACTS = dict(
    profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"],
    spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"],
    eaf_due="none", candidat_id="TEST-PERSONNALISATION",
)


@pytest.fixture(scope="module", autouse=True)
def export_area():
    if not (RELEASE / "01_LIVRETS_CANDIDAT").exists():
        pytest.skip("release v2 non construite")
    EXPORTS.mkdir(exist_ok=True)


def release_hashes():
    return {str(p.relative_to(RELEASE)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in RELEASE.rglob("*") if p.is_file()}


@pytest.fixture(scope="module")
def personalized_pack():
    if not (RELEASE / "01_LIVRETS_CANDIDAT").exists():
        pytest.skip("release v2 non construite")
    EXPORTS.mkdir(exist_ok=True)
    before = release_hashes()
    with tempfile.TemporaryDirectory(prefix="test-personnalisation-", dir=EXPORTS) as tmp:
        output = PC.create_candidate_pack(**FACTS, candidat_nom=NAME, output_dir=Path(tmp))
        yield output, before
    assert release_hashes() == before


def booklet_paths(output):
    return sorted((output / "A_ENVOYER" / "livrets").glob("*.pdf"))


def canonical_for(path):
    root = RELEASE / "01_LIVRETS_CANDIDAT" / PC.DOSSIER_PROFIL["P2"]
    return next(root.rglob(path.name))


def test_all_covers_and_family_header_are_personalized(personalized_pack):
    output, _ = personalized_pack
    paths = booklet_paths(output)
    assert len(paths) == 8
    for path in paths:
        with fitz.open(path) as document:
            cover = document[0].get_text()
            assert NAME in cover, path.name
            assert "2027" in cover, path.name
            assert "SESSION FINALE" in cover
            assert "RÉFÉRENCE CANDIDAT" not in cover
            assert "selon le dossier" not in cover
    header = (output / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text()
    assert f"Candidate : {NAME}" in header
    assert "Session : 2027" in header
    assert "strictement anonymisé/pseudonymisé" not in header


def test_canonical_release_including_corrections_remains_generic(personalized_pack):
    _, before = personalized_pack
    assert before and release_hashes() == before
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z", "release/"], cwd=RACINE,
    ).decode().split("\0")
    for relative in filter(None, tracked):
        path = RACINE / relative
        if not path.is_file():
            continue
        content = path.read_bytes()
        assert NAME.encode() not in content
        assert OTHER_NAME.encode() not in content
        if path.suffix.lower() == ".pdf":
            with fitz.open(path) as document:
                for page in document:
                    assert NAME not in page.get_text()
                    assert OTHER_NAME not in page.get_text()


def test_entry_introduction_is_compatible_with_personalized_exports(personalized_pack):
    output, _ = personalized_pack
    entry = output / "A_ENVOYER" / "livrets" / "DOSSIER_D_ENTREE_NEXUS.pdf"
    def flat(text):  # composed prose may hyphenate at a line end
        return " ".join(re.sub(r"[-\u2010\u00ad]\s*\n\s*", "", text).split())

    with fitz.open(entry) as document:
        text = flat(document[1].get_text())
        assert ENTRY_INTRO in text
        assert "Aucun nom" not in text
    with fitz.open(output / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf") as document:
        text = flat("\n".join(page.get_text() for page in document))
        assert text.count(ENTRY_INTRO) == 1
        assert "Aucun nom" not in text


def test_entry_cover_identifies_internal_questionnaire(personalized_pack):
    output, _ = personalized_pack
    entry = output / "A_ENVOYER" / "livrets" / "DOSSIER_D_ENTREE_NEXUS.pdf"

    def assert_cover(text):
        for expected in ("NATURE DU DOCUMENT", "Questionnaire Nexus",
                         "CALCULATRICE", "Non nécessaire"):
            assert expected in text
        for obsolete in ("ÉPREUVE OFFICIELLE", "Contrôle continu", "Interdite"):
            assert obsolete not in text
        for preserved in (NAME, "Deuxième partie du baccalauréat", "2027", "Aucun"):
            assert preserved in text
        assert "40 min" not in text, "la durée est recalculée sur les questions posées"

    with fitz.open(entry) as document:
        entry_cover = document[0].get_text()
        assert_cover(entry_cover)
    with fitz.open(output / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf") as document:
        entry_covers = [page.get_text() for page in document
                        if "Dossier d’entrée" in page.get_text() and NAME in page.get_text()]
        assert len(entry_covers) == 1
        assert_cover(entry_covers[0])
        assert entry_covers[0] == entry_cover


def test_page_content_and_visual_design_are_preserved(personalized_pack):
    output, _ = personalized_pack
    for path in booklet_paths(output):
        if path.name == ENTRY:
            continue
        with fitz.open(canonical_for(path)) as original, fitz.open(path) as derived:
            assert len(original) == len(derived)
            for index, (before, after) in enumerate(zip(original, derived)):
                assert before.rect == after.rect
                if index:
                    assert before.get_text() == after.get_text(), (path.name, index)
                    assert before.get_pixmap(matrix=fitz.Matrix(.5, .5)).samples == after.get_pixmap(
                        matrix=fitz.Matrix(.5, .5)).samples, (path.name, index)
                else:
                    # Text extraction can prime MuPDF image caches; render both first.
                    images = []
                    for page in (before, after):
                        pixmap = page.get_pixmap()
                        images.append(Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples))
                    # Only the identity block and the session value may change.
                    masks = [fitz.Rect(49, 725, 253, 756)]
                    spans = [s for b in before.get_text("dict")["blocks"]
                             for line in b.get("lines", []) for s in line["spans"]]
                    value = next(s for s in spans if s["text"] in ("2027", "selon le dossier"))
                    masks.append(fitz.Rect(value["bbox"]) + (-2, -2, 2, 2))
                    for image in images:
                        draw = ImageDraw.Draw(image)
                        for rect in masks:
                            draw.rectangle((math.floor(rect.x0), math.floor(rect.y0),
                                            math.ceil(rect.x1), math.ceil(rect.y1)), fill="white")
                    assert images[0].tobytes() == images[1].tobytes(), path.name


def test_print_pack_uses_personalized_covers(personalized_pack):
    output, _ = personalized_pack
    paths = booklet_paths(output)
    page_count = 0
    cover_titles = []
    for path in paths:
        with fitz.open(path) as document:
            page_count += len(document)
            cover_titles.append(document[0].get_text())
    with fitz.open(output / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf") as document:
        assert len(document) == page_count
        printed_covers = [p.get_text() for p in document if NAME in p.get_text()]
        assert sorted(printed_covers) == sorted(cover_titles)


def test_another_name_gets_distinct_default_export():
    # Default exports are deterministic: the name slug, not a clock, tells them apart.
    before = release_hashes()
    outputs = []
    try:
        for name in (NAME, OTHER_NAME):
            outputs.append(PC.create_candidate_pack(**FACTS, candidat_nom=name, assemble_pdf=False))
        assert outputs[0] != outputs[1]
        for output, name in zip(outputs, (NAME, OTHER_NAME)):
            assert output.is_relative_to(EXPORTS)
            for path in booklet_paths(output):
                with fitz.open(path) as document:
                    assert name in document[0].get_text()
        assert release_hashes() == before
    finally:
        for output in set(outputs):
            shutil.rmtree(output)


def test_session_is_taken_from_candidate_facts(monkeypatch):
    build_facts = PC.build_candidate_facts

    def next_session(**kwargs):
        facts = build_facts(**kwargs)
        facts["reponses"]["session_baccalaureat_finale"] = 2028
        return facts

    monkeypatch.setattr(PC, "build_candidate_facts", next_session)
    with tempfile.TemporaryDirectory(prefix="test-personnalisation-", dir=EXPORTS) as tmp:
        output = PC.create_candidate_pack(**FACTS, candidat_nom=NAME,
                                          output_dir=Path(tmp), assemble_pdf=False)
        for path in booklet_paths(output):
            with fitz.open(path) as document:
                assert "2028" in document[0].get_text()
                assert "2027" not in document[0].get_text()
        assert "Session : 2028" in (output / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text()


def test_omitted_name_keeps_byte_identical_booklets(tmp_path):
    output = PC.create_candidate_pack(**FACTS, output_dir=tmp_path, assemble_pdf=False)
    assert booklet_paths(output)
    for path in booklet_paths(output):
        assert path.read_bytes() == canonical_for(path).read_bytes()


def test_named_output_outside_exports_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        PC.create_candidate_pack(**FACTS, candidat_nom=NAME, output_dir=tmp_path / "unsafe")
    assert not (tmp_path / "unsafe").exists()


def test_name_requires_copied_booklets():
    with tempfile.TemporaryDirectory(prefix="test-personnalisation-", dir=EXPORTS) as tmp:
        with pytest.raises(ValueError):
            PC.create_candidate_pack(**FACTS, candidat_nom=NAME, output_dir=Path(tmp),
                                     copy_booklets=False)


@pytest.mark.parametrize("name", ["   ", "Camille\nEXEMPLE", "Camille\rEXEMPLE",
                                  "Exemple " * 80],
                         ids=["blank", "newline", "carriage-return", "too-long"])
def test_invalid_or_unreadably_long_name_is_rejected(name):
    with tempfile.TemporaryDirectory(prefix="test-personnalisation-", dir=EXPORTS) as tmp:
        with pytest.raises(ValueError):
            PC.create_candidate_pack(**FACTS, candidat_nom=name,
                                     output_dir=Path(tmp), assemble_pdf=False)


def test_cli_forwards_candidate_name(monkeypatch, tmp_path):
    received = {}

    def capture(**kwargs):
        received.update(kwargs)
        return tmp_path

    monkeypatch.setattr(PC, "create_candidate_pack", capture)
    monkeypatch.setattr(sys, "argv", ["pack_candidat.py", "--profil", "P2",
                                     "--candidat-id", FACTS["candidat_id"],
                                     "--candidat-nom", NAME])
    assert PC.main() == 0
    assert received["candidat_nom"] == NAME
    assert received["candidat_id"] == FACTS["candidat_id"]
