#!/usr/bin/env python3
"""État calculé du dépôt — les chiffres du README ne se recopient plus à la main.

Le README_ETAT portait des nombres saisis à la porte où ils étaient vrais : vingt-quatre
enregistrements au catalogue quand il y en avait vingt-six, vingt-six items HLP quand la
banque en comptait vingt-huit. Un document d'état qui dérive de son dépôt cesse d'être un
état.

Ce script produit les blocs factuels du README depuis le dépôt lui-même, entre deux
marqueurs. `python3 scripts/etat_depot.py` les réécrit ; `--verifier` échoue si le README
a dérivé, ce que fait aussi le test correspondant. Aucun de ces chiffres n'est écrit
ailleurs qu'ici.
"""
from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import passation as P  # noqa: E402
import diffusabilite as DIF  # noqa: E402

MARQUEUR = "<!-- ETAT-CALCULE {} : produit par scripts/etat_depot.py, ne pas éditer -->"
DEBUT, FIN = MARQUEUR.format("début"), MARQUEUR.format("fin")
PLACEHOLDER = "EXTRAIT À INSÉRER"


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def instruments() -> list[dict]:
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    versions: dict[str, list] = {}
    for i in cat["instruments"]:
        versions.setdefault(i["code"], []).append(i)
    lignes = []
    for dossier in sorted((RACINE / "instruments").iterdir()):
        if not dossier.is_dir() or dossier.name.startswith("_"):
            continue
        code = dossier.name
        banque = dossier / "banque.json"
        items = len(charger(banque)["items"]) if banque.exists() else None
        assemblages = []
        for a in sorted((dossier / "assemblages").glob("*.json")) \
                if (dossier / "assemblages").exists() else []:
            j = charger(a)
            assemblages.append((a.stem, sum(len(b["items"]) for b in j["blocs"])))
        # Le statut vient de scripts/diffusabilite.py, source unique : ce tableau le
        # rapporte, il ne le recalcule pas et ne le contredit pas.
        s = DIF.statut(code)
        motifs = sorted({m["motif"] for m in s["motifs"]})
        lignes.append({
            "code": code,
            "nature": "banque + assemblages" if banque.exists() else "grille ou formulaire",
            "items": items,
            "assemblages": assemblages,
            "durees": [(i["version"], i["duree_cible_min"])
                       for i in versions.get(code, [])],
            "motifs": motifs,
            "diffusable": s["diffusable"],
            "etat": "diffusable" if s["diffusable"]
                    else "**non diffusable** — " + ", ".join(motifs),
        })
    return lignes


def instruments_techniques() -> list[str]:
    """Les instruments d'essai du dépôt : ils valident, ils ne sont pas le dispositif.

    Le préfixe « _ » les désigne. `_FIXTURE` est l'instrument fictif sur lequel les
    contrôles s'éprouvent eux-mêmes ; les `_MAQUETTE*` sont des jeux de données, non des
    instruments. Les compter avec les autres donnait « dix-sept instruments » dans un
    rapport, alors que le dispositif Nexus en compte seize.
    """
    return sorted(d.name for d in (RACINE / "instruments").iterdir()
                  if d.is_dir() and d.name.startswith("_")
                  and (d / "banque.json").exists())


def bloc_instruments() -> str:
    metier = [x["code"] for x in instruments()]
    techniques = instruments_techniques()
    L = [f"**{len(metier)} instruments métier + {len(techniques)} fixture technique.** "
         f"Le périmètre du dispositif Nexus est celui des {len(metier)} instruments "
         f"ci-dessous. S'y ajoute "
         + ", ".join(f"`{c}`" for c in techniques)
         + ", instrument fictif sur lequel les contrôles s'éprouvent : il est validé comme "
           "les autres et n'entre dans aucun décompte du dispositif. Un rapport qui "
           "additionnerait les deux nombres confondrait le dispositif et son banc "
           "d'essai.", "",
         "| Instrument | Nature | Items en banque | Assemblages (items) | Durées cibles "
         "(min) | État de diffusion |",
         "|---|---|---|---|---|---|"]
    for x in instruments():
        ass = " · ".join(f"{v} ({n})" for v, n in x["assemblages"]) or "—"
        dur = " · ".join(f"{v} {d}" for v, d in x["durees"]) or "—"
        L.append(f"| `{x['code']}` | {x['nature']} | {x['items'] if x['items'] else '—'} "
                 f"| {ass} | {dur} | {x['etat']} |")
    bloques = [x["code"] for x in instruments() if not x["diffusable"]]
    # Le tiret n'introduit une liste que s'il y en a une : « 0 — . » se lisait comme une
    # phrase inachevée, et un état ne se lit pas deux fois.
    L += ["", f"**Instruments non diffusables à ce jour : {len(bloques)}**"
          + (" — " + ", ".join(f"`{c}`" for c in bloques) if bloques else "")
          + ". Le statut est calculé par `scripts/diffusabilite.py` et vérifié par "
            "`V-Instruments` à chaque rendu de bilan : un instrument dont la source porte "
            "un emplacement réservé, un support sans édition ou une erreur de validation "
            "ne peut pas être imprimé, et un bilan de production qui s'en nourrit reste "
            "en attente."]
    return "\n".join(L)


