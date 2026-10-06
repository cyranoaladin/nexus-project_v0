# Chiffrement des sauvegardes offsite — patch prêt (banc validé 2026-10-06)

Cible : /opt/nexus-ops/publish_backup.py (prod). Patch : offsite-encryption.patch (élaboré sur copie assainie ; les 2 lignes de contexte `<sb-user>` sont à réappliquer sur l'original).

Propriétés prouvées sur banc (faux StorageBox, vraie base, vraie paire GPG) :
- seul l'artefact .gpg (AES256, destinataire = clé publique) atteint l'offsite ; en-tête opaque ;
- le tar.gz en clair est supprimé après chiffrement, succès comme échec ; empreinte invalide = fail-fast AVANT création du tar ;
- le serveur (trousseau = clé publique seule, 0 clé secrète) ne peut pas déchiffrer (gpg exit 2) ;
- restauration offline : clé privée → déchiffrement → tar → pg_restore --exit-on-error OK (comptages vérifiés) ;
- le checksum publié/vérifié porte sur l'artefact CHIFFRÉ ; reprise idempotente (ré-exécution → réutilise le .gpg).

Déploiement (ordre) :
1. PROPRIÉTAIRE, hors serveur : `gpg --quick-gen-key "Nexus Backup <…>" ed25519 cert never` + sous-clé cv25519 encr ; exporter la clé publique ; garder la privée en lieu sûr (gestionnaire de secrets / support de récupération). JAMAIS sur le serveur, dans git, logs ou StorageBox.
2. Serveur : `gpg --import` de la clé publique dans le trousseau root ; vérifier `gpg --list-secret-keys` = vide.
3. Ajouter `SB_ENC_FPR="<empreinte 40 hex>"` dans le fichier CONFIG déjà lu par publish_backup.py.
4. Appliquer le patch ; run d'essai : `run-database-backup.sh critical backup` ; vérifier sur la StorageBox que seuls des .gpg récents existent, et qu'exports/ ne contient aucun .tar.gz en clair.
5. Test de restauration trimestriel : rapatrier un .gpg, déchiffrer hors serveur, pg_restore sur base isolée (procédure du banc).
6. Rotation de clé : générer nouvelle paire (étape 1), importer la nouvelle publique, changer SB_ENC_FPR, conserver l'ancienne privée jusqu'à expiration de la rétention des artefacts chiffrés avec elle.
7. Rollback du changement : retirer SB_ENC_FPR + restaurer le script original (les anciens artefacts .gpg restent restaurables avec la clé privée).
Note : les artefacts déjà présents en clair sur la StorageBox restent en clair — à re-chiffrer ou purger selon la rétention (décision propriétaire).
