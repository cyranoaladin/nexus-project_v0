#!/usr/bin/env python3
"""Bilan de sortie — les sept sections du § 8.1, dans le registre du destinataire.

Ce script produit le document remis. Il ne décide rien : il lit les résultats calculés
par scripts/maquette_bilan.py et les règles de referentiels/regles_bilan.json.

Trois principes gouvernent l'écriture.

1. **Aucun nombre n'entre dans le rendu autrement que par une source déclarée.** Le § 8.3
   interdit « tout chiffre non issu du moteur de calcul ». Enregistrer les nombres imprimés
   ne prouve rien sur leur origine : ce script ne reçoit donc jamais une valeur, il demande
   une **clé** à l'une des quatre origines admises — moteur de calcul, questionnaire,
   référentiel canonique, constante structurelle du document. Écrire « 87 » est impossible :
   aucune méthode d'émission n'accepte un nombre, sauf la liste fermée des numéros de
   section.

2. **La provenance est vérifiée deux fois.** À l'ajout de chaque ligne, tout nombre qui n'a
   pas été émis par une origine interrompt la composition. En fin de rendu, V-Provenance
   résout à nouveau chaque émission dans sa source et compare : un registre modifié après
   coup ne passe pas.

3. **Aucun indicateur vide.** Une ligne ou une section sans donnée n'apparaît pas. Une
   matière sans bloc C n'affiche pas un tiret dans la colonne « tâche type épreuve » :
   la colonne disparaît si aucune matière n'en a.

Un contrôle qui échoue rend le bilan « en attente » (§ 6.3) : il n'est jamais contourné.
Le corps n'est alors pas rendu — seul l'est le relevé des contrôles.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

from maquette_bilan import (Bilan, charger, heures,  # noqa: E402
                            indicateurs_de_charge, valeurs_moteur)
import validate_referentiel as VR  # noqa: E402
import diffusabilite as DIF  # noqa: E402

REGLES = charger(RACINE / "referentiels" / "regles_bilan.json")
REGLE_PARENT = REGLES["registre_parent"]
RESERVE_FORMULE = REGLES["formule_recommandee"]["emplacement_reserve"]

NOMBRE = r"\d+(?:[.,]\d+)?"

#: Bandeau d'un rendu de maquette. Il tient sur une ligne, sous le titre, et ne peut pas
#: être confondu avec un bilan remis : c'est le premier texte que le lecteur rencontre.
BANDEAU_MAQUETTE = "**MAQUETTE — DONNÉES FICTIVES — NON DIFFUSABLE**"

#: Les quatre origines admises pour un nombre du document remis.
ORIGINES = ("moteur", "questionnaire", "referentiel", "structure")

#: Constantes structurelles du document : les numéros des sept sections du § 8.1, et les
#: renvois au Cahier que le document cite. Deux listes fermées, vérifiées à l'émission.
#: Toute autre valeur relève d'une des trois autres origines.
STRUCTURE_AUTORISEE = {1, 2, 3, 4, 5, 6, 7}
RENVOIS_CAHIER = {"6.3"}

REGISTRES = {
    "candidat": {
        "titre": "Bilan diagnostic",
        "sujet_minuscule": "vous",
        "note": "Ce bilan décrit un point de départ mesuré un jour donné. Il ne prédit "
                "aucun résultat et ne se compare à aucun autre candidat.",
    },
    "parent": {
        "titre": "Bilan diagnostic — document destiné aux responsables légaux",
        "sujet_minuscule": "votre enfant",
        "note": "Ce bilan décrit un point de départ mesuré un jour donné. Il ne prédit "
                "aucun résultat et ne se compare à aucun autre candidat. Il porte "
                "exactement les mêmes valeurs que le document remis au candidat.",
    },
}


def mode_de(b: Bilan) -> str:
    """Le mode de rendu, déclaré par le jeu de données et jamais déduit de son chemin.

    Un dossier nommé `_MAQUETTE` reste un dossier : c'est le questionnaire qui porte
    `mode_rendu`, dans une liste fermée. Sans déclaration, le mode est « production »,
    celui qui bloque le bilan dès qu'un instrument source n'est pas diffusable.
    """
    mode = b.qp.get("mode_rendu", "production")
    if mode not in DIF.MODES:
        raise ValueError(f"mode de rendu inconnu : {mode!r} — attendus {DIF.MODES}")
    return mode


def diffusable(verifs) -> bool:
    """Un contrôle « sans objet » ne bloque pas ; un contrôle échoué bloque toujours."""
    return not any(etat is False for _, etat, _ in verifs)


class NombreSansProvenance(Exception):
    """Un nombre a été composé sans venir d'une source déclarée."""


# ════════════════════════════════════════════════════════ les sources autorisées

class Sources:
    """Les quatre origines admises, et de quoi vérifier chacune.

    Une origine n'est pas une étiquette : c'est un endroit où la valeur imprimée doit se
    retrouver. `valeur_moteur` la cherche dans le registre des calculs, `valeur_qp` dans
    les réponses du candidat, `valeur_ref` au chemin déclaré d'un référentiel. Une clé
    inconnue lève ; une valeur qui n'y est pas ne s'imprime pas.
    """

    def __init__(self, b: Bilan):
        self.b = b
        self.moteur = valeurs_moteur(b)
        self.referentiels = {
            "regles_bilan": b.regles,
            "competences": b.ref,
            "catalogue": b.cat_brut,
            "dimensions_met": b.met_ref,
            "codes_erreur": charger(RACINE / "referentiels" / "codes_erreur.json"),
            "programmes_examen": charger(RACINE / "referentiels"
                                         / "programmes_examen.json"),
            "variables_qp": charger(RACINE / "referentiels" / "variables_qp.json"),
            "formulaire_qp": charger(RACINE / "instruments" / "QP" / "formulaire.json"),
            "banque": {code: charger(RACINE / "instruments" / code / "banque.json")
                       for code, _ in b.instruments
                       if (RACINE / "instruments" / code / "banque.json").exists()},
        }

    @staticmethod
    def _descendre(racine, chemin: str):
        courant = racine
        for segment in chemin.split("."):
            if isinstance(courant, list):
                courant = courant[int(segment)]
            elif segment in courant:
                courant = courant[segment]
            else:
                raise KeyError(f"chemin absent : {chemin} (à « {segment} »)")
        return courant

    def valeur_moteur(self, cle: str):
        if cle not in self.moteur:
            raise KeyError(f"clé absente du registre du moteur : {cle}")
        return self.moteur[cle]

    def valeur_qp(self, chemin: str):
        return self._descendre(self.b.qp, chemin)

    def valeur_ref(self, chemin: str):
        nom, reste = chemin.split(".", 1)
        if nom not in self.referentiels:
            raise KeyError(f"référentiel inconnu : {nom}")
        return self._descendre(self.referentiels[nom], reste)


