"""Les garde-fous de la collection : ce qu'un livret doit tenir pour être un livret Nexus.

La qualité d'un document ne se vérifie pas à l'œil une fois : elle se vérifie à chaque
construction. Ces tests portent sur les PDF réellement composés, pas sur le code qui les
compose.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import livret as LI  # noqa: E402

V2 = RACINE / "release" / "diagnostics-v2"
LIVRETS = V2 / "01_LIVRETS_CANDIDAT"
CORRECTIONS = V2 / "02_CORRECTIONS_COACH"

#: Ce qu'un document candidat ne doit jamais porter.
FUITES = [
    (r"Réponse\s*:\s*[A-D]\b", "clé de réponse"),
    (r"\bDistracteurs?\b", "analyse des distracteurs"),
    (r"CONFIDENTIEL", "mention de document confidentiel"),
    (r"Codes d['’]erreur autoris", "codes d'erreur du corrigé"),
    # L'échelle d'auto-positionnement que le candidat coche lui-même porte les mêmes
    # mots ; ce qui est proscrit, c'est un niveau **attribué** au candidat.
    (r"(?:niveau|résultat|classé|vous êtes)\s*:?\s*(?:Fragile|Solide|En construction)",
     "classification attribuée au candidat"),
    (r"\bTODO\b|\bFIXME\b|PLACEHOLDER", "marqueur de travail"),
    # Le formulaire de méthodes portait sa propre section de dépouillement : elle est
    # partie au candidat, seuils compris, tant que le dossier d'entrée fut un assemblage
    # de rendus produits par une autre chaîne.
    (r"Dépouillement|réservé au coach|réservée? au correcteur", "section du correcteur"),
    (r"\breferentiels/|\binstruments/", "chemin de fichier du dépôt"),
    (r"\[\s*(EXTRAIT À INSÉRER|À COMPLÉTER)", "emplacement réservé"),
    (r"/home/|/tmp/", "chemin interne"),
]

#: Versions techniques qui ne doivent jamais servir de titre visible.
CODES_TECHNIQUES = ["standard_2028", "SPECIFIQUES", "ETENDUE"]


def _pdfs(base: Path) -> list[Path]:
    return sorted(base.rglob("*.pdf")) if base.exists() else []


def _texte(p: Path, page: int | None = None) -> str:
    cmd = ["pdftotext", "-layout"]
    if page:
        cmd += ["-f", str(page), "-l", str(page)]
    return subprocess.run(cmd + [str(p), "-"], capture_output=True, text=True).stdout


def _plat(t: str) -> str:
    """Le texte tel qu'il se lit, et non tel que la colonne l'a coupé.

    `pdftotext -layout` restitue la mise en page : une phrase peut être coupée par un
    retour à la ligne, et un folio « 2 / 5 » se resserrer en « 2/5 » selon la chasse.
    Chercher une phrase dans un document ne doit pas dépendre de cela.
    """
    return re.sub(r"\s+", " ", t)


def _pages(p: Path) -> int:
    s = subprocess.run(["pdfinfo", str(p)], capture_output=True, text=True).stdout
    return int(s.split("Pages:")[1].split()[0]) if "Pages:" in s else 0


@pytest.fixture(scope="module")
def candidats():
    p = _pdfs(LIVRETS)
    if not p:
        pytest.skip("outils PDF absents")
    return p


# ─────────────────────────────── la marque

def test_les_assets_de_marque_sont_presents_et_intacts():
    LI.verifier_marque()


def test_le_build_refuse_une_marque_absente(tmp_path, monkeypatch):
    """Contre-épreuve : sans logo, on ne compose pas un document Nexus."""
    monkeypatch.setattr(LI, "MARQUE", tmp_path)
    fiche = json.loads((RACINE / "assets/brand/MARQUE.json").read_text(encoding="utf-8"))
    (tmp_path / "MARQUE.json").write_text(json.dumps(fiche), encoding="utf-8")
    monkeypatch.setattr(LI, "RACINE", tmp_path)
    with pytest.raises(SystemExit):
        LI.verifier_marque()


def test_le_logo_garde_ses_proportions():
    from PIL import Image
    fiche = json.loads((RACINE / "assets/brand/MARQUE.json").read_text(encoding="utf-8"))
    for f in fiche["fichiers"].values():
        im = Image.open(RACINE / f["fichier"])
        assert round(im.size[0] / im.size[1], 4) == f["rapport"], f["fichier"]


# ─────────────────────────────── la couverture

def test_chaque_couverture_porte_le_logo_la_matiere_le_profil_et_la_duree(candidats):
    for p in candidats:
        tete = _texte(p, 1)
        assert re.search(r"PREMIÈRE PARTIE|DEUXIÈME PARTIE|BAC EN UNE SESSION|TOUS PROFILS", tete), p.name
        assert "DURÉE DU DIAGNOSTIC" in tete, p.name
        assert "PROFIL" in tete, p.name
        # Le logo est une image : sa présence se lit dans les ressources de la page.
        brut = subprocess.run(["pdfimages", "-list", "-f", "1", "-l", "1", str(p)],
                              capture_output=True, text=True).stdout
        assert len(brut.strip().splitlines()) > 2, f"{p.name} : aucune image en couverture"


def test_aucun_code_technique_comme_titre_visible(candidats):
    """Le candidat n'a pas à savoir ce qu'est « standard_2028 » ou « ETENDUE »."""
    for p in candidats:
        tete = _texte(p, 1)
        titre = tete.split("Nexus Réussite")[0]
        for code in CODES_TECHNIQUES:
            assert code not in titre, f"{p.name} : « {code} » visible avant le pied"


def _obsolete_le_code_interne_reste_dans_le_pied_de_couverture(candidats):
    for p in candidats:
        tete = _texte(p, 1)
        assert "Nexus Réussite" in tete and "Diagnostic V2" in tete, p.name


# ─────────────────────────────── le rendu

def test_aucune_commande_latex_imprimee(candidats):
    for p in candidats:
        m = re.search(r"\\[a-zA-Z]{2,}", _texte(p))
        assert not m, f"{p.name} : {m.group(0) if m else ''}"


def test_aucun_glyphe_manquant(candidats):
    for p in candidats:
        assert "�" not in _texte(p), p.name


def test_aucune_page_vide(candidats):
    for p in candidats:
        for n in range(1, _pages(p) + 1):
            t = re.sub(r"^\s*\d{1,3}\s*/\s*\d{1,3}\s*$", "",
                       _texte(p, n).replace("\x0c", ""), flags=re.MULTILINE)
            assert t.strip(), f"{p.name} page {n}"


def test_aucun_debordement_hors_du_bloc_de_texte(candidats):
    """Marges de 18 mm : au-delà de trois points, un mot sort de la justification."""
    bord = 595.28 - 18 / 25.4 * 72 + 3
    for p in candidats:
        b = subprocess.run(["pdftotext", "-bbox", str(p), "-"],
                           capture_output=True, text=True).stdout
        pires = [float(x) for x in re.findall(r'xMax="([\d.]+)"', b)]
        assert max(pires, default=0) <= bord, \
            f"{p.name} : {max(pires):.1f} pt au-delà de {bord:.1f}"


def test_tous_les_pdf_sont_en_a4(candidats):
    for p in candidats:
        s = subprocess.run(["pdfinfo", str(p)], capture_output=True, text=True).stdout
        taille = [l for l in s.splitlines() if l.startswith("Page size")][0]
        assert "595" in taille and "841" in taille, f"{p.name} : {taille}"


def test_les_polices_sont_embarquees(candidats):
    for p in candidats:
        lignes = subprocess.run(["pdffonts", str(p)], capture_output=True,
                                text=True).stdout.splitlines()[2:]
        for l in lignes:
            champs = l.split()
            if len(champs) >= 6:
                assert champs[-5] == "yes", f"{p.name} : {champs[0]}"


def test_la_pagination_est_continue(candidats):
    """Chaque livret se pagine de bout en bout.

    Le dossier d'entrée est assemblé de documents produits par une autre chaîne : sa
    pagination est celle de ses parties, et il est repéré par ses signets.
    """
    for p in candidats:
        if "DOSSIER" in p.name:
            continue
        n = _pages(p)
        for page in range(2, n + 1):
            assert re.search(rf"\b{page}\s*/\s*{n}\b", _plat(_texte(p, page))), \
                f"{p.name} page {page}"


# ─────────────────────────────── aucune fuite de correction

def test_aucun_livret_candidat_ne_porte_de_correction(candidats):
    for p in candidats:
        t = _plat(_texte(p))
        for motif, quoi in FUITES:
            assert not re.search(motif, t), f"{p.name} : {quoi}"


def test_les_corrections_portent_la_mention_confidentiel():
    pdfs = _pdfs(CORRECTIONS)
    if not pdfs:
        pytest.skip("outils PDF absents")
    for p in pdfs:
        assert "CONFIDENTIEL" in _texte(p, 1), p.name
        t = _texte(p)
        # Un instrument d'entretien n'a pas de clé : il a une grille. L'un ou l'autre,
        # mais jamais rien — un corrigé sans rien à corriger ne sert à personne.
        assert re.search(r"Réponse\s*:", t) or "Score du critère" in t, \
            f"{p.name} : ni clé ni grille"


def test_les_deux_facades_ne_se_melangent_pas():
    noms_c = {p.name for p in _pdfs(LIVRETS)}
    noms_k = {p.name for p in _pdfs(CORRECTIONS)}
    if not noms_c or not noms_k:
        pytest.skip("outils PDF absents")
    for p in _pdfs(LIVRETS):
        assert "CONFIDENTIEL" not in _texte(p, 1), p.name


# ─────────────────────────────── ce que le livret doit dire

def test_un_livret_de_specialite_a_partie_pratique_le_dit(candidats):
    """Le candidat individuel en est dispensé : le lui cacher serait lui faire perdre du temps."""
    vus = 0
    for p in candidats:
        if "NSI" in p.name or "PHYSIQUE" in p.name or "SVT" in p.name:
            t = _plat(_texte(p, 2))
            assert "dispensé" in t, f"{p.name} : la dispense de pratique n'est pas dite"
            vus += 1
    assert vus >= 3, "aucun livret à partie pratique trouvé"


def test_chaque_livret_dit_ce_que_le_candidat_passera(candidats):
    for p in candidats:
        if "DOSSIER" in p.name:
            continue      # le dossier d'entrée n'est pas un diagnostic de matière
        t = _plat(_texte(p, 2))
        assert "Avant de commencer" in t, p.name
        assert "Ce que ce diagnostic mesure" in t, p.name


def test_aucun_seuil_ni_classification_attribuee_avant_passation(candidats):
    """Le candidat peut cocher son propre ressenti ; il ne lit pas un niveau qu'on lui donne.

    L'échelle d'auto-positionnement du bloc 0 emploie les mêmes mots que la
    classification du bilan. C'est le sens qui les sépare : « Fragile » coché par le
    candidat n'est pas « Fragile » prononcé sur lui.
    """
    for p in candidats:
        t = _texte(p)
        for motif, quoi in [
                (r"(?:niveau|résultat|classé|vous êtes)\s*:?\s*"
                 r"(?:Fragile|Solide|En construction)", "classification attribuée"),
                (r"seuil de \d", "seuil du moteur"),
                (r"\bpalier D[123]\b", "palier de profondeur")]:
            assert not re.search(motif, t), f"{p.name} : {quoi}"


# ─────────────────────────────── les trois profils

def test_les_trois_profils_existent_et_sont_nommes_en_clair():
    import release_v2 as R
    assert set(R.DOSSIER_PROFIL.values()) == {
        "PROFIL_A_PREMIERE_PARTIE", "PROFIL_B_DEUXIEME_PARTIE",
        "PROFIL_C_BAC_EN_UNE_SESSION"}
    for p in LI.PROFILS.values():
        assert p["libelle"] and p["long"] and p["contexte"]


def test_les_faits_reglementaires_viennent_du_referentiel():
    """Aucune durée ni coefficient n'est écrit à la main dans une couverture."""
    src = (RACINE / "scripts" / "livret.py").read_text(encoding="utf-8")
    couverture = src[src.index("def couverture"):src.index("def avant_de_commencer")]
    assert "modalites" not in couverture or "m[" in couverture
    assert re.search(r"m\[.epreuves_terminales.\]", couverture), \
        "la couverture ne lit pas le référentiel des modalités"
    for interdit in ("4 h", "coefficient 16", "coef. 5"):
        assert interdit not in couverture, f"« {interdit} » écrit en dur"


