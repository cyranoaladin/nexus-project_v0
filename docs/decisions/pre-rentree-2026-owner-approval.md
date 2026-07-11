# Approbation du responsable Nexus — Pré-rentrée 2026

## Registre

- Autorité : responsable de Nexus Réussite
- Date d'enregistrement : 11 juillet 2026
- Fuseau : `Africa/Tunis`
- Portée : décisions produit, pédagogiques, commerciales, logistiques et architecturales
- Effet : autorise la **conception physique** en mode DRAFT ; n'autorise ni implémentation dans cette phase, ni publication commerciale
- Source : instruction explicite du responsable Nexus transmise pour cette phase

Les décisions ci-dessous remplacent les recommandations correspondantes du document [Décisions métier et historique d'arbitrage](../specs/pre-rentree-2026-business-decisions.md). Les recommandations antérieures restent lisibles dans l'historique Git et sont reliées à ce registre.

## OWNER-001 — Période

- **Statut : APPROVED**
- **Décision :** du lundi 17 août au vendredi 28 août 2026 inclus, sans cours les 22 et 23 août, dans `Africa/Tunis`. La campagne ne peut jamais présenter la période globale comme seulement « 24 au 28 août ».
- **Justification :** la semaine Mathématiques/Français et la semaine NSI/Physique-Chimie forment une seule édition commerciale.
- **Implications techniques :** dates civiles et fuseau portés par l'édition ; jours élève dérivés de ses inscriptions ; aucun calcul dans le fuseau navigateur.
- **Implications commerciales :** tous les canaux affichent la période complète.
- **Implications pédagogiques :** la présence dépend des matières choisies, pas d'une présence uniforme sur dix jours.
- **Critères de contrôle :** `2026-08-17`, `2026-08-28`, dix jours ouvrés, aucun événement les 22–23 août, formatage `Africa/Tunis`.
- **Condition d'activation :** gate de cohérence dates/SEO/messages vert.

## OWNER-002 — Structure pédagogique

- **Statut : APPROVED**
- **Décision :** 3 niveaux, 4 blocs par niveau, 12 modules, 5 séances de 2 h par module, 60 séances, 120 heures-cours, 10 h par matière et 40 h maximum par élève.
- **Justification :** le planning socle a été vérifié sans collision selon les contraintes connues.
- **Implications techniques :** les totaux sont dérivés des modules et séances ; le socle et les cohortes conditionnelles restent distingués.
- **Implications commerciales :** les packs expriment 10/20/30/40 h par élève.
- **Implications pédagogiques :** les variantes ne créent pas automatiquement des groupes supplémentaires.
- **Critères de contrôle :** matrice canonique de [planning](../specs/pre-rentree-2026-planning.md), tests 12/60/120/40.
- **Condition d'activation :** checksum du template et validateur de planning conformes.

## OWNER-003 — Tarifs publics

- **Statut : APPROVED**
- **Décision :** 480 TND pour 1 matière, 900 TND pour 2, 1 350 TND pour 3, 1 800 TND pour 4, par élève.
- **Justification :** les prix représentent 48 TND/h pour une matière et 45 TND/h pour les packs 2 à 4, sans franchir le plancher canonique observé.
- **Implications techniques :** ajout ultérieur au catalogue canonique, getters serveur, recalcul serveur, aucun montant client fiable ni constante de composant.
- **Implications commerciales :** aucune remise automatique supplémentaire ; remises existantes non cumulables et plancher respecté.
- **Implications pédagogiques :** chaque matière finance 10 heures ; le prix ne décide pas de la compatibilité des variantes.
- **Critères de contrôle :** tests produits, plancher, arrondi, devis signé par version/checksum et absence de montant local.
- **Condition d'activation :** **publication bloquée** jusqu'à documentation des coûts directs et validation de la marge cible dans les [unit economics](../specs/pre-rentree-2026-unit-economics-inputs.md).

## OWNER-004 — Acompte

- **Statut : APPROVED**
- **Décision :** acompte de 30 %, arrondi par la règle canonique, intégralement déduit du total.
- **Justification :** un mécanisme unique évite les divergences frontend, facture et paiement.
- **Implications techniques :** calcul par service pricing ; preuve de paiement ; lien à l'inscription/demande vérifiée, jamais à l'email seul ; aucun montant dans le template.
- **Implications commerciales :** échéancier transparent et solde calculé.
- **Implications pédagogiques :** l'acompte ne vaut ni ouverture de cohorte ni compatibilité pédagogique.
- **Critères de contrôle :** `total = acompte + solde`, version de règle, idempotence, preuve financière.
- **Condition d'activation :** paiement et remboursement bout-en-bout vérifiés.

## OWNER-005 — Groupes

- **Statut : APPROVED**
- **Décision :** minimum 3 élèves confirmés et maximum 5, par cohorte.
- **Justification :** seuil pédagogique et promesse de groupe réduit.
- **Implications techniques :** capacité transactionnelle au niveau cohorte ; demande, inscription, paiement et attente sont des agrégats/états distincts.
- **Implications commerciales :** aucune place globale à l'édition ne peut être annoncée.
- **Implications pédagogiques :** le seuil est évalué après qualification des parcours compatibles.
- **Critères de contrôle :** tests à 2/3/4/5/6 élèves et concurrence sur la dernière place.
- **Condition d'activation :** service de capacité et contraintes DB validés.

## OWNER-006 — Date de confirmation et groupe sous seuil

- **Statut : APPROVED**
- **Décision :** décision d'ouverture le 10 août 2026 à 18:00 `Africa/Tunis`. Sous 3 élèves : pas de `CONFIRMED`, pas de conversion individuelle, remboursement intégral par défaut ; report seulement après accord écrit explicite, non précoché et audité.
- **Justification :** protéger les familles et laisser une semaine de replanification.
- **Implications techniques :** machine d'état, choix remboursement/report horodaté, outbox et preuve de remboursement.
- **Implications commerciales :** aucune conservation indéfinie de l'acompte.
- **Implications pédagogiques :** aucun groupe pédagogiquement insuffisant n'est ouvert pour éviter un remboursement.
- **Critères de contrôle :** seuil à l'instant limite, choix explicite, absence de report par défaut, journal financier.
- **Condition d'activation :** délai recommandé d'initiation du remboursement sous cinq jours ouvrés marqué **APPROVED_PENDING_LEGAL_TEXT_ALIGNMENT** jusqu'à alignement des CGV.

## OWNER-007 — Modalité

- **Statut : APPROVED**
- **Décision :** présentiel au centre pédagogique de Mutuelleville ; aucune cohorte hybride et aucun libellé « présentiel ou en ligne ».
- **Justification :** une modalité unique possède des ressources et une expérience vérifiables.
- **Implications techniques :** modalité portée par cohorte ; une future cohorte online possède enseignant, horaires, capacité, tarif et statut propres.
- **Implications commerciales :** aucune promesse online sans cohorte ouverte.
- **Implications pédagogiques :** pas de différentiel d'attention hybride.
- **Critères de contrôle :** lieu Mutuelleville, modalité explicite, aucun fallback online.
- **Condition d'activation :** salle et validation logistique réelles.

## OWNER-008 — Formats historiques

- **Statut : APPROVED**
- **Décision :** les formats 9/12/15/18/20/30 h et `intensif-renfort` gardent leur sens historique ou celui de leurs campagnes ; aucun ne représente les modules PR26 de 10 h.
- **Justification :** préserver contrats, réservations, factures et rapports passés.
- **Implications techniques :** produits V2 distincts, aucun recalcul/backfill sémantique.
- **Implications commerciales :** nouvelle famille commerciale Pré-rentrée 2026.
- **Implications pédagogiques :** les anciens volumes ne sont pas comparés comme des cohortes PR26.
- **Critères de contrôle :** tests de non-régression sur chaque format et snapshot.
- **Condition d'activation :** DTO V1/V2 discriminés.

## OWNER-009 — Codes produits et identifiants

- **Statut : APPROVED**
- **Décision :** édition `PRE_RENTREE_2026`, packs `PRE2026_PACK_1` à `PRE2026_PACK_4`, modules `PRE2026_{LEVEL}_{SUBJECT}_{VARIANT}`.
- **Justification :** identifiants stables, versionnés et indépendants des slugs publics.
- **Implications techniques :** packs dans le catalogue, modules dans le template, mapping slug central, aucune comparaison locale dispersée.
- **Implications commerciales :** codes non affichés comme copy marketing.
- **Implications pédagogiques :** variante explicite dans l'identifiant de module.
- **Critères de contrôle :** regex/version, unicité, registre des segments autorisés, mapping central.
- **Condition d'activation :** liste exhaustive des codes validée lors de la conception physique ; aucun code de variante inventé dans cette phase.

## OWNER-010 — Mathématiques et NSI

- **Statut : APPROVED**
- **Décision :** même enseignant pour Mathématiques et NSI ; aucune simultanéité ni second groupe silencieux.
- **Justification :** contrainte réelle de ressource.
- **Implications techniques :** affectation unique, collision bloquante et charge calculée.
- **Implications commerciales :** aucune capacité supplémentaire affichée sans ressource.
- **Implications pédagogiques :** un dédoublement exige un autre enseignant ou créneau validé.
- **Critères de contrôle :** tests de collision et charge quotidienne.
- **Condition d'activation :** enseignant nommé et disponibilité enregistrée.

## OWNER-011 — Terminale

- **Statut : APPROVED**
- **Décision :** normalement deux EDS ; Maths expertes et complémentaires sont des options ; `specialties` et `mathOption` sont distincts ; aucune interface ne présente trois EDS.
- **Justification :** fidélité au parcours académique.
- **Implications techniques :** union discriminée et règles déclaratives de cohérence.
- **Implications commerciales :** qualification claire sans promesse de pack académiquement incohérent.
- **Implications pédagogiques :** expertes exige Maths EDS ; complémentaires exclut normalement Maths EDS, avec exceptions seulement arbitrées.
- **Critères de contrôle :** tests des combinaisons acceptées/refusées et wording.
- **Condition d'activation :** matrice académique approuvée par `RESPONSABLE_PEDAGOGIQUE`.

## OWNER-012 — Compatibilité pédagogique

- **Statut : APPROVED**
- **Décision :** variantes incompatibles par défaut ; fusion seulement par règle versionnée, objectifs compatibles, approbation `RESPONSABLE_PEDAGOGIQUE`, audit et différenciation documentée.
- **Justification :** empêcher les regroupements silencieux motivés par la capacité.
- **Implications techniques :** règles hors composants/routes, version/checksum et historique d'arbitrage.
- **Implications commerciales :** le créneau socle ne promet pas l'ouverture de toutes les variantes.
- **Implications pédagogiques :** autorité formellement nommée.
- **Critères de contrôle :** absence de règle = incompatible ; preuve d'approbation obligatoire.
- **Condition d'activation :** matrice initiale publiée et signée pédagogiquement.

## OWNER-013 — Ressources bloquantes

- **Statut : APPROVED**
- **Décision :** une édition peut être `DRAFT`, mais aucune cohorte `CONFIRMED`/`PUBLISHED` sans enseignant, disponibilité, qualification, salle, capacité, matériel, absence de collision et validation logistique.
- **Justification :** une offre ne doit pas précéder sa capacité d'exécution.
- **Implications techniques :** gate transactionnel de transition ; inventaires structurés.
- **Implications commerciales :** aucune cohorte vendue sans dotation.
- **Implications pédagogiques :** NSI exige postes/comptes/réseau/alimentation/logiciels/secours ; Physique-Chimie précise expérimental ou théorique.
- **Critères de contrôle :** checklist nominative datée et validateur de ressources.
- **Condition d'activation :** toutes les preuves attachées à chaque cohorte.

## OWNER-014 — Identités et responsables légaux

- **Statut : APPROVED**
- **Décision :** relation plusieurs-à-plusieurs élève/responsable avec type, vérification, droits, dates et audit ; aucun rapprochement automatique par email/téléphone seul.
- **Justification :** protéger les mineurs et représenter les familles réelles.
- **Implications techniques :** proposition de rapprochement distincte de la fusion ; fusion confirmée, auditée et aussi réversible que possible ; demande publique séparée des comptes définitifs.
- **Implications commerciales :** tunnel bas-friction sans créer de comptes non vérifiés.
- **Implications pédagogiques :** plusieurs responsables autorisés peuvent suivre le même enfant selon leurs droits.
- **Critères de contrôle :** tests multi-enfants, multi-responsables, homonymes, révocation, IDOR et audit de fusion.
- **Condition d'activation :** modèle physique et politique de vérification approuvés.

## OWNER-015 — Visibilité financière

- **Statut : APPROVED**
- **Décision :** finance visible par admin et responsable légal autorisé ; masquée par défaut à l'élève et au coach.
- **Justification :** minimisation et séparation pédagogique/financière.
- **Implications techniques :** DTO et guards par audience, pas seulement masquage UI.
- **Implications commerciales :** le parent dispose du total, acompte, solde, facture et remboursement.
- **Implications pédagogiques :** le coach ne reçoit que les données nécessaires à sa cohorte.
- **Critères de contrôle :** tests API négatifs coach/élève et IDOR parent.
- **Condition d'activation :** matrice RBAC verte.

## OWNER-016 — `BusinessConfig`

- **Statut : APPROVED**
- **Décision :** `BusinessConfig` peut porter flags et options non contractuelles autorisées, jamais prix, acompte, remise, dates, horaires, durée, capacité, seuil, produits, matières, niveaux ou règles académiques.
- **Justification :** interdire une source parallèle silencieuse.
- **Implications techniques :** allowlist de clés, validation de conflit fail-closed et audit.
- **Implications commerciales :** un opérateur ne peut modifier un engagement hors catalogue.
- **Implications pédagogiques :** aucune règle de parcours pilotée par configuration générique.
- **Critères de contrôle :** test d'interdiction par catégorie et erreur explicite.
- **Condition d'activation :** périmètre des clés PR26 figé dans le contrat technique.

## OWNER-017 — Sources de vérité

- **Statut : APPROVED**
- **Décision :** catalogue via JSON + `lib/pricing.ts`; template versionné seulement pour initialisation ; DB opérationnelle après upsert transactionnel/idempotent ; contenus éditoriaux typés ; snapshots historiques ; DTO serveur pour UI.
- **Justification :** une autorité par nature et phase de donnée.
- **Implications techniques :** checksum, contraintes uniques, aucun frontend lisant template/JSON canonique.
- **Implications commerciales :** prix et disponibilité composés côté serveur.
- **Implications pédagogiques :** modules/variantes opérationnels en DB, pas déduits du contenu.
- **Critères de contrôle :** second upsert sans diff, imports interdits et tests de checksum.
- **Condition d'activation :** ADR 005 acceptée et services de frontière conçus.

## OWNER-018 — V1 et V2

- **Statut : APPROVED**
- **Décision :** V1 historique, V2 additif, DTO `LEGACY_STAGE`/`EDITION_V2`, aucune écriture duale ou migration destructive, flags public/API/dashboards distincts.
- **Justification :** empêcher la réinterprétation rétroactive.
- **Implications techniques :** migrations additives et adaptateur de lecture limité.
- **Implications commerciales :** anciennes réservations et factures conservent leur sens.
- **Implications pédagogiques :** anciens bilans/programmes restent attachés à leur édition.
- **Critères de contrôle :** fixtures V1/V2 et zéro écriture V1 pour PR26.
- **Condition d'activation :** tests historiques et rollback applicatif verts.

## OWNER-019 — Archivage

- **Statut : APPROVED**
- **Décision :** archivage logique, transitions historisées, engagements/preuves/communications conservés ; aucun hard delete en cascade d'une édition utilisée.
- **Justification :** auditabilité financière, pédagogique et légale.
- **Implications techniques :** statuts et éventuellement `archivedAt`; politiques d'accès aux archives.
- **Implications commerciales :** engagements familiaux restent prouvables.
- **Implications pédagogiques :** présences et bilans ne disparaissent pas par suppression d'édition.
- **Critères de contrôle :** contraintes de suppression, tests d'archive/restauration logique.
- **Condition d'activation :** politique de rétention séparée validée avant production de données réelles.

## OWNER-020 — Anciennes dates

- **Statut : APPROVED**
- **Décision :** campagne corrective future segmentant lead, famille contactée, préinscription, acompte et inscription confirmée ; aucun envoi dans cette phase.
- **Justification :** traiter proportionnellement les engagements et éviter les messages contradictoires.
- **Implications techniques :** journal multicanal, version de message et statut de réponse.
- **Implications commerciales :** période 17–28 août, jours selon matières, confirmation/modification/annulation.
- **Implications pédagogiques :** matières et parcours reconfirmés.
- **Critères de contrôle :** même contenu email/WhatsApp/dashboard/admin et aucune PII dans les logs.
- **Condition d'activation :** inventaire des familles, message et droits de remboursement validés.

## OWNER-021 — Page publique dédiée

- **Statut : APPROVED**
- **Décision :** route canonique `/stages/pre-rentree-2026`, raccourci `/pre-rentree` redirigé ; accès en un clic depuis navigation, accueil, `/stages` et section stages de `/offres`.
- **Justification :** URL durable et parcours de conversion explicite.
- **Implications techniques :** redirection centralisée, canonical SEO et feature flag ; aucune implémentation dans cette phase.
- **Implications commerciales :** point d'entrée unique pour campagne.
- **Implications pédagogiques :** contenu public reflète modules et variantes réellement publiés.
- **Critères de contrôle :** HTTP/canonical, navigation, mobile, accessibilité, analytics sans PII.
- **Condition d'activation :** preview validée et gates de publication verts.

## OWNER-022 — Conditions de publication

- **Statut : APPROVED**
- **Décision :** développement autorisable en `DRAFT`; publication bloquée jusqu'à validation des coûts/marge, ressources, CGV, prix, concurrence, autorisations, non-régression, mobile/accessibilité, preview et campagne corrective.
- **Justification :** séparer faisabilité technique et promesse publique exécutable.
- **Implications techniques :** gates versionnés et flags désactivés par défaut.
- **Implications commerciales :** aucun prix approuvé n'est publiable sans validation financière et opérationnelle.
- **Implications pédagogiques :** aucune cohorte publiée sans compatibilité et ressources.
- **Critères de contrôle :** registre [des gates d'activation](../specs/pre-rentree-2026-activation-gates.md) entièrement renseigné.
- **Condition d'activation :** décision finale de publication enregistrée après preuves ; aucune auto-activation.

## Synthèse des effets

| Effet | Statut |
|---|---|
| Continuer vers la conception physique additive | Autorisé |
| Modifier Prisma, le code ou le pricing dans cette phase | Interdit |
| Développer ultérieurement derrière flags en DRAFT | Autorisable par phase dédiée |
| Publier les prix ou ouvrir les inscriptions | Bloqué par les gates |
| Publier une cohorte | Bloqué par ressources, seuil, compatibilité et tests |
| Envoyer la campagne corrective | Non demandé ; bloqué jusqu'à préparation/validation |

## Vocabulaire d'état à préserver

Les décisions fixent au minimum les termes `DRAFT`, `CONFIRMED` et `PUBLISHED` là où ils s'appliquent. Les cycles d'édition, cohorte, demande, inscription et paiement restent des machines d'état distinctes. Les anciens libellés français présents dans les analyses (`DEMANDE_RECUE`, « groupe en constitution », « cohorte non ouverte », etc.) décrivent des états ou événements métier mais ne constituent pas encore une liste d'enums Prisma approuvée. La conception physique doit produire des registres centraux, leurs transitions et le mapping des libellés ; aucune route ou composant ne crée ses propres chaînes.

## Traçabilité

Toute évolution d'une décision OWNER exige un nouvel enregistrement daté qui référence l'identifiant remplacé, décrit l'effet sur les données existantes et met à jour les gates. Aucun changement silencieux de ce fichier ne vaut décision opérationnelle.
