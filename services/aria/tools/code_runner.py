from __future__ import annotations

import subprocess
from typing import Sequence


def run_python_snippet(snippet: str, timeout: int = 5) -> str:
    """Exécution contrôlée (placeholder) d'un snippet Python."""

    cmd: Sequence[str] = ("python3", "-c", snippet)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    return result.stdout.strip()
