// ============================================================
// scripts/tester-charge.mjs — L'APPLICATION TIENT-ELLE LA CHARGE ?
//
//   node scripts/tester-charge.mjs
//
// Demande de Timo : « peux-tu simuler 2000 utilisateurs actifs pour voir si
// l'application va bugger ? »
//
// ⚠ CE QUE CE BANC MESURE, ET CE QU'IL NE MESURE PAS.
//
// Il ne peut PAS simuler 2000 appareils qui se connectent en même temps :
// cela dépend du serveur Supabase, pas de l'application, et je ne toucherai
// jamais à la base de production pour le savoir.
//
// Il mesure ce qui, dans l'application, ralentit VRAIMENT quand les données
// grossissent : les calculs refaits à chaque affichage et à chaque
// enregistrement. C'est là que se produisent les blocages ressentis — l'écran
// qui fige une seconde en enregistrant une vente.
//
// Repères utilisés pour juger :
//   • moins de 50 ms   : invisible ;
//   • 50 à 200 ms      : perceptible, encore acceptable ;
//   • plus de 200 ms   : l'écran fige, l'utilisateur le sent ;
//   • plus de 1000 ms  : inutilisable.
// ============================================================
import { build } from "esbuild";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unlinkSync } from "node:fs";

const charger = async (chemin, nom) => {
  const sortie = join("node_modules", ".cache", `charge-${nom}-${process.pid}.mjs`);
  await build({ entryPoints: [chemin], bundle: true, format: "esm", platform: "node",
    outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" },
    external: ["react", "react-dom"] });
  const mod = await import(pathToFileURL(sortie).href);
  unlinkSync(sortie);
  return mod;
};

const C = await charger("src/lib/calculs.js", "calculs");
const Core = await charger("src/lib/core.js", "core");
const Paie = await charger("src/lib/paie.js", "paie");
const Reb = await charger("src/lib/rebase.js", "rebase");

// ---- La base d'essai, aux proportions d'une entreprise qui tourne depuis
// des années. 2000 comptes est très au-dessus de BMI Togo (46 aujourd'hui) :
// c'est justement l'intérêt, on cherche le point de rupture.
const N_USERS = 2000;
const N_VENTES = 40000;
const N_DETTES = 8000;
const N_PRODUITS = 4000;
const N_MESSAGES = 20000;
const N_CHANTIERS = 3000;

const BOUTIQUES = ["APESSITO", "HEDZRANAWOE", "DEMAKPOE", "AGOE", "APESSITO FORMATION"];

console.log("▸ Fabrication de la base d'essai…");
const t0 = Date.now();
const db = {
  boutiques: BOUTIQUES.map((nom, i) => ({ id: `b${i}`, nom, formation: nom.includes("FORMATION") })),
  users: Array.from({ length: N_USERS }, (_, i) => ({
    id: `u${i}`, nom: `EMPLOYE${i}`, role: i % 7 === 0 ? "commercial" : "vendeur",
    boutique: BOUTIQUES[i % 4], actif: true, taux_commission: 5,
    salaire_base: 120000, virements: [{ id: `v${i}`, mois: "2026-08", montant: 50000 }],
    credits: [], primes: [], avances: [], piece_num: `AB${i}`,
  })),
  ventes: Array.from({ length: N_VENTES }, (_, i) => ({
    id: `v${i}`, boutique: BOUTIQUES[i % 5], date: `2026-0${(i % 8) + 1}-15`,
    articles: [{ article: `Article ${i % 200}`, qte: 1 + (i % 4), pu: 25000 + (i % 100) * 500 }],
    remise: i % 10 === 0 ? 5000 : 0, rabais: i % 20 === 0 ? 2000 : 0,
    commercial: `EMPLOYE${(i * 7) % N_USERS}`, par: `EMPLOYE${i % N_USERS}`,
    paiement: "Espèces", numero: `APE-2026-${String(i).padStart(5, "0")}`,
  })),
  dettes: Array.from({ length: N_DETTES }, (_, i) => ({
    id: `d${i}`, boutique: BOUTIQUES[i % 5], client: `CLIENT ${i}`, montant: 200000,
    paye: 50000, paiements: [{ id: `p${i}`, date: "2026-08-01", montant: 50000, paiement: "Espèces" }],
  })),
  produits: Array.from({ length: N_PRODUITS }, (_, i) => ({
    id: `p${i}`, nom: `Article ${i}`, boutique: BOUTIQUES[i % 5], pu: 30000, stock_initial: 50,
  })),
  messages: Array.from({ length: N_MESSAGES }, (_, i) => ({
    id: `m${i}`, de_id: `u${i % N_USERS}`, a_id: `u${(i + 1) % N_USERS}`, texte: `Message ${i}`, lu_par: [],
  })),
  clients_installes: Array.from({ length: N_CHANTIERS }, (_, i) => ({
    id: `c${i}`, nom: `CHANTIER ${i}`, vente_id: `v${i}`, statut: "receptionne", equipe: [],
  })),
  depenses: [], ajustements: [], clotures: [], commandes: [], proformas: [],
  prospects: [], categories_prospects: [], fournisseurs: [], commerciaux: [],
  audits: [], groupes: [], paie: [],
};
const poids = Math.round(JSON.stringify(db).length / 1024 / 1024);
console.log(`  ${N_USERS} comptes · ${N_VENTES} ventes · ${N_DETTES} dettes · ${N_MESSAGES} messages`);
console.log(`  ≈ ${poids} Mo de données · fabriquées en ${Date.now() - t0} ms\n`);

