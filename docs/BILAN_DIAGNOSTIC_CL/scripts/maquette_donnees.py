#!/usr/bin/env python3
"""Dérive le jeu de saisie de la maquette depuis sa spécification.

instruments/_MAQUETTE/specification.json est la commande de la direction pédagogique :
elle fixe, compétence par compétence, bloc par bloc et palier par palier, les points que
le candidat fictif obtient. Ce script en déduit saisie.csv et grilles.csv. Aucune valeur
n'est décidée ici : un jeu de données qui s'écarterait de la commande ne pourrait plus le
faire en silence, ce qui est le défaut relevé par l'audit de la maquette v1.

Les instruments passés ne sont pas listés : ils se déduisent du profil et des spécialités
déclarés au questionnaire de parcours, par le catalogue et par sa convention de sélection
de version.
"""
from __future__ import annotations

import copy
import csv
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import contexte as CTX  # noqa: E402
import eligibilite as EL  # noqa: E402

MAQ = RACINE / "instruments" / "_MAQUETTE"
CORRECTEUR = "COR-01"


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


#: Ordre des opérations, et il n'est pas indifférent : faits déclarés → éligibilité de
#: l'article 3 → vérification de la preuve → ouverture du profil → dérivation des
#: instruments. Le gate est franchi une fois, ici ; aucune sélection d'instrument ne le
#: rejoue pour son propre compte.
def statut_du_profil(qp: dict) -> dict:
    """L'ouverture réglementaire du profil, avant toute dérivation d'instrument.

    Une maquette peut simuler un profil que le dossier réel n'ouvrirait pas — c'est le
    propre d'un jeu de démonstration — mais seulement en le déclarant : `mode_rendu`
    vaut alors « maquette », le contournement est nommé dans le statut rendu, et le
    bandeau du bilan dit que les données sont fictives. Un rendu de production n'a pas
    cette porte.
    """
    st = EL.statut_profil(qp["reponses"])
    if st["ouvert"] or qp.get("mode_rendu") != "maquette":
        return st
    return {**st, "ouvert": True, "simulation": True,
            "statut_reel": st["statut"], "statut": "P3_SIMULE",
            "motif": f"mode de rendu « maquette » : le gate de l'article 3 est simulé "
                     f"(situation réelle : {st['statut']} — {st['motif']})"}


VALEURS_SPE_NON_CONNUES = {"aucune", "inconnue", "non_renseignee", "non_renseigne", "none", "", None}


def est_specialite_connue(spe: str | None) -> bool:
    """Indique si une spécialité est explicitement connue et renseignée."""
    if not spe:
        return False
    return str(spe).strip().lower() not in VALEURS_SPE_NON_CONNUES


def liste_effective_des_instruments_a_passer(qp: dict, cat: dict) -> list[tuple[str, str]]:
    """Les instruments réellement à passer — vide si le profil n'est pas ouvert.

    Q-26 ne conditionne pas un instrument mais un profil : quand le passage en une seule
    session n'est pas établi, ce ne sont pas les seules mathématiques anticipées qui
    tombent, c'est toute la dérivation. Le contrôle est donc en amont, une seule fois.
    """
    if not statut_du_profil(qp)["ouvert"]:
        return []
    return _instruments_du_profil(qp, cat)


