"""Deux défauts qu'aucun contrôle ne voyait : un palier hors d'atteinte, un document absent.

Le premier est arithmétique. Onze items demandaient de remettre quatre étapes dans
l'ordre et cotaient un point « trois étapes sur quatre sont à leur place ». Une
permutation de quatre éléments ne peut pas avoir exactement trois points fixes : si trois
sont à leur place, la quatrième y est aussi. Le palier n'était donc jamais atteint, et un
candidat qui avait presque réussi recevait zéro. Les tests passaient : personne n'avait
dénombré les permutations.

Le second est documentaire. Trois items ouvraient sur « Voici la réponse d'un autre
candidat », et le livret n'imprimait aucune réponse. La question était insoluble sur le
document remis au candidat.

Les deux contrôles ci-dessous ne portent aucune liste d'items : ils dérivent les cas des
banques, et resteront justes quand la collection changera.
"""
from __future__ import annotations

import itertools
import json
import re
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import livret as LI  # noqa: E402
import go_live_audit as GLA  # noqa: E402

INSTRUMENTS = RACINE / "instruments"

#: Les nombres écrits en toutes lettres qu'un palier peut porter.
MOTS = {"zéro": 0, "une": 1, "un": 1, "deux": 2, "trois": 3, "quatre": 4, "cinq": 5,
        "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10}

#: « trois étapes sur quatre sont à leur place » : n points fixes exigés parmi m.
POINTS_FIXES = re.compile(
    r"(?P<n>\w+)\s+(?:étapes?|éléments?|items?)\s+sur\s+(?P<m>\w+)\s+"
    r"(?:sont|est)\s+à\s+(?:leur|sa)\s+place", re.I)


def banques() -> list[tuple[str, dict]]:
    out = []
    for d in sorted(INSTRUMENTS.iterdir()):
        if d.name.startswith("_") or not (d / "banque.json").exists():
            continue
        out.append((d.name, json.loads((d / "banque.json").read_text(encoding="utf-8"))))
    return out


def atteignable(n: int, m: int) -> bool:
    """Existe-t-il une permutation de m éléments ayant exactement n points fixes ?"""
    if not 0 <= n <= m or m > 8:          # au-delà, on raisonne : n = m-1 est seul exclu
        return n != m - 1
    return any(sum(1 for i, x in enumerate(p) if i == x) == n
               for p in itertools.permutations(range(m)))


def test_le_denombrement_qui_fonde_le_controle():
    """Aucune permutation de quatre éléments n'a exactement trois points fixes."""
    compte = {}
    for p in itertools.permutations(range(4)):
        f = sum(1 for i, x in enumerate(p) if i == x)
        compte[f] = compte.get(f, 0) + 1
    assert compte == {0: 9, 1: 8, 2: 6, 4: 1}
    assert not atteignable(3, 4)
    assert atteignable(2, 4)


@pytest.mark.parametrize("instrument,banque", banques(), ids=lambda x: x if isinstance(x, str) else "")
def test_aucun_palier_ne_repose_sur_une_configuration_impossible(instrument, banque):
    for it in banque["items"]:
        cle = it.get("cle") or {}
        paliers = [t for k, v in cle.items() if k.startswith("reponses_")
                   for t in (v if isinstance(v, list) else [v])]
        for texte in paliers:
            m = POINTS_FIXES.search(str(texte))
            if not m:
                continue
            n, total = MOTS.get(m.group("n").lower()), MOTS.get(m.group("m").lower())
            assert n is not None and total is not None, \
                f"{it['item_id']} : palier « {texte} » — nombre non reconnu"
            assert atteignable(n, total), (
                f"{it['item_id']} : le palier « {texte} » exige {n} points fixes parmi "
                f"{total}, ce qu'aucune permutation ne réalise — il ne sera jamais attribué")


#: Les trois expressions sont définies dans `scripts/go_live_audit.py`, qui produit la
#: preuve mécanique correspondante. Les importer plutôt que les recopier interdit au
#: contrôle et au test de diverger — c'est exactement ce qui était arrivé au contrôle des
#: documents d'histoire-géographie, juste pour une version sur trois.
PROMESSE = GLA.PROMESSE
PORTE_SON_DOCUMENT = GLA.PORTE_SON_DOCUMENT
RENVOI_BLOC = GLA.RENVOI_BLOC


def supports_de_bloc(instrument: str) -> dict[str, list]:
    """Pour chaque item, les supports portés par le bloc qui l'accueille."""
    par_item: dict[str, list] = {}
    dossier = INSTRUMENTS / instrument / "assemblages"
    for p in sorted(dossier.glob("*.json")) if dossier.is_dir() else []:
        a = json.loads(p.read_text(encoding="utf-8"))
        for bloc in a.get("blocs", []):
            for iid in bloc.get("items", []):
                par_item.setdefault(iid, []).extend(bloc.get("supports") or [])
    return par_item


@pytest.mark.parametrize("instrument,banque", banques(), ids=lambda x: x if isinstance(x, str) else "")
def test_tout_document_promis_par_un_enonce_est_remis_au_candidat(instrument, banque):
    de_bloc = supports_de_bloc(instrument)
    for it in banque["items"]:
        enonce = it.get("enonce") or ""
        if not PROMESSE.search(enonce):
            continue
        if it.get("supports") or de_bloc.get(it["item_id"]):
            continue
        if PORTE_SON_DOCUMENT.search(enonce) or RENVOI_BLOC.search(enonce):
            continue
        pytest.fail(
            f"{it['item_id']} ({instrument}) : l'énoncé annonce un document — "
            f"« {enonce[:70]}… » — que ni l'item ni son bloc ne portent. La question est "
            f"insoluble sur le livret remis au candidat.")


def test_les_trois_productions_commentees_sont_bien_jointes():
    """Le cas trouvé le 2026-09-15, tenu nommément pour qu'il ne se réintroduise pas.

    Trois items demandaient de critiquer la production d'un autre candidat sans la
    joindre. La production est une pièce du sujet, pas un décor : sans elle, l'item ne
    mesure rien.
    """
    attendus = {"EDS-HLP": "HLP-1-INTER-02", "PHI": "PHI-T-TEXT-02",
                "EDS-SVT": "SVT-T-REDA-04"}
    for instrument, iid in attendus.items():
        banque = json.loads((INSTRUMENTS / instrument / "banque.json").read_text(encoding="utf-8"))
        it = next(i for i in banque["items"] if i["item_id"] == iid)
        supports = it.get("supports") or []
        assert supports, f"{iid} : la production commentée a disparu de l'item"
        sup = supports[0]
        assert sup.get("texte", "").strip(), f"{iid} : production vide"
        assert "fictive" in sup.get("reference", "").lower(), \
            f"{iid} : la production doit se déclarer fictive — aucune copie réelle"


def test_aucun_item_non_imprime_ne_laisse_la_duree_annoncee_inchangee():
    """Ce que le livret retire du sujet, il doit le retirer de la durée qu'il annonce."""
    exclus = LI.items_hors_livret()
    assert exclus, "plus aucun item hors livret : le contrôle ne prouverait rien"
    catalogue = json.loads(
        (RACINE / "referentiels" / "catalogue_instruments.json").read_text(encoding="utf-8"))
    touche = 0
    for fiche in catalogue["instruments"]:
        code, version = fiche["code"], fiche["version"]
        assemblage = INSTRUMENTS / code / "assemblages" / f"{version}.json"
        if not assemblage.exists():
            continue
        a = json.loads(assemblage.read_text(encoding="utf-8"))
        ids = [i for bloc in a.get("blocs", []) for i in bloc.get("items", [])]
        if not (set(ids) & exclus):
            continue
        touche += 1
        assert LI.duree_livret(code, version, fiche["duree_cible_min"]) < fiche["duree_cible_min"], \
            f"{code}/{version} : des items ne sont pas imprimés, la durée annoncée n'a pas bougé"
    assert touche, "aucun assemblage ne sert d'item hors livret : le contrôle est vide"
