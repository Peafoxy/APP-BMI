#!/usr/bin/env bash
# ============================================================
# deployer_2_98_25.sh — Déploie la v2.98.25 sur Vercel
#
# Principe : Vercel déploie automatiquement chaque push sur la
# branche main. Ce script copie les fichiers de l'archive
# extraite dans ton dépôt git, te montre le diff, puis commite
# et pousse — après ta confirmation.
#
# Utilisation (dans Git Bash, depuis le dossier extrait
# bmi-gestion-offline de l'archive 2.98.25) :
#   ./deployer_2_98_25.sh /chemin/vers/ton/depot-git
# ============================================================
set -euo pipefail

VERSION="2.98.25"
MESSAGE="v${VERSION} : refactorisation — lib (constants, export, sauvegarde) + components (SelecteurBoutique, SelecteurArticle, Carte, RechercheGlobale)"

REPO="${1:?Utilisation : ./deployer_2_98_25.sh /chemin/vers/ton/depot-git}"
ICI="$(cd "$(dirname "$0")" && pwd)"

# --- 0) Garde-fous ---------------------------------------------------
[ -d "$REPO/.git" ] || { echo "❌ $REPO n'est pas un dépôt git."; exit 1; }
grep -q "\"${VERSION}\"" "$ICI/src/lib/constants.js" \
  || { echo "❌ L'archive ici n'est pas la ${VERSION} (vérifie src/lib/constants.js)."; exit 1; }

cd "$REPO"
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠  Ton dépôt a des modifications non commitées :"
  git status --short
  echo "   Commite-les ou mets-les de côté (git stash) avant de déployer."
  exit 1
fi
git checkout main
git pull origin main

# --- 1) Copier la nouvelle version ----------------------------------
# src/ est remplacé intégralement : cela propage aussi les fichiers
# SUPPRIMÉS par la refactorisation (ex. components/Selecteurs.jsx,
# scindé en SelecteurBoutique + SelecteurArticle dans cette version).
rm -rf "$REPO/src"
cp -r "$ICI/src" "$REPO/src"

# Fichiers de racine et dossiers annexes (sans toucher .env ni .git)
for f in index.html package.json package-lock.json vite.config.js vercel.json README.md .env.example; do
  [ -f "$ICI/$f" ] && cp "$ICI/$f" "$REPO/$f"
done
for d in public api electron supabase; do
  [ -d "$ICI/$d" ] && { rm -rf "$REPO/$d"; cp -r "$ICI/$d" "$REPO/$d"; }
done

# --- 2) Contrôle avant envoi ----------------------------------------
echo ""
echo "===== Changements qui partiront en production ====="
git add -A
git --no-pager diff --cached --stat
echo "==================================================="
read -r -p "Commiter et pousser vers main (déploiement Vercel) ? (o/N) " REP
if [ "$REP" != "o" ] && [ "$REP" != "O" ]; then
  git reset >/dev/null
  echo "Abandonné — rien n'a été commité. (Les fichiers copiés restent dans le dépôt ; « git checkout -- . && git clean -fd » pour tout annuler.)"
  exit 0
fi

# --- 3) Commit + push → Vercel déploie main -------------------------
git commit -m "$MESSAGE"
git push origin main
echo ""
echo "✅ Poussé. Vercel construit et déploie la ${VERSION} — suis l'avancement sur le tableau de bord Vercel."
