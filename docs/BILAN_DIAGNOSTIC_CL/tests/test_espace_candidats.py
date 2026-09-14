"""Chaque situation candidate valide passe par le moteur, et chacune est vérifiée.

L'espace d'états est dérivé (`faits_candidat.candidate_state_space`), jamais écrit à la
main. Pour chaque état : build_candidate_facts → epreuves_reglementaires_dues_vs_diagnostics
→ map_instruments_to_booklets → lignes_diagnostics_famille, et une série d'invariants
réglementaires. Les PDF canoniques ne sont contrôlés qu'une fois par variante physique.
"""
import itertools
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))
import distribution as DIS  # noqa: E402
import eligibilite as EL  # noqa: E402
import faits_candidat as FC  # noqa: E402
import livret as LI  # noqa: E402
import oracles_reglementaires as OR  # noqa: E402
import pack_candidat as PC  # noqa: E402
import release_v2 as REL  # noqa: E402

RELEASE_LIVRETS = REL.LIVRETS
ETATS = FC.candidate_state_space()
CODES_TECHNIQUES = re.compile(r"\b(QP|MET|TC-HG|TC-EMC|TC-ES|EDS-[A-Z]+|FR-EAF-ORAL|FR-EAF|FR-POS-ORAL|FR-POS|FR-MAI|MATH-EA|PHI|GO)/[A-Za-z0-9_]+\b")


@pytest.fixture(scope="module")
def catalogue():
    return DIS.catalogue()


@pytest.fixture(scope="module")
def release_presente():
    if not (RELEASE_LIVRETS / "PROFIL_A_PREMIERE_PARTIE").exists():
        pytest.skip("release v2 non construite")
    return True


def test_l_espace_est_derive_et_sans_doublon():
    ids = [e["scenario_id"] for e in ETATS]
    assert len(ids) == len(set(ids))
    par_profil = {p: sum(e["profil"] == p for e in ETATS) for p in FC.PROFILS}
    triplets = len(list(itertools.combinations(FC.SPECIALITES_VALIDES, 3)))
    assert par_profil["P1"] == triplets * 4 * len(FC.MODES_EP) * len(FC.EAF_ADMIS["P1"]) * 3
    assert par_profil["P2"] == triplets * 3 * len(FC.MODES_EP) * 11 * 5
    assert par_profil["P3"] == triplets * 3 * len(FC.EAF_ADMIS["P3"]) * 5
    assert len(ETATS) == sum(par_profil.values())


@pytest.mark.parametrize("dimension,valeurs", [
    ("mode_ep", FC.MODES_EP), ("eaf_due", ("none", "ecrit", "oral", "les_deux")),
    ("math_ea_due", (False, True)), ("fr_pos_requis", (False, True)), ("fr_mai_requis", (False, True)),
    ("diagnostic_nexus_utile", (True, False)),
    ("same_session_basis", (None, "retake_after_failure", "same_session_article3")),
])
def test_chaque_valeur_de_chaque_dimension_est_servie_en_p2(dimension, valeurs):
    for v in valeurs:
        assert any(e["profil"] == "P2" and e[dimension] == v for e in ETATS), (dimension, v)


def test_toutes_les_structures_de_specialites_sont_servies():
    triplets = set(itertools.combinations(FC.SPECIALITES_VALIDES, 3))
    for profil in FC.PROFILS:
        assert {tuple(e["spes_premiere"]) for e in ETATS if e["profil"] == profil} == triplets, profil
    for profil in ("P2", "P3"):
        structures = {(tuple(e["spes_premiere"]), e["spe_non_poursuivie"]) for e in ETATS if e["profil"] == profil}
        assert len(structures) == len(triplets) * 3, profil
    assert {(tuple(e["spes_premiere"]), e.get("spe_non_poursuivie")) for e in ETATS if e["profil"] == "P1"} \
        == {(t, a) for t in triplets for a in (None, *t)}


