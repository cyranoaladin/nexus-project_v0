"""Preuve que validate_instrument.py sait échouer, contrôle par contrôle.

Cas positif sur la fixture, puis un cas négatif par contrôle du cahier des charges
§ 5, plus les trois catégories de couverture et la distinction hors_version.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import validate_instrument as VI


def erreurs(banque, assemblage, refs):
    return VI.controler(banque, assemblage, refs)


def contient(err, *fragments):
    return any(all(f in e for f in fragments) for e in err)


# ───────────────────────────────────────────────────────── cas positif

def test_fixture_valide(dossier_fixture):
    err, resume = VI.valider(dossier_fixture)
    assert err == [], "\n".join(err)
    assert len(resume) == 2, resume


def test_les_deux_versions_sont_controlees(dossier_fixture):
    _, resume = VI.valider(dossier_fixture)
    assert any("standard" in l for l in resume) and any("REDUITE" in l for l in resume)


# ─────────────────────────────── 1 · identifiants : unicité et format

def test_identifiant_duplique(banque, assemblage, refs_fixture, abime):
    b = abime(banque, lambda b: b["items"].append(dict(b["items"][0])))
    assert contient(erreurs(b, assemblage, refs_fixture), "identifiant dupliqué")


def test_identifiant_hors_format(banque, assemblage, refs_fixture, abime):
    def casse(x):
        x["items"][0]["item_id"] = "FIXTURE-CALC-1"
    b = abime(banque, casse)
    a = abime(assemblage, lambda a: a["blocs"][0]["items"].__setitem__(0, "FIXTURE-CALC-1"))
    assert contient(erreurs(b, a, refs_fixture), "hors format")


def test_item_absent_de_la_banque(banque, assemblage, refs_fixture, abime):
    a = abime(assemblage, lambda a: a["blocs"][0]["items"].append("FIX-2-CALC-99"))
    assert contient(erreurs(banque, a, refs_fixture), "item inconnu")


# ─────────────────────────────── 2 · compétences et versions

def test_competence_absente_du_referentiel(banque, assemblage, refs_fixture, abime):
    b = abime(banque, lambda b: b["items"][0].update(competence="ZZZZ"))
    assert contient(erreurs(b, assemblage, refs_fixture), "absente du référentiel")


def test_competence_hors_version_assemblee(banque, refs_fixture, abime):
    """HORS est hors_version en REDUITE : ses items ne doivent pas y figurer."""
    red = VI.VR.charger(Path(__file__).resolve().parent.parent
                        / "instruments/_FIXTURE/assemblages/REDUITE.json")
    a = abime(red, lambda a: a["blocs"][1]["items"].append("FIX-1-HORS-01"))
    assert contient(erreurs(banque, a, refs_fixture), "hors_version")


def test_indicateur_transversal_ne_porte_pas_d_items(banque, assemblage, refs_fixture, abime):
    b = abime(banque, lambda b: b["items"][0].update(competence="LANG"))
    assert contient(erreurs(b, assemblage, refs_fixture), "indicateur transversal")


# ─────────────────────────────── 3 · codes d'erreur

def test_code_erreur_inconnu(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "B")["cle"]["codes_erreur"] = ["FIX-ERR-XXX"]
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "absent du catalogue")


def test_code_erreur_hors_competence(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["item_id"] == "FIX-1-NOTI-02")["cle"]["codes_erreur"] = \
            ["FIX-ERR-CONNECT"]
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "ne concerne pas")


# ─────────────────────────────── 4 · couverture, par catégorie

def test_competence_ordinaire_sous_trois_items(banque, assemblage, refs_fixture, abime):
    def casse(a):
        a["blocs"][0]["items"] = a["blocs"][0]["items"][:2]
    assert contient(erreurs(banque, abime(assemblage, casse), refs_fixture),
                    "CALC", "minimum 3")


def test_competence_ordinaire_sur_un_seul_palier(banque, assemblage, refs_fixture, abime):
    def casse(b):
        for i in b["items"]:
            if i["competence"] == "CALC":
                i["palier"] = "D1"
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "CALC", "palier")


# ─────────────────────────────── EC-08 · propriétaire unique par critère

def test_critere_sans_proprietaire(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "C")["grille"][0].pop("competence")
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "sans compétence propriétaire")


def test_critere_dont_le_proprietaire_est_inconnu(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "C")["grille"][0]["competence"] = "ZZZZ"
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "propriétaire")


def test_production_qui_ne_possede_pas_deux_criteres(banque, assemblage, refs_fixture, abime):
    """Depuis EC-14 la tâche est cherchée parmi tous les items C : le message change."""
    def casse(b):
        it = next(i for i in b["items"] if i["item_id"] == "FIX-1-REDA-01")
        it["grille"][0]["competence"] = "LANG"   # REDA ne garde qu'un critère
    err = erreurs(abime(banque, casse), assemblage, refs_fixture)
    assert contient(err, "REDA", "aucun item de type C"), err
    assert contient(err, "FIX-1-REDA-01 : 1"), err


def test_un_critere_apporte_un_palier_a_son_proprietaire(banque, assemblage, refs_fixture, abime):
    """NOTI n'a que D1 et D2 en items ; le critère STRU lui apporte le palier de la tâche."""
    def casse(b):
        for i in b["items"]:
            if i["competence"] == "NOTI":
                i["palier"] = "D1"
    err = erreurs(abime(banque, casse), assemblage, refs_fixture)
    assert not contient(err, "NOTI", "palier"), err
    def casse2(b):
        for i in b["items"]:
            if i["competence"] == "NOTI":
                i["palier"] = "D1"
        next(i for i in b["items"] if i["item_id"] == "FIX-1-REDA-01")["grille"][2]["competence"] = "REDA"
    assert contient(erreurs(abime(banque, casse2), assemblage, refs_fixture), "NOTI", "palier")


