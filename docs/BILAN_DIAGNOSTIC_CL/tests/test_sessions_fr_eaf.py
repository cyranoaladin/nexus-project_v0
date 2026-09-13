"""FR-EAF est sensible à la session : Pot-Bouille est faux en 2027, juste en 2028.

La purge de Pot-Bouille valait pour la session 2027, pas pour l'instrument. Le contrôle
confronte désormais chaque œuvre citée au programme de **la session de l'assemblage**, et
un assemblage ne retient que des items applicables à cette session.
"""
import json
import shutil
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import contexte as C  # noqa: E402
import diffusabilite as DIF  # noqa: E402
import validate_instrument as VI  # noqa: E402


@pytest.fixture(scope="module")
def refs():
    return VI.charger_referentiels(None)


def items_de(codes):
    banque = json.loads((RACINE / "instruments" / "FR-EAF" / "banque.json")
                        .read_text(encoding="utf-8"))
    return [i for i in banque["items"] if i["item_id"] in codes]


# ─────────────────────────────── la session de l'assemblage est déclarée

def test_chaque_assemblage_fr_eaf_declare_sa_session():
    attendu = {"standard": 2027, "ecrit": 2027, "oral": 2027,
               "standard_2028": 2028, "ecrit_2028": 2028, "oral_2028": 2028}
    trouve = {}
    for f in sorted((RACINE / "instruments" / "FR-EAF" / "assemblages").glob("*.json")):
        asm = json.loads(f.read_text(encoding="utf-8"))
        assert asm["version"] == f.stem, f.name
        trouve[asm["version"]] = asm["session_baccalaureat_finale"]
    assert trouve == attendu


def test_les_items_propres_a_une_session_le_declarent():
    """Seul l'objet d'étude renouvelé sessionne des items : le reste est commun.

    Poésie, littérature d'idées et théâtre sont maintenus du programme 2025-2026 au
    programme 2026-2027 : un item qui porte sur eux vaut pour les deux sessions. Le roman
    est renouvelé : les items qui en dépendent existent en deux exemplaires.

    Trois couples, non deux. Le troisième — CULT-05 pour 2027, CULT-09 pour 2028 — est
    né le 2026-09-11 de l'insertion des textes : l'item nommait le mouvement de Zola, et
    « Pot-Bouille » est devenu le support du bloc C de la session 2028. Chaque session
    interroge désormais le romancier qui n'est pas celui de son propre bloc C.
    """
    tous = items_de({f"FR-EAF-CULT-0{n}" for n in range(1, 10)})
    sessionnes = {i["item_id"]: i["sessions_applicables"]
                  for i in tous if i.get("sessions_applicables")}
    assert sessionnes == {"FR-EAF-CULT-04": [2027], "FR-EAF-CULT-05": [2027],
                          "FR-EAF-CULT-06": [2027], "FR-EAF-CULT-07": [2028],
                          "FR-EAF-CULT-08": [2028], "FR-EAF-CULT-09": [2028]}
    communs = {i["item_id"] for i in tous if not i.get("sessions_applicables")}
    assert communs == {"FR-EAF-CULT-01", "FR-EAF-CULT-02", "FR-EAF-CULT-03"}
    for i in tous:
        if not i.get("sessions_applicables"):
            assert "session 20" not in i["enonce"], \
                f"{i['item_id']} est réputé commun mais nomme une session"


# ─────────────────────────────── F · la même œuvre, deux verdicts

def test_pot_bouille_est_refuse_dans_un_assemblage_2027(refs):
    faux = [{"item_id": "X-01", "enonce": "Parmi ces œuvres, laquelle est un roman ?",
             "propositions": {"A": "« Pot-Bouille » de Zola"}, "cle": {"reponse": "A"}}]
    err = VI.controler_oeuvres_citees(faux, refs, "essai", 2027)
    assert err and "2028" in err[0]


def test_pot_bouille_est_accepte_dans_un_assemblage_2028(refs):
    """La preuve demandée : l'œuvre est réglementaire pour la session 2028."""
    juste = [{"item_id": "X-01", "enonce": "Parmi ces œuvres, laquelle est un roman ?",
              "propositions": {"A": "« Pot-Bouille » de Zola"}, "cle": {"reponse": "A"}}]
    assert VI.controler_oeuvres_citees(juste, refs, "essai", 2028) == []


