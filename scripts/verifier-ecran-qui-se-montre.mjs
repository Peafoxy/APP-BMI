// ============================================================
// scripts/verifier-ecran-qui-se-montre.mjs — CE QU'ON OUVRE SE VOIT-IL ?
//
//   npm run verifier-ecran-qui-se-montre
//
// Timo (29/09/2026, capture de 🏠 Clients installés : « lorsqu'on clique sur
// Dossier l'affichage n'est pas visible… si tu es déjà en bas, rien de
// visible » → « a, lance… que ce soit une règle générale pour les écrans :
// tu cliques, l'écran s'affiche »).
//
// Un défilement ne se lit pas dans le code : on MONTE la vraie règle
// (components/ui.jsx) dans Chromium, on descend en bas d'une longue liste,
// on clique, et on MESURE où se trouve le panneau. Un TÉMOIN (le même
// panneau sans la règle) prouve à chaque passage que le défaut existe bien
// sans elle — sinon le contrôle ne prouverait rien.
// Puis on LIT que chaque panneau relevé dans les écrans passe par la règle,
// et qu'aucun écran ne fait défiler la page à sa façon.
// ============================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const lire = (f) => readFileSync(f, "utf8");
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// ─────────────────────────── 1. MESURÉ DANS CHROMIUM
const dossier = mkdtempSync(join(tmpdir(), "bmi-montre-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PanneauQuiSeMontre, useMontrerALOuverture, revenirSurLaLigne, remonterEnHaut, useFilSurSaFin, DialogHost, uChoix, uAlert } from "${process.cwd()}/src/components/ui.jsx";
const LIGNES = Array.from({ length: 60 }, (_, i) => "L" + i);
function Liste({ ouvrir }) {
  return <table><tbody>{LIGNES.map((id) => (
    <tr key={id} data-ligne={id} style={{ height: 40 }}><td>{id}</td>
      <td><button data-ouvrir={id} onClick={() => ouvrir(id)}>Dossier</button></td></tr>
  ))}</tbody></table>;
}
// La forme de 🏠 Clients installés : le panneau AU-DESSUS de la liste.
function AvecCadre() {
  const [o, setO] = useState(null);
  return <div id="avec">
    <div style={{ height: 900 }}>formulaire</div>
    {o && <PanneauQuiSeMontre cle={o} retour={o}><div data-panneau style={{ height: 300, background: "#def" }}>Dossier {o}
      <button data-fermer onClick={() => setO(null)}>Fermer</button></div></PanneauQuiSeMontre>}
    <Liste ouvrir={setO} />
  </div>;
}
function AvecCrochet() {
  const [o, setO] = useState(null);
  const ref = useMontrerALOuverture(o);
  return <div id="crochet">
    <div style={{ height: 900 }}>formulaire</div>
    {o && <div ref={ref} data-panneau style={{ height: 300, background: "#fed" }}>Dossier {o}
      <button data-fermer onClick={() => { setO(null); revenirSurLaLigne(o); }}>Fermer</button></div>}
    <Liste ouvrir={setO} />
  </div>;
}
// TÉMOIN : le même panneau, SANS la règle — c'est le défaut de la capture.
function Temoin() {
  const [o, setO] = useState(null);
  return <div id="temoin">
    <div style={{ height: 900 }}>formulaire</div>
    {o && <div data-panneau style={{ height: 300, background: "#eee" }}>Dossier {o}</div>}
    <Liste ouvrir={setO} />
  </div>;
}
// 💬 Un FIL de messages (📲 WhatsApp, 💬 Messages) : il s'ouvre sur sa FIN.
function Fil({ regle }) {
  const [conv, setConv] = useState(null);
  const [n, setN] = useState(40);
  const boite = useFilSurSaFin(regle ? (conv || "") : "", n);
  const props = regle ? { ref: boite.ref, onScroll: boite.onScroll } : {};
  return <div>
    <button data-conv="A" onClick={() => { setConv("A"); setN(40); }}>A</button>
    <button data-conv="B" onClick={() => { setConv("B"); setN(40); }}>B</button>
    <button data-nouveau onClick={() => setN((x) => x + 1)}>+</button>
    {conv && <div data-fil-boite {...props} style={{ height: 200, overflowY: "auto" }}>
      {Array.from({ length: n }, (_, i) => <div key={i} data-msg={i} style={{ height: 30 }}>{conv} {i}</div>)}
    </div>}
  </div>;
}
window.remonterEnHaut = remonterEnHaut;
// 🪟 La fenêtre commune (uChoix, uAlert…) sur un PETIT écran, avec une longue
// liste — la capture de Timo du 05/10/2026 (« Confier à… »).
window.ouvrirChoix = () => { window.choisi = "en attente"; uChoix("Confier le brouillon « Villa Agoè » (1 595 000 F) à :",
  Array.from({ length: 16 }, (_, i) => "COLLÈGUE " + i + " — Gérant de boutique · BMI DEMAKPOE")).then((r) => { window.choisi = r; }); };
window.ouvrirAlerte = () => { uAlert(Array.from({ length: 60 }, (_, i) => "Ligne " + i + " d'un long message").join(" | ")); };
const quoi = new URLSearchParams(location.search).get("q");
createRoot(document.getElementById("r")).render(quoi === "dialogue" ? <DialogHost /> : quoi === "fil" ? <Fil regle /> : quoi === "filtemoin" ? <Fil /> : quoi === "crochet" ? <AvecCrochet /> : quoi === "temoin" ? <Temoin /> : <AvecCadre />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><div id="r"></div><script src="bundle.js"></script></body></html>`);
// La fenêtre de question se mesure AVEC le vrai CSS construit (sans lui, les
// classes Tailwind ne commandent rien et la mesure ne prouve rien) — comme
// verifier-champs. Un \`npm run build\` doit précéder.
const cssConstruit = (() => { try { return readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0]; } catch { return null; } })();
if (!cssConstruit) { console.log("✗ dist/assets/*.css introuvable : lancez d'abord npm run build"); process.exit(1); }
const htmlDialogue = join(dossier, "dialogue.html");
writeFileSync(htmlDialogue, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${join(process.cwd(), "dist/assets", cssConstruit)}"></head><body style="margin:0"><div id="r"></div><script src="bundle.js"></script></body></html>`);

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await nav.newPage({ viewport: { width: 800, height: 600 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
const hautPanneau = () => page.$eval("[data-panneau]", (e) => e.getBoundingClientRect().top).catch(() => null);
const visible = (y) => y !== null && y >= 0 && y < 600;

const scenario = async (q) => {
  await page.goto(`file://${html}?q=${q}`);
  await attendre(300);
  await page.$eval('[data-ouvrir="L50"]', (b) => b.scrollIntoView({ block: "center" }));
  await attendre(200);
  const avant = await page.evaluate(() => window.scrollY);
  await page.click('[data-ouvrir="L50"]');
  await attendre(1200);
  return { avant, haut: await hautPanneau() };
};

console.log("\nLe témoin : sans la règle, le panneau s'ouvre HORS de l'écran (le défaut de la capture)");
{
  const r = await scenario("temoin");
  test("on est bien descendu dans la liste avant de cliquer", r.avant > 1500, `scrollY = ${r.avant}`);
  test("TÉMOIN : sans la règle, le panneau ouvert n'est PAS à l'écran", !visible(r.haut), `haut du panneau = ${r.haut} px`);
}

console.log("\nPanneauQuiSeMontre : la page vient au panneau, et « Fermer » ramène sur la ligne");
{
  const r = await scenario("cadre");
  test("clic tout en bas de la liste → le panneau est À L'ÉCRAN", visible(r.haut), `haut du panneau = ${r.haut} px`);
  test("… et il n'est pas caché sous la barre du haut (≥ 60 px)", r.haut !== null && r.haut >= 60, `haut = ${r.haut} px`);
  await page.click("[data-fermer]");
  await attendre(1200);
  const y = await page.$eval('[data-ligne="L50"]', (e) => e.getBoundingClientRect().top);
  test("« Fermer » ramène sur la ligne d'où l'on venait", y >= 0 && y < 600, `ligne L50 à ${y} px`);
}

console.log("\nuseMontrerALOuverture + revenirSurLaLigne (la forme de 🏠 Clients installés)");
{
  const r = await scenario("crochet");
  test("clic tout en bas → le panneau est à l'écran", visible(r.haut), `haut = ${r.haut} px`);
  await page.click("[data-fermer]");
  await attendre(1200);
  const y = await page.$eval('[data-ligne="L50"]', (e) => e.getBoundingClientRect().top);
  test("« Fermer » ramène sur la ligne", y >= 0 && y < 600, `ligne L50 à ${y} px`);
}

console.log("\nremonterEnHaut : un autre écran s'affiche depuis son haut");
{
  await page.goto(`file://${html}?q=temoin`);
  await attendre(200);
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.evaluate(() => window.remonterEnHaut());
  await attendre(300);
  test("la page repart en haut", (await page.evaluate(() => window.scrollY)) === 0);
}
console.log("\nUn fil de messages s'ouvre sur sa FIN (Timo, 02/10/2026 : « elle affiche le début, jamais la fin »)");
{
  const dernierVisible = async () => page.$eval("[data-fil-boite]", (b) => {
    const r = b.getBoundingClientRect(); const d = b.querySelector("[data-msg]:last-child").getBoundingClientRect();
    return d.bottom <= r.bottom + 1 && d.top >= r.top - 1;
  });
  const enHaut = async () => page.$eval("[data-fil-boite]", (b) => b.scrollTop);
  await page.goto(`file://${html}?q=filtemoin`); await attendre(200);
  await page.click('[data-conv="A"]'); await attendre(400);
  test("TÉMOIN : sans la règle, le fil s'ouvre sur son DÉBUT (le dernier message est caché)", !(await dernierVisible()) && (await enHaut()) === 0);
  await page.goto(`file://${html}?q=fil`); await attendre(200);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.click('[data-conv="A"]'); await attendre(400);
  test("ouvrir une conversation → le DERNIER message est à l'écran", await dernierVisible());
  test("… et c'est la BOÎTE qui défile, jamais la page", (await page.evaluate(() => window.scrollY)) === y0);
  await page.click("[data-nouveau]"); await attendre(200);
  test("un nouveau message arrive pendant qu'on est en bas → on le voit", await dernierVisible());
  await page.$eval("[data-fil-boite]", (b) => { b.scrollTop = 0; b.dispatchEvent(new Event("scroll")); }); await attendre(100);
  await page.click("[data-nouveau]"); await attendre(200);
  test("… mais si l'on relit plus haut, un nouveau message ne tire pas vers le bas", (await enHaut()) === 0);
  await page.click('[data-conv="B"]'); await attendre(400);
  test("ouvrir une AUTRE conversation → elle aussi s'ouvre sur sa fin", await dernierVisible());
}
console.log("\n🪟 La fenêtre de question ne dépasse jamais l'écran (capture Timo, 05/10/2026 : « impossible de dérouler et annuler pour les petits écrans »)");
{
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto(`file://${htmlDialogue}?q=dialogue`); await attendre(200);
  await page.evaluate(() => window.ouvrirChoix()); await attendre(300);
  // Les mesures cherchent les BOUTONS par leur texte (pas seulement par nos
  // marques) : remettre l'ancienne fenêtre doit donner un ✗ lisible, pas un
  // banc qui s'arrête.
  const boutonVisible = (texte) => page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
    if (!b) return { ok: false, detail: "bouton absent" };
    const r = b.getBoundingClientRect();
    return { ok: r.top >= 0 && r.bottom <= innerHeight, detail: `${t} à ${Math.round(r.top)} → ${Math.round(r.bottom)} px, écran ${innerHeight} px` };
  }, texte);
  const carte = await page.evaluate(() => {
    const c = document.querySelector(".fixed.inset-0 > div");
    if (!c) return { ok: false, detail: "fenêtre absente" };
    const r = c.getBoundingClientRect();
    return { ok: r.top >= 0 && r.bottom <= innerHeight, detail: `fenêtre de ${Math.round(r.top)} à ${Math.round(r.bottom)} px, écran ${innerHeight} px` };
  });
  test("une longue liste de choix sur un téléphone : la fenêtre tient dans l'écran", carte.ok, carte.detail);
  const ann = await boutonVisible("Annuler");
  test("… et « Annuler » est À L'ÉCRAN, sans rien faire défiler", ann.ok, ann.detail);
  const derniere = await page.evaluate(() => {
    const c = document.querySelector("[data-dialogue-contenu]");
    if (!c) return false;
    c.scrollTop = c.scrollHeight;
    const b = [...c.querySelectorAll("button")].pop().getBoundingClientRect(); const r = c.getBoundingClientRect();
    return b.bottom <= r.bottom + 1 && b.top >= r.top - 1 && r.bottom <= innerHeight;
  });
  test("… la liste DÉFILE dans son cadre : le dernier collègue s'atteint", derniere);
  if (ann.ok) await page.click("button >> text=Annuler"); await attendre(200);
  test("… et « Annuler » ferme la fenêtre sans rien choisir", ann.ok && (await page.evaluate(() => window.choisi)) === null && !(await page.$(".fixed.inset-0")));
  await page.goto(`file://${htmlDialogue}?q=dialogue`); await attendre(200);
  await page.evaluate(() => window.ouvrirAlerte()); await attendre(300);
  const ok2 = await boutonVisible("OK");
  test("un très long message : « OK » reste à l'écran aussi", ok2.ok, ok2.detail);
  await page.setViewportSize({ width: 800, height: 600 });
}
test("aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
await nav.close();

// ─────────────────────────── 2. CHAQUE PANNEAU RELEVÉ PASSE PAR LA RÈGLE
console.log("\nLes panneaux relevés le 29/09/2026 passent tous par la règle");
const ui = sansCommentaires(lire("src/components/ui.jsx"));
test("ui.jsx porte la règle, écrite UNE fois", ["export function montrerALecran", "export function useMontrerALOuverture", "export function PanneauQuiSeMontre", "export function revenirSurLaLigne", "export function remonterEnHaut"].every((m) => ui.includes(m)));
const src = (f) => sansCommentaires(lire(f));
const CI = src("src/screens/ClientsInstalles.jsx");
test("🏠 Clients installés : le Dossier et les Frais viennent à l'écran, « Fermer » ramène sur la ligne",
  /ref=\{refDossier\}/.test(CI) && /ref=\{refFrais\}/.test(CI) && /useMontrerALOuverture\(dossierOuvert\)/.test(CI) && /useMontrerALOuverture\(chantier\)/.test(CI)
  && (CI.match(/revenirSurLaLigne\(c\.id\)/g) || []).length === 2 && /data-ligne=\{c\.id\}/.test(CI));
const ME = src("src/screens/MonEquipe.jsx");
test("👑 Mon équipe : les tâches d'un membre viennent à l'écran", /ref=\{refTaches\}/.test(ME) && /useMontrerALOuverture\(membreTaches\)/.test(ME) && /data-ligne=\{st\.u\.id\}/.test(ME));
const OU = src("src/screens/Outillage.jsx");
test("🧰 Outillage : réparation, retour de réparation, comptage, contenu, fiche — les cinq",
  ["repar", "retourRep", "compter", "contenu", "fiche"].every((v) => new RegExp(`\\{${v} && \\(?<PanneauQuiSeMontre cle=\\{${v}\\.outil_id\\} retour=\\{${v}\\.outil_id\\}>`).test(OU)) && /data-ligne=\{o\.id\}/.test(OU));
const PA = src("src/screens/Parametres.jsx");
test("⚙ Paramètres : la fiche du loyer et le dossier d'un client à effacer",
  /\{loyerPour && \(<PanneauQuiSeMontre/.test(PA) && /\{dossierEff && \(<PanneauQuiSeMontre/.test(PA) && /data-ligne=\{b\.id\}/.test(PA));
const ST = src("src/screens/Stocks.jsx");
test("📦 Stocks : le bon préparé depuis une demande, l'inventaire, et les deux défilements d'avant passent par la règle",
  /\{demandeEnCours && \(<PanneauQuiSeMontre/.test(ST) && /\{inv && \(<PanneauQuiSeMontre/.test(ST) && (ST.match(/montrerALecran\(/g) || []).length === 2);
const DE = src("src/screens/Depenses.jsx");
test("📤 Dépenses : ✏️ Modifier vient à l'écran et ramène sur la ligne", /\{modif && \(<PanneauQuiSeMontre cle=\{modif\.d\.id\} retour=\{modif\.d\.id\}>/.test(DE) && /data-ligne=\{x\.id\}/.test(DE));
const WA = src("src/screens/Whatsapp.jsx");
test("📲 WhatsApp : « ✍️ Lui écrire quand même » amène le formulaire à l'écran", /\{contact && \(<PanneauQuiSeMontre/.test(WA));
test("📲 WhatsApp et 💬 Messages : la boîte du fil passe par useFilSurSaFin (UNE règle, ui.jsx)",
  /export function useFilSurSaFin/.test(ui)
  && /useFilSurSaFin\(ouverte\?\.cle \|\| "", fil\.length\)/.test(WA) && /ref=\{boiteFil\.ref\} onScroll=\{boiteFil\.onScroll\}/.test(WA)
  && /useFilSurSaFin\(conv \?/.test(src("src/screens/Messagerie.jsx")) && /ref=\{boiteFil\.ref\} onScroll=\{boiteFil\.onScroll\}/.test(src("src/screens/Messagerie.jsx")));
const APP = src("src/App.jsx");
test("un changement d'onglet (« 📋 → devis », « Facturer », « Reprendre »…) affiche le nouvel écran depuis son haut",
  /if \(ongletPrecedent\.current === tab\) return;\s*ongletPrecedent\.current = tab;\s*remonterEnHaut\(\);/.test(APP));
test("un devis ou un brouillon repris s'affiche depuis son haut", /if \(cible\) \{ setMode\(cible\); remonterEnHaut\(true\); \}/.test(src("src/screens/dimensionnement/index.jsx")));

// ─────────────────────────── 3. PERSONNE NE FAIT DÉFILER LA PAGE À SA FAÇON
console.log("\nAucun écran ne fait défiler la page à sa façon");
{
  const { readdirSync, statSync } = await import("node:fs");
  const fichiers = [];
  const parcourir = (d) => readdirSync(d).forEach((n) => { const p = join(d, n); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(jsx?|mjs)$/.test(n)) fichiers.push(p); });
  parcourir("src");
  const fautifs = fichiers.filter((f) => !f.endsWith("components/ui.jsx")).filter((f) => {
    const s = sansCommentaires(lire(f));
    const brut = s.replace(/document\.querySelectorAll\(`\[data-tab-id="\$\{tab\}"\]`\)\.forEach\(\(el\) => el\.scrollIntoView\?\.\(\{ inline: "center", block: "nearest" \}\)\);/, "");
    return /scrollIntoView|window\.scrollTo/.test(brut);
  });
  test("scrollIntoView / window.scrollTo n'existent que dans ui.jsx (la barre des onglets d'App.jsx mise à part)", fautifs.length === 0, fautifs.join(", "));
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.`);
process.exit(ko === 0 ? 0 : 1);