def test_points_d_un_critere_ne_vont_pas_a_la_competence_de_l_item(banque, assemblage, refs_fixture):
    """REDA possède 2 critères sur 4 : elle reçoit 6 points de la tâche, pas 12."""
    import validate_instrument as VI
    ref = refs_fixture["competences"]
    per = next(p for p in ref["perimetres"] if p["code"] == "_FIXTURE")
    comps = {c["code"]: c for c in per["competences"]}
    items = [next(i for i in banque["items"] if i["item_id"] == iid)
             for b in assemblage["blocs"] for iid in b["items"]]
    err = VI.controler_couverture(items, comps, "standard",
                                  ref["conventions"]["regles_couverture"], refs_fixture)
    assert err == [], err


def test_palier_sous_trois_points(banque, assemblage, refs_fixture, abime):
    def casse(a):
        a["blocs"][0]["items"] = ["FIX-2-CALC-01", "FIX-2-CALC-04", "FIX-2-CALC-05"]
    err = erreurs(banque, abime(assemblage, casse), refs_fixture)
    assert contient(err, "CALC/D1", "minimum 3")


def test_production_sans_item_en_bloc_d(banque, assemblage, refs_fixture, abime):
    def casse(a):
        for b in a["blocs"]:
            if b["bloc"] == "D":
                b["items"] = [i for i in b["items"] if "REDA" not in i]
    assert contient(erreurs(banque, abime(assemblage, casse), refs_fixture),
                    "REDA", "sans item")


def test_production_dont_le_bloc_d_partage_le_palier_de_la_tache(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["item_id"] == "FIX-1-REDA-02")["palier"] = "D3"
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture),
                    "REDA", "palier différent")


def test_indicateur_transversal_sous_deux_sources(banque, assemblage, refs_fixture, abime):
    def casse(b):
        it = next(i for i in b["items"] if i["item_id"] == "FIX-1-INTE-01")
        it["grille"] = [c for c in it["grille"] if c["code"] != "LANG"]
        it["score_max"] = 3 * len(it["grille"])
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture),
                    "LANG", "source")


# ─────────────────────────────── 5 · cohérence type / score

@pytest.mark.parametrize("iid,score", [("FIX-2-CALC-01", 2), ("FIX-1-NOTI-02", 1),
                                       ("FIX-1-REDA-01", 9)])
def test_score_incoherent_avec_le_type(iid, score, banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["item_id"] == iid)["score_max"] = score
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), iid, "score")


# ─────────────────────────────── 6 · type A