# ─────────────────────────────── zones de réponse et documents d'appui

def _source_des_parties() -> list[tuple[str, str, list[str]]]:
    """Le LaTeX composé de chaque instrument, sans passer par le PDF.

    Ce qui est vérifié ici tient au source : qu'une question écrite ait une zone, et
    qu'un document annoncé soit imprimé. Le rendu, lui, est vérifié sur les PDF.
    """
    import build_instrument as BI
    import validate_instrument as VI
    sortie = []
    for i in VI.charger_referentiels(None)["catalogue"]["instruments"]:
        d = RACINE / "instruments" / i["code"]
        if not (d / "banque.json").exists() or (d / "definition.json").exists():
            continue
        sortie.append((i["code"], i["version"],
                       LI.bloc_items(BI.contexte(d, i["version"]), [1], [0], False)))
    return sortie


def test_chaque_question_ecrite_a_une_zone_de_reponse():
    """Une question qui attend une production écrite offre où l'écrire."""
    for code, version, lignes in _source_des_parties():
        src = "\n".join(lignes)
        questions = src.count(r"\question{")
        zones = src.count(r"\cadreponse{") + src.count(r"\begin{propositions}")
        assert zones == questions, \
            f"{code}/{version} : {questions} questions, {zones} zones de réponse"


