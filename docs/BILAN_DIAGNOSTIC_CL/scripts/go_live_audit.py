#!/usr/bin/env python3
"""Les preuves mécaniques du GO LIVE : périmètre, assemblages, supports, PDF, sécurité.

Ce script ne juge pas le fond d'une question — cela relève de la relecture disciplinaire,
dont le résultat est consigné dans `audit/ITEM_AUDIT.jsonl`. Il produit ce qu'une machine
peut établir sans interprétation, et il le produit **dérivé** : aucun effectif n'est écrit
à la main ici. Un compteur attendu qui serait recopié depuis un état antérieur ne
prouverait que sa propre recopie.

    python3 scripts/go_live_audit.py perimetre     # audit/DISCIPLINARY_SCOPE.json
    python3 scripts/go_live_audit.py assemblages   # audit/ASSEMBLY_AUDIT.json
    python3 scripts/go_live_audit.py supports      # audit/SUPPORT_AUDIT.json
    python3 scripts/go_live_audit.py couverture    # audit/CONTENT_COVERAGE_MATRIX.json
    python3 scripts/go_live_audit.py pdf           # audit/PDF_VISUAL_QA.json
    python3 scripts/go_live_audit.py securite      # audit/SECURITY_SCAN.json
    python3 scripts/go_live_audit.py tout
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

AUDIT = RACINE / "audit"
V2 = RACINE / "release" / "diagnostics-v2"
INSTRUMENTS = RACINE / "instruments"
REFERENTIELS = RACINE / "referentiels"


def charger(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def ecrire(nom: str, donnees) -> Path:
    AUDIT.mkdir(parents=True, exist_ok=True)
    cible = AUDIT / nom
    cible.write_text(json.dumps(donnees, ensure_ascii=False, indent=1, sort_keys=False) + "\n",
                     encoding="utf-8")
    return cible


def catalogue() -> list[dict]:
    return charger(REFERENTIELS / "catalogue_instruments.json")["instruments"]


def instruments_reels() -> list[str]:
    """Les dossiers d'instrument diffusables : les préfixés « _ » sont des fixtures."""
    return sorted(d.name for d in INSTRUMENTS.iterdir()
                  if d.is_dir() and not d.name.startswith("_"))


def banque_de(code: str) -> dict | None:
    p = INSTRUMENTS / code / "banque.json"
    return charger(p) if p.exists() else None


def assemblages_de(code: str) -> dict[str, dict]:
    d = INSTRUMENTS / code / "assemblages"
    if not d.is_dir():
        return {}
    return {p.stem: charger(p) for p in sorted(d.glob("*.json"))}


def items_de_l_assemblage(a: dict) -> list[str]:
    ids: list[str] = []
    for bloc in a.get("blocs", []):
        ids.extend(bloc.get("items", []))
    return ids


# ── Périmètre disciplinaire ───────────────────────────────────────────────────

def pdfs_de_l_instrument(code: str, version: str) -> dict[str, list[str]]:
    """Les artefacts de release qui portent cet instrument, lus dans le manifeste.

    Le manifeste est la seule table qui relie un artefact à son instrument ; deviner
    depuis le nom de fichier rattacherait `MATHEMATIQUES.pdf` à EDS-MATH et à MATH-EA.
    """
    man = V2 / "04_INTERNE" / "MANIFESTE_V2.json"
    if not man.exists():
        return {"candidat": [], "coach": []}
    # Le manifeste rattache chaque artefact aux instruments qu'il compose, sous la forme
    # « CODE/version » : un livret de français en porte deux, l'écrit et l'oral.
    cible = f"{code}/{version}"
    cand, coach = [], []
    for a in charger(man)["artefacts"]:
        if cible not in (a.get("instruments") or []):
            continue
        if a["role"] == "candidat":
            cand.append(a["path"])
        elif a["role"] == "coach":
            coach.append(a["path"])
    return {"candidat": sorted(cand), "coach": sorted(coach)}


