"""Codes de départ et solutions de référence du TP POO 2 (source unique).

Utilisé par build_content.py (content.json + corrigé) ; les tests en ré-exécutent la sortie
sous CPython. Les solutions NE sont PAS copiées dans content.json (côté élève) : seuls les
codes de départ le sont.
"""

LISTE_DEMO = '''
L = Liste()
L.ajouter("Ada")
L.ajouter("Alan")
print(L.longueur())
print(L.element(1))
'''

LISTE_STARTER = '''class Liste:
    def __init__(self):
        # À compléter : un attribut _elements qui mémorise les éléments.
        pass

    def est_vide(self):
        # Renvoyer True si la liste ne contient aucun élément.
        pass

    def longueur(self):
        # Renvoyer le nombre d'éléments.
        pass

    def ajouter(self, valeur):
        # Ajouter valeur à la fin. Ne rien renvoyer.
        pass

    def element(self, indice):
        # Renvoyer l'élément d'indice donné (le premier a l'indice 0).
        # Indice invalide (négatif ou trop grand) : lever IndexError("indice invalide").
        pass
''' + LISTE_DEMO

LISTE_SOLUTION = '''class Liste:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return len(self._elements) == 0

    def longueur(self):
        return len(self._elements)

    def ajouter(self, valeur):
        self._elements.append(valeur)

    def element(self, indice):
        if indice < 0 or indice >= len(self._elements):
            raise IndexError("indice invalide")
        return self._elements[indice]
''' + LISTE_DEMO

PILE_DEMO = '''
p = Pile()
p.empiler("A")
p.empiler("B")
p.empiler("C")
print(p.depiler())
print(p.sommet())
print(p.taille())
'''

PILE_STARTER = '''class Pile:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        # Renvoyer True si la pile ne contient rien.
        pass

    def taille(self):
        # Renvoyer le nombre d'éléments.
        pass

    def empiler(self, valeur):
        # Poser valeur au sommet. Ne rien renvoyer.
        pass

    def sommet(self):
        # Renvoyer l'élément du sommet SANS le retirer.
        # Pile vide : lever IndexError("pile vide").
        pass

    def depiler(self):
        # Retirer l'élément du sommet ET le renvoyer.
        # Pile vide : lever IndexError("pile vide").
        pass
''' + PILE_DEMO

PILE_SOLUTION = '''class Pile:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return len(self._elements) == 0

    def taille(self):
        return len(self._elements)

    def empiler(self, valeur):
        self._elements.append(valeur)

    def sommet(self):
        if self.est_vide():
            raise IndexError("pile vide")
        return self._elements[-1]

    def depiler(self):
        if self.est_vide():
            raise IndexError("pile vide")
        return self._elements.pop()
''' + PILE_DEMO

# Variante valide : le sommet est au DÉBUT de la list (représentation différente, même interface).
PILE_ALTERNATIVE = '''class Pile:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return self._elements == []

    def taille(self):
        return len(self._elements)

    def empiler(self, valeur):
        self._elements.insert(0, valeur)

    def sommet(self):
        if not self._elements:
            raise IndexError("pile vide")
        return self._elements[0]

    def depiler(self):
        if not self._elements:
            raise IndexError("pile vide")
        return self._elements.pop(0)
'''

FILE_DEMO = '''
f = File()
f.enfiler("Adam")
f.enfiler("Alexandre")
f.enfiler("Zaineb")
print(f.defiler())
print(f.premier())
print(f.taille())
'''

FILE_STARTER = '''class File:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        # Renvoyer True si la file ne contient rien.
        pass

    def taille(self):
        # Renvoyer le nombre d'éléments.
        pass

    def enfiler(self, valeur):
        # Placer valeur à l'arrière de la file. Ne rien renvoyer.
        pass

    def premier(self):
        # Renvoyer le prochain élément à sortir SANS le retirer.
        # File vide : lever IndexError("file vide").
        pass

    def defiler(self):
        # Retirer le prochain élément à sortir ET le renvoyer.
        # File vide : lever IndexError("file vide").
        pass
''' + FILE_DEMO

FILE_SOLUTION = '''class File:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return len(self._elements) == 0

    def taille(self):
        return len(self._elements)

    def enfiler(self, valeur):
        self._elements.append(valeur)

    def premier(self):
        if self.est_vide():
            raise IndexError("file vide")
        return self._elements[0]

    def defiler(self):
        if self.est_vide():
            raise IndexError("file vide")
        return self._elements.pop(0)
''' + FILE_DEMO

# Variante valide : l'arrière de la file est le DÉBUT de la list, le premier à sortir est le dernier.
FILE_ALTERNATIVE = '''class File:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return not self._elements

    def taille(self):
        return len(self._elements)

    def enfiler(self, valeur):
        self._elements.insert(0, valeur)

    def premier(self):
        if not self._elements:
            raise IndexError("file vide")
        return self._elements[-1]

    def defiler(self):
        if not self._elements:
            raise IndexError("file vide")
        return self._elements.pop()
'''

