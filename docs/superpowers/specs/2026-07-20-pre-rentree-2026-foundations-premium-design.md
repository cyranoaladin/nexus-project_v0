# Pré-rentrée 2026 Fondations / Premium — Design de la release candidate REVIEW

## Statut

Conception approuvée par le cahier des charges directeur du 20 juillet 2026. Cette release candidate reste interdite de diffusion, de merge et de déploiement tant que les revues propriétaire, juridique et confidentialité sont en attente.

## Objectif

Faire de la campagne Pré-rentrée 2026 un système intégré et reproductible couvrant quatre niveaux, quatorze modules, soixante-dix séances, deux gammes réellement différenciées, des preuves pédagogiques matérialisées, des documents parents, des kits de communication, une page web, un modèle économique et des outils de pilotage.

## Architecture

Les sources métier versionnées restent séparées par responsabilité : campagne et planning dans `data/campaigns/pre-rentree-2026.json`, prix dans `data/pricing.canonical.json`, offres et capacités dans `content/pre-rentree-2026/`, programmes dans `modules.json`, preuves pédagogiques dans des fichiers structurés dédiés. Le compilateur TypeScript valide les conflits, calcule les dérivations et produit un snapshot JSON fermé. Le renderer Python, le site Next.js, les audits et les packages ne consomment que ces contrats validés.

Les sorties binaires restent sous `.artifacts/pre-rentree-2026/` et dans les artefacts GitHub Actions. Git ne suit que les sources et le snapshot reproductible. Le mode `REVIEW` marque visiblement les éléments non approuvés ; le mode `RELEASE` échoue tant qu'une gate humaine, juridique, confidentialité, staffing, salle, capacité ou stock manque.

## Offres et tarification

- Fondations : entrée en 3e (Mathématiques, Français) à 350 TND par matière ; entrée en Seconde (Mathématiques, Physique-Chimie, Français, initiation informatique/algorithmique/SNT) à 400 TND par matière. Quatre à six élèves, sans remise multimatières.
- Premium : entrée en Première et Terminale, packs de une à quatre matières à 480, 900, 1 350 et 1 800 TND. Trois à cinq élèves.
- Tous les acomptes valent exactement 30 % du total : 105, 120, 144, 270, 405 ou 540 TND selon l'offre. Le calcul n'est jamais recopié dans une surface de rendu.
- La demande d'information ne réserve rien. Une réservation n'existe qu'après qualification, transmission des conditions applicables et encaissement de l'acompte.

## Catalogue pédagogique

Le catalogue comprend deux modules de 3e, quatre de Seconde, quatre de Première et quatre de Terminale. Le Français Terminale est remplacé par la Philosophie, qui intègre argumentation, problématisation, dissertation et explication de texte. Chaque module expose cinq séances complètes et référence cinq évaluations rapides et cinq livrables matériels.

Les quatorze positionnements sont structurés en sujet, corrigé, barème, domaines, typologie d'erreurs, grille Acquis/Fragile/Lacune, version, durée, matériel, échantillon anonymisé et contrôles de cohérence. Les preuves sont des sources pédagogiques ; les documents parents n'en publient que les engagements autorisés par les matrices de capacité et de valeur.

## Parcours 360 et manuels

Les capacités distinguent conception, implémentation, test, préparation opérationnelle, approbation propriétaire et engagement public. Un texte public ferme ne peut être rendu que si `PUBLICLY_COMMITTED=true` et si sa preuve est prête et approuvée.

Les quatre manuels éligibles sont pilotés par registre. Le badge public exige simultanément `printReady`, `ownerApproved` et `stockReady`. En l'absence de ces états, le système documente le blocage sans promettre l'avantage aux familles.

## Planning et staffing

Le planning source couvre les 17–21 et 24–28 août, avec pause les 22 et 23. Il doit matérialiser soixante-dix séances, détecter tout conflit de salle ou d'enseignant et vérifier la charge quotidienne. Les affectations utilisent des rôles non nominatifs dans le dépôt public. Un planning public diffusable exige les cinq gates d'affectation ; sinon il n'apparaît que comme brouillon de revue clairement marqué.

## Documents et communication

Le Guide Parents est l'entrée principale. Il présente les offres, la méthode, le catalogue complet, le planning, les tarifs, la réservation, les informations pratiques, la FAQ et le contact. Des annexes courtes, quatre programmes de niveau, un comparatif et des kits de communication sont dérivés du même snapshot.

Les formulaires et outils internes restent des modèles anonymes dans le paquet de revue. Aucun fichier nominatif ni prétendument privé n'est publié dans Git. Le modèle économique XLSX, les visuels, captures, PDF et ZIP sont générés et manifestés hors Git.

## Site et calculateur

La page `/stages/pre-rentree-2026` consomme les mêmes getters canoniques. Le configurateur filtre les matières par niveau, calcule prix/acompte/solde, montre les compatibilités de planning et construit un CTA WhatsApp tracé. Il ne prétend jamais réserver une place avant réception de l'acompte et masque tout badge manuel non validé.

## Erreurs et gates

Tout conflit de source, référence invalide, prix incohérent, preuve absente, capacité non engagée, planning en conflit, promesse interdite, dépendance distante, secret, PII, duplication ou artefact généré suivi fait échouer le build ou l'audit concerné avec un message actionnable. Le mode REVIEW peut produire des éléments clairement marqués comme non diffusables ; le mode RELEASE ne contourne aucune gate.

## Vérification

Le travail suit RED–GREEN–REFACTOR. Les tests TypeScript couvrent les sources, les dérivations, le site et le snapshot ; les tests Python couvrent le renderer, les audits, le tableur et les packages ; Playwright couvre accessibilité et responsive ; deux builds fixes comparent leurs empreintes. La CI ne possède qu'une permission de lecture et ne publie que des artefacts de workflow.
