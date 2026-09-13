#!/usr/bin/env python3
"""Custom candidate pack generator for Nexus diagnostics.

Builds a tailored pack for a specific candidate based on regulatory profile,
continuous assessment mode (annuelle vs fin_cycle), chosen specialities,
and French/Philosophy/Maths status.

Outputs directly to `exports_candidats/` (gitignored) or a specified directory.
Candidate exports are DERIVED from `release/diagnostics-v2/` — the only canonical
source — and never become a second source of truth.

The default export directory is deterministic and human-readable:
`<SLUG_CANDIDATE_NAME>__<CANDIDATE_ID>__BAC<SESSION>` (or `<CANDIDATE_ID>__BAC<SESSION>`
for pseudonymous packs). Rerunning the same candidate rebuilds the same directory:
the pack is built in a temporary sibling, validated, then swapped in only on success.

Each export is structured into three distinct physical directories:
- A_ENVOYER/ : BORDEREAU_ENVOI.txt and livrets/ (individual candidate booklets only).
- OPTION_IMPRESSION/ : PACK_IMPRESSION_CANDIDAT.pdf (assembled PDF for printing only).
- _INTERNE_NEXUS/ : BORDEREAU_OPERATEUR_INTERNE.txt (coach confidential manifest, 0 PDF).

Never commits personal or candidate data to the repository.
"""
from __future__ import annotations

import argparse
import copy
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path
from typing import Any

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import distribution as DIS
import livret as LI
import maquette_donnees as MD
import release_v2 as REL

DOSSIER_PROFIL = {
    "P1": "PROFIL_A_PREMIERE_PARTIE",
    "P2": "PROFIL_B_DEUXIEME_PARTIE",
    "P3": "PROFIL_C_BAC_EN_UNE_SESSION",
}

LIBELLE_PROFIL = {
    "P1": "Première partie (anticipation)",
    "P2": "Deuxième partie (terminale)",
    "P3": "Baccalauréat complet en une session",
}

SPECIALITES_VALIDES = ("MATH", "PC", "NSI", "SVT", "SES", "HGGSP", "HLP")


def _normaliser_spe(spe: str | None) -> str | None:
    if not spe:
        return None
    s = spe.strip().upper()
    return s


def build_candidate_facts(
    profil: str,
    mode_ep: str,
    spes_premiere: list[str],
    spe_non_poursuivie: str | None = None,
    spes_terminales: list[str] | None = None,
    eaf_due: str | None = None,
    math_ea_due: bool = False,
    fr_pos_requis: bool = False,
    fr_mai_requis: bool = False,
    diagnostic_nexus_utile: bool = True,
    candidat_id: str | None = None,
    config_francais: str | None = None,
) -> dict[str, Any]:
    """Builds a structured fact dictionary suitable for derivation engines."""
    cid = candidat_id or f"CAND-{hashlib.sha256(os.urandom(16)).hexdigest()[:8].upper()}"

    # Strict automatic derivation of philosophie_due : P1=False, P2=True, P3=True
    philosophie_due = profil in ("P2", "P3")

    # eaf_due resolution: "none", "ecrit", "oral", "les_deux"
    if eaf_due is None:
        if config_francais is not None:
            effective_eaf = "none" if config_francais == "aucune" else config_francais
        else:
            effective_eaf = "none" if profil == "P2" else "les_deux"
    else:
        effective_eaf = eaf_due

    # Guard 2: French pedagogical diagnostics are strictly optional and False by default
    effective_fr_pos = bool(fr_pos_requis)
    effective_fr_mai = bool(fr_mai_requis) and (profil in ("P2", "P3"))

    # Guard 1: Strong normalisation and validation of specialities invariant
    spes_1re_norm = [_normaliser_spe(s) for s in (spes_premiere or [])]
    spes_1re_norm = [s for s in spes_1re_norm if s]
    if len(spes_1re_norm) != len(set(spes_1re_norm)):
        raise ValueError(f"Spécialités de Première en double : {spes_1re_norm}")
    for s in spes_1re_norm:
        if s not in SPECIALITES_VALIDES:
            raise ValueError(f"Spécialité invalide en Première : {s}")

    spes_tle_norm = [_normaliser_spe(s) for s in (spes_terminales or [])] if spes_terminales is not None else None
    if spes_tle_norm is not None:
        spes_tle_norm = [s for s in spes_tle_norm if s]
        if len(spes_tle_norm) != len(set(spes_tle_norm)):
            raise ValueError(f"Spécialités de Terminale en double : {spes_tle_norm}")
        for s in spes_tle_norm:
            if s not in SPECIALITES_VALIDES:
                raise ValueError(f"Spécialité invalide en Terminale : {s}")

    spe_non_poursuivie_norm = _normaliser_spe(spe_non_poursuivie) if spe_non_poursuivie else None
    if spe_non_poursuivie_norm in ("AUCUNE", "INCONNUE", "UNKNOWN", "NON_RENSEIGNEE", ""):
        spe_non_poursuivie_norm = "inconnue"

    # En P2 et P3, deux spécialités terminales distinctes sont strictement obligatoires
    if profil in ("P2", "P3"):
        if spes_tle_norm is None or len(spes_tle_norm) != 2:
            if len(spes_1re_norm) == 3 and spe_non_poursuivie_norm and spe_non_poursuivie_norm != "inconnue":
                spes_tle_norm = [s for s in spes_1re_norm if s != spe_non_poursuivie_norm]
            else:
                raise ValueError(f"Profil {profil} invalide : deux spécialités terminales distinctes sont obligatoires (reçu {spes_tle_norm})")

    if spes_tle_norm:
        if len(spes_tle_norm) != 2:
            raise ValueError(f"Nombre de spécialités terminales invalide : attendu 2, reçu {len(spes_tle_norm)} ({spes_tle_norm})")
        if spes_1re_norm:
            if len(spes_1re_norm) != 3:
                raise ValueError(f"Nombre de spécialités de Première invalide : attendu 3, reçu {len(spes_1re_norm)} ({spes_1re_norm})")
            if not set(spes_tle_norm).issubset(set(spes_1re_norm)):
                raise ValueError(f"Spécialités de Terminale ({spes_tle_norm}) non incluses dans les spécialités de Première ({spes_1re_norm})")
            diff = set(spes_1re_norm) - set(spes_tle_norm)
            if len(diff) != 1:
                raise ValueError(f"Différence entre 1re ({spes_1re_norm}) et Tle ({spes_tle_norm}) invalide : {diff}")
            spe_deduite = list(diff)[0]
            if spe_non_poursuivie_norm == "inconnue":
                raise ValueError(f"Incohérence des spécialités : la spécialité non poursuivie ne peut pas être inconnue lorsque l'orientation Terminale est connue ({spes_tle_norm})")
            if spe_non_poursuivie_norm and spe_non_poursuivie_norm != spe_deduite:
                raise ValueError(f"Incohérence des spécialités : spécialité fournie '{spe_non_poursuivie_norm}' ≠ différence 1re - Tle '{spe_deduite}'")
            spe_non_poursuivie_norm = spe_deduite
    else:
        # spes_terminales vide : strictement réservé à une orientation non encore déterminée en P1
        if profil != "P1":
            raise ValueError(f"Le profil {profil} exige deux spécialités terminales connues.")
        if spe_non_poursuivie_norm and spe_non_poursuivie_norm != "inconnue":
            if spes_1re_norm and spe_non_poursuivie_norm not in spes_1re_norm:
                raise ValueError(f"Spécialité non poursuivie '{spe_non_poursuivie_norm}' non présente dans les spécialités de Première ({spes_1re_norm})")
            if spes_1re_norm and len(spes_1re_norm) == 3:
                spes_tle_norm = [s for s in spes_1re_norm if s != spe_non_poursuivie_norm]
            else:
                spes_tle_norm = []
        else:
            spe_non_poursuivie_norm = "inconnue"
            spes_tle_norm = []

    final_spe_abandonnee = spe_non_poursuivie_norm if spe_non_poursuivie_norm else "inconnue"

    qp = {
        "candidat_id": cid,
        "reponses": {
            "profil": profil,
            "mode_evaluations_ponctuelles": mode_ep,
            "diagnostic_nexus_utile": diagnostic_nexus_utile,
            "philosophie_due": philosophie_due,
            "eaf_due": effective_eaf,
            "epreuves_francais_a_presenter": "aucune" if effective_eaf == "none" else effective_eaf,
            "fr_pos_requis": effective_fr_pos,
            "positionnement_francais": effective_fr_pos,
            "fr_mai_requis": effective_fr_mai,
            "specialites_suivies_premiere": spes_1re_norm,
            "specialite_non_poursuivie": final_spe_abandonnee,
            "specialite_abandonnee": final_spe_abandonnee,
            "specialites_terminales": spes_tle_norm,
        },
    }
    r = qp["reponses"]
    if profil == "P1":
        r["session_baccalaureat_finale"] = 2028
        r["annee_scolaire_passation_ea"] = "2026-2027"
        r["mode_passation_ea"] = "anticipation"
        r["specialites"] = spes_1re_norm
        r["math_ea_due"] = True
    elif profil == "P2":
        r["session_baccalaureat_finale"] = 2027
        r["annee_scolaire_passation_ea"] = "2026-2027"
        r["mode_passation_ea"] = "anticipation"
        r["specialites"] = spes_tle_norm
        r["math_ea_due"] = math_ea_due
        if math_ea_due:
            r["ea_mathematiques_deja_presentee"] = "non"
            r["note_ea_mathematiques"] = None
            r["conservation_demandee"] = "non"
        else:
            r["ea_mathematiques_deja_presentee"] = "oui"
            r["session_de_presentation_ea_math"] = 2026
            r["note_ea_mathematiques"] = 12
            r["conservation_demandee"] = "oui"
    else:  # P3
        r["session_baccalaureat_finale"] = 2027
        r["annee_scolaire_passation_ea"] = "2026-2027"
        r["mode_passation_ea"] = "meme_session"
        r["specialites"] = spes_tle_norm
        r["math_ea_due"] = True

    return qp