class Prose:
    """Accumulateur de lignes où tout nombre vient d'une source, jamais d'une saisie.

    Aucune méthode d'émission ne prend une valeur : elles prennent une clé, un chemin ou
    un identifiant, et vont chercher la valeur elles-mêmes. Le seul endroit où un nombre
    entre au clavier est `structure`, dont la liste est fermée et vérifiée.
    """

    def __init__(self, sources: Sources):
        self.src = sources
        self.lignes: list[str] = []
        self.emis: dict[str, set] = {}
        self.emissions: list[tuple] = []
        #: Les couples (candidat, parent) que le registre autorise à différer. Ils sont
        #: enregistrés au fil de la composition : la preuve de registre les neutralise et
        #: exige que tout le reste soit identique, au caractère près.
        self.variantes: list[tuple[str, str]] = []

    # ── enregistrement
    def _emettre(self, texte: str, origine: str, cle: str) -> str:
        if origine not in ORIGINES:
            raise NombreSansProvenance(f"origine inconnue : {origine}")
        for morceau in re.findall(NOMBRE, texte):
            self.emis.setdefault(morceau, set()).add((origine, cle))
        self.emissions.append((texte, origine, cle))
        return texte

    # ── origine « moteur de calcul »
    def nb(self, cle: str) -> str:
        return self._emettre(f"{self.src.valeur_moteur(cle):.0f}", "moteur", cle)

    def note(self, cle: str) -> str:
        """Une note sur 20 s'écrit au dixième : arrondir 11,9 à 12 change la note.

        La virgule est la virgule française ; le contrôle de texte lit le nombre tel
        qu'il est imprimé, et le point décimal n'a pas cours dans un document remis.
        """
        return self._emettre(f"{self.src.valeur_moteur(cle):.1f}".replace(".", ","),
                             "moteur", cle)

    def pct(self, cle: str) -> str:
        return self._emettre(f"{self.src.valeur_moteur(cle) * 100:.0f} %", "moteur", cle)

    def h(self, cle: str) -> str:
        return self._emettre(heures(self.src.valeur_moteur(cle)), "moteur", cle)

    # ── origine « questionnaire / données candidat »
    def qp(self, chemin: str) -> str:
        return self._emettre(f"{self.src.valeur_qp(chemin):.0f}", "questionnaire", chemin)

    def qp_texte(self, chemin: str) -> str:
        return self._emettre(str(self.src.valeur_qp(chemin)), "questionnaire", chemin)

    def qp_libelle(self, champ: str, valeur=None) -> str:
        """L'intitulé lisible d'une valeur du questionnaire, pris au formulaire.

        La valeur vient du candidat, l'intitulé du formulaire qu'il a lu : le texte
        imprimé est celui du référentiel, et c'est son chemin qui est enregistré.
        """
        questions = self.src.referentiels["formulaire_qp"]["questions"]
        i = next((j for j, q in enumerate(questions) if q.get("cible") == champ), None)
        if i is None:
            raise KeyError(f"aucune question du formulaire ne renseigne {champ}")
        if valeur is None:
            valeur = self.src.valeur_qp(f"reponses.{champ}")
        for k, o in enumerate(questions[i].get("options", [])):
            if o["valeur"] == valeur:
                return self.ref_texte(
                    f"formulaire_qp.questions.{i}.options.{k}.libelle")
        return self.qp_texte(f"reponses.{champ}")

    def qp_axe(self, champ: str, rang: int) -> str:
        questions = self.src.referentiels["formulaire_qp"]["questions"]
        i = next(j for j, q in enumerate(questions) if q.get("cible") == champ)
        return self.ref_texte(f"formulaire_qp.questions.{i}.axes.{rang}")

    # ── origine « référentiel canonique »
    def ref(self, chemin: str) -> str:
        return self._emettre(f"{self.src.valeur_ref(chemin):.0f}", "referentiel", chemin)

    def ref_pct(self, chemin: str) -> str:
        return self._emettre(f"{self.src.valeur_ref(chemin) * 100:.0f} %",
                             "referentiel", chemin)

    def ref_texte(self, chemin: str) -> str:
        return self._emettre(str(self.src.valeur_ref(chemin)), "referentiel", chemin)

    def ref_texte_minuscule(self, chemin: str) -> str:
        """La même chaîne, initiale abaissée, pour l'insérer au fil d'une phrase.

        Abaisser toute la chaîne écraserait « bloc A » en « bloc a » : seule la première
        lettre change, et V-Provenance admet cette variante-là, pas une autre.
        """
        v = str(self.src.valeur_ref(chemin))
        return self._emettre(v[:1].lower() + v[1:], "referentiel", chemin)

    def competence(self, pc: str, comp: str) -> str:
        """L'intitulé d'une compétence dans la version passée, cité par son chemin.

        Quand le référentiel porte un intitulé propre à la version — un assemblage de
        Première n'annonce pas de contenu de Terminale — c'est ce chemin-là qui est cité.
        """
        version = self.src.b.version_passee(pc)
        for i, per in enumerate(self.src.referentiels["competences"]["perimetres"]):
            if per["code"] != pc:
                continue
            for j, c in enumerate(per["competences"]):
                if c["code"] != comp:
                    continue
                base = f"competences.perimetres.{i}.competences.{j}"
                if version in (c.get("intitule_par_version") or {}):
                    return self.ref_texte(f"{base}.intitule_par_version.{version}")
                return self.ref_texte(f"{base}.intitule")
        raise KeyError(f"compétence absente du référentiel : {pc}/{comp}")

    def erreur(self, code: str) -> str:
        for i, c in enumerate(self.src.referentiels["codes_erreur"]["codes"]):
            if c["code"] == code:
                return self.ref_texte(f"codes_erreur.codes.{i}.libelle")
        raise KeyError(f"code d'erreur absent du référentiel : {code}")

    def perimetre(self, pc: str) -> str:
        """L'intitulé de la matière tel que le candidat doit le lire.

        Le périmètre porte un intitulé général ; quand la version passée en a un propre —
        le français de l'épreuve anticipée en a trois depuis Q-21 — c'est celui-là qui est
        juste : un candidat qui ne repasse que l'oral ne lit pas « écrit et oral ».
        """
        b = self.src.b
        version = next((v for c, v in b.porteurs if b.cat[(c, v)]["perimetre"] == pc), None)
        i = next(j for j, per in enumerate(
            self.src.referentiels["competences"]["perimetres"]) if per["code"] == pc)
        if version in (b.per[pc].get("libelle_par_version") or {}):
            return self.ref_texte(
                f"competences.perimetres.{i}.libelle_par_version.{version}")
        return self.ref_texte(f"competences.perimetres.{i}.libelle")

    def groupe(self, g: str) -> str:
        decl = self.src.referentiels["competences"]["conventions"]["groupes_planification"]
        if g in decl["groupes"]:
            return self.ref_texte(
                f"competences.conventions.groupes_planification.groupes.{g}.libelle")
        return self.perimetre(g)

    def _index_instrument(self, code: str, version: str) -> int:
        for i, x in enumerate(self.src.referentiels["catalogue"]["instruments"]):
            if (x["code"], x["version"]) == (code, version):
                return i
        raise KeyError(f"instrument absent du catalogue : {code}/{version}")

    def instrument(self, code: str, version: str) -> str:
        return self.ref_texte(
            f"catalogue.instruments.{self._index_instrument(code, version)}.libelle")

    def code_instrument(self, code: str, version: str) -> str:
        return self.ref_texte(
            f"catalogue.instruments.{self._index_instrument(code, version)}.code")

    def version_instrument(self, code: str, version: str) -> str:
        return self.ref_texte(
            f"catalogue.instruments.{self._index_instrument(code, version)}.version")

    def version_banque(self, code: str) -> str | None:
        if code not in self.src.referentiels["banque"]:
            return None
        return self.ref_texte(f"banque.{code}.version")

    def libelle_niveau(self, libelle: str) -> str:
        """Un niveau : une valeur du référentiel que le moteur a désignée, pas une chaîne."""
        paliers = self.src.referentiels["regles_bilan"]["niveaux_competence"]["paliers"]
        for i, x in enumerate(paliers):
            if x["libelle"] == libelle:
                return self.ref_texte(f"regles_bilan.niveaux_competence.paliers.{i}.libelle")
        for chemin in ("regles_bilan.niveaux_competence.non_evalue.libelle",
                       "regles_bilan.module_entree.libelle_remise_a_niveau",
                       "regles_bilan.module_entree.libelle_defaut"):
            if self.src.valeur_ref(chemin) == libelle:
                return self.ref_texte(chemin)
        raise KeyError(f"niveau hors du référentiel : {libelle}")

    def niveau_competence(self, pc: str, comp: str) -> str:
        return self.libelle_niveau(self.src.b.res[(pc, comp)]["niveau"])

    def palier(self, pc: str, comp: str) -> str:
        """Le palier de profondeur atteint, et jusqu'où la mesure est allée (EC-32).

        Une compétence servie sur D1 et D2 ne peut pas rendre D3 : un candidat classé D2
        n'a pas échoué au raisonnement dans ce domaine, il n'y a pas été interrogé. Le
        rendu nomme donc le maximum testé chaque fois qu'il est inférieur au haut de
        l'échelle, faute de quoi le palier se lirait comme un plafond de capacité alors
        qu'il est un plafond de mesure.
        """
        x = self.src.b.res[(pc, comp)]
        rendu = self.code_palier(x["palier"])
        paliers = list(self.src.referentiels["competences"]["conventions"]["paliers"])
        maxi = x.get("palier_maximal_teste", "—")
        if maxi in paliers and maxi != paliers[-1]:
            rendu += (" (" + self.ref_texte("regles_bilan.palier_de_profondeur."
                                            "mention_maximum_teste")
                      + " " + self.code_palier(maxi) + ")")
        return rendu

    def code_palier(self, valeur: str) -> str:
        if valeur == "—":
            return valeur
        paliers = self.src.referentiels["competences"]["conventions"]["paliers"]
        if valeur not in paliers:
            raise KeyError(f"palier hors du référentiel : {valeur}")
        return self._emettre(valeur, "referentiel", "competences.conventions.paliers")

    # ── origine « constante structurelle »
    def structure(self, n: int) -> str:
        if n not in STRUCTURE_AUTORISEE:
            raise NombreSansProvenance(
                f"{n} n'est pas une constante structurelle du document")
        return self._emettre(str(n), "structure", "numero_de_section")

    def renvoi(self, paragraphe: str) -> str:
        """Un renvoi au Cahier, pris dans la liste fermée des renvois du document."""
        if paragraphe not in RENVOIS_CAHIER:
            raise NombreSansProvenance(
                f"§ {paragraphe} n'est pas un renvoi déclaré du document")
        return self._emettre(paragraphe, "structure", "renvoi_cahier")

    # ── composition
    def __iadd__(self, lignes):
        for ligne in (lignes if isinstance(lignes, list) else [lignes]):
            inconnus = [m for m in re.findall(NOMBRE, ligne) if m not in self.emis]
            if inconnus:
                raise NombreSansProvenance(
                    f"nombre(s) sans provenance {inconnus} dans : {ligne[:120]}")
            self.lignes.append(ligne)
        return self

    def rendu(self) -> str:
        return "\n".join(self.lignes) + "\n"

    def provenances_invalides(self) -> list[str]:
        """Rejoue chaque émission dans sa source : le registre n'est pas parole d'évangile."""
        mauvaises = []
        for texte, origine, cle in self.emissions:
            try:
                if origine == "moteur":
                    v = self.src.valeur_moteur(cle)
                    # Une note sur 20 s'imprime au dixième, virgule française : la forme
                    # rendue par `note` fait partie des écritures admises de la valeur.
                    admis = {f"{v:.0f}", f"{v * 100:.0f} %", heures(v),
                             f"{v:.1f}".replace(".", ",")}
                elif origine == "questionnaire":
                    v = self.src.valeur_qp(cle)
                    admis = {str(v)}
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        admis.add(f"{v:.0f}")
                elif origine == "referentiel":
                    v = self.src.valeur_ref(cle)
                    admis = {str(v)}
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        admis |= {f"{v:.0f}", f"{v * 100:.0f} %"}
                    if isinstance(v, str):
                        admis.add(v[:1].upper() + v[1:])
                        admis.add(v[:1].lower() + v[1:])
                        admis.add(v.capitalize())
                        admis.add(v.lower())
                    if isinstance(v, dict):
                        admis = set(v)          # un palier est une clé du référentiel
                elif cle == "numero_de_section":
                    admis = {str(n) for n in STRUCTURE_AUTORISEE}
                else:
                    admis = set(RENVOIS_CAHIER)
            except (KeyError, IndexError, ValueError, TypeError) as exc:
                mauvaises.append(f"{origine}:{cle} — {exc}")
                continue
            if texte not in admis:
                mauvaises.append(f"{origine}:{cle} — « {texte} » ne s'y retrouve pas")
        return mauvaises


