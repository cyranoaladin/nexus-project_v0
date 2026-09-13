"""Le bilan remis : sept sections, deux registres, aucun chiffre non calculé.

Le § 8.1 fixe la structure du document, le § 8.3 ce qu'il ne peut pas contenir et le § 6.3
la chaîne de contrôles qui conditionne sa diffusion. Ces tests éprouvent les trois : la
structure sur deux jeux de données de configurations différentes, l'interdit de chiffre
non calculé en tentant d'en insérer un, et le blocage d'un bilan dont un contrôle échoue.
"""
import copy
import json
import re
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
MAQ_P2 = RACINE / "instruments" / "_MAQUETTE_P2"
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import maquette_bilan as M  # noqa: E402


@pytest.fixture(scope="module")
def bilan_p3():
    return M.Bilan().calculer()


@pytest.fixture(scope="module")
def bilan_mineur():
    return M.Bilan(MAQ / "qp_variante_mineure.json").calculer()


@pytest.fixture(scope="module")
def bilan_p2():
    return M.Bilan(dossier=MAQ_P2).calculer()


def numeros(texte):
    return re.findall(r"\d+(?:[.,]\d+)?", texte)


# ─────────────────────────────────────────────── structure du § 8.1

@pytest.mark.parametrize("jeu", ["bilan_p3", "bilan_p2"])
def test_les_sept_sections_sont_presentes_et_dans_l_ordre(jeu, request):
    texte, _ = B.rendre(request.getfixturevalue(jeu))
    positions = [texte.index(f"\n## {n}. ") for n in range(1, 8)]
    assert positions == sorted(positions), "les sections ne se suivent pas"


@pytest.mark.parametrize("jeu", ["bilan_p3", "bilan_p2"])
def test_tous_les_controles_passent(jeu, request):
    _, ctrl = B.rendre(request.getfixturevalue(jeu))
    echecs = [(nom, constat) for nom, etat, constat in ctrl if etat is False]
    assert not echecs, "; ".join(f"{n} : {c}" for n, c in echecs)
    sans_objet = [nom for nom, etat, _ in ctrl if etat is None]
    assert sans_objet == ["V-Instruments"], \
        "en maquette, seul V-Instruments est sans objet"


@pytest.mark.parametrize("jeu", ["bilan_p3", "bilan_p2"])
def test_les_matieres_sont_nommees_en_clair(jeu, request):
    """Un candidat ne lit pas « EDS-SES ». Le bilan porte l'intitulé du périmètre."""
    b = request.getfixturevalue(jeu)
    texte, _ = B.rendre(b)
    for pc in b.perimetres_passes:
        assert B.nom_matiere(b, pc) in texte, f"{pc} n'est pas nommé en clair"


# ─────────────────────────────────────────────── § 8.3 — ce qui est interdit

def test_les_controles_de_provenance_sont_dans_la_chaine(bilan_p3):
    """Le détail des refus est éprouvé dans tests/test_provenance.py ; ici, la chaîne."""
    _, ctrl = B.rendre(bilan_p3)
    noms = [nom for nom, _, _ in ctrl]
    assert "V-Provenance" in noms and "V-Texte" in noms


def test_aucun_montant_ne_figure_dans_le_bilan(bilan_p3):
    texte, ctrl = B.rendre(bilan_p3)
    assert B.RESERVE_FORMULE in texte, "l'emplacement réservé de la formule a disparu"
    v_tarif = next(x for x in ctrl if x[0] == "V-Tarif")
    assert v_tarif[1], v_tarif[2]


def test_aucun_terme_bloquant(bilan_p3):
    _, ctrl = B.rendre(bilan_p3)
    assert next(x for x in ctrl if x[0] == "V-Texte")[1]


# ─────────────────────────────────────────────── § 6.3 — un contrôle qui échoue bloque

def test_un_controle_qui_echoue_met_le_bilan_en_attente(bilan_p3):
    b = copy.deepcopy(bilan_p3)
    for l in b.lignes:
        code = l["instrument"].split("/")[0]
        it = b.banques.get(code, {}).get(l["item_id"])
        if it and it["type"] == "A" and int(l["score"]) == 0:
            l["score"] = str(it["score_max"])
            break
    else:
        pytest.skip("aucun item fermé raté dans le jeu")
    texte, ctrl = B.rendre(b)
    assert not B.diffusable(ctrl)
    assert "en attente" in texte.lower()
    assert "\n## 5. " not in texte, "le corps du bilan a été diffusé malgré un contrôle échoué"


