# Logique métier Nexus Réussite

## Finalité

Nexus est une plateforme de pilotage éducatif adossée à un accompagnement humain. Le diagnostic sert à orienter le coaching, construire un plan de séances, rendre compte à la famille et mesurer la progression. Ce n'est ni un LMS autonome, ni un portail de tests indépendant, ni un produit IA séparé.

Les sources métier historiques décrivent cinq rôles applicatifs (`ADMIN`, `ASSISTANTE`, `COACH`, `PARENT`, `ELEVE`), un modèle abonnement + crédits, des stages, des séances et ARIA. Le cahier des charges Bilans étend la responsabilité pédagogique aux enseignants et responsables pédagogiques sans que ces rôles existent encore dans `UserRole`.

## Affectation d'un diagnostic

Une disponibilité résulte d'une règle serveur portant au minimum sur : inscription Nexus active, année scolaire, classe d'entrée, voie, spécialités, options, matières suivies, programme réellement suivi l'année précédente et programme cible. L'identité et l'élève sont dérivés de la session et des liens autorisés ; un client ne choisit jamais librement `studentId`, niveau ou curriculum faisant foi.

Une affectation est snapshotée au démarrage avec : `definitionVersion`, année/cohorte, curriculum préalable et cible, voie/variantes, accommodations, langue et durée. Une modification ultérieure du registre ne modifie pas une tentative commencée.

## Parcours élève

```text
authentification → dashboard élève → diagnostics disponibles
→ STARTED/IN_PROGRESS avec autosave et reprise
→ soumission idempotente → scoring déterministe
→ résultat déterministe autorisé immédiatement
→ rapport asynchrone → revue Nexus → publication STUDENT
```

L'élève ne reçoit jamais la version parent ou interne. Il peut voir une limitation explicite lorsque couverture ou qualité de données sont insuffisantes. Le statut de rapport ne masque pas le `ScoreSnapshot`.

## Parcours parent / responsable légal

```text
authentification → enfant lié et lien actif → diagnostics de cet enfant
→ publications PARENT uniquement → PDF privé signé/téléchargé
→ recommandations et suivi
```

Le modèle actuel `ParentProfile.children` / `Student.parentId` autorise plusieurs enfants par parent mais un seul parent par enfant. La cible exige une association explicite plusieurs-à-plusieurs, vérifiée, datée, révocable, avec permissions et historique. La publication parent est indépendante de la publication élève.

## Parcours équipe Nexus

```text
affectation active → scores + preuves → version interne
→ recommandations et plan de séances → revue/validation
→ publications élève et parent distinctes → suivi de progression
```

Le coach n'accède qu'aux élèves affectés pendant la fenêtre active. Enseignant et responsable pédagogique doivent être modélisés par capacités explicites avant d'être utilisés. L'assistante coordonne mais ne doit pas recevoir par défaut les verbatims pédagogiques sensibles. L'administrateur n'est pas une justification pour mélanger les audiences.

## Règles d'évaluation

1. Le score ne dépend jamais du LLM.
2. Une réponse ne peut être scorée qu'avec la définition et le barème versionnés.
3. Autoévaluation et performance sont comparées, jamais fusionnées.
4. `NOT_STUDIED`, `DONT_KNOW`, `UNANSWERED`, `TIMEOUT`, `CONCEPTUAL_ERROR`, `TECHNICAL_ERROR` et `READING_ERROR` sont distincts.
5. Une notion non étudiée réduit la couverture, pas la maîtrise observée.
6. Une absence de réponse n'est pas automatiquement une erreur conceptuelle.
7. Les questions IA restent `DRAFT/IN_REVIEW` jusqu'à validation pédagogique.
8. Le rapport parent requiert initialement une approbation humaine.
9. Toute recommandation interne cite des Evidence IDs ; toute ressource externe cite des chunks RAG.
10. Toute publication est révocable sans destruction de l'historique.

## Rapports par audience

| Audience | Contenu permis | Contenu interdit par défaut |
|---|---|---|
| Élève | résultats compréhensibles, forces, priorités, actions, limites | notes internes, hypothèses sensibles, version parent |
| Parent | synthèse factuelle, recommandations, limites, suivi | verbatims inutiles, détails internes, version élève brute |
| Nexus interne | preuves, erreurs dominantes, qualité, plan de séances, journal de revue | données sans finalité, secrets fournisseur |

## Contraintes pédagogiques initiales

Les diagnostics d'entrée couvrent Seconde, Première et Terminale, en Mathématiques, Physique-Chimie, NSI/SNT et Français selon les parcours valides. Pour une entrée en Seconde, l'informatique relève d'une préparation SNT, pas d'une spécialité NSI. En Terminale, le Français est transversal plutôt qu'un programme officiel de Français obligatoire.
