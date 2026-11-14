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
const mf = ui.match(/export const champRechercheFenetre = (?:`\$\{inputCls\}([^`]*)`|inputCls);/);
const fenetre = (mf && mf[1] ? mf[1] : "").trim();

// ⚠ On LIT la classe du cadre dans App.jsx — jamais on ne la recopie ici :
// deux écritures finiraient par diverger, et le banc mesurerait autre chose
// que ce que l'application fait.
const app = readFileSync("src/App.jsx", "utf8");
const mc = app.match(/<main className="(w-full max-w-[^"]+)">/);
if (!mc) { console.log("❌ Le cadre <main> d'App.jsx n'a pas la forme attendue."); process.exit(1); }
const cadreCls = mc[1];
// ⚠ La case d'un formulaire (Field, ui.jsx) est LUE, jamais recopiée (23/10/2026,
// capture Timo de 📦 Stocks : « corriger les alignements »).
const mfld = ui.match(/export const Field = \(\{ label, children \}\) => \(\n  <label className="([^"]+)">\n    <span className="([^"]+)">\{label\}<\/span>\n    <div className="([^"]+)">\{children\}<\/div>/);
if (!mfld) { console.log("❌ Field (ui.jsx) n'a pas la forme attendue."); process.exit(1); }
const [, fieldCls, fieldLabelCls, fieldBoiteCls] = mfld;
const caseForm = (id, libelle, cls = fieldCls) => `<label class="${cls}"><span class="${fieldLabelCls}">${libelle}</span><div class="${fieldBoiteCls}"><input id="${id}" class="${inputCls}"></div></label>`;

const css = readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0];
if (!css) { console.log("❌ Pas de CSS construit — lancez `npm run build` d'abord."); process.exit(1); }

const dossier = mkdtempSync(join(tmpdir(), "bmi-champs-"));
const page = join(dossier, "p.html");
writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${join(process.cwd(), "dist/assets", css)}">
<style>
  /* ⚠ Le témoin des transitions porte SA propre classe, posée dans la même
     couche que les utilitaires Tailwind. Sinon il dépend d'une classe que
     l'application écrit encore — et le jour où plus personne ne l'écrit,
     Tailwind ne la génère plus et le témoin ne prouve plus rien (c'est
     arrivé le 18/09/2026, au moment même où on retirait les douze mortes). */
  @layer utilities { .temoin-transition { transition-property: background-color; transition-duration: .3s; } }
</style></head>
<body style="margin:0"><div style="width:100%">
  <input id="recherche" class="${inputCls} ${suffixe}" placeholder="Rechercher…">
  <input id="ordinaire" class="${inputCls}" placeholder="Champ ordinaire">
  <input id="temoin" class="${inputCls} max-w-xs" placeholder="Témoin : un max-w sur un champ">
  <button id="btemoin" class="px-4 py-2 temoin-transition">Témoin : transition sur un bouton</button>
  <span id="stemoin" class="temoin-transition">Témoin : la même classe hors bouton</span>
</div>
<!-- ⚠ LE CADRE DE L'APPLICATION (20/09/2026) : la classe est LUE dans
     App.jsx et posée telle quelle, pour que le banc mesure ce que Timo voit
     et non ce que je crois avoir écrit. -->
<!-- Une rangée de formulaire : un libellé long (trois lignes) à côté de libellés courts -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:700px">${caseForm("fCourt", "Seuil")}${caseForm("fLong", "Un libellé très long qui passe sur trois lignes dans sa case")}${caseForm("fCourt2", "Prix")}${caseForm("fLong2", "Encore un libellé assez long")}</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:700px">${caseForm("tCourt", "Seuil", "block")}${caseForm("tLong", "Un libellé très long qui passe sur trois lignes dans sa case", "block")}</div>
<!-- 📱 LA RANGÉE DE BOUTONS DE CHOIX (07/11/2026) : la vraie forme de
     BoutiqueTabs (flex flex-wrap), avec et sans la marque, plus une liste. -->
<div id="rangee" data-rangee-boutons class="flex gap-2 flex-wrap" style="width:100%"><button id="rb1" class="px-4 py-1.5 rounded-full text-sm font-bold">TOUTES</button><button id="rb2" class="px-4 py-1.5 rounded-full text-sm font-bold">BMI APESSITO</button><button id="rb3" class="px-4 py-1.5 rounded-full text-sm font-bold">🏗 DÉPÔT CHANTIER</button><select id="rsel"><option>Période</option></select></div>
<div id="rangeeTemoin" class="flex gap-2 flex-wrap" style="width:100%"><button id="rt1" class="px-4 py-1.5 rounded-full text-sm font-bold">TOUTES</button><button id="rt2" class="px-4 py-1.5 rounded-full text-sm font-bold">BMI APESSITO</button></div>
<main id="cadre" class="${cadreCls}"><div id="dedans" style="width:100%"></div></main>
<!-- La fenêtre du sélecteur d'article, telle qu'elle s'ouvre vraiment -->
<div class="fixed inset-0 flex items-end sm:items-center justify-center">
  <div id="panneau" class="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] flex flex-col">
    <div class="p-3 border-b border-slate-200">
      <input id="dansFenetre" class="${inputCls} ${fenetre}" placeholder="🔍 Rechercher un article…">
    </div>
    <div id="listeFenetre" class="overflow-y-auto flex-1">
      <button class="w-full text-left px-4 py-3">Panneau 400W</button>
    </div>
  </div>
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
    btnTransition: getComputedStyle(document.getElementById("btemoin")).transitionProperty,
    spanTransition: getComputedStyle(document.getElementById("stemoin")).transitionProperty,
    dansFenetre: Math.round(document.getElementById("dansFenetre").getBoundingClientRect().width),
    listeFenetre: Math.round(document.getElementById("listeFenetre").getBoundingClientRect().width),
    cadre: Math.round(document.getElementById("cadre").getBoundingClientRect().width),
    rangee: ["rb1", "rb2", "rb3", "rsel", "rt1", "rt2"].reduce((o, id) => { const r = document.getElementById(id).getBoundingClientRect(); return { ...o, [id]: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) } }; }, {}),
    largeurPage: document.documentElement.clientWidth,
    cases: ["fCourt", "fLong", "fCourt2", "fLong2", "tCourt", "tLong"].reduce((o, id) => ({ ...o, [id]: Math.round(document.getElementById(id).getBoundingClientRect().top) }), {}),
  }));
  await p.close();
  return r;
};
const grandEcran = await mesurer(1920);
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

// ⚠ …SAUF DANS UNE FENÊTRE DÉJÀ ÉTROITE. Le sélecteur d'article s'ouvre dans
// un panneau de 448 px : à 320 px, la ligne laissait 104 px de blanc à sa
// droite pendant que la liste dessous courait sur tout le panneau (mesuré le
// 18/09/2026, défaut introduit le jour même par la règle de largeur).
console.log("\n── 🪟 …ET DANS UNE FENÊTRE, ELLE SUIT LE CADRE ──");
test("★ dans la fenêtre du sélecteur d'article (448 px), la ligne fait TOUTE la largeur du panneau — pas 320 px avec du blanc à droite",
  pc.dansFenetre > 380 && pc.listeFenetre - pc.dansFenetre <= 30,
  `mesuré : ligne ${pc.dansFenetre} px dans un panneau de ${pc.listeFenetre} px`);
test("★ et sur TÉLÉPHONE (390 px) elle remplit son panneau de la même façon (les deux règles se rejoignent)",
  tel.listeFenetre - tel.dansFenetre <= 30 && tel.dansFenetre >= 340,
  `mesuré : ligne ${tel.dansFenetre} px dans un panneau de ${tel.listeFenetre} px`);

// ⚠⚠ LA LARGEUR DE L'ÉCRAN (Timo, 20/09/2026 : « pourquoi ces marges des 2
// côtés ? », puis « ces marges c'est sur ordinateur », puis « b »). Le cadre
// était bridé à 1152 px : sur son XPS, la liste des ventes se tassait pendant
// qu'il y avait 300 px de blanc de chaque côté.
// ⚠ On MESURE la largeur obtenue, on ne lit pas la classe — c'est toute la
// leçon de ce banc.
console.log("\n── 🖥 LA LARGEUR DU CADRE DE L'APPLICATION ──");
test("★★ sur un GRAND écran (1920 px), le cadre va jusqu'à 1600 px — plus les 1152 px d'avant",
  grandEcran.cadre >= 1560 && grandEcran.cadre <= 1600,
  `mesuré : ${grandEcran.cadre} px`);
test("★ sur un ordinateur ordinaire (1400 px), le cadre prend TOUT — aucune marge perdue",
  pc.cadre >= 1360, `mesuré : ${pc.cadre} px pour 1400 px d'écran`);