# ─────────────────────────────────────────────── registre parent

def test_le_registre_parent_porte_exactement_les_memes_chiffres(bilan_mineur):
    candidat, _ = B.rendre(bilan_mineur, "candidat")
    parent, _ = B.rendre(bilan_mineur, "parent")
    assert sorted(numeros(candidat)) == sorted(numeros(parent)), \
        "les deux versions ne portent pas les mêmes valeurs"


def test_le_registre_parent_ne_tutoie_pas_le_candidat(bilan_mineur):
    parent, _ = B.rendre(bilan_mineur, "parent")
    corps = parent.split("\n## 1. ", 1)[1]
    assert "votre enfant" in corps.lower()
    assert not re.search(r"\bvous (disposez|travaillez|composez|apprenez)\b", corps.lower()), \
        "la version parent s'adresse encore au candidat"


def test_la_version_parent_ne_se_declenche_que_pour_un_mineur(bilan_p3, bilan_mineur):
    r = B.REGLE_PARENT
    assert bilan_p3.qp["reponses"][r["variable_qp"]] != r["valeur_declencheuse"]
    assert bilan_mineur.qp["reponses"][r["variable_qp"]] == r["valeur_declencheuse"]
    assert B.registres_a_produire(bilan_p3) == ["candidat"]
    assert B.registres_a_produire(bilan_mineur) == ["candidat", "parent"]


# ─────────────────────────────────────────────── section 4 — appuis et priorités

@pytest.mark.parametrize("jeu", ["bilan_p3", "bilan_p2"])
def test_les_priorites_sont_celles_du_plan_et_dans_son_ordre(jeu, request):
    """EC-27 — la section 4 ne peut pas contredire le plan de démarrage.

    C'est l'invariant que la direction a demandé de rendre indémontable : sections 2, 4,
    5 et 7 disent le même ordre parce qu'elles lisent la même règle de priorité.
    """
    b = request.getfixturevalue(jeu)
    _, priorites = B.appuis_et_priorites(b)
    ordre, _ = b.priorite()
    defaut = b.regles["module_entree"]["libelle_defaut"]
    attendus = [g for g in ordre
                if b.module_entree(b.module_entree_groupe(g)[0])[0] != defaut]
    n = b.regles["points_appui"]["nombre_priorites"]
    assert [x["groupe"] for x in priorites] == attendus[:n]
    rangs = {g: i for i, g in enumerate(ordre)}
    assert [rangs[x["groupe"]] for x in priorites] == \
        sorted(rangs[x["groupe"]] for x in priorites), \
        "la section 4 énumère les priorités dans un autre ordre que le plan"


def test_le_module_de_chaque_priorite_est_celui_du_plan(bilan_p3):
    for x in B.appuis_et_priorites(bilan_p3)[1]:
        pc, _ = bilan_p3.module_entree_groupe(x["groupe"])
        assert x["perimetre"] == pc
        assert x["module"] == bilan_p3.module_entree(pc)[0]


def test_aucune_priorite_de_remplissage(bilan_p3):
    """Moins de groupes concernés, moins de priorités — jamais un complément inventé."""
    b = copy.deepcopy(bilan_p3)
    defaut = b.regles["module_entree"]["libelle_defaut"]
    ordre, _ = b.priorite()
    garde = ordre[0]
    b.module_entree = lambda pc, _o=b.module_entree, _g=garde: (
        _o(pc) if pc in b.groupes[_g] else (defaut, None, "aucune intervention"))
    _, priorites = B.appuis_et_priorites(b)
    assert len(priorites) == 1 and priorites[0]["groupe"] == garde


def test_les_appuis_sont_les_scores_les_plus_hauts(bilan_p3):
    appuis, priorites = B.appuis_et_priorites(bilan_p3)
    pris = {(x["perimetre"], x["competence"]) for x in priorites if x["competence"]}
    evalues = sorted((x["part"] for k, x in bilan_p3.res.items()
                      if x["evalue"] and k not in pris), reverse=True)
    assert [x["part"] for _, x in appuis] == evalues[:len(appuis)]
    assert not ({k for k, _ in appuis} & pris), \
        "une compétence figure à la fois en appui et en priorité"


# ─────────────────────────────────────────────── Q-22 · le groupe de planification

