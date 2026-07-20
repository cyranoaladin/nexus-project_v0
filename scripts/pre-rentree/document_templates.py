"""Accessible review-document HTML rendered only from the canonical snapshot."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable

from document_model import amount_html, claim_by_id, escape_text, safe_url


@dataclass(frozen=True)
class HtmlDocument:
    filename: str
    title: str
    short_title: str
    html: str


MONTHS_FR = (
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
)


def _format_date(value: str, *, year: bool = True) -> str:
    parsed = date.fromisoformat(value)
    suffix = f" {parsed.year}" if year else ""
    return f"{parsed.day} {MONTHS_FR[parsed.month - 1]}{suffix}"


def _edition_label(snapshot: dict[str, Any]) -> str:
    parsed = date.fromisoformat(snapshot["document"]["documentEditionDate"])
    return f"Édition {MONTHS_FR[parsed.month - 1]} {parsed.year}"


def _campaign_year(snapshot: dict[str, Any]) -> int:
    return date.fromisoformat(snapshot["campaign"]["startDate"]).year


def _source_attr(*paths: str) -> str:
    return escape_text(" ".join(paths))


def _claim(snapshot: dict[str, Any], claim_id: str, tag: str = "p", class_name: str = "") -> str:
    claim = claim_by_id(snapshot, claim_id)
    class_attr = f' class="{escape_text(class_name)}"' if class_name else ""
    return (
        f'<{tag}{class_attr} data-claim-id="{escape_text(claim_id)}">'
        f'{escape_text(claim["text"])}</{tag}>'
    )


def _guide_section(snapshot: dict[str, Any], section_id: str) -> dict[str, Any]:
    matching = [section for section in snapshot["parentGuide"]["sections"] if section["id"] == section_id]
    if len(matching) != 1:
        raise KeyError(f"Missing or duplicate parent-guide section: {section_id}")
    return matching[0]


def _guide_block(snapshot: dict[str, Any], section_id: str, block_id: str) -> dict[str, Any]:
    section = _guide_section(snapshot, section_id)
    matching = [block for block in section["blocks"] if block["id"] == block_id]
    if len(matching) != 1:
        raise KeyError(f"Missing or duplicate parent-guide block: {section_id}/{block_id}")
    return matching[0]


def _evidenced_text(snapshot: dict[str, Any], section_id: str, block_id: str) -> str:
    block = _guide_block(snapshot, section_id, block_id)
    if block["kind"] != "EVIDENCED_TEXT" or not block["evidenceRefs"]:
        raise ValueError(f"Parent-guide block is not evidenced text: {section_id}/{block_id}")
    capability_id = block.get("capabilityId")
    if capability_id:
        capabilities = {item["id"]: item for item in snapshot["capabilities"]["capabilities"]}
        if not capabilities[capability_id]["publiclyCommitted"]:
            raise ValueError(f"Capability is not publicly committed: {capability_id}")
    return (
        f'<p data-editorial-block="{escape_text(block_id)}" '
        f'data-source-path="{_source_attr(*block["evidenceRefs"])}">{escape_text(block["text"])}</p>'
    )


def _evidenced_list(snapshot: dict[str, Any], section_id: str) -> str:
    items = []
    for block in _guide_section(snapshot, section_id)["blocks"]:
        if block["kind"] != "EVIDENCED_TEXT":
            continue
        items.append(
            f'<li data-editorial-block="{escape_text(block["id"])}" '
            f'data-source-path="{_source_attr(*block["evidenceRefs"])}">{escape_text(block["text"])}</li>'
        )
    return f'<ul class="why-list">{"".join(items)}</ul>'


def _footer(snapshot: dict[str, Any], short_title: str) -> str:
    contact = snapshot["contact"]
    return f"""
    <footer class="family-footer">
      <span>{escape_text(short_title)} · {_edition_label(snapshot)}</span>
      <span class="footer-contact">
        <a href="{safe_url('tel:' + contact['phoneRaw'])}">{escape_text(contact['phone'])}</a> ·
        <a href="{safe_url('mailto:' + contact['email'])}">{escape_text(contact['email'])}</a> ·
        <a href="{safe_url(contact['canonicalUrl'])}">{escape_text(contact['domain'])}</a>
      </span>
    </footer>"""


def _shell(
    snapshot: dict[str, Any],
    title: str,
    short_title: str,
    body: str,
    description: str,
    navigation: Iterable[tuple[str, str]],
    *,
    body_class: str = "",
) -> str:
    contact = snapshot["contact"]
    nav = "".join(
        f'<li><a href="#{escape_text(anchor)}">{escape_text(label)}</a></li>'
        for anchor, label in navigation
    )
    review_banner = ""
    if snapshot["campaign"]["publicationMode"] == "REVIEW":
        review_banner = '<aside class="review-banner" role="note">Document de revue — diffusion interdite</aside>'
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="author" content="Nexus Réussite">
  <meta name="description" content="{escape_text(description)}">
  <meta name="dcterms.created" content="{escape_text(snapshot['document']['documentEditionDate'])}">
  <meta name="dcterms.source" content="{escape_text(snapshot['sourceSetSha256'])}">
  <meta name="nexus:campaign-id" content="{escape_text(snapshot['campaign']['id'])}">
  <meta name="nexus:document-package-version" content="{escape_text(snapshot['document']['documentPackageVersion'])}">
  <title>{escape_text(title)}</title>
  <link rel="stylesheet" href="../ASSETS/document.css">
</head>
<body class="{escape_text(body_class)}">
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  {review_banner}
  <header class="document-header">
    <img src="../ASSETS/logo-slogan.png" alt="Nexus Réussite">
    <div><strong>{escape_text(short_title)}</strong><br><span>{_edition_label(snapshot)}</span></div>
    <a class="header-contact" href="{safe_url('tel:' + contact['phoneRaw'])}">{escape_text(contact['phone'])}</a>
  </header>
  <nav class="document-nav" aria-label="Dans ce document"><ul>{nav}</ul></nav>
  <main id="contenu">{body}</main>
  {_footer(snapshot, short_title)}
</body>
</html>
"""


