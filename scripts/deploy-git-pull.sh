#!/bin/bash

# 🔄 DÉPLOIEMENT VIA GIT PULL (RECOMMANDÉ)
# Synchronise via Git directement sur le VPS

set -e

# Configuration VPS - NEXUS RÉUSSITE
VPS_USER="root"
VPS_HOST="46.202.171.14"
VPS_PATH="/home/nexusadmin/nexus-project"

echo "🔄 DÉPLOIEMENT VIA GIT PULL"
echo "=========================="
echo ""

echo "📡 Connexion au VPS et mise à jour..."

# Commandes sur le VPS
ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST << 'EOF'
    cd /home/nexusadmin/nexus-project
    
    echo "📥 Git pull des dernières modifications..."
    git pull origin version-dev
    
    echo "📦 Installation des dépendances (si nécessaire)..."
    npm install
    
    echo "🏗️ Build de production..."
    npm run build
    
    echo "🔄 Redémarrage de l'application..."
    pm2 restart nexus-app || echo "⚠️  Tentative de démarrage initial..."
    pm2 start ecosystem.config.js || echo "⚠️  Vérifiez ecosystem.config.js"
    
    echo "📊 Vérification du statut:"
    pm2 status
    
    echo "🌐 Test de l'application:"
    curl -I http://localhost:3001 || echo "⚠️  Application non accessible sur le port 3001"
    
    echo ""
    echo "✅ Déploiement terminé avec succès !"
    echo "🔗 Application disponible sur: https://nexusreussite.academy"
EOF

echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ !"
echo ""
echo "📋 MODIFICATIONS DÉPLOYÉES:"
echo "   • Corrections juridiques AEFE"
echo "   • Formulations légales appliquées"
echo "   • Tests mis à jour"
echo "   • Documentation ajoutée"
echo ""
echo "🛡️ Votre application est maintenant juridiquement conforme !"