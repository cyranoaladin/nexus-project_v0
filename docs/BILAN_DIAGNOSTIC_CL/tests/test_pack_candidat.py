"""Tests pour le générateur de pack candidat et les garanties d'isolation des données."""
import json
import re
import subprocess
import sys
from pathlib import Path
import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import distribution as DIS
import maquette_donnees as MD
import pack_candidat as PC


@pytest.fixture(scope="module")
def catalogue():
    return DIS.catalogue()


def test_exports_candidats_est_ignore_par_git(tmp_path):
    """La zone d'export des candidats doit être strictement ignorée par Git."""
    gitignore = (RACINE / ".gitignore").read_text(encoding="utf-8")
    assert "exports_candidats" in gitignore, "exports_candidats/ doit figurer dans .gitignore"

    # Vérification git check-ignore sur un chemin réel sous exports_candidats/
    test_path = RACINE / "exports_candidats" / "test_candidat_pack" / "BORDEREAU.txt"
    r_check = subprocess.run(["git", "check-ignore", str(test_path)],
                             cwd=str(RACINE), capture_output=True, text=True)
    assert r_check.returncode == 0, f"{test_path} doit être ignoré par Git"

    # Vérification git ls-files : aucun fichier sous exports_candidats ne doit être suivi
    r_ls = subprocess.run(["git", "ls-files", "exports_candidats/"],
                          cwd=str(RACINE), capture_output=True, text=True)
    assert r_ls.stdout.strip() == "", f"Fichiers suivis sous exports_candidats: {r_ls.stdout}"


def test_p1_annuelle_selection_instruments(catalogue):
    """P1 annuelle : seule specialite_non_poursuivie est due officiellement (exemple MATH, HGGSP, SES -> SES)."""
    qp = PC.build_candidate_facts(
        profil="P1",
        mode_ep="annuelle",
        spes_premiere=["MATH", "HGGSP", "SES"],
        spe_non_poursuivie="SES",
        spes_terminales=["MATH", "HGGSP"],
        config_francais="les_deux",
    )
    res = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, catalogue)
    dues = dict(res["epreuves_reglementaires_dues"])
    diags = dict(res["diagnostics_nexus_utiles"])

    # Épreuves officielles dues cette session
    assert dues.get("FR-EAF") in ("standard_2028", "standard")
    assert dues.get("FR-EAF-ORAL") == "standard"
    assert dues.get("MATH-EA") in ("SPE", "SPECIFIQUES")
    assert dues.get("TC-HG") == "1RE"
    assert dues.get("TC-ES") == "1RE"
    assert dues.get("TC-EMC") == "1RE"
    assert dues.get("EDS-SES") == "N1"
    assert "EDS-MATH" not in dues
    assert "EDS-HGGSP" not in dues
    assert res["official_p1_speciality_count"] == 1

    # Diagnostics Nexus d'accompagnement
    assert "EDS-MATH" in diags
    assert "EDS-HGGSP" in diags


def test_p1_annuelle_specialite_non_poursuivie_inconnue(catalogue):
    """Si specialite_non_poursuivie n'est pas encore connue, 0 EDS est dû officiellement."""
    for val_inconnue in ("aucune", "inconnue", "non_renseignee", ""):
        qp = PC.build_candidate_facts(
            profil="P1",
            mode_ep="annuelle",
            spes_premiere=["MATH", "HGGSP", "SES"],
            spe_non_poursuivie=val_inconnue,
            spes_terminales=[],
            config_francais="les_deux",
        )
        res = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, catalogue)
        dues = dict(res["epreuves_reglementaires_dues"])
        diags = dict(res["diagnostics_nexus_utiles"])

        # Aucun EDS ne doit être classé en obligation officielle
        assert not any(c.startswith("EDS-") for c in dues)
        assert res["official_p1_speciality_count"] == 0

        # Les 3 spécialités restent en diagnostics Nexus
        assert "EDS-MATH" in diags
        assert "EDS-HGGSP" in diags
        assert "EDS-SES" in diags


def test_invariant_global_eds_n1_obligations_officielles(catalogue):
    """Vérifie l'invariant : nombre d'EDS N1 dues <= 1 en P1 annuel, 0 en P1 fin_cycle, etc."""
    for spe_abandon in ("SES", "aucune", "inconnue"):
        spes_tle = ["MATH", "HGGSP"] if spe_abandon == "SES" else []
        # P1 annuel : <= 1
        qp_p1_ann = PC.build_candidate_facts("P1", "annuelle", ["MATH", "HGGSP", "SES"], spe_abandon, spes_tle)
        res_p1_ann = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p1_ann, catalogue)
        n1_p1_ann = [c for c, v in res_p1_ann["epreuves_reglementaires_dues"] if c.startswith("EDS-") and v == "N1"]
        assert len(n1_p1_ann) <= 1
        if spe_abandon == "SES":
            assert len(n1_p1_ann) == 1 and n1_p1_ann[0] == "EDS-SES"
        else:
            assert len(n1_p1_ann) == 0

        # P1 fin_cycle : 0
        qp_p1_fc = PC.build_candidate_facts("P1", "fin_cycle", ["MATH", "HGGSP", "SES"], spe_abandon, spes_tle)
        res_p1_fc = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p1_fc, catalogue)
        n1_p1_fc = [c for c, v in res_p1_fc["epreuves_reglementaires_dues"] if c.startswith("EDS-") and v == "N1"]
        assert len(n1_p1_fc) == 0

    # P2 annuel : 0 EDS N1
    qp_p2_ann = PC.build_candidate_facts("P2", "annuelle", ["MATH", "HGGSP", "SES"], "SES", ["MATH", "HGGSP"])
    res_p2_ann = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p2_ann, catalogue)
    n1_p2_ann = [c for c, v in res_p2_ann["epreuves_reglementaires_dues"] if c.startswith("EDS-") and v == "N1"]
    assert len(n1_p2_ann) == 0

    # P2 fin_cycle : exactement 1 EDS N1 si la spécialité abandonnée est renseignée
    qp_p2_fc = PC.build_candidate_facts("P2", "fin_cycle", ["MATH", "HGGSP", "SES"], "SES", ["MATH", "HGGSP"])
    res_p2_fc = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p2_fc, catalogue)
    n1_p2_fc = [c for c, v in res_p2_fc["epreuves_reglementaires_dues"] if c.startswith("EDS-") and v == "N1"]
    assert len(n1_p2_fc) == 1 and n1_p2_fc[0] == "EDS-SES"


