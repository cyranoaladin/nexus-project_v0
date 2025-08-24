from fastapi.testclient import TestClient
from main import app

def test_health_and_metrics():
    client = TestClient(app)
    r = client.get('/health')
    assert r.status_code == 200
    r2 = client.get('/metrics')
    assert r2.status_code == 200
