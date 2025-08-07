#!/bin/bash

# =============================================================================
# SCRIPT DE PRÉPARATION AU DÉPLOIEMENT - NEXUS RÉUSSITE
# =============================================================================
# Ce script prépare tous les fichiers nécessaires pour le déploiement

set -e  # Arrêter le script en cas d'erreur

echo "🚀 Préparation du déploiement Nexus Réussite..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier que nous sommes dans le bon dossier
if [ ! -f "package.json" ] || [ ! -f "next.config.mjs" ]; then
    log_error "Ce script doit être exécuté depuis la racine du projet Nexus"
    exit 1
fi

log_info "Vérification des fichiers d'environnement..."

# Vérifier les fichiers d'environnement
if [ ! -f ".env.production" ]; then
    log_error "Le fichier .env.production est manquant !"
    log_info "Copiez env.production.real vers .env.production avec vos vraies valeurs"
    exit 1
fi

log_success "Fichier .env.production trouvé"

# Vérifier les variables critiques dans .env.production
log_info "Vérification des variables critiques..."

check_env_var() {
    local var_name="$1"
    local file_path="$2"
    
    if grep -q "^${var_name}=" "$file_path" && ! grep -q "^${var_name}=.*CHANGE_THIS" "$file_path"; then
        log_success "$var_name configuré"
    else
        log_warning "$var_name manquant ou non configuré dans $file_path"
        return 1
    fi
}

# Variables critiques à vérifier
critical_vars=(
    "DATABASE_URL"
    "NEXTAUTH_SECRET"
    "OPENAI_API_KEY"
    "SMTP_PASSWORD"
    "NEXT_PUBLIC_WISE_BENEFICIARY_NAME"
)

missing_vars=0
for var in "${critical_vars[@]}"; do
    if ! check_env_var "$var" ".env.production"; then
        ((missing_vars++))
    fi
done

if [ $missing_vars -gt 0 ]; then
    log_error "$missing_vars variable(s) critique(s) manquante(s) ou non configurée(s)"
    log_info "Veuillez modifier .env.production avec vos vraies valeurs de production"
    exit 1
fi

# Vérifier que les dépendances sont installées
log_info "Vérification des dépendances..."
if [ ! -d "node_modules" ]; then
    log_info "Installation des dépendances..."
    npm ci
fi
log_success "Dépendances vérifiées"

# Générer le client Prisma
log_info "Génération du client Prisma..."
npx prisma generate
log_success "Client Prisma généré"

# Construire l'application
log_info "Construction de l'application pour la production..."
npm run build
log_success "Application construite avec succès"

# Vérifier que le build standalone existe
if [ ! -d ".next/standalone" ]; then
    log_error "Le build standalone n'a pas été créé !"
    log_info "Vérifiez la configuration next.config.mjs"
    exit 1
fi

# Vérifier que les assets publics sont copiés
if [ ! -d ".next/standalone/public" ]; then
    log_error "Les assets publics ne sont pas copiés dans le build standalone !"
    log_info "Exécutez: node scripts/copy-public-assets.js"
    exit 1
fi

log_success "Build standalone prêt avec assets publics"

# Créer un fichier de résumé du déploiement
cat > DEPLOYMENT_SUMMARY.md << EOF
# 📋 Résumé du Déploiement - Nexus Réussite

## ✅ Fichiers Préparés
- \`.env.production\` : Configuré avec les vraies valeurs
- \`.next/standalone/\` : Build de production prêt
- \`public/\` : Assets copiés dans le build standalone
- \`prisma/\` : Client généré

## 🚀 Prochaines Étapes
1. Transférer le dossier \`.next/standalone/\` sur votre serveur
2. Configurer PostgreSQL avec les variables de \`.env.production\`
3. Appliquer les migrations : \`npx prisma migrate deploy\`
4. Démarrer l'application : \`node server.js\`

## 🔗 Repository GitHub
- URL: https://github.com/cyranoaladin/nexus-project_v0
- Branch: main

## 📊 Statistiques du Build
- Date de build: $(date)
- Taille du build: $(du -sh .next/standalone | cut -f1)
- Nombre de pages: $(find .next/standalone -name "*.html" | wc -l)

## 🔐 Variables d'Environnement Configurées
$(grep -E "^[A-Z_]+" .env.production | cut -d'=' -f1 | sort)
EOF

log_success "Résumé du déploiement créé : DEPLOYMENT_SUMMARY.md"

echo ""
log_success "🎉 Préparation du déploiement terminée avec succès !"
echo ""
log_info "Prochaines étapes :"
echo "  1. Vérifiez DEPLOYMENT_SUMMARY.md"
echo "  2. Transférez .next/standalone/ sur votre serveur"
echo "  3. Configurez votre base de données PostgreSQL"
echo "  4. Déployez avec Docker ou directement avec Node.js"
echo ""
log_info "Pour déployer avec Docker : docker-compose -f docker-compose.prod.yml up -d"
echo ""