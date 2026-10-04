#!/usr/bin/env python3
"""Génère content.json (côté élève) et le corrigé enseignant du parcours « Récursivité et programmation récursive ».

    python3 content/espace/nsi-recursivite/build_content.py

Écrire en Python évite les erreurs d'échappement JSON ; la typographie française (espaces insécables avant ? ! ; : et
dans les guillemets) est appliquée AUTOMATIQUEMENT hors code, hors SVG et hors balises. Les solutions ne sont jamais
écrites dans content.json.
"""
import html as _html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import solutions as S  # noqa: E402

NNBSP = '\u202f'
NBSP = '\u00a0'


def typo_text(s):
    s = re.sub(r' ([?!;])', NNBSP + r'\1', s)
    s = re.sub(r' :', NBSP + ':', s)
    s = s.replace('« ', '«' + NBSP).replace(' »', NBSP + '»')
    return s


_SKIP = re.compile(r'(<pre.*?</pre>|<code.*?</code>|<svg.*?</svg>|<[^>]+>)', re.S)


def T(s):
    """Typographie sur les seuls segments de texte (jamais dans <pre>, <code>, <svg> ni les balises)."""
    parts = _SKIP.split(s)
    return ''.join(p if i % 2 else typo_text(p) for i, p in enumerate(parts))


def esc(x):
    return _html.escape(x, quote=False)


def code(s):
    """Bloc de code Python (échappé)."""
    # tabindex : un bloc de code défilant doit rester atteignable au clavier (accessibilité, écrans étroits).
    return '<pre tabindex="0"><code>' + esc(s.strip('\n')) + '</code></pre>'


def c(s):
    """Code en ligne (échappé)."""
    return '<code>' + esc(s) + '</code>'


def q(id, text, choices, correct, feedback, choice_feedback):
    assert len(choices) == len(choice_feedback), id
    assert 0 <= correct < len(choices), id
    return {'id': id, 'text': T(text), 'choices': [T(x) for x in choices], 'correct': correct,
            'feedback': T(feedback), 'choiceFeedback': [T(x) for x in choice_feedback]}


def f(id, label, placeholder=None, input='area', check=None):
    d = {'id': id, 'label': T(label)}
    if placeholder:
        d['placeholder'] = T(placeholder)
    if input != 'area':
        d['input'] = input
    if check:
        d['check'] = check
    return d


def number_check(accept, success, fallback, rules=None):
    d = {'kind': 'number', 'accept': accept, 'success': T(success), 'fallback': T(fallback)}
    if rules:
        d['rules'] = [{'when': w, 'feedback': T(fb)} for w, fb in rules]
    return d


def step(id, short, title, minutes, level, concepts, intro, lesson, task, starter, questions, fields, hints,
         takeaway, tests, figures=None, printable=False):
    d = {'id': id, 'short': short, 'title': T(title), 'minutes': minutes, 'level': T(level), 'concepts': concepts,
         'intro': T(intro), 'lesson': T(lesson), 'task': T(task), 'starter': starter, 'questions': questions,
         'fields': fields, 'hints': [T(h) for h in hints], 'takeaway': T(takeaway), 'tests': tests}
    if figures:
        d['figures'] = figures
    if printable:
        d['printable'] = True
    return d


# ─── Figures ────────────────────────────────────────────────────────────────

def trace(id, fn, args, caption):
    return {'type': 'call-trace', 'id': id, 'fn': fn, 'args': args, 'caption': T(caption)}


def svg_arbre():
    """Arbre binaire récursif (profondeur 4) : un arbre est un tronc portant deux arbres plus petits."""
    import math
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 250" width="100%" role="img" '
             'aria-label="Arbre fractal : un tronc qui porte deux arbres plus petits, répété quatre fois" font-family="sans-serif">']

    def branch(x, y, angle, length, depth):
        if depth == 0:
            return
        x2 = x + length * math.cos(angle)
        y2 = y - length * math.sin(angle)
        parts.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="currentColor" stroke-width="{depth * 0.9:.1f}" stroke-linecap="round"/>')
        branch(x2, y2, angle + 0.45, length * 0.72, depth - 1)
        branch(x2, y2, angle - 0.45, length * 0.72, depth - 1)

    branch(210, 240, math.pi / 2, 60, 6)
    parts.append('</svg>')
    return ''.join(parts)


FIG_ARBRE = {'type': 'svg', 'id': 'svg-arbre', 'caption': 'Un arbre = un tronc qui porte deux arbres plus petits.',
             'alt': 'Arbre fractal : un tronc qui porte deux arbres plus petits, répété six fois', 'svg': svg_arbre()}

# ─── Encadré de méthode (répété dans le parcours) ───────────────────────────

METHODE = (
    '<div class="method-box"><strong>Comment construire une fonction récursive ?</strong>'
    '<ol>'
    '<li><strong>Quel est le cas le plus simple ?</strong> C’est le <strong>cas de base</strong> : on répond directement, sans nouvel appel.</li>'
    '<li><strong>Comment ramener le problème à un problème plus petit ?</strong> C’est l’<strong>appel récursif</strong>.</li>'
    '<li><strong>La taille du problème diminue-t-elle réellement ?</strong> C’est la vérification de la <strong>terminaison</strong>.</li>'
    '<li><strong>Comment utiliser le résultat obtenu ?</strong> C’est la construction de la <strong>valeur retournée</strong>.</li>'
    '</ol></div>'
)

SOMME_CODE = code('''def somme(n):
    if n == 0:
        return 0
    return n + somme(n - 1)''')

COMPTE_ITER = code('''def compte_a_rebours(n):
    while n >= 0:
        print(n)
        n = n - 1''')

COMPTE_REC = code('''def compte_a_rebours(n):
    if n < 0:
        return
    print(n)
    compte_a_rebours(n - 1)''')

# ─── Étape 0 — Diagnostic ───────────────────────────────────────────────────

DIAGNOSTIC = step(
    'diagnostic', 'Diagnostic', 'Diagnostic : comment un programme finit-il ?', 8, 'Diagnostic, non noté',
    ['boucle', 'condition d’arrêt', 'progression', 'terminaison'],
    'Avant de découvrir la récursivité, regardons un programme que tu connais déjà : une boucle. Rien n’est noté : tes réponses servent à ajuster la suite.',
    '<p>Voici un compte à rebours écrit avec une boucle <code>while</code>.</p>' + COMPTE_ITER
    + '<p>L’appel <code>compte_a_rebours(3)</code> affiche 3, 2, 1, puis 0.</p>'
    '{{q:condition}}{{q:variable}}{{q:pourquoi-fin}}{{q:jamais}}'
    '<p>Mets maintenant l’idée centrale en mots.</p>{{f:progression}}'
    '<p>Retiens ceci : <strong>une répétition finit parce qu’elle progresse vers un arrêt</strong>. La récursivité repose sur la même exigence, avec un autre mécanisme.</p>'
    '<p>Nous allons maintenant écrire un programme capable de se demander à lui-même de résoudre une version plus petite du problème.</p>',
    'Réponds aux quatre questions, puis rédige ta phrase.', None,
    [
        q('condition', 'Quelle est la condition d’arrêt de cette boucle ?',
          ['La boucle s’arrête quand n >= 0 devient fausse (n est alors négatif)', 'La boucle s’arrête quand n vaut 3', 'La boucle s’arrête après le premier print', 'Il n’y a pas de condition d’arrêt'], 0,
          'La boucle while continue tant que la condition n >= 0 est vraie ; elle s’arrête dès que n devient négatif.',
          ['Oui : tant que n >= 0 est vrai, on continue ; l’arrêt arrive quand n devient négatif.', 'n vaut 3 au départ seulement : ce n’est pas ce qui arrête la boucle.', 'print est dans la boucle : il est exécuté à chaque tour.', 'Toute boucle while possède une condition : ici n >= 0.']),
        q('variable', 'Quelle variable évolue à chaque tour de boucle ?',
          ['compte_a_rebours', 'print', 'n', 'La constante 0'], 2,
          'C’est n : la ligne n = n - 1 la diminue de 1 à chaque tour.',
          ['compte_a_rebours est le nom de la fonction, il ne change pas.', 'print est une fonction d’affichage, pas une variable qui évolue.', 'Oui : n diminue de 1 à chaque tour.', '0 est une valeur fixe, pas une variable.']),
        q('pourquoi-fin', 'Pourquoi cette boucle finit-elle toujours ?',
          ['Parce que Python arrête toute boucle au bout de dix tours', 'Parce que n diminue de 1 à chaque tour, donc finit par devenir négatif', 'Parce que print affiche des nombres', 'Parce que n est positif au départ'], 1,
          'La boucle finit parce que n progresse vers la condition d’arrêt : il diminue de 1 à chaque tour.',
          ['Python ne limite pas les boucles à dix tours : une boucle sans progression ne finirait jamais.', 'Oui : la variable progresse vers l’arrêt.', 'L’affichage n’a aucun rôle dans l’arrêt.', 'Être positif au départ ne suffit pas : il faut que n diminue.']),
        q('jamais', 'Que se passerait-il si la ligne n = n - 1 était supprimée ?',
          ['La boucle afficherait 3, 2, 1, 0 quand même', 'La boucle ne s’exécuterait jamais', 'La boucle afficherait 3 indéfiniment : n ne changerait jamais', 'Python refuserait de lire le programme'], 2,
          'Sans cette ligne, n reste égal à 3 et la condition n >= 0 reste vraie : la boucle ne s’arrête jamais.',
          ['Sans diminution de n, la suite 3, 2, 1, 0 ne peut pas apparaître.', 'La condition est vraie au départ : la boucle s’exécute.', 'Oui : aucune progression, donc aucun arrêt.', 'Le programme est syntaxiquement correct : c’est sa logique qui est défaillante.']),
    ],
    [f('progression', 'En une phrase : à quelle condition une répétition finit-elle ?', 'Une répétition finit si…')],
    ['Regarde ce qui change à chaque tour, et vers quelle valeur cela se rapproche.'],
    'Une répétition finit parce que quelque chose progresse vers la condition d’arrêt. Sans progression, elle ne finit jamais : nous retrouverons cette exigence avec la récursivité.',
    [])

# ─── Étape 1 — Découvrir la récursivité ─────────────────────────────────────

BUG_CODE = code('''def compte_a_rebours(n):
    print(n)
    compte_a_rebours(n)''')

