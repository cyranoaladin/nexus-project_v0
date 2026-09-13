"""Tâche NSI-1-PROG-01 — compte_pairs(L).

Dix cas, dont quatre cas limites. Le score du critère TESTS est calculé depuis la
proportion de tests passés, selon conventions.bareme_tests_machine du référentiel.
Un cas mesure que la liste n'est parcourue qu'une fois : recompter en repassant sur la
liste donnerait le bon résultat pour un coût inutilement doublé.
"""
import pytest


class ListeComptee(list):
    """Liste qui compte les éléments lus lors d'une itération."""

    def __init__(self, valeurs):
        super().__init__(valeurs)
        self.lus = 0

    def __iter__(self):
        for x in super().__iter__():
            self.lus += 1
            yield x

    def __getitem__(self, i):
        self.lus += 1
        return super().__getitem__(i)


def test_signature_presente(rendu):
    assert hasattr(rendu, "compte_pairs"), "la fonction compte_pairs est absente"


def test_cas_simple(rendu):
    assert rendu.compte_pairs([1, 2, 3, 4]) == 2


def test_tous_pairs(rendu):
    assert rendu.compte_pairs([2, 4, 6]) == 3


def test_aucun_pair(rendu):
    assert rendu.compte_pairs([1, 3, 5]) == 0


def test_zero_est_pair(rendu):
    assert rendu.compte_pairs([0, 1]) == 1


def test_negatifs(rendu):
    assert rendu.compte_pairs([-2, -3, -4]) == 2


@pytest.mark.limite
def test_liste_vide(rendu):
    assert rendu.compte_pairs([]) == 0


@pytest.mark.limite
def test_liste_non_modifiee(rendu):
    L = [1, 2, 3]
    rendu.compte_pairs(L)
    assert L == [1, 2, 3], "la liste passée en paramètre a été modifiée"


@pytest.mark.limite
def test_renvoie_et_n_affiche_pas(rendu, capsys):
    resultat = rendu.compte_pairs([2, 4])
    sortie = capsys.readouterr().out
    assert resultat == 2, "la fonction doit renvoyer la valeur, non l'afficher"
    assert sortie == "", "la fonction ne doit rien afficher"


@pytest.mark.limite
def test_un_seul_parcours(rendu):
    """Sur 500 éléments, un parcours unique lit au plus 500 valeurs."""
    L = ListeComptee(range(500))
    assert rendu.compte_pairs(L) == 250
    assert L.lus <= 500, (
        f"{L.lus} lectures pour 500 éléments : la liste est parcourue plus d'une fois")