def perimetre() -> dict:
    cat = catalogue()
    modalites = charger(REFERENTIELS / "modalites_epreuves.json")
    progs = charger(REFERENTIELS / "programmes_examen.json")
    entrees = []
    for e in cat:
        code, version = e["code"], e["version"]
        banque = banque_de(code)
        asm = assemblages_de(code)
        a = asm.get(version)
        ids = items_de_l_assemblage(a) if a else []
        par_bloc = {}
        if a:
            for bloc in a.get("blocs", []):
                par_bloc[bloc["bloc"]] = len(bloc.get("items", []))
        ep = e.get("perimetre")
        entrees.append({
            "instrument_id": f"{code}/{version}",
            "code": code,
            "version": version,
            "libelle": e.get("libelle"),
            "profils": e.get("profils", []),
            "sessions": sorted({s for s in [e.get("session_baccalaureat_finale")] if s}) or "toutes",
            "support": e.get("support"),
            "materiel": e.get("materiel"),
            "duree_cible_min": e.get("duree_cible_min"),
            "porte_items": e.get("porte_items"),
            "bank_path": f"instruments/{code}/banque.json" if banque else None,
            "assembly_path": f"instruments/{code}/assemblages/{version}.json" if a else None,
            "item_count_bank": len(banque["items"]) if banque else 0,
            "item_count_by_assembly": len(ids),
            "item_count_by_block": par_bloc,
            "candidate_pdf_paths": pdfs_de_l_instrument(code, version)["candidat"],
            "coach_pdf_paths": pdfs_de_l_instrument(code, version)["coach"],
            "official_exam_sources": sorted(
                {k for k, v in modalites.get("epreuves_terminales", {}).items() if k == ep}
                | {ep} if ep else set()),
            "official_program_sources": progs.get("programmes", {}).get(ep, {}).get("source")
            if isinstance(progs.get("programmes"), dict) else None,
            "audit_status": "PENDING",
        })
    codes = sorted({e["code"] for e in cat})
    dossiers = instruments_reels()
    return {
        "schema": "go_live/disciplinary_scope/1.0",
        "derive_de": ["referentiels/catalogue_instruments.json", "instruments/",
                      "release/diagnostics-v2/04_INTERNE/MANIFESTE_V2.json"],
        "instruments_derives": len(codes),
        "variantes_derivees": len(cat),
        "dossiers_instruments": dossiers,
        "codes_du_catalogue": codes,
        "codes_sans_dossier": sorted(set(codes) - set(dossiers)),
        "dossiers_hors_catalogue": sorted(set(dossiers) - set(codes)),
        "items_uniques_de_banque": sum(
            len(banque_de(c)["items"]) for c in dossiers if banque_de(c)),
        "instruments": entrees,
    }


# ── Assemblages ───────────────────────────────────────────────────────────────

def assemblages() -> dict:
    cat = {(e["code"], e["version"]): e for e in catalogue()}
    conv = charger(REFERENTIELS / "catalogue_instruments.json")["conventions"]
    ratio_min = conv["fenetre_duree"]["ratio_min"]
    ratio_max = conv["fenetre_duree"]["ratio_max"]
    lignes = []
    for code in instruments_reels():
        banque = banque_de(code)
        if not banque:
            continue
        par_id = {i["item_id"]: i for i in banque["items"]}
        for version, a in assemblages_de(code).items():
            ids = items_de_l_assemblage(a)
            manquants = [i for i in ids if i not in par_id]
            vus, doublons = set(), []
            for i in ids:
                if i in vus:
                    doublons.append(i)
                vus.add(i)
            items = [par_id[i] for i in ids if i in par_id]
            score = sum(i["score_max"] for i in items)
            duree = sum(i["duree_min"] for i in items)
            e = cat.get((code, version))
            cible = e["duree_cible_min"] if e else None
            # Le bloc 0 (auto-positionnement) consomme du temps déclaré par l'assemblage.
            duree_bloc0 = (a.get("bloc_0") or {}).get("duree_min", 0)
            duree_totale = duree + duree_bloc0
            fenetre = None
            duree_ok = None
            if cible:
                fenetre = [round(ratio_min * cible, 2), round(ratio_max * cible, 2)]
                duree_ok = fenetre[0] <= duree_totale <= fenetre[1]
            # `blocs_attendus` est l'ensemble des blocs d'items **admis** par le
            # catalogue, pas une séquence imposée : un assemblage n'est pas tenu de les
            # servir tous (FR-EAF/oral ne porte que A et B). Le bloc 0 d'auto-positionnement
            # ne porte aucun item et n'y figure pas ; il est déclaré par l'assemblage,
            # sous la clé `bloc_0`.
            blocs_declares = e.get("blocs_attendus") if e else None
            blocs_reels = [b["bloc"] for b in a.get("blocs", [])]
            blocs_reels_complets = (["0"] if duree_bloc0 else []) + blocs_reels
            blocs_inattendus = ([b for b in blocs_reels if b not in blocs_declares]
                                if blocs_declares is not None else [])
            hors_scope = []
            for it in items:
                # un item ne doit pas être utilisé par un assemblage dont le niveau
                # est inférieur au sien : « T » (terminale) dans une version de première.
                niv = str(it.get("niveau", ""))
                if version in ("N1", "1RE") and niv == "T":
                    hors_scope.append(it["item_id"])
            couverture = sorted({it.get("competence") for it in items})
            lignes.append({
                "instrument": code,
                "version": version,
                "item_ids": ids,
                "bank_item_count": len(banque["items"]),
                "assembly_item_count": len(ids),
                "score_total": score,
                "duration_total": duree_totale,
                "duration_items": duree,
                "duration_bloc_0": duree_bloc0,
                "target_duration": cible,
                "duration_window": fenetre,
                "duration_within_window": duree_ok,
                "coverage": couverture,
                "blocks_declared": blocs_declares,
                "blocks_present": blocs_reels_complets,
                "blocks_unexpected": blocs_inattendus,
                "blocks_match": not blocs_inattendus,
                "duplicate_items": doublons,
                "missing_items": manquants,
                "out_of_scope_items": hors_scope,
                "status": "PASS" if not (doublons or manquants or hors_scope
                                         or blocs_inattendus)
                          and duree_ok is not False
                          else "FAIL",
            })
    # items de banque jamais assemblés
    reserve = {}
    for code in instruments_reels():
        banque = banque_de(code)
        if not banque:
            continue
        utilises = set()
        for _, a in assemblages_de(code).items():
            utilises |= set(items_de_l_assemblage(a))
        jamais = sorted({i["item_id"] for i in banque["items"]} - utilises)
        if jamais:
            reserve[code] = jamais
    return {
        "schema": "go_live/assembly_audit/1.0",
        "assemblages_derives": len(lignes),
        "erreurs": sum(1 for l in lignes if l["status"] == "FAIL"),
        "items_de_banque_non_assembles": reserve,
        "assemblages": lignes,
    }