def test_p1_fin_cycle_separation_dues_vs_diagnostics(catalogue):
    """En P1 fin_cycle, les anticipées (FR-EAF, MATH-EA) restent obligatoires ; HG/EMC/ES sont reportées."""
    qp = PC.build_candidate_facts(
        profil="P1",
        mode_ep="fin_cycle",
        spes_premiere=["MATH", "PC", "NSI"],
        spe_non_poursuivie="NSI",
        spes_terminales=["MATH", "PC"],
        config_francais="les_deux",
        diagnostic_nexus_utile=True,
    )
    res = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, catalogue)
    dues_codes = {c for c, _ in res["epreuves_reglementaires_dues"]}
    diag_codes = {c for c, _ in res["diagnostics_nexus_utiles"]}
    reportees_codes = {c for c, _, _ in res.get("evaluations_reportees_fin_cycle", [])}

    # Anticipées obligatoires dues cette session
    assert "FR-EAF" in dues_codes
    assert "FR-EAF-ORAL" in dues_codes
    assert "MATH-EA" in dues_codes, "MATH-EA ne peut jamais être supprimé en 1re"

    # Non dues en première car reportées en fin de cycle
    assert "TC-HG" not in dues_codes
    assert "TC-EMC" not in dues_codes
    assert "TC-ES" not in dues_codes
    assert "EDS-NSI" not in dues_codes

    # Reportées officiellement
    assert "TC-HG" in reportees_codes
    assert "TC-EMC" in reportees_codes
    assert "TC-ES" in reportees_codes
    assert "EDS-NSI" in reportees_codes

    # Mais présentes pour l'accompagnement pédagogique
    assert "TC-HG" in diag_codes
    assert "TC-EMC" in diag_codes
    assert "TC-ES" in diag_codes


def test_p2_math_ea_due_condition(catalogue):
    """En P2 sans spécialité maths, MATH-EA/SPECIFIQUES n'est présent que si math_ea_due est vrai."""
    # Cas 1: math_ea_due = False
    qp_sans_math = PC.build_candidate_facts(
        profil="P2",
        mode_ep="annuelle",
        spes_premiere=["PC", "SVT", "SES"],
        spe_non_poursuivie="SES",
        spes_terminales=["PC", "SVT"],
        math_ea_due=False,
    )
    insts_false = MD.instruments_passes(qp_sans_math, catalogue)
    codes_false = {c for c, _ in insts_false}
    assert "MATH-EA" not in codes_false

    # Cas 2: math_ea_due = True
    qp_avec_math = PC.build_candidate_facts(
        profil="P2",
        mode_ep="annuelle",
        spes_premiere=["PC", "SVT", "SES"],
        spe_non_poursuivie="SES",
        spes_terminales=["PC", "SVT"],
        math_ea_due=True,
    )
    insts_true = MD.instruments_passes(qp_avec_math, catalogue)
    assert ("MATH-EA", "SPECIFIQUES") in insts_true


def test_aucun_module_francais_duplique_dans_un_parcours(catalogue):
    """Un même module FR-POS, FR-POS-ORAL, FR-MAI ou FR-EAF ne doit jamais apparaître deux fois."""
    import faits_candidat as FC
    for prof in ("P1", "P2", "P3"):
        for mode in ("annuelle", "fin_cycle"):
            if prof == "P3" and mode == "annuelle":
                continue  # hors domaine : un bac en une session est en fin de cycle
            for cfg in ("aucune" if e == "none" else e for e in FC.EAF_ADMIS[prof]):
                qp = PC.build_candidate_facts(
                    profil=prof,
                    mode_ep=mode,
                    spes_premiere=["MATH", "PC", "NSI"],
                    spe_non_poursuivie="NSI",
                    spes_terminales=["MATH", "PC"],
                    config_francais=cfg,
                )
                insts = MD.instruments_passes(qp, catalogue)
                codes_fr = [c for c, _ in insts if c.startswith("FR-")]
                assert len(codes_fr) == len(set(codes_fr)), f"Doublon français dans {prof}/{mode}/{cfg}: {codes_fr}"


