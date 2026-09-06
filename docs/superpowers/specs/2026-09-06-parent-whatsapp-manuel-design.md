# Invitations parent par WhatsApp Business

## Accord produit

Le 6 septembre 2026, l’utilisateur confirme utiliser uniquement l’application WhatsApp Business et approuve le parcours proposé : création du foyer, message prérempli, envoi confirmé par l’assistante, activation par le parent. Cette décision remplace le prérequis Meta pour ce fonctionnement ; elle ne demande pas de déploiement immédiat.

## Architecture

Le mode manuel est le défaut lorsque WHATSAPP_SEND_ENABLED n’est pas true. Le mode automatique existant reste explicite. Une création manuelle réserve l’identité dans la transaction canonique sans outbox ni secret Meta. Son résultat idempotent contient les identifiants du foyer et le mode, jamais un jeton brut.

Une POST réservée ADMIN/ASSISTANTE prépare ou renouvelle une invitation pour le numéro canonique du parent enregistré. Elle utilise ParentPhoneChallenge, son expiration, sa révocation et ses verrous existants ; aucune table ni migration nouvelle. Le lien ponctuel est retourné avec no-store et no-referrer. L’interface conserve ce lien seulement en mémoire, ouvre wa.me sur un clic explicite et rappelle de confirmer Envoyer dans WhatsApp. Elle ne revendique aucune livraison. Le bouton figure après création et sur la fiche parent. La récupération publique dirige vers le contact WhatsApp sans révéler l’existence du compte ni promettre un envoi automatique.

## Confiance

Le personnel habilité voit le lien qu’il doit transmettre : ce parcours repose donc sur sa vérification du destinataire. L’état canonique VERIFIED issu de la consommation du challenge autorise l’identifiant téléphonique inscrit ; il ne constitue pas une preuve télécom indépendante de possession du numéro. Aucun mot de passe parent n’est choisi par l’assistante. Ne pas journaliser le lien, le mettre dans le résultat d’idempotence ou le stocker côté navigateur. Aucun détail sur les enfants dans le message.

## Vérification

TDD des rôles, origine, rate-limit, numéro serveur, expiration, renouvellement, absence de persistance du jeton et création sans configuration Meta. Tests UI du parcours manuel, du renouvellement et des erreurs ; modes automatique et saisie papier préservés. Contrôles TypeScript, lint et build avant livraison ; recette navigateur sur données synthétiques sans envoi réel.
