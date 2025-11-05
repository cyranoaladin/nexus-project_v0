from __future__ import annotations

from pathlib import Path
from typing import Iterable


def list_pdfs(directory: str) -> Iterable[Path]:
    """Retourne les PDF générés (utilitaire simple pour exploration)."""

    path = Path(directory)
    if not path.exists():
        return []
    return sorted(p for p in path.glob("*.pdf"))
