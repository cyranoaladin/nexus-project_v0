# Invitations parent WhatsApp

## Fonctionnement actuel : envoi assisté

Lorsque `WHATSAPP_SEND_ENABLED` n’est pas `true`, l’assistante utilise son
application WhatsApp Business. Aucune configuration Meta ni clé de chiffrement
d’outbox n’est nécessaire pour ce mode.

1. Créer le foyer et les enfants depuis l’espace assistante.
2. Préparer l’invitation puis choisir « Envoyer l’invitation sur WhatsApp ».
3. Vérifier le destinataire dans WhatsApp et confirmer **Envoyer**. La plateforme
   ne peut pas confirmer l’envoi ou la réception par cette ouverture de lien.
4. Le parent ouvre son lien temporaire, choisit son mot de passe, se connecte
   avec son téléphone et complète le dossier familial.

La fiche parent permet de préparer un nouveau lien. Chaque préparation révoque
les anciens challenges non consommés ; le lien expire après 72 h pour une
activation et 1 h pour une récupération. La création idempotente du foyer ne
stocke aucun lien brut dans sa réponse persistée. Seule la préparation réservée
ADMIN/ASSISTANTE retourne ponctuellement le lien avec les en-têtes anti-cache.

Le lien est visible par le personnel chargé de le transmettre : la confiance
repose sur sa vérification du destinataire. L’activation n’est pas une preuve
télécom indépendante de possession du numéro. Le challenge et les règles
canoniques d’identité restent la source de vérité. Aucun détail enfant, mot de
passe ou lien d’accès ne doit être journalisé ou conservé dans le navigateur.
Les demandes publiques de récupération orientent vers Nexus sur WhatsApp, sans
révéler l’existence d’un compte ni déclencher une invitation automatique.

## Transport automatique optionnel

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
- `WHATSAPP_SEND_ENABLED=true` : autorise le transport Meta ; absent ou false = parcours manuel pour les nouvelles invitations.
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


## Recette du transport automatique avant activation

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


## Recette du parcours manuel

Sur un foyer synthétique, vérifier la création sans secrets Meta, la préparation
du message et son destinataire canonique sans ouvrir de conversation réelle.
Ouvrir localement le lien d’activation, choisir le mot de passe puis vérifier la
connexion, le dossier multi-enfants et le refus du rejeu. Vérifier qu’une
nouvelle préparation invalide l’ancien lien. L’envoi et la réception dans
l’application WhatsApp restent à constater avec un numéro de test contrôlé ;
un clic sur le lien ne doit jamais être enregistré comme une livraison.

---

# Réservations de manuels

Second usage du transport WhatsApp, indépendant des invitations parents.

Chaque réservation déposée sur `/manuels` inscrit une notification dans
`canonical_job_outbox`, **dans la même transaction que la commande** : ou les
deux existent, ou aucun des deux. `kickWhatsAppOutboxDrain()` est appelé après
COMMIT seulement ; un battement périodique reprend ensuite, avec une attente
croissante bornée à une heure et huit tentatives.

Type de tâche : `SEND_WHATSAPP_ORDER`, volontairement **distinct de
`WHATSAPP_SEND`**. L'ouvrier des invitations réclame tous les travaux de ce
dernier type sans filtrer l'agrégat, puis rejette ceux qui ne sont pas des
invitations : y verser des réservations les ferait échouer.

La charge est chiffrée avec le **même secret et le même schéma** que les
invitations (`WHATSAPP_OUTBOX_ENCRYPTION_KEY`, AES-256-GCM, dérivation par
HMAC). Les identifiants Meta sont également partagés : `WHATSAPP_SEND_ENABLED`,
`WHATSAPP_META_PHONE_NUMBER_ID`, `WHATSAPP_META_ACCESS_TOKEN`,
`WHATSAPP_META_API_VERSION`. **Rien à configurer en plus** si les invitations
fonctionnent déjà par ce transport.

**Interrupteur propre aux réservations.** `WHATSAPP_ORDER_SEND_ENABLED`
l'emporte sur `WHATSAPP_SEND_ENABLED` quand il est renseigné, dans un sens
comme dans l'autre ; à défaut, les réservations suivent l'interrupteur maison.
Il existe pour une raison concrète : l'interrupteur maison commande aussi les
invitations parents, qui partent aujourd'hui en **envoi assisté**. L'allumer
pour les commandes basculerait ce geste humain en envoi automatique, ce que
personne n'a demandé. Les identifiants Meta restent exigés dans tous les cas.

Propre aux réservations, facultatif :

- `WHATSAPP_ORDER_SEND_ENABLED` — `true` active les réservations seules,
  `false` les coupe seules, absent : suit `WHATSAPP_SEND_ENABLED` ;

- `WHATSAPP_TEMPLATE_ORDER` — modèle approuvé, défaut `commande_manuels`,
  sept paramètres de corps (référence, client, téléphone, format, panier,
  total, remise) ;
- `WHATSAPP_ORDER_RECIPIENT` — téléphone destinataire, défaut : le numéro
  public de la maison. Meta refuse qu'un numéro s'écrive à lui-même ; si le
  numéro expéditeur est aussi le destinataire, renseigner ici un autre
  téléphone.

Si le transport ou le chiffrement ne sont pas configurés, **rien n'est inscrit
en file** : exiger le secret à l'intérieur de la transaction ferait échouer la
commande. La réservation est alors enregistrée et notifiée par e-mail, et la
réponse de l'API l'annonce (`whatsapp: "disabled"`).
