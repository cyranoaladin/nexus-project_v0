"""Contrôles formatifs du parcours « Récursivité et programmation récursive ».
Aucune exécution de ce fichier côté serveur : le code de l'élève ne s'exécute que dans son navigateur (Pyodide).
Le moteur navigateur est interrompu par destruction de son Web Worker (boucle infinie, récursion exponentielle).
Le filtrage AST est une restriction pédagogique, PAS une sandbox de sécurité.

Les contrôles sont COMPORTEMENTAUX : ils appellent les fonctions de l'élève et comparent valeurs de retour et
affichages ; aucune recherche de texte dans le code. Pour savoir si une fonction « s'appelle elle-même »,
le harnais remplace SON NOM dans l'espace de noms de l'élève par un enveloppeur qui compte les appels :
un appel récursif repasse par ce nom, une boucle ou un appel unique à len/sum, non.

La profondeur de récursion est volontairement limitée (RECURSION_LIMIT) : une fonction sans cas de base
déclenche une RecursionError immédiate et lisible, au lieu de geler le navigateur.
"""
import ast
import builtins
import contextlib
import io
import sys
import traceback

MAX_CODE = 20000
MAX_OUTPUT = 6000
RECURSION_LIMIT = 200
ALLOWED_DUNDER = set()


class LimitedOutput(io.StringIO):
    def write(self, text):
        available = MAX_OUTPUT - self.tell()
        if available > 0:
            super().write(text[:available])
        return len(text)


def check_source(code, step=None):
    if not isinstance(code, str) or len(code) > MAX_CODE:
        raise ValueError('Le code doit contenir au plus 20 000 caractères.')
    tree = ast.parse(code, filename='mon_programme.py')
    if sum(1 for _ in ast.walk(tree)) > 5000:
        raise ValueError('Programme trop volumineux pour cet atelier.')
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise ValueError('Cet atelier n’utilise aucun import.')
        if isinstance(node, ast.Attribute) and node.attr.startswith('__'):
            raise ValueError('Cet atelier n’utilise pas d’attribut commençant par un double tiret bas.')
        if isinstance(node, (ast.AsyncFunctionDef, ast.Await)):
            raise ValueError('Cet atelier n’utilise pas de fonction asynchrone.')
        if isinstance(node, ast.Name) and node.id in {'eval', 'exec', 'compile', 'open', 'input', 'globals', 'locals', '__import__', 'vars', 'setattr', 'getattr', 'delattr'}:
            raise ValueError('Les fichiers, input et l’exécution dynamique ne sont pas utilisés ici. Renseigne directement tes données.')
    return tree


RECURSION_MESSAGE = (
    'RecursionError : profondeur maximale d’appels dépassée (limite de cet atelier : %d appels imbriqués). '
    'La fonction s’appelle sans jamais atteindre un cas de base : rien ne l’arrête, ou rien ne la fait progresser vers l’arrêt. '
    'Python s’interrompt de lui-même ; il n’exécute pas une infinité d’appels.' % RECURSION_LIMIT
)