# ── Supports ──────────────────────────────────────────────────────────────────

#: Une formule par laquelle un énoncé promet un document au candidat. Calibrée sur la
#: collection : elle ne se déclenche pas sur la mention générique d'un genre d'objet
#: — « dans un texte argumentatif », « dans un réseau » —, qui ne promet rien.
#: `tests/test_bareme_atteignable_et_supports.py` importe cette expression : le contrôle
#: mécanique et le test de non-régression lisent la même règle, et ne peuvent pas diverger.
PROMESSE = re.compile(
    r"\bvoici\b|\bci-dessus\b|\bci-dessous\b|\bci-après\b|\bci-contre\b|"
    r"\bd'après (?:le|la|ce|cette) (?:document|tableau|graphique|texte|schéma|carte|"
    r"corpus|affiche|discours|source)\b|"
    r"\bà partir d[eu] (?:document|tableau|graphique|texte|schéma|carte|corpus)\b|"
    r"\b(?:ce|cette) (?:discours|affiche|source)\b|"
    r"\bsur (?:cette carte|un fond de carte)\b|"
    r"\bconfrontez (?:ce|cette|ces)\b|"
    r"\b(?:relevez|analysez|portez un regard critique sur) (?:dans )?ce "
    r"(?:texte|document|discours)\b",
    re.I)

#: Un énoncé porte souvent lui-même ce qu'il annonce : un programme entre clôtures, une
#: citation en retrait ou entre guillemets, une notice en italique, ou la liste qu'il
#: demande d'ordonner.
PORTE_SON_DOCUMENT = re.compile(
    r"```|^>|\*[^*\n]{20,}\*|\n—|\n-\s|"
    r"Document pédagogique Nexus|Repères fournis|Notice\s*:|«[^»]{40,}»",
    re.S | re.M)

#: Un énoncé peut renvoyer nommément au document d'un autre bloc du même livret.
RENVOI_BLOC = re.compile(r"\bbloc\s+([0A-D])\b", re.I)


