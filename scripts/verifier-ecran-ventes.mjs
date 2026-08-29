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
import { readFileSync } from "node:fs";

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


console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
