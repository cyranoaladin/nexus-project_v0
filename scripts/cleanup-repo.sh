#!/usr/bin/env bash
# =============================================================================
# cleanup-repo.sh — Nettoyage hygiène repo Nexus Réussite
# Audit 2026-04-19 — AXE 1
#
# Usage :
#   bash scripts/cleanup-repo.sh          # dry-run (affiche les actions)
#   bash scripts/cleanup-repo.sh --apply  # exécution réelle
#
# PRÉREQUIS :
#   - git-filter-repo  : pip install git-filter-repo
#   - Backup du repo avant --apply
#   - Tous les collaborateurs doivent re-cloner après le rewrite
# =============================================================================

set -euo pipefail

DRY_RUN=true
if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
dry()   { echo -e "${YELLOW}[DRY]${NC}   $*"; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo ""
echo "============================================================"
echo "  Nexus Réussite — Cleanup Repo (AXE 1 — 2026-04-19)"
if $DRY_RUN; then
  echo "  MODE : DRY-RUN (aucune modification)"
else
  echo "  MODE : APPLY (modifications réelles)"
fi
echo "============================================================"
echo ""

# ─── ÉTAPE 1 : Vérifier la présence de git-filter-repo ───────────────────────
info "Étape 1 : Vérification des prérequis"
if ! command -v git-filter-repo &>/dev/null; then
  error "git-filter-repo non installé. Installez avec : pip install git-filter-repo"
  error "Doc : https://github.com/newren/git-filter-repo"
  if $DRY_RUN; then
    warn "Mode dry-run : on continue quand même pour simuler les étapes"
  else
    exit 1
  fi
else
  ok "git-filter-repo trouvé : $(command -v git-filter-repo)"
fi

# ─── ÉTAPE 2 : Fichiers à supprimer de l'historique git ─────────────────────
info ""
info "Étape 2 : Suppression de l'historique git pour les fichiers sensibles"
echo ""

SENSITIVE_FILES=(
  "nginx/ssl/privkey.pem"
  "nginx/ssl/fullchain.pem"
  "parent.json"
  "student.json"
  "get-users-temp.mjs"
)

for f in "${SENSITIVE_FILES[@]}"; do
  count=$(git log --all --full-history --oneline -- "$f" 2>/dev/null | wc -l)
  if [[ "$count" -gt 0 ]]; then
    warn "SENSIBLE : $f — trouvé dans $count commit(s)"
    if $DRY_RUN; then
      dry "  → Commande : git filter-repo --path '$f' --invert-paths --force"
    else
      info "  → Suppression de l'historique pour $f ..."
      git filter-repo --path "$f" --invert-paths --force
      ok "  → $f supprimé de l'historique"
    fi
  else
    ok "PROPRE  : $f — absent de l'historique git"
  fi
done

# ─── ÉTAPE 3 : Untrack des fichiers actuellement suivis ─────────────────────
info ""
info "Étape 3 : Retrait du tracking des fichiers actuellement suivis"
echo ""

TRACKED_TO_REMOVE=(
  "nginx/ssl/privkey.pem"
  "nginx/ssl/fullchain.pem"
  "arborescence.txt"
  "arborescence_complete.txt"
  "prod-tree-2026-04-19.txt"
)

for f in "${TRACKED_TO_REMOVE[@]}"; do
  if git ls-files --error-unmatch "$f" &>/dev/null 2>&1; then
    warn "TRACKÉ  : $f"
    if $DRY_RUN; then
      dry "  → Commande : git rm --cached '$f'"
    else
      git rm --cached "$f"
      ok "  → $f retiré du suivi git (fichier local conservé)"
    fi
  else
    ok "NON TRACKÉ : $f"
  fi
done

# ─── ÉTAPE 4 : Nettoyage de storage/documents/ (PDFs e2e) ───────────────────
info ""
info "Étape 4 : Nettoyage de storage/documents/ (PDFs e2e et artefacts)"
echo ""

E2E_PDF_COUNT=$(find storage/documents/ -name "e2e-*.pdf" 2>/dev/null | wc -l)
if [[ "$E2E_PDF_COUNT" -gt 0 ]]; then
  warn "PDFs e2e trouvés : $E2E_PDF_COUNT fichiers dans storage/documents/"
  find storage/documents/ -name "e2e-*.pdf" 2>/dev/null | while read -r f; do
    dry "  → $f"
  done
  if $DRY_RUN; then
    dry "  → Commande : find storage/documents/ -name 'e2e-*.pdf' -delete"
  else
    find storage/documents/ -name "e2e-*.pdf" -delete
    ok "  → $E2E_PDF_COUNT PDFs e2e supprimés"
  fi
else
  ok "Pas de PDFs e2e dans storage/documents/"
fi

# ─── ÉTAPE 5 : Supprimer le PDF dupliqué ────────────────────────────────────
info ""
info "Étape 5 : Vérification du doublon PDF maths-1ere"
echo ""

PDF_1="app/programme/maths-1ere/programme_eds_maths_premiere.pdf"
PDF_2="programmes/programme_eds_maths_premiere.pdf"

if [[ -f "$PDF_1" && -f "$PDF_2" ]]; then
  MD5_1=$(md5sum "$PDF_1" | awk '{print $1}')
  MD5_2=$(md5sum "$PDF_2" | awk '{print $1}')
  if [[ "$MD5_1" == "$MD5_2" ]]; then
    warn "PDF DUPLIQUÉ identique (MD5: $MD5_1)"
    warn "  Source canonique : $PDF_2"
    warn "  Doublon          : $PDF_1"
    if $DRY_RUN; then
      dry "  → Commande : rm '$PDF_1' && git rm --cached '$PDF_1'"
    else
      rm "$PDF_1"
      git rm --cached "$PDF_1" 2>/dev/null || true
      ok "  → Doublon supprimé. Source conservée : $PDF_2"
    fi
  else
    info "  Les deux PDFs ont des MD5 différents — à vérifier manuellement"
  fi
else
  ok "Pas de doublon PDF détecté"
fi

# ─── ÉTAPE 6 : Déplacer les cahiers des charges hors des routes Next.js ──────
info ""
info "Étape 6 : Fichiers spec/cahiers des charges dans les routes Next.js"
echo ""

CDC_FILES=(
  "app/programme/maths-1ere/cahier_charges_maths_1ere_v2.md"
  "app/programme/maths-1ere/cahier_charges_page_maths_premiere.md"
  "app/bilan-pallier2-maths/cahier_charges_questionnaire_stage.md"
  "app/bilan-pallier2-maths/cahier_charges_questionnaire_stage_v2.md"
)

for f in "${CDC_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    DEST="docs/archive/$(basename "$f")"
    warn "SPEC DANS ROUTE : $f"
    if $DRY_RUN; then
      dry "  → Commande : mkdir -p docs/archive && git mv '$f' '$DEST'"
    else
      mkdir -p docs/archive
      git mv "$f" "$DEST"
      ok "  → Déplacé vers $DEST"
    fi
  fi
done

# ─── ÉTAPE 7 : Mise à jour .gitignore ────────────────────────────────────────
info ""
info "Étape 7 : Vérification .gitignore"
echo ""

MISSING_RULES=(
  "nginx/ssl/"
  "arborescence*.txt"
)

for rule in "${MISSING_RULES[@]}"; do
  if grep -qF "$rule" .gitignore 2>/dev/null; then
    ok "Règle présente : $rule"
  else
    warn "RÈGLE MANQUANTE : $rule"
    if $DRY_RUN; then
      dry "  → Ajouter '$rule' au .gitignore"
    else
      echo "" >> .gitignore
      echo "# Certificats SSL (ne jamais committer)" >> .gitignore
      echo "$rule" >> .gitignore
      ok "  → Règle ajoutée : $rule"
    fi
  fi
done

# ─── ÉTAPE 8 : Vérification pre-commit hook ───────────────────────────────────
info ""
info "Étape 8 : Pre-commit hook"
echo ""

HOOK_PATH=".git/hooks/pre-commit"
if [[ -f "$HOOK_PATH" && -x "$HOOK_PATH" ]]; then
  ok "Pre-commit hook actif : $HOOK_PATH"
else
  warn "AUCUN pre-commit hook actif"
  if $DRY_RUN; then
    dry "  → Installer scripts/pre-commit-hook.sh dans $HOOK_PATH"
  else
    info "  → Copie de scripts/pre-commit-hook.sh → $HOOK_PATH"
    if [[ -f "scripts/pre-commit-hook.sh" ]]; then
      cp scripts/pre-commit-hook.sh "$HOOK_PATH"
      chmod +x "$HOOK_PATH"
      ok "  → Pre-commit hook installé"
    else
      error "  scripts/pre-commit-hook.sh introuvable — à créer manuellement"
    fi
  fi
fi

# ─── ÉTAPE 9 : Force-push après rewrite (si --apply) ─────────────────────────
if ! $DRY_RUN; then
  info ""
  info "Étape 9 : Force-push requis après réécriture de l'historique"
  warn "ATTENTION : Tous les collaborateurs doivent re-cloner après ces opérations."
  warn "Commande à exécuter manuellement :"
  warn "  git push origin --force --all"
  warn "  git push origin --force --tags"
fi

# ─── RÉSUMÉ ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
if $DRY_RUN; then
  echo "  DRY-RUN terminé. Relancer avec --apply pour appliquer."
else
  echo "  APPLY terminé."
  echo "  Actions post-script requises :"
  echo "  1. git push origin --force --all"
  echo "  2. Rotation des credentials (voir 01_FINDINGS_P0.md)"
  echo "  3. Régénérer le certificat SSL"
fi
echo "============================================================"
echo ""