def _instruments_du_profil(qp: dict, cat: dict) -> list[tuple[str, str]]:
    """Instruments d'un candidat, déduits de ce qu'il a déclaré.

    Le profil commande les instruments généraux ; la liste des spécialités et celle
    abandonnée commandent les versions de spécialité ; la configuration française
    (Q-19) commande les instruments de français. Rien n'est écrit en dur.
    """
    r = qp["reponses"]
    profil = r["profil"]
    sel = cat["conventions"]["selection_version_specialite"]["par_profil"][profil]
    conv_fr = cat["conventions"]["configuration_francais"]
    config = r[conv_fr["variable_qp"]]
    passes = []
    for i in cat["instruments"]:
        if i["perimetre"] and i["perimetre"].startswith("EDS-"):
            continue
        # Les instruments de français sont sélectionnés par la configuration déclarée au
        # questionnaire, et par elle seule ; les autres par le profil (Q-19). La
        # configuration est orthogonale au profil : un P2 peut repasser l'oral.
        # Un instrument dont le contenu dépend du programme national d'œuvres porte sa
        # session finale : celle du candidat la choisit, comme l'année de passation choisit
        # le sujet de mathématiques. Le nom du fichier n'y entre pour rien.
        session = i.get("session_baccalaureat_finale")
        if session is not None and int(session) != int(r["session_baccalaureat_finale"]):
            continue
        cf = i.get("configuration_francais")
        if i["code"] == "MATH-EA":
            # B1 & B12 : sélectionné selon math_ea_due si explicite, ou dérivé des faits par statut_math_ea
            if "math_ea_due" in r and not r["math_ea_due"]:
                continue
            if i.get("annee_scolaire_passation_ea") != r.get("annee_scolaire_passation_ea"):
                continue
            parcours = "specialite" if "MATH" in r["specialites"] else "specifiques"
            if i.get("parcours_mathematiques") != parcours:
                continue
            if CTX.statut_math_ea({**r, "parcours_mathematiques": parcours})["statut"] \
                    not in ("a_presenter_spe", "a_presenter_specifiques"):
                continue
            passes.append((i["code"], i["version"]))
            continue
        if i["code"] in ("TC-HG", "TC-EMC"):
            # B9 & B10 & B13 : la version dérive du choix réglementaire mode_evaluations_ponctuelles
            mode_ep = r.get("mode_evaluations_ponctuelles")
            if not mode_ep:
                continue
            if profil == "P1":
                if mode_ep == "annuelle":
                    version_attendue = "1RE"
                else:
                    # En mode fin_cycle, les épreuves ponctuelles de tronc commun ne sont pas passées en 1re
                    # Elles restent disponibles uniquement si un diagnostic d'accompagnement est requis
                    if r.get("diagnostic_nexus_utile") or r.get("inclure_diagnostic_premiere_fin_cycle"):
                        version_attendue = "1RE"
                    else:
                        continue
            elif profil == "P2":
                version_attendue = "TLE" if mode_ep == "annuelle" else "ETENDUE"
            elif profil == "P3":
                version_attendue = "ETENDUE"
            else:
                continue
            if i["version"] != version_attendue:
                continue
            passes.append((i["code"], i["version"]))
            continue

        if i["code"] == "TC-ES":
            mode_ep = r.get("mode_evaluations_ponctuelles")
            if mode_ep:
                if profil == "P1":
                    if mode_ep == "annuelle":
                        version_attendue = "1RE"
                    else:
                        if r.get("diagnostic_nexus_utile") or r.get("inclure_diagnostic_premiere_fin_cycle"):
                            version_attendue = "1RE"
                        else:
                            continue
                elif profil == "P2":
                    version_attendue = "TLE" if mode_ep == "annuelle" else "ETENDUE"
                elif profil == "P3":
                    version_attendue = "ETENDUE"
                else:
                    continue
                if i["version"] != version_attendue:
                    continue
                passes.append((i["code"], i["version"]))
                continue
            elif profil not in i["profils"]:
                continue
            passes.append((i["code"], i["version"]))
            continue
        if i["code"] == "PHI":
            # Philosophie : épreuve terminale obligatoire (P1=absent, P2=présent, P3=présent)
            if profil in ("P2", "P3"):
                passes.append((i["code"], i["version"]))
            continue

        if i["code"] in ("FR-EAF", "FR-EAF-ORAL"):
            # Épreuves anticipées de français :
            # P1 et P3 : obligatoires (anticipation ou même session)
            # P2 : absentes du parcours standard, présentes uniquement si eaf_due != 'none'
            eaf_due = r.get("eaf_due")
            if eaf_due is None:
                cfg = r.get("epreuves_francais_a_presenter", "les_deux")
                eaf_due = "none" if (profil == "P2" and cfg == "aucune") else (cfg if cfg != "aucune" else "none")

            if profil == "P2" and eaf_due in ("none", "aucune", False):
                continue

            session = i.get("session_baccalaureat_finale")
            if session is not None and int(session) != int(r["session_baccalaureat_finale"]):
                continue

            cfg_effective = eaf_due if profil == "P2" else config
            if cf is not None:
                admis = cf if isinstance(cf, list) else [cf]
                if cfg_effective not in admis:
                    continue
            passes.append((i["code"], i["version"]))
            continue

        if i["code"] in ("FR-POS", "FR-POS-ORAL"):
            # B11 : le test de positionnement en français scolaire s'active sur demande explicite
            if not (r.get("fr_pos_requis") or r.get("positionnement_francais")):
                continue
            passes.append((i["code"], i["version"]))
            continue

        if i["code"] == "FR-MAI":
            # Diagnostic pédagogique de maîtrise du français comme outil de travail
            if profil == "P2":
                if r.get("fr_mai_requis") is False:
                    continue
            elif profil == "P3":
                if not r.get("fr_mai_requis", False):
                    continue
            else:
                continue
            passes.append((i["code"], i["version"]))
            continue

        if cf is not None:
            admis = cf if isinstance(cf, list) else [cf]
            if config not in admis:
                continue
        elif profil not in i["profils"]:
            continue
        passes.append((i["code"], i["version"]))

    # Modélisation des enseignements de spécialité
    if "specialites_suivies_premiere" in r:
        spes_premiere = r["specialites_suivies_premiere"]
        spe_non_poursuivie = r.get("specialite_non_poursuivie", "aucune")
        spes_terminales = r.get("specialites_terminales")
        if spes_terminales is None:
            spes_terminales = [s for s in spes_premiere if s != spe_non_poursuivie] if est_specialite_connue(spe_non_poursuivie) else []
        mode_ep = r.get("mode_evaluations_ponctuelles", "annuelle" if profil != "P3" else "fin_cycle")
        if profil == "P1":
            for spe in spes_premiere:
                code = f"EDS-{spe}"
                passes.append((code, "N1"))
        elif profil == "P2":
            for spe in spes_terminales:
                code = f"EDS-{spe}"
                passes.append((code, "NT"))
            if mode_ep == "fin_cycle" and est_specialite_connue(spe_non_poursuivie):
                code = f"EDS-{spe_non_poursuivie}"
                passes.append((code, "N1"))
        elif profil == "P3":
            for spe in spes_terminales:
                code = f"EDS-{spe}"
                passes.append((code, "NT"))
            if est_specialite_connue(spe_non_poursuivie):
                code = f"EDS-{spe_non_poursuivie}"
                passes.append((code, "N1"))
    else:
        for spe in r["specialites"]:
            code = f"EDS-{spe}"
            if "toutes" in sel:
                version = sel["toutes"]
            else:
                version = sel["abandonnee" if spe == r.get("specialite_abandonnee") else "poursuivie"]
            if not any(i["code"] == code and i["version"] == version for i in cat["instruments"]):
                raise SystemExit(f"{code}/{version} absent du catalogue")
            passes.append((code, version))
    return passes


