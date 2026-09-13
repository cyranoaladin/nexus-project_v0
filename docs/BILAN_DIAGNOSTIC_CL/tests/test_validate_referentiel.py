"""Preuve que validate_referentiel.py sait échouer.

Un cas par défaut injecté. Chaque cas affirme que le validateur produit une
erreur ET que le message désigne bien le défaut : un validateur qui échoue
pour la mauvaise raison ne vaut pas mieux qu'un validateur qui ne échoue pas.

Le dernier groupe vérifie le comportement des exceptions de domaine : une
occurrence couverte passe, la même occurrence hors périmètre bloque.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import validate_referentiel as V


# ─────────────────────────────────────────────── cas positif : rien n'est cassé

def test_referentiels_reels_sans_erreur(ref, codes_erreur, termes, catalogue):
    err = []
    for fn, args in ((V.controler, (ref,)),
                     (V.controler_codes_erreur, (codes_erreur, ref, termes)),
                     (V.controler_termes_bloquants, (termes, ref)),
                     (V.controler_catalogue, (catalogue, ref))):
        e, _ = fn(*args)
        err += e
    assert err == [], "\n".join(err)


# ─────────────────────────────────────────────── référentiel de compétences

def test_competence_hors_cahier_sans_ecart_declare(ref, abime):
    def casse(r):
        tc = next(p for p in r["perimetres"] if p["code"] == "TC-ES")
        next(c for c in tc["competences"] if c["code"] == "ASTR").pop("ecart_cahier")
    err, _ = V.controler(abime(ref, casse))
    assert any("surnuméraire" in e and "ASTR" in e for e in err), err


def test_competence_du_cahier_supprimee_sans_ecart(ref, abime):
    def casse(r):
        p = next(x for x in r["perimetres"] if x["code"] == "EDS-MATH")
        p["competences"] = [c for c in p["competences"] if c["code"] != "SUIT"]
    err, _ = V.controler(abime(ref, casse))
    assert any("SUIT" in e and "absente" in e for e in err), err


def test_etat_non_evaluee_interdit_dans_le_referentiel(ref, abime):
    def casse(r):
        c = next(x for x in r["perimetres"] if x["code"] == "EDS-MATH")["competences"][0]
        c["etat_par_version"]["N1"] = "non_evaluee"
    err, _ = V.controler(abime(ref, casse))
    assert any("non_evaluee" in e and "moteur" in e for e in err), err


def test_blocs_incoherents_avec_etat_de_version(ref, abime):
    def casse(r):
        c = next(x for x in r["perimetres"] if x["code"] == "EDS-MATH")
        t = next(y for y in c["competences"] if y["code"] == "TRIG")
        t["blocs"]["NT"] = ["B"]  # déclarée hors_version, mais dotée d'un bloc
    err, _ = V.controler(abime(ref, casse))
    assert any("TRIG" in e and "incohérent" in e for e in err), err


def test_chapitre_incertain_sans_note_explicative(ref, abime):
    def casse(r):
        c = next(x for x in r["perimetres"] if x["code"] == "EDS-SES")
        p = next(y for y in c["competences"] if y["code"] == "POL")
        p["chapitres"][-1].pop("note", None)
    err, _ = V.controler(abime(ref, casse))
    assert any("sans note explicative" in e for e in err), err


def test_indicateur_transversal_sans_source_declaree(ref, abime):
    def casse(r):
        h = next(x for x in r["perimetres"] if x["code"] == "EDS-HLP")
        next(y for y in h["competences"] if y["code"] == "LANG").pop("evaluee_par")
    err, _ = V.controler(abime(ref, casse))
    assert any("evaluee_par" in e for e in err), err


# ─────────────────────────────────────────────── codes d'erreur

def test_terme_bloquant_dans_un_libelle_de_code(codes_erreur, ref, termes, abime):
    """Les libellés sont recopiés dans le bilan : ils subissent le régime de la prose."""
    def casse(ce):
        ce["codes"][0]["libelle"] = "Lacune grave en accord"
    err, _ = V.controler_codes_erreur(abime(codes_erreur, casse), ref, termes)
    assert any("expression interdite" in e and "lacune" in e.lower() for e in err), err


def test_code_vers_competence_inconnue(codes_erreur, ref, termes, abime):
    def casse(ce):
        ce["codes"][0]["competences_concernees"] = ["FR-EAF/INEXISTANT"]
    err, _ = V.controler_codes_erreur(abime(codes_erreur, casse), ref, termes)
    assert any("compétence inconnue" in e for e in err), err


def test_libelle_de_plus_de_six_mots(codes_erreur, ref, termes, abime):
    def casse(ce):
        ce["codes"][0]["libelle"] = "Un libellé beaucoup trop long pour tenir en six mots"
    err, _ = V.controler_codes_erreur(abime(codes_erreur, casse), ref, termes)
    assert any("six mots" in e for e in err), err


def test_perimetre_sous_le_minimum_de_codes(codes_erreur, ref, termes, abime):
    def casse(ce):
        ce["codes"] = [c for c in ce["codes"] if c["matiere"] != "HLP"]
    err, _ = V.controler_codes_erreur(abime(codes_erreur, casse), ref, termes)
    assert any("EDS-HLP" in e and "minimum" in e for e in err), err


def test_code_hors_format_matiere_err_libelle(codes_erreur, ref, termes, abime):
    def casse(ce):
        ce["codes"][0]["code"] = "FR-FAUTE-ACCORD"
    err, _ = V.controler_codes_erreur(abime(codes_erreur, casse), ref, termes)
    assert any("format" in e for e in err), err


# ─────────────────────────────────────────────── termes bloquants

def test_mot_isole_interdit_en_contexte_disciplinaire(termes, ref, abime):
    def casse(tb):
        tb["expressions"].append({
            "motif": "retard", "categorie": "jugement",
            "contexte_interdit": ["enonce_candidat"], "exceptions_domaine": [], "source": "test"})
    err, _ = V.controler_termes_bloquants(abime(termes, casse), ref)
    assert any("mot isolé" in e for e in err), err


def test_mot_isole_admis_en_prose_de_bilan(termes, ref, abime):
    """Symétrique du précédent : « faible » est admis, ses contextes excluent les énoncés."""
    def casse(tb):
        tb["expressions"].append({
            "motif": "mediocrite", "categorie": "jugement",
            "contexte_interdit": ["prose_bilan"], "exceptions_domaine": [], "source": "test"})
    err, _ = V.controler_termes_bloquants(abime(termes, casse), ref)
    assert not any("mot isolé" in e for e in err), err


def test_exception_sans_perimetre_refusee(termes, ref, abime):
    def casse(tb):
        e = next(x for x in tb["expressions"] if x["motif"] == "en echec")
        e["exceptions_domaine"][0]["perimetres"] = []
    err, _ = V.controler_termes_bloquants(abime(termes, casse), ref)
    assert any("sans périmètre" in e for e in err), err


def test_exception_vers_perimetre_inconnu(termes, ref, abime):
    def casse(tb):
        e = next(x for x in tb["expressions"] if x["motif"] == "en echec")
        e["exceptions_domaine"][0]["perimetres"] = ["EDS-CHIMIE"]
    err, _ = V.controler_termes_bloquants(abime(termes, casse), ref)
    assert any("périmètre inconnu" in e for e in err), err


def test_regex_invalide_refusee(termes, ref, abime):
    def casse(tb):
        tb["expressions"][0]["regex"] = ["(non fermee"]
    err, _ = V.controler_termes_bloquants(abime(termes, casse), ref)
    assert any("invalide" in e for e in err), err


def test_motif_non_normalise_refuse(termes, ref, abime):
    def casse(tb):
        tb["expressions"][0]["variantes"].append("Échec Scolaire")
    err, _ = V.controler_termes_bloquants(abime(termes, casse), ref)
    assert any("normalisée" in e for e in err), err


# ─────────────────────────────────────────────── exceptions de domaine à l'œuvre

# Une exception vive : son exemple déclenche un motif interdit, et l'exception le couvre.
CAS_EXCEPTIONS = [
    ("Le test est en echec du protocole fourni.",       "EDS-NSI", "PHI"),
    ("La lacune stratigraphique est visible.",          "EDS-SVT", "EDS-SES"),
    ("On mesure une intensite faible en sortie.",       "EDS-PC",  "EDS-HGGSP"),
    ("Une faible concentration est mesuree.",           "EDS-PC",  "EDS-HGGSP"),
]

# Emplois disciplinaires qu'aucun motif ne doit atteindre : la précision des motifs
# suffit, sans exception. C'est le contrat inverse du précédent.
SANS_COLLISION = [
    "Le retard de propagation vaut 3 ms.",
    "On observe un echec de la transformation.",
    "Il s'agit d'une urgence medicale.",
    "Le classement des donnees se fait par ordre croissant.",
]


@pytest.mark.parametrize("texte", SANS_COLLISION)
@pytest.mark.parametrize("contexte", ["enonce_candidat", "descripteur_grille", "prose_bilan"])
def test_emploi_disciplinaire_non_bloque(texte, contexte, termes):
    """Aucun motif ne doit atteindre ces emplois, dans aucun contexte et sans exception."""
    assert V.chercher_termes(texte, contexte, termes, "essai", None) == []


def test_aucune_exception_decorative(termes):
    """Chaque exception doit servir : son exemple déclenche un motif parent."""
    for e in termes["expressions"]:
        for exc in e["exceptions_domaine"]:
            ex = V.normaliser(exc["exemple"])
            assert V.occurrences(ex, e), (
                f"exception décorative sur « {e['motif']} » : {exc['regex']}")


@pytest.mark.parametrize("texte,dedans,dehors", CAS_EXCEPTIONS)
def test_exception_couvre_dans_son_perimetre(texte, dedans, dehors, termes):
    assert V.chercher_termes(texte, "descripteur_grille", termes, "essai", dedans) == []


@pytest.mark.parametrize("texte,dedans,dehors", CAS_EXCEPTIONS)
def test_exception_ne_couvre_pas_hors_perimetre(texte, dedans, dehors, termes):
    assert V.chercher_termes(texte, "descripteur_grille", termes, "essai", dehors) != []


# R3 — pronoms délimités, pluriels, formes verbales, et emplois qui doivent passer.
CAS_TOURNURES = [
    ("outil de fil en aiguille pour la mesure",              None,      False),
    ("le profil du signal reste stable",                     None,      False),
    ("le vaisseau file vers l'ile",                          None,      False),
    ("les candidats sont en echec sur ce point",             None,      True),
    ("ils echouent regulierement a cet exercice",            None,      True),
    ("elles ont echoue a cette question",                    None,      True),
    ("vous echouerez a cette epreuve",                       None,      True),
    ("elle a echoue a plusieurs reprises",                   None,      True),
    ("vos enfants risquent d'echouer",                       None,      True),
    ("votre enfant est en situation d'echec",                None,      True),
    ("les eleves accumulent du retard",                      None,      True),
    ("le candidat a pris du retard sur le programme",        None,      True),
    ("les candidats ne pourront pas rattraper",              None,      True),
    ("le test unitaire est en echec apres la modification",  "EDS-NSI", False),
    ("l'echec du protocole s'explique par la temperature",   "EDS-PC",  False),
    ("le retard de propagation vaut 3 ms",                   "EDS-PC",  False),
]


@pytest.mark.parametrize("texte,perimetre,bloque", CAS_TOURNURES)
def test_tournures_visant_le_candidat(texte, perimetre, bloque, termes):
    trouve = V.chercher_termes(texte, "prose_bilan", termes, "essai", perimetre)
    assert bool(trouve) is bloque, (texte, trouve)


def test_contexte_de_soixante_caracteres_affiche(termes):
    texte = "a" * 200 + " le candidat est en echec " + "b" * 200
    trouve = V.chercher_termes(texte, "prose_bilan", termes, "essai", None)
    assert trouve, "occurrence non détectée"
    n = termes["conventions"]["controle"]["contexte_caracteres"]
    extrait = trouve[0].split("« …")[1].split("… »")[0]
    assert len(extrait) <= 2 * n + len("le candidat est en echec") + 5


def test_cle_correcteur_exemptee_de_la_minimisation(termes):
    texte = "Pour cette question, il suffit de factoriser puis de conclure."
    assert V.chercher_termes(texte, "cle_correcteur", termes, "essai", None) == []
    assert V.chercher_termes(texte, "enonce_candidat", termes, "essai", None) != []


# ─────────────────────────────────────────────── catalogue

def test_fenetre_de_duree_stockee_refusee(catalogue, ref, abime):
    def casse(c):
        c["conventions"]["fenetre_duree"]["duree_min"] = 81
    err, _ = V.controler_catalogue(abime(catalogue, casse), ref)
    assert any("ne doit pas être stockée" in e for e in err), err


def test_version_de_catalogue_hors_referentiel(catalogue, ref, abime):
    def casse(c):
        next(i for i in c["instruments"] if i["code"] == "EDS-MATH")["version"] = "N9"
    err, _ = V.controler_catalogue(abime(catalogue, casse), ref)
    assert any("version absente" in e for e in err), err


def test_version_de_referentiel_absente_du_catalogue(catalogue, ref, abime):
    def casse(c):
        c["instruments"] = [i for i in c["instruments"]
                            if not (i["code"] == "EDS-MATH" and i["version"] == "NT")]
    err, _ = V.controler_catalogue(abime(catalogue, casse), ref)
    assert any("sans enregistrement" in e for e in err), err


def test_instrument_sans_items_ne_declare_pas_de_blocs(catalogue, ref, abime):
    def casse(c):
        next(i for i in c["instruments"] if i["code"] == "GO")["blocs_attendus"] = ["A"]
    err, _ = V.controler_catalogue(abime(catalogue, casse), ref)
    assert any("ne porte pas d'items" in e for e in err), err


def test_profils_hors_de_ceux_du_perimetre(catalogue, ref, abime):
    def casse(c):
        next(i for i in c["instruments"] if i["code"] == "FR-MAI")["profils"] = ["P1", "P2"]
    err, _ = V.controler_catalogue(abime(catalogue, casse), ref)
    assert any("profils hors" in e for e in err), err
