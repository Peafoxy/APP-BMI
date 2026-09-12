// ============================================================
// scripts/verifier-ecran-ventes.mjs — L'ÉCRAN VENTES ET L'ARGENT
//
//   npm run verifier-ecran-ventes
//
// ⚠ POURQUOI CE BANC EXISTE (audit du 29/08/2026)
//
// Deux défauts d'argent ont vécu longtemps dans encaisserVente() sans que
// rien ne les voie — ni la compilation, ni les 492 contrôles de
// cloisonnement, qui testent des CALCULS et n'ouvrent jamais cet écran :
//
//   1. Répondre « non » à « Enregistrer cette vente à crédit ? » enregistrait
//      la vente QUAND MÊME, sans la dette. Stock sorti, chiffre d'affaires
//      augmenté, créance nulle part. Le vendeur croyait avoir annulé.
//
//   2. La dette portait le seul total des ARTICLES. Les frais d'installation
//      et de transport du devis — que l'écran venait pourtant de demander au
//      vendeur d'encaisser, et que le reçu imprime — n'étaient réclamés nulle
//      part.
//
// Ces deux défauts vivent dans du JSX : on ne peut pas les appeler depuis
// Node. On vérifie donc la FORME du code à l'endroit exact où ils étaient,
// et on vérifie séparément que le calcul du reçu et celui de la dette
// donnent bien le même chiffre.
// ============================================================
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

let ok = 0, ko = 0;
const test = (nom, cond) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };
const titre = (t) => console.log(`\n${t}`);

const src = readFileSync("src/screens/Ventes.jsx", "utf8");
const impr = readFileSync("src/lib/impression.js", "utf8");