def test_type_a_bonne_reponse_aussi_en_distracteur(banque, assemblage, refs_fixture, abime):
    def casse(b):
        it = next(i for i in b["items"] if i["type"] == "A")
        it["cle"]["distracteurs"][it["cle"]["reponse"]] = "doublon"
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "distracteur")


def test_type_a_distracteur_sans_explication(banque, assemblage, refs_fixture, abime):
    def casse(b):
        it = next(i for i in b["items"] if i["type"] == "A")
        it["cle"]["distracteurs"] = dict.fromkeys(it["cle"]["distracteurs"], "")
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "sans explication")


# ─────────────────────────────── 7 · type B

def test_type_b_sans_reponse_a_deux_points(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "B")["cle"]["reponse_2pts"] = ""
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "reponse_2pts")


def test_type_b_sans_code_erreur(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "B")["cle"]["codes_erreur"] = []
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "sans code d'erreur")


# ─────────────────────────────── 8 · type C

@pytest.mark.parametrize("n", [2, 6])
def test_type_c_hors_de_trois_a_cinq_criteres(n, banque, assemblage, refs_fixture, abime):
    def casse(b):
        it = next(i for i in b["items"] if i["type"] == "C")
        g = it["grille"]
        it["grille"] = (g * 3)[:n]
        it["score_max"] = 3 * n
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "critère")


def test_type_c_descripteur_vide(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "C")["grille"][0]["descripteurs"]["2"] = "  "
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "descripteur", "vide")


def test_type_c_niveau_manquant(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "C")["grille"][0]["descripteurs"].pop("3")
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "quatre niveaux")


def test_type_c_avec_une_cle(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "C")["cle"] = {"reponse": "A"}
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "cle doit être nulle")


# ─────────────────────────────── 9 · bloc 0

def test_bloc_0_absent(banque, assemblage, refs_fixture, abime):
    assert contient(erreurs(banque, abime(assemblage, lambda a: a.pop("bloc_0")), refs_fixture),
                    "bloc 0 absent")


def test_bloc_0_domaine_hors_competences_evaluees(banque, assemblage, refs_fixture, abime):
    def casse(a):
        a["bloc_0"]["domaines"][0]["competence"] = "LANG"
    assert contient(erreurs(banque, abime(assemblage, casse), refs_fixture), "hors des compétences")


def test_bloc_0_intitule_different_du_referentiel(banque, assemblage, refs_fixture, abime):
    def casse(a):
        a["bloc_0"]["domaines"][0]["intitule"] = "Un autre intitulé"
    assert contient(erreurs(banque, abime(assemblage, casse), refs_fixture), "intitulé")


# ─────────────────────────────── 10 · durée

@pytest.mark.parametrize("facteur", [0.5, 3])
def test_duree_hors_fenetre(facteur, banque, assemblage, refs_fixture, abime):
    def casse(b):
        for i in b["items"]:
            i["duree_min"] = max(1, round(i["duree_min"] * facteur))
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "hors de la fenêtre")


def test_fenetre_calculee_depuis_le_catalogue(banque, assemblage, refs_fixture, abime):
    """Changer la durée cible du catalogue doit suffire à faire basculer le contrôle."""
    r = abime(refs_fixture, lambda r: next(
        i for i in r["catalogue"]["instruments"]
        if i["code"] == "_FIXTURE" and i["version"] == "standard"
    ).update(duree_cible_min=200))
    assert contient(erreurs(banque, assemblage, r), "hors de la fenêtre")


# ─────────────────────────────── 11 · termes bloquants

def test_terme_bloquant_dans_un_enonce(banque, assemblage, refs_fixture, abime):
    def casse(b):
        b["items"][0]["enonce"] = "Sans cette notion vous echouerez a l'epreuve."
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "expression interdite")


def test_terme_bloquant_dans_un_descripteur(banque, assemblage, refs_fixture, abime):
    def casse(b):
        next(i for i in b["items"] if i["type"] == "C")["grille"][0]["descripteurs"]["0"] = \
            "Le candidat est incapable de formuler une idee."
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "expression interdite")