def test_la_zone_de_reponse_est_a_la_mesure_de_la_production_demandee():
    """Jamais trois lignes pour une réponse de quinze.

    L'énoncé annonce la longueur attendue ; la zone la respecte, à trois lignes près.
    """
    import json as _json
    for p in sorted((RACINE / "instruments").glob("*/banque.json")):
        if p.parent.name.startswith("_"):
            continue
        for it in _json.loads(p.read_text(encoding="utf-8")).get("items", []):
            demande = re.search(r"(\w+)(?:\s+(?:à|ou)\s+(\w+))?(?:\s+de)?\s+lignes",
                                it.get("enonce") or "")
            if not demande or it["type"] == "A":
                continue
            attendu = max((LI._quantite(g) or 0) for g in demande.groups())
            if attendu:
                assert LI.lignes_attendues(it) >= attendu, \
                    f"{it['item_id']} : {attendu} lignes demandées, zone plus courte"


def test_chaque_document_dappui_est_imprime():
    """Un énoncé qui dit « d'après le tableau » imprime le tableau.

    Les figures et les tableaux de la banque n'étaient composés nulle part : le candidat
    lisait la consigne sans le document.
    """
    vus = 0
    for code, version, lignes in _source_des_parties():
        src = "\n".join(lignes)
        d = RACINE / "instruments" / code
        import build_instrument as BI
        for bloc, items, _ in BI.contexte(d, version)["blocs"]:
            for it in items:
                for sup in it.get("supports") or []:
                    if not isinstance(sup, dict):
                        continue
                    if sup.get("type") in ("tableau", "figure"):
                        vus += 1
                        assert (sup["code"] in src
                                or LI.tex(sup["titre"]) in src), \
                            f"{code}/{version} : document « {sup['titre']} » non imprimé"
    assert vus >= 20, f"trop peu de documents inspectés ({vus})"