def _cover(snapshot: dict[str, Any]) -> str:
    campaign = snapshot["campaign"]
    levels = ", ".join(level["label"].replace("Entrée en ", "") for level in snapshot["levels"])
    subject_ids = {module["subjectId"] for module in snapshot["modules"]}
    subjects = " · ".join(
        subject["label"] for subject in snapshot["subjects"] if subject["id"] in subject_ids
    )
    return f"""
    <section id="couverture" class="cover" data-source-path="{_source_attr('/campaign', '/levels', '/subjects', '/contact')}">
      <img class="cover-logo" src="../ASSETS/logo-slogan.png" alt="Nexus Réussite">
      <p class="eyebrow">{escape_text(campaign['venue']['neighborhood'])}, {escape_text(campaign['venue']['city'])}</p>
      <h1>Stages de pré-rentrée {_campaign_year(snapshot)}</h1>
      <p class="cover-levels">Entrée en {escape_text(levels)}</p>
      <p class="cover-dates">{escape_text(_format_date(campaign['startDate'], year=False))} — {escape_text(_format_date(campaign['endDate']))}</p>
      <p class="cover-subjects">{escape_text(subjects)}</p>
      <div class="cover-action">
        <img class="qr" src="../ASSETS/qr-canonical.png" alt="QR code vers la page des stages Nexus Réussite">
        <p><strong>{escape_text(snapshot['cta']['primary'])}</strong><br>
        <a href="{safe_url('tel:' + snapshot['contact']['phoneRaw'])}">{escape_text(snapshot['contact']['phone'])}</a></p>
      </div>
    </section>"""


