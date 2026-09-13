#!/usr/bin/env python3
"""Contrôles d'un instrument : banque + assemblage contre les référentiels.

Les quatorze contrôles du cahier des charges § 5, plus les trois catégories de
couverture et la distinction hors_version / non_evaluee.

Aucun seuil, aucune durée, aucun intitulé n'est codé ici : les règles de couverture
viennent de competences.json (conventions.regles_couverture), la durée cible et les
ratios de fenêtre de catalogue_instruments.json, les codes d'erreur et les termes
bloquants de leurs référentiels. Ce module échoue si le référentiel lui-même échoue.

  usage : validate_instrument.py <dossier instrument> [version…]
          validate_instrument.py --tous
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_referentiel as VR
import textes_sources as TS

RACINE = Path(__file__).resolve().parent.parent
FICHIERS_REFERENTIEL = {
    "competences": "competences.json",
    "codes_erreur": "codes_erreur.json",
    "termes_bloquants": "termes_bloquants.json",
    "catalogue": "catalogue_instruments.json",
    "variables_qp": "variables_qp.json",
    "dimensions_met": "dimensions_met.json",
    "programmes_examen": "programmes_examen.json",
    "capacites_mathematiques": "capacites_mathematiques.json",
}


# ────────────────────────────────────────────────────────────── chargement

LISTES_FUSIONNEES = {"perimetres", "codes", "instruments", "expressions",
                     "ecarts_cahier", "ecarts_prompt"}
DICTS_FUSIONNES = {"matieres"}


def charger_referentiels(local: Path | None) -> dict:
    """Référentiels réels, auxquels le dossier local AJOUTE ses entrées.

    Un instrument ne redéfinit jamais les référentiels : il les complète. Les
    conventions et les règles restent celles de production, ce qui garantit qu'une
    fixture est soumise aux mêmes contrôles qu'un instrument réel.
    """
    out = {}
    for cle, nom in FICHIERS_REFERENTIEL.items():
        base = VR.charger(RACINE / "referentiels" / nom)
        ajout = VR.charger(local / nom) if local and (local / nom).exists() else None
        if ajout:
            for k, v in ajout.items():
                if k in LISTES_FUSIONNEES and isinstance(v, list):
                    base[k] = base.get(k, []) + v
                elif k in DICTS_FUSIONNES and isinstance(v, dict):
                    base.setdefault(k, {}).update(v)
        out[cle] = base
    return out


def charger_instrument(dossier: Path, version: str) -> tuple[dict, dict]:
    banque = VR.charger(dossier / "banque.json")
    assemblage = VR.charger(dossier / "assemblages" / f"{version}.json")
    return banque, assemblage


# ─────────────────────────────────────────────────────────────── contrôles

def bloc_de_version(item: dict, version: str) -> str | None:
    """Bloc de l'item pour cette version.

    Le § 7.6 place une même compétence à des blocs différents selon la version — FONC au
    bloc B en N1 et au bloc A en NT. Le champ accepte donc une chaîne, quand le bloc est le
    même partout, ou un objet indexé par version (EP-03).
    """
    b = item.get("bloc")
    return b.get(version) if isinstance(b, dict) else b


def controler(banque: dict, assemblage: dict, refs: dict) -> list[str]:
    err: list[str] = []
    ref = refs["competences"]
    conv = ref["conventions"]
    regles = conv["regles_couverture"]
    code_instr = assemblage["instrument"]
    version = assemblage["version"]
    ou = f"{code_instr}/{version}"

    # Le catalogue est la source de la durée cible et des blocs attendus
    entrees = [i for i in refs["catalogue"]["instruments"]
               if i["code"] == code_instr and i["version"] == version]
    if not entrees:
        return [f"{ou} : aucun enregistrement au catalogue — la durée cible est introuvable"]
    cat = entrees[0]

    perimetres = {p["code"]: p for p in ref["perimetres"]}
    perimetre = perimetres.get(cat["perimetre"])
    if perimetre is None:
        return [f"{ou} : périmètre « {cat['perimetre']} » absent du référentiel"]
    comps = {c["code"]: c for c in perimetre["competences"]}

    par_id = {i["item_id"]: i for i in banque["items"]}
    ordre = [i for b in assemblage["blocs"] for i in b["items"]]
    blocs_de = {i: b["bloc"] for b in assemblage["blocs"] for i in b["items"]}

    # ── 1 · unicité et format des identifiants
    vus: set[str] = set()
    for i in banque["items"]:
        if i["item_id"] in vus:
            err.append(f"{i['item_id']} : identifiant dupliqué dans la banque")
        vus.add(i["item_id"])
    motif = re.compile(
        rf"^{re.escape(perimetre['prefixe_item'])}-"
        rf"(?:{'|'.join(re.escape(n) for n in perimetre['niveaux_item'])})-"
        r"[A-Z]{3,5}-\d{2}$")
    for iid in ordre:
        if iid not in par_id:
            err.append(f"{ou} : l'assemblage référence l'item inconnu « {iid} »")
            continue
        if not motif.match(iid):
            err.append(f"{iid} : hors format PREFIXE-NIVEAU-COMPETENCE-NN pour ce périmètre")
    if len(ordre) != len(set(ordre)):
        err.append(f"{ou} : un item figure deux fois dans l'assemblage")

    items = [par_id[i] for i in ordre if i in par_id]

    for it in items:
        iid = it["item_id"]

        # ── 2 · la compétence existe pour cette matière
        c = comps.get(it["competence"])
        if c is None:
            err.append(f"{iid} : compétence « {it['competence']} » absente du référentiel de {perimetre['code']}")
            continue

        # ── 2 bis · la compétence appartient bien à cette version
        etat = c["etat_par_version"].get(version)
        if etat != "evaluee":
            err.append(f"{iid} : compétence « {c['code']} » {etat} en version {version} — "
                       f"une compétence hors version n'est jamais assemblée")
        if c["type"] == "indicateur_transversal":
            err.append(f"{iid} : « {c['code']} » est un indicateur transversal, il ne porte pas d'items")

        # cohérence du segment niveau de l'identifiant avec le niveau déclaré
        if iid.split("-")[1] != it["niveau"]:
            err.append(f"{iid} : le niveau de l'identifiant ne correspond pas au champ niveau « {it['niveau']} »")
        if it["palier"] not in conv["paliers"]:
            err.append(f"{iid} : palier inconnu « {it['palier']} »")
        declare = bloc_de_version(it, version)
        if declare is None:
            err.append(f"{iid} : aucun bloc déclaré pour la version {version}")
        elif blocs_de[iid] != declare:
            err.append(f"{iid} : placé au bloc {blocs_de[iid]} de l'assemblage mais déclaré au "
                       f"bloc {declare} pour la version {version}")
        if declare is not None and declare not in cat["blocs_attendus"]:
            err.append(f"{iid} : bloc « {declare} » hors des blocs attendus du catalogue "
                       f"{cat['blocs_attendus']}")
        if not isinstance(it.get("duree_min"), (int, float)) or it["duree_min"] <= 0:
            err.append(f"{iid} : duree_min absente ou nulle")
        # Toute expression mathématique passe par la notation LaTeX de pandoc, entre $…$ :
        # les caractères Unicode d'indice et d'exposant ne couvrent ni les fractions, ni les
        # racines, ni les limites, et la police du rendu ne les porte pas toutes (R2).
        for ou_txt, txt in textes_rendus(it):
            err += controler_notation(f"{iid} ({ou_txt})", txt)
            err += controler_echappement(f"{iid} ({ou_txt})", txt)
        # Les notes de conception et les descripteurs de grille ne sont pas lus par le
        # candidat, mais le corrigé les imprime : le défaut d'échappement y produit le
        # même mot en toutes lettres.
        err += controler_echappement(f"{iid} (notes de conception)",
                                     it.get("notes_conception", ""))
        for cr in it.get("grille") or []:
            for niv, texte in (cr.get("descripteurs") or {}).items():
                err += controler_echappement(
                    f"{iid}/{cr.get('code')} (descripteur {niv})", texte)
        for sup in it.get("supports", []):
            err += controler_donnees(sup, f"{iid} (support)", par_id)
            if isinstance(sup, dict) and sup.get("simulee") and \
                    "simul" not in VR.normaliser(it.get("notes_conception", "")):
                err.append(f"{iid} : données simulées sans justification des ordres de grandeur "
                           f"dans notes_conception")
        if not it.get("notes_conception"):
            err.append(f"{iid} : notes_conception absentes — un item que l'on ne peut pas justifier n'entre pas dans la banque")

        # ── 5 · cohérence type / score, et 6, 7, 8 · contenu de la clé
        t = it["type"]
        if t == "A":
            if it["score_max"] != 1:
                err.append(f"{iid} : type A, score_max doit valoir 1")
            cle = it.get("cle") or {}
            rep, dis = cle.get("reponse"), cle.get("distracteurs") or {}
            if not rep:
                err.append(f"{iid} : type A sans réponse exacte")
            elif rep in dis:
                err.append(f"{iid} : type A, la bonne réponse « {rep} » figure aussi en distracteur")
            if not dis:
                err.append(f"{iid} : type A sans distracteur")
            prop = it.get("propositions") or {}
            if not prop:
                err.append(f"{iid} : type A sans propositions — le candidat n'aurait rien à choisir")
            elif set(prop) != set(dis) | {rep}:
                err.append(f"{iid} : les propositions {sorted(prop)} ne correspondent pas à la "
                           f"réponse et aux distracteurs {sorted(set(dis) | {rep})}")
            for k, v in prop.items():
                if not (v or "").strip():
                    err.append(f"{iid} : proposition « {k} » sans texte")
            for k, v in dis.items():
                if not v:
                    err.append(f"{iid} : distracteur « {k} » sans explication — un distracteur nomme une erreur réelle")
            if it.get("grille") is not None:
                err.append(f"{iid} : type A, grille doit être nulle")

        elif t == "B":
            if it["score_max"] != 2:
                err.append(f"{iid} : type B, score_max doit valoir 2")
            cle = it.get("cle") or {}
            if not cle.get("reponse_2pts"):
                err.append(f"{iid} : type B sans reponse_2pts")
            if not cle.get("codes_erreur"):
                err.append(f"{iid} : type B sans code d'erreur — la liste fermée est obligatoire")
            if not isinstance(cle.get("reponses_1pt"), list):
                err.append(f"{iid} : type B, reponses_1pt doit être une liste, même vide")
            if it.get("grille") is not None:
                err.append(f"{iid} : type B, grille doit être nulle")

        elif t == "C":
            g = it.get("grille") or []
            n = len(g)
            if not 3 <= n <= 5:
                err.append(f"{iid} : type C, {n} critère(s) — il en faut de 3 à 5")
            if it["score_max"] != 3 * n:
                err.append(f"{iid} : type C, score_max {it['score_max']} au lieu de {3 * n} (3 points × {n} critères)")
            if it.get("cle") is not None:
                err.append(f"{iid} : type C, cle doit être nulle — le total se calcule depuis les critères")
            proprietaires = []
            for cr in g:
                prop = cr.get("competence")
                if not prop:
                    err.append(f"{iid}/{cr.get('code')} : critère sans compétence propriétaire — "
                               f"ses points ne seraient imputés à personne")
                elif prop not in comps:
                    err.append(f"{iid}/{cr.get('code')} : propriétaire « {prop} » absent du référentiel")
                elif comps[prop]["etat_par_version"].get(version) != "evaluee":
                    err.append(f"{iid}/{cr.get('code')} : propriétaire « {prop} » non évalué en "
                               f"version {version}")
                else:
                    proprietaires.append(prop)
            if len(proprietaires) == len(g) and 3 * len(proprietaires) != it["score_max"]:
                err.append(f"{iid} : {3 * len(proprietaires)} points répartis entre propriétaires "
                           f"pour un score maximal de {it['score_max']} — aucun point ne doit se "
                           f"perdre ni être compté deux fois")
            for cr in g:
                d = cr.get("descripteurs") or {}
                if set(d) != {"0", "1", "2", "3"}:
                    err.append(f"{iid}/{cr.get('code')} : les quatre niveaux 0 à 3 sont obligatoires")
                for niv, texte in d.items():
                    if not (texte or "").strip():
                        err.append(f"{iid}/{cr.get('code')} : descripteur de niveau {niv} vide")
        else:
            err.append(f"{iid} : type « {t} » inconnu")

        # ── 3 · les codes d'erreur référencés existent et concernent la compétence
        connus = {x["code"]: x for x in refs["codes_erreur"]["codes"]}
        for code in (it.get("cle") or {}).get("codes_erreur", []) or []:
            x = connus.get(code)
            if x is None:
                err.append(f"{iid} : code d'erreur « {code} » absent du catalogue")
            elif f"{perimetre['code']}/{it['competence']}" not in x["competences_concernees"]:
                err.append(f"{iid} : code « {code} » ne concerne pas {perimetre['code']}/{it['competence']}")

    # ── 4 · couverture, par catégorie de compétence
    err += controler_couverture(items, comps, version, regles, refs)

    # ── 4 bis · configuration française : compatibilité de l'épreuve (Q-21, EC-26)
    entrees = [i for i in refs["catalogue"]["instruments"]
               if i["code"] == assemblage["instrument"] and i["version"] == version]
    if entrees:
        err += controler_configuration_francais(items, comps, version, entrees[0], refs)

    # ── 9 · bloc 0 présent, domaines inclus dans les compétences de l'assemblage
    b0 = assemblage.get("bloc_0")
    if not b0 or not b0.get("domaines"):
        err.append(f"{ou} : bloc 0 absent")
    else:
        n = len(b0["domaines"])
        if not 3 <= n <= 5:
            err.append(f"{ou} : bloc 0 à {n} domaine(s) — il en faut de 3 à 5")
        evaluees = {it["competence"] for it in items}
        for d in b0["domaines"]:
            if d["competence"] not in evaluees:
                err.append(f"{ou} : domaine de bloc 0 « {d['competence']} » hors des compétences évaluées")
            c = comps.get(d["competence"])
            if c and d.get("intitule") != c["intitule"]:
                err.append(f"{ou} : domaine « {d['competence']} » — l'intitulé doit être celui du "
                           f"référentiel, sans quoi l'écart perçu/mesuré n'a pas de sens")

    # ── 10 · durée totale dans la fenêtre calculée depuis le catalogue
    f = refs["catalogue"]["conventions"]["fenetre_duree"]
    total = sum(it["duree_min"] for it in items) + (b0 or {}).get("duree_min", 0)
    lo = f["ratio_min"] * cat["duree_cible_min"]
    hi = f["ratio_max"] * cat["duree_cible_min"]
    if not lo <= total <= hi:
        err.append(f"{ou} : durée totale {total} min hors de la fenêtre {lo:g}–{hi:g} min "
                   f"(cible {cat['duree_cible_min']} min)")

    # ── 11 · aucun terme bloquant dans les textes destinés à être lus
    tb = refs["termes_bloquants"]
    pc = perimetre["code"]
    for it in items:
        err += VR.chercher_termes(it.get("enonce", ""), "enonce_candidat", tb, f"{it['item_id']} (énoncé)", pc)
        for cr in it.get("grille") or []:
            for niv, texte in (cr.get("descripteurs") or {}).items():
                err += VR.chercher_termes(texte, "descripteur_grille", tb,
                                          f"{it['item_id']}/{cr.get('code')} (descripteur {niv})", pc)
    err += controler_capacites_officielles(items, refs, ou, assemblage)
    err += controler_sans_calculatrice(items, refs, ou, assemblage)
    err += controler_competences_transversales(items, refs, ou, assemblage)
    session_finale = assemblage.get("session_baccalaureat_finale")
    err += controler_oeuvres_citees(items, refs, ou, session_finale)
    err += controler_items_sessionnes(items, ou, session_finale)
    for b in assemblage["blocs"]:
        for sup in b.get("supports", []):
            err += controler_donnees(sup, f"{ou} (support bloc {b['bloc']})", par_id)
            err += controler_oeuvre_au_programme(
                sup, refs, f"{ou} (support bloc {b['bloc']})", session_finale)
            if sup.get("type") in ("tableau", "figure"):
                continue
            for champ in ("titre", "texte", "reference"):
                if not (sup.get(champ) or "").strip():
                    err.append(f"{ou} : support du bloc {b['bloc']} sans « {champ} »")
            err += VR.chercher_termes(sup.get("texte", ""), "enonce_candidat", tb,
                                      f"{ou} (support bloc {b['bloc']})", pc)
            if MOTIF_RESERVE.search(VR.normaliser(sup.get("texte", ""))):
                cle = VR.normaliser(f"{code_instr}/{version} bloc {b['bloc']}")
                etat = RACINE / "README_ETAT.md"
                if cle not in VR.normaliser(etat.read_text(encoding="utf-8") if etat.exists() else ""):
                    err.append(f"{ou} : emplacement réservé du support de bloc {b['bloc']} non "
                               f"listé dans README_ETAT.md — la ligne doit contenir « {code_instr}"
                               f"/{version} bloc {b['bloc']} »")
    for cons in assemblage.get("consignes_passation", []):
        err += VR.chercher_termes(cons, "enonce_candidat", tb, f"{ou} (consigne)", pc)
        # Une durée recopiée dans une consigne se désynchronise du catalogue au premier ajustement
        if re.search(r"\b\d+\s*(min|minutes|h|heures)\b", cons):
            err.append(f"{ou} : une consigne de passation code une durée en clair — "
                       f"la durée est lue dans le catalogue, jamais recopiée")
        # Le matériel autorisé est porté par le catalogue : le répéter le désynchronise
        materiel = refs["catalogue"]["conventions"]["materiel"][cat["materiel"]]
        mots = {m for m in VR.normaliser(materiel).split() if len(m) > 6}
        if mots and len(mots & set(VR.normaliser(cons).split())) >= 3:
            err.append(f"{ou} : une consigne de passation reprend le matériel autorisé, que le "
                       f"catalogue porte déjà — « {cons[:60]}… »")
    if b0:
        err += VR.chercher_termes(b0.get("consigne", ""), "enonce_candidat", tb, f"{ou} (bloc 0)", pc)

    # ── 15 · tâches sur machine : un fichier de tests conforme au barème du référentiel
    bar = conv.get("bareme_tests_machine")
    if bar and cat["support"] == "papier_et_machine":
        dossier = RACINE / "instruments" / code_instr / "tests"
        for it in items:
            if it["type"] != "C":
                continue
            f = dossier / f"test_{it['item_id']}.py"
            if not f.exists():
                err.append(f"{it['item_id']} : tâche sur machine sans fichier de tests "
                           f"({f.relative_to(RACINE)})")
                continue
            texte = f.read_text(encoding="utf-8")
            cas = len(re.findall(r"^def test_", texte, re.M))
            limites = len(re.findall(r"@pytest\.mark\.limite", texte))
            if cas < bar["cas_min"]:
                err.append(f"{it['item_id']} : {cas} cas de test, minimum {bar['cas_min']}")
            if limites < bar["cas_limites_min"]:
                err.append(f"{it['item_id']} : {limites} cas limite(s), minimum "
                           f"{bar['cas_limites_min']} — un jeu de tests sans cas limite ne mesure rien")
            codes_criteres = {cr.get("code") for cr in (it.get("grille") or [])}
            if "TESTS" not in codes_criteres:
                err.append(f"{it['item_id']} : tâche sur machine sans critère « TESTS » — "
                           f"le score calculé n'aurait pas de destination")

    # ── 14 · emplacements réservés tous listés dans README_ETAT.md
    err += controler_emplacements(items, ou)

    return err


def controler_configuration_francais(items, comps, version, cat_entree, refs) -> list[str]:
    """Q-21 — un assemblage de français ne retient que des compétences compatibles.

    Chaque compétence de FR-EAF porte un champ « epreuve » : ecrit, oral ou les_deux.
    Chaque assemblage porte une configuration. Le masquage se fait ici, à l'assemblage, et
    non à l'exécution : un candidat qui ne repasse que l'oral ne doit pas composer sur la
    rédaction, et l'assemblage doit le garantir avant impression.
    """
    config = cat_entree.get("configuration_francais")
    if not config or isinstance(config, list):
        return []
    conv = refs["catalogue"]["conventions"].get("configuration_francais")
    if conv is None:
        return [f"configuration « {config} » déclarée, mais le catalogue ne porte pas la "
                f"convention configuration_francais"]
    table = conv.get("epreuves_admises") or {}
    if config not in table:
        return [f"configuration « {config} » absente de la table epreuves_admises "
                f"du catalogue"]
    admis = set(table[config])
    err = []
    for it in items:
        c = comps.get(it["competence"])
        e = (c or {}).get("epreuve")
        if e is None:
            err.append(f"{it['item_id']} : compétence {it['competence']} sans champ "
                       f"« epreuve », exigé dans un instrument de français")
        elif e not in admis:
            err.append(f"{it['item_id']} : compétence {it['competence']} d'épreuve « {e} » "
                       f"dans un assemblage de configuration « {config} »")
    for code, c in comps.items():
        if c["etat_par_version"].get(version) == "evaluee" \
                and c.get("epreuve") not in admis:
            err.append(f"{code} : déclarée évaluée en version {version} alors que son "
                       f"épreuve « {c.get('epreuve')} » est hors de la configuration "
                       f"« {config} »")
    return err


def motif_identifiant_bloc_0(conv: dict) -> re.Pattern:
    """Expression du format d'identifiant de domaine, construite depuis le référentiel."""
    f = conv["identifiant_bloc_0"]["format"]
    motif = (re.escape(f)
             .replace(re.escape("<CODE_INSTRUMENT>"), r"[A-Z][A-Z0-9\-]*")
             .replace(re.escape("<COMPETENCE>"), r"[A-Z]{3,5}(?:-[A-Z]{3,5})?"))
    return re.compile(f"^{motif}$")


