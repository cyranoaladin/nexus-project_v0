# Audit de Remédiation Privacy Containerd — Nexus Réussite Production

## Date
2026-08-29T20:10:00Z

## Contexte
Le diagnostic forensic initial a révélé 584 copies potentielles des 4 fichiers sensibles stockées sur l'hôte de production `nexus-prod`.
L'analyse par chemin et layer a identifié :
- 146 snapshots containerd dans `/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/` (146 x 4 = 584 fichiers) ;
- Un volume de 143.1 Go de build cache BuildKit accumulé lors d'anciennes compilations Docker ;
- 8 images locales et 1 conteneur actif de la stack éphémère de pré-rentrée (`nexus-pre-rentree-preview-6fe2e773`) bâtie le 13 juillet 2026 ;
- 1 snapshot orphelin inactif datant du 16 mai 2026.

## Actions Exécutées
1. **Arrêt et suppression de la stack preview obsolète** :
   - `docker rm -f nexus-pre-rentree-preview-app-1 nexus-pre-rentree-preview-migrate-1`
   - `docker rmi -f nexus-pre-rentree-preview:41aabc84e560 nexus-pre-rentree-preview:4b87d7885044 nexus-pre-rentree-preview:6fe2e77302a1 nexus-pre-rentree-preview:f5c618583381 nexus-pre-rentree-preview-migrator:41aabc84e560 nexus-pre-rentree-preview-migrator:4b87d7885044 nexus-pre-rentree-preview-migrator:6fe2e77302a1 nexus-pre-rentree-preview-migrator:f5c618583381`
2. **Purge du cache de construction BuildKit** :
   - `docker builder prune -a -f` (143.1 Go d'espace libéré)
   - `docker image prune -f`
3. **Nettoyage du snapshot orphelin inactif** :
   - Suppression du répertoire inerte non monté `snapshots/12710` (créé le 16 mai 2026).

## Résultats Vérifiés par Scan Forensic
Le script officiel de détection de hash git blob `/root/scan-host.sh` a été exécuté :
1. Sur `/var/lib/containerd` :
   ```text
   SIZE_CANDIDATES=0
   UNREADABLE=0
   FORBIDDEN_MATCHES=0
   ```
2. Sur la racine complète du serveur `/` :
   ```text
   SIZE_CANDIDATES=0
   UNREADABLE=0
   FORBIDDEN_MATCHES=0
   ```

## Verdict
- `CONTAINER_IMAGE_PRIVACY_EXPOSURES = 0`
- `STORE_EXPOSURE = 0`
- `HOST_EXPOSURE = 0`
- Impact production : **Zéro interruption** (le service `nexusreussite.academy` s'exécute nativement via son standalone Node.js sur le port 3001).
