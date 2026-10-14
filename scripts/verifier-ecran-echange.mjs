// ============================================================
// scripts/verifier-ecran-echange.mjs — 🔄 L'ÉCHANGE D'UN ARTICLE, JOUÉ DANS
// CHROMIUM (Timo, 14/10/2026, « A c, B c, C b, D non »)
//
//   npm run verifier-ecran-echange
//
// On monte le VRAI écran 💰 Ventes et sa fenêtre de questions (DialogHost), et
// on clique comme le gérant : 🔄 sur la ligne, la destination, le nouvel
// article choisi en TAPANT son nom, le motif, Enregistrer. On lit ce qui est
// ÉCRIT : une nouvelle vente avec son avoir, l'ancienne qui garde son total,
// l'article rendu au stock ; puis le cas moins cher (BMI rend), le tiroir qui
// ne suffit pas, et la vendeuse qui n'a pas le bouton.
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
const propre = (t) => String(t).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

const dossier = mkdtempSync(join(tmpdir(), "bmi-echange-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Ventes } from "${process.cwd()}/src/screens/Ventes.jsx";
import { DialogHost, PrintHost } from "${process.cwd()}/src/components/ui.jsx";
const quoi = location.hash.slice(1);
const gerant = { id: "g1", nom: "AFI", role: "gerant", boutique: "BMI DEMAKPOE", actif: true };
const vendeuse = { id: "v1", nom: "ANGELE", role: "vendeur", boutique: "BMI DEMAKPOE", actif: true };
const paiement = quoi === "mixx" ? "Mobile Money (Mixx/T-Money)" : "Espèces";
const depart = {
  boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", prefixe: "BMID", formation: false }],
  users: [gerant, vendeuse],
  produits: [
    { id: "p1", nom: "Panneau 550W", boutique: "BMI DEMAKPOE", prix_achat: 60000, prix_vente: 80000, initial: 10, seuil: 1 },
    { id: "p2", nom: "Onduleur 3kW", boutique: "BMI DEMAKPOE", prix_achat: 90000, prix_vente: 120000, initial: 2, seuil: 1 },
    { id: "p3", nom: "Regulateur 30A", boutique: "BMI DEMAKPOE", prix_achat: 20000, prix_vente: 30000, initial: 5, seuil: 1 },
  ],
  ventes: [{ id: "vA", numero: "BMID-2026-0040", date: "2026-10-01", heure: "10:00", boutique: "BMI DEMAKPOE", paiement, client: "Kossi MENSAH", tel: "90112233", par: "ANGELE",
    articles: [{ produit_id: "p1", article: "Panneau 550W", qte: 2, pu: 80000 }] }],
  dettes: [], clients_installes: [], depenses: [], ajustements: [], entrees: [], commandes: [], proformas: [], messages: [], prospects: [], audits: [], clotures: [],
};
window.saves = [];
function Essai() {
  const [db, setDb] = useState(depart);
  const save = (next, journal) => { const n = typeof next === "function" ? next(db) : next; window.saves.push({ n, journal }); setDb(n); };
  return <><Ventes db={db} save={save} profile={quoi === "vendeuse" ? vendeuse : gerant} /><DialogHost /><PrintHost /></>;
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
  const page = await nav.newPage({ viewport: { width: 1300, height: 1000 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
  await page.goto(`file://${html}#${quoi}`);
  await attendre(500);
  return { page, erreurs };
};
const dialogue = async (page) => propre(await page.$eval("[data-dialogue]", (e) => e.innerText).catch(() => ""));
const bouton = async (page, texte) => { await page.locator("[data-dialogue-boutons] button", { hasText: texte }).click(); await attendre(250); };
const remplir = async (page, { article, destination = "stock", motif = "préfère un autre modèle" }) => {
  await page.click("[data-bouton-echange]"); await attendre(200);
  await page.selectOption("[data-echange-destination]", destination); await attendre(100);
  const champ = page.locator("[data-echange-nouveau] input").first();
  await champ.click(); await champ.fill(article.slice(0, 4)); await attendre(200);
  await page.locator("body > div.fixed button", { hasText: article }).first().click(); await attendre(150);
  await page.locator("[data-fenetre-echange] input[placeholder^='Ex : le client préfère']").fill(motif); await attendre(100);
};

console.log("\n🔄 L'échange d'un article, joué dans Chromium");
{
  const { page, erreurs } = await ouvrir("");
  test("le gérant voit « 🔄 » sur la ligne de la vente", (await page.locator("[data-bouton-echange]").count()) === 1);
  await remplir(page, { article: "Onduleur 3kW" });
  const apercu = propre(await page.innerText("[data-echange-apercu]"));
  test("★ l'aperçu dit : valeur rendue 80 000, nouvel article 120 000, le client paie 40 000", /Valeur rendue .*80 000 F/.test(apercu) && /Nouvel article .*120 000 F/.test(apercu) && /Le client paie : 40 000 F/.test(apercu), apercu);
  await page.locator("[data-fenetre-echange] button", { hasText: "Enregistrer l’échange".replace("’", "'") }).click(); await attendre(300);
  const q = await dialogue(page);
  test("★ la confirmation dit ce qui est rendu, au stock, ce qui est emporté, et la différence payée", /Panneau 550W — valeur 80 000 F/.test(q) && /au stock de BMI DEMAKPOE/.test(q) && /Onduleur 3kW — 120 000 F/.test(q) && /Le client paie la différence : 40 000 F \(Espèces\)/.test(q) && /nouveau reçu/.test(q), q);
  await bouton(page, "OK"); await attendre(300);
  const fin = await dialogue(page);
  test("après l'échange, on propose d'imprimer le reçu de l'échange", /Échange ECH-.* enregistré\. Nouveau reçu : BMID-2026-0041/.test(fin), fin);
  await bouton(page, "Annuler"); await attendre(200);
  const s = await page.evaluate(() => window.saves.map((x) => x.n));
  const n = s[s.length - 1] || {};
  const nv = (n.ventes || []).find((v) => v.id !== "vA") || {};
  const ancienne = (n.ventes || []).find((v) => v.id === "vA") || {};
  test("★★ ÉCRIT : une nouvelle vente BMID-2026-0041 (Onduleur, avoir 80 000, échange du reçu 0040) ; l'ancienne garde ses lignes et note la ligne d'échange ; l'article rendu revient au stock (echange_client +1) ; aucune dépense",
    s.length === 1 && nv.numero === "BMID-2026-0041" && nv.avoir_echange === 80000 && nv.echange_de?.numero === "BMID-2026-0040" && nv.articles?.[0]?.article === "Onduleur 3kW"
    && ancienne.articles?.length === 1 && ancienne.reprises?.[0]?.echange === true && ancienne.reprises?.[0]?.rembourse === 0
    && (n.ajustements || []).length === 1 && n.ajustements[0].type === "echange_client" && n.ajustements[0].qte === 1 && (n.depenses || []).length === 0, JSON.stringify({ nv, aj: n.ajustements }));
  await attendre(200);
  const ligneNv = propre(await page.locator("tr", { hasText: "🔄 avoir BMID-2026-0040" }).first().innerText());
  const ligneA = propre(await page.locator("tr", { hasText: "🔄 article rendu" }).first().innerText());
  // RETOURNÉ le 14/10/2026 (Timo : « l'échange a rendu 45 000… pourquoi −110 000 ? ») : l'ancienne
  // ligne ne dit plus « échangé : −X / reste : 0 » mais OÙ est partie la valeur de l'article rendu.
  test("★ la liste dit « 🔄 avoir BMID-2026-0040 : −80 000 » et « payé : 40 000 » sur la nouvelle vente ; sur l'ancienne « article rendu : 80 000 », « → nouveau reçu BMID-2026-0041 : 120 000 », « payé en plus : 40 000 » — et plus de « reste : 0 »",
    /🔄 avoir BMID-2026-0040 : −80 000 F/.test(ligneNv) && /payé : 40 000 F/.test(ligneNv) && /🔄 article rendu : 80 000 F/.test(ligneA)
    && /→ nouveau reçu BMID-2026-0041 : 120 000 F/.test(ligneA) && /payé en plus : 40 000 F/.test(ligneA) && !/reste :/.test(ligneA) && !/échangé : −/.test(ligneA), `${ligneNv} || ${ligneA}`);
  // « il faut griser cette ligne… elle n'est pas une vente du jour J » (Timo, 14/10/2026) : la vente
  // NÉE de l'échange se grise (fond gris, textes gris) ; l'ancienne, non.
  // (la page n'a pas le CSS construit : on lit les classes que la règle commune pose)
  const fond = async (texte) => page.locator("tr", { hasText: texte }).first().evaluate((tr) => tr.outerHTML.includes("bg-slate-200") && tr.outerHTML.includes("text-slate-500!") ? "gris" : "normal");
  const fondNv = await fond("🔄 avoir BMID-2026-0040"), fondA = await fond("🔄 article rendu");
  test("★ la ligne de la vente née de l'échange est GRISÉE (fond gris), celle d'origine ne l'est pas", fondNv === "gris" && fondA === "normal", `${fondNv} / ${fondA}`);
  // « a » (Timo, 14/10/2026) : « si le client ajoute l'argent, c'est en ce moment ça rentre dans les
  // ventes du jour… sinon on va nous dire qu'on a vendu » — la vente née de l'échange ne compte que le
  // complément, dans « Aujourd'hui » ET dans la Recette ; l'avoir est dit à côté.
  const jour1 = propre(await page.locator("span", { hasText: "Aujourd'hui :" }).first().innerText());
  const recette1 = propre(await page.locator("span", { hasText: "💰 Recette" }).first().innerText());
  test("★★ plus cher : « Aujourd'hui : 40 000 » (le complément payé, pas 120 000), avoir de 80 000 dit à côté ; Recette 160 000 + 40 000 = 200 000, l'avoir non compté dit, pas de « net »",
    /Aujourd'hui : 40 000 F \(🔄 échange : 80 000 F d'avoir non compté\)/.test(jour1)
    && /💰 Recette : 200 000 F/.test(recette1) && /🔄 échanges : 80 000 F d'avoir non compté/.test(recette1) && !/net/.test(recette1), `${jour1} || ${recette1}`);
  // « le bon d'échange n'est plus visible à télécharger » : 🧾 sur l'ancienne ligne ET sur la nouvelle.
  const trA = page.locator("tr", { hasText: "🔄 article rendu" }).first();
  const trN = page.locator("tr", { hasText: "🔄 avoir BMID-2026-0040" }).first();
  test("★ 🧾 sur l'ancienne ligne ET sur la nouvelle (le reçu de l'échange se retrouve)", (await trA.locator('button[aria-label="Bons"]').count()) === 1 && (await trN.locator('button[aria-label="Bons"]').count()) === 1);
  await trA.locator('button[aria-label="Bons"]').click(); await attendre(400);
  const apercu1 = propre(await page.innerText("#zone-impression").catch(() => ""));
  test("★ 🧾 de l'ancienne ligne ouvre le REÇU DE L'ÉCHANGE (nouveau reçu 0041 : « Échange du reçu n° BMID-2026-0040 », l'article rendu, payé par le client)",
    /BMID-2026-0041/.test(apercu1) && /Échange du reçu n° BMID-2026-0040/.test(apercu1) && /Panneau 550W/.test(apercu1) && /PAYÉ PAR LE CLIENT/i.test(apercu1), apercu1.slice(0, 400));
  test("aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
  await page.close();
}
{
  const { page, erreurs } = await ouvrir("");
  await remplir(page, { article: "Regulateur 30A", destination: "sav", motif: "ne fonctionne pas" });
  const apercu = propre(await page.innerText("[data-echange-apercu]"));
  test("★ moins cher : l'aperçu dit « BMI rend au client : 50 000 »", /BMI rend au client : 50 000 F/.test(apercu), apercu);
  await page.locator("[data-fenetre-echange] button", { hasText: "Enregistrer l’échange".replace("’", "'") }).click(); await attendre(300);
  const q = await dialogue(page);
  test("★ la confirmation dit : au stock SAV, et BMI rend 50 000 de la caisse", /au stock SAV/.test(q) && /BMI rend la différence au client : 50 000 F \(Espèces\)/.test(q), q);
  await bouton(page, "OK"); await bouton(page, "Annuler");
  const n = await page.evaluate(() => window.saves[window.saves.length - 1]?.n || {});
  test("★★ ÉCRIT : l'article rendu au SAV (retour_defectueux, en_sav), une sortie « Rendu sur échange » de 50 000 en espèces, la nouvelle vente avec un avoir de 30 000",
    (n.ajustements || [])[0]?.type === "retour_defectueux" && n.ajustements[0].qte === 0 && n.ajustements[0].qte_sav === 1
    && (n.depenses || [])[0]?.categorie === "Rendu sur échange" && n.depenses[0].montant === 50000 && n.depenses[0].paiement === "Espèces"
    && (n.ventes || []).find((v) => v.id !== "vA")?.avoir_echange === 30000, JSON.stringify(n.depenses));
  await attendre(200);
  const ligneA2 = propre(await page.locator("tr", { hasText: "🔄 article rendu" }).first().innerText());
  const jour2 = propre(await page.locator("span", { hasText: "Aujourd'hui :" }).first().innerText());
  const recette2 = propre(await page.locator("span", { hasText: "💰 Recette" }).first().innerText());
  test("★★ moins cher : « Aujourd'hui : 0 » (BMI a RENDU de l'argent : rien de vendu), avoir de 30 000 dit ; Recette 160 000, dont 50 000 rendu sur échange, net 110 000 (= la caisse : 160 000 − 50 000)",
    /Aujourd'hui : 0 F \(🔄 échange : 30 000 F d'avoir non compté\)/.test(jour2)
    && /💰 Recette : 160 000 F/.test(recette2) && /🔄 échanges : 30 000 F d'avoir non compté/.test(recette2) && /dont 50 000 F rendu sur échange, net 110 000 F/.test(recette2), `${jour2} || ${recette2}`);
  test("★ moins cher : l'ancienne ligne dit « article rendu : 80 000 », « → nouveau reçu BMID-2026-0041 : 30 000 », « rendu au client : 50 000 » (80 000 = 30 000 + 50 000)",
    /article rendu : 80 000 F/.test(ligneA2) && /→ nouveau reçu BMID-2026-0041 : 30 000 F/.test(ligneA2) && /rendu au client : 50 000 F/.test(ligneA2) && !/reste :/.test(ligneA2), ligneA2);
  test("aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
  await page.close();
}
{
  // Payée par Mixx : le tiroir est vide, rendre 50 000 en espèces est refusé.
  const { page } = await ouvrir("mixx");
  await remplir(page, { article: "Regulateur 30A" });
  await page.selectOption("[data-fenetre-echange] select >> nth=1", "Espèces").catch(() => {});
  await page.locator("[data-fenetre-echange] button", { hasText: "Enregistrer l’échange".replace("’", "'") }).click(); await attendre(300);
  const q = await dialogue(page);
  test("★ le tiroir ne suffit pas : rendre 50 000 en espèces est refusé, en le disant (un autre moyen, ou plus tard) — rien n'est écrit",
    /dépasse ce qu'il y a dans le tiroir/.test(q) && /un autre moyen/.test(q) && (await page.evaluate(() => window.saves.length)) === 0, q);
  await page.close();
}
{
  const { page } = await ouvrir("vendeuse");
  test("★ « C b » : la vendeuse n'a pas le bouton 🔄", (await page.locator("[data-bouton-echange]").count()) === 0);
  await page.close();
}
await nav.close();
console.log(ko === 0 ? `\n✅  ${ok} vérification(s) passée(s), 0 en échec.` : `\n❌  ${ko} vérification(s) EN ÉCHEC sur ${ok + ko}.`);
process.exit(ko === 0 ? 0 : 1);