def supports() -> dict:
    lignes = []
    for code in instruments_reels():
        banque = banque_de(code)
        if not banque:
            continue
        par_id = {i["item_id"]: i for i in banque["items"]}
        for version, a in assemblages_de(code).items():
            # Un assemblage peut porter un support au niveau du bloc — le texte littéraire
            # du bloc C, par exemple — et des items d'un autre bloc y renvoient
            # nommément : « dans l'extrait du bloc C ». Ignorer ces supports faisait
            # compter quatre-vingt-un renvois comme orphelins alors que le livret les sert.
            supports_de_bloc = {b["bloc"]: (b.get("supports") or [])
                                for b in a.get("blocs", [])}
            tous_supports_assemblage = [t for v in supports_de_bloc.values() for t in v]
            for bloc in a.get("blocs", []):
                # supports disponibles dans le bloc, dans l'ordre
                dispo_bloc: list[str] = [s.get("type", "texte") if isinstance(s, dict)
                                         else "texte"
                                         for s in supports_de_bloc.get(bloc["bloc"], [])]
                for iid in bloc.get("items", []):
                    it = par_id.get(iid)
                    if it:
                        dispo_bloc += [s.get("type", "?") for s in (it.get("supports") or [])]
                for iid in bloc.get("items", []):
                    it = par_id.get(iid)
                    if not it:
                        continue
                    # Seul l'énoncé promet : une proposition est une réponse, et la
                    # mention d'« un texte » dans l'une d'elles ne promet aucun document.
                    texte = it.get("enonce", "")
                    renvoie = bool(PROMESSE.search(texte))
                    propres = it.get("supports") or []
                    fichiers_manquants = []
                    for s in propres:
                        for cle in ("fichier", "chemin", "image"):
                            if s.get(cle):
                                p = RACINE / s[cle]
                                if not p.exists():
                                    fichiers_manquants.append(s[cle])
                    # « dans l'extrait du bloc C » : le renvoi nomme le bloc qui porte
                    # le document. Il est servi dès que ce bloc en porte un.
                    renvoi_bloc = re.search(r"\bbloc\s+([0A-D])\b", texte, re.I)
                    statut = "PASS"
                    motif = ""
                    if renvoie and not propres and PORTE_SON_DOCUMENT.search(
                            it.get("enonce") or ""):
                        motif = "l'énoncé porte lui-même le document qu'il annonce"
                    elif renvoie and not propres and not dispo_bloc:
                        if renvoi_bloc and supports_de_bloc.get(renvoi_bloc.group(1).upper()):
                            statut, motif = "PASS", (
                                f"renvoi explicite au support du bloc "
                                f"{renvoi_bloc.group(1).upper()}")
                        elif renvoi_bloc and tous_supports_assemblage:
                            statut, motif = "PASS", "renvoi explicite à un bloc de l'assemblage"
                        else:
                            statut, motif = "FAIL", \
                                "renvoi à un support absent de l'item et du bloc"
                    elif renvoie and not propres:
                        statut, motif = "PASS", "renvoi satisfait par un support du bloc"
                    if fichiers_manquants:
                        statut, motif = "FAIL", f"fichier(s) de support absent(s) : {fichiers_manquants}"
                    lignes.append({
                        "instrument": code, "version": version, "bloc": bloc["bloc"],
                        "item_id": iid,
                        "renvoi_detecte": renvoie,
                        "supports_propres": [s.get("type") for s in propres],
                        "supports_du_bloc": dispo_bloc,
                        "fichiers_manquants": fichiers_manquants,
                        "status": statut, "motif": motif,
                    })
    return {
        "schema": "go_live/support_audit/1.0",
        "controles": len(lignes),
        "manquants": sum(1 for l in lignes if l["status"] == "FAIL"),
        "details": [l for l in lignes if l["status"] == "FAIL" or l["motif"]],
        "tous": lignes,
    }


# ── Couverture diagnostique ───────────────────────────────────────────────────