def test_le_groupe_francais_reunit_les_deux_perimetres(bilan_p2):
    assert bilan_p2.groupes["FRANCAIS"] == ["FR-EAF", "FR-MAI"]
    assert bilan_p2.groupe_de["FR-EAF"] == bilan_p2.groupe_de["FR-MAI"] == "FRANCAIS"


def test_l_enveloppe_du_groupe_est_le_maximum_jamais_la_somme(bilan_p2):
    """Q-22 — deux périmètres passés ne font pas deux enveloppes."""
    h, _, _ = bilan_p2.rythme_groupe("FRANCAIS")
    separes = [bilan_p2.rythme(pc)[0] for pc in bilan_p2.groupes["FRANCAIS"]]
    assert h == max(separes)
    assert h < sum(separes), "le jeu ne distingue plus maximum et somme"


def test_le_total_hebdomadaire_compte_les_groupes_et_non_les_perimetres(bilan_p2):
    texte, _ = B.rendre(bilan_p2)
    section = texte.split("\n## 7. ", 1)[1]
    total = sum(bilan_p2.rythme_groupe(g)[0] for g in bilan_p2.groupes)
    par_perimetre = sum(bilan_p2.rythme(pc)[0] for pc in bilan_p2.perimetres_passes)
    assert total < par_perimetre, "le jeu ne distingue plus groupes et périmètres"
    assert f"recommandé : {M.heures(total)}**" in section
    lignes = [l for l in section.splitlines()
              if l.startswith("| ") and " h |" in l]
    assert len(lignes) == len(bilan_p2.groupes), \
        "la répartition compte les périmètres et non les matières de travail"


def test_les_deux_perimetres_francais_partagent_un_rang(bilan_p2):
    texte, _ = B.rendre(bilan_p2)
    synthese = texte.split("\n## 2. ", 1)[1].split("\n## 3. ", 1)[0]
    rangs = {}
    for ligne in synthese.splitlines():
        for pc in bilan_p2.perimetres_passes:
            if f"**{B.nom_matiere(bilan_p2, pc)}**" in ligne:
                rangs[pc] = ligne.rstrip("| ").rsplit("|", 1)[-1].strip()
    assert rangs["FR-EAF"] == rangs["FR-MAI"], "les deux lectures du français ont deux rangs"


def test_les_resultats_des_deux_perimetres_restent_separes(bilan_p2):
    """Aucun score moyenné, aucune compétence fusionnée : les deux lectures subsistent."""
    texte, _ = B.rendre(bilan_p2)
    carto = texte.split("\n## 3. ", 1)[1].split("\n## 4. ", 1)[0]
    synthese = texte.split("\n## 2. ", 1)[1].split("\n## 3. ", 1)[0]
    for pc in ("FR-EAF", "FR-MAI"):
        assert f"### {B.nom_matiere(bilan_p2, pc)}" in carto
        assert f"{bilan_p2.agr[pc]['global'] * 100:.0f} %" in synthese
    assert bilan_p2.agr["FR-EAF"]["global"] != bilan_p2.agr["FR-MAI"]["global"]
    # EC-02 : les deux périmètres portent des codes homonymes. Le moteur les indexe par
    # (périmètre, compétence) : même dans un assemblage qui les ferait coexister, aucune
    # fusion n'est possible.
    codes = {pc: {c["code"] for c in bilan_p2.per[pc]["competences"]}
             for pc in ("FR-EAF", "FR-MAI")}
    assert codes["FR-EAF"] & codes["FR-MAI"], "EC-02 n'a plus d'objet : pas d'homonyme"
    assert all(isinstance(k, tuple) and len(k) == 2 for k in bilan_p2.res)


def test_le_groupe_par_defaut_est_le_perimetre(bilan_p3):
    """Un périmètre sans groupe déclaré forme le sien. Deux groupes sont déclarés :
    FRANCAIS (FR-EAF, FR-MAI) et MATHEMATIQUES (EDS-MATH, MATH-EA)."""
    declares = {"FR-EAF", "FR-MAI", "EDS-MATH", "MATH-EA"}
    for pc in bilan_p3.perimetres_passes:
        if pc not in declares:
            assert bilan_p3.groupe_de[pc] == pc
        else:
            assert bilan_p3.groupe_de[pc] in ("FRANCAIS", "MATHEMATIQUES")


# ─────────────────────────────────────────────── niveau d'entrée / module d'entrée

