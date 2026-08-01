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
