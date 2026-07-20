"""Accessible family-facing HTML rendered exclusively from a validated snapshot."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable

from document_model import amount_html, claim_by_id, escape_text, format_amount, safe_url


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


def _claim(snapshot: dict[str, Any], claim_id: str, tag: str = "p", class_name: str = "") -> str:
    claim = claim_by_id(snapshot, claim_id)
    class_attr = f' class="{escape_text(class_name)}"' if class_name else ""
    return (
        f'<{tag}{class_attr} data-claim-id="{escape_text(claim_id)}">'
        f'{escape_text(claim["text"])}</{tag}>'
    )


def _source_attr(*paths: str) -> str:
    return escape_text(" ".join(paths))


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
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="author" content="Nexus Réussite">
  <meta name="description" content="{escape_text(description)}">
  <meta name="dcterms.created" content="{escape_text(snapshot['document']['documentEditionDate'])}">
  <meta name="dcterms.source" content="{escape_text(snapshot['sourceRepoSha'])}">
  <meta name="nexus:campaign-id" content="{escape_text(snapshot['campaign']['id'])}">
  <meta name="nexus:document-package-version" content="{escape_text(snapshot['document']['documentPackageVersion'])}">
  <title>{escape_text(title)}</title>
  <link rel="stylesheet" href="../ASSETS/document.css">
</head>
<body class="{escape_text(body_class)}">
  <a class="skip-link" href="#contenu">Aller au contenu</a>
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
    hero = snapshot["content"]["hero"]
    campaign = snapshot["campaign"]
    subjects = " · ".join(subject["label"] for subject in snapshot["subjects"])
    levels = ", ".join(level["label"].replace("Entrée en ", "") for level in snapshot["levels"])
    return f"""
    <section id="couverture" class="cover" data-source-path="{_source_attr('/campaign', '/levels', '/subjects', '/contact')}">
      <img class="cover-logo" src="../ASSETS/logo-slogan.png" alt="Nexus Réussite">
      <p class="eyebrow">{escape_text(campaign['venue']['neighborhood'])}, {escape_text(campaign['venue']['city'])}</p>
      <h1>{escape_text(hero['h1'])}</h1>
      <p class="cover-levels">{escape_text(levels)}</p>
      <p class="cover-dates">{escape_text(_format_date(campaign['startDate'], year=False))} — {escape_text(_format_date(campaign['endDate']))}</p>
      <p class="cover-subjects">{escape_text(subjects)}</p>
      <div class="cover-action">
        <img class="qr" src="../ASSETS/qr-canonical.png" alt="QR code vers la page de pré-inscription Nexus Réussite">
        <p><strong>{escape_text(snapshot['cta']['primary'])}</strong><br>
        <a href="{safe_url('tel:' + snapshot['contact']['phoneRaw'])}">{escape_text(snapshot['contact']['phone'])}</a></p>
      </div>
    </section>"""


def _guide_section(snapshot: dict[str, Any], section_id: str) -> dict[str, Any]:
    matching = [section for section in snapshot["parentGuide"]["sections"] if section["id"] == section_id]
    if len(matching) != 1:
        raise KeyError(f"Missing or duplicate parent-guide section: {section_id}")
    return matching[0]


def _evidenced_text(snapshot: dict[str, Any], section_id: str, block_id: str) -> str:
    section = _guide_section(snapshot, section_id)
    matching = [block for block in section["blocks"] if block["id"] == block_id]
    if len(matching) != 1:
        raise KeyError(f"Missing or duplicate parent-guide block: {section_id}/{block_id}")
    block = matching[0]
    if block["kind"] != "EVIDENCED_TEXT" or not block["evidenceRefs"]:
        raise ValueError(f"Parent-guide block is not evidenced text: {section_id}/{block_id}")
    if capability_id := block.get("capabilityId"):
        capabilities = {item["id"]: item for item in snapshot["parentGuide"]["capabilities"]}
        capability = capabilities[capability_id]
        if not capability["publiclyCommitted"]:
            raise ValueError(f"Capability is not publicly committed: {capability_id}")
    return (
        f'<p data-editorial-block="{escape_text(block_id)}" '
        f'data-source-path="{_source_attr(*block["evidenceRefs"])}">{escape_text(block["text"])}</p>'
    )


def _essentials(snapshot: dict[str, Any]) -> str:
    campaign = snapshot["campaign"]
    pack = snapshot["packs"][0]
    min_price = min(item["price"] for item in snapshot["packs"])
    max_price = max(item["price"] for item in snapshot["packs"])
    cards = (
        ("Dates", f'{_format_date(campaign["startDate"], year=False)} au {_format_date(campaign["endDate"])}'),
        ("Niveaux", " · ".join(level["label"] for level in snapshot["levels"])),
        ("Matières", " · ".join(subject["label"] for subject in snapshot["subjects"])),
        ("Format", f'{pack["sessionsPerSubject"]} séances de {pack["sessionDurationHours"]} h · {pack["hoursPerSubject"]} h par matière'),
        ("Groupes", f'{campaign["capacity"]["min"]} à {campaign["capacity"]["max"]} élèves'),
        ("Lieu", f'{campaign["venue"]["name"]} · {campaign["venue"]["neighborhood"]}, {campaign["venue"]["city"]}'),
        ("Tarifs", f'{format_amount(min_price)} à {format_amount(max_price)} TND'),
        ("Décision des groupes", claim_by_id(snapshot, "decision-deadline")["text"]),
    )
    rendered = "".join(
        f'<article class="fact-card"><h3>{escape_text(label)}</h3><p>{escape_text(value)}</p></article>'
        for label, value in cards
    )
    return f"""
    <section id="essentiel" class="page-section" data-source-path="{_source_attr('/campaign', '/levels', '/subjects', '/packs', '/contact')}">
      <p class="section-kicker">En un regard</p><h2>{escape_text(_guide_section(snapshot, 'essentiel')['title'])}</h2>
      {_evidenced_text(snapshot, 'essentiel', 'une-matiere-une-semaine')}
      <div class="fact-grid">{rendered}</div>
      <div class="notice">{_claim(snapshot, 'pre-registration')}</div>
    </section>"""


def _pedagogy(snapshot: dict[str, Any]) -> str:
    methods = "".join(
        f'<li data-claim-id="method-{index}"><span>{index}</span><div><h3>{escape_text(item["title"])}</h3><p>{escape_text(item["description"])}</p></div></li>'
        for index, item in enumerate(snapshot["content"]["method"], start=1)
    )
    committed = [
        item["publicLabel"] for item in snapshot["parentGuide"]["capabilities"]
        if item["publiclyCommitted"] and item["publicLabel"]
    ]
    capability_list = "".join(f"<li>{escape_text(label)}</li>" for label in committed)
    return f"""
    <section id="pourquoi" class="page-section">
      <p class="section-kicker">Reprendre le rythme avec méthode</p>
      <h2>{escape_text(_guide_section(snapshot, 'pourquoi')['title'])}</h2>
      {_evidenced_text(snapshot, 'pourquoi', 'reprise-progressive')}
    </section>
    <section id="fonctionnement" class="page-section">
      <p class="section-kicker">Un cadre lisible</p>
      <h2>{escape_text(_guide_section(snapshot, 'fonctionnement')['title'])}</h2>
      {_evidenced_text(snapshot, 'fonctionnement', 'methode-pedagogique')}
      <ol class="method-list">{methods}</ol>
      <h3>Ce que l’accompagnement prévoit</h3><ul class="check-list">{capability_list}</ul>
    </section>"""


def _subject_badge(snapshot: dict[str, Any], subject_id: str, level_id: str) -> str:
    subject = next(item for item in snapshot["subjects"] if item["id"] == subject_id)
    return (
        f'<span class="subject-label subject-{escape_text(subject_id)}">'
        f'<span aria-hidden="true">{escape_text(subject["abbreviation"])}</span> '
        f'{escape_text(subject["publicLabelByLevel"][level_id])}</span>'
    )


def _level_profile(snapshot: dict[str, Any], level_id: str) -> str:
    profile = snapshot["academicProfiles"][level_id]
    if not profile:
        return ""
    groups: list[str] = []
    for key, value in profile.items():
        if isinstance(value, list):
            labels = ", ".join(item["label"] for item in value)
            groups.append(f"<li>{escape_text(labels)}</li>")
        elif isinstance(value, dict) and "options" in value:
            labels = ", ".join(item["label"] for item in value["options"])
            groups.append(f'<li>{escape_text(value["label"])} : {escape_text(labels)}</li>')
    return f'<aside class="profile-note"><h3>Profil déclaré</h3><ul>{"".join(groups)}</ul></aside>'


def _level_schedule(snapshot: dict[str, Any], level_id: str) -> str:
    rows = []
    for week in snapshot["schedule"]["weeks"]:
        for slot in week["slots"]:
            if slot["level"] != level_id:
                continue
            rows.append(
                f'<tr class="subject-{escape_text(slot["subjectId"])}" data-source-path="/schedule/weeks/{week["week"] - 1}/slots">'
                f'<th scope="row">{_subject_badge(snapshot, slot["subjectId"], level_id)}</th>'
                f'<td>{escape_text(week["label"])}</td><td>{escape_text(slot["startTime"])}–{escape_text(slot["endTime"])}</td>'
                f'<td>{escape_text(slot["roomLabel"])}</td></tr>'
            )
    return f"""
    <table class="schedule-table"><caption>Planning du niveau</caption><thead><tr>
      <th scope="col">Matière</th><th scope="col">Semaine</th><th scope="col">Horaire</th><th scope="col">Salle</th>
    </tr></thead><tbody>{''.join(rows)}</tbody></table>"""


def _session_card(module: dict[str, Any], session: dict[str, Any]) -> str:
    topics = "".join(f"<li>{escape_text(topic)}</li>" for topic in session["topics"])
    return f"""
    <article class="session-card" data-module-id="{escape_text(module['id'])}" data-session-number="{session['number']}">
      <header><span>Séance {session['number']}</span><h4>{escape_text(session['title'])}</h4></header>
      <dl>
        <div><dt>Objectif</dt><dd>{escape_text(session['objective'])}</dd></div>
        <div><dt>Notions</dt><dd><ul>{topics}</ul></dd></div>
        <div><dt>Méthode</dt><dd>{escape_text(session['method'])}</dd></div>
        <div><dt>Livrable</dt><dd>{escape_text(session['deliverable'])}</dd></div>
      </dl>
    </article>"""


def _program_module(snapshot: dict[str, Any], module: dict[str, Any], *, guide: bool) -> str:
    sessions = "".join(_session_card(module, session) for session in module["sessions"])
    extra_class = " guide-program" if guide else ""
    heading = "h3" if guide else "h2"
    meta_heading = "h4" if guide else "h3"
    return f"""
    <article class="program-module subject-{escape_text(module['subjectId'])}{extra_class}" data-module-id="{escape_text(module['id'])}">
      <p class="subject-band">{_subject_badge(snapshot, module['subjectId'], module['level'])}</p>
      <{heading}>{escape_text(module['title'])}</{heading}><p class="module-subtitle">{escape_text(module['subtitle'])}</p>
      <div class="program-meta">
        <section><{meta_heading}>Prérequis</{meta_heading}><p>{escape_text(module['prerequisites'])}</p></section>
        <section><{meta_heading}>Différenciation</{meta_heading}><p>{escape_text(module['differentiation'])}</p></section>
        <section><{meta_heading}>Évaluation rapide</{meta_heading}><p>{escape_text(module['quickAssessment'])}</p></section>
      </div>
      <div class="session-list">{sessions}</div>
    </article>"""


def _level_guides(snapshot: dict[str, Any]) -> str:
    rendered = []
    for level in snapshot["levels"]:
        modules = [module for module in snapshot["modules"] if module["level"] == level["id"]]
        summary_rows = "".join(
            f'<tr class="subject-{escape_text(module["subjectId"])}"><th scope="row">{_subject_badge(snapshot, module["subjectId"], level["id"])}</th>'
            f'<td>{escape_text(module["sessions"][0]["objective"])}</td><td>{escape_text(module["sessions"][-1]["deliverable"])}</td></tr>'
            for module in modules
        )
        programs = "".join(_program_module(snapshot, module, guide=True) for module in modules)
        rendered.append(f"""
        <article class="level-guide" data-level="{escape_text(level['id'])}">
          <header class="level-intro"><p class="section-kicker">Choisir son parcours</p><h2>{escape_text(level['label'])}</h2>
          <p>{escape_text(modules[0]['subtitle'])}</p></header>
          {_level_profile(snapshot, level['id'])}
          {_level_schedule(snapshot, level['id'])}
          <table class="level-summary"><caption>Objectifs en un regard</caption><thead><tr><th scope="col">Matière</th><th scope="col">Point de départ</th><th scope="col">Aboutissement</th></tr></thead><tbody>{summary_rows}</tbody></table>
          {programs}
        </article>""")
    return f'<section id="parcours" class="programs-section"><h2>{escape_text(_guide_section(snapshot, "parcours")["title"])}</h2>{"".join(rendered)}</section>'


def _global_planning(snapshot: dict[str, Any]) -> str:
    weeks = []
    for week_index, week in enumerate(snapshot["schedule"]["weeks"]):
        subjects = []
        for subject_id in dict.fromkeys(slot["subjectId"] for slot in week["slots"]):
            subject = next(item for item in snapshot["subjects"] if item["id"] == subject_id)
            subjects.append(
                f'<li class="subject-{escape_text(subject_id)}"><span class="subject-code">{escape_text(subject["abbreviation"])}</span> {escape_text(subject["label"])}</li>'
            )
        weeks.append(
            f'<article class="week-card" data-source-path="/schedule/weeks/{week_index}"><h3>{escape_text(week["label"])}</h3><ul>{"".join(subjects)}</ul></article>'
        )
    detailed = "".join(
        f'<section><h3>{escape_text(level["label"])}</h3>{_level_schedule(snapshot, level["id"])}</section>'
        for level in snapshot["levels"]
    )
    return f"""
    <section id="planning" class="page-section">
      <p class="section-kicker">Deux semaines complémentaires</p><h2>{escape_text(_guide_section(snapshot, 'planning')['title'])}</h2>
      {_evidenced_text(snapshot, 'planning', 'repartition-semaines')}
      <div class="week-grid">{''.join(weeks)}</div><div class="detailed-schedules">{detailed}</div>
      <p class="notice" data-source-path="/content/practical/groupCompositionNotice">{escape_text(snapshot['content']['practical']['groupCompositionNotice'])}</p>
    </section>"""


def _pricing_table(snapshot: dict[str, Any]) -> str:
    rows = "".join(
        f'<tr data-source-path="/packs/{index}"><th scope="row">{pack["subjectCount"]} {"matière" if pack["subjectCount"] == 1 else "matières"}</th>'
        f'<td>{pack["totalHours"]} h</td><td>{amount_html(pack["price"])}</td><td>{amount_html(pack["deposit"])}</td>'
        f'<td>{amount_html(pack["balance"])}</td><td>{amount_html(pack["pricePerHour"], "TND/h")}</td></tr>'
        for index, pack in enumerate(snapshot["packs"])
    )
    return f"""
    <table class="tariffs-table"><caption>Formules selon le nombre de matières validées</caption><thead><tr>
      <th scope="col">Formule</th><th scope="col">Volume</th><th scope="col">Prix</th><th scope="col">Acompte</th><th scope="col">Solde</th><th scope="col">Prix horaire</th>
    </tr></thead><tbody>{rows}</tbody></table>"""


def _pricing(snapshot: dict[str, Any]) -> str:
    pack = snapshot["packs"][0]
    return f"""
    <section id="tarifs" class="page-section"><p class="section-kicker">Une formule calculée selon les matières</p>
      <h2>{escape_text(_guide_section(snapshot, 'tarifs')['title'])}</h2>{_pricing_table(snapshot)}
      <div class="format-summary" data-source-path="/packs/0">
        <p><strong>{pack['sessionsPerSubject']} séances par matière</strong><br>{pack['sessionDurationHours']} h par séance · {pack['hoursPerSubject']} h par matière</p>
      </div>
      <p class="notice">L’acompte est demandé après validation du profil et du groupe. Les montants affichés sont ceux du pack validé.</p>
    </section>"""


def _procedure(snapshot: dict[str, Any]) -> str:
    section = _guide_section(snapshot, "pre-inscription")
    block = next(item for item in section["blocks"] if item["id"] == "procedure-confirmation")
    steps = "".join(
        f'<li data-source-path="{_source_attr(*step["evidenceRefs"])}"><span>{index}</span><p>{escape_text(step["text"])}</p></li>'
        for index, step in enumerate(block["steps"], start=1)
    )
    return f"""
    <section id="pre-inscription" class="page-section"><p class="section-kicker">Une démarche sans paiement initial</p>
      <h2>{escape_text(section['title'])}</h2><ol class="procedure">{steps}</ol>
      <div class="notice-stack">{_claim(snapshot, 'pre-registration')}{_claim(snapshot, 'no-online-payment')}{_claim(snapshot, 'group-composition')}{_claim(snapshot, 'group-size')}{_claim(snapshot, 'decision-deadline')}</div>
    </section>"""


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
      <p class="adaptation-notice" data-claim-id="adaptation-notice">{escape_text(snapshot['content']['adaptationNotice'])}</p>
      <p class="recording-notice" data-claim-id="recording-consent">{escape_text(snapshot['content']['recordingConsentNotice'])}</p>
    </section>"""


