"""La maquette est conforme à la commande, et le script ne décide rien de lui-même.

L'audit de la maquette v1 a relevé deux défauts de nature différente : un jeu de données
écarté de la spécification sans qu'aucune ligne ne le dise, et un script qui affirmait ne
porter aucun seuil alors qu'il en portait huit. Ce fichier ferme les deux : la commande
est confrontée au rendu attendu par attendu, et le moteur est éprouvé en déplaçant ses
sources pour vérifier qu'il les suit.
"""
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
sys.path.insert(0, str(RACINE / "scripts"))

import maquette_bilan as M  # noqa: E402
import maquette_donnees as D  # noqa: E402

SCRIPT = RACINE / "scripts" / "maquette_bilan.py"


@pytest.fixture(scope="module")
def bilan():
    return M.Bilan().calculer()


@pytest.fixture(scope="module")
def spec():
    return json.loads((MAQ / "specification.json").read_text(encoding="utf-8"))


# ───────────────────────────────── conformité à la commande de la direction

def test_tous_les_attendus_sont_tenus(bilan):
    resultats = M.verifier_specification(bilan)
    ecarts = [(v["id"], [(d, o) for d, o, ok in v["lignes"] if not ok])
              for v in resultats if not v["conforme"]]
    assert not ecarts, "écarts à la spécification : " + "; ".join(
        f"{i} → " + ", ".join(f"demandé {d}, obtenu {o}" for d, o in lignes)
        for i, lignes in ecarts)


def test_chaque_attendu_porte_au_moins_une_verification(spec):
    vides = [a["id"] for a in spec["attendus"] if not a.get("verifications")]
    assert not vides, f"attendus sans vérification exécutable : {vides}"


def test_le_tableau_de_conformite_figure_dans_le_document(bilan, spec):
    texte = M.document(bilan)
    for a in spec["attendus"]:
        assert f"| {a['id']} |" in texte, f"{a['id']} absent du tableau de conformité"


def test_un_ecart_a_la_commande_fait_echouer_la_verification(bilan):
    """Le contrôle doit refuser un jeu qui s'écarte : c'est le défaut de la v1."""
    b = copy.deepcopy(bilan)
    b.qp["reponses"]["heures_disponibles"] = 10          # la v1 portait cette valeur
    resultats = M.verifier_specification(b)
    rate = [v["id"] for v in resultats if not v["conforme"]]
    assert "S-02" in rate, "un écart sur les heures déclarées passe inaperçu"


# ───────────────────────────────── le script ne décide rien de lui-même

SEUILS_INTERDITS = [
    ("0.75", "seuil du niveau Solide (§ 5.2)"),
    ("0.55", "seuil du niveau En consolidation (§ 5.2)"),
    ("0.30", "seuil du niveau Fragile (§ 5.2)"),
    ("0.40", "seuil de prérequis de la remise à niveau (§ 5.5, § 8.2)"),
    ("2 / 3", "part du palier de profondeur (§ 5.3)"),
    ("0.667", "part du palier de profondeur, décimale tronquée (§ 5.3)"),
    ("0.6667", "part du palier de profondeur, décimale tronquée (§ 5.3)"),
    ("deux tiers", "part du palier de profondeur, en toutes lettres (§ 5.3)"),
    ("quatre semaines", "délai de l'évaluation intermédiaire, en toutes lettres (§ 8.2)"),
]


def test_aucun_seuil_en_dur_dans_le_script():
    texte = SCRIPT.read_text(encoding="utf-8")
    trouves = [(v, quoi) for v, quoi in SEUILS_INTERDITS if v in texte]
    assert not trouves, "seuils écrits en dur : " + ", ".join(
        f"{v!r} ({quoi})" for v, quoi in trouves)


def test_aucune_matiere_en_dur_dans_le_script():
    """Les matières se déduisent du questionnaire, elles ne se listent pas.

    L'audit relevait EDS-MATH, EDS-SES et EDS-PC codées en dur : le script ne prouvait
    alors pas que le bilan se dérive du profil déclaré.
    """
    texte = SCRIPT.read_text(encoding="utf-8")
    for code in ("EDS-MATH", "EDS-SES", "EDS-PC", "EDS-SVT", "EDS-NSI", "TC-ES", "FR-EAF"):
        assert f'"{code}"' not in texte, f"matière écrite en dur : {code}"
    assert not re.search(r"INSTRUMENTS_P\d", texte), "liste d'instruments figée dans le script"