def run_submission(code, step, mode='test'):
    out = LimitedOutput()
    allowed = ['__build_class__', 'object', 'print', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict',
               'set', 'tuple', 'min', 'max', 'sum', 'abs', 'enumerate', 'zip', 'sorted', 'reversed', 'isinstance',
               'type', 'all', 'any', 'repr', 'Exception', 'ValueError', 'TypeError', 'AssertionError', 'IndexError',
               'KeyError', 'RecursionError', 'StopIteration', 'NotImplementedError', 'ZeroDivisionError']

    def no_import(name, globals=None, locals=None, fromlist=(), level=0):
        raise ImportError('Import non autorisé dans cet atelier.')

    safe_builtins = {k: getattr(builtins, k) for k in allowed}
    safe_builtins['__import__'] = no_import
    ns = {'__builtins__': safe_builtins, '__name__': '__eleve__'}
    previous_limit = sys.getrecursionlimit()
    try:
        sys.setrecursionlimit(RECURSION_LIMIT)
        exec_error = None
        try:
            tree = check_source(code, step)
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                exec(compile(tree, 'mon_programme.py', 'exec'), ns, ns)
        except BaseException as exc:
            if isinstance(exc, SyntaxError):
                detail = f'{type(exc).__name__}, ligne {exc.lineno} : {exc.msg}'
            elif isinstance(exc, ValueError) and exc.__traceback__ is not None and not any(f.filename == 'mon_programme.py' for f in traceback.extract_tb(exc.__traceback__)):
                detail = f'{type(exc).__name__} : {exc}'
            else:
                frames = traceback.extract_tb(exc.__traceback__)
                line = next((f.lineno for f in reversed(frames) if f.filename == 'mon_programme.py'), None)
                where = f', ligne {line}' if line else ''
                if isinstance(exc, RecursionError):
                    detail = RECURSION_MESSAGE.replace('RecursionError :', f'RecursionError{where} :', 1)
                else:
                    detail = f'{type(exc).__name__}{where} : {exc}'
            executed = isinstance(exc, SyntaxError) is False and any(f.filename == 'mon_programme.py' for f in traceback.extract_tb(exc.__traceback__))
            if mode != 'test' or not executed:
                return {'ok': False, 'error': detail, 'output': out.getvalue(), 'tests': [], 'mode': mode}
            # Le code a commencé à s'exécuter (par exemple l'appel de démonstration final a échoué) : les définitions
            # déjà faites restent exploitables, les contrôles s'exécutent quand même pour guider l'élève.
            exec_error = detail
        if mode == 'test':
            return run_tests(ns, step, out, exec_error)
        return {'ok': True, 'error': None, 'output': out.getvalue(), 'tests': [], 'mode': mode}
    finally:
        sys.setrecursionlimit(previous_limit)