def test_terme_bloquant_dans_une_consigne(banque, assemblage, refs_fixture, abime):
    def casse(a):
        a["consignes_passation"].append("Il suffit de repondre vite.")
    assert contient(erreurs(banque, abime(assemblage, casse), refs_fixture), "expression interdite")


# ─────────────────────────────── 12 · métadonnées obligatoires

def test_notes_conception_absentes(banque, assemblage, refs_fixture, abime):
    def casse(b):
        b["items"][0]["notes_conception"] = ""
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "notes_conception")


def test_duree_min_absente(banque, assemblage, refs_fixture, abime):
    def casse(b):
        b["items"][0]["duree_min"] = 0
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "duree_min")


def test_bloc_declare_different_du_bloc_d_assemblage(banque, assemblage, refs_fixture, abime):
    def casse(b):
        b["items"][0]["bloc"] = "B"
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture), "déclaré au bloc")


# ─────────────────────────────── 14 · emplacements réservés

def test_emplacement_reserve_non_liste(banque, assemblage, refs_fixture, abime):
    def casse(b):
        b["items"][0]["enonce"] = "[EXTRAIT À INSÉRER — œuvre, pages, à valider par la direction]"
    assert contient(erreurs(abime(banque, casse), assemblage, refs_fixture),
                    "emplacement réservé")


# ─────────────────────────────── grilles coach

def _grille(nom):
    import validate_instrument as VI
    return VI.VR.charger(Path(__file__).resolve().parent.parent / "instruments" / nom / "definition.json")


def _refs():
    import validate_instrument as VI
    return VI.charger_referentiels(None)


GRILLES_COACH = sorted(
    i["code"] for i in VI.VR.charger(VI.RACINE / "referentiels" / "catalogue_instruments.json")
    ["instruments"] if not i["porte_items"] and (
        VI.RACINE / "instruments" / i["code"] / "definition.json").exists())


@pytest.mark.parametrize("nom", GRILLES_COACH)
def test_grille_coach_valide(nom):
    assert VI.controler_grille_coach(_grille(nom), _refs()) == []


def test_grille_coach_critere_sans_proprietaire(abime):
    d = abime(_grille("GO"), lambda g: g["criteres"][0].pop("competence"))
    assert contient(VI.controler_grille_coach(d, _refs()), "sans compétence propriétaire")


def test_grille_coach_proprietaire_hors_competences_alimentees(abime):
    d = abime(_grille("GO"), lambda g: g["criteres"][0].update(competence="STAT"))
    assert contient(VI.controler_grille_coach(d, _refs()), "absent des compétences alimentées")


def test_grille_coach_sans_competence_alimentee(abime):
    d = abime(_grille("GO"), lambda g: g.update(perimetres_alimentes=[]))
    assert contient(VI.controler_grille_coach(d, _refs()), "aucune compétence alimentée")


def test_grille_coach_deroule_incoherent_avec_le_catalogue(abime):
    d = abime(_grille("GO"), lambda g: g["deroule"][0].update(duree_min=99))
    assert contient(VI.controler_grille_coach(d, _refs()), "déroulé de")


def test_grille_coach_consigne_prononcee_absente(abime):
    d = abime(_grille(GRILLES_COACH[0]), lambda g: g["deroule"][1].update(consigne_prononcee=""))
    assert contient(VI.controler_grille_coach(d, _refs()), "consigne_prononcee")


def test_grille_coach_terme_bloquant_dans_un_descripteur(abime):
    d = abime(_grille("GO"), lambda g: g["criteres"][0]["descripteurs"].update(
        {"0": "Le candidat est incapable de structurer son propos."}))
    assert contient(VI.controler_grille_coach(d, _refs()), "expression interdite")


def test_grille_coach_descripteur_manquant(abime):
    d = abime(_grille("GO"), lambda g: g["criteres"][0]["descripteurs"].pop("2"))
    assert contient(VI.controler_grille_coach(d, _refs()), "quatre niveaux")


# ─────────────────────────────── EC-14 · item C servant deux productions

