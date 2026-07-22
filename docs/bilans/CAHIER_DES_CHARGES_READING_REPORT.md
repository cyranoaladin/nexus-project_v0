# Rapport de lecture du cahier des charges

## Fichier lu

- Chemin : `/home/alaeddine/Projets/nexus-bilans-workspace/Cahier_charges.md`
- Taille : 53 468 octets
- Nombre de lignes : 2 278
- SHA-256 : `121fe7ad9bb0bd453a2e46ef69ba9bf18f694c7f7c4a7a12c0c443d7eb82ea85`
- Lecture : intégrale, par blocs couvrant les lignes 1 à 2 278.

## Grandes sections prises en compte

Le document comporte 32 sections numérotées de 0 à 31 : identité et niveau d'exigence, finalité, périmètre académique, dépôts, documents d'audit, fichiers prioritaires, sources officielles, versionnement des programmes, architecture pédagogique, modèle des questions, spécifications Maths/Physique-Chimie/NSI-SNT/Français, profil élève et famille, questionnaire parent, scoring, catégories de positionnement, bilans multi-audiences, séparation déterministe/LLM, RAG, architecture technique, données, interfaces, sécurité/RGPD, accessibilité, gouvernance des banques, quinze diagnostics initiaux, ordre de réalisation, tests, critères d'acceptation, livrables, méthode, rapport final et instruction d'exécution.

## Exigences impératives identifiées

- Centraliser dans `nexus-project_v0` sans créer une septième application.
- Analyser les cinq dépôts sources sans jamais les modifier.
- Résoudre le programme applicable par cohorte, année scolaire, niveau, voie, spécialité/option et session ; conserver séparément programme préalable et programme cible.
- Traiter explicitement la transition 2026-2027 : nouveaux programmes de Seconde et Première en mathématiques, Terminale seulement en 2027-2028.
- Ne jamais pénaliser une notion non étudiée comme une erreur.
- Persister des preuves par compétence et séparer maîtrise, couverture, fluidité, raisonnement, méthodologie, préparation à l'examen, qualité des données, confiance et écart d'autoévaluation.
- Produire trois rapports distincts : élève, parent/responsable légal, Nexus interne.
- Imposer une validation pédagogique humaine aux rapports parent au lancement et aux questions générées automatiquement.
- Garder un fallback déterministe complet ; le LLM ne calcule ni ne modifie les scores et toute sortie structurée est validée.
- Remplacer les traitements critiques `fire-and-forget` par une file durable avec retries, backoff, idempotence, verrouillage et DLQ.
- Stocker les PDF dans un stockage objet durable et protégé, jamais dans un répertoire public ou temporaire du conteneur.
- Conserver ChromaDB comme moteur RAG canonique ; versionner sources et chunks ; exclure PII, copies, rapports individuels, logs et contenus non licenciés du corpus global.
- Exiger un élève authentifié, un profil actif et au moins un responsable légal lié ; contrôler rôle et ownership côté serveur ; tester l'IDOR.
- Respecter la minimisation, la rétention, l'auditabilité, les URLs signées, le rate limiting, Zod, la protection des fichiers et l'absence de PII dans les logs.
- Prévoir clavier, contraste, pause, reprise, temps additionnel et neutralisation du temps lorsqu'un aménagement le requiert.
- Couvrir Seconde, Première et Terminale en Mathématiques, Physique-Chimie, NSI/SNT et Français, sans inventer de programme officiel de Français en Terminale.
- Ne déclarer le système terminé qu'après satisfaction des vingt critères d'acceptation.

## Ambiguïtés à résoudre

