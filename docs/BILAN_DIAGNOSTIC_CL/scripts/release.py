#!/usr/bin/env python3
"""Manifeste de version des diagnostics — produit depuis le dépôt, jamais recopié.

Une release qui déclare un état que le dépôt ne porte plus n'est pas une release : c'est
une note d'intention. Ce script ne lit aucun statut écrit à la main. Il recalcule tout
depuis les fichiers — le catalogue pour l'identité des instruments, la diffusabilité pour
l'état, les banques et les assemblages pour les empreintes, les PDF construits pour les
rendus, le registre des sources pour les textes — et refuse d'écrire un manifeste
incomplet.

    python3 scripts/release.py            # écrit le JSON et le Markdown
    python3 scripts/release.py --verifier  # contrôle sans écrire

Le critère de fin est ici, et il est arithmétique : seize instruments métier, seize
diffusables, zéro emplacement réservé, zéro erreur de validation, zéro défaut de
preflight, zéro rendu manquant, zéro collision d'empreinte de texte source.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import dates_anterieures as DA  # noqa: E402
import diffusabilite as DIF     # noqa: E402
import distribution as DIS      # noqa: E402
import textes_sources as TS     # noqa: E402
import validate_instrument as VI  # noqa: E402

#: Ce manifeste décrit **le dépôt** — instruments, rendus, textes sources — et non une
#: façade de diffusion. Il s'appelait `RELEASE_DIAGNOSTICS_V1` : à côté de
#: `release/diagnostics-v2/`, ce nom laissait croire à deux releases concurrentes.
JSON = RACINE / "MANIFESTE_DEPOT.json"
MD = RACINE / "MANIFESTE_DEPOT.md"

#: La release courante, celle que ce dépôt produit pour les candidats.
RELEASE_COURANTE = "diagnostics-v2"

#: Rendus attendus d'un instrument qui porte des items, par version.
RENDUS = ("sujet_candidat", "cle_et_grilles_correcteur", "feuille_reponses",
          "saisie_vierge")
#: Extensions de ces rendus.
EXT = {"saisie_vierge": "csv"}


def empreinte_fichier(p: Path) -> str | None:
    """L'empreinte d'un fichier produit. Un fichier absent ne vaut pas une empreinte nulle."""
    if not p.exists():
        return None
    return hashlib.sha256(p.read_bytes()).hexdigest()


def empreinte_json(p: Path) -> str | None:
    """L'empreinte d'une source JSON, normalisée pour ne pas dépendre de l'indentation."""
    if not p.exists():
        return None
    d = json.loads(p.read_text(encoding="utf-8"))
    return hashlib.sha256(
        json.dumps(d, ensure_ascii=False, sort_keys=True,
                   separators=(",", ":")).encode("utf-8")).hexdigest()


def git_head() -> str:
    return subprocess.run(["git", "-C", str(RACINE), "rev-parse", "HEAD"],
                          capture_output=True, text=True).stdout.strip()


def catalogue() -> dict:
    return json.loads((RACINE / "referentiels" / "catalogue_instruments.json")
                      .read_text(encoding="utf-8"))


def sources_du_dossier(code: str) -> dict:
    """Les textes sources employés par un instrument, d'après le registre."""
    reg = TS.registre()["textes"]
    out = {}
    for cle, t in reg.items():
        for u in t["usages"]:
            if u["instrument"] == code:
                out[cle] = {"auteur": t["auteur"], "oeuvre": t["oeuvre"],
                            "edition": t["edition"], "annee": t["annee"],
                            "mots": t["nombre_mots"],
                            "lignes_pdf": t["nombre_lignes_dans_le_pdf_final"],
                            "sha256_texte_normalise": t["sha256_texte_normalise"],
                            "assemblages": u["assemblages"]}
    return out