titre("Refuser une vente à crédit doit TOUT annuler, pas seulement la dette");
{
  test("★ la confirmation est en forme NÉGATIVE (« si on refuse »)",
    /if \(!await uConfirm\(`Enregistrer cette vente à crédit/.test(src));
  test("★ …et elle sort de la fonction sans rien enregistrer",
    /if \(!await uConfirm\(`Enregistrer cette vente à crédit[\s\S]{0,400}?\breturn;/.test(src));
  test("★ l'ancienne forme (« si on accepte ») a bien disparu",
    !/if \(await uConfirm\(`Enregistrer cette vente à crédit/.test(src));
  test("le vendeur est prévenu que rien n'a été enregistré",
    /Vente annulée : rien n'a été enregistré/.test(src));
}

titre("La dette réclame ce que le reçu annonce — frais compris");
{
  test("★ le montant dû part de totalAEncaisser, pas du total des articles",
    /const duTotal = totalAEncaisser;/.test(src));
  test("★ la dette est enregistrée avec ce montant-là",
    /montant: duTotal,/.test(src));
  test("★ l'ancienne écriture (montant: total) a disparu du bloc crédit",
    !/dettes: \[\{[^}]*montant: total,/.test(src));
  test("l'avance est plafonnée au vrai dû, pas aux seuls articles",
    /avance: f\.paiement === "Crédit \(dette\)" \? Math\.max\(0, Math\.min\(totalAEncaisser,/.test(src));
  test("les frais figurent aussi en LIGNES, pour que le reçu s'additionne",
    /Frais d'installation/.test(src) && /Transport \/ livraison/.test(src));
}

titre("Le reçu de vente et la dette disent le MÊME chiffre");
{
  // Reprise EXACTE des deux formules, telles qu'elles sont écrites.
  const recuResteAPayer = (net, fi, ft, avance) =>
    Math.max(0, net + Number(fi || 0) + Number(ft || 0) - (Number(avance) || 0));
  const detteResteAPayer = (total, fi, ft, avance) => {
    const duTotal = total + Number(fi || 0) + Number(ft || 0);
    return duTotal - Math.max(0, Math.min(duTotal, Number(avance) || 0));
  };

  test("★ le cas de l'audit : 1 000 000 de matériel, 150 000 de pose, 500 000 versés",
    recuResteAPayer(1000000, 150000, 0, 500000) === 650000
    && detteResteAPayer(1000000, 150000, 0, 500000) === 650000);
  test("★ avec transport en plus",
    recuResteAPayer(1000000, 150000, 40000, 500000) === 690000
    && detteResteAPayer(1000000, 150000, 40000, 500000) === 690000);
  test("sans aucun frais, rien ne change par rapport à avant",
    detteResteAPayer(800000, 0, 0, 100000) === 700000);
  test("une avance qui couvre TOUT solde la dette (et ne la rend pas négative)",
    detteResteAPayer(1000000, 150000, 0, 2000000) === 0);
  test("aucune avance : tout reste dû, frais compris",
    detteResteAPayer(1000000, 150000, 0, 0) === 1150000);

  test("le reçu imprime bien le total AVEC les frais",
    /TOTAL TTC[\s\S]{0,200}?frais_installation[\s\S]{0,120}?frais_transport/.test(impr));
  test("…et son « RESTE À PAYER » part du même total",
    /RESTE À PAYER[\s\S]{0,220}?frais_installation[\s\S]{0,160}?avance/.test(impr));
}

titre("Un seul chiffre d'affaires pour toute l'application");
{
  // ⚠ AUDIT DU 29/08/2026 : trois écrans calculaient le « chiffre d'affaires »
  // de trois façons différentes pour la MÊME vente. Le plus genant était
  // Rentabilité, qui ne retirait ni la remise globale ni le rabais : la marge
  // y paraissait meilleure qu'elle n'était, et c'est l'écran sur lequel Timo
  // décide ses prix.
  const rent = readFileSync("src/screens/Rentabilite.jsx", "utf8");
  const macom = readFileSync("src/screens/MaCommission.jsx", "utf8");
  const comm = readFileSync("src/screens/Commerciaux.jsx", "utf8");

  test("★ Rentabilité additionne caLigneVente, plus « qte × pu »",
    /parProduit\[nom\]\.ca \+= caLigneVente\(v, l\);/.test(rent)
    && !/parProduit\[nom\]\.ca \+= Number\(l\.qte/.test(rent));
  test("★ Ma commission part de caVente, comme la commission elle-même",
    !/reduce\(\(s, v\) => s \+ totalVente\(v\), 0\)/.test(macom));
  test("★ Commerciaux aussi",
    /const ca = vs\.reduce\(\(s, v\) => s \+ caVente\(v\), 0\);/.test(comm));

  // La somme des lignes doit redonner EXACTEMENT le CA de la vente.
  const lignesVente = (v) => v.articles || [];
  const caLigne = (v, l) => {
    if (l.hors_boutique) return 0;
    const net = Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0);
    const brut = lignesVente(v).reduce((s, x) => s + Number(x.qte || 0) * Number(x.pu || 0) - Number(x.remise_ligne || 0), 0);
    if (!(brut > 0)) return 0;
    return net - (Number(v.remise || 0) + Number(v.rabais || 0)) * (net / brut);
  };
  const caV = (v) => {
    const lignes = lignesVente(v);
    const netL = (l) => Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0);
    const brut = lignes.reduce((s, l) => s + netL(l), 0);
    const inclus = lignes.reduce((s, l) => (l.hors_boutique ? s : s + netL(l)), 0);
    const part = brut > 0 ? inclus / brut : 0;
    if (part === 0) return 0;
    return Math.round(inclus - Number(v.remise || 0) * part - Number(v.rabais || 0) * part);
  };
  const somme = (v) => Math.round(lignesVente(v).reduce((s, l) => s + caLigne(v, l), 0));

  const venteRemisee = { articles: [{ qte: 2, pu: 300000 }, { qte: 1, pu: 400000 }], remise: 100000, rabais: 0 };
  const venteMixte = { articles: [{ qte: 1, pu: 600000 }, { qte: 1, pu: 400000, hors_boutique: true }], remise: 100000, rabais: 50000 };
  const venteSimple = { articles: [{ qte: 3, pu: 150000 }], remise: 0, rabais: 0 };

  test("★ le cas de l'audit : 1 000 000 remisés à 10 % font 900 000, pas 1 000 000",
    somme(venteRemisee) === 900000 && caV(venteRemisee) === 900000);
  test("★ la somme des lignes redonne le CA de la vente, au franc près",
    somme(venteRemisee) === caV(venteRemisee)
    && somme(venteMixte) === caV(venteMixte)
    && somme(venteSimple) === caV(venteSimple));
  test("★ une ligne « hors boutique » ne compte pour rien",
    caLigne(venteMixte, venteMixte.articles[1]) === 0);
  test("…et la réduction ne retombe QUE sur la part boutique",
    somme(venteMixte) === 600000 - Math.round(150000 * 0.6));
  test("sans remise ni rabais, rien ne change par rapport à avant",
    somme(venteSimple) === 450000);
}


titre("Une commission n'est due qu'apres la RECEPTION *et* le SOLDE de la dette");
{
  // ⚠ REGLE POSEE PAR TIMO (29/08/2026), apres sa propre question : « un
  // client qui n'a pas paye la totalite et qui signe le PV debloque les
  // commissions — comment sont-elles calculees ? »
  // Sur 1 000 000 F a 5 %, un client versant 300 000 F et signant son PV
  // rendait exigibles les 50 000 F du commercial, alors qu'il restait
  // 700 000 F a encaisser. Sa decision : « un franc ne sort pas de la caisse
  // avant d'y etre entre ».
  const vt = readFileSync("src/screens/Ventes.jsx", "utf8");
  const cal = readFileSync("src/lib/calculs.js", "utf8");
  const eq = readFileSync("src/screens/MonEquipe.jsx", "utf8");

  // (motif assoupli le 29/08 : la marque de proprietaire client_user_id
  //  s'est inseree entre id et vente_id — le lien, lui, n'a pas bouge)
  test("★ la dette nee d'une vente porte desormais le lien vers elle",
    /dettes: \[\{ id: uid\(\),[^}]{0,80}vente_id: vente\.id,/.test(vt));
  test("★ une commission est gelee tant que la dette n'est pas soldee",
    /commissionBloquee = \(v, db\) => v\.commission_a_la_reception === true\s*\n\s*\|\| \(db !== undefined && !venteSoldee\(db, v\)\)/.test(cal));
  test("★ la part du parrain suit la MEME regle",
    /partParrainBloquee = \(v, db\)[\s\S]{0,160}?!venteSoldee\(db, v\)/.test(cal));

  // ⚠ Le piege de ce chantier : `db` est facultatif. Un ecran qui l'oublie
  // n'a pas d'erreur — il applique l'ANCIENNE regle, en silence. On verifie
  // donc appel par appel.
  // ⚠ On ne peut PAS decouper ces appels a l'expression reguliere : ils
  // contiennent eux-memes des parentheses — `Number(u?.taux || 0)` — et le
  // decoupage naif s'arretait au mauvais endroit, signalant trois oublis qui
  // n'existaient pas. On compte donc les parentheses pour de bon.
  const appelComplet = (src, debut) => {
    let profondeur = 0;
    for (let i = src.indexOf("(", debut); i < src.length; i++) {
      if (src[i] === "(") profondeur++;
      else if (src[i] === ")" && --profondeur === 0) return src.slice(debut, i + 1);
    }
    return src.slice(debut, debut + 200);
  };
  const appels = [];
  for (const [nom, src] of [["MonEquipe", eq],
                            ["MaCommission", readFileSync("src/screens/MaCommission.jsx", "utf8")],
                            ["Dashboard", readFileSync("src/screens/Dashboard.jsx", "utf8")]]) {
    for (const m of src.matchAll(/\b(commissionVente|commissionEnAttente|commissionPour|repartirCommissions|repartirCommissionEquipe)\(/g)) {
      appels.push([nom, appelComplet(src, m.index)]);
    }
  }
  const oublis = appels.filter(([, appel]) => !/,\s*db\s*\)$/.test(appel.replace(/\s+/g, " ")));
  test(`★ les ${appels.length} appels des ecrans passent tous la base (aucun oubli)`,
    oublis.length === 0);
  if (oublis.length) oublis.forEach(([n, a]) => console.log(`      ↳ ${n} : ${a.slice(0, 70)}`));

  test("★ l'ecran DIT laquelle des deux raisons retient la commission",
    /⏳ \+ \{fmt\(st\.geleReception\)\} à la réception/.test(eq)
    && /💰 \+ \{fmt\(st\.gelePaiement\)\} — client doit \{fmt\(st\.resteClients\)\}/.test(eq));
  test("la confirmation de paiement annonce ce qui reste gele, et pourquoi",
    /attendent la réception de l'installation/.test(eq)
    && /le client n'a pas fini de payer/.test(eq));

  // ---- Le calcul lui-meme, rejoue a l'identique ----
  const resteAPayer = (d) => Math.max(0, Number(d.montant || 0) - Number(d.paye || 0));
  const detteDeVente = (db, v) => (v && v.id) ? (db.dettes || []).find((d) => d.vente_id === v.id) : undefined;
  const venteSoldee = (db, v) => { const d = detteDeVente(db, v); return (d ? resteAPayer(d) : 0) === 0; };
  const bloquee = (v, db) => v.commission_a_la_reception === true || (db !== undefined && !venteSoldee(db, v));

  const vComptant = { id: "v1" };
  const vCredit = { id: "v2" };
  const vAncienne = { id: "v3" };
  const base = { dettes: [
    { id: "d2", vente_id: "v2", montant: 1000000, paye: 300000 },
    { id: "d3", montant: 500000, paye: 0 },   // dette d'avant : aucun lien
  ] };

  test("★ le cas de Timo : 300 000 verses sur 1 000 000, PV signe → gelee",
    bloquee(vCredit, base) === true);
  test("★ le client solde : la commission devient due d'elle-meme",
    bloquee({ id: "v2" }, { dettes: [{ id: "d2", vente_id: "v2", montant: 1000000, paye: 1000000 }] }) === false);
  test("★ une vente reglee comptant n'attend rien (l'immense majorite)",
    bloquee(vComptant, base) === false);
  test("une vente non receptionnee reste gelee, meme sans dette",
    bloquee({ id: "v1", commission_a_la_reception: true }, base) === true);
  test("★ les ventes d'AVANT gardent l'ancienne regle (dette sans lien)",
    bloquee(vAncienne, base) === false);
  test("un versement partiel de plus ne suffit pas",
    bloquee({ id: "v2" }, { dettes: [{ id: "d2", vente_id: "v2", montant: 1000000, paye: 999999 }] }) === true);
}



// ============================================================
// LA LISTE DES VENTES, DANS UN VRAI NAVIGATEUR
// Timo (12/09/2026, capture) : « +1 autre ou +3 autres ne s'affiche pas…
// lorsqu'on clique sur la ligne, la suite apparaît, on clique encore (même
// ligne ou ailleurs) ça revient à 2 lignes » ; « remplacer l'icône de WhatsApp
// par le vrai icône WhatsApp ». On MONTE le vrai composant ArticlesVente
// (replié, déplié) et le vrai logo, et on lit ce que Chromium affiche.
// ============================================================
titre("La liste des ventes, mesurée dans Chromium : la suite des articles au clic, le logo WhatsApp");
{
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const dossier = mkdtempSync(join(tmpdir(), "bmi-ventes-"));
  const entree = join(dossier, "entree.jsx");
  writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArticlesVente } from "${process.cwd()}/src/screens/Ventes.jsx";
import { IconeWhatsApp } from "${process.cwd()}/src/components/ui.jsx";
const ventes = [
  { id: "a", articles: [{ article: "Panneau 400W", qte: 2, pu: 1 }, { article: "Batterie 200Ah", qte: 1, pu: 1 }, { article: "Onduleur 3kVA", qte: 1, pu: 1 }, { article: "Câble 6mm", qte: 10, pu: 1 }, { article: "Rail", qte: 4, pu: 1 }] },
  { id: "b", articles: [{ article: "Lampe", qte: 1, pu: 1 }, { article: "Prise", qte: 3, pu: 1 }, { article: "Interrupteur", qte: 2, pu: 1 }] },
];
function Liste() {
  const [venteDepliee, setVenteDepliee] = useState(null);
  return <table><tbody>{ventes.map((v) => (
    <tr key={v.id} data-vente={v.id} onClick={() => setVenteDepliee((d) => (d ? null : v.id))}>
      <td><ArticlesVente v={v} deplie={venteDepliee === v.id} /></td>
      <td onClick={(e) => e.stopPropagation()}><button data-bouton="wa"><IconeWhatsApp /></button></td>
    </tr>))}</tbody></table>;
}
createRoot(document.getElementById("r")).render(<Liste />);
`);
  const sortie = join(dossier, "bundle.js");
  await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
  const html = join(dossier, "index.html");
  writeFileSync(html, `<!doctype html><html><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await nav.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
  await page.goto(`file://${html}`);
  await new Promise((r) => setTimeout(r, 400));
  const texte = async (id) => (await page.innerText(`[data-vente="${id}"] td:first-child`)).replace(/\s+/g, " ").trim();
  test("★ repliée : deux articles puis « + 3 autres » (la ligne EST affichée), sans erreur", (await texte("a")) === "2× Panneau 400W 1× Batterie 200Ah + 3 autres ▾" && erreurs.length === 0);
  await page.click('[data-vente="a"] td:first-child');
  await new Promise((r) => setTimeout(r, 150));
  test("★ un clic sur la ligne : les cinq articles apparaissent, avec « Replier »", (await texte("a")) === "2× Panneau 400W 1× Batterie 200Ah 1× Onduleur 3kVA 10× Câble 6mm 4× Rail ▴ Replier");
  test("…et l'autre vente reste repliée", (await texte("b")) === "1× Lampe 3× Prise + 1 autre ▾");
  await page.click('[data-vente="b"] td:first-child');
  await new Promise((r) => setTimeout(r, 150));
  test("★ un clic AILLEURS (une autre ligne) replie tout : retour à 2 lignes par défaut", (await texte("a")) === "2× Panneau 400W 1× Batterie 200Ah + 3 autres ▾" && (await texte("b")) === "1× Lampe 3× Prise + 1 autre ▾");
  await page.click('[data-vente="a"] td:first-child');
  await new Promise((r) => setTimeout(r, 150));
  await page.click('[data-vente="a"] td:first-child');
  await new Promise((r) => setTimeout(r, 150));
  test("★ un second clic sur la MÊME ligne replie aussi", (await texte("a")) === "2× Panneau 400W 1× Batterie 200Ah + 3 autres ▾");
  await page.click('[data-vente="a"] [data-bouton="wa"]');
  await new Promise((r) => setTimeout(r, 150));
  test("★ cliquer un bouton d'action ne déplie pas la ligne", (await texte("a")) === "2× Panneau 400W 1× Batterie 200Ah + 3 autres ▾");
  const logo = await page.evaluate(() => { const p = document.querySelector('[data-bouton="wa"] svg path'); const r = document.querySelector('[data-bouton="wa"] svg').getBoundingClientRect(); return { fill: p && getComputedStyle(p).fill, w: r.width, h: r.height }; });
  test("★ le logo WhatsApp est dessiné en vert WhatsApp (#25D366), 18 px", logo.fill === "rgb(37, 211, 102)" && logo.w === 18 && logo.h === 18);
  test("aucune erreur JavaScript", erreurs.length === 0);
  await nav.close();
  rmSync(dossier, { recursive: true, force: true });
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
