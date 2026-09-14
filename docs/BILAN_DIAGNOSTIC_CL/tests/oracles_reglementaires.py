"""Independent regulatory oracles for candidate state space and examinations.

These oracles are manually tied to official legal sources:
- MENE2515469N (Définition de l'épreuve anticipée de mathématiques)
- Arrêté du 16 juillet 2018 modifié (Régime des épreuves anticipées, art. 1, 2, 3, 4, 5)
- Arrêté du 10 juin 2025 (Décret et arrêté épreuve anticipée mathématiques, art. 17 dispenses)
- Note de service du 25 août 2025, NOR MENE2523745N (Situations particulières d'inscription)
- Code de l'éducation, art. D334-13 et D336-13 (Conservation des notes après échec)
"""
from __future__ import annotations

#: 1. MATH-EA Path Oracle (MENE2515469N)
#: Le candidat compose sur le programme de mathématiques de Première préparé conformément à l'inscription.
#: - Spécialité suivie en Première -> SPE
#: - Spécialité non suivie en Première -> SPECIFIQUES
MATH_EA_PATH_ORACLE = [
    {
        "description": "Première MATH PC NSI -> Terminale PC NSI (abandon MATH)",
        "facts": {
            "spes_premiere": ["MATH", "PC", "NSI"],
            "spes_terminales": ["PC", "NSI"],
            "spe_non_poursuivie": "MATH",
        },
        "expected": "SPE",
        "source": "MENE2515469N",
    },
    {
        "description": "Première PC NSI SVT -> Terminale PC NSI (sans spécialité MATH en Première)",
        "facts": {
            "spes_premiere": ["PC", "NSI", "SVT"],
            "spes_terminales": ["PC", "NSI"],
            "spe_non_poursuivie": "SVT",
        },
        "expected": "SPECIFIQUES",
        "source": "MENE2515469N",
    },
    {
        "description": "Première MATH SVT SES -> Terminale MATH SVT (MATH poursuivie)",
        "facts": {
            "spes_premiere": ["MATH", "SVT", "SES"],
            "spes_terminales": ["MATH", "SVT"],
            "spe_non_poursuivie": "SES",
        },
        "expected": "SPE",
        "source": "MENE2515469N",
    },
    {
        "description": "Première HGGSP SES HLP -> Terminale HGGSP SES (sans spécialité MATH)",
        "facts": {
            "spes_premiere": ["HGGSP", "SES", "HLP"],
            "spes_terminales": ["HGGSP", "SES"],
            "spe_non_poursuivie": "HLP",
        },
        "expected": "SPECIFIQUES",
        "source": "MENE2515469N",
    },
]


def oracle_math_ea_path(spes_premiere: list[str] | tuple[str, ...]) -> str:
    """Independent oracle resolving MATH-EA path from Première specialities."""
    return "SPE" if "MATH" in spes_premiere else "SPECIFIQUES"


#: 2. Temporal Context Oracle (Arrêté du 16 juillet 2018, art. 1 et 3)
TEMPORAL_CONTEXT_ORACLE = [
    {
        "description": "P1 anticipation normale pour session 2028 passée en 2026-2027",
        "facts": {
            "profil": "P1",
            "session_baccalaureat_finale": 2028,
            "annee_scolaire_passation_ea": "2026-2027",
            "mode_passation_ea": "anticipation",
        },
        "expected_coherent": True,
        "source": "Arrêté du 16 juillet 2018, art. 1",
    },
    {
        "description": "P2 standard : passation EA en Première 2025-2026 par anticipation pour session 2027",
        "facts": {
            "profil": "P2",
            "session_baccalaureat_finale": 2027,
            "annee_scolaire_passation_ea": "2025-2026",
            "mode_passation_ea": "anticipation",
        },
        "expected_coherent": True,
        "source": "Arrêté du 16 juillet 2018, art. 1",
    },
    {
        "description": "P2 avec EA due en Terminale 2026-2027 pour la même session finale 2027",
        "facts": {
            "profil": "P2",
            "session_baccalaureat_finale": 2027,
            "annee_scolaire_passation_ea": "2026-2027",
            "mode_passation_ea": "meme_session",
        },
        "expected_coherent": True,
        "source": "Arrêté du 16 juillet 2018, art. 3",
    },
    {
        "description": "P3 baccalauréat en une session : EA et terminales en 2026-2027 pour session 2027",
        "facts": {
            "profil": "P3",
            "session_baccalaureat_finale": 2027,
            "annee_scolaire_passation_ea": "2026-2027",
            "mode_passation_ea": "meme_session",
        },
        "expected_coherent": True,
        "source": "Arrêté du 16 juillet 2018, art. 3",
    },
    {
        "description": "Incohérent : passation EA déclarée en anticipation en 2026-2027 pour session 2027",
        "facts": {
            "profil": "P2",
            "session_baccalaureat_finale": 2027,
            "annee_scolaire_passation_ea": "2026-2027",
            "mode_passation_ea": "anticipation",
        },
        "expected_coherent": False,
        "source": "Incohérence temporelle : session_attendue = 2028 != 2027",
    },
]


