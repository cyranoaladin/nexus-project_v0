"""Contrôles formatifs du TP POO 2 (listes, piles et files). Aucune exécution de ce fichier côté serveur.
Le moteur navigateur est interrompu par destruction de son Web Worker.
Le filtrage AST est une restriction pédagogique, PAS une sandbox de sécurité.

Les contrôles sont COMPORTEMENTAUX : ils appellent l'interface publique des classes de l'élève
et acceptent toute implémentation valide (aucune recherche de texte dans le code).
Convention unique du TP pour une structure vide : lever IndexError.
"""
import ast
import builtins
import contextlib
import io
import traceback

MAX_CODE = 20000
MAX_OUTPUT = 6000
ALLOWED_DUNDER = {'__init__', '__len__'}
# Seule l'étape bonus peut importer, et seulement collections.deque.
IMPORTS_BY_STEP = {'bonus': {'collections'}}
DEQUE_ONLY = {'deque'}


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
    permitted = IMPORTS_BY_STEP.get(step, set())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if not permitted or not {a.name for a in node.names} <= permitted:
                raise ValueError('Cet atelier n’utilise aucun import (seule l’étape bonus autorise collections).')
        if isinstance(node, ast.ImportFrom):
            ok = permitted and node.level == 0 and node.module in permitted and {a.name for a in node.names} <= DEQUE_ONLY
            if not ok:
                raise ValueError('Cet atelier n’utilise aucun import (seule l’étape bonus autorise : from collections import deque).')
        if isinstance(node, ast.Attribute) and node.attr.startswith('__') and node.attr not in ALLOWED_DUNDER:
            raise ValueError('Dans ce TP, un attribut « privé » s’écrit avec UN seul tiret bas (self._elements), pas deux.')
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith('__') and node.name not in ALLOWED_DUNDER:
            raise ValueError('Seules les méthodes spéciales __init__ et __len__ sont utilisées ici.')
        if isinstance(node, ast.Name) and node.id in {'eval', 'exec', 'compile', 'open', 'input', 'globals', 'locals', '__import__'}:
            raise ValueError('Les fichiers, input et l’exécution dynamique ne sont pas utilisés ici. Renseigne directement tes données.')
    return tree