def test_fr_pos_vs_fr_mai_distinction():
    """FR-POS est le test enseignant (/40, réseaux sociaux, 120-150 mots) et FR-MAI est Condorcet (/40, 80 mots)."""
    with open(RACINE / "instruments" / "FR-POS" / "banque.json", encoding="utf-8") as f:
        b_pos = json.load(f)
    with open(RACINE / "instruments" / "FR-MAI" / "banque.json", encoding="utf-8") as f:
        b_mai = json.load(f)

    # FR-POS
    texte_pos = json.dumps(b_pos, ensure_ascii=False)
    assert "réseaux sociaux" in texte_pos or "téléphones" in texte_pos
    assert "120 à 150 mots" in texte_pos
    assert sum(it["score_max"] for it in b_pos["items"]) == 40

    # FR-MAI
    texte_mai = json.dumps(b_mai, ensure_ascii=False)
    assert "80 mots" in texte_mai
    with open(RACINE / "instruments" / "FR-MAI" / "assemblages" / "standard.json", encoding="utf-8") as f:
        ass_mai = json.load(f)
    assert len(ass_mai["blocs"]) == 4
    items_ass = [iid for bl in ass_mai["blocs"] for iid in bl["items"]]
    assert len(items_ass) == 18


def test_creation_pack_candidat_dans_repertoire_temporaire(tmp_path):
    """Vérifie la génération complète d'un dossier candidat dans un chemin temporaire."""
    dossier = PC.create_candidate_pack(
        profil="P1",
        mode_ep="annuelle",
        spes_premiere=["MATH", "PC", "NSI"],
        spe_non_poursuivie="NSI",
        spes_terminales=["MATH", "PC"],
        config_francais="les_deux",
        candidat_id="CAND-TEST-001",
        output_dir=tmp_path / "export_test",
        assemble_pdf=False,
        copy_booklets=False,
    )
    assert dossier.exists()
    bordereau = dossier / "A_ENVOYER" / "BORDEREAU_ENVOI.txt"
    assert bordereau.exists()
    contenu = bordereau.read_text(encoding="utf-8")
    assert "CAND-TEST-001" in contenu
    assert "P1 — Première partie (anticipation)" in contenu
    assert "ANNUELLE" in contenu
    assert "nom :" not in contenu.lower()
    assert "prénom :" not in contenu.lower()

    # Vérification bordereau opérateur interne
    bordereau_interne = dossier / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt"
    assert bordereau_interne.exists()
    contenu_int = bordereau_interne.read_text(encoding="utf-8")
    assert "NE PAS TRANSMETTRE AU CANDIDAT" in contenu_int
    assert "CAND-TEST-001" in contenu_int


def test_philosophie_derivation_automatique(catalogue):
    """Philosophie est une épreuve terminale obligatoire : P1=false, P2=true, P3=true."""
    # P1 : absent
    qp_p1 = PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"])
    res_p1 = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p1, catalogue)
    assert res_p1["philosophie_due"] is False
    assert "PHI" not in {c for c, _ in res_p1["epreuves_reglementaires_dues"]}

    # P2 : présent
    qp_p2 = PC.build_candidate_facts("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"])
    res_p2 = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p2, catalogue)
    assert res_p2["philosophie_due"] is True
    assert ("PHI", "standard") in res_p2["epreuves_reglementaires_dues"]

    # P3 : présent
    qp_p3 = PC.build_candidate_facts("P3", "fin_cycle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"])
    res_p3 = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_p3, catalogue)
    assert res_p3["philosophie_due"] is True
    assert ("PHI", "standard") in res_p3["epreuves_reglementaires_dues"]


def test_eaf_quatre_situations_en_p2(catalogue):
    """Vérifie les 4 situations EAF en P2 : none, ecrit, oral, les_deux."""
    spes_1re = ["MATH", "PC", "NSI"]
    spes_tle = ["MATH", "PC"]

    # 1. none : EAF absente du parcours standard
    qp_none = PC.build_candidate_facts("P2", "annuelle", spes_1re, "NSI", spes_tle, eaf_due="none")
    res_none = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_none, catalogue)
    dues_none = {c for c, _ in res_none["epreuves_reglementaires_dues"]}
    assert "FR-EAF" not in dues_none
    assert "FR-EAF-ORAL" not in dues_none

    # 2. ecrit : écrit seul
    qp_ecrit = PC.build_candidate_facts("P2", "annuelle", spes_1re, "NSI", spes_tle, eaf_due="ecrit")
    res_ecrit = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_ecrit, catalogue)
    dues_ecrit = dict(res_ecrit["epreuves_reglementaires_dues"])
    assert dues_ecrit.get("FR-EAF") == "ecrit"
    assert "FR-EAF-ORAL" not in dues_ecrit

    # 3. oral : oral seul
    qp_oral = PC.build_candidate_facts("P2", "annuelle", spes_1re, "NSI", spes_tle, eaf_due="oral")
    res_oral = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_oral, catalogue)
    dues_oral = dict(res_oral["epreuves_reglementaires_dues"])
    assert "FR-EAF-ORAL" in dues_oral
    assert dues_oral.get("FR-EAF") != "ecrit"

    # 4. les_deux : écrit et oral
    qp_deux = PC.build_candidate_facts("P2", "annuelle", spes_1re, "NSI", spes_tle, eaf_due="les_deux")
    res_deux = MD.epreuves_reglementaires_dues_vs_diagnostics(qp_deux, catalogue)
    dues_deux = dict(res_deux["epreuves_reglementaires_dues"])
    assert dues_deux.get("FR-EAF") == "standard"
    assert "FR-EAF-ORAL" in dues_deux


