"""Le référentiel des règles du bilan : sa forme, sa source, et le fait que le moteur le suit.

Deux moitiés, qui ne se remplacent pas l'une l'autre. Les contrôles RB vérifient que le
référentiel est bien formé et que chaque valeur cite un texte du Cahier qui existe
réellement — sans quoi une valeur pourrait entrer sous une source inventée. Les tests
dynamiques vérifient que déplacer une valeur au référentiel déplace le résultat — sans
quoi le référentiel pourrait n'être qu'une décoration à côté d'un seuil resté dans le code.

Les contrôles statiques sur le script (aucun seuil, aucune matière en dur, aucun intitulé
tronqué) sont dans tests/test_maquette.py, qui porte sur le script.
"""
import copy
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
sys.path.insert(0, str(RACINE / "scripts"))

import maquette_bilan as M  # noqa: E402
import validate_referentiel as V  # noqa: E402


@pytest.fixture(scope="module")
def bilan():
    return M.Bilan().calculer()


# ───────────────────────────────── forme du référentiel : RB-01 à RB-06

def test_le_referentiel_courant_passe_tous_les_controles(regles_bilan, ref, catalogue):
    err, _ = V.controler_regles_bilan(regles_bilan, ref, catalogue)
    assert not err, err


def test_rb01_refuse_des_paliers_non_ordonnes(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["niveaux_competence"]["paliers"].reverse()
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-01" in e for e in err)


def test_rb02_refuse_un_niveau_sans_rythme(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    del rb["rythmes_hebdomadaires"]["par_niveau"]["Fragile"]
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-02" in e and "Fragile" in e for e in err)


def test_rb03_refuse_une_part_notee_en_pourcentage(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["agregats"]["prerequis"]["seuil_remise_a_niveau"] = 40
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-03" in e for e in err)


def test_rb03_refuse_une_fraction_superieure_a_un(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["palier_de_profondeur"]["fraction"]["numerateur"] = 4
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-03" in e for e in err)


def test_rb04_refuse_une_calibration_adossee_au_questionnaire(regles_bilan, ref, catalogue):
    """EC-23 : le § 5.4 fait reposer la calibration par compétence sur le bloc 0."""
    rb = copy.deepcopy(regles_bilan)
    rb["indice_calibration"]["portee"]["par_competence"] = {
        "variable_qp": "auto_francais", "source": "questionnaire de parcours"}
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-04" in e and "bloc 0" in e for e in err)


def test_rb04_exige_la_regle_du_domaine_non_renseigne(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["indice_calibration"]["portee"]["par_competence"].pop("non_renseignee")
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-04" in e and "sans réponse" in e for e in err)


def test_rb05_refuse_un_seuil_de_charge_inatteignable(regles_bilan, ref, catalogue):
    """Le seuil de 20 h du Cahier : la raison d'être de Q-18, retrouvée par le contrôle."""
    rb = copy.deepcopy(regles_bilan)
    # Depuis MATH-EA, la charge maximale atteignable est de 21 h : le seuil du Cahier
    # (20 h) est redevenu atteignable, et le contrôle ne doit plus le refuser. C'est
    # au-delà de ce maximum qu'un seuil devient inatteignable.
    rb["alerte_charge"]["seuil_heures"] = 25
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-05" in e for e in err), \
        "le contrôle laisse passer un seuil que la matrice du § 3.2 rend inatteignable"
    assert any("21 h" in e for e in err if "RB-05" in e), \
        "le message doit nommer la charge maximale réellement atteignable"


def test_rb05_accepte_le_seuil_du_cahier_depuis_math_ea(regles_bilan, ref, catalogue):
    """Constat de la création de MATH-EA : le seuil de 20 h est redevenu atteignable.

    EC-18 avait abaissé le seuil à 15 h en invoquant l'impossibilité d'atteindre 20 h avec
    six matières. Le périmètre corrigé en compte sept pour un P3 sans spécialité
    mathématiques : la prémisse était fausse, et Q-27 a rétabli le seuil du Cahier.
    """
    assert regles_bilan["alerte_charge"]["seuil_heures"] == \
        regles_bilan["alerte_charge"]["seuil_cahier_initial"]
    err, _ = V.controler_regles_bilan(regles_bilan, ref, catalogue)
    assert not [e for e in err if "RB-05" in e]
    assert "21 h" in regles_bilan["alerte_charge"]["retablissement"]["motif"]


def test_rb05_refuse_aussi_un_indicateur_de_vigilance_inatteignable(regles_bilan, ref,
                                                                    catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["vigilance_charge_elevee"]["seuil_heures"] = 30
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-05" in e and "vigilance" in e for e in err)


def test_rb06_refuse_un_seuil_de_vigilance_sans_motif(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["vigilance_charge_elevee"]["motif"] = ""
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-06" in e for e in err)


def test_rb06_refuse_un_seuil_de_sequencement_amende_sans_motif(regles_bilan, ref,
                                                                catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["seuil_heures"] = 15
    rb["alerte_charge"]["retablissement"]["motif"] = ""
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-06" in e and "séquencement" in e for e in err)


# ───────────────────────────────── RB-11 · un indicateur ajouté ne remplace pas la règle

def test_rb11_refuse_que_le_seuil_du_cahier_se_compare_largement(regles_bilan, ref,
                                                                 catalogue):
    """Le § 8.2 écrit « dépasse » : comparer par « atteint » change la règle citée."""
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["comparaison"] = "atteint"
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-11" in e for e in err)


def test_rb11_refuse_un_indicateur_de_vigilance_au_dessus_du_seuil(regles_bilan, ref,
                                                                   catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["vigilance_charge_elevee"]["seuil_heures"] = 20
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-11" in e and "remplacerait" in e for e in err)


def test_rb11_refuse_un_indicateur_de_vigilance_qui_impose_quelque_chose(regles_bilan, ref,
                                                                         catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["vigilance_charge_elevee"]["effet"] = "sequencement"
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-11" in e and "n'impose" in e for e in err)


# ───────────────────────────────── source des valeurs : RB-07 à RB-09

def test_rb07_toutes_les_transcriptions_existent_dans_le_cahier(regles_bilan):
    prose = V.normaliser_cahier(V.CAHIER.read_text(encoding="utf-8"))
    cellules = V.cellules_cahier(V.CAHIER)
    absents = [(c, f) for c, f in V.transcriptions(regles_bilan)
               if V.normaliser_cahier(f) not in prose
               and not any(V.normaliser_cahier(f) in x for x in cellules)]
    assert not absents, absents


def test_rb07_refuse_une_citation_fabriquee(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["niveaux_competence"]["paliers"][0]["transcription_cahier"].append(
        "le seuil du niveau Solide est fixé à 80 %")
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-07" in e for e in err)


def test_rb07_lit_les_cellules_des_tableaux(regles_bilan):
    """Les seuils du § 5.2 sont dans un tableau à colonnes fixes : sans le parseur de
    cellules, aucune de leurs transcriptions ne serait retrouvée et le contrôle
    échouerait à tort — ou, pire, serait désactivé pour les tableaux."""
    cellules = V.cellules_cahier(V.CAHIER)
    prose = V.normaliser_cahier(V.CAHIER.read_text(encoding="utf-8"))
    frag = regles_bilan["niveaux_competence"]["paliers"][0]["transcription_cahier"][1]
    assert frag not in prose, "ce fragment n'est plus dans un tableau : choisir un autre"
    assert any(frag in c for c in cellules)


def test_rb08_refuse_une_section_sans_source(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["grand_oral"].pop("transcription_cahier")
    rb["grand_oral"].pop("ecart")
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-08" in e and "grand_oral" in e for e in err)


def test_rb08_refuse_un_ecart_sans_decision(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["priorite_matieres"]["ecart"].pop("decision")
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-08" in e for e in err)


def test_rb09_refuse_une_version_de_specialite_non_ouverte(regles_bilan, ref, catalogue):
    cat = copy.deepcopy(catalogue)
    cat["conventions"]["selection_version_specialite"]["par_profil"]["P2"]["toutes"] = "N1"
    err, _ = V.controler_regles_bilan(regles_bilan, ref, cat)
    assert any("RB-09" in e for e in err)


# ───────────────────────────────── le moteur suit-il le référentiel ?

def test_les_niveaux_suivent_le_referentiel(bilan):
    part = 0.60
    assert bilan.niveau(part) == "En consolidation"
    b = copy.deepcopy(bilan)
    for p in b.regles["niveaux_competence"]["paliers"]:
        if p["libelle"] == "En consolidation":
            p["seuil_min"] = 0.65
    assert b.niveau(part) == "Fragile", \
        "le niveau n'a pas suivi le seuil du référentiel : la valeur est lue ailleurs"


def test_le_seuil_de_prerequis_suit_le_referentiel(bilan):
    pc = "EDS-PC"
    assert bilan.module_entree(pc)[0] != "Remise à niveau"
    b = copy.deepcopy(bilan)
    b.regles["agregats"]["prerequis"]["seuil_remise_a_niveau"] = 0.99
    assert b.module_entree(pc)[0] == "Remise à niveau", \
        "le module d'entrée ne suit pas le seuil de prérequis du référentiel"


def test_le_palier_de_profondeur_suit_le_referentiel(bilan):
    b = copy.deepcopy(bilan)
    b.regles["palier_de_profondeur"]["fraction"] = {"numerateur": 1, "denominateur": 1}
    b.scores()
    stricts = sum(1 for x in b.res.values() if x["palier"] != "—")
    larges = sum(1 for x in bilan.res.values() if x["palier"] != "—")
    assert stricts < larges, "le palier de profondeur ignore la fraction du référentiel"


def test_le_palier_de_profondeur_se_compare_en_fraction_exacte(bilan):
    """Régression : la part avait d'abord été stockée en décimale (0,6667), supérieure à
    2/3. Vingt paliers réussis 4 points sur 6 étaient alors silencieusement déclassés."""
    f = bilan.regles["palier_de_profondeur"]["fraction"]
    assert 4 * f["denominateur"] >= f["numerateur"] * 6, \
        "4 points sur 6 n'atteignent plus deux tiers : la part est arrondie par excès"
    assert M.document(bilan).count("| D2 |") > 0


def test_le_seuil_de_charge_apparait_calcule_dans_le_document(bilan):
    seuil = bilan.regles["alerte_charge"]["seuil_heures"]
    assert f"Seuil de séquencement : **{seuil} h**" in M.document(bilan)
    b = copy.deepcopy(bilan)
    b.regles["alerte_charge"]["seuil_heures"] = seuil + 1
    assert f"Seuil de séquencement : **{seuil + 1} h**" in M.document(b), \
        "le document réécrit le seuil au lieu de le lire"


def test_lecart_de_calibration_suit_le_referentiel(bilan):
    b = copy.deepcopy(bilan)
    b.regles["indice_calibration"]["ecart_signal"] = 99
    assert all(e["signal"] is None for _, e in b.calibration_competences()), \
        "un signal de calibration subsiste au-delà du seuil du référentiel"


def test_le_delai_de_reevaluation_est_lu_au_referentiel(bilan):
    d = bilan.regles["evaluation_intermediaire"]["delai_semaines"]
    assert f"à {d} semaines" in M.document(bilan)


# ───────────────────────────────── registre unique des écarts : RB-10

def test_rb10_refuse_un_ecart_sans_renvoi_au_registre(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["grand_oral"]["ecart"].pop("ref")
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-10" in e for e in err)


def test_rb10_refuse_un_renvoi_vers_un_ecart_inexistant(regles_bilan, ref, catalogue):
    rb = copy.deepcopy(regles_bilan)
    rb["grand_oral"]["ecart"]["ref"] = "EC-99"
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-10" in e and "EC-99" in e for e in err)


def test_rb10_refuse_le_texte_de_lecart_recopie(regles_bilan, ref, catalogue):
    """Un écart raconté à deux endroits finit par diverger : le registre est unique."""
    rb = copy.deepcopy(regles_bilan)
    rb["alerte_charge"]["ecart"]["constat"] = "une autre version du constat"
    err, _ = V.controler_regles_bilan(rb, ref, catalogue)
    assert any("RB-10" in e and "recopie" in e for e in err)


def test_le_document_cite_le_registre_et_non_une_copie(bilan):
    """La prose de la maquette lit le registre : changer le registre change la prose."""
    texte = M.document(bilan)
    for ref_ec in ("EC-16", "EC-17", "EC-18", "EC-19", "EC-20", "EC-21", "EC-22"):
        assert ref_ec in texte, f"{ref_ec} n'est pas nommé dans la maquette"
    b = copy.deepcopy(bilan)
    for e in b.ref["ecarts_cahier"]:
        if e["ref"] == "EC-20":
            e["arbitrage"] = "Texte de contrôle du registre."
    assert "Texte de contrôle du registre." in M.document(b), \
        "la prose porte sa propre copie de l'écart au lieu de lire le registre"