def controler_lignes_saisie(lignes, refs, banques, grilles=None) -> list[str]:
    """§ 6.2 étendu — trois formes de ligne de saisie, et trois seulement.

    Une ligne d'item porte un identifiant de la banque. Une ligne de grille coach porte le
    code de l'instrument et le code d'un critère de sa grille. Une ligne de bloc 0 porte
    l'identifiant du domaine tel qu'imprimé, une valeur de l'échelle d'auto-positionnement
    dans « response », et rien dans « score » : le bloc 0 ne compte pas dans les résultats.
    Un score porté dessus est refusé, et un identifiant d'aucune de ces trois formes aussi.
    """
    grilles = grilles or {}
    conv = refs["competences"]["conventions"]
    echelle = conv["echelle_bloc_0"]
    motif = motif_identifiant_bloc_0(conv)
    valeurs_admises = {str(i + 1) for i in range(len(echelle))}
    err = []

    def txt(v):
        """Une valeur de CSV lue depuis un fichier est une chaîne ; construite en mémoire,
        elle peut être un entier. Le contrôle doit valoir dans les deux cas."""
        return "" if v is None else str(v).strip()

    for n, l in enumerate(lignes, 2):
        iid = txt(l.get("item_id"))
        instrument = txt(l.get("instrument")).split()[0] if l.get("instrument") else ""
        code = instrument.split("/")[0]
        banque = banques.get(code, {})
        ou = f"ligne {n} ({iid or 'sans item_id'})"
        if iid in banque:
            continue
        if code in grilles and iid == code:
            critere = txt(l.get("criterion"))
            if critere not in grilles[code]:
                err.append(f"{ou} : critère « {critere or 'absent'} » hors de la grille "
                           f"{code}")
            continue
        if not motif.match(iid):
            err.append(f"{ou} : identifiant inconnu de la banque {code} et hors du format "
                       f"d'un domaine de bloc 0")
            continue
        if not iid.startswith(code + "-0-"):
            err.append(f"{ou} : domaine de bloc 0 rattaché à l'instrument {code}")
        if txt(l.get("score")):
            err.append(f"{ou} : un score est porté sur un domaine de bloc 0, qui ne compte "
                       f"pas dans les résultats")
        rep = txt(l.get("response"))
        if rep and rep not in valeurs_admises:
            err.append(f"{ou} : réponse « {rep} » hors de l'échelle du bloc 0 "
                       f"(1 à {len(echelle)})")
        if txt(l.get("criterion")):
            err.append(f"{ou} : un critère est porté sur un domaine de bloc 0")
    return err