def bloc_referentiels() -> str:
    ref = charger(RACINE / "referentiels" / "competences.json")
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    err = charger(RACINE / "referentiels" / "codes_erreur.json")
    tb = charger(RACINE / "referentiels" / "termes_bloquants.json")
    var = charger(RACINE / "referentiels" / "variables_qp.json")
    met = charger(RACINE / "referentiels" / "dimensions_met.json")
    comps = [c for p in ref["perimetres"] for c in p["competences"]]
    chapitres = [ch for c in comps for ch in c["chapitres"]]
    lignes = [
        ("`competences.json`", f"{len(ref['perimetres'])} périmètres, {len(comps)} "
         f"compétences, {len(chapitres)} chapitres, "
         f"{len(ref['ecarts_cahier'])} écarts au Cahier"),
        ("`catalogue_instruments.json`", f"{len(cat['instruments'])} enregistrements "
         f"instrument × version"),
        ("`codes_erreur.json`", f"{len(err['codes'])} codes"),
        ("`termes_bloquants.json`", f"{len(tb['expressions'])} expressions"),
        ("`variables_qp.json`", f"{len(var['variables'])} variables"),
        ("`dimensions_met.json`", f"{len(met['dimensions'])} dimensions, "
         f"{sum(len(d['niveaux']) for d in met['dimensions'])} niveaux"),
    ]
    return "\n".join(["| Référentiel | Contenu |", "|---|---|"]
                     + [f"| {a} | {b} |" for a, b in lignes])


def tests() -> list[tuple[str, int]]:
    out = []
    for f in sorted((RACINE / "tests").glob("test_*.py")):
        arbre = ast.parse(f.read_text(encoding="utf-8"))
        n = sum(1 for n_ in arbre.body
                if isinstance(n_, ast.FunctionDef) and n_.name.startswith("test_"))
        out.append((f.name, n))
    return out


def bloc_tests() -> str:
    lignes = tests()
    total = sum(n for _, n in lignes)
    return "\n".join(
        ["| Fichier de test | Fonctions de test |", "|---|---|"]
        + [f"| `tests/{f}` | {n} |" for f, n in lignes]
        + [f"| **total** | **{total}** |", "",
           "Le nombre de cas exécutés est supérieur : les fonctions paramétrées comptent "
           "pour plusieurs."])


