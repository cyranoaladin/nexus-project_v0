#!/usr/bin/env python3
"""Tests de bout en bout — Nexus Planning Studio (Playwright + Chromium, file://).

Usage : python3 tests/e2e.py [--screens DIR]
Chaque test affiche PASS/FAIL ; le code de sortie est 1 si un test échoue.
"""
import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
URL = INDEX.as_uri()
SCREENS = None
for i, a in enumerate(sys.argv):
    if a == "--screens" and i + 1 < len(sys.argv):
        SCREENS = Path(sys.argv[i + 1])
        SCREENS.mkdir(parents=True, exist_ok=True)

results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond or not detail else " — " + str(detail)))


def shot(page, name):
    if SCREENS:
        page.screenshot(path=str(SCREENS / f"{name}.png"), full_page=False)


def state(page, expr):
    return page.evaluate("() => " + expr)


def card_box(page, sid):
    return page.evaluate(
        "(id) => { const el = document.querySelector('.card[data-id=\"' + id + '\"]'); if (!el) return null; const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; }",
        sid,
    )


def col_box(page, day):
    return page.evaluate(
        "(day) => { const el = document.querySelector('.grid-col[data-day=\"' + day + '\"]'); const r = el.getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; }",
        day,
    )


def drag_to(page, sid, day, start_time):
    """Glisse la carte `sid` vers le jour `day` à l'heure `start_time` (HH:MM)."""
    box = card_box(page, sid)
    assert box, f"carte {sid} introuvable"
    col = col_box(page, day)
    geo = page.evaluate("() => { const g = document.querySelector('.grid'); return {from: Number(g.dataset.from), slot: Number(g.dataset.slot), slots: Number(g.style.getPropertyValue('--slots'))}; }")
    hh, mm = [int(x) for x in start_time.split(":")]
    minutes = hh * 60 + mm
    slot_h = col["h"] / geo["slots"]
    target_y = col["y"] + (minutes - geo["from"]) / geo["slot"] * slot_h
    grab_dy = 8
    page.mouse.move(box["x"] + box["w"] / 2, box["y"] + grab_dy)
    page.mouse.down()
    page.mouse.move(box["x"] + box["w"] / 2 + 20, box["y"] + grab_dy + 20, steps=4)
    page.mouse.move(col["x"] + col["w"] / 2, target_y + grab_dy, steps=8)
    page.mouse.move(col["x"] + col["w"] / 2, target_y + grab_dy + 1, steps=2)
    page.mouse.up()
    page.wait_for_timeout(120)


