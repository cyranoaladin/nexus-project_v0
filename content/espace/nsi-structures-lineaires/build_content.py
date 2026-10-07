#!/usr/bin/env python3
"""Génère content.json (côté élève) du TP POO 2 à partir de sources structurées.

    python3 content/espace/nsi-structures-lineaires/build_content.py

Écrire en Python évite les erreurs d'échappement JSON ; la typographie française (espaces
insécables avant ? ! ; : et dans les guillemets) est appliquée AUTOMATIQUEMENT hors code,
hors SVG et hors balises. Les solutions ne sont jamais écrites dans content.json.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import solutions as S  # noqa: E402

NNBSP = ' '
NBSP = ' '


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


def q(id, text, choices, correct, feedback, choice_feedback):
    assert len(choices) == len(choice_feedback), id
    assert 0 <= correct < len(choices), id
    return {'id': id, 'text': T(text), 'choices': [T(c) for c in choices], 'correct': correct,
            'feedback': T(feedback), 'choiceFeedback': [T(c) for c in choice_feedback]}


def f(id, label, placeholder=None, input='area', check=None):
    d = {'id': id, 'label': T(label)}
    if placeholder:
        d['placeholder'] = T(placeholder)
    if input != 'area':
        d['input'] = input
    if check:
        d['check'] = check
    return d


def step(id, short, title, minutes, level, concepts, intro, lesson, task, starter, questions, fields, hints,
         takeaway, tests, figures=None):
    d = {'id': id, 'short': short, 'title': T(title), 'minutes': minutes, 'level': T(level), 'concepts': concepts,
         'intro': T(intro), 'lesson': T(lesson), 'task': T(task), 'starter': starter, 'questions': questions,
         'fields': fields, 'hints': [T(h) for h in hints], 'takeaway': T(takeaway), 'tests': tests}
    if figures:
        d['figures'] = figures
    return d


# ─── Figures statiques (SVG en currentColor : suivent le thème) ─────────────

def _box(x, y, w, h, label, strong=False):
    sw = 2.5 if strong else 1.5
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="none" stroke="currentColor" stroke-width="{sw}"/>'
            f'<text x="{x + w / 2}" y="{y + h / 2 + 6}" text-anchor="middle" font-size="18" font-weight="600" fill="currentColor">{label}</text>')


def svg_liste():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="100%" role="img" aria-label="Liste de quatre éléments A, B, C, D, indices 0 à 3" font-family="sans-serif">']
    for i, c in enumerate('ABCD'):
        x = 20 + i * 90
        parts.append(_box(x, 30, 60, 44, c))
        parts.append(f'<text x="{x + 30}" y="98" text-anchor="middle" font-size="13" fill="currentColor" opacity="0.8">indice {i}</text>')
        if i < 3:
            parts.append(f'<path d="M{x + 62} 52 H{x + 88}" stroke="currentColor" stroke-width="1.5" marker-end="url(#a)"/>')
    parts.insert(1, '<defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="currentColor"/></marker></defs>')
    parts.append('</svg>')
    return ''.join(parts)


def svg_pile():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 230" width="100%" role="img" aria-label="Pile de quatre éléments : D au sommet, puis C, B, A en bas" font-family="sans-serif">']
    for i, c in enumerate('DCBA'):
        parts.append(_box(150, 20 + i * 48, 100, 42, c, strong=(i == 0)))
    parts.append('<path d="M290 41 H262" stroke="currentColor" stroke-width="1.5"/><path d="M262 41 l9 -5 v10 z" fill="currentColor"/>')
    parts.append('<text x="298" y="46" font-size="14" fill="currentColor">sommet</text>')
    parts.append('<text x="40" y="46" font-size="13" fill="currentColor" opacity="0.8">on pose et on</text><text x="40" y="62" font-size="13" fill="currentColor" opacity="0.8">retire ici seulement</text>')
    parts.append('</svg>')
    return ''.join(parts)


def svg_file():
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 110" width="100%" role="img" aria-label="File de quatre éléments : A à la sortie, D à l’entrée" font-family="sans-serif">']
    parts.append('<text x="6" y="30" font-size="14" fill="currentColor">sortie</text><path d="M10 40 H34" stroke="currentColor" stroke-width="1.5"/><path d="M10 40 l9 -5 v10 z" fill="currentColor"/>')
    for i, c in enumerate('ABCD'):
        parts.append(_box(48 + i * 84, 22, 66, 44, c, strong=(i == 0)))
    parts.append('<text x="392" y="30" font-size="14" fill="currentColor">entrée</text><path d="M410 40 H386" stroke="currentColor" stroke-width="1.5"/><path d="M386 40 l9 -5 v10 z" fill="currentColor"/>')
    parts.append('<text x="48" y="94" font-size="13" fill="currentColor" opacity="0.8">le premier arrivé (A) sortira le premier</text>')
    parts.append('</svg>')
    return ''.join(parts)


FIG_LISTE = {'type': 'svg', 'id': 'svg-liste', 'caption': 'Liste : on peut lire n’importe quel rang.', 'alt': 'Liste A, B, C, D avec indices 0 à 3', 'svg': svg_liste()}
FIG_PILE = {'type': 'svg', 'id': 'svg-pile', 'caption': 'Pile : tout se passe au sommet.', 'alt': 'Pile avec D au sommet, puis C, B, A', 'svg': svg_pile()}
FIG_FILE = {'type': 'svg', 'id': 'svg-file', 'caption': 'File : on entre d’un côté, on sort de l’autre.', 'alt': 'File avec A à la sortie et D à l’entrée', 'svg': svg_file()}
SIM_PILE = {'type': 'structure-sim', 'id': 'sim-pile', 'mode': 'pile', 'initial': [], 'caption': 'Simulateur de pile'}
SIM_FILE = {'type': 'structure-sim', 'id': 'sim-file', 'mode': 'file', 'initial': [], 'caption': 'Simulateur de file'}

# ─── Étapes ─────────────────────────────────────────────────────────────────

BOITE = ('<pre><code>class Boite:\n    def __init__(self):\n        self.contenu = []\n\n'
         '    def ajouter(self, valeur):\n        self.contenu.append(valeur)\n\n'
         'b1 = Boite()\nb2 = Boite()\nb1.ajouter(5)</code></pre>')

REACTIVATION = step(
    'reactivation', 'Réactiver', 'Rappel : ce que sait déjà une classe', 8, 'Diagnostic, non noté',
    ['classe', 'attribut', 'méthode', 'instance'],
    'Avant de construire de nouvelles structures, vérifions ce que tu retiens du TP POO 1. Rien n’est noté : tes réponses servent à ajuster la suite.',
    '<p>Voici une classe très simple : une boîte dans laquelle on range des valeurs.</p>' + BOITE
    + '<p>Observe bien ce programme, puis réponds. Une erreur ne coûte rien : elle te montre ce qu’il faut revoir.</p>'
    '{{q:classe}}{{q:attribut}}{{q:ajouter}}{{q:instances}}'
    '<p>Pour finir, mets-le en mots.</p>{{f:independance}}',
    'Réponds aux quatre questions, puis rédige ta phrase.', None,
    [
        q('classe', 'Quel est le nom de la classe ?', ['Boite', '__init__', 'contenu', 'ajouter'], 0,
          'On déclare une classe avec le mot-clé class, suivi de son nom : ici Boite. __init__ et ajouter sont des méthodes ; contenu est un attribut.',
          ['Oui : class Boite.', '__init__ est une méthode spéciale (le constructeur) définie dans la classe, mais ce n’est pas la classe.',
           'contenu est un attribut : une variable attachée à chaque instance.', 'ajouter est une méthode : une fonction définie dans la classe.']),
        q('attribut', 'Quel est l’attribut d’instance de Boite ?', ['self.contenu', 'ajouter', 'b1', 'valeur'], 0,
          'Un attribut d’instance se crée avec self.nom = ... dans __init__ : ici self.contenu. b1 est une instance, valeur est un paramètre.',
          ['Oui : self.contenu est créé dans __init__.', 'ajouter est une méthode, pas une donnée.', 'b1 est une instance de la classe (un objet), pas un attribut.', 'valeur est un simple paramètre de la méthode ajouter.']),
        q('ajouter', 'Que fait l’appel b1.ajouter(5) ?',
          ['Il modifie la list contenu de b1 et ne renvoie rien', 'Il renvoie une nouvelle boîte qui contient 5', 'Il affiche 5 à l’écran', 'Il modifie à la fois b1 et b2'], 0,
          'ajouter agit par mutation : elle modifie l’attribut contenu de l’instance sur laquelle on l’appelle. Elle ne contient pas de return, donc elle renvoie None.',
          ['Oui : mutation de b1, valeur de retour None.', 'Aucun return, aucune nouvelle boîte n’est créée : b1 est modifiée sur place.',
           'Il n’y a aucun print dans la méthode : rien n’est affiché.', 'ajouter ne touche que l’instance sur laquelle on l’appelle (b1).']),
        q('instances', 'Après ces instructions, que contient b2.contenu ?', ['[5]', '[]', 'Une erreur', 'None'], 1,
          'Chaque instance a sa propre list : __init__ en crée une nouvelle à chaque Boite(). b1.ajouter(5) ne modifie que celle de b1.',
          ['b2 n’a pas été modifiée : la list de b1 est un autre objet.', 'Oui : b2.contenu est une list vide.', 'Aucune erreur : b2.contenu existe depuis le Boite() de b2.', 'contenu vaut bien une list (vide), pas None.']),
    ],
    [f('independance', 'En une phrase : pourquoi b2.contenu n’est-il pas modifié par b1.ajouter(5) ?', 'Pense à ce que fait __init__ à chaque fois qu’on écrit Boite().')],
    ['Relis __init__ : que se passe-t-il chaque fois qu’on écrit Boite() ?'],
    'Chaque instance possède ses propres attributs, créés par __init__. Une méthode comme ajouter modifie l’instance sur laquelle on l’appelle, et rien d’autre.',
    [])

TYPES_ABSTRAITS = step(
    'types-abstraits', 'Comprendre', 'Liste, pile, file : trois façons d’organiser des données', 12, 'Découverte',
    ['type abstrait de données', 'interface', 'implémentation', 'LIFO', 'FIFO'],
    'Une collection range des données. Ce qui distingue liste, pile et file, c’est la règle qui dit où l’on ajoute et d’où l’on retire.',
    '<p>Trois situations que tu connais.</p>'
    '{{fig:svg-liste}}<p>Une <strong>liste</strong> est une collection ordonnée : on peut lire l’élément de rang 0, 1, 2…, et en ajouter.</p>'
    '{{fig:svg-pile}}<p>Une <strong>pile</strong> (une pile de livres) : on ne pose et on ne retire qu’au sommet. Le dernier posé est le premier retiré : c’est <strong>LIFO</strong>, pour <em>Last In, First Out</em>.</p>'
    '{{fig:svg-file}}<p>Une <strong>file</strong> (la file d’attente d’un guichet) : on arrive par l’entrée, on sort par l’autre bout. Le premier arrivé est le premier servi : c’est <strong>FIFO</strong>, pour <em>First In, First Out</em>.</p>'
    '<p>À toi d’observer : ajoute des lettres, retire-en, et regarde laquelle sort.</p>'
    '{{fig:sim-pile}}{{fig:sim-file}}{{q:pile-ordre}}{{q:file-ordre}}'
    '<p>Une pile ou une file n’est pas définie par la façon dont on la stocke, mais par <strong>ce qu’on peut faire avec elle</strong> et par la règle de comportement associée. C’est la notion de <strong>type abstrait de données</strong>.</p>'
    '<div class="contract"><strong>Interface</strong> : les opérations offertes et leur comportement (empiler, depiler, sommet…).<br>'
    '<strong>Implémentation</strong> : la manière dont ces opérations sont réalisées (ici, avec une list Python cachée dans l’objet).</div>'
    '{{q:pourquoi-pas-element}}'
    '<p><strong>Attention au mot « liste ».</strong> En NSI, « liste » peut désigner le type abstrait (une collection ordonnée munie d’une interface), alors que <code>list</code> est un type concret de Python. On peut utiliser une <code>list</code> à l’intérieur d’une pile : la pile ne devient pas pour autant « juste une list », car elle n’expose que ses opérations de pile.</p>'
    '{{q:list-pile}}<p>Formule maintenant l’idée avec tes mots.</p>{{f:interface-implementation}}',
    'Manipule les deux simulateurs, réponds aux questions, puis explique la différence entre interface et implémentation.', None,
    [
        q('pile-ordre', 'On empile A, puis B, puis C. Quel élément sera dépilé en premier ?', ['A', 'B', 'C', 'On ne peut pas le savoir'], 2,
          'Dernier entré, premier sorti : C a été empilé en dernier, c’est donc le sommet, et il sort le premier.',
          ['A est au fond de la pile : il sortirait en dernier.', 'B est sous C : il sort après lui.', 'Oui : C est au sommet.', 'Si : la règle LIFO détermine l’ordre de sortie sans ambiguïté.']),
        q('file-ordre', 'On enfile A, puis B, puis C. Quel élément sortira en premier ?', ['A', 'B', 'C', 'Cela dépend de la taille'], 0,
          'Premier entré, premier sorti : A est arrivé le premier, il sort le premier.',
          ['Oui : A a attendu le plus longtemps.', 'B passe après A.', 'C est le dernier arrivé : c’est le comportement d’une pile, pas d’une file.', 'La taille ne change rien : la règle FIFO fixe l’ordre.']),
        q('pourquoi-pas-element', 'Pourquoi une pile ne propose-t-elle pas d’opération « lire l’élément de rang i » comme le fait une liste ?',
          ['Parce que Python l’interdit', 'Parce que la contrainte (n’agir qu’au sommet) fait partie de sa définition : c’est elle qui garantit le comportement LIFO',
           'Parce que ce serait beaucoup trop lent', 'Parce qu’une pile n’a pas d’indices en mémoire'], 1,
          'Une interface restreinte est un choix de conception : en limitant l’accès au sommet, on garantit la règle LIFO. Si on autorisait de lire ou d’insérer n’importe où, ce ne serait plus une pile.',
          ['Python n’interdit rien : c’est la définition de la structure qui limite les opérations.', 'Oui : la restriction est voulue et garantit LIFO.',
           'La vitesse n’est pas la raison : même rapide, un accès au rang i ferait sortir de la règle LIFO.', 'Peu importe la mémoire : on parle ici d’interface, pas d’implémentation.']),
        q('list-pile', 'Une pile est réalisée avec une list Python. Que peut-on en conclure ?',
          ['Une pile et une list sont le même type abstrait', 'L’interface de la pile est celle de list : on peut utiliser tous les crochets', 'La list est un choix de représentation : l’interface de la pile n’en dépend pas',
           'Une pile ne peut être réalisée qu’avec une list'], 2,
          'La list est ici l’implémentation. L’interface (empiler, depiler, sommet…) ne change pas si l’on choisit une autre représentation.',
          ['Non : le type abstrait pile impose une règle (LIFO) que list n’impose pas.', 'Non : celui qui utilise la pile n’a pas à connaître les crochets, seulement ses opérations.',
           'Oui : interface et implémentation sont deux niveaux distincts.', 'Non : on pourrait réaliser une pile autrement (autre représentation).']),
    ],
    [f('interface-implementation', 'Avec tes mots : quelle est la différence entre l’interface et l’implémentation d’une pile ?', 'Interface : ce que… Implémentation : comment…')],
    ['Pense à une télécommande : tu connais les boutons (l’interface), pas les circuits qu’ils commandent (l’implémentation).',
     'L’interface est la liste des opérations et de leur comportement. L’implémentation est ce qu’il y a dans l’objet pour les réaliser.'],
    'Liste, pile et file se distinguent par la règle d’accès : n’importe où (liste), au sommet seulement (pile, LIFO), entrée d’un côté et sortie de l’autre (file, FIFO). Une interface se décrit sans parler de l’implémentation.',
    [], figures=[FIG_LISTE, FIG_PILE, FIG_FILE, SIM_PILE, SIM_FILE])

LISTE = step(
    'liste', 'Liste', 'Construire une classe Liste', 18, 'Guidé',
    ['classe', 'encapsulation', 'indice', 'cas limite', 'IndexError'],
    'Premier objet : une Liste minimaliste. Tu l’écris méthode par méthode, en vérifiant au fur et à mesure.',
    '<p>Voici son <strong>interface</strong> :</p>'
    '<div class="contract"><strong>Liste()</strong> crée une liste vide.<br><strong>est_vide()</strong> renvoie True si elle ne contient rien.<br>'
    '<strong>longueur()</strong> renvoie le nombre d’éléments.<br><strong>ajouter(valeur)</strong> ajoute valeur à la fin ; ne renvoie rien.<br>'
    '<strong>element(indice)</strong> renvoie l’élément d’indice donné (le premier a l’indice 0).</div>'
    '<p>L’objet garde ses éléments dans un attribut <code>_elements</code>. Le tiret bas initial est une <strong>convention</strong> : « n’y touche pas de l’extérieur, passe par les méthodes ». C’est l’<strong>encapsulation</strong> : on peut changer la représentation sans casser ceux qui utilisent l’interface.</p>'
    '<p><strong>Prédis avant d’exécuter</strong> ce programme, qui figure en bas de l’éditeur :</p>'
    '<pre><code>L = Liste()\nL.ajouter("Ada")\nL.ajouter("Alan")\nprint(L.longueur())\nprint(L.element(1))</code></pre>'
    '{{q:predire-longueur}}{{q:predire-element}}'
    '<p>Complète maintenant les méthodes <em>une par une</em>. Après chacune, clique sur « Vérifier mon code » : chaque contrôle porte sur une méthode précise.</p>'
    '{{code}}'
    '<p><strong>Cas limite.</strong> Que doit faire <code>element(10)</code> sur une liste de deux éléments ? Trois politiques sont possibles : renvoyer <code>None</code> (mais None peut aussi être une vraie valeur stockée), lever une exception, ou interdire l’appel « par contrat » sans rien vérifier. '
    '<strong>Dans tout ce TP nous adoptons une seule convention : on lève <code>IndexError</code>.</strong> Une erreur ne passe ainsi jamais inaperçue.</p>'
    '<p>Attention : sur une <code>list</code> Python, <code>liste[-1]</code> est valide (dernier élément). Pour notre Liste, un indice négatif est <em>invalide</em> : c’est une décision d’interface, pas une limite de Python.</p>'
    '{{f:politique}}',
    'Complète les cinq méthodes de Liste jusqu’à ce que tous les contrôles soient réussis, puis réponds à la question.',
    S.LISTE_STARTER,
    [
        q('predire-longueur', 'À la fin du programme, que vaut L.longueur() ?', ['0', '1', '2', 'Une erreur'], 2,
          'Deux appels à ajouter : la liste contient "Ada" et "Alan", donc longueur() vaut 2.', ['La liste n’est pas vide : deux éléments ont été ajoutés.', 'Il y a eu deux ajouts, pas un.', 'Oui : deux éléments.', 'Aucune erreur : tout est valide.']),
        q('predire-element', 'Que renvoie L.element(1) ?', ['"Ada"', '"Alan"', '1', 'IndexError'], 1,
          'Les indices commencent à 0 : element(0) est "Ada", element(1) est "Alan".', ['"Ada" a l’indice 0, pas 1.', 'Oui : "Alan" est à l’indice 1.', '1 est l’indice, pas l’élément.', 'L’indice 1 existe (la liste a deux éléments).']),
    ],
    [f('politique', 'Pourquoi vaut-il mieux lever IndexError que renvoyer None quand l’indice est invalide ?', 'Pense à une liste qui contiendrait vraiment la valeur None.')],
    ['Rappel : l’attribut _elements est une list créée dans __init__ ; chaque méthode agit sur self._elements. Pour est_vide et longueur, pense à len(...).',
     'Pseudo-code d’element : si l’indice est négatif ou supérieur ou égal au nombre d’éléments, lever IndexError ; sinon renvoyer l’élément de rang indice.',
     'Fragment : if indice < 0 or indice >= len(self._elements): raise IndexError("indice invalide") ; puis return self._elements[indice].'],
    'Une classe cache sa représentation (_elements) derrière une interface. Un cas limite (indice invalide) se règle par une convention claire et unique : ici, IndexError.',
    ['__init__ et est_vide : une liste neuve est vide', 'ajouter et longueur', 'element : lecture par indice', 'element : indice invalide → IndexError', 'Plusieurs listes indépendantes'])

PILE = step(
    'pile', 'Pile', 'Construire une Pile', 18, 'Guidé puis autonome',
    ['pile', 'LIFO', 'mutation', 'valeur de retour', 'cas limite'],
    'Une pile, c’est une interface avant d’être du code. Tu commences par le contrat, tu prédis, puis tu écris.',
    '<p>D’abord le <strong>contrat</strong>, sans une ligne de code :</p>'
    '<div class="contract"><strong>Pile()</strong> crée une pile vide.<br><strong>est_vide()</strong> et <strong>taille()</strong> décrivent son état.<br>'
    '<strong>empiler(x)</strong> pose x au sommet.<br><strong>sommet()</strong> <em>consulte</em> l’élément du sommet.<br><strong>depiler()</strong> <em>retire et renvoie</em> l’élément du sommet.</div>'
    '<p>Ne confonds pas <code>sommet()</code> et <code>depiler()</code>. La seconde fait deux choses à la fois : elle <strong>renvoie</strong> une valeur <em>et</em> <strong>modifie</strong> la pile. C’est la même idée que <code>emprunter()</code> au TP POO 1.</p>'
    '<p><strong>Prédis avant d’exécuter</strong> (le programme est en bas de l’éditeur) : on empile "A", puis "B", puis "C".</p>'
    '{{q:predire-depiler}}{{q:predire-sommet}}{{q:predire-taille}}'
    '<p>À toi de jouer : écris les méthodes, puis vérifie-les.</p>{{code}}'
    '<p><strong>Pile vide.</strong> Que doit faire <code>depiler()</code> quand il n’y a rien à retirer ? Renvoyer <code>None</code> (et laisser l’erreur se propager plus loin sans bruit), lever une exception, ou supposer que l’appelant a déjà testé <code>est_vide()</code> (précondition). '
    'Nous gardons la convention du TP : <code>IndexError</code>. Remarque : sur une list vide, <code>pop()</code> lève déjà un IndexError, mais c’est <em>ton contrat</em> d’interface que tu dois garantir, quelle que soit la représentation.</p>'
    '{{q:politique-vide}}{{f:politique}}',
    'Écris les cinq méthodes de Pile (l’attribut _elements est déjà créé), vérifie-les, puis réponds aux deux dernières questions.',
    S.PILE_STARTER,
    [
        q('predire-depiler', 'Après empiler "A", "B", "C", que renvoie p.depiler() ?', ['"A"', '"B"', '"C"', 'Rien'], 2,
          'Dernier entré, premier sorti : "C" est au sommet. depiler() le renvoie.', ['"A" est tout en bas.', '"B" est sous "C".', 'Oui : "C".', 'depiler() renvoie l’élément retiré.']),
        q('predire-sommet', 'Juste après ce dépilage, que renvoie p.sommet() ?', ['"A"', '"B"', '"C"', 'Une erreur'], 1,
          'Une fois "C" retiré, le sommet est "B". Si tu as répondu "C", tu as oublié que depiler() modifie la pile.', ['"A" est sous "B".', 'Oui : "B".', '"C" a été retiré de la pile par depiler().', 'La pile contient encore "A" et "B" : pas d’erreur.']),
        q('predire-taille', 'Et p.taille() ?', ['1', '2', '3', '0'], 1,
          'Trois empilements, un dépilage : il reste "A" et "B", donc 2.', ['Il reste deux éléments, pas un.', 'Oui : "A" et "B" restent, donc 2.', '3 serait la taille avant le dépilage.', 'La pile n’est pas vide.']),
        q('politique-vide', 'Un programme appelle depiler() sur une pile vide. Quelle politique est la plus sûre dans ce TP ?',
          ['Renvoyer None sans rien dire', 'Lever IndexError : l’erreur est signalée tout de suite', 'Ne rien vérifier et espérer que ça n’arrive pas', 'Renvoyer 0'], 1,
          'Lever une exception signale le problème à l’endroit où il se produit. None pourrait être confondu avec une vraie valeur empilée, et 0 aussi.',
          ['None peut être une valeur légitime stockée dans la pile : on ne distinguerait plus « pile vide » de « None au sommet ».', 'Oui : l’erreur est immédiate et explicite.', 'C’est une précondition sans garde-fou : le bug apparaîtrait plus tard, ailleurs.', '0 est une valeur possible comme une autre : même défaut que None.']),
    ],
    [f('politique', 'Compare les trois politiques pour depiler() sur une pile vide (None, exception, précondition) et justifie celle du TP.', 'None : … Exception : … Précondition : …')],
    ['Rappel : empiler = ajouter à une extrémité de _elements ; depiler = retirer à la MÊME extrémité. Pour une list, la fin est l’extrémité la plus simple (append et pop).',
     'Pseudo-code de depiler : si la pile est vide, lever IndexError ; sinon retirer le dernier élément de _elements et le renvoyer. sommet fait pareil sans retirer.',
     'Fragment : if self.est_vide(): raise IndexError("pile vide") ; puis return self._elements.pop() pour depiler, return self._elements[-1] pour sommet.'],
    'Une pile obéit à LIFO. depiler() renvoie ET modifie ; sommet() consulte seulement. La même convention (IndexError) vaut pour toute structure vide.',
    ['est_vide et taille : une pile neuve est vide', 'empiler : la taille augmente', 'sommet : consulte sans retirer', 'depiler : renvoie ET retire',
     'LIFO : dernier entré, premier sorti', 'Pile vide : sommet et depiler lèvent IndexError', 'Plusieurs piles indépendantes'])

FILE = step(
    'file', 'File', 'Construire une File', 18, 'Guidé puis autonome',
    ['file', 'FIFO', 'mutation', 'coût de pop(0)'],
    'Même démarche que pour la pile, mais avec la règle inverse : le premier arrivé est le premier servi.',
    '<div class="contract"><strong>File()</strong> crée une file vide.<br><strong>est_vide()</strong> et <strong>taille()</strong> décrivent son état.<br>'
    '<strong>enfiler(x)</strong> place x à l’arrière.<br><strong>premier()</strong> <em>consulte</em> le prochain à sortir.<br><strong>defiler()</strong> <em>retire et renvoie</em> le prochain à sortir.</div>'
    '<p><strong>Prédis</strong> avant d’exécuter (le programme est en bas de l’éditeur) : on enfile "Adam", puis "Alexandre", puis "Zaineb".</p>'
    '{{q:predire-sortie}}{{q:predire-restant}}'
    '<p>Écris maintenant les méthodes. Pour <code>defiler</code>, une <code>list</code> Python offre <code>pop(0)</code> : c’est simple, mais tous les éléments suivants sont décalés d’un cran, ce qui coûte de plus en plus cher quand la file s’allonge. Pour ce TP, c’est un choix acceptable ; le bonus propose mieux.</p>'
    '{{q:cout-pop0}}{{code}}{{f:choix}}',
    'Écris les cinq méthodes de File, vérifie-les, puis réponds à la dernière question.',
    S.FILE_STARTER,
    [
        q('predire-sortie', 'On enfile Adam, Alexandre, Zaineb. Qui est défilé en premier ?', ['Adam', 'Alexandre', 'Zaineb', 'On ne peut pas savoir'], 0,
          'Premier entré, premier sorti : Adam est arrivé le premier, il sort le premier.', ['Oui : Adam.', 'Alexandre passe après Adam.', 'Zaineb est la dernière arrivée : ce serait le comportement d’une pile.', 'La règle FIFO fixe l’ordre.']),
        q('predire-restant', 'Après ce défilage, qui est le premier de la file ?', ['Adam', 'Alexandre', 'Zaineb', 'La file est vide'], 1,
          'Adam est sorti (defiler modifie la file). Le prochain à sortir est Alexandre.', ['Adam a été retiré par defiler().', 'Oui : Alexandre.', 'Zaineb est derrière Alexandre.', 'Il reste deux personnes.']),
        q('cout-pop0', 'Pourquoi dit-on que pop(0) est simple mais pas optimale ?',
          ['Elle n’existe pas pour les list', 'Elle ne renvoie pas l’élément retiré', 'Elle décale tous les éléments restants d’un cran', 'Elle retire le dernier élément'], 2,
          'Retirer en tête d’une list oblige Python à décaler les éléments suivants : plus la file est longue, plus c’est coûteux.',
          ['pop(0) existe bien.', 'pop(0) renvoie bien l’élément retiré.', 'Oui : le décalage de tous les éléments suivants.', 'pop() sans argument retire le dernier ; pop(0) retire le premier.']),
    ],
    [f('choix', 'Dans ta list, à quelle extrémité as-tu placé l’élément qui sortira en premier ? Explique ton choix.', 'Début ou fin de _elements, et pourquoi…')],
    ['Rappel : une file a deux extrémités actives : l’arrière (on y ajoute) et l’avant (on en retire). Choisis quelle extrémité de la list sera l’avant.',
     'Pseudo-code de defiler : si la file est vide, lever IndexError ; sinon retirer l’élément de l’avant et le renvoyer. premier fait pareil sans retirer.',
     'Fragment : if self.est_vide(): raise IndexError("file vide") ; puis return self._elements.pop(0) pour defiler, return self._elements[0] pour premier ; enfiler utilise append.'],
    'Une file obéit à FIFO. defiler() renvoie ET modifie ; premier() consulte seulement. Le choix de la représentation (début ou fin de list) n’est pas visible dans l’interface.',
    ['est_vide et taille : une file neuve est vide', 'enfiler : la taille augmente', 'premier : consulte sans retirer', 'defiler : renvoie ET retire',
     'FIFO : premier entré, premier sorti', 'File vide : premier et defiler lèvent IndexError', 'Plusieurs files indépendantes'])

_check_pile = {'kind': 'text', 'accept': ['D, C, B, A', 'D C B A', 'D-C-B-A'],
               'rules': [{'when': ['A, B, C, D', 'A B C D'], 'feedback': T('Tu as donné l’ordre d’une file. Pour une pile, le dernier empilé (D) sort le premier.')}],
               'success': T('Oui : D, C, B, A. Dernier entré, premier sorti.'),
               'fallback': T('Écris les quatre lettres dans l’ordre de sortie, séparées par des virgules ; par exemple : A, B, C, D.')}
_check_file = {'kind': 'text', 'accept': ['A, B, C, D', 'A B C D', 'A-B-C-D'],
               'rules': [{'when': ['D, C, B, A', 'D C B A'], 'feedback': T('Tu as donné l’ordre d’une pile. Dans une file, le premier arrivé (A) sort le premier.')}],
               'success': T('Oui : A, B, C, D. Premier entré, premier sorti.'),
               'fallback': T('Écris les quatre lettres dans l’ordre de sortie, séparées par des virgules ; par exemple : A, B, C, D.')}

COMPARER = step(
    'comparer', 'Comparer', 'Pile ou file : même entrée, sorties différentes', 8, 'Consolidation',
    ['LIFO', 'FIFO', 'comparaison'],
    'Deux structures, deux règles. Tu complètes toi-même le tableau de comparaison, puis tu testes sur une même séquence.',
    '<table><thead><tr><th>Structure</th><th>Où ajoute-t-on ?</th><th>Où retire-t-on ?</th><th>Politique</th></tr></thead>'
    '<tbody><tr><td>Pile</td><td>?</td><td>?</td><td>?</td></tr><tr><td>File</td><td>?</td><td>?</td><td>?</td></tr></tbody></table>'
    '<p>Complète chaque case en quelques mots.</p>'
    '{{f:pile-ajout}}{{f:pile-retrait}}{{f:pile-politique}}{{f:file-ajout}}{{f:file-retrait}}{{f:file-politique}}'
    '<p>On ajoute successivement <strong>A, B, C, D</strong> dans chaque structure, puis on retire tout. Donne l’ordre de sortie.</p>'
    '{{f:sortie-pile}}{{f:sortie-file}}{{q:sequence-pile}}{{q:ordre-file}}',
    'Remplis le tableau, donne les deux ordres de sortie, puis réponds aux deux questions.', None,
    [
        q('sequence-pile', 'On empile A, B, C, D ; on dépile deux fois ; on empile E ; puis on dépile tout. Dans quel ordre sortent les éléments ?',
          ['D, C, E, B, A', 'D, C, A, B, E', 'A, B, C, D, E', 'D, C, B, A, E'], 0,
          'Les deux premiers dépilages donnent D puis C. La pile contient alors A, B ; E arrive au sommet, donc le dépilage final donne E, B, A. Ordre total : D, C, E, B, A.',
          ['Oui : D, C, puis E, B, A.', 'Après C, la pile contient A, B, puis E : E sort avant B et A.', 'C’est l’ordre d’arrivée : celui d’une file.', 'E est empilé après les deux dépilages : il est au sommet et sort avant B et A.']),
        q('ordre-file', 'Dans une file, la suite des sorties est-elle toujours dans l’ordre d’arrivée, quelles que soient les alternances d’ajouts et de retraits ?',
          ['Oui : un élément sort toujours après tous ceux arrivés avant lui', 'Non : cela dépend du nombre d’éléments', 'Non, sauf si on défile au moins deux fois de suite', 'Oui, mais seulement si la file n’a jamais été vide'], 0,
          'C’est la définition de FIFO : l’ordre relatif des éléments est conservé, quel que soit le moment où l’on défile.',
          ['Oui : c’est exactement FIFO.', 'Le nombre d’éléments ne change pas la règle.', 'Le nombre de défilages consécutifs ne change pas la règle.', 'Que la file ait été vide ou non ne change pas la règle.']),
    ],
    [
        f('pile-ajout', 'Pile : où ajoute-t-on ?', 'au sommet…', input='line'),
        f('pile-retrait', 'Pile : où retire-t-on ?', '…', input='line'),
        f('pile-politique', 'Pile : quelle politique (LIFO ou FIFO) ?', '…', input='line'),
        f('file-ajout', 'File : où ajoute-t-on ?', '…', input='line'),
        f('file-retrait', 'File : où retire-t-on ?', '…', input='line'),
        f('file-politique', 'File : quelle politique (LIFO ou FIFO) ?', '…', input='line'),
        f('sortie-pile', 'Ordre de sortie de la pile (A, B, C, D ajoutés dans cet ordre)', 'ex. : A, B, C, D', input='line', check=_check_pile),
        f('sortie-file', 'Ordre de sortie de la file (A, B, C, D ajoutés dans cet ordre)', 'ex. : A, B, C, D', input='line', check=_check_file),
    ],
    ['Pose-toi la question : quel élément est le plus facile à atteindre dans chaque structure ?', 'Pour la pile, imagine quatre livres posés les uns sur les autres : lequel prends-tu en premier ?'],
    'Pile : ajout et retrait au même endroit (LIFO). File : ajout à l’arrière, retrait à l’avant (FIFO). Sur A, B, C, D : la pile sort D, C, B, A ; la file sort A, B, C, D.',
    [])

MISSION = step(
    'mission', 'Mission', 'Mission : le centre d’impression Nexus', 22, 'Transfert',
    ['composition', 'file', 'pile', 'historique d’annulation', 'délégation'],
    'Tu utilises maintenant des structures pour résoudre un problème concret, en deux parties : une file de documents, puis un historique d’annulation.',
    '<p>Le centre d’impression du lycée reçoit des documents : <strong>DS_Maths.pdf</strong>, <strong>TP_NSI.pdf</strong>, <strong>Correction.pdf</strong>. Il les imprime dans l’ordre où ils arrivent.</p>'
    '<p>En haut de l’éditeur, les classes <code>File</code> et <code>Pile</code> te sont <strong>fournies</strong> : ce sont celles que tu viens d’écrire. Tu ne les réécris pas : tu <strong>les utilises</strong> comme des briques, en passant par leur interface seulement.</p>'
    '<p><strong>Partie A.</strong> Complète <code>FileImpression</code> : elle <em>contient</em> une <code>File</code> (dans un attribut) et traduit ses propres méthodes en opérations de file. Imprimer un centre vide lève <code>IndexError</code>, comme toute structure vide dans ce TP.</p>'
    '<p><strong>Partie B.</strong> Le centre a des réglages (nombre de copies, couleur). Chaque réglage peut être <strong>annulé</strong>, dans l’ordre inverse de leur application. Complète <code>Reglages.regler</code> et <code>Reglages.annuler</code> avec une <code>Pile</code> d’historique : on y empile le couple (nom, ancienne valeur) <em>avant</em> de modifier.</p>'
    '{{q:structure-annulation}}{{code}}{{f:justification}}',
    'Complète FileImpression (partie A) et Reglages (partie B) jusqu’à ce que tous les contrôles soient réussis, puis justifie tes choix de structures.',
    S.MISSION_STARTER,
    [
        q('structure-annulation', 'Pour annuler les réglages dans l’ordre inverse de leur application, quelle structure convient ?', ['Une file', 'Une pile', 'Une liste indexée par rang', 'Aucune : il faut tout recalculer'], 1,
          'Le dernier réglage appliqué doit être le premier annulé : c’est LIFO, donc une pile.',
          ['Une file annulerait d’abord le plus ancien réglage : pas ce qu’on veut.', 'Oui : LIFO.', 'Possible mais inutilement général : la règle voulue est exactement celle d’une pile.', 'Il suffit de mémoriser l’ancienne valeur à chaque modification.']),
    ],
    [f('justification', 'En une phrase : pourquoi l’historique d’annulation est-il une pile, alors que le centre d’impression est une file ?', 'Pense à l’ordre dans lequel on traite les éléments…')],
    ['Rappel : FileImpression ne recopie pas File, elle la contient (self._attente = File()) et délègue : soumettre → enfiler, prochain → premier, imprimer → defiler, en_attente → taille, est_vide → est_vide.',
     'Pseudo-code de Reglages : regler(nom, valeur) = empiler (nom, ancienne valeur), puis modifier ; annuler() = dépiler le couple, puis remettre l’ancienne valeur. Pile vide : l’erreur de la pile suffit.',
     'Fragment : self._historique.empiler((nom, self._valeurs[nom])) ; self._valeurs[nom] = valeur ; et dans annuler : nom, ancienne = self._historique.depiler() ; self._valeurs[nom] = ancienne.'],
    'Une structure se choisit selon la règle d’accès voulue : FIFO pour traiter dans l’ordre d’arrivée, LIFO pour revenir en arrière. Un objet peut contenir une structure et lui déléguer le travail.',
    ['Centre : un centre neuf n’a rien en attente', 'Centre : soumettre et en_attente', 'Centre : prochain consulte sans retirer', 'Centre : imprimer respecte FIFO',
     'Centre vide : prochain et imprimer lèvent IndexError', 'Réglages : regler et valeur', 'Réglages : annuler restaure la valeur précédente',
     'Réglages : annulations successives dans l’ordre inverse', 'Réglages : rien à annuler → IndexError'])

_SITUATIONS = [
    ('annuler', 'Le bouton « Annuler » d’un éditeur de texte', 1, 'Liste', 'Pile', 'File',
     'La dernière action effectuée est la première annulée : LIFO, donc une pile.'),
    ('guichet', 'Les personnes qui attendent à un guichet', 2, 'Liste', 'Pile', 'File',
     'La première arrivée est la première servie : FIFO, donc une file.'),
    ('playlist', 'Une playlist modifiable, où l’on peut insérer, retirer et lire le titre numéro 5', 0, 'Liste', 'Pile', 'File',
     'On accède aux éléments par leur rang et on modifie n’importe où : c’est une liste, ni LIFO ni FIFO.'),
    ('impression', 'Les travaux envoyés à une imprimante', 2, 'Liste', 'Pile', 'File',
     'Les travaux s’impriment dans l’ordre d’envoi : FIFO, donc une file.'),
    ('navigation', 'Le bouton « page précédente » d’un navigateur', 1, 'Liste', 'Pile', 'File',
     'La dernière page visitée est la première à quitter quand on revient en arrière : LIFO, donc une pile.'),
    ('appels', 'Les appels de fonctions imbriquées pendant l’exécution d’un programme', 1, 'Liste', 'Pile', 'File',
     'La dernière fonction appelée est la première à se terminer : LIFO, donc une pile (« pile d’appels »).'),
]


def _situation_q(sid, text, correct, a, b, c, why):
    names = [a, b, c]
    cf = [(f'Oui : {names[i]}.' if i == correct else f'Non : pas {names[i].lower()}. ' + why) for i in range(3)]
    return q(sid, text, names, correct, why, cf)


SYNTHESE = step(
    'synthese', 'Synthèse', 'Quelle structure pour quelle situation ?', 10, 'Consolidation',
    ['choix de structure', 'type abstrait de données'],
    'Dernier réflexe à acquérir : devant un problème, choisir la structure dont la règle d’accès correspond à ce qu’on veut faire.',
    '<p>Pour chaque situation, choisis la structure qui convient le mieux : liste, pile ou file. Lis l’explication après chaque réponse.</p>'
    + ''.join('{{q:%s}}' % s[0] for s in _SITUATIONS)
    + '<p>Et pour conclure…</p>{{f:abstrait}}',
    'Choisis la structure de chacune des six situations, puis réponds à la question finale.', None,
    [_situation_q(s[0], s[1], s[2], s[3], s[4], s[5], s[6]) for s in _SITUATIONS],
    [f('abstrait', 'Pourquoi dit-on qu’une pile et une file sont des types abstraits de données ?', 'Pense à ce qui les définit : leur comportement… ou leur représentation ?')],
    ['Une pile est-elle définie par la list qu’elle contient, ou par ce qu’on peut faire avec elle ?', 'Pense à la phrase : « leur comportement et leurs opérations sont définis indépendamment de leur… »'],
    'Une pile ou une file se définit par ses opérations et leur comportement, pas par la manière de les réaliser : c’est ce qui en fait des types abstraits de données.',
    [])

BONUS = step(
    'bonus', 'Bonus', 'Pour aller plus loin : la file avec deque', 0, 'Facultatif, hors des 120 min',
    ['collections.deque', 'coût', 'implémentation'],
    'Facultatif. Tu changes l’implémentation de la file sans changer son interface.',
    '<p>Le module <code>collections</code> fournit <code>deque</code>, une file à deux extrémités : <code>append</code> ajoute à droite, <code>popleft</code> retire à gauche <strong>sans décaler</strong> les autres éléments. Réécris la file avec une <code>deque</code> comme représentation.</p>'
    '{{q:popleft}}{{code}}{{f:interface}}'
    '<p><strong>Approfondissement (lecture seule).</strong> Une autre représentation consiste à relier des <em>maillons</em> : chaque maillon contient une valeur et une référence vers le suivant (une liste chaînée). Ce n’est pas nécessaire pour ce TP ; retiens simplement que la même interface de file peut reposer sur des représentations très différentes.</p>',
    'Complète FileDeque avec une deque, puis réponds aux deux questions.',
    S.BONUS_STARTER,
    [q('popleft', 'Pourquoi popleft est-il plus efficace que pop(0) sur une list ?',
       ['Il ne retire rien', 'Il retire à l’extrémité gauche sans décaler tous les autres éléments', 'Il trie les éléments', 'Il copie la file entière'], 1,
       'Une deque est conçue pour des ajouts et retraits aux deux extrémités sans décalage.',
       ['Il retire bien l’élément le plus à gauche.', 'Oui : pas de décalage.', 'Aucun tri n’est effectué.', 'Il ne copie rien.'])],
    [f('interface', 'Ton interface File a-t-elle changé en passant de list à deque ? Qu’est-ce que cela montre ?', 'Les méthodes sont-elles les mêmes ? Ce que voit l’utilisateur…')],
    ['Rappel : pour une deque d, d.append(x) ajoute à droite, d.popleft() retire à gauche, d[0] consulte la gauche.',
     'Pseudo-code : mêmes méthodes que File ; seules les lignes qui touchent à _elements changent.',
     'Fragment : return self._elements.popleft() pour defiler ; return self._elements[0] pour premier.'],
    'Changer d’implémentation sans toucher à l’interface est tout l’intérêt d’un type abstrait de données.',
    ['FileDeque : taille, premier et est_vide', 'FileDeque : FIFO', 'FileDeque : file vide → IndexError'])

STEPS = [REACTIVATION, TYPES_ABSTRAITS, LISTE, PILE, FILE, COMPARER, MISSION, SYNTHESE, BONUS]

CONTENT = {
    'version': '1.0.0',
    'title': 'TP POO 2 — Listes, piles et files',
    'subtitle': 'Organiser des données avec des objets',
    'session': 'TP POO 2 • Terminale NSI',
    'duration': 120,
    'ui': {'phases': True},
    'steps': STEPS,
}


# ─── Corrigé enseignant (document PRIVÉ, source du PDF) ──────────────────────

import html as _html

MODELES = {
    ('reactivation', 'independance'): 'Chaque appel Boite() exécute __init__, qui crée une NOUVELLE list pour cette instance. b1.contenu et b2.contenu sont deux objets distincts : ajouter à l’un ne modifie pas l’autre.',
    ('types-abstraits', 'interface-implementation'): 'L’interface est ce que l’on peut demander à la pile (empiler, dépiler, consulter le sommet) et le comportement attendu (LIFO). L’implémentation est la manière de le réaliser : une list, une deque, des maillons… L’utilisateur n’en dépend pas.',
    ('liste', 'politique'): 'None peut être une valeur réellement stockée : on ne distinguerait plus « indice invalide » de « élément None ». Une exception signale l’erreur là où elle se produit et ne peut pas passer inaperçue.',
    ('pile', 'politique'): 'None : simple mais ambigu (None peut être empilé) et l’erreur apparaît plus tard, ailleurs. Exception : explicite et immédiate, c’est le choix du TP (IndexError). Précondition : exige que tout appelant teste est_vide() ; un oubli donne un bug silencieux.',
    ('file', 'choix'): 'Réponse libre. Exemple : « premier à sortir au début de la list, car pop(0) le retire directement et premier() lit _elements[0] ». Accepter aussi la représentation inversée (insert(0, …) et pop()), à condition que l’élève explique que l’interface n’en est pas affectée.',
    ('comparer', 'pile-ajout'): 'Au sommet.',
    ('comparer', 'pile-retrait'): 'Au sommet (au même endroit que l’ajout).',
    ('comparer', 'pile-politique'): 'LIFO (dernier entré, premier sorti).',
    ('comparer', 'file-ajout'): 'À l’arrière (à l’entrée).',
    ('comparer', 'file-retrait'): 'À l’avant (à la sortie).',
    ('comparer', 'file-politique'): 'FIFO (premier entré, premier sorti).',
    ('comparer', 'sortie-pile'): 'D, C, B, A.',
    ('comparer', 'sortie-file'): 'A, B, C, D.',
    ('mission', 'justification'): 'Les documents doivent être traités dans l’ordre d’arrivée (FIFO) : file. Une annulation doit défaire d’abord la dernière action (LIFO) : pile.',
    ('synthese', 'abstrait'): 'Parce qu’elles sont définies par leurs opérations et leur comportement (LIFO / FIFO), indépendamment de la façon dont elles sont représentées en mémoire.',
    ('bonus', 'interface'): 'Non : les méthodes et leur comportement sont identiques. Seule l’implémentation change ; c’est tout l’intérêt d’un type abstrait de données.',
}

ERREURS = {
    'liste': [
        'Oublier d’initialiser _elements dans __init__ (AttributeError dès le premier appel).',
        'Accepter les indices négatifs (list[-1] « marche » en Python, mais le contrat de Liste les déclare invalides).',
        'Renvoyer None au lieu de lever IndexError pour un indice invalide.',
        'Écrire return dans ajouter (le contrat dit : ne rien renvoyer).',
    ],
    'pile': [
        'Confondre sommet() et depiler() : sommet ne doit pas retirer.',
        'Ne pas retirer dans depiler (return self._elements[-1]).',
        'Mélanger les extrémités : empiler à la fin mais dépiler au début (comportement FIFO).',
        'Utiliser un attribut de classe partagé (une seule list pour toutes les piles).',
    ],
    'file': [
        'Défiler à la fin de la list (comportement LIFO).',
        'Oublier la file vide (pop(0) lève déjà IndexError, mais le message « pop from empty list » ne respecte pas le contrat).',
        'Confondre premier() et defiler().',
    ],
    'mission': [
        'Recopier la logique de File dans FileImpression au lieu de la contenir et de lui déléguer.',
        'Empiler l’ancienne valeur seule, sans le nom du réglage : on ne sait plus quoi restaurer.',
        'Modifier la valeur AVANT de mémoriser l’ancienne : l’ancienne valeur est perdue.',
        'Utiliser une file pour l’historique d’annulation (annule le plus ancien réglage).',
    ],
    'bonus': ['Utiliser pop() au lieu de popleft() (comportement LIFO).', 'Oublier de tester la file vide : popleft lève IndexError avec un autre message.'],
}

VIGILANCE = [
    'Le mot « liste » : type abstrait (collection ordonnée avec interface) ≠ list de Python (type concret). Une pile réalisée avec une list n’est pas « une list ».',
    'Une seule convention de cas limite dans tout le TP : IndexError. L’annoncer dès l’étape Liste.',
    'Les contrôles automatiques vérifient le COMPORTEMENT, pas le code : une pile dont le sommet est au début de la list est correcte.',
    'Les restrictions de l’éditeur (noms commençant par un double tiret bas refusés, sauf __init__ et __len__ ; import interdit sauf collections.deque au bonus) sont pédagogiques, pas un dispositif de sécurité.',
    'Rythme : si la classe est en retard à la 75e minute, passer directement à la mission en s’appuyant sur les classes fournies ; la synthèse peut se faire à l’oral.',
]


def e(x):
    return _html.escape(x, quote=False)


def corrige_html():
    out = []
    out.append('<!--\n  Corrigé enseignant — TP POO 2 « Listes, piles et files ».\n  DOCUMENT PRIVÉ : jamais servi aux élèves. Généré par content/espace/nsi-structures-lineaires/build_content.py\n  à partir de solutions.py et de content.json : ne pas modifier à la main.\n-->')
    out.append('<h1>' + T('Corrigé enseignant — TP POO 2 : Listes, piles et files') + '</h1>')
    out.append('<p class="meta">' + T('Terminale · NSI · séance guidée d’environ 2 h · le parcours vérifie le comportement du code (pas sa forme) ; ce document donne les solutions de référence, les réponses attendues, les erreurs probables et les points de vigilance.') + '</p>')
    out.append('<div class="box">' + T('<strong>Convention du TP.</strong> Lire ou retirer dans une structure vide (ou à un indice invalide) lève <code>IndexError</code>. Interfaces : Liste (<code>est_vide, longueur, ajouter, element</code>), Pile (<code>est_vide, taille, empiler, sommet, depiler</code>), File (<code>est_vide, taille, enfiler, premier, defiler</code>).') + '</div>')
    out.append('<h2>' + T('Déroulé conseillé (114 min + bonus)') + '</h2><table><thead><tr><th>Étape</th><th>Durée</th><th>Niveau</th></tr></thead><tbody>')
    for st in STEPS:
        out.append('<tr><td>%s</td><td>%s</td><td>%s</td></tr>' % (e(T(st['title'])), 'facultatif' if st['id'] == 'bonus' else '%d min' % st['minutes'], e(T(st['level']))))
    out.append('</tbody></table>')
    for st in STEPS:
        out.append('<h2>%s</h2>' % e(T(st['title'])))
        out.append('<p><span class="tag">%s</span> %s</p>' % (e(st['id']), e(T(st['takeaway']))))
        for qq in st['questions']:
            out.append('<h3>%s</h3><p><strong>%s</strong> %s</p>' % (e(T(qq['text'])), T('Réponse attendue :'), e(T(qq['choices'][qq['correct']]))))
            out.append('<p>%s</p>' % e(T(qq['feedback'])))
            wrong = [(c, m) for i, (c, m) in enumerate(zip(qq['choices'], qq['choiceFeedback'])) if i != qq['correct']]
            out.append('<ul>' + ''.join('<li><em>%s</em> — %s</li>' % (e(T(c)), e(T(m))) for c, m in wrong) + '</ul>')
        for fl in st['fields']:
            m = MODELES.get((st['id'], fl['id']))
            assert m, (st['id'], fl['id'])
            out.append('<h3>%s</h3><p><strong>%s</strong> %s</p>' % (e(T(fl['label'])), T('Réponse attendue :'), e(T(m))))
        if st['id'] in S.SOLUTIONS:
            out.append('<h3>' + T('Solution de référence') + '</h3><pre>' + e(S.SOLUTIONS[st['id']].strip('\n')) + '</pre>')
            if st['id'] in S.ALTERNATIVES:
                out.append('<h3>' + T('Autre implémentation valide (représentation inversée)') + '</h3><pre>' + e(S.ALTERNATIVES[st['id']].strip('\n')) + '</pre>')
            out.append('<h3>' + T('Erreurs probables') + '</h3><ul>' + ''.join('<li>%s</li>' % e(T(x)) for x in ERREURS[st['id']]) + '</ul>')
            out.append('<h3>' + T('Contrôles automatiques') + '</h3><ul>' + ''.join('<li>%s</li>' % e(x) for x in st['tests']) + '</ul>')
    out.append('<h2>' + T('Points de vigilance') + '</h2><ul>' + ''.join('<li>%s</li>' % e(T(x)) for x in VIGILANCE) + '</ul>')
    return '\n'.join(out) + '\n'


if __name__ == '__main__':
    with open(os.path.join(HERE, 'content.json'), 'w', encoding='utf8') as fh:
        json.dump(CONTENT, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    cdir = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'docs', 'espace', 'corriges', 'nsi-poo2'))
    os.makedirs(cdir, exist_ok=True)
    with open(os.path.join(cdir, 'corrige.html'), 'w', encoding='utf8') as fh:
        fh.write(corrige_html())
    print('content.json écrit :', len(STEPS), 'étapes ;', sum(s['minutes'] for s in STEPS if s['id'] != 'bonus'), 'minutes obligatoires')
