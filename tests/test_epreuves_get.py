from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.factories import create_student


@pytest.mark.integration
def test_dashboard_role_guard_blocks_wrong_student_scope(client: TestClient, db_session: Session):
    student = create_student(db_session)
    other_student = create_student(db_session)

    headers = {"X-Role": "student", "X-Student-Id": str(other_student.id)}
    response = client.get(
        "/dashboard/summary",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.integration
def test_dashboard_parent_requires_student_scope(client: TestClient, db_session: Session):
    student = create_student(db_session)
    headers = {"X-Role": "parent"}
    response = client.get(
        "/dashboard/summary",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.integration
def test_dashboard_admin_access_without_scope(client: TestClient, db_session: Session):
    student = create_student(db_session)
    headers = {"X-Role": "admin"}
    response = client.get(
        "/dashboard/summary",
        params={"student_id": str(student.id)},
        headers=headers,
    )
    assert response.status_code == 200
