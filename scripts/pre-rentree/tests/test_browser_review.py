import json
import subprocess
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]


def test_browser_review_captures_desktop_mobile_and_axe_results(tmp_path: Path):
    html = tmp_path / "guide.html"
    html.write_text(
        """<!doctype html><html lang="fr"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Guide</title><style>a:focus-visible{outline:3px solid #000}</style></head>
        <body><a href="#main">Aller au contenu</a><header><p>Nexus Réussite</p></header>
        <main id="main"><h1>Guide parents</h1><p>Contenu de contrôle.</p></main>
        <footer><a href="mailto:contact@nexusreussite.academy">Nous écrire</a></footer></body></html>""",
        encoding="utf-8",
    )
    output = tmp_path / "review"
    subprocess.run(
        [
            "node",
            str(SCRIPT_DIR / "capture-review-html.mjs"),
            "--html",
            str(html),
            "--output",
            str(output),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    report = json.loads((output / "browser-accessibility-report.json").read_text(encoding="utf-8"))
    assert report["AUTOMATED_BROWSER_ACCESSIBILITY_CHECK"] == "PASS"
    assert report["AXE_VIOLATION_COUNT"] == 0
    assert report["REMOTE_DEPENDENCY_COUNT"] == 0
    assert report["JAVASCRIPT_DEPENDENCY_COUNT"] == 0
    assert report["MOBILE_HORIZONTAL_OVERFLOW_PX"] == 0
    assert (output / "guide-desktop.png").is_file()
    assert (output / "guide-mobile.png").is_file()

