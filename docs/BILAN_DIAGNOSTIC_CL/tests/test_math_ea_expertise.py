"""Contre-expertise disciplinaire de MATH-EA : ce que l'instrument prétend mesurer.

Un instrument peut être techniquement valide — items bien formés, durées dans la fenêtre,
couverture satisfaite — et pédagogiquement creux. Ces tests portent sur l'autre versant :
chaque item renvoie-t-il à une capacité réellement écrite dans son programme, les six
compétences du préambule sont-elles exercées et non seulement déclarées, le score rendu
correspond-il à la pondération de l'épreuve, et l'interdiction de la calculatrice est-elle
tenue par les items eux-mêmes.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import maquette_bilan as M  # noqa: E402
import validate_instrument as VI  # noqa: E402

PARCOURS = ("SPE", "SPECIFIQUES")


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def refs():
    return VI.charger_referentiels(None)


@pytest.fixture(scope="module")
def banque():
    return {i["item_id"]: i
            for i in charger(RACINE / "instruments" / "MATH-EA" / "banque.json")["items"]}


@pytest.fixture(scope="module")
def capacites():
    return charger(RACINE / "referentiels" / "capacites_mathematiques.json")


def assemblage(v):
    return charger(RACINE / "instruments" / "MATH-EA" / "assemblages" / f"{v}.json")


def items_de(banque, v):
    return [banque[i] for bl in assemblage(v)["blocs"] for i in bl["items"]]


@pytest.fixture(scope="module")
def p3():
    return M.Bilan().calculer()


# ─────────────────────────── 1 · chaque item nomme une capacité, pas un programme

def test_le_referentiel_transcrit_les_annexes(capacites):
    """Les deux programmes de première, et celui de seconde dont ils dépendent."""
    progs = capacites["programmes"]
    assert set(progs) == {"MENE2602917A", "MENE2602916A", "MENE2602914A"}
    assert progs["MENE2602917A"]["parcours"] == "SPE"
    assert progs["MENE2602916A"]["parcours"] == "SPECIFIQUES"
    anterieur = progs["MENE2602914A"]
    assert anterieur["parcours"] is None and anterieur["anterieur"] is True
    assert "seule source canonique d'un prérequis" in anterieur["role"]
    for nor, prog in progs.items():
        assert len(prog["capacites"]) >= 10, nor
        for c in prog["capacites"]:
            assert c["texte"] and c["section"] and c["partie"]
            assert c["nature"] in capacites["natures"]


@pytest.mark.parametrize("v", PARCOURS)
def test_chaque_item_renvoie_a_une_capacite_de_son_programme(banque, refs, v):
    assert VI.controler_capacites_officielles(items_de(banque, v), refs,
                                              f"MATH-EA/{v}", assemblage(v)) == []


@pytest.mark.parametrize("v", PARCOURS)
def test_aucun_item_ne_renvoie_a_lautre_programme(banque, capacites, v):
    """Chaque item cite le programme de son parcours, ou le programme antérieur."""
    nor = next(n for n, p in capacites["programmes"].items() if p.get("parcours") == v)
    anterieurs = {n for n, p in capacites["programmes"].items() if p.get("anterieur")}
    for it in items_de(banque, v):
        for code in it["capacites_officielles"][v]:
            assert code.startswith(nor) or code.startswith("RENVOI.") \
                or any(code.startswith(a) for a in anterieurs), \
                f"{it['item_id']} : {code} hors de {nor}"


def test_un_renvoi_generique_ne_suffit_plus(banque, refs):
    """Contre-test : retirer la capacité d'un item le fait refuser."""
    items = copy.deepcopy(items_de(banque, "SPE"))
    items[0].pop("capacites_officielles")
    err = VI.controler_capacites_officielles(items, refs, "essai", assemblage("SPE"))
    assert err and "aucune capacité officielle" in err[0]


def test_un_rattachement_a_un_contenu_doit_etre_justifie(banque, refs):
    """Une ligne de « Contenus » n'est pas une capacité attendue : l'item doit le dire."""
    items = copy.deepcopy(items_de(banque, "SPE"))
    cible = next(i for i in items if i["item_id"] == "MEA-1-GEOM-03")
    assert cible["justification_rattachement"]
    cible.pop("justification_rattachement")
    err = VI.controler_capacites_officielles(items, refs, "essai", assemblage("SPE"))
    assert any("justification_rattachement" in e for e in err)


