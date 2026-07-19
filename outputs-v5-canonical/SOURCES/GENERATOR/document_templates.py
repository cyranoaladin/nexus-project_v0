"""Semantic HTML documents rendered only from a validated publication snapshot."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable

from document_model import amount_html, claim_by_id, escape_text, safe_url


@dataclass(frozen=True)
class HtmlDocument:
    filename: str
    title: str
    html: str


class LegalPublicationBlocked(RuntimeError):
    pass


def _tag(name: str, content: Any, **attributes: str) -> str:
    serialized = "".join(f' {escape_text(key.replace("_", "-"))}="{escape_text(value)}"' for key, value in attributes.items())
    return f"<{name}{serialized}>{escape_text(content)}</{name}>"


def _claim(snapshot: dict[str, Any], claim_id: str, tag: str = "p", class_name: str = "") -> str:
    claim = claim_by_id(snapshot, claim_id)
    attributes = {"data_claim_id": claim_id}
    if class_name:
        attributes["class"] = class_name
    return _tag(tag, claim["text"], **attributes)


def _footer(snapshot: dict[str, Any]) -> str:
    source_short = snapshot["sourceRepoSha"][:8]
    contact = snapshot["contact"]
    meta = (
        f'{snapshot["document"]["version"]} · {snapshot["document"]["editDate"]} · '
        f'{snapshot["campaign"]["id"]} · {snapshot["document"]["publicClassification"]} · '
        f'{source_short}'
    )
    return f"""
    <footer>
      <span>{escape_text(meta)}</span>
      <span class="footer-contact">
        <a href="{safe_url('tel:' + contact['phoneRaw'])}">{escape_text(contact['phone'])}</a> ·
        <a href="{safe_url('mailto:' + contact['email'])}">{escape_text(contact['email'])}</a> ·
        <a href="{safe_url(contact['canonicalUrl'])}">{escape_text(contact['domain'])}</a>
      </span>
    </footer>
    """


def _shell(snapshot: dict[str, Any], title: str, body: str, description: str) -> str:
    contact = snapshot["contact"]
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="author" content="Nexus Réussite">
  <meta name="description" content="{escape_text(description)}">
  <meta name="dcterms.created" content="{escape_text(snapshot['generatedAt'])}">
  <meta name="dcterms.modified" content="{escape_text(snapshot['document']['editDate'])}">
  <meta name="nexus:campaign-id" content="{escape_text(snapshot['campaign']['id'])}">
  <meta name="nexus:source-repo-sha" content="{escape_text(snapshot['sourceRepoSha'])}">
  <meta name="nexus:classification" content="{escape_text(snapshot['document']['publicClassification'])}">
  <title>{escape_text(title)}</title>
  <link rel="stylesheet" href="../../SOURCES/CSS/document.css">
</head>
<body>
  <header class="document-header">
    <img src="../../SOURCES/ASSETS/logo-slogan.png" alt="Nexus Réussite">
    <div><strong>{escape_text(title)}</strong><br><span>{escape_text(snapshot['campaign']['id'])}</span></div>
    <span class="classification">{escape_text(snapshot['document']['publicClassification'])}</span>
  </header>
  <main>{body}</main>
  {_footer(snapshot)}
  <a class="screen-contact" href="{safe_url(contact['canonicalUrl'])}">Version en ligne accessible</a>
</body>
</html>
"""


def _format_iso_date(value: str) -> str:
    parsed = date.fromisoformat(value)
    return f"{parsed.day:02d}/{parsed.month:02d}/{parsed.year}"