DECOUVERTE = step(
    'decouverte', 'Découvrir', 'Découvrir la récursivité', 12, 'Découverte puis guidé',
    ['fonction récursive', 'cas de base', 'appel récursif', 'RecursionError'],
    'Même compte à rebours, sans boucle : la fonction s’appelle elle-même. Tu identifies ses deux ingrédients, puis tu fais volontairement un premier bug.',
    '<p>Voici le même compte à rebours, écrit <strong>sans boucle</strong> : la fonction s’appelle elle-même.</p>' + COMPTE_REC
    + '<p>Pour <code>compte_a_rebours(2)</code>, la fonction affiche 2, puis demande à <em>une version plus petite d’elle-même</em> de s’occuper du reste : elle affiche 1, puis 0, puis le problème est devenu si petit (n est négatif) qu’il n’y a plus rien à faire.</p>'
    '<h3>Les deux ingrédients</h3>'
    '<ul><li><strong>Le cas de base</strong> : la situation si simple qu’on répond sans nouvel appel. Ici ' + c('if n < 0: return') + '.</li>'
    '<li><strong>L’appel récursif</strong> : on ramène le problème à une <em>instance plus petite du même problème</em>. Ici ' + c('compte_a_rebours(n - 1)') + '.</li></ul>'
    '{{q:cas-de-base}}{{q:appel}}{{q:pourquoi-n-1}}'
    '<p>Le message à retenir : <strong>une fonction récursive doit toujours progresser vers un cas de base.</strong></p>'
    '<h3>Ton premier bug récursif</h3>'
    '<p>Voici une version défectueuse :</p>' + BUG_CODE + '{{q:bug-prediction}}'
    '<p>Le programme défectueux est déjà dans l’éditeur. <strong>Exécute-le</strong>, lis le message, puis <strong>répare-le</strong> : ajoute le cas de base et fais porter l’appel sur un problème plus petit. Clique ensuite sur « Vérifier mon code ».</p>{{code}}'
    '<p>Python n’exécute pas une infinité d’appels : le nombre d’appels imbriqués est limité (environ 1 000 par défaut dans Python standard). Dans cet atelier, Nexus limite volontairement la profondeur à 200 appels, afin qu’un programme incorrect ne bloque pas le navigateur. Au-delà de la limite, l’exécution s’arrête avec une erreur <code>RecursionError</code>.</p>'
    '{{q:recursionerror}}'
    '<p>Une fonction récursive qui ne progresse pas vers un cas de base est <strong>incorrecte</strong>.</p>{{f:reparation}}',
    'Réponds aux questions, exécute puis répare le programme défectueux, vérifie-le, puis explique ta réparation.',
    S.DECOUVERTE_STARTER,
    [
        q('cas-de-base', 'Quelle instruction est le cas de base de compte_a_rebours ?',
          ['if n < 0: return', 'print(n)', 'compte_a_rebours(n - 1)', 'def compte_a_rebours(n):'], 0,
          'Le cas de base est la situation la plus simple, traitée sans nouvel appel : quand n est négatif, on s’arrête.',
          ['Oui : le test n < 0 suivi de return arrête la récursion.', 'print(n) est exécuté pour chaque valeur de n ≥ 0 : ce n’est pas le cas d’arrêt.', 'Cette ligne est l’appel récursif, pas le cas de base.', 'C’est l’en-tête de la fonction : elle ne décide de rien.']),
        q('appel', 'Quelle instruction est l’appel récursif ?',
          ['print(n)', 'if n < 0: return', 'def compte_a_rebours(n):', 'compte_a_rebours(n - 1)'], 3,
          'L’appel récursif est la ligne où la fonction s’appelle elle-même, ici sur un problème plus petit.',
          ['print est un appel de fonction, mais pas un appel à compte_a_rebours elle-même.', 'Cette ligne arrête la récursion : c’est le cas de base.', 'Ceci définit la fonction ; ce n’est pas un appel.', 'Oui : la fonction s’appelle elle-même, avec n - 1.']),
        q('pourquoi-n-1', 'Pourquoi l’appel récursif porte-t-il sur n - 1 et non sur n ?',
          ['Parce que Python interdit d’appeler une fonction avec la même valeur', 'Parce que print affiche n - 1', 'Parce que n - 1 est un problème plus petit : on se rapproche du cas de base', 'Parce que n - 1 est toujours égal à 0'], 2,
          'Avec n, on referait exactement le même problème, sans progresser : l’appel se répéterait sans fin. Avec n - 1, on se rapproche du cas de base n < 0.',
          ['Python n’interdit rien : c’est la logique qui l’exige.', 'print affiche n, pas n - 1.', 'Oui : le problème diminue à chaque appel.', 'n - 1 vaut 0 seulement quand n vaut 1.']),
        q('bug-prediction', 'Que va-t-il se passer si on exécute compte_a_rebours(3) avec cette version ?',
          ['Elle affiche 3 une fois, puis s’arrête', 'Elle affiche 3, 2, 1, 0', 'Elle affiche 3 de nombreuses fois, puis Python s’arrête avec une RecursionError', 'Elle affiche 3 indéfiniment et ne s’arrête jamais, quoi qu’il arrive'], 2,
          'Il n’y a ni cas de base ni progression : chaque appel recommence le même problème. Le nombre d’appels imbriqués est limité (par Python, et plus bas encore dans cet atelier) : l’exécution s’arrête avec une RecursionError.',
          ['Rien n’arrête la fonction après le premier affichage : elle se rappelle.', 'Elle ne décrémente jamais n : 2, 1, 0 n’apparaissent jamais.', 'Oui : les appels s’empilent jusqu’à la limite de profondeur autorisée, puis l’exécution s’arrête.', 'En pratique, Python s’arrête de lui-même grâce à sa limite de profondeur.']),
        q('recursionerror', 'Que signifie une RecursionError ?',
          ['Python a trouvé une faute de syntaxe', 'Trop d’appels sont imbriqués : la limite de profondeur de la pile d’appels est dépassée', 'La fonction a retourné None', 'Le fichier du programme est trop gros'], 1,
          'Chaque appel non terminé occupe de la place dans la pile d’appels. Quand il y en a trop, Python lève une RecursionError.',
          ['Une faute de syntaxe donnerait une SyntaxError avant l’exécution.', 'Oui : trop d’appels imbriqués attendent leur fin.', 'Retourner None ne provoque aucune erreur par lui-même.', 'La taille du fichier n’a aucun lien avec cette erreur.']),
    ],
    [f('reparation', 'Explique en une phrase ce que tu as ajouté ou changé pour réparer compte_a_rebours.', 'J’ai ajouté… et j’ai remplacé… par…')],
    ['Identifie le cas de base : pour quelles valeurs de n la fonction n’a-t-elle plus rien à faire ?',
     'Identifie la réduction : sur quelle valeur doit porter l’appel récursif pour se rapprocher du cas de base ?',
     'Squelette : si n est négatif, s’arrêter ; sinon afficher n, puis appeler la fonction sur n - 1.'],
    'Une fonction récursive a un cas de base et un appel récursif sur un problème plus petit. Sans progression vers le cas de base, les appels s’empilent jusqu’à la RecursionError.',
    ['compte_a_rebours(3) affiche 3, 2, 1, 0', 'Cas de base : rien à afficher pour n < 0', 'Terminaison : compte_a_rebours(50) se termine', 'La fonction s’appelle elle-même : un appel par valeur de n'])

# ─── Étape 2 — Cas de base et appel récursif ────────────────────────────────

OUBLI_RETURN = code('''def somme(n):
    if n == 0:
        return 0
    n + somme(n - 1)''')

PRINT_AU_LIEU_DE_RETURN = code('''def somme(n):
    if n == 0:
        return 0
    print(n + somme(n - 1))''')

CAS_DE_BASE = step(
    'cas-de-base', 'Cas de base', 'Cas de base et appel récursif', 12, 'Guidé',
    ['cas de base', 'appel récursif', 'valeur de retour', 'return', 'récurrence mathématique'],
    'Cette fois la fonction calcule une valeur. Tu développes à la main ses appels, puis tu repères deux erreurs très fréquentes.',
    '<p>Voici une fonction qui calcule \\(S(n)=n+(n-1)+\\cdots+1\\), la somme des entiers de 1 à n.</p>' + SOMME_CODE
    + '<p>Son <strong>cas de base</strong> est ' + c('n == 0') + ' (la somme est 0). Son <strong>appel récursif</strong> est ' + c('somme(n - 1)') + ' : on suppose connue la somme jusqu’à n - 1, et on lui ajoute n.</p>'
    '{{q:somme-0}}'
    '<p>Pour <code>somme(1)</code>, on développe ainsi :</p>'
    + code('''somme(1)
= 1 + somme(0)
= 1 + 0
= 1''')
    + '{{f:valeur-1}}'
    '<p>Pour <code>somme(3)</code>, on construit le développement pas à pas :</p>'
    + code('''somme(3)
= 3 + somme(2)
= 3 + 2 + somme(1)
= 3 + 2 + 1 + somme(0)
= 6''')
    + '<p>À toi : écris, dans le même style, le développement de <code>somme(4)</code>, puis donne sa valeur.</p>{{f:developpe-4}}{{f:valeur-4}}'
    '<h3>À ne pas confondre : récurrence mathématique et fonction récursive</h3>'
    '<p><strong>En mathématiques</strong>, une relation de récurrence peut définir une suite : \\(u_{n+1}=f(u_n)\\).</p>'
    '<p><strong>En informatique</strong>, une fonction récursive est une fonction qui fait appel à elle-même, directement ou indirectement.</p>'
    '<p>Les deux idées sont proches : dans les deux cas, on définit un problème à partir d’un cas plus simple. Mais ce ne sont pas deux notions identiques. La récurrence est une relation entre des nombres ; la récursivité est un mécanisme d’exécution d’un programme.</p>'
    '{{q:recurrence-info}}'
    '<h3>Deux erreurs très fréquentes</h3>'
    '<p><strong>L’oubli de <code>return</code>.</strong></p>' + OUBLI_RETURN + '{{q:oubli-return}}'
    '<p><strong>Afficher au lieu de retourner.</strong></p>' + PRINT_AU_LIEU_DE_RETURN + '{{q:print-return}}'
    + METHODE,
    'Réponds aux questions, développe somme(4), puis repère les deux erreurs de return.', None,
    [
        q('somme-0', 'Que retourne somme(0) ?', ['0', '1', 'None', 'Une erreur'], 0,
          'C’est le cas de base : la somme des entiers de 1 à 0 est vide, donc 0. La fonction retourne 0 sans nouvel appel.',
          ['Oui : le cas de base retourne 0.', 'Il n’y a aucun entier à additionner : la somme est 0, pas 1.', 'Le cas de base contient bien return 0 : la fonction ne retourne pas None.', 'Aucune erreur : c’est le cas de base, traité directement.']),
        q('recurrence-info', 'Une fonction récursive en informatique et une suite définie par récurrence en mathématiques sont-elles la même chose ?',
          ['Oui : ce sont exactement deux écritures de la même notion', 'Non : les idées sont proches (un problème défini à partir d’un cas plus simple), mais l’une est un mécanisme d’exécution, l’autre une relation entre des nombres', 'Non : une fonction récursive ne peut jamais calculer une suite', 'Oui : mais seulement quand la fonction contient un print'], 1,
          'Les deux définissent quelque chose à partir d’un cas plus simple, mais ce ne sont pas des notions identiques. Une fonction récursive peut d’ailleurs calculer les termes d’une suite définie par récurrence.',
          ['Elles sont proches, pas identiques : l’une est mathématique, l’autre est un programme qui s’appelle lui-même.', 'Oui : proximité d’idée, mais deux notions distinctes.', 'Au contraire : une fonction récursive peut très bien calculer les termes d’une suite.', 'Le print n’a aucun rapport avec cette distinction.']),
        q('oubli-return', 'Avec cette version (le return est oublié devant n + somme(n - 1)), que renvoie somme(1) ?',
          ['1', 'None', '0', 'Une RecursionError'], 1,
          'La somme 1 + 0 est calculée puis jetée : sans return, la fonction ne renvoie rien, c’est-à-dire None. Pour somme(2), le calcul 2 + None provoquerait même une TypeError.',
          ['1 serait la bonne valeur, mais elle n’est jamais renvoyée.', 'Oui : la valeur calculée est perdue, la fonction renvoie None.', 'Le cas de base n’est pas utilisé par somme(1) : il l’est par l’appel somme(0), dont la valeur est jetée.', 'Les appels se terminent : le cas de base est bien atteint, il n’y a pas de RecursionError.']),
        q('print-return', 'Dans la version qui contient print(n + somme(n - 1)), pourquoi somme(3) ne permet-elle pas d’obtenir la valeur 6 dans un calcul ?',
          ['Parce que print est interdit dans une fonction récursive', 'Parce que print affiche une valeur mais ne la transmet pas à l’appelant : la fonction ne retourne rien', 'Parce que print ralentit trop la fonction', 'Parce que print convertit tous les nombres en texte'], 1,
          'print montre une valeur à l’écran ; return la transmet à l’appelant. Une fonction récursive a besoin du résultat de l’appel plus petit pour construire le sien : il faut donc return.',
          ['Aucune règle n’interdit print : le problème est qu’il ne transmet rien.', 'Oui : afficher n’est pas retourner.', 'La vitesse n’est pas en cause.', 'print ne renvoie pas une chaîne : il ne renvoie rien du tout (None).']),
    ],
    [
        f('valeur-1', 'Que vaut somme(1) ?', 'Un nombre', input='line', check=number_check(['1'], 'Oui : 1 + somme(0) = 1 + 0 = 1.', 'Reprends le développement : somme(1) = 1 + somme(0).',
                                                                                            [(['0'], 'Tu as donné la valeur du cas de base. somme(1) = 1 + somme(0) = 1 + 0.')])),
        f('developpe-4', 'Développe somme(4), ligne par ligne, comme pour somme(3).', 'somme(4)\n= 4 + somme(3)\n= …'),
        f('valeur-4', 'Que vaut somme(4) ?', 'Un nombre', input='line', check=number_check(['10'], 'Oui : 4 + 3 + 2 + 1 + 0 = 10.', 'Additionne 4 + 3 + 2 + 1 + 0.',
                                                                                              [(['6'], '6 est la valeur de somme(3). Pour somme(4), il faut encore ajouter 4.')])),
    ],
    ['Identifie le cas de base : quelle valeur de n ne demande aucun nouvel appel ?',
     'Chaque ligne du développement remplace un appel par « n + l’appel sur n - 1 », jusqu’à somme(0).',
     'Squelette : somme(4) devient 4 + somme(3), puis 4 + 3 + somme(2), et ainsi de suite jusqu’à somme(0) qui vaut 0.'],
    'Une fonction récursive se développe en une chaîne d’appels qui s’arrête au cas de base ; la valeur finale se construit avec les valeurs RETOURNÉES (return). La récurrence mathématique et la fonction récursive sont proches, mais distinctes.',
    [])

