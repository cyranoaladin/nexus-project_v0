"""La bonne réponse ne doit pas se tenir toujours à la même place.

Chaque question de la collection était juste ; la distribution ne l'était pas. Sur les
267 QCM, la bonne réponse occupait la position B dans 65,5 % des cas — 100 % en
histoire-géographie du tronc commun, 94 % en enseignement scientifique, 93 % en HGGSP. Un
candidat qui cochait B partout, sans lire une seule question, emportait deux tiers des
points de QCM. Le score, le bilan et le plan de travail héritaient du biais, et aucun test
ne le voyait : il n'est visible que d'au-dessus des items.

`scripts/equilibrer_qcm.py` a réparti les positions ; ce contrôle empêche la dérive de
revenir, et il la mesure au lieu de la décréter.
"""
from __future__ import annotations

import collections
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import equilibrer_qcm as EQ  # noqa: E402

INSTRUMENTS = RACINE / "instruments"


def qcm(dossier: Path) -> list[dict]:
    p = dossier / "banque.json"
    if not p.exists():
        return []
    return [i for i in json.loads(p.read_text(encoding="utf-8"))["items"]
            if i.get("type") == "A" and (i.get("cle") or {}).get("reponse")]


def instruments() -> list[Path]:
    return EQ.instruments_reels()


def part_modale(positions: collections.Counter) -> float:
    n = sum(positions.values())
    return max(positions.values()) / n if n else 0.0


#: Le hasard ne répartit pas parfaitement. Sur un tirage uniforme à quatre positions, la
#: part modale attendue tourne autour de 30 % dès quelques dizaines de questions ; on
#: laisse la marge d'un tirage, sans laisser passer une collection qui penche.
PLAFOND_COLLECTION = 0.35
PLAFOND_INSTRUMENT = 0.55

#: En deçà de ce nombre de questions, la part modale ne dit rien : avec trois questions,
#: elle vaut au mieux un tiers et au pire la totalité sans qu'aucun biais soit en cause.
ASSEZ_DE_QUESTIONS = 10


def test_la_collection_ne_privilegie_aucune_position():
    positions = collections.Counter()
    for d in instruments():
        positions.update(i["cle"]["reponse"] for i in qcm(d))
    n = sum(positions.values())
    assert n >= 200, f"seulement {n} QCM : le contrôle ne prouverait rien"
    part = part_modale(positions)
    assert part <= PLAFOND_COLLECTION, (
        f"la bonne réponse est en position « {positions.most_common(1)[0][0]} » dans "
        f"{part:.1%} des {n} QCM de la collection : un candidat qui cocherait cette "
        f"lettre partout, sans lire une question, obtiendrait autant de points. "
        f"Répartition : {dict(sorted(positions.items()))}")
    assert len(positions) == 4, "une position n'est jamais la bonne réponse"


@pytest.mark.parametrize("dossier", instruments(), ids=lambda d: d.name)
def test_aucun_instrument_ne_concentre_ses_reponses(dossier):
    items = qcm(dossier)
    if len(items) < ASSEZ_DE_QUESTIONS:
        pytest.skip(f"{len(items)} QCM : sous {ASSEZ_DE_QUESTIONS}, la part modale ne "
                    f"mesure rien — le contrôle de collection couvre ces items")
    positions = collections.Counter(i["cle"]["reponse"] for i in items)
    part = part_modale(positions)
    assert part <= PLAFOND_INSTRUMENT, (
        f"{dossier.name} : {part:.1%} des {len(items)} QCM ont leur bonne réponse en "
        f"position « {positions.most_common(1)[0][0]} ». Répartition : "
        f"{dict(sorted(positions.items()))}")


def test_la_position_est_derivee_de_la_banque_donc_reproductible():
    """La répartition n'est pas un tirage au sort : elle se recalcule à l'identique.

    Sans quoi deux constructions de la release placeraient les propositions ailleurs, et
    un livret imprimé ne correspondrait plus à la clé du coach. Les positions sont
    distribuées à tour de rôle dans l'ordre des empreintes d'identifiant : la banque doit
    porter exactement ce que ce calcul redonne.
    """
    for d in instruments():
        items = json.loads((d / "banque.json").read_text(encoding="utf-8"))["items"]
        attendues = EQ.positions_cibles(items)
        for it in qcm(d):
            assert it["cle"]["reponse"] == attendues[it["item_id"]], (
                f"{it['item_id']} : bonne réponse en « {it['cle']['reponse']} », "
                f"alors que la distribution en désigne « {attendues[it['item_id']]} ». "
                f"La banque et scripts/equilibrer_qcm.py ont divergé.")


def test_la_distribution_est_exactement_equilibree_dans_chaque_banque():
    """Les effectifs de position ne diffèrent jamais de plus d'un, par construction."""
    for d in instruments():
        items = json.loads((d / "banque.json").read_text(encoding="utf-8"))["items"]
        cibles = EQ.positions_cibles(items)
        if len(cibles) < 4:
            continue
        effectifs = collections.Counter(cibles.values())
        for lettre in "ABCD":
            effectifs.setdefault(lettre, 0)
        assert max(effectifs.values()) - min(effectifs.values()) <= 1, \
            f"{d.name} : distribution déséquilibrée {dict(sorted(effectifs.items()))}"


def test_chaque_distracteur_garde_le_libelle_de_son_mecanisme():
    """Un libellé d'erreur détaché de sa proposition ferait remédier à côté."""
    for d in instruments():
        for it in qcm(d):
            distracteurs = (it["cle"].get("distracteurs") or {})
            attendues = set(it["propositions"]) - {it["cle"]["reponse"]}
            assert set(distracteurs) == attendues, (
                f"{it['item_id']} : libellés portés par {sorted(distracteurs)} alors que "
                f"les distracteurs sont {sorted(attendues)}")
            assert it["cle"]["reponse"] not in distracteurs, \
                f"{it['item_id']} : la bonne réponse porte un libellé de distracteur"