def criteres_de_grille_externe(grille: str, competence: str, refs) -> int | None:
    """Nombre de critères qu'une grille coach attribue en propre à une compétence.

    Renvoie None si la grille est introuvable : le champ evaluee_par désignerait alors un
    instrument qui n'existe pas, ce qui doit être signalé et non silencieusement toléré.
    """
    f = RACINE / "instruments" / grille / "definition.json"
    if not f.exists():
        return None
    with open(f, encoding="utf-8") as fh:
        d = json.load(fh)
    return sum(1 for cr in d.get("criteres", []) if cr.get("competence") == competence)


def controler_couverture(items, comps, version, regles, refs) -> list[str]:
    """Règles de couverture, distinctes selon la catégorie de la compétence."""
    err: list[str] = []
    par_comp: dict[str, list] = {}
    for it in items:
        par_comp.setdefault(it["competence"], []).append(it)

    # Points effectivement attribués, par compétence puis par palier. Un item de type A ou B
    # verse ses points à sa compétence ; un item de type C les verse critère par critère, à la
    # compétence propriétaire de chaque critère (EC-08).
    points: dict[str, dict[str, int]] = {}

    def verser(comp: str, palier: str, n: int) -> None:
        points.setdefault(comp, {}).setdefault(palier, 0)
        points[comp][palier] += n

    for it in items:
        if it["type"] == "C":
            for cr in it.get("grille") or []:
                if cr.get("competence"):
                    verser(cr["competence"], it["palier"], 3)
        else:
            verser(it["competence"], it["palier"], it["score_max"])

    for code, c in comps.items():
        if c["etat_par_version"].get(version) != "evaluee":
            continue  # hors version : absente, et non « non évaluée »
        lot = par_comp.get(code, [])

        # EC-25 — une compétence dont evaluee_par nomme une grille coach est couverte par
        # les critères que cette grille lui attribue en propre, quelle que soit sa
        # catégorie : les règles d'items supposent un instrument porteur d'items. Un
        # indicateur transversal garde sa règle propre, traitée juste après.
        grille = c.get("grille_externe")
        if grille and grille != "criteres_C" and c["type"] != "indicateur_transversal":
            r = regles.get("evaluee_par_grille_externe")
            if r is None:
                err.append(f"{code} : mesurée par la grille {grille}, mais le référentiel "
                           f"ne porte pas de règle « evaluee_par_grille_externe »")
                continue
            criteres = criteres_de_grille_externe(grille, code, refs)
            if criteres is None:
                err.append(f"{code} : la grille externe déclarée « {grille} » est "
                           f"introuvable ou ne déclare pas ce périmètre")
            elif criteres < r["criteres_proprietaires_min"]:
                err.append(f"{code} : {criteres} critère(s) propriétaire(s) dans la grille "
                           f"{grille}, minimum {r['criteres_proprietaires_min']}")
            if lot:
                err.append(f"{code} : mesurée par la grille {grille}, elle ne devrait porter "
                           f"aucun item ; {len(lot)} trouvé(s)")
            continue

        if c["type"] == "indicateur_transversal":
            r = regles["indicateur_transversal"]
            eq = r["equivalences"]
            sources = 0
            if c.get("evaluee_par") == "criteres_C":
                sources = eq["critere_grille_C"] * sum(
                    1 for it in items for cr in (it.get("grille") or [])
                    if cr.get("competence") == code or cr.get("code") == c.get("code_critere"))
            elif c.get("evaluee_par"):
                sources = eq["grille_externe_declaree"]
            if sources < r["sources_min"]:
                err.append(f"{code} : indicateur transversal à {sources} source(s), "
                           f"minimum {r['sources_min']} — il sortirait « Non évalué »")
            continue

        if c["type"] == "production":
            r = regles["production"]
            # Un item C peut servir deux compétences de production : sa grille est alors
            # partagée, chacune en possédant ses propres critères. La tâche est donc cherchée
            # parmi tous les items C de l'assemblage, non parmi ceux que la compétence déclare.
            cs = [it for it in items if it["type"] == "C"
                  and sum(1 for cr in (it.get("grille") or [])
                          if cr.get("competence") == code) >= r["criteres_min_proprietaire"]]
            autres = [it for it in lot if it["type"] in r["types_autre_palier"]
                      and bloc_de_version(it, version) == r["bloc_autre_palier"]]
            if not cs:
                possede = [(it["item_id"], sum(1 for cr in (it.get("grille") or [])
                                               if cr.get("competence") == code))
                           for it in items if it["type"] == "C"]
                detail = ", ".join(f"{i} : {n}" for i, n in possede) or "aucun item C"
                err.append(f"{code} : aucun item de type C dont elle possède au moins "
                           f"{r['criteres_min_proprietaire']} critères ({detail})")
                continue
            if not autres:
                err.append(f"{code} : compétence de production sans item {'/'.join(r['types_autre_palier'])} "
                           f"en bloc {r['bloc_autre_palier']}")
            elif {it["palier"] for it in autres} <= {it["palier"] for it in cs}:
                err.append(f"{code} : l'item de bloc {r['bloc_autre_palier']} doit porter un palier "
                           f"différent de celui de la tâche")
            continue

        r = regles["competence_ordinaire"]
        # Une compétence peut être servie par des items et par des critères de grille dont
        # elle est propriétaire : les deux comptent pour la couverture.
        sources_c = sum(1 for it in items for cr in (it.get("grille") or [])
                        if cr.get("competence") == code)
        if len(lot) + sources_c < r["items_min"]:
            err.append(f"{code} : {len(lot)} item(s) et {sources_c} critère(s), minimum "
                       f"{r['items_min']} — la compétence sortirait « Non évaluée »")
        paliers = dict(points.get(code, {}))
        if len(paliers) < r["paliers_min"]:
            err.append(f"{code} : {len(paliers)} palier(s), minimum {r['paliers_min']}")
        for pal, pts in sorted(paliers.items()):
            if pts < r["points_min_par_palier"]:
                err.append(f"{code}/{pal} : {pts} point(s), minimum {r['points_min_par_palier']} — "
                           f"le palier de profondeur ne serait pas calculable")
    return err