# ─── Étape 3 — Pile d'appels ─────────────────────────────────────────────────

PUISSANCE_CODE = code('''def puissance(a, n):
    if n == 0:
        return 1
    return a * puissance(a, n - 1)''')

PILE_APPELS = step(
    'pile-appels', 'Pile d’appels', 'Suivre la pile d’appels', 14, 'Guidé puis autonome',
    ['pile d’appels', 'LIFO', 'descente', 'remontée', 'trace'],
    'Quand une fonction s’appelle elle-même, plusieurs appels attendent en même temps. Tu les observes, puis tu écris toi-même le suivi des APPEL et des RETOUR.',
    '<p>Dans le TP précédent, tu as manipulé des <strong>piles</strong> : le dernier élément posé est le premier retiré (LIFO). Cette idée sert aussi à comprendre l’exécution d’un programme.</p>'
    '<p>Lorsqu’une fonction appelle une autre fonction, l’exécution doit <strong>mémoriser où elle devra revenir</strong>. Lorsqu’une fonction s’appelle elle-même, plusieurs appels sont donc <strong>temporairement empilés</strong> : c’est la <strong>pile d’appels</strong>.</p>'
    + code('''somme(4)
   ↓
somme(3)
   ↓
somme(2)
   ↓
somme(1)
   ↓
somme(0)''')
    + '<p>Puis, au retour, chaque appel termine son calcul avec la valeur que vient de lui retourner l’appel plus petit :</p>'
    + code('''somme(0) → 0
somme(1) → 1 + 0 = 1
somme(2) → 2 + 1 = 3
somme(3) → 3 + 3 = 6
somme(4) → 4 + 6 = 10''')
    + '<p>Attention : la pile d’appels n’est pas un objet Python que tu programmes toi-même. C’est l’interpréteur qui la gère. Elle sert ici à <em>comprendre</em> l’exécution.</p>'
    '{{fig:trace-somme}}'
    '<p>Utilise les boutons : repère la <strong>descente</strong> (les APPEL s’enchaînent) puis la <strong>remontée</strong> (les RETOUR rendent les valeurs).</p>'
    '{{q:ordre-fin}}{{q:profondeur}}'
    '<div class="method-box"><strong>Lien avec LIFO.</strong> Le dernier appel créé est le premier appel terminé : comme dans une pile.</div>'
    '{{q:lien-lifo}}'
    '<h3>Un deuxième exemple : la puissance</h3>' + PUISSANCE_CODE
    + '<p>Pour <code>puissance(2, 4)</code>, les appels s’enchaînent :</p>'
    + code('''puissance(2,4)
└── puissance(2,3)
    └── puissance(2,2)
        └── puissance(2,1)
            └── puissance(2,0)''')
    + '<p>Puis les retours :</p>'
    + code('''puissance(2,0) → 1
puissance(2,1) → 2 × 1 = 2
puissance(2,2) → 2 × 2 = 4
puissance(2,3) → 2 × 4 = 8
puissance(2,4) → 2 × 8 = 16''')
    + '{{fig:trace-puissance}}{{q:retour-puissance}}'
    '<h3>À toi d’écrire le suivi</h3>'
    '<p>Dans l’éditeur, <code>somme_trace</code> affiche chaque APPEL et chaque RETOUR avec un retrait proportionnel à la profondeur. Il manque l’appel récursif. Complète-le, exécute, puis vérifie : tu dois obtenir exactement la descente suivie de la remontée.</p>{{code}}'
    '{{f:descente-remontee}}',
    'Parcours les deux traces, réponds aux questions, complète somme_trace puis explique la différence entre descente et remontée.',
    S.PILE_APPELS_STARTER,
    [
        q('ordre-fin', 'Dans la trace de somme(4), quel appel se termine en premier ?',
          ['somme(4)', 'somme(0)', 'somme(2)', 'Tous se terminent en même temps'], 1,
          'Le dernier appel créé, somme(0), est le premier à retourner sa valeur : tous les autres l’attendent.',
          ['somme(4) est le premier créé : il attend la fin de tous les autres.', 'Oui : le dernier appel créé se termine en premier.', 'somme(2) attend le résultat de somme(1), qui attend celui de somme(0).', 'Les appels se terminent un par un, dans l’ordre inverse de leur création.']),
        q('profondeur', 'Combien d’appels sont empilés en même temps, au maximum, pendant somme(4) ?',
          ['4', '5', '1', '10'], 1,
          'Au plus bas de la descente, somme(4), somme(3), somme(2), somme(1) et somme(0) sont tous en attente : 5 appels.',
          ['Il faut compter aussi somme(0), le cas de base.', 'Oui : somme(4), somme(3), somme(2), somme(1), somme(0).', 'Un seul appel serait empilé si la fonction n’était pas récursive.', '10 est la valeur retournée, pas le nombre d’appels.']),
        q('lien-lifo', 'Pourquoi dit-on pile d’appels ?',
          ['Parce que le premier appel créé est le premier terminé (FIFO)', 'Parce que le dernier appel créé est le premier terminé (LIFO), comme dans une pile', 'Parce que les appels sont triés par ordre alphabétique', 'Parce que Python stocke chaque appel dans une list que tu dois programmer'], 1,
          'Dernier entré, premier sorti : c’est exactement la règle d’une pile. Le programmeur n’a pas à la coder : l’interpréteur s’en charge.',
          ['Ce serait le comportement d’une file, pas d’une pile.', 'Oui : LIFO.', 'Aucun tri alphabétique n’intervient.', 'La pile d’appels est gérée par l’interpréteur : tu ne la programmes pas.']),
        q('retour-puissance', 'Dans la trace de puissance(2, 4), quelle valeur retourne puissance(2, 3) ?',
          ['16', '4', '8', '2'], 2,
          'puissance(2, 3) = 2 × puissance(2, 2) = 2 × 4 = 8. C’est puissance(2, 4) qui retourne 16.',
          ['16 est la valeur retournée par puissance(2, 4), l’appel initial.', '4 est la valeur retournée par puissance(2, 2).', 'Oui : 2 × 4 = 8.', '2 est la valeur retournée par puissance(2, 1).']),
    ],
    [f('descente-remontee', 'Avec tes mots : quelle différence y a-t-il entre la descente dans les appels et la remontée des valeurs retournées ?', 'Pendant la descente… Pendant la remontée…')],
    ['Identifie le cas de base : il est déjà écrit (n == 0). Que fait-on alors ? Quel retrait faut-il pour l’appel suivant ?',
     'Identifie la réduction : l’appel plus petit est somme_trace(n - 1, …). Que doit devenir la profondeur ?',
     'Squelette : resultat reçoit n plus la valeur retournée par somme_trace sur n - 1, avec une profondeur augmentée de 1.'],
    'Une fonction récursive empile ses appels pendant la descente, puis les termine dans l’ordre inverse pendant la remontée : le dernier appel créé est le premier terminé, comme dans une pile (LIFO).',
    ['Les APPEL et RETOUR de somme_trace(3), avec leur retrait', 'somme_trace renvoie la même valeur que somme', 'Tous les APPEL précèdent tous les RETOUR (descente puis remontée)', 'Profondeur de la pile : n + 1 appels simultanés'],
    figures=[trace('trace-somme', 'somme', [4], 'Trace de somme(4) : APPEL, RETOUR et pile d’appels'),
             trace('trace-puissance', 'puissance', [2, 4], 'Trace de puissance(2, 4) : change les valeurs et recommence')])

# ─── Étape 4 — Écrire ses premières fonctions ───────────────────────────────

F1 = code('''def f(n):
    return f(n - 1)''')
F2 = code('''def f(n):
    if n == 0:
        return 0
    return f(n)''')
F3 = code('''def f(n):
    if n == 0:
        return 0
    return f(n + 1)''')