def find_booklet(prof_dir: Path, name: str) -> Path | None:
    """Searches for a booklet in prof_dir or its thematic subdirectories."""
    p = prof_dir / name
    if p.exists():
        return p
    matches = list(prof_dir.rglob(name))
    if matches:
        return matches[0]
    return None


def map_instruments_to_booklets(
    instruments: list[tuple[str, str]],
    profil: str,
    source_dir: Path,
) -> list[tuple[str, Path, str]]:
    """Maps derived instruments to physical PDF files in release directory.

    Returns list of tuples: (subject_label, booklet_path, variant_details).
    """
    mapped: list[tuple[str, Path, str]] = []
    codes = {c for c, _ in instruments}
    prof_dir = source_dir / DOSSIER_PROFIL[profil]

    # Entry dossier is always included
    entry_pdf = find_booklet(prof_dir, "DOSSIER_D_ENTREE_NEXUS.pdf")
    if entry_pdf and entry_pdf.exists():
        mapped.append(("Dossier d'entrée Nexus", entry_pdf, "Formulaires QP et MET"))

    # Common trunk: HG, EMC, ES
    if "TC-HG" in codes:
        p = find_booklet(prof_dir, "HISTOIRE-GEOGRAPHIE.pdf")
        if p and p.exists():
            mapped.append(("Histoire-géographie", p, "Tronc commun"))

    if "TC-EMC" in codes:
        p = find_booklet(prof_dir, "ENSEIGNEMENT_MORAL_ET_CIVIQUE.pdf")
        if p and p.exists():
            mapped.append(("Enseignement moral et civique", p, "Tronc commun"))

    if "TC-ES" in codes:
        p = find_booklet(prof_dir, "ENSEIGNEMENT_SCIENTIFIQUE.pdf")
        if p and p.exists():
            mapped.append(("Enseignement scientifique", p, "Tronc commun"))

    # French EAF (only if due)
    eaf_written = any(c == "FR-EAF" and v in ("standard", "ecrit", "standard_2028", "ecrit_2028") for c, v in instruments)
    eaf_oral = "FR-EAF-ORAL" in codes or any(c == "FR-EAF" and "oral" in v for c, v in instruments)

    if eaf_written and eaf_oral:
        p = find_booklet(prof_dir, "FRANCAIS_ECRIT_ET_ORAL.pdf")
        if p and p.exists():
            mapped.append(("Français (EAF)", p, "Épreuve anticipée — écrit et oral"))
    elif eaf_written:
        p = find_booklet(prof_dir, "FRANCAIS_ECRIT_SEUL.pdf")
        if p and p.exists():
            mapped.append(("Français (EAF)", p, "Épreuve anticipée — écrit seul"))
    elif eaf_oral:
        p = find_booklet(prof_dir, "FRANCAIS_ORAL_SEUL.pdf")
        if p and p.exists():
            mapped.append(("Français (EAF)", p, "Épreuve anticipée — oral seul"))

    # Pedagogical French diagnostics (FR-MAI & FR-POS)
    if "FR-POS" in codes or "FR-POS-ORAL" in codes:
        pos_pdf = source_dir / "00_COMMUN" / "POSITIONNEMENT_FRANCAIS.pdf"
        if pos_pdf.exists():
            mapped.append(("Positionnement français", pos_pdf, "Diagnostic linguistique commun (écrit et oral)"))

    if "FR-MAI" in codes:
        p = find_booklet(prof_dir, "MAITRISE_DU_FRANCAIS.pdf")
        if p and p.exists():
            mapped.append(("Maîtrise du français", p, "Diagnostic pédagogique transverse"))

    # Mathematics
    if "EDS-MATH" in codes:
        p = find_booklet(prof_dir, "MATHEMATIQUES_AVEC_SPECIALITE.pdf")
        if p and p.exists():
            mapped.append(("Mathématiques", p, "Avec spécialité"))
    elif "MATH-EA" in codes:
        p = find_booklet(prof_dir, "MATHEMATIQUES_SANS_SPECIALITE.pdf")
        if p and p.exists():
            mapped.append(("Mathématiques", p, "Sans spécialité (anticipée spécifique)"))

    # Philosophy & Grand Oral
    if "PHI" in codes:
        p = find_booklet(prof_dir, "PHILOSOPHIE.pdf")
        if p and p.exists():
            mapped.append(("Philosophie", p, "Épreuve terminale obligatoire"))

    if "GO" in codes:
        p = find_booklet(prof_dir, "GRAND_ORAL.pdf")
        if p and p.exists():
            mapped.append(("Grand oral", p, "Épreuve terminale"))

    # Specialities
    spe_fichiers = {
        "PC": "SPECIALITE_PHYSIQUE-CHIMIE.pdf",
        "NSI": "SPECIALITE_NSI.pdf",
        "SVT": "SPECIALITE_SVT.pdf",
        "SES": "SPECIALITE_SES.pdf",
        "HGGSP": "SPECIALITE_HGGSP.pdf",
        "HLP": "SPECIALITE_HLP.pdf",
    }
    for spe in SPECIALITES_VALIDES:
        if f"EDS-{spe}" in codes and spe != "MATH":
            nom_f = spe_fichiers.get(spe, f"SPECIALITE_{spe}.pdf")
            p = find_booklet(prof_dir, nom_f)
            if p and p.exists():
                mapped.append((f"Spécialité {spe}", p, f"Enseignement de spécialité ({spe})"))

    return mapped


