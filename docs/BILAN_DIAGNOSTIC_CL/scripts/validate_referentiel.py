#!/usr/bin/env python3
"""Contrôles de cohérence du référentiel de compétences.

Livrable de la Porte 1. Importé par scripts/validate_instrument.py (Porte 1c) :
ce module ne sera pas réécrit.

Aucun seuil, durée ou intitulé n'est codé en dur ici : tout est lu depuis
referentiels/competences.json (conventions, règles de couverture, écarts déclarés).
La seule donnée inscrite dans ce fichier est la liste des compétences telles que
le Cahier § 7 les énumère, qui sert de témoin : toute compétence absente est une
omission, toute compétence surnuméraire doit porter un écart déclaré.

Sortie : code 0 si aucune erreur, 1 sinon. Les avertissements ne bloquent pas.
"""
from __future__ import annotations
import json, re, sys, unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
REFERENTIEL = RACINE / "referentiels" / "competences.json"
CODES_ERREUR = RACINE / "referentiels" / "codes_erreur.json"
TERMES_BLOQUANTS = RACINE / "referentiels" / "termes_bloquants.json"
CATALOGUE = RACINE / "referentiels" / "catalogue_instruments.json"
REGLES_BILAN = RACINE / "referentiels" / "regles_bilan.json"
CAHIER = RACINE / "cahier.md"

# Témoin : compétences énumérées par les tableaux du Cahier § 7, verbatim.
# Ne pas amender sans amender le Cahier ; tout ajout doit porter un ecart_cahier.
COMPETENCES_CAHIER = {
    "FR-EAF":    "COMP LANG GRAM ANAL ARGU REDA CULT",
    "FR-MAI":    "LANG LEXA COMPA SYNT ARGU ORAL",
    "PHI":       "NOT PROB ARGU TEXT DISS REP",
    "TC-ES":     "MAT SON TERR INFO DEM",
    "EDS-MATH":  "CALC FONC SUIT TRIG GEO PROB ANA ALGO RAIS",
    "EDS-PC":    "QUANT MAT MOUV ENER OND EXP RES",
    "EDS-NSI":   "REPR PYTH TYPE ALGO ARCH WEB POO PROG",
    "EDS-SVT":   "GEN TERR ECO CORP DOC SCI REDA",
    "EDS-SES":   "ECO SOC POL STAT MOB DOCU RAIS",
    "EDS-HGGSP": "CONN REP DOC DISS INFO",
    "EDS-HLP":   "THEM LECT INTER ESSAI CULT LANG",
}


def sans_accent(s: str) -> str:
    return unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()


def charger(chemin: Path = REFERENTIEL) -> dict:
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def normaliser(s: str) -> str:
    """Minuscules, accents retirés, espaces réduits — cf. termes_bloquants.conventions."""
    s = unicodedata.normalize("NFD", s.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s)


def occurrences(plat: str, e: dict) -> list[tuple[int, int, str]]:
    """(début, fin, motif affiché) de chaque motif littéral ou regex de l'expression."""
    out = []
    for m in [e["motif"], *e.get("variantes", [])]:
        mn = normaliser(m)
        i = plat.find(mn)
        if i >= 0:
            out.append((i, i + len(mn), m))
    for r in e.get("regex", []):
        try:
            mo = re.search(r, plat)
        except re.error:
            continue  # signalé par controler_termes_bloquants, pas ici
        if mo:
            out.append((mo.start(), mo.end(), f"/{r}/"))
    return out


def exception_applicable(fenetre: str, e: dict, perimetre: str | None) -> dict | None:
    """Première exception de domaine satisfaite par la fenêtre de contexte, pour ce périmètre."""
    for exc in e["exceptions_domaine"]:
        if perimetre is not None and perimetre not in exc["perimetres"]:
            continue
        if perimetre is None and exc["perimetres"]:
            continue
        if re.search(exc["regex"], fenetre):
            return exc
    return None


def chercher_termes(texte: str, contexte: str, tb: dict, ou: str,
                    perimetre: str | None = None) -> list[str]:
    """Occurrences interdites dans ce contexte, avec 60 caractères de contexte de part et d'autre.

    Une occurrence dont la fenêtre satisfait une exception applicable au périmètre passe.
    """
    n = tb["conventions"]["controle"]["contexte_caracteres"]
    plat = normaliser(texte)
    trouves = []
    for e in tb["expressions"]:
        if contexte not in e["contexte_interdit"]:
            continue
        for debut, fin, affiche in occurrences(plat, e):
            fenetre = plat[max(0, debut - n): fin + n]
            if exception_applicable(fenetre, e, perimetre):
                continue
            trouves.append(f'{ou} : expression interdite « {affiche} » ({e["categorie"]}) '
                           f'dans « …{fenetre}… »')
    return trouves


