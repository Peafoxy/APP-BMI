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
import { useAppuiLong } from "${process.cwd()}/src/components/ui.jsx";
const TABS = [["ventes", "Ventes"], ["commandes", "Commandes"], ["depenses", "Dépenses"], ["dettes", "Dettes"], ["caisse", "Caisse"]];
window.journal = [];
function Essai({ sens }) {
  const [tab, setTab] = useState("ventes");
  const [ordre, setOrdre] = useState(null);
  const base = location.hash === "#27" ? VINGT_SEPT : TABS;
  const tabs = ordre ? ordre.map((id) => base.find((t) => t[0] === id)) : base;
  return <OngletsDeplacables tabs={tabs} tab={tab} sens={sens}
    onChoisir={(id) => { window.journal.push("choisir:" + id); setTab(id); }}
    onReordonner={(ids) => { window.journal.push("ordre:" + ids.join(",")); setOrdre(ids); }}
    className={sens === "vertical" ? "v" : "h"}
    classeBouton={(id, actif) => "b " + (actif ? "actif" : "")} />;
}
const style = document.createElement("style");
style.textContent = ".v{display:flex;flex-direction:column;width:200px} .h{display:flex;flex-direction:row;overflow-x:auto;width:600px} .n{display:flex;flex-direction:row;overflow-x:auto;width:220px} .b{padding:12px;margin:2px;background:#ddd;border:0;font:14px sans-serif;white-space:nowrap} .actif{background:#8cf}";
document.head.appendChild(style);
// 15/09/2026 : une barre ÉTROITE (téléphone) dont l'onglet ouvert est le
// DERNIER — le cas du retour, quand le dernier onglet est mémorisé.
function Etroit() {
  const [tab, setTab] = useState("caisse");
  return <OngletsDeplacables tabs={TABS} tab={tab} sens="horizontal"
    onChoisir={(id) => { window.journal.push("choisir:" + id); setTab(id); }}
    onReordonner={() => {}} className="n"
    classeBouton={(id, actif) => "b " + (actif ? "actif" : "")} />;
}
// 05/10/2026 : l'appui long qui DÉCLENCHE (supprimer une conversation de
// 📲 WhatsApp) — le hook commun, monté tel quel sur deux lignes : l'une
// active (l'administrateur principal), l'autre inactive (tout autre compte).
function Ligne({ id, actif }) {
  const appui = useAppuiLong(() => window.journal.push("appui:" + id), { actif });
  return <button className="b" data-ligne-appui={id} onClick={() => window.journal.push("clic:" + id)} {...appui}>{id}</button>;
}
createRoot(document.getElementById("a")).render(<div><Ligne id="principal" actif={true} /><Ligne id="autre" actif={false} /></div>);
createRoot(document.getElementById("v")).render(<Essai sens="vertical" />);
createRoot(document.getElementById("h")).render(<Essai sens="horizontal" />);
createRoot(document.getElementById("n")).render(<Etroit />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><body><div id="v"></div><div id="h" style="margin-top:40px"></div><div id="n" style="margin-top:40px"></div><div id="a" style="margin-top:40px"></div><script src="bundle.js"></script></body></html>`);

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
console.log("\nBarre étroite (téléphone) : l'onglet OUVERT est visible (15/09/2026)");
{
  // Timo : « quand tu te reconnectes, le dernier onglet est mémorisé, l'écran
  // affiche ses données, mais les onglets sont restés sur les premiers ».
  const mesure = async () => page.evaluate(() => {
    const el = document.querySelector(".n");
    const b = [...el.querySelectorAll("[data-tab-id]")].find((x) => x.className.includes("actif"));
    const r = b.getBoundingClientRect(), c = el.getBoundingClientRect();
    return { id: b.dataset.tabId, dedans: r.left >= c.left - 1 && r.right <= c.right + 1, scroll: Math.round(el.scrollLeft),
      largeurBarre: Math.round(el.clientWidth), largeurTotale: Math.round(el.scrollWidth), pageY: Math.round(window.scrollY) };
  });
  const m = await mesure();
  test("★ au retour, la barre s'est déplacée toute seule sur le dernier onglet ouvert (il est ENTIÈREMENT visible)",
    m.id === "caisse" && m.dedans && m.scroll > 0 && m.largeurTotale > m.largeurBarre,
    `mesuré : ${JSON.stringify(m)}`);
  test("★ c'est la BARRE qui défile, jamais la page", m.pageY === 0, `défilement de la page : ${m.pageY}`);
  // Un onglet déjà visible ne fait rien bouger : on tape le premier visible.
  const avant = m.scroll;
  await page.evaluate(() => { document.querySelector(".n").scrollLeft = 0; });
  await page.evaluate(() => {
    const el = document.querySelector(".n");
    const b = [...el.querySelectorAll("[data-tab-id]")][0];
    b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await attendre(200);
  const m2 = await mesure();
  test("★ choisir un onglet DÉJÀ visible ne fait pas sauter la barre", m2.id === "ventes" && m2.dedans && m2.scroll === 0,
    `mesuré : ${JSON.stringify(m2)} (avant : ${avant})`);
}
console.log("\nL'appui long qui DÉCLENCHE (05/10/2026 — supprimer une conversation de 📲 WhatsApp)");
{
  const cdp = await ctx.newCDPSession(page);
  const toucher = async (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  const pos = async (id) => { const b = await page.$(`[data-ligne-appui="${id}"]`); const r = await b.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  await journal();
  const p = await pos("principal");
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await attendre(650); await page.mouse.up(); await attendre(150);
  const j1 = await journal();
  test("★★ souris : tenir ½ s déclenche l'action UNE fois, et le clic qui suit est AVALÉ (la conversation ne s'ouvre pas en plus)", j1.join("|") === "appui:principal", j1.join("|"));
  await page.mouse.click(p.x, p.y); await attendre(150);
  const j2 = await journal();
  test("★ un clic court reste un clic (la conversation s'ouvre), aucune action", j2.join("|") === "clic:principal", j2.join("|"));
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await attendre(80);
  await page.mouse.move(p.x, p.y + 60, { steps: 5 }); await attendre(650); await page.mouse.up(); await attendre(150);
  const j3 = await journal();
  test("★ un doigt qui bouge avant le ½ s (défilement) ne déclenche rien", !j3.some((x) => x.startsWith("appui:")), j3.join("|"));
  await toucher("touchStart", p.x, p.y); await attendre(650); await toucher("touchEnd", 0, 0); await attendre(200);
  const j4 = await journal();
  test("★★ au doigt : tenir ½ s déclenche l'action, sans clic parasite", j4.join("|") === "appui:principal", j4.join("|"));
  const a = await pos("autre");
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await attendre(650); await page.mouse.up(); await attendre(150);
  const j5 = await journal();
  test("★★ chez un autre compte (inactif), l'appui long ne fait RIEN de plus qu'un clic", j5.join("|") === "clic:autre", j5.join("|"));
}
test("aucune erreur JavaScript pendant les gestes", erreurs.length === 0, erreurs.join(" | "));

// ============================================================
// 🔲 LA PAGE D'ICÔNES (06/11/2026, Timo : « A2, B1, C1 », « 1 », « sur ordi
// on ferait mieux de les centraliser, comme Odoo »). Le VRAI composant
// (components/PageIcones.jsx), avec le VRAI CSS construit (dist/assets) —
// sinon la grille ne serait qu'une pile de boutons (leçon du 26/10/2026).
// ============================================================
console.log("\nPage d'icônes (grille), téléphone et ordinateur");
{
  const { readdirSync, readFileSync: lire } = await import("node:fs");
  const css = readdirSync("dist/assets").filter((f) => f.endsWith(".css")).map((f) => lire(join("dist/assets", f), "utf8")).join("\n");
  const entree2 = join(dossier, "icones.jsx");
  writeFileSync(entree2, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PageIcones } from "${process.cwd()}/src/components/PageIcones.jsx";
const TABS = [["dashboard", "📊 Tableau de bord"], ["ventes", "💰 Ventes (2)"], ["commandes", "📥 Commandes reçues"], ["tous_devis", "📋 Tous les devis (4)"], ["depenses", "📤 Dépenses"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["messages", "💬 Messages (3)"], ["parametres", "⚙ Paramètres"]];
// #27 : les 27 onglets de l'administrateur (la page qui doit tenir sans défiler).
const VINGT_SEPT = ["📊 Tableau de bord","📈 Rentabilité","💰 Ventes (2)","📥 Commandes reçues","📐 Dimensionnement","📋 Tous les devis (4)","📄 Contrats","📤 Dépenses","🧾 Chez le comptable","📋 Dettes","👤 Clients","🔒 Caisse","📦 Stocks","🚚 Fournisseurs","🎯 Commerciaux","👑 Mon équipe","🧲 Prospects","🏠 Clients installés","📅 Rendez-vous","💬 Messages (3)","📲 WhatsApp (1)","💵 Salaires","👥 Utilisateurs","🕘 Historique","⚙ Paramètres","🛠 Travaux à crédit","🧰 Outillage"].map((l, i) => ["t" + i, l]);
window.journal = [];
function Essai() {
  const [ordre, setOrdre] = useState(null);
  const base = location.hash === "#27" ? VINGT_SEPT : TABS;
  const tabs = ordre ? ordre.map((id) => base.find((t) => t[0] === id)) : base;
  return <PageIcones tabs={tabs} nom="TIMO" onChoisir={(id) => window.journal.push("choisir:" + id)}
    onReordonner={(ids) => { window.journal.push("ordre:" + ids.join(",")); setOrdre(ids); }} />;
}
createRoot(document.getElementById("g")).render(<Essai />);
`);
  const sortie2 = join(dossier, "icones.js");
  await build({ entryPoints: [entree2], bundle: true, format: "iife", outfile: sortie2, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
  const html2 = join(dossier, "icones.html");
  writeFileSync(html2, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css}</style></head><body class="bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900"><main class="w-full max-w-[1600px] mx-auto px-4 py-5"><div id="g"></div></main><script src="icones.js"></script></body></html>`);
  const mesurer = async (largeur, ancre = "") => {
    const ctx2 = await nav.newContext({ hasTouch: true, viewport: { width: largeur, height: 800 } });
    const p2 = await ctx2.newPage();
    const err2 = [];
    p2.on("pageerror", (e) => err2.push(String(e.message).split("\n")[0]));
    await p2.goto(`file://${html2}${ancre}`);
    await attendre(400);
    const boites = await p2.$$eval("[data-page-icones] [data-tab-id]", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.tabId, x: r.left, y: r.top, w: r.width, h: r.height }; }));
    const nombres = await p2.$$eval("[data-icone-nombre]", (els) => els.map((e) => e.textContent));
    const noms = await p2.$$eval("[data-page-icones] [data-tab-id]", (els) => els.map((e) => e.textContent));
    return { ctx2, p2, err2, boites, nombres, noms };
  };
  const parRangee = (boites) => { const r = new Map(); for (const b of boites) { const k = Math.round(b.y); r.set(k, (r.get(k) || 0) + 1); } return [...r.values()]; };

  const tel = await mesurer(390);
  // RETOURNÉ le 07/11/2026 (4 → 5 par rangée : « réduire les espaces… avoir
  // tout sans défilement »).
  test("★ téléphone : 5 icônes par rangée", parRangee(tel.boites)[0] === 5, JSON.stringify(parRangee(tel.boites)));
  test("★ le nom sans l'emoji ni le chiffre, le chiffre en PASTILLE rouge (« Ventes », pastille 2)",
    tel.noms.some((t) => t.includes("Ventes") && !t.includes("(2)")) && tel.nombres.join(",") === "2,4,3", `${tel.nombres.join(",")} — ${tel.noms.join(" | ")}`);
  // Un toucher ouvre l'écran.
  const v = tel.boites.find((b) => b.id === "ventes");
  await tel.p2.touchscreen.tap(v.x + v.w / 2, v.y + v.h / 2);
  await attendre(150);
  const jt = await tel.p2.evaluate(() => window.journal.splice(0));
  test("★ un toucher sur une icône ouvre son écran (onChoisir)", jt.join("|") === "choisir:ventes", jt.join("|"));
  // Appui long à la souris : « Caisse » (2e rangée) glissée sur « Tous les
  // devis » (4e place de la 1re rangée). ⚠ Ce point discrimine la grille : une
  // lecture par x seul la mettrait tout au bout, une lecture par y seul en tête.
  const ca = tel.boites.find((b) => b.id === "caisse");
  const dv = tel.boites.find((b) => b.id === "tous_devis");
  const but = { x: dv.x + dv.w * 0.8, y: dv.y + dv.h / 2 };
  await tel.p2.mouse.move(ca.x + ca.w / 2, ca.y + ca.h / 2);
  await tel.p2.mouse.down();
  await attendre(650);
  for (let i = 1; i <= 8; i++) { await tel.p2.mouse.move(ca.x + ca.w / 2 + (but.x - ca.x - ca.w / 2) * (i / 8), ca.y + ca.h / 2 + (but.y - ca.y - ca.h / 2) * (i / 8)); await attendre(20); }
  await tel.p2.mouse.up();
  await attendre(150);
  const jo = await tel.p2.evaluate(() => window.journal.splice(0));
  // Pendant le geste, les icônes se poussent : « Caisse » prend la place SOUS
  // le doigt (la 4e de la 1re rangée), « Tous les devis » passe à la suite.
  test("★★ appui long dans la GRILLE : « Caisse » (2e rangée) prend la place sous le doigt, la 4e de la 1re rangée, sans clic parasite",
    jo.join("|") === "ordre:dashboard,ventes,commandes,caisse,tous_devis,depenses,stocks,messages,parametres", jo.join("|"));
  test("aucune erreur JavaScript (téléphone)", tel.err2.length === 0, tel.err2.join(" | "));
  await tel.ctx2.close();

  // 📱 Les 27 icônes de l'administrateur tiennent sur UN écran de téléphone
  // (375 px de large) : la page d'icônes, salut compris, fait au plus 500 px de
  // haut — l'en-tête de l'application (~110 px) et la marge de l'écran
  // (~40 px) s'y ajoutent, un téléphone montre ~670 px. Avec l'ancien
  // espacement (4 par rangée, icônes de 56 px), elle faisait ~840 px.
  const t27 = await mesurer(375, "#27");
  const haut27 = await t27.p2.$eval("[data-page-icones]", (e) => Math.round(e.getBoundingClientRect().height));
  test("★★ téléphone : les 27 icônes de l'administrateur tiennent sans défiler (page d'icônes ≤ 500 px)",
    t27.boites.length === 27 && haut27 <= 500, `${t27.boites.length} icônes, ${haut27} px, rangées ${JSON.stringify(parRangee(t27.boites))}`);
  const deborde = await t27.p2.$eval("[data-page-icones]", (e) => e.scrollWidth > e.clientWidth + 1);
  test("téléphone : rien ne déborde sur le côté", !deborde, "");
  await t27.ctx2.close();

  const pc = await mesurer(1300);
  const gauche = Math.min(...pc.boites.map((b) => b.x));
  const droite = Math.max(...pc.boites.map((b) => b.x + b.w));
  test("★ ordinateur : 6 icônes par rangée", parRangee(pc.boites)[0] === 6, JSON.stringify(parRangee(pc.boites)));
  test("★★ ordinateur : les icônes sont REGROUPÉES AU CENTRE (« comme Odoo »), pas étalées d'un bord à l'autre",
    droite - gauche <= 660 && Math.abs((gauche + droite) / 2 - 650) <= 20, `de ${Math.round(gauche)} à ${Math.round(droite)} px`);
  test("aucune erreur JavaScript (ordinateur)", pc.err2.length === 0, pc.err2.join(" | "));
  await pc.ctx2.close();
}

await nav.close();
rmSync(dossier, { recursive: true, force: true });
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