NOMS_MATIERES_FAMILLE = {
    "FR-EAF": "Français écrit",
    "FR-EAF-ORAL": "Diagnostic oral réalisé avec l’enseignant",
    "MATH-EA": "Mathématiques",
    "TC-HG": "Histoire-géographie",
    "TC-EMC": "Enseignement moral et civique",
    "TC-ES": "Enseignement scientifique",
    "PHI": "Philosophie",
    "GO": "Grand oral",
    "EDS-MATH": "Spécialité Mathématiques",
    "EDS-PC": "Spécialité Physique-Chimie",
    "EDS-NSI": "Spécialité Numérique et Sciences Informatiques",
    "EDS-SVT": "Spécialité Sciences de la Vie et de la Terre",
    "EDS-SES": "Spécialité Sciences Économiques et Sociales",
    "EDS-HGGSP": "Spécialité Histoire-Géographie, Géopolitique et Sciences Politiques",
    "EDS-HLP": "Spécialité Humanités, Littérature et Philosophie",
    "FR-POS": "Positionnement écrit de français",
    "FR-POS-ORAL": "Diagnostic oral réalisé avec l’enseignant",
    "FR-MAI": "Maîtrise du français",
    "QP": "Questionnaire pédagogique de positionnement",
    "MET": "Fiche méthodologique de passation",
}


def verifier_gate_lexical_bordereau_famille(texte: str) -> None:
    """Garde-fou 4 : Gate lexical strict sur le bordereau famille."""
    interdits = [
        "standard_2028",
        "/N1",
        "/NT",
        "CORRECTIONS_COACH",
        "grille_coach",
        "release/diagnostics-v2",
        "OPTION_IMPRESSION",
        "PACK_IMPRESSION_CANDIDAT",
        "_INTERNE_NEXUS",
        "BORDEREAU_OPERATEUR_INTERNE",
        "[",
        "]",
    ]
    for mot in interdits:
        if mot in texte:
            raise ValueError(f"Gate lexical bordereau famille violé : motif interdit détecté '{mot}'")

    if "2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES" in texte:
        sec_off = texte.split("2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES")[1].split("3. ÉVALUATIONS OFFICIELLES REPORTÉES")[0]
        if re.search(r"\b\d+\s*min\b", sec_off) or re.search(r"\bmin\b", sec_off):
            raise ValueError("Gate lexical bordereau famille violé : durée diagnostique (min) interdite dans la section des épreuves officielles")

    mention_obligatoire = "« Durée du diagnostic Nexus — différente de la durée réglementaire de l’épreuve officielle. »"
    if mention_obligatoire not in texte:
        raise ValueError("Gate lexical bordereau famille violé : mention obligatoire absente")


def _remove_cover_text(page, span: dict) -> None:
    """Remove one XeLaTeX text object without rewriting the rest of the page.

    Redaction APIs normalize drawing coordinates, subtly changing the logo's
    rasterization. Nexus text objects use Identity-H glyphs in hex TJ operands;
    match the located span's glyph IDs and fail closed on any unexpected layout.
    """
    traces = [t for t in page.get_texttrace()
              if abs(t["bbox"][0] - span["bbox"][0]) < 1
              and abs(t["chars"][0][2][1] - span["origin"][1]) < 1]
    if len(traces) != 1:
        raise ValueError("Texte de couverture ambigu : personnalisation interrompue.")
    # Ignore synthetic Unicode continuations of ligatures (glyph -1).
    glyphs = b"".join(c[1].to_bytes(2, "big") for c in traces[0]["chars"] if c[1] >= 0)
    matches = []
    for xref in page.get_contents():
        stream = page.parent.xref_stream(xref)
        for match in re.finditer(rb"\bBT\b.*?\bET\b", stream, re.DOTALL):
            encoded = b"".join(bytes.fromhex(h.decode("ascii")) for h in
                               re.findall(rb"<([0-9a-fA-F]+)>", match.group()))
            if encoded == glyphs:
                matches.append((xref, stream, match.start(), match.end()))
    if len(matches) != 1:
        raise ValueError("Format de couverture inattendu : personnalisation interrompue.")
    xref, stream, start, end = matches[0]
    page.parent.update_stream(xref, stream[:start] + stream[end:])