def controler(ref: dict) -> tuple[list[str], list[str]]:
    err: list[str] = []
    avert: list[str] = []

    conv = ref["conventions"]
    blocs_ok = set(conv["blocs"])
    conf_ok = set(conv["confiance_programme"])
    niv_ok = set(conv["niveaux_programme"])
    types_ok = set(conv["types_competence"])
    etats_ref = {"evaluee", "hors_version"}
    ecarts = {e["ref"] for e in ref["ecarts_cahier"]} | {e["ref"] for e in ref.get("ecarts_prompt", [])}

    codes_per = [p["code"] for p in ref["perimetres"]]
    if len(codes_per) != len(set(codes_per)):
        err.append("codes de périmètre non uniques")
    manquants = set(COMPETENCES_CAHIER) - set(codes_per)
    if manquants:
        err.append(f"périmètres du Cahier § 7 absents : {sorted(manquants)}")

    for p in ref["perimetres"]:
        pc = p["code"]
        for champ in ("code", "libelle", "prefixe_item", "niveaux_item",
                      "profils", "versions", "source_cahier", "competences"):
            if champ not in p:
                err.append(f"{pc} : champ obligatoire absent « {champ} »")
        for n in p.get("niveaux_item", []):
            if n not in niv_ok:
                err.append(f"{pc} : niveau_item inconnu « {n} »")

        versions = p["versions"]
        codes_c = [c["code"] for c in p["competences"]]
        if len(codes_c) != len(set(codes_c)):
            err.append(f"{pc} : codes de compétence non uniques")

        # Témoin Cahier § 7 : omissions bloquantes, ajouts à justifier
        if pc in COMPETENCES_CAHIER:
            attendu = set(COMPETENCES_CAHIER[pc].split())
            obtenu = set(codes_c)
            for code in sorted(attendu - obtenu):
                if not any(code in e.get("consequence", "") + e.get("arbitrage", "")
                           for e in ref["ecarts_cahier"]):
                    err.append(f"{pc}/{code} : compétence du Cahier § 7 absente sans écart déclaré")
            for code in sorted(obtenu - attendu):
                c = next(x for x in p["competences"] if x["code"] == code)
                if "ecart_cahier" not in c:
                    err.append(f"{pc}/{code} : compétence surnuméraire au Cahier § 7 sans « ecart_cahier »")

        for c in p["competences"]:
            r = f"{pc}/{c['code']}"
            for champ in ("code", "intitule", "type", "etat_par_version", "blocs", "chapitres"):
                if champ not in c:
                    err.append(f"{r} : champ obligatoire absent « {champ} »")
            code = c.get("code", "")
            compose = "-" in code
            if not re.fullmatch(r"[A-Z]{3,5}(-[A-Z]{3,5})?", code):
                err.append(f"{r} : code hors format [A-Z]{{3,5}} ou [A-Z]{{3,5}}-[A-Z]{{3,5}}")
            elif compose and not c.get("evaluee_par"):
                # Un code composé ne se découpe pas dans un item_id, dont le format est
                # PREFIXE-NIVEAU-COMPETENCE-NN : il n'est admis que pour une compétence
                # mesurée hors items, par une grille déclarée (EC-25).
                err.append(f"{r} : code composé réservé aux compétences mesurées par une "
                           f"grille externe ; celle-ci ne déclare pas « evaluee_par »")
            if c.get("type") not in types_ok:
                err.append(f"{r} : type inconnu « {c.get('type')} »")
            if c.get("ecart_cahier") and c["ecart_cahier"] not in ecarts:
                err.append(f"{r} : écart « {c['ecart_cahier']} » non déclaré")

            etats = c.get("etat_par_version", {})
            if set(etats) != set(versions):
                err.append(f"{r} : etat_par_version couvre {sorted(etats)} au lieu de {sorted(versions)}")
            for v, e in etats.items():
                if e not in etats_ref:
                    err.append(f"{r}/{v} : état « {e} » interdit dans le référentiel "
                               f"(« non_evaluee » est un état du moteur, pas du référentiel)")

            transversal = c.get("type") == "indicateur_transversal"
            # EC-25 — une compétence dont evaluee_par nomme une grille coach n'a ni bloc ni
            # niveau d'item, quelle que soit sa catégorie : elle est mesurée par des critères.
            hors_items = bool(c.get("grille_externe")) and c.get("evaluee_par") != "criteres_C"
            b = c.get("blocs")

            if hors_items and not transversal:
                if c.get("niveaux_items"):
                    err.append(f"{r} : compétence mesurée par la grille "
                               f"{c['grille_externe']} : « niveaux_items » n'a pas de sens")
                vides = [v for v, lst in (b or {}).items() if lst] if isinstance(b, dict) \
                    else list(b or [])
                if vides:
                    err.append(f"{r} : compétence mesurée par la grille "
                               f"{c['grille_externe']} : blocs {vides} inattendus")
            elif transversal:
                if "evaluee_par" not in c:
                    err.append(f"{r} : indicateur transversal sans « evaluee_par »")
                if c.get("evaluee_par") == "criteres_C" and "code_critere" not in c:
                    err.append(f"{r} : indicateur adossé aux grilles C sans « code_critere »")
                if "niveaux_items" in c:
                    err.append(f"{r} : un indicateur transversal ne porte pas de « niveaux_items »")
            else:
                if versions == ["standard"]:
                    if not isinstance(b, list):
                        err.append(f"{r} : blocs doit être une liste hors périmètre versionné")
                    elif not b:
                        err.append(f"{r} : aucun bloc affecté")
                    else:
                        for x in b:
                            if x not in blocs_ok:
                                err.append(f"{r} : bloc inconnu « {x} »")
                else:
                    if not isinstance(b, dict):
                        err.append(f"{r} : blocs doit être un objet indexé par version")
                    elif set(b) != set(versions):
                        err.append(f"{r} : blocs couvre {sorted(b)} au lieu de {sorted(versions)}")
                    else:
                        for v, lst in b.items():
                            for x in lst:
                                if x not in blocs_ok:
                                    err.append(f"{r}/{v} : bloc inconnu « {x} »")
                            if bool(lst) != (etats.get(v) == "evaluee"):
                                err.append(f"{r}/{v} : blocs={lst} incohérent avec état « {etats.get(v)} »")
                    ni = c.get("niveaux_items")
                    if ni is None:
                        err.append(f"{r} : « niveaux_items » absent (obligatoire hors périmètre standard)")
                    elif set(ni) != set(versions):
                        err.append(f"{r} : niveaux_items couvre {sorted(ni)} au lieu de {sorted(versions)}")
                    else:
                        for v, lst in ni.items():
                            for n in lst:
                                if n not in p["niveaux_item"]:
                                    err.append(f"{r}/{v} : niveau « {n} » hors niveaux_item du périmètre")
                            if bool(lst) != (etats.get(v) == "evaluee"):
                                err.append(f"{r}/{v} : niveaux_items={lst} incohérent avec état « {etats.get(v)} »")

                    # Un intitulé décrit le périmètre réellement évaluable de la version
                    # passée : un candidat N1 ne doit pas lire qu'une compétence porte sur
                    # une notion de Terminale qu'aucun item de son assemblage ne mesurait.
                    ipv = c.get("intitule_par_version") or {}
                    for v, lst in (ni or {}).items():
                        if etats.get(v) != "evaluee":
                            continue
                        mentionne = "Terminale" in c["intitule"]
                        if mentionne and "T" not in (lst or []):
                            court = ipv.get(v)
                            if not court:
                                err.append(f"{r}/{v} : l'intitulé annonce un contenu de "
                                           f"Terminale alors que la version n'assemble "
                                           f"aucun item de ce niveau — « intitule_par_version"
                                           f".{v} » est obligatoire")
                            elif "Terminale" in court:
                                err.append(f"{r}/{v} : l'intitulé versionné annonce encore "
                                           f"un contenu de Terminale")
                        elif not mentionne and v in ipv:
                            err.append(f"{r}/{v} : intitulé versionné sans objet, "
                                       f"l'intitulé de référence ne mentionne pas Terminale")
                    for v in ipv:
                        if v not in versions:
                            err.append(f"{r} : intitulé versionné pour « {v} », "
                                       f"hors des versions du périmètre")

            chapitres = c.get("chapitres") or []
            if not chapitres:
                err.append(f"{r} : aucun chapitre rattaché")
            for ch in chapitres:
                for champ in ("intitule", "programme", "confiance"):
                    if champ not in ch:
                        err.append(f"{r} : chapitre sans « {champ} »")
                cf = ch.get("confiance")
                if cf not in conf_ok:
                    err.append(f"{r} : confiance inconnue « {cf} »")
                if cf in ("moyenne", "a_verifier") and "note" not in ch:
                    err.append(f"{r} : chapitre en confiance « {cf} » sans note explicative")
                if "niveau" in ch and ch["niveau"] not in p["niveaux_item"]:
                    err.append(f"{r} : chapitre de niveau « {ch['niveau']} » hors niveaux_item")
                if "paliers" in ch:
                    for pal in ch["paliers"]:
                        if pal not in conv["paliers"]:
                            err.append(f"{r} : palier inconnu « {pal} »")

    return err, avert