def main():
    console_errors = []
    page_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="fr-FR")
        page = ctx.new_page()
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        # ---------- A/B/C : chargement, console, planning visible
        page.goto(URL)
        page.wait_for_selector(".card")
        page.wait_for_timeout(300)
        n_cards = page.locator(".card").count()
        check("A chargement initial (file://)", page.title().startswith("Nexus Planning Studio"), page.title())
        check("B aucune erreur console", not console_errors and not page_errors, (console_errors + page_errors)[:3])
        check("C planning visible : 44 cartes actives", n_cards == 44, n_cards)
        s = state(page, "({sessions: Nexus.app.state.data.sessions.length, errors: Nexus.app.state.diagnostics.counts.error, warnings: Nexus.app.state.diagnostics.counts.warning})")
        check("C2 45 séances chargées, 0 erreur initiale", s["sessions"] == 45 and s["errors"] == 0, s)
        shot(page, "01-semaine")

        # ---------- D/E : édition enseignant + propagation du nom
        page.click("#btnSettings")
        page.wait_for_selector(".modal")
        first_item = page.locator(".manage-item").first
        first_item.locator("button", has_text="Modifier").click()
        page.fill(".manage-item .edit input[type=text] >> nth=1", "Alaeddine Ben Rhouma")
        page.locator(".manage-item .edit button", has_text="Enregistrer").click()
        page.wait_for_timeout(200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        names = page.evaluate("() => Array.from(document.querySelectorAll('.card .teacher')).map(e => e.textContent)")
        m1_cards = state(page, "Nexus.app.state.data.sessions.filter(s => s.teacherId === 'teacher-m1' && s.active).length")
        check("D édition enseignant (nom)", state(page, "Nexus.app.state.data.teachers[0].name") == "Alaeddine Ben Rhouma")
        check("E renommage propagé sur toutes les cartes de M1", names.count("Alaeddine Ben Rhouma") == m1_cards, (names.count("Alaeddine Ben Rhouma"), m1_cards))
        shot(page, "02-config-enseignants")

        # ---------- F : déplacement par glisser-déposer
        sid = "SAT-0900-T-MA"  # Terminale Maths A samedi 09:00 → jeudi 09:00
        drag_to(page, sid, "THU", "09:00")
        moved = state(page, f"(() => {{ const s = Nexus.app.state.data.sessions.find(x => x.id === '{sid}'); return s.day + ' ' + s.start + ' ' + s.end; }})()")
        check("F déplacement séance (drag & drop) samedi → jeudi 09h00", moved == "THU 09:00 11:00", moved)
        shot(page, "03-drag-drop")

        # ---------- G : conflit enseignant (M1 : Maths A jeudi 09:00 ; on y met NSI Tle (M1) aussi)
        drag_to(page, "SAT-1115-T-NSI", "THU", "09:15")
        diag = state(page, "Nexus.app.state.diagnostics.issues.filter(i => i.code === 'TEACHER_OVERLAP').map(i => i.message)")
        check("G conflit enseignant détecté", len(diag) >= 1, diag)
        check("G2 message compréhensible (nom réel)", any("Alaeddine Ben Rhouma" in m for m in diag), diag)
        shot(page, "04-conflit-enseignant")

        # ---------- J/K : annuler / rétablir
        page.click("#btnUndo")
        after_undo = state(page, "Nexus.app.state.data.sessions.find(x => x.id === 'SAT-1115-T-NSI').day")
        check("J annuler restaure le déplacement", after_undo == "SAT", after_undo)
        page.keyboard.press("Control+Shift+Z")
        page.wait_for_timeout(100)
        after_redo = state(page, "Nexus.app.state.data.sessions.find(x => x.id === 'SAT-1115-T-NSI').day")
        check("K rétablir (Ctrl+Shift+Z)", after_redo == "THU", after_redo)
        page.keyboard.press("Control+Z")
        page.keyboard.press("Control+Z")
        page.wait_for_timeout(100)
        check("J2 double annulation : planning initial", state(page, "Nexus.app.state.data.sessions.find(x => x.id === 'SAT-0900-T-MA').day") == "SAT")

        # ---------- H : conflit de salle via l'éditeur (Terminale Philo dim 09:00 S2 → S1, où Maths A dim 09:00 est en S1)
        page.click(".card[data-id='SUN-0900-T-PHILO']")
        page.wait_for_selector("#sideBody form")
        page.select_option("#sess-roomId", "room-1")
        preview = page.locator("#editorPreview").inner_text()
        check("H1 aperçu du conflit avant application", "Conflit bloquant" in preview and "Salle 1" in preview, preview[:120])
        page.click("#btnApply")
        page.wait_for_timeout(150)
        rooms_conf = state(page, "Nexus.app.state.diagnostics.issues.filter(i => i.code === 'ROOM_OVERLAP').length")
        check("H conflit de salle détecté", rooms_conf >= 1, rooms_conf)
        check("H2 carte marquée en erreur", page.locator(".card[data-id='SUN-0900-T-PHILO'].sev-error").count() == 1)
        shot(page, "05-conflit-salle")
        page.click("#btnUndo")

        # ---------- I : interchanger deux séances
        a = "SAT-1115-P1-SVT"
        b = "SAT-1445-P1-SES"
        before_a = state(page, f"(() => {{ const s = Nexus.app.state.data.sessions.find(x => x.id === '{a}'); return [s.day, s.start, s.end, s.roomId]; }})()")
        before_b = state(page, f"(() => {{ const s = Nexus.app.state.data.sessions.find(x => x.id === '{b}'); return [s.day, s.start, s.end, s.roomId]; }})()")
        page.click(f".card[data-id='{a}']")
        page.click(f".card[data-id='{b}']", modifiers=["Control"])
        page.wait_for_selector("#swapbar:not([hidden])")
        page.locator("#swapbar button", has_text="Interchanger").click()
        page.wait_for_timeout(150)
        after_a = state(page, f"(() => {{ const s = Nexus.app.state.data.sessions.find(x => x.id === '{a}'); return [s.day, s.start, s.end, s.roomId]; }})()")
        after_b = state(page, f"(() => {{ const s = Nexus.app.state.data.sessions.find(x => x.id === '{b}'); return [s.day, s.start, s.end, s.roomId]; }})()")
        subj = state(page, f"Nexus.app.state.data.sessions.find(x => x.id === '{a}').subjectId")
        check("I interchange de deux séances (jour/heure/salle)", after_a == before_b and after_b == before_a and subj == "SVT", (after_a, after_b))
        shot(page, "06-interchange")

        # ---------- L : localStorage persistant après rechargement
        page.reload()
        page.wait_for_selector(".card")
        page.wait_for_timeout(200)
        persisted = state(page, "(() => { const d = Nexus.app.state.data; return [d.teachers[0].name, d.sessions.find(x => x.id === '" + a + "').start]; })()")
        check("L sauvegarde locale conservée après rechargement", persisted == ["Alaeddine Ben Rhouma", before_b[1]], persisted)

        # ---------- M : export JSON puis réimport
        with page.expect_download() as dl:
            page.click("#btnExportJson")
        path = dl.value.path()
        exported = json.loads(Path(path).read_text(encoding="utf-8"))
        check("M1 export JSON valide", exported.get("schemaVersion") == 2 and len(exported["sessions"]) == 45, len(exported.get("sessions", [])))
        # modifie l'état puis réimporte le fichier exporté
        page.click("#btnReset")
        page.wait_for_selector(".modal")
        page.locator(".modal button", has_text="Réinitialiser").click()
        page.wait_for_timeout(200)
        check("O2 réinitialisation restaure le planning initial", state(page, "Nexus.app.state.data.teachers[0].name") != "Alaeddine Ben Rhouma")
        page.set_input_files("#importFile", path)
        page.wait_for_selector(".modal")
        page.locator(".modal button", has_text="Remplacer").click()
        page.wait_for_timeout(200)
        reimported = state(page, "(() => { const d = Nexus.app.state.data; return {name: d.teachers[0].name, n: d.sessions.length, ids: d.sessions.map(s => s.id).sort().join(',')}; })()")
        check("M2 réimport identique", reimported["name"] == "Alaeddine Ben Rhouma" and reimported["n"] == 45 and reimported["ids"] == ",".join(sorted(s["id"] for s in exported["sessions"])), reimported["n"])

        # import v1 (ancien format) + import corrompu
        v1 = ROOT / "data" / "legacy" / "planning.v1.original.json"
        page.set_input_files("#importFile", str(v1))
        page.wait_for_selector(".modal")
        warn = page.locator(".modal").inner_text()
        check("M3 import ancien format : conversion annoncée", "Ancien format" in warn, warn[:80])
        page.locator(".modal button", has_text="Remplacer").click()
        page.wait_for_timeout(200)
        check("M4 import v1 migré (45 séances, ids enseignants v2)", state(page, "Nexus.app.state.data.sessions.length") == 45 and state(page, "Nexus.app.state.data.sessions[0].teacherId") == "teacher-m2")
        bad = ROOT / "tests" / "_corrupt.json"
        bad.write_text("{ ceci n'est pas du JSON", encoding="utf-8")
        page.set_input_files("#importFile", str(bad))
        page.wait_for_selector(".modal")
        check("M5 import corrompu refusé proprement", "Import impossible" in page.locator(".modal").inner_text())
        page.keyboard.press("Escape")
        bad.unlink()

        # ---------- N : export CSV
        with page.expect_download() as dl:
            page.click("#btnExportCsv")
        csv = Path(dl.value.path()).read_bytes()
        text = csv.decode("utf-8-sig")
        check("N export CSV (BOM UTF-8, ; , accents)", csv.startswith(b"\xef\xbb\xbf") and text.splitlines()[0].startswith("Jour;Début;Fin") and "Mathématiques" in text and len(text.splitlines()) == 46, len(text.splitlines()))

        # ---------- P : filtre Terminale
        page.select_option("#filterLevel", "TERMINALE")
        levels = page.evaluate("() => Array.from(document.querySelectorAll('.card .card-level .long')).map(e => e.textContent.trim())")
        check("P filtre Terminale", levels and all(l.startswith("Terminale") for l in levels), (len(levels), levels[:3]))
        shot(page, "07-filtre-terminale")
        page.click("#filterClear")

        # ---------- Q : filtre candidats individuels
        page.click("#filterAudience button[data-value='CL']")
        badges = page.evaluate("() => Array.from(document.querySelectorAll('.card .card-top .badge-aud')).map(e => e.textContent)")
        check("Q filtre Candidats individuels", badges and all(b == "CL" for b in badges) and len(badges) == 22, (len(badges), set(badges)))
        shot(page, "08-filtre-cl")
        page.click("#filterClear")

        # ---------- R : Salle 3 exceptionnelle
        page.click(".card[data-id='SAT-0900-P1-F']")
        page.wait_for_selector("#sideBody form")
        page.select_option("#sess-roomId", "room-3")
        page.click("#btnApply")
        page.wait_for_timeout(150)
        exc = state(page, "Nexus.app.state.diagnostics.issues.filter(i => i.code === 'EXCEPTIONAL_ROOM').length")
        check("R Salle 3 permise mais signalée (avertissement)", exc == 1 and state(page, "Nexus.app.state.diagnostics.counts.error") == 0, exc)
        check("R2 carte Salle 3 marquée", page.locator(".card[data-id='SAT-0900-P1-F'].room-exceptional").count() == 1)

        # ---------- S : plus de 3 cours simultanés → erreur bloquante
        page.evaluate("""() => {
          Nexus.app.commit('test 4 cours', d => {
            d.sessions.push(Nexus.newSession(d, {id: 't-x1', day: 'SAT', start: '09:00', end: '11:00', roomId: 'room-1', teacherId: 'teacher-svt', subjectId: 'SVT', level: 'PREMIERE', groupId: ''}));
            d.sessions.push(Nexus.newSession(d, {id: 't-x2', day: 'SAT', start: '09:00', end: '11:00', roomId: 'room-2', teacherId: 'teacher-ses', subjectId: 'SES', level: 'PREMIERE', groupId: ''}));
          });
        }""")
        page.wait_for_timeout(100)
        over = state(page, "Nexus.app.state.diagnostics.issues.filter(i => i.code === 'CENTER_OVERFLOW').length")
        three = state(page, "Nexus.app.state.diagnostics.issues.filter(i => i.code === 'CENTER_EXCEPTIONAL').length")
        check("S 4 cours simultanés = erreur bloquante", over >= 1 and state(page, "Nexus.app.state.diagnostics.counts.error") >= 1, (over, three))
        # filtre conflits
        page.click("#filterConflicts")
        conflict_cards = page.locator(".card").count()
        check("S2 filtre « Conflits » n'affiche que les séances concernées", 0 < conflict_cards < 44, conflict_cards)
        shot(page, "09-conflits")
        page.click("#filterClear")
        page.click("#btnUndo")
        page.click("#btnUndo")

        # ---------- diagnostic → clic → mise en évidence
        page.click("#tabDiagnostic")
        page.locator(".issue").first.click()
        page.wait_for_timeout(100)
        check("Diagnostic : clic met en évidence les séances", page.locator(".card.highlight").count() >= 1)
        page.keyboard.press("Escape")

        # ---------- vues
        for v in ["teacher", "room", "audience", "level", "list"]:
            page.click(f"#viewSwitch button[data-view='{v}']")
            page.wait_for_timeout(80)
            shot(page, f"10-vue-{v}")
        check("Vue liste : 44 lignes", page.locator("tr.session").count() == 44, page.locator("tr.session").count())
        page.click("#viewSwitch button[data-view='teacher']")
        banner = page.locator("#teacherBanner").inner_text()
        check("Vue enseignant : bannière de charge", "heures" in banner.lower() and "séances" in banner.lower(), banner[:80])
        page.click("#viewSwitch button[data-view='room']")
        lanes = page.locator(".grid-lanes").first.inner_text()
        check("Vue salles : lanes Salle 1 / Salle 2", "Salle 1" in lanes and "Salle 2" in lanes, lanes)
        page.click("#viewSwitch button[data-view='week']")

        # ---------- ajout / duplication / désactivation / suppression
        n0 = state(page, "Nexus.app.state.data.sessions.length")
        page.click("#btnNewSession")
        page.wait_for_timeout(100)
        check("Ajout de séance", state(page, "Nexus.app.state.data.sessions.length") == n0 + 1)
        page.locator("#sideBody button", has_text="Dupliquer").click()
        page.wait_for_timeout(100)
        check("Duplication de séance", state(page, "Nexus.app.state.data.sessions.length") == n0 + 2)
        page.locator("#sideBody button", has_text="Désactiver").click()
        page.wait_for_timeout(100)
        check("Désactivation : séance conservée mais masquée", state(page, "Nexus.app.state.data.sessions.filter(s => !s.active).length") == 2 and page.locator(".card").count() == n0 - 1 + 1)
        page.click("label:has(#filterInactive)")
        page.wait_for_timeout(80)
        page.locator("#sideBody button", has_text="Supprimer").click()
        page.wait_for_selector(".modal")
        page.locator(".modal button.danger").click()
        page.wait_for_timeout(120)
        check("Suppression avec confirmation", state(page, "Nexus.app.state.data.sessions.length") == n0 + 1)
        page.click("#btnUndo")
        check("Annuler après suppression", state(page, "Nexus.app.state.data.sessions.length") == n0 + 2)
        page.click("#btnUndo"); page.click("#btnUndo"); page.click("#btnUndo")
        page.click("label:has(#filterInactive)")

        # ---------- suppression enseignant référencé → réaffectation
        page.click("#btnSettings")
        page.wait_for_selector(".modal")
        page.locator(".manage-item").nth(1).locator("button", has_text="Supprimer").click()
        page.wait_for_timeout(100)
        txt = page.locator(".modal").last.inner_text()
        check("Suppression enseignant : références annoncées", "séances" in txt and "Réaffecter" in txt, txt[:100])
        page.locator(".modal").last.locator("button", has_text="Annuler").click()
        page.keyboard.press("Escape")

        # ---------- O : impression (feuille de style print)
        page.emulate_media(media="print")
        hidden = page.evaluate("() => ['.topbar', '.toolbar', '.side', '.statusbar'].map(s => getComputedStyle(document.querySelector(s)).display)")
        header = page.evaluate("() => getComputedStyle(document.querySelector('#printHeader')).display")
        check("O impression : contrôles masqués, en-tête visible", all(d == "none" for d in hidden) and header != "none", (hidden, header))
        if SCREENS:
            page.pdf(path=str(SCREENS / "print.pdf"), landscape=True, format="A4", print_background=True)
        page.emulate_media(media="screen")

        # ---------- T : responsive
        page.set_viewport_size({"width": 1024, "height": 768})
        page.wait_for_timeout(200)
        shot(page, "11-tablette")
        side_hidden = page.evaluate("() => getComputedStyle(document.querySelector('.side')).transform")
        page.click(".card >> nth=0")
        page.wait_for_timeout(250)
        check("T1 tablette : panneau latéral en tiroir, ouvert au clic", side_hidden != "none" and page.evaluate("() => document.body.classList.contains('side-open')"))
        page.keyboard.press("Escape")
        page.set_viewport_size({"width": 390, "height": 800})
        page.wait_for_timeout(300)
        days_visible = page.locator(".grid-col").count()
        check("T2 mobile : vue journée sélectionnable", days_visible == 1 and page.locator("#mobileDays button").count() == 7, days_visible)
        page.locator("#mobileDays button").nth(5).click()
        page.wait_for_timeout(100)
        check("T3 mobile : changement de jour", page.locator(".grid-col[data-day='SAT']").count() == 1)
        no_hscroll = page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
        check("T4 mobile : pas de défilement horizontal de la page", no_hscroll)
        shot(page, "12-mobile")
        page.set_viewport_size({"width": 1440, "height": 900})

        # ---------- zoom 125 % (simulation par largeur réduite)
        page.set_viewport_size({"width": 1152, "height": 720})
        page.wait_for_timeout(200)
        shot(page, "13-zoom125")
        overflow = page.evaluate("() => Array.from(document.querySelectorAll('.card')).filter(c => c.scrollWidth > c.clientWidth + 2).length")
        check("Zoom 125 % : cartes sans débordement horizontal", overflow == 0, overflow)

        # ---------- localStorage corrompu
        page.evaluate("() => localStorage.setItem(Nexus.STORAGE_KEY, '{corrompu')")
        page.reload()
        page.wait_for_selector(".card")
        page.wait_for_timeout(200)
        check("localStorage corrompu : planning initial rechargé + message", state(page, "Nexus.app.state.data.sessions.length") == 45 and page.locator(".toast").count() >= 1)

        check("B2 aucune erreur console sur l'ensemble du parcours", not console_errors and not page_errors, (console_errors + page_errors)[:5])
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} tests réussis")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