@pytest.mark.parametrize("jeu", ["bilan_p3", "bilan_p2"])
def test_le_niveau_dentree_et_le_module_dentree_sont_deux_notions(jeu, request):
    """Le premier est un degré du référentiel, le second l'intitulé d'une compétence."""
    b = request.getfixturevalue(jeu)
    degres = {p["libelle"] for p in b.regles["niveaux_competence"]["paliers"]}
    degres |= {b.regles["module_entree"]["libelle_remise_a_niveau"],
               b.regles["module_entree"]["libelle_defaut"]}
    for pc in b.perimetres_passes:
        niveau = b.niveau_entree(pc)
        module, code, _ = b.module_entree(pc)
        assert niveau in degres, f"{pc} : niveau d'entrée hors du référentiel"
        if code:
            assert module != niveau, f"{pc} : le module répète le degré"
            assert b.comps[(pc, code)]["intitule"] in module


@pytest.mark.parametrize("jeu", ["bilan_p3", "bilan_p2"])
def test_la_synthese_porte_le_degre_et_la_section_5_l_intitule(jeu, request):
    b = request.getfixturevalue(jeu)
    texte, _ = B.rendre(b)
    synthese = texte.split("\n## 2. ", 1)[1].split("\n## 3. ", 1)[0]
    plan = texte.split("\n## 5. ", 1)[1].split("\n## 6. ", 1)[0]
    for pc in b.perimetres_passes:
        module, code, _ = b.module_entree(pc)
        assert b.niveau_entree(pc) in synthese
        if code:
            assert B.module_lisible(module) not in synthese, \
                "la synthèse porte un intitulé de module au lieu du degré"
            assert B.module_lisible(module) in plan


def test_le_signal_de_calibration_apparait_en_section_4(bilan_p3):
    texte, _ = B.rendre(bilan_p3)
    section = texte.split("\n## 4. ", 1)[1].split("\n## 5. ", 1)[0]
    signale = [k for k, c in bilan_p3.calibration_competences() if c["signal"]]
    for pc, comp in signale:
        assert bilan_p3.res[(pc, comp)]["intitule"] in section, \
            f"écart de calibration sur {pc}/{comp} absent de la section 4"


# ─────────────────────────────────────────────── sections 5 et 7 — plan et volume

def test_chaque_matiere_porteuse_dun_rythme_a_son_plan(bilan_p3):
    texte, _ = B.rendre(bilan_p3)
    section = texte.split("\n## 5. ", 1)[1].split("\n## 6. ", 1)[0]
    for pc in bilan_p3.perimetres_passes:
        module, _, _ = bilan_p3.module_entree(pc)
        assert B.nom_matiere(bilan_p3, pc) in section
        assert B.module_lisible(module) in section, f"module d'entrée de {pc} absent du plan"


def test_le_volume_total_est_la_somme_des_rythmes(bilan_p3):
    texte, _ = B.rendre(bilan_p3)
    section = texte.split("\n## 7. ", 1)[1]
    # La somme se prend sur les groupes de planification, non sur les périmètres : deux
    # périmètres d'un même groupe n'ouvrent qu'une enveloppe (EC-28).
    somme = sum(bilan_p3.rythme_groupe(g)[0] for g in bilan_p3.groupes)
    par_perimetre = sum(bilan_p3.rythme(pc)[0] for pc in bilan_p3.perimetres_passes)
    assert somme < par_perimetre, "le jeu ne distingue plus groupes et périmètres"
    assert M.heures(somme) in section
    assert f"recommandé : {M.heures(somme)}**" in section


def test_le_depassement_du_plafond_est_dit(bilan_p3):
    """§ 8.2 — le plafond dépassé est signalé, jamais absorbé en silence.

    Le jeu P3 tient sous son plafond : le test s'ignorait donc à chaque exécution et ne
    prouvait rien. La règle se vérifie en abaissant les heures déclarées disponibles sur
    une copie du bilan — c'est la situation réelle d'un candidat qui dispose de moins de
    temps que son plan n'en demande, et c'est elle que le § 8.2 régit.
    """
    somme = sum(bilan_p3.rythme_groupe(g)[0] for g in bilan_p3.groupes)
    b = copy.deepcopy(bilan_p3)
    b.qp["reponses"]["heures_disponibles"] = somme - 2
    texte, _ = B.rendre(b)
    section = texte.split("\n## 7. ", 1)[1]
    assert M.heures(2) in section, \
        "le dépassement de deux heures n'est pas dit dans la section 7"