def test_la_peau_de_chagrin_est_juste_en_2027_et_etrangere_a_2028(refs):
    item = [{"item_id": "X-02", "enonce": "« La Peau de chagrin » de Balzac.",
             "propositions": {}, "cle": {}}]
    assert VI.controler_oeuvres_citees(item, refs, "essai", 2027) == []
    assert VI.controler_oeuvres_citees(item, refs, "essai", 2028)


def test_la_boetie_vaut_pour_les_deux_sessions(refs):
    item = [{"item_id": "X-03",
             "enonce": "« Discours de la servitude volontaire » de La Boétie.",
             "propositions": {}, "cle": {}}]
    for session in (2027, 2028):
        assert VI.controler_oeuvres_citees(item, refs, "essai", session) == [], session


def test_sans_session_declaree_le_controle_ne_juge_pas(refs):
    item = [{"item_id": "X-04", "enonce": "« Pot-Bouille » de Zola.",
             "propositions": {}, "cle": {}}]
    assert VI.controler_oeuvres_citees(item, refs, "essai", None) == []


# ─────────────────────────────── G · un assemblage ne prend que ses items

def test_un_item_de_2027_est_refuse_dans_un_assemblage_2028():
    err = VI.controler_items_sessionnes(items_de({"FR-EAF-CULT-04"}), "essai", 2028)
    assert err and "2027" in err[0]


def test_le_meme_item_est_admis_dans_son_assemblage():
    assert VI.controler_items_sessionnes(items_de({"FR-EAF-CULT-04"}), "essai", 2027) == []


def test_un_item_sans_session_est_admis_partout():
    for session in (2027, 2028, None):
        assert VI.controler_items_sessionnes(items_de({"FR-EAF-CULT-01"}), "essai",
                                             session) == []


def test_un_item_sessionne_dans_un_assemblage_sans_session_est_refuse():
    err = VI.controler_items_sessionnes(items_de({"FR-EAF-CULT-04"}), "essai", None)
    assert err and "n'en déclare aucune" in err[0]


# ─────────────────────────────── le support suit lui aussi sa session

def test_un_support_2027_dans_un_assemblage_2028_est_refuse(refs, tmp_path):
    sup = {"titre": "t", "texte": "x", "reference": "r", "edition": "e",
           "oeuvre_au_programme": {"session": 2027, "voie": "generale",
                                   "objet_etude": "roman_recit", "auteur": "Balzac",
                                   "oeuvre": "La Peau de chagrin"}}
    assert VI.controler_oeuvre_au_programme(sup, refs, "essai", 2027) == []
    err = VI.controler_oeuvre_au_programme(sup, refs, "essai", 2028)
    assert err and "session 2028" in err[0]


def test_l_instrument_reel_est_valide_et_diffusable():
    """La session-sensibilité n'a rien cassé, et les six supports sont insérés.

    FR-EAF était bloqué par ses emplacements réservés — bloc B commun aux deux sessions,
    bloc C propre à chacune. Les trois passages transcrits le 2026-09-11 les ont remplis ;
    il ne reste aucun motif.
    """
    err, _ = VI.valider(RACINE / "instruments" / "FR-EAF")
    assert err == [], err
    s = DIF.statut("FR-EAF")
    assert s["diffusable"], s["motifs"]


def test_les_assemblages_2028_ne_different_que_par_ce_qui_depend_de_la_session():
    """La session 2028 est créée par différence, non par recopie d'un instrument entier."""
    for v in ("standard", "ecrit", "oral"):
        a = json.loads((RACINE / "instruments" / "FR-EAF" / "assemblages"
                        / f"{v}.json").read_text(encoding="utf-8"))
        b = json.loads((RACINE / "instruments" / "FR-EAF" / "assemblages"
                        / f"{v}_2028.json").read_text(encoding="utf-8"))
        items_a = [i for bl in a["blocs"] for i in bl["items"]]
        items_b = [i for bl in b["blocs"] for i in bl["items"]]
        assert len(items_a) == len(items_b)
        diff = {x for x in items_a} ^ {x for x in items_b}
        # Les quatre items de culture littéraire portent sur l'œuvre au programme ; depuis
        # l'insertion des textes, l'item de rédaction du bloc C en fait autant, puisque
        # son axe est écrit sur le passage réellement remis.
        attendu = {"FR-EAF-CULT-04", "FR-EAF-CULT-05", "FR-EAF-CULT-06",
                   "FR-EAF-CULT-07", "FR-EAF-CULT-08", "FR-EAF-CULT-09"}
        if v != "oral":
            attendu |= {"FR-EAF-REDA-01", "FR-EAF-REDA-04"}
        assert diff == attendu, (v, diff)
        assert [bl["bloc"] for bl in a["blocs"]] == [bl["bloc"] for bl in b["blocs"]]


