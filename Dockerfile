# Fichier: Dockerfile
# Version: 2.2 (Production avec Prisma, builds reproductibles)

# === ÉTAPE 1: Image de Base ===
# On part d'une image Node.js 22, basée sur Alpine Linux (légère et sécurisée).
# On la nomme "base" pour pouvoir s'y référer plus tard.
FROM node:22-alpine AS base
# Dépendances système minimales (Prisma/OpenSSL)
RUN apk add --no-cache openssl

# === ÉTAPE 2: Installation des Dépendances (npm ci) ===
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# === ÉTAPE 3: Construction de l'Application (Build) ===
FROM base AS builder
WORKDIR /app
# Copie des dépendances installées
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
# Génération du client Prisma avant build
COPY prisma ./prisma/
RUN npx prisma generate
# Copie du code et build Next.js
COPY . .
RUN npm run build

# === ÉTAPE 3bis: Image utilitaire pour DB setup (optionnelle) ===
FROM base AS dbsetup
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY prisma ./prisma

# === ÉTAPE 4: Image Finale de Production ===
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Sécurité: utilisateur non-root
RUN addgroup -S nodejs || true && adduser -S node -G nodejs || true

# Réutiliser node_modules puis supprimer les devDeps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm prune --omit=dev || true

# Artefacts de build Next.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma client et schéma
COPY --from=builder /app/node_modules/.prisma ./.prisma
COPY --from=builder /app/prisma ./prisma

# Droits à l'utilisateur non-root
RUN chown -R node:nodejs /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