def test_le_pack_dimpression_place_toutes_les_matieres():
    """Aucune matière ne peut manquer de l'ordre d'impression sans qu'on le voie.

    L'ordre était une liste écrite à la main, contenant un nom qui n'existait pas et
    dont l'absence de fichier passait inaperçue : la matière aurait disparu du pack
    papier en silence.
    """
    import release_v2 as R
    inconnues = [m for m in R.ORDRE_IMPRESSION if m not in LI.MATIERES]
    assert not inconnues, f"noms inconnus dans l'ordre d'impression : {inconnues}"
    attendues = sorted({k[0] for k in R.livrets_attendus()})
    oubliees = [m for m in attendues if m not in R.ORDRE_IMPRESSION]
    assert not oubliees, f"matières absentes du pack papier : {oubliees}"


# ─────────────────────────────── une seule source de vérité

def test_une_seule_release_est_remise_aux_candidats():
    """`release/` ne contient que `diagnostics-v2`.

    Deux façades ont cohabité : `diagnostics-v1`, ses 154 archives et ses packs de profil,
    et `diagnostics-v2`. Un opérateur devait deviner laquelle faisait foi, et deux chaînes
    pouvaient diverger sans que rien ne le dise.
    """
    base = RACINE / "release"
    if not base.exists():
        pytest.skip("release non construite")
    presents = sorted(d.name for d in base.iterdir() if d.is_dir())
    assert presents == ["diagnostics-v2"], f"release/ porte aussi {presents}"