def _essentials(snapshot: dict[str, Any]) -> str:
    campaign = snapshot["campaign"]
    reference = snapshot["packs"][0]
    prices = [row["price"] for row in snapshot["offerPricing"]]
    foundations_capacity = campaign["capacityByOffer"]["FONDATIONS"]
    premium_capacity = campaign["capacityByOffer"]["PREMIUM"]
    cards = (
        ("Dates", f'{_format_date(campaign["startDate"], year=False)} au {_format_date(campaign["endDate"])}'),
        ("Niveaux", " · ".join(level["label"] for level in snapshot["levels"])),
        ("Format", f'{reference["sessionsPerSubject"]} séances de {reference["sessionDurationHours"]} h · {reference["hoursPerSubject"]} h par matière'),
        ("Fondations", f'Groupes de {foundations_capacity["min"]} à {foundations_capacity["max"]}'),
        ("Premium", f'Groupes de {premium_capacity["min"]} à {premium_capacity["max"]}'),
        ("Lieu", f'{campaign["venue"]["neighborhood"]}, {campaign["venue"]["city"]}'),
        ("Tarifs", f'{amount_html(min(prices))} à {amount_html(max(prices))}'),
        ("Décision des groupes", claim_by_id(snapshot, "decision-deadline")["text"]),
    )
    rendered = "".join(
        f'<article class="fact-card"><h3>{escape_text(label)}</h3><p>{value if "amount" in value else escape_text(value)}</p></article>'
        for label, value in cards
    )
    return f"""
    <section id="essentiel" class="page-section" data-source-path="{_source_attr('/campaign', '/levels', '/offerPricing')}">
      <p class="section-kicker">En un regard</p><h2>{escape_text(_guide_section(snapshot, 'essentiel')['title'])}</h2>
      {_evidenced_text(snapshot, 'essentiel', 'format-matiere')}
      <div class="fact-grid">{rendered}</div>
      <div class="notice">{_claim(snapshot, 'pre-registration')}</div>
    </section>"""


def _offers_comparison(snapshot: dict[str, Any]) -> str:
    offers = snapshot["offers"]["levels"]
    reference = snapshot["packs"][0]
    range_cards = []
    for range_id in ("FONDATIONS", "PREMIUM"):
        matching = [offer for offer in offers if offer["range"] == range_id]
        capacity = snapshot["campaign"]["capacityByOffer"][range_id]
        label = "Nexus Fondations" if range_id == "FONDATIONS" else "Nexus Premium"
        levels = " et ".join(
            next(level["label"] for level in snapshot["levels"] if level["id"] == offer["level"])
            for offer in matching
        )
        range_cards.append(f"""
        <article class="offer-card offer-{range_id.lower()}" data-source-path="/offers/levels">
          <h3>{escape_text(label)}</h3><p class="signature">{escape_text(matching[0]['signature'])}</p>
          <dl><div><dt>Niveaux</dt><dd>{escape_text(levels)}</dd></div>
          <div><dt>Groupe</dt><dd>{capacity['min']} à {capacity['max']} élèves</dd></div>
          <div><dt>Format</dt><dd>{reference['sessionsPerSubject']} séances · {reference['hoursPerSubject']} heures par matière</dd></div></dl>
        </article>""")
    return f"""
    <section id="offres" class="page-section"><p class="section-kicker">Deux cadres adaptés aux niveaux</p>
      <h2>{escape_text(_guide_section(snapshot, 'offres')['title'])}</h2>
      <div class="offer-grid">{''.join(range_cards)}</div>
      {_evidenced_text(snapshot, 'offres', 'capacites-gatees')}
    </section>"""


def _pedagogy(snapshot: dict[str, Any]) -> str:
    methods = "".join(
        f'<li data-claim-id="method-{index}"><span>{index}</span><div><h3>{escape_text(item["title"])}</h3><p>{escape_text(item["description"])}</p></div></li>'
        for index, item in enumerate(snapshot["content"]["method"], start=1)
    )
    return f"""
    <section id="pourquoi" class="page-section"><p class="section-kicker">Préparer le passage</p>
      <h2>{escape_text(_guide_section(snapshot, 'pourquoi')['title'])}</h2>{_evidenced_list(snapshot, 'pourquoi')}
    </section>
    <section id="fonctionnement" class="page-section"><p class="section-kicker">Un cadre lisible</p>
      <h2>{escape_text(_guide_section(snapshot, 'fonctionnement')['title'])}</h2>
      <ol class="method-list">{methods}</ol>
      <div class="notice">Les outils de diagnostic et de bilan renforcés ne sont pas présentés comme inclus avant validation de leur capacité opérationnelle.</div>
    </section>"""


