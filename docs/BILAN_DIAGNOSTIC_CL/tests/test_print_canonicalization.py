"""Tests de conformité et de canonicité des catalogues d'impression opérateur.

Vérifie l'hygiène stricte des recueils génériques de consultation/impression
dans release/diagnostics-v2/03_IMPRESSION/ :
- Absence de noms dégénérés ou répétés (anti-dégénérescence)
- Unicité stricte des chemins, signatures et empreintes SHA-256
- Absence de fuites coach / clés de correction
- Dérivation dynamique depuis referentiels/catalogues_operateur.json (sans magic number)
- Couverture complète des 5 952 classes candidates sans catalogue orphelin
- Distinction explicite : OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO
- Déterminisme strict
"""

import csv
import hashlib
import json
import re
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
RELEASE = RACINE / "release" / "diagnostics-v2"
IMPRESSION = RELEASE / "03_IMPRESSION"
REFERENTIEL_JSON = RACINE / "referentiels" / "catalogues_operateur.json"
STUDENT_MATRIX_CSV = RACINE / "STUDENT_PACK_MATRIX.csv"
STUDENT_MATRIX_JSON = RACINE / "STUDENT_PACK_MATRIX.json"
GUIDE_TXT = RELEASE / "00_GUIDE" / "GUIDE_OPERATEUR.txt"


