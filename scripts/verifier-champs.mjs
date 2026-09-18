// ============================================================
// scripts/verifier-champs.mjs — LA LARGEUR DES CHAMPS, MESURÉE DANS
// UN VRAI NAVIGATEUR
//
//   npm run verifier-champs
//
// ⚠ POURQUOI CE BANC EXISTE (Timo, 18/09/2026, deux fois de suite :
// « réduire la ligne rechercher un outil, trop long », puis « la ligne de
// recherche est toujours trop longue… rien n'est fait. Ou bien tu as fait
// autre chose que ce que je demande ? »).
//
// La première correction POSAIT la bonne classe (`sm:max-w-xs`) et un
// contrôle statique vérifiait qu'elle était là. Elle était là. Elle ne
// faisait RIEN : `src/index.css` porte, depuis longtemps et pour une bonne
// raison (un champ qui débordait d'une grille), la règle globale
//     input, select, textarea { max-width: 100%; }
// écrite APRÈS `@import "tailwindcss"` — donc plus forte que toute classe
// utilitaire. DIX `max-w-*` posés sur des champs ne commandaient rien.
//
// Un contrôle qui lit une CLASSE ne mesure pas un EFFET. Celui-ci monte le
// vrai CSS construit dans Chromium et LIT LA LARGEUR OBTENUE.
// ============================================================
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };

const ui = readFileSync("src/components/ui.jsx", "utf8");
const inputCls = ui.match(/export const inputCls = "([^"]+)"/)[1];
const suffixe = ui.match(/export const champRecherche = `\$\{inputCls\} ([^`]+)`/)[1];

const css = readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0];
if (!css) { console.log("❌ Pas de CSS construit — lancez `npm run build` d'abord."); process.exit(1); }

const dossier = mkdtempSync(join(tmpdir(), "bmi-champs-"));
const page = join(dossier, "p.html");
writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${join(process.cwd(), "dist/assets", css)}"></head>
<body style="margin:0"><div style="width:100%">
  <input id="recherche" class="${inputCls} ${suffixe}" placeholder="Rechercher…">
  <input id="ordinaire" class="${inputCls}" placeholder="Champ ordinaire">
  <input id="temoin" class="${inputCls} max-w-xs" placeholder="Témoin : un max-w sur un champ">
</div></body></html>`);

console.log("\n── 🔍 LA LIGNE DE RECHERCHE, MESURÉE ──");
const navigateur = await chromium.launch();
const mesurer = async (largeur) => {
  const p = await navigateur.newPage({ viewport: { width: largeur, height: 800 } });
  await p.goto(`file://${page}`);
  const r = await p.evaluate(() => ({
    recherche: Math.round(document.getElementById("recherche").getBoundingClientRect().width),
    ordinaire: Math.round(document.getElementById("ordinaire").getBoundingClientRect().width),
    temoin: Math.round(document.getElementById("temoin").getBoundingClientRect().width),
  }));
  await p.close();
  return r;
};
const pc = await mesurer(1400);
const tablette = await mesurer(700);
const tel = await mesurer(390);
await navigateur.close();
rmSync(dossier, { recursive: true, force: true });

test("★ sur ORDINATEUR (1400 px) la ligne de recherche est BRIDÉE — elle ne traverse pas l'écran",
  pc.recherche > 200 && pc.recherche <= 360,
  `mesuré : ${pc.recherche} px (le champ ordinaire, lui, fait ${pc.ordinaire} px)`);
test("★ sur TABLETTE (700 px) elle est bridée de la même façon",
  tablette.recherche > 200 && tablette.recherche <= 360, `mesuré : ${tablette.recherche} px`);
test("★ sur TÉLÉPHONE (390 px) elle prend TOUTE la largeur — c'est là qu'on en a besoin",
  tel.recherche === tel.ordinaire && tel.recherche >= 360, `mesuré : ${tel.recherche} px`);
test("★ un champ ORDINAIRE n'a pas été rétréci au passage (la règle ne vaut que pour la recherche)",
  pc.ordinaire >= 1300 && tel.ordinaire >= 360);

console.log("\n── ⚠ LE PIÈGE, GRAVÉ : `max-w-*` NE COMMANDE RIEN SUR UN CHAMP ──");
test("★ le TÉMOIN le prouve : un `max-w-xs` posé sur un input ne bride RIEN (la règle globale d'index.css l'écrase)",
  pc.temoin === pc.ordinaire,
  `témoin ${pc.temoin} px = champ ordinaire ${pc.ordinaire} px — la classe est là, elle ne fait rien`);
test("★ la règle globale qui l'écrase est TOUJOURS là (elle existe pour une vraie raison : un champ qui débordait d'une grille)",
  /input, select, textarea \{ max-width: 100%; \}/.test(readFileSync("src/index.css", "utf8")));

const morts = execSync("grep -rn 'max-w-' src/screens src/components | grep -E 'inputCls|champRecherche' || true")
  .toString().trim();
test("★ donc PLUS AUCUN `max-w-*` posé sur un champ de saisie dans l'application — dix l'étaient, aucun ne commandait rien",
  morts === "", morts.split("\n").slice(0, 5).join("\n     "));

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
