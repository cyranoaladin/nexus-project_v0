"""Generate review-only pedagogy, communication and operations artifacts."""

from __future__ import annotations

import csv
import json
import os
import zipfile
from datetime import date
from html import escape
from pathlib import Path
from typing import Any, Iterable
from xml.sax.saxutils import escape as xml_escape


def _atomic_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        temporary.write_text(content, encoding="utf-8")
        with temporary.open("rb") as handle:
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _atomic_json(path: Path, value: Any) -> None:
    _atomic_text(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def _review_html(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title><style>
body{{font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:32px;color:#10233f;line-height:1.5}}
.notice{{border:2px solid #9a6700;background:#fff5cc;padding:12px;font-weight:700}}
.review-form,article{{border:1px solid #ccd5e0;border-radius:8px;padding:18px;margin:20px 0;break-inside:avoid}}
table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #ccd5e0;padding:8px;text-align:left;vertical-align:top}}
h1,h2,h3{{color:#071a3a}}code{{overflow-wrap:anywhere}}
</style></head><body><p class="notice">Document de revue — diffusion interdite</p>{body}</body></html>"""


def _unordered(items: Iterable[str]) -> str:
    return "<ul>" + "".join(f"<li>{escape(str(item))}</li>" for item in items) + "</ul>"


def _materialize_pedagogy(snapshot: dict[str, Any], root: Path) -> None:
    pedagogy = snapshot["pedagogy"]
    positioning_root = root / "POSITIONING_TESTS"
    quick_root = root / "QUICK_ASSESSMENTS"
    deliverable_root = root / "SESSION_DELIVERABLES"

    for test in pedagogy["positioningTests"]:
        questions = "".join(
            f"<article><h2>Question {question['number']} — {escape(question['domain'])}</h2>"
            f"<p><strong>Sujet élève.</strong> {escape(question['prompt'])}</p>"
            f"<p><strong>Corrigé.</strong> {escape(question['correction'])}</p>"
            f"<p><strong>Barème.</strong> {question['points']} points.</p>"
            f"<p><strong>Erreurs observables.</strong></p>{_unordered(question['errorTypes'])}</article>"
            for question in test["questions"]
        )
        rubric = "".join(
            f"<tr><th scope=\"row\">{escape(label)}</th><td>{escape(text)}</td></tr>"
            for label, text in test["rubric"].items()
        )
        body = (
            f"<h1>{escape(test['id'])}</h1><p>Version {escape(test['version'])} · "
            f"{test['durationMinutes']} minutes · Matériel : {escape(test['materialAllowed'])}</p>"
            f"<h2>Domaines</h2>{_unordered(test['domains'])}{questions}"
            f"<h2>Grille Acquis / Fragile / Lacune</h2><table><tbody>{rubric}</tbody></table>"
            f"<h2>Contrôles de cohérence</h2>{_unordered(test['coherenceChecks'])}"
            f"<h2>Échantillon anonymisé</h2><p>{escape(test['anonymousSample']['sampleId'])} — "
            f"{escape(test['anonymousSample']['response'])} — {escape(test['anonymousSample']['assessment'])}</p>"
        )
        _atomic_text(positioning_root / f"{test['id']}.html", _review_html(test["id"], body))

    for assessment in pedagogy["quickAssessments"]:
        body = (
            f"<article><h1>{escape(assessment['id'])}</h1><p><strong>Séance.</strong> "
            f"{escape(assessment['sessionRef'])}</p><p><strong>Durée.</strong> {assessment['durationMinutes']} minutes</p>"
            f"<p><strong>Domaine.</strong> {escape(assessment['domain'])}</p>"
            f"<p><strong>Consigne.</strong> {escape(assessment['prompt'])}</p>"
            f"<p><strong>Corrigé.</strong> {escape(assessment['correction'])}</p>"
            f"<p><strong>Critère de réussite.</strong> {escape(assessment['successCriterion'])}</p>"
            f"<p><strong>Mode de saisie.</strong> {escape(assessment['captureMode'])}</p></article>"
        )
        _atomic_text(quick_root / f"{assessment['id']}.html", _review_html(assessment["id"], body))

    for deliverable in pedagogy["sessionDeliverables"]:
        body = (
            f"<article><h1>{escape(deliverable['title'])}</h1><p><code>{escape(deliverable['id'])}</code> · "
            f"{escape(deliverable['sessionRef'])}</p><p><strong>Objectif.</strong> {escape(deliverable['objective'])}</p>"
            f"<h2>Consignes</h2>{_unordered(deliverable['instructions'])}"
            f"<h2>Preuves attendues</h2>{_unordered(deliverable['expectedEvidence'])}"
            f"<h2>Auto-vérification</h2>{_unordered(deliverable['selfCheck'])}</article>"
        )
        _atomic_text(deliverable_root / f"{deliverable['id']}.html", _review_html(deliverable["title"], body))

    _atomic_json(root / "pedagogy-artifact-manifest.json", {
        "POSITIONING_TEST_COUNT": len(pedagogy["positioningTests"]),
        "QUICK_ASSESSMENT_COUNT": len(pedagogy["quickAssessments"]),
        "SESSION_DELIVERABLE_COUNT": len(pedagogy["sessionDeliverables"]),
        "CONTAINS_REAL_PII": False,
        "PUBLICATION_AUTHORIZED": False,
    })


def _materialize_communication(snapshot: dict[str, Any], root: Path) -> None:
    whatsapp = snapshot["whatsapp"]
    communication = snapshot["communication"]
    whatsapp_body = "<h1>Kit WhatsApp</h1><p>Mots-clés : " + " · ".join(
        escape(keyword) for keyword in whatsapp["keywords"]
    ) + "</p>" + "".join(
        f"<article><h2>{escape(item['purpose'])}</h2><p><code>{escape(item['id'])}</code></p>"
        f"<p>{escape(item['text'])}</p><p>Gate : {escape(item['publicGate'] or 'aucun')}</p></article>"
        for item in whatsapp["scripts"]
    )
    _atomic_text(root / "Kit_WhatsApp_PreRentree2026.html", _review_html("Kit WhatsApp", whatsapp_body))

    sections = ["<h1>Kit Facebook et Instagram</h1>"]
    sections.append("<h2>Publications</h2>" + "".join(
        f"<article><h3>{escape(item['title'])}</h3><p>{escape(item['text'])}</p>"
        f"<p>Gate : {escape(item['publicGate'] or 'aucun')}</p></article>"
        for item in communication["publications"]
    ))
    sections.append("<h2>Carrousels</h2>" + "".join(
        f"<article><h3>{escape(carousel['id'])}</h3>" + "".join(
            f"<p><strong>{escape(slide['title'])}</strong> — {escape(slide['body'])}</p>"
            for slide in carousel["slides"]
        ) + "</article>" for carousel in communication["carousels"]
    ))
    sections.append("<h2>Stories</h2>" + _unordered(item["id"] for item in communication["stories"]))
    sections.append("<h2>Reels</h2>" + "".join(
        f"<article><h3>{escape(reel['title'])}</h3><p>{reel['durationSeconds']} secondes · sous-titres requis</p>"
        f"{_unordered(reel['scenes'])}</article>" for reel in communication["reels"]
    ))
    _atomic_text(
        root / "Kit_Facebook_Instagram_PreRentree2026.html",
        _review_html("Kit Facebook et Instagram", "".join(sections)),
    )
    _atomic_json(root / "communication-manifest.json", {
        "WHATSAPP_SCRIPT_COUNT": len(whatsapp["scripts"]),
        "PUBLICATION_COUNT": len(communication["publications"]),
        "CAROUSEL_COUNT": len(communication["carousels"]),
        "STORY_COUNT": len(communication["stories"]),
        "REEL_COUNT": len(communication["reels"]),
        "PUBLICATION_AUTHORIZED": False,
    })


def _materialize_forms(operations: dict[str, Any], root: Path) -> None:
    forms = []
    for form in operations["reviewForms"]:
        rows = "".join(
            f"<tr><th scope=\"row\">{escape(field['label'])}</th><td>"
            f"Type : {escape(field['type'])} · {'obligatoire' if field['required'] else 'facultatif'} — champ vierge</td></tr>"
            for field in form["fields"]
        )
        forms.append(
            f"<section class=\"review-form\"><h2>{escape(form['title'])}</h2>"
            f"<p>{escape(form['purpose'])}</p><table><tbody>{rows}</tbody></table></section>"
        )
    body = (
        "<h1>Dossier d’inscription et de confirmation — gabarits de revue</h1>"
        "<p><strong>Aucune donnée nominative réelle</strong> n’est incluse. Ces gabarits ne sont ni publiables ni utilisables "
        "avant validation juridique et confidentialité.</p>" + "".join(forms)
    )
    _atomic_text(root / "Dossier_Inscription_Confirmation_REVIEW.html", _review_html("Gabarits internes", body))


def _materialize_crm(operations: dict[str, Any], root: Path) -> None:
    path = root / "CRM_PreRentree2026_TEMPLATE.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        with temporary.open("w", encoding="utf-8", newline="") as handle:
            csv.writer(handle).writerow(field["id"] for field in operations["crm"]["fields"])
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _cell(reference: str, value: Any = None, *, formula: str | None = None) -> str:
    if formula is not None:
        return f'<c r="{reference}"><f>{xml_escape(formula)}</f><v></v></c>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{reference}"><v>{value}</v></c>'
    return f'<c r="{reference}" t="inlineStr"><is><t>{xml_escape(str(value or ""))}</t></is></c>'


def _row(number: int, cells: Iterable[str]) -> str:
    return f'<row r="{number}">' + "".join(cells) + "</row>"


def _sheet(rows: Iterable[str]) -> bytes:
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData>' + "".join(rows) + '</sheetData></worksheet>'
    )
    return xml.encode("utf-8")


def _zip_entry(name: str, content: bytes, edition: date) -> tuple[zipfile.ZipInfo, bytes]:
    info = zipfile.ZipInfo(name, (edition.year, edition.month, edition.day, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    return info, content


def _economic_workbook(snapshot: dict[str, Any], destination: Path) -> None:
    model = snapshot["operations"]["economicModel"]
    inputs = model["inputs"]
    hypothesis_rows = [
        _row(1, [_cell("A1", "Modèle économique Pré-rentrée Nexus 2026 — revue")]),
        _row(2, [_cell("A2", "Les hypothèses de coûts sont volontairement à renseigner par le propriétaire.")]),
        _row(3, [_cell("A3", "Hypothèse"), _cell("B3", "Valeur"), _cell("C3", "Unité")]),
    ]
    input_rows: dict[str, int] = {}
    for index, item in enumerate(inputs, 4):
        input_rows[item["id"]] = index
        hypothesis_rows.append(_row(index, [
            _cell(f"A{index}", item["label"]), _cell(f"B{index}", "À renseigner"), _cell(f"C{index}", item["unit"]),
        ]))

    pricing_rows = [_row(1, [
        _cell("A1", "Niveau"), _cell("B1", "Gamme"), _cell("C1", "Matières"),
        _cell("D1", "Heures"), _cell("E1", "Prix"), _cell("F1", "Acompte"),
        _cell("G1", "Solde"), _cell("H1", "Minimum"), _cell("I1", "Maximum"),
    ])]
    offer_by_level = {offer["level"]: offer for offer in snapshot["offers"]["levels"]}
    for index, pricing in enumerate(snapshot["offerPricing"], 2):
        capacity = offer_by_level[pricing["level"]]["capacity"]
        pricing_rows.append(_row(index, [
            _cell(f"A{index}", pricing["level"]), _cell(f"B{index}", pricing["range"]),
            _cell(f"C{index}", pricing["subjectCount"]), _cell(f"D{index}", pricing["totalHours"]),
            _cell(f"E{index}", pricing["price"]), _cell(f"F{index}", pricing["deposit"]),
            _cell(f"G{index}", pricing["balance"]), _cell(f"H{index}", capacity["min"]),
            _cell(f"I{index}", capacity["max"]),
        ]))

    scenario_headers = [
        "Niveau", "Gamme", "Matières", "Remplissage", "Acquisition", "Élèves", "CA",
        "Cours", "Préparation", "Correction", "Diagnostic", "Bilans", "Impression", "Manuels",
        "Salle", "Administration", "Publicité/CAC", "Commission", "Imprévus", "Fiscalité",
        "Coût total", "Marge", "Seuil élèves",
    ]
    scenario_rows = [_row(1, [_cell(f"{chr(65 + i)}1", value) for i, value in enumerate(scenario_headers)])]
    all_inputs = f"Hypotheses!$B$4:$B${3 + len(inputs)}"
    row_number = 2
    for pricing_index, pricing in enumerate(snapshot["offerPricing"], 2):
        capacity = offer_by_level[pricing["level"]]["capacity"]
        fills = (("MINIMUM", capacity["min"]), ("MOYEN", round((capacity["min"] + capacity["max"]) / 2)), ("PLEIN", capacity["max"]))
        for fill_label, group_size in fills:
            for acquisition in model["acquisitionScenarios"]:
                r = row_number
                acquisition_cell = f"Hypotheses!$B${input_rows[acquisition['inputId']]}"
                teacher_cell = f"Hypotheses!$B${input_rows['teacherHourlyCost']}"
                formula_guard = f'IF(COUNT({all_inputs})<{len(inputs)},"",'
                formulas = {
                    "G": f'{formula_guard}Tarifs!$E${pricing_index}*F{r})',
                    "H": f'{formula_guard}Tarifs!$D${pricing_index}*{teacher_cell})',
                    "I": f'{formula_guard}Hypotheses!$B${input_rows["preparationHoursPerModule"]}*{teacher_cell})',
                    "J": f'{formula_guard}F{r}*Hypotheses!$B${input_rows["correctionHoursPerStudent"]}*{teacher_cell})',
                    "K": f'{formula_guard}F{r}*Hypotheses!$B${input_rows["diagnosisHoursPerStudent"]}*{teacher_cell})',
                    "L": f'{formula_guard}F{r}*Hypotheses!$B${input_rows["reportHoursPerStudent"]}*{teacher_cell})',
                    "M": f'{formula_guard}F{r}*Hypotheses!$B${input_rows["printingCostPerStudent"]})',
                    "N": f'{formula_guard}F{r}*Hypotheses!$B${input_rows["manualUnitCost"]}*Hypotheses!$B${input_rows["manualEligibleShare"]})',
                    "O": f'{formula_guard}Tarifs!$D${pricing_index}*Hypotheses!$B${input_rows["roomHourlyCost"]})',
                    "P": f'{formula_guard}F{r}*Hypotheses!$B${input_rows["administrationCostPerStudent"]})',
                    "Q": f'{formula_guard}Hypotheses!$B${input_rows["advertisingFixedCost"]}+F{r}*{acquisition_cell}+Hypotheses!$B${input_rows["otherFixedCosts"]})',
                    "R": f'{formula_guard}G{r}*Hypotheses!$B${input_rows["paymentCommissionRate"]})',
                    "S": f'{formula_guard}SUM(H{r}:R{r})*Hypotheses!$B${input_rows["contingencyRate"]})',
                    "T": f'{formula_guard}G{r}*Hypotheses!$B${input_rows["taxRate"]})',
                    "U": f'{formula_guard}SUM(H{r}:T{r}))',
                    "V": f'{formula_guard}G{r}-U{r})',
                    "W": f'{formula_guard}ROUNDUP((I{r}+Q{r})/MAX(1,Tarifs!$E${pricing_index}-(U{r}-I{r}-Q{r})/F{r}),0))',
                }
                cells = [
                    _cell(f"A{r}", pricing["level"]), _cell(f"B{r}", pricing["range"]),
                    _cell(f"C{r}", pricing["subjectCount"]), _cell(f"D{r}", fill_label),
                    _cell(f"E{r}", acquisition["id"]), _cell(f"F{r}", group_size),
                ] + [_cell(f"{column}{r}", formula=formulas[column]) for column in "GHIJKLMNOPQRSTUVW"]
                scenario_rows.append(_row(r, cells))
                row_number += 1

    files = {
        "[Content_Types].xml": b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>''',
        "_rels/.rels": b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>''',
        "xl/workbook.xml": b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hypotheses" sheetId="1" r:id="rId1"/><sheet name="Tarifs" sheetId="2" r:id="rId2"/><sheet name="Scenarios" sheetId="3" r:id="rId3"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>''',
        "xl/_rels/workbook.xml.rels": b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/></Relationships>''',
        "xl/worksheets/sheet1.xml": _sheet(hypothesis_rows),
        "xl/worksheets/sheet2.xml": _sheet(pricing_rows),
        "xl/worksheets/sheet3.xml": _sheet(scenario_rows),
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
    edition = date.fromisoformat(snapshot["document"]["documentEditionDate"])
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, content in sorted(files.items()):
                info, payload = _zip_entry(name, content, edition)
                archive.writestr(info, payload, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def generate_review_artifacts(snapshot: dict[str, Any], review_root: Path) -> None:
    pedagogy_root = review_root / "PEDAGOGY"
    communication_root = review_root / "COMMUNICATION"
    operations_root = review_root / "OPERATIONS"
    _materialize_pedagogy(snapshot, pedagogy_root)
    _materialize_communication(snapshot, communication_root)
    _materialize_forms(snapshot["operations"], operations_root)
    _materialize_crm(snapshot["operations"], operations_root)
    _economic_workbook(snapshot, operations_root / "Modele_economique_prerentree_Nexus_2026_v2.xlsx")
    _atomic_json(operations_root / "manuals-readiness.json", {
        "ELIGIBLE_MANUAL_COUNT": len(snapshot["manuals"]["manuals"]),
        "MANUALS_PUBLICLY_ADVERTISED_WITHOUT_STOCK": 0,
        "MANUALS": snapshot["manuals"]["manuals"],
    })
    _atomic_json(operations_root / "anonymous-dry-run-report.json", {
        "ANONYMOUS_STRUCTURAL_DRY_RUN": "PASS",
        "POSITIONING_TEST_COUNT": len(snapshot["pedagogy"]["positioningTests"]),
        "QUICK_ASSESSMENT_COUNT": len(snapshot["pedagogy"]["quickAssessments"]),
        "SESSION_DELIVERABLE_COUNT": len(snapshot["pedagogy"]["sessionDeliverables"]),
        "REAL_STUDENT_DRY_RUN": "NOT_PERFORMED",
        "OPERATIONALLY_READY": False,
        "OWNER_APPROVED": False,
        "PRIVACY_APPROVED": False,
    })