def test_sous_le_plafond_le_bilan_dit_que_le_volume_tient(bilan_p3):
    """Contre-épreuve : le jeu tel qu'il est tient dans les heures déclarées, et le dit.

    Le § 8.2 distingue deux constats : le volume dépasse le seuil de vigilance du Cahier,
    ou il dépasse les heures que le candidat a déclarées. Le second seul est un
    dépassement ; le premier est un signal. Le jeu P3 est dans le premier cas.
    """
    somme = sum(bilan_p3.rythme_groupe(g)[0] for g in bilan_p3.groupes)
    dispo = bilan_p3.qp["reponses"]["heures_disponibles"]
    assert somme <= dispo
    texte, _ = B.rendre(bilan_p3)
    section = texte.split("\n## 7. ", 1)[1]
    assert f"tient dans les {M.heures(dispo)}" in section, section[:400]


# ─────────────────────────────────────────────── jeu P2 : conformité à sa commande

def test_les_attendus_du_jeu_p2_sont_tenus(bilan_p2):
    resultats = M.verifier_specification(bilan_p2)
    ecarts = [(v["id"], [(d, o) for d, o, ok in v["lignes"] if not ok])
              for v in resultats if not v["conforme"]]
    assert not ecarts, "écarts à la spécification : " + "; ".join(
        f"{i} → " + ", ".join(f"demandé {d}, obtenu {o}" for d, o in lignes)
        for i, lignes in ecarts)


def test_le_jeu_p2_exerce_les_trois_types_de_verification():
    spec = json.loads((MAQ_P2 / "specification.json").read_text(encoding="utf-8"))
    types = {v["type"] for a in spec["attendus"] for v in a["verifications"]}
    assert {"competence_absente", "competence_evaluee", "agregat_absent"} <= types


def test_la_colonne_tache_disparait_quand_aucune_matiere_nen_a(bilan_p2):
    """Aucun indicateur vide : une colonne sans donnée ne s'affiche pas."""
    texte, _ = B.rendre(bilan_p2)
    synthese = texte.split("\n## 2. ", 1)[1].split("\n## 3. ", 1)[0]
    avec = [pc for pc in bilan_p2.perimetres_passes if bilan_p2.agr[pc]["tache"] is not None]
    assert ("Tâche type épreuve" in synthese) == bool(avec)


def test_le_francais_de_l_oral_est_rendu_sans_competence_d_ecrit(bilan_p2):
    """Q-21 — l'assemblage oral ne porte ni rédaction ni correction de la langue écrite."""
    absentes = {"REDA", "LANG", "ARGU"}
    for comp in absentes:
        assert ("FR-EAF", comp) not in bilan_p2.res, f"{comp} évaluée en configuration oral"
    texte, _ = B.rendre(bilan_p2)
    assert B.nom_matiere(bilan_p2, "FR-EAF") in texte
    assert bilan_p2.per["FR-EAF"]["libelle"] not in texte, \
        "le titre du périmètre annonce l'écrit à un candidat qui ne repasse que l'oral"


# ─────────────────────────────────────────────── preuve de registre (contre-expertise)

def test_la_preuve_de_registre_ne_laisse_aucun_residu(bilan_mineur):
    """Point 11 : la version parent ne diffère que dans les zones que le code déclare."""
    import preuve_registre as PR
    r = PR.comparer(bilan_mineur)
    assert r["variantes"], "aucune variante de registre déclarée : la preuve est vide"
    assert not r["residus"], r["residus"][:5]
    assert r["nombres_identiques"]
    assert r["lignes_differentes"] > 0, "les deux versions seraient identiques"


def test_la_preuve_de_registre_detecte_un_ecart_de_valeur(bilan_mineur, monkeypatch):
    """Contre-épreuve : une valeur qui différerait entre les deux versions serait vue."""
    import preuve_registre as PR
    original = B.composer

    def composer_truque(b, registre="candidat"):
        texte, p = original(b, registre)
        if registre == "parent":
            texte = texte.replace("| 56 % |", "| 57 % |", 1)
        return texte, p

    monkeypatch.setattr(B, "composer", composer_truque)
    r = PR.comparer(bilan_mineur)
    assert r["residus"] or not r["nombres_identiques"], \
        "une valeur modifiée dans la version parent passe inaperçue"


def test_le_couple_candidat_parent_existe_sur_le_disque():
    for nom in ("bilan_P3_CL-2026-0001.md", "bilan_P3_CL-2026-0001_parent.md",
                "preuve_registre_CL-2026-0001.md"):
        assert (MAQ / nom).exists(), f"{nom} manque à la remise"