def test_bordereau_distingue_officiel_et_pedagogique(tmp_path):
    """Le bordereau d'envoi classe strictement FR-MAI / FR-POS en pédagogique, jamais en épreuve officielle."""
    dossier = PC.create_candidate_pack(
        profil="P2",
        mode_ep="annuelle",
        spes_premiere=["MATH", "PC", "NSI"],
        spe_non_poursuivie="NSI",
        spes_terminales=["MATH", "PC"],
        eaf_due="none",
        fr_pos_requis=True,
        fr_mai_requis=True,
        output_dir=tmp_path / "export_bordereau",
        assemble_pdf=False,
        copy_booklets=False,
    )
    texte = (dossier / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    assert "2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES" in texte
    assert "3. ÉVALUATIONS OFFICIELLES REPORTÉES EN FIN DE CYCLE" in texte
    assert "4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER" in texte
    assert "5. DOCUMENTS REMIS AU CANDIDAT ET À LA FAMILLE" in texte

    section_off = texte.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    section_pedago = texte.split("4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER")[1].split("5. DOCUMENTS REMIS")[0]

    # Philosophie est bien officielle en P2
    assert "philosophie" in section_off.lower()
    # Ni FR-MAI ni FR-POS ne doivent figurer dans la section officielle
    assert "FR-MAI" not in section_off
    assert "FR-POS" not in section_off
    # AUCUNE durée diagnostique dans la section officielle
    assert not re.search(r"\b\d+\s*min\b", section_off)
    # AUCUN code technique entre crochets dans le bordereau famille
    assert "[" not in texte and "]" not in texte
    # Mention obligatoire dans les tests diagnostiques
    assert "« Durée du diagnostic Nexus — différente de la durée réglementaire de l’épreuve officielle. »" in section_pedago

    # Ils sont dans la section pédagogique d'accompagnement
    assert "Maîtrise du français" in section_pedago
    assert "Positionnement écrit de français" in section_pedago

    # Vérification bordereau opérateur interne
    texte_int = (dossier / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt").read_text(encoding="utf-8")
    assert "NE PAS TRANSMETTRE AU CANDIDAT" in texte_int
    assert "[PHI/standard]" in texte_int


def test_p2_fin_cycle_spe_non_poursuivie_dans_obligations_officielles(catalogue):
    """En P2 + fin_cycle, la spécialité non poursuivie de 1re est une obligation officielle due, pas un diagnostic."""
    qp = PC.build_candidate_facts(
        profil="P2",
        mode_ep="fin_cycle",
        spes_premiere=["MATH", "PC", "NSI"],
        spe_non_poursuivie="NSI",
        spes_terminales=["MATH", "PC"],
        eaf_due="none",
    )
    res = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, catalogue)
    dues = dict(res["epreuves_reglementaires_dues"])
    assert dues.get("EDS-NSI") == "N1", "La spécialité non poursuivie doit être une obligation officielle en P2 fin_cycle"


def test_positionnement_francais_source_canonique_commun(tmp_path):
    """POSITIONNEMENT_FRANCAIS.pdf doit provenir uniquement de 00_COMMUN dans la release."""
    release_pos = RACINE / "release" / "diagnostics-v2" / "01_LIVRETS_CANDIDAT" / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf"
    if not release_pos.exists():
        pytest.skip("release v2 non construite")
    dossier = PC.create_candidate_pack(
        profil="P1",
        mode_ep="annuelle",
        spes_premiere=["MATH", "PC", "NSI"],
        spe_non_poursuivie="NSI",
        spes_terminales=["MATH", "PC"],
        fr_pos_requis=True,
        output_dir=tmp_path / "export_pos",
        assemble_pdf=False,
        copy_booklets=True,
    )
    pos_copie = dossier / "A_ENVOYER" / "livrets" / "POSITIONNEMENT_FRANCAIS.pdf"
    assert pos_copie.exists(), "POSITIONNEMENT_FRANCAIS.pdf doit être copié dans le pack A_ENVOYER"
    import hashlib
    h_src = hashlib.sha256(release_pos.read_bytes()).hexdigest()
    h_dst = hashlib.sha256(pos_copie.read_bytes()).hexdigest()
    assert h_src == h_dst, "Le livret positionnement candidat doit correspondre au binaire sous 00_COMMUN"


def test_six_golden_packs_complets(tmp_path, catalogue):
    """Génération et validation rigoureuse des six Golden Packs réglementaires avec séparation A_ENVOYER / _INTERNE_NEXUS."""
    # 1. P1 annuelle (spécialité non poursuivie connue = SES)
    p1_ann = PC.create_candidate_pack("P1", "annuelle", ["MATH", "HGGSP", "SES"], "SES", ["MATH", "HGGSP"],
                                      output_dir=tmp_path / "p1_ann", assemble_pdf=False, copy_booklets=False)
    b_p1_ann = (p1_ann / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    b_int_p1_ann = (p1_ann / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt").read_text(encoding="utf-8")
    sec_dues_p1_ann = b_p1_ann.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    sec_pedago_p1_ann = b_p1_ann.split("4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER")[1].split("5. DOCUMENTS REMIS")[0]

    assert "Français écrit" in sec_dues_p1_ann
    assert "Mathématiques" in sec_dues_p1_ann
    assert "Histoire-géographie" in sec_dues_p1_ann
    assert "Sciences Économiques et Sociales" in sec_dues_p1_ann
    assert "Physique-Chimie" not in sec_dues_p1_ann
    assert "HGGSP" not in sec_dues_p1_ann
    assert not re.search(r"\b\d+\s*min\b", sec_dues_p1_ann)

    # Les spécialités font l'objet d'un test diagnostique dans la section 4
    assert "Spécialité Mathématiques" in sec_pedago_p1_ann
    assert "Spécialité Histoire-Géographie" in sec_pedago_p1_ann
    assert "Sciences Économiques et Sociales" in sec_pedago_p1_ann

    # Bordereau interne
    assert "[FR-EAF/" in b_int_p1_ann
    assert "[MATH-EA/" in b_int_p1_ann
    assert "[TC-HG/" in b_int_p1_ann
    assert "[EDS-SES/N1]" in b_int_p1_ann

    # 1bis. P1 annuelle (spécialité non poursuivie NON connue = aucune, spes_terminales=[])
    p1_ann_inconnue = PC.create_candidate_pack("P1", "annuelle", ["MATH", "HGGSP", "SES"], "aucune", [],
                                               output_dir=tmp_path / "p1_ann_inc", assemble_pdf=False, copy_booklets=False)
    b_p1_inc = (p1_ann_inconnue / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    sec_dues_inc = b_p1_inc.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    sec_pedago_inc = b_p1_inc.split("4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER")[1].split("5. DOCUMENTS REMIS")[0]

    # Aucun item d'EDS ne doit figurer dans les épreuves officielles dues
    assert "  - Spécialité" not in sec_dues_inc
    assert "Spécialité non poursuivie non encore déterminée" in sec_dues_inc
    # Les 3 spécialités sont en diagnostic Nexus d'accompagnement
    assert "Spécialité Mathématiques" in sec_pedago_inc
    assert "Spécialité Histoire-Géographie" in sec_pedago_inc
    assert "Sciences Économiques et Sociales" in sec_pedago_inc

    # 2. P1 fin_cycle
    p1_fc = PC.create_candidate_pack("P1", "fin_cycle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                     output_dir=tmp_path / "p1_fc", assemble_pdf=False, copy_booklets=False)
    b_p1_fc = (p1_fc / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    b_int_fc = (p1_fc / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt").read_text(encoding="utf-8")
    sec_dues_fc = b_p1_fc.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    sec_rep_fc = b_p1_fc.split("3. ÉVALUATIONS OFFICIELLES REPORTÉES EN FIN DE CYCLE")[1].split("4. TESTS DIAGNOSTIQUES")[0]
    assert "Mathématiques" in sec_dues_fc, "Mathématiques EA doit être due maintenant en P1 fin_cycle"
    assert "Français écrit" in sec_dues_fc
    assert "Histoire-géographie" in sec_rep_fc, "Histoire-géographie doit être reportée en fin de cycle"
    assert "Numérique et Sciences Informatiques" in sec_rep_fc, "La spécialité non poursuivie doit être reportée en fin de cycle"
    assert "[MATH-EA/" in b_int_fc
    assert "[TC-HG/1RE]" in b_int_fc

    # 3. P2 annuelle (standard)
    p2_ann = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                      eaf_due="none", output_dir=tmp_path / "p2_ann", assemble_pdf=False, copy_booklets=False)
    b_p2_ann = (p2_ann / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    sec_dues_p2_ann = b_p2_ann.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    sec_pedago_p2_ann = b_p2_ann.split("4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER")[1].split("5. DOCUMENTS REMIS")[0]
    assert "Philosophie" in sec_dues_p2_ann
    assert "Français" not in sec_dues_p2_ann
    assert "Maîtrise du français" not in sec_pedago_p2_ann
    assert "Positionnement" not in sec_pedago_p2_ann

    # 4. P2 fin_cycle (avec spécialité non poursuivie dans les obligations officielles)
    p2_fc = PC.create_candidate_pack("P2", "fin_cycle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                     eaf_due="none", output_dir=tmp_path / "p2_fc", assemble_pdf=False, copy_booklets=False)
    b_p2_fc = (p2_fc / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    b_int_p2_fc = (p2_fc / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt").read_text(encoding="utf-8")
    sec_dues_p2_fc = b_p2_fc.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    assert "Numérique et Sciences Informatiques" in sec_dues_p2_fc, "NSI doit être dans les obligations officielles dues en P2 fin_cycle"
    assert "Philosophie" in sec_dues_p2_fc
    assert "[EDS-NSI/N1]" in b_int_p2_fc

    # 5. P2 EAF exceptionnel (none, ecrit, oral, les_deux)
    for eaf_cfg in ("none", "ecrit", "oral", "les_deux"):
        p2_eaf = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                          eaf_due=eaf_cfg, output_dir=tmp_path / f"p2_eaf_{eaf_cfg}", assemble_pdf=False, copy_booklets=False)
        b_txt = (p2_eaf / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
        b_int = (p2_eaf / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt").read_text(encoding="utf-8")
        sec_dues = b_txt.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
        if eaf_cfg == "none":
            assert "Français" not in sec_dues
            assert "[FR-EAF" not in b_int
        elif eaf_cfg == "ecrit":
            assert "Français écrit" in sec_dues
            assert "Français oral" not in sec_dues
            assert "[FR-EAF/ecrit" in b_int
            assert "[FR-EAF-ORAL" not in b_int
        elif eaf_cfg == "oral":
            assert "Français oral" in sec_dues
            assert "Français écrit" not in sec_dues
            assert "[FR-EAF-ORAL" in b_int
        elif eaf_cfg == "les_deux":
            assert "Français écrit" in sec_dues
            assert "Français oral" in sec_dues
            assert "[FR-EAF/standard" in b_int
            assert "[FR-EAF-ORAL" in b_int

    # 6. P3 (Bac en une session)
    p3_pack = PC.create_candidate_pack("P3", "fin_cycle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                       output_dir=tmp_path / "p3_pack", assemble_pdf=False, copy_booklets=False)
    b_p3 = (p3_pack / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    b_int_p3 = (p3_pack / "_INTERNE_NEXUS" / "BORDEREAU_OPERATEUR_INTERNE.txt").read_text(encoding="utf-8")
    sec_dues_p3 = b_p3.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    assert "Français écrit" in sec_dues_p3
    assert "Mathématiques" in sec_dues_p3
    assert "Philosophie" in sec_dues_p3
    assert "[FR-EAF/" in b_int_p3
    assert "[MATH-EA/" in b_int_p3
    assert "[PHI/" in b_int_p3


def test_gardefou_1_invariants_specialites_rejets_et_derivations():
    """Garde-fou 1 : Invariants des spécialités, normalisation, dérivation et rejets d'incohérences."""
    # 1. Dérivation automatique de spe_non_poursuivie si 1re et Tle sont connues
    qp = PC.build_candidate_facts("P1", "annuelle", ["math", "pc", "nsi"], None, ["math", "pc"])
    assert qp["reponses"]["specialite_non_poursuivie"] == "NSI"
    assert qp["reponses"]["specialites_suivies_premiere"] == ["MATH", "PC", "NSI"]
    assert qp["reponses"]["specialites_terminales"] == ["MATH", "PC"]

    # 2. Rejet si spécialité fournie incohérente avec la différence (hors du triplet,
    #    ou dans le triplet mais différente de la déduction)
    with pytest.raises(ValueError, match="non présente dans les spécialités de Première"):
        PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], "SES", ["MATH", "PC"])
    with pytest.raises(ValueError, match="Incohérence des spécialités"):
        PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], "MATH", ["MATH", "PC"])

    # 3. Rejet si déclarée inconnue alors que Terminale est connue
    with pytest.raises(ValueError, match="Incohérence des spécialités"):
        PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], "aucune", ["MATH", "PC"])

    # 4. Rejet si spécialités de Terminale non incluses dans Première
    with pytest.raises(ValueError, match="non incluses"):
        PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], None, ["MATH", "SES"])

    # 5. Rejet si doublons
    with pytest.raises(ValueError, match="en double"):
        PC.build_candidate_facts("P1", "annuelle", ["MATH", "MATH", "PC"], None, ["MATH", "PC"])
    with pytest.raises(ValueError, match="en double"):
        PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], None, ["MATH", "MATH"])

    # 6. Rejet en P2 / P3 si spécialités de Terminale absentes
    with pytest.raises(ValueError, match="P2 invalide|exige deux spécialités"):
        PC.build_candidate_facts("P2", "annuelle", ["MATH", "PC", "NSI"], "aucune", [])
    with pytest.raises(ValueError, match="P3 invalide|exige deux spécialités"):
        PC.build_candidate_facts("P3", "fin_cycle", ["MATH", "PC", "NSI"], "aucune", [])

    # 7. Acceptation en P1 si orientation Terminale réellement non déterminée
    qp_inc = PC.build_candidate_facts("P1", "annuelle", ["MATH", "PC", "NSI"], "inconnue", [])
    assert qp_inc["reponses"]["specialite_non_poursuivie"] == "inconnue"
    assert qp_inc["reponses"]["specialites_terminales"] == []


def test_gardefou_2_francais_absents_par_defaut_en_p2_p3(tmp_path):
    """Garde-fou 2 : FR-MAI et FR-POS absents par défaut en P2/P3 et ajoutés indépendamment."""
    # P2 standard par défaut : fr_pos_requis=False, fr_mai_requis=False
    p2_def = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                      output_dir=tmp_path / "p2_def", assemble_pdf=False, copy_booklets=True)
    livrets = [p.name for p in (p2_def / "A_ENVOYER" / "livrets").glob("*.pdf")]
    assert "MAITRISE_DU_FRANCAIS.pdf" not in livrets
    assert "POSITIONNEMENT_FRANCAIS.pdf" not in livrets

    # Avec fr_mai_requis=True seul
    p2_mai = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                      fr_mai_requis=True, output_dir=tmp_path / "p2_mai", assemble_pdf=False, copy_booklets=True)
    livrets_mai = [p.name for p in (p2_mai / "A_ENVOYER" / "livrets").glob("*.pdf")]
    assert "MAITRISE_DU_FRANCAIS.pdf" in livrets_mai
    assert "POSITIONNEMENT_FRANCAIS.pdf" not in livrets_mai

    # Avec fr_pos_requis=True seul
    p2_pos = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                      fr_pos_requis=True, output_dir=tmp_path / "p2_pos", assemble_pdf=False, copy_booklets=True)
    livrets_pos = [p.name for p in (p2_pos / "A_ENVOYER" / "livrets").glob("*.pdf")]
    assert "POSITIONNEMENT_FRANCAIS.pdf" in livrets_pos
    assert "MAITRISE_DU_FRANCAIS.pdf" not in livrets_pos


