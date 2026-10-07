# Bilan de septembre intégré à l’espace pédagogique

## Contexte et périmètre

Le questionnaire précédemment livré comme site autonome doit être intégré à `nexusreussite.academy/espace`. Deux parcours, troisième et seconde, exploitent uniquement la banque issue des livrets analysés. Aucun lien ChatGPT n’est nécessaire au parcours. L’identité est issue du compte authentifié ; l’élève ne peut pas choisir librement un autre niveau.

## Décisions pédagogiques

Huit étapes : contenus effectivement travaillés, auto-positionnement, au plus deux essais facultatifs, méthodes, vécu des séances, progrès ressentis, deux priorités et relecture. Les 33 questions communes utilisent choix simples/multiples et réponses libres. Chaque niveau propose 16 compétences. Un livret distribué ne prouve pas que toutes ses pages ont été faites : aucun contenu travaillé n’est présélectionné. Une tâche et chacun de ses prérequis sont proposés seulement pour les thèmes déclarés travaillés ; une compétence non travaillée exclut l’essai associé.

L’auto-positionnement reste une déclaration. Les premiers essais, les aides et les reprises sont distincts. Les progrès ne sont pas automatiquement inférés. Les corrigés sont réservés à la page enseignant authentifiée. Le rapport imprimable distingue parole de l’élève, traces et commentaires du professeur ; il reste un projet tant que la relecture n’est pas terminée. La trame d’observation propose au plus deux priorités concrètes et vérifiables.

## Architecture et accès

Deux activités `RESOURCE_PACK` utilisent les tables existantes `EspaceWork`, versions et annotations. Aucune migration SQL. Les réponses sont sauvegardées avec révision optimiste ; le mécanisme existant gère conflits et reprise réseau. Le tampon IndexedDB est isolé par utilisateur et travail. La transmission exige une confirmation et verrouille les réponses.

Un élève doit être inscrit en mathématiques ET participant d’une séance publiée portant l’activité concernée. Ce contrôle existe à l’ouverture, à la lecture et à chaque écriture. Le paramètre d’URL n’accorde aucun droit. Les bilans non attribués sont masqués du catalogue et du tableau de bord. Les enseignants conservent les contrôles de groupes/matières existants. L’aperçu enseignant fonctionne sans créer de copie d’élève.

Routes : `/espace/bilan/3e`, `/espace/bilan/2nde`, `/espace/enseignant/bilans` et rapport `/espace/enseignant/bilans/[workId]`.

## Affectation des élèves

Au pré-vol, les seuls groupes réels de l’espace étaient `terminale-principal` et `jean-racine`. Aucun groupe troisième/seconde n’était enregistré. La liste privée de provisioning retrouvée contient uniquement ces inscriptions terminale ; elle ne permet pas d’inventer celles des nouveaux niveaux. La source de la liste troisième/seconde a été demandée au propriétaire pendant l’implémentation.

Après réception de la liste : rapprochement de comptes existants, dry-run `scripts/espace/provision.ts apply`, création/adoption sans doublon puis publication d’une séance par groupe et niveau. Ne pas inscrire tous les comptes historiques selon une classe ancienne. Ne pas publier une liste nominative dans le code ni sur une page publique.

## Vérifications

- TypeScript : `npx tsc --noEmit`, réussi.
- Lint : `npx next lint --max-warnings 300`, réussi avec avertissements historiques.
- PostgreSQL jetable : neuf suites historiques, 156 tests réussis ; quatre tests nouveaux d’attribution, isolation, sauvegarde, révision, remise et fermeture réussis.
- Navigateur Chromium : quatre scénarios réussis (troisième complet avec rechargement et transmission ; seconde mobile sans débordement ; élève sans attribution ; aperçu enseignant).
- Captures de validation conservées hors livraison publique dans `test-results/bilan/`.
- Suite globale et build autonome : résultats à compléter après exécution finale.

## Déploiement et rollback

Le chantier part de `5f1bd5135`, dont le code applicatif est identique à la release de production `e8a81cba0`. Les ajouts intermédiaires sont des gardes/outils/documents de sécurité. Aucun basculement vers la branche principale ni migration historique.

Sauvegarde PostgreSQL réalisée avant mutation. Le catalogue est synchronisé par l’outil officiel `provision.ts sync-activities --execute`, puis audité. Artefact construit dans un clone propre extérieur aux worktrees, avec Node 22.23.1. Bascule par `switch-release.sh` avec verrou, comparaison de la release attendue, audit du catalogue, contrôle des pointeurs et rollback automatique sur défaut de santé.

Rollback applicatif : pointer, via le même script et avec la nouvelle release en valeur attendue, vers `e8a81cba0-espace-validation-scope-20261004T1827Z`. Les deux lignes de catalogue supplémentaires peuvent rester en base ; aucune suppression des réponses n’est nécessaire.