#: Nom historique de la liste effective : conservé pour les appelants, il passe
#: désormais par le gate comme tous les autres.
instruments_passes = liste_effective_des_instruments_a_passer


def epreuves_reglementaires_dues_vs_diagnostics(qp: dict, cat: dict) -> dict:
    """Sépare formellement les épreuves réglementaires dues et les diagnostics utiles.

    Le choix d'inscription (annuelle vs fin_cycle) commande les épreuves d'examen dues
    cette année scolaire, mais un élève en Première en mode fin_cycle peut toujours
    bénéficier d'un diagnostic d'étape en tronc commun et spécialités pour son accompagnement.
    """
    r = qp["reponses"]
    profil = r["profil"]
    philosophie_due = profil in ("P2", "P3")
    mode_ep = r.get("mode_evaluations_ponctuelles", "fin_cycle" if profil == "P3" else "annuelle")

    if "eaf_due" in r:
        eaf_due = r["eaf_due"]
    else:
        cfg = r.get("epreuves_francais_a_presenter", "les_deux")
        eaf_due = "none" if (profil == "P2" and cfg == "aucune") else (cfg if cfg != "aucune" else "none")

    qp_regl = copy.deepcopy(qp)
    qp_regl["reponses"]["diagnostic_nexus_utile"] = False
    qp_regl["reponses"]["fr_pos_requis"] = False
    qp_regl["reponses"]["positionnement_francais"] = False
    qp_regl["reponses"]["fr_mai_requis"] = False
    qp_regl["reponses"]["eaf_due"] = eaf_due
    all_insts = _instruments_du_profil(qp_regl, cat)

    # Filtrage réglementaire strict des épreuves dues selon le profil et le mode
    dues = []
    if profil == "P1":
        # En Première, les épreuves anticipées officielles sont obligatoires (EAF écrit, oral, MATH-EA)
        # Le mode annuelle/fin_cycle ne supprime jamais MATH-EA.
        spe_non_poursuivie = r.get("specialite_non_poursuivie") or r.get("specialite_abandonnee")
        spe_connue = spe_non_poursuivie if est_specialite_connue(spe_non_poursuivie) else None
        for c, v in all_insts:
            if c in ("FR-EAF", "FR-EAF-ORAL", "MATH-EA"):
                dues.append((c, v))
            elif mode_ep == "annuelle":
                if c in ("TC-HG", "TC-EMC", "TC-ES"):
                    dues.append((c, v))
                elif c.startswith("EDS-"):
                    spe_code = c.removeprefix("EDS-")
                    # Seule la spécialité non poursuivie relève du contrôle continu dû cette session.
                    # Si non renseignée ou non encore déterminée, aucun EDS n'est une obligation officielle.
                    if spe_connue and spe_code == spe_connue:
                        dues.append((c, v))
    elif profil == "P2":
        for c, v in all_insts:
            if c in ("PHI", "GO") or (c.startswith("EDS-") and v == "NT"):
                dues.append((c, v))
            elif c in ("TC-HG", "TC-EMC", "TC-ES"):
                dues.append((c, v))
            elif c.startswith("EDS-") and v == "N1" and mode_ep == "fin_cycle":
                spe_non_poursuivie = r.get("specialite_non_poursuivie") or r.get("specialite_abandonnee")
                if est_specialite_connue(spe_non_poursuivie) and c == f"EDS-{spe_non_poursuivie}":
                    dues.append((c, v))
            elif c in ("FR-EAF", "FR-EAF-ORAL") and eaf_due != "none":
                dues.append((c, v))
            elif c == "MATH-EA" and r.get("math_ea_due"):
                dues.append((c, v))
    elif profil == "P3":
        for c, v in all_insts:
            if c not in ("QP", "MET", "FR-POS", "FR-POS-ORAL", "FR-MAI"):
                dues.append((c, v))

    # Évaluations officielles reportées en fin de cycle (spécifique à P1 en mode fin_cycle)
    reportees = []
    if profil == "P1" and mode_ep == "fin_cycle":
        reportees = [
            ("TC-HG", "1RE", "Histoire-géographie"),
            ("TC-EMC", "1RE", "Enseignement moral et civique"),
            ("TC-ES", "1RE", "Enseignement scientifique"),
        ]
        spe_non_poursuivie = r.get("specialite_non_poursuivie") or r.get("specialite_abandonnee")
        if est_specialite_connue(spe_non_poursuivie):
            reportees.append((f"EDS-{spe_non_poursuivie}", "N1", f"Spécialité non poursuivie ({spe_non_poursuivie})"))
        else:
            reportees.append(("EDS-N1", "N1", "Spécialité non poursuivie en Terminale (à déterminer)"))

    # Invariant réglementaire strict :
    # nombre d'EDS N1 classées "obligation officielle" <= 1 pour P1 annuel
    # En P1 fin_cycle : 0 EDS N1 due cette année ; la future specialite_non_poursuivie est reportée.
    # En P2 fin_cycle / P3 : exactement la spécialité non poursuivie N1 est due si elle est renseignée.
    eds_n1_dues = [c for c, v in dues if c.startswith("EDS-") and v == "N1"]
    if profil == "P1":
        if mode_ep == "annuelle":
            assert len(eds_n1_dues) <= 1, f"P1 annuel : maximum 1 EDS N1 due (reçu {len(eds_n1_dues)})"
        elif mode_ep == "fin_cycle":
            assert len(eds_n1_dues) == 0, f"P1 fin_cycle : 0 EDS N1 due cette année (reçu {len(eds_n1_dues)})"
    elif profil == "P2":
        if mode_ep == "annuelle":
            assert len(eds_n1_dues) == 0, f"P2 annuel : 0 EDS N1 due (reçu {len(eds_n1_dues)})"
        elif mode_ep == "fin_cycle":
            assert len(eds_n1_dues) <= 1, f"P2 fin_cycle : maximum 1 EDS N1 due (reçu {len(eds_n1_dues)})"
    elif profil == "P3":
        assert len(eds_n1_dues) <= 1, f"P3 : maximum 1 EDS N1 due (reçu {len(eds_n1_dues)})"

    # Diagnostics d'accompagnement Nexus utiles
    qp_diag = copy.deepcopy(qp)
    qp_diag["reponses"]["diagnostic_nexus_utile"] = True
    diag = _instruments_du_profil(qp_diag, cat)

    return {
        "epreuves_reglementaires_dues": dues,
        "evaluations_reportees_fin_cycle": reportees,
        "diagnostics_nexus_utiles": diag,
        "philosophie_due": philosophie_due,
        "eaf_due": eaf_due,
        "mode_evaluations_ponctuelles": mode_ep,
        "official_p1_speciality_count": len(eds_n1_dues) if profil == "P1" else 0,
    }


