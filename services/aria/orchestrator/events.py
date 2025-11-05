from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict


@dataclass
class OrchestratorEvent:
    """Évènement minimal publié sur le bus interne (extension future)."""

    name: str
    payload: Dict[str, Any]
    created_at: datetime = datetime.utcnow()
