#!/usr/bin/env python3
"""Les faits d'un candidat : une seule construction, un seul domaine, un seul espace.

Tout ce qui dérive une situation candidate — obligations réglementaires, diagnostics,
livrets, bordereaux, matrices d'audit, banc de distribution — part de `build_candidate_facts`.
Aucune règle FR-POS, FR-MAI, EAF, MATH-EA, spécialités ou mode d'évaluations ponctuelles
ne vit ailleurs : `distribution.profil_reel` n'est qu'un adaptateur d'arguments.

Le domaine des faits est verrouillé ici, et refusé plutôt qu'ignoré :

- P1 : trois spécialités distinctes de Première ; Terminale non déterminée, ou deux
  spécialités incluses dans les trois, la non-poursuivie étant la différence exacte ;
  mode annuelle ou fin_cycle ; épreuves anticipées de français toutes deux à présenter.
- P2 : trois spécialités de Première, deux de Terminale incluses, différence exactement
  une, qui est la non-poursuivie ; mode annuelle ou fin_cycle ; EAF none, ecrit, oral ou
  les_deux ; mathématiques anticipées exceptionnellement dues ou non ; FR-POS et FR-MAI
  sur demande.
- P3 : même structure de spécialités ; mode réglementaire fin_cycle, une valeur annuelle
  est refusée ; épreuves anticipées de français toutes deux à présenter ; FR-POS et
  FR-MAI sur demande.

`candidate_state_space()` parcourt toutes les combinaisons valides de ce domaine, sans
liste écrite à la main : les spécialités, profils, modes, statuts EAF et options viennent
des constantes ci-dessus, et le nombre d'états est dérivé, jamais fixé.
"""
from __future__ import annotations

import hashlib
import itertools
import os
from typing import Any

PROFILS = ("P1", "P2", "P3")
MODES_EP = ("annuelle", "fin_cycle")
SPECIALITES_VALIDES = ("MATH", "PC", "NSI", "SVT", "SES", "HGGSP", "HLP")
#: Statuts admis pour les épreuves anticipées de français. P1 et P3 les présentent toutes
#: deux (première présentation) ; seul un P2 peut n'en devoir aucune, ou une seule.
EAF_ADMIS = {"P1": ("les_deux",), "P2": ("none", "ecrit", "oral", "les_deux"), "P3": ("les_deux",)}
EAF_PAR_DEFAUT = {"P1": "les_deux", "P2": "none", "P3": "les_deux"}
#: Le diagnostic de maîtrise du français ne s'adresse qu'aux candidats de la partie
#: terminale ; le mode fin_cycle est le seul mode réglementaire d'un bac en une session.
FR_MAI_PROFILS = ("P2", "P3")
MODE_PAR_DEFAUT = {"P1": "annuelle", "P2": "annuelle", "P3": "fin_cycle"}
#: Les mathématiques anticipées sont toujours dues en P1 et en P3 ; en P2 elles ne le
#: sont qu'exceptionnellement, et le fait le dit.
MATH_EA_OPTIONNEL_PROFILS = ("P2",)
SAME_SESSION_BASES = (None, "retake_after_failure", "same_session_article3")

INCONNUE = "inconnue"
VALEURS_INCONNUES = {"", "aucune", "inconnue", "unknown", "non_renseignee", "non_renseigne", "none"}


def _normaliser_spe(spe: str | None) -> str | None:
    if spe is None:
        return None
    s = str(spe).strip().upper()
    return s or None


def _est_inconnue(spe: str | None) -> bool:
    return spe is None or str(spe).strip().lower() in VALEURS_INCONNUES


def _valider_specialites(valeurs, ou: str, attendu: int | None) -> list[str]:
    norm = [_normaliser_spe(s) for s in (valeurs or [])]
    norm = [s for s in norm if s]
    if len(norm) != len(set(norm)):
        raise ValueError(f"Spécialités de {ou} en double : {norm}")
    for s in norm:
        if s not in SPECIALITES_VALIDES:
            raise ValueError(f"Spécialité invalide en {ou} : {s}")
    if attendu is not None and len(norm) != attendu:
        raise ValueError(f"Nombre de spécialités de {ou} invalide : attendu {attendu}, reçu {len(norm)} ({norm})")
    return norm


