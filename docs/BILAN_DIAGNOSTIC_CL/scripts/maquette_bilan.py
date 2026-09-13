#!/usr/bin/env python3
"""Maquette du bilan — application manuelle et documentée des règles du § 8.2.

Ce script n'est pas le générateur de bilan. Il applique les règles une à une sur le jeu
fictif de instruments/_MAQUETTE/ et produit un document qui montre, pour chaque règle, la
donnée d'entrée, la règle citée et le résultat obtenu. C'est ce document que la direction
pédagogique audite avant toute généralisation.

Rien n'est écrit en dur ici, ni seuil ni matière :

- les seuils et les règles de décision viennent de referentiels/regles_bilan.json ;
- les règles de couverture, de competences.json ;
- les niveaux de méthode, de dimensions_met.json ;
- les matières passées se déduisent du profil et des spécialités déclarés au
  questionnaire de parcours, par le catalogue et sa convention de sélection de version ;
- les valeurs du jeu de données viennent de instruments/_MAQUETTE/specification.json.

Les phrases qui citent une règle composent leurs chiffres depuis ces mêmes sources :
aucun nombre n'est écrit dans un texte, le texte référence une valeur calculée.
"""
from __future__ import annotations

import collections
import csv
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
sys.path.insert(0, str(RACINE / "scripts"))
from maquette_donnees import instruments_passes  # noqa: E402