ECRIRE = step(
    'ecrire', 'Écrire', 'Écrire ses premières fonctions récursives', 16, 'Guidé puis autonome',
    ['somme', 'factorielle', 'puissance', 'terminaison', 'cas de base'],
    'Tu écris trois fonctions récursives : somme, factorielle, puissance. Pour chacune, tu raisonnes d’abord (cas de base, réduction), puis seulement ensuite tu écris le code.',
    '<p>Avant d’écrire, entraîne ton œil : trois fonctions sont défectueuses, chacune de façon différente.</p>'
    + F1 + '{{q:defaut-sans-base}}' + F2 + '{{q:defaut-sans-progression}}'
    + '<p>Pour la dernière, on suppose que l’objectif est de descendre vers 0, par exemple avec <code>f(3)</code>.</p>' + F3 + '{{q:defaut-mauvais-sens}}'
    + METHODE
    + '<h3>La factorielle en bref</h3>'
    '<p>La factorielle de n, notée \\(n!\\), est le produit des entiers de 1 à n : \\(4!=4\\times 3\\times 2\\times 1=24\\). Par convention, \\(0!=1\\) : c’est ce qui permet d’écrire \\(n!=n\\times (n-1)!\\) pour tout n ≥ 1, jusqu’à 1.</p>'
    '{{f:zero-fact}}'
    '<h3>Les trois exercices</h3>'
    '<p>Pour <strong>chacune</strong> des trois fonctions (somme, factorielle, puissance), commence par répondre ici, <em>avant</em> d’écrire le code :</p>'
    '{{f:cas-de-base}}{{f:reduction}}'
    '<p>Écris ensuite les trois fonctions dans l’éditeur. Les contrôles te disent pour chacune si les valeurs sont justes <em>et</em> si la fonction s’appelle bien elle-même.</p>{{code}}'
    '{{f:terminaison}}',
    'Repère les trois défauts, réponds aux champs de raisonnement, écris les trois fonctions et vérifie-les.',
    S.ECRIRE_STARTER,
    [
        q('defaut-sans-base', 'Quel est le défaut de la première fonction, f(n) qui retourne f(n - 1) ?',
          ['Elle n’a pas de cas de base : rien n’arrête les appels', 'L’appel porte sur n au lieu de n - 1', 'Elle contient un print en trop', 'Elle devrait être écrite avec une boucle'], 0,
          'Sans cas de base, chaque appel en crée un nouveau, indéfiniment : la limite de profondeur est dépassée et Python lève une RecursionError.',
          ['Oui : il manque la situation simple qui arrête la récursion.', 'Ici l’appel porte bien sur n - 1 : c’est le cas de base qui manque.', 'Il n’y a aucun print dans cette fonction.', 'Une boucle n’est pas nécessaire : la récursion convient, mais il lui faut un cas de base.']),
        q('defaut-sans-progression', 'Quel est le défaut de la deuxième fonction (cas de base n == 0, puis return f(n)) ?',
          ['Le cas de base est faux', 'Il manque un return', 'L’appel récursif porte sur le même problème : aucune progression vers le cas de base', 'La fonction n’a pas de paramètre'], 2,
          'Pour n différent de 0, f(n) rappelle f(n) : exactement le même problème, sans jamais s’en rapprocher du cas de base.',
          ['Le cas de base est correct pour n == 0 : c’est l’appel qui ne progresse pas.', 'Il y a bien un return dans chaque branche.', 'Oui : f(n) rappelle f(n), sans progresser.', 'La fonction a bien un paramètre, n.']),
        q('defaut-mauvais-sens', 'Quel est le défaut de la troisième fonction (return f(n + 1), pour un appel f(3)) ?',
          ['n s’éloigne de 0 : le cas de base n’est jamais atteint', 'Le cas de base est incorrect', 'f(n + 1) est interdit par Python', 'La fonction termine mais retourne 0'], 0,
          'f(3) appelle f(4), puis f(5)… : on s’éloigne du cas de base n == 0 au lieu de s’en rapprocher. La fonction ne termine pas.',
          ['Oui : la progression se fait dans le mauvais sens.', 'Le cas de base n == 0 est correct ; c’est l’appel qui s’en éloigne.', 'Python n’interdit rien : c’est la logique qui est fausse.', 'Elle ne termine pas : elle ne retourne jamais 0 pour n = 3.']),
    ],
    [
        f('zero-fact', 'Que vaut 0! ?', 'Un nombre', input='line', check=number_check(['1'], 'Oui : par convention 0! = 1. C’est le cas de base de la factorielle.', 'Rappelle-toi la convention : 0! n’est pas 0.',
                                                                                         [(['0'], 'Par convention, 0! = 1 (le produit « vide »). C’est ce qui rend n! = n × (n - 1)! valable pour n = 1.')])),
        f('cas-de-base', 'Quel est le cas de base de chacune des trois fonctions (somme, factorielle, puissance) ?', 'somme : … ; factorielle : … ; puissance : …'),
        f('reduction', 'Comment chacune ramène-t-elle son problème à un problème plus petit ? Que fait-elle de la valeur retournée par l’appel récursif ?', 'somme(n) = n + … ; factorielle(n) = … ; puissance(a, n) = …'),
        f('terminaison', 'Pour puissance(a, n) avec n ≥ 0, pourquoi les appels finissent-ils toujours ?', 'À chaque appel, n… jusqu’à…'),
    ],
    ['Identifie le cas de base : pour quelle valeur de n la réponse est-elle immédiate (0 pour la somme, 1 pour la factorielle et la puissance) ?',
     'Identifie la réduction : chaque fonction se ramène au même problème avec n - 1, puis combine ce résultat avec n (ou avec a).',
     'Squelette : si n vaut 0, retourner la valeur de base ; sinon retourner n combiné (par + ou ×) avec l’appel sur n - 1.'],
    'Avant d’écrire : cas de base, réduction, terminaison, valeur retournée. Une fonction récursive correcte se reconnaît à ses valeurs, mais aussi au fait qu’elle s’appelle réellement elle-même sur un problème plus petit.',
    ['somme : cas de base somme(0) = 0', 'somme : somme(1), somme(3), somme(5), somme(10)', 'somme : la fonction s’appelle elle-même',
     'factorielle : 0! = 1 et 1! = 1', 'factorielle : 3!, 5!, 6!', 'factorielle : la fonction s’appelle elle-même',
     'puissance : cas de base a puissance 0 = 1', 'puissance : 2 puissance 1, 2 puissance 5, 3 puissance 3, 10 puissance 4', 'puissance : la fonction s’appelle elle-même',
     'Terminaison : somme(60), factorielle(20) et puissance(2, 60) se terminent'])

# ─── Étape 5 — Chaînes et listes ─────────────────────────────────────────────

STRUCTURES = step(
    'structures', 'Chaînes et listes', 'Récursivité sur des chaînes et des listes', 16, 'Guidé puis autonome',
    ['chaîne', 'liste', 'tranche', 'palindrome', 'copie de liste'],
    'La récursivité ne concerne pas que les nombres : une chaîne ou une liste devient « plus petite » quand on lui retire un élément.',
    '<p>Jusqu’ici, le problème diminuait parce qu’un nombre diminuait. Une <strong>chaîne</strong> ou une <strong>liste</strong> peut aussi devenir plus petite : on en retire un élément. Le raisonnement reste le même.</p>'
    + METHODE
    + '<h3>Longueur d’une chaîne</h3>'
    '<p>On ne remplace pas <code>len</code> en pratique : l’objectif ici est de comprendre le raisonnement.</p>'
    + code('''longueur("NSI")
= 1 + longueur("SI")
= 1 + 1 + longueur("I")
= 1 + 1 + 1 + longueur("")
= 3''')
    + '{{q:longueur-base}}'
    '<h3>Palindrome</h3>'
    '<p>Un palindrome se lit pareil dans les deux sens : <code>"radar"</code>, <code>"kayak"</code> sont des palindromes, <code>"python"</code> n’en est pas un. Construis le raisonnement avant d’écrire du code :</p>'
    '<ul><li>une chaîne <strong>vide</strong> ou d’<strong>un seul caractère</strong> est un palindrome : c’est le cas de base ;</li>'
    '<li>sinon, on compare le <strong>premier</strong> et le <strong>dernier</strong> caractère ;</li>'
    '<li>s’ils sont égaux, on recommence sur l’<strong>intérieur</strong> de la chaîne ; sinon, la réponse est immédiate.</li></ul>'
    '{{q:pal-base}}{{q:pal-interieur}}{{f:pal-raisonnement}}'
    '<h3>Somme des éléments d’une liste</h3>'
    + code('''somme_liste([4, 7, 2])
= 4 + somme_liste([7, 2])
= 4 + 7 + somme_liste([2])
= 4 + 7 + 2 + somme_liste([])
= 13''')
    + '{{q:liste-base}}'
    '<p><strong>Attention aux copies.</strong> L’expression <code>tab[1:]</code> crée une <em>nouvelle</em> liste, sans le premier élément. C’est lisible et correct, mais recopier la liste à chaque appel n’est pas forcément la solution la plus efficace : une autre écriture, avec un indice, évite ces copies. Nous n’approfondissons pas ici.</p>'
    '{{q:tranche}}'
    '<p>À toi d’écrire les trois fonctions. Les contrôles vérifient aussi que ta fonction s’appelle bien elle-même et qu’elle ne modifie pas la liste reçue.</p>{{code}}',
    'Réponds aux questions, écris le raisonnement du palindrome, puis les trois fonctions, et vérifie-les.',
    S.STRUCTURES_STARTER,
    [
        q('longueur-base', 'Quel est le cas de base de longueur(texte) ?',
          ['texte vaut "NSI"', 'texte est la chaîne vide : sa longueur est 0', 'texte contient exactement un caractère et un seul', 'Il n’y a pas de cas de base : on appelle toujours longueur'], 1,
          'La chaîne vide est la situation la plus simple : sa longueur est 0, sans nouvel appel. Sinon, on retire un caractère et on ajoute 1.',
          ['"NSI" est un exemple d’appel, pas un cas de base général.', 'Oui : la chaîne vide, de longueur 0.', 'Un seul caractère se traite aussi par un appel sur la chaîne vide : ce n’est pas obligatoire comme cas de base.', 'Sans cas de base, les appels ne s’arrêteraient jamais.']),
        q('pal-base', 'Pour est_palindrome, quels cas peut-on traiter directement, sans appel récursif ?',
          ['Seulement la chaîne vide', 'La chaîne vide et la chaîne d’un seul caractère : toujours vrai', 'Les chaînes de deux caractères', 'Les chaînes qui commencent par une voyelle'], 1,
          'Une chaîne vide ou d’un seul caractère se lit forcément pareil dans les deux sens : la réponse est True.',
          ['La chaîne d’un seul caractère est aussi un palindrome, et il est utile de la traiter directement.', 'Oui : ce sont les deux cas les plus simples.', 'Pour deux caractères, il faut comparer le premier et le dernier.', 'La première lettre n’a aucune importance pour décider si un mot est un palindrome.']),
        q('pal-interieur', 'Si le premier et le dernier caractère sont égaux, que faut-il faire ensuite ?',
          ['Renvoyer True immédiatement', 'Tester l’intérieur de la chaîne, c’est-à-dire sans ces deux caractères', 'Recommencer avec la même chaîne', 'Inverser la chaîne'], 1,
          'Égaux aux deux bouts ne suffit pas : il faut que l’intérieur soit aussi un palindrome. C’est l’appel récursif, sur une chaîne plus courte.',
          ['"abca" a le même premier et dernier caractère mais n’est pas un palindrome.', 'Oui : l’appel récursif porte sur l’intérieur, plus court de deux caractères.', 'Recommencer avec la même chaîne ne progresse pas vers le cas de base.', 'Inverser la chaîne ne serait pas récursif et n’est pas nécessaire.']),
        q('liste-base', 'Que vaut somme_liste([]) ?',
          ['None', '1', '0', 'Une IndexError'], 2,
          'La somme d’une liste vide est 0 : c’est le cas de base, et c’est aussi l’élément neutre de l’addition.',
          ['Le cas de base doit retourner une valeur, pas None.', '1 ajouterait un élément qui n’existe pas.', 'Oui : 0.', 'Aucun accès à un indice n’est nécessaire pour une liste vide.']),
        q('tranche', 'Que fait l’expression tab[1:] ?',
          ['Elle retire le premier élément de tab', 'Elle renvoie l’indice 1', 'Elle crée une nouvelle liste contenant tous les éléments sauf le premier', 'Elle renvoie le premier élément'], 2,
          'tab[1:] est une tranche : une nouvelle liste (copie) sans le premier élément. tab, elle, n’est pas modifiée.',
          ['Une tranche ne modifie pas tab : elle en crée une copie.', 'tab[1] serait l’élément d’indice 1 ; avec « : », on obtient une liste.', 'Oui : une nouvelle liste, tab reste intacte.', 'Le premier élément s’obtient avec tab[0].']),
    ],
    [f('pal-raisonnement', 'Avant de coder : écris en français les trois situations que doit traiter est_palindrome (cas de base, désaccord, accord).', 'Si la chaîne… alors… Sinon, si le premier et le dernier… Sinon…')],
    ['Identifie le cas de base : quel est le plus petit problème, et que vaut sa réponse ? (chaîne vide pour longueur ; liste vide pour somme_liste ; au plus un caractère pour est_palindrome).',
     'Identifie la réduction : une chaîne sans son premier caractère s’écrit texte[1:] ; sans ses deux extrémités, texte[1:-1] ; une liste sans son premier élément, tab[1:].',
     'Squelette : si le problème est minimal, retourner la réponse directe ; sinon combiner le premier élément avec le résultat de l’appel sur le reste.'],
    'Une chaîne ou une liste se réduit en lui retirant un élément. Le cas de base est la structure vide (ou minimale) ; une tranche crée une copie, ce qui est lisible mais pas toujours le plus efficace.',
    ['longueur : cas de base et valeurs', 'longueur : la fonction s’appelle elle-même',
     'est_palindrome : les palindromes renvoient True', 'est_palindrome : les autres mots renvoient False', 'est_palindrome : la fonction s’appelle elle-même',
     'somme_liste : cas de base et valeurs', 'somme_liste : la liste reçue n’est pas modifiée', 'somme_liste : la fonction s’appelle elle-même'])

# ─── Étape 6 — Itératif ou récursif ? ────────────────────────────────────────

FACT_ITER = code('''def factorielle_iterative(n):
    resultat = 1
    for k in range(1, n + 1):
        resultat *= k
    return resultat''')

