"""Stable, allowlisted asset URLs for the public Pré-rentrée PDF renderer."""

from __future__ import annotations

import mimetypes
from pathlib import Path

from weasyprint.urls import URLFetcherResponse


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PUBLIC_PDF_ASSET_SCHEME = "nexus-public-pdf:"
_ASSETS = {
    "DMSans-Variable.woff2": REPO_ROOT / "app" / "fonts" / "DMSans-Variable.woff2",
    "Fraunces-Variable.woff2": REPO_ROOT / "app" / "fonts" / "Fraunces-Variable.woff2",
    "Inter-Variable.woff2": REPO_ROOT / "app" / "fonts" / "Inter-Variable.woff2",
    "logo_slogan_nexus_x3.png": REPO_ROOT / "public" / "images" / "logo_slogan_nexus_x3.png",
}


def public_pdf_asset_url(name: str) -> str:
    if name not in _ASSETS:
        raise ValueError(f"Unknown public PDF asset: {name}")
    return f"{PUBLIC_PDF_ASSET_SCHEME}{name}"


def fetch_public_pdf_asset(url: str) -> URLFetcherResponse:
    if not url.startswith(PUBLIC_PDF_ASSET_SCHEME):
        raise ValueError(f"Network or unknown public PDF asset URL rejected: {url}")
    name = url.removeprefix(PUBLIC_PDF_ASSET_SCHEME)
    path = _ASSETS.get(name)
    if path is None or not path.is_file():
        raise ValueError(f"Unknown public PDF asset: {name}")
    mime_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    return URLFetcherResponse(
        url,
        body=path.read_bytes(),
        headers={"Content-Type": mime_type},
    )
