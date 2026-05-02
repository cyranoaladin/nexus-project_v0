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

# Install dependencies
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy worker source
COPY services/npc-worker ./services/npc-worker/
COPY lib ./lib/
COPY types ./types/
COPY auth.ts ./
COPY auth.config.ts ./

# Create uploads directory
RUN mkdir -p /var/lib/nexus/uploads/copies

# Set environment
ENV NODE_ENV=production
ENV NPC_UPLOAD_DIR=/var/lib/nexus/uploads/copies

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Run worker
CMD ["node", "services/npc-worker/index.js"]