def test_gardefou_3_separation_physique_a_envoyer_et_interne(tmp_path):
    """Garde-fou 3 : Séparation stricte A_ENVOYER, OPTION_IMPRESSION et _INTERNE_NEXUS."""
    dossier = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                       output_dir=tmp_path / "pack_sep", assemble_pdf=True, copy_booklets=True)
    a_envoyer = dossier / "A_ENVOYER"
    option_impression = dossier / "OPTION_IMPRESSION"
    interne = dossier / "_INTERNE_NEXUS"

    assert a_envoyer.exists() and option_impression.exists() and interne.exists()

    # 1. A_ENVOYER = bordereau + livrets candidat uniquement
    assert (a_envoyer / "BORDEREAU_ENVOI.txt").exists()
    assert (a_envoyer / "livrets").is_dir()
    assert not (a_envoyer / "PACK_IMPRESSION_CANDIDAT.pdf").exists(), "PACK_IMPRESSION_CANDIDAT.pdf ne doit plus être dans A_ENVOYER"
    assert set(f.name for f in a_envoyer.iterdir()) == {"BORDEREAU_ENVOI.txt", "livrets"}

    # 2. OPTION_IMPRESSION = PACK_IMPRESSION_CANDIDAT.pdf uniquement
    assert (option_impression / "PACK_IMPRESSION_CANDIDAT.pdf").exists()
    assert set(f.name for f in option_impression.iterdir()) == {"PACK_IMPRESSION_CANDIDAT.pdf"}

    # 3. _INTERNE_NEXUS = bordereau opérateur uniquement (0 PDF)
    assert set(f.name for f in interne.iterdir()) == {"BORDEREAU_OPERATEUR_INTERNE.txt"}
    b_int = interne / "BORDEREAU_OPERATEUR_INTERNE.txt"
    assert "NE PAS TRANSMETTRE AU CANDIDAT" in b_int.read_text(encoding="utf-8")

    # 4. Aucun fichier d'OPTION_IMPRESSION ou _INTERNE_NEXUS n'est répertorié dans le bordereau famille
    b_famille = (a_envoyer / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")
    assert "OPTION_IMPRESSION" not in b_famille
    assert "PACK_IMPRESSION_CANDIDAT" not in b_famille
    assert "_INTERNE_NEXUS" not in b_famille
    assert "BORDEREAU_OPERATEUR_INTERNE" not in b_famille

    # 5. Idempotence et nettoyage : aucun ancien artefact ne survit
    (a_envoyer / "PACK_IMPRESSION_CANDIDAT.pdf").write_bytes(b"%PDF-fake-old")
    assert (a_envoyer / "PACK_IMPRESSION_CANDIDAT.pdf").exists()
    # Re-génération avec assemble_pdf=False
    PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                             output_dir=tmp_path / "pack_sep", assemble_pdf=False, copy_booklets=True)
    assert not (a_envoyer / "PACK_IMPRESSION_CANDIDAT.pdf").exists(), "Ancien pack dans A_ENVOYER doit être nettoyé"
    assert not (option_impression / "PACK_IMPRESSION_CANDIDAT.pdf").exists(), "Avec assemble_pdf=False, aucun pack résiduel ne doit subsister"