def _subject_badge(snapshot: dict[str, Any], subject_id: str, level_id: str) -> str:
    subject = next(item for item in snapshot["subjects"] if item["id"] == subject_id)
    return (
        f'<span class="subject-label subject-{escape_text(subject_id)}">'
        f'<span aria-hidden="true">{escape_text(subject["abbreviation"])}</span> '
        f'{escape_text(subject["publicLabelByLevel"][level_id])}</span>'
    )


def _level_profile(snapshot: dict[str, Any], level_id: str) -> str:
    profile = snapshot["academicProfiles"].get(level_id)
    if not profile:
        return ""
    groups: list[str] = []
    for value in profile.values():
        if isinstance(value, list):
            groups.append(f'<li>{escape_text(", ".join(item["label"] for item in value))}</li>')
        elif isinstance(value, dict) and "options" in value:
            labels = ", ".join(item["label"] for item in value["options"])
            groups.append(f'<li>{escape_text(value["label"])} : {escape_text(labels)}</li>')
    return f'<div class="profile-note" role="note"><h3>Profils concernés</h3><ul>{"".join(groups)}</ul></div>'


def _level_schedule(snapshot: dict[str, Any], level_id: str) -> str:
    rows = []
    for week_index, week in enumerate(snapshot["schedule"]["weeks"]):
        for slot in week["slots"]:
            if slot["level"] != level_id:
                continue
            rows.append(
                f'<tr class="subject-{escape_text(slot["subjectId"])}" data-source-path="/schedule/weeks/{week_index}/slots">'
                f'<th scope="row">{_subject_badge(snapshot, slot["subjectId"], level_id)}</th>'
                f'<td>{escape_text(week["label"])}</td><td>{escape_text(slot["startTime"])}–{escape_text(slot["endTime"])}</td>'
                f'<td>{escape_text(slot["roomLabel"])}</td></tr>'
            )
    return f"""
    <table class="schedule-table"><caption>Planning du niveau — sous réserve de validation des affectations</caption><thead><tr>
      <th scope="col">Matière</th><th scope="col">Semaine</th><th scope="col">Horaire</th><th scope="col">Salle</th>
    </tr></thead><tbody>{''.join(rows)}</tbody></table>"""


def _session_card(module: dict[str, Any], session: dict[str, Any]) -> str:
    topics = "".join(f"<li>{escape_text(topic)}</li>" for topic in session["topics"])
    return f"""
    <article class="session-card" data-module-id="{escape_text(module['id'])}" data-session-number="{session['number']}">
      <header><span>Séance {session['number']}</span><h4>{escape_text(session['title'])}</h4></header>
      <dl><div><dt>Objectif</dt><dd>{escape_text(session['objective'])}</dd></div>
        <div><dt>Notions</dt><dd><ul>{topics}</ul></dd></div>
        <div><dt>Méthode</dt><dd>{escape_text(session['method'])}</dd></div>
        <div><dt>Livrable</dt><dd>{escape_text(session['deliverable'])}</dd></div></dl>
    </article>"""


def _program_module(snapshot: dict[str, Any], module: dict[str, Any], *, guide: bool) -> str:
    sessions = "".join(_session_card(module, session) for session in module["sessions"])
    heading = "h3" if guide else "h2"
    meta_heading = "h4" if guide else "h3"
    return f"""
    <article class="program-module subject-{escape_text(module['subjectId'])}{' guide-program' if guide else ''}" data-module-id="{escape_text(module['id'])}">
      <p class="subject-band">{_subject_badge(snapshot, module['subjectId'], module['level'])}</p>
      <{heading}>{escape_text(module['title'])}</{heading}><p class="module-subtitle">{escape_text(module['subtitle'])}</p>
      <div class="program-meta"><section><{meta_heading}>Prérequis</{meta_heading}><p>{escape_text(module['prerequisites'])}</p></section>
        <section><{meta_heading}>Différenciation</{meta_heading}><p>{escape_text(module['differentiation'])}</p></section>
        <section><{meta_heading}>Évaluation rapide</{meta_heading}><p>{escape_text(module['quickAssessment'])}</p></section></div>
      <div class="session-list">{sessions}</div>
    </article>"""