# ══════════════════════════════════════════════════════ chaîne de validation § 6.3

def controles(b: Bilan, texte: str, p: Prose,
              mode: str = "production") -> list[tuple]:
    """V-Complétude à V-Texte du § 6.3, plus V-Instruments, V-Provenance et V-Tarif.

    Un contrôle rend (nom, état, constat) où l'état vaut True, False, ou None quand le
    contrôle est sans objet pour ce mode de rendu.
    """
    res = []
    emis = set(p.emis)

    # V-Instruments — chaque instrument ayant contribué est-il imprimable ?
    codes = [code for code, _ in b.instruments]
    bloques = DIF.non_diffusables(codes)
    detail = "; ".join(f"{x['code']} ({x['motifs'][0]['motif']})" for x in bloques[:4])
    if mode == "maquette":
        res.append(("V-Instruments", None,
                    "sans objet — rendu de maquette, non diffusable par construction"
                    + (f" ; {len(bloques)} instrument(s) source(s) non diffusable(s) : "
                       f"{detail}" if bloques else "")))
    else:
        res.append(("V-Instruments", not bloques,
                    f"les {len(codes)} instruments employés sont diffusables"
                    if not bloques
                    else f"{len(bloques)} instrument(s) non diffusable(s) : {detail}"))

    # V-Complétude — tout item de l'assemblage a une ligne
    attendus, saisis = set(), set()
    for (code, version, iid) in b.blocs_item:
        if (code, version) in b.porteurs:
            attendus.add((code, iid))
    for l in b.lignes + b.grilles:
        c = l["instrument"].split("/")[0]
        saisis.add((c, l["item_id"]))
    manquants = sorted(attendus - saisis)
    res.append(("V-Complétude", not manquants,
                "tous les items ont une ligne" if not manquants
                else f"{len(manquants)} item(s) sans ligne : {manquants[:5]}"))

    # V-Bornes — aucun score hors bornes, aucun total de bloc C saisi à la main
    hors = []
    maxi_grille = b.echelle_grille
    for l in b.lignes:
        code = l["instrument"].split("/")[0]
        it = b.banques.get(code, {}).get(l["item_id"])
        if it is None:
            continue
        if it["type"] == "C" and not l.get("criterion"):
            hors.append(f"{l['item_id']} : total de bloc C saisi")
        elif l["score"] and not 0 <= int(l["score"]) <= it["score_max"]:
            hors.append(f"{l['item_id']} : score {l['score']} hors de "
                        f"[0, {it['score_max']}]")
    for g in b.grilles:
        if g["score"] and not 0 <= int(g["score"]) <= maxi_grille:
            hors.append(f"{g['item_id']}/{g['criterion']} : score {g['score']} hors de "
                        f"[0, {maxi_grille}]")
    res.append(("V-Bornes", not hors,
                "aucun score hors bornes" if not hors else "; ".join(hors[:3])))

    # V-Cohérence — le score d'un item de type A se recalcule depuis la réponse brute
    ecarts = []
    for l in b.lignes:
        code = l["instrument"].split("/")[0]
        it = b.banques.get(code, {}).get(l["item_id"])
        if it is None or it["type"] != "A":
            continue
        attendu = it["score_max"] if l["response"] == it["cle"]["reponse"] else 0
        if int(l["score"]) != attendu:
            ecarts.append(f"{l['item_id']} : réponse {l['response']}, score {l['score']}, "
                          f"attendu {attendu}")
    res.append(("V-Cohérence", not ecarts,
                "les scores des items fermés coïncident avec les réponses brutes"
                if not ecarts else "; ".join(ecarts[:3])))

    # V-Couverture — toute compétence affichée avec un niveau est évaluée
    non_evaluees = sorted(f"{k[0]}/{k[1]}" for k, x in b.res.items() if not x["evalue"])
    res.append(("V-Couverture", not non_evaluees,
                "toutes les compétences affichées sont évaluées" if not non_evaluees
                else f"{len(non_evaluees)} compétence(s) sous le seuil : {non_evaluees[:5]}"))

    # V-Double lecture — écart entre deux lectures d'un même critère
    lectures: dict[tuple, set] = {}
    for g in b.grilles:
        lectures.setdefault((g["instrument"], g["item_id"], g["criterion"]), set()).add(
            (g["corrector_ref"], int(g["score"])))
    divergents = [k for k, v in lectures.items()
                  if len({c for c, _ in v}) > 1
                  and max(s for _, s in v) - min(s for _, s in v) > 2]
    res.append(("V-Double lecture", not divergents,
                "aucun écart de plus de deux points entre deux lectures"
                if not divergents else f"{len(divergents)} critère(s) en écart"))

    # V-Texte — aucun chiffre absent des émissions, aucun terme bloquant
    inconnus = sorted({x for x in re.findall(NOMBRE, texte)} - emis)
    tb = charger(RACINE / "referentiels" / "termes_bloquants.json")
    bloquants = VR.chercher_termes(texte, "prose_bilan", tb, "bilan")
    ok = not inconnus and not bloquants
    constat = "aucun chiffre étranger aux émissions, aucun terme bloquant"
    if inconnus:
        constat = f"chiffre(s) du rendu sans émission : {inconnus[:8]}"
    elif bloquants:
        constat = f"{len(bloquants)} terme(s) bloquant(s) : {bloquants[:2]}"
    res.append(("V-Texte", ok, constat))

    # V-Provenance — chaque émission se retrouve dans sa source
    mauvaises = p.provenances_invalides()
    res.append(("V-Provenance", not mauvaises,
                f"{len(p.emissions)} émissions, toutes retrouvées dans leur source"
                if not mauvaises else "; ".join(mauvaises[:3])))

    # V-Tarif — aucun montant, la formule reste un emplacement réservé
    montants = re.findall(r"\d[\d\s]*(?:[.,]\d+)?\s*(?:TND|DT)\b", texte)
    res.append(("V-Tarif", not montants,
                "aucun montant dans le gabarit" if not montants
                else f"montant(s) trouvé(s) : {montants[:3]}"))
    return res