def couverture() -> dict:
    comps = charger(REFERENTIELS / "competences.json")
    matrices = []
    for code in instruments_reels():
        banque = banque_de(code)
        if not banque:
            continue
        par_id = {i["item_id"]: i for i in banque["items"]}
        for version, a in assemblages_de(code).items():
            par_comp: dict[str, list[dict]] = {}
            for bloc in a.get("blocs", []):
                for iid in bloc.get("items", []):
                    it = par_id.get(iid)
                    if not it:
                        continue
                    par_comp.setdefault(it.get("competence", "?"), []).append({
                        "item_id": iid, "type": it.get("type"),
                        "palier": it.get("palier"), "niveau": it.get("niveau"),
                        "score_max": it.get("score_max"), "bloc": bloc["bloc"],
                    })
            total = sum(len(v) for v in par_comp.values())
            score = sum(i["score_max"] for v in par_comp.values() for i in v)
            unique = sorted(k for k, v in par_comp.items() if len(v) == 1)
            matrices.append({
                "instrument": code, "version": version,
                "competences_evaluees": sorted(par_comp),
                "items_par_competence": {k: len(v) for k, v in sorted(par_comp.items())},
                "score_par_competence": {
                    k: sum(i["score_max"] for i in v) for k, v in sorted(par_comp.items())},
                "paliers_par_competence": {
                    k: sorted({i["palier"] for i in v if i["palier"]})
                    for k, v in sorted(par_comp.items())},
                "types_par_competence": {
                    k: sorted({i["type"] for i in v}) for k, v in sorted(par_comp.items())},
                "items_total": total, "score_total": score,
                "competences_a_item_unique": unique,
                "detail": par_comp,
            })
    return {
        "schema": "go_live/content_coverage_matrix/1.0",
        "avertissement": "Validité de contenu et couverture programme. Aucune statistique "
                         "psychométrique n'est produite : aucune passation réelle n'a été "
                         "collectée, une fidélité chiffrée serait inventée.",
        "referentiel_competences": str(REFERENTIELS / "competences.json"),
        "competences_declarees": sorted(
            c["code"] for c in comps.get("competences", []) if isinstance(c, dict)),
        "matrices": matrices,
    }


# ── PDF ───────────────────────────────────────────────────────────────────────

#: Ce qui ne doit jamais atteindre une page imprimée.
INTERDITS = {
    "remplacement_unicode": re.compile("\ufffd"),
    "commande_latex": re.compile(r"\\(?:begin|end|textbf|textit|item|section|hline|"
                                 r"multicolumn|vspace|hspace|newline|par)\b"),
    "chemin_local": re.compile(r"/home/|/tmp/|C:\\\\"),
    "marqueur_travaux": re.compile(r"\bTODO\b|\bFIXME\b|PLACEHOLDER|XXX\b|LOREM IPSUM", re.I),
    "cloture_markdown": re.compile(r"```"),
    "puce_markdown": re.compile(r"(?m)^\s*[-*]\s{2,}\S"),
    "gras_markdown": re.compile(r"\*\*\S"),
}


def pdf_preflight(p: Path) -> dict:
    info = subprocess.run(["pdfinfo", str(p)], capture_output=True, text=True)
    if info.returncode != 0:
        return {"ouvrable": False, "erreur": info.stderr.strip()[:200]}
    champs = dict(l.split(":", 1) for l in info.stdout.splitlines() if ":" in l)
    pages = int(champs.get("Pages", "0").strip() or 0)
    taille = champs.get("Page size", "").strip()
    fonts = subprocess.run(["pdffonts", str(p)], capture_output=True, text=True).stdout
    lignes_fonts = [l for l in fonts.splitlines()[2:] if l.strip()]
    non_embarquees = [l.split()[0] for l in lignes_fonts
                      if len(l.split()) > 3 and l.split()[3] == "no"]
    texte = subprocess.run(["pdftotext", "-layout", str(p), "-"],
                           capture_output=True, text=True).stdout
    trouves = {nom: len(r.findall(texte)) for nom, r in INTERDITS.items()
               if r.search(texte)}
    # pages blanches : une page sans aucun caractère imprimable
    par_page = texte.split("\f")
    blanches = [n + 1 for n, t in enumerate(par_page[:pages]) if not t.strip()]
    # débordement : boîte de texte hors de la boîte de page
    bbox = subprocess.run(["pdftotext", "-bbox", str(p), "-"],
                          capture_output=True, text=True).stdout
    debords = deborde(bbox)
    # pdfinfo nomme lui-même le format : « 595.28 x 841.89 pts (A4) ». Réécrire le
    # calcul avait fait déclarer les 154 PDF hors A4, parce que la hauteur est 841,89 et
    # non 842, et parce que les matrices de l'opérateur sont en paysage — un A4 aussi.
    a4 = "(A4)" in taille
    return {
        "ouvrable": True, "pages": pages, "page_size": taille, "a4": a4,
        "polices": len(lignes_fonts), "polices_non_embarquees": non_embarquees,
        "texte_interdit": trouves, "pages_blanches": blanches,
        "debordements": debords,
        "caracteres_texte": len(texte),
    }