def _level_guides(snapshot: dict[str, Any]) -> str:
    rendered = []
    for level in snapshot["levels"]:
        modules = [module for module in snapshot["modules"] if module["level"] == level["id"]]
        summaries = "".join(
            f'<tr><th scope="row">{_subject_badge(snapshot, module["subjectId"], level["id"])}</th>'
            f'<td>{escape_text(module["sessions"][0]["objective"])}</td><td>{escape_text(module["sessions"][-1]["deliverable"])}</td></tr>'
            for module in modules
        )
        rendered.append(f"""
        <article class="level-guide" data-level="{escape_text(level['id'])}">
          <header class="level-intro"><p class="section-kicker">Choisir son parcours</p><h2>{escape_text(level['label'])}</h2></header>
          {_level_profile(snapshot, level['id'])}{_level_schedule(snapshot, level['id'])}
          <table class="level-summary"><caption>Objectifs en un regard</caption><thead><tr><th scope="col">Matière</th><th scope="col">Point de départ</th><th scope="col">Aboutissement</th></tr></thead><tbody>{summaries}</tbody></table>
          {''.join(_program_module(snapshot, module, guide=True) for module in modules)}
        </article>""")
    return f'<section id="catalogue" class="programs-section"><h2>{escape_text(_guide_section(snapshot, "catalogue")["title"])}</h2>{"".join(rendered)}</section>'


def _global_planning(snapshot: dict[str, Any]) -> str:
    weeks = []
    for week_index, week in enumerate(snapshot["schedule"]["weeks"]):
        subjects = []
        for subject_id in dict.fromkeys(slot["subjectId"] for slot in week["slots"]):
            subject = next(item for item in snapshot["subjects"] if item["id"] == subject_id)
            subjects.append(
                f'<li class="subject-{escape_text(subject_id)}" data-source-path="/schedule/weeks/{week_index}"><span class="subject-code">{escape_text(subject["abbreviation"])}</span> {escape_text(subject["label"])}</li>'
            )
        weeks.append(f'<article class="week-card"><h3>{escape_text(week["label"])}</h3><ul>{"".join(subjects)}</ul></article>')
    detailed = "".join(
        f'<section><h3>{escape_text(level["label"])}</h3>{_level_schedule(snapshot, level["id"])}</section>'
        for level in snapshot["levels"]
    )
    gates = snapshot["campaign"]["operationalGates"]
    validated = gates["roomAssignmentsValidated"] and gates["teacherAssignmentsValidated"]
    status = "Planning validé" if validated else "Planning de revue — affectations finales non validées"
    return f"""
    <section id="planning" class="page-section"><p class="section-kicker">Deux semaines complémentaires</p>
      <h2>{escape_text(_guide_section(snapshot, 'planning')['title'])}</h2>
      <p class="planning-status" role="note">{escape_text(status)}</p>
      {_evidenced_text(snapshot, 'planning', 'semaine-une')}{_evidenced_text(snapshot, 'planning', 'semaine-deux')}
      <div class="week-grid">{''.join(weeks)}</div><div class="detailed-schedules">{detailed}</div>
      <p class="notice" data-source-path="/content/practical/groupCompositionNotice">{escape_text(snapshot['content']['practical']['groupCompositionNotice'])}</p>
    </section>"""


def _pricing_rows(rows: list[dict[str, Any]]) -> str:
    return "".join(
        f'<tr data-source-path="/offerPricing"><th scope="row">{row["subjectCount"]} {"matière" if row["subjectCount"] == 1 else "matières"}</th>'
        f'<td>{row["totalHours"]} h</td><td>{amount_html(row["price"])}</td><td>{amount_html(row["deposit"])}</td>'
        f'<td>{amount_html(row["balance"])}</td><td>{amount_html(row["pricePerHour"], "TND/h")}</td></tr>'
        for row in rows
    )


