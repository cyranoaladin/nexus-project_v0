import html
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from document_model import load_snapshot  # noqa: E402
from document_templates import render_public_documents  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT = load_snapshot(
    REPO_ROOT / ".artifacts/pre-rentree-2026/publication.snapshot.json",
    REPO_ROOT / "scripts/pre-rentree/schemas/publication-snapshot.schema.json",
)


def normalized_text(markup: str) -> str:
    return " ".join(BeautifulSoup(markup, "html.parser").get_text(" ").split())


def test_renders_the_eleven_accessible_review_html_documents():
    documents = render_public_documents(SNAPSHOT)
    assert set(documents) == set(SNAPSHOT["document"]["outputs"]["publicHtml"].values())
    assert len(documents) == 11
    for filename, document in documents.items():
        soup = BeautifulSoup(document.html, "html.parser")
        assert soup.html and soup.html.get("lang") == "fr"
        assert soup.title and soup.title.get_text(strip=True)
        assert soup.find("h1")
        assert soup.select_one('a.skip-link[href="#contenu"]')
        assert soup.find("header")
        assert soup.find("nav")
        assert soup.find("main")
        assert soup.find("main").get("id") == "contenu"
        assert soup.find("footer")
        assert filename.endswith(".html")
        for table in soup.find_all("table"):
            assert table.find("th", scope="col") or table.find("th", scope="row")


def test_review_banner_is_contained_by_the_main_landmark():
    documents = render_public_documents(SNAPSHOT)
    for document in documents.values():
        soup = BeautifulSoup(document.html, "html.parser")
        banner = soup.select_one("main .review-banner")
        assert banner is not None
        assert "diffusion interdite" in banner.get_text(" ", strip=True)
        cover = soup.select_one("main .cover")
        if cover is not None:
            assert banner.parent == cover
            assert cover.find("h1") is not None
            assert "cover-document" in (soup.body.get("class") or [])


def test_complete_parent_guide_contains_every_required_family_section():
    documents = render_public_documents(SNAPSHOT)
    guide_name = SNAPSHOT["document"]["outputs"]["publicHtml"]["parentGuide"]
    guide = BeautifulSoup(documents[guide_name].html, "html.parser")
    text = normalized_text(str(guide))

    required_section_ids = {
        "couverture",
        "sommaire",
        "essentiel",
        "pourquoi",
        "fonctionnement",
        "offres",
        "catalogue",
        "planning",
        "tarifs",
        "reservation",
        "manuels",
        "pratique",
        "faq",
        "contact",
    }
    assert required_section_ids <= {section.get("id") for section in guide.select("main section[id]")}
    assert {article.get("data-level") for article in guide.select("article.level-guide")} == {
        level["id"] for level in SNAPSHOT["levels"]
    }
    module_nodes = guide.select("article.program-module[data-module-id]")
    expected_module_count = len(SNAPSHOT["modules"])
    expected_session_count = sum(len(module["sessions"]) for module in SNAPSHOT["modules"])
    assert len(module_nodes) == expected_module_count
    assert {node.get("data-module-id") for node in module_nodes} == {
        module["id"] for module in SNAPSHOT["modules"]
    }
    sessions = guide.select("article.session-card[data-session-number]")
    assert len(sessions) == expected_session_count
    assert len({(node.get("data-module-id"), node.get("data-session-number")) for node in sessions}) == expected_session_count
    procedure = guide.select("#reservation ol.procedure > li")
    assert len(procedure) == 4
    assert all(item.get("data-source-path") for item in procedure)
    assert len(guide.select("#faq details")) == len(SNAPSHOT["content"]["faq"])
    assert SNAPSHOT["cta"]["primary"] in text
    assert SNAPSHOT["contact"]["phone"] in text
    assert SNAPSHOT["contact"]["email"] in text
    assert SNAPSHOT["contact"]["canonicalUrl"] in text


def test_parent_guide_factual_blocks_have_valid_evidence_and_capability_gates():
    guide = SNAPSHOT["parentGuide"]
    capabilities = {item["id"]: item for item in SNAPSHOT["capabilities"]["capabilities"]}
    for section in guide["sections"]:
        for block in section["blocks"]:
            if block["kind"] == "EVIDENCED_TEXT":
                assert block["evidenceRefs"]
            if block.get("capabilityId"):
                capability = capabilities[block["capabilityId"]]
                assert capability["publiclyCommitted"] is True
                assert capability["label"]


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

    guide_name = SNAPSHOT["document"]["outputs"]["publicHtml"]["parentGuide"]
    guide = BeautifulSoup(documents[guide_name].html, "html.parser")
    for module in SNAPSHOT["modules"]:
        module_node = guide.select_one(f'article.program-module[data-module-id="{module["id"]}"]')
        assert module_node is not None
        module_text = normalized_text(str(module_node))
        for session in module["sessions"]:
            for value in (
                session["title"], session["objective"], session["method"],
                session["deliverable"], *session["topics"],
            ):
                assert html.unescape(value) in module_text


