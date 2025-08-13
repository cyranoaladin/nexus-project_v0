#!/bin/bash

# 🚀 SCRIPT DE DÉPLOIEMENT INCRÉMENTAL VPS
# Synchronise uniquement les fichiers modifiés depuis le dernier déploiement

set -e

# Configuration VPS (À ADAPTER SELON VOS PARAMÈTRES)
VPS_USER="nexusadmin"
VPS_HOST="votre-serveur.com"
VPS_PATH="/home/nexusadmin/nexus-project"
LAST_DEPLOY_COMMIT="657987d"  # Commit du dernier déploiement
CURRENT_COMMIT="2db6122"      # Commit actuel à déployer

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 DÉPLOIEMENT INCRÉMENTAL VPS - NEXUS RÉUSSITE${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# 1. Lister les fichiers modifiés
echo -e "${YELLOW}📋 FICHIERS MODIFIÉS DEPUIS LE DERNIER DÉPLOIEMENT:${NC}"
MODIFIED_FILES=$(git diff --name-only $LAST_DEPLOY_COMMIT..$CURRENT_COMMIT)
echo "$MODIFIED_FILES"
echo ""

# 2. Compter les fichiers
FILE_COUNT=$(echo "$MODIFIED_FILES" | wc -l)
echo -e "${BLUE}📊 Nombre de fichiers à synchroniser: $FILE_COUNT${NC}"
echo ""

# 3. Créer un fichier temporaire avec la liste
TEMP_FILE="/tmp/nexus-deploy-files.txt"
echo "$MODIFIED_FILES" > $TEMP_FILE

# 4. Synchronisation via rsync (plus efficace que scp)
echo -e "${YELLOW}🔄 SYNCHRONISATION EN COURS...${NC}"

# Option 1: Rsync avec liste de fichiers (RECOMMANDÉ)
rsync -avz --files-from=$TEMP_FILE ./ $VPS_USER@$VPS_HOST:$VPS_PATH/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ SYNCHRONISATION RÉUSSIE !${NC}"
else
    echo -e "${RED}❌ ERREUR LORS DE LA SYNCHRONISATION${NC}"
    exit 1
fi

# 5. Commandes post-déploiement sur le VPS
echo -e "${YELLOW}🔧 EXÉCUTION DES COMMANDES POST-DÉPLOIEMENT...${NC}"

ssh $VPS_USER@$VPS_HOST << 'EOF'
    cd /home/nexusadmin/nexus-project
    
    # Installation des dépendances si package.json modifié
    if git diff --name-only 657987d..2db6122 | grep -q "package.json"; then
        echo "📦 Installation des nouvelles dépendances..."
        npm install
    fi
    
    # Build de production
    echo "🏗️ Build de production..."
    npm run build
    
    # Redémarrage PM2
    echo "🔄 Redémarrage de l'application..."
    pm2 restart nexus-app || pm2 start ecosystem.config.js
    
    # Vérification du statut
    echo "📊 Statut de l'application:"
    pm2 status
    
    echo "✅ Déploiement terminé avec succès !"
EOF

# 6. Nettoyage
rm $TEMP_FILE

echo ""
echo -e "${GREEN}🎉 DÉPLOIEMENT INCRÉMENTAL TERMINÉ AVEC SUCCÈS !${NC}"
echo -e "${BLUE}📋 RÉSUMÉ:${NC}"
echo -e "   • Fichiers synchronisés: $FILE_COUNT"
echo -e "   • Commit déployé: $CURRENT_COMMIT"
echo -e "   • Application redémarrée: ✅"
echo ""
echo -e "${YELLOW}🔗 Votre application est maintenant à jour sur:${NC}"
echo -e "   https://nexusreussite.academy"
echo ""

# 7. Mettre à jour le marqueur de dernier déploiement
echo "# Dernier déploiement: $(date)" > .last-deploy
echo "LAST_DEPLOY_COMMIT=$CURRENT_COMMIT" >> .last-deploy
echo -e "${BLUE}📝 Marqueur de déploiement mis à jour dans .last-deploy${NC}"