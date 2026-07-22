#!/usr/bin/env python3
"""Render the fail-closed Pré-rentrée economic simulation and its QA evidence."""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
from pathlib import Path

import fitz
from PIL import Image, ImageOps, ImageDraw, ImageFont
from weasyprint import HTML


LEVEL_LABELS = {
    "TROISIEME": "Entrée en 3e",
    "SECONDE": "Entrée en Seconde",
    "PREMIERE": "Entrée en Première",
    "TERMINALE": "Entrée en Terminale",
}
SUBJECT_LABELS = {
    "MATHEMATIQUES": "Mathématiques",
    "PHYSIQUE_CHIMIE": "Physique-Chimie",
    "NSI": "NSI",
    "FRANCAIS": "Français",
    "PHILOSOPHIE": "Philosophie",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def amount(value: int | float | None) -> str:
    if value is None:
        return "À renseigner"
    return f"{value:,.0f} TND".replace(",", " ")


def input_value(item: dict) -> str:
    if item["value"] is None:
        return "À renseigner"
    if item["unit"] == "RATE":
        return f'{item["value"] * 100:g} %'
    return f'{item["value"]:g} {item["unit"]}'


def build_simulation(commercial: dict, operations: dict) -> dict:
    inputs = {item["id"]: item for item in operations["economicModel"]["inputs"]}
    missing_inputs = [item["id"] for item in inputs.values() if item["value"] is None]
    rows = []
    for offer in commercial["offers"]:
        subject_count = len(offer["subjects"])
        offer_label = (
            SUBJECT_LABELS[offer["subjects"][0]]
            if offer["pricingKind"] == "FOUNDATIONS"
            else f'{offer["subjectCount"]} matière' + ("s" if offer["subjectCount"] > 1 else "")
        )
        def economics(students: int) -> dict:
            if missing_inputs:
                return {
                    "teacherCompensation": None, "preparationCost": None, "correctionCost": None,
                    "supportCost": None, "marketingAcquisitionCost": None, "roomCost": None,
                    "administrationCost": None, "paymentCommission": None, "contingencyCost": None,
                    "taxCost": None, "otherFixedCosts": None, "totalCosts": None, "grossMargin": None,
                }
            value = lambda identifier: inputs[identifier]["value"]
            revenue = offer["price"] * students
            teacher = offer["hours"] * value("teacherHourlyCost")
            preparation = subject_count * value("preparationHoursPerModule") * value("teacherHourlyCost")
            correction = students * value("correctionHoursPerStudent") * value("teacherHourlyCost")
            supports = students * value("printingCostPerStudent")
            acquisition = value("advertisingFixedCost") + students * value("cacMedium")
            room = offer["hours"] * value("roomHourlyCost")
            administration = students * value("administrationCostPerStudent")
            payment = revenue * value("paymentCommissionRate")
            other_fixed = value("otherFixedCosts")
            base_costs = teacher + preparation + correction + supports + acquisition + room + administration + payment + other_fixed
            contingency = base_costs * value("contingencyRate")
            tax = revenue * value("taxRate")
            total = base_costs + contingency + tax
            rounded = lambda number: round(number, 2)
            return {
                "teacherCompensation": rounded(teacher), "preparationCost": rounded(preparation),
                "correctionCost": rounded(correction), "supportCost": rounded(supports),
                "marketingAcquisitionCost": rounded(acquisition), "roomCost": rounded(room),
                "administrationCost": rounded(administration), "paymentCommission": rounded(payment),
                "contingencyCost": rounded(contingency), "taxCost": rounded(tax),
                "otherFixedCosts": rounded(other_fixed), "totalCosts": rounded(total),
                "grossMargin": rounded(revenue - total),
            }

        break_even = None
        if not missing_inputs:
            break_even = next(
                (students for students in range(offer["groupMin"], offer["groupMax"] + 1)
                 if economics(students)["grossMargin"] >= 0),
                None,
            )
        for students in (3, 4, 5, 6):
            capacity_status = (
                "BELOW_MINIMUM" if students < offer["groupMin"]
                else "EXCEEDS_CAPACITY" if students > offer["groupMax"]
                else "OPERABLE_CAPACITY"
            )
            row = {
                "offerId": offer["offerId"],
                "level": offer["level"],
                "levelLabel": LEVEL_LABELS[offer["level"]],
                "offerLabel": offer_label,
                "pricingId": offer["pricingId"],
                "students": students,
                "capacityStatus": capacity_status,
                "unitPrice": offer["price"],
                "revenue": offer["price"] * students,
                **economics(students),
                "breakEvenStudents": break_even,
                "futureManualImpact": None,
                "futureAnnualDiscountImpact": None,
            }
            rows.append(row)
    return {
        "schemaVersion": "1.0.0",
        "campaignId": commercial["campaignId"],
        "currency": operations["economicModel"]["currency"],
        "status": "REVIEW_INPUTS_REQUIRED" if missing_inputs else "CALCULATED",
        "pricesModified": False,
        "groupSizes": [3, 4, 5, 6],
        "missingInputIds": missing_inputs,
        "inputs": list(inputs.values()),
        "rows": rows,
        "futureImpacts": [
            {
                "decisionId": "DEC-PRE2026-MANUAL-BENEFIT",
                "label": "Impact futur du manuel Maths/NSI",
                "publicStatus": "HIDDEN_PENDING",
                "impact": None,
                "reason": "Coût unitaire, part éligible, BAT, stock et approbation restent à valider.",
            },
            {
                "decisionId": "DEC-PRE2026-ANNUAL-DISCOUNT",
                "label": "Impact futur de la remise annuelle de 10 %",
                "publicStatus": "HIDDEN_PENDING",
                "impact": None,
                "reason": "Assiette annuelle, éligibilité, période, non-cumul, plafond et plancher restent à valider.",
            },
        ],
        "method": {
            "revenue": "unitPrice × students",
            "teacherCompensation": "hours × teacherHourlyCost",
            "preparationCost": "preparationHoursPerModule × teacherHourlyCost",
            "correctionCost": "students × correctionHoursPerStudent × teacherHourlyCost",
            "supportCost": "students × printingCostPerStudent",
            "marketingAcquisitionCost": "advertisingFixedCost + students × cacMedium",
            "grossMargin": "revenue − teacher − preparation − correction − supports − acquisition − room − administration − payment commission − other fixed costs − contingency − tax",
            "breakEvenStudents": "smallest allowed group size whose gross margin is non-negative",
        },
    }


def render_html(simulation: dict) -> str:
    input_rows = "".join(
        f"<tr><td>{html.escape(item['label'])}</td><td>{html.escape(item['unit'])}</td><td class='{'pending' if item['value'] is None else ''}'>{html.escape(input_value(item))}</td></tr>"
        for item in simulation["inputs"]
    )
    row_html = "".join(
        "<tr>"
        f"<td>{html.escape(row['levelLabel'])}</td><td>{html.escape(row['offerLabel'])}</td>"
        f"<td>{row['students']}</td><td>{html.escape(row['capacityStatus'])}</td>"
        f"<td>{amount(row['unitPrice'])}</td><td>{amount(row['revenue'])}</td>"
        f"<td>{amount(row['teacherCompensation'])}</td><td>{amount(row['preparationCost'])}</td>"
        f"<td>{amount(row['correctionCost'])}</td><td>{amount(row['supportCost'])}</td>"
        f"<td>{amount(row['marketingAcquisitionCost'])}</td><td>{amount(row['grossMargin'])}</td>"
        f"<td>{row['breakEvenStudents'] or 'À renseigner'}</td>"
        "</tr>" for row in simulation["rows"]
    )
    future = "".join(
        f"<article><h3>{html.escape(item['label'])}</h3><p><strong>{item['publicStatus']}</strong> — {html.escape(item['reason'])}</p></article>"
        for item in simulation["futureImpacts"]
    )
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Simulation économique Pré-rentrée 2026</title>
<style>
@page {{ size: A4 landscape; margin: 12mm; @bottom-right {{ content: counter(page) " / " counter(pages); font: 8pt sans-serif; color: #526079; }} }}
* {{ box-sizing: border-box; }} body {{ margin:0; color:#071a3a; font-family: DejaVu Sans, sans-serif; font-size:8.2pt; }}
h1,h2,h3 {{ margin:0 0 8px; }} h1 {{ font-size:22pt; }} h2 {{ margin-top:18px; font-size:14pt; break-after:avoid; }}
.hero {{ background:#071a3a; color:white; padding:18px 20px; border-left:5px solid #d5232f; }} .hero p {{ margin:6px 0 0; }}
.notice {{ margin:12px 0; padding:10px 12px; background:#fff4d9; border:1px solid #caa35b; }}
table {{ width:100%; border-collapse:collapse; table-layout:fixed; }} th,td {{ border:1px solid #ccd3df; padding:4px; vertical-align:top; overflow-wrap:anywhere; }}
th {{ background:#e9eef6; text-align:left; }} tr {{ break-inside:avoid; }} .pending {{ color:#9b1c27; font-weight:700; }}
.simulation {{ font-size:6.5pt; }} .simulation th:nth-child(1) {{ width:9%; }} .simulation th:nth-child(2) {{ width:8%; }}
.future {{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }} article {{ border:1px solid #ccd3df; padding:10px; }}
</style></head><body>
<header class="hero"><h1>Simulation économique — Pré-rentrée 2026</h1><p>Prix inchangés · 3, 4, 5 et 6 élèves · document interne de revue</p></header>
<p class="notice"><strong>Statut : {simulation['status']}.</strong> Le chiffre d’affaires est exact et dérivé du contrat commercial. {'Les coûts, la marge brute et le seuil de rentabilité restent volontairement non calculés tant que les hypothèses propriétaires ne sont pas validées.' if simulation['status'] == 'REVIEW_INPUTS_REQUIRED' else 'Les coûts, la marge brute et le seuil de rentabilité sont calculés à partir des hypothèses validées fournies.'}</p>
<h2>Hypothèses à valider</h2><table><thead><tr><th>Hypothèse</th><th>Unité</th><th>Valeur</th></tr></thead><tbody>{input_rows}</tbody></table>
<h2>Tableau 3–6 élèves</h2><table class="simulation"><thead><tr><th>Niveau</th><th>Offre</th><th>Élèves</th><th>Capacité</th><th>Prix</th><th>CA</th><th>Enseignant</th><th>Préparation</th><th>Correction</th><th>Supports</th><th>Acquisition</th><th>Marge brute</th><th>Seuil</th></tr></thead><tbody>{row_html}</tbody></table>
<h2>Impacts futurs préparés mais non actifs</h2><section class="future">{future}</section>
<p class="notice">Cette simulation ne modifie aucun prix validé. Toute décision tarifaire ultérieure requiert une nouvelle décision propriétaire.</p>
</body></html>"""


def write_csv(simulation: dict, path: Path) -> None:
    fields = list(simulation["rows"][0])
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(simulation["rows"])


def render_pdf_and_qa(html_path: Path, pdf_path: Path, output: Path) -> dict:
    HTML(filename=str(html_path)).write_pdf(str(pdf_path))
    rendered = output / "rendered"
    rendered.mkdir(parents=True, exist_ok=True)
    document = fitz.open(pdf_path)
    page_paths = []
    blank_pages = 0
    overflow = 0
    missing_fonts = 0
    for index, page in enumerate(document):
        if not page.get_text().strip():
            blank_pages += 1
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if x0 < -1 or y0 < -1 or x1 > page.rect.width + 1 or y1 > page.rect.height + 1:
                overflow += 1
        if any(not font[3] for font in page.get_fonts(full=True)):
            missing_fonts += 1
        page_path = rendered / f"page-{index + 1:02d}.png"
        page.get_pixmap(matrix=fitz.Matrix(1.35, 1.35), alpha=False).save(page_path)
        page_paths.append(page_path)
    document.close()

    thumbnails = []
    for page_path in page_paths:
        image = Image.open(page_path).convert("RGB")
        image.thumbnail((520, 370))
        thumbnails.append(ImageOps.expand(image, border=2, fill="#cbd3df"))
    columns = 2
    rows = (len(thumbnails) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 544, rows * 394 + 42), "white")
    draw = ImageDraw.Draw(sheet)
    review_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    draw.text((14, 10), "Simulation économique — contrôle visuel", fill="#071a3a", font=review_font)
    for index, image in enumerate(thumbnails):
        sheet.paste(image, (12 + (index % columns) * 544, 42 + (index // columns) * 394))
    review = output / "visual-review"
    review.mkdir(parents=True, exist_ok=True)
    sheet.save(review / "contact-sheet.png", optimize=True)
    return {"pages": len(page_paths), "blankPages": blank_pages, "missingFonts": missing_fonts, "overflowFindings": overflow}


def build_manifest(output: Path, simulation: dict, qa: dict) -> dict:
    assets = []
    for path in sorted(output.rglob("*")):
        if not path.is_file() or path.name == "manifest.json":
            continue
        item = {"path": path.relative_to(output).as_posix(), "bytes": path.stat().st_size, "sha256": sha256(path)}
        if path.suffix.lower() == ".png":
            with Image.open(path) as image:
                item.update({"width": image.width, "height": image.height})
        assets.append(item)
    return {
        "schemaVersion": "1.0.0",
        "campaignId": simulation["campaignId"],
        "status": simulation["status"],
        "inventory": {"simulationRows": len(simulation["rows"]), "assets": len(assets)},
        "qa": qa,
        "assets": assets,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commercial", required=True, type=Path)
    parser.add_argument("--operations", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    commercial = json.loads(args.commercial.read_text(encoding="utf-8"))
    operations = json.loads(args.operations.read_text(encoding="utf-8"))
    simulation = build_simulation(commercial, operations)
    json_path = args.output / "economic-simulation.json"
    csv_path = args.output / "economic-simulation.csv"
    html_path = args.output / "economic-simulation.html"
    pdf_path = args.output / "economic-simulation.pdf"
    json_path.write_text(json.dumps(simulation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(simulation, csv_path)
    html_path.write_text(render_html(simulation), encoding="utf-8")
    qa = render_pdf_and_qa(html_path, pdf_path, args.output)
    manifest = build_manifest(args.output, simulation, qa)
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Economic simulation: {len(simulation['rows'])} rows, {qa['pages']} PDF pages, status {simulation['status']}")


if __name__ == "__main__":
    main()