# ═══════════════════════════════════════════════════ section 4, appuis et priorités

def appuis_et_priorites(b: Bilan) -> tuple[list, list]:
    """Les trois appuis, et les trois priorités **dérivées du plan** (EC-27).

    Les appuis sont les compétences évaluées les plus solides. Les priorités ne sont pas
    choisies séparément : ce sont les modules d'entrée des premiers groupes du plan qui
    appellent une intervention, dans l'ordre même de la priorité entre matières. La
    section 4 est ainsi la lecture pédagogique de la section 5, jamais une liste
    concurrente. À moins de trois groupes concernés, il y a moins de trois priorités.
    """
    g = b.regles["points_appui"]
    defaut = b.regles["module_entree"]["libelle_defaut"]
    ordre, _ = b.priorite()

    priorites = []
    for groupe in ordre:
        if len(priorites) == g["nombre_priorites"]:
            break
        pc, _ = b.module_entree_groupe(groupe)
        module, code, motif = b.module_entree(pc)
        if module == defaut:
            continue
        priorites.append({"groupe": groupe, "perimetre": pc, "module": module,
                          "competence": code, "motif": motif,
                          "niveau": b.niveau_entree(pc)})

    pris = {(x["perimetre"], x["competence"]) for x in priorites if x["competence"]}
    rang = {}
    for pc in b.perimetres_passes:
        for i, c in enumerate(b.per[pc]["competences"]):
            rang[(pc, c["code"])] = i
    evaluees = [(k, x) for k, x in b.res.items() if x["evalue"] and k not in pris]
    appuis = sorted(evaluees, key=lambda kx: (-kx[1]["part"], rang.get(kx[0], 0)))
    return appuis[:g["nombre_appuis"]], priorites


def registres_a_produire(b: Bilan) -> list[str]:
    """§ 9 — le statut de minorité conditionne la génération de la version parent."""
    r = REGLE_PARENT
    if b.qp["reponses"].get(r["variable_qp"]) == r["valeur_declencheuse"]:
        return ["candidat", "parent"]
    return ["candidat"]


def module_lisible(module: str) -> str:
    """Le module d'entrée sans son code de compétence : « GRAM — Grammaire… » → l'intitulé.

    Le code sert au coach et au moteur ; le document remis nomme la compétence.
    """
    return module.split(" — ", 1)[1] if " — " in module else module