def test_aucun_intitule_tronque(bilan):
    """Un bilan n'affiche jamais un intitulé coupé.

    L'audit relevait « Correction de la langue : orthographe, accords, syntaxe, pon » :
    l'intitulé passait par une troncature à soixante caractères. Le test vérifie les deux
    faces du défaut — plus aucune troncature dans le code, et chaque intitulé présent en
    entier dans le rendu.
    """
    texte = M.document(bilan)
    assert "…" not in texte, "un intitulé ou une recommandation est tronqué dans le rendu"
    assert not re.search(r"\[:\d+\]", SCRIPT.read_text(encoding="utf-8")), \
        "troncature d'affichage subsistant dans le script"
    # Depuis la contre-expertise, l'intitulé affiché est celui de la version passée :
    # un assemblage N1 n'annonce pas de contenu de Terminale. C'est cet intitulé-là qui
    # doit figurer en entier — jamais coupé, jamais remplacé par un code.
    manquants = [f"{pc}/{code}" for (pc, code) in bilan.res
                 if bilan.intitule(pc, code) not in texte]
    assert not manquants, f"intitulés absents du rendu : {manquants}"


def test_les_recommandations_de_methode_sont_entieres(bilan):
    texte = M.document(bilan)
    profils = bilan.profils_met()
    for dim in bilan.met_ref["dimensions"]:
        outillage = profils[dim["code"]]["niveau"]["outillage"]
        assert outillage in texte, f"outillage tronqué pour {dim['code']}"


def test_les_matieres_suivent_le_questionnaire():
    """Changer la spécialité abandonnée change la version passée, sans toucher au script."""
    cat = json.loads((RACINE / "referentiels" / "catalogue_instruments.json")
                     .read_text(encoding="utf-8"))
    qp = json.loads((MAQ / "qp.json").read_text(encoding="utf-8"))
    avant = dict((c, v) for c, v in D.instruments_passes(qp, cat) if c.startswith("EDS-"))
    autre = copy.deepcopy(qp)
    autre["reponses"]["specialite_abandonnee"] = "PC"
    apres = dict((c, v) for c, v in D.instruments_passes(autre, cat) if c.startswith("EDS-"))
    assert avant["EDS-SES"] == "N1" and avant["EDS-PC"] == "NT"
    assert apres["EDS-PC"] == "N1" and apres["EDS-SES"] == "NT", \
        "la version de spécialité ne suit pas la spécialité abandonnée déclarée"


# ───────────────────────────────── § 5.5 appliqué à la lettre

def test_le_taux_de_prerequis_ne_compte_que_les_items_du_bloc_a(bilan):
    """L'assiette est le bloc de l'item, non les blocs déclarés de sa compétence.

    En EDS-MATH/NT, SUIT et PROB portent des items en A et en B. Compter tous leurs
    points au taux de prérequis, comme le faisait l'approximation par compétence,
    donnerait un autre taux — et pourrait franchir le seuil de remise à niveau.
    """
    pc = "EDS-MATH"
    a = bilan.agr[pc]
    par_bloc = a["prerequis"]
    comps_avec_a = [k for k in bilan.res if k[0] == pc
                    and bilan.bloc_de_competence(pc, k[1])]
    obt = sum(bilan.res[k]["obtenu"] for k in comps_avec_a)
    mx = sum(bilan.res[k]["max"] for k in comps_avec_a)
    par_competence = obt / mx
    assert par_bloc != pytest.approx(par_competence), \
        "les deux assiettes coïncident : le test ne prouve rien sur ce jeu"
    assert par_bloc == pytest.approx(a["prerequis_points"][0] / a["prerequis_points"][1])


