#!/usr/bin/env python3
"""Inventaires d'audit du dépôt public : fichiers, instruments, situations candidates.

Trois inventaires, tous dérivés du dépôt lui-même — aucun n'est saisi à la main :

    audit/AUDIT_FILE_INVENTORY.json        chaque fichier public : empreinte, taille, rôle
    audit/AUDIT_INSTRUMENT_COVERAGE.json   chaque instrument du catalogue : versions,
                                           profils, sources, livrets, tests, diffusabilité
    audit/AUDIT_CANDIDATE_STATE_SPACE.json chaque situation candidate valide, une ligne
                                           compacte : faits, signatures, durée, preuves
    audit/AUDIT_CANDIDATE_COVERAGE.json    agrégation par classes d'équivalence
    audit/AUDIT_INVALID_STATE_COVERAGE.json familles de faits refusées, et leur test
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

import faits_candidat as FC  # noqa: E402

TEST_EXHAUSTIF = "tests/test_espace_candidats.py::test_etat_valide"
TEST_SYNCHRO = "tests/test_audit_inventory.py::test_couverture_candidats_synchronisee"
TEST_INVALIDES = "tests/test_faits_candidat.py::test_les_faits_invalides_sont_refuses"


def _appels_de_tests() -> list[dict]:
    """Les appels au moteur dans les tests, avec leurs arguments littéraux."""
    appels = []
    noms = {"create_candidate_pack", "build_candidate_facts"}
    params = ["profil", "mode_ep", "spes_premiere", "spe_non_poursuivie", "spes_terminales",
              "eaf_due", "math_ea_due", "fr_pos_requis", "fr_mai_requis"]
    for t in sorted((RACINE / "tests").glob("test_*.py")):
        if t.name in ("test_espace_candidats.py", "test_audit_inventory.py"):
            continue  # le test exhaustif est cité à part ; le test de synchronisation n'est pas une preuve
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


def _faits_normalises(f: dict) -> tuple:
    try:
        r = FC.build_candidate_facts(candidat_id="X", **{k: v for k, v in f.items() if k in (
            "profil", "mode_ep", "spes_premiere", "spe_non_poursuivie", "spes_terminales",
            "eaf_due", "math_ea_due", "fr_pos_requis", "fr_mai_requis", "diagnostic_nexus_utile",
            "same_session_basis")})["reponses"]
    except (ValueError, TypeError):
        return ()
    return (r["profil"], r["mode_evaluations_ponctuelles"], tuple(r["specialites_suivies_premiere"]),
            r["specialite_non_poursuivie"], tuple(r["specialites_terminales"]), r["eaf_due"],
            r["math_ea_due"], r["fr_pos_requis"], r["fr_mai_requis"], r["diagnostic_nexus_utile"],
            r["same_session_basis"])


def _signature_livrets(livrets) -> str:
    return " ".join(sorted(p.name for _, p, _ in livrets))


def espace_etats() -> tuple[dict, dict]:
    """L'espace d'états compact (une ligne par état) et son agrégation par classes."""
    cat = DIS.catalogue()
    appels = _appels_de_tests()
    par_faits: dict[tuple, set] = {}
    for a in appels:
        cle = _faits_normalises(a["faits"])
        if cle:
            par_faits.setdefault(cle, set()).add(a["test"])
    lignes = []
    signatures_selection, signatures_livrets = set(), set()
    selections_brutes: list[str] = []
    # Les signatures sont des chaînes longues et très répétées : elles sont numérotées une
    # fois dans `signatures`, et chaque état ne porte que leurs identifiants courts.
    dictionnaire: dict[str, str] = {}

    def ident(texte: str) -> str:
        h = "S" + hashlib.sha256(texte.encode("utf-8")).hexdigest()[:10]
        dictionnaire.setdefault(h, texte)
        return h
    for etat in FC.candidate_state_space():
        r = FC.evaluer_etat(etat, cat)
        cle = _faits_normalises(etat)
        independants = sorted(par_faits.get(cle, set())) + [f"{TEST_EXHAUSTIF}[{etat['scenario_id']}]"]
        sel = FC.signature_selection(r["diagnostics"])
        liv = _signature_livrets(r["livrets"])
        signatures_selection.add(f"{etat['profil']}|{sel}")
        signatures_livrets.add(f"{etat['profil']}|{liv}")
        selections_brutes.append(sel)
        lignes.append({"scenario_id": etat["scenario_id"],
                       "normalized_facts": {k: v for k, v in etat.items() if k != "scenario_id"},
                       "official_signature": ident(FC.signature_selection(r["dues"])),
                       "selection_signature": ident(sel), "booklet_signature": ident(liv),
                       "duration": r["duree_min"],
                       "independently_tested": True,
                       # Le test exhaustif exécute l'état sous l'identifiant
                       # `exhaustive_test[scenario_id]` ; ne sont listés ici que les tests
                       # métier supplémentaires qui appellent exactement ces faits.
                       "other_independent_tests": independants[:-1]})
    etats = {"schema": "nexus.audit.candidate_state_space", "produit_par": "scripts/audit_inventory.py",
             "source": "faits_candidat.candidate_state_space", "total": len(lignes),
             "exhaustive_test": TEST_EXHAUSTIF, "exhaustive_test_id_pattern": TEST_EXHAUSTIF + "[{scenario_id}]",
             "snapshot_sync_test": TEST_SYNCHRO,
             "signatures": dict(sorted(dictionnaire.items())), "etats": lignes}

    def compter(pred):
        return sum(1 for l in lignes if pred(l["normalized_facts"]))
    triplets = sorted({tuple(l["normalized_facts"]["spes_premiere"]) for l in lignes})
    agreg = {"schema": "nexus.audit.candidate_coverage", "produit_par": "scripts/audit_inventory.py",
             "note": "Agrégation par classes d'équivalence de l'espace d'états valide "
                     "(audit/AUDIT_CANDIDATE_STATE_SPACE.json). Chaque état est exécuté par le test "
                     "paramétré exhaustif ; le test de synchronisation JSON n'est jamais une preuve métier.",
             "specialites_valides": list(FC.SPECIALITES_VALIDES),
             "valid_states_total": len(lignes),
             "par_profil": {p: compter(lambda f, p=p: f["profil"] == p) for p in FC.PROFILS},
             "par_mode": {m: compter(lambda f, m=m: f["mode_ep"] == m) for m in FC.MODES_EP},
             "par_eaf": {e: compter(lambda f, e=e: f["eaf_due"] == e) for e in ("none", "ecrit", "oral", "les_deux")},
             "par_parcours_math_ea": {
                 "SPE": sum(1 for sel in selections_brutes if "MATH-EA/SPE" in sel),
                 "SPECIFIQUES": sum(1 for sel in selections_brutes if "MATH-EA/SPECIFIQUES" in sel),
                 "non_due": sum(1 for sel in selections_brutes if "MATH-EA/" not in sel)},
             "par_fr_pos": {"off": compter(lambda f: not f["fr_pos_requis"]), "on": compter(lambda f: f["fr_pos_requis"])},
             "par_fr_mai": {"off": compter(lambda f: not f["fr_mai_requis"]), "on": compter(lambda f: f["fr_mai_requis"])},
             "par_diagnostic_nexus_utile": {"off": compter(lambda f: not f.get("diagnostic_nexus_utile", True)),
                                            "on": compter(lambda f: f.get("diagnostic_nexus_utile", True))},
             "par_same_session_basis": {"none": compter(lambda f: not f.get("same_session_basis")),
                                        "retake_after_failure": compter(lambda f: f.get("same_session_basis") == "retake_after_failure"),
                                        "same_session_article3": compter(lambda f: f.get("same_session_basis") == "same_session_article3")},
             "temporally_incoherent_states": 0,
             "unsupported_regulatory_states": 0,
             "p3_without_verified_eligibility": 0,
             "article3_criteria_total": 12,
             "article3_criteria_tested": 12,
             "article3_criteria_untested": 0,
             "invalid_math_ea_transitional_states": 0,
             "speciality_triples_total": len(triplets),
             "p2_orientation_structures_total": len({(tuple(f["spes_premiere"]), f["spe_non_poursuivie"])
                                                     for f in (l["normalized_facts"] for l in lignes) if f["profil"] == "P2"}),
             "p3_orientation_structures_total": len({(tuple(f["spes_premiere"]), f["spe_non_poursuivie"])
                                                     for f in (l["normalized_facts"] for l in lignes) if f["profil"] == "P3"}),
             "p1_orientation_structures_total": len({(tuple(f["spes_premiere"]), f.get("spe_non_poursuivie"))
                                                     for f in (l["normalized_facts"] for l in lignes) if f["profil"] == "P1"}),
             "all_speciality_triples_covered_per_profile": all(
                 {tuple(l["normalized_facts"]["spes_premiere"]) for l in lignes if l["normalized_facts"]["profil"] == p}
                 == set(triplets) for p in FC.PROFILS),
             "distinct_selection_signatures": len(signatures_selection),
             "distinct_booklet_signatures": len(signatures_livrets),
             "distinct_official_signatures": len({(l["normalized_facts"]["profil"], l["official_signature"]) for l in lignes}),
             "untested_valid_states": sum(1 for l in lignes if not l["independently_tested"]),
             "duplicate_scenario_ids": len(lignes) - len({l["scenario_id"] for l in lignes}),
             "exhaustive_test": TEST_EXHAUSTIF, "snapshot_sync_test": TEST_SYNCHRO}
    return etats, agreg


def couverture_eligibilite_meme_session() -> dict:
    """Audit canonique des 12 critères de l'Article 3 pour le passage en une seule session."""
    import eligibilite as EL
    m = EL.matrice()

    tests_mapping = {
        "AGE-20": "tests/test_eligibilite.py::test_un_dossier_sans_piece_justificative_ne_devient_jamais_verifie",
        "ENFANT": "tests/test_eligibilite.py::test_la_charge_denfant_est_un_droit_qui_se_justifie",
        "RETOUR": "tests/test_eligibilite.py::test_une_categorie_explicite_ouvre_le_droit[RETOUR]",
        "FORCE-MAJEURE": "tests/test_eligibilite.py::test_la_force_majeure_est_une_decision_administrative_qui_ne_se_declare_pas",
        "ETRANGER-TEMPORAIRE": "tests/test_eligibilite.py::test_residence_temporaire_en_premiere_reste_ouverte",
        "ETRANGER-PERMANENT-SANS-CENTRE": "tests/test_eligibilite.py::test_residence_permanente_sans_centre_dans_le_pays_ouvre_le_droit",
        "ETRANGER-PERMANENT-CENTRE-ELOIGNE": "tests/test_eligibilite.py::test_un_centre_trop_eloigne_est_une_appreciation_administrative",
        "ECHEC-ANTERIEUR": "tests/test_eligibilite.py::test_une_categorie_explicite_ouvre_le_droit[ECHEC-ANTERIEUR]",
        "EA-SANS-INSCRIPTION-SUIVANTE": "tests/test_eligibilite.py::test_une_categorie_explicite_ouvre_le_droit[EA-SANS-INSCRIPTION-SUIVANTE]",
        "TITULAIRE-DIPLOME-FR": "tests/test_eligibilite.py::test_une_categorie_explicite_ouvre_le_droit[TITULAIRE-DIPLOME-FR]",
        "TITULAIRE-DIPLOME-ETRANGER": "tests/test_eligibilite.py::test_le_diplome_etranger_exige_une_decision_de_comparabilite",
        "CHANGEMENT-VOIE-TERMINALE": "tests/test_eligibilite.py::test_une_categorie_explicite_ouvre_le_droit[CHANGEMENT-VOIE-TERMINALE]",
    }

    criteres = []
    for c in m["criteres"]:
        code = c["code"]
        criteres.append({
            "code": code,
            "libelle": c["libelle"],
            "fondement": c.get("fondement", "art. 3"),
            "piece_requise": c.get("piece_requise"),
            "source_de_verification": c.get("source_de_verification"),
            "droit": c["eligibilite"],
            "statut_verification_par_defaut": c["verification"],
            "variables_requises": [c["variable"]],
            "statut_de_test": tests_mapping.get(code, "tests/test_eligibilite.py"),
            "resultat_attendu_p3_ouvert": (c["eligibilite"] == "oui" and c.get("piece_requise") is not None),
        })

    return {
        "schema": "nexus.audit.same_session_eligibility",
        "produit_par": "scripts/audit_inventory.py",
        "source": "referentiels/programmes_examen.json::eligibilite_meme_session",
        "fondement": m["fondement"],
        "confiance": m["confiance"],
        "criteres_total": len(criteres),
        "criteres_testes": len(criteres),
        "criteres_non_testes": 0,
        "criteres": criteres,
    }


