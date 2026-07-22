import csv
import json
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts/pre-rentree/render_economic_simulation.py"
OPERATIONS = REPO_ROOT / "content/pre-rentree-2026/operations.fr.json"


@pytest.fixture(scope="module")
def commercial_snapshot(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("commercial") / "commercial-contract.snapshot.json"
    subprocess.run(
        [
            str(REPO_ROOT / "node_modules/.bin/tsx"),
            "--conditions=react-server",
            str(REPO_ROOT / "scripts/pre-rentree/build-commercial-contract.ts"),
            "--output",
            str(output),
        ],
        cwd=REPO_ROOT,
        check=True,
    )
    return output


def test_economic_simulation_is_complete_but_fail_closed_without_cost_inputs(tmp_path: Path, commercial_snapshot: Path):
    output = tmp_path / "economic"
    subprocess.run(
        [sys.executable, str(SCRIPT), "--commercial", str(commercial_snapshot), "--operations", str(OPERATIONS), "--output", str(output)],
        cwd=REPO_ROOT,
        check=True,
    )

    simulation = json.loads((output / "economic-simulation.json").read_text(encoding="utf-8"))
    assert simulation["status"] == "REVIEW_INPUTS_REQUIRED"
    assert simulation["pricesModified"] is False
    assert len(simulation["rows"]) == 52
    assert {row["students"] for row in simulation["rows"]} == {3, 4, 5, 6}
    assert all(row["revenue"] == row["unitPrice"] * row["students"] for row in simulation["rows"])
    assert all(row["teacherCompensation"] is None for row in simulation["rows"])
    assert all(row["grossMargin"] is None and row["breakEvenStudents"] is None for row in simulation["rows"])
    assert {item["decisionId"] for item in simulation["futureImpacts"]} == {
        "DEC-PRE2026-MANUAL-BENEFIT",
        "DEC-PRE2026-ANNUAL-DISCOUNT",
    }
    assert all(item["publicStatus"] == "HIDDEN_PENDING" for item in simulation["futureImpacts"])

    with (output / "economic-simulation.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 52
    assert {int(row["students"]) for row in rows} == {3, 4, 5, 6}

    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "REVIEW_INPUTS_REQUIRED"
    assert manifest["inventory"]["simulationRows"] == 52
    assert manifest["qa"]["blankPages"] == 0
    assert manifest["qa"]["missingFonts"] == 0
    assert manifest["qa"]["overflowFindings"] == 0
    assert (output / "economic-simulation.html").is_file()
    assert (output / "economic-simulation.pdf").is_file()
    assert list((output / "rendered").glob("page-*.png"))
    assert (output / "visual-review/contact-sheet.png").is_file()


def test_economic_simulation_calculates_validated_costs_and_break_even(tmp_path: Path, commercial_snapshot: Path):
    operations = json.loads(OPERATIONS.read_text(encoding="utf-8"))
    values = {
        "teacherHourlyCost": 20,
        "preparationHoursPerModule": 2,
        "correctionHoursPerStudent": 0.5,
        "diagnosisHoursPerStudent": 0,
        "reportHoursPerStudent": 0,
        "printingCostPerStudent": 5,
        "manualUnitCost": 0,
        "manualEligibleShare": 0,
        "roomHourlyCost": 10,
        "administrationCostPerStudent": 3,
        "advertisingFixedCost": 100,
        "paymentCommissionRate": 0.02,
        "contingencyRate": 0.05,
        "taxRate": 0.10,
        "otherFixedCosts": 50,
        "cacLow": 2,
        "cacMedium": 4,
        "cacHigh": 6,
    }
    for item in operations["economicModel"]["inputs"]:
        item["value"] = values[item["id"]]
    operations_path = tmp_path / "operations.json"
    operations_path.write_text(json.dumps(operations), encoding="utf-8")
    output = tmp_path / "calculated"
    subprocess.run(
        [sys.executable, str(SCRIPT), "--commercial", str(commercial_snapshot), "--operations", str(operations_path), "--output", str(output)],
        cwd=REPO_ROOT,
        check=True,
    )
    simulation = json.loads((output / "economic-simulation.json").read_text(encoding="utf-8"))
    assert simulation["status"] == "CALCULATED"
    first = next(row for row in simulation["rows"] if row["offerId"] == "pre2026-3e-mathematiques" and row["students"] == 4)
    assert first["teacherCompensation"] == 200
    assert first["preparationCost"] == 40
    assert first["correctionCost"] == 40
    assert first["supportCost"] == 20
    assert first["marketingAcquisitionCost"] == 116
    assert first["grossMargin"] == 623.7
    assert first["breakEvenStudents"] == 4