def _pricing(snapshot: dict[str, Any]) -> str:
    deposit_percent = round(snapshot["offers"]["depositRate"] * 100)
    foundation_tables = []
    foundation_level_ids = [
        offer["level"] for offer in snapshot["offers"]["levels"] if offer["range"] == "FONDATIONS"
    ]
    for level_id in foundation_level_ids:
        level = next(item for item in snapshot["levels"] if item["id"] == level_id)
        rows = [item for item in snapshot["offerPricing"] if item["level"] == level_id]
        foundation_tables.append(f"""
        <section class="pricing-range"><h3>Nexus Fondations · {escape_text(level['label'])}</h3>
          <table class="tariffs-table"><caption>Tarifs Fondations selon les matières choisies</caption><thead><tr>
          <th scope="col">Formule</th><th scope="col">Volume</th><th scope="col">Prix</th><th scope="col">Acompte {deposit_percent} %</th><th scope="col">Solde</th><th scope="col">Prix horaire</th>
          </tr></thead><tbody>{_pricing_rows(rows)}</tbody></table></section>""")
    premium_level = next(
        offer["level"] for offer in snapshot["offers"]["levels"] if offer["range"] == "PREMIUM"
    )
    premium_rows = [item for item in snapshot["offerPricing"] if item["level"] == premium_level]
    premium_labels = " et ".join(
        next(level["label"] for level in snapshot["levels"] if level["id"] == offer["level"])
        for offer in snapshot["offers"]["levels"] if offer["range"] == "PREMIUM"
    )
    return f"""
    <section id="tarifs" class="page-section"><p class="section-kicker">Des montants calculés depuis le parcours validé</p>
      <h2>{escape_text(_guide_section(snapshot, 'tarifs')['title'])}</h2>{''.join(foundation_tables)}
      <section class="pricing-range"><h3>Nexus Premium · {escape_text(premium_labels)}</h3>
        <table class="tariffs-table"><caption>Tarifs Premium selon le nombre de matières</caption><thead><tr>
        <th scope="col">Formule</th><th scope="col">Volume</th><th scope="col">Prix</th><th scope="col">Acompte {deposit_percent} %</th><th scope="col">Solde</th><th scope="col">Prix horaire</th>
        </tr></thead><tbody>{_pricing_rows(premium_rows)}</tbody></table></section>
      {_evidenced_text(snapshot, 'tarifs', 'acompte-exact')}
    </section>"""


def _procedure(snapshot: dict[str, Any]) -> str:
    section = _guide_section(snapshot, "reservation")
    block = _guide_block(snapshot, "reservation", "reservation-etapes")
    steps = "".join(
        f'<li data-source-path="{_source_attr(*step["evidenceRefs"])}"><span>{index}</span><p>{escape_text(step["text"])}</p></li>'
        for index, step in enumerate(block["steps"], start=1)
    )
    return f"""
    <section id="reservation" class="page-section"><p class="section-kicker">Une démarche en {len(block['steps'])} étapes</p>
      <h2>{escape_text(section['title'])}</h2><ol class="procedure">{steps}</ol>
      <div class="notice-stack">{_claim(snapshot, 'pre-registration')}{_claim(snapshot, 'no-online-payment')}{_evidenced_text(snapshot, 'reservation', 'conditions-manquantes')}</div>
    </section>"""


def _manuals(snapshot: dict[str, Any]) -> str:
    eligible = [
        item for item in snapshot["manuals"]["manuals"]
        if item["printReady"] and item["ownerApproved"] and item["stockReady"]
    ]
    if eligible:
        cards = "".join(f'<li>{escape_text(item["subject"])} · {escape_text(item["level"])}</li>' for item in eligible)
        copy = f'<p>Les manuels suivants sont confirmés :</p><ul>{cards}</ul>'
    else:
        copy = '<p>Aucun manuel n’est annoncé comme offert dans ce document de revue.</p>'
    return f'<section id="manuels" class="page-section"><h2>{escape_text(_guide_section(snapshot, "manuels")["title"])}</h2>{copy}{_evidenced_text(snapshot, "manuels", "manuels-bloques")}</section>'