def run_tests(ns, step, out, exec_error=None):
    results = []
    originals = {}

    # ─── Outils de contrôle ─────────────────────────────────────────────────

    def verify(label, fn):
        try:
            with contextlib.redirect_stdout(LimitedOutput()), contextlib.redirect_stderr(LimitedOutput()):
                fn()
            results.append({'label': label, 'pass': True, 'message': 'Cas vérifié.'})
        except RecursionError:
            results.append({'label': label, 'pass': False,
                            'message': 'RecursionError : la fonction ne termine pas. Vérifie le cas de base ET que chaque appel récursif porte sur un problème plus petit.'})
        except TypeError as exc:
            if 'NoneType' in str(exc):
                message = ('Une valeur None est entrée dans un calcul (' + str(exc) + '). Un appel, souvent l’appel récursif, ne renvoie rien : '
                           'vérifie que chaque chemin de la fonction se termine par return.')
            else:
                message = ('Appel impossible : ' + str(exc)) + ' Vérifie le nom de la fonction et ses paramètres.'
            results.append({'label': label, 'pass': False, 'message': message[:700]})
        except BaseException as exc:
            results.append({'label': label, 'pass': False, 'message': str(exc)[:800] or type(exc).__name__})

    def expect(condition, message):
        if not condition:
            raise AssertionError(message)

    def need(name):
        f = originals.get(name) or ns.get(name)
        expect(callable(f), f'Définis une fonction nommée {name}.')
        originals.setdefault(name, f)
        return originals[name]

    def watch(name):
        """Remplace le nom `name` par un enveloppeur qui compte les appels (récursifs compris) ; renvoie les statistiques."""
        f = need(name)
        stats = {'calls': 0, 'depth': 0, 'max_depth': 0}

        def wrapper(*args, **kwargs):
            stats['calls'] += 1
            stats['depth'] += 1
            if stats['depth'] > stats['max_depth']:
                stats['max_depth'] = stats['depth']
            try:
                return f(*args, **kwargs)
            finally:
                stats['depth'] -= 1

        ns[name] = wrapper
        return stats

    def call(name, *args):
        need(name)
        return ns[name](*args)

    def returns(desc, value):
        expect(value is not None, f'{desc} renvoie None : utilise return pour RENVOYER la valeur (print l’affiche seulement, il ne la renvoie pas).')
        return value

    def captured(fn):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            result = fn()
        return buf.getvalue(), result

    def recursive(name, *args, minimum=2):
        stats = watch(name)
        call(name, *args)
        shown = name + '(' + ', '.join(repr(a) for a in args) + ')'
        expect(stats['calls'] >= minimum,
               f'{name} ne s’est pas appelée elle-même ({stats["calls"]} appel observé pour {shown}). '
               f'Ici la fonction doit être RÉCURSIVE : le cas général doit contenir un appel à {name}, sur un problème plus petit.')
        return stats

    def unchanged(desc, value, fn):
        copy = list(value)
        returns(desc, fn())
        expect(value == copy, f'{desc} a modifié la liste reçue. Une fonction récursive de ce parcours lit sa liste, elle ne la modifie pas.')

    # ─── decouverte ─────────────────────────────────────────────────────────

    def decouverte_valeurs():
        text, _ = captured(lambda: call('compte_a_rebours', 3))
        expect(text.split() == ['3', '2', '1', '0'], f'compte_a_rebours(3) doit afficher 3, 2, 1, 0 (un nombre par ligne) ; affiché : {text.split()[:8]}.')

    def decouverte_base():
        text, _ = captured(lambda: call('compte_a_rebours', -1))
        expect(text == '', 'Cas de base : pour n < 0 il n’y a plus rien à faire, la fonction doit s’arrêter sans rien afficher.')
        text, _ = captured(lambda: call('compte_a_rebours', 0))
        expect(text.split() == ['0'], 'compte_a_rebours(0) doit afficher seulement 0 : le cas de base n’est atteint qu’après.')

    def decouverte_terminaison():
        text, _ = captured(lambda: call('compte_a_rebours', 50))
        expect(text.split() == [str(k) for k in range(50, -1, -1)], 'compte_a_rebours(50) doit afficher 50, 49, …, 0 : chaque appel doit porter sur n - 1.')

    def decouverte_recursive():
        stats = watch('compte_a_rebours')
        captured(lambda: ns['compte_a_rebours'](3))
        expect(stats['calls'] == 5, f'compte_a_rebours(3) devrait produire 5 appels (n = 3, 2, 1, 0, puis -1 qui s’arrête) ; observé : {stats["calls"]}.')

    # ─── pile-appels ────────────────────────────────────────────────────────

    def pile_trace():
        text, value = captured(lambda: call('somme_trace', 3))
        expected = ['APPEL somme(3)', '  APPEL somme(2)', '    APPEL somme(1)', '      APPEL somme(0)', '      RETOUR 0', '    RETOUR 1', '  RETOUR 3', 'RETOUR 6']
        lines = text.split('\n')
        if lines and lines[-1] == '':
            lines = lines[:-1]
        for k, (got, want) in enumerate(zip(lines, expected)):
            expect(got == want, f'Ligne {k + 1} de l’affichage : attendu « {want} », obtenu « {got} ».')
        expect(len(lines) == len(expected), f'L’affichage de somme_trace(3) doit comporter {len(expected)} lignes (4 APPEL et 4 RETOUR) ; obtenu {len(lines)}.')

    def pile_valeur():
        _, value = captured(lambda: call('somme_trace', 4))
        expect(value == 10, f'somme_trace(4) doit renvoyer 10 (elle renvoie la même valeur que somme(4)) ; obtenu {value!r}.')
        _, value = captured(lambda: call('somme_trace', 0))
        expect(value == 0, f'somme_trace(0) doit renvoyer 0 ; obtenu {value!r}.')

    def pile_lifo():
        text, _ = captured(lambda: call('somme_trace', 3))
        events = [line.strip().split()[0] for line in text.split('\n') if line.strip()]
        expect(events == ['APPEL'] * 4 + ['RETOUR'] * 4, 'Tous les APPEL doivent précéder tous les RETOUR : on descend d’abord jusqu’au cas de base, puis on remonte.')

    def pile_profondeur():
        stats = watch('somme_trace')
        captured(lambda: ns['somme_trace'](5))
        expect(stats['max_depth'] == 6, f'Pour somme_trace(5), six appels sont empilés en même temps (n = 5, 4, 3, 2, 1, 0) ; profondeur observée : {stats["max_depth"]}.')

    # ─── ecrire ─────────────────────────────────────────────────────────────

    def somme_base():
        expect(returns('somme(0)', call('somme', 0)) == 0, 'Cas de base : somme(0) doit renvoyer 0.')

    def somme_valeurs():
        for n, want in ((1, 1), (3, 6), (5, 15), (10, 55)):
            got = returns(f'somme({n})', call('somme', n))
            expect(got == want, f'somme({n}) doit renvoyer {want} ; obtenu {got!r}.')

    def somme_recursive():
        recursive('somme', 4, minimum=5)

    def fact_base():
        got = returns('factorielle(0)', call('factorielle', 0))
        expect(got == 1, f'Convention : 0! = 1. factorielle(0) doit renvoyer 1 ; obtenu {got!r}.')
        expect(call('factorielle', 1) == 1, 'factorielle(1) doit renvoyer 1.')

    def fact_valeurs():
        for n, want in ((3, 6), (5, 120), (6, 720)):
            got = returns(f'factorielle({n})', call('factorielle', n))
            expect(got == want, f'factorielle({n}) doit renvoyer {want} ; obtenu {got!r}.')

    def fact_recursive():
        recursive('factorielle', 5, minimum=5)

    def puis_base():
        got = returns('puissance(7, 0)', call('puissance', 7, 0))
        expect(got == 1, f'Cas de base : a puissance 0 vaut 1, pour tout a. puissance(7, 0) doit renvoyer 1 ; obtenu {got!r}.')

    def puis_valeurs():
        for a, n, want in ((2, 1, 2), (2, 5, 32), (3, 3, 27), (10, 4, 10000)):
            got = returns(f'puissance({a}, {n})', call('puissance', a, n))
            expect(got == want, f'puissance({a}, {n}) doit renvoyer {want} ; obtenu {got!r}.')

    def puis_recursive():
        recursive('puissance', 2, 4, minimum=3)

    def ecrire_terminaison():
        expect(call('somme', 100) == 5050, 'somme(100) doit renvoyer 5050.')
        expect(call('factorielle', 20) == 2432902008176640000, 'factorielle(20) doit renvoyer 2432902008176640000.')
        expect(call('puissance', 2, 100) == 2 ** 100, 'puissance(2, 100) doit renvoyer 2 puissance 100.')

    # ─── structures ─────────────────────────────────────────────────────────

    def long_valeurs():
        expect(call('longueur', '') == 0, 'Cas de base : longueur("") doit renvoyer 0.')
        for t in ('a', 'NSI', 'récursivité'):
            got = returns(f'longueur({t!r})', call('longueur', t))
            expect(got == len(t), f'longueur({t!r}) doit renvoyer {len(t)} ; obtenu {got!r}.')

    def long_recursive():
        recursive('longueur', 'NSI', minimum=4)

    def pal_vrai():
        for t in ('', 'a', 'aa', 'radar', 'kayak', 'abba'):
            got = returns(f'est_palindrome({t!r})', call('est_palindrome', t))
            expect(got is True, f'est_palindrome({t!r}) doit renvoyer True (et non {got!r}) : ce mot se lit pareil dans les deux sens.')

    def pal_faux():
        for t in ('python', 'ab', 'radars', 'abca'):
            got = returns(f'est_palindrome({t!r})', call('est_palindrome', t))
            expect(got is False, f'est_palindrome({t!r}) doit renvoyer False (et non {got!r}) : ce mot ne se lit pas pareil dans les deux sens.')

    def pal_recursive():
        recursive('est_palindrome', 'radar', minimum=2)

    def sl_valeurs():
        expect(returns('somme_liste([])', call('somme_liste', [])) == 0, 'Cas de base : somme_liste([]) doit renvoyer 0.')
        for tab, want in (([5], 5), ([4, 7, 2], 13), ([-3, 3, 10], 10)):
            got = returns(f'somme_liste({tab})', call('somme_liste', tab))
            expect(got == want, f'somme_liste({tab}) doit renvoyer {want} ; obtenu {got!r}.')

    def sl_intacte():
        tab = [4, 7, 2]
        unchanged('somme_liste', tab, lambda: call('somme_liste', tab))

    def sl_recursive():
        recursive('somme_liste', [4, 7, 2], minimum=4)

    # ─── iteratif ───────────────────────────────────────────────────────────

    def iter_valeurs():
        for a, n, want in ((2, 0, 1), (2, 10, 1024), (3, 3, 27), (5, 1, 5)):
            got = returns(f'puissance_iterative({a}, {n})', call('puissance_iterative', a, n))
            expect(got == want, f'puissance_iterative({a}, {n}) doit renvoyer {want} ; obtenu {got!r}.')

    def iter_comparaison():
        for a in (2, 3, 7):
            for n in range(0, 9):
                expect(call('puissance_iterative', a, n) == call('puissance_recursive', a, n),
                       f'Pour a = {a} et n = {n}, la version itérative et la version récursive doivent donner le même résultat.')

    def iter_sans_recursion():
        stats_iter = watch('puissance_iterative')
        stats_rec = watch('puissance_recursive')
        returns('puissance_iterative(2, 6)', call('puissance_iterative', 2, 6))
        expect(stats_iter['calls'] == 1, 'puissance_iterative ne doit pas s’appeler elle-même : une boucle suffit.')
        expect(stats_rec['calls'] == 0, 'puissance_iterative doit faire le calcul elle-même (avec une boucle), sans déléguer à puissance_recursive.')

    def iter_profonde():
        got = call('puissance_iterative', 2, 1000)
        expect(got == 2 ** 1000, 'puissance_iterative(2, 1000) doit renvoyer 2 puissance 1000 : sans pile d’appels, une grande valeur de n ne pose aucun problème.')

    # ─── mission ────────────────────────────────────────────────────────────

    def ce_valeurs():
        expect(returns('compter_elements([])', call('compter_elements', [])) == 0, 'Une liste vide contient 0 nombre : compter_elements([]) doit renvoyer 0.')
        for x, want in ((7, 1), ([7], 1), ([1, 2, 3], 3), ([1, [2, 3], [4, [5, 6]]], 6), ([[[[1]]]], 1), ([[], [[]], 4], 1)):
            got = returns(f'compter_elements({x})', call('compter_elements', x))
            expect(got == want, f'compter_elements({x}) doit renvoyer {want} ; obtenu {got!r}.')

    def ce_recursive():
        recursive('compter_elements', [1, [2, 3], [4, [5, 6]]], minimum=5)

    def cf_dossier():
        dossier = ['cours.pdf', ['tp.py', 'correction.pdf'], 'notes.txt']
        got = returns('compter_fichiers(dossier)', call('compter_fichiers', dossier))
        expect(got == 4, f'Le dossier de l’énoncé contient 4 fichiers ; compter_fichiers a renvoyé {got!r}.')

    def cf_cas_limites():
        expect(call('compter_fichiers', 'a.txt') == 1, 'Un fichier seul compte pour 1 : compter_fichiers("a.txt") doit renvoyer 1.')
        expect(call('compter_fichiers', []) == 0, 'Un dossier vide contient 0 fichier : compter_fichiers([]) doit renvoyer 0.')
        expect(call('compter_fichiers', [[], [[], []]]) == 0, 'Des dossiers vides imbriqués ne contiennent aucun fichier.')
        expect(call('compter_fichiers', ['a', ['b', ['c', ['d']]]]) == 4, 'Quatre fichiers à des profondeurs différentes : le résultat doit être 4.')

    def cf_intacte():
        dossier = ['a', ['b', 'c'], 'd']
        copie = repr(dossier)
        returns('compter_fichiers(dossier)', call('compter_fichiers', dossier))
        expect(repr(dossier) == copie, 'compter_fichiers ne doit pas modifier le dossier reçu.')

    def cf_recursive():
        recursive('compter_fichiers', ['cours.pdf', ['tp.py', 'correction.pdf'], 'notes.txt'], minimum=5)

    def inv_valeurs():
        expect(call('inverse', '') == '', 'Cas de base : inverse("") doit renvoyer "".')
        for t, want in (('a', 'a'), ('NSI', 'ISN'), ('kayak', 'kayak'), ('python', 'nohtyp')):
            got = returns(f'inverse({t!r})', call('inverse', t))
            expect(got == want, f'inverse({t!r}) doit renvoyer {want!r} ; obtenu {got!r}.')

    def inv_recursive():
        recursive('inverse', 'NSI', minimum=3)

    # ─── bonus ──────────────────────────────────────────────────────────────

    def max_valeurs():
        for tab, want in (([3], 3), ([4, 9, 2], 9), ([-5, -2, -9], -2), ([1, 2, 3, 4, 5], 5), ([8, 1, 1], 8)):
            got = returns(f'maximum({tab})', call('maximum', tab))
            expect(got == want, f'maximum({tab}) doit renvoyer {want} ; obtenu {got!r}.')

    def max_recursive():
        recursive('maximum', [4, 9, 2], minimum=3)

    def dicho_valeurs():
        tab = [2, 5, 8, 12, 16, 23, 38, 56]
        for x in tab:
            got = returns(f'indice_dicho(tab, {x}, 0, 7)', call('indice_dicho', tab, x, 0, len(tab) - 1))
            expect(got == tab.index(x), f'indice_dicho doit renvoyer {tab.index(x)} pour x = {x} dans {tab} ; obtenu {got!r}.')

    def dicho_absent():
        tab = [2, 5, 8, 12, 16, 23]
        for x in (0, 3, 13, 99):
            got = returns(f'indice_dicho(tab, {x}, 0, 5)', call('indice_dicho', tab, x, 0, len(tab) - 1))
            expect(got == -1, f'{x} n’est pas dans {tab} : indice_dicho doit renvoyer -1 ; obtenu {got!r}.')
        expect(call('indice_dicho', [], 4, 0, -1) == -1, 'Cas de base : sur une plage vide (debut > fin), il n’y a rien à trouver : renvoyer -1.')

    def dicho_efficace():
        tab = list(range(0, 2000, 2))
        stats = watch('indice_dicho')
        got = call('indice_dicho', tab, 1998, 0, len(tab) - 1)
        expect(got == 999, 'indice_dicho doit trouver 1998 à l’indice 999.')
        expect(stats['calls'] <= 12, f'Sur 1 000 cases, une dichotomie fait au plus une douzaine d’appels (la plage est divisée par deux à chaque appel) ; observé : {stats["calls"]}.')
        stats = watch('indice_dicho')
        call('indice_dicho', tab, 7, 0, len(tab) - 1)
        expect(stats['calls'] <= 12, f'Même pour une valeur absente, au plus une douzaine d’appels ; observé : {stats["calls"]}.')

    groups = {
        'decouverte': [
            ('compte_a_rebours(3) affiche 3, 2, 1, 0', decouverte_valeurs),
            ('Cas de base : rien à afficher pour n < 0', decouverte_base),
            ('Terminaison : compte_a_rebours(50) se termine', decouverte_terminaison),
            ('La fonction s’appelle elle-même : un appel par valeur de n', decouverte_recursive)],
        'pile-appels': [
            ('Les APPEL et RETOUR de somme_trace(3), avec leur retrait', pile_trace),
            ('somme_trace renvoie la même valeur que somme', pile_valeur),
            ('Tous les APPEL précèdent tous les RETOUR (descente puis remontée)', pile_lifo),
            ('Profondeur de la pile : n + 1 appels simultanés', pile_profondeur)],
        'ecrire': [
            ('somme : cas de base somme(0) = 0', somme_base),
            ('somme : somme(1), somme(3), somme(5), somme(10)', somme_valeurs),
            ('somme : la fonction s’appelle elle-même', somme_recursive),
            ('factorielle : 0! = 1 et 1! = 1', fact_base),
            ('factorielle : 3!, 5!, 6!', fact_valeurs),
            ('factorielle : la fonction s’appelle elle-même', fact_recursive),
            ('puissance : cas de base a puissance 0 = 1', puis_base),
            ('puissance : 2 puissance 1, 2 puissance 5, 3 puissance 3, 10 puissance 4', puis_valeurs),
            ('puissance : la fonction s’appelle elle-même', puis_recursive),
            ('Terminaison : somme(100), factorielle(20) et puissance(2, 100) se terminent', ecrire_terminaison)],
        'structures': [
            ('longueur : cas de base et valeurs', long_valeurs),
            ('longueur : la fonction s’appelle elle-même', long_recursive),
            ('est_palindrome : les palindromes renvoient True', pal_vrai),
            ('est_palindrome : les autres mots renvoient False', pal_faux),
            ('est_palindrome : la fonction s’appelle elle-même', pal_recursive),
            ('somme_liste : cas de base et valeurs', sl_valeurs),
            ('somme_liste : la liste reçue n’est pas modifiée', sl_intacte),
            ('somme_liste : la fonction s’appelle elle-même', sl_recursive)],
        'iteratif': [
            ('puissance_iterative : valeurs', iter_valeurs),
            ('Mêmes résultats que la version récursive', iter_comparaison),
            ('La version itérative n’utilise aucun appel récursif', iter_sans_recursion),
            ('Sans pile d’appels : puissance_iterative(2, 1000) fonctionne', iter_profonde)],
        'mission': [
            ('compter_elements : cas simples et listes imbriquées', ce_valeurs),
            ('compter_elements : la fonction s’appelle elle-même', ce_recursive),
            ('compter_fichiers : le dossier de l’énoncé contient 4 fichiers', cf_dossier),
            ('compter_fichiers : fichier seul, dossiers vides, imbrications profondes', cf_cas_limites),
            ('compter_fichiers : le dossier reçu n’est pas modifié', cf_intacte),
            ('compter_fichiers : la fonction s’appelle elle-même', cf_recursive),
            ('inverse : cas de base et valeurs', inv_valeurs),
            ('inverse : la fonction s’appelle elle-même', inv_recursive)],
        'bonus': [
            ('maximum : valeurs', max_valeurs),
            ('maximum : la fonction s’appelle elle-même', max_recursive),
            ('indice_dicho : l’indice des éléments présents', dicho_valeurs),
            ('indice_dicho : éléments absents et plage vide → -1', dicho_absent),
            ('indice_dicho : environ la moitié des cases écartée à chaque appel', dicho_efficace)],
    }
    if step not in groups:
        return {'ok': False, 'error': 'Étape sans test de code.', 'output': out.getvalue(), 'tests': [], 'mode': 'test'}
    for name, fn in groups[step]:
        # Chaque contrôle repart des fonctions de l'élève, sans enveloppeur laissé par le précédent.
        for k, v in originals.items():
            ns[k] = v
        verify(name, fn)
    for k, v in originals.items():
        ns[k] = v
    return {'ok': exec_error is None and all(t['pass'] for t in results), 'error': exec_error, 'output': out.getvalue(), 'tests': results, 'mode': 'test'}
