# Reprise du probe d’extraction PDF

Sur l’image immuable 6a9b635f9, le worker activé a conservé 229 drains sans claim : PDF_TEXT_EXTRACTION_ENGINE_UNAVAILABLE. Un probe direct de la même image réussit en 195 ms, sortie protocole exacte et stderr vide. Les dépendances existent. La première erreur interne reste non déterminable à partir de la taxonomie historique : aucun timeout spécifique n’est affirmé.

Le défaut de reprise est démontré : le cache négatif persistait jusqu’au remplacement du processus. Un test avec un child synthétique qui échoue une fois puis devient disponible et une horloge injectée reproduit ce blocage. Il échoue avant correction.

Les refus sont désormais conservés cinq secondes après fin du probe puis réévalués ; une horloge monotone mesure ce cooldown. Les appels concurrents partagent un seul child. Le succès reste caché pour la racine immuable. Les timeouts et la garde avant claim sont inchangés : une indisponibilité persistante refuse toujours le traitement. Aucun sleep ou résultat artificiel n’est ajouté au parcours.

La campagne navigateur doit encore être renouvelée depuis le SHA corrigé. Le probe direct disponible ne prouve pas à lui seul l’extraction d’un document ni le parcours bilan.
