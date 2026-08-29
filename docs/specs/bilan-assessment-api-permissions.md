# Matrice API et permissions — bilans canoniques v1

Toutes les routes sont couvertes par
`BILAN_CANONICAL_INTAKE_ENABLED`, faux par défaut.

| Méthode et route | Parent/élève | Assistante | Coach | Admin | Idempotence |
|---|---|---|---|---|---|
| `GET /requests/current/assignments` | propriétaire | non | non | non | non |
| `GET /requests/current/assignments/:id/definition` | propriétaire | non | non | non | non |
| `POST /requests/current/assignments/:id/attempt` | propriétaire | non | non | non | obligatoire |
| `GET /requests/current/attempts/:id/status` | propriétaire | non | non | non | non |
| `PUT /requests/current/attempts/:id/responses/:item` | propriétaire | non | non | non | obligatoire |
| `POST /requests/current/attempts/:id/submit` | propriétaire | non | non | non | obligatoire |
| `GET /requests/current/attempts/:id/report` | publication de son audience | non | non | non | non |
| `GET /team/requests` | non | oui | demandes affectées | oui | non |
| `GET /team/catalog` | non | oui | oui | oui | non |
| `POST /team/assignments` | non | oui | non | oui | obligatoire |
| `GET /team/manual-reviews` | non | non | affecté | oui | non |
| `POST /team/manual-reviews/:id/claim` | non | non | affecté | oui | obligatoire |
| `POST/PATCH /team/manual-reviews/:id/decision` | non | non | affecté | oui | obligatoire |
| `POST /team/attempts/:id/score` | non | oui | affecté | oui | obligatoire |
| `POST /team/reports/generate` | non | oui | affecté | oui | obligatoire |
| `POST /team/reports/:id/approve` | non | non | affecté | oui | obligatoire |
| `POST /team/reports/:id/publish` | non | non | affecté | oui | obligatoire |
| `POST /team/publications/:id/revoke` | non | non | affecté | oui | obligatoire |

## Contrôles communs

Les mutations utilisent :

1. flag central ;
2. session et rôle ;
3. CSRF et taille bornée ;
4. rate limiting distribué requis ;
5. paramètres et corps strictement validés ;
6. clé d'idempotence de 16–128 caractères ;
7. transaction et autorisation de ressource ;
8. audit sans PII.

Les dénis de propriété famille renvoient 404 non énumérable. Les erreurs
internes ne renvoient ni chemin, ni token, ni email, ni contenu de correction.

## Projections

La définition famille ne contient jamais `correct`, `rationale`,
`targetedObstacle`, `gradingCriteria` ou `admissibleAnswerExample`.
Le statut d'une tentative retourne les réponses propres à l'utilisateur, mais
aucun résultat attendu. Un bilan n'est retourné que si sa publication active
correspond à l'audience du principal.
