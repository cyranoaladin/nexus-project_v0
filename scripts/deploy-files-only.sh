#!/bin/bash

# 🎯 DÉPLOIEMENT RAPIDE - FICHIERS MODIFIÉS UNIQUEMENT
# Version simplifiée pour synchroniser seulement les fichiers juridiques

set -e

# Configuration VPS (À ADAPTER)
VPS_USER="nexusadmin"
VPS_HOST="votre-serveur.com"
VPS_PATH="/home/nexusadmin/nexus-project"

echo "🚀 DÉPLOIEMENT RAPIDE - CORRECTIONS JURIDIQUES"
echo "=============================================="
echo ""

# Liste des fichiers modifiés (corrections juridiques)
FILES=(
    "app/equipe/page.tsx"
    "app/offres/page.tsx"
    "components/sections/hero-section.tsx"
    "components/sections/pillars-section.tsx"
    "components/sections/problem-solution-section.tsx"
    "components/sections/comparison-table-section.tsx"
    "components/ui/diagnostic-form.tsx"
    "components/ui/faq-section.tsx"
    "Profils_intevenants_Nexus.md"
    "RAPPORT_CONFORMITE_JURIDIQUE.md"
    "scripts/fix-legal-terms-tests.js"
)

echo "📋 Fichiers à synchroniser:"
for file in "${FILES[@]}"; do
    echo "   • $file"
done
echo ""

# Synchronisation fichier par fichier
echo "🔄 Synchronisation en cours..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ↗️  Envoi de $file"
        # Créer le répertoire de destination si nécessaire
        ssh $VPS_USER@$VPS_HOST "mkdir -p $VPS_PATH/$(dirname $file)"
        # Copier le fichier
        scp "$file" $VPS_USER@$VPS_HOST:$VPS_PATH/$file
    else
        echo "   ⚠️  Fichier non trouvé: $file"
    fi
done

echo ""
echo "🏗️ Rebuild et redémarrage sur le VPS..."

# Commandes sur le VPS
ssh $VPS_USER@$VPS_HOST << 'EOF'
    cd /home/nexusadmin/nexus-project
    
    echo "🏗️ Build de production..."
    npm run build
    
    echo "🔄 Redémarrage PM2..."
    pm2 startOrRestart ecosystem.config.js --env production --update-env
    pm2 save
    
    echo "📊 Statut:"
    pm2 status
EOF

echo ""
echo "✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"
echo "🔗 Application mise à jour: https://nexusreussite.academy"