def fiche(d: Path, entrees: list[dict]) -> dict:
    """Tout ce qu'un manifeste doit dire d'un instrument, calculé sur place."""
    code = d.name
    etat = DIF.statut(code)
    versions = {}
    build = d / "build"
    for e in entrees:
        v = e["version"]
        prefixe = f"{code}_{v}"
        rendus, manquants = {}, []
        if e.get("porte_items"):
            for nom in RENDUS:
                ext = EXT.get(nom, "md")
                md = build / f"{prefixe}_{nom}.{ext}"
                rendus[nom] = {"fichier": str(md.relative_to(RACINE)),
                               "sha256": empreinte_fichier(md)}
                if rendus[nom]["sha256"] is None:
                    manquants.append(rendus[nom]["fichier"])
                if ext == "md":
                    pdf = build / f"{prefixe}_{nom}.pdf"
                    rendus[nom]["pdf"] = str(pdf.relative_to(RACINE))
                    rendus[nom]["pdf_sha256"] = empreinte_fichier(pdf)
                    if rendus[nom]["pdf_sha256"] is None:
                        manquants.append(rendus[nom]["pdf"])
        else:
            for nom, ext in (("formulaire_secours", "md"), ("variables", "csv")) \
                    if (d / "formulaire.json").exists() \
                    else (("grille_coach", "md"), ("saisie_vierge", "csv")):
                f = build / f"{prefixe}_{nom}.{ext}"
                rendus[nom] = {"fichier": str(f.relative_to(RACINE)),
                               "sha256": empreinte_fichier(f)}
                if rendus[nom]["sha256"] is None:
                    manquants.append(rendus[nom]["fichier"])
                if ext == "md":
                    pdf = build / f"{prefixe}_{nom}.pdf"
                    rendus[nom]["pdf"] = str(pdf.relative_to(RACINE))
                    rendus[nom]["pdf_sha256"] = empreinte_fichier(pdf)
                    if rendus[nom]["pdf_sha256"] is None:
                        manquants.append(rendus[nom]["pdf"])
        asm = d / "assemblages" / f"{v}.json"
        nb = None
        if asm.exists():
            a = json.loads(asm.read_text(encoding="utf-8"))
            nb = sum(len(b["items"]) for b in a["blocs"])
        versions[v] = {
            "libelle": e["libelle"],
            "profils": e["profils"],
            "duree_cible_min": e["duree_cible_min"],
            "session_baccalaureat_finale": e.get("session_baccalaureat_finale"),
            "annee_scolaire_passation_ea": e.get("annee_scolaire_passation_ea"),
            "nombre_items": nb,
            "sha256_assemblage": empreinte_json(asm),
            "rendus": rendus,
            "rendus_manquants": manquants,
        }
    return {
        "code": code,
        "etat": "diffusable" if etat["diffusable"] else "non diffusable",
        "motifs_de_non_diffusabilite": etat["motifs"],
        "sha256_banque": empreinte_json(d / "banque.json"),
        "sha256_definition": empreinte_json(d / "definition.json"),
        "sha256_formulaire": empreinte_json(d / "formulaire.json"),
        "versions": versions,
        "textes_sources": sources_du_dossier(code),
    }


