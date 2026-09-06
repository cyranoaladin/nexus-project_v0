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


## Compléments de revue croisée — identité et robustesse

- Les changements de téléphone administrateur écrivent le contact et sa forme canonique atomiquement. Activation et réémission email vérifient aussi l’adresse, le rôle et l’absence de fusion lors de la transition.
- La migration additionnelle `20260906130000_parent_email_activation_invalidation` révoque les anciens liens email des parents non activés dont la destination historique n’est pas prouvable, puis invalide les liens lors des changements futurs d’adresse. La réémission est nécessaire ; aucun compte, enfant, droit ou historique pédagogique n’est supprimé. Les deux migrations déjà appliquées restent immuables.
- L’anonymisation efface les numéros des challenges et les contenus des invitations WhatsApp, conserve la provenance nécessaire au contrôle de confiance email et refuse un effacement pendant un envoi actif. L’exécuteur appelle ce traitement même si une ancienne proposition omet les challenges.
- Les trois POST sensibles et le webhook lisent désormais le corps par flux borné, y compris sans Content-Length. Un préflight WhatsApp défaillant empêche explicitement le démarrage du serveur.
- Les virements historiques de packs sont reconnus lors d’une nouvelle déclaration ; les nouvelles lignes utilisent SPECIAL_PACK. Le formulaire candidat exige un rechargement après conflit ; ADMIN peut accéder à sa seule page candidate autorisée. Recherche par établissement, temporisation, rattachement explicite après changement de coordonnées, récupération de lien expiré et emails facultatifs sont couverts.
- Les assertions du parcours d’annulation ont été alignées : aucune promesse de remboursement de crédits. Les soldes historiques sont conservés.

### Points de revue écartés après lecture

- Le namespace `products.credits` reste retiré du snapshot opérationnel, conformément à la demande produit. Les lignes historiques en base sont conservées ; les rendre à nouveau actives réintroduirait une règle supprimée.
- L’alias POST students n’a aucun appelant interne résiduel. Son contrat de migration exige téléphone et idempotence, avec conservation additive de studentId pour un enfant ; aucune création sans identité vérifiable n’est réintroduite.
- L’arrêt du processus relève du gestionnaire central de Next 15.5.21, qui ferme le serveur et termine le processus. Aucun usage de NEXT_MANUAL_SIG_HANDLE n’est présent dans les sources. Le scheduler WhatsApp libère son propre timer ; il n’appelle pas process.exit indépendamment des autres workers.

### Vérifications intermédiaires de cette revue

- Lot précédent : 1 056 suites, 12 075 tests, 7 snapshots passent.
- Compléments : tests ciblés RED puis GREEN, TypeScript et lint passent ; scanners de secrets et d’artefacts interdits passent.
- Migration additionnelle : 14 tests PostgreSQL couvrent les changements de coordonnées et la révocation de transition ; l’anonymisation est vérifiée sur PostgreSQL synthétique.
- Vérification intermédiaire du commit `38a67028d` : 1 064 suites, 12 120 tests et 7 snapshots passent ; build de production complet et artefact standalone valides. Aucun écart entre les sources de l’export vérifié et le commit `38a67028d` (hors manifeste généré).
- Ces résultats ne constituent ni une recette Meta réelle ni une mise en service.


## Application de la troisième migration — 6 septembre, 05:00 UTC

- `20260906130000_parent_email_activation_invalidation` appliquée atomiquement avec son enregistrement Prisma ; SHA256 `a3754a53848538b53af4eea23c6d9ea37a6d016bc928fe6c4daacbc49fd2c095`.
- 105 migrations appliquées, aucune inachevée ; trois anciennes entrées annulées du journal restent conservées.
- Sauvegarde fraîche restaurée sur PostgreSQL 15 avec vector, sans réseau ni volume persistant. Qualification de la transaction exacte, comparaison EXCEPT ALL des lignes métier et refus du rejeu réussis.
- Dernière sauvegarde de production avant transaction : 13 040 914 octets ; SHA256 `b4fc486046209d85836311bdb8487533a0957c1281ef28d0983ffda46e268fc3`. Dossier et logs conservés hors dépôt en stockage privé.
- Seuls activationToken et activationExpiry des 12 parents non activés concernés ont été vidés. Aucun autre changement de ligne métier accepté par les assertions transactionnelles. Le nombre de jetons historiques concernés restant est zéro.
- Après commit : huit routes publiques critiques et `/api/health` répondent 200. Release et processus applicatifs identiques ; aucun déploiement applicatif ni envoi Meta effectué.
- Ne pas restaurer des liens révoqués pour revenir au comportement vulnérable : leur réémission crée une nouvelle preuve d’adresse. Un rollback applicatif éventuel conserve cette migration additive.


## Dernière revue du transport

- Le webhook conserve le verrou du worker actif même lorsqu’il enregistre une livraison. L’anonymisation refuse alors toute écriture, jusqu’à la fin de l’appel fournisseur. Le worker libère son propre verrou sans écraser cette preuve ; les verrous terminaux expirés sont récupérés sans modifier la livraison.
- Chaque tentative reçoit un délai propre et renouvelle sa propriété par CAS juste avant l’appel Meta. Une validation trop lente, un délai expiré ou une perte de propriété empêchent l’envoi.
- Une proposition d’anonymisation de challenge doit inclure explicitement son utilisateur ; validation à la construction et avant exécution, sans élargissement implicite de l’effacement.
- Les corps HTTP UTF-8 malformés sont refusés avant persistance ; les tests nettoient leurs notifications de fixture et vérifient la réponse multi-enfants sans alias ambigu.
- Vérification ciblée finale : 101 tests unitaires WhatsApp/RGPD et quatre tests PostgreSQL passent, ainsi que les contrôles TypeScript et lint. Les tests HTTP/startup (25), alias famille (3) et nettoyage des notifications (6 PostgreSQL et 13 unitaires) passent également. La suite globale et le build sont relancés sur ce dernier correctif.


## Résultat final de l’intégration

- Code applicatif vérifié : commit `c12217851`, descendant de `38a67028d` et des corrections précédentes. L’ultime complément ne modifie que la documentation et la présentation de deux tests.
- Suite globale : **1 064 suites, 12 130 tests, 7 snapshots passent** (317 s). Les deux tests retouchés ensuite sans changement de comportement sont rejoués séparément.
- `npm run build` complet réussit : artefact standalone valide ; sources de l’export identiques au code applicatif intégré, hors manifeste généré. TypeScript, lint et scanners passent.
- Les trois migrations de cette intervention sont appliquées, 105 au total. Sauvegarde finale copiée hors serveur et empreinte vérifiée. Clones restaurés et base synthétique supprimés, sauvegardes et preuves privées conservées.
- Les anciennes remarques de revue ont été résolues après contrôle des corrections ou des décisions explicitement documentées. La fusion GitHub reste soumise aux contrôles et à la revue requise.
- **Recette WhatsApp réelle non effectuée** : le fichier de configuration Meta actif et le destinataire contrôlé restent à identifier. Aucun envoi réel et aucun déploiement applicatif n’ont été réalisés. Le protocole détaillé figure dans `lib/whatsapp/README.md`.