def test_le_bloc_c_de_2028_designe_zola_et_porte_son_passage():
    """Désignation du 2026-09-11, passage arrêté le 2026-09-11, transcrit le 2026-09-11.

    La désignation nomme l'œuvre, le chapitre, l'édition source et les deux ancres ; la
    transcription les remplit. Les deux doivent coïncider : un support qui ne commence
    pas où la désignation le dit n'est pas le passage désigné.
    """
    prog = json.loads((RACINE / "referentiels" / "programmes_examen.json")
                      .read_text(encoding="utf-8"))
    d = prog["designations_oeuvres"]["FR-EAF/bloc_C@2028"]
    assert d["etat"] == "désignée"
    assert (d["auteur"], d["oeuvre"]) == ("Émile Zola", "Pot-Bouille")
    passage = d["passage"]
    assert passage["statut"] == "passage_transcrit"
    assert passage["edition"] == "G. Charpentier, 1883"
    assert passage["chapitre"] == "chapitre I"
    assert passage["mots"] == 326
    # Le passage refusé est conservé avec son motif : une décision ne s'efface pas.
    assert passage["remplace"]["ancre_debut"].startswith("La chambre, carrée")
    assert "8 lignes" in passage["remplace"]["motif_du_refus"]

    b = json.loads((RACINE / "instruments" / "FR-EAF" / "assemblages"
                    / "standard_2028.json").read_text(encoding="utf-8"))
    sup, = [s for bl in b["blocs"] if bl["bloc"] == "C" for s in bl["supports"]]
    assert sup["oeuvre_au_programme"]["oeuvre"] == "Pot-Bouille"
    texte = " ".join(sup["texte"].split())
    assert texte.startswith("Au plafond, deux grandes fentes coupaient les caissons")
    assert texte.endswith("tout retomba à un silence de mort.")
    assert len(texte.split()) == passage["mots"]
    assert "EXTRAIT À INSÉRER" not in sup["texte"]
    # La division en paragraphes de l'édition est conservée : les répliques de
    # l'architecte ne sont pas fondues dans le récit.
    assert sup["texte"].count("\n\n") + 1 == 6


def test_le_passage_de_zola_ne_vit_que_dans_les_assemblages_de_2028():
    """Contre-test de session : le texte de 2028 n'entre dans aucun support de 2027.

    Les phrases intérieures de la séquence portent l'analyse ; les retrouver ailleurs
    signifierait qu'un candidat de la session 2027 travaille sur l'œuvre de 2028.
    """
    interieures = ("bâti pour faire de l", "la façade en belle pierre",
                   "tristesse de tombe", "déverse d", "majesté bourgeoise",
                   "voix canailles", "Angèle")
    ailleurs = [RACINE / "referentiels" / "programmes_examen.json",
                RACINE / "README_ETAT.md",
                RACINE / "instruments" / "FR-EAF" / "assemblages" / "standard.json",
                RACINE / "instruments" / "FR-EAF" / "assemblages" / "ecrit.json",
                RACINE / "instruments" / "FR-EAF" / "assemblages" / "oral.json"]
    for f in ailleurs:
        texte = f.read_text(encoding="utf-8")
        for phrase in interieures:
            assert phrase not in texte, f"{phrase} dans {f.name}"
    # Dans la banque, ces phrases n'ont le droit d'apparaître que dans un item déclaré
    # pour la seule session 2028 : c'est là que le corrigé cite le texte qu'il corrige.
    banque = json.loads((RACINE / "instruments" / "FR-EAF" / "banque.json")
                        .read_text(encoding="utf-8"))
    for it in banque["items"]:
        brut = json.dumps(it, ensure_ascii=False)
        if any(p in brut for p in interieures):
            assert it.get("sessions_applicables") == [2028], it["item_id"]
    for v in ("standard_2028", "ecrit_2028"):
        sup = json.loads((RACINE / "instruments" / "FR-EAF" / "assemblages"
                          / f"{v}.json").read_text(encoding="utf-8"))
        texte = [s["texte"] for bl in sup["blocs"] if bl["bloc"] == "C"
                 for s in bl["supports"]][0]
        assert "majesté bourgeoise" in texte