CAR_MATH = set("₀₁₂₃₄₅₆₇₈₉ₙ₊⁰¹²³⁴⁵⁶⁷⁸⁹√π≤≥≠∩ℝ′")


def textes_rendus(item: dict):
    """(nom du champ, texte) de tout ce qui est imprimé pour le candidat ou le correcteur."""
    yield "énoncé", item.get("enonce", "")
    for k, v in (item.get("propositions") or {}).items():
        yield f"proposition {k}", v
    cle = item.get("cle") or {}
    if cle.get("reponse_2pts"):
        yield "réponse à 2 points", cle["reponse_2pts"]
    for i, r in enumerate(cle.get("reponses_1pt") or [], 1):
        yield f"réponse à 1 point n° {i}", r
    for k, v in (cle.get("distracteurs") or {}).items():
        yield f"explication du distracteur {k}", v


#: Ce qu'une commande LaTeX doit être après décodage JSON : une seule barre oblique
#: inverse. Deux barres font imprimer le mot — « times » à la place de « × », « mathbb »
#: à la place de « ℝ ». Le défaut est invisible dans le fichier source, où toute barre
#: s'écrit déjà doublée, et invisible au Markdown, qui n'interprète pas les commandes :
#: il ne se voit qu'au PDF. D'où ce contrôle, qui lit la chaîne **décodée**.
DOUBLE_ECHAPPEMENT = re.compile(r"\\\\[a-zA-Z]+")


def controler_echappement(ou: str, texte: str) -> list[str]:
    """Aucune commande LaTeX ne doit rester doublement échappée après lecture du JSON."""
    fautes = sorted({m.group(0) for m in DOUBLE_ECHAPPEMENT.finditer(texte or "")})
    if fautes:
        return [f"{ou} : commande LaTeX doublement échappée — {' '.join(fautes)} — elle "
                f"s'imprimerait en toutes lettres dans le PDF"]
    return []


def controler_notation(ou: str, texte: str) -> list[str]:
    # Le code, en bloc ou en ligne, est exclu : un nom de fichier comme
    # « test_NSI-1-PROG-01.py » n'est pas de la notation mathématique.
    hors = re.sub(r"```.*?```", "", texte or "", flags=re.S)
    hors = re.sub(r"`[^`]*`", "", hors)
    if hors.count("$") % 2:
        return [f"{ou} : délimiteurs mathématiques déséquilibrés — « {hors[:60]}… »"]
    hors = re.sub(r"\$[^$]*\$", "", hors)
    fautes = sorted({c for c in hors if c in CAR_MATH})
    fautes += sorted({m.group(0) for m in re.finditer(r"[A-Za-z]\s*[_^]\s*[A-Za-z0-9{]", hors)})
    if fautes:
        return [f"{ou} : notation mathématique hors $…$ — {' '.join(fautes)}"]
    return []


#: Genres de graphique admis, portés par « type_graphe ». Le champ « type » d'un support
#: dit sa nature — « tableau », « figure » ou un texte — et non le genre du graphique.
#: Les confondre revenait à ne contrôler aucune figure : aucune n'a jamais eu pour « type »
#: « courbe », « barres » ou « nuage », et le contrôle sortait donc sans rien vérifier.
TYPES_FIGURE = {"courbe", "barres", "nuage", "boite", "cercle_trigo"}


def controler_donnees(d, ou: str, par_id: dict) -> list[str]:
    """Tout tableau et toute figure porte une source publique ou se déclare simulé.

    Aucune donnée n'est présentée comme réelle sans source, et une donnée simulée doit être
    justifiée dans les notes de conception de l'item qui la porte.
    """
    if not isinstance(d, dict) or d.get("type") not in {"tableau", "figure"}:
        return []
    err = []
    if d["type"] == "figure" and d.get("type_graphe") not in TYPES_FIGURE:
        err.append(f"{ou} : figure de genre « {d.get('type_graphe')} » — genres admis : "
                   f"{', '.join(sorted(TYPES_FIGURE))}")
    if not d.get("titre"):
        err.append(f"{ou} : support de données sans titre")
    if not d.get("code"):
        err.append(f"{ou} : support de données sans code")
    if d.get("simulee") or d.get("construite"):
        if d.get("source"):
            err.append(f"{ou} : données déclarées simulées ou construites mais assorties "
                       f"d'une source")
        if d.get("simulee") and d.get("construite"):
            err.append(f"{ou} : une figure est construite ou simulée, pas les deux")
    elif not d.get("source"):
        err.append(f"{ou} : données sans source citée — aucune donnée n'est présentée comme "
                   f"réelle sans provenance, sinon la déclarer « simulee »")
    if d["type"] == "tableau":
        if not d.get("colonnes") or not d.get("lignes"):
            err.append(f"{ou} : tableau sans colonnes ou sans lignes")
        for i, ligne in enumerate(d.get("lignes") or []):
            if len(ligne) != len(d.get("colonnes") or []):
                err.append(f"{ou} : ligne {i + 1} de longueur différente de l'en-tête")
    else:
        for champ in ("axe_x", "axe_y", "series"):
            if not d.get(champ):
                err.append(f"{ou} : figure sans « {champ} »")
        # Un diagramme en boite ne porte pas une valeur par abscisse mais les cinq nombres
        # du résumé : minimum, premier quartile, médiane, troisième quartile, maximum.
        if d.get("type_graphe") == "boite":
            for s in d.get("series") or []:
                v = s.get("valeurs") or []
                if len(v) != 5:
                    err.append(f"{ou} : le diagramme en boite « {s.get('label')} » ne porte "
                               f"pas cinq valeurs (minimum, Q1, médiane, Q3, maximum)")
                elif list(v) != sorted(v):
                    err.append(f"{ou} : le résumé du diagramme en boite « {s.get('label')} » "
                               f"n'est pas croissant")
        else:
            n = len((d.get("axe_x") or {}).get("valeurs") or [])
            for s in d.get("series") or []:
                if len(s.get("valeurs") or []) != n:
                    err.append(f"{ou} : série « {s.get('label')} » de longueur différente de l'axe des abscisses")
    return err


MOTIF_RESERVE = re.compile(r"\[extrait a inserer[^\]]*\]", re.I)


def controler_emplacements(items, ou: str) -> list[str]:
    """Tout emplacement réservé doit être listé dans README_ETAT.md."""
    etat = RACINE / "README_ETAT.md"
    texte = VR.normaliser(etat.read_text(encoding="utf-8")) if etat.exists() else ""
    err = []
    for it in items:
        for champ in ("enonce", *(s for s in it.get("supports", []))):
            valeur = it.get(champ, champ) if champ == "enonce" else champ
            if MOTIF_RESERVE.search(VR.normaliser(str(valeur))) and it["item_id"].lower() not in texte:
                err.append(f"{it['item_id']} : emplacement réservé non listé dans README_ETAT.md")
    return err


# ─────────────────────────────────────────────────────────── point d'entrée

