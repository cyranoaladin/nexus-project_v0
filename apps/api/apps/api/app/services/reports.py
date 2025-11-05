"""Reporting utilities for parent-facing summaries."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.student import Student
from app.utils.audit import record_event

from . import dashboard as dashboard_service


def _default_period(timestamp: datetime | None = None) -> str:
    anchor = timestamp or datetime.utcnow()
    return anchor.strftime("%Y-%m")


def _build_summary_md(kpis: dict[str, Optional[float]], upcoming: list[dict], tasks: list[dict]) -> str:
    lines = ["# Synthèse pédagogique", ""]
    lines.append(f"- Progression globale : {int((kpis.get('progress_overall') or 0) * 100)}%")
    last_eval = kpis.get("last_eval_score")
    if last_eval is not None:
        lines.append(f"- Dernière évaluation : {last_eval}/20")
    lines.append(f"- Série active : {kpis.get('streak_days', 0)} jours")
    if upcoming:
        next_item = upcoming[0]
        lines.append(
            f"- Prochain rendez-vous : {next_item['title']} le {next_item['at'].strftime('%d/%m')}"
        )
    if tasks:
        lines.append(f"- Tâches à traiter : {len(tasks)} priorités")
    lines.append("")
    if tasks:
        lines.append("## Priorités")
        for task in tasks[:5]:
            due = task.get("due_at")
            due_str = due.strftime("%d/%m") if hasattr(due, "strftime") and due else "sans échéance"
            lines.append(f"- [ ] {task['label']} (à faire pour {due_str})")
        lines.append("")
    return "\n".join(lines)


def _jsonify_entries(entries: list[dict]) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for entry in entries:
        item: dict[str, Any] = {}
        for key, value in entry.items():
            if isinstance(value, datetime):
                item[key] = value.isoformat()
            else:
                item[key] = value
        serialized.append(item)
    return serialized


def upsert_parent_report(
    session: Session,
    *,
    student_id: UUID,
    period: str | None = None,
    regenerate: bool = False,
) -> Dict[str, object]:
    student = dashboard_service.ensure_student(session, student_id)
    period_value = period or _default_period(None)

    existing_stmt = select(Report).where(Report.student_id == student.id, Report.period == period_value)
    report = session.execute(existing_stmt).scalar_one_or_none()

    if report and not regenerate:
        payload = report.payload or {}
        return {
            "student_id": student.id,
            "period": report.period,
            "generated_at": report.generated_at,
            "summary_md": report.summary_md or "",
            "kpis": report.kpis_json or {},
            "upcoming": payload.get("upcoming", []),
            "tasks": payload.get("tasks", []),
            "progress": payload.get("progress", []),
        }

    kpis = dashboard_service.get_dashboard_kpis(session, student.id)
    upcoming = dashboard_service.list_upcoming_sessions(session, student.id, limit=5)
    tasks = dashboard_service.list_pending_tasks(session, student.id, limit=6)
    progress = dashboard_service.list_progress(session, student.id, limit=10)

    summary_md = _build_summary_md(kpis, upcoming, tasks)

    if report is None:
        report = Report(student_id=student.id, period=period_value)
        session.add(report)

    report.payload = {
        "upcoming": _jsonify_entries(upcoming),
        "tasks": _jsonify_entries(tasks),
        "progress": _jsonify_entries(progress),
    }
    report.summary_md = summary_md
    report.kpis_json = kpis
    report.generated_at = datetime.utcnow()

    session.flush()

    record_event(
        session,
        student_id=student.id,
        kind="PARENT_REPORT_GENERATED",
        payload={"period": period_value},
    )

    return {
        "student_id": student.id,
        "period": period_value,
        "generated_at": report.generated_at,
        "summary_md": summary_md,
        "kpis": kpis,
        "upcoming": upcoming,
        "tasks": tasks,
        "progress": progress,
    }


def generate_reports_for_students(
    session: Session,
    *,
    period: Optional[str] = None,
    student_ids: Optional[Iterable[UUID]] = None,
    regenerate: bool = False,
) -> Dict[UUID, dict[str, object]]:
    if student_ids is None:
        stmt = select(Student.id)
    else:
        candidate_ids = list(student_ids)
        if not candidate_ids:
            return {}
        stmt = select(Student.id).where(Student.id.in_(candidate_ids))

    ids = [row[0] for row in session.execute(stmt).all()]
    results: Dict[UUID, dict[str, object]] = {}
    for student_id in ids:
        results[student_id] = upsert_parent_report(
            session,
            student_id=student_id,
            period=period,
            regenerate=regenerate,
        )
    return results