def build_candidate_facts(
    profil: str,
    mode_ep: str | None = None,
    spes_premiere: list[str] | tuple[str, ...] = (),
    spe_non_poursuivie: str | None = None,
    spes_terminales: list[str] | None = None,
    eaf_due: str | None = None,
    math_ea_due: bool = False,
    fr_pos_requis: bool = False,
    fr_mai_requis: bool = False,
    diagnostic_nexus_utile: bool = True,
    same_session_basis: str | None = None,
    candidat_id: str | None = None,
    config_francais: str | None = None,
    **kwargs,
) -> dict[str, Any]:
    """Construit les faits d'un candidat, et refuse tout ce qui sort du domaine."""
    if profil not in PROFILS:
        raise ValueError(f"Profil inconnu : {profil!r} (attendu {', '.join(PROFILS)})")
    cid = candidat_id or f"CAND-{hashlib.sha256(os.urandom(16)).hexdigest()[:8].upper()}"

    if same_session_basis not in SAME_SESSION_BASES:
        raise ValueError(f"Motif de passage en même session inconnu : {same_session_basis!r}")

    # Mode des évaluations ponctuelles : un bac en une session ne connaît que la fin de cycle.
    mode = mode_ep or MODE_PAR_DEFAUT[profil]
    if mode not in MODES_EP:
        raise ValueError(f"Mode d'évaluations ponctuelles inconnu : {mode!r} (attendu {', '.join(MODES_EP)})")
    if profil == "P3" and mode != "fin_cycle":
        raise ValueError("Profil P3 invalide : le mode réglementaire d'un baccalauréat en une session est fin_cycle")

    # Épreuves anticipées de français : none, ecrit, oral ou les_deux, selon le profil.
    if eaf_due is None:
        if config_francais is not None:
            effective_eaf = "none" if config_francais == "aucune" else config_francais
        else:
            effective_eaf = EAF_PAR_DEFAUT[profil]
    else:
        effective_eaf = "none" if eaf_due == "aucune" else eaf_due
    if effective_eaf not in EAF_ADMIS[profil]:
        raise ValueError(f"Statut EAF {effective_eaf!r} inadmissible pour le profil {profil} "
                         f"(admis : {', '.join(EAF_ADMIS[profil])})")

    # Diagnostics de français : optionnels, à la demande, et FR-MAI réservé à la partie terminale.
    effective_fr_pos = bool(fr_pos_requis)
    if fr_mai_requis and profil not in FR_MAI_PROFILS:
        raise ValueError(f"FR-MAI n'est pas admis pour le profil {profil} (profils admis : {', '.join(FR_MAI_PROFILS)})")
    effective_fr_mai = bool(fr_mai_requis)

    # Incompatibilité explicite : diagnostic_nexus_utile=False interdit fr_pos ou fr_mai
    if not diagnostic_nexus_utile:
        if effective_fr_pos or effective_fr_mai:
            raise ValueError(
                "Contradiction: diagnostic_nexus_utile=False cannot be combined with explicit "
                "fr_pos_requis=True or fr_mai_requis=True."
            )

    # Spécialités : trois en Première, toujours.
    spes_1re = _valider_specialites(spes_premiere, "Première", 3)
    abandon = None if _est_inconnue(spe_non_poursuivie) else _normaliser_spe(spe_non_poursuivie)
    if abandon is not None and abandon not in SPECIALITES_VALIDES:
        raise ValueError(f"Spécialité non poursuivie invalide : {abandon}")
    if abandon is not None and abandon not in spes_1re:
        raise ValueError(f"Spécialité non poursuivie '{abandon}' non présente dans les spécialités de Première ({spes_1re})")

    spes_tle = _valider_specialites(spes_terminales, "Terminale", None) if spes_terminales else []
    if spes_tle:
        if len(spes_tle) != 2:
            raise ValueError(f"Nombre de spécialités terminales invalide : attendu 2, reçu {len(spes_tle)} ({spes_tle})")
        if not set(spes_tle) <= set(spes_1re):
            raise ValueError(f"Spécialités de Terminale ({spes_tle}) non incluses dans les spécialités de Première ({spes_1re})")
        deduite = next(s for s in spes_1re if s not in spes_tle)
        if spe_non_poursuivie is not None and abandon is None:
            raise ValueError("Incohérence des spécialités : la spécialité non poursuivie ne peut pas être "
                             f"inconnue lorsque l'orientation Terminale est connue ({spes_tle})")
        if abandon is not None and abandon != deduite:
            raise ValueError(f"Incohérence des spécialités : spécialité fournie '{abandon}' ≠ différence 1re - Tle '{deduite}'")
        abandon = deduite
    elif abandon is not None:
        spes_tle = [s for s in spes_1re if s != abandon]
    elif profil != "P1":
        raise ValueError(f"Profil {profil} invalide : deux spécialités terminales distinctes sont obligatoires "
                         "(orientation de Terminale non déterminée)")

    # Mathématiques anticipées : dues en P1 et P3 par construction ; exceptionnelles en P2.
    math_due = bool(math_ea_due) if profil in MATH_EA_OPTIONNEL_PROFILS else True

    # Dispense transitoire de l'article 17 : échec antérieur à la session 2026 dispense de MATH-EA en 2027
    if math_due:
        if same_session_basis == "retake_after_failure" or kwargs.get("echec_anterieur_baccalaureat") == "oui":
            raise ValueError(
                "Transitional exemption violation: candidate repeating after failure in 2026 "
                "is exempt from MATH-EA in session 2027 (Art. 17)."
            )

    # Dérivation des axes temporels et des motifs de même session
    if profil == "P1":
        effective_basis = None
        annee_ea = "2026-2027"
        mode_ea = "anticipation"
        fr_eaf_status = "due"
        math_ea_status = "due"
    elif profil == "P3":
        effective_basis = "same_session_article3"
        annee_ea = "2026-2027"
        mode_ea = "meme_session"
        fr_eaf_status = "due"
        math_ea_status = "due"
    else:  # P2
        if same_session_basis is not None:
            effective_basis = same_session_basis
        else:
            if math_due:
                effective_basis = "same_session_article3"
            elif effective_eaf != "none":
                effective_basis = "retake_after_failure"
            else:
                effective_basis = None

        if effective_eaf != "none" or math_due:
            annee_ea = "2026-2027"
            mode_ea = "meme_session"
        else:
            annee_ea = "2025-2026"
            mode_ea = "anticipation"

        if effective_eaf == "none":
            fr_eaf_status = "normally_already_presented"
        elif effective_basis == "retake_after_failure":
            fr_eaf_status = "retake_after_failure"
        elif effective_basis == "same_session_article3":
            fr_eaf_status = "same_session_article3"
        else:
            fr_eaf_status = "due"

        if math_due:
            if effective_basis == "same_session_article3":
                math_ea_status = "same_session_article3"
            else:
                math_ea_status = "due"
        else:
            if effective_basis == "retake_after_failure" or kwargs.get("echec_anterieur_baccalaureat") == "oui":
                math_ea_status = "exempt_transitional"
            else:
                math_ea_status = "normally_already_presented"

    parcours_math = "specialite" if "MATH" in spes_1re else "specifiques"

    r: dict[str, Any] = {
        "profil": profil,
        "mode_evaluations_ponctuelles": mode,
        "diagnostic_nexus_utile": diagnostic_nexus_utile,
        "philosophie_due": profil in ("P2", "P3"),
        "eaf_due": effective_eaf,
        "epreuves_francais_a_presenter": "aucune" if effective_eaf == "none" else effective_eaf,
        "fr_eaf_status": fr_eaf_status,
        "fr_pos_requis": effective_fr_pos,
        "positionnement_francais": effective_fr_pos,
        "fr_mai_requis": effective_fr_mai,
        "specialites_suivies_premiere": spes_1re,
        "specialite_non_poursuivie": abandon or INCONNUE,
        "specialite_abandonnee": abandon or INCONNUE,
        "specialites_terminales": spes_tle,
        "annee_scolaire_passation_ea": annee_ea,
        "mode_passation_ea": mode_ea,
        "math_ea_due": math_due,
        "math_ea_status": math_ea_status,
        "same_session_basis": effective_basis,
        "parcours_mathematiques": parcours_math,
    }
    r.update(kwargs)

    if profil == "P1":
        r.update({"session_baccalaureat_finale": 2028, "specialites": spes_1re})
    elif profil == "P2":
        r.update({"session_baccalaureat_finale": 2027, "specialites": spes_tle})
        if effective_basis == "retake_after_failure":
            r.setdefault("echec_anterieur_baccalaureat", "oui")
            r.setdefault("dispense_transitoire", "DISP-ECHEC-2026")
            r.setdefault("pieces_justificatives", ["releve_notes_anterieur"])
        elif effective_basis == "same_session_article3":
            r.setdefault("age_au_31_decembre_annee_examen", 21)
            r.setdefault("pieces_justificatives", ["piece_identite"])
        if math_due:
            r.update({"ea_mathematiques_deja_presentee": "non", "note_ea_mathematiques": None,
                      "conservation_demandee": "non"})
        else:
            if effective_basis != "retake_after_failure":
                r.update({"ea_mathematiques_deja_presentee": "oui", "session_de_presentation_ea_math": 2026,
                          "note_ea_mathematiques": 12, "conservation_demandee": "oui"})
    else:  # P3
        r.update({"session_baccalaureat_finale": 2027, "specialites": spes_tle})
        if "age_au_31_decembre_annee_examen" not in r and "echec_anterieur_baccalaureat" not in r \
                and "retour_formation_initiale" not in r and "enfant_a_charge" not in r \
                and "diplome_francais_detenu" not in r and "residence_etranger" not in r \
                and "changement_voie_ou_serie" not in r and "ea_presentees_puis_absence_inscription" not in r:
            r.setdefault("age_au_31_decembre_annee_examen", 21)
            r.setdefault("pieces_justificatives", ["piece_identite"])
            r.setdefault("epreuves_anticipees_presentees_annee_precedente", "non")
            r.setdefault("dispense_epreuves_anticipees", "non")
        import eligibilite as EL
        st = EL.statut_profil(r)
        if not st["ouvert"] or st["statut"] != EL.P3_OUVERT:
            raise ValueError(
                f"Profil P3 non autorisé : condition de l'article 3 non remplie ou non vérifiée "
                f"({st['statut']} - {st.get('motif')})"
            )

    # Invariant de cohérence temporelle
    import contexte as CTX
    ctx = CTX.contexte(r)
    if not ctx["coherent"]:
        raise ValueError(
            f"Incohérence temporelle : finale={ctx['session_baccalaureat_finale']}, "
            f"annee_ea={ctx['annee_scolaire_passation_ea']}, mode={ctx['mode_passation_ea']} "
            f"(attendu {ctx['session_attendue']})"
        )

    return {"candidat_id": cid, "reponses": r}