def controler_codes_erreur(ce: dict, ref: dict, tb: dict) -> tuple[list[str], list[str]]:
    err: list[str] = []
    avert: list[str] = []

    connues = {f"{p['code']}/{c['code']}" for p in ref["perimetres"] for c in p["competences"]}
    perimetres = {p["code"] for p in ref["perimetres"]}

    for m, meta in ce["matieres"].items():
        for pc in meta["perimetres"]:
            if pc not in perimetres:
                err.append(f"codes_erreur : matière {m} rattachée au périmètre inconnu « {pc} »")

    vus: set[str] = set()
    couverture: dict[str, int] = {p: 0 for p in perimetres}
    for c in ce["codes"]:
        code = c.get("code", "?")
        if code in vus:
            err.append(f"codes_erreur : code dupliqué « {code} »")
        vus.add(code)
        for champ in ("code", "matiere", "libelle", "description_observable",
                      "competences_concernees", "exemple"):
            if not c.get(champ):
                err.append(f"{code} : champ obligatoire absent ou vide « {champ} »")
        if c.get("matiere") not in ce["matieres"]:
            err.append(f"{code} : matière inconnue « {c.get('matiere')} »")
        elif not code.startswith(c["matiere"] + "-ERR-"):
            err.append(f"{code} : ne respecte pas le format {c['matiere']}-ERR-LIBELLE")
        if len(c.get("libelle", "").split()) > 6:
            err.append(f"{code} : libellé de plus de six mots ({len(c['libelle'].split())})")
        touches = set()
        for cc in c.get("competences_concernees", []):
            if cc not in connues:
                err.append(f"{code} : compétence inconnue « {cc} »")
            else:
                touches.add(cc.split("/")[0])
        if c.get("matiere") in ce["matieres"]:
            attendus = set(ce["matieres"][c["matiere"]]["perimetres"])
            if not touches <= attendus:
                err.append(f"{code} : compétences hors des périmètres de la matière {sorted(touches - attendus)}")
        for pc in touches:
            couverture[pc] += 1
        # Les libellés sont recopiés dans le bilan
        for pc in (touches or {None}):
            err.extend(chercher_termes(c.get("libelle", ""), "libelle_code_erreur", tb,
                                       f"{code} (libellé)", pc))

    minimum = 8
    for pc, n in sorted(couverture.items()):
        if n < minimum:
            err.append(f"codes_erreur : périmètre {pc} couvert par {n} code(s), minimum {minimum}")
    return err, avert