def test_les_items_rattaches_hors_capacite_sont_recenses(banque, capacites):
    """Le compte rendu doit pouvoir les nommer : ils sont cinq, et ils se justifient."""
    par_code = {c["code"]: c for p in capacites["programmes"].values()
                for c in p["capacites"]}
    par_code.update({c["code"]: c for c in capacites["renvois_externes"]})
    hors = set()
    for it in items_de(banque, "SPE") + items_de(banque, "SPECIFIQUES"):
        for codes in it["capacites_officielles"].values():
            for c in codes:
                if par_code[c]["nature"] != "capacite_attendue":
                    hors.add(it["item_id"])
    assert hors == {"MEA-1-GEOM-03", "MEA-1-INFO-01"}, \
        "GEOM-04 porte un cercle trigonométrique et EXACT-01/02 citent la ligne du " \
        "programme de seconde : ils se rattachent à des capacités attendues"
    for iid in hors:
        assert banque[iid]["justification_rattachement"]


# ─────────────────────────── 2 · les six compétences, exercées et non déclarées

def test_les_six_competences_sont_celles_du_preambule(capacites):
    assert [c["code"] for c in capacites["competences_transversales"]["liste"]] == [
        "CHERCHER", "MODELISER", "REPRESENTER", "RAISONNER", "CALCULER", "COMMUNIQUER"]


@pytest.mark.parametrize("v", PARCOURS)
def test_chaque_competence_est_exercee_deux_fois_en_partie_2(banque, refs, v):
    seuil = refs["capacites_mathematiques"]["competences_transversales"][
        "regle_couverture"]["sources_min_partie_2"]
    couverture = VI.couverture_transversale(items_de(banque, v), refs, assemblage(v))
    maigres = {c: n["partie_2"] for c, n in couverture.items() if n["partie_2"] < seuil}
    assert not maigres, maigres


@pytest.mark.parametrize("v", PARCOURS)
def test_aucun_qcm_ne_pretend_faire_communiquer(banque, v):
    for it in items_de(banque, v):
        if it["type"] == "A":
            assert "COMMUNIQUER" not in it["competences_math_transversales"], it["item_id"]


def test_une_competence_declaree_sans_etre_exercee_est_refusee(banque, refs):
    """Contre-test : déclarer « communiquer » sur un QCM fait échouer le contrôle."""
    items = copy.deepcopy(items_de(banque, "SPE"))
    qcm = next(i for i in items if i["type"] == "A")
    qcm["competences_math_transversales"] = ["COMMUNIQUER"]
    err = VI.controler_competences_transversales(items, refs, "essai", assemblage("SPE"))
    assert any("COMMUNIQUER" in e and "aucune trace" in e for e in err)


def test_representer_exige_une_trace_dans_la_tache(banque, refs):
    """Le reproche de la direction : le tableau comptait des mots du JSON.

    Un calcul de distance à partir de coordonnées ne représente rien. L'étiquette ne
    s'ajoute que si la tâche lit un support, en produit un, ou opère un changement de
    registre nommé par une capacité officielle.
    """
    items = copy.deepcopy(items_de(banque, "SPE"))
    distance = next(i for i in items if i["item_id"] == "MEA-1-GEOM-03")
    assert "REPRESENTER" not in distance["competences_math_transversales"]
    distance["competences_math_transversales"] = ["CALCULER", "REPRESENTER"]
    err = VI.controler_competences_transversales(items, refs, "essai", assemblage("SPE"))
    assert any("MEA-1-GEOM-03" in e and "REPRESENTER" in e for e in err)


@pytest.mark.parametrize("v", PARCOURS)
def test_chaque_etiquette_controlee_porte_sa_preuve(banque, refs, v):
    """Pour chacune des deux compétences contrôlées, la preuve est nommable."""
    ref = refs["capacites_mathematiques"]
    for it in items_de(banque, v):
        for c in ("REPRESENTER", "COMMUNIQUER"):
            if c in it["competences_math_transversales"]:
                preuve = VI.preuve_transversale(it, ref, c, v)
                assert preuve is not None, (it["item_id"], c)
                assert preuve[1], (it["item_id"], c)


def test_modeliser_nest_plus_porte_par_la_seule_tache_de_production(banque, refs):
    """C'était le point faible du sujet de spécialité avant la contre-expertise."""
    couverture = VI.couverture_transversale(items_de(banque, "SPE"), refs,
                                            assemblage("SPE"))
    assert couverture["MODELISER"]["partie_2"] >= 2
    porteurs = [i["item_id"] for i in items_de(banque, "SPE")
                if "MODELISER" in i["competences_math_transversales"]]
    assert porteurs != ["MEA-1-RAIS-01"]


# ─────────────────────────── 3 · le score au format de l'épreuve

def test_le_score_de_format_applique_la_ponderation_officielle(p3):
    r = p3.score_format_epreuve()
    assert r["sur"] == 20
    assert r["parties"]["partie_1"]["points_officiels"] == 6
    assert r["parties"]["partie_2"]["points_officiels"] == 14
    attendu = sum(x["part"] * x["points_officiels"] for x in r["parties"].values())
    assert abs(r["score"] - attendu) < 0.05


