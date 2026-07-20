import html
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_model import load_snapshot  # noqa: E402
from document_templates import (  # noqa: E402
    LegalPublicationBlocked,
    ensure_private_publication_allowed,
    render_private_structural_template,
    render_public_documents,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = load_snapshot(
    REPO_ROOT / "generated/pre-rentree-2026-publication.snapshot.json",
    REPO_ROOT / "scripts/pre-rentree/schemas/publication-snapshot.schema.json",
)


def normalized_text(markup: str) -> str:
    return " ".join(BeautifulSoup(markup, "html.parser").get_text(" ").split())


def test_renders_the_six_accessible_public_html_documents():
    documents = render_public_documents(SNAPSHOT)
    assert set(documents) == set(SNAPSHOT["document"]["outputs"]["publicHtml"].values())
    assert len(documents) == 6
    for filename, document in documents.items():
        soup = BeautifulSoup(document.html, "html.parser")
        assert soup.html and soup.html.get("lang") == "fr"
        assert soup.title and soup.title.get_text(strip=True)
        assert soup.find("h1")
        assert soup.find("main")
        assert soup.find("footer")
        assert filename.endswith(".html")
        for table in soup.find_all("table"):
            assert table.find("th", scope="col") or table.find("th", scope="row")


def test_program_documents_copy_every_canonical_module_session_field_verbatim():
    documents = render_public_documents(SNAPSHOT)
    program_text = " ".join(
        normalized_text(document.html)
        for filename, document in documents.items()
        if "Programme" in filename
    )

    for module in SNAPSHOT["modules"]:
        for value in (
            module["title"],
            module["subtitle"],
            module["prerequisites"],
            module["differentiation"],
            module["quickAssessment"],
        ):
            assert html.unescape(value) in program_text
        for session in module["sessions"]:
            for value in (
                session["title"],
                session["objective"],
                session["method"],
                session["deliverable"],
                *session["topics"],
            ):
                assert html.unescape(value) in program_text
    assert SNAPSHOT["content"]["adaptationNotice"] in program_text
    assert SNAPSHOT["content"]["recordingConsentNotice"] in program_text


def test_public_html_contains_exact_prices_and_safe_pre_registration_copy_only():
    documents = render_public_documents(SNAPSHOT)
    rendered = "\n".join(document.html for document in documents.values())
    text = normalized_text(rendered)
    raw_text = BeautifulSoup(rendered, "html.parser").get_text(" ")

    for amount in (480, 900, 1350, 1800, 140, 270, 410, 540, 340, 630, 940, 1260):
        grouped = f"{amount:,}".replace(",", "\u00a0")
        assert grouped in raw_text
    assert SNAPSHOT["cta"]["primary"] in text
    assert SNAPSHOT["content"]["practical"]["preRegistrationNotice"] in text
    assert "Acompte (30 %)" not in text
    assert "avant de réserver" not in text.casefold()
    assert "acompte reportable sur l’année suivante" not in text.casefold()
    assert "déductible du parcours annuel" not in text.casefold()
    assert "même zone tarifaire que le marché" not in text.casefold()
    assert "sommes déjà reçues" not in text.casefold()
    assert "restituées selon les conditions" not in text.casefold()
    assert "PRE_REGISTRATION_OPEN" not in rendered
    assert not re.search(r"pre2026-pack-|MATHS_NSI_SNT_TEACHER|salle-[12]", rendered)

    pricing = BeautifulSoup(
        documents[SNAPSHOT["document"]["outputs"]["publicHtml"]["pricing"]].html,
        "html.parser",
    )
    summary = pricing.select_one('.format-summary[data-source-path="/packs/0"]')
    assert summary is not None
    summary_text = normalized_text(str(summary))
    reference_pack = SNAPSHOT["packs"][0]
    assert f'{reference_pack["sessionsPerSubject"]} séances par matière' in summary_text
    assert f'{reference_pack["sessionDurationHours"]} h par séance' in summary_text
    assert f'{reference_pack["hoursPerSubject"]} h par matière' in summary_text


def test_every_rendered_public_claim_id_exists_in_the_snapshot_registry():
    documents = render_public_documents(SNAPSHOT)
    approved = {claim["id"] for claim in SNAPSHOT["approvedPublicClaims"]}
    rendered_ids = {
        node["data-claim-id"]
        for document in documents.values()
        for node in BeautifulSoup(document.html, "html.parser").select("[data-claim-id]")
    }
    assert rendered_ids
    assert rendered_ids <= approved
    assert sum(
        len(BeautifulSoup(document.html, "html.parser").select('[data-claim-id="public-cta"]'))
        for document in documents.values()
    ) == 2

    essential = BeautifulSoup(documents[SNAPSHOT["document"]["outputs"]["publicHtml"]["essential"]].html, "html.parser")
    assert essential.select_one(".date-band[data-source-path]")
    assert all(card.get("data-claim-id") for card in essential.select(".material-card"))

    planning = BeautifulSoup(documents[SNAPSHOT["document"]["outputs"]["publicHtml"]["planning"]].html, "html.parser")
    assert all(item.get("data-source-path") for item in planning.select(".legend li"))
    assert all(row.get("data-source-path") for row in planning.select('tbody tr[class^="subject-"]'))


def test_private_template_has_required_structure_but_cannot_be_published():
    markup = render_private_structural_template(SNAPSHOT)
    soup = BeautifulSoup(markup, "html.parser")
    text = normalized_text(markup)

    assert "Dossier de confirmation d’inscription" in text
    assert "À utiliser uniquement après validation administrative et pédagogique du groupe." in text
    required_names = {
        "dossier_number",
        "campaign_id",
        "campaign_version",
        "generation_date",
        "pre_registration_id",
        "student_family_id",
        "entry_level",
        "pedagogical_profile",
        "subjects",
        "module_ids",
        "schedule_slots",
        "session_dates",
        "derived_pack",
        "price",
        "deposit",
        "balance",
        "balance_due_date",
        "payment_reference",
        "nexus_validator",
        "confirmation_status",
        "emergency_contact",
        "pickup_person",
        "pickup_relationship",
        "pickup_phone",
        "specific_needs",
    }
    names = {field.get("name") for field in soup.select("input[name], select[name], textarea[name]")}
    assert required_names <= names
    subject_count = soup.select_one('input[name="selected_subject_count"]')
    assert subject_count is not None
    assert subject_count.get("type") == "number"
    assert subject_count.get("min") == "1"
    assert subject_count.get("max") == "4"
    derived_pack = soup.select_one('input[name="derived_pack"]')
    assert derived_pack is not None and derived_pack.has_attr("readonly")
    assert derived_pack.get("data-derived-from") == "selected_subject_count"
    for name in ("price", "deposit", "balance"):
        amount = soup.select_one(f'input[name="{name}"]')
        assert amount is not None
        assert amount.get("type") == "number"
        assert amount.get("min") == "0"
        assert amount.get("step") == "1"
        assert amount.has_attr("readonly")
    for consent_name in (
        "operational_communications_consent",
        "newsletter_consent",
        "image_rights_consent",
        "pedagogical_recording_consent",
    ):
        values = {node.get("value") for node in soup.select(f'input[type="radio"][name="{consent_name}"]')}
        assert values == {"yes", "no"}
    assert "NON PUBLIABLE" in text
    assert "MISSING_APPROVED_COMMERCIAL_TERMS" not in text
    try:
        ensure_private_publication_allowed(SNAPSHOT)
    except LegalPublicationBlocked as exc:
        assert "approved commercial terms" in str(exc).lower()
    else:
        raise AssertionError("The private publication gate must remain closed")


def test_renderer_sources_contain_no_campaign_business_literals():
    paths = [
        SCRIPT_DIR / "document_model.py",
        SCRIPT_DIR / "document_templates.py",
        SCRIPT_DIR / "templates/document.css",
    ]
    python_source = "\n".join(path.read_text(encoding="utf-8") for path in paths[:2])
    all_source = "\n".join(path.read_text(encoding="utf-8") for path in paths)
    numeric_literals = (
        r"\b480\b|\b900\b|\b1350\b|\b1800\b",
        r"\b140\b|\b270\b|\b410\b|\b540\b",
    )
    blocked_literals = (
        r"2026-08-(?:10|17|28)",
        r"99\s*19\s*28\s*29|contact@nexusreussite",
        r"seconde-mathematiques|terminale-nsi",
    )
    for pattern in numeric_literals:
        assert not re.search(pattern, python_source, re.IGNORECASE), pattern
    for pattern in blocked_literals:
        assert not re.search(pattern, all_source, re.IGNORECASE), pattern