def controler_grille_coach(d: dict, refs: dict) -> list[str]:
    """Contrôles d'une grille coach : mêmes règles de critère que les grilles de type C.

    Une grille coach n'a pas d'items : ses critères entrent dans le moteur comme ceux d'un
    item de type C, avec un propriétaire unique et des descripteurs aux quatre niveaux.
    """
    err: list[str] = []
    ref = refs["competences"]
    tb = refs["termes_bloquants"]
    ou = f"{d.get('instrument')}/{d.get('version')}"

    entrees = [i for i in refs["catalogue"]["instruments"]
               if i["code"] == d.get("instrument") and i["version"] == d.get("version")]
    if not entrees:
        return [f"{ou} : aucun enregistrement au catalogue"]
    cat = entrees[0]
    if cat["porte_items"]:
        err.append(f"{ou} : le catalogue le déclare porteur d'items, or c'est une grille coach")
    if cat.get("nb_criteres") is not None and cat["nb_criteres"] != len(d.get("criteres", [])):
        err.append(f"{ou} : {len(d.get('criteres', []))} critères, le catalogue en annonce "
                   f"{cat['nb_criteres']}")

    total = sum(p.get("duree_min", 0) for p in d.get("deroule", []))
    if total != cat["duree_cible_min"]:
        err.append(f"{ou} : déroulé de {total} min pour une durée catalogue de "
                   f"{cat['duree_cible_min']} min")
    if not d.get("deroule"):
        err.append(f"{ou} : aucun déroulé de passation")
    for p in d.get("deroule", []):
        for champ in ("phase", "duree_min", "consigne_prononcee"):
            if not p.get(champ):
                err.append(f"{ou} : phase « {p.get('phase', '?')} » sans « {champ} »")
        err += VR.chercher_termes(p.get("consigne_prononcee", ""), "enonce_candidat", tb,
                                  f"{ou} (consigne « {p.get('phase', '?')} »)")

    connues = {f"{p['code']}/{c['code']}": (p, c)
               for p in ref["perimetres"] for c in p["competences"]}
    alimentes = {f"{a['perimetre']}/{a['competence']}" for a in d.get("perimetres_alimentes", [])}
    if not alimentes:
        err.append(f"{ou} : aucune compétence alimentée déclarée — les scores n'iraient nulle part")
    for a in alimentes:
        if a not in connues:
            err.append(f"{ou} : compétence alimentée inconnue « {a} »")

    criteres = d.get("criteres", [])
    # La fenêtre vient du référentiel, non du script : une définition officielle d'épreuve
    # peut imposer d'observer davantage, et l'exception est alors déclarée et motivée.
    conv = refs["catalogue"]["conventions"].get("fenetre_criteres_grille",
                                                {"min": 3, "max": 5})
    cat_entree = next((i for i in refs["catalogue"]["instruments"]
                       if i["code"] == d["instrument"] and i["version"] == d["version"]),
                      {})
    attendu = cat_entree.get("nb_criteres")
    bas, haut = conv["min"], conv["max"]
    if attendu is not None and not bas <= attendu <= haut:
        if not cat_entree.get("motif_fenetre"):
            err.append(f"{ou} : {attendu} critères hors de la fenêtre {bas}-{haut} sans "
                       f"motif déclaré au catalogue")
        bas = haut = attendu
    if not bas <= len(criteres) <= haut:
        err.append(f"{ou} : {len(criteres)} critère(s) — il en faut de {bas} à {haut}")
    vus: set[str] = set()
    for cr in criteres:
        r = f"{ou}/{cr.get('code')}"
        if cr.get("code") in vus:
            err.append(f"{r} : code de critère dupliqué")
        vus.add(cr.get("code"))
        prop = cr.get("competence")
        if not prop:
            err.append(f"{r} : critère sans compétence propriétaire")
        elif not any(k.endswith("/" + prop) for k in alimentes):
            err.append(f"{r} : propriétaire « {prop} » absent des compétences alimentées "
                       f"{sorted(alimentes)}")
        desc = cr.get("descripteurs") or {}
        if set(desc) != {"0", "1", "2", "3"}:
            err.append(f"{r} : les quatre niveaux 0 à 3 sont obligatoires")
        for niv, texte in desc.items():
            if not (texte or "").strip():
                err.append(f"{r} : descripteur de niveau {niv} vide")
            err += VR.chercher_termes(texte, "descripteur_grille", tb, f"{r} (niveau {niv})")
    return err


def valider_grille_coach(dossier: Path) -> tuple[list[str], list[str]]:
    local = dossier / "referentiels"
    refs = charger_referentiels(local if local.exists() else None)
    fichiers = sorted(dossier.glob("definition*.json"))
    if not fichiers:
        fichiers = [dossier / "definition.json"]
    err: list[str] = []
    resume: list[str] = []
    for f in fichiers:
        d = VR.charger(f)
        err += controler_grille_coach(d, refs)
        n = len(d.get("criteres", []))
        resume.append(f"  {d['instrument']}/{d['version']} : {n} critères, {3 * n} points, "
                      f"{sum(p.get('duree_min', 0) for p in d.get('deroule', []))} min")
    return err, resume


def controler_formulaire(d: dict, refs: dict) -> list[str]:
    """Contrôles d'un formulaire : QP et MET (décision D2 de la Porte 3).

    Chaque question déclare ce qu'elle renseigne — une variable du bilan pour QP, une
    dimension pour MET. Une question sans cible ne sert à rien et n'a pas sa place.
    """
    err: list[str] = []
    tb = refs["termes_bloquants"]
    ou = f"{d.get('instrument')}/{d.get('version')}"
    entrees = [i for i in refs["catalogue"]["instruments"]
               if i["code"] == d.get("instrument") and i["version"] == d.get("version")]
    if not entrees:
        return [f"{ou} : aucun enregistrement au catalogue"]
    cat = entrees[0]
    if cat["porte_items"]:
        err.append(f"{ou} : le catalogue le déclare porteur d'items, or c'est un formulaire")
    if cat["support"] != "distance":
        err.append(f"{ou} : support « {cat['support']} », attendu « distance » (§ 3.2)")
    if d.get("saisie", {}).get("support") != "plateforme":
        err.append(f"{ou} : la saisie doit se faire sur la plateforme, le papier étant un secours")

    est_qp = d.get("instrument") == "QP"
    variables = {v["code"]: v for v in refs["variables_qp"]["variables"]}
    dimensions = {x["code"]: x for x in refs["dimensions_met"]["dimensions"]}
    interdits = set(refs["variables_qp"]["conventions"]["donnees_nominatives"]["champs_plateforme_seulement"])

    types_qp = set(refs["variables_qp"]["conventions"]["types"])
    vus: set[str] = set()
    cibles_vues: set[str] = set()
    for q in d.get("questions", []):
        r = f"{ou}/{q.get('id')}"
        if q.get("id") in vus:
            err.append(f"{r} : identifiant de question dupliqué")
        vus.add(q.get("id"))
        if not q.get("libelle"):
            err.append(f"{r} : question sans libellé")
        err += VR.chercher_termes(q.get("libelle", ""), "enonce_candidat", tb, r)
        if q.get("type") not in types_qp:
            err.append(f"{r} : type « {q.get('type')} » inconnu")

        cle = "cible" if est_qp else "cible_dimension"
        cible = q.get(cle)
        if not cible:
            err.append(f"{r} : question sans « {cle} » — une question qui ne renseigne rien "
                       f"n'a pas sa place dans le formulaire")
        elif est_qp:
            if cible not in variables:
                err.append(f"{r} : variable « {cible} » absente du référentiel")
            else:
                v = variables[cible]
                cibles_vues.add(cible)
                if v.get("derive"):
                    err.append(f"{r} : « {cible} » est une variable dérivée, elle ne se saisit pas")
                if v["type"] != q["type"]:
                    err.append(f"{r} : type « {q['type']} » alors que la variable attend « {v['type']} »")
                if q["type"] == "entier":
                    for borne in ("min", "max"):
                        if q.get(borne) != v.get(borne):
                            err.append(f"{r} : borne {borne} = {q.get(borne)}, "
                                       f"le référentiel fixe {v.get(borne)}")
                if q["type"] in ("choix_unique", "choix_multiple"):
                    attendues = set(v.get("valeurs") or [])
                    proposees = {o["valeur"] for o in q.get("options", [])}
                    if attendues and proposees != attendues:
                        err.append(f"{r} : options {sorted(proposees)} au lieu des valeurs "
                                   f"du référentiel {sorted(attendues)}")
                if q["type"] == "texte_court":
                    if not v.get("justification_texte_libre"):
                        err.append(f"{r} : texte libre sans justification au référentiel — "
                                   f"un choix fermé est attendu partout où il est possible")
                    # Sans borne, le rendu échoue et la saisie n'a pas de limite : les deux
                    # doivent porter la même, et elle vient du référentiel.
                    if q.get("max_caracteres") != v.get("max_caracteres"):
                        err.append(f"{r} : borne max_caracteres = {q.get('max_caracteres')}, "
                                   f"le référentiel fixe {v.get('max_caracteres')}")
        elif cible not in dimensions:
            err.append(f"{r} : dimension « {cible} » absente du référentiel")

        if any(m in VR.normaliser(q.get("libelle", "")) for m in interdits):
            err.append(f"{r} : le formulaire imprimable ne collecte aucune donnée nominative")
        if not est_qp:
            for o in q.get("options", []):
                if not isinstance(o.get("poids"), int):
                    err.append(f"{r} : option « {o.get('valeur')} » sans poids entier")

    if est_qp:
        err += controler_sections_conditionnelles(d, refs, ou)
        for code, v in variables.items():
            if v.get("obligatoire") and not v.get("derive") and code not in cibles_vues:
                err.append(f"{ou} : variable obligatoire « {code} » qu'aucune question ne renseigne")
    else:
        couvertes = {q.get("cible_dimension") for q in d.get("questions", [])}
        for code in dimensions:
            if code not in couvertes:
                err.append(f"{ou} : dimension « {code} » qu'aucune question ne renseigne")
        for code, dim in dimensions.items():
            seuils = [n["seuil_min"] for n in dim["niveaux"]]
            if seuils != sorted(seuils) or len(dim["niveaux"]) != 3:
                err.append(f"{ou}/{code} : trois niveaux à seuils croissants sont attendus")
            for n in dim["niveaux"]:
                for champ in ("libelle", "outillage"):
                    err += VR.chercher_termes(n[champ], "prose_bilan", tb, f"{ou}/{n['code']}/{champ}")
    return err