def test_public_html_contains_exact_prices_and_safe_pre_registration_copy_only():
    documents = render_public_documents(SNAPSHOT)
    rendered = "\n".join(document.html for document in documents.values())
    text = normalized_text(rendered)
    raw_text = BeautifulSoup(rendered, "html.parser").get_text(" ")

    for amount in (350, 400, 480, 900, 1350, 1800, 105, 120, 144, 270, 405, 540, 245, 280, 336, 630, 945, 1260):
        grouped = f"{amount:,}".replace(",", "\u00a0")
        assert grouped in raw_text
    assert SNAPSHOT["cta"]["primary"] in text
    assert SNAPSHOT["content"]["practical"]["preRegistrationNotice"] in text
    assert "Acompte 30 %" in text
    assert "avant de réserver" not in text.casefold()
    assert "acompte reportable sur l’année suivante" not in text.casefold()
    assert "déductible du parcours annuel" not in text.casefold()
    assert "même zone tarifaire que le marché" not in text.casefold()
    assert "sommes déjà reçues" not in text.casefold()
    assert "restituées selon les conditions" not in text.casefold()
    assert "PRE_REGISTRATION_OPEN" not in rendered
    assert not re.search(r"pre2026-pack-|MATHS_NSI_SNT_TEACHER|salle-[12]", rendered)

    pricing = BeautifulSoup(
        documents[SNAPSHOT["document"]["outputs"]["publicHtml"]["pricingReservation"]].html,
        "html.parser",
    )
    assert len(pricing.select("table.tariffs-table")) == 3
    assert all(row.get("data-source-path") == "/offerPricing" for row in pricing.select("table.tariffs-table tbody tr"))


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
    ) >= 2

    essential = BeautifulSoup(documents[SNAPSHOT["document"]["outputs"]["publicHtml"]["essential"]].html, "html.parser")
    cover_dates = essential.select_one("#couverture[data-source-path] .cover-dates")
    assert cover_dates is not None
    assert all(card.get("data-claim-id") for card in essential.select(".material-card"))

    planning = BeautifulSoup(documents[SNAPSHOT["document"]["outputs"]["publicHtml"]["planning"]].html, "html.parser")
    assert all(item.get("data-source-path") for item in planning.select(".legend li"))
    assert all(row.get("data-source-path") for row in planning.select('tbody tr[class^="subject-"]'))


def test_family_surfaces_hide_release_jargon_and_unapproved_promises():
    documents = render_public_documents(SNAPSHOT)
    visible = "\n".join(normalized_text(document.html) for document in documents.values())
    blocked_visible_terms = (
        "canonical", "snapshot", "manifest", "campaignid", "sourcereposha",
        "non public", "draft", "owner approval", "legal approval", "commit", "branch", "sha",
        "v5-canonical", "tarif canonique", "tarifs canoniques", "pack canonique",
        "packs canoniques", "source canonique", "offre canonique", "matières canoniques",
        "oral filmé", "release candidate",
        "résultats garantis", "progression garantie", "rattrapage garanti", "séance de laboratoire",
        "quatre documents personnalisés",
    )
    for term in blocked_visible_terms:
        assert not re.search(rf"(?<![\w-]){re.escape(term)}(?![\w-])", visible, re.IGNORECASE), term
    assert "tarifs des stages de pré-rentrée 2026" in visible.casefold()


def test_renderer_sources_contain_no_campaign_business_literals():
    paths = [
        SCRIPT_DIR / "document_model.py",
        SCRIPT_DIR / "document_templates.py",
        SCRIPT_DIR / "templates/document.css",
    ]
    python_source = "\n".join(path.read_text(encoding="utf-8") for path in paths[:2])
    all_source = "\n".join(path.read_text(encoding="utf-8") for path in paths)
    numeric_literals = (
        r"\b350\b|\b400\b|\b480\b|\b900\b|\b1350\b|\b1800\b",
        r"\b105\b|\b120\b|\b144\b|\b270\b|\b405\b|\b540\b",
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