def test_le_bloc_d_ne_compte_pas_dans_le_score_de_format(p3):
    r = p3.score_format_epreuve()
    assert r["blocs_hors_format"] == ["A", "D"]
    compte = sum(x["items"] for x in r["parties"].values())
    passes = sum(1 for l in p3.lignes if l["instrument"].startswith("MATH-EA")
                 and l["item_id"] in p3.banques["MATH-EA"])
    passes += sum(1 for g in p3.grilles if g["instrument"].startswith("MATH-EA"))
    assert compte < passes, "aucun item n'est exclu du score de format"


def test_doubler_le_nombre_ditems_dune_partie_ne_change_pas_le_score(p3):
    """Le contre-test demandé : le score de format ne dépend pas du volume de la banque.

    Chaque ligne de la partie 1 est dupliquée avec le même score et le même barème : la
    performance est identique, le nombre d'items double. Un score qui bougerait mesurerait
    la banque et non le candidat.
    """
    avant = p3.score_format_epreuve()
    b = copy.deepcopy(p3)
    blocs_p1 = {iid for (code, _v, iid), bl in b.blocs_item.items()
                if code == "MATH-EA" and bl == "B"}
    doubles = [dict(l) for l in b.lignes
               if l["instrument"].startswith("MATH-EA")
               and l["item_id"] in blocs_p1
               and b.banques["MATH-EA"].get(l["item_id"], {}).get("type") == "A"]
    assert doubles, "aucune ligne de partie 1 à dupliquer"
    b.lignes = b.lignes + doubles
    apres = b.score_format_epreuve()
    assert apres["parties"]["partie_1"]["items"] == \
        avant["parties"]["partie_1"]["items"] * 2
    assert apres["parties"]["partie_1"]["max"] == avant["parties"]["partie_1"]["max"] * 2
    assert apres["score"] == avant["score"]


def test_la_ponderation_officielle_nest_pas_celle_de_la_banque(p3):
    """Le barème interne pèse les parties selon ce que chacune exige de mesures.

    L'épreuve, elle, donne 6 points aux automatismes et 14 aux exercices, quel que soit
    le nombre de questions. Si les deux pondérations coïncidaient, le score au format
    n'apprendrait rien de plus que le rapport des points bruts.
    """
    r = p3.score_format_epreuve()
    obtenu = sum(x["obtenu"] for x in r["parties"].values())
    maximum = sum(x["max"] for x in r["parties"].values())
    brut = 20 * obtenu / maximum
    assert abs(r["score"] - brut) > 0.5, \
        "la pondération 6/14 rend le même résultat que le rapport des points bruts"
    poids_banque = r["parties"]["partie_1"]["max"] / maximum
    poids_officiel = 6 / 20
    assert abs(poids_banque - poids_officiel) > 0.05


def test_la_correspondance_blocs_parties_est_declaree_et_avertie():
    prog = charger(RACINE / "referentiels" / "programmes_examen.json")
    corr = prog["epreuves_anticipees"]["session_2027"]["mathematiques"][
        "format_epreuve"]["correspondance_blocs"]
    assert "ne reproduisent pas" in corr["avertissement"]
    assert corr["partie_1"]["types_item"] == ["A"]
    assert corr["partie_1"]["blocs"] == ["B"], \
        "la première partie officielle n'est pas le bloc des prérequis"
    assert corr["hors_format"]["blocs"] == ["A", "D"]


# ─────────────────────────── 4 · sans calculatrice

@pytest.mark.parametrize("v", PARCOURS)
def test_chaque_item_dit_le_calcul_quil_demande_sans_outil(banque, refs, v):
    assert VI.controler_sans_calculatrice(items_de(banque, v), refs, f"MATH-EA/{v}",
                                          assemblage(v)) == []


def test_un_item_sans_calcul_documente_est_refuse(banque, refs):
    items = copy.deepcopy(items_de(banque, "SPE"))
    items[0].pop("calcul_sans_outil")
    err = VI.controler_sans_calculatrice(items, refs, "essai", assemblage("SPE"))
    assert err and "calcul_sans_outil" in err[0]


