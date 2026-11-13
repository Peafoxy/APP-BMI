// ============================================================
// scripts/verifier-ecran-proforma.mjs — ✏️ LA PROFORMA MODIFIÉE, RENVOYÉE AU
// CLIENT AVEC SON PDF, JOUÉE DANS CHROMIUM (Timo, 13/11/2026 : « Proforma
// modifié… un modèle de message à renvoyer au client avec pdf » → « A a,
// C oui, texte ok, lance »)
//
//   npm run verifier-ecran-proforma
//
// On monte le VRAI écran 💰 Ventes et sa fenêtre de questions (DialogHost), le
// numéro BMI JOUÉ (un faux `supabaseClient` qui note chaque envoi et peut en
// refuser un), et on clique comme la gérante : 🧾 Proformas → ✏️ Modifier, un
// article de plus (code-barres), « 💾 Enregistrer la proforma modifiée » →
// « Renvoyer… avec son PDF ? » → OK. On lit ce qui PART (le modèle, ses trous,
// le PDF joint) et ce qui est ÉCRIT (la proforma garde son numéro et sa date
// d'origine, sa modification notée ; la ligne de 📲 WhatsApp et son relais).
// Puis : Meta qui n'a pas encore approuvé le nouveau modèle (la proforma part
// quand même, par le message habituel, et l'écran le DIT) ; « Annuler » qui
// n'envoie rien ; une proforma sans numéro (aucune question) ; et 🧾 Proforma
// WhatsApp pendant la modification (le même message).
// ============================================================
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
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

