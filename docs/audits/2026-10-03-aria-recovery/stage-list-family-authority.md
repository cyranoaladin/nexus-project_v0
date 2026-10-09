# Listes de stages — identité, autorité familiale et projection privée

Date : 4 octobre 2026. Base du lot : `0036533e61feae5363933b5395ff909d337c7542`.

## Défauts reproduits

Les API GET `/api/student/stages` et `/api/parent/stages` sélectionnaient les réservations par e-mail. Une réservation étrangère ou non rattachée pouvait donc être sélectionnée par un contact partagé ; un changement d’adresse pouvait cacher une réservation légitime. Le lookup du profil élève utilisait également l’e-mail. Les deux lectures retournaient des réservations et stages complets, comprenant notamment des champs de prix, paiement et activation, alors que les écrans familiaux sont pédagogiques et ne confèrent aucun droit financier. La liste parent lisait les enfants sans composer la nouvelle autorité familiale.

Sept nouveaux tests échouent avant correction sur ces causes, sans changer les payloads pour les rendre inoffensifs.

## Correction

- Élève : identité de session → Student.userId unique → Student.id. Profil absent : 404 avant toute lecture de réservation/bilan. Aucun fallback e-mail.
- Parent : profil minimal id → resolveParentStudentListAccess → identifiants autorisés avant toute lecture pédagogique. Refus : liste vide privée ; autorité indisponible : 503, aucune lecture privée. La politique explicite V1_ONLY/HYBRID/V2_ONLY reste celle du service canonique.
- Réservations : filtre studentId + CONFIRMED. Projection commune typée Prisma, limitée aux références pédagogiques, dates, séances, documents publics et pseudonymes coach. Aucun prix, référence de paiement, contact, note privée ou preuve d’activation. La page parent consomme déjà uniquement id/stage/title/slug/sessions.
- Bilans : conserver les sélections publiées ; le bilan unifié parent exige encore le consentement canonique courant, en plus de l’autorité familiale générale. Les anciens tests de consentement/révocation gardent leurs assertions ; seule leur fixture d’autorité familiale est désormais explicite.
- Réponses : private/no-store et Vary Cookie, Authorization. Erreurs serveur constantes, sans message de driver.

## Preuves

- 4 suites ciblées : 21 tests réussis, dont les sept nouveaux refus/projections.
- PostgreSQL réel jetable : 4 tests réussis. Deux familles distinctes, trois réservations partageant le même contact (propre, étrangère, sans rattachement) ; seuls les liens explicites donnent accès. Changement d’e-mail sans perte de visibilité légitime. Vérification des réponses API parent et élève, absence de prix et activation, et trois lignes intactes après lecture.
- 131 migrations V1 appliquées ; relance sans migration restante ; aucun nouveau schéma dans ce lot. Instance tmpfs possédée arrêtée après campagne.
- Typecheck, ESLint ciblé et diff-check réussis. Preuves locales privées ignorées : `.artifacts/recovery/stage-list-authority-green-1791144303/`.

## Limites et rollback

Ce lot qualifie ces lectures, pas les uploads ou liens directs des anciens StageDocument/StageBilan, ni la concurrence de révocation interstores, ni l’ensemble des factures/paiements. Les ressources publiques de stage et pdfUrl historiques nécessitent leur propre qualification. Aucun droit financier élargi et aucune attribution automatique des anciennes réservations non rattachées. Aucune migration, donnée de production ou notification modifiée. Retour applicatif par commit inverse si nécessaire ; aucune opération destructive sur les données.