FACT_REC = code('''def factorielle_recursive(n):
    if n == 0:
        return 1
    return n * factorielle_recursive(n - 1)''')

ITERATIF = step(
    'iteratif', 'Itératif ou récursif', 'Itératif ou récursif ?', 10, 'Guidé',
    ['itération', 'récursivité', 'pile d’appels', 'coût'],
    'Une même fonction peut s’écrire avec une boucle ou avec la récursivité. Tu compares les deux, puis tu écris la version itérative d’une fonction récursive.',
    '<p>Deux versions de la même fonction.</p><p><strong>Itérative</strong> :</p>' + FACT_ITER + '<p><strong>Récursive</strong> :</p>' + FACT_REC
    + '{{q:meme-resultat}}{{q:boucle}}{{q:pile}}{{q:definition}}'
    '<h3>Le coût de la récursivité</h3>'
    '<p>Chaque appel récursif crée un nouvel appel et utilise de la mémoire dans la pile d’appels. En Python, une récursion très profonde provoque une <code>RecursionError</code> : Python ne la « transforme » pas en boucle. Une boucle, elle, n’empile rien.</p>'
    '{{q:cout}}{{q:meilleure}}'
    '<p>À toi : dans l’éditeur, <code>puissance_recursive</code> est fournie. Écris <code>puissance_iterative</code> avec une boucle. Le dernier contrôle te fait constater la différence de coût.</p>{{code}}'
    '{{f:choix}}',
    'Compare les deux versions, écris puissance_iterative et justifie quand préférer chaque écriture.',
    S.ITERATIF_STARTER,
    [
        q('meme-resultat', 'factorielle_iterative(5) et factorielle_recursive(5) donnent-elles le même résultat ?',
          ['Non : la version récursive renvoie 24', 'Oui : 120 dans les deux cas', 'Non : la version itérative renvoie None', 'Cela dépend de la machine'], 1,
          'Les deux calculent 5! = 120 : ce sont deux manières d’écrire le même calcul.',
          ['La version récursive renvoie bien 120.', 'Oui : même fonction mathématique, deux écritures.', 'La version itérative contient bien un return.', 'Le résultat ne dépend pas de la machine.']),
        q('boucle', 'Laquelle des deux versions utilise explicitement une boucle ?',
          ['La version récursive', 'Aucune des deux', 'Les deux', 'La version itérative'], 3,
          'La version itérative contient une boucle for ; la version récursive n’en contient aucune : la répétition vient des appels.',
          ['La version récursive répète grâce aux appels, pas à une boucle.', 'Il y a bien une boucle dans l’une des deux.', 'La version récursive n’en a pas.', 'Oui : le for.']),
        q('pile', 'Laquelle des deux versions utilise la pile d’appels pour se répéter ?',
          ['La version itérative', 'La version récursive', 'Les deux de la même façon', 'Aucune des deux'], 1,
          'Chaque appel récursif est empilé en attendant le résultat du suivant ; la boucle, elle, répète sans empiler.',
          ['La boucle reste dans un seul appel : rien n’est empilé.', 'Oui : un appel par valeur de n.', 'Une seule des deux empile des appels.', 'Toute fonction appelée occupe un cadre dans la pile, et ici il y en a plusieurs pour la récursive.']),
        q('definition', 'Laquelle traduit le plus directement la définition n! = n × (n - 1)! avec 0! = 1 ?',
          ['La version récursive', 'La version itérative', 'Aucune', 'Les deux au même niveau'], 0,
          'La version récursive recopie la définition mathématique : cas de base 0! = 1, puis n! = n × (n - 1)!.',
          ['Oui : elle suit la définition ligne à ligne.', 'La version itérative calcule le produit 1 × 2 × … × n, ce qui est équivalent mais moins direct.', 'Une des deux est plus proche de la définition.', 'Elles ne sont pas équivalentes en lisibilité par rapport à cette définition.']),
        q('cout', 'Pourquoi puissance_recursive(2, 1000) provoque-t-elle une RecursionError dans cet atelier alors que puissance_iterative(2, 1000) fonctionne ?',
          ['Parce que 2 puissance 1000 est un nombre trop grand pour Python', 'Parce que 1000 appels sont empilés en même temps et dépassent la limite de profondeur, alors que la boucle n’empile rien', 'Parce que la récursivité est interdite pour n ≥ 100', 'Parce que la boucle est plus rapide'], 1,
          'La limite porte sur le nombre d’appels imbriqués : dans cet atelier, Nexus la fixe volontairement à 200 (Python standard : environ 1 000, ce qui reste largement inférieur à des milliers d’appels). La version récursive en empile 1 001 ; la version itérative en utilise un seul.',
          ['Python sait calculer 2 puissance 1000 : le nombre n’est pas le problème.', 'Oui : c’est la profondeur de la pile d’appels.', 'Aucune interdiction de ce genre n’existe : c’est une limite de profondeur.', 'La vitesse n’est pas en cause ici.']),
        q('meilleure', 'Une solution récursive est-elle toujours meilleure qu’une solution itérative ?',
          ['Oui : elle est toujours plus courte', 'Oui : elle consomme moins de mémoire', 'Non : l’itérative est toujours meilleure', 'Non : on choisit selon la structure du problème et son coût'], 3,
          'Ni l’une ni l’autre n’est automatiquement meilleure. Une structure naturellement récursive (dossiers imbriqués, arbres) s’écrit plus clairement en récursif ; un simple parcours s’écrit très bien avec une boucle.',
          ['Plus courte n’est pas toujours plus claire ni plus efficace.', 'La récursivité consomme au contraire de la mémoire (pile d’appels).', 'L’itératif n’est pas toujours meilleur non plus : pour des structures imbriquées, le récursif est souvent plus naturel.', 'Oui : on choisit la solution adaptée.']),
    ],
    [f('choix', 'Donne un cas où tu choisirais plutôt une écriture récursive, et un cas où tu choisirais plutôt une boucle. Justifie.', 'Récursif quand… Boucle quand…')],
    ['Rappel : une boucle for k in range(n) répète n fois ; il faut un accumulateur qui démarre à la valeur du cas de base.',
     'La valeur du cas de base (a puissance 0 = 1) donne le départ de l’accumulateur ; chaque tour ramène le calcul d’un cran plus près de n tours, en multipliant par a.',
     'Squelette : résultat vaut 1 au départ ; répéter n fois « résultat reçoit résultat fois a » ; retourner résultat.'],
    'Récursif et itératif sont deux écritures possibles. La récursivité suit la structure du problème mais empile des appels (coût, RecursionError) ; la boucle n’empile rien. Aucune n’est meilleure par principe.',
    ['puissance_iterative : valeurs', 'Mêmes résultats que la version récursive', 'La version itérative n’utilise aucun appel récursif', 'Sans pile d’appels : puissance_iterative(2, 1000) fonctionne'])

# ─── Étape 7 — Mission autonome ──────────────────────────────────────────────

DOSSIER_CODE = code('''dossier = [
    "cours.pdf",
    [
        "tp.py",
        "correction.pdf",
    ],
    "notes.txt",
]''')

MISSION = step(
    'mission', 'Mission', 'Mission : explorer un dossier imaginaire', 18, 'Transfert',
    ['structure imbriquée', 'parcours récursif', 'cas de base', 'inverse d’une chaîne'],
    'Tu comptes les fichiers d’un dossier qui contient d’autres dossiers : un problème naturellement récursif. Puis tu inverses une chaîne en autonomie.',
    '<p>Un dossier contient des fichiers et d’autres dossiers, qui contiennent eux-mêmes des fichiers et des dossiers… Pour l’ordinateur, on le représente ainsi : un <strong>fichier</strong> est une chaîne, un <strong>dossier</strong> est une liste d’éléments.</p>'
    + DOSSIER_CODE
    + '<p>Ce dossier contient 4 fichiers : <code>cours.pdf</code>, <code>tp.py</code>, <code>correction.pdf</code>, <code>notes.txt</code>. Ce problème est <em>naturellement récursif</em> : le contenu d’un dossier est composé de problèmes plus petits (les fichiers et les sous-dossiers).</p>'
    '{{q:fichier-ou-dossier}}'
    '<h3>Échauffement : des nombres imbriqués</h3>'
    '<p>Commence par une version plus simple : compter les <em>nombres</em> d’une liste imbriquée comme <code>[1, [2, 3], [4, [5, 6]]]</code>, qui en contient 6. C’est le même raisonnement, sans le vocabulaire des fichiers.</p>'
    + METHODE
    + '{{q:cas-de-base}}'
    '<h3>La mission</h3>'
    '<p>Dans l’éditeur, trois parties :</p>'
    '<ul><li><strong>A.</strong> <code>compter_elements(x)</code> : compte les nombres d’une liste imbriquée (échauffement).</li>'
    '<li><strong>B.</strong> <code>compter_fichiers(element)</code> : compte tous les fichiers d’un dossier, quel que soit le niveau d’imbrication.</li>'
    '<li><strong>C.</strong> <code>inverse(texte)</code> : renvoie la chaîne à l’envers, <code>inverse("NSI")</code> donne <code>"ISN"</code>. À faire en autonomie.</li></ul>'
    '{{code}}{{f:cas-de-base-dossier}}{{f:inverse-raisonnement}}'
    '<p>Cette mission prépare les <strong>arbres</strong>, les <strong>parcours récursifs</strong> et les <strong>structures imbriquées</strong>, que tu retrouveras plus tard.</p>',
    'Réponds aux questions, écris les trois fonctions, vérifie-les, puis décris ton raisonnement.',
    S.MISSION_STARTER,
    [
        q('fichier-ou-dossier', 'Dans cette modélisation, comment distingue-t-on un fichier d’un dossier ?',
          ['Un fichier est une liste, un dossier est une chaîne', 'Un fichier est une chaîne, un dossier est une liste', 'On ne peut pas les distinguer', 'Un dossier est toujours un nombre'], 1,
          'Un fichier est une chaîne (son nom) ; un dossier est une liste de fichiers et d’autres dossiers. On les distingue avec isinstance(x, list).',
          ['C’est l’inverse : le dossier contient d’autres éléments, c’est donc la liste.', 'Oui : chaîne pour un fichier, liste pour un dossier.', 'On peut les distinguer par leur type, avec isinstance.', 'Un nombre ne représente ni l’un ni l’autre ici.']),
        q('cas-de-base', 'Pour compter_fichiers, quel est le cas de base ?',
          ['L’élément est un dossier vide uniquement', 'Il n’y en a pas : on appelle toujours compter_fichiers', 'L’élément est un fichier (une chaîne) : il compte pour 1', 'L’élément est le premier de la liste'], 2,
          'Un fichier est le plus petit élément possible : il compte pour 1, sans nouvel appel. Un dossier vide se traite naturellement : 0 fichier.',
          ['Un dossier vide contient 0 fichier, mais ce n’est pas le seul cas simple : un fichier seul aussi.', 'Sans cas de base, la récursion ne s’arrêterait jamais.', 'Oui : un fichier compte pour 1.', 'La place dans la liste n’a pas de rôle dans le cas de base.']),
    ],
    [
        f('cas-de-base-dossier', 'Dans compter_fichiers : quel est le cas de base, et sur quoi porte l’appel récursif ?', 'Cas de base : … Appel récursif : …'),
        f('inverse-raisonnement', 'Pour inverse(texte) : comment ramènes-tu le problème à un problème plus petit, et comment utilises-tu le résultat obtenu ?', 'inverse(texte) = … + …'),
    ],
    ['Identifie le cas de base : un fichier (qui n’est pas une liste) compte pour 1 ; pour inverse, la chaîne vide s’inverse en elle-même.',
     'Identifie la réduction : un dossier est une liste d’éléments, chacun étant un fichier ou un dossier plus petit ; pour inverse, retire un caractère.',
     'Squelette : si ce n’est pas une liste, retourner 1 ; sinon additionner les résultats de l’appel sur chaque élément. Pour inverse : le reste inversé, puis le caractère retiré placé à la fin.'],
    'Une structure imbriquée se parcourt naturellement par récursivité : un élément simple est le cas de base, un élément composé se traite en traitant chacun de ses éléments.',
    ['compter_elements : cas simples et listes imbriquées', 'compter_elements : la fonction s’appelle elle-même',
     'compter_fichiers : le dossier de l’énoncé contient 4 fichiers', 'compter_fichiers : fichier seul, dossiers vides, imbrications profondes',
     'compter_fichiers : le dossier reçu n’est pas modifié', 'compter_fichiers : la fonction s’appelle elle-même',
     'inverse : cas de base et valeurs', 'inverse : la fonction s’appelle elle-même'])

