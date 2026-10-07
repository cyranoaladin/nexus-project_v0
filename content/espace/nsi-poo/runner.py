"""Contrôles formatifs du TP. Aucune exécution de ce fichier côté serveur.
Le moteur navigateur est interrompu par destruction de son Web Worker.
Le filtrage AST est une restriction pédagogique, PAS une sandbox de sécurité.
"""
import ast
import builtins
import contextlib
import io
import json
import traceback

MAX_CODE = 20000
MAX_OUTPUT = 6000

class LimitedOutput(io.StringIO):
    def write(self, text):
        available = MAX_OUTPUT - self.tell()
        if available > 0:
            super().write(text[:available])
        return len(text)


def check_source(code):
    if not isinstance(code, str) or len(code) > MAX_CODE:
        raise ValueError('Le code doit contenir au plus 20 000 caractères.')
    tree = ast.parse(code, filename='mon_programme.py')
    if sum(1 for _ in ast.walk(tree)) > 5000:
        raise ValueError('Programme trop volumineux pour cet atelier.')
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise ValueError('Cet atelier utilise seulement les classes Python : aucun import n’est nécessaire.')
        if isinstance(node, ast.Attribute) and node.attr.startswith('__') and node.attr != '__init__':
            raise ValueError('L’introspection avancée n’est pas disponible dans cet atelier.')
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith('__') and node.name != '__init__':
            raise ValueError('Seule la méthode spéciale __init__ est utilisée ici.')
        if isinstance(node, ast.Name) and node.id in {'eval','exec','compile','open','input','globals','locals','__import__'}:
            raise ValueError('Les fichiers, les imports, input et l’exécution dynamique ne sont pas utilisés ici. Renseigne directement tes données.')
    return tree


