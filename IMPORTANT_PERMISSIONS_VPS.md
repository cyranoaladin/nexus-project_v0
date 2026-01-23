# Permissions VPS — Note Importante

**Dernière mise à jour :** 21 janvier 2026

Ce document est un **template**. Adaptez les chemins et utilisateurs à votre serveur.

## Exemple (Nginx + dossier app)
```bash
sudo chmod 755 /home/<user>
sudo chmod -R 755 /home/<user>/<project>
```

## Pourquoi
Si Nginx (ex: `www-data`) ne peut pas lire les fichiers statiques, vous obtiendrez des **403**.