1. Le schéma de statut des questions présente `DRAFT | REVIEWED | PUBLISHED | ARCHIVED`, alors que la gouvernance exige aussi `DRAFT_PEDAGOGICAL_REVIEW`. Une machine d'état canonique doit être arrêtée par ADR et validation pédagogique.
2. Le cahier demande un registre stocké et versionné mais ne tranche pas entre fichiers versionnés, tables Prisma ou combinaison des deux. Le premier lot utilise un registre TypeScript/Zod sans migration ; la persistance DB fera l'objet d'une ADR après convergence des entités.
3. Les définitions initiales doivent contenir des prompts, mais la gouvernance future des `PromptPack` et l'autorité d'approbation ne sont pas complètement précisées.
4. Les durées de conservation, la base légale détaillée et le responsable de traitement ne sont pas chiffrés ou nommés ; validation juridique/RGPD requise.
5. Le fournisseur de stockage objet, la région, la politique de sauvegarde et la durée des URLs signées restent à choisir.
6. Les seuils psychométriques et pondérations sont demandés mais doivent être étalonnés ; ils ne peuvent pas être déduits uniquement du cahier.
7. Le cahier cite quinze définitions, alors que le texte demande une banque initiale représentative pour chacune sans fixer le nombre minimal d'items ni le protocole d'étalonnage.

## Contradictions ou écarts avec le code existant

- `app/api/assessments/submit/route.ts` lance encore le calcul SSN et `BilanGenerator.generate()` en `fire-and-forget` depuis la requête web.
- Deux moteurs coexistent : `lib/assessments/*` et `lib/diagnostics/*`, avec contrats, statuts et indices différents.
- `prisma/schema.prisma` contient `Diagnostic`, `Assessment`, `Bilan`, `StageBilan`, `PedagogicalReport` et `GeneratedPedagogicalReport`, donc plusieurs générations de rapports partiellement redondantes.
- Le modèle `Student` référence directement un `ParentProfile` unique ; il ne couvre pas nativement plusieurs responsables légaux, liens vérifiés/révoqués et permissions par lien.
- Aucun modèle `Curriculum`/`CurriculumVersion` et aucun resolver de cohorte n'existent dans le schéma.
- Les mappings `programmes/mapping/*.yml` portent des clés génériques sans dates d'effet, année scolaire, BO, version préalable/cible ni session.
- `lib/programme/official-pdfs.ts` est encore un stub vide.
- Des définitions `maths-premiere-p2` contiennent des notions de Première (suites, dérivation, second degré) sans contexte de cohorte explicite ; pour un diagnostic d'entrée, leur statut de prérequis ou de cible est ambigu et nécessite une revue humaine.
- Le workflow Assessment expose des réponses correctes dans les modules serveur de banque ; une vérification systématique est requise pour garantir qu'elles ne transitent pas vers le client avant soumission.
- Le RAG applicatif est bien ChromaDB, mais l'ingestion est hors dépôt et ne fournit pas encore le manifeste gouverné exigé.

## Décisions nécessitant une ADR

- Dépôt canonique et stratégie de migration sélective (ADR-001 créée).
- Source de vérité curriculum : fichiers validés, base relationnelle ou modèle hybride.
- Convergence `Assessment`/`Diagnostic`/`Bilan` et plan de migration additive.
- Machine d'état des questions et rapports, y compris revue pédagogique.
- Architecture BullMQ/Redis, idempotence, verrouillage et DLQ.
- Stockage objet et cycle de vie des PDF.
- Format canonique de rapport et coexistence LaTeX/PDFKit/React-PDF.
- Gouvernance RAG ChromaDB et suppression éventuelle du reliquat pgvector.
- Rattachement multi-responsables légaux et matrice de permissions.

## Validation pédagogique humaine requise

- Matrices de domaines/notions/compétences et correspondances avec les BO.
- Qualification de chaque question, distracteur, barème, correction, difficulté, discrimination, temps et accessibilité.
- Définition des prérequis critiques, seuils, pondérations, catégories et recommandations.
- Distinction entre contenu préalable, cible, anticipation et question non scorée.
- Prompts, règles d'incohérence, formulations élève/parent et absence de conclusions abusives.
- Licences et qualité des ressources candidates au RAG.
- Validation de tout rapport parent avant publication pendant le pilote.
