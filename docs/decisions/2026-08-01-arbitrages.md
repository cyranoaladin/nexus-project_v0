# Arbitrages du chantier bilans — A0 à A13

## Date

2026-08-01

## Correspondance canonique des kits

- kit_v0 : socle technique — code, spécifications 01 à 07, fixtures, données et ADR-0012.
- kit_v1 : décisions du 31 juillet, missions M0 et M2, procédure de repli.
- kit_v2 : architecture cible — ADR-0013, SPEC-08, PLACEMENT et mission M1.

Les anciens noms kit_0 et kit_2 désignaient respectivement kit_v0 et kit_v2. Ils ne sont
plus canoniques.

## A0 — Secret openrouter_cle.txt

**Constat.** Le fichier, non suivi et non ignoré à la racine sur origin/main, aurait été
inclus par le git add -A prévu dans PLACEMENT.

**Décision.** Ignorer le fichier avant tout rangement, interdire git add -A, utiliser un
staging explicite, vérifier chemin et motif sur toutes les références, puis déplacer la
clé hors dépôt.

**Motif.** Un secret ne doit pas vivre dans un répertoire parcouru par des agents et un
script de rangement ne doit jamais stager en aveugle.

**Résultat.** Chemin jamais committé, scan de tous les blobs à zéro, clé déplacée dans
~/.config/nexus/openrouter.key en 600, répertoire en 700. Aucune révocation nécessaire.
.env.production, .env.local et .env.test sont également en 600.

## A1 — Composition des moteurs — SUPERSEDED PAR A97

**Constat.** computeScoringV2 et computeFacts semblaient concurrents faute d’articulation.

**Décision.** computeScoringV2 est l’autorité sur les domaines et la couverture ;
computeFacts sur les profils par item et par nœud. buildFactSheet(scoringV2, facts) est
leur unique point de sortie.

**Motif.** Conserver chaque source de vérité sans moteur parallèle ni appel direct depuis
un agent ou un rendu.

## A2 — Échec de validation sans nouvel état

**Constat.** La SPEC-08 proposait REPORT_REJECTED, absent de la machine à états active.

**Décision.** Après reprise, un échec reste REPORT_PENDING_REVIEW avec
validationFailures[] non vide et ne peut jamais atteindre PUBLISHED. COACH_REJECTED reste
un rejet humain.

**Motif.** Éviter une migration d’enum et distinguer validation automatique et décision
humaine.

## A3 — Statut des ADR

**Constat.** Les statuts ne reflétaient pas la décision produit du 1er août.

**Décision.** ADR-0013 est acceptée par Nexus le 2026-08-01. ADR-0012 est conservée avec
le statut SUPERSEDED by ADR-0013.

**Motif.** Préserver l’historique tout en rendant la cible non ambiguë.

## A4 — Deux validations cumulatives

**Constat.** Validation du pack et validation de chaque rapport pouvaient être confondues.

**Décision.** Le pack exige review.validatedBy et validatedAt par un enseignant de la
discipline. Chaque rapport exige COACH_VALIDATED. Modifier un prompt incrémente la version
du pack et annule sa validation.

**Motif.** La qualité d’une banque ne garantit pas celle de chaque restitution.

## A5 — Rattachement de la passation

**Constat.** La passation anonyme rattachée à un Lead contredit la chaîne d’ownership.

**Décision.** La passation exige Assessment → Student → Parent. Le lead-capture-first
concerne uniquement la demande de bilan.

**Motif.** Respecter l’autorisation d’accès et éviter une seconde identité métier.

## A6 — Duplicat du kit

**Constat.** Une nouvelle version de kit_v0 se trouvait dans le dépôt alors qu’une copie
antérieure existait hors dépôt.

**Décision.** La version racine fait autorité : comparer, rapporter, rafraîchir la copie
hors dépôt puis retirer le kit de la racine. Arrêt si moteur ou cas dorés diffèrent.

**Motif.** Les kits sont les sources de copie, jamais une seconde source de vérité.

**Résultat.** scoring.ts et golden-cases.json sont identiques byte-for-byte. La nouvelle
version apporte l’arborescence complète. L’ancienne copie est archivée dans
/tmp/kits/kit_0.20260801-pre-refresh.

## A7 — Fournisseur paramétrable

**Constat.** ADR-009 rendait OpenRouter canonique, ADR-0013 privilégiait Ollama.

**Décision.** Le fournisseur est résolu au runtime et contraint par une allowlist
versionnée. ADR-009 est amendée seulement sur sa clause de fournisseur canonique.

**Motif.** L’architecture ne doit dépendre d’aucun fournisseur.

## A8 — Gateway métier unique

**Constat.** Le client bas niveau accepte des messages arbitraires et contourne la PII.

**Décision.** Le seul point d’entrée sera lib/bilans/llm/gateway.ts, avec une
PseudonymizedFactSheet et un ValidatedPack. Il impose pseudonymisation, appel, V1 à V7,
reprise éventuelle puis REPORT_PENDING_REVIEW. Le client bas niveau est réservé au
gateway et aux scripts d’audit.

**Motif.** Un garde-fou contournable n’est pas un garde-fou.

## A9 — Allowlist versionnée

**Constat.** Les identifiants de modèles étaient recopiés dans les types TypeScript.

**Décision.** Ils vivent dans une politique versionnée unique. Configuration ou pack
choisit dans l’allowlist, sans fallback silencieux.

**Motif.** Éviter le couplage du métier à un fournisseur ou modèle.

## A10 — Reprise ciblée

**Constat.** La branche OpenRouter complète diverge de 196 commits de main.

**Décision.** Aucun merge global. Reprise fichier par fichier ou par commits identifiés,
pendant M1 et après V1 à V7.

**Motif.** Réduire le risque et adapter chaque brique à ADR-0013.

## A11 — Harnais de benchmark seulement

**Constat.** Les résultats sont invalidés par un changement du contrat de sécurité.

**Décision.** Ne pas les utiliser pour choisir un modèle. Réutiliser seulement le harnais,
étendu à 20 FactSheets et trois audiences.

**Motif.** L’outillage reste utile, ses résultats ne constituent aucune preuve.

## A12 — Chemin de clé non réconcilié

**Constat.** Ancienne branche et clé isolée utilisent deux chemins différents.

**Décision.** Ne rien modifier maintenant. En M1, le chemin sera configuré, jamais littéral.

**Motif.** Le décalage empêche une activation accidentelle.

## A13 — Frontière PII à adapter

**Constat.** pii.ts et contracts.ts offrent une frontière fail-closed de qualité mais
non obligatoire.

**Décision.** La reprendre en priorité en M1.6 comme base de V6, sans réécriture, puis la
rendre obligatoire via le gateway A8.

**Motif.** Conserver le travail éprouvé et supprimer la possibilité de contournement.

## A14 — Convention de nommage des tests

**Constat.** Le kit livrait deux suites en .spec.ts alors que la convention collectée par
jest.unit.config.js et utilisée dans le dépôt est .test.ts. Les suites n’étaient donc pas
ramassées par le job unit de la CI.

**Décision.** Renommer les suites en compute-facts.test.ts et
lexique-interdit.test.ts. Ne pas modifier jest.unit.config.js.

**Motif.** Le kit s’aligne sur la convention unique du dépôt. Ajouter une exception
spécifique à __tests__/bilans créerait une seconde convention et laisserait d’autres
fichiers .spec.ts silencieusement ignorés.

## A15 — Normalisation SHORT_TEXT

**Constat.** La ponctuation était retirée après trim, ce qui recréait un espace terminal.