const dossier = mkdtempSync(join(tmpdir(), "bmi-proforma-"));
// Le numéro BMI JOUÉ : chaque appel est noté ; `window.refus[modele]` le refuse
// comme le ferait WhatsApp (modèle pas encore approuvé…).
const fauxClient = join(dossier, "fauxClient.js");
writeFileSync(fauxClient, `
export async function whatsappEnLigne(c) {
  const e = { modele: c.modele, variables: c.variables, pdf: !!(c.fichier && c.fichier.donnees), nom: c.fichier ? c.fichier.nom : "", mime: c.fichier ? c.fichier.mime : "" };
  (window.envois = window.envois || []).push(e);
  const r = (window.refus || {})[c.modele];
  if (r) return r;
  return { id: "Y" + window.envois.length, wamid: "W" + window.envois.length };
}
export async function abonnerPushEnLigne() { return { ok: false }; }
export async function notifierEnLigne() { return { ok: false }; }
`);
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Ventes } from "${process.cwd()}/src/screens/Ventes.jsx";
import { DialogHost, PrintHost } from "${process.cwd()}/src/components/ui.jsx";
const quoi = location.hash.slice(1);
if (quoi === "refus") window.refus = { proforma_modifiee_pdf: { error: "(#132001) Template name does not exist in the translation", statut: 502, code_whatsapp: 132001 } };
const gerante = { id: "g1", nom: "AFI", role: "gerant", boutique: "BMI DEMAKPOE", actif: true };
const depart = {
  boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", prefixe: "BMID", formation: false, tel: "+228 91 00 00 00" }],
  users: [gerante],
  produits: [
    { id: "p1", nom: "Panneau 550W", boutique: "BMI DEMAKPOE", prix_achat: 60000, prix_vente: 80000, initial: 10, seuil: 1 },
    { id: "p2", nom: "Onduleur 3kW", boutique: "BMI DEMAKPOE", prix_achat: 90000, prix_vente: 120000, initial: 5, seuil: 1, code: "ONDUL3" },
  ],
  proformas: [{ id: "pf1", numero: "PRF-ABC123", date: "2026-11-10", ts: "2026-11-10T09:00:00.000Z", boutique: "BMI DEMAKPOE",
    client: "KOFFI", tel: quoi === "sansnum" ? "" : "90112233",
    lignes: [{ produit_id: "p1", article: "Panneau 550W", qte: 2, pu: 80000, remise_ligne: 0, total: 160000 }],
    sous_total: 160000, remise_pct: 0, remise_montant: 0, total: 160000, par: "AFI", par_id: "g1" }],
  ventes: [], dettes: [], clients_installes: [], depenses: [], ajustements: [], entrees: [], commandes: [], messages: [], prospects: [], audits: [], clotures: [],
};
window.saves = [];
function Essai() {
  const [db, setDb] = useState(depart);
  const save = (next, journal) => { setDb((avant) => { const n = typeof next === "function" ? next(avant) : next; window.saves.push({ n, journal }); window.etat = n; return n; }); };
  return <><Ventes db={db} save={save} profile={gerante} /><DialogHost /><PrintHost /></>;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic",
  nodePaths: [join(process.cwd(), "node_modules")],
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": '{"VITE_SUPABASE_URL":"https://exemple.supabase.co","VITE_SUPABASE_ANON_KEY":"x","MODE":"test"}' },
  plugins: [{ name: "faux-client", setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: fauxClient })); } }] });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ouvrir = async (quoi = "") => {
  const contexteNav = await nav.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
  const page = await contexteNav.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
  await page.goto(`file://${html}#${quoi}`);
  await attendre(500);
  return { page, erreurs, fermer: () => contexteNav.close() };
};
const dialogue = async (page) => propre(await page.$eval("[data-dialogue]", (e) => e.innerText).catch(() => ""));
const bouton = async (page, texte) => { await page.locator("[data-dialogue-boutons] button", { hasText: texte }).first().click(); await attendre(300); };
// 🧾 Proformas → ✏️ Modifier, puis un article de plus (le code-barres de l'onduleur).
const modifier = async (page) => {
  await page.locator("button", { hasText: "🧾 Proformas (" }).first().click(); await attendre(200);
  await page.click("[data-modifier-proforma]"); await attendre(300);
  const champ = page.locator("input[placeholder='Scannez ou tapez, puis Entrée…']");
  await champ.fill("ONDUL3"); await champ.press("Enter"); await attendre(300);
};
// 🧹 Le panier affiché : « 🛒 Panier (N article…) » ; absent = vide.
const panierAffiche = async (page) => { const t = propre(await page.locator("text=/🛒 Panier \\(/").first().innerText().catch(() => "")); return /\(0 article\)/.test(t) ? "" : t; };
const etat = (page) => page.evaluate(() => ({ envois: window.envois || [], db: window.etat || null, saves: (window.saves || []).length }));
const aujourdhui = new Date().toISOString().slice(0, 10).split("-").reverse().join("/");

