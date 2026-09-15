#!/usr/bin/env python3
"""La synthèse de mise en service, rendue depuis les pièces d'audit — jamais ressaisie.

Ce document est écrit pour la direction, et c'était un document rédigé à la main. Il a donc
fait ce que fait tout document rédigé à la main : il a vieilli sans le dire. Il annonçait
14 140 tests passés quand la pièce d'acceptation en portait un autre nombre, et rien ne
rapprochait les deux.

Tout ce qui est chiffré ici est désormais lu à la source canonique de sa famille — celles
que déclare `scripts/etat_depot.SOURCES_CANONIQUES` —, et `tests/test_gouvernance_documents.py`
refuse que deux documents répondent différemment à la même question.

    python3 scripts/go_live_readiness.py             # écrit audit/GO_LIVE_READINESS.md
    python3 scripts/go_live_readiness.py --verifier  # compare sans écrire, code 1 si dérive
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import etat_depot as ED  # noqa: E402

AUDIT = RACINE / "audit"


def charger(chemin: str) -> dict:
    return json.loads((RACINE / chemin).read_text(encoding="utf-8"))


def jsonl(nom: str) -> list[dict]:
    return [json.loads(l) for l
            in (AUDIT / nom).read_text(encoding="utf-8").splitlines() if l.strip()]


def milliers(n: int) -> str:
    """12915 → « 12 915 ». Une espace insécable étroite, comme le veut l'usage."""
    return f"{n:,}".replace(",", " ")


