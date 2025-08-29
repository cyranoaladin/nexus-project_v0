# Fichier: Dockerfile
# Version: 2.1 (Finalisé pour la production avec Prisma)

# === ÉTAPE 1: Image de Base ===
# On part d'une image Node.js version 18, basée sur Alpine Linux (légère et sécurisée).
# On la nomme "base" pour pouvoir s'y référer plus tard.
FROM node:22-alpine AS base
# On installe les dépendances système nécessaires pour Prisma
RUN apk add --no-cache openssl


# === ÉTAPE 2: Installation des Dépendances ===
# On utilise l'image "base" pour cette étape et on la nomme "deps".
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Installer toutes les dépendances avec npm ci pour des builds reproductibles
RUN npm ci --no-audit --no-fund --network-timeout=1000000


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
# On lance le build de Next.js.
ENV NEXT_FONT_IGNORE_ERRORS=1
RUN NEXT_FONT_IGNORE_ERRORS=1 npm run build

# Rendre exécutable le script avant de le copier dans l'image finale
RUN chmod +x start-production.sh


# === ÉTAPE 4: Création de l'Image Finale de Production ===
# On repart d'une image "base" propre pour avoir une image finale légère.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Sécurité: utiliser l'utilisateur non-root; créer le groupe si besoin
RUN addgroup -S nodejs || true && adduser -S node -G nodejs || true

# [CORRECTION IMPORTANTE] On réinstalle UNIQUEMENT les dépendances de production
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund --network-timeout=1000000 \
  && npm install prisma tsx --no-save --network-timeout=1000000

# On copie les artefacts de build depuis l'étape "builder".
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# On copie le client Prisma et le schéma.
COPY --from=builder /app/node_modules/.prisma ./.prisma
COPY --from=builder /app/prisma ./prisma

# Droits à l'utilisateur non-root
RUN chown -R node:nodejs /app
USER node

EXPOSE 3000
COPY --from=builder /app/start-production.sh ./start-production.sh
CMD ["./start-production.sh"]