MISSION_LIBRAIRIE = '''# ── Fournies : les deux structures que tu viens de construire ──────────────
class File:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return len(self._elements) == 0

    def taille(self):
        return len(self._elements)

    def enfiler(self, valeur):
        self._elements.append(valeur)

    def premier(self):
        if self.est_vide():
            raise IndexError("file vide")
        return self._elements[0]

    def defiler(self):
        if self.est_vide():
            raise IndexError("file vide")
        return self._elements.pop(0)


class Pile:
    def __init__(self):
        self._elements = []

    def est_vide(self):
        return len(self._elements) == 0

    def taille(self):
        return len(self._elements)

    def empiler(self, valeur):
        self._elements.append(valeur)

    def sommet(self):
        if self.est_vide():
            raise IndexError("pile vide")
        return self._elements[-1]

    def depiler(self):
        if self.est_vide():
            raise IndexError("pile vide")
        return self._elements.pop()


'''

MISSION_DEMO = '''
centre = FileImpression()
centre.soumettre("DS_Maths.pdf")
centre.soumettre("TP_NSI.pdf")
centre.soumettre("Correction.pdf")
print(centre.prochain())
print(centre.imprimer())
print(centre.en_attente())

options = Reglages()
options.regler("copies", 3)
options.regler("couleur", "bleu")
options.annuler()
print(options.valeur("couleur"))
print(options.valeur("copies"))
'''

MISSION_STARTER = MISSION_LIBRAIRIE + '''# ── Partie A : le centre d'impression (une FILE de documents) ─────────────
class FileImpression:
    def __init__(self):
        # À compléter : contenir une File (composition), pas la recopier.
        pass

    def soumettre(self, document):
        # Ajouter le document à la file d'attente.
        pass

    def prochain(self):
        # Renvoyer le document qui sera imprimé en premier, sans le retirer.
        pass

    def imprimer(self):
        # Retirer et renvoyer le premier document. File vide : IndexError.
        pass

    def en_attente(self):
        # Nombre de documents en attente.
        pass

    def est_vide(self):
        # True si aucun document n'attend.
        pass


# ── Partie B : annuler un réglage (une PILE d'historique) ──────────────────
class Reglages:
    def __init__(self):
        self._valeurs = {"copies": 1, "couleur": "noir"}
        self._historique = Pile()

    def valeur(self, nom):
        return self._valeurs[nom]

    def regler(self, nom, valeur):
        # À compléter : mémoriser (nom, ancienne valeur) dans l'historique, PUIS modifier.
        pass

    def annuler(self):
        # À compléter : retrouver le dernier réglage et restaurer l'ancienne valeur.
        # Rien à annuler : IndexError (celui de la pile).
        pass
''' + MISSION_DEMO

MISSION_SOLUTION = MISSION_LIBRAIRIE + '''class FileImpression:
    def __init__(self):
        self._attente = File()

    def soumettre(self, document):
        self._attente.enfiler(document)

    def prochain(self):
        return self._attente.premier()

    def imprimer(self):
        return self._attente.defiler()

    def en_attente(self):
        return self._attente.taille()

    def est_vide(self):
        return self._attente.est_vide()


class Reglages:
    def __init__(self):
        self._valeurs = {"copies": 1, "couleur": "noir"}
        self._historique = Pile()

    def valeur(self, nom):
        return self._valeurs[nom]

    def regler(self, nom, valeur):
        self._historique.empiler((nom, self._valeurs[nom]))
        self._valeurs[nom] = valeur

    def annuler(self):
        nom, ancienne = self._historique.depiler()
        self._valeurs[nom] = ancienne
''' + MISSION_DEMO

BONUS_STARTER = '''from collections import deque


class FileDeque:
    def __init__(self):
        self._elements = deque()

    def est_vide(self):
        # Comme pour File.
        pass

    def taille(self):
        pass

    def enfiler(self, valeur):
        # deque : append ajoute à droite.
        pass

    def premier(self):
        # File vide : IndexError("file vide").
        pass

    def defiler(self):
        # deque : popleft retire à gauche, sans décaler les autres éléments.
        # File vide : IndexError("file vide").
        pass


f = FileDeque()
f.enfiler("A")
f.enfiler("B")
print(f.defiler())
print(f.taille())
'''

BONUS_SOLUTION = '''from collections import deque


class FileDeque:
    def __init__(self):
        self._elements = deque()

    def est_vide(self):
        return len(self._elements) == 0

    def taille(self):
        return len(self._elements)

    def enfiler(self, valeur):
        self._elements.append(valeur)

    def premier(self):
        if self.est_vide():
            raise IndexError("file vide")
        return self._elements[0]

    def defiler(self):
        if self.est_vide():
            raise IndexError("file vide")
        return self._elements.popleft()


f = FileDeque()
f.enfiler("A")
f.enfiler("B")
print(f.defiler())
print(f.taille())
'''

STARTERS = {
    'liste': LISTE_STARTER,
    'pile': PILE_STARTER,
    'file': FILE_STARTER,
    'mission': MISSION_STARTER,
    'bonus': BONUS_STARTER,
}

SOLUTIONS = {
    'liste': LISTE_SOLUTION,
    'pile': PILE_SOLUTION,
    'file': FILE_SOLUTION,
    'mission': MISSION_SOLUTION,
    'bonus': BONUS_SOLUTION,
}

ALTERNATIVES = {
    'pile': PILE_ALTERNATIVE,
    'file': FILE_ALTERNATIVE,
}