def repartir(points: int, membres: list[dict]) -> list[int]:
    """Répartit des points sur des mesures, dans l'ordre de l'assemblage.

    Chaque mesure est servie au maximum avant de passer à la suivante : la répartition
    est déterministe et le reste tombe sur une seule, ce qui produit une copie
    vraisemblable — des questions réussies, des questions manquées, une partielle.

    Le résultat est une liste parallèle à `membres`, et non un dictionnaire indexé par
    identifiant d'item : les critères d'une même tâche de production partagent leur
    item_id, et une indexation par cet identifiant les écraserait les uns les autres.
    """
    reste, out = points, []
    for m in membres:
        pris = min(reste, m["score_max"])
        out.append(pris)
        reste -= pris
    if reste:
        raise SystemExit(f"{reste} point(s) non répartis sur "
                         f"{[m.get('critere') or m['item_id'] for m in membres]}")
    return out


def reponse_item(it: dict, score: int) -> tuple[str, str]:
    """Réponse brute et code d'erreur, selon le type de l'item (§ 6.2)."""
    if it["type"] == "A":
        cle = it["cle"]["reponse"]
        if score == it["score_max"]:
            return cle, ""
        # Le distracteur retenu est le premier de la clé : le choix est déterministe et
        # documenté par la clé elle-même, jamais inventé ici.
        return sorted(it["cle"]["distracteurs"])[0], ""
    if it["type"] == "B":
        if score == it["score_max"]:
            return "", ""
        codes = it["cle"].get("codes_erreur") or []
        return "", (codes[0] if codes else "")
    return "", ""