# ─── Étape 8 — Synthèse ──────────────────────────────────────────────────────

FICHE = (
    '<h3>Une fonction récursive</h3>'
    '<p>Une fonction qui s’appelle elle-même, directement ou indirectement.</p>'
    '<h3>Elle doit posséder</h3>'
    '<ol><li>un <strong>cas de base</strong> ;</li><li>un <strong>appel sur un problème plus petit</strong> ;</li><li>une <strong>progression</strong> vers le cas de base.</li></ol>'
    '<h3>Exemple</h3>' + SOMME_CODE
    + '<h3>Questions à toujours se poser</h3>'
    '<ul><li>Pourquoi cette fonction finit-elle ?</li><li>Que doit retourner l’appel récursif pour que je puisse construire ma réponse ?</li></ul>'
    '<h3>La pile d’appels</h3>'
    + code('''Appels :
f(3)
→ f(2)
→ f(1)
→ f(0)

Retours :
f(0)
→ f(1)
→ f(2)
→ f(3)''')
    + '<p><strong>Dernier appel créé = premier appel terminé</strong> : logique de pile, LIFO.</p>'
    '<h3>Erreurs fréquentes</h3>'
    '<ul><li>Pas de cas de base.</li><li>Appel sur le même problème (pas de progression).</li><li>Progression dans le mauvais sens.</li><li>Oubli de <code>return</code>.</li><li>Afficher (<code>print</code>) au lieu de retourner (<code>return</code>).</li></ul>'
    '<h3>Itératif ou récursif ?</h3>'
    '<p>Ni l’un ni l’autre n’est meilleur par principe : on choisit selon la structure du problème. La récursivité empile des appels (coût, <code>RecursionError</code>) ; une boucle n’empile rien.</p>'
    '<h3>Récurrence et récursivité</h3>'
    '<p>Proches (un problème défini à partir d’un cas plus simple) mais distinctes : la récurrence relie des nombres, la fonction récursive est un mécanisme d’exécution.</p>'
    '<h3>La suite</h3>'
    + code('''Récursivité
   │
   ├── Diviser pour régner
   │
   ├── Arbres
   │
   ├── Parcours en profondeur
   │
   └── Certains problèmes d'optimisation''')
    + '<p>Ces chapitres ne sont pas encore étudiés : la récursivité en est la première brique.</p>'
)

SYNTHESE = step(
    'synthese', 'Synthèse', 'Synthèse : ce qu’il faut retenir', 8, 'Consolidation',
    ['synthèse', 'cas de base', 'terminaison', 'pile d’appels'],
    'Dernière étape : la fiche à garder, quelques questions pour fixer l’essentiel, et une phrase de bilan.',
    FICHE,
    'Relis la fiche (tu peux l’imprimer), réponds aux quatre questions, puis rédige ton bilan.', None,
    [
        q('bilan-trois', 'Que doit posséder toute fonction récursive correcte ?',
          ['Une boucle et un compteur', 'Un cas de base, un appel sur un problème plus petit, et une progression vers le cas de base', 'Seulement un appel à elle-même', 'Un print dans chaque branche'], 1,
          'Sans cas de base, les appels ne s’arrêtent pas ; sans problème plus petit, il n’y a pas de progression ; sans appel, la fonction n’est pas récursive.',
          ['Une fonction récursive peut se passer de boucle : la répétition vient des appels.', 'Oui : les trois éléments sont nécessaires.', 'Un appel à elle-même seul ne suffit pas : il faut un arrêt et une progression.', 'Le print n’a aucun rôle dans la correction d’une fonction récursive.']),
        q('bilan-pile', 'Dans f(3) → f(2) → f(1) → f(0), quel appel se termine le premier ?',
          ['f(3)', 'f(2)', 'f(1)', 'f(0)'], 3,
          'Le dernier appel créé, f(0), est le premier à se terminer : logique de pile (LIFO).',
          ['f(3) est le premier créé : il se termine en dernier.', 'f(2) attend le retour de f(1).', 'f(1) attend le retour de f(0).', 'Oui : f(0) se termine en premier.']),
        q('bilan-finit', 'Pourquoi une fonction récursive correcte finit-elle ?',
          ['Parce que Python arrête toujours les fonctions au bout de quelques appels', 'Parce qu’à chaque appel le problème diminue, jusqu’à atteindre le cas de base', 'Parce qu’elle retourne une valeur', 'Parce qu’elle utilise return'], 1,
          'La terminaison vient de la progression : si le problème diminue à chaque appel, il finit par atteindre le cas de base.',
          ['Python ne sauve pas une fonction mal écrite : il lève une RecursionError.', 'Oui : le problème diminue jusqu’au cas de base.', 'Retourner une valeur ne garantit pas la fin des appels.', 'return seul ne garantit pas non plus la fin.']),
        q('bilan-choix', 'Pour compter tous les fichiers d’un dossier contenant des sous-dossiers de profondeur quelconque, que choisis-tu en général ?',
          ['Une écriture récursive, car la structure est elle-même imbriquée', 'Une boucle for obligatoirement, la récursivité étant interdite', 'Une écriture récursive uniquement si le dossier est vide', 'Aucune solution n’existe'], 0,
          'Un dossier contient des dossiers : la structure du problème est récursive, donc la solution récursive la traduit directement.',
          ['Oui : la structure est imbriquée.', 'La récursivité n’est jamais interdite.', 'Un dossier vide se traite par le cas de base, mais la récursivité sert surtout pour les dossiers imbriqués.', 'La mission a justement montré une solution.']),
    ],
    [f('bilan', 'En quelques phrases, explique à un camarade qui découvre la récursivité comment on construit une fonction récursive.', 'D’abord je cherche… Ensuite…')],
    ['Reprends le cadre « Comment construire une fonction récursive ? » : cas de base, appel plus petit, terminaison, valeur retournée.'],
    'Cas de base + appel sur un problème plus petit + progression vers le cas de base : c’est ce qui rend une fonction récursive correcte. La pile d’appels garde les appels en attente ; le dernier créé est le premier terminé.',
    [], printable=True)

# ─── Bonus ───────────────────────────────────────────────────────────────────

FIB_CODE = code('''def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)''')

BONUS = step(
    'bonus', 'Bonus', 'Pour aller plus loin : dichotomie, Fibonacci et arbres', 0, 'Facultatif, hors des 120 min',
    ['dichotomie', 'diviser pour régner', 'appels répétés', 'efficacité'],
    'Facultatif. Un problème dont la taille est divisée par deux à chaque appel, puis une fonction correcte mais inefficace.',
    '<h3>Le maximum d’une liste</h3>'
    '<p>Écris <code>maximum(tab)</code> pour une liste non vide : le cas de base est la liste d’un seul élément.</p>'
    '<h3>Recherche dichotomique récursive</h3>'
    '<p>Dans une liste <strong>triée</strong>, on regarde l’élément du milieu. S’il est trop petit, la valeur cherchée est dans la moitié droite ; trop grand, dans la moitié gauche. À chaque appel, la plage de recherche est <strong>à peu près divisée par deux</strong>. Cette idée annonce le thème « diviser pour régner ».</p>'
    '<p><code>indice_dicho(tab, x, debut, fin)</code> cherche x entre les indices <code>debut</code> et <code>fin</code> (inclus) et renvoie son indice, ou -1.</p>'
    '{{q:dicho-base}}{{q:dicho-moitie}}{{code}}{{f:dicho-division}}'
    '<h3>Fibonacci : une récursion correcte mais inefficace</h3>'
    '<p>Fibonacci n’est pas un bon premier exemple de récursivité, parce qu’il y a <strong>deux</strong> appels récursifs. C’est en revanche un bon contre-exemple.</p>' + FIB_CODE
    + '{{fig:trace-fib}}'
    '<p>Observe les calculs répétés : <code>fibonacci(2)</code>, <code>fibonacci(1)</code>… sont recalculés plusieurs fois. Le résultat est correct, mais le nombre d’appels grandit très vite avec n. Il existe des techniques pour éviter ces recalculs ; elles seront étudiées plus tard.</p>'
    '{{q:correct-inefficace}}'
    '<h3>Un arbre qui contient des arbres</h3>'
    '{{fig:svg-arbre}}'
    '<p>Un arbre fractal se décrit récursivement : un tronc qui porte <em>deux arbres plus petits</em>. Le cas de base est l’arbre trop petit pour être dessiné. (Lecture seule : ce bonus n’est pas nécessaire au module.)</p>',
    'Écris maximum et indice_dicho, vérifie-les, observe la trace de Fibonacci, puis réponds aux questions.',
    S.BONUS_STARTER,
    [
        q('dicho-base', 'Dans indice_dicho, que doit-on renvoyer quand debut > fin ?',
          ['0', 'L’indice du milieu', '-1 : la plage est vide, x n’y est pas', 'None'], 2,
          'Quand debut > fin, il ne reste plus aucune case à examiner : c’est le cas de base « non trouvé », et on renvoie -1.',
          ['0 serait une position valide : on ne peut pas s’en servir pour dire « non trouvé ».', 'Il n’y a plus de milieu quand la plage est vide.', 'Oui : -1.', 'None pourrait fonctionner dans l’absolu, mais l’énoncé demande -1.']),
        q('dicho-moitie', 'Pourquoi la dichotomie est-elle bien plus rapide qu’une recherche case par case sur une grande liste triée ?',
          ['Parce qu’elle trie la liste', 'Parce qu’à chaque appel, la plage de recherche est à peu près divisée par deux', 'Parce qu’elle ne regarde jamais le milieu', 'Parce qu’elle utilise moins de variables'], 1,
          'Diviser par deux à chaque appel : pour 1 000 cases, une douzaine d’appels suffisent, contre 1 000 au pire en parcourant tout.',
          ['La liste doit déjà être triée : la dichotomie ne trie rien.', 'Oui : la taille du problème est divisée par deux à chaque appel.', 'Elle regarde au contraire le milieu à chaque appel.', 'Le nombre de variables n’intervient pas.']),
        q('correct-inefficace', 'Une fonction peut-elle être correcte mais inefficace ?',
          ['Non : une fonction correcte est toujours efficace', 'Oui : fibonacci donne le bon résultat mais recalcule les mêmes valeurs un grand nombre de fois', 'Non : une fonction inefficace est toujours incorrecte', 'Oui, mais seulement si elle contient une boucle'], 1,
          'Correction (le résultat est juste) et efficacité (le temps et la mémoire utilisés) sont deux qualités différentes.',
          ['Les deux qualités sont indépendantes.', 'Oui : correct ne veut pas dire rapide.', 'Une fonction inefficace peut donner un résultat tout à fait juste.', 'Une boucle n’est pas nécessaire pour être inefficace.']),
    ],
    [f('dicho-division', 'Combien de fois peut-on diviser 1 000 par 2 avant d’arriver à 1 ? Que dit ce nombre sur le nombre d’appels de la dichotomie ?', 'Environ… appels, au lieu de… cases examinées.')],
    ['Identifie le cas de base : pour maximum, une liste d’un seul élément ; pour indice_dicho, une plage vide (debut > fin) ou le milieu égal à x.',
     'Identifie la réduction : pour maximum, la liste sans son premier élément ; pour indice_dicho, la moitié gauche ou la moitié droite de la plage.',
     'Squelette : calculer le milieu ; s’il vaut x, le renvoyer ; s’il est plus petit que x, chercher à droite ; sinon chercher à gauche.'],
    'La dichotomie divise le problème par deux à chaque appel. Une récursion à deux appels peut recalculer plusieurs fois les mêmes valeurs : correct ne veut pas dire efficace.',
    ['maximum : valeurs', 'maximum : la fonction s’appelle elle-même', 'indice_dicho : l’indice des éléments présents',
     'indice_dicho : éléments absents et plage vide → -1', 'indice_dicho : environ la moitié des cases écartée à chaque appel'],
    figures=[trace('trace-fib', 'fibonacci', [5], 'Trace de fibonacci(5) : repère les appels identiques'), FIG_ARBRE])

