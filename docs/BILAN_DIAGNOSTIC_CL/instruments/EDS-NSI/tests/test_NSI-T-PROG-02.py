"""Tâche NSI-T-PROG-02 — recherche(L, v) par dichotomie.

Onze cas, dont quatre cas limites. Le recours effectif à la dichotomie est mesuré par le
nombre d'accès à la liste. Le seuil est dérivé, non fixé : une dichotomie sur 1 024
éléments fait au plus 10 tours, et une écriture courante compare deux fois par tour
— « si L[m] vaut v » puis « si L[m] est plus petit » — soit 20 accès. Le seuil retenu de
24 laisse une marge de deux tours sans jamais laisser passer une recherche séquentielle,
qui en demande plusieurs centaines. Sanctionner l'écriture à deux comparaisons reviendrait
à mesurer un style plutôt qu'un algorithme.

Le critère SPEC garde ce que la machine ne voit pas : la lisibilité de l'invariant et le
traitement des bornes.
"""
import math
import pytest


class ListeComptee(list):
    """Liste qui compte les accès par indice, pour mesurer le coût de l'algorithme."""

    def __init__(self, valeurs):
        super().__init__(valeurs)
        self.acces = 0

    def __getitem__(self, i):
        self.acces += 1
        return super().__getitem__(i)


def test_signature_presente(rendu):
    assert hasattr(rendu, "recherche"), "la fonction recherche est absente"


def test_valeur_au_milieu(rendu):
    assert rendu.recherche([1, 3, 5, 7, 9], 5) == 2


def test_valeur_absente(rendu):
    assert rendu.recherche([1, 3, 5, 7, 9], 4) == -1


def test_valeur_unique(rendu):
    assert rendu.recherche([42], 42) == 0


def test_grande_liste(rendu):
    L = list(range(0, 200, 2))
    assert rendu.recherche(L, 150) == 75


def test_indice_coherent(rendu):
    L = [2, 4, 6, 8]
    i = rendu.recherche(L, 8)
    assert i != -1 and L[i] == 8


@pytest.mark.limite
def test_liste_vide(rendu):
    assert rendu.recherche([], 1) == -1


@pytest.mark.limite
def test_premiere_borne(rendu):
    assert rendu.recherche([1, 3, 5, 7], 1) == 0


@pytest.mark.limite
def test_derniere_borne(rendu):
    assert rendu.recherche([1, 3, 5, 7], 7) == 3


@pytest.mark.limite
def test_liste_non_modifiee(rendu):
    L = [1, 3, 5]
    rendu.recherche(L, 3)
    assert L == [1, 3, 5], "la liste passée en paramètre a été modifiée"


def seuil_acces(n: int) -> int:
    """Deux accès par tour, plus deux tours de marge."""
    return 2 * math.ceil(math.log2(n)) + 4


@pytest.mark.limite
def test_cout_dichotomique(rendu):
    """Sur 1 024 éléments, le nombre d'accès doit rester logarithmique."""
    L = ListeComptee(range(0, 2048, 2))
    assert len(L) == 1024
    i = rendu.recherche(L, 1000)
    assert i != -1 and L[i] == 1000
    seuil = seuil_acces(1024)
    assert L.acces <= seuil, (
        f"{L.acces} accès à la liste pour 1024 éléments, seuil {seuil} : la recherche "
        f"n'est pas dichotomique (une séquentielle en demande plusieurs centaines)")


@pytest.mark.limite
def test_cout_dichotomique_valeur_absente(rendu):
    """Le coût doit rester logarithmique aussi quand la valeur est absente."""
    L = ListeComptee(range(0, 2048, 2))
    assert rendu.recherche(L, 1001) == -1
    seuil = seuil_acces(1024)
    assert L.acces <= seuil, (
        f"{L.acces} accès pour une valeur absente, seuil {seuil} : recherche non dichotomique")