def test_le_bloc_b_est_commun_aux_deux_sessions():
    """La Boétie n'est pas renouvelé : la même désignation vaut pour 2027 et 2028."""
    prog = json.loads((RACINE / "referentiels" / "programmes_examen.json")
                      .read_text(encoding="utf-8"))
    a = prog["designations_oeuvres"]["FR-EAF/bloc_B"]
    b = prog["designations_oeuvres"]["FR-EAF/bloc_B@2028"]
    assert (a["auteur"], a["oeuvre"]) == (b["auteur"], b["oeuvre"])
    assert a["session"] == 2027 and b["session"] == 2028
    assert "Discours de la servitude volontaire" in C.oeuvres_de_session(2027)
    assert "Discours de la servitude volontaire" in C.oeuvres_de_session(2028)


# ─────────────────────────────── H · les jeux portent leur contexte temporel

@pytest.mark.parametrize("dossier,finale,annee,mode", [
    ("_MAQUETTE", 2027, "2026-2027", "meme_session"),
    ("_MAQUETTE_P2", 2027, "2026-2027", "meme_session"),
    ("_MAQUETTE_P1", 2027, "2025-2026", "anticipation"),
    ("_MAQUETTE_P1_2026_2027_SPECIFIQUES", 2028, "2026-2027", "anticipation"),
])
def test_chaque_jeu_declare_les_trois_axes(dossier, finale, annee, mode):
    qp = json.loads((RACINE / "instruments" / dossier / "qp.json")
                    .read_text(encoding="utf-8"))
    r = qp["reponses"]
    assert r["session_baccalaureat_finale"] == finale
    assert r["annee_scolaire_passation_ea"] == annee
    assert r["mode_passation_ea"] == mode
    assert C.contexte(r)["coherent"], "les trois axes du jeu ne sont pas cohérents entre eux"


def test_le_jeu_p1_historique_dit_quil_ne_lest_plus():
    """La cohorte 2025-2026 reste au dépôt, mais elle n'est plus le P1 opérationnel."""
    qp = json.loads((RACINE / "instruments" / "_MAQUETTE_P1" / "qp.json")
                    .read_text(encoding="utf-8"))
    assert qp["session_date"].startswith("2025-")
    assert "historique" in qp["note"]
    assert "_MAQUETTE_P1_2026_2027_SPECIFIQUES" in qp["note"]


def test_le_p1_operationnel_est_diagnostique_en_septembre_2026():
    qp = json.loads((RACINE / "instruments" / "_MAQUETTE_P1_2026_2027_SPECIFIQUES"
                     / "qp.json").read_text(encoding="utf-8"))
    assert qp["session_date"].startswith("2026-")
    assert qp["reponses"]["session_baccalaureat_finale"] == 2028


def test_un_candidat_de_2028_ne_peut_pas_composer_un_assemblage_de_2027(monkeypatch):
    """Le garde-fou du moteur, maintenant que la sélection choisit la bonne session.

    La sélection d'instruments filtre sur la session déclarée par l'enregistrement du
    catalogue : un candidat de 2028 reçoit les assemblages de 2028. Le contrôle du moteur
    reste néanmoins la dernière barrière — si une sélection se trompait, il refuserait de
    mesurer au mauvais programme plutôt que de produire un score.
    """
    import maquette_bilan as M
    import maquette_donnees as D
    fige = [("QP", "standard"), ("FR-EAF", "standard"), ("MET", "standard")]
    monkeypatch.setattr(M, "instruments_passes", lambda qp, cat: fige)
    monkeypatch.setattr(D, "liste_effective_des_instruments_a_passer",
                        lambda qp, cat: fige)
    dossier = RACINE / "instruments" / "_MAQUETTE_P1_2026_2027_SPECIFIQUES"
    with pytest.raises(SystemExit) as exc:
        M.Bilan(dossier=dossier)
    assert "session 2027" in str(exc.value) and "2028" in str(exc.value)