def indicateurs_de_charge(somme: float, profil: str, regles: dict) -> dict:
    """Les deux indicateurs de charge, et ce qui les sépare (Q-27, EC-18).

    Le § 8.2 déclenche le séquencement quand la somme des rythmes **dépasse** 20 h : la
    comparaison est stricte, 20 h ne déclenche pas. La direction ajoute un indicateur
    distinct — la vigilance — qui se déclenche quand la somme **atteint** 15 h : la
    comparaison est large, 15 h déclenche. Les deux ne disent pas la même chose et le
    second n'entraîne aucun séquencement.

    Avant Q-27, un seul seuil portait les deux rôles : le signal de 15 h imposait le
    séquencement que le Cahier réservait au dépassement de 20 h.
    """
    al = regles["alerte_charge"]
    vig = al["vigilance_charge_elevee"]
    concerne = profil in al["profils"]
    return {"concerne": concerne,
            "sequencement": concerne and somme > al["seuil_heures"],
            "vigilance": concerne and somme >= vig["seuil_heures"],
            "seuil_sequencement": al["seuil_heures"],
            "seuil_vigilance": vig["seuil_heures"]}


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def lire_csv(p):
    with open(p, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def heures(v):
    """3.0 -> « 3 h » ; 1.5 -> « 1 h 30 »."""
    h, m = int(v), round((v - int(v)) * 60)
    return f"{h} h" + (f" {m:02d}" if m else "")


class Bilan:
    def __init__(self, chemin_qp=None, dossier=None):
        dossier = Path(dossier) if dossier else MAQ
        self.ref = charger(RACINE / "referentiels" / "competences.json")
        self.cat_brut = charger(RACINE / "referentiels" / "catalogue_instruments.json")
        self.cat = {(i["code"], i["version"]): i for i in self.cat_brut["instruments"]}
        self.met_ref = charger(RACINE / "referentiels" / "dimensions_met.json")
        self.regles = charger(RACINE / "referentiels" / "regles_bilan.json")
        self.dossier = dossier
        self.qp = charger(chemin_qp or dossier / "qp.json")
        self.met = charger(dossier / "met.json")
        self.lignes = lire_csv(dossier / "saisie.csv")
        self.grilles = lire_csv(dossier / "grilles.csv")
        self.echelle_grille = self.ref["conventions"]["echelle_grille"]["max"]
        self.per = {p["code"]: p for p in self.ref["perimetres"]}
        self.comps = {(p["code"], c["code"]): c
                      for p in self.ref["perimetres"] for c in p["competences"]}

        self.groupes_ref = self.ref["conventions"]["groupes_planification"]
        self.instruments = instruments_passes(self.qp, self.cat_brut)
        self.porteurs = [(c, v) for c, v in self.instruments if self.cat[(c, v)]["porte_items"]]
        self.perimetres_passes = [self.cat[(c, v)]["perimetre"] for c, v in self.porteurs]

        # Un périmètre est une unité de diagnostic, un groupe une unité de plan (EC-28).
        # Le périmètre sans groupe déclaré forme le sien, dont le code est le sien.
        self.groupe_de = {pc: self.per[pc].get("groupe_planification", pc)
                          for pc in self.perimetres_passes}
        self.groupes = collections.OrderedDict()
        for pc in self.perimetres_passes:
            self.groupes.setdefault(self.groupe_de[pc], []).append(pc)

        self.banques, self.blocs_item = {}, {}
        finale = self.qp["reponses"].get("session_baccalaureat_finale")
        for code, version in self.porteurs:
            f = RACINE / "instruments" / code / "banque.json"
            self.banques[code] = {i["item_id"]: i for i in charger(f)["items"]}
            a = charger(RACINE / "instruments" / code / "assemblages" / f"{version}.json")
            # Un assemblage dont le contenu dépend d'un programme d'œuvres déclare sa
            # session finale : un candidat d'une autre session ne peut pas le composer.
            session_asm = a.get("session_baccalaureat_finale")
            if session_asm is not None and finale is not None and int(session_asm) != int(finale):
                raise SystemExit(
                    f"{code}/{version} relève de la session {session_asm}, le candidat de "
                    f"la session {finale} : aucun assemblage disponible pour sa session")
            for bl in a["blocs"]:
                for iid in bl["items"]:
                    self.blocs_item[(code, version, iid)] = bl["bloc"]

    # ─────────────────────────────────────────────────────────── § 5.1 à § 5.3
    def scores(self):
        obt = collections.Counter(); maxi = collections.Counter()
        nb = collections.Counter(); src = collections.Counter()
        pal = collections.defaultdict(lambda: [0, 0])
        err = collections.defaultdict(collections.Counter)
        bloc = collections.defaultdict(lambda: [0, 0])
        blanc = collections.Counter(); total = collections.Counter()
        self.criteres = collections.defaultdict(dict)

        self.bloc0 = {}
        fmt = self.ref["conventions"]["identifiant_bloc_0"]["format"]
        for l in self.lignes:
            code, version = l["instrument"].split("/")
            if l["item_id"] not in self.banques[code]:
                # Ligne de bloc 0 : l'identifiant se décompose selon la convention, la
                # colonne response porte la valeur de l'échelle, la colonne score est vide.
                prefixe = fmt.replace("<CODE_INSTRUMENT>", code).replace("<COMPETENCE>", "")
                comp = l["item_id"][len(prefixe):]
                pc = self.cat[(code, version)]["perimetre"]
                if l["response"].strip():
                    self.bloc0[(pc, comp)] = int(l["response"])
                continue
            it = self.banques[code][l["item_id"]]
            pc = self.cat[(code, version)]["perimetre"]
            b = self.blocs_item[(code, version, l["item_id"])]
            k = (pc, it["competence"]); s = int(l["score"])
            obt[k] += s; maxi[k] += it["score_max"]; nb[k] += 1
            pal[(pc, it["competence"], it["palier"])][0] += s
            pal[(pc, it["competence"], it["palier"])][1] += it["score_max"]
            bloc[(pc, b)][0] += s; bloc[(pc, b)][1] += it["score_max"]
            total[pc] += 1
            if l["response"] == "" and s == 0 and it["type"] != "C":
                blanc[pc] += 1
            if l["error_code"]:
                err[k][l["error_code"]] += 1

        for g in self.grilles:
            code, version = g["instrument"].split("/")
            if code not in self.banques or g["item_id"] not in self.banques[code]:
                continue
            it = self.banques[code][g["item_id"]]
            cr = next(c for c in it["grille"] if c["code"] == g["criterion"])
            pc = self.cat[(code, version)]["perimetre"]
            b = self.blocs_item[(code, version, g["item_id"])]
            k = (pc, cr["competence"]); s = int(g["score"])
            e = self.echelle_grille
            obt[k] += s; maxi[k] += e; nb[k] += 1; src[k] += 1
            pal[(pc, cr["competence"], it["palier"])][0] += s
            pal[(pc, cr["competence"], it["palier"])][1] += e
            bloc[(pc, b)][0] += s; bloc[(pc, b)][1] += e
            self.criteres[(pc, g["criterion"])] = {"obtenu": s, "max": e,
                                                   "competence": cr["competence"],
                                                   "intitule": cr.get("intitule", g["criterion"])}

        # Grilles coach : elles n'alimentent que les périmètres réellement passés
        self.grilles_coach = {}
        for code, version in self.instruments:
            f = RACINE / "instruments" / code / "definition.json"
            if not f.exists():
                continue
            d = charger(f)
            crit = {c["code"]: c for c in d["criteres"]}
            cibles = {a["competence"]: a["perimetre"] for a in d["perimetres_alimentes"]}
            releve = {}
            for g in self.grilles:
                if g["instrument"] != f"{code}/{version}":
                    continue
                c = crit[g["criterion"]]; s = int(g["score"])
                releve[g["criterion"]] = {"score": s, "intitule": c["intitule"],
                                          "competence": c["competence"]}
                pc = cibles.get(c["competence"])
                if pc is None or pc not in self.perimetres_passes:
                    continue
                k = (pc, c["competence"])
                obt[k] += s; maxi[k] += self.echelle_grille
                nb[k] += 1; src[k] += 1
            if releve:
                self.grilles_coach[code] = {
                    "titre": d["titre"], "criteres": releve,
                    "obtenu": sum(x["score"] for x in releve.values()),
                    "max": self.echelle_grille * len(releve),
                    "alimente": sorted({(cibles[c["competence"]], c["competence"])
                                        for c in crit.values()
                                        if cibles.get(c["competence"]) in self.perimetres_passes})}

        regles = self.ref["conventions"]["regles_couverture"]
        res = {}
        for k, m in maxi.items():
            comp = self.comps.get(k)
            part = obt[k] / m if m else 0
            if comp and comp["type"] == "indicateur_transversal":
                eq = regles["indicateur_transversal"]["equivalences"]
                sources = (eq["grille_externe_declaree"] if comp.get("evaluee_par") not in
                           (None, "criteres_C") else src[k])
                evalue = sources >= regles["indicateur_transversal"]["sources_min"]
                motif = f"{sources} source" + ("s" if sources > 1 else "")
            elif comp and comp.get("grille_externe") \
                    and comp.get("evaluee_par") != "criteres_C":
                # EC-25 — mesurée par une grille coach : couverte par ses critères
                # propriétaires, non par des items qu'elle n'a pas.
                r = regles["evaluee_par_grille_externe"]
                evalue = src[k] >= r["criteres_proprietaires_min"]
                motif = (f"{src[k]} critère" + ("s" if src[k] > 1 else "")
                         + f" de {comp['grille_externe']}")
            else:
                evalue = nb[k] >= regles["competence_ordinaire"]["items_min"]
                motif = f"{nb[k]} mesure" + ("s" if nb[k] > 1 else "")
            res[k] = {"part": part, "obtenu": obt[k], "max": m, "motif": motif, "n": nb[k],
                      "niveau": self.niveau(part) if evalue
                      else self.regles["niveaux_competence"]["non_evalue"]["libelle"],
                      "evalue": evalue, "palier": self.profondeur(pal, k),
                      "palier_maximal_teste": self.palier_maximal_teste(pal, k),
                      "erreurs": err[k],
                      "type": comp["type"] if comp else "ordinaire",
                      "intitule": self.intitule(*k) if comp else k[1],
                      "famille": comp.get("famille") if comp else None}
        self.res, self.pal, self.bloc = res, pal, bloc
        self.blanc, self.total_items = blanc, total
        return res

    def version_passee(self, pc):
        """La version de l'instrument par lequel ce périmètre a été mesuré."""
        return next((v for c, v in self.porteurs
                     if self.cat[(c, v)]["perimetre"] == pc), None)

    def intitule(self, pc, comp):
        """L'intitulé d'une compétence dans la version réellement passée.

        Un assemblage N1 n'assemble aucun item de Terminale : annoncer « … en Terminale »
        ferait croire au candidat que son score porte sur des notions qui n'ont pas été
        mesurées. Le référentiel porte l'intitulé versionné, le moteur le choisit.
        """
        c = self.comps[(pc, comp)]
        return (c.get("intitule_par_version") or {}).get(self.version_passee(pc),
                                                         c["intitule"])

    def niveau(self, part):
        for p in self.regles["niveaux_competence"]["paliers"]:
            if part >= p["seuil_min"]:
                return p["libelle"]
        raise ValueError("aucun palier ne couvre cette part : référentiel incomplet")

    def ecart(self, ref):
        """Un écart au Cahier n'est raconté qu'une fois, dans le registre de
        competences.json. Les référentiels de règles n'en portent que la référence."""
        return next(e for e in self.ref["ecarts_cahier"] if e["ref"] == ref)

    def seuil_du_niveau(self, libelle):
        return next(p["seuil_min"] for p in self.regles["niveaux_competence"]["paliers"]
                    if p["libelle"] == libelle)

    def profondeur(self, pal, k):
        f = self.regles["palier_de_profondeur"]["fraction"]
        num, den = f["numerateur"], f["denominateur"]
        atteints = [p for p in ("D1", "D2", "D3")
                    if pal[(k[0], k[1], p)][1] > 0
                    and pal[(k[0], k[1], p)][0] * den >= num * pal[(k[0], k[1], p)][1]]
        return atteints[-1] if atteints else "—"

    def palier_maximal_teste(self, pal, k):
        """Le palier le plus haut que l'assemblage a **proposé** pour cette compétence.

        Le palier atteint et le palier le plus haut testé ne disent pas la même chose. Une
        compétence servie sur D1 et D2 ne peut pas rendre D3, et un candidat classé D2 n'a
        pas échoué au raisonnement : il n'y a pas été interrogé dans ce domaine. Le rendu
        doit le dire, faute de quoi le palier se lit comme un plafond de capacité alors
        qu'il est un plafond de mesure (EC-32).
        """
        proposes = [p for p in ("D1", "D2", "D3") if pal[(k[0], k[1], p)][1] > 0]
        return proposes[-1] if proposes else "—"

    # ──────────────────────────────────────────── score au format de l'épreuve
    def score_format_epreuve(self, pc: str = "MATH-EA"):
        """Le score du candidat à la pondération officielle 6/14, et non à celle de la banque.

        Le barème interne du diagnostic n'est pas celui de l'épreuve : la banque compte
        57 ou 59 points selon le parcours, répartis selon ce que chaque compétence exige
        de mesures, tandis que l'épreuve compte 20 points dont 6 pour les automatismes et
        14 pour les exercices. Un score global de banque ne dit donc pas ce que vaudrait
        la copie à l'épreuve.

        Le calcul ne regarde que la **part réussie** de chaque partie : il ne dépend ni du
        nombre d'items, ni de leur barème interne. La correspondance entre les blocs du
        diagnostic et les deux parties officielles est lue au référentiel — elle se fait
        par registre de tâche, un QCM d'un côté, des exercices rédigés de l'autre — et le
        bloc D, qui n'a pas d'équivalent à l'épreuve, en est exclu.

        Rend None si le périmètre n'a pas été passé.
        """
        if pc not in self.perimetres_passes:
            return None
        prog = charger(RACINE / "referentiels" / "programmes_examen.json")
        fmt = prog["epreuves_anticipees"]["session_2027"]["mathematiques"]["format_epreuve"]
        # La pondération 6/14 est celle de cette épreuve et d'aucune autre : l'appliquer à
        # la philosophie ou au tronc commun produirait un nombre sans objet.
        if pc != fmt["perimetre"]:
            return None
        corr = fmt["correspondance_blocs"]
        parts = {p["code"]: p for p in fmt["parties"]}

        def partie_de(bloc, type_item):
            for code in parts:
                r = corr[code]
                if bloc in r["blocs"] and type_item in r["types_item"]:
                    return code
            return None

        obtenu = collections.Counter(); maximum = collections.Counter()
        items = collections.Counter()
        for code, version in self.porteurs:
            if self.cat[(code, version)]["perimetre"] != pc:
                continue
            for l in self.lignes:
                if l["instrument"] != f"{code}/{version}":
                    continue
                it = self.banques[code].get(l["item_id"])
                if it is None:
                    continue
                partie = partie_de(self.blocs_item[(code, version, l["item_id"])],
                                   it["type"])
                if partie is None:
                    continue
                obtenu[partie] += int(l["score"]); maximum[partie] += it["score_max"]
                items[partie] += 1
            for g in self.grilles:
                if g["instrument"] != f"{code}/{version}":
                    continue
                it = self.banques[code].get(g["item_id"])
                if it is None:
                    continue
                partie = partie_de(self.blocs_item[(code, version, g["item_id"])],
                                   it["type"])
                if partie is None:
                    continue
                obtenu[partie] += int(g["score"]); maximum[partie] += self.echelle_grille
                items[partie] += 1

        detail, total = collections.OrderedDict(), 0.0
        for code, p in parts.items():
            m = maximum[code]
            part = obtenu[code] / m if m else 0.0
            points = p["points_officiels"] * part
            total += points
            detail[code] = {"intitule": p["intitule"],
                            "intitule_court": p.get("intitule_court", p["intitule"]),
                            "obtenu": obtenu[code], "max": m,
                            "part": part, "points_officiels": p["points_officiels"],
                            "points": round(points, 2), "items": items[code]}
        hors = corr["hors_format"]
        return {"perimetre": pc, "sur": sum(p["points_officiels"] for p in parts.values()),
                "score": round(total, 1), "parties": detail,
                "blocs_hors_format": hors["blocs"], "motif_hors_format": hors["motif"]}

    def dependance_a_loutil(self, pc: str = "MATH-EA"):
        """L'hypothèse de dépendance à l'outil de calcul — nommée, jamais conclue.

        « Sans calculatrice » est une condition de l'épreuve, pas une capacité des
        programmes : aucune ligne des deux annexes ne la nomme. Le diagnostic la mesure
        malgré tout, parce qu'un échec en dit des choses différentes selon sa cause. Cet
        indicateur isole une seule de ces causes : le candidat tient les notions et
        décroche dès que le calcul doit être conduit à la main.

        Il ne se déclenche pas quand le reste du périmètre est faible : un candidat en
        difficulté partout n'est pas dépendant d'un outil. Il ne produit ni niveau ni
        palier — c'est une hypothèse de lecture, à confirmer en séance.
        """
        if pc not in self.perimetres_passes:
            return None
        prog = charger(RACINE / "referentiels" / "programmes_examen.json")
        regle = prog["epreuves_anticipees"]["session_2027"]["mathematiques"][
            "sans_calculatrice"]["indicateur_dependance"]
        parts = {k[1]: x["part"] for k, x in self.res.items()
                 if k[0] == pc and x["evalue"]}
        if "EXACT" not in parts or len(parts) < 2:
            return None
        autres = [v for c, v in parts.items() if c != "EXACT"]
        moyenne = sum(autres) / len(autres)
        ecart = moyenne - parts["EXACT"]
        seuil_consolidation = self.seuil_du_niveau("En consolidation")
        declenche = ecart >= regle["seuil_ecart"] and moyenne >= seuil_consolidation
        return {"perimetre": pc, "part_exact": parts["EXACT"], "part_autres": moyenne,
                "ecart": ecart, "seuil": regle["seuil_ecart"], "declenche": declenche,
                "regle": regle["regle"], "interdit": regle["interdit"]}

    # ────────────────────────────────────────────────────────────────── § 5.5
    def agregats(self):
        """Formules du § 5.5 appliquées à la lettre.

        Le score global est la moyenne des S(c) pondérée par le nombre de mesures de
        chaque compétence, non le rapport des points totaux : les deux diffèrent dès
        qu'un critère de production vaut trois points et un item fermé un seul. Les taux
        de prérequis et de tâche se prennent sur le bloc porté par l'item dans
        l'assemblage passé, non sur les blocs déclarés de sa compétence.
        """
        out = {}
        for pc in self.perimetres_passes:
            comps = [k for k in self.res if k[0] == pc and self.res[k]["evalue"]
                     and self.res[k]["type"] != "indicateur_transversal"]
            if not comps:
                continue
            n = sum(self.res[k]["n"] for k in comps)
            somme = sum(self.res[k]["part"] * self.res[k]["n"] for k in comps)
            a, c = self.bloc[(pc, "A")], self.bloc[(pc, "C")]
            out[pc] = {
                "global": somme / n if n else 0, "mesures": n,
                "prerequis": a[0] / a[1] if a[1] else None,
                "prerequis_points": tuple(a),
                "tache": c[0] / c[1] if c[1] else None,
                "tache_points": tuple(c),
                "non_reponse": self.blanc[pc] / self.total_items[pc]
                if self.total_items[pc] else 0}
        self.agr = out
        return out

    # ────────────────────────────────────────────────────────────────── § 8.2
    def module_entree(self, pc):
        m = self.regles["module_entree"]
        a = self.agr[pc]
        seuil = self.regles["agregats"]["prerequis"]["seuil_remise_a_niveau"]
        if a["prerequis"] is not None and a["prerequis"] < seuil:
            return (m["libelle_remise_a_niveau"], None,
                    f"taux de prérequis {a['prerequis']*100:.0f} % < {seuil*100:.0f} %")
        ordre = [c["code"] for c in self.per[pc]["competences"]]
        for cible in (("Fragile", "Non acquis"), ("En consolidation",)):
            for code in ordre:
                k = (pc, code)
                if k in self.res and self.res[k]["niveau"] in cible:
                    return (f"{code} — {self.res[k]['intitule']}", code,
                            f"première compétence classée {self.res[k]['niveau']} "
                            f"dans l'ordre des chapitres")
        return m["libelle_defaut"], None, "aucune compétence sous le seuil de consolidation"

    def niveau_entree(self, pc):
        """Le degré auquel le travail commence — distinct du module, qui est un intitulé.

        Le § 8.1 demande un « niveau d'entrée » dans la synthèse, le § 8.2 définit un
        « module d'entrée » : le premier est le degré du second. Les deux notions sont
        rendues par deux méthodes distinctes et ne portent jamais la même valeur, sauf
        « Remise à niveau » qui est à la fois le module et son degré.
        """
        module, code, _ = self.module_entree(pc)
        return self.res[(pc, code)]["niveau"] if code else module

    def libelle_groupe(self, g):
        decl = self.groupes_ref["groupes"].get(g)
        return decl["libelle"] if decl else self.per[g]["libelle"]

    def module_entree_groupe(self, g):
        """Le périmètre du groupe qui commande le module d'entrée, et les autres.

        Un groupe peut réunir plusieurs périmètres diagnostiques (EC-28). Le module
        prioritaire est celui du périmètre le plus grave ; les autres périmètres du groupe
        gardent le leur, rendu comme second objectif — jamais fusionné, jamais moyenné.
        """
        ordre = sorted(self.groupes[g], key=self.gravite)
        return ordre[0], ordre[1:]

    def rythme_groupe(self, g):
        """Maximum des rythmes du groupe, jamais leur somme (EC-28).

        Deux périmètres d'un même groupe sont une seule matière de travail : le niveau le
        plus faible de l'ensemble commande l'enveloppe, comme le niveau le plus faible
        d'une matière commande déjà la sienne (EC-17).
        """
        candidats = [(self.rythme(pc), pc) for pc in self.groupes[g]]
        (h, niveau), pc = max(candidats, key=lambda x: (x[0][0], -self.gravite(x[1])[0]))
        return h, niveau, pc

    def rythme(self, pc):
        module, _, _ = self.module_entree(pc)
        table = self.regles["rythmes_hebdomadaires"]["par_niveau"]
        rn = self.regles["module_entree"]["libelle_remise_a_niveau"]
        if module == rn:
            return table[rn], rn
        non_evalue = self.regles["niveaux_competence"]["non_evalue"]["libelle"]
        niveaux = [self.res[k]["niveau"] for k in self.res if k[0] == pc
                   and self.res[k]["niveau"] != non_evalue]
        ordre = [p["libelle"] for p in reversed(self.regles["niveaux_competence"]["paliers"])]
        pire = next((n for n in ordre if n in niveaux), ordre[-1])
        return table[pire], pire

    def competence_du_rythme(self, pc):
        """La compétence dont le niveau commande le rythme de la matière (EC-17).

        Le rythme se fonde sur le niveau le plus bas de la matière, qui n'est pas toujours
        celui du module d'entrée : le module suit l'ordre des chapitres, le rythme suit la
        gravité. Quand les deux diffèrent, le lecteur doit savoir où se trouve le niveau
        invoqué — sans quoi la phrase « module Fragile, rythme du Non acquis » est une
        énigme. Le départage est l'ordre des chapitres, comme partout ailleurs.
        """
        module, _, _ = self.module_entree(pc)
        if module == self.regles["module_entree"]["libelle_remise_a_niveau"]:
            return None
        _, niveau = self.rythme(pc)
        for c in self.per[pc]["competences"]:
            k = (pc, c["code"])
            if k in self.res and self.res[k]["evalue"] and self.res[k]["niveau"] == niveau:
                return c["code"]
        return None

    def evaluation_intermediaire(self, pc):
        """Portée restreinte au module d'entrée (décision C1)."""
        p = self.regles["evaluation_intermediaire"]["portee"]
        module, code, _ = self.module_entree(pc)
        if module == self.regles["module_entree"]["libelle_remise_a_niveau"]:
            seuil = self.seuil_du_niveau("En consolidation")
            comps = sorted({k[1] for k in self.res if k[0] == pc
                            and self.res[k]["evalue"] and self.res[k]["part"] < seuil
                            and self.bloc_de_competence(pc, k[1])})
            return comps, (f"module « {module} » : compétences du bloc A sous "
                           f"{seuil*100:.0f} %")
        if code:
            return [code], "compétence du module d'entrée"
        return [], "aucune compétence sous le seuil : rien à réévaluer"

    def bloc_de_competence(self, pc, comp):
        """Vrai si la compétence porte au moins un item du bloc A dans l'assemblage passé."""
        for code, version in self.porteurs:
            if self.cat[(code, version)]["perimetre"] != pc:
                continue
            for (c, v, iid), b in self.blocs_item.items():
                if (c, v) == (code, version) and b == "A" \
                        and self.banques[c][iid]["competence"] == comp:
                    return True
        return False

    def priorite(self):
        """Rangs du § 8.2, sur les groupes de planification (EC-16, EC-28).

        Le § 8.2 ordonne des matières ; la matière de travail est le groupe, non le
        périmètre diagnostique. Deux périmètres d'un même groupe portent donc un seul rang.
        """
        r = self.qp["reponses"]
        pr = self.regles["priorite_matieres"]
        profil = r["profil"]
        gr = self.groupe_de
        declaration = {f"EDS-{s}": i for i, s in enumerate(r["specialites"])}
        poursuivies = [gr[f"EDS-{s}"] for s in r["specialites"]
                       if s != r["specialite_abandonnee"] and f"EDS-{s}" in gr]
        abandonnee = gr.get(f"EDS-{r['specialite_abandonnee']}")
        # À gravité et à score égaux, l'ordre de déclaration au questionnaire départage :
        # les spécialités partagent le même coefficient, la règle du § 8.2 ne tranche pas.
        poursuivies.sort(key=lambda g: (self.gravite_groupe(g),
                                        min(declaration.get(pc, 0)
                                            for pc in self.groupes[g])))
        ordre, motifs = [], {}
        # EC-31 : le § 8.2 ne connaissait qu'une épreuve anticipée, le français. Depuis
        # Q-24 un candidat de première en présente deux, et la règle n'en ordonnait qu'une :
        # les mathématiques anticipées, matière la plus fragile du jeu P1 2026-2027,
        # figuraient au dernier rang derrière le tronc commun. La règle est générique.
        ea = pr["epreuves_anticipees_si_fragiles"]
        seuil_fr = self.seuil_du_niveau("En consolidation")
        deja_ordonnes = set(poursuivies) | ({abandonnee} if abandonnee else set())
        anticipees = [g for g in ea["groupes"]
                      if g in self.groupes and g not in deja_ordonnes
                      and self.porte_epreuve_anticipee(g)]
        score_de = {g: min(self.agr[pc]["global"] for pc in self.groupes[g])
                    for g in anticipees}
        fragiles = [g for g in anticipees
                    if profil in ea["profils"]
                    and score_de[g] < seuil_fr]
        # Départage : gravité du module d'entrée, puis score global le plus bas, puis
        # coefficient officiel décroissant — ce dernier ne tranche qu'un cas de bord.
        fragiles.sort(key=lambda g: (self.gravite_groupe(g), score_de[g],
                                     -ea["groupes"][g]["coefficient_officiel"]))
        avant = ea["placement"].get(profil) == "avant_les_specialites"

        def placer_fragiles():
            for g in fragiles:
                ordre.append(g)
                motifs[g] = (f"score global {score_de[g]*100:.0f} % sous le seuil du niveau "
                             f"En consolidation ({seuil_fr*100:.0f} %) : "
                             + ea["motif_rendu_fragile"])

        if avant:
            placer_fragiles()
        for g in poursuivies:
            ordre.append(g)
            pc, _ = self.module_entree_groupe(g)
            module, _, _ = self.module_entree(pc)
            motifs[g] = (f"spécialité poursuivie ; module « {module} », score global "
                         f"{self.agr[pc]['global']*100:.0f} % — départage par gravité du "
                         f"module, puis par score")
        if not avant:
            placer_fragiles()
        for g in (gr.get("PHI"),):
            if g in self.groupes:
                ordre.append(g)
                motifs[g] = "philosophie, après les spécialités poursuivies"
        if abandonnee in self.groupes and abandonnee not in ordre:
            ordre.append(abandonnee)
            motifs[abandonnee] = "spécialité abandonnée, après les spécialités poursuivies"
        for g in anticipees:
            if g not in ordre:
                ordre.append(g)
                motifs[g] = ea["motif_rendu_non_fragile"]
        # Ce que le § 8.2 n'ordonne pas est placé ensuite, dans l'ordre de naissance des
        # groupes. Le motif vient du référentiel : il nommait « tronc commun » l'épreuve
        # anticipée de mathématiques d'un candidat sans spécialité mathématiques (EC-31).
        pnn = pr["placement_non_ordonne"]["motifs"]
        for g in self.groupes:
            if g not in ordre:
                ordre.append(g)
                motifs[g] = pnn.get(g, pnn["_defaut"])
        return ordre, motifs

    def porte_epreuve_anticipee(self, g: str) -> bool:
        """Le groupe porte-t-il un instrument qui prépare une épreuve anticipée ?

        La qualité se lit au catalogue, jamais dans un code d'instrument : c'est elle qui
        dit quelles matières de travail sont dues pendant l'année de première, et donc
        lesquelles la règle de priorité peut promouvoir.
        """
        return any(self.cat[(code, version)].get("epreuve_anticipee")
                   and self.cat[(code, version)]["perimetre"] in self.groupes[g]
                   for code, version in self.instruments)

    def gravite_groupe(self, g):
        """La gravité d'un groupe est celle de son périmètre le plus grave."""
        return min(self.gravite(pc) for pc in self.groupes[g])

    def gravite(self, pc):
        """Clé de départage du § 8.2 précisée par P1 : gravité du module, puis score.

        Un score global voisin ne dit pas la même urgence selon que la matière relève
        d'une remise à niveau ou d'une consolidation.
        """
        echelle = self.regles["priorite_matieres"]["departage"]["gravite_module_entree"]
        module, code, _ = self.module_entree(pc)
        if module in echelle:
            rang = echelle.index(module)
        elif code:
            rang = echelle.index(self.res[(pc, code)]["niveau"])
        else:
            rang = len(echelle)
        return rang, self.agr[pc]["global"]

    def calibration_matiere(self, pc):
        p = self.regles["indice_calibration"]["portee"]["par_matiere"]
        percu = self.qp["reponses"].get(p["variable_qp"], {}).get(pc.removeprefix("EDS-"))
        if percu is None:
            return None
        return self._ecart(percu, self.agr[pc]["global"])

    def calibration_competences(self):
        """§ 5.4 — l'écart se lit entre le bloc 0 et le score de la même compétence (EC-23).

        Les domaines du bloc 0 sont alignés sur les compétences de l'instrument : c'est le
        grain le plus fin que la donnée permette, et le seul qui rende l'écart actionnable.
        Un domaine sans réponse ne produit pas d'écart de zéro : il ne produit rien.
        """
        out = []
        for k, percu in sorted(self.bloc0.items()):
            if k in self.res and self.res[k]["evalue"]:
                out.append((k, self._ecart(percu, self.res[k]["part"])))
        return out

    def calibrations_absentes(self):
        """Compétences dont le domaine de bloc 0 existe mais n'a pas été renseigné,
        et compétences évaluées sans domaine de bloc 0 dans leur assemblage."""
        sans_reponse, sans_domaine = [], []
        for code, version in self.porteurs:
            a = charger(RACINE / "instruments" / code / "assemblages" / f"{version}.json")
            pc = self.cat[(code, version)]["perimetre"]
            domaines = {d["competence"] for d in a["bloc_0"]["domaines"]}
            for comp in domaines:
                if (pc, comp) not in self.bloc0 and (pc, comp) in self.res:
                    sans_reponse.append((pc, comp))
            for k in self.res:
                if k[0] == pc and self.res[k]["evalue"] and k[1] not in domaines:
                    sans_domaine.append(k)
        return sorted(sans_reponse), sorted(sans_domaine)

    def _ecart(self, percu, mesure_part):
        c = self.regles["indice_calibration"]
        e = c["echelle_percue"]
        percu100 = (percu - e["min"]) / (e["max"] - e["min"]) * 100
        mesure = mesure_part * 100
        ecart = percu100 - mesure
        s = c["sens"]
        signal = (s["surestimation"] if ecart > c["ecart_signal"] else
                  s["sous_estimation"] if ecart < -c["ecart_signal"] else None)
        return {"percu": percu, "percu100": percu100, "mesure": mesure, "ecart": ecart,
                "signal": signal}

    def decision_grand_oral(self):
        g = self.regles["grand_oral"]
        rel = self.grilles_coach.get(g["instrument"])
        if not rel:
            return None
        part = rel["obtenu"] / rel["max"]
        cas = g["au_dessus"] if part >= g["seuil"] else g["en_dessous"]
        return {"part": part, "obtenu": rel["obtenu"], "max": rel["max"],
                "libelle": cas["libelle"], "texte": cas["texte"]}

    def vigilance_oral_francais(self):
        o = self.regles["oral_de_francais"]
        rel = self.grilles_coach.get(o["instrument"])
        if not rel:
            return None
        # À égalité, le premier dans l'ordre de la grille : c'est l'ordre dans lequel le
        # coach l'a renseignée. Un départage alphabétique n'aurait aucun sens pour lui.
        rang = {c: i for i, c in enumerate(rel["criteres"])}
        pire = min(rel["criteres"].items(), key=lambda kv: (kv[1]["score"], rang[kv[0]]))
        return {"releve": rel, "critere": pire[0], "intitule": pire[1]["intitule"],
                "score": pire[1]["score"], "part": rel["obtenu"] / rel["max"]}

    def statuts_a_signaler(self):
        s = self.regles["statut_specialite"]
        r = self.qp["reponses"]
        out = []
        for spe, statut in r.get("statut_par_specialite", {}).items():
            pc = f"EDS-{spe}"
            if statut == s["statut_declencheur"] and pc in self.agr \
                    and spe != r["specialite_abandonnee"]:
                out.append((pc, s["phrase"]))
        return out

    def profils_met(self):
        form = charger(RACINE / "instruments" / "MET" / "formulaire.json")
        poids = {q["id"]: {o["valeur"]: o["poids"] for o in q["options"]}
                 for q in form["questions"]}
        dim_de = {q["id"]: q["cible_dimension"] for q in form["questions"]}
        somme = collections.Counter(); total = collections.Counter()
        for qid, rep in self.met["reponses"].items():
            d = dim_de[qid]
            somme[d] += poids[qid][rep]
            total[d] += max(poids[qid].values())
        out = {}
        for dim in self.met_ref["dimensions"]:
            part = somme[dim["code"]] / total[dim["code"]]
            atteints = [i for i, n in enumerate(dim["niveaux"]) if part >= n["seuil_min"]]
            rang = atteints[-1] + 1
            out[dim["code"]] = {"part": part, "somme": somme[dim["code"]],
                                "total": total[dim["code"]], "rang": rang,
                                "niveau": dim["niveaux"][rang - 1]}
        return out

    def calculer(self):
        self.scores()
        self.agregats()
        return self


# ═══════════════════════════════ registre des valeurs calculées ══════════════

def valeurs_moteur(b: Bilan) -> dict[str, float]:
    """Toute valeur numérique que le moteur a produite, sous une clé stable.

    Le § 8.3 interdit « tout chiffre non issu du moteur de calcul ». Vérifier qu'un nombre
    a été *enregistré* avant impression ne prouve rien sur son origine : il faut pouvoir le
    retrouver dans ce que le moteur a calculé. Ce registre est cette preuve. Le rendu ne
    reçoit pas de valeur, il demande une clé ; un nombre absent d'ici ne peut pas être écrit.
    """
    v: dict[str, float] = {}
    ordre, _ = b.priorite()
    for i, g in enumerate(ordre, 1):
        v[f"rang.{g}"] = i
    for pc in b.perimetres_passes:
        a = b.agr[pc]
        v[f"global.{pc}"] = a["global"]
        v[f"mesures.{pc}"] = a["mesures"]
        v[f"non_reponse.{pc}"] = a["non_reponse"]
        if a["prerequis"] is not None:
            v[f"prerequis.{pc}"] = a["prerequis"]
            v[f"prerequis.{pc}.obtenu"], v[f"prerequis.{pc}.max"] = a["prerequis_points"]
        if a["tache"] is not None:
            v[f"tache.{pc}"] = a["tache"]
            v[f"tache.{pc}.obtenu"], v[f"tache.{pc}.max"] = a["tache_points"]
        # Score au format de l'épreuve : les points officiels de chaque partie et leur
        # total. Il ne remplace pas le score de tâche, qui suit le bloc C d'un bilan au
        # suivant ; les deux sont rendus, et nommés.
        fmt = b.score_format_epreuve(pc)
        if fmt:
            v[f"format.{pc}.total"] = fmt["score"]
            v[f"format.{pc}.sur"] = fmt["sur"]
            for code, x in fmt["parties"].items():
                v[f"format.{pc}.{code}"] = x["points"]
                v[f"format.{pc}.{code}.officiel"] = x["points_officiels"]
                v[f"format.{pc}.{code}.part"] = x["part"]
    for (pc, comp), x in b.res.items():
        v[f"score.{pc}.{comp}"] = x["part"]
        v[f"points.{pc}.{comp}.obtenu"] = x["obtenu"]
        v[f"points.{pc}.{comp}.max"] = x["max"]
        v[f"points.{pc}.{comp}.mesures"] = x["n"]
        for code, n in x["erreurs"].items():
            v[f"erreurs.{pc}.{code}"] = n
    for k, c in b.calibration_competences():
        for champ in ("percu", "percu100", "mesure", "ecart"):
            v[f"calibration.{k[0]}.{k[1]}.{champ}"] = c[champ]
        v[f"calibration.{k[0]}.{k[1]}.ecart_absolu"] = abs(c["ecart"])
    for pc in b.perimetres_passes:
        c = b.calibration_matiere(pc)
        if c:
            for champ in ("percu", "percu100", "mesure", "ecart"):
                v[f"calibration.{pc}.{champ}"] = c[champ]
            v[f"calibration.{pc}.ecart_absolu"] = abs(c["ecart"])
    for code, rel in b.grilles_coach.items():
        v[f"grille.{code}.obtenu"] = rel["obtenu"]
        v[f"grille.{code}.max"] = rel["max"]
        v[f"grille.{code}.part"] = rel["obtenu"] / rel["max"] if rel["max"] else 0
        for critere, x in rel["criteres"].items():
            v[f"critere.{code}.{critere}"] = x["score"]
    total = 0.0
    for g in b.groupes:
        h, _, _ = b.rythme_groupe(g)
        v[f"rythme.{g}"] = h
        total += h
    v["rythme.total"] = total
    dispo = b.qp["reponses"]["heures_disponibles"]
    v["rythme.depassement"] = max(0.0, total - dispo)
    for dim, x in b.profils_met().items():
        v[f"met.{dim}.somme"] = x["somme"]
        v[f"met.{dim}.total"] = x["total"]
        v[f"met.{dim}.part"] = x["part"]
        v[f"met.{dim}.rang"] = x["rang"]
    return v


# ═══════════════════════════════ conformité à la spécification commandée ══════

def _qp_valeur(qp, champ):
    v = qp["reponses"]
    for part in champ.split("."):
        v = v.get(part) if isinstance(v, dict) else None
    return v


def verifier_specification(b: Bilan) -> list[dict]:
    """Confronte le bilan produit à chaque attendu de la spécification.

    L'audit de la maquette v1 reprochait un jeu de données écarté de la commande sans
    qu'aucune ligne ne le dise. Ici la commande est un fichier et chaque attendu porte
    des vérifications exécutables : un écart ne peut plus passer inaperçu.
    """
    spec = charger(b.dossier / "specification.json")
    resultats = []
    for att in spec["attendus"]:
        lignes = []
        for v in att["verifications"]:
            t = v["type"]
            if t == "instrument":
                obt = next((ver for c, ver in b.porteurs
                            if b.cat[(c, ver)]["perimetre"] == v["perimetre"]), None)
                lignes.append((f"{v['perimetre']} en version {v['version']}",
                               f"version {obt}", obt == v["version"]))
            elif t == "qp":
                obt = _qp_valeur(b.qp, v["champ"])
                lignes.append((f"{v['champ']} = {v['valeur']}", f"{obt}", obt == v["valeur"]))
            elif t == "agregat":
                obt = b.agr[v["perimetre"]][v["cle"]]
                ok = v["min"] <= obt <= v["max"]
                lignes.append((f"{v['perimetre']} : {v['cle']} entre "
                               f"{v['min']*100:.0f} % et {v['max']*100:.0f} %",
                               f"{obt*100:.0f} %", ok))
            elif t == "rang_groupe":
                ordre, _ = b.priorite()
                obt = ordre.index(v["groupe"]) + 1 if v["groupe"] in ordre else None
                lignes.append((f"{v['groupe']} au rang {v['rang']} du plan",
                               f"rang {obt}" if obt else "groupe absent du plan",
                               obt == v["rang"]))
            elif t == "perimetre_absent":
                lignes.append((f"{v['perimetre']} hors du périmètre du candidat",
                               "absent" if v["perimetre"] not in b.perimetres_passes
                               else "passé", v["perimetre"] not in b.perimetres_passes))
            elif t == "instrument_absent":
                codes = {c for c, _ in b.instruments}
                lignes.append((f"{v['code']} non assemblé",
                               "absent" if v["code"] not in codes else "assemblé",
                               v["code"] not in codes))
            elif t == "competence_absente":
                k = (v["perimetre"], v["competence"])
                lignes.append((f"{v['perimetre']}/{v['competence']} hors de l'assemblage",
                               "absente" if k not in b.res
                               else f"évaluée sur {b.res[k]['motif']}", k not in b.res))
            elif t == "competence_evaluee":
                k = (v["perimetre"], v["competence"])
                x = b.res.get(k)
                lignes.append((f"{v['perimetre']}/{v['competence']} évaluée",
                               f"{x['motif']}" if x and x["evalue"]
                               else "absente" if x is None else f"non évaluée ({x['motif']})",
                               bool(x) and x["evalue"]))
            elif t == "agregat_absent":
                obt = b.agr[v["perimetre"]][v["cle"]]
                lignes.append((f"{v['perimetre']} : {v['cle']} sans objet",
                               "absent" if obt is None else f"{obt*100:.0f} %", obt is None))
            elif t == "niveau":
                x = b.res[(v["perimetre"], v["competence"])]
                lignes.append((f"{v['perimetre']}/{v['competence']} {v['niveau']}",
                               f"{x['niveau']} ({x['part']*100:.0f} %)",
                               x["niveau"] == v["niveau"]))
            elif t == "palier":
                x = b.res[(v["perimetre"], v["competence"])]
                lignes.append((f"{v['perimetre']}/{v['competence']} palier {v['palier']}",
                               f"palier {x['palier']}", x["palier"] == v["palier"]))
            elif t == "module_entree":
                m, _, _ = b.module_entree(v["perimetre"])
                lignes.append((f"{v['perimetre']} : module « {v['module']} »",
                               f"« {m} »", m == v["module"]))
            elif t == "calibration":
                trouve = next((e for k, e in b.calibration_competences()
                               if k == (v["perimetre"], v["competence"])), None)
                sig = trouve["signal"]["libelle"] if trouve and trouve["signal"] else "aucun"
                lignes.append((f"{v['perimetre']}/{v['competence']} : {v['signal']}",
                               sig, sig == v["signal"]))
            elif t == "calibration_absente":
                sans_reponse, _ = b.calibrations_absentes()
                k = (v["perimetre"], v["competence"])
                lignes.append((f"{v['perimetre']}/{v['competence']} : calibration non "
                               f"renseignée",
                               "non renseignée" if k in sans_reponse else "renseignée",
                               k in sans_reponse))
            elif t == "critere_proprietaire":
                c = b.criteres.get((v["perimetre"], v["critere"]))
                ok = bool(c) and c["competence"] == v["competence"] \
                    and c["obtenu"] / c["max"] <= v["part_max"]
                lignes.append((f"critère {v['critere']} propriété de {v['competence']}, "
                               f"sous {v['part_max']*100:.0f} %",
                               f"{c['obtenu']}/{c['max']} pour {c['competence']}"
                               if c else "critère absent", ok))
            elif t == "met":
                p = b.profils_met()[v["dimension"]]
                lignes.append((f"MET/{v['dimension']} au niveau {v['rang']}",
                               f"niveau {p['rang']}", p["rang"] == v["rang"]))
            elif t == "critere":
                rel = b.grilles_coach.get(v["instrument"], {}).get("criteres", {})
                obt = rel.get(v["critere"], {}).get("score")
                lignes.append((f"{v['instrument']}/{v['critere']} = {v['score']}",
                               f"{obt}", obt == v["score"]))
            elif t == "decision_go":
                d = b.decision_grand_oral()
                lignes.append((f"préparation au Grand oral {v['decision']}",
                               d["libelle"] if d else "aucune décision",
                               bool(d) and d["libelle"] == v["decision"]))
            elif t == "groupe_membres":
                # Un groupe de planification est une matière de travail : dire quels
                # périmètres l'ouvrent, c'est dire de quoi cette matière est faite.
                obt = b.groupes.get(v["groupe"])
                lignes.append((f"groupe {v['groupe']} ouvert par "
                               f"{', '.join(v['perimetres'])}",
                               ", ".join(obt) if obt else "groupe absent",
                               obt == v["perimetres"]))
            elif t == "assemblage_session":
                obt = next((charger(RACINE / "instruments" / c / "assemblages"
                                    / f"{ver}.json").get("session_baccalaureat_finale")
                            for c, ver in b.porteurs if c == v["code"]), None)
                lignes.append((f"{v['code']} : assemblage de la session {v['session']}",
                               f"session {obt}" if obt else "instrument absent",
                               obt == v["session"]))
            elif t == "prose_statut":
                st = [pc for pc, _ in b.statuts_a_signaler()]
                lignes.append((f"phrase de statut sur {v['perimetre']}",
                               ", ".join(st) or "aucune", v["perimetre"] in st))
            else:
                raise SystemExit(f"type de vérification inconnu : {t}")
        resultats.append({"id": att["id"], "demande": att["demande"],
                          "regle": att["regle_exercee"], "lignes": lignes,
                          "impossible": att.get("impossible"),
                          "conforme": all(ok for _, _, ok in lignes)})
    return resultats


# ═══════════════════════════════════════════════ document de maquette ════════

def document(b: Bilan, destinataire: str = "direction") -> str:
    r = b.qp["reponses"]
    G = b.regles
    parent = destinataire == "parent"
    items_min = b.ref["conventions"]["regles_couverture"]["competence_ordinaire"]["items_min"]
    seuil_pre = G["agregats"]["prerequis"]["seuil_remise_a_niveau"]
    seuil_cal = G["indice_calibration"]["ecart_signal"]
    seuil_charge = G["alerte_charge"]["seuil_heures"]
    frac = G["palier_de_profondeur"]["fraction"]
    semaines = G["evaluation_intermediaire"]["delai_semaines"]

    def phrase_niveaux():
        pal = G["niveaux_competence"]["paliers"]
        bouts = []
        for i, x in enumerate(pal):
            bas = x["seuil_min"] * 100
            if i == 0:
                bouts.append(f"{x['libelle']} ≥ {bas:.0f} %")
            elif x["seuil_min"] == 0:
                bouts.append(f"{x['libelle']} < {pal[i-1]['seuil_min']*100:.0f} %")
            else:
                bouts.append(f"{x['libelle']} {bas:.0f}–{pal[i-1]['seuil_min']*100-1:.0f} %")
        nev = G["niveaux_competence"]["non_evalue"]["libelle"]
        return ", ".join(bouts) + f", {nev} sous {items_min} mesures renseignées"

    def phrase_rythmes():
        t = G["rythmes_hebdomadaires"]["par_niveau"]
        return (f"Non acquis ou remise à niveau : {heures(t['Non acquis'])} ; "
                f"Fragile : {heures(t['Fragile'])} ; "
                f"En consolidation : {heures(t['En consolidation'])} ; "
                f"Solide : {heures(t['Solide'])} d'entretien")

    titre = ("Maquette du bilan — version destinée aux responsables légaux"
             if parent else "Maquette du bilan — application manuelle des règles du § 8.2")
    L = [f"# {titre}", "",
         "> **Jeu de données fictif.** Candidat `" + b.qp["candidate_ref"] + "`, aucune "
         "passation réelle, aucun élément nominatif. Ce document montre, règle par règle, la "
         "donnée d'entrée, la règle citée et le résultat obtenu. Il n'est pas le bilan : "
         "c'est sa dérivation.", ""]
    if parent:
        L += ["> **Destinataire.** Cette version s'adresse aux responsables légaux d'un "
              "candidat mineur. Elle porte exactement les mêmes valeurs que la version "
              "remise au candidat et au coach : seuls le destinataire et le registre "
              "changent, jamais un chiffre.", ""]

    L += ["## Entrée — ce dont on part", "",
          f"- Profil **{r['profil']}**, session **{r['session_visee']}**, "
          f"statut **{r['statut_minorite']}**",
          f"- Dernière classe complète : **{r['derniere_classe_complete']}**, "
          + (f"interruption de **{r['annees_interruption']} "
             f"an{'s' if r['annees_interruption'] > 1 else ''}**"
             if r["annees_interruption"] else "sans interruption"),
          f"- Spécialités : **{', '.join(r['specialites'])}**, dont "
          f"**{r['specialite_abandonnee']}** abandonnée",
          "- Statut par spécialité : "
          + " · ".join(f"{k} {v}" for k, v in r["statut_par_specialite"].items()),
          f"- Heures disponibles déclarées : **{r['heures_disponibles']} h/semaine**, "
          f"activité en parallèle : {r['activite_parallele']}",
          "- Auto-positionnement par matière : "
          + " · ".join(f"{k} {v}/{G['indice_calibration']['echelle_percue']['max']}"
                       for k, v in r["auto_par_matiere"].items()),
          "- Français déclaré, donnée de contexte hors calibration (EC-23) : "
          + " · ".join(f"{k} {v}/{G['indice_calibration']['echelle_percue']['max']}"
                       for k, v in r["auto_francais"].items()),
          f"- {len(b.lignes)} items saisis, {len(b.grilles)} lignes de critères", ""]

    # ── Règle 0 : les instruments se déduisent, ils ne se listent pas
    sel = b.cat_brut["conventions"]["selection_version_specialite"]
    L += ["---", "", "## Règle 0 — quels instruments ce candidat a passés", "",
          "**Règle citée** — Cahier § 3.1 et § 3.2, convention "
          "`selection_version_specialite` du catalogue : "
          + sel["regle"], "",
          "| Instrument | Version | Périmètre | Pourquoi celui-ci |", "|---|---|---|---|"]
    for code, version in b.instruments:
        i = b.cat[(code, version)]
        if i["perimetre"] and i["perimetre"].startswith("EDS-"):
            spe = i["perimetre"].removeprefix("EDS-")
            statut = ("abandonnée" if spe == r["specialite_abandonnee"] else "poursuivie")
            pourquoi = (f"spécialité {statut} → version "
                        f"{sel['par_profil'][r['profil']][statut.replace('é', 'e')]}")
        else:
            pourquoi = f"ouvert au profil {r['profil']}"
        L.append(f"| {code} | {version} | {i['perimetre'] or '—'} | {pourquoi} |")
    L += ["", "*Aucune matière n'est écrite dans le script : cette table est le produit du "
          "profil déclaré, de la liste des spécialités et de la spécialité abandonnée.*", ""]

    # ── Règle 1
    L += ["---", "", "## Règle 1 — score, niveau et palier de chaque compétence", "",
          "**Règle citée** — § 5.1 : *S(c) = points obtenus / points maximum sur les items "
          "rattachés à c*. § 5.2 : " + phrase_niveaux() + ". § 5.3 : le palier de profondeur "
          f"est le plus haut palier où le candidat obtient au moins "
          f"{frac['numerateur']}/{frac['denominateur']} des points. EC-08 : les points d'un "
          "critère de grille vont à sa compétence propriétaire.", ""]
    for pc in b.perimetres_passes:
        version = next(v for c, v in b.porteurs if b.cat[(c, v)]["perimetre"] == pc)
        L += [f"### {pc} / {version}", "",
              "| Compétence | Intitulé | Points | Score | Niveau | Palier | Base |",
              "|---|---|---|---|---|---|---|"]
        for c in b.per[pc]["competences"]:
            k = (pc, c["code"])
            if k not in b.res:
                continue
            x = b.res[k]
            L.append(f"| {c['code']} | {x['intitule']} | {x['obtenu']}/{x['max']} | "
                     f"{x['part']*100:.0f} % | {x['niveau']} | {x['palier']} | {x['motif']} |")
        L.append("")

    # ── Règle 2
    ag = G["agregats"]
    L += ["---", "", "## Règle 2 — agrégats par matière", "",
          "**Règle citée** — § 5.5 : *" + ag["score_global"]["transcription_cahier"][0]
          + "* ; *" + ag["prerequis"]["transcription_cahier"][0]
          + "* ; *" + ag["tache_type_epreuve"]["transcription_cahier"][0] + "*.", "",
          "Deux points d'application. " + ag["score_global"]["note"] + " "
          + ag["prerequis"]["note"], "",
          "| Matière | Score global | Mesures | Taux de prérequis | Tâche type épreuve | "
          "Non-réponse |", "|---|---|---|---|---|---|"]
    for pc in b.perimetres_passes:
        a = b.agr[pc]
        pre = (f"{a['prerequis']*100:.0f} % ({a['prerequis_points'][0]}/"
               f"{a['prerequis_points'][1]})") if a["prerequis"] is not None else "—"
        tac = (f"{a['tache']*100:.0f} % ({a['tache_points'][0]}/"
               f"{a['tache_points'][1]})") if a["tache"] is not None else "—"
        L.append(f"| {pc} | {a['global']*100:.0f} % | {a['mesures']} | {pre} | {tac} | "
                 f"{a['non_reponse']*100:.0f} % |")
    sans_tache = [pc for pc in b.perimetres_passes if b.agr[pc]["tache"] is None]
    if sans_tache:
        L += ["", "*" + ", ".join(sans_tache) + " n'a pas de bloc C dans l'assemblage "
              "passé. " + ag["tache_type_epreuve"]["note"].split(". ", 1)[1] + "*", ""]
    else:
        L.append("")

    # ── Règle 3 — module d'entrée
    me = G["module_entree"]
    L += ["---", "", "## Règle 3 — module d'entrée de chaque matière", "",
          "**Règle citée** — § 8.2 : *" + me["transcription_cahier"][0] + "*", "",
          "| Matière | Donnée décisive | Module d'entrée |", "|---|---|---|"]
    modules = {}
    for pc in b.perimetres_passes:
        m, code, motif = b.module_entree(pc)
        modules[pc] = (m, code)
        L.append(f"| {pc} | {motif} | **{m}** |")
    L.append("")
    statuts = b.statuts_a_signaler()
    if statuts:
        rc6 = G["statut_specialite"]["ecart"]["ref"]
        L += [f"**{rc6} — lecture du taux de prérequis avec le statut de la spécialité.** "
              + b.ecart(rc6)["constat"], ""]
        for pc, phrase in statuts:
            a = b.agr[pc]
            L.append(f"- **{pc}** — taux de prérequis {a['prerequis']*100:.0f} %. {phrase}")
        L += ["", f"*Effet : {G['statut_specialite']['effet']}. Le calcul du taux de "
              f"prérequis est inchangé.*", ""]

    # ── Règle 4 — rythme
    ry = G["rythmes_hebdomadaires"]
    L += ["---", "", "## Règle 4 — rythme hebdomadaire par matière", "",
          "**Règle citée** — § 8.2 : *" + phrase_rythmes() + ". "
          + ry["plafond"]["regle"] + "*", "",
          f"**{ry['assiette']['ecart']['ref']} — assiette du rythme.** "
          + b.ecart(ry["assiette"]["ecart"]["ref"])["constat"] + " "
          + b.ecart(ry["assiette"]["ecart"]["ref"])["arbitrage"], "",
          "| Matière | Niveau retenu | Rythme |", "|---|---|---|"]
    rythmes = {}
    for pc in b.perimetres_passes:
        h, motif = b.rythme(pc)
        rythmes[pc] = h
        L.append(f"| {pc} | {motif} | {heures(h)} |")
    gp = b.ref["conventions"]["groupes_planification"]
    ec28 = b.ecart(G["rythmes_hebdomadaires"]["groupe"]["ecart"]["ref"])
    L += ["", f"**{ec28['ref']} — le rythme se compte par matière de travail.** "
          + ec28["constat"] + " " + ec28["arbitrage"], "",
          "| Matière de travail | Périmètres diagnostiques | Niveau retenu | Rythme |",
          "|---|---|---|---|"]
    groupes = {}
    for g in b.groupes:
        h, niveau, pc = b.rythme_groupe(g)
        groupes[g] = h
        libelle = gp["groupes"][g]["libelle"] if g in gp["groupes"] else g
        L.append(f"| {libelle} | " + ", ".join(b.groupes[g]) + f" | {niveau} ({pc}) | "
                 f"{heures(h)} |")
    somme = sum(groupes.values())
    par_perimetre = sum(rythmes.values())
    L += ["", f"**Somme des rythmes : {heures(somme)} par semaine.** Heures déclarées : "
          f"{r['heures_disponibles']} h."
          + (f" Comptée par périmètre plutôt que par matière de travail, elle vaudrait "
             f"{heures(par_perimetre)} : c'est l'erreur que {ec28['ref']} corrige."
             if par_perimetre != somme else ""), "",
          "*" + ry["sans_rythme"]["texte"] + " Instruments concernés : "
          + ", ".join(ry["sans_rythme"]["instruments"]) + ".*", ""]

    # ── Règle 5 — priorité
    pr = G["priorite_matieres"]
    ordre, motifs = b.priorite()
    L += ["---", "", "## Règle 5 — priorité entre matières", "",
          "**Règle citée** — § 8.2 : *" + pr["transcription_cahier"][0] + "*. *"
          + pr["transcription_cahier"][1] + "*", "",
          f"**{pr['ecart']['ref']} — deux points que le § 8.2 ne réglait pas.** "
          + b.ecart(pr["ecart"]["ref"])["constat"] + " "
          + b.ecart(pr["ecart"]["ref"])["arbitrage"], "",
          "| Rang | Matière de travail | Périmètres | Motif |", "|---|---|---|---|"]
    for i, g in enumerate(ordre, 1):
        L.append(f"| {i} | **{g}** | " + ", ".join(b.groupes[g]) + f" | {motifs[g]} |")
    L.append("")

    # ── Règle 6 — calibration
    cal = G["indice_calibration"]
    pc_reg = cal["portee"]["par_competence"]
    L += ["---", "", "## Règle 6 — indice de calibration", "",
          "**Règle citée** — § 5.4 : *" + cal["transcription_cahier"][0] + "*. *"
          + cal["transcription_cahier"][1] + "*. *" + cal["transcription_cahier"][2] + ".*", "",
          f"**{cal['portee']['ecart']['ref']} — source et grain.** "
          + b.ecart(cal["portee"]["ecart"]["ref"])["constat"], "",
          b.ecart(cal["portee"]["ecart"]["ref"])["arbitrage"], "",
          "### Par compétence, depuis le bloc 0 de chaque instrument", "",
          "| Domaine du bloc 0 | Compétence | Perçu | Converti | Mesuré | Écart | Signal |",
          "|---|---|---|---|---|---|---|"]
    alertes = []
    fmt = b.ref["conventions"]["identifiant_bloc_0"]["format"]
    for k, c in b.calibration_competences():
        code = next(cd for cd, vv in b.porteurs if b.cat[(cd, vv)]["perimetre"] == k[0])
        ident = fmt.replace("<CODE_INSTRUMENT>", code).replace("<COMPETENCE>", k[1])
        sig = c["signal"]["libelle"] if c["signal"] else "—"
        if c["signal"]:
            alertes.append((k[0], k[1], c))
        L.append(f"| `{ident}` | {k[0]}/{k[1]} | {c['percu']}/"
                 f"{cal['echelle_percue']['max']} | {c['percu100']:.0f} | "
                 f"{c['mesure']:.0f} | {c['ecart']:+.0f} | {sig} |")
    sans_reponse, sans_domaine = b.calibrations_absentes()
    L.append("")
    if sans_reponse:
        L += ["**Domaines non renseignés.** "
              + ", ".join(f"{p}/{c}" for p, c in sans_reponse) + ". "
              + pc_reg["non_renseignee"], ""]
    if sans_domaine:
        L += [f"> **Réserve.** {len(sans_domaine)} compétences évaluées de ce candidat n'ont "
              f"pas de domaine dans le bloc 0 de leur instrument : "
              + ", ".join(f"{p}/{c}" for p, c in sans_domaine)
              + ". Le bloc 0 compte cinq domaines par instrument, pour six à neuf "
              "compétences ; la calibration par compétence ne peut donc pas couvrir tout "
              "l'assemblage. Sur l'ensemble du catalogue, trente et un couples compétence × "
              "assemblage sont dans ce cas. Étendre le bloc 0 à toutes les compétences "
              "toucherait les quinze instruments et relève d'une soumission préalable.", ""]

    L += ["### Par matière, depuis le questionnaire de parcours", "",
          "*" + cal["portee"]["par_matiere"]["role"].capitalize() + ".*", "",
          "| Matière | Perçu | Converti | Mesuré | Écart | Signal |",
          "|---|---|---|---|---|---|"]
    for pc in b.perimetres_passes:
        c = b.calibration_matiere(pc)
        if not c:
            continue
        sig = c["signal"]["libelle"] if c["signal"] else "—"
        if c["signal"]:
            alertes.append((pc, None, c))
        L.append(f"| {pc} | {c['percu']}/{cal['echelle_percue']['max']} | "
                 f"{c['percu100']:.0f} | {c['mesure']:.0f} | {c['ecart']:+.0f} | {sig} |")
    L.append("")
    for pc, comp, c in alertes:
        cible = f"{pc}/{comp}" if comp else pc
        L.append(f"- **{cible}** — {c['signal']['libelle']} de {abs(c['ecart']):.0f} points : "
                 f"{c['signal']['mesure']}.")
    L.append("")

    # ── Règle 7 — charge de travail : le seuil du Cahier et l'indicateur de vigilance
    al = G["alerte_charge"]
    vig = al["vigilance_charge_elevee"]
    ind = indicateurs_de_charge(somme, r["profil"], G)
    sequencer, vigilance = ind["sequencement"], ind["vigilance"]
    plafond = somme > r["heures_disponibles"]
    L += ["---", "", "## Règle 7 — charge de travail", "",
          "**Règle citée** — § 8.2 : *" + al["transcription_cahier"][0] + "*", "",
          f"**{al['ecart']['ref']} — le seuil du Cahier est rétabli.** "
          + b.ecart(al["ecart"]["ref"])["constat"] + " "
          + b.ecart(al["ecart"]["ref"])["arbitrage"], "",
          f"**Deux indicateurs distincts.** Séquencement : la somme **dépasse** "
          f"{seuil_charge} h — {al['lecture_de_la_comparaison']} "
          f"Vigilance : la somme **atteint** {vig['seuil_heures']} h — "
          f"{vig['lecture_de_la_comparaison']} {vig['n_impose_pas']}", "",
          f"**{al['sequencement']['ecart']['ref']} — le séquencement descend du plan.** "
          + b.ecart(al["sequencement"]["ecart"]["ref"])["constat"] + " "
          + b.ecart(al["sequencement"]["ecart"]["ref"])["arbitrage"], "",
          f"Somme des rythmes : **{heures(somme)}**. Seuil de séquencement : "
          f"**{seuil_charge} h** (dépassement strict). Seuil de vigilance : "
          f"**{vig['seuil_heures']} h** (atteint). "
          f"Heures déclarées : **{r['heures_disponibles']} h**.", ""]
    if sequencer and plafond:
        L.append(f"→ **Séquencement et plafond** : {heures(somme)} recommandées dépassent le "
                 f"seuil de {seuil_charge} h et dépassent de "
                 f"{heures(somme - r['heures_disponibles'])} les {r['heures_disponibles']} h "
                 f"déclarées. Le bilan propose {al['proposition']}. "
                 + al["paragraphe_unique_si_plafond_aussi_depasse"]["regle"])
    elif sequencer:
        L.append(f"→ **Séquencement** : la somme dépasse le seuil du Cahier "
                 f"({heures(somme)} pour {seuil_charge} h). Le bilan propose "
                 f"{al['proposition']}.")
    elif plafond:
        L.append(f"→ **Plafond dépassé** : {heures(somme)} recommandées pour "
                 f"{r['heures_disponibles']} h déclarées, soit "
                 f"{heures(somme - r['heures_disponibles'])} de plus. "
                 + ry["plafond"]["regle"])
    elif vigilance:
        L.append(f"→ **Vigilance — charge élevée** : la somme atteint {heures(somme)} pour "
                 f"un seuil de vigilance de {vig['seuil_heures']} h, sans dépasser le seuil "
                 f"de séquencement de {seuil_charge} h ni les {r['heures_disponibles']} h "
                 f"déclarées. Aucun séquencement n'est proposé.")
    else:
        L.append("→ Aucun constat : la somme reste sous le seuil de vigilance et sous les "
                 "heures déclarées.")
    L.append("")

    # ── Règle 8 — évaluation intermédiaire
    ei = G["evaluation_intermediaire"]
    L += ["---", "", "## Règle 8 — première évaluation intermédiaire", "",
          "**Règle citée** — § 8.2 : *" + ei["transcription_cahier"][0] + "*", "",
          f"**{ei['portee']['ecart']['ref']} — portée.** "
          + b.ecart(ei["portee"]["ecart"]["ref"])["constat"] + " "
          + ei["portee"]["regle"], "",
          f"| Matière | Compétences à réévaluer à {semaines} semaines | Motif |",
          "|---|---|---|"]
    total_reeval = 0
    for pc in b.perimetres_passes:
        comps, motif = b.evaluation_intermediaire(pc)
        total_reeval += len(comps)
        if comps:
            L.append(f"| {pc} | {', '.join(comps)} | {motif} |")
    borne = ei["portee"]["ordre_de_grandeur_attendu"]
    L += ["", f"**Total : {total_reeval} compétences.** L'ordre de grandeur attendu pour un "
          f"profil {borne['profil']} est de {borne['min']} à {borne['max']} : la portée "
          "restreinte au module d'entrée le respecte.", "",
          "*" + ei["contrainte"] + " Les items réservés `reserve_intermediaire` des banques "
          "servent à cette réévaluation : ils portent les mêmes codes de compétence sans "
          "reprendre les mêmes énoncés.*", ""]

    # ── Règle 9 — famille LANGUE
    fam = b.ref["conventions"]["familles"]
    L += ["---", "", "## Règle 9 — famille LANGUE, mise en regard", "",
          "**Règle citée** — `conventions.familles` : *" + fam["LANGUE"] + "*", "",
          "| Périmètre | Compétence | Score | Niveau |", "|---|---|---|---|"]
    for k, x in sorted(b.res.items()):
        if x.get("famille") == "LANGUE":
            L.append(f"| {k[0]} | {k[1]} | {x['part']*100:.0f} % | {x['niveau']} |")
    L += ["", "*Aucune moyenne n'est calculée entre ces lignes : elles sont affichées côte à "
          "côte pour que le coach distingue une difficulté de langue d'une difficulté "
          "disciplinaire.*", ""]

    # ── Règle 10 — Grand oral
    go = G["grand_oral"]
    d = b.decision_grand_oral()
    L += ["---", "", "## Règle 10 — décision sur la préparation au Grand oral", "",
          "**Règle citée** — § 7.13 : *" + go["transcription_cahier"][0] + "*", "",
          f"**{go['ecart']['ref']} — le seuil qui tranche.** "
          + b.ecart(go["ecart"]["ref"])["constat"] + " "
          + b.ecart(go["ecart"]["ref"])["arbitrage"], ""]
    if d:
        rel = b.grilles_coach[go["instrument"]]
        L += ["| Critère | Intitulé | Score |", "|---|---|---|"]
        for c, x in rel["criteres"].items():
            L.append(f"| {c} | {x['intitule']} | {x['score']}/3 |")
        L += ["", f"Total **{d['obtenu']}/{d['max']}**, soit **{d['part']*100:.0f} %**, "
              f"pour un seuil de {go['seuil']*100:.0f} % → **préparation {d['libelle']}** : "
              f"{d['texte']}.", "",
              f"*{go['instrument']} n'alimente aucune compétence de ce candidat : sa grille "
              f"reporte {', '.join(sorted({c['competence'] for c in rel['criteres'].values()}))}"
              f" à un périmètre qu'il ne passe pas. Le résultat sert uniquement à cette "
              f"décision, et n'ajoute aucune heure.*", ""]

    # ── Règle 11 — oral de français
    of = G["oral_de_francais"]
    v = b.vigilance_oral_francais()
    L += ["---", "", "## Règle 11 — oral de français, point de vigilance", "",
          "**Règle citée** — § 7.1 : *" + of["transcription_cahier"][0] + "*", "",
          f"**{of['ecart']['ref']} — rendu.** " + b.ecart(of["ecart"]["ref"])["arbitrage"],
          ""]
    if v:
        L += ["| Critère | Intitulé | Score | Alimente |", "|---|---|---|---|"]
        for c, x in v["releve"]["criteres"].items():
            cible = [f"{p}/{cc}" for p, cc in v["releve"]["alimente"] if cc == x["competence"]]
            L.append(f"| {c} | {x['intitule']} | {x['score']}/3 | "
                     f"{', '.join(cible) or '—'} |")
        L += ["", f"Total **{v['releve']['obtenu']}/{v['releve']['max']}**, soit "
              f"**{v['part']*100:.0f} %**. Critère le plus bas : **{v['critere']} — "
              f"{v['intitule']}** à {v['score']}/3, nommé comme point de vigilance en "
              f"section {of['section_bilan']}, sous {of['rattachement']}.", "",
              "*" + of["departage_critere_le_plus_bas"] + "*", ""]

    # ── Règle 12 — profil de méthode
    prof = b.profils_met()
    L += ["---", "", "## Règle 12 — profil de méthode et outillage", "",
          "**Règle citée** — § 7.5 : *chaque dimension produit un profil en trois niveaux et "
          "une recommandation d'outillage.* Les seuils et les recommandations sont au "
          "référentiel.", "",
          "| Dimension | Somme | Part | Niveau | Outillage |", "|---|---|---|---|---|"]
    for dim in b.met_ref["dimensions"]:
        p = prof[dim["code"]]
        L.append(f"| {dim['libelle']} | {p['somme']}/{p['total']} | {p['part']*100:.0f} % | "
                 f"{p['rang']} — {p['niveau']['libelle']} | {p['niveau']['outillage']} |")
    L.append("")

    # ── Règle 13 — épreuve anticipée de mathématiques : format et outil
    fmt = b.score_format_epreuve()
    if fmt:
        dep = b.dependance_a_loutil()
        L += ["---", "", "## Règle 13 — MATH-EA : score au format de l'épreuve, et outil", "",
              "**Règle citée** — note de service MENE2515469N : *épreuve de 2 h, coefficient "
              "2, sans calculatrice, notée sur 20 — questionnaire à choix multiple "
              "d'automatismes sur 6 points, puis deux ou trois exercices sur 14.*", "",
              "Le barème interne du diagnostic n'est pas celui de l'épreuve. Le score au "
              "format applique la pondération officielle à la **part réussie** de chaque "
              "partie : il ne dépend ni du nombre d'items, ni des points de la banque. La "
              "correspondance se fait par registre de tâche, non par bloc.", "",
              "| Partie de l'épreuve | Points de banque | Part réussie | Points officiels |",
              "|---|---|---|---|"]
        for x in fmt["parties"].values():
            L.append(f"| {x['intitule']} ({x['items']} mesures) | {x['obtenu']}/{x['max']} | "
                     f"{x['part']*100:.1f} % | **{x['points']:.1f}** / {x['points_officiels']} |")
        L += ["", f"**Score au format de l'épreuve : {fmt['score']:.1f} / {fmt['sur']}.** "
              f"Score global du diagnostic sur le même périmètre : "
              f"{b.agr[fmt['perimetre']]['global']*100:.1f} %. Les deux ne mesurent pas la "
              f"même chose et ne se remplacent pas.", "",
              "**Bloc " + ", ".join(fmt["blocs_hors_format"]) + " hors format.** "
              + fmt["motif_hors_format"], ""]
        if dep:
            L += [f"**Sans calculatrice.** Part réussie de l'indicateur de calcul exact : "
                  f"{dep['part_exact']*100:.1f} % ; moyenne des autres compétences du "
                  f"périmètre : {dep['part_autres']*100:.1f} %. Écart "
                  f"{dep['ecart']*100:+.1f} points pour un seuil de {dep['seuil']*100:.0f}. "
                  + ("→ **hypothèse de dépendance à l'outil de calcul.** "
                     if dep["declenche"] else
                     "→ aucune hypothèse de dépendance à l'outil. ")
                  + dep["interdit"], ""]

    # ── Conformité à la commande
    verifs = verifier_specification(b)
    L += ["---", "", "## Conformité du jeu de données à la commande", "",
          "La spécification de la Porte 7 est portée par "
          "`instruments/_MAQUETTE/specification.json` et confrontée au bilan produit. "
          "Un écart ne peut pas rester tacite : il apparaît ici et fait échouer le test.", "",
          "| # | Demandé | Obtenu | Conforme | Règle exercée |", "|---|---|---|---|---|"]
    for v_ in verifs:
        d_ = " · ".join(x[0] for x in v_["lignes"])
        o_ = " · ".join(x[1] for x in v_["lignes"])
        L.append(f"| {v_['id']} | {d_} | {o_} | "
                 f"{'oui' if v_['conforme'] else '**non**'} | {v_['regle']} |")
    L.append("")
    impossibles = [v_ for v_ in verifs if v_.get("impossible")]
    spec = charger(b.dossier / "specification.json")
    if impossibles or spec.get("impossibilites_signalees"):
        L += ["### Points de la commande impossibles par construction", ""]
        for v_ in impossibles:
            L.append(f"- **{v_['id']} — {v_['impossible']['point']}.** "
                     f"{v_['impossible']['raison']}")
        for i_ in spec.get("impossibilites_signalees", []):
            L.append(f"- **{i_['point']}.** {i_['raison']}")
        L.append("")

    # ── Conclusion, calculée
    non_conformes = [v_["id"] for v_ in verifs if not v_["conforme"]]
    sous_seuil = [pc for pc in b.perimetres_passes
                  if b.agr[pc]["prerequis"] is not None
                  and b.agr[pc]["prerequis"] < seuil_pre]
    L += ["---", "", "## Ce que la maquette met en évidence", ""]
    if sous_seuil:
        L.append(f"- Taux de prérequis sous le seuil de {seuil_pre*100:.0f} % : "
                 + ", ".join(f"**{pc}**" for pc in sous_seuil)
                 + ". Le module d'entrée y est imposé par la règle des prérequis, "
                   "indépendamment du score global — le cas de "
                 + ", ".join(f"**{pc}** ({b.agr[pc]['global']*100:.0f} % de score global)"
                             for pc in sous_seuil
                             if b.agr[pc]["global"] >= b.seuil_du_niveau("En consolidation"))
                 + " le montre.")
    else:
        L.append(f"- Aucun taux de prérequis ne descend sous le seuil de "
                 f"{seuil_pre*100:.0f} % : aucun module d'entrée n'est imposé par cette règle.")
    transversaux = [(k, x) for k, x in b.res.items() if x["type"] == "indicateur_transversal"]
    for k, x in transversaux:
        L.append(f"- **{k[0]}/{k[1]}** est évalué sur {x['motif']} et non sur "
                 f"{items_min} items : sans la règle propre aux indicateurs transversaux, il "
                 f"sortirait « {G['niveaux_competence']['non_evalue']['libelle']} » à tort.")
    if sans_tache:
        L.append("- " + ", ".join(f"**{pc}**" for pc in sans_tache)
                 + " n'a pas de score de tâche type épreuve : la ligne doit disparaître du "
                   "rendu, non afficher un tiret.")
    L.append(f"- La somme des rythmes vaut **{heures(somme)}**. Elle "
             + ("dépasse" if sequencer else "ne dépasse pas")
             + f" le seuil de séquencement de {seuil_charge} h, elle "
             + ("atteint" if vigilance else "n'atteint pas")
             + f" le seuil de vigilance de {vig['seuil_heures']} h, et elle "
             + ("dépasse" if plafond else "ne dépasse pas")
             + f" les {r['heures_disponibles']} h déclarées. Les trois règles disent des "
               "choses différentes : la première commande un séquencement, la deuxième "
               "signale une charge élevée sans rien imposer, la troisième porte sur la "
               "faisabilité pour ce candidat.")
    L.append(f"- La portée de l'évaluation intermédiaire, restreinte au module d'entrée par "
             f"{ei['portee']['ecart']['ref']}, ramène la réévaluation à "
             f"**{total_reeval} compétences**.")
    L.append("")
    if non_conformes:
        L += [f"> **Écart à la commande.** Les attendus {', '.join(non_conformes)} ne sont "
              "pas tenus par ce jeu de données. Le tableau de conformité ci-dessus le dit "
              "ligne par ligne.", ""]
    else:
        L += ["> **Conformité.** Les "
              + str(len(verifs))
              + " attendus de la commande sont tenus par ce jeu de données, aux points "
                "signalés comme impossibles par construction près.", ""]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    for chemin, dest, sortie in ((MAQ / "qp.json", "direction", "maquette_bilan.md"),
                                 (MAQ / "qp_variante_mineure.json", "parent",
                                  "maquette_bilan_parent.md")):
        b = Bilan(chemin).calculer()
        (MAQ / sortie).write_text(document(b, dest), encoding="utf-8", newline="\n")
        print(f"  {(MAQ / sortie).relative_to(RACINE)}")