console.log("\n✏️ La proforma modifiée renvoyée avec son PDF, jouée dans Chromium");
// ── 1. « 💾 Enregistrer la proforma modifiée » → « Renvoyer… ? » → OK : `proforma_modifiee_pdf`.
{
  const { page, erreurs, fermer } = await ouvrir("");
  await modifier(page);
  test("✏️ Modifier remplit le panier et le bandeau dit que la proforma garde son numéro ET sa date, et qu'elle pourra être renvoyée",
    /garde son numéro et sa date/.test(propre(await page.innerText("[data-proforma-en-modif]").catch(() => ""))) && /renvoyée au client avec son PDF/.test(propre(await page.innerText("[data-proforma-en-modif]").catch(() => ""))));
  await page.click("[data-enregistrer-proforma-modifiee]"); await attendre(400);
  const q = await dialogue(page);
  const avant = await etat(page);
  test("★★ « A a » : la proforma est ENREGISTRÉE d'abord, PUIS une question : « Renvoyer la proforma modifiée à KOFFI (90112233) du numéro WhatsApp BMI, avec son PDF ? » — rien n'est encore parti",
    /Proforma N° PRF-ABC123 modifiée \(même numéro\)/.test(q) && /Renvoyer la proforma modifiée à KOFFI \(90112233\) du numéro WhatsApp BMI, avec son PDF \?/.test(q)
    && /Annuler : elle reste enregistrée, rien n'est envoyé au client/.test(q) && avant.envois.length === 0 && avant.saves === 1, q);
  const pf = (avant.db?.proformas || [])[0] || {};
  test("★★ « C oui » : la proforma RANGÉE garde son id, son numéro et sa date d'origine (2026-11-10), le nouveau total (280 000), et sa modification notée",
    pf.id === "pf1" && pf.numero === "PRF-ABC123" && pf.date === "2026-11-10" && pf.total === 280000 && !!pf.modifie_le && pf.nb_modifications === 1 && pf.historique_modif?.length === 1 && pf.par === "AFI",
    JSON.stringify({ id: pf.id, numero: pf.numero, date: pf.date, total: pf.total, modifie_le: pf.modifie_le, nb: pf.nb_modifications }));
  await bouton(page, "OK"); await attendre(600);
  const fin = await dialogue(page);
  const apres = await etat(page);
  const e0 = apres.envois[0] || {};
  test("★★★ UN envoi, du numéro BMI : `proforma_modifiee_pdf`, son PDF joint, ses cinq trous — KOFFI, PRF-ABC123, le jour de la MODIFICATION, le NOUVEAU montant, la fin de l'offre (modification + 15 jours)",
    apres.envois.length === 1 && e0.modele === "proforma_modifiee_pdf" && e0.pdf === true && e0.mime === "application/pdf" && /^Proforma - KOFFI - PRF-ABC123/.test(e0.nom)
    && e0.variables?.[0] === "KOFFI" && e0.variables?.[1] === "PRF-ABC123" && e0.variables?.[2] === aujourdhui && /^280\s000 F$/.test(propre(e0.variables?.[3] || "")) && /^\d{2}\/\d{2}\/2026|^\d{2}\/\d{2}\/2027/.test(e0.variables?.[4] || ""),
    JSON.stringify(apres.envois));
  test("★ la fenêtre de fin dit « Proforma modifiée N° PRF-ABC123 renvoyée du numéro BMI à KOFFI, avec son PDF »",
    /Proforma modifiée N° PRF-ABC123 renvoyée du numéro BMI à KOFFI, avec son PDF\./.test(fin), fin);
  const ligne = (apres.db?.messages || []).find((m) => m.wa_modele === "proforma_modifiee_pdf") || {};
  test("★★ la ligne entre dans 📲 WhatsApp (« … modifiée le …, renvoyée à KOFFI, 📎 PDF joint »), SANS propriétaire, et garde le message `proforma` pour le relais — sa date dit « du 10/11/2026, modifiée le … »",
    /Proforma N° PRF-ABC123 modifiée le .* renvoyée à KOFFI, 📎 PDF joint\./.test(ligne.texte || "") && !ligne.proprietaire_id
    && ligne.wa_relais_texte?.modele === "proforma" && ligne.wa_relais_texte.variables?.[2] === `10/11/2026, modifiée le ${aujourdhui}`
    && ligne.wa_envoi_id === "Y1", JSON.stringify(ligne));
  test("aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
  await fermer();
}
// ── 2. Meta n'a pas encore approuvé `proforma_modifiee_pdf` : la proforma part quand même, et l'écran le DIT.
{
  const { page, erreurs, fermer } = await ouvrir("refus");
  await modifier(page);
  await page.click("[data-enregistrer-proforma-modifiee]"); await attendre(400);
  await bouton(page, "OK"); await attendre(700);
  const fin = await dialogue(page);
  const s = await etat(page);
  test("★★★ refusé : le message habituel `proforma_pdf` part ENSUITE, avec le MÊME PDF, et sa date dit « du 10/11/2026, modifiée le … » (deux appels, dans cet ordre)",
    s.envois.map((x) => x.modele).join(",") === "proforma_modifiee_pdf,proforma_pdf" && s.envois[1].pdf === true && s.envois[1].nom === s.envois[0].nom
    && s.envois[1].variables?.[2] === `10/11/2026, modifiée le ${aujourdhui}`, JSON.stringify(s.envois.map((x) => [x.modele, x.variables?.[2]])));
  test("★★ la fenêtre le DIT : renvoyée avec son PDF, « le message « proforma modifiée » n'est pas parti (…) : la proforma est partie avec le message habituel. Son PDF dit bien « Modifiée le … » »",
    /renvoyée du numéro BMI à KOFFI, avec son PDF\./.test(fin) && /Le message « proforma modifiée » n'est pas parti/.test(fin) && /la proforma est partie avec le message habituel/.test(fin) && new RegExp(`Modifiée le ${aujourdhui.replace(/\//g, "\\/")}`).test(fin), fin);
  test("★ la ligne de 📲 WhatsApp est celle de `proforma_pdf` (le message vraiment parti)",
    (s.db?.messages || []).some((m) => m.wa_modele === "proforma_pdf") && !(s.db?.messages || []).some((m) => m.wa_modele === "proforma_modifiee_pdf"));
  test("aucune erreur dans la page (refus)", erreurs.length === 0, erreurs.join(" | "));
  await fermer();
}
// ── 3. « Annuler » à la question : enregistrée, RIEN n'est envoyé.
{
  const { page, erreurs, fermer } = await ouvrir("");
  await modifier(page);
  await page.click("[data-enregistrer-proforma-modifiee]"); await attendre(400);
  await bouton(page, "Annuler"); await attendre(400);
  const s = await etat(page);
  const msg = propre(await page.locator("span.text-red-600", { hasText: "PRF-ABC123" }).first().innerText().catch(() => ""));
  test("★★ « Annuler » : la modification est enregistrée (total 280 000), AUCUN envoi, et l'écran dit comment la remettre sur papier",
    s.envois.length === 0 && (s.db?.proformas || [])[0]?.total === 280000 && /Rien n'est envoyé au client/.test(msg) && /🖨️ Réimprimer/.test(msg), `${s.envois.length} | ${msg}`);
  test("★★ 🧹 « a » : la proforma enregistrée, le panier, le client et le numéro sont VIDÉS (prêt pour le client suivant), et le bandeau de modification a disparu",
    (await panierAffiche(page)) === "" && (await page.locator("input[placeholder='+228 ...']").first().inputValue().catch(() => "x")) === "" && (await page.locator("[data-proforma-en-modif]").count()) === 0,
    `${await panierAffiche(page)} | ${await page.locator("input[placeholder='+228 ...']").first().inputValue().catch(() => "?")}`);
  test("aucune erreur dans la page (annuler)", erreurs.length === 0, erreurs.join(" | "));
  await fermer();
}
// ── 4. Sans numéro : aucune question (rien ne partirait du numéro BMI), l'écran le dit.
{
  const { page, erreurs, fermer } = await ouvrir("sansnum");
  await modifier(page);
  await page.click("[data-enregistrer-proforma-modifiee]"); await attendre(400);
  const q = await dialogue(page);
  const s = await etat(page);
  const msg = propre(await page.locator("span.text-red-600", { hasText: "PRF-ABC123" }).first().innerText().catch(() => ""));
  test("★ sans numéro : enregistrée, AUCUNE question, aucun envoi, « Aucun numéro sur cette proforma : rien n'est renvoyé au client »",
    q === "" && s.envois.length === 0 && (s.db?.proformas || [])[0]?.total === 280000 && /Aucun numéro sur cette proforma : rien n'est renvoyé au client/.test(msg), `${q} | ${msg}`);
  test("aucune erreur dans la page (sans numéro)", erreurs.length === 0, erreurs.join(" | "));
  await fermer();
}
// ── 5. 🧾 Proforma WhatsApp PENDANT la modification : enregistre, puis LE MÊME message.
{
  const { page, erreurs, fermer } = await ouvrir("");
  await modifier(page);
  await page.locator("button", { hasText: "🧾 Proforma WhatsApp" }).first().click(); await attendre(600);
  const q = await dialogue(page);
  test("★★ 🧾 pendant la modification : enregistrée et le PDF prêt, puis la question « Renvoyer la proforma modifiée N° PRF-ABC123 à KOFFI (90112233) du numéro WhatsApp BMI, avec son PDF ? »",
    /Renvoyer la proforma modifiée N° PRF-ABC123 à KOFFI \(90112233\) du numéro WhatsApp BMI, avec son PDF \?/.test(q) && /Le PDF est déjà téléchargé sur l'appareil/.test(q), q);
  await bouton(page, "OK"); await attendre(600);
  const s = await etat(page);
  test("★★★ …puis `proforma_modifiee_pdf`, avec son PDF, et la proforma garde sa date d'origine",
    s.envois.length === 1 && s.envois[0].modele === "proforma_modifiee_pdf" && s.envois[0].pdf === true && (s.db?.proformas || [])[0]?.date === "2026-11-10", JSON.stringify(s.envois.map((x) => x.modele)));
  test("aucune erreur dans la page (🧾)", erreurs.length === 0, erreurs.join(" | "));
  await fermer();
}
// ── 6. Une proforma NEUVE ne change pas : « Envoyer la proforma… », `proforma_pdf`.
{
  const { page, erreurs, fermer } = await ouvrir("");
  const champ = page.locator("input[placeholder='Scannez ou tapez, puis Entrée…']");
  await champ.fill("ONDUL3"); await champ.press("Enter"); await attendre(300);
  // Le client de la proforma neuve : son nom, puis son numéro (les deux champs à suggestions).
  await page.locator("input[placeholder='Nom, ou numéro du client']").first().fill("AMA"); await attendre(100);
  await page.locator("input[placeholder='+228 ...']").first().fill("90445566"); await attendre(100);
  await page.mouse.click(5, 5); await attendre(150);
  await page.locator("button", { hasText: "🧾 Proforma WhatsApp" }).first().click(); await attendre(600);
  const q = await dialogue(page);
  if (/Envoyer la proforma/.test(q)) { await bouton(page, "OK"); await attendre(600); }
  const s = await etat(page);
  test("★ une proforma NEUVE : « Envoyer la proforma N° … » (pas « renvoyer »), puis `proforma_pdf` seul — rien ne dit « modifiée »",
    /Envoyer la proforma N° PRF-/.test(q) && !/modifiée/.test(q) && s.envois.length === 1 && s.envois[0].modele === "proforma_pdf" && !/modifiée/.test(s.envois[0].variables?.[2] || ""),
    `${q} | ${JSON.stringify(s.envois.map((x) => [x.modele, x.variables?.[2]]))}`);
  test("★★ 🧹 une proforma NEUVE envoyée vide aussi le panier et le client ; un second clic sur 🧾 ne fabrique PAS une seconde proforma (« Ajoutez au moins un article »)",
    await (async () => {
      const vide = (await panierAffiche(page)) === "" && (await page.locator("input[placeholder='+228 ...']").first().inputValue().catch(() => "x")) === "";
      if (await page.locator("[data-dialogue-boutons] button").count()) { await page.locator("[data-dialogue-boutons] button").last().click(); await attendre(300); }
      await page.locator("button", { hasText: "🧾 Proforma WhatsApp" }).first().click(); await attendre(400);
      const s2 = await etat(page);
      return vide && (s2.db?.proformas || []).length === (s.db?.proformas || []).length && s2.envois.length === 1;
    })());
  test("aucune erreur dans la page (neuve)", erreurs.length === 0, erreurs.join(" | "));
  await fermer();
}
await nav.close();
try { rmSync(dossier, { recursive: true, force: true }); } catch {}
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
