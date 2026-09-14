// ============================================================
// LE PDF PARTAGÉ — mesuré dans Chromium (Timo, 14/09/2026, deux captures :
// le PDF partagé depuis le téléphone sortait à la LARGEUR DE L'ÉCRAN, étroit
// et coupé en deux pages, alors que l'impression donnait une page A4).
//
//   npm run verifier-partage
//
// On bundle components/ui.jsx (pdfDeLApercu) tel qu'il part chez Timo, on
// l'ouvre dans un Chromium à la largeur d'un TÉLÉPHONE (390 px) puis d'un
// ORDINATEUR (1280 px), et on MESURE le PDF produit : format A4, un reçu court
// = une page, un long tableau = plusieurs pages, et le même résultat quelle
// que soit la largeur de l'écran. Le banc mesure, il ne présume pas.
// ============================================================
import { build } from "esbuild";
import { createRequire } from "node:module";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
let ok = 0, ko = 0;
const test = (nom, c) => { if (c) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };

mkdirSync("node_modules/.cache", { recursive: true });
const entree = join("node_modules", ".cache", `bmi-partage-entree-${process.pid}.jsx`);
const sortie = join("node_modules", ".cache", `bmi-partage-${process.pid}.js`);
writeFileSync(entree, `
import { pdfDeLApercu, PAGE_A4, LARGEUR_RENDU_PX } from "../../src/components/ui.jsx";
window.__mesurer = async () => {
  const style = '<style>#zone-impression .recu-doc{font-family:Arial;font-size:12px;max-width:680px;margin:0 auto} #zone-impression table{width:100%;border-collapse:collapse} #zone-impression td{border:1px solid #d5e2ee;padding:6px} #zone-impression th{background:#1e5a8a;color:#fff;padding:6px}</style>';
  const lignes = Array.from({ length: 60 }, (_, i) => '<tr><td>Article ' + (i + 1) + '</td><td>' + (i + 1) + '</td><td>1 000 F</td></tr>').join("");
  const long = style + '<div class="recu-doc"><h1>REÇU DE VENTE</h1><table><thead><tr><th>Description</th><th>Qté</th><th>Montant</th></tr></thead><tbody>' + lignes + '</tbody></table></div>';
  const court = style + '<div class="recu-doc"><h1>REÇU</h1><p>Une ligne.</p></div>';
  const infos = (d) => ({ pages: d.getNumberOfPages(), largeur: Math.round(d.internal.pageSize.getWidth()), hauteur: Math.round(d.internal.pageSize.getHeight()) });
  const etiquette = await pdfDeLApercu(court, "size: 60mm 30mm; margin: 0;");
  return { court: infos(await pdfDeLApercu(court, PAGE_A4)), long: infos(await pdfDeLApercu(long, PAGE_A4)), etiquette: infos(etiquette), largeurRendu: LARGEUR_RENDU_PX, largeurEcran: window.innerWidth, resteHorsEcran: document.querySelectorAll("#zone-impression").length };
};`);
await build({ entryPoints: [entree], bundle: true, format: "iife", platform: "browser", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" }, define: { "process.env.NODE_ENV": '"production"' } });

const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const mesurer = async (largeur) => {
  const page = await nav.newPage({ viewport: { width: largeur, height: 800 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>');
  await page.addScriptTag({ path: sortie });
  const r = await page.evaluate(() => window.__mesurer());
  await page.close();
  return { ...r, erreurs };
};
console.log("\n📤 Le PDF partagé, mesuré dans Chromium");
const tel = await mesurer(390);
const pc = await mesurer(1280);
await nav.close();
try { unlinkSync(entree); unlinkSync(sortie); } catch {}

test("★ sur un TÉLÉPHONE (390 px) : le PDF est une A4 (210 × 297), un reçu court tient sur UNE page, un tableau de 60 lignes en fait plusieurs — jamais un document à la largeur de l'écran",
  tel.erreurs.length === 0 && tel.court.largeur === 210 && tel.court.hauteur === 297 && tel.court.pages === 1 && tel.long.pages >= 2 && tel.long.largeur === 210 && tel.largeurEcran === 390);
test("★ sur un ORDINATEUR (1280 px) : exactement le même résultat (le rendu se fait hors écran, à la largeur d'une page, pas à celle de la fenêtre)",
  pc.erreurs.length === 0 && pc.court.pages === tel.court.pages && pc.long.pages === tel.long.pages && pc.long.largeur === 210 && pc.largeurEcran === 1280 && tel.largeurRendu === 794);
test("★ le format de l'aperçu est respecté (une étiquette 60 × 30 sort en 60 × 30) et le cadre hors écran est retiré après le rendu (aucun #zone-impression ne traîne)",
  tel.etiquette.largeur === 60 && tel.etiquette.hauteur === 30 && tel.resteHorsEcran === 0 && pc.resteHorsEcran === 0);

console.log();
if (ko === 0) { console.log(`✅  ${ok} vérification(s) passée(s), 0 en échec.`); process.exit(0); }
console.log(`❌  ${ok} vérification(s) passée(s), ${ko} en échec.`); process.exit(1);
