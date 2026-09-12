// ============================================================
// scripts/verifier-onglets-deplacables.mjs — L'APPUI LONG DÉPLACE-T-IL
// VRAIMENT UN ONGLET ?
//
//   npm run verifier-onglets-deplacables
//
// Timo (12/09/2026) : « appui long et on déplace, tout court ». Ce geste vit
// dans du JSX et des événements de pointeur : on ne peut pas l'appeler
// depuis Node. On MONTE donc le vrai composant (components/OngletsDeplacables.jsx)
// dans un vrai navigateur (Chromium), et on fait le geste : appuyer, tenir
// un demi-seconde, glisser, relâcher — à la souris ET au doigt. Puis on
// vérifie que l'ordre rendu est le bon, qu'un simple clic reste un clic, et
// qu'un doigt qui part tout de suite ne déplace rien.
// ============================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const dossier = mkdtempSync(join(tmpdir(), "bmi-onglets-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { OngletsDeplacables } from "${process.cwd()}/src/components/OngletsDeplacables.jsx";
const TABS = [["ventes", "Ventes"], ["commandes", "Commandes"], ["depenses", "Dépenses"], ["dettes", "Dettes"], ["caisse", "Caisse"]];
window.journal = [];
function Essai({ sens }) {
  const [tab, setTab] = useState("ventes");
  const [ordre, setOrdre] = useState(null);
  const tabs = ordre ? ordre.map((id) => TABS.find((t) => t[0] === id)) : TABS;
  return <OngletsDeplacables tabs={tabs} tab={tab} sens={sens}
    onChoisir={(id) => { window.journal.push("choisir:" + id); setTab(id); }}
    onReordonner={(ids) => { window.journal.push("ordre:" + ids.join(",")); setOrdre(ids); }}
    className={sens === "vertical" ? "v" : "h"}
    classeBouton={(id, actif) => "b " + (actif ? "actif" : "")} />;
}
const style = document.createElement("style");
style.textContent = ".v{display:flex;flex-direction:column;width:200px} .h{display:flex;flex-direction:row;overflow-x:auto;width:600px} .b{padding:12px;margin:2px;background:#ddd;border:0;font:14px sans-serif;white-space:nowrap} .actif{background:#8cf}";
document.head.appendChild(style);
createRoot(document.getElementById("v")).render(<Essai sens="vertical" />);
createRoot(document.getElementById("h")).render(<Essai sens="horizontal" />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><body><div id="v"></div><div id="h" style="margin-top:40px"></div><script src="bundle.js"></script></body></html>`);

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ hasTouch: true, viewport: { width: 800, height: 600 } });
const page = await ctx.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
await page.goto(`file://${html}`);
await attendre(500);

const ordreRendu = (cadre) => page.$$eval(`${cadre} [data-tab-id]`, (els) => els.map((e) => e.dataset.tabId).join(","));
const centre = async (cadre, id) => { const b = await page.$(`${cadre} [data-tab-id="${id}"]`); const r = await b.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height, w: r.width }; };
const journal = () => page.evaluate(() => { const j = window.journal.slice(); window.journal.length = 0; return j; });

