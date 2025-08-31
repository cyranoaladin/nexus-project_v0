from fastapi.testclient import TestClient
from services.pdf_generator_service.main import app

def test_health_and_metrics_pdf():
    client = TestClient(app)
    r = client.get('/health')
    assert r.status_code == 200
    r2 = client.get('/metrics')
    assert r2.status_code == 200
