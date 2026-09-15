"""Le bordereau famille : une ligne par livret remis, et un total égal à leur somme.

Le dossier d'entrée (QP + MET) est un seul livret : une seule ligne, avec la durée que
sa couverture annonce — recalculée dans un export nominatif. Les noms sont fictifs.
"""
import re
import sys
import tempfile
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import livret as LI  # noqa: E402
import pack_candidat as PC  # noqa: E402

RELEASE = RACINE / "release" / "diagnostics-v2"
EXPORTS = RACINE / "exports_candidats"
NAME = "Camille EXEMPLE"
# Faits d'une candidate fictive (fixture Camille TEST, CL-TEST-0001) : P2 annuelle, MATH PC NSI → MATH NSI,
# PC non poursuivie, aucune EAF, maths anticipées déjà présentées.
FACTS = dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"],
             spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none",
             candidat_id="TEST-BORDEREAU")
LIGNE = re.compile(r"^\s{2}\* (.+?) \((\d+) min\)$", re.M)
TOTAL = re.compile(r"Temps total diagnostique estimé : (\d+) min \(soit (\d+) h (\d+) min\)")


def section_4(texte):
    return texte.split("4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER", 1)[1].split("5. DOCUMENTS REMIS", 1)[0]


def lignes_et_total(texte):
    lignes = [(lib, int(m)) for lib, m in LIGNE.findall(section_4(texte))]
    total, h, mn = (int(x) for x in TOTAL.search(texte).groups())
    assert total == h * 60 + mn
    return lignes, total


def test_le_total_est_la_somme_des_lignes_du_bordereau(tmp_path):
    out = PC.create_candidate_pack(**FACTS, output_dir=tmp_path, assemble_pdf=False, copy_booklets=False)
    lignes, total = lignes_et_total((out / "A_ENVOYER/BORDEREAU_ENVOI.txt").read_text(encoding="utf-8"))
    assert sum(m for _, m in lignes) == total
    libelles = [lib for lib, _ in lignes]
    assert libelles.count(PC.LIBELLE_DOSSIER_ENTREE) == 1
    assert not any(lib.startswith(("Questionnaire de parcours", "Méthodes de travail")) for lib in libelles)
    # Sans nom, le dossier d'entrée générique annonce sa durée de couverture.
    assert dict(lignes)[PC.LIBELLE_DOSSIER_ENTREE] == LI.duree_dossier_entree() == 40


@pytest.mark.parametrize("profil,mode,eaf", [("P1", "annuelle", "les_deux"), ("P3", "fin_cycle", "les_deux"),
                                             ("P2", "fin_cycle", "none")])
def test_somme_egale_total_pour_les_autres_profils(tmp_path, profil, mode, eaf):
    spes_tle = [] if profil == "P1" else ["MATH", "NSI"]
    out = PC.create_candidate_pack(profil, mode, ["MATH", "PC", "NSI"], "PC", spes_tle, eaf_due=eaf,
                                   candidat_id="TEST-BORDEREAU", output_dir=tmp_path,
                                   assemble_pdf=False, copy_booklets=False)
    lignes, total = lignes_et_total((out / "A_ENVOYER/BORDEREAU_ENVOI.txt").read_text(encoding="utf-8"))
    assert lignes and sum(m for _, m in lignes) == total


def test_le_total_du_bordereau_est_la_somme_des_durees_annoncees():
    if not (RELEASE / "01_LIVRETS_CANDIDAT").exists():
        pytest.skip("release v2 non construite")
    fitz = pytest.importorskip("fitz")
    EXPORTS.mkdir(exist_ok=True)  # un clone propre n'a pas de zone d'export
    with tempfile.TemporaryDirectory(prefix="test-bordereau-", dir=EXPORTS) as t:
        out = PC.create_candidate_pack(**FACTS, candidat_nom=NAME, output_dir=Path(t), assemble_pdf=False)
        texte = (out / "A_ENVOYER/BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
        lignes, total = lignes_et_total(texte)
        # Le total n'est pas recopié : il se dérive des durées que chaque livret annonce.
        # Le porter en dur en avait fait un chiffre faux le jour où la dispense de partie
        # pratique a raccourci le livret de NSI de trente minutes, sans que rien ne bouge
        # ici.
        attendu = {PC.LIBELLE_DOSSIER_ENTREE: 25, "Philosophie": 60,
                   "Enseignement scientifique": 40, "Grand oral": 42,
                   "Histoire-géographie": 45, "Enseignement moral et civique": 20,
                   "Spécialité Mathématiques":
                       LI.duree_livret("EDS-MATH", "NT", 90),
                   "Spécialité Numérique et Sciences Informatiques":
                       LI.duree_livret("EDS-NSI", "NT", 90)}
        somme = sum(attendu.values())
        assert sum(m for _, m in lignes) == total == somme
        h, mn = divmod(somme, 60)
        assert f"Temps total diagnostique estimé : {somme} min (soit {h} h {mn:02d} min)" in texte
        assert dict(lignes) == attendu
        # La dispense de partie pratique raccourcit bien le livret de NSI.
        assert attendu["Spécialité Numérique et Sciences Informatiques"] < 90
        # La durée de la ligne est celle que la couverture du dossier personnalisé annonce.
        with fitz.open(out / "A_ENVOYER/livrets/DOSSIER_D_ENTREE_NEXUS.pdf") as d:
            cover = " ".join(d[0].get_text().split())
        assert f"DURÉE DU DIAGNOSTIC {dict(lignes)[PC.LIBELLE_DOSSIER_ENTREE]} min" in cover
        assert dict(lignes)[PC.LIBELLE_DOSSIER_ENTREE] == LI.duree_dossier_entree(PC.situation_connue(
            PC.build_candidate_facts(**FACTS), NAME))