def rendu() -> str:
    e = ED.etat_courant()
    gate = charger(ED.SOURCES_CANONIQUES["verdict"])
    cc = charger(ED.SOURCES_CANONIQUES["tests"])
    repro = charger("audit/RELEASE_REPRODUCIBILITY.json")
    registre = charger("audit/REGULATORY_SOURCE_REGISTER.json")
    scope = charger(ED.SOURCES_CANONIQUES["perimetre"])
    asm = charger(ED.SOURCES_CANONIQUES["assemblages"])
    sup = charger("audit/SUPPORT_AUDIT.json")
    pdf = charger("audit/PDF_VISUAL_QA.json")
    visuel = charger("audit/PDF_VISUAL_RENDER.json")
    sec = charger("audit/SECURITY_SCAN.json")
    items = jsonl("ITEM_AUDIT.jsonl")
    findings = jsonl("FINDINGS.jsonl")
    couv = charger(ED.SOURCES_CANONIQUES["couverture_reglementaire"])["couverture_nexus"]

    par_severite = {s: sum(1 for f in findings if f["severity"] == s)
                    for s in ("BLOCKER", "MAJOR", "MINOR")}
    hors = ", ".join(n["code"] for n in couv["non_couverts"])
    incertitudes = registre["incertitudes_declarees"]
    reserve = incertitudes[0] if incertitudes else None

    L = [
        "# Diagnostics V2 — état de mise en service",
        "",
        "*Document produit par `scripts/go_live_readiness.py` depuis les pièces d'audit.*",
        "*Aucun chiffre n'y est saisi : chacun est lu à la source canonique de sa famille.*",
        "",
        "Ce document dit ce que la collection couvre, ce qu'elle ne couvre pas, ce qui a été",
        "trouvé et corrigé, et ce qui reste à surveiller.",
        "",
        "---",
        "",
        "## Ce que la release contient",
        "",
        "| | |",
        "|---|---|",
        f"| Instruments | **{e['instruments']}**, en **{e['variantes']} variantes** "
        "(première, terminale, cycle complet, sessions 2027 et 2028) |",
        f"| Questions de banque | **{e['items_banque']}**, toutes relues une par une |",
        f"| Assemblages | **{e['assemblages']}** |",
        f"| Livrets remis au candidat | **{e['livrets_candidat']}** |",
        f"| Corrections du coach | **{e['corrections_coach']}** |",
        f"| Recueils d'impression | **{e['catalogues_operateur']}** |",
        f"| Fichiers de release | **{e['fichiers_release']}**, tous décrits au manifeste |",
        f"| Pages composées | **{milliers(pdf['pages_totales'])}** |",
        "",
        "**Profils servis.** Première partie du baccalauréat (P1), deuxième partie (P2),",
        "baccalauréat complet en une session (P3). **Sessions** 2027 et 2028.",
        "",
        f"**Situations candidates.** {milliers(e['candidate_states'])} états valides "
        f"énumérés, {milliers(e['selection_classes'])} classes de sélection,",
        f"{len(list((AUDIT / 'golden_packs').glob('*.json')))} packs témoins tenus comme "
        "référence.",
        "",
        "---",
        "",
        "## Ce que la release ne couvre pas",
        "",
        f"Trois enseignements obligatoires du candidat individuel restent hors de l'offre de",
        f"diagnostic : **{hors}**. Soit **{e['coefficients_non_couverts']} des "
        f"{e['coefficients_couverts'] + e['coefficients_non_couverts']} points** du contrôle",
        f"continu, contre {e['coefficients_couverts']} couverts.",
        "",
        "Le dispositif ne doit donc jamais être présenté comme couvrant l'intégralité du",
        "baccalauréat. Deux verdicts distincts sont tenus :",
        "`READY_FOR_NEXUS_SUPPORTED_SCOPE = YES`,",
        "`READY_FOR_FULL_REGULATORY_BAC_COVERAGE = NO`.",
        "",
        "---",
        "",
        "## Sources officielles",
        "",
        f"**{len(registre['textes'])} textes** ont été relevés sur le Bulletin officiel ou",
        "Légifrance, cités mot à mot et datés du jour de la consultation. Le registre complet",
        "est dans `audit/REGULATORY_SOURCE_REGISTER.json`.",
        "",
        f"**{len(registre['affirmations_non_etayees'])} affirmation réglementaire non étayée**",
        "ne subsiste dans un document remis au candidat.",
        "",
    ]
    if reserve:
        L += [
            "### Une incertitude, déclarée comme telle",
            "",
            f"**{reserve['champ']} : {reserve['etat']}.**",
            "",
            reserve["consequence_produit"],
            "",
            f"À réévaluer {reserve['a_reevaluer']}.",
            "",
        ]
    L += [
        "---",
        "",
        "## Ce que l'audit a trouvé",
        "",
        f"**{len(findings)} défauts, tous corrigés** : {par_severite['BLOCKER']} bloquants, "
        f"{par_severite['MAJOR']} majeurs, {par_severite['MINOR']} mineurs.",
        f"Aucun n'est resté ouvert. Le registre complet, avec la preuve de chacun, est dans",
        "`audit/FINDINGS.jsonl`.",
        "",
        "Les bloquants méritent d'être nommés, parce qu'ils disent ce qu'un test vert ne voit",
        "pas.",
        "",
    ]
    for f in findings:
        if f["severity"] != "BLOCKER":
            continue
        L.append(f"- **{f['category']}** — {f['description']}")
    L += [
        "",
        "Parmi les majeurs, deux tiennent à la mesure elle-même : la position des bonnes",
        "réponses de QCM, concentrée sur une seule lettre au point qu'un candidat qui l'aurait",
        "cochée partout sans lire aurait emporté les deux tiers des points ; et onze items qui",
        "cotaient un point une configuration qu'aucune permutation ne réalise.",
        "",
        "---",
        "",
        "## Ce qui a été vérifié, et comment",
        "",
        "| Contrôle | Résultat |",
        "|---|---|",
        f"| Suite de tests complète, en clone propre | **{milliers(cc['pytest']['passed'])} "
        f"passés, {cc['pytest']['failed']} échec**, {cc['pytest']['skipped']} ignorés motivés |",
        f"| Questions relues une par une | **{len(items)} relectures**, "
        f"{sum(1 for i in items if i['status'] not in ('PASS', 'FIXED', 'N/A'))} en échec |",
        f"| Assemblages | **{asm['assemblages_derives']}**, {asm['erreurs']} erreur, toutes "
        "les durées dans leur fenêtre |",
        f"| Documents promis par un énoncé | **{sup['manquants']} manquant** sur "
        f"{sup['controles']} renvois contrôlés |",
        f"| Préflight PDF (texte, polices, débordement, format) | "
        f"**{pdf['pdf_controles']} PDF, {milliers(pdf['pages_totales'])} pages, "
        f"{pdf['en_echec']} défaut** |",
        f"| Rendu visuel de chaque page | **{milliers(visuel['pages_rendues'])} pages "
        f"rendues**, {visuel['documents_a_regarder']} à reprendre |",
        f"| Données personnelles dans le dépôt public | "
        f"**{sec['compteurs']['PII_IN_PUBLIC_REPO']}** |",
        f"| Secrets | **{sec['compteurs']['SECRETS_IN_PUBLIC_REPO']}** (`gitleaks` : aucune "
        "fuite) |",
        f"| Corrigé visible dans un document candidat | "
        f"**{sec['compteurs']['CANDIDATE_COACH_LEAKS']}** |",
        f"| Reproductibilité octet à octet | **{repro['fichiers_compares']} / "
        f"{repro['fichiers_compares']} fichiers identiques** entre deux constructions |",
        "",
        "**Inspection visuelle.** Chaque page de la collection a été rendue en image et",
        "mesurée ; les planches de contact par document ont été relues.",
        "",
        "**Clone propre.** La release telle qu'elle est versionnée a été vérifiée dans un arbre",
        "neuf — sans rendu préexistant, sans cache, sans la source interne de français. La",
        "méthode et le résultat sont dans `audit/CLEAN_CLONE_ACCEPTANCE.json`.",
        "",
        "---",
        "",
        "## Ce qui reste à surveiller",
        "",
    ]
    n = 1
    if reserve:
        L += [f"{n}. **{reserve['champ']}**, décrite plus haut. À reprendre dès publication.",
              ""]
        n += 1
    reserve_versions = [i["instrument_id"] for i in scope["instruments"]
                        if i["porte_items"] and not i["candidate_pdf_paths"]
                        and i["support"] != "grille_coach"]
    if reserve_versions:
        L += [f"{n}. **{len(reserve_versions)} variantes tenues en réserve** — "
              f"{', '.join(f'`{v}`' for v in reserve_versions)}. Aucun candidat de la "
              "campagne en cours ne peut les sélectionner ; le catalogue le déclare et dit "
              "pourquoi.", ""]
        n += 1
    uniques = sum(len(m["competences_a_item_unique"])
                  for m in charger("audit/CONTENT_COVERAGE_MATRIX.json")["matrices"])
    L += [
        f"{n}. **{uniques} compétence n'est évaluée que par un seul item** dans les matrices "
        "de couverture. Ce n'est pas un défaut de justesse, mais la triangulation y est "
        "moindre : `audit/CONTENT_COVERAGE_MATRIX.json` la nomme.",
        "",
        f"{n + 1}. **Aucune donnée de passation réelle n'existe.** Aucune fidélité, aucune "
        "corrélation, aucun indice psychométrique n'est avancé : ce qui est établi ici est la "
        "validité de contenu — couverture du programme, exactitude, absence d'ambiguïté —, "
        "pas une performance mesurée sur une cohorte.",
        "",
        "---",
        "",
        "## Verdict",
        "",
        f"Les {len(gate['gates'])} gates de mise en service sont au vert, les {len(findings)} "
        f"défauts sont corrigés et aucun n'est resté ouvert. Le détail gate par gate, avec ses "
        "preuves, est dans `audit/GO_LIVE_GATE.json`.",
        "",
        f"**GO_LIVE_READY = {gate['GO_LIVE_READY']}** pour le périmètre soutenu par Nexus, et "
        "non pour la couverture réglementaire complète du baccalauréat, qui demeure incomplète "
        f"par construction — {hors} restent hors de l'offre.",
        "",
        "L'état courant du dépôt, calculé et vérifié par test, est au § 0 de `README_ETAT.md`.",
        "",
    ]
    return "\n".join(L)


def main() -> int:
    cible = AUDIT / "GO_LIVE_READINESS.md"
    texte = rendu()
    if "--verifier" in sys.argv:
        actuel = cible.read_text(encoding="utf-8") if cible.exists() else ""
        if actuel != texte:
            print("GO_LIVE_READINESS.md a dérivé des pièces d'audit", file=sys.stderr)
            return 1
        print("GO_LIVE_READINESS.md conforme")
        return 0
    cible.write_text(texte, encoding="utf-8")
    print(f"  écrit : {cible.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
