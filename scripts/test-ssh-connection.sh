#!/bin/bash

# 🔐 TEST DE CONNEXION SSH AU VPS
# Vérifie la connexion avant le déploiement

set -e

# Configuration VPS
VPS_USER="root"
VPS_HOST="46.202.171.14"
VPS_PATH="/home/nexusadmin/nexus-project"

echo "🔐 TEST DE CONNEXION SSH - NEXUS RÉUSSITE"
echo "========================================"
echo ""
echo "🎯 Serveur: $VPS_USER@$VPS_HOST"
echo "📁 Dossier: $VPS_PATH"
echo ""

# Test 1: Connexion SSH simple
echo "🔍 Test 1: Connexion SSH..."
if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "echo 'Connexion SSH réussie !'" 2>/dev/null; then
    echo "✅ Connexion SSH: OK"
else
    echo "❌ Connexion SSH: ÉCHEC"
    echo ""
    echo "🔧 SOLUTIONS POSSIBLES:"
    echo "1. Vérifier que vous avez une clé SSH configurée:"
    echo "   ssh-keygen -t rsa -b 4096 -C 'votre-email@domain.com'"
    echo "   ssh-copy-id root@46.202.171.14"
    echo ""
    echo "2. Ou utiliser l'authentification par mot de passe:"
    echo "   ssh -o PasswordAuthentication=yes root@46.202.171.14"
    echo ""
    echo "3. Tester manuellement:"
    echo "   ssh root@46.202.171.14"
    echo ""
    exit 1
fi

# Test 2: Vérification du dossier projet
echo "🔍 Test 2: Vérification du dossier projet..."
if ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "test -d $VPS_PATH" 2>/dev/null; then
    echo "✅ Dossier projet: OK ($VPS_PATH existe)"
else
    echo "❌ Dossier projet: INTROUVABLE"
    echo "🔧 Création du dossier..."
    ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "mkdir -p $VPS_PATH && echo 'Dossier créé'"
fi

# Test 3: Vérification Git
echo "🔍 Test 3: Vérification Git dans le projet..."
if ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "cd $VPS_PATH && git status" 2>/dev/null; then
    echo "✅ Dépôt Git: OK"
    
    # Afficher la branche actuelle
    CURRENT_BRANCH=$(ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "cd $VPS_PATH && git branch --show-current" 2>/dev/null)
    echo "📋 Branche actuelle: $CURRENT_BRANCH"
    
    # Vérifier s'il y a des modifications non commitées
    if ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "cd $VPS_PATH && git diff --quiet" 2>/dev/null; then
        echo "✅ Aucune modification locale non commitée"
    else
        echo "⚠️  Il y a des modifications locales non commitées"
    fi
else
    echo "❌ Dépôt Git: INTROUVABLE"
    echo "🔧 SOLUTION: Cloner le projet sur le VPS:"
    echo "   git clone https://github.com/cyranoaladin/nexus-project_v0.git $VPS_PATH"
fi

# Test 4: Vérification Node.js et PM2
echo "🔍 Test 4: Vérification Node.js et PM2..."
NODE_VERSION=$(ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "node --version" 2>/dev/null || echo "NON_INSTALLÉ")
PM2_STATUS=$(ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "pm2 --version" 2>/dev/null || echo "NON_INSTALLÉ")

if [[ "$NODE_VERSION" != "NON_INSTALLÉ" ]]; then
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js: NON INSTALLÉ"
fi

if [[ "$PM2_STATUS" != "NON_INSTALLÉ" ]]; then
    echo "✅ PM2: $PM2_STATUS"
    
    # Vérifier le statut de l'application
    echo "📊 Statut PM2 actuel:"
    ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST "pm2 status" 2>/dev/null || echo "   Aucune application PM2 en cours"
else
    echo "❌ PM2: NON INSTALLÉ"
fi

echo ""
echo "🎯 RÉSUMÉ DU TEST:"
echo "=================="
echo "✅ Connexion SSH: Fonctionnelle"
echo "📁 Dossier: $VPS_PATH"
echo "🔧 Node.js: $NODE_VERSION"
echo "⚙️  PM2: $PM2_STATUS"
echo ""

# Test final: Simulation du déploiement
echo "🧪 Test final: Simulation des commandes de déploiement..."
ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST << 'EOF'
    cd /home/nexusadmin/nexus-project
    echo "📍 Répertoire actuel: $(pwd)"
    echo "📋 Contenu du dossier:"
    ls -la | head -10
    echo "🔗 Remote Git:"
    git remote -v 2>/dev/null || echo "   Git non configuré"
EOF

echo ""
echo "🚀 PRÊT POUR LE DÉPLOIEMENT !"
echo "Vous pouvez maintenant exécuter:"
echo "   ./scripts/deploy-git-pull.sh"