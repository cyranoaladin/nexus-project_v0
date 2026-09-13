"""Solution de référence des deux tâches sur machine — matériel de correction.

Le candidat rend `rendu.py` ; ce fichier-ci ne lui est jamais remis. Il existe pour que le
harnais de correction soit **éprouvé** : sans lui, les tests des tâches sur machine ne
s'exécutaient jamais dans le dépôt — ils étaient tous ignorés faute de fichier candidat —
et rien ne prouvait qu'ils sachent départager une bonne réponse d'une mauvaise.

`tests/test_nsi_harnais.py` exécute le harnais contre ce fichier, puis contre une réponse
volontairement fausse, et vérifie que le barème `bareme_tests_machine` en tire les notes
attendues.
"""


def compte_pairs(L):
    """Renvoie le nombre d'entiers pairs de L, en un seul parcours."""
    n = 0
    for x in L:
        if x % 2 == 0:
            n += 1
    return n


def recherche(L, v):
    """Renvoie l'indice d'une occurrence de v dans la liste triée L, ou -1."""
    bas, haut = 0, len(L) - 1
    while bas <= haut:
        milieu = (bas + haut) // 2
        x = L[milieu]
        if x == v:
            return milieu
        if x < v:
            bas = milieu + 1
        else:
            haut = milieu - 1
    return -1