# Répartition des bonnes réponses : on échange deux choix (et leurs retours ciblés) pour varier leur place.
POSITIONS = {
    ('diagnostic', 'pourquoi-fin'): 3,
    ('cas-de-base', 'oubli-return'): 3,
    ('structures', 'pal-interieur'): 3,
    ('pile-appels', 'lien-lifo'): 0,
    ('iteratif', 'pile'): 0,
}


def _place(steps):
    for st in steps:
        for qq in st['questions']:
            k = POSITIONS.get((st['id'], qq['id']))
            if k is None or qq['correct'] == k:
                continue
            j = qq['correct']
            for key in ('choices', 'choiceFeedback'):
                qq[key][j], qq[key][k] = qq[key][k], qq[key][j]
            qq['correct'] = k


STEPS = [DIAGNOSTIC, DECOUVERTE, CAS_DE_BASE, PILE_APPELS, ECRIRE, STRUCTURES, ITERATIF, MISSION, SYNTHESE, BONUS]

_place(STEPS)

SKILLS = [
    {'id': 'cas-de-base', 'label': 'Identifier le cas de base', 'steps': ['decouverte', 'cas-de-base', 'ecrire', 'mission']},
    {'id': 'appel-recursif', 'label': 'Identifier l’appel récursif', 'steps': ['decouverte', 'cas-de-base', 'structures']},
    {'id': 'terminaison', 'label': 'Prévoir la terminaison', 'steps': ['diagnostic', 'decouverte', 'ecrire']},
    {'id': 'tracer', 'label': 'Tracer des appels récursifs', 'steps': ['cas-de-base', 'pile-appels']},
    {'id': 'valeurs-retour', 'label': 'Comprendre les valeurs de retour', 'steps': ['cas-de-base', 'pile-appels']},
    {'id': 'ecrire', 'label': 'Écrire une fonction récursive', 'steps': ['ecrire', 'structures', 'mission', 'bonus']},
    {'id': 'iteratif-recursif', 'label': 'Choisir entre itération et récursion', 'steps': ['iteratif', 'synthese']},
]

CONTENT = {
    'version': '1.0.0',
    'title': 'Récursivité et programmation récursive',
    'subtitle': 'Comprendre, tracer et écrire des algorithmes récursifs',
    'session': 'Algorithmique et programmation • Terminale NSI',
    'duration': 120,
    'ui': {'phases': True},
    'skills': SKILLS,
    'steps': STEPS,
}

# ─── Corrigé enseignant (document PRIVÉ, source du PDF) ──────────────────────

MODELES = {
    ('diagnostic', 'progression'): 'Une répétition finit si, à chaque tour, quelque chose progresse vers la condition d’arrêt (ici n diminue jusqu’à devenir négatif). Sans progression, elle ne finit jamais.',
    ('decouverte', 'reparation'): 'J’ai ajouté un cas de base (if n < 0: return) pour arrêter la récursion, et j’ai remplacé l’appel compte_a_rebours(n) par compte_a_rebours(n - 1) pour que le problème diminue à chaque appel.',
    ('cas-de-base', 'valeur-1'): '1.',
    ('cas-de-base', 'developpe-4'): 'somme(4) = 4 + somme(3) = 4 + 3 + somme(2) = 4 + 3 + 2 + somme(1) = 4 + 3 + 2 + 1 + somme(0) = 10. Accepter tout développement cohérent qui s’arrête à somme(0).',
    ('cas-de-base', 'valeur-4'): '10.',
    ('pile-appels', 'descente-remontee'): 'Pendant la descente, chaque appel en crée un nouveau sur un problème plus petit, jusqu’au cas de base : les appels s’empilent et aucune valeur n’est encore calculée. Pendant la remontée, chaque appel reçoit la valeur de l’appel plus petit, calcule la sienne et la retourne, du dernier appel créé au premier.',
    ('ecrire', 'zero-fact'): '1 (convention : le produit vide).',
    ('ecrire', 'cas-de-base'): 'somme : n == 0, valeur 0. factorielle : n == 0, valeur 1. puissance : n == 0, valeur 1.',
    ('ecrire', 'reduction'): 'somme(n) = n + somme(n - 1) ; factorielle(n) = n × factorielle(n - 1) ; puissance(a, n) = a × puissance(a, n - 1). La valeur retournée par l’appel plus petit est combinée avec n (ou a) pour construire la réponse.',
    ('ecrire', 'terminaison'): 'À chaque appel, n diminue de 1 ; comme n est un entier positif ou nul au départ, il finit par valoir 0, qui est le cas de base.',
    ('structures', 'pal-raisonnement'): 'Si la chaîne est vide ou d’un seul caractère, c’est un palindrome (True). Sinon, si le premier et le dernier caractère sont différents, ce n’est pas un palindrome (False). Sinon, la réponse est celle de l’intérieur de la chaîne (sans ses deux extrémités).',
    ('iteratif', 'choix'): 'Récursif : structure naturellement imbriquée (dossiers, arbres) ou définition mathématique récursive. Boucle : simple répétition, très grand nombre d’étapes (pas de pile d’appels, pas de RecursionError). Accepter toute justification cohérente.',
    ('mission', 'cas-de-base-dossier'): 'Cas de base : l’élément est un fichier (une chaîne), il compte pour 1. Appel récursif : sur chaque élément du dossier (fichier ou sous-dossier), dont on additionne les résultats.',
    ('mission', 'inverse-raisonnement'): 'On retire le premier caractère ; on inverse le reste (appel récursif, chaîne plus courte) ; le résultat est le reste inversé suivi du caractère retiré. Cas de base : la chaîne vide, qui s’inverse en elle-même.',
    ('synthese', 'bilan'): 'Réponse libre. Attendu : chercher le cas le plus simple (cas de base), ramener le cas général à un problème plus petit (appel récursif), vérifier que le problème diminue (terminaison), puis construire la valeur retournée à partir de celle de l’appel plus petit.',
    ('bonus', 'dicho-division'): 'Environ 10 fois (2 puissance 10 = 1 024). La dichotomie fait donc environ 10 à 11 appels pour 1 000 cases, au lieu de 1 000 cases examinées au pire.',
}

TRACES = {
    'decouverte': 'compte_a_rebours(2) → affiche 2 → compte_a_rebours(1) → affiche 1 → compte_a_rebours(0) → affiche 0 → compte_a_rebours(-1) → cas de base : return. Quatre appels empilés au maximum, puis les retours (sans valeur) remontent un à un.',
    'cas-de-base': 'somme(3) → 3 + somme(2) → 3 + 2 + somme(1) → 3 + 2 + 1 + somme(0) → somme(0) retourne 0 → somme(1) retourne 1 → somme(2) retourne 3 → somme(3) retourne 6.',
    'pile-appels': 'Affichage attendu de somme_trace(3) : APPEL somme(3) ; (2 espaces) APPEL somme(2) ; (4) APPEL somme(1) ; (6) APPEL somme(0) ; (6) RETOUR 0 ; (4) RETOUR 1 ; (2) RETOUR 3 ; RETOUR 6.',
    'ecrire': 'factorielle(4) → 4 × factorielle(3) → 4 × 3 × factorielle(2) → 4 × 3 × 2 × factorielle(1) → … × factorielle(0) → 1 ; remontée : 1, 1, 2, 6, 24.',
    'structures': 'est_palindrome("radar") → r = r → est_palindrome("ada") → a = a → est_palindrome("d") → cas de base : True ; les deux appels au-dessus retournent True.',
    'iteratif': 'puissance_recursive(2, 3) empile 4 appels (n = 3, 2, 1, 0) ; puissance_iterative(2, 3) fait trois tours de boucle dans un seul appel.',
    'mission': 'compter_fichiers(["cours.pdf", ["tp.py", "correction.pdf"], "notes.txt"]) → 1 (cours.pdf) + compter_fichiers(["tp.py", "correction.pdf"]) (= 1 + 1) + 1 (notes.txt) = 4. inverse("NSI") → inverse("SI") + "N" → (inverse("I") + "S") + "N" → ((inverse("") + "I") + "S") + "N" = "ISN".',
    'bonus': 'indice_dicho([2, 5, 8, 12, 16, 23], 12, 0, 5) → milieu 2 (valeur 8 < 12) → indice_dicho(…, 3, 5) → milieu 4 (valeur 16 > 12) → indice_dicho(…, 3, 3) → milieu 3 (valeur 12) → renvoie 3.',
}

DIFFICULTES = {
    'diagnostic': ['Confondre « la boucle s’arrête » et « la boucle fait ce qui est demandé » : insister sur la progression de la variable.'],
    'decouverte': ['Penser que « la fonction s’appelle elle-même » suffit : un appel sans progression ni cas de base ne finit pas.', 'Croire que Python exécute réellement une infinité d’appels : la limite de profondeur provoque la RecursionError.'],
    'cas-de-base': ['Confondre afficher et retourner.', 'Ne pas voir que le return du cas de base est la seule source de valeur : les autres retours s’appuient dessus.', 'Assimiler récursivité et récurrence mathématique.'],
    'pile-appels': ['Imaginer que les appels « se font en parallèle » ou que la valeur est connue dès la descente.', 'Mélanger l’ordre de création et l’ordre de fin des appels.'],
    'ecrire': ['Écrire le code avant d’avoir identifié le cas de base.', 'Oublier la convention 0! = 1.', 'Écrire une version avec boucle qui donne les bonnes valeurs : le contrôle « s’appelle elle-même » le signale.'],
    'structures': ['Ne pas voir que la chaîne ou la liste diminue de taille.', 'Modifier la liste reçue (pop) au lieu de la lire.', 'Palindrome : oublier le cas des chaînes d’un seul caractère.'],
    'iteratif': ['Penser que la récursivité est toujours meilleure (ou toujours moins bonne).', 'Ne pas relier le coût à la pile d’appels.'],
    'mission': ['Ne pas distinguer fichier et dossier (isinstance).', 'Écrire un seul cas (fichier) et oublier de parcourir les éléments du dossier.', 'inverse : placer le caractère au mauvais bout.'],
}

INTERVENTIONS = {
    'diagnostic': ['Faire exécuter la boucle à la main sur un tableau de variables.'],
    'decouverte': ['Demander à l’élève de prédire la sortie de la version défectueuse avant l’exécution ; lui faire lire le message de RecursionError.', 'Lui faire énoncer le cas de base à voix haute avant toute écriture.'],
    'cas-de-base': ['Faire développer somme(2), puis somme(3), à la main, sans ordinateur.', 'Faire corriger le programme sans return en lisant la valeur obtenue (None).'],
    'pile-appels': ['Utiliser la figure interactive pas à pas, en la masquant à moitié : l’élève prévoit la prochaine étape.', 'Faire le lien avec le TP Piles : « quel est le sommet ? ».'],
    'ecrire': ['Faire remplir les champs cas de base / réduction avant l’éditeur.', 'Si l’élève bloque : lui faire écrire le développement d’un exemple, puis généraliser.'],
    'structures': ['Écrire la chaîne ou la liste sur papier et barrer un élément à chaque appel.', 'Pour le palindrome : traiter d’abord à la main "kayak" puis "kayaks".'],
    'iteratif': ['Faire réécrire une fonction de l’élève dans l’autre style.', 'Comparer la profondeur de pile avec n = 1000.'],
    'mission': ['Dessiner le dossier sous forme d’arbre.', 'Faire écrire la partie A (nombres) avant B (fichiers) pour dégager le même squelette.'],
}