def _personalize_booklet(source: Path, destination: Path, name: str, session: int) -> None:
    """Adapt cover fields and entry identification instructions in exports only.

    Requires PyMuPDF and the same installed Lato faces as the canonical builder.
    Only targeted text objects change; backgrounds and response rules are kept.
    """
    import fitz

    fonts = {}
    for face in ("Regular", "Bold"):
        match = subprocess.run(
            ["fc-match", f"Lato:style={face}", "-f", "%{postscriptname}|%{file}"],
            check=True, capture_output=True, text=True,
        ).stdout
        family, _, filename = match.partition("|")
        if family != f"Lato-{face}" or not Path(filename).is_file():
            raise ValueError("La personnalisation nécessite les polices Lato Regular et Bold.")
        fonts[face] = filename

    font = fitz.Font(fontfile=fonts["Bold"])
    if any(not font.has_glyph(ord(char)) for char in name):
        raise ValueError("Le nom contient un caractère absent de la police Lato.")
    width = 70 * 72 / 25.4  # Existing 70 mm identity response rule.
    size = min(11, width / font.text_length(name, fontsize=1))
    if size < 8:
        raise ValueError("Le nom est trop long pour la zone d'identification de la couverture.")

    with fitz.open(source) as document:
        page = document[0]
        spans = [span for block in page.get_text("dict")["blocks"]
                 for line in block.get("lines", []) for span in line["spans"]]
        identities = [s for s in spans if s["text"] == "RÉFÉRENCE CANDIDAT"]
        sessions = [s for s in spans if s["text"] == "SESSION FINALE"]
        if len(identities) != 1 or len(sessions) != 1:
            raise ValueError(f"Zone d'identification Nexus V2 introuvable : {source.name}")
        identity, session_label = identities[0], sessions[0]
        values = [s for s in spans
                  if abs(s["origin"][0] - session_label["origin"][0]) < 1
                  and 0 < s["origin"][1] - session_label["origin"][1] < 20]
        if len(values) != 1:
            raise ValueError(f"Session de couverture introuvable : {source.name}")
        session_value = values[0]
        change_session = session_value["text"] != str(session)
        _remove_cover_text(page, identity)
        if change_session:
            _remove_cover_text(page, session_value)
        for face, filename in fonts.items():
            reference = page.insert_font(fontname=f"NexusIdentity{face}", fontfile=filename)
            # Lato shares a glyph for space/NBSP. Keep the supplied ordinary
            # space in extracted names, without changing the font's appearance.
            cmap_ref = int(document.xref_get_key(reference, "ToUnicode")[1].split()[0])
            cmap = document.xref_stream(cmap_ref)
            space = fitz.Font(fontfile=filename).has_glyph(32)
            cmap = re.sub(fr"<{space:04x}>\s+<00a0>".encode(),
                          f"<{space:04x}> <0020>".encode(), cmap, flags=re.IGNORECASE)
            document.update_stream(cmap_ref, cmap)
        page.insert_text(identity["origin"], "CANDIDAT :",
                         fontsize=identity["size"], fontname="NexusIdentityRegular",
                         color=fitz.sRGB_to_pdf(identity["color"]))
        page.insert_text((identity["origin"][0], identity["origin"][1] + 17), name,
                         fontsize=size, fontname="NexusIdentityBold",
                         color=fitz.sRGB_to_pdf(session_value["color"]))
        if change_session:
            page.insert_text(session_value["origin"], str(session),
                             fontsize=session_value["size"], fontname="NexusIdentityBold",
                             color=fitz.sRGB_to_pdf(session_value["color"]))
        document.save(destination, deflate=True)


def situation_connue(qp: dict, candidat_nom: str) -> dict:
    """Les faits réglementaires qui ont composé le pack, tels que le dossier d'entrée
    nominatif les rappelle au lieu de les redemander."""
    r = qp["reponses"]
    return {"nom": candidat_nom, "profil": r["profil"], "session": r["session_baccalaureat_finale"],
            "mode_ep": r["mode_evaluations_ponctuelles"], "specialites": list(r["specialites"]),
            "spe_non_poursuivie": r.get("specialite_non_poursuivie"),
            "eaf": r["epreuves_francais_a_presenter"], "mode_passation_ea": r["mode_passation_ea"]}


EXPORTS_CANDIDATS = RACINE / "exports_candidats"
_CARACTERES_INTERDITS = re.compile(r'[\\/:*?"<>|\x00-\x1f\x7f]')
_ENTREES_EXPORT = ("A_ENVOYER", "OPTION_IMPRESSION", "_INTERNE_NEXUS")


def slug_nom(texte: str, longueur_max: int = 80) -> str:
    """Filesystem-safe, readable slug: spaces become `_`, letters are preserved.

    Unsafe characters (path separators, control characters, `:*?"<>|`) are
    removed; only letters, digits, `_` and `-` survive.
    """
    texte = unicodedata.normalize("NFKC", texte.strip())
    texte = _CARACTERES_INTERDITS.sub("", texte)
    texte = re.sub(r"[\s.]+", "_", texte)
    texte = re.sub(r"[^\w\-]", "", texte)
    texte = re.sub(r"_+", "_", texte).strip("_-")
    if not texte:
        raise ValueError("Le nom ne contient aucun caractère utilisable pour un dossier.")
    return texte[:longueur_max].rstrip("_-")


def nom_dossier_export(candidat_nom: str | None, candidat_id: str, session: int) -> str:
    """Deterministic export directory name; the candidate id is always present."""
    reference = slug_nom(candidat_id)
    if candidat_nom is None:
        return f"{reference}__BAC{session}"
    return f"{slug_nom(candidat_nom)}__{reference}__BAC{session}"


def _valider_export(chantier: Path, booklets: list, assemble_pdf: bool,
                    copy_booklets: bool, candidat_nom: str | None) -> None:
    """Fail closed before an incomplete pack replaces a validated export."""
    for relatif in ("A_ENVOYER/BORDEREAU_ENVOI.txt",
                    "_INTERNE_NEXUS/BORDEREAU_OPERATEUR_INTERNE.txt"):
        if not (chantier / relatif).is_file():
            raise ValueError(f"Export incomplet : {relatif} manquant.")
    attendus = sorted(path.name for _, path, _ in booklets if path.exists())
    if copy_booklets:
        produits = sorted(p.name for p in (chantier / "A_ENVOYER" / "livrets").glob("*.pdf"))
        if produits != attendus:
            raise ValueError(f"Export incomplet : livrets {produits} ≠ {attendus}.")
        if candidat_nom is not None:
            import fitz
            for nom in produits:
                with fitz.open(chantier / "A_ENVOYER" / "livrets" / nom) as document:
                    if candidat_nom not in document[0].get_text():
                        raise ValueError(f"Personnalisation absente de la couverture : {nom}")
    if assemble_pdf and (candidat_nom is not None or attendus):
        pack = chantier / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf"
        if candidat_nom is not None and not pack.is_file():
            raise ValueError("Export incomplet : PACK_IMPRESSION_CANDIDAT.pdf manquant.")


