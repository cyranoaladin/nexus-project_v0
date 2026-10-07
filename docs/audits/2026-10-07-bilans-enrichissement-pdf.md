# Enrichissement des quatre bilans de septembre à partir des PDF

## Demande et couverture

Plan validé par le « go » utilisateur. Seize pages analysées visuellement et par extraction ; inventaires et correspondances dans `docs/pedagogie/bilans-enrichissement-pdf/`. Les figures sont transcrites intégralement, notamment AM3, AB6, AN4 et BC10 pour Thalès.

| Profil | Questions réflexives | Compétences | Essais disponibles | Étapes |
|---|---:|---:|---:|---:|
| Troisième | 76 | 30 | 14 | 13 |
| Seconde | 79 | 30 | 13 | 13 |
| Terminale maths | 74 | 24 | 8 | 12 |
| Terminale NSI | 75 | 22 | 8 | 12 |

Les questions nouvelles restent facultatives ; le parcours peut être fractionné. Les dix habitudes emploient des choix compacts. Les essais restent séparés, facultatifs et limités à deux avec le professeur. Aucun score ni diagnostic automatique. Les nouveaux thèmes sont proposés uniquement après déclaration de travail effectif ; aucune notion collège/Seconde n’est importée comme chapitre Terminale.

## Conservation des données et restitutions

Banques historiques inchangées ; compléments distincts. Identifiants, énoncés, options et prérequis historiques conservés. Les compétences nouvelles utilisent `mastery-extra` sans déplacer les anciennes réponses. Nouveau code `difficulty` ajouté sans modifier le sens de `start`. Les aides prioritaires sont choisies parmi les aides sélectionnées, et seule une priorité devenue incompatible est vidée. Les conditions et la confiance des essais sont facultatives, validées et restituées dans la relecture, la vue enseignant, le rapport et l’export.

L’identité connue et le groupe de la copie sont affichés en lecture seule. La date `startedAt` est celle du début du bilan ; une revue a fait corriger un libellé qui la confondait avec le début de l’accompagnement. L’assiduité et la date de début Nexus sont des déclarations facultatives distinctes. Les copies transmises restent verrouillées ; les nouveaux champs vides ne sont pas interprétés comme une difficulté.

Navigation par identifiants et critères d’affichage adaptés aux deux étapes de maîtrise. Maximum24champs par étape,16étapes,256Kio par copie. Les douze nouveaux corrigés restent exclusivement dans le module `server-only`.

## Vérifications effectuées avant compilation

- TDD : échecs observés pour fichiers de données absents, rubriques nouvelles, maîtrise complémentaire, métadonnées d’essai, priorité dépendante, contexte, hints et retour après essais ; tests rendus verts.
- Régression initiale :846tests/47suites.
- Régression enrichie intermédiaire :894tests/50suites ; tests ciblés supplémentaires ensuite validés.
- Intégration PostgreSQL jetable :23tests/2suites, dont saisie complémentaire, transmission, récupération enseignant/export et verrouillage.
- Typage global, lint ciblé et `git diff --check` réussis.
- Revue pédagogique et technique indépendante :aucun P0/P1 restant identifié après correction de la date.

Les campagnes navigateur, la compilation exacte et la publication font l’objet d’une consignation après exécution. Aucun déploiement n’est attesté par cette section préparatoire.

## Retour arrière

Après saisie de nouveaux champs, une ancienne release peut rejeter leur validation. Ne pas restaurer la base en supprimant des réponses récentes. Employer un correctif compatible avec les nouveaux IDs/propriétés, ou limiter temporairement les écritures avant reprise. Les sauvegardes et l’ancienne release sont conservées, mais ne constituent pas à elles seules un retour arrière applicatif compatible.
