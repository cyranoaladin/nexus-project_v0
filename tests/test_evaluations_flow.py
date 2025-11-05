from __future__ import annotations

import hashlib
import json
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.factories import create_student

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


def _bootstrap_evaluation(client: TestClient, db_session: Session):
    student = create_student(db_session)

    coach_headers = {
        "X-Role": "coach",
        "X-Actor-Id": str(student.user_id),
    }

    generate_payload = {
        "student_id": str(student.id),
        "subject": "maths",
        "level": "Terminale",
        "duration": 60,
        "constraints": {"chapter": "ALG-01"},
    }

    generate_response = client.post("/eval/generate", json=generate_payload, headers=coach_headers)
    assert generate_response.status_code == 200
    evaluation = generate_response.json()

    student_headers = {
        "X-Role": "student",
        "X-Student-Id": str(student.id),
        "X-Actor-Id": str(student.user_id),
    }

    return {
        "student": student,
        "coach_headers": coach_headers,
        "student_headers": student_headers,
        "evaluation": evaluation,
        "evaluation_id": evaluation["id"],
    }


@pytest.mark.integration
def test_evaluation_generation_submission_and_grading_flow(client: TestClient, db_session: Session):
    setup = _bootstrap_evaluation(client, db_session)
    student = setup["student"]
    coach_headers = setup["coach_headers"]
    student_headers = setup["student_headers"]
    evaluation = setup["evaluation"]
    evaluation_id = setup["evaluation_id"]
    assert evaluation["status"] == "Proposé"
    constraints_payload = evaluation["metadata"].get("constraints")
    assert constraints_payload is not None
    assert json.loads(constraints_payload) == {"chapter": "ALG-01"}

    file_content = b"Simulated evaluation copy"
    expected_hash = hashlib.sha256(file_content).hexdigest()

    submission_response = client.post(
        "/eval/grade",
        data={"evaluation_id": evaluation_id},
        files=[("files", ("copy.pdf", file_content, "application/pdf"))],
        headers=student_headers,
    )

    assert submission_response.status_code == 200
    submitted = submission_response.json()
    assert submitted["status"] == "Soumis"
    assert submitted["submissions"]
    submission_files = submitted["submissions"][0]["files"]
    assert submission_files[0]["sha256"] == expected_hash
    assert submission_files[0]["size_bytes"] == len(file_content)

    coach_grade_response = client.post(
        "/eval/grade",
        data={
            "evaluation_id": evaluation_id,
            "score_20": "17.5",
            "feedback": json.dumps([
                {"step": "Analyse", "comment": "Excellente copie"}
            ]),
        },
        headers=coach_headers,
    )

    assert coach_grade_response.status_code == 200
    graded = coach_grade_response.json()
    assert graded["status"] == "Corrigé"
    assert graded["score_20"] == pytest.approx(17.5)
    assert graded["feedback"]
    assert graded["feedback"][0]["comment"] == "Excellente copie"
    assert graded["history"]
    assert graded["history"][0]["score_20"] == pytest.approx(17.5)

    list_response = client.get(
        "/dashboard/evaluations",
        params={"student_id": str(student.id)},
        headers=student_headers,
    )
    assert list_response.status_code == 200
    evaluations = list_response.json()
    assert len(evaluations) == 1
    assert evaluations[0]["id"] == evaluation_id
    assert evaluations[0]["status"] == "Corrigé"
    assert evaluations[0]["submissions"][0]["files"][0]["sha256"] == expected_hash
    assert evaluations[0]["history"]
    assert json.loads(evaluations[0]["metadata"]["constraints"]) == {"chapter": "ALG-01"}


@pytest.mark.integration
def test_evaluation_rejects_unsupported_file_type(client: TestClient, db_session: Session):
    setup = _bootstrap_evaluation(client, db_session)
    student = setup["student"]
    evaluation_id = setup["evaluation_id"]
    student_headers = setup["student_headers"]

    invalid_response = client.post(
        "/eval/grade",
        data={"evaluation_id": evaluation_id},
        files=[("files", ("copy.txt", BytesIO(b"plain text"), "text/plain"))],
        headers=student_headers,
    )

    assert invalid_response.status_code == 400
    assert "Formats autorisés" in invalid_response.json()["detail"]

    list_response = client.get(
        "/dashboard/evaluations",
        params={"student_id": str(student.id)},
        headers=student_headers,
    )
    assert list_response.status_code == 200
    evaluations = list_response.json()
    assert evaluations[0]["status"] == "Proposé"
    assert not evaluations[0].get("submissions")


@pytest.mark.integration
def test_evaluation_rejects_oversized_file(client: TestClient, db_session: Session):
    setup = _bootstrap_evaluation(client, db_session)
    student = setup["student"]
    evaluation_id = setup["evaluation_id"]
    student_headers = setup["student_headers"]

    oversized_content = BytesIO(b"a" * (MAX_FILE_SIZE_BYTES + 1))

    response = client.post(
        "/eval/grade",
        data={"evaluation_id": evaluation_id},
        files=[("files", ("copy.pdf", oversized_content, "application/pdf"))],
        headers=student_headers,
    )

    assert response.status_code == 400
    assert "Fichier trop volumineux" in response.json()["detail"]

    list_response = client.get(
        "/dashboard/evaluations",
        params={"student_id": str(student.id)},
        headers=student_headers,
    )
    assert list_response.status_code == 200
    evaluations = list_response.json()
    assert evaluations[0]["status"] == "Proposé"
    assert not evaluations[0].get("submissions")