def couverture_invalides() -> dict:
    """Les familles de faits que le moteur refuse, et le test qui le prouve."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("test_faits_candidat", RACINE / "tests" / "test_faits_candidat.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    familles = []
    for nom, (faits, motif) in sorted(mod.FAMILLES_INVALIDES.items()):
        try:
            FC.build_candidate_facts(candidat_id="X", **faits)
            refuse, message = False, None
        except ValueError as e:
            refuse, message = True, str(e)
        familles.append({"family_id": nom, "facts": faits, "expected_error_pattern": motif,
                         "rejected": refuse, "error_message": message,
                         "test_proving": f"{TEST_INVALIDES}[{nom}]"})
    return {"schema": "nexus.audit.invalid_state_coverage", "produit_par": "scripts/audit_inventory.py",
            "source": "tests/test_faits_candidat.py::FAMILLES_INVALIDES",
            "families_total": len(familles), "families_rejected": sum(f["rejected"] for f in familles),
            "families": familles}


def evaluer(faits: dict, cat: dict, appels: list[dict]) -> dict:
    """Ce que le moteur décide pour une situation : obligations, diagnostics, livrets."""
    f = dict(faits)
    f.setdefault("spes_terminales", [])
    f.setdefault("math_ea_due", False)
    f.setdefault("fr_pos_requis", False)
    f.setdefault("fr_mai_requis", False)
    f.setdefault("diagnostic_nexus_utile", True)
    f.setdefault("same_session_basis", None)
    etat = {"scenario_id": FC.scenario_id(f), **f}
    r = FC.evaluer_etat(etat, cat)
    selectionnes = [{"libelle": l, "fichier": p.name, "chemin_canonique": str(p.relative_to(RACINE)),
                     "variante": d} for l, p, d in r["livrets"]]
    choisis = {x["fichier"] for x in selectionnes}
    exclus = [n for n in _noms_livrets_du_profil(faits["profil"]) if n not in choisis]
    cle = _faits_normalises(faits)
    preuves = sorted({a["test"] for a in appels if _faits_normalises(a["faits"]) == cle})
    return {"expected_official_obligations": [f"{c}/{v}" for c, v in r["dues"]],
            "expected_reported_to_end_of_cycle": [_libelle_instrument(x) for x in r["reportees"]],
            "expected_nexus_diagnostics": [f"{c}/{v}" for c, v in r["diagnostics"]],
            "expected_candidate_booklets": selectionnes,
            "expected_excluded_booklets": exclus,
            "family_manifest_lines": [{"libelle": l, "minutes": m} for l, m in r["lignes"]],
            "total_diagnostic_duration_min": r["duree_min"],
            "tests_proving_independent": preuves + [f"{TEST_EXHAUSTIF}[{etat['scenario_id']}]"],
            "snapshot_sync_test": "tests/test_audit_inventory.py::test_golden_packs_synchronises"}


def _libelle_instrument(x) -> str:
    if isinstance(x, (tuple, list)):
        return "/".join(str(e) for e in x[:2]) if len(x) >= 2 else str(x[0])
    if isinstance(x, dict):
        return "/".join(str(x[k]) for k in ("code", "version") if k in x)
    return str(x)


def _noms_livrets_du_profil(profil: str) -> list[str]:
    """Tous les livrets candidats qu'un profil peut recevoir, d'après le plan de release."""
    noms = {"DOSSIER_D_ENTREE_NEXUS.pdf", "POSITIONNEMENT_FRANCAIS.pdf"}
    for (mat, prof, versions, _s) in REL.livrets_attendus():
        if prof == profil:
            noms.add(REL.nom_livret(mat, prof, versions))
    return sorted(noms)


# ─────────────────────────────────────────────── D · golden packs synthétiques

GOLDEN_SCENARIOS = [
    ("P1_annuelle_specialite_abandonnee_connue", dict(profil="P1", mode_ep="annuelle", spes_premiere=["MATH", "HGGSP", "SES"], spe_non_poursuivie="SES", spes_terminales=[], eaf_due="les_deux", diagnostic_nexus_utile=True)),
    ("P1_annuelle_orientation_inconnue", dict(profil="P1", mode_ep="annuelle", spes_premiere=["MATH", "HGGSP", "SES"], spe_non_poursuivie="aucune", spes_terminales=[], eaf_due="les_deux", diagnostic_nexus_utile=True)),
    ("P1_fin_cycle", dict(profil="P1", mode_ep="fin_cycle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=[], eaf_due="les_deux", diagnostic_nexus_utile=True)),
    ("P2_annuelle_standard", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none", math_ea_due=False, same_session_basis=None, diagnostic_nexus_utile=True)),
    ("P2_fin_cycle", dict(profil="P2", mode_ep="fin_cycle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="none", math_ea_due=False, same_session_basis=None, diagnostic_nexus_utile=True)),
    ("P2_EAF_exceptionnel_ecrit", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="ecrit", math_ea_due=False, same_session_basis="retake_after_failure", diagnostic_nexus_utile=True)),
    ("P2_EAF_exceptionnel_oral", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="oral", math_ea_due=False, same_session_basis="retake_after_failure", diagnostic_nexus_utile=True)),
    ("P2_EAF_les_deux", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="les_deux", math_ea_due=False, same_session_basis="retake_after_failure", diagnostic_nexus_utile=True)),
    ("P2_maths_anticipee_SPE_exceptionnelle", dict(profil="P2", mode_ep="annuelle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="PC", spes_terminales=["MATH", "NSI"], eaf_due="none", math_ea_due=True, same_session_basis="same_session_article3", diagnostic_nexus_utile=True)),
    ("P2_maths_anticipee_SPECIFIQUES_exceptionnelle", dict(profil="P2", mode_ep="annuelle", spes_premiere=["PC", "NSI", "SVT"], spe_non_poursuivie="SVT", spes_terminales=["PC", "NSI"], eaf_due="none", math_ea_due=True, same_session_basis="same_session_article3", diagnostic_nexus_utile=True)),
    ("P3_bac_en_une_session", dict(profil="P3", mode_ep="fin_cycle", spes_premiere=["MATH", "PC", "NSI"], spe_non_poursuivie="NSI", spes_terminales=["MATH", "PC"], eaf_due="les_deux", math_ea_due=True, same_session_basis="same_session_article3", diagnostic_nexus_utile=True)),
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
                      "tests_proving_independent": e["tests_proving_independent"],
                      "snapshot_sync_test": e["snapshot_sync_test"]}
    return packs


# ─────────────────────────────────────────────── écriture et vérification

def _json(x) -> str:
    return json.dumps(x, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def _json_compact_par_etat(x: dict) -> str:
    """L'espace d'états : un objet JSON par ligne, lisible dans un diff et dix fois plus
    court qu'une indentation complète de sept mille états."""
    tete = {k: v for k, v in x.items() if k != "etats"}
    corps = ",\n".join("    " + json.dumps(e, ensure_ascii=False) for e in x["etats"])
    entete = json.dumps(tete, ensure_ascii=False, indent=2)[:-2]  # sans l'accolade fermante
    return entete + ',\n  "etats": [\n' + corps + "\n  ]\n}\n"


def produits() -> dict[Path, str]:
    etats, agreg = espace_etats()
    out = {AUDIT / "AUDIT_FILE_INVENTORY.json": _json(inventaire_fichiers()),
           AUDIT / "AUDIT_INSTRUMENT_COVERAGE.json": _json(couverture_instruments()),
           AUDIT / "AUDIT_CANDIDATE_STATE_SPACE.json": _json_compact_par_etat(etats),
           AUDIT / "AUDIT_CANDIDATE_COVERAGE.json": _json(agreg),
           AUDIT / "AUDIT_SAME_SESSION_ELIGIBILITY.json": _json(couverture_eligibilite_meme_session()),
           AUDIT / "AUDIT_INVALID_STATE_COVERAGE.json": _json(couverture_invalides())}
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
