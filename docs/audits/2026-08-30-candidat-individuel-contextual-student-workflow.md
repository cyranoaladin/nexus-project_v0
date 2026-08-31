# Workflow contextuel élève vers devis candidat individuel

## Date

30 août 2026

## Contexte

Le simulateur renvoyait vers l'espace Élèves sans transmettre d'intention métier. L'annuaire ne permettait donc ni de choisir un élève existant pour le devis, ni de réutiliser immédiatement un élève créé.

## Problèmes observés

- lien générique vers l'annuaire Élèves ;
- aucune action contextuelle par élève ;
- identifiants retournés par la création ignorés par le parcours devis ;
- aucun retour autoritatif via `identity/resolve` ;
- appel interactif de résolution sans timeout.
- mode contextuel initialement couplé à l'endpoint du domaine crédits ;
- capacité ADMIN normale remplacée silencieusement par une simple consultation ;
- transport URL temporaire du `Student.id`, incompatible avec la présence globale de l'analytics.

## Décisions prises

- intent fermé `candidat-individuel`, sans `returnTo` client ;
- destinations déduites exclusivement du rôle `ADMIN` ou `ASSISTANTE` ;
- annuaire contextuel alimenté exclusivement par `GET /api/assistante/students`, avec recherche et pagination serveur ;
- mode normal ASSISTANTE conservé sur l'annuaire crédits, sans changement de ses actions ;
- mode normal ADMIN doté de l'action directe « Utiliser pour un devis candidat individuel » ;
- transport one-shot same-tab dans `sessionStorage`, sans identifiant dans l'URL ;
- enveloppe versionnée liée au rôle, expirant après deux minutes, consommée puis supprimée avant validation ;
- résolution obligatoire par l'API existante `identity/resolve` ;
- même fonction de résolution pour la recherche inline et le retour contextuel ;
- timeout de 10 secondes, abort au démontage et retry explicite ;
- dossiers incomplets visibles mais non sélectionnables, avec justification humaine liée au contrôle ;
- validation stricte du vrai `Student.id`, distinct du `User.id`, et des identifiants relationnels attendus ;
- génération de requête empêchant une réponse de recherche obsolète d'écraser la réponse courante ;
- verrou anti-double-clic réarmé lors d'une restauration BFCache ;
- purge du handoff lorsque le pipeline n'est pas `ACTIVE_INTERNAL`.
- sémantique d'ancre native conservée pour un élève existant : destination fermée par rôle, focus clavier puis `Enter`, sans synthèse artificielle de `Space` ;
- `Space` est réservé aux vrais boutons de confirmation, de retry et de rechargement ; les clics modifiés ou auxiliaires ne créent aucun handoff ;
- gate statique bloquant contre une régression vers `Button`, `next/link` ou un handler clavier artificiel sur les actions candidat.
- preuve Chromium par rôle : lorsque l'ancre a le focus, la touche physique `Space` ne change ni l'URL, ni le handoff, ni le nombre d'appels `identity/resolve`; `Enter` effectue ensuite l'unique activation native.

## Fichiers modifiés

- pages Élèves ADMIN et ASSISTANTE ;
- `StaffStudentsPage` et `StudentsManagementWorkspace` ;
- `CandidatIndividuelWorkspace` ;
- helpers de navigation et de résolution d'identité ;
- normalizer du répertoire candidat individuel ;
- tests unitaires, composants, pages et E2E candidat individuel.

## Tests exécutés

- typecheck et lint ;
- unitaires et composants ciblés ;
- API, DB, intégration PostgreSQL réelle ;
- gels d'architecture et sécurité PR180 ;
- E2E standalone pour création et sélection contextuelle ADMIN/ASSISTANTE ;
- build Next.js standalone et audit d'artefact.

## Résultats

Le RC couvre les parcours contextuels existant et créé jusqu'à l'identité complète et au Profil. Les capacités normales ADMIN et ASSISTANTE sont conservées. Aucun redirect arbitraire, aucun `Student.id` dans l'URL et aucune migration n'ont été introduits. La production reste inchangée tant que la trace live P1-A n'est pas terminée.

`KEYBOARD_SEMANTICS = PASS/DOCUMENTED` : les ancres utilisent `Tab+Enter`, leur non-activation par `Space` est prouvée dans Chromium, et les boutons réels couvrent aussi `Space`.

## Risques restants

L'incident P1-A de sélection inline dans le Chrome habituel de la direction reste indépendant et attend les deux traces live prévues.

## Rollback

Aucun cutover n'est réalisé dans ce lot avant la trace live. La production reste sur `ca2b86efa0c552277bc3a98c03c3944be8459835`.
