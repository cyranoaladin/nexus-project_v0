# Fichier: Dockerfile
# Version: 2.0 (Standardisé sur NPM)

# === ÉTAPE 1: Image de Base ===
# On part d'une image Node.js version 18, basée sur Alpine Linux (légère et sécurisée).
# On la nomme "base\" pour pouvoir s'y référer plus tard.
FROM node:18-alpine AS base

# Installation d'OpenSSL pour Prisma
RUN apk add --no-cache openssl libc6-compat gcompat libstdc++


# === ÉTAPE 2: Installation des Dépendances ===
# On utilise l'image "base" pour cette étape et on la nomme "deps".
FROM base AS deps
WORKDIR /app

# On copie uniquement les fichiers nécessaires pour installer les dépendances.
COPY package.json package-lock.json* ./

# [MODIFIÉ] On utilise 'npm ci\' qui est la commande standard et optimisée pour les déploiements.
# Elle utilise le fichier package-lock.json pour garantir des installations fiables et rapides.
RUN npm ci


# === ÉTAPE 3: Construction de l'Application (Build) ===
# On repart de l'image "base" et on nomme cette étape "builder".
FROM base AS builder
WORKDIR /app

# On copie les dépendances déjà installées depuis l'étape "deps".
COPY --from=deps /app/node_modules ./node_modules
# On copie le package.json (nécessaire pour les scripts)
COPY --from=deps /app/package.json ./package.json

# On copie le schéma Prisma
COPY prisma ./prisma/

# [MODIFIÉ] On exécute le script prisma generate via 'npm'
RUN npx prisma generate

# On copie le reste du code source de l'application
COPY . .

# [MODIFIÉ] On lance le script de build via 'npm'
RUN npm run build


# === ÉTAPE 4: Création de l'Image Finale de Production ===
# On repart d'une image "base" propre pour avoir une image finale légère.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# On copie les artefacts de build depuis l'étape "builder"
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# On expose le port sur lequel le serveur Next.js écoute à l'intérieur du conteneur.
EXPOSE 3000

# La commande qui sera exécutée lorsque le conteneur démarrera.
CMD ["node", "server.js"]