def test_les_quatre_lectures_du_sans_calculatrice_sont_declarees():
    prog = charger(RACINE / "referentiels" / "programmes_examen.json")
    sc = prog["epreuves_anticipees"]["session_2027"]["mathematiques"]["sans_calculatrice"]
    assert [l["code"] for l in sc["lectures"]] == [
        "automatisme_disponible", "erreur_conceptuelle", "erreur_de_calcul",
        "dependance_a_loutil"]
    codes = charger(RACINE / "referentiels" / "codes_erreur.json")
    connus = {c["code"] for v in codes.values() if isinstance(v, list)
              for c in v if isinstance(c, dict) and "code" in c}
    for lecture in sc["lectures"]:
        for c in lecture["codes_erreur"]:
            assert c in connus, c
    assert sc["statut"].lower().startswith("condition de passation")


def test_lindicateur_de_dependance_ne_se_declenche_pas_sur_un_candidat_faible_partout(p3):
    b = copy.deepcopy(p3)
    for k in b.res:
        if k[0] == "MATH-EA":
            b.res[k]["part"] = 0.20
    r = b.dependance_a_loutil()
    assert not r["declenche"], "un candidat faible partout est dit dépendant d'un outil"


def test_lindicateur_de_dependance_se_declenche_quand_seul_le_calcul_decroche(p3):
    b = copy.deepcopy(p3)
    for k in b.res:
        if k[0] == "MATH-EA":
            b.res[k]["part"] = 0.20 if k[1] == "EXACT" else 0.75
    r = b.dependance_a_loutil()
    assert r["declenche"] and r["ecart"] >= r["seuil"]
    assert "hypothèse" in r["interdit"]


# ─────────────────────────── 5 · paliers D1 / D2 / D3

@pytest.mark.parametrize("v", PARCOURS)
def test_aucun_palier_servi_nest_indetermine(banque, refs, v):
    audit = VI.audit_paliers(items_de(banque, v), refs, assemblage(v))
    faibles = {(c, p) for c, paliers in audit["competences"].items()
               for p, x in paliers.items() if not x["determine"]}
    assert not faibles, faibles


@pytest.mark.parametrize("v", PARCOURS)
def test_les_competences_de_contenu_sont_servies_sur_deux_paliers(banque, refs, v):
    audit = VI.audit_paliers(items_de(banque, v), refs, assemblage(v))
    for comp, paliers in audit["competences"].items():
        if comp in ("RAIS", "EXACT"):
            continue
        assert set(paliers) == {"D1", "D2"}, (comp, sorted(paliers))


@pytest.mark.parametrize("v", PARCOURS)
def test_le_raisonnement_est_determine_au_niveau_du_perimetre(banque, refs, v):
    """EC-32 : D3 n'est pas servi domaine par domaine, mais par RAIS et EXACT."""
    audit = VI.audit_paliers(items_de(banque, v), refs, assemblage(v))
    assert audit["competences"]["RAIS"]["D3"]["sources"] >= 4
    assert audit["competences"]["EXACT"]["D3"]["sources"] >= 2


def test_le_palier_de_raisonnement_repose_sur_deux_taches_distinctes(banque):
    """Deux critères d'une même tâche ne sont pas deux observations indépendantes."""
    taches = [i for i in banque.values() if i["type"] == "C"]
    assert len(taches) == 2
    porteurs = {t["item_id"] for t in taches
                for cr in t["grille"] if cr["competence"] == "RAIS"}
    assert porteurs == {"MEA-1-RAIS-01", "MEA-1-RAIS-04"}


# ─────────────────────────── 6 · le tableau exhaustif, produit depuis la source

def test_le_tableau_couvre_chaque_item_et_nomme_sa_capacite(banque):
    import table_math_ea as T
    texte = T.tableau()
    for iid, it in banque.items():
        assert f"`{iid}`" in texte, iid
        for codes in it["capacites_officielles"].values():
            for c in codes:
                assert f"`{c}`" in texte, (iid, c)
    assert texte.count("\n|") >= len(banque)


def test_le_tableau_distingue_ce_qui_nest_pas_une_capacite_attendue():
    import table_math_ea as T
    texte = T.tableau()
    assert "*(contenu)*" in texte


def test_le_tableau_porte_la_couverture_et_laudit_des_paliers():
    import table_math_ea as T
    texte = T.tableau()
    assert "Couverture des six compétences du préambule" in texte
    assert "Audit des paliers" in texte
    for c in ("CHERCHER", "MODELISER", "REPRESENTER", "RAISONNER", "CALCULER",
              "COMMUNIQUER"):
        assert f"**{c}**" in texte


# ─────────────────────────── 7 · la forme des questions à choix multiple

def test_aucune_lettre_de_reponse_nest_surrepresentee(banque):
    """Neuf QCM sur douze avaient « B » pour réponse, et aucun n'avait « D ».

    Un candidat qui cochait systématiquement B obtenait neuf points sur douze à la
    première partie sans rien savoir : la mesure était celle d'une habitude, pas d'un
    automatisme.
    """
    import collections
    qcm = [i for i in banque.values() if i["type"] == "A"]
    c = collections.Counter(i["cle"]["reponse"] for i in qcm)
    assert set(c) == set("ABCD"), f"une lettre n'est jamais la bonne réponse : {dict(c)}"
    assert max(c.values()) - min(c.values()) <= 1, dict(c)


