# Guide d’installation (Développement)

**Dernière mise à jour :** 21 janvier 2026

## 1) Prérequis
- Node.js + npm
- (Optionnel) Docker si vous testez un déploiement ou un proxy

## 2) Variables d’environnement
Copiez l’exemple local puis adaptez :
```bash
cp env.local.example .env.local
```

## 3) Base de données (SQLite)
```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed   # optionnel (crée admin + coachs + comptes de test)
```

## 4) Lancer l’app
```bash
npm run dev
```

## 5) Accès rapides
- Home : `http://localhost:3000`
- Bilan gratuit : `http://localhost:3000/bilan-gratuit`
- Connexion : `http://localhost:3000/auth/signin`

## Notes utiles
- En dev, si aucune config SMTP n’est fournie, l’app tente un SMTP local (port 1025).
- Le provider Prisma est **SQLite**. Les fichiers Docker/Postgres sont présents mais non branchés au schéma actuel.

