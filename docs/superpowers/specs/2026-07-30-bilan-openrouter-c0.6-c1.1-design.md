# Bilans OpenRouter C0.6 / C1.1 — Design

## Date

30 juillet 2026, Africa/Tunis.

## Contexte et décisions owner

Le lot C0 a supprimé l'avis `brace-expansion` en forçant toutes les lignées
vers `5.0.8`, mais son adaptateur `postinstall` modifie des fichiers tiers dans
`node_modules`. Cet état n'est pas acceptable pour la fondation finale.

Le contrat OpenRouter C1 est isolé du moteur métier. C1.1 doit conserver cette
frontière tout en versionnant le plan de tentatives, en exposant une provenance
sûre complète, en utilisant des budgets entiers en micro-USD et en liant le
preflight à la politique, à la clé privée et au SHA logiciel.

Décisions owner appliquées sans arbitrage supplémentaire :

- politique de retry `bilan-retry-policy-v1` ;
- plan primaire, fallback, fallback ;
- trois tentatives au maximum ;
- `max_output_tokens=2048` ;
- budgets pilote 300 000 / 750 000 / 15 000 000 micro-USD ;
- `temperature`, `top_p`, `seed` et `usage.include` absents des requêtes ;
- aucun raccordement métier, worker, queue ou migration dans ce lot.

## Alternatives de remédiation évaluées

### A — Conserver l'override `brace-expansion` et le monkey patch

Rejetée. L'installation n'est pas une matérialisation native du lockfile et
les tests vérifient un arbre modifié après coup.

### B — Migrer vers une chaîne d'outils native maintenue

Retenue. Elle remplace les parents historiques :

- ESLint 8 et `eslint-config-next` legacy par ESLint 10 et une configuration
  flat composée de plugins publiés compatibles ESLint 10 ;
- Jest 29 par Jest 30 ;
- le CLI `@cyclonedx/cyclonedx-npm` et sa dépendance native `libxmljs2` par la
  commande officielle `npm sbom` ;
- les lignées historiques `glob` et `test-exclude` par `glob@13` et
  `test-exclude@8`, testées contre les consommateurs Jest.

Le graphe expérimental obtenu contient uniquement `minimatch@10` et
`brace-expansion@5.0.8`, sans peer conflict ni audit npm.

### C — Remplacer ESLint/Jest par une nouvelle toolchain complète

Rejetée. Une migration Biome/Vitest/Oxlint serait plus large, modifierait les
gates de qualité et dépasserait le besoin de remédiation.

## Architecture C0.6

`npm ci` doit produire directement l'arbre utilisé par les tests, le lint, les
SBOM et le build. Aucun script d'installation ne modifie `node_modules`.

Le lint est exécuté directement par ESLint 10 avec une configuration flat :

- règles Next core-web-vitals via `@next/eslint-plugin-next` ;
- règles TypeScript via `typescript-eslint` ;
- hooks React via `eslint-plugin-react-hooks` ;
- imports via `eslint-plugin-import-x` ;
- accessibilité JSX via `eslint-plugin-jsx-a11y-x` ;
- règles Nexus existantes conservées pour API, composants, `app/` et `lib/`.

Le SBOM complet et runtime est généré par `npm sbom --sbom-format cyclonedx
--package-lock-only`. Le script runtime conserve l'augmentation contrôlée de
`@emnapi/runtime`, puis vérifie structure, graphe, unicité des références et
présence des champs CycloneDX attendus sans réintroduire de CLI natif.

Deux checkouts propres doivent produire les mêmes hashes pour `package.json`,
`package-lock.json`, le graphe npm normalisé et les SBOM normalisés. Les champs
non déterministes du SBOM sont exclus du checksum comparatif, pas du document
archivé.

## Architecture C1.1

La politique modèle porte un `retryPolicy` immuable. Le client itère exactement
sur `attemptPlan`; aucune dérivation depuis une liste primaire/fallback n'est
autorisée.

Chaque appel retourne :

```text
data + provenance finale + attempts sûres
```

Une tentative échouée est conservée dans le résultat d'erreur normalisé sans
prompt, réponse, message fournisseur ou donnée utilisateur. Les montants
monétaires utilisent des entiers sûrs en micro-USD. La conversion depuis les
variables décimales est réalisée caractère par caractère, avec six décimales
au maximum et sans conversion intermédiaire par `Number`.

Le client lit une enveloppe d'erreur bornée et n'en conserve qu'un signal
normalisé. Un 503 générique reste `OPENROUTER_PROVIDER_UNAVAILABLE`;
`OPENROUTER_NO_COMPLIANT_PROVIDER` exige un code fournisseur reconnu dans une
enveloppe schema-validée.

Seul `finish_reason=stop` produit une donnée valide. Toute autre valeur produit
`OPENROUTER_INCOMPLETE_RESPONSE`.

## Preflight et confidentialité

La preuve contient :

- checksums de preuve, catalogue, politique et capacités ;
- empreinte non réversible de la clé ;
- SHA logiciel exact ;
- `verifiedAt` et `expiresAt`, durée maximale 24 heures ;
- snapshots dont `fetchedAt` précède `verifiedAt` avec un écart borné.

La preuve est validée avant tout appel de complétion. Le preflight privé lit la
clé depuis un fichier régulier local `0600`, dans un dossier `0700`, sans
symlink, sans affichage et sans argument de commande.

Le catalogue `/api/v1/models` possède une limite dédiée distincte de la limite
des réponses Chat Completions. Aucune donnée réelle de mineur n'est utilisée.
Si les réglages de confidentialité du compte ne sont pas vérifiables par API,
le rapport doit déclarer un gate humain et non un succès.

## Tests et rollback

Chaque comportement est introduit par un test rouge, puis rendu vert. Les
tests utilisent un serveur HTTP local ; la CI ne contacte jamais OpenRouter.

Le rollback C0.6 revient au commit précédent sans migration de données. Le
rollback C1.1 conserve `BILAN_REPORT_GENERATION_MODE=DISABLED`. Aucun changement
de production ou de base de données n'est requis.