def sequencement(b: Bilan, p, ordre: list[str]) -> str:
    """La phrase de séquencement sous alerte de charge (Q-25, EC-30).

    Elle descend du plan : l'ordre de priorité calculé, et les modules de remise à niveau
    qui conditionnent la suite. Aucune priorité n'est attachée à l'étiquette « première
    partie du baccalauréat », et aucun découpage trimestriel n'est proposé.
    """
    def nom(g):
        return p.groupe(g) if len(b.groupes[g]) > 1 else p.perimetre(b.groupes[g][0])

    remise = b.regles["module_entree"]["libelle_remise_a_niveau"]
    bloquants = [g for g in ordre
                 if b.module_entree(b.module_entree_groupe(g)[0])[0] == remise]
    phrase = (p.ref_texte("regles_bilan.alerte_charge.phrase_bilan")
              + f" — « {nom(ordre[0])} » d'abord, puis les suivantes dans cet ordre.")
    if bloquants:
        phrase += (" " + p.ref_texte("regles_bilan.alerte_charge.sequencement."
                                     "prerequis_bloquants")
                   + " Ici : " + ", ".join(f"« {nom(g)} »" for g in bloquants) + ".")
    return phrase


def perimetres_ordonnes(b: Bilan) -> list[str]:
    """Les périmètres passés, dans l'ordre de priorité de leur groupe."""
    ordre, _ = b.priorite()
    return [pc for g in ordre for pc in b.groupes[g]]


def nom_matiere(b: Bilan, pc: str) -> str:
    """L'intitulé de matière hors composition — même règle que `Prose.perimetre`."""
    version = next((v for c, v in b.porteurs if b.cat[(c, v)]["perimetre"] == pc), None)
    return (b.per[pc].get("libelle_par_version") or {}).get(version,
                                                            b.per[pc]["libelle"])


# ══════════════════════════════════════════════════════════════ les sept sections