def test_la_bonne_reponse_nest_ni_la_plus_longue_ni_la_plus_courte(banque):
    """Un indice de longueur se répond sans mathématiques."""
    for it in banque.values():
        if it["type"] != "A":
            continue
        tailles = {k: len(v) for k, v in it["propositions"].items()}
        bonne = tailles[it["cle"]["reponse"]]
        extremes = [n for n in tailles.values() if n == bonne]
        if bonne in (max(tailles.values()), min(tailles.values())):
            assert len(extremes) > 1, \
                f"{it['item_id']} : la bonne réponse est seule à l'extrême de longueur"


def test_chaque_distracteur_correspond_a_la_proposition_quil_explique(banque):
    """Après permutation des lettres, une justification ne doit pas avoir glissé."""
    for it in banque.values():
        if it["type"] != "A":
            continue
        lettres = set(it["propositions"])
        assert set(it["cle"]["distracteurs"]) == lettres - {it["cle"]["reponse"]}, \
            it["item_id"]


# ─────────────────────────── 8 · prérequis et partie officielle sont deux dimensions

def test_le_bloc_a_ne_contient_que_des_acquis_du_programme_anterieur(banque, capacites):
    """C'est le reproche de la direction : la partie 1 officielle n'est pas un prérequis.

    Le bloc A est l'assiette du taux de prérequis, et ce taux décide d'une entrée par
    remise à niveau. Y placer les automatismes du programme de première revenait à traiter
    comme un manque du niveau inférieur le contenu même de l'épreuve.
    """
    anterieurs = {n for n, p in capacites["programmes"].items() if p.get("anterieur")}
    bloc_a = [i for i in banque.values() if i["bloc"] == "A"]
    assert bloc_a
    for it in bloc_a:
        assert it["est_prerequis"] is True, it["item_id"]
        codes = {c for v in it["capacites_officielles"].values() for c in v}
        assert any(c.startswith(tuple(anterieurs)) or c.startswith("RENVOI.")
                   for c in codes), (it["item_id"], codes)
    for it in banque.values():
        if it["bloc"] != "A":
            assert it["est_prerequis"] is False, it["item_id"]


def test_les_automatismes_de_premiere_ne_sont_pas_des_prerequis(banque):
    """Une capacité de première n'est pas un prérequis parce qu'elle est un automatisme."""
    for it in banque.values():
        codes = {c for v in it["capacites_officielles"].values() for c in v}
        if any(".AUTO." in c for c in codes):
            assert it["est_prerequis"] is False, it["item_id"]


def test_un_prerequis_declare_sans_source_anterieure_est_refuse(banque, refs):
    items = copy.deepcopy(items_de(banque, "SPE"))
    faux = next(i for i in items if i["item_id"] == "MEA-1-AUTO-01")
    faux["bloc"] = "A"
    faux["est_prerequis"] = True
    err = VI.controler_capacites_officielles(items, refs, "essai", assemblage("SPE"))
    assert any("MEA-1-AUTO-01" in e and "classe antérieure" in e for e in err)


def test_un_item_de_bloc_a_non_declare_prerequis_est_refuse(banque, refs):
    items = copy.deepcopy(items_de(banque, "SPE"))
    cible = next(i for i in items if i["item_id"] == "MEA-1-EXACT-01")
    cible["est_prerequis"] = False
    err = VI.controler_capacites_officielles(items, refs, "essai", assemblage("SPE"))
    assert any("MEA-1-EXACT-01" in e and "est_prerequis" in e for e in err)


def test_echouer_sur_les_notions_de_premiere_nenvoie_pas_en_remise_a_niveau(p3):
    """Le contre-test dynamique demandé : la cause de l'échec commande la réponse.

    Un candidat perd tous ses points sur les notions du programme de première — blocs B,
    C et D — et conserve ses acquis du programme de seconde. Avant la séparation des deux
    dimensions, son taux de prérequis tombait avec le reste et le bilan lui imposait une
    remise à niveau, c'est-à-dire le travail du niveau inférieur, qu'il possède.
    """
    b = copy.deepcopy(p3)
    blocs = {iid: bl for (code, _v, iid), bl in b.blocs_item.items() if code == "MATH-EA"}
    for l in b.lignes:
        if l["instrument"].startswith("MATH-EA") and blocs.get(l["item_id"], "A") != "A":
            l["score"] = "0"
    for g in b.grilles:
        if g["instrument"].startswith("MATH-EA"):
            g["score"] = "0"
    b.calculer()
    remise = b.regles["module_entree"]["libelle_remise_a_niveau"]
    seuil = b.regles["agregats"]["prerequis"]["seuil_remise_a_niveau"]
    assert b.agr["MATH-EA"]["global"] < 0.30, "le montage n'a pas fait échouer le candidat"
    assert b.agr["MATH-EA"]["prerequis"] >= seuil, b.agr["MATH-EA"]["prerequis_points"]
    assert b.module_entree("MATH-EA")[0] != remise, \
        "un échec sur les notions de première envoie encore en remise à niveau"


