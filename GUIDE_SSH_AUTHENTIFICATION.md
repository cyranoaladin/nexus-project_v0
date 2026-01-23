# Guide d’Authentification SSH (Template)

**Dernière mise à jour :** 21 janvier 2026

Les scripts fournis (`scripts/test-ssh-connection.sh`, `scripts/deploy-git-pull.sh`) contiennent des **valeurs hard‑codées** (IP, chemin, user). Mettez‑les à jour avant usage.

## Méthode recommandée : clé SSH
```bash
ssh-keygen -t rsa -b 4096 -C "votre-email@domain.com"
ssh-copy-id user@votre-serveur
```

## Test rapide
```bash
ssh user@votre-serveur "echo ok"
```