def test_composition_exclusive_pack_impression(tmp_path):
    """Vérifie que OPTION_IMPRESSION/PACK_IMPRESSION_CANDIDAT.pdf est composé exclusivement des livrets de A_ENVOYER/livrets/."""
    release_dir = RACINE / "release" / "diagnostics-v2" / "01_LIVRETS_CANDIDAT"
    if not release_dir.exists():
        pytest.skip("release v2 non construite")

    import pypdf
    pack = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                    output_dir=tmp_path / "pack_exclusive", assemble_pdf=True, copy_booklets=True)
    livrets_dir = pack / "A_ENVOYER" / "livrets"
    livret_files = sorted(list(livrets_dir.glob("*.pdf")))
    assert len(livret_files) > 0

    assembled_file = pack / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf"
    assert assembled_file.exists()

    # Calcul de la somme exacte de pages de tous les livrets candidats
    total_pages_attendues = 0
    for lf in livret_files:
        reader = pypdf.PdfReader(str(lf))
        total_pages_attendues += len(reader.pages)

    assembled_reader = pypdf.PdfReader(str(assembled_file))
    assert len(assembled_reader.pages) == total_pages_attendues, (
        f"Nombre de pages de PACK_IMPRESSION_CANDIDAT ({len(assembled_reader.pages)}) "
        f"différent du total des livrets ({total_pages_attendues})"
    )

    # Vérification des signets / composition
    outlines = [item.title for item in assembled_reader.outline if hasattr(item, "title")]
    assert len(outlines) == len(livret_files), f"Attendu {len(livret_files)} signets, obtenu {len(outlines)}"

    # Aucune trace de corrigé ou document coach dans les signets
    for title in outlines:
        assert "CORRECTION" not in title.upper()
        assert "COACH" not in title.upper()
        assert "GRILLE" not in title.upper()