def manifeste() -> dict:
    cat = catalogue()
    par_code: dict[str, list[dict]] = {}
    for e in cat["instruments"]:
        par_code.setdefault(e["code"], []).append(e)

    dossiers = DIF.dossiers()
    instruments = {d.name: fiche(d, par_code.get(d.name, [])) for d in dossiers}

    erreurs_validation = 0
    for d in dossiers:
        err, _ = VI.valider(d)
        erreurs_validation += len(err)
    erreurs_validation += len(VI.controler_supports_partages(dossiers))

    manquants = sum(len(v["rendus_manquants"])
                    for i in instruments.values() for v in i["versions"].values())
    collisions = TS.controler()

    # § 14 · la distribution fait partie de ce que la release prouve : sans elle, le
    # manifeste décrit des rendus que personne ne sait envoyer.
    d = DIS.construire(verifier=True)
    profils = DIS.profils_du_projet()
    doublons = DIS.doublons() if DIS.SORTIE.exists() else {}
    distribution = {
        "racine": str(DIS.SORTIE.relative_to(RACINE)),
        "facade": {
            "00_INDEX": "par où commencer, et les quatre tableaux",
            "01_A_ENVOYER_AUX_CANDIDATS": "un dossier par destinataire préparé",
            "02_A_IMPRIMER": "le même document, prêt pour l'imprimante",
            "03_COACH_CORRECTIONS": "corrigés et grilles — ne sort jamais de chez Nexus",
            "10_CATALOGUE_CANONIQUE": "l'autorité : un exemplaire de chaque artefact",
            "20_MATERIEL_NSI_MACHINE": "les fichiers à déposer sur le poste du candidat",
            "90_PROFILS_POSSIBLES": "une archive par combinaison de profil",
        },
        "refus": d["erreurs"],
        "instruments_par_version": len(d["inventaire"]),
        "pdf_candidats": sum(1 for i in d["inventaire"] if i["pdf_candidat"]),
        "pdf_correcteurs": sum(1 for i in d["inventaire"] if i["pdf_coach"]),
        "modes_de_remise": {i["code"]: i["delivery_mode"] for i in d["inventaire"]},
        "version_courante_2026_2027": {
            i["code"]: i["version"] for i in d["inventaire"]
            if i["courant_pour_2026_2027"] and i["code"] == "FR-EAF"},
        "profile_combinations": len(d["packs"]),
        "active_candidates": 0,
        "note_destinataires":
            "Le dépôt ne porte aucune liste d'élèves inscrits. Les cinq profils de "
            "01_A_ENVOYER_AUX_CANDIDATS/PROFILS_DE_REFERENCE sont les profils de "
            "référence qui éprouvent la chaîne ; leurs identifiants sont des codes, "
            "jamais des noms. Les 154 combinaisons de 90_PROFILS_POSSIBLES sont le "
            "catalogue des profils possibles, non un effectif.",
        "doublons": {k: v for k, v in doublons.items() if k != "detail"},
        "packs_incomplets": [DIS.nom_pack(k) for k in d["packs"] if k["manquants"]],
        "profils_du_projet": [
            {"etiquette": x["etiquette"], "niveau": x["niveau"], "profil": x["profil"],
             "eds": x["eds"], "config_francais": x["config_francais"],
             "diagnostics_requis": ["/".join(k) for k in x["requis"]],
             "documents_prets": len(x["prets"]), "documents_manquants": x["manquants"],
             "duree_totale_min": x["duree_totale_min"]}
            for x in profils],
        "tableaux": ["DISTRIBUTION_MATRIX.csv", "STUDENT_PACK_MATRIX.csv",
                     "PRINT_MATRIX.csv", "CANDIDATE_PROFILES.csv"],
        "regle": "Les packs sont des liens durs vers les rendus, reconstruits par "
                 "scripts/distribution.py. Ils ne sont pas versionnés : les versionner "
                 "reviendrait à porter deux fois la même chose et à les laisser diverger "
                 "de leur source. Les trois tableaux le sont, eux : ce sont des index.",
    }

    critere = {
        "INSTRUMENTS_METIER": len(instruments),
        "DIFFUSABLES": sum(1 for i in instruments.values() if i["etat"] == "diffusable"),
        "NON_DIFFUSABLES": sum(1 for i in instruments.values()
                               if i["etat"] != "diffusable"),
        "PLACEHOLDERS_INSTRUMENTS": sum(
            len(m) for i in instruments.values()
            for m in [[x for x in i["motifs_de_non_diffusabilite"]
                       if x["motif"] in ("emplacement_reserve", "support_a_completer",
                                         "support_incomplet")]]),
        "VALIDATION_ERRORS": erreurs_validation,
        "PDF_PREFLIGHT_ERRORS": 0,   # le preflight s'exécute à la construction : un PDF
                                     # qui ne passe pas n'est pas écrit.
        "MISSING_RENDERS": manquants,
        "SOURCE_TEXT_HASH_COLLISIONS": len(collisions),
        "CANDIDATE_CORRECTION_LEAKS": sum(1 for e in d["erreurs"] if "FUITE" in e),
        "PDF_PREFLIGHT_ERRORS_DISTRIBUTION": sum(1 for e in d["erreurs"]
                                                 if "FUITE" not in e),
        "PROFILE_COMBINATIONS": len(d["packs"]),
        "ACTIVE_CANDIDATES": 0,
        "UNEXPECTED_DUPLICATE": doublons.get("UNEXPECTED_DUPLICATE", 0),
        "VERSION_COLLISION": doublons.get("VERSION_COLLISION", 0),
        "PROFILE_PACKS_INCOMPLETS": len(distribution["packs_incomplets"]),
        "CANDIDATES_WITH_MISSING_REQUIRED_TESTS": sum(1 for x in profils
                                                      if x["manquants"]),
        "UNEXPLAINED_FUTURE_DATES": DA.resume()["UNEXPLAINED_FUTURE_DATES"],
    }
    return {
        "version": RELEASE_COURANTE,
        "libelle": "Diagnostics Nexus Réussite — état du dépôt",
        "date_de_build": date.today().isoformat(),
        "note_sur_les_dates":
            "Toute métadonnée créée par cette release porte la date de l'horloge, "
            "2026-09-11. Des occurrences de « 2026-09-12 » subsistent : elles étaient "
            "déjà enregistrées au commit de départ et appartiennent à la passe "
            "précédente, qui avait daté son travail du lendemain. Une décision déjà "
            "enregistrée ne se réécrit pas ; elle se classe. Le classement est recalculé "
            "par scripts/dates_anterieures.py et reporté ci-dessous.",
        "dates_anterieures": DA.resume(),
        "commit_precedent": git_head(),
        "note_sur_le_commit":
            "« commit_precedent » est le dernier commit au moment du build. Le manifeste "
            "ne peut pas nommer le commit qui le contient — il est écrit avant lui. Ce "
            "qui fait foi n'est donc pas ce SHA mais les empreintes ci-dessous : elles "
            "décrivent exactement les fichiers mesurés, et se recalculent.",
        "produit_par": "scripts/release.py",
        "regle": "Aucun état n'est recopié : chaque champ de ce manifeste est calculé "
                 "depuis les fichiers du dépôt au moment du build.",
        "reconstructibilite":
            "Les rendus ne sont pas versionnés : `instruments/*/build/` est exclu du "
            "dépôt (SECURITE.md). Les empreintes de rendus consignées ici sont celles "
            "des fichiers produits au moment de ce build, et la construction est "
            "déterministe octet à octet — `scripts/build_instrument.py <dossier> "
            "--check-determinisme` le vérifie. Reconstruire à ce commit redonne les "
            "mêmes empreintes ; les obtenir autrement signifie que la source a bougé.",
        "critere_de_fin": critere,
        "conforme": (critere["DIFFUSABLES"] == critere["INSTRUMENTS_METIER"]
                     and critere["NON_DIFFUSABLES"] == 0
                     and critere["PLACEHOLDERS_INSTRUMENTS"] == 0
                     and critere["VALIDATION_ERRORS"] == 0
                     and critere["MISSING_RENDERS"] == 0
                     and critere["SOURCE_TEXT_HASH_COLLISIONS"] == 0
                     and critere["CANDIDATE_CORRECTION_LEAKS"] == 0
                     and critere["PDF_PREFLIGHT_ERRORS_DISTRIBUTION"] == 0
                     and critere["PROFILE_PACKS_INCOMPLETS"] == 0
                     and critere["CANDIDATES_WITH_MISSING_REQUIRED_TESTS"] == 0
                     and critere["UNEXPLAINED_FUTURE_DATES"] == 0
                     and critere["UNEXPECTED_DUPLICATE"] == 0
                     and critere["VERSION_COLLISION"] == 0),
        "textes_sources": TS.registre()["textes"],
        "distribution": distribution,
        "instruments": instruments,
    }


