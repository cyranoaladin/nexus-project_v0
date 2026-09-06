# Invitations parent WhatsApp

Le dossier et `ParentPhoneChallenge` sont créés dans la même transaction que
`enqueueParentWhatsAppInvitation(tx, { userId, ...challenge })`.
Après COMMIT seulement, appeler `kickParentWhatsAppOutboxDrain()`.
Le téléphone et le jeton brut sont chiffrés AES-256-GCM dans `JobOutbox` ; aucune
nouvelle table de messages et aucun schéma email n'est utilisé.

## Configuration (aucune valeur réelle incluse)

- `WHATSAPP_OUTBOX_ENCRYPTION_KEY` : secret dédié stable, au moins 32 caractères ;
  nécessaire dès la mise en file. Ne pas remplacer ce secret sans traiter les
  intentions existantes : version `v1` ne réalise pas de rotation automatique.
- `WHATSAPP_OUTBOX_WORKER_ENABLED=true` : scheduler opt-in Node, singleton par
  processus, intégré à `instrumentation.ts` ; intervalle par défaut 5 secondes.
- `WHATSAPP_OUTBOX_POLL_INTERVAL_MS` : optionnel, 1000 à 60000.
- `WHATSAPP_SEND_ENABLED=true` : autorise le transport Meta ; absent = indisponible.
- `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_PHONE_NUMBER_ID`,
  `WHATSAPP_META_API_VERSION` : configuration Meta. Version explicite `vN.0` ;
  aucun fallback de version ni URL externe arbitraire.
- `WHATSAPP_TEMPLATE_ACTIVATION`, `WHATSAPP_TEMPLATE_RECOVERY`,
  `WHATSAPP_TEMPLATE_LANGUAGE` : modèles approuvés et langue configurée.
  Contrat du modèle : bouton URL index 0, URL du domaine applicatif autorisé
  `/auth/parent-phone?token={{1}}`, aucune variable de corps ; le suffixe est
  le jeton lié à sa finalité. Le modèle réel doit être homologué avant activation.
- `WHATSAPP_META_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` : authentification
  du webhook `/api/webhooks/whatsapp` (POST signé HMAC-SHA256, GET vérification).
- `WHATSAPP_WORKER_SECRET` : optionnel pour déclenchement externe alternatif,
  au moins 32 caractères. POST `/api/internal/whatsapp/drain`, bearer dédié.

Démarrer le scheduler explicitement avec une configuration incomplète échoue
avant création du timer. Appeler le worker alors que le fournisseur est absent
met les intentions en réessai avec `WHATSAPP_SERVICE_UNAVAILABLE`, jamais en
succès fictif. Les erreurs retournées/loguées n'incluent ni destinataire, ni
jeton, ni payload fournisseur.

## Sémantique et reprise

- `PENDING` / `RETRY_SCHEDULED` : en attente / réessai programmé.
- `SERVICE_UNAVAILABLE` : configuration du fournisseur indisponible.
- `ACCEPTED` : identifiant `wamid` accepté par Meta ; **pas une livraison**.
- `SENT`, `DELIVERED`, `READ` : preuves webhook signées, monotonie et déduplication.
- `AMBIGUOUS` : résultat réseau inconnu ou worker interrompu ; pas de renvoi
  automatique. Un callback peut encore réconcilier cet état.
- `FAILED`, `CANCELLED` : échec définitif / challenge devenu invalide.

L'activation du compte est exclusivement un fait d'identité, indépendant de
ces états. `getLatestParentWhatsAppInvitationStatus` expose uniquement l'état
et les dates de la **dernière invitation**, après contrôle d'accès du caller.

Les 429 explicites et indisponibilités sont rejoués au plus cinq tentatives ;
les erreurs réseau/5xx sont ambiguës car Meta ne documente pas ici une garantie
exactly-once. Une relance métier doit émettre un nouveau challenge et révoquer
l'ancien, pas remettre arbitrairement un job ambigu à PENDING. Chaque tentative
revérifie le validateur canonique de challenge et le snapshot de destination.
Les callbacks ne peuvent ni vérifier un téléphone ni activer un compte.

## Vérification

Les tests unitaires utilisent un transport et des bases simulés. Aucun appel Meta,
credential réel ou mutation de production n'est nécessaire :
`npm test -- --runInBand __tests__/lib/whatsapp`.
La recette fournisseur réelle reste distincte de ces tests locaux.

Sources primaires :
- [Meta — message template](https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text)
- [Meta — validation de signature](https://github.com/fbsamples/whatsapp-api-examples/blob/main/signature-validation-with-webhooks-payloads/app.py)


## Recette réelle avant ouverture

Les tests PostgreSQL supplémentaires utilisent des bases jetables et des données
synthétiques ; ils ne prouvent pas une livraison Meta.

1. Identifier le fichier de configuration actif et un numéro de test contrôlé,
   sans publier les secrets. Vérifier le modèle approuvé et son URL vers une
   instance de recette accessible, équipée des migrations et du code courant.
2. Créer depuis l’espace assistante un foyer de test avec deux enfants distincts.
   Rejouer la même requête idempotente : un foyer et une invitation seulement.
3. Déclencher le transport configuré puis constater séparément ACCEPTED et
   DELIVERED par webhook signé. Ne pas assimiler un identifiant wamid à une livraison.
4. Ouvrir le lien reçu, définir l’accès, se connecter avec le téléphone et confirmer
   le dossier des deux enfants. Vérifier leur visibilité dans le foyer et l’absence
   de rattachement à un homonyme. Le rejeu du lien doit échouer.
5. Tester la récupération, l’expiration et la réémission. Un ancien lien révoqué ne
   doit plus permettre d’accès ; aucune preuve de livraison ne valide l’identité.
6. Consigner uniquement les résultats et identifiants techniques nécessaires,
   sans numéro, jeton, mot de passe ni contenu privé. Conserver la fermeture des
   envois généraux jusqu’à validation de cette recette.