def test_le_banc_de_controle_nest_pas_une_release():
    """Le contrôle de diffusion écrit hors de `release/` : ce n'est pas un produit."""
    import distribution as D
    assert RACINE / "release" not in D.SORTIE.parents, \
        f"{D.SORTIE} est rangé parmi les documents remis aux candidats"


def test_les_tableaux_internes_voyagent_avec_la_release():
    """L'opérateur qui ouvre la release n'a pas à revenir dans le dépôt."""
    interne = V2 / "04_INTERNE"
    if not interne.exists():
        pytest.skip("release v2 non construite")
    for nom in ("DISTRIBUTION_MATRIX.csv", "STUDENT_PACK_MATRIX.csv", "STUDENT_PACK_MATRIX.json",
                "CANDIDATE_PROFILES.csv", "PRINT_MATRIX.csv"):
        assert (interne / nom).exists(), f"{nom} absent de 04_INTERNE"


def test_aucun_script_ne_laisse_un_processus_derriere_lui():
    """Rien dans le dépôt ne lance de veilleur qui survivrait à sa construction.

    Trois boucles `until grep FINI_* ; do sleep` ont tourné une heure après la fin du
    build qu'elles surveillaient, attendant un marqueur que plus personne n'écrivait.
    Elles venaient du poste de pilotage, non du dépôt — et rien ne le garantissait.
    """
    motifs = [r"Popen", r"nohup", r"start_new_session", r"setsid",
              r"until\s+.*\bgrep\b", r"while\s+true", r"daemon\s*=\s*True"]
    fautifs = []
    for f in sorted((RACINE / "scripts").glob("*.py")):
        src = f.read_text(encoding="utf-8")
        # Le JavaScript de l'index filtrable emploie `while` : on ne lit que Python.
        src = re.sub(r'"""(?:.|\n)*?"""', "", src)
        for m in motifs:
            if re.search(m, src):
                fautifs.append(f"{f.name} :: {m}")
    assert not fautifs, f"processus détaché possible : {fautifs}"


def test_le_guide_designe_une_seule_source_d_envoi():
    """Une recherche globale ne doit trouver qu'une source officielle d'envoi."""
    guide = V2 / "00_GUIDE" / "GUIDE_OPERATEUR.txt"
    if not guide.exists():
        pytest.skip("release v2 non construite")
    t = guide.read_text(encoding="utf-8")
    assert t.count("SOURCE OFFICIELLE D'ENVOI") == 1
    bloc = t.split("SOURCE OFFICIELLE D'ENVOI", 1)[1][:400]
    assert "release/diagnostics-v2" in bloc


# ─────────────────────────────── les variantes réglementaires

#: Les quatre situations que l'audit d'acceptation avait trouvées sans document : elles
#: partageaient un chemin avec une autre variante, et la dernière composée écrasait la
#: précédente. Chacune doit avoir son fichier.
SITUATIONS = [
    ("P1", "MATHEMATIQUES", "SANS_SPECIALITE",
     "candidat de première partie qui ne suit pas la spécialité mathématiques"),
    ("P3", "MATHEMATIQUES", "SANS_SPECIALITE",
     "candidat en une session qui ne suit pas la spécialité mathématiques"),
    ("P2", "FRANCAIS", "ECRIT_SEUL", "candidat qui ne doit que l'écrit du français"),
    ("P2", "FRANCAIS", "ORAL_SEUL", "candidat qui ne doit que l'oral du français"),
]


