# Couverture E2E — moteur canonique de bilans

## Stratégie

Trois couches se complètent :

1. services + PostgreSQL réel pour les transactions, contraintes et
   concurrences ;
2. routes unitaires pour auth, rôles, rate limiting et projections ;
3. Playwright sur le standalone pour le parcours, l'accessibilité et
   l'absence de corrigé dans le DOM.

La fixture positive publiée est injectée uniquement dans les services de test.
Elle n'est accessible par aucune route. Le catalogue réel reste entièrement
`HUMAN_VALIDATION_REQUIRED`, donc un E2E HTTP positif complet avec ce catalogue
serait une violation et reste bloqué jusqu'à validation humaine.

## Matrice

| Parcours exigé | Service PostgreSQL | Route HTTP | Playwright | État |
|---|---:|---:|---:|---|
| parent → affectation → tentative → autosave → soumission | oui | oui | oui, contrats interceptés | intégré et testé |
| réponse manuelle → attente | oui | oui | oui | intégré et testé |
| correcteur → claim → correction → score | oui | oui | interface composant | intégré et testé |
| équipe → génération → approbation → publication | oui | oui | interface composant | intégré et testé |
| parent → bilan publié | oui | oui | oui | intégré et testé |
| parent étranger refusé | oui | 404 non énumérable | non nécessaire | intégré et testé |
| Redis coupé → fail-closed | intégration rate limiter existante | 503 testé | non nécessaire | intégré et testé |
| double start/autosave/submit | oui, concurrence réelle | contrats | non | intégré et testé |
| deux correcteurs | oui, concurrence réelle | rôle/ressource | non | intégré et testé |
| double score/publication | oui, concurrence réelle | idempotence | non | intégré et testé |
| corpus réel positif | refus attendu | refus attendu | refus attendu | validation humaine requise |

## Critère de levée du dernier verrou

Après approbations nominatives liées au hash d'au moins un module :

1. provisionner une demande et une affectation de test autorisées ;
2. exécuter le workflow HTTP sans interception sur PostgreSQL et Redis réels ;
3. vérifier SMTP sur une boîte de test ;
4. conserver les flags production faux ;
5. ajouter la preuve au dossier de release.