let alertes = 0;
const mesurer = (titre, quand, fn) => {
  fn(); // premier passage : on ne mesure pas la mise en route
  const debut = process.hrtime.bigint();
  const r = fn();
  const ms = Number(process.hrtime.bigint() - debut) / 1e6;
  const verdict = ms < 50 ? "✅ invisible" : ms < 200 ? "🟡 perceptible" : ms < 1000 ? "🟠 l'écran fige" : "🔴 inutilisable";
  if (ms >= 200) alertes++;
  console.log(`  ${verdict.padEnd(18)} ${ms.toFixed(1).padStart(8)} ms   ${titre}`);
  if (quand) console.log(`  ${" ".repeat(18)} ${" ".repeat(11)} ↳ ${quand}`);
  return r;
};

console.log("▸ Ce qui tourne À CHAQUE AFFICHAGE");
mesurer("construireIndexDb — les index recalculés à chaque changement",
  "à chaque enregistrement, sur tous les écrans", () => C.construireIndexDb(db));
mesurer("Total des ventes d'une boutique (cœur du Tableau de bord)",
  "à l'ouverture du Tableau de bord", () =>
  (db.ventes || []).filter((v) => v.boutique === "APESSITO").reduce((s, v) => s + Core.totalVente(v), 0));
mesurer("apporteursPossibles — la liste des commerciaux à créditer",
  "à chaque ouverture de l'écran Ventes", () => C.apporteursPossibles(db, { id: "u1", role: "admin" }));
mesurer("fusionnerPaie — recoller les fiches de paie au chargement",
  "à chaque chargement de l'application", () => Paie.fusionnerPaie(db.users, db.paie));

console.log("\n▸ Ce qui tourne À CHAQUE ENREGISTREMENT");
const suivant = { ...db, ventes: [{ id: "vNEW", boutique: "APESSITO", articles: [], date: "2026-08-20" }, ...db.ventes] };
mesurer("verifierEcritureEspace — le verrou formation / réel",
  "à chaque vente, dépense, versement…", () => C.verifierEcritureEspace(db, suivant, { id: "u1", role: "vendeur", boutique: "APESSITO" }));
mesurer("separerPaie — détacher les fiches de paie avant d'écrire",
  "à chaque enregistrement", () => Paie.separerPaie(db.users, { id: "u1", admin: true }));
mesurer("rebaser — reporter une modification sur l'état à jour",
  "quand une fenêtre est restée ouverte pendant une synchro", () =>
  Reb.rebaser(db, suivant, db, ["ventes", "dettes", "users", "produits", "messages"]));

