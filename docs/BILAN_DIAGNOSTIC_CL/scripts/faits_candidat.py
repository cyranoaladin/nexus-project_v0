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
    candidat_id: str | None = None,
    config_francais: str | None = None,
) -> dict[str, Any]:
    """Construit les faits d'un candidat, et refuse tout ce qui sort du domaine."""
    if profil not in PROFILS:
        raise ValueError(f"Profil inconnu : {profil!r} (attendu {', '.join(PROFILS)})")
    cid = candidat_id or f"CAND-{hashlib.sha256(os.urandom(16)).hexdigest()[:8].upper()}"

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

    r: dict[str, Any] = {
        "profil": profil,
        "mode_evaluations_ponctuelles": mode,
        "diagnostic_nexus_utile": diagnostic_nexus_utile,
        "philosophie_due": profil in ("P2", "P3"),
        "eaf_due": effective_eaf,
        "epreuves_francais_a_presenter": "aucune" if effective_eaf == "none" else effective_eaf,
        "fr_pos_requis": effective_fr_pos,
        "positionnement_francais": effective_fr_pos,
        "fr_mai_requis": effective_fr_mai,
        "specialites_suivies_premiere": spes_1re,
        "specialite_non_poursuivie": abandon or INCONNUE,
        "specialite_abandonnee": abandon or INCONNUE,
        "specialites_terminales": spes_tle,
        "annee_scolaire_passation_ea": "2026-2027",
        "math_ea_due": math_due,
    }
    if profil == "P1":
        r.update({"session_baccalaureat_finale": 2028, "mode_passation_ea": "anticipation",
                  "specialites": spes_1re})
    elif profil == "P2":
        r.update({"session_baccalaureat_finale": 2027, "mode_passation_ea": "anticipation",
                  "specialites": spes_tle})
        if math_due:
            r.update({"ea_mathematiques_deja_presentee": "non", "note_ea_mathematiques": None,
                      "conservation_demandee": "non"})
        else:
            r.update({"ea_mathematiques_deja_presentee": "oui", "session_de_presentation_ea_math": 2026,
                      "note_ea_mathematiques": 12, "conservation_demandee": "oui"})
    else:
        r.update({"session_baccalaureat_finale": 2027, "mode_passation_ea": "meme_session",
                  "specialites": spes_tle})
    return {"candidat_id": cid, "reponses": r}


# ─────────────────────────────────────────────── l'espace d'états

def scenario_id(f: dict) -> str:
    tle = "-".join(f["spes_terminales"]) if f.get("spes_terminales") else "inconnue"
    parts = [f["profil"], f["mode_ep"], "-".join(f["spes_premiere"]), f"tle-{tle}", f"EAF-{f['eaf_due']}"]
    if f.get("math_ea_due"):
        parts.append("MATH-EA-due")
    if f.get("fr_pos_requis"):
        parts.append("FR-POS")
    if f.get("fr_mai_requis"):
        parts.append("FR-MAI")
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
        etats.append({"scenario_id": scenario_id(f), **f})

    for triplet in itertools.combinations(SPECIALITES_VALIDES, 3):
        t = list(triplet)
        # P1 : orientation inconnue, ou l'une des trois non poursuivie.
        for mode in MODES_EP:
            for abandon in [None, *t]:
                for eaf in EAF_ADMIS["P1"]:
                    for fr_pos in (False, True):
                        ajouter(profil="P1", mode_ep=mode, spes_premiere=t, spe_non_poursuivie=abandon,
                                spes_terminales=[s for s in t if s != abandon] if abandon else [],
                                eaf_due=eaf, fr_pos_requis=fr_pos)
        # P2 : l'une des trois non poursuivie, deux modes, quatre statuts EAF, options.
        for mode in MODES_EP:
            for abandon in t:
                for eaf in EAF_ADMIS["P2"]:
                    for math_ea in (False, True):
                        for fr_pos in (False, True):
                            for fr_mai in (False, True):
                                ajouter(profil="P2", mode_ep=mode, spes_premiere=t, spe_non_poursuivie=abandon,
                                        spes_terminales=[s for s in t if s != abandon], eaf_due=eaf,
                                        math_ea_due=math_ea, fr_pos_requis=fr_pos, fr_mai_requis=fr_mai)
        # P3 : fin de cycle, l'une des trois non poursuivie, options.
        for abandon in t:
            for eaf in EAF_ADMIS["P3"]:
                for fr_pos in (False, True):
                    for fr_mai in (False, True):
                        ajouter(profil="P3", mode_ep="fin_cycle", spes_premiere=t, spe_non_poursuivie=abandon,
                                spes_terminales=[s for s in t if s != abandon], eaf_due=eaf,
                                fr_pos_requis=fr_pos, fr_mai_requis=fr_mai)
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
    livrets = PC.map_instruments_to_booklets(diags, etat["profil"], REL.LIVRETS)
    lignes = PC.lignes_diagnostics_famille(diags, cat, LI.duree_dossier_entree())
    return {"faits": qp["reponses"], "dues": dues, "reportees": analyse.get("evaluations_reportees_fin_cycle", []),
            "diagnostics": diags, "livrets": livrets, "lignes": lignes,
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
        diags = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, cat)["diagnostics_nexus_utiles"]
        cle = f"{etat['profil']}|{signature_selection(diags)}"
        c = classes.setdefault(cle, {"profil": etat["profil"], "instruments": sorted(diags),
                                     "representant": etat, "etats": []})
        c["etats"].append(etat["scenario_id"])
    return classes
