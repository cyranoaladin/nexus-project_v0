from __future__ import annotations

from typing import Any, Dict, List

from policies import get_feedback_templates, get_remediation, get_scheme


def _select_feedback(strength: bool) -> str:
    templates = get_feedback_templates()
    bucket = "strengths" if strength else "weaknesses"
    options: List[str] = templates.get(bucket, [])
    if not options:
        return "Bon travail." if strength else "Points à retravailler."
    return options[0]


def _collect_next_steps(topics: List[str]) -> List[str]:
    remediation = get_remediation()
    steps: List[str] = []
    for topic in topics:
        steps.extend(remediation.get(topic, []))
    # déduplication en conservant l'ordre
    seen: set[str] = set()
    ordered: List[str] = []
    for step in steps:
        if step not in seen:
            seen.add(step)
            ordered.append(step)
    return ordered or ["Revoir les notions abordées et demander une validation humaine."]


async def grader_agent(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Corrige un ensemble d'exercices à partir d'un barème défini dans pedagogy.yaml."""

    grader_input = ctx.get("grader_input", {})
    scheme_id = grader_input.get("scheme_id", "bac_maths_gen")
    scores_by_criterion: Dict[str, float] = grader_input.get("scores", {})
    remediation_topics: List[str] = grader_input.get("remediation_topics", ["recurrence"])

    scheme = get_scheme(scheme_id)

    rubric_result: List[Dict[str, Any]] = []
    achieved_score = 0.0
    max_score = 0.0

    for exercise in scheme.get("exercises", []):
        for criterion in exercise.get("rubric", []):
            label = criterion["criterion"]
            max_points = float(criterion["points"])
            raw_points = float(scores_by_criterion.get(label, 0.0))
            earned_points = max(0.0, min(raw_points, max_points))
            achieved_score += earned_points
            max_score += max_points

            is_strength = earned_points >= max_points * 0.9
            feedback = _select_feedback(is_strength)
            rubric_result.append(
                {
                    "criterion": label,
                    "points": earned_points,
                    "feedback": feedback,
                }
            )

    next_steps = _collect_next_steps(remediation_topics)

    ctx["correction"] = {
        "exercise_id": grader_input.get("exercise_id", "composite"),
        "score": round(achieved_score, 2),
        "rubric": rubric_result,
        "next_steps": next_steps,
        "max_score": round(max_score, 2),
    }
    return ctx