# ─────────────────────────────────────────────── l'espace d'états

def scenario_id(f: dict) -> str:
    tle = "-".join(f["spes_terminales"]) if f.get("spes_terminales") else "inconnue"
    parts = [f["profil"], f["mode_ep"], "-".join(f["spes_premiere"]), f"tle-{tle}", f"EAF-{f['eaf_due']}"]
    if f.get("math_ea_due"):
        parts.append("MATH-EA-due")
    if f.get("same_session_basis"):
        parts.append(f"basis-{f['same_session_basis']}")
    if f.get("fr_pos_requis"):
        parts.append("FR-POS")
    if f.get("fr_mai_requis"):
        parts.append("FR-MAI")
    if not f.get("diagnostic_nexus_utile", True):
        parts.append("sans-diag-utile")
    return "_".join(parts)


def candidate_state_space() -> list[dict]:
    """Chaque situation candidate valide, dérivée du domaine : faits prêts pour
    `build_candidate_facts`, avec un identifiant stable. Le nombre n'est pas fixé ici."""
    etats: list[dict] = []

    def ajouter(**f):
        f.setdefault("spes_terminales", [])
        f.setdefault("math_ea_due", False)
        f.setdefault("fr_pos_requis", False)
        f.setdefault("fr_mai_requis", False)
        f.setdefault("diagnostic_nexus_utile", True)
        f.setdefault("same_session_basis", None)
        etats.append({"scenario_id": scenario_id(f), **f})

    p2_ea_configs = [
        # 1 standard
        ("none", False, None),
        # 3 retake_after_failure (math_ea_due must be False under Art. 17)
        ("ecrit", False, "retake_after_failure"),
        ("oral", False, "retake_after_failure"),
        ("les_deux", False, "retake_after_failure"),
        # 7 same_session_article3
        ("none", True, "same_session_article3"),
        ("ecrit", True, "same_session_article3"),
        ("oral", True, "same_session_article3"),
        ("les_deux", True, "same_session_article3"),
        ("ecrit", False, "same_session_article3"),
        ("oral", False, "same_session_article3"),
        ("les_deux", False, "same_session_article3"),
    ]

    for triplet in itertools.combinations(SPECIALITES_VALIDES, 3):
        t = list(triplet)
        # P1 : orientation inconnue, ou l'une des trois non poursuivie.
        for mode in MODES_EP:
            for abandon in [None, *t]:
                for eaf in EAF_ADMIS["P1"]:
                    for diag_utile in (True, False):
                        if diag_utile:
                            for fr_pos in (False, True):
                                ajouter(profil="P1", mode_ep=mode, spes_premiere=t, spe_non_poursuivie=abandon,
                                        spes_terminales=[s for s in t if s != abandon] if abandon else [],
                                        eaf_due=eaf, fr_pos_requis=fr_pos, diagnostic_nexus_utile=True)
                        else:
                            ajouter(profil="P1", mode_ep=mode, spes_premiere=t, spe_non_poursuivie=abandon,
                                    spes_terminales=[s for s in t if s != abandon] if abandon else [],
                                    eaf_due=eaf, fr_pos_requis=False, diagnostic_nexus_utile=False)

        # P2 : l'une des trois non poursuivie, deux modes, 11 configurations d'EA réglementaires, options de diagnostic.
        for mode in MODES_EP:
            for abandon in t:
                for eaf, math_ea, basis in p2_ea_configs:
                    for diag_utile in (True, False):
                        if diag_utile:
                            for fr_pos in (False, True):
                                for fr_mai in (False, True):
                                    ajouter(profil="P2", mode_ep=mode, spes_premiere=t, spe_non_poursuivie=abandon,
                                            spes_terminales=[s for s in t if s != abandon], eaf_due=eaf,
                                            math_ea_due=math_ea, same_session_basis=basis,
                                            fr_pos_requis=fr_pos, fr_mai_requis=fr_mai,
                                            diagnostic_nexus_utile=True)
                        else:
                            ajouter(profil="P2", mode_ep=mode, spes_premiere=t, spe_non_poursuivie=abandon,
                                    spes_terminales=[s for s in t if s != abandon], eaf_due=eaf,
                                    math_ea_due=math_ea, same_session_basis=basis,
                                    fr_pos_requis=False, fr_mai_requis=False,
                                    diagnostic_nexus_utile=False)

        # P3 : fin de cycle, l'une des trois non poursuivie, options.
        for abandon in t:
            for eaf in EAF_ADMIS["P3"]:
                for diag_utile in (True, False):
                    if diag_utile:
                        for fr_pos in (False, True):
                            for fr_mai in (False, True):
                                ajouter(profil="P3", mode_ep="fin_cycle", spes_premiere=t, spe_non_poursuivie=abandon,
                                        spes_terminales=[s for s in t if s != abandon], eaf_due=eaf,
                                        math_ea_due=True, same_session_basis="same_session_article3",
                                        fr_pos_requis=fr_pos, fr_mai_requis=fr_mai,
                                        diagnostic_nexus_utile=True)
                    else:
                        ajouter(profil="P3", mode_ep="fin_cycle", spes_premiere=t, spe_non_poursuivie=abandon,
                                spes_terminales=[s for s in t if s != abandon], eaf_due=eaf,
                                math_ea_due=True, same_session_basis="same_session_article3",
                                fr_pos_requis=False, fr_mai_requis=False,
                                diagnostic_nexus_utile=False)

    ids = [e["scenario_id"] for e in etats]
    assert len(ids) == len(set(ids)), "identifiants de scénario en double"
    return etats