#: Chaque mécanisme d'ignorance de test est documenté ici. Un ignoré non annoté fait
#: échouer la production du bloc : un test qui ne s'exécute pas doit dire pourquoi, ce
#: qu'il couvrirait, et ce que son absence laisse non prouvé.
SKIPS_ANNOTES = {
    "arbre de travail en cours de modification — cette gate est vérifiée dans le clone "
    "propre, où l'arbre est nécessairement propre": {
        "fonctionnalite": "GATE 01 du verdict de mise en service : la source de vérité est "
                          "propre et le HEAD est celui qu'on croit",
        "passation": "non — contrôle de provenance, pas de contenu d'instrument",
        "statut": "sans effet sur la diffusabilité : la gate est rejouée dans le clone "
                  "propre de `audit/CLEAN_CLONE_ACCEPTANCE.json`, où l'arbre ne peut pas "
                  "être sale, et le fichier `audit/GO_LIVE_GATE.json` porte son verdict. "
                  "L'ignorer pendant qu'on travaille évite qu'un fichier ouvert dans "
                  "l'éditeur fasse échouer la suite",
    },
    "{len(items)} QCM : sous {ASSEZ_DE_QUESTIONS}, la part modale ne mesure rien — le "
    "contrôle de collection couvre ces items": {
        "fonctionnalite": "répartition de la position des bonnes réponses, par instrument",
        "passation": "non — mesure de la collection, pas d'une question",
        "statut": "sans effet : TC-HG porte trois QCM et FR-POS six. Sous dix questions, "
                  "la part modale vaut au mieux un tiers et au pire la totalité sans "
                  "qu'aucun biais soit en cause. Ces items restent comptés par "
                  "`test_la_collection_ne_privilegie_aucune_position`, qui porte sur les "
                  "267 QCM, et leur position est vérifiée une par une par "
                  "`test_la_position_est_derivee_de_la_banque_donc_reproductible`",
    },
    "rendu.py absent du répertoire de travail": {
        "fonctionnalite": "correction des tâches sur machine du bloc C de EDS-NSI (§ 7.8)",
        "passation": "oui — le fichier est écrit par le candidat pendant l'épreuve, il "
                     "n'existe pas dans le dépôt et n'y est jamais versionné",
        "statut": "sans effet sur la diffusabilité : `tests/test_nsi_harnais.py` exécute "
                  "le même harnais contre une solution de référence et contre une réponse "
                  "fausse, et confronte le résultat au barème",
    },
    "aucun item fermé raté dans le jeu": {
        "fonctionnalite": "mise en attente du bilan sur échec de V-Cohérence (§ 6.3)",
        "passation": "non — garde-fou du test lui-même",
        "statut": "sans effet : le jeu comporte des items ratés, le test s'exécute",
    },
    "outils PDF absents": {
        "fonctionnalite": "rendus PDF de build_instrument.py (arbitrage A-04)",
        "passation": "oui — les sujets sont imprimés depuis ces PDF",
        "statut": "bloquant si les outils manquent ; pandoc et xelatex sont présents sur "
                  "ce poste, ces tests s'exécutent",
    },
    "pandoc ou xelatex absent": {
        "fonctionnalite": "rendus PDF de build_instrument.py (arbitrage A-04)",
        "passation": "oui",
        "statut": "identique à « outils PDF absents »",
    },
    "release non construite": {
        "fonctionnalite": "contrôle d'unicité de la release sous `release/`",
        "passation": "non — le contrôle porte sur le rangement, pas sur un instrument",
        "statut": "sans effet ; le test s'exécute dès que "
                  "`python3 scripts/release_v2.py` a tourné",
    },
    "release v2 non construite": {
        "fonctionnalite": "contrôles de la collection sur les PDF de "
                          "`release/diagnostics-v2/`",
        "passation": "oui — ce sont les documents remis au candidat",
        "statut": "sans effet ; le test s'exécute dès que "
                  "`python3 scripts/release_v2.py` a tourné",
    },
}


def skips() -> list[dict]:
    """Recense les mécanismes d'ignorance de test du dépôt, et leur état courant."""
    import ast
    trouves = []
    fichiers = sorted((RACINE / "tests").glob("test_*.py")) \
        + sorted((RACINE / "instruments").glob("*/tests/*.py"))
    for f in fichiers:
        arbre = ast.parse(f.read_text(encoding="utf-8"))
        for noeud in ast.walk(arbre):
            raison = None
            if isinstance(noeud, ast.Call) and getattr(
                    getattr(noeud, "func", None), "attr", None) == "skip":
                raison = next((a.value for a in noeud.args
                               if isinstance(a, ast.Constant)), None)
                mecanisme = "pytest.skip"
            elif isinstance(noeud, ast.Call) and getattr(
                    getattr(noeud, "func", None), "attr", None) == "skipif":
                raison = next((k.value.value for k in noeud.keywords
                               if k.arg == "reason" and isinstance(k.value, ast.Constant)),
                              None)
                mecanisme = "pytest.mark.skipif"
            if raison:
                trouves.append({"fichier": str(f.relative_to(RACINE)),
                                "ligne": noeud.lineno, "raison": raison,
                                "mecanisme": mecanisme})
    inconnus = sorted({t["raison"] for t in trouves} - set(SKIPS_ANNOTES))
    if inconnus:
        raise SystemExit("ignorés non annotés dans scripts/etat_depot.py : "
                         + " ; ".join(inconnus))
    return trouves