def test_echouer_sur_les_acquis_anterieurs_envoie_bien_en_remise_a_niveau(p3):
    """Le pendant : la remise à niveau reste possible, et elle vise ce qu'elle doit viser."""
    b = copy.deepcopy(p3)
    blocs = {iid: bl for (code, _v, iid), bl in b.blocs_item.items() if code == "MATH-EA"}
    for l in b.lignes:
        if l["instrument"].startswith("MATH-EA") and blocs.get(l["item_id"]) == "A":
            l["score"] = "0"
    b.calculer()
    assert b.agr["MATH-EA"]["prerequis"] == 0
    assert b.module_entree("MATH-EA")[0] == \
        b.regles["module_entree"]["libelle_remise_a_niveau"]


# ─────────────────────────── 9 · le bilan rend trois nombres, jamais un pour l'autre

def test_le_bilan_rend_les_trois_indicateurs_de_math_ea(p3):
    """Score global, production du bloc C, et note au format officiel : trois choses."""
    texte, verifs = B.rendre(p3)
    assert B.diffusable(verifs)
    section = texte.split("### " + B.nom_matiere(p3, "MATH-EA"), 1)[1].split("\n### ", 1)[0]
    fmt = p3.score_format_epreuve()
    assert "Score global du diagnostic :" in section
    assert "Production au format de l'épreuve (bloc C) :" in section
    assert "Note estimée au format de l'épreuve :" in section
    for code, x in fmt["parties"].items():
        assert f"{x['intitule_court']} : " in section
        assert f"sur {x['points_officiels']}" in section
    assert f"{fmt['score']:.1f}".replace(".", ",") + " sur 20" in section


def test_le_score_du_bloc_c_nest_pas_presente_comme_la_note_au_format(p3):
    """Le bloc C vaut 18 points de banque ; l'épreuve en vaut 20, pondérés 6 et 14.

    Confondre les deux ferait lire « 28 % » comme une note d'examen. Les deux nombres
    doivent différer dans le rendu, et chacun porter son nom.
    """
    texte, _ = B.rendre(p3)
    section = texte.split("### " + B.nom_matiere(p3, "MATH-EA"), 1)[1].split("\n### ", 1)[0]
    tache = section.split("Production au format de l'épreuve (bloc C) :", 1)[1].split(".", 1)[0]
    note = section.split("Note estimée au format de l'épreuve :", 1)[1].split(".", 1)[0]
    assert "%" in tache and "sur 20" in note, (tache, note)
    assert "sur 20" not in tache, "le score du bloc C se présente comme une note sur 20"
    fmt = p3.score_format_epreuve()
    assert abs(fmt["score"] - p3.agr["MATH-EA"]["tache"] * 20) > 0.5, \
        "les deux indicateurs coïncident : le contre-exemple ne prouve plus rien"


def test_aucun_autre_perimetre_ne_recoit_une_note_au_format(p3):
    """La pondération 6/14 est celle de cette épreuve et d'aucune autre."""
    for pc in p3.perimetres_passes:
        attendu = pc == "MATH-EA"
        assert (p3.score_format_epreuve(pc) is not None) is attendu, pc
    texte, _ = B.rendre(p3)
    assert texte.count("Note estimée au format de l'épreuve") == 1


# ─────────────────────────── 10 · EC-32 : palier observé et palier maximal testé

def test_le_moteur_distingue_le_palier_observe_du_palier_maximal_teste(p3):
    for (pc, comp), x in p3.res.items():
        if pc != "MATH-EA" or not x["evalue"]:
            continue
        assert "palier_maximal_teste" in x, comp
        if x["palier"] != "—":
            assert x["palier"] <= x["palier_maximal_teste"], (comp, x)


def test_aucune_competence_de_contenu_ne_propose_d3(p3):
    """EC-32 : D3 est observé transversalement, jamais domaine par domaine."""
    for (pc, comp), x in p3.res.items():
        if pc != "MATH-EA" or not x["evalue"]:
            continue
        attendu = "D3" if comp in ("RAIS", "EXACT") else "D2"
        assert x["palier_maximal_teste"] == attendu, (comp, x["palier_maximal_teste"])