def faits_de(etat: dict, candidat_id: str = "CL-TEST-0000") -> dict:
    """Les faits construits d'un état de l'espace."""
    return build_candidate_facts(
        profil=etat["profil"], mode_ep=etat["mode_ep"], spes_premiere=etat["spes_premiere"],
        spe_non_poursuivie=etat.get("spe_non_poursuivie"), spes_terminales=etat.get("spes_terminales") or None,
        eaf_due=etat["eaf_due"], math_ea_due=etat.get("math_ea_due", False),
        fr_pos_requis=etat.get("fr_pos_requis", False), fr_mai_requis=etat.get("fr_mai_requis", False),
        diagnostic_nexus_utile=etat.get("diagnostic_nexus_utile", True),
        same_session_basis=etat.get("same_session_basis"),
        candidat_id=candidat_id)


def evaluer_etat(etat: dict, cat: dict | None = None) -> dict:
    """Ce que le moteur décide pour un état : obligations, diagnostics, livrets, durée.

    Chemin unique : build_candidate_facts → epreuves_reglementaires_dues_vs_diagnostics →
    map_instruments_to_booklets → lignes_diagnostics_famille.
    """
    import distribution as DIS
    import livret as LI
    import maquette_donnees as MD
    import pack_candidat as PC
    import release_v2 as REL
    cat = cat or DIS.catalogue()
    qp = faits_de(etat)
    analyse = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, cat)
    dues = analyse["epreuves_reglementaires_dues"]
    diags = analyse["diagnostics_nexus_utiles"]
    effective = diags if qp["reponses"].get("diagnostic_nexus_utile", True) else dues
    livrets = PC.map_instruments_to_booklets(effective, etat["profil"], REL.LIVRETS)
    lignes = PC.lignes_diagnostics_famille(effective, cat, LI.duree_dossier_entree())
    return {"faits": qp["reponses"], "dues": dues, "reportees": analyse.get("evaluations_reportees_fin_cycle", []),
            "diagnostics": diags, "effective": effective, "livrets": livrets, "lignes": lignes,
            "duree_min": sum(m for _, m in lignes)}


