# ═══════════════════════════════════════════════════════════════════════════════
# NPC Worker - Docker Image
# Asynchronous AI processing service for Nexus Pedagogy Cockpit
# ═══════════════════════════════════════════════════════════════════════════════

FROM node:20-alpine

# Install system dependencies for PDF processing
RUN apk add --no-cache \
    poppler-utils \
    poppler-data \
    libwebp-tools \
    ca-certificates

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (tsx is already in dependencies, not devDependencies)
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy worker source
COPY services/npc-worker ./services/npc-worker/
COPY lib ./lib/
COPY types ./types/
COPY tsconfig.json ./
COPY auth.ts ./
COPY auth.config.ts ./

# Match the application runtime identity so both services trust the same
# owner-only persistent storage tree without granting group/world write access.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs \
    && test -x ./node_modules/.bin/tsx

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Run worker (use tsx to execute TypeScript)
USER nextjs
CMD ["./node_modules/.bin/tsx", "services/npc-worker/index.ts"]