def controler_termes_bloquants(tb: dict, ref: dict | None = None) -> tuple[list[str], list[str]]:
    err: list[str] = []
    avert: list[str] = []
    contextes = set(tb["conventions"]["contextes"])
    vus: set[str] = set()
    for e in tb["expressions"]:
        m = e.get("motif", "?")
        for champ in ("motif", "categorie", "contexte_interdit", "exceptions_domaine", "source"):
            if champ not in e:
                err.append(f"termes_bloquants : « {m} » sans champ « {champ} »")
        contextes_sensibles = {"enonce_candidat", "cle_correcteur"}
        if len(m.split()) < 2 and set(e.get("contexte_interdit", [])) & contextes_sensibles:
            err.append(f"termes_bloquants : « {m} » est un mot isolé interdit dans un contexte "
                       f"où des énoncés disciplinaires apparaissent — restreindre à la prose de "
                       f"bilan et aux descripteurs, ou en faire une expression")
        if e.get("categorie") not in tb["conventions"]["categories"]:
            err.append(f"termes_bloquants : « {m} » — catégorie inconnue « {e.get('categorie')} »")
        for r in e.get("regex", []):
            try:
                re.compile(r)
            except re.error as exc:
                err.append(f"termes_bloquants : « {m} » — expression régulière invalide ({exc})")
        for exc in e.get("exceptions_domaine", []):
            for champ in ("regex", "perimetres", "justification", "exemple"):
                if champ not in exc:
                    err.append(f"termes_bloquants : exception de « {m} » sans champ « {champ} »")
            if "regex" in exc:
                try:
                    re.compile(exc["regex"])
                except re.error as e2:
                    err.append(f"termes_bloquants : exception de « {m} » — regex invalide ({e2})")
            if not exc.get("perimetres"):
                err.append(f"termes_bloquants : exception de « {m} » sans périmètre d'application")
            # Une exception qui ne sert jamais est décorative : elle donne une fausse
            # impression de couverture. Son exemple doit déclencher un motif parent.
            ex = normaliser(exc.get("exemple", ""))
            try:
                couvert = bool(re.search(exc["regex"], ex)) if ex else False
            except (re.error, KeyError):
                couvert = True  # regex invalide déjà signalée ci-dessus
            if ex:
                if not occurrences(ex, e):
                    err.append(f"termes_bloquants : exception de « {m} » décorative — son exemple "
                               f"« {exc['exemple']} » ne déclenche aucun motif de l'expression")
                elif not couvert:
                    err.append(f"termes_bloquants : exception de « {m} » — son exemple "
                               f"« {exc['exemple']} » n'est pas couvert par sa propre expression régulière")
        for c in e.get("contexte_interdit", []):
            if c not in contextes:
                err.append(f"termes_bloquants : « {m} » — contexte inconnu « {c} »")
        if not e.get("contexte_interdit"):
            err.append(f"termes_bloquants : « {m} » sans contexte interdit")
        if ref is not None:
            connus = {p["code"] for p in ref["perimetres"]}
            for exc in e.get("exceptions_domaine", []):
                for pc in exc.get("perimetres", []):
                    if pc not in connus:
                        err.append(f"termes_bloquants : exception de « {m} » — périmètre inconnu « {pc} »")
        for v in [m, *e.get("variantes", [])]:
            n = normaliser(v)
            if n in vus:
                err.append(f"termes_bloquants : motif dupliqué « {v} »")
            vus.add(n)
            if normaliser(v) != v:
                err.append(f"termes_bloquants : « {v} » doit être écrit sous forme normalisée (minuscules, sans accent)")
    return err, avert