def _faq(snapshot: dict[str, Any]) -> str:
    entries = "".join(
        f'<details data-source-path="/content/faq/{index}"><summary>{escape_text(item["question"])}</summary><p>{escape_text(item["answer"])}</p></details>'
        for index, item in enumerate(snapshot["content"]["faq"])
    )
    return f'<section id="faq" class="page-section"><p class="section-kicker">Réponses utiles</p><h2>{escape_text(_guide_section(snapshot, "faq")["title"])}</h2><div class="faq-list">{entries}</div></section>'


def _final_contact(snapshot: dict[str, Any], *, section_id: str = "contact") -> str:
    contact = snapshot["contact"]
    campaign = snapshot["campaign"]
    return f"""
    <section id="{escape_text(section_id)}" class="final-contact" data-source-path="{_source_attr('/contact', '/campaign', '/cta')}">
      {_claim(snapshot, 'public-cta', 'h2')}
      <p>{escape_text(_format_date(campaign['startDate'], year=False))} au {escape_text(_format_date(campaign['endDate']))} · {escape_text(campaign['venue']['neighborhood'])}, {escape_text(campaign['venue']['city'])}</p>
      <div class="contact-grid"><img class="qr" src="../ASSETS/qr-canonical.png" alt="QR code vers la page de pré-inscription Nexus Réussite"><address>
        <a href="{safe_url('tel:' + contact['phoneRaw'])}">{escape_text(contact['phone'])}</a><br>
        <a href="{safe_url('mailto:' + contact['email'])}">{escape_text(contact['email'])}</a><br>
        <a href="{safe_url(contact['canonicalUrl'])}">{escape_text(contact['canonicalUrl'])}</a>
      </address></div>
    </section>"""