def _practical(snapshot: dict[str, Any]) -> str:
    campaign = snapshot["campaign"]
    materials = "".join(
        f'<article class="material-card subject-{escape_text(subject_id)}" data-claim-id="material-{escape_text(subject_id.lower().replace("_", "-"))}"><h3>{escape_text(item["label"])}</h3><p>{escape_text(item["description"])}</p></article>'
        for subject_id, item in snapshot["content"]["practical"]["materialsBySubject"].items()
    )
    return f"""
    <section id="pratique" class="page-section"><p class="section-kicker">Préparer la venue de son enfant</p>
      <h2>{escape_text(_guide_section(snapshot, 'pratique')['title'])}</h2>
      <div class="practical-address" data-source-path="/contact/address"><h3>Lieu</h3><p>{escape_text(campaign['venue']['name'])}<br>{escape_text(snapshot['contact']['address'])}</p></div>
      {_claim(snapshot, 'material')}<div class="material-grid">{materials}</div>
      {_claim(snapshot, 'adaptation-notice', class_name='adaptation-notice')}
      {_claim(snapshot, 'recording-consent', class_name='recording-notice')}
    </section>"""


def _faq(snapshot: dict[str, Any]) -> str:
    entries = "".join(
        f'<details data-source-path="/content/faq/{index}"><summary>{escape_text(item["question"])}</summary><p>{escape_text(item["answer"])}</p></details>'
        for index, item in enumerate(snapshot["content"]["faq"])
    )
    return f'<section id="faq" class="page-section"><p class="section-kicker">Réponses utiles</p><h2>{escape_text(_guide_section(snapshot, "faq")["title"])}</h2><div class="faq-list">{entries}</div></section>'


def _final_contact(snapshot: dict[str, Any]) -> str:
    contact = snapshot["contact"]
    campaign = snapshot["campaign"]
    return f"""
    <section id="contact" class="final-contact" data-source-path="{_source_attr('/contact', '/campaign', '/cta')}">
      {_claim(snapshot, 'public-cta', 'h2')}
      <p>{escape_text(_format_date(campaign['startDate'], year=False))} au {escape_text(_format_date(campaign['endDate']))} · {escape_text(campaign['venue']['neighborhood'])}, {escape_text(campaign['venue']['city'])}</p>
      <div class="contact-grid"><img class="qr" src="../ASSETS/qr-canonical.png" alt="QR code vers la page des stages Nexus Réussite"><address>
        <a href="{safe_url('tel:' + contact['phoneRaw'])}">{escape_text(contact['phone'])}</a><br>
        <a href="{safe_url('mailto:' + contact['email'])}">{escape_text(contact['email'])}</a><br>
        <a href="{safe_url(contact['canonicalUrl'])}">{escape_text(contact['canonicalUrl'])}</a>
      </address></div>
    </section>"""


def _document(snapshot: dict[str, Any], filename: str, title: str, short_title: str, body: str, nav: tuple[tuple[str, str], ...], *, body_class: str = "") -> HtmlDocument:
    return HtmlDocument(
        filename, title, short_title,
        _shell(snapshot, title, short_title, body, snapshot["content"]["hero"]["subtitle"], nav, body_class=body_class),
    )