def composer(b: Bilan, registre: str = "candidat") -> tuple[str, Prose]:
    """Compose le corps des sept sections et rend la prose qui l'a produit.

    Séparer la composition du rendu permet aux contrôles — et aux tests adversariaux —
    de travailler sur le corps **et** sur le registre des émissions qui l'a produit.
    """
    R = REGISTRES[registre]
    G = b.regles
    r = b.qp["reponses"]
    p = Prose(Sources(b))
    parent = registre == "parent"
    mode = mode_de(b)
    sujet = R["sujet_minuscule"]

    def dit(candidat: str, version_parent: str) -> str:
        p.variantes.append((candidat, version_parent))
        return version_parent if parent else candidat

    ordre, _ = b.priorite()
    par_priorite = perimetres_ordonnes(b)
    modules = {pc: b.module_entree(pc) for pc in b.perimetres_passes}
    semaines = "regles_bilan.evaluation_intermediaire.delai_semaines"
    echelle_max = "regles_bilan.indice_calibration.echelle_percue.max"
    convertie = "regles_bilan.indice_calibration.echelle_convertie.max"

    p += [f"# {R['titre']}", ""]
    if mode == "maquette":
        p += [BANDEAU_MAQUETTE, "",
              "> Ce document est produit sur un jeu fictif pour éprouver les règles et "
              "les contrôles. Il ne décrit aucun candidat réel et n'est remis à personne. "
              "Plusieurs instruments qui l'alimentent ne sont pas diffusables.", ""]
    # Le champ « session visée » est déprécié : il portait deux décisions différentes — quel
    # programme d'œuvres, quel programme de mathématiques — qui ne suivent pas le même axe.
    # L'en-tête dit désormais les deux faits utiles au lecteur : la session du baccalauréat
    # et la façon dont les épreuves anticipées y sont présentées.
    anticipe = r["mode_passation_ea"] == "anticipation"
    p += [f"- Candidat : `{p.qp_texte('candidate_ref')}`",
          f"- Session du baccalauréat : **{p.qp_texte('reponses.session_baccalaureat_finale')}**",
          "- Épreuves anticipées : "
          + ("par anticipation, l'année scolaire "
             if anticipe else "à la même session que les épreuves terminales, l'année scolaire ")
          + f"**{p.qp_texte('reponses.annee_scolaire_passation_ea')}**",
          f"- Date de passation : {p.qp_texte('session_date')}", "",
          f"> {R['note']}", ""]

    # ── 1 · Situation
    p += ["---", "", f"## {p.structure(1)}. Situation", ""]
    interruption = (f"interruption de {p.qp('reponses.annees_interruption')} "
                    f"an{'s' if r['annees_interruption'] > 1 else ''}"
                    if r["annees_interruption"] else "sans interruption")
    champ_fr = b.cat_brut["conventions"]["configuration_francais"]["variable_qp"]
    variables = charger(RACINE / "referentiels" / "variables_qp.json")["variables"]
    i_conf = next(i for i, v in enumerate(variables) if v["code"] == champ_fr)
    config = r[champ_fr]
    axes = list(r["auto_francais"])
    p += [f"- Profil **{p.qp_texte('reponses.profil')}**, dernière classe complète : "
          f"{p.qp_libelle('derniere_classe_complete')}, {interruption}",
          "- Épreuves de français à présenter : **"
          + p.ref_texte(f"variables_qp.variables.{i_conf}.libelles_valeurs.{config}")
          + "**",
          "- Spécialités : "
          + ", ".join(f"**{p.qp_libelle('specialites', x)}**" for x in r["specialites"])
          + (f", dont **{p.qp_libelle('specialites', r['specialite_abandonnee'])}** "
             f"abandonnée" if r["specialite_abandonnee"] != "aucune" else ""),
          f"- Temps disponible déclaré : **{p.qp('reponses.heures_disponibles')} h** par "
          f"semaine ; activité en parallèle : {p.qp_libelle('activite_parallele').lower()}",
          f"- Langue de scolarisation : {p.qp_libelle('langue_scolarisation')} ; "
          f"langue à la maison : {p.qp_libelle('langue_maison')}",
          "- Français déclaré, à titre de contexte : "
          + " · ".join(f"{p.qp_axe('auto_francais', i).lower()} "
                       f"{p.qp('reponses.auto_francais.' + k)}/{p.ref(echelle_max)}"
                       for i, k in enumerate(axes)), "",
          "Instruments passés et version de banque :", ""]
    for code, version in b.instruments:
        ver = p.version_banque(code)
        ligne = (f"- {p.instrument(code, version)} — **{p.code_instrument(code, version)}"
                 f" / {p.version_instrument(code, version)}**")
        p += [ligne + (f", banque {ver}" if ver else "")]
    p += [""]

    # ── 2 · Synthèse en une page
    p += ["---", "", f"## {p.structure(2)}. Synthèse", ""]
    colonnes = ["Matière", "Score global", "Taux de prérequis", "Palier de profondeur",
                "Niveau d'entrée", "Priorité"]
    avec_tache = [pc for pc in b.perimetres_passes if b.agr[pc]["tache"] is not None]
    if avec_tache:
        colonnes.insert(4, "Tâche type épreuve")
    p += ["| " + " | ".join(colonnes) + " |", "|" + "---|" * len(colonnes)]
    for pc in par_priorite:
        a = b.agr[pc]
        paliers = [b.res[k]["palier"] for k in b.res
                   if k[0] == pc and b.res[k]["palier"] != "—"]
        haut = max(paliers) if paliers else "—"
        ligne = [f"**{p.perimetre(pc)}**", p.pct(f"global.{pc}"),
                 p.pct(f"prerequis.{pc}") if a["prerequis"] is not None else "—",
                 p.code_palier(haut),
                 p.libelle_niveau(b.niveau_entree(pc)),
                 p.nb(f"rang.{b.groupe_de[pc]}")]
        if avec_tache:
            ligne.insert(4, p.pct(f"tache.{pc}") if a["tache"] is not None else "—")
        p += ["| " + " | ".join(ligne) + " |"]
    p += ["", "*Le score global et le palier de profondeur se lisent ensemble : à score "
          "égal, un palier bas signale une notion qui tient dans le contexte où elle a été "
          "vue, un palier haut une notion qui se transporte dans un raisonnement à "
          "construire. Un palier noté « — » signifie qu'aucun palier n'atteint les "
          + p.ref_texte("regles_bilan.palier_de_profondeur.expression")
          + " de points requis.*", ""]
    for g in [x for x in ordre if len(b.groupes[x]) > 1]:
        p += [f"*{p.groupe(g)} : deux mesures distinctes, jamais moyennées — "
              + " et ".join(f"« {p.perimetre(pc)} »" for pc in b.groupes[g])
              + ". Elles portent le même rang parce qu'elles forment une seule matière de "
                "travail, avec une seule enveloppe hebdomadaire en section "
              + p.structure(7) + ".*", ""]
    for pc, _ in b.statuts_a_signaler():
        p += [f"*{p.perimetre(pc)} — "
              + p.ref_texte("regles_bilan.statut_specialite.phrase") + "*", ""]

    # ── 3 · Cartographie par matière
    p += ["---", "", f"## {p.structure(3)}. Cartographie par matière", ""]
    for pc in par_priorite:
        a = b.agr[pc]
        p += [f"### {p.perimetre(pc)}", "",
              "| Compétence | Niveau | Score | Palier |", "|---|---|---|---|"]
        for c in b.per[pc]["competences"]:
            code = c["code"]
            if (pc, code) not in b.res or not b.res[(pc, code)]["evalue"]:
                continue
            p += [f"| {p.competence(pc, code)} | {p.niveau_competence(pc, code)} | "
                  f"{p.pct(f'score.{pc}.{code}')} | {p.palier(pc, code)} |"]
        p += [""]
        details = [f"Score global du diagnostic : {p.pct(f'global.{pc}')}."]
        if a["non_reponse"]:
            details.append(f"Taux de non-réponse : {p.pct(f'non_reponse.{pc}')}.")
        if a["tache"] is not None:
            details.append(f"Production au format de l'épreuve (bloc C) : "
                           f"{p.pct(f'tache.{pc}')} ({p.nb(f'tache.{pc}.obtenu')} points "
                           f"sur {p.nb(f'tache.{pc}.max')}).")
        erreurs = {}
        for k, x in b.res.items():
            if k[0] == pc:
                for code_err, n in x["erreurs"].items():
                    erreurs[code_err] = erreurs.get(code_err, 0) + n
        if erreurs:
            recurrents = sorted(erreurs.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
            details.append(
                "Erreurs les plus fréquentes : "
                + " · ".join(f"{p.erreur(code)} ({p.nb(f'erreurs.{pc}.{code}')})"
                             for code, _ in recurrents) + ".")
        p += [" ".join(details), ""]
        # Trois nombres qui ne disent pas la même chose, et que rien ne doit confondre :
        # le score global du diagnostic, la réussite des productions du bloc C — le seul
        # indicateur comparable d'un bilan au suivant —, et la note qu'aurait la copie à
        # la pondération officielle de l'épreuve.
        fmt = b.score_format_epreuve(pc)
        if fmt:
            parties = " · ".join(
                f"{x['intitule_court']} : "
                + p.note(f"format.{pc}.{code}") + " sur "
                + p.nb(f"format.{pc}.{code}.officiel")
                for code, x in fmt["parties"].items())
            p += ["**Note estimée au format de l'épreuve : "
                  + p.note(f"format.{pc}.total") + " sur "
                  + p.nb(f"format.{pc}.sur") + ".** " + parties + ". "
                  + p.ref_texte("programmes_examen.epreuves_anticipees.session_2027."
                                "mathematiques.format_epreuve.score_format.distinction"),
                  ""]
        if pc == G["oral_de_francais"]["rattachement"]:
            v = b.vigilance_oral_francais()
            if v:
                instr = G["oral_de_francais"]["instrument"]
                critere = v["critere"]
                p += [f"**Oral de français.** {p.nb(f'grille.{instr}.obtenu')} points sur "
                      f"{p.nb(f'grille.{instr}.max')}. Point de vigilance : "
                      f"{v['intitule'].lower()}, à {p.nb(f'critere.{instr}.{critere}')} sur "
                      f"{p.ref('competences.conventions.echelle_grille.max')}.", ""]
    famille = [(k, x) for k, x in sorted(b.res.items())
               if x.get("famille") and x["evalue"]]
    if famille:
        p += ["### Langue, mesures mises en regard", "",
              "| Instrument | Mesure | Score | Niveau |", "|---|---|---|---|"]
        for k, _ in famille:
            p += [f"| {p.perimetre(k[0])} | {p.competence(k[0], k[1])} | "
                  f"{p.pct(f'score.{k[0]}.{k[1]}')} | {p.niveau_competence(k[0], k[1])} |"]
        p += ["", "*Ces mesures sont affichées côte à côte et ne sont jamais moyennées : "
              "elles servent à distinguer une difficulté de langue d'une difficulté "
              "propre à la matière.*", ""]

    # ── 4 · Points d'appui et vigilances
    appuis, priorites = appuis_et_priorites(b)
    p += ["---", "", f"## {p.structure(4)}. Points d'appui et vigilances", "",
          dit(f"**Sur quoi {sujet} pouvez vous appuyer.**",
              f"**Sur quoi {sujet} peut s'appuyer.**"), "",
          "| Matière | Compétence | Score | Palier |", "|---|---|---|---|"]
    for k, _ in appuis:
        p += [f"| {p.perimetre(k[0])} | {p.competence(k[0], k[1])} | "
              f"{p.pct(f'score.{k[0]}.{k[1]}')} | {p.palier(k[0], k[1])} |"]
    p += ["", "**Les priorités.** Ce sont les modules d'entrée du plan de démarrage, dans "
          "son ordre : la section qui suit dit comment chacun se travaille.", "",
          "| Rang | Matière | Module d'entrée | Mesure | Niveau d'entrée |",
          "|---|---|---|---|---|"]
    for x in priorites:
        pc, groupe = x["perimetre"], x["groupe"]
        mesure = (p.pct(f"score.{pc}.{x['competence']}") if x["competence"]
                  else "taux de prérequis " + p.pct(f"prerequis.{pc}"))
        p += [f"| {p.nb(f'rang.{groupe}')} | {p.perimetre(pc)} | "
              f"{module_lisible(x['module'])} | {mesure} | "
              f"{p.libelle_niveau(x['niveau'])} |"]
    actions, vus = [], []
    remise = G["module_entree"]["libelle_remise_a_niveau"]
    for x in priorites:
        if x["niveau"] in vus:
            continue
        vus.append(x["niveau"])
        if x["niveau"] == remise:
            actions.append(
                f"**{p.libelle_niveau(remise)}** — "
                + p.ref_texte_minuscule("regles_bilan.module_entree.action_remise_a_niveau"))
            continue
        for i, pal in enumerate(G["niveaux_competence"]["paliers"]):
            if pal["libelle"] == x["niveau"]:
                actions.append(
                    f"**{p.libelle_niveau(x['niveau'])}** — "
                    + p.ref_texte_minuscule(
                        f"regles_bilan.niveaux_competence.paliers.{i}.action"))
    if actions:
        p += ["", "Ce que chacun de ces niveaux appelle : " + " · ".join(actions) + ".", ""]
    else:
        p += [""]

    signaux = sorted(((k, c) for k, c in b.calibration_competences() if c["signal"]),
                     key=lambda kc: -abs(kc[1]["ecart"]))
    signaux_matiere = sorted(((pc, c) for pc in b.perimetres_passes
                              for c in [b.calibration_matiere(pc)] if c and c["signal"]),
                             key=lambda kc: -abs(kc[1]["ecart"]))
    if signaux or signaux_matiere:
        p += ["**Ce que la mesure dit de l'auto-positionnement.** Avant chaque épreuve, "
              + dit(f"{sujet} avez situé votre niveau", f"{sujet} a situé son niveau")
              + " sur une échelle de "
              + p.ref("regles_bilan.indice_calibration.echelle_percue.min") + " à "
              + p.ref(echelle_max) + ". Un écart de plus de "
              + p.ref("regles_bilan.indice_calibration.ecart_signal")
              + " points avec la mesure est signalé ici. Il ne modifie aucun des niveaux "
                "ci-dessus.", ""]
        for k, c in signaux:
            sens = "surestimation" if c["ecart"] > 0 else "sous_estimation"
            base = f"calibration.{k[0]}.{k[1]}"
            p += [f"- **{p.perimetre(k[0])} — {p.competence(k[0], k[1])}** : "
                  f"auto-positionnement {p.nb(base + '.percu')} sur {p.ref(echelle_max)}, "
                  f"soit {p.nb(base + '.percu100')} sur {p.ref(convertie)} ; mesure "
                  f"{p.nb(base + '.mesure')}. Écart de {p.nb(base + '.ecart_absolu')} "
                  f"points en "
                  f"{p.ref_texte(f'regles_bilan.indice_calibration.sens.{sens}.libelle')} — "
                  f"{p.ref_texte(f'regles_bilan.indice_calibration.sens.{sens}.mesure')}."]
        for pc, c in signaux_matiere:
            sens = "surestimation" if c["ecart"] > 0 else "sous_estimation"
            base = f"calibration.{pc}"
            p += [f"- **{p.perimetre(pc)}**, sur l'ensemble de la matière : "
                  f"auto-positionnement {p.nb(base + '.percu')} sur {p.ref(echelle_max)}, "
                  f"soit {p.nb(base + '.percu100')} sur {p.ref(convertie)} ; mesure "
                  f"{p.nb(base + '.mesure')}. Écart de {p.nb(base + '.ecart_absolu')} "
                  f"points en "
                  f"{p.ref_texte(f'regles_bilan.indice_calibration.sens.{sens}.libelle')} — "
                  f"{p.ref_texte(f'regles_bilan.indice_calibration.sens.{sens}.mesure')}."]
        p += [""]

    # ── 5 · Plan de démarrage
    p += ["---", "", f"## {p.structure(5)}. Plan de démarrage", "",
          "Les matières de travail sont données dans l'ordre de priorité du plan. Deux "
          "mesures d'une même matière — le français peut en compter deux — n'ouvrent "
          "qu'une seule enveloppe hebdomadaire.", ""]
    for g in ordre:
        pc, autres = b.module_entree_groupe(g)
        module, code, _ = modules[pc]
        multiple = len(b.groupes[g]) > 1
        if module == G["module_entree"]["libelle_remise_a_niveau"]:
            pourquoi = ("Le taux de prérequis est de " + p.pct(f"prerequis.{pc}")
                        + ", sous le seuil de "
                        + p.ref_pct("regles_bilan.agregats.prerequis.seuil_remise_a_niveau")
                        + " qui commande cette entrée quel que soit le score global.")
        elif code:
            pourquoi = ("C'est la première compétence classée "
                        + p.niveau_competence(pc, code) + " dans l'ordre des chapitres.")
        else:
            pourquoi = ("Aucune compétence n'est sous le seuil de consolidation : le "
                        "travail porte directement sur le format de l'épreuve.")
        titre = p.groupe(g) if multiple else p.perimetre(pc)
        ligne = (f"**{titre} — module d'entrée : {module_lisible(module)}"
                 + (f", mesuré par « {p.perimetre(pc)} »" if multiple else "")
                 + f".** {pourquoi}")
        for autre in autres:
            m2, _, _ = modules[autre]
            ligne += (" Second objectif de la même enveloppe : " + module_lisible(m2)
                      + f", mesuré par « {p.perimetre(autre)} ».")
        _, niveau, pc_rythme = b.rythme_groupe(g)
        ligne += (" Rythme : " + p.h(f"rythme.{g}") + " par semaine — le rythme suit le "
                  "niveau le plus bas de la matière, ici " + p.libelle_niveau(niveau)
                  + (", pour ses deux mesures" if multiple else ""))
        porteuse = b.competence_du_rythme(pc_rythme)
        module_rythme = b.module_entree(pc_rythme)[1]
        if porteuse and porteuse != module_rythme:
            ligne += (", porté par « " + p.competence(pc_rythme, porteuse) + " »"
                      + (f" en « {p.perimetre(pc_rythme)} »"
                         if multiple and pc_rythme != pc else "")
                      + " — c'est cette compétence, et non le module d'entrée, qui commande "
                        "l'enveloppe")
        ligne += "."
        objectifs = []
        for membre in b.groupes[g]:
            comps, _ = b.evaluation_intermediaire(membre)
            noms = " · ".join(p.competence(membre, c) for c in comps if (membre, c) in b.res)
            if noms:
                objectifs.append((membre, noms))
        if len(objectifs) == 1:
            ligne += (" Objectif de l'évaluation à " + p.ref(semaines) + " semaines : "
                      + objectifs[0][1] + ".")
        elif objectifs:
            ligne += (" Objectifs de l'évaluation à " + p.ref(semaines) + " semaines : "
                      + " ; ".join(f"« {p.perimetre(m)} » {n}" for m, n in objectifs) + ".")
        p += [ligne, ""]
    go = b.decision_grand_oral()
    if go:
        instr = G["grand_oral"]["instrument"]
        cas = ("au_dessus" if go["libelle"] == G["grand_oral"]["au_dessus"]["libelle"]
               else "en_dessous")
        p += [f"**Grand oral.** {p.nb(f'grille.{instr}.obtenu')} points sur "
              f"{p.nb(f'grille.{instr}.max')} à la grille d'entretien, soit "
              f"{p.pct(f'grille.{instr}.part')} : "
              + p.ref_texte(f"regles_bilan.grand_oral.{cas}.texte")
              + ". Cette décision n'ajoute aucune heure au plan.", ""]
    p += ["**Première évaluation intermédiaire : à " + p.ref(semaines) + " semaines**, sur "
          "les compétences nommées ci-dessus, avec les mêmes codes d'items qu'aujourd'hui "
          "pour que la comparaison soit possible.", ""]

    # ── 6 · Méthode et organisation
    p += ["---", "", f"## {p.structure(6)}. Méthode et organisation", "",
          dit("Le questionnaire de méthode situe votre manière de travailler sur quatre "
              "dimensions. Pour chacune, l'outillage proposé est celui que le niveau "
              "constaté appelle.",
              "Le questionnaire de méthode situe la manière de travailler de votre enfant "
              "sur quatre dimensions. Pour chacune, l'outillage proposé est celui que le "
              "niveau constaté appelle."), ""]
    prof = b.profils_met()
    for i, dim in enumerate(b.met_ref["dimensions"]):
        j = prof[dim["code"]]["rang"] - 1
        p += ["**" + p.ref_texte(f"dimensions_met.dimensions.{i}.libelle") + ".** "
              + p.ref_texte(f"dimensions_met.dimensions.{i}.niveaux.{j}.libelle")
              + ". Outillage : "
              + p.ref_texte(f"dimensions_met.dimensions.{i}.niveaux.{j}.outillage"), ""]

    # ── 7 · Formule recommandée
    p += ["---", "", f"## {p.structure(7)}. Formule recommandée", "",
          "**Volume horaire hebdomadaire recommandé : " + p.h("rythme.total")
          + "**, réparti ainsi.", "",
          "| Matière de travail | Heures par semaine |", "|---|---|"]
    for g in ordre:
        titre = p.groupe(g) if len(b.groupes[g]) > 1 else p.perimetre(b.groupes[g][0])
        p += [f"| {titre} | {p.h(f'rythme.{g}')} |"]
    p += [""]
    al = G["alerte_charge"]
    vig = al["vigilance_charge_elevee"]
    somme = sum(b.rythme_groupe(g)[0] for g in b.groupes)
    # Deux indicateurs, deux effets (Q-27, EC-18). Le Cahier commande le séquencement au
    # seul dépassement strict de son seuil ; la vigilance de la direction se contente de
    # nommer une charge élevée, et n'entraîne rien.
    ind = indicateurs_de_charge(somme, r["profil"], G)
    sequencer, vigilance = ind["sequencement"], ind["vigilance"]
    dispo = r["heures_disponibles"]
    declare = dit("les " + p.qp("reponses.heures_disponibles") + f" h que {sujet} avez "
                  "déclarées",
                  "les " + p.qp("reponses.heures_disponibles") + f" h déclarées par {sujet}")
    if somme > dispo:
        p += [f"**Le volume recommandé dépasse {declare}.** Le plan en demande "
              + p.h("rythme.total") + ", soit " + p.h("rythme.depassement")
              + " de plus. Ces heures ne sont pas retirées du plan : la répartition "
                "ci-dessus est celle que les résultats appellent. "
              + sequencement(b, p, ordre)
              + dit(" Le point sera repris avec vous à la première séance.",
                    " Le point sera repris avec la famille à la première séance."), ""]
    elif sequencer:
        p += ["**Le volume recommandé dépasse le seuil de "
              + p.ref("regles_bilan.alerte_charge.seuil_heures")
              + f" h par semaine** sans dépasser {declare}. " + sequencement(b, p, ordre),
              ""]
    elif vigilance:
        p += [p.ref_texte("regles_bilan.alerte_charge.vigilance_charge_elevee.phrase_bilan")
              + " : il atteint " + p.h("rythme.total") + ", pour un seuil de vigilance de "
              + p.ref("regles_bilan.alerte_charge.vigilance_charge_elevee.seuil_heures")
              + f" h, et il tient dans {declare}. "
              + p.ref_texte("regles_bilan.alerte_charge.vigilance_charge_elevee."
                            "n_impose_pas"), ""]
    else:
        p += [f"Le volume recommandé tient dans {declare}.", ""]
    p += [f"Formule Nexus correspondante : {RESERVE_FORMULE}", "",
          "*" + p.ref_texte("regles_bilan.formule_recommandee.source_prix") + "*", ""]

    return p.rendu(), p


def rendre(b: Bilan, registre: str = "candidat") -> tuple[str, list]:
    """Les sept sections du § 8.1. Rend le document et le résultat des contrôles.

    Le corps est composé d'abord, les contrôles passent ensuite sur ce corps. S'ils
    échouent, le corps n'est pas diffusé : le document rendu est le relevé des contrôles.
    """
    R = REGISTRES[registre]
    corps, p = composer(b, registre)
    verifs = controles(b, corps, p, mode_de(b))
    if not diffusable(verifs):
        lignes = [f"# {R['titre']} — en attente", "",
                  BANDEAU_MAQUETTE if mode_de(b) == "maquette" else "",
                  f"- Candidat : `{b.qp['candidate_ref']}`", "",
                  "> **Ce bilan n'est pas diffusable.** Un contrôle de la chaîne du § 6.3 "
                  "a échoué : le document n'est pas produit tant que la saisie n'est pas "
                  "corrigée. Aucun contrôle n'est contourné.", "",
                  "| Contrôle | Résultat | Constat |", "|---|---|---|"]
        for nom, etat, constat in verifs:
            marque = ("sans objet" if etat is None
                      else "réussi" if etat else "**échoué**")
            lignes.append(f"| {nom} | {marque} | {constat} |")
        return "\n".join(lignes) + "\n", verifs

    p += ["---", "", "*Contrôles de diffusion du § " + p.renvoi("6.3") + " : "
          + " · ".join(f"{nom} " + ("sans objet" if etat is None else "réussi")
                       for nom, etat, _ in verifs)
          + ".*"
          + ("" if mode_de(b) == "production" else
             " *Rendu de maquette : ces contrôles montrent que la chaîne fonctionne, ils "
             "ne rendent pas ce document diffusable.*"), ""]
    return p.rendu(), verifs


def main(dossier: Path = None, prefixe: str = "bilan") -> int:
    dossier = Path(dossier) if dossier else RACINE / "instruments" / "_MAQUETTE"
    codes = 0
    for chemin in sorted(dossier.glob("qp*.json")):
        b = Bilan(chemin, dossier=dossier).calculer()
        for registre in registres_a_produire(b):
            texte, verifs = rendre(b, registre)
            suffixe = "" if registre == "candidat" else f"_{registre}"
            profil = b.qp["reponses"]["profil"]
            nom = f"{prefixe}_{profil}_{b.qp['candidate_ref']}{suffixe}.md"
            (dossier / nom).write_text(texte, encoding="utf-8", newline="\n")
            if not diffusable(verifs):
                etat = "EN ATTENTE"
            elif mode_de(b) == "maquette":
                etat = "maquette — non diffusable"
            else:
                etat = "diffusable"
            print(f"  {(dossier / nom).relative_to(RACINE)} — {etat}")
            codes += 0 if diffusable(verifs) else 1
    return codes


if __name__ == "__main__":
    cible = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
    sys.exit(main(cible))
