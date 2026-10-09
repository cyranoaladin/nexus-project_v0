# Rapport intermédiaire de récupération

1. Clone neuf : `/home/alaeddine/Bureau/nexus-aria-go-live-recovery-20261003`.
2. Origin : `https://github.com/cyranoaladin/nexus-project_v0.git`, clone GitHub direct.
3. Base distante revalidée : `5ffd4dd8e1fb91b0eea42398670a260402660699`, inchangée.
4. Branche neuve : `codex/aria-go-live-recovery-20261003`.
5. Écrivain : session racine ; sous-agents lecture seule ; contrôle `/proc/*/cwd` avant les lots. Aucun autre écrivain observé dans le clone.
6. Les 43 sources historiques sont gelées. Fichiers/index/références inchangés ; exception possible d'objet Git write-tree consignée dans README.
7. Empreintes avant/après : principal non indexé `ce8840a8af5556f9cd56f3bf39c42fc1cd0fae37e3ab69b716226004cfa1c4fb`, principal indexé `172dabac735d440d604db36c00dbfdadc5010d9f5b46d0d114f262adda2d419b`, candidate indexé `b8bbd0906038139a1bebabcfb48c027a99cee6d68ff86f496ac0a668d5f043d5`. Les 7 419 fichiers/liens hashés sont inchangés ; les autres entrées sont suppressions/manifests sans hash de contenu.
8. Preuves privées : `/home/alaeddine/Bureau/Nexus_Recovery_Evidence_20261003_184727`, permissions privées, pas de copie brute suspecte ni de gros binaire.
9. Principal : 141 statuts, 273 chemins développés, chaque chemin classé dans provenance.json.
10. Candidate : 1 897 entrées indexées classées ; anciennes suppressions et code historique rejetés, aucun import d'index.
11. 85 chevauchements suivis, 61 divergences : tableau divergences.md, conservation du main protégé ; aucun « dernier fichier gagnant ».
12. Prisma/main conservé, aucune migration de récupération ; pricing/main commercial conservé ; Next/main préserve PDF.js et sécurité ; routes/tests équivalents ou historiques non réappliqués.
13. Python : prototype sans dépendance Core actuelle démontrée, environnements/backup/documents laissés gelés, manifeste exhaustif privé.
14. Fichiers produit récupérés par copie : aucun. Défauts actuels réimplémentés dans bootstrap et planning, avec tests.
15. Tous les changements historiques non importés sont classés individuellement/groupés, avec hash et justification ; PDF/preuves/smoke anciens ne deviennent pas une attestation actuelle.
16. Commits produit : 852884586, 4c9599cc3, 336f29e61, 83761b3c7. Correspondance invariant/test dans README.
17. Statiques/build de base verts, 14 225 unitaires de base, 631 Core-v2 et 3 ClamAV séparés, 341 Core-v1 réels, 26 planning corrigés ; qualification SHA final et navigateurs encore en cours.
18. Gates externes non prouvées : TLS historique révoqué/rotation, runbook privé, sauvegarde restaurée récente, rétention, revue humaine dernier push. Fonctionnalités complètes non encore qualifiées : voir capabilities.md.

Ce rapport autorise la poursuite du mandat ; il ne déclare ni production-ready ni déployé.