def test_gardefou_4_gate_lexical_bordereau_famille():
    """Garde-fou 4 : Gate lexical interdisant codes internes et durées dans la section officielle."""
    # Test violation : motifs interdits
    interdits = (
        "standard_2028",
        "/N1",
        "/NT",
        "CORRECTIONS_COACH",
        "grille_coach",
        "[FR-EAF/standard]",
        "OPTION_IMPRESSION",
        "PACK_IMPRESSION_CANDIDAT",
        "_INTERNE_NEXUS",
        "BORDEREAU_OPERATEUR_INTERNE",
    )
    for mot in interdits:
        texte_faux = f"« Durée du diagnostic Nexus — différente de la durée réglementaire de l’épreuve officielle. » {mot}"
        with pytest.raises(ValueError, match="Gate lexical"):
            PC.verifier_gate_lexical_bordereau_famille(texte_faux)

    # Test violation : durée dans section officielle
    texte_duree_off = """
2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES (CETTE SESSION)
  - Philosophie (90 min)
3. ÉVALUATIONS OFFICIELLES REPORTÉES EN FIN DE CYCLE (TERMINALE)
4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER
« Durée du diagnostic Nexus — différente de la durée réglementaire de l’épreuve officielle. »
"""
    with pytest.raises(ValueError, match="durée diagnostique"):
        PC.verifier_gate_lexical_bordereau_famille(texte_duree_off)


