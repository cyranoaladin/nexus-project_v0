# Fichier: Dockerfile
# Version: 2.1 (Finalisé pour la production avec Prisma)

# === ÉTAPE 1: Image de Base ===
# On part d'une image Node.js version 18, basée sur Alpine Linux (légère et sécurisée).
# On la nomme "base" pour pouvoir s'y référer plus tard.
FROM node:18-alpine AS base
# On installe les dépendances système nécessaires pour Prisma
RUN apk add --no-cache openssl


# === ÉTAPE 2: Installation des Dépendances ===
# On utilise l'image "base" pour cette étape et on la nomme "deps".
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# On installe TOUTES les dépendances, y compris les devDependencies, car nous en avons besoin pour le build.
RUN npm ci


# === ÉTAPE 3: Construction de l'Application (Build) ===
# On repart de l'image "base" et on nomme cette étape "builder".
FROM base AS builder
WORKDIR /app
# On copie les dépendances et le package.json de l'étape précédente.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
# On copie le schéma Prisma pour pouvoir générer le client.
COPY prisma ./prisma/
# On génère le client Prisma.
RUN npx prisma generate
# On copie le reste du code de l'application.
COPY . .
# On fournit un secret factice pour le build (le vrai secret est injecté au runtime via .env)
ARG NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
# On lance le build de Next.js.
RUN npm run build


# === ÉTAPE 4: Création de l'Image Finale de Production ===
# On repart d'une image "base" propre pour avoir une image finale légère.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# [CORRECTION IMPORTANTE] On réinstalle UNIQUEMENT les dépendances de production
# pour ne pas inclure les outils de build (comme le CLI Prisma, TypeScript, etc.) dans l'image finale.
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

# On copie les artefacts de build depuis l'étape "builder".
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# [LA CORRECTION QUE VOUS ATTENDIEZ]
# On copie le client Prisma généré ET le dossier prisma contenant le schéma.
# Ces deux éléments sont nécessaires au runtime pour que Prisma fonctionne.
COPY --from=builder /app/node_modules/.prisma ./.prisma
COPY --from=builder /app/prisma ./prisma

# On copie les scripts pour les tests E2E et maintenance
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib

# On expose le port sur lequel le serveur Next.js écoute à l'intérieur du conteneur.
EXPOSE 3000
# La commande qui sera exécutée lorsque le conteneur démarrera.
CMD ["node", "server.js"]