def deborde(bbox: str) -> list[dict]:
    """Les mots dont la boîte sort de la page. Un mot coupé au fer est illisible."""
    out = []
    page_w = page_h = None
    page_no = 0
    for l in bbox.splitlines():
        m = re.search(r'<page width="([\d.]+)" height="([\d.]+)"', l)
        if m:
            page_w, page_h = float(m.group(1)), float(m.group(2))
            page_no += 1
            continue
        m = re.search(r'<word xMin="([-\d.]+)" yMin="([-\d.]+)" xMax="([-\d.]+)" yMax="([-\d.]+)">(.*?)</word>', l)
        if m and page_w:
            x0, y0, x1, y1 = (float(m.group(i)) for i in range(1, 5))
            if x0 < -1 or y0 < -1 or x1 > page_w + 1 or y1 > page_h + 1:
                out.append({"page": page_no, "mot": m.group(5)[:40],
                            "boite": [x0, y0, x1, y1], "page_box": [page_w, page_h]})
    return out


def pdf() -> dict:
    cibles = sorted(V2.rglob("*.pdf"))
    lignes = []
    for p in cibles:
        pf = pdf_preflight(p)
        pb = []
        if not pf.get("ouvrable"):
            pb.append("pdf illisible")
        else:
            if pf["pages"] == 0:
                pb.append("aucune page")
            if pf["polices_non_embarquees"]:
                pb.append(f"polices non embarquées : {pf['polices_non_embarquees']}")
            if pf["texte_interdit"]:
                pb.append(f"texte interdit : {pf['texte_interdit']}")
            if pf["pages_blanches"]:
                pb.append(f"pages blanches : {pf['pages_blanches']}")
            if pf["debordements"]:
                pb.append(f"{len(pf['debordements'])} mot(s) hors page")
            if not pf["a4"]:
                pb.append(f"format non A4 : {pf['page_size']}")
        lignes.append({
            "path": str(p.relative_to(RACINE)),
            "pages": pf.get("pages"),
            "text_preflight": "PASS" if not pf.get("texte_interdit") and not pf.get("pages_blanches") else "FAIL",
            "font_preflight": "PASS" if pf.get("ouvrable") and not pf.get("polices_non_embarquees") else "FAIL",
            "overflow_preflight": "PASS" if pf.get("ouvrable") and not pf.get("debordements") else "FAIL",
            "format_preflight": "PASS" if pf.get("a4") else "FAIL",
            "detail": pf,
            "visual_pages_checked": 0,
            "visual_findings": [],
            "status": "PASS" if not pb else "FAIL",
            "problemes": pb,
        })
    return {
        "schema": "go_live/pdf_visual_qa/1.0",
        "pdf_controles": len(lignes),
        "pages_totales": sum(l["pages"] or 0 for l in lignes),
        "en_echec": sum(1 for l in lignes if l["status"] == "FAIL"),
        "pdf": lignes,
    }


# ── Sécurité ──────────────────────────────────────────────────────────────────

#: Identités et références réelles interdites dans le dépôt public.
PII = {
    "nom_reel_connu": re.compile(r"OUESLATI|Mariem", re.I),
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]{2,}"),
    "telephone_tn": re.compile(r"(?:\+216|00216)\s?\d{2}\s?\d{3}\s?\d{3}"),
    "ine": re.compile(r"\b\d{10}[A-Z]{1}\b"),
    "cyclades_ref": re.compile(r"\b\d{2}-\d{4}-\d{5}\b"),
}
SECRETS = {
    "cle_privee": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "token_generique": re.compile(r"(?i)\b(?:api[_-]?key|secret|password|passwd|token|"
                                  r"bearer)\b\s*[:=]\s*['\"][^'\"\s]{12,}['\"]"),
    "sk_openai": re.compile(r"\bsk-[A-Za-z0-9]{20,}"),
    "aws": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
}
#: Les termes qui trahissent un document de correction sont ceux du banc de diffusion :
#: `scripts/distribution.py` les tient depuis l'origine, et ils sont calibrés. En écrire
#: d'autres ici ferait deux listes divergentes — la mienne comptait « réponse : » comme
#: une fuite, et arrêtait dix-huit livrets sur la phrase « il n'y a ni bonne ni mauvaise
#: réponse : ces éléments servent à construire un plan de travail ».
import distribution as DIS  # noqa: E402

FUITES_COACH = [(re.compile(motif, re.I), libelle) for motif, libelle in DIS.FUITES]

