"""Codes de départ et solutions de référence du parcours « Récursivité et programmation récursive » (source unique).

Utilisé par build_content.py (content.json + corrigé) ; les tests en ré-exécutent la sortie sous CPython.
Les solutions NE sont PAS copiées dans content.json (côté élève) : seuls les codes de départ le sont.
"""

# ─── Étape « decouverte » : un programme volontairement défectueux à exécuter puis à réparer ──

DECOUVERTE_STARTER = '''# Ce programme est volontairement défectueux.
# 1) Exécute-le et lis le message. 2) Répare-le : ajoute un cas de base et fais progresser l’appel récursif.
def compte_a_rebours(n):
    print(n)
    compte_a_rebours(n)


compte_a_rebours(3)
'''

DECOUVERTE_SOLUTION = '''def compte_a_rebours(n):
    if n < 0:
        return
    print(n)
    compte_a_rebours(n - 1)


compte_a_rebours(3)
'''

# ─── Étape « pile-appels » : écrire le suivi des appels et des retours ─────────

PILE_APPELS_STARTER = '''def somme_trace(n, profondeur=0):
    marge = "  " * profondeur
    print(marge + "APPEL somme(" + str(n) + ")")
    if n == 0:
        resultat = 0
    else:
        # À compléter : l’appel récursif sur n - 1, avec une profondeur augmentée de 1.
        resultat = None
    print(marge + "RETOUR " + str(resultat))
    return resultat


somme_trace(3)
'''

PILE_APPELS_SOLUTION = '''def somme_trace(n, profondeur=0):
    marge = "  " * profondeur
    print(marge + "APPEL somme(" + str(n) + ")")
    if n == 0:
        resultat = 0
    else:
        resultat = n + somme_trace(n - 1, profondeur + 1)
    print(marge + "RETOUR " + str(resultat))
    return resultat


somme_trace(3)
'''

# ─── Étape « ecrire » : somme, factorielle, puissance ──────────────────────────

ECRIRE_STARTER = '''def somme(n):
    # Somme des entiers de 1 à n (somme(0) vaut 0).
    # D’abord : quel est le cas de base ? Comment ramener somme(n) à un problème plus petit ?
    pass


def factorielle(n):
    # n! = n × (n - 1) × … × 1, et par convention 0! = 1.
    pass


def puissance(a, n):
    # a puissance n, avec n >= 0. Rappel : a puissance 0 vaut 1.
    pass


print(somme(4))
print(factorielle(5))
print(puissance(2, 4))
'''

ECRIRE_SOLUTION = '''def somme(n):
    if n == 0:
        return 0
    return n + somme(n - 1)


def factorielle(n):
    if n == 0:
        return 1
    return n * factorielle(n - 1)


def puissance(a, n):
    if n == 0:
        return 1
    return a * puissance(a, n - 1)


print(somme(4))
print(factorielle(5))
print(puissance(2, 4))
'''

ECRIRE_ALTERNATIVE = '''def somme(n):
    if n <= 0:
        return 0
    return somme(n - 1) + n


def factorielle(n):
    if n < 2:
        return 1
    return n * factorielle(n - 1)


def puissance(a, n):
    # Variante : on divise l’exposant par deux (moins d’appels).
    if n == 0:
        return 1
    moitie = puissance(a, n // 2)
    if n % 2 == 0:
        return moitie * moitie
    return a * moitie * moitie
'''

# ─── Étape « structures » : chaînes et listes ──────────────────────────────────

STRUCTURES_STARTER = '''def longueur(texte):
    # Nombre de caractères de texte, SANS utiliser len.
    # Cas de base : la chaîne vide. Sinon : 1 + la longueur de « texte sans son premier caractère ».
    pass


def est_palindrome(texte):
    # True si texte se lit pareil dans les deux sens ("radar", "kayak"), False sinon.
    pass


def somme_liste(tab):
    # Somme des éléments de la liste tab (0 pour la liste vide). Ne modifie pas tab.
    pass


print(longueur("NSI"))
print(est_palindrome("radar"))
print(somme_liste([4, 7, 2]))
'''

STRUCTURES_SOLUTION = '''def longueur(texte):
    if texte == "":
        return 0
    return 1 + longueur(texte[1:])


def est_palindrome(texte):
    if len(texte) <= 1:
        return True
    if texte[0] != texte[-1]:
        return False
    return est_palindrome(texte[1:-1])


def somme_liste(tab):
    if tab == []:
        return 0
    return tab[0] + somme_liste(tab[1:])


print(longueur("NSI"))
print(est_palindrome("radar"))
print(somme_liste([4, 7, 2]))
'''

STRUCTURES_ALTERNATIVE = '''def longueur(texte):
    if texte == "":
        return 0
    return longueur(texte[:-1]) + 1


def est_palindrome(texte, i=0):
    # Variante avec un indice : aucune copie de chaîne.
    j = len(texte) - 1 - i
    if i >= j:
        return True
    return texte[i] == texte[j] and est_palindrome(texte, i + 1)


def somme_liste(tab, i=0):
    # Variante avec un indice : aucune copie de liste.
    if i == len(tab):
        return 0
    return tab[i] + somme_liste(tab, i + 1)
'''

# ─── Étape « iteratif » : même fonction, deux écritures ───────────────────────