def test_chaque_situation_reglementaire_a_son_livret():
    import release_v2 as R
    attendus = R.livrets_attendus()
    for profil, mat, var, qui in SITUATIONS:
        cles = [k for k in attendus
                if k[1] == profil and k[0] == mat and R.variante(mat, k[2])[0] == var]
        assert cles, f"aucun livret prévu pour le {qui}"
        for k in cles:
            sd = R.sous_dossier_livret(mat, profil, k[2])
            f = (LIVRETS / R.DOSSIER_PROFIL[profil] / sd / R.nom_livret(mat, profil, k[2]))
            if not LIVRETS.exists():
                pytest.skip("release v2 non construite")
            assert f.exists(), f"{qui} : {f.name} absent"


def test_deux_variantes_ne_partagent_jamais_un_chemin():
    import release_v2 as R
    chemins = {}
    for (mat, profil, versions, _s) in R.livrets_attendus():
        c = R.nom_livret(mat, profil, versions)
        sd = R.sous_dossier_livret(mat, profil, versions)
        cle = (profil, sd, c)
        autre = chemins.get(cle)
        assert autre is None or autre == versions, \
            f"{profil}/{sd}/{c} servirait {autre} et {versions}"
        chemins[cle] = versions


def test_le_livret_avec_specialite_porte_la_specialite_et_lautre_non():
    import release_v2 as R
    if not LIVRETS.exists():
        pytest.skip("release v2 non construite")
    for profil in ("P1", "P3"):
        d = LIVRETS / R.DOSSIER_PROFIL[profil]
        avecs = list(d.rglob("MATHEMATIQUES_AVEC_SPECIALITE.pdf"))
        sans_l = list(d.rglob("MATHEMATIQUES_SANS_SPECIALITE.pdf"))
        if not avecs or not sans_l:
            continue
        avec = avecs[0]
        sans = sans_l[0]
        assert "Spécialité mathématiques" in _texte(avec), f"{profil} : variante avec spé"
        assert "Spécialité mathématiques" not in _texte(sans), \
            f"{profil} : la variante sans spécialité en contient une"


def test_aucun_balisage_markdown_brut(candidats):
    """Le balisage des énoncés devient de la typographie, jamais de l'astérisque."""
    motifs = [(r"\*\*[^*\n]{2,}\*\*", "gras Markdown"),
              (r"__[^_\n]{2,}__", "gras Markdown"),
              (r"(?m)^\s*#{2,}\s", "titre Markdown"),
              (r"\[[^\]\n]{2,}\]\([^)\n]+\)", "lien Markdown")]
    fautifs = []
    for p in candidats:
        t = _texte(p)
        for motif, quoi in motifs:
            for x in set(re.findall(motif, t)):
                fautifs.append(f"{p.name} :: {quoi} :: {x[:40]}")
    assert not fautifs, fautifs[:8]


def test_aucune_consigne_de_partie_pratique_dans_un_livret_candidat(candidats):
    """Le candidat individuel en est dispensé : on ne lui demande pas de la traiter."""
    for p in candidats:
        t = _texte(p)
        for motif in (r"rendu\.py", r"test_NSI", r"machine du centre"):
            assert not re.search(motif, t), f"{p.name} : consigne sur machine ({motif})"


def test_la_numerotation_des_parties_est_unique(candidats):
    for p in candidats:
        if "DOSSIER" in p.name:
            continue
        # Seuls les bandeaux comptent : la règle de calculatrice de la couverture et de
        # l'encadré cite légitimement « Partie 3 uniquement » ou « pour la Partie 3 ».
        t = re.sub(r"Parties? [\d, et]+ uniquement|pour (?:la|les) Parties? [\d, et]+", "",
                   _plat(_texte(p)))
        numeros = re.findall(r"Partie (\d+)", t)
        assert len(numeros) == len(set(numeros)), \
            f"{p.name} : parties répétées {sorted(numeros)}"


