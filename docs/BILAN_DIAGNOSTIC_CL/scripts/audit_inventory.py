#!/usr/bin/env python3
"""Inventaires d'audit du dépôt public : fichiers, instruments, situations candidates.

Trois inventaires, tous dérivés du dépôt lui-même — aucun n'est saisi à la main :

    audit/AUDIT_FILE_INVENTORY.json        chaque fichier public : empreinte, taille, rôle
    audit/AUDIT_INSTRUMENT_COVERAGE.json   chaque instrument du catalogue : versions,
                                           profils, sources, livrets, tests, diffusabilité
    audit/AUDIT_CANDIDATE_COVERAGE.json    chaque situation candidate que le moteur sert :
                                           faits, obligations, diagnostics, livrets, tests
    audit/golden_packs/*.json              manifestes synthétiques (identité fictive)

    python3 scripts/audit_inventory.py             # écrit les quatre
    python3 scripts/audit_inventory.py --verifier  # compare sans écrire, code 1 si dérive

Le catalogue des instruments, les spécialités, les profils et les livrets sont lus dans
les référentiels, les banques, le plan de release et le moteur de packs : ajouter un
instrument ou une combinaison change l'inventaire sans qu'aucune liste ne soit à mettre
à jour ici. Les tests `tests/test_audit_inventory.py` refusent qu'un inventaire versionné
diverge de ce que le dépôt calcule.
"""
from __future__ import annotations

import ast
import hashlib
import itertools
import json
import re
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import diffusabilite as DIF  # noqa: E402
import distribution as DIS  # noqa: E402
import livret as LI  # noqa: E402
import maquette_donnees as MD  # noqa: E402
import pack_candidat as PC  # noqa: E402
import release_v2 as REL  # noqa: E402

AUDIT = RACINE / "audit"
GOLDEN = AUDIT / "golden_packs"
RELEASE_REL = "release/diagnostics-v2"
IDENTITE_FICTIVE = "Camille TEST"
SESSION_FIXTURE = 2027


# ─────────────────────────────────────────────── A · fichiers publics

def fichiers_publics() -> list[str]:
    """Les chemins que le dépôt public porte ou portera : suivis, ou non ignorés."""
    r = subprocess.run(["git", "-C", str(RACINE), "ls-files", "-co", "--exclude-standard", "-z", "."],
                       capture_output=True, text=True, check=True)
    return sorted(p for p in r.stdout.split("\0") if p and (RACINE / p).is_file())


def categorie(p: str) -> tuple[str, str]:
    """Catégorie et rôle d'un fichier public, lus dans son chemin."""
    if p.startswith(RELEASE_REL + "/"):
        sous = p[len(RELEASE_REL) + 1:]
        if sous.startswith("01_LIVRETS_CANDIDAT/"):
            return "CANONICAL_CANDIDATE_PDF", "livret candidat canonique, remis à la famille"
        if sous.startswith("02_CORRECTIONS_COACH/"):
            return "CANONICAL_COACH_PDF", "corrigé et grilles, usage coach exclusivement"
        if sous.startswith("03_IMPRESSION/"):
            return "PRINT_COLLECTION", "recueil d'impression d'un profil"
        if sous.startswith("00_GUIDE/"):
            return "GUIDE", "guide de l'opérateur, matrices et planches"
        if sous.startswith("04_INTERNE/MANIFESTE_V2"):
            return "MANIFEST", "manifeste de la release : empreintes et commit source"
        return "MANIFEST", "index interne de la release"
    if p in ("MANIFESTE_DEPOT.json", "MANIFESTE_DEPOT.md"):
        return "MANIFEST", "manifeste du dépôt : instruments, empreintes, critère de fin"
    if p.endswith("_MATRIX.csv") or p == "CANDIDATE_PROFILES.csv":
        return "MANIFEST", "tableau d'envoi ou de profils, pseudonymisé"
    if p.startswith("audit/"):
        return "AUDIT_FIXTURE", "inventaire ou manifeste synthétique d'audit"
    if p.startswith("instruments/_FIXTURE/") or p.startswith("instruments/_MAQUETTE"):
        return "AUDIT_FIXTURE", "instrument ou maquette de test, données fictives"
    if p.startswith("instruments/EDS-NSI/tests/"):
        return "AUDIT_FIXTURE", "harnais NSI sur machine (complément facultatif)"
    if re.match(r"instruments/[^/]+/assemblages/", p):
        return "ASSEMBLY", "assemblage d'une version d'instrument"
    if re.match(r"instruments/[^/]+/(banque|formulaire|definition[^/]*)\.json$", p):
        return "INSTRUMENT_BANK", "source unique de l'instrument"
    if p.startswith("instruments/"):
        return "INSTRUMENT_BANK", "pièce de l'instrument"
    if p.startswith("referentiels/"):
        return "REFERENTIAL", "référentiel réglementaire ou de conception"
    if p.startswith("tests/"):
        return "TEST", "test de non-régression"
    if p.startswith("templates/"):
        return "TEMPLATE", "gabarit XeLaTeX des livrets"
    if p.startswith("assets/"):
        return "TEMPLATE", "marque et images de la collection"
    if p.startswith("scripts/"):
        return "SOURCE", "moteur : validation, composition, release, packs"
    if p in ("pytest.ini", ".gitignore"):
        return "SOURCE", "configuration du dépôt"
    return "DOCUMENTATION", "documentation gouvernante ou de conception"