def cibles_effectives(spec: dict, cles: str, groupes: dict) -> dict:
    """Cibles d'un assemblage, sous l'une des deux formes admises par la commande.

    « cibles » fixe les points groupe par groupe — compétence, bloc et palier — et
    permet de commander un palier de profondeur. « cibles_par_competence » fixe une part
    par compétence et laisse le générateur la répartir sur ses groupes dans l'ordre de
    l'assemblage : c'est la forme employée quand seul le niveau importe. Les deux formes
    ne se mélangent pas sur un même assemblage.
    """
    exactes = spec.get("cibles", {}).get(cles)
    parts = spec.get("cibles_par_competence", {}).get(cles)
    if exactes and parts:
        raise SystemExit(f"{cles} : deux formes de cible pour le même assemblage")
    if exactes:
        return exactes
    if not parts:
        raise SystemExit(f"{cles} : aucune cible dans la spécification")

    par_comp: dict[str, list[str]] = {}
    for k in groupes:
        par_comp.setdefault(k.split("|")[0], []).append(k)
    inconnues = set(parts) - set(par_comp)
    if inconnues:
        raise SystemExit(f"{cles} : parts déclarées sur des compétences absentes de "
                         f"l'assemblage : {sorted(inconnues)}")
    manquantes = set(par_comp) - set(parts)
    if manquantes:
        raise SystemExit(f"{cles} : compétences sans part déclarée : {sorted(manquantes)}")

    out = {}
    for comp, cles_g in par_comp.items():
        total = sum(sum(m["score_max"] for m in groupes[k]) for k in cles_g)
        vise = round(parts[comp] * total)
        reste = vise
        for k in cles_g:
            maxi = sum(m["score_max"] for m in groupes[k])
            pris = min(reste, maxi)
            out[k] = [pris, maxi]
            reste -= pris
        if reste:
            raise SystemExit(f"{cles}/{comp} : {reste} point(s) non répartis")
    return out


