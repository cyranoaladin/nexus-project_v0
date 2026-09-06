# Intégration familles WhatsApp et retrait des crédits

## Date et autorisation

6 septembre 2026. L’utilisateur autorise l’intégration avec les travaux des autres agents, les migrations, puis une recette WhatsApp réelle avant mise en service. Le destinataire de recette et le chemin de la configuration Meta annoncée ont été demandés, sans solliciter de secret dans la conversation.

## Sources et isolation

Lot initial : `codex/dashboard-bilans-sans-credits`, commit `c098e66ef`, base `76d542ebf`. Nouvelle intégration : `integration/parent-whatsapp-sans-credits-20260906`, depuis le vrai `origin/main` `3ac28d0b3` (convergences candidat, pricing et ARIA déjà fusionnées). Aucun merge des anciennes lignées divergentes ni écriture dans les worktrees des autres instances.

Les six chemins candidat supprimés par la convergence ne sont pas réintroduits. Le service familial appelle le service `candidate-profile-persistence.server.ts` avec transaction injectée, schéma et activation canoniques. Une page staff dédiée à l’élève complète/crée/révise son profil via les API canoniques. Inscriptions académiques et parcours ARIA actuels préservés ; retrait des crédits maintenu.

## Résolutions et vérifications

- Conflits résolus : enums Prisma (conservation RECOVER_ARIA_TURN + ajout WHATSAPP_SEND), configuration (workflow candidat conservé, crédits retirés), modèle de vue élève et tests.
- Garde commerciale actuelle conservée : l’option matière supplémentaire suspendue reste refusée ; sa suppression de crédits ne la remet pas en vente.
- Fixtures des tests ajustées pour générer leurs faux mots de passe/clés à l’exécution ; scanner de secrets inchangé. L’ajout des nouveaux fichiers à l’index a révélé ces fixtures, auparavant hors du périmètre « fichiers versionnés ».
- 104 migrations répétées sur PostgreSQL 15 jetable ; 11 tests DB réels réussis.
- Tests ciblés backend famille (87), gouvernance/paiements (93), élève/ARIA et UI candidat réussis. Totaux non additionnables (recouvrements).
- Premier passage global intégré : 1 051 suites réussies / 1 052, 12 029 tests réussis / 12 030. Seul échec : assertion de l’ancienne URL candidat ; assertion alignée sur la route canonique et test ciblé réussi. Passage final après corrections : **1 053 suites, 12 038 tests, 7 snapshots réussis**, code de sortie 0.
- `npm run lint` et `npm run typecheck` réussis. Premier build isolé complet réussi, y compris contrôles ARIA et intégrité standalone ; rebuild final après revue de sécurité réussi, code de sortie 0, `STANDALONE_ARTIFACT_VALID=true`. Sources de production de l’export identiques au commit d’intégration.
- Revue indépendante : récupération email et visibilité des factures doivent conserver la distinction entre email historique de connexion et email secondaire non vérifié, y compris après invalidation du téléphone. Corrections effectuées avec tests de régression : sélection de l’historique des challenges même révoqués/consommés, règle de confiance commune, mutation de réinitialisation conditionnée atomiquement par email/mot de passe/version de session et confiance courante. 47 tests ciblés réussis, incluant les endpoints PDF/reçu et l’espace factures parent.
- Recette navigateur intégrée réussie : parent sans email/deux enfants ; invitation chiffrée en attente avec zéro tentative ; création puis révision du dossier candidat redoublant sur le bon enfant ; activation puis connexion téléphone ; confirmation parent ; absence de consentement implicite ; refus du rejeu du lien. Remise du lien simulée depuis l’outbox de la base jetable, aucun transport Meta. Captures desktop/mobile dans `artifacts/2026-09-06-integration-familles/`, aucun débordement observé. Serveur temporaire arrêté après recette.
- Smoke local intégré : les huit pages publiques critiques répondent HTTP 200 avec un H1 unique.
- CI PostgreSQL étendue aux deux suites identité/finalisation : 5 suites, 21 tests réussis. La garde des bases jetables a d’abord refusé l’absence du marqueur de test ; marqueur explicite et nom de base jetable configurés, sans affaiblir la garde.
- Contrôles `security:repo`, `test:zero-debt`, `check:no-hardcoded` réussis après indexation des nouveaux fichiers.

## Compléments issus de la revue de la PR

Trois constats vérifiés dans le code ont été traités avant fusion :

