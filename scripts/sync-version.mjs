// Aligne la version de package.json sur VERSION (src/lib/constants.js).
// Lancé automatiquement avant "npm run dist" (hook predist) pour que
// l'installeur Windows porte TOUJOURS le vrai numéro de version.
import { readFileSync, writeFileSync } from "fs";
const src = readFileSync(new URL("../src/lib/constants.js", import.meta.url), "utf-8");
const m = src.match(/VERSION\s*=\s*"([^"]+)"/);
if (!m) { console.error("VERSION introuvable dans constants.js"); process.exit(1); }
const cheminPkg = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(cheminPkg, "utf-8"));
if (pkg.version !== m[1]) {
  pkg.version = m[1];
  writeFileSync(cheminPkg, JSON.stringify(pkg, null, 2) + "\n");
  console.log("package.json aligné sur la version", m[1]);
} else {
  console.log("package.json déjà à jour (", m[1], ")");
}