def test_le_bilan_nomme_le_maximum_teste_quand_il_nest_pas_le_haut_de_lechelle(p3):
    """Un candidat ne doit jamais sembler avoir échoué à un palier non testé."""
    texte, _ = B.rendre(p3)
    section = texte.split("### " + B.nom_matiere(p3, "MATH-EA"), 1)[1].split("\n### ", 1)[0]
    mention = p3.regles["palier_de_profondeur"]["mention_maximum_teste"]
    for comp in ("PROBA", "ALGAN", "GEOM"):
        ligne = next(l for l in section.splitlines()
                     if l.startswith("| " + p3.comps[("MATH-EA", comp)]["intitule"]))
        assert f"({mention} D2)" in ligne, ligne
    for comp in ("RAIS", "EXACT"):
        ligne = next(l for l in section.splitlines()
                     if l.startswith("| " + p3.comps[("MATH-EA", comp)]["intitule"]))
        assert mention not in ligne, \
            "le maximum testé est rappelé alors qu'il est le haut de l'échelle"


def test_ec32_est_clos_avec_reexamen_apres_pilote(p3):
    e = p3.ecart("EC-32")
    assert e["etat"].startswith("clos")
    assert "réexamen après pilote chronométré" in e["etat"]
    assert "palier maximal testé" in e["arbitrage"]


# ─────────────────────────── 11 · couverture des automatismes, dite et non supposée

def test_la_couverture_des_automatismes_est_declaree_et_exacte(banque, capacites):
    """Un échantillonnage diagnostique doit dire ce qu'il n'échantillonne pas."""
    d = charger(RACINE / "instruments" / "MATH-EA" / "banque.json")
    couverture = d["couverture_automatismes"]
    auto = [c for c in capacites["programmes"]["MENE2602917A"]["capacites"]
            if c["partie"] == "Automatismes"]
    utilisees = {c for it in banque.values()
                 for v in it["capacites_officielles"].values() for c in v}
    non_observees = [c["code"] for c in auto if c["code"] not in utilisees]
    assert couverture["capacites_au_programme"] == len(auto)
    assert couverture["observees"] == len(auto) - len(non_observees)
    assert [x["code"] for x in couverture["non_observees"]] == \
        [c.split(".", 1)[1] for c in non_observees]
    for x in couverture["non_observees"]:
        assert x["motif"], x["code"]


def test_la_capacite_non_observee_est_qualifiee_et_non_contournee(banque):
    """Décision du 2026-09-12 : au programme, non observée par la V1, et rien d'autre."""
    d = charger(RACINE / "instruments" / "MATH-EA" / "banque.json")
    manquante, = d["couverture_automatismes"]["non_observees"]
    assert manquante["code"] == "AUTO.FONC-3"
    assert manquante["statut"] == "non_observe_v1_modalite_graphique"
    q = manquante["qualification"]
    assert q["absente_du_programme"] is False
    assert q["hors_perimetre"] is False
    assert q["au_programme_mais_non_observee_par_la_v1"] is True
    assert "production graphique directe" in manquante["motif"]
    assert manquante["reexamen"] == "après pilote chronométré"
    # La capacité réciproque est observée, et elle n'est pas donnée pour le tracé.
    lecture = banque["MEA-1-AUTOG-01"]["capacites_officielles"]["SPE"]
    assert any(c.endswith("AUTO.FONC-4") for c in lecture)
    assert "ne remplace pas" in manquante["capacite_reciproque"]


def test_aucun_proxy_na_ete_cree_pour_le_trace(banque):
    """Ni QCM de reconnaissance, ni grille, ni type d'item, ni chaîne de saisie nouvelle."""
    types = {i["type"] for i in banque.values()}
    assert types <= {"A", "B", "C"}, types
    grilles = {cr["code"] for i in banque.values() for cr in (i.get("grille") or [])}
    assert grilles == {"DEMARCHE", "EXACT", "REDAC", "DEMPROB", "REDPROB"}, grilles
    for it in banque.values():
        enonce = VI.VR.normaliser(it["enonce"])
        assert "tracez" not in enonce and "tracer une droite" not in enonce, it["item_id"]


def test_la_duree_est_au_maximum_de_la_fenetre(banque):
    """La marge est nulle : aucune capacité de plus sans rouvrir la durée."""
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    fiche = next(i for i in cat["instruments"]
                 if i["code"] == "MATH-EA" and i["version"] == "SPE")
    f = cat["conventions"]["fenetre_duree"]
    asm = assemblage("SPE")
    total = sum(banque[i]["duree_min"] for bl in asm["blocs"] for i in bl["items"]) \
        + asm["bloc_0"]["duree_min"]
    assert total == fiche["duree_cible_min"] * f["ratio_max"]
    d = charger(RACINE / "instruments" / "MATH-EA" / "banque.json")
    assert d["couverture_automatismes"]["marge_restante"].startswith("Nulle")