def _parent_guide(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    nav = (
        ("essentiel", "L’essentiel"), ("offres", "Fondations ou Premium"),
        ("fonctionnement", "La méthode"), ("catalogue", "Programmes"),
        ("planning", "Planning"), ("tarifs", "Tarifs"),
        ("reservation", "Réservation"), ("pratique", "Informations pratiques"),
        ("faq", "FAQ"), ("contact", "Contact"),
    )
    toc = "".join(f'<li><a href="#{anchor}">{escape_text(label)}</a></li>' for anchor, label in nav)
    body = (
        _cover(snapshot)
        + f'<section id="sommaire" class="toc page-section"><p class="section-kicker">Repères</p><h2>Sommaire</h2><ol>{toc}</ol></section>'
        + _essentials(snapshot) + _offers_comparison(snapshot) + _pedagogy(snapshot)
        + _level_guides(snapshot) + _global_planning(snapshot) + _pricing(snapshot)
        + _procedure(snapshot) + _manuals(snapshot) + _practical(snapshot) + _faq(snapshot) + _final_contact(snapshot)
    )
    return _document(snapshot, filename, "Guide Parents — Stages de pré-rentrée 2026", "Guide Parents · Pré-rentrée 2026", body, nav, body_class="parent-guide")


def _brochure(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    nav = (("essentiel", "L’essentiel"), ("offres", "Les offres"), ("tarifs", "Tarifs"), ("reservation", "Réservation"), ("contact", "Contact"))
    body = _cover(snapshot) + _essentials(snapshot) + _offers_comparison(snapshot) + _pedagogy(snapshot) + _pricing(snapshot) + _procedure(snapshot) + _final_contact(snapshot)
    return _document(snapshot, filename, "Brochure Parents — Pré-rentrée 2026", "Brochure Parents", body, nav, body_class="short-brochure")


def _essential(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    nav = (("essentiel", "L’essentiel"), ("contact", "Contact"))
    return _document(snapshot, filename, "Pré-rentrée 2026 — L’essentiel", "L’essentiel", _cover(snapshot) + _essentials(snapshot) + _final_contact(snapshot), nav)


def _comparison(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    nav = (("offres", "Fondations ou Premium"), ("tarifs", "Tarifs"), ("contact", "Contact"))
    body = '<section class="annex-title"><h1>Fondations ou Premium ?</h1></section>' + _offers_comparison(snapshot) + _pricing(snapshot) + _final_contact(snapshot)
    return _document(snapshot, filename, "Fondations ou Premium — Pré-rentrée 2026", "Fondations ou Premium", body, nav)


def _planning_annex(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    body = '<section class="annex-title"><h1>Planning des stages de pré-rentrée 2026</h1></section>' + _global_planning(snapshot)
    return _document(snapshot, filename, "Planning — Stages de pré-rentrée 2026", "Planning", body, (("planning", "Planning"),))


def _program_annex(snapshot: dict[str, Any], level_id: str, filename: str) -> HtmlDocument:
    level = next(item for item in snapshot["levels"] if item["id"] == level_id)
    modules = [module for module in snapshot["modules"] if module["level"] == level_id]
    body = f'<section id="programmes" class="programs-section"><h1>Programmes · {escape_text(level["label"])}</h1>{"".join(_program_module(snapshot, module, guide=False) for module in modules)}{_claim(snapshot, "adaptation-notice", class_name="adaptation-notice")}{_claim(snapshot, "recording-consent", class_name="recording-notice")}</section>'
    title = f'Programmes — {level["label"]}'
    return _document(snapshot, filename, title, f'Programmes · {level["label"]}', body, (("programmes", "Programmes"),))


def _pricing_annex(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    body = '<section class="annex-title"><h1>Tarifs et réservation</h1></section>' + _pricing(snapshot) + _procedure(snapshot) + _final_contact(snapshot)
    nav = (("tarifs", "Tarifs"), ("reservation", "Réservation"), ("contact", "Contact"))
    return _document(snapshot, filename, "Tarifs et réservation — Pré-rentrée 2026", "Tarifs et réservation", body, nav)


def _faq_annex(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    body = '<section class="annex-title"><h1>Questions des parents</h1></section>' + _faq(snapshot) + _final_contact(snapshot)
    return _document(snapshot, filename, "FAQ Parents — Pré-rentrée 2026", "FAQ Parents", body, (("faq", "FAQ"), ("contact", "Contact")))


def render_public_documents(snapshot: dict[str, Any]) -> dict[str, HtmlDocument]:
    names = snapshot["document"]["outputs"]["publicHtml"]
    documents = (
        _parent_guide(snapshot, names["parentGuide"]),
        _brochure(snapshot, names["brochureParents"]),
        _essential(snapshot, names["essential"]),
        _comparison(snapshot, names["comparison"]),
        _pricing_annex(snapshot, names["pricingReservation"]),
        _program_annex(snapshot, "TROISIEME", names["programTroisieme"]),
        _program_annex(snapshot, "SECONDE", names["programSeconde"]),
        _program_annex(snapshot, "PREMIERE", names["programPremiere"]),
        _program_annex(snapshot, "TERMINALE", names["programTerminale"]),
        _planning_annex(snapshot, names["planning"]),
        _faq_annex(snapshot, names["faq"]),
    )
    return {document.filename: document for document in documents}
