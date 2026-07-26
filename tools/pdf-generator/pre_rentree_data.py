"""Canonical data layer for the pré-rentrée 2026 parent PDF dossiers.

Single source of truth loader: every level dossier is built exclusively from
this module's derived structures, themselves read from the canonical JSON
sources (data/campaigns/pre-rentree-2026.json, content/pre-rentree-2026/
modules.json, data/pricing.canonical.json, publication-decisions.owner.json).
No subject/session/price content is ever hardcoded in the generator itself —
if a subject exists in the schedule but has no matching module, that is a gap
to report explicitly (see GapReport below), never a reason to invent text.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date as _date
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Contact constants mirror lib/legal.ts (TypeScript canonical source); duplicated
# here only because the PDF pipeline is Python and cannot import a TS module.
# Keep in sync manually if lib/legal.ts ever changes these values.
CONTACT_PHONE_DISPLAY = "+216 99 19 28 29"
CONTACT_PHONE_HREF = "+21699192829"
CONTACT_EMAIL = "contact@nexusreussite.academy"
CONTACT_SITE = "nexusreussite.academy/stages/pre-rentree-2026"
CONTACT_SITE_URL = "https://nexusreussite.academy/stages/pre-rentree-2026"

LEVEL_LABELS = {
    "TROISIEME": "3e",
    "SECONDE": "Seconde",
    "PREMIERE": "Première",
    "TERMINALE": "Terminale",
}
LEVEL_ORDER = ("TROISIEME", "SECONDE", "PREMIERE", "TERMINALE")

SUBJECT_LABELS = {
    "MATHEMATIQUES": "Mathématiques",
    "FRANCAIS": "Français",
    "NSI": "NSI",
    "PHYSIQUE_CHIMIE": "Physique-Chimie",
    "SVT": "SVT",
    "MATHS_EXPERTES": "Mathématiques expertes",
}

# Accent colours derived from lib/campaigns/pre-rentree-2026/subject-theme.ts
# (its Tailwind *-800 shades), used only as small per-subject markers — never
# as a substitute for the institutional navy/gold/ivory charter (Phase 3).
SUBJECT_ACCENTS = {
    "MATHEMATIQUES": "#1E3A8A",
    "FRANCAIS": "#9F1239",
    "NSI": "#5B21B6",
    "PHYSIQUE_CHIMIE": "#115E59",
    "SVT": "#065F46",
    "MATHS_EXPERTES": "#3730A3",
}
SUBJECT_MARKERS = {
    "MATHEMATIQUES": "M",
    "FRANCAIS": "F",
    "NSI": "</>",
    "PHYSIQUE_CHIMIE": "PC",
    "SVT": "SVT",
    "MATHS_EXPERTES": "M+",
}

# Materials fallback for subjects without a per-module `equipment` field in
# modules.json (only the 2 SVT modules currently carry one). Mirrors the table
# already published in NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf
# and content/pre-rentree-2026/parent-guide.fr.json.
_MATERIALS_FALLBACK = {
    "MATHEMATIQUES": "Cahier, trousse complète, calculatrice",
    "MATHS_EXPERTES": "Cahier, trousse complète, calculatrice",
    "FRANCAIS": "Cahier, trousse complète",
    "NSI": "Ordinateur portable personnel (deux postes de secours disponibles — prévenir Nexus avant le stage si nécessaire)",
    "PHYSIQUE_CHIMIE": "Cahier, trousse complète, calculatrice — accompagnement théorique et méthodologique ; pas de séance de laboratoire",
    "SVT": "Cahier, trousse complète, calculatrice scientifique simple recommandée (non obligatoire sauf consigne de l'enseignant)",
}

_MONTHS_FR = ("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
              "septembre", "octobre", "novembre", "décembre")
_WEEKDAYS_FR = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")


def format_day_fr(date_str: str) -> str:
    parsed = _date.fromisoformat(date_str)
    return f"{_WEEKDAYS_FR[parsed.weekday()]} {parsed.day} {_MONTHS_FR[parsed.month - 1]}"


def format_tnd(amount) -> str:
    return f"{amount:,}".replace(",", "&#8239;")


@dataclass(frozen=True)
class SubjectSession:
    number: int
    title: str
    objective: str
    topics: tuple
    method: Optional[str]
    deliverable: str


@dataclass(frozen=True)
class SubjectModule:
    module_id: str
    subject_id: str
    subject_label: str
    subtitle: str
    objective: Optional[str]
    prerequisites: str
    differentiation: str
    quick_assessment: str
    equipment: Optional[str]
    publication_status: str
    sessions: tuple  # tuple[SubjectSession, ...]

    @property
    def is_validated(self) -> bool:
        return self.publication_status == "VALIDATED"


@dataclass(frozen=True)
class ScheduledSlot:
    level: str
    subject: str
    block: str
    room: str
    window_id: str
    window_label: str
    start_time: str
    end_time: str
    date: Optional[str] = None
    cohort_id: Optional[str] = None
    is_primary: Optional[bool] = None


@dataclass(frozen=True)
class SubjectIncompatibility:
    level: str
    subject_a: str
    subject_b: str


@dataclass(frozen=True)
class GapReport:
    """A subject scheduled for a level with no matching pedagogical module.

    The generator must fail explicitly on any non-empty gap list rather than
    render a level dossier silently missing a subject's programme.
    """
    level: str
    subject_id: str


@dataclass(frozen=True)
class LevelDossierData:
    level: str
    level_label: str
    subjects: tuple  # tuple[str, ...], sorted, canonical order of appearance
    modules_by_subject: dict  # subject_id -> SubjectModule
    slots: tuple  # tuple[ScheduledSlot, ...] for this level, chronological
    incompatibilities: tuple  # tuple[SubjectIncompatibility, ...] for this level
    is_public: bool  # False => whole dossier stays in REVIEW mode (Phase 10)
    gaps: tuple  # tuple[GapReport, ...] — must be empty for is_public dossiers


class PreRentreeData:
    """Loads every canonical source exactly once and derives per-level data."""

    def __init__(self, repo_root: Path = REPO_ROOT):
        self.repo_root = repo_root
        self.campaign = self._load_json("data/campaigns/pre-rentree-2026.json")
        self.pricing = self._load_json("data/pricing.canonical.json")
        modules_doc = self._load_json("content/pre-rentree-2026/modules.json")
        self._modules_raw = modules_doc["modules"]
        decisions_doc = self._load_json("content/pre-rentree-2026/publication-decisions.owner.json")
        self.decisions = decisions_doc["decisions"]
        self.release_status = decisions_doc.get("releaseStatus")

        self.foundations = tuple(self.pricing["pre_rentree_foundations"])
        self.premium_packs = tuple(self.pricing["pre_rentree_packs"])
        self.foundations_group_min, self.foundations_group_max = self._uniform_group_bounds(self.foundations)
        self.premium_group_min, self.premium_group_max = self._uniform_group_bounds(self.premium_packs)
        self.starting_price = min(
            offer["price_per_student"] for offer in (*self.foundations, *self.premium_packs)
        )

        self._block_times = {b["id"]: (b["startTime"], b["endTime"]) for b in self.campaign["blocks"]}
        self._slots, self._dated_slots = self._expand_schedule()
        self._modules_by_key = self._index_modules()

    # ── loading helpers ────────────────────────────────────────────────

    def _load_json(self, relative_path: str):
        return json.loads((self.repo_root / relative_path).read_text(encoding="utf-8"))

    @staticmethod
    def _uniform_group_bounds(offers):
        mins = {offer["group_min_open"] for offer in offers}
        maxes = {offer["group_max"] for offer in offers}
        assert len(mins) == 1 and len(maxes) == 1, (mins, maxes)
        return mins.pop(), maxes.pop()

    def _expand_schedule(self):
        slots = []
        dated = []
        for window in self.campaign["schedule"]:
            for raw_slot in window["slots"]:
                start, end = self._block_times[raw_slot["block"]]
                base = ScheduledSlot(
                    level=raw_slot["level"],
                    subject=raw_slot["subject"],
                    block=raw_slot["block"],
                    room=raw_slot["room"],
                    window_id=window["windowId"],
                    window_label=window["windowLabel"],
                    start_time=start,
                    end_time=end,
                    cohort_id=raw_slot.get("cohortId"),
                    is_primary=raw_slot.get("isPrimary"),
                )
                slots.append(base)
                for day in window["days"]:
                    dated.append(
                        ScheduledSlot(
                            level=base.level, subject=base.subject, block=base.block, room=base.room,
                            window_id=base.window_id, window_label=base.window_label,
                            start_time=start, end_time=end, date=day,
                            cohort_id=base.cohort_id, is_primary=base.is_primary,
                        )
                    )
        return tuple(slots), tuple(dated)

    def _index_modules(self):
        index = {}
        for raw in self._modules_raw:
            sessions = tuple(
                SubjectSession(
                    number=s["number"],
                    title=s["title"],
                    objective=s["objective"],
                    topics=tuple(s["topics"]),
                    method=s.get("method"),
                    deliverable=s["deliverable"],
                )
                for s in raw["sessions"]
            )
            module = SubjectModule(
                module_id=raw["id"],
                subject_id=raw["subjectId"],
                subject_label=raw["subject"],
                subtitle=raw["subtitle"],
                objective=raw.get("objective"),
                prerequisites=raw["prerequisites"],
                differentiation=raw["differentiation"],
                quick_assessment=raw["quickAssessment"],
                equipment=raw.get("equipment"),
                publication_status=raw.get("publicationStatus", "DRAFT"),
                sessions=sessions,
            )
            index[(raw["level"], raw["subjectId"])] = module
        return index

    # ── public derivations ─────────────────────────────────────────────

    def subjects_for_level(self, level: str) -> tuple:
        """Canonical subject list for a level, in first-appearance schedule order."""
        seen = []
        for slot in self._slots:
            if slot.level == level and slot.subject not in seen:
                seen.append(slot.subject)
        return tuple(seen)

    def slots_for_level(self, level: str) -> tuple:
        result = [s for s in self._slots if s.level == level]
        result.sort(key=lambda s: (s.window_id, "ABCD".index(s.block)))
        return tuple(result)

    def dated_slots_for_level(self, level: str) -> tuple:
        result = [s for s in self._dated_slots if s.level == level]
        result.sort(key=lambda s: (s.date, "ABCD".index(s.block)))
        return tuple(result)

    def incompatibilities_for_level(self, level: str) -> tuple:
        """Port of lib/campaigns/pre-rentree-2026/incompatibilities.ts:
        two subjects of the same level sharing a calendar date + time block
        cannot both be attended by the same student."""
        by_date_block = {}
        for slot in self._dated_slots:
            if slot.level != level:
                continue
            key = (slot.date, slot.block)
            by_date_block.setdefault(key, set()).add(slot.subject)
        pairs = {}
        for subjects in by_date_block.values():
            if len(subjects) < 2:
                continue
            ordered = sorted(subjects)
            for i in range(len(ordered)):
                for j in range(i + 1, len(ordered)):
                    pairs[(ordered[i], ordered[j])] = SubjectIncompatibility(
                        level=level, subject_a=ordered[i], subject_b=ordered[j],
                    )
        return tuple(pairs.values())

    def module_for(self, level: str, subject_id: str) -> Optional[SubjectModule]:
        return self._modules_by_key.get((level, subject_id))

    def level_dossier(self, level: str) -> LevelDossierData:
        subjects = self.subjects_for_level(level)
        modules = {}
        gaps = []
        for subject_id in subjects:
            module = self.module_for(level, subject_id)
            if module is None:
                gaps.append(GapReport(level=level, subject_id=subject_id))
            else:
                modules[subject_id] = module
        is_public = len(gaps) == 0 and all(m.is_validated for m in modules.values())
        return LevelDossierData(
            level=level,
            level_label=LEVEL_LABELS[level],
            subjects=subjects,
            modules_by_subject=modules,
            slots=self.slots_for_level(level),
            incompatibilities=self.incompatibilities_for_level(level),
            is_public=is_public,
            gaps=tuple(gaps),
        )

    def all_level_dossiers(self) -> tuple:
        return tuple(self.level_dossier(level) for level in LEVEL_ORDER)

    def materials_for_subject(self, subject_id: str, module: Optional[SubjectModule]) -> str:
        if module is not None and module.equipment:
            return module.equipment
        return _MATERIALS_FALLBACK.get(subject_id, "Cahier et trousse complète")

    def pricing_offer_for_level(self, level: str, subjects_count: int):
        """Return the canonical pricing row for a (level, subjects_count) pair."""
        if level in ("TROISIEME", "SECONDE"):
            for offer in self.foundations:
                if offer["level"] == level and offer["subjects_count"] == subjects_count:
                    return offer
            return None
        for offer in self.premium_packs:
            if offer["subjects_count"] == subjects_count:
                return offer
        return None

    def tier_for_level(self, level: str) -> str:
        return "foundations" if level in ("TROISIEME", "SECONDE") else "premium"