# ─────────────────────────── 12 · MODELISER en SPE : deux sources qui modélisent vraiment

def test_modeliser_repose_sur_deux_sources_qui_font_produire_le_modele(banque, refs,
                                                                       capacites):
    """Décision du 2026-09-12 : deux observations suffisent, si elles en sont.

    La première question de RAIS-01 demandait d'appliquer un taux fourni par l'énoncé. Une
    tâche qui applique un modèle donné n'est pas une observation de « modéliser », et le
    sujet de spécialité n'en avait donc qu'une seule. Les deux sources doivent faire
    **écrire** le modèle : une suite arithmétique pour la croissance linéaire, une suite
    géométrique pour la croissance exponentielle.
    """
    v1 = capacites["competences_transversales"]["couverture_v1"]["MODELISER"]
    assert v1["statut"] == "minimum de couverture V1 — à réexaminer après pilote"
    couverture = VI.couverture_transversale(items_de(banque, "SPE"), refs,
                                            assemblage("SPE"))
    assert couverture["MODELISER"]["partie_2"] == v1["sources_partie_2"] == 2
    porteurs = [i["item_id"] for i in items_de(banque, "SPE")
                if "MODELISER" in i["competences_math_transversales"]]
    assert porteurs == v1["porteurs"] == ["MEA-1-ALGAN-01", "MEA-1-RAIS-01"]
    for iid in porteurs:
        enonce = VI.VR.normaliser(banque[iid]["enonce"])
        assert "modelis" in enonce, f"{iid} ne demande pas de modéliser"
    # Les deux modèles sont distincts : linéaire d'un côté, exponentiel de l'autre.
    assert "arithmetique" in VI.VR.normaliser(banque["MEA-1-ALGAN-01"]["cle"]["reponse_2pts"])
    assert "relation de recurrence" in VI.VR.normaliser(banque["MEA-1-RAIS-01"]["enonce"])
    assert "1{,}05" in banque["MEA-1-RAIS-01"]["calcul_sans_outil"], \
        "le modèle de RAIS-01 n'est pas multiplicatif : les deux sources se confondraient"


def test_rais_01_exige_lecriture_du_modele(banque):
    """Le modèle doit être produit, non appliqué : l'énoncé et la grille le disent."""
    it = banque["MEA-1-RAIS-01"]
    enonce = VI.VR.normaliser(it["enonce"])
    for exigence in ("modelis", "definir la suite", "relation de recurrence",
                     "expression explicite"):
        assert exigence in enonce, exigence
    demarche = next(c for c in it["grille"] if c["code"] == "DEMARCHE")
    assert "modèle" in demarche["descripteurs"]["3"]
    assert "modèle n'est pas écrit" in demarche["descripteurs"]["1"]


def test_sans_lexigence_du_modele_rais_01_ne_compte_plus(banque, refs):
    """Le contre-test demandé : retirer l'exigence fait tomber la seconde source.

    L'énoncé est ramené à sa forme d'avant le 2026-09-12 — appliquer un taux fourni —, et
    l'étiquette « modéliser » ne peut plus s'y appuyer : le sujet de spécialité retombe à
    une seule observation, sous le minimum admis.
    """
    items = copy.deepcopy(items_de(banque, "SPE"))
    rais = next(i for i in items if i["item_id"] == "MEA-1-RAIS-01")
    rais["enonce"] = ("Une commune compte 8 000 habitants. Sa population augmente de 5 % "
                      "par an.\n\n1. Calculer la population après un an, puis après deux "
                      "ans, en valeurs exactes.")
    modelisent = [i["item_id"] for i in items
                  if "MODELISER" in i["competences_math_transversales"]
                  and "modelis" in VI.VR.normaliser(i["enonce"])]
    assert modelisent == ["MEA-1-ALGAN-01"], modelisent
    seuil = refs["capacites_mathematiques"]["competences_transversales"][
        "regle_couverture"]["sources_min_partie_2"]
    assert len(modelisent) < seuil, \
        "une tâche qui applique un modèle fourni compte encore comme une source"


def test_appliquer_un_modele_fourni_ne_compte_pas(banque):
    """INFO-03 donne l'ajustement et le fait appliquer : l'étiquette a été retirée."""
    assert "MODELISER" not in banque["MEA-1-INFO-03"]["competences_math_transversales"]
    assert "modéliser" in banque["MEA-1-INFO-03"]["notes_conception"]
