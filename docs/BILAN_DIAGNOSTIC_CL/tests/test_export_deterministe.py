"""Exports candidats : dossier déterministe, régénération idempotente et atomique.

Les exports sont dérivés de `release/diagnostics-v2/` et ne deviennent jamais une
seconde source de vérité ; les noms employés ici sont fictifs.
"""
import re
import shutil
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import pack_candidat as PC  # noqa: E402

RELEASE = RACINE / "release" / "diagnostics-v2"
EXPORTS = RACINE / "exports_candidats"
NAME = "Camille EXEMPLE"
CID = "TEST-DETERMINISTE"
FACTS = dict(
    profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"],
    spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"],
    eaf_due="none", candidat_id=CID,
)
HORODATAGE = re.compile(r"\d{8}_\d{6}")


@pytest.mark.parametrize("nom,attendu", [
    ("Camille TEST", "Camille_TEST"),
    ("  Camille   EXEMPLE  ", "Camille_EXEMPLE"),
    ("Jean-Pierre D'ALEMBERT", "Jean-Pierre_DALEMBERT"),
    ("Zoé Élise", "Zoé_Élise"),
    ('Nom/Avec:Des*Caractères?"<Interdits>|', "NomAvecDesCaractèresInterdits"),
    ("Prénom. NOM", "Prénom_NOM"),
])
def test_slug_lisible_et_sur(nom, attendu):
    slug = PC.slug_nom(nom)
    assert slug == attendu
    assert not re.search(r'[\\/:*?"<>|\s]', slug)


@pytest.mark.parametrize("nom", ["   ", "///", "???"])
def test_slug_refuse_un_nom_vide_apres_nettoyage(nom):
    with pytest.raises(ValueError):
        PC.slug_nom(nom)


def test_nom_de_dossier_suit_la_regle_generale():
    # Identité entièrement fictive (fixture) : aucun candidat réel n'est nommé ici.
    assert PC.nom_dossier_export("Camille TEST", "CL-TEST-0001", 2027) == \
        "Camille_TEST__CL-TEST-0001__BAC2027"
    assert PC.nom_dossier_export(None, "CL-TEST-0001", 2027) == "CL-TEST-0001__BAC2027"
    # L'identifiant est toujours présent : deux homonymes ne se recouvrent pas.
    assert PC.nom_dossier_export("Camille EXEMPLE", "A-1", 2027) != \
        PC.nom_dossier_export("Camille EXEMPLE", "A-2", 2027)


def test_aucun_chemin_versionne_ne_porte_de_nom():
    assert PC.EXPORTS_CANDIDATS == RACINE / "exports_candidats"
    assert "exports_candidats" in (RACINE / ".gitignore").read_text(encoding="utf-8")


@pytest.fixture
def zone_export():
    if not (RELEASE / "01_LIVRETS_CANDIDAT").exists():
        pytest.skip("release v2 non construite")
    pytest.importorskip("fitz")
    EXPORTS.mkdir(exist_ok=True)
    cible = EXPORTS / PC.nom_dossier_export(NAME, CID, 2027)
    freres = lambda: sorted(p.name for p in EXPORTS.iterdir() if CID in p.name)  # noqa: E731
    if cible.exists():
        shutil.rmtree(cible)
    yield cible, freres
    for p in EXPORTS.iterdir():
        if CID in p.name:
            shutil.rmtree(p)


def test_regenerer_le_meme_candidat_reutilise_le_meme_dossier(zone_export):
    cible, freres = zone_export
    premier = PC.create_candidate_pack(**FACTS, candidat_nom=NAME, assemble_pdf=False)
    assert premier == cible
    assert not HORODATAGE.search(premier.name)
    trace = premier / "A_ENVOYER" / "livrets" / "PERIME.pdf"
    trace.write_bytes(b"obsolete")

    second = PC.create_candidate_pack(**FACTS, candidat_nom=NAME, assemble_pdf=False)
    assert second == premier
    assert freres() == [cible.name], "aucun dossier frère horodaté ni suffixé"
    assert not trace.exists(), "un fichier périmé ne survit pas à la régénération"
    livrets = sorted(p.name for p in (second / "A_ENVOYER" / "livrets").glob("*.pdf"))
    assert len(livrets) == 8
    assert sorted(p.name for p in second.iterdir()) == ["A_ENVOYER", "_INTERNE_NEXUS"]


def test_un_echec_laisse_l_export_valide_intact(zone_export, monkeypatch):
    cible, freres = zone_export
    PC.create_candidate_pack(**FACTS, candidat_nom=NAME, assemble_pdf=False)
    bordereau = (cible / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_bytes()

    def casse(*args, **kwargs):
        raise RuntimeError("police absente")

    monkeypatch.setattr(PC, "_personalize_booklet", casse)
    with pytest.raises(RuntimeError):
        PC.create_candidate_pack(**FACTS, candidat_nom=NAME, assemble_pdf=False)
    assert (cible / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_bytes() == bordereau
    assert len(list((cible / "A_ENVOYER" / "livrets").glob("*.pdf"))) == 8
    assert freres() == [cible.name], "aucun chantier ni dossier périmé ne subsiste"


def test_un_export_incomplet_n_est_jamais_publie(zone_export, monkeypatch):
    cible, freres = zone_export
    monkeypatch.setattr(PC, "_valider_export",
                        lambda *a, **k: (_ for _ in ()).throw(ValueError("incomplet")))
    with pytest.raises(ValueError):
        PC.create_candidate_pack(**FACTS, candidat_nom=NAME, assemble_pdf=False)
    assert not cible.exists()
    assert freres() == []


def test_dossier_fourni_garde_ses_fichiers_etrangers(tmp_path):
    etranger = tmp_path / "notes_operateur.txt"
    etranger.write_text("à conserver", encoding="utf-8")
    for _ in range(2):
        sortie = PC.create_candidate_pack(**FACTS, output_dir=tmp_path,
                                          assemble_pdf=False, copy_booklets=False)
        assert sortie == tmp_path.resolve()
    assert etranger.read_text(encoding="utf-8") == "à conserver"
    assert sorted(p.name for p in tmp_path.iterdir()) == \
        ["A_ENVOYER", "_INTERNE_NEXUS", "notes_operateur.txt"]
    assert not [p for p in tmp_path.parent.iterdir() if "chantier" in p.name or "perime" in p.name]


def test_export_pseudonyme_par_defaut_sans_horodatage():
    cible = EXPORTS / PC.nom_dossier_export(None, CID, 2027)
    if cible.exists():
        shutil.rmtree(cible)
    try:
        sortie = PC.create_candidate_pack(**FACTS, assemble_pdf=False, copy_booklets=False)
        assert sortie == cible
        assert not HORODATAGE.search(sortie.name)
        assert PC.create_candidate_pack(**FACTS, assemble_pdf=False, copy_booklets=False) == cible
        assert [p.name for p in EXPORTS.iterdir() if CID in p.name] == [cible.name]
    finally:
        shutil.rmtree(cible, ignore_errors=True)
