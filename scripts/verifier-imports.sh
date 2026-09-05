#!/usr/bin/env bash
# ============================================================
# AUCUNE VARIABLE NON DÉFINIE — le contrôle que le build ne fait pas.
#
#   npm run verifier-imports
#
# ⚠ Leçon de la 2.101.59 (05/09/2026) : une fonction utilisée dans un écran
# sans avoir été importée. `npm run build` passe (Vite ne vérifie pas les
# noms), et l'écran est BLANC au premier affichage — Timo l'a vu avant nous.
# ESLint, règle « no-undef », attrape ce cas en une seconde : on le passe
# sur toute l'application avant chaque envoi, et rien d'autre (les autres
# règles de style n'ont pas leur place ici).
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."
sortie=$(npx eslint --no-eslintrc \
  --parser-options=ecmaVersion:2023 --parser-options=sourceType:module --parser-options='ecmaFeatures:{jsx:true}' \
  --env browser --env es2023 --env node \
  --rule '{"no-undef":"error"}' \
  "src/**/*.{js,jsx}" "api/**/*.js" "scripts/**/*.mjs" 2>&1)
nb=$(echo "$sortie" | grep -c "no-undef" || true)
if [ "$nb" -eq 0 ]; then
  echo "✅  Aucune variable non définie (src, api, scripts)."
  exit 0
fi
echo "$sortie" | grep -B4 "no-undef"
echo "❌  $nb variable(s) non définie(s) — un écran serait blanc au premier affichage."
exit 1