def _essentiel(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    method = "".join(
        f'<li data-claim-id="method-{index}"><strong>{escape_text(item["title"])}</strong><br>{escape_text(item["description"])}</li>'
        for index, item in enumerate(snapshot["content"]["method"], start=1)
    )
    materials = "".join(
        f'<section class="material-card" data-claim-id="material-{escape_text(subject_id.lower().replace("_", "-"))}" data-source-path="/content/practical/materialsBySubject/{escape_text(subject_id)}">'
        f'<h3>{escape_text(item["label"])}</h3><p>{escape_text(item["description"])}</p></section>'
        for subject_id, item in snapshot["content"]["practical"]["materialsBySubject"].items()
    )
    body = f"""
    <section class="hero">
      <p class="eyebrow">{escape_text(snapshot['content']['hero']['eyebrow'])}</p>
      {_claim(snapshot, 'hero-title', 'h1')}
      {_claim(snapshot, 'hero-subtitle', 'p', 'lead')}
      <p class="date-band" data-source-path="/campaign">{escape_text(_format_iso_date(snapshot['campaign']['startDate']))} — {escape_text(_format_iso_date(snapshot['campaign']['endDate']))} · {escape_text(snapshot['campaign']['venue']['neighborhood'])}</p>
    </section>
    <section><h2>À qui s’adresse la pré-rentrée ?</h2>{_claim(snapshot, 'audience')}</section>
    <section><h2>La méthode Nexus</h2><ol class="method-grid">{method}</ol></section>
    <section><h2>Matériel et supports</h2>{_claim(snapshot, 'material')}<div class="card-grid">{materials}</div></section>
    <section class="safe-notices"><h2>Pré-inscription</h2>
      {_claim(snapshot, 'pre-registration')}
      {_claim(snapshot, 'no-online-payment')}
      {_claim(snapshot, 'group-composition')}
      {_claim(snapshot, 'group-size')}
      {_claim(snapshot, 'decision-deadline')}
    </section>
    <section class="cta">{_claim(snapshot, 'public-cta', 'h2')}
      <p><a href="{safe_url(snapshot['contact']['canonicalUrl'])}">{escape_text(snapshot['contact']['canonicalUrl'])}</a></p>
      <img class="qr" src="../../SOURCES/ASSETS/qr-canonical.png" alt="QR code vers la page canonique de pré-inscription">
    </section>
    """
    title = "Pré-rentrée — L’essentiel"
    return HtmlDocument(filename, title, _shell(snapshot, title, body, snapshot["content"]["hero"]["subtitle"]))


def _planning(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    sections: list[str] = []
    subject_lookup = {subject["id"]: subject for subject in snapshot["subjects"]}
    for level_index, level in enumerate(snapshot["levels"]):
        week_tables: list[str] = []
        for week in snapshot["schedule"]["weeks"]:
            rows = []
            for slot_index, slot in enumerate(week["slots"]):
                if slot["level"] != level["id"]:
                    continue
                subject = subject_lookup[slot["subjectId"]]
                dates = [
                    _format_iso_date(session["date"])
                    for session in snapshot["schedule"]["sessions"]
                    if session["week"] == week["week"]
                    and session["level"] == level["id"]
                    and session["subjectId"] == slot["subjectId"]
                ]
                rows.append(f"""
                <tr class="subject-{escape_text(slot['subjectId'])}" data-source-path="/schedule/weeks/{week['week'] - 1}/slots/{slot_index}">
                  <th scope="row"><span class="subject-code">{escape_text(subject['abbreviation'])}</span> {escape_text(slot['subjectLabel'])}</th>
                  <td>{escape_text(slot['startTime'])}–{escape_text(slot['endTime'])}</td>
                  <td>{escape_text(slot['roomLabel'])}</td>
                  <td>{escape_text(' · '.join(dates))}</td>
                </tr>""")
            week_tables.append(f"""
            <h3>{escape_text(week['label'])}</h3>
            <table>
              <thead><tr><th scope="col">Matière</th><th scope="col">Horaire</th><th scope="col">Salle</th><th scope="col">Dates</th></tr></thead>
              <tbody>{''.join(rows)}</tbody>
            </table>""")
        sections.append(f'<section class="level-planning" data-source-path="/levels/{level_index}"><h2>{escape_text(level["label"])}</h2>{"".join(week_tables)}</section>')
    legend = "".join(
        f'<li class="subject-{escape_text(subject["id"])}" data-source-path="/subjects/{index}"><span class="legend-swatch"></span><strong>{escape_text(subject["abbreviation"])}</strong> — {escape_text(subject["label"])}</li>'
        for index, subject in enumerate(snapshot["subjects"])
    )
    body = f"""
    <h1>Planning des séances</h1>
    <p class="lead">{escape_text(snapshot['content']['hero']['subtitle'])}</p>
    <section aria-labelledby="legend-title"><h2 id="legend-title">Légende des matières</h2><ul class="legend">{legend}</ul></section>
    {''.join(sections)}
    <section class="safe-notices"><h2>Composition des groupes</h2>{_claim(snapshot, 'group-composition')}{_claim(snapshot, 'group-size')}{_claim(snapshot, 'decision-deadline')}</section>
    """
    title = "Pré-rentrée — Planning"
    return HtmlDocument(filename, title, _shell(snapshot, title, body, "Planning canonique par classe et semaine"))


def _program_table(module: dict[str, Any]) -> str:
    rows = []
    for session in module["sessions"]:
        topics = "".join(f"<li>{escape_text(topic)}</li>" for topic in session["topics"])
        rows.append(f"""
        <tr data-session-number="{session['number']}">
          <th scope="row"><span class="session-number">{session['number']}</span><br>{escape_text(session['title'])}</th>
          <td>{escape_text(session['objective'])}</td>
          <td><ul>{topics}</ul></td>
          <td>{escape_text(session['method'])}</td>
          <td>{escape_text(session['deliverable'])}</td>
        </tr>""")
    return f"""
    <table class="program-table">
      <thead><tr><th scope="col">Séance et titre</th><th scope="col">Objectif</th><th scope="col">Notions</th><th scope="col">Méthode</th><th scope="col">Livrable</th></tr></thead>
      <tbody>{''.join(rows)}</tbody>
    </table>"""


def _program(snapshot: dict[str, Any], level_id: str, filename: str) -> HtmlDocument:
    level = next(level for level in snapshot["levels"] if level["id"] == level_id)
    modules = [
        (index, module)
        for index, module in enumerate(snapshot["modules"])
        if module["level"] == level_id
    ]
    sections = []
    for module_index, module in modules:
        sections.append(f"""
        <article class="program-module subject-{escape_text(module['subjectId'])}" data-source-path="/modules/{module_index}" data-module-id="{escape_text(module['id'])}">
          <div class="subject-band">{escape_text(module['subject'])}</div>
          <h2>{escape_text(module['title'])}</h2>
          <p class="lead">{escape_text(module['subtitle'])}</p>
          <div class="program-meta">
            <section><h3>Prérequis</h3><p>{escape_text(module['prerequisites'])}</p></section>
            <section><h3>Différenciation</h3><p>{escape_text(module['differentiation'])}</p></section>
            <section><h3>Évaluation rapide</h3><p>{escape_text(module['quickAssessment'])}</p></section>
          </div>
          {_program_table(module)}
        </article>""")
    body = f"""
    <h1>Programmes — {escape_text(level['label'])}</h1>
    {_claim(snapshot, 'adaptation-notice', 'p', 'adaptation-notice')}
    {_claim(snapshot, 'recording-consent', 'p', 'recording-notice')}
    {''.join(sections)}
    """
    title = f"Pré-rentrée — Programmes {level['label']}"
    return HtmlDocument(filename, title, _shell(snapshot, title, body, snapshot["content"]["adaptationNotice"]))


def _tarifs(snapshot: dict[str, Any], filename: str) -> HtmlDocument:
    reference_pack = snapshot["packs"][0]
    rows = "".join(
        f"""
        <tr data-source-path="/packs/{index}">
          <th scope="row">{escape_text(pack['subjectCount'])} matière{'s' if pack['subjectCount'] > 1 else ''}</th>
          <td>{escape_text(pack['totalHours'])}&nbsp;h</td>
          <td>{amount_html(pack['price'])}</td>
          <td>{amount_html(pack['deposit'])}</td>
          <td>{amount_html(pack['balance'])}</td>
          <td>{amount_html(pack['pricePerHour'], 'TND/h')}</td>
        </tr>"""
        for index, pack in enumerate(snapshot["packs"])
    )
    body = f"""
    <section class="tariffs-page">
      <h1>Tarifs canoniques</h1>
      <p class="lead">{escape_text(snapshot['campaign']['schoolYear'])} · {escape_text(snapshot['campaign']['venue']['neighborhood'])}</p>
      <table class="tariffs-table">
        <thead><tr><th scope="col">Formule</th><th scope="col">Volume</th><th scope="col">{escape_text(snapshot['labels']['price'])}</th><th scope="col">{escape_text(snapshot['labels']['deposit'])}</th><th scope="col">{escape_text(snapshot['labels']['balance'])}</th><th scope="col">Prix horaire</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      {_claim(snapshot, 'group-size')}
      <section class="format-summary" data-source-path="/packs/0">
        <h2>Repères de format</h2>
        <div class="format-grid">
          <p><strong>{escape_text(reference_pack['sessionsPerSubject'])}</strong><br>séances par matière</p>
          <p><strong>{escape_text(reference_pack['sessionDurationHours'])}&nbsp;h</strong><br>par séance</p>
          <p><strong>{escape_text(reference_pack['hoursPerSubject'])}&nbsp;h</strong><br>par matière</p>
        </div>
      </section>
      {_claim(snapshot, 'no-online-payment', 'p', 'safe-notices')}
    </section>
    <section class="approved-modalities page-break-before">
      <h2>Modalités publiques de pré-inscription</h2>
      {_claim(snapshot, 'pre-registration')}
      {_claim(snapshot, 'no-online-payment')}
      {_claim(snapshot, 'group-composition')}
      {_claim(snapshot, 'decision-deadline')}
      <div class="cta">{_claim(snapshot, 'public-cta', 'h2')}<p><a href="{safe_url(snapshot['contact']['canonicalUrl'])}">{escape_text(snapshot['contact']['canonicalUrl'])}</a></p></div>
    </section>
    """
    title = "Pré-rentrée — Tarifs"
    return HtmlDocument(filename, title, _shell(snapshot, title, body, "Tarifs et modalités publiques de pré-inscription"))


def render_public_documents(snapshot: dict[str, Any]) -> dict[str, HtmlDocument]:
    names = snapshot["document"]["outputs"]["publicHtml"]
    documents = (
        _essentiel(snapshot, names["essential"]),
        _planning(snapshot, names["planning"]),
        _program(snapshot, "SECONDE", names["programSeconde"]),
        _program(snapshot, "PREMIERE", names["programPremiere"]),
        _program(snapshot, "TERMINALE", names["programTerminale"]),
        _tarifs(snapshot, names["pricing"]),
    )
    return {document.filename: document for document in documents}


def _input(
    name: str,
    label: str,
    tab_index: int,
    input_type: str = "text",
    required: bool = False,
    readonly: bool = False,
    value: str = "",
    min_value: int | None = None,
    max_value: int | None = None,
    step: int | None = None,
    derived_from: str = "",
) -> str:
    required_markup = " required" if required else ""
    readonly_markup = " readonly" if readonly else ""
    value_markup = f' value="{escape_text(value)}"' if value else ""
    min_markup = f' min="{min_value}"' if min_value is not None else ""
    max_markup = f' max="{max_value}"' if max_value is not None else ""
    step_markup = f' step="{step}"' if step is not None else ""
    derived_markup = f' data-derived-from="{escape_text(derived_from)}"' if derived_from else ""
    return (
        f'<label>{escape_text(label)}<input type="{escape_text(input_type)}" '
        f'name="{escape_text(name)}" tabindex="{tab_index}"{required_markup}{readonly_markup}'
        f'{value_markup}{min_markup}{max_markup}{step_markup}{derived_markup}></label>'
    )


def _radio_group(name: str, label: str, tab_index: int) -> str:
    return f"""<fieldset><legend>{escape_text(label)}</legend>
      <label><input type="radio" name="{escape_text(name)}" value="yes" tabindex="{tab_index}"> Oui</label>
      <label><input type="radio" name="{escape_text(name)}" value="no" tabindex="{tab_index + 1}"> Non</label>
    </fieldset>"""


def _profile_options(options: Iterable[dict[str, Any]], name: str, start_tab: int, multiple: bool = False) -> str:
    input_type = "checkbox" if multiple else "radio"
    return "".join(
        f'<label><input type="{input_type}" name="{escape_text(name)}" value="{escape_text(option["id"])}" tabindex="{start_tab + index}"> {escape_text(option["label"])}</label>'
        for index, option in enumerate(options)
    )


def render_private_structural_template(snapshot: dict[str, Any]) -> str:
    premiere = snapshot["academicProfiles"]["PREMIERE"]
    terminale = snapshot["academicProfiles"]["TERMINALE"]
    base_fields = (
        ("dossier_number", "Numéro de dossier", "text"),
        ("campaign_id", "Campaign ID", "text"),
        ("campaign_version", "Version campagne", "text"),
        ("generation_date", "Date de génération", "date"),
        ("pre_registration_id", "Identifiant de pré-inscription", "text"),
        ("student_family_id", "Identifiant élève / famille", "text"),
        ("entry_level", "Classe d’entrée", "text"),
        ("pedagogical_profile", "Profil pédagogique canonique", "text"),
        ("subjects", "Matières", "text"),
        ("selected_subject_count", "Nombre de matières validées", "number"),
        ("module_ids", "Module IDs", "text"),
        ("schedule_slots", "Créneaux", "text"),
        ("session_dates", "Dates", "text"),
        ("derived_pack", "Pack dérivé du nombre de matières", "text"),
        ("price", "Prix", "number"),
        ("deposit", "Acompte", "number"),
        ("balance", "Solde", "number"),
        ("balance_due_date", "Date exacte d’échéance", "date"),
        ("payment_reference", "Référence du paiement", "text"),
        ("nexus_validator", "Validateur Nexus", "text"),
        ("confirmation_status", "Statut confirmation", "text"),
        ("emergency_contact", "Contact d’urgence", "text"),
        ("pickup_person", "Personne autorisée à récupérer l’élève", "text"),
        ("pickup_relationship", "Lien avec l’élève", "text"),
        ("pickup_phone", "Téléphone", "tel"),
        ("specific_needs", "Besoins spécifiques strictement nécessaires", "text"),
    )
    prefilled = {
        "campaign_id": snapshot["campaign"]["id"],
        "campaign_version": snapshot["campaign"]["version"],
        "generation_date": snapshot["generatedAt"][:10],
    }
    readonly_names = {
        "campaign_id", "campaign_version", "generation_date", "selected_subject_count",
        "derived_pack", "price", "deposit", "balance", "balance_due_date",
    }
    fields = "".join(
        _input(
            name,
            label,
            index + 1,
            input_type,
            required=index < 21,
            readonly=name in readonly_names,
            value=prefilled.get(name, ""),
            min_value=1 if name == "selected_subject_count" else (0 if name in {"price", "deposit", "balance"} else None),
            max_value=4 if name == "selected_subject_count" else None,
            step=1 if name in {"selected_subject_count", "price", "deposit", "balance"} else None,
            derived_from="selected_subject_count" if name == "derived_pack" else "",
        )
        for index, (name, label, input_type) in enumerate(base_fields)
    )
    profile_fields = f"""
    <section><h2>Profil Première</h2>
      <fieldset><legend>Voie</legend>{_profile_options(premiere['voies'], 'premiere_track', 30)}</fieldset>
      <fieldset><legend>Mathématiques</legend>{_profile_options(premiere['mathsProfiles'], 'premiere_maths_profile', 34)}</fieldset>
      <fieldset><legend>EAF</legend>{_profile_options(premiere['eafProfiles'], 'premiere_eaf_profile', 38)}</fieldset>
      <fieldset><legend>Spécialités envisagées</legend>{_profile_options(premiere['specialtyPlans'], 'premiere_specialty_plans', 42)}</fieldset>
    </section>
    <section><h2>Profil Terminale</h2>
      <fieldset><legend>{escape_text(terminale['retainedSpecialties']['label'])}</legend>{_profile_options(terminale['retainedSpecialties']['options'], 'terminale_retained_specialties', 48, multiple=True)}</fieldset>
      <fieldset><legend>Options de Mathématiques</legend>{_profile_options(terminale['mathsOptions'], 'terminale_maths_option', 52)}</fieldset>
    </section>"""
    consents = "".join((
        _radio_group("operational_communications_consent", "Communications opérationnelles", 60),
        _radio_group("newsletter_consent", "Newsletter facultative", 62),
        _radio_group("image_rights_consent", "Droit à l’image facultatif", 64),
        _radio_group("pedagogical_recording_consent", "Enregistrement pédagogique facultatif", 66),
    ))
    privacy_fields = "".join(
        _input(name, label, 70 + index)
        for index, (name, label) in enumerate((
            ("privacy_controller", "Responsable de traitement"),
            ("privacy_purposes", "Finalités"),
            ("privacy_legal_basis", "Base et caractère obligatoire / facultatif"),
            ("privacy_recipients", "Destinataires"),
            ("privacy_retention", "Durée"),
            ("privacy_rights", "Droits"),
            ("privacy_contact", "Contact"),
            ("privacy_version", "Version"),
        ))
    )
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier de confirmation d’inscription — structure</title></head>
    <body><header><strong>NON PUBLIABLE — source juridique approuvée requise</strong></header><main>
      <h1>Dossier de confirmation d’inscription</h1>
      <p>À utiliser uniquement après validation administrative et pédagogique du groupe.</p>
      <form>{fields}{profile_fields}<section><h2>Consentements séparés</h2>{consents}</section>
      <section><h2>Notice de confidentialité versionnée</h2><p>Champs structurels non publiables tant qu’une source complète et approuvée n’est pas disponible.</p>{privacy_fields}</section></form>
    </main></body></html>"""


def ensure_private_publication_allowed(snapshot: dict[str, Any]) -> None:
    legal = snapshot["legal"]
    if legal["contractualDossierPublicationBlocked"] or legal["status"] != "APPROVED":
        raise LegalPublicationBlocked("Private dossier requires approved commercial terms and complete approval metadata")
    if not legal["privacyNoticeComplete"]:
        raise LegalPublicationBlocked("Private dossier requires an approved complete privacy notice")