def test_gardefou_5_audit_golden_packs_fichiers_envoyables(tmp_path):
    """Garde-fou 5 : Audit complet du contenu réellement envoyable dans A_ENVOYER pour chaque pack."""
    release_dir = RACINE / "release" / "diagnostics-v2" / "01_LIVRETS_CANDIDAT"
    if not release_dir.exists():
        pytest.skip("release v2 non construite")

    # 1. P2 Standard : 0 EAF, 0 FR-MAI, 0 FR-POS
    p2 = PC.create_candidate_pack("P2", "annuelle", ["MATH", "PC", "NSI"], "NSI", ["MATH", "PC"],
                                  eaf_due="none", output_dir=tmp_path / "gf5_p2", assemble_pdf=True, copy_booklets=True)
    fichiers_p2 = [f.name for f in (p2 / "A_ENVOYER" / "livrets").glob("*.pdf")]
    b_p2 = (p2 / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")

    # Vérification stricte des dossiers et fichiers
    assert not (p2 / "A_ENVOYER" / "PACK_IMPRESSION_CANDIDAT.pdf").exists()
    assert (p2 / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf").exists()
    assert set(f.name for f in (p2 / "A_ENVOYER").iterdir()) == {"BORDEREAU_ENVOI.txt", "livrets"}
    assert set(f.name for f in (p2 / "OPTION_IMPRESSION").iterdir()) == {"PACK_IMPRESSION_CANDIDAT.pdf"}
    assert set(f.name for f in (p2 / "_INTERNE_NEXUS").iterdir()) == {"BORDEREAU_OPERATEUR_INTERNE.txt"}

    # Vérification stricte des absences en P2 standard
    assert not any("FRANCAIS" in f for f in fichiers_p2), f"0 EAF attendue en P2 standard, trouvé : {fichiers_p2}"
    assert "MAITRISE_DU_FRANCAIS.pdf" not in fichiers_p2, "0 FR-MAI attendu par défaut en P2"
    assert "POSITIONNEMENT_FRANCAIS.pdf" not in fichiers_p2, "0 FR-POS attendu par défaut en P2"

    # Vérification des présences obligatoires en P2
    assert "PHILOSOPHIE.pdf" in fichiers_p2
    assert "MATHEMATIQUES_AVEC_SPECIALITE.pdf" in fichiers_p2
    assert "SPECIALITE_PHYSIQUE-CHIMIE.pdf" in fichiers_p2

    # 2. P1 avec orientation non déterminée
    p1_inc = PC.create_candidate_pack("P1", "annuelle", ["MATH", "PC", "NSI"], "inconnue", [],
                                      output_dir=tmp_path / "gf5_p1_inc", assemble_pdf=True, copy_booklets=True)
    fichiers_p1 = [f.name for f in (p1_inc / "A_ENVOYER" / "livrets").glob("*.pdf")]
    b_p1 = (p1_inc / "A_ENVOYER" / "BORDEREAU_ENVOI.txt").read_text(encoding="utf-8")

    assert not (p1_inc / "A_ENVOYER" / "PACK_IMPRESSION_CANDIDAT.pdf").exists()
    assert (p1_inc / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf").exists()
    assert set(f.name for f in (p1_inc / "A_ENVOYER").iterdir()) == {"BORDEREAU_ENVOI.txt", "livrets"}

    sec_dues_p1 = b_p1.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
    sec_pedago_p1 = b_p1.split("4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER")[1].split("5. DOCUMENTS REMIS")[0]

    # 0 spécialité N1 parmi les obligations officielles
    assert "  - Spécialité" not in sec_dues_p1
    assert "Spécialité non poursuivie non encore déterminée" in sec_dues_p1

    # Les 3 spécialités figurent dans les diagnostics et dans les livrets physiques
    assert "Spécialité Mathématiques" in sec_pedago_p1
    assert "Spécialité Physique-Chimie" in sec_pedago_p1
    assert "Numérique et Sciences Informatiques" in sec_pedago_p1
    assert "MATHEMATIQUES_AVEC_SPECIALITE.pdf" in fichiers_p1
    assert "SPECIALITE_PHYSIQUE-CHIMIE.pdf" in fichiers_p1
    assert "SPECIALITE_NSI.pdf" in fichiers_p1

    # 3. Vérification transversale de _INTERNE_NEXUS : 0 PDF pour tous
    for pack_dir in (p2, p1_inc):
        pdfs_int = list((pack_dir / "_INTERNE_NEXUS").glob("*.pdf"))
        assert len(pdfs_int) == 0, f"0 PDF dans _INTERNE_NEXUS : {pdfs_int}"