def _publier_export(chantier: Path, target: Path) -> None:
    """Swap the validated build into place; the previous export survives any failure.

    A directory holding nothing but pack entries is replaced whole. A caller-supplied
    directory that also holds foreign files keeps them: only the pack entries change.
    """
    if not target.exists():
        chantier.rename(target)
        return
    if target.is_symlink() or not target.is_dir():
        raise ValueError(f"La cible d'export n'est pas un dossier ordinaire : {target}")
    etrangers = [p for p in target.iterdir() if p.name not in _ENTREES_EXPORT]
    if not etrangers:
        perime = target.with_name(f".{target.name}.perime-{os.getpid()}")
        target.rename(perime)
        chantier.rename(target)
        shutil.rmtree(perime)
        return
    for entree in _ENTREES_EXPORT:
        ancien = target / entree
        if ancien.is_symlink() or ancien.is_file():
            ancien.unlink()
        elif ancien.is_dir():
            shutil.rmtree(ancien)
        if (chantier / entree).exists():
            (chantier / entree).rename(ancien)
    shutil.rmtree(chantier)


DOSSIER_ENTREE_CODES = ("QP", "MET")
LIBELLE_DOSSIER_ENTREE = "Dossier d’entrée Nexus — parcours et méthodes de travail"


def lignes_diagnostics_famille(effective: list, cat: dict, duree_dossier: int) -> list[tuple[str, int]]:
    """Les lignes de la section 4 du bordereau famille : un libellé et des minutes.

    QP et MET forment un seul livret, le dossier d'entrée : une seule ligne, à la place
    du premier des deux, avec la durée réellement annoncée par ce livret. Le total du
    bordereau est la somme de ces lignes, jamais un calcul séparé.
    """
    codes_effective = [c for c, _ in effective]
    lignes, dossier_pose = [], False
    for code, ver in effective:
        inst = next((it for it in cat["instruments"] if it["code"] == code and it["version"] == ver), None)
        if code in DOSSIER_ENTREE_CODES:
            if not dossier_pose:
                lignes.append((LIBELLE_DOSSIER_ENTREE, duree_dossier))
                dossier_pose = True
            continue
        if not inst:
            continue
        minutes = LI.duree_livret_candidat(code, inst["duree_cible_min"])
        if code in ("FR-EAF-ORAL", "FR-POS-ORAL"):
            lignes.append(("Diagnostic oral réalisé avec l’enseignant", minutes))
        elif code == "FR-EAF":
            if "oral" in ver:
                if "FR-EAF-ORAL" not in codes_effective:
                    lignes.append(("Diagnostic oral réalisé avec l’enseignant", minutes))
            else:
                lignes.append(("Français écrit", minutes))
        elif code == "MATH-EA":
            lignes.append(("Mathématiques", minutes))
        elif code == "FR-MAI":
            lignes.append(("Maîtrise du français", minutes))
        elif code == "FR-POS":
            lignes.append(("Positionnement écrit de français", minutes))
        elif code in ("TC-HG", "TC-EMC", "TC-ES", "PHI", "GO") or code.startswith("EDS-"):
            lignes.append((NOMS_MATIERES_FAMILLE.get(code, code), minutes))
        else:
            lignes.append((inst.get("libelle") or inst.get("nom") or code, minutes))
    return lignes


def create_candidate_pack(
    profil: str,
    mode_ep: str,
    spes_premiere: list[str],
    spe_non_poursuivie: str | None = None,
    spes_terminales: list[str] | None = None,
    eaf_due: str | None = None,
    math_ea_due: bool = False,
    fr_pos_requis: bool = False,
    fr_mai_requis: bool = False,
    diagnostic_nexus_utile: bool = True,
    candidat_id: str | None = None,
    output_dir: Path | None = None,
    assemble_pdf: bool = True,
    copy_booklets: bool = True,
    config_francais: str | None = None,
    candidat_nom: str | None = None,
) -> Path:
    """Generates the tailored candidate folder and documents with strict separation."""
    if candidat_nom is not None:
        if not candidat_nom.strip() or any(not c.isprintable() for c in candidat_nom):
            raise ValueError("Le nom candidat doit être non vide et tenir sur une ligne.")
        candidat_nom = candidat_nom.strip()
        if not copy_booklets:
            raise ValueError("La personnalisation nécessite copy_booklets=True.")
    cat = DIS.catalogue()
    qp = build_candidate_facts(
        profil=profil,
        mode_ep=mode_ep,
        spes_premiere=spes_premiere,
        spe_non_poursuivie=spe_non_poursuivie,
        spes_terminales=spes_terminales,
        eaf_due=eaf_due,
        math_ea_due=math_ea_due,
        fr_pos_requis=fr_pos_requis,
        fr_mai_requis=fr_mai_requis,
        diagnostic_nexus_utile=diagnostic_nexus_utile,
        candidat_id=candidat_id,
        config_francais=config_francais,
    )
    cid = qp["candidat_id"]
    session = qp["reponses"]["session_baccalaureat_finale"]

    if output_dir is None:
        target = EXPORTS_CANDIDATS / nom_dossier_export(candidat_nom, cid, session)
    else:
        target = Path(output_dir).resolve()

    if candidat_nom is not None:
        exports = EXPORTS_CANDIDATS.resolve()
        if exports != EXPORTS_CANDIDATS or not target.resolve().is_relative_to(exports):
            raise ValueError("Les exports nominatifs doivent rester dans exports_candidats/.")

    # Le pack se construit dans un chantier voisin, puis remplace l'export précédent
    # seulement une fois validé : une même personne regénérée deux fois occupe un seul
    # dossier, et un échec laisse l'export validé intact.
    target.parent.mkdir(parents=True, exist_ok=True)
    chantier = Path(tempfile.mkdtemp(prefix=f".{target.name}.chantier-", dir=target.parent))
    try:
        booklets = _construire_export(chantier, qp, cat, profil, mode_ep, diagnostic_nexus_utile,
                                      assemble_pdf, copy_booklets, candidat_nom)
        _valider_export(chantier, booklets, assemble_pdf, copy_booklets, candidat_nom)
        _publier_export(chantier, target)
    finally:
        shutil.rmtree(chantier, ignore_errors=True)
    return target


