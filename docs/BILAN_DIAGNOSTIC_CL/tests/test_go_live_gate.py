"""Les douze gates de mise en service disent l'état du dépôt, pas celui du jour où on les a écrites.

Un verdict versionné qui ne se recalcule pas ne prouve que la main qui l'a écrit. Ce
contrôle rejoue `scripts/go_live_gate.py` sur le dépôt courant et refuse que le fichier
versionné s'en écarte — sur les verdicts et les compteurs, non sur les empreintes de
commit, qui datent la production et bougent nécessairement entre le gel des sources et le
commit de la release.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import go_live_gate as GLG  # noqa: E402

AUDIT = RACINE / "audit"

#: Plus aucune gate ne dépend de l'endroit où on l'exécute : la propreté de l'arbre de
#: travail courant est jointe comme observation, et la gate porte sur l'extraction propre
#: du commit audité, que `audit/CLEAN_CLONE_ACCEPTANCE.json` établit.
TRIBUTAIRES_DE_L_ARBRE: set[str] = set()


@pytest.fixture(scope="module")
def recalcule():
    return GLG.gates()


@pytest.fixture(scope="module")
def versionne():
    return json.loads((AUDIT / "GO_LIVE_GATE.json").read_text(encoding="utf-8"))


def test_le_fichier_versionne_reflete_le_depot(versionne, recalcule):
    assert GLG.stable(versionne) == GLG.stable(recalcule), (
        "audit/GO_LIVE_GATE.json a dérivé : régénérer avec "
        "python3 scripts/go_live_gate.py")


def test_toutes_les_pieces_d_audit_exigees_sont_presentes():
    attendues = [
        "GO_LIVE_GATE.json", "GO_LIVE_READINESS.md", "FINDINGS.jsonl",
        "REGULATORY_SOURCE_REGISTER.json", "DISCIPLINARY_SCOPE.json",
        "ITEM_AUDIT.jsonl", "ASSEMBLY_AUDIT.json", "CONTENT_COVERAGE_MATRIX.json",
        "PDF_VISUAL_QA.json", "RELEASE_REPRODUCIBILITY.json",
        "CLEAN_CLONE_ACCEPTANCE.json", "SECURITY_SCAN.json", "SUPPORT_AUDIT.json",
        "PDF_VISUAL_RENDER.json",
    ]
    manquantes = [n for n in attendues if not (AUDIT / n).exists()]
    assert manquantes == [], f"pièces d'audit absentes : {manquantes}"


def test_aucun_finding_ne_reste_ouvert():
    findings = [json.loads(l) for l
                in (AUDIT / "FINDINGS.jsonl").read_text(encoding="utf-8").splitlines()
                if l.strip()]
    assert findings, "registre des findings vide"
    ouverts = [f["finding_id"] for f in findings if f["status"] != "FIXED"]
    assert ouverts == [], f"findings ouverts : {ouverts}"
    for f in findings:
        for champ in ("severity", "gate", "description", "evidence", "resolution"):
            assert f.get(champ), f"{f['finding_id']} : champ « {champ} » vide"


def test_chaque_item_de_banque_est_audite():
    """Aucune question ne peut entrer en banque sans être relue."""
    audit = [json.loads(l) for l
             in (AUDIT / "ITEM_AUDIT.jsonl").read_text(encoding="utf-8").splitlines()
             if l.strip()]
    audites = {r["item_id"] for r in audit}
    en_echec = [r["item_id"] for r in audit if r["status"] not in ("PASS", "FIXED", "N/A")]
    assert en_echec == [], f"items en échec : {en_echec}"
    manquants = []
    for dossier in sorted((RACINE / "instruments").iterdir()):
        banque = dossier / "banque.json"
        if dossier.name.startswith("_") or not banque.exists():
            continue
        for it in json.loads(banque.read_text(encoding="utf-8"))["items"]:
            if it["item_id"] not in audites:
                manquants.append(it["item_id"])
    assert manquants == [], (
        f"{len(manquants)} question(s) de banque sans relecture disciplinaire : "
        f"{manquants[:10]}")


def test_le_clone_propre_a_ete_accepte():
    cc = json.loads((AUDIT / "CLEAN_CLONE_ACCEPTANCE.json").read_text(encoding="utf-8"))
    assert cc["pytest"]["failed"] == 0
    assert cc["pytest"]["passed"] > 10000
    assert all(v == 0 for v in cc["verificateurs"].values()), cc["verificateurs"]
    assert cc["environnement_initial"]["source_privee_FR_POS"] == "absente"
    # Un skip n'est admis que motivé, et en disant ce qui reste prouvé sans lui.
    assert len(cc["skips"]) == cc["pytest"]["skipped"]
    for s in cc["skips"]:
        assert s["justification"] and s["ce_qui_reste_prouve"], s["test"]


@pytest.mark.parametrize("gate", [f"GATE {n:02d}" for n in range(1, 13)])
def test_chaque_gate_est_verte(gate, recalcule):
    g = next(x for x in recalcule["gates"] if x["gate"] == gate)
    if gate in TRIBUTAIRES_DE_L_ARBRE and g["status"] != "PASS":
        pytest.skip("arbre de travail en cours de modification — cette gate est vérifiée "
                    "dans le clone propre, où l'arbre est nécessairement propre")
    assert g["status"] == "PASS", json.dumps(g["preuves"], ensure_ascii=False)[:600]
