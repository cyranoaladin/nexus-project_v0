"""Atomic HTML and tagged PDF rendering from publication snapshot data."""

from __future__ import annotations

import hashlib
import mimetypes
import os
import re
import subprocess
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration
from weasyprint.urls import URLFetcherResponse

from document_templates import render_public_documents


def _atomic_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temporary.write_text(value, encoding="utf-8")
    with temporary.open("rb") as handle:
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def write_public_html(snapshot: dict[str, Any], output_dir: Path) -> dict[str, Path]:
    output_dir = Path(output_dir).resolve()
    documents = render_public_documents(snapshot)
    by_key = {
        filename: key
        for key, filename in snapshot["document"]["outputs"]["publicHtml"].items()
    }
    written: dict[str, Path] = {}
    for filename, document in documents.items():
        key = by_key[filename]
        destination = output_dir / filename
        _atomic_text(destination, document.html)
        written[key] = destination
    return written


@contextmanager
def _source_date_epoch(iso_timestamp: str):
    previous = os.environ.get("SOURCE_DATE_EPOCH")
    instant = datetime.fromisoformat(iso_timestamp)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    epoch = str(int(instant.timestamp()))
    os.environ["SOURCE_DATE_EPOCH"] = epoch
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("SOURCE_DATE_EPOCH", None)
        else:
            os.environ["SOURCE_DATE_EPOCH"] = previous


def _stable_pdf_html(html_path: Path, package_root: Path) -> tuple[str, Any]:
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
    assets_dir = package_root / "ASSETS"
    stylesheet = soup.find("link", rel="stylesheet")
    if stylesheet is None or not stylesheet.get("href"):
        raise ValueError(f"Document has no stylesheet: {html_path}")
    css_path = (html_path.parent / stylesheet["href"]).resolve()
    if not css_path.is_relative_to(package_root) or not css_path.is_file():
        raise ValueError(f"Stylesheet escapes package root: {css_path}")
    css = css_path.read_text(encoding="utf-8")
    css = re.sub(r"/\* PDF_IGNORE_START \*/.*?/\* PDF_IGNORE_END \*/", "", css, flags=re.DOTALL)
    for asset_path in assets_dir.iterdir():
        css = css.replace(f'url("{asset_path.name}")', f'url("nexus-asset:{asset_path.name}")')
    style = soup.new_tag("style")
    style.string = css
    stylesheet.replace_with(style)
    for image in soup.find_all("img"):
        image["src"] = f'nexus-asset:{Path(image.get("src", "")).name}'

    def fetcher(url: str):
        if not url.startswith("nexus-asset:"):
            raise ValueError(f"Network or unknown PDF asset URL rejected: {url}")
        name = url.split(":", 1)[1]
        asset_path = (assets_dir / name).resolve()
        if not asset_path.is_relative_to(assets_dir) or not asset_path.is_file():
            raise ValueError(f"Unknown PDF asset: {name}")
        mime_type = mimetypes.guess_type(asset_path.name)[0] or "application/octet-stream"
        return URLFetcherResponse(url, body=asset_path.read_bytes(), headers={"Content-Type": mime_type})

    return str(soup), fetcher


def _canonicalize_tagged_pdf(source: Path, destination: Path) -> None:
    qdf_path = source.with_name(f".{source.name}.qdf-{os.getpid()}")
    canonical_qdf = source.with_name(f".{source.name}.canonical-qdf-{os.getpid()}")
    canonical_pdf = destination.with_name(f".{destination.name}.canonical-{os.getpid()}")
    try:
        subprocess.run(
            ["qpdf", "--qdf", "--object-streams=disable", "--stream-data=preserve", str(source), str(qdf_path)],
            check=True,
            capture_output=True,
        )
        content = qdf_path.read_bytes()
        identifiers: list[bytes] = []
        for identifier in re.findall(rb"/ID \((\d{8,})\)", content):
            if identifier not in identifiers:
                identifiers.append(identifier)
        for index, identifier in enumerate(identifiers, start=1):
            replacement = str(index).zfill(len(identifier)).encode("ascii")
            content = content.replace(b"(" + identifier + b")", b"(" + replacement + b")")
        canonical_qdf.write_bytes(content)
        subprocess.run(
            [
                "qpdf",
                "--deterministic-id",
                "--object-streams=generate",
                "--compression-level=9",
                str(canonical_qdf),
                str(canonical_pdf),
            ],
            check=True,
            capture_output=True,
        )
        os.replace(canonical_pdf, destination)
    finally:
        source.unlink(missing_ok=True)
        qdf_path.unlink(missing_ok=True)
        canonical_qdf.unlink(missing_ok=True)
        canonical_pdf.unlink(missing_ok=True)


def render_public_pdfs(
    snapshot: dict[str, Any], html_dir: Path, output_dir: Path,
) -> dict[str, Path]:
    html_dir = Path(html_dir).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    html_names = snapshot["document"]["outputs"]["publicHtml"]
    pdf_names = snapshot["document"]["outputs"]["publicPdf"]
    font_config = FontConfiguration()
    rendered: dict[str, Path] = {}
    package_root = html_dir.parent

    with _source_date_epoch(snapshot["document"]["documentEditionDate"]):
        for key, pdf_name in pdf_names.items():
            html_path = html_dir / html_names[key]
            if not html_path.is_file():
                raise FileNotFoundError(f"Missing accessible HTML source: {html_path}")
            destination = output_dir / pdf_name
            temporary = destination.with_name(f".{destination.name}.tmp-{os.getpid()}")
            identifier = hashlib.sha256(
                f'{snapshot["sourceRepoSha"]}:{snapshot["document"]["documentPackageVersion"]}:{pdf_name}'.encode("utf-8"),
            ).digest()
            stable_html, fetcher = _stable_pdf_html(html_path, package_root)
            HTML(string=stable_html, base_url="nexus-document:", url_fetcher=fetcher).write_pdf(
                str(temporary),
                font_config=font_config,
                pdf_identifier=identifier,
                custom_metadata=True,
                presentational_hints=True,
                full_fonts=True,
                hinting=True,
                optimize_images=False,
            )
            _canonicalize_tagged_pdf(temporary, destination)
            with destination.open("rb") as handle:
                os.fsync(handle.fileno())
            rendered[key] = destination
    return rendered
