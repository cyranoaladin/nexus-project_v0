from __future__ import annotations

from typing import Dict


def send_notification(channel: str, payload: Dict[str, str]) -> None:
    """Placeholder notification (email/push)."""

    # TODO: intégrer les canaux (email, push, etc.)
    print(f"[NOTIF::{channel}] {payload}")
