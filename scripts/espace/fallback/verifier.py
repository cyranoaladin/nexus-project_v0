#!/usr/bin/env python3
"""Vérifie un fichier .py d'élève avec le MÊME harnais que la plateforme (runner.py), sous CPython.

Usage :   python3 verifier.py etape_3_pile.py [identifiant_etape]

L'identifiant d'étape se déduit du nom « etape_<n>_<id>.py » ; sinon, passez-le en 2e argument.
Code de sortie : 0 si tous les tests sont réussis, 1 sinon (erreur de programme ou test à revoir), 2 si usage incorrect.
"""
import importlib.util
import os
import re
import sys


def charger_runner():
    chemin = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runner.py')
    spec = importlib.util.spec_from_file_location('runner_nexus', chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main(argv):
    if len(argv) < 2 or len(argv) > 3:
        print(__doc__)
        return 2
    fichier = argv[1]
    etape = argv[2] if len(argv) == 3 else None
    if etape is None:
        trouve = re.match(r'^etape_\d+_(.+)\.py$', os.path.basename(fichier))
        if not trouve:
            print("Impossible de deviner l'étape : passez son identifiant en 2e argument (ex. pile).")
            return 2
        etape = trouve.group(1)
    try:
        with open(fichier, encoding='utf-8') as f:
            code = f.read()
    except OSError as exc:
        print(f'Fichier illisible : {exc}')
        return 2

    resultat = charger_runner().run_submission(code, etape, 'test')
    print(f'Étape « {etape} » — {fichier}')
    print('-' * 60)
    if resultat.get('error'):
        print(f"Erreur : {resultat['error']}")
    if resultat.get('output'):
        print('Affichage du programme :')
        print(resultat['output'].rstrip())
    tests = resultat.get('tests', [])
    for t in tests:
        if t['pass']:
            print(f"  [OK]       Réussi — {t['label']}")
        else:
            suite = f" : {t['message']}" if t.get('message') else ''
            print(f"  [A REVOIR] À revoir — {t['label']}{suite}")
    reussis = sum(1 for t in tests if t['pass'])
    print('-' * 60)
    if tests:
        print(f'{reussis} test(s) réussi(s) sur {len(tests)}.')
    elif not resultat.get('error'):
        print('Programme exécuté, aucun test automatique pour cette étape.')
    ok = not resultat.get('error') and reussis == len(tests)
    print('Tout est réussi.' if ok else "Il reste des points à revoir : relisez les messages ci-dessus.")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
