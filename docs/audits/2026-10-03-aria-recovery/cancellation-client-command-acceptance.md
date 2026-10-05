# Annulation planning : commande conservée pendant un retry

2026-10-05. Base locale `ef30bf152`.

Deux tests ont échoué avant correction : absence d’identifiant de commande sur le retry réseau, et faux succès après échec de lecture du corps. La page conserve maintenant un UUID par réservation dans sa mémoire de composant tant que le résultat est incertain. Elle transmet Idempotency-Key, conserve la commande sur réseau/lecture de réponse/5xx/429, puis libère la commande sur succès ou refus 4xx définitif. Un verrou synchrone et un bouton disabled empêchent la double soumission.

Résultat : 1 suite / 6 tests verts, y compris les trois tests antérieurs de création. Une assertion trop précoce du nouveau test body cherchait le bouton avant la fin du rendu : corrigée par une assertion web-first de disponibilité, sans sleep ni augmentation de timeout. Les deux commandes rejouées restent identiques et le test vérifie le refus de double soumission pendant une réponse tenue par promesse explicite.

Limites : mémoire conservée seulement pendant la vie du composant, pas après fermeture/rechargement. Aucun test navigateur réel de ce client n’est encore rattaché au futur SHA publié ; la CI et qualification UX restent nécessaires. La règle d’annulation et les crédits ne sont pas modifiés.