def controler_sections_conditionnelles(d: dict, refs: dict, ou: str) -> list[str]:
    """Une question conditionnelle porte la condition de sa variable, et rien d'autre.

    Le questionnaire de parcours n'est pas un questionnaire juridique : un candidat qui
    ne sollicite ni ne nécessite le passage en une seule session ne doit voir aucune
    question de l'article 3. Cela ne tient que si trois choses coïncident — la section
    déclarée au référentiel, la condition portée par chaque variable, et celle portée par
    la question qui la renseigne. Ce contrôle les confronte.

    Il refuse aussi qu'une question cible une donnée de back-office : une pièce
    justificative et une décision administrative ne sont pas des réponses du candidat, et
    lui demander de certifier qu'une autorité a statué serait lui faire dire n'importe quoi.
    """
    conv = refs["variables_qp"]["conventions"]
    variables = {v["code"]: v for v in refs["variables_qp"]["variables"]}
    back_office = set(conv.get("donnees_back_office", {}).get("champs", []))
    sections_ref = conv.get("sections_conditionnelles", {}).get("sections", {})
    err = []
    for s in d.get("sections", []):
        fiche = sections_ref.get(s.get("code"))
        if fiche is None:
            err.append(f"{ou} : section « {s.get('code')} » absente du référentiel")
        elif not s.get("condition_lisible"):
            err.append(f"{ou}/{s['code']} : section conditionnelle sans condition lisible — "
                       f"le formulaire de secours afficherait un nom de variable au candidat")
        elif s.get("conditionnelle") != fiche["condition"]:
            err.append(f"{ou}/{s['code']} : la condition du formulaire diffère de celle du "
                       f"référentiel")
    sections_formulaire = {s["code"] for s in d.get("sections", [])}
    for q in d.get("questions", []):
        r = f"{ou}/{q.get('id')}"
        cible = q.get("cible")
        if cible in back_office:
            err.append(f"{r} : « {cible} » est une donnée de back-office — ni une pièce "
                       f"justificative ni une décision administrative n'est une réponse du "
                       f"candidat")
            continue
        v = variables.get(cible)
        if v is None:
            continue
        if v.get("conditionnelle") != q.get("conditionnelle"):
            err.append(f"{r} : la condition d'affichage diffère de celle que le référentiel "
                       f"attache à « {cible} »")
        # Une variable peut être obligatoire dans le dossier sans être toujours posée :
        # c'est le cas d'un axe du modèle temporel, déduit du profil pour deux profils sur
        # trois et saisi pour le troisième. La dérivation partielle doit alors être
        # déclarée, avec sa formule, sans quoi un candidat verrait la question disparaître
        # sans que rien ne remplisse la variable.
        if v.get("conditionnelle") and v.get("obligatoire") and not v.get("derive"):
            if not v.get("derive_partielle"):
                err.append(f"{r} : « {cible} » est conditionnelle et déclarée obligatoire "
                           f"sans réserve — un candidat qui ne voit pas la question ne "
                           f"peut pas y répondre")
            elif not v.get("formule"):
                err.append(f"{r} : « {cible} » est partiellement dérivée sans formule — "
                           f"rien ne dit comment elle est remplie hors de sa condition")
        if v.get("section") and v["section"] not in sections_formulaire:
            err.append(f"{r} : « {cible} » relève de la section « {v['section']} », que le "
                       f"formulaire ne déclare pas")
        if v.get("section") and q.get("section") != v["section"]:
            err.append(f"{r} : la question ne déclare pas la section « {v['section']} »")
    return err


def valider_formulaire(dossier: Path) -> tuple[list[str], list[str]]:
    refs = charger_referentiels(None)
    d = VR.charger(dossier / "formulaire.json")
    err = controler_formulaire(d, refs)
    n = len(d.get("questions", []))
    return err, [f"  {d['instrument']}/{d['version']} : {n} questions"]


def valider(dossier: Path, versions: list[str] | None = None) -> tuple[list[str], list[str]]:
    """(erreurs, lignes de résumé) pour chaque version de l'instrument."""
    if (dossier / "formulaire.json").exists():
        return valider_formulaire(dossier)
    if list(dossier.glob("definition*.json")):
        return valider_grille_coach(dossier)
    local = dossier / "referentiels"
    refs = charger_referentiels(local if local.exists() else None)

    err, _ = VR.controler(refs["competences"])
    e, _ = VR.controler_codes_erreur(refs["codes_erreur"], refs["competences"], refs["termes_bloquants"])
    err += e
    e, _ = VR.controler_termes_bloquants(refs["termes_bloquants"], refs["competences"])
    err += e
    e, _ = VR.controler_catalogue(refs["catalogue"], refs["competences"])
    err += e
    if err:
        return [f"référentiel invalide : {x}" for x in err], []

    banque = VR.charger(dossier / "banque.json")
    dispo = sorted(p.stem for p in (dossier / "assemblages").glob("*.json"))
    resume = []
    for v in versions or dispo:
        assemblage = VR.charger(dossier / "assemblages" / f"{v}.json")
        err += [f"[{v}] {x}" for x in controler(banque, assemblage, refs)]
        n = sum(len(b["items"]) for b in assemblage["blocs"])
        par_id = {i["item_id"]: i for i in banque["items"]}
        ids = [i for b in assemblage["blocs"] for i in b["items"]]
        d = sum(par_id[i]["duree_min"] for i in ids if i in par_id) \
            + assemblage.get("bloc_0", {}).get("duree_min", 0)
        pts = sum(par_id[i]["score_max"] for i in ids if i in par_id)
        resume.append(f"  {banque['instrument']}/{v} : {n} items, {pts} points, {d} min")
    return err, resume


def _capacites(refs: dict) -> tuple[dict, dict]:
    """Les capacités officielles indexées par code, et le programme de chaque parcours."""
    ref = refs.get("capacites_mathematiques") or {}
    par_code, par_parcours = {}, {}
    for nor, prog in (ref.get("programmes") or {}).items():
        if prog.get("parcours"):
            par_parcours[prog["parcours"]] = nor
        for c in prog["capacites"]:
            # Le programme de la classe antérieure vaut pour les deux parcours : c'est la
            # source d'un prérequis, non d'une capacité du niveau évalué.
            par_code[c["code"]] = {**c, "nor": None if prog.get("anterieur") else nor,
                                   "anterieur": bool(prog.get("anterieur"))}
    for c in ref.get("renvois_externes") or []:
        par_code[c["code"]] = {**c, "nor": None, "anterieur": True}
    return par_code, par_parcours


def controler_capacites_officielles(items: list, refs: dict, ou: str,
                                    assemblage: dict) -> list[str]:
    """Chaque item de MATH-EA renvoie à une capacité réellement écrite dans son programme.

    Un renvoi générique — « partie Automatismes du programme du 26 février 2026 » — ne dit
    pas quelle capacité l'item évalue, et n'établit donc pas qu'il en évalue une. Le
    référentiel des capacités transcrit les lignes des deux annexes ; l'item nomme la
    ligne. Une ligne de « Contenus », ou le renvoi des annexes au programme de seconde,
    reste un rattachement admissible, mais il doit être justifié : la notion est au
    programme sans être une capacité attendue.
    """
    par_code, par_parcours = _capacites(refs)
    if not par_code or assemblage["instrument"] != "MATH-EA":
        return []
    parcours = assemblage["version"]
    attendu = par_parcours.get(parcours)
    err = []
    for it in items:
        cap = it.get("capacites_officielles")
        if not cap:
            err.append(f"{ou}/{it['item_id']} : aucune capacité officielle déclarée — un "
                       f"item ne peut pas évaluer un programme sans nommer la ligne qu'il "
                       f"évalue")
            continue
        codes = cap.get(parcours)
        if not codes:
            err.append(f"{ou}/{it['item_id']} : aucune capacité déclarée pour le parcours "
                       f"{parcours}, alors que l'assemblage le retient")
            continue
        for code in codes:
            fiche = par_code.get(code)
            if fiche is None:
                err.append(f"{ou}/{it['item_id']} : capacité « {code} » absente du "
                           f"référentiel des capacités officielles")
                continue
            if fiche["nor"] not in (None, attendu):
                err.append(f"{ou}/{it['item_id']} : capacité « {code} » relève de "
                           f"{fiche['nor']}, alors que le parcours {parcours} évalue "
                           f"{attendu}")
            if fiche["nature"] != "capacite_attendue" and \
                    not it.get("justification_rattachement"):
                err.append(f"{ou}/{it['item_id']} : rattaché à « {code} », de nature "
                           f"« {fiche['nature']} » et non à une capacité attendue, sans "
                           f"justification_rattachement")
        err += controler_prerequis(it, par_code, codes, ou)
    return err


def controler_prerequis(it: dict, par_code: dict, codes: list, ou: str) -> list[str]:
    """Un prérequis est un acquis antérieur, jamais une capacité du niveau évalué.

    Le bloc A du dispositif est l'assiette du taux de prérequis, et ce taux décide d'une
    entrée par remise à niveau. Y placer les automatismes du programme de première
    revenait à traiter comme un manque du niveau inférieur ce qui est le contenu même de
    l'épreuve : un candidat qui échoue sur les notions de son année y était envoyé en
    remise à niveau. Les deux dimensions sont donc séparées — la partie de l'épreuve d'un
    côté, le rôle diagnostique de l'autre — et chacune se contrôle.
    """
    if "est_prerequis" not in it:
        return [f"{ou}/{it['item_id']} : le rôle diagnostique n'est pas déclaré "
                f"(« est_prerequis »)"]
    err = []
    prerequis = bool(it["est_prerequis"])
    if prerequis != (it["bloc"] == "A"):
        err.append(f"{ou}/{it['item_id']} : bloc {it['bloc']} et est_prerequis="
                   f"{str(prerequis).lower()} — le bloc A est l'assiette du taux de "
                   f"prérequis, il ne contient que des prérequis et les contient tous")
    if prerequis:
        anterieures = [c for c in codes if par_code.get(c, {}).get("anterieur")]
        if not anterieures:
            err.append(f"{ou}/{it['item_id']} : déclaré prérequis sans aucune capacité de "
                       f"la classe antérieure ni renvoi explicite — une capacité de "
                       f"première n'est pas un prérequis parce qu'elle est un automatisme")
    return err


def controler_sans_calculatrice(items: list, refs: dict, ou: str,
                                assemblage: dict) -> list[str]:
    """Aucun item ne doit exiger une calculatrice pour être résolu dans le temps annoncé.

    L'interdiction porte sur toute l'épreuve. Un item dont le calcul ne se conduit pas à la
    main ne mesurerait donc pas ce qu'il prétend mesurer : il mesurerait l'absence d'outil.
    La preuve ne peut pas être automatique — c'est une lecture de conception — mais elle
    peut être exigée : chaque item nomme le calcul exact que le candidat doit conduire.
    """
    if assemblage["instrument"] != "MATH-EA":
        return []
    regle = ((refs.get("programmes_examen") or {}).get("epreuves_anticipees", {})
             .get("session_2027", {}).get("mathematiques", {}).get("sans_calculatrice"))
    if not regle:
        return []
    return [f"{ou}/{it['item_id']} : aucun champ « calcul_sans_outil » — l'item ne dit pas "
            f"quel calcul le candidat conduit sans calculatrice"
            for it in items if not it.get("calcul_sans_outil")]


def controler_competences_transversales(items: list, refs: dict, ou: str,
                                        assemblage: dict) -> list[str]:
    """Les six compétences du préambule sont déclarées par item, et couvertes pour de bon.

    Le préambule commun aux deux programmes fonde le travail mathématique sur six
    compétences. Elles ne sont pas des domaines de contenu : un item ne les exerce pas du
    seul fait qu'il porte sur un modèle ou sur un graphique. Ce contrôle vérifie deux
    choses. D'abord que chaque compétence déclarée existe. Ensuite qu'une compétence
    déclarée couverte l'est par au moins deux tâches de la seconde partie de l'épreuve —
    c'est là que le raisonnement, la modélisation et la communication se jouent, un QCM
    d'automatismes ne pouvant en porter aucune preuve.
    """
    ref = refs.get("capacites_mathematiques") or {}
    if not ref or assemblage["instrument"] != "MATH-EA":
        return []
    connues = {c["code"] for c in ref["competences_transversales"]["liste"]}
    err = []
    for it in items:
        for c in it.get("competences_math_transversales") or []:
            if c not in connues:
                err.append(f"{ou}/{it['item_id']} : compétence transversale « {c} » "
                           f"inconnue du préambule des programmes")
        if not it.get("competences_math_transversales"):
            err.append(f"{ou}/{it['item_id']} : aucune compétence transversale déclarée")
        err += controler_preuve_transversale(it, ref, f"{ou}/{it['item_id']}",
                                             assemblage["version"])
    regle = ref["competences_transversales"].get("regle_couverture")
    if regle:
        seuil = regle["sources_min_partie_2"]
        for code, n in couverture_transversale(items, refs, assemblage).items():
            if n["partie_2"] < seuil:
                err.append(f"{ou} : la compétence transversale « {code} » n'est exercée que "
                           f"par {n['partie_2']} tâche(s) de la seconde partie, pour un "
                           f"minimum de {seuil} — elle ne peut pas être présentée comme "
                           f"couverte")
    return err


def preuve_transversale(it: dict, ref: dict, competence: str, parcours: str):
    """La trace concrète qui autorise l'étiquette, ou None si la tâche n'en porte aucune.

    Rend un couple (nature de la preuve, extrait) : ce que le compte rendu doit pouvoir
    citer en regard de l'étiquette déclarée.
    """
    regles = ref["competences_transversales"].get("preuves", {})
    regle = regles.get(competence)
    if regle is None:
        return ("non contrôlée", "")
    texte = VR.normaliser(it.get("enonce", ""))
    if competence == "REPRESENTER":
        for sup in it.get("supports") or []:
            if isinstance(sup, dict) and sup.get("type") in regle["supports_admis"]:
                return (f"support {sup['type']}", sup.get("titre", sup.get("code", "")))
        for v in regle["verbes_de_production"]:
            if VR.normaliser(v) in texte:
                return ("production demandée", v)
        for code in it.get("capacites_officielles", {}).get(parcours, []):
            if code in regle["capacites_de_registre"]:
                return ("changement de registre officiel", code)
        return None
    if competence == "COMMUNIQUER":
        if it["type"] in regle["types_exclus"]:
            return None
        for v in regle["verbes_de_redaction"]:
            if VR.normaliser(v) in texte:
                return ("rédaction demandée", v)
        for cr in it.get("grille") or []:
            if "redac" in VR.normaliser(cr.get("code", "")):
                return ("critère de rédaction", cr["code"])
        return None
    return ("non contrôlée", "")


def controler_preuve_transversale(it: dict, ref: dict, ou: str, parcours: str) -> list[str]:
    """Refuse une étiquette que la tâche ne porte pas.

    C'est le reproche de la direction : le tableau de couverture comptait des mots du JSON.
    Déclarer « représenter » sur un calcul de distance, ou « communiquer » sur un
    questionnaire à choix multiple, gonflait la couverture sans rien mesurer.
    """
    err = []
    for c in it.get("competences_math_transversales") or []:
        if c not in ref["competences_transversales"].get("preuves", {}):
            continue
        if preuve_transversale(it, ref, c, parcours) is None:
            err.append(f"{ou} : « {c} » est déclarée, mais la tâche n'en porte aucune trace "
                       f"— ni support à lire, ni production à construire, ni rédaction "
                       f"demandée")
    return err


def couverture_transversale(items: list, refs: dict, assemblage: dict) -> dict:
    """Compte, par compétence transversale, les tâches qui l'exercent dans chaque partie."""
    ref = refs["capacites_mathematiques"]
    prog = refs["programmes_examen"]["epreuves_anticipees"]["session_2027"]["mathematiques"]
    corr = prog["format_epreuve"]["correspondance_blocs"]
    bloc_de = {i: b["bloc"] for b in assemblage["blocs"] for i in b["items"]}
    out = {c["code"]: {"partie_1": 0, "partie_2": 0, "hors_format": 0}
           for c in ref["competences_transversales"]["liste"]}
    for it in items:
        bloc = bloc_de.get(it["item_id"])
        partie = next((p for p in ("partie_1", "partie_2")
                       if bloc in corr[p]["blocs"] and it["type"] in corr[p]["types_item"]),
                      "hors_format")
        for c in it.get("competences_math_transversales") or []:
            out[c][partie] += 1
    return out


def audit_paliers(items: list, refs: dict, assemblage: dict) -> dict:
    """Quels paliers l'assemblage permet réellement de déterminer, compétence par compétence.

    Déclarer un palier ne suffit pas à le mesurer : il faut assez de points sur ce palier
    pour que le résultat ne tienne pas à un item. Cette fonction rend, pour chaque
    compétence de l'assemblage, les paliers servis, les points de chacun et ceux qui
    atteignent le seuil du référentiel. Elle est le support de l'audit D1/D2/D3 : ce qui
    n'atteint pas le seuil est rendu comme non déterminé, jamais comme déterminé faiblement.
    """
    regles = refs["competences"]["conventions"]["regles_couverture"]
    seuil = regles["competence_ordinaire"]["points_min_par_palier"]
    echelle = refs["competences"]["conventions"]["echelle_grille"]["max"]
    libelles = refs["competences"]["conventions"]["paliers"]
    out = {}
    for it in items:
        if it.get("grille"):
            for cr in it["grille"]:
                d = out.setdefault(cr["competence"], {})
                d.setdefault(it["palier"], {"points": 0, "sources": 0})
                d[it["palier"]]["points"] += echelle
                d[it["palier"]]["sources"] += 1
        else:
            d = out.setdefault(it["competence"], {})
            d.setdefault(it["palier"], {"points": 0, "sources": 0})
            d[it["palier"]]["points"] += it["score_max"]
            d[it["palier"]]["sources"] += 1
    for comp, paliers in out.items():
        for code, x in paliers.items():
            x["determine"] = x["points"] >= seuil
            x["libelle"] = libelles[code]
    return {"seuil_points": seuil, "paliers_declares": list(libelles), "competences": out}