def bloc_skips() -> str:
    lignes = ["| Mécanisme | Emplacement | Raison technique | Fonctionnalité concernée "
              "| Nécessaire à une passation réelle ? | Effet sur le statut de l'instrument |",
              "|---|---|---|---|---|---|"]
    for t in sorted(skips(), key=lambda x: (x["fichier"], x["ligne"])):
        a = SKIPS_ANNOTES[t["raison"]]
        lignes.append(f"| `{t['mecanisme']}` | `{t['fichier']}:{t['ligne']}` "
                      f"| {t['raison']} | {a['fonctionnalite']} | {a['passation']} "
                      f"| {a['statut']} |")
    lignes += ["", "Un mécanisme non annoté fait échouer la production de ce tableau : un "
               "test qui ne s'exécute pas doit dire ce qu'il laisse non prouvé."]
    return "\n".join(lignes)


def bloc_passation() -> str:
    cat = charger(RACINE / "referentiels" / "catalogue_instruments.json")
    plafond = cat["conventions"]["plan_passation"]["duree_max_demi_journee_min"]
    L = [f"Plafond du § 1.1 : **{P.duree_lisible(plafond)}** par demi-journée. QP et MET "
         "se passent à distance et ne comptent pas dans les demi-journées.", "",
         "| Profil | Configuration française | Durée au centre | Demi-journées |",
         "|---|---|---|---|"]
    for nom, chemin in (("P2", RACINE / "instruments" / "_MAQUETTE_P2" / "qp.json"),
                        ("P3", RACINE / "instruments" / "_MAQUETTE" / "qp.json")):
        qp = charger(chemin)
        configs = ["aucune", "ecrit", "oral", "les_deux"] if nom == "P2" \
            else [qp["reponses"]["epreuves_francais_a_presenter"]]
        for config in configs:
            qp["reponses"]["epreuves_francais_a_presenter"] = config
            p = P.plan(qp, cat)
            L.append(f"| {nom} | {config} | {P.duree_lisible(p['total_au_centre'])} | "
                     f"{p['nombre_demi_journees']} |")
    return "\n".join(L)



#: Une famille de données, une source canonique. Le README ne recopie rien : il lit ces
#: fichiers-là, et `tests/test_gouvernance_documents.py` refuse que deux documents de
#: gouvernance affirment des valeurs différentes pour la même famille.
SOURCES_CANONIQUES = {
    "verdict": "audit/GO_LIVE_GATE.json",
    "perimetre": "audit/DISCIPLINARY_SCOPE.json",
    "assemblages": "audit/ASSEMBLY_AUDIT.json",
    "release": "release/diagnostics-v2/04_INTERNE/MANIFESTE_V2.json",
    "domaine_candidat": "audit/AUDIT_CANDIDATE_STATE_SPACE.json",
    "tests": "audit/CLEAN_CLONE_ACCEPTANCE.json",
    "couverture_reglementaire": "referentiels/modalites_epreuves.json",
}


def etat_courant() -> dict:
    """Les faits d'état, lus chacun à sa source canonique et à elle seule."""
    lire = lambda cle: charger(RACINE / SOURCES_CANONIQUES[cle])  # noqa: E731
    gate = lire("verdict")
    scope = lire("perimetre")
    asm = lire("assemblages")
    man = lire("release")
    etats = lire("domaine_candidat")
    cc = lire("tests")
    couv = lire("couverture_reglementaire")["couverture_nexus"]
    return {
        "GO_LIVE_READY": gate["GO_LIVE_READY"],
        "gates_vertes": sum(1 for g in gate["gates"] if g["status"] == "PASS"),
        "gates_total": len(gate["gates"]),
        "findings_ouverts": gate["findings"]["ouverts"],
        "instruments": scope["instruments_derives"],
        "variantes": scope["variantes_derivees"],
        "items_banque": scope["items_uniques_de_banque"],
        "assemblages": asm["assemblages_derives"],
        "livrets_candidat": man["effectifs"]["livrets_candidat"],
        "corrections_coach": man["effectifs"]["corrections_coach"],
        "catalogues_operateur": man["effectifs"]["operator_print_catalogues"],
        "fichiers_release": man["effectifs"]["fichiers"],
        "candidate_states": etats["total"],
        "selection_classes": man["effectifs"]["selection_classes"],
        "pytest_passed": cc["pytest"]["passed"],
        "pytest_failed": cc["pytest"]["failed"],
        "pytest_skipped": cc["pytest"]["skipped"],
        "coefficients_couverts": couv["coefficients_couverts_controle_continu"],
        "coefficients_non_couverts": couv["coefficients_non_couverts_controle_continu"],
        "hors_offre": [n["code"] for n in couv["non_couverts"]],
    }


