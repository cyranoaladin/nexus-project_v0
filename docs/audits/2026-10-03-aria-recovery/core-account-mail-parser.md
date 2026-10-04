# Lecture des liens Core versionnés dans les E2E

La campagne navigateur de l'image 15af0de7 a terminé avec 581 réussites,
11 échecs et quatre tests non exécutés. Trois échecs supplémentaires par
rapport à l'image précédente concernent l'activation Core : le lecteur
Mailpit utilisait une regex de jetons non versionnés et ne reconnaissait
pas les liens HMAC URL-encodés. Il ne s'agit pas d'un échec SMTP démontré.

Le helper lit une vraie URL, exige le chemin exact et purpose=core-v2,
refuse les paramètres dupliqués et contrôle le format/version ainsi que
l'encodage base64url canonique. Il traite aussi les ampersands HTML.
Aucun raw token ni destinataire n'est repris dans l'erreur de timeout.

Quatre tests échouaient avec le lecteur précédent, puis passent avec le
nouveau helper. La suite bootstrap voisine passe aussi : 20 tests au total.
Les assertions sont booléennes pour préserver la confidentialité des
vérificateurs lors d'un échec. La campagne navigateur sur le SHA contenant
ce correctif reste obligatoire avant qualification et publication.