def run_submission(code, step, mode='test'):
    out = LimitedOutput()
    results = []
    allowed = ['__build_class__', 'object', 'print', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict',
               'set', 'tuple', 'min', 'max', 'sum', 'abs', 'enumerate', 'zip', 'sorted', 'reversed', 'isinstance',
               'type', 'all', 'any', 'repr', 'Exception', 'ValueError', 'TypeError', 'AssertionError', 'IndexError',
               'KeyError', 'StopIteration', 'NotImplementedError']
    permitted = IMPORTS_BY_STEP.get(step, set())

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name in permitted and level == 0:
            return builtins.__import__(name, globals, locals, fromlist, level)
        raise ImportError('Import non autorisé dans cet atelier.')

    safe_builtins = {k: getattr(builtins, k) for k in allowed}
    safe_builtins['__import__'] = guarded_import
    ns = {'__builtins__': safe_builtins, '__name__': '__eleve__'}
    try:
        tree = check_source(code, step)
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            exec(compile(tree, 'mon_programme.py', 'exec'), ns, ns)
    except BaseException as exc:
        if isinstance(exc, SyntaxError):
            detail = f'{type(exc).__name__}, ligne {exc.lineno} : {exc.msg}'
        else:
            frames = traceback.extract_tb(exc.__traceback__)
            line = next((f.lineno for f in reversed(frames) if f.filename == 'mon_programme.py'), None)
            detail = f'{type(exc).__name__}' + (f', ligne {line}' if line else '') + f' : {exc}'
        return {'ok': False, 'error': detail, 'output': out.getvalue(), 'tests': [], 'mode': mode}

    # ─── Outils de contrôle ─────────────────────────────────────────────────

    def verify(label, fn):
        try:
            with contextlib.redirect_stdout(LimitedOutput()), contextlib.redirect_stderr(LimitedOutput()):
                fn()
            results.append({'label': label, 'pass': True, 'message': 'Cas vérifié.'})
        except TypeError as exc:
            results.append({'label': label, 'pass': False,
                            'message': ('Appel impossible : ' + str(exc))[:700]
                            + ' Vérifie le nom de la méthode et ses paramètres (self, puis les autres).'})
        except BaseException as exc:
            results.append({'label': label, 'pass': False, 'message': str(exc)[:800] or type(exc).__name__})

    def expect(condition, message):
        if not condition:
            raise AssertionError(message)

    def need(name):
        C = ns.get(name)
        expect(isinstance(C, type), f'Définis une classe nommée {name}.')
        return C

    def new(name):
        return need(name)()

    def returns(desc, fn):
        """Appelle fn() ; None signifie presque toujours « print ou oubli de return »."""
        value = fn()
        expect(value is not None, f'{desc} renvoie None : utilise return pour RENVOYER la valeur (print l’affiche seulement).')
        return value

    def raises_index(desc, fn):
        try:
            fn()
        except IndexError:
            return
        except BaseException as exc:
            raise AssertionError(f'{desc} doit lever IndexError, pas {type(exc).__name__}. '
                                 'La convention du TP : une structure vide (ou un indice invalide) → IndexError.')
        raise AssertionError(f'{desc} devait lever IndexError (structure vide ou indice invalide), mais l’appel a abouti. '
                             'Teste d’abord si la structure est vide.')

    # ─── Étape liste ────────────────────────────────────────────────────────

    def liste_vide():
        L = new('Liste')
        expect(returns('est_vide()', L.est_vide) is True, 'Une liste neuve est vide : est_vide() doit renvoyer True.')

    def liste_ajout():
        L = new('Liste')
        L.ajouter('Ada')
        L.ajouter('Alan')
        expect(returns('longueur()', L.longueur) == 2, 'Après deux ajouter(...), longueur() doit renvoyer 2.')
        expect(L.est_vide() is False, 'Une liste qui contient des éléments n’est pas vide : est_vide() doit renvoyer False.')
        L.ajouter('Grace')
        expect(L.longueur() == 3, 'longueur() doit suivre chaque ajout (3 attendu après trois ajouter).')

    def liste_lecture():
        L = new('Liste')
        for nom in ['Ada', 'Alan', 'Grace']:
            L.ajouter(nom)
        expect(returns('element(0)', lambda: L.element(0)) == 'Ada', 'element(0) doit renvoyer le PREMIER élément ajouté (les indices commencent à 0).')
        expect(L.element(2) == 'Grace', 'element(2) doit renvoyer le troisième élément ajouté : l’ordre d’ajout est conservé.')
        expect(L.longueur() == 3, 'Lire un élément ne doit pas modifier la liste : longueur() doit rester 3.')

    def liste_indice():
        L = new('Liste')
        raises_index('element(0) sur une liste vide', lambda: L.element(0))
        L.ajouter('Ada')
        L.ajouter('Alan')
        raises_index('element(2) sur une liste de 2 éléments', lambda: L.element(2))
        # Piège voulu : sur une list Python, liste[-1] est VALIDE ; le contrat de NOTRE Liste, lui, interdit les indices négatifs.
        raises_index('element(-1) (indice négatif : interdit par le contrat de Liste, même si list[-1] existe en Python)', lambda: L.element(-1))
        expect(L.element(1) == 'Alan', 'Après une erreur d’indice, la liste doit rester utilisable et inchangée.')

    def liste_independance():
        A = new('Liste')
        B = new('Liste')
        A.ajouter(1)
        expect(B.est_vide() is True and B.longueur() == 0,
               'Deux listes doivent être indépendantes : ajouter dans A ne doit rien changer dans B. '
               'La list interne doit être créée dans __init__ (self._elements = []), pas au niveau de la classe.')

    # ─── Étape pile ─────────────────────────────────────────────────────────

    def pile_neuve():
        p = new('Pile')
        expect(returns('est_vide()', p.est_vide) is True, 'Une pile neuve est vide : est_vide() doit renvoyer True.')
        expect(returns('taille()', p.taille) == 0, 'Une pile neuve a pour taille 0.')

    def pile_empiler():
        p = new('Pile')
        p.empiler('A')
        expect(p.est_vide() is False, 'Après empiler, la pile n’est plus vide.')
        p.empiler('B')
        expect(p.taille() == 2, 'Après deux empiler, taille() doit renvoyer 2.')

    def pile_sommet():
        p = new('Pile')
        p.empiler('A')
        p.empiler('B')
        expect(returns('sommet()', p.sommet) == 'B', 'sommet() doit renvoyer le DERNIER élément empilé (celui du dessus).')
        expect(p.sommet() == 'B' and p.taille() == 2, 'sommet() consulte sans retirer : la pile doit rester inchangée.')

    def pile_depiler():
        p = new('Pile')
        for x in ['A', 'B', 'C']:
            p.empiler(x)
        v = returns('depiler()', p.depiler)
        expect(v == 'C', 'depiler() doit RENVOYER l’élément du sommet (ici C).')
        expect(p.taille() == 2, 'depiler() doit aussi MODIFIER la pile : après un dépilage la taille vaut 2 (mutation oubliée ?).')
        expect(p.sommet() == 'B', 'Après avoir dépilé C, le nouveau sommet doit être B.')

    def pile_lifo():
        p = new('Pile')
        for x in [1, 2, 3, 4, 5]:
            p.empiler(x)
        sortie = []
        while not p.est_vide():
            sortie.append(p.depiler())
            expect(len(sortie) <= 5, 'La pile ne se vide jamais : depiler() doit retirer l’élément.')
        expect(sortie == [5, 4, 3, 2, 1],
               f'Une pile est LIFO : on dépile dans l’ordre inverse de l’empilement. Obtenu {sortie}, attendu [5, 4, 3, 2, 1].')
        q = new('Pile')
        q.empiler('A')
        q.empiler('B')
        expect(q.depiler() == 'B', 'Dernier entré, premier sorti : B doit sortir avant A.')
        q.empiler('C')
        expect(q.depiler() == 'C' and q.depiler() == 'A', 'Après un nouvel empilement de C, l’ordre de sortie doit être C puis A.')

    def pile_vide():
        p = new('Pile')
        raises_index('sommet() sur une pile vide', p.sommet)
        raises_index('depiler() sur une pile vide', p.depiler)
        p.empiler('X')
        expect(p.depiler() == 'X', 'Après une erreur sur pile vide, la pile doit rester utilisable.')
        raises_index('depiler() sur une pile redevenue vide', p.depiler)

    def pile_independance():
        a = new('Pile')
        b = new('Pile')
        a.empiler(1)
        expect(b.est_vide() is True, 'Deux piles doivent être indépendantes (la list interne se crée dans __init__, pas dans la classe).')

    # ─── Étape file ─────────────────────────────────────────────────────────

    def file_neuve():
        f = new('File')
        expect(returns('est_vide()', f.est_vide) is True, 'Une file neuve est vide : est_vide() doit renvoyer True.')
        expect(returns('taille()', f.taille) == 0, 'Une file neuve a pour taille 0.')

    def file_enfiler():
        f = new('File')
        f.enfiler('Adam')
        f.enfiler('Alexandre')
        expect(f.est_vide() is False, 'Après enfiler, la file n’est plus vide.')
        expect(f.taille() == 2, 'Après deux enfiler, taille() doit renvoyer 2.')

    def file_premier():
        f = new('File')
        f.enfiler('Adam')
        f.enfiler('Alexandre')
        expect(returns('premier()', f.premier) == 'Adam', 'premier() doit renvoyer l’élément arrivé EN PREMIER (celui qui sortira le premier).')
        expect(f.premier() == 'Adam' and f.taille() == 2, 'premier() consulte sans retirer : la file doit rester inchangée.')

    def file_defiler():
        f = new('File')
        for x in ['Adam', 'Alexandre', 'Zaineb']:
            f.enfiler(x)
        v = returns('defiler()', f.defiler)
        expect(v == 'Adam', 'defiler() doit RENVOYER le premier arrivé (Adam).')
        expect(f.taille() == 2, 'defiler() doit aussi MODIFIER la file : après un défilage la taille vaut 2 (mutation oubliée ?).')
        expect(f.premier() == 'Alexandre', 'Après avoir défilé Adam, le premier doit être Alexandre.')

    def file_fifo():
        f = new('File')
        for x in [1, 2, 3, 4, 5]:
            f.enfiler(x)
        sortie = []
        while not f.est_vide():
            sortie.append(f.defiler())
            expect(len(sortie) <= 5, 'La file ne se vide jamais : defiler() doit retirer l’élément.')
        expect(sortie == [1, 2, 3, 4, 5],
               f'Une file est FIFO : on défile dans l’ordre d’arrivée. Obtenu {sortie}, attendu [1, 2, 3, 4, 5]. '
               'Ressemble au comportement d’une pile ? Regarde quel élément tu retires.')
        g = new('File')
        g.enfiler('A')
        g.enfiler('B')
        expect(g.defiler() == 'A', 'Premier entré, premier sorti : A doit sortir avant B.')
        g.enfiler('C')
        expect(g.defiler() == 'B' and g.defiler() == 'C', 'Après un nouvel enfilage de C, l’ordre de sortie doit être B puis C.')

    def file_vide():
        f = new('File')
        raises_index('premier() sur une file vide', f.premier)
        raises_index('defiler() sur une file vide', f.defiler)
        f.enfiler('X')
        expect(f.defiler() == 'X', 'Après une erreur sur file vide, la file doit rester utilisable.')
        raises_index('defiler() sur une file redevenue vide', f.defiler)

    def file_independance():
        a = new('File')
        b = new('File')
        a.enfiler(1)
        expect(b.est_vide() is True, 'Deux files doivent être indépendantes (la list interne se crée dans __init__, pas dans la classe).')

    # ─── Étape mission ──────────────────────────────────────────────────────

    DOCS = ['DS_Maths.pdf', 'TP_NSI.pdf', 'Correction.pdf']

    def centre_neuf():
        c = new('FileImpression')
        expect(returns('est_vide()', c.est_vide) is True, 'Un centre d’impression neuf n’a rien en attente : est_vide() doit renvoyer True.')
        expect(returns('en_attente()', c.en_attente) == 0, 'Un centre neuf a 0 document en attente.')

    def centre_soumettre():
        c = new('FileImpression')
        for d in DOCS:
            c.soumettre(d)
        expect(returns('en_attente()', c.en_attente) == 3, 'Après trois soumettre, en_attente() doit renvoyer 3.')
        expect(c.est_vide() is False, 'Avec des documents en attente, est_vide() doit renvoyer False.')
        autre = new('FileImpression')
        expect(autre.est_vide() is True, 'Deux centres d’impression doivent être indépendants.')

    def centre_prochain():
        c = new('FileImpression')
        for d in DOCS:
            c.soumettre(d)
        expect(returns('prochain()', c.prochain) == 'DS_Maths.pdf', 'prochain() doit renvoyer le document qui sera imprimé en premier : le premier soumis.')
        expect(c.prochain() == 'DS_Maths.pdf' and c.en_attente() == 3, 'prochain() consulte sans retirer : rien ne doit changer.')

    def centre_fifo():
        c = new('FileImpression')
        for d in DOCS:
            c.soumettre(d)
        sortie = [returns('imprimer()', c.imprimer) for _ in range(3)]
        expect(sortie == DOCS, f'Les documents s’impriment dans l’ordre de soumission (FIFO). Obtenu {sortie}.')
        expect(c.en_attente() == 0 and c.est_vide() is True, 'Après avoir tout imprimé, plus rien n’est en attente.')
        c.soumettre('Nouveau.pdf')
        expect(c.imprimer() == 'Nouveau.pdf', 'Le centre doit rester utilisable après avoir été vidé.')

    def centre_vide():
        c = new('FileImpression')
        raises_index('prochain() sur un centre vide', c.prochain)
        raises_index('imprimer() sur un centre vide', c.imprimer)

    def reglages_base():
        r = new('Reglages')
        expect(r.valeur('copies') == 1 and r.valeur('couleur') == 'noir', 'Réglages de départ : copies = 1 et couleur = "noir".')
        r.regler('copies', 3)
        expect(returns('valeur("copies")', lambda: r.valeur('copies')) == 3, 'Après regler("copies", 3), valeur("copies") doit renvoyer 3.')
        expect(r.valeur('couleur') == 'noir', 'Modifier « copies » ne doit pas changer « couleur ».')

    def reglages_annuler():
        r = new('Reglages')
        r.regler('copies', 3)
        expect(r.valeur('copies') == 3, 'Avant d’annuler, regler("copies", 3) doit avoir modifié la valeur.')
        r.annuler()
        expect(r.valeur('copies') == 1, 'annuler() doit RESTAURER l’ancienne valeur (1), pas simplement retirer un élément de la pile.')

    def reglages_ordre():
        r = new('Reglages')
        r.regler('copies', 3)
        r.regler('copies', 5)
        r.regler('couleur', 'bleu')
        r.annuler()
        expect(r.valeur('couleur') == 'noir' and r.valeur('copies') == 5, 'La dernière action est annulée en premier : couleur redevient "noir", copies reste 5.')
        r.annuler()
        expect(r.valeur('copies') == 3, 'Deuxième annulation : copies redevient 3.')
        r.annuler()
        expect(r.valeur('copies') == 1, 'Troisième annulation : copies redevient 1. Dernier entré, premier sorti : c’est une pile.')

    def reglages_rien():
        r = new('Reglages')
        raises_index('annuler() sans aucune action à annuler', r.annuler)
        r.regler('copies', 2)
        r.annuler()
        raises_index('annuler() une fois tout annulé', r.annuler)

    # ─── Bonus ──────────────────────────────────────────────────────────────

    def deque_base():
        f = new('FileDeque')
        expect(returns('est_vide()', f.est_vide) is True and returns('taille()', f.taille) == 0, 'Une FileDeque neuve est vide (taille 0).')
        f.enfiler('A')
        f.enfiler('B')
        expect(f.taille() == 2 and f.premier() == 'A' and f.est_vide() is False, 'Après deux enfiler : taille 2, premier A, non vide.')

    def deque_fifo():
        f = new('FileDeque')
        for x in [1, 2, 3]:
            f.enfiler(x)
        sortie = [returns('defiler()', f.defiler) for _ in range(3)]
        expect(sortie == [1, 2, 3], f'FIFO attendu [1, 2, 3], obtenu {sortie}. Avec une deque : append à droite, popleft à gauche.')
        expect(f.est_vide() is True, 'Après avoir tout défilé, la file est vide.')

    def deque_vide():
        f = new('FileDeque')
        raises_index('premier() sur une FileDeque vide', f.premier)
        raises_index('defiler() sur une FileDeque vide', f.defiler)
        f.enfiler(1)
        expect(f.defiler() == 1, 'La file doit rester utilisable après l’erreur.')

    groups = {
        'liste': [
            ('__init__ et est_vide : une liste neuve est vide', liste_vide),
            ('ajouter et longueur', liste_ajout),
            ('element : lecture par indice', liste_lecture),
            ('element : indice invalide → IndexError', liste_indice),
            ('Plusieurs listes indépendantes', liste_independance)],
        'pile': [
            ('est_vide et taille : une pile neuve est vide', pile_neuve),
            ('empiler : la taille augmente', pile_empiler),
            ('sommet : consulte sans retirer', pile_sommet),
            ('depiler : renvoie ET retire', pile_depiler),
            ('LIFO : dernier entré, premier sorti', pile_lifo),
            ('Pile vide : sommet et depiler lèvent IndexError', pile_vide),
            ('Plusieurs piles indépendantes', pile_independance)],
        'file': [
            ('est_vide et taille : une file neuve est vide', file_neuve),
            ('enfiler : la taille augmente', file_enfiler),
            ('premier : consulte sans retirer', file_premier),
            ('defiler : renvoie ET retire', file_defiler),
            ('FIFO : premier entré, premier sorti', file_fifo),
            ('File vide : premier et defiler lèvent IndexError', file_vide),
            ('Plusieurs files indépendantes', file_independance)],
        'mission': [
            ('Centre : un centre neuf n’a rien en attente', centre_neuf),
            ('Centre : soumettre et en_attente', centre_soumettre),
            ('Centre : prochain consulte sans retirer', centre_prochain),
            ('Centre : imprimer respecte FIFO', centre_fifo),
            ('Centre vide : prochain et imprimer lèvent IndexError', centre_vide),
            ('Réglages : regler et valeur', reglages_base),
            ('Réglages : annuler restaure la valeur précédente', reglages_annuler),
            ('Réglages : annulations successives dans l’ordre inverse', reglages_ordre),
            ('Réglages : rien à annuler → IndexError', reglages_rien)],
        'bonus': [
            ('FileDeque : taille, premier et est_vide', deque_base),
            ('FileDeque : FIFO', deque_fifo),
            ('FileDeque : file vide → IndexError', deque_vide)],
    }
    if mode == 'test':
        if step not in groups:
            return {'ok': False, 'error': 'Étape sans test de code.', 'output': out.getvalue(), 'tests': [], 'mode': mode}
        for name, fn in groups[step]:
            verify(name, fn)
    return {'ok': all(t['pass'] for t in results), 'error': None, 'output': out.getvalue(), 'tests': results, 'mode': mode}