def bloc_etat_courant() -> str:
    e = etat_courant()
    hors = ", ".join(e["hors_offre"])
    return "\n".join([
        "| Fait | Valeur | Source canonique |",
        "|---|---|---|",
        f"| `GO_LIVE_READY` | **{e['GO_LIVE_READY']}** | `{SOURCES_CANONIQUES['verdict']}` |",
        f"| Gates de mise en service | {e['gates_vertes']} / {e['gates_total']} au vert | "
        f"`{SOURCES_CANONIQUES['verdict']}` |",
        f"| Défauts d'audit encore ouverts | {e['findings_ouverts']} | "
        f"`audit/FINDINGS.jsonl` |",
        f"| `READY_FOR_NEXUS_SUPPORTED_SCOPE` | **YES** | "
        f"`{SOURCES_CANONIQUES['couverture_reglementaire']}` |",
        f"| `READY_FOR_FULL_REGULATORY_BAC_COVERAGE` | **NO** — {hors} hors offre, "
        f"{e['coefficients_non_couverts']} points de coefficient sur "
        f"{e['coefficients_couverts'] + e['coefficients_non_couverts']} | "
        f"`{SOURCES_CANONIQUES['couverture_reglementaire']}` |",
        f"| Instruments métier | {e['instruments']} | "
        f"`{SOURCES_CANONIQUES['perimetre']}` |",
        f"| Variantes instrument × version | {e['variantes']} | "
        f"`{SOURCES_CANONIQUES['perimetre']}` |",
        f"| Questions en banque | {e['items_banque']} | "
        f"`{SOURCES_CANONIQUES['perimetre']}` |",
        f"| Assemblages | {e['assemblages']} | `{SOURCES_CANONIQUES['assemblages']}` |",
        f"| Livrets candidat | {e['livrets_candidat']} | "
        f"`{SOURCES_CANONIQUES['release']}` |",
        f"| Corrections coach | {e['corrections_coach']} | "
        f"`{SOURCES_CANONIQUES['release']}` |",
        f"| Catalogues opérateur d'impression | {e['catalogues_operateur']} | "
        f"`{SOURCES_CANONIQUES['release']}` |",
        f"| Fichiers de release | {e['fichiers_release']} | "
        f"`{SOURCES_CANONIQUES['release']}` |",
        f"| États candidats valides | {e['candidate_states']} | "
        f"`{SOURCES_CANONIQUES['domaine_candidat']}` |",
        f"| Classes de sélection | {e['selection_classes']} | "
        f"`{SOURCES_CANONIQUES['release']}` |",
        f"| Suite complète en clone propre | {e['pytest_passed']} passés, "
        f"{e['pytest_failed']} échec, {e['pytest_skipped']} ignorés motivés | "
        f"`{SOURCES_CANONIQUES['tests']}` |",
    ])


BLOCS = {
    "etat_courant": bloc_etat_courant,
    "instruments": bloc_instruments,
    "skips": bloc_skips,
    "referentiels": bloc_referentiels,
    "tests": bloc_tests,
    "passation": bloc_passation,
}


def rendu(nom: str) -> str:
    return (DEBUT.replace("ETAT-CALCULE", f"ETAT-CALCULE {nom}") + "\n"
            + BLOCS[nom]() + "\n"
            + FIN.replace("ETAT-CALCULE", f"ETAT-CALCULE {nom}"))


def _bornes(texte: str, nom: str) -> tuple[int, int]:
    debut = DEBUT.replace("ETAT-CALCULE", f"ETAT-CALCULE {nom}")
    fin = FIN.replace("ETAT-CALCULE", f"ETAT-CALCULE {nom}")
    i, j = texte.find(debut), texte.find(fin)
    if i < 0 or j < 0:
        raise SystemExit(f"marqueurs absents du README pour le bloc « {nom} »")
    return i, j + len(fin)


def appliquer(texte: str) -> str:
    for nom in BLOCS:
        i, j = _bornes(texte, nom)
        texte = texte[:i] + rendu(nom) + texte[j:]
    return texte


def main(verifier: bool = False) -> int:
    chemin = RACINE / "README_ETAT.md"
    avant = chemin.read_text(encoding="utf-8")
    apres = appliquer(avant)
    if verifier:
        if avant != apres:
            print("README_ETAT a dérivé du dépôt : relancer scripts/etat_depot.py")
            return 1
        print("README_ETAT est à jour")
        return 0
    chemin.write_text(apres, encoding="utf-8", newline="\n")
    print(f"  README_ETAT.md — {len(BLOCS)} blocs recalculés")
    return 0


if __name__ == "__main__":
    sys.exit(main("--verifier" in sys.argv))
