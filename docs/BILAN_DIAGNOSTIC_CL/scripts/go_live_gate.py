#!/usr/bin/env python3
"""Les douze gates du GO LIVE, dérivées des pièces d'audit — jamais saisies.

Un verdict écrit à la main ne prouve que la main qui l'a écrit. Chaque gate ci-dessous
lit l'artefact qui la fonde et recalcule son état. `--verifier` échoue si le fichier
versionné a dérivé de ce que le dépôt porte aujourd'hui.

    python3 scripts/go_live_gate.py              # écrit audit/GO_LIVE_GATE.json
    python3 scripts/go_live_gate.py --verifier   # compare sans écrire, code 1 si dérive
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
AUDIT = RACINE / "audit"
V2 = RACINE / "release" / "diagnostics-v2"


def charger(nom: str) -> dict:
    return json.loads((AUDIT / nom).read_text(encoding="utf-8"))


def jsonl(nom: str) -> list[dict]:
    p = AUDIT / nom
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=RACINE, capture_output=True,
                          text=True).stdout.strip()


def gates() -> dict:
    scope = charger("DISCIPLINARY_SCOPE.json")
    asm = charger("ASSEMBLY_AUDIT.json")
    sup = charger("SUPPORT_AUDIT.json")
    pdf = charger("PDF_VISUAL_QA.json")
    visuel = charger("PDF_VISUAL_RENDER.json")
    sec = charger("SECURITY_SCAN.json")
    repro = charger("RELEASE_REPRODUCIBILITY.json")
    registre = charger("REGULATORY_SOURCE_REGISTER.json")
    items = jsonl("ITEM_AUDIT.jsonl")
    findings = jsonl("FINDINGS.jsonl")
    couverture = charger("CONTENT_COVERAGE_MATRIX.json")
    manifeste = json.loads((V2 / "04_INTERNE" / "MANIFESTE_V2.json").read_text(encoding="utf-8"))
    etats = charger("AUDIT_CANDIDATE_STATE_SPACE.json")

    ouverts = [f for f in findings if f["status"] != "FIXED"]
    par_severite = {s: sum(1 for f in ouverts if f["severity"] == s)
                    for s in ("BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO")}
    items_en_echec = [i for i in items if i["status"] not in ("PASS", "FIXED", "N/A")]
    sale = git("status", "--porcelain", "--", ".")

    G = []

    def gate(n, titre, ok, **preuves):
        G.append({"gate": f"GATE {n:02d}", "titre": titre,
                  "status": "PASS" if ok else "FAIL", "preuves": preuves})

    # La propreté de l'arbre de travail est une propriété de l'endroit où l'on se tient,
    # pas du dépôt : elle est fausse tant qu'un fichier est ouvert dans l'éditeur, et
    # vraie par construction dans un arbre fraîchement extrait. La gate porte donc sur ce
    # qui est stable — le commit audité a bien été extrait proprement, et le manifeste de
    # release désigne un commit de cette branche — et l'état courant de l'arbre est joint
    # comme observation, non comme verdict. Sans quoi le fichier versionné ne pouvait être
    # juste ni pendant qu'on travaille, ni dans le clone propre.
    clean = AUDIT / "CLEAN_CLONE_ACCEPTANCE.json"
    cc = json.loads(clean.read_text(encoding="utf-8")) if clean.exists() else {}
    extraction_propre = cc.get("environnement_initial", {}).get("arbre_git_propre") is True
    gate(1, "Git / source de vérité",
         extraction_propre and git("rev-parse", "HEAD") != "",
         extraction_du_commit_audite_propre=extraction_propre,
         arbre_de_travail_courant_propre=sale == "",
         chemins_sales=[l for l in sale.splitlines()][:10],
         branche=git("rev-parse", "--abbrev-ref", "HEAD"),
         head=git("rev-parse", "HEAD"))

    clean = AUDIT / "CLEAN_CLONE_ACCEPTANCE.json"
    cc = json.loads(clean.read_text(encoding="utf-8")) if clean.exists() else {}
    gate(2, "Clone propre / reproductibilité",
         bool(cc) and cc.get("pytest", {}).get("failed") == 0
         and all(v == 0 for v in cc.get("verificateurs", {}).values())
         and repro["BYTE_REPRODUCIBLE"] == "YES",
         clean_clone=cc or "non exécuté",
         pytest_echecs=cc.get("pytest", {}).get("failed"),
         pytest_passes=cc.get("pytest", {}).get("passed"),
         byte_reproducible=repro["BYTE_REPRODUCIBLE"],
         fichiers_compares=repro["fichiers_compares"])

    non_etayees = registre["affirmations_non_etayees"]
    gate(3, "Réglementation",
         not non_etayees,
         textes_verifies=len(registre["textes"]),
         affirmations_non_etayees=len(non_etayees),
         incertitudes_declarees=[i["champ"] for i in registre["incertitudes_declarees"]])

    couv = charger("AUDIT_CANDIDATE_COVERAGE.json")
    invalides = charger("AUDIT_INVALID_STATE_COVERAGE.json")
    gate(4, "Domaine candidat",
         etats["total"] > 0 and len(etats["etats"]) == etats["total"],
         etats_candidats=etats["total"],
         etats_enumeres=len(etats["etats"]),
         signatures_de_selection=len(etats.get("signatures", [])),
         classes_de_selection=manifeste["effectifs"]["selection_classes"],
         familles_de_faits_refusees=len(invalides.get("familles", invalides.get("cas", []))),
         classes_d_equivalence=len(couv.get("classes", couv.get("couverture", []))))

    # Une version sans livret est un défaut, sauf si le catalogue déclare qu'aucun
    # candidat de la campagne en cours ne peut la sélectionner — et dit pourquoi.
    catalogue = json.loads(
        (RACINE / "referentiels/catalogue_instruments.json").read_text(encoding="utf-8"))
    reserve = {f"{e['code']}/{e['version']}" for e in catalogue["instruments"]
               if e.get("statut_de_service") == "reserve_campagne_suivante"
               and e.get("motif_de_reserve")}
    sans_livret = [i for i in scope["instruments"]
                   if i["porte_items"] and not i["candidate_pdf_paths"]
                   and i["support"] != "grille_coach"
                   and i["instrument_id"] not in reserve]
    gate(5, "Couverture des instruments",
         not scope["codes_sans_dossier"] and not scope["dossiers_hors_catalogue"]
         and not sans_livret,
         instruments=scope["instruments_derives"],
         variantes=scope["variantes_derivees"],
         items_uniques=scope["items_uniques_de_banque"],
         instruments_sans_livret=[i["instrument_id"] for i in sans_livret],
         versions_en_reserve_declaree=sorted(reserve))

    gate(6, "Validité disciplinaire des items",
         not items_en_echec and len(items) >= scope["items_uniques_de_banque"],
         items_audites=len(items),
         items_en_banque=scope["items_uniques_de_banque"],
         items_en_echec=[i["item_id"] for i in items_en_echec],
         corriges=sum(1 for i in items if i["status"] == "FIXED"))

    cles = [i for i in items if i.get("answer_key_correct") == "FAIL"
            and i["status"] not in ("FIXED",)]
    baremes = [i for i in items if i.get("grading_valid") == "FAIL"
               and i["status"] not in ("FIXED",)]
    gate(7, "Corrigés / barèmes",
         not cles and not baremes,
         cles_fausses_restantes=len(cles), baremes_faux_restants=len(baremes),
         cles_corrigees=sum(1 for i in items if i.get("answer_key_correct") == "FAIL"),
         baremes_corriges=sum(1 for i in items if i.get("grading_valid") == "FAIL"))

    hors_fenetre = [f"{l['instrument']}/{l['version']}" for l in asm["assemblages"]
                    if l["duration_within_window"] is False]
    gate(8, "Assemblages / durées",
         asm["erreurs"] == 0 and not hors_fenetre,
         assemblages=asm["assemblages_derives"], erreurs=asm["erreurs"],
         hors_fenetre_de_duree=hors_fenetre,
         supports_manquants=sup["manquants"])

    gate(9, "PDF / rendu visuel",
         pdf["en_echec"] == 0 and visuel["documents_a_regarder"] == 0,
         pdf_controles=pdf["pdf_controles"], pages=pdf["pages_totales"],
         preflight_en_echec=pdf["en_echec"],
         pages_rendues=visuel["pages_rendues"],
         documents_a_regarder=visuel["documents_a_regarder"])

    packs = sorted((AUDIT / "golden_packs").glob("*.json"))
    gate(10, "Packs candidats / distribution",
         len(packs) >= 11,
         packs_temoins=len(packs),
         livrets_candidat=manifeste["effectifs"]["livrets_candidat"],
         corrections_coach=manifeste["effectifs"]["corrections_coach"],
         packs_impression=manifeste["effectifs"]["packs_impression"])

    c = sec["compteurs"]
    gate(11, "Sécurité / confidentialité / PII",
         all(v == 0 for v in c.values()) and not sec["exports_candidats_suivis"]
         and not sec["source_privee_frpos_suivie"] and not sec["pdf_dans_04_INTERNE"]
         and not sec["coach_dans_01_LIVRETS_CANDIDAT"],
         **c,
         exports_nominatifs_suivis=len(sec["exports_candidats_suivis"]),
         source_privee_suivie=sec["source_privee_frpos_suivie"])

    parent = git("rev-parse", "HEAD^")
    gate(12, "Release / provenance finale",
         manifeste["source_git_head"] in (parent, git("rev-parse", "HEAD")),
         manifeste_source_git_head=manifeste["source_git_head"],
         head=git("rev-parse", "HEAD"), parent=parent,
         fichiers_de_release=manifeste["effectifs"]["fichiers"],
         blockers_ouverts=par_severite["BLOCKER"],
         majors_ouverts=par_severite["MAJOR"])

    echecs = [g["gate"] for g in G if g["status"] != "PASS"]
    return {
        "schema": "go_live/gate/1.0",
        "date": "2026-09-15",
        "branche": git("rev-parse", "--abbrev-ref", "HEAD"),
        "GO_LIVE_READY": "YES" if not echecs and not ouverts else "NO",
        "gates_en_echec": echecs,
        "findings": {"total": len(findings), "ouverts": len(ouverts),
                     "par_severite_ouverts": par_severite},
        "compteurs": {
            "ITEMS_AUDITED": len(items),
            "ITEMS_FAILED": len(items_en_echec),
            "ASSEMBLIES_AUDITED": asm["assemblages_derives"],
            "ASSEMBLY_ERRORS": asm["erreurs"],
            "MISSING_SUPPORTS": sup["manquants"],
            "PDF_RENDER_ERRORS": pdf["en_echec"],
            "PII_IN_PUBLIC_REPO": c["PII_IN_PUBLIC_REPO"],
            "SECRETS_IN_PUBLIC_REPO": c["SECRETS_IN_PUBLIC_REPO"],
            "CANDIDATE_COACH_LEAKS": c["CANDIDATE_COACH_LEAKS"],
            "BYTE_REPRODUCIBLE": repro["BYTE_REPRODUCIBLE"],
            "COMPETENCES_A_ITEM_UNIQUE": sum(
                len(m["competences_a_item_unique"]) for m in couverture["matrices"]),
        },
        "gates": G,
    }


#: Les champs qui changent d'un commit à l'autre sans que rien n'ait bougé dans l'état du
#: dépôt : l'empreinte du commit courant, celle de son parent, la liste des chemins
#: modifiés. Ils sont consignés comme preuve datée, mais les comparer ferait dériver le
#: fichier à chaque commit — la release étant commitée après les sources, l'empreinte du
#: HEAD a nécessairement changé entre l'écriture du fichier et sa vérification.
#: « branche » en fait partie : un arbre extrait en HEAD détaché — ce qu'est un clone de
#: vérification — n'en porte aucune, et `git rev-parse --abbrev-ref HEAD` y répond « HEAD ».
VOLATILS = {"head", "parent", "branche", "chemins_sales", "manifeste_source_git_head",
            "arbre_de_travail_courant_propre", "clean_clone"}


def stable(d: dict) -> dict:
    """Le verdict, débarrassé de ce qui ne fait que dater sa production."""
    return {
        "GO_LIVE_READY": d["GO_LIVE_READY"],
        "gates_en_echec": d["gates_en_echec"],
        "findings": d["findings"],
        "compteurs": d["compteurs"],
        "gates": [{"gate": g["gate"], "titre": g["titre"], "status": g["status"],
                   "preuves": {k: v for k, v in g["preuves"].items()
                               if k not in VOLATILS}}
                  for g in d["gates"]],
    }


def main() -> int:
    d = gates()
    cible = AUDIT / "GO_LIVE_GATE.json"
    rendu = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    if "--verifier" in sys.argv:
        if not cible.exists():
            print("GO_LIVE_GATE.json absent", file=sys.stderr)
            return 1
        versionne = json.loads(cible.read_text(encoding="utf-8"))
        if stable(versionne) != stable(d):
            print("GO_LIVE_GATE.json a dérivé de l'état du dépôt", file=sys.stderr)
            for g_v, g_d in zip(versionne["gates"], d["gates"]):
                if stable({"GO_LIVE_READY": "", "gates_en_echec": [], "findings": {},
                           "compteurs": {}, "gates": [g_v]})["gates"] != \
                   stable({"GO_LIVE_READY": "", "gates_en_echec": [], "findings": {},
                           "compteurs": {}, "gates": [g_d]})["gates"]:
                    print(f"  {g_v['gate']} : {g_v['status']} → {g_d['status']}",
                          file=sys.stderr)
            return 1
        print("GO_LIVE_GATE.json conforme")
        return 0
    cible.write_text(rendu, encoding="utf-8")
    for g in d["gates"]:
        print(f"  {g['gate']}  {g['status']:4s}  {g['titre']}")
    print(f"\nGO_LIVE_READY = {d['GO_LIVE_READY']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