def main(dossier: Path = None) -> int:
    dossier = dossier or MAQ
    spec = charger(dossier / "specification.json")
    qp = charger(dossier / "qp.json")
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    ref_comp = charger(RACINE / "referentiels" / "competences.json")
    date = qp["session_date"]
    ref = qp["candidate_ref"]
    if ref != spec["candidat"]["reference"]:
        raise SystemExit(f"référence candidat divergente : {ref} / {spec['candidat']['reference']}")

    saisie, grilles = [], []
    cibles_vues = set()

    for code, version in instruments_passes(qp, cat):
        cles = f"{code}/{version}"
        a_path = RACINE / "instruments" / code / "assemblages" / f"{version}.json"
        if not a_path.exists():                       # grille coach : pas d'assemblage
            g = spec["grilles_coach"].get(cles)
            if g is None:
                continue
            d = charger(RACINE / "instruments" / code / "definition.json")
            for c in d["criteres"]:
                if c["code"] not in g:
                    raise SystemExit(f"{cles} : critère {c['code']} absent de la spécification")
                grilles.append([ref, cles, code, "", g[c["code"]], "", c["code"],
                                CORRECTEUR, date])
            continue

        # Bloc 0 — une ligne par domaine renseigné (R1). L'identifiant est celui
        # qu'imprime la feuille de réponses ; la colonne score reste vide.
        auto = spec.get("auto_positionnement", {}).get(cles, {})
        fmt = ref_comp["conventions"]["identifiant_bloc_0"]["format"]
        for dom in charger(a_path)["bloc_0"]["domaines"]:
            valeur = auto.get(dom["competence"])
            if valeur is None:
                continue          # domaine non renseigné : aucune ligne, pas un zéro
            ident = (fmt.replace("<CODE_INSTRUMENT>", code)
                        .replace("<COMPETENCE>", dom["competence"]))
            saisie.append([ref, cles, ident, valeur, "", "", "", CORRECTEUR, date])
        inconnus = set(auto) - {d["competence"] for d in charger(a_path)["bloc_0"]["domaines"]}
        if inconnus:
            raise SystemExit(f"{cles} : auto-positionnement sur des domaines absents du "
                             f"bloc 0 : {sorted(inconnus)}")

        banque = {i["item_id"]: i for i in charger(
            RACINE / "instruments" / code / "banque.json")["items"]}
        assemblage = charger(a_path)

        # Regroupement (compétence, bloc, palier, nature), dans l'ordre de l'assemblage
        groupes: dict[str, list] = {}
        for bl in assemblage["blocs"]:
            for iid in bl["items"]:
                it = banque[iid]
                if it.get("grille"):
                    for cr in it["grille"]:
                        k = f"{cr['competence']}|{bl['bloc']}|{it['palier']}|critere"
                        groupes.setdefault(k, []).append(
                            {"item_id": iid, "critere": cr["code"], "score_max": 3})
                else:
                    k = f"{it['competence']}|{bl['bloc']}|{it['palier']}|item"
                    groupes.setdefault(k, []).append(
                        {"item_id": iid, "critere": None, "score_max": it["score_max"]})

        cibles = cibles_effectives(spec, cles, groupes)
        inconnues = set(cibles) - set(groupes)
        if inconnues:
            raise SystemExit(f"{cles} : cibles sans groupe correspondant : {sorted(inconnues)}")
        manquantes = set(groupes) - set(cibles)
        if manquantes:
            raise SystemExit(f"{cles} : groupes sans cible : {sorted(manquantes)}")

        for k, membres in groupes.items():
            obtenu, maximum = cibles[k]
            cibles_vues.add((cles, k))
            somme = sum(m["score_max"] for m in membres)
            if somme != maximum:
                raise SystemExit(f"{cles}/{k} : la spécification annonce {maximum} points, "
                                 f"l'assemblage en porte {somme}")
            if not 0 <= obtenu <= maximum:
                raise SystemExit(f"{cles}/{k} : {obtenu} hors de [0, {maximum}]")
            for m, s in zip(membres, repartir(obtenu, membres)):
                if m["critere"] is not None:
                    grilles.append([ref, cles, m["item_id"], "", s, "", m["critere"],
                                    CORRECTEUR, date])
                else:
                    rep, err = reponse_item(banque[m["item_id"]], s)
                    saisie.append([ref, cles, m["item_id"], rep, s, err, "",
                                   CORRECTEUR, date])

    # Les critères d'une même grille se répartissent séparément : recoller par item
    entete = [x["colonne"] for x in cat["conventions"]["format_saisie"]]

    # Le jeu produit est soumis au contrôle d'import avant d'être écrit : une ligne que la
    # plateforme refuserait n'a pas à devenir la fixture des tests du bilan.
    sys.path.insert(0, str(RACINE / "scripts"))
    import validate_instrument as VI
    banques = {c: {i["item_id"]: i for i in charger(
        RACINE / "instruments" / c / "banque.json")["items"]}
        for c, _ in instruments_passes(qp, cat)
        if (RACINE / "instruments" / c / "banque.json").exists()}
    lignes_dict = [dict(zip(entete, l)) for l in saisie + grilles]
    criteres_connus = {c: {x["code"] for x in charger(
        RACINE / "instruments" / c / "definition.json")["criteres"]}
        for c, _ in instruments_passes(qp, cat)
        if (RACINE / "instruments" / c / "definition.json").exists()}
    erreurs = VI.controler_lignes_saisie(lignes_dict, {"competences": ref_comp},
                                         banques, criteres_connus)
    if erreurs:
        raise SystemExit("saisie refusée par le contrôle d'import :\n  "
                         + "\n  ".join(erreurs[:10]))
    for chemin, lignes in ((dossier / "saisie.csv", saisie), (dossier / "grilles.csv", grilles)):
        with open(chemin, "w", encoding="utf-8", newline="\n") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(entete)
            w.writerows(lignes)
        print(f"  {chemin.relative_to(RACINE)} — {len(lignes)} lignes")
    return 0


if __name__ == "__main__":
    cible = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else MAQ
    sys.exit(main(cible))