def controler_catalogue(cat: dict, ref: dict) -> tuple[list[str], list[str]]:
    err: list[str] = []
    avert: list[str] = []
    per = {p["code"]: p for p in ref["perimetres"]}
    blocs_ok = set(ref["conventions"]["blocs"])
    supports = set(cat["conventions"]["supports"])
    materiels = set(cat["conventions"]["materiel"])
    f = cat["conventions"]["fenetre_duree"]
    if not 0 < f["ratio_min"] <= f["ratio_max"] <= 1:
        err.append("catalogue : ratios de fenêtre de durée incohérents")
    for cle in ("duree_min", "duree_max", "fenetre"):
        if cle in f:
            err.append(f"catalogue : la fenêtre de durée ne doit pas être stockée (champ « {cle} »)")

    vus: set[tuple[str, str]] = set()
    vus_per: dict[str, set[str]] = {}
    for i in cat["instruments"]:
        ref_i = f"{i.get('code')}/{i.get('version')}"
        if (i["code"], i["version"]) in vus:
            err.append(f"catalogue : enregistrement dupliqué {ref_i}")
        vus.add((i["code"], i["version"]))
        if not isinstance(i.get("duree_cible_min"), int) or i["duree_cible_min"] <= 0:
            err.append(f"{ref_i} : duree_cible_min absente ou non entière")
        if i.get("support") not in supports:
            err.append(f"{ref_i} : support inconnu « {i.get('support')} »")
        if i.get("materiel") not in materiels:
            err.append(f"{ref_i} : matériel inconnu « {i.get('materiel')} »")
        for b in i.get("blocs_attendus", []):
            if b not in blocs_ok:
                err.append(f"{ref_i} : bloc attendu inconnu « {b} »")
        if i.get("porte_items") and not i.get("blocs_attendus"):
            err.append(f"{ref_i} : porte des items mais n'attend aucun bloc")
        if not i.get("porte_items") and i.get("blocs_attendus"):
            err.append(f"{ref_i} : ne porte pas d'items mais déclare des blocs")
        pc = i.get("perimetre")
        if pc:
            if pc not in per:
                err.append(f"{ref_i} : périmètre « {pc} » inconnu du référentiel")
            else:
                if i["version"] not in per[pc]["versions"]:
                    err.append(f"{ref_i} : version absente des versions du périmètre {sorted(per[pc]['versions'])}")
                if set(i.get("profils", [])) - set(per[pc]["profils"]):
                    err.append(f"{ref_i} : profils hors de ceux du périmètre {sorted(per[pc]['profils'])}")
                vus_per.setdefault(pc, set()).add(i["version"])
        elif i.get("porte_items"):
            err.append(f"{ref_i} : porte des items mais périmètre null")

    for pc, p in per.items():
        manquantes = set(p["versions"]) - vus_per.get(pc, set())
        if manquantes:
            err.append(f"catalogue : périmètre {pc}, version(s) sans enregistrement {sorted(manquantes)}")
    return err, avert


def resume(ref: dict) -> str:
    comps = [(p, c) for p in ref["perimetres"] for c in p["competences"]]
    par_type = {t: [c for _, c in comps if c["type"] == t]
                for t in ref["conventions"]["types_competence"]}
    chapitres = [ch for _, c in comps for ch in c["chapitres"]]
    par_conf = {k: sum(1 for ch in chapitres if ch["confiance"] == k)
                for k in ref["conventions"]["confiance_programme"]}
    hv = sum(1 for _, c in comps for e in c["etat_par_version"].values() if e == "hors_version")
    lignes = [
        f"Périmètres                    : {len(ref['perimetres'])}",
        f"Compétences                   : {len(comps)}  ("
        + " + ".join(f"{len(v)} {k}" for k, v in par_type.items()) + ")",
        f"Chapitres rattachés           : {len(chapitres)}",
        "Confiance programme           : " + "  |  ".join(f"{k} : {v}" for k, v in par_conf.items()),
        f"Couples compétence × version hors_version : {hv}",
        f"Écarts au Cahier déclarés     : {len(ref['ecarts_cahier'])}",
        f"Écarts au prompt déclarés     : {len(ref.get('ecarts_prompt', []))}",
    ]
    return "\n".join(lignes)


def normaliser_cahier(t: str) -> str:
    """Texte du Cahier comparable : échappements pandoc retirés, blancs réduits."""
    t = t.replace("\\", "").replace("\u2019", "'").replace("\u2018", "'")
    return re.sub(r"\s+", " ", t).strip()


def cellules_cahier(chemin: Path) -> list[str]:
    """Cellules des tableaux du Cahier, recollées colonne par colonne.

    Pandoc rend les tableaux du Cahier en colonnes de largeur fixe : le texte d'une
    cellule est réparti sur plusieurs lignes, entrecoupé du texte des cellules voisines.
    Une transcription tirée d'un tableau ne s'y retrouve donc pas par simple recherche
    de sous-chaîne. La ligne de tirets qui ouvre le tableau donne les bornes des
    colonnes ; les lignes suivantes sont découpées à ces bornes et recollées.
    """
    lignes = chemin.read_text(encoding="utf-8").splitlines()
    cellules, i = [], 0
    while i < len(lignes):
        if not re.fullmatch(r"\s*-{2,}(?:\s+-{2,})+\s*", lignes[i]):
            i += 1
            continue
        bornes = [(m.start(), m.end()) for m in re.finditer(r"-+", lignes[i])]
        i += 1
        rangee = [[] for _ in bornes]

        def vider():
            for col in rangee:
                t = normaliser_cahier(" ".join(col))
                if t:
                    cellules.append(t)

        while i < len(lignes):
            if re.fullmatch(r"\s*-{2,}[-\s]*", lignes[i]):
                vider()
                i += 1
                break
            if not lignes[i].strip():
                vider()
                rangee = [[] for _ in bornes]
                i += 1
                continue
            for j, (a, b) in enumerate(bornes):
                rangee[j].append(lignes[i][a:b])
            i += 1
        else:
            vider()
    return cellules