def run_submission(code, step, mode='test'):
    out = LimitedOutput()
    results = []
    allowed = ['__build_class__','object','print','len','range','int','float','str','bool','list','dict','set','tuple','min','max','sum','abs','enumerate','zip','sorted','reversed','isinstance','type','all','any','Exception','ValueError','TypeError','AssertionError']
    ns = {'__builtins__': {k:getattr(builtins,k) for k in allowed}, '__name__':'__eleve__'}
    try:
        tree = check_source(code)
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            exec(compile(tree, 'mon_programme.py', 'exec'), ns, ns)
    except BaseException as exc:
        if isinstance(exc, SyntaxError):
            detail=f'{type(exc).__name__}, ligne {exc.lineno} : {exc.msg}'
        else:
            frames=traceback.extract_tb(exc.__traceback__)
            line=next((f.lineno for f in reversed(frames) if f.filename=='mon_programme.py'),None)
            detail=f'{type(exc).__name__}'+(f', ligne {line}' if line else '')+f' : {exc}'
        return {'ok':False,'error':detail,'output':out.getvalue(),'tests':[],'mode':mode}

    def verify(label, fn):
        try:
            with contextlib.redirect_stdout(LimitedOutput()), contextlib.redirect_stderr(LimitedOutput()):
                fn()
            results.append({'label':label,'pass':True,'message':'Cas vérifié.'})
        except BaseException as exc:
            results.append({'label':label,'pass':False,'message':str(exc)[:800] or type(exc).__name__})

    def expect(condition, message):
        if not condition:
            raise AssertionError(message)

    def livre_class():
        C=ns.get('Livre')
        expect(isinstance(C,type),'Définis une classe nommée Livre.')
        return C

    def constructed():
        C=livre_class()
        a=C('Essai','Autrice')
        expect(vars(a).get('titre')=='Essai','self.titre doit mémoriser le paramètre titre.')
        expect(vars(a).get('auteur')=='Autrice','self.auteur doit mémoriser le paramètre auteur.')
        expect(vars(a).get('disponible') is True,'Chaque instance doit posséder disponible = True au départ.')

    def instances_named():
        a,b=ns.get('livre1'),ns.get('livre2')
        C=livre_class()
        expect(isinstance(a,C) and isinstance(b,C),'Crée livre1 et livre2 avec Livre(...).')
        expect((a.titre,a.auteur)==('Dune','Frank Herbert'),'livre1 doit représenter Dune / Frank Herbert.')
        expect((b.titre,b.auteur)==('1984','George Orwell'),'livre2 doit représenter 1984 / George Orwell.')
        expect(a is not b,'Deux appels à Livre(...) sont nécessaires : une affectation ne crée pas une copie.')

    def independence():
        C=livre_class(); a=C('A','X'); b=C('B','Y'); a.disponible=False
        expect(b.disponible is True,'Modifier le premier objet ne doit pas modifier le second.')
        expect('disponible' in vars(a) and 'disponible' in vars(b),'disponible doit être un attribut de chaque instance.')

    def descriptions():
        C=livre_class()
        for title,author in [('Dune','Frank Herbert'),('Une autre histoire','Une autrice'),('','Anonyme')]:
            a=C(title,author)
            expect(a.description()==title+' / '+author,'description() doit renvoyer titre + " / " + auteur, pas None ni une valeur fixe.')

    def availability():
        C=livre_class(); a=C('A','X')
        expect(a.est_disponible() is True,'est_disponible() doit renvoyer True au départ.')
        a.disponible=False
        expect(a.est_disponible() is False,'La réponse doit refléter self.disponible, et non être toujours True.')

    def no_effects():
        C=livre_class(); a=C('A','X'); before=vars(a).copy(); buf=LimitedOutput()
        with contextlib.redirect_stdout(buf):
            a.description(); a.est_disponible()
        expect(vars(a)==before,'Une consultation ne doit pas modifier l’état.')
        expect(buf.getvalue()=='','Les méthodes de consultation doivent renvoyer, pas afficher.')

    def loan():
        C=livre_class(); a=C('A','X')
        expect(a.emprunter() is True,'Premier emprunt : renvoyer True.')
        expect(a.disponible is False,'Premier emprunt : disponible devient False.')
        before=vars(a).copy()
        expect(a.emprunter() is False,'Deuxième emprunt : renvoyer False.')
        expect(vars(a)==before,'Une action refusée ne doit pas modifier l’état.')

    def give_back():
        C=livre_class(); a=C('A','X')
        expect(a.rendre() is False,'Rendre un livre déjà disponible doit être refusé.')
        a.emprunter()
        expect(a.rendre() is True and a.disponible is True,'Un retour valide renvoie True et rend le livre disponible.')
        expect(a.rendre() is False and a.disponible is True,'Un second retour renvoie False sans changer l’état.')

    def loan_independent():
        C=livre_class(); a=C('A','X'); b=C('B','Y'); a.emprunter()
        expect(b.disponible is True,'L’emprunt d’un livre ne modifie pas un autre livre.')
        buf=LimitedOutput()
        with contextlib.redirect_stdout(buf):
            a.rendre(); a.emprunter()
        expect(buf.getvalue()=='','Les méthodes ne doivent pas afficher : les print des essais sont à l’extérieur.')

    def aliases():
        a,b,c=ns.get('a'),ns.get('b'),ns.get('c')
        C=livre_class()
        expect(all(isinstance(o,C) for o in [a,b,c]),'Le programme doit créer a, b et c.')
        expect(a is b and a is not c,'a et b désignent le même objet ; c doit être une autre instance.')
        expect((a.disponible,b.disponible,c.disponible)==(False,False,True),'Après b.emprunter(), les états attendus sont False, False, True.')

    def salle():
        C=ns.get('Salle'); expect(isinstance(C,type),'Définis la classe Salle.'); return C

    def salle_init():
        C=salle(); a=C('Ada',7)
        expect((a.nom,a.capacite,a.libres)==('Ada',7,7),'Le nom, la capacité et le nombre initial de places libres doivent être mémorisés.')
        before=vars(a).copy()
        expect(a.places_disponibles()==7,'places_disponibles() renvoie le nombre libre.')
        expect(before==vars(a),'La consultation ne modifie pas la salle.')

    def salle_valid():
        C=salle(); a=C('Ada',5)
        expect(a.reserver(2) is True and a.libres==3,'Réserver 2 sur 5 doit réussir et laisser 3 places libres.')
        expect(a.reserver(3) is True and a.libres==0,'Réserver exactement le reste doit être accepté.')
        expect(a.liberer(4) is True and a.libres==4,'Libérer 4 places occupées doit réussir.')
        expect(a.nom=='Ada' and a.capacite==5,'Le nom et la capacité ne doivent pas être modifiés.')

    def salle_refus():
        C=salle(); a=C('Ada',3)
        for n in [0,-1,4,100]:
            before=vars(a).copy()
            expect(a.reserver(n) is False,f'Une réservation de {n} doit être refusée dans une salle de 3 places libres.')
            expect(vars(a)==before,'Un refus de réservation ne doit rien modifier.')
        a.reserver(2)
        for n in [0,-1,3,100]:
            before=vars(a).copy()
            expect(a.liberer(n) is False,f'Avec 2 places occupées, la libération de {n} doit être refusée.')
            expect(vars(a)==before,'Un refus de libération ne doit rien modifier.')

    def salle_long():
        C=salle()
        for cap in [1,2,5,8]:
            a=C('Test',cap); free=cap
            for op,n in [('r',1),('r',cap),('l',1),('l',cap),('r',cap),('l',cap),('r',0),('l',-2)]:
                valid=(0<n<=free) if op=='r' else (0<n<=cap-free)
                ans=a.reserver(n) if op=='r' else a.liberer(n)
                if valid: free += -n if op=='r' else n
                expect(ans is valid and a.libres==free and a.places_disponibles()==free,'Une séquence alternant succès et refus n’est pas conforme au contrat.')
                expect(0<=a.libres<=a.capacite,'Le nombre libre doit rester entre zéro et la capacité.')
        a=C('A',2); b=C('B',2); a.reserver(2)
        expect(b.libres==2,'Les instances de Salle doivent rester indépendantes.')

    def carnet():
        C=ns.get('Carnet'); expect(isinstance(C,type),'Définis la classe Carnet.')
        a=C('A'); b=C('B'); a.ajouter('une note')
        expect(a.notes==['une note'] and b.notes==[],'Chaque carnet doit posséder sa propre liste vide au départ.')
        expect(a.notes is not b.notes,'Les deux listes ne doivent pas être le même objet.')
        expect('notes' in vars(a) and 'notes' in vars(b),'Crée self.notes dans __init__.')

    groups={
      'reperes':[('Initialisation des objets',constructed),('Deux livres correctement construits',instances_named)],
      'instances':[('Attributs d’instance',constructed),('Instanciations demandées',instances_named),('Indépendance des états',independence)],
      'consulter':[('Valeurs renvoyées par description',descriptions),('Booléen réellement consulté',availability),('Absence de mutation et d’affichage',no_effects)],
      'agir':[('Emprunt et répétition refusée',loan),('Retour et répétition refusée',give_back),('Indépendance et absence d’affichage',loan_independent)],
      'references':[('Identité et état des objets',aliases)],
      'mission':[('Initialisation et consultation',salle_init),('Actions acceptées',salle_valid),('Actions refusées sans mutation',salle_refus),('Séquences et indépendance',salle_long)],
      'bonus':[('Une liste par instance',carnet)]}
    if mode=='test':
        if step not in groups:
            return {'ok':False,'error':'Étape sans test de code.','output':out.getvalue(),'tests':[],'mode':mode}
        for name, fn in groups[step]: verify(name,fn)
    return {'ok':all(t['pass'] for t in results),'error':None,'output':out.getvalue(),'tests':results,'mode':mode}