**Décision.** Retirer ponctuation et espaces terminaux ensemble, puis appliquer trim. La
version du moteur passe à 1.0.1.

**Motif.** Un espace résiduel pourrait faire échouer une réponse correcte suivie d’un
signe de ponctuation.

## A16 — Nœud à exactement 50 % non traité

**Constat.** Sans masse ERREUR_CONFIANTE ni LACUNE_CONSCIENTE, le tie-break 0 >= 0
produisait artificiellement ERREUR_CONFIANTE.

**Décision.** Si la masse de difficulté provient entièrement de NON_TRAITE, le profil est
NON_TRAITE. La spécification, le test et le moteur 1.0.1 portent cette règle.

**Motif.** Une absence de réponse ne constitue pas une erreur confiante.

## A17 — Garde-fou d’isolation

**Constat.** Le test trouvait Math.random dans un commentaire qui en interdisait l’usage.

**Décision.** Retirer les commentaires avant de rechercher les formes d’appel
Math.random(, Date.now( et les autres dépendances interdites.

**Motif.** Un garde-fou doit détecter du code exécutable, pas sa documentation.

## A18 — Suite Prisma réelle absente de la CI

**Priorité.** P1, constat enregistré sans correction dans cette mission.

**Constat.** Les neuf cas de bilan-schema.real.test.ts ne sont exécutés par aucun job. Le
job unit ignore les fichiers real.test.ts et le job integration exclut
__tests__/lib/bilan/. Cette exclusion vient du commit 406ed1a0c du 2026-07-26, sans motif
documenté.

**Risque.** Une régression du schéma ou du CRUD Bilan peut rester invisible.

**Correction proposée, non appliquée.** Rattacher la suite au job de base réelle. Renommer
séparément __tests__/lib/bilan/ en __tests__/lib/bilan-runtime/ pour lever la confusion
avec __tests__/bilans/.

## A19 — Arrêt du serveur de développement cassé

**Constat.** Un serveur Next.js écoutait sur 127.0.0.1:3002 depuis le 2026-07-31 à 13:11.
Le remplacement de node_modules pendant npm ci l’avait rendu incohérent et il écrivait
potentiellement dans .next en concurrence avec les vérifications.

**Décision.** Arrêter le processus avant A15, ne pas le relancer et ne pas supprimer
.next. Aucun serveur applicatif ne doit tourner pendant la suite de la mission.

**Motif.** Les résultats d’un serveur tenant d’anciennes références de modules ne sont
pas fiables. Le lien .env vers .env.production crée par ailleurs un risque de configuration
production qui doit être arbitré sans lire les secrets.

**Résultat.** Le port 3002 est libre. L’état disponible ne permet pas d’établir
rétrospectivement si des requêtes HTTP ou SQL ont été servies ; aucune activité de base
n’est donc affirmée.

## Arbitrages complémentaires A21 à A31

### A21 — Suspension de l'interdiction du modèle parallèle à Assessment

**Constat.** Le modèle historique `Assessment` présente des défauts P0 sur le rattachement élève, la visibilité avant revue et le traitement des échecs de génération. Les modèles `Canonical*` apportent un rattachement vérifié et un cycle de revue et publication effectif.

**Décision.** L'interdiction du modèle parallèle est suspendue, pas levée. Aucun modèle ni migration supplémentaire n'est créé ou appliqué avant le verdict de M0.5.

**Motif.** Il faut déterminer si `Canonical*` constitue un successeur justifié ou un doublon durable avant d'engager 16 à 21 jours de travail.

### A22 — Prompts Markdown autorisés sous binding cryptographique

**Constat.** Les prompts de la branche de référence vivent dans des fichiers Markdown séparés.

**Décision.** Un prompt peut rester en Markdown si le pack le référence par chemin et checksum, si le chargement échoue sur mismatch, et si toute modification incrémente la version du pack et annule sa validation.

**Motif.** La source unique et le versionnement sont les invariants recherchés. Un Markdown relisible est préférable à une longue chaîne JSON.

### A23 — Reprise ciblée retenue sous condition

**Constat.** La branche la plus complète diverge de 692 fichiers hors OpenRouter et n'implémente pas A1, A2 ni A8.

**Décision.** M1 part du kit intégré avec reprises ciblées. La décision sera réexaminée si M0.5 conclut que la persistance `Canonical*` doit remplacer `Assessment`.

**Motif.** La valeur réutilisable est réelle, mais une reprise globale importerait trop de dette d'alignement.

### A24 — Triage ciblé des branches

**Constat.** Les références distantes contiennent un stock important de commits absent de main.

**Décision.** Une mission séparée, en lecture seule et limitée à une demi-journée, inventoriera uniquement les branches touchant `lib/bilans/**`, `lib/assessments/**` ou `prisma/schema.prisma`.

**Motif.** Éviter les faux constats d'absence sans ouvrir un chantier général de consolidation.

### A25 — La validation pédagogique devient le goulot

**Constat.** Dix-sept CPS, 408 items et 85 banques existent, mais tous restent `HUMAN_VALIDATION_REQUIRED`, sans reviewer ni date.

**Décision.** M3 devient une mission de validation pour les sept matières couvertes. SES, Histoire-Géographie et Grand Oral restent à produire intégralement.

**Motif.** La ressource critique est désormais le temps des enseignants relecteurs, non l'écriture technique.

### A26 — Interdiction de valoriser le stock non validé

**Constat.** Le stock contient des incohérences pédagogiques observables.

**Décision.** Les 408 items et 765 exercices sont qualifiés exclusivement de « brouillons à valider » tant que `reviewer` est nul.

**Motif.** Aucun volume ne remplace une validation humaine nominative et datée.

### A27 — Rotation SMTP sous responsabilité humaine

**Constat.** Un credential SMTP a été exposé dans un document suivi.

**Décision.** Nexus réalise la rotation. Aucun agent ne manipule ni ne rapporte la valeur.

**Motif.** La rotation du fournisseur est une action humaine sensible, distincte du correctif documentaire.

### A28 — Dépôt public, compromission présumée

**Constat.** GitHub déclare `cyranoaladin/nexus-project_v0` public.

**Décision.** Le credential exposé pendant cinq semaines et demie est considéré compromis, sans attendre une preuve d'exploitation.

**Motif.** Les collecteurs automatisés de secrets rendent une exposition publique durable incompatible avec l'hypothèse d'un secret resté confidentiel.

### A29 — Pas de réécriture de l'historique Git

**Constat.** Le dépôt comporte de nombreuses branches divergentes et des milliers de commits uniques absents de main.

**Décision.** Ne pas utiliser `git filter-repo` ni forcer les branches. Après confirmation de rotation, remplacer la valeur courante par `[REDACTED — credential révoqué le 2026-08-01]` dans l'archive et produire un commit dédié.

**Motif.** Une valeur révoquée devient inerte. Réécrire l'historique mettrait en danger le patrimoine non intégré.

### A30 — Credentials de services retirés ou potentiellement inactifs

**Constat.** La configuration locale contient encore des clés Konnect, Mistral et OpenAI.

**Décision.** Nexus décide de leur révocation et de leur retrait après vérification de l'usage actif. Konnect étant retiré du produit, ses trois credentials sont prioritaires.

**Motif.** Un credential inutilisé et non surveillé peut rester compromis sans détection.

### A31 — Couverture insuffisante du scanner de secrets

**Constat.** Le hook existant annonce un scan Telegram, mais n'a pas détecté le credential SMTP suivi.

**Décision.** Localiser et documenter sa couverture pendant M0.4. Une mission dédiée devra étendre la détection sans l'implémenter au passage.

**Motif.** Un scanner mono-fournisseur crée une fausse assurance de couverture générale.
## A20 — Configuration locale distincte de la production

**Constat.** Le lien local `.env` pouvait compléter `.env.local` avec des variables de
`.env.production`. La production réelle charge toutefois `/etc/nexus/nexus-prod.env`,
hors dépôt, via `node --env-file` ; le fichier local n'est pas sa source de configuration.

**Décision.** Le risque de contact avec la base de production au titre d'A19 est clos.
La suppression du lien `.env`, le renommage de l'artefact de smoke test et la vérification
de l'exemple de production restent une mission de configuration dédiée. Aucun serveur de
développement ne doit être lancé avec un environnement non maîtrisé.

**Motif.** Distinguer un risque local de configuration d'une exposition réelle de la
production évite à la fois le faux sentiment de sécurité et l'alerte infondée.

## A32 - Scanner de secrets : couverture a etendre

**Constat.** `scripts/security/check-telegram-secrets.mjs` ne couvre que Telegram. Il a affiche `Telegram secret scan passed` alors qu'un credential SMTP etait suivi depuis le 23 juin.

**Decision.** Traiter l'extension dans une mission dediee. Le scanner doit couvrir les fournisseurs et formats de secrets usuels, ne produire que `chemin:ligne:regle`, sans valeur, et s'executer dans le hook local ainsi qu'en CI. Le hook seul est insuffisant car `--no-verify` le contourne.

**Motif.** Un scanner mono-fournisseur produit une assurance fausse lorsqu'il annonce un succes sur une surface qu'il n'inspecte pas.

## A33 - Localisation expurgee des secrets historiques

**Constat.** Le balayage de chaque blob Git a releve neuf lignes correspondant a des motifs de secret dans l'historique du depot public.

**Decision.** Leur localisation est autorisee et necessaire. Le seul livrable admissible contient le type deduit du prefixe, le commit, le chemin, la ligne, la date et la presence dans l'arbre actuel. Aucune valeur, meme partielle ou tronquee, ne doit etre affichee.

**Motif.** Dans un depot public, ne pas identifier les fournisseurs concernes empeche de determiner les credentials a revoquer. L'ignorance augmente le risque au lieu de le contenir.
## A34 - Revocations prises en charge par Nexus

**Constat.** Les cles TLS, le PAT GitHub et la valeur `DATABASE_URL` signalee dans l'archive publique necessitent une qualification ou une revocation humaine.

**Decision.** Nexus traite ces revocations. Aucun agent ne touche a ces credentials, ne les affiche et ne poursuit leur qualification.

**Motif.** La revocation exige l'autorite sur les comptes et services concernes; elle ne releve pas du chantier logiciel.

## A35 - Detection independante du balisage documentaire

**Constat.** Un motif centre sur `NOM=valeur` ou `NOM: valeur` ne detecte pas un credential lorsque du balisage Markdown separe le nom de variable du delimiteur. Le credential SMTP a ainsi echappe a la detection pendant cinq semaines.

**Decision.** La specification du futur scanner doit analyser le contenu des tableaux, blocs de code et libelles Markdown, independamment de leur balisage, tout en ne produisant que `chemin:ligne:regle`.

**Motif.** La securite ne doit pas dependre de la forme editoriale du document qui contient le secret.
## A36 - Redaction en bloc de `docs/archive/**`

**Constat.** Trois passes successives sur les audits archives ont chacune revele de nouveaux credentials. Le risque porte sur l'ensemble du repertoire, pas sur une liste finie d'incidents isoles.

**Decision.** Apres confirmation des rotations par Nexus, une passe unique remplacera toute valeur suivant un nom de variable sensible par `[REDACTED - rotated 2026-08-01]`. Le traitement couvre notamment `SMTP_PASSWORD`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `CHROMA_API_KEY`, `RAG_API_TOKEN`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `KONNECT_*`, `JWT_SECRET` et tout motif de cle privee PEM. Les fichiers, noms de variables et contextes documentaires sont conserves. Un seul commit dedie portera la redaction.

**Motif.** Une redaction globale, reproductible et auditable evite les omissions inherentes a une correction ligne par ligne tout en preservant la valeur historique des archives.

## A37 - Rotation par defaut des secrets internes

**Constat.** Qualifier un litteral interne comme credential reel ou placeholder coute souvent plus cher que le regenerer et ne produit pas une certitude suffisante.

**Decision.** Tout secret interne regenerable rapidement, notamment `NEXTAUTH_SECRET`, `RAG_API_TOKEN`, `CHROMA_API_KEY`, `JWT_SECRET` et les mots de passe de base, est tourne sans qualification supplementaire. La qualification est reservee aux secrets dont la rotation a un cout externe, comme les certificats TLS, PAT GitHub et credentials de fournisseurs tiers.

**Motif.** La rotation reduit immediatement le risque avec une preuve operationnelle plus forte qu'une analyse documentaire incertaine.
## A38 - Adoption des modeles Canonical et resolution de A21

**Constat.** Neuf modeles Canonical sont deja presents sur `origin/main`, mais restent presque inactifs. L'ADR-007 decrit une succession progressive d'`Assessment`, et non une coexistence permanente.

**Decision.** Retenir le scenario d'adoption de Canonical, migration progressive et depreciation d'`Assessment`. Deux sources de verite destinees a coexister indefiniment restent interdites; un successeur documente avec migration et depreciation planifiee est autorise.

**Motif.** Etendre `Assessment` reconstruirait des agregats deja implementes, pour un effort superieur et une dette durable.

## A39 - Ordre d'execution de M1

**Constat.** La branche Canonical peut atteindre `REPORT_PENDING_REVIEW` sans materialiser la composition A1 ni les echecs des validateurs A2.

**Decision.** L'ordre est obligatoire: dry-run de migration; `buildFactSheet` A1 et `validationFailures[]` A2; validateurs V1-V7; puis seulement agents et routes publiques. Une correspondance d'email est un signal d'audit et ne produit jamais de rattachement automatique.

**Motif.** Ouvrir une route avant ces garanties importerait precisement les defauts que la convergence doit supprimer.

## A40 - Copie locale isolee des donnees de production

**Constat.** Les six migrations Canonical comportent backfills, contraintes uniques, `SET NOT NULL`, triggers et exceptions explicites.

**Decision.** Seul un `pg_dump` en lecture seule peut etre autorise en production, apres accord ecrit de Nexus. Le dump est restaure dans une base locale isolee, conserve en mode `600`, jamais committe ni copie, puis supprime apres usage. Aucune migration M1 n'est appliquee en production. La fenetre sans trigger append-only est mesuree en secondes.

**Motif.** Les migrations doivent etre eprouvees sur la forme reelle des donnees sans exposer la production a une ecriture ou a une fenetre d'integrite affaiblie.

## A41 - Bascule pack par pack derriere feature flag

**Constat.** Douze fichiers, vingt-neuf operations Prisma, huit routes et quatre services dependent directement d'`Assessment`.

**Decision.** Basculer un pack a la fois derriere un flag desactive par defaut. Apres bascule, `Assessment` devient lecture seule pour ce pack. Aucune suppression legacy n'est permise pendant M1. Le premier pack cible est Maths Terminale.

**Motif.** Une bascule atomique limite le rayon de regression et reste reversible par desactivation du flag avant toute ecriture Canonical.
## A42 - Retention de la copie locale de production

**Constat.** Le dump et le conteneur `nexus-m1-dryrun` contiennent des donnees personnelles de mineurs, notamment des noms, des e-mails et des resultats scolaires.

**Decision.** Le fichier unique `/home/alaeddine/.local/share/nexus/m1/nexus_prod_m1_20260801.dump` reste en mode `600`, n'est jamais copie, commite ni transmis. Le dump et le conteneur jetable `nexus-m1-dryrun`, sans volume, sont supprimes au plus tard le 2026-08-03. Leur suppression doit etre constatee dans un rapport, jamais supposee.

**Motif.** Une copie de production ne doit survivre que pendant la fenetre strictement necessaire au dry-run et a sa qualification.

## A43 - Schema Canonical deja applique en production

**Constat.** Les neuf tables Canonical existent en production et les six migrations de fondation sont enregistrees comme terminees depuis le 2026-07-22. La base contient seulement 15 `Assessment` pour 237 utilisateurs.

**Decision.** M1 n'applique aucune migration de structure Canonical en production. Le travail restant porte sur le branchement progressif des ecritures. Les migrations additives encore envisageables sont limitees a `validationFailures[]` et aux champs necessaires a la `FactSheet`. Le backfill des 15 assessments est mineur ; par defaut, les lignes non rattachables sont archivees sans migration automatique, conformement a A5.

**Motif.** Le successeur structurel est deja present et le faible volume legacy ne justifie ni rapprochement par e-mail ni mecanisme automatique risque.

## A44 - Image exacte pour toute copie locale de production

**Constat.** Une premiere restauration dans `postgres:15` a echoue parce que cette image ne fournit pas l'extension `pgvector` requise par la production. Une restauration partielle aurait produit une analyse fausse avec l'apparence d'une copie valide.

**Decision.** Toute copie locale d'une base de production utilise l'image exacte de la production, extensions comprises. L'image et la liste des extensions sont relevees sur la source, puis leur disponibilite est verifiee localement avant toute restauration.

**Motif.** L'alignement du moteur PostgreSQL ne suffit pas : les extensions font partie du schema executable et conditionnent la fidelite de la copie.

## A45 - Commit de la Phase B avant la Phase C

**Constat.** La Phase B represente un ensemble coherent et verifie : FactSheet, `validationFailures[]`, validateurs V1-V7, frontiere PII, gateway et migration additive.

**Decision.** La Phase B est commitee avant toute ouverture de la Phase C, avec staging par liste explicite et exclusion des artefacts hors perimetre.

**Motif.** Ce jalon fonctionnel et de securite ne doit pas rester vulnerable a un incident local ni etre melange aux agents et au contenu pedagogique de la phase suivante.

## A46 - Archivage en lecture seule des 15 assessments legacy

**Constat.** Les 15 assessments legacy sont `COMPLETED`, sans `studentId` et sans rapprochement fiable. Ils proviennent d'un pipeline ayant deja produit des rapports pedagogiquement errones.

**Decision.** Ils restent en base, inaccessibles et en lecture seule, a titre de trace. Aucun rattachement automatique ou manuel, aucune suppression et aucune ligne legacy effacee pendant M1.

**Motif.** A5 interdit le rattachement par e-mail et rendre ces rapports consultables exposerait des familles a des bilans dont la fiabilite est invalidee.

## A47 - Ecart entre contenus RAG et chunks annonces

**Constat P2.** La copie de production contient 40 lignes dans `pedagogical_contents`, alors que 211 chunks indexes ont ete annonces.

**Decision.** L'ecart est consigne sans investigation dans M1. Il devra etre qualifie avant toute mise en service reelle du RAG.

**Motif.** Trois explications restent possibles : niveau d'agregation different, stockage partiel ailleurs, ou ingestion incomplete. La derniere hypothese affecterait directement la qualite pedagogique des bilans.

### A48 — Le pack DRAFT n'atteint jamais le gateway

**Constat.** La validation pédagogique du pack est obligatoire, le pack Maths Terminale doit rester `DRAFT`, et le gateway A8 n'accepte qu'un `ValidatedPack`.

**Décision.** Le pack réel reste inexécutable tant que sa revue est nulle. Le seul fixture validé vit sous `__tests__/bilans/fixtures/`, porte le slug `fixture-non-publiable-v0`, le validateur `FIXTURE — JAMAIS UN ENSEIGNANT` et la date du 1970-01-01. Un test d'architecture interdit toute autre construction de production ; le chargeur réel refuse les validations absentes, vides ou identifiées comme fixtures.

**Motif.** La frontière du gateway ne protège le produit que si la fabrication du type qui l'autorise est elle-même fail-closed et non contournable.

### A49 — Validation pédagogique formalisée

**Constat.** Le statut technique d'un pack ne prouve ni la qualité des items et distracteurs, ni celle des prompts de restitution.

**Décision.** Un enseignant nommé et qualifié dans la discipline relit chaque item, distracteur et prompt, puis signe l'identité et la version du pack. Toute modification d'un item, d'un prompt ou de son checksum annule cette validation. Le pack signé et le paquet de revue aveugle constituent la trace.

**Motif.** La mise en service dépend d'une validation pédagogique traçable, distincte des tests techniques et de la revue de chaque rapport.

## A50 — Reprise ciblée de l'agent fautif

- **Constat :** rejouer les cinq agents après l'échec d'une seule audience remplace des sorties déjà validées, multiplie le coût et empêche une analyse causale stable.
- **Décision :** conserver les sorties conformes, rappeler uniquement l'agent fautif avec ses violations exactes, puis rejouer le vérificateur. Une seule reprise est autorisée ; un second échec renseigne `validationFailures[]` et maintient `REPORT_PENDING_REVIEW`.
- **Motif :** une sortie validée ne doit jamais être remplacée sans cause, et le vérificateur doit être recalculé à partir du triplet final.

## A51 — Commit de la phase C

- **Constat :** le pack DRAFT, les agents contraints, le rendu déterministe et la recette constituent un lot cohérent et vérifiable.
- **Décision :** committer ce lot par liste explicite après réussite de lint, typecheck, Jest complet et build, sans inclure les artefacts hors périmètre.
- **Motif :** préserver un jalon atomique de la mission M1 sans exposer les fichiers locaux ou historiques non concernés.

## A52 — Suppression anticipée de la copie de production

- **Constat :** le dry-run est terminé et le dump ainsi que le conteneur jetable ne sont plus nécessaires.
- **Décision :** supprimer aujourd'hui uniquement `nexus-m1-dryrun` et `/home/alaeddine/.local/share/nexus/m1/nexus_prod_m1_20260801.dump`, puis constater l'absence du conteneur, du fichier et de tout volume M1.
- **Motif :** réduire au strict minimum la durée de conservation locale de données personnelles de mineurs, avant même l'échéance A42.

## A53 — Recette mock versionnée et déterministe

- **Constat :** les métriques et le paquet de revue aveugle constituent une preuve seulement s'ils sont reproductibles et comparés aux références suivies.
- **Décision :** versionner les deux JSON de recette ; générer deux fois en mémoire ; exiger une égalité byte-for-byte entre les deux générations et avec les fichiers suivis. La CI compare et échoue, elle n'écrit jamais ces fichiers.
- **Motif :** empêcher le bruit de diff et conserver une trace rejouable pour la validation pédagogique et l'analyse ultérieure de qualité.

## A54 — Le schéma de banque strict fait foi

- **Constat :** le chargeur du pack acceptait des items dépourvus de `nodeCpsId`, `difficulty`, `targetTimeSec`, `shortCorrection` et de justification des distracteurs, alors que ces métadonnées sont indispensables au calcul des faits diagnostiques.
- **Décision :** `data/bilans/schemas/bank.schema.json` fait foi. Le chargeur refuse explicitement tout item incomplet et chaque distracteur doit documenter, dans `distractorRationale`, l'erreur réelle qu'il capture. Le pack Maths Terminale reste volontairement non chargeable jusqu'à sa complétion par le responsable pédagogique.
- **Motif :** sans poids de difficulté ni clé CPS, les profils par nœud, dont `ERREUR_CONFIANTE`, ne sont pas calculables de manière fiable ; le dispositif ne produirait qu'un score legacy, pas un diagnostic.

## A55 — Un pack incomplet invalide le diagnostic

- **Constat :** `computeFacts` ne remplace pas une `difficulty` absente par le champ legacy `weight` ni par la valeur `1`. Un passage forcé propage des poids indéfinis dans les agrégats et l'absence de `nodeCpsId` supprime la granularité des prérequis.
- **Décision :** aucun fallback ou défaut implicite ne sera introduit. Un pack dépourvu des métadonnées diagnostiques obligatoires est refusé avant calcul.
- **Motif :** le pack incomplet ne produit pas un diagnostic simplement dégradé ; il produit des agrégats invalides pouvant conserver l'apparence d'un résultat. Le refus explicite est le seul comportement sûr.

## A56 — Le RAG Terminale absent est désactivé et fail-closed

- **Constat :** la collection Chroma `ressources_pedagogiques_terminale` et la table `rag_chunks` de la nouvelle pile contiennent zéro entrée. Le chiffre historique de 211 chunks ne correspond à aucun stockage actif observé le 2026-08-01.
- **Décision :** le pack `maths-terminale-v1` porte `reporting.rag.enabled: false` et une référence explicite à A56. Si un pack active le RAG, le gateway refuse tout démarrage lorsque le retriever est absent ou renvoie zéro extrait.
- **Motif :** une génération sans preuve ne doit jamais conserver l'apparence d'une génération ancrée. Le corpus vide est une erreur bloquante, pas un mode dégradé.

## A57 — Sauvegarde immédiate du correctif A56

**Constat.** Le fail-closed RAG et sa politique de pack étaient testés mais uniquement
présents dans l'arbre local.

**Décision.** Isoler, committer et pousser le correctif A56 avant d'ouvrir le traitement
de la panne ARIA.

**Motif.** Un correctif de sécurité non sauvegardé ne constitue pas un jalon fiable.

## A58 — Une panne RAG doit être visible dans ARIA

**Constat.** Le client RAG transformait timeout, exception et réponse non-2xx en tableau
vide ; ARIA appelait ensuite le modèle sans signaler l'absence d'ancrage.

**Décision.** Distinguer succès avec résultats, succès vide et échec technique. Un échec
technique bloque le mode ancré, informe sobrement l'élève, produit un journal sans PII et
alimente une alerte de taux d'échec. Un succès vide peut répondre seulement en déclarant
explicitement l'absence de source du corpus.

**Motif.** Un échec technique ne doit jamais être converti en succès silencieux.

## A59 — Diagnostic séparé avant toute réingestion RAG

**Constat.** Les erreurs d'ingestion observées combinaient des réponses 401 et 422 sans
preuve d'une cause unique, tandis que le fallback réseau utilisait un nom Docker depuis
un processus PM2 sur l'hôte.

**Décision.** Documenter d'abord l'emplacement des tokens, la résolvabilité du service,
le champ refusé par les 422 et une recette d'ingestion isolée. Aucune ingestion ni rotation
de configuration n'est exécutée dans le chantier bilans.

**Motif.** Réparer sans qualifier l'authentification, le réseau et le contrat de charge
utile risquerait de produire une nouvelle ingestion partielle.

## A60 — Enrichissement des cinq prompts avant relecture

**Constat.** Les cinq prompts totalisaient 29 lignes et déléguaient aux validateurs des
contraintes rédactionnelles déjà écrites dans les specs 05 et 08.

**Décision.** Transposer explicitement ces contraintes dans chaque prompt, sans créer de
règle pédagogique nouvelle, et réserver une section d'exemples positifs et négatifs à
compléter par le responsable pédagogique.

**Motif.** Les validateurs prouvent l'absence de violations, pas la présence d'une qualité
rédactionnelle suffisante.

## A61 — Fusion et suivi des métadonnées pédagogiques

**Constat.** Le responsable pédagogique devait renseigner des centaines de champs sans
outil pour mesurer l'avancement ni fusionner le formulaire dans le pack.

**Décision.** Fournir un merge fail-closed et permettre au contrôleur de complétude de
lire directement le YAML. La valeur `A REMPLACER` demeure incomplète et bloquante.

**Motif.** Le suivi doit progresser pendant la relecture, avant toute fusion finale.

## A62 — Gel du YAML sur une branche de relecture dédiée

**Constat.** L'ingénierie et la relecture humaine pouvaient modifier concurremment le même
formulaire de cinquante items.

**Décision.** Créer `review/maths-terminale-v1-metadata` depuis le commit contenant A61,
geler énoncés, options et clés, et réserver au responsable pédagogique le remplissage des
champs vides. La fusion finale porte uniquement sur ce fichier.

**Motif.** La séparation des branches empêche une modification technique de déplacer le
support sous les pieds du relecteur.

## A63 — La version 1 couvre toute la construction avant signature

**Constat.** Le pack n'avait jamais été signé ni chargé en production lors de
l'enrichissement initial de ses prompts.

**Décision.** Conserver la version 1 jusqu'à la première signature. Après cette signature,
toute modification d'item, d'option, de prompt ou de checksum impose une nouvelle version
et annule la validation précédente.

**Motif.** Le contrat de version protège une validation existante ; il ne doit pas figer
artificiellement un brouillon initial.

## A64 — La recette mock atteste la conformité, pas la qualité

**Constat.** Multiplier par sept la taille des prompts ne changeait aucun artefact mock :
le transport de test ne mesure pas leur effet rédactionnel.

**Décision.** Ne jamais présenter les zéros violations du mock comme preuve de qualité.
La première recette sur fournisseur réel exige une revue humaine intégrale des vingt
FactSheets et trois audiences avant mise en service.

**Motif.** Le mock prouve câblage, déterminisme, validation et absence de réseau, rien de
plus.

## A65 — Publication du support de relecture

**Constat.** Les prompts enrichis et la procédure de relecture n'étaient disponibles que
localement alors que le travail humain devait commencer.

**Décision.** Les committer et pousser sur `docs/bilans-kit-integration`, puis vérifier que
le YAML gelé reste identique sur la branche de relecture.

**Motif.** La diffusion des supports ne doit pas rompre l'isolation du formulaire humain.

## A66 — Exemples pédagogiques réservés au relecteur

**Constat.** Une liste de règles ne suffit pas à fixer le niveau de qualité attendu d'un
modèle ; le contraste entre bonne et mauvaise formulation relève du jugement pédagogique.

**Décision.** Les cinq prompts portent une section d'exemples explicitement vide, à
compléter par le responsable pédagogique, et non par l'ingénierie.

**Motif.** Ne pas transformer une décision de ton et de qualité pédagogique en contenu
généré sans validation humaine.

## A67 — Retrait des items hors programme

- **Constat :** quatre items du pack historique portent sur des notions hors programme actuel du lycée : convergence d’une intégrale impropre, loi normale et intervalle de confiance.
- **Décision :** retirer définitivement `MATH-ANA-12`, `MATH-PROB-05`, `MATH-PROB-06` et `MATH-PROB-10` des banques actives et de leurs formulaires de métadonnées.
- **Motif :** un item hors programme ne mesure aucun prérequis légitime et produirait une lacune artificielle.

## A68 — Requalification de la banque historique

- **Constat :** la banque de cinquante items mélangeait prérequis de Première, programme de Terminale et notions hors programme.
- **Décision :** la requalifier sous le slug `maths-terminale-bilan-v1`, avec trente-huit items du programme de Terminale, pour les candidats libres et les élèves en cours ou en fin d’année.
- **Motif :** son contenu majoritaire mesure un acquis de Terminale, pas un niveau d’entrée avant enseignement.

## A69 — Extraction traçable de huit prérequis

- **Constat :** huit items historiques évaluent des prérequis de Première utiles à l’entrée en Terminale.
- **Décision :** les retirer du bilan de fin, leur attribuer les identifiants `ETL-MAT-PRQ-01` à `ETL-MAT-PRQ-08` et conserver une table de correspondance ancien/nouveau.
- **Motif :** séparer les usages sans rendre les résultats historiques ininterprétables.

## A70 — Banque d’entrée en Terminale

- **Constat :** dix-huit items validés pédagogiquement couvrent neuf nœuds de prérequis de Première, avec deux items par nœud et mille cent soixante secondes de temps cible.
- **Décision :** convertir déterministement cette source YAML en pack JSON `entree-terminale-maths-v1`, avec prompts liés par checksum, RAG désactivé selon A56, statut `DRAFT` et validation nulle.
- **Motif :** disposer d’un positionnement adapté au stage de pré-rentrée sans exposer les élèves à des notions non encore enseignées.

## A71 — Tests et outillage multi-banques

- **Constat :** les outils et la recette étaient historiquement nommés et testés pour un seul pack.
- **Décision :** rendre le suivi de complétude, la fusion, le chargeur, les contrats de prompts et la recette mock compatibles avec les deux usages ; versionner une recette déterministe par slug.
- **Motif :** empêcher qu’un renommage ou une nouvelle banque contourne silencieusement les garde-fous existants.

## A72 — Normalisation des clés d’options

- **Constat :** la source éditoriale utilise les clés minuscules `a-d`, alors que le schéma impose la convention unique `A-D`.
- **Décision :** le convertisseur normalise la casse sans modifier les libellés ni déplacer le booléen de bonne réponse. Le schéma reste strict.
- **Motif :** la casse est une convention technique sans portée pédagogique ; accepter deux conventions créerait une incohérence durable.

## A73 — Validation absente de la source éditoriale

- **Constat :** le YAML livré portait un bloc `review`, interdit par le schéma éditorial.
- **Décision :** retirer ce bloc de la source. Le convertisseur produit toujours un pack `DRAFT` avec `validatedBy` et `validatedAt` nuls et refuse toute source qui tente de porter une validation.
- **Motif :** seule la procédure humaine de signature peut créer une validation pédagogique.

## A74 — Catalogue CPS limité aux neuf nœuds

- **Constat :** V2 exige qu’un `nodeCpsId` existe dans un catalogue, mais aucun catalogue ne portait les neuf nœuds validés.
- **Décision :** créer `data/bilans/cps/1re-maths-vers-terminale.v1.yaml`, limité à ces neuf nœuds, en reprenant textuellement les justifications présentes dans la source éditoriale.
- **Motif :** rendre V2 démontrable sans ouvrir un chantier de taxonomie CPS générale.

## A75 — Version 1 limitée aux dix-huit items complets

- **Constat :** ajouter immédiatement les huit prérequis historiques rendrait le pack incomplet et donc non chargeable.
- **Décision :** conserver un pack v1 chargeable de dix-huit items. Isoler les huit transferts dans un formulaire incomplet destiné à une future v2.
- **Motif :** le stage débute le 17 août ; le fail-closed du chargeur ne doit être ni assoupli ni contourné.

## A76 — Distribution bloquante des positions de bonnes réponses

- **Constat :** les dix-huit items d'entrée et les trente-huit items du bilan de fin plaçaient tous la bonne réponse en première position. Un élève pouvait donc produire un faux positif de maîtrise complète sans mobiliser les connaissances évaluées.
- **Décision :** classer les identifiants d'items par leur SHA-256 en ordre binaire, puis attribuer cycliquement les positions A à D. Les distributions deviennent respectivement `5/5/4/4` et `10/10/9/9`. V14 refuse au chargement toute banque dont une position dépasse 40 % des bonnes réponses.
- **Motif :** l'ordre est reproductible sans aléa et sans modifier aucun énoncé, libellé, rationale ou drapeau de correction. Le mélange par `seed` décrit par les specs 01 §5.3 et 04 n'est pas implémenté dans le runtime ; V14 est donc la seule protection active contre ce biais de position.

## A77 — Banque de positionnement d’entrée en Première, Mathématiques

**Constat.** La source éditoriale `entree-premiere-maths-v1.yaml` contient 18 items complets couvrant neuf nœuds de prérequis de Seconde, avec deux items par nœud. Son audit statique ne relève aucun écart V1 à V14 : durée 1 075 s pour 25 minutes annoncées et distribution des bonnes réponses A=5, B=5, C=4, D=4.

**Décision.** Le catalogue CPS limité à ces neuf nœuds est versionné. Le convertisseur et le chargeur sont généralisés aux niveaux, matières et nombres de domaines déclarés par le pack, sans assouplir les métadonnées pédagogiques. Les cinq prompts sont isolés sous le slug de la banque, le RAG reste explicitement désactivé, et le pack généré reste `DRAFT` avec `review.*` nul. Une recette mock versionnée couvre 20 FactSheets et 60 rapports avec V1 à V7.

**Motif.** La banque doit être exploitable par le même pipeline que les autres niveaux sans dupliquer un convertisseur ni introduire de conventions propres à Première. Les schémas de sortie autorisent désormais autant de blocs de domaines que le pack en déclare afin que V4 puisse prouver qu’aucun domaine évalué n’est omis.

**Point de sécurité associé.** Le domaine `inequations` révélait un faux positif du détecteur INE. Le motif exige désormais un séparateur réel entre le libellé `INE` et sa valeur ; un mot commençant par ces lettres n’est plus classé comme identifiant élève, sans relâcher la détection d’un identifiant effectivement libellé.

## A78.1 — Mélange déterministe des options par seed de passation

**Constat.** La permutation annoncée par la spec 01 n’existait pas dans le runtime. V14 protège la banque contre un biais global de position, mais deux élèves pouvaient encore voir le même ordre d’options.

**Décision.** Une fonction pure dérive, pour chaque couple `(seed de passation, identifiant d’item)`, une permutation Fisher–Yates reproductible. Elle agit uniquement sur une copie destinée à l’affichage, conserve l’identité des objets d’options et ne modifie jamais le pack. V14 demeure bloquante : les deux protections sont indépendantes.

**Limite volontaire.** La fonction n’est raccordée à aucune route tant que la spec publique Canonical annulant la spec 04 n’a pas été arbitrée. A78.2 chiffre ce raccordement séparément.

## A79 — Parcours d'août sans LLM ni RAG

**Constat.** La chaîne sécurisée avec agents demandait davantage de temps que la fenêtre
d'ouverture du 17 août, tandis que le rendu déterministe consommait déjà la FactSheet.

**Décision.** Pour août, produire le bilan exclusivement par passation, FactSheet, rendu
déterministe, revue humaine et publication. Agents, LLM et RAG restent implémentés mais
hors du chemin actif.

**Motif.** Retirer trois dépendances non validées du chemin critique sans sacrifier la
traçabilité des faits.

## A80 — SPEC-04 réécrite contre les modèles Canonical

**Constat.** La spec API historique avait été annulée et ne couvrait ni ownership serveur,
ni confiance par item, ni permutation, ni cycle Canonical.

**Décision.** Limiter le contrat public à six routes Canonical : création, lecture
expurgée, sauvegarde, soumission, statut et rapport publié. Ownership par session Student,
refus en 404, confiance 1–4 et feature flag OFF par pack sont normatifs.

**Motif.** Le contrat doit précéder l'ouverture de toute route et rendre la non-divulgation
testable.

## A81 — Le runner legacy n'est pas repris

**Constat.** Le runner historique chargeait côté navigateur des marqueurs de correction,
dont `isCorrect` et `explanation`.

**Décision.** Fermer ce chemin puis construire un runner alimenté uniquement par le DTO
expurgé Canonical, avec confiance, autosave, reprise et aucun calcul de score côté client.

**Motif.** Une réponse lisible dans le bundle client rend le questionnaire contournable,
indépendamment de la qualité du futur backend.

## A82 — Migration additive de la passation Canonical

**Constat.** La passation ne persistait ni seed ni bornes temporelles et son statut par
défaut Prisma divergeait de la machine à états.

**Décision.** Ajouter seed, `startedAt`, `expiresAt` et aligner le défaut sur `DRAFT` par
migration additive dev/test uniquement. Aucun objet legacy n'est supprimé et aucune
migration n'est appliquée en production dans ce chantier.

**Motif.** La permutation, l'expiration et les transitions doivent être reproductibles et
cohérentes avant d'ouvrir la passation.

## A83 — Banque de positionnement d’entrée en Seconde, Mathématiques

**Constat.** La source éditoriale `entree-seconde-maths-v1.yaml` contient 18 items complets couvrant neuf nœuds de prérequis de Troisième, avec deux items par nœud. Son audit ne relève aucun écart V1 à V14 : durée 1 055 s pour 25 minutes annoncées et distribution des bonnes réponses A=5, B=5, C=4, D=4. Le gabarit historique `seconde.maths.v1.yaml` ne contient que 12 items incomplets, sans rationales et avec une convention de clés obsolète.

**Décision.** Versionner le catalogue CPS limité aux neuf nœuds, convertir la source par le pipeline générique existant et isoler cinq prompts liés par checksum sous le slug du pack. Le RAG reste désactivé, le pack reste `DRAFT` avec `review.*` nul, et une recette mock déterministe couvre 20 FactSheets et 60 rapports. Le gabarit historique est conservé sous `_archive/` avec un en-tête d’obsolescence explicite.

**Motif.** L’entrée en Seconde doit reposer sur les prérequis de Troisième réellement relus, sans maintenir deux banques actives concurrentes ni assouplir les règles V1 à V14. Cette troisième banque confirme que le convertisseur est indépendant du niveau et du slug.

## A84 — Ratification API, fermeture legacy et migration additive

**Constat.** La SPEC-04 nécessitait des garanties précises d'idempotence, de verrouillage,
d'expiration et de sentinelles anti-divulgation ; le runner legacy restait exposé.

**Décision.** Ratifier la spec durcie, fermer la page legacy derrière un seam fail-closed
et produire la migration A82 pour dev/test. Aucune route Canonical ni feature flag n'est
activé par cette ratification.

**Motif.** Fermer l'exposition connue avant de bâtir le nouveau parcours, sans confondre
schéma prêt et fonctionnalité ouverte.

## A85 — Six routes Canonical derrière des flags OFF

**Constat.** La passation exigeait un contrat transactionnel, idempotent et non divulgant,
ainsi qu'un garde de pack uniforme sur toutes les ressources existantes.

**Décision.** Implémenter exactement les six routes de la SPEC-04, avec Student issu de la
session, seed serveur, sauvegarde optimiste, soumission verrouillée, outbox unique, lecture
publiée par audience et garde partagé `assertAttemptPackEnabled`. Tous les flags restent
désactivés par défaut.

**Motif.** Une désactivation de pack doit fermer toute la surface, y compris une tentative
créée antérieurement et un rapport déjà publié.

## A86 — Worker déterministe et revue interne

**Constat.** La soumission déposait un job, mais aucun chemin complet ne transformait les
réponses en faits, artefacts et publication revue sans dépendance externe.

**Décision.** Le worker enchaîne calcul des faits, FactSheet, preuves, trois rendus et
révision en attente. Le service interne impose le cycle revue, bloque toute publication
avec échecs de validation et ne publie jamais automatiquement.

**Motif.** Un échec reste explicite et rejouable ; il ne devient jamais un statut de succès.

## A87 — Draineur, runner élève et surface staff

**Constat.** Le worker n'était pas raccordé à l'outbox et les interfaces de passation et de
revue manquaient.

**Décision.** Ajouter un draineur manuel avec verrou concurrent, un runner client limité au
DTO expurgé et une surface staff réutilisant exclusivement le service de revue. Aucun daemon,
cron, flag ou septième route publique n'est activé.

**Motif.** Rendre la chaîne testable de bout en bout tout en conservant un déclenchement et
une exposition désactivés par défaut.

## A88 — Aucun arbitrage identifié

**Constat.** Aucun message ou document source disponible ne formule un arbitrage A88.

**Décision.** Ne lui attribuer aucune règle rétroactivement.

**Motif.** Une numérotation manquante vaut mieux qu'une décision inventée après coup.

## A89 — Extension à dix-sept packs et signature durable

**Constat.** Deux banques validées restaient hors vague, les enums Canonical ne couvraient
pas `MATHS_EXPERTES` et `QUATRIEME`, un nœud suites était partagé entre deux finalités, et
une signature écrite dans un JSON généré aurait été écrasée.

**Décision.** Étendre le manifeste à dix-sept packs et 306 items, ajouter les deux valeurs
par migration additive dev/test, distinguer le nœud suites expertes, et stocker toute
signature dans `data/bilans/reviews/<slug>.review.yaml`. Le convertisseur ne produit
`VALIDATED` que si reviewer, source et cinq checksums de prompts correspondent ; sinon il
retombe fail-closed en `DRAFT`.

**Motif.** La vague doit être exhaustive sans collision sémantique, et la signature doit
survivre à la régénération tout en s'invalidant dès que le contenu signé change.

## A90.1ter — Parcours pédagogique déterministe par profil

**Constat.** Le rendu PARENTS renvoyait vers un échange de conseil sans matérialiser le parcours pédagogique déjà déductible des profils. Aucune relation fiable ne relie encore un stage à ses séances réelles dans le modèle Canonical.

**Décision.** Construire un `LearningPath` versionné comme fonction pure de la `FactSheet` et de la `RenderIdentity`. Chaque domaine non maîtrisé produit une étape ordonnée par priorité, avec une phase didactique imposée par son profil. Les formulations d’objectif et de démarche sont déterministes et contextualisées par matière. Les rendus ELEVE et PARENTS emploient les libellés familles ; le rendu NEXUS conserve les profils techniques et les scores.

**Motif.** Un parcours calculé est plus utile et plus auditable qu’un renvoi générique. Il conserve la priorité absolue donnée aux erreurs tenues pour justes, sans faire intervenir de LLM, de RAG ni d’agent.

**Dette bornée.** Tant que la relation `stage -> séances` n’existe pas, les étapes utilisent la configuration séquentielle `Séance 1`, `Séance 2`, etc. Ce libellé ne prétend pas refléter un planning réel. Le raccordement aux séances effectivement programmées relève d’une évolution distincte du modèle et ne doit pas être déduit du slug ou du contenu libre.

## A93 — Un seul moteur PDF et cycle Chromium borné

**Constat.** Le pont parent historique délègue déjà au moteur HTML/Chromium Canonical,
mais chaque PDF relançait un navigateur. La mesure locale donnait 774 à 1 313 ms par
appel one-shot.

**Décision.** Conserver ce moteur unique et exposer une session explicitement fermée pour
les lots de plusieurs PDF et les suites de tests. L'appel de production unitaire reste
one-shot ; aucun navigateur permanent ni hausse de timeout n'est introduit.

**Motif.** Mutualiser le coût mesuré sans créer de second moteur, de ressource orpheline ou
de timeout masquant une régression.

## A94 — Suite Prisma Bilan réintégrée à la CI

**Constat.** Les neuf cas CRUD réels de `__tests__/lib/bilan/` étaient exclus du job
d'intégration depuis le 26 juillet et le nom du répertoire se confondait avec le socle
Canonical `__tests__/bilans/`.

**Décision.** Renommer la suite sous `__tests__/lib/bilan-runtime/` et l'exécuter dans un
job PostgreSQL/pgvector dédié, sur une base créée exclusivement par les migrations de la
branche. Le job d'intégration général l'exclut explicitement pour éviter un double passage.

**Motif.** Un contrat Prisma réel doit produire un résultat CI visible, isolé et non
dépendant d'une base persistante contaminée par une autre branche.

## A95 — Bilans Canonical rendus de référence

**Constat.** Aucun HTML ni PDF Canonical matérialisé n'était versionné pour inspection par
Nexus et les responsables pédagogiques.

**Décision.** Versionner les trois audiences HTML/PDF d'une FactSheet synthétique du pack
`entree-premiere-maths-v1`, et les comparer byte-for-byte en CI par le moteur partagé.

**Motif.** Une validation pédagogique doit pouvoir examiner ce que le système rend, sans
utiliser de donnée réelle ni confondre conformité structurelle et qualité visuelle.

## A97 — A1 superseded : retrait de ScoringV2 du socle Canonical

**Constat.** Le bridge Canonical transformait toute passation en `BilanDiagnosticMathsData`
et fabriquait des données absentes : discipline maths, stress nul, réponses vérifiées,
ressenti positif, maîtrise binaire, mini-test sur six et poids de domaines uniformes.
Les indices produits avaient une apparence d'autorité sans source réelle.

**Décision.** A1 est superseded. `computeScoringV2` est retiré du chemin Canonical.
La FactSheet a pour seules sources le pack validé et `computeFacts`. Le moteur diagnostics
legacy reste disponible pour ses consommateurs historiques.

**Motif.** Un indicateur plausible construit sur des données inventées est plus dangereux
qu'une grandeur explicitement absente.

## A98 — Signature sans paramètre mort

**Constat.** `buildFactSheet(scoringV2, facts)` et `computed.scoringV2` permettaient à un
consommateur futur de réutiliser silencieusement des indicateurs sans source.

**Décision.** La signature normative devient `buildFactSheet(pack, facts)`. Le paramètre
ScoringV2 et le champ de résultat `scoringV2` sont supprimés, pas rendus optionnels.

**Motif.** Une frontière de type doit rendre le chemin interdit impossible, pas seulement
le laisser inutilisé par convention.

## A99 — Agrégation nommée des scores de domaine

**Constat.** Une moyenne des scores de nœud perdrait le poids réel des items.

**Décision.** `computeDomainScores` agrège par domaine selon
`100 × Σ(rawSuccess × difficulty) / Σ(difficulty)`, avec la correspondance du pack
`item → nodeCpsId → domainId`. Un domaine sans item vaut zéro ; un item sans rattachement
valide fait échouer le calcul.

**Motif.** La difficulté et la réussite partielle sont des faits mesurés et doivent rester
présentes jusqu'à l'agrégation.

## A100 — Couverture de passation uniquement

**Constat.** Une passation d'entrée ne collecte ni chapitres vus, ni chapitres en cours,
ni progression annuelle.

**Décision.** `FactSheet.coverage` provient de `computeFacts` et signifie uniquement
« proportion d'items traités ». Elle ne doit jamais être présentée comme une couverture
du programme.

**Motif.** Une couverture de programme sans source serait une grandeur inventée.

## A101 — Indicateurs sans source interdits dans Canonical

**Constat.** `examReadinessIndex`, `riskIndex`, `readinessScore`, `trustScore`, les
recommandations Pallier 1/2, `quickWins`, les incohérences et les alertes de stress,
rédaction, automatismes ou endurance dépendaient de données non collectées.

**Décision.** Ces indicateurs sont absents du socle Canonical. Ils ne peuvent réapparaître
qu'avec un modèle validé pour la discipline et des données d'entrée effectivement
collectées.

**Motif.** Ne jamais convertir l'absence d'information en score ou recommandation.

## A102 — Frontière d'architecture ScoringV2

**Constat.** Une suppression applicative sans garde permettrait de réintroduire le moteur
legacy dans un autre module Canonical.

**Décision.** Un test d'architecture bloquant interdit tout import de
`lib/diagnostics/score-diagnostic.ts` depuis `lib/bilans/**` et surveille les identifiants
d'indicateurs sans source.

**Motif.** La séparation entre moteur legacy disciplinaire et socle Canonical neutre doit
être vérifiée par la CI.

## A103 — Inflation empirique des scores legacy sans diffusion

**Constat.** Le 3 août 2026, le même fixture de réponses donne `algebre` 50 avec le bridge
legacy contre 28,6 par pondération des faits, `analyse` 25 contre 12,5 et `probabilites`
25 contre 11,1. La représentation binaire de maîtrise gonflait donc les scores dans des
proportions majeures. Le contrôle agrégé de production retourne toutefois zéro ligne dans
`canonical_report_artifacts`, zéro statut `PUBLISHED`, zéro `publishedAt` et zéro révision
publiée associée.

**Décision.** Conserver ces trois écarts comme justification empirique de A97 et clore le
dossier de diffusion : aucun bilan n'a été publié par ce chemin.

**Motif.** Une absence de diffusion observée distingue un défaut de modèle corrigé avant
activation d'un incident ayant affecté des familles.

## A104 — Recette de scoring depuis les réponses brutes

**Constat.** Les recettes A53 commencent à la FactSheet. Leur stabilité après A97 prouve
le rendu, V1 à V7 et le déterminisme, mais pas la transformation réponses vers scores.

**Décision.** Versionner pour `entree-premiere-maths-v1` une preuve déterministe couvrant
réponses brutes, `computeFacts`, `computeDomainScores`, FactSheet et trois rendus, avec les
quatre profils traités et un cas partiel.

**Motif.** Une régression du scoring doit faire diverger un artefact contrôlé en CI.

## A105 — Couverture intégrale des branches du moteur de faits

**Constat.** Onze branches défensives ou de tri restaient non couvertes, soit 75 sur 86.

**Décision.** Couvrir les données corrompues, banques et poids vides, criticité par défaut
et passation partielle. Le QCM multiple scalaire est récupéré comme une sélection unique ;
un QCM sans bonne option vaut zéro ; un type de clé inconnu échoue explicitement. Deux
branches impossibles par construction sont remplacées par leurs invariants : les maps de
criticité et de regroupement partagent la même source, et le tie-break utilise
`localeCompare`.

**Motif.** Les garde-fous doivent rester observables sans fabriquer des entrées impossibles
uniquement pour satisfaire un compteur de couverture.

## A106 — Grille de relecture des rendus de référence

**Constat.** Les six artefacts A95 entrent pour la première fois en relecture pédagogique
humaine.

**Décision.** Versionner une grille courte portant sur la non-divulgation des chiffres,
le ton par audience, la formulation des priorités, les CTA, l'absence de nom d'enseignant,
la lisibilité et la longueur des documents.

**Motif.** La conformité technique ne décide ni de la qualité pédagogique ni du caractère
raisonnable d'un bilan parents de cinq pages.