def transcriptions(noeud, chemin="") -> list[tuple[str, str]]:
    """Tous les couples (chemin, fragment) portés par transcription_cahier."""
    out = []
    if isinstance(noeud, dict):
        for cle, val in noeud.items():
            sous = f"{chemin}.{cle}" if chemin else cle
            if cle == "transcription_cahier":
                for frag in val:
                    out.append((chemin, frag))
            else:
                out += transcriptions(val, sous)
    elif isinstance(noeud, list):
        for k, val in enumerate(noeud):
            out += transcriptions(val, f"{chemin}[{k}]")
    return out


def ecarts_declares(noeud, chemin=""):
    """Tous les couples (chemin, bloc ecart) d'une section, à toute profondeur."""
    out = []
    if isinstance(noeud, dict):
        for cle, val in noeud.items():
            sous = f"{chemin}.{cle}" if chemin else cle
            if cle == "ecart" and isinstance(val, dict):
                out.append((chemin or "<racine>", val))
            else:
                out += ecarts_declares(val, sous)
    elif isinstance(noeud, list):
        for k, val in enumerate(noeud):
            out += ecarts_declares(val, f"{chemin}[{k}]")
    return out


def controler_regles_bilan(rb: dict, ref: dict, cat: dict) -> tuple[list[str], list[str]]:
    """RB-01 à RB-08 — le référentiel des règles du moteur de bilan.

    Ce référentiel est la source unique des seuils du § 5.2, § 5.3, § 5.4, § 5.5, § 7.13
    et § 8.2. Aucun script ne les redéfinit ; tests/test_regles_bilan.py le vérifie.
    """
    err, avert = [], []

    # RB-01 — les paliers de niveau sont ordonnés du plus haut au plus bas et couvrent [0, 1]
    pal = rb["niveaux_competence"]["paliers"]
    seuils = [p["seuil_min"] for p in pal]
    if seuils != sorted(seuils, reverse=True):
        err.append("RB-01 : les paliers de niveaux_competence ne sont pas ordonnés "
                   "du seuil le plus haut au plus bas")
    if not seuils or seuils[-1] != 0:
        err.append("RB-01 : le palier le plus bas doit avoir un seuil_min de 0 pour que "
                   "toute part reçoive un niveau")
    if seuils and seuils[0] > 1:
        err.append("RB-01 : le seuil le plus haut dépasse 1, aucune part ne peut l'atteindre")
    for p in pal:
        if not p.get("action"):
            err.append(f"RB-01 : le palier {p['libelle']} n'a pas d'action associée")

    # RB-02 — les libellés de niveaux servent de clés aux rythmes : la table doit être complète
    table = rb["rythmes_hebdomadaires"]["par_niveau"]
    for p in pal:
        if p["libelle"] not in table:
            err.append(f"RB-02 : le niveau {p['libelle']} n'a pas de rythme hebdomadaire")
    if rb["module_entree"]["libelle_remise_a_niveau"] not in table:
        err.append("RB-02 : le module « Remise à niveau » n'a pas de rythme hebdomadaire")
    for niv, h in table.items():
        if not 0 < h <= 24:
            err.append(f"RB-02 : rythme hors bornes pour {niv} : {h} h")

    # RB-03 — les parts sont des fractions ou des réels entre 0 et 1, jamais des pourcentages
    f = rb["palier_de_profondeur"]["fraction"]
    if not 0 < f["numerateur"] < f["denominateur"]:
        err.append(f"RB-03 : la fraction du palier de profondeur "
                   f"({f['numerateur']}/{f['denominateur']}) n'est pas une part entre 0 et 1")
    for chemin, v in (("agregats.prerequis.seuil_remise_a_niveau",
                       rb["agregats"]["prerequis"]["seuil_remise_a_niveau"]),
                      ("grand_oral.seuil", rb["grand_oral"]["seuil"])):
        if not 0 < v < 1:
            err.append(f"RB-03 : {chemin} vaut {v} ; une part se note entre 0 et 1")

    # RB-04 — l'écart de calibration se lit sur la même échelle 0–100 que les scores
    cal = rb["indice_calibration"]
    if not 0 < cal["ecart_signal"] < 100:
        err.append(f"RB-04 : ecart_signal hors de l'échelle 0–100 : {cal['ecart_signal']}")
    e = cal["echelle_percue"]
    if e["max"] <= e["min"]:
        err.append("RB-04 : echelle_percue vide, la conversion diviserait par zéro")
    # RB-04 bis — la calibration par compétence se lit dans le bloc 0 (EC-23) : sa source
    # doit être le bloc 0 et non une variable du questionnaire, sans quoi le bloc 0 rempli
    # par le candidat ne serait lu par personne.
    pc = cal["portee"]["par_competence"]
    if "variable_qp" in pc:
        err.append("RB-04 : la calibration par compétence est adossée à une variable du "
                   "questionnaire ; le § 5.4 la fait reposer sur le bloc 0 (EC-23)")
    if "bloc 0" not in pc.get("source", ""):
        err.append(f"RB-04 : source de la calibration par compétence « {pc.get('source')} » "
                   f"— le § 5.4 dit « bloc 0 »")
    if not pc.get("non_renseignee"):
        err.append("RB-04 : la calibration par compétence ne dit pas ce que vaut un domaine "
                   "de bloc 0 sans réponse")

    # RB-05 — un seuil d'alerte de charge non atteignable ne se déclencherait jamais.
    rythme_max = max(table.values())
    spe = rb["alerte_charge"]["specialites_par_profil"]["par_profil"]
    sans_rythme = set(rb["rythmes_hebdomadaires"]["sans_rythme"]["instruments"])
    plafond_theorique, profil_large = 0, None
    # La charge se compte par groupe de planification, non par périmètre : deux périmètres
    # d'un même groupe n'ouvrent qu'une enveloppe (EC-28). Compter les périmètres
    # surestimerait la charge maximale et laisserait passer un seuil inatteignable.
    groupe_de = {p["code"]: p.get("groupe_planification", p["code"])
                 for p in ref["perimetres"]}
    for profil in rb["alerte_charge"]["profils"]:
        hors_spe = {groupe_de.get(i["perimetre"], i["perimetre"])
                    for i in cat["instruments"]
                    if i["porte_items"] and i["perimetre"] and profil in i["profils"]
                    and i["code"] not in sans_rythme
                    and not i["perimetre"].startswith("EDS-")}
        n = len(hors_spe) + spe[profil]
        if rythme_max * n > plafond_theorique:
            plafond_theorique, profil_large = rythme_max * n, (profil, len(hors_spe), spe[profil])
    al = rb["alerte_charge"]
    #: Les deux indicateurs de charge — celui du Cahier et celui que la direction ajoute —
    #: sont contrôlés de la même façon : atteignables, motivés, et distincts par leur effet.
    indicateurs = [("seuil d'alerte de charge", al, "depasse")]
    vig = al.get("vigilance_charge_elevee")
    if vig:
        indicateurs.append((f"indicateur « {vig['libelle']} »", vig, "atteint"))
    for nom, ind, _ in indicateurs:
        if ind["seuil_heures"] > plafond_theorique:
            pr, nh, ns = profil_large
            err.append(f"RB-05 : le {nom} "
                       f"({ind['seuil_heures']} h) dépasse la charge maximale "
                       f"atteignable ({plafond_theorique:g} h = {rythme_max:g} h × "
                       f"{nh + ns} matières pour le profil le plus large {pr}, soit {nh} hors "
                       f"spécialité et {ns} spécialités) : l'alerte ne se déclencherait jamais")

    # RB-06 — tout seuil qui s'écarte du Cahier porte son motif, faute de quoi l'écart est
    # muet. Le seuil du Cahier, lui, n'a pas à se justifier : il est le Cahier.
    cahier = al.get("seuil_cahier_initial")
    if cahier is not None:
        if al["seuil_heures"] != cahier and not al.get("retablissement", {}).get("motif"):
            err.append("RB-06 : le seuil de séquencement s'écarte du Cahier sans motif")
        if vig and vig["seuil_heures"] != cahier and not vig.get("motif"):
            err.append(f"RB-06 : l'indicateur « {vig['libelle']} » fixe un seuil de "
                       f"{vig['seuil_heures']} h, distinct des {cahier} h du Cahier, "
                       f"sans motif")

    # RB-12 — la règle historique du français et la catégorie qui la généralise doivent
    # dire la même chose : deux placements divergents rendraient le rendu imprévisible.
    pm = rb["priorite_matieres"]
    ea = pm.get("epreuves_anticipees_si_fragiles")
    fr = pm.get("francais_si_fragile")
    if ea and fr:
        if ea["placement"] != fr["placement"]:
            err.append("RB-12 : le placement de la catégorie « épreuves anticipées si "
                       "fragiles » diverge de celui que porte encore francais_si_fragile")
        if fr["groupe"] not in ea["groupes"]:
            err.append(f"RB-12 : le groupe {fr['groupe']} n'est pas dans la catégorie "
                       f"générique qui remplace sa règle")
        for g, x in ea["groupes"].items():
            if not isinstance(x.get("coefficient_officiel"), int):
                err.append(f"RB-12 : le groupe {g} est promu sans coefficient officiel "
                           f"déclaré, alors qu'il départage au troisième rang")
            if not x.get("source_coefficient"):
                err.append(f"RB-12 : le coefficient du groupe {g} est déclaré sans source")

    # RB-11 — un indicateur ajouté par la direction ne commande pas la règle du Cahier.
    # C'est le défaut relevé par Q-27 : un seuil de vigilance qui déclenchait le
    # séquencement remplaçait la règle au lieu de s'y ajouter.
    if vig:
        if al["comparaison"] != "depasse":
            err.append(f"RB-11 : le § 8.2 écrit « dépasse 20 h » ; le seuil de séquencement "
                       f"est comparé par « {al['comparaison']} »")
        if vig["comparaison"] != "atteint":
            err.append(f"RB-11 : l'indicateur de vigilance est comparé par "
                       f"« {vig['comparaison']} » et non « atteint »")
        if vig["seuil_heures"] >= al["seuil_heures"]:
            err.append(f"RB-11 : l'indicateur de vigilance ({vig['seuil_heures']} h) "
                       f"n'est pas strictement en deçà du seuil de séquencement "
                       f"({al['seuil_heures']} h) : il le remplacerait")
        if vig.get("effet") != "signal" or not vig.get("n_impose_pas"):
            err.append("RB-11 : l'indicateur de vigilance ne déclare pas qu'il n'impose "
                       "aucun séquencement")

    # RB-09 — la sélection de version de spécialité désigne des versions qui existent
    # et n'en désigne pas pour un profil auquel le catalogue ne les ouvre pas.
    sel = cat["conventions"]["selection_version_specialite"]["par_profil"]
    versions_eds = {(i["code"], i["version"]) for i in cat["instruments"]
                    if i["perimetre"] and i["perimetre"].startswith("EDS-")}
    for profil, choix in sel.items():
        for statut, version in choix.items():
            ouvertes = {i["version"] for i in cat["instruments"]
                        if i["perimetre"] and i["perimetre"].startswith("EDS-")
                        and profil in i["profils"]}
            if version not in ouvertes:
                err.append(f"RB-09 : la sélection {profil}/{statut} désigne la version "
                           f"{version}, que le catalogue n'ouvre pas à {profil} "
                           f"(ouvertes : {', '.join(sorted(ouvertes)) or 'aucune'})")

    # RB-07 — toute transcription cite un texte qui existe réellement dans le Cahier.
    # C'est le contrôle qui empêche une valeur d'entrer au référentiel sous une source
    # inventée, et celui qui aurait signalé « deux tiers » converti en 0,6667.
    if CAHIER.exists():
        prose = normaliser_cahier(CAHIER.read_text(encoding="utf-8"))
        cellules = cellules_cahier(CAHIER)
        for chemin, frag in transcriptions(rb):
            f_n = normaliser_cahier(frag)
            if f_n not in prose and not any(f_n in c for c in cellules):
                err.append(f"RB-07 : {chemin or '<racine>'} cite un texte absent du Cahier : "
                           f"« {frag[:80]} »")
    else:
        avert.append("RB-07 non exécuté : cahier.md absent du dépôt")

    # RB-08 — toute règle porte sa source : une transcription, ou un écart déclaré.
    for cle, sect in rb.items():
        if not isinstance(sect, dict):
            continue
        a_transcription = bool(transcriptions(sect))
        if not a_transcription and not ecarts_declares(sect) and "origine" not in sect:
            err.append(f"RB-08 : la section {cle} ne porte ni transcription du Cahier ni "
                       f"écart déclaré : sa source est invérifiable")
        for chemin, e in ecarts_declares(sect, cle):
            if not e.get("decision"):
                err.append(f"RB-08 : l'écart de {chemin} ne nomme pas la décision "
                           f"qui l'autorise")
            # RB-10 — un écart se raconte une seule fois, dans le registre ecarts_cahier
            # de competences.json ; les référentiels de règles n'en portent que la
            # référence. Sans ce contrôle, deux textes du même écart divergeraient.
            refs = {x["ref"] for x in ref["ecarts_cahier"]}
            if "ref" not in e:
                err.append(f"RB-10 : l'écart de {chemin} ne renvoie pas au registre "
                           f"ecarts_cahier")
            elif e["ref"] not in refs:
                err.append(f"RB-10 : l'écart {e['ref']} de {chemin} est absent du registre "
                           f"ecarts_cahier de competences.json")
            elif any(c in e for c in ("texte", "constat", "arbitrage", "nature")):
                err.append(f"RB-10 : l'écart {e['ref']} de {chemin} recopie le texte du "
                           f"registre au lieu de le référencer")

    return err, avert