#: 3. Same-Session Eligibility Oracle (Article 3 de l'arrêté du 16 juillet 2018)
#: Toutes les catégories de l'Article 3, sous la condition préalable de non-passation l'année précédente.
ARTICLE3_CRITERIA_ORACLE = [
    {
        "code": "AGE-20",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 4° a",
        "facts": {"age_au_31_decembre_annee_examen": 20},
        "piece": "piece_identite",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "ENFANT",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 4° e",
        "facts": {"enfant_a_charge": "oui"},
        "piece": "justificatif_charge_enfant",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "RETOUR",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 2°",
        "facts": {"retour_formation_initiale": "oui"},
        "piece": "attestation_formation",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "FORCE-MAJEURE",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 3°",
        "facts": {"force_majeure_constatee": "oui"},
        "piece": None,
        "expected_eligibility": "conditionnelle",
        "expected_profile_gate": "P3_EN_ATTENTE_DE_VERIFICATION",
    },
    {
        "code": "ETRANGER-TEMPORAIRE",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 4° b",
        "facts": {"residence_etranger": "temporaire_en_premiere"},
        "piece": "justificatif_residence",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "ETRANGER-PERMANENT-SANS-CENTRE",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 4° c",
        "facts": {"residence_etranger": "permanente", "centre_examen_dans_le_pays": "non"},
        "piece": None,
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_EN_ATTENTE_DE_VERIFICATION",
    },
    {
        "code": "ETRANGER-PERMANENT-CENTRE-ELOIGNE",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 4° c",
        "facts": {"residence_etranger": "permanente", "centre_examen_dans_le_pays": "oui", "centre_examen_eloigne": "oui"},
        "piece": None,
        "expected_eligibility": "conditionnelle",
        "expected_profile_gate": "P3_EN_ATTENTE_DE_VERIFICATION",
    },
    {
        "code": "ECHEC-ANTERIEUR",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 5°",
        "facts": {"echec_anterieur_baccalaureat": "oui"},
        "piece": "releve_notes_anterieur",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "EA-SANS-INSCRIPTION-SUIVANTE",
        "fondement": "arrêté du 16 juillet 2018, art. 3, premier alinéa",
        "facts": {"ea_presentees_puis_absence_inscription": "oui"},
        "piece": "releve_notes_anterieur",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "TITULAIRE-DIPLOME-FR",
        "fondement": "arrêté du 16 juillet 2018, art. 3",
        "facts": {"diplome_francais_detenu": "bac_professionnel"},
        "piece": "diplome",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
    {
        "code": "TITULAIRE-DIPLOME-ETRANGER",
        "fondement": "arrêté du 16 juillet 2018, art. 3",
        "facts": {"diplome_etranger_comparable": "oui"},
        "piece": None,
        "expected_eligibility": "conditionnelle",
        "expected_profile_gate": "P3_EN_ATTENTE_DE_VERIFICATION",
    },
    {
        "code": "CHANGEMENT-VOIE-TERMINALE",
        "fondement": "arrêté du 16 juillet 2018, art. 3, 4° h",
        "facts": {"changement_voie_ou_serie": "oui"},
        "piece": "attestation_scolarite",
        "expected_eligibility": "oui",
        "expected_profile_gate": "P3_OUVERT",
    },
]


#: 4. MATH-EA Transitional Exemption Oracle (Arrêté du 10 juin 2025, article 17)
#: Pour la session 2027 : échec antérieur à la session 2026 dispense obligatoirement de MATH-EA.
MATH_EA_TRANSITIONAL_EXEMPTION_ORACLE = [
    {
        "description": "Session finale 2027 + échec bac 2026 -> MATH-EA dispensée (DISP-ECHEC-2026)",
        "facts": {
            "session_baccalaureat_finale": 2027,
            "dispense_transitoire": "DISP-ECHEC-2026",
            "examens_anterieurs": "presente_sans_succes",
        },
        "math_ea_eligible": False,
        "fondement": "arrêté du 10 juin 2025, article 17",
    },
    {
        "description": "Session finale 2027 + force majeure 2026 -> MATH-EA dispensée (DISP-FORCE-MAJEURE-2026)",
        "facts": {
            "session_baccalaureat_finale": 2027,
            "dispense_transitoire": "DISP-FORCE-MAJEURE-2026",
        },
        "math_ea_eligible": False,
        "fondement": "arrêté du 10 juin 2025, article 17",
    },
]


def check_temporal_context(facts: dict) -> bool:
    """Verifies that final session matches expected session according to passation year and mode."""
    finale = int(facts["session_baccalaureat_finale"])
    annee = facts["annee_scolaire_passation_ea"]
    fin_annee = int(annee.split("-")[1])
    attendu = fin_annee + (1 if facts["mode_passation_ea"] == "anticipation" else 0)
    return finale == attendu


def check_math_ea_path(facts: dict, version: str | None) -> bool:
    """Verifies that MATH-EA version matches Première specialities."""
    if not facts.get("math_ea_due"):
        return version is None
    spes_1re = facts.get("specialites_suivies_premiere") or facts.get("specialites", [])
    expected = "SPE" if "MATH" in spes_1re else "SPECIFIQUES"
    return version == expected


def check_math_ea_transitional_exemption(facts: dict) -> bool:
    """Verifies that candidate with past failure or retake_after_failure does not take MATH-EA."""
    if facts.get("math_ea_due") and (facts.get("same_session_basis") == "retake_after_failure" or facts.get("echec_anterieur_baccalaureat") == "oui"):
        return False
    return True


def check_article3_eligibility(facts: dict) -> bool:
    """Verifies that P3 candidate has a verified Article 3 condition opening P3."""
    import eligibilite as EL
    st = EL.statut_profil(facts)
    return bool(st.get("ouvert") and st.get("statut") == EL.P3_OUVERT)