def _parent_guide(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    toc_entries = [
        ("essentiel", _guide_section(snapshot, "essentiel")["title"]),
        ("fonctionnement", _guide_section(snapshot, "fonctionnement")["title"]),
        ("parcours", _guide_section(snapshot, "parcours")["title"]),
        ("planning", _guide_section(snapshot, "planning")["title"]),
        ("tarifs", _guide_section(snapshot, "tarifs")["title"]),
        ("pre-inscription", _guide_section(snapshot, "pre-inscription")["title"]),
        ("pratique", _guide_section(snapshot, "pratique")["title"]),
        ("faq", _guide_section(snapshot, "faq")["title"]),
        ("contact", _guide_section(snapshot, "contact")["title"]),
    ]
    toc = "".join(f'<li><a href="#{anchor}">{escape_text(label)}</a></li>' for anchor, label in toc_entries)
    body = (
        _cover(snapshot)
        + f'<section id="sommaire" class="toc page-section"><p class="section-kicker">Repères</p><h2>Sommaire</h2><ol>{toc}</ol></section>'
        + _essentials(snapshot)
        + _pedagogy(snapshot)
        + _level_guides(snapshot)
        + _global_planning(snapshot)
        + _pricing(snapshot)
        + _procedure(snapshot)
        + _practical(snapshot)
        + _faq(snapshot)
        + _final_contact(snapshot)
    )
    title = "Guide Parents — Stages de pré-rentrée 2026"
    return HtmlDocument(
        filename,
        title,
        "Guide Parents · Pré-rentrée 2026",
        _shell(snapshot, title, "Guide Parents · Pré-rentrée 2026", body, snapshot["content"]["hero"]["subtitle"], toc_entries, body_class="parent-guide"),
    )


def _essential_annex(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    body = _cover(snapshot) + _essentials(snapshot) + _pedagogy(snapshot) + _practical(snapshot) + _final_contact(snapshot)
    title = "Pré-rentrée 2026 — L’essentiel"
    nav = (("essentiel", "L’essentiel"), ("fonctionnement", "La méthode"), ("pratique", "Informations pratiques"), ("contact", "Contact"))
    return HtmlDocument(filename, title, "L’essentiel", _shell(snapshot, title, "L’essentiel", body, snapshot["content"]["hero"]["subtitle"], nav))


def _planning_annex(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    title = "Planning — Stages de pré-rentrée 2026"
    body = f'<section class="annex-title"><h1>{escape_text(title)}</h1></section>' + _global_planning(snapshot)
    return HtmlDocument(filename, title, "Planning", _shell(snapshot, title, "Planning", body, snapshot["content"]["hero"]["subtitle"], (("planning", "Planning"),)))


def _program_annex(snapshot: dict[str, Any], level_id: str, filename: str) -> HtmlDocument:
    level = next(item for item in snapshot["levels"] if item["id"] == level_id)
    modules = [module for module in snapshot["modules"] if module["level"] == level_id]
    body = f'<section id="programmes" class="programs-section"><h1>Programmes · {escape_text(level["label"])}</h1>{"".join(_program_module(snapshot, module, guide=False) for module in modules)}<p class="adaptation-notice" data-claim-id="adaptation-notice">{escape_text(snapshot["content"]["adaptationNotice"])}</p><p class="recording-notice" data-claim-id="recording-consent">{escape_text(snapshot["content"]["recordingConsentNotice"])}</p></section>'
    title = f'Programmes — {level["label"]}'
    return HtmlDocument(filename, title, f'Programmes · {level["label"]}', _shell(snapshot, title, f'Programmes · {level["label"]}', body, snapshot["content"]["hero"]["subtitle"], (("programmes", "Programmes"),)))


def _pricing_annex(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    title = "Tarifs des stages de pré-rentrée 2026"
    body = f'<section class="annex-title"><h1>{escape_text(title)}</h1></section>' + _pricing(snapshot) + _procedure(snapshot)
    return HtmlDocument(filename, title, "Tarifs", _shell(snapshot, title, "Tarifs", body, snapshot["content"]["hero"]["subtitle"], (("tarifs", "Tarifs"), ("pre-inscription", "Pré-inscription"))))


def render_public_documents(snapshot: dict[str, Any]) -> dict[str, HtmlDocument]:
    names = snapshot["document"]["outputs"]["publicHtml"]
    documents = (
        _parent_guide(snapshot, names["parentGuide"]),
        _essential_annex(snapshot, names["essential"]),
        _planning_annex(snapshot, names["planning"]),
        _program_annex(snapshot, "SECONDE", names["programSeconde"]),
        _program_annex(snapshot, "PREMIERE", names["programPremiere"]),
        _program_annex(snapshot, "TERMINALE", names["programTerminale"]),
        _pricing_annex(snapshot, names["pricing"]),
    )
    return {document.filename: document for document in documents}
