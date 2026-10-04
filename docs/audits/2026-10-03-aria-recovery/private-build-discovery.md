# Distinguer sources actives et preuves privées

La suite unitaire sur 6a9b635f9 a révélé que le scanner de surfaces NPC parcourait aussi les copies Git immuables sous .artifacts. La configuration canonique ne violait pas son invariant ; les archives étaient prises pour des sources actives. Un test synthétique de découverte a reproduit le défaut : deux échecs et 22 réussites avant correction, puis 24 réussites après exclusion du seul répertoire privé .artifacts. Les assertions sur tous les Dockerfiles/Compose actifs restent inchangées.

L’inventaire exécuté de Jest Core sélectionnait 219 fichiers, dont 146 copies privées. La racine de découverte est désormais le dossier canonique __tests__/core-v2 ; les mocks privés sont exclus de la carte de modules Core et gouvernance. Ce changement ne désactive aucun fichier canonique, scénario, seuil ou lane CI. Le lancement Core initial est conservé et ne vaut pas qualification canonique ; la campagne doit être renouvelée.