#: Fichiers texte du dépôt public qu'on scanne.
EXT_TEXTE = {".py", ".json", ".md", ".csv", ".tex", ".txt", ".ini", ".cfg", ".yml", ".yaml"}


def suivis() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=RACINE,
                         capture_output=True, text=True).stdout
    return [RACINE / n for n in out.split("\0") if n]


def securite() -> dict:
    fichiers = suivis()
    pii_trouves, secrets_trouves = [], []
    for f in fichiers:
        if f.suffix.lower() not in EXT_TEXTE or not f.exists():
            continue
        try:
            t = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        rel = str(f.relative_to(RACINE))
        for nom, r in PII.items():
            for m in r.finditer(t):
                pii_trouves.append({"fichier": rel, "type": nom,
                                    "extrait": m.group(0)[:80],
                                    "ligne": t[:m.start()].count("\n") + 1})
        for nom, r in SECRETS.items():
            for m in r.finditer(t):
                secrets_trouves.append({"fichier": rel, "type": nom,
                                        "extrait": m.group(0)[:40],
                                        "ligne": t[:m.start()].count("\n") + 1})
    # texte extrait des PDF de la release
    pii_pdf = []
    for p in sorted(V2.rglob("*.pdf")):
        t = subprocess.run(["pdftotext", str(p), "-"], capture_output=True, text=True).stdout
        for nom, r in PII.items():
            for m in r.finditer(t):
                pii_pdf.append({"fichier": str(p.relative_to(RACINE)), "type": nom,
                                "extrait": m.group(0)[:80]})
    # fuite de correction dans les documents candidat et impression
    fuites = []
    for zone in ("01_LIVRETS_CANDIDAT", "03_IMPRESSION"):
        for p in sorted((V2 / zone).rglob("*.pdf")):
            t = subprocess.run(["pdftotext", str(p), "-"], capture_output=True, text=True).stdout
            hits = sorted({libelle for motif, libelle in FUITES_COACH if motif.search(t)})
            if hits:
                fuites.append({"fichier": str(p.relative_to(RACINE)), "motifs": hits})
    # exports nominatifs : rien de suivi
    exports_suivis = [str(f.relative_to(RACINE)) for f in fichiers
                      if "exports_candidats" in str(f)]
    # source privée FR-POS
    privee = "sources_internes/francais/FR-POS/Test_positionnement_source_enseignante.pdf"
    privee_suivie = any(str(f.relative_to(RACINE)) == privee for f in fichiers)
    # PDF dans 04_INTERNE : la zone interne ne diffuse aucun sujet
    pdf_interne = [str(p.relative_to(RACINE)) for p in (V2 / "04_INTERNE").rglob("*.pdf")]
    # coach dans la zone d'envoi
    coach_dans_envoi = [str(p.relative_to(RACINE))
                        for p in (V2 / "01_LIVRETS_CANDIDAT").rglob("*")
                        if p.is_file() and "COACH" in p.name.upper()]
    return {
        "schema": "go_live/security_scan/1.0",
        "fichiers_suivis_scannes": sum(1 for f in fichiers if f.suffix.lower() in EXT_TEXTE),
        "pdf_scannes": len(list(V2.rglob("*.pdf"))),
        "pii_in_public_repo": pii_trouves,
        "pii_in_release_pdf": pii_pdf,
        "secrets_in_public_repo": secrets_trouves,
        "candidate_coach_leaks": fuites,
        "exports_candidats_suivis": exports_suivis,
        "source_privee_frpos_suivie": privee_suivie,
        "pdf_dans_04_INTERNE": pdf_interne,
        "coach_dans_01_LIVRETS_CANDIDAT": coach_dans_envoi,
        "compteurs": {
            "PII_IN_PUBLIC_REPO": len(pii_trouves) + len(pii_pdf),
            "SECRETS_IN_PUBLIC_REPO": len(secrets_trouves),
            "CANDIDATE_COACH_LEAKS": len(fuites),
        },
    }



# ── Rendu visuel ──────────────────────────────────────────────────────────────