def signature_selection(diags) -> str:
    return " ".join(f"{c}/{v}" for c, v in sorted(diags))


_CLASSES: dict[str, dict] | None = None


def classes_de_selection(etats: list[dict] | None = None, cat: dict | None = None) -> dict[str, dict]:
    """Les classes d'équivalence de sélection : deux états qui appellent exactement les
    mêmes instruments reçoivent les mêmes livrets. Clé : profil + signature d'instruments.

    Sans argument, le résultat est calculé une fois par processus : la release, le banc
    et les matrices le relisent tel quel."""
    global _CLASSES
    if etats is None and cat is None:
        if _CLASSES is None:
            _CLASSES = _classes(candidate_state_space(), None)
        return _CLASSES
    return _classes(etats if etats is not None else candidate_state_space(), cat)


def _classes(etats: list[dict], cat: dict | None) -> dict[str, dict]:
    import distribution as DIS
    import maquette_donnees as MD
    cat = cat or DIS.catalogue()
    classes: dict[str, dict] = {}
    for etat in etats:
        qp = faits_de(etat)
        analyse = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, cat)
        dues = analyse["epreuves_reglementaires_dues"]
        diags = analyse["diagnostics_nexus_utiles"]
        effective = diags if qp["reponses"].get("diagnostic_nexus_utile", True) else dues
        cle = f"{etat['profil']}|{signature_selection(effective)}"
        c = classes.setdefault(cle, {"profil": etat["profil"], "instruments": sorted(effective),
                                     "representant": etat, "etats": []})
        c["etats"].append(etat["scenario_id"])
    return classes

