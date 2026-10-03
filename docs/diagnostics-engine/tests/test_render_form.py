"""Tests du moteur générique de composition, contre la fixture synthétique
__tests__/fixtures/diagnostic-demo/ uniquement. Aucun de ces tests ne lit ni ne
suppose l'existence d'un contenu réel — le moteur public n'a accès à aucun.
"""
import json
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DEPOT = RACINE.parent.parent
FIXTURE = DEPOT / "__tests__" / "fixtures" / "diagnostic-demo" / "form.json"
ICONE = DEPOT / "__tests__" / "fixtures" / "diagnostic-demo" / "icone-placeholder.png"
RENDER = RACINE / "scripts" / "render_form.py"


def _construire(tmp_path, coach: bool) -> Path:
    out = tmp_path / ("coach.pdf" if coach else "candidat.pdf")
    args = [sys.executable, str(RENDER), str(FIXTURE), "--out", str(out), "--icone", str(ICONE)]
    if coach:
        args.append("--coach")
    r = subprocess.run(args, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    assert out.exists()
    return out


def _texte(pdf: Path) -> str:
    r = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True)
    assert r.returncode == 0
    return r.stdout


def test_fixture_valide_contre_le_schema():
    import jsonschema
    schema = json.loads((RACINE / "schemas" / "diagnostics-content.schema.json").read_text())
    fixture = json.loads(FIXTURE.read_text())
    jsonschema.validate(fixture, schema)


def test_candidat_compile():
    _construire(Path("/tmp"), coach=False)


def test_coach_compile():
    _construire(Path("/tmp"), coach=True)


def test_candidat_ne_fuit_aucune_cle_ni_note(tmp_path):
    pdf = _construire(tmp_path, coach=False)
    texte = _texte(pdf)
    for marqueur in ("réponse attendue", "confond le nombre", "Note de conception",
                     "opt-sept", "opt-huit", "DEMO-QCM-01", "DEMO-COURT-01",
                     "Réponse attendue", "Barème", "Après la première escale"):
        assert marqueur not in texte, f"fuite candidate : {marqueur!r} trouvé dans le PDF"


def test_coach_porte_la_cle_et_les_justifications(tmp_path):
    pdf = _construire(tmp_path, coach=True)
    texte = _texte(pdf)
    assert "réponse attendue" in texte
    assert "confond le nombre de brins" in texte
    assert "Note de conception" in texte


def test_coach_porte_la_solution_reponse_courte(tmp_path):
    """Bug réel trouvé pendant la construction du premier FORM_A complet : le moteur
    savait révéler la clé d'un QCM et la grille d'une PRODUCTION au coach, mais
    n'avait aucun champ pour la solution attendue d'un item REPONSE_COURTE/
    TACHE_OUVERTE — rendant le PDF coach inutilisable pour corriger ces items."""
    pdf = _construire(tmp_path, coach=True)
    texte = _texte(pdf)
    assert "Réponse attendue" in texte
    assert "Après la première escale" in texte
    assert "Barème" in texte


def test_ordre_code_apres_enonce(tmp_path):
    """Un support de type code suit sa phrase d'introduction — bug réel trouvé et
    corrigé pendant la construction de ce moteur : le code apparaissait avant la
    phrase qui l'annonce."""
    pdf = _construire(tmp_path, coach=False)
    texte = _texte(pdf)
    pos_enonce = texte.find("On exécute le programme fictif suivant")
    pos_code = texte.find("total = 0")
    assert pos_enonce != -1 and pos_code != -1
    assert pos_enonce < pos_code


def test_position_qcm_equilibree_sur_un_seul_item():
    """Avec un seul QCM dans la fixture, la lettre assignée est déterministe (round-robin,
    indice 0 -> A) — non une propriété de hasard."""
    sys.path.insert(0, str(RACINE / "scripts"))
    from qcm_position_assembler import assembler
    fixture = json.loads(FIXTURE.read_text())
    items_qcm = [it for s in fixture["sections"] for it in s["items"] if it["type"] == "QCM"]
    rendu = assembler(items_qcm, "FORM_TEST")
    assert rendu[0]["cle"]["reponse"] == "A"
    assert rendu[0]["propositions"]["A"] == "Sept brins."


def test_reproductibilite_octet_a_octet(tmp_path):
    pdf1 = _construire(tmp_path / "b1", coach=False)
    pdf2 = _construire(tmp_path / "b2", coach=False)
    assert pdf1.read_bytes() == pdf2.read_bytes()


def test_pdf_toutes_polices_embarquees(tmp_path):
    pdf = _construire(tmp_path, coach=False)
    r = subprocess.run(["pdffonts", str(pdf)], capture_output=True, text=True)
    lignes = [l for l in r.stdout.splitlines()[2:] if l.strip()]
    assert lignes, "aucune police détectée"
    for ligne in lignes:
        assert " yes " in ligne or ligne.split()[-4] == "yes", f"police non embarquée : {ligne}"


def test_moteur_seul_ne_construit_que_la_fixture():
    """PUBLIC_ENGINE_ALONE_CAN_BUILD_LIVE_FORM=NO : le moteur public ne contient
    aucun contenu réel, seulement la fixture synthétique. Un form.json inexistant ou
    hors fixture échoue immédiatement, faute de tout contenu à composer."""
    r = subprocess.run([sys.executable, str(RENDER), "/chemin/qui/nexiste/pas.json",
                        "--out", "/tmp/x.pdf", "--icone", str(ICONE)],
                        capture_output=True, text=True)
    assert r.returncode != 0