def mesures_de_page(png: Path) -> dict:
    """Ce qu'une page rendue dit d'elle-même, sans la regarder.

    L'encre couvre-t-elle une part vraisemblable de la page ? Une page presque vide qui
    porte pourtant du texte trahit un cadre qui a mangé son contenu ; une page très
    chargée trahit un chevauchement. Et une figure qui n'a pas tracé laisse un rectangle
    uniformément blanc là où le texte annonce un graphique.
    """
    from PIL import Image
    im = Image.open(png).convert("L")
    l, h = im.size
    pixels = im.tobytes()
    sombres = sum(1 for v in pixels if v < 200)
    total = l * h
    # Bandes horizontales, hors bandeau de couverture : une bande saturée dans la zone
    # de composition trahit un chevauchement. Le bandeau de titre, lui, est plein par
    # dessin — le mesurer comme un défaut faisait sonner cent cinquante et un documents
    # sur cent cinquante-quatre, ce qui ne désignait plus rien.
    bandes = []
    pas = max(1, h // 40)
    depart = int(h * 0.22)
    for y in range(depart, h, pas):
        bande = im.crop((0, y, l, min(y + pas, h))).tobytes()
        bandes.append(sum(1 for v in bande if v < 200) / max(1, len(bande)))
    return {
        "encre": round(sombres / total, 4),
        "bande_max_zone_de_composition": round(max(bandes), 4) if bandes else 0.0,
        "largeur": l, "hauteur": h,
    }


def visuel() -> dict:
    """Rend chaque page, mesure ce qui peut l'être, et compose une planche par document.

    Les planches sont écrites hors du dépôt : ce sont des pièces d'audit, pas des
    artefacts de release, et la release refuse tout fichier qu'elle ne manifeste pas.
    """
    import tempfile
    sortie = Path(
        os.environ.get("GO_LIVE_PLANCHES", tempfile.gettempdir() + "/go-live-planches"))
    sortie.mkdir(parents=True, exist_ok=True)
    lignes = []
    for pdf in sorted(V2.rglob("*.pdf")):
        rel = pdf.relative_to(V2)
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            subprocess.run(["pdftoppm", "-r", "80", "-png", str(pdf), str(d / "p")],
                           capture_output=True)
            pages = sorted(d.glob("p-*.png"))
            mesures = [mesures_de_page(x) for x in pages]
            nom = str(rel).replace("/", "__").replace(".pdf", "") + ".png"
            if pages:
                subprocess.run(
                    ["montage", *[str(x) for x in pages], "-tile", "6x",
                     "-geometry", "300x+4+4", "-background", "#DDDDDD",
                     "-title", str(rel), str(sortie / nom)], capture_output=True)
        # Une page quasiment vide, ou une bande saturée hors du bandeau, méritent d'être
        # regardées. Les autres sont vues sur la planche du document.
        suspectes = [n + 1 for n, m in enumerate(mesures)
                     if m["encre"] < 0.002
                     or m["bande_max_zone_de_composition"] > 0.90]
        lignes.append({
            "path": str(pdf.relative_to(RACINE)),
            "pages_rendues": len(mesures),
            "planche": str((sortie / nom)) if mesures else None,
            "encre_min": min((m["encre"] for m in mesures), default=0),
            "encre_max": max((m["encre"] for m in mesures), default=0),
            "bande_max_zone_de_composition": max(
                (m["bande_max_zone_de_composition"] for m in mesures), default=0),
            "pages_a_regarder": suspectes,
            "status": "A_REGARDER" if suspectes else "PASS",
        })
    return {
        "schema": "go_live/pdf_visual_render/1.0",
        "dossier_des_planches": str(sortie),
        "documents": len(lignes),
        "pages_rendues": sum(l["pages_rendues"] for l in lignes),
        "documents_a_regarder": sum(1 for l in lignes if l["status"] != "PASS"),
        "rendus": lignes,
    }


COMMANDES = {
    "perimetre": ("DISCIPLINARY_SCOPE.json", perimetre),
    "assemblages": ("ASSEMBLY_AUDIT.json", assemblages),
    "supports": ("SUPPORT_AUDIT.json", supports),
    "couverture": ("CONTENT_COVERAGE_MATRIX.json", couverture),
    "pdf": ("PDF_VISUAL_QA.json", pdf),
    "securite": ("SECURITY_SCAN.json", securite),
    "visuel": ("PDF_VISUAL_RENDER.json", visuel),
}


def main() -> int:
    args = sys.argv[1:] or ["tout"]
    noms = list(COMMANDES) if args[0] == "tout" else args
    for nom in noms:
        if nom not in COMMANDES:
            print(f"inconnu : {nom}", file=sys.stderr)
            return 2
        fichier, fn = COMMANDES[nom]
        d = fn()
        p = ecrire(fichier, d)
        print(f"{nom:14s} → {p.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