def resume_1b(ce: dict, tb: dict, cat: dict) -> str:
    nb_motifs = sum(1 + len(e.get("variantes", [])) + len(e.get("regex", [])) for e in tb["expressions"])
    nb_exc = sum(len(e["exceptions_domaine"]) for e in tb["expressions"])
    return "\n".join([
        f"Codes d'erreur                : {len(ce['codes'])} sur {len(ce['matieres'])} matières",
        f"Termes bloquants              : {len(tb['expressions'])} expressions "
        f"({nb_motifs} motifs, {nb_exc} exceptions de domaine)",
        f"Catalogue                     : {len(cat['instruments'])} enregistrements "
        f"({sum(1 for i in cat['instruments'] if i['porte_items'])} portant des items)",
    ])


def main() -> int:
    ref = charger()
    ce = charger(CODES_ERREUR)
    tb = charger(TERMES_BLOQUANTS)
    cat = charger(CATALOGUE)
    rb = charger(REGLES_BILAN)

    err, avert = controler(ref)
    for f, args in ((controler_codes_erreur, (ce, ref, tb)),
                    (controler_termes_bloquants, (tb, ref)),
                    (controler_catalogue, (cat, ref)),
                    (controler_regles_bilan, (rb, ref, cat))):
        e, a = f(*args)
        err += e
        avert += a

    print(resume(ref))
    print(resume_1b(ce, tb, cat))
    print()
    for a in avert:
        print("AVERTISSEMENT :", a)
    for e in err:
        print("ERREUR :", e)
    print()
    print(f"{len(err)} erreur(s), {len(avert)} avertissement(s)")
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main())