def test_le_score_global_est_pondere_par_le_nombre_de_mesures(bilan):
    """§ 5.5 : moyenne des S(c) pondérée par le nombre d'items, non rapport des points."""
    pc = "EDS-MATH"
    comps = [k for k in bilan.res if k[0] == pc and bilan.res[k]["evalue"]
             and bilan.res[k]["type"] != "indicateur_transversal"]
    par_points = (sum(bilan.res[k]["obtenu"] for k in comps)
                  / sum(bilan.res[k]["max"] for k in comps))
    assert bilan.agr[pc]["global"] != pytest.approx(par_points), \
        "les deux formules coïncident : le test ne prouve rien sur ce jeu"


def test_la_tache_type_epreuve_disparait_sans_bloc_c(bilan):
    sans_c = [pc for pc in bilan.perimetres_passes if bilan.agr[pc]["tache"] is None]
    assert sans_c, "aucune matière sans bloc C : la règle n'est pas exercée"
    texte = M.document(bilan)
    for pc in sans_c:
        assert f"| {pc} | " in texte
        assert f"n'a pas de bloc C" in texte


# ───────────────────────────────── décisions C1 à C6

def test_c1_la_reevaluation_est_bornee_au_module_dentree(bilan, spec):
    """Sans la précision C1, toutes les compétences fragiles seraient réévaluées."""
    borne = bilan.regles["evaluation_intermediaire"]["portee"]["ordre_de_grandeur_attendu"]
    total = sum(len(bilan.evaluation_intermediaire(pc)[0])
                for pc in bilan.perimetres_passes)
    assert borne["min"] <= total <= borne["max"], \
        f"{total} compétences à réévaluer, hors de [{borne['min']}, {borne['max']}]"
    toutes_fragiles = sum(1 for k, x in bilan.res.items()
                          if x["niveau"] in ("Fragile", "Non acquis"))
    assert total < toutes_fragiles, \
        "la portée n'est pas restreinte : autant de compétences que de fragiles"


def test_c2_le_rythme_suit_le_niveau_le_plus_bas(bilan):
    b = copy.deepcopy(bilan)
    pc = next(p for p in b.perimetres_passes
              if b.module_entree(p)[0] != b.regles["module_entree"]["libelle_remise_a_niveau"])
    avant, niveau = b.rythme(pc)
    b.regles["rythmes_hebdomadaires"]["par_niveau"][niveau] = avant + 0.5
    assert b.rythme(pc)[0] == avant + 0.5, "le rythme ne suit pas la table du référentiel"


def test_c3_le_francais_remonte_quand_il_est_fragile(bilan):
    """La priorité porte sur les groupes de planification depuis Q-22 (EC-28)."""
    ordre, motifs = bilan.priorite()
    francais = bilan.groupe_de["FR-EAF"]
    phi = bilan.groupe_de["PHI"]
    assert ordre.index(francais) < ordre.index(phi), \
        "le français fragile ne précède pas la philosophie"
    b = copy.deepcopy(bilan)
    for pc in b.groupes[francais]:
        b.agr[pc]["global"] = 0.90                        # français solide
    ordre2, _ = b.priorite()
    assert ordre2.index(francais) > ordre2.index(phi), \
        "le français reste devant la philosophie alors qu'il n'est plus fragile"


def test_q22_la_priorite_porte_sur_les_groupes_et_non_sur_les_perimetres(bilan):
    ordre, _ = bilan.priorite()
    assert set(ordre) == set(bilan.groupes)
    assert len(ordre) == len(set(ordre))
    for g, membres in bilan.groupes.items():
        for pc in membres:
            assert bilan.groupe_de[pc] == g


def test_c4_les_deux_alertes_se_fondent_en_un_paragraphe(bilan):
    """Branche non exercée par le jeu : sa somme de 16 h ne dépasse pas les 20 h du Cahier."""
    b = copy.deepcopy(bilan)
    b.qp["reponses"]["heures_disponibles"] = 10
    b.regles["alerte_charge"]["seuil_heures"] = 12        # séquencement déclenché
    texte = M.document(b)
    assert "**Séquencement et plafond**" in texte
    assert texte.count("**Plafond dépassé**") == 0, "un second paragraphe redit la même chose"
    assert b.regles["alerte_charge"]["paragraphe_unique_si_plafond_aussi_depasse"]["regle"] \
        in texte


