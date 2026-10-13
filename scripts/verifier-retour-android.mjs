// ============================================================
// scripts/verifier-retour-android.mjs — LA TOUCHE RETOUR D'ANDROID
// RAMÈNE-T-ELLE VRAIMENT EN ARRIÈRE ?
//
//   npm run verifier-retour-android
//
// Timo (13/10/2026) : « la touche retour de l'Android quitte l'application…
// pourquoi ça ne peut pas retourner les écrans en arrière ? » → « A a, B b,
// C a, lance ». La touche retour d'un téléphone fait exactement
// `history.back()` : on MONTE les vraies pièces (src/retour.js, la fenêtre de
// question DialogHost, l'aperçu PrintHost) dans Chromium et on appuie sur
// retour. Puis on lit le code : chaque fenêtre et chaque panneau est branché.
// ============================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const lire = (f) => readFileSync(f, "utf8");
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── 1. La règle pure ─────────────────────────────────────────────
console.log("\n① La pile (lib/pileRetour.js)");
const dossierP = mkdtempSync(join(tmpdir(), "bmi-pile-"));
await build({ entryPoints: [join(process.cwd(), "src/lib/pileRetour.js")], bundle: true, format: "esm", outfile: join(dossierP, "p.mjs"), logLevel: "silent" });
const { creerPile } = await import(join(dossierP, "p.mjs"));
{
  const p = creerPile();
  const ferme = [];
  const a = p.ouvrir(() => ferme.push("a"));
  p.ouvrir(() => ferme.push("b"));
  let r = p.retour(); r.fermer && r.fermer();
  test("retour ferme le DERNIER ouvert", ferme.join() === "b" && r.reculer === 0);
  r = p.retour(); r.fermer && r.fermer();
  test("puis celui d'avant", ferme.join() === "b,a");
  r = p.retour();
  test("pile vide : rien à fermer (le téléphone quitte, B b)", r.fermer === null && r.reculer === 0);
  void a;
}
{
  const p = creerPile(); const ferme = [];
  p.ouvrir(() => ferme.push("onglet"));
  const c = p.ouvrir(() => ferme.push("conv"));
  const d = p.ouvrir(() => ferme.push("fenetre"));
  p.fermeParEcran(d); p.fermeParEcran(c);
  const r = p.retour(); r.fermer && r.fermer();
  test("des marques MORTES dessus sont sautées : on ferme le premier vivant", ferme.join() === "onglet" && r.reculer === 2, JSON.stringify(r));
}
{
  const p = creerPile();
  p.ouvrir(() => {}); const x = p.ouvrir(() => {}); const y = p.ouvrir(() => {});
  p.fermeParEcran(x); p.fermeParEcran(y);
  test("compacter retire les mortes du DESSUS seulement", p.compacter() === 2 && p.taille() === 1);
  p.vider();
  test("vider : plus rien de vivant", p.vivants() === 0);
}

