# Conflits horaires internes aux séances de stage

2026-10-05, base 7e54e4c382bcc955953a612854b1bf553c97f51b.

Critères : PostgreSQL refuse deux intervalles [début, fin) chevauchants du même CoachProfile, y compris entre stages ou en concurrence ; les bornes adjacentes et coachs distincts restent autorisés ; POST/PATCH renvoient 409 sans détail de base ; un PATCH refusé conserve l’horaire ; une incohérence historique arrête la migration sans réécriture ni perte.

Preuve rouge : 1791160809, deux échecs causaux (overlap accepté et deux gagnants concurrents), neuf autres tests verts. L’essai précédent 1791160774 avait trois erreurs de fixture par pseudonyme dupliqué ; il ne prouve pas le défaut produit. Unicité de fixture corrigée avant le rouge causal.

Migration additive 20261005014000_stage_session_coach_conflicts : CHECK endAt > startAt et exclusion GiST par coachId/tsrange. Aucune donnée ni FK supprimée. Les dates StageSession sont des instants UTC ; cette contrainte ne réinterprète pas les horaires pseudo-locaux de SessionBooking. Un chevauchement historique ou une durée invalide stoppe le déploiement ; aucun backfill permissif ni correction automatique. Compatibilité lecture de l’ancienne application conservée ; ses écritures incompatibles seront refusées, donc gate de qualification des anciens écrivains toujours nécessaire.

Preuve verte 1791160979 : 4 suites réelles / 29 tests métier, puis 1 suite / 2 tests Golden Family. Restauration chiffrée synthétique, contrôle des anciennes lignes, replay Prisma, préflight overlap/intervalle invalide sans mutation, interruption avant COMMIT puis reprise : succès. Instance tmpfs arrêtée, source stable. Cela ne prouve pas une sauvegarde ou une migration de production.

Tests ciblés de classification et accès API : 3 suites / 15 tests verts. Typecheck et lint ciblé verts. Le classificateur ne reconnaît que la contrainte nommée enveloppée par Prisma ; il ne transforme pas une erreur quelconque en conflit. Aucun texte d’exception n’est envoyé au client.

Limites bloquantes restantes : cette contrainte ne couvre ni les séances ordinaires, ni Core-v2, ni salles/capacité/trajets. Elle n’invente aucun site, coach, prix ou règle commerciale. Aucune capability ne devient qualifiée production à ce stade. Rollback applicatif : garder le schéma additif et revenir à la release précédente ; aucune down migration destructive autorisée.