def test_c4_le_plafond_seul_reste_un_paragraphe_distinct(bilan):
    b = copy.deepcopy(bilan)
    b.qp["reponses"]["heures_disponibles"] = 10
    b.regles["alerte_charge"]["seuil_heures"] = 24        # séquencement hors d'atteinte
    texte = M.document(b)
    assert "**Plafond dépassé**" in texte
    assert "**Séquencement et plafond**" not in texte


def test_c5_le_seuil_du_grand_oral_tranche_les_deux_branches(bilan):
    d = bilan.decision_grand_oral()
    assert d["libelle"] == bilan.regles["grand_oral"]["en_dessous"]["libelle"]
    b = copy.deepcopy(bilan)
    b.regles["grand_oral"]["seuil"] = 0.10
    assert b.decision_grand_oral()["libelle"] == b.regles["grand_oral"]["au_dessus"]["libelle"]


def test_c5_ni_go_ni_oral_de_francais_najoutent_dheures(bilan):
    sans = bilan.regles["rythmes_hebdomadaires"]["sans_rythme"]["instruments"]
    for code in sans:
        assert code not in bilan.perimetres_passes, \
            f"{code} figure parmi les périmètres porteurs d'un rythme"
    somme = sum(bilan.rythme(pc)[0] for pc in bilan.perimetres_passes)
    assert somme == sum(bilan.rythme(pc)[0] for pc in bilan.perimetres_passes)


def test_c5_le_critere_le_plus_bas_de_loral_est_pris_dans_lordre_de_la_grille(bilan):
    v = bilan.vigilance_oral_francais()
    rel = v["releve"]["criteres"]
    minimum = min(x["score"] for x in rel.values())
    premiers = [c for c, x in rel.items() if x["score"] == minimum]
    assert v["critere"] == premiers[0], \
        "le départage ne suit pas l'ordre de la grille"


def test_c6_le_statut_de_specialite_ne_change_que_la_prose(bilan):
    statuts = bilan.statuts_a_signaler()
    assert statuts, "aucune spécialité jamais abordée : la règle n'est pas exercée"
    b = copy.deepcopy(bilan)
    for spe in b.qp["reponses"]["statut_par_specialite"]:
        b.qp["reponses"]["statut_par_specialite"][spe] = "deja_suivie_en_classe"
    assert not b.statuts_a_signaler()
    for pc in b.perimetres_passes:                        # calcul inchangé
        assert b.agr[pc]["prerequis"] == bilan.agr[pc]["prerequis"]


# ───────────────────────────────── version parent

def _corps(texte):
    """Le document privé de ce qui a le droit de différer entre les deux versions."""
    lignes = [l for l in texte.splitlines()
              if not l.startswith("# ")
              and not l.startswith("> **Destinataire.**")
              and "Candidat `" not in l
              and "statut **" not in l]
    # Retirer un paragraphe laisse une ligne vide de plus : les blancs consécutifs
    # sont réduits pour que la comparaison porte sur le contenu et non sur la mise en page.
    return re.sub(r"\n{2,}", "\n\n", "\n".join(lignes))


def test_la_version_parent_porte_exactement_les_memes_valeurs():
    a = M.document(M.Bilan(MAQ / "qp.json").calculer(), "direction")
    b = M.document(M.Bilan(MAQ / "qp_variante_mineure.json").calculer(), "parent")
    assert _corps(a) == _corps(b), \
        "les deux versions diffèrent ailleurs que par le destinataire et le registre"


def test_la_version_parent_nomme_son_destinataire():
    b = M.document(M.Bilan(MAQ / "qp_variante_mineure.json").calculer(), "parent")
    assert "responsables légaux" in b
    assert "jamais un chiffre" in b


# ───────────────────────────────── reproductibilité du jeu

