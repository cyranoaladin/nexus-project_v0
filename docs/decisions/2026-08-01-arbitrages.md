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

## A1 — Composition des moteurs

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