def inventaire_fichiers() -> dict:
    entrees = []
    for p in fichiers_publics():
        if p.startswith("audit/"):
            continue  # les inventaires ne se décrivent pas eux-mêmes
        data = (RACINE / p).read_bytes()
        cat, role = categorie(p)
        entrees.append({"path": p, "sha256": hashlib.sha256(data).hexdigest(),
                        "size": len(data), "category": cat, "role": role})
    par_cat = {}
    for e in entrees:
        par_cat[e["category"]] = par_cat.get(e["category"], 0) + 1
    return {"schema": "nexus.audit.file_inventory", "produit_par": "scripts/audit_inventory.py",
            "racine": "docs/BILAN_DIAGNOSTIC_CL", "total": len(entrees),
            "par_categorie": dict(sorted(par_cat.items())), "fichiers": entrees}


# ─────────────────────────────────────────────── B · instruments

def _tests_citant(code: str) -> list[str]:
    motif = re.compile(r"(?<![\w-])" + re.escape(code) + r"(?![\w-])")
    return sorted(str(t.relative_to(RACINE)) for t in (RACINE / "tests").glob("test_*.py")
                  if motif.search(t.read_text(encoding="utf-8")))


def _livrets_par_instrument() -> dict[str, dict[str, set]]:
    """Depuis le plan de release : les PDF candidat et coach qui composent chaque version."""
    par = {}
    def ajouter(code, version, cand, coach):
        d = par.setdefault(f"{code}/{version}", {"candidat": set(), "coach": set()})
        d["candidat"].add(str(cand.relative_to(RACINE)))
        d["coach"].add(str(coach.relative_to(RACINE)))
    for (mat, profil, versions, _session) in REL.livrets_attendus():
        nom = REL.nom_livret(mat, profil, versions)
        sd = REL.sous_dossier_livret(mat, profil, versions)
        cand = REL.LIVRETS / REL.DOSSIER_PROFIL[profil] / sd / nom
        coach = REL.CORRECTIONS / REL.DOSSIER_PROFIL[profil] / sd / nom
        for code, version in versions:
            ajouter(code, version, cand, coach)
    ajouter("FR-POS", "standard", REL.LIVRETS / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf",
            REL.CORRECTIONS / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf")
    ajouter("FR-POS-ORAL", "standard", REL.LIVRETS / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf",
            REL.CORRECTIONS / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf")
    for profil, dossier in REL.DOSSIER_PROFIL.items():
        entree = REL.LIVRETS / dossier / "00_DOSSIER_ENTREE" / "DOSSIER_D_ENTREE_NEXUS.pdf"
        for code in ("QP", "MET"):
            d = par.setdefault(f"{code}/standard", {"candidat": set(), "coach": set()})
            d["candidat"].add(str(entree.relative_to(RACINE)))
    return par


def couverture_instruments() -> dict:
    cat = DIS.catalogue()
    modalites = LI.modalites()
    livrets = _livrets_par_instrument()
    instruments = []
    for d in DIF.dossiers():
        code = d.name
        entrees = [i for i in cat["instruments"] if i["code"] == code]
        sources = sorted(str(p.relative_to(RACINE)) for p in d.iterdir()
                         if p.is_file() and p.suffix == ".json")
        assemblages = sorted(str(p.relative_to(RACINE)) for p in (d / "assemblages").glob("*.json")) \
            if (d / "assemblages").is_dir() else []
        refs = sorted({e.get("source_cahier") for e in entrees if e.get("source_cahier")})
        for f in sources:
            try:
                src = json.loads((RACINE / f).read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if isinstance(src, dict) and src.get("source_cahier"):
                refs.append(f"{Path(f).name} : {src['source_cahier']}")
        officiels = [modalites["epreuves_terminales"][c]["intitule_officiel"]
                     for c in LI.EPREUVE_DE.get(code, []) if c in modalites["epreuves_terminales"]]
        versions = []
        for e in entrees:
            cle = f"{code}/{e['version']}"
            versions.append({"version": e["version"], "profils": e.get("profils", []),
                             "duree_cible_min": e.get("duree_cible_min"),
                             "perimetre": e.get("perimetre"), "support": e.get("support"),
                             "porte_items": e.get("porte_items"),
                             "candidate_pdf_paths": sorted(livrets.get(cle, {}).get("candidat", [])),
                             "coach_pdf_paths": sorted(livrets.get(cle, {}).get("coach", []))})
        statut = DIF.statut(code)
        instruments.append({"instrument_id": code, "versions": versions,
                            "profile_applicability": sorted({p for e in entrees for p in e.get("profils", [])}),
                            "source_bank": sources, "assembly": assemblages,
                            "tests_covering": _tests_citant(code),
                            "regulatory_source_references": sorted(set(refs)),
                            "official_exams": officiels,
                            "diffusable": bool(statut.get("diffusable")),
                            "diffusable_motifs": statut.get("motifs", [])})
    return {"schema": "nexus.audit.instrument_coverage", "produit_par": "scripts/audit_inventory.py",
            "catalogue": "referentiels/catalogue_instruments.json",
            "instrument_count": len(instruments),
            "variant_count": sum(len(i["versions"]) for i in instruments),
            "instruments": instruments}


# ─────────────────────────────────────────────── C · situations candidates

def _appels_de_tests() -> list[dict]:
    """Les appels au moteur dans les tests, avec leurs arguments littéraux."""
    appels = []
    noms = {"create_candidate_pack", "build_candidate_facts"}
    params = ["profil", "mode_ep", "spes_premiere", "spe_non_poursuivie", "spes_terminales",
              "eaf_due", "math_ea_due", "fr_pos_requis", "fr_mai_requis"]
    for t in sorted((RACINE / "tests").glob("test_*.py")):
        arbre = ast.parse(t.read_text(encoding="utf-8"))
        for fn in [n for n in ast.walk(arbre) if isinstance(n, ast.FunctionDef)]:
            for n in ast.walk(fn):
                if not (isinstance(n, ast.Call) and getattr(n.func, "attr", None) in noms):
                    continue
                faits = {}
                for i, a in enumerate(n.args[:len(params)]):
                    try:
                        faits[params[i]] = ast.literal_eval(a)
                    except ValueError:
                        pass
                for kw in n.keywords:
                    if kw.arg in params:
                        try:
                            faits[kw.arg] = ast.literal_eval(kw.value)
                        except ValueError:
                            pass
                if "profil" in faits:
                    appels.append({"test": f"{t.relative_to(RACINE)}::{fn.name}", "faits": faits})
    return appels


def _faits_normalises(f: dict) -> dict:
    return {"profil": f.get("profil"), "mode_ep": f.get("mode_ep"),
            "spes_premiere": sorted(f.get("spes_premiere") or []),
            "spe_non_poursuivie": PC._normaliser_spe(f.get("spe_non_poursuivie")),
            "spes_terminales": sorted(f.get("spes_terminales") or []),
            "eaf_due": f.get("eaf_due"), "math_ea_due": bool(f.get("math_ea_due", False)),
            "fr_pos_requis": bool(f.get("fr_pos_requis", False)),
            "fr_mai_requis": bool(f.get("fr_mai_requis", False))}


def scenarios() -> list[dict]:
    """Les situations candidates servies par le moteur, dérivées des spécialités valides."""
    spes = list(PC.SPECIALITES_VALIDES)
    base_triplet = ["MATH", "PC", "NSI"]
    out = []

    def ajouter(sid, **faits):
        out.append({"scenario_id": sid, "faits": faits})

    # Profil A (P1) : première partie.
    for mode in ("annuelle", "fin_cycle"):
        for abandon in base_triplet:
            ajouter(f"P1_{mode}_abandon-{abandon}", profil="P1", mode_ep=mode,
                    spes_premiere=base_triplet, spe_non_poursuivie=abandon, spes_terminales=[],
                    eaf_due="les_deux")
        ajouter(f"P1_{mode}_orientation-inconnue", profil="P1", mode_ep=mode,
                spes_premiere=base_triplet, spe_non_poursuivie="aucune", spes_terminales=[],
                eaf_due="les_deux")
    for s in spes:  # chaque spécialité au moins une fois, avec et sans mathématiques
        triplet = [s] + [x for x in ("MATH", "PC", "SVT", "SES") if x != s][:2]
        ajouter(f"P1_annuelle_spe-{s}", profil="P1", mode_ep="annuelle", spes_premiere=triplet,
                spe_non_poursuivie=triplet[-1], spes_terminales=[], eaf_due="les_deux")
    ajouter("P1_annuelle_sans-MATH_anticipee-SPECIFIQUES", profil="P1", mode_ep="annuelle",
            spes_premiere=["PC", "SVT", "SES"], spe_non_poursuivie="SES", spes_terminales=[],
            eaf_due="les_deux")
    for eaf in ("ecrit", "oral"):
        ajouter(f"P1_annuelle_EAF-{eaf}", profil="P1", mode_ep="annuelle", spes_premiere=base_triplet,
                spe_non_poursuivie="NSI", spes_terminales=[], eaf_due=eaf)

    # Profil B (P2) : deuxième partie.
    for mode in ("annuelle", "fin_cycle"):
        for paire in itertools.combinations(spes, 2):
            abandon = next(x for x in spes if x not in paire)
            ajouter(f"P2_{mode}_{'-'.join(paire)}_abandon-{abandon}", profil="P2", mode_ep=mode,
                    spes_premiere=list(paire) + [abandon], spe_non_poursuivie=abandon,
                    spes_terminales=list(paire), eaf_due="none")
    for eaf in ("ecrit", "oral", "les_deux"):
        ajouter(f"P2_annuelle_EAF-{eaf}", profil="P2", mode_ep="annuelle", spes_premiere=base_triplet,
                spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due=eaf)
    ajouter("P2_annuelle_MATH-EA-due_SPE", profil="P2", mode_ep="annuelle", spes_premiere=base_triplet,
            spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none", math_ea_due=True)
    ajouter("P2_annuelle_MATH-EA-due_SPECIFIQUES", profil="P2", mode_ep="annuelle",
            spes_premiere=["PC", "NSI", "SVT"], spe_non_poursuivie="SVT", spes_terminales=["PC", "NSI"],
            eaf_due="none", math_ea_due=True)
    ajouter("P2_annuelle_FR-POS", profil="P2", mode_ep="annuelle", spes_premiere=base_triplet,
            spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none", fr_pos_requis=True)
    ajouter("P2_annuelle_FR-MAI", profil="P2", mode_ep="annuelle", spes_premiere=base_triplet,
            spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none", fr_mai_requis=True)
    # Un P2 dont l'orientation terminale est connue a, par construction, une spécialité
    # non poursuivie connue : le moteur refuse l'inverse, et le scénario n'existe pas.

    # Profil C (P3) : baccalauréat en une session.
    for s in spes:
        triplet = [s] + [x for x in ("MATH", "PC", "SVT", "SES") if x != s][:2]
        ajouter(f"P3_spe-{s}", profil="P3", mode_ep="fin_cycle", spes_premiere=triplet,
                spe_non_poursuivie=triplet[-1], spes_terminales=triplet[:2], eaf_due="les_deux")
    ajouter("P3_sans-MATH_anticipee-SPECIFIQUES", profil="P3", mode_ep="fin_cycle",
            spes_premiere=["PC", "SVT", "SES"], spe_non_poursuivie="SES", spes_terminales=["PC", "SVT"],
            eaf_due="les_deux")
    ajouter("P3_FR-POS", profil="P3", mode_ep="fin_cycle", spes_premiere=base_triplet,
            spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="les_deux", fr_pos_requis=True)
    ajouter("P3_FR-MAI", profil="P3", mode_ep="fin_cycle", spes_premiere=base_triplet,
            spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="les_deux", fr_mai_requis=True)
    return out


def _noms_livrets_du_profil(profil: str) -> list[str]:
    """Tous les livrets candidats qu'un profil peut recevoir, d'après le plan de release."""
    noms = {"DOSSIER_D_ENTREE_NEXUS.pdf", "POSITIONNEMENT_FRANCAIS.pdf"}
    for (mat, prof, versions, _s) in REL.livrets_attendus():
        if prof == profil:
            noms.add(REL.nom_livret(mat, prof, versions))
    return sorted(noms)


def _libelle_instrument(x) -> str:
    """« CODE/version » quel que soit le format que le moteur renvoie pour un instrument."""
    if isinstance(x, (tuple, list)):
        return "/".join(str(e) for e in x[:2]) if len(x) >= 2 else str(x[0])
    if isinstance(x, dict):
        return "/".join(str(x[k]) for k in ("code", "version") if k in x)
    return str(x)


def evaluer(faits: dict, cat: dict, appels: list[dict]) -> dict:
    """Ce que le moteur décide pour une situation : obligations, diagnostics, livrets."""
    qp = PC.build_candidate_facts(candidat_id="CL-TEST-0000", **faits)
    analyse = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, cat)
    dues = analyse["epreuves_reglementaires_dues"]
    diags = analyse["diagnostics_nexus_utiles"]
    livrets = PC.map_instruments_to_booklets(diags, faits["profil"], REL.LIVRETS)
    selectionnes = [{"libelle": l, "fichier": p.name, "chemin_canonique": str(p.relative_to(RACINE)),
                     "variante": d} for l, p, d in livrets]
    choisis = {x["fichier"] for x in selectionnes}
    exclus = [n for n in _noms_livrets_du_profil(faits["profil"]) if n not in choisis]
    lignes = PC.lignes_diagnostics_famille(diags, cat, LI.duree_dossier_entree())
    normal = _faits_normalises(faits)
    preuves = sorted({a["test"] for a in appels if _faits_normalises(a["faits"]) == normal})
    return {"expected_official_obligations": [f"{c}/{v}" for c, v in dues],
            "expected_reported_to_end_of_cycle": [_libelle_instrument(x) for x in analyse.get("evaluations_reportees_fin_cycle", [])],
            "expected_nexus_diagnostics": [f"{c}/{v}" for c, v in diags],
            "expected_candidate_booklets": selectionnes,
            "expected_excluded_booklets": exclus,
            "family_manifest_lines": [{"libelle": l, "minutes": m} for l, m in lignes],
            "total_diagnostic_duration_min": sum(m for _, m in lignes),
            "tests_proving": preuves + ["tests/test_audit_inventory.py::test_couverture_candidats_synchronisee"]}


def couverture_candidats() -> dict:
    cat = DIS.catalogue()
    appels = _appels_de_tests()
    out = []
    for s in scenarios():
        out.append({"scenario_id": s["scenario_id"], "facts": s["faits"], **evaluer(s["faits"], cat, appels)})
    return {"schema": "nexus.audit.candidate_coverage", "produit_par": "scripts/audit_inventory.py",
            "note": "Les livrets sont les PDF canoniques de release/diagnostics-v2 ; aucun PDF "
                    "nominatif n'est matérialisé. Chaque scénario est recalculé par le moteur et "
                    "comparé à ce fichier par tests/test_audit_inventory.py.",
            "specialites_valides": list(PC.SPECIALITES_VALIDES),
            "scenario_count": len(out), "scenarios": out}


# ─────────────────────────────────────────────── D · golden packs synthétiques

GOLDEN_SCENARIOS = [
    ("P1_annuelle_specialite_abandonnee_connue", dict(profil="P1", mode_ep="annuelle", spes_premiere=["MATH", "HGGSP", "SES"], spe_non_poursuivie="SES", spes_terminales=[], eaf_due="les_deux")),
    ("P1_annuelle_orientation_inconnue", dict(profil="P1", mode_ep="annuelle", spes_premiere=["MATH", "HGGSP", "SES"], spe_non_poursuivie="aucune", spes_terminales=[], eaf_due="les_deux")),
    ("P1_fin_cycle", dict(profil="P1", mode_ep="fin_cycle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=[], eaf_due="les_deux")),
    ("P2_annuelle_standard", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none")),
    ("P2_fin_cycle", dict(profil="P2", mode_ep="fin_cycle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="none")),
    ("P2_EAF_exceptionnel_ecrit", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="ecrit")),
    ("P2_EAF_exceptionnel_oral", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="oral")),
    ("P2_EAF_les_deux", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="les_deux")),
    ("P2_maths_anticipee_SPE_exceptionnelle", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none", math_ea_due=True)),
    ("P2_maths_anticipee_SPECIFIQUES_exceptionnelle", dict(profil="P2", mode_ep="annuelle", spes_premiere=["PC", "NSI", "SVT"], spe_non_poursuivie="SVT", spes_terminales=["PC", "NSI"], eaf_due="none", math_ea_due=True)),
    ("P3_bac_en_une_session", dict(profil="P3", mode_ep="fin_cycle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="les_deux")),
]


def golden_packs() -> dict[str, dict]:
    cat = DIS.catalogue()
    appels = _appels_de_tests()
    packs = {}
    for rang, (sid, faits) in enumerate(GOLDEN_SCENARIOS, 1):
        cid = f"CL-TEST-{rang:04d}"
        e = evaluer(faits, cat, appels)
        packs[sid] = {"schema": "nexus.audit.golden_pack", "produit_par": "scripts/audit_inventory.py",
                      "golden_pack_id": sid, "identity": {"candidat": IDENTITE_FICTIVE, "candidat_id": cid,
                                                          "session": SESSION_FIXTURE, "fictional": True},
                      "export_directory": PC.nom_dossier_export(IDENTITE_FICTIVE, cid, SESSION_FIXTURE),
                      "facts": faits,
                      "official_obligations": e["expected_official_obligations"],
                      "reported_to_end_of_cycle": e["expected_reported_to_end_of_cycle"],
                      "diagnostics": e["expected_nexus_diagnostics"],
                      "booklets_selected": e["expected_candidate_booklets"],
                      "booklets_excluded": e["expected_excluded_booklets"],
                      "family_manifest_lines": e["family_manifest_lines"],
                      "total_diagnostic_duration_min": e["total_diagnostic_duration_min"],
                      "tests_proving": e["tests_proving"]}
    return packs


# ─────────────────────────────────────────────── écriture et vérification

def _json(x) -> str:
    return json.dumps(x, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def produits() -> dict[Path, str]:
    out = {AUDIT / "AUDIT_FILE_INVENTORY.json": _json(inventaire_fichiers()),
           AUDIT / "AUDIT_INSTRUMENT_COVERAGE.json": _json(couverture_instruments()),
           AUDIT / "AUDIT_CANDIDATE_COVERAGE.json": _json(couverture_candidats())}
    for sid, pack in golden_packs().items():
        out[GOLDEN / f"{sid}.json"] = _json(pack)
    return out


def main(argv: list[str]) -> int:
    derive = []
    for chemin, contenu in produits().items():
        if "--verifier" in argv:
            if not chemin.exists() or chemin.read_text(encoding="utf-8") != contenu:
                derive.append(chemin)
        else:
            chemin.parent.mkdir(parents=True, exist_ok=True)
            chemin.write_text(contenu, encoding="utf-8")
            print(f"  écrit : {chemin.relative_to(RACINE)}")
    if "--verifier" in argv:
        for c in derive:
            print(f"  dérive : {c.relative_to(RACINE)}")
        print("inventaires à jour" if not derive else f"{len(derive)} inventaire(s) à régénérer")
        return 1 if derive else 0
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