@pytest.mark.parametrize("etat", ETATS, ids=[e["scenario_id"] for e in ETATS])
def test_etat_valide(etat, catalogue, release_presente):
    r = FC.evaluer_etat(etat, catalogue)
    faits, dues, diags, effective = r["faits"], r["dues"], r["diagnostics"], r["effective"]
    livrets, lignes = r["livrets"], r["lignes"]
    profil, mode = etat["profil"], etat["mode_ep"]
    codes_dues = {c for c, _ in dues}
    codes = {c for c, _ in diags}
    codes_effective = {c for c, _ in effective}
    versions = dict(diags)

    # Oracles réglementaires indépendants
    assert OR.check_temporal_context(faits) is True
    assert OR.check_math_ea_path(faits, versions.get("MATH-EA")) is True
    assert OR.check_math_ea_transitional_exemption(faits) is True
    if profil == "P3":
        assert OR.check_article3_eligibility(faits) is True
        st = EL.statut_profil(faits)
        assert st["ouvert"] is True and st["statut"] == EL.P3_OUVERT

    # Aucun doublon d'instrument ni de livret ; obligations incluses dans les diagnostics.
    assert len(diags) == len(set(diags)), diags
    assert len(dues) == len(set(dues)), dues
    assert set(dues) <= set(diags), set(dues) - set(diags)
    assert len(effective) == len(set(effective)), effective
    assert set(effective) == (set(diags) if etat.get("diagnostic_nexus_utile", True) else set(dues))
    noms = [p.name for _, p, _ in livrets]
    assert len(noms) == len(set(noms)), noms
    assert "DOSSIER_D_ENTREE_NEXUS.pdf" in noms

    # Tous les livrets appelés par la sélection effective existent dans la release.
    attendus = {REL.nom_livret(mat, profil, v) for mat, v in LI.livrets_de(effective).items()}
    if codes_effective & LI.TRANSVERSE:
        attendus.add("POSITIONNEMENT_FRANCAIS.pdf")
    assert set(noms) == attendus | {"DOSSIER_D_ENTREE_NEXUS.pdf"}, (set(noms) ^ attendus)
    for _, p, _ in livrets:
        assert p.exists(), p
        assert "CORRECTION" not in p.name.upper() and "02_CORRECTIONS_COACH" not in str(p)

    # Philosophie et Grand oral : absents en P1, présents en P2 et P3.
    assert ("PHI" in codes) == (profil != "P1") and ("GO" in codes) == (profil != "P1")

    # Épreuves anticipées de français exactement conformes au statut : none → rien ;
    # ecrit → le livret écrit seul ; oral → le travail écrit préparatoire à l'oral et
    # l'entretien ; les_deux → le livret standard et l'entretien.
    eaf = etat["eaf_due"]
    fr = versions.get("FR-EAF")
    assert ("FR-EAF" in codes) == (eaf != "none"), (eaf, codes)
    assert ("FR-EAF-ORAL" in codes) == (eaf in ("oral", "les_deux")), (eaf, codes)
    if eaf == "ecrit":
        assert fr.startswith("ecrit"), fr
    elif eaf == "oral":
        assert fr.startswith("oral"), fr
    elif eaf == "les_deux":
        assert fr.startswith("standard"), fr
    if fr is not None:
        assert fr.endswith("_2028") == (profil == "P1"), (profil, fr)

    # Mathématiques anticipées : SPE si les maths sont suivies au parcours pertinent (Première), SPECIFIQUES sinon.
    suivies_1re = faits.get("specialites_suivies_premiere") or faits["specialites"]
    if faits["math_ea_due"]:
        assert versions.get("MATH-EA") == ("SPE" if "MATH" in suivies_1re else "SPECIFIQUES"), (suivies_1re, versions)
    else:
        assert "MATH-EA" not in codes
    assert (faits["math_ea_due"]) == (profil != "P2" or etat["math_ea_due"])

    # Tronc commun : version conforme au profil et au mode.
    tc = {"P1": "1RE", "P2": "TLE" if mode == "annuelle" else "ETENDUE", "P3": "ETENDUE"}[profil]
    for c in ("TC-HG", "TC-EMC", "TC-ES"):
        assert versions.get(c) == tc, (c, versions.get(c), tc)

    # Spécialités : N1 pour la Première, NT pour la Terminale, N1 de la non-poursuivie quand elle est due.
    eds = {c: v for c, v in diags if c.startswith("EDS-")}
    abandon = etat.get("spe_non_poursuivie")
    if profil == "P1":
        assert eds == {f"EDS-{s}": "N1" for s in etat["spes_premiere"]}
    else:
        attendu_eds = {f"EDS-{s}": "NT" for s in etat["spes_terminales"]}
        if profil == "P3" or mode == "fin_cycle":
            attendu_eds[f"EDS-{abandon}"] = "N1"
        assert eds == attendu_eds, (eds, attendu_eds)
    n1_dues = [c for c, v in dues if c.startswith("EDS-") and v == "N1"]
    assert len(n1_dues) <= 1
    if profil == "P1":
        assert len(n1_dues) == (1 if (mode == "annuelle" and abandon) else 0)
    elif profil == "P2":
        assert len(n1_dues) == (1 if mode == "fin_cycle" else 0)
    else:
        assert len(n1_dues) == 1

    # Diagnostics de français : seulement sur demande.
    assert (bool(codes & LI.TRANSVERSE)) == etat["fr_pos_requis"]
    assert ("FR-MAI" in codes) == etat["fr_mai_requis"]

    # Obligations officielles cohérentes avec le profil.
    if profil == "P1":
        assert {"FR-EAF", "FR-EAF-ORAL", "MATH-EA"} <= codes_dues
        assert not ({"PHI", "GO"} & codes_dues)
    else:
        assert {"PHI", "GO"} <= codes_dues
    if profil == "P3":
        assert not ({"QP", "MET", "FR-POS", "FR-POS-ORAL", "FR-MAI"} & codes_dues)

    # Durée du bordereau : somme des lignes, une ligne par livret hors dossier d'entrée fusionné.
    assert r["duree_min"] == sum(m for _, m in lignes)
    assert all(m > 0 for _, m in lignes)
    assert sum(1 for l, _ in lignes if l == PC.LIBELLE_DOSSIER_ENTREE) == 1
    for libelle, _ in lignes:
        assert not CODES_TECHNIQUES.search(libelle), libelle


def test_les_variantes_physiques_sont_controlees_une_fois(release_presente):
    """Chaque livret candidat que l'espace appelle existe, est un PDF lisible et ne
    contient aucun corrigé : contrôle par variante physique, pas par état."""
    fitz = pytest.importorskip("fitz")
    variantes = set()
    for c in FC.classes_de_selection().values():
        for mat, v in LI.livrets_de(c["instruments"]).items():
            variantes.add((c["profil"], mat, v))
    assert len(variantes) < len(ETATS)
    for profil, mat, v in sorted(variantes):
        p = RELEASE_LIVRETS / REL.DOSSIER_PROFIL[profil] / REL.sous_dossier_livret(mat, profil, v) / REL.nom_livret(mat, profil, v)
        assert p.exists(), p
        with fitz.open(p) as d:
            texte = " ".join(pg.get_text() for pg in d)
        assert "CORRECTION" not in texte.upper().split("DIAGNOSTIC NEXUS")[0][:200]
        assert "Réponse :" not in texte and "CONFIDENTIEL" not in texte, p
