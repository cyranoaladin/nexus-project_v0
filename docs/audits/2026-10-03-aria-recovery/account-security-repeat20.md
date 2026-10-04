# Qualification répétée de la sécurité du compte mobile

## Lacune observée

Sur 699343b4bb03a5b336d94f0ad3c905bc8bf2420f, les scénarios de changement de mot de passe à 390/1440 px étaient verts en Chromium (528 tests), mais exécutés une fois seulement. Le smoke mobile ne sélectionnait pas ces fichiers. Les contextes créés directement depuis browser n’héritaient pas automatiquement du profil mobile du projet.

## Contrat du runner officiel

Le job auth multi-navigateurs conserve ses scénarios et inclut désormais les deux fichiers sécurité en Firefox, WebKit et mobile. Après cette campagne, une étape explicite exécute seulement leurs cas 390px, vingt fois chacun, un worker et zéro retry. Elle utilise les services jetables et le même standalone que le job ; aucun paiement, provider réel ni envoi externe. Chaque contexte reçoit user-agent, tactile, mode mobile et densité du projet, puis vérifie les caractéristiques navigateur avant interaction. Les limites du Redis jetable sont réinitialisées uniquement au début de chaque fixture, après le garde de cible ; aucun réglage de rate limit produit n’est abaissé.

Le rapport de répétition a un label distinct. Le publisher expurgé est obligatoire avant qualification. Le validateur exige les signatures exactes des deux cas, projet mobile-smoke, vingt résultats réussis par cas, aucun retry/skip/fixme/échec attendu, quarante réussites globales, aucune erreur et le head.sha identique au HEAD exécuté. Il écrit une preuve nouvelle sans écraser un fichier. Seules les preuves expurgées sont publiées, avec SHA/run/attempt dans le nom et conservation sept jours. Les traces des formulaires de mot de passe restent désactivées pour ne pas enregistrer leurs valeurs.

## Vérifications locales

Le workflow antérieur échouait aux deux nouveaux tests de contrat (étape et preuve absentes). Gouvernance complète après correction : 24 suites et 256 tests verts. Le validateur possède quinze cas négatifs, notamment 19 répétitions, doublon, mauvais viewport/projet, skip, retry, erreur et rapport brut. Collection canonique --list avec manifest strictement synthétique : 40 tests dans 2 fichiers. Le premier typecheck a refusé screen, propriété non exposée par Project.use ; aucun cast/bypass ajouté, seuls les champs reconnus sont conservés. Typecheck corrigé et ESLint ciblé verts.

La campagne réelle de quarante exécutions n’a pas encore tourné sur ce changement. Le build Docker local est limité par le plancher de cinquante Gio ; le runner officiel GitHub est utilisé pour l’exécution. Une simple collection ne vaut pas réussite E2E. Aucun seuil ni assertion produit affaiblis.

## Rollback

Aucune migration ni donnée de production. Si une répétition échoue, conserver la preuve et corriger sa première cause ; ne pas supprimer la campagne pour passer au vert.
