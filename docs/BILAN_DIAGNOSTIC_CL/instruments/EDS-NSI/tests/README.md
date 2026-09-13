# Tests des tâches sur machine — EDS-NSI

Le bloc C de NSI se traite sur l'ordinateur du centre, sans accès Internet (§ 7.8). Le candidat
complète `rendu.py` ; le fichier de tests correspondant lui est fourni et il peut l'exécuter
autant de fois qu'il le souhaite.

## Passation

1. Copier `rendu_modele.py` sous le nom `rendu.py` dans le répertoire de travail du candidat,
   avec le fichier de tests de la tâche assemblée.
2. Le candidat écrit sa fonction dans `rendu.py`.
3. À la fin de l'épreuve, le fichier `rendu.py` est conservé sous le code candidat.

## Correction

```
python3 -m pytest instruments/EDS-NSI/tests/test_<ITEM>.py -q
```

Le score du critère `TESTS` est **calculé** depuis la proportion de tests passés, selon le barème
`conventions.bareme_tests_machine` du référentiel — jamais saisi. La précondition est que
`rendu.py` s'importe sans exception ; sinon le critère vaut 0 quel que soit le reste.

Les deux critères qualitatifs, `LISIB` et `SPEC`, sont notés par un correcteur habilité : ce sont
les seuls de l'instrument à le requérir (§ 7.8).

Chaque fichier de tests comporte au moins six cas, dont au moins deux cas limites marqués
`@pytest.mark.limite`.
