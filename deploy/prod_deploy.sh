#!/usr/bin/env bash
set -euo pipefail

# prod_deploy.sh - Déploiement sécurisé par tag SemVer
# Prérequis sur le runner local (ou CI): accès au registry
# Côté VPS: dossier de travail avec docker-compose.yml + override.yml et .env.production

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 vX.Y.Z" >&2
  exit 1
fi

VERSION="$1"

# Paramètres (adapter au besoin)
: "${REGISTRY:?REGISTRY must be set, e.g., ghcr.io/org}"
IMAGE_PREFIX="nexus"

# Construire et pousser les images (si exécuté localement, sinon CI s’en charge)
docker buildx build --platform linux/amd64 -t "$REGISTRY/$IMAGE_PREFIX-app:$VERSION" -t "$REGISTRY/$IMAGE_PREFIX-app:latest" . --push

docker buildx build --platform linux/amd64 -t "$REGISTRY/$IMAGE_PREFIX-rag:$VERSION" -t "$REGISTRY/$IMAGE_PREFIX-rag:latest" ./services/rag_service --push

docker buildx build --platform linux/amd64 -t "$REGISTRY/$IMAGE_PREFIX-llm:$VERSION" -t "$REGISTRY/$IMAGE_PREFIX-llm:latest" ./services/llm_service --push

docker buildx build --platform linux/amd64 -t "$REGISTRY/$IMAGE_PREFIX-pdf:$VERSION" -t "$REGISTRY/$IMAGE_PREFIX-pdf:latest" ./services/pdf_generator_service --push

# Déploiement sur VPS (exemple via SSH; configurez SSH_TARGET et WORKDIR)
: "${SSH_TARGET:?e.g., user@host}"
: "${WORKDIR:?absolute path on VPS}"

ssh "$SSH_TARGET" bash -s <<EOF
set -euo pipefail
cd "$WORKDIR"
export REGISTRY="$REGISTRY"
export IMAGE_PREFIX="$IMAGE_PREFIX"
export IMAGE_TAG="$VERSION"
# Assure la présence du fichier .env.production (non versionné)
[ -f .env.production ] || (echo ".env.production manquant" && exit 1)

docker compose pull
docker compose up -d

# Healthchecks simples
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:8001/health
curl -fsS http://localhost:8002/health
curl -fsS http://localhost:8003/health
EOF

echo "Déploiement $VERSION terminé avec succès."

