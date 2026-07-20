from pathlib import Path


LOCK = Path(__file__).resolve().parents[1] / "requirements.lock"


def test_python_document_dependencies_are_exactly_pinned_and_compatible():
    requirements = {
        name: version
        for line in LOCK.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#")
        for name, version in [line.split("==", maxsplit=1)]
    }

    assert all(requirements.values())
    assert requirements["opencv-python-headless"] == "4.13.0.92"
    assert tuple(map(int, requirements["numpy"].split("."))) >= (2, 0, 0)