- Les factures mixtes et achats historiques de crédits ne sont plus marqués payés sans prestation : le panier entier est contrôlé avant attribution, avec erreur métier 409 et traitement explicite par l’assistante. Les écritures déjà payées restent inchangées. Aucun crédit n’est réintroduit. Vérification élargie : 182 tests sur 11 suites réussis.
- Les CGV sont versionnées 1.1 pour le nouveau fonctionnement sans crédits ; les droits, délais et prestations des commandes antérieures restent rattachés aux conditions acceptées. Aucune acceptation historique modifiée, aucun remboursement inventé ; la règle des 24 heures sans pénalité est conservée explicitement. 28 tests réussis ; détail dans `2026-09-06-cgv-annulation-sans-credits.md`.
- Une action staff explicite libère une réservation de téléphone expirée depuis les doublons du formulaire famille. Confirmation obligatoire, contrôle serveur de la version, de l’activation et d’un éventuel renouvellement concurrent ; aucun rattachement automatique, compte/enfants/challenges conservés. Les parents activés ne sont jamais libérés ainsi. La proposition de libération exige aussi que le numéro saisi soit le numéro actuel du parent : un numéro hérité d’un compte fusionné ne permet pas de libérer un autre identifiant. 63 tests projection/UI/famille, 32 tests service/API, 65 tests de frontières et 9 tests PostgreSQL réussis (totaux avec recouvrements).

Recette navigateur du complément réussie : libération avec confirmation puis création volontaire du nouveau foyer, ancien enfant inchangé ; rendus mobiles et CGV relus. Build complet et contrôles standalone réussis. Le passage global du complément a réussi 1 055 suites sur 1 056 (12 069 tests sur 12 070) ; seule l’assertion d’inventaire des scopes de rate-limit omettait la nouvelle action. Assertion complétée et trois tests du contrat repassés, incluant les limites IP, identité staff et parent ciblé. Le résultat global de la dernière révision est disponible dans la CI de la PR.

Aucun de ces compléments ne change les deux migrations déjà appliquées. Les validations globales finales sont consignées dans les preuves de la PR ; la remise WhatsApp réelle reste distincte de la recette applicative sur données synthétiques.

## État réel de production observé en lecture seule

Connexion administrée via relais indisponible ; accès direct préconfiguré opérationnel. Les détails d’accès restent dans le journal opérationnel privé. Release active : `167b4128bfc7c2845ecc16c193eafc841e7809a5`, application en ligne. Base Nexus identifiée depuis l’environnement du processus, nom contrôlé avant toute requête : PostgreSQL 15.17. Aucune base voisine sélectionnée.

Le fichier d’environnement actif, chargé par le lanceur de production, a été inspecté sans exposer ses valeurs ni publier son chemin. Aucune clé Meta/WhatsApp exploitable trouvée dans ce fichier, les environnements PM2/Next ou les fichiers `.env` locaux inspectés. Les coordonnées publiques WhatsApp d’une autre application ne constituent pas des credentials Meta. Aucune valeur secrète publiée.

## Migrations et recette réelle

Sauvegarde dédiée réalisée et restaurée sur PostgreSQL 15 isolé. SHA256 archive : `7bbee1a03cb68b09026409667825d5d426d00ad669d8476fceda9b810db49fa3`, 13 033 989 octets, conservée hors dépôt en accès privé. Les deux migrations exactes ont réussi sur le clone : historique 102 → 104, comptages des 106 tables historiques inchangés, empreintes des anciennes colonnes users/students/subscription_requests inchangées, aucune preuve d’identité historique créée. Seule divergence de checksum antérieure : `20260425113000_add_maths_progress_track`, laissée inchangée. Une seconde répétition du script complet (verrous, garde d’historique, comparaison exacte des lignes et enregistrement atomique) a réussi ; sa réexécution a été refusée. **Production : les deux migrations ciblées ont été appliquées atomiquement le 6 septembre 2026 à 04:13 UTC**, après sauvegarde finale. Historique désormais à 104 migrations appliquées ; aucun challenge ni preuve de téléphone créé. Les anciennes lignes des trois tables modifiées ont été comparées exactement avant COMMIT. La release et les processus sont restés inchangés. Les huit routes publiques et le endpoint de santé répondent HTTP 200 après migration. SHA256 de la sauvegarde finale : `5e2c375f3617c2d165182fb7b3323dff02499cf657c98ae2bc8ff3404d23cd52`. Chemins et journaux opérationnels privés hors dépôt. Aucune migration étrangère appliquée, aucun déploiement générique exécuté ni checksum historique réécrit.

Aucun envoi réel tant que le destinataire de recette et la configuration Meta n’ont pas été identifiés. Aucun dossier d’élève réel utilisé pour un test de notification.

## Intégration et rollback

La production reste sur sa release actuelle pendant la recette préparatoire. Les migrations nouvelles sont additives, à l’exception de l’assouplissement NULL de l’email de demande d’abonnement. Aucun historique financier, compte ou bilan supprimé. Les clés d’identité téléphone ne sont pas attribuées automatiquement aux comptes historiques.

Intégration publiée dans la PR #212, depuis le commit `339dd8fa8`. Le premier contrôle CI a refusé des détails d’infrastructure dans ce rapport : détails retirés, `security:repo` repassé avec succès, sans exception ajoutée au scanner. La CI de la PR doit être verte avant fusion.

La recette Meta réelle reste **non effectuée** : configuration exploitable non localisée et destinataire de recette non fourni. Aucun WhatsApp réel envoyé. L’application n’a pas été déployée ; ce document ne vaut pas validation de mise en service.