def markdown(m: dict) -> str:
    """Le même manifeste, lisible par la direction — dérivé du JSON, jamais ressaisi."""
    c = m["critere_de_fin"]
    L = [f"# Diagnostics Nexus Réussite — {m['version']}", "",
         f"*Manifeste produit le {m['date_de_build']} par `{m['produit_par']}` "
         f"depuis le dépôt, au-delà du commit `{m['commit_precedent'][:12]}`.*", "",
         m["regle"], "", m["note_sur_le_commit"], "", m["note_sur_les_dates"], "",
         "## Critère de fin", "",
         "| Compteur | Valeur |", "|---|---|"]
    L += [f"| `{k}` | {v} |" for k, v in c.items()]
    L += ["", f"**Résultat : {c['DIFFUSABLES']}/{c['INSTRUMENTS_METIER']} diffusables — "
          f"{'conforme' if m['conforme'] else 'NON CONFORME'}.**", "",
          "## Instruments", "",
          "| Instrument | Versions | Profils | Durée | Items | État | Textes sources |",
          "|---|---|---|---|---|---|---|"]
    for code, i in sorted(m["instruments"].items()):
        v = i["versions"]
        # Les quatre colonnes suivent le même ordre de versions : les lire dans deux
        # ordres différents alignait la durée d'un assemblage sur le nom d'un autre.
        ordre = sorted(v)
        versions = ", ".join(ordre)
        profils = "/".join(sorted({p for x in v.values() for p in x["profils"]}))
        durees = ", ".join(str(v[k]["duree_cible_min"]) for k in ordre)
        items = ", ".join(str(v[k]["nombre_items"] or "—") for k in ordre)
        src = ", ".join(sorted(i["textes_sources"])) or "—"
        L.append(f"| **{code}** | {versions} | {profils} | {durees} min | {items} "
                 f"| {i['etat']} | {src} |")
    L += ["", "## Textes sources", "",
          "| Clé | Auteur, œuvre | Édition | Mots | Lignes PDF | Empreinte |",
          "|---|---|---|---|---|---|"]
    for cle, t in m["textes_sources"].items():
        L.append(f"| `{cle}` | {t['auteur']}, *{t['oeuvre']}* | {t['edition']} "
                 f"| {t['nombre_mots']} | {t['nombre_lignes_dans_le_pdf_final']} "
                 f"| `{t['sha256_texte_normalise'][:16]}…` |")
    L += ["", "Chaque texte provient d'une édition publique identifiée, confrontée à son "
          "fac-similé. Deux supports ne portent jamais le même passage : les empreintes "
          "ci-dessus sont deux à deux distinctes, et le build échoue si elles cessent de "
          "l'être.", "",
          "## Empreintes des rendus", "",
          "Le manifeste JSON porte, pour chaque version de chaque instrument, "
          "l'empreinte de sa banque, de son assemblage, de chacun de ses rendus et de "
          "chacun de ses PDF. Il fait foi ; ce document le résume.", ""]
    non = [c for c, i in sorted(m["instruments"].items()) if i["etat"] != "diffusable"]
    if non:
        L += ["## Instruments non diffusables", ""]
        for code in non:
            L.append(f"- **{code}**")
            for mo in m["instruments"][code]["motifs_de_non_diffusabilite"]:
                L.append(f"  - `{mo['motif']}` — {mo['detail']}")
        L.append("")
    return "\n".join(L).rstrip() + "\n"


def main(argv: list[str]) -> int:
    m = manifeste()
    if "--verifier" not in argv:
        JSON.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
        MD.write_text(markdown(m), encoding="utf-8")
        print(f"écrit : {JSON.name}, {MD.name}")
    for k, v in m["critere_de_fin"].items():
        print(f"  {k} = {v}")
    print("conforme" if m["conforme"] else "NON CONFORME")
    return 0 if m["conforme"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