def test_un_livret_sans_zone_ne_promet_pas_de_zones(candidats):
    for p in candidats:
        t = _plat(_texte(p))
        if "Répondez à toutes les questions sur ce livret" in t:
            assert "Question 1" in t or "cadres prévus" in t, \
                f"{p.name} : promet des questions qu'il ne porte pas"


def test_aucun_jargon_technique_dans_un_livret_candidat(candidats):
    """Zéro code interne dans un document remis à une famille.

    Le code d'instrument figurait en 7,5 pt gris au pied de la couverture. C'était toléré
    tant que la traçabilité n'existait nulle part ailleurs ; le manifeste la porte
    désormais, avec l'artifact_id, les instruments et l'empreinte de chaque fichier.
    """
    motifs = [(r"_FIXTURE|_MAQUETTE", "jeu de test"),
              (r"\bstandard_2028\b|\bETENDUE\b|\bSPECIFIQUES\b", "version interne"),
              (r"(?<![A-Za-z])N1(?![0-9A-Za-z])|(?<![A-Za-z])NT(?![0-9A-Za-z])", "niveau interne"),
              (r"/home/|/tmp/|referentiels/|instruments/|scripts/", "chemin du dépôt"),
              (r"\b[0-9a-f]{40,}\b", "empreinte"),
              (r"\.py\b", "nom de script")]
    fautifs = []
    for p in candidats:
        t = _plat(_texte(p))
        for motif, quoi in motifs:
            for x in set(re.findall(motif, t)):
                fautifs.append(f"{p.name} :: {quoi} :: {x}")
    assert not fautifs, fautifs[:10]


def test_la_correction_coach_garde_la_tracabilite():
    """Ce que le candidat ne voit plus, le correcteur doit le voir."""
    pdfs = _pdfs(CORRECTIONS)
    if not pdfs:
        pytest.skip("release v2 non construite")
    for p in pdfs:
        assert re.search(r"[A-Z][A-Z-]+/[A-Za-z0-9_]+", _plat(_texte(p, 1))), \
            f"{p.name} : aucun code d'instrument sur la couverture du correcteur"


def test_provenance_git_du_manifeste_v2():
    """Au commit de release B, le manifeste porte exactement le commit source HEAD^."""
    manifeste_path = V2 / "04_INTERNE" / "MANIFESTE_V2.json"
    if not manifeste_path.exists():
        pytest.skip("release v2 non construite")
    m = json.loads(manifeste_path.read_text(encoding="utf-8"))
    source_git_head = m.get("source_git_head")
    assert source_git_head, "source_git_head absent de MANIFESTE_V2.json"
    
    r_diff = subprocess.run(["git", "-C", str(RACINE), "diff", "--name-only", "HEAD^", "HEAD"],
                            capture_output=True, text=True)
    assert r_diff.returncode == 0, "HEAD^ doit exister dans le dépôt Git"
    # Le projet peut vivre dans un sous-dossier d'un dépôt plus large : les chemins du
    # diff sont ramenés à la racine du projet, les autres chemins sont hors périmètre.
    prefixe = subprocess.run(["git", "-C", str(RACINE), "rev-parse", "--show-prefix"],
                             capture_output=True, text=True).stdout.strip()
    fichiers = [f[len(prefixe):] for f in r_diff.stdout.splitlines()
                if f.strip() and f.startswith(prefixe)]
    non_release = [f for f in fichiers if not (f.startswith("release/") or f in ("DISTRIBUTION_MATRIX.csv", "STUDENT_PACK_MATRIX.csv", "STUDENT_PACK_MATRIX.json"))]
    if not non_release and fichiers:
        r_parent = subprocess.run(["git", "-C", str(RACINE), "rev-parse", "HEAD^"],
                                  capture_output=True, text=True)
        parent = r_parent.stdout.strip()
        assert source_git_head == parent, (
            f"MANIFESTE_V2.source_git_head ({source_git_head}) doit être exactement HEAD^ ({parent})"
        )