ITERATIF_STARTER = '''def puissance_recursive(a, n):
    if n == 0:
        return 1
    return a * puissance_recursive(a, n - 1)


def puissance_iterative(a, n):
    # Même résultat, avec une boucle et SANS appel récursif.
    pass


print(puissance_recursive(2, 10))
print(puissance_iterative(2, 10))
'''

ITERATIF_SOLUTION = '''def puissance_recursive(a, n):
    if n == 0:
        return 1
    return a * puissance_recursive(a, n - 1)


def puissance_iterative(a, n):
    resultat = 1
    for _ in range(n):
        resultat = resultat * a
    return resultat


print(puissance_recursive(2, 10))
print(puissance_iterative(2, 10))
'''

# ─── Étape « mission » : structures imbriquées ────────────────────────────────

MISSION_STARTER = '''# Partie A — échauffement : compter les nombres d’une liste imbriquée.
def compter_elements(x):
    # x est soit un nombre, soit une liste (qui peut contenir des nombres ET d’autres listes).
    # [1, [2, 3], [4, [5, 6]]] contient 6 nombres.
    pass


# Partie B — le dossier imaginaire : un fichier est une chaîne, un dossier est une liste.
dossier = [
    "cours.pdf",
    [
        "tp.py",
        "correction.pdf",
    ],
    "notes.txt",
]


def compter_fichiers(element):
    # element est soit un fichier (une chaîne), soit un dossier (une liste d’éléments).
    pass


# Partie C — en autonomie : inverser une chaîne, récursivement.
def inverse(texte):
    # inverse("NSI") doit renvoyer "ISN".
    pass


print(compter_elements([1, [2, 3], [4, [5, 6]]]))
print(compter_fichiers(dossier))
print(inverse("NSI"))
'''

MISSION_SOLUTION = '''def compter_elements(x):
    if not isinstance(x, list):
        return 1
    total = 0
    for y in x:
        total = total + compter_elements(y)
    return total


dossier = [
    "cours.pdf",
    [
        "tp.py",
        "correction.pdf",
    ],
    "notes.txt",
]


def compter_fichiers(element):
    if not isinstance(element, list):
        return 1
    total = 0
    for sous_element in element:
        total = total + compter_fichiers(sous_element)
    return total


def inverse(texte):
    if texte == "":
        return ""
    return inverse(texte[1:]) + texte[0]


print(compter_elements([1, [2, 3], [4, [5, 6]]]))
print(compter_fichiers(dossier))
print(inverse("NSI"))
'''

MISSION_ALTERNATIVE = '''def compter_elements(x):
    if isinstance(x, list):
        return sum(compter_elements(y) for y in x)
    return 1


def compter_fichiers(element):
    if isinstance(element, str):
        return 1
    if element == []:
        return 0
    return compter_fichiers(element[0]) + compter_fichiers(element[1:])


def inverse(texte):
    if len(texte) <= 1:
        return texte
    return texte[-1] + inverse(texte[:-1])
'''

# ─── Bonus : maximum et dichotomie ────────────────────────────────────────────

BONUS_STARTER = '''def maximum(tab):
    # Plus grand élément d’une liste NON vide. Cas de base : un seul élément.
    pass


def indice_dicho(tab, x, debut, fin):
    # tab est triée par ordre croissant. On cherche x entre les indices debut et fin (inclus).
    # Renvoie l’indice de x, ou -1 s’il n’y est pas. À chaque appel, on écarte environ la moitié des cases.
    pass


print(maximum([4, 9, 2]))
print(indice_dicho([2, 5, 8, 12, 16, 23], 12, 0, 5))
'''

BONUS_SOLUTION = '''def maximum(tab):
    if len(tab) == 1:
        return tab[0]
    reste = maximum(tab[1:])
    if tab[0] > reste:
        return tab[0]
    return reste


def indice_dicho(tab, x, debut, fin):
    if debut > fin:
        return -1
    milieu = (debut + fin) // 2
    if tab[milieu] == x:
        return milieu
    if tab[milieu] < x:
        return indice_dicho(tab, x, milieu + 1, fin)
    return indice_dicho(tab, x, debut, milieu - 1)


print(maximum([4, 9, 2]))
print(indice_dicho([2, 5, 8, 12, 16, 23], 12, 0, 5))
'''

STARTERS = {
    'decouverte': DECOUVERTE_STARTER,
    'pile-appels': PILE_APPELS_STARTER,
    'ecrire': ECRIRE_STARTER,
    'structures': STRUCTURES_STARTER,
    'iteratif': ITERATIF_STARTER,
    'mission': MISSION_STARTER,
    'bonus': BONUS_STARTER,
}

SOLUTIONS = {
    'decouverte': DECOUVERTE_SOLUTION,
    'pile-appels': PILE_APPELS_SOLUTION,
    'ecrire': ECRIRE_SOLUTION,
    'structures': STRUCTURES_SOLUTION,
    'iteratif': ITERATIF_SOLUTION,
    'mission': MISSION_SOLUTION,
    'bonus': BONUS_SOLUTION,
}

ALTERNATIVES = {
    'ecrire': ECRIRE_ALTERNATIVE,
    'structures': STRUCTURES_ALTERNATIVE,
    'mission': MISSION_ALTERNATIVE,
}
