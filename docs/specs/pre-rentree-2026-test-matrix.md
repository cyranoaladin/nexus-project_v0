# Pré-rentrée 2026 — matrice de tests et de non-régression

## Statut

- Date : 11 juillet 2026
- Statut : **PROPOSÉ — aucun test applicatif n'est implémenté dans cette phase**
- Fuseau de référence : `Africa/Tunis`
- Périmètre : planning socle, variantes, identité, API, tableaux de bord, frontend public, pricing et historique

Documents liés :

- [spécification du planning](./pre-rentree-2026-planning.md) ;
- [contrat des sources de vérité](./pre-rentree-2026-source-of-truth-contract.md) ;
- [intégration utilisateurs et dashboards](./pre-rentree-2026-user-dashboard-integration.md) ;
- [stratégie de migration](./pre-rentree-2026-migration-strategy.md) ;
- [audit d'impact](../audits/2026-07-pre-rentree-system-impact-audit.md).

## 1. Principes de recette

1. Les tests métier sont exécutés sur une base dédiée, jamais sur la production.
2. Le temps est figé et toutes les dates sont construites dans `Africa/Tunis`.
3. Les prix attendus proviennent du service canonique, jamais de fixtures dupliquant les montants.
4. Les scénarios de concurrence utilisent une vraie transaction de base de données.
5. Chaque rôle est testé positivement et négativement, avec deux académies et deux familles distinctes.
6. Les parcours historiques V1 et Pré-rentrée V2 sont présents dans le même jeu de données de non-régression.
7. Les tests E2E utilisent des identités synthétiques sans données personnelles réelles.

## 2. Jeux de données minimaux

| Jeu | Contenu requis |
|---|---|
| `PR26_BASE` | une édition, 12 modules, 12 cohortes socle, 60 séances, 4 enseignants, 2 salles, 10 jours ouvrés |
| `PR26_VARIANTS` | variantes Première Maths/Français et Terminale Maths, dont deux variantes incompatibles atteignant le seuil |
| `PR26_CAPACITY` | cohortes à 0, 2, 3, 4 et 5 inscrits ; une dernière place disputée |
| `PR26_IDENTITIES` | visiteur, parent à deux enfants, enfant à deux responsables, homonymes, email et téléphone non vérifiés |
| `PR26_HISTORY` | anciens stages de 9 h, 12 h, 15 h `intensif-renfort`, 18 h, 20 h et 30 h avec réservations |
| `PR26_SECURITY` | admin, coach A/B, parent A/B, élève A/B et seconde académie pour les tests d'isolement |

## 3. Matrice A — domaine

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| DOM-01 | Générer le planning socle | exactement 12 modules et 60 séances | intégration |
| DOM-02 | Compter les jours d'enseignement | 10 jours, du 17 au 21 puis du 24 au 28 août | unitaire |
| DOM-03 | Contrôler chaque module | 5 séances distinctes de 2 h, soit 10 h | propriété |
| DOM-04 | Sélectionner 1, 2, 3 ou 4 matières | respectivement 10, 20, 30 ou 40 h élève | paramétré |
| DOM-05 | Sélectionner les 4 matières à chaque niveau | aucun chevauchement, au plus 4 h par jour | intégration |
| DOM-06 | Vérifier les 15 minutes d'intercours | aucun enchaînement inférieur à 15 minutes | propriété |
| DOM-07 | Vérifier le week-end | aucune séance les 22 et 23 août | unitaire |
| DOM-08 | Déclarer une variante sans cohorte ouverte | visible au formulaire, absente des 60 séances | intégration |
| DOM-09 | Ouvrir une cohorte conditionnelle validée | ajoute exactement 5 séances et 10 h de charge | intégration |
| DOM-10 | Ouvrir deux parcours incompatibles sur une ressource unique | refus avec un statut d'arbitrage explicite | domaine |
| DOM-11 | Tenter une fusion incompatible | aucune fusion implicite ; décision pédagogique obligatoire | domaine |
| DOM-12 | Calculer les totaux depuis les séances | aucune valeur agrégée divergente stockée ou affichée | contrat |

## 4. Matrice B — pricing

Les valeurs chiffrées de `PRI-01` à `PRI-04` sont des **hypothèses à valider par le responsable Nexus**. Les tests ne seront activés qu'après publication dans le catalogue canonique.

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| PRI-01 | Une matière, 10 h, hypothèse 480 TND | 48 TND/h ; acompte canonique 140 ; solde 340 | unitaire |
| PRI-02 | Deux matières, 20 h, hypothèse 900 TND | 45 TND/h ; acompte 270 ; solde 630 | unitaire |
| PRI-03 | Trois matières, 30 h, hypothèse 1 350 TND | 45 TND/h ; acompte 410 ; solde 940 | unitaire |
| PRI-04 | Quatre matières, 40 h, hypothèse 1 800 TND | 45 TND/h ; acompte 540 ; solde 1 260 | unitaire |
| PRI-05 | Appliquer le plancher stage | aucun prix effectif sous le plancher canonique | propriété |
| PRI-06 | Appliquer l'arrondi de l'acompte | une seule fonction canonique produit le résultat | contrat |
| PRI-07 | Client altère `price`, `deposit` ou `discount` | valeurs ignorées ; recalcul serveur | sécurité API |
| PRI-08 | Cumuler deux remises non cumulables | rejet ou sélection déterministe selon règle canonique | unitaire |
| PRI-09 | Dépasser le plafond de remise | remise plafonnée ou refusée explicitement | unitaire |
| PRI-10 | Catalogue absent ou produit non publié | échec fermé, aucun ancien prix de secours | intégration |
| PRI-11 | Rejouer une demande avec même clé d'idempotence | un devis/une écriture financière, même résultat | intégration |
| PRI-12 | Modifier ultérieurement le catalogue | devis accepté et historique gardent leur snapshot explicable | non-régression |

## 5. Matrice C — planning et ressources

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| PLN-01 | Maths et NSI affectées au même enseignant | aucune simultanéité entre ses séances | solveur/contrat |
| PLN-02 | Dépasser 6 h enseignant/jour | publication ou confirmation refusée | domaine |
| PLN-03 | Créer un retour après un départ dans la journée | refus hors séquence continue et déjeuner | domaine |
| PLN-04 | Créer un creux autre que déjeuner | conflit explicite | domaine |
| PLN-05 | Affecter trois salles simultanées | refus ; maximum deux | intégration |
| PLN-06 | Affecter deux cohortes à la même salle | conflit explicite | intégration |
| PLN-07 | Affecter un enseignant à deux cohortes | conflit explicite | intégration |
| PLN-08 | Inscrire un élève à deux séances simultanées | conflit explicite | intégration |
| PLN-09 | Convertir date/heure depuis un navigateur étranger | instant et libellé restent ceux d'`Africa/Tunis` | E2E |
| PLN-10 | Utiliser une date sans fuseau | validation refusée | schéma |
| PLN-11 | Cohorte à 2 élèves à la date limite | non confirmée ; workflow sous seuil déclenché | métier |
| PLN-12 | Cohorte à 3, 4 ou 5 élèves avec ressources | confirmable, dans sa capacité propre | paramétré |
| PLN-13 | Sixième inscription | transaction vers liste d'attente, jamais surcapacité | concurrence |
| PLN-14 | Deux requêtes disputent la cinquième place | une confirmée au plus, autre en attente | concurrence |
| PLN-15 | Salle NSI sans ordinateurs validés | confirmation refusée | logistique |
| PLN-16 | Salle Physique-Chimie sans équipement requis | confirmation refusée | logistique |
| PLN-17 | Enseignant non qualifié matière/niveau | confirmation refusée | autorisation métier |
| PLN-18 | Ajouter un second groupe sans enseignant | `ENSEIGNANT_SUPPLEMENTAIRE_REQUIS` ou attente | domaine |
| PLN-19 | Variante exigeant un autre créneau | `CRENEAU_SUPPLEMENTAIRE_REQUIS` | domaine |

## 6. Matrice D — utilisateurs et identités

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| IDN-01 | Visiteur soumet une demande | demande créée sans compte ni mot de passe | E2E/API |
| IDN-02 | Consentement ou responsable légal absent | validation refusée sans fuite de données | API |
| IDN-03 | Parent existant avec email vérifié | proposition de liaison, pas de doublon automatique | intégration |
| IDN-04 | Téléphone identique mais non vérifié | aucune association automatique | sécurité |
| IDN-05 | Nouveau parent | invitation/validation puis profil lié de façon auditée | intégration |
| IDN-06 | Parent ajoute un second enfant | les deux enfants restent distincts et accessibles | E2E |
| IDN-07 | Enfant a deux responsables légaux | les deux relations et leurs droits sont représentés | domaine |
| IDN-08 | Élève existant candidat à une liaison | rapprochement contrôlé, aucune fusion silencieuse | intégration |
| IDN-09 | Homonymes | aucune association par nom seul | sécurité |
| IDN-10 | Fusion de doublons autorisée | opérateur, motif, avant/après et date audités | intégration |
| IDN-11 | Parent A demande l'identifiant de l'enfant B | 404/403 uniforme, aucune donnée révélée | IDOR |
| IDN-12 | Changement d'email après inscription | accès conservé via identifiant relationnel | non-régression |
| IDN-13 | Terminale choisit trois EDS | rejet ; spécialités et option maths séparées | formulaire/domaine |
| IDN-14 | Maths expertes sans EDS Maths | combinaison refusée | domaine |
| IDN-15 | Maths complémentaires avec EDS Maths | combinaison refusée | domaine |

## 7. Matrice E — tableaux de bord

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| DSH-01 | Parent consulte ses enfants | uniquement ses relations autorisées | E2E/IDOR |
| DSH-02 | Parent ouvre une inscription | modules, cohortes, séances, acompte, solde, documents et communications cohérents | E2E |
| DSH-03 | Élève consulte son planning | emploi du temps personnel, salle, enseignant, supports | E2E |
| DSH-04 | Politique exclut la finance du dashboard élève | aucun montant ni statut financier exposé | sécurité UI/API |
| DSH-05 | Coach consulte ses cohortes | seulement ses affectations et données pédagogiques nécessaires | E2E/IDOR |
| DSH-06 | Coach tente d'accéder aux paiements | refus API, élément absent de l'UI | sécurité |
| DSH-07 | Coach saisit présence et bilan | seulement pour sa cohorte et sa séance | autorisation |
| DSH-08 | Admin ouvre l'édition | vue consolidée modules, cohortes, ressources, conflits, paiements, communications | E2E |
| DSH-09 | Admin lance une opération dangereuse | confirmation, permission et trace d'audit obligatoires | sécurité |
| DSH-10 | Donnée optionnelle absente | état vide/actionnable, aucune erreur 500 | composant |
| DSH-11 | Ancienne réservation V1 | rendu historique inchangé et sans faux module V2 | non-régression |
| DSH-12 | Navigation par rôle | aucune entrée non autorisée ; liens actifs répondent | E2E |
| DSH-13 | Changement d'état de cohorte | même statut visible sur tous les dashboards concernés | contrat |
| DSH-14 | Communication corrective envoyée | journal identique côté admin et famille | intégration |

## 8. Matrice F — API, transactions et sécurité

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| API-01 | Payload inconnu ou champ supplémentaire | schéma Zod strict, erreur stable | contrat |
| API-02 | Date, identifiant ou statut invalide | erreur structurée sans stack ni PII | contrat |
| API-03 | Même soumission répétée | une demande via clé d'idempotence | intégration |
| API-04 | Réinscription au même module/cohorte | contrainte unique et réponse explicite | intégration |
| API-05 | Réseau coupé après commit | rejeu renvoie la ressource déjà créée | résilience |
| API-06 | Transaction interrompue avant commit | aucune réservation ou écriture financière partielle | intégration |
| API-07 | Dernière place en concurrence | verrouillage/contrainte garantit la capacité | concurrence |
| API-08 | Cohorte pleine | demande placée en attente une seule fois | intégration |
| API-09 | Paiement reçu deux fois par webhook | une transaction métier, événements dédupliqués | intégration |
| API-10 | Acompte sans groupe finalement ouvert | remboursement/report suit une décision auditée | intégration |
| API-11 | Utilisateur non authentifié sur route privée | 401 uniforme | sécurité |
| API-12 | Rôle incorrect | 403 sans métadonnées sensibles | sécurité |
| API-13 | Coach change l'ID de cohorte | accès limité aux affectations | IDOR |
| API-14 | Parent change l'ID d'inscription | accès limité à ses relations vérifiées | IDOR |
| API-15 | Deux académies utilisent le même identifiant externe | isolation tenant systématique | sécurité |
| API-16 | Logs d'erreur et notifications | pas d'email, téléphone, nom de mineur ou payload complet | sécurité |
| API-17 | Prix client différent du serveur | le serveur gagne et journalise l'anomalie sans PII | sécurité |
| API-18 | Publication sans checksum de template | refus explicite | intégration |

## 9. Matrice G — frontend public

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| WEB-01 | `/stages` desktop | HTTP 200, H1 unique, CTA principal, données 2026 cohérentes | Playwright |
| WEB-02 | `/stages` à 390 px | aucun débordement horizontal, contenu et CTA utilisables | Playwright |
| WEB-03 | `/stages` à 320 px | aucune information ou action tronquée | Playwright |
| WEB-04 | Tablette | grille, calendrier et formulaire restent lisibles | Playwright |
| WEB-05 | Navigation clavier | ordre logique, focus visible, aucune trappe | accessibilité |
| WEB-06 | Lecteur d'écran | labels, erreurs, statuts et changements dynamiques annoncés | accessibilité |
| WEB-07 | JavaScript lent | état de chargement stable, pas de double soumission | E2E |
| WEB-08 | API indisponible | état d'erreur sobre et action de reprise | E2E |
| WEB-09 | Aucun module publié | état vide, aucun prix/date de secours | composant |
| WEB-10 | Cohorte complète | statut dérivé, CTA liste d'attente | E2E |
| WEB-11 | Variante conditionnelle non ouverte | visible comme choix/demande, jamais comme groupe confirmé | E2E |
| WEB-12 | Métadonnées et JSON-LD | dates, lieu et disponibilité issus de la composition serveur | SEO |
| WEB-13 | CTA WhatsApp | message construit depuis le même contenu publié, sans données sensibles en URL | E2E |
| WEB-14 | Analytics | événements consentis et sans PII ; soumission dédupliquée | analytics |
| WEB-15 | Formulaire invalide | erreurs proches des champs, focus déplacé, saisie conservée | accessibilité |
| WEB-16 | Navigateur dans un autre fuseau | horaires affichés en heure de Tunis | E2E |

## 10. Matrice H — non-régression

| ID | Scénario | Résultat attendu | Niveau |
|---|---|---|---|
| NRG-01 | `/` | HTTP 200, H1 et CTA existants fonctionnels | smoke |
| NRG-02 | `/offres` | catalogue annuel inchangé et service canonique utilisé | smoke/contrat |
| NRG-03 | `/stages` derrière feature flag désactivé | parcours public antérieur restaurable | E2E |
| NRG-04 | Page d'un stage historique | rendu et réservation historique consultables selon politique | E2E |
| NRG-05 | Connexion des quatre rôles | authentification et redirections inchangées | E2E |
| NRG-06 | Dashboards existants | pages non liées aux stages inchangées | smoke |
| NRG-07 | Réservations 9/12/15/18/20/30 h | volumes et prix historiques non recalculés | intégration |
| NRG-08 | `intensif-renfort` historique | libellé et sens conservés, non utilisé pour PR26 | intégration |
| NRG-09 | Pricing annuel et candidats libres | aucun produit, plafond ou remise modifié indirectement | contrat |
| NRG-10 | Autres campagnes | slugs, métadonnées et CTA non réécrits par l'upsert PR26 | intégration |
| NRG-11 | Anciennes factures/paiements | montants et audit immuables | intégration |
| NRG-12 | Base sans modèle V2 après rollback applicatif | application historique démarre et reste opérante | rollback |

## 11. Quality gates proposés

| Gate | Condition de passage |
|---|---|
| G0 — contrat | décisions propriétaire publiées, catalogue validé, schémas Zod et invariants relus |
| G1 — domaine | `DOM-*`, `PRI-*`, `PLN-*` et tests de migration verts |
| G2 — sécurité | matrice RBAC/IDOR, concurrence, idempotence et absence de PII vertes |
| G3 — intégration | quatre dashboards et frontend public consomment les mêmes vues serveur |
| G4 — non-régression | historique V1, offres annuelles, auth et autres campagnes verts |
| G5 — publication | répétition de l'upsert sans diff, checksum conforme, smoke et rollback répétés |

Un échec de `PLN-13`, `PLN-14`, `IDN-11`, `API-07`, `API-13`, `API-14`, `API-15`, `NRG-07` ou `NRG-11` est bloquant P0.

## 12. Commandes cibles pour la future implémentation

Les scripts exacts devront être adaptés à la configuration alors en vigueur :

```bash
npm run lint
npm run typecheck
npm run test -- --runInBand
npm run build
npx playwright test
```

Il faudra en plus une commande dédiée de validation du template, un test d'upsert répété et un test transactionnel de dernière place. L'absence de ces trois contrôles interdit la publication de l'édition.

## 13. Rollback de recette

- les tests de migration sont exécutés sur sauvegarde restaurable ou copie anonymisée ;
- le feature flag est testé dans les deux états ;
- la désactivation applicative ne supprime aucune donnée V2 ;
- aucune recette de rollback ne modifie les réservations V1 ;
- les événements externes sont simulés et idempotents.