console.log("\nBarre verticale (ordinateur), à la souris");
{
  test("★ le composant se monte sans erreur, dans l'ordre du rôle", await ordreRendu("#v") === "ventes,commandes,depenses,dettes,caisse" && erreurs.length === 0, erreurs.join(" | "));
  // Un simple clic choisit l'onglet, ne déplace rien.
  const c = await centre("#v", "dettes");
  await page.mouse.click(c.x, c.y);
  await attendre(100);
  test("★ un simple clic choisit l'onglet (onChoisir), n'écrit aucun ordre", (await journal()).join("|") === "choisir:dettes" && await ordreRendu("#v") === "ventes,commandes,depenses,dettes,caisse");
  // Appui long puis glisser « Caisse » juste après « Ventes » (l'exemple de Timo).
  const caisse = await centre("#v", "caisse");
  const commandes = await centre("#v", "commandes");
  await page.mouse.move(caisse.x, caisse.y);
  await page.mouse.down();
  await attendre(650);
  for (let i = 1; i <= 8; i++) { await page.mouse.move(caisse.x, caisse.y + (commandes.y - caisse.y) * (i / 8)); await attendre(20); }
  await page.mouse.move(commandes.x, commandes.y - commandes.h * 0.45);
  await attendre(50);
  await page.mouse.up();
  await attendre(150);
  const j = await journal();
  test("★ appui long (½ s) puis glisser : « Caisse » vient juste après « Ventes » (l'exemple de Timo), l'ordre est transmis (onReordonner) et AUCUN clic ne suit le déplacement",
    await ordreRendu("#v") === "ventes,caisse,commandes,depenses,dettes" && j.join("|") === "ordre:ventes,caisse,commandes,depenses,dettes", `journal : ${j.join("|")} — rendu : ${await ordreRendu("#v")}`);
  // Un appui qui bouge tout de suite n'est pas un appui long : rien ne bouge.
  const dettes = await centre("#v", "dettes");
  await page.mouse.move(dettes.x, dettes.y);
  await page.mouse.down();
  await attendre(100);
  await page.mouse.move(dettes.x, dettes.y - 120, { steps: 6 });
  await attendre(650);
  await page.mouse.up();
  await attendre(150);
  test("★ un appui qui bouge avant le demi-seconde (défilement) ne déplace rien, même si on tient ensuite", await ordreRendu("#v") === "ventes,caisse,commandes,depenses,dettes" && (await journal()).filter((x) => x.startsWith("ordre:")).length === 0);
  // Un appui long relâché sans bouger : rien n'est écrit (ordre inchangé).
  await page.mouse.move(dettes.x, dettes.y);
  await page.mouse.down();
  await attendre(650);
  await page.mouse.up();
  await attendre(150);
  const j2 = await journal();
  test("★ un appui long relâché sur place transmet l'ordre inchangé (l'écran n'écrit rien : ordreApres le dit) et n'ouvre pas l'onglet", j2.join("|") === "ordre:ventes,caisse,commandes,depenses,dettes" && await ordreRendu("#v") === "ventes,caisse,commandes,depenses,dettes", j2.join("|"));
}

console.log("\nBarre horizontale (téléphone), au doigt");
{
  const cdp = await ctx.newCDPSession(page);
  const toucher = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  test("★ ordre de départ", await ordreRendu("#h") === "ventes,commandes,depenses,dettes,caisse");
  const caisse = await centre("#h", "caisse");
  const commandes = await centre("#h", "commandes");
  await toucher("touchStart", caisse.x, caisse.y);
  await attendre(650);
  for (let i = 1; i <= 8; i++) { await toucher("touchMove", caisse.x + (commandes.x - caisse.x) * (i / 8), caisse.y); await attendre(20); }
  await toucher("touchMove", commandes.x - commandes.w * 0.45, commandes.y);
  await attendre(50);
  await toucher("touchEnd", 0, 0);
  await attendre(200);
  const j = await journal();
  test("★ au doigt : appui long puis glisser vers la gauche, « Caisse » passe juste après « Ventes », sans clic parasite",
    await ordreRendu("#h") === "ventes,caisse,commandes,depenses,dettes" && j.join("|") === "ordre:ventes,caisse,commandes,depenses,dettes", `journal : ${j.join("|")} — rendu : ${await ordreRendu("#h")}`);
  const dettes = await centre("#h", "dettes");
  await toucher("touchStart", dettes.x, dettes.y);
  await attendre(60);
  for (let i = 1; i <= 6; i++) { await toucher("touchMove", dettes.x - 30 * i, dettes.y); await attendre(20); }
  await attendre(650);
  await toucher("touchEnd", 0, 0);
  await attendre(200);
  test("★ au doigt : un glissement immédiat (pour faire défiler) ne déplace rien", await ordreRendu("#h") === "ventes,caisse,commandes,depenses,dettes" && (await journal()).filter((x) => x.startsWith("ordre:")).length === 0);
  const ventes = await centre("#h", "ventes");
  await toucher("touchStart", ventes.x, ventes.y);
  await attendre(60);
  await toucher("touchEnd", 0, 0);
  await attendre(200);
  test("★ au doigt : un tap choisit l'onglet", (await journal()).join("|") === "choisir:ventes");
}
test("aucune erreur JavaScript pendant les gestes", erreurs.length === 0, erreurs.join(" | "));

await nav.close();
rmSync(dossier, { recursive: true, force: true });
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
