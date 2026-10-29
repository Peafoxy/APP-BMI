// ============================================================
// scripts/verifier-ecran-achat-chantier.mjs — 🏗 LA CASE « CHANTIER » DE
// 💰 VENTES, JOUÉE DANS CHROMIUM (11/10/2026, étape 2 de la caisse CHANTIER)
//
//   npm run verifier-ecran-achat-chantier
//
// On monte le VRAI écran 💰 Ventes et sa fenêtre de questions (DialogHost),
// et on clique comme la gérante : cocher « 🏗 Chantier », choisir le chantier,
// enregistrer. On lit ce qui est ÉCRIT : le stock sort (ajustement), l'achat
// se range sur le chantier, AUCUNE vente, aucune dette, aucune question
// « vente sans numéro ». Puis les refus (stock, remise) et la vendeuse.
// ============================================================
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const propre = (t) => String(t).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

const dossier = mkdtempSync(join(tmpdir(), "bmi-achat-chantier-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Ventes } from "${process.cwd()}/src/screens/Ventes.jsx";
import { DialogHost } from "${process.cwd()}/src/components/ui.jsx";
const quoi = location.hash.slice(1);
const gerant = { id: "g1", nom: "AFI", role: "gerant", boutique: "BMI DEMAKPOE", actif: true };
const vendeuse = { id: "v1", nom: "ANGELE", role: "vendeur", boutique: "BMI DEMAKPOE", actif: true };
const depart = {
  boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", prefixe: "BMID", formation: false }, { id: "t", nom: "TERRAIN", terrain: true, formation: false }],
  users: [gerant, vendeuse],
  produits: [{ id: "p1", nom: "Panneau 550W", boutique: "BMI DEMAKPOE", prix_achat: 60000, prix_vente: 80000, initial: 10, seuil: 1 }],
  ventes: [{ id: "vD", numero: "BMID-2026-0050", date: "2026-10-01", boutique: "BMI DEMAKPOE", caisse: "TERRAIN", paiement: "Crédit (dette)", avance: 100000, client: "Kossi MENSAH",
    articles: [{ produit_id: "p1", article: "Panneau 550W", qte: 4, pu: 80000, au_chantier: true }], frais_installation: 32000 }],
  dettes: [{ id: "dD", vente_id: "vD", boutique: "TERRAIN", montant: 352000, paye: 100000, paiements: [{ id: "q1", date: "2026-10-01", montant: 100000 }] }],
  clients_installes: [{ id: "c1", nom: "MENSAH", prenom: "Kossi", formation: false, vente_id: "vD", stock_au_chantier: true, statut: "en_cours", achats_chantier: [] },
    { id: "c2", nom: "VIEUX", formation: false, statut: "en_cours" }],
  depenses: [], ajustements: [], entrees: [], commandes: [], proformas: [], messages: [], prospects: [], audits: [], clotures: [],
};
window.saves = [];
const qte = quoi === "trop" ? 20 : quoi === "reserve" ? 8 : 3;
// Un objet STABLE : l'écran recharge le panier à chaque NOUVEAU preRempli.
const preRempli = { boutique: "BMI DEMAKPOE", panier: [{ produit_id: "p1", article: "Panneau 550W", qte, pu: 80000 }] };
function Essai() {
  const [db, setDb] = useState(depart);
  const save = (next, journal) => { const n = typeof next === "function" ? next(db) : next; window.saves.push({ n, journal }); setDb(n); };
  return <><Ventes db={db} save={save} profile={quoi === "vendeuse" ? vendeuse : gerant}
    preRempli={preRempli} onPreRempliConsomme={() => {}} /><DialogHost /></>;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic",
  nodePaths: [join(process.cwd(), "node_modules")],
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": '{"VITE_SUPABASE_URL":"https://exemple.supabase.co","VITE_SUPABASE_ANON_KEY":"x","MODE":"test"}' } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ouvrir = async (quoi = "") => {
  const page = await nav.newPage({ viewport: { width: 1200, height: 1000 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
  await page.goto(`file://${html}#${quoi}`);
  await attendre(500);
  return { page, erreurs };
};
const dialogue = async (page) => propre(await page.$eval("[data-dialogue]", (e) => e.innerText).catch(() => ""));
const bouton = async (page, texte) => { await page.locator("[data-dialogue-boutons] button", { hasText: texte }).click(); await attendre(200); };
const saves = (page) => page.evaluate(() => window.saves.length);
const cocherEtChoisir = async (page) => {
  await page.click("[data-coche-chantier]"); await attendre(150);
  await page.selectOption("[data-choix-chantier-achat]", "c1"); await attendre(150);
};

console.log("\n🏗 La case « Chantier » jouée par la gérante");
{
  const { page, erreurs } = await ouvrir();
  test("l'écran se monte, la case est là (non cochée), le formulaire du client aussi", erreurs.length === 0 && !!(await page.$("[data-coche-chantier]")) && /Numéro du client/.test(await page.innerText("body")), erreurs.join(" | "));
  const options = await page.$$eval("[data-choix-chantier-achat] option", (o) => o.map((x) => x.textContent)).catch(() => []);
  await page.click("[data-coche-chantier]"); await attendre(150);
  const options2 = await page.$$eval("[data-choix-chantier-achat] option", (o) => o.map((x) => x.textContent));
  test("★ G : cochée, la liste ne propose que le chantier né d'un devis « avec installation » (MENSAH), jamais l'autre", options.length === 0 && options2.length === 2 && /Kossi MENSAH/.test(options2[1]) && !options2.some((o) => /VIEUX/.test(o)), JSON.stringify(options2));
  await page.selectOption("[data-choix-chantier-achat]", "c1"); await attendre(150);
  const argent = propre(await page.innerText("[data-argent-chantier]"));
  test("★★ l'argent du chantier : payé 100 000, part matériel 320 000, cet achat 240 000 payé par le chantier, 140 000 resteront en attente",
    /Payé par le client pour son devis : 100 000 F/.test(argent) && /part matériel du devis : 320 000 F/.test(argent) && /Cet achat : 240 000 F — 🏗 Payé par le dépôt chantier/.test(argent) /* RETOURNÉ le 12/10/2026 : dépôt chantier */ && /140 000 F resteront en attente du chantier/.test(argent), argent);
  const corps = await page.innerText("body");
  test("★ 4 : en mode chantier, plus de client, de paiement ni de proforma ; le bouton dit ce qu'il fait",
    !/Numéro du client/.test(corps) && !/Proforma WhatsApp/.test(corps) && !(await page.$("text=💳 Encaisser la vente")) && !!(await page.$("[data-bouton-achat-chantier]")));
  await page.click("[data-bouton-achat-chantier]"); await attendre(200);
  const q = await dialogue(page);
  // RETOURNÉ le 12/10/2026 (« C b ») : l'achat est puisé dans le dépôt et DEVIENT UNE VENTE — la confirmation le dit.
  test("★★ UNE confirmation, qui dit « payé par le dépôt chantier », qu'il devient une vente, et l'attente — jamais la question « sans numéro »",
    /Enregistrer l'achat pour le chantier de Kossi MENSAH/.test(q) && /Payé par le dépôt chantier : rien n'entre dans le tiroir/.test(q) && /DEVIENT UNE VENTE/.test(q) && /140 000 F resteront en attente du chantier/.test(q) && !/pas de numéro/.test(q), q);
  await bouton(page, "OK");
  const s = await page.evaluate(() => window.saves.map((x) => ({ j: x.journal, aj: x.n.ajustements, v: x.n.ventes.length, d: x.n.dettes.length, c: x.n.clients_installes.find((c) => c.id === "c1") })));
  test("★★ UNE écriture : le stock sort (−3, sortie_chantier), l'achat BMID-ACH-2026-0001 se range sur le chantier, AUCUNE vente ni dette de plus",
    s.length === 1 && s[0].aj.length === 1 && s[0].aj[0].qte === -3 && s[0].aj[0].type === "sortie_chantier" && s[0].v === 1 && s[0].d === 1
    && s[0].c.achats_chantier.length === 1 && s[0].c.achats_chantier[0].numero === "BMID-ACH-2026-0001" && /payé par le dépôt chantier/.test(s[0].j), JSON.stringify(s).slice(0, 300));
  const apres = propre(await page.innerText("body"));
  test("plus aucune fenêtre ouverte, le message dit l'achat, le panier est vidé, la case décochée", (await dialogue(page)) === "" && /Achat BMID-ACH-2026-0001 enregistré pour le chantier de Kossi MENSAH/.test(apres) && /Panier \(0 article/.test(apres) && !(await page.isChecked("[data-coche-chantier]")), apres.slice(0, 600));
  await page.click("[data-onglet-achats-chantier]"); await attendre(150);
  const ligne = propre(await page.innerText("[data-table-achats-chantier]"));
  test("★ l'onglet « 🏗 Achats chantier (1) » liste l'achat : Kossi MENSAH, 240 000 F, ⏳ 140 000 F en attente", /BMID-ACH-2026-0001/.test(ligne) && /Kossi MENSAH/.test(ligne) && /240 000 F/.test(ligne) && /140 000 F en attente/.test(ligne), ligne);
  await page.close();
}

console.log("\n🏗 Les refus");
{
  const { page } = await ouvrir("trop");
  await cocherEtChoisir(page);
  await page.click("[data-bouton-achat-chantier]"); await attendre(200);
  test("★ stock insuffisant (20 pour 10) : refusé en le disant, rien n'est écrit (un achat pour un chantier ne se réserve pas)", /Stock insuffisant pour : Panneau 550W \(10 disponible\)/.test(await dialogue(page)) && (await saves(page)) === 0);
  await page.close();
}
{
  const { page } = await ouvrir();
  await cocherEtChoisir(page);
  await page.fill('[data-case-achat-chantier] ~ div input[type="number"]', "5"); await attendre(150);
  await page.click("[data-bouton-achat-chantier]"); await attendre(200);
  test("★ B b : une remise de 5 % par la gérante → refusée (au-delà de 3 %, l'administrateur), rien n'est écrit", /réservée à l'administrateur/.test(await dialogue(page)) && (await saves(page)) === 0, await dialogue(page));
  await page.close();
}
console.log("\n🔒 Le matériel réservé : la vente au comptoir qui empiète (12/10/2026, « B a »)");
{
  // 10 panneaux en stock, 4 réservés par le devis de MENSAH (payé, rien d'acheté) :
  // en vendre 8 au comptoir en laisserait 2 → la question, AVANT toute écriture.
  const { page } = await ouvrir("reserve");
  await page.fill('input[placeholder*="Nom du client"], input[placeholder*="Client"]', "KOFFI").catch(() => {});
  const tel = page.locator('input[type="tel"]').first();
  if (await tel.count()) await tel.fill("90112233");
  await page.locator("button", { hasText: "Encaisser la vente" }).first().click(); await attendre(250);
  let q = await dialogue(page);
  if (/pas de numéro/i.test(q)) { await bouton(page, "Continuer"); q = await dialogue(page); }
  test("★★ la question dit : 10 en stock, dont 4 réservés pour Kossi MENSAH, il manquera 2 — continuer ?",
    /Panneau 550W : 10 en stock, dont 4 réservés pour une installation — Kossi MENSAH \(4, payé le 01\/10\/2026\)/.test(q) && /il manquera 2 pour ce chantier/.test(q) && (await saves(page)) === 0, q);
  await bouton(page, "Annuler");
  test("★ « Annuler » : rien n'est écrit, le panier reste", (await saves(page)) === 0 && /Panneau 550W/.test(await page.innerText("body")));
  await page.locator("button", { hasText: "Encaisser la vente" }).first().click(); await attendre(250);
  q = await dialogue(page);
  if (/pas de numéro/i.test(q)) { await bouton(page, "Continuer"); q = await dialogue(page); }
  await bouton(page, "OK"); await attendre(300);
  const suite = await dialogue(page);
  test("★ après « OK », la confirmation ordinaire de la vente suit (la question n'a rien écrit)", /Confirmer la vente de 1 article\(s\) pour 640 000 F/.test(suite) && (await saves(page)) === 0, suite);
  await bouton(page, "OK"); await attendre(300);
  const v = await page.evaluate(() => window.saves.map((x) => x.n.ventes.length));
  test("★ « OK » : la vente part (le stock sort, le chantier manquera de matériel)", v.length >= 1 && v[v.length - 1] === 2, JSON.stringify(v));
  await page.close();
}
console.log("\n🏷 UNE case de remise, en % ou libre (12/10/2026, « case unique… au-dessus on choisit soit libre ou en % »)");
{
  const { page, erreurs } = await ouvrir();
  const ligneInputs = await page.$$eval("[data-remise-ligne] input", (l) => l.length);
  const optLigne = await page.$$eval("[data-remise-ligne] [data-mode-remise] option", (o) => o.map((x) => x.textContent));
  const optGen = await page.$$eval("[data-remise-generale] [data-mode-remise] option", (o) => o.map((x) => x.textContent));
  test("★★ la remise d'un article : UNE seule case, et au-dessus la liste « Remise ligne (%) / Remise ligne libre (F) » ; la générale pareil",
    erreurs.length === 0 && ligneInputs === 1 && optLigne.join("|") === "Remise ligne (%)|Remise ligne libre (F)" && optGen.join("|") === "Remise (%)|Remise libre (F)"
    && !!(await page.$("[data-remise-ligne] [data-remise-pct]")), JSON.stringify({ ligneInputs, optLigne, optGen, erreurs }));
  await page.selectOption("[data-remise-ligne] [data-mode-remise]", "montant"); await attendre(100);
  test("★ « libre » choisi : la case de la ligne devient une case en francs (toujours une seule)",
    !!(await page.$("[data-remise-ligne] [data-remise-montant]")) && !(await page.$("[data-remise-ligne] [data-remise-pct]")) && (await page.$$eval("[data-remise-ligne] input", (l) => l.length)) === 1);
  await page.fill("[data-remise-generale] [data-remise-pct]", "2"); await attendre(100);
  await page.selectOption("[data-remise-generale] [data-mode-remise]", "montant"); await attendre(100);
  test("★ changer de mode reprend la remise déjà saisie : 2 % de 240 000 → 4 800 F dans la case libre",
    (await page.inputValue("[data-remise-generale] [data-remise-montant]")) === "4800");
  await page.fill("[data-remise-generale] [data-remise-montant]", "7200"); await attendre(100);
  const tel = page.locator('input[type="tel"]').first();
  if (await tel.count()) await tel.fill("90112233");
  await page.locator("button", { hasText: "Encaisser la vente" }).first().click(); await attendre(250);
  let q = await dialogue(page);
  if (/pas de numéro/i.test(q)) { await bouton(page, "Continuer"); q = await dialogue(page); }
  test("★★ la confirmation dit « remise libre = −7 200 F », sans pourcentage", /remise libre = −7 200 F/.test(q) && !/remise [\d.,]+ %/.test(q), q);
  await bouton(page, "OK"); await attendre(300);
  const v = await page.evaluate(() => { const x = window.saves[window.saves.length - 1]; return x ? x.n.ventes.find((y) => y.id !== "vD") : null; });
  test("★★ la vente garde remise_mode « montant » et le pourcentage ÉQUIVALENT (7 200 sur 240 000 = 3 %) — c'est lui que lisent la limite des 3 % et le serveur",
    !!v && v.remise_mode === "montant" && Number(v.remise_pct) === 3, JSON.stringify(v && { remise_mode: v.remise_mode, remise_pct: v.remise_pct }));
  await page.close();
}
{
  const { page } = await ouvrir();
  await page.selectOption("[data-remise-generale] [data-mode-remise]", "montant"); await attendre(100);
  await page.fill("[data-remise-generale] [data-remise-montant]", "12000"); await attendre(100);
  const tel = page.locator('input[type="tel"]').first();
  if (await tel.count()) await tel.fill("90112233");
  await page.locator("button", { hasText: "Encaisser la vente" }).first().click(); await attendre(250);
  let q = await dialogue(page);
  if (/pas de numéro/i.test(q)) { await bouton(page, "Continuer"); q = await dialogue(page); }
  // RETOURNÉ le 29/10/2026 : au-delà de la limite, l'écran ne refuse plus net — il propose
  // « 📨 Demander l'autorisation » (securite-44). « Annuler » n'écrit toujours rien.
  const proposeDemande = /demande l'accord d'un administrateur/.test(q) && (await page.locator("button", { hasText: "Demander l'autorisation" }).count()) > 0;
  await bouton(page, "Annuler"); await attendre(200);
  test("★★ une remise LIBRE de 12 000 F sur 240 000 (5 %) par la gérante → arrêtée comme 5 % (au-delà de 3 %) : la question propose de demander l'accord d'un administrateur ; Annuler, rien n'est écrit",
    proposeDemande && (await saves(page)) === 0, q);
  // 🏷 La demande JOUÉE (29/10/2026) : « 📨 Demander l'autorisation », le motif, UNE écriture
  // dans `demandes_remise` de la boutique (jamais `demandes`) ; réencaisser dit « attend la réponse ».
  await page.locator("button", { hasText: "Encaisser la vente" }).first().click(); await attendre(250);
  if (/pas de numéro/i.test(await dialogue(page))) await bouton(page, "Continuer");
  await page.locator("[data-dialogue] button", { hasText: "Demander l'autorisation" }).click(); await attendre(200);
  await page.fill("[data-dialogue] input, [data-dialogue] textarea", "client fidèle"); await bouton(page, "OK"); await attendre(250);
  if (await page.$("[data-dialogue]")) await bouton(page, "OK");
  const dem = await page.evaluate(() => { const x = window.saves[window.saves.length - 1]; const b = x && x.n.boutiques.find((b) => (b.demandes_remise || []).length); return x ? { n: window.saves.length, d: b && b.demandes_remise[0], r: (b && b.demandes || []).length, v: x.n.ventes.length, j: x.journal } : null; });
  await page.locator("button", { hasText: "Encaisser la vente" }).first().click(); await attendre(250);
  if (/pas de numéro/i.test(await dialogue(page))) await bouton(page, "Continuer");
  const q2 = await dialogue(page);
  test("★★ 🏷 la demande JOUÉE : motif, une écriture dans `demandes_remise` (5 %, en attente, motif gardé), aucune vente, rien dans `demandes` ; réencaisser le même panier dit « attend la réponse d'un administrateur »",
    dem && dem.n === 1 && dem.d && dem.d.statut === "en_attente" && dem.d.motif === "client fidèle" && Math.abs(dem.d.remise_pct - 5) < 0.001 && dem.r === 0 && /Remise de 12/.test(dem.j)
    && /attend la réponse d'un administrateur/.test(q2) && (await saves(page)) === 1, JSON.stringify(dem) + " | " + q2);
  await page.close();
}
{
  const { page } = await ouvrir("vendeuse");
  test("★ la vendeuse n'a pas la case « 🏗 Chantier »", !(await page.$("[data-coche-chantier]")) && /Numéro du client/.test(await page.innerText("body")));
  await page.close();
}
await nav.close();
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
