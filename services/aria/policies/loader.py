from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

import yaml

_BASE_PATH = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def load_pedagogy() -> Dict[str, Any]:
    target = _BASE_PATH / "pedagogy.yaml"
    if not target.exists():
        raise FileNotFoundError(f"Pedagogy configuration not found at {target}")
    with target.open(encoding="utf-8") as stream:
        return yaml.safe_load(stream)


def get_scheme(scheme_id: str) -> Dict[str, Any]:
    data = load_pedagogy()
    try:
        return data["grading_schemes"][scheme_id]
    except KeyError as exc:
        raise KeyError(f"grading scheme '{scheme_id}' not defined in pedagogy.yaml") from exc


def get_feedback_templates() -> Dict[str, Any]:
    data = load_pedagogy()
    return data.get("feedback_templates", {})


def get_remediation() -> Dict[str, Any]:
    data = load_pedagogy()
    return data.get("remediation", {})
