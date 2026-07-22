from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def test_every_embedded_font_has_an_ofl_notice_and_license_text():
    notices = (REPO_ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    license_text = (REPO_ROOT / "licenses/fonts/OFL-1.1.txt").read_text(encoding="utf-8")

    for family, filename in (
        ("DM Sans", "app/fonts/DMSans-Variable.woff2"),
        ("Fraunces", "app/fonts/Fraunces-Variable.woff2"),
        ("IBM Plex Mono", "app/fonts/IBMPlexMono-Regular.woff2"),
    ):
        assert family in notices
        assert filename in notices
        assert "SIL Open Font License 1.1" in notices
    assert "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007" in license_text
    assert "licenses/fonts/OFL-1.1.txt" in notices