// ── 2. Dans un vrai navigateur ───────────────────────────────────
console.log("\n② Dans Chromium : la touche retour (history.back)");
const dossier = mkdtempSync(join(tmpdir(), "bmi-retour-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useRetour, useRetourOnglets, poserBlocageRetour, viderRetour, _pourLeBanc } from "${process.cwd()}/src/retour.js";
import { DialogHost, PrintHost, printApi, uChoix, uConfirm, uPrompt, uAlert, PanneauQuiSeMontre } from "${process.cwd()}/src/components/ui.jsx";
window.uChoix = uChoix; window.uConfirm = uConfirm; window.uPrompt = uPrompt; window.uAlert = uAlert;
window.ouvrirApercu = () => printApi && printApi.open("<p>doc</p>", "Doc");
window.bloquer = (v) => poserBlocageRetour(() => v);
window.vider = viderRetour;
window.pile = () => ({ taille: _pourLeBanc.pile.taille(), vivants: _pourLeBanc.pile.vivants() });
function Essai() {
  const [tab, setTab] = useState("ventes");
  const [conv, setConv] = useState(null);
  const [profil, setProfil] = useState(false);
  const [panneau, setPanneau] = useState(false);
  useRetourOnglets(tab, setTab, "u1");
  useRetour(!!conv, () => setConv(null));
  useRetour(profil, () => setProfil(false));
  window.ess = { setTab, setConv, setProfil, setPanneau, ferme: () => { setConv(null); setTab("stocks"); } };
  return <div>
    <div id="etat" data-tab={tab} data-conv={conv || ""} data-profil={profil ? "1" : ""} data-panneau={panneau ? "1" : ""}></div>
    {panneau && <PanneauQuiSeMontre onFermer={() => setPanneau(false)}><p>panneau</p></PanneauQuiSeMontre>}
    <DialogHost /><PrintHost />
  </div>;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: join(dossier, "bundle.js"), logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
writeFileSync(join(dossier, "index.html"), `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await nav.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
await page.goto("file://" + join(dossier, "index.html"));
await attendre(200);
const etat = () => page.evaluate(() => { const e = document.getElementById("etat"); return { tab: e.dataset.tab, conv: e.dataset.conv, profil: e.dataset.profil, panneau: e.dataset.panneau, dialogue: !!document.querySelector("[data-dialogue]"), apercu: !!document.querySelector(".portail-impression"), ...window.pile(), lg: window.navigation.currentEntry.index }; });
const retour = async () => { await page.evaluate(() => history.back()); await attendre(250); };
const faire = async (code) => { await page.evaluate(code); await attendre(150); };

let e = await etat();
const base = e.lg;
test("au premier écran, rien dans la pile (retour quitte, B b)", e.taille === 0 && e.tab === "ventes");

await faire(() => window.ess.setTab("caisse"));
await faire(() => window.ess.setTab("dettes"));
await retour(); e = await etat();
test("onglet Dettes → retour → Caisse", e.tab === "caisse", JSON.stringify(e));
await retour(); e = await etat();
test("puis → Ventes, et la pile est vide", e.tab === "ventes" && e.vivants === 0, JSON.stringify(e));

await faire(() => window.ess.setTab("whatsapp"));
await faire(() => window.ess.setConv("90112233"));
await faire(() => window.ess.setProfil(true));
await retour(); e = await etat();
test("A a : retour ferme d'abord le PROFIL, la conversation reste", e.profil === "" && e.conv === "90112233" && e.tab === "whatsapp", JSON.stringify(e));
await retour(); e = await etat();
test("puis la CONVERSATION, on reste sur WhatsApp", e.conv === "" && e.tab === "whatsapp", JSON.stringify(e));
await retour(); e = await etat();
test("puis l'onglet d'avant (Ventes)", e.tab === "ventes" && e.vivants === 0, JSON.stringify(e));

// Fermée par l'écran (« ← ») : sa marque meurt, puis disparaît.
await faire(() => window.ess.setTab("whatsapp"));
await faire(() => window.ess.setConv("90112233"));
const avantLg = (await etat()).lg;
await faire(() => window.ess.setConv(null));
await attendre(200); e = await etat();
test("conversation fermée par « ← » : sa marque est retirée de la liste du téléphone", e.taille === 1 && e.lg === avantLg - 1, JSON.stringify({ ...e, avantLg }));
await retour(); e = await etat();
test("le retour suivant ramène à l'onglet d'avant, sans appui perdu", e.tab === "ventes", JSON.stringify(e));

// Fermée par l'écran ET un autre onglet dans le même geste.
await faire(() => window.ess.setTab("whatsapp"));
await faire(() => window.ess.setConv("90112233"));
await faire(() => window.ess.ferme());
await attendre(200);
await retour(); e = await etat();
test("conversation fermée + nouvel onglet dans le même geste : retour → WhatsApp", e.tab === "whatsapp" && e.conv === "", JSON.stringify(e));
await retour(); e = await etat();
test("puis Ventes : la marque morte est sautée en un seul appui", e.tab === "ventes", JSON.stringify(e));

// C a : la fenêtre de question → « Annuler ».
await faire(() => window.ess.setTab("caisse"));
await faire(() => { window.rep = "attente"; window.uChoix("Moyen ?", ["Espèces", "Flooz"]).then((r) => { window.rep = r; }); });
await retour(); e = await etat();
let rep = await page.evaluate(() => window.rep);
test("C a : retour sur « Moyen de paiement » = Annuler (aucun choix)", rep === null && !e.dialogue && e.tab === "caisse", JSON.stringify({ rep, ...e }));
await faire(() => { window.rep = "attente"; window.uConfirm("Relancer ?").then((r) => { window.rep = r; }); });
await retour(); rep = await page.evaluate(() => window.rep);
test("retour sur une confirmation = Annuler (jamais OK)", rep === false);
await faire(() => { window.rep = "attente"; window.uPrompt("Motif ?", "x").then((r) => { window.rep = r; }); });
await retour(); rep = await page.evaluate(() => window.rep);
test("retour sur une question à taper = Annuler (rien de tapé n'est gardé)", rep === null);
e = await etat();
test("les fenêtres fermées, on est toujours sur Caisse", e.tab === "caisse" && !e.dialogue, JSON.stringify(e));
// Deux questions à la suite, la première répondue par un bouton.
await faire(() => { window.rep = "attente"; window.uConfirm("Payer ?").then(async (ok) => { if (!ok) return; window.rep = await window.uChoix("Payé avec ?", ["Tiroir", "DG"]); }); });
await page.click("[data-dialogue-boutons] button:last-child"); await attendre(150);
await retour(); rep = await page.evaluate(() => window.rep); e = await etat();
test("deux questions à la suite : retour sur la seconde = Annuler", rep === null && !e.dialogue && e.tab === "caisse", JSON.stringify({ rep, ...e }));
await retour(); e = await etat();
test("puis l'onglet d'avant", e.tab === "ventes", JSON.stringify(e));

// L'aperçu avant impression et un panneau.
await faire(() => window.ouvrirApercu());
await retour(); e = await etat();
test("retour ferme l'aperçu avant impression", !e.apercu && e.tab === "ventes", JSON.stringify(e));
await faire(() => window.ess.setPanneau(true));
await retour(); e = await etat();
test("retour ferme un panneau (PanneauQuiSeMontre onFermer)", e.panneau === "", JSON.stringify(e));

// Verrouillée : rien ne bouge.
await faire(() => window.ess.setTab("stocks"));
await faire(() => window.ess.setConv("1"));
await faire(() => window.bloquer(true));
await retour(); e = await etat();
test("verrouillée : retour ne ferme rien derrière le mot de passe", e.conv === "1" && e.tab === "stocks" && e.vivants === 2, JSON.stringify(e));
await faire(() => window.bloquer(false));
await retour(); e = await etat();
test("déverrouillée : retour reprend (la conversation se ferme)", e.conv === "" && e.tab === "stocks", JSON.stringify(e));
await faire(() => window.vider());
await attendre(200); e = await etat();
test("déconnexion : la pile se vide et la liste du téléphone revient au départ (le prochain retour quitte)", e.taille === 0 && e.lg === base, JSON.stringify({ ...e, base }));
test("aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
await nav.close();

// ── 3. Le code ───────────────────────────────────────────────────
console.log("\n③ Le code");
const fichiers = (await import("node:child_process")).execSync("git ls-files src", { encoding: "utf8" }).trim().split("\n").filter((f) => /\.(js|jsx)$/.test(f));
const fautifs = fichiers.filter((f) => f !== "src/retour.js" && /history\.(pushState|go|back)\b|["']popstate["']/.test(sansCommentaires(lire(f))));
test("seul src/retour.js écrit dans la liste du téléphone et écoute retour", fautifs.length === 0, fautifs.join(", "));
const app = sansCommentaires(lire("src/App.jsx"));
test("App : les onglets posent leur marque", /useRetourOnglets\(tab, setTab, profile\?\.id \|\| null\)/.test(app));
test("App : verrouillée, retour bloqué", /poserBlocageRetour\(\(\) => verrouille\)/.test(app));
test("App : la recherche générale se ferme par retour", /useRetour\(rechercheOuverte,/.test(app));
const ui = sansCommentaires(lire("src/components/ui.jsx"));
test("DialogHost : retour = la valeur d'Annuler (valeurAnnuler)", /useRetour\(!!d, \(\) => \{ if \(d\) close\(valeurAnnuler\(d\.type\)\); \}\)/.test(ui));
test("DialogHost : les boutons Annuler / Fermer passent par la même règle", (ui.match(/close\(valeurAnnuler\(d\.type\)\)/g) || []).length === 4);
test("PrintHost : retour ferme l'aperçu", /useRetour\(!!html, \(\) => setHtml\(null\)\)/.test(ui));
test("PanneauQuiSeMontre accepte onFermer", /useRetour\(!!onFermer, onFermer\)/.test(ui));
const BRANCHES = [
  ["src/screens/Whatsapp.jsx", /useRetour\(!!cleOuverte,/, "la conversation WhatsApp"],
  ["src/screens/Whatsapp.jsx", /useRetour\(!!profilOuvert,/, "le profil d'un contact"],
  ["src/screens/Whatsapp.jsx", /onFermer=\{\(\) => setContact\(null\)\}/, "« ✍️ Écrire »"],
  ["src/screens/Messagerie.jsx", /useRetour\(!!conv,/, "la conversation 💬"],
  ["src/screens/Messagerie.jsx", /useRetour\(true, onFermer\)/, "la création d'un groupe"],
  ["src/screens/Utilisateurs.jsx", /useRetour\(!!gererOuvert,/, "⋯ Gérer"],
  ["src/screens/Utilisateurs.jsx", /useRetour\(!!pouvoirsPour,/, "🔐 Pouvoirs"],
  ["src/screens/Clients.jsx", /useRetour\(!!ficheOuverte,/, "la fiche d'un client"],
  ["src/screens/ClientsInstalles.jsx", /useRetour\(!!dossierOuvert,/, "le dossier d'un chantier"],
  ["src/screens/Ventes.jsx", /useRetour\(!!reprise,/, "↩ Reprise"],
  ["src/screens/Ventes.jsx", /useRetour\(!!retour,/, "🔁 Retour"],
  ["src/screens/TousLesDevis.jsx", /useRetour\(!!signature,/, "la signature en boutique"],
  ["src/screens/EspaceClient.jsx", /useRetour\(!!contratOuvert,/, "le contrat (espace client)"],
  ["src/screens/EspaceClient.jsx", /useRetour\(!!pvLectureOuverte,/, "le PV (espace client)"],
  ["src/screens/ContratsInstallation.jsx", /useRetour\(captureOuverte,/, "ma signature"],
  ["src/screens/Parametres.jsx", /useRetour\(!!fondsPour,/, "💼 Fonds de caisse"],
  ["src/screens/Parametres.jsx", /useRetour\(!!couleurPour,/, "la couleur d'une boutique"],
  ["src/screens/Parametres.jsx", /useRetour\(!!positionPour,/, "la position GPS"],
  ["src/screens/Parametres.jsx", /onFermer=\{\(\) => setLoyerPour\(null\)\}/, "🏠 Loyer"],
  ["src/screens/Parametres.jsx", /onFermer=\{\(\) => setCibleEff\(null\)\}/, "le dossier d'un client à effacer"],
  ["src/screens/Depenses.jsx", /onFermer=\{\(\) => setModif\(null\)\}/, "✏️ Modifier une dépense"],
  ["src/components/SelecteurArticle.jsx", /useRetour\(ouvert,/, "« Rechercher un article »"],
];
for (const [f, re, nom] of BRANCHES) test(`retour ferme ${nom}`, re.test(sansCommentaires(lire(f))), f);
for (const s of ["setRepar", "setRetourRep", "setCompter", "setContenu", "setFiche"]) test(`retour ferme le panneau ${s} de 🧰 Outillage`, new RegExp(`onFermer=\\{\\(\\) => ${s}\\(null\\)\\}`).test(lire("src/screens/Outillage.jsx")));

console.log(`\n${ok} contrôles réussis, ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