def controler_oeuvres_citees(items: list, refs: dict, ou: str,
                             session: int | None) -> list[str]:
    """Un item ne cite pas au candidat une œuvre étrangère à la session de son assemblage.

    Un item de repères demandait « parmi ces quatre œuvres au programme de la session
    2027 » et donnait pour bonne réponse « Pot-Bouille », qui relève de la session 2028 :
    l'item était faux, et aucun contrôle ne le voyait. Le texte lu par le candidat est donc
    confronté au programme de **la session de l'assemblage** — non à une session unique du
    dispositif : le même item peut être juste en 2028 et faux en 2027. Les notes de
    conception sont exclues : elles peuvent nommer une œuvre retirée pour dire pourquoi.
    """
    prog = refs.get("programmes_examen")
    if not prog or session is None:
        return []
    au_programme, ailleurs = set(), {}
    for s, fiche in prog["sessions"].items():
        for voie in fiche["voies"].values():
            if not isinstance(voie, dict):
                continue
            for liste in voie.values():
                if not isinstance(liste, list):
                    continue
                for x in liste:
                    if int(s) == int(session):
                        au_programme.add(x["oeuvre"])
                    else:
                        ailleurs.setdefault(x["oeuvre"], set()).add(s)
    err = []
    for it in items:
        lu = " ".join([it.get("enonce", ""),
                       " ".join((it.get("propositions") or {}).values()),
                       json.dumps(it.get("cle") or {}, ensure_ascii=False)])
        for oeuvre, sessions in ailleurs.items():
            if oeuvre in au_programme or oeuvre not in lu:
                continue
            err.append(f"{ou}/{it['item_id']} : cite « {oeuvre} » au candidat, œuvre du "
                       f"programme de la session {', '.join(sorted(sessions))} et non de "
                       f"la session {session} de cet assemblage")
    return err


def controler_items_sessionnes(items: list, ou: str, session: int | None) -> list[str]:
    """Un assemblage ne retient que des items applicables à sa session finale.

    Un item peut être propre à une session — « parmi ces quatre œuvres au programme de la
    session 2027 » — ou n'en dépendre d'aucune. L'assemblage connaît sa session ; il ne
    peut pas prendre un item qui n'y est pas applicable, ni retenir un item sessionné quand
    lui-même ne déclare aucune session.
    """
    err = []
    for it in items:
        sessions = it.get("sessions_applicables")
        if not sessions:
            continue
        if session is None:
            err.append(f"{ou}/{it['item_id']} : item propre aux sessions "
                       f"{sessions} dans un assemblage qui n'en déclare aucune")
        elif int(session) not in [int(x) for x in sessions]:
            err.append(f"{ou}/{it['item_id']} : item propre aux sessions {sessions}, "
                       f"assemblage de la session {session}")
    return err


def controler_oeuvre_au_programme(sup: dict, refs: dict, ou: str,
                                  session_assemblage: int | None = None) -> list[str]:
    """Un support au programme d'une session doit exister dans cette session (audit 2027).

    Le Cahier a désigné « Pot-Bouille » pour le bloc C du français. L'œuvre est bien au
    programme national — mais de la classe de première 2026-2027, donc des épreuves
    anticipées de la session 2028. Le dossier vise la session 2027. Un texte réglementaire
    prime le Cahier : ce contrôle confronte chaque désignation au référentiel des
    programmes plutôt qu'à la mémoire du rédacteur, et vaut pour La Boétie comme pour Zola.
    """
    decl = sup.get("oeuvre_au_programme")
    if not decl:
        return []
    prog = refs.get("programmes_examen")
    if not prog:
        return [f"{ou} : référentiel des programmes absent, la désignation est invérifiable"]
    err = []
    # La session opposable est celle de l'assemblage : un support de l'assemblage 2028 se
    # confronte au programme 2028. À défaut de session déclarée, celle du dispositif.
    visee = (str(session_assemblage) if session_assemblage is not None
             else next((s for s, x in prog["sessions"].items()
                        if x.get("session_visee_du_dispositif")), None))
    session = str(decl.get("session"))
    if session != visee:
        err.append(f"{ou} : support déclaré au programme de la session {session}, alors que "
                   f"l'assemblage relève de la session {visee}")
    fiche = prog["sessions"].get(session)
    if fiche is None:
        return err + [f"{ou} : session {session} absente du référentiel des programmes"]
    voie = decl.get("voie", "generale")
    objets = fiche["voies"].get(voie)
    if not isinstance(objets, dict) or decl.get("objet_etude") not in objets:
        return err + [f"{ou} : objet d'étude « {decl.get('objet_etude')} » absent de la "
                      f"session {session}, voie {voie}"]
    inscrites = objets[decl["objet_etude"]]
    couple = (VR.normaliser(decl.get("auteur", "")), VR.normaliser(decl.get("oeuvre", "")))
    if couple not in {(VR.normaliser(x["auteur"]), VR.normaliser(x["oeuvre"]))
                      for x in inscrites}:
        ailleurs = [f"session {s}"
                    for s, x in prog["sessions"].items()
                    for v in x["voies"].values() if isinstance(v, dict)
                    for liste in v.values() if isinstance(liste, list)
                    for y in liste
                    if (VR.normaliser(y.get("auteur", "")),
                        VR.normaliser(y.get("oeuvre", ""))) == couple]
        err.append(f"{ou} : « {decl.get('auteur')}, {decl.get('oeuvre')} » n'est pas au "
                   f"programme de la session {session} (objet « {decl['objet_etude']} », "
                   f"voie {voie})"
                   + (f" — cette œuvre relève de la {', '.join(sorted(set(ailleurs)))}"
                      if ailleurs else ""))
    return err


def controler_supports_partages(cibles: list[Path]) -> list[str]:
    """Un même support ne peut pas servir deux instruments qu'un même profil passe.

    Un candidat qui retrouve au second instrument le texte déjà travaillé au premier n'y est
    plus mesuré de la même façon : la seconde mesure est contaminée par la première.
    """
    refs = charger_referentiels(None)
    catalogue = {(i["code"], i["version"]): i for i in refs["catalogue"]["instruments"]}
    vus: dict[str, list[tuple[str, str, set]]] = {}
    for d in cibles:
        if not (d / "assemblages").exists():
            continue
        for f in sorted((d / "assemblages").glob("*.json")):
            asm = VR.charger(f)
            cat = catalogue.get((asm["instrument"], asm["version"]))
            if cat is None:
                continue
            profils = set(cat["profils"])
            for b in asm["blocs"]:
                for sup in b.get("supports", []):
                    if not isinstance(sup, dict):
                        continue
                    cle = VR.normaliser(sup.get("reference", "") or sup.get("titre", ""))
                    if not cle:
                        continue
                    vus.setdefault(cle, []).append(
                        (asm["instrument"], asm["version"], profils))
    err = []
    for cle, emplois in sorted(vus.items()):
        for i in range(len(emplois)):
            for j in range(i + 1, len(emplois)):
                a, b = emplois[i], emplois[j]
                if a[0] == b[0]:
                    continue  # deux versions d'un même instrument : jamais passées ensemble
                communs = a[2] & b[2]
                if communs:
                    err.append(f"support partagé : « {cle[:60]}… » sert {a[0]}/{a[1]} et "
                               f"{b[0]}/{b[1]}, que le ou les profils {sorted(communs)} passent "
                               f"tous deux — la seconde mesure serait contaminée")
    return err


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("dossier", nargs="?", help="dossier de l'instrument")
    ap.add_argument("versions", nargs="*", help="versions à contrôler (toutes par défaut)")
    ap.add_argument("--tous", action="store_true", help="tous les instruments de instruments/")
    a = ap.parse_args()

    cibles = ([d for d in sorted((RACINE / "instruments").iterdir())
               if (d / "banque.json").exists() or (d / "definition.json").exists()
               or (d / "formulaire.json").exists()] if a.tous
              else [Path(a.dossier)] if a.dossier else [])
    if not cibles:
        ap.error("indiquer un dossier d'instrument, ou --tous")

    total = 0
    metier = techniques = 0
    for d in cibles:
        err, resume = valider(d, a.versions or None)
        if d.name.startswith("_"):
            techniques += 1
        else:
            metier += 1
        print(f"── {d.name}" + ("  *(fixture technique)*" if d.name.startswith("_") else ""))
        for l in resume:
            print(l)
        for x in err:
            print("ERREUR :", x)
        print(f"  {len(err)} erreur(s)")
        total += len(err)
    if a.tous:
        partages = controler_supports_partages(cibles)
        for x in partages:
            print("ERREUR :", x)
        total += len(partages)
        # Le contrôle précédent compare des références déclarées ; celui-ci compare les
        # textes eux-mêmes. Deux supports peuvent citer deux éditions et porter le même
        # passage : seule l'empreinte le dit. Une collision arrête le build.
        sources = TS.controler()
        for x in sources:
            print("ERREUR :", x)
        total += len(sources)
        # Deux nombres, jamais un seul : le dispositif Nexus compte les instruments métier,
        # et la fixture technique n'en fait pas partie. Les additionner a déjà produit un
        # « dix-sept instruments » dans un rapport (2026-09-12).
        print(f"\n{metier} instrument(s) métier validé(s) · {techniques} fixture(s) "
              f"technique(s) · {total} erreur(s) au total")
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