test("★★ sur TÉLÉPHONE (390 px) RIEN ne change : la limite n'a jamais rogné un téléphone",
  tel.cadre >= 380 && tel.cadre <= 390, `mesuré : ${tel.cadre} px`);
test("★ et sur tablette non plus", tablette.cadre >= 690 && tablette.cadre <= 700, `mesuré : ${tablette.cadre} px`);
test("★ la limite EXISTE quand même : un moniteur immense n'étale pas un formulaire sur toute sa largeur",
  grandEcran.cadre < 1920);

console.log("\n── 📐 LES CASES D'UNE MÊME RANGÉE S'ALIGNENT (23/10/2026) ──");
// 📱 LES RANGÉES DE BOUTONS DE CHOIX (07/11/2026, Timo : « ranger les boutons
// comme c'est fait dans dimensionnement… une règle commune à toute l'app »).
{
  const r = tel.rangee, t = tel.rangee;
  test("★★ téléphone : une rangée `data-rangee-boutons` est une GRILLE à deux colonnes égales (« TOUTES » et « BMI APESSITO » ont la MÊME largeur, côte à côte)",
    r.rb1.w === r.rb2.w && r.rb1.y === r.rb2.y && r.rb3.x === r.rb1.x && r.rb3.y > r.rb1.y, JSON.stringify(r));
  test("★ téléphone : une liste déroulante dans la rangée prend TOUTE la largeur",
    tel.rangee.rsel.w > tel.rangee.rb1.w * 1.8, JSON.stringify(r.rsel));
  test("★ le TÉMOIN (même rangée SANS la marque) le prouve : les boutons y gardent la largeur de leur texte",
    t.rt1.w !== t.rt2.w, JSON.stringify([t.rt1, t.rt2]));
  test("★★ ordinateur : RIEN ne change, la rangée reste en ligne (les trois boutons sur la même hauteur, chacun à la largeur de son texte)",
    pc.rangee.rb1.y === pc.rangee.rb3.y && pc.rangee.rb1.w !== pc.rangee.rb2.w, JSON.stringify(pc.rangee));
  const css = readFileSync("src/index.css", "utf8");
  test("la règle vit UNE fois, dans index.css", (css.match(/\[data-rangee-boutons\] \{ display: grid/g) || []).length === 1);
  const rangees = { "src/components/SelecteurBoutique.jsx": 1, "src/screens/Dashboard.jsx": 1, "src/screens/Utilisateurs.jsx": 1, "src/screens/ClientsInstalles.jsx": 1, "src/screens/TousLesDevis.jsx": 1, "src/screens/MonEquipe.jsx": 1, "src/screens/MaCommission.jsx": 1, "src/screens/Ventes.jsx": 1, "src/screens/dimensionnement/Solaire.jsx": 1 };
  const manque = Object.entries(rangees).filter(([f, n]) => (readFileSync(f, "utf8").match(/data-rangee-boutons/g) || []).length < n).map(([f]) => f);
  test("★ les rangées de choix (boutiques, rôles, statuts, périodes, Vendre / Inventaire) portent la marque", manque.length === 0, manque.join(", "));
}
test("★★ un libellé qui passe sur plusieurs lignes ne descend plus SA case : les quatre cases de la rangée commencent à la même hauteur",
  new Set([pc.cases.fCourt, pc.cases.fLong, pc.cases.fCourt2, pc.cases.fLong2]).size === 1,
  `mesuré : ${JSON.stringify(pc.cases)}`);
test("★ le TÉMOIN (l'ancienne case, `block`) le prouve : sans la règle, la case au libellé long tombe plus bas",
  pc.cases.tLong > pc.cases.tCourt, `témoin : court ${pc.cases.tCourt}, long ${pc.cases.tLong}`);

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

// ═══ LA MÊME QUESTION, POSÉE À TOUT LE RESTE (Timo, 18/09/2026 : « vérifie
// si d'autres classes ne commandent rien comme celle-là »). `src/index.css`
// donne à CHAQUE bouton actif son retour visuel (demande Timo, 20/08/2026) :
//     button:not(:disabled) { transition: filter 120ms, transform 80ms; }
// Écrite hors layer, elle écrase toute classe `transition-*` posée sur un
// bouton. DOUZE l'étaient — elles n'animaient rien.
console.log("\n── ⚠ ET `transition-*` NE COMMANDE RIEN SUR UN BOUTON ──");
test("★ le TÉMOIN le prouve : une classe qui pose `transition-property` sur un bouton devient « filter, transform » — la classe est là, elle n'anime rien",
  pc.btnTransition === "filter, transform",
  `mesuré sur le bouton : ${pc.btnTransition}`);
test("★ …alors que la MÊME classe, hors bouton, fonctionne — la preuve que c'est bien la règle globale qui mange, pas Tailwind qui manque",
  pc.spanTransition === "background-color",
  `mesuré hors bouton : ${pc.spanTransition.slice(0, 60)}…`);

const transitionsMortes = execSync("grep -rn 'transition-all\\|transition-colors\\|transition-transform\\|duration-[0-9]\\|\\bease-' src --include=*.jsx || true")
  .toString().trim();
test("★ donc PLUS AUCUNE `transition-*` écrite dans l'application — douze l'étaient, toutes sur des boutons, toutes mortes",
  transitionsMortes === "", transitionsMortes.split("\n").slice(0, 5).join("\n     "));

// Les trois autres règles globales d'index.css ont été passées au crible le
// même jour et sont SAINES — on le note ici pour ne pas refaire l'audit :
//   `.grid > * { min-width: 0 }`  → aucun `min-w-*` n'est enfant DIRECT d'une
//        grille (ils sont tous sur un <table> dans un cadre qui défile) ;
//   `button:active { transform }` → aucun `active:scale-*` dans le code ;
//   `:focus-visible { outline }`  → les trois `outline-none` sont sur des
//        <input>, que cette règle ne touche pas.
test("★ la règle qui donne son retour visuel à chaque bouton est TOUJOURS là (c'est elle qui mange les transitions, et elle vaut mieux qu'elles)",
  /button:not\(:disabled\) \{[\s\S]*transition: filter/.test(readFileSync("src/index.css", "utf8")));

// ============================================================
// 🌗 LE MODE SOMBRE (12/11/2026, « Aa, Ba, C clair, D laisse comme ça » ; refait
// le 14/11/2026, « b, lance » : un VRAI sombre sur tous les écrans), mesuré
// dans Chromium avec le VRAI CSS construit. Plus aucun filtre ne retourne la
// page : chaque couleur de Tailwind a sa couleur de nuit (scripts/sombre-css.mjs).
// Sans la marque RIEN ne change ; un cadre `data-garder-clair` reste clair ;
// à l'impression tout redevient clair.
// ============================================================
console.log("\n🌗 Le mode sombre, mesuré dans Chromium");
{
  const pageS = join(mkdtempSync(join(tmpdir(), "bmi-sombre-")), "s.html");
  const corps = (theme, formation) => `<!doctype html><html ${theme ? `data-theme="${theme}"` : ""} ${formation ? 'data-espace="formation"' : ""}><head><meta charset="utf-8">
<link rel="stylesheet" href="${join(process.cwd(), "dist/assets", css)}"></head>
<body><div class="min-h-screen bg-slate-100" id="page" style="height:3000px"><p id="txt" class="text-slate-900">Texte</p>
<div id="carte" class="bg-white border border-slate-200"><span id="pastille" class="bg-emerald-50 text-emerald-800">Espèces</span>
<button id="plein" class="bg-sky-700 text-white">Enregistrer</button><span id="bleu" class="bg-sky-50">x</span></div>
<img id="photo" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">
<div id="garde" data-garder-clair class="bg-white"><span id="gtxt" class="text-slate-900">x</span><span id="gnu">y</span><img id="dedans" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10"></div></div>
<div data-tableau-de-bord><div id="cadre" class="bg-white rounded-xl"><span id="encre" class="text-slate-800">x</span></div>
<div data-caisses><div id="caisse" class="bg-white rounded-xl">x</div></div><div id="kpi" class="tdb-kpi tdb-vert">x</div></div>
<div id="fixe" style="position:fixed;top:8px;left:0;width:40px;height:40px"></div></body></html>`;
  const nav = await chromium.launch();
  const lire = async (theme, formation = false) => {
    writeFileSync(pageS, corps(theme, formation));
    const p = await nav.newPage({ viewport: { width: 400, height: 600 } });
    await p.goto(`file://${pageS}`);
    await p.evaluate(() => window.scrollTo(0, 1500));
    const mesure = () => p.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      return {
        html: getComputedStyle(document.documentElement).filter, photo: cs("photo").filter, dedans: cs("dedans").filter, garde: cs("garde").filter,
        page: cs("page").backgroundColor, txt: cs("txt").color, carte: cs("carte").backgroundColor, trait: cs("carte").borderTopColor,
        pastille: cs("pastille").backgroundColor, pastilleTxt: cs("pastille").color, plein: cs("plein").backgroundColor, pleinTxt: cs("plein").color, bleu: cs("bleu").backgroundColor,
        gardeFond: cs("garde").backgroundColor, gtxt: cs("gtxt").color, gnu: cs("gnu").color,
        fixeTop: Math.round(document.getElementById("fixe").getBoundingClientRect().top),
        cadre: cs("cadre").filter, cadreFond: cs("cadre").backgroundColor, encre: cs("encre").color,
        caisse: cs("caisse").filter, caisseFond: cs("caisse").backgroundColor, kpi: cs("kpi").filter, kpiFond: cs("kpi").backgroundColor,
      };
    });
    const r = await mesure();
    await p.emulateMedia({ media: "print" });
    r.imprime = await mesure();
    await p.close();
    return r;
  };
  const clair = await lire(""), sombre = await lire("sombre"), violet = await lire("sombre", true);
  await nav.close();
  // Une couleur lue en « rgb(r, g, b) » ou en oklch : sa clarté, de 0 (noir) à 1 (blanc).
  const clarte = (c) => { const o = /oklch\(([\d.]+)/.exec(c); if (o) return Number(o[1]) > 1 ? Number(o[1]) / 100 : Number(o[1]);
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : NaN; };
  const BLANC = "rgb(255, 255, 255)", NUIT = "rgb(17, 26, 44)", ENCRE = "rgb(241, 245, 249)";
  test("★ mode clair (sans marque) : AUCUN filtre, et les couleurs sont celles d'avant — carte blanche, texte foncé, pastille pâle à texte foncé",
    clair.html === "none" && clair.photo === "none" && clair.garde === "none" && clair.carte === BLANC && clarte(clair.txt) < 0.35
    && clarte(clair.pastille) > 0.9 && clarte(clair.pastilleTxt) < 0.55 && clarte(clair.page) > 0.9, JSON.stringify(clair));
  test("★ mode sombre : PLUS AUCUN filtre sur la page ni sur une photo (retourné — c'était invert + hue-rotate)",
    sombre.html === "none" && sombre.photo === "none" && sombre.dedans === "none" && sombre.garde === "none", JSON.stringify(sombre));
  test("★ mode sombre : la page est plus sombre que ses cadres, une carte blanche devient bleu nuit, son trait discret, le texte foncé devient clair",
    sombre.page === "rgb(11, 18, 32)" && sombre.carte === NUIT && sombre.trait === "rgb(34, 48, 74)" && sombre.txt === ENCRE, JSON.stringify(sombre));
  test("★ mode sombre : une pastille pâle (Espèces) devient une teinte sombre à texte CLAIR — elle ne reste pas claire",
    clarte(sombre.pastille) < 0.3 && clarte(sombre.pastilleTxt) > 0.7 && sombre.pastille !== sombre.carte, sombre.pastille + " " + sombre.pastilleTxt);
  test("★ mode sombre : un bouton PLEIN (bleu, texte blanc) garde son fond et son texte blanc",
    sombre.plein === clair.plein && sombre.pleinTxt === BLANC, sombre.plein + " " + sombre.pleinTxt);
  test("★ un cadre `data-garder-clair` (bandeau, verrou, aperçu d'impression) reste CLAIR : fond blanc, texte foncé, même sans classe de couleur",
    sombre.gardeFond === BLANC && sombre.gtxt === clair.gtxt && clarte(sombre.gnu) < 0.3, sombre.gardeFond + " " + sombre.gtxt + " " + sombre.gnu);
  test("★ en FORMATION, la teinte de nuit du bleu de l'application est VIOLETTE (elle suit l'espace)",
    violet.bleu !== sombre.bleu && clarte(violet.bleu) < 0.3 && clarte(sombre.bleu) < 0.3, sombre.bleu + " / " + violet.bleu);
  test("★ une fenêtre `fixed` reste à sa place après défilement",
    sombre.fixeTop === 8, String(sombre.fixeTop));
  test("★ à l'impression, tout redevient clair : carte blanche, texte foncé, pastille pâle",
    sombre.imprime.html === "none" && sombre.imprime.carte === BLANC && sombre.imprime.txt === clair.txt && sombre.imprime.pastille === clair.pastille, JSON.stringify(sombre.imprime));
  // 📊 LE TABLEAU DE BORD (Timo, 13/11/2026, « A et C oui ») : ses couleurs choisies pour le noir.
  test("★ 📊 tableau de bord en CLAIR : aucun filtre, le cadre reste blanc, la carte de la période est en pastel vert",
    clair.cadre === "none" && clair.cadreFond === BLANC && clair.kpi === "none" && clair.kpiFond === "rgb(227, 246, 234)", JSON.stringify(clair));
  test("★ 📊 tableau de bord en SOMBRE : fond bleu nuit, texte clair, la carte de la période en vert sombre — sans filtre",
    sombre.cadre === "none" && sombre.cadreFond === NUIT && sombre.encre === ENCRE && sombre.kpi === "none" && sombre.kpiFond === "rgb(15, 42, 30)", JSON.stringify(sombre));
  test("★ 📊 les caisses (`data-caisses` : DG, BANQUE, comptable) sont SOMBRES elles aussi (retourné — toute l'application a son vrai sombre)",
    sombre.caisse === "none" && sombre.caisseFond === NUIT, sombre.caisse + " " + sombre.caisseFond);
  test("★ 📊 à l'impression, le cadre du tableau de bord redevient clair",
    sombre.imprime.cadre === "none" && sombre.imprime.cadreFond === BLANC, sombre.imprime.cadreFond);
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