def test_item_c_partage_entre_deux_productions():
    """SES/N1 : une seule tâche, deux compétences de production satisfaites."""
    import validate_instrument as VI
    d = Path(__file__).resolve().parent.parent / "instruments" / "EDS-SES"
    err, _ = VI.valider(d, ["N1"])
    assert err == [], "\n".join(err)
    banque = VI.VR.charger(d / "banque.json")
    tache = next(i for i in banque["items"] if i["item_id"] == "SES-1-DOCU-05")
    proprietaires = {}
    for cr in tache["grille"]:
        proprietaires.setdefault(cr["competence"], 0)
        proprietaires[cr["competence"]] += 1
    assert proprietaires == {"DOCU": 2, "RAIS": 2, "STAT": 1}, proprietaires
    assert tache["score_max"] == 3 * len(tache["grille"])


def test_production_sans_deux_criteres_dans_aucun_item_c(abime):
    """Le message doit nommer les items C examinés et le nombre de critères possédés."""
    import validate_instrument as VI
    d = Path(__file__).resolve().parent.parent / "instruments" / "EDS-SES"
    refs = VI.charger_referentiels(None)
    banque = VI.VR.charger(d / "banque.json")
    asm = VI.VR.charger(d / "assemblages" / "N1.json")
    b = abime(banque, lambda x: next(
        i for i in x["items"] if i["item_id"] == "SES-1-DOCU-05")["grille"][3].update(
        {"competence": "DOCU"}))
    err = VI.controler(b, asm, refs)
    assert any("RAIS" in e and "SES-1-DOCU-05" in e for e in err), err


# ─────────────────────────────── formulaires (QP, MET)

def _formulaire(nom):
    import validate_instrument as VI
    return VI.VR.charger(Path(__file__).resolve().parent.parent / "instruments" / nom / "formulaire.json")


@pytest.mark.parametrize("nom", ["QP", "MET"])
def test_formulaire_valide(nom):
    assert VI.controler_formulaire(_formulaire(nom), _refs()) == []


def test_question_sans_cible_refusee(abime):
    d = abime(_formulaire("QP"), lambda f: f["questions"][0].pop("cible"))
    assert contient(VI.controler_formulaire(d, _refs()), "sans « cible »")


def test_variable_derivee_ne_se_saisit_pas(abime):
    d = abime(_formulaire("QP"), lambda f: f["questions"][0].update(cible="statut_minorite"))
    assert contient(VI.controler_formulaire(d, _refs()), "variable dérivée")


def test_bornes_incoherentes_avec_le_referentiel(abime):
    def casse(f):
        next(q for q in f["questions"] if q["cible"] == "heures_disponibles")["max"] = 200
    assert contient(VI.controler_formulaire(abime(_formulaire("QP"), casse), _refs()), "borne max")


def test_options_hors_du_referentiel(abime):
    def casse(f):
        next(q for q in f["questions"] if q["cible"] == "profil")["options"].append(
            {"valeur": "P4", "libelle": "Autre"})
    assert contient(VI.controler_formulaire(abime(_formulaire("QP"), casse), _refs()), "options")


def test_variable_obligatoire_non_renseignee(abime):
    def casse(f):
        f["questions"] = [q for q in f["questions"] if q.get("cible") != "heures_disponibles"]
    assert contient(VI.controler_formulaire(abime(_formulaire("QP"), casse), _refs()),
                    "variable obligatoire")


def test_champ_nominatif_refuse(abime):
    def casse(f):
        f["questions"][0]["libelle"] = "Quel est votre nom et votre date_naissance ?"
    assert contient(VI.controler_formulaire(abime(_formulaire("QP"), casse), _refs()),
                    "donnée nominative")


def test_met_dimension_non_couverte(abime):
    def casse(f):
        f["questions"] = [q for q in f["questions"] if q["cible_dimension"] != "ENVI"]
    assert contient(VI.controler_formulaire(abime(_formulaire("MET"), casse), _refs()), "ENVI")


def test_met_option_sans_poids(abime):
    def casse(f):
        f["questions"][0]["options"][0].pop("poids")
    assert contient(VI.controler_formulaire(abime(_formulaire("MET"), casse), _refs()), "sans poids")


def test_saisie_papier_refusee_comme_support_principal(abime):
    d = abime(_formulaire("QP"), lambda f: f["saisie"].update(support="papier"))
    assert contient(VI.controler_formulaire(d, _refs()), "plateforme")