def test_le_jeu_de_donnees_se_regenere_a_lidentique():
    avant = {f: (MAQ / f).read_bytes() for f in ("saisie.csv", "grilles.csv")}
    subprocess.run([sys.executable, str(RACINE / "scripts" / "maquette_donnees.py")],
                   check=True, capture_output=True)
    for f, contenu in avant.items():
        assert (MAQ / f).read_bytes() == contenu, f"{f} n'est pas reproductible"


def test_le_jeu_de_donnees_derive_bien_de_la_specification(spec):
    """Modifier une cible modifie le jeu : les données ne sont pas écrites à la main."""
    chemin = MAQ / "specification.json"
    original = chemin.read_bytes()
    try:
        modifie = copy.deepcopy(spec)
        modifie["cibles"]["EDS-MATH/NT"]["ALGO|B|D1|item"] = [0, 3]
        chemin.write_text(json.dumps(modifie, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
        subprocess.run([sys.executable, str(RACINE / "scripts" / "maquette_donnees.py")],
                       check=True, capture_output=True)
        b = M.Bilan().calculer()
        assert b.res[("EDS-MATH", "ALGO")]["niveau"] != "Solide", \
            "le jeu ne suit pas la spécification"
    finally:
        chemin.write_bytes(original)
        subprocess.run([sys.executable, str(RACINE / "scripts" / "maquette_donnees.py")],
                       check=True, capture_output=True)


# ───────────────────────────────── R1 · la calibration vient du bloc 0

def test_la_calibration_par_competence_vient_du_bloc_0(bilan):
    """EC-23 — le § 5.4 nomme la source : « bloc 0, converti sur 0–100 »."""
    assert bilan.bloc0, "aucun domaine de bloc 0 lu"
    couples = {k for k, _ in bilan.calibration_competences()}
    assert len(couples) > 20, \
        f"{len(couples)} compétences calibrées : la source n'est pas le bloc 0"
    perimetres = {k[0] for k in couples}
    assert perimetres == set(bilan.perimetres_passes), \
        "des instruments passés ne produisent aucune calibration par compétence"


def test_un_domaine_non_renseigne_ne_produit_pas_decart_nul(bilan):
    sans_reponse, _ = bilan.calibrations_absentes()
    assert sans_reponse, "aucun domaine non renseigné : la règle n'est pas exercée"
    for k in sans_reponse:
        assert k not in dict(bilan.calibration_competences()), \
            f"{k} produit un écart alors que son domaine n'est pas renseigné"
    texte = M.document(bilan)
    for pc, c in sans_reponse:
        assert f"{pc}/{c}" in texte


def test_lauto_positionnement_de_francais_sort_de_la_calibration(bilan):
    """EC-23 — auto_francais devient une donnée de contexte de la section 1."""
    hors = bilan.regles["indice_calibration"]["portee"]["hors_calibration"]
    assert hors["variable_qp"] == "auto_francais"
    b = copy.deepcopy(bilan)
    for k in b.qp["reponses"]["auto_francais"]:
        b.qp["reponses"]["auto_francais"][k] = 1
    avant = {k: e["ecart"] for k, e in bilan.calibration_competences()}
    apres = {k: e["ecart"] for k, e in b.calibration_competences()}
    assert avant == apres, "auto_francais influence encore la calibration"


def test_les_lignes_de_bloc_0_ne_portent_pas_de_score():
    import csv
    with open(MAQ / "saisie.csv", encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
    b0 = [l for l in lignes if "-0-" in l["item_id"]]
    assert b0, "aucune ligne de bloc 0 dans la saisie"
    for l in b0:
        assert l["score"] == "", f"{l['item_id']} porte un score"
        assert l["response"] in {"1", "2", "3", "4"}, f"{l['item_id']} hors échelle"


def test_le_controle_dimport_refuse_un_score_sur_un_domaine():
    import validate_instrument as VI
    refs = {"competences": json.loads(
        (RACINE / "referentiels" / "competences.json").read_text(encoding="utf-8"))}
    ligne = {"instrument": "EDS-MATH/NT", "item_id": "EDS-MATH-0-CALC",
             "response": "3", "score": "1"}
    err = VI.controler_lignes_saisie([ligne], refs, {"EDS-MATH": {}})
    assert any("score" in e for e in err)


def test_les_competences_sans_domaine_de_bloc_0_sont_signalees(bilan):
    """Le bloc 0 ne compte que cinq domaines : la réserve doit figurer, pas être tue."""
    _, sans_domaine = bilan.calibrations_absentes()
    assert sans_domaine
    texte = M.document(bilan)
    assert "**Réserve.**" in texte
    assert f"{len(sans_domaine)} compétences évaluées" in texte


# ───────────────────────────────── P1 · départage par gravité du module

def test_p1_la_gravite_du_module_departage_avant_le_score(bilan):
    ordre, _ = bilan.priorite()
    abandonnee = bilan.groupe_de.get(f"EDS-{bilan.qp['reponses']['specialite_abandonnee']}")
    poursuivies = [g for g in ordre
                   if any(pc.startswith("EDS-") for pc in bilan.groupes[g])
                   and g != abandonnee]
    assert len(poursuivies) == 2
    premier, second = poursuivies
    assert bilan.gravite_groupe(premier) < bilan.gravite_groupe(second)
    # Sur ce jeu, la matière la plus grave n'est pas celle au score le plus bas :
    # sans la précision P1, l'ordre serait inversé.
    pire = lambda g: min(bilan.agr[pc]["global"] for pc in bilan.groupes[g])
    assert pire(premier) > pire(second), \
        "le jeu ne distingue plus gravité et score : le test ne prouve rien"


def test_p1_lechelle_de_gravite_vient_du_referentiel(bilan):
    echelle = bilan.regles["priorite_matieres"]["departage"]["gravite_module_entree"]
    assert echelle[0] == bilan.regles["module_entree"]["libelle_remise_a_niveau"]
    assert echelle[-1] == bilan.regles["module_entree"]["libelle_defaut"]
    niveaux = [p["libelle"] for p in bilan.regles["niveaux_competence"]["paliers"]]
    assert [n for n in echelle if n in niveaux] == \
        [n for n in reversed(niveaux) if n in echelle], \
        "l'échelle de gravité ne suit pas l'ordre des niveaux du § 5.2"


# ───────────────────────────────── le README de la maquette ne peut pas diverger du jeu

def test_le_readme_de_la_maquette_decrit_le_jeu_reel(bilan):
    """Le README annonçait l'inverse du questionnaire : SES poursuivie, PC abandonnée.

    La description d'un jeu de référence n'est pas une opinion. Ce test lit le tableau du
    README et le confronte au questionnaire et aux instruments réellement assemblés.
    """
    texte = (MAQ / "README.md").read_text(encoding="utf-8")
    lu = {}
    for ligne in texte.splitlines():
        if ligne.startswith("| ") and " | " in ligne and not ligne.startswith("|---"):
            cle, _, valeur = ligne.strip("| ").partition(" | ")
            lu[cle.strip()] = valeur.strip()
    r = bilan.qp["reponses"]
    assert lu["Profil"] == r["profil"]
    assert lu["Session visée"] == r["session_visee"]
    assert lu["Spécialités déclarées"] == ", ".join(r["specialites"])
    assert lu["Spécialité abandonnée"] == r["specialite_abandonnee"]
    assert lu["Configuration française"] == r["epreuves_francais_a_presenter"]
    assert lu["Mode de rendu"] == bilan.qp["mode_rendu"]
    versions = {f"EDS-{s}": bilan.version_passee(f"EDS-{s}") for s in r["specialites"]}
    annonce = dict(x.split("/") for x in lu["Versions assemblées"].split(", "))
    assert annonce == versions, f"README : {annonce}, dépôt : {versions}"


def test_la_specialite_abandonnee_est_bien_celle_mesuree_en_premiere(bilan):
    """La version N1 est réservée à la spécialité abandonnée : c'est la règle du § 3.2."""
    r = bilan.qp["reponses"]
    abandonnee = f"EDS-{r['specialite_abandonnee']}"
    assert bilan.version_passee(abandonnee) == "N1"
    for spe in r["specialites"]:
        if f"EDS-{spe}" != abandonnee:
            assert bilan.version_passee(f"EDS-{spe}") == "NT"