def _construire_export(target: Path, qp: dict, cat: dict, profil: str, mode_ep: str,
                       diagnostic_nexus_utile: bool, assemble_pdf: bool,
                       copy_booklets: bool, candidat_nom: str | None) -> list:
    """Writes the three pack directories under `target`; returns the booklet plan."""
    cid = qp["candidat_id"]
    math_ea_due = bool(qp["reponses"].get("math_ea_due", False))
    a_envoyer_dir = target / "A_ENVOYER"
    option_impression_dir = target / "OPTION_IMPRESSION"
    interne_dir = target / "_INTERNE_NEXUS"
    a_envoyer_dir.mkdir(parents=True, exist_ok=True)
    interne_dir.mkdir(parents=True, exist_ok=True)

    analysis = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, cat)
    dues = analysis["epreuves_reglementaires_dues"]
    diags = analysis["diagnostics_nexus_utiles"]
    reportees = analysis.get("evaluations_reportees_fin_cycle", [])

    effective = diags if diagnostic_nexus_utile else dues

    source_booklets = RACINE / "release" / "diagnostics-v2" / "01_LIVRETS_CANDIDAT"
    booklets = map_instruments_to_booklets(effective, profil, source_booklets)

    livrets_dir = a_envoyer_dir / "livrets"
    if copy_booklets:
        livrets_dir.mkdir(exist_ok=True)
        for _, path, _ in booklets:
            if path.exists():
                if candidat_nom is not None and path.name == "DOSSIER_D_ENTREE_NEXUS.pdf":
                    # Le dossier d'entrée nominatif se recompose depuis la source du
                    # formulaire : il rappelle la situation connue au lieu de la redemander.
                    LI.formulaire_entree(profil, livrets_dir / path.name,
                                         situation=situation_connue(qp, candidat_nom))
                elif candidat_nom is not None:
                    _personalize_booklet(path, livrets_dir / path.name, candidat_nom,
                                         qp["reponses"]["session_baccalaureat_finale"])
                else:
                    shutil.copy2(path, livrets_dir / path.name)

    # Gestion idempotente du pack d'impression dans OPTION_IMPRESSION
    pack_option_impression = option_impression_dir / "PACK_IMPRESSION_CANDIDAT.pdf"
    assembled_pdf = None
    if assemble_pdf:
        option_impression_dir.mkdir(parents=True, exist_ok=True)
        try:
            import pypdf
            writer = pypdf.PdfWriter()
            # Assemblage exclusif des livrets candidats
            for label, path, _ in booklets:
                source_pdf = (livrets_dir / path.name) if (livrets_dir / path.name).exists() else path
                if not source_pdf.exists():
                    continue
                reader = pypdf.PdfReader(str(source_pdf))
                writer.add_outline_item(label, len(writer.pages))
                for page in reader.pages:
                    writer.add_page(page)
            with open(pack_option_impression, "wb") as f_out:
                writer.write(f_out)
            assembled_pdf = pack_option_impression
        except Exception as err:
            if candidat_nom is not None:
                raise
            assembled_pdf = None
            print(f"Warning: could not assemble single PDF: {err}", file=sys.stderr)
    else:
        # Si assemble_pdf est False, aucun pack d'impression résiduel ne doit subsister
        if pack_option_impression.exists():
            pack_option_impression.unlink()
        if option_impression_dir.exists() and not any(option_impression_dir.iterdir()):
            option_impression_dir.rmdir()

    # Le dossier d'entrée est un seul livret : sa durée est celle que sa couverture
    # annonce, recalculée dans un export nominatif. Le total est la somme des lignes.
    duree_dossier = LI.duree_dossier_entree(
        situation_connue(qp, candidat_nom) if candidat_nom is not None else None)
    lignes_famille = lignes_diagnostics_famille(effective, cat, duree_dossier)
    total_duration_min = sum(minutes for _, minutes in lignes_famille)

    effective_eaf = qp["reponses"]["eaf_due"]
    philosophie_due = qp["reponses"]["philosophie_due"]
    actual_spes_1re = qp["reponses"]["specialites_suivies_premiere"]
    actual_spe_abandon = qp["reponses"]["specialite_non_poursuivie"]
    actual_spes_tle = qp["reponses"]["specialites_terminales"]

    # 1. Bordereau d'envoi famille (A_ENVOYER/BORDEREAU_ENVOI.txt)
    identite_famille = (f"Candidate : {candidat_nom}\n"
                       f"Session : {qp['reponses']['session_baccalaureat_finale']}\n\n"
                       if candidat_nom is not None else "")
    bordereau_famille = f"""================================================================================
                    BORDEREAU D'EXPÉDITION CANDIDAT — NEXUS V2
================================================================================

{identite_famille}RÉFÉRENCE DOSSIER     : {cid}
DATE D'ÉMISSION       : {datetime.datetime.now().strftime("%d/%m/%Y %H:%M")}
PROFIL RÉGLEMENTAIRE  : {profil} — {LIBELLE_PROFIL.get(profil, profil)}
MODE ÉVALUATIONS CC   : {mode_ep.upper()} ({'Contrôle annuel par épreuves ponctuelles' if mode_ep == 'annuelle' else 'Report et passation globale en fin de cycle'})
SESSION FINALE VISÉE  : {qp['reponses']['session_baccalaureat_finale']}

--------------------------------------------------------------------------------
1. SITUATION PÉDAGOGIQUE ET ENSEIGNEMENTS DÉCLARÉS
--------------------------------------------------------------------------------
Spécialités de 1re   : {', '.join(actual_spes_1re) if actual_spes_1re else 'Non renseigné'}
Spécialité non poursuivie : {actual_spe_abandon if MD.est_specialite_connue(actual_spe_abandon) else 'Non déterminée (les 3 spécialités restent en diagnostic)'}
Spécialités de Tle   : {', '.join(actual_spes_tle) if actual_spes_tle else 'Non renseigné'}
Philosophie          : {'OBLIGATOIRE CETTE SESSION' if philosophie_due else 'NON CONCERNÉ (classe de Première)'}
Épreuves EAF dues    : {effective_eaf.upper()} ({'Non requises (déjà présentées en 1re)' if effective_eaf == 'none' else 'À présenter cette session'})
Maths anticipées dues: {'OUI' if math_ea_due or profil in ('P1', 'P3') else 'NON (déjà validées ou conservées)'}

--------------------------------------------------------------------------------
2. ÉPREUVES / ÉVALUATIONS OFFICIELLES CONCERNÉES (CETTE SESSION)
--------------------------------------------------------------------------------
"""
    if dues:
        codes_dues = [c for c, _ in dues]
        for code, ver in dues:
            if code == "FR-EAF":
                if "oral" in ver:
                    if "FR-EAF-ORAL" not in codes_dues:
                        bordereau_famille += "  - Français oral (épreuve anticipée du baccalauréat)\n"
                elif "ecrit" in ver:
                    bordereau_famille += "  - Français écrit (épreuve anticipée du baccalauréat)\n"
                else:
                    bordereau_famille += "  - Français écrit (épreuve anticipée du baccalauréat)\n"
                    if "FR-EAF-ORAL" not in codes_dues:
                        bordereau_famille += "  - Français oral (épreuve anticipée du baccalauréat)\n"
            elif code == "FR-EAF-ORAL":
                bordereau_famille += "  - Français oral (épreuve anticipée du baccalauréat)\n"
            elif code == "MATH-EA":
                bordereau_famille += "  - Mathématiques (épreuve anticipée du baccalauréat)\n"
            elif code in ("TC-HG", "TC-EMC", "TC-ES"):
                nom = NOMS_MATIERES_FAMILLE.get(code, code)
                bordereau_famille += f"  - {nom} (évaluation ponctuelle de contrôle continu)\n"
            elif code == "PHI":
                bordereau_famille += "  - Philosophie (épreuve terminale obligatoire)\n"
            elif code == "GO":
                bordereau_famille += "  - Grand oral (épreuve terminale obligatoire)\n"
            elif code.startswith("EDS-"):
                nom = NOMS_MATIERES_FAMILLE.get(code, code)
                if ver == "N1":
                    bordereau_famille += f"  - {nom} (évaluation ponctuelle de contrôle continu — spécialité non poursuivie en Terminale)\n"
                elif ver == "NT":
                    bordereau_famille += f"  - {nom} (épreuve terminale de spécialité)\n"
                else:
                    bordereau_famille += f"  - {nom} (enseignement de spécialité)\n"
    else:
        bordereau_famille += "  (Aucune épreuve ponctuelle d'examen due cette année)\n"

    if profil == "P1" and mode_ep == "annuelle" and not MD.est_specialite_connue(actual_spe_abandon):
        bordereau_famille += "  (Spécialité non poursuivie non encore déterminée : aucun enseignement de spécialité n'est classé en épreuve officielle ; les 3 spécialités suivies font l'objet d'un diagnostic Nexus d'accompagnement)\n"

    bordereau_famille += f"""
--------------------------------------------------------------------------------
3. ÉVALUATIONS OFFICIELLES REPORTÉES EN FIN DE CYCLE (TERMINALE)
--------------------------------------------------------------------------------
"""
    if reportees:
        for c, v, lib in reportees:
            nom = NOMS_MATIERES_FAMILLE.get(c, lib)
            if c.startswith("EDS-"):
                bordereau_famille += f"  * {nom} (évaluation ponctuelle de Première reportée en fin de cycle)\n"
            else:
                bordereau_famille += f"  * {nom} (évaluation ponctuelle reportée en fin de cycle)\n"
    else:
        bordereau_famille += "  (Aucune évaluation officielle reportée — toutes les obligations exigibles sont présentées cette session)\n"

    bordereau_famille += f"""
--------------------------------------------------------------------------------
4. TESTS DIAGNOSTIQUES NEXUS À RÉALISER
--------------------------------------------------------------------------------
AVERTISSEMENT :
« Durée du diagnostic Nexus — différente de la durée réglementaire de l’épreuve officielle. »
Les tests ci-dessous sont des outils pédagogiques internes de positionnement.
Ils permettent d'évaluer vos acquis actuels et d'adapter votre parcours de travail.
"""
    if lignes_famille:
        for libelle, minutes in lignes_famille:
            bordereau_famille += f"  * {libelle} ({minutes} min)\n"
    else:
        bordereau_famille += "  (Aucun diagnostic d'accompagnement programmé)\n"

    bordereau_famille += f"""
--------------------------------------------------------------------------------
5. DOCUMENTS REMIS AU CANDIDAT ET À LA FAMILLE
--------------------------------------------------------------------------------
Nombre de livrets joints: {len(booklets)}
Temps total diagnostique estimé : {total_duration_min} min (soit {total_duration_min // 60} h {total_duration_min % 60:02d} min)

Livrets inclus dans le pack d'envoi :
"""
    for label, path, detail in booklets:
        bordereau_famille += f"  * Livret candidat : {label:<24} ({detail})\n"

    transmission = ("Ce pack nominatif est destiné au candidat et à sa famille."
                    if candidat_nom is not None else
                    "Ce pack est strictement anonymisé/pseudonymisé (conforme RGPD).")
    bordereau_famille += f"""
CONSIGNES DE TRANSMISSION :
- {transmission}
- Les livrets doivent être imprimés à 100% sans mise à l'échelle (format A4).
- Seul le dossier d'entrée et les livrets candidats sont remis à la famille.
- Le corrigé et les grilles d'évaluation restent sous la responsabilité exclusive
  de l'équipe pédagogique et du coach ; ils ne sont jamais remis au candidat.
================================================================================
"""
    # Guard 4: Lexical gate verification on family document
    verifier_gate_lexical_bordereau_famille(bordereau_famille)
    (a_envoyer_dir / "BORDEREAU_ENVOI.txt").write_text(bordereau_famille, encoding="utf-8")

    # 2. Bordereau opérateur interne (_INTERNE_NEXUS/BORDEREAU_OPERATEUR_INTERNE.txt)
    bordereau_interne = f"""================================================================================
         BORDEREAU OPÉRATEUR INTERNE — NEXUS V2 (CONFIDENTIEL COACH)
                         NE PAS TRANSMETTRE AU CANDIDAT
================================================================================

RÉFÉRENCE DOSSIER     : {cid}
DATE D'ÉMISSION       : {datetime.datetime.now().strftime("%d/%m/%Y %H:%M")}
PROFIL RÉGLEMENTAIRE  : {profil} — {LIBELLE_PROFIL.get(profil, profil)}
MODE ÉVALUATIONS CC   : {mode_ep.upper()} ({'Contrôle annuel par épreuves ponctuelles' if mode_ep == 'annuelle' else 'Report et passation globale en fin de cycle'})
SESSION FINALE VISÉE  : {qp['reponses']['session_baccalaureat_finale']}

--------------------------------------------------------------------------------
1. SITUATION DÉTAILLÉE DU CANDIDAT & ENSEIGNEMENTS
--------------------------------------------------------------------------------
Spécialités de 1re        : {', '.join(actual_spes_1re) if actual_spes_1re else 'Non renseigné'}
Spécialité non poursuivie : {actual_spe_abandon if MD.est_specialite_connue(actual_spe_abandon) else 'Non déterminée'}
Spécialités de Tle        : {', '.join(actual_spes_tle) if actual_spes_tle else 'Non renseigné'}
Philosophie               : {'OBLIGATOIRE CETTE SESSION' if philosophie_due else 'NON CONCERNÉ'}
Épreuves EAF dues         : {effective_eaf.upper()}
Maths anticipées dues     : {'OUI' if math_ea_due or profil in ('P1', 'P3') else 'NON'}
FR-POS requis             : {'OUI' if qp['reponses']['fr_pos_requis'] else 'NON'}
FR-MAI requis             : {'OUI' if qp['reponses']['fr_mai_requis'] else 'NON'}

--------------------------------------------------------------------------------
2. ÉPREUVES OFFICIELLES DU BACCALAURÉAT DUES CETTE SESSION
--------------------------------------------------------------------------------
"""
    if dues:
        for code, ver in dues:
            inst = next((it for it in cat["instruments"] if it["code"] == code and it["version"] == ver), None)
            duree_txt = f"{LI.duree_livret_candidat(code, inst['duree_cible_min'])} min" if inst else "durée n.c."
            titre = (inst.get("libelle") or inst.get("nom") or code) if inst else code
            if code == "GO":
                titre = f"Grand oral — livret complet, entretien de {inst['duree_cible_min']} min inclus"
            remarque = " [Épreuve ponctuelle spéciale]" if ver == "N1" and code.startswith("EDS-") else ""
            bordereau_interne += f"  - [{code}/{ver}] {titre} (durée cible diagnostic: {duree_txt}){remarque}\n"
    else:
        bordereau_interne += "  (Aucune épreuve ponctuelle d'examen due cette session)\n"

    bordereau_interne += f"""
--------------------------------------------------------------------------------
3. ÉVALUATIONS REPORTÉES EN FIN DE CYCLE
--------------------------------------------------------------------------------
"""
    if reportees:
        for c, v, lib in reportees:
            bordereau_interne += f"  * [{c}/{v}] {lib} (évaluation ponctuelle reportée en fin de cycle)\n"
    else:
        bordereau_interne += "  (Aucune évaluation reportée)\n"

    bordereau_interne += f"""
--------------------------------------------------------------------------------
4. SÉLECTION COMPLÈTE DES DIAGNOSTICS NEXUS
--------------------------------------------------------------------------------
"""
    for code, ver in effective:
        inst = next((it for it in cat["instruments"] if it["code"] == code and it["version"] == ver), None)
        duree_txt = f"{LI.duree_livret_candidat(code, inst['duree_cible_min'])} min" if inst else "durée n.c."
        titre = (inst.get("libelle") or inst.get("nom") or code) if inst else code
        if code == "GO":
            titre = f"Grand oral — livret complet, entretien de {inst['duree_cible_min']} min inclus"
        statut = "OBLIGATION OFFICIELLE" if (code, ver) in dues else "DIAGNOSTIC D'ACCOMPAGNEMENT"
        bordereau_interne += f"  * [{code}/{ver}] {titre} ({duree_txt}) — {statut}\n"

    bordereau_interne += f"""
--------------------------------------------------------------------------------
5. TRAÇABILITÉ DES LIVRETS CANDIDATS & FICHIERS CANONIQUES DU COACH
--------------------------------------------------------------------------------
RAPPEL : Le coach retrouve les corrigés et grilles dans l'arborescence
canonique release/diagnostics-v2/02_CORRECTIONS_COACH/
(NE JAMAIS TRANSMETTRE CES CORRECTIONS AU CANDIDAT OU À LA FAMILLE)

"""
    coach_base = RACINE / "release" / "diagnostics-v2" / "02_CORRECTIONS_COACH" / DOSSIER_PROFIL[profil]
    for label, path, detail in booklets:
        corr_path = find_booklet(coach_base, path.name)
        corr_rel = corr_path.relative_to(RACINE) if (corr_path and corr_path.exists()) else "Consulter dossier coach profil"
        candidat_rel = path.relative_to(RACINE) if RACINE in path.parents else path.name
        bordereau_interne += f"  * {label:<26} :\n"
        bordereau_interne += f"      Livret candidat  : {path.name} ({candidat_rel})\n"
        bordereau_interne += f"      Correction coach : {corr_rel}\n"

    bordereau_interne += f"""================================================================================
"""
    (interne_dir / "BORDEREAU_OPERATEUR_INTERNE.txt").write_text(bordereau_interne, encoding="utf-8")

    return booklets


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Nexus candidate pack generator")
    parser.add_argument("--profil", "-p", choices=["P1", "P2", "P3"], required=True,
                        help="Regulatory profile (P1: 1re, P2: Tle, P3: Bac 1 session)")
    parser.add_argument("--mode-ep", choices=["annuelle", "fin_cycle"], default=None,
                        help="Mode for punctual evaluations (default: annuelle for P1/P2, fin_cycle for P3)")
    parser.add_argument("--spes-1re", nargs="+", choices=SPECIALITES_VALIDES, default=["MATH", "PC", "NSI"],
                        help="Specialities in Première (3 required for P1/P3)")
    parser.add_argument("--spe-abandonnee", choices=SPECIALITES_VALIDES + ("aucune",), default="NSI",
                        help="Speciality dropped after Première")
    parser.add_argument("--spes-tle", nargs="+", choices=SPECIALITES_VALIDES, default=None,
                        help="Specialities in Terminale (2 required for P2)")
    parser.add_argument("--eaf-due", choices=["none", "ecrit", "oral", "les_deux"], default=None,
                        help="French anticipation exams due (default: none for P2, les_deux for P1/P3)")
    parser.add_argument("--math-ea-due", action="store_true", default=False,
                        help="Set if MATH-EA is due in P2")
    parser.add_argument("--fr-pos", action="store_true", default=False,
                        help="Include FR-POS linguistic positioning diagnostic")
    parser.add_argument("--fr-mai", action="store_true", default=False,
                        help="Include FR-MAI diagnostic in P2/P3")
    parser.add_argument("--sans-diagnostic-utile", action="store_true", default=False,
                        help="Exclude diagnostic-only booklets in fin_cycle mode")
    parser.add_argument("--candidat-id", type=str, default=None,
                        help="Pseudonym identifier for candidate")
    parser.add_argument("--candidat-nom", type=str, default=None,
                        help="Candidate name, only written to exports_candidats/ (requires PyMuPDF and Lato)")
    parser.add_argument("--output", "-o", type=Path, default=None,
                        help="Target export directory")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    mode_ep = args.mode_ep
    if mode_ep is None:
        mode_ep = "fin_cycle" if args.profil == "P3" else "annuelle"

    spes_1re = list(args.spes_1re)
    abandonnee = args.spe_abandonnee
    spes_tle = list(args.spes_tle) if args.spes_tle else [s for s in spes_1re if s != abandonnee][:2]

    out = create_candidate_pack(
        profil=args.profil,
        mode_ep=mode_ep,
        spes_premiere=spes_1re,
        spe_non_poursuivie=abandonnee,
        spes_terminales=spes_tle,
        eaf_due=args.eaf_due,
        math_ea_due=args.math_ea_due,
        fr_pos_requis=args.fr_pos,
        fr_mai_requis=args.fr_mai,
        diagnostic_nexus_utile=not args.sans_diagnostic_utile,
        candidat_id=args.candidat_id,
        candidat_nom=args.candidat_nom,
        output_dir=args.output,
    )
    print(f"Candidate pack created successfully at: {out}")
    print(f"Family send folder: {out / 'A_ENVOYER'}")
    print(f"Family manifest: {out / 'A_ENVOYER' / 'BORDEREAU_ENVOI.txt'}")
    if (out / "OPTION_IMPRESSION" / "PACK_IMPRESSION_CANDIDAT.pdf").exists():
        print(f"Print option booklet: {out / 'OPTION_IMPRESSION' / 'PACK_IMPRESSION_CANDIDAT.pdf'}")
    print(f"Internal operator manifest: {out / '_INTERNE_NEXUS' / 'BORDEREAU_OPERATEUR_INTERNE.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