def sha256_fichier(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for bloc in iter(lambda: f.read(65536), b""):
            h.update(bloc)
    return h.hexdigest()


def charger_catalogues_referentiel() -> list[dict]:
    assert REFERENTIEL_JSON.exists(), f"Fichier référentiel manquant : {REFERENTIEL_JSON}"
    with open(REFERENTIEL_JSON, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("catalogues", [])


# ─────────────────────────────────────────────── Test A : Anti-dégénérescence

def test_aucun_nom_de_catalogue_degonere_ou_avec_token_repete():
    """Vérifie qu'aucun fichier PDF dans 03_IMPRESSION n'a de nom dégénéré ou de token répété."""
    if not IMPRESSION.exists():
        pytest.skip("release v2 non construite")

    fichiers = list(IMPRESSION.rglob("*.pdf"))
    assert fichiers, "Aucun catalogue PDF trouvé dans 03_IMPRESSION"

    regex_degonere = [
        (re.compile(r"(?:_NON_POURSUIVIE){2,}"), "Répétition multiple de NON_POURSUIVIE"),
        (re.compile(r"(?:_FIN_DE_CYCLE){2,}"), "Répétition multiple de FIN_DE_CYCLE"),
        (re.compile(r"(?:_AVEC_SPECIALITE){2,}"), "Répétition multiple de AVEC_SPECIALITE"),
        (re.compile(r"(?:_ANTICIPEE_SPE){2,}"), "Répétition multiple de ANTICIPEE_SPE"),
        (re.compile(r"_([A-Z0-9]+)_\1\b"), "Répétition consécutive d'un même token"),
    ]

    erreurs = []
    for f in fichiers:
        nom = f.name
        for reg, motif in regex_degonere:
            if reg.search(nom):
                erreurs.append(f"{f.relative_to(IMPRESSION)} : {motif} ({nom})")

        # Vérification par éclatement des tokens
        sans_extension = nom[:-4] if nom.endswith(".pdf") else nom
        tokens = sans_extension.split("_")
        vus = set()
        for t in tokens:
            if t in ("CATALOGUE", "RECUEIL", "COMPLET", "ET"):
                continue
            if t in vus:
                erreurs.append(f"{f.relative_to(IMPRESSION)} : token '{t}' répété dans {nom}")
            vus.add(t)

    assert not erreurs, "Noms dégénérés détectés dans 03_IMPRESSION :\n" + "\n".join(erreurs)


# ─────────────────────────────────────────────── Test B : Unicité et sécurité

def test_unicite_chemins_signatures_et_sha256_catalogues():
    """Chaque catalogue d'impression a un chemin, une signature et un SHA256 uniques."""
    if not IMPRESSION.exists():
        pytest.skip("release v2 non construite")

    catalogues = charger_catalogues_referentiel()
    signatures = [c["operator_catalogue_signature"] for c in catalogues]
    assert len(signatures) == len(set(signatures)), "Doublon de signature dans le référentiel"

    fichiers = sorted(p for p in IMPRESSION.rglob("*.pdf"))
    chemins = [str(f.relative_to(RELEASE)) for f in fichiers]
    assert len(chemins) == len(set(chemins)), "Chemins canoniques en doublon dans 03_IMPRESSION"

    sha_map = {}
    for f in fichiers:
        h = sha256_fichier(f)
        assert h not in sha_map, (
            f"Collision de contenu SHA256 : {f.name} et {sha_map[h].name} ont la même empreinte ({h})"
        )
        sha_map[h] = f


def test_aucun_doublon_de_livret_au_sein_d_un_catalogue():
    """Au sein d'un même catalogue, chaque livret de matière n'apparaît qu'une seule fois."""
    catalogues = charger_catalogues_referentiel()
    for cat in catalogues:
        livrets = cat["ordered_booklet_paths"]
        assert len(livrets) == len(set(livrets)), (
            f"Livret en doublon dans le catalogue {cat['catalogue_id']}"
        )


def test_aucune_fuite_coach_dans_catalogues_impression():
    """Les catalogues d'impression ne doivent contenir aucun corrigé, barème ou grille coach."""
    if not IMPRESSION.exists():
        pytest.skip("release v2 non construite")

    import distribution as DIS

    fichiers = list(IMPRESSION.rglob("*.pdf"))
    for f in fichiers:
        assert "CORRECTION" not in f.name.upper(), f"Nom coach suspect : {f.name}"
        assert "coach" not in f.name.lower(), f"Nom coach suspect : {f.name}"
        txt = DIS.texte_pdf(f)
        fuites = DIS.fuites_texte(f, txt)
        assert not fuites, f"Fuite de contenu correcteur dans {f.name} : {fuites}"


# ─────────────────────────────────────────────── Test C : Conformance au référentiel

def test_effectif_et_conformance_au_referentiel_declaratif():
    """L'effectif et l'identité des catalogues dérivent dynamiquement du référentiel."""
    if not IMPRESSION.exists():
        pytest.skip("release v2 non construite")

    catalogues = charger_catalogues_referentiel()
    nb_attendus = len(catalogues)
    assert nb_attendus > 0, "Le référentiel ne contient aucun catalogue"

    fichiers_reels = sorted(p for p in IMPRESSION.rglob("*.pdf"))
    assert len(fichiers_reels) == nb_attendus, (
        f"Nombre de catalogues ({len(fichiers_reels)}) != attendu dans le référentiel ({nb_attendus})"
    )

    chemins_attendus = {
        f"release/diagnostics-v2/03_IMPRESSION/"
        f"{__import__('release_v2').DOSSIER_PROFIL[c['profil']]}/{c['nom_fichier']}"
        for c in catalogues
    }
    chemins_reels = {str(f.relative_to(RACINE)) for f in fichiers_reels}
    assert chemins_reels == chemins_attendus, (
        f"Discordance entre les fichiers réels et le référentiel :\n"
        f"En plus : {chemins_reels - chemins_attendus}\n"
        f"Manquants : {chemins_attendus - chemins_reels}"
    )


# ─────────────────────────────────────────────── Test D : Couverture des livrets

def test_couverture_de_tous_les_livrets_candidats_par_au_moins_un_catalogue():
    """Tout livret candidat des parcours de référence apparaît dans au moins un catalogue d'impression.

    Les livrets de cas particuliers dérogatoires (90_CAS_PARTICULIERS) et les spécialités
    abandonnées hors maths (qui sont des livrets de 1re déjà illustrés dans P1) sont réservés
    aux assemblages sur-mesure candidat (pack_candidat.py) et ne figurent pas dans les 15 catalogues
    opérateur de consultation générique.
    """
    catalogues = charger_catalogues_referentiel()
    livrets_dans_catalogues = set()
    for c in catalogues:
        for p in c["ordered_booklet_paths"]:
            livrets_dans_catalogues.add(p)

    candidat_base = RELEASE / "01_LIVRETS_CANDIDAT"
    if not candidat_base.exists():
        pytest.skip("release v2 non construite")

    # Exclure le dossier d'entrée, les cas particuliers et les spécialités abandonnées hors maths
    # (ces dernières sont déjà illustrées au catalogue de Première P1).
    def est_livret_de_reference(p: Path) -> bool:
        s = str(p)
        if "00_DOSSIER_ENTREE" in s or "00_COMMUN" in s or "90_CAS_PARTICULIERS" in s:
            return False
        if p.name.endswith("_NON_POURSUIVIE.pdf") and not p.name.startswith("MATHEMATIQUES"):
            return False
        return True

    livrets_candidats = sorted(
        str(p.relative_to(RACINE))
        for p in candidat_base.rglob("*.pdf")
        if est_livret_de_reference(p)
    )

    manquants = set(livrets_candidats) - livrets_dans_catalogues
    assert not manquants, f"Livrets candidats de référence absents de tous les catalogues d'impression : {manquants}"


# ─────────────────────────────────────────────── Test E : Couverture des classes candidat

def test_toutes_les_classes_candidats_ont_un_catalogue_valide_sans_orphelin():
    """Chaque classe a un operator_print_catalogue_id valide et 0 catalogue n'est orphelin."""
    catalogues = charger_catalogues_referentiel()
    cat_ids_referentiel = {c["catalogue_id"] for c in catalogues}

    assert STUDENT_MATRIX_CSV.exists(), f"{STUDENT_MATRIX_CSV} manquant"
    assert STUDENT_MATRIX_JSON.exists(), f"{STUDENT_MATRIX_JSON} manquant"

    with open(STUDENT_MATRIX_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        lignes = list(reader)

    import distribution as DIS
    expected_class_count = len(DIS.classes())
    assert len(lignes) == expected_class_count, (
        f"Nombre de classes ({len(lignes)}) != attendu ({expected_class_count})"
    )

    catalogues_utilises = set()
    for i, row in enumerate(lignes):
        cat_id = row.get("operator_print_catalogue_id")
        assert cat_id, f"Ligne {i} sans operator_print_catalogue_id"
        assert cat_id in cat_ids_referentiel, f"Ligne {i} a un catalogue_id inconnu : {cat_id}"
        cat_path = row.get("operator_print_catalogue")
        assert cat_path, f"Ligne {i} sans operator_print_catalogue"
        cand_sig = row.get("candidate_booklet_signature")
        assert cand_sig, f"Ligne {i} sans candidate_booklet_signature"
        catalogues_utilises.add(cat_id)

    # 0 catalogue orphelin
    orphelins = cat_ids_referentiel - catalogues_utilises
    assert not orphelins, f"Catalogues d'impression orphelins (aucune classe associée) : {orphelins}"


# ─────────────────────────────────────────────── Test F : Distinction des signatures

def test_distinction_des_signatures_et_documentation():
    """Vérifie la distinction explicite OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO."""
    import release_v2 as REL

    # Dans la source du guide opérateur
    assert "OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO" in REL.GUIDE_TXT

    # Dans le référentiel JSON
    with open(REFERENTIEL_JSON, encoding="utf-8") as f:
        ref_data = json.load(f)
    assert "OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO" in ref_data.get("meta", {}).get("regle", "")

    # Dans la matrice JSON
    with open(STUDENT_MATRIX_JSON, encoding="utf-8") as f:
        mat_data = json.load(f)
    assert "OPERATOR_PRINT_CATALOGUE_IS_EXACT_CANDIDATE_PACK=NO" in mat_data.get("meta", {}).get("regle", "")


# ─────────────────────────────────────────────── Test G : Déterminisme

def test_determinisme_recueil_impression_pour():
    """Vérifie que la résolution recueil_impression_pour est strictement déterministe."""
    import distribution as DIS
    import release_v2 as REL

    classes = DIS.classes()
    for cle, c in classes.items():
        e = c["representant"]
        res1 = REL.recueil_impression_pour(c["profil"], c["instruments"], e.get("mode_ep"))
        res2 = REL.recueil_impression_pour(c["profil"], c["instruments"], e.get("mode_ep"))
        assert res1 == res2, f"Résolution non déterministe pour la classe {cle}"


# ─────────────────────────────────────────────── Test H : Traçabilité sémantique MANIFESTE_V2

def test_metadonnees_semantiques_completes_manifeste_v2():
    """Vérifie que 100% des PDF candidat et coach ont des métadonnées sémantiques complètes.

    Chaque artefact candidat ou coach dans MANIFESTE_V2.json doit obligatoirement porter :
    - artifact_id (forme stable et sémantique, jamais un simple repli de chemin physique)
    - path
    - sha256
    - profil
    - profil_libelle
    - matiere
    - variante
    - instruments
    - session (pour les livrets disciplinaires)
    Et concorder rigoureusement avec la table canonique déclarative indépendante.
    """
    manifeste_path = RACINE / "release" / "diagnostics-v2" / "04_INTERNE" / "MANIFESTE_V2.json"
    if not manifeste_path.exists():
        pytest.skip("release v2 non construite")

    with open(manifeste_path, encoding="utf-8") as f:
        data = json.load(f)

    if "selection_classes" not in data.get("effectifs", {}):
        pytest.skip("release v2 non construite")

    import release_v2 as REL
    table_canonique = REL.table_artefacts_canoniques()

    artefacts = data.get("artefacts", [])
    candidat_coach = [a for a in artefacts if a.get("role") in ("candidat", "coach")]
    assert candidat_coach, "Aucun artefact candidat ou coach dans MANIFESTE_V2"

    champs_obligatoires = [
        "artifact_id", "path", "sha256", "role", "profil", "profil_libelle",
        "matiere", "variante", "instruments"
    ]

    erreurs = []
    for a in candidat_coach:
        p = a.get("path")
        # 1. Vérification des champs requis
        for ch in champs_obligatoires:
            val = a.get(ch)
            if val is None or val == "":
                erreurs.append(f"{p} : champ '{ch}' manquant ou vide dans MANIFESTE_V2")

        # 2. Refus strict d'un artifact_id de repli générique
        aid = a.get("artifact_id", "")
        if aid.startswith("candidat.01_LIVRETS_CANDIDAT") or aid.startswith("coach.02_CORRECTIONS_COACH"):
            erreurs.append(f"{p} : artifact_id non sémantique replié sur le chemin physique ({aid})")

        # 3. Comparaison avec l'oracle canonique indépendant
        if p not in table_canonique:
            erreurs.append(f"{p} : artefact absent de la table canonique de référence")
        else:
            oracle = table_canonique[p]
            for cle in ("artifact_id", "profil", "profil_libelle", "matiere", "variante", "instruments"):
                if a.get(cle) != oracle.get(cle):
                    erreurs.append(
                        f"{p} : divergence sur '{cle}' — manifeste: {a.get(cle)!r} vs canonique: {oracle.get(cle)!r}"
                    )

    assert not erreurs, "Défauts de métadonnées sémantiques dans MANIFESTE_V2 :\n" + "\n".join(erreurs)


# ─────────────────────────────────────────────── Test I : Inclusion du dossier d'entrée et signatures

def test_signatures_logiques_catalogues_incluent_dossier_entree():
    """Vérifie que les signatures opérateur et les chemins logiques incluent le dossier d'entrée."""
    catalogues = charger_catalogues_referentiel()
    for cat in catalogues:
        prof = cat["profil"]
        dossier = {"P1": "PROFIL_A_PREMIERE_PARTIE", "P2": "PROFIL_B_DEUXIEME_PARTIE", "P3": "PROFIL_C_BAC_EN_UNE_SESSION"}[prof]
        entree_path = f"release/diagnostics-v2/01_LIVRETS_CANDIDAT/{dossier}/00_DOSSIER_ENTREE/DOSSIER_D_ENTREE_NEXUS.pdf"

        # 1. Le dossier d'entrée doit être le premier livret logique
        paths = cat.get("operator_catalogue_booklet_paths", [])
        assert paths, f"Catalogue {cat['catalogue_id']} sans operator_catalogue_booklet_paths"
        assert paths[0] == entree_path, (
            f"Catalogue {cat['catalogue_id']} ne commence pas par le dossier d'entrée : {paths[0]} != {entree_path}"
        )

        # 2. La signature doit débuter par profil|DOSSIER_D_ENTREE_NEXUS.pdf|
        sig = cat.get("operator_catalogue_signature", "")
        prefixe_attendu = f"{prof}|DOSSIER_D_ENTREE_NEXUS.pdf|"
        assert sig.startswith(prefixe_attendu), (
            f"Catalogue {cat['catalogue_id']} signature ne débute pas par '{prefixe_attendu}' : {sig}"
        )

    # 3. Documentation des règles normatives
    import release_v2 as REL
    assert "OPERATOR_SIGNATURES_INCLUDE_ENTRY_DOSSIER=YES" in REL.GUIDE_TXT
    assert "OPERATOR_CATALOGUE_SIGNATURE_EXCLUDES_EDITORIAL_SEPARATORS=YES" in REL.GUIDE_TXT

    with open(REFERENTIEL_JSON, encoding="utf-8") as f:
        ref_meta = json.load(f).get("meta", {})
    assert ref_meta.get("OPERATOR_SIGNATURES_INCLUDE_ENTRY_DOSSIER") == "YES"
    assert ref_meta.get("OPERATOR_CATALOGUE_SIGNATURE_EXCLUDES_EDITORIAL_SEPARATORS") == "YES"


# ─────────────────────────────────────────────── Test J : Cohérence croisée des effectifs

def test_coherence_croisee_manifeste_v2_effectifs():
    """Vérifie la cohérence croisée des effectifs entre MANIFESTE_V2, le moteur et les référentiels."""
    manifeste_path = RACINE / "release" / "diagnostics-v2" / "04_INTERNE" / "MANIFESTE_V2.json"
    if not manifeste_path.exists():
        pytest.skip("release v2 non construite")

    with open(manifeste_path, encoding="utf-8") as f:
        data = json.load(f)

    effectifs = data.get("effectifs", {})
    if "selection_classes" not in effectifs:
        pytest.skip("release v2 non construite")
    catalogues = charger_catalogues_referentiel()

    import distribution as DIS
    import faits_candidat as FC

    nb_classes_moteur = len(DIS.classes())
    nb_etats_moteur = len(FC.candidate_state_space())
    nb_catalogues_ref = len(catalogues)

    assert effectifs.get("selection_classes") == nb_classes_moteur, (
        f"selection_classes ({effectifs.get('selection_classes')}) != classes moteur ({nb_classes_moteur})"
    )
    assert effectifs.get("candidate_states") == nb_etats_moteur, (
        f"candidate_states ({effectifs.get('candidate_states')}) != états moteur ({nb_etats_moteur})"
    )
    assert effectifs.get("operator_print_catalogues") == nb_catalogues_ref, (
        f"operator_print_catalogues ({effectifs.get('operator_print_catalogues')}) != référentiel ({nb_catalogues_ref})"
    )
    assert effectifs.get("packs_impression") == nb_catalogues_ref, (
        f"packs_impression ({effectifs.get('packs_impression')}) != référentiel ({nb_catalogues_ref})"
    )

    # Vérification que chaque artefact impression porte catalogue_id, signature, purpose, profil
    artefacts = data.get("artefacts", [])
    artefacts_impression = [a for a in artefacts if a.get("role") == "impression"]
    assert len(artefacts_impression) == nb_catalogues_ref, (
        f"Nombre d'artefacts impression ({len(artefacts_impression)}) != référentiel ({nb_catalogues_ref})"
    )

    for a in artefacts_impression:
        assert a.get("catalogue_id"), f"{a['path']} : catalogue_id manquant"
        assert a.get("operator_catalogue_signature"), f"{a['path']} : signature manquante"
        assert a.get("purpose"), f"{a['path']} : purpose manquant"
        assert a.get("profil"), f"{a['path']} : profil manquant"