console.log("\n▸ LA COMPARAISON QUI PRÉCÈDE CHAQUE ÉCRITURE (sauvegarderDiff)");
console.log("  L'application compare l'ancien et le nouvel état pour savoir quoi envoyer.");
console.log("  Une table dont le tableau a été recopié est comparée LIGNE PAR LIGNE.");
const sansMeta = (r) => { const { updated_at, ...reste } = r || {}; return JSON.stringify(reste); };
mesurer("Comparer les 40 000 ventes une à une",
  "dès qu'un écran recopie la liste des ventes", () => {
    const avant = new Map(db.ventes.map((r) => [r.id, r]));
    let changes = 0;
    for (const r of suivant.ventes) {
      const a = avant.get(r.id);
      if (!a || sansMeta(a) !== sansMeta(r)) changes++;
    }
    return changes;
  });
mesurer("…avec le raccourci par référence (ce que fait le code aujourd'hui)",
  "quand la table n'a pas été touchée", () => {
    let ignorees = 0;
    for (const t of ["ventes", "dettes", "messages", "produits"]) {
      if (db[t] === suivant[t]) { ignorees++; continue; }
      const avant = new Map((db[t] || []).map((r) => [r.id, r]));
      for (const r of suivant[t] || []) {
        const a = avant.get(r.id);
        if (a && Object.is(a, r)) continue;
        if (!a || sansMeta(a) !== sansMeta(r)) { /* modifié */ }
      }
    }
    return ignorees;
  });


// ══════════════════════════════════════════════════════════════════
// OÙ EST LE POINT DE RUPTURE ?
// ══════════════════════════════════════════════════════════════════
// Savoir que « ça tient à 40 000 ventes » ne dit pas quand ça cassera. On
// monte donc jusqu'à ce que ça fige, pour connaître la marge réelle.
console.log("\n▸ JUSQU'OÙ ÇA TIENT — on monte le nombre de ventes");
console.log("  (repère : BMI Togo fait quelques dizaines de ventes par jour)\n");
console.log("     ventes   index    verrou   comparaison   verdict");

const chrono = (fn) => {
  fn();
  const d = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - d) / 1e6;
};

for (const n of [10000, 40000, 100000, 250000, 500000]) {
  const ventes = Array.from({ length: n }, (_, i) => ({
    id: `v${i}`, boutique: BOUTIQUES[i % 5], date: `2026-0${(i % 8) + 1}-15`,
    articles: [{ article: `Article ${i % 200}`, qte: 1, pu: 25000 }],
    remise: 0, rabais: 0, commercial: `EMPLOYE${i % N_USERS}`, paiement: "Espèces",
  }));
  const grand = { ...db, ventes };
  const apres = { ...grand, ventes: [{ id: "vNEW", boutique: "APESSITO", articles: [], date: "2026-08-20" }, ...ventes] };

  const tIndex = chrono(() => C.construireIndexDb(grand));
  const tVerrou = chrono(() => C.verifierEcritureEspace(grand, apres, { id: "u1", role: "vendeur", boutique: "APESSITO" }));
  const tComp = chrono(() => {
    const avant = new Map(ventes.map((r) => [r.id, r]));
    for (const r of apres.ventes) {
      const a = avant.get(r.id);
      if (a && Object.is(a, r)) continue;
      if (!a || sansMeta(a) !== sansMeta(r)) { /* modifié */ }
    }
  });
  const pire = Math.max(tIndex, tVerrou, tComp);
  const verdict = pire < 50 ? "✅ invisible" : pire < 200 ? "🟡 perceptible" : pire < 1000 ? "🟠 l'écran fige" : "🔴 inutilisable";
  console.log(`  ${String(n).padStart(9)}   ${tIndex.toFixed(0).padStart(5)}ms  ${tVerrou.toFixed(0).padStart(6)}ms  ${tComp.toFixed(0).padStart(10)}ms   ${verdict}`);
}

console.log("\n  ⚠ Rappel : ces mesures sont faites sur un serveur. Un téléphone");
console.log("  d'entrée de gamme est 3 à 5 fois plus lent — divisez la marge d'autant.");

console.log(`\n${alertes === 0 ? "✅" : "⚠️ "} ${alertes} point(s) au-dessus de 200 ms dans l'usage courant.`);