ERREURS = {
    'decouverte': ['Cas de base placé après l’appel récursif (la fonction s’appelle avant de tester).', 'Appel sur n ou sur n + 1 au lieu de n - 1.', 'Cas de base n < 0 remplacé par n == 1 : le 0 n’est jamais affiché.'],
    'pile-appels': ['Oublier d’augmenter la profondeur dans l’appel récursif (tous les affichages sont alignés).', 'Afficher le RETOUR avant de connaître le résultat.', 'Appeler somme_trace(n - 1) sans profondeur + 1.'],
    'ecrire': ['Cas de base oublié ou faux (0! = 0, a puissance 0 = 0).', 'Oublier return devant l’appel récursif (la fonction renvoie None).', 'Version avec boucle.', 'Appel récursif sur n au lieu de n - 1.'],
    'structures': ['Palindrome : comparer le premier caractère au deuxième au lieu du dernier.', 'tab.pop(0) : modifie la liste reçue.', 'Utiliser len() ou sum() sans récursion (le contrôle le signale).'],
    'iteratif': ['Initialiser l’accumulateur à 0 (le produit reste nul).', 'Déléguer à puissance_recursive.'],
    'mission': ['isinstance oublié : un fichier est parcouru caractère par caractère (une chaîne est itérable).', 'Cas du dossier vide oublié (avec la version [premier] + reste).', 'inverse : texte[0] + inverse(texte[1:]) (rend la chaîne inchangée).'],
    'bonus': ['maximum sur la liste vide (non couvert par le contrat).', 'Dichotomie : milieu + 1 / milieu - 1 oubliés (boucle infinie : RecursionError).', 'debut > fin non traité.'],
}

DIAGNOSTIC_COMPREHENSION = [
    ('L’élève sait écrire la syntaxe mais ne comprend pas la récursion',
     'Symptôme : il reproduit un modèle (if n == 0 … return n + f(n - 1)) sans pouvoir tracer somme(4), ni dire ce que retourne somme(1).',
     'Retirer l’ordinateur : lui faire développer somme(3) à la main, puis tracer la pile avec la figure interactive. Lui demander de prévoir la valeur de chaque RETOUR avant de la voir.'),
    ('L’élève oublie le cas de base',
     'Symptôme : RecursionError, ou fonction qui « marche presque ».',
     'Travailler d’abord le raisonnement, pas la syntaxe : « quel est le plus petit problème ? » Lui faire écrire en français la réponse à ce plus petit problème avant le code.'),
    ('L’élève comprend la descente mais pas les retours',
     'Symptôme : il sait où les appels vont, mais pas d’où vient la valeur finale ; il pense que « somme(4) vaut 4 » ou n’explique pas le rôle du return.',
     'Utiliser la pile d’appels visuelle : insister sur le fait que chaque appel attend la valeur de l’appel plus petit. Faire annoter chaque RETOUR avec le calcul (2 + 1 = 3).'),
    ('L’élève confond afficher et retourner',
     'Symptôme : print à la place de return, ou le contrôle indique « renvoie None ».',
     'Faire utiliser le résultat d’un appel dans un calcul (somme(3) + 1). Constater None, puis comparer avec print.'),
    ('L’élève confond récursivité et récurrence mathématique',
     'Symptôme : il cherche une « formule » plutôt qu’un appel de fonction, ou croit que toute suite définie par récurrence est une fonction récursive.',
     'Reprendre la distinction du cours : la récurrence relie des nombres ; la fonction récursive est un mécanisme d’exécution. Les faire coexister sur un exemple (somme).'),
    ('L’élève veut tout faire avec des boucles',
     'Symptôme : le contrôle « la fonction s’appelle elle-même » échoue, alors que les valeurs sont correctes.',
     'Valider d’abord l’exactitude, puis demander : « comment ce problème se ramène-t-il à lui-même, en plus petit ? » La mission des dossiers imbriqués rend la boucle difficile : bon contre-exemple.'),
]

VIGILANCE = [
    'Le parcours vérifie le COMPORTEMENT (valeurs de retour, affichages) et le caractère récursif (la fonction doit s’appeler elle-même), pas la forme exacte du code : toute écriture valide est acceptée.',
    'La limite de 200 appels est une limite du bac à sable pédagogique Nexus, pas une propriété de Python : elle est volontairement basse pour qu’une RecursionError arrive vite et sans geler le navigateur. Python standard autorise environ 1 000 appels par défaut (valeur modifiable). Ne jamais présenter 200 comme la limite de Python.',
    'Les restrictions de l’éditeur (aucun import, pas d’accès fichier, pas d’exécution dynamique) sont pédagogiques, pas un dispositif de sécurité.',
    'Fibonacci est volontairement absent du noyau : deux appels récursifs introduisent l’arbre d’appels et les recalculs, traités seulement en bonus comme contre-exemple.',
    'On n’enseigne pas ici l’optimisation de la récursion terminale : Python ne la fait pas en pratique.',
    'Rythme : si la classe est en retard à la 75e minute, passer à la mission avec la partie A seule (nombres imbriqués) ; la synthèse peut se faire à l’oral.',
    'Le dernier contrôle de l’étape « Itératif ou récursif ? » (puissance_iterative(2, 1000)) doit réussir sans RecursionError : c’est le constat du coût de la pile d’appels.',
]


def e(x):
    return esc(x)


def corrige_html():
    out = []
    out.append('<!--\n  Corrigé enseignant — Récursivité et programmation récursive.\n  DOCUMENT PRIVÉ : jamais servi aux élèves. Généré par content/espace/nsi-recursivite/build_content.py\n  à partir de solutions.py et de content.json : ne pas modifier à la main.\n-->')
    out.append('<h1>' + T('Corrigé enseignant — Récursivité et programmation récursive') + '</h1>')
    out.append('<p class="meta">' + T('Terminale · NSI · Algorithmique et programmation · séance guidée de 1 h 50 à 2 h. Le parcours vérifie le comportement du code et son caractère récursif ; ce document donne les solutions de référence, les traces d’exécution, les réponses attendues, les erreurs probables et les interventions possibles.') + '</p>')
    out.append('<div class="box">' + T('<strong>Message central.</strong> Une fonction récursive résout un problème en traitant directement un <strong>cas simple</strong>, ou en le ramenant à une <strong>instance plus petite du même problème</strong>. Elle doit toujours progresser vers un cas de base. Cas de base + appel sur un problème plus petit + pile d’appels + retour des résultats + terminaison.') + '</div>')
    out.append('<div class="box">' + T('<strong>Position dans la progression NSI.</strong> Programmation orientée objet : TP POO 1 (Des objets qui agissent) et TP POO 2 (Listes, piles et files). Algorithmique et programmation : ce parcours. Il prolonge le TP Piles (pile d’appels, LIFO) sans être un « TP POO 3 ».') + '</div>')
    out.append('<h2>' + T('Déroulé conseillé (114 min + bonus)') + '</h2><table><thead><tr><th>Étape</th><th>Durée</th><th>Niveau</th></tr></thead><tbody>')
    for st in STEPS:
        out.append('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (e(T(st['title'])), 'facultatif' if st['id'] == 'bonus' else '%d min' % st['minutes'], e(T(st['level']))))
    out.append('</tbody></table>')
    out.append('<h2>' + T('Compétences suivies') + '</h2><table><thead><tr><th>Compétence</th><th>Étapes où elle est travaillée</th></tr></thead><tbody>')
    titles = {st['id']: st['short'] for st in STEPS}
    for sk in SKILLS:
        out.append('<tr><td>%s</td><td>%s</td></tr>' % (e(T(sk['label'])), e(', '.join(titles[s] for s in sk['steps']))))
    out.append('</tbody></table>')
    out.append('<p>' + T('Dans l’espace enseignant, ces compétences peuvent être annotées sur le travail de chaque élève (annotation d’étape ou commentaire réutilisable), avec le statut « À reprendre » si nécessaire.') + '</p>')
    for st in STEPS:
        out.append('<h2>%s</h2>' % e(T(st['title'])))
        out.append('<p><span class="tag">%s</span> %s</p>' % (e(st['id']), e(T(st['takeaway']))))
        for qq in st['questions']:
            out.append('<h3>%s</h3><p><strong>%s</strong> %s</p>' % (e(T(qq['text'])), T('Réponse attendue :'), e(T(qq['choices'][qq['correct']]))))
            out.append('<p>%s</p>' % e(T(qq['feedback'])))
            wrong = [(c_, m) for i, (c_, m) in enumerate(zip(qq['choices'], qq['choiceFeedback'])) if i != qq['correct']]
            out.append('<ul>' + ''.join('<li><em>%s</em> — %s</li>' % (e(T(c_)), e(T(m))) for c_, m in wrong) + '</ul>')
        for fl in st['fields']:
            m = MODELES.get((st['id'], fl['id']))
            assert m, (st['id'], fl['id'])
            out.append('<h3>%s</h3><p><strong>%s</strong> %s</p>' % (e(T(fl['label'])), T('Réponse attendue :'), e(T(m))))
        if st['id'] in S.SOLUTIONS:
            out.append('<h3>' + T('Solution de référence') + '</h3><pre>' + e(S.SOLUTIONS[st['id']].strip('\n')) + '</pre>')
            if st['id'] in S.ALTERNATIVES:
                out.append('<h3>' + T('Autre implémentation valide') + '</h3><pre>' + e(S.ALTERNATIVES[st['id']].strip('\n')) + '</pre>')
        if st['id'] in TRACES:
            out.append('<h3>' + T('Trace d’exécution') + '</h3><p>' + e(T(TRACES[st['id']])) + '</p>')
        if st['id'] in DIFFICULTES:
            out.append('<h3>' + T('Difficultés prévisibles') + '</h3><ul>' + ''.join('<li>%s</li>' % e(T(x)) for x in DIFFICULTES[st['id']]) + '</ul>')
        if st['id'] in ERREURS:
            out.append('<h3>' + T('Erreurs probables dans le code') + '</h3><ul>' + ''.join('<li>%s</li>' % e(T(x)) for x in ERREURS[st['id']]) + '</ul>')
        if st['id'] in INTERVENTIONS:
            out.append('<h3>' + T('Interventions pédagogiques possibles') + '</h3><ul>' + ''.join('<li>%s</li>' % e(T(x)) for x in INTERVENTIONS[st['id']]) + '</ul>')
        if st['tests']:
            out.append('<h3>' + T('Contrôles automatiques') + '</h3><ul>' + ''.join('<li>%s</li>' % e(x) for x in st['tests']) + '</ul>')
    out.append('<h2>' + T('Comment diagnostiquer une mauvaise compréhension ?') + '</h2>')
    for title, symptome, action in DIAGNOSTIC_COMPREHENSION:
        out.append('<h3>%s</h3><p><strong>%s</strong> %s</p><p><strong>%s</strong> %s</p>' % (e(T(title)), T('Symptôme :'), e(T(symptome.replace('Symptôme : ', ''))), T('Intervention :'), e(T(action))))
    out.append('<h2>' + T('Points de vigilance') + '</h2><ul>' + ''.join('<li>%s</li>' % e(T(x)) for x in VIGILANCE) + '</ul>')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    with open(os.path.join(HERE, 'content.json'), 'w', encoding='utf8') as fh:
        json.dump(CONTENT, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    cdir = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'docs', 'espace', 'corriges', 'nsi-recursivite'))
    os.makedirs(cdir, exist_ok=True)
    with open(os.path.join(cdir, 'corrige.html'), 'w', encoding='utf8') as fh:
        fh.write(corrige_html())
    print('content.json écrit :', len(STEPS), 'étapes ;', sum(s['minutes'] for s in STEPS if s['id'] != 'bonus'), 'minutes obligatoires')
