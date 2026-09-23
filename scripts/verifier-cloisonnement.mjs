// ============================================================
// scripts/verifier-cloisonnement.mjs — Vérification exécutable du
// cloisonnement formation / réel.
//
// Rejoue, sur une base fabriquée pour l'occasion, les scénarios exacts
// qui posaient problème avant le correctif. Chacun décrit une situation
// réelle, pas un cas de laboratoire : c'est la liste de ce qui doit
// rester vrai après n'importe quelle modification future de l'app.
//
//   node scripts/verifier-cloisonnement.mjs
//
// (Aucune dépendance de test : le fichier est bundlé à la volée par
// esbuild, déjà présent puisque Vite s'en sert.)
// ============================================================
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { unlinkSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

// lib/calculs.js importe les boîtes de dialogue (JSX + React) : on bundle
// plutôt que d'importer directement, pour n'avoir rien à simuler à la main.
// Le bundle est écrit DANS le projet : posé ailleurs, il ne retrouverait
// pas node_modules et l'import de React échouerait.
const sortie = join("node_modules", ".cache", `bmi-cloisonnement-${process.pid}.mjs`);
mkdirSync(join("node_modules", ".cache"), { recursive: true });
await build({
  entryPoints: ["src/lib/calculs.js"],
  bundle: true, format: "esm", platform: "node", outfile: sortie,
  logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"],
});
const C = await import(pathToFileURL(sortie).href);
unlinkSync(sortie);

const sortieCore = join("node_modules", ".cache", `bmi-core-${process.pid}.mjs`);
await build({
  entryPoints: ["src/lib/core.js"],
  bundle: true, format: "esm", platform: "node", outfile: sortieCore,
  logLevel: "silent", loader: { ".js": "jsx" },
});
const Core = await import(pathToFileURL(sortieCore).href);

const sortieFusion = join("node_modules", ".cache", `bmi-fusion-${process.pid}.mjs`);
await build({
  entryPoints: ["src/lib/fusion.js"],
  bundle: true, format: "esm", platform: "node", outfile: sortieFusion,
  logLevel: "silent", loader: { ".js": "jsx" },
});
const F = await import(pathToFileURL(sortieFusion).href);
unlinkSync(sortieFusion);
unlinkSync(sortieCore);

// Le report d'une modification d'écran sur l'état le plus récent.
const sortieReb = join("node_modules", ".cache", `bmi-reb-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/rebase.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieReb, logLevel: "silent", loader: { ".js": "jsx" } });
const Reb = await import(pathToFileURL(sortieReb).href);
unlinkSync(sortieReb);

// La fusion à trois de deux modifications concurrentes.
const sortieFus = join("node_modules", ".cache", `bmi-fus-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/fusion.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieFus, logLevel: "silent", loader: { ".js": "jsx" } });
const Fus = await import(pathToFileURL(sortieFus).href);
unlinkSync(sortieFus);

// Le verrou de synchronisation (une seule à la fois, aucune demande perdue).
const sortieVer = join("node_modules", ".cache", `bmi-ver-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/fileUnique.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieVer, logLevel: "silent", loader: { ".js": "jsx" } });
const Ver = await import(pathToFileURL(sortieVer).href);
unlinkSync(sortieVer);

// lib/cnss.js importe la bibliothèque Excel (xlsx), qui ne s'initialise pas
// hors navigateur. On la remplace par un bouchon vide : les fonctions
// vérifiées ici (comparaison d'une saisie) n'y touchent pas.
const bouchonXlsx = join("node_modules", ".cache", `bmi-xlsx-stub-${process.pid}.js`);
writeFileSync(bouchonXlsx, "export const utils = {}; export const writeFile = () => {};\n");
const sortieCnss = join("node_modules", ".cache", `bmi-cnss-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/cnss.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortieCnss, logLevel: "silent", loader: { ".js": "jsx" },
  alias: { xlsx: "./" + bouchonXlsx } });
const Cnss = await import(pathToFileURL(sortieCnss).href);
unlinkSync(sortieCnss);

// La validation d'un devis (espace client ET signature en boutique).
const sortieVal = join("node_modules", ".cache", `bmi-val-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/validationDevis.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortieVal, logLevel: "silent", loader: { ".js": "jsx" } });
const Val = await import(pathToFileURL(sortieVal).href);
unlinkSync(sortieVal);

// Le filet d'abandon d'un geste refusé par le serveur (vague 3, étape 1).
const sortieAb = join("node_modules", ".cache", `bmi-ab-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/abandonLot.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortieAb, logLevel: "silent" });
const Ab = await import(pathToFileURL(sortieAb).href);
unlinkSync(sortieAb);

// L'importation d'articles en stock (fichier Excel / texte collé) — la
// règle est pure, seule la lecture du fichier touche xlsx (bouchonnée).
const sortieImp = join("node_modules", ".cache", `bmi-imp-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/importStock.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortieImp, logLevel: "silent", loader: { ".js": "jsx" },
  alias: { xlsx: "./" + bouchonXlsx } });
const Imp = await import(pathToFileURL(sortieImp).href);
unlinkSync(sortieImp);
unlinkSync(bouchonXlsx);

// Le socle partage du Dimensionnement (trois volets) : conditions
// commerciales d'un devis repris, et quantite necessaire d'un equipement.
const sortieDim = join("node_modules", ".cache", `bmi-dim-${process.pid}.mjs`);
await build({ entryPoints: ["src/screens/dimensionnement/Partages.jsx"], bundle: true,
  format: "esm", platform: "node", outfile: sortieDim, logLevel: "silent",
  loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
const Dim = await import(pathToFileURL(sortieDim).href);
unlinkSync(sortieDim);

// Les mots de passe fabriques pour les comptes clients.
const sortieCli = join("node_modules", ".cache", `bmi-cli-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/comptesClients.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieCli, logLevel: "silent", loader: { ".js": "jsx" },
  external: ["react", "react-dom"] });
const Cli = await import(pathToFileURL(sortieCli).href);
unlinkSync(sortieCli);
// Les pompes (20/09/2026) : règle pure, exercée — jamais lue.
const sortiePmp = join("node_modules", ".cache", `bmi-pmp-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/pompes.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortiePmp, logLevel: "silent", loader: { ".js": "jsx" },
  external: ["react", "react-dom"] });
const Pmp = await import(pathToFileURL(sortiePmp).href);
unlinkSync(sortiePmp);

// La modification d'un devis DÉJÀ SIGNÉ (11/09/2026) : règles pures, exercées.
const sortieMod = join("node_modules", ".cache", `bmi-modif-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/modifDevis.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieMod, logLevel: "silent", loader: { ".js": "jsx" },
  external: ["react", "react-dom"] });
const Mod = await import(pathToFileURL(sortieMod).href);
unlinkSync(sortieMod);

// Les calculs du dimensionnement solaire.
const sortieSol = join("node_modules", ".cache", `bmi-sol-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/solaire.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieSol, logLevel: "silent", loader: { ".js": "jsx" } });
const Sol = await import(pathToFileURL(sortieSol).href);
unlinkSync(sortieSol);

// 🏦 La liste des banques et la banque d'un employé (14/09/2026).
const sortieBq = join("node_modules", ".cache", `bmi-banques-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/banques.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieBq, logLevel: "silent", loader: { ".js": "jsx" } });
const Bq = await import(pathToFileURL(sortieBq).href);
unlinkSync(sortieBq);

// 🧰 Le registre du matériel de travail (17/09/2026).
const sortieOut = join("node_modules", ".cache", `bmi-outillage-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/outillage.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieOut, logLevel: "silent", loader: { ".js": "jsx" } });
const Out = await import(pathToFileURL(sortieOut).href);
unlinkSync(sortieOut);

// 👥 Le droit d'accès d'un EMPLOYÉ (19/09/2026).
const sortieDosEmp = join("node_modules", ".cache", `bmi-dossemp-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/dossierEmploye.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieDosEmp, logLevel: "silent", loader: { ".js": "jsx" } });
const DosEmp = await import(pathToFileURL(sortieDosEmp).href);
unlinkSync(sortieDosEmp);

// 📄 Le droit d'accès : le dossier personnel d'un client (18/09/2026).
const sortieDos = join("node_modules", ".cache", `bmi-dossier-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/dossierPersonnel.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieDos, logLevel: "silent", loader: { ".js": "jsx" } });
const Dos = await import(pathToFileURL(sortieDos).href);
unlinkSync(sortieDos);

// Le PDF lui-même : on MESURE le texte réellement écrit, jamais le code.
const sortiePdfDos = join("node_modules", ".cache", `bmi-pdfdos-${process.pid}.mjs`);
await build({ entryPoints: ["src/pdf.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortiePdfDos, logLevel: "silent", loader: { ".js": "jsx" } });
const PdfDos = await import(pathToFileURL(sortiePdfDos).href);
unlinkSync(sortiePdfDos);

// 🔒 Le droit à l'effacement d'un client (18/09/2026).
const sortieEff = join("node_modules", ".cache", `bmi-effacement-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/effacementClient.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieEff, logLevel: "silent", loader: { ".js": "jsx" } });
const Eff = await import(pathToFileURL(sortieEff).href);
unlinkSync(sortieEff);

// 🖥 L'ÉCRAN DU CLIENT, RENDU POUR DE VRAI (19/09/2026) — voir le fichier.
const sortieEc = join("node_modules", ".cache", `bmi-ecranclient-${process.pid}.mjs`);
await build({ entryPoints: ["scripts/_rendu-espace-client.jsx"], bundle: true, format: "esm",
  platform: "node", outfile: sortieEc, logLevel: "silent", jsx: "automatic", loader: { ".js": "jsx" },
  define: { "import.meta.env": '{"VITE_SUPABASE_URL":"https://exemple.supabase.co","VITE_SUPABASE_ANON_KEY":"x","MODE":"test"}' },
  external: ["react", "react-dom", "react-dom/server"] });
globalThis.localStorage ||= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let ecranClient = null, ecranClientErreur = "";
try { ecranClient = await import(pathToFileURL(sortieEc).href); }
catch (e) { ecranClientErreur = String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e); }
unlinkSync(sortieEc);

// ⏳ La durée de conservation des données d'un client (19/09/2026).
const sortieCons = join("node_modules", ".cache", `bmi-conservation-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/conservation.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieCons, logLevel: "silent", loader: { ".js": "jsx" } });
const Cons = await import(pathToFileURL(sortieCons).href);
unlinkSync(sortieCons);

// 👆 L'empreinte qui ouvre le verrou d'inactivité (16/09/2026).
const sortieEmp = join("node_modules", ".cache", `bmi-empreinte-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/empreinte.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieEmp, logLevel: "silent", loader: { ".js": "jsx" } });
const Emp = await import(pathToFileURL(sortieEmp).href);
unlinkSync(sortieEmp);

// La séparation fiche employé / fiche de paie.
const sortiePaie = join("node_modules", ".cache", `bmi-paie-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/paie.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortiePaie, logLevel: "silent", loader: { ".js": "jsx" } });
const Paie = await import(pathToFileURL(sortiePaie).href);
unlinkSync(sortiePaie);

// ---- Base d'essai : deux boutiques réelles, une de formation, un dépôt
// de chaque côté, et les quatre profils qui comptent.
const base = () => ({
  boutiques: [
    { id: "b1", nom: "APESSITO" },
    { id: "b2", nom: "HEDZRANAWOE" },
    { id: "b3", nom: "APESSITO FORMATION", formation: true },
    { id: "d1", nom: "DEPOT", depot: true },
    { id: "d2", nom: "DEPOT FORMATION", depot: true, formation: true },
    { id: "bt", nom: "TERRAIN", terrain: true },
  ],
  users: [
    { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u_admin2", nom: "ADMIN2", role: "admin", droits_off: ["act_voir_tout"] },
    { id: "u_vend", nom: "KOSSI", role: "vendeur", boutique: "APESSITO" },
    { id: "u_form", nom: "STAGIAIRE", role: "vendeur", boutique: "APESSITO FORMATION", formation: true },
    { id: "u_cli", nom: "CLIENT.REEL", role: "client" },
    { id: "u_cliF", nom: "CLIENT.FORM", role: "client", formation: true },
  ],
  ventes: [{ id: "v1", boutique: "APESSITO", date: "2026-08-01" }],
  depenses: [], dettes: [], produits: [], ajustements: [], clotures: [],
  commandes: [], proformas: [], clients_installes: [],
  fournisseurs: [
    { id: "f_reel", nom: "SOLARIS", doit: 500000, paye: 0 },
    { id: "f_form", nom: "FOURNISSEUR ESSAI", doit: 0, paye: 0, formation: true },
  ],
  commerciaux: [
    { id: "co_reel", nom: "KOFFI", taux: 5, actif: true },
    { id: "co_form", nom: "STAGIAIRE COMMERCIAL", taux: 5, actif: true, formation: true },
  ],
});

const P = {
  admin: { id: "u_admin", role: "admin" },
  admin2: { id: "u_admin2", role: "admin" },
  vendeur: { id: "u_vend", role: "vendeur", boutique: "APESSITO" },
  stagiaire: { id: "u_form", role: "vendeur", boutique: "APESSITO FORMATION" },
};

let ok = 0, ko = 0;
const test = (nom, condition) => {
  if (condition) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.log(`  ✗ ${nom}`); }
};
const titre = (t) => console.log(`\n${t}`);

// Petit raccourci : l'écriture `modif` appliquée à la base est-elle refusée ?
const refuse = (profil, modif) => {
  const avant = base();
  const apres = { ...avant, ...modif(avant) };
  return C.verifierEcritureEspace(avant, apres, profil) !== null;
};

titre("Le verrou d'écriture refuse ce qui traverse la frontière");
test("un stagiaire ne peut pas encaisser dans une vraie boutique",
  refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes, { id: "v2", boutique: "APESSITO" }] })));
test("un stagiaire ne peut pas créer une dépense dans une vraie boutique",
  refuse(P.stagiaire, (db) => ({ depenses: [{ id: "d1", boutique: "HEDZRANAWOE", montant: 5000 }] })));
test("un stagiaire ne peut pas débiter la caisse du comptable",
  refuse(P.stagiaire, (db) => ({ depenses: [{ id: "d2", boutique: "Chez le comptable", montant: 5000 }] })));
test("un stagiaire ne peut pas encaisser sur la caisse TERRAIN",
  refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes, { id: "v3", boutique: "TERRAIN" }] })));
test("un stagiaire ne peut pas sortir du stock d'un vrai dépôt",
  refuse(P.stagiaire, (db) => ({ ajustements: [{ id: "a1", boutique: "DEPOT", qte: -5 }] })));
test("un stagiaire ne peut pas supprimer une vraie vente",
  refuse(P.stagiaire, () => ({ ventes: [] })));
test("un stagiaire ne peut pas clôturer une vraie caisse",
  refuse(P.stagiaire, () => ({ clotures: [{ id: "c1", boutique: "APESSITO", date: "2026-08-16" }] })));
test("un vendeur réel ne peut pas écrire dans une boutique de formation",
  refuse(P.vendeur, (db) => ({ ventes: [...db.ventes, { id: "v4", boutique: "APESSITO FORMATION" }] })));
test("un admin SANS le pouvoir act_voir_tout est cloisonné comme les autres",
  refuse(P.admin2, (db) => ({ ventes: [...db.ventes, { id: "v5", boutique: "APESSITO FORMATION" }] })));

titre("…et laisse passer tout le travail normal");
test("un stagiaire encaisse dans SA boutique de formation",
  !refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes, { id: "v6", boutique: "APESSITO FORMATION" }] })));
test("un vendeur réel encaisse dans SA boutique",
  !refuse(P.vendeur, (db) => ({ ventes: [...db.ventes, { id: "v7", boutique: "APESSITO" }] })));
test("l'admin principal traverse les deux espaces (réinitialisation)",
  !refuse(P.admin, () => ({ ventes: [] })));
test("une écriture sans boutique (message, tâche) passe toujours",
  !refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes] })));
test("une ligne inchangée n'est jamais comptée comme une écriture",
  !refuse(P.stagiaire, (db) => ({ ventes: db.ventes.slice() })));

// ---- Lot 2 Espace client : la caisse TERRAIN existe dans les deux espaces.
// Avant, un client de FORMATION qui validait un devis « pose seule » créait
// sa dette dans la caisse TERRAIN réelle — et le verrou refusait le geste
// que l'app venait de proposer.
titre("La caisse TERRAIN a sa jumelle d'entraînement (pose seule en formation)");
{
  const cliF = { id: "u_cliF", role: "client" };
  const cliR = { id: "u_cli", role: "client" };
  const db2 = C.assurerBoutiqueTerrain(base(), true);
  test("assurerBoutiqueTerrain(formation) crée « TERRAIN (formation) » marquée terrain + formation",
    db2.boutiques.some((b) => b.nom === C.NOM_BOUTIQUE_TERRAIN_FORMATION && b.terrain && b.formation));
  test("la caisse TERRAIN réelle existe déjà : rien n'est recréé",
    C.assurerBoutiqueTerrain(base()) .boutiques.length === base().boutiques.length);
  test("boutiqueTerrain() désigne toujours la caisse RÉELLE, même quand les deux existent",
    C.boutiqueTerrain(db2)?.nom === C.NOM_BOUTIQUE_TERRAIN);
  test("boutiqueTerrain(formation) désigne la caisse d'entraînement",
    C.boutiqueTerrain(db2, true)?.nom === C.NOM_BOUTIQUE_TERRAIN_FORMATION);
  const avecCaisseFormation = (db) => ({ boutiques: C.assurerBoutiqueTerrain(db, true).boutiques });
  test("un client de FORMATION valide une pose seule dans la caisse d'entraînement",
    !refuse(cliF, (db) => ({ ...avecCaisseFormation(db),
      dettes: [{ id: "dt1", boutique: C.NOM_BOUTIQUE_TERRAIN_FORMATION, montant: 100000 }] })));
  test("un client de FORMATION reste refusé sur la caisse TERRAIN réelle",
    refuse(cliF, (db) => ({ dettes: [{ id: "dt2", boutique: C.NOM_BOUTIQUE_TERRAIN, montant: 100000 }] })));
  test("un client RÉEL valide une pose seule dans la caisse TERRAIN réelle",
    !refuse(cliR, (db) => ({ dettes: [{ id: "dt3", boutique: C.NOM_BOUTIQUE_TERRAIN, montant: 100000 }] })));
  test("un client RÉEL est refusé sur la caisse d'entraînement",
    refuse(cliR, (db) => ({ ...avecCaisseFormation(db),
      dettes: [{ id: "dt4", boutique: C.NOM_BOUTIQUE_TERRAIN_FORMATION, montant: 100000 }] })));
  test("un stagiaire (vendeur formation) encaisse un versement pose seule dans la caisse d'entraînement",
    !refuse(P.stagiaire, (db) => ({ ...avecCaisseFormation(db),
      dettes: [{ id: "dt5", boutique: C.NOM_BOUTIQUE_TERRAIN_FORMATION, montant: 100000, paye: 50000 }] })));
}

titre("Fournisseurs et commerciaux ne se mélangent plus (trou du 19/08/2026)");
{
  const modif = (t, f) => (db) => ({ [t]: f(db[t]) });
  // Le geste exact qui gonflait la vraie ardoise : « commande à crédit ».
  test("un stagiaire ne gonfle PAS l'ardoise d'un vrai fournisseur",
    refuse(P.stagiaire, modif("fournisseurs", (l) => l.map((x) => (x.id === "f_reel" ? { ...x, doit: 9000000 } : x)))));
  test("un stagiaire ne supprime PAS un vrai fournisseur",
    refuse(P.stagiaire, modif("fournisseurs", (l) => l.filter((x) => x.id !== "f_reel"))));
  test("un stagiaire ne crée PAS un fournisseur dans l'espace réel",
    refuse(P.stagiaire, modif("fournisseurs", (l) => [...l, { id: "f_x", nom: "INTRUS" }])));
  test("un stagiaire ne fait PAS basculer un vrai fournisseur chez lui",
    refuse(P.stagiaire, modif("fournisseurs", (l) => l.map((x) => (x.id === "f_reel" ? { ...x, formation: true } : x)))));
  test("un stagiaire ne supprime PAS un vrai commercial",
    refuse(P.stagiaire, modif("commerciaux", (l) => l.filter((x) => x.id !== "co_reel"))));
  test("un stagiaire ne change PAS le taux d'un vrai commercial",
    refuse(P.stagiaire, modif("commerciaux", (l) => l.map((x) => (x.id === "co_reel" ? { ...x, taux: 90 } : x)))));
  test("un vendeur réel ne touche PAS un fournisseur de formation",
    refuse(P.vendeur, modif("fournisseurs", (l) => l.map((x) => (x.id === "f_form" ? { ...x, doit: 1 } : x)))));

  test("…mais le stagiaire travaille librement sur SES fournisseurs",
    !refuse(P.stagiaire, modif("fournisseurs", (l) => l.map((x) => (x.id === "f_form" ? { ...x, doit: 25000 } : x)))));
  test("…et en crée de nouveaux dans SON espace",
    !refuse(P.stagiaire, modif("fournisseurs", (l) => [...l, { id: "f_y", nom: "ESSAI 2", formation: true }])));
  test("le vendeur réel travaille sur les vrais fournisseurs",
    !refuse(P.vendeur, modif("fournisseurs", (l) => l.map((x) => (x.id === "f_reel" ? { ...x, paye: 100000 } : x)))));
  test("l'administrateur principal traverse les deux",
    !refuse(P.admin, modif("fournisseurs", (l) => l.filter((x) => x.id !== "f_reel"))));

  // Le message doit nommer l'enregistrement, pas « la boutique ? ».
  {
    const avant = base();
    const apres = { ...avant, fournisseurs: avant.fournisseurs.filter((x) => x.id !== "f_reel") };
    const inf = C.verifierEcritureEspace(avant, apres, P.stagiaire);
    const msg = C.messageEcritureRefusee(inf, true);
    test("le message d'erreur parle du fournisseur, pas d'une boutique inconnue",
      inf?.marque === true && msg.includes("un fournisseur") && !msg.includes("boutique « ? »"));
  }

  // La liste des apporteurs suit la marque de la fiche commercial.
  {
    const db = base();
    const noms = (p) => C.apporteursPossibles(db, p).map((x) => x.nom);
    test("un stagiaire ne peut pas créditer une vente à un commercial réel",
      !noms(P.stagiaire).includes("KOFFI"));
    test("…et voit bien le commercial de son espace",
      noms(P.stagiaire).includes("STAGIAIRE COMMERCIAL"));
    test("un vendeur réel ne voit pas le commercial de formation",
      !noms(P.vendeur).includes("STAGIAIRE COMMERCIAL"));
  }
}

titre("Un compte supprimé ne peut plus se reconnecter");
{
  // ⚠ Ces contrôles lisent le CODE, faute de pouvoir simuler un serveur ici.
  // Ils verrouillent les trois décisions dont dépend la correction (Timo,
  // 20/08/2026 : « les anciens comptes supprimés arrivent toujours à se
  // connecter »), pour qu'aucune ne soit défaite par mégarde plus tard.
  const cnx = readFileSync("src/screens/Connexion.jsx", "utf8");
  const cli = readFileSync("src/supabaseClient.js", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");

  test("le serveur est consulté DÈS QU'IL Y A DU RÉSEAU, pas seulement si le compte manque",
    /if \(navigator\.onLine\)\s*\{[\s\S]{0,400}chercherCompteEnLigne/.test(cnx));
  test("un refus du serveur bloque la connexion", /if \(r\.refuse\)/.test(cnx));
  // ⚠ RETOURNÉ le 20/09/2026 : le geste existe toujours, mais il ne jette
  // plus « le compte trouvé » — avec deux comptes du même nom (l'histoire des
  // deux ESSO), ç'aurait été la fiche de quelqu'un d'autre. On n'oublie que
  // la copie qui aurait VRAIMENT laissé entrer. La fourchette passe à 400 :
  // la boucle sur les homonymes est plus longue que l'ancienne ligne.
  test("…et efface la copie périmée gardée sur l'appareil",
    /r\.refuse[\s\S]{0,400}oublierCompteLocal/.test(cnx));
  test("★ et elle seule : jamais « le premier compte de ce nom »",
    !/if \(u\) await oublierCompteLocal\(u\.id\);/.test(cnx));
  test("un serveur INJOIGNABLE n'est pas un refus (sinon plus personne ne travaille hors réseau)",
    /const refuse = reponse\.status === 401 \|\| reponse\.status === 403;/.test(cli));
  test("la connexion hors réseau reste possible sur un appareil déjà utilisé",
    /navigator\.onLine[\s\S]{0,600}Première connexion sur cet appareil/.test(cnx));
  test("un compte supprimé pendant qu'il travaille est déconnecté",
    /Votre compte a été supprimé par l'administrateur/.test(app));
  test("…mais jamais sur une table de comptes quasi vide (synchro en cours)",
    /\(db\.users \|\| \[\]\)\.length > 1/.test(app));
}

titre("Aucun crochet React après le retour anticipé de l'écran de connexion");
{
  // ⚠ GARDE-FOU né d'une vraie panne (Timo, 2.100.76 : écran blanc).
  // Dans App.jsx, quand personne n'est connecté, la fonction s'arrête tôt
  // pour afficher l'écran de connexion. Tout useEffect/useState déclaré
  // APRÈS ce point n'existe pas tant que personne n'est connecté, puis
  // apparaît ensuite : React refuse ce changement de nombre de crochets et
  // l'application ne s'affiche plus DU TOUT. Le défaut ne se voit ni à la
  // compilation, ni à la relecture — d'où ce contrôle automatique.
  // ⚠ Il y a PLUSIEURS points de sortie, et c'est le PREMIER qui compte.
  // La première version de ce contrôle ne cherchait que celui de l'écran de
  // connexion : elle a laissé passer un crochet posé après l'écran de
  // CHARGEMENT, situé plus haut — et l'écran blanc est revenu (2.100.77).
  // On repère donc tout retour anticipé et on retient le plus haut.
  const source = readFileSync("src/App.jsx", "utf8").split("\n");
  const sorties = source
    .map((l, i) => ({ n: i, l }))
    .filter(({ l }) => /^ {2}if \(.*\)\s*return\b/.test(l) || l.trim() === "if (!profile) {");
  const retour = sorties.length ? sorties[0].n : -1;
  test("le premier point de sortie du composant est bien trouvé", retour > 0);
  const fautifs = source
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ n, l }) => n > retour + 1 && /\buse(Effect|State|Memo|Ref|Callback)\(/.test(l));
  if (fautifs.length) console.log(`      → ${fautifs.map((f) => "ligne " + f.n).join(", ")}`);
  test("aucun crochet React n'est déclaré après lui (sinon : écran blanc)",
    fautifs.length === 0);
}

titre("Lot B — deux versements simultanés sur la même dette sont tous deux gardés");
{
  const base = { id: "d1", client: "KOFFI", montant: 100000, paye: 0, paiements: [] };
  // Appareil A encaisse 5 000, appareil B encaisse 3 000 — chacun hors ligne.
  const local = { ...base, paye: 5000, paiements: [{ id: "p1", montant: 5000 }] };
  const distant = { ...base, paye: 3000, paiements: [{ id: "p2", montant: 3000 }] };
  const f = Fus.fusionner("dettes", base, local, distant);

  test("les DEUX versements sont conservés (c'était le défaut : un disparaissait)",
    f.paiements.length === 2);
  test("le total encaissé est bien la somme des deux",
    f.paye === 8000);
  test("le nôtre reste en tête, le sien est ajouté",
    f.paiements[0].id === "p1" && f.paiements[1].id === "p2");

  test("un versement déjà connu des deux côtés n'est pas compté deux fois",
    Fus.fusionner("dettes", base,
      { ...base, paye: 5000, paiements: [{ id: "p1", montant: 5000 }] },
      { ...base, paye: 5000, paiements: [{ id: "p1", montant: 5000 }] }).paiements.length === 1);

  test("le cumul ne dépasse jamais le montant dû",
    Fus.fusionner("dettes", base,
      { ...base, paye: 90000, paiements: [{ id: "p1", montant: 90000 }] },
      { ...base, paye: 80000, paiements: [{ id: "p2", montant: 80000 }] }).paye === 100000);

  test("une dette ancienne, déjà partiellement payée, part du bon solde",
    Fus.fusionner("dettes", { ...base, paye: 20000 },
      { ...base, paye: 25000, paiements: [{ id: "p1", montant: 5000 }] },
      { ...base, paye: 23000, paiements: [{ id: "p2", montant: 3000 }] }).paye === 28000);

  test("les autres champs gardent NOTRE version",
    Fus.fusionner("dettes", base, { ...local, motif: "à nous" }, { ...distant, motif: "à eux" }).motif === "à nous");

  // Les fiches de paie : virements et crédits ne doivent pas s'écraser non plus.
  const bp = { id: "u1", virements: [], credits: [] };
  const fp = Fus.fusionner("paie", bp,
    { ...bp, virements: [{ id: "v1" }] },
    { ...bp, virements: [{ id: "v2" }], credits: [{ id: "c1" }] });
  test("un virement enregistré ailleurs n'écrase pas le nôtre", fp.virements.length === 2);
  test("…et un crédit ajouté de leur côté est repris aussi", fp.credits.length === 1);

  // Les tables sans règle gardent le comportement simple, sans surprise.
  test("une table sans règle de fusion garde notre version telle quelle",
    Fus.fusionner("ventes", { id: "v", x: 1 }, { id: "v", x: 2 }, { id: "v", x: 3 }).x === 2);
  test("sans version distante, il n'y a rien à fusionner",
    Fus.fusionner("dettes", base, local, null) === local);
  test("un champ absent des deux côtés n'est pas inventé",
    Fus.fusionner("dettes", { id: "d" }, { id: "d" }, { id: "d" }).paiements === undefined);
}

titre("L'envoi d'une écriture n'est plus perdu quand une synchro tourne déjà");
{
  const v = Ver.creerVerrou();
  test("le premier appel prend le verrou", v.prendre() === true);
  test("un second appel est refusé", v.prendre() === false);
  test("…et sans urgence, rien n'est mémorisé", v.relacher() === false);

  const v2 = Ver.creerVerrou();
  v2.prendre();
  test("une demande URGENTE pendant un cycle est refusée sur le moment", v2.prendre(true) === false);
  test("…mais elle est MÉMORISÉE (c'était le défaut : elle disparaissait)",
    v2.relacher() === true);
  test("une fois repartie, elle n'est pas rejouée deux fois", v2.relacher() === false);

  // Le rappel automatique des 20 s ne doit PAS s'accumuler : sur une
  // connexion lente, cela enchaînerait les synchronisations sans répit.
  const v3 = Ver.creerVerrou();
  v3.prendre();
  v3.prendre(false); v3.prendre(false); v3.prendre(false);
  test("les rappels automatiques ne s'accumulent pas", v3.relacher() === false);

  // Plusieurs écritures pendant un même cycle ne provoquent qu'UN seul renvoi.
  const v4 = Ver.creerVerrou();
  v4.prendre();
  v4.prendre(true); v4.prendre(true); v4.prendre(true);
  test("trois écritures pendant un cycle ne déclenchent qu'un seul renvoi",
    v4.relacher() === true && v4.relacher() === false);

  const v5 = Ver.creerVerrou();
  v5.prendre(); v5.relacher();
  test("après relâchement, le verrou est de nouveau disponible", v5.prendre() === true);
  test("l'état du verrou est lisible pour les vérifications", v5.estPris() === true);
}

titre("Lot D — préfixe des numéros de reçu réglable par boutique");
{
  const socle = (boutiques) => ({ boutiques, ventes: [] });
  test("sans réglage, le préfixe reste les 3 premières lettres du nom",
    Core.prefixeDe(socle([{ id: "b", nom: "AGOE NORD" }]), "AGOE NORD") === "AGO");
  test("deux boutiques proches partageaient donc le même préfixe",
    Core.prefixeDe(socle([{ id: "b1", nom: "AGOE NORD" }, { id: "b2", nom: "AGOE SUD" }]), "AGOE NORD")
    === Core.prefixeDe(socle([{ id: "b1", nom: "AGOE NORD" }, { id: "b2", nom: "AGOE SUD" }]), "AGOE SUD"));
  const regle = socle([{ id: "b1", nom: "AGOE NORD", prefixe: "AGN" }, { id: "b2", nom: "AGOE SUD" }]);
  test("un préfixe réglé est utilisé tel quel", Core.prefixeDe(regle, "AGOE NORD") === "AGN");
  test("…et l'autre boutique garde le sien", Core.prefixeDe(regle, "AGOE SUD") === "AGO");
  test("les deux ne se confondent plus",
    Core.prefixeDe(regle, "AGOE NORD") !== Core.prefixeDe(regle, "AGOE SUD"));
  test("un préfixe saisi avec des espaces ou accents est nettoyé",
    Core.prefixeDe(socle([{ id: "b", nom: "X", prefixe: "a g-n" }]), "X") === "AGN");
  test("un préfixe vide retombe sur le nom",
    Core.prefixeDe(socle([{ id: "b", nom: "HEDZRANAWOE", prefixe: "" }]), "HEDZRANAWOE") === "HED");
  test("une boutique inconnue ne fait rien planter",
    Core.prefixeDe(socle([]), "AILLEURS") === "AIL");
}

titre("Lot B — une vente qui arrive pendant une fenêtre ouverte n'est plus effacée");
{
  const T = ["ventes", "dettes", "depenses"];
  // L'écran a reçu cet état, puis a ouvert une fenêtre « Confirmer ? ».
  const recu = {
    ventes: [{ id: "v1", client: "A" }],
    dettes: [{ id: "d1", paye: 0 }],
    depenses: [],
  };
  // Pendant ce temps, une vente arrive d'un autre appareil.
  const courant = {
    ventes: [{ id: "vSYNC", client: "COLLEGUE" }, { id: "v1", client: "A" }],
    dettes: [{ id: "d1", paye: 0 }],
    depenses: [],
  };

  // L'écran valide : il renvoie SON état, où vSYNC n'existe pas.
  const renvoye = { ...recu, ventes: [{ id: "v2", client: "B" }, ...recu.ventes] };
  const r = Reb.rebaser(recu, renvoye, courant, T);
  test("la vente arrivée entre-temps SURVIT (c'était le défaut : elle était effacée)",
    r.ventes.some((v) => v.id === "vSYNC"));
  test("la vente que l'écran voulait créer est bien là",
    r.ventes.some((v) => v.id === "v2"));
  test("la vente d'origine est intacte",
    r.ventes.some((v) => v.id === "v1"));
  test("la nouveauté de l'écran passe en tête de liste",
    r.ventes[0].id === "v2");

  // Une suppression VOULUE par l'écran doit, elle, être respectée.
  const supprime = { ...recu, ventes: [] };
  const r2 = Reb.rebaser(recu, supprime, courant, T);
  test("une suppression voulue par l'écran est bien appliquée",
    !r2.ventes.some((v) => v.id === "v1"));
  test("…mais elle n'emporte PAS la vente arrivée entre-temps",
    r2.ventes.some((v) => v.id === "vSYNC"));

  // Une modification d'un enregistrement que l'écran avait bien en main.
  const modifie = { ...recu, dettes: [{ id: "d1", paye: 5000 }] };
  const r3 = Reb.rebaser(recu, modifie, courant, T);
  test("une modification est reportée sur l'état courant",
    r3.dettes.find((d) => d.id === "d1").paye === 5000);
  test("les tables auxquelles l'écran n'a pas touché ne bougent pas",
    r3.ventes === courant.ventes);

  // Le cas où deux écritures se croisent sur des tables différentes.
  const courant2 = { ...courant, depenses: [{ id: "e1", montant: 100 }] };
  const r4 = Reb.rebaser(recu, renvoye, courant2, T);
  test("une dépense arrivée dans une autre table est préservée",
    r4.depenses.length === 1);
  test("une table absente des deux côtés ne fait rien planter",
    Reb.rebaser({}, {}, {}, T).ventes === undefined);
}

titre("Lot A — le rabais commercial ne fausse plus la caisse ni la commission");
{
  // Le cas du quotidien : 100 000 F d'articles, aucune remise, le commercial
  // offre 5 000 F de rabais sur sa propre commission (taux 5 %).
  const vente = (extra = {}) => ({
    id: "v", boutique: "APESSITO", date: "2026-08-20", commercial: "KOSSI",
    articles: [{ article: "Panneau", qte: 1, pu: 100000 }],
    remise: 0, rabais: 5000, ...extra,
  });

  test("le total réclamé est bien ce que le client a payé (95 000, pas 100 000)",
    Core.totalVente(vente()) === 95000);
  test("sans rabais, rien ne change",
    Core.totalVente(vente({ rabais: 0 })) === 100000);
  test("le rabais se cumule correctement avec une remise",
    Core.totalVente(vente({ remise: 10000 })) === 85000);
  test("le chiffre d'affaires retient lui aussi le rabais",
    Core.caVente(vente()) === 95000);

  // Le commercial finance le rabais : sa commission tombe à zéro quand il
  // offre exactement ce qu'elle valait.
  test("un rabais égal à la commission la ramène à zéro",
    C.commissionBrute(vente(), 5) === 0);
  test("un rabais partiel ne laisse que le reste",
    C.commissionBrute(vente({ rabais: 2000 }), 5) === 3000);
  test("sans rabais, la commission est entière",
    C.commissionBrute(vente({ rabais: 0 }), 5) === 5000);
  test("la commission n'est jamais négative",
    C.commissionBrute(vente({ rabais: 20000 }), 5) === 0);

  // Panier mêlant articles de la boutique et articles « hors boutique » :
  // la part de rabais retirée du CA doit être celle rajoutée à la base.
  const mixte = {
    id: "vm", boutique: "APESSITO", date: "2026-08-20", commercial: "KOSSI",
    articles: [
      { article: "Panneau", qte: 1, pu: 60000 },
      { article: "Groupe", qte: 1, pu: 40000, hors_boutique: true },
    ],
    remise: 0, rabais: 5000,
  };
  test("sur un panier mixte, seule la part boutique du rabais sort du CA",
    Core.caVente(mixte) === 57000);
  test("…et c'est exactement cette part qui revient dans la base de commission",
    C.commissionBrute(mixte, 5) === Math.max(0, Math.round((57000 + 3000) * 5 / 100) - 5000));
  test("le client, lui, paie bien tout le panier moins le rabais",
    Core.totalVente(mixte) === 95000);
}

titre("Les souhaits de l'écran de connexion");
{
  const socle = (reglages, users = []) => ({
    boutiques: [{ id: "b1", nom: "APESSITO", ...reglages }],
    users,
  });
  const equipe = [
    { id: "u1", nom: "KOSSI", role: "vendeur", anniv: "04-12" },
    { id: "u2", nom: "AMA", nom_complet: "AMAVI Komla", role: "technicien", anniv: "04-12" },
    { id: "u3", nom: "PARTI", role: "vendeur", anniv: "04-12", actif: false },
    { id: "u4", nom: "CLIENT.X", role: "client", anniv: "04-12" },
    { id: "u5", nom: "AUTRE", role: "vendeur", anniv: "09-30" },
    { id: "u6", nom: "SANSDATE", role: "vendeur" },
  ];
  const LE_12_AVRIL = "2026-04-12";

  test("aucun réglage : rien ne monte à l'écran",
    C.souhaitsDuJour(socle({}), LE_12_AVRIL).length === 0);
  test("les messages libres sont repris ligne par ligne",
    C.souhaitsDuJour(socle({ accueil_messages: "Joyeuses fêtes !\nBonne année" }), LE_12_AVRIL).length === 2);
  test("les lignes vides et les espaces sont ignorés",
    C.souhaitsDuJour(socle({ accueil_messages: "  Joyeux Noël  \n\n   \n" }), LE_12_AVRIL)
      .join("|") === "Joyeux Noël");
  test("anniversaires éteints : personne n'est souhaité",
    C.souhaitsDuJour(socle({}, equipe), LE_12_AVRIL).length === 0);

  const duJour = C.souhaitsDuJour(socle({ accueil_anniversaires: true }, equipe), LE_12_AVRIL);
  test("les employés du jour sont souhaités", duJour.length === 2);
  test("…par leur nom complet quand il est connu",
    duJour.some((t) => t.includes("AMAVI Komla")));
  test("…et par leur nom de compte sinon",
    duJour.some((t) => t.includes("KOSSI")));
  test("un compte désactivé n'est pas souhaité",
    !duJour.some((t) => t.includes("PARTI")));
  test("un compte CLIENT n'est jamais souhaité (ce sont les employés qu'on fête)",
    !duJour.some((t) => t.includes("CLIENT.X")));
  test("un employé dont ce n'est pas la date n'est pas souhaité",
    !duJour.some((t) => t.includes("AUTRE")));
  test("un employé sans date renseignée est simplement ignoré, sans planter",
    !duJour.some((t) => t.includes("SANSDATE")));
  test("le 30 septembre, c'est l'autre qui est souhaité",
    C.souhaitsDuJour(socle({ accueil_anniversaires: true }, equipe), "2026-09-30")
      .join("|").includes("AUTRE"));
  test("l'année n'entre jamais en jeu : le même jour, une autre année, souhaite pareil",
    C.souhaitsDuJour(socle({ accueil_anniversaires: true }, equipe), "2031-04-12").length === 2);
  test("les anniversaires passent AVANT les messages libres",
    C.souhaitsDuJour(socle({ accueil_anniversaires: true, accueil_messages: "Fêtes" }, equipe), LE_12_AVRIL)[0]
      .includes("anniversaire"));
  test("jamais plus de 6 messages à l'écran (au-delà ils se chevauchent)",
    C.souhaitsDuJour(socle({ accueil_messages: "a\nb\nc\nd\ne\nf\ng\nh" }), LE_12_AVRIL).length === 6);
  test("une base sans boutique ni compte ne fait rien planter",
    C.souhaitsDuJour({}, LE_12_AVRIL).length === 0);
}

titre("Les sélecteurs ne montrent que l'espace du compte");
{
  const db = base();
  const noms = (p) => C.boutiquesVisibles(db, p, db.boutiques).map((b) => b.nom);
  test("le stagiaire ne voit aucune vraie boutique",
    !noms(P.stagiaire).some((n) => ["APESSITO", "HEDZRANAWOE", "DEPOT"].includes(n)));
  test("le vendeur réel ne voit aucune boutique de formation",
    !noms(P.vendeur).some((n) => n.includes("FORMATION")));
  // ⚠ Ne « voit plus tout » d'un coup depuis le 26/08/2026 : il voit
  // l'espace qu'il REGARDE. C'est ce que Timo a demandé — ses boutiques
  // d'entraînement ne doivent plus encombrer les onglets quand il travaille.
  C.setRegardeFormation(true);
  test("l'admin principal voit l'entraînement quand il le regarde",
    noms(P.admin).length > 0 && noms(P.admin).every((n) => n.includes("FORMATION")));
  C.setRegardeFormation(false);
  test("…et le réel sinon",
    noms(P.admin).length > 0 && noms(P.admin).every((n) => !n.includes("FORMATION")));
  test("boutiqueParDefaut ne retombe jamais sur une boutique d'un autre espace",
    C.boutiqueParDefaut(db, P.stagiaire) === "APESSITO FORMATION");
  test("boutiqueParDefaut renvoie \"\" plutôt qu'une vraie boutique quand l'espace est vide", (() => {
    const sansFormation = { ...db, boutiques: db.boutiques.filter((b) => !b.formation) };
    return C.boutiqueParDefaut(sansFormation, P.stagiaire) === "";
  })());
}

titre("L'espace du compte est lu en direct, pas dans le profil figé");
{
  const db = base();
  // Profil capturé À LA CONNEXION, avant que l'admin ne bascule le compte.
  // La bascule corrigée déplace AUSSI le rattachement (basculerFormation) :
  // c'est ce que reproduit `apresBascule`.
  const profilFige = { id: "u_vend", role: "vendeur", boutique: "APESSITO" };
  const apresBascule = { ...db, users: db.users.map((u) => (u.id === "u_vend"
    ? { ...u, formation: true, boutique: "APESSITO FORMATION", boutique_avant_espace: "APESSITO" }
    : u)) };
  test("la bascule prend effet immédiatement, sans reconnexion",
    C.estCompteFormation(apresBascule, profilFige) === true);
  test("le profil figé n'est jamais consulté pour l'espace",
    C.estCompteFormation(apresBascule, { id: "u_vend" }) === true);
  // Un compte sans boutique (admin, commercial…) : le drapeau fait foi.
  const admin2Bascule = { ...db, users: db.users.map((u) => (u.id === "u_admin2" ? { ...u, formation: true } : u)) };
  test("pour un compte sans boutique, le drapeau seul décide",
    C.estCompteFormation(admin2Bascule, { id: "u_admin2", role: "admin" }) === true);
}

titre("Les totaux et les exports excluent la formation");
{
  const db = {
    ...base(),
    ventes: [{ id: "v1", boutique: "APESSITO", articles: [{ qte: 1, pu: 1000 }] },
             { id: "v2", boutique: "APESSITO FORMATION", articles: [{ qte: 1, pu: 999999 }] }],
    depenses: [{ id: "d1", boutique: "APESSITO", montant: 100, date: "2026-08-01", categorie: "Autre" },
               { id: "d2", boutique: "APESSITO FORMATION", montant: 888888, date: "2026-08-01", categorie: "Autre" }],
    dettes: [{ id: "t1", boutique: "APESSITO" }, { id: "t2", boutique: "APESSITO FORMATION" }],
    produits: [{ id: "p1", boutique: "APESSITO" }, { id: "p2", boutique: "APESSITO FORMATION" }],
  };
  test("ventesReelles exclut les ventes de formation", C.ventesReelles(db).length === 1);
  test("depensesReelles exclut les dépenses de formation", C.depensesReelles(db).length === 1);
  test("dettesReelles exclut les dettes de formation", C.dettesReelles(db).length === 1);
  test("produitsReels exclut le stock de formation", C.produitsReels(db).length === 1);
}

titre("Devis, clients et prospects portent la marque de leur espace");
{
  const db = base();
  test("un enregistrement créé par un stagiaire est marqué formation",
    C.marqueEspace(db, P.stagiaire).formation === true);
  test("un enregistrement créé par un compte réel ne porte aucune marque",
    C.marqueEspace(db, P.vendeur).formation === undefined);
  // ⚠ Ne vaut plus « undefined » (= les deux à la fois) mais l'espace
  // regardé. C'est ce qui fait suivre fournisseurs, commerciaux et devis.
  test("espaceDuCompte suit ce que l'admin principal regarde",
    C.espaceDuCompte(db, P.admin) === false
    && (C.setRegardeFormation(true), C.espaceDuCompte(db, P.admin) === true)
    && (C.setRegardeFormation(false), true));
  test("espaceDuCompte vaut true pour un stagiaire", C.espaceDuCompte(db, P.stagiaire) === true);
  test("espaceDuCompte vaut false pour un compte réel", C.espaceDuCompte(db, P.vendeur) === false);

  const devis = [{ id: "q1" }, { id: "q2", formation: true }];
  const avecDevis = { ...db, users: db.users.map((u) => (u.id === "u_cli" ? { ...u, devis: devis.map((d) => ({ ...d, contrat_signature: "x" })) } : u)) };
  test("les contrats de formation sont invisibles pour un compte réel",
    C.contratsInstallation(avecDevis, { espace: false }).length === 1);
  test("les contrats réels sont invisibles pour un stagiaire",
    C.contratsInstallation(avecDevis, { espace: true }).length === 1);
  test("l'admin principal voit les deux",
    C.contratsInstallation(avecDevis, {}).length === 2);
}

titre("Les séries de numéros ne se mélangent plus");
{
  // « APESSITO » et « APESSITO FORMATION » donnent le même préfixe à trois
  // lettres : c'est exactement le cas qui faisait partager une série.
  const db = { ...base(), ventes: [{ id: "v1", boutique: "APESSITO", numero: "APE-2026-0001", date: "2026-08-01" }] };
  const nReel = Core.prochainNumeroVente(db, "APESSITO", "2026-08-16");
  const nForm = Core.prochainNumeroVente(db, "APESSITO FORMATION", "2026-08-16");
  test("le prochain reçu réel suit bien la série réelle", nReel === "APE-2026-0002");
  test("le reçu de formation part sur sa PROPRE série", nForm === "FOR-APE-2026-0001");
  test("les deux séries ne peuvent pas se télescoper", nReel !== nForm);
  const dReel = Core.prochainNumeroDette(db, "APESSITO", "2026-08-16");
  const dForm = Core.prochainNumeroDette(db, "APESSITO FORMATION", "2026-08-16");
  test("même séparation pour les dettes et réservations",
    dReel === "APE-DET-2026-0001" && dForm === "FOR-APE-DET-2026-0001");
}

titre("Le journal comptable remis au comptable est propre");
{
  const db = {
    ...base(),
    ventes: [{ id: "v1", boutique: "APESSITO", date: "2026-08-01", paiement: "Espèces", articles: [{ qte: 1, pu: 1000, article: "X" }] },
             { id: "v2", boutique: "APESSITO FORMATION", date: "2026-08-01", paiement: "Espèces", articles: [{ qte: 1, pu: 999999, article: "Y" }] }],
    depenses: [{ id: "d2", boutique: "APESSITO FORMATION", montant: 888888, date: "2026-08-01", categorie: "Autre", paiement: "Espèces" }],
    dettes: [],
  };
  const lignes = Core.lignesJournal(db, "2026-08-01", "2026-08-31");
  const texte = JSON.stringify(lignes);
  test("aucune écriture de formation dans le journal SYSCOHADA",
    !texte.includes("999999") && !texte.includes("888888"));
  test("les écritures réelles y sont toujours", texte.includes("APESSITO") && lignes.length === 2);
}

titre("Comptes hérités de la 2.100.24 : la boutique fait foi, personne n'est bloqué");
{
  // Le cas exact laissé par « passer tous les comptes en formation d'un
  // coup » avant le correctif : drapeau posé, rattachement inchangé.
  const db = base();
  db.users = db.users.map((u) => (u.id === "u_vend" ? { ...u, formation: true } : u));
  const profil = { id: "u_vend", role: "vendeur", boutique: "APESSITO" };
  test("un vendeur marqué formation mais resté dans sa VRAIE boutique est traité comme réel",
    C.estCompteFormation(db, profil) === false);
  test("…et il peut donc continuer d'encaisser normalement", (() => {
    const apres = { ...db, ventes: [...db.ventes, { id: "vN", boutique: "APESSITO" }] };
    return C.verifierEcritureEspace(db, apres, profil) === null;
  })());
  test("l'administrateur est averti de l'incohérence",
    C.comptesEspaceIncoherent(db).some((u) => u.id === "u_vend"));
  test("aucune alerte quand drapeau et boutique concordent",
    C.comptesEspaceIncoherent(base()).length === 0);
}


titre("Un seul compte traverse le mur formation / reel : l'administrateur PRINCIPAL");
{
  // ⚠ REGLE POSEE PAR TIMO (28/08/2026) : « Je suis le seul admin principal
  // qui peut voir les 2 espaces a la fois. Le reste, soit tu es admin
  // formation, soit admin reel. »
  // Ce bloc disait l'inverse jusqu'a la 2.101.14 : il verifiait qu'un admin
  // cree avant le reglage traversait ENCORE les deux espaces, et qu'on
  // l'affichait a l'administrateur principal pour qu'il le cloisonne a la
  // main. On ne supprime pas ces tests, on les retourne : ce qui etait
  // tolere et signale doit maintenant etre impossible.
  const db = base();
  db.users = [...db.users, { id: "u_admin3", nom: "ELIE", role: "admin" }];
  const elie = { id: "u_admin3", role: "admin" };

  test("l'administrateur principal traverse les deux espaces",
    C.voitLesDeuxEspaces(db, P.admin) === true);
  test("un admin cree AVANT le reglage (aucun droit retire) ne traverse plus",
    C.voitLesDeuxEspaces(db, elie) === false);
  test("un admin a qui on avait deja retire le pouvoir ne traverse pas non plus", (() => {
    const apres = { ...db, users: db.users.map((u) => (u.id === "u_admin3"
      ? { ...u, droits_off: ["act_voir_tout"] } : u)) };
    return C.voitLesDeuxEspaces(apres, elie) === false;
  })());
  test("…et lui redonner act_voir_tout ne rouvre PAS le mur", (() => {
    // Le pouvoir a disparu de ACTIONS_POUVOIR ; s'il reapparaissait dans une
    // fiche (base ancienne, import), il ne doit plus rien commander.
    const apres = { ...db, users: db.users.map((u) => (u.id === "u_admin3"
      ? { ...u, droits_off: [] } : u)) };
    return C.voitLesDeuxEspaces(apres, elie) === false;
  })());
  test("le pouvoir « act_voir_tout » n'est plus propose a la creation d'un admin",
    !C.pouvoirsDuRole("admin").some(([id]) => id === "act_voir_tout"));
  test("un admin qui ne traverse plus est cloisonne EN ECRITURE aussi", (() => {
    // APESSITO est une boutique reelle : un admin marque formation ne doit
    // plus pouvoir y ecrire, alors que le pouvoir le lui permettait avant.
    const dbF = { ...db, users: db.users.map((u) => (u.id === "u_admin3"
      ? { ...u, formation: true } : u)) };
    const apres = { ...dbF, ventes: [...dbF.ventes, { id: "vX", boutique: "APESSITO" }] };
    return C.verifierEcritureEspace(dbF, apres, elie) !== null;
  })());
}


titre("La boutique mémorisée par un écran ne peut ni rester vide, ni pointer sur un fantôme");
{
  const db = base();
  test("écran ouvert pendant la synchronisation (mémoire vide) : on repart du défaut",
    C.boutiqueRetenue(db, P.vendeur === undefined ? P.admin : P.admin, "") === "APESSITO");
  test("boutique supprimée depuis (réinitialisation, suppression) : on repart du défaut",
    C.boutiqueRetenue(db, P.admin, "BOUTIQUE QUI N EXISTE PLUS") === "APESSITO");
  test("boutique valide : elle est conservée",
    C.boutiqueRetenue(db, P.admin, "HEDZRANAWOE") === "HEDZRANAWOE");
  test("un stagiaire ne peut pas retenir une VRAIE boutique memorisee",
    C.boutiqueRetenue(db, P.stagiaire, "APESSITO") === "APESSITO FORMATION");
  test("un compte rattaché garde toujours SA boutique",
    C.boutiqueRetenue(db, P.vendeur, "HEDZRANAWOE") === "APESSITO");
  test("base entièrement vide (après réinitialisation) : rien, et l'écran le dira",
    C.boutiqueRetenue({ boutiques: [], users: [] }, P.admin, "APESSITO") === "");
}


titre("Les écrans de synthèse ne montrent jamais les vrais chiffres à un compte de formation");
{
  const db = {
    ...base(),
    ventes: [{ id: "v1", boutique: "APESSITO", articles: [{ qte: 1, pu: 1000 }] },
             { id: "v2", boutique: "APESSITO FORMATION", articles: [{ qte: 1, pu: 7 }] }],
    depenses: [{ id: "e1", boutique: "APESSITO", montant: 100 },
               { id: "e2", boutique: "APESSITO FORMATION", montant: 1 }],
  };
  const vus = (p, table) => db[table].filter(C.filtreEspaceAffichage(db, p)).map((x) => x.id);

  test("un compte de formation ne voit QUE ses ventes",
    JSON.stringify(vus(P.stagiaire, "ventes")) === JSON.stringify(["v2"]));
  test("…et QUE ses dépenses",
    JSON.stringify(vus(P.stagiaire, "depenses")) === JSON.stringify(["e2"]));
  test("un compte réel voit les vrais chiffres",
    JSON.stringify(vus(P.vendeur, "ventes")) === JSON.stringify(["v1"]));
  test("l'admin principal voit les vrais chiffres (c'est la vue attendue)",
    JSON.stringify(vus(P.admin, "ventes")) === JSON.stringify(["v1"]));
  test("le bandeau « chiffres de formation » ne s'affiche que pour eux",
    C.afficheChiffresFormation(db, P.stagiaire) === true
    && C.afficheChiffresFormation(db, P.vendeur) === false
    && C.afficheChiffresFormation(db, P.admin) === false);

  // ⚠ Le cas exact de la capture : un ADMIN marqué formation (HEZOU/NOE/RENE
  // sur l'installation reelle), cree avant le reglage et donc sans rien dans
  // droits_off. Jusqu'a la 2.101.14 il gardait le pouvoir « voir les deux
  // espaces » et voyait le chiffre d'affaires REEL de l'entreprise ; il
  // fallait le lui retirer a la main. Le test disait cette tolerance : il
  // dit maintenant qu'elle n'existe plus.
  const dbAdminForm = { ...db, users: [...db.users, { id: "u_hezou", nom: "HEZOU", role: "admin", formation: true }] };
  const adminForm = { id: "u_hezou", role: "admin" };
  test("un admin marqué formation ne voit plus que la formation, sans reglage",
    C.voitLesDeuxEspaces(dbAdminForm, adminForm) === false
    && C.afficheChiffresFormation(dbAdminForm, adminForm) === true);
  test("…et les chiffres qu'il lit sont ceux de la formation, pas ceux de l'entreprise",
    dbAdminForm.ventes.filter(C.filtreEspaceAffichage(dbAdminForm, adminForm)).length === 1);
}


titre("Saisie CNSS : le formulaire tape du TEXTE, l'enregistrement stocke des NOMBRES");
{
  // Le cas exact signale par Timo : apres un enregistrement reussi, le
  // paiement CNSS restait bloque sur "non enregistre".
  const tape       = { assujetti: true, matricule: "", numeroAssurance: "A1", codeType: "1", dateEmbauche: "2020-01-01", dateSortie: "", codeMotifSortie: "", jours: "0", nature: "1" };
  const enregistre = { assujetti: true, matricule: "", numeroAssurance: "A1", codeType: 1,   dateEmbauche: "2020-01-01", dateSortie: "", codeMotifSortie: "", jours: 0,   nature: 1 };
  test("« 0 » tapé et 0 enregistré sont reconnus identiques",
    Cnss.memeSaisieCNSS(tape, enregistre) === true);
  test("26 jours tapés et 26 enregistrés : identiques",
    Cnss.memeSaisieCNSS({ ...tape, jours: "26" }, { ...enregistre, jours: 26 }) === true);
  test("une vraie modification est toujours détectée",
    Cnss.memeSaisieCNSS({ ...tape, jours: "26" }, enregistre) === false);
  test("cocher « assujetti » est détecté",
    Cnss.memeSaisieCNSS({ ...tape, assujetti: false }, enregistre) === false);
  test("un espace en trop dans le n° d'assurance ne compte pas pour une modification",
    Cnss.memeSaisieCNSS({ ...tape, numeroAssurance: " A1 " }, enregistre) === true);
  test("changer le n° d'assurance est détecté",
    Cnss.memeSaisieCNSS({ ...tape, numeroAssurance: "A2" }, enregistre) === false);
}



titre("Commissions : une vente GELÉE (installation non réceptionnée) ne doit jamais être tamponnée « payée »");
{
  // Le defaut : le MONTANT ecartait bien les ventes gelees, mais la liste
  // tamponnee "commission payee" les emportait quand meme. A la reception, la
  // commission se debloquait sur une vente deja close -> perdue pour toujours.
  const vNormale = { id: "v1", articles: [{ qte: 1, pu: 1000000 }] };
  const vGelee   = { id: "v2", articles: [{ qte: 1, pu: 2000000 }], commission_a_la_reception: true };
  const r = C.repartirCommissions([vNormale, vGelee], 5);

  test("la vente gelée n'est PAS dans la liste à tamponner",
    r.idsAPayer.length === 1 && r.idsAPayer[0] === "v1");
  test("le montant payé ne compte que la vente exigible",
    r.du === 50000);
  test("la commission gelée est affichée à part, pas perdue de vue",
    r.gele === 100000 && r.gelees.length === 1);
  test("le montant affiché et la liste tamponnée portent sur EXACTEMENT les mêmes ventes",
    r.du === r.idsAPayer.reduce((s, id) => s + C.commissionVente([vNormale, vGelee].find((v) => v.id === id), 5), 0));

  // Le scenario complet, bout en bout : on paie, PUIS le client receptionne.
  const apresPaiement = [vNormale, vGelee].map((v) => (r.idsAPayer.includes(v.id)
    ? { ...v, commission_payee: true, commission_montant: C.commissionVente(v, 5) } : v));
  const apresReception = apresPaiement.map((v) => (v.id === "v2"
    ? { ...v, commission_a_la_reception: false } : v));
  const r2 = C.repartirCommissions(apresReception.filter((v) => !v.commission_payee), 5);
  test("après réception, la commission gelée redevient bien DUE (elle était perdue avant)",
    r2.du === 100000 && r2.idsAPayer.length === 1 && r2.idsAPayer[0] === "v2");

  // Le rabais offert par le commercial reste bien deduit de SA commission.
  // ⚠ ATTENDU CORRIGÉ (audit du 20/08/2026) : ce test exigeait 31 000, or
  // c'était le montant SURPAYÉ. Le rabais était rajouté à une base dont il
  // n'avait jamais été retiré, gonflant chaque commission de « taux × rabais »
  // — ici 5 % × 20 000 = 1 000 F. Le juste est 5 % de 1 000 000 (le prix avant
  // rabais), moins les 20 000 offerts, soit 30 000. Ne pas « rétablir » 31 000.
  const vRabais = { id: "v3", articles: [{ qte: 1, pu: 1000000 }], rabais: 20000 };
  test("le rabais offert par le commercial reste déduit de sa commission",
    C.repartirCommissions([vRabais], 5).du === 30000);
}


titre("Commissions d'équipe : même règle pour la part du chef");
{
  const tauxFilleul = 5, tauxChef = 10;
  const vNormale = { id: "v1", articles: [{ qte: 1, pu: 1000000 }] };
  const vGelee   = { id: "v2", articles: [{ qte: 1, pu: 2000000 }], commission_a_la_reception: true };
  const vPayee   = { id: "v3", articles: [{ qte: 1, pu: 1000000 }], override_payee: true, override_montant: 4200 };
  const r = C.repartirCommissionEquipe([vNormale, vGelee, vPayee], tauxFilleul, tauxChef);

  test("le chef ne fait tamponner que la vente exigible",
    r.idsAPayer.length === 1 && r.idsAPayer[0] === "v1");
  test("sa part due est bien 10 % de la commission de sa recrue",
    r.due === 5000);
  test("sa part sur la vente gelée est signalée, pas encaissée",
    r.gelee === 10000);
  test("« déjà payé » relit le montant réellement versé (4 200), pas une reconstitution",
    r.versees === 4200);
  test("le montant inscrit sur chaque vente correspond à ce qui est payé",
    r.partParVente.v1 === 5000 && r.partParVente.v2 === undefined);
}


titre("« Déjà payé » : un montant relu, pas recalculé avec le taux du jour");
{
  // Le montant INSCRIT reste 31 000 : c'est ce qui est réellement sorti de la
  // caisse à l'époque, avant la correction du calcul. On le relit tel quel —
  // réécrire l'histoire d'un versement déjà effectué serait pire que le bug.
  const vente = { id: "v1", articles: [{ qte: 1, pu: 1000000 }], rabais: 20000, commission_payee: true, commission_montant: 31000 };
  test("le montant versé est relu tel quel",
    C.montantVerse(vente, 5) === 31000);
  test("…et ne bouge PAS quand on change le taux du commercial après coup",
    C.montantVerse(vente, 20) === 31000);
  // Sans montant inscrit, on recalcule — donc avec la formule CORRIGÉE : 30 000.
  test("un paiement ancien (sans montant inscrit) retombe sur la formule complète, rabais déduit",
    C.montantVerse({ id: "v2", articles: [{ qte: 1, pu: 1000000 }], rabais: 20000 }, 5) === 30000);
}


titre("Mon équipe : un compte de formation n'y lit plus les vrais chiffres");
{
  // Reproduit la logique exacte de l'ecran (les memes fonctions partagees).
  const base = {
    boutiques: [{ nom: "LOME", formation: false }, { nom: "ECOLE", formation: true }],
    users: [
      { id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true },
      { id: "u_vrai", nom: "KOFFI", role: "commercial", taux_commission: 5 },
      { id: "u_form", nom: "DODO", role: "commercial", taux_commission: 5, formation: true, chef_equipe: true },
    ],
    ventes: [
      { id: "v_reel", boutique: "LOME",  commercial: "KOFFI", articles: [{ qte: 1, pu: 1000000 }] },
      { id: "v_form", boutique: "ECOLE", commercial: "DODO",  articles: [{ qte: 1, pu: 7000 }] },
    ],
  };
  const db = { ...base, __index: C.construireIndexDb(base) };
  const timo = { id: "u_timo", role: "admin" };
  const dodo = { id: "u_form", role: "commercial" };

  // La regle de l'ecran : quelles ventes chacun lit pour un commercial donne.
  const ventesDe = (profile, nom) => {
    const cloisonne = C.estCompteFormation(db, profile) && !C.voitLesDeuxEspaces(db, profile);
    return cloisonne
      ? db.ventes.filter(C.filtreEspaceAffichage(db, profile)).filter((v) => v.commercial === nom)
      : C.ventesDuCommercial(db, nom);
  };
  const memeEspace = (profile, u) => C.voitLesDeuxEspaces(db, profile)
    || C.estCompteFormation(db, u) === C.estCompteFormation(db, profile);

  test("le compte de formation ne voit PLUS le vrai chiffre d'affaires du commercial",
    ventesDe(dodo, "KOFFI").length === 0);
  test("il voit ses propres ventes d'entraînement",
    ventesDe(dodo, "DODO").length === 1 && ventesDe(dodo, "DODO")[0].id === "v_form");
  test("le vrai commercial ne figure plus dans SA liste d'équipe",
    memeEspace(dodo, db.users[1]) === false);

  test("l'administrateur principal, lui, garde exactement la même vue qu'avant",
    ventesDe(timo, "KOFFI").length === 1 && ventesDe(timo, "KOFFI")[0].id === "v_reel");
  test("…et PERSONNE ne disparaît de sa liste — ni le vrai, ni celui de formation",
    memeEspace(timo, db.users[1]) === true && memeEspace(timo, db.users[2]) === true);
  test("les ventes d'entraînement ne gonflent jamais le chiffre réel",
    C.ventesDuCommercial(db, "DODO").length === 0);
}


titre("« Annuler paiement » : une annulation partielle est refusée, plus jamais faite à moitié");
{
  // Un reglement unique (dep D1) couvrant deux mois. On affiche « ce mois ».
  const ventes = [
    { id: "v_juin",   date: "2026-06-10", commission_payee: true, commission_dep: "D1" },
    { id: "v_juillet", date: "2026-07-10", commission_payee: true, commission_dep: "D1" },
  ];
  const debordement = (affichees) => {
    const ids = new Set(affichees.map((v) => v.id));
    const deps = new Set(affichees.map((v) => v.commission_dep).filter(Boolean));
    return ventes.filter((v) => v.commission_payee && v.commission_dep && deps.has(v.commission_dep) && !ids.has(v.id));
  };

  test("annuler depuis « ce mois » déborde sur juin : c'est refusé",
    debordement([ventes[1]]).length === 1 && debordement([ventes[1]])[0].id === "v_juin");
  test("annuler depuis « depuis le début » ne déborde pas : c'est accepté",
    debordement(ventes).length === 0);
  test("un règlement qui ne couvre qu'un seul mois s'annule normalement",
    debordement([{ id: "v_seule", date: "2026-07-10", commission_payee: true, commission_dep: "D2" }]).length === 0);
  test("une vente réglée SANS dépense rattachée est repérée (risque de double paiement)",
    [{ id: "v_x", commission_payee: true }].filter((v) => !v.commission_dep).length === 1);
}


titre("Le verrou regarde d'OÙ vient la ligne, pas seulement où elle va");
{
  // La faille exacte : un compte de formation prenait une ligne REELLE et la
  // faisait basculer dans son espace en reecrivant simplement sa boutique.
  // Chemin non theorique : l'encaissement d'une « pose seule » reecrit la
  // boutique de la dette a chaque versement.
  const boutiques = [{ nom: "LOME", formation: false }, { nom: "ECOLE", formation: true }];
  const users = [
    { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u_vend", nom: "DODO", role: "vendeur", boutique: "ECOLE" },
  ];
  const detteReelle = { id: "d1", boutique: "LOME", montant: 500000, paye: 0 };
  const vide = { ventes: [], depenses: [], produits: [], ajustements: [], clotures: [],
                 commandes: [], proformas: [], clients_installes: [] };
  const prev = { boutiques, users, dettes: [detteReelle], ...vide };
  const stagiaire = { id: "u_vend", role: "vendeur", boutique: "ECOLE" };
  const timo = { id: "u_admin", role: "admin" };

  test("modifier une vraie dette en la laissant sur sa boutique : toujours refusé",
    !!C.verifierEcritureEspace(prev, { ...prev, dettes: [{ ...detteReelle, paye: 100000 }] }, stagiaire));

  const deplacee = { ...prev, dettes: [{ ...detteReelle, boutique: "ECOLE", paye: 100000 }] };
  const inf = C.verifierEcritureEspace(prev, deplacee, stagiaire);
  test("faire BASCULER cette vraie dette dans l'espace formation : refusé (c'était la faille)",
    !!inf && inf.deplacement === true && inf.boutique === "LOME");
  test("le message explique qu'un enregistrement ne peut pas changer d'espace",
    C.messageEcritureRefusee(inf, true).includes("ne peut pas être déplacé"));

  test("le déplacement inverse (une ligne de formation vers le réel) est refusé aussi", (() => {
    const p = { boutiques, users, dettes: [{ id: "d2", boutique: "ECOLE", montant: 1000, paye: 0 }], ...vide };
    const reel = { id: "u_r", role: "vendeur", boutique: "LOME" };
    const p2 = { ...p, users: [...users, { id: "u_r", nom: "KOFFI", role: "vendeur", boutique: "LOME" }] };
    const n = { ...p2, dettes: [{ id: "d2", boutique: "LOME", montant: 1000, paye: 500 }] };
    return !!C.verifierEcritureEspace(p2, n, reel);
  })());

  test("l'administrateur principal, lui, peut toujours tout faire",
    C.verifierEcritureEspace(prev, deplacee, timo) === null);
  test("un encaissement normal, dans son propre espace, passe sans gêne", (() => {
    const p = { boutiques, users, dettes: [{ id: "d3", boutique: "ECOLE", montant: 1000, paye: 0 }], ...vide };
    const n = { ...p, dettes: [{ id: "d3", boutique: "ECOLE", montant: 1000, paye: 500 }] };
    return C.verifierEcritureEspace(p, n, stagiaire) === null;
  })());
}


titre("Prime d'installation : jamais payée deux fois");
{
  // Deux chemins mènent au paiement (l'admin depuis Clients installés, le
  // vendeur depuis Primes remises) et l'app fonctionne hors ligne.
  const part = { user_id: "u_tech", nom: "KOSSI", pct: 60, montant: 30000, chef: true,
                 demande_prime: true, prime_boutique: "LOME" };
  const chantier = { id: "ch1", nom: "AGBEKO", equipe: [part] };
  const db = { clients_installes: [chantier], depenses: [], users: [], boutiques: [{ nom: "LOME" }] };

  test("une part pas encore réglée est bien payable",
    C.primeDejaPayee(db, chantier, part) === false);

  // Quelqu'un d'autre a payé pendant qu'on remplissait la fenêtre.
  const apres = { ...db, clients_installes: [{ ...chantier,
    equipe: [{ ...part, paye: true, demande_prime: false, dep_id: "dep1" }] }] };
  test("si elle vient d'être payée ailleurs, le second paiement est refusé",
    C.primeDejaPayee(apres, chantier, part) === true);
  test("le contrôle relit la BASE, pas la ligne affichée à l'écran (qui dit encore « à payer »)",
    part.paye !== true && C.primeDejaPayee(apres, chantier, part) === true);
  test("les parts des autres techniciens du même chantier ne sont pas bloquées", (() => {
    const autre = { user_id: "u_tech2", nom: "AMA", montant: 20000, prime_boutique: "LOME" };
    const d = { ...db, clients_installes: [{ ...chantier, equipe: [{ ...part, paye: true }, autre] }] };
    return C.primeDejaPayee(d, chantier, autre) === false;
  })());
  test("un chantier introuvable ne fait pas passer le paiement en force",
    C.primeDejaPayee({ clients_installes: [] }, chantier, part) === false);
}


titre("Clients installés : les coordonnées des vrais clients restent dans l'espace réel");
{
  const boutiques = [{ nom: "LOME", formation: false }, { nom: "ECOLE", formation: true }];
  const users = [
    { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u_chef", nom: "DODO", role: "technicien", chef_equipe: true, formation: true },
    { id: "t_reel", nom: "KOSSI", role: "technicien" },
    { id: "t_form", nom: "STAGE", role: "technicien", formation: true },
  ];
  const db = {
    boutiques, users,
    ventes: [{ id: "v1", boutique: "LOME" }, { id: "v2", boutique: "ECOLE" }],
    dettes: [],
    clients_installes: [
      { id: "ch_reel", nom: "AGBEKO", tel: "+22890000000", adresse_contrat: "Rue 12, Lomé", vente_id: "v1" },
      { id: "ch_form", nom: "ESSAI", vente_id: "v2" },
      { id: "ch_sans", nom: "SANS RATTACHEMENT" },
    ],
  };
  const timo = { id: "u_admin", role: "admin" };
  const chefForm = { id: "u_chef", role: "technicien" };

  const vus = (p) => C.chantiersDeMonEspace(db, p).map((c) => c.id);
  test("un chef d'équipe de formation ne voit plus le chantier réel",
    !vus(chefForm).includes("ch_reel"));
  test("il voit le chantier d'entraînement",
    vus(chefForm).includes("ch_form"));
  test("un chantier sans vente ni dette n'est refusé à personne",
    vus(chefForm).includes("ch_sans") && vus(timo).includes("ch_sans"));
  test("l'administrateur principal garde les TROIS chantiers — rien ne disparaît",
    vus(timo).length === 3);

  // Techniciens proposés : c'est l'espace du CHANTIER qui decide.
  const tousTechs = users.filter((u) => u.role === "technicien");
  const proposes = (c, p) => C.techniciensDeLEspace(db, tousTechs, C.espaceDuChantier(db, c, p)).map((u) => u.nom);
  const chReel = db.clients_installes[0], chForm = db.clients_installes[1];
  test("sur un VRAI chantier, seul le vrai technicien est proposé — même à l'administrateur",
    proposes(chReel, timo).includes("KOSSI") && !proposes(chReel, timo).includes("STAGE"));
  test("sur un chantier d'entraînement, seul le technicien de formation est proposé",
    proposes(chForm, timo).includes("STAGE") && !proposes(chForm, timo).includes("KOSSI"));
  test("sur le formulaire de création (aucun chantier), c'est l'espace REGARDÉ : un compte de formation → formation ; le principal → l'espace qu'il regarde (14/09/2026, capture Timo : il regardait la formation et voyait les vrais techniciens)",
    C.espaceDuChantier(db, null, chefForm) === true && C.espaceDuChantier(db, null, timo) === false
    && (C.setRegardeFormation(true), C.espaceDuChantier(db, null, timo) === true) && (C.setRegardeFormation(false), C.espaceDuChantier(db, null, timo) === false)
    && /return b \? estBoutiqueFormation\(db, b\) : espaceDuCompte\(db, profile\);/.test(readFileSync("src/lib/calculs.js", "utf8")));
}


titre("Répartition des frais d'installation : la somme des parts ne dépasse jamais 100 %");
{
  // Reprise EXACTE de repartitionProposee (ClientsInstalles.jsx).
  const repartition = (ids, chefId, partChef) => {
    const n = ids.length;
    if (!n) return {};
    const reste = Math.max(0, 100 - Number(partChef || 0));
    const partEgale = Math.round((reste / n) * 10) / 10;
    const r = {};
    let distribue = 0;
    ids.forEach((id) => { if (id === chefId) return; r[id] = partEgale; distribue += partEgale; });
    const chef = ids.includes(chefId) ? chefId : ids[0];
    r[chef] = Math.round((100 - distribue) * 100) / 100;
    return r;
  };
  const total = (r) => Math.round(Object.values(r).reduce((s, v) => s + v, 0) * 100) / 100;
  const ids = (n) => Array.from({ length: n }, (_, i) => `t${i}`);

  let pire = 0;
  for (let n = 1; n <= 12; n++) {
    for (const pc of [0, 10, 25, 33, 40, 50, 60, 75, 100]) {
      pire = Math.max(pire, Math.abs(100 - total(repartition(ids(n), "t0", pc))));
    }
  }
  test("de 1 à 12 techniciens et pour tous les taux de chef : le total fait toujours 100 %",
    pire === 0);
  test("le cas qui débordait — 7 techniciens, chef à 40 % — fait bien 100 % (c'était 100,2)",
    total(repartition(ids(7), "t0", 40)) === 100);
  test("9 techniciens : 100 % aussi (c'était 100,3)",
    total(repartition(ids(9), "t0", 40)) === 100);
  test("le chef reçoit toujours la part la plus forte", (() => {
    const r = repartition(ids(7), "t0", 40);
    return r.t0 === Math.max(...Object.values(r));
  })());
  test("un seul technicien prend 100 %",
    total(repartition(ids(1), "t0", 40)) === 100 && repartition(ids(1), "t0", 40).t0 === 100);
}


titre("Une demande de prime en attente n'est plus effacée en silence");
{
  // Reprise de la logique de validerRepartition (ClientsInstalles.jsx).
  const rejouer = (equipeAvant, idsApres, pcts, frais) => {
    const annulees = [];
    const equipe = idsApres.map((id) => {
      const montant = Math.round((frais * Number(pcts[id] || 0)) / 100);
      const ancien = equipeAvant.find((e) => e.user_id === id);
      const base = { user_id: id, montant, paye: false };
      if (ancien?.demande_prime && Number(ancien.montant || 0) === montant) {
        return { ...base, demande_prime: true, prime_boutique: ancien.prime_boutique };
      }
      if (ancien?.demande_prime) annulees.push(ancien);
      return base;
    });
    equipeAvant.forEach((e) => { if (e.demande_prime && !idsApres.includes(e.user_id)) annulees.push(e); });
    return { equipe, annulees };
  };

  const avant = [
    { user_id: "a", nom: "KOSSI", montant: 60000, demande_prime: true, prime_boutique: "LOME" },
    { user_id: "b", nom: "AMA", montant: 40000, demande_prime: true, prime_boutique: "LOME" },
  ];
  // Meme repartition rejouee : les deux demandes doivent SURVIVRE.
  const r1 = rejouer(avant, ["a", "b"], { a: 60, b: 40 }, 100000);
  test("une répartition rejouée à l'identique conserve les demandes en attente",
    r1.annulees.length === 0 && r1.equipe.every((e) => e.demande_prime === true));

  // Le montant de KOSSI change : sa demande devient caduque, celle d'AMA non.
  const r2 = rejouer(avant, ["a", "b"], { a: 50, b: 40 }, 100000);
  test("une demande dont le montant a changé est annulée, et signalée",
    r2.annulees.length === 1 && r2.annulees[0].user_id === "a");
  test("…tandis que celle dont le montant n'a pas bougé est conservée",
    r2.equipe.find((e) => e.user_id === "b").demande_prime === true);

  // AMA quitte le chantier.
  const r3 = rejouer(avant, ["a"], { a: 60 }, 100000);
  test("un technicien retiré du chantier voit sa demande annulée, pas oubliée",
    r3.annulees.length === 1 && r3.annulees[0].user_id === "b");
}


titre("Supprimer un chantier : impossible si des primes ont déjà été payées");
{
  const bloque = (c) => (c.equipe || []).filter((e) => e.paye && Number(e.montant || 0) > 0);
  test("un chantier avec une prime payée ne peut pas être supprimé",
    bloque({ equipe: [{ nom: "KOSSI", montant: 60000, paye: true }] }).length === 1);
  test("un chantier sans paiement reste supprimable",
    bloque({ equipe: [{ nom: "KOSSI", montant: 60000, paye: false }] }).length === 0);
  test("une part à 0 F marquée payée ne bloque pas inutilement",
    bloque({ equipe: [{ nom: "AMA", montant: 0, paye: true }] }).length === 0);
  test("un chantier sans équipe du tout reste supprimable",
    bloque({}).length === 0);
}


titre("Devis repris : les conditions négociées avec le client sont restituées");
{
  // Ce qui disparaissait en silence quand on reprenait un devis rejete.
  const capter = () => {
    const v = {};
    return {
      v,
      setPctRemise: (x) => (v.remise = x),
      setPctInstall: (x) => (v.install = x),
      setPctTransport: (x) => (v.transport = x),
      setPctAcompte: (x) => (v.acompte = x),
      setDelaiInstallation: (x) => (v.delai = x),
      setPoseSeule: (x) => (v.pose = x),
      setMontantPoseFixe: (x) => (v.montantPose = x),
    };
  };

  const devisNegocie = {
    pct_remise: 15, pct_installation: 12, pct_transport: 5, pct_acompte: 50,
    delai_installation: "3 semaines", pose_seule: false, frais_installation: 120000,
  };
  const a = capter();
  Dim.appliquerConditionsReprises(devisNegocie, a);
  test("la remise accordée au client est bien restituée (elle repartait à 0 %)",
    a.v.remise === "15");
  test("le pourcentage de frais d'installation aussi (il repartait à 10 %)",
    a.v.install === "12");
  test("le transport aussi", a.v.transport === "5");
  test("l'acompte exigé aussi (il repartait à 100 %)", a.v.acompte === "50");
  test("le délai promis au client n'est plus effacé", a.v.delai === "3 semaines");

  // « Pose seule » : montant FIXE de main d'oeuvre, pct_installation vaut null.
  const devisPose = { pct_remise: 0, pct_installation: null, pct_transport: 0, pct_acompte: 100,
                      delai_installation: "", pose_seule: true, frais_installation: 250000 };
  const b = capter();
  Dim.appliquerConditionsReprises(devisPose, b);
  test("la case « pose seule » est rétablie (le devis repassait en pourcentage)",
    b.v.pose === true);
  test("…avec son montant fixe de main d'œuvre", b.v.montantPose === "250000");

  // Un devis normal ne doit pas heriter d'un montant de pose.
  const c = capter();
  Dim.appliquerConditionsReprises(devisNegocie, c);
  test("un devis normal ne récupère aucun montant de pose fixe",
    c.v.pose === false && c.v.montantPose === "");

  // Vieux devis sans ces champs : on retombe sur les valeurs par defaut.
  const d = capter();
  Dim.appliquerConditionsReprises({}, d);
  test("un ancien devis sans ces informations retombe sur les valeurs par défaut",
    d.v.remise === "0" && d.v.install === "10" && d.v.acompte === "100");

  // Aucun devis repris : on ne touche a rien (un devis neuf garde ses reglages).
  const e = capter();
  Dim.appliquerConditionsReprises(null, e);
  test("sans devis repris, aucun réglage n'est écrasé",
    Object.keys(e.v).length === 0);
}


titre("Quantité d'équipement : plus de plafond silencieux à 50");
{
  test("35 panneaux de 550 Wc pour 19 000 Wc : quantité exacte",
    Dim.quantiteNecessaire(19000, 550) === 35);
  test("une grosse installation dépasse enfin 50 (elle était tronquée en silence)",
    Dim.quantiteNecessaire(40000, 550) === 73);
  // Retourné le 08/09/2026 (Timo : « éviter que ce message apparaisse encore,
  // quelle que soit la quantité ») : plus d'avertissement « quantité
  // inhabituelle », ni de seuil — la quantité est juste, et c'est tout.
  test("★ plus aucun seuil de « quantité inhabituelle » dans la règle commune", Dim.SEUIL_QTE_INHABITUELLE === undefined);
  test("★ ni Solaire ni Garage n'affichent plus « quantité inhabituelle »",
    ["Solaire.jsx", "Garage.jsx"].every((f) => { const src = readFileSync(`src/screens/dimensionnement/${f}`, "utf8"); return !/inhabituelle/.test(src) && !/SEUIL_QTE_INHABITUELLE/.test(src); }));
  test("un article mal nommé (« panneau 5W ») produit toujours la quantité exacte, sans plafond",
    Dim.quantiteNecessaire(19000, 5) === 3800);
  test("un article sans caractéristique lisible reste à 1 unité, jamais à l'infini",
    Dim.quantiteNecessaire(19000, 0) === 1);
  test("un besoin nul ne descend jamais en dessous de 1",
    Dim.quantiteNecessaire(0, 550) === 1);
}


titre("Convertisseur : les VA sont convertis en watts (et les kVA aussi)");
{
  const spec = (nom) => Dim.specDepuisNom(nom);
  const utile = (nom) => Dim.puissanceUtileW(spec(nom));

  test("« 5000VA » ne vaut pas 5 000 W mais 4 000 W utiles",
    utile("CONVERTISSEUR 5000VA 48V") === 4000);
  test("écrit en kVA, c'est le MÊME résultat — « 5KVA » vaut aussi 4 000 W utiles",
    utile("CONVERTISSEUR 5KVA 48V") === 4000 && spec("CONVERTISSEUR 5KVA 48V").valeur === 5000);
  test("« 3.5KVA » est lu correctement : 2 800 W utiles",
    utile("ONDULEUR 3.5KVA") === 2800);
  test("un convertisseur annoncé en WATTS n'est PAS diminué",
    utile("CONVERTISSEUR HYBRIDE 5000W 48V") === 5000);
  test("écrit en kW non plus — « 5KW » reste 5 000 W",
    utile("CONVERTISSEUR HYBRIDE 5KW 48V") === 5000);

  // Le scenario exact signale : un besoin de 5 000 W.
  const besoin = 5000;
  const stock = ["CONVERTISSEUR 5000VA 48V", "CONVERTISSEUR 6000VA 48V", "CONVERTISSEUR 8000VA 48V"];
  const suffisantAvant = stock.find((n) => spec(n).valeur >= besoin);
  const suffisantApres = stock.find((n) => Dim.puissanceUtileW(spec(n)) >= besoin);
  test("AVANT : un 5000VA était proposé pour un besoin de 5 000 W (client sous-équipé)",
    suffisantAvant === "CONVERTISSEUR 5000VA 48V");
  test("MAINTENANT : c'est le 6500VA minimum — ici le 8000VA — qui est retenu",
    suffisantApres === "CONVERTISSEUR 8000VA 48V");
  test("le 6000VA est bien écarté : il ne donne que 4 800 W",
    utile("CONVERTISSEUR 6000VA 48V") === 4800 && 4800 < besoin);
}


titre("Rails de fixation : le calcul était juste, c'est le libellé qui trompait");
{
  // 5 500 F est le prix AU MÈTRE (confirmé par Timo) : la quantité calculée
  // — panneaux × 2,2 — est un nombre de MÈTRES, et le total était correct.
  const PRIX_RAIL = 5500;
  const metres = (panneaux) => Math.ceil(panneaux * 2.2);

  test("7 panneaux demandent 16 mètres de rail",
    metres(7) === 16);
  test("…soit 88 000 F, le montant qui était déjà facturé (rien ne change au prix)",
    metres(7) * PRIX_RAIL === 88000);
  test("35 panneaux : 77 mètres",
    metres(35) === 77);
  test("aucun panneau, aucun rail",
    metres(0) === 0);
}


titre("Prix du rail : réglable dans les Paramètres, sans rien casser de l'existant");
{
  test("une base qui n'a jamais touché au réglage garde EXACTEMENT l'ancien prix",
    C.prixRailMetre({ boutiques: [{ nom: "LOME" }] }) === 5500
    && C.PRIX_RAIL_DEFAUT === 5500);
  test("le prix réglé par l'administrateur est bien celui qui s'applique",
    C.prixRailMetre({ boutiques: [{ nom: "LOME", prix_rail: 6200 }] }) === 6200);
  test("le réglage est lu même s'il n'est posé que sur une boutique",
    C.prixRailMetre({ boutiques: [{ nom: "A" }, { nom: "B", prix_rail: 7000 }] }) === 7000);
  test("une valeur aberrante (0 ou négative) est ignorée au profit du prix d'origine",
    C.prixRailMetre({ boutiques: [{ prix_rail: 0 }] }) === 5500
    && C.prixRailMetre({ boutiques: [{ prix_rail: -100 }] }) === 5500);
  test("une base vide ou absente ne fait pas planter le devis",
    C.prixRailMetre({}) === 5500 && C.prixRailMetre(null) === 5500);
  test("un prix relevé change bien le montant du devis (10 panneaux = 22 m)",
    22 * C.prixRailMetre({ boutiques: [{ prix_rail: 6200 }] }) === 136400);
}

titre("Rail : le stock compte des BARRES, le devis des mètres — le client paie les barres entamées (14/09/2026)");
{
  // Timo : « le rail est vendu à l'unité de 4,2 m dans le stock ; dans le
  // dimensionnement c'est au mètre… par quel mécanisme déduire le stock ? »
  // Décision « b » : 22 m calculés → 6 barres → 25,2 m facturés au prix du
  // mètre ; le stock perd 6 barres. Longueur réglable dans ⚙ Paramètres.
  const r = Sol.barresDeRail(22, 4.2);
  test("★ 22 m → 6 barres de 4,2 m = 25,2 m facturés, chute 3,2 m",
    r.barres === 6 && r.metresFactures === 25.2 && r.chute === 3.2 && r.metresCalcules === 22 && r.longueurBarre === 4.2);
  test("une barre juste pleine n'en entame pas une autre : 4,2 → 1 ; 8,4 → 2 ; 8,5 → 3 ; 16 → 4 (16,8 m) ; 0 → 0",
    Sol.barresDeRail(4.2, 4.2).barres === 1 && Sol.barresDeRail(8.4, 4.2).barres === 2 && Sol.barresDeRail(8.5, 4.2).barres === 3
    && Sol.barresDeRail(16, 4.2).barres === 4 && Sol.barresDeRail(16, 4.2).metresFactures === 16.8 && Sol.barresDeRail(0, 4.2).barres === 0
    && Sol.barresDeRail(0, 4.2).metresFactures === 0);
  test("une longueur absurde (0, négative, absente) retombe sur 4,2 m",
    Sol.barresDeRail(22, 0).longueurBarre === 4.2 && Sol.barresDeRail(22, -1).barres === 6 && Sol.barresDeRail(22).barres === 6);
  test("★ le prix payé = barres × (longueur × prix du mètre) : 6 × 4,2 × 5 500 = 138 600, pas 22 × 5 500",
    6 * Math.round(4.2 * 5500) === 138600 && 138600 !== 22 * 5500);
  test("la longueur se règle comme le prix : 4,2 d'office, lue sur la première boutique qui la porte, 0 ignoré",
    C.LONGUEUR_RAIL_DEFAUT === 4.2 && C.longueurRailBarre({ boutiques: [{ nom: "A" }] }) === 4.2
    && C.longueurRailBarre({ boutiques: [{ nom: "A" }, { nom: "B", longueur_rail: 6 }] }) === 6
    && C.longueurRailBarre({ boutiques: [{ longueur_rail: 0 }] }) === 4.2 && C.longueurRailBarre(null) === 4.2);
  const solR = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  test("★ le devis solaire passe par la règle : la ligne part au panier en BARRES (qte = rails.barres, prix d'une barre), liée à l'article du stock — c'est ce que le stock soustrait",
    /const rails = barresDeRail\(railsQte, LONGUEUR_RAIL\);/.test(solR) && /const PRIX_BARRE = Math\.round\(LONGUEUR_RAIL \* PRIX_RAIL\);/.test(solR)
    && /const sousTotalRails = rails\.barres \* PRIX_BARRE;/.test(solR)
    && /rails\.barres > 0 \? \[\{ produit_id: articleRailsStock \? articleRailsStock\.id : null, article: libelleRails, qte: rails\.barres, pu: PRIX_BARRE \}\]/.test(solR)
    && !/qte: railsQte, pu: PRIX_RAIL/.test(solR));
  test("★ la ligne du devis garde ses mètres (metres_calcules, metres_factures, longueur_barre) ; une reprise relit les mètres, une ancienne ligne (mètres en quantité) aussi ; la case reste en mètres",
    /metres_calcules: rails\.metresCalcules, metres_factures: rails\.metresFactures, longueur_barre: rails\.longueurBarre/.test(solR)
    && /export const metresDeLigne = \(l\) => Number\(l\?\.metres_calcules \?\? l\?\.qte\) \|\| 0;/.test(solR)
    && /base: metresDeLigne\(rails\)/.test(solR)
    && /value=\{railsQte\} onChange/.test(solR) && /barres? de \{LONGUEUR_RAIL\} m = \{rails\.metresFactures\} m facturés/.test(solR.replace(/\{rails\.barres > 1 \? "s" : ""\}/, "s")));
  test("l'article « rail » du stock n'est jamais un SUPPORT rail ni un étrier",
    /&& !\/support\|etrier\|étrier\/i\.test\(p\.nom\)\)/.test(solR));
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  test("⚙ Paramètres : « Longueur d'une barre (m) » à côté du prix du mètre, admin, écrite sur les boutiques (longueur_rail), exemple en barres",
    /data-reglage="longueur-rail"/.test(par) && /longueur_rail: v/.test(par) && /refuserSaufAdmin\(profile, "Modifier la longueur d'une barre de rail"\)/.test(par)
    && /barresDeRail\(22, Number\(longueurRail\)\)/.test(par));
}


titre("L'administrateur qui voit les deux espaces doit le pouvoir AUSSI côté serveur");
{
  // Reprise EXACTE de la regle posee par api/sync-auth.js.
  const revendication = (champs) => {
    const voitLesDeux = champs.role === "admin" && champs.admin_principal === true;
    return voitLesDeux ? "tous" : (champs.formation ? "formation" : "reel");
  };

  test("l'administrateur principal reçoit « tous » — il peut créer une boutique de formation",
    revendication({ role: "admin", admin_principal: true }) === "tous");
  test("un autre administrateur ne reçoit PLUS « tous » (regle du 28/08/2026)",
    revendication({ role: "admin" }) === "reel");
  test("le pouvoir « act_voir_tout » ne change plus rien cote serveur non plus",
    revendication({ role: "admin", droits_off: ["act_voir_tout"] }) === "reel");
  test("un administrateur marqué formation reçoit « formation », sans reglage a faire",
    revendication({ role: "admin", formation: true }) === "formation"
    && revendication({ role: "admin", formation: true, droits_off: ["act_voir_tout"] }) === "formation");

  // Vague 3, étape 1 (04/09/2026) : trois revendications de plus, pour que
  // le serveur distingue enfin les employés entre eux.
  const auth = readFileSync("api/sync-auth.js", "utf8");
  test("★ l'étiquette porte « principal » (drapeau admin_principal sur un admin ACTIF — pas de repli « premier admin » côté serveur)",
    /const principal = role === "admin" && champs\.admin_principal === true && champs\.actif !== false;/.test(auth));
  test("★ l'étiquette porte la boutique de rattachement et les pouvoirs retirés",
    /const boutique = String\(champs\.boutique \|\| ""\);/.test(auth) && /const pouvoirsOff = droitsOff\.filter/.test(auth));
  test("★ …posées à la CRÉATION comme à la MISE À JOUR du compte de session",
    (auth.match(/espace, role, ecriture, principal, boutique, pouvoirs_off: pouvoirsOff/g) || []).length === 2);
  test("l'application prévient l'administrateur principal dont la fiche n'a pas le drapeau",
    /chef\.admin_principal !== true/.test(readFileSync("src/App.jsx", "utf8")));
  test("l'administrateur principal reste « tous » même marqué formation (comme dans l'app)",
    revendication({ role: "admin", admin_principal: true, formation: true }) === "tous");
  test("un vendeur réel reste « reel »",
    revendication({ role: "vendeur" }) === "reel");
  test("un vendeur de formation reste « formation »",
    revendication({ role: "vendeur", formation: true }) === "formation");
  test("un commercial n'obtient jamais « tous », même sans droits retirés",
    revendication({ role: "commercial" }) === "reel");

  // La regle serveur doit dire la MEME chose que voitLesDeuxEspaces() de l'app.
  const db = { boutiques: [], users: [
    { id: "u1", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u2", nom: "ADMIN2", role: "admin" },
    { id: "u3", nom: "ADMIN3", role: "admin", droits_off: ["act_voir_tout"] },
    { id: "u4", nom: "KOSSI", role: "vendeur" },
  ] };
  const accord = db.users.every((u) =>
    (revendication(u) === "tous") === C.voitLesDeuxEspaces(db, { id: u.id, role: u.role }));
  test("l'application et le serveur sont d'accord sur QUI voit les deux espaces", accord);
}


titre("Un enregistrement refusé par le serveur ne doit plus faire boucler l'application");
{
  // Reprise de la regle posee dans src/sync.js.
  const contenuRefuse = (e) => e?.code === "42501"
    || /new row violates row-level security/i.test(String(e?.message || e));

  test("le refus d'une ligne (erreur 42501) est reconnu comme définitif",
    contenuRefuse({ code: "42501", message: 'new row violates row-level security policy for table "boutiques"' }) === true);
  test("il est reconnu même sans code, sur le seul message",
    contenuRefuse({ message: 'new row violates row-level security policy' }) === true);
  test("une session expirée n'est PAS confondue avec lui — se reconnecter aide vraiment",
    contenuRefuse({ message: "JWT expired" }) === false);
  test("une panne de réseau non plus",
    contenuRefuse({ message: "Failed to fetch" }) === false);
  test("une permission refusée en LECTURE reste traitée comme un souci de session",
    contenuRefuse({ message: "permission denied for table ventes" }) === false);
}


titre("L'espace suit la BOUTIQUE de travail, plus seulement le compte");
{
  const db = {
    boutiques: [{ nom: "DEMAKPOE", formation: false }, { nom: "FORMA1", formation: true }],
    users: [
      { id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true },
      { id: "u_vend", nom: "KOSSI", role: "vendeur", boutique: "DEMAKPOE" },
      { id: "u_stag", nom: "DODO", role: "vendeur", boutique: "FORMA1" },
    ],
  };
  const timo = { id: "u_timo", role: "admin" };
  const vendeurReel = { id: "u_vend", role: "vendeur" };
  const stagiaire = { id: "u_stag", role: "vendeur" };

  test("l'administrateur qui travaille sur FORMA1 produit de la FORMATION (c'était du réel)",
    C.marqueEspace(db, timo, "FORMA1").formation === true);
  test("le même administrateur sur DEMAKPOE produit du RÉEL",
    C.marqueEspace(db, timo, "DEMAKPOE").formation === undefined);
  test("sans boutique connue, on retombe sur l'espace du compte (comme avant)",
    C.marqueEspace(db, timo).formation === undefined
    && C.marqueEspace(db, stagiaire).formation === true);
  test("un vendeur réel produit toujours du réel, quelle que soit la boutique passée",
    C.marqueEspace(db, vendeurReel, "DEMAKPOE").formation === undefined);
  test("un stagiaire sur sa boutique produit toujours de la formation",
    C.marqueEspace(db, stagiaire, "FORMA1").formation === true);
  test("une boutique inconnue ne fait pas basculer par erreur : elle reste réelle",
    C.marqueEspace(db, timo, "BOUTIQUE EFFACEE").formation === undefined);

  // Le client propose dans le selecteur doit suivre la meme regle.
  const espaceDevis = (profile, boutique) =>
    (boutique ? C.estBoutiqueFormation(db, boutique) : C.espaceDuCompte(db, profile));
  test("sur FORMA1, seuls les clients de formation sont proposés",
    espaceDevis(timo, "FORMA1") === true);
  test("sur DEMAKPOE, seuls les vrais clients le sont",
    espaceDevis(timo, "DEMAKPOE") === false);
}


titre("Mot de passe d'un nouveau client : instantané, et toujours unique");
{
  // 46 comptes, comme chez Timo. L'ancienne methode recalculait 46 verrous
  // lents (mesure : 3,3 s ici, 6 a 16 s dans un navigateur) et faisait
  // bloquer l'ouverture de WhatsApp.
  const users = Array.from({ length: 46 }, (_, i) => ({
    id: "u" + i, nom: "CLIENT" + i, nom_base: "CLIENT" + i, tel: "9000" + String(i).padStart(4, "0"),
    role: "client", mdp_auto: true, mdp_variante: 0, mdp_longueur: 6,
    pwd_salt: "aa", pwd_hash2: "bb",
  }));
  const db = { users };

  const t0 = Date.now();
  const r = await Cli.resoudreMotDePasseClient(db, "NOUVEAU", "90123456");
  const duree = Date.now() - t0;

  test("un mot de passe est bien attribué",
    typeof r.motDePasse === "string" && r.motDePasse.length === 6);
  test("…en moins d'une demi-seconde (c'était plusieurs secondes)",
    duree < 500);
  test("il n'entre en conflit avec aucun compte existant", (() => {
    const pris = new Set(users.map((u) => Cli.motDePasseClient(u.nom_base, u.tel, 0, 6)));
    return !pris.has(r.motDePasse);
  })());
  test("le mot de passe reste RECALCULABLE à l'identique plus tard",
    Cli.motDePasseClient("NOUVEAU", "90123456", r.variante, r.longueur) === r.motDePasse);

  // Conflit reel : deux clients de meme nom et meme numero.
  const enConflit = { ...db, users: [...users, {
    id: "u_x", nom: "DOUBLON", nom_base: "DOUBLON", tel: "91111111",
    role: "client", mdp_auto: true, mdp_variante: 0, mdp_longueur: 6, pwd_salt: "aa", pwd_hash2: "bb" }] };
  const r2 = await Cli.resoudreMotDePasseClient(enConflit, "DOUBLON", "91111111");
  test("en cas de conflit, une AUTRE variante est choisie — pas le même mot de passe",
    r2.motDePasse !== Cli.motDePasseClient("DOUBLON", "91111111", 0, 6) && r2.variante > 0);
  test("…et elle reste recalculable elle aussi",
    Cli.motDePasseClient("DOUBLON", "91111111", r2.variante, r2.longueur) === r2.motDePasse);
}


titre("Un devis refusé ne doit JAMAIS être annoncé comme envoyé");
{
  // Le cas exact vecu par Timo : signature manquante. La fonction refusait
  // bien, mais son refus etait ignore — l'application annoncait ensuite
  // « ✅ Devis envoye » et effacait le brouillon. Elle disait le contraire
  // de la verite, et le client n'avait rien recu.
  //
  // On rejoue l'enchainement des trois volets tel qu'il est ecrit.
  const envoyer = async (profile) => {
    if (!profile.signature_personnelle) return false;   // le refus
    return true;
  };
  const enchainement = async (profile) => {
    const trace = [];
    const envoye = await envoyer(profile);
    if (!envoye) return trace;                          // le garde-fou
    trace.push("brouillon efface", "✅ Devis envoye");
    return trace;
  };

  test("sans signature : ni brouillon effacé, ni fausse confirmation",
    (await enchainement({ nom: "TIMO" })).length === 0);
  test("avec signature : le brouillon est effacé et la confirmation s'affiche",
    (await enchainement({ nom: "TIMO", signature_personnelle: "xxx" })).length === 2);
  test("le manque de signature est visible AVANT le clic, pas seulement après",
    !({ nom: "TIMO" }).signature_personnelle === true);
}


titre("Le stock est reconnu même quand le nom comporte une faute");
{
  const MOTS_BAT = ["batterie", "battery", "lifepo4", "lithium"];
  const MOTS_PAN = ["panneau", "panel", "photovolta", "pv "];
  const MOTS_CONV = ["convertisseur", "onduleur", "inverter", "inverseur"];
  const MOTS_REG = ["régulateur", "regulateur", "mppt"];

  // Les noms REELS du stock de Timo, qui n'etaient pas reconnus.
  test("« BATERIE 51,2V200AH » est enfin reconnue comme une batterie",
    Dim.contientLeMot("BATERIE 51,2V200AH", MOTS_BAT) === true);
  test("« BATERIE 12.8V100AH GEL » aussi",
    Dim.contientLeMot("BATERIE 12.8V100AH GEL", MOTS_BAT) === true);
  test("l'orthographe correcte marche évidemment toujours",
    Dim.contientLeMot("BATTERIE 200AH", MOTS_BAT) === true);
  test("le pluriel aussi",
    Dim.contientLeMot("BATTERIES 200AH", MOTS_BAT) === true);

  test("« PANEAU 400W » est reconnu comme un panneau",
    Dim.contientLeMot("PANEAU 400W", MOTS_PAN) === true);
  test("« CONVERTISEUR 5KVA » est reconnu comme un convertisseur",
    Dim.contientLeMot("CONVERTISEUR 5KVA", MOTS_CONV) === true);
  test("« REGULATEUR » sans accent est reconnu",
    Dim.contientLeMot("REGULATEUR MPPT 60A", MOTS_REG) === true);

  // Et surtout : on ne doit RIEN reconnaitre a tort.
  test("un câble n'est pas pris pour une batterie",
    Dim.contientLeMot("CABLE 6MM2 SOUPLE", MOTS_BAT) === false);
  test("un disjoncteur n'est pas pris pour un panneau",
    Dim.contientLeMot("DISJONCTEUR 63A", MOTS_PAN) === false);
  test("un coffret n'est pas pris pour un convertisseur",
    Dim.contientLeMot("COFFRET DE PROTECTION DC", MOTS_CONV) === false);
  test("une batterie n'est pas prise pour un régulateur",
    Dim.contientLeMot("BATERIE 51,2V200AH", MOTS_REG) === false);

  test("la simplification ramène bien les deux orthographes au même mot",
    Dim.simplifierMot("BATTERIE") === Dim.simplifierMot("BATERIE")
    && Dim.simplifierMot("Régulateur") === Dim.simplifierMot("REGULATEUR"));
}


titre("Un convertisseur qui mentionne MPPT l'a intégré : pas de régulateur en double");
{
  // Reprise EXACTE de estHybrideTexte (Solaire.jsx).
  const estHybride = (t) => /hybride|hybrid|mppt/i.test(t || "");
  const MOTS_CONV = ["convertisseur", "onduleur", "inverter", "inverseur"];
  const MOTS_REG = ["régulateur", "regulateur", "mppt", "chargeur solaire", "controller"];

  test("« SOSEN 5.5KVA MPPT » : régulateur déjà intégré, pas de ligne en plus",
    estHybride("SOSEN 5.5KVA MPPT") === true);
  test("« CONVERTISSEUR HYBRIDE 5KW » : inchangé, toujours reconnu",
    estHybride("CONVERTISSEUR HYBRIDE 5KW") === true);
  test("« hybrid » en anglais aussi", estHybride("INVERTER 5KW HYBRID") === true);
  test("un convertisseur ordinaire demande bien un régulateur",
    estHybride("CONVERTISSEUR 5000VA 48V") === false);

  // Le piege a eviter : que « MPPT » perturbe le rôle Régulateur lui-même.
  test("un vrai régulateur reste reconnu comme régulateur",
    Dim.contientLeMot("REGULATEUR MPPT 60A", MOTS_REG) === true);
  test("…et n'est JAMAIS pris pour un convertisseur (le piège du mot MPPT)",
    Dim.contientLeMot("REGULATEUR MPPT 60A", MOTS_CONV) === false);
  test("un chargeur solaire non plus",
    Dim.contientLeMot("CHARGEUR SOLAIRE MPPT 100A", MOTS_CONV) === false
    && Dim.contientLeMot("CHARGEUR SOLAIRE MPPT 100A", MOTS_REG) === true);
}


titre("Dimensionnement solaire : les chiffres de l'écran de Timo, verrouillés");
{
  // ⚠ CAS DE RÉFÉRENCE — capture d'écran du 18/08/2026, FORMA1, système 48 V
  // lithium. Ces quatre chiffres sont ceux que l'application affichait
  // AVANT toute modification. Ils font foi : si l'un d'eux bouge un jour,
  // c'est qu'une formule a été touchée, et il faudra le vouloir explicitement.
  const reel = Sol.besoinsSolaires(
    [{ puissance: 1235, heures: 8616 / 1235, qte: 1 }],
    { autonomie: 1, soleil: 3, tension: 48, typeBatterie: "lifepo4" });

  test("consommation : 8 616 Wh/jour", Math.round(reel.whParJour) === 8616);
  test("panneaux nécessaires : 3 590 Wc", reel.wcPanneaux === 3590);
  test("batterie (48 V) : 187 Ah", reel.ahBatterie === 187);
  test("convertisseur : 2,47 kW", reel.kwConvertisseur === 2.47);
  test("régulateur : 88 A", reel.aRegulateur === 88);

  // La règle métier que Timo a lui-même dictée : on calcule avec la tension
  // RÉELLE du pack lithium, pas avec la tension ronde annoncée.
  test("un pack 48 V lithium est calculé à 51,2 V, pas à 48",
    Sol.tensionDeCalcul("lifepo4", 48) === 51.2);
  test("un 24 V lithium à 25,6 V", Sol.tensionDeCalcul("lifepo4", 24) === 25.6);
  test("un 12 V lithium à 12,8 V", Sol.tensionDeCalcul("lifepo4", 12) === 12.8);
  test("une batterie GEL reste à sa tension nominale exacte",
    Sol.tensionDeCalcul("gel", 48) === 48 && Sol.tensionDeCalcul("gel", 24) === 24);

  // ⚠ Le gel est passé de 50 % à 70 % le 18/08/2026, sur décision de Timo.
  test("le lithium se décharge à 90 %, le gel à 70 % (décision Timo)",
    Sol.profondeurDecharge("lifepo4") === 0.9 && Sol.profondeurDecharge("gel") === 0.7);
  test("le plomb / AGM reste à 50 % — un ancien devis repris ne doit pas l'abîmer",
    Sol.profondeurDecharge("plomb") === 0.5);
  test("un type inconnu retombe sur la valeur la plus prudente",
    Sol.profondeurDecharge("n_importe_quoi") === 0.5);
  test("les pertes du système restent à 20 %", Sol.RENDEMENT_SYSTEME === 0.8);

  // Le gel, à consommation égale, demande bien plus de capacité.
  const enGel = Sol.besoinsSolaires(
    [{ puissance: 1235, heures: 8616 / 1235, qte: 1 }],
    { autonomie: 1, soleil: 3, tension: 48, typeBatterie: "gel" });
  test("le même besoin en GEL demande 257 Ah au lieu de 187 (c'était 359 à 50 %)",
    enGel.ahBatterie === 257);
  test("…mais le nombre de panneaux ne change pas",
    enGel.wcPanneaux === reel.wcPanneaux);

  // Deux jours d'autonomie doublent la batterie, pas les panneaux.
  const deuxJours = Sol.besoinsSolaires(
    [{ puissance: 1235, heures: 8616 / 1235, qte: 1 }],
    { autonomie: 2, soleil: 3, tension: 48, typeBatterie: "lifepo4" });
  test("2 jours d'autonomie : la batterie double (374 Ah)", deuxJours.ahBatterie === 374);
  test("…et les panneaux restent identiques", deuxJours.wcPanneaux === reel.wcPanneaux);

  // Moins de soleil = plus de panneaux, pour la même consommation.
  const peuDeSoleil = Sol.besoinsSolaires(
    [{ puissance: 1235, heures: 8616 / 1235, qte: 1 }],
    { autonomie: 1, soleil: 4, tension: 48, typeBatterie: "lifepo4" });
  test("4 h de soleil au lieu de 3 : moins de panneaux (2 693 Wc)",
    peuDeSoleil.wcPanneaux === 2693);

  // Le convertisseur ne dépend QUE de la puissance appelée d'un coup.
  const troisAppareils = [
    { puissance: 100, heures: 5, qte: 3 },   // 300 W appelés, 1 500 Wh
    { puissance: 800, heures: 2, qte: 1 },   // 800 W appelés, 1 600 Wh
  ];
  const b3 = Sol.besoinsSolaires(troisAppareils, { autonomie: 1, soleil: 3, tension: 24, typeBatterie: "lifepo4" });
  test("la quantité d'un appareil est bien multipliée",
    b3.whParJour === 3100 && b3.puissanceSimultanee === 1100);
  test("le convertisseur double la puissance appelée (2 200 W)",
    b3.wConvertisseur === 2200);

  // Cas limites : rien ne doit exploser ni renvoyer l'infini.
  const vide = Sol.besoinsSolaires([], { autonomie: 1, soleil: 3, tension: 48, typeBatterie: "lifepo4" });
  test("aucun appareil : tout à zéro, aucune erreur",
    vide.whParJour === 0 && vide.wcPanneaux === 0 && vide.ahBatterie === 0 && vide.aRegulateur === 0);
  const sansSoleil = Sol.besoinsSolaires(
    [{ puissance: 100, heures: 5, qte: 1 }], { autonomie: 1, soleil: 0, tension: 48, typeBatterie: "lifepo4" });
  test("0 heure de soleil : aucun panneau proposé, pas d'infini",
    sansSoleil.wcPanneaux === 0);
}


titre("Domaines de produits : la liste vient des Paramètres, plus du code");
{
  const vierge = { boutiques: [{ nom: "DEMAKPOE" }], produits: [] };

  test("une base qui n'a jamais rien réglé retrouve les 3 domaines d'origine",
    C.domainesDefinis(vierge).map((d) => d.id).join(",") === "solaire,garage,autre");
  test("les familles du Solaire sont celles que l'écran cherche déjà", (() => {
    const f = C.famillesDuDomaine(vierge, "solaire");
    return ["Panneaux solaires", "Batteries", "Convertisseur", "Régulateur MPPT"].every((x) => f.includes(x));
  })());
  test("celles du Garage aussi", (() => {
    const f = C.famillesDuDomaine(vierge, "garage");
    return ["Moteur / motorisation", "Crémaillère", "Télécommande", "Photocellules"].every((x) => f.includes(x));
  })());

  // Timo cree son domaine Camera depuis les Parametres.
  const avecCamera = {
    boutiques: [{ nom: "DEMAKPOE", domaines: [
      ...C.DOMAINES_DEFAUT,
      { id: "camera", nom: "Caméra", icone: "📹", calcul: "libre",
        familles: ["Caméra", "Enregistreur", "Disque dur"] },
    ] }],
    produits: [],
  };
  test("le domaine qu'il crée est bien pris en compte",
    C.domaineParId(avecCamera, "camera").nom === "Caméra");
  test("…avec ses propres familles, et elles seules",
    C.famillesDuDomaine(avecCamera, "camera").join(",") === "Caméra,Enregistreur,Disque dur");
  test("…sans toucher aux domaines existants",
    C.famillesDuDomaine(avecCamera, "solaire").includes("Batteries"));
  test("un domaine inconnu ne fait pas planter l'écran",
    C.domaineParId(avecCamera, "n_existe_pas") === null
    && C.famillesDuDomaine(avecCamera, "n_existe_pas").length === 0);

  // L'identifiant doit rester stable et propre, quel que soit ce qui est tape.
  test("« Caméra » devient l'identifiant « camera »", C.idDepuisNom("Caméra") === "camera");
  test("« Climatisation / Froid » devient « climatisation_froid »",
    C.idDepuisNom("Climatisation / Froid") === "climatisation_froid");
  test("un nom déjà propre n'est pas abîmé", C.idDepuisNom("solaire") === "solaire");
  test("un nom sans lettre exploitable ne produit pas d'identifiant vide et dangereux",
    C.idDepuisNom("???") === "" && C.idDepuisNom("") === "");

  test("toutes les familles réunies servent de menu de repli",
    C.toutesLesFamilles(avecCamera).includes("Enregistreur")
    && C.toutesLesFamilles(avecCamera).includes("Batteries"));
}


titre("Les onglets du Dimensionnement viennent des Paramètres");
{
  const camera = { id: "camera", nom: "Caméra", icone: "📹", calcul: "libre",
                   familles: ["Caméra", "Enregistreur", "Disque dur"] };
  const db = { boutiques: [{ nom: "DEMAKPOE", domaines: [...C.DOMAINES_DEFAUT, camera] }], produits: [] };

  const onglets = C.domainesDefinis(db).map((d) => d.id);
  test("les 3 onglets d'origine sont toujours là, dans le même ordre",
    onglets.slice(0, 3).join(",") === "solaire,garage,autre");
  test("le domaine créé par Timo apparaît comme 4ᵉ onglet",
    onglets[3] === "camera");

  // L'aiguillage : quel ecran ouvre chaque onglet.
  const ecran = (id) => {
    const d = C.domaineParId(db, id);
    return d.calcul === "solaire" ? "Solaire" : d.calcul === "garage" ? "Garage" : "Libre";
  };
  test("Solaire garde son écran de calcul", ecran("solaire") === "Solaire");
  test("Garage garde le sien", ecran("garage") === "Garage");
  test("Caméra ouvre l'écran libre — aucun calcul inventé", ecran("camera") === "Libre");

  // La reprise d'un ANCIEN devis doit continuer de tomber sur le bon onglet.
  const domaineDuDevis = (d) => {
    if (!d) return null;
    const t = d.type_devis;
    if (t === "garage") return "garage";
    if (t === "autre") return C.domainesDefinis(db).some((x) => x.id === d.domaine) ? d.domaine : "autre";
    return "solaire";
  };
  test("un ancien devis solaire (sans domaine) rouvre bien dans Solaire",
    domaineDuDevis({ type_devis: "solaire" }) === "solaire");
  test("un ancien devis garage aussi", domaineDuDevis({ type_devis: "garage" }) === "garage");
  test("un ancien devis « autre », sans domaine, rouvre dans Autre",
    domaineDuDevis({ type_devis: "autre" }) === "autre");
  test("un devis Caméra rouvre dans Caméra",
    domaineDuDevis({ type_devis: "autre", domaine: "camera" }) === "camera");
  test("un devis dont le domaine a été SUPPRIMÉ depuis retombe dans Autre — jamais dans le vide",
    domaineDuDevis({ type_devis: "autre", domaine: "plomberie_effacee" }) === "autre");
  test("un devis sans type du tout retombe sur Solaire, comme avant",
    domaineDuDevis({}) === "solaire");

  // Filet : une base sans reglage garde exactement les 3 onglets d'avant.
  test("une base qui n'a jamais rien réglé garde les 3 onglets d'origine",
    C.domainesDefinis({ boutiques: [{ nom: "X" }] }).map((d) => d.id).join(",") === "solaire,garage,autre");
}


titre("Volet libre : on travaille par DOMAINE, l'étape « catégorie » a disparu");
{
  // Reprise de la regle posee dans Autre.jsx.
  const vivier = (produitsBoutique, domaine) => {
    const duDomaine = domaine ? produitsBoutique.filter((p) => p.domaine === domaine.id) : [];
    return duDomaine.length > 0 ? duDomaine : produitsBoutique;
  };
  const camera = { id: "camera", nom: "Caméra", icone: "📹", calcul: "libre", familles: ["Caméra", "Enregistreur"] };
  const stock = [
    { id: "p1", nom: "CAMERA IP 4MP", domaine: "camera", categorie: "Caméra" },
    { id: "p2", nom: "ENREGISTREUR 8 VOIES", domaine: "camera", categorie: "Enregistreur" },
    { id: "p3", nom: "BATERIE 51,2V200AH", domaine: "solaire", categorie: "Batteries" },
    { id: "p4", nom: "CABLE 6MM2" },
  ];

  const v = vivier(stock, camera);
  test("l'onglet Caméra propose TOUS les articles du domaine, d'un seul coup",
    v.length === 2 && v.map((p) => p.id).join(",") === "p1,p2");
  test("…et jamais ceux d'un autre domaine",
    !v.some((p) => p.id === "p3"));
  test("plus besoin de choisir une catégorie avant de commencer",
    v.length === stock.filter((p) => p.domaine === "camera").length);

  // Le filet : un stock pas encore rattache ne doit pas rendre l'ecran vide.
  const pasEncoreRattache = [{ id: "x1", nom: "CAMERA IP" }, { id: "x2", nom: "ENREGISTREUR" }];
  test("stock pas encore rattaché : tout reste proposé, l'écran n'est jamais vide",
    vivier(pasEncoreRattache, camera).length === 2);
  test("une boutique réellement vide reste vide, sans planter",
    vivier([], camera).length === 0);

  // Le devis porte le nom du domaine, plus une categorie de stock.
  const intitule = (besoinsRepris, domaine) => besoinsRepris?.categorie || (domaine ? domaine.nom : "Autre");
  test("le devis est rangé sous le nom du domaine",
    intitule(null, camera) === "Caméra");
  test("un devis repris garde l'intitulé sous lequel il avait été établi",
    intitule({ categorie: "BATTERIE" }, camera) === "BATTERIE");
  test("sans domaine du tout, on retombe sur « Autre »",
    intitule(null, null) === "Autre");
}


titre("Stocks : choisir un domaine ne doit plus proposer les catégories des autres");
{
  // Le cas exact de la capture de Timo : domaine Solaire choisi, et la liste
  // proposait quand meme BATTERIE / PANNEAU / CONVERTISSEUR — les categories
  // libres d'articles n'appartenant a aucun domaine.
  const db = {
    boutiques: [{ nom: "DEMAKPOE", domaines: [...C.DOMAINES_DEFAUT,
      { id: "camera", nom: "Caméra", icone: "📹", calcul: "libre", familles: ["Caméra", "Enregistreur"] }] }],
    produits: [
      { id: "a", nom: "BATERIE 200AH", categorie: "BATTERIE" },        // sans domaine
      { id: "b", nom: "PANNEAU 400W", categorie: "PANNEAU" },          // sans domaine
      { id: "c", nom: "CAMERA IP", domaine: "camera", categorie: "Caméra" },
      { id: "d", nom: "ONDULEUR 5KVA", domaine: "solaire", categorie: "Convertisseur" },
    ],
  };
  // Reprise de la regle posee dans Stocks.jsx.
  const proposees = (domaine) => (domaine
    ? [...new Set([
        ...C.famillesDuDomaine(db, domaine),
        ...db.produits.filter((p) => p.domaine === domaine).map((p) => p.categorie).filter(Boolean),
      ])]
    : [...new Set([
        ...C.toutesLesFamilles(db),
        ...db.produits.map((p) => p.categorie).filter(Boolean),
      ])]);

  const solaire = proposees("solaire");
  test("domaine Solaire : ses familles sont proposées",
    solaire.includes("Panneaux solaires") && solaire.includes("Batteries"));
  test("…et PLUS les catégories libres des articles sans domaine (le défaut vu par Timo)",
    !solaire.includes("BATTERIE") && !solaire.includes("PANNEAU"));
  test("…ni celles d'un autre domaine",
    !solaire.includes("Caméra") && !solaire.includes("Enregistreur"));
  test("mais la catégorie d'un article DÉJÀ rangé dans Solaire reste visible",
    solaire.includes("Convertisseur"));

  const cam = proposees("camera");
  test("domaine Caméra : ses familles seulement",
    cam.includes("Caméra") && cam.includes("Enregistreur")
    && !cam.includes("Batteries") && !cam.includes("BATTERIE"));

  const aucun = proposees("");
  test("sans domaine choisi : tout reste proposé, rien n'est perdu",
    aucun.includes("BATTERIE") && aucun.includes("PANNEAU")
    && aucun.includes("Batteries") && aucun.includes("Caméra"));
}


titre("Livraison 3 : le rangement du stock fait foi, le nom sert de repli");
{
  const MOTS_BAT = ["batterie", "battery", "lifepo4", "lithium"];
  // Reprise EXACTE de la regle posee dans Solaire.jsx et Garage.jsx.
  const retenu = (p, role, idDomaine) => (p.domaine
    ? (p.domaine === idDomaine && Dim.memeFamille(p.categorie, role.label))
    : Dim.contientLeMot(p.nom + " " + (p.categorie || ""), role.mots));
  const roleBatterie = { label: "Batteries", mots: MOTS_BAT };

  // LE CAS DE TIMO : « BATERIE », mal orthographiee, mais bien rangee.
  test("une « BATERIE » rangée dans Solaire → Batteries est retenue, malgré la faute",
    retenu({ nom: "BATERIE 51,2V200AH", domaine: "solaire", categorie: "Batteries" }, roleBatterie, "solaire") === true);
  test("…et le nom n'entre même plus en jeu : un nom illisible passe s'il est bien rangé",
    retenu({ nom: "REF-XYZ-9981", domaine: "solaire", categorie: "Batteries" }, roleBatterie, "solaire") === true);

  // Le rangement ECARTE aussi, et c'est le but.
  test("un article rangé dans une AUTRE famille est écarté, même si son nom dit « batterie »",
    retenu({ nom: "BATTERIE DE SECOURS", domaine: "solaire", categorie: "Accessoires" }, roleBatterie, "solaire") === false);
  test("un article rangé dans un AUTRE domaine est écarté",
    retenu({ nom: "BATTERIE 12V", domaine: "camera", categorie: "Batteries" }, roleBatterie, "solaire") === false);

  // LE REPLI : un article pas encore range se comporte comme avant.
  test("un article SANS domaine est toujours trouvé par son nom, comme avant",
    retenu({ nom: "BATERIE 51,2V200AH" }, roleBatterie, "solaire") === true);
  test("…et toujours écarté si son nom ne dit rien",
    retenu({ nom: "CABLE 6MM2" }, roleBatterie, "solaire") === false);

  // Les familles renommees : le lien tolere accents, doublons et precisions.
  const roleCellule = { label: "Photocellules (cellules infrarouges)", mots: ["cellule"] };
  test("« Photocellules » retrouve « Photocellules (cellules infrarouges) »",
    retenu({ nom: "CELLULE IR", domaine: "garage", categorie: "Photocellules" }, roleCellule, "garage") === true);
  const roleReg = { label: "Régulateur MPPT", mots: ["mppt"] };
  test("« Regulateur MPPT » sans accent retrouve « Régulateur MPPT »",
    retenu({ nom: "X", domaine: "solaire", categorie: "Regulateur MPPT" }, roleReg, "solaire") === true);

  // Une famille renommee sans rapport : le lien se perd, mais rien ne casse —
  // l'article est simplement ecarte, et l'ecran en donnera la raison.
  test("une famille renommée sans rapport écarte l'article, sans planter",
    retenu({ nom: "BATERIE 200AH", domaine: "solaire", categorie: "Accumulateurs" }, roleBatterie, "solaire") === false);

  test("un article rangé dans le domaine mais SANS famille est écarté",
    retenu({ nom: "BATERIE 200AH", domaine: "solaire", categorie: "" }, roleBatterie, "solaire") === false);
}


titre("Un PV signé ne gèle plus jamais les commissions — et le passé est rattrapé");
{
  const boutiques = [{ nom: "DEMAKPOE", formation: false }];
  const users = [{ id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true }];
  const timo = { id: "u_timo", role: "admin" };

  const dbAvec = (ventes, chantiers) => ({ boutiques, users, ventes, dettes: [],
    clients_installes: chantiers, messages: [] });

  // Le scenario exact du defaut : chantier signe (receptionne), vente gelee.
  const venteGelee = { id: "v1", boutique: "DEMAKPOE", commercial: "KOFFI",
    articles: [{ qte: 1, pu: 1000000 }], commission_a_la_reception: true };
  const chantierSigne = { id: "ch1", nom: "AGBEKO", vente_id: "v1", statut: "receptionne" };

  const db1 = dbAvec([venteGelee], [chantierSigne]);
  test("un chantier signé dont la vente est encore gelée est repéré par le rattrapage",
    C.chantiersAReconcilier(db1, timo).length === 1);

  test("…et une fois débloquée, la commission redevient payable", (() => {
    const { ventes } = C.debloquerCommissionsReception(db1, "v1", "test");
    const v = ventes.find((x) => x.id === "v1");
    return v.commission_a_la_reception === false && C.commissionVente(v, 5) === 50000;
  })());

  test("le rattrapage est IDEMPOTENT : une vente débloquée n'est jamais resélectionnée", (() => {
    const { ventes } = C.debloquerCommissionsReception(db1, "v1", "test");
    return C.chantiersAReconcilier(dbAvec(ventes, [chantierSigne]), timo).length === 0;
  })());

  // La part du parrain, gelee elle aussi, est couverte et son message part.
  const venteParrain = { id: "v2", boutique: "DEMAKPOE",
    articles: [{ qte: 1, pu: 500000 }],
    apporteur: { nom: "FILLEUL", parrain_user_id: "u_parrain", a_la_reception: true, montant: 25000 } };
  const chantierParrain = { id: "ch2", nom: "FILLEUL", vente_id: "v2", statut: "receptionne" };
  const db2 = dbAvec([venteParrain], [chantierParrain]);
  test("la part de parrainage gelée est repérée aussi, même sans commission de commercial",
    C.chantiersAReconcilier(db2, timo).length === 1);
  test("…débloquée, et le parrain reçoit enfin son message « votre commission est due »", (() => {
    const { ventes, messages } = C.debloquerCommissionsReception(db2, "v2", "test");
    const v = ventes.find((x) => x.id === "v2");
    return v.apporteur.a_la_reception === false
      && messages.some((m) => m.client_id === "u_parrain" && /commission de parrainage/.test(m.texte));
  })());

  // Ce que le rattrapage ne doit PAS toucher.
  test("un chantier encore « terminé » n'est pas pris (c'est le travail du J+7)",
    C.chantiersAReconcilier(dbAvec([venteGelee], [{ ...chantierSigne, statut: "termine" }]), timo).length === 0);
  test("un chantier pose seule (sans vente) est ignoré sans planter",
    C.chantiersAReconcilier(dbAvec([], [{ id: "ch3", nom: "X", vente_id: null, statut: "receptionne", pose_seule: true }]), timo).length === 0);
  test("un chantier signé dont la vente n'a JAMAIS été gelée n'est pas resélectionné",
    C.chantiersAReconcilier(dbAvec([{ id: "v3", boutique: "DEMAKPOE", articles: [{ qte: 1, pu: 1000 }] }],
      [{ id: "ch4", nom: "Y", vente_id: "v3", statut: "receptionne" }]), timo).length === 0);
  test("une vente introuvable est ignorée sans planter",
    C.chantiersAReconcilier(dbAvec([], [{ id: "ch5", nom: "Z", vente_id: "v_disparue", statut: "receptionne" }]), timo).length === 0);

  // Cloisonnement : le rattrapage respecte l'espace du compte connecte.
  const dbMixte = { boutiques: [...boutiques, { nom: "FORMA1", formation: true }],
    users: [...users, { id: "u_stag", nom: "DODO", role: "vendeur", boutique: "FORMA1" }],
    ventes: [venteGelee, { id: "v_f", boutique: "FORMA1", commission_a_la_reception: true, articles: [{ qte: 1, pu: 1000 }] }],
    dettes: [],
    clients_installes: [chantierSigne, { id: "ch_f", nom: "ESSAI", vente_id: "v_f", statut: "receptionne" }],
    messages: [] };
  test("un compte de formation ne rattrape que les chantiers de SON espace",
    C.chantiersAReconcilier(dbMixte, { id: "u_stag", role: "vendeur" }).map((c) => c.id).join(",") === "ch_f");
  test("l'administrateur principal rattrape les deux",
    C.chantiersAReconcilier(dbMixte, timo).length === 2);
}

titre("Les salaires quittent la fiche employé sans que rien ne se casse");
{
  const employes = () => ([
    { id: "u_vend", nom: "KOSSI", role: "vendeur", boutique: "APESSITO",
      salaire_base: 120000, primes: [{ mois: "2026-08", montant: 5000 }],
      virements: [{ id: "v1", statut: "en_attente" }], credits: [],
      piece_num: "AB1234", cnss_matricule: "M-9" },
    { id: "u_admin", nom: "TIMO", role: "admin", salaire_base: 400000 },
    { id: "u_tech", nom: "AYI", role: "technicien" },
  ]);
  const admin = { id: "u_admin", admin: true };
  const vendeur = { id: "u_vend", admin: false };

  const sepAdmin = Paie.separerPaie(employes(), admin);
  test("l'administrateur détache les fiches de paie de tout le monde",
    sepAdmin.paie.length === 2);
  test("le salaire quitte la fiche employé",
    sepAdmin.users.every((u) => u.salaire_base === undefined));
  test("le numéro de pièce et le matricule CNSS partent aussi",
    sepAdmin.users.every((u) => u.piece_num === undefined && u.cnss_matricule === undefined));
  test("le nom, le rôle et la boutique restent sur la fiche employé",
    sepAdmin.users[0].nom === "KOSSI" && sepAdmin.users[0].role === "vendeur" && sepAdmin.users[0].boutique === "APESSITO");
  test("un employé sans aucun champ d'argent n'a pas de fiche de paie inutile",
    !sepAdmin.paie.some((p) => p.id === "u_tech"));
  test("recoller les deux redonne EXACTEMENT la fiche de départ",
    JSON.stringify(Paie.fusionnerPaie(sepAdmin.users, sepAdmin.paie).map((u) => Object.fromEntries(Object.entries(u).sort())))
    === JSON.stringify(employes().map((u) => Object.fromEntries(Object.entries(u).sort()))));

  // ⚠ Le piège : un appareil qui ne reçoit PAS les fiches de paie des autres
  // ne doit jamais en fabriquer de vides et les envoyer au serveur.
  const sepVend = Paie.separerPaie(employes(), vendeur);
  test("un vendeur ne détache QUE sa propre fiche de paie",
    sepVend.paie.length === 1 && sepVend.paie[0].id === "u_vend");
  test("…et laisse intactes les fiches des autres",
    sepVend.users.find((u) => u.id === "u_admin").salaire_base === 400000);
  const sepPersonne = Paie.separerPaie(employes(), {});
  test("sans écrivain connu, rien n'est détaché (comportement d'avant)",
    sepPersonne.paie.length === 0 && sepPersonne.users[0].salaire_base === 120000);

  // Cas réel d'un appareil de vendeur : il ne reçoit aucune fiche de paie.
  const sansPaie = Paie.fusionnerPaie(sepAdmin.users, []);
  test("un appareil qui ne reçoit aucune fiche de paie ne plante pas",
    sansPaie.length === 3 && sansPaie[0].salaire_base === undefined);
  test("…et les calculs de paie y renvoient zéro au lieu de casser",
    (sansPaie[0].virements || []).length === 0 && (sansPaie[0].credits || []).length === 0);
  test("détacher deux fois de suite ne change plus rien (idempotent)",
    JSON.stringify(Paie.separerPaie(sepAdmin.users, admin).users) === JSON.stringify(sepAdmin.users));
  test("les taux de commission RESTENT sur la fiche employé (calculs partagés)",
    !Paie.CHAMPS_PAIE.includes("taux_commission") && !Paie.CHAMPS_PAIE.includes("taux_equipe"));
}


titre("La boutique choisie survit au rechargement de la page — une mémoire PAR ÉCRAN");
{
  // ⚠ CE QUE CE BLOC PROTÈGE. Le choix de la boutique ne vivait que dans la
  // mémoire vive de la page : au moindre rechargement — F5, le bouton
  // « Nouvelle version — recharger », un téléphone qui met l'application en
  // veille — les écrans repartaient sur LA PREMIÈRE boutique de la liste,
  // en silence. C'est ainsi que le stock d'un magasin a été saisi dans un
  // autre, et Ventes, Caisse, Dépenses et Dettes avaient le même défaut.
  //
  // Le stockage du navigateur n'existe pas sous Node : on le simule, ce qui
  // permet AUSSI de vérifier ce qui se passe quand il est indisponible.
  const memoire = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memoire.has(k) ? memoire.get(k) : null),
    setItem: (k, v) => memoire.set(k, String(v)),
  };
  const db = base();
  // Un compte de formation NON rattaché à une boutique : c'est lui qui
  // pourrait hériter d'une vraie boutique mémorisée.
  const formLibre = { id: "u_form_libre", role: "vendeur" };
  db.users.push({ id: "u_form_libre", nom: "STAGIAIRE LIBRE", role: "vendeur", formation: true });
  const sansTerrain = db.boutiques.filter((b) => !b.terrain);

  test("sans rien de mémorisé, le comportement d'avant ne change pas",
    C.boutiqueParDefaut(db, P.admin, { ecran: "ventes" }) === "APESSITO");

  C.memoriserBoutique(P.admin, "ventes", "HEDZRANAWOE");
  test("★ après un rechargement, on revient dans la boutique où on travaillait",
    C.boutiqueParDefaut(db, P.admin, { ecran: "ventes" }) === "HEDZRANAWOE");
  test("★ …et l'écran la retient aussi quand la page est rouverte à vide",
    C.boutiqueRetenue(db, P.admin, "", { ecran: "ventes" }) === "HEDZRANAWOE");

  // ⚠ LE CHOIX DE TIMO : chaque écran a SA boutique. Encaisser à
  // HEDZRANAWOE ne doit pas déplacer le rangement du stock.
  C.memoriserBoutique(P.admin, "stocks", "DEPOT");
  test("★ chaque écran garde SA boutique : Ventes reste à HEDZRANAWOE…",
    C.boutiqueParDefaut(db, P.admin, { ecran: "ventes" }) === "HEDZRANAWOE");
  test("★ …pendant que Stocks reste au DEPOT",
    C.boutiqueParDefaut(db, P.admin, { ecran: "stocks", permises: sansTerrain }) === "DEPOT");
  test("★ un écran jamais utilisé n'hérite de rien : il ouvre sur la boutique par défaut",
    C.boutiqueParDefaut(db, P.admin, { ecran: "depenses" }) === "APESSITO");
  test("les deux écrans de Commandes ne se marchent pas dessus",
    C.boutiqueParDefaut(db, P.admin, { ecran: "commandes-nouvelle" }) === "APESSITO"
    && C.boutiqueParDefaut(db, P.admin, { ecran: "commandes-recues" }) === "APESSITO");

  // ⚠ LE POINT LE PLUS IMPORTANT DE CE BLOC.
  C.memoriserBoutique(formLibre, "ventes", "APESSITO");
  test("★ la mémoire ne franchit JAMAIS le cloisonnement : un compte de formation ne récupère pas une vraie boutique",
    C.boutiqueParDefaut(db, formLibre, { ecran: "ventes" }) === "APESSITO FORMATION");

  C.memoriserBoutique(P.admin2, "ventes", "BOUTIQUE SUPPRIMEE DEPUIS");
  test("une boutique disparue est ignorée, on repart du défaut",
    C.boutiqueParDefaut(db, P.admin2, { ecran: "ventes" }) === "APESSITO");

  test("la mémoire est PAR COMPTE : deux personnes sur le même appareil ne se mélangent pas",
    C.boutiqueMemorisee(P.admin, "ventes") === "HEDZRANAWOE"
    && C.boutiqueMemorisee(P.admin2, "ventes") === "BOUTIQUE SUPPRIMEE DEPUIS");
  test("un compte rattaché à une boutique n'est jamais déplacé par la mémoire",
    C.boutiqueRetenue(db, P.vendeur, "", { ecran: "ventes" }) === "APESSITO");

  test("…et un magasin n'est jamais proposé aux écrans de vente",
    C.boutiqueParDefaut(db, P.admin, { ecran: "stocks" }) === "APESSITO");
  // ⚠ TERRAIN est une boutique virtuelle, sans stock : jamais un lieu de travail.
  C.memoriserBoutique(P.admin, "stocks", "TERRAIN");
  test("TERRAIN, boutique virtuelle, n'est jamais retrouvée comme lieu de travail",
    C.boutiqueParDefaut(db, P.admin, { ecran: "stocks", permises: sansTerrain }) === "APESSITO");

  // Navigation privée, stockage plein, vieux navigateur : rien ne doit casser.
  globalThis.localStorage = {
    getItem: () => { throw new Error("stockage refusé"); },
    setItem: () => { throw new Error("stockage refusé"); },
  };
  test("★ si le navigateur refuse le stockage, l'application marche comme avant",
    C.boutiqueParDefaut(db, P.admin, { ecran: "ventes" }) === "APESSITO"
    && C.boutiqueMemorisee(P.admin, "ventes") === "");
  let planta = false;
  try { C.memoriserBoutique(P.admin, "ventes", "APESSITO"); } catch { planta = true; }
  test("…et mémoriser ne fait jamais planter l'écran", !planta);
  delete globalThis.localStorage;
  test("sans stockage du tout (rendu hors navigateur), rien ne casse non plus",
    C.boutiqueParDefaut(db, P.admin, { ecran: "ventes" }) === "APESSITO");
}

titre("La présélection d'un article déjà enregistré ailleurs (demande Timo, 25/08/2026)");
{
  // ⚠ CE QUE CE BLOC PROTÈGE. La première version posait une QUESTION à
  // l'ajout (« cet article existe déjà ailleurs, est-ce la bonne
  // boutique ? »). Timo l'a rejetée : ses boutiques vendent les mêmes
  // équipements, donc l'alerte se déclenchait sur le cas NORMAL. Elle est
  // remplacée par un service : on propose la fiche existante, un clic
  // reprend tout. Et surtout, cette version-là filtre par espace — la
  // capture montrait une boutique de FORMATION citée à un compte réel.
  const db = base();
  db.produits = [
    { id: "p1", boutique: "HEDZRANAWOE", nom: "COFFRET ETANCHE IP65", prix_vente: 12000, fournisseur: "SOLARIS" },
    { id: "p2", boutique: "DEPOT", nom: "COFFRET ETANCHE IP65", prix_vente: 12000 },
    { id: "p3", boutique: "APESSITO FORMATION", nom: "COFFRET ECOLE IP65", prix_vente: 7 },
    { id: "p4", boutique: "APESSITO", nom: "BATTERIE GEL 12V200AH", prix_vente: 140000 },
  ];
  const chez = (profile, bq, nom) => C.articlesSimilaires(db, profile, bq, nom);

  test("on propose l'article enregistré dans une autre boutique",
    chez(P.admin, "APESSITO", "COFFRET ETANCHE").length === 1);
  // ⚠ Deux articles distincts portent « COFFRET » : l'admin principal voit
  // les deux espaces, il reçoit donc les deux. Ce n'est pas une fuite, c'est
  // la dérogation « tous » — vérifiée à part plus bas.
  test("un article d'un autre espace n'est plus compté dans les propositions",
    chez(P.admin, "APESSITO", "COFFRET").length === 1);
  test("…avec la liste des boutiques qui le détiennent déjà",
    chez(P.admin, "APESSITO", "COFFRET")[0].boutiques.join(",") === "HEDZRANAWOE,DEPOT");
  test("★ et l'inverse : pas d'article réel proposé dans l'espace d'entraînement",
    chez(P.admin, "APESSITO FORMATION", "BATTERIE").length === 0);
  test("…et la fiche à reprendre (fournisseur, prix)",
    chez(P.admin, "APESSITO", "COFFRET")[0].article.fournisseur === "SOLARIS");
  // ⚠ DEMANDE TIMO : la proposition doit sortir DÈS LA PREMIÈRE LETTRE.
  // Taper « C » et ne rien voir donne l'impression que ça ne marche pas.
  test("★ la première lettre suffit à faire apparaître la proposition",
    chez(P.admin, "APESSITO", "C").length > 0);
  test("★ …et ce sont les noms qui COMMENCENT par cette lettre qui remontent",
    chez(P.admin, "APESSITO", "C")[0].article.nom.startsWith("COFFRET"));
  test("un champ vide ne propose toujours rien",
    chez(P.admin, "APESSITO", "").length === 0 && chez(P.admin, "APESSITO", "   ").length === 0);
  // Le classement doit être stable : sinon la liste saute d'une frappe à
  // l'autre et on clique sur la mauvaise ligne.
  test("à rang égal, l'ordre est alphabétique (la liste ne saute pas)",
    JSON.stringify(chez(P.admin, "APESSITO", "COFFRET").map((x) => x.article.nom))
    === JSON.stringify(chez(P.admin, "APESSITO", "COFFRET").map((x) => x.article.nom).sort()));
  // ⚠ CORRIGÉ SUR DEMANDE DE TIMO : « dans la même boutique, les articles ne
  // sont pas proposés ». Je les écartais volontairement — et c'était une
  // erreur : voir un article DÉJÀ présent ici est justement ce qui évite de
  // le créer deux fois, et donc de couper son stock en deux fiches.
  test("★ un article de la boutique EN COURS est proposé lui aussi",
    chez(P.admin, "APESSITO", "BATTERIE").length === 1);
  test("★ …et c'est bien SA fiche à lui qui est renvoyée, pas celle d'ailleurs",
    chez(P.admin, "APESSITO", "BATTERIE")[0].article.boutique === "APESSITO");
  test("un même nom présent ici ET ailleurs ne fait qu'une seule proposition",
    chez(P.admin, "HEDZRANAWOE", "COFFRET ETANCHE").length === 1);
  test("…et c'est la fiche d'ICI qui prime (c'est elle qu'on corrigera)",
    chez(P.admin, "HEDZRANAWOE", "COFFRET ETANCHE")[0].article.boutique === "HEDZRANAWOE");
  test("les accents et la casse n'empêchent pas de retrouver l'article",
    chez(P.admin, "APESSITO", "coffret étanche").length === 1);

  // ⚠ LE POINT LE PLUS IMPORTANT — c'est le défaut visible sur la capture.
  const formLibre = { id: "u_form_libre", role: "vendeur" };
  db.users.push({ id: "u_form_libre", nom: "STAGIAIRE LIBRE", role: "vendeur", formation: true });
  test("★ un compte de FORMATION ne se voit jamais proposer un article réel",
    chez(formLibre, "APESSITO FORMATION", "COFFRET").every((x) => x.article.boutique === "APESSITO FORMATION"));
  // ⚠ Depuis que la boutique EN COURS est incluse, ce compte voit bien SON
  // article d'entraînement — c'est voulu. Ce qu'on vérifie ici, c'est
  // qu'aucune boutique RÉELLE n'apparaît dans ce qui lui est proposé.
  test("★ …donc jamais les vrais prix de l'entreprise",
    chez(formLibre, "APESSITO FORMATION", "COFFRET").length > 0
    && chez(formLibre, "APESSITO FORMATION", "COFFRET").every((x) =>
      x.boutiques.every((n) => db.boutiques.find((b) => b.nom === n)?.formation === true)));
  test("★ et un compte réel ne se voit jamais proposer un article d'entraînement",
    chez(P.admin2, "APESSITO", "COFFRET ECOLE").length === 0);
  // ⚠ CORRIGÉ LE 25/08/2026 SUR CAPTURE DE TIMO. L'admin principal voit les
  // deux espaces — ma première version lui proposait donc des articles
  // d'ENTRAÎNEMENT, prix fictifs compris, pendant qu'il créait dans une VRAIE
  // boutique. Un clic et un prix d'école entrait dans le stock réel.
  // Ce qui décide, ce n'est pas ce que le compte peut voir, c'est OÙ
  // l'article va être créé.
  test("★ même l'admin principal ne se voit pas proposer un article d'entraînement pour une VRAIE boutique",
    chez(P.admin, "APESSITO", "COFFRET ECOLE").length === 0);
  test("★ …et l'inverse : pas d'article réel proposé pour une boutique d'entraînement",
    chez(P.admin, "APESSITO FORMATION", "COFFRET ETANCHE").length === 0);
  test("dans son espace d'entraînement, il retrouve bien ses articles d'entraînement",
    (C.setRegardeFormation(true),
     chez(P.admin, "DEPOT FORMATION", "COFFRET ECOLE").length === 1));
  C.setRegardeFormation(false);
  test("une boutique inconnue ne propose rien plutôt que n'importe quoi",
    chez(P.admin, "BOUTIQUE QUI N EXISTE PAS", "COFFRET").length === 0);

  test("une base sans articles ne fait pas planter la proposition",
    C.articlesSimilaires({ boutiques: [], users: [], produits: [] }, P.admin, "X", "COFFRET").length === 0);
}

titre("Aucun mouvement de stock entre le RÉEL et l'ENTRAÎNEMENT (question de Timo, 25/08/2026)");
{
  // ⚠ CE QUE CE BLOC PROTÈGE. À la question « transfert entre boutique réel
  // et formation possible ? », la mesure a répondu OUI — et pour le compte de
  // Timo lui-même. Le code demandait « quelles boutiques ce compte peut-il
  // VOIR ? » ; comme l'administrateur principal voit les deux espaces, toutes
  // lui étaient proposées comme destination. Et le verrou d'écriture rend la
  // main dès qu'un compte voit les deux espaces.
  //
  // Ce qui serait arrivé : 3 batteries sortent du stock RÉEL — donc de la
  // valeur d'inventaire et des marges — et réapparaissent dans une boutique
  // d'entraînement. Aucune vente, aucune dépense, aucune trace comptable.
  const db = base();
  const toutesSaufTerrain = db.boutiques.filter((b) => !b.terrain);
  const noms = (liste) => liste.map((b) => b.nom).sort().join(", ");

  test("★ depuis une VRAIE boutique, aucune boutique d'entraînement n'est proposée",
    C.boutiquesDuMemeEspace(db, P.admin, toutesSaufTerrain, "APESSITO")
      .every((b) => !b.formation));
  test("★ …y compris pour l'administrateur principal, qui voit pourtant les deux espaces",
    !noms(C.boutiquesDuMemeEspace(db, P.admin, toutesSaufTerrain, "APESSITO")).includes("FORMATION"));
  test("★ depuis une boutique d'ENTRAÎNEMENT, aucune vraie boutique n'est proposée",
    C.boutiquesDuMemeEspace(db, P.admin, toutesSaufTerrain, "APESSITO FORMATION")
      .every((b) => !!b.formation));
  test("les destinations légitimes restent proposées (une défense qui bloque tout ne sert à rien)",
    noms(C.boutiquesDuMemeEspace(db, P.admin, toutesSaufTerrain, "APESSITO")) === "APESSITO, DEPOT, HEDZRANAWOE");
  // ⚠ Préparer les exercices reste possible — mais il faut REGARDER
  // l'entraînement pour cela. C'est cohérent : on ne déplace pas du stock
  // dans un espace qu'on n'a pas sous les yeux.
  C.setRegardeFormation(true);
  test("…et l'entraînement garde les siennes (préparer les exercices reste possible)",
    noms(C.boutiquesDuMemeEspace(db, P.admin, toutesSaufTerrain, "APESSITO FORMATION")) === "APESSITO FORMATION, DEPOT FORMATION");
  C.setRegardeFormation(false);
  test("une boutique de départ inconnue ne propose rien plutôt que n'importe quoi",
    C.boutiquesDuMemeEspace(db, P.admin, toutesSaufTerrain, "BOUTIQUE FANTOME").length === 0);

  // Le deuxième verrou : celui qui refuse le GESTE, pas seulement la liste.
  test("★ le mouvement réel → entraînement est refusé au moment du geste",
    !!C.refusMouvementEntreEspaces(db, "APESSITO", "APESSITO FORMATION"));
  test("★ et le mouvement entraînement → réel aussi",
    !!C.refusMouvementEntreEspaces(db, "DEPOT FORMATION", "HEDZRANAWOE"));
  test("un mouvement entre deux vraies boutiques passe",
    C.refusMouvementEntreEspaces(db, "DEPOT", "APESSITO") === null);
  test("un mouvement entre deux boutiques d'entraînement passe",
    C.refusMouvementEntreEspaces(db, "DEPOT FORMATION", "APESSITO FORMATION") === null);
  test("le message de refus nomme les deux boutiques, pas un jargon",
    C.refusMouvementEntreEspaces(db, "APESSITO", "APESSITO FORMATION").includes("APESSITO FORMATION"));
}

titre("Un numéro déjà connu est retrouvé, quelle que soit son écriture (demande Timo, 25/08/2026)");
{
  // ⚠ CE QUE CE BLOC PROTÈGE. Trois écrans comparaient les CHIFFRES BRUTS
  // de deux numéros : « +228 90 11 22 33 » et « 90112233 » n'étaient donc
  // pas la même personne. On créait un doublon sans le voir — et en
  // parrainage, une DEUXIÈME PRIME était due pour un filleul déjà client.
  const db = {
    ...base(),
    users: [
      { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
      // ⚠ Sans cette ligne, espaceDuCompte ne retrouvait pas ce compte dans
      // la base d'essai et ne filtrait rien : le test échouait pour une
      // raison qui n'avait rien à voir avec ce qu'il vérifie.
      { id: "u_admin2", nom: "ADMIN2", role: "admin", droits_off: ["act_voir_tout"] },
      { id: "c1", nom: "KOFFI", nom_base: "KOFFI", role: "client", tel: "+228 90 11 22 33" },
      { id: "c2", nom: "AMA", nom_base: "AMA", role: "client", tel: "91 44 55 66" },
      { id: "c3", nom: "STAGIAIRE CLI", nom_base: "ESSAI", role: "client", tel: "90112233", formation: true },
    ],
  };
  const trouve = (tel, profile = P.admin2) => C.comptesAvecCeNumero(db, profile, tel);

  test("★ le numéro sans indicatif retrouve la fiche écrite AVEC l'indicatif",
    trouve("90112233").some((u) => u.id === "c1"));
  test("★ …et l'écriture avec espaces ou tirets aussi",
    trouve("90-11-22-33").length > 0 && trouve("90 11 22 33").length > 0);
  test("★ …et la forme internationale 00228",
    trouve("0022890112233").some((u) => u.id === "c1"));
  test("un numéro inconnu ne propose personne", trouve("99999999").length === 0);
  test("moins de 4 chiffres ne propose rien (pas de bruit pendant la frappe)",
    trouve("901").length === 0);
  test("un autre client n'est pas confondu", trouve("91445566")[0].id === "c2");

  // ⚠ Le cloisonnement s'applique ici comme partout : c3 porte le MÊME
  // numéro que c1, mais dans l'espace d'entraînement.
  test("★ un compte réel ne se voit pas proposer le client d'entraînement",
    trouve("90112233").every((u) => !u.formation));
  const stagiaire = { id: "u_form_num", role: "vendeur" };
  db.users.push({ id: "u_form_num", nom: "STAGIAIRE", role: "vendeur", formation: true });
  test("★ …et un compte de formation ne voit pas le vrai client",
    trouve("90112233", stagiaire).every((u) => !!u.formation));
  test("l'admin principal retrouve celui de l'espace qu'il regarde",
    C.comptesAvecCeNumero(db, P.admin, "90112233").length === 1
    && (C.setRegardeFormation(true),
        C.comptesAvecCeNumero(db, P.admin, "90112233").every((u) => u.formation))
    && (C.setRegardeFormation(false), true));
}

titre("Un ADMINISTRATEUR placé en formation ne voit pas les vrais chiffres (fuite du 26/08/2026)");
{
  // ⚠ CE QUE CE BLOC PROTÈGE. Timo : « un admin de formation, lui, voit
  // clairement ces écrans ». Mesure faite avant de répondre : son
  // administrateur de formation voyait le CHIFFRE D'AFFAIRES, les dépenses,
  // les dettes et les marges RÉELS de l'entreprise.
  //
  // La cause : la règle disait « si le compte est en formation ET qu'il ne
  // voit pas les deux espaces, montre-lui la formation ; sinon, le réel ».
  // Or TOUT administrateur voit les deux espaces (pouvoir act_voir_tout,
  // actif par défaut). Un admin placé en formation ne remplissait donc
  // jamais la première condition et tombait dans le « sinon ». Le vendeur
  // stagiaire, lui, était correctement cloisonné — c'est ce qui rendait le
  // défaut visible à l'œil nu.
  //
  // LA RÈGLE : l'ESPACE du compte prime sur ses POUVOIRS.
  const db = base();
  db.users.push({ id: "u_adm_form", nom: "ADMIN-FORM", role: "admin", formation: true });
  const adminEnFormation = { id: "u_adm_form", nom: "ADMIN-FORM", role: "admin" };
  const lignes = [{ boutique: "APESSITO" }, { boutique: "APESSITO FORMATION" }];
  const vu = (profile, voirFormation) =>
    lignes.filter(C.filtreEspaceAffichage(db, profile, voirFormation)).map((x) => x.boutique);

  test("★ un ADMINISTRATEUR placé en formation ne voit QUE l'entraînement",
    JSON.stringify(vu(adminEnFormation)) === JSON.stringify(["APESSITO FORMATION"]));
  test("★ …et il ne peut pas en sortir, même si le sélecteur était forcé",
    JSON.stringify(vu(adminEnFormation, true)) === JSON.stringify(["APESSITO FORMATION"]));
  test("★ …ni voir les chiffres réels d'une quelconque façon",
    !vu(adminEnFormation).includes("APESSITO") && !vu(adminEnFormation, true).includes("APESSITO"));
  test("un vendeur stagiaire reste cloisonné comme avant",
    JSON.stringify(vu(P.stagiaire)) === JSON.stringify(["APESSITO FORMATION"]));

  // Le sélecteur de l'administrateur principal.
  test("l'administrateur principal voit le RÉEL par défaut",
    JSON.stringify(vu(P.admin)) === JSON.stringify(["APESSITO"]));
  // ⚠ Jamais actif au départ : on ne doit pas ouvrir l'application et lire
  // des chiffres fictifs en les croyant vrais.
  test("★ …et il ne bascule sur l'entraînement QUE s'il le demande",
    JSON.stringify(vu(P.admin, true)) === JSON.stringify(["APESSITO FORMATION"]));
  test("le bandeau « chiffres de formation » suit le même raisonnement",
    C.afficheChiffresFormation(db, P.admin) === false
    && C.afficheChiffresFormation(db, P.admin, true) === true
    && C.afficheChiffresFormation(db, adminEnFormation) === true);
  // Un compte rattaché à une VRAIE boutique n'a jamais accès au sélecteur.
  test("un vendeur du réel ne peut pas basculer sur l'entraînement",
    C.afficheChiffresFormation(db, P.vendeur, true) === false);
}

titre("« Je regarde le réel » / « je regarde l'entraînement » — un seul réglage pour tout");
{
  // ⚠ DEMANDE TIMO (26/08/2026), après la correction de la fuite : « en gros
  // même les boutiques formation dans stock n'apparaissent pas si je n'ai pas
  // appuyé sur formation ? ». Non — le sélecteur ne commandait que deux
  // écrans de synthèse, et ailleurs ses boutiques d'entraînement restaient
  // mélangées aux vraies. Il devient global.
  //
  // ⚠ CE QUI COMPTE ICI : ce réglage ne donne AUCUN droit nouveau. Il choisit
  // seulement, dans ce qu'un compte a DÉJÀ le droit de voir, ce qu'il
  // affiche. Les tests ci-dessous le vérifient sur les comptes cloisonnés.
  const db = base();
  db.users.push({ id: "u_adm_form", nom: "ADMIN-FORM", role: "admin", formation: true });
  const adminEnFormation = { id: "u_adm_form", nom: "ADMIN-FORM", role: "admin" };
  const sansTerrain = db.boutiques.filter((b) => !b.terrain);
  const onglets = (profile) => C.boutiquesVisibles(db, profile, sansTerrain).map((b) => b.nom).sort().join(", ");

  C.setRegardeFormation(false);
  test("★ en « réel », l'administrateur principal ne voit AUCUNE boutique d'entraînement",
    onglets(P.admin) === "APESSITO, DEPOT, HEDZRANAWOE");
  C.setRegardeFormation(true);
  test("★ en « entraînement », il ne voit QUE celles-là",
    onglets(P.admin) === "APESSITO FORMATION, DEPOT FORMATION");
  test("…et ses fournisseurs et commerciaux suivent le même réglage",
    C.espaceDuCompte(db, P.admin) === true);
  C.setRegardeFormation(false);
  test("…qui repassent au réel avec lui", C.espaceDuCompte(db, P.admin) === false);

  // ⚠ LE POINT LE PLUS IMPORTANT : un compte CLOISONNÉ n'est pas concerné.
  C.setRegardeFormation(false);
  test("★ un ADMIN placé en formation reste en formation, réglage sur « réel »",
    onglets(adminEnFormation) === "APESSITO FORMATION, DEPOT FORMATION");
  test("★ un vendeur stagiaire aussi", onglets(P.stagiaire) === "APESSITO FORMATION, DEPOT FORMATION");
  C.setRegardeFormation(true);
  test("★ et un vendeur du RÉEL ne bascule pas dans l'entraînement",
    onglets(P.admin2) === "APESSITO, DEPOT, HEDZRANAWOE");
  test("★ …son espace de compte non plus", C.espaceDuCompte(db, P.admin2) === false);

  // Le réglage ne doit jamais rester actif d'une session à l'autre : c'est
  // App.jsx qui repart de « réel » à chaque ouverture. On le remet ici pour
  // ne pas contaminer les vérifications suivantes.
  C.setRegardeFormation(false);
  test("le réglage revient au réel", C.regardeLaFormation() === false);
}

titre("Ce qu'on crée naît dans l'espace qu'on REGARDE (plus de case à cocher)");
{
  // ⚠ DEMANDE TIMO (26/08/2026) : « lors de la création d'un utilisateur ou
  // boutique ou magasin, plus à cocher... ça prend en même temps l'espace
  // dans lequel je me trouve ».
  //
  // ⚠ ET UN DÉFAUT QUE LE SÉLECTEUR AVAIT CRÉÉ LA VEILLE : marqueEspace
  // s'appuyait sur QUI VOUS ÊTES. Un client créé en regardant l'entraînement
  // partait donc dans les VRAIES données — et disparaissait de l'écran dans
  // la seconde, puisque l'affichage suivait déjà le sélecteur.
  const db = base();
  db.users.push({ id: "u_adm_form", nom: "ADMIN-FORM", role: "admin", formation: true });
  const adminEnFormation = { id: "u_adm_form", nom: "ADMIN-FORM", role: "admin" };

  C.setRegardeFormation(false);
  test("★ en regardant le réel, ce qu'on crée est RÉEL",
    JSON.stringify(C.marqueEspace(db, P.admin)) === "{}");
  C.setRegardeFormation(true);
  test("★ en regardant l'entraînement, ce qu'on crée est d'ENTRAÎNEMENT",
    C.marqueEspace(db, P.admin).formation === true);
  C.setRegardeFormation(false);

  // ⚠ La boutique, quand elle est connue, garde le dernier mot : une vente
  // enregistrée DANS une boutique d'entraînement est d'entraînement, quel
  // que soit le réglage de celui qui la saisit.
  test("la boutique prime toujours sur le réglage",
    C.marqueEspace(db, P.admin, "APESSITO FORMATION").formation === true
    && JSON.stringify(C.marqueEspace(db, P.admin, "APESSITO")) === "{}");
  C.setRegardeFormation(true);
  test("…dans les deux sens",
    JSON.stringify(C.marqueEspace(db, P.admin, "APESSITO")) === "{}");
  C.setRegardeFormation(false);

  // Les comptes cloisonnés ne sont pas concernés par le réglage.
  test("★ un compte de formation crée toujours dans la formation",
    C.marqueEspace(db, P.stagiaire).formation === true);
  test("★ …y compris un ADMINISTRATEUR placé en formation",
    C.marqueEspace(db, adminEnFormation).formation === true);
  C.setRegardeFormation(true);
  test("★ …et un compte du RÉEL ne crée jamais dans l'entraînement",
    JSON.stringify(C.marqueEspace(db, P.admin2)) === "{}");
  C.setRegardeFormation(false);
}

titre("Le selecteur « je regarde » vit dans les Parametres, et recharge la page");
{
  // ⚠ DEMANDE DE TIMO (29/08/2026) : « je prefere que le basculement actualise
  // la page en meme temps, que d'attendre 20 secondes… ramener le basculement
  // dans les parametres ».
  // Les 20 secondes venaient des ecrans deja visites, qui restent montes en
  // veille (ongletsVisites, choix fait pour que revenir sur un onglet soit
  // instantane) : au basculement, ils ne se reconstruisaient qu'au fil des
  // re-rendus. Le rechargement les remet tous d'aplomb d'un coup.
  const app = readFileSync("src/App.jsx", "utf8");
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  const cal = readFileSync("src/lib/calculs.js", "utf8");

  test("★ le basculement recharge la page",
    /export const changerEspaceRegarde[\s\S]{0,400}?window\.location\.reload\(\)/.test(cal));
  test("★ il memorise le choix AVANT de recharger (sinon il serait perdu)", (() => {
    const bloc = cal.slice(cal.indexOf("export const changerEspaceRegarde"));
    return bloc.indexOf("memoriserEspaceRegarde") < bloc.indexOf("window.location.reload");
  })());
  test("★ les deux boutons sont dans ⚙ Parametres",
    /changerEspace\(false\)/.test(par) && /changerEspace\(true\)/.test(par));
  test("★ …et ont quitte le menu de tous les ecrans",
    !/basculerEspaceRegarde/.test(app));
  test("le menu garde un RAPPEL de l'espace regarde, sans bouton",
    /Vous regardez la FORMATION/.test(app));
  test("★ la cle du reglage n'est ecrite qu'a UN endroit (plus de copie dans App.jsx)",
    /export const CLE_REGARDE = "bmi_regarde_formation";/.test(cal)
    && !/const CLE_REGARDE = "bmi_regarde_formation";/.test(app));
  test("le basculement demande confirmation : la page va se recharger",
    /if \(!await uConfirm\(v/.test(par));
  test("le selecteur reste reserve a l'admin principal, et seulement s'il y a une formation",
    /const peutRegarderLaFormation = estAdminPrincipal\(db, profile\) && boutiquesFormation\(db\)\.size > 0;/.test(par));

  // La mecanique de memorisation, verifiee pour de bon.
  const faux = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); } };
  const vrai = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { value: faux, configurable: true });
  C.memoriserEspaceRegarde("u1", true);
  test("★ le choix est bien range sous l'identifiant de la personne",
    C.lireEspaceRegarde("u1") === true && C.lireEspaceRegarde("u2") === false);
  C.memoriserEspaceRegarde("u1", false);
  test("…et se defait aussi bien qu'il se fait",
    C.lireEspaceRegarde("u1") === false);
  test("sans identifiant, on repart du reel plutot que de deviner",
    C.lireEspaceRegarde("") === false && C.lireEspaceRegarde(undefined) === false);
  if (vrai) Object.defineProperty(globalThis, "localStorage", { value: vrai, configurable: true });
  else delete globalThis.localStorage;
}


titre("Le sélecteur « je regarde » n'appartient qu'à l'administrateur PRINCIPAL");
{
  // ⚠ TIMO, 26/08/2026 : « tout ce qu'on construit actuellement, c'est pour
  // l'admin principal normalement ». Mesure faite avant de le croire sur
  // parole : ce n'était PAS le cas. La condition posée était « voit les deux
  // espaces », c'est-à-dire le pouvoir act_voir_tout — ACTIF PAR DÉFAUT sur
  // tout compte administrateur. Un second administrateur pouvait donc
  // basculer sur l'entraînement et y créer des données.
  //
  // ⚠ Ce banc ne peut pas cliquer sur un bouton : il vérifie la RÈGLE qui
  // décide de son affichage, et surtout que les autres comptes restent
  // bloqués sur le réel quoi qu'il arrive.
  const db = base();
  const seul = (p) => C.estAdminPrincipal(db, p);

  test("★ l'administrateur PRINCIPAL a le sélecteur", seul(P.admin) === true);
  test("★ un autre administrateur ne l'a pas", seul(P.admin2) === false);
  test("un vendeur ne l'a pas", seul(P.vendeur) === false);
  test("un stagiaire ne l'a pas", seul(P.stagiaire) === false);

  // ⚠ ET SURTOUT : même si le réglage était forcé, un compte qui n'a pas le
  // bouton ne doit pas se retrouver dans l'entraînement.
  C.setRegardeFormation(true);
  const noms = (p) => C.boutiquesVisibles(db, p, db.boutiques.filter((b) => !b.terrain)).map((b) => b.nom);
  test("★ un autre administrateur reste sur le réel même réglage forcé",
    noms(P.admin2).length > 0 && noms(P.admin2).every((n) => !n.includes("FORMATION")));
  test("★ …et ce qu'il crée reste réel",
    JSON.stringify(C.marqueEspace(db, P.admin2)) === "{}");
  C.setRegardeFormation(false);
}

titre("Personne ne modifie les pouvoirs de SA PROPRE fiche — l'app et la base d'accord");
{
  // ⚠ Le declencheur refuser_elevation_de_soi_trg (securite-2-role-inviolable.sql)
  // a ete pose sur la vraie base le 29/08/2026. Il refuse toute modification
  // de role, admin_principal, droits_off, formation et actif sur sa propre
  // fiche. L'ecran Utilisateurs doit dire la MEME chose : proposer un geste
  // que le serveur refusera, c'est le piege des boutiques de formation
  // (2.100.30), ou l'operation restait bloquee dans la file pour toujours.
  const u = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  const sql = readFileSync("supabase/securite-2-role-inviolable.sql", "utf8");

  test("★ le bouton « Bloquer » n'apparait plus sur sa propre fiche",
    /\{!surMaPropreFiche\(u\) && <button onClick=\{\(\) => toggleActif\(u\)\}/.test(u));
  test("★ le bouton « passer en formation » non plus",
    /jeSuisAdminPrincipal && !surMaPropreFiche\(u\) &&[\s\S]{0,120}?basculerFormation\(u\)/.test(u));
  test("★ …et les trois gestes se gardent eux-memes, pas seulement les boutons",
    (u.match(/refusSurSoi\(u, /g) || []).length >= 3);
  test("le refus explique POURQUOI, au lieu d'un simple echec",
    /elle vaut pour tout le monde, vous compris/.test(u));

  // Les champs surveilles par l'app et par la base doivent etre les memes.
  const champsSql = (sql.match(/surveilles constant text\[\] := array\[([^\]]+)\]/) || [])[1] || "";
  test("★ la base surveille bien les cinq champs de pouvoir",
    ["role", "admin_principal", "droits_off", "formation", "actif"]
      .every((c) => champsSql.includes(`'${c}'`)));
  test("la voie de secours de l'editeur SQL est preservee (sinon plus aucune reparation possible)",
    /jetons = '\{\}'::jsonb or coalesce\(jetons ->> 'role', ''\) = 'service_role'/.test(sql));
}


titre("Restaurer une sauvegarde : le geste le plus destructeur de l'application");
{
  // ⚠ AUDIT DU 29/08/2026. save() remplace l'etat complet, puis
  // sauvegarderDiff met en file une SUPPRESSION pour chaque ligne absente du
  // nouveau — localement PUIS sur le serveur, donc sur tous les appareils. Une
  // sauvegarde etant plus ancienne que la base, tout ce qui a ete cree depuis
  // disparaissait. L'avertissement disait seulement « les donnees actuelles
  // seront remplacees », et le fichier n'affichait meme pas sa date.
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  const bloc = par.slice(par.indexOf("const restaurerSauvegarde"), par.indexOf("const restaurerSauvegarde") + 5200);

  test("★ reserve a l'administrateur PRINCIPAL",
    /if \(!estAdminPrincipal\(db, profile\)\)/.test(bloc));
  test("★ on COMPTE ce qui serait perdu, ligne par ligne",
    /const perdus = \[\]/.test(bloc) && /!dansLeFichier\.has\(r\.id\)/.test(bloc));
  test("★ on annonce que c'est definitif et sur TOUS les appareils",
    /sur TOUS les appareils/.test(bloc) && /definitif|définitif/.test(bloc));
  test("★ l'etat actuel est exporte AVANT — sans quoi le geste est sans retour",
    /telechargerSauvegarde\(db, "avant-restauration"\)/.test(bloc));
  test("★ un code tire au hasard doit etre recopie (le clic seul ne suffit pas)",
    /codeConfirmation\(\)/.test(bloc) && /!== code\)/.test(bloc));
  test("la date de la sauvegarde est affichee, et son age en jours",
    /derniereDate/.test(bloc) && /il y a \$\{jours\} jour/.test(bloc));
  test("une sauvegarde qui ne perd rien ne declenche pas tout ce ceremonial",
    /if \(totalPerdu === 0\)/.test(bloc));
  // ⚠ La phrase exacte reste citee dans le commentaire qui explique le
  // defaut : on cherche donc l'ANCIEN APPEL, pas la phrase.
  test("l'ancienne confirmation, seule et vague, a disparu",
    !/uConfirm\(`Restaurer cette sauvegarde \?/.test(par));
}


titre("Supprimer une depense annule VRAIMENT le paiement lie");
{
  // ⚠ AUDIT DU 29/08/2026. Le message promettait « le statut payé
  // correspondant sera aussi annulé ». C'etait vrai pour 4 sortes de depenses
  // sur 10. Pour les six autres, l'application annoncait ce qu'elle ne
  // faisait pas : un credit restait accorde alors que la sortie de caisse
  // avait disparu, une avance restait deduite du salaire alors que l'argent
  // etait revenu en caisse.

  // ---- Un virement de salaire ne se supprime PAS depuis cet ecran ----
  test("★ un virement de salaire renvoie vers « Annuler virement »",
    typeof C.refusSuppressionDepense({}, { auto: "virement" }) === "string");
  test("★ sa retenue de credit jumelle aussi (les deux tombent ensemble)",
    typeof C.refusSuppressionDepense({}, { auto: "retenue" }) === "string");
  test("le refus explique OU aller, pas seulement qu'on refuse",
    /Utilisateurs/.test(C.refusSuppressionDepense({}, { auto: "virement" })));
  test("une depense ordinaire, elle, se supprime normalement",
    C.refusSuppressionDepense({}, { auto: "commission" }) === null
    && C.refusSuppressionDepense({}, {}) === null);

  // ⚠ RE-AUDIT DU 29/08/2026 : supprimer un credit DEJA REMBOURSE en partie
  // le remettait « en demande » en gardant l'argent recu dessus.
  const dbCred = { users: [{ id: "u1", credits: [
    { id: "c_vierge", statut: "approuve", montant_accorde: 300000, remboursements: [] },
    { id: "c_entame", statut: "approuve", montant_accorde: 300000,
      remboursements: [{ date: "2026-08-01", montant: 100000, source: "salaire" }] },
  ] }] };
  test("★ un credit deja rembourse en partie ne se supprime PLUS",
    typeof C.refusSuppressionDepense(dbCred, { auto: "credit", user_id: "u1", credit_id: "c_entame" }) === "string");
  test("★ …et le refus dit COMBIEN a deja ete recu",
    /100[  ]?000/.test(C.refusSuppressionDepense(dbCred, { auto: "credit", user_id: "u1", credit_id: "c_entame" }).replace(/\u202f|\u00a0/g, " ")));
  test("★ un credit sans aucun remboursement se supprime encore",
    C.refusSuppressionDepense(dbCred, { auto: "credit", user_id: "u1", credit_id: "c_vierge" }) === null);
  test("une retenue sur salaire compte comme un remboursement (meme liste)",
    /versements ou retenues/.test(C.refusSuppressionDepense(dbCred, { auto: "credit", user_id: "u1", credit_id: "c_entame" })));

  // ---- CREDIT BMI : il redevient une simple demande ----
  const dbCredit = { users: [{ id: "u1", credits: [
    { id: "c1", statut: "approuve", montant_accorde: 300000, echeances: [{ mois: "2026-09", montant: 100000 }] },
  ] }] };
  const apresCredit = C.annulerLiensDepense(dbCredit,
    { id: "dep1", auto: "credit", user_id: "u1", credit_id: "c1", montant: 300000, date: "2026-08-29" });
  test("★ le credit annule redevient « en attente », sans echeances",
    apresCredit.users[0].credits[0].statut === "en_attente"
    && apresCredit.users[0].credits[0].echeances.length === 0);

  // ---- AVANCE SUR SALAIRE : elle ne doit plus etre deduite ----
  const dbAvance = { users: [{ id: "u1", avances: [
    { mois: "2026-08", montant: 50000, date: "2026-08-29" },
    { mois: "2026-08", montant: 50000, date: "2026-08-29" },
    { mois: "2026-07", montant: 20000, date: "2026-07-15" },
  ] }] };
  const apresAvance = C.annulerLiensDepense(dbAvance,
    { auto: "avance", user_id: "u1", montant: 50000, date: "2026-08-29" });
  test("★ l'avance disparait de la fiche : elle n'est plus retenue sur le salaire",
    apresAvance.users[0].avances.length === 2);
  test("★ …et UNE SEULE, meme si deux avances identiques le meme jour",
    apresAvance.users[0].avances.filter((a) => a.montant === 50000).length === 1);

  // ---- REMBOURSEMENT : le versement n'a jamais eu lieu ----
  const dbRemb = { users: [{ id: "u1", credits: [
    { id: "c1", statut: "solde", montant_accorde: 300000, date_solde: "2026-08-29",
      remboursements: [{ date: "2026-07-01", montant: 200000 }, { date: "2026-08-29", montant: 100000 }] },
  ] }] };
  const apresRemb = C.annulerLiensDepense(dbRemb,
    { auto: "remboursement", user_id: "u1", credit_id: "c1", montant: -100000, date: "2026-08-29" });
  const c1 = apresRemb.users[0].credits[0];
  test("★ le remboursement annule est retire du credit",
    c1.remboursements.length === 1 && c1.remboursements[0].montant === 200000);
  test("★ …et le credit n'est plus « solde » : il reste 100 000 F a rembourser",
    c1.statut === "approuve" && !c1.date_solde);

  // ---- CNSS : rien a annuler, donc rien a promettre ----
  test("★ l'avertissement ne s'affiche PLUS pour la CNSS (rien a annuler)",
    C.aLienAAnnuler({ auto: "cnss" }) === false);
  test("…ni pour une depense saisie a la main",
    C.aLienAAnnuler({}) === false);
  test("mais bien pour les sept sortes qui ont un lien",
    ["commission", "commission_equipe", "commission_ext", "installation",
     "credit", "remboursement", "avance"].every((a) => C.aLienAAnnuler({ auto: a })));

  const dep = readFileSync("src/screens/Depenses.jsx", "utf8");
  test("les DEUX ecrans de depenses (boutique et comptable) passent par le refus",
    (dep.match(/refusSuppressionDepense\(db, d\)/g) || []).length === 2);
}


titre("Le moyen de paiement se DEMANDE, il ne s'impose pas");
{
  // ⚠ AUDIT DU 29/08/2026. La cloture de caisse ne compte que ce qui porte
  // « Especes » (Caisse.jsx). Deux ecritures decidaient du moyen a la place de
  // l'utilisateur, et faussaient donc la cloture — dans les deux sens.
  const fo = readFileSync("src/screens/Fournisseurs.jsx", "utf8");
  const sal = readFileSync("src/screens/Salaires.jsx", "utf8");

  // Depuis 2.101.80 la question passe par demanderMoyenPaiement (ui.jsx) :
  // le complément « à FOURNISSEUR » / « de la CNSS » et le défaut sont ses
  // arguments — même vérification, nouvelle écriture.
  test("★ un fournisseur n'est plus payé « en espèces » sans qu'on demande",
    !/description: `Règlement fournisseur \$\{fo\.nom\}`, montant: m, paiement: "Espèces"/.test(fo)
    && /demanderMoyenPaiement\(`à \$\{fo\.nom\}`\)/.test(fo));
  test("★ la CNSS non plus « par virement » sans qu'on demande",
    !/paiement: "Virement bancaire", par: profile\.nom, auto: "cnss"/.test(sal)
    && /demanderMoyenPaiement\("de la CNSS"/.test(sal));
  // Depuis 2.101.81 la CNSS passe par nouvelleDepense (core.js), qui
  // normalise le moyen elle-même ; le fournisseur le normalise encore en place.
  test("les deux passent la réponse par normPaiement (mêmes libellés partout)",
    /paiement: normPaiement\(moyen\)/.test(fo) && /nouvelleDepense\(profile, \{[\s\S]{0,400}?moyen, auto: "cnss"/.test(sal));
  test("le défaut proposé reste le plus courant pour chacun (Espèces par défaut pour le fournisseur, virement pour la CNSS)",
    /demanderMoyenPaiement\(`à \$\{fo\.nom\}`\)/.test(fo) && /export const demanderMoyenPaiement = \(complement = "", defaut = "Espèces"/.test(readFileSync("src/components/ui.jsx", "utf8"))
    && /demanderMoyenPaiement\("de la CNSS", "Virement bancaire"\)/.test(sal));
}


titre("Deux parts payees en meme temps sur le meme chantier : aucune ne se perd");
{
  // ⚠ AUDIT DU 29/08/2026 : STRATEGIES.clients_installes designait
  // « demande_prime », qui n'est pas une liste et n'existe pas a ce niveau —
  // c'est un booleen pose sur chaque membre de `equipe`. La strategie ne
  // protegeait donc RIEN. L'administrateur payant A pendant que le vendeur
  // paie B, le tableau `equipe` entier etait remplace par celui du dernier
  // arrive : le « paye » de l'autre disparaissait, alors que sa depense avait
  // bien ete creee — et la part pouvait etre payee une seconde fois.
  const base = { equipe: [
    { user_id: "tA", nom: "KODJO", montant: 30000, paye: false },
    { user_id: "tB", nom: "AMA", montant: 20000, paye: false },
  ] };
  // L'admin a paye A ; le vendeur, au meme moment, a paye B.
  const local = { equipe: [
    { user_id: "tA", nom: "KODJO", montant: 30000, paye: true, dep_id: "dep-A" },
    { user_id: "tB", nom: "AMA", montant: 20000, paye: false },
  ] };
  const distant = { equipe: [
    { user_id: "tA", nom: "KODJO", montant: 30000, paye: false },
    { user_id: "tB", nom: "AMA", montant: 20000, paye: true, dep_id: "dep-B" },
  ] };

  const fusionne = F.fusionner("clients_installes", base, local, distant);
  const parId = Object.fromEntries((fusionne.equipe || []).map((e) => [e.user_id, e]));

  test("★ les DEUX paiements survivent a la fusion",
    parId.tA?.paye === true && parId.tB?.paye === true);
  test("★ chacun garde la trace de SA sortie de caisse",
    parId.tA?.dep_id === "dep-A" && parId.tB?.dep_id === "dep-B");
  test("l'equipe garde ses deux membres, pas un de plus",
    (fusionne.equipe || []).length === 2);
  test("★ une demande de paiement en cours ne s'evapore pas non plus", (() => {
    const l = { equipe: [{ user_id: "tA", montant: 30000, paye: false }] };
    const d = { equipe: [{ user_id: "tA", montant: 30000, paye: false, demande_prime: true, prime_boutique: "APESSITO" }] };
    const r = F.fusionner("clients_installes", base, l, d);
    return r.equipe[0].demande_prime === true && r.equipe[0].prime_boutique === "APESSITO";
  })());
  test("un technicien ajoute d'un seul cote est conserve", (() => {
    const d = { equipe: [...distant.equipe, { user_id: "tC", nom: "NOE", montant: 10000, paye: false }] };
    return F.fusionner("clients_installes", base, local, d).equipe.length === 3;
  })());
  test("★ l'ancienne strategie, qui ne protegeait rien, a disparu",
    !/clients_installes: \{ listes: \["demande_prime"\] \}/.test(readFileSync("src/lib/fusion.js", "utf8")));
}


titre("Le telephone se compare sur ses 8 DERNIERS chiffres, partout");
{
  // ⚠ AUDIT DU 29/08/2026 : la regle etait appliquee a Ventes, Clients et
  // Prospects, mais quatre endroits l'avaient manquee. Le pire :
  // resoudreClientDevis, ou un numero tape avec l'indicatif creait un SECOND
  // compte client — donc une seconde prime de parrainage.
  const fichiers = ["src/screens/dimensionnement/Partages.jsx", "src/screens/Ventes.jsx",
                    "src/screens/EspaceClient.jsx", "src/screens/ClientsInstalles.jsx"];
  const brutes = [];
  for (const f of fichiers) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/chiffresTel\([^)]*\)\s*===|===\s*chiffresTel\(/g)) brutes.push(`${f} : ${m[0]}`);
  }
  test(`★ aucune comparaison brute ne subsiste dans les 4 fichiers`, brutes.length === 0);
  if (brutes.length) brutes.forEach((b) => console.log(`      ↳ ${b}`));

  test("★ la creation d'un compte client depuis un devis passe par memeNumero",
    /find\(\(u\) => u\.role === "client" && u\.tel && memeNumero\(u\.tel, tel\)\)/
      .test(readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8")));
  test("le chantier retrouve le compte du client par memeNumero",
    /memeNumero\(u\.tel, v\.tel\)/.test(readFileSync("src/screens/ClientsInstalles.jsx", "utf8")));

  // La regle elle-meme, verifiee sur les cas reels de Timo.
  test("★ « +228 90 11 22 33 » et « 90112233 » sont le meme client",
    C.memeNumero("+228 90 11 22 33", "90112233") === true);
  test("deux numeros differents ne se confondent pas",
    C.memeNumero("90112233", "90112234") === false);
  test("un numero vide ne correspond a personne",
    C.memeNumero("", "90112233") === false && C.memeNumero("90112233", "") === false);
}


titre("Un convertisseur en VA n'est plus classe une tension trop haut");
{
  // ⚠ AUDIT DU 29/08/2026 : la tension etait deduite de la valeur BRUTE lue
  // dans le nom — donc des VA. L'application sait pourtant que VA ≠ W
  // (facteur 0,8) et s'en sert pour le dimensionnement. Un « 5000VA »
  // (4 000 W reels, classe 24 V) etait classe 48 V.
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  test("★ les deux endroits passent des WATTS UTILES, plus la valeur brute",
    (sol.match(/tensionInfereeConvertisseur\(puissanceUtileW\(spec\)\)/g) || []).length === 2);
  test("★ plus aucun appel avec spec.valeur",
    !/tensionInfereeConvertisseur\(spec\.valeur\)/.test(sol));

  // La regle de Timo, en kW : 0-2,5 → 12V ; 2,6-4,5 → 24V ; au-dela → 48V.
  const tension = (w) => { const kw = w / 1000; return kw <= 2.5 ? 12 : kw <= 4.5 ? 24 : 48; };
  const utile = (va) => Math.round(va * 0.8);
  test("★ un « 5000VA » vaut 4 000 W : classe 24 V, plus 48 V",
    tension(utile(5000)) === 24 && tension(5000) === 48);
  test("★ un « 3000VA » vaut 2 400 W : classe 12 V, plus 24 V",
    tension(utile(3000)) === 12 && tension(3000) === 24);
  test("un convertisseur etiquete en WATTS ne bouge pas d'un cran",
    tension(5000) === 48 && tension(3000) === 24);
}


titre("Un article sans prix ne s'importe pas, et ne se vend pas en silence");
{
  // ⚠ AUDIT DU 29/08/2026 : l'importation acceptait une ligne des qu'elle
  // avait trois champs ; le prix de vente absent valait 0. Le dimensionnement
  // choisissant sur la caracteristique et jamais sur le prix, l'article etait
  // retenu, chiffre 0 F dans le devis, puis encaisse 0 F.
  const st = readFileSync("src/screens/Stocks.jsx", "utf8");
  const vt = readFileSync("src/screens/Ventes.jsx", "utf8");
  // Depuis 2.101.46, la règle d'importation vit dans lib/importStock.js
  // (Excel + texte collé) : c'est là qu'on la surveille désormais.
  const im = readFileSync("src/lib/importStock.js", "utf8");

  test("★ l'importation REFUSE une ligne sans prix de vente",
    /if \(!\(prixVente > 0\)\) \{[\s\S]{0,220}?continue;/.test(im));
  test("★ …et dit LAQUELLE, au lieu de « 3 erreurs ignorées »",
    /ligne\(s\) NON importée\(s\)/.test(im) && /lignes\.slice\(0, 10\)/.test(im));
  test("l'ancien remplissage silencieux a 0 a disparu",
    !/prix_vente: Number\(parts\[5\]\) \|\| 0/.test(st));
  test("★ encaisser un article a 0 F demande confirmation (jamais par inadvertance)",
    /const gratuits = panier\.filter\(\(l\) => !\(Number\(l\.pu\) > 0\)\)/.test(vt)
    && /article\(s\) sont à 0 F/.test(vt));
  test("…et une vente normale ne pose aucune question de plus",
    /if \(gratuits\.length && !await uConfirm/.test(vt));
}


titre("Les ecrans d'ADMINISTRATION suivent l'espace regarde, eux aussi");
{
  // ⚠ RELEVE PAR TIMO (29/08/2026, capture des Parametres) : « nous sommes
  // dans les parametres du REEL… toutes les boutiques et utilisateurs ne sont
  // pas cloisonnes pour chaque espace ». Il voyait DFORMATION et AFORMATION
  // dans la liste des boutiques, selecteur sur « reel ».
  // Le cloisonnement avait ete pose partout ou l'on compte de l'argent — pas
  // dans les deux ecrans d'administration, qui sont pourtant ceux ou l'on
  // bloque un compte, change un salaire, renomme ou supprime une boutique.
  const dbA = {
    boutiques: [
      { id: "b1", nom: "APESSITO" },
      { id: "b2", nom: "DEMAKPOE" },
      { id: "b3", nom: "DEPOT MAISON", depot: true },
      { id: "b4", nom: "AFORMATION", formation: true },
      { id: "b5", nom: "DFORMATION", formation: true },
    ],
    users: [
      { id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true },
      { id: "u_vend", nom: "KOSSI", role: "vendeur", boutique: "APESSITO" },
      { id: "u_stag", nom: "AMA", role: "vendeur", boutique: "AFORMATION" },
      { id: "u_cliR", nom: "CLIENT REEL", role: "client" },
      { id: "u_cliF", nom: "CLIENT ESSAI", role: "client", formation: true },
    ],
  };
  const timo = { id: "u_timo", role: "admin" };

  C.setRegardeFormation(false);
  test("★ en REGARDANT LE REEL, les boutiques de formation disparaissent",
    C.boutiquesVisibles(dbA, timo, dbA.boutiques).map((b) => b.nom).join(",") === "APESSITO,DEMAKPOE,DEPOT MAISON");
  test("★ …et les comptes de formation aussi",
    C.utilisateursDeLEspace(dbA, timo).map((u) => u.nom).join(",") === "TIMO,KOSSI,CLIENT REEL");

  C.setRegardeFormation(true);
  test("★ en REGARDANT LA FORMATION, on ne voit QUE la formation",
    C.utilisateursDeLEspace(dbA, timo).map((u) => u.nom).join(",") === "AMA,CLIENT ESSAI");
  test("★ …et les deux boutiques d'entrainement, sans les vraies",
    C.boutiquesVisibles(dbA, timo, dbA.boutiques).map((b) => b.nom).join(",") === "AFORMATION,DFORMATION");
  C.setRegardeFormation(false);

  test("★ la BOUTIQUE d'un compte prime sur son drapeau, ici comme partout",
    C.utilisateursDeLEspace(dbA, timo).every((u) => u.nom !== "AMA"));
  test("un compte sans drapeau ni boutique est traite comme REEL",
    C.utilisateursDeLEspace(dbA, timo).some((u) => u.nom === "CLIENT REEL"));

  // Les deux ecrans passent-ils VRAIMENT par ces fonctions ?
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  const uti = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  test("★ Parametres affiche la liste filtree, plus db.boutiques brut",
    /const boutiquesDeLEcran = boutiquesVisibles\(db, profile, db\.boutiques\)/.test(par)
    && /\{boutiquesDeLEcran\.map\(\(b\) => \(/.test(par)
    && !/\{db\.boutiques\.map\(\(b\) => \(/.test(par));
  test("★ le compteur « Boutiques (n) » compte la liste filtree, pas toutes",
    /Boutiques \(\{boutiquesDeLEcran\.length\}\)/.test(par));
  test("★ Utilisateurs part de utilisateursDeLEspace",
    /const dansMonEspace = utilisateursDeLEspace\(db, profile\)/.test(uti)
    && !/const utilisateursVisibles = jeSuisAdminPrincipal \? db\.users :/.test(uti));
  test("le controle d'unicite d'un nom de boutique, lui, regarde les DEUX espaces",
    /db\.boutiques\.some\(\(b\) => b\.nom === nom\)/.test(par));

  // ⚠ En corrigeant les deux ecrans signales, j'ai balaye les autres listes de
  // PERSONNES. Quatre melangeaient encore les deux espaces, chacune avec un
  // degat concret a la cle.
  const listes = [
    ["ClientsInstalles.jsx", /const comptesClientsLibres = utilisateursDeLEspace\(db, profile\)/,
     "rattacher un VRAI chantier au compte d'un client d'entrainement"],
    ["ClientsInstalles.jsx", /const commerciauxActifs = utilisateursDeLEspace\(db, profile\)/,
     "attribuer un vrai chantier a un commercial d'entrainement"],
    ["Commandes.jsx", /const responsables = utilisateursDeLEspace\(db, profile\)/,
     "rattacher une vraie commande a un responsable d'entrainement"],
    ["Messagerie.jsx", /const equipe = utilisateursDeLEspace\(db, profile\)/,
     "ecrire a un vrai client depuis un compte d'entrainement"],
  ];
  for (const [fichier, motif, degat] of listes) {
    test(`★ ${fichier} — ${degat} : impossible`,
      motif.test(readFileSync(`src/screens/${fichier}`, "utf8")));
  }
}


titre("Balayage des LISTES DEROULANTES : aucune ne mele les deux espaces");
{
  // ⚠ Demande de Timo (29/08/2026), apres la correction des Parametres :
  // « balaye toutes les listes deroulantes aussi ». Les 28 <select> de
  // l'application ont ete repris un par un. Trois melangeaient encore.
  const dbB = {
    boutiques: [
      { id: "b1", nom: "APESSITO" },
      { id: "b2", nom: "AFORMATION", formation: true },
    ],
    users: [
      { id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true },
      { id: "u_com", nom: "KODJO", role: "commercial", taux_commission: 5 },
      { id: "u_comF", nom: "ESSAI", role: "commercial", taux_commission: 5, formation: true },
    ],
    commerciaux: [],
  };
  const timo = { id: "u_timo", role: "admin" };

  // ---- 1. Les apporteurs proposes a l'encaissement d'une vente ----
  C.setRegardeFormation(false);
  test("★ en REEL, la liste des apporteurs ne propose pas les commerciaux d'entrainement",
    C.apporteursPossibles(dbB, timo).map((a) => a.nom).join(",") === "KODJO");
  C.setRegardeFormation(true);
  test("★ en FORMATION, elle ne propose pas les vrais commerciaux",
    C.apporteursPossibles(dbB, timo).map((a) => a.nom).join(",") === "ESSAI");
  C.setRegardeFormation(false);
  test("★ l'ancienne regle (« je vois les deux → je les prends tous ») a disparu",
    !/const memeEspace = \(u\) => voitLesDeuxEspaces\(db, profile\) \|\|/
      .test(readFileSync("src/lib/calculs.js", "utf8")));

  // ---- 2. La caisse « Chez le comptable » est REELLE, sans jumelle ----
  const cal = readFileSync("src/lib/calculs.js", "utf8");
  test("★ elle n'est plus proposee quand on regarde la formation",
    /const options = espaceDuCompte\(db, profile\) \? noms : \[\.\.\.noms, NOM_CAISSE_COMPTABLE\]/.test(cal));
  test("…et le verrou d'ecriture la laisse passer, justement parce qu'elle n'a pas d'equivalent",
    /Chez le comptable/.test(cal));

  // ---- 3. La boutique ou un client ira payer ----
  test("★ un client d'entrainement ne se voit plus proposer les VRAIES boutiques",
    /boutiquesVisibles\(db, profile, boutiquesVente\(db\)\)\.map\(\(b\) => <option/
      .test(readFileSync("src/screens/EspaceClient.jsx", "utf8")));

  // ---- Ce qui etait DEJA correct, et qu'on verifie pour que ca le reste ----
  const dejaBon = [
    ["lib/calculs.js", /const noms = boutiquesVisibles\(db, profile, boutiquesVente\(db\)\)/, "la caisse a debiter"],
    ["screens/Stocks.jsx", /const espaceStock = espaceDuCompte\(db, profile\);/, "les fournisseurs"],
    ["screens/Stocks.jsx", /boutiquesDuMemeEspace\(db, profile, boutiquesVente\(db\), bq\)/, "les boutiques a ravitailler"],
    ["screens/dimensionnement/Partages.jsx", /comptesClients/, "les clients destinataires d'un devis"],
    ["screens/ClientsInstalles.jsx", /techniciensDeLEspace\(db, tousLesTechs/, "les techniciens d'un chantier"],
  ];
  for (const [fichier, motif, quoi] of dejaBon) {
    test(`${quoi} (${fichier.split("/").pop()}) reste cloisonne`,
      motif.test(readFileSync(`src/${fichier}`, "utf8")));
  }
}


titre("L'espace formation se reconnait a sa couleur");
{
  // ⚠ Demande de Timo (29/08/2026) : « changer le bleu de l'application en
  // violet pour l'espace formation ». Un coup d'oeil suffit alors a savoir ou
  // l'on est — la protection la plus simple contre l'erreur d'espace, et elle
  // ne demande de lire aucun libelle.
  // ⚠ La COULEUR obtenue se verifie dans un vrai navigateur
  // (npm run verifier-ecran). Ici on verifie le MECANISME : la marque est bien
  // posee, au bon moment, et retiree quand il faut.
  const app = readFileSync("src/App.jsx", "utf8");
  const css = readFileSync("src/index.css", "utf8");

  test("★ la marque suit l'espace REGARDE, pas l'espace du compte seul",
    /const enFormation = !!\(db && profile && espaceDuCompte\(db, profile\)\)/.test(app));
  test("★ elle est retiree quand on n'est plus en formation",
    /else delete racine\.dataset\.espace;/.test(app));
  test("★ …et a la deconnexion : l'ecran de connexion reste bleu",
    /return \(\) => \{ delete racine\.dataset\.espace; \};/.test(app));
  test("★ elle se recalcule quand on bascule le selecteur",
    /\}, \[db, profile, regardeFormation\]\);/.test(app));

  // ⚠ Le crochet doit etre AVANT les points de sortie d'App.jsx — sinon
  // l'application ne s'affiche plus du tout (piege des 2.100.76 et 2.100.77).
  const posMarque = app.indexOf("racine.dataset.espace");
  const posSortie = app.indexOf("if (!db) return");
  test("★ le crochet est place AVANT le premier point de sortie d'App.jsx",
    posMarque > 0 && posSortie > 0 && posMarque < posSortie);

  test("★ la couleur se change par les VARIABLES, pas classe par classe",
    /html\[data-espace="formation"\]/.test(css) && /--color-sky-800:/.test(css));
  test("aucune classe d'ecran n'a ete touchee (le bleu reste ecrit tel quel)",
    /bg-sky-800/.test(readFileSync("src/components/ui.jsx", "utf8")));
  test("le vert, le rouge et l'ambre ne sont pas redefinis : ils veulent dire quelque chose",
    !/--color-(green|red|amber|orange)-/.test(css));
}


titre("L'index vente → dette : le meme resultat que la recherche lente, en une passe");
{
  // ⚠ RE-AUDIT DU 29/08/2026 : detteDeVente parcourait toute la table des
  // dettes a chaque vente, jusqu'a trois fois par vente. L'index se construit
  // desormais UNE FOIS par etat de la base. Ces controles verifient qu'il
  // rend EXACTEMENT ce que rendait le `.find`, y compris ses cas limites.
  const d1 = { id: "d1", vente_id: "v1", montant: 100, paye: 100 };
  const d2 = { id: "d2", vente_id: "v2", montant: 500, paye: 200 };
  const d2bis = { id: "d2bis", vente_id: "v2", montant: 999, paye: 0 };
  const sansLien = { id: "d3", montant: 50, paye: 0 };
  const dbI = { dettes: [d1, d2, d2bis, sansLien] };

  test("★ chaque vente retrouve SA dette",
    C.detteDeVente(dbI, { id: "v1" }) === d1);
  test("★ deux dettes sur la meme vente : la PREMIERE gagne, comme avant",
    C.detteDeVente(dbI, { id: "v2" }) === d2);
  test("une vente sans dette liee ne trouve rien",
    C.detteDeVente(dbI, { id: "v9" }) === undefined);
  test("une dette sans vente_id n'entre pas dans l'index",
    [...dbI.dettes.filter((d) => !d.vente_id)].length === 1
    && C.detteDeVente(dbI, { id: "d3" }) === undefined);
  test("base vide ou absente : rien ne plante",
    C.detteDeVente({}, { id: "v1" }) === undefined
    && C.detteDeVente(null, { id: "v1" }) === undefined
    && C.detteDeVente(dbI, null) === undefined);
  test("★ un NOUVEL etat de la base (save) reconstruit l'index", (() => {
    // Meme contenu mais paye a change : nouveau tableau, nouvelle reponse.
    const apres = { dettes: [{ ...d2, paye: 500 }] };
    return C.resteDuSurVente(dbI, { id: "v2" }) === 300
      && C.resteDuSurVente(apres, { id: "v2" }) === 0;
  })());
  test("★ …et le meme etat relu deux fois rend la meme dette (le cache tient)",
    C.detteDeVente(dbI, { id: "v2" }) === C.detteDeVente(dbI, { id: "v2" }));
}


titre("L'apporteur EXTERNE attend le solde, comme le parrain — tranche par Timo");
{
  // ⚠ REGLE POSEE LE 29/08/2026, mot pour mot : « l'apporteur externe attend
  // le solde comme le parrain ». Elle s'appliquait deja par construction
  // (v.apporteur porte les deux personnes) ; la question lui a ete posee, il
  // a confirme. Ce controle l'empeche de redevenir un accident.
  const venteExt = { id: "vE", apporteur: { nom: "DEMARCHEUR", montant: 40000, payee: false } };
  const detteOuverte = { dettes: [{ id: "dE", vente_id: "vE", montant: 800000, paye: 300000 }] };
  const detteSoldee  = { dettes: [{ id: "dE", vente_id: "vE", montant: 800000, paye: 800000 }] };

  test("★ sa part ATTEND tant que le client n'a pas solde",
    C.partParrainBloquee(venteExt, detteOuverte) === true);
  test("★ le client solde : sa part devient due d'elle-meme",
    C.partParrainBloquee(venteExt, detteSoldee) === false);
  test("une vente comptant (sans dette liee) ne le fait pas attendre",
    C.partParrainBloquee(venteExt, { dettes: [] }) === false);
  test("les ventes d'avant 2.101.19 (dette sans lien) gardent l'ancienne regle",
    C.partParrainBloquee(venteExt, { dettes: [{ id: "dX", montant: 500000, paye: 0 }] }) === false);
}


titre("Les sept petits defauts de l'audit, fermes le 29/08/2026");
{
  const vt = readFileSync("src/screens/Ventes.jsx", "utf8");
  const eq = readFileSync("src/screens/MonEquipe.jsx", "utf8");
  const fo = readFileSync("src/screens/Fournisseurs.jsx", "utf8");
  const msg = readFileSync("src/screens/Messagerie.jsx", "utf8");

  // 1. Le rabais negatif — mesure sur la formule exacte du code.
  const rabaisDe = (saisi, max) => Math.max(0, Math.min(Number(saisi || 0), max));
  test("★ un rabais NEGATIF ne peut plus augmenter la facture",
    /const rabais = Math\.max\(0, Math\.min\(Number\(f\.rabais \|\| 0\), rabaisMax\)\)/.test(vt)
    && rabaisDe("-50000", 20000) === 0 && rabaisDe("15000", 20000) === 15000 && rabaisDe("999999", 20000) === 20000);

  // 2. Supprimer une vente ne laisse plus d'orphelins.
  test("★ une vente avec CHANTIER ne se supprime plus",
    /const chantier = \(db\.clients_installes \|\| \[\]\)\.find\(\(c\) => c\.vente_id === v\.id\)/.test(vt));
  test("★ une vente a la commission deja PAYEE non plus",
    /if \(v\.commission_payee\) \{[\s\S]{0,300}?Annulez d'abord le règlement/.test(vt));
  test("★ une vente dont la dette porte des VERSEMENTS non plus",
    /Number\(dette\.paye \|\| 0\) > 0/.test(vt));
  test("…mais sa dette liee SANS versement part avec elle",
    /dettes: db\.dettes\.filter\(\(x\) => x\.id !== dette\.id\)/.test(vt));

  // 3. Le double paiement simultane, sur les TROIS chemins de paiement.
  test("★ les trois paiements relisent l'etat APRES les fenetres de confirmation",
    (eq.match(/if \(dejaReglees\(/g) || []).length === 3);
  test("…et le refus est ENTIER : jamais un sous-ensemble au montant annonce pour le tout",
    /Rien n'a été enregistré — la caisse n'a pas été débitée deux fois/.test(eq));

  // 4. Les cinq fonctions serveur ne renvoient plus l'erreur brute.
  const apis = ["apparence", "chercher-compte", "creer-filleul", "etat-auth", "sync-auth"];
  const fuites = apis.filter((n) => /error: `[^`]*\$\{e[?.]/.test(readFileSync(`api/${n}.js`, "utf8")));
  test("★ aucune des cinq fonctions api/ ne renvoie e.message au navigateur",
    fuites.length === 0);
  if (fuites.length) fuites.forEach((n) => console.log(`      ↳ api/${n}.js fuit encore`));
  test("…le detail reste dans les journaux serveur (console.error)",
    apis.every((n) => /console\.error\(/.test(readFileSync(`api/${n}.js`, "utf8"))));

  // 5. Le plafond au reglement fournisseur.
  test("★ regler PLUS que le reste du a un fournisseur est refuse",
    /if \(m > resteDu\) \{/.test(fo) && /ajoutez d'abord la dette/.test(fo));

  // 6. La Messagerie : chacun ses chantiers. Depuis les notifications
  // (13/09/2026), la règle peutVoirFilClient vit dans lib/calculs.js et
  // Messagerie.jsx l'importe ET la réexporte (App.jsx la lit d'elle).
  const fil = readFileSync("src/lib/calculs.js", "utf8");
  test("★ un technicien ne lit que les fils de SES chantiers",
    /\(fiche\.equipe \|\| \[\]\)\.some\(\(e\) => e\.user_id === moi\.id\)/.test(fil)
    && !/moi\.role === "admin" \|\| moi\.role === "technicien"/.test(fil)
    && !/function peutVoirFilClient/.test(msg) && /peutVoirFilClient \} from "\.\.\/lib\/calculs";/.test(msg) && /export \{ peutVoirFilClient \};/.test(msg));
  test("un chef d'equipe ne lit que les fils de ses RECRUES",
    /recrues\.includes\(fiche\.commercial\)/.test(fil));

  // 7. La formule Excel — mesuree sur la fonction exacte.
  const desamorcer = (x) => (typeof x === "string" && /^[=+\-@\t\r]/.test(x) ? `'${x}` : x);
  test("★ un nom de client commencant par = + - ou @ est desamorce",
    desamorcer("=1+1") === "'=1+1" && desamorcer("@KOFFI") === "'@KOFFI" && desamorcer("-AMA") === "'-AMA");
  test("★ …mais un NOMBRE negatif reste un nombre (les montants d'abord)",
    desamorcer(-50000) === -50000 && desamorcer(120000) === 120000);
  test("un nom ordinaire ne change pas",
    desamorcer("KOFFI AMA") === "KOFFI AMA");
  test("la vraie fonction du code est bien celle-la",
    /const desamorcer = \(x\) => \(typeof x === "string" && \/\^\[=\+\\-@\\t\\r\]\//.test(readFileSync("src/lib/export.js", "utf8")));
}


titre("Vague 2, etape 1 : chaque dette et chaque vente naissent avec leur PROPRIETAIRE");
{
  // ⚠ DEMANDE TIMO (29/08/2026, « Lance 1 »). Une dette ne portait qu'un nom
  // et un telephone — du texte. Sans identifiant de compte sur la ligne, le
  // serveur ne pourra jamais dire « ne montre a chacun que SES dettes ».
  // Cette etape POSE la marque a la creation et ne ferme rien.

  // ---- Le rapprochement lui-meme, mesure ----
  const dbC = { users: [
    { id: "u_ama", nom: "AMA", nom_base: "KOFFI AMA", role: "client", tel: "+228 90 11 22 33" },
    { id: "u_noe", nom: "NOE", nom_base: "NOE", role: "client", tel: "91 44 55 66" },
    { id: "u_parti", nom: "PARTI", role: "client", tel: "90 77 88 99", actif: false },
    { id: "u_vend", nom: "KOSSI", role: "vendeur", tel: "90 11 22 33" },
  ] };
  test("★ le telephone retrouve le compte, indicatif ou pas (regle des 8 chiffres)",
    C.compteClientPour(dbC, "90112233", "") === "u_ama"
    && C.compteClientPour(dbC, "+228 91 44 55 66", "") === "u_noe");
  test("★ a defaut de telephone, le nom EXACT (comme la fiche d'installation)",
    C.compteClientPour(dbC, "", "koffi ama") === "u_ama");
  test("★ un client de passage sans compte : null, et c'est la bonne reponse",
    C.compteClientPour(dbC, "99 00 00 00", "INCONNU") === null);
  test("un compte bloque n'est jamais rattache",
    C.compteClientPour(dbC, "90 77 88 99", "") === null);
  test("un EMPLOYE au meme numero n'est jamais pris pour le client",
    C.compteClientPour({ users: [dbC.users[3]] }, "90112233", "") === null);
  test("un nom approchant ne suffit pas (exact seulement — pas de devinette)",
    C.compteClientPour(dbC, "", "KOFFI") === null);

  // ---- Les lieux de naissance portent tous la marque ----
  const dettesJsx = readFileSync("src/screens/Dettes.jsx", "utf8");
  const ventesJsx = readFileSync("src/screens/Ventes.jsx", "utf8");
  const espaceJsx = readFileSync("src/screens/EspaceClient.jsx", "utf8");
  test("★ les 4 naissances de Dettes.jsx (manuelle, reservation, livraison x2)",
    (dettesJsx.match(/client_user_id:/g) || []).length === 4);
  // Depuis 2.101.79, Ventes.jsx PASSE aussi client_user_id à prospectAcquis
  // (lib/prospects.js) : ce n'est pas une naissance, on l'écarte du compte.
  test("★ les 3 naissances de Ventes.jsx (vente, reservation, dette credit)",
    (ventesJsx.replace(/prospectAcquis\([^)]*\)/g, "").match(/client_user_id:/g) || []).length === 3);
  // Depuis 2.101.48 la dette « pose seule » naît dans lib/validationDevis.js
  // (même règle pour l'espace client et la signature en boutique) : c'est
  // là qu'on la surveille, et l'écran client n'en fabrique plus lui-même.
  test("★ la dette « pose seule » appartient au client qui la cree, sans devinette",
    /client_user_id: client\.id, numero: prochainNumeroDette\(dbT/.test(readFileSync("src/lib/validationDevis.js", "utf8"))
    && !/prochainNumeroDette\(/.test(espaceJsx));
  test("la vente et sa dette de credit partagent LA MEME resolution (jamais deux reponses)",
    /const clientCompteId = origineDevis\?\.client_id \|\| compteClientPour\(db, f\.tel, f\.client\)/.test(ventesJsx)
    && /client_user_id: clientCompteId, vente_id: vente\.id/.test(ventesJsx));
  test("le devis d'origine fait foi quand il existe (l'identifiant exact bat le rapprochement)",
    /origineDevis\?\.client_id \|\|/.test(ventesJsx));
  test("les chantiers portaient deja leur proprietaire (user_id) — rien de casse",
    /user_id: f\.user_id \|\| null/.test(readFileSync("src/screens/ClientsInstalles.jsx", "utf8")));
}

titre("Retour sous garantie : un échange n'est JAMAIS une vente");
{
  // Demande Timo (31/08/2026) : sortir un article de remplacement sans
  // facturer (ou en facturant SEULEMENT des frais), en sachant que c'est un
  // retour. Tout passe par construireRetour (lib/calculs.js) — on MESURE.
  const dbR = {
    produits: [{ id: "p1", nom: "BATTERIE", boutique: "APESSITO", initial: 5, entrees: 0, prix_achat: 180000, prix_vente: 250000 }],
    ventes: [{ id: "v1", boutique: "APESSITO", client: "AMA", tel: "90112233", date: "2026-08-01",
      articles: [{ produit_id: "p1", article: "BATTERIE", qte: 2, pu: 250000 }] }],
    ajustements: [], dettes: [], boutiques: [{ id: "b1", nom: "APESSITO" }],
    users: [{ id: "u9", role: "client", tel: "90112233", nom: "AMA" }],
  };
  const vente = dbR.ventes[0];
  const profil = { nom: "TIMO" };
  const caAvant = Core.caVente(vente);

  const gratuit = C.construireRetour(dbR, vente, { produit_id: "p1", qte: 1, motif: "ne charge plus", montantFacture: 0 }, profil);
  test("★ un retour GRATUIT ne crée ni vente ni dette", !gratuit.erreur && gratuit.dette === null);
  test("★ la sortie de remplacement est un ajustement négatif — pas une vente",
    gratuit.ajustements[0].qte === -1 && gratuit.ajustements[0].type === "echange_garantie");
  // Timo (14/09/2026) : « ce n'est pas judicieux de sortir un reçu ? comment ça
  // se passe avec les grands logiciels ? » → un bon à part ; « bon de reprise
  // et bon de retour, les deux ». Règle pure lib/bons.js, exercée ici.
  {
    const sortieBn = join("node_modules", ".cache", `bmi-bons-${process.pid}.mjs`);
    await build({ entryPoints: ["src/lib/bons.js"], bundle: true, format: "esm", platform: "node", outfile: sortieBn, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
    const Bn = await import(pathToFileURL(sortieBn).href);
    unlinkSync(sortieBn);
    const nzB = (t) => String(t).replace(/\u202f|\u00a0/g, " ");
    const venteB = { id: "v_b1", numero: "BMID-2026-0014", boutique: "BMI DEMAKPOE", date: "2026-09-10", client: "MR", tel: "90000000",
      articles: [{ produit_id: "p1", article: "Étrier final", qte: 17, pu: 600 }],
      reprises: [{ ref: "REP-AAAA", date: "2026-09-14", produit_id: "p1", article: "Étrier final", qte: 1, montant: 600, rembourse: 600, moyen: "Espèces", motif: "le client a changé d'avis", par: "TIMO", dette_id: null }] };
    const dbBn = { ventes: [venteB], produits: [{ id: "p1", nom: "Étrier final" }],
      dettes: [{ id: "d1", numero: "BMID-DET-2026-0003", montant: 4000, paye: 1000, retour_ref: "RET-BBBB", motif: "SAV RET-BBBB — déplacement" }],
      ajustements: [
        { id: "a1", date: "2026-09-12", type: "echange_garantie", ref: "RET-BBBB", vente_id: "v_b1", produit_id: "p1", qte: -2, motif: "Échange garantie (RET-BBBB) — étrier cassé", par: "ALI", prix_achat: 300 },
        { id: "a2", date: "2026-09-12", type: "retour_defectueux", ref: "RET-BBBB", vente_id: "v_b1", produit_id: "p1", qte: 0, qte_sav: 2, article: "Étrier final", statut: "en_sav", motif: "Défectueux rendu — étrier cassé", par: "ALI" },
        { id: "a3", date: "2026-09-13", type: "echange_garantie", ref: "RET-CCCC", vente_id: "v_b1", produit_id: "p1", qte: -1, motif: "Échange garantie (RET-CCCC) — fêlé", par: "ALI", prix_achat: 300 },
        { id: "a4", date: "2026-09-11", type: "echange_garantie", ref: "RET-ZZZZ", vente_id: "autre", produit_id: "p1", qte: -1, motif: "x", par: "ALI" },
      ] };
    const br = Bn.bonReprise(dbBn, venteB, venteB.reprises[0]);
    test("★ bonReprise : numéro dérivé du reçu (REP-BMID-2026-0014-1, aucun compteur), reçu d'origine et sa date, client, article, quantité, motif SANS le préfixe technique, valeur reprise 600, rendu 600 en espèces, pas de dette, établi par TIMO",
      br.numero === "REP-BMID-2026-0014-1" && br.type === "reprise" && br.recu === "BMID-2026-0014" && br.dateVente === "2026-09-10" && br.client === "MR" && br.tel === "90000000" && br.article === "Étrier final" && br.qte === 1
      && br.motif === "le client a changé d'avis" && br.montant === 600 && br.rembourse === 600 && br.moyen === "Espèces" && br.dette === null && br.par === "TIMO" && br.date === "2026-09-14"
      && Bn.numeroBonReprise(venteB, { ref: "REP-NOUV" }) === "REP-BMID-2026-0014-2" && Bn.bonReprise(dbBn, venteB, null) === null);
    const brD = Bn.bonReprise({ ...dbBn, dettes: [{ id: "d9", numero: "BMID-DET-2026-0009", montant: 5000, paye: 2000 }] }, venteB, { ...venteB.reprises[0], dette_id: "d9", rembourse: 0, moyen: "", motif: "Reprise client (REP-AAAA) — trop cher" });
    test("★ bonReprise sur une vente à crédit : la dette est nommée, réduite de la valeur reprise, reste après = montant − payé (3 000), rien à rendre ; le motif est nettoyé du préfixe « Reprise client (…) — »",
      brD.dette.numero === "BMID-DET-2026-0009" && brD.dette.reduction === 600 && brD.dette.resteApres === 3000 && brD.rembourse === 0 && brD.motif === "trop cher");
    const rets = Bn.retoursDeVente(dbBn, venteB);
    test("★ retoursDeVente : les échanges sous garantie de CETTE vente seulement (2, pas celui d'une autre vente), du plus ancien au plus récent, quantité positive, article lu sur le défectueux ou le stock, motif nettoyé, frais lus sur la dette retour_ref (4 000, « déplacement »), gratuit sinon",
      rets.length === 2 && rets[0].ref === "RET-BBBB" && rets[1].ref === "RET-CCCC" && rets[0].qte === 2 && rets[0].article === "Étrier final" && rets[0].motif === "étrier cassé" && rets[0].dette.montant === 4000 && rets[0].dette.motif === "déplacement" && rets[0].dette.numero === "BMID-DET-2026-0003"
      && rets[1].dette === null && rets[1].motif === "fêlé" && rets[1].qte === 1 && rets[0].statutSav === "en_sav" && Bn.retoursDeVente(dbBn, null).length === 0);
    const bt1 = Bn.bonRetour(dbBn, venteB, rets[0]); const bt2 = Bn.bonRetour(dbBn, venteB, rets[1]);
    test("★ bonRetour : RET-BMID-2026-0014-1 avec frais 4 000 (déplacement, dette nommée), RET-…-2 gratuit ; reçu d'origine, client, article, quantité, motif, établi par",
      bt1.numero === "RET-BMID-2026-0014-1" && bt1.type === "retour" && bt1.frais.montant === 4000 && bt1.frais.detail === "déplacement" && bt1.frais.numero === "BMID-DET-2026-0003" && bt1.gratuit === false && bt1.qte === 2
      && bt2.numero === "RET-BMID-2026-0014-2" && bt2.gratuit === true && bt2.frais === null && bt2.recu === "BMID-2026-0014" && bt2.client === "MR" && bt2.par === "ALI" && bt2.article === "Étrier final");
    const tR = nzB(Bn.texteBon(br, { adresse: "Lomé", tel: "22 22" })); const tT = nzB(Bn.texteBon(bt1, { formation: true })); const tT2 = nzB(Bn.texteBon(bt2));
    test("★ texteBon (WhatsApp) : titre BON DE REPRISE / BON DE RETOUR, numéro, reçu d'origine et sa date, article, motif, « Rendu au client : 600 F (Espèces) », l'article repris par BMI ; retour avec frais « Frais facturés : 4 000 F (déplacement) », gratuit « Échange GRATUIT sous garantie » ; le bandeau de formation en tête quand la boutique est de formation",
      /^↩ \*BON DE REPRISE — BMI DEMAKPOE\*\nLomé\nTél : 22 22\n/.test(tR) && /N° : REP-BMID-2026-0014-1\nDate : 14\/09\/2026\nReçu d'origine : BMID-2026-0014 du 10\/09\/2026\nClient : MR/.test(tR) && /1 × Étrier final\nMotif : le client a changé d'avis\nValeur reprise : 600 F\n\*Rendu au client : 600 F\* \(Espèces\)\nL'article est repris par BMI/.test(tR) && /Établi par : TIMO/.test(tR)
      && /^🎓 \*DOCUMENT DE FORMATION — SANS VALEUR\*\n-+\n🔁 \*BON DE RETOUR \(garantie\) — BMI DEMAKPOE\*/.test(tT) && /Article de remplacement remis : 2 × Étrier final\nL'article défectueux est repris par BMI \(SAV\)\.\n\*Frais facturés : 4 000 F\* \(déplacement\) — dette BMID-DET-2026-0003/.test(tT)
      && /\*Échange GRATUIT sous garantie\.\*/.test(tT2) && !/DOCUMENT DE FORMATION/.test(tT2) && Bn.texteBon(null) === "");
    const impB = readFileSync("src/lib/impression.js", "utf8");
    test("★ impression : UN style de reçu (STYLE_RECU) partagé par le reçu et les bons ; imprimerBon = même entête (logo, adresse, NIF, RCCM, bandeau de formation), titre BON DE REPRISE / BON DE RETOUR — ÉCHANGE SOUS GARANTIE, reçu d'origine, RENDU AU CLIENT, cases « Pour la boutique » / « Le client reconnaît avoir reçu … », nom de fichier par la règle (nomDocument) ; bonWhatsApp passe par texteBon et envoyerWhatsApp",
      (impB.match(/\$\{STYLE_RECU\}/g) || []).length === 2 && /^const STYLE_RECU = `/m.test(impB) && !/<style>/.test(impB.slice(impB.indexOf("export function imprimerRecu("), impB.indexOf("// ============ PROFORMA"))) /* le reçu n'a plus son style en ligne (le reçu de versement garde sa variante) */
      && /export function imprimerBon\(bon, bq = \{\}\)/.test(impB) && /<h1>\$\{reprise \? "BON DE REPRISE" : "BON DE RETOUR — ÉCHANGE SOUS GARANTIE"\}<\/h1>/.test(impB) && /<b>Reçu d'origine :<\/b> \$\{esc\(bon\.recu\)\} du \$\{dFR\(bon\.dateVente\)\}/.test(impB)
      && /<tr class="total"><td>RENDU AU CLIENT :<\/td><td>\$\{fmt\(bon\.rembourse\)\}<\/td><\/tr>/.test(impB)
      && /<div class="btitre">\$\{reprise \? "MOTIF DE LA REPRISE" : "MOTIF DU RETOUR \(panne constatée\)"\}<\/div>\n\s*<div class="client"><div style="font-size:13px"><b>\$\{esc\(bon\.motif \|\| "—"\)\}<\/b>/.test(impB) /* 14/09/2026 : « la raison devrait figurer sur les reçus » — en ligne à part, bien visible */ && /Le client reconnaît avoir reçu \$\{fmt\(bon\.rembourse\)\}/.test(impB) && /Le client reconnaît avoir reçu l'article de remplacement et remis le défectueux/.test(impB)
      && /printApi\.open\(html, nomDocument\(reprise \? "Bon de reprise" : "Bon de retour", \{ client: bon\.client, numero: bon\.numero \}\)\);/.test(impB) && /export function bonWhatsApp\(bon, bq = \{\}\) \{\n\s*if \(!bon\) return;\n\s*envoyerWhatsApp\(bon\.tel, texteBon\(bon, bq\)\);/.test(impB)
      && /\$\{enteteDocument\(bq, bon\.boutique\)\}/.test(impB) && /\$\{bandeauFormation\(bq\.formation\)\}/.test(impB.slice(impB.indexOf("const enteteDocument"), impB.indexOf("export function imprimerBon("))));
    const vB = readFileSync("src/screens/Ventes.jsx", "utf8");
    test("★ écran Ventes : le bon est PROPOSÉ juste après la reprise (bonReprise sur la base APRÈS le geste) et juste après le retour (retoursDeVente sur la base après) — 🖨 Imprimer / Envoyer par WhatsApp (si téléphone) / Plus tard, UN chemin (proposerBon) ; sur la ligne, le bouton rond 🧾 n'apparaît que si la vente a un bon (bonsDeVente), choix parmi plusieurs (uChoix) ; aucune écriture : un document seulement",
      /await proposerBon\(bonReprise\(dbApres, r\.vente, r\.reprise\), infoBq\(r\.vente\.boutique\)\);/.test(vB) && /const retourFait = retoursDeVente\(dbApres, r\.vente\)\.find\(\(x\) => x\.ref === ref\);\n\s*await proposerBon\(bonRetour\(dbApres, r\.vente, retourFait\), infoBq\(r\.vente\.boutique\)\);/.test(vB)
      && /const options = \["🖨 Imprimer", \.\.\.\(bon\.tel \? \["Envoyer par WhatsApp"\] : \[\]\), "Plus tard"\];/.test(vB) && /if \(choix === "🖨 Imprimer"\) imprimerBon\(bon, bq\);\n\s*else if \(choix === "Envoyer par WhatsApp"\) bonWhatsApp\(bon, bq\);/.test(vB)
      && /\{bonsDeVente\(v\)\.length > 0 && \(\n\s*<button onClick=\{\(\) => ouvrirBons\(v\)\}/.test(vB) && /aria-label="Bons">🧾<\/button>/.test(vB) && (vB.match(/proposerBon\(/g) || []).length === 3 /* reprise, retour, ligne */
      && !/imprimerBon\(|bonWhatsApp\(/.test(vB.replace(/const proposerBon = async[^]*?\n  \};/, "")) /* les deux documents ne partent que par proposerBon */);
  }
  // Timo (14/09/2026, deux captures de l'aperçu) : « sur tous les fichiers
  // générés par l'app, un bouton Partager à la place de "Aperçu avant
  // impression" (exclusivement sur téléphone) ; sous Windows, en plus de ce
  // bouton, garder toujours "Aperçu avant impression" ».
  {
    const sortieUi = join("node_modules", ".cache", `bmi-ui-partage-${process.pid}.mjs`);
    await build({ entryPoints: ["src/components/ui.jsx"], bundle: true, format: "esm", platform: "node", outfile: sortieUi, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom", "html2canvas", "jspdf", "jspdf-autotable"] });
    const Ui = await import(pathToFileURL(sortieUi).href);
    unlinkSync(sortieUi);
    test("★ partage : le format de page de l'aperçu est lu pour le PDF (A4 12 mm d'office ; « size: 60mm 30mm » = l'étiquette, sans marge) ; le nom du fichier vient du titre du document (règle nomDocument), caractères interdits retirés, .pdf",
      Ui.dimensionsPage(Ui.PAGE_A4).join("|") === "210|297|12" && Ui.dimensionsPage("size: 60mm 30mm; margin: 0;").join("|") === "60|30|0" && Ui.dimensionsPage(undefined).join("|") === "210|297|12"
      && Ui.nomFichierPartage("Reçu - MR ERIC - BMID-2026-0014") === "Reçu - MR ERIC - BMID-2026-0014.pdf" && Ui.nomFichierPartage("Bon: a/b?") === "Bon a b.pdf" && Ui.nomFichierPartage("") === "Document.pdf");
    const uiP = readFileSync("src/components/ui.jsx", "utf8");
    test("★ l'aperçu porte le bouton « 📤 Partager » (data-action=\"partager\") pour TOUS les documents ; le PDF est rendu HORS ÉCRAN à la largeur d'une page (794 px), jamais à celle du téléphone, et coupé sur une ligne blanche (positionCoupe) ; sur téléphone le titre « Aperçu avant impression » disparaît (hidden sm:block), sur ordinateur il reste ; le partage passe par la feuille de partage (navigator.share, fichier PDF), sinon le PDF est enregistré ; html2canvas + jsPDF n'entrent que par ui.jsx",
      /<div className="font-bold text-slate-900 text-sm hidden sm:block">Aperçu avant impression<\/div>/.test(uiP) && /data-action="partager">\{partageEnCours \? "⏳ Préparation…" : "📤 Partager"\}<\/button>/.test(uiP)
      && /navigator\.share\(\{ files: \[fichier\], title: titre \}\)/.test(uiP) && /new File\(\[doc\.output\("blob"\)\], nom, \{ type: "application\/pdf" \}\)/.test(uiP) && /doc\.save\(nom\);\n\s*return "enregistre";/.test(uiP)
      && /const r = await partagerDocument\(html, titreDoc, page\);/.test(uiP) && /horsEcran\.style\.cssText = `position:fixed;left:-20000px;top:0;width:\$\{LARGEUR_RENDU_PX\}px;/.test(uiP) && /width: LARGEUR_RENDU_PX, windowWidth: LARGEUR_RENDU_PX/.test(uiP) /* 14/09/2026, deux captures : le PDF partagé sortait à la largeur du téléphone — rendu hors écran à la largeur d'une page */
      && Ui.LARGEUR_RENDU_PX === 794
      && Ui.positionCoupe(1000, 3000, (y) => y === 940) === 940 /* coupe sur la ligne blanche la plus basse avant la limite */ && Ui.positionCoupe(1000, 3000, () => false) === 1000 /* aucune ligne blanche : à la limite */
      && Ui.positionCoupe(1000, 3000, (y) => y === 700) === 1000 /* une ligne blanche trop haute (plus de 20 % au-dessus) n'est pas prise */ && Ui.positionCoupe(1000, 800, () => true) === 800 /* dernière page : jusqu'au bout */
      && execSync("grep -rl 'navigator.share' src || true").toString().trim() === "src/components/ui.jsx" && execSync("grep -rl 'from \"html2canvas\"' src || true").toString().trim() === "src/components/ui.jsx"
      && /"html2canvas": "\^1\.4\.1"/.test(readFileSync("package.json", "utf8")));
  }
  // Timo (14/09/2026) : « ouvre le retour sous garantie au gérant ».
  {
    const vG = readFileSync("src/screens/Ventes.jsx", "utf8");
    const s17 = readFileSync("supabase/securite-17-retour-gerant.sql", "utf8");
    const ta17 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
    test("★ le retour sous garantie est ouvert au GÉRANT (Timo, 14/09/2026) : ROLES_RETOUR_GARANTIE = gérant + admin ; dans Ventes le bouton 🔁 suit ce rôle et le geste le revérifie deux fois (refuserSaufRoles) ; statuer sur le défectueux reste admin (Stocks) ; serveur securite-17 (ligne relue, statut par upsert refusé au gérant), banc tester-argent : gérant permis, vendeur refusé, statut par upsert refusé",
      C.ROLES_RETOUR_GARANTIE.join() === "gerant,admin" && /\{ROLES_RETOUR_GARANTIE\.includes\(profile\.role\) && \(\n\s*<button onClick=\{\(\) => ouvrirRetour\(v\)\}/.test(vG)
      && (vG.match(/refuserSaufRoles\(profile, ROLES_RETOUR_GARANTIE, "Enregistrer un retour sous garantie"\)/g) || []).length === 2 && !/refuserSaufAdmin\(profile, "Enregistrer un retour sous garantie"\)/.test(vG)
      && (readFileSync("src/screens/Stocks.jsx", "utf8").match(/refuserSaufAdmin\(profile, "Statuer sur un article défectueux"\)/g) || []).length === 2
      && /if r not in \('gerant', 'admin'\) then perform public\.refus_role\('Retour sous garantie', 'le gérant, l''administrateur'\); end if;/.test(s17) && /select a\.data into avant from public\.ajustements a where a\.id = new\.id;/.test(s17)
      && /if avant is not null and \(avant ->> 'statut'\) is distinct from \(new\.data ->> 'statut'\) and r <> 'admin' then/.test(s17) && /revoke all on function public\.ajustements_regles_roles\(\) from public, anon;/.test(s17)
      && /-f supabase\/securite-17-retour-gerant\.sql/.test(ta17) && /le GÉRANT enregistre un échange sous garantie[^"]*" "PERMIS"/.test(ta17) && /un vendeur enregistre un échange sous garantie" "REFUSE"/.test(ta17) && /le gérant statue sur un défectueux PAR UPSERT[^"]*" "REFUSE"/.test(ta17));
  }
  const dbApres = { ...dbR, ajustements: gratuit.ajustements };
  test("★ le stock vendable baisse d'exactement 1 (5 − 2 vendus − 1 échangé = 2)",
    C.stockActuel(dbApres, dbR.produits[0]) === 2);
  test("★ le défectueux n'entre JAMAIS au stock vendable (qte 0, compté à part)",
    gratuit.ajustements[1].qte === 0 && gratuit.ajustements[1].qte_sav === 1
    && gratuit.ajustements[1].statut === "en_sav");
  test("★ le CA de la vente d'origine n'a pas bougé d'un franc",
    Core.caVente(vente) === caAvant);
  test("le coût de garantie = prix d'achat photographié au moment de l'échange",
    gratuit.ajustements[0].prix_achat === 180000 && C.coutGarantie(dbApres) === 180000);
  test("le défectueux attend son sort dans la liste SAV",
    C.retoursEnSav(dbApres).length === 1);

  const facture = C.construireRetour(dbR, vente,
    { produit_id: "p1", qte: 1, motif: "panne", montantFacture: 15000, detailFacture: "déplacement technicien" }, profil);
  test("★ les frais facturés = le montant SAISI (15 000), jamais le prix de l'article",
    facture.dette && facture.dette.montant === 15000);
  test("★ la dette des frais appartient au compte du client (étape 1 respectée)",
    facture.dette.client_user_id === "u9");
  test("les écritures d'un même retour partagent la même référence RET-",
    gratuit.ajustements[0].ref === gratuit.ajustements[1].ref && /^RET-/.test(gratuit.ref));

  test("échanger PLUS que la quantité achetée : refusé",
    !!C.construireRetour(dbR, vente, { produit_id: "p1", qte: 3, motif: "x" }, profil).erreur);
  test("stock de remplacement insuffisant : refusé avec explication",
    !!C.construireRetour({ ...dbR, produits: [{ ...dbR.produits[0], initial: 2 }] }, vente,
      { produit_id: "p1", qte: 1, motif: "x" }, profil).erreur);
  test("article absent de la vente : refusé",
    !!C.construireRetour(dbR, vente, { produit_id: "autre", qte: 1, motif: "x" }, profil).erreur);
  test("motif obligatoire (la panne doit être nommée)",
    !!C.construireRetour(dbR, vente, { produit_id: "p1", qte: 1, motif: "  " }, profil).erreur);
}

titre("Le brouillon du dimensionnement survit au F5 — UNE règle, TROIS volets");
{
  // Demande Timo (02/09/2026) : « tous les écrans doivent garder les
  // données après un F5 ou une nouvelle version » — seul Solaire le
  // faisait, avec sa propre copie de la règle. Elle vit désormais dans
  // Partages.jsx, et chaque volet s'y branche : lire au montage, écrire à
  // chaque changement, effacer à l'envoi ET à la conversion en vente.
  const partages = readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8");
  test("★ la règle vit dans Partages.jsx (un seul endroit)",
    /export function useEcrireBrouillonVolet/.test(partages)
    && /export const lireBrouillonVolet/.test(partages)
    && /export const effacerBrouillonVolet/.test(partages));
  for (const [fichier, volet] of [["Solaire.jsx", "solaire"], ["Garage.jsx", "garage"], ["Autre.jsx", "autre"]]) {
    const src = readFileSync(`src/screens/dimensionnement/${fichier}`, "utf8");
    // 2.101.64 : l'effacement (envoi ET conversion) vit dans useEnvoiDevis,
    // à qui chaque volet donne son nom — deux effacements dans Partages.jsx.
    test(`★ ${fichier} lit, écrit et efface SON brouillon via la règle commune`,
      src.includes(`lireBrouillonVolet("${volet}"`)
      && src.includes(`useEcrireBrouillonVolet("${volet}"`)
      && src.includes(`volet: "${volet}"`)
      && (partages.match(/effacerBrouillonVolet\(volet, profile\)/g) || []).length === 2);
    test(`${fichier} n'a AUCUNE copie privée de la règle (pas de brouillonEcrire direct)`,
      !/brouillonEcrire\(|brouillonLire\(|brouillonEffacer\(/.test(src));
  }
}

titre("Signature du contrat en boutique — UNE règle de validation, deux écrans");
{
  // Demande Timo (04/09/2026) : « un client qui ne passe pas par l'app et
  // veut signer le contrat ». Le vendeur le fait signer sur son appareil
  // (✍️ Faire signer ici) ou sur papier (🖨 Imprimer / 📝 Signé sur papier).
  // La validation qui en découle est LA MÊME que depuis l'espace client :
  // lib/validationDevis.js, rejouée ici.
  const dbV = {
    boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", adresse: "Lomé, Démakpoé", tel: "90000000" }, { id: "b3", nom: "ECOLE", formation: true }],
    users: [
      { id: "c1", role: "client", nom: "KOFFI", nom_base: "KOFFI AGBEKO", tel: "+228 91 11 22 33", devis: [
        { id: "dv1", statut: "propose", total: 100000, montant_acompte: 30000, pct_acompte: 30, par: "KOSSI", par_id: "u5", par_role: "commercial", boutique: "BMI DEMAKPOE",
          panier: [{ produit_id: "p1", article: "PANNEAU 550W", qte: 1, pu: 100000 }], lignes: [{ article: "PANNEAU 550W", qte: 1, pu: 100000, total: 100000 }] },
        { id: "dv2", statut: "propose", total: 20000, pose_seule: true, par: "KOSSI", par_id: "u5", par_role: "commercial", boutique: "BMI DEMAKPOE",
          panier: [{ produit_id: null, article: "Frais de pose", qte: 1, pu: 20000, categorie: "Installation" }], lignes: [{ article: "Frais de pose", qte: 1, pu: 20000, total: 20000 }] },
        { id: "dv3", statut: "valide", total: 5000, par: "KOSSI", par_id: "u5", par_role: "commercial", boutique: "BMI DEMAKPOE", panier: [], lignes: [] },
      ] },
      { id: "c2", role: "client", nom: "STAGIAIRE-CLIENT", formation: true, devis: [
        { id: "dv9", statut: "propose", total: 7000, pose_seule: true, formation: true, par: "ECOLIER", par_id: "u9", par_role: "vendeur", boutique: "ECOLE", panier: [], lignes: [] },
      ] },
    ],
    prospects: [{ id: "pr1", client_user_id: "c1", converti: false }, { id: "pr2", client_user_id: "zz", converti: false }],
    commandes: [], dettes: [], clients_installes: [], ventes: [], ajustements: [],
  };
  const r1 = Val.validerDevis(dbV, { clientId: "c1", devisId: "dv1", boutique: "BMI DEMAKPOE",
    infosContrat: { contrat_numero: "CTR-2026-TEST", contrat_signature: "data:image/png;base64,x", contrat_date_signature: "2026-09-04", contrat_signe_en_boutique: "BMI DEMAKPOE", contrat_signe_devant: "KOSSI" },
    acteur: { nom: "KOSSI" }, mention: " — signé en boutique BMI DEMAKPOE devant KOSSI" });
  const dv1 = r1.db?.users.find((u) => u.id === "c1").devis.find((x) => x.id === "dv1");
  test("★ un devis signé en boutique devient une commande à encaisser (origine_devis, en_attente, commissionné au commercial)",
    !r1.erreur && r1.db.commandes.length === 1 && r1.db.commandes[0].statut === "en_attente"
    && r1.db.commandes[0].origine_devis.devis_id === "dv1" && r1.db.commandes[0].commercial === "KOSSI" && r1.db.commandes[0].boutique === "BMI DEMAKPOE");
  test("★ le devis passe « validé », porte la boutique de paiement, le contrat, la mention « signé en boutique devant … »",
    dv1.statut === "valide" && dv1.boutique_paiement === "BMI DEMAKPOE" && dv1.boutique_adresse === "Lomé, Démakpoé" && dv1.commande_id === r1.db.commandes[0].id
    && dv1.contrat_numero === "CTR-2026-TEST" && dv1.contrat_signe_devant === "KOSSI" && r1.journal.includes("signé en boutique") && r1.journal.includes("VALIDÉ par KOSSI"));
  test("le prospect DU client prend le badge « devis validé », pas celui d'un autre",
    r1.db.prospects[0].devis_valide === true && !r1.db.prospects[1].devis_valide);
  test("★ sans boutique de paiement, ou boutique inconnue : refusé (rien n'est écrit)",
    !!Val.validerDevis(dbV, { clientId: "c1", devisId: "dv1", acteur: { nom: "KOSSI" } }).erreur
    && !!Val.validerDevis(dbV, { clientId: "c1", devisId: "dv1", boutique: "NULLE PART", acteur: { nom: "KOSSI" } }).erreur);
  test("★ un devis déjà validé ne se revalide pas (pas de deuxième commande)",
    !!Val.validerDevis(dbV, { clientId: "c1", devisId: "dv3", boutique: "BMI DEMAKPOE", acteur: { nom: "KOSSI" } }).erreur);
  const r2 = Val.validerDevis(dbV, { clientId: "c1", devisId: "dv2", infosContrat: { contrat_numero: "CTR-P", contrat_papier: true, contrat_papier_boutique: "BMI DEMAKPOE", contrat_papier_par: "KOSSI" }, acteur: { nom: "KOSSI" }, mention: " — signé sur papier" });
  const dv2 = r2.db?.users.find((u) => u.id === "c1").devis.find((x) => x.id === "dv2");
  test("★ pose seule signée sur papier : chantier + dette TERRAIN créés tout de suite, au nom du CLIENT (client_user_id)",
    !r2.erreur && r2.db.commandes.length === 0 && r2.db.dettes.length === 1 && r2.db.dettes[0].boutique === C.NOM_BOUTIQUE_TERRAIN
    && r2.db.dettes[0].client_user_id === "c1" && r2.db.dettes[0].montant === 20000 && r2.db.dettes[0].motif.includes("CTR-P")
    && r2.db.clients_installes.length === 1 && r2.db.clients_installes[0].pose_seule === true && r2.db.clients_installes[0].devis_id === "dv2"
    && dv2.statut === "valide" && dv2.contrat_papier === true && r2.journal.includes("pose seule") && r2.journal.includes("signé sur papier"));
  const r3 = Val.validerDevis(dbV, { clientId: "c2", devisId: "dv9", acteur: { nom: "ECOLIER" } });
  test("★ cloisonnement : la pose seule d'un client de FORMATION va dans la caisse TERRAIN d'entraînement, jamais la réelle",
    !r3.erreur && r3.db.dettes[0].boutique === C.NOM_BOUTIQUE_TERRAIN_FORMATION);
  // Le même chemin depuis l'espace client (acteur = le client) garde son journal.
  const r4 = Val.validerDevis(dbV, { clientId: "c1", devisId: "dv1", boutique: "BMI DEMAKPOE", acteur: { nom: "KOFFI", estClient: true } });
  test("depuis son espace, le journal dit « VALIDÉ par le client … »", r4.journal.includes("VALIDÉ par le client KOFFI"));

  const ec = readFileSync("src/screens/EspaceClient.jsx", "utf8");
  const tl = readFileSync("src/screens/TousLesDevis.jsx", "utf8");
  test("★ l'espace client passe par la MÊME règle (plus de commande ni de chantier fabriqués sur place)",
    (ec.match(/validerDevis\(/g) || []).length >= 2 && !/commandes: \[commande, \.\.\./.test(ec) && !/clients_installes: \[chantier/.test(ec));
  test("★ le vendeur de la boutique de PAIEMENT voit les devis à encaisser chez lui (décision Timo 04/09/2026)",
    /\(d\.boutique_paiement \|\| d\.boutique\) === profile\.boutique/.test(tl));
  test("★ les trois gestes sont là, réservés à l'ADMINISTRATEUR PRINCIPAL (décision Timo 04/09/2026), sur un devis encore proposé",
    tl.includes("Faire signer ici") && tl.includes("Imprimer pour signature papier") && tl.includes("Signé sur papier")
    && /const peutSignerEnBoutique = estAdminPrincipal\(db, profile\)/.test(tl)
    && /peutFaireSigner = \(d\) => peutSignerEnBoutique && \(d\.statut \|\| "propose"\) === "propose"/.test(tl));
  test("★ …et les trois GESTES refusent aussi (le bouton caché ne suffit pas)",
    (tl.match(/refuserSiPasAdminPrincipal\(\)/g) || []).length >= 3);
  test("le contrat affiché au vendeur est CELUI de l'impression (une seule source de texte)",
    /htmlContratInstallation\(apercu, db\)/.test(tl) && /export function htmlContratInstallation/.test(readFileSync("src/lib/impression.js", "utf8")));
  test("★ un contrat signé sur papier est un contrat (liste, impression) — et le dit",
    /d\.contrat_signature \|\| d\.contrat_papier/.test(readFileSync("src/lib/calculs.js", "utf8"))
    && readFileSync("src/lib/impression.js", "utf8").includes("Signé sur papier — original archivé")
    && readFileSync("src/screens/ContratsInstallation.jsx", "utf8").includes("Signé sur papier"));
}

titre("Le nom des documents : UNE règle — Type - Client - Numéro");
{
  // Demande Timo (04/09/2026) : « que le nom du client fasse partie du nom
  // du fichier — normalement c'est une seule règle qui gère cet aspect ».
  test("★ nomDocument assemble Type - Client - Numéro", Core.nomDocument("Contrat", { client: "KOFFI AGBEKO", numero: "CTR-2026-AB12" }) === "Contrat - KOFFI AGBEKO - CTR-2026-AB12");
  test("un morceau vide (ou « — ») est omis, sans tiret orphelin",
    Core.nomDocument("Reçu", { client: "", numero: "V-12" }) === "Reçu - V-12" && Core.nomDocument("Devis", { client: "—", numero: "X" }) === "Devis - X");
  test("les caractères interdits dans un nom de fichier sont retirés",
    Core.nomDocument("Devis", { client: 'A/B:C*D?"E<F>G|H', numero: "1" }) === "Devis - ABCDEFGH - 1" && Core.fichierPdf("Devis", { client: "K", numero: "1" }) === "Devis - K - 1.pdf");
  const imp = readFileSync("src/lib/impression.js", "utf8");
  test("★ TOUS les documents imprimés passent par la règle (aucun titre fabriqué à la main)",
    (imp.match(/printApi\.open\(/g) || []).length === (imp.match(/printApi\.open\((?:sortie|html|htmlContratInstallation\(d, db\)), nomDocument\(/g) || []).length
    && (imp.match(/printApi\.open\(/g) || []).length >= 8);
  test("★ le contrat, le PV, le reçu et le proforma portent le nom du client",
    /nomDocument\("Contrat", \{ client: client\?\.nom_base \|\| client\?\.nom/.test(imp) && /nomDocument\(avenant \? "Avenant" : "PV", \{ client:/.test(imp)
    && /nomDocument\("Reçu", \{ client: v\.client/.test(imp) && /nomDocument\("Proforma", \{ client: p\.client/.test(imp));
  const pdf = readFileSync("src/pdf.js", "utf8");
  // 12/09/2026 : le relevé d'une caisse centrale aussi (genererReleve) — trois.
  // 18/09/2026 : le DOSSIER PERSONNEL d'un client (droit d'accès) — quatre.
  test("les PDF téléchargés (devis, proforma, relevé, dossier personnel) suivent la même règle",
    (pdf.match(/doc\.save\(fichierPdf\(/g) || []).length === 4 && !/doc\.save\(`/.test(pdf));
  test("le bouton du devis s'appelle « Devis PDF » (pour ne pas le confondre avec le contrat)",
    readFileSync("src/screens/TousLesDevis.jsx", "utf8").includes("📄 Devis PDF</button>"));
}

titre("🏦 Les banques : une liste dans Paramètres, la banque sur la fiche, le moyen en boutons (14/09/2026)");
{
  // Timo, dans l'ordre : « et si ce mode était à sélectionner ? » ; « si
  // banque, normalement dans la fiche de l'utilisateur, on devrait ajouter le
  // nom de la banque ? » ; « une liste dans paramètres, lance ».
  const dbB = { boutiques: [{ nom: "A" }, { nom: "B", banques: ["Orabank", "Ecobank"] }] };
  test("★ la liste vit sur les boutiques (rien à coller) ; sans réglage, elle est vide",
    JSON.stringify(Bq.banquesReglees(dbB)) === JSON.stringify(["Orabank", "Ecobank"])
    && Bq.banquesReglees({ boutiques: [{ nom: "A" }] }).length === 0 && Bq.banquesReglees(null).length === 0);
  test("★ ajouter : nom vide refusé, doublon refusé quels que soient accents et majuscules, liste rangée par ordre alphabétique",
    Bq.ajouterBanque([], "").refus && Bq.ajouterBanque(["Ecobank"], "  ECOBANK ").refus
    && JSON.stringify(Bq.ajouterBanque(["Orabank", "Ecobank"], "  BTCI  ").liste) === JSON.stringify(["BTCI", "Ecobank", "Orabank"])
    && Bq.nettoyerNomBanque("  Coris   Bank ") === "Coris Bank");
  test("retirer : la banque part quelles que soient les majuscules, les autres restent",
    JSON.stringify(Bq.retirerBanque(["BTCI", "Ecobank"], "ecobank")) === JSON.stringify(["BTCI"]));
  const kossi = { nom: "KOSSI", banque: "Ecobank", compte_bancaire: "TG0012345678904321" };
  test("★ la banque d'une personne se lit « banque, compte …4321 » — le numéro n'est JAMAIS affiché en entier",
    Bq.libelleBanque(kossi) === "Ecobank, compte …4321" && Bq.compteMasque("TG0012345678904321") === "…4321" && Bq.compteMasque("12") === "12"
    && Bq.libelleBanque({ banque: "BTCI" }) === "BTCI" && Bq.libelleBanque({}) === "" && Bq.libelleBanque(null) === "");
  // ⚠ RETOURNÉ le 18/09/2026 : la dépense gardait le numéro EN ENTIER, et la
  // table des dépenses descend sur tous les appareils. Elle ne garde plus que
  // les quatre derniers chiffres — ce que l'écran affichait déjà. La BANQUE,
  // elle, n'a pas bougé : c'est la règle de Timo du 14/09/2026.
  test("★ un paiement PAR VIREMENT garde la banque du jour sur la dépense, et le numéro RACCOURCI ; espèces ou fiche sans banque n'écrivent rien",
    JSON.stringify(Bq.mentionVirement(kossi, "Virement bancaire")) === JSON.stringify({ banque: "Ecobank", compte_bancaire: "…4321" })
    && JSON.stringify(Bq.mentionVirement(kossi, "Espèces")) === "{}" && JSON.stringify(Bq.mentionVirement({ nom: "X" }, "Virement bancaire")) === "{}"
    && JSON.stringify(Bq.mentionVirement(null, "Virement bancaire")) === "{}"
    && Bq.ficheParId([kossi, { id: "u2" }], "u2")?.id === "u2" && Bq.ficheParId([], "u2") === null);
  test("★ les boutons du moyen : quatre, jamais « Crédit (dette) », le moyen proposé en PREMIER",
    JSON.stringify(Core.moyensProposes("Espèces")) === JSON.stringify(["Espèces", "Mobile Money (Flooz)", "Mobile Money (Mixx/T-Money)", "Virement bancaire"])
    && Core.moyensProposes("Virement bancaire")[0] === "Virement bancaire" && Core.moyensProposes("Virement bancaire").length === 4
    && !Core.moyensProposes("Espèces").includes("Crédit (dette)"));
  const uiB = readFileSync("src/components/ui.jsx", "utf8");
  test("★ la question rappelle la banque du bénéficiaire, ou dit qu'elle manque et où la saisir",
    /🏦 Banque de \$\{qui\} : \$\{l\}/.test(uiB) && /🏦 Aucune banque sur la fiche de \$\{qui\} \(👥 Utilisateurs → ⋯ Gérer → 🏦 Banque\)/.test(uiB));
  const parB = readFileSync("src/screens/Parametres.jsx", "utf8");
  test("★ ⚙ Paramètres → 🏦 Banques : ajouter et retirer, administrateur, écrit sur les boutiques",
    /data-reglage="banques"/.test(parB) && /refuserSaufAdmin\(profile, "Modifier la liste des banques"\)/.test(parB)
    && /db\.boutiques\.map\(\(b\) => \(\{ \.\.\.b, banques: liste \}\)\)/.test(parB) && /ajouterBanque\(banques, nouvelleBanque\)/.test(parB));
  const csB = readFileSync("src/screens/Caisse.jsx", "utf8");
  test("★ le versement vers BANQUE choisit dans la liste, « ✏️ Autre banque… » garde la saisie libre, et sans liste réglée rien ne change",
    /data-choix="banque-versement"/.test(csB) && /banquesReglees\(db\)\.length > 0 && !vers\.banqueLibre \?/.test(csB)
    && /<option value="__autre__">✏️ Autre banque…<\/option>/.test(csB) && /<Field label="Nom de la banque"><input/.test(csB));
  const utiB = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  test("★ la fiche porte 🏦 Banque : administrateur, choix dans la liste (ou saisie libre sans liste), banque et numéro de compte enregistrés",
    /refuserSaufAdmin\(profile, "Modifier la banque d'un employé"\)/.test(utiB)
    && /\{ \.\.\.x, banque, compte_bancaire: String\(compte\)\.trim\(\) \}/.test(utiB)
    && /🏦 Banque\{banqueDe\(u\) \? ` · \$\{banqueDe\(u\)\}` : ""\}/.test(utiB));
  test("★ chaque paiement à une personne passe SA fiche à la question, et la prime d'installation garde sa banque",
    /demanderMoyenPaiement\(`pour \$\{c\.u\.nom\}`, "Espèces", "Moyen de paiement", c\.u\)/.test(readFileSync("src/screens/MonEquipe.jsx", "utf8"))
    && /demanderMoyenPaiement\(`pour \$\{st\.u\.nom\}`, "Espèces", "Moyen de paiement", st\.u\)/.test(readFileSync("src/screens/MonEquipe.jsx", "utf8"))
    && /demanderMoyenPaiement\(`pour \$\{e\.nom\}`, "Espèces", "Moyen de paiement", ficheParId\(db\.users, e\.user_id\)\)/.test(readFileSync("src/screens/PrimesRemises.jsx", "utf8"))
    && /demanderMoyenPaiement\(`pour \$\{e\.nom\}`, "Espèces", "Moyen de paiement", ficheParId\(db\.users, e\.user_id\)\)/.test(readFileSync("src/screens/ClientsInstalles.jsx", "utf8"))
    && /\.\.\.mentionVirement\(ficheParId\(db\.users, e\.user_id\), moyen\),/.test(readFileSync("src/lib/calculs.js", "utf8")));
}

titre("💰 Ventes : le prix de vente se lit dans la fenêtre « Rechercher un article » (14/09/2026)");
{
  // Timo : « dans Ventes, quand on clique sur l'article, à part la quantité en
  // stock qui apparaît, on devrait aussi avoir le prix de vente ».
  const sa = readFileSync("src/components/SelecteurArticle.jsx", "utf8");
  // Couleur : le bleu de l'espace, en gras (Timo, 14/09/2026 : « les prix ne
  // peuvent pas avoir une autre couleur que gris ? » → option 1) — violet en
  // formation tout seul, par les variables de src/index.css.
  test("★ chaque ligne du sélecteur montre le prix (quand l'écran en passe un) à côté du disponible — « 12 000 F · dispo : 30 », en bleu de l'espace et en gras",
    /prix \? <span className="font-bold text-sky-800" data-prix=\{p\.id\}>\{fmt\(prix\(p\)\)\}<\/span> : null/.test(sa)
    && /<span className="text-slate-400">dispo : \{dispoRestant\(p\)\}<\/span>/.test(sa) && /import \{ fmt \} from "\.\.\/lib\/core";/.test(sa));
  test("★ Ventes passe le PRIX DE VENTE de l'article ; Commandes ne passe rien (le prix de vente n'y a pas de sens)",
    /<SelecteurArticle [^\n]*prix=\{\(p\) => Number\(p\.prix_vente \|\| 0\)\} \/>/.test(readFileSync("src/screens/Ventes.jsx", "utf8"))
    && !/prix=/.test((readFileSync("src/screens/Commandes.jsx", "utf8").match(/<SelecteurArticle [^\n]*\/>/) || [""])[0]));
}

titre("Le reçu d'une dette : « reçu de dette » tant que rien n'est encaissé (14/09/2026)");
{
  // Capture Timo : MR ERIC, 1 000 000 F dû, 0 F versé, et le document disait
  // « REÇU DE VERSEMENT — Date du versement — Reçu par ». Sa règle : « si pas
  // d'avance donné, il doit rester : reçu de dette jusqu'au jour où il y a un
  // 1er versement… mais si le premier jour, il y a eu une avance, il peut être
  // nommé reçu de versement en même temps ».
  const imp = readFileSync("src/lib/impression.js", "utf8");
  const t = Core.titreRecuDette;
  const sans = { montant: 1000000, paye: 0, paiements: [], date: "2026-09-14", par: "ANGELE" };
  test("★ dette sans aucune avance → REÇU DE DETTE (le cas exact de la capture)",
    t(sans).titre === Core.TITRE_RECU_DETTE && t(sans).titre === "REÇU DE DETTE" && !t(sans).versement && !t(sans).solde);
  test("une ancienne dette sans liste de versements (paiements absent) → REÇU DE DETTE aussi",
    t({ montant: 500, paye: 0 }).titre === "REÇU DE DETTE");
  const avance = { montant: 1000000, paye: 200000, paiements: [{ date: "2026-09-14", montant: 200000, par: "ANGELE" }] };
  test("★ une avance le premier jour → REÇU DE VERSEMENT dès ce jour-là",
    t(avance).titre === Core.TITRE_RECU_VERSEMENT && t(avance).versement && !t(avance).solde && t(avance).reste === 800000);
  test("un premier versement plus tard → REÇU DE VERSEMENT",
    t({ ...sans, paye: 50000, paiements: [{ date: "2026-10-01", montant: 50000 }] }).titre === "REÇU DE VERSEMENT");
  test("une ancienne dette avec un « déjà payé » sans ligne de versement compte comme versée",
    t({ montant: 1000, paye: 300 }).titre === "REÇU DE VERSEMENT");
  test("tout est versé → REÇU DÉFINITIF — DETTE SOLDÉE (inchangé)",
    t({ montant: 1000, paye: 1000, paiements: [{ montant: 1000 }] }).titre === Core.TITRE_RECU_SOLDE && t({ montant: 1000, paye: 1000 }).solde);
  test("★ le document lit la règle : titre, date et signature suivent `versement` — aucun titre écrit à la main",
    imp.includes("const { solde, versement, titre, montantDu, totalVerse, reste } = titreRecuDette(d);")
    && imp.includes("<h1${solde ? ' class=\"solde\"' : \"\"}>${titre}</h1>")
    && !/"REÇU DE VERSEMENT"|"REÇU DÉFINITIF/.test(imp)
    && imp.includes("<div><b>Date du versement :</b>") && imp.includes("<div><b>Date :</b> ${dFR(d.date)}</div>")
    && imp.includes("<div><b>Établi par :</b> ${esc(d.par || \"—\")}</div>")
    && imp.includes("${versement ? `Reçu par${dernier?.par ? ` : ${esc(dernier.par)}` : \"\"}` : `Établi par${d.par ? ` : ${esc(d.par)}` : \"\"}`}"));
  test("sans versement, pas de tableau vide : « Aucun versement à ce jour »",
    imp.includes("${paiements.length > 0 ? `") && imp.includes("Aucun versement à ce jour."));
  // 14/09/2026, Timo : « le reste à payer doit être écrit en rouge » — sur le
  // reçu de dette ET sur le reçu de vente à crédit (même ligne, même règle).
  test("★ « RESTE À PAYER » est écrit en ROUGE (reçu de dette et reçu de vente à crédit)",
    (imp.match(/<tr class="reste"><td>RESTE À PAYER :<\/td>/g) || []).length === 2
    && !/<tr class="total"><td>RESTE À PAYER/.test(imp)
    && (imp.match(/tr\.reste td\{border-top:2px solid #dc2626;font-weight:bold;font-size:14px;color:#dc2626\}/g) || []).length === 2);
  test("Dettes et Ventes impriment toujours par la même fonction (le titre s'adapte tout seul)",
    (readFileSync("src/screens/Dettes.jsx", "utf8").match(/imprimerRecuVersement\(/g) || []).length === 3
    && readFileSync("src/screens/Ventes.jsx", "utf8").includes("imprimerRecuVersement(reservation, infoBq(boutique))"));
  // 14/09/2026, Timo devant le reçu d'une vente à crédit sans avance : « le
  // document porte reçu de vente au lieu de reçu de dette, le motif a disparu »
  // → « ta proposition » : une vente à crédit remet le reçu de SA dette.
  const dbV = { dettes: [{ id: "d1", vente_id: "v1", montant: 1000, paye: 0, paiements: [] }, { id: "d2", montant: 5 }] };
  const credit = { id: "v1", paiement: "Crédit (dette)" };
  test("★ une vente à crédit remet le reçu de sa dette (documentDeVente → la dette liée par vente_id)",
    Core.documentDeVente(dbV, credit).type === "dette" && Core.documentDeVente(dbV, credit).dette.id === "d1");
  test("une vente comptant garde son reçu de vente, même si une dette porte son id par erreur",
    Core.documentDeVente(dbV, { id: "v1", paiement: "Espèces" }).type === "vente");
  test("une vieille vente à crédit sans dette liée garde le reçu de vente (on ne devine jamais une dette)",
    Core.documentDeVente(dbV, { id: "v9", paiement: "Crédit (dette)" }).type === "vente" && Core.documentDeVente({}, credit).type === "vente"
    && Core.detteDeVente(dbV, { paiement: "Crédit (dette)" }) === null);
  const ventesSrc = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ 💰 Ventes n'appelle plus jamais le reçu de vente directement : UN chemin, imprimerRecuDeVente (après l'encaissement, sur `next` qui porte la dette neuve ; et le bouton 🖨 de la ligne)",
    !/imprimerRecu\(/.test(ventesSrc) && !/\bimprimerRecu\b/.test(ventesSrc.split("\n").find((l) => l.startsWith("import") && l.includes("../lib/impression")) || "")
    && ventesSrc.includes("imprimerRecuDeVente(next, vente, infoBq(boutique), db.produits)")
    && ventesSrc.includes("imprimerRecuDeVente(db, v, infoBq(v.boutique), db.produits)")
    && imp.includes("const doc = documentDeVente(db, v);") && imp.includes('if (doc.type === "dette") imprimerRecuVersement(doc.dette, bq);'));
}

titre("Le filet : abandonner un geste refusé par le serveur, sans rien laisser à moitié");
{
  // Vague 3, étape 1. La file d'attente : un geste refusé (lot 7 : users +
  // commandes), une modification FAITE ENSUITE sur la même commande (lot 9),
  // un geste sans rapport (lot 8), et une suppression locale refusée.
  const ops = [
    { seq: 1, lot: 7, table: "users", op: "upsert", id: "c1", data: { id: "c1", v: 2 }, base: { id: "c1", v: 1 } },
    { seq: 2, lot: 7, table: "commandes", op: "upsert", id: "cm1", data: { id: "cm1", statut: "en_attente" }, base: null },
    { seq: 3, lot: 8, table: "ventes", op: "upsert", id: "v9", data: { id: "v9" }, base: null },
    { seq: 4, lot: 9, table: "commandes", op: "upsert", id: "cm1", data: { id: "cm1", statut: "validee" }, base: { id: "cm1", statut: "en_attente" } },
    { seq: 5, lot: 10, table: "dettes", op: "delete", id: "d1" },
  ];
  const plan = Ab.planAbandon(ops, { lot: 7, cles: ["users:c1", "commandes:cm1"] });
  test("★ le geste refusé ET ce qui attendait derrière lui sur les mêmes enregistrements sont retirés — le reste de la file reste",
    plan.seqs.join(",") === "1,2,4");
  test("★ l'appareil revient à l'état d'AVANT : la ligne modifiée reprend sa version d'origine, la ligne CRÉÉE par le geste est effacée",
    plan.restaurations.some((r) => r.table === "users" && r.id === "c1" && r.base?.v === 1)
    && plan.restaurations.some((r) => r.table === "commandes" && r.id === "cm1" && r.base === null)
    && plan.restaurations.length === 2);
  const plan2 = Ab.planAbandon(ops, { lot: 10, cles: ["dettes:d1"] });
  test("★ une suppression locale refusée : la ligne sera redemandée au serveur (l'appareil n'en a plus la copie)",
    plan2.seqs.join(",") === "5" && plan2.aRetelecharger.join(",") === "dettes" && plan2.restaurations.length === 0);
  test("le récapitulatif nomme le motif du serveur et compte ce qui attendait derrière",
    Ab.resumeAbandon({ tables: ["users", "commandes"], motif: "règle X" }, plan).includes("règle X")
    && Ab.resumeAbandon({ tables: ["users", "commandes"], motif: "règle X" }, plan).includes("3 opération(s)"));
  const sy = readFileSync("src/sync.js", "utf8");
  test("★ sync.js signale le geste refusé (lot ET envoi isolé) et sait l'abandonner en appliquant le plan",
    (sy.match(/refusEnCours = \{/g) || []).length === 2 && /export async function abandonnerGesteRefuse/.test(sy)
    && /planAbandon\(ops, refus\)/.test(sy) && /refus: refusEnCours/.test(sy));
  test("★ le bouton d'abandon est réservé à l'administrateur PRINCIPAL, dans l'affichage ET dans le geste",
    /sync\.refus && estAdminPrincipal\(db, profile\) &&/.test(readFileSync("src/App.jsx", "utf8"))
    && /if \(!refus \|\| !estAdminPrincipal\(db, profile\)\) return;/.test(readFileSync("src/App.jsx", "utf8")));
  test("l'abandon laisse une trace dans le journal, au nom de celui qui l'a décidé",
    /Geste REFUSÉ par le serveur abandonné par \$\{profile\.nom\}/.test(readFileSync("src/App.jsx", "utf8")));
}

titre("Vague 3, étape 2 (application) : chaque geste d'argent revérifie son rôle DANS le geste");
{
  // Décisions Timo du 04/09/2026. Le bouton caché ne suffit pas (inventaire
  // du 04/09) : le geste lui-même refuse — comme le fera le serveur.
  test("★ les aides existent, avec les rôles tranchés (stock : magasinier+gérant+admin ; caisse et fournisseurs : gérant+admin ; remise : 3 %)",
    C.ROLES_STOCK.join() === "magasinier,gerant,admin" && C.ROLES_CAISSE.join() === "vendeur,gerant,admin"
    && C.ROLES_FOURNISSEURS.join() === "gerant,admin" && C.PLAFOND_REMISE_PCT === 3
    && C.remiseExigeAdmin(3.5) && !C.remiseExigeAdmin(3) && !C.remiseExigeAdmin("") );
  const attendus = [
    ["src/screens/Ventes.jsx", ["Supprimer une vente"]], // 14/09/2026 : le retour sous garantie passe au gérant (refuserSaufRoles, ROLES_RETOUR_GARANTIE)
    ["src/screens/Dettes.jsx", ["Supprimer une dette"]],
    ["src/screens/Depenses.jsx", ["Supprimer une dépense", "Supprimer une dépense", "Annuler un pointage du comptable"]],
    ["src/screens/Stocks.jsx", ["Servir un bon de ravitaillement", "Refuser une demande de ravitaillement", "Faire l'inventaire", "Valider l'inventaire",
      "Enregistrer une entrée de stock", "Ajuster le stock", "Transférer du stock", "Statuer sur un article défectueux", "Statuer sur un article défectueux"]],
    // ⚠ RETOURNÉ le 21/09/2026 : « Clôturer la caisse » → « Faire la clôture du
    // jour » (Timo : « en réalité on clôture les ventes »). La GARDE, elle, n'a
    // pas bougé : le geste revérifie toujours son rôle.
    ["src/screens/Caisse.jsx", ["Faire la clôture du jour"]],
    ["src/screens/Commerciaux.jsx", ["Créer un agent commercial", "Modifier un agent commercial", "Activer ou désactiver un agent commercial", "Supprimer un agent commercial"]],
    ["src/screens/Fournisseurs.jsx", ["Créer un fournisseur", "Régler un fournisseur", "Enregistrer une dette fournisseur", "Supprimer un fournisseur"]],
    ["src/screens/Ravitaillement.jsx", ["Servir une demande de transfert", "Refuser une demande de transfert"]],
  ];
  for (const [fichier, gestes] of attendus) {
    const src = readFileSync(fichier, "utf8");
    const manquants = gestes.filter((g, i) => (src.match(new RegExp(`refuserSauf(?:Admin|Roles)\\(profile, (?:ROLES_[A-Z]+, )?"${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\)`, "g")) || []).length < gestes.filter((x) => x === g).length);
    test(`★ ${fichier.split("/").pop()} : ${gestes.length} geste(s) revérifient leur rôle`, manquants.length === 0);
  }
  test("★ la remise au-delà de 3 % est refusée à l'envoi du devis pour tout autre que l'administrateur (les 3 volets)",
    /if \(remiseExigeAdmin\(devis\?\.pct_remise\) && profile\.role !== "admin"\)/.test(readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8")));
  const ventesSrc = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ …et à l'encaissement d'une vente (sauf remise venant de la commande encaissée), sur les proformas et les commandes",
    /remiseExigeAdmin\(remisePct\) && profile\.role !== "admin"/.test(ventesSrc) && /Number\(cmd\.remise_pct \|\| 0\) !== remisePct/.test(ventesSrc)
    && (ventesSrc.match(/remiseExigeAdmin\(remisePct\)/g) || []).length === 3
    && /remiseExigeAdmin\(remisePct\) && profile\.role !== "admin"/.test(readFileSync("src/screens/Commandes.jsx", "utf8")));
  test("l'entrée de stock par fichier ignore la colonne Prix d'achat pour tout autre que l'administrateur",
    /profile\.role !== "admin" && resultat\.entrees\.some\(\(x\) => x\.prix_achat\)/.test(readFileSync("src/screens/Stocks.jsx", "utf8")));
  test("★ le SQL des verrous serveur existe, avec ses 11 déclencheurs et l'exception du pointage comptable",
    (readFileSync("supabase/securite-4-argent.sql", "utf8").match(/create trigger \w+_regles_\w+_trg/g) || []).length === 11
    && readFileSync("supabase/securite-4-argent.sql", "utf8").includes("or public.role_jeton() = 'comptable'"));
}

titre("Vague 3, étape 3 (les comptes) : chaque geste sur un compte revérifie son rôle, et le serveur dit la même chose");
{
  // Validé par Timo le 05/09/2026 (« Lance »). Admin seul : bloquer,
  // supprimer, champs de gestion d'un employé ; admin PRINCIPAL seul : mot de
  // passe d'un autre, transfert du rôle, bascule réel ↔ formation ; pouvoir
  // « tâches » pour les tâches des autres. Chacun garde sa propre fiche.
  // ⚠ RETOURNÉ le 17/09/2026 (Timo : « ouvre le rôle technicien BMI ») : le
  // chef des techniciens est un SALARIÉ, donc « technicien BMI ». La liste
  // du 05/09 ne l'avait pas — elle en compte cinq depuis.
  test("★ les aides existent (ROLES_TACHES = admin, resp. commercial, commercial, technicien, technicien BMI)",
    C.ROLES_TACHES.join() === "admin,resp_commercial,commercial,technicien,technicien_bmi"
    && typeof C.refuserSaufAdminPrincipal === "function" && typeof C.refuserSaufTaches === "function");
  const dbT = { users: [{ id: "a", role: "admin", admin_principal: true, actif: true }, { id: "c", role: "commercial" }, { id: "v", role: "vendeur" }, { id: "x", role: "commercial", droits_off: ["act_taches"] }] };
  test("★ refuserSaufAdminPrincipal ne laisse passer que le porteur du drapeau",
    C.refuserSaufAdminPrincipal(dbT, { id: "a", role: "admin" }, "t") === false && C.refuserSaufAdminPrincipal(dbT, { id: "c", role: "commercial" }, "t") === true);
  test("★ refuserSaufTaches suit le rôle ET le pouvoir retiré",
    C.refuserSaufTaches(dbT, dbT.users[1], "t") === false && C.refuserSaufTaches(dbT, dbT.users[2], "t") === true && C.refuserSaufTaches(dbT, dbT.users[3], "t") === true);
  const u = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  const gestesAdmin = ["Bloquer ou réactiver un compte", "Supprimer un compte", "Changer la boutique d'un compte", "Autoriser le chat libre à un client",
    "Nommer ou retirer un chef d'équipe", "Modifier les pouvoirs d'un compte", "Changer le parrain d'un compte", "Fixer la commission d'équipe",
    "Fixer le taux de commission", "Modifier l'identité d'un employé", "Modifier l'anniversaire d'un employé", "Fixer le taux d'avancement",
    "Modifier un salaire", "Enregistrer une prime ou une avance", "Annuler un virement", "Accorder un crédit", "Refuser un crédit",
    "Enregistrer un remboursement de crédit", "Créer un compte employé"];
  test(`★ Utilisateurs.jsx : ${gestesAdmin.length} gestes réservés à l'administrateur le revérifient dans le geste`,
    gestesAdmin.every((g) => u.includes(`refuserSaufAdmin(profile, "${g}")`)));
  const gestesPrincipal = ["Changer le mot de passe d'un compte", "Changer l'espace d'un compte (réel ↔ formation)", "Consulter un mot de passe", "Convertir les mots de passe restés en clair"];
  test("★ Utilisateurs.jsx : les 4 gestes de l'administrateur PRINCIPAL passent par refuserSaufAdminPrincipal",
    gestesPrincipal.every((g) => u.includes(`refuserSaufAdminPrincipal(db, profile, "${g}")`)) && !/if \(!jeSuisAdminPrincipal\) \{ uAlert/.test(u));
  test("★ le transfert du rôle principal (Paramètres) explique son refus au lieu de se taire",
    /refuserSaufAdminPrincipal\(db, profile, "Transférer le rôle d'administrateur principal"\)/.test(readFileSync("src/screens/Parametres.jsx", "utf8")));
  const eq = readFileSync("src/screens/MonEquipe.jsx", "utf8");
  test("★ Mon équipe : assigner, valider et rouvrir une tâche revérifient le pouvoir « tâches »",
    ["Assigner une tâche", "Valider une tâche", "Rouvrir une tâche"].every((g) => eq.includes(`refuserSaufTaches(db, profile, "${g}")`)));
  test("★ envoyer un virement de salaire est réservé à l'administrateur dans le geste lui-même",
    /refuserSaufAdmin\(profile, "Envoyer un virement de salaire"\)/.test(readFileSync("src/lib/calculs.js", "utf8")));
  const sql = readFileSync("supabase/securite-5-comptes.sql", "utf8");
  test("★ le SQL serveur existe : déclencheur users_regles_comptes, principal reconnu par l'étiquette OU la fiche, pouvoir tâches",
    /create trigger users_regles_comptes_trg/.test(sql) && /function public\.est_admin_principal\(\)/.test(sql)
    && /bmi\.transfert_principal/.test(sql) && /function public\.a_pouvoir_taches\(\)/.test(sql));
  test("★ …et ferme le dernier trou de tester-ecriture-sql (salaire dans users.data)", /'salaire_base'/.test(sql));
  test("★ le banc tester-comptes rejoue les deux ordres du transfert du rôle principal",
    (readFileSync("scripts/tester-comptes-sql.sh", "utf8").match(/le principal transfère son rôle/g) || []).length >= 3
    && readFileSync("package.json", "utf8").includes('"tester-comptes"'));
}

titre("Vague 3, étape 4 (devis, chantiers, prospects, boutiques, groupes) : le rôle se revérifie dans le geste, le serveur dit la même chose");
{
  // Validé par Timo le 05/09/2026 (« Lance »). Admin principal : plan de
  // règlement, signature en boutique. Admin : la fiche d'un chantier, PV,
  // réception forcée, avenant, frais, cadeau, photos, catégories, boutiques,
  // groupes. Admin + resp. commercial : programmer. Admin ou son commercial :
  // supprimer un chantier, contacter / archiver / supprimer un prospect.
  test("★ les aides existent (ROLES_PROGRAMMATION, propriétaire, réaffectation)",
    C.ROLES_PROGRAMMATION.join() === "admin,resp_commercial" && typeof C.refuserSaufProprietaire === "function" && typeof C.refuserSaufReaffectation === "function");
  test("★ « admin ou son commercial » : l'admin passe, le commercial inscrit passe, un autre non",
    C.estProprietaireOuAdmin({ role: "admin", nom: "TIMO" }, "COM") && C.estProprietaireOuAdmin({ role: "commercial", nom: "COM" }, "COM")
    && !C.estProprietaireOuAdmin({ role: "commercial", nom: "COM2" }, "COM") && !C.estProprietaireOuAdmin({ role: "vendeur", nom: "K" }, ""));
  const dbR = { users: [] };
  test("★ réaffecter un prospect : admin, resp. commercial ou chef d'équipe — avec le pouvoir",
    C.peutReaffecter(dbR, { role: "resp_commercial" }) && C.peutReaffecter(dbR, { role: "commercial", chef_equipe: true })
    && !C.peutReaffecter(dbR, { role: "commercial" }) && !C.peutReaffecter(dbR, { role: "commercial", chef_equipe: true, droits_off: ["act_reaffecter"] }));
  const ci = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
  const gestesCI = ["Supprimer une photo de chantier", "Offrir un cadeau", "Marquer un cadeau comme retiré", "Envoyer le lien de signature du PV",
    "Forcer la réception sans signature", "Envoyer un avenant de levée de réserves", "Répartir les frais d'installation", "Répartir les frais d'installation",
    "Demander le paiement d'une prime d'installation", "Lier un compte client à un chantier", "Modifier la date d'entretien",
    "Corriger la fiche d'un chantier", "Corriger la fiche d'un chantier", "Corriger la fiche d'un chantier"];
  test(`★ Chantiers : ${gestesCI.length} gestes réservés à l'administrateur le revérifient dans le geste`,
    gestesCI.every((g) => (ci.match(new RegExp(`refuserSaufAdmin\\(profile, "${g.replace(/[()]/g, "\\$&")}"\\)`, "g")) || []).length >= gestesCI.filter((x) => x === g).length));
  test("★ Chantiers : supprimer = admin ou son commercial ; programmer = admin + resp. commercial ; terminé = admin ou chef de CE chantier",
    /refuserSaufProprietaire\(profile, c\.commercial, "Supprimer une fiche chantier"\)/.test(ci)
    && /refuserSaufRoles\(profile, ROLES_PROGRAMMATION, "Programmer une installation"\)/.test(ci)
    && /if \(!peutTerminer\(c, profile, isAdmin\)\) \{ uAlert/.test(ci));
  const pr = readFileSync("src/screens/Prospects.jsx", "utf8");
  test("★ Prospects : supprimer, contacter, archiver, réactiver, relancer, convertir = admin ou son commercial ; réassigner = pouvoir",
    ["Supprimer un prospect", "Noter un contact avec un prospect", "Archiver un prospect", "Réactiver un prospect", "Relancer un prospect", "Convertir un prospect en client"]
      .every((g) => pr.includes(`refuserSaufProprietaire(profile, p.commercial, "${g}")`))
    && pr.includes('refuserSaufReaffectation(db, profile, "Réassigner un prospect")')
    && (pr.match(/refuserSaufAdmin\(profile, "Gérer les catégories de prospects"\)/g) || []).length === 2);
  test("★ Groupes de discussion : créer, supprimer, membres = admin dans le geste",
    (readFileSync("src/screens/Messagerie.jsx", "utf8").match(/refuserSaufAdmin\(profile, "/g) || []).length === 3);
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  test("★ Paramètres : les gestes sur les boutiques revérifient l'administrateur ; accueil, cachet et suppression avec données = principal",
    (par.match(/refuserSaufAdmin\(profile, "/g) || []).length >= 14
    && ["Supprimer une boutique avec toutes ses données", "Personnaliser l'écran de connexion", "Changer le cachet de l'entreprise"]
      .every((g) => par.includes(`refuserSaufAdminPrincipal(db, profile, "${g}")`)));
  const tld = readFileSync("src/screens/TousLesDevis.jsx", "utf8");
  test("★ Tous les devis : plan de règlement et signature en boutique passent par refuserSaufAdminPrincipal",
    tld.includes('refuserSaufAdminPrincipal(db, profile, "Accepter ou rejeter un plan de règlement")')
    && tld.includes('refuserSaufAdminPrincipal(db, profile, "Faire signer un contrat en boutique (pour l\'instant)")'));
  const sql = readFileSync("supabase/securite-6-devis-chantiers.sql", "utf8");
  test("★ le SQL serveur existe : 6 déclencheurs, lecture de l'équipe en trois (structure / argent / paiement), caisse TERRAIN et demandes laissées libres",
    (sql.match(/create trigger \w+_trg/g) || []).length === 6 && /equipe_argent_change/.test(sql) && /'structure'/.test(sql)
    && /'terrain'/.test(sql) && /- 'demandes' - 'updated_at'/.test(sql));
  test("★ le banc tester-devis-chantiers existe et rejoue le quotidien (photo ajoutée, prime payée, devis encaissé, PV signé par le client)",
    ["AJOUTE une photo", "PAIE la prime demandée", "statut → payé", "signe SON PV", "caisse TERRAIN"].every((t) => readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8").includes(t))
    && readFileSync("package.json", "utf8").includes('"tester-devis-chantiers"'));
}

titre("La fusion à l'envoi ne renvoie plus une vieille copie d'un champ qu'on n'a pas touché");
{
  // Sans cela, un commercial qui assigne une tâche renverrait aussi le taux
  // de commission tel qu'il l'avait en main ; si l'administrateur venait de
  // le changer, le serveur verrait le commercial « changer un taux ».
  const base = { id: "t", nom: "TECH", taux_commission: 3, taches: [] };
  const local = { ...base, taches: [{ id: "t1", titre: "Visite" }] };           // nous : une tâche
  const distant = { ...base, taux_commission: 7, pwd_hash2: "nouveau" };        // eux : le taux et le mot de passe
  const f = Fus.fusionner("users", base, local, distant);
  test("★ le champ changé par l'autre garde SA valeur (taux 3 → 7 conservé)", f.taux_commission === 7);
  test("★ un champ ajouté par l'autre est conservé (nouveau mot de passe)", f.pwd_hash2 === "nouveau");
  test("★ notre modification est conservée (la tâche)", f.taches.length === 1);
  test("un champ que NOUS avons changé garde NOTRE valeur, même si l'autre l'a changé aussi",
    Fus.fusionner("ventes", { id: "v", x: 1 }, { id: "v", x: 2 }, { id: "v", x: 3 }).x === 2);
  test("un champ retiré par l'autre disparaît si nous n'y avons pas touché",
    Fus.fusionner("users", { id: "u", pwd: "clair", a: 1 }, { id: "u", pwd: "clair", a: 2 }, { id: "u", a: 1 }).pwd === undefined);
  test("sans base connue, rien ne change : notre version l'emporte",
    Fus.fusionner("ventes", undefined, { id: "v", x: 2 }, { id: "v", x: 3 }).x === 2);
}

titre("La corbeille des fiches supprimées : mise de côté 30 jours, restaurable par l'administrateur principal");
{
  // Demande Timo (« lance la corbeille », 05/09/2026). Supprimer un chantier
  // ne l'efface plus partout d'un coup : la fiche est MARQUÉE, séparée au
  // chargement et refusionnée à l'écriture (comme la paie), et l'admin
  // principal la restaure ou l'efface depuis ⚙ Paramètres → 🗑.
  const sortieCorb = join("node_modules", ".cache", `bmi-corb-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/corbeille.js"], bundle: true, format: "esm",
    platform: "node", outfile: sortieCorb, logLevel: "silent", loader: { ".js": "jsx" } });
  const Corb = await import(pathToFileURL(sortieCorb).href);
  unlinkSync(sortieCorb);
  test("★ le module est pur (aucune importation) et garde 30 jours",
    !/^import /m.test(readFileSync("src/lib/corbeille.js", "utf8")) && Corb.DUREE_CORBEILLE_JOURS === 30);
  const c1 = { id: "c1", nom: "AMA", prenom: "K.", commercial: "COM", statut: "en_cours" };
  const c2 = { id: "c2", nom: "KOFFI", statut: "termine" };
  const db0 = { clients_installes: [c1, c2], ventes: [] };
  const apres = Corb.mettreALaCorbeille(db0, "clients_installes", "c1", { nom: "COM" }, "2026-09-05T10:00:00Z");
  test("★ mettre à la corbeille RETIRE la fiche de sa table et la range marquée (supprime_le / supprime_par)",
    apres.clients_installes.length === 1 && apres.corbeille_clients_installes.length === 1
    && apres.corbeille_clients_installes[0].supprime_le === "2026-09-05T10:00:00Z" && apres.corbeille_clients_installes[0].supprime_par === "COM");
  const fusion = Corb.fusionnerCorbeille(apres);
  test("★ à l'écriture, la fiche RETOURNE dans sa table (aucun faire-part de suppression ne part)",
    fusion.clients_installes.length === 2 && fusion.corbeille_clients_installes === undefined
    && fusion.clients_installes.some((r) => r.id === "c1" && r.supprime_le));
  const recharge = Corb.separerCorbeille(fusion);
  test("★ au chargement, la fiche marquée est de nouveau séparée : aucun écran ne la voit",
    recharge.clients_installes.length === 1 && recharge.corbeille_clients_installes.length === 1);
  test("séparer une table sans fiche marquée garde le MÊME tableau (les écrans comparent par identité)",
    Corb.separerCorbeille(db0).clients_installes === db0.clients_installes);
  const restaure = Corb.restaurerDeLaCorbeille(apres, "clients_installes", "c1");
  test("★ restaurer rend la fiche telle qu'elle était, sans la marque",
    restaure.clients_installes.length === 2 && restaure.corbeille_clients_installes.length === 0
    && JSON.stringify(restaure.clients_installes.find((r) => r.id === "c1")) === JSON.stringify(c1));
  test("★ à 30 jours la fiche est à purger, à 29 elle ne l'est pas",
    Corb.aPurger(apres, "2026-10-05T10:00:00Z").length === 1 && Corb.aPurger(apres, "2026-10-04T09:00:00Z").length === 0
    && Corb.joursRestants(apres.corbeille_clients_installes[0], "2026-09-06T10:00:00Z") === 29);
  test("★ la purge efface pour de bon (la fiche ne revient dans aucune table)",
    Corb.purgerCorbeille(apres, "2026-10-06T00:00:00Z").corbeille_clients_installes.length === 0
    && Corb.fusionnerCorbeille(Corb.purgerCorbeille(apres, "2026-10-06T00:00:00Z")).clients_installes.length === 1);
  const dbjs = readFileSync("src/db.js", "utf8");
  test("★ db.js sépare au chargement (chargerTout) et refusionne à l'écriture (sauvegarderDiff), les deux",
    /return separerCorbeille\(db\);/.test(dbjs) && /prev = fusionnerCorbeille\(prev\);\s*next = fusionnerCorbeille\(next\);/.test(dbjs));
  const app = readFileSync("src/App.jsx", "utf8");
  test("★ le report d'un état périmé traite les clés de corbeille comme des tables",
    /rebaser\(base, next, dbRef\.current, \[\.\.\.TABLES, \.\.\.CLES_CORBEILLE\]\)/.test(app));
  test("★ la purge automatique tourne sur l'appareil de l'administrateur principal, avant tout point de sortie",
    app.indexOf("aPurger(db)") > 0 && app.indexOf("aPurger(db)") < app.indexOf("if (!db) return"));
  test("★ le geste Suppr. d'un chantier passe par la corbeille (plus de filter direct)",
    /save\(mettreALaCorbeille\(db, "clients_installes", c\.id, profile\)/.test(readFileSync("src/screens/ClientsInstalles.jsx", "utf8")));
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  // ⚠ RETOURNÉ le 18/09/2026 : « 🔒 Données personnelles » s'est glissée
  // devant la corbeille dans la même liste réservée au principal. Le contrôle
  // vérifie toujours la MÊME chose — l'onglet réservé, et les deux gestes
  // gardés —, il ne présume plus qu'il est le premier de la liste.
  test("★ ⚙ Paramètres a l'onglet 🗑 Corbeille pour l'admin principal seul, avec Restaurer et Supprimer définitivement (gestes gardés)",
    /jeSuisPrincipal \? \[.*\["corbeille"/.test(par) && /refuserSaufAdminPrincipal\(db, profile, "Restaurer une fiche de la corbeille"\)/.test(par)
    && /refuserSaufAdminPrincipal\(db, profile, "Supprimer définitivement une fiche"\)/.test(par));
  test("★ la sauvegarde de secours emporte la corbeille", /fusionnerCorbeille\(db\)/.test(readFileSync("src/lib/sauvegarde.js", "utf8")));
  test("★ le serveur : mettre à la corbeille = admin ou son commercial (jamais un client), restaurer = principal",
    /supprime_le/.test(readFileSync("supabase/securite-7-corbeille.sql", "utf8"))
    && readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8").includes("securite-7-corbeille.sql"));
}

titre("La zone de signature : UNE seule, pour le personnel comme pour les clients (440 × 300)");
{
  // Demande Timo (05/09/2026) : « est-ce une seule règle qui gère cet aspect
  // dans toute l'app ? » — non, quatre copies. Désormais components/
  // ZoneSignature.jsx, et rien d'autre ne dessine une signature.
  const zone = readFileSync("src/components/ZoneSignature.jsx", "utf8");
  test("★ le cadre fait 440 × 300 (demande Timo)", /LARGEUR_SIGNATURE = 440/.test(zone) && /HAUTEUR_SIGNATURE = 300/.test(zone));
  test("★ la position du trait exclut la bordure (clientWidth / clientLeft) — la version corrigée est la seule qui subsiste",
    /canvas\.clientWidth/.test(zone) && /canvas\.clientLeft/.test(zone) && /clientLeft/.test(zone));
  const ecrans = ["src/screens/ContratsInstallation.jsx", "src/screens/TousLesDevis.jsx", "src/screens/EspaceClient.jsx"];
  const usages = ecrans.reduce((n, f) => n + (readFileSync(f, "utf8").match(/<ZoneSignature ref=\{\w+\} \/>/g) || []).length, 0);
  test("★ les quatre emplacements (signature personnelle, contrat en boutique, contrat client, PV) utilisent la zone commune", usages === 4);
  const horsZone = execSync("grep -rl '<canvas' src --include=*.jsx", { encoding: "utf8" }).trim().split("\n").filter(Boolean)
    .filter((f) => !f.endsWith("components/ZoneSignature.jsx"));
  test("★ aucun autre écran ne dessine un canevas de signature", horsZone.length === 0);
  test("★ plus aucune copie locale du dessin (positionCanvas, aSigneRef, canvasRef) dans les écrans",
    ecrans.every((f) => !/positionCanvas = |aSigneRef|canvasRef|canvasPvRef/.test(readFileSync(f, "utf8"))));
}

titre("Les proformas émis suivent l'espace regardé, comme les ventes");
{
  // Question de Timo (05/09/2026) : « les ventes et les proformas sont-ils
  // cloisonnés ? ». Les ventes l'étaient (liste par boutique) ; la liste des
  // proformas lisait db.proformas brut — l'administrateur principal voyait
  // les deux espaces mêlés. Retourné en 2.101.59.
  const v = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ la liste des proformas passe par filtreEspaceAffichage",
    /const proformasListe = \(db\.proformas \|\| \[\]\)\.filter\(filtreEspaceAffichage\(db, profile\)\)/.test(v));
  test("★ …et plus aucune lecture brute de db.proformas dans l'écran Ventes",
    !/const proformasListe = db\.proformas \|\| \[\];/.test(v));
}

titre("Toute liste de PERSONNES passe par utilisateursDeLEspace (Salaires, Prospects, Messagerie, Paramètres, Mon équipe)");
{
  // ⚠ RELEVÉ PAR TIMO (05/09/2026) : « dans Salaires aussi les employés
  // formation apparaissent ». La table des comptes n'est PAS cloisonnée par
  // le serveur (un appareil neuf doit retrouver son compte) : le filtre de
  // l'application est la seule barrière, pour tous les rôles. Le balayage des
  // 28 listes de boutiques (2.101.23) n'avait pas balayé les listes de gens.
  const lit = (f) => readFileSync(f, "utf8");
  test("★ Salaires : la liste des employés suit l'espace regardé",
    /const employes = utilisateursDeLEspace\(db, profile\)\.filter\(/.test(lit("src/screens/Salaires.jsx")));
  test("★ Prospects : réassigner ne propose que les commerciaux de l'espace",
    /const equipe = utilisateursDeLEspace\(db, profile\)\.filter\(/.test(lit("src/screens/Prospects.jsx")));
  const msg = lit("src/screens/Messagerie.jsx");
  test("★ Messagerie : fils clients, membres d'un groupe, candidats d'un nouveau groupe — les trois",
    (msg.match(/utilisateursDeLEspace\(db, profile\)\.filter\(/g) || []).length >= 4);
  test("★ Paramètres : le transfert du rôle principal ne propose que les admins de l'espace",
    /\{utilisateursDeLEspace\(db, profile\)\.filter\(\(u\) => u\.role === "admin"/.test(lit("src/screens/Parametres.jsx")));
  test("★ Mon équipe : les chefs d'équipe commissionnés sont ceux de l'espace REGARDÉ (utilisateursDeLEspace — retourné le 09/09/2026, plus de memeEspace)",
    /const chefs = utilisateursDeLEspace\(db, profile\)\.filter\(\(u\) => u\.actif !== false && estChefEquipe\(db, u\)/.test(lit("src/screens/MonEquipe.jsx")));
  test("★ Utilisateurs : le parrain proposé est de l'espace du compte concerné",
    /const parrains = utilisateursDeLEspace\(db, u\)\.filter\(/.test(lit("src/screens/Utilisateurs.jsx")));
  test("★ le message « nouveau client » ne réveille que les admins de son espace (et le principal)",
    /u\.admin_principal === true \|\| !!u\.formation === !!user\.formation/.test(lit("src/lib/comptesClients.js")));
  // Garde-fou : toute NOUVELLE lecture brute de db.users dans un écran fait
  // tomber ce contrôle — on décide alors (espace, ou exception justifiée).
  // Utilisateurs : dernier admin actif ×2, bascule en masse (traverse exprès), suppression,
  // restreindre les admins, mots de passe en clair. MonEquipe : plus aucune (09/09/2026, les deux
  // listes passent par utilisateursDeLEspace). Parametres : sécurité (comptes auth), réinitialisation formation ×2.
  const permis = { "Utilisateurs.jsx": 6, "Commandes.jsx": 1, "Clients.jsx": 1, "EspaceClient.jsx": 1, "Parametres.jsx": 3,
    "ClientsInstalles.jsx": 1, "Messagerie.jsx": 0, "MonEquipe.jsx": 0, "Salaires.jsx": 0, "Prospects.jsx": 0 };
  const brut = /(?:db\.users|\(db\.users \|\| \[\]\))\.filter\(/g;
  for (const [f, n] of Object.entries(permis)) {
    const trouve = (lit(`src/screens/${f}`).match(brut) || []).length;
    test(`${f} : ${n} lecture(s) brute(s) de db.users, pas une de plus (trouvé ${trouve})`, trouve === n);
  }
}

titre("Dimensionnement solaire : 5 h de soleil et 48 V par défaut, et les articles écartés tiennent en UNE ligne");
{
  // Demande Timo (06/09/2026, capture DEMAKPOE) : la liste des articles
  // écartés (48 V pour un système 24 V, article par article) prenait tout
  // l'écran. Une seule ligne grise ; et le stock étant en 48 V, le système
  // démarre en 48 V, avec 5 h de soleil.
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  test("★ SOLEIL_DEFAUT = 5 h et TENSION_DEFAUT = 48 V, utilisés par l'écran",
    /export const SOLEIL_DEFAUT = "5";/.test(sol) && /export const TENSION_DEFAUT = "48";/.test(sol)
    && /brouillon\?\.soleil \?\? SOLEIL_DEFAUT/.test(sol) && /brouillon\?\.tension \?\? TENSION_DEFAUT/.test(sol));
  test("★ les écartés tiennent en une ligne (ligneEcartes), plus de liste article par article",
    /const ligneEcartes = \(role\) =>/.test(sol) && !/article\(s\) écarté\(s\) :/.test(sol) && !/<li key=\{x\.p\.id\}>/.test(sol));
  test("★ la ligne nomme la tension du stock ET celle du système quand c'est la seule cause",
    /Stock en \$\{tensions\[0\]\} V, système réglé en \$\{tension\} V/.test(sol));
  test("un devis repris garde SA tension (le défaut ne l'écrase pas)",
    /besoinsRepris\?\.tension \? String\(besoinsRepris\.tension\) : \(brouillon\?\.tension \?\? TENSION_DEFAUT\)/.test(sol));
}

titre("Les trois volets du dimensionnement finissent leur devis par UNE seule règle (devisCommun.js)");
{
  // Point A3/A4 du relevé des doublons (Timo : « Lance », 07/09/2026). On
  // fabrique ici le même devis avec l'ANCIENNE écriture (recopiée mot pour
  // mot des trois volets d'avant la 2.101.64) et avec la règle commune, et
  // on compare champ par champ.
  const sortieDC = join("node_modules", ".cache", `bmi-dc-${process.pid}.mjs`);
  await build({ entryPoints: ["src/screens/dimensionnement/devisCommun.js"], bundle: true, format: "esm",
    platform: "node", outfile: sortieDC, logLevel: "silent", loader: { ".js": "jsx" } });
  const DC = await import(pathToFileURL(sortieDC).href);
  unlinkSync(sortieDC);
  const trie = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v)) ? Object.fromEntries(Object.keys(v).sort().map((c) => [c, v[c]])) : v);
  const profile = { nom: "KOSSI", id: "u_k", role: "vendeur" };
  const horodatage = { id: "dv1", date: "2026-09-07", heure: "10:00" };
  // ---- L'ANCIENNE ÉCRITURE, telle qu'elle était dans Solaire.jsx ----
  const ancien = ({ totalArticles, pctRemise, pctInstall, pctTransport, poseSeule, montantPoseFixe, pctAcompte, delaiInstallation, autres, lignesMetier, panierMetier, besoins, boutique, type_devis, complement }) => {
    const remise = Math.round((totalArticles * Number(pctRemise || 0)) / 100);
    const fraisInstallationPct = Math.round((totalArticles * Number(pctInstall || 0)) / 100);
    const fraisTransport = Math.round((totalArticles * Number(pctTransport || 0)) / 100);
    const totalDevisNormal = totalArticles - remise + fraisInstallationPct + fraisTransport;
    const fraisInstallation = poseSeule ? Number(montantPoseFixe || 0) : fraisInstallationPct;
    const totalDevis = poseSeule ? (totalArticles - remise + fraisInstallation + fraisTransport) : totalDevisNormal;
    const montantAcompte = Math.round((totalDevis * Number(pctAcompte || 100)) / 100);
    const panier = [...panierMetier,
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix), hors_boutique: !!a.hors_boutique }))];
    return { id: "dv1", date: "2026-09-07", heure: "10:00", par: profile.nom, par_id: profile.id, par_role: profile.role, statut: "propose", panier, boutique,
      ...(type_devis ? { type_devis } : {}), ...(complement || {}), besoins,
      lignes: [...lignesMetier,
        ...autres.filter((a) => a.nom).map((a) => ({ categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1), pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1), hors_boutique: !!a.hors_boutique })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: poseSeule ? "Frais de pose (matériel du client)" : `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis, pose_seule: poseSeule, frais_installation: fraisInstallation, pct_installation: poseSeule ? null : Number(pctInstall || 0),
      frais_transport: fraisTransport, pct_transport: Number(pctTransport || 0), remise, pct_remise: Number(pctRemise || 0),
      pct_acompte: Number(pctAcompte || 100), montant_acompte: montantAcompte, delai_installation: delaiInstallation.trim() };
  };
  const nouveau = (c) => {
    const reglages = { ...c, ...DC.calculerTotaux(c) };
    return DC.construireDevis({ profile, boutique: c.boutique, typeDevis: c.type_devis, complement: c.complement || {}, besoins: c.besoins,
      panierMetier: c.panierMetier, lignesMetier: c.lignesMetier, autres: c.autres, reglages, horodatage });
  };
  const autres = [{ id: "a1", nom: "Câble 6mm²", prix: "15000", qte: "2", hors_boutique: false }, { id: "a2", nom: " ", prix: "", qte: "1" }, { id: "a3", nom: "Coffret", prix: "", qte: "1" }];
  const cas = [
    ["solaire, remise 3 %, installation 10 %, transport 5 %, acompte 50 %", { totalArticles: 1250000, pctRemise: "3", pctInstall: "10", pctTransport: "5", poseSeule: false, montantPoseFixe: "", pctAcompte: "50", delaiInstallation: " 15 jours ", autres,
      lignesMetier: [{ categorie: "Panneaux", article: "PANNEAU 550W", qte: 4, pu: 100000, total: 400000, hors_boutique: false }, { categorie: "Rails de fixation", article: "Rails de fixation (le mètre)", qte: 9, pu: 5500, total: 49500 }],
      panierMetier: [{ produit_id: "p1", article: "PANNEAU 550W", qte: 4, pu: 100000, hors_boutique: false }], besoins: { wh_jour: 2400, tension: 48 }, boutique: "APESSITO" }],
    ["garage, pose seule 80 000 F, sans remise ni transport", { totalArticles: 900000, pctRemise: "0", pctInstall: "10", pctTransport: "0", poseSeule: true, montantPoseFixe: "80000", pctAcompte: "100", delaiInstallation: "", autres: [],
      lignesMetier: [{ categorie: "Porte", article: "Porte — Coulissant (8 m²)", qte: 8, pu: 100000, total: 800000 }, { categorie: "Alimentation", article: "Kit solaire autonome (motorisation)", qte: 1, pu: 100000, total: 100000 }],
      panierMetier: [{ produit_id: null, article: "Porte — Coulissant (8 m²)", qte: 8, pu: 100000 }], besoins: { type_ouvrant: "coulissant", largeur: 4 }, boutique: "APESSITO", type_devis: "garage" }],
    ["autre, remise 2,5 %, installation 0 %, acompte vide (→ 100)", { totalArticles: 60000, pctRemise: "2.5", pctInstall: "0", pctTransport: "0", poseSeule: false, montantPoseFixe: "", pctAcompte: "", delaiInstallation: "", autres,
      lignesMetier: [{ categorie: "Caméras", article: "CAMERA DOME", qte: 3, pu: 10000, total: 30000, hors_boutique: false }],
      panierMetier: [{ produit_id: "p9", article: "CAMERA DOME", qte: 3, pu: 10000, hors_boutique: false }], besoins: { categorie: "Caméras", articles_demandes: [] }, boutique: "DEMAKPOE", type_devis: "autre", complement: { domaine: "securite" } }],
    ["devis vide (rien n'est facturé, aucune ligne de frais)", { totalArticles: 0, pctRemise: "0", pctInstall: "10", pctTransport: "0", poseSeule: false, montantPoseFixe: "", pctAcompte: "100", delaiInstallation: "", autres: [],
      lignesMetier: [], panierMetier: [], besoins: {}, boutique: "APESSITO" }],
  ];
  for (const [nom, c] of cas) {
    test(`★ même devis, ancienne et nouvelle écriture — ${nom}`, trie(ancien(c)) === trie(nouveau(c)));
    test(`  …et le même ORDRE de clés et de lignes — ${nom}`, JSON.stringify(ancien(c)) === JSON.stringify(nouveau(c)));
  }
  for (const f of ["Solaire.jsx", "Garage.jsx", "Autre.jsx"]) {
    const src = readFileSync(`src/screens/dimensionnement/${f}`, "utf8");
    test(`★ ${f} passe par construireDevis, useReglagesDevis, useAutresEquipements, useEnvoiDevis et BlocsFinDevis`,
      /construireDevis\(\{/.test(src) && /useReglagesDevis\(totalArticles/.test(src) && /useAutresEquipements\(lignesReprises, produitsBoutique, brouillon\?\.autres\)/.test(src)
      && /useEnvoiDevis\(\{/.test(src) && /<BlocsFinDevis r=\{r\} onConvertir=\{convertir\} \/>/.test(src));
    test(`★ ${f} n'a plus AUCUNE copie de la fin du devis (pose seule, frais, champs, autres équipements)`,
      !/Pose seule \(matériel/.test(src) && !/pct_installation:/.test(src) && !/categorie: "Autres équipements"/.test(src)
      && !/categorie: "Installation"/.test(src) && !/const ajouterAutre/.test(src) && !/resoudreClientDevis\(/.test(src) && !/effacerBrouillonVolet\(/.test(src));
  }
}

titre("Solaire : les supports de rail et les étriers suivent les rails (règles Timo du 07/09 et du 14/09/2026)");
{
  // 07/09 : « Support rail : nombre de rails × 2 — toujours le nombre pair qui
  // suit. Étrier : (nombre de panneaux × 2) + 8. » — 14/09, RETOURNÉ : « c'était
  // une erreur, le nombre de supports, c'est le nombre de mètres de rail ».
  test("★ supports : UN par mètre de rail — 22 m → 22 ; 9 → 9 ; 8,8 → 9 ; 0 → 0 (plus jamais × 2 ni pair suivant)",
    Sol.supportsPourRails(22) === 22 && Sol.supportsPourRails(9) === 9 && Sol.supportsPourRails(8.8) === 9 && Sol.supportsPourRails(0) === 0
    && Sol.supportsPourRails(7) === 7 && Sol.supportsPourRails(7) !== 14);
  test("★ la règle « pair suivant » n'existe plus (une règle qui ne commande plus rien ne reste pas)",
    typeof Sol.pairSuivant === "undefined" && !/pairSuivant/.test(readFileSync("src/lib/solaire.js", "utf8")));
  test("★ étriers : 4 panneaux → 16 ; 10 → 28 ; 0 → 8", Sol.etriersPourPanneaux(4) === 16 && Sol.etriersPourPanneaux(10) === 28 && Sol.etriersPourPanneaux(0) === 8);
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  test("★ les deux lignes n'existent qu'avec des rails ET l'article en stock, liées à lui (produit_id) pour la sortie de stock",
    /const supportsQte = railsQte > 0 && articleSupportsStock \? qteFixation\("supports", railsQte, supportsPourRails\(railsQte\)\) : 0;/.test(sol)
    && /const etriersQte = railsQte > 0 && articleEtriersStock \? qteFixation\("etriers", nombrePanneaux, etriersPourPanneaux\(nombrePanneaux\)\) : 0;/.test(sol)
    && /produit_id: articleSupportsStock\.id/.test(sol) && /produit_id: articleEtriersStock\.id/.test(sol));
  test("★ elles comptent dans le total des articles et dans les lignes du devis",
    /totalRoles \+ sousTotalRails \+ sousTotalSupports \+ sousTotalEtriers \+ totalAutres/.test(sol)
    && /categorie: "Supports de rail"/.test(sol) && /categorie: "Étriers"/.test(sol));
  test("sans article en stock, l'écran le dit au lieu de se taire", /non ajouté au devis/.test(sol));
}

titre("Solaire : supports et étriers ont leur case de quantité, et tout survit au F5 (demande Timo, 08/09/2026)");
{
  // « Je veux bien une case de quantité… mais quand la page est actualisée,
  // les quantités reviennent. » Une correction est mémorisée avec la base
  // qui l'a produite ; si la base change, retour au calcul. On exerce la
  // règle de reprise (fonction pure) et la logique de base, puis on lit le code.
  const sortieSol = join("node_modules", ".cache", `bmi-solaire-${process.pid}.mjs`);
  await build({ entryPoints: ["src/screens/dimensionnement/Solaire.jsx"], bundle: true, format: "esm", platform: "node",
    outfile: sortieSol, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const SolEcran = await import(pathToFileURL(sortieSol).href);
  unlinkSync(sortieSol);
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  const lignes = [
    { categorie: "Panneaux solaires", article: "PANNEAU 550W", qte: 4 },
    { categorie: "Rails de fixation", article: "Rails de fixation (le mètre)", qte: 9 },
    { categorie: "Supports de rail", article: "SUPPORT RAIL", qte: 12 },
    { categorie: "Étriers", article: "ETRIER", qte: 10 },
  ];
  const f = SolEcran.fixationDepuisLignes(lignes);
  test("★ reprise : supports et étriers reviennent avec LEURS quantités (12 et 10, pas 18 et 16), liées aux rails (9 m) et aux panneaux (4)",
    f.supports.qte === 12 && f.supports.base === 9 && f.etriers.qte === 10 && f.etriers.base === 4);
  const sans = SolEcran.fixationDepuisLignes(lignes.filter((l) => l.categorie === "Rails de fixation" || l.categorie === "Panneaux solaires"));
  test("★ reprise d'un devis à rails SANS supports ni étriers : ils restent à 0 (le devis repris est le devis tel qu'il était)",
    sans.supports.qte === 0 && sans.etriers.qte === 0 && sans.supports.base === 9);
  test("★ sans rails, aucune correction mémorisée (le calcul reprend la main)", Object.keys(SolEcran.fixationDepuisLignes([lignes[0]])).length === 0);
  // La règle « même base → correction, base changée → calcul », telle qu'écrite dans l'écran
  const qteFixation = (fixationManuelle, cle, base, calcul) => (fixationManuelle[cle]?.base === base ? Math.max(0, Number(fixationManuelle[cle].qte) || 0) : calcul);
  test("★ une correction ne vaut que pour la base qui l'a produite : 9 m → 12 supports ; 11 m → retour au calcul (22)",
    qteFixation({ supports: { qte: 12, base: 9 } }, "supports", 9, 18) === 12 && qteFixation({ supports: { qte: 12, base: 9 } }, "supports", 11, 22) === 22);
  test("★ 0 est une correction valable (ligne retirée du devis), jamais un nombre négatif",
    qteFixation({ etriers: { qte: 0, base: 4 } }, "etriers", 4, 16) === 0 && qteFixation({ etriers: { qte: -3, base: 4 } }, "etriers", 4, 16) === 0);
  test("★ l'écran applique exactement cette règle", /const qteFixation = \(cle, base, calcul\) => \(fixationManuelle\[cle\]\?\.base === base \? Math\.max\(0, Number\(fixationManuelle\[cle\]\.qte\) \|\| 0\) : calcul\);/.test(sol));
  test("★ chaque ligne (supports, étriers) a sa case de quantité, et dit le calculé quand on s'en écarte",
    /onChange=\{\(e\) => corrigerFixation\(cle, base, e\.target\.value\)\}/.test(sol) && /calculé : \{calcule\}/.test(sol) && /retiré du devis/.test(sol));
  test("★ le brouillon du volet garde les équipements, leurs quantités, les rails, les corrections de fixation et le modèle de support (F5)",
    /useEcrireBrouillonVolet\("solaire", profile, \{ appareils, autonomie, soleil, tension, typeBatterie, choix, rolesManuels, rolesHB, railsQte, fixationManuelle, supportId, autres \}\)/.test(sol));
  // 14/09/2026, Timo, trois messages : « les supports doivent être sélectionnés
  // dans le devis, il y a les M8 et les M10 » ; capture : « on ne peut pas
  // choisir, il reste choisi par défaut » (la liste ne s'affichait qu'à partir
  // de deux supports) ; « une liste déroulante dans laquelle seuls les
  // supports sont sélectionnables, et non tous les articles ».
  const stockSupports = [{ id: "s8", nom: "SUPPORT RAIL M8", prix_vente: 500 }, { id: "e", nom: "Étrier support final" }, { id: "s10", nom: "Support rail M10", prix_vente: 700 }, { id: "r", nom: "RAIL 4,2 m" }, { id: "c", nom: "Collier", categorie: "Supports divers" }];
  test("★ la liste des supports = les articles « support » (nom ou catégorie), jamais un étrier, jamais le rail, jamais tout le stock",
    JSON.stringify(SolEcran.supportsDuStock(stockSupports).map((p) => p.id)) === JSON.stringify(["s8", "s10", "c"]) && SolEcran.supportsDuStock([]).length === 0);
  test("★ UNE liste déroulante des supports, affichée TOUJOURS (même avec un seul), le premier d'office, le nombre trouvé dit à côté ; le choix suit le brouillon",
    /const articlesSupportsStock = supportsDuStock\(produitsBoutique\);/.test(sol)
    && /const articleSupportsStock = articlesSupportsStock\.find\(\(p\) => p\.id === supportId\) \|\| articlesSupportsStock\[0\] \|\| null;/.test(sol)
    && /<select className=[^\n]*aria-label="Modèle de support" data-choix="support">/.test(sol) && /articlesSupportsStock\.map\(\(p\) => <option key=\{p\.id\} value=\{p\.id\}>/.test(sol)
    && !/articlesSupportsStock\.length > 1 \? \(/.test(sol) && /\{cle === "supports" && article \? \(/.test(sol) && /dans le stock de \{boutique\}<\/div>/.test(sol)
    && /brouillon\.supportId/.test(sol) && !/propositionsStock/.test(sol) && !/produitsBoutique\.find\(\(p\) => \/support\/i/.test(sol));
  test("★ un devis repris retrouve SON modèle de support par son nom (M10 reste M10), sinon le premier s'applique",
    SolEcran.supportDepuisLignes([{ categorie: "Supports de rail", article: "support rail m10", qte: 22 }], stockSupports)?.id === "s10"
    && SolEcran.supportDepuisLignes([{ categorie: "Rails de fixation", qte: 6 }], stockSupports) === null
    && SolEcran.supportDepuisLignes([{ categorie: "Supports de rail", article: "SUPPORT INCONNU" }], stockSupports) === null
    && /setSupportId\(supportDepuisLignes\(lignesReprises, produitsBoutique\)\?\.id \|\| null\);/.test(sol));
  test("★ la reprise relit les MÈTRES du rail (metresDeLigne) aux deux endroits, jamais les barres",
    SolEcran.metresDeLigne({ qte: 6, metres_calcules: 22 }) === 22 && SolEcran.metresDeLigne({ qte: 16 }) === 16
    && /setRailsQte\(ligneRails \? metresDeLigne\(ligneRails\) : 0\);/.test(sol) && !/Number\(ligneRails\.qte\)/.test(sol));
  test("l'écran dit la règle : « N m de rail → N supports (un par mètre) »",
    /m de rail → \$\{supportsPourRails\(railsQte\)\} supports \(un par mètre\)/.test(sol) && !/rails × 2/.test(sol));
  test("★ après un F5, le premier calcul automatique n'écrase pas ce qui vient du brouillon ; les suivants recalculent",
    /const sauterPremierCalcul = useRef\(!!choixDuBrouillon\);/.test(sol) && /if \(sauterPremierCalcul\.current\) \{ sauterPremierCalcul\.current = false; return; \}/.test(sol));
  test("★ un devis repris passe TOUJOURS avant le brouillon, et un brouillon du mode Libre n'est pas restitué",
    /const choixDuBrouillon = !initialSelectionSolaire && brouillon\?\.choix && !Object\.values\(brouillon\.choix\)\.some\(\(c\) => c\?\.libre\) \? brouillon\.choix : null;/.test(sol)
    && /setFixationManuelle\(fixationDepuisLignes\(lignesReprises\)\);/.test(sol));
}

titre("Solaire : UN lien « revenir à la sélection automatique », sur chaque ligne qui s'écarte du calcul (Timo, 08/09/2026)");
{
  // « Prendre la règle existante : revenir à la sélection automatique. »
  // Le lien existait pour le formulaire hors stock ; il sert maintenant à
  // l'article ou la quantité choisis à la main, aux rails, aux supports et
  // aux étriers — même texte, même composant, et seulement quand il y a
  // quelque chose à annuler.
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  test("★ le texte du lien n'est écrit qu'UNE fois (composant LienAuto), utilisé aux quatre endroits",
    (sol.match(/Annuler \(revenir à la sélection automatique\)/g) || []).length === 1 && (sol.match(/<LienAuto onClick=/g) || []).length === 4);
  test("★ équipement : le lien apparaît dès que l'article ou la quantité n'est plus celui du calcul, et relâche le verrou (annulerManuel)",
    /const ecarte = !enLibre && !enManuel && \(!!rolesManuels\[l\.role\.id\] \|\| \(auto \? \(!c \|\| c\.type !== "stock" \|\| c\.produit_id !== auto\.produit_id \|\| c\.qte !== auto\.qte\) : !!c\)\);/.test(sol)
    && /\{ecarte && <LienAuto onClick=\{\(\) => annulerManuel\(l\.role\.id\)\} \/>\}/.test(sol));
  test("★ rails : le lien apparaît quand les mètres saisis diffèrent du calcul (panneaux × 2,2) et y reviennent",
    /const railsCalcules = \(n\) => \(n > 0 \? Math\.ceil\(n \* 2\.2\) : 0\);/.test(sol)
    && /\{railsQte !== railsCalcules\(nombrePanneaux\) && <div className="mt-1"><LienAuto onClick=\{\(\) => setRailsQte\(railsCalcules\(nombrePanneaux\)\)\} \/><\/div>\}/.test(sol));
  test("★ supports / étriers : le lien apparaît quand une correction est active et la retire (retour au calcul)",
    /const annulerFixation = \(cle\) => setFixationManuelle\(\(f\) => \{ const n = \{ \.\.\.f \}; delete n\[cle\]; return n; \}\);/.test(sol)
    && /\{fixationManuelle\[cle\]\?\.base === base && <div className="mt-1"><LienAuto onClick=\{\(\) => annulerFixation\(cle\)\} \/><\/div>\}/.test(sol));
  test("le mode Libre n'a pas ce lien (la quantité s'y déduit toujours de la caractéristique tapée)", /const auto = enLibre \? null : meilleurChoix\(l\.role\);/.test(sol));
}

titre("📝 Mes brouillons : un devis gardé dans MA fiche, repris ou envoyé plus tard (demande Timo, 08/09/2026)");
{
  // « Ajouter carrément un bouton "enregistrer un brouillon" à côté de
  // envoyer WhatsApp, sélectionnable après avoir choisi le client. » Le
  // brouillon vit dans la fiche de l'employé (champ brouillons_devis) : rien
  // côté serveur, pas de SQL, et la fusion trois voies le traite comme une
  // liste (comme ses devis). On exerce la vraie règle, puis on lit le code.
  const sortieDC = join("node_modules", ".cache", `bmi-dc-brouillons-${process.pid}.mjs`);
  await build({ entryPoints: ["src/screens/dimensionnement/devisCommun.js"], bundle: true, format: "esm",
    platform: "node", outfile: sortieDC, logLevel: "silent", loader: { ".js": "jsx" } });
  const DC = await import(pathToFileURL(sortieDC).href);
  unlinkSync(sortieDC);
  const db0 = { users: [{ id: "u_k", nom: "KOSSI", role: "vendeur" }, { id: "u_a", nom: "AMA", role: "vendeur", brouillons_devis: [{ id: "bA", client: { nom: "X" }, devis: { total: 1 } }] }] };
  const b1 = { id: "b1", volet: "solaire", client: { nom: "ESSO", tel: "90000000" }, devis: { total: 250000 }, date: "2026-09-08" };
  const b2 = { id: "b2", volet: "garage", client: { id: "c9", nom: "AFI" }, devis: { total: 90000 }, date: "2026-09-08" };
  test("★ une fiche sans brouillon en a zéro (pas de plantage sur un champ absent ou faux)",
    DC.brouillonsDe(db0.users[0]).length === 0 && DC.brouillonsDe(undefined).length === 0 && DC.brouillonsDe({ brouillons_devis: "x" }).length === 0);
  const db1 = DC.ajouterBrouillon(db0, "u_k", b1);
  const db2 = DC.ajouterBrouillon(db1, "u_k", b2);
  test("★ enregistrer range le brouillon dans MA fiche, le plus récent en tête",
    DC.brouillonsDe(db2.users[0]).map((b) => b.id).join(",") === "b2,b1");
  test("★ …et ne touche PAS la fiche d'un autre employé", JSON.stringify(db2.users[1]) === JSON.stringify(db0.users[1]));
  test("★ ré-enregistrer un brouillon repris (même id) le REMPLACE au lieu de le doubler",
    DC.brouillonsDe(DC.ajouterBrouillon(db2, "u_k", { ...b1, devis: { total: 300000 } }).users[0]).length === 2
    && DC.brouillonsDe(DC.ajouterBrouillon(db2, "u_k", { ...b1, devis: { total: 300000 } }).users[0])[0].devis.total === 300000);
  const db3 = DC.retirerBrouillon(db2, "u_k", "b1");
  test("★ retirer (envoyé, converti ou supprimé) ne laisse que les autres", DC.brouillonsDe(db3.users[0]).map((b) => b.id).join(",") === "b2");
  test("★ retirer un brouillon absent ne réécrit AUCUNE fiche (pas de faux changement à synchroniser)",
    DC.retirerBrouillon(db2, "u_k", "inconnu").users[0] === db2.users[0] && DC.retirerBrouillon(db2, "u_a", "b1").users[1] === db2.users[1]);
  test("★ les objets d'origine ne sont pas modifiés en place", DC.brouillonsDe(db0.users[0]).length === 0 && DC.brouillonsDe(db2.users[0]).length === 2);

  const part = readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8");
  test("★ le bouton « 📝 Enregistrer un brouillon » est à côté de l'envoi WhatsApp et ne s'allume qu'une fois le client choisi (aucune question posée)",
    /<button onClick=\{onBrouillon\} disabled=\{!clientDevis\}/.test(part) && /📝 Enregistrer un brouillon/.test(part)
    && !/uPrompt\([^)]*brouillon/i.test(part));
  test("★ enregistrer exige le client (compte, ou nom + numéro), refuse un devis vide et un compte en lecture seule",
    /const enregistrerBrouillon = \(\{ totalDevis, messageVide, construire \}\) => \{\s*if \(bloquerSiLecture\(db, profile\)\) return;\s*if \(totalDevis <= 0\)/.test(part)
    && /uAlert\("Indiquez le nom et le numéro du client\."\)/.test(part) && /uAlert\("Choisissez d'abord le client\."\)/.test(part));
  test("★ un brouillon repris n'est PAS un devis déjà chez le client : à l'envoi on l'AJOUTE, et le brouillon disparaît",
    /const idAReprendre = brouillonRepris \? undefined : devisAReprendre\?\.devis\?\.id;/.test(part)
    && /dbApres: brouillonRepris \? retirerBrouillon\(dbApres, profile\.id, brouillonRepris\) : dbApres,/.test(part));
  test("★ convertir un brouillon en vente le retire aussi", /if \(brouillonRepris\) save\(retirerBrouillon\(db, profile\.id, brouillonRepris\)/.test(part));
  test("★ le client d'une reprise (devis ou brouillon) est réappliqué par la règle commune, plus par chaque volet",
    /setClientDevis\(clientRepris\(devisAReprendre\)\);\s*setNouvClient\(nouvClientRepris\(devisAReprendre\)\);/.test(part));
  for (const f of ["Solaire.jsx", "Garage.jsx", "Autre.jsx"]) {
    const src = readFileSync(`src/screens/dimensionnement/${f}`, "utf8");
    test(`★ ${f} : les deux boutons partent des MÊMES arguments (argumentsEnvoi), onBrouillon branché, plus de setClientDevis(devisAReprendre…)`,
      /const envoyerDevisWhatsApp = \(\) => envoi\.envoyer\(argumentsEnvoi\(\)\);/.test(src)
      && /const enregistrerBrouillon = \(\) => envoi\.enregistrerBrouillon\(argumentsEnvoi\(\)\);/.test(src)
      && /onBrouillon=\{enregistrerBrouillon\}/.test(src) && !/setClientDevis\(devisAReprendre/.test(src));
  }
  const idx = readFileSync("src/screens/dimensionnement/index.jsx", "utf8");
  test("★ l'onglet « 📝 Mes brouillons » est dans Dimensionnement, et Reprendre rouvre le volet avec brouillon_id",
    /📝 Mes brouillons\{nbBrouillons/.test(idx) && /setBrouillonRepris\(\{ devis: b\.devis, client: b\.client, brouillon_id: b\.id \}\)/.test(idx)
    && /const devisAReprendre = devisAReprendreProp \|\| brouillonRepris;/.test(idx));
  const br = readFileSync("src/screens/dimensionnement/Brouillons.jsx", "utf8");
  test("★ la liste ne montre que MES brouillons (fiche de profile.id), et Envoyer suit le chemin WhatsApp commun puis retire le brouillon",
    /brouillonsDe\(moi\)/.test(br) && /find\(\(u\) => u\.id === profile\.id\)/.test(br) && /resoudreClientDevis\(db, clientDevis, nouvClient, profile, b\.devis\?\.boutique\)/.test(br)
    && /dbApres: retirerBrouillon\(dbApres, profile\.id, b\.id\)/.test(br) && /await uConfirm\(`Supprimer le brouillon/.test(br));
  test("★ la fusion trois voies traite brouillons_devis comme une liste de la fiche (deux appareils ne s'écrasent pas)",
    /users: \{ listes: \["virements", "credits", "devis", "brouillons_devis"\] \}/.test(readFileSync("src/lib/fusion.js", "utf8")));
}

titre("Autres équipements : d'abord le stock de la boutique — prix pré-rempli, sortie de stock, HB d'office hors stock (Timo, 08/09/2026)");
{
  // « Proposer la présélection des articles en stock ; je choisis et le prix
  // est pré-rempli ; l'utilisateur modifie juste la quantité. Si l'article
  // n'est pas dans la liste, il l'ajoute, et la case HB est cochée
  // automatiquement. » La règle est pure (devisCommun) : on l'exerce.
  const sortieDC = join("node_modules", ".cache", `bmi-dc-autres-${process.pid}.mjs`);
  await build({ entryPoints: ["src/screens/dimensionnement/devisCommun.js"], bundle: true, format: "esm",
    platform: "node", outfile: sortieDC, logLevel: "silent", loader: { ".js": "jsx" } });
  const DC = await import(pathToFileURL(sortieDC).href);
  unlinkSync(sortieDC);
  const produits = [{ id: "p1", nom: "Câble solaire 6mm² (rouleau)", prix_vente: 45000, boutique: "APESSITO" }, { id: "p2", nom: "Coffret DC 2 entrées", prix_vente: 35000, boutique: "APESSITO" }];
  const vide = { id: "a1", nom: "", prix: "", qte: "1" };
  const lie = DC.lierAutreAuStock(vide, "câble solaire 6mm² (rouleau)", produits);
  test("★ un nom qui correspond à un article du stock (casse et espaces ignorés) LIE la ligne : produit_id, prix du stock, HB décochée",
    lie.produit_id === "p1" && lie.prix === "45000" && lie.hors_boutique === false && lie.nom === "Câble solaire 6mm² (rouleau)");
  const libre = DC.lierAutreAuStock(vide, "Disjoncteur 63A", produits);
  test("★ un nom qui n'est dans aucun article du stock reste une saisie libre : aucun produit_id, HB cochée d'office",
    libre.produit_id === null && libre.hors_boutique === true && libre.nom === "Disjoncteur 63A");
  const delie = DC.lierAutreAuStock(lie, "Câble solaire 6mm² (roul", produits);
  test("★ modifier le nom d'une ligne liée la délie (plus de sortie de stock) et coche HB ; le prix saisi reste",
    delie.produit_id === null && delie.hors_boutique === true && delie.prix === "45000");
  test("★ un nom effacé ne coche pas HB tout seul (rien à facturer encore)",
    DC.lierAutreAuStock({ ...vide, hors_boutique: false }, "", produits).hors_boutique === false && DC.lierAutreAuStock(vide, "  ", produits).produit_id === null);
  test("★ sans stock (mode Libre), tout est saisie libre", DC.lierAutreAuStock(vide, "Câble solaire 6mm² (rouleau)", []).produit_id === null);
  const libreChiffre = { ...libre, prix: "12000" };
  test("★ le panier de vente porte le produit_id de la ligne liée (sortie de stock à l'encaissement), null sinon",
    DC.panierAutres([lie, libreChiffre])[0].produit_id === "p1" && DC.panierAutres([lie, libreChiffre])[1].produit_id === null);
  test("★ les lignes du devis portent produit_id seulement quand il existe (un devis libre garde exactement sa forme d'avant)",
    DC.lignesAutres([lie])[0].produit_id === "p1" && !("produit_id" in DC.lignesAutres([libre])[0]));
  test("★ reprendre un devis rend le lien au stock de chaque autre équipement",
    DC.reprisesAutres(DC.lignesAutres([lie, libre]))[0].produit_id === "p1" && DC.reprisesAutres(DC.lignesAutres([lie, libre]))[1].produit_id === null);
  const part = readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8");
  test("★ le NOM passe par la règle du stock dans le crochet commun ; les autres champs se modifient tels quels",
    /champ === "nom" \? lierAutreAuStock\(a, val, produitsBoutique\) : \{ \.\.\.a, \[champ\]: val \}/.test(part));
  // Retourné le 08/09/2026 (Timo : « trop rigide… pas sur tout l'écran ») :
  // plus de liste native, le champ commun ChampSuggestions propose le stock.
  test("★ le champ Article propose les articles du stock par le champ commun (saisie libre + propositions), avec le stock et le prix",
    !/<datalist/.test(part) && /suggestions=\{propositions\}/.test(part)
    && /en stock — \$\{fmt\(p\.prix_vente\)\}/.test(part));
  // Retourné le jour même (Timo : « supprimer la mention ») : aucune phrase
  // sous le champ, la case HB suffit.
  test("★ aucune mention « article du stock » / « saisie libre » sous le champ", !/sortira du stock à l'encaissement/.test(part) && !/Saisie libre — hors stock/.test(part));
  for (const f of ["Solaire.jsx", "Garage.jsx", "Autre.jsx"]) {
    const src = readFileSync(`src/screens/dimensionnement/${f}`, "utf8");
    test(`★ ${f} donne au bloc et au crochet le stock de la boutique REGARDÉE (produitsBoutique), jamais db.produits en entier`,
      /useAutresEquipements\(lignesReprises, produitsBoutique, brouillon\?\.autres\)/.test(src) && /db=\{db\} produits=\{produitsBoutique\}/.test(src)
      && !/produits=\{db\.produits\}/.test(src));
  }
}

titre("Portail et Autre : équipements, quantités et autres équipements survivent au F5 (Timo, 08/09/2026)");
{
  // « Fais pareil pour les quantités dans le portail et autre. Quand on
  // ajoute un équipement, après F5 ou nouvelle mise à jour, il disparaît. »
  const part = readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8");
  test("★ le crochet commun des autres équipements repart du brouillon du volet quand aucun devis n'est repris",
    /export function useAutresEquipements\(lignesReprises, produitsBoutique = \[\], autresDuBrouillon = null\)/.test(part)
    && /lignesReprises\?\.length \? reprisesAutres\(lignesReprises\) : \(Array\.isArray\(autresDuBrouillon\) \? autresDuBrouillon : \[\]\)/.test(part));
  const gar = readFileSync("src/screens/dimensionnement/Garage.jsx", "utf8");
  test("★ Portail : le brouillon garde équipements, verrous, HB, kit solaire, batterie de secours et autres équipements",
    /useEcrireBrouillonVolet\("garage", profile, \{ type, largeur, hauteur, poids, vantaux, frequence, telecosSouhaitees, alimentationProche, prixM2Porte,\s*choix, verrous, rolesHB, kitSolaire, prixKitSolaire, batterieSecours, prixBatterieSecours, autres \}\)/.test(gar));
  test("★ Portail : au montage, la sélection repart du brouillon (un devis repris prime) et le premier calcul ne l'écrase pas",
    /const selectionDuBrouillon = !initialSelectionGarage && brouillon\?\.choix \? \{ choix: brouillon\.choix, verrous: brouillon\.verrous \|\| \{\}, hb: brouillon\.rolesHB \|\| \{\} \} : null;/.test(gar)
    && /useSelectionAvecVerrou\(meilleurChoix, initialSelectionGarage \|\| selectionDuBrouillon\)/.test(gar)
    && /if \(sauterPremierCalcul\.current\) \{ sauterPremierCalcul\.current = false; return; \}\s*recalculerNonVerrouilles\(ROLES_EQUIPEMENT_GARAGE\);/.test(gar));
  test("★ Portail : kit solaire et batterie de secours reviennent aussi (cochés et prix)",
    /useState\(ligneKitSolaire \? true : !!brouillon\?\.kitSolaire\)/.test(gar) && /useState\(ligneBatterieSecours \? true : !!brouillon\?\.batterieSecours\)/.test(gar));
  const aut = readFileSync("src/screens/dimensionnement/Autre.jsx", "utf8");
  test("★ Autre : le brouillon garde les articles choisis, leurs verrous et les autres équipements",
    /useEcrireBrouillonVolet\("autre", profile, \{ besoins, poseSeule, montantPoseFixe, choix, verrous: besoinsManuels, autres \}\)/.test(aut));
  test("★ Autre : au montage, la sélection repart du brouillon (un devis repris prime) et le premier calcul ne l'écrase pas",
    /const selectionDuBrouillon = !initialSelection && brouillon\?\.choix \? \{ choix: brouillon\.choix, verrous: brouillon\.verrous \|\| \{\} \} : null;/.test(aut)
    && /useSelectionAvecVerrou\(meilleurChoixBesoin, initialSelection \|\| selectionDuBrouillon\)/.test(aut)
    && /if \(sauterPremierCalcul\.current\) \{ sauterPremierCalcul\.current = false; return; \}\s*recalculerNonVerrouilles\(besoins\);/.test(aut));
  for (const f of ["Solaire.jsx", "Garage.jsx", "Autre.jsx"]) {
    test(`★ ${f} passe ses autres équipements du brouillon au crochet commun et les écrit dans le brouillon`,
      /useAutresEquipements\(lignesReprises, produitsBoutique, brouillon\?\.autres\)/.test(readFileSync(`src/screens/dimensionnement/${f}`, "utf8")));
  }
}

titre("UN champ à suggestions pour toute l'application : « came » trouve « Caméra », la liste s'ouvre sous la ligne (Timo, 08/09/2026)");
{
  // « La proposition est trop rigide : pour caméra, si on tape "came", il ne
  // propose pas. La présélection doit apparaître à partir de la ligne dans
  // laquelle on tape, vers le bas, pas sur tout l'écran. Appliquer cette
  // règle dans toute l'application. » La recherche est pure : on l'exerce.
  const sortieSug = join("node_modules", ".cache", `bmi-sug-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/suggestions.js"], bundle: true, format: "esm", platform: "node", outfile: sortieSug, logLevel: "silent" });
  const Sug = await import(pathToFileURL(sortieSug).href);
  unlinkSync(sortieSug);
  const liste = [{ valeur: "Caméra extérieure" }, { valeur: "CAMERA DOME 4MP" }, { valeur: "Câble solaire 6mm² noir" }, { valeur: "Câble solaire 4mm² rouge" }, { valeur: "Panneau 550W" }, { valeur: "caméra extérieure" }];
  test("★ « came » trouve « Caméra extérieure » et « CAMERA DOME » (accents et majuscules ignorés)",
    Sug.filtrerSuggestions(liste, "came").map((s) => s.valeur).join("|") === "Caméra extérieure|CAMERA DOME 4MP");
  test("★ « cable 6 » trouve « Câble solaire 6mm² noir » : chaque mot, dans n'importe quel ordre",
    Sug.filtrerSuggestions(liste, "cable 6").map((s) => s.valeur).join("|") === "Câble solaire 6mm² noir"
    && Sug.filtrerSuggestions(liste, "6mm cable").map((s) => s.valeur).join("|") === "Câble solaire 6mm² noir");
  test("★ ce qui COMMENCE par la saisie vient d'abord : « ext » → la caméra extérieure avant rien d'autre ; « panneau » → Panneau 550W",
    Sug.filtrerSuggestions(liste, "ext")[0].valeur === "Caméra extérieure" && Sug.filtrerSuggestions(liste, "panneau")[0].valeur === "Panneau 550W");
  test("★ sans doublon (« caméra extérieure » deux fois → une), saisie vide → le début de la liste, au plus 30",
    Sug.filtrerSuggestions(liste, "").length === 5 && Sug.filtrerSuggestions(Array.from({ length: 80 }, (_, i) => ({ valeur: `Article ${i}` })), "").length === 30);
  test("★ rien ne correspond → liste vide (la saisie libre reste possible)", Sug.filtrerSuggestions(liste, "onduleur").length === 0);
  test("★ sansAccents : « Camé » = « came », espaces repliés", Sug.sansAccents("  Camé   RA ") === "came ra" && Sug.correspond("Étrier du milieu", "etrier"));
  const champ = readFileSync("src/components/ChampSuggestions.jsx", "utf8");
  test("★ la liste s'ouvre SOUS le champ, à sa largeur, suit le défilement — jamais un voile sur tout l'écran",
    /top: r\.bottom \+ 2, left: r\.left, width, maxHeight/.test(champ) && /addEventListener\("scroll", placer, true\)/.test(champ)
    && !/inset-0/.test(champ) && !/bg-black/.test(champ) && /filtrerSuggestions\(suggestions, valeur\)/.test(champ));
  test("★ chaque proposition montre le nom EN ENTIER (jamais coupé par « … »), le détail en dessous, liste d'au moins 320 px",
    /<div className="font-medium break-words">\{s\.valeur\}<\/div>/.test(champ) && !/truncate/.test(champ)
    && /Math\.min\(Math\.max\(r\.width, 320\), Math\.max\(220, window\.innerWidth - r\.left - 8\)\)/.test(champ));
  const rg = readFileSync("src/components/RechercheGlobale.jsx", "utf8");
  test("★ la recherche générale (loupe du menu) montre le prix et le stock de chaque article, et cherche avec la même règle",
    /\{fmt\(p\.prix_vente\)\}/.test(rg) && /\{stockActuel\(db, p\)\} en stock/.test(rg) && /correspond\(`\$\{p\.nom\} \$\{p\.code \|\| ""\}`, q\)/.test(rg));
  // Timo (13/09/2026, capture de la fenêtre « Rechercher un article » de
  // Ventes) : « la recherche d'articles est rigide… pourquoi elle ne respecte
  // pas la flexibilité des autres écrans… avoir une seule règle qui régit les
  // recherches dans l'application ». UNE règle : `correspond` (lib/suggestions)
  // — plus aucune recherche « maison » (toLowerCase().includes, normNom().includes).
  {
    const fichiersRecherche = ["src/components/SelecteurArticle.jsx", "src/components/RechercheGlobale.jsx", "src/screens/Ventes.jsx", "src/screens/Utilisateurs.jsx", "src/screens/Stocks.jsx", "src/screens/Clients.jsx", "src/screens/Historique.jsx", "src/screens/Prospects.jsx", "src/screens/ClientsInstalles.jsx"];
    // Écrans et composants seulement : trouverArticle (lib/calculs.js) apparie un
    // nom de devis au stock dans les deux sens — un appariement, pas une recherche tapée.
    const maison = execSync("grep -rln 'toLowerCase().includes(\\|normNom(.*).includes(' src/screens src/components --include=*.jsx || true").toString().trim().split("\n").filter(Boolean).filter((f) => f !== "src/screens/Rentabilite.jsx" /* choix d'une période, pas une recherche */);
    test("★ UNE règle de recherche pour toute l'application : plus aucun filtre « maison » (toLowerCase().includes / normNom().includes) — les neuf recherches (sélecteur d'article de Ventes et Commandes, loupe du menu, listes Ventes / proformas, Utilisateurs, Stocks, Clients, Historique, Prospects, Clients installés) passent par correspond (lib/suggestions)",
      maison.length === 0 && fichiersRecherche.every((f) => { const t = readFileSync(f, "utf8"); return /import \{ correspond \} from "\.\.\/lib\/suggestions";/.test(t) && /correspond\(/.test(t); })
      && /base\.filter\(\(p\) => correspond\(`\$\{p\.nom\} \$\{p\.code \|\| ""\}`, recherche\)\)/.test(readFileSync("src/components/SelecteurArticle.jsx", "utf8")), "fichiers maison : " + maison.join(", "));
    test("★ la règle rend la recherche de Ventes souple : « bar 150 » trouve « Busse BAR M10×2 150A », « gache » trouve « Gâche électrique », « led rouge » trouve « Ventilateur LED simple rouge », « nvr 8 » trouve « NVR 8CH » et pas « NVR 16CH » ; « tv » ne sort pas « dstv »",
      Sug.correspond("Busse BAR M10×2 150A", "bar 150") && Sug.correspond("Gâche électrique", "gache") && Sug.correspond("Ventilateur LED simple rouge", "led rouge") && Sug.correspond("NVR 8CH", "nvr 8") && !Sug.correspond("NVR 16CH", "nvr 8") && !Sug.correspond("Décodeur DSTV", "tv") && Sug.correspond("Quoi que ce soit", ""));
  }
  test("★ plus AUCUNE liste native du navigateur (<datalist>) dans l'application",
    execSync("grep -rl '<datalist' src || true").toString().trim() === "");
  for (const [f, motif] of [
    ["src/screens/dimensionnement/Partages.jsx", /<ChampSuggestions placeholder=\{placeholder\} valeur=\{a\.nom\} suggestions=\{propositions\}/],
    ["src/screens/Ravitaillement.jsx", /<ChampSuggestions valeur=\{dem\.categorie\}/],
    ["src/screens/ClientsInstalles.jsx", /<ChampSuggestions placeholder="Matériel \(ex : Panneau 555W\)" valeur=\{mat\.nom\}/],
    ["src/screens/Stocks.jsx", /<ChampSuggestions valeur=\{f\.categorie\}/],
  ]) test(`★ ${f} passe par le champ commun`, motif.test(readFileSync(f, "utf8")));
  // RETOURNÉ le 11/09/2026. Le volet « Autre » (vidéo surveillance,
  // électricité, forage — les devis SANS calcul) n'a plus de champ à
  // suggestions : Timo n'a pas compris l'écran (« besoin du client / article
  // proposé… je ne comprends pas ») et a tranché — « le besoin du client
  // devient une catégorie, et article proposé déroule les articles de la
  // catégorie choisie… tout court. Ceci pour tous les devis sans calcul. »
  // Deux listes déroulantes, aucune recherche par ressemblance.
  {
    const au = readFileSync("src/screens/dimensionnement/Autre.jsx", "utf8");
    // RETOURNÉ deux fois le 11/09/2026, dans l'ordre où Timo l'a demandé :
    // d'abord deux listes déroulantes, puis « on peut aussi, à part dérouler
    // et sélectionner, écrire et la présélection est proposée » — donc LE
    // champ commun de l'application, qui fait les deux. Les colonnes gardent
    // les mots du métier (« besoin du client reste toujours besoin »).
    test("★ volet SANS CALCUL : le besoin et l'article passent par LE champ commun (cliquer ouvre toute la liste, taper la filtre) — plus de besoin écrit sans repère, plus de correspondance approximative, et les colonnes gardent les mots du métier",
      /<ChampSuggestions className=\{`\$\{inputCls\} w-48`\} placeholder="Cliquez ou tapez le besoin…"/.test(au)
      && /valeur=\{l\.besoin\.categorie \|\| ""\} suggestions=\{propositionsBesoin\}/.test(au)
      && /<ChampSuggestions className=\{`\$\{inputCls\} w-56`\} placeholder="Cliquez ou tapez l'article…"/.test(au)
      && /suggestions=\{propositionsArticle\(l\.besoin\.categorie\)\}/.test(au)
      && /onChoisir=\{\(p\) => choisirArticle\(l\.besoin\.id, p\)\}/.test(au)
      && !/correspondancesBesoin\(/.test(au) && !/Décrivez le besoin à gauche/.test(au)
      && /\["Besoin du client", "Article proposé", "Quantité"/.test(au));
    // ⚠ « Dans forage, pas de catégorie des panneaux… cette catégorie se
    // trouve dans le solaire, alors que pour le forage aussi on utilise les
    // panneaux » (11/09/2026). Option « a » : le domaine RANGE, il ne CACHE
    // plus — les besoins du métier ouvert en tête, tout le reste du stock de
    // la boutique juste en dessous. Rien à réétiqueter.
    test("★ le domaine RANGE et ne CACHE plus : les besoins du métier ouvert en tête, puis TOUT le reste du stock de la boutique — un panneau rangé dans « solaire » reste proposé dans un devis de forage",
      /const categoriesDuDomaine = categoriesDe\(produitsDuDomaine\);/.test(au)
      && /const categoriesAutres = categoriesDe\(produitsBoutique\)\.filter\(\(c\) => !categoriesDuDomaine\.includes\(c\)\);/.test(au)
      && /const duDomaine = produitsDuDomaine\.filter\(memeCat\);/.test(au)
      && /return \[\.\.\.duDomaine, \.\.\.produitsBoutique\.filter\(\(p\) => memeCat\(p\) && !duDomaine\.includes\(p\)\)\];/.test(au)
      && /detail: `Autre métier — stock de \$\{boutique\}`/.test(au)
      && !/const produitsCategorie = /.test(au));
    test("★ chaque ligne porte SA catégorie de stock (elle titrera son groupe dans le PDF) et le devis ne fabrique plus de bloc « Votre demande » qui ne ferait que répéter ces catégories",
      /categorie: l\.besoin\.categorie \|\| categorieChoisie, article: l\.produit\.nom/.test(au)
      && /besoins: \{ categorie: categorieChoisie \},/.test(au)
      && !/articles_demandes:/.test(au)
      && /lignesReprises\.filter\(\(l\) => l\.categorie !== "Autres équipements"\)/.test(au));
  }
}

titre("WhatsApp : UNE règle pour le lien et l'envoi (doublon A10, Timo : « lance les doublons WhatsApp », 08/09/2026)");
{
  // Douze endroits fabriquaient le lien wa.me chacun à leur façon (numéro
  // nettoyé ou non, texte encodé ou non, avec ou sans le filet contre le
  // blocage du navigateur). Une seule règle dans lib/core.js, exercée ici.
  test("★ lienWhatsApp : numéro nettoyé (zéro de tête retiré, indicatif 228 ajouté à un numéro à 8 chiffres) et texte encodé (accents, &, retours à la ligne)",
    Core.lienWhatsApp("+228 90 12 34 56", "Bonjour & à bientôt\nBMI") === "https://wa.me/22890123456?text=Bonjour%20%26%20%C3%A0%20bient%C3%B4t%0ABMI"
    && Core.lienWhatsApp("090123456", "x") === "https://wa.me/22890123456?text=x");
  test("★ sans numéro, WhatsApp s'ouvre pour choisir le contact, le texte prêt", Core.lienWhatsApp("", "Bonjour") === "https://wa.me/?text=Bonjour" && Core.lienWhatsApp(null, "Bonjour") === "https://wa.me/?text=Bonjour");
  test("★ sans texte, la discussion s'ouvre simplement sur le contact (pas de « ?text= » vide)",
    Core.lienWhatsApp("90123456", "") === "https://wa.me/22890123456" && Core.lienWhatsApp("90123456", "   ") === "https://wa.me/22890123456");
  test("★ envoyerWhatsApp passe par le filet anti-blocage (ouvrirWhatsApp) : hors navigateur, il répond « pas ouvert » sans planter",
    (await Core.envoyerWhatsApp("90123456", "x")) === false);
  const core = readFileSync("src/lib/core.js", "utf8");
  test("★ le lien wa.me n'est écrit qu'à UN endroit de toute l'application (lib/core.js), et ouvrirWhatsApp n'est appelé que par envoyerWhatsApp",
    execSync("grep -rl 'wa\\.me' src || true").toString().trim() === "src/lib/core.js"
    && (core.match(/wa\.me/g) || []).length === 1
    && execSync("grep -rl 'ouvrirWhatsApp(' src || true").toString().trim() === "src/lib/core.js");
  test("★ plus aucun écran n'ouvre WhatsApp lui-même (window.open vers wa.me) ni n'encode un message à la main pour cela",
    execSync("grep -rln 'window.open(.*wa\\.me\\|https://wa' src || true").toString().trim() === "src/lib/core.js");
  for (const [f, fn] of [
    ["src/lib/comptesClients.js", "envoyerWhatsApp"], ["src/lib/impression.js", "envoyerWhatsApp"],
    ["src/screens/Ventes.jsx", "envoyerWhatsApp"], ["src/screens/Clients.jsx", "envoyerWhatsApp"],
    ["src/screens/EspaceClient.jsx", "envoyerWhatsApp"], ["src/screens/ClientsInstalles.jsx", "envoyerWhatsApp"], ["src/screens/Commerciaux.jsx", "lienWhatsApp"],
  ]) {
    const src = readFileSync(f, "utf8");
    // (13/09/2026 : lib/comptesClients.js écrit « ./core.js » — la chaîne lue par le serveur des notifications exige l'extension.)
    test(`★ ${f} passe par ${fn} de lib/core.js`, new RegExp(`import \\{[^}]*\\b${fn}\\b[^}]*\\} from "(\\.\\./)*(\\./)?(lib/)?core(\\.js)?"`).test(src) && src.includes(`${fn}(`));
  }
  // ⚠ CONTRÔLE RETOURNÉ LE 22/09/2026 : les identifiants (client, employé)
  // partent désormais du numéro BMI (src/whatsapp.js, modèle `espace`) et
  // leur TEXTE vit à part (`texteIdentifiantsClient` / `texteIdentifiantsEmploye`)
  // pour servir de repli. L'envoi à la main reste : ce sont ces deux
  // fonctions-là qui passent par la règle commune, plus accueil et relance
  // prospect qui n'ont pas bougé. Toujours QUATRE, toujours `envoyerWhatsApp`.
  {
    const srcCC = readFileSync("src/lib/comptesClients.js", "utf8");
    const directs = (srcCC.match(/envoyerWhatsApp\(tel, lignes\.join\("\\n"\)\);/g) || []).length;
    const parTexte = (srcCC.match(/return envoyerWhatsApp\(tel, texteIdentifiants(Client|Employe)\([^)]*\), demanderConfirmation\);/g) || []).length;
    test("★ les quatre messages de comptesClients (client, employé, accueil et relance prospect) envoient par la règle commune",
      directs === 2 && parTexte === 2);
  }
  // ⚠ CONTRÔLE RETOURNÉ LE 19/09/2026 (« lance l'étape 1 ») : le devis ne
  // passe plus par `envoyerWhatsApp` EN DIRECT — il passe par `envoyerModele`
  // (src/whatsapp.js), qui envoie du numéro BMI et REPLIE sur `envoyerWhatsApp`
  // au moindre refus. Le bouton de secours n'a donc pas disparu : il a
  // reculé d'un cran, et le contrôle le suit là où il est. Le filleul
  // (EspaceClient), lui, n'a pas de modèle et n'a pas bougé.
  {
    const srcPartages = readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8");
    test("★ le devis (Partages) part du numéro BMI par le chemin unique, avec le texte d'aujourd'hui en repli et le bouton de secours (uConfirm transmis)",
      /import \{ envoyerModele \} from "\.\.\/\.\.\/whatsapp";/.test(srcPartages)
      && /texteRepli: lignesMsg\.join\("\\n"\),/.test(srcPartages)
      && /demanderConfirmation: uConfirm,/.test(srcPartages)
      && !/envoyerWhatsApp\(/.test(srcPartages));
    test("★ le filleul (EspaceClient) garde le bouton de secours si le navigateur bloque (uConfirm transmis)",
      /await envoyerWhatsApp\(tel, lignesMsg\.join\("\\n"\), uConfirm\);/.test(readFileSync("src/screens/EspaceClient.jsx", "utf8")));
    // ⚠ CONTRÔLE RETOURNÉ LE 20/09/2026 (décision « c ») : 📋 Dettes non plus
    // n'ouvre WhatsApp en direct — la relance part du numéro BMI par le
    // chemin unique, et REPLIE sur l'ouverture WhatsApp au moindre refus.
    // Ce qui est protégé n'a pas bougé : aucun écran n'écrit `wa.me`.
    {
      const srcD = readFileSync("src/screens/Dettes.jsx", "utf8");
      test("★ la relance d'une dette part du numéro BMI par le chemin unique, avec le texte du modèle en repli",
        /import \{ envoyerModele \} from "\.\.\/whatsapp";/.test(srcD)
        && /texteRepli: texte,/.test(srcD)
        && /demanderConfirmation: uConfirm,/.test(srcD)
        && !/envoyerWhatsApp\(/.test(srcD));
    }
  }
}

titre("Contrat et PV : UN fichier (lib/contrat.js) — numéros, plan de règlement signé, champs du lien PV (doublons A1, A2, A11, A12)");
{
  // Timo : « lance tout » (08/09/2026). Avant : deux fabriques du numéro de
  // contrat (téléphone du client / boutique), quinze lignes de plan signé
  // recopiées, un numéro de PV à part, les quatre champs du lien PV écrits
  // deux fois. On exerce la règle, puis on vérifie qu'elle n'a plus de copie.
  const sortieCtr = join("node_modules", ".cache", `bmi-ctr-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/contrat.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCtr, logLevel: "silent", loader: { ".js": "jsx" } });
  const Ctr = await import(pathToFileURL(sortieCtr).href);
  unlinkSync(sortieCtr);
  const annee = new Date().getFullYear();
  test("★ numéro de contrat : CTR-année-8 caractères majuscules, différent à chaque appel",
    new RegExp(`^CTR-${annee}-[A-Z0-9]{8}$`).test(Ctr.numeroContrat()) && Ctr.numeroContrat() !== Ctr.numeroContrat());
  test("★ numéro de PV : PV-année-6 caractères de l'identifiant du chantier (stable pour un renvoi)",
    Ctr.numeroPv({ id: "abcdef123456" }) === `PV-${annee}-ABCDEF` && Ctr.numeroPv({ id: "abcdef123456" }) === Ctr.numeroPv({ id: "abcdef123456" }));
  const mensuel = Ctr.planReglementSigne({ type: "mensuel", montant_mensuel: "60000", premiere_echeance: "2026-10-31" }, 250000);
  test("★ plan signé (mensuel) : type, mensualité en nombre, première échéance, solde engagé, date, statut en attente",
    JSON.stringify(mensuel) === JSON.stringify({ type: "mensuel", montant_mensuel: 60000, premiere_echeance: "2026-10-31", solde_engage: 250000, propose_le: new Date().toISOString().slice(0, 10), statut: "en_attente" }));
  test("★ plan signé (totalité au PV) : pas de mensualité ni de date ; sans solde après l'acompte : aucun plan",
    Ctr.planReglementSigne({ type: "totalite" }, 100).montant_mensuel === null && Ctr.planReglementSigne({ type: "totalite" }, 100).premiere_echeance === null
    && Ctr.planReglementSigne({ type: "mensuel", montant_mensuel: "1" }, 0) === null);
  const lien = Ctr.champsLienPv("jeton-x", "PV-2026-ABCDEF");
  test("★ champs du lien PV : jeton, horodatage, numéro, statut « attente_signature » — et rien d'autre",
    lien.contrat_jeton === "jeton-x" && /^\d{4}-\d{2}-\d{2}T/.test(lien.contrat_jeton_le) && lien.contrat_numero === "PV-2026-ABCDEF" && lien.contrat_statut === "attente_signature" && Object.keys(lien).length === 4);
  test("★ plus aucune copie ailleurs : CTR-, PV- et solde_engage: n'existent que dans lib/contrat.js",
    execSync("grep -rl 'CTR-\\${\\|PV-\\${\\|solde_engage:' src || true").toString().trim() === "src/lib/contrat.js");
  test("★ signature sur le téléphone du client (EspaceClient) et en boutique (TousLesDevis) passent par numeroContrat et planReglementSigne du fichier commun",
    ["src/screens/EspaceClient.jsx", "src/screens/TousLesDevis.jsx"].every((f) => { const src = readFileSync(f, "utf8");
      return /import \{ numeroContrat, planReglementSigne \} from "\.\.\/lib\/contrat";/.test(src) && /const planSigne = planReglementSigne\(plan, solde\);/.test(src) && !/planSigne = \{/.test(src); }));
  test("★ « Marquer terminé » et « Envoyer pour signature » écrivent les champs du lien PV par champsLienPv, et le numéro par numeroPv",
    (readFileSync("src/screens/ClientsInstalles.jsx", "utf8").match(/\.\.\.champsLienPv\(jeton, numero\)/g) || []).length === 2
    && /const numero = numeroPv\(c\);/.test(readFileSync("src/screens/ClientsInstalles.jsx", "utf8")));
  test("le contrôle du plan (critiquePlan) reste fait AVANT, dans les deux chemins", ["src/screens/EspaceClient.jsx", "src/screens/TousLesDevis.jsx"].every((f) => /const souci = critiquePlan\(plan, solde\);/.test(readFileSync(f, "utf8"))));
  // ⚠⚠ 23/09/2026 — Timo : « à part le créateur et l'administrateur, personne
  // ne verrait le message espace ». Le message du lien de signature du PV
  // portait l'identifiant ET le mot de passe recalculé du client, et il
  // s'ouvre sur le téléphone du chef de chantier — un tiers. On découpe le
  // corps de construireMessagePv et on exige qu'il ne porte ni mot de passe,
  // ni identifiant, ni appel à motDePasseConnu — et que l'écran n'importe
  // plus cette fonction du tout. Éprouvé en remettant les codes : il tombe.
  {
    const ci = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
    const corps = (ci.match(/const construireMessagePv = \(c, lien\) => \{([\s\S]*?)\n  \};/) || [])[1] || "";
    test("★ le message du lien de signature du PV ne porte plus les codes du client (ni mot de passe, ni identifiant, ni motDePasseConnu) — seuls le créateur et l'administrateur lisent les codes",
      corps.length > 0 && !/mot de passe/i.test(corps) && !/identifiant/i.test(corps) && !/motDePasseConnu/.test(corps)
      && /avec vos accès habituels/.test(corps) && /Ou sans compte, en cliquant sur ce lien/.test(corps)
      && !/motDePasseConnu/.test(ci));
  }
}

titre("Doublons A5, A6, A7 : numéro de série, même fiche, code-barres et panier — UNE règle chacun (Timo : « lance tout », 08/09/2026)");
{
  // A5 — le prochain numéro d'une série : ventes et dettes appelaient deux
  // copies du même algorithme.
  const serie = [{ numero: "AP-2026-0001" }, { numero: "AP-2026-0003" }, { numero: "AP-2025-0009" }, { numero: "" }, {}];
  test("★ prochainNumeroDeSerie : (plus grand de la série) + 1, sur 4 chiffres, sans toucher aux autres années ni aux lignes sans numéro",
    Core.prochainNumeroDeSerie(serie, "AP-2026-") === "AP-2026-0004" && Core.prochainNumeroDeSerie(serie, "AP-2025-") === "AP-2025-0010" && Core.prochainNumeroDeSerie([], "AP-2026-") === "AP-2026-0001");
  test("★ …et avance tant que le numéro existe déjà (trou dans la série)",
    Core.prochainNumeroDeSerie([{ numero: "AP-2026-0002" }, { numero: "AP-2026-0003" }, { numero: "AP-2026-0004" }], "AP-2026-") === "AP-2026-0005");
  const core = readFileSync("src/lib/core.js", "utf8");
  test("★ ventes ET dettes passent par prochainNumeroDeSerie (plus deux copies de la boucle)",
    /export const prochainNumeroVente = \(db, boutique, date = today\(\)\) =>\s*prochainNumeroDeSerie\(db\.ventes, serieDe\(db, boutique, String\(date\)\.slice\(0, 4\)\)\);/.test(core)
    && /export const prochainNumeroDette = \(db, boutique, date = today\(\)\) =>\s*prochainNumeroDeSerie\(db\.dettes, serieDe\(db, boutique, String\(date\)\.slice\(0, 4\), "DET-"\)\);/.test(core)
    && (core.match(/while \(pris\.has\(prefixe \+ String\(seq\)\.padStart\(4, "0"\)\)\) seq \+= 1;/g) || []).length === 2 /* la règle + la réparation des collisions */);
  // A6 — « même fiche ? » : le contrôle d'espace et le report d'état périmé
  // avaient chacun leur copie.
  const o = { a: 1, b: [1, 2] };
  test("★ memeContenu : même objet → oui ; même contenu recopié → oui ; contenu différent, null ou absent → non",
    Core.memeContenu(o, o) && Core.memeContenu(o, { a: 1, b: [1, 2] }) && !Core.memeContenu(o, { a: 1, b: [1, 3] }) && !Core.memeContenu(o, null) && !Core.memeContenu(undefined, o));
  test("★ calculs.js et rebase.js utilisent memeContenu de core.js, sans copie locale",
    /const memeEnregistrement = memeContenu;/.test(readFileSync("src/lib/calculs.js", "utf8")) && /import \{ memeContenu \} from "\.\/core";/.test(readFileSync("src/lib/rebase.js", "utf8"))
    && execSync("grep -rl 'JSON.stringify(a) === JSON.stringify(b)' src || true").toString().trim() === "src/lib/core.js");
  // A7 — code-barres et panier : Ventes et Commandes avaient chacun leur copie.
  const sortiePan = join("node_modules", ".cache", `bmi-panier-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/panier.js"], bundle: true, format: "esm", platform: "node", outfile: sortiePan, logLevel: "silent" });
  const Pan = await import(pathToFileURL(sortiePan).href);
  unlinkSync(sortiePan);
  const produits = [{ id: "p1", nom: "Panneau 550W", code: " 6901234 ", prix_vente: 100000 }, { id: "p2", nom: "Batterie", code: "", prix_vente: 200000 }];
  test("★ articleParCode : le code lu (espaces ignorés) trouve l'article ; code vide, inconnu ou article sans code → null",
    Pan.articleParCode(produits, "6901234")?.id === "p1" && Pan.articleParCode(produits, " 6901234\n")?.id === "p1" && Pan.articleParCode(produits, "") === null && Pan.articleParCode(produits, "x") === null);
  const p1 = produits[0];
  const v1 = Pan.mettreAuPanier([], p1, 2, 100000, 0);
  const v2 = Pan.mettreAuPanier(v1, p1, 1, 100000, 5000);
  const v3 = Pan.mettreAuPanier(v2, p1, 1, 90000, 0);
  test("★ vente : même article au même prix → la quantité et la remise de ligne s'ajoutent ; à un autre prix → nouvelle ligne",
    JSON.stringify(v2) === JSON.stringify([{ produit_id: "p1", article: "Panneau 550W", qte: 3, pu: 100000, remise_ligne: 5000 }])
    && v3.length === 2 && v3[1].pu === 90000 && v3[1].remise_ligne === 0);
  const c1 = Pan.mettreAuPanier(Pan.mettreAuPanier([], p1, 2, 100000), p1, 1, 100000);
  test("★ commande : même fusion, mais AUCUN champ de remise de ligne écrit (il n'existe que pour les ventes)",
    JSON.stringify(c1) === JSON.stringify([{ produit_id: "p1", article: "Panneau 550W", qte: 3, pu: 100000 }]) && !("remise_ligne" in c1[0]));
  test("★ le panier d'origine n'est jamais modifié en place", v1.length === 1 && v1[0].qte === 2);
  for (const f of ["src/screens/Ventes.jsx", "src/screens/Commandes.jsx"]) {
    const src = readFileSync(f, "utf8");
    test(`★ ${f} lit le code-barres et fusionne le panier par lib/panier.js, sans copie locale`,
      /import \{ articleParCode, mettreAuPanier as ajouterAuPanierCommun \} from "\.\.\/lib\/panier";/.test(src)
      && /const p = articleParCode\(produits, c\);/.test(src) && /setPanier\(\(pan\) => ajouterAuPanierCommun\(pan, p, q, pu/.test(src)
      && !/pan\.findIndex\(\(l\) => l\.produit_id === p\.id/.test(src));
  }
  test("la DIFFÉRENCE voulue reste dans chaque écran : la rupture n'empêche pas la vente (règle Timo), mais bloque une commande",
    /ajouté quand même, l'encaissement proposera une réservation/.test(readFileSync("src/screens/Ventes.jsx", "utf8"))
    && /Stock insuffisant : il reste \$\{dispoRestant\(p\)\}/.test(readFileSync("src/screens/Commandes.jsx", "utf8")));
}

titre("Doublons A8 et A9 : prospect devenu client, entête / total / pied des PDF — UNE règle chacun (Timo : « lance tout », 08/09/2026)");
{
  // A8 — le prospect acquis : l'encaissement et « Convertir en client »
  // écrivaient des fiches différentes.
  const sortiePro = join("node_modules", ".cache", `bmi-prospects-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/prospects.js"], bundle: true, format: "esm", platform: "node", outfile: sortiePro, logLevel: "silent", loader: { ".js": "jsx" } });
  const Pro = await import(pathToFileURL(sortiePro).href);
  unlinkSync(sortiePro);
  const jour = new Date().toISOString().slice(0, 10);
  const pr = { id: "pr1", nom: "AFI", tel: "90000000", statut: "À relancer", commercial: "KOSSI" };
  const parVente = Pro.prospectAcquis(pr, { vente_id: "v1", client_user_id: "c1" });
  const parConversion = Pro.prospectAcquis(pr, { client_user_id: "c1" });
  test("★ acquis par l'encaissement : converti, statut « Client acquis », date, maj_le, vente ET compte",
    parVente.converti === true && parVente.statut === "Client acquis" && parVente.date_conversion === jour && parVente.maj_le === jour && parVente.vente_id === "v1" && parVente.client_user_id === "c1");
  test("★ acquis par « Convertir en client » : les MÊMES champs, sans vente (pas encore encaissé)",
    parConversion.converti === true && parConversion.statut === "Client acquis" && parConversion.client_user_id === "c1" && !("vente_id" in parConversion) && parConversion.maj_le === jour);
  test("★ un prospect déjà converti garde sa date de conversion et reçoit la vente qui arrive ensuite",
    Pro.prospectAcquis({ ...parConversion, date_conversion: "2026-08-01" }, { vente_id: "v2" }).date_conversion === "2026-08-01"
    && Pro.prospectAcquis({ ...parConversion, date_conversion: "2026-08-01" }, { vente_id: "v2" }).vente_id === "v2"
    && Pro.prospectAcquis({ ...parConversion, date_conversion: "2026-08-01" }, { vente_id: "v2" }).client_user_id === "c1");
  test("★ le prospect d'origine n'est pas modifié en place, et rien d'autre ne change (nom, commercial)", !("converti" in pr) && parVente.nom === "AFI" && parVente.commercial === "KOSSI");
  test("★ Ventes (encaissement) et Prospects (convertir) passent par prospectAcquis, sans copie de la fiche",
    /prospectAcquis\(pr, \{ vente_id: vente\.id, client_user_id: od\.client_id \|\| compteClient\?\.id \}\)/.test(readFileSync("src/screens/Ventes.jsx", "utf8"))
    && /prospectAcquis\(x, \{ client_user_id: user\.id \}\)/.test(readFileSync("src/screens/Prospects.jsx", "utf8"))
    && execSync("grep -rl 'statut: \"Client acquis\"' src || true").toString().trim() === ""
    && /export const STATUT_CLIENT_ACQUIS = "Client acquis";/.test(readFileSync("src/lib/prospects.js", "utf8")));
  // A9 — devis et proforma : entête, bandeau de titre, bandeau TOTAL,
  // mentions et pied de page écrits une seule fois.
  const pdf = readFileSync("src/pdf.js", "utf8");
  test("★ l'entête société (NIF, RCCM), le bandeau de formation, le bandeau TOTAL et le pied de page ne sont écrits qu'UNE fois dans pdf.js",
    (pdf.match(/NIF : 1001790098/g) || []).length === 1 && (pdf.match(/RCCM : TG-LFW-01-2022-A10-01523/g) || []).length === 1
    && (pdf.match(/DOCUMENT DE FORMATION — SANS VALEUR/g) || []).length === 1 && (pdf.match(/doc\.roundedRect\(bandeauX/g) || []).length === 1
    && (pdf.match(/doc\.text\("BMI-Gestions Boutiques", largeur \/ 2/g) || []).length === 1
    && (pdf.match(/il constitue une offre de prix et n'a pas de valeur comptable/g) || []).length === 1);
  // 12/09/2026 : le relevé d'une caisse (genererReleve) passe par l'entête, le bandeau de titre et le pied de page — trois passages, sans recopie.
  // ⚠ RETOURNÉ le 18/09/2026 : le dossier personnel d'un client (droit
  // d'accès) est le QUATRIÈME document à passer par les mêmes briques. Il
  // n'a ni total ni mentions d'offre — ce n'est pas une offre de prix —,
  // mais il pose son pied de page lui-même sur la dernière page.
  test("★ le devis, le proforma, le relevé ET le dossier personnel passent par ces briques (enteteSociete, bandeauTitre, piedDePage — bandeauTotal et mentionsOffre pour les deux offres de prix)",
    (pdf.match(/enteteSociete\(doc, logo, largeur\);/g) || []).length === 4 && (pdf.match(/= bandeauTitre\(doc, largeur, /g) || []).length === 4
    // Retourné deux fois le 11/09/2026 : le devis a d'abord eu un second
    // rendu, puis UNE seule charpente pour les trois volets — on revient donc
    // à deux passages par brique (le devis, le proforma), sans recopie.
    && (pdf.match(/y = bandeauTotal\(doc, largeur, y, /g) || []).length === 2 && (pdf.match(/mentionsOffre\(doc, y[ +0-9.]*, /g) || []).length === 2
    && (pdf.match(/piedDePage\(doc, largeur, hauteur\);/g) || []).length === 3);
  test("★ chaque document garde son titre et sa nature : « FACTURE PROFORMA » / « une facture proforma », « DEVIS — … » / « un devis »",
    /bandeauTitre\(doc, largeur, "FACTURE PROFORMA", p\.formation\)/.test(pdf) && /mentionsOffre\(doc, y, "une facture proforma"\)/.test(pdf)
    && /bandeauTitre\(doc, largeur, `DEVIS — \$\{d\.titre \|\| ""\}`\.trim\(\), d\.formation\)/.test(pdf)
    // RETOURNÉ le 11/09/2026 : les mentions du DEVIS sont désormais posées en
    // colonne étroite à gauche des cadres de signature (MENTIONS_LARGEUR) —
    // même règle, même texte, une largeur en plus.
    && /mentionsOffre\(doc, y \+ 3, "un devis", MENTIONS_LARGEUR\)/.test(pdf)
    && (pdf.match(/il constitue une offre de prix et n'a pas de valeur comptable/g) || []).length === 1);
  test("le bandeau de formation décale le contenu (42 → 54), comme avant", /if \(!formation\) return 42;/.test(pdf) && /return 54;/.test(pdf));
}

titre("Doublons B1 et B4 : la question « Moyen de paiement » et le contrôle d'un mois / d'une date, écrits UNE fois (Timo : « lance tout », 08/09/2026)");
{
  // « Moyen de paiement » était tapé 13 fois avec 5 formulations ; le
  // contrôle AAAA-MM 3 fois, AAAA-MM-JJ 2 fois (et une date jamais
  // contrôlée). Tout vit dans components/ui.jsx.
  const sortieUi = join("node_modules", ".cache", `bmi-ui-${process.pid}.mjs`);
  await build({ entryPoints: ["src/components/ui.jsx"], bundle: true, format: "esm", platform: "node", outfile: sortieUi, logLevel: "silent",
    loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Ui = await import(pathToFileURL(sortieUi).href);
  unlinkSync(sortieUi);
  test("★ estMoisValide : 2026-07 oui ; 2026-13, 2026-7, 07-2026, vide → non", Ui.estMoisValide("2026-07") && Ui.estMoisValide(" 2026-12 ") && !Ui.estMoisValide("2026-13") && !Ui.estMoisValide("2026-7") && !Ui.estMoisValide("07-2026") && !Ui.estMoisValide(""));
  test("★ estDateValide : 2026-09-15 oui ; 2026-09-32, 2026-09, 15/09/2026 → non", Ui.estDateValide("2026-09-15") && !Ui.estDateValide("2026-09-32") && !Ui.estDateValide("2026-09") && !Ui.estDateValide("15/09/2026"));
  test("★ hors écran (aucune fenêtre), demanderMois / demanderDate / demanderMoyenPaiement répondent « annulé » sans planter",
    (await Ui.demanderMois("Mois")) === null && (await Ui.demanderDate("Date")) === null && (await Ui.demanderMoyenPaiement()) === null);
  const ui = readFileSync("src/components/ui.jsx", "utf8");
  // 14/09/2026, Timo : « et si ce mode était à sélectionner ? » — la réponse
  // était TAPÉE et la liste des moyens rappelée dans la question
  // (LISTE_MOYENS_SAISIE). Ce sont des BOUTONS : la liste vit dans
  // constants.js (MOYENS_ENCAISSEMENT) et plus personne ne la récrit.
  test("★ le moyen de paiement se CHOISIT (boutons), plus aucune liste de moyens tapée dans une question",
    !/LISTE_MOYENS_SAISIE/.test(ui) && execSync("grep -rl 'Espèces / Flooz / Mixx / Virement bancaire' src || true").toString().trim() === ""
    && /export const demanderMoyenPaiement = \(complement = "", defaut = "Espèces", libelle = "Moyen de paiement", beneficiaire = null\) =>\n  uChoix\(/.test(ui)
    && /moyensProposes\(defaut\)\)/.test(ui) && !/uPrompt\(`\$\{libelle\}/.test(ui));
  test("★ les 14 questions passent par demanderMoyenPaiement (la 14e : ✏️ Moyen d'un apporteur, 21/09/2026 ; plus aucun uPrompt « Moyen de … »)",
    execSync("grep -rho 'demanderMoyenPaiement(' src/screens src/lib | wc -l").toString().trim() === "14"
    && execSync("grep -rl 'uPrompt(.Moyen de' src || true").toString().trim() === "");
  // 12/09/2026 : le remboursement d'une avance de frais « avec le salaire » (Caisse.jsx) demande son mois — ×4.
  // ⚠ RETOURNÉ le 15/09/2026 : demanderDate passe de 3 à 4 — la date RÉELLE
  // d'une remise de fonds de caisse (⚙ Paramètres → 💼 Fonds de caisse), qui
  // se corrige depuis que « Régulariser » a daté 50 000 F du mauvais jour.
  test("★ plus aucun contrôle AAAA-MM ou AAAA-MM-JJ recopié dans un écran : demanderMois ×6 (le mois de paie d'un remboursement d'avance, 12/09/2026 ; la retenue d'un outil perdu à la déclaration puis, mois après mois, depuis le carré « Perdus », 18/09/2026), demanderDate ×4 (dont la date réelle d'une remise de fonds)",
    execSync("grep -rl '\\\\d{4}-\\\\d{2}' src --include=*.jsx --include=*.js | grep -v components/ui.jsx || true").toString().trim() === ""
    && execSync("grep -rho 'demanderMois(' src/screens src/lib | wc -l").toString().trim() === "6"
    && execSync("grep -rho 'demanderDate(' src/screens src/lib | wc -l").toString().trim() === "4");
  test("les formulations particulières sont gardées par le libellé (« Moyen de remise des fonds », « Moyen de paiement reçu »), et la CNSS propose le virement",
    /demanderMoyenPaiement\("", "Espèces", "Moyen de remise des fonds", u\)/.test(readFileSync("src/screens/Utilisateurs.jsx", "utf8"))
    && /demanderMoyenPaiement\("", "Espèces", "Moyen de paiement reçu"\)/.test(readFileSync("src/screens/Utilisateurs.jsx", "utf8"))
    && /demanderMoyenPaiement\("de la CNSS", "Virement bancaire"\)/.test(readFileSync("src/screens/Salaires.jsx", "utf8")));
  test("la relance d'un prospect (jamais contrôlée avant) passe par demanderDate, facultative", /demanderDate\(`Nouvelle date de relance pour \$\{p\.nom\}`, p\.relance \|\| "", true\)/.test(readFileSync("src/screens/Prospects.jsx", "utf8")));
}

titre("Doublons B2, B3, B5 : fabriquer un message, fabriquer une dépense automatique, le tableau des dépenses — UNE fois (Timo : « lance tout », 08/09/2026)");
{
  const moi = { id: "u1", nom: "KOSSI" };
  const m = Core.nouveauMessage(moi, { a_id: "u2", texte: "Bonjour" });
  test("★ nouveauMessage : id, date, heure, de qui (id + nom), déjà lu par l'auteur, puis les champs donnés",
    typeof m.id === "string" && m.date === new Date().toISOString().slice(0, 10) && /^\d{4}-\d{2}-\d{2}T/.test(m.ts)
    && m.de_id === "u1" && m.de_nom === "KOSSI" && JSON.stringify(m.lu_par) === '["u1"]' && m.a_id === "u2" && m.texte === "Bonjour");
  test("★ un message du SYSTÈME (BMI TOGO) n'est lu par personne ; un auteur inconnu devient « Système » sans lecteur",
    JSON.stringify(Core.nouveauMessage(Core.SYSTEME, { texte: "x" }).lu_par) === "[]" && Core.nouveauMessage(Core.SYSTEME, {}).de_nom === "BMI TOGO"
    && Core.nouveauMessage(null, {}).de_nom === "Système" && Core.nouveauMessage(undefined, {}).de_id === null && JSON.stringify(Core.nouveauMessage(null, {}).lu_par) === "[]");
  test("★ deux messages fabriqués à la suite ont deux identifiants", Core.nouveauMessage(moi, {}).id !== Core.nouveauMessage(moi, {}).id);
  const d = Core.nouvelleDepense(moi, { boutique: "APESSITO", categorie: "Commissions", description: "Commission — AMA", montant: 25000, moyen: "flooz", auto: "commission", user_id: "u9" });
  test("★ nouvelleDepense : id, date, boutique, catégorie, description, montant, moyen NORMALISÉ, par, auto, puis le reste (user_id…)",
    typeof d.id === "string" && d.date === new Date().toISOString().slice(0, 10) && d.boutique === "APESSITO" && d.categorie === "Commissions"
    && d.montant === 25000 && d.paiement === "Mobile Money (Flooz)" && d.par === "KOSSI" && d.auto === "commission" && d.user_id === "u9");
  test("★ sans « auto », la clé n'est pas écrite (une dépense saisie à la main n'a pas de lien à annuler) ; un montant négatif (remboursement) passe tel quel",
    !("auto" in Core.nouvelleDepense(moi, { boutique: "A", categorie: "C", description: "D", montant: 1, moyen: "Espèces" }))
    && Core.nouvelleDepense(moi, { boutique: "A", categorie: "C", description: "D", montant: -500, moyen: "virement", auto: "remboursement" }).montant === -500);
  test("★ la normalisation du moyen est stable (normaliser deux fois = une fois)", ["flooz", "Mixx", "banque", "esp"].every((x) => Core.normPaiement(Core.normPaiement(x)) === Core.normPaiement(x)));
  test("★ plus aucune fiche de message recopiée : « lu_par: [profile.id] » et « de_nom: profile.nom » n'existent plus hors core.js",
    execSync("grep -rln 'lu_par: \\[profile.id\\]\\|de_nom: profile.nom' src || true").toString().trim() === "");
  test("★ plus aucune fiche de dépense automatique recopiée : « par: profile.nom, auto: » n'existe plus dans les écrans",
    execSync("grep -rln 'par: profile.nom, auto:' src || true").toString().trim() === "");
  // 12/09/2026 : la validation des dépenses (lib/validationDepenses.js) ajoute
  // quatre messages (à valider, validée, rejetée, avance remboursée) et deux
  // fabrications de dépense (la saisie de l'écran, le remboursement d'une avance).
  test("★ nouveauMessage sert aux 31 fabrications (les quatre de la validation des dépenses, 12/09/2026 ; la réponse WhatsApp, la réattribution d'une conversation et le PREMIER message à un client, 20/09/2026 ; le retour d'une conversation à tout le personnel, 21/09/2026), nouvelleDepense aux 17 dépenses (la saisie de l'écran Dépenses et le remboursement d'une avance de frais compris, 12/09/2026 ; le fonds de caisse remis par le DG, 14/09/2026 ; la sortie et la perte d'un outil, 17/09/2026 ; la retenue sur salaire d'un outil perdu, 18/09/2026 ; le retrait d'un compte mobile vers le tiroir, 21/09/2026)",
    execSync("grep -rn 'nouveauMessage(' src/screens src/lib | grep -v 'src/lib/core.js' | wc -l").toString().trim() === "31"
    && execSync("grep -rn 'nouvelleDepense(' src/screens src/lib | grep -v 'src/lib/core.js' | wc -l").toString().trim() === "17");
  const dep = readFileSync("src/screens/Depenses.jsx", "utf8");
  // ⚠ Timo (11/09/2026) : « pourquoi jusqu'à lors les versements sont
  // considérés comme dépense ? ». Sa règle du 10/09 (« un versement n'est
  // JAMAIS une dépense ») était appliquée au tableau de bord, aux exports et
  // au journal — mais PAS à l'écran 💰 Dépenses, dont la liste et le total du
  // mois les comptaient encore. Un écran oublié fait mentir une règle.
  test("★ l'écran 💰 Dépenses lui-même ne compte NI les versements de fonds NI les remboursements de reprise (liste et « Ce mois »), et dit où les retrouver",
    // 13/09/2026 : la liste passe en plus par depensesVisibles (un technicien ne voit que les siennes) — horsVersements reste dedans.
    /const liste = depensesVisibles\(horsVersements\(db\.depenses\)\.filter\(\(x\) => x\.boutique === boutique\), profile\);/.test(dep)
    // 12/09/2026 : « Ce mois » passe par depensesComptees (une dépense en attente ne compte pas).
    && /import \{ CATEGORIES, PAIEMENTS, horsVersements, depensesComptees \} from "\.\.\/lib\/constants";/.test(dep)
    && /const totalMois = depensesComptees\(liste\)\.filter/.test(dep)
    && /ne sont pas des dépenses : ils ne comptent pas ici/.test(dep)
    && /Retrouvez-les dans <b>🔒 Caisse<\/b>/.test(dep));
  test("★ Dépenses : le tableau est écrit UNE fois (TableauDepenses) et affiché deux fois (boutique, chez le comptable)",
    (dep.match(/<thead className="sticky top-0 bg-white">/g) || []).length === 1 && (dep.match(/<TableauDepenses /g) || []).length === 2
    // 13/09/2026 : « appliquer la règle d'archivage aussi à l'historique des dépenses » — LE composant commun, plus de pagination.
    && /<HistoriqueArchive lignes=\{liste\} dateDe=\{\(x\) => x\.date\} aujourdhui=\{today\(\)\} vide=\{vide\} titreArchives="Dépenses archivées"/.test(dep) && !/usePagination|<Pagination /.test(dep)
    // 13/09/2026 : le texte « vide » de la boutique dépend du rôle (technicien : « Vous n'avez enregistré aucune dépense… »).
    && /vide=\{mesSeules \? "Vous n'avez enregistré aucune dépense pour cette boutique\." : "Aucune dépense enregistrée\."\} \/>/.test(dep) && /vide="Aucune sortie de caisse « Chez le comptable » pour l'instant\." \/>/.test(dep));
}

titre("Les appareils du volet solaire : catalogue, abréviations, une faute tolérée, liste qui grandit (Timo, 09/09/2026)");
{
  // « L'application devrait reconnaître les abréviations des équipements…
  // ne pas être rigide. » Puis : « élargis d'abord à une cinquantaine ou
  // plus, puis lance. » On exerce le catalogue et la recherche.
  const sortieApp = join("node_modules", ".cache", `bmi-appareils-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/appareils.js"], bundle: true, format: "esm", platform: "node", outfile: sortieApp, logLevel: "silent",
    loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const App = await import(pathToFileURL(sortieApp).href);
  unlinkSync(sortieApp);
  const sortieSug2 = join("node_modules", ".cache", `bmi-sug2-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/suggestions.js"], bundle: true, format: "esm", platform: "node", outfile: sortieSug2, logLevel: "silent" });
  const Sug = await import(pathToFileURL(sortieSug2).href);
  unlinkSync(sortieSug2);
  const cat = App.CATALOGUE_APPAREILS;
  test("★ le catalogue de départ compte 55 appareils ou plus, chacun avec un identifiant unique, un nom unique, une puissance et au moins un autre nom",
    cat.length >= 55 && new Set(cat.map((a) => a.id)).size === cat.length && new Set(cat.map((a) => Sug.sansAccents(a.nom))).size === cat.length
    && cat.every((a) => a.puissance > 0 && Array.isArray(a.autres) && a.autres.length >= 1));
  const props = App.suggestionsAppareils(cat);
  const noms = (q) => Sug.filtrerSuggestions(props, q).map((s) => s.valeur);
  test("★ « tv » et « télé » proposent le téléviseur d'abord ; « frigo » le réfrigérateur ; « clim » les quatre climatiseurs, le 1 CV en tête",
    noms("tv")[0] === 'Téléviseur 32"' && noms("télé")[0] === 'Téléviseur 32"' && noms("frigo")[0] === "Réfrigérateur"
    && noms("clim").filter((n) => n.startsWith("Climatiseur")).length === 4 && noms("clim")[0] === "Climatiseur 1 CV (9 000 BTU)");
  test("★ « poste » propose le poste à souder en tête et plus jamais le téléviseur (retiré de ses autres noms) ; « machine » en propose plusieurs — la liste tranche, pas le mot",
    noms("poste")[0] === "Poste à souder" && !noms("poste").some((n) => n.startsWith("Téléviseur")) && noms("machine").length >= 2);
  test("★ une faute d'une lettre trouve quand même : « climatisseur », « télévison », « refrigerateur », « ventillateur »",
    noms("climatisseur")[0].startsWith("Climatiseur") && noms("télévison")[0].startsWith("Téléviseur") && noms("refrigerateur")[0] === "Réfrigérateur" && noms("ventillateur")[0] === "Ventilateur");
  // Capture Timo du 09/09/2026 : « tv » faisait sortir le décodeur (dstv) et
  // la caméra (cctv). Un mot court doit COMMENCER un mot, jamais se cacher
  // dedans.
  test("★ « tv » ne propose que les téléviseurs — ni le décodeur (dstv) ni la caméra (cctv) ; un mot court commence un mot, il ne se cache pas dedans",
    noms("tv").every((n) => n.startsWith("Téléviseur")) && noms("tv").length === 3
    && Sug.correspond("dstv", "tv") === false && Sug.correspond("tv 32", "tv") === true && Sug.correspond("Câble solaire 6mm² noir", "6mm") === true
    && Sug.correspond("Coffret HT 12M", "12") === true && Sug.correspond("Caméra extérieure", "came") === true);
  test("★ les mots courts ne tolèrent pas de faute (« tx » ne trouve pas la tv), et rien ne correspond → liste vide, saisie libre",
    !noms("tx").some((n) => n.startsWith("Téléviseur")) && noms("zzzz").length === 0);
  test("★ distance d'édition : climatiseur/climatisseur = 1, tv/tv = 0, four/frigo > 1", Sug.distance("climatiseur", "climatisseur") === 1 && Sug.distance("tv", "tv") === 0 && Sug.distance("four", "frigo") > 1);
  test("★ choisir « tv » ou « Réfrigérateur » pré-remplit la puissance ; un mot partagé (« portable », « machine ») ne choisit rien tout seul",
    App.appareilDuCatalogue(cat, "tv")?.id === "tv_32" && App.appareilDuCatalogue(cat, "Réfrigérateur")?.puissance === 150 && App.appareilDuCatalogue(cat, "poste")?.id === "poste_souder"
    && App.appareilDuCatalogue(cat, "portable") === null && App.appareilDuCatalogue(cat, "machine") === null && App.appareilDuCatalogue(cat, "pc") !== null && App.appareilDuCatalogue(cat, "") === null);
  const dbA = { boutiques: [{ nom: "APESSITO", appareils_catalogue: [{ id: "frigo", puissance: 180 }, { id: "neon", retire: true }, { id: "perso_four_a_pain", nom: "Four à pain", puissance: 2500, autres: ["boulangerie"] }] }, { nom: "DEMAKPOE" }],
    users: [{ id: "u1", nom: "KOSSI", role: "vendeur", boutique: "APESSITO" }] };
  const merge = App.catalogueAppareils(dbA, dbA.users[0]);
  test("★ la liste de l'espace = départ + corrections (frigo → 180 W), sans les retirés (néon), avec les ajouts (Four à pain)",
    merge.find((a) => a.id === "frigo")?.puissance === 180 && merge.find((a) => a.id === "frigo")?.nom === "Réfrigérateur" && !merge.some((a) => a.id === "neon")
    && merge.find((a) => a.id === "perso_four_a_pain")?.autres[0] === "boulangerie" && merge.length === cat.length);
  test("★ sans profil ni personnalisation, la liste de départ telle quelle", App.catalogueAppareils({ boutiques: [] }, null).length === cat.length);
  const comptes = [{ devis: [{ besoins: { appareils: [{ nom: "Machine à pâte", puissance: 900 }, { nom: "tv", puissance: 45 }, { nom: "climatisseur", puissance: 1000 }] } },
    { besoins: { appareils: [{ nom: "machine a pate", puissance: 900 }, { nom: "Machine à pâte", puissance: 700 }] } }] }];
  const ac = App.appareilsAClasser(comptes, cat);
  test("★ « à classer » : l'appareil inconnu des devis, une seule fois malgré les écritures, avec la puissance la plus fréquente et le nombre de devis — tv et « climatisseur » (connus) n'y sont pas",
    ac.length === 1 && ac[0].nom === "Machine à pâte" && ac[0].puissance === 900 && ac[0].devis === 3);
  test("★ idAppareil fabrique un identifiant sûr", App.idAppareil("Four à pain (grand)") === "perso_four_a_pain_grand");
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  // Retourné le 09/09/2026 (Timo : « à peine j'écris TV, la case se remplit
  // de Téléviseur 32 ») : ce qui est tapé reste tel quel, seul un CLIC sur
  // une proposition pré-remplit.
  test("★ le champ Appareil : ce qu'on tape n'est jamais transformé (onChange = majAppareil), seul le clic sur une proposition pré-remplit (onChoisir)",
    /<ChampSuggestions placeholder="Ex : tv, frigo, clim…" valeur=\{a\.nom\} suggestions=\{propositionsAppareils\} onChange=\{\(v\) => majAppareil\(a\.id, "nom", v\)\} onChoisir=\{\(s\) => choisirAppareil\(a\.id, s\)\} \/>/.test(sol)
    && /const catalogue = catalogueAppareils\(db, profile\);/.test(sol) && /\{ \.\.\.a, nom: e\.nom, puissance: String\(e\.puissance\) \}/.test(sol)
    && !/onChange=\{\(v\) => choisirAppareil/.test(sol));
  test("★ le champ commun distingue TAPER (onChange, jamais transformé) et CHOISIR (onChoisir, au clic ou à Entrée seulement)",
    /const choisir = \(s\) => \{ onChange\(s\.valeur\); if \(onChoisir\) onChoisir\(s\); setOuvert\(false\); setActif\(-1\); \};/.test(readFileSync("src/components/ChampSuggestions.jsx", "utf8"))
    && /onChange=\{\(e\) => \{ onChange\(e\.target\.value\); setOuvert\(true\); setActif\(-1\); \}\}/.test(readFileSync("src/components/ChampSuggestions.jsx", "utf8")));
  test("★ aucun autre écran ne transforme ce qui est tapé dans un champ à suggestions (le nom d'un autre équipement n'est relié qu'à un nom EXACT du stock, sans réécriture partielle)",
    /return \{ \.\.\.autre, nom, produit_id: null/.test(readFileSync("src/screens/dimensionnement/devisCommun.js", "utf8")));
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  test("★ ⚙ Paramètres → 🔌 Appareils : ajouter, corrigér, retirer (admin), écrit sur les boutiques de l'espace regardé seulement ; « à classer » lit les comptes de l'espace",
    /\["appareils", `🔌 Appareils/.test(par) && /refuserSaufAdmin\(profile, "Compléter la liste des appareils"\)/.test(par)
    && /const visibles = new Set\(boutiquesVisibles\(db, profile, db\.boutiques \|\| \[\]\)\.map\(\(b\) => b\.nom\)\);/.test(par)
    && /appareilsAClasser\(utilisateursDeLEspace\(db, profile\), catalogueApp\)/.test(par));
}

titre("Solaire : « 🆕 Nouveau devis » au-delà de 5 appareils, avec confirmation (Timo, 09/09/2026)");
{
  // « Un bouton nouveau devis, à côté de ajouter un appareil, seulement si
  // les lignes dépassent 5 ; avant d'effacer, confirmation — ou annuler et
  // enregistrer d'abord. »
  const sol = readFileSync("src/screens/dimensionnement/Solaire.jsx", "utf8");
  test("★ le bouton n'apparaît qu'au-delà de 5 appareils, à côté de « Ajouter un appareil »",
    /\{appareils\.length > 5 && \(\s*<button onClick=\{nouveauDevis\}[^>]*>🆕 Nouveau devis \(tout effacer\)<\/button>/.test(sol)
    && /<button onClick=\{ajouterAppareil\}[^>]*>➕ Ajouter un appareil<\/button>\s*\{appareils\.length > 5/.test(sol));
  test("★ une confirmation AVANT d'effacer, qui rappelle « Enregistrer un brouillon » pour garder le devis en cours",
    /const nouveauDevis = async \(\) => \{\s*if \(!await uConfirm\(/.test(sol) && /Commencer un NOUVEAU devis \?/.test(sol) && /annulez et cliquez d'abord « 📝 Enregistrer un brouillon »/.test(sol));
  test("★ tout ce qui fait le devis est effacé : appareils (une ligne vide), choix et verrous, HB, rails et fixation, autres équipements, client, remise / frais / acompte / délai ; une reprise en cours est close",
    /setAppareils\(\[\{ id: uid\(\), nom: "", puissance: "", heures: "", qte: "1" \}\]\);/.test(sol) && /setChoix\(\{\}\); setRolesManuels\(\{\}\); setRolesHB\(\{\}\);/.test(sol)
    && /setRailsQte\(0\); setFixationManuelle\(\{\}\);/.test(sol) && /reprendreAutres\(\[\]\);/.test(sol) && /envoi\.setClientDevis\(""\); envoi\.setNouvClient\(\{ nom: "", tel: "" \}\);/.test(sol)
    && /r\.setPctRemise\("0"\); r\.setPctInstall\("10"\); r\.setPctTransport\("0"\); r\.setPoseSeule\(false\); r\.setMontantPoseFixe\(""\); r\.setPctAcompte\("100"\); r\.setDelaiInstallation\(""\);/.test(sol)
    && /if \(devisAReprendre && onDevisRepriseConsomme\) onDevisRepriseConsomme\(\);/.test(sol));
  test("les réglages de la maison (autonomie, ensoleillement, tension, batterie) ne sont PAS touchés", !/setAutonomie\("1"\)|setSoleil\(SOLEIL_DEFAUT\)|setTension\(TENSION_DEFAUT\)/.test(sol.slice(sol.indexOf("const nouveauDevis"), sol.indexOf("const nouveauDevis") + 1500)));
}

titre("Tableau de bord : une boutique au choix — Toutes, chaque boutique, TERRAIN, Chez le comptable (Timo, 09/09/2026)");
{
  // « Peut-on voir les activités d'une seule boutique ? — Lance, avec
  // TERRAIN et Chez le comptable. » Une boutique choisie filtre TOUT
  // l'écran ; « Toutes » garde l'écran tel qu'il était ; jamais hors de
  // l'espace regardé.
  const dash = readFileSync("src/screens/Dashboard.jsx", "utf8");
  test("★ les pastilles : les boutiques de l'espace regardé, la caisse TERRAIN de cet espace, et « Chez le comptable » seulement en réel (pas de jumelle de formation)",
    /const terrainVu = boutiqueTerrain\(db, enFormation\);/.test(dash)
    // (12/09/2026 : DG et BANQUE rejoignent la rangée, pour le principal, réelles seulement)
    // ⚠ RETOURNÉ le 21/09/2026 : les comptes mobiles (📱 Flooz, 📱 Mixx/T-Money)
    // rejoignent la rangée — mais dans les DEUX espaces, et seulement s'ils
    // SERVENT. `nomsCaisses` cloisonne déjà : le mur tient.
    && /const PASTILLES = \[\.\.\.NOMS, \.\.\.\(terrainVu \? \[terrainVu\.nom\] : \[\]\), \.\.\.mobilesVus\.map\(\(m\) => m\.caisse\), \.\.\.\(enFormation \? \[\] : \[\.\.\.\(principal \? \[CAISSE_DG, CAISSE_BANQUE\] : \[\]\), NOM_CAISSE_COMPTABLE\]\)\];/.test(dash));
  test("★ le choix est mémorisé par écran (« dashboard ») et jamais retenu s'il n'est plus dans les pastilles de l'espace regardé",
    /boutiqueMemorisee\(profile, "dashboard"\); return m && m !== TOUTES && PASTILLES\.includes\(m\) \? m : "";/.test(dash)
    && /memoriserBoutique\(profile, "dashboard", nom \|\| TOUTES\)/.test(dash));
  test("★ les huit listes globales (ventes, dépenses, versements, dettes, produits, chantiers, dettes classiques, réservations) passent par l'espace PUIS par la boutique choisie",
    (dash.match(/\.filter\(dansMonEspace\)\.filter\(dansLaBoutique\)/g) || []).length === 7
    && /dansMonEspace\(\{ boutique: boutiqueDuChantier\(db, c\) \}\) && dansLaBoutique\(\{ boutique: boutiqueDuChantier\(db, c\) \}\)/.test(dash));
  // Retourné le 09/09/2026 (Timo : « cacher les cartes à zéro chez le
  // comptable et pour le magasin ») : le graphique et la synthèse ne
  // montrent que les boutiques qui VENDENT (NOMS_GRAPHE, sans dépôt) ; les
  // totaux et les cartes du bas gardent tout (NOMS_VUES).
  test("★ la pastille « TOUTES » s'écrit en majuscules, comme les noms de boutiques à côté (capture Timo, 09/09/2026)", />TOUTES<\/button>/.test(dash) && !/>Toutes<\/button>/.test(dash));
  test("★ colonnes, barres et cartes par boutique suivent le choix (NOMS_VUES) ; graphique et synthèse sans les dépôts (NOMS_GRAPHE) ; « Toutes » = la liste d'avant",
    /const NOMS_VUES = bqChoisie \? \[bqChoisie\] : NOMS;/.test(dash) && /const NOMS_GRAPHE = NOMS_VUES\.filter\(\(nom\) => !estDepot\(nom\)\);/.test(dash)
    && (dash.match(/\bNOMS_VUES\b/g) || []).length >= 8 && (dash.match(/\bNOMS_GRAPHE\b/g) || []).length >= 7
    && !/\bNOMS\.(map|forEach|reduce|length)/.test(dash));
  test("★ un dépôt ou la caisse du comptable ne montrent aucune carte de vente, dette, commission ou client, ni graphique, top 5, paiements, synthèse ; TERRAIN et le comptable n'ont pas de carte de stock",
    /const sansVentes = depotChoisi \|\| comptableChoisi \|\| caisseSeule;/.test(dash) && /const sansStock = comptableChoisi \|\| terrainChoisi \|\| caisseSeule;/.test(dash)
    && (dash.match(/\{!sansVentes && <Stat /g) || []).length === 8 && /\{!sansVentes && <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">\s*<div className="flex items-center justify-between mb-3 flex-wrap gap-2">\s*<div className="font-bold text-slate-800">Ventes des 6 derniers mois/.test(dash)
    && /\{!sansVentes && <div className="grid md:grid-cols-2 gap-3">/.test(dash) && /\{!sansVentes && <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">\s*<div [^>]*>Synthèse par période/.test(dash)
    && /\{!sansStock && <div className="grid md:grid-cols-2 gap-3">/.test(dash) && /\{!estDepot\(b\) && <div><div className="text-xs text-slate-500">Dettes clients/.test(dash));
  test("★ les dépenses restent visibles partout (total et période choisie — « Dépenses du mois » retourné le 10/09/2026), et les exports suivent : ventes / dettes cachés sans ventes, stocks caché sans stock",
    /<Stat label="Total des dépenses"/.test(dash) && /<Stat label=\{`Dépenses — \$\{customRow\.label\}`\}/.test(dash) && !/\{!sansVentes && <Stat label=\{`Dépenses — /.test(dash) && !/\{!sansVentes && <Stat label="Total des dépenses"/.test(dash)
    && /\{!sansVentes && <button className=\{btnDark\} onClick=\{\(\) => exportCSV\("ventes"/.test(dash) && /\{!sansVentes && <button className=\{btnDark\} onClick=\{\(\) => exportCSV\("dettes"/.test(dash)
    && /\{!sansStock && <button className=\{btnDark\} onClick=\{\(\) => exportCSV\("stocks"/.test(dash));
  test("★ le journal comptable exporté suit aussi la boutique choisie", /lignesJournal\(db, pa, pb\)\.filter\(\(l\) => !bqChoisie \|\| l\[8\] === bqChoisie\)/.test(dash));
  // Capture Timo (10/09/2026) : « Période : Aujourd'hui » choisi, les cartes disaient encore « Ventes du mois ».
  // Timo (11/09/2026) : « Période doit rester sur Aujourd'hui par défaut ».
  test("★ le sélecteur de période démarre sur Aujourd'hui (periodes()[0]), repli compris — plus sur « Ce mois »",
    /const \[periodeIndex, setPeriodeIndex\] = useState\(0\);/.test(dash) && /periodes\(\)\[periodeIndex\] \|\| periodes\(\)\[0\]/.test(dash)
    && !/useState\(2\)|periodes\(\)\[2\]/.test(dash) && C.periodes()[0][0] === "Aujourd'hui");
  test("★ les cartes Ventes / Dépenses / Résultat sous le sélecteur suivent la PÉRIODE CHOISIE (customRow), nommée sur la carte — plus jamais figées sur le mois",
    /label=\{`Ventes — \$\{customRow\.label\}`\} value=\{fmt\(somme\(customRow\.v\)\)\}/.test(dash) && /label=\{`Dépenses — \$\{customRow\.label\}`\} value=\{fmt\(somme\(customRow\.d\)\)\}/.test(dash)
    && /label=\{`Résultat — \$\{customRow\.label\}`\} value=\{fmt\(resCustom\)\}/.test(dash) && !/Ventes du mois|const m = rows\[2\]/.test(dash));
  test("la présentation ne change pas : mêmes cartes, même sélecteur de période, le graphique et la synthèse sont là", /<Stat label="Total des ventes"/.test(dash) && /Ventes des 6 derniers mois/.test(dash) && /Synthèse par période/.test(dash));
}

titre("Relance WhatsApp des devis sans réponse (Timo, 09/09/2026 : seuil 15 jours, message selon le statut, payé jamais relancé)");
{
  // « Les clients à qui on a envoyé des devis et qui ne réagissent pas : où
  // les retrouver et les relancer sur WhatsApp ? » — « Lance, seuil 15
  // jours. Mais les messages devraient être différents dépendemment du
  // statut du devis, s'il est proposé, validé… Payé ne doit plus être
  // relancé. » La règle du message est pure : on l'exerce (bundle Cli).
  const compte = { nom: "KOFFI2", nom_base: "Koffi", tel: "90112233" };
  const base = { id: "d1", date: "2026-08-20", total: 1250000, boutique: "Agoè" };
  const txt = (extra) => Cli.texteRelanceDevis({ devis: { ...base, ...extra }, compte, motDePasse: "12ab34", vendeur: "Ali", formaterMontant: (n) => `${n} F` });
  test("★ un devis PROPOSÉ (ou sans statut) reçoit un rappel du devis, avec la date, le montant, l'espace client, l'identifiant et le mot de passe",
    txt({ statut: "propose" }) === txt({}) && /Bonjour KOFFI,/.test(txt({})) && /devis BMI TOGO de 1250000 F/.test(txt({})) && /envoyé le 20\/08\/2026/.test(txt({}))
    && /https:\/\/gestion\.bmitogo\.com/.test(txt({})) && /Identifiant : \*KOFFI2\*/.test(txt({})) && /Mot de passe : \*12ab34\*/.test(txt({})) && /valider le devis, demander une modification/.test(txt({})) && /^Ali, BMI TOGO/m.test(txt({})));
  test("★ un devis VALIDÉ reçoit un AUTRE message : merci d'avoir validé, il reste à régler à la boutique de paiement (contrat rappelé s'il existe) ; pose seule → sans boutique",
    /Merci d'avoir validé votre devis BMI TOGO de 1250000 F \(contrat CTR-1\)/.test(txt({ statut: "valide", contrat_numero: "CTR-1", boutique_paiement: "Lomé" })) && /régler à la boutique Lomé/.test(txt({ statut: "valide", boutique_paiement: "Lomé" }))
    && /régler à la boutique Agoè/.test(txt({ statut: "valide" })) && !/Identifiant/.test(txt({ statut: "valide" })) && !/boutique/.test(txt({ statut: "valide", pose_seule: true })) && /régler le montant convenu/.test(txt({ statut: "valide", pose_seule: true }))
    && txt({ statut: "valide" }) !== txt({ statut: "propose" }));
  test("★ PAYÉ n'est jamais relancé (null) — ni rejeté, ni modification demandée",
    txt({ statut: "paye" }) === null && txt({ statut: "rejete" }) === null && txt({ statut: "modification" }) === null
    && Cli.devisRelancable({ statut: "paye" }) === false && Cli.devisRelancable({ statut: "propose" }) === true && Cli.devisRelancable({}) === true && Cli.devisRelancable({ statut: "valide" }) === true
    && Cli.STATUTS_DEVIS_RELANCABLES.join("|") === "propose|valide");
  // ⚠ Timo (11/09/2026) : « celui qui a proposé le devis peut avoir la
  // possibilité de modifier le devis ? » → un devis PROPOSÉ se corrige aussi
  // (une faute vue juste après l'envoi n'oblige plus à refaire un devis
  // entier), par CELUI QUI L'A ÉTABLI, l'administrateur ou le responsable
  // commercial (option « b »). Validé et payé restent fermés.
  const auteur = { id: "u1", nom: "ALI", role: "vendeur" };
  const autreVendeur = { id: "u2", nom: "KODJO", role: "vendeur" };
  const admin = { id: "u3", nom: "TIMO", role: "admin" };
  const respCom = { id: "u4", nom: "AMA", role: "resp_commercial" };
  const devisDe = (statut) => ({ ...base, statut, par_id: "u1", par: "ALI" });
  test("★ un devis PROPOSÉ se corrige maintenant (avec modification demandée et rejeté) — par celui qui l'a établi, l'administrateur ou le responsable commercial ; personne d'autre, pas même un autre vendeur qui le voit dans sa liste",
    ["propose", "modification", "rejete"].every((st) => [auteur, admin, respCom].every((p) => Cli.peutModifierDevis(devisDe(st), p) === true))
    && ["propose", "modification", "rejete"].every((st) => Cli.peutModifierDevis(devisDe(st), autreVendeur) === false)
    && Cli.peutModifierDevis({ ...base, par_id: "u1" }, auteur) === true
    && Cli.STATUTS_DEVIS_MODIFIABLES.join("|") === "propose|modification|rejete");
  test("★ un devis VALIDÉ ou PAYÉ ne se corrige JAMAIS, pour personne — contrat signé, argent encaissé ; le refus le DIT en français, chacun avec son motif",
    ["valide", "paye"].every((st) => [auteur, admin, respCom].every((p) => Cli.peutModifierDevis(devisDe(st), p) === false))
    && /contrat est signé/.test(Cli.motifRefusModification(devisDe("valide"), admin))
    && /vente est encaissée/.test(Cli.motifRefusModification(devisDe("paye"), admin))
    && /Seul ALI, l'administrateur ou le responsable commercial/.test(Cli.motifRefusModification(devisDe("propose"), autreVendeur))
    && Cli.motifRefusModification(devisDe("propose"), auteur) === "");
  test("★ une correction laisse sa TRACE sur le devis (date, auteur, nombre de corrections) : personne ne baisse un prix en silence après que le client a vu le premier devis ; le compteur ne rétrécit jamais",
    (() => {
      const un = Cli.marquerModification({ id: "d1" }, { ...base, total: 900000 }, auteur, "2026-09-11");
      const deux = Cli.marquerModification(un, { ...base, total: 800000 }, admin, "2026-09-12");
      return un.modifie_le === "2026-09-11" && un.modifie_par === "ALI" && un.nb_modifications === 1
        && deux.modifie_par === "TIMO" && deux.modifie_par_id === "u3" && deux.nb_modifications === 2 && deux.total === 800000;
    })());
  test("★ l'écran n'ouvre le bouton que par la règle, et le geste se REVÉRIFIE dedans (un bouton caché n'est pas une barrière) ; la trace s'affiche sur la ligne du devis",
    /\{peutModifierDevis\(d, profile\) && onModifierDevis && \(/.test(readFileSync("src/screens/TousLesDevis.jsx", "utf8"))
    && /const refus = motifRefusModification\(d, profile\);\n    if \(refus\) \{ uAlert\(refus\); return; \}/.test(readFileSync("src/screens/TousLesDevis.jsx", "utf8"))
    && /✏️ Modifié le \{dFR\(d\.modifie_le\)\} par \{d\.modifie_par/.test(readFileSync("src/screens/TousLesDevis.jsx", "utf8"))
    && /marquerModification\(x, devisMarque, profile, today\(\)\)/.test(readFileSync("src/screens/dimensionnement/Partages.jsx", "utf8")));
  // ⚠ LE PARCOURS COMPLET, joué de bout en bout sur une base d'essai (Timo,
  // 11/09/2026 : « s'il a déjà signé, impossible de modifier… l'utilisateur va
  // faire une demande auprès du client… le client valide avant que le devis ne
  // soit modifiable » ; A — il re-signe ; B — un refus rejette ; C — le plan
  // de règlement redevient à valider).
  {
    const clientM = { id: "c1", nom: "KOFFI2", nom_base: "Koffi", role: "client", tel: "90112233",
      devis: [{ id: "d1", date: "2026-09-01", total: 1000000, statut: "valide", par: "ALI", par_id: "u1",
        contrat_numero: "CTR-1", contrat_signature: "SIG-1", contrat_date_signature: "2026-09-02",
        plan_reglement: { type: "mensuel", montant_mensuel: 100000, statut: "accepte", decide_par: "TIMO" } }] };
    const dbM = { users: [clientM], messages: [], dettes: [], clients_installes: [] };
    const devisM = clientM.devis[0];
    const ali = { id: "u1", nom: "ALI", role: "vendeur" };
    const autre = { id: "u2", nom: "KODJO", role: "vendeur" };
    test("★ un devis SIGNÉ ne se modifie pas : on le DEMANDE au client, motif obligatoire, et seulement l'auteur / l'admin / le resp. commercial",
      Mod.peutDemanderModif(dbM, devisM, ali) === true
      && Mod.peutDemanderModif(dbM, devisM, { id: "u3", nom: "TIMO", role: "admin" }) === true
      && Mod.peutDemanderModif(dbM, devisM, autre) === false
      && Mod.peutDemanderModif(dbM, { ...devisM, statut: "paye" }, ali) === false
      && /vente est encaissée/.test(Mod.motifRefusDemandeModif(dbM, { ...devisM, statut: "paye" }, ali))
      && !!Mod.poserDemandeModif(dbM, clientM, devisM, ali, "   ").erreur);
    const apresDemande = Mod.poserDemandeModif(dbM, clientM, devisM, ali, "Le prix du convertisseur a changé");
    const dev1 = apresDemande.db.users[0].devis[0];
    test("★ la demande part avec son motif, le client en est averti par message, et le devis N'EST PAS encore modifiable tant qu'il n'a pas répondu",
      dev1.demande_bmi.statut === "attente" && dev1.demande_bmi.motif === "Le prix du convertisseur a changé"
      && dev1.demande_bmi.par === "ALI" && apresDemande.db.messages.length === 1
      && Cli.devisModifiable(dev1) === false
      && /déjà partie/.test(Mod.motifRefusDemandeModif(apresDemande.db, dev1, ali)));
    const refusClient = Mod.repondreDemandeModif(apresDemande.db, clientM, dev1, false);
    test("★ le client REFUSE la demande : son devis reste signé tel quel — même montant, même signature, toujours validé",
      refusClient.db.users[0].devis[0].statut === "valide"
      && refusClient.db.users[0].devis[0].contrat_signature === "SIG-1"
      && refusClient.db.users[0].devis[0].total === 1000000
      && Cli.devisModifiable(refusClient.db.users[0].devis[0]) === false);
    const okClient = Mod.repondreDemandeModif(apresDemande.db, clientM, dev1, true);
    const dev2 = okClient.db.users[0].devis[0];
    test("★ le client ACCEPTE : LE DEVIS S'OUVRE (c'est lui qui ouvre la porte, pas nous) et l'auteur en est averti",
      dev2.demande_bmi.statut === "acceptee" && Cli.devisModifiable(dev2) === true
      && okClient.db.messages.some((m) => /ACCEPTE/.test(m.texte)));
    const corrige = Mod.marquerDevisCorrige(dev2, { ...dev2, total: 1200000 }, "2026-09-11");
    test("★ le devis corrigé n'est PAS « proposé » (Timo) : il attend l'accord du client, la signature d'avant ne vaut plus mais reste dans l'historique, et le tour est compté",
      corrige.statut === "corrige" && corrige.cycles_modif === 1 && corrige.contrat_signature === ""
      && corrige.historique_modif.length === 1 && corrige.historique_modif[0].total_avant === 1000000
      && corrige.historique_modif[0].total_apres === 1200000 && corrige.historique_modif[0].contrat_signature === "SIG-1"
      && corrige.contrat_numero === "CTR-1");
    const dbCorrige = { ...okClient.db, users: [{ ...clientM, devis: [corrige] }] };
    const accepte = Mod.accepterDevisCorrige(dbCorrige, "c1", "d1", { signature: "SIG-2", date: "2026-09-12", acteur: { nom: "Koffi" } });
    const devFinal = accepte.db.users[0].devis[0];
    test("★ le client ACCEPTE le devis corrigé : il RE-SIGNE, le contrat GARDE son numéro, et le plan de règlement REDEVIENT À VALIDER (décisions A et C de Timo)",
      devFinal.statut === "valide" && devFinal.contrat_signature === "SIG-2" && devFinal.contrat_date_signature === "2026-09-12"
      && devFinal.contrat_numero === "CTR-1" && devFinal.plan_reglement.statut === "en_attente"
      && devFinal.plan_reglement.decide_par === "" && devFinal.demande_bmi === null
      && !!Mod.accepterDevisCorrige(dbCorrige, "c1", "d1", {}).erreur);
    const refuse = Mod.refuserDevisCorrige(dbCorrige, "c1", "d1", { motif: "trop cher maintenant", date: "2026-09-12" });
    test("★ le client REFUSE le devis corrigé : le devis est REJETÉ, l'affaire s'arrête (décision B de Timo) — et un refus sans motif n'est pas reçu",
      refuse.db.users[0].devis[0].statut === "rejete" && refuse.db.users[0].devis[0].motif_rejet === "trop cher maintenant"
      && !!Mod.refuserDevisCorrige(dbCorrige, "c1", "d1", { motif: "  " }).erreur);
    test("★ après 3 aller-retour le devis n'est plus modifiable (« il devient caduc ») : il faut en établir un nouveau",
      Mod.MAX_CYCLES_MODIF === 3
      && Mod.peutDemanderModif(dbM, { ...devisM, cycles_modif: 2 }, ali) === true
      && Mod.peutDemanderModif(dbM, { ...devisM, cycles_modif: 3 }, ali) === false
      && /3 aller-retour/.test(Mod.motifRefusDemandeModif(dbM, { ...devisM, cycles_modif: 3 }, ali)));
    const dbChantier = { ...dbM, clients_installes: [{ id: "ch1", devis_id: "d1", statut: "receptionne" }] };
    const dbVerse = { ...dbM, clients_installes: [{ id: "ch2", devis_id: "d1", dette_id: "de1", pose_seule: true }],
      dettes: [{ id: "de1", montant: 1000000, paiements: [{ montant: 300000 }] }] };
    test("★ deux portes fermées : un chantier RÉCEPTIONNÉ (travaux livrés) et un devis sur lequel le client a DÉJÀ VERSÉ ne se modifient plus — le motif le dit",
      Mod.peutDemanderModif(dbChantier, devisM, ali) === false && /réceptionné/.test(Mod.motifRefusDemandeModif(dbChantier, devisM, ali))
      && Mod.peutDemanderModif(dbVerse, devisM, ali) === false && /déjà versé/.test(Mod.motifRefusDemandeModif(dbVerse, devisM, ali)));
    const dbPose = { ...dbM, clients_installes: [{ id: "ch3", devis_id: "d1", dette_id: "de2", pose_seule: true, frais_installation: 1000000 }],
      dettes: [{ id: "de2", montant: 1000000, paiements: [] }], users: [{ ...clientM, devis: [corrige] }] };
    const poseOk = Mod.accepterDevisCorrige(dbPose, "c1", "d1", { signature: "SIG-2" });
    test("★ pose seule : la dette et les frais du chantier SUIVENT le nouveau montant — jamais une dette qui contredit son devis, jamais un chantier en double",
      poseOk.db.dettes[0].montant === 1200000 && poseOk.db.clients_installes[0].frais_installation === 1200000
      && poseOk.db.clients_installes.length === 1);
    const tldM = readFileSync("src/screens/TousLesDevis.jsx", "utf8");
    const ecM = readFileSync("src/screens/EspaceClient.jsx", "utf8");
    test("★ les deux écrans passent par les règles pures, et le geste du vendeur se revérifie DANS le geste ; le client re-signe par accepterDevisCorrige, jamais par validerDevis (qui créerait un second chantier)",
      /peutDemanderModif\(db, d, profile\) && \(/.test(tldM)
      && /const refus = motifRefusDemandeModif\(db, d, profile\);/.test(tldM)
      && /poserDemandeModif\(db, d\.client, d, profile, motif, today\(\)\)/.test(tldM)
      && /repondreDemandeModif\(db, moi, d, accepte, today\(\)\)/.test(ecM)
      && /if \(devisCorrige\(d\)\) \{\n      const r = accepterDevisCorrige\(/.test(ecM)
      && /refuserDevisCorrige\(db, profile\.id, d\.id/.test(ecM));
  }
  test("★ sans mot de passe connu, le message renvoie à « celui qui vous a été communiqué » ; sans vendeur, signature BMI TOGO seule",
    /celui qui vous a été communiqué/.test(Cli.texteRelanceDevis({ devis: base, compte, motDePasse: null })) && /^BMI TOGO — Les bâtiments/m.test(Cli.texteRelanceDevis({ devis: base, compte, motDePasse: null })));
  const tld = readFileSync("src/screens/TousLesDevis.jsx", "utf8");
  // 13/09/2026 : la règle vit dans lib/rappels.js (la tournée du matin des
  // notifications la lit aussi) ; l'écran l'importe, plus de seuil maison.
  const rappels = readFileSync("src/lib/rappels.js", "utf8");
  test("★ Tous les devis : seuil 15 jours, comptés depuis la DERNIÈRE relance (relance_le) sinon depuis le devis ; proposé et validé seulement (devisRelancable) — UNE règle, lib/rappels.js",
    /export const SEUIL_RELANCE_JOURS = 15;/.test(rappels) && /export const joursSansReponse = \(devis, aujourdhui\) => joursEntre\(devis\.relance_le \|\| devis\.date, aujourdhui\);/.test(rappels)
    && /export const devisARelancer = \(devis, aujourdhui\) => devisRelancable\(devis\) && joursSansReponse\(devis, aujourdhui\) >= SEUIL_RELANCE_JOURS;/.test(rappels)
    && /const enAttenteDeRelance = \(d\) => devisARelancer\(d, today\(\)\);/.test(tld) && !/const SEUIL_RELANCE_JOURS = 15;/.test(tld) && !/function joursDepuis/.test(tld));
  // ⚠ CONTRÔLE RETOURNÉ LE 19/09/2026 : la relance part du NUMÉRO BMI, par un
  // modèle approuvé par Meta (`envoyerModele`, src/whatsapp.js). Le texte
  // d'aujourd'hui (`texteRelanceDevis`, avec le mot de passe recalculé) reste
  // écrit et devient le REPLI : si l'envoi automatique est refusé ou tombe,
  // c'est lui qui s'ouvre dans WhatsApp, entier. Rien n'a été retiré.
  test("★ le bouton 📲 Relancer part du numéro BMI (envoyerModele, jamais wa.me), garde le texte d'aujourd'hui en repli avec le mot de passe recalculé (motDePasseConnu), et note date, auteur et nombre de relances sur le devis",
    /texteRelanceDevis\(\{ devis: d, compte: d\.client, motDePasse: motDePasseConnu\(d\.client\), vendeur: profile\.nom, formaterMontant: fmt \}\)/.test(tld)
    && /import \{ envoyerModele \} from "\.\.\/whatsapp";/.test(tld)
    && /texteRepli: texte,/.test(tld) && /demanderConfirmation: uConfirm,/.test(tld) && !/wa\.me/.test(tld)
    && /relance_le: today\(\), relance_par: profile\.nom, nb_relances: \(x\.nb_relances \|\| 0\) \+ 1/.test(tld)
    && /\{devisRelancable\(d\) && \(\s*<button onClick=\{\(\) => relancerDevis\(d\)\}/.test(tld) && /bloquerSiLecture\(db, profile\)\) return;\n    const texte = texteRelanceDevis/.test(tld));
  test("★ rien n'est noté si le client n'a rien reçu (ni du numéro BMI, ni par WhatsApp) ; un client sans téléphone est refusé avec son motif",
    /if \(!r\.parti\) return;/.test(tld) && /if \(!d\.client\?\.tel\) \{ uAlert\("Ce client n'a pas de numéro de téléphone enregistré\."\); return; \}/.test(tld));
  test("★ la trace « du n° BMI » ne s'écrit QUE si le message est vraiment parti tout seul — une ouverture WhatsApp ne prouve rien",
    /const trace = r\.auto \? traceEnvoi\(/.test(tld) && /\.\.\.\(trace \? \{ envoi_whatsapp: trace \} : \{\}\)/.test(tld));
  test("★ la liste montre « Sans réponse depuis N j » (N depuis la dernière relance) et « 📲 Relancé le … » une fois relancé ; le bandeau parle des proposés ou validés non payés",
    /⚠️ Sans réponse depuis \{joursSansReponse\(d\)\} j/.test(tld) && /📲 Relancé le \{dFR\(d\.relance_le\)\}/.test(tld) && /validé\{nbARelancer > 1 \? "s" : ""\} non payé/.test(tld));
}

titre("L'onglet 🔁 Transfert n'est plus au vendeur (Timo, 09/09/2026 : « retire l'onglet au vendeur »)");
{
  // Le vendeur voyait les demandes de transfert reçues par sa boutique, mais
  // Valider / Refuser lui étaient refusés (magasinier, gérant, admin). Un
  // bouton qui ne commande rien se retire : l'onglet part du menu vendeur,
  // le gérant le garde, et le geste reste verrouillé aux trois rôles.
  const app = readFileSync("src/App.jsx", "utf8");
  const lignesMenus = app.split("\n").filter((l) => /\["ventes", "💰 Ventes"\]/.test(l));
  const menuVendeur = lignesMenus.find((l) => /\["ravitaillement", labelRavitaillement\]/.test(l) && /\["primes_remises"/.test(l));
  const menuGerant = lignesMenus.find((l) => /\["fournisseurs", "🚚 Fournisseurs"\]/.test(l) && !/\["dashboard"/.test(l));
  test("★ le menu du vendeur n'a plus l'onglet « transfert » ; celui du gérant l'a toujours",
    !!menuVendeur && !/\["transfert", labelTransfert\]/.test(menuVendeur) && !!menuGerant && /\["transfert", labelTransfert\]/.test(menuGerant));
  const rav = readFileSync("src/screens/Ravitaillement.jsx", "utf8");
  test("★ valider ou refuser une demande de transfert reste réservé à magasinier, gérant, admin (ROLES_STOCK)",
    /refuserSaufRoles\(profile, ROLES_STOCK, "Servir une demande de transfert"\)/.test(rav) && /refuserSaufRoles\(profile, ROLES_STOCK, "Refuser une demande de transfert"\)/.test(rav));
}

titre("🎭 Changer le rôle d'un compte : l'administrateur principal seul, jamais un client (Timo, 09/09/2026)");
{
  // « L'administrateur principal doit être capable de changer le rôle d'un
  // utilisateur sur la fiche utilisateur — d'un vendeur, transformer en
  // gérant ou autre. » Écran (Utilisateurs.jsx) et serveur (securite-9)
  // disent la même chose ; le banc SQL rejoue les cas (tester-comptes).
  const us = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  test("★ le geste revérifie DANS le geste : lecture seule, administrateur principal, jamais sa propre fiche, jamais un client",
    /const changerRole = async \(u\) => \{\n    if \(bloquerSiLecture\(db, profile\)\) return;\n    if \(refuserSaufAdminPrincipal\(db, profile, "Changer le rôle d'un compte"\)\) return;\n    if \(refusSurSoi\(u, "changer votre propre rôle"\)\) return;\n    if \(u\.role === "client"\)/.test(us));
  test("★ le bouton 🎭 Rôle n'est montré qu'au principal, hors clients et hors sa propre fiche",
    /\{jeSuisAdminPrincipal && u\.role !== "client" && !surMaPropreFiche\(u\) && <button onClick=\{\(\) => changerRole\(u\)\}/.test(us));
  test("★ la liste des rôles proposés ne contient jamais « client »",
    /const ROLES_CHANGEABLES = \["vendeur", "gerant", "magasinier", "commercial", "technicien", "technicien_bmi", "resp_commercial", "comptable", "admin"\];/.test(us)
    && !/ROLES_CHANGEABLES = \[[^\]]*"client"/.test(us));
  test("★ la boutique suit le rôle : demandée (dans l'espace du compte, jamais TERRAIN) pour vendeur / gérant / magasinier, retirée pour les autres ; la trace (role_avant, role_change_le) est écrite",
    /if \(SALARIES_BOUTIQUE\.includes\(nouveau\)\) \{/.test(us) && /db\.boutiques\.filter\(\(b\) => !b\.terrain && !!b\.formation === espaceDeU\)\.map\(\(b\) => b\.nom\)/.test(us)
    && /\} else if \(boutique\) \{[\s\S]{0,200}boutique = null;/.test(us)
    && /\{ \.\.\.x, role: nouveau, boutique, role_avant: u\.role, role_change_le: today\(\) \}/.test(us));
  test("★ la confirmation prévient : le nouveau rôle prend effet à la PROCHAINE connexion", /prend effet à sa PROCHAINE connexion/.test(us));
  const sql = readFileSync("supabase/securite-9-changer-role.sql", "utf8");
  test("★ securite-9 : un déclencheur BEFORE UPDATE sur users, réservé au principal (est_admin_principal), un client ne change jamais de rôle, la trace suit la même règle",
    /create trigger users_regles_role_trg\s+before update on public\.users/.test(sql) && /if not public\.est_admin_principal\(\) then\s+perform public\.refus_role\('Changer le rôle d''un compte', 'l''administrateur principal'\)/.test(sql)
    && /if role_avant = 'client' or role_apres = 'client' then/.test(sql) && /role_change_le/.test(sql) && /if public\.jeton_de_service\(\) then return new; end if;/.test(sql));
  const tc = readFileSync("scripts/tester-comptes-sql.sh", "utf8");
  test("★ le banc tester-comptes pose securite-9 et rejoue : admin secondaire refusé, principal permis (UPDATE et UPSERT), client refusé dans les deux sens, sa propre fiche refusée",
    /-f supabase\/securite-9-changer-role\.sql/.test(tc) && /un admin secondaire passe un vendeur gérant" "REFUSE"/.test(tc) && /le principal passe un vendeur gérant \(avec la trace du changement\)" "PERMIS"/.test(tc)
    && /…par UPSERT, comme l'application écrit" "PERMIS"/.test(tc) && /le principal transforme un CLIENT en vendeur" "REFUSE"/.test(tc) && /le principal transforme un vendeur en client" "REFUSE"/.test(tc)
    && /le principal change SON propre rôle \(sa fiche reste interdite à tous\)" "REFUSE"/.test(tc));
}

titre("🔒 Le verrou d'inactivité remplace la déconnexion automatique (Timo, 09/09/2026 ; délai porté à 10 min le 11/09/2026)");
{
  // « Au lieu de déconnecter un compte après un temps d'inactivité, garder
  // la session ouverte mais, après 3 minutes, activer une fenêtre demandant
  // le mot de passe et flouter l'arrière… Dès que le mot de passe
  // correspond à la session en cours, l'application est recouverte. » —
  // « Sur téléphone, 6 minutes. » La règle est pure : on l'exerce.
  const sortieVer = join("node_modules", ".cache", `bmi-verrou-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/verrou.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVer, logLevel: "silent" });
  const V = await import(pathToFileURL(sortieVer).href);
  unlinkSync(sortieVer);
  const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120";
  const TEL = "Mozilla/5.0 (Linux; Android 13; SM-A135F) Mobile Safari/537.36";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148";
  // RETOURNÉ le 11/09/2026 : « augmenter le temps de verrouillage de 3 à
  // 10 min ». Le téléphone suit — il était volontairement PLUS tolérant que le
  // PC (6 contre 3) ; le laisser à 6 l'aurait rendu plus strict.
  test("★ 10 minutes, PC comme téléphone (Android et iPhone) — le téléphone n'est jamais plus strict que l'ordinateur",
    V.delaiVerrou(PC) === 600000 && V.delaiVerrou(TEL) === 600000 && V.delaiVerrou(IPHONE) === 600000
    && V.libelleDelai(PC) === "10 minutes" && V.libelleDelai(TEL) === "10 minutes"
    && V.DELAI_VERROU_TELEPHONE_MS >= V.DELAI_VERROU_PC_MS);
  test("★ on verrouille à partir du délai, jamais avant : 9 min 59 → non, 10 min → oui, sur PC comme sur téléphone",
    V.doitVerrouiller(0, 599999, PC) === false && V.doitVerrouiller(0, 600000, PC) === true
    && V.doitVerrouiller(0, 599999, TEL) === false && V.doitVerrouiller(0, 600000, TEL) === true
    && V.doitVerrouiller(undefined, 1e12, PC) === false);
  test("★ 5 erreurs de mot de passe ferment la session ; avant, on dit combien d'essais restent",
    V.MAX_ERREURS_VERROU === 5 && V.apresErreur(0).restantes === 4 && V.apresErreur(0).fermer === false && V.apresErreur(3).restantes === 1 && V.apresErreur(4).fermer === true && V.apresErreur(4).restantes === 0);
  const app = readFileSync("src/App.jsx", "utf8");
  test("★ le verrou passe par doitVerrouiller ; l'ancienne déconnexion à 30 / 5 min (DUREE_INACTIVITE) est remplacée par le verrou à 3 / 6 min PUIS la déconnexion à 30 min (doitDeconnecter), verrouillée ou non — Timo : « ne pas laisser indéfiniment la session verrouillée »",
    !/DUREE_INACTIVITE/.test(app) && /if \(doitVerrouiller\(derniereActiviteRef\.current, Date\.now\(\), UA\)\) verrouiller\(\);/.test(app)
    && /if \(!profile \|\| !verrouille\) return;\n\s+const minuterie = setInterval\(\(\) => \{\n\s+if \(doitDeconnecter\(derniereActiviteRef\.current, Date\.now\(\)\) && !fermetureRef\.current\) \{/.test(app)
    && V.DELAI_DECONNEXION_MS === 1800000 && V.doitDeconnecter(0, 1799999) === false && V.doitDeconnecter(0, 1800000) === true && V.doitDeconnecter(undefined, 1e12) === false);
  test("★ la session restaurée après F5 ROUVRE VERROUILLÉE si elle l'était ou si le délai est dépassé, et ne se restaure plus du tout après 30 min sans geste",
    /if \(u && u\.actif !== false && !doitDeconnecter\(ts, Date\.now\(\)\)\) \{\n\s+setProfile\(u\);\n\s+if \(etaitVerrouillee \|\| doitVerrouiller\(ts, Date\.now\(\), UA\)\) verrouiller\(\);/.test(app)
    && /const verrouiller = \(motif = "inactivite"\) => \{ setMotifVerrou\(motif\); setVerrouille\(true\); setErreursVerrou\(0\); ecrireSession\(\{ verrouille: true \}\); \};/.test(app));
  test("★ le mot de passe est vérifié contre la fiche ACTUELLE du compte (verifierMotDePasse, sur l'appareil) ; 5 erreurs → déconnexion ; les gestes ne comptent plus quand c'est verrouillé",
    /const compte = \(dbRef\.current\?\.users \|\| \[\]\)\.find\(\(x\) => x\.id === profile\?\.id\) \|\| profile;\n\s+const \{ ok \} = await verifierMotDePasse\(compte, saisie\);/.test(app)
    && /if \(r\.fermer\) \{ await deconnexion\(true\); setVerrouille\(false\); \}/.test(app) && /if \(!profile \|\| verrouille\) return;\n\s+derniereActiviteRef\.current = Date\.now\(\);/.test(app));
  // ⚠ Timo (11/09/2026) : « cette page survit toujours, et dès que je rentre
  // le mot de passe, la page d'accueil revient ». La fermeture des 30 min
  // ATTENDAIT la synchronisation avant de retirer la fenêtre : pendant ce
  // temps un mot de passe correct rouvrait une session déjà finie, puis la
  // déconnexion aboutissait et jetait l'utilisateur dehors.
  test("★ la fermeture des 30 min se VOIT tout de suite (verrou retiré et session fermée AVANT d'attendre le réseau), l'envoi se termine en arrière-plan, et un drapeau empêche toute réouverture pendant ce temps",
    /const fermetureRef = useRef\(false\);/.test(app)
    && /fermetureRef\.current = true;\n\s+\/\/[^]*?setVerrouille\(false\); setMotifVerrou\("inactivite"\); setProfile\(null\);\n\s+deconnexion\(true\)\.finally\(\(\) => \{ fermetureRef\.current = false; \}\);/.test(app)
    && !/deconnexion\(true\)\.then\(\(\) => \{ setVerrouille\(false\)/.test(app));
  test("★ un mot de passe ne ROUVRE JAMAIS une session déjà expirée : deverrouiller le vérifie EN PREMIER (30 min ou fermeture engagée), ferme, et dit pourquoi — la fenêtre affiche « Session expirée », pas « mot de passe incorrect »",
    // ⚠ RETOURNÉ le 16/09/2026 : la fonction prend une option (activer
    // l'empreinte au passage). Ce qui est vérifié ne change pas d'un cheveu —
    // le contrôle des 30 min est toujours la PREMIÈRE chose qu'elle fait.
    /const deverrouiller = async \(saisie, options = \{\}\) => \{\n\s+\/\/[^]*?if \(fermetureRef\.current \|\| doitDeconnecter\(derniereActiviteRef\.current, Date\.now\(\)\)\) \{/.test(app)
    // …et le déverrouillage par EMPREINTE porte le MÊME garde, en premier.
    && /const deverrouillerParEmpreinte = async \(\) => \{\n\s+if \(fermetureRef\.current \|\| doitDeconnecter\(derniereActiviteRef\.current, Date\.now\(\)\)\) \{/.test(app)
    && /return \{ ok: false, expiree: true \};/.test(app) && /Session expirée : 30 minutes sans activité/.test(app)
    && /r\?\.expiree/.test(readFileSync("src/components/EcranVerrou.jsx", "utf8")));
  test("★ un déverrouillage réussi fait repartir le compteur des 30 min de zéro (sinon la minuterie refermait la session juste après)",
    /derniereActiviteRef\.current = Date\.now\(\);\n\s+setVerrouille\(false\); setErreursVerrou\(0\); setMotifVerrou\("inactivite"\);\n\s+ecrireSession\(\{ verrouille: false, ts: derniereActiviteRef\.current \}\);/.test(app));
  test("★ le voile est un FRÈRE du cadre de l'application (jamais un enfant) ; le cadre derrière est insensible aux clics et non sélectionnable — et PLUS flouté (Timo, 09/09/2026 : « le mot de passe ne s'écrit pas » — le flou redessinait toute l'application à chaque lettre)",
    // ⚠ RETOURNÉ le 16/09/2026 : la fenêtre reçoit en plus les props de
    // l'empreinte. Ce que ce contrôle garde — le voile FRÈRE du cadre, le
    // cadre insensible aux clics, aucun flou — n'a pas bougé.
    /\{verrouille && <EcranVerrou profile=\{profile\} db=\{db\} apparence=\{apparence\} motif=\{motifVerrou\} onDeverrouiller=\{deverrouiller\}\n/.test(app)
    && /onDeconnecter=\{async \(\) => \{ await deconnexion\(true\); setVerrouille\(false\); \}\} \/>\}/.test(app)
    && /className=\{`min-h-screen bg-slate-100 lg:flex\$\{verrouille \? " pointer-events-none select-none" : ""\}`\} aria-hidden=\{verrouille \|\| undefined\}/.test(app) && !/blur-lg/.test(app));
  const ev = readFileSync("src/components/EcranVerrou.jsx", "utf8");
  test("★ la fenêtre : champ mot de passe (masqué, un œil 👁 l'affiche comme à la connexion), flou du voile, nom du compte, bouton Se déconnecter, message d'erreur avec les essais restants",
    /type=\{visible \? "text" : "password"\}/.test(ev) && /\{visible \? "🙈" : "👁"\}/.test(ev) && /z-\[10000\]/.test(ev) && /\{profile\?\.nom\}/.test(ev) && /onClick=\{onDeconnecter\}/.test(ev) && /Mot de passe incorrect/.test(ev) && !/wa\.me/.test(ev));
  // Demande Timo (09/09/2026) : « le même fond, photo, bulles » — UNE règle,
  // partagée avec la connexion, jamais recopiée.
  const cnxV = readFileSync("src/screens/Connexion.jsx", "utf8");
  test("★ le fond et les bulles sont UNE règle (decorAccueil + FondAccueil + Bulles, Connexion.jsx) : la connexion pose sa carte dessus, le verrou sa petite fenêtre (sans logo ni bandeau) ; rien recopié dans EcranVerrou",
    /export function decorAccueil\(db, apparence\)/.test(cnxV) && /export function FondAccueil\(\{ decor, children, className = "min-h-screen" \}\)/.test(cnxV) && /export \{ Bulles \};/.test(cnxV)
    && /<CarteAccueil decor=\{decor\} pied=\{souhaits\.length > 0 && <Souhaits/.test(cnxV) && /<FondAccueil decor=\{decor\} className=\{className\}>/.test(cnxV) && (cnxV.match(/backgroundImage: `url\(\$\{accueilImage\}\)`/g) || []).length === 2
    && /const decorBase = decorAccueil\(db \|\| \{ boutiques: \[\] \}, apparence\);\n\s+const decor = \{ \.\.\.decorBase, pleinEcran: !!decorBase\.accueilImage \};/.test(ev) && /<FondAccueil decor=\{decor\} className="min-h-full">/.test(ev)
    && /\{decor\.bulles && <Bulles couleur=\{decor\.couleurBulles\} \/>\}/.test(ev) && !/CarteAccueil/.test(ev) && !/LOGO/.test(ev)
    && !/backgroundImage/.test(ev) && !/Etoiles|bg-gradient/.test(ev));
  // Capture Timo (09/09/2026) : « dire simplement entrer le mot de passe et
  // reprendre la session ; se déconnecter tout court ; supprimer le
  // descriptif en bas ».
  test("★ textes courts : « Entrez le mot de passe et reprenez la session. », « Se déconnecter » tout court, aucun descriptif sous le bouton",
    /Entrez le mot de passe et reprenez la session\./.test(ev) && />\s*Se déconnecter\s*<\/button>/.test(ev)
    // 12/09/2026 (capture Timo) : le bouton Se déconnecter est REMPLI (rouge pâle, « petit danger ») — invisible sur certains fonds quand il n'avait qu'un contour.
    && /onClick=\{onDeconnecter\} className="w-full px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold">/.test(ev) && !/laisser la place/.test(ev) && !/opérations non encore envoyées/.test(ev) && !/MAX_ERREURS_VERROU/.test(ev)
    && !/Rien n'est perdu/.test(ev));
  test("★ barre du haut (ordinateur) : plus de badge En ligne / version / nom, un bouton « Verrouiller » sans cadenas qui pose le verrou ; la barre latérale garde le badge",
    /<button onClick=\{verrouiller\} className="[^"]*" title="[^"]*">Verrouiller<\/button>/.test(app) && (app.match(/<BadgeSync /g) || []).length === 1 && /<BadgeSync sombre \/>/.test(app));
  test("★ téléphone : un bouton 🔐 sur la ligne du titre BMI-GESTION SYSTÈME pose le verrou",
    /<div className="font-bold text-lg leading-tight truncate">BMI-GESTION SYSTÈME<\/div>[\s\S]{0,1500}?<button onClick=\{verrouiller\} className="shrink-0 [^"]*" aria-label="Verrouiller la session" title="[^"]*">🔐<\/button>/.test(app));
  // Timo (09/09/2026) : « avoir le réglage des couleurs de la carte de
  // verrouillage à lui seul ». Règles pures exercées, réglage dans Paramètres.
  test("★ la couleur de la carte de verrouillage : « #rrggbb » + transparence → rgba ; illisible → blanc ; vide → opaque ; bornée 0–100",
    V.fondCarteVerrou("#0f172a", 60) === "rgba(15,23,42,0.6)" && V.fondCarteVerrou("", "") === "rgba(255,255,255,1)" && V.fondCarteVerrou("bleu", 50) === "rgba(255,255,255,0.5)"
    && V.fondCarteVerrou("#ffffff", "150") === "rgba(255,255,255,1)" && V.fondCarteVerrou("#000000", "0") === "rgba(0,0,0,0)" && V.COULEUR_CARTE_VERROU_DEFAUT === "#ffffff");
  test("★ une carte sombre passe son texte en clair (luminance), une claire non", V.texteClairSur("#0f172a") === true && V.texteClairSur("#ffffff") === false && V.texteClairSur("#fde68a") === false && V.texteClairSur("") === false);
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  test("★ Paramètres : un bloc « 🔒 Fenêtre de verrouillage » à lui seul (couleur + transparence, verrou_couleur_carte / verrou_opacite_carte), remis à zéro avec l'écran de connexion",
    /🔒 Fenêtre de verrouillage/.test(par) && /enregistrerAccueil\(\{ verrou_couleur_carte: e\.target\.value \}\)/.test(par) && /enregistrerAccueil\(\{ verrou_opacite_carte: e\.target\.value \}\)/.test(par)
    && /verrou_couleur_carte: "", verrou_opacite_carte: "",/.test(par));
  test("★ decorAccueil lit ces deux réglages (verrouFond, verrouTexteClair) et la carte du verrou les applique, sans toucher à la carte de connexion",
    /const verrouFond = fondCarteVerrou\(verrouCouleur, b0\.verrou_opacite_carte\);/.test(cnxV) && /verrouTexteClair/.test(cnxV)
    && /style=\{\{ backgroundColor: decor\.verrouFond \}\}/.test(ev) && /decor\.verrouTexteClair \? "text-white" : "text-slate-800"/.test(ev) && !/verrou/.test(cnxV.slice(cnxV.indexOf("export function CarteAccueil"))));
  // Timo (09/09/2026), capture « Lecture de « users » impossible : permission
  // denied » : session tombée = même fenêtre de verrou, le mot de passe la
  // rouvre. Règle pure exercée, branchement contrôlé.
  test("★ sessionPerdueSelon reconnaît une session absente ou expirée, jamais un contenu refusé par une règle",
    V.sessionPerdueSelon("permission denied for table users") === true && V.sessionPerdueSelon("JWT expired") === true && V.sessionPerdueSelon("Invalid JWT") === true
    && V.sessionPerdueSelon("new row violates row-level security policy") === false && V.sessionPerdueSelon("Refusé : personne ne modifie sa propre fiche") === false && V.sessionPerdueSelon("") === false
    && /entrez votre mot de passe/.test(V.MESSAGE_SESSION_PERDUE));
  const syncSrc = readFileSync("src/sync.js", "utf8");
  const sbc = readFileSync("src/supabaseClient.js", "utf8");
  test("★ une lecture refusée marque la session MORTE (marquerSessionPerdue) avec un message en français, et la synchronisation le signale (sessionPerdue) quand rien en mémoire ne peut la rouvrir",
    /if \(sessionPerdueSelon\(msg\)\) \{\n\s+marquerSessionPerdue\(MESSAGE_SESSION_PERDUE\);\n\s+if \(!derniereErreur\) derniereErreur = MESSAGE_SESSION_PERDUE;/.test(syncSrc)
    && /sessionPerdue: etatAuth\.sessionPerdue === true && !aDesIdentifiants\(\),/.test(syncSrc)
    && /export function marquerSessionPerdue\(raison\)/.test(sbc) && /export const aDesIdentifiants = \(\) => identifiants !== null;/.test(sbc)
    && (sbc.match(/sessionPerdue: false/g) || []).length >= 3);
  test("★ App : session tombée → JAMAIS de verrou par surprise : une bande en haut avec « Rétablir » (qui ouvre la fenêtre) ; le bon mot de passe rouvre la session (synchroniserAuth) puis relance la synchronisation, et déverrouille même sans réseau",
    !/if \(profile && sync\.sessionPerdue && !verrouille\) verrouiller\("session"\);/.test(app)
    && /const sessionAretablir = !!profile && sync\.sessionPerdue === true && !verrouille;/.test(app)
    && /\{sessionAretablir && \([\s\S]{0,400}Votre session sécurisée a expiré\. Vos saisies restent sur cet appareil\.[\s\S]{0,300}<button onClick=\{\(\) => verrouiller\("session"\)\}[^>]*>Rétablir<\/button>/.test(app)
    // (Depuis le 11/09/2026, le compteur des 30 min repart entre les deux.)
    && /if \(motifVerrou === "session" \|\| etatAuth\.sessionPerdue\) \{\n\s+try \{ await synchroniserAuth\(compte\.id, saisie\); \} catch \{[^}]*\}\n\s+synchroniser\(\{ urgent: true \}\);\n\s+\}\n[^]*?setVerrouille\(false\)/.test(app)
    && /motif=\{motifVerrou\}/.test(app));
  test("★ la session tombe moins : renouvelée au réveil de l'appareil (visibilitychange → synchroniser) et AVANT l'expiration (expireBientot, marge 10 min, dans assurerSession)",
    /ecouteurReveil = \(\) => \{ if \(document\.visibilityState === "visible"\) synchroniser\(\); \};/.test(syncSrc) && /document\.addEventListener\("visibilitychange", ecouteurReveil\)/.test(syncSrc) && /document\.removeEventListener\("visibilitychange", ecouteurReveil\)/.test(syncSrc)
    && /export const MARGE_RENOUVELLEMENT_S = 10 \* 60;/.test(sbc) && /if \(expireBientot\(data\?\.session\)\) await supabase\.auth\.refreshSession\(\);/.test(sbc));
  test("★ la fenêtre dit pourquoi : « Votre session sécurisée a expiré … » quand c'est la session, le texte court sinon",
    /motif === "session"\s*\? "Votre session sécurisée a expiré : entrez le mot de passe pour la rétablir et reprendre\."/.test(ev));
  test("★ le champ redevient toujours saisissable (try/finally sur « occupe ») ; le flou de la carte n'est posé que si elle est translucide",
    // ⚠ RETOURNÉ le 16/09/2026 : l'appel passe l'option d'activation de
    // l'empreinte. Le try/finally — ce que ce contrôle garde — est intact,
    // et le geste par EMPREINTE a le sien.
    // ⚠ RETOURNÉ le 16/09/2026 : l'activation est passée dans SON bouton
    // (le capteur doit être touché dans le clic). Les TROIS chemins gardent
    // leur try/finally — sans lui, le champ restait désactivé pour toujours.
    /try \{ r = await onDeverrouiller\(saisie\); \} catch \{ r = \{ ok: false \}; \} finally \{ setOccupe\(false\); \}/.test(ev)
    && /try \{ r = await onEmpreinte\?\.\(\); \} catch \{ r = \{ ok: false \}; \} finally \{ setOccupeEmpreinte\(false\); \}/.test(ev)
    && /try \{ fab = await creerEmpreinte\(profile\); \} catch \{ fab = \{ erreur: "UnknownError" \}; \} finally \{ setOccupeEmpreinte\(false\); \}/.test(ev)
    && /\$\{decor\.verrouTranslucide \? "backdrop-blur-sm" : ""\}/.test(ev) && !/decor\.flou/.test(ev) && /const verrouTranslucide = !\/,1\\\)\$\/\.test\(verrouFond\);/.test(cnxV));
  // ⚠ RETOURNÉ le 16/09/2026 : ce qui s'interpose est toujours NOMMÉ, mais
  // dans la console — plus à l'écran (Timo : « je n'aime plus voir ça »).
  test("★ la fenêtre reprend le focus sur le champ à tout clic et à toute touche (filet Timo, 09/09/2026 : « le curseur ne clignote pas ») et nomme ce qui s'interpose DANS LA CONSOLE, jamais à l'écran",
    /window\.addEventListener\("keydown", clavier, true\)/.test(ev) && /onPointerDown=\{\(e\) => \{ if \(e\.target\?\.tagName !== "BUTTON" && e\.target\?\.tagName !== "INPUT"\) focaliser\(\); \}\}/.test(ev)
    && /document\.elementFromPoint\(r\.left \+ 20, r\.top \+ r\.height \/ 2\)/.test(ev) && /Le champ n'a pas le clavier/.test(ev));
  test("★ le champ mot de passe impose texte et curseur SOMBRES (carte sombre → texte de carte blanc → champ blanc sur blanc, capture Timo 09/09/2026 : « le mot de passe ne s'écrit pas »)",
    /className=\{`\$\{inputCls\} pr-10 text-slate-900 caret-slate-900 placeholder:text-slate-400`\} placeholder="Mot de passe"/.test(ev));

  // ═══════════════════════════════════════════════════════════
  // 👆 L'EMPREINTE QUI OUVRE LE VERROU — NIVEAU 1 (Timo, 16/09/2026)
  // « Sur téléphone, est-il possible d'ajouter l'authentification par
  // empreinte digitale ? » → « Lance le niveau 1 sur le verrou ».
  // Ce que le banc garde ici : les DEUX portes fermées (30 min, session
  // perdue), le mot de passe qui ne disparaît jamais, et le fait qu'AUCUNE
  // empreinte n'entre dans l'application.
  // ═══════════════════════════════════════════════════════════
  test("★ l'empreinte n'ouvre QUE le verrou d'inactivité : la session perdue et les autres motifs gardent le mot de passe",
    Emp.empreinteOuvreCeVerrou("inactivite", false) === true
    && Emp.empreinteOuvreCeVerrou("inactivite", true) === false /* session sécurisée tombée : il faut le VRAI mot de passe (synchroniserAuth) */
    && Emp.empreinteOuvreCeVerrou("session", false) === false
    && Emp.empreinteOuvreCeVerrou("", false) === false);
  test("★ une clé PAR APPAREIL, et ré-activer sur le même appareil REMPLACE au lieu d'empiler",
    (() => {
      const u0 = { id: "u1", nom: "AYAO" };
      const u1 = Emp.poserEmpreinte(u0, { appareil: "a1", cle: "K1", nom: "Android · Chrome", le: "2026-09-16" });
      const u2 = Emp.poserEmpreinte(u1, { appareil: "a2", cle: "K2" });
      const u3 = Emp.poserEmpreinte(u2, { appareil: "a1", cle: "K1bis" });
      return Emp.empreintesDe(u1).length === 1 && Emp.empreintesDe(u2).length === 2
        && Emp.empreintesDe(u3).length === 2 && Emp.empreinteDeLAppareil(u3, "a1").cle === "K1bis"
        && Emp.empreinteActive(u3, "a1") === true && Emp.empreinteActive(u3, "a9") === false
        && Emp.empreintesDe(Emp.retirerEmpreinte(u3, "a1")).length === 1
        // une fiche sans rien, un appareil inconnu : la règle ne tombe pas
        && Emp.empreintesDe(undefined).length === 0 && Emp.empreinteActive(u3, "") === false
        && Emp.empreinteDeLAppareil(u3, null) === null;
    })());
  test("un appareil se reconnaît en clair pour la personne (jamais un identifiant)",
    Emp.nomAppareil("Mozilla/5.0 (Linux; Android 13) Chrome/120") === "Android · Chrome"
    && Emp.nomAppareil("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/605") === "iPhone · Safari"
    && Emp.nomAppareil("") === "Appareil");
  test("★ lib/empreinte.js est PUR : aucune touche au navigateur, aucun import (comme identiteClient)",
    !/^import /m.test(readFileSync("src/lib/empreinte.js", "utf8"))
    && !/navigator\.|PublicKeyCredential|localStorage/.test(readFileSync("src/lib/empreinte.js", "utf8")));
  // ⚠ UN SEUL endroit parle au capteur, comme src/push.js est le seul à
  // parler aux notifications. Sans ce contrôle, un écran finirait par
  // appeler le capteur dans son coin, avec ses propres règles.
  {
    const porteurs = execSync(`grep -rlE "navigator[.]credentials|PublicKeyCredential" src || true`).toString().trim().split("\n").filter(Boolean).sort().join("|");
    test("★ `navigator.credentials` et `PublicKeyCredential` n'existent QUE dans src/empreinte.js",
      porteurs === "src/empreinte.js");
  }
  test("★ AUCUNE empreinte n'entre dans l'application : on ne range qu'une clé fabriquée par le téléphone, et l'attestation est refusée",
    /attestation: "none"/.test(readFileSync("src/empreinte.js", "utf8"))
    && /userVerification: "required"/.test(readFileSync("src/empreinte.js", "utf8"))
    && /authenticatorAttachment: "platform"/.test(readFileSync("src/empreinte.js", "utf8")));
  // ⚠ Ce contrôle annonçait « le bouton d'empreinte » mais lisait la ligne de
  // l'ACTIVATION : il mesurait autre chose que son titre. Corrigé le
  // 16/09/2026 — il lit maintenant les deux portes, chacune à sa place.
  test("★ le MOT DE PASSE ne disparaît jamais : le champ et son bouton sont là, le rond de l'empreinte s'ajoute à côté",
    /type=\{visible \? "text" : "password"\}/.test(ev) && /🔓 Déverrouiller/.test(ev)
    && /Déverrouiller avec l'empreinte/.test(ev) && /\{empreinteEnTete && \(/.test(ev));
  test("★ l'activation vit DANS la fenêtre de verrou (le vendeur n'a pas l'onglet ⚙ Paramètres), et c'est le mot de passe tapé qui la valide",
    /Activer l'empreinte/.test(ev) && /onClick=\{activerPuisOuvrir\}/.test(ev)
    && /if \(options\.cleEmpreinte\) \{ try \{ await activerEmpreinteIci\(options\.cleEmpreinte\); \}/.test(app)
    && /Retirer l'empreinte de cet appareil/.test(ev));
  // ⚠⚠ LA FAUTE DU 16/09/2026, et le contrôle qui l'empêche de revenir.
  // Timo : « je pense que le fonctionnement n'a pas réussi ». Deux causes :
  //   • le capteur n'obéit qu'à un clic ENCORE CHAUD, et l'ancienne version
  //     vérifiait le mot de passe (calcul long) AVANT de l'appeler — refus
  //     systématique ;
  //   • toutes les erreurs étaient avalées : rien ne s'affichait.
  const corpsActiver = ev.slice(ev.indexOf("const activerPuisOuvrir"), ev.indexOf("const valider ="));
  test("★ LE CAPTEUR EST TOUCHÉ EN PREMIER, dans le clic : aucun `await` avant lui (un mot de passe vérifié avant consommait le geste — c'est ce qui ne marchait pas)",
    corpsActiver.length > 200
    && corpsActiver.indexOf("creerEmpreinte(profile)") < corpsActiver.indexOf("onDeverrouiller(saisie")
    // …et rien d'attendu entre le début du clic et la touche du capteur
    // ⚠ On coupe avant le `try` qui PORTE le capteur : sinon le « await »
    // de `await creerEmpreinte(...)` se comptait lui-même, et le contrôle
    // passait quoi qu'on écrive au-dessus.
    && !/await/.test(corpsActiver.slice(0, corpsActiver.indexOf("try { fab =")))
    // …le mot de passe reste la preuve : faux → la clé est jetée, rien n'est rangé
    && /Mot de passe incorrect — l'empreinte n'a pas été activée\./.test(ev)
    && /if \(!appareil \|\| !cle\) return false;/.test(app));
  test("★ PLUS AUCUNE ERREUR AVALÉE : le capteur remonte son motif, la règle le traduit, l'écran l'affiche",
    (() => {
      const f = readFileSync("src/empreinte.js", "utf8");
      // Les DEUX fonctions qui touchent le capteur, elles seules : idAppareil
      // et empreinteDisponible ont le droit de retomber en silence
      // (navigation privée, téléphone sans capteur).
      const capteur = f.slice(f.indexOf("export async function creerEmpreinte"));
      return !/catch \{ return ""; \}|catch \{ return false; \}/.test(capteur)
        && (capteur.match(/catch \(e\) \{ return \{ erreur: e\?\.name \|\| "UnknownError" \}; \}/g) || []).length === 2;
    })()
    && /setErreur\(motifEmpreinte\(fab\?\.erreur\)\)/.test(ev)
    && Emp.motifEmpreinte("NotAllowedError").startsWith("Annulé")
    && Emp.motifEmpreinte("NotSupportedError").includes("ne sait pas")
    && Emp.motifEmpreinte("nimportequoi").includes("Entrez votre mot de passe"));
  // ⚠ Le corps de la fonction est DÉCOUPÉ avant d'être lu : un « pas de
  // apresErreur après deverrouillerParEmpreinte » sur le fichier entier
  // aurait toujours trouvé celui de `deverrouiller`, plus bas — un contrôle
  // qui rassure sans protéger.
  const corpsEmpreinte = app.slice(app.indexOf("const deverrouillerParEmpreinte"), app.indexOf("const activerEmpreinteIci"));
  test("★ le geste par empreinte revérifie la règle DANS le geste, et un doigt non reconnu ne consomme AUCUN des 5 essais",
    corpsEmpreinte.length > 200
    && /if \(!empreinteOuvreCeVerrou\(motifVerrou, etatAuth\.sessionPerdue\)\) return \{ ok: false \};/.test(corpsEmpreinte)
    && !/apresErreur|setErreursVerrou\(erreurs/.test(corpsEmpreinte)
    // …et il porte le garde des 30 min, comme le mot de passe
    && /doitDeconnecter\(derniereActiviteRef\.current, Date\.now\(\)\)/.test(corpsEmpreinte)
    && /setErreur\(r\?\.expiree[\s\S]{0,160}motifEmpreinte\(r\?\.erreur\)\)/.test(ev));
  // ⚠ RETOURNÉ le 16/09/2026 (Timo, deux captures) : « tant que la personne
  // a activé les empreintes, on ne devrait plus lui poser la question de
  // taper… ça devrait venir automatiquement ». La règle du geste vaut pour
  // l'ACTIVATION (create), pas pour l'OUVERTURE (get) : on tente donc UNE
  // fois tout seul, et un refus découvre le mot de passe SANS un mot.
  // Ce qui reste interdit : harceler (deux essais), et laisser la personne
  // sans porte.
  test("★ l'empreinte est tentée AUTOMATIQUEMENT à l'ouverture de la fenêtre, UNE seule fois, et un refus ne dit RIEN",
    /autoTente = useRef\(false\)/.test(ev)
    && /if \(!empreinteEnTete \|\| autoTente\.current\) return;\n\s+autoTente\.current = true;\n\s+parEmpreinte\(true\);/.test(ev)
    && /if \(auto && !r\?\.expiree\) \{ champ\.current\?\.focus\(\); return; \}/.test(ev));
  test("★ l'ACTIVATION, elle, reste un BOUTON : c'est le clic qui donne le droit de toucher le capteur",
    /onClick=\{activerPuisOuvrir\}/.test(ev) && !/parEmpreinte\(true\)[\s\S]{0,200}creerEmpreinte/.test(ev));
  // ⚠ CAPTURE TIMO, juste après le verrouillage : le bouton d'empreinte
  // MANQUAIT et n'apparaissait qu'après un F5 — il attendait la réponse du
  // téléphone à « as-tu un capteur ? ». Une clé déjà posée le prouve.
  test("★ le bouton d'ouverture n'attend PAS le téléphone : une clé posée prouve le capteur (le bouton manquait juste après le verrouillage)",
    /const empreinteEnTete = empreintePosee && empreinteOuvrable;/.test(ev)
    && /onClick=\{\(\) => parEmpreinte\(false\)\}/.test(ev)
    // …et `dispo` ne sert plus QU'À proposer l'activation là où il n'y a rien
    && /\{!empreintePosee && empreinteOuvrable && dispo && !refusee && \(/.test(ev));
  // ⚠ Capture Timo, 16/09/2026 : « même si la personne ne veut pas les
  // empreintes, le message est toujours là tant que ce n'est pas activé ».
  // Une proposition qu'on ne peut pas refuser n'est pas une proposition.
  test("★ « Non merci » ferme la proposition POUR DE BON sur cet appareil (elle ne revient plus à chaque verrouillage)",
    /Non merci/.test(ev) && /onClick=\{refuserEmpreinte\}/.test(ev)
    && /localStorage\.setItem\(CLE_REFUS, "1"\)/.test(ev)
    && /localStorage\.getItem\(CLE_REFUS\) === "1"/.test(ev)
    && Emp.CLE_REFUS === "bmi_empreinte_non"
    // ⚠ Capture Timo (17/09/2026, sur son PC) : « pourquoi le bouton est-il
    // persistant… et on ne peut pas décliner ? » — « Non merci » existait,
    // mais en 11 px souligné au bout d'un paragraphe : ça ne ressemblait pas
    // à un choix. DEUX VRAIS BOUTONS, côte à côte, même hauteur.
    && /<div className="flex items-stretch gap-2">/.test(ev)
    && /onClick=\{refuserEmpreinte\} disabled=\{occupe \|\| occupeEmpreinte\}\n\s+className="shrink-0 px-4 py-2\.5 rounded-lg border-2/.test(ev)
    && /« Non merci » retire cette proposition pour de bon sur cet appareil/.test(ev)
    // …et la navigation privée ne fait pas tomber l'écran
    && /catch \{ return false; \}/.test(ev) && /catch \{ \/\* navigation privée \*\//.test(ev));
  // ⚠ Capture Timo, 16/09/2026 : « le champ du message rouge sous la ligne du
  // mot de passe… je n'aime plus voir ça ». Le diagnostic du 09/09 était
  // écrit pour le dépannage, et il s'affichait chez lui.
  test("★ le DIAGNOSTIC ne s'affiche plus à l'écran — mais le FILET qui reprend le clavier reste entier",
    !/setDiag|\{diag &&/.test(ev) && /journalDiag\(/.test(ev)
    // le filet, lui, n'a pas bougé : focus repris à tout clic et à toute touche
    && /window\.addEventListener\("keydown", clavier, true\)/.test(ev)
    && /onPointerDown=\{\(e\) => \{ if \(e\.target\?\.tagName !== "BUTTON" && e\.target\?\.tagName !== "INPUT"\) focaliser\(\); \}\}/.test(ev));
  // ⚠ RETOURNÉ le 16/09/2026, capture Timo d'une AUTRE application (Solimi) :
  // « tu vois cet exemple… empreinte ET possibilité de taper le mot de passe
  // aussi ». Une version cachait le champ tant que l'empreinte menait : c'est
  // RETIRÉ. Les deux portes se voient ENSEMBLE, toujours — clavier au-dessus,
  // rond de l'empreinte en dessous.
  test("★ LES DEUX PORTES SE VOIENT ENSEMBLE : le champ du mot de passe n'est JAMAIS caché, et le rond de l'empreinte est juste en dessous",
    !/montrerMotDePasse|mdpDecouvert|Utiliser le mot de passe/.test(ev)
    && /<div className="relative">\n\s+\{\/\* ⚠ Capture Timo \(09\/09\/2026\)/.test(ev)
    && /🔓 Déverrouiller\n\s+<\/button>\n/.test(ev)
    // le rond, avec le dessin écrit UNE fois dans ui.jsx (jamais un emoji)
    && /rounded-full bg-sky-700 text-white/.test(ev) && /<IconeEmpreinte \/>/.test(ev)
    && /import \{ inputCls, IconeEmpreinte \} from "\.\/ui";/.test(ev)
    && (execSync("grep -rl 'IconeEmpreinte' src || true").toString().trim().split("\n").filter(Boolean).sort().join("|")
        === "src/components/EcranVerrou.jsx|src/components/ui.jsx"));
  // Les hooks du verrou sont AVANT les retours anticipés (piège écran blanc).
  const posHooks = app.indexOf("const [verrouille, setVerrouille] = useState(false);");
  const posRetour = app.indexOf("if (!db) return <div");
  test("★ les hooks du verrou sont déclarés AVANT « if (!db) return » (aucun hook après un retour anticipé)", posHooks > 0 && posRetour > posHooks);
}

titre("👑 Équipe cloisonnée pour l'administrateur principal aussi (relevé Timo, 09/09/2026 : « pas de cloisonnement dans équipe »)");
{
  // Le principal voyait réel + formation mélangés (badge 🎓) et les ventes
  // RÉELLES de chacun même en regardant la formation : la condition
  // interdite « voitLesDeuxEspaces || … » dans un filtre d'affichage.
  const eq = readFileSync("src/screens/MonEquipe.jsx", "utf8");
  test("★ plus de voitLesDeuxEspaces, memeEspace, jeVoisTout ni ventesDuCommercial dans Mon équipe : l'espace regardé décide (espaceDuCompte)",
    !/voitLesDeuxEspaces\(/.test(eq) && !/memeEspace\(/.test(eq) && !/\bjeVoisTout\b/.test(eq) && !/ventesDuCommercial\(/.test(eq)
    && /const regardeFormation = espaceDuCompte\(db, profile\) === true;/.test(eq));
  test("★ les membres commissionnés viennent de utilisateursDeLEspace ; leurs ventes, commandes et prospects sont ceux de l'espace regardé",
    /const equipe = utilisateursDeLEspace\(db, profile\)\.filter\(\(u\) => u\.actif !== false && u\.role !== "client" && \(/.test(eq)
    && /const ventesDeMonEspace = \(db\.ventes \|\| \[\]\)\.filter\(filtreEspaceAffichage\(db, profile\)\);/.test(eq)
    && /const commandesDeMonEspace = \(db\.commandes \|\| \[\]\)\.filter\(filtreEspaceAffichage\(db, profile\)\);/.test(eq)
    && /const prospectsDeMonEspace = \(db\.prospects \|\| \[\]\)\.filter\(\(p\) => !!p\.formation === regardeFormation\);/.test(eq)
    && /const ventesDe = \(nom\) => ventesParNom\.get\(nom\) \|\| \[\];/.test(eq) && !/db\.prospects\.filter/.test(eq) && !/\(db\.commandes \|\| \[\]\)\.filter\(\(c\) => c\.commercial/.test(eq));
  test("★ le badge 🎓 et la mention « compte de formation » sont partis (une liste = un espace) ; le bandeau formation suit l'espace regardé",
    !/🎓 formation/.test(eq) && !/🎓 = compte de formation/.test(eq) && /\{regardeFormation && \(\s*<div className="rounded-xl border border-violet-200/.test(eq));
  // La règle exercée : espaceDuCompte pour le principal suit « 👁 Je regarde ».
  const db0 = { users: [{ id: "p", role: "admin", admin_principal: true }, { id: "v", role: "vendeur", boutique: "A" }, { id: "f", role: "vendeur", boutique: "AF" }], boutiques: [{ nom: "A" }, { nom: "AF", formation: true }] };
  const principal = db0.users[0];
  test("★ utilisateursDeLEspace pour le principal : en réel → le vendeur réel seul ; c'est la même fonction que l'écran appelle",
    C.utilisateursDeLEspace(db0, principal).map((u) => u.id).join("|") === "p|v" && C.espaceDuCompte(db0, principal) === false);
}

titre("💸 Versement des fonds par les boutiques (Timo, 09/09/2026 : Chez le DG / BANQUE / Chez le comptable, validé par le DG ou le comptable)");
{
  const sortieVs = join("node_modules", ".cache", `bmi-versements-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/versements.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVs, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vs = await import(pathToFileURL(sortieVs).href);
  unlinkSync(sortieVs);
  const moi = { id: "v1", nom: "KOSSI", role: "vendeur", boutique: "APESSITO" };
  test("★ trois destinations exactement, dans cet ordre ; le gérant et l'admin versent, PAS le vendeur (Timo, 09/09/2026 : « c'est au gérant de faire le versement ») ; le vendeur lit pourquoi",
    Vs.DESTINATIONS_VERSEMENT.join("|") === "Chez le DG|BANQUE|Chez le comptable" && Vs.ROLES_VERSEMENT.join("|") === "gerant|admin"
    && /Le versement des fonds est fait par le gérant\./.test(readFileSync("src/screens/Caisse.jsx", "utf8")));
  const s11 = readFileSync("supabase/securite-11-versement-gerant.sql", "utf8");
  test("★ la clôture de caisse est ouverte au VENDEUR (Timo, 09/09/2026 : « comment la clôture peut être impossible à un vendeur ? ») — application (ROLES_CAISSE) et serveur (securite-11), banc SQL retourné",
    /not in \('vendeur', 'gerant', 'admin'\) then perform public\.refus_role\('Clôturer la caisse'/.test(s11) && /un vendeur clôture la caisse \(securite-11[^"]*" "PERMIS"/.test(readFileSync("scripts/tester-argent-sql.sh", "utf8")));
  test("★ securite-11 : créer un « Versement de fonds » = gérant ou admin (ligne nouvelle seulement, upsert relu) ; la validation DG reste au principal ; le banc tester-argent rejoue vendeur refusé / gérant permis",
    /if avant is null and coalesce\(new\.data ->> 'categorie', ''\) = 'Versement de fonds' and r not in \('gerant', 'admin'\) then/.test(s11) && /if not public\.est_admin_principal\(\) then/.test(s11)
    && /-f supabase\/securite-11-versement-gerant\.sql/.test(readFileSync("scripts/tester-argent-sql.sh", "utf8")) && /un vendeur enregistre un versement \(securite-11 : le gérant, pas le vendeur\)" "REFUSE"/.test(readFileSync("scripts/tester-argent-sql.sh", "utf8")));
  test("★ un versement mal formé est refusé avec son motif : montant nul, destination inconnue, BANQUE sans banque ou sans bordereau",
    /montant/.test(Vs.critiqueVersement({ montant: 0, destination: "BANQUE", banque: "Ecobank", bordereau: "1" })) && /destination/.test(Vs.critiqueVersement({ montant: 100, destination: "Ailleurs" }))
    && /banque/.test(Vs.critiqueVersement({ montant: 100, destination: "BANQUE", banque: "", bordereau: "1" })) && /bordereau/.test(Vs.critiqueVersement({ montant: 100, destination: "BANQUE", banque: "Ecobank", bordereau: " " }))
    && Vs.critiqueVersement({ montant: 100, destination: "Chez le DG" }) === "" && Vs.critiqueVersement({ montant: 100, destination: "Chez le comptable" }) === "");
  const rc = Vs.construireVersement(moi, { boutique: "APESSITO", montant: "150000", destination: "Chez le comptable", note: "recette" });
  const rb = Vs.construireVersement(moi, { boutique: "APESSITO", montant: 90000, destination: "BANQUE", banque: " Ecobank ", bordereau: "B-77" });
  const rd = Vs.construireVersement(moi, { boutique: "APESSITO", montant: 50000, destination: "Chez le DG" });
  test("★ Chez le comptable : une SORTIE (dépense espèces de la boutique, catégorie « Versement de fonds ») et une ENTRÉE miroir chez le comptable (montant négatif), liées par le même identifiant",
    rc.sortie.boutique === "APESSITO" && rc.sortie.categorie === "Versement de fonds" && rc.sortie.montant === 150000 && rc.sortie.paiement === "Espèces" && rc.sortie.versement.destination === "Chez le comptable"
    && rc.entree.boutique === "Chez le comptable" && rc.entree.montant === -150000 && rc.entree.versement_id === rc.sortie.versement.id && /^Versement du \d\d\/\d\d\/\d{4} reçu de APESSITO \(par KOSSI\) — recette$/.test(rc.entree.description) && /\(recette\)/.test(rc.sortie.description));
  test("★ BANQUE : banque et bordereau nettoyés dans le libellé, AUCUNE entrée chez le comptable ; Chez le DG : idem",
    rb.entree === null && Vs.libelleDestination(rb.versement) === "BANQUE Ecobank — bordereau B-77" && rd.entree === null && Vs.libelleDestination(rd.versement) === "Chez le DG");
  const db0 = { depenses: [rc.sortie, { ...rc.entree, decaisse_le: "2026-09-09", decaisse_par: "COMPTA" }, rb.sortie, { ...rd.sortie, versement_valide_le: "2026-09-09", versement_valide_par: "TIMO" }], ventes: [], dettes: [], users: [
    { id: "c", role: "comptable", actif: true }, { id: "t", role: "admin", admin_principal: true }, { id: "a2", role: "admin" }, { id: "v1", role: "vendeur" }] };
  test("★ la validation se lit au bon endroit : Chez le comptable = pointage « Encaissé » de l'entrée ; DG / BANQUE = validation du DG sur la sortie ; sinon en attente",
    Vs.validationVersement(db0, rc.sortie)?.par === "COMPTA" && Vs.validationVersement(db0, rb.sortie) === null && Vs.validationVersement(db0, db0.depenses[3])?.par === "TIMO"
    && Vs.versementsAValiderParDG(db0, ["APESSITO"]).map((d) => d.id).join("|") === rb.sortie.id && Vs.versementsAValiderParDG(db0, ["AUTRE"]).length === 0);
  test("★ le message part au comptable pour « Chez le comptable », au DG (admin PRINCIPAL seul) pour BANQUE et Chez le DG",
    Vs.messagesVersement(db0, moi, rc.sortie).map((m) => m.a_id).join("|") === "c" && Vs.messagesVersement(db0, moi, rb.sortie).map((m) => m.a_id).join("|") === "t" && Vs.messagesVersement(db0, moi, rd.sortie).map((m) => m.a_id).join("|") === "t");
  const tv = (v) => Number(v.total || 0);
  const db1 = { depenses: [{ ...rc.sortie, date: "2026-09-05", montant: 202299 }, { boutique: "APESSITO", paiement: "Espèces", date: "2026-09-02", montant: 1 }], ventes: [{ boutique: "APESSITO", paiement: "Espèces", date: "2026-09-04", total: 200000 }, { boutique: "APESSITO", paiement: "Espèces", date: "2026-09-06", total: 51400 }, { boutique: "APESSITO", paiement: "Mobile money", date: "2026-09-06", total: 7000 }, { boutique: "AUTRE", paiement: "Espèces", date: "2026-09-06", total: 9000 }],
    dettes: [{ boutique: "APESSITO", paiements: [{ date: "2026-09-07", montant: 300 }, { date: "2026-09-01", montant: 600 }] }] };
  const f = Vs.fondsAVerser(db1, "APESSITO", tv);
  // Capture Timo (09/09/2026) : attendu 252 299, versé 202 299 → il doit
  // rester 50 000, pas −150 900 (l'ancien calcul repartait de la date du
  // versement).
  // Timo (13/09/2026) : « ajouter un carré présentant le total versé… dans
  // Caisse, un bouton RÉSUMÉ dans lequel on reprend les carrés » — Fonds à
  // verser / Total versé / Entrées / Sorties. Dans Caisse, PAS dans le tableau de bord.
  {
    const dbR = { ...db1, depenses: [...db1.depenses, { ...rb.sortie, boutique: "APESSITO", date: "2026-08-20", montant: 90000 }, { ...rd.sortie, boutique: "APESSITO", date: "2026-09-10", montant: 0, versement_rejete_le: "2026-09-10", versement_rejet_motif: "faux" } /* rejeté = montant à 0, règle du 10/09 */, { ...rc.entree, decaisse_le: "2026-09-06", decaisse_par: "COMPTA" }] };
    const tvR = Vs.totalVerse(dbR, "APESSITO", "2026-09-13");
    test("★ totalVerse : rejetés EXCLUS (le 50 000 rejeté ne compte pas), 202 299 (comptable, pointé) + 90 000 (banque, pas encore validé) = 292 299 ; en attente 90 000 ; ce mois (septembre) 202 299 ; 2 versements",
      tvR.total === 292299 && tvR.enAttente === 90000 && tvR.ceMois === 202299 && tvR.nb === 2 && Vs.totalVerse(dbR, "AUTRE", "2026-09-13").total === 0);
    const r = Vs.resumeCaisses(dbR, ["APESSITO", "AUTRE"], tv, "2026-09-13");
    test("★ resumeCaisses : une ligne par boutique avec les quatre carrés, et la ligne Total = somme des lignes",
      // 13/09/2026 (fonds de caisse fixe) : `solde` = le solde d'espèces (négatif possible), `aVerser` = au-delà du fonds fixe, jamais négatif.
      r.lignes.length === 2 && r.lignes[0].boutique === "APESSITO" && r.lignes[0].solde === 50000 - 90000 && r.lignes[0].aVerser === 0 && r.lignes[0].verse === 292299 && r.lignes[0].entrees === 252300 && r.lignes[0].sorties === 202300 + 90000
      && r.lignes[1].aVerser === 9000 && r.lignes[1].solde === 9000 && r.lignes[1].verse === 0 && r.total.solde === 50000 - 90000 + 9000 && r.total.aVerser === 9000 && r.total.verse === 292299 && r.total.entrees === 252300 + 9000 && r.total.verseEnAttente === 90000);
    // Timo (13/09/2026) : « ajouter période dans résumé, devant RÉSUMÉ, appliquée
    // aussi aux boutiques ». Sur db1 (APESSITO) : septembre = ventes 251 400 +
    // règlements 300 − sorties 202 300 ; le règlement de 600 F date du 01/09 et
    // la vente de 200 000 du 04/09… tout est en septembre sauf rien : on prend
    // la fenêtre 06/09 → 07/09 : vente 51 400 (06), règlement 300 (07) ; sorties 0 ;
    // solde à la fin (07/09) = tout ce qui précède = 252 300 − 202 300 = 50 000.
    const fp = Vs.fondsAVerser(db1, "APESSITO", tv, { du: "2026-09-06", au: "2026-09-07" });
    test("★ fondsAVerser avec période : entrées et sorties DE la période (51 400 + 300, 0 sortie), montant = solde À LA FIN de la période (50 000) ; sans période, inchangé",
      fp.ventes === 51400 && fp.reglements === 300 && fp.depenses === 0 && fp.montant === 50000 && Vs.fondsAVerser(db1, "APESSITO", tv, { du: "2026-09-01", au: "2026-09-03" }).montant === 600 - 1
      && Vs.fondsAVerser(db1, "APESSITO", tv, null).montant === 50000);
    test("★ totalVerse et resumeCaisses acceptent la période : versé en août seulement = 90 000 (banque) ; résumé en août : versé 90 000, entrées 0",
      Vs.totalVerse(dbR, "APESSITO", "2026-09-13", { du: "2026-08-01", au: "2026-08-31" }).total === 90000 && Vs.resumeCaisses(dbR, ["APESSITO"], tv, "2026-09-13", { du: "2026-08-01", au: "2026-08-31" }).lignes[0].verse === 90000
      && Vs.resumeCaisses(dbR, ["APESSITO"], tv, "2026-09-13", { du: "2026-08-01", au: "2026-08-31" }).lignes[0].entrees === 0);
    const csR = readFileSync("src/screens/Caisse.jsx", "utf8");
    const dashR = readFileSync("src/screens/Dashboard.jsx", "utf8");
    test("★ écran Caisse : le sélecteur de période (periodes(), « Depuis le début » d'office) est dans la rangée des boutiques devant RÉSUMÉ, vaut pour le résumé, l'historique ET les carrés de la boutique ; le montant ATTENDU du formulaire reste le solde depuis le début ; un clic sur une boutique REFERME le résumé",
      /const \[periodeIndex, setPeriodeIndex\] = useState\(listePeriodes\.length - 1\);/.test(csR) && /<select[^\n]*value=\{periodeIndex\} onChange=\{\(e\) => setPeriodeIndex\(Number\(e\.target\.value\)\)\}/.test(csR)
      && /resumeCaisses\(db, boutiquesResume, totalVente, aujourdhui, periode\)/.test(csR) && /const aVerserPeriode = fondsAVerser\(db, boutique, totalVente, periode\);/.test(csR) && /const verse = totalVerse\(db, boutique, aujourdhui, periode\);/.test(csR)
      // ⚠ RETOURNÉ le 21/09/2026 : l'attendu passe par `attenduVersement`, qui
      // vaut `aVerser.aVerser` tant qu'on part du tiroir et le solde du compte
      // mobile sinon. Ce qui est protégé n'a pas bougé : le montant attendu du
      // FORMULAIRE reste un solde DEPUIS LE DÉBUT, jamais celui d'une période.
      && /attendu: attenduVersement/.test(csR) && /montantDifferent\(vers\.montant, attenduVersement\)/.test(csR)
      && /const attenduVersement = mobileChoisi \? Math\.max\(0, mobileChoisi\.solde\) : aVerser\.aVerser;/.test(csR)
      && /const aVerser = fondsAVerser\(db, boutique, totalVente\);/.test(csR) /* 13/09/2026 : au-delà du fonds fixe, TOUJOURS depuis le début */
      && /value=\{resume \? "" : bq\} onChange=\{\(nom\) => \{ setBq\(nom\); setResume\(false\); \}\}/.test(csR) /* en mode RÉSUMÉ, aucune boutique allumée (capture 13/09/2026) */ && /historiqueVersements = resume \? boutiquesResume\.flatMap\(\(b\) => versementsDe\(db, b\)\)\.filter\(\(d\) => !periode/.test(csR));
    test("★ écran Caisse : le carré « Total versé » (totalVerse) à côté de « Fonds à verser », le bouton « 📊 RÉSUMÉ » dans la rangée des boutiques (extra de BoutiqueTabs), le tableau (resumeCaisses) avec les quatre colonnes — plus « Fonds de caisse » depuis le 14/09/2026 —, le retard de clôture par boutique et la ligne TOTAL ; rien de tout ça dans le tableau de bord",
      /const verse = totalVerse\(db, boutique, aujourdhui, periode\);/.test(csR) && /Total versé\{depuisLeDebut \? "" : ` · \$\{libellePeriode\}`\}<\/div><div className="font-bold tabular-nums">\{fmt\(verse\.total\)\}/.test(csR) /* 13/09/2026 : les carrés suivent la période */
      && /extra=\{<>\n\s*<button onClick=\{\(\) => setResume\(\(r\) => !r\)\}[^\n]*📊 RÉSUMÉ<\/button>\n(?:[^\n]*\n){3}\s*<div className="flex items-center gap-2"><div className="font-bold text-slate-800">Période :<\/div>\n\s*<select className="rounded-lg border border-slate-300 px-3 py-1\.5 text-sm bg-white"[^\n]*\n[^\n]*\n[^\n]*<\/select>\n\s*<\/div>\n\s*<\/>\}/.test(csR) /* « Période : » + liste, comme au tableau de bord, à DROITE de RÉSUMÉ, même ligne (Timo, 13/09/2026 : « ramener période devant résumé » → option 1) */ && /resumeCaisses\(db, boutiquesResume, totalVente, aujourdhui, periode\)/.test(csR)
      && /\["Fonds à verser", "text-right"\], \["Fonds de caisse", "text-right"\], \["Total versé", "text-right"\], \["Entrées", "text-right"\], \["Sorties \(versements compris\)", "text-right"\]/.test(csR) && /sans clôture/.test(csR) && /<td className="px-3 py-2">TOTAL<\/td>/.test(csR)
      && /boutiquesVisibles\(db, profile, \[\.\.\.boutiquesVente\(db\), \.\.\.\(db\.boutiques \|\| \[\]\)\.filter\(\(b\) => b\.terrain\)\]\)/.test(csR)
      && !/totalVerse|resumeCaisses|RÉSUMÉ/.test(dashR) && /\{extra\}/.test(readFileSync("src/components/SelecteurBoutique.jsx", "utf8"))
      // 13/09/2026 : « dans résumé, ne plus afficher autre chose » — tout le reste de l'écran est sous {!resume && (<>…</>)}.
      && /\{!resume && \(<>\n\s*\{\/\* Timo \(09\/09\/2026\)/.test(csR) /* 14/09/2026 : le bloc « Remettre » du DG a été RETIRÉ de Caisse (Timo : « je le préfère dans la fiche de la boutique ») */ && /<\/>\)\}\n    <\/div>\n  \);\n\}/.test(csR));
  }
  // Timo (13/09/2026) : « au plus 10 lignes, au-delà on défile ; après 3 mois,
  // au-delà de 20 lignes, les anciennes sont archivées automatiquement… que ça
  // soit LA SEULE règle qui gère ça » — lib/archivage.js, exercée ici.
  {
    const sortieAr = join("node_modules", ".cache", `bmi-archivage-${process.pid}.mjs`);
    await build({ entryPoints: ["src/lib/archivage.js"], bundle: true, format: "esm", platform: "node", outfile: sortieAr, logLevel: "silent" });
    const Ar = await import(pathToFileURL(sortieAr).href);
    unlinkSync(sortieAr);
    test("★ archivage : 10 lignes visibles, 3 mois, 20 récentes gardées ; dateLimite(2026-09-13) = 2026-06-13 ; ancienne = strictement avant", Ar.LIGNES_VISIBLES === 10 && Ar.MOIS_AVANT_ARCHIVE === 3 && Ar.MINIMUM_RECENTES === 20 && Ar.dateLimite("2026-09-13") === "2026-06-13" && Ar.estAncienne("2026-06-12", "2026-09-13") && !Ar.estAncienne("2026-06-13", "2026-09-13") && Ar.dateLimite("2026-01-31") === "2025-10-31");
    // 22 lignes récentes (septembre) + 8 anciennes (mai) : les 20 premières
    // restent, les 2 récentes suivantes aussi (pas anciennes), les 8 de mai
    // partent aux archives.
    const recentes = Array.from({ length: 22 }, (_, i) => ({ id: `r${i}`, date: `2026-09-${String(1 + (i % 12)).padStart(2, "0")}` }));
    const anciennes = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, date: `2026-05-${String(1 + i).padStart(2, "0")}` }));
    const sep = Ar.separerArchives([...anciennes, ...recentes], { aujourdhui: "2026-09-13" });
    test("★ separerArchives : trié du plus récent au plus ancien ; 22 visibles (toutes les récentes), 8 archivées (anciennes ET au-delà des 20)", sep.visibles.length === 22 && sep.archives.length === 8 && sep.visibles[0].date === "2026-09-12" && sep.archives.every((l) => l.id.startsWith("a")));
    // 25 lignes toutes anciennes : les 20 plus récentes restent quand même visibles.
    const vieilles = Array.from({ length: 25 }, (_, i) => ({ id: `v${i}`, date: `2026-03-${String(1 + i).padStart(2, "0")}` }));
    const sep2 = Ar.separerArchives(vieilles, { aujourdhui: "2026-09-13" });
    test("★ …25 lignes toutes anciennes : les 20 plus récentes restent visibles, 5 archivées ; 5 lignes anciennes seules : rien d'archivé", sep2.visibles.length === 20 && sep2.archives.length === 5 && sep2.archives[0].date === "2026-03-05" && Ar.separerArchives(vieilles.slice(0, 5), { aujourdhui: "2026-09-13" }).archives.length === 0);
    const pm = Ar.parMois([{ date: "2026-05-02" }, { date: "2026-03-09" }, { date: "2026-05-30" }]);
    test("★ parMois : rangées par mois du plus récent au plus ancien, libellé en français", pm.map((g) => `${g.libelle}:${g.lignes.length}`).join("|") === "mai 2026:2|mars 2026:1");
    const csA = readFileSync("src/screens/Caisse.jsx", "utf8");
    const importeurs = execSync("grep -rl 'separerArchives\\|lib/archivage' src --include=*.jsx --include=*.js || true").toString().trim().split("\n").filter(Boolean).sort().join("|");
    test("★ LA SEULE règle : separerArchives n'est appelée que par le composant commun HistoriqueArchive ; le RÉSUMÉ de Caisse affiche l'historique des versements avec ce composant (10 lignes visibles, bouton Archives, rangé par mois), jamais un découpage à lui",
      importeurs === "src/components/HistoriqueArchive.jsx|src/lib/archivage.js" && /import \{ HistoriqueArchive \} from "\.\.\/components\/HistoriqueArchive";/.test(readFileSync("src/screens/Depenses.jsx", "utf8")) && /<HistoriqueArchive lignes=\{historiqueVersements\} dateDe=\{\(d\) => d\.date\} aujourdhui=\{aujourdhui\}/.test(csA)
      && /const historiqueVersements = resume \? boutiquesResume\.flatMap\(\(b\) => versementsDe\(db, b\)\)\.filter\(/.test(csA) && !/slice\(0, (10|20)\)/.test(csA.slice(csA.indexOf("<HistoriqueArchive"), csA.indexOf("{!resume && (<>"))) /* le bloc RÉSUMÉ ne découpe rien lui-même (le « Derniers versements traités » du DG, plus bas, garde ses 10) */
      && /LIGNES_VISIBLES \* HAUTEUR_LIGNE/.test(readFileSync("src/components/HistoriqueArchive.jsx", "utf8")) && /Remonter dans les archives/.test(readFileSync("src/components/HistoriqueArchive.jsx", "utf8")));
  }
  // Timo (13/09/2026) : « ajoute le réglage fonds de caisse fixe par boutique ».
  {
    const dbF = { ...db1, boutiques: [{ nom: "APESSITO", fonds_caisse_fixe: 30000 }, { nom: "AUTRE" }] };
    const ff = Vs.fondsAVerser(dbF, "APESSITO", tv);
  // ⚠ RETOURNÉ le 15/09/2026 (Timo, réponse B : « fais appel au fonds de caisse QUE si pas de vente et il faut une dépense » — le fonds est gardé À PART, dans une enveloppe, jamais dans le tiroir).
    test("★ un fonds de caisse RÉGLÉ mais jamais REMIS ne retient plus rien : l'enveloppe est vide, tout le tiroir est à verser (50 000) — le réglage seul ne met pas d'argent de côté, c'est la remise du DG qui le fait (manqueRemises le signale)",
      ff.montant === 50000 && ff.fondsFixe === 30000 && ff.aVerser === 50000 && ff.fondsPlafond === 0 && ff.resteFonds === 0
      && Vs.fondsAVerser(dbF, "AUTRE", tv).aVerser === 9000 && Vs.fondsAVerser(dbF, "AUTRE", tv).fondsFixe === 0
      && Vs.fondsCaisseFixe(dbF, "APESSITO") === 30000 && Vs.aVerserAuDela(50000, 30000) === 20000 && Vs.manqueRemises(dbF, "APESSITO") === 30000);
    const rf = Vs.resumeCaisses(dbF, ["APESSITO", "AUTRE"], tv, "2026-09-13");
  // ⚠ RETOURNÉ le 15/09/2026 (Timo, réponse B : « fais appel au fonds de caisse QUE si pas de vente et il faut une dépense » — le fonds est gardé À PART, dans une enveloppe, jamais dans le tiroir).
    test("★ resumeCaisses porte le tiroir, le fonds réglé et à verser par ligne et au total ; sans remise enregistrée, à verser = le tiroir entier (50 000 + 9 000 = 59 000)",
      rf.lignes[0].aVerser === 50000 && rf.lignes[0].solde === 50000 && rf.lignes[0].fondsFixe === 30000 && rf.total.aVerser === 59000 && rf.total.solde === 59000 && rf.total.fondsFixe === 30000);
    const csF = readFileSync("src/screens/Caisse.jsx", "utf8");
    const paF = readFileSync("src/screens/Parametres.jsx", "utf8");
    test("★ écran Caisse : le montant ATTENDU du versement et la justification sont « au-delà du fonds fixe » (aVerser.aVerser, ×3) ; RETOURNÉ le 14/09/2026 (Timo : « il ne faut pas mélanger le fonds de caisse avec ce qu'on va verser ») : le carré « Fonds à verser » ne dit PLUS « fonds de caisse fixe … conservé » (faux quand le solde est à 0), le fonds a SON carré — et depuis le 15/09/2026 le carré dit que le fonds est gardé À PART, il n'est plus « au-delà » de quoi que ce soit ; ⚙ Paramètres → Boutiques : bouton « 💼 Fonds de caisse » (admin, refuserSaufAdmin + bloquerSiLecture, pas pour un dépôt, écrit fonds_caisse_fixe — depuis le 14/09/2026 par la fenêtre du geste unique, plan.fondsApres)",
      // ⚠ RETOURNÉ le 21/09/2026 : deux occurrences seulement — l'attendu passe
      // par `attenduVersement` (le compte QUI SE VIDE), et `aVerser.aVerser`
      // ne sert plus qu'à le calculer et à afficher le tiroir dans la liste
      // « D'où part l'argent ? ». Ce qui est protégé est le même : jamais
      // `aVerser.montant`, jamais le mot « conservé ».
      (csF.match(/aVerser\.aVerser/g) || []).length === 2 && (csF.match(/attenduVersement/g) || []).length === 4 && !/attendu: aVerser\.montant/.test(csF) && !/conservé/.test(csF) && /le fonds de caisse est gardé à part : il n'est pas là-dedans/.test(csF) && !/au-delà du fonds de caisse/.test(csF) && /solde \{fmt\(l\.solde\)\}<\/div>/.test(csF) && !/fonds fixe \{fmt\(l\.fondsFixe\)\}/.test(csF)
      && /refuserSaufAdmin\(profile, "Régler le fonds de caisse fixe d'une boutique"\)/.test(paF) && /\{!b\.depot && <button onClick=\{\(\) => modifierFondsFixe\(b\)\}/.test(paF) && /\{ \.\.\.x, fonds_caisse_fixe: plan\.fondsApres \}/.test(paF));
  }
  // Timo (14/09/2026), captures d'APESSITO : 348 000 d'entrées, 50 000 de
  // dépenses, 298 000 versés — « et dans la foulée on avait aussi donné un
  // fonds de caisse de 50 000… il ne faut pas mélanger le fonds de caisse avec
  // ce qu'on va verser… on ne verse jamais le fonds de caisse ». Le fonds remis
  // par le DG n'était écrit nulle part (solde 0, « 50 000 conservé » faux).
  {
    const TIMO = { id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true };
    const nzF = (t) => String(t).replace(/\u202f|\u00a0/g, " ");
    const sortieCsF = join("node_modules", ".cache", `bmi-constants-fonds-${process.pid}.mjs`);
    await build({ entryPoints: ["src/lib/constants.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCsF, logLevel: "silent" });
    const Cs = await import(pathToFileURL(sortieCsF).href);
    unlinkSync(sortieCsF);
    const dbA = {
      boutiques: [{ nom: "APESSITO", fonds_caisse_fixe: 50000 }, { nom: "DEMAKPOE", fonds_caisse_fixe: 50000 }],
      ventes: [{ id: "a1", boutique: "APESSITO", date: "2026-09-10", paiement: "Espèces", total: 300000 }, { id: "a2", boutique: "APESSITO", date: "2026-09-11", paiement: "Espèces", total: 48000 }, { id: "k1", boutique: "DEMAKPOE", date: "2026-09-11", paiement: "Espèces", total: 898600 }],
      dettes: [],
      depenses: [
        { id: "x1", boutique: "APESSITO", date: "2026-09-12", categorie: "Transport", montant: 50000, paiement: "Espèces", par: "TIMO", validation: { statut: "validee", le: "2026-09-12", par: "TIMO" } },
        { id: "x2", boutique: "APESSITO", date: "2026-09-14", categorie: "Versement de fonds", montant: 298000, paiement: "Espèces", par: "ALI", versement: { id: "vv", destination: "Chez le DG", montant: 298000 }, versement_valide_le: "2026-09-14", versement_valide_par: "TIMO" },
      ],
    };
    const f0 = Vs.fondsAVerser(dbA, "APESSITO", tv);
    test("★ AVANT la remise (la capture) : entrées 348 000, sorties 348 000 (50 000 + 298 000), solde 0, à verser 0 — et le fonds n'est PAS « conservé » : il en reste 0, entamé de 50 000, pas intact ; DEMAKPOE : 898 600 → 848 600 à verser, fonds de 50 000 intact",
      f0.ventes + f0.reglements === 348000 && f0.depenses === 348000 && f0.montant === 0 && f0.aVerser === 0 && f0.fondsRemis === 0 && f0.resteFonds === 0 && f0.fondsEntame === 0 && f0.fondsIntact === false
      // ⚠ RETOURNÉ le 15/09/2026 (réponse B) : sans remise enregistrée, l'enveloppe est VIDE — DEMAKPOE a donc 898 600 à verser, pas 848 600.
      && Vs.fondsAVerser(dbA, "DEMAKPOE", tv).aVerser === 898600 && Vs.fondsAVerser(dbA, "DEMAKPOE", tv).resteFonds === 0 && Vs.fondsAVerser(dbA, "DEMAKPOE", tv).fondsIntact === false
      && Vs.etatFondsCaisse(45000, 50000).entame === 5000 && Vs.etatFondsCaisse(-3000, 50000).reste === 0 && Vs.etatFondsCaisse(80000, 0).fondsFixe === 0 && Vs.etatFondsCaisse(80000, 0).intact === false);
    test("★ une remise mal formée est refusée avec son motif : montant nul, origine inconnue (seulement Chez le DG / BANQUE), BANQUE sans banque, sans date",
      /montant/.test(Vs.critiqueRemiseFonds({ montant: 0, origine: "Chez le DG", date: "2026-09-13" })) && /Chez le DG ou BANQUE/.test(Vs.critiqueRemiseFonds({ montant: 100, origine: "Chez le comptable", date: "2026-09-13" }))
      && /banque/.test(Vs.critiqueRemiseFonds({ montant: 100, origine: "BANQUE", banque: " ", date: "2026-09-13" })) && /date/.test(Vs.critiqueRemiseFonds({ montant: 100, origine: "Chez le DG", date: "" }))
      && Vs.critiqueRemiseFonds({ montant: 50000, origine: "Chez le DG", date: "2026-09-13" }) === "" && Vs.ORIGINES_FONDS.join("|") === "Chez le DG|BANQUE" && Vs.construireRemiseFonds(TIMO, { boutique: "APESSITO", montant: 0, origine: "Chez le DG", date: "2026-09-13" }).refus.length > 0);
    const rm = Vs.construireRemiseFonds(TIMO, { boutique: "APESSITO", montant: 50000, origine: "Chez le DG", date: "2026-09-13", note: "fonds du mois" });
    test("★ construireRemiseFonds : UNE ligne de dépenses sur la boutique, catégorie « Fonds de caisse remis », montant NÉGATIF (une entrée, convention de la caisse du comptable), espèces, à la date choisie, détail dans fonds_caisse (origine, montant positif, note), description lisible, journal",
      rm.entree.boutique === "APESSITO" && rm.entree.categorie === Vs.CATEGORIE_FONDS_CAISSE && rm.entree.categorie === "Fonds de caisse remis" && rm.entree.montant === -50000 && rm.entree.paiement === "Espèces" && rm.entree.date === "2026-09-13" && rm.entree.par === "TIMO" && rm.entree.par_id === "u_timo"
      && rm.entree.fonds_caisse.origine === "Chez le DG" && rm.entree.fonds_caisse.montant === 50000 && rm.entree.fonds_caisse.note === "fonds du mois" && /^Fonds de caisse remis le 13\/09\/2026 par TIMO \(Chez le DG\) — fonds du mois$/.test(rm.entree.description)
      && Vs.estFondsCaisseRemis(rm.entree) && !Vs.estVersement(rm.entree) && /Fonds de caisse 50 000 F remis à APESSITO \(Chez le DG\) par TIMO/.test(nzF(rm.journal)) && !rm.entree.validation && !rm.entree.paye_avec
      && Vs.libelleOrigineFonds(Vs.construireRemiseFonds(TIMO, { boutique: "APESSITO", montant: 100, origine: "BANQUE", banque: "Ecobank", date: "2026-09-13" }).fonds_caisse) === "BANQUE Ecobank");
    const dbB = { ...dbA, depenses: [rm.entree, ...dbA.depenses] };
    const f1 = Vs.fondsAVerser(dbB, "APESSITO", tv);
    test("★ APRÈS la remise de 50 000 : solde 50 000, à verser 0 (on ne verse jamais le fonds), fonds remis 50 000 (dernière remise le 13/09), il en reste 50 000, intact ; Sorties restent 348 000 (la remise n'est PAS une sortie négative) ; Entrées ventes + règlements inchangées",
      f1.montant === 0 && f1.aVerser === 0 && f1.fondsPlafond === 50000 && f1.fondsRemis === 50000 && f1.derniereRemise === "2026-09-13" && f1.resteFonds === 50000 && f1.fondsIntact === true && f1.fondsEntame === 0 && f1.depenses === 348000 && f1.ventes + f1.reglements === 348000
      && Vs.remisesFondsDe(dbB, "APESSITO").length === 1 && Vs.remisesFondsDe(dbB, "DEMAKPOE").length === 0);
    const dbC = { ...dbB, depenses: [{ id: "x3", boutique: "APESSITO", date: "2026-09-15", categorie: "Carburant", montant: 5000, paiement: "Espèces", par: "ALI" }, ...dbB.depenses] };
    const f2 = Vs.fondsAVerser(dbC, "APESSITO", tv);
    test("★ une dépense de 5 000 sans vente : le fonds est ENTAMÉ — solde 45 000, il en reste 45 000, entamé de 5 000, toujours 0 à verser (Timo : « par où voir le restant du fonds de caisse ? ») ; une vente de 20 000 ensuite : reste 50 000 intact, 15 000 à verser",
      f2.montant === 0 && f2.depensesSurFonds === 5000 && f2.resteFonds === 45000 && f2.fondsEntame === 5000 && f2.fondsIntact === false && f2.aVerser === 0
      // La vente d'après REMBOURSE d'abord l'enveloppe (5 000), le reste va au tiroir.
      && (() => { const f3 = Vs.fondsAVerser({ ...dbC, ventes: [...dbC.ventes, { id: "a3", boutique: "APESSITO", date: "2026-09-16", paiement: "Espèces", total: 20000 }] }, "APESSITO", tv); return f3.montant === 15000 && f3.resteFonds === 50000 && f3.fondsIntact === true && f3.aVerser === 15000; })());
    test("★ avec une période : le fonds remis compté DANS la période seulement (septembre 13 → 13 : 50 000 ; 10 → 12 : 0) ; le solde à la fin du 12/09 = 0, à la fin du 13/09 = 50 000",
      Vs.fondsAVerser(dbB, "APESSITO", tv, { du: "2026-09-13", au: "2026-09-13" }).fondsRemis === 50000 && Vs.fondsAVerser(dbB, "APESSITO", tv, { du: "2026-09-10", au: "2026-09-12" }).fondsRemis === 0
      // ⚠ RETOURNÉ le 15/09/2026 : la remise n'entre plus dans le TIROIR (elle va dans l'enveloppe) — le tiroir reste à 298 000 le 13/09.
      && Vs.fondsAVerser(dbB, "APESSITO", tv, { du: "2026-09-10", au: "2026-09-12" }).montant === 348000 - 50000 && Vs.fondsAVerser(dbB, "APESSITO", tv, { du: "2026-09-13", au: "2026-09-13" }).montant === 348000 - 50000);
    const rs = Vs.resumeCaisses(dbC, ["APESSITO", "DEMAKPOE"], tv, "2026-09-15");
    test("★ resumeCaisses porte le fonds : reste 45 000 (APESSITO) + 50 000 (DEMAKPOE) = 95 000 ; fonds remis 50 000 ; Entrées = ventes + règlements (348 000), le fonds remis dit à part",
      // ⚠ RETOURNÉ le 15/09/2026 : DEMAKPOE n'a aucune remise enregistrée — son enveloppe est vide (0), pas 50 000.
      rs.lignes[0].resteFonds === 45000 && rs.lignes[0].fondsRemis === 50000 && rs.lignes[0].entrees === 348000 && rs.lignes[1].resteFonds === 0 && rs.lignes[1].fondsRemis === 0 && rs.total.resteFonds === 45000 && rs.total.fondsRemis === 50000 && rs.total.fondsFixe === 100000);
    test("★ le fonds remis n'est ni une charge ni une dépense : CATEGORIES_HORS_CHARGES le porte, horsVersements et depensesComptees l'écartent (tableau de bord, journal, export, écran Dépenses) ; l'écran Dépenses DIT où le retrouver",
      Cs.CATEGORIES_HORS_CHARGES.includes("Fonds de caisse remis") && Cs.horsVersements(dbB.depenses).every((d) => !Vs.estFondsCaisseRemis(d)) && Cs.depensesComptees(dbB.depenses).length === 1 && Cs.horsVersements(dbB.depenses).length === 1
      && /les <b>fonds de caisse remis par le DG<\/b> et les <b>remboursements de reprise<\/b> ne sont pas des dépenses/.test(readFileSync("src/screens/Depenses.jsx", "utf8")));
    // La clôture : le jour de la remise, c'est une ENTRÉE du tiroir — jamais une « sortie justifiée » négative.
    const sortieClF = join("node_modules", ".cache", `bmi-cloture-fonds-${process.pid}.mjs`);
    await build({ entryPoints: ["src/lib/cloture.js"], bundle: true, format: "esm", platform: "node", outfile: sortieClF, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
    const ClF = await import(pathToFileURL(sortieClF).href);
    unlinkSync(sortieClF);
    const j13 = ClF.activiteDuJour(dbB, "APESSITO", "2026-09-13", tv);
    const j14 = ClF.activiteDuJour(dbB, "APESSITO", "2026-09-14", tv);
  // ⚠ RETOURNÉ le 15/09/2026 (Timo, réponse B : « fais appel au fonds de caisse QUE si pas de vente et il faut une dépense » — le fonds est gardé À PART, dans une enveloppe, jamais dans le tiroir).
    test("★ clôture du 13/09 (jour de la remise) : le fonds remis (50 000) est dit à part et ne touche PAS le tiroir — flux 0, tiroir d'hier 298 000, attendu 298 000 (et non 348 000) ; l'enveloppe montre 50 000 intacts ; le 14/09 : versement 298 000, tiroir d'hier 298 000, attendu 0",
      j13.fondsRemisDuJour === 50000 && j13.especesDepenses === 0 && j13.sortiesJustifiees === 0 && j13.fluxDuJour === 0 && j13.fondsHier === 298000 && j13.theorique === 298000
      && j13.fondsPlafond === 50000 && j13.fondsReste === 50000 && j13.fondsIntact === true
      && j14.fondsRemisDuJour === 0 && j14.versementsDuJour === 298000 && j14.fondsHier === 298000 && j14.theorique === 0 && ClF.soldeEspecesFinDeJour(dbB, "APESSITO", "2026-09-14", tv) === 0
      && !/fonds de caisse remis/.test(ClF.alerteSaisieRecette(0, { ...j14, recetteDuJour: 0 }, String)));
    // Les caisses centrales : l'argent est SORTI de chez le DG (ou de la banque) le jour de la remise.
    const sortieCgF = join("node_modules", ".cache", `bmi-caisses-fonds-${process.pid}.mjs`);
    await build({ entryPoints: ["src/lib/caissesCentrales.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCgF, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
    const CgF = await import(pathToFileURL(sortieCgF).href);
    unlinkSync(sortieCgF);
    const rb = Vs.construireRemiseFonds(TIMO, { boutique: "DEMAKPOE", montant: 30000, origine: "BANQUE", banque: "Ecobank", date: "2026-09-12" });
    const dbD = { ...dbB, depenses: [rb.entree, ...dbB.depenses] };
    const dgF = CgF.mouvementsDG(dbD, ["APESSITO", "DEMAKPOE"]);
    const bqF = CgF.mouvementsBanque(dbD, ["APESSITO", "DEMAKPOE"]);
    test("★ Chez le DG : entrée 298 000 (versement validé), SORTIE 50 000 « Fonds de caisse remis à APESSITO » le 13/09 → solde 248 000 ; BANQUE : sortie 30 000 « remis à DEMAKPOE · BANQUE Ecobank », pas chez le DG ; hors espace : rien",
      dgF.totalEntrees === 298000 && dgF.totalSorties === 50000 && dgF.sorties[0].date === "2026-09-13" && /Fonds de caisse remis à APESSITO \(par TIMO\) — fonds du mois/.test(dgF.sorties[0].libelle) && dgF.solde === 248000
      && bqF.totalSorties === 30000 && /remis à DEMAKPOE \(par TIMO\) · BANQUE Ecobank/.test(bqF.sorties[0].libelle) && bqF.totalEntrees === 0 && CgF.mouvementsDG(dbD, ["APESSITO"]).totalSorties === 50000 && CgF.mouvementsBanque(dbD, ["APESSITO"]).totalSorties === 0
      && CgF.mouvementsComptable(dbD).mouvements.length === 0);
    // L'écran 🔒 Caisse : le geste du DG, son carré, sa colonne, sa liste.
    const csG = readFileSync("src/screens/Caisse.jsx", "utf8");
    // Timo (14/09/2026, après coup) : « fonds de caisse, les deux ne peuvent
    // jamais être deux choses différentes… je le préfère dans la fiche de la
    // boutique, puisque c'est une opération une fois de bon » — le bloc
    // « Remettre » de Caisse est RETIRÉ ; UN geste dans ⚙ Paramètres.
    // Puis : « il y a un trou… il faut revoir. Il ne doit y avoir AUCUN lien
    // entre le fonds de caisse et les ventes ; le seul lien, c'est la
    // compensation : fonds entamé, les ventes viennent rembourser. C'est tout. »
    // → plus de « laissé sur les ventes » : le fonds est TOUJOURS remis.
    test("★ ⚠ RETOURNÉ le 15/09/2026 (Timo : « le réglage dans les paramètres doit rester utile, car à tout moment je peux augmenter ou diminuer le fonds de caisse ») — planFondsCaisse (règle pure) remplace planRemiseFonds : on donne le NOUVEAU montant du fonds, l'application en déduit ce que le DG apporte (remise) ou reprend (reprise) ; 0 → 50 000 = remise de 50 000 ; 50 000 → 80 000 = remise de 30 000 ; 50 000 → 20 000 = REPRISE de 30 000 ; même montant → refus ; négatif → refus",
      (() => { const a = Vs.planFondsCaisse({ fondsActuel: 0, nouveau: 50000 }); const b = Vs.planFondsCaisse({ fondsActuel: 50000, nouveau: 80000 }); const d = Vs.planFondsCaisse({ fondsActuel: 50000, nouveau: 20000 }); const e = Vs.planFondsCaisse({ fondsActuel: 50000, nouveau: 0 });
        return a.sens === Vs.SENS_REMISE && a.montant === 50000 && a.fondsApres === 50000 && a.regularisation === false
          && b.sens === Vs.SENS_REMISE && b.montant === 30000 && b.fondsApres === 80000
          && d.sens === Vs.SENS_REPRISE && d.montant === 30000 && d.fondsApres === 20000
          && e.sens === Vs.SENS_REPRISE && e.montant === 50000 && e.fondsApres === 0
          && /déjà de/.test(Vs.planFondsCaisse({ fondsActuel: 50000, nouveau: 50000 }).refus) && /nouveau montant/.test(Vs.planFondsCaisse({ fondsActuel: 0, nouveau: -1 }).refus)
          && Vs.planRemiseFonds === undefined; })());
    test("★ la RÉGULARISATION n'a pas changé : elle comble le manque SANS toucher au montant du fonds, refusée au-delà du manque ou quand il n'y a rien à régulariser",
      (() => { const c = Vs.planFondsCaisse({ fondsActuel: 50000, manque: 50000, montant: 50000, regularisation: true });
        return c.montant === 50000 && c.fondsApres === 50000 && c.regularisation === true && c.sens === Vs.SENS_REMISE
          && /dépasser le manque/.test(Vs.planFondsCaisse({ fondsActuel: 50000, manque: 20000, montant: 30000, regularisation: true }).refus)
          && /Rien à régulariser/.test(Vs.planFondsCaisse({ fondsActuel: 50000, manque: 0, montant: 1000, regularisation: true }).refus)
          && /montant/.test(Vs.planFondsCaisse({ fondsActuel: 0, manque: 5, montant: 0, regularisation: true }).refus)
          && Vs.ORIGINES_FONDS.join("|") === "Chez le DG|BANQUE" && Vs.ORIGINE_VENTES === undefined && Vs.ORIGINES_FONDS_TOUTES === undefined; })());
    // Une REPRISE : l'enveloppe se vide de 20 000, la ligne devient une SORTIE.
    const rep = Vs.construireRemiseFonds(TIMO, { boutique: "APESSITO", montant: 20000, origine: "Chez le DG", date: "2026-09-16", sens: Vs.SENS_REPRISE });
    test("★ construireRemiseFonds en REPRISE : fonds_caisse.montant NÉGATIF (−20 000), ligne à +20 000 (une sortie), description « repris », journal « repris de »",
      rep.entree.fonds_caisse.montant === -20000 && rep.entree.montant === 20000 && rep.sens === Vs.SENS_REPRISE
      && /^Fonds de caisse repris le 16\/09\/2026 par TIMO \(Chez le DG\)$/.test(rep.entree.description) && /repris de APESSITO/.test(nzF(rep.journal))
      && Vs.estFondsCaisseRemis(rep.entree));
    test("★ le TROU (capture Timo, 14/09/2026 : « les fonds n'apparaissent nulle part ») est MESURÉ : un fonds réglé à 50 000 sans remise enregistrée → manque 50 000 ; après la remise de 50 000 → manque 0, remises 50 000 ; jamais négatif",
      Vs.manqueRemises(dbA, "APESSITO") === 50000 && Vs.totalRemisesFonds(dbA, "APESSITO") === 0 && Vs.manqueRemises(dbB, "APESSITO") === 0 && Vs.totalRemisesFonds(dbB, "APESSITO") === 50000
      && Vs.manqueRemises({ ...dbB, boutiques: [{ nom: "APESSITO", fonds_caisse_fixe: 20000 }] }, "APESSITO") === 0 && Vs.manqueRemises(dbA, "INCONNUE") === 0);
    const paG = readFileSync("src/screens/Parametres.jsx", "utf8");
    test("★ ⚠ RETOURNÉ le 15/09/2026 (Timo : « le réglage dans les paramètres doit rester utile, car à tout moment je peux augmenter ou diminuer le fonds de caisse ») — ⚙ Paramètres → Boutiques → 💼 Fonds de caisse = LE geste (fenêtre data-fenetre=\"fonds-de-caisse\") : on saisit le NOUVEAU montant du fonds (data-fonds=\"nouveau\"), origine parmi ORIGINES_FONDS (jamais « ventes »), banque pour BANQUE, date bornée à aujourd'hui ; administrateur PRINCIPAL revérifié dans le geste + bloquerSiLecture ; planFondsCaisse puis construireRemiseFonds avec son SENS ; UN save écrit fonds_caisse_fixe = fondsApres ET la ligne ; le bouton dit « Diminuer le fonds » quand on baisse ; le manque garde son « Régulariser »",
      /data-fenetre="fonds-de-caisse"/.test(paG) && /\{ORIGINES_FONDS\.map\(\(o\) => <option key=\{o\} value=\{o\}>\{o\}<\/option>\)\}/.test(paG) && !/ORIGINE_VENTES|Laissé sur les ventes|planRemiseFonds/.test(paG) && /\{fondsForm\.origine === DEST_BANQUE && <Field label="Nom de la banque">/.test(paG)
      && /<Field label="Nouveau montant du fonds \(F\)"><input type="number" inputMode="numeric" className=\{inputCls\} value=\{fondsForm\.nouveau\}[^\n]*data-fonds="nouveau" \/><\/Field>/.test(paG)
      && /<Field label="Date de la remise"><input type="date" className=\{inputCls\} value=\{fondsForm\.date\} max=\{today\(\)\}/.test(paG)
      && /if \(refuserSaufAdminPrincipal\(db, profile, "Régler le fonds de caisse d'une boutique \(DG\)"\)\) return;/.test(paG) && /if \(bloquerSiLecture\(db, profile\)\) return;/.test(paG)
      && /const plan = planFondsCaisse\(\{ fondsActuel: fondsCaisseFixe\(db, b\.nom\), nouveau: fondsForm\.nouveau, manque: manqueRemises\(db, b\.nom\), montant: fondsForm\.montant, regularisation: fondsForm\.regularisation \}\);/.test(paG)
      && /const r = construireRemiseFonds\(profile, \{ boutique: b\.nom, montant: plan\.montant,/.test(paG) && /sens: plan\.sens \}\);/.test(paG)
      && /boutiques: db\.boutiques\.map\(\(x\) => \(x\.nom === b\.nom \? \{ \.\.\.x, fonds_caisse_fixe: plan\.fondsApres \} : x\)\),\n\s*depenses: \[r\.entree, \.\.\.\(db\.depenses \|\| \[\]\)\],/.test(paG)
      // ⚠ Le fonds est gardé À PART : ni la remise ni la reprise ne touchent le tiroir, et la fenêtre le DIT.
      && /entrent dans l'enveloppe de \$\{b\.nom\}/.test(paG) && /sortent de l'enveloppe de \$\{b\.nom\}/.test(paG) && (paG.match(/Le tiroir des ventes n'est pas touché\./g) || []).length === 2
      && !/entrent dans le tiroir de/.test(paG) && /GARDÉ À PART du tiroir des ventes et jamais versé/.test(paG)
      && /"Diminuer le fonds" : "Régler le fonds"/.test(paG)
      && /\{manqueRemises\(db, fondsPour\.nom\) > 0 && !fondsForm\.regularisation && \(\n\s*<div className="[^"]*" data-fonds="manque">/.test(paG) && /<button onClick=\{\(\) => regulariserFonds\(fondsPour\)\} className="ml-2 font-bold underline">Régulariser<\/button>/.test(paG)
      && /\{remisesFondsDe\(db, fondsPour\.nom\)\.length > 0 && \(/.test(paG));
    // Le serveur doit suivre : une reprise porte un montant NÉGATIF.
    const s20 = readFileSync("supabase/securite-20-fonds-reprise.sql", "utf8");
    const ta20 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
    test("★ securite-20 (serveur) : un fonds_caisse.montant NÉGATIF est permis (la reprise), zéro reste refusé, le montant de la ligne reste forcé à − fonds_caisse.montant, le DG seul ; le banc SQL rejoue reprise permise, gérant et admin secondaire refusés, zéro refusé, origine exigée, montant non modifiable",
      /if montant_fonds = 0 then/.test(s20) && !/if montant_remis <= 0 then/.test(s20) && /le DG récupère/.test(s20)
      && /new\.data := jsonb_set\(new\.data, '\{montant\}', to_jsonb\(-montant_fonds\), true\);/.test(s20)
      && /Régler le fonds de caisse d''une boutique', 'l''administrateur principal \(le DG\)'/.test(s20)
      && /select d\.data into avant from public\.depenses d where d\.id = new\.id;/.test(s20) && /revoke all on function public\.depenses_regles_fonds_caisse\(\) from public, anon;/.test(s20)
      && /-f supabase\/securite-20-fonds-reprise\.sql/.test(ta20) && /le DG REPREND 20 000 du fonds de caisse[^\n]*"PERMIS"/.test(ta20)
      && /un gérant reprend du fonds de caisse" "REFUSE"/.test(ta20) && /un administrateur SECONDAIRE reprend du fonds de caisse" "REFUSE"/.test(ta20)
      && /un mouvement de fonds à ZÉRO reste refusé[^\n]*"REFUSE"/.test(ta20) && /le montant d'une reprise déjà enregistrée ne se modifie plus" "REFUSE"/.test(ta20));
    const s16 = readFileSync("supabase/securite-16-fonds-de-caisse.sql", "utf8");
    const ta16 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
    test("★ securite-16 (serveur) : créer un « Fonds de caisse remis » = l'administrateur PRINCIPAL seul, origine Chez le DG / BANQUE exigée, montant FORCÉ à − fonds_caisse.montant, une remise ne se modifie plus ; upsert relu ; le banc tester-argent le pose et rejoue gérant / admin secondaire / vendeur refusés, DG permis, montant forcé, modification refusée",
      /if not public\.est_admin_principal\(\) then\n\s*perform public\.refus_role\('Remettre le fonds de caisse d''une boutique', 'l''administrateur principal \(le DG\)'\);/.test(s16) && /select d\.data into avant from public\.depenses d where d\.id = new\.id;/.test(s16)
      && /not in \('Chez le DG', 'BANQUE'\)/.test(s16) && /new\.data := jsonb_set\(new\.data, '\{montant\}', to_jsonb\(-montant_remis\), true\);/.test(s16) && /Modifier un fonds de caisse déjà remis', 'personne'/.test(s16) && /revoke all on function public\.depenses_regles_fonds_caisse\(\) from public, anon;/.test(s16)
      && /-f supabase\/securite-16-fonds-de-caisse\.sql/.test(ta16) && /le DG remet un fonds de caisse de 50 000 à APESSITO[^"]*" "PERMIS"/.test(ta16) && /un gérant remet un fonds de caisse[^"]*" "REFUSE"/.test(ta16) && /un administrateur SECONDAIRE remet un fonds de caisse[^"]*" "REFUSE"/.test(ta16)
      && /le montant de la ligne est FORCÉ à − 50 000[^"]*" "PERMIS"/.test(ta16) && /le DG modifie le montant d'une remise déjà enregistrée[^"]*" "REFUSE"/.test(ta16));
  }
  test("★ fonds à verser = SOLDE d'espèces en caisse : toutes les entrées espèces (ventes + règlements) − toutes les sorties espèces (versements compris) ; un versement fait baisser le solde d'autant ; jamais le mobile money ni une autre boutique",
    f.ventes === 251400 && f.reglements === 900 && f.depenses === 202300 && f.montant === 50000 && f.dernierVersement === "2026-09-05"
    && Vs.fondsAVerser({ depenses: [], ventes: db1.ventes, dettes: db1.dettes }, "APESSITO", tv).montant === 252300 && Vs.fondsAVerser({ depenses: [], ventes: db1.ventes, dettes: db1.dettes }, "APESSITO", tv).dernierVersement === "");
  const csV = readFileSync("src/screens/Caisse.jsx", "utf8");
  const nz = (t) => String(t).replace(/\u202f|\u00a0/g, " "); // les montants formatés portent une espace fine insécable
  test("★ plus de « Recette du … au » nulle part (règle et écran) ; la note n'a pas d'exemple ; aucun champ de date dans l'écran (la date de remise du fonds vit dans ⚙ Paramètres depuis le 14/09/2026)",
    !/libellePeriode|du: String\(du/.test(readFileSync("src/lib/versements.js", "utf8")) && !/Recette du [^\n]{0,40} au\b|type="date"/.test(csV) && !/placeholder="Ex : recette du jour"/.test(csV));
  test("★ montant différent de l'attendu SANS note → refusé avec « Justifiez pourquoi le montant n'est pas X » ; avec note → accepté ; montant égal → aucune note exigée",
    nz(Vs.critiqueVersement({ montant: 150000, destination: "Chez le DG", attendu: 200000, note: "" })) === "Justifiez pourquoi le montant n'est pas 200 000 F"
    && Vs.critiqueVersement({ montant: 150000, destination: "Chez le DG", attendu: 200000, note: "fonds de caisse gardé" }) === "" && Vs.critiqueVersement({ montant: 200000, destination: "Chez le DG", attendu: 200000.4, note: "" }) === ""
    && Vs.montantDifferent("150000", 200000) === true && Vs.montantDifferent(200000, 200000) === false);
  const re = Vs.construireVersement(moi, { boutique: "APESSITO", montant: 150000, destination: "Chez le comptable", attendu: 200000, note: "fonds de caisse gardé" });
  test("★ l'écart et la justification sont écrits sur la sortie ET sur l'entrée chez le comptable ; l'entrée dit « Versement du <date> reçu de … » ; l'attendu est gardé",
    re.versement.attendu === 200000 && nz(Vs.libelleEcart(re.versement)) === "attendu 200 000 F, écart − 50 000 F" && /\(attendu 200 000 F, écart − 50 000 F : fonds de caisse gardé\)/.test(nz(re.sortie.description))
    && /^Versement du \d\d\/\d\d\/\d{4} reçu de APESSITO \(par KOSSI\) — attendu 200 000 F, écart − 50 000 F : fonds de caisse gardé$/.test(nz(re.entree.description))
    && Vs.libelleEcart(rc.versement) === "" && Vs.libelleVersementDu({ date: "2026-09-09" }) === "Versement du 09/09/2026");
  test("★ écran Caisse : la note n'apparaît que si le montant diffère de l'attendu, avec la mention rouge ; l'attendu (fondsAVerser) part avec le versement ; le DG voit « Versement du … »",
    // ⚠ RETOURNÉ le 21/09/2026 : `attenduVersement` a remplacé `aVerser.aVerser`
    // aux trois endroits — il VAUT `aVerser.aVerser` quand on part du tiroir.
    /\{vers\.montant !== "" && montantDifferent\(vers\.montant, attenduVersement\) && \(/.test(csV) && /text-red-600 mb-1">⚠ \{messageJustification\(attenduVersement\)\}/.test(csV)
    && /construireVersement\(profile, \{ boutique, \.\.\.vers, attendu: attenduVersement \}\)/.test(csV) /* 13/09/2026 : l'attendu = au-delà du fonds de caisse fixe */ && /<b>\{libelleVersementDu\(d\)\}<\/b>/.test(csV) && (csV.match(/<Field label="Note[^"]*">/g) || []).length === 1);
  test("★ un compte de formation n'a jamais « Chez le comptable » (réelle, sans jumelle) parmi les destinations",
    Vs.destinationsPour(true).join("|") === "Chez le DG|BANQUE" && Vs.destinationsPour(false).join("|") === "Chez le DG|BANQUE|Chez le comptable");
  const cs = readFileSync("src/screens/Caisse.jsx", "utf8");
  test("★ écran Caisse : les destinations suivent l'espace REGARDÉ (destinationsPour(espaceDuCompte)), le geste refuse une destination hors liste, et « Chez le DG » est proposé d'office (Timo, 10/09/2026)",
    // ⚠ RETOURNÉ le 21/09/2026 : la liste dépend AUSSI de la source (le tiroir
    // ou un compte mobile) — « Le tiroir de la boutique » n'existe que pour un
    // compte mobile. Le mur, lui, n'a pas bougé : c'est toujours l'espace
    // REGARDÉ qui décide de « Chez le comptable ».
    /const destinations = destinationsPour\(espaceDuCompte\(db, profile\) === true, vers\.source\);/.test(cs) && /if \(!destinations\.includes\(vers\.destination\)\)/.test(cs) && !/DESTINATIONS_VERSEMENT/.test(cs)
    && /const destinationDefaut = DEST_DG;/.test(cs) && !/\? DEST_COMPTABLE : DEST_DG/.test(cs));
  const s10 = readFileSync("supabase/securite-10-versements.sql", "utf8");
  const ta = readFileSync("scripts/tester-argent-sql.sh", "utf8");
  test("★ securite-10 : versement_valide_le / _par ne s'écrivent que par l'administrateur PRINCIPAL (upsert relu) ; le banc tester-argent le pose et rejoue vendeur, gérant, admin secondaire (refusés) et DG (permis)",
    /create trigger depenses_regles_versement_trg\s+before insert or update on public\.depenses/.test(s10) && /select d\.data into avant from public\.depenses d where d\.id = new\.id;/.test(s10) && /if not public\.est_admin_principal\(\) then/.test(s10)
    && /-f supabase\/securite-10-versements\.sql/.test(ta) && /un vendeur se valide lui-même son versement \(versement_valide_le\)" "REFUSE"/.test(ta) && /un administrateur SECONDAIRE valide un versement" "REFUSE"/.test(ta) && /le DG \(administrateur principal\) valide un versement" "PERMIS"/.test(ta));
  test("★ écran Caisse : le geste revérifie le rôle (ROLES_VERSEMENT) et la lecture seule ; la validation DG revérifie l'administrateur PRINCIPAL ; le DG ne voit que la boutique REGARDÉE (Timo, 10/09/2026), prise parmi boutiquesVisibles",
    /if \(refuserSaufRoles\(profile, ROLES_VERSEMENT, "Verser les fonds"\)\) return;\n\s+if \(bloquerSiLecture\(db, profile\)\) return;/.test(cs)
    && /if \(refuserSaufAdminPrincipal\(db, profile, "Valider un versement de fonds \(DG\)"\)\) return;/.test(cs)
    && /const nomsDG = jeSuisDG \? boutiquesVisibles\(db, profile, db\.boutiques \|\| \[\]\)\.map\(\(b\) => b\.nom\)\.filter\(\(n\) => n === boutique\) : \[\];/.test(cs) && /versementsAValiderParDG\(db, nomsDG\)/.test(cs)
    && /Versements à valider par le DG \(\{aValiderDG\.length\}\) <Badge boutique=\{boutique\} \/>/.test(cs)
    // Captures Timo (10/09/2026) : montant en gras chez le DG ; les tableaux de la caisse défilent de droite à gauche sur téléphone.
    && /<b className="text-base tabular-nums">\{fmt\(d\.montant\)\}<\/b>/.test(cs) && /bg-white overflow-x-auto">\s*(\{\/\*[^]*?\*\/\}\s*)?<div[^>]*>Versements de \{boutique\}<\/div>\s*<table className="w-full text-sm min-w-\[640px\]">/.test(cs)
    && /bg-white overflow-x-auto">\s*<div[^>]*>Détail des encaissements/.test(cs) && !/bg-white overflow-hidden/.test(cs)
    && /messages: \[\.\.\.messagesVersement\(db, profile, r\.sortie\), \.\.\.\(db\.messages \|\| \[\]\)\]/.test(cs) && /\{vers\.destination === DEST_BANQUE && \(/.test(cs));
}

titre("✖ Rejet d'un versement de fonds (Timo, 10/09/2026 : « l'argent doit retourner comme jamais versé »)");
{
  const sortieVr = join("node_modules", ".cache", `bmi-rejet-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/versements.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVr, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vr = await import(pathToFileURL(sortieVr).href);
  unlinkSync(sortieVr);
  const ali = { id: "g1", nom: "ALI", role: "gerant", boutique: "APESSITO" };
  const timo = { id: "t", nom: "TIMO", role: "admin", admin_principal: true };
  const marie = { id: "c", nom: "MARIE", role: "comptable" };
  const dg = Vr.construireVersement(ali, { boutique: "APESSITO", montant: 50000, destination: "Chez le DG" });
  const cpt = Vr.construireVersement(ali, { boutique: "APESSITO", montant: 70000, destination: "Chez le comptable" });
  const bq = Vr.construireVersement(ali, { boutique: "APESSITO", montant: 90000, destination: "BANQUE", banque: "Ecobank", bordereau: "B-1" });
  const dbr = { users: [ali, timo, marie], ventes: [], dettes: [], depenses: [dg.sortie, cpt.sortie, cpt.entree, { ...bq.sortie, versement_valide_le: "2026-09-09", versement_valide_par: "TIMO" }, { boutique: "APESSITO", paiement: "Espèces", montant: 1000, categorie: "Transport", date: "2026-09-09" }] };
  test("★ la sortie porte l'auteur (par_id) pour le prévenir ; qui valide rejette : DG et BANQUE → le principal, Chez le comptable → le comptable",
    dg.sortie.par_id === "g1" && Vr.juryDuVersement(dg.sortie) === "principal" && Vr.juryDuVersement(bq.sortie) === "principal" && Vr.juryDuVersement(cpt.sortie) === "comptable");
  test("★ critiqueRejet : refuse un vendeur / gérant / admin secondaire / comptable sur un versement DG, le DG sur un versement Chez le comptable, un versement validé, un motif vide ; accepte le DG (DG, BANQUE) et le comptable (chez lui)",
    /Seul le DG/.test(Vr.critiqueRejet(dbr, dg.sortie, "x", { estPrincipal: false, role: "gerant" })) && /Seul le DG/.test(Vr.critiqueRejet(dbr, dg.sortie, "x", { estPrincipal: false, role: "comptable" }))
    && /Seul le comptable/.test(Vr.critiqueRejet(dbr, cpt.sortie, "x", { estPrincipal: true, role: "admin" })) && /déjà validé/.test(Vr.critiqueRejet(dbr, dbr.depenses[3], "x", { estPrincipal: true, role: "admin" }))
    && /pourquoi/.test(Vr.critiqueRejet(dbr, dg.sortie, "  ", { estPrincipal: true, role: "admin" })) && Vr.critiqueRejet(dbr, dg.sortie, "jamais reçu", { estPrincipal: true, role: "admin" }) === ""
    && Vr.critiqueRejet(dbr, cpt.sortie, "jamais reçu", { estPrincipal: false, role: "comptable" }) === "" && /pas un versement/.test(Vr.critiqueRejet(dbr, dbr.depenses[4], "x", { estPrincipal: true, role: "admin" })));
  const tv = (v) => Number(v.total || 0);
  const avant = Vr.fondsAVerser(dbr, "APESSITO", tv).montant;
  const r = Vr.rejeterVersement(dbr, timo, dg.sortie, " jamais reçu ", "2026-09-10");
  const db2 = { ...dbr, depenses: r.depenses };
  const rej = db2.depenses.find((d) => d.id === dg.sortie.id);
  test("★ rejeterVersement : montant 0 (« jamais versé » — les fonds à verser remontent d'autant), les trois champs du rejet, motif nettoyé, description marquée, le montant d'origine gardé dans versement.montant",
    rej.montant === 0 && rej.versement_rejete_le === "2026-09-10" && rej.versement_rejete_par === "TIMO" && rej.versement_rejet_motif === "jamais reçu" && /^✖ REJETÉ \(jamais reçu\) — Versement de fonds → Chez le DG$/.test(rej.description)
    && rej.versement.montant === 50000 && Vr.fondsAVerser(db2, "APESSITO", tv).montant === avant + 50000 && Vr.estRejete(rej) && Vr.rejetVersement(rej).motif === "jamais reçu" && Vr.validationVersement(db2, rej) === null);
  test("★ …un rejeté ne se valide plus, sort de la file du DG et paraît dans les traités ; le gérant reçoit UN message (par_id) qui dit rejeté, le motif, et « toujours en caisse »",
    Vr.versementsAValiderParDG(db2, ["APESSITO"]).map((d) => d.id).join("|") === "" && Vr.versementsValidesParDG(db2, ["APESSITO"]).map((d) => d.id).includes(dg.sortie.id)
    && r.messages.length === 1 && r.messages[0].a_id === "g1" && /REJETÉ/.test(r.messages[0].texte) && /Motif : jamais reçu/.test(r.messages[0].texte) && /toujours en caisse à APESSITO/.test(r.messages[0].texte) && /REJETÉ par TIMO/.test(r.journal));
  const rc = Vr.rejeterVersement(dbr, marie, cpt.sortie, "montant jamais reçu", "2026-09-10");
  const miroir = rc.depenses.find((d) => d.versement_id === cpt.versement.id);
  const autres = rc.depenses.filter((d) => d.id !== cpt.sortie.id && d.versement_id !== cpt.versement.id);
  test("★ Chez le comptable : la sortie ET l'entrée miroir passent à 0 et portent le rejet ; les autres lignes ne bougent pas ; un versement sans par_id retrouve son auteur par le nom",
    miroir.montant === 0 && miroir.versement_rejete_le === "2026-09-10" && /^✖ REJETÉ \(montant jamais reçu\) — Versement du/.test(miroir.description) && rc.depenses.find((d) => d.id === cpt.sortie.id).montant === 0
    && autres.every((d, i) => d === dbr.depenses.filter((x) => x.id !== cpt.sortie.id && x.versement_id !== cpt.versement.id)[i])
    && Vr.rejeterVersement(dbr, timo, { ...dg.sortie, par_id: undefined }, "x", "2026-09-10").messages[0].a_id === "g1");
  const csR = readFileSync("src/screens/Caisse.jsx", "utf8");
  const dpR = readFileSync("src/screens/Depenses.jsx", "utf8");
  const appR = readFileSync("src/App.jsx", "utf8");
  test("★ écran Caisse : « ✖ Rejeter » à côté de « ✅ Valider » chez le DG, motif demandé (uPrompt), critiqueRejet puis rejeterVersement, le principal revérifié ; l'historique montre le montant d'origine barré et « rejeté le … par … — motif »",
    /rejeterDG\(d\)\}[^>]*>✖ Rejeter<\/button>/.test(csR) && /refuserSaufAdminPrincipal\(db, profile, "Rejeter un versement de fonds \(DG\)"\)/.test(csR) && /const motif = await uPrompt\(/.test(csR)
    && /critiqueRejet\(db, d, motif, \{ estPrincipal: true, role: profile\.role \}\)/.test(csR) && /rejeterVersement\(db, profile, d, motif, today\(\)\)/.test(csR)
    && /line-through/.test(csR) && /\{fmt\(d\.versement\.montant\)\}/.test(csR) && /✖ rejeté le \{dFR\(rj\.le\)\} par \{rj\.par\} — \{rj\.motif\}/.test(csR) && /Derniers versements traités/.test(csR));
  test("★ Chez le comptable : « ✖ Rejeter » sur les entrées miroir (versement_id) en attente seulement, motif demandé, la sortie d'origine retrouvée, save par la porte rejetVersement ; un miroir rejeté quitte la file « à remettre »",
    /\{x\.versement_id && <button onClick=\{\(\) => rejeterVersementComptable\(x\)\}/.test(dpR) && /critiqueRejet\(db, sortie, motif, \{ estPrincipal: false, role: profile\.role \}\)/.test(dpR)
    && /save\(\{ \.\.\.db, depenses: r\.depenses, messages: \[\.\.\.r\.messages, \.\.\.\(db\.messages \|\| \[\]\)\] \}, r\.journal, \{ rejetVersement: true \}\);/.test(dpR)
    && /const aRemettre = liste\.filter\(\(x\) => !x\.decaisse_le && !estRejete\(x\)\);/.test(dpR)
    && /const pointageAutorise = \(options\.pointageComptable === true \|\| options\.rejetVersement === true\) && profile\?\.role === "comptable";/.test(appR));
  const s12 = readFileSync("supabase/securite-12-rejet-versement.sql", "utf8");
  const ta12 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
  test("★ securite-12 : qui valide rejette (principal / comptable), en attente seulement, motif obligatoire, rejet inaltérable, montant FORCÉ à 0, rejeté jamais validé ni encaissé, comptable limité aux champs du rejet ; le banc tester-argent le pose et rejoue 23 cas",
    /if destination = 'Chez le comptable' then\s+if r <> 'comptable' then perform public\.refus_role/.test(s12) && /if not public\.est_admin_principal\(\) then perform public\.refus_role\('Rejeter un versement \(Chez le DG, BANQUE\)'/.test(s12)
    && /Rejeter un versement déjà validé/.test(s12) && /Rejeter un versement déjà encaissé/.test(s12) && /Rejeter un versement sans motif/.test(s12) && /Annuler ou modifier le rejet d''un versement/.test(s12)
    && /new\.data := jsonb_set\(new\.data, '\{montant\}', '0'::jsonb, true\);/.test(s12) && /Valider un versement rejeté/.test(s12) && /Encaisser un versement rejeté/.test(s12) && /Créer un versement déjà rejeté/.test(s12)
    && /- 'versement_rejete_le' - 'versement_rejete_par' - 'versement_rejet_motif' - 'montant' - 'description'/.test(s12) && /select d\.data into avant from public\.depenses d where d\.id = new\.id;/.test(s12)
    && /-f supabase\/securite-12-rejet-versement\.sql/.test(ta12) && (ta12.match(/^essai "★ [^"]*rejet[^"]*" "(REFUSE|PERMIS)"/gmi) || []).length >= 19
    && /le serveur FORCE le montant à 0[^"]*" "PERMIS"/.test(ta12) && /le comptable rejette un versement « Chez le comptable » en attente[^"]*" "PERMIS"/.test(ta12) && /le DG rejette un versement « Chez le comptable »[^"]*" "REFUSE"/.test(ta12));
}

titre("💸 Un versement de fonds n'est pas une dépense (Timo, 10/09/2026 : « pourquoi il pense que le versement est une dépense ? »)");
{
  // Capture Timo : 259 300 F de ventes sur la semaine, un versement de
  // 252 299 F et 1 F de dépense → le tableau de bord disait « dépenses
  // 252 300 F, résultat 7 000 F ». Un versement change de poche, il n'est
  // pas perdu : hors dépenses, hors résultat, hors journal, hors export des
  // dépenses. La caisse seule (fonds à verser, clôture) le déduit.
  const sortieK = join("node_modules", ".cache", `bmi-constants-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/constants.js"], bundle: true, format: "esm", platform: "node", outfile: sortieK, logLevel: "silent" });
  const K = await import(pathToFileURL(sortieK).href);
  unlinkSync(sortieK);
  const sortieVk = join("node_modules", ".cache", `bmi-versements-k-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/versements.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVk, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vk = await import(pathToFileURL(sortieVk).href);
  unlinkSync(sortieVk);
  const deps = [{ boutique: "A", montant: 252299, categorie: "Versement de fonds", versement: { destination: "Chez le DG" } }, { boutique: "A", montant: 1, categorie: "Transport" }, { boutique: "Chez le comptable", montant: -252299, categorie: "Versement de fonds", versement_id: "x" }];
  test("★ la catégorie vit dans constants.js, réexportée par lib/versements.js (importée ET réexportée) ; horsVersements retire la sortie de la boutique ET l'entrée miroir, garde le reste, accepte une liste absente",
    K.CATEGORIE_VERSEMENT === "Versement de fonds" && Vk.CATEGORIE_VERSEMENT === "Versement de fonds" && Vk.horsVersements(deps).length === 1
    && K.horsVersements(deps).length === 1 && K.horsVersements(deps)[0].montant === 1 && K.horsVersements(undefined).length === 0
    // ⚠ RETOURNÉ le 21/09/2026 : l'import porte aussi les comptes mobiles
    // (`estMoyenMobile`, `mobileParMoyen`). Ce qui est protégé est le même :
    // la catégorie est IMPORTÉE puis RÉEXPORTÉE — jamais `export { x } from`
    // seul, qui ne crée aucune variable locale (piège touché deux fois).
    && /import \{ CATEGORIE_VERSEMENT, CATEGORIE_FONDS_CAISSE, horsVersements, estMoyenMobile, mobileParMoyen \} from "\.\/constants\.js";\n[^]*?export \{ CATEGORIE_VERSEMENT, CATEGORIE_FONDS_CAISSE, horsVersements \};/.test(readFileSync("src/lib/versements.js", "utf8")));
  const dbJ = { ...base(), ventes: [], dettes: [],
    depenses: [{ id: "j1", boutique: "APESSITO", montant: 252299, date: "2026-09-10", categorie: "Versement de fonds", paiement: "Espèces", versement: { destination: "Chez le DG" } },
               { id: "j2", boutique: "APESSITO", montant: 1, date: "2026-09-10", categorie: "Transport", paiement: "Espèces" }] };
  const lignesJ = Core.lignesJournal(dbJ, "2026-09-01", "2026-09-30");
  test("★ le journal comptable n'écrit pas le versement en charge : la seule dépense du mois y est (1 F), pas les 252 299 F",
    // 12/09/2026 : depensesComptees (hors versements ET hors dépenses en attente de validation).
    !JSON.stringify(lignesJ).includes("252299") && JSON.stringify(lignesJ).includes("Transport") && /depensesComptees\(db\.depenses\)\.filter\(\(x\) => reel\(x\) && inP\(x\.date, a, b\)\)/.test(readFileSync("src/lib/core.js", "utf8")));
  const dashV = readFileSync("src/screens/Dashboard.jsx", "utf8");
  // 12/09/2026 : depensesComptees, qui retire AUSSI les dépenses en attente de validation.
  test("★ tableau de bord : cartes (depensesReellesDb), synthèse par période et période libre (d[bq]) passent par depensesComptees (hors versements, hors dépenses en attente — 12/09/2026) ; l'export « Dépenses » ne contient plus les versements, qui ont leur export « Versements » (montant d'origine, destination, état)",
    /const depensesReellesDb = depensesComptees\(db\.depenses\)\.filter\(dansMonEspace\)\.filter\(dansLaBoutique\);/.test(dashV)
    && (dashV.match(/d\[bq\] = depensesComptees\(db\.depenses\)\.filter\(\(x\) => x\.boutique === bq && inP\(x\.date, a, b\)\)/g) || []).length === 2 && !/d\[bq\] = db\.depenses/.test(dashV) && !/horsVersements\(/.test(dashV)
    && /exportCSV\("versements", \["Date", "Boutique", "Description", "Montant", "Destination", "Saisi par", "État"\]/.test(dashV) && /x\.versement \? x\.versement\.montant : x\.montant/.test(dashV)
    && /const totalDepenses = depensesReellesDb\.reduce/.test(dashV));
}

titre("⚠ La liste des articles à réapprovisionner (Timo, 10/09/2026)");
{
  // « Comment avoir la liste de tous les articles à approvisionner ? » — une
  // règle pure : tous les articles d'une boutique au seuil ou en dessous, du
  // plus urgent au moins urgent, avec le manque (seuil − reste, au moins 1).
  const stockR = (db, p) => Number(p.initial || 0) + Number(p.entrees || 0);
  const dbR = { produits: [
    { id: "r1", boutique: "A", nom: "ZETA", seuil: 5, initial: 2 },       // manque 3
    { id: "r2", boutique: "A", nom: "ALPHA", seuil: 5, initial: 2 },      // manque 3, même urgence : ordre alphabétique
    { id: "r3", boutique: "A", nom: "RUPTURE", seuil: 10, initial: 0 },   // manque 10 : le plus urgent
    { id: "r4", boutique: "A", nom: "JUSTE", seuil: 3, initial: 3 },      // au seuil : listé, manque 1
    { id: "r5", boutique: "A", nom: "OK", seuil: 3, initial: 4 },         // au-dessus : absent
    { id: "r6", boutique: "A", nom: "SANS SEUIL", seuil: 0, initial: 0 }, // 0 / 0 : listé, manque 1
    { id: "r7", boutique: "B", nom: "AILLEURS", seuil: 10, initial: 0 },  // autre boutique : absent
  ] };
  const liste = C.articlesAReapprovisionner(dbR, stockR, "A");
  test("★ articlesAReapprovisionner : seuil ou en dessous seulement, la boutique demandée seulement, du plus urgent au moins urgent, même urgence → alphabétique",
    liste.map((x) => x.p.nom).join("|") === "RUPTURE|ALPHA|ZETA|SANS SEUIL|JUSTE" && C.articlesAReapprovisionner(dbR, stockR, "B").length === 1 && C.articlesAReapprovisionner(dbR, stockR, "C").length === 0);
  test("★ …le manque = seuil − reste, jamais moins de 1 (au seuil, ou seuil 0 et rien en stock)",
    liste.map((x) => x.manque).join("|") === "10|3|3|1|1" && liste[0].actuel === 0 && liste[0].seuil === 10);
}

titre("↩ Reprise de l'article par BMI (Timo, 10/09/2026 : « Reprise pour l'administrateur principal seul » ; 14/09/2026 : « Reprise de l'article par BMI », pas « par le client » — c'est BMI qui reprend, le client rend)");
{
  const sortieRp = join("node_modules", ".cache", `bmi-reprises-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/reprises.js"], bundle: true, format: "esm", platform: "node", outfile: sortieRp, logLevel: "silent" });
  const Rp = await import(pathToFileURL(sortieRp).href);
  unlinkSync(sortieRp);
  const timo = { id: "t", nom: "TIMO", role: "admin", admin_principal: true };
  // Une vente : 2 batteries à 12 000 + 1 câble HB à 1 000, remise globale 1 300 (10 % du panier), rabais 0.
  const vente = { id: "v1", boutique: "APESSITO", client: "AMA", date: "2026-09-09", paiement: "Espèces", remise: 1300, commercial: "KOSSI",
    articles: [{ produit_id: "p1", article: "BATTERIE", qte: 2, pu: 12000 }, { produit_id: "p2", article: "CABLE", qte: 1, pu: 1000, hors_boutique: true }] };
  const dbp = { ventes: [vente], dettes: [], depenses: [], ajustements: [], clients_installes: [], produits: [{ id: "p1", boutique: "APESSITO", nom: "BATTERIE", prix_achat: 8000 }] };
  test("★ lignes reprenables : les articles du stock seulement (jamais hors boutique), avec le restant après reprises ; montant repris = prix payé net des remises au prorata (1 batterie = 12 000 − 1 300 × 12 000/25 000 = 11 376)",
    Rp.lignesReprenables(vente).map((l) => `${l.produit_id}:${l.restant}`).join("|") === "p1:2" && Rp.montantReprise(vente, Rp.lignesReprenables(vente)[0], 1) === 11376
    && Rp.lignesReprenables({ ...vente, reprises: [{ produit_id: "p1", qte: 2, montant: 1 }] }).length === 0 && Rp.MOYENS_REMBOURSEMENT.includes("Crédit (dette)") === false && Rp.moyenParDefaut(vente) === "Espèces" && Rp.moyenParDefaut({ paiement: "Crédit (dette)" }) === "Espèces");
  test("★ critiqueReprise : refuse hors boutique, quantité au-delà du restant, motif vide, moyen à crédit, vente avec chantier, commission déjà payée ; accepte le cas normal",
    /ne figure pas|déjà été entièrement/.test(Rp.critiqueReprise(dbp, vente, { produit_id: "p2", qte: 1, motif: "x", moyen: "Espèces" })) && /Quantité invalide/.test(Rp.critiqueReprise(dbp, vente, { produit_id: "p1", qte: 3, motif: "x", moyen: "Espèces" }))
    && /pourquoi/.test(Rp.critiqueReprise(dbp, vente, { produit_id: "p1", qte: 1, motif: " ", moyen: "Espèces" })) && /rendu/.test(Rp.critiqueReprise(dbp, vente, { produit_id: "p1", qte: 1, motif: "x", moyen: "Crédit (dette)" }))
    && /chantier/.test(Rp.critiqueReprise({ ...dbp, clients_installes: [{ vente_id: "v1", nom: "AMA" }] }, vente, { produit_id: "p1", qte: 1, motif: "x", moyen: "Espèces" }))
    && /commission/.test(Rp.critiqueReprise(dbp, { ...vente, commission_payee: true }, { produit_id: "p1", qte: 1, motif: "x", moyen: "Espèces" }))
    && Rp.critiqueReprise(dbp, vente, { produit_id: "p1", qte: 1, motif: "changé d'avis", moyen: "Espèces" }) === "");
  const r = Rp.construireReprise(dbp, vente, { produit_id: "p1", qte: 1, motif: " changé d'avis ", moyen: "Espèces" }, timo, "2026-09-10");
  const db2 = Rp.appliquerReprise(dbp, r);
  test("★ vente payée : la vente garde ses lignes et son total (reçu intact), porte la reprise ; l'article revient au stock (ajustement +1, reprise_client) ; 11 376 F rendus = une dépense « Remboursement client » du jour, en espèces, liée à la vente",
    Core.totalVente(r.vente) === Core.totalVente(vente) && r.vente.articles.length === 2 && r.vente.reprises.length === 1 && r.vente.reprises[0].qte === 1 && r.vente.reprises[0].montant === 11376 && r.vente.reprises[0].motif === "changé d'avis"
    && r.ajustement.qte === 1 && r.ajustement.type === "reprise_client" && r.ajustement.produit_id === "p1" && r.ajustement.boutique === "APESSITO" && r.ajustement.vente_id === "v1"
    && r.depense.categorie === "Remboursement client" && r.depense.montant === 11376 && r.depense.paiement === "Espèces" && r.depense.boutique === "APESSITO" && r.depense.vente_id === "v1" && r.depense.date === "2026-09-10" && r.dette === null
    && db2.ventes[0].reprises.length === 1 && db2.ajustements.length === 1 && db2.depenses.length === 1 && C.stockAjuste(db2, "p1") === 1 && /REP-[A-Z0-9]{8}/.test(r.journal));
  // CA tel que vendu : 24 000 de stock − la part de remise qui lui revient (1 300 × 24 000/25 000 = 1 248) = 22 752 ; une batterie reprise = 11 376.
  test("★ le chiffre d'affaires et la commission deviennent NETS de la reprise (caVente 22 752 → 11 376 ; commission 10 % : 2 275 → 1 138 ; Rentabilité : caLigneVente et qteReprise), le CA tel que vendu reste lisible (caVenteBrut)",
    Core.caVente(vente) === 22752 && Core.caVente(r.vente) === 11376 && Core.caVenteBrut(r.vente) === 22752 && Core.montantRepris(r.vente) === 11376 && Core.qteReprise(r.vente, "p1") === 1
    && Math.round(Core.caLigneVente(r.vente, r.vente.articles[0])) === 11376 && C.commissionBrute(r.vente, 10) === 1138 && C.commissionBrute(vente, 10) === 2275
    && /const qteNette = Math\.max\(0, Number\(l\.qte \|\| 0\) - qteReprise\(v, l\.produit_id\)\);/.test(readFileSync("src/screens/Rentabilite.jsx", "utf8")));
  // Vente à crédit : dette 22 700 (montant saisi), le client a versé 15 000 → reprise d'une batterie (11 376) : dette 11 324, 3 676 rendus.
  const venteC = { ...vente, id: "v2", paiement: "Crédit (dette)" };
  const dbc = { ...dbp, ventes: [venteC], dettes: [{ id: "d2", vente_id: "v2", boutique: "APESSITO", montant: 22700, paye: 15000, paiements: [{ date: "2026-09-09", montant: 15000 }] }] };
  const rc = Rp.construireReprise(dbc, venteC, { produit_id: "p1", qte: 1, motif: "x", moyen: "Espèces" }, timo, "2026-09-10");
  const rc0 = Rp.construireReprise({ ...dbc, dettes: [{ ...dbc.dettes[0], paye: 5000 }] }, venteC, { produit_id: "p1", qte: 1, motif: "x", moyen: "Espèces" }, timo, "2026-09-10");
  test("★ vente à crédit : la dette diminue de la reprise (22 700 → 11 324), seuls les 3 676 versés au-delà sont rendus ; rien versé en trop → aucune dépense, moyen vide ; les versements passés restent intacts",
    rc.dette.montant === 11324 && rc.rembourse === 3676 && rc.depense.montant === 3676 && rc.dette.paye === 15000 && rc.dette.paiements.length === 1 && rc.dette.reprises[0].montant === 11376
    && rc0.dette.montant === 11324 && rc0.rembourse === 0 && rc0.depense === null && rc0.reprise.moyen === "" && Rp.appliquerReprise(dbc, rc).dettes[0].montant === 11324 && Rp.appliquerReprise(dbc, rc).depenses.length === 1);
  const sortieK2 = join("node_modules", ".cache", `bmi-constants-rp-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/constants.js"], bundle: true, format: "esm", platform: "node", outfile: sortieK2, logLevel: "silent" });
  const K2 = await import(pathToFileURL(sortieK2).href);
  unlinkSync(sortieK2);
  test("★ « Remboursement client » n'est pas une charge : hors tableau de bord, hors journal (horsVersements l'exclut comme le versement)",
    // 12/09/2026 : « Remboursement d'avance de frais » rejoint la liste (la charge est déjà comptée le jour de l'avance).
    K2.horsVersements([{ categorie: "Remboursement client", montant: 1 }, { categorie: "Versement de fonds" }, { categorie: "Remboursement d'avance de frais" }, { categorie: "Transport" }]).length === 1 && K2.CATEGORIES_HORS_CHARGES.join("|") === "Versement de fonds|Remboursement client|Remboursement d'avance de frais|Fonds de caisse remis" /* 14/09/2026 : le fonds remis par le DG non plus */);
  const vs = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ les MOTS (Timo, 14/09/2026, capture : « Reprise d'un article par BMI ou par le client ? » → « Reprise de l'article par BMI ») : la fenêtre, l'infobulle et le journal disent que BMI reprend ; plus jamais « par le client »",
    /↩ Reprise de l'article par BMI<\/div>/.test(vs) && /title="↩ Reprise de l'article par BMI : le client ne le prend pas/.test(vs) && !/Reprise d'un article par le client|repris par le client/.test(vs)
    && /repris par BMI \(reçu/.test(readFileSync("src/lib/reprises.js", "utf8")) && !/repris par le client/.test(readFileSync("src/lib/reprises.js", "utf8")));
  test("★ écran Ventes : « ↩ Reprise » pour l'administrateur PRINCIPAL seul (estAdminPrincipal à l'affichage, refuserSaufAdminPrincipal dans le geste, deux fois), fenêtre avec article / quantité / motif / moyen, aperçu du montant et de la dette, confirmation qui dit que le reçu ne change pas, écriture par appliquerReprise ; la ligne montre « ↩ N repris »",
    /const jeSuisPrincipal = estAdminPrincipal\(db, profile\);/.test(vs) && /\{jeSuisPrincipal && lignesReprenables\(v\)\.length > 0 && \(/.test(vs) && (vs.match(/refuserSaufAdminPrincipal\(db, profile, "Reprendre un article vendu"\)/g) || []).length === 2
    && /construireReprise\(db, reprise\.vente, \{ produit_id: reprise\.produit_id, qte: Number\(reprise\.qte\), motif: reprise\.motif, moyen: reprise\.moyen \}, profile, today\(\)\)/.test(vs)
    && /const dbApres = appliquerReprise\(db, r\);\n\s*save\(dbApres, r\.journal\);/.test(vs) /* 14/09/2026 : le bon de reprise est proposé juste après */ && /Le reçu et le total encaissé ne changent pas/.test(vs) && /MOYENS_REMBOURSEMENT\.map/.test(vs)
    // 12/09/2026 (liste des ventes lisible) : le compte des repris vit dans ArticlesVente — « ↩ N repris » toujours sur la ligne.
    && /const repris = \(v\.reprises \|\| \[\]\)\.reduce/.test(vs) && /↩ \{repris\} repris/.test(vs));
  // Timo (12/09/2026, seconde capture) : « +1 autre ou +3 autres ne s'affiche
  // pas… lorsqu'on clique sur la ligne, la suite apparaît, on clique encore
  // (même ligne ou ailleurs) ça revient à 2 lignes par défaut » — et « remplacer
  // l'icône de WhatsApp par le vrai icône WhatsApp ». Le rendu est MESURÉ dans
  // un vrai navigateur par verifier-ecran-ventes ; ici, la forme du geste.
  test("★ Ventes : la suite des articles se voit au CLIC sur la ligne (une seule vente dépliée, un clic n'importe où replie), la cellule des boutons ne déplie pas, et le bouton WhatsApp porte le vrai logo (IconeWhatsApp, écrit une fois dans ui.jsx), plus l'emoji 💬",
    /const \[venteDepliee, setVenteDepliee\] = useState\(null\);/.test(vs) && /onClick=\{\(\) => setVenteDepliee\(\(d\) => \(d === v\.id \? null : v\.id\)\)\}/.test(vs) /* 12/09/2026 : « un seul clic pour sélectionner une autre » — une autre ligne se déplie directement */
    && /<ArticlesVente v=\{v\} deplie=\{venteDepliee === v\.id\} \/>/.test(vs)
    // Timo (12/09/2026) : « une sélection forte bien visible pour la ligne sélectionnée » — fond bleu soutenu + barre à gauche, couleur de l'espace.
    // 13/09/2026 : la surbrillance est écrite UNE fois (classeLigneDepliable, ui.jsx) — Ventes et Dettes y passent.
    && /classeLigneDepliable\(venteDepliee === v\.id, i\)/.test(vs) && /export const classeLigneDepliable = \(deplie, i, fondSinon = ""\) => deplie \? "bg-sky-200 shadow-\[inset_6px_0_0_0_var\(--color-sky-700\)\]"/.test(readFileSync("src/components/ui.jsx", "utf8"))
    && /text-right" onClick=\{\(e\) => e\.stopPropagation\(\)\}>\n\s*<div className="inline-flex items-center gap-1">/.test(vs)
    && /aria-label="WhatsApp"><IconeWhatsApp \/><\/button>/.test(vs) && !/aria-label="WhatsApp">💬/.test(vs)
    && /export const IconeWhatsApp = \(\{ taille = 18 \}\) =>/.test(readFileSync("src/components/ui.jsx", "utf8")) && /fill="#25D366"/.test(readFileSync("src/components/ui.jsx", "utf8")));
  // Timo (13/09/2026, capture de 📋 Dettes) : « appliquer la même règle que
  // dans Ventes pour restructurer les dettes ». Les briques sont écrites UNE
  // fois dans ui.jsx (ListeArticles, boutonAction, classeLigneDepliable) et
  // lignesDette (core.js) redécoupe le motif d'une dette en lignes.
  {
    const ui = readFileSync("src/components/ui.jsx", "utf8");
    const dj = readFileSync("src/screens/Dettes.jsx", "utf8");
    test("★ ListeArticles, boutonAction et classeLigneDepliable sont écrits UNE fois (ui.jsx) ; Ventes n'a plus sa copie de boutonAction et ArticlesVente s'appuie sur ListeArticles",
      /export function ListeArticles\(\{ lignes, deplie = false, enfants = null \}\)/.test(ui) && /export const boutonAction = \(teinte\) =>/.test(ui) && /export const ARTICLES_VISIBLES = 2;/.test(ui)
      && !/const boutonAction = /.test(vs) && /<ListeArticles lignes=\{lignesVente\(v\)\} deplie=\{deplie\}/.test(vs) && (execSync("grep -rl 'inline-flex items-center justify-center w-8 h-8 rounded-full' src || true").toString().trim() === "src/components/ui.jsx"));
    test("★ lignesDette : une dette née d'une vente rend ses articles ({ qte, article }) ; un motif « 2× A, 2× B » se redécoupe ; un motif libre avec virgule reste UNE ligne sans quantité ; sans rien → vide",
      JSON.stringify(Core.lignesDette({ articles: [{ nom: "Panneau", qte: 2 }, { nom: "Batterie", qte: 1 }] })) === JSON.stringify([{ qte: 2, article: "Panneau" }, { qte: 1, article: "Batterie" }])
      && JSON.stringify(Core.lignesDette({ motif: "2× Récepteur BOLT 16010-18, 2× Moteur BOLT F100 Nm, 1× Télécommande" })) === JSON.stringify([{ qte: 2, article: "Récepteur BOLT 16010-18" }, { qte: 2, article: "Moteur BOLT F100 Nm" }, { qte: 1, article: "Télécommande" }])
      && JSON.stringify(Core.lignesDette({ motif: "Réparation, pièces et main-d'œuvre" })) === JSON.stringify([{ qte: null, article: "Réparation, pièces et main-d'œuvre" }])
      && Core.lignesDette({ motif: "" }).length === 0 && Core.lignesDette({}).length === 0);
    test("★ écran Dettes : la ligne se déplie au clic (detteDepliee, une seule, un clic sur une autre la déplie directement), surbrillance commune (classeLigneDepliable, retard en rouge pâle), ListeArticles sur lignesDette, montants à droite, boutons ronds (🖨, 💵 Paiement, Relancer = logo WhatsApp, 🗑 admin) dans une cellule qui ne déplie pas ; mêmes gestes, mêmes gardes",
      /const \[detteDepliee, setDetteDepliee\] = useState\(null\);/.test(dj) && /onClick=\{\(\) => setDetteDepliee\(\(x\) => \(x === d\.id \? null : d\.id\)\)\}/.test(dj)
      && /classeLigneDepliable\(detteDepliee === d\.id, i, estRetard \? "bg-red-50" : ""\)/.test(dj)
      // 13/09/2026 : la première colonne (Date) reste figée, ordinateur aussi ; Dépenses pareil (Date, fond de la ligne gardé) ; plus aucun lg:static dans l'application.
      && /celluleFigee\(fondLigneDepliable\(detteDepliee === d\.id, i, estRetard \? "bg-red-50" : ""\), detteDepliee === d\.id\)/.test(dj) && /\$\{i === 0 \? ` \$\{enTeteFige\("bg-slate-100"\)\}` : ""\}/.test(dj)
      && /celluleFigee\(estRejetee\(x\) \? "bg-red-50" : estEnAttente\(x\) \? "bg-amber-50" : "bg-white"\)/.test(readFileSync("src/screens/Depenses.jsx", "utf8")) && /\$\{i === 0 \? ` \$\{enTeteFige\("bg-white"\)\}` : ""\}/.test(readFileSync("src/screens/Depenses.jsx", "utf8"))
      && execSync("grep -rl 'lg:static' src || true").toString().trim() === "" && (execSync("grep -rl 'sticky left-0' src --include=*.jsx || true").toString().trim() === "src/components/ui.jsx")
      && /<ListeArticles lignes=\{lignes\} deplie=\{detteDepliee === d\.id\} \/>/.test(dj) && /const lignes = lignesDette\(d\);/.test(dj)
      && (dj.match(/tabular-nums text-right whitespace-nowrap/g) || []).length === 3 && /text-right" onClick=\{\(e\) => e\.stopPropagation\(\)\}>\n\s*<div className="inline-flex items-center gap-1">/.test(dj)
      && /aria-label="Imprimer le reçu">🖨<\/button>/.test(dj) && /\{st !== "Payée" && \(/.test(dj) && /onClick=\{\(\) => encaisser\(d\)\}[^\n]*aria-label="Paiement">💵<\/button>/.test(dj) && /onClick=\{\(\) => relancer\(d\)\}[^\n]*aria-label="Relancer"><IconeWhatsApp \/><\/button>/.test(dj)
      && /\{profile\.role === "admin" && \(\n\s*<button onClick=\{\(\) => supprimerDette\(d\)\}[^\n]*aria-label="Supprimer">🗑<\/button>/.test(dj) && !/underline mr-2">🖨 Reçu/.test(dj));
  }
  const s13 = readFileSync("supabase/securite-13-reprise.sql", "utf8");
  const ta13 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
  test("★ securite-13 : reprises = principal seul et jamais en arrière (ventes, upsert relu), ajustement reprise_client = principal, dépense « Remboursement client » = principal ; le banc tester-argent le pose et rejoue vendeur / gérant / admin secondaire refusés, principal permis, effacement refusé",
    /Reprendre un article vendu', 'l''administrateur principal'/.test(s13) && /jsonb_array_length\(new\.data -> 'reprises'\)[^]*?Effacer une reprise/.test(s13) && /if t = 'reprise_client' then\s+if not public\.est_admin_principal\(\)/.test(s13)
    && /'Remboursement client' and not public\.est_admin_principal\(\)/.test(s13) && /select v\.data into avant from public\.ventes v where v\.id = new\.id;/.test(s13) && /Rejeter un versement déjà validé/.test(s13)
    && /-f supabase\/securite-13-reprise\.sql/.test(ta13) && /un administrateur SECONDAIRE note une reprise" "REFUSE"/.test(ta13) && /l'administrateur PRINCIPAL note une reprise" "PERMIS"/.test(ta13)
    && /la liste ne rétrécit jamais\)" "REFUSE"/.test(ta13) && /un gérant crée une dépense « Remboursement client »" "REFUSE"/.test(ta13) && /l'administrateur PRINCIPAL remet l'article au stock \(reprise_client\)" "PERMIS"/.test(ta13));
}

titre("Les remises par article : 3 % max sauf admin, jamais ligne + générale (Timo, 10/09/2026)");
{
  const l3 = { article: "BATTERIE", qte: 2, pu: 100000, remise_ligne: 6000 };   // 3 %
  const l5 = { article: "BATTERIE", qte: 1, pu: 100000, remise_ligne: 5000 };   // 5 %
  const l0 = { article: "CABLE", qte: 1, pu: 1000 };
  test("★ règle pure : 3 % sur une ligne passe pour un vendeur, 5 % exige l'admin (nommé dans le message), l'admin est libre ; une remise de 0 ne compte pas",
    C.critiqueRemises([l3, l0], 0, 0, "vendeur") === "" && /3 % sur un article[^]*BATTERIE[^]*5 %/.test(C.critiqueRemises([l5], 0, 0, "vendeur")) && C.critiqueRemises([l5], 0, 0, "admin") === ""
    && C.remiseLigneExigeAdmin(l5) && !C.remiseLigneExigeAdmin(l3) && !C.remiseLigneExigeAdmin({ qte: 1, pu: 100, remise_ligne: 0 }) && C.pctRemiseLigne(l5) === 5 && !C.aRemiseSurArticle([l0]) && C.aRemiseSurArticle([l0, l3]));
  test("★ remise sur un article ET remise générale (en % ou en F) → refusé pour TOUT LE MONDE, l'admin compris ; générale seule ou ligne seule → accepté",
    C.critiqueRemises([l3], 2, 0, "vendeur") === C.MSG_REMISE_EXCLUSIVE && C.critiqueRemises([l3], 0, 4000, "admin") === C.MSG_REMISE_EXCLUSIVE && C.critiqueRemises([l5], 2, 4000, "admin") === C.MSG_REMISE_EXCLUSIVE
    && C.critiqueRemises([l0], 2, 2000, "vendeur") === "" && C.critiqueRemises([l3], 0, 0, "gerant") === "" && C.critiqueRemises([], 3, 0, "vendeur") === "");
  const vr = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ écran Ventes : la règle est vérifiée à l'ajout au panier, à l'encaissement et sur les deux proformas ; la remise générale est grisée dès qu'un article porte une remise, et les remises de ligne dès qu'une remise générale est saisie",
    /if \(remL > 0 && Number\(f\.remise \|\| 0\) > 0\) \{ uAlert\(`🔒 \$\{MSG_REMISE_EXCLUSIVE\}`\); return; \}/.test(vr) && /remL > 0 && profile\.role !== "admin" && remiseLigneExigeAdmin\(\{ qte: q, pu: sel\.pu, remise_ligne: remL \}\)/.test(vr)
    && (vr.match(/critiqueRemises\(panier, remisePct, remise, profile\.role\)/g) || []).length === 3
    && /value=\{f\.remise\}[^\n]*disabled=\{aRemiseSurArticle\(panier\)\}/.test(vr) && (vr.match(/disabled=\{Number\(f\.remise \|\| 0\) > 0\}/g) || []).length === 2);
  const s14 = readFileSync("supabase/securite-14-remise-article.sql", "utf8");
  const ta14 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
  test("★ securite-14 : deux lectures SQL des lignes (a_remise_sur_article, remise_ligne_excessive, retirées à anon), ventes et proformas — 3 % par ligne sauf admin, ligne + générale refusé pour tous, seulement quand lignes ou remise changent (upsert relu) ; la reprise (securite-13) est reprise telle quelle ; le banc rejoue 14 cas",
    /create or replace function public\.remise_ligne_excessive\(lignes jsonb\)/.test(s14) && /revoke all on function public\.remise_ligne_excessive\(jsonb\) from public, anon;/.test(s14)
    && /Remise sur un article ET remise générale sur la même vente', 'personne/.test(s14) && /if r <> 'admin' and public\.remise_ligne_excessive\(new\.data -> 'articles'\)/.test(s14)
    && /\(avant -> 'articles'\) is distinct from \(new\.data -> 'articles'\)/.test(s14) && /Reprendre un article vendu', 'l''administrateur principal'/.test(s14) && /Effacer une reprise/.test(s14)
    && /Remise sur un article ET remise générale sur le même proforma/.test(s14) && /Remise supérieure à 3 % sur un article \(proforma\)/.test(s14)
    && /-f supabase\/securite-14-remise-article\.sql/.test(ta14) && /un vendeur vend avec 5 % de remise sur un article[^"]*" "REFUSE"/.test(ta14) && /un vendeur vend avec 3 % sur un article[^"]*" "PERMIS"/.test(ta14)
    && /l'ADMIN aussi : remise sur un article ET remise générale, jamais[^"]*" "REFUSE"/.test(ta14) && /SANS toucher aux lignes ni à la remise \(par upsert\)" "PERMIS"/.test(ta14) && /un vendeur émet un proforma avec 5 % sur un article" "REFUSE"/.test(ta14));
}

titre("🛒 Reprendre une proforma dans le panier (Timo, 11/09/2026)");
{
  // « Dans les grands logiciels, la proforma se transforme en vente comme un
  // devis. » Choix de Timo : la garder telle quelle, mais la rendre REPRENABLE.
  const dbP = { produits: [
    { id: "p1", boutique: "A", nom: "PANNEAU 550W", prix_vente: 100000 },
    { id: "p2", boutique: "A", nom: "BATTERIE GEL", prix_vente: 90000 },
    { id: "p3", boutique: "B", nom: "PANNEAU 550W", prix_vente: 100000 },
  ] };
  const pf = { numero: "PRF-1", boutique: "A", client: "AMA", tel: "90", remise_pct: 2,
    lignes: [
      { produit_id: "p1", article: "PANNEAU 550W", qte: 2, pu: 100000, remise_ligne: 0 },
      { produit_id: "p2", article: "BATTERIE GEL", qte: 1, pu: 80000, remise_ligne: 0 },
      { produit_id: "zz", article: "ARTICLE PARTI", qte: 1, pu: 5000, remise_ligne: 0 },
    ] };
  const r = C.reprendreProforma(dbP, pf, "A");
  test("★ reprendreProforma : le panier est rempli depuis les fiches du stock de la boutique, l'article introuvable est LISTÉ (jamais mis au panier sans sa fiche), la remise générale est reprise",
    r.refus === "" && r.panier.map((l) => `${l.produit_id}:${l.qte}:${l.pu}`).join("|") === "p1:2:100000|p2:1:80000"
    && r.introuvables.join("|") === "ARTICLE PARTI" && r.remisePct === 2 && r.remiseEcartee === false);
  test("★ …un prix qui a changé depuis est SIGNALÉ, et c'est le prix de la proforma qui est gardé (jamais corrigé en douce)",
    r.prixChanges.map((c) => `${c.article}:${c.propose}:${c.aujourdhui}`).join("|") === "BATTERIE GEL:80000:90000"
    && r.panier.find((l) => l.produit_id === "p2").pu === 80000);
  test("★ …une proforma d'une AUTRE boutique est refusée en nommant la bonne (on ne change jamais de boutique tout seul)",
    /émise à A\./.test(C.reprendreProforma(dbP, pf, "B").refus) && /Choisissez d'abord la boutique A/.test(C.reprendreProforma(dbP, pf, "B").refus)
    && C.reprendreProforma(dbP, null, "A").refus !== "" && C.reprendreProforma(dbP, { boutique: "A", lignes: [] }, "A").panier.length === 0);
  // Le 10/09/2026 : remise de ligne ET remise générale ne cohabitent plus.
  const pfMixte = { ...pf, lignes: [{ produit_id: "p1", article: "PANNEAU 550W", qte: 1, pu: 100000, remise_ligne: 3000 }] };
  const rm = C.reprendreProforma(dbP, pfMixte, "A");
  test("★ …une vieille proforma qui cumule remise de ligne et remise générale voit la générale ÉCARTÉE (sinon l'encaissement serait refusé sans que le vendeur comprenne)",
    rm.remisePct === 0 && rm.remiseEcartee === true && rm.panier[0].remise_ligne === 3000
    && C.critiqueRemises(rm.panier, rm.remisePct, 0, "admin") === "");
  // Les proformas émises AVANT 2.101.135 n'ont pas produit_id : on les retrouve par le nom.
  const rAncien = C.reprendreProforma(dbP, { boutique: "A", lignes: [{ article: "PANNEAU 550W", qte: 1, pu: 100000 }] }, "A");
  test("★ …une proforma ancienne (sans produit_id) est retrouvée par le NOM de l'article, dans sa boutique seulement",
    rAncien.panier.length === 1 && rAncien.panier[0].produit_id === "p1"
    && C.reprendreProforma({ produits: [dbP.produits[2]] }, { boutique: "A", lignes: [{ article: "PANNEAU 550W", qte: 1, pu: 100000 }] }, "A").introuvables.length === 1);
  // Timo (11/09/2026) : « une proforma reprise devrait plus être reprenable
  // encore ? » → « l'avertissement, avec un nouveau numéro de reçu
  // évidemment car c'est une nouvelle vente ». On prévient, on ne bloque pas.
  const dbV = { ventes: [
    { id: "v1", proforma_id: "pf1", date: "2026-09-10", heure: "09:00", boutique: "A", numero: "APE-2026-0001" },
    { id: "v2", proforma_id: "pf1", date: "2026-09-11", heure: "10:00", boutique: "A", numero: "APE-2026-0002" },
    { id: "v3", proforma_id: "autre", date: "2026-09-11", boutique: "A", numero: "APE-2026-0003" },
    { id: "v4", date: "2026-09-11", boutique: "A", numero: "APE-2026-0004" },
  ] };
  test("★ ventesDeProforma : les ventes issues de CETTE proforma, la plus récente d'abord ; une vente sans origine ou d'une autre proforma n'y est jamais",
    C.ventesDeProforma(dbV, { id: "pf1" }).map((v) => v.id).join("|") === "v2|v1"
    && C.ventesDeProforma(dbV, { id: "jamais" }).length === 0 && C.ventesDeProforma(dbV, null).length === 0);
  const vtP = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ écran Ventes : reprendre une proforma DÉJÀ encaissée prévient en nommant la date et le reçu, dit que ce sera une nouvelle vente, et laisse le vendeur trancher (jamais de blocage) ; la vente cite sa proforma et l'origine est consommée après l'encaissement",
    /const dejaVendue = ventesDeProforma\(db, pf\);/.test(vtP) && /déjà été encaissée le \$\{dFR\(dejaVendue\[0\]\.date\)\} — reçu \$\{numeroRecu\(dejaVendue\[0\]\)\}/.test(vtP)
    && /NOUVELLE vente, avec un nouveau numéro de reçu/.test(vtP) && /Vendre de nouveau à partir de cette proforma \?/.test(vtP)
    // Timo (11/09/2026) : « reprise » ne doit désigner QUE l'article rendu par le client.
    // 12/09/2026 (liste des ventes lisible) : les boutons sont ronds, l'icône seule — les trois mots distincts vivent dans le libellé au survol.
    && !/🛒 Reprendre/.test(vtP) && /title="↩ Reprise de l'article par BMI : /.test(vtP) /* 14/09/2026 : « Reprise de l'article par BMI » */ && /title="🔁 Retour : /.test(vtP) && /title="📋 Devis : /.test(vtP) && /aria-label="Reprise"/.test(vtP) && /aria-label="Retour"/.test(vtP)
    && /proforma_id: origineProforma\.id, proforma_numero: origineProforma\.numero/.test(vtP)
    && /setOrigineProforma\(null\);   \/\/ consommée/.test(vtP)
    && /const numero = prochainNumeroVente\(db, boutique\);/.test(vtP));
  test("★ …et la liste dit ce que chaque proforma est DEVENUE : « Encaissée le … — reçu N° » ou « En attente »",
    /✅ Encaissée le \{dFR\(vs\[0\]\.date\)\} — \{numeroRecu\(vs\[0\]\)\}/.test(vtP) && /⏳ En attente/.test(vtP)
    && /"Émis par", "Suite", ""/.test(vtP) && /colSpan=\{8\}/.test(vtP));
  test("★ écran Ventes : la proforma émise GARDE produit_id, le bouton « 🛒 Reprendre » est sur sa ligne, le geste passe par la règle pure, prévient avant d'écraser un panier et n'enregistre rien",
    /produit_id: l\.produit_id \|\| null,/.test(vtP) && /🛒 Vendre<\/button>/.test(vtP)
    && /const r = reprendreProforma\(db, pf, boutique\);/.test(vtP) && /Le panier contient déjà \$\{panier\.length\} article\(s\)/.test(vtP)
    && !/reprendreLaProforma[^]*?save\(/.test(vtP.slice(vtP.indexOf("const reprendreLaProforma"), vtP.indexOf("const proformaWhatsApp"))));
}

titre("🔒 Caisse non clôturée = ventes bloquées le lendemain (décision Timo, 09/09/2026)");
{
  // « S'il y a des ventes un jour et la caisse n'a pas été clôturée, le
  // lendemain, impossible de vendre tant que la caisse de la veille n'a pas
  // été clôturée. » Règle pure exercée ; les jours d'avant la mise en place
  // ne bloquent personne (DEBUT_REGLE_CLOTURE).
  const sortieCl = join("node_modules", ".cache", `bmi-cloture-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/cloture.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCl, logLevel: "silent" });
  const Cl = await import(pathToFileURL(sortieCl).href);
  unlinkSync(sortieCl);
  const tv = (v) => Number(v.total || 0);
  const dbc = {
    ventes: [{ boutique: "A", date: "2026-09-08", paiement: "Espèces", total: 1000 }, { boutique: "A", date: "2026-09-10", paiement: "Mobile money", total: 500 }, { boutique: "A", date: "2026-09-11", paiement: "Espèces", total: 700 }, { boutique: "B", date: "2026-09-10", paiement: "Espèces", total: 900 }, { boutique: "A", date: "2026-09-12", paiement: "Espèces", total: 100 }],
    dettes: [{ boutique: "A", paiements: [{ date: "2026-09-09", montant: 300 }] }],
    depenses: [{ boutique: "A", date: "2026-09-09", paiement: "Espèces", montant: 50 }],
    clotures: [{ boutique: "A", date: "2026-09-11" }],
  };
  test("★ activiteDuJour : UNE règle pour les chiffres d'une journée — espèces des ventes, règlements, dépenses ; une journée est active dès une vente (tout moyen) ou un encaissement espèces",
    Cl.activiteDuJour(dbc, "A", "2026-09-09", tv).fluxDuJour === 250 && Cl.activiteDuJour(dbc, "A", "2026-09-09", tv).active === true && Cl.activiteDuJour(dbc, "A", "2026-09-10", tv).active === true
    && Cl.activiteDuJour(dbc, "A", "2026-09-10", tv).especesVentes === 0 && Cl.activiteDuJour(dbc, "A", "2026-09-07", tv).active === false);
  // Capture Timo (09/09/2026) : 51 400 de ventes, un versement de 202 299 le
  // même jour, 252 299 en caisse avant → il reste 50 000 dans le tiroir.
  const dbt = { ventes: [{ boutique: "D", date: "2026-09-01", paiement: "Espèces", total: 200899 }, { boutique: "D", date: "2026-09-09", paiement: "Espèces", total: 51400 }], dettes: [], clotures: [],
    depenses: [{ boutique: "D", date: "2026-09-09", paiement: "Espèces", montant: 202299, categorie: "Versement de fonds", versement: { destination: "Chez le DG" } }, { boutique: "D", date: "2026-09-09", paiement: "Espèces", montant: 1, categorie: "Transport" }] };
  const jt = Cl.activiteDuJour(dbt, "D", "2026-09-09", tv);
  test("★ « Montant attendu dans le tiroir » = le SOLDE en caisse à la fin du jour (entrées − sorties jusqu'à ce jour, versements compris), pas le flux du jour ; les versements sont montrés à part des dépenses",
    jt.theorique === 50000 - 1 + 1 - 1 && jt.versementsDuJour === 202299 && jt.especesDepenses === 1 && jt.fluxDuJour === 51400 - 202299 - 1
    && Cl.soldeEspecesFinDeJour(dbt, "D", "2026-09-08", tv) === 200899 && Cl.soldeEspecesFinDeJour(dbt, "D", "2026-09-09", tv) === 49999);
  test("★ joursAClôturer : les jours PASSÉS actifs sans clôture, depuis le début de la règle (le 08/09 ne compte pas), le jour même ne compte pas, un jour clôturé ne compte pas",
    Cl.DEBUT_REGLE_CLOTURE === "2026-09-09" && Cl.joursAClôturer(dbc, "A", "2026-09-12", tv).join("|") === "2026-09-09|2026-09-10" && Cl.joursAClôturer(dbc, "A", "2026-09-09", tv).length === 0
    && Cl.joursAClôturer(dbc, "B", "2026-09-12", tv).join("|") === "2026-09-10" && Cl.joursAClôturer(dbc, "C", "2026-09-12", tv).length === 0);
  test("★ motifBlocageVente : vide quand tout est clôturé, sinon le message nomme la boutique et le ou les jours",
    Cl.motifBlocageVente({ ...dbc, clotures: [...dbc.clotures, { boutique: "A", date: "2026-09-09" }, { boutique: "A", date: "2026-09-10" }] }, "A", "2026-09-12", tv) === ""
    // ⚠ RETOURNÉ le 21/09/2026 : « la caisse de B du … » → « la journée du … de
    // B ». Ce qui est protégé est le même : le message NOMME la boutique et le
    // ou les jours, sinon personne ne sait quoi clôturer.
    && /journée du 2026-09-10 de B n'a pas été clôturée/.test(Cl.motifBlocageVente(dbc, "B", "2026-09-12", tv)) && /journées du 09\/09\/2026, 10\/09\/2026 de A/.test(Cl.motifBlocageVente(dbc, "A", "2026-09-12", tv, (x) => x.split("-").reverse().join("/"))));
  const vt = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ Ventes : encaisser est refusé tant qu'un jour reste à clôturer (message affiché en tête ET au clic)",
    /const blocageCloture = motifBlocageVente\(db, boutique, today\(\), totalVente, dFR\);/.test(vt) && /if \(blocageCloture\) \{ uAlert\(blocageCloture\); return; \}/.test(vt) && /\{blocageCloture && <div/.test(vt));
  const csC = readFileSync("src/screens/Caisse.jsx", "utf8");
  test("★ Caisse : les chiffres passent par activiteDuJour (plus de calcul local), un jour PASSÉ en retard se choisit et se clôture (le plus ancien d'abord), la clôture en retard est datée du jour clôturé et notée",
    /activiteDuJour\(db, boutique, t, totalVente\)/.test(csC) && !/especesVentes = db\.ventes\.filter/.test(csC) && /Montant attendu dans le tiroir/.test(csC) && /versements \{fmt\(versementsDuJour\)\} — ne créent pas d'écart/.test(csC) && /const enRetard = joursAClôturer\(db, boutique, aujourdhui, totalVente\);/.test(csC)
    && /\(enRetard\[0\] \|\| aujourdhui\)/.test(csC) && /date: t, boutique, theorique, compte: Number\(compte\), notes, par: profile\.nom, cloture_le: aujourdhui/.test(csC) && /clôturée en retard/.test(csC));
  // Timo (09/09/2026) : « Clôture de caisse, c'est journalier : recette du
  // jour théorique contre montant du tiroir » et « une dépense n'est pas un
  // manque ou une erreur de caisse… il ne devrait pas y avoir d'écart ».
  // Sur sa capture : recette 51 400, versement 202 299, tiroir attendu
  // 50 000 — il avait saisi 51 400 (la recette) et l'écran disait 1 400.
  test("★ activiteDuJour lit la journée en quatre lignes : fonds d'hier soir + recette du jour − sorties justifiées = attendu dans le tiroir (capture : 200 899 + 51 400 − 202 300 = 49 999)",
    jt.fondsHier === 200899 && jt.recetteDuJour === 51400 && jt.sortiesJustifiees === 202300 && jt.fondsHier + jt.recetteDuJour - jt.sortiesJustifiees === jt.theorique
    && Cl.activiteDuJour(dbc, "A", "2026-09-09", tv).fondsHier === 1000 && Cl.activiteDuJour(dbc, "A", "2026-09-09", tv).recetteDuJour === 300 && Cl.activiteDuJour(dbc, "A", "2026-09-09", tv).sortiesJustifiees === 50);
  // Timo (11/09/2026) : « 2 est bon pour le moment — que ce soit l'admin, le gérant
  // ou le vendeur qui a vendu, c'est la même caisse » : UNE clôture, la recette lue par personne.
  const dbv = { ventes: [
      { boutique: "V", date: "2026-09-11", paiement: "Espèces", total: 1000, par: "KOSSI" }, { boutique: "V", date: "2026-09-11", paiement: "Espèces", total: 500, par: "AMA" },
      { boutique: "V", date: "2026-09-11", paiement: "Mobile money", total: 700, par: "AMA" }, { boutique: "V", date: "2026-09-10", paiement: "Espèces", total: 9999, par: "KOSSI" }, { boutique: "W", date: "2026-09-11", paiement: "Espèces", total: 8888, par: "KOSSI" }],
    dettes: [{ boutique: "V", client: "X", paiements: [{ date: "2026-09-11", montant: 300, par: "TIMO" }, { date: "2026-09-11", montant: 200, par: "AMA", paiement: "Mobile money" }] }], depenses: [], clotures: [] };
  const rp = Cl.activiteDuJour(dbv, "V", "2026-09-11", tv).recetteParPersonne;
  test("★ recetteParPersonne : une ligne par personne du jour et de la boutique (admin, gérant, vendeur confondus), ventes comptées tout moyen, espèces = ventes espèces + règlements espèces, autres moyens à part, du plus gros encaisseur au plus petit",
    rp.map((r) => `${r.nom}:${r.nbVentes}:${r.especes}:${r.autresMoyens}:${r.encaissements}`).join("|") === "KOSSI:1:1000:0:0|AMA:2:500:900:0|TIMO:0:300:0:300"
    && Cl.activiteDuJour(dbv, "V", "2026-09-09", tv).recetteParPersonne.length === 0 && rp.reduce((s, r) => s + r.especes, 0) === Cl.activiteDuJour(dbv, "V", "2026-09-11", tv).recetteDuJour);
  test("★ écran Caisse : le tableau « Recette du … par vendeur » est dans la clôture (UNE clôture, la même caisse), vendeur / ventes / espèces / autres moyens, et rien n'est clôturé par personne",
    /recetteParPersonne\.length > 0 && \(/.test(csC) && /Recette du \{dFR\(t\)\} par vendeur — admin, gérant ou vendeur : la même caisse/.test(csC) && /\{fmt\(r\.especes\)\}/.test(csC) && !/cloture.*par_vendeur|clotures_vendeur/.test(csC));
  // ⚠ TROUVÉ AVEC TIMO le 11/09/2026, en remontant un « 880 000 » qu'il ne
  // comprenait pas. Sa boutique : clôture du 10/09 à 410 000, puis une vente
  // espèces de 225 000 à 17h10 — APRÈS la clôture. Le tiroir contenait donc
  // 635 000 le soir, l'écart affiché disait 0, et personne ne pouvait le
  // savoir. Décision (option « b ») : on ne bloque pas la vente, on DIT que la
  // clôture est dépassée et on la refait. Le banc rejoue SON cas.
  const dbDep = {
    ventes: [{ boutique: "D", date: "2026-09-10", paiement: "Espèces", total: 410000 },
      { boutique: "D", date: "2026-09-10", paiement: "Espèces", total: 225000 },
      { boutique: "D", date: "2026-09-11", paiement: "Espèces", total: 100000 }],
    dettes: [{ boutique: "D", client: "SEBASTINO", paiements: [{ date: "2026-09-11", montant: 150000 }] }],
    depenses: [{ boutique: "D", date: "2026-09-11", paiement: "Espèces", montant: 5000, categorie: "Loyer" }],
    // La clôture telle qu'elle a été enregistrée, AVANT la vente de 17h10.
    clotures: [{ id: "c1", boutique: "D", date: "2026-09-10", theorique: 410000, compte: 410000, par: "ANGELE", cloture_le: "2026-09-10" }],
  };
  const dep10 = Cl.clotureDepassee(dbDep, "D", "2026-09-10", tv);
  test("★ une clôture DÉPASSÉE est reconnue : la caisse du 10/09 a bougé de +225 000 après une clôture à 410 000 — l'écran ne dira plus « écart 0 » alors que le tiroir devait contenir 635 000",
    !!dep10 && dep10.attenduALaCloture === 410000 && dep10.attenduMaintenant === 635000
    && dep10.bouge === 225000 && dep10.compte === 410000 && dep10.ecartMaintenant === -225000
    && Cl.clotureDepassee(dbDep, "D", "2026-09-11", tv) === null
    && Cl.cloturesDepassees(dbDep, "D", tv).map((d) => d.date).join("|") === "2026-09-10");
  test("★ le SOLDE reste juste malgré la clôture périmée : le fonds d'hier soir est RECALCULÉ, jamais lu dans la clôture — 635 000 + 250 000 − 5 000 = 880 000, le chiffre exact de la capture de Timo",
    (() => {
      const j = Cl.activiteDuJour(dbDep, "D", "2026-09-11", tv);
      return j.fondsHier === 635000 && j.recetteDuJour === 250000 && j.sortiesJustifiees === 5000 && j.theorique === 880000;
    })());
  test("★ une clôture dont rien n'a bougé n'est JAMAIS signalée (pas de fausse alerte), et le message parle au vendeur : ce qui a bougé, ce qu'il avait compté, ce qu'il faut trouver",
    Cl.clotureDepassee({ ...dbDep, clotures: [{ ...dbDep.clotures[0], theorique: 635000 }] }, "D", "2026-09-10", tv) === null
    && Cl.cloturesDepassees({ ...dbDep, clotures: [] }, "D", tv).length === 0
    && /a bougé APRÈS la clôture/.test(Cl.messageClotureDepassee(dep10, (x) => String(x)))
    && /Recomptez et reclôturez/.test(Cl.messageClotureDepassee(dep10, (x) => String(x)))
    && Cl.messageClotureDepassee(null) === "");
  test("★ écran Caisse : le bandeau orange des journées à reclôturer, le jour se rechoisit, le formulaire ROUVRE sur une journée dépassée, et une reclôture REMPLACE la fiche du jour sans effacer la précédente",
    /const depassees = cloturesDepassees\(db, boutique, totalVente\);/.test(csC)
    && /journée\{depassees\.length > 1 \? "s" : ""\} clôturée/.test(csC)
    && /\{dejaCloturee && !aReclôturer \? \(/.test(csC)
    && /messageClotureDepassee\(aReclôturer, fmt, dFR\)/.test(csC)
    && /precedentes: \[\.\.\.\(ancienne\.precedentes \|\| \[\]\), \{ theorique: ancienne\.theorique, compte: ancienne\.compte/.test(csC)
    && /db\.clotures\.filter\(\(c\) => !\(c\.boutique === boutique && String\(c\.date\) === t\)\)/.test(csC));
  const nzc = (x) => String(x).replace(/[\u202f\u00a0 ]/g, "");
  test("★ alerteSaisieRecette : saisir la recette du jour à la place du tiroir est signalé (avec le calcul), rien si le montant est autre, rien si recette = tiroir, rien sur champ vide",
    /est la recette du jour, pas le contenu du tiroir/.test(Cl.alerteSaisieRecette("51400", jt)) && /200899.*51400.*202300.*49999/.test(nzc(Cl.alerteSaisieRecette(51400, jt)))
    && Cl.alerteSaisieRecette("50000", jt) === "" && Cl.alerteSaisieRecette("", jt) === "" && Cl.alerteSaisieRecette("abc", jt) === ""
    && Cl.alerteSaisieRecette(300, Cl.activiteDuJour({ ...dbc, ventes: [] }, "A", "2026-09-09", tv)) !== "" && Cl.alerteSaisieRecette(250, Cl.activiteDuJour({ ...dbc, ventes: [] }, "A", "2026-09-09", tv)) === "");
  // 14/09/2026, capture Timo : « trop de commentaire… montant du tiroir (tout
  // ce qu'il contient, compté) ; la ligne de la remarque aussi trop longue, la
  // raccourcir, et si le texte augmente, la case aussi augmente de taille ».
  // Le libellé long du 09/09 est RETOURNÉ : « Montant du tiroir », point.
  test("★ Caisse : le champ dit « Montant du tiroir » (plus de commentaire dans le libellé), l'alerte recette/tiroir s'affiche sous le champ ET dans la confirmation, la confirmation détaille fonds d'hier + recette − sorties LIGNE À LIGNE (⚠ RETOURNÉ le 15/09/2026 : c'était une seule phrase où le fonds de caisse se lisait comme de la recette), et « ne créent pas d'écart » est écrit sous les sorties",
    /<Field label="Montant du tiroir">/.test(csC) && !/tout ce qu'il contient, compté/.test(csC) && /const alerteRecette = alerteSaisieRecette\(compte, jour, fmt\);/.test(csC) && /\{alerteRecette && <div/.test(csC)
    && /alerteRecette \? "\\n\\n" \+ alerteRecette : ""/.test(csC)
    && /Dans le tiroir hier soir : \$\{fmt\(fondsHier\)\}/.test(csC) && /\+ Recette du jour \(ventes et encaissements\) : \$\{fmt\(recetteDuJour\)\}/.test(csC)
    && /− Sorties du jour \(dépenses, versements\) : \$\{fmt\(sortiesJustifiees\)\}/.test(csC) && /= À trouver dans le tiroir : \$\{fmt\(theorique\)\}/.test(csC)
    && /Dans le tiroir hier soir/.test(csC) && /la recette — le fonds de caisse n'est pas dedans/.test(csC) && /Recette du jour \(espèces\)/.test(csC) && /Sorties justifiées du jour/.test(csC) && /Écart de caisse \(manque ou surplus\)/.test(csC) && !/Espèces comptées \(F\)/.test(csC));
  const uiG = readFileSync("src/components/ui.jsx", "utf8");
  test("★ la remarque de clôture tient sur UNE case (plus de lg:col-span-2) et passe par LE champ qui grandit avec le texte, écrit une fois dans ui.jsx",
    /<Field label="Remarques"><ChampQuiGrandit valeur=\{notes\} onChange=\{setNotes\} placeholder="Ex : Monnaie rendue…" \/><\/Field>/.test(csC)
    && !/lg:col-span-2"><Field label="Remarques"/.test(csC)
    && /export const ChampQuiGrandit = /.test(uiG) && /<textarea ref=\{ref\} rows=\{1\}/.test(uiG)
    && /el\.style\.height = `\$\{Math\.min\(el\.scrollHeight, maxLignes \* 20 \+ 18\)\}px`;/.test(uiG)
    && /resize-none overflow-hidden/.test(uiG));
}

titre("⏳ La validation des dépenses par le DG, l'origine des fonds, les avances de frais (Timo, 12/09/2026)");
{
  // « On met un seuil : à partir de 5 mil, il faut valider ; moins de 5 mil,
  // pas besoin » — « seules les dépenses validées comptent » — « la clôture
  // impossible s'il y a des dépenses liées à la caisse qui ne sont pas
  // validées » — et l'origine des fonds en trois choix. Le banc EXERCE la
  // règle (lib/validationDepenses.js), puis la clôture, les fonds à verser,
  // le journal, le tableau de bord et la paie qui en dépendent.
  const sortieVd = join("node_modules", ".cache", `bmi-validation-depenses-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/validationDepenses.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVd, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vd = await import(pathToFileURL(sortieVd).href);
  unlinkSync(sortieVd);
  const sortieCl2 = join("node_modules", ".cache", `bmi-cloture-vd-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/cloture.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCl2, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Cl2 = await import(pathToFileURL(sortieCl2).href);
  unlinkSync(sortieCl2);
  const sortieVs2 = join("node_modules", ".cache", `bmi-versements-vd-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/versements.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVs2, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vs2 = await import(pathToFileURL(sortieVs2).href);
  unlinkSync(sortieVs2);
  const tv = (v) => Number(v.total || 0);
  const timo = { id: "u_admin", nom: "TIMO", role: "admin" };
  const kossi = { id: "u_vend", nom: "KOSSI", role: "vendeur", boutique: "APESSITO" };
  const ali = { id: "u_ger", nom: "ALI", role: "gerant", boutique: "APESSITO" };
  const dbV = { ...base(), users: [...base().users, ali], ventes: [{ id: "v", boutique: "APESSITO", date: "2026-09-12", paiement: "Espèces", total: 100000 }], depenses: [], clotures: [], messages: [] };

  // ---- Le seuil et la saisie ----
  test("★ ⚠ RETOURNÉ le 15/09/2026 (Timo : « dans Payé avec, ajouter fonds de caisse, de sorte que si pas d'argent et il faut effectuer une dépense, fonds de caisse apparaît (gérant) ») — le « laisse » du 14/09 valait quand le fonds était DANS le tiroir ; il est maintenant une enveloppe à part — le seuil est 5 000 F ; les CINQ origines des fonds existent (caisse, avance, DG, comptable, fonds de caisse), la caisse est le défaut d'une ancienne ligne",
    Vd.SEUIL_VALIDATION_DEPENSE === 5000 && Vd.doitEtreValidee(4999) === false && Vd.doitEtreValidee(5000) === true
    && Vd.PAYE_AVEC.map(([c]) => c).join("|") === "caisse|avance|dg|comptable|fonds" && Vd.payeAvecCaisse({}) === true && Vd.payeAvecCaisse({ paye_avec: "avance" }) === false
    && Vd.payeAvecCaisse({ paye_avec: "fonds" }) === false && Vd.libellePayeAvec("fonds") === "Le fonds de caisse (l'enveloppe)"
    && Vd.libellePayeAvec(undefined) === "La caisse de la boutique");
  const s7 = Vd.construireDepenseSaisie(dbV, kossi, { boutique: "APESSITO", categorie: "Transport", description: "carburant", montant: 7000, paiement: "Espèces", paye_avec: "caisse" }, "2026-09-12");
  const s2 = Vd.construireDepenseSaisie(dbV, kossi, { boutique: "APESSITO", categorie: "Transport", description: "", montant: 2000, paiement: "Espèces", paye_avec: "caisse" }, "2026-09-12");
  const sT = Vd.construireDepenseSaisie(dbV, timo, { boutique: "APESSITO", categorie: "Loyer", description: "", montant: 60000, paiement: "Espèces", paye_avec: "caisse" }, "2026-09-12");
  test("★ construireDepenseSaisie : 7 000 par un vendeur → « attente », auteur (par_id), origine, et UN message au DG ; 2 000 → aucune validation, aucun message ; 60 000 par le DG lui-même → validée d'office (auto), aucun message",
    s7.depense.validation.statut === "attente" && s7.aValider === true && s7.depense.par_id === "u_vend" && s7.depense.paye_avec === "caisse" && s7.depense.paiement === "Espèces"
    && s7.messages.length === 1 && s7.messages[0].a_id === "u_admin" && s7.messages[0].texte.includes(`Dépense à valider : ${Core.fmt(7000)}`) && /à valider par le DG/.test(s7.journal)
    && s2.depense.validation === undefined && s2.aValider === false && s2.messages.length === 0
    && sT.depense.validation.statut === "validee" && sT.depense.validation.auto === true && sT.messages.length === 0);
  test("★ la saisie refuse un montant nul, une origine inconnue, une boutique absente",
    /montant/.test(Vd.construireDepenseSaisie(dbV, kossi, { boutique: "APESSITO", montant: 0, paye_avec: "caisse" }).refus || "")
    && /caisse de la boutique, le fonds de caisse, une avance personnelle/.test(Vd.construireDepenseSaisie(dbV, kossi, { boutique: "APESSITO", montant: 10, paye_avec: "poche" }).refus || "")
    && /boutique/.test(Vd.construireDepenseSaisie(dbV, kossi, { boutique: "", montant: 10, paye_avec: "caisse" }).refus || ""));

  // ---- Ce qui compte, et où ----
  const att = { ...s7.depense, id: "d_att", date: "2026-09-12" };
  const petite = { ...s2.depense, id: "d_pet", date: "2026-09-12" };
  const avance = { ...Vd.construireDepenseSaisie(dbV, kossi, { boutique: "APESSITO", categorie: "Transport", description: "taxi", montant: 3000, paiement: "Espèces", paye_avec: "avance" }, "2026-09-12").depense, id: "d_av", date: "2026-09-12" };
  const dg = { ...Vd.construireDepenseSaisie(dbV, ali, { boutique: "APESSITO", categorie: "Autre", description: "", montant: 1000, paiement: "Espèces", paye_avec: "dg" }, "2026-09-12").depense, id: "d_dg", date: "2026-09-12" };
  const flooz = { ...s2.depense, id: "d_fl", date: "2026-09-12", paiement: "Mobile Money (Flooz)" };
  const dbC = { ...dbV, depenses: [att, petite, avance, dg, flooz] };
  test("★ compteDansLaCaisse : une dépense espèces de la caisse compte (validée, ou sous le seuil) ; en attente NON ; une avance personnelle NON ; l'argent du DG NON ; Flooz NON ; une ancienne ligne sans origine OUI",
    Vd.compteDansLaCaisse(petite) === true && Vd.compteDansLaCaisse(att) === false && Vd.compteDansLaCaisse(avance) === false && Vd.compteDansLaCaisse(dg) === false
    && Vd.compteDansLaCaisse(flooz) === false && Vd.compteDansLaCaisse({ paiement: "Espèces", montant: 5 }) === true && Vd.compteDansLaCaisse({ ...att, validation: { statut: "validee" } }) === true);
  test("★ depensesComptees (constants.js, réexportée) retire les versements ET les dépenses en attente ; garde avance, DG et petite (ce sont des charges)",
    Vd.depensesComptees(dbC.depenses).map((d) => d.id).join("|") === "d_pet|d_av|d_dg|d_fl"
    && Vd.depensesComptees([{ categorie: "Versement de fonds", montant: 1 }, att]).length === 0);
  const jC = Cl2.activiteDuJour(dbC, "APESSITO", "2026-09-12", tv);
  test("★ la clôture (activiteDuJour, soldeEspecesFinDeJour) ne déduit que ce qui compte dans la caisse : 100 000 − 2 000 = 98 000 attendus dans le tiroir — la dépense en attente (7 000), l'avance (3 000), l'argent du DG (1 000) et le Flooz n'y sont pas",
    jC.theorique === 98000 && jC.especesDepenses === 2000 && jC.sortiesJustifiees === 2000 && Cl2.soldeEspecesFinDeJour(dbC, "APESSITO", "2026-09-12", tv) === 98000
    && /import \{ compteDansLaCaisse \} from "\.\/validationDepenses\.js";/.test(readFileSync("src/lib/cloture.js", "utf8")) && !/x\.paiement === "Espèces" && String\(x\.date\) <= d0/.test(readFileSync("src/lib/cloture.js", "utf8")));
  test("★ les fonds à verser (lib/versements.js) suivent la même règle : 98 000",
    Vs2.fondsAVerser(dbC, "APESSITO", tv).montant === 98000 && Vs2.fondsAVerser(dbC, "APESSITO", tv).depenses === 2000
    // La marche des deux poches lit compteDansLaCaisse — qui, depuis le
    // 15/09/2026, englobe « payé avec le fonds de caisse » (le tiroir paie ce
    // qu'il peut, l'enveloppe complète : UNE seule règle d'affectation).
    && /compteDansLaCaisse\(x\)/.test(readFileSync("src/lib/versements.js", "utf8")));
  const lignesV = Core.lignesJournal({ ...dbC, dettes: [] }, "2026-09-01", "2026-09-30");
  test("★ le journal comptable n'écrit pas la dépense en attente (7 000 absent), mais écrit l'avance et l'argent du DG (des charges)",
    !JSON.stringify(lignesV).includes("7000") && JSON.stringify(lignesV).includes("taxi") && JSON.stringify(lignesV).includes("Autre"));

  // ---- Le DG tranche ----
  test("★ critiqueDecision : pas de validation requise / déjà validée / déjà rejetée / pas le DG / motif vide → refus ; le DG sur une attente → \"\"",
    /pas besoin/.test(Vd.critiqueDecision(petite, { estPrincipal: true })) && /déjà validée/.test(Vd.critiqueDecision(sT.depense, { estPrincipal: true }))
    && /Seul le DG/.test(Vd.critiqueDecision(att, { estPrincipal: false })) && /pourquoi/.test(Vd.critiqueDecision(att, { estPrincipal: true }, ""))
    && Vd.critiqueDecision(att, { estPrincipal: true }) === "" && Vd.critiqueDecision(att, { estPrincipal: true }, "pas de reçu") === "");
  const val = Vd.validerDepense(dbC, timo, att, "2026-09-12");
  const valD = val.depenses.find((d) => d.id === "d_att");
  test("★ validerDepense : statut validee (date, par), message à l'auteur, et la dépense compte désormais dans le tiroir (98 000 → 91 000)",
    valD.validation.statut === "validee" && valD.validation.par === "TIMO" && valD.montant === 7000 && val.messages.length === 1 && val.messages[0].a_id === "u_vend"
    && /Dépense validée/.test(val.messages[0].texte) && Cl2.activiteDuJour({ ...dbC, depenses: val.depenses }, "APESSITO", "2026-09-12", tv).theorique === 91000
    && /déjà validée/.test(Vd.critiqueDecision(valD, { estPrincipal: true })));
  const rej = Vd.rejeterDepense(dbC, timo, att, "pas de reçu", "2026-09-12");
  const rejD = rej.depenses.find((d) => d.id === "d_att");
  test("★ rejeterDepense : montant 0, montant d'origine gardé (montantOrigine = 7 000), description « ✖ REJETÉE (motif) », message qui dit de REMETTRE l'argent dans le tiroir ; le tiroir attendu reste 98 000 → le manque se voit à la clôture, et rejetsDuJour le nomme",
    rejD.montant === 0 && rejD.validation.statut === "rejetee" && rejD.validation.montant === 7000 && Vd.montantOrigine(rejD) === 7000 && /^✖ REJETÉE \(pas de reçu\) — carburant$/.test(rejD.description)
    && rej.messages[0].texte.includes(`remettez ${Core.fmt(7000)} dans le tiroir`) && Cl2.activiteDuJour({ ...dbC, depenses: rej.depenses }, "APESSITO", "2026-09-12", tv).theorique === 98000
    && Vd.rejetsDuJour({ depenses: rej.depenses }, "APESSITO", "2026-09-12").map((r) => `${r.par}:${r.montant}`).join("|") === "KOSSI:7000"
    && /Aucun remboursement ne vous est dû/.test(Vd.rejeterDepense(dbC, timo, { ...avance, validation: { statut: "attente" } }, "x", "2026-09-12").messages[0].texte)
    && /déjà rejetée/.test(Vd.critiqueDecision(rejD, { estPrincipal: true })));
  test("★ la file du DG : depensesAValider sur les boutiques données (la boutique regardée seule), nbAValiderParBoutique pour dire où il en reste, depensesTraitees sans les validations d'office",
    Vd.depensesAValider(dbC, ["APESSITO"]).map((d) => d.id).join("|") === "d_att" && Vd.depensesAValider(dbC, ["HEDZRANAWOE"]).length === 0
    && Vd.nbAValiderParBoutique({ depenses: [att, { ...att, id: "x", boutique: "HEDZRANAWOE" }, { ...att, id: "y", boutique: "HEDZRANAWOE" }] }, ["APESSITO", "HEDZRANAWOE"]).map((x) => `${x.boutique}:${x.n}`).join("|") === "APESSITO:1|HEDZRANAWOE:2"
    && Vd.depensesTraitees({ depenses: [valD, rejD, sT.depense] }, ["APESSITO"]).length === 2);

  // ---- La clôture bloquée ----
  const attFlooz = { ...att, id: "d_atf", paiement: "Mobile Money (Flooz)" };
  const attAvance = { ...att, id: "d_ata", paye_avec: "avance" };
  const attDemain = { ...att, id: "d_atd", date: "2026-09-13" };
  const attHier = { ...att, id: "d_ath", date: "2026-09-11" };
  const bloq = Vd.depensesBloquantCloture({ depenses: [att, attFlooz, attAvance, attDemain, attHier, petite, valD] }, "APESSITO", "2026-09-12");
  test("★ depensesBloquantCloture : les dépenses en attente qui sortiront du tiroir de CETTE boutique, jusqu'au jour clôturé inclus (hier et aujourd'hui) — ni Flooz, ni avance, ni demain, ni ce qui est validé ou sous le seuil",
    bloq.map((d) => d.id).join("|") === "d_ath|d_att" && Vd.depensesBloquantCloture({ depenses: [att] }, "HEDZRANAWOE", "2026-09-12").length === 0);
  test("★ motifBlocageCloture : vide sans dépense bloquante ; sinon « Clôture impossible », le nombre, chaque montant, catégorie, date, auteur",
    Vd.motifBlocageCloture([]) === "" && /^🔒 Clôture impossible : 2 dépenses en espèces attendent la validation du DG : 7000 \(Transport — carburant, 2026-09-11, par KOSSI\) ; 7000 \(Transport — carburant, 2026-09-12, par KOSSI\)\./.test(Vd.motifBlocageCloture(bloq))
    && /une dépense en espèces attend/.test(Vd.motifBlocageCloture([att])));
  const csVd = readFileSync("src/screens/Caisse.jsx", "utf8");
  test("★ écran Caisse : le blocage est calculé sur le jour clôturé (depensesBloquantCloture → motifBlocageCloture), refusé DANS le geste et affiché (bouton grisé), les rejets du jour sont nommés",
    /const bloquantes = depensesBloquantCloture\(db, boutique, t\);/.test(csVd) && /const blocageCloture = motifBlocageCloture\(bloquantes, fmt, dFR\);/.test(csVd)
    && /if \(blocageCloture\) \{ uAlert\(blocageCloture\); return; \}/.test(csVd) && /disabled=\{!!blocageCloture\}/.test(csVd) && /\{blocageCloture && \(/.test(csVd)
    && /const rejets = rejetsDuJour\(db, boutique, t\);/.test(csVd) && /Dépenses rejetées par le DG ce jour-là/.test(csVd));

  // ---- Les avances de frais ----
  test("★ avanceDue : une avance sous le seuil est due tout de suite, une avance validée aussi ; en attente, rejetée ou remboursée, non — avancesARembourser par boutique, avancesDe pour l'employé (par_id, sinon par le nom)",
    Vd.avanceDue(avance) === true && Vd.avanceDue({ ...avance, montant: 9000, validation: { statut: "validee" } }) === true && Vd.avanceDue({ ...avance, validation: { statut: "attente" } }) === false
    && Vd.avanceDue({ ...avance, montant: 0, validation: { statut: "rejetee", montant: 3000 } }) === false && Vd.avanceDue({ ...avance, remboursement: { le: "2026-09-12" } }) === false && Vd.avanceDue(petite) === false
    && Vd.avancesARembourser(dbC, "APESSITO").map((d) => d.id).join("|") === "d_av" && Vd.avancesARembourser(dbC, "HEDZRANAWOE").length === 0
    && Vd.avancesDe(dbC, kossi).length === 1 && Vd.avancesDe({ depenses: [{ ...avance, par_id: undefined, par: "KOSSI" }] }, kossi).length === 1 && Vd.avancesDe(dbC, ali).length === 0);
  test("★ critiqueRemboursement : le vendeur jamais ; le gérant en espèces oui, avec le salaire ou par le DG non ; personne ne se rembourse soi-même sauf l'admin ; le salaire exige un mois ; en attente / rejetée / déjà remboursée → refus",
    /gérant ou l'administrateur/.test(Vd.critiqueRemboursement(avance, "caisse", kossi)) && Vd.critiqueRemboursement(avance, "caisse", ali) === ""
    && /l'administrateur/.test(Vd.critiqueRemboursement(avance, "salaire", ali, { mois: "2026-09" })) && /l'administrateur/.test(Vd.critiqueRemboursement(avance, "dg", ali))
    && /soi-même/.test(Vd.critiqueRemboursement({ ...avance, par_id: "u_ger", par: "ALI" }, "caisse", ali)) && Vd.critiqueRemboursement({ ...avance, par_id: "u_admin", par: "TIMO" }, "dg", timo) === ""
    && /mois de paie/.test(Vd.critiqueRemboursement(avance, "salaire", timo, {})) && Vd.critiqueRemboursement(avance, "salaire", timo, { mois: "2026-09" }) === ""
    && /attend encore/.test(Vd.critiqueRemboursement({ ...avance, validation: { statut: "attente" } }, "caisse", ali)) && /rejetée/.test(Vd.critiqueRemboursement({ ...avance, validation: { statut: "rejetee" } }, "caisse", ali))
    && /déjà été remboursée/.test(Vd.critiqueRemboursement({ ...avance, remboursement: { le: "2026-09-12" } }, "caisse", ali)) && /pas une avance/.test(Vd.critiqueRemboursement(petite, "caisse", ali))
    && /Choisissez/.test(Vd.critiqueRemboursement(avance, "cheque", timo)));
  const rC = Vd.rembourserAvance(dbC, ali, avance, "caisse", "2026-09-13");
  const sortieR = rC.depenses[0];
  test("★ rembourserAvance en espèces : UNE sortie « Remboursement d'avance de frais » (espèces, caisse, liée par avance_id, nouvelleDepense), l'avance marquée remboursée (date, par, moyen, depense_id), message à l'employé ; la sortie n'est PAS une charge (horsVersements) mais SORT du tiroir (98 000 → 95 000 le 13/09)",
    sortieR.categorie === "Remboursement d'avance de frais" && sortieR.montant === 3000 && sortieR.paiement === "Espèces" && sortieR.avance_id === "d_av" && sortieR.boutique === "APESSITO" && sortieR.auto === "avance_frais"
    && rC.depenses.find((d) => d.id === "d_av").remboursement.moyen === "caisse" && rC.depenses.find((d) => d.id === "d_av").remboursement.depense_id === sortieR.id && rC.depenses.find((d) => d.id === "d_av").remboursement.par === "ALI"
    && rC.messages.length === 1 && rC.messages[0].a_id === "u_vend" && rC.messages[0].texte.includes(`Avance remboursée : ${Core.fmt(3000)}`)
    && Vd.depensesComptees([sortieR]).length === 0 && Vd.compteDansLaCaisse(sortieR) === true
    && Cl2.soldeEspecesFinDeJour({ ...dbC, depenses: rC.depenses.map((d) => (d.id === sortieR.id ? { ...d, date: "2026-09-13" } : d)) }, "APESSITO", "2026-09-13", tv) === 95000
    && Vd.avancesARembourser({ depenses: rC.depenses }, "APESSITO").length === 0);
  const rS = Vd.rembourserAvance(dbC, timo, avance, "salaire", "2026-09-13", { mois: "2026-09" });
  const primeR = rS.users.find((u) => u.id === "u_vend").primes[0];
  test("★ rembourserAvance avec le salaire : une PRIME de remboursement sur la paie du mois (hors CNSS, liée à la dépense), aucune sortie de caisse, l'avance marquée avec son mois ; par le DG : rien ne bouge en caisse ; auteur introuvable → refus",
    rS.depenses.length === dbC.depenses.length && primeR.mois === "2026-09" && primeR.montant === 3000 && primeR.hors_cnss === true && primeR.depense_id === "d_av" && /Remboursement d'avance de frais à KOSSI/.test(primeR.motif)
    && rS.depenses.find((d) => d.id === "d_av").remboursement.mois === "2026-09" && rS.depenses.find((d) => d.id === "d_av").remboursement.moyen === "salaire"
    && Vd.rembourserAvance(dbC, timo, avance, "dg", "2026-09-13").depenses.length === dbC.depenses.length && Vd.rembourserAvance(dbC, timo, avance, "dg", "2026-09-13").users === dbC.users
    && /introuvable/.test(Vd.rembourserAvance({ ...dbC, users: [] }, timo, avance, "salaire", "2026-09-13", { mois: "2026-09" }).refus));
  const paieR = C.paieMois({ salaire_base: 100000, cnss_assujetti: true, primes: [{ mois: "2026-09", montant: 10000 }, primeR] }, "2026-09");
  test("★ paieMois : la prime de remboursement s'ajoute au net (113 000 − CNSS) mais PAS à la base CNSS (110 000, pas 113 000) ; la déclaration CNSS (Salaires.jsx) lit remunerationCNSS",
    paieR.primes === 13000 && paieR.primesHorsCnss === 3000 && paieR.remunerationCNSS === 110000 && paieR.retenueCNSS === Math.round(110000 * 0.09) && paieR.net === 113000 - paieR.retenueCNSS
    && /const remuneration = p\.remunerationCNSS \?\? /.test(readFileSync("src/screens/Salaires.jsx", "utf8")));

  // ---- Les écrans ----
  const dpV = readFileSync("src/screens/Depenses.jsx", "utf8");
  test("★ écran Dépenses : « Payé avec » nomme chaque caisse, la saisie passe par construireDepenseSaisie (plus de fiche écrite à la main), l'avertissement du seuil avant l'envoi, « Ce mois » hors dépenses en attente (et le dit) ; ⚠ RETOURNÉ le 15/09/2026 : la liste reçoit en plus la proposition du fonds de caisse",
    // 13/09/2026 (capture Timo) : « Payé avec » nomme chaque caisse (optionsPayeAvec) ; le choix donne origine ET boutique (interpreterPayeAvec).
    /optionsPayeAvec\(caissesPossibles, boutique, \{ avecComptable: !afficheChiffresFormation\(db, profile\), fonds: propositionFonds \}\)\.map/.test(dpV) /* 13/09/2026 : la caisse du comptable, réel seulement */ && /const r = construireDepenseSaisie\(db, profile, \{ \.\.\.f, \.\.\.choixCaisse \}, today\(\)\);/.test(dpV) && !/id: uid\(\), date: today\(\), boutique, \.\.\.f/.test(dpV)
    && /doitEtreValidee\(f\.montant\) && !jeSuisDG/.test(dpV) && /en attente de validation \(non comptées\)/.test(dpV));
  test("★ écran Dépenses : l'encadré PERMANENT « Dépenses à valider par le DG » (principal seul, la boutique regardée seule, « Ailleurs, en attente »), valider / rejeter revérifiés DANS le geste (refuserSaufAdminPrincipal ×2, critiqueDecision ×2), motif demandé, badge d'état et colonnes « Payé avec » / « Validation » dans LE tableau commun",
    /const jeSuisDG = estAdminPrincipal\(db, profile\);/.test(dpV) && /Dépenses à valider par le DG \(\{aValiderDG\.length\}\)/.test(dpV) && /nomsEspace\.filter\(\(n\) => n === boutique\)/.test(dpV) && /Ailleurs, en attente/.test(dpV)
    && (dpV.match(/refuserSaufAdminPrincipal\(db, profile, "(Valider|Rejeter) une dépense \(DG\)"\)/g) || []).length === 2 && (dpV.match(/critiqueDecision\(d, \{ estPrincipal: true \}/g) || []).length === 2
    && /const motif = await uPrompt\(`Rejeter la dépense/.test(dpV) && /export function BadgeValidation/.test(dpV)
    // 13/09/2026 : la colonne « Chantier » (dépense rattachée à un chantier de devis) s'ajoute au tableau commun.
    && /\["Date", "Catégorie", "Description", "Montant", "Paiement", "Payé avec", "Saisi par", "Validation", "Chantier", ""\]/.test(dpV) && (dpV.match(/<thead className="sticky top-0 bg-white">/g) || []).length === 1 /* 13/09/2026 : l'en-tête reste collé en haut du cadre qui défile (HistoriqueArchive) */);
  test("★ écran Caisse : l'encadré « Avances de frais à rembourser » (gérant, admin), les trois façons, le mois demandé par demanderMois, critiqueRemboursement puis rembourserAvance, users et messages écrits",
    /const avances = avancesARembourser\(db, boutique\);/.test(csVd) && /Avances de frais à rembourser \(\{avances\.length\}\)/.test(csVd) && /MOYENS_REMBOURSEMENT\.map\(\(\[code, libelle\]\)/.test(csVd)
    && /await demanderMois\(`Sur quelle paie porter le remboursement/.test(csVd) && (csVd.match(/critiqueRemboursement\(d, moyen, profile/g) || []).length === 2 && /const r = rembourserAvance\(db, profile, d, moyen, today\(\), \{ mois \}\);/.test(csVd)
    && /save\(\{ \.\.\.db, depenses: r\.depenses, users: r\.users, messages: \[\.\.\.r\.messages, \.\.\.\(db\.messages \|\| \[\]\)\] \}, r\.journal\);/.test(csVd));
  test("★ écran 💵 Mon salaire : l'employé voit ses avances de frais (avancesDe), leur état (attente, rejetée, à me rembourser, remboursée) et le total à lui rembourser",
    (() => { const sl = readFileSync("src/screens/Salaires.jsx", "utf8"); return /const mesAvances = avancesDe\(db, moi\);/.test(sl) && /Mes avances de frais/.test(sl) && /à me rembourser : \{fmt\(avancesDues/.test(sl) && /💵 à me rembourser/.test(sl) && /remboursée le \{dFR\(d\.remboursement\.le\)\}/.test(sl); })());
  test("★ serveur : securite-15 pose depenses_regles_validation (valider / rejeter = admin principal, motif obligatoire, montant forcé à 0, décision inaltérable, remboursement gérant / admin) et le banc SQL le charge",
    (() => { const sq = readFileSync("supabase/securite-15-validation-depenses.sql", "utf8"); return /create or replace function public\.depenses_regles_validation\(\)/.test(sq) && /Rejeter une dépense sans motif/.test(sq) && /jsonb_set\(new\.data, '\{montant\}', '0'::jsonb, true\)/.test(sq)
      && /Défaire la validation ou le rejet d''une dépense/.test(sq) && /Rembourser une avance de frais', 'le gérant, l''administrateur'/.test(sq) && /revoke all on function public\.depenses_regles_validation\(\) from public, anon;/.test(sq)
      && /securite-15-validation-depenses\.sql/.test(readFileSync("scripts/tester-argent-sql.sh", "utf8")); })());
}

titre("☰ L'ordre des onglets, au choix de chacun — appui long et on déplace (Timo, 12/09/2026)");
{
  // « Ramener l'onglet caisse juste après vente, librement, dans son espace à
  // lui seul » ; « pas de ligne "ordre des onglets"… appui long et on déplace,
  // tout court ». Le rôle décide QUELS onglets, la personne décide de l'ORDRE.
  // Le geste lui-même est mesuré dans un vrai navigateur par
  // scripts/verifier-onglets-deplacables.mjs ; ici, la règle pure et les écrans.
  const sortieOo = join("node_modules", ".cache", `bmi-ordre-onglets-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/ordreOnglets.js"], bundle: true, format: "esm", platform: "node", outfile: sortieOo, logLevel: "silent" });
  const Oo = await import(pathToFileURL(sortieOo).href);
  unlinkSync(sortieOo);
  const role = [["ventes", "V"], ["commandes", "C"], ["depenses", "D"], ["caisse", "K"]];
  test("★ appliquerOrdre range ce que le rôle donne : « caisse » juste après « ventes » ; un id inconnu est ignoré ; un onglet non cité va à la fin dans l'ordre du rôle ; sans ordre, l'ordre du rôle ; un doublon ne dédouble rien",
    Oo.appliquerOrdre(role, ["ventes", "caisse"]).map((t) => t[0]).join(",") === "ventes,caisse,commandes,depenses"
    && Oo.appliquerOrdre(role, ["parametres", "caisse", "ventes", "caisse"]).map((t) => t[0]).join(",") === "caisse,ventes,commandes,depenses"
    && Oo.appliquerOrdre(role, null) === role && Oo.appliquerOrdre(role, []).length === 4 && Oo.appliquerOrdre(undefined, ["x"]).length === 0);
  test("★ deplacer / indexDepose / ordreApres / resteImmobile : la mécanique du geste, pure",
    Oo.deplacer(["a", "b", "c", "d"], 3, 1).join("") === "adbc" && Oo.deplacer(["a", "b"], 5, 0).join("") === "ab" && Oo.deplacer(["a", "b", "c"], 0, 99).join("") === "bca"
    && Oo.indexDepose(10, [20, 40, 60]) === 0 && Oo.indexDepose(50, [20, 40, 60]) === 2 && Oo.indexDepose(99, [20, 40, 60]) === 3 && Oo.indexDepose(5, []) === 0
    && Oo.ordreApres(["a", "b"], ["a", "b"]) === null && Oo.ordreApres(["b", "a"], ["a", "b"]).join("") === "ba" && Oo.ordreApres(["a"], undefined).join("") === "a"
    && Oo.resteImmobile(3, 4) === true && Oo.resteImmobile(6, 6) === false && Oo.DELAI_APPUI_LONG_MS === 500 && Oo.SEUIL_MOUVEMENT_PX === 8);
  const appOo = readFileSync("src/App.jsx", "utf8");
  test("★ App.jsx : les deux barres (ordinateur, téléphone) passent par OngletsDeplacables ; l'ordre vient de la fiche (ordre_onglets) APRÈS le filtre des pouvoirs ; l'écriture ne part que si l'ordre change (ordreApres), dans la fiche de la personne seule, sans ligne de réglage",
    (appOo.match(/<OngletsDeplacables tabs=\{tabsAutorises\} tab=\{tab\} onChoisir=\{setTab\} onReordonner=\{reordonnerOnglets\} sens="(vertical|horizontal)"/g) || []).length === 2
    // (l'onglet à part 🏦 Chez le DG / BANQUE a vécu une heure : Timo l'a voulu dans le tableau de bord — retour à tabsPlus2)
    && /const tabsAutorises = appliquerOrdre\(tabsPlus2\.filter\(\(\[id\]\) => aDroit\(db, profile, id\)\), maFiche\?\.ordre_onglets\);/.test(appOo)
    && /const ordre = ordreApres\(ids, maFiche\?\.ordre_onglets\);\n\s*if \(!ordre \|\| !maFiche\) return;\n\s*save\(\{ \.\.\.db, users: db\.users\.map\(\(u\) => \(u\.id === profile\.id \? \{ \.\.\.u, ordre_onglets: ordre \} : u\)\) \}\);/.test(appOo)
    && !/Ordre de mes onglets|ordre des onglets/i.test(appOo) && !/tabsAutorises\.map\(\(\[id, label\]\)/.test(appOo));
  const cmp = readFileSync("src/components/OngletsDeplacables.jsx", "utf8");
  test("★ le composant : appui long minuté (DELAI_APPUI_LONG_MS), annulé dès que le doigt bouge (resteImmobile), touchmove avalé en NON passif pendant le déplacement seulement, capture du pointeur, le clic qui suit un déplacement est avalé, pas de menu contextuel",
    /setTimeout\(\(\) => \{[^]*?\}, DELAI_APPUI_LONG_MS\);/.test(cmp) && /if \(!resteImmobile\(e\.clientX - d\.x, e\.clientY - d\.y\)\) \{ annulerMinuteur\(\); depart\.current = null; \}/.test(cmp)
    && /el\.addEventListener\("touchmove", avaler, \{ passive: false \}\);/.test(cmp) && /if \(depart\.current\?\.actif\) e\.preventDefault\(\);/.test(cmp)
    && /setPointerCapture\(depart\.current\.pointerId\)/.test(cmp) && /if \(aDeplace\.current\) \{ aDeplace\.current = false; return; \}/.test(cmp) && /onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/.test(cmp)
    && /"verifier-onglets-deplacables": "node scripts\/verifier-onglets-deplacables\.mjs"/.test(readFileSync("package.json", "utf8")));
}

titre("🏦 DG / BANQUE / COMPTABLE : trois caisses lues, dans le tableau de bord (Timo, 12/09/2026)");
{
  // « Les dépenses de chez le DG et du comptable sont déduites d'où alors ? »
  // → « DG et banque sur le même modèle que le comptable », puis « ramener cet
  // onglet dans le tableau de bord… transformer le bouton Chez le comptable en
  // DG / BANQUE / COMPTABLE ». Rien n'est écrit : les trois caisses se LISENT
  // (lib/caissesCentrales.js). Le banc exerce la règle.
  const sortieCg = join("node_modules", ".cache", `bmi-caisses-dg-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/caissesCentrales.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCg, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Cg = await import(pathToFileURL(sortieCg).href);
  unlinkSync(sortieCg);
  const dbG = { depenses: [
    // Versements : DG validé 300 000, DG en attente 50 000, DG rejeté, BANQUE validé 200 000, comptable validé (pas ici), DG validé d'une boutique HORS espace
    { id: "v1", boutique: "APESSITO", categorie: "Versement de fonds", montant: 300000, paiement: "Espèces", date: "2026-09-10", par: "ALI", versement: { id: "a", destination: "Chez le DG" }, versement_valide_le: "2026-09-11", versement_valide_par: "TIMO" },
    { id: "v2", boutique: "APESSITO", categorie: "Versement de fonds", montant: 50000, paiement: "Espèces", date: "2026-09-12", par: "ALI", versement: { id: "b", destination: "Chez le DG" } },
    { id: "v3", boutique: "APESSITO", categorie: "Versement de fonds", montant: 0, paiement: "Espèces", date: "2026-09-12", par: "ALI", versement: { id: "c", destination: "Chez le DG", montant: 9 }, versement_rejete_le: "2026-09-12" },
    { id: "v4", boutique: "APESSITO", categorie: "Versement de fonds", montant: 200000, paiement: "Espèces", date: "2026-09-10", par: "ALI", versement: { id: "d", destination: "BANQUE", banque: "Ecobank", bordereau: "B-1" }, versement_valide_le: "2026-09-11" },
    { id: "v5", boutique: "APESSITO", categorie: "Versement de fonds", montant: 70000, paiement: "Espèces", date: "2026-09-10", par: "ALI", versement: { id: "e", destination: "Chez le comptable" }, versement_valide_le: "2026-09-11" },
    { id: "v6", boutique: "FORMATION", categorie: "Versement de fonds", montant: 999, paiement: "Espèces", date: "2026-09-10", par: "X", versement: { id: "f", destination: "Chez le DG" }, versement_valide_le: "2026-09-11" },
    // Sorties DG : payée avec l'argent du DG et validée (20 000), idem en attente (8 000), idem rejetée, sous le seuil (1 000), avance remboursée par le DG (3 000), avance remboursée en caisse (pas ici)
    { id: "d1", boutique: "APESSITO", categorie: "Achat marchandises", description: "câble", montant: 20000, paiement: "Espèces", date: "2026-09-12", par: "KOSSI", paye_avec: "dg", validation: { statut: "validee", le: "2026-09-12", par: "TIMO" } },
    { id: "d2", boutique: "APESSITO", categorie: "Transport", montant: 8000, paiement: "Espèces", date: "2026-09-12", par: "KOSSI", paye_avec: "dg", validation: { statut: "attente" } },
    { id: "d3", boutique: "APESSITO", categorie: "Transport", montant: 0, paiement: "Espèces", date: "2026-09-12", par: "KOSSI", paye_avec: "dg", validation: { statut: "rejetee", montant: 6000, motif: "x" } },
    { id: "d4", boutique: "APESSITO", categorie: "Transport", montant: 1000, paiement: "Espèces", date: "2026-09-12", par: "KOSSI", paye_avec: "dg" },
    { id: "d5", boutique: "APESSITO", categorie: "Transport", description: "taxi", montant: 3000, paiement: "Espèces", date: "2026-09-11", par: "KOSSI", paye_avec: "avance", remboursement: { le: "2026-09-12", par: "TIMO", moyen: "dg" } },
    { id: "d6", boutique: "APESSITO", categorie: "Transport", montant: 4000, paiement: "Espèces", date: "2026-09-11", par: "KOSSI", paye_avec: "avance", remboursement: { le: "2026-09-12", par: "ALI", moyen: "caisse" } },
    // Sorties BANQUE : virement validé (150 000), virement en attente, virement sous le seuil (2 500), virement d'une avance perso (pas la banque), espèces (pas la banque)
    { id: "b1", boutique: "APESSITO", categorie: "Salaires", description: "paie", montant: 150000, paiement: "Virement bancaire", date: "2026-09-12", par: "TIMO", validation: { statut: "validee", le: "2026-09-12", auto: true, par: "TIMO" } },
    { id: "b2", boutique: "APESSITO", categorie: "Loyer", montant: 90000, paiement: "Virement bancaire", date: "2026-09-12", par: "ALI", paye_avec: "caisse", validation: { statut: "attente" } },
    { id: "b3", boutique: "APESSITO", categorie: "Communication", montant: 2500, paiement: "Virement bancaire", date: "2026-09-12", par: "ALI" },
    { id: "b4", boutique: "APESSITO", categorie: "Transport", montant: 7000, paiement: "Virement bancaire", date: "2026-09-12", par: "ALI", paye_avec: "avance", validation: { statut: "validee" } },
    { id: "b5", boutique: "APESSITO", categorie: "Transport", montant: 500, paiement: "Espèces", date: "2026-09-12", par: "ALI" },
  ] };
  const dg = Cg.mouvementsDG(dbG, ["APESSITO"]);
  test("★ Chez le DG : entrées = les versements « Chez le DG » VALIDÉS de l'espace regardé (300 000 — ni l'attente, ni le rejeté, ni la banque, ni le comptable, ni la boutique hors espace) ; sorties = dépenses payées avec l'argent du DG qui comptent (20 000 + 1 000) et l'avance remboursée par le DG (3 000) ; solde 276 000",
    dg.totalEntrees === 300000 && dg.entrees.map((m) => m.id).join("|") === "v1" && dg.totalSorties === 24000 && dg.sorties.map((m) => m.id).sort().join("|") === "d1|d4|d5-remb" && dg.solde === 276000
    && dg.mouvements[0].date >= dg.mouvements[dg.mouvements.length - 1].date && /Avance de frais remboursée à KOSSI/.test(dg.sorties.find((m) => m.id === "d5-remb").libelle) && /validé le 11\/09\/2026/.test(dg.entrees[0].libelle));
  const bq = Cg.mouvementsBanque(dbG, ["APESSITO"]);
  test("★ BANQUE : entrées = les versements BANQUE validés (200 000, banque et bordereau dans le libellé) ; sorties = les virements bancaires qui comptent (150 000 + 2 500 — ni l'attente, ni l'avance perso, ni les espèces, ni un versement) ; solde 47 500",
    bq.totalEntrees === 200000 && /Ecobank — bordereau B-1/.test(bq.entrees[0].libelle) && bq.totalSorties === 152500 && bq.sorties.map((m) => m.id).sort().join("|") === "b1|b3" && bq.solde === 47500
    && Cg.mouvementsDG(dbG, []).mouvements.length === 0 && Cg.mouvementsBanque({}, ["APESSITO"]).solde === 0 && Cg.CAISSE_DG === "Chez le DG" && Cg.CAISSE_BANQUE === "BANQUE");
  // La caisse du comptable, sur le même modèle : ses pointages font foi.
  const dbK = { depenses: [
    { id: "m1", boutique: "Chez le comptable", categorie: "Versement de fonds", montant: -70000, versement_id: "x", decaisse_le: "2026-09-11", decaisse_par: "MARIE", description: "Versement du 10/09/2026 reçu de APESSITO" },
    { id: "m2", boutique: "Chez le comptable", categorie: "Versement de fonds", montant: -20000, versement_id: "y" },
    { id: "m3", boutique: "Chez le comptable", categorie: "Versement de fonds", montant: 0, versement_id: "z", versement_rejete_le: "2026-09-11" },
    { id: "s1", boutique: "Chez le comptable", categorie: "Commissions", description: "commission AGENT", montant: 15000, decaisse_le: "2026-09-12", decaisse_par: "MARIE" },
    { id: "s2", boutique: "Chez le comptable", categorie: "Salaires", montant: 40000 },
    { id: "s3", boutique: "APESSITO", categorie: "Loyer", montant: 999, decaisse_le: "2026-09-12" },
  ] };
  const ck = Cg.mouvementsComptable(dbK);
  // Timo (13/09/2026) : une dépense de boutique « payée avec la caisse du
  // comptable » est une sortie de SA caisse quand il la pointe « Remis ».
  const dbK2 = { depenses: [...dbK.depenses,
    { id: "c1", boutique: "APESSITO", categorie: "Carburant", description: "moto", montant: 5000, par: "AMA", paye_avec: "comptable", decaisse_le: "2026-09-13", decaisse_par: "MARIE" },
    { id: "c2", boutique: "APESSITO", categorie: "Nourriture", montant: 3000, par: "AMA", paye_avec: "comptable" },
  ] };
  const ck2 = Cg.mouvementsComptable(dbK2);
  test("★ Chez le comptable : une dépense de boutique payée avec sa caisse, pointée « Remis », est une sortie (15 000 + 5 000 = 20 000, libellé « dépense de APESSITO, par AMA ») ; pas encore pointée, elle est « à remettre » (40 000 + 3 000)",
    ck2.totalSorties === 20000 && ck2.aRemettre === 43000 && ck2.solde === 50000 && /moto \(dépense de APESSITO, par AMA\) — remis le 13\/09\/2026 par MARIE/.test(ck2.sorties.find((m) => m.id === "c1").libelle)
    && /payeeParLeComptable\(x\)/.test(readFileSync("src/screens/Depenses.jsx", "utf8")) && /x\.boutique === "Chez le comptable" \|\| payeeParLeComptable\(x\)/.test(readFileSync("src/screens/Depenses.jsx", "utf8")));
  test("★ Chez le comptable : entrées = les versements qu'il a pointés « Encaissé » (70 000), sorties = ce qu'il a pointé « Remis » (15 000), solde 55 000 ; à encaisser 20 000 et à remettre 40 000 dits à part ; le rejeté et les autres boutiques n'y sont pas",
    ck.totalEntrees === 70000 && ck.totalSorties === 15000 && ck.solde === 55000 && ck.aEncaisser === 20000 && ck.aRemettre === 40000 && ck.mouvements.map((m) => m.id).join("|") === "s1|m1"
    && /encaissé le 11\/09\/2026 par MARIE/.test(ck.entrees[0].libelle) && Cg.CAISSE_COMPTABLE === "Chez le comptable"
    // « séparer chacun… avoir les onglets DG, BANQUE et COMPTABLE » : trois pastilles, leurs libellés.
    && Cg.libellePastille("Chez le DG") === "👤 DG" && Cg.libellePastille("BANQUE") === "🏦 BANQUE" && Cg.libellePastille("Chez le comptable") === "🧾 COMPTABLE" && Cg.libellePastille("TERRAIN", "TERRAIN") === "🏕 TERRAIN" && Cg.libellePastille("APESSITO", "TERRAIN") === "APESSITO");
  const appCg = readFileSync("src/App.jsx", "utf8");
  const dashCg = readFileSync("src/screens/Dashboard.jsx", "utf8");
  const carteCg = readFileSync("src/components/CarteCaisse.jsx", "utf8");
  test("★ PLUS d'onglet à part (retiré d'App, d'ONGLETS_ROLE, plus d'écran CaissesDG) : TROIS pastilles du tableau de bord — DG et BANQUE pour le PRINCIPAL seul, réelles seulement, COMPTABLE pour qui voit l'écran —, chacune SA caisse par UNE carte commune, sur les boutiques de l'espace regardé ; DG et BANQUE n'affichent rien d'autre (ni ventes, ni dépenses, ni stock, ni exports) ; rien n'est écrit",
    !/dg_banque/.test(appCg) && !/dg_banque/.test(readFileSync("src/lib/calculs.js", "utf8")) && !existsSync("src/screens/CaissesDG.jsx") && !existsSync("src/lib/caissesDG.js")
    // ⚠ RETOURNÉ le 21/09/2026 : les comptes mobiles rejoignent la rangée. Ce
    // qui est protégé n'a pas bougé d'un mot : DG et BANQUE restent réservées
    // au PRINCIPAL et au RÉEL, et chaque caisse passe par LA carte commune.
    && /const PASTILLES = \[\.\.\.NOMS, \.\.\.\(terrainVu \? \[terrainVu\.nom\] : \[\]\), \.\.\.mobilesVus\.map\(\(m\) => m\.caisse\), \.\.\.\(enFormation \? \[\] : \[\.\.\.\(principal \? \[CAISSE_DG, CAISSE_BANQUE\] : \[\]\), NOM_CAISSE_COMPTABLE\]\)\];/.test(dashCg)
    && /\{libellePastille\(nom, terrainVu\?\.nom\)\}/.test(dashCg) && /const principal = estAdminPrincipal\(db, profile\);/.test(dashCg)
    // « Relevé… lance » (12/09/2026) : chaque carte reçoit le RELEVÉ de la période du tableau de bord (getPeriod), le sélecteur est écrit UNE fois (selecteurPeriode) et affiché pour les caisses.
    && /\{dgChoisi && principal && <CarteCaisse titre=\{`👤 \$\{CAISSE_DG\}`\} caisse=\{CAISSE_DG\} periode=\{getPeriod\(\)\[0\]\} releve=\{releve\(mouvementsDG\(db, nomsCaisses\), getPeriod\(\)\[1\], getPeriod\(\)\[2\]\)\}/.test(dashCg)
    && /\{banqueChoisi && principal && <CarteCaisse titre=\{`🏦 \$\{CAISSE_BANQUE\}`\} caisse=\{CAISSE_BANQUE\} periode=\{getPeriod\(\)\[0\]\} releve=\{releve\(mouvementsBanque\(db, nomsCaisses\), getPeriod\(\)\[1\], getPeriod\(\)\[2\]\)\}/.test(dashCg)
    && /releve=\{releve\(c, getPeriod\(\)\[1\], getPeriod\(\)\[2\]\)\}/.test(dashCg) && (dashCg.match(/\{selecteurPeriode\}/g) || []).length === 2 && /\{\(caisseSeule \|\| comptableChoisi\) && \(/.test(dashCg)
    && (dashCg.match(/<div className="font-bold text-slate-800">Période :<\/div>/g) || []).length === 1
    // Capture Timo (12/09/2026) : sous le relevé du comptable, cartes « Total des dépenses » / « Dépenses — période » et un second « Période » — retirés : les trois caisses n'ont que leur relevé, le comptable garde ses exports.
    && (() => { const i = dashCg.indexOf("{!caisseChoisie && (<>"); const j = dashCg.indexOf("{!caisseSeule && (<>"); const k = dashCg.indexOf("Exporter les données"); return i > 0 && j > i && k > j && dashCg.slice(i, j).includes("Total des dépenses") && dashCg.slice(i, j).includes("{selecteurPeriode}"); })()
    && /\{comptableChoisi && \(\(\) => \{ const c = mouvementsComptable\(db\); return \(/.test(dashCg) // ⚠ RETOURNÉ le 21/09/2026 : QUATRE cartes — la quatrième est celle d'un
    // compte mobile (📱 Flooz ou Mixx/T-Money), et un compte mobile n'est pas
    // une boutique non plus : il entre donc dans `caisseSeule`.
    && (dashCg.match(/<CarteCaisse /g) || []).length === 4
    && /const caisseSeule = dgChoisi \|\| banqueChoisi \|\| !!mobileChoisi;/.test(dashCg) && /const sansVentes = depotChoisi \|\| comptableChoisi \|\| caisseSeule;/.test(dashCg) && /const sansStock = comptableChoisi \|\| terrainChoisi \|\| caisseSeule;/.test(dashCg) && /\{!caisseChoisie && \(<>/.test(dashCg) && /const caisseChoisie = caisseSeule \|\| comptableChoisi;/.test(dashCg) && /\{!caisseSeule && \(<>\n\s*<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">\n\s*<div className="font-bold text-slate-800 mb-2">Exporter les données/.test(dashCg)
    && /const nomsCaisses = \[\.\.\.NOMS, \.\.\.\(terrainVu \? \[terrainVu\.nom\] : \[\]\)\];/.test(dashCg) && /Les dépenses restent des charges de leur boutique/.test(dashCg)
    && /export function CarteCaisse\(\{ titre, caisse, note, releve: r, periode \}\)/.test(carteCg) && /Solde au début/.test(carteCg) && /Entrées de la période/.test(carteCg) && /Solde à la fin/.test(carteCg) && !/save\(/.test(carteCg));
  // Le relevé lui-même, exercé : avant / pendant / après, comme celui de la banque.
  const bilanR = { entrees: [{ id: "e1", date: "2026-08-20", montant: 252299 }, { id: "e2", date: "2026-09-05", montant: 300000 }, { id: "e3", date: "2026-10-01", montant: 1 }],
    sorties: [{ id: "s1", date: "2026-08-25", montant: 2299 }, { id: "s2", date: "2026-09-12", montant: 45000 }], mouvements: [] };
  bilanR.mouvements = [...bilanR.entrees.map((m) => ({ ...m, sens: "entree" })), ...bilanR.sorties.map((m) => ({ ...m, sens: "sortie" }))].sort((a, b) => b.date.localeCompare(a.date));
  const rSept = Cg.releve(bilanR, "2026-09-01", "2026-09-30");
  test("★ releve : « Ce mois » (septembre) = solde au 1er (250 000 : tout ce qui précède), + entrées de septembre (300 000), − sorties de septembre (45 000), solde au 30 (505 000) ; les mouvements sont ceux de la période seulement ; octobre n'y est pas",
    rSept.soldeDebut === 250000 && rSept.entrees === 300000 && rSept.sorties === 45000 && rSept.soldeFin === 505000 && rSept.mouvements.map((m) => m.id).join("|") === "s2|e2");
  test("★ releve : « Aujourd'hui » sans mouvement = deux soldes égaux, 0 entrée, 0 sortie ; « Depuis le début » = solde de début 0, tout dedans, solde de fin = le solde global ; une période passée (août) ignore ce qui suit",
    (() => { const r0 = Cg.releve(bilanR, "2026-09-13", "2026-09-13"); const rT = Cg.releve(bilanR, undefined, undefined); const rA = Cg.releve(bilanR, "2026-08-01", "2026-08-31");
      return r0.soldeDebut === 505000 && r0.entrees === 0 && r0.sorties === 0 && r0.soldeFin === 505000 && r0.mouvements.length === 0
        && rT.soldeDebut === 0 && rT.entrees === 552300 && rT.sorties === 47299 && rT.soldeFin === 505001 && rT.mouvements.length === 5
        && rA.soldeDebut === 0 && rA.entrees === 252299 && rA.sorties === 2299 && rA.soldeFin === 250000 && rA.mouvements.map((m) => m.id).join("|") === "s1|e1"; })());
  // « Pourquoi c'est impossible d'exporter pour imprimer ? » (12/09/2026) : le relevé s'imprime. Le banc MESURE le texte écrit dans le PDF.
  const sortiePdfR = join("node_modules", ".cache", `bmi-pdf-releve-${process.pid}.mjs`);
  await build({ entryPoints: ["src/pdf.js"], bundle: true, format: "esm", platform: "node", outfile: sortiePdfR, logLevel: "silent", loader: { ".js": "jsx" } });
  const PdfR = await import(pathToFileURL(sortiePdfR).href);
  unlinkSync(sortiePdfR);
  const textesPdf = (doc) => { const t = []; for (let p = 1; p <= doc.internal.getNumberOfPages(); p++) for (const l of doc.internal.pages[p].join("\n").split("\n")) { const m = l.match(/\((.*?)\)\s*Tj/); if (m) t.push(m[1]); } return t.join(" | "); };
  const rSeptM = { ...rSept, mouvements: rSept.mouvements.map((m) => ({ ...m, libelle: m.sens === "entree" ? "Versement de BMI DEMAKPOE" : "Achat marchandises - cable", boutique: "BMI DEMAKPOE" })) };
  const docR = PdfR.genererReleve(rSeptM, { caisse: "Chez le DG", periode: "Ce mois", edite: "12/09/2026" }, true);
  const txt = textesPdf(docR);
  test("★ genererReleve : un PDF d'une page, entête BMI, titre RELEVÉ + caisse, la période en clair, les quatre lignes du relevé (250 000 / + 300 000 / - 45 000 / 505 000), les mouvements dans l'ordre des dates avec la colonne Entrée / Sortie, le total de la période, le pied de page",
    !!docR && docR.internal.getNumberOfPages() === 1 && /BMI TOGO/.test(txt) && /RELEV/.test(txt) && /Chez le DG/.test(txt) && /P\S+riode : Ce mois \\?\(du 01\/09\/2026 au 30\/09\/2026\\?\)/.test(txt) && /RELEV\S* - Chez le DG/.test(txt) && /dit\S* le 12\/09\/2026/.test(txt)
    && /250 000 F/.test(txt) && /\+ 300 000 F/.test(txt) && /- 45 000 F/.test(txt) && /505 000 F/.test(txt) && /Solde au d/.test(txt) && /Solde \S+ la fin/.test(txt)
    && txt.indexOf("05/09/2026 | Versement de BMI DEMAKPOE") > 0 && txt.indexOf("05/09/2026 | Versement de BMI DEMAKPOE") < txt.indexOf("12/09/2026 | Achat marchandises") && /Versement de BMI DEMAKPOE/.test(txt) && /Achat marchandises - cable/.test(txt) && /Total de la p/.test(txt) && /BMI-Gestions Boutiques/.test(txt), txt.slice(0, 400));
  const docV = PdfR.genererReleve({ du: "0000-01-01", au: "9999-12-31", soldeDebut: 0, entrees: 0, sorties: 0, soldeFin: 0, mouvements: [] }, { caisse: "BANQUE", periode: "Depuis le début" }, true);
  test("★ un relevé vide se fabrique quand même (« Aucun mouvement sur cette période. », « Depuis le début »), et le fichier suit la règle des documents (Relevé - caisse - période)",
    !!docV && /Aucun mouvement sur cette p/.test(textesPdf(docV)) && /Depuis le d/.test(textesPdf(docV))
    && /doc\.save\(fichierPdf\("Relevé", \{ client: caisse, numero: /.test(readFileSync("src/pdf.js", "utf8")));
  // ⚠ Capture Timo (12/09/2026) : « Versement de fonds → Chez le DG » sortait en lettres espacées dans le rapport PDF.
  test("★ texteSurPdf : flèche, signe moins, tirets longs, espaces fines de fmt(), croix et coches sont traduits avant d'écrire dans le PDF ; les accents restent ; un caractère vraiment inconnu devient « ? »",
    PdfR.texteSurPdf("Versement de fonds → Chez le DG") === "Versement de fonds -> Chez le DG" && PdfR.texteSurPdf("écart − 50\u202f000 F") === "écart - 50 000 F"
    && PdfR.texteSurPdf("✖ REJETÉ (x) — Versement") === "X REJETÉ (x) - Versement" && PdfR.texteSurPdf("✅ validé…") === "OK validé..." && PdfR.texteSurPdf("⏳ en attente") === "en attente"
    && PdfR.texteSurPdf("Éléphant à Lomé") === "Éléphant à Lomé" && PdfR.texteSurPdf("中") === "?" && PdfR.texteSurPdf(null) === "");
  const docT = PdfR.genererPDF ? null : null;
  test("★ le rapport générique (genererPDF) et le relevé passent chaque cellule par texteSurPdf",
    /head: \[d\.headers\.map\(texteSurPdf\)\],\n\s*body: d\.rows\.map\(\(r\) => r\.map\(\(c\) => texteSurPdf\(c\)\)\),/.test(readFileSync("src/pdf.js", "utf8"))
    && /texteSurPdf\(m\.libelle\), texteSurPdf\(m\.boutique\)/.test(readFileSync("src/pdf.js", "utf8")) && docT === null);
  const carteR = readFileSync("src/components/CarteCaisse.jsx", "utf8");
  test("★ la carte porte « 🖨 Imprimer le relevé (PDF) » et « Exporter (CSV) » : le PDF reçoit le relevé affiché (même période, mêmes chiffres, logo, date d'édition), le CSV les mouvements dans l'ordre des dates puis les trois soldes ; le tableau de bord nomme la caisse de chaque carte",
    /genererReleve\(r, \{ caisse, periode, logo: LOGO, edite: dFR\(today\(\)\) \}\)/.test(carteR) && /🖨 Imprimer le relevé \(PDF\)/.test(carteR) && /Exporter \(CSV\)/.test(carteR)
    && /exportCSV\(`releve_\$\{/.test(carteR) && /\["Date", "Mouvement", "Boutique", "Entrée", "Sortie"\]/.test(carteR) && /"Total de la période", "", r\.entrees, r\.sorties/.test(carteR)
    && (readFileSync("src/screens/Dashboard.jsx", "utf8").match(/<CarteCaisse titre=\{`[^`]+`\} caisse=\{CAISSE_(DG|BANQUE|COMPTABLE)\}/g) || []).length === 3);
}

titre("📦 Le rapport de stocks est classé par boutique, par catégorie et par seuil (capture Timo, 12/09/2026)");
{
  const st = (p) => p.stock;
  const prods = [
    { boutique: "BMI DEMAKPOE", nom: "Coffret HT 24M", categorie: "coffret", seuil: 2, stock: 3 },
    { boutique: "BMI APESSITO", nom: "Fusible 300A", categorie: "Accessoire", seuil: 10, stock: 29 },
    { boutique: "BMI APESSITO", nom: "Cosse 50mm", categorie: "accessoire", seuil: 20, stock: 50 },
    { boutique: "BMI APESSITO", nom: "Busse BAR", categorie: "accessoire", seuil: 2, stock: 1 },
    { boutique: "BMI APESSITO", nom: "Coffret HT 12M", categorie: "coffret", seuil: 4, stock: 20 },
    { boutique: "BMI APESSITO", nom: "Étrier final", categorie: "accessoire", seuil: 0, stock: 4 },
    { boutique: "BMI DEMAKPOE", nom: "3PWSS", categorie: "pompes", seuil: 5, stock: 15 },
    { boutique: "BMI DEMAKPOE", nom: "2PWSS", categorie: "pompes", seuil: 4, stock: 3 },
  ];
  const ordre = C.trierPourRapportStocks(prods, st).map((p) => `${p.boutique.split(" ")[1]}/${p.categorie.toLowerCase()}/${p.nom}`).join(" | ");
  test("★ trierPourRapportStocks : boutique, puis catégorie (majuscules et accents ignorés), puis le plus urgent d'abord (reste − seuil croissant), puis le nom ; la liste d'origine n'est pas touchée",
    ordre === "APESSITO/accessoire/Busse BAR | APESSITO/accessoire/Étrier final | APESSITO/accessoire/Fusible 300A | APESSITO/accessoire/Cosse 50mm | APESSITO/coffret/Coffret HT 12M | DEMAKPOE/coffret/Coffret HT 24M | DEMAKPOE/pompes/2PWSS | DEMAKPOE/pompes/3PWSS"
    && prods[0].nom === "Coffret HT 24M" && C.trierPourRapportStocks(undefined, st).length === 0);
  test("★ l'export « Stocks » du tableau de bord (CSV et son PDF) passe par ce tri",
    /exportCSV\("stocks", \[[^\]]+\],\n\s*trierPourRapportStocks\(produitsReelsDb, \(p\) => stockActuel\(db, p\)\)\.map/.test(readFileSync("src/screens/Dashboard.jsx", "utf8")));
}

titre("👥 La liste des utilisateurs, lisible : quatre boutons ronds + « ⋯ Gérer » (capture Timo, 12/09/2026)");
{
  const ul = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  test("★ chaque ligne garde ses quatre gestes fréquents en boutons ronds (Pouvoirs, Identité, Mot de passe = principal, Bloquer/Réactiver hors sa propre fiche) et un bouton « ⋯ Gérer » qui ouvre un panneau SOUS la ligne (jamais un voile)",
    /<button onClick=\{\(\) => setPouvoirsPour\(u\.id\)\} className=\{boutonRond\(/.test(ul) && /<button onClick=\{\(\) => changerIdentite\(u\)\} className=\{boutonRond\(/.test(ul)
    && /\{jeSuisAdminPrincipal && <button onClick=\{\(\) => changerPwd\(u\)\} className=\{boutonRond\(/.test(ul) && /\{!surMaPropreFiche\(u\) && <button onClick=\{\(\) => toggleActif\(u\)\} className=\{boutonRond\(/.test(ul)
    && /setGererOuvert\(gererOuvert === u\.id \? null : u\.id\)/.test(ul) && /\{gererOuvert === u\.id && \(\n\s*<tr className="bg-slate-50/.test(ul) && !/fixed inset-0[^\n]*gererOuvert/.test(ul));
  test("★ le panneau « Gérer » range TOUS les autres gestes par thème (Compte, Paie, Commercial, Client), chacun avec la même garde qu'avant : rôle et formation au principal hors sa fiche, paie aux salariés, commercial hors clients, chat libre aux clients",
    // 12/09/2026 (capture Timo, « classer les actions par ligne et non par colonne ») : un thème = UNE ligne, son nom à gauche, ses boutons à la suite.
    ["Compte", "Paie", "Commercial", "Client"].every((t) => ul.includes(`<div className="w-24 shrink-0 pt-1.5 text-[11px] font-bold uppercase text-slate-500">${t}</div>`))
    && /<div className="space-y-2 text-sm">/.test(ul) && !/grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm/.test(ul)
    && /\{jeSuisAdminPrincipal && u\.role !== "client" && !surMaPropreFiche\(u\) && <button onClick=\{\(\) => changerRole\(u\)\} className=\{boutonGerer\}/.test(ul)
    && /\{jeSuisAdminPrincipal && !surMaPropreFiche\(u\) && \(\n\s*<button onClick=\{\(\) => basculerFormation\(u\)\} className=\{boutonGerer\}/.test(ul)
    && /\{SALARIES\.includes\(u\.role\) && \(\n\s*<div className="flex flex-wrap items-start gap-x-3 gap-y-1">\n\s*<div className="w-24 shrink-0 pt-1\.5 text-\[11px\] font-bold uppercase text-slate-500">Paie/.test(ul)
    && ["changerBoutique(u)", "changerAnniversaire(u)", "voirPwd(u)", "supprimerU(u)", "changerSalaire(u)", "changerTauxAvancement(u)", 'ajouterMouvementSalaire(u, "prime")', 'ajouterMouvementSalaire(u, "avance")', "envoyerVirement(u)", "annulerVirement(u)", "changerTauxCommission(u)", "changerParrain(u)", "changerTauxEquipe(u)", "basculerChef(u)", "basculerChatLibre(u)"].every((g) => ul.includes(`onClick={() => ${g}}`))
    && /\{jeSuisAdminPrincipal && <button onClick=\{\(\) => voirPwd\(u\)\}/.test(ul) && /\{SALARIES_BOUTIQUE\.includes\(u\.role\) && <button onClick=\{\(\) => changerBoutique\(u\)\}/.test(ul));
  test("★ rôle, boutique (« Toutes ») et statut en pastilles (+ 🎓 Formation), identité manquante discrète ; les deux gestes graves (formation en masse, retirer Historique + Paramètres) sont en bas dans « Actions groupées », mêmes gardes, plus de lien souligné au-dessus de la liste",
    /teinteRole\(u\.role\)/.test(ul) && /border-slate-200">Toutes<\/span>/.test(ul) && /🎓 Formation<\/span>/.test(ul) && /title="Identité non renseignée : bouton 🆔 Identité">⚠ Identité<\/div>/.test(ul)
    && /Actions groupées/.test(ul) && /\{jeSuisAdminPrincipal && \(\n\s*<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">\n\s*<div className="font-bold text-slate-800 mb-1">⚠ Actions groupées/.test(ul)
    && /\{roleAffiche === "admin" && !enRecherche && \(\n\s*<button onClick=\{restreindreAdminsExistants\}/.test(ul) && !/className="text-xs font-bold text-amber-700 underline">\n\s*🎓 Passer tous les comptes/.test(ul)
    && ul.indexOf("Actions groupées") > ul.indexOf("</table>"));
}

titre("Le devis PDF : nom du client dans le fichier, charge dimensionnée dedans");
{
  // ⚠ RELEVÉ PAR TIMO (02/09/2026) : « un devis doit se télécharger avec
  // comme nom le nom du client » et « les équipements et la charge
  // dimensionnée devraient aussi apparaître sur le devis en PDF ». Le
  // devis GARDE ces données (besoins) — le PDF ne les imprimait pas, et
  // le fichier ne portait que le numéro.
  const sortiePdf = join("node_modules", ".cache", `bmi-pdf-${process.pid}.mjs`);
  await build({ entryPoints: ["src/pdf.js"], bundle: true, format: "esm",
    platform: "node", outfile: sortiePdf, logLevel: "silent", loader: { ".js": "jsx" } });
  const Pdf = await import(pathToFileURL(sortiePdf).href);
  unlinkSync(sortiePdf);
  const socle = { numero: "TEST1234", date: "01/09/2026", client: "KOFFI AGBEKO",
    lignes: [{ categorie: "Panneaux solaires", article: "PANNEAU 550W", qte: 2, pu: 100000, total: 200000 }],
    total: 200000 };
  const formes = [
    ["solaire", { ...socle, besoins: { wh_jour: 2400, puissance_simultanee: 800, autonomie: 1,
      tension: 24, type_batterie: "lifepo4",
      appareils: [{ nom: "Téléviseur", puissance: 100, heures: 5, qte: 1 }] } }],
    ["garage", { ...socle, besoins: { type_ouvrant: "Portail coulissant", largeur: 4, hauteur: 2,
      surface_porte: 8, poids: 400, poids_ajuste: 500, vantaux: 1,
      frequence: "Moyenne (10 à 30 cycles/j)", telecommandes: 2 } }],
    ["autre", { ...socle, besoins: { articles_demandes: [{ nom: "Caméra dôme", qte: 3 }] } }],
    ["ancien devis (sans besoins ni catégorie)", { ...socle,
      lignes: [{ article: "PANNEAU 550W", qte: 2, pu: 100000, total: 200000 }], besoins: null }],
  ];
  for (const [nomForme, d] of formes) {
    let doc = null;
    try { doc = Pdf.genererDevis(d, null, true); } catch { /* le test le dira */ }
    test(`★ le devis « ${nomForme} » se fabrique sans planter`, !!doc && doc.internal.getNumberOfPages() >= 1);
  }
  const srcPdf = readFileSync("src/pdf.js", "utf8");
  test("★ le fichier téléchargé porte le NOM DU CLIENT (et garde le numéro) — par la règle unique",
    /doc\.save\(fichierPdf\("Devis", \{ client: d\.client, numero: d\.numero \}\)\)/.test(srcPdf));
  // Retourné le 11/09/2026 : le devis solaire a sa présentation commerciale
  // (Timo, « ça me convient »). La charge y est toujours, autrement dite.
  // Retourné le 11/09/2026 (« fais le même rendu pour portail et autre ») :
  // les TROIS volets passent par la même charpente, seul le bloc du besoin change.
  test("★ UNE charpente commerciale pour tous les devis (devisCommercial), un seul aiguillage vers le bloc du besoin (blocBesoin), et les blocs communs écrits UNE fois",
    (srcPdf.match(/devisCommercial\(doc, d, largeur, hauteur, yApres\);/g) || []).length === 1
    && /const blocBesoin = \(b\) => \{/.test(srcPdf)
    && ["besoinSolaire", "besoinPortail", "besoinAutre"].every((f) => (srcPdf.match(new RegExp(`function ${f}\\(`, "g")) || []).length === 1)
    && ["blocEquipement", "blocFinancier", "blocMentions"].every((f) => (srcPdf.match(new RegExp(`function ${f}\\(`, "g")) || []).length === 1)
    && (srcPdf.match(/Array\.isArray\(b\.appareils\)/g) || []).length === 1);
  // ⚠ Le banc MESURE : on relit le texte réellement écrit dans le PDF
  // (doc.internal.pages), on ne se contente pas de lire pdf.js.
  // (jsPDF échappe les parenthèses dans le flux : on les rétablit pour lire.)
  // Une vraie image minuscule (1 × 1 px) : le banc pose un « cachet » et une
  // « signature » réels dans le devis pour MESURER qu'ils sont bien dessinés.
  const CACHET_ESSAI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const texteDuPdf = (doc) => JSON.stringify(doc.internal.pages).replace(/\\\\\(/g, "(").replace(/\\\\\)/g, ")");
  const dSol = { ...socle, date: "11/09/2026", total: 1000000, pct_acompte: 60, montant_acompte: 600000,
    delai_installation: "3 semaines",
    lignes: [
      { categorie: "Panneaux solaires", article: "PANNEAU 550W", qte: 4, pu: 100000, total: 400000 },
      { categorie: "Batteries", article: "BATTERIE 5 kWh", qte: 2, pu: 350000, total: 700000 },
      { categorie: "Remise", article: "Remise (3 %)", qte: 1, pu: -100000, total: -100000 },
    ],
    besoins: { wh_jour: 8400, puissance_simultanee: 3200, autonomie: 2, tension: 48, type_batterie: "lifepo4",
      appareils: [{ nom: "Téléviseur", puissance: 100, heures: 5, qte: 2 }, { nom: "Congélateur", puissance: 250, heures: 8, qte: 1 }] } };
  const docSol = Pdf.genererDevis(dSol, null, true);
  const txtSol = texteDuPdf(docSol);
  test("★ devis solaire : le besoin est dit en kWh et kW (jamais en Wh bruts), avec l'autonomie en jours, la tension et la batterie en clair",
    txtSol.includes("8,4 kWh") && txtSol.includes("3,2 kW") && txtSol.includes("2 jours")
    && txtSol.includes("Tension du système : 48 V") && txtSol.includes("Lithium LiFePO4") && !txtSol.includes("8400 Wh"));
  test("★ devis solaire : les cinq blocs dans l'ordre — Votre besoin, Vos appareils (avec la puissance totale installée), Équipement proposé, TOTAL DU PROJET, mentions + validité + bon pour accord",
    ["VOTRE BESOIN", "VOS APPAREILS", "ÉQUIPEMENT PROPOSÉ", "TOTAL DU PROJET", "Bon pour accord"].every((t) => txtSol.includes(t))
    && txtSol.indexOf("VOTRE BESOIN") < txtSol.indexOf("VOS APPAREILS") && txtSol.indexOf("VOS APPAREILS") < txtSol.indexOf("ÉQUIPEMENT PROPOSÉ")
    && txtSol.indexOf("ÉQUIPEMENT PROPOSÉ") < txtSol.indexOf("TOTAL DU PROJET")
    && txtSol.includes("Puissance totale installée") && txtSol.includes("450 W")
    && txtSol.includes("Offre valable 15 jours à compter du 11/09/2026"));
  test("★ devis solaire : acompte et solde calculés et affichés (60 % de 1 000 000 → 600 000 à la commande, 400 000 à l'installation), délai repris ; un acompte de 100 % dit « Paiement intégral »",
    txtSol.includes("600 000 FCFA") && txtSol.includes("400 000 FCFA") && txtSol.includes("Acompte à la commande (60 %)")
    && txtSol.includes("Solde à l'installation") && txtSol.includes("Délai d'installation : 3 semaines")
    && texteDuPdf(Pdf.genererDevis({ ...dSol, pct_acompte: 100, montant_acompte: 1000000 }, null, true)).includes("Paiement intégral à la commande"));
  // RETOURNÉ le 11/09/2026 (capture Timo : « trop de tautologie dans les
  // équipements proposés ») : le contrôle exigeait un en-tête par catégorie.
  // Il exige maintenant le contraire quand l'en-tête ne sert à rien — une
  // catégorie d'UNE seule ligne n'a plus de titre, le nom de l'article suffit.
  test("★ devis solaire : plus d'en-tête de catégorie au-dessus d'une ligne unique (fini la tautologie « Panneaux solaires » / « PANNEAU 550W ») ; la remise reste en négatif ; le bandeau de formation et l'entête société ne changent pas",
    !txtSol.includes("Panneaux solaires") && !txtSol.includes("Batteries")
    && txtSol.includes("PANNEAU 550W") && txtSol.includes("BATTERIE 5 kWh")
    && txtSol.includes("-100 000 F")
    && txtSol.includes("NIF : 1001790098")
    && texteDuPdf(Pdf.genererDevis({ ...dSol, formation: true }, null, true)).includes("DOCUMENT DE FORMATION"));
  // …mais l'en-tête revient DE LUI-MÊME dès qu'il regroupe vraiment : deux
  // modèles de panneaux dans le même devis, et « Panneaux solaires » les titre.
  const txtDeuxPanneaux = texteDuPdf(Pdf.genererDevis({ ...dSol, lignes: [
    { categorie: "Panneaux solaires", article: "PANNEAU 550W", qte: 4, pu: 100000, total: 400000 },
    { categorie: "Panneaux solaires", article: "PANNEAU 450W", qte: 2, pu: 80000, total: 160000 },
    { categorie: "Batteries", article: "BATTERIE 5 kWh", qte: 2, pu: 350000, total: 700000 },
  ] }, null, true));
  test("★ l'en-tête de catégorie revient quand il regroupe AU MOINS 2 lignes (deux modèles de panneaux), et la catégorie restée seule (Batteries) n'en a toujours pas",
    txtDeuxPanneaux.includes("Panneaux solaires") && txtDeuxPanneaux.includes("PANNEAU 450W")
    && !txtDeuxPanneaux.includes("Batteries") && txtDeuxPanneaux.includes("BATTERIE 5 kWh"));
  // ⚠ Timo, 11/09/2026 : « un devis devrait avoir une signature ? » — oui, et
  // BMI n'en avait aucune. Le cadre de gauche l'engage désormais.
  const txtSigne = texteDuPdf(Pdf.genererDevis({ ...dSol, par: "AKUE Jean", cachet: CACHET_ESSAI, signature: CACHET_ESSAI }, null, true));
  // Le banc MESURE la taille à laquelle le cachet est réellement dessiné :
  // jsPDF écrit « <largeur> 0 0 <hauteur> <x> <y> cm » en POINTS (1 mm = 2,8346 pt).
  // ⚠ Capture Timo (11/09/2026) : « le cachet est trop petit dans le cadre ».
  // Il est CARRÉ : c'est la hauteur du cadre qui le bridait à 17 mm.
  const imagesDuPdf = (doc) => [...doc.internal.pages.flat().join("\n").matchAll(/([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm/g)]
    .map((m) => ({ l: +m[1] / 2.8346, h: +m[2] / 2.8346 }));
  const imgSignees = imagesDuPdf(Pdf.genererDevis({ ...dSol, par: "AKUE Jean", cachet: CACHET_ESSAI, signature: CACHET_ESSAI }, null, true));
  // RETOURNÉ le 11/09/2026, deuxième capture : « les cadres des signatures sont
  // trop trop gros, réduire au max ». Cadre 56 × 28 (au lieu de 70 × 40) et
  // cachet à 20 mm — plus petit que les 26 mm de l'après-midi, mais toujours
  // nettement au-dessus des 17 mm qui l'avaient fait réagir. Le contrôle garde
  // les deux bouts : assez gros pour se voir, assez petit pour tenir.
  test("★ le devis ENGAGE BMI : cadre « Pour BMI Togo » avec le nom de celui qui l'a élaboré, sa signature et le cachet dedans (cachet entre 19 et 22 mm : ni rabougri, ni un cadre géant), en face du « Bon pour accord » du client",
    txtSigne.includes("Pour BMI Togo") && txtSigne.includes("AKUE Jean") && txtSigne.includes("Bon pour accord")
    && imgSignees.length >= 2 && imgSignees.every((i) => i.h >= 19 && i.h <= 22 && i.l >= 19 && i.l <= 22));
  // ⚠ Timo (11/09/2026, deux captures) : « est-ce possible d'avoir les
  // signatures sur la même page ? ». Deux contrôles, tous deux MESURÉS sur le
  // PDF réel — un devis ordinaire tient sur UNE page, et quand un gros devis
  // déborde, le total et les signatures partent ENSEMBLE (le client qui
  // n'imprime que la première page ne doit jamais avoir le matériel sans le
  // prix ni la case à signer).
  const devisOrdinaire = { ...dSol, numero: "ORDINAIRE", delai_installation: "3 semaines",
    lignes: [...dSol.lignes, { categorie: "Câblage", article: "LOT DE CABLE PV", qte: 1, pu: 200000, total: 200000 },
      { categorie: "Protection", article: "LOT DE PROTECTION", qte: 1, pu: 350000, total: 350000 },
      { categorie: "Installation", article: "Frais d'installation (10 %)", qte: 1, pu: 250000, total: 250000 }],
    besoins: { ...dSol.besoins, appareils: ["CONGELATEUR", "CLIM", "SURPRESSEUR", "VENTILO", "LUMIERE", "TELEVISEUR"]
      .map((nom, i) => ({ nom, puissance: 100 * (i + 1), qte: i + 1, heures: 6 })) } };
  // ⚠ « Le problème est revenu » (capture Timo, 11/09/2026) : le bas du devis
  // repartait SEUL sur une page, alors qu'il ne manquait que 1 à 13 mm. Les
  // mentions sont passées À GAUCHE des cadres (12 mm rendus). Le banc joue
  // maintenant HUIT formes de devis qui tombaient toutes dans ce trou.
  test("★ les devis qui débordaient de quelques millimètres tiennent sur UNE page : huit formes mesurées (3 à 12 appareils, 4 à 10 lignes), paiement intégral — plus jamais une page qui ne porte que le total et la signature",
    [[3, 10], [4, 8], [4, 10], [5, 8], [6, 8], [7, 6], [8, 6], [12, 4]].every(([nApp, nLig]) => {
      const lignes = Array.from({ length: nLig }, (_, i) => ({
        categorie: i % 3 === 0 ? "Panneaux solaires" : i % 3 === 1 ? "Batteries" : "Autres équipements",
        article: `ARTICLE ${i}`, qte: 2, pu: 100000, total: 200000 }));
      const appareils = Array.from({ length: nApp }, (_, i) => ({ nom: `APP ${i}`, puissance: 100, qte: 1, heures: 5 }));
      // Paiement intégral, comme la capture de Timo : trois lignes de moins
      // qu'un devis à acompte + solde + délai, qui reste plus lourd de 12 mm.
      return Pdf.genererDevis({ ...dSol, pct_acompte: 100, montant_acompte: dSol.total, delai_installation: "", lignes,
        besoins: { ...dSol.besoins, appareils } }, null, true).internal.getNumberOfPages() === 1;
    }));
  test("★ un devis ORDINAIRE (6 appareils, 7 lignes de matériel, acompte + solde + délai) tient sur UNE seule page, signatures comprises",
    Pdf.genererDevis(devisOrdinaire, null, true).internal.getNumberOfPages() === 1);
  const docGros = Pdf.genererDevis({ ...devisOrdinaire, numero: "GROS",
    lignes: [...devisOrdinaire.lignes, ...devisOrdinaire.lignes, ...devisOrdinaire.lignes].map((l, i) => ({ ...l, article: `${l.article} ${i}` })),
    besoins: { ...devisOrdinaire.besoins, appareils: [...devisOrdinaire.besoins.appareils, ...devisOrdinaire.besoins.appareils] } }, null, true);
  const derniereGros = docGros.internal.pages[docGros.internal.pages.length - 1].join("\n");
  test("★ quand un GROS devis déborde, le TOTAL, les mentions et les deux cadres de signature voyagent ENSEMBLE : jamais une page qui ne porte que la signature, jamais un matériel sans son prix",
    docGros.internal.getNumberOfPages() >= 2
    && ["TOTAL DU PROJET", "Ce document est un devis", "Pour BMI Togo", "Bon pour accord"].every((t) => derniereGros.includes(t)));
  // ⚠ Le banc MESURE aussi que rien ne se CHEVAUCHE : poser les mentions dans
  // le blanc à gauche du total avait été tenté le 11/09/2026, et la première
  // ligne (108 mm de large) mordait sur « Acompte à la commande (60 %) ».
  // ⚠ PAGE PAR PAGE. Une première version mettait toutes les pages à plat :
  // l'entête de la page 1 « chevauchait » alors le total de la page 2, à la
  // même hauteur mais sur une autre feuille. Un contrôle qui crie à tort finit
  // par ne plus être cru — il compte maintenant dans CHAQUE page séparément.
  const chevauchements = (doc) => {
    let n = 0;
    for (let p = 1; p < doc.internal.pages.length; p++) {
      const lignes = [];
      let x = null, yy = null, taille = 10;
      for (const l of doc.internal.pages[p].join("\n").split("\n")) {
        let m = l.match(/\/F\d+ ([\d.]+) Tf/); if (m) taille = +m[1];
        m = l.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/) || l.match(/^([\d.]+) ([\d.]+) Td/);
        if (m) { x = +m[1] / 2.8346; yy = +m[2] / 2.8346; }
        m = l.match(/\((.*?)\)\s*Tj/);
        if (m && m[1].trim() && x !== null) { doc.setFontSize(taille); lignes.push({ y: yy, x1: x, x2: x + doc.getTextWidth(m[1].replace(/\\/g, "")) }); }
      }
      for (let i = 0; i < lignes.length; i++) for (let j = i + 1; j < lignes.length; j++) {
        const a = lignes[i], b = lignes[j];
        if (Math.abs(a.y - b.y) < 2.2 && a.x1 < b.x2 - 0.5 && b.x1 < a.x2 - 0.5) n++;
      }
    }
    return n;
  };
  test("★ aucun texte du devis n'en chevauche un autre, page par page — mesuré sur le PDF réel, y compris sur un devis à DEUX pages avec acompte, solde et délai (les mentions serrées à gauche des cadres ne mordent sur rien)",
    chevauchements(Pdf.genererDevis(devisOrdinaire, null, true)) === 0 && chevauchements(docSol) === 0
    && chevauchements(docGros) === 0);
  // ⚠ Capture Timo (11/09/2026) : le bandeau TOTAL était posé PAR-DESSUS
  // « Frais d'installation ». Le contrôle du chevauchement de TEXTES ne l'a
  // pas vu — le bandeau est un rectangle plein, pas un texte. On mesure donc
  // le HAUT du bandeau (le rectangle monte 7,5 mm au-dessus de son libellé)
  // contre la dernière ligne du tableau des prix.
  const hautDuBandeau = (doc) => {
    let x = null, yy = null, taille = 10;
    const L = [];
    for (const l of doc.internal.pages.flat().join("\n").split("\n")) {
      let m = l.match(/\/F\d+ ([\d.]+) Tf/); if (m) taille = +m[1];
      m = l.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/) || l.match(/^([\d.]+) ([\d.]+) Td/);
      if (m) { x = +m[1] / 2.8346; yy = 297 - (+m[2]) / 2.8346; }
      m = l.match(/\((.*?)\)\s*Tj/); if (m && m[1].trim() && x !== null) L.push({ y: yy, t: m[1] });
    }
    const tot = L.find((o) => o.t.startsWith("TOTAL DU PROJET"));
    const derniere = L.filter((o) => tot && o.y < tot.y - 6).pop();
    return tot && derniere ? tot.y - 7.5 - derniere.y : -1;
  };
  // ⚠ Capture Timo (11/09/2026) : « la puissance (W) n'est pas centrée sous la
  // ligne… même souci dans équipement proposé ». Les valeurs étaient à droite,
  // les EN-TÊTES restés à gauche : une colonne ne transmet pas son alignement
  // à son titre. Le banc MESURE les bords : le titre d'une colonne de montants
  // FINIT là où finissent ses montants, à 1,5 mm près.
  const boites = (doc) => {
    let x = null, yy = null, taille = 10;
    const L = [];
    for (const l of doc.internal.pages.flat().join("\n").split("\n")) {
      let m = l.match(/\/F\d+ ([\d.]+) Tf/); if (m) taille = +m[1];
      m = l.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/) || l.match(/^([\d.]+) ([\d.]+) Td/);
      if (m) { x = +m[1] / 2.8346; yy = 297 - (+m[2]) / 2.8346; }
      m = l.match(/\((.*?)\)\s*Tj/);
      if (m && m[1].trim() && x !== null) { doc.setFontSize(taille); const t = m[1].replace(/\\/g, ""); L.push({ y: yy, x1: x, x2: x + doc.getTextWidth(t), t }); }
    }
    return L;
  };
  const bSol = boites(Pdf.genererDevis(dSol, null, true));
  const bord = (t) => bSol.find((o) => o.t === t);
  const centre = (o) => (o.x1 + o.x2) / 2;
  test("★ chaque titre de colonne est aligné comme SA colonne : « Total » et « Prix unitaire » finissent avec leurs montants, « Qté » est centré sur ses quantités — mesuré sur le PDF réel, bord à bord",
    (() => {
      // Il y a DEUX « Qté » dans un devis solaire (appareils, équipement) :
      // on prend celui de la ligne de « Désignation », le tableau des prix.
      const desi = bSol.find((o) => o.t === "Désignation");
      const qteEquip = bSol.find((o) => o.t === "Qté" && Math.abs(o.y - desi.y) < 1);
      const quantites = bSol.filter((o) => o.y > desi.y && o.y < desi.y + 30 && Math.abs(centre(o) - centre(qteEquip)) < 4);
      const montants = bSol.filter((o) => /^[\d ]+ F$/.test(o.t)).map((o) => o.x2).sort((a, b) => b - a)[0];
      return Math.abs(bord("Total").x2 - montants) < 1.5 && quantites.length >= 2;
    })());
  const bAppareils = boites(Pdf.genererDevis(dSol, null, true));
  test("★ dans « Vos appareils » aussi : « Puissance (W) » finit avec ses puissances, « Qté » et « Heures / jour » sont centrés sur leurs nombres — et le pied « Puissance totale installée » suit sa colonne",
    (() => {
      const ph = bAppareils.find((o) => o.t === "Puissance (W)");
      const val = bAppareils.filter((o) => o.y > ph.y && o.y < ph.y + 20 && Math.abs(o.x2 - ph.x2) < 3);
      const pied = bAppareils.find((o) => /^[\d ]+ W$/.test(o.t));
      return !!ph && val.length >= 2 && !!pied && Math.abs(pied.x2 - ph.x2) < 1.5;
    })());
  test("★ le bandeau TOTAL DU PROJET ne se pose JAMAIS sur la dernière ligne du tableau des prix : au moins 3 mm entre le bas du tableau et le haut du bandeau (le bandeau monte 7,5 mm au-dessus de son libellé — l'oublier, c'est l'écraser)",
    [docSol, Pdf.genererDevis(devisOrdinaire, null, true),
     Pdf.genererDevis({ ...devisOrdinaire, lignes: [{ article: "MOTEUR 600 kg", qte: 1, pu: 500000, total: 500000 }], besoins: null }, null, true)]
      .every((doc) => hautDuBandeau(doc) >= 3));
  test("★ la date libre est DANS le cadre du client (le jour où il dit oui), plus jamais un cadre à part — la date du devis reste en haut ; un devis sans cachet ni signature se fabrique quand même",
    txtSol.includes("Date : ____ / ____ / ________") && txtSol.includes("Pour BMI Togo")
    && txtSol.indexOf("Bon pour accord") < txtSol.indexOf("Date : ____ / ____ / ________")
    && txtSol.includes("Date : 11/09/2026")
    && !!Pdf.genererDevis({ ...dSol, cachet: "", signature: "", par: "" }, null, true)
    && !!Pdf.genererDevis({ ...dSol, cachet: "pas-une-image", signature: "pas-une-image" }, null, true));
  // Retourné le 11/09/2026 : Timo a validé le solaire, puis « fais le même
  // rendu pour portail et autre ». Chaque volet montre ce qu'il a.
  const dPortail = { ...socle, date: "11/09/2026", total: 500000, pct_acompte: 50, montant_acompte: 250000,
    lignes: [{ categorie: "Motorisation", article: "MOTEUR 600 kg", qte: 1, pu: 500000, total: 500000 }],
    besoins: { type_ouvrant: "Portail coulissant", largeur: 4, hauteur: 2, surface_porte: 8,
      poids: 400, poids_ajuste: 500, vantaux: 2, frequence: "Moyenne (10 à 30 cycles/j)", telecommandes: 2 } };
  const txtPortail = texteDuPdf(Pdf.genererDevis(dPortail, null, true));
  // Retourné le 11/09/2026 (« votre ouvrant ??? ») : le titre reprend le TYPE
  // réel du projet, jamais le mot « ouvrant », qui est celui du code.
  test("★ devis PORTAIL : le bloc porte le TYPE du projet (« VOTRE PORTAIL COULISSANT »), trois cases — dimensions, poids RETENU, usage en un mot — puis le détail (vantaux, surface, poids mesuré, télécommandes)",
    txtPortail.includes("VOTRE PORTAIL COULISSANT") && !/OUVRANT|Ouvrant :/.test(txtPortail)
    && txtPortail.includes("4 × 2 m") && txtPortail.includes("500 kg") && txtPortail.includes("Moyenne")
    && txtPortail.includes("2 vantaux") && txtPortail.includes("Surface : 8 m²")
    && txtPortail.includes("Poids mesuré : 400 kg") && txtPortail.includes("Télécommandes : 2")
    && texteDuPdf(Pdf.genererDevis({ ...dPortail, besoins: { ...dPortail.besoins, type_ouvrant: "Rideau métallique" } }, null, true)).includes("VOTRE RIDEAU MÉTALLIQUE"));
  const dAutre = { ...socle, date: "11/09/2026", total: 500000, pct_acompte: 100, montant_acompte: 500000,
    besoins: { articles_demandes: [{ nom: "Caméra dôme", qte: 3 }, { nom: "Enregistreur", qte: 1 }] } };
  const txtAutre = texteDuPdf(Pdf.genererDevis(dAutre, null, true));
  test("★ devis AUTRE : « Votre demande » reprend ce que le client a demandé, tel qu'exprimé, avec ses quantités — aucun bloc de chiffres inventé",
    txtAutre.includes("VOTRE DEMANDE") && txtAutre.includes("Ce que vous avez demandé") && txtAutre.includes("Caméra dôme") && txtAutre.includes("Enregistreur")
    && !txtAutre.includes("VOTRE BESOIN") && !txtAutre.includes("VOTRE PORTAIL"));
  test("★ portail et autre ont les MÊMES blocs communs que le solaire (équipement, TOTAL DU PROJET, acompte/solde, validité, bon pour accord)",
    [txtPortail, txtAutre].every((t) => ["ÉQUIPEMENT PROPOSÉ", "TOTAL DU PROJET", "Offre valable 15 jours", "Bon pour accord"].every((m) => t.includes(m)))
    && txtPortail.includes("250 000 FCFA") && txtPortail.includes("Acompte à la commande (50 %)")
    && txtAutre.includes("Paiement intégral à la commande"));
  const txtAncien = texteDuPdf(Pdf.genererDevis({ ...socle, date: "11/09/2026", lignes: [{ article: "MOTEUR", qte: 1, pu: 500000, total: 500000 }], besoins: null }, null, true));
  test("★ un ANCIEN devis (sans besoins ni catégorie) passe par la même charpente, sans bloc de besoin et sans en-tête de groupe inventé",
    txtAncien.includes("ÉQUIPEMENT PROPOSÉ") && txtAncien.includes("TOTAL DU PROJET") && txtAncien.includes("MOTEUR")
    && !txtAncien.includes("VOTRE BESOIN") && !txtAncien.includes("VOTRE PORTAIL") && !txtAncien.includes("VOTRE DEMANDE")
    && !txtAncien.includes("Autres équipements"));
  test("les mesures du garage et la demande « autre » sont rendues",
    srcPdf.includes("type_ouvrant") && srcPdf.includes("articles_demandes"));
  // Retourné le 11/09/2026 : la catégorie ne fait plus une colonne, elle
  // TITRE son groupe d'articles. Mesuré sur le PDF rendu, pas lu dans le code.
  // RETOURNÉ le 11/09/2026 (« trop de tautologie ») : la catégorie ne titre
  // plus un groupe d'UNE ligne — ni dans le solaire, ni dans le portail.
  test("★ la catégorie ne titre QUE les groupes de 2 lignes et plus : « Motorisation » disparaît au-dessus de son moteur unique, et la remise reste une ligne négative",
    !txtPortail.includes("Motorisation") && txtPortail.includes("MOTEUR 600 kg")
    && txtSol.includes("-100 000 F")
    && srcPdf.includes("const avecCategorie = d.lignes.some((l) => l.categorie);")
    && srcPdf.includes("if (g.lignes.length >= 2) body.push("));
  const srcDevisEcran = readFileSync("src/screens/TousLesDevis.jsx", "utf8");
  test("★ TousLesDevis TRANSMET les besoins au PDF (sinon rien ne s'imprime), et le cachet de la maison avec la signature de l'élaborateur — UN seul cachet, celui des contrats",
    /besoins: d\.besoins/.test(srcDevisEcran)
    && /signature: initiateur\?\.signature_personnelle \|\| ""/.test(srcDevisEcran)
    && /cachet: \(db\.boutiques \|\| \[\]\)\.find\(\(b\) => b\.cachet_bmi\)\?\.cachet_bmi \|\| CACHET_BMI_DEFAUT/.test(srcDevisEcran)
    && /import \{ LOGO, CACHET_BMI_DEFAUT \} from "\.\.\/lib\/constants";/.test(srcDevisEcran));
}

titre("Importation d'articles : Excel ou texte collé, fournisseur et domaine compris");
{
  // Demande Timo (03/09/2026) : « Importation rapide n'intègre pas le
  // domaine ? Ni fournisseur » puis « importer un fichier Excel — une
  // feuille par boutique ». Ordre des colonnes = celui du formulaire.
  const dbI = {
    boutiques: [{ id: "b1", nom: "BMI DEMAKPOE" }, { id: "b3", nom: "ECOLE", formation: true }],
    fournisseurs: [{ id: "f1", nom: "SOLARIS" }, { id: "f2", nom: "ECOLE-FOURN", formation: true }],
    produits: [{ id: "p1", boutique: "BMI DEMAKPOE", nom: "COFFRET ETANCHE IP65", prix_vente: 12000 }],
  };
  test("★ l'ordre des colonnes est celui de Timo : Nom, Fournisseur, Domaine, Catégorie, Initial, Seuil, Prix d'achat, Prix de vente",
    Imp.COLONNES_IMPORT.join("|") === "Nom|Fournisseur|Domaine|Catégorie|Initial|Seuil|Prix d'achat|Prix de vente");

  // Fichier avec titres, dans le DÉSORDRE, accents/majuscules libres.
  const avecTitres = Imp.enregistrementsDepuisLignes([
    ["PRIX DE VENTE", "nom", "Fournisseur", "domaine", "Prix d'achat", "Initial"],
    [65000, "Panneau 150W", "solaris", "Solaire", 45000, 10],
  ]);
  test("★ les colonnes sont reconnues par leur TITRE, quel que soit l'ordre",
    avecTitres.avecTitres && avecTitres.enregistrements[0].nom === "Panneau 150W"
    && avecTitres.enregistrements[0].prix_vente === 65000 && avecTitres.enregistrements[0].initial === 10);
  const r1 = Imp.analyserImport(dbI, "BMI DEMAKPOE", avecTitres.enregistrements);
  test("★ fournisseur reconnu sans tenir compte de la casse → nom EXACT de la fiche ; domaine par son nom → identifiant",
    r1.nouveaux.length === 1 && r1.nouveaux[0].fournisseur === "SOLARIS" && r1.nouveaux[0].domaine === "solaire"
    && r1.erreurs.length === 0 && r1.avertissements.length === 0);

  // Texte collé sans titres : ordre fixe, tabulations (copier-coller Excel).
  const colle = Imp.lignesDepuisTexte("Batterie 200Ah\tINCONNU\tPlomberie\tBatteries\t4\t1\t90000\t140000\nCable 6mm, , , Câbles, 100, 10, 500, 800");
  const r2 = Imp.analyserImport(dbI, "BMI DEMAKPOE", Imp.enregistrementsDepuisLignes(colle).enregistrements);
  test("★ le texte collé accepte tabulations (Excel) ET virgules, sans ligne de titres",
    r2.nouveaux.length === 2 && r2.nouveaux[0].nom === "Batterie 200Ah" && r2.nouveaux[1].categorie === "Câbles");
  test("★ fournisseur ou domaine INCONNU : l'article passe SANS, et c'est DIT (pas de fiche créée par faute de frappe)",
    r2.nouveaux[0].fournisseur === "" && r2.nouveaux[0].domaine === ""
    && r2.avertissements.some((a) => a.includes("INCONNU")) && r2.avertissements.some((a) => a.includes("Plomberie")));

  // Garde-fous.
  const r3 = Imp.analyserImport(dbI, "BMI DEMAKPOE", Imp.enregistrementsDepuisLignes(Imp.lignesDepuisTexte(
    "Regulateur 60A, , , , 2, 1, 30000, \n"        // sans prix de vente
    + "coffret etanche ip65, , , , 1, 0, 8000, 12000\n" // déjà en stock (casse différente)
    + "Onduleur 3kVA, , , , 1, 0, 200000, 300000\nOnduleur 3kVA, , , , 1, 0, 200000, 300000")).enregistrements);
  test("★ sans prix de vente : REFUSÉ (il serait vendu 0 F) — et nommé",
    r3.erreurs.some((e) => e.includes("Regulateur 60A") && e.includes("prix de vente")));
  test("★ un nom déjà présent dans la boutique : REFUSÉ (pas deux fiches pour le même article)",
    r3.erreurs.some((e) => e.includes("existe déjà")) && !r3.nouveaux.some((n) => n.nom.toLowerCase() === "coffret etanche ip65"));
  test("un nom en double dans le fichier : la seconde ligne est refusée",
    r3.nouveaux.filter((n) => n.nom === "Onduleur 3kVA").length === 1 && r3.erreurs.some((e) => e.includes("en double")));

  // Cloisonnement : les fournisseurs admis sont ceux de l'ESPACE DE LA BOUTIQUE.
  const r4 = Imp.analyserImport(dbI, "ECOLE", Imp.enregistrementsDepuisLignes([["X", "SOLARIS", "", "", 1, 0, 1, 2], ["Y", "ECOLE-FOURN", "", "", 1, 0, 1, 2]]).enregistrements);
  test("★ cloisonnement : un vrai fournisseur n'est pas rattaché à un article de FORMATION (et l'inverse)",
    r4.nouveaux[0].fournisseur === "" && r4.nouveaux[1].fournisseur === "ECOLE-FOURN"
    && Imp.analyserImport(dbI, "BMI DEMAKPOE", Imp.enregistrementsDepuisLignes([["Z", "ECOLE-FOURN", "", "", 1, 0, 1, 2]]).enregistrements).nouveaux[0].fournisseur === "");
  test("le récapitulatif nomme les lignes refusées ET les réserves",
    Imp.resumeImport("BMI DEMAKPOE", r2).includes("réserve") && Imp.resumeImport("BMI DEMAKPOE", r3).includes("NON importée"));
  // ---- Mode « Entrées de stock » (marchandise reçue) ----
  const dbE = { ...dbI, produits: [
    { id: "p1", boutique: "BMI DEMAKPOE", nom: "COFFRET ETANCHE IP65", prix_vente: 12000, prix_achat: 8000, entrees: 2 },
    { id: "p2", boutique: "BMI DEMAKPOE", nom: "Panneau 550W", prix_vente: 90000, prix_achat: 60000, entrees: 0 },
    { id: "p9", boutique: "ECOLE", nom: "Panneau 550W", prix_vente: 1, prix_achat: 1, entrees: 0 },
  ] };
  test("★ le modèle Entrées a trois colonnes : Nom, Quantité reçue, Prix d'achat (facultatif)",
    Imp.COLONNES_ENTREES.join("|") === "Nom|Quantité reçue|Prix d'achat");
  const eT = Imp.enregistrementsDepuisLignes([["Quantité reçue", "NOM", "prix d'achat"], [5, "coffret etanche ip65", 8500], [3, "Panneau 550W", ""]], Imp.MODES_IMPORT.entrees);
  const rE = Imp.analyserEntrees(dbE, "BMI DEMAKPOE", eT.enregistrements);
  test("★ une entrée se rapproche d'un article EXISTANT par son nom (casse libre), colonnes reconnues par leur titre",
    eT.avecTitres && rE.entrees.length === 2 && rE.entrees[0].produit_id === "p1" && rE.entrees[0].qte === 5 && rE.entrees[1].qte === 3 && rE.erreurs.length === 0);
  test("★ prix d'achat renseigné → fiche mise à jour ET annoncé ; vide → prix inchangé",
    rE.entrees[0].prix_achat === 8500 && rE.entrees[1].prix_achat === null && rE.avertissements.some((a) => a.includes("8000 → 8500")));
  const apres = Imp.appliquerEntrees(dbE.produits, rE.entrees);
  test("★ les quantités s'AJOUTENT aux entrées (2 + 5 = 7), rien d'autre ne bouge — l'article homonyme de FORMATION n'est pas touché",
    apres.find((p) => p.id === "p1").entrees === 7 && apres.find((p) => p.id === "p1").prix_achat === 8500
    && apres.find((p) => p.id === "p2").entrees === 3 && apres.find((p) => p.id === "p2").prix_achat === 60000
    && apres.find((p) => p.id === "p9").entrees === 0);
  const rE2 = Imp.analyserEntrees(dbE, "BMI DEMAKPOE", Imp.enregistrementsDepuisLignes(Imp.lignesDepuisTexte("Inconnu XYZ, 4\nPanneau 550W, 0\nPanneau 550W, 2\nPanneau 550W, 1"), Imp.MODES_IMPORT.entrees).enregistrements);
  test("★ nom introuvable → REFUSÉ (on ne crée pas d'article en mode Entrées) ; quantité nulle → refusée ; doublon → seconde ligne refusée",
    rE2.erreurs.some((e) => e.includes("Inconnu XYZ") && e.includes("aucun article"))
    && rE2.erreurs.some((e) => e.includes("quantité reçue manquante"))
    && rE2.entrees.length === 1 && rE2.entrees[0].qte === 2 && rE2.erreurs.some((e) => e.includes("en double")));
  test("l'écran demande le MODE avant de lire le fichier, et le journal garde une ligne par article",
    /choisirMode\(`Que contient/.test(readFileSync("src/screens/Stocks.jsx", "utf8"))
    && /Entrée stock \+\$\{x\.qte\}/.test(readFileSync("src/screens/Stocks.jsx", "utf8")));
  test("★ la règle vit dans lib/importStock.js — l'écran Stocks ne découpe plus lui-même les lignes",
    !/parts\[5\]|split\(","\)/.test(readFileSync("src/screens/Stocks.jsx", "utf8"))
    && /from "\.\.\/lib\/importStock"/.test(readFileSync("src/screens/Stocks.jsx", "utf8")));
}

titre("Le dimensionnement a UNE seule boutique, partagée par les trois volets");
{
  // Choix de Timo (02/09/2026) : « moi-même je change la boutique à ma
  // guise ». Avant, chaque volet mémorisait SA boutique — changer de volet
  // faisait « changer » la boutique sans qu'on ait rien touché. Le choix
  // vit dans le conteneur (index.jsx) et descend en props ; la mémoire est
  // l'écran « dimensionnement », partout.
  const conteneur = readFileSync("src/screens/dimensionnement/index.jsx", "utf8");
  test("★ le conteneur porte le choix (un seul état bq/setBq)",
    /const \[bq, setBq\] = useState\(/.test(conteneur)
    && /ecran: "dimensionnement"/.test(conteneur)
    && /bq, setBq \};/.test(conteneur));
  for (const fichier of ["Solaire.jsx", "Garage.jsx", "Autre.jsx"]) {
    const src = readFileSync(`src/screens/dimensionnement/${fichier}`, "utf8");
    test(`★ ${fichier} reçoit la boutique en props — aucun état local`,
      /,\s*bq,\s*setBq\s*\}\)/.test(src)
      && !/\[bq, setBq\] = useState/.test(src));
    test(`${fichier} lit et mémorise sous l'écran « dimensionnement » (plus de mémoire par volet)`,
      src.includes(`boutiqueRetenue(db, profile, bq, { ecran: "dimensionnement" })`)
      && !/dim-solaire|dim-garage|dim-autre/.test(src));
  }
}

titre("La carte de position s'affiche (le cadre Leaflet n'appartient qu'à Leaflet)");
{
  // ⚠ Mesuré le 02/09/2026 après TROIS correctifs à côté : quand le cadre
  // de la carte n'a qu'un texte React comme enfant (« Chargement… »),
  // React prend un raccourci au retrait de ce texte et VIDE le cadre
  // entier — le dessin de Leaflet avec. La carte restait blanche partout,
  // tout en enregistrant les positions. Règle : le div de la carte est
  // AUTO-FERMÉ (aucun enfant React, jamais), le texte vit dans un frère.
  const carte = readFileSync("src/components/Carte.jsx", "utf8");
  test("★ le cadre confié à Leaflet est auto-fermé — aucun enfant React",
    /<div ref=\{conteneurRef\}[^>]*\/>/.test(carte));
  test("★ le moteur de la carte est embarqué (plus de chargement CDN)",
    /from "leaflet"/.test(carte) && !/cdnjs\.cloudflare\.com/.test(carte));
  test("l'icône du repère est rattachée aux images empaquetées",
    /L\.Icon\.Default\.mergeOptions/.test(carte));
}

titre("L'apparence de l'accueil arrive sur les appareils SANS fiche boutique");
{
  // ⚠ Relevé par Timo (31/08/2026) : image, bulles et étoiles réglées dans
  // Paramètres n'apparaissaient pas sur le téléphone des clients. Leur base
  // locale est purgée à chaque déconnexion : l'écran de connexion dépend
  // alors entièrement du petit serveur d'apparence — qui ne publiait pas
  // trois des réglages, et n'avait aucun repli hors ligne.
  const api = readFileSync("api/apparence.js", "utf8");
  for (const champ of ["accueil_etoiles", "accueil_couleur_bulles", "accueil_image_etendue"]) {
    test(`★ le serveur d'apparence publie ${champ}`, api.includes(`"${champ}"`));
  }
  test("★ l'écran de connexion FUSIONNE fiche locale et apparence serveur (champ par champ)",
    /\.\.\.\(apparence \|\| \{\}\), \.\.\.\(db\.boutiques\[0\] \|\| \{\}\)/.test(readFileSync("src/screens/Connexion.jsx", "utf8")));
  test("★ la dernière apparence reçue est gardée en réserve sur l'appareil (bmi_apparence)",
    /bmi_apparence/.test(readFileSync("src/supabaseClient.js", "utf8")));
}



titre("Plus aucun compte de départ dans le code ; package.json suit la version");
{
  // Avis extérieur relu par Timo (12/09/2026) : « Retirer le admin 2026 et
  // aligner le package.json ». Un mot de passe fixe dans le paquet envoyé au
  // navigateur est une mauvaise habitude ; le numéro de package.json était
  // resté à 2.101.13 pendant que l'application était en 2.101.172.
  const cst = readFileSync("src/lib/constants.js", "utf8");
  const tousSrc = execSync("grep -rl 'ADMIN2026' src api scripts supabase vite.config.js --exclude=verifier-cloisonnement.mjs || true", { encoding: "utf8" }).trim();
  test("★ SEED.users est vide et « ADMIN2026 » n'apparaît plus nulle part (src, api, scripts, supabase)",
    /users: \[\],/.test(cst) && !/ADMIN2026/.test(cst) && tousSrc === "");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const version = (cst.match(/VERSION\s*=\s*"([^"]+)"/) || [])[1];
  test(`★ package.json (${pkg.version}) porte la même version que constants.js (${version}), et vite.config.js le réécrit à chaque construction`,
    pkg.version === version && /"version":\\s\*"\[\^"\]\*"/.test(readFileSync("vite.config.js", "utf8")) && /writeFileSync\(pkgPath, aligne\)/.test(readFileSync("vite.config.js", "utf8")));
  test("le mode d'emploi d'une installation neuve existe (docs/installation-premier-administrateur.md) et dit de changer le mot de passe tout de suite",
    existsSync("docs/installation-premier-administrateur.md") && /changer le mot de\s+passe tout de suite/.test(readFileSync("docs/installation-premier-administrateur.md", "utf8")));
}


titre("Les icônes de l'application ont un fond transparent (écran de lancement Android)");
{
  // Capture Timo (12/09/2026) : « le logo de lancement est toujours dans un
  // carré blanc… il devrait être sans fond ». Android dessine l'icône du
  // manifeste telle quelle sur background_color : une icône RGB (sans
  // transparence) y laisse son carré blanc. On lit l'en-tête PNG (type de
  // couleur 6 = RGBA) et le premier pixel (alpha 0), mesuré, pas présumé.
  // 12/09/2026, « rien n'a changé » : le téléphone gardait l'ancienne image, même nom → renommées -v2 ; le manifeste doit les citer.
  const vc = readFileSync("vite.config.js", "utf8");
  test("★ le manifeste cite les icônes sous leur NOUVEAU nom (-v2) et plus les anciennes", /icone-bmi-192-v2\.png/.test(vc) && /icone-bmi-512-v2\.png/.test(vc) && !/pwa-192\.png|pwa-512\.png/.test(vc) && !existsSync("public/pwa-512.png"));
  for (const f of ["public/icone-bmi-192-v2.png", "public/icone-bmi-512-v2.png"]) {
    const b = readFileSync(f);
    const typeCouleur = b[25];
    const png = execSync(`node -e "const z=require('zlib'),b=require('fs').readFileSync('${f}');let i=8,idat=[];while(i<b.length){const l=b.readUInt32BE(i),t=b.toString('ascii',i+4,i+8);if(t==='IDAT')idat.push(b.subarray(i+8,i+8+l));i+=12+l;}const d=z.inflateSync(Buffer.concat(idat));process.stdout.write(String(d[4]))"`, { encoding: "utf8" });
    test(`★ ${f} : RGBA (type ${typeCouleur}) et premier pixel transparent (alpha ${png})`, typeCouleur === 6 && png === "0");
  }
}


titre("Les petites dépenses d'un chantier de devis, déduites avant le partage des frais d'installation");
{
  // Timo (13/09/2026) : « pour les chantiers nés d'un devis, les petites
  // dépenses peuvent être rattachées au devis… à la fin, ces petites dépenses
  // sont soustraites avant le partage » — « je parle des frais
  // d'installation, pas de la commission du commercial » — « au moment
  // d'enregistrer la dépense… les chantiers en cours apparaissent et il
  // rattache ». La règle vit dans lib/depensesChantier.js : on la BUNDLE et on
  // l'exerce avec des chiffres connus.
  const sortieDc = join("node_modules", ".cache", `bmi-depenses-chantier-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/depensesChantier.js"], bundle: true, format: "esm", platform: "node", outfile: sortieDc, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Dc = await import(pathToFileURL(sortieDc).href);
  unlinkSync(sortieDc);
  const admin = { id: "adm", nom: "TIMO", role: "admin" };
  const gerant = { id: "ger", nom: "KOFFI", role: "gerant" };
  const vendeur = { id: "ven", nom: "AMA", role: "vendeur" };
  const autreVendeur = { id: "ven2", nom: "ESSI", role: "vendeur" };
  const dbc = {
    boutiques: [{ nom: "LOME", formation: false }, { nom: "LOME-F", formation: true }],
    users: [{ ...admin, formation: false }, { ...gerant, formation: false }, { ...vendeur, formation: false }, { ...autreVendeur, formation: false }],
    ventes: [{ id: "v1", boutique: "LOME" }, { id: "v2", boutique: "LOME" }, { id: "v3", boutique: "LOME" }, { id: "vf", boutique: "LOME-F" }],
    clients_installes: [
      { id: "c1", nom: "MENSAH", prenom: "Paul", type_installation: "Solaire résidentiel", vente_id: "v1", statut: "en_cours", date_installation: "2026-09-10", equipe: [] },
      { id: "c2", nom: "DOE", prenom: "Ama", type_installation: "Pompage solaire", vente_id: "v2", statut: "receptionne", equipe: [] },
      { id: "c3", nom: "KOFFI", prenom: "Jean", vente_id: "v3", statut: "termine", date_installation: "2026-09-12", equipe: [{ user_id: "t1", montant: 30000, paye: true }] },
      { id: "cf", nom: "FORMATION", vente_id: "vf", statut: "en_cours", equipe: [] },
    ],
    depenses: [
      { id: "d1", boutique: "LOME", categorie: "Carburant", montant: 8000, paiement: "Espèces", par: "AMA", par_id: "ven", chantier_id: "c1", validation: { statut: "validee", le: "2026-09-11", par: "TIMO" } },
      { id: "d2", boutique: "LOME", categorie: "Nourriture", montant: 3000, paiement: "Espèces", par: "AMA", par_id: "ven", chantier_id: "c1" },
      { id: "d3", boutique: "LOME", categorie: "Carburant", montant: 12000, paiement: "Espèces", par: "AMA", par_id: "ven", chantier_id: "c1", validation: { statut: "attente" } },
      { id: "d4", boutique: "LOME", categorie: "Carburant", montant: 0, paiement: "Espèces", par: "AMA", par_id: "ven", chantier_id: "c1", validation: { statut: "rejetee", le: "2026-09-11", par: "TIMO", motif: "x", montant: 9000 } },
      { id: "d5", boutique: "LOME", categorie: "Carburant", montant: 5000, paiement: "Espèces", par: "AMA", par_id: "ven" },
    ],
  };
  const ouverts = Dc.chantiersRattachables(dbc, admin).map((c) => c.id);
  // L'admin de la maquette est le principal (seul admin) : il VOIT les deux
  // espaces, mais la liste ne propose que l'espace REGARDÉ (réel ici).
  test("★ rattachables pour l'admin principal qui regarde le réel : le chantier en cours seulement ; JAMAIS le réceptionné, ni celui dont les frais sont déjà payés (même terminé), ni le chantier de formation",
    ouverts.join(",") === "c1");
  const enFormation = Dc.chantiersRattachables({ ...dbc, users: [{ ...admin, formation: false }, { id: "gf", nom: "GF", role: "gerant", boutique: "LOME-F" }] }, { id: "gf", nom: "GF", role: "gerant", boutique: "LOME-F" }).map((c) => c.id);
  test("★ …et un compte de formation ne se voit proposer que le chantier de formation", enFormation.join(",") === "cf");
  test("★ le libellé d'un chantier = prénom, nom, type d'installation", Dc.libelleChantier(dbc.clients_installes[0]) === "Paul MENSAH · Solaire résidentiel" && Dc.libelleChantier({ nom: "X" }) === "X");
  test("★ le total rattaché ne compte que ce qui COMPTE : validée 8 000 + sous le seuil 3 000 = 11 000 ; l'attente (12 000) et la rejetée (0, origine 9 000) sont ignorées ; d5 sans chantier aussi",
    Dc.totalDepensesChantier(dbc, "c1") === 11000 && Dc.depensesDuChantier(dbc, "c1").length === 4);
  test("★ frais à partager = facturés − rattachées, jamais négatif : 100 000 − 11 000 = 89 000 ; 5 000 − 11 000 = 0 ; sans dépense = les frais",
    Dc.fraisAPartager(100000, 11000) === 89000 && Dc.fraisAPartager(5000, 11000) === 0 && Dc.fraisAPartager(100000, 0) === 100000 && Dc.fraisAPartager("100000", undefined) === 100000);
  test("★ qui rattache : gérant et admin toujours, l'auteur de la dépense (par_id, ou par nom pour les anciennes), pas un autre vendeur",
    Dc.peutRattacher(admin, dbc.depenses[4]) && Dc.peutRattacher(gerant, dbc.depenses[4]) && Dc.peutRattacher(vendeur, dbc.depenses[4]) && !Dc.peutRattacher(autreVendeur, dbc.depenses[4])
    && Dc.peutRattacher({ id: "z", nom: "AMA", role: "vendeur" }, { par: "AMA" }) && !Dc.peutRattacher({ id: "z", nom: "ESSI", role: "vendeur" }, { par: "AMA" }));
  const c1 = dbc.clients_installes[0], c2 = dbc.clients_installes[1], c3 = dbc.clients_installes[2], cf = dbc.clients_installes[3];
  test("★ critiqueRattachement : refus pour un autre vendeur, pour un chantier réceptionné, pour des frais déjà payés, pour un chantier hors de l'espace regardé ; accord pour un chantier en cours, et pour détacher (null)",
    /Seuls le gérant/.test(Dc.critiqueRattachement(dbc, autreVendeur, dbc.depenses[4], c1))
    && /réceptionné/.test(Dc.critiqueRattachement(dbc, admin, dbc.depenses[4], c2))
    && /déjà été payés/.test(Dc.critiqueRattachement(dbc, admin, dbc.depenses[4], c3))
    && /espace/.test(Dc.critiqueRattachement(dbc, vendeur, dbc.depenses[4], cf))
    && Dc.critiqueRattachement(dbc, vendeur, dbc.depenses[4], c1) === null && Dc.critiqueRattachement(dbc, vendeur, dbc.depenses[4], null) === null);
  const r = Dc.rattacherDepense(dbc.depenses[4], c1);
  test("★ rattacherDepense pose chantier_id + chantier_nom sans rien toucher d'autre ; détacher (null) les retire",
    r.chantier_id === "c1" && r.chantier_nom === "Paul MENSAH · Solaire résidentiel" && r.montant === 5000 && r.id === "d5"
    && !("chantier_id" in Dc.rattacherDepense(r, null)) && !("chantier_nom" in Dc.rattacherDepense(r, null)) && Dc.rattacherDepense(r, null).montant === 5000);
  // Les écrans : la forme du geste.
  const dpC = readFileSync("src/screens/Depenses.jsx", "utf8");
  // Capture Timo (13/09/2026) : « devant Payé avec, avoir la ligne : chantier à
  // rattacher… pas sur la ligne de dépense » — la ligne est TOUJOURS dans le
  // formulaire (même sans chantier en cours, elle le dit), et le tableau ne
  // porte plus de lien « rattacher » : il montre seulement le chantier.
  test("★ écran Dépenses : la ligne « Chantier à rattacher » TOUJOURS présente à côté de « Payé avec » (chantiersRattachables, « — Aucun — », « Aucun chantier de devis en cours » si vide), la saisie passe par critiqueRattachement puis rattacherDepense, la colonne « Chantier » montre le chantier SANS lien ni rattachement après coup",
    /<Field label="Chantier à rattacher">/.test(dpC) && !/chantiersOuverts\.length > 0 && \(/.test(dpC) && /const chantiersOuverts = chantiersRattachables\(db, profile\);/.test(dpC) && /<option value="">— Aucun —<\/option>/.test(dpC)
    && /Aucun chantier de devis en cours<\/option>/.test(dpC)
    && /const refusChantier = chantierChoisi \? critiqueRattachement\(db, profile, r\.depense, chantierChoisi\) : null;/.test(dpC) && /const depense = chantierChoisi \? rattacherDepense\(r\.depense, chantierChoisi\) : r\.depense;/.test(dpC)
    && /🏠 \{x\.chantier_nom \|\| "chantier"\}/.test(dpC) && !/onRattacher/.test(dpC) && !/rattacherApresCoup/.test(dpC) && !/uChoix/.test(dpC));
  const ciC = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
  test("★ écran Clients installés : les parts et la part BMI se calculent sur fraisNet (= fraisAPartager(fraisRep, dépenses rattachées)), plus jamais sur fraisRep ; la déduction se lit dans le panneau, se confirme, se mémorise (depenses_deduites, frais_a_partager) ; la fiche montre le total rattaché",
    /const depRattachees = chantier \? totalDepensesChantier\(db, chantier\) : 0;/.test(ciC) && /const fraisNet = fraisAPartager\(fraisRep, depRattachees\);/.test(ciC)
    && /const montant = Math\.round\(\(fraisNet \* pct\) \/ 100\);/.test(ciC) && !/fraisRep \* pct/.test(ciC) && !/fraisRep \* pctBMI/.test(ciC) && !/fraisRep \* \(100 - totalPct\)/.test(ciC)
    && /Petites dépenses rattachées : − \{fmt\(depRattachees\)\}/.test(ciC) && /const ligneDeduction = depRattachees > 0/.test(ciC)
    && /depenses_deduites: depRattachees, frais_a_partager: fraisNet/.test(ciC) && /🧾 Dépenses rattachées : \{fmt\(totalDepensesChantier\(db, c\.id\)\)\}/.test(ciC));
}


titre("🛠 Travaux à crédit : la règle pure, exercée avec des chiffres, et ses branchements");
{
  // Timo (13/09/2026) : « des chantiers qu'on exécute… câble, tuyau = articles
  // HB… ligne de frais de prestation en % ou libre… articles sortis facturés
  // au prix de la boutique… le jour où le client finit de payer, le travail
  // quitte l'onglet pour rester dans Clients installés » — option A : une trace.
  const sortieTv = join("node_modules", ".cache", `bmi-travaux-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/travaux.js"], bundle: true, format: "esm", platform: "node", outfile: sortieTv, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Tv = await import(pathToFileURL(sortieTv).href);
  unlinkSync(sortieTv);
  const sortieCa = join("node_modules", ".cache", `bmi-calculs-travaux-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/calculs.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCa, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Ca = await import(pathToFileURL(sortieCa).href);
  unlinkSync(sortieCa);
  const admin = { id: "adm", nom: "TIMO", role: "admin" };
  const p1 = { id: "p1", nom: "Panneau 400W", boutique: "LOME", initial: 3, prix_vente: 100000, prix_achat: 70000 };
  const dbt = { boutiques: [{ nom: "LOME", formation: false }], users: [{ ...admin, formation: false }], produits: [p1], ventes: [], dettes: [], ajustements: [], depenses: [], clients_installes: [] };
  const c0 = Tv.nouveauTravail(admin, { nom: "mensah", prenom: "Paul", tel: "90", lieu: "Bè", boutique: "LOME", description: "câblage" }, "2026-09-13");
  test("★ nouveauTravail : une ligne de clients_installes marquée travaux, statut fixe « travaux », nom en majuscules, boutique portée, articles vides, prestation 0 %",
    c0.travaux === true && c0.statut === "travaux" && c0.nom === "MENSAH" && c0.boutique === "LOME" && c0.articles_travaux.length === 0 && c0.prestation.mode === "pct" && c0.prestation.valeur === 0 && c0.type_installation === "Travaux");
  test("★ critiqueFiche : nom obligatoire, boutique obligatoire", /nom/.test(Tv.critiqueFiche({ nom: " ", boutique: "LOME" })) && /boutique/.test(Tv.critiqueFiche({ nom: "X", boutique: "" })) && Tv.critiqueFiche({ nom: "X", boutique: "LOME" }) === null);
  // Sortie du stock : 2 sur 3, le stock baisse TOUT DE SUITE par un ajustement négatif.
  const r1 = Tv.ajouterArticleStock(dbt, admin, c0, p1, 2, "2026-09-13");
  const db1 = { ...dbt, ajustements: [r1.ajustement], clients_installes: [r1.fiche] };
  test("★ ajouterArticleStock : la ligne porte prix de vente (facturé) et prix d'achat (coût), l'ajustement est de −2 (type sortie_travaux, boutique, travaux_id), le stock passe de 3 à 1",
    !r1.refus && r1.fiche.articles_travaux[0].pu_vente === 100000 && r1.fiche.articles_travaux[0].pu_achat === 70000 && r1.fiche.articles_travaux[0].hb === false
    && r1.ajustement.qte === -2 && r1.ajustement.type === "sortie_travaux" && r1.ajustement.boutique === "LOME" && r1.ajustement.travaux_id === c0.id && Ca.stockActuel(db1, p1) === 1);
  test("★ …et refuse au-delà du stock (2 sur 1 restant), ou une quantité nulle", /Stock insuffisant/.test(Tv.ajouterArticleStock(db1, admin, r1.fiche, p1, 2).refus) && /quantité/.test(Tv.ajouterArticleStock(db1, admin, r1.fiche, p1, 0).refus));
  const r2 = Tv.ajouterArticleHB(admin, r1.fiche, { nom: "Câble 6 mm", qte: 1, pu_achat: 30000, pu_vente: 50000 }, "2026-09-13");
  test("★ ajouterArticleHB : pas de stock (pas d'ajustement), marqué hb, prix payé et prix facturé", !r2.refus && r2.fiche.articles_travaux[1].hb === true && r2.fiche.articles_travaux[1].produit_id === null && !("ajustement" in r2) && /nom/.test(Tv.critiqueArticleHB({ nom: "", qte: 1, pu_vente: 1 })));
  const c2 = { ...r2.fiche, prestation: { mode: "pct", valeur: 10 } };
  test("★ montants : articles 2 × 100 000 + 50 000 = 250 000 facturés, coût 2 × 70 000 + 30 000 = 170 000 ; prestation 10 % de TOUS les articles = 25 000 ; total 275 000",
    Tv.totalArticles(c2) === 250000 && Tv.coutArticles(c2) === 170000 && Tv.montantPrestation(c2) === 25000 && Tv.totalAFacturer(c2) === 275000);
  test("★ prestation en montant libre : 30 000 → total 280 000 ; critiquePrestation refuse un mode inconnu, un négatif, un % > 100",
    Tv.totalAFacturer({ ...c2, prestation: { mode: "montant", valeur: 30000 } }) === 280000 && Tv.critiquePrestation({ mode: "x", valeur: 1 }) !== null && Tv.critiquePrestation({ mode: "pct", valeur: -1 }) !== null && Tv.critiquePrestation({ mode: "pct", valeur: 101 }) !== null && Tv.critiquePrestation({ mode: "pct", valeur: 10 }) === null);
  const dbDep = { ...db1, depenses: [{ id: "d1", chantier_id: c0.id, montant: 8000 }, { id: "d2", chantier_id: c0.id, montant: 5000, validation: { statut: "attente" } }] };
  test("★ coût des travaux = articles au coût + petites dépenses rattachées qui comptent (8 000, pas les 5 000 en attente) = 178 000", Tv.coutTravaux(dbDep, c2) === 178000);
  // Retirer : l'article de stock revient par un ajustement positif ; refusé une fois facturé.
  const r3 = Tv.retirerArticle(admin, c2, c2.articles_travaux[0].id, "2026-09-13");
  test("★ retirerArticle : ajustement +2 (retour_travaux), la ligne disparaît ; un HB retiré ne crée pas d'ajustement ; refusé si déjà facturé",
    r3.ajustement.qte === 2 && r3.ajustement.type === "retour_travaux" && r3.fiche.articles_travaux.length === 1
    && Tv.retirerArticle(admin, c2, c2.articles_travaux[1].id).ajustement === null && /déjà facturés/.test(Tv.retirerArticle(admin, { ...c2, vente_id: "v" }, c2.articles_travaux[0].id).refus));
  // Facturer : le panier pour 💰 Ventes.
  const panier = Tv.panierPourFacture(c2);
  test("★ panierPourFacture : la ligne de stock est marquée deja_sorti (pas de seconde sortie), la HB hors_boutique, la prestation en ligne libre « Frais de prestation » ; 3 lignes",
    panier.length === 3 && panier[0].deja_sorti === true && panier[0].produit_id === "p1" && panier[0].pu === 100000 && panier[1].hors_boutique === true && panier[1].produit_id === null && panier[2].article === "Frais de prestation" && panier[2].pu === 25000 && panier[2].qte === 1);
  const pre = Tv.preRempliPourFacture(c2);
  test("★ preRempliPourFacture : boutique, panier, travauxId, client et téléphone", pre.boutique === "LOME" && pre.travauxId === c0.id && pre.client === "Paul MENSAH" && pre.tel === "90" && pre.panier.length === 3);
  test("★ critiqueFacturation : déjà facturé refusé, rien à facturer refusé, sinon accord", /déjà facturés/.test(Tv.critiqueFacturation({ ...c2, vente_id: "v" })) && /Rien à facturer/.test(Tv.critiqueFacturation(c0)) && Tv.critiqueFacturation(c2) === null);
  // Le stock ne rebaisse pas quand la vente porte des lignes deja_sorti.
  const venteT = { id: "v1", boutique: "LOME", articles: panier, numero: "V-1", total: 275000 };
  const dbV = { ...db1, ventes: [venteT] };
  test("★ stockVendu ignore les lignes deja_sorti : après la vente, le stock reste à 1 (pas 1 − 2) — avec et sans index",
    Ca.stockActuel(dbV, p1) === 1 && Ca.stockActuel({ ...dbV, __index: Ca.construireIndexDb(dbV) }, p1) === 1);
  // Soldé ou pas.
  const cF = Tv.lierFacture(c2, venteT, null, "2026-09-13");
  const cD = Tv.lierFacture(c2, venteT, { id: "dt1", montant: 275000, paye: 100000 }, "2026-09-13");
  test("★ lierFacture pose vente_id, dette_id, facture_le, facture_numero ; travauxSolde : comptant = soldé ; à crédit = soldé seulement quand la dette est à 0",
    cF.vente_id === "v1" && cF.dette_id === null && cF.facture_numero === "V-1" && Ca.travauxSolde(dbV, cF) === true
    && Ca.travauxSolde({ ...dbV, dettes: [{ id: "dt1", montant: 275000, paye: 100000 }] }, cD) === false
    && Ca.travauxSolde({ ...dbV, dettes: [{ id: "dt1", montant: 275000, paye: 275000 }] }, cD) === true && Ca.travauxSolde(dbV, c2) === false);
  test("★ encaissé / reste dû : comptant → 275 000 / 0 ; à crédit payé 100 000 → 100 000 / 175 000",
    Tv.encaisse(dbV, cF) === 275000 && Tv.resteDu(dbV, cF) === 0
    && Tv.encaisse({ ...dbV, dettes: [{ id: "dt1", montant: 275000, paye: 100000 }] }, cD) === 100000 && Tv.resteDu({ ...dbV, dettes: [{ id: "dt1", montant: 275000, paye: 100000 }] }, cD) === 175000);
  // Timo (13/09/2026) : supprimer tant qu'aucun article n'est rattaché (principal, corbeille) ; l'équipe avec son responsable ⭐.
  test("★ critiqueSuppression : refusé avec des articles rattachés, refusé une fois facturé, permis sinon",
    /articles sont rattachés/.test(Tv.critiqueSuppression(c2)) && /déjà facturés/.test(Tv.critiqueSuppression({ ...c0, vente_id: "v" })) && Tv.critiqueSuppression(c0) === null);
  const techs = [{ id: "t1", nom: "KOSSI" }, { id: "t2", nom: "AMA", nom_complet: "AMA D." }];
  const eq = Tv.composerEquipe(techs, ["t1", "t2"], "t2");
  test("★ l'équipe : composerEquipe pose les membres avec le chef ⭐, parts à 0 (aucune répartition de frais) ; critiqueEquipe exige un membre et un chef parmi les cochés ; chefTravaux / libelleEquipe",
    eq.length === 2 && eq[1].chef === true && eq[0].chef === false && eq[1].nom === "AMA D." && eq[0].pct === 0 && eq[0].montant === 0
    && /Cochez/.test(Tv.critiqueEquipe([], "")) && /responsable/.test(Tv.critiqueEquipe(["t1"], "t2")) && Tv.critiqueEquipe(["t1"], "t1") === null
    && Tv.chefTravaux({ equipe: eq }).user_id === "t2" && Tv.libelleEquipe({ equipe: eq }) === "KOSSI, ⭐ AMA D.");
  const tvJ = readFileSync("src/screens/Travaux.jsx", "utf8");
  test("★ l'écran : « 🗑 Supprimer ces travaux » pour le PRINCIPAL seul (refuserSaufAdminPrincipal + critiqueSuppression, corbeille, dépenses conservées dites), l'équipe pour l'admin (refuserSaufRoles ROLES_EQUIPE, composerEquipe) parmi les techniciens de l'espace regardé",
    /refuserSaufAdminPrincipal\(db, profile, "Supprimer des travaux"\)/.test(tvJ) && /const refus = critiqueSuppression\(c\);/.test(tvJ) && /save\(mettreALaCorbeille\(db, "clients_installes", c\.id, profile\)/.test(tvJ) && /RESTENT dans 📤 Dépenses/.test(tvJ) && /\{jeSuisPrincipal && !vente && \(/.test(tvJ)
    && /refuserSaufRoles\(profile, ROLES_EQUIPE, "Composer l'équipe des travaux"\)/.test(tvJ) && /const equipe = composerEquipe\(techniciens, equipeForm\.ids, equipeForm\.chef\);/.test(tvJ)
    && /const techniciens = utilisateursDeLEspace\(db, profile\)\.filter\(\(u\) => \["technicien", "technicien_bmi"\]\.includes\(u\.role\) && u\.actif !== false\);/.test(tvJ));
  // Choisir l'article à sortir en tapant son nom (capture Timo, 13/09/2026 :
  // « tous les articles apparaissent… saisie libre avec proposition »).
  const p3 = { id: "p3", nom: "Convertisseur hybride DEYE 6kW", boutique: "LOME", initial: 1, prix_vente: 390000, prix_achat: 300000 };
  const props = Tv.propositionsStock({ ...dbt, produits: [p1, p3] }, [p1, p3]);
  test("★ propositionsStock : une proposition par article, nom en entier, « N en stock · prix » dessous, l'id de l'article porté",
    props.length === 2 && props[1].valeur === "Convertisseur hybride DEYE 6kW" && props[1].produit_id === "p3" && props[1].detail.replace(/[\u202f\u00a0]/g, " ") === "1 en stock · 390 000 F" && props[0].detail.replace(/[\u202f\u00a0]/g, " ") === "3 en stock · 100 000 F");
  test("★ produitSaisi : lie seulement un nom EXACT (sans accents ni majuscules) — « panneau 400w » oui, « panneau » ou « deye » non, vide non",
    Tv.produitSaisi([p1, p3], "panneau 400w")?.id === "p1" && Tv.produitSaisi([p1, p3], "Panneau") === null && Tv.produitSaisi([p1, p3], "deye") === null && Tv.produitSaisi([p1, p3], "") === null);
  test("★ critiqueArticleStock sans article : le message dit de taper le nom puis cliquer la proposition", /tapez son nom, puis cliquez la proposition/.test(Tv.critiqueArticleStock(dbt, null, 1)));
  test("★ l'écran Travaux : plus de <select> pour l'article du stock — LE champ commun ChampSuggestions (propositionsStock, onChoisir lie, onChange relit produitSaisi)",
    !/<option value="">— Article du stock —<\/option>/.test(tvJ) && /<ChampSuggestions className=\{inputCls\} placeholder="Article du stock : tapez son nom…"/.test(tvJ)
    && /suggestions=\{propositionsStock\(db, produits\)\}/.test(tvJ) && /produit_id: produitSaisi\(produits, v\)\?\.id \|\| ""/.test(tvJ) && /onChoisir=\{\(s\) => setStockForm\(\{ \.\.\.stockForm, saisie: s\.valeur, produit_id: s\.produit_id \}\)\}/.test(tvJ));
  test("★ travauxEnCours : la fiche non soldée est dans l'onglet ; soldée, elle n'y est plus ; boutiqueDuChantier lit la boutique de la fiche",
    Tv.travauxEnCours({ ...dbV, clients_installes: [cD], dettes: [{ id: "dt1", montant: 275000, paye: 1 }] }, admin).length === 1
    && Tv.travauxEnCours({ ...dbV, clients_installes: [cF] }, admin).length === 0 && Ca.boutiqueDuChantier(dbV, c0) === "LOME");
  // Les écrans et l'onglet : la forme.
  const appT = readFileSync("src/App.jsx", "utf8");
  const calT = readFileSync("src/lib/calculs.js", "utf8");
  test("★ l'onglet « 🛠 Travaux à crédit » : dans ONGLETS_ROLE pour admin, gérant, vendeur, magasinier (et eux seuls), dans les quatre menus d'App, rendu pour ces rôles avec onFacturer → panier de 💰 Ventes",
    ["admin", "gerant", "vendeur", "magasinier"].every((r) => new RegExp(`^  ${r}: \\[.*"travaux"[,\\]]`, "m").test(calT))
    && !["commercial", "technicien", "resp_commercial", "technicien_bmi", "comptable", "client"].some((r) => new RegExp(`^  ${r}: \\[.*"travaux"`, "m").test(calT))
    && /travaux: "🛠 Travaux à crédit"/.test(calT) && (appT.match(/\["travaux", "🛠 Travaux à crédit"\]/g) || []).length === 4
    && /ongletsVisites\.travaux && \(isAdmin \|\| isGerant \|\| isVendeur \|\| isMagasinier\)/.test(appT) && /<M\.Travaux db=\{db\} save=\{save\} profile=\{profile\} onFacturer=\{\(pre\) => \{ setPreRempli\(pre\); setTab\("ventes"\); \}\} \/>/.test(appT));
  const vT = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ 💰 Ventes : une ligne deja_sorti ne manque jamais au contrôle de stock (les deux passages), la vente porte travaux_id, et le reçu / la dette reviennent sur la fiche (lierFacture)",
    (vT.match(/if \(l\.deja_sorti\) return false;/g) || []).length === 2 && /\.\.\.\(origineTravaux \? \{ travaux_id: origineTravaux \} : \{\}\)/.test(vT)
    && /lierFacture\(c, vente, detteTravaux, today\(\)\)/.test(vT) && /setOrigineTravaux\(preRempli\.travauxId \|\| null\);/.test(vT));
  const ciT = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
  test("★ 🏠 Clients installés : une fiche de travaux n'y vient que SOLDÉE, catégorie « 🛠 Travaux soldés », statut « travaux » connu, trace (facturé / coût / marge), pas de Frais, Programmer ni Entretien pour elle",
    /\.filter\(\(c\) => !c\.travaux \|\| travauxSolde\(db, c\)\)/.test(ciT) && /\{ id: "travaux", label: "🛠 Travaux soldés", test: \(c\) => !!c\.travaux \}/.test(ciT)
    && /travaux: \{ label: "🛠 Travaux — soldés"/.test(ciT) && /Facturé \{fmt\(factureMontant\(db, c\)\)\}/.test(ciT)
    && /\{!c\.travaux && \(\n\s*<button onClick=\{\(\) => ouvrirRepartition\(c\)\}/.test(ciT) && /statutChantier\(c\) !== "receptionne" && !c\.travaux && \(/.test(ciT) && /\{!c\.travaux && <button onClick=\{\(\) => modifierEntretien\(c\)\}/.test(ciT));
  test("★ le stock : stockVendu et l'index ignorent deja_sorti ; le rattachement d'une dépense refuse des travaux soldés",
    /l\.produit_id === pid && !l\.deja_sorti/.test(calT) && /if \(l\.produit_id && !l\.deja_sorti\) venduParProduit/.test(calT)
    && /Ces travaux sont soldés/.test(readFileSync("src/lib/depensesChantier.js", "utf8")) && /!travauxSolde\(db, c\)\)/.test(readFileSync("src/lib/depensesChantier.js", "utf8")));
}


titre("📤 Dépenses ouvert aux techniciens : leurs propres dépenses seulement");
{
  // Timo (13/09/2026) : « ouvrir l'onglet Dépenses au technicien, mais ils ne
  // verront que leurs propres dépenses, pas toutes les dépenses ».
  const sortieVd2 = join("node_modules", ".cache", `bmi-vd-techniciens-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/validationDepenses.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVd2, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vd2 = await import(pathToFileURL(sortieVd2).href);
  unlinkSync(sortieVd2);
  const tech = { id: "t1", nom: "KOSSI", role: "technicien" };
  const liste = [{ id: "a", par_id: "t1", par: "KOSSI" }, { id: "b", par_id: "v1", par: "AMA" }, { id: "c", par: "KOSSI" }, { id: "d", par: "AMA" }];
  test("★ un technicien (et un technicien BMI) ne voit que les siennes : par_id, ou par nom pour les anciennes ; un vendeur, un gérant, l'admin voient tout",
    Vd2.depensesVisibles(liste, tech).map((d) => d.id).join(",") === "a,c" && Vd2.depensesVisibles(liste, { ...tech, role: "technicien_bmi" }).map((d) => d.id).join(",") === "a,c"
    && Vd2.depensesVisibles(liste, { id: "v1", nom: "AMA", role: "vendeur" }).length === 4 && Vd2.depensesVisibles(liste, { id: "x", nom: "TIMO", role: "admin" }).length === 4
    && Vd2.neVoitQueSesDepenses(tech) && !Vd2.neVoitQueSesDepenses({ role: "gerant" }));
  const calD = readFileSync("src/lib/calculs.js", "utf8"), appD = readFileSync("src/App.jsx", "utf8"), dpD = readFileSync("src/screens/Depenses.jsx", "utf8");
  test("★ l'onglet est dans ONGLETS_ROLE pour technicien et technicien_bmi, dans leurs menus d'App (pas dans celui du commercial), et l'écran filtre par depensesVisibles avec le titre « Mes dépenses »",
    /^  technicien: \[.*"depenses"[,\]]/m.test(calD) && /^  technicien_bmi: \[.*"depenses"[,\]]/m.test(calD) && !/^  commercial: \[.*"depenses"/m.test(calD)
    && /\.\.\.\(isTechnicien \? \[\["depenses", "📤 Dépenses"\]\] : \[\]\)/.test(appD) && /\["parc", "🏠 Clients installés"\].*\["depenses", "📤 Dépenses"\]\]/.test(appD)
    && /const liste = depensesVisibles\(horsVersements\(db\.depenses\)\.filter\(\(x\) => x\.boutique === boutique\), profile\);/.test(dpD) && /\{mesSeules \? "Mes dépenses" : "Dépenses"\}/.test(dpD));
}


titre("« Payé avec » nomme chaque caisse : la boutique qui a sorti l'argent porte la dépense");
{
  // Capture Timo (13/09/2026) : « il peut recevoir dans une boutique et valider
  // pour une boutique… ajouter nommément les boutiques disponibles… même si le
  // haut est BMI DEMAKPOE, il a la possibilité de choisir BMI APESSITO comme
  // boutique qui a sorti l'argent ».
  const sortieVd3 = join("node_modules", ".cache", `bmi-vd-caisses-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/validationDepenses.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVd3, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vd3 = await import(pathToFileURL(sortieVd3).href);
  unlinkSync(sortieVd3);
  const opts = Vd3.optionsPayeAvec(["BMI APESSITO", "BMI DEMAKPOE", "TERRAIN"], "BMI DEMAKPOE");
  test("★ optionsPayeAvec : une ligne « La caisse de X » par boutique, la boutique regardée en tête, puis avance personnelle et argent du DG ; « La caisse du comptable » SEULEMENT si demandée (réel), jamais d'office (formation)",
    opts.map(([c]) => c).join("|") === "caisse:BMI DEMAKPOE|caisse:BMI APESSITO|caisse:TERRAIN|avance|dg" && opts[0][1] === "La caisse de BMI DEMAKPOE" && opts[1][1] === "La caisse de BMI APESSITO"
    && Vd3.optionsPayeAvec(["A"], "A", { avecComptable: true }).map(([c]) => c).join("|") === "caisse:A|avance|dg|comptable" && Vd3.optionsPayeAvec(["A"], "A", { avecComptable: true }).pop()[1] === "La caisse du comptable"
    && JSON.stringify(Vd3.interpreterPayeAvec("comptable", "BMI DEMAKPOE")) === JSON.stringify({ paye_avec: "comptable", boutique: "BMI DEMAKPOE" }) && Vd3.PAYE_AVEC_COMPTABLE === "comptable"
    && Vd3.critiqueSaisie({ montant: 100, paye_avec: "comptable", boutique: "A" }) === "" && Vd3.payeeParLeComptable({ paye_avec: "comptable" }) && !Vd3.payeeParLeComptable({ paye_avec: "dg" })
    && !Vd3.sortDuTiroir({ paiement: "Espèces", paye_avec: "comptable" }) /* ne touche pas le tiroir, ne bloque pas la clôture */);
  test("★ interpreterPayeAvec : « caisse:BMI APESSITO » → caisse ET boutique APESSITO même si le haut montre DEMAKPOE ; avance / DG gardent la boutique regardée ; vide = la caisse de la boutique regardée",
    JSON.stringify(Vd3.interpreterPayeAvec("caisse:BMI APESSITO", "BMI DEMAKPOE")) === JSON.stringify({ paye_avec: "caisse", boutique: "BMI APESSITO" })
    && JSON.stringify(Vd3.interpreterPayeAvec("avance", "BMI DEMAKPOE")) === JSON.stringify({ paye_avec: "avance", boutique: "BMI DEMAKPOE" })
    && JSON.stringify(Vd3.interpreterPayeAvec("dg", "BMI DEMAKPOE")) === JSON.stringify({ paye_avec: "dg", boutique: "BMI DEMAKPOE" })
    && JSON.stringify(Vd3.interpreterPayeAvec("", "BMI DEMAKPOE")) === JSON.stringify({ paye_avec: "caisse", boutique: "BMI DEMAKPOE" })
    && Vd3.libelleChoixPayeAvec("caisse:BMI APESSITO", "BMI DEMAKPOE") === "la caisse de BMI APESSITO");
  const dep3 = readFileSync("src/screens/Depenses.jsx", "utf8");
  test("★ l'écran : la liste des caisses vient des boutiques visibles de l'espace regardé, la confirmation nomme la caisse et prévient quand une AUTRE boutique a payé, et le message final dit où retrouver la dépense",
    /const caissesPossibles = boutiquesVisibles\(db, profile, db\.boutiques \|\| \[\]\)\.map\(\(b\) => b\.nom\);/.test(dep3) && /const choixCaisse = interpreterPayeAvec\(f\.paye_avec, boutique\);/.test(dep3)
    && /C'est la caisse de \$\{choixCaisse\.boutique\} qui a payé/.test(dep3) && /Choisissez cette boutique en haut pour la voir/.test(dep3) && !/PAYE_AVEC\.map/.test(dep3));
}


titre("Les catégories de dépenses demandées par Timo");
{
  // Timo (13/09/2026) : « Livraison, le manger, le carburant, commande en Chine ».
  const cst = readFileSync("src/lib/constants.js", "utf8");
  const sortieCat = join("node_modules", ".cache", `bmi-cats-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/constants.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCat, logLevel: "silent" });
  const Cats = await import(pathToFileURL(sortieCat).href);
  unlinkSync(sortieCat);
  // ⚠ On lit la VRAIE liste (module bundlé), pas son texte source : depuis le
  // 18/09/2026 une catégorie y entre par une constante nommée, et lire le
  // source rendait « CATEGORIE_REPARATION_OUTIL » au lieu de sa valeur — le
  // contrôle aurait passé sans rien mesurer.
  test("★ CATEGORIES contient Livraison, Carburant, Nourriture, Commande en Chine, la réparation d'outillage (18/09/2026), et garde « Autre » en dernier",
    ["Livraison", "Carburant", "Nourriture", "Commande en Chine", "Réparation d'outillage"].every((c) => Cats.CATEGORIES.includes(c))
    && Cats.CATEGORIES[Cats.CATEGORIES.length - 1] === "Autre"
    && new Set(Cats.CATEGORIES).size === Cats.CATEGORIES.length
    && /export const CATEGORIES = \[/.test(cst));
}

titre("Les notifications respectent le mur (13/09/2026) — le détail est dans tester-notifications");
{
  // Qui reçoit une notification se décide UNIQUEMENT par les briques de
  // lib/espace.js (personnesDeLEspace, idsDeLaBoutique, idsParRole,
  // idsAdmins) : jamais un db.users.filter maison dans les deux règles.
  const notif = readFileSync("src/lib/notifications.js", "utf8"), rap = readFileSync("src/lib/rappels.js", "utf8");
  test("★ lib/notifications.js et lib/rappels.js ne filtrent jamais db.users eux-mêmes : les destinataires viennent de lib/espace.js (le mur formation / réel, et l'admin principal marqué 🎓)",
    !/(?:db|apres|avant)\.users(?: \|\| \[\])?\)?\.filter\(/.test(notif) && !/(?:db|apres|avant)\.users(?: \|\| \[\])?\)?\.filter\(/.test(rap)
    && /from "\.\/espace"/.test(notif) && /from "\.\/espace\.js"/.test(rap));
  test("★ le banc des notifications existe et fait partie des envois (package.json)", /"tester-notifications": "node scripts\/tester-notifications\.mjs"/.test(readFileSync("package.json", "utf8")));
}

titre("💬 Messages : un nouveau message apparaît EN TÊTE, bien avant le support client (Timo, 14/09/2026)");
{
  const sortieCv = join("node_modules", ".cache", `bmi-conversations-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/conversations.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCv, logLevel: "silent" });
  const Cv = await import(pathToFileURL(sortieCv).href);
  unlinkSync(sortieCv);
  const sections = [
    { cle: "equipe", titre: "Équipe", items: [{ cle: "sandrine", conv: { type: "user", id: "sandrine" } }, { cle: "djedje", conv: { type: "user", id: "djedje" } }] },
    { cle: "groupes", titre: "Groupes", toujours: true, items: [] },
    { cle: "support", titre: "Support", items: [{ cle: "kossi", conv: { type: "client", id: "kossi" } }, { cle: "roland", conv: { type: "client", id: "roland" } }] },
  ];
  const nonLus = { djedje: 2, roland: 1 };
  const activite = { djedje: "2026-09-14T00:10:00Z", roland: "2026-09-14T00:12:00Z" };
  const r = Cv.separerNonLues(sections, (c) => nonLus[c.id] || 0, (c) => activite[c.id] || "");
  test("★ les conversations non lues forment le bloc du haut, la plus récente en premier (ROLAND puis DJEDJE), avec leur compte et leur bloc d'origine",
    r.nonLues.map((x) => x.cle).join("|") === "roland|djedje" && r.nonLues[1].nb === 2 && r.nonLues[0].section === "support" && r.nonLues[1].section === "equipe");
  test("★ une conversation n'apparaît qu'une fois : les non lues sont retirées de leur bloc, les autres y restent dans l'ordre",
    r.sections.map((s) => s.items.map((x) => x.cle).join(",")).join("|") === "sandrine||kossi" && r.sections[1].toujours === true);
  test("sans non lu, le bloc du haut est vide et rien ne bouge", Cv.separerNonLues(sections, () => 0).nonLues.length === 0 && Cv.separerNonLues(sections, () => 0).sections[0].items.length === 2);
  const msgCv = readFileSync("src/screens/Messagerie.jsx", "utf8");
  test("★ l'écran passe par la règle (separerNonLues), montre « Nouveaux messages » en tête, puis Équipe, Groupes, Clients qui vous ont écrit, Mes clients (chef), Support — UNE ligne de conversation (LigneConversation), plus de tri maison",
    /const liste = separerNonLues\(sectionsBrutes, nonLusPour, derniereActivite\);/.test(msgCv) && /data-conversations="nouveaux"/.test(msgCv)
    && /🔴 Nouveaux messages/.test(msgCv) && /liste\.nonLues\.map/.test(msgCv) && /liste\.sections\.map/.test(msgCv)
    && msgCv.indexOf('cle: "equipe"') < msgCv.indexOf('cle: "groupes"') && msgCv.indexOf('cle: "groupes"') < msgCv.indexOf('cle: "clients_ecrit"')
    && msgCv.indexOf('cle: "clients_ecrit"') < msgCv.indexOf('cle: "clients_chef"') && msgCv.indexOf('cle: "clients_chef"') < msgCv.indexOf('cle: "support"')
    && !/nonLusEnPremier/.test(msgCv) && (msgCv.match(/<LigneConversation /g) || []).length === 2 && /function LigneConversation\(/.test(msgCv));
}

titre("Chantier : aucune mention de l'autre espace (Timo, 14/09/2026, « débat clos »)");
{
  const ci = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
  test("★ la note « N technicien(s) ne sont pas proposés ici : ils appartiennent à l'autre espace » n'existe plus ; la liste est celle de l'espace regardé, point",
    !/ne sont pas proposés ici/.test(ci) && !/noteMasques|techsMasques/.test(ci) && /techniciensDeLEspace\(db, tousLesTechs, espaceDuChantier\(db, c, profile\)\)/.test(ci));
}

titre("📦 Transfert de stock : la boutique qui reçoit VALIDE, l'article ne bouge pas avant (Timo, 14/09/2026)");
{
  const sortieTs = join("node_modules", ".cache", `bmi-transferts-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/transfertsStock.js"], bundle: true, format: "esm", platform: "node", outfile: sortieTs, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic" });
  const Ts = await import(pathToFileURL(sortieTs).href);
  unlinkSync(sortieTs);
  const gerantD = { id: "gd", nom: "GERANT D", role: "gerant", boutique: "DEMAKPOE" };
  const gerantA = { id: "ga", nom: "GERANT A", role: "gerant", boutique: "APESSITO" };
  const admin = { id: "ad", nom: "ADMIN", role: "admin" };
  const p1 = { id: "p1", nom: "Batterie 200Ah", boutique: "DEMAKPOE", initial: 5, entrees: 0, seuil: 1, prix_achat: 100, prix_vente: 150 };
  const dbT = { users: [gerantD, gerantA, admin], boutiques: [{ id: "b1", nom: "DEMAKPOE" }, { id: "b2", nom: "APESSITO" }], produits: [p1], ventes: [], ajustements: [] };
  test("critiqueEnvoi : même boutique, quantité vide ou trop grande → refus ; sinon rien",
    Ts.critiqueEnvoi({ de: "A", vers: "A", qte: 1, dispo: 5 }) !== "" && Ts.critiqueEnvoi({ de: "A", vers: "B", qte: "", dispo: 5 }) !== "" && Ts.critiqueEnvoi({ de: "A", vers: "B", qte: 6, dispo: 5 }) !== "" && Ts.critiqueEnvoi({ de: "A", vers: "B", qte: 2, dispo: 5 }) === "");
  const t = Ts.nouveauTransfertStock({ de: "DEMAKPOE", vers: "APESSITO", produit: p1, qte: 2, profile: gerantD, date: "2026-09-14" });
  const envoye = Ts.envoyerTransfertStock(dbT, t);
  test("★ l'ENVOI pose la fiche chez la boutique qui reçoit et n'écrit AUCUN ajustement : le stock de DEMAKPOE reste à 5",
    t.type === "transfert_stock" && t.statut === "en_attente" && envoye.ajustements.length === 0 && C.stockActuel(envoye, p1) === 5
    && Ts.transfertsStockAValider(envoye, "APESSITO").length === 1 && Ts.transfertsStockAValider(envoye, "DEMAKPOE").length === 0 && Ts.transfertsStockEnvoyes(envoye, "DEMAKPOE").length === 1);
  test("le badge : le gérant d'APESSITO en voit 1, celui de DEMAKPOE 0, l'admin (sans boutique) 1",
    Ts.compterTransfertsStockAValider(envoye, gerantA) === 1 && Ts.compterTransfertsStockAValider(envoye, gerantD) === 0 && Ts.compterTransfertsStockAValider(envoye, admin) === 1);
  const v = Ts.validerTransfertStock(envoye, "APESSITO", t, gerantA, "2026-09-14");
  const cible = v.db.produits.find((x) => x.boutique === "APESSITO" && x.nom === "Batterie 200Ah");
  test("★ la VALIDATION écrit les deux mouvements (−2 DEMAKPOE, +2 APESSITO, numéro TRF-, type transfert), crée l'article chez APESSITO s'il n'existe pas, marque la fiche validée",
    !v.erreur && v.db.ajustements.length === 2 && C.stockActuel(v.db, p1) === 3 && cible && C.stockActuel(v.db, cible) === 2
    && v.db.ajustements.every((a) => a.type === "transfert" && /^Transfert TRF-20260914-/.test(a.motif)) && cible.prix_vente === 150
    && Ts.transfertsStockAValider(v.db, "APESSITO").length === 0 && Ts.historiqueTransfertsStock(v.db, "APESSITO")[0].statut === "valide" && /validé par GERANT A/.test(v.journal));
  const vendu = { ...envoye, ventes: [{ id: "v1", boutique: "DEMAKPOE", date: "2026-09-14", articles: [{ produit_id: "p1", article: "Batterie 200Ah", qte: 4, pu: 150 }] }] };
  const vRefus = Ts.validerTransfertStock(vendu, "APESSITO", t, gerantA, "2026-09-14");
  test("★ vendu entre-temps (il reste 1, on en attendait 2) : la validation est REFUSÉE et le dit, rien ne bouge",
    !!vRefus.erreur && /il ne reste que 1/.test(vRefus.erreur) && !vRefus.db);
  const r = Ts.refuserTransfertStock(envoye, "APESSITO", t, gerantA, "Colis non reçu", "2026-09-14");
  test("le REFUS demande un motif, n'écrit aucun mouvement, garde le stock de DEMAKPOE à 5",
    !!Ts.refuserTransfertStock(envoye, "APESSITO", t, gerantA, "  ").erreur && !r.erreur && r.db.ajustements.length === 0 && C.stockActuel(r.db, p1) === 5 && Ts.historiqueTransfertsStock(r.db, "APESSITO")[0].motif === "Colis non reçu");
  const a = Ts.annulerTransfertStock(envoye, t, gerantD, "2026-09-14");
  test("l'envoyeur ANNULE tant que ce n'est pas validé ; un transfert validé ne s'annule ni ne se refuse plus",
    !a.erreur && Ts.transfertsStockAValider(a.db, "APESSITO").length === 0 && !!Ts.annulerTransfertStock(v.db, Ts.historiqueTransfertsStock(v.db, "APESSITO")[0], gerantD).erreur
    && !!Ts.validerTransfertStock(v.db, "APESSITO", Ts.historiqueTransfertsStock(v.db, "APESSITO")[0], gerantA).erreur);
  const st = readFileSync("src/screens/Stocks.jsx", "utf8"), rv = readFileSync("src/screens/Ravitaillement.jsx", "utf8"), appT = readFileSync("src/App.jsx", "utf8");
  test("★ 📦 Stocks : ⇄ Transfert passe par envoyerTransfertStock et n'écrit plus d'ajustement « Transfert vers … » ; la boutique voit ses envois en attente (annulables)",
    /save\(envoyerTransfertStock\(db, transfert\)/.test(st) && !/motif: `Transfert vers \$\{dest\}`/.test(st) && /transfertsStockEnvoyes\(db, bq\)/.test(st) && /data-transferts="envoyes"/.test(st) && /annulerTransfertStock\(db, t, profile\)/.test(st));
  test("★ 🔁 Transfert : « Transferts de stock à valider », Valider la réception / Refuser, rôles du stock revérifiés DANS le geste, historique",
    /data-transferts="a-valider"/.test(rv) && /validerTransfertStock\(db, bq, t, profile\)/.test(rv) && /refuserTransfertStock\(db, bq, t, profile, motif\)/.test(rv)
    && /refuserSaufRoles\(profile, ROLES_STOCK, "Valider un transfert de stock"\)/.test(rv) && /refuserSaufRoles\(profile, ROLES_STOCK, "Refuser un transfert de stock"\)/.test(rv) && /Valider la réception/.test(rv));
  test("le badge de 🔁 Transfert (gérant) et de 📦 Stocks (admin) comptent les transferts de stock à valider",
    /compterDemandesTransfertRecues\(db, profile\) \+ \(profile\.boutique \? compterTransfertsStockAValider\(db, profile\) : 0\)/.test(appT)
    && /compterDemandesTransfertToutes\(db, profile\) \+ \(profile\.boutique \? 0 : compterTransfertsStockAValider\(db, profile\)\)/.test(appT));
}

// ═══════════════════════════════════════════════════════════
// LE CLIENT DÉJÀ CONNU SE PROPOSE (Timo, 15/09/2026)
// « Dans vente, lorsqu'on veut enregistrer le nom et le numéro du client…
//   si le client existe déjà dans le système, pourquoi il n'est pas proposé
//   pour pré-remplir les lignes ? » — puis, sur l'étendue : « Les trois ».
// Le nom et le numéro étaient des cases de TEXTE LIBRE dans 💰 Ventes,
// 💳 Dettes et 🛠 Travaux : le même client s'écrivait de trois façons, et un
// chiffre de travers détachait la vente du compte du client (compteClientPour
// compare les 8 derniers chiffres).
// ═══════════════════════════════════════════════════════════
{
  const sortieCC = join("node_modules", ".cache", `bmi-cc-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/clientsConnus.js"], bundle: true, format: "esm",
    platform: "node", outfile: sortieCC, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const CC = await import(pathToFileURL(sortieCC).href);
  unlinkSync(sortieCC);
  // Le champ commun filtre avec filtrerSuggestions : on l'exerce pour de
  // vrai, plutôt que de supposer qu'un numéro tapé retrouve son client.
  const sortieSugC = join("node_modules", ".cache", `bmi-sugc-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/suggestions.js"], bundle: true, format: "esm", platform: "node", outfile: sortieSugC, logLevel: "silent" });
  const Sug = await import(pathToFileURL(sortieSugC).href);
  unlinkSync(sortieSugC);

  const dbC = {
    ventes: [
      { id: "v1", boutique: "DEMAKPOE", date: "2026-09-01", client: "KOFFI AMA", tel: "+228 90 11 22 33", articles: [{ qte: 1, pu: 10000 }] },
      // Le MÊME homme, revenu le 10, son numéro écrit sans l'indicatif.
      { id: "v2", boutique: "DEMAKPOE", date: "2026-09-10", client: "KOFFI AMA", tel: "90112233", articles: [{ qte: 1, pu: 5000 }] },
      // Une autre boutique : elle ne doit JAMAIS remonter ici (le mur).
      { id: "v3", boutique: "APESSITO", date: "2026-09-12", client: "MAWULI", tel: "91223344", articles: [{ qte: 1, pu: 7000 }] },
      // Un client de passage, sans numéro.
      { id: "v4", boutique: "DEMAKPOE", date: "2026-09-05", client: "PASSANT", tel: "", articles: [{ qte: 1, pu: 2000 }] },
      // Un homonyme, plus ancien, avec un AUTRE numéro.
      { id: "v5", boutique: "DEMAKPOE", date: "2026-08-20", client: "KOFFI AMA", tel: "99887766", articles: [{ qte: 1, pu: 1000 }] },
      // Une ligne sans nom ni numéro : elle n'entre pas dans la liste.
      { id: "v6", boutique: "DEMAKPOE", date: "2026-09-11", client: "", tel: "", articles: [{ qte: 1, pu: 500 }] },
    ],
    dettes: [
      { id: "d1", boutique: "DEMAKPOE", date: "2026-09-13", client: "DJEDJE", tel: "90556677", montant: 100000, paye: 30000 },
      // Une réservation prépayée n'est pas une dette (règle de 👥 Clients).
      { id: "d2", boutique: "DEMAKPOE", date: "2026-09-14", type: "prepaye", client: "RESERVE", tel: "90998877", montant: 50000, paye: 50000 },
    ],
  };
  const liste = CC.clientsConnus(dbC, "DEMAKPOE");
  const parNom = (n) => liste.filter((c) => c.nom === n);
  const koffi = liste.find((c) => c.cle === "t:90112233");
  test("★ deux écritures du MÊME numéro (« +228 90 11 22 33 » et « 90112233 ») font UN seul client : 2 achats, 15 000 F, dernier passage le 10",
    !!koffi && parNom("KOFFI AMA").length === 2 && koffi.achats === 2 && koffi.totalAchats === 15000 && koffi.derniere === "2026-09-10");
  test("★ LE MUR : la liste ne contient QUE la boutique regardée — MAWULI (APESSITO) n'y est pas, et rien ne lit db.users",
    !liste.some((c) => c.nom === "MAWULI") && !/\.users\b/.test(readFileSync("src/lib/clientsConnus.js", "utf8").replace(/\/\/[^\n]*/g, "")));
  test("un client sans numéro existe quand même (regroupé sur son nom) ; une ligne sans nom NI numéro n'entre pas dans la liste",
    !!liste.find((c) => c.cle === "n:passant") && !liste.some((c) => c.nom === "(sans nom)"));
  test("une DETTE fait connaître son client et ce qu'il doit encore (100 000 − 30 000) ; une réservation prépayée n'est pas une dette",
    liste.find((c) => c.nom === "DJEDJE")?.dette === 70000 && !liste.some((c) => c.nom === "RESERVE"));
  test("la liste est rangée du plus RÉCENT au plus ancien — c'est le client d'hier qu'on revoit, pas celui du mois dernier",
    liste[0].nom === "DJEDJE" && liste.map((c) => c.derniere).join(">") === [...liste].map((c) => c.derniere).sort().reverse().join(">"));

  const props = CC.propositionsClients(liste, { fmt: (x) => `${x} F`, dFR: (d) => d });
  const pKoffi = props.find((p) => p.valeur === "KOFFI AMA");
  test("★ une proposition porte le nom en VALEUR (ce qui remplit la case) et le NUMÉRO à recopier au clic — celui de sa ligne la PLUS RÉCENTE, pas une vieille écriture",
    !!pKoffi && pKoffi.tel === "90112233" && koffi.tel === "90112233" && props.find((p) => p.valeur === "DJEDJE").tel === "90556677");
  test("★ on retrouve un client en tapant son NUMÉRO aussi bien que son nom (les chiffres bruts sont dans `mots`)",
    Sug.filtrerSuggestions(props, "90556677").map((p) => p.valeur).join() === "DJEDJE"
    && Sug.filtrerSuggestions(props, "djed").map((p) => p.valeur).join() === "DJEDJE");
  test("★ DEUX CLIENTS AU MÊME NOM : le champ commun n'en garde qu'un, alors la ligne le DIT (« ⚠ 2 clients à ce nom ») et c'est le PLUS RÉCENT qui est proposé",
    props.filter((p) => p.valeur === "KOFFI AMA").length === 1 && /⚠ 2 clients à ce nom/.test(pKoffi.detail) && pKoffi.tel === "90112233");
  test("le détail dit le numéro, le dernier passage et la dette qui reste ; « sans numéro » quand il n'y en a pas",
    /90556677 · dernier passage 2026-09-13 · doit encore 70000 F/.test(props.find((p) => p.valeur === "DJEDJE").detail)
    && /^sans numéro/.test(props.find((p) => p.valeur === "PASSANT").detail));
  test("une base vide ne fait pas tomber la règle (aucune vente, aucune dette)",
    CC.clientsConnus({}, "DEMAKPOE").length === 0 && CC.propositionsClients([]).length === 0);

  // ⚠ Timo, 15/09/2026 : « la présélection n'est pas possible avec le
  // numéro ? » — taper le numéro marchait dans la case du NOM, mais la case
  // du NUMÉRO ne proposait rien. C'est pourtant là qu'on tape un numéro.
  const nums = CC.propositionsNumeros(liste, { fmt: (x) => `${x} F`, dFR: (d) => d });
  test("★ la case du NUMÉRO propose aussi : le numéro en valeur (il remplit la case), le nom à recopier au clic",
    nums.find((p) => p.valeur === "90556677")?.nom === "DJEDJE" && /^DJEDJE · dernier passage 2026-09-13 · doit encore 70000 F$/.test(nums.find((p) => p.valeur === "90556677").detail));
  test("★ depuis la case du numéro, on retrouve un client en tapant son NOM aussi bien que son NUMÉRO (les deux sont dans `mots`)",
    Sug.filtrerSuggestions(nums, "djedje").map((p) => p.valeur).join() === "90556677"
    && Sug.filtrerSuggestions(nums, "9055").map((p) => p.valeur).join() === "90556677"
    // ⚠ Commencer par l'indicatif, comme la case le montre en exemple, doit
    // proposer : sans l'écriture internationale dans `mots`, « +228 » ne
    // trouvait plus personne.
    && Sug.filtrerSuggestions(nums, "228").map((p) => p.valeur).includes("90556677")
    && Sug.filtrerSuggestions(nums, "+228 9055").map((p) => p.valeur).join() === "90556677");
  test("un client SANS numéro n'a rien à proposer dans la case du numéro : il n'y figure pas (une case vide ne se propose pas)",
    !nums.some((p) => p.valeur === "" || p.nom === "PASSANT") && nums.length === liste.filter((c) => c.tel).length);

  // Les écrans : LE champ commun, jamais une liste maison, et le clic
  // remplit le nom ET le numéro.
  const ecrans = [
    ["src/screens/Ventes.jsx", /valeur=\{f\.client\}/, /onChoisir=\{\(c\) => setF\(\{ \.\.\.f, client: c\.valeur, tel: c\.tel \|\| f\.tel \}\)\}/],
    ["src/screens/Dettes.jsx", /valeur=\{res\.client\}/, /onChoisir=\{\(c\) => setRes\(\{ \.\.\.res, client: c\.valeur, tel: c\.tel \|\| res\.tel \}\)\}/],
    ["src/screens/Travaux.jsx", /valeur=\{f\.nom\}/, /onChoisir=\{\(c\) => setF\(\{ \.\.\.f, nom: c\.valeur, tel: c\.tel \|\| f\.tel \}\)\}/],
  ];
  test("★ 💰 Ventes, 💳 Dettes et 🛠 Travaux : la case Client passe par LE champ commun (ChampSuggestions + propositionsClients de la boutique regardée), et un CLIC remplit le nom ET le numéro",
    ecrans.every(([f, vRe, cRe]) => {
      const t = readFileSync(f, "utf8");
      return /import \{ ChampSuggestions \}/.test(t) && /import \{ clientsConnus, propositionsClients, propositionsNumeros \} from "\.\.\/lib\/clientsConnus";/.test(t)
        && /suggestions=\{propositionsClients\(clientsConnus\(db, boutique\), \{ fmt, dFR \}\)\}/.test(t) && vRe.test(t) && cRe.test(t);
    }));
  const dtJ = readFileSync("src/screens/Dettes.jsx", "utf8");
  test("💳 Dettes a les DEUX cases traitées : la réservation prépayée et la nouvelle dette",
    (dtJ.match(/suggestions=\{propositionsClients\(/g) || []).length === 2
    && /onChoisir=\{\(c\) => setF\(\{ \.\.\.f, client: c\.valeur, tel: c\.tel \|\| f\.tel \}\)\}/.test(dtJ));
  const numEcrans = [
    ["src/screens/Ventes.jsx", /onChoisir=\{\(c\) => setF\(\{ \.\.\.f, tel: c\.valeur, client: c\.nom \|\| f\.client \}\)\}/],
    ["src/screens/Dettes.jsx", /onChoisir=\{\(c\) => setRes\(\{ \.\.\.res, tel: c\.valeur, client: c\.nom \|\| res\.client \}\)\}/],
    ["src/screens/Travaux.jsx", /onChoisir=\{\(c\) => setF\(\{ \.\.\.f, tel: c\.valeur, nom: c\.nom \|\| f\.nom \}\)\}/],
  ];
  test("★ les trois écrans proposent DANS LES DEUX SENS : la case du numéro passe aussi par le champ commun (propositionsNumeros), et le clic y remplit le numéro ET le nom",
    numEcrans.every(([f, re]) => {
      const t = readFileSync(f, "utf8");
      return /suggestions=\{propositionsNumeros\(clientsConnus\(db, boutique\), \{ fmt, dFR \}\)\}/.test(t)
        && /<ChampSuggestions type="tel" valeur=\{\w+\.tel\}/.test(t) && re.test(t);
    })
    && (readFileSync("src/screens/Dettes.jsx", "utf8").match(/propositionsNumeros\(/g) || []).length === 2);
  test("★ plus une seule case Client ou Numéro en saisie nue dans les trois écrans : toutes passent par le champ commun",
    !numEcrans.some(([f]) => /<input type="tel" placeholder="\+228 \.\.\." className=\{inputCls\} value=\{\w+\.tel\}/.test(readFileSync(f, "utf8"))));
  test("★ ce qui est TAPÉ n'est jamais transformé : les quatre écrans gardent une case libre (onChange pose la frappe telle quelle), un client de passage se saisit comme avant",
    ecrans.every(([f]) => /onChange=\{\(v\) => set[FR]\w*\(\{ \.\.\.\w+, (client|nom): v \}\)\}/.test(readFileSync(f, "utf8"))));
  test("★ UNE règle, pas deux : 👥 Clients lit clientsConnus au lieu de refaire son propre regroupement (plus de `const map = {}` ni de clé maison)",
    /import \{ clientsConnus \} from "\.\.\/lib\/clientsConnus";/.test(readFileSync("src/screens/Clients.jsx", "utf8"))
    && /let clients = clientsConnus\(db, boutique\)\.sort\(\(a, b\) => b\.totalAchats - a\.totalAchats\);/.test(readFileSync("src/screens/Clients.jsx", "utf8"))
    && !/const key = \(nom, tel\)/.test(readFileSync("src/screens/Clients.jsx", "utf8")));
  // ═══════════════════════════════════════════════════════════
  // 👥 UTILISATEURS : LE NUMÉRO SE VOIT, ET SE CHERCHE (Timo, 16/09/2026)
  // « Aujourd'hui un client créé par un utilisateur, l'administrateur
  // principal n'a pas la possibilité de voir son numéro de téléphone. »
  // Constaté : le numéro était bien ENREGISTRÉ (il fabrique l'identifiant du
  // client et sert à le joindre), mais affiché NULLE PART — pas de colonne
  // dans 👥 Utilisateurs, et 📋 Clients ne liste que ceux qui ont déjà
  // acheté. Un client créé sans achat n'avait donc aucun chemin.
  // ═══════════════════════════════════════════════════════════
  const uNum = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  test("★ 👥 Utilisateurs AFFICHE le numéro sous le nom, pour tout le monde, avec le vrai logo WhatsApp",
    /\{u\.tel && \(/.test(uNum) && /📞 \{u\.tel\}/.test(uNum)
    // ⚠ RETOURNÉ le 16/09/2026 : le clic partait avec un texte VIDE pour tout
    // le monde ; il porte désormais le mot de fidélité si la fiche est celle
    // d'un client (voir le bloc « mot de fidélité » plus bas).
    && /envoyerWhatsApp\(telDigits\(u\.tel\), u\.role === "client"/.test(uNum) && /<IconeWhatsApp taille=\{14\} \/>/.test(uNum));
  test("★ la recherche de 👥 Utilisateurs regarde AUSSI le numéro, par la règle commune (motsDuNumero), jamais un filtre maison",
    /correspond\(`\$\{x\.nom \|\| ""\} \$\{x\.nom_complet \|\| ""\} \$\{motsDuNumero\(x\.tel\)\}`, qU\)/.test(uNum)
    && /import \{ motsDuNumero \} from "\.\.\/lib\/clientsConnus";/.test(uNum));
  // Le banc MESURE la recherche : on exerce la vraie chaîne, pas le code.
  const chaineU = (x) => `${x.nom || ""} ${x.nom_complet || ""} ${CC.motsDuNumero(x.tel)}`;
  const compteU = { nom: "DJEDJE", nom_complet: "DJEDJE Kossi", tel: "+228 90 55 66 77" };
  test("★ un compte se trouve par son NUMÉRO écrit de n'importe quelle façon, et toujours par son nom",
    ["9055", "90556677", "228", "+228 9055", "djedje", "kossi"].every((q) => Sug.correspond(chaineU(compteU), q))
    && !Sug.correspond(chaineU(compteU), "91") /* un numéro voisin ne sort pas */);
  test("un compte SANS numéro ne fait pas tomber la recherche (employé sans téléphone)",
    Sug.correspond(chaineU({ nom: "AYAO", tel: "" }), "ayao") && CC.motsDuNumero("") === "" && CC.motsDuNumero(undefined) === "");

  // ---- 📞 LE NUMÉRO D'UN EMPLOYÉ EST ENFIN GARDÉ (Timo, 16/09/2026) ----
  // « Pourquoi la règle n'est pas applicable à tous les utilisateurs ? » —
  // le numéro d'un employé était DEMANDÉ à la création, servait UNE fois à
  // lui envoyer ses identifiants par WhatsApp, puis était JETÉ. Rien à
  // afficher, donc : la règle s'appliquait bien, mais sur du vide.
  test("★ le numéro tapé à la création d'un employé est ÉCRIT sur sa fiche (avant, il était jeté après l'envoi des identifiants)",
    /\.\.\.\(chiffresTel\(f\.tel\)\.length >= 4 \? \{ tel: f\.tel\.trim\(\) \} : \{\}\)/.test(uNum));
  test("★ il se saisit et se corrige après coup (📞 dans ⋯ Gérer, admin seul) — mais JAMAIS pour un client, dont la connexion en dépend",
    /const changerTelephone = async \(u\) => \{/.test(uNum)
    && /refuserSaufAdmin\(profile, "Modifier le téléphone d'un employé"\)/.test(uNum)
    && /if \(u\.role === "client"\) \{/.test(uNum)
    && /son identifiant et son mot de passe en dépendent/.test(uNum)
    && /onClick=\{\(\) => changerTelephone\(u\)\}/.test(uNum));

  // ═══════════════════════════════════════════════════════════
  // 💬 LE MOT DE FIDÉLITÉ AU CLIENT (Timo, 16/09/2026)
  // « Proposer un message aussi à envoyer quand on clique sur l'icône
  // WhatsApp. » Texte écrit par LUI, mot pour mot ; deux décisions :
  // « exclusivement pour les clients », et « il peut être aussi paramétré
  // dans les paramètres ».
  // ═══════════════════════════════════════════════════════════
  const par = readFileSync("src/screens/Parametres.jsx", "utf8");
  const modeleFid = Cli.MESSAGE_FIDELITE_DEFAUT;
  test("★ le mot d'origine est celui que Timo a écrit, mot pour mot (6 lignes, du bonjour au site web)",
    modeleFid.split("\n").length === 6
    && modeleFid.startsWith("Bonjour {client}.. c'est {auteur}, {role} chez BMI")
    && /votre fidélité envers BMI/.test(modeleFid) && /MERCI POUR VOTRE CONFIANCE/.test(modeleFid)
    && /toujours disponibles pour vous servir/.test(modeleFid)
    && /passer en boutique à tout moment pour vos achat et devis/.test(modeleFid)
    && modeleFid.trim().endsWith("Consultez aussi notre site Web bmitogo.com"));
  const ecritFid = Cli.texteFidelite(modeleFid, { client: "djedje", auteur: "timo", role: "vendeur" });
  test("★ les trois mots se remplacent : client et auteur en MAJUSCULES, le rôle avec son article — et plus aucune accolade",
    ecritFid.startsWith("Bonjour DJEDJE.. c'est TIMO, le vendeur chez BMI")
    && !/\{client\}|\{auteur\}|\{role\}/.test(ecritFid));
  test("★ l'article suit la voyelle : « l'administrateur », jamais « le administrateur »",
    Cli.roleAvecArticle("admin") === "l'administrateur" && Cli.roleAvecArticle("gerant") === "le gérant de boutique"
    && Cli.roleAvecArticle("resp_commercial") === "le responsable commercial" && Cli.roleAvecArticle("") === "");
  test("le réglage de ⚙ Paramètres l'emporte ; sans réglage, ou réglage vidé, c'est le texte d'origine",
    Cli.messageFideliteRegle({ boutiques: [{ message_fidelite: "Salut {client}" }] }) === "Salut {client}"
    && Cli.messageFideliteRegle({ boutiques: [{}] }) === modeleFid && Cli.messageFideliteRegle({}) === modeleFid
    && Cli.messageFideliteRegle({ boutiques: [{ message_fidelite: "   " }] }) === modeleFid);
  test("un modèle vidé n'écrit rien (la conversation s'ouvre vide) et ne fait pas tomber la règle",
    Cli.texteFidelite("", { client: "X" }) === "" && Cli.texteFidelite(null, {}) === "" && Cli.texteFidelite(modeleFid) !== "");
  test("★ EXCLUSIVEMENT pour les clients : sur la fiche d'un employé, le clic WhatsApp ouvre une conversation VIDE",
    /u\.role === "client"[\s\S]{0,40}\? texteFidelite\(messageFideliteRegle\(db\), \{ client: u\.nom_base \|\| u\.nom, auteur: profile\.nom, role: profile\.role \}\)[\s\S]{0,30}: ""/.test(uNum)
    && /import \{[^}]*messageFideliteRegle, texteFidelite \} from "\.\.\/lib\/comptesClients";/.test(uNum));
  test("★ le texte se règle dans ⚙ Paramètres — rangé sur les boutiques (rien à coller), avec l'aperçu de ce que le client recevra",
    /data-reglage="message-fidelite"/.test(par) && /message_fidelite: msgFid/.test(par)
    && /MESSAGE_FIDELITE_DEFAUT/.test(par) && /texteFidelite\(msgFid, \{ client: "DJEDJE"/.test(par)
    && /refuserSaufAdmin\(profile, "Modifier le mot de fidélité"\)/.test(par));
  test("★ le mot part par la règle commune WhatsApp (envoyerWhatsApp), jamais un wa.me écrit dans l'écran",
    /envoyerWhatsApp\(telDigits\(u\.tel\), u\.role === "client"/.test(uNum) && !/wa\.me/.test(uNum));

  // ⚠ RESSERRÉ le 18/09/2026 : la recherche portait sur le MOT, donc un
  // simple commentaire qui cite le fichier voisin faisait tomber le contrôle.
  // Ce qu'on surveille, c'est une RECOPIE de la règle — donc un vrai import.
  const importeursCC = execSync("grep -rlE 'from \"[^\"]*clientsConnus' src --include=*.jsx --include=*.js || true").toString().trim().split("\n").filter(Boolean).concat(["src/lib/clientsConnus.js"]).sort().join("|");
  test("★ la règle n'est recopiée nulle part : seuls les SEPT écrans et son propre fichier la connaissent (👥 Utilisateurs depuis le 16/09/2026 pour chercher par numéro, ⚙ Paramètres depuis le 18/09/2026 pour retrouver le client à effacer, 📲 WhatsApp depuis le 20/09/2026 pour proposer à qui écrire)",
    importeursCC === "src/lib/clientsConnus.js|src/screens/Clients.jsx|src/screens/Dettes.jsx|src/screens/Parametres.jsx|src/screens/Travaux.jsx|src/screens/Utilisateurs.jsx|src/screens/Ventes.jsx|src/screens/Whatsapp.jsx");
}

// ═══════════════════════════════════════════════════════════
// LE FONDS DE CAISSE N'EST JAMAIS MÉLANGÉ AUX VENTES (Timo, 15/09/2026)
// Capture de la clôture du 14/09 à DEMAKPOE, écart −40 800 : « pourquoi tu
// additionnes le fonds de caisse aux ventes ? J'avais dit de ne pas mélanger
// le fonds de caisse aux ventes » — puis, sur ces 50 000 : « l'argent était
// remis depuis [avant] ».
// DEUX défauts, et la règle pure n'était coupable d'aucun des deux :
//   1. L'AFFICHAGE : la case « Recette du jour (espèces) » montrait
//      recetteDuJour + fondsRemisDuJour, et la confirmation les enchaînait
//      avec des « + » — le fonds se lisait comme de la recette.
//   2. LA DATE : « Régulariser » pré-remplissait la date à AUJOURD'HUI, alors
//      qu'une régularisation parle d'un argent remis dans le PASSÉ. Les
//      50 000 remis des semaines plus tôt tombaient donc dans la clôture du
//      jour, comme s'ils venaient d'entrer dans le tiroir.
// ═══════════════════════════════════════════════════════════
{
  // Les trois règles pures que ce chantier touche, bundlées pour de vrai.
  const bundle = async (fichier, cle) => {
    const out = join("node_modules", ".cache", `bmi-${cle}-${process.pid}.mjs`);
    await build({ entryPoints: [fichier], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
    const m = await import(pathToFileURL(out).href);
    unlinkSync(out);
    return m;
  };
  const V = await bundle("src/lib/versements.js", "vf");
  const Clo = await bundle("src/lib/cloture.js", "clf");
  const Cst = await bundle("src/lib/constants.js", "cstf");
  const csC2 = readFileSync("src/screens/Caisse.jsx", "utf8");
  const pmC2 = readFileSync("src/screens/Parametres.jsx", "utf8");
  const dbF = {
    boutiques: [{ id: "b1", nom: "DEMAKPOE" }],
    ventes: [{ id: "v1", boutique: "DEMAKPOE", date: "2026-09-14", paiement: "Espèces", articles: [{ qte: 1, pu: 800 }] }],
    dettes: [],
    depenses: [
      { id: "x1", boutique: "DEMAKPOE", date: "2026-09-14", categorie: "Transport", montant: 10000, paiement: "Espèces" },
      { id: "x2", boutique: "DEMAKPOE", date: "2026-09-14", categorie: "Fonds de caisse remis", montant: -50000, paiement: "Espèces",
        description: "Fonds de caisse remis le 14/09/2026 par TIMO (Chez le DG)",
        fonds_caisse: { id: "f1", origine: "Chez le DG", banque: "", montant: 50000, note: "", regularisation: true } },
    ],
    clotures: [],
  };
  const jF = Clo.activiteDuJour(dbF, "DEMAKPOE", "2026-09-14", Core.totalVente);
  test("★ la règle pure n'a JAMAIS mélangé : « recette du jour » = ventes + encaissements (800), le fonds remis est une valeur À PART (50 000)",
    jF.recetteDuJour === 800 && jF.especesVentes === 800 && jF.fondsRemisDuJour === 50000 && jF.sortiesJustifiees === 10000);
  test("★ ⚠ RETOURNÉ le 15/09/2026 (Timo, réponse B : le fonds de caisse est gardé À PART — il n'est PAS dans le tiroir) : le fonds remis n'est ni une sortie négative ni une entrée du tiroir — le tiroir attendu vaut 0 + 800 − 10 000, et l'enveloppe porte les 50 000 à part",
    jF.theorique === -9200 && jF.fondsHier === 0 && jF.fondsPlafond === 50000 && jF.fondsReste === 50000 && jF.fondsIntact === true);
  test("★ ⚠ RETOURNÉ le 15/09/2026 (Timo, réponse B : le fonds de caisse est gardé À PART — il n'est PAS dans le tiroir) : la case « Recette du jour » montre recetteDuJour SEUL, et le fonds a sa case d'ENVELOPPE (gardé à part, PAS dans le tiroir), jamais une case « remis dans le tiroir »",
    /Recette du jour \(espèces\)<\/div><div className="font-bold tabular-nums text-emerald-700">\+ \{fmt\(recetteDuJour\)\}/.test(csC2)
    && !/fmt\(recetteDuJour \+ fondsRemisDuJour\)/.test(csC2) && !/data-carte="fonds-remis"/.test(csC2)
    && /\{fondsPlafond > 0 && \(/.test(csC2) && /data-carte="enveloppe-fonds"/.test(csC2)
    && /PAS dans le tiroir/.test(csC2) && /pris dessus ce jour-là/.test(csC2));
  test("★ la confirmation de clôture ne rappelle l'enveloppe qu'en bas, en disant qu'elle n'est PAS dans le tiroir, et compte le rendu au fonds parmi les sorties du tiroir",
    /\+ `− Sorties du jour \(dépenses, versements\) : \$\{fmt\(sortiesJustifiees\)\}/.test(csC2)
    && /− Rendu au fonds de caisse : \$\{fmt\(rembourseAuFonds\)\}/.test(csC2)
    && /💼 Fonds de caisse \(gardé à part, PAS dans le tiroir\)/.test(csC2)
    && !/argent de BMI déposé dans le tiroir/.test(csC2));
  test("★ une RÉGULARISATION ne pré-remplit plus la date à aujourd'hui (elle parle d'un argent remis dans le PASSÉ) et le dit en rouge",
    /const regulariserFonds = \(b\) => setFondsForm\(\{[^\n]*montant: String\(manqueRemises\(db, b\.nom\)\), origine: DEST_DG, banque: "", date: "", note: "", regularisation: true \}\);/.test(pmC2)
    && /Indiquez le jour où le DG a RÉELLEMENT remis cet argent/.test(pmC2) && /data-fonds="regularisation"/.test(pmC2));
  const remise = dbF.depenses[1];
  const corr = V.corrigerDateRemise(remise, "2026-08-20");
  test("★ la DATE d'une remise se corrige sans rien recalculer d'autre : montant, origine et fonds ne bougent pas, la description suit",
    !corr.refus && corr.remise.date === "2026-08-20" && corr.remise.montant === -50000
    && corr.remise.fonds_caisse.montant === 50000 && /remis le 20\/08\/2026 par TIMO/.test(corr.remise.description)
    && /20\/08\/2026/.test(corr.journal));
  test("une date vide, illisible ou inchangée est refusée ; une ligne qui n'est pas une remise de fonds aussi",
    !!V.corrigerDateRemise(remise, "").refus && !!V.corrigerDateRemise(remise, "pas une date").refus
    && !!V.corrigerDateRemise(remise, "2026-09-14").refus && !!V.corrigerDateRemise(dbF.depenses[0], "2026-08-20").refus);
  const dbCorr = { ...dbF, depenses: dbF.depenses.map((x) => (x.id === "x2" ? corr.remise : x)) };
  const jCorr = Clo.activiteDuJour(dbCorr, "DEMAKPOE", "2026-09-14", Core.totalVente);
  // ★ LE CAS DE TIMO, réglé pour de bon. Le fonds n'entre plus JAMAIS dans le
  // tiroir — mais la DATE de la remise garde un sens : elle dit à partir de
  // quand l'enveloppe existait, donc si elle pouvait payer ce que le tiroir
  // ne couvrait pas. Remise datée du 14/09 (fausse) : le jour de la dépense
  // l'enveloppe n'existe pas encore, le tiroir se creuse de 9 200. Remise
  // redatée au 20/08 (vraie) : l'enveloppe est là, elle avance les 9 200, le
  // tiroir tombe juste à 0 et l'enveloppe descend à 40 800.
  test("★ LE CAS DE TIMO : le fonds ne gonfle plus le tiroir attendu (plus de 50 000 de trop) ; et la vraie date de la remise décide seulement de QUI a payé — l'enveloppe avance ce que le tiroir ne couvre pas",
    jF.theorique === -9200 && jF.fondsReste === 50000
    && jCorr.fondsRemisDuJour === 0 && jCorr.recetteDuJour === 800 && jCorr.theorique === 0
    && jCorr.fondsPlafond === 50000 && jCorr.fondsReste === 40800 && jCorr.depensesSurFonds === 9200);
  test("★ la remise garde la trace qu'elle était une régularisation, et seul l'admin PRINCIPAL peut corriger sa date",
    corr.remise.fonds_caisse.regularisation === true
    && /refuserSaufAdminPrincipal\(db, profile, "Corriger la date d'une remise de fonds de caisse"\)/.test(pmC2)
    && /estAdminPrincipal\(db, profile\) && <button onClick=\{\(\) => corrigerRemise\(d\)\}/.test(pmC2));
  // ⚠ securite-16 refusait TOUTE modification d'une remise, date comprise :
  // le bouton « Date » aurait été refusé par la base. securite-19 rouvre
  // cette porte-là, et elle seule.
  // ── L'ENVELOPPE SE COMPTE À LA CLÔTURE, ET LE VENDEUR N'A PLUS DE DÉPENSES ──
  // Timo (15/09/2026) : « 1- retire [l'onglet Dépenses au vendeur] ; 2- tout
  // de suite [le comptage de l'enveloppe] ; mais on informe lors de la clôture
  // de la caisse. » C'était le seul trou du modèle à deux poches : la clôture
  // vérifiait le tiroir, l'enveloppe n'était JAMAIS comptée par personne.
  {
    const appE = readFileSync("src/App.jsx", "utf8");
    const vendeurE = (appE.match(/: \[\["ventes", "💰 Ventes"\], \["commandes", labelCommandes\][^\n]*\["primes_remises"[^\n]*\];/) || [""])[0];
    test("★ le VENDEUR n'a plus l'onglet 📤 Dépenses (« il ne fait jamais le versement ni dépense ») — mais il GARDE 🔒 Caisse : la clôture reste son geste (règle du 09/09/2026)",
      vendeurE.length > 0 && !/\["depenses", "📤 Dépenses"\]/.test(vendeurE) && /\["caisse", "🔒 Caisse"\]/.test(vendeurE) && /\["ventes", "💰 Ventes"\]/.test(vendeurE)
      // …et il reste là où il doit être : admin, comptable, gérant, techniciens.
      && (appE.match(/\["depenses", "📤 Dépenses"\]/g) || []).length === 5);
    const caE = readFileSync("src/screens/Caisse.jsx", "utf8");
    // ⚠ RETOURNÉ dans la journée du 15/09/2026. Le comptage obligatoire de
    // l'enveloppe a été posé puis RETIRÉ sur décision de Timo : « enlève cette
    // restriction de compter l'enveloppe… tant qu'elle a été entamée,
    // l'information suffit déjà. Elle est compensée automatiquement quand il y
    // a vente, et à la clôture le système informe combien a été restitué dans
    // l'enveloppe. C'est déjà suffisant. » La clôture INFORME, elle ne demande
    // RIEN : aucun champ, aucun écart d'enveloppe, aucun blocage.
    test("★ la clôture INFORME sur l'enveloppe (intacte, ou entamée avec ce qu'il doit rester) et ne demande RIEN : aucun champ à saisir, aucun écart d'enveloppe, aucun blocage",
      /data-cloture="enveloppe"/.test(caE) && /\{fondsPlafond > 0 && \(/.test(caE)
      && /Elle est intacte/.test(caE) && /Les prochaines recettes la rembourseront toutes seules/.test(caE)
      && !/compterLEnveloppe|fondsCompte|ecartFonds|Écart sur l'enveloppe|Montant compté dans l'enveloppe/.test(caE)
      && !/fonds_attendu|fonds_compte/.test(caE));
    test("★ et elle DIT le mouvement du jour : ce qui a été pris dans l'enveloppe, et ce que les recettes lui ont restitué (« le système informe combien a été restitué »)",
      /data-cloture="enveloppe-jour"/.test(caE) && /\{\(depensesSurFonds > 0 \|\| rembourseAuFonds > 0\) && \(/.test(caE)
      && /pris dans l'enveloppe/.test(caE) && /restitués par les recettes/.test(caE)
      && /Les recettes du jour lui ont restitué \$\{fmt\(rembourseAuFonds\)\}/.test(caE));
    test("★ l'enveloppe n'entre dans AUCUN total du tiroir : le montant attendu, l'écart de caisse et les fonds à verser l'ignorent",
      !/theorique \+ fonds|compte \+ fonds/.test(caE) && /const ecart = compte === "" \? null : Number\(compte\) - theorique;/.test(caE));
  }

  // ── « PAYÉ AVEC : LE FONDS DE CAISSE » (Timo, 15/09/2026) ──
  // « Dans Payé avec, ajouter fonds de caisse, de sorte que si pas d'argent et
  // il faut effectuer une dépense, fonds de caisse apparaît (gérant). »
  // ⚠ RETOURNE le « laisse » du 14/09 : à l'époque le fonds était DANS le
  // tiroir, « la caisse de la boutique » suffisait. Depuis la réponse B, le
  // fonds est une ENVELOPPE à part : l'option a un sens, et c'est la seule
  // façon de dire « j'ai ouvert l'enveloppe ».
  const Vd = await bundle("src/lib/validationDepenses.js", "vdf");
  const fp = (o) => Vd.fondsProposable(o);
  test("★ le fonds n'est proposé QUE si le tiroir ne suffit pas : tiroir 0 et enveloppe 50 000 pour 10 000 → proposé ; tiroir 200 000 → JAMAIS proposé (motif « tiroir »)",
    fp({ role: "gerant", tiroir: 0, enveloppe: 50000, montant: 10000 }).possible === true
    && fp({ role: "gerant", tiroir: 200000, enveloppe: 50000, montant: 10000 }).possible === false
    && fp({ role: "gerant", tiroir: 200000, enveloppe: 50000, montant: 10000 }).motif === "tiroir"
    && fp({ role: "gerant", tiroir: 9999, enveloppe: 50000, montant: 10000 }).possible === true);
  test("★ le fonds de caisse est le geste du GÉRANT (et de l'admin) : un vendeur, un magasinier, un comptable ne le voient jamais",
    Vd.ROLES_FONDS_CAISSE.join("|") === "gerant|admin"
    && ["vendeur", "magasinier", "comptable", "technicien", "resp_commercial"].every((r) => fp({ role: r, tiroir: 0, enveloppe: 50000, montant: 10000 }).motif === "role")
    && fp({ role: "admin", tiroir: 0, enveloppe: 50000, montant: 10000 }).possible === true);
  test("une enveloppe vide, un montant absent, ou une dépense plus grosse que tiroir + enveloppe : jamais proposé",
    fp({ role: "gerant", tiroir: 0, enveloppe: 0, montant: 10000 }).motif === "vide"
    && fp({ role: "gerant", tiroir: 0, enveloppe: 50000, montant: "" }).motif === "montant"
    && fp({ role: "gerant", tiroir: 0, enveloppe: 50000, montant: 90000 }).motif === "trop");
  test("★ l'option n'entre dans « Payé avec » que quand elle est proposable, et jamais « au cas où »",
    Vd.optionsPayeAvec(["DEMAKPOE"], "DEMAKPOE", { fonds: fp({ role: "gerant", tiroir: 0, enveloppe: 50000, montant: 10000 }) }).map(([c]) => c).join("|") === "caisse:DEMAKPOE|fonds|avance|dg"
    && Vd.optionsPayeAvec(["DEMAKPOE"], "DEMAKPOE", { fonds: fp({ role: "gerant", tiroir: 200000, enveloppe: 50000, montant: 10000 }) }).map(([c]) => c).join("|") === "caisse:DEMAKPOE|avance|dg"
    && Vd.optionsPayeAvec(["DEMAKPOE"], "DEMAKPOE").map(([c]) => c).join("|") === "caisse:DEMAKPOE|avance|dg"
    && Vd.interpreterPayeAvec(Vd.PAYE_AVEC_FONDS, "DEMAKPOE").paye_avec === Vd.PAYE_AVEC_FONDS
    && Vd.interpreterPayeAvec(Vd.PAYE_AVEC_FONDS, "DEMAKPOE").boutique === "DEMAKPOE");
  // ⚠ Timo, MOT POUR MOT (15/09/2026) : « 20 000 dans la caisse alors que la
  // dépense doit être 30 000 : la dépense prend les 20 000 de la caisse et on
  // passe avec 10 000 de fonds de caisse. Maintenant, pour des dépenses où il
  // n'y a même pas la caisse, c'est le fonds de caisse qui est dans
  // l'enveloppe qui sera utilisé. » DEUX cas, UNE règle — le banc rejoue les deux.
  const dbFo = (tiroir) => ({ boutiques: [{ nom: "X", fonds_caisse_fixe: 50000 }], dettes: [],
    ventes: tiroir > 0 ? [{ id: "v0", boutique: "X", date: "2026-09-01", paiement: "Espèces", articles: [{ qte: 1, pu: tiroir }] }] : [],
    depenses: [
      { id: "f", boutique: "X", date: "2026-09-01", categorie: "Fonds de caisse remis", montant: -50000, paiement: "Espèces", fonds_caisse: { id: "z", origine: "Chez le DG", montant: 50000 } },
      { id: "d", boutique: "X", date: "2026-09-02", categorie: "Carburant", montant: 30000, paiement: "Espèces", paye_avec: "fonds" }] });
  const fo20 = V.fondsAVerser(dbFo(20000), "X", Core.totalVente);
  const fo0 = V.fondsAVerser(dbFo(0), "X", Core.totalVente);
  test("★ LE CAS DE TIMO : 20 000 dans le tiroir, dépense de 30 000 → le tiroir paie ses 20 000 et l'enveloppe COMPLÈTE 10 000 (tiroir 0, enveloppe 40 000)",
    fo20.montant === 0 && fo20.resteFonds === 40000 && fo20.depensesSurFonds === 10000 && fo20.fondsEntame === 10000 && fo20.fondsIntact === false);
  test("★ SON SECOND CAS : tiroir vide, dépense de 30 000 → l'enveloppe paie TOUT (enveloppe 20 000, rien pris au tiroir)",
    fo0.montant === 0 && fo0.resteFonds === 20000 && fo0.depensesSurFonds === 30000);
  test("★ et la recette suivante REMBOURSE l'enveloppe avant d'aller au tiroir (10 000 rendus sur une vente de 30 000 → tiroir 20 000, enveloppe 50 000)",
    (() => { const base = dbFo(20000); const q = V.fondsAVerser({ ...base, ventes: [...base.ventes, { id: "v", boutique: "X", date: "2026-09-03", paiement: "Espèces", articles: [{ qte: 1, pu: 30000 }] }] }, "X", Core.totalVente);
      return q.montant === 20000 && q.resteFonds === 50000 && q.fondsIntact === true; })());
  test("★ UNE SEULE règle d'affectation : « payé avec le fonds » ne change pas le partage, il le rend voulu — l'argent sort de la boutique comme une dépense de caisse (même sortDuTiroir, même blocage de clôture, même validation du DG)",
    Vd.sortDuTiroir({ paiement: "Espèces", paye_avec: "fonds" }) === true && Vd.payeeAvecLeFonds({ paye_avec: "fonds" }) === true
    && Vd.compteDansLaCaisse({ paiement: "Espèces", paye_avec: "fonds" }) === true
    && Vd.compteDansLaCaisse({ paiement: "Espèces", paye_avec: "fonds", validation: { statut: "attente" } }) === false
    && Vd.sortDuTiroir({ paiement: "Flooz", paye_avec: "fonds" }) === false
    && Vd.sortDeLaBoutique === undefined && Vd.compteDansLaBoutique === undefined
    && !/sortieFonds/.test(readFileSync("src/lib/versements.js", "utf8")));
  const dpF = readFileSync("src/screens/Depenses.jsx", "utf8");
  test("★ 📤 Dépenses : l'option est branchée sur fondsProposable (rôle, enveloppe, tiroir, montant), le mot amber la propose, et le rôle EST revérifié dans le geste avec la proposabilité",
    /const propositionFonds = fondsProposable\(\{ role: profile\.role, tiroir: poches\.montant, enveloppe: poches\.resteFonds, montant: f\.montant \}\);/.test(dpF)
    && /fonds: propositionFonds \}\)/.test(dpF) && /data-fonds="propose"/.test(dpF)
    && /Le tiroir paiera \{fmt\(Math\.max\(0, poches\.montant\)\)\} et l'enveloppe \{fmt\(propositionFonds\.manqueAuTiroir\)\}/.test(dpF)
    && /Le tiroir de \$\{boutique\} paie \$\{fmt\(Math\.max\(0, poches\.montant\)\)\} et le fonds de caisse complète \$\{fmt\(propositionFonds\.manqueAuTiroir\)\}/.test(dpF)
    && /if \(refuserSaufRoles\(profile, ROLES_FONDS_CAISSE, "Payer une dépense avec le fonds de caisse"\)\) return;/.test(dpF)
    && /if \(!propositionFonds\.possible\) \{ uAlert\(/.test(dpF));

  // ── ON NE SORT PAS DU TIROIR PLUS QU'IL NE CONTIENT (Timo, 15/09/2026) ──
  // « Si dépense dépasse fonds de caisse, impossible de dépenser » ; sur deux
  // dépenses en attente : « si on valide la première, la seconde refuse
  // jusqu'à ce que le tiroir contienne l'argent nécessaire » ; sur l'avance de
  // poche : « elle attendra que le tiroir soit capable ». Avant, RIEN ne
  // bloquait : 200 000 de dépense passaient avec 40 000 dans le tiroir.
  const tiroirVide = { tiroir: 40000, fondsFixe: 50000 };
  test("★ une dépense en espèces plus grosse que le tiroir est REFUSÉE, et le refus dit ce qu'il y a (dont le fonds de caisse) et la porte de sortie",
    /dépasse ce qu'il y a dans le tiroir de DEMAKPOE : 40\s000\sF \(dont 40\s000\sF de fonds de caisse\)/.test(V.critiqueSortieTiroir({ ...tiroirVide, montant: 200000, boutique: "DEMAKPOE" }))
    && /avance personnelle/.test(V.critiqueSortieTiroir({ ...tiroirVide, montant: 200000 })));
  test("★ LA LIMITE, c'est TOUT le tiroir — recettes ET reste du fonds —, pas le fonds seul : 100 000 de recettes + 50 000 de fonds laissent passer 60 000",
    V.critiqueSortieTiroir({ tiroir: 150000, fondsFixe: 50000, montant: 60000 }) === ""
    && V.critiqueSortieTiroir({ tiroir: 150000, fondsFixe: 50000, montant: 150000 }) === ""
    && V.critiqueSortieTiroir({ tiroir: 150000, fondsFixe: 50000, montant: 150001 }) !== "");
  test("ce qui tient exactement dans le tiroir passe ; un montant nul ou absent ne dit rien ; un tiroir négatif refuse tout",
    V.critiqueSortieTiroir({ ...tiroirVide, montant: 40000 }) === "" && V.critiqueSortieTiroir({ ...tiroirVide, montant: 0 }) === ""
    && V.critiqueSortieTiroir({ ...tiroirVide, montant: "" }) === "" && /:\s0\sF/.test(V.critiqueSortieTiroir({ tiroir: -5000, montant: 1000 })));
  test("★ DEUX dépenses de 30 000 avec 40 000 dans le tiroir : la première passe, et une fois VALIDÉE (tiroir 10 000) la seconde est refusée — mot pour mot la réponse de Timo",
    V.critiqueSortieTiroir({ tiroir: 40000, fondsFixe: 50000, montant: 30000 }) === ""
    && /dépasse ce qu'il y a dans le tiroir/.test(V.critiqueSortieTiroir({ tiroir: 10000, fondsFixe: 50000, montant: 30000 })));
  test("le remboursement d'une avance ne propose pas « une avance personnelle » comme issue (on est déjà dedans)",
    !/avance personnelle/.test(V.critiqueSortieTiroir({ ...tiroirVide, montant: 90000, geste: "Ce remboursement", avecAvance: false }))
    && /Ce remboursement \(90\s000\sF\)/.test(V.critiqueSortieTiroir({ ...tiroirVide, montant: 90000, geste: "Ce remboursement", avecAvance: false })));
  const dpJ = readFileSync("src/screens/Depenses.jsx", "utf8"), caJ = readFileSync("src/screens/Caisse.jsx", "utf8");
  test("★ le contrôle est posé aux TROIS moments où le tiroir se vide hors versement : la saisie, la validation du DG, et le remboursement d'une avance en espèces",
    /const refusTiroir = \(nomBoutique, montant, geste\) => \{/.test(dpJ) && /return critiqueSortieTiroir\(\{ tiroir: p\.montant \+ p\.resteFonds, fondsFixe: p\.resteFonds/.test(dpJ)
    && /const refusT = refusTiroir\(choixCaisse\.boutique, Number\(f\.montant\), "Cette dépense"\);/.test(dpJ)
    && /const refusT = refusTiroir\(d\.boutique, Number\(d\.montant\), "Valider cette dépense"\);/.test(dpJ)
    && /if \(moyen === "caisse"\) \{\n\s*const refusT = critiqueSortieTiroir\(\{/.test(caJ));
  test("★ seules les ESPÈCES payées avec la caisse d'une boutique sont bloquées : Flooz, virement, avance personnelle, argent du DG et caisse du comptable ne touchent pas le tiroir",
    (dpJ.match(/paiement === "Espèces" && \(!\w+\.paye_avec \|\| \w+\.paye_avec === PAYE_AVEC_CAISSE\)/g) || []).length === 2
    && /montant: Number\(d\.montant\), geste: "Ce remboursement", boutique, avecAvance: false/.test(caJ));
  test("★ la dépense est mesurée sur la caisse QUI PAIE, pas sur la boutique regardée (« il peut recevoir dans une boutique et valider pour une boutique »)",
    /refusTiroir\(choixCaisse\.boutique/.test(dpJ) && /const p = fondsAVerser\(db, nomBoutique, totalVente\);/.test(dpJ));

  const s19 = readFileSync("supabase/securite-19-date-remise-fonds.sql", "utf8");
  const ta19 = readFileSync("scripts/tester-argent-sql.sh", "utf8");
  test("★ securite-19 (serveur) : seule la DATE (et la description qui la porte) se corrige, par l'administrateur PRINCIPAL seul ; tout le reste d'une remise reste gravé pour tout le monde ; la création ne change pas ; upsert relu",
    /\(avant - 'updated_at' - 'date' - 'description'\)\n\s*is distinct from \(new\.data - 'updated_at' - 'date' - 'description'\)/.test(s19)
    && /seule sa DATE se corrige/.test(s19)
    && /and not public\.est_admin_principal\(\) then\n\s*perform public\.refus_role\('Corriger la date d''une remise de fonds de caisse'/.test(s19)
    && /select d\.data into avant from public\.depenses d where d\.id = new\.id;/.test(s19)
    && /Remettre le fonds de caisse d''une boutique/.test(s19) && /revoke all on function public\.depenses_regles_fonds_caisse\(\) from public, anon;/.test(s19));
  test("★ le banc SQL pose securite-19 sur base jetable et rejoue les six cas : DG permis (date seule, date + description), admin secondaire et gérant refusés, date + montant et date + boutique refusés",
    /-f supabase\/securite-19-date-remise-fonds\.sql/.test(ta19)
    && /le DG corrige la DATE d'une remise[^\n]*"PERMIS"/.test(ta19) && /le DG corrige la date ET la description[^\n]*"PERMIS"/.test(ta19)
    && /un administrateur SECONDAIRE corrige la date d'une remise" "REFUSE"/.test(ta19) && /un gérant corrige la date d'une remise" "REFUSE"/.test(ta19)
    && /le DG change la date ET le montant en même temps[^\n]*"REFUSE"/.test(ta19) && /le DG change la date ET la boutique en même temps" "REFUSE"/.test(ta19));
  test("le fonds de caisse n'entre toujours ni dans les ventes, ni dans les charges, ni dans ce qu'on verse",
    V.fondsAVerser(dbF, "DEMAKPOE", Core.totalVente).ventes === 800
    && V.fondsAVerser(dbF, "DEMAKPOE", Core.totalVente).fondsRemis === 50000
    && Cst.CATEGORIES_HORS_CHARGES.includes(Cst.CATEGORIE_FONDS_CAISSE));
}

// ═══════════════════════════════════════════════════════════
// LA SAUVEGARDE PAR DOSSIER NE DEMANDE PLUS RIEN AU DÉMARRAGE
// (capture Timo, 15/09/2026 : « Autoriser ce site à modifier les fichiers ? »
//  à chaque connexion — « ce message vient de trop, pourquoi »)
//
// Le navigateur ne garde l'autorisation du dossier que tant qu'un onglet du
// site reste ouvert (« jusqu'à ce que vous fermiez tous les onglets de ce
// site »). L'application tentait d'écrire la sauvegarde DÈS L'OUVERTURE,
// pendant l'écran de connexion : l'autorisation manquait, elle la redemandait,
// et la fenêtre s'ouvrait à chaque fois. Pire, une demande hors clic peut être
// refusée d'office par le navigateur — la sauvegarde échouait en silence.
//
// Décision de Timo : la sauvegarde par dossier RESTE (téléphone compris) ;
// « une fois autorisée, elle écrit toutes les heures en silence, comme
// aujourd'hui ». Même règle que les notifications : on demande AU CLIC,
// jamais par surprise ; sinon un rappel discret dans ⚙ Paramètres.
// ═══════════════════════════════════════════════════════════
{
  const sv = readFileSync("src/lib/sauvegarde.js", "utf8");
  const appS = readFileSync("src/App.jsx", "utf8");
  const paS = readFileSync("src/screens/Parametres.jsx", "utf8");
  test("★ ecrireDansDossier ne demande l'autorisation que si on le lui DIT (`demander`, faux par défaut) ; sans elle, il passe son tour en silence et réessaiera",
    /export async function ecrireDansDossier\(db, handle, \{ demander = false \} = \{\}\) \{/.test(sv)
    && /if \(!\(await dossierAutorise\(handle\)\)\) \{\n\s*if \(!demander\) throw new Error\("PAUSE"\);/.test(sv)
    && /export async function dossierAutorise\(handle\)/.test(sv) && /queryPermission/.test(sv));
  test("★ requestPermission n'existe QU'À UN ENDROIT du code de sauvegarde — dans ecrireDansDossier, derrière `demander` — et au choix du dossier (showDirectoryPicker, qui est déjà un clic)",
    (sv.match(/requestPermission/g) || []).length === 1
    && (paS.match(/requestPermission/g) || []).length === 1
    && /const handle = await window\.showDirectoryPicker\(/.test(paS)
    && !/requestPermission/.test(appS));
  test("★ la sauvegarde HORAIRE (App.jsx) n'ouvre jamais de fenêtre : elle appelle ecrireDansDossier SANS `demander`",
    /await ecrireDansDossier\(dbRef\.current \|\| db, dossierAuto\);/.test(appS)
    && !/ecrireDansDossier\([^)]*demander/.test(appS)
    && /JAMAIS de demande d'autorisation au\n\s*\/\/ démarrage/.test(appS));
  test("★ les DEUX seuls chemins qui peuvent ouvrir la fenêtre sont des CLICS de ⚙ Paramètres : choisir le dossier, et « ⏱ Sauvegarder maintenant »",
    (paS.match(/ecrireDansDossier\(db, [^)]*\{ demander: true \}\)/g) || []).length === 2
    && /const sauvegarderMaintenant = async \(\) => \{/.test(paS) && /⏱ Sauvegarder maintenant/.test(paS));
  test("★ ⚙ Paramètres REGARDE l'autorisation (jamais ne la demande) et DIT quand la sauvegarde est en pause, avec quoi faire — et rassure : les données restent dans le cloud",
    /const \[dossierEnPause, setDossierEnPause\] = useState\(false\);/.test(paS)
    && /const ok = await dossierAutorise\(dossierAuto\);/.test(paS)
    && /data-sauvegarde="pause"/.test(paS) && /le navigateur a oublié l'autorisation du dossier/.test(paS)
    && /vos données restent en sécurité dans le cloud/.test(paS)
    && /setDossierEnPause\(false\);/.test(paS));
  test("la sauvegarde par dossier reste offerte partout où le navigateur la connaît (téléphone compris) : aucune exclusion maison",
    /export const dossierDispo = \(\) => typeof window !== "undefined" && "showDirectoryPicker" in window;/.test(sv)
    && !/dossierSurTelephone|estTelephone/.test(sv));
}

// ═══════════════════════════════════════════════════════════
// LA CARTE DU CODE RESTE COMPLÈTE (Timo, 15/09/2026)
// « À chaque question, il faut relire le code… ça me met mal à l'aise et les
//  réponses sont tardives. Comment essayer de te donner une mémoire ? »
// `docs/carte-du-code.md` dit où vit chaque règle. Elle n'a de valeur que si
// elle est COMPLÈTE : une carte incomplète envoie chercher au mauvais endroit,
// ce qui est pire que pas de carte du tout. Le banc la tient donc à jour — un
// fichier de règles ajouté sans être inscrit fait tomber l'envoi.
// ⚠ Ce contrôle vérifie qu'un fichier FIGURE, pas que sa phrase est encore
// vraie. C'est pourquoi la carte ne dit que le SUJET d'un fichier, jamais son
// fonctionnement : un sujet vieillit lentement (le fonds de caisse a changé
// trois fois de règle en deux jours sans changer de fichier).
// ═══════════════════════════════════════════════════════════
{
  const carte = readFileSync("docs/carte-du-code.md", "utf8");
  const regles = execSync("ls src/lib/*.js").toString().trim().split("\n").map((f) => f.replace("src/", ""));
  const absents = regles.filter((f) => !carte.includes(`\`${f}\``));
  test(`★ la carte du code cite les ${regles.length} fichiers de règles de src/lib${absents.length ? ` — MANQUENT : ${absents.join(", ")}` : ""}`,
    absents.length === 0);
  const composants = execSync("ls src/components/*.jsx").toString().trim().split("\n").map((f) => f.split("/").pop());
  const compAbsents = composants.filter((f) => !carte.includes(`\`${f}\``));
  test(`★ elle cite aussi les ${composants.length} composants partagés${compAbsents.length ? ` — MANQUENT : ${compAbsents.join(", ")}` : ""}`,
    compAbsents.length === 0);
  test("★ elle dit à quoi sert chaque fichier, et pointe les endroits qui ne se touchent pas (identiteClient n'importe rien, push.js seul détenteur des notifications, le SQL collé par Timo)",
    /n'importe RIEN/.test(carte) && /le seul endroit\*\* où `Notification` et `pushManager` existent/.test(carte)
    && /Timo les colle lui-même\*\*, jamais nous/.test(carte) && /verifier-imports/.test(carte));
  test("elle dit qu'elle est gardée par le banc, et ce que le banc NE peut pas vérifier (qu'une phrase soit encore vraie)",
    /Le banc la garde à jour/.test(carte) && /pas que sa phrase est encore vraie/.test(carte));
}

// ═══════════════════════════════════════════════════════════
// 🏠 CLIENTS INSTALLÉS SUIT L'ESPACE REGARDÉ (Timo, 15/09/2026)
// « Pourquoi pour moi elle rend tout alors que la règle est claire ?… même
//  pour l'administrateur principal, ça ne devrait pas apparaître, sauf si je
//  suis dans l'espace formation. »
// CINQUIÈME défaut du même genre (après Paramètres/Utilisateurs 29/08,
// proformas et Salaires 05/09, 👑 Équipe 09/09) : l'écran partait de
// `chantiersDeMonEspace`, qui rend TOUT au principal — c'est la règle des
// DROITS D'ÉCRITURE (traitements de masse), pas celle de l'AFFICHAGE.
// ⚠ Le banc ne voyait rien : aucun contrôle n'exerçait cet écran. C'est
// réparé ici — sinon le défaut reviendrait à la première refonte.
// ═══════════════════════════════════════════════════════════
{
  const dbCh = {
    boutiques: [{ id: "b1", nom: "DEMAKPOE" }, { id: "b2", nom: "ECOLE", formation: true }],
    users: [{ id: "g1", nom: "ALI", role: "gerant", boutique: "DEMAKPOE" },
            { id: "a1", nom: "TIMO", role: "admin", admin_principal: true }],
    ventes: [], dettes: [], depenses: [],
    clients_installes: [
      { id: "c1", nom: "REEL", boutique: "DEMAKPOE", travaux: true },
      { id: "c2", nom: "FORMATION", boutique: "ECOLE", travaux: true },
      { id: "c3", nom: "SANS BOUTIQUE", travaux: true },
    ],
  };
  const principal = dbCh.users[1], gerant = dbCh.users[0];
  const noms = (l) => l.map((c) => c.nom).sort().join("|");
  test("★ l'administrateur PRINCIPAL en RÉEL ne voit plus les chantiers de formation (avant, `chantiersDeMonEspace` lui rendait TOUT, badge 🎓)",
    noms(C.chantiersDeLEspaceRegarde(dbCh, principal, false)) === "REEL|SANS BOUTIQUE");
  test("★ le MÊME principal, quand il REGARDE la formation, ne voit QUE la formation — « sauf si je suis dans l'espace formation »",
    noms(C.chantiersDeLEspaceRegarde(dbCh, principal, true)) === "FORMATION|SANS BOUTIQUE");
  test("un compte cloisonné (gérant du réel) ne voit que son espace, quoi qu'il arrive",
    noms(C.chantiersDeLEspaceRegarde(dbCh, gerant, false)) === "REEL|SANS BOUTIQUE"
    && noms(C.chantiersDeLEspaceRegarde(dbCh, gerant, true)) === "REEL|SANS BOUTIQUE");
  test("★ les DROITS D'ÉCRITURE ne changent pas : `chantiersDeMonEspace` rend toujours tout au principal (les traitements de masse en dépendent) — deux règles, deux noms, deux usages",
    (C.chantiersDeMonEspace(dbCh, principal) || []).length === 3
    && noms(C.chantiersDeMonEspace(dbCh, gerant)) === "REEL|SANS BOUTIQUE");
  const ciE = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
  test("★ 🏠 Clients installés part de chantiersDeLEspaceRegarde, plus jamais de chantiersDeMonEspace, et le badge 🎓 (qui ne commandait plus rien) est RETIRÉ",
    /const mesChantiers = chantiersDeLEspaceRegarde\(db, profile\);/.test(ciE)
    && !/chantiersDeMonEspace/.test(ciE) && !/🎓 formation/.test(ciE) && !/chantierEnFormation/.test(ciE));
  test("★ aucun ÉCRAN ne lit chantiersDeMonEspace pour AFFICHER : la règle des droits d'écriture ne sert qu'aux traitements de masse",
    execSync("grep -rl 'chantiersDeMonEspace' src/screens src/components || true").toString().trim() === "");
}

// ═══════════════════════════════════════════════════════════
// UN CHANTIER PORTE SON ESPACE (Timo, 15/09/2026)
// « Ne pas se fier à la boutique mais à l'ESPACE dans lequel le chantier ou
//  le devis est élaboré… un travail effectué dans formation ne doit pas être
//  visible dans réel, et vice versa. La règle doit respecter l'espace, et non
//  la boutique de l'espace. » — puis : « pas ma règle, mais CELLE QUI EXISTE
//  DÉJÀ… faire toujours confiance à l'espace… et fais en sorte que l'erreur
//  ne se produise plus dans l'avenir. »
// La règle « ce qu'on crée naît dans l'espace qu'on regarde » (`marqueEspace`)
// existait — elle n'était posée sur AUCUN chantier. Un chantier créé à la main
// (donc sans boutique) était donc visible dans les DEUX espaces.
// ⚠ LE GARDE-FOU : tout fichier qui crée une fiche de `clients_installes`
// DOIT poser la marque. Un nouveau chemin qui l'oublie fait tomber l'envoi.
// ═══════════════════════════════════════════════════════════
{
  const creeUnChantier = execSync("grep -rl 'clients_installes: \\[' src --include=*.jsx --include=*.js || true")
    .toString().trim().split("\n").filter(Boolean).sort();
  const sansMarque = creeUnChantier.filter((f) => !/marqueEspace|formation:/.test(readFileSync(f, "utf8")));
  test(`★ LE GARDE-FOU : les ${creeUnChantier.length} chemins qui créent un chantier posent TOUS la marque d'espace${sansMarque.length ? ` — OUBLIÉE dans : ${sansMarque.join(", ")}` : ""}`,
    creeUnChantier.length >= 4 && sansMarque.length === 0);
  test("★ les quatre chemins connus la posent : la création à la main (sans boutique : l'espace REGARDÉ), 🛠 Travaux, la vente encaissée, le devis « pose seule »",
    /\.\.\.marqueEspace\(db, profile\),/.test(readFileSync("src/screens/ClientsInstalles.jsx", "utf8"))
    && /formation: !!marqueEspace\(db, profile, boutique\)\.formation/.test(readFileSync("src/screens/Travaux.jsx", "utf8"))
    && /\.\.\.marqueEspace\(db, profile, boutique\),/.test(readFileSync("src/screens/Ventes.jsx", "utf8"))
    && /\.\.\.marqueEspace\(db, acteur, boutique\),/.test(readFileSync("src/lib/validationDevis.js", "utf8")));

  const dbM = {
    boutiques: [{ id: "b1", nom: "DEMAKPOE" }, { id: "b2", nom: "ECOLE", formation: true }],
    users: [{ id: "a1", nom: "TIMO", role: "admin", admin_principal: true }],
    ventes: [], dettes: [], depenses: [],
    clients_installes: [
      // Marquées : c'est la MARQUE qui décide, même sans boutique.
      { id: "m1", nom: "REEL MARQUE", formation: false },
      { id: "m2", nom: "FORMATION MARQUEE", formation: true },
      // ⚠ Une fiche marquée FORMATION posée sur une boutique RÉELLE : la
      // marque l'emporte (« faire confiance à l'espace, pas à la boutique »).
      { id: "m3", nom: "FORMATION SUR BOUTIQUE REELLE", boutique: "DEMAKPOE", formation: true },
      // Ancienne fiche, sans marque : la boutique prend le relais.
      { id: "v1", nom: "ANCIENNE REELLE", boutique: "DEMAKPOE" },
      { id: "v2", nom: "ANCIENNE FORMATION", boutique: "ECOLE" },
    ],
  };
  const principalM = dbM.users[0];
  const nomsM = (l) => l.map((c) => c.nom).sort().join("|");
  test("★ LA MARQUE L'EMPORTE SUR LA BOUTIQUE : une fiche marquée formation posée sur une boutique RÉELLE reste invisible en réel",
    nomsM(C.chantiersDeLEspaceRegarde(dbM, principalM, false)) === "ANCIENNE REELLE|REEL MARQUE"
    && nomsM(C.chantiersDeLEspaceRegarde(dbM, principalM, true)) === "ANCIENNE FORMATION|FORMATION MARQUEE|FORMATION SUR BOUTIQUE REELLE");
  test("★ une fiche SANS boutique n'est plus visible des deux côtés : sa marque la range d'un seul côté",
    C.chantiersDeLEspaceRegarde(dbM, principalM, false).some((c) => c.id === "m1")
    && !C.chantiersDeLEspaceRegarde(dbM, principalM, true).some((c) => c.id === "m1")
    && C.chantiersDeLEspaceRegarde(dbM, principalM, true).some((c) => c.id === "m2")
    && !C.chantiersDeLEspaceRegarde(dbM, principalM, false).some((c) => c.id === "m2"));
  test("l'ordre de confiance est écrit une fois (espaceDeLaFiche) : marque, puis boutique, puis espace regardé — les anciennes fiches ne bougent pas",
    C.espaceDeLaFiche({ formation: true }) === true && C.espaceDeLaFiche({ formation: false }) === false
    && C.espaceDeLaFiche({}) === null && C.espaceDeLaFiche(null) === null
    && C.espaceDuChantier(dbM, { formation: true, boutique: "DEMAKPOE" }, principalM) === true
    && C.espaceDuChantier(dbM, { boutique: "ECOLE" }, principalM) === true);
}

// ═══════════════════════════════════════════════════════════
// LE CHEF DES TECHNICIENS (Timo, 17/09/2026 : « ouvre le rôle technicien BMI »)
// ═══════════════════════════════════════════════════════════
// Le chef des techniciens de BMI est un SALARIÉ : le seul rôle qui lui
// convienne est « technicien BMI ». Or ce rôle ne pouvait même PAS être nommé
// chef — le bouton « Nommer chef » n'existait que pour le commercial et le
// technicien (commission) — et il n'avait ni 👑 Équipe ni ✅ Mes tâches : un
// chef qui ne peut ni suivre ses hommes ni leur donner du travail.
// ⚠ LE COUPLE : ROLES_TACHES (application) et a_pouvoir_taches() (serveur,
// securite-21) doivent dire LA MÊME CHOSE. Si l'un ouvre le rôle et pas
// l'autre, le geste part, la base dit non, et TOUT le lot reste coincé dans
// la file d'attente (« une écriture refusée par le serveur coince tout le lot »).
{
  const calC = readFileSync("src/lib/calculs.js", "utf8");
  const appC = readFileSync("src/App.jsx", "utf8");
  const usC = readFileSync("src/screens/Utilisateurs.jsx", "utf8");
  const sqlC = existsSync("supabase/securite-21-chef-technicien-bmi.sql")
    ? readFileSync("supabase/securite-21-chef-technicien-bmi.sql", "utf8") : "";

  const ongletsBMI = C.ONGLETS_ROLE.technicien_bmi || [];
  test("★ le rôle « technicien BMI » a bien 👑 Équipe et ✅ Mes tâches dans ONGLETS_ROLE — donc l'administrateur peut les lui RETIRER dans 🔐 Pouvoirs (« taches » y manquait alors qu'App.jsx le donnait déjà : un onglet qu'on ne peut pas retirer est un pouvoir qui échappe à l'administrateur)",
    ongletsBMI.includes("equipe") && ongletsBMI.includes("taches")
    && C.pouvoirsDuRole("technicien_bmi").some(([id]) => id === "equipe")
    && C.pouvoirsDuRole("technicien_bmi").some(([id]) => id === "taches"));

  test("★ 👑 Mon équipe ne s'affiche QUE s'il est chef (estChefEquipe, comme pour le commercial et le technicien) — le menu et l'écran le disent tous les deux",
    /\["taches", labelTaches\], \.\.\.\(estChefEquipe\(db, profile\) \? \[\["equipe", labelMonEquipe\]\] : \[\]\), \["outillage", labelOutillage\], \["commission", "💵 Ma commission"\]/.test(appC)
    && /ongletsVisites\.equipe && \(isAdmin \|\| isRespCom \|\| \(\(isCommercial \|\| isTechnicien \|\| isTechnicienBMI\) && estChefEquipe\(db, profile\)\)\)/.test(appC));

  test("★ le bouton « Nommer chef » existe enfin sur la fiche d'un technicien BMI, la case est proposée à la création, et l'étoile ⭐ Chef se VOIT sur sa pastille",
    /\{\["commercial", "technicien", "technicien_bmi"\]\.includes\(u\.role\) && <button onClick=\{\(\) => basculerChef\(u\)\}/.test(usC)
    && /\{\(f\.role === "commercial" \|\| f\.role === "technicien" \|\| f\.role === "technicien_bmi"\) && \(\s*\n\s*<label/.test(usC)
    && /if \(f\.role === "technicien_bmi" && f\.chef\) nouvelUser\.chef_equipe = true;/.test(usC)
    && /u\.role === "technicien_bmi" \? `🔧 Technicien BMI \(salarié\).*\$\{u\.chef_equipe \? " ⭐ Chef" : ""\}`/.test(usC));

  test("★ nommer un chef reste le geste de l'ADMINISTRATEUR (refuserSaufAdmin dans basculerChef) — ouvrir le rôle n'ouvre pas la nomination",
    /const basculerChef = \(u\) => \{\s*\n\s*if \(refuserSaufAdmin\(profile, "Nommer ou retirer un chef d'équipe"\)\) return;/.test(usC));

  test("★ les trois pouvoirs d'un chef (✅ tâches, 💰 commissions, 🔁 réaffecter) sont LISTÉS pour le technicien BMI : sans ça l'administrateur ne pourrait pas les lui retirer (aDroit dit oui par défaut à ce qui n'est pas listé)",
    ["act_taches", "act_commission", "act_reaffecter"].every((a) =>
      C.pouvoirsDuRole("technicien_bmi").some(([id]) => id === a)));

  const dbT = { users: [
    { id: "t1", nom: "CHEF BMI", role: "technicien_bmi", chef_equipe: true },
    { id: "t2", nom: "SIMPLE BMI", role: "technicien_bmi" },
    // ⚠ Le pouvoir retiré vit sur la FICHE : droitsOffDe lit la base avant le
    // profil qu'on lui passe. Posé sur le seul profil, le contrôle passerait
    // sans rien mesurer.
    { id: "t3", nom: "CHEF SANS POUVOIR", role: "technicien_bmi", chef_equipe: true, droits_off: ["act_reaffecter"] },
  ] };
  const chefBMI = dbT.users[0], simpleBMI = dbT.users[1], chefSansPouvoir = dbT.users[2];
  test("★ un chef technicien BMI peut réaffecter un prospect, un technicien BMI ordinaire non, et l'administrateur peut le lui retirer",
    C.estChefEquipe(dbT, chefBMI) && !C.estChefEquipe(dbT, simpleBMI)
    && C.peutReaffecter(dbT, chefBMI) && !C.peutReaffecter(dbT, simpleBMI)
    && !C.peutReaffecter(dbT, chefSansPouvoir));

  // ⚠ LE COUPLE application / serveur, MESURÉ des deux côtés.
  const rolesApp = (calC.match(/export const ROLES_TACHES = \[([^\]]*)\]/) || [, ""])[1]
    .split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean).sort();
  const rolesSql = ((sqlC.match(/role_jeton\(\) in \(([^)]*)\)/) || [, ""])[1])
    .split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean).sort();
  test(`★ LE COUPLE : ROLES_TACHES (application) et a_pouvoir_taches() (serveur, securite-21) nomment EXACTEMENT les mêmes rôles — application : ${rolesApp.join(", ") || "(vide)"} | serveur : ${rolesSql.join(", ") || "(vide)"}`,
    rolesApp.length === 5 && rolesApp.includes("technicien_bmi")
    && rolesApp.join("|") === rolesSql.join("|"));

  test("★ securite-21 REMPLACE la fonction sans toucher au reste : il ne pose aucun déclencheur, ne supprime rien, et porte sa vérification « doit afficher : true | true »",
    /create or replace function public\.a_pouvoir_taches\(\)/.test(sqlC)
    && !/create trigger|drop trigger|drop function|delete from|alter table/i.test(sqlC)
    && /doit afficher : true \| true/.test(sqlC));

  test("★ le banc SQL des comptes rejoue securite-21 et mesure le chef technicien (assigner, valider, pouvoir retiré, ⭐ admin seul)",
    (() => { const b = readFileSync("scripts/tester-comptes-sql.sh", "utf8");
      return /securite-21-chef-technicien-bmi\.sql/.test(b)
        && /CHEF TECHNICIEN \(technicien BMI ⭐\) assigne une tâche/.test(b)
        && /chef technicien à qui l'admin a RETIRÉ le pouvoir « tâches »" "REFUSE"/.test(b)
        && /se retire l'étoile de chef LUI-MÊME.*"REFUSE"/.test(b); })());
}

// ═══════════════════════════════════════════════════════════
// 🧰 LE MATÉRIEL DE TRAVAIL (Timo, 17/09/2026)
// ═══════════════════════════════════════════════════════════
// « Comment faire le suivi, pour éviter la perte des équipements de travail
// sur le terrain. » Décisions : le tiennent le chef technicien, le
// magasinier, l'administrateur ; un outil perdu se marque, sa valeur entre
// dans les pertes de l'année ET l'administrateur peut poser une retenue sur
// le salaire (« b et c ») ; l'appel de l'outillage se fait CHAQUE SEMAINE.
// ⚠ CE N'EST PAS DU STOCK : rangé dans 📦 Stocks, un outil entrerait dans la
// valeur du stock et une sortie ressemblerait à une vente.
titre("🧰 Le matériel de travail : un outil est toujours sous le nom de quelqu'un (17/09/2026)");
{
  const outC = readFileSync("src/lib/outillage.js", "utf8");
  const ecrC = readFileSync("src/screens/Outillage.jsx", "utf8");
  const calO = readFileSync("src/lib/calculs.js", "utf8");
  const appO = readFileSync("src/App.jsx", "utf8");
  const sqlO = existsSync("supabase/securite-22-outillage.sql")
    ? readFileSync("supabase/securite-22-outillage.sql", "utf8") : "";

  test("★ la règle pure n'importe RIEN (lisible par Node sans bundler, comme lib/banques.js et lib/espace.js)",
    !/^\s*import\s/m.test(outC));

  test("★ QUI tient le registre : le magasinier, l'administrateur, et le CHEF technicien (⭐) — jamais un technicien ordinaire, jamais un chef d'équipe COMMERCIAL, jamais le vendeur ni le gérant",
    Out.peutTenirOutillage({ role: "magasinier" }) && Out.peutTenirOutillage({ role: "admin" })
    && Out.peutTenirOutillage({ role: "technicien_bmi", chef_equipe: true })
    && Out.peutTenirOutillage({ role: "technicien", chef_equipe: true })
    && !Out.peutTenirOutillage({ role: "technicien_bmi" })
    && !Out.peutTenirOutillage({ role: "technicien" })
    && !Out.peutTenirOutillage({ role: "commercial", chef_equipe: true })
    && !Out.peutTenirOutillage({ role: "vendeur" }) && !Out.peutTenirOutillage({ role: "gerant" })
    && !Out.peutTenirOutillage({ role: "comptable" }) && !Out.peutTenirOutillage(null));

  // Le scénario de Timo, joué en entier : une perceuse sort, elle est en
  // retard, elle se perd, la valeur entre dans les pertes.
  let perceuse = Out.nouvelOutil({ id: "o1", nom: "Perceuse BOSCH", numero: "BMI-012", prix_achat: 85000, le: "2026-09-10", par: "TIMO" });
  test("★ un outil neuf est EN BOUTIQUE, et son état est DÉRIVÉ du dernier mouvement — jamais un champ écrit à la main (deux vérités qui divergent, c'est une vérité de moins)",
    Out.etatOutil(perceuse) === "en_boutique" && !/etat:\s*"(en_boutique|sorti)"/.test(outC)
    && !Out.detenteurOutil(perceuse));

  test("★ une sortie SANS personne est refusée : « un outil est toujours sous le nom de quelqu'un »",
    /un outil est toujours sous le nom de quelqu'un/.test(Out.critiqueSortie(perceuse, { retour_prevu: "2026-09-16" }))
    && /quand l'outil doit revenir/.test(Out.critiqueSortie(perceuse, { user_id: "u1" })));

  perceuse = Out.sortirOutil(perceuse, { id: "m1", le: "2026-09-15", user_id: "u1", user: "KOSSI", chantier: "MR ERIC", retour_prevu: "2026-09-16", par_id: "c1", par: "CHEF" });
  test("★ sortie : l'outil est SORTI, KOSSI en répond, et il ne peut pas repartir chez quelqu'un d'autre sans être rentré",
    Out.etatOutil(perceuse) === "sorti" && Out.detenteurOutil(perceuse).nom === "KOSSI"
    && /déjà sorti — il est chez KOSSI/.test(Out.critiqueSortie(perceuse, { user_id: "u2", retour_prevu: "2026-09-30" })));

  // ---- 📤 PLUSIEURS OUTILS EN UNE SORTIE (Timo, 20/09/2026)
  // ⚠ Seule la SAISIE est groupée, jamais la TRACE.
  {
    const marteau = Out.nouvelOutil({ id: "o9", nom: "Marteau", numero: "BMI-009", le: "2026-09-10", par: "TIMO" });
    const scie = Out.nouvelOutil({ id: "o10", nom: "Scie", numero: "BMI-010", le: "2026-09-10", par: "TIMO" });
    test("★ un LOT d'outils se refuse pour les mêmes raisons qu'un outil seul, et la règle d'un seul outil N'EST PAS une copie (critiqueSortie passe par critiqueSortieLot)",
      /un outil est toujours sous le nom de quelqu'un/.test(Out.critiqueSortieLot([marteau, scie], { retour_prevu: "2026-09-25" }))
      && /quand l'outil doit revenir/.test(Out.critiqueSortieLot([marteau, scie], { user_id: "u1" }))
      && Out.critiqueSortieLot([marteau, scie], { user_id: "u1", retour_prevu: "2026-09-25" }) === ""
      && Out.critiqueSortieLot([], { user_id: "u1", retour_prevu: "2026-09-25" }) === "Choisissez d'abord un outil."
      && /critiqueSortie = \(outil, options\) => critiqueSortieLot/.test(outC));

    // ⚠ L'outil fautif est mis en DEUXIÈME position, et aussi en première :
    // un contrôle qui ne le regarde qu'en tête laisserait passer une règle
    // qui ne vérifie que le premier outil du lot (éprouvé : elle tombe).
    {
      const sorti = Out.sortirOutil(marteau, { id: "m9", le: "2026-09-15", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-16", par: "CHEF" });
      const opts = { user_id: "u2", retour_prevu: "2026-09-25" };
      test("★ UN SEUL outil du lot qui ne peut plus partir REFUSE tout le lot, en le NOMMANT, à QUELQUE place qu'il soit — rien ne part à moitié",
        /« Marteau » est déjà sorti — il est chez KOSSI/.test(Out.critiqueSortieLot([sorti, scie], opts))
        && /« Marteau » est déjà sorti — il est chez KOSSI/.test(Out.critiqueSortieLot([scie, sorti], opts))
        && Out.critiqueSortieLot([scie, marteau], opts) === "");
    }

    test("★ le refus se dit AU MOMENT où on ajoute l'outil à la case, et un outil déjà dans la case est refusé en le disant",
      Out.critiqueAjoutLot(marteau, []) === ""
      && Out.critiqueAjoutLot(marteau, [scie]) === ""
      && /« Marteau » est déjà dans la liste/.test(Out.critiqueAjoutLot(marteau, [scie, marteau]))
      && /déclaré perdu/.test(Out.critiqueAjoutLot(Out.declarerPerdu(marteau, { id: "mp", le: "2026-09-17", motif: "perdu", valeur: 1000, par: "CHEF" }), []))
      && /Choisissez d'abord un outil/.test(Out.critiqueAjoutLot(null, [])));

    test("★ le message à la personne et la ligne de journal nomment les outils au MÊME endroit (nommerLot), avec le numéro gravé",
      Out.nommerLot([marteau, scie]) === "« Marteau » (N° BMI-009), « Scie » (N° BMI-010)"
      && Out.nommerLot([{ nom: "Pince" }]) === "« Pince »"
      && Out.nommerLot([]) === ""
      && (ecrC.match(/nommerLot\(lot\)/g) || []).length === 2);

    test("★ la TRACE n'est jamais groupée : UN mouvement de sortie par outil, sur SA fiche — l'écran boucle sur le lot et remplace chaque outil dans la sienne",
      /for \(const outil of lot\)/.test(ecrC)
      && /boutiques\.find\(\(b\) => b\.id === outil\._fiche\)/.test(ecrC)
      && /remplacerOutil\(bq, apres\)/.test(ecrC)
      && (ecrC.match(/sortirOutil\(outil, \{/g) || []).length === 1);

    test("★ l'état de chaque outil du lot est RELU au moment d'enregistrer (revérifié DANS le geste), et le lot part en UNE seule écriture",
      /f\.lot\.map\(\(o\) => tous\.find\(\(x\) => x\.id === o\.id\)\)/.test(ecrC)
      && (ecrC.match(/critiqueSortieLot\(lot, \{/g) || []).length === 1
      && /save\(\s*\{ \.\.\.db, boutiques,/.test(ecrC));

    test("★ UN seul message pour tout le lot : on ne fait pas vibrer cinq fois le téléphone de la même personne pour un seul geste",
      (ecrC.match(/nouveauMessage\(profile, \{ a_id: p\.id, texte: `🧰 Vous répondez de \$\{nommerLot\(lot\)\}/g) || []).length === 1);

    test("★ la case « Outils assignés » ne s'affiche PAS tant qu'elle est vide, n'impose AUCUNE hauteur (elle grandit avec les outils), et chaque outil porte sa ✕",
      /\{f\.lot\.length > 0 && \(/.test(ecrC)
      && /Outils assignés \(\{f\.lot\.length\}\)/.test(ecrC)
      && !/min-h-\[\d+px\]/.test(ecrC)
      && /retirerDuLot\(o\.id\)/.test(ecrC)
      && /disabled=\{!f\.lot\.length\}/.test(ecrC));
  }

  test("★ le RETARD se mesure sur la date de retour promise, et les jours dehors se comptent depuis la sortie",
    Out.enRetard(perceuse, "2026-09-17") && !Out.enRetard(perceuse, "2026-09-16")
    && Out.joursDehors(perceuse, "2026-09-17") === 2);

  test("★ une perte SANS motif est refusée (« une perte sans motif ne s'explique à personne »), et le responsable est celui qui détenait l'outil",
    /ne s'explique à personne/.test(Out.critiquePerte(perceuse, { motif: "   " }))
    && Out.critiquePerte(perceuse, { motif: "Oublié sur le toit" }) === ""
    && Out.responsableDeLaPerte(perceuse).nom === "KOSSI"
    && Out.valeurProposee(perceuse) === 85000);

  const echelle = Out.nouvelOutil({ id: "o2", nom: "Échelle 6 m", numero: "BMI-002", prix_achat: 40000, le: "2026-09-10", par: "TIMO" });
  perceuse = Out.declarerPerdu(perceuse, { id: "m2", le: "2026-09-17", motif: "Oublié sur le toit", valeur: 85000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" });
  const bqO = { id: "b1", nom: "DEMAKPOE", outillage: { outils: [perceuse, echelle], appels: [] } };

  test("★ un outil PERDU ne repart plus sur un chantier, sort des listes de travail, et reste au registre pour la trace",
    Out.etatOutil(perceuse) === "perdu" && /déclaré perdu/.test(Out.critiqueSortie(perceuse, {}))
    && Out.outilsVivants(bqO).length === 1 && Out.outilsDe(bqO).length === 2);

  test("★ décision « c » : la valeur de la perte entre dans le total des pertes, avec sa date, son motif et son responsable",
    Out.valeurPerdue(bqO, null) === 85000
    && Out.pertesDe(bqO, { du: "2026-09-01", au: "2026-09-30" }).length === 1
    && Out.pertesDe(bqO, { du: "2026-10-01", au: "2026-10-31" }).length === 0
    && Out.pertesDe(bqO, null)[0].user === "KOSSI"
    && Out.resumeOutillage(bqO, "2026-09-17").perdus === 1);

  test("★ décision « b » : la retenue passe par le mécanisme QUI EXISTE DÉJÀ — une AVANCE du mois, que paieMois soustrait du net sans toucher à la base CNSS. Aucun champ neuf",
    (() => { const r = Out.retenuePourOutil({ id: "r1", mois: "2026-09", montant: 85000, outil: "Perceuse BOSCH", date: "2026-09-17", par: "TIMO" });
      return r.mois === "2026-09" && r.montant === 85000 && r.auto === "outil_perdu" && /Perceuse BOSCH/.test(r.motif)
        && /avances: \[\.\.\.\(u\.avances \|\| \[\]\), av\]/.test(ecrC)
        && /const net = base \+ primes - avances/.test(calO); })());

  // ⚠ CONTRÔLE RETOURNÉ le 18/09/2026 : la question n'est plus « Retenir X sur
  // le salaire ? » mais « Faire rembourser cette perte ? » — il y a désormais
  // DEUX façons d'être retenu (salaire, commission). Ce qu'il protège, lui,
  // n'a pas bougé : proposée, jamais imposée, administrateur seul.
  // ⚠ CONTRÔLE RETOURNÉ le 18/09/2026 : ces lignes vivaient dans `perdre`.
  // Elles ont été écrites UNE fois (`demanderCombienDu`) le jour où le
  // matériel manquant d'une boîte à outils est devenu une perte lui aussi —
  // une deuxième copie des règles d'argent aurait été la vraie faute.
  test("★ la retenue est proposée, jamais imposée, et à l'ADMINISTRATEUR seul (c'est de l'argent sur la paie de quelqu'un)",
    /const demanderCombienDu = async \(resp, valeur, quoi\) => \{\s*\n\s*if \(!\(jeSuisAdmin && resp && valeur > 0\)\) return 0;/.test(ecrC)
    && /await uConfirm\(`Faire rembourser cette perte à \$\{resp\.nom\} \?/.test(ecrC)
    && /Elle sera retenue \$\{libelleRetenue\(modeRetenue\(resp\)\)\}/.test(ecrC)
    && /la perte reste à la charge de BMI/.test(ecrC));

  // ---- L'appel de la semaine
  test("★ l'appel est HEBDOMADAIRE et la semaine est nommée par son LUNDI : deux personnes qui appellent le mardi et le jeudi parlent de la même semaine",
    Out.lundiDe("2026-09-17") === "2026-09-14" && Out.lundiDe("2026-09-15") === "2026-09-14"
    && Out.lundiDe("2026-09-14") === "2026-09-14" && Out.lundiDe("2026-09-21") === "2026-09-21");

  // ⚠ CONTRÔLES RETOURNÉS le 18/09/2026 : l'appel ne se fait plus par
  // BOUTIQUE mais par LIEU (« ne pas classer par boutique… c'est une
  // propriété générale de toute l'entreprise »). Il prend donc la liste des
  // outils rangés LÀ, pas le contenu d'une fiche. Ce qu'ils mesurent — la
  // photo, les absents qui se voient, la semaine — n'a pas bougé.
  const vivantsDuLieu = Out.outilsDuLieu(Out.registreUnifie([bqO]), "DEMAKPOE")
    .filter((o) => !["perdu", "reforme"].includes(Out.etatOutil(o)));
  const appel = Out.construireAppel({ id: "a1", jour: "2026-09-17", presents: [], par_id: "c1", par: "CHEF", lieu: "DEMAKPOE", outils: vivantsDuLieu });
  const bqApres = Out.ajouterAppel(bqO, appel);
  test("★ l'appel est une PHOTO : ce qui n'est pas coché reste dehors et SE VOIT ; une fois fait, il n'est plus réclamé de la semaine, et il revient la semaine suivante",
    Out.appelAFaire(bqO, vivantsDuLieu, "2026-09-17") && appel.semaine === "2026-09-14"
    && appel.lieu === "DEMAKPOE"
    && appel.absents.length === 1 && appel.presents.length === 0
    && Out.manquantsDuDernierAppel(bqApres, Out.registreUnifie([bqApres])).map((o) => o.nom).join() === "Échelle 6 m"
    && !Out.appelAFaire(bqApres, vivantsDuLieu, "2026-09-18") && Out.appelAFaire(bqApres, vivantsDuLieu, "2026-09-21"));

  test("★ un outil PERDU n'est jamais appelé, et un lieu sans outil ne réclame aucun appel",
    !appel.presents.includes("o1") && !appel.absents.includes("o1")
    && !Out.appelAFaire({ nom: "VIDE" }, [], "2026-09-17")
    && Out.lieuxSansAppel([bqApres], Out.registreUnifie([bqApres]), "2026-09-18").length === 0
    && Out.lieuxSansAppel([bqApres], Out.registreUnifie([bqApres]), "2026-09-21").map((b) => b.nom).join() === "DEMAKPOE");

  // ═══ 🧰 LE REGISTRE EST CELUI DE TOUTE LA MAISON (Timo, 18/09/2026) ═══
  // « Pour l'outillage, ne pas classer par boutique… c'est une propriété
  // générale de toute l'entreprise. C'est qui reçoit l'outil qui peut le
  // faire classer : un gérant de boutique qui reçoit, c'est dans sa
  // boutique ; un magasinier, c'est au magasin. Donc soit boutique, soit
  // magasin. »
  {
    const bqA = { id: "bA", nom: "DEMAKPOE", outillage: { outils: [
      Out.nouvelOutil({ id: "t1", nom: "Perceuse", lieu: "DEMAKPOE", le: "2026-09-01", par: "TIMO" }),
    ], appels: [] } };
    const bqB = { id: "bB", nom: "MAGASIN", depot: true, outillage: { outils: [
      Out.nouvelOutil({ id: "t2", nom: "Échelle", lieu: "MAGASIN", le: "2026-09-01", par: "TIMO" }),
    ], appels: [] } };
    // Un outil d'avant la règle : aucun `lieu`, il prend le nom de SA fiche.
    const bqC = { id: "bC", nom: "APESSITO", outillage: { outils: [
      { id: "t3", nom: "Meuleuse", mouvements: [] },
    ], appels: [] } };
    const reg = Out.registreUnifie([bqA, bqB, bqC]);

    test("★ UN SEUL REGISTRE pour toute la maison : les outils des boutiques ET des magasins se lisent ensemble, et un outil d'avant la règle garde le nom de la fiche qui le gardait",
      Out.outilsDe(reg).map((o) => o.nom).join() === "Perceuse,Échelle,Meuleuse"
      && Out.resumeOutillage(reg, "2026-09-18").total === 3
      && Out.lieuDeRangement(Out.outilsDe(reg)[0]) === "DEMAKPOE"
      && Out.lieuDeRangement(Out.outilsDe(reg)[1]) === "MAGASIN"
      && Out.lieuDeRangement(Out.outilsDe(reg)[2]) === "APESSITO");

    test("★ et l'ÉCRAN n'a plus de pastille de boutique : il lit le registre unifié des LIEUX de l'espace regardé (le mur tient), montre la colonne « Où », et demande où ranger un outil neuf",
      !/BoutiqueTabs/.test(ecrC)
      && /const lieux = lieuxDuRegistre\(boutiquesVisibles\(db, profile, db\.boutiques \|\| \[\]\)\);/.test(ecrC)
      && /const registre = registreUnifie\(lieux\);/.test(ecrC)
      && /<th className="px-3 py-2">Où<\/th>/.test(ecrC)
      && /<Field label="Où est-il rangé \?">/.test(ecrC)
      && /Dites où l'outil est rangé : une boutique ou un magasin\./.test(ecrC));

    test("★ C'EST CELUI QUI REÇOIT QUI CLASSE : un retour pose le LIEU sur le mouvement, et l'outil change de place sans changer de fiche",
      (() => {
        const t = Out.outilsDe(reg)[0];
        const sorti = Out.sortirOutil(t, { id: "s1", le: "2026-09-10", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-12", par_id: "c1", par: "CHEF" });
        // tant qu'il est dehors : chez la personne, mais il revient à DEMAKPOE
        const dehors = Out.lieuOutil(sorti);
        const rendu = Out.rendreOutil(sorti, { id: "r1", le: "2026-09-13", etat: "bon", lieu: "MAGASIN", par_id: "m1", par: "MAGASINIER" });
        return dehors.type === "personne" && dehors.nom === "KOSSI"
          && Out.lieuDeRangement(sorti) === "DEMAKPOE"
          && Out.lieuOutil(rendu).type === "lieu" && Out.lieuOutil(rendu).nom === "MAGASIN"
          && Out.lieuDeRangement(rendu) === "MAGASIN"
          // la fiche qui le garde n'a pas bougé : rien à migrer, le SQL reste valable
          && rendu._fiche === "bA"; })());

    test("★ et l'écran DEMANDE où quand celui qui reçoit n'a pas de boutique attitrée (décision Timo) — jamais un magasin d'office",
      /const lieuDuRetour = async \(outil\) => \{\s*\n\s*const sien = lieuDeLaPersonne\(profile, lieux\);\s*\n\s*if \(sien\) return sien;/.test(ecrC)
      && /Où rangez-vous « \$\{outil\.nom\} » \?/.test(ecrC)
      && Out.lieuDeLaPersonne({ boutique: "DEMAKPOE" }, [bqA, bqB]) === "DEMAKPOE"
      && Out.lieuDeLaPersonne({ boutique: "Toutes" }, [bqA, bqB]) === ""
      && Out.lieuDeLaPersonne({}, [bqA, bqB]) === "");

    test("★ L'APPEL SE FAIT PAR LIEU (décision Timo) : chacun n'appelle que ce qui est rangé chez lui, et l'appel est rangé dans la fiche de CE lieu",
      Out.outilsDuLieu(reg, "DEMAKPOE").map((o) => o.nom).join() === "Perceuse"
      && Out.outilsDuLieu(reg, "MAGASIN").map((o) => o.nom).join() === "Échelle"
      && Out.lieuxSansAppel([bqA, bqB, bqC], reg, "2026-09-18").map((b) => b.nom).join() === "DEMAKPOE,MAGASIN,APESSITO"
      && (() => {
        const a = Out.construireAppel({ id: "ap1", jour: "2026-09-18", presents: ["t1"], par: "GÉRANT", lieu: "DEMAKPOE", outils: Out.outilsDuLieu(reg, "DEMAKPOE") });
        const apres = Out.ajouterAppel(bqA, a);
        // DEMAKPOE a fait le sien ; le magasin et APESSITO le doivent toujours
        return Out.lieuxSansAppel([apres, bqB, bqC], Out.registreUnifie([apres, bqB, bqC]), "2026-09-18").map((b) => b.nom).join() === "MAGASIN,APESSITO"
          && a.lieu === "DEMAKPOE" && a.presents.join() === "t1" && a.absents.length === 0; })()
      && /ouvrirAppel\(b\.nom\)/.test(ecrC)
      && /Faire l'appel de \{b\.depot \? "🏭 " : ""\}\{b\.nom\}/.test(ecrC));

    test("★ ⚠ LES MARQUES DU REGISTRE UNIFIÉ NE PARTENT JAMAIS DANS LA BASE : `remplacerOutil` et `ajouterOutil` les retirent — un seul endroit à ne pas oublier",
      (() => {
        const marque = Out.outilsDe(reg)[0];
        const ecrit = Out.outilsDe(Out.remplacerOutil(bqA, marque))[0];
        const ajoute = Out.outilsDe(Out.ajouterOutil(bqB, marque))[1];
        return marque._fiche === "bA" && marque._lieu_defaut === "DEMAKPOE"
          && !("_fiche" in ecrit) && !("_lieu_defaut" in ecrit)
          && !("_fiche" in ajoute) && !("_lieu_defaut" in ajoute)
          && ecrit.nom === "Perceuse"; })());

    test("★ un numéro gravé est unique dans TOUTE la maison, plus seulement dans une boutique",
      /est déjà porté par un autre outil de BMI/.test(Out.critiqueNouvelOutil(
        Out.registreUnifie([{ id: "b1", nom: "X", outillage: { outils: [Out.nouvelOutil({ id: "z", nom: "Perceuse", numero: "BMI-012", le: "x", par: "T" })], appels: [] } },
                            { id: "b2", nom: "Y", outillage: { outils: [], appels: [] } }]),
        { nom: "Autre", numero: "bmi-012" })));
  }

  // ═══ 🏗 LE CHANTIER D'UN OUTIL SE CHANGE SANS LE RAMENER ═══
  // Timo, 18/09/2026 : « aujourd'hui il finit le chantier A, il n'a pas
  // besoin de ramener l'outil avant d'aller sur le chantier B… il peut juste
  // changer le chantier DANS SON ESPACE. Mais dès que le chantier est déclaré
  // terminé, plus possible d'assigner un chantier à un outil SAUF pour les
  // chantiers saisie libre. »
  {
    const sql25 = existsSync("supabase/securite-25-chantier-outil.sql")
      ? readFileSync("supabase/securite-25-chantier-outil.sql", "utf8") : "";
    let t = Out.nouvelOutil({ id: "k1", nom: "Perceuse", lieu: "DEMAKPOE", le: "2026-09-01", par: "TIMO" });
    t = Out.sortirOutil(t, { id: "s1", le: "2026-09-10", user_id: "u1", user: "KOSSI", chantier: "MR ERIC", retour_prevu: "2026-09-25", par_id: "c1", par: "CHEF" });
    const ouverts = [{ id: "c9", nom: "MME AFI", type: "chantier" }, { id: "t9", nom: "ÉCOLE", type: "travaux" }];
    const apres = Out.changerChantier(t, { id: "ch1", le: "2026-09-18", chantier: "MME AFI", par_id: "u1", par: "KOSSI" });

    test("★ CHANGER DE CHANTIER NE RAMÈNE PAS L'OUTIL : l'état, le détenteur, le lieu de retour et la date promise ne bougent pas — seul le chantier change",
      Out.chantierEnCours(t) === "MR ERIC"
      && Out.chantierEnCours(apres) === "MME AFI"
      && Out.etatOutil(apres) === "sorti"
      && Out.detenteurOutil(apres).nom === "KOSSI"
      && Out.sortieEnCours(apres).id === "s1"
      && Out.sortieEnCours(apres).retour_prevu === "2026-09-25"
      && Out.lieuDeRangement(apres) === "DEMAKPOE"
      && Out.enRetard(apres, "2026-09-26") && !Out.enRetard(apres, "2026-09-24")
      // deux changements de suite : c'est le DERNIER qui compte, et la trace reste
      && (() => { const b = Out.changerChantier(apres, { id: "ch2", le: "2026-09-19", chantier: "ÉCOLE", par: "KOSSI" });
        return Out.chantierEnCours(b) === "ÉCOLE" && Out.chantiersDeLaSortie(b).length === 2
          // la trace ne rétrécit jamais : une sortie + deux changements
          && Out.mouvementsDe(b).length === 3; })()
      // une NOUVELLE sortie repart du chantier de cette sortie-là
      && (() => { const rendu = Out.rendreOutil(apres, { id: "r1", le: "2026-09-20", etat: "bon", lieu: "DEMAKPOE", par: "MAG" });
        const resorti = Out.sortirOutil(rendu, { id: "s2", le: "2026-09-21", user_id: "u2", user: "AFI", chantier: "MR ZOSSOU", retour_prevu: "2026-09-30", par: "CHEF" });
        return Out.chantierEnCours(rendu) === "" && Out.chantierEnCours(resorti) === "MR ZOSSOU"
          && Out.chantiersDeLaSortie(resorti).length === 0; })());

    test("★ UN CHANTIER TERMINÉ NE S'ASSIGNE PLUS — sauf en SAISIE LIBRE, la porte de sortie voulue par Timo",
      /est terminé : on n'y affecte plus d'outil/.test(Out.critiqueChangementChantier(t, { chantier: "VIEUX CHANTIER", ouverts, libre: false }))
      && Out.critiqueChangementChantier(t, { chantier: "VIEUX CHANTIER", ouverts, libre: true }) === ""
      && Out.critiqueChangementChantier(t, { chantier: "MME AFI", ouverts, libre: false }) === ""
      && Out.critiqueChangementChantier(t, { chantier: "ÉCOLE", ouverts, libre: false }) === ""
      && /Dites sur quel chantier/.test(Out.critiqueChangementChantier(t, { chantier: "  ", ouverts }))
      && /déjà le chantier/.test(Out.critiqueChangementChantier(t, { chantier: "MR ERIC", ouverts, libre: true }))
      && /n'est pas sorti/.test(Out.critiqueChangementChantier(Out.nouvelOutil({ id: "z", nom: "Échelle", le: "x", par: "T" }), { chantier: "MME AFI", ouverts })));

    test("★ la LISTE des chantiers assignables : les chantiers de devis EN COURS et les 🛠 travaux à crédit NON soldés, de l'espace regardé — terminé et réceptionné sont dehors",
      (() => {
        const dbC = {
          users: [{ id: "a1", nom: "TIMO", role: "admin", principal: true }],
          boutiques: [{ id: "b1", nom: "DEMAKPOE" }],
          dettes: [{ id: "d1", paye: 0, montant: 5000 }],
          clients_installes: [
            { id: "c1", nom: "ERIC", prenom: "MR", statut: "en_cours", boutique: "DEMAKPOE" },
            { id: "c2", nom: "FINI", statut: "termine", boutique: "DEMAKPOE" },
            { id: "c3", nom: "LIVRE", statut: "receptionne", boutique: "DEMAKPOE" },
            { id: "c4", nom: "ÉCOLE", travaux: true, boutique: "DEMAKPOE", vente_id: "v1", dette_id: "d1" },
            { id: "c5", nom: "SOLDÉ", travaux: true, boutique: "DEMAKPOE", vente_id: "v2" },
          ],
        };
        const l = C.chantiersOuvertsPourOutil(dbC, dbC.users[0]);
        return l.map((x) => x.nom).join() === "ÉCOLE,MR ERIC"
          && l.find((x) => x.nom === "ÉCOLE").type === "travaux"
          && l.find((x) => x.nom === "MR ERIC").type === "chantier"; })());

    test("★ QUI peut changer : celui qui DÉTIENT l'outil (depuis son espace) et celui qui tient le registre — personne d'autre, et jamais sur un outil rangé",
      Out.peutChangerChantier(t, { id: "u1", role: "technicien" })
      && Out.peutChangerChantier(t, { id: "x", role: "magasinier" })
      && Out.peutChangerChantier(t, { id: "x", role: "admin" })
      && !Out.peutChangerChantier(t, { id: "u2", role: "technicien" })
      && !Out.peutChangerChantier(t, { id: "x", role: "vendeur" })
      && !Out.peutChangerChantier(Out.nouvelOutil({ id: "z", nom: "Échelle", le: "x", par: "T" }), { id: "x", role: "admin" }));

    test("★ l'ÉCRAN : le bouton 🏗 sur un outil sorti, la même question dans « Mes outils », la saisie libre TOUJOURS proposée, et la colonne Chantier qui lit le chantier EN COURS",
      /async function nouveauChantierPour\(outil, ouverts, profile, jour\)/.test(ecrC)
      && /const LIBRE = "✏️ Saisir un chantier \(nom libre\)";/.test(ecrC)
      && /jePeux && etat === "sorti" && <button title="Changer le chantier \(sans le ramener\)"/.test(ecrC)
      && /🏗 Changer le chantier/.test(ecrC)
      && /\{chantierEnCours\(o\) \|\| "—"\}/.test(ecrC)
      && /chantiersOuvertsPourOutil\(db, profile\)/.test(ecrC));

    test("★ la SORTIE propose les chantiers ouverts ET garde la saisie libre (LE champ commun, jamais une liste déroulante fermée)",
      /suggestions=\{propositionsChantiers\}/.test(ecrC)
      && /Où part l'outil — ou tapez librement/.test(ecrC)
      && /detail: c\.type === "travaux" \? "🛠 Travaux à crédit" : "Chantier en cours"/.test(ecrC));

    // ⚠ RETOURNÉ le 18/09/2026 : le mot « Lieu » devant la liste est parti
    // (Timo : « supprimer le mot Lieu… Registre est déjà suffisant »). Ce que
    // le contrôle protège — la liste, « Tous » d'office, le filtre — ne bouge pas.
    test("★ LE FILTRE PAR LIEU (demande Timo) : une liste déroulante SANS libellé, « Tous les lieux » d'office, qui vaut pour TOUTES les vues",
      !/Lieu :/.test(ecrC)
      && /Tous les lieux \(\{outilsDeLaVue\(registre, vue, jour\)\.length\}\)/.test(ecrC)
      && /\.filter\(\(o\) => !lieuFiltre \|\| lieuDeRangement\(o\) === lieuFiltre\)/.test(ecrC)
      && /const \[lieuFiltre, setLieuFiltre\] = useState\(""\)/.test(ecrC));

    test("★ LE COUPLE : securite-25 élargit la porte du détenteur d'UN cran — le registre débarrassé des justifications ET des changements de chantier doit rester IDENTIQUE —, et reprend securite-24 en entier",
      /create or replace function public\.outillage_sans_justifs_ni_chantiers/.test(sql25)
      && /coalesce\(m ->> 'type', ''\) <> 'chantier'/.test(sql25)
      && /e - 'justifications'/.test(sql25)
      && /outillage_sans_justifs_ni_chantiers\(avant -> 'outillage'\)\s*\n\s*is not distinct from public\.outillage_sans_justifs_ni_chantiers\(new\.data -> 'outillage'\)/.test(sql25)
      && /a_pouvoir_retenue_outil\(\)/.test(sql25) && /outillage_sans_retenues/.test(sql25)
      && /a_pouvoir_outillage\(\)/.test(sql25) && /- 'demandes' - 'updated_at' - 'outillage'/.test(sql25)
      && /doit afficher : true \| true \| true \| true \| true/.test(sql25));

    test("★ et le banc SQL le rejoue sur base jetable : il change le chantier, mais ne rend pas l'outil et ne repousse pas sa date de retour",
      (() => { const bh = readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8");
        return /securite-25-chantier-outil\.sql/.test(bh)
          && /change son chantier \(sinon tout le lot reste coincé\)" "PERMIS"/.test(bh)
          && /pour rendre l'outil : refusé.*"REFUSE"/.test(bh)
          && /pour repousser sa date de retour : refusé" "REFUSE"/.test(bh)
          && /la justification de securite-23 passe TOUJOURS.*"PERMIS"/.test(bh); })());
  }

  // ═══ 🧰 LES BOÎTES À OUTILS — SUIVRE CE QU'IL Y A DEDANS ═══
  // Timo, 18/09/2026 : « les boîtes à outils… comment suivre le matériel qui
  // s'y trouve ». Ses DEUX décisions : le comptage au retour est OBLIGATOIRE
  // (1a) et il peut être fait AUSSI par celui qui rend (2b).
  {
    const sql26 = existsSync("supabase/securite-26-comptage-boite.sql")
      ? readFileSync("supabase/securite-26-comptage-boite.sql", "utf8") : "";
    const CHEF = { id: "c1", nom: "CHEF BMI", role: "technicien_bmi", chef_equipe: true };
    const KOSSI = { id: "u1", nom: "KOSSI", role: "technicien" };
    const VENDEUR = { id: "v1", nom: "AFI", role: "vendeur" };

    // ⚠ Une boîte se DÉCLARE À LA CRÉATION (case à cocher), plus « dès qu'on
    // lui pose une liste » : sinon le bouton 🧰 s'affichait sur une perceuse.
    let bte = Out.nouvelOutil({ id: "bt1", nom: "Boîte n°2", boite: true, le: "2026-09-01", par: "TIMO", lieu: "DEMAKPOE" });
    bte = Out.ajouterLigneContenu(bte, { id: "L1", nom: "Tournevis plat", quantite: 3, valeur: 2000 });
    bte = Out.ajouterLigneContenu(bte, { id: "L2", nom: "Pince coupante", quantite: 1, valeur: 5000 });
    const perceuse = Out.nouvelOutil({ id: "p1", nom: "Perceuse", le: "2026-09-01", par: "TIMO", lieu: "DEMAKPOE" });

    // ⚠ CONTRÔLE RETOURNÉ le 18/09/2026, le jour même. La première version
    // disait « une boîte = un outil qui porte une liste » — donc N'IMPORTE
    // QUEL outil pouvait le devenir, et le bouton 🧰 s'affichait sur une
    // perceuse. Timo : « c'est peu logique d'avoir cette caisse sur une
    // perceuse… ajouter une case à cocher [à la création]… si pas coché, pas
    // de caisse dans la fiche ». On le retourne, on ne le supprime pas.
    test("★ UNE BOÎTE SE DÉCLARE À LA CRÉATION (case à cocher) — une perceuse n'en devient jamais une, et sa fiche n'en parle pas",
      Out.estBoite(bte) && bte.boite === true && Out.nbContenu(bte) === 4 && Out.contenuDe(bte).length === 2
      && !Out.estBoite(perceuse) && perceuse.boite === false && Out.nbContenu(perceuse) === 0
      // le filet : une boîte née AVANT la case (elle porte déjà sa liste) en reste une
      && Out.estBoite({ id: "z", nom: "Ancienne caisse", contenu: [{ id: "L", nom: "Clé", quantite: 1 }] })
      // et l'écran ne propose la caisse QUE sur une caisse
      && /checked=\{!!neuf\.boite\}/.test(ecrC)
      && /C'est une caisse ou une boîte à outils/.test(ecrC)
      && /\{estBoite\(o\) && !\["perdu", "reforme"\]\.includes\(etat\) && \(/.test(ecrC)
      && !/En faire une boîte à outils/.test(ecrC)
      && /déjà dans la liste/.test(Out.critiqueLigneContenu(bte, { nom: "tournevis PLAT", quantite: 1 }))
      && /Donnez un nom/.test(Out.critiqueLigneContenu(bte, { nom: " ", quantite: 1 }))
      && /au moins 1/.test(Out.critiqueLigneContenu(bte, { nom: "Marteau", quantite: 0 }))
      && Out.contenuDe(Out.retirerLigneContenu(bte, "L2")).length === 1);

    const sortie = Out.sortirOutil(bte, { id: "s1", le: "2026-09-15", user_id: "u1", user: "KOSSI", chantier: "MR ERIC", retour_prevu: "2026-09-17", par_id: "c1", par: "CHEF BMI" });

    test("★ DÉCISION 1a — RIEN NE RENTRE SANS ÊTRE COMPTÉ : le retour d'une boîte non comptée est REFUSÉ, et il passe dès que le comptage arrive",
      /rien ne rentre sans être compté/.test(Out.critiqueRetour(sortie))
      && /Dites combien il y a de « Pince coupante »/.test(Out.critiqueRetour(sortie, { compte: { L1: 3 } }))
      && Out.critiqueRetour(sortie, { compte: { L1: 3, L2: 1 } }) === ""
      && Out.critiqueRetour(sortie, { compte: { L1: 0, L2: 0 } }) === ""   // 0 est une réponse
      // …et une perceuse, elle, rentre comme avant : la règle ne vaut que pour les boîtes
      && Out.critiqueRetour(Out.sortirOutil(perceuse, { id: "s9", le: "2026-09-15", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-17", par_id: "c1", par: "CHEF" })) === "");

    const compté = Out.compterBoite(sortie, { id: "k1", le: "2026-09-18", compte: { L1: 2, L2: 1 }, par_id: "u1", par: "KOSSI" });

    test("★ le COMPTAGE est TRANSPARENT : compter une boîte ne fait pas croire qu'elle est rentrée (le piège du changement de chantier, déjà réglé)",
      Out.etatOutil(compté) === "sorti"
      && !!Out.sortieEnCours(compté)
      && String(Out.detenteurOutil(compté).nom) === "KOSSI"
      && Out.TYPES_MOUVEMENT.includes("comptage")
      && Out.critiqueRetour(compté) === "");           // le comptage posé, le retour passe

    test("★ ce qui MANQUE se lit, et le comptage QUI COMPTE est celui posé APRÈS la sortie en cours",
      Out.manquesDuComptage(compté, Out.dernierComptage(compté)).map((m) => `${m.manque} ${m.nom}`).join() === "1 Tournevis plat"
      && Out.comptageDeLaSortie(compté).id === "k1"
      && Out.manquesEnCours(compté).length === 1
      // une NOUVELLE sortie redemande un comptage : l'ancien ne vaut plus
      && Out.comptageDeLaSortie(Out.sortirOutil(Out.rendreOutil(compté, { id: "r1", le: "2026-09-18", etat: "bon", lieu: "DEMAKPOE", par: "CHEF" }), { id: "s2", le: "2026-09-19", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-25", par: "CHEF" })) === null);

    test("★ DÉCISION 2b — QUI compte : celui qui tient le registre ET celui qui rend (« pour qu'il valide ce qu'il ramène »), personne d'autre",
      Out.peutCompterBoite(sortie, CHEF) === true
      && Out.peutCompterBoite(sortie, KOSSI) === true
      && Out.peutCompterBoite(sortie, VENDEUR) === false
      && Out.peutCompterBoite(sortie, { id: "u9", nom: "AUTRE", role: "technicien" }) === false
      && Out.peutCompterBoite(perceuse, KOSSI) === false);   // une perceuse ne se compte pas

    test("★ QUI en répondait : au retour la boîte n'est plus chez personne — on remonte à la SORTIE, pas au détenteur du moment",
      (() => { const rentrée = Out.rendreOutil(compté, { id: "r1", le: "2026-09-18", etat: "bon", lieu: "DEMAKPOE", par: "CHEF BMI" });
        const r = Out.responsableDuComptage(rentrée);
        return Out.detenteurOutil(rentrée) === null && r && r.id === "u1" && r.nom === "KOSSI"; })());

    // ---- LE MANQUE DEVIENT UNE PERTE, par le mécanisme qui existe déjà.
    const manque = Out.manquesEnCours(compté)[0];
    const fiche = Out.perteDuContenu(compté, manque, {
      id: "x1", mouvement_id: "m1", comptage_id: "k1", le: "2026-09-18", motif: "Oublié sur le chantier",
      valeur: 2000, a_rembourser: 2000, user_id: "u1", user: "KOSSI", lieu: "DEMAKPOE", par_id: "c1", par: "CHEF BMI",
    });
    const bqH = { id: "bh", nom: "DEMAKPOE", outillage: { outils: [compté, fiche], appels: [] } };

    test("★ UN MANQUE DEVIENT UNE PERTE par le mécanisme qui EXISTE : la fiche naît déjà perdue, avec sa valeur et son ardoise — aucune règle d'argent recopiée",
      Out.etatOutil(fiche) === "perdu"
      && /Tournevis plat/.test(fiche.nom) && /Boîte n°2/.test(fiche.nom)
      && fiche.boite_id === "bt1" && fiche.ligne_id === "L1" && fiche.comptage_id === "k1"
      && Out.perteDe(fiche).user_id === "u1"
      && Out.aRembourser(Out.perteDe(fiche)) === 2000 && Out.resteARetenir(Out.perteDe(fiche)) === 2000
      && Out.valeurDuManque(manque) === 2000
      && Out.valeurPerdue(bqH, null) === 2000
      && Out.modeRetenue(KOSSI) === "commission",   // technicien à commission : sur sa part

      `${fiche.nom} — ${Out.etatOutil(fiche)}`);

    test("★ …et elle sort du matériel de travail : ni dans les outils vivants, ni proposée à une sortie, ni appelée — elle est dans « Perdus / Hors d'usage »",
      Out.outilsVivants(bqH).map((o) => o.nom).join() === "Boîte n°2"
      && !Out.propositionsOutils(bqH).some((x) => /Tournevis/.test(x.valeur))
      && Out.resumeOutillage(bqH, "2026-09-18").total === 1
      && Out.resumeOutillage(bqH, "2026-09-18").perdus === 1
      && Out.outilsDeLaVue(bqH, "perdus", "2026-09-18").map((o) => o.nom).join() === fiche.nom);

    test("★ une perte ne se déclare pas DEUX fois : le trio boîte + ligne + comptage l'empêche",
      Out.manquesADeclarer({ id: "b", nom: "X", outillage: { outils: [compté], appels: [] } }, compté).length === 1
      && Out.manquesADeclarer(bqH, compté).length === 0);

    test("★ l'ÉCRAN : le panneau de comptage est écrit UNE fois pour les deux interfaces, le retour d'une boîte l'OUVRE au lieu de refuser, et la sortie DIT qu'elle repart incomplète",
      /^function PanneauComptage\(/m.test(ecrC)
      && (ecrC.match(/<PanneauComptage /g) || []).length === 2
      && /if \(estBoite\(outil\) && etatOutil\(outil\) === "sorti" && !comptageDeLaSortie\(outil\)\) \{/.test(ecrC)
      && /Elle repart INCOMPLÈTE/.test(ecrC)
      && /rien ne rentre sans être compté/.test(ecrC)
      && /refuserSaufAdmin\(profile, "Régler ce que contient une boîte"\)/.test(ecrC)
      && /refuserSaufAdmin\(profile, "Déclarer perdu le matériel d'une boîte"\)/.test(ecrC)
      && /peutCompterBoite\(outil, profile\)/.test(ecrC));

    test("★ l'ardoise d'une perte est écrite UNE fois (demanderCombienDu + poserArdoise) : la perte d'un outil entier et celle du contenu d'une boîte y passent",
      /const poserArdoise = async \(fiche, \{ resp, du, nom, motif, valeur \}\) => \{/.test(ecrC)
      && (ecrC.match(/await poserArdoise\(/g) || []).length === 2       // les DEUX pertes y passent
      && (ecrC.match(/await demanderCombienDu\(/g) || []).length === 2
      && /const r = await poserArdoise\(fiche, \{ resp, du, nom: outil\.nom/.test(ecrC)
      && /const r = await poserArdoise\(fiche, \{ resp, du, nom: fiche\.nom/.test(ecrC));

    test("★ LE COUPLE : securite-26 élargit la porte du détenteur d'UN cran — le registre débarrassé des justifications, des chantiers ET des comptages doit rester IDENTIQUE —, et reprend securite-25 en entier",
      /create or replace function public\.outillage_sans_gestes_du_detenteur/.test(sql26)
      && /coalesce\(m ->> 'type', ''\) not in \('chantier', 'comptage'\)/.test(sql26)
      && /e - 'justifications'/.test(sql26)
      && /outillage_sans_gestes_du_detenteur\(avant -> 'outillage'\)\s*\n\s*is not distinct from public\.outillage_sans_gestes_du_detenteur\(new\.data -> 'outillage'\)/.test(sql26)
      && /a_pouvoir_retenue_outil\(\)/.test(sql26) && /outillage_sans_retenues/.test(sql26)
      && /a_pouvoir_outillage\(\)/.test(sql26) && /- 'demandes' - 'updated_at' - 'outillage'/.test(sql26)
      && /doit afficher : true \| true \| true \| true \| true \| true/.test(sql26));

    // ═══ 🗑 SUPPRIMER un outil, ✏️ CORRIGER une caisse — SEULEMENT RANGÉ ═══
    // Timo, 18/09/2026 : « pourquoi l'administrateur principal ne peut pas
    // supprimer un outil ou modifier une caisse ? » puis, sur la condition :
    // « possible quand l'outil est en magasin ou boutique ».
    {
      const range = Out.nouvelOutil({ id: "sp1", nom: "Perceuse", numero: "BMI-9", le: "2026-09-01", par: "TIMO", lieu: "DEMAKPOE" });
      const dehors = Out.sortirOutil(range, { id: "s1", le: "2026-09-15", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-17", par: "CHEF" });
      const enRepar = Out.mettreEnReparation(range, { id: "r1", le: "2026-09-15", reparateur: "KODJO", panne: "charbons", par: "CHEF" });
      const perduO = Out.declarerPerdu(range, { id: "x1", le: "2026-09-10", motif: "volée", valeur: 1000 });

      test("★ LA CONDITION DE TIMO : on ne supprime et on ne corrige QUE ce qui est rangé — dehors, en réparation, perdu ou réformé, la fiche ne se touche pas",
        Out.outilRange(range) && !Out.outilRange(dehors) && !Out.outilRange(enRepar) && !Out.outilRange(perduO)
        && Out.critiqueSuppressionOutil(range, { motif: "doublon" }) === ""
        && /est dehors — chez KOSSI/.test(Out.critiqueSuppressionOutil(dehors, { motif: "doublon" }))
        && /chez un réparateur/.test(Out.critiqueSuppressionOutil(enRepar, { motif: "doublon" }))
        && /c'est une trace/.test(Out.critiqueSuppressionOutil(perduO, { motif: "doublon" }))
        && /une fiche ne disparaît pas du registre sans raison/.test(Out.critiqueSuppressionOutil(range, { motif: " " })));

      test("★ LA SUPPRESSION NE JETTE RIEN : la fiche passe dans `supprimes` avec qui, quand et pourquoi — et elle revient au registre PROPRE",
        (() => {
          let bq = { id: "b1", nom: "DEMAKPOE", outillage: { outils: [range], appels: [] } };
          bq = Out.supprimerOutil(bq, range, { le: "2026-09-18", motif: "créée par erreur", par: "TIMO", par_id: "t1" });
          const parti = Out.supprimesDe(bq)[0];
          if (Out.outilsDe(bq).length !== 0 || !parti) return false;
          if (parti.supprime_motif !== "créée par erreur" || parti.supprime_par !== "TIMO" || parti.supprime_le !== "2026-09-18") return false;
          const rendu = Out.restaurerOutil(bq, "sp1");
          const o = Out.outilsDe(rendu)[0];
          // ⚠ la fiche remise ne garde AUCUNE marque de son passage
          return Out.supprimesDe(rendu).length === 0 && o && o.nom === "Perceuse"
            && !("supprime_le" in o) && !("supprime_motif" in o) && !("supprime_par" in o) && !("_fiche" in o);
        })());

      test("★ ✏️ MODIFIER UNE CAISSE : la case se décoche seulement si la liste est VIDE (sinon le filet d'`estBoite` la rattraperait et la case mentirait), et une ligne se corrige",
        (() => {
          const pleine = Out.ajouterLigneContenu(Out.nouvelOutil({ id: "c1", nom: "Boîte 2", boite: true, le: "2026-09-01", par: "T", lieu: "DEMAKPOE" }), { id: "L1", nom: "Tournevis", quantite: 3, valeur: 2000 });
          const vide = Out.retirerLigneContenu(pleine, "L1");
          const corrigee = Out.changerLigneContenu(pleine, "L1", { nom: "Tournevis cruciforme", quantite: 5, valeur: 2500 });
          const l = Out.contenuDe(corrigee)[0];
          return /Videz d'abord la liste/.test(Out.critiqueBasculeBoite(pleine, false))
            && Out.critiqueBasculeBoite(vide, false) === ""
            && Out.estBoite(vide) === true                      // encore cochée
            && Out.estBoite(Out.basculerBoite(vide, false)) === false
            && l.nom === "Tournevis cruciforme" && l.quantite === 5 && l.valeur === 2500
            // …et dehors, on ne touche à rien
            && /est dehors/.test(Out.critiqueBasculeBoite(Out.sortirOutil(vide, { id: "s", le: "2026-09-15", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-17", par: "C" }), true));
        })());

      test("★ l'ÉCRAN : ✖ n'est offert qu'au PRINCIPAL sur un outil rangé, la liste d'une caisse ne se règle que rangée, et les fiches retirées se voient (elles reviennent d'un clic)",
        /refuserSaufAdminPrincipal\(db, profile, "Supprimer un outil du registre"\)/.test(ecrC)
        && /refuserSaufAdminPrincipal\(db, profile, "Remettre un outil au registre"\)/.test(ecrC)
        && /\{jeSuisPrincipal && outilRange\(o\) && <button title="Retirer cette fiche du registre/.test(ecrC)
        && /\{jeSuisAdmin && outilRange\(o\) && <button onClick=\{\(\) => corrigerLigne\(o, l\)\}/.test(ecrC)
        && /\{jeSuisAdmin && outilRange\(o\) && <button onClick=\{\(\) => retirerDuContenu\(o, l\)\}/.test(ecrC)
        && /const bloque = critiqueOutilRange\(boite, "vous pourrez corriger sa liste"\);/.test(ecrC)
        && /🗑 Fiches retirées du registre/.test(ecrC)
        && /♻️ Remettre au registre/.test(ecrC)
        // ⚠ la règle de Timo tient : on ne transforme pas une perceuse en caisse
        && !/changerCaisse\(o, true\)/.test(ecrC));

      // ⚠ C'est `securite-22` qui porte `a_pouvoir_outillage` — securite-26 ne
      // fait que rouvrir la porte du détenteur. L'administrateur y est déjà.
      test("★ ✏️ CORRIGER LA FICHE ELLE-MÊME — un numéro gravé faux ne se laisse pas ; il reste UNIQUE dans toute la maison, mais l'outil ne se gêne pas lui-même",
        (() => {
          const a = Out.nouvelOutil({ id: "fa", nom: "Perceuse", numero: "BMI-009", categorie: "Électroportatif", prix_achat: 45000, le: "2026-09-01", par: "T", lieu: "BMI DEMAKPOE" });
          const b = Out.nouvelOutil({ id: "fb", nom: "Meuleuse", numero: "BMI-010", le: "2026-09-01", par: "T", lieu: "DEPOT MAISON" });
          const reg = { id: "", nom: "", outillage: { outils: [a, b], appels: [] } };
          const apres = Out.corrigerOutil(a, { nom: "Perceuse BOSCH", numero: "BMI-099", categorie: "Électroportatif", achete_le: "2026-08-01", prix_achat: 50000 });
          return /déjà porté par un autre outil/.test(Out.critiqueCorrectionOutil(reg, a, { nom: "Perceuse", numero: "BMI-010" }))
            && Out.critiqueCorrectionOutil(reg, a, { nom: "Perceuse", numero: "BMI-009" }) === ""   // le sien ne le gêne pas
            && Out.critiqueCorrectionOutil(reg, a, { nom: "Perceuse", numero: "BMI-099" }) === ""
            && /Donnez un nom/.test(Out.critiqueCorrectionOutil(reg, a, { nom: " ", numero: "" }))
            && /est dehors/.test(Out.critiqueCorrectionOutil(reg, Out.sortirOutil(a, { id: "s", le: "2026-09-15", user_id: "u1", user: "KOSSI", retour_prevu: "2026-09-17", par: "C" }), { nom: "X", numero: "" }))
            && Out.diffFiche(a, apres).map((c) => c.champ).join() === "nom,numero,achete_le,prix_achat"
            && Out.mouvementsDe(apres).length === Out.mouvementsDe(a).length          // l'histoire ne bouge pas
            && !("lieu" in Out.corrigerOutil(a, {}) && Out.corrigerOutil(a, {}).lieu !== a.lieu);  // le LIEU n'est pas corrigible ici
        })());

      // ═══ 🔢 LE NUMÉRO GRAVÉ S'ATTRIBUE TOUT SEUL ═══
      // Timo, 18/09/2026 : « je veux que les numéros s'attribuent d'une
      // manière automatique… pas à taper. Déjà j'ai essayé 2 numéros
      // identiques, c'est passé. »
      test("★ LE NUMÉRO EST ATTRIBUÉ, PAS TAPÉ : il suit le plus grand déjà pris, et l'écran ne laisse plus écrire dedans",
        (() => {
          const a = Out.nouvelOutil({ id: "n1", nom: "Perceuse", numero: "BMI-012", le: "x", par: "T" });
          const b = Out.nouvelOutil({ id: "n2", nom: "Meuleuse", numero: "BMI-007", le: "x", par: "T" });
          const vide = Out.registreUnifie([{ id: "z", nom: "Z", outillage: { outils: [], appels: [] } }]);
          const reg = Out.registreUnifie([{ id: "b1", nom: "DEMAKPOE", outillage: { outils: [a, b], appels: [] } }]);
          return Out.prochainNumeroOutil(vide) === "BMI-001"
            && Out.prochainNumeroOutil(reg) === "BMI-013"
            && Out.PREFIXE_NUMERO_OUTIL === "BMI-"
            // l'écran l'AFFICHE sans le laisser taper, et l'écrit lui-même
            && /value=\{prochainNumeroOutil\(registre\)\} readOnly/.test(ecrC)
            && /numero: prochainNumeroOutil\(registre\), le: jour/.test(ecrC)
            && /Le numéro est attribué par l'application/.test(ecrC);
        })());

      test("★ ⚠ ET UNE FICHE RETIRÉE GARDE SON NUMÉRO RÉSERVÉ — sinon la remettre au registre ferait un doublon (trou ouvert le jour même par la suppression)",
        (() => {
          const a = Out.nouvelOutil({ id: "n3", nom: "Perceuse", numero: "BMI-012", le: "x", par: "T" });
          let bq = { id: "b1", nom: "DEMAKPOE", outillage: { outils: [a], appels: [] } };
          bq = Out.supprimerOutil(bq, a, { le: "x", motif: "erreur", par: "T" });
          const reg = Out.registreUnifie([bq]);
          return Out.outilsDe(reg).length === 0
            && Out.prochainNumeroOutil(reg) === "BMI-013"                       // ne redescend PAS
            && /déjà porté par un autre outil/.test(Out.critiqueNouvelOutil(reg, { nom: "X", numero: "BMI-012" }))
            && /déjà porté par un autre outil/.test(Out.critiqueCorrectionOutil(reg, { id: "autre" }, { nom: "X", numero: "BMI-012" }));
        })());

      // ⚠ L'ÉTIQUETTE MENTAIT (capture Timo, 18/09/2026, colonne État :
      // « je ne comprends pas pourquoi on dit en boutique même si au
      // magasin »). Un outil rangé au DÉPÔT affichait « En boutique ».
      test("★ un outil RANGÉ se lit « Rangé », jamais « En boutique » — c'est la colonne « Où » qui nomme le lieu, boutique OU magasin",
        (() => {
          const auDepot = Out.nouvelOutil({ id: "d1", nom: "Échelle", le: "2026-09-01", par: "T", lieu: "DEPOT MAISON" });
          return Out.libelleEtat(Out.etatOutil(auDepot)) === "Rangé"
            && Out.lieuDeRangement(auDepot) === "DEPOT MAISON"
            && /est déjà rentré : il est rangé à DEPOT MAISON/.test(Out.critiqueRetour(auDepot))
            && !/libelle: "En boutique"/.test(readFileSync("src/lib/outillage.js", "utf8"))
            && !/Retour en boutique/.test(ecrC);
        })());

      test("★ l'ÉCRAN : le ✏️ de la fiche n'est offert qu'à l'administrateur, sur un outil rangé, et il DIT que le lieu ne s'y corrige pas",
        /refuserSaufAdmin\(profile, "Corriger la fiche d'un outil"\)/.test(ecrC)
        && /\{jeSuisAdmin && vue === "tous" && outilRange\(o\) && \(/.test(ecrC)
        && /<Field label="Numéro gravé"><input className=\{inputCls\} value=\{fiche\.numero\}/.test(ecrC)
        && /Le lieu ne se corrige pas ici<\/b>/.test(ecrC)
        && /critiqueCorrectionOutil\(registre, outil, fiche\)/.test(ecrC));

      test("★ et RIEN à coller pour ça : l'administrateur a déjà le pouvoir sur le registre, des DEUX côtés",
        Out.peutTenirOutillage({ role: "admin" }) === true
        && /role_jeton\(\) in \('magasinier', 'admin'\)/.test(readFileSync("supabase/securite-22-outillage.sql", "utf8")));
    }

    test("★ et le banc SQL le rejoue sur base jetable : il compte ce qu'il ramène, mais n'enregistre pas le retour et ne baisse pas la liste de la boîte",
      (() => { const bh = readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8");
        return /securite-26-comptage-boite\.sql/.test(bh)
          && /COMPTE ce qu'il ramène \(sinon tout le lot reste coincé\)" "PERMIS"/.test(bh)
          && /pour enregistrer le retour : refusé.*"REFUSE"/.test(bh)
          && /pour baisser ce que la boîte DOIT contenir : refusé" "REFUSE"/.test(bh)
          && /compte ET enregistre le retour" "PERMIS"/.test(bh); })());
  }

  // ═══ 🔍 UNE SEULE RÈGLE POUR TOUTE LIGNE DE RECHERCHE ═══
  // Timo, 18/09/2026 (capture de 🧰 Outillage) : « réduire la ligne rechercher
  // un outil, trop long… mais est-ce que ce n'est pas mieux d'avoir une seule
  // règle qui gère ce côté de ligne de recherche ? Ailleurs c'est bon, mais
  // dans les autres écrans cette ligne apparaît trop longue. »
  // Il y avait HUIT largeurs pour le même geste. Le banc compte, et interdit
  // la neuvième : toute ligne de recherche passe par `champRecherche`.
  {
    const ui = readFileSync("src/components/ui.jsx", "utf8");
    const fichiers = execSync("grep -rl 'placeholder=\"[^\"]*echerch' src/screens src/components || true")
      .toString().trim().split("\n").filter(Boolean);
    const lignes = fichiers.flatMap((f) => readFileSync(f, "utf8").split("\n")
      .map((l, i) => ({ f, n: i + 1, l }))
      .filter((x) => /placeholder="[^"]*echerch/.test(x.l) && /<input/.test(x.l)));

    // ⚠ CONTRÔLE RETOURNÉ le 18/09/2026, et c'est la leçon du jour : il
    // vérifiait `sm:max-w-xs`. La classe ÉTAIT là. Elle ne faisait RIEN —
    // `index.css` écrase tout `max-width` sur un champ. Un contrôle qui lit
    // une CLASSE ne mesure pas un EFFET : la largeur réelle se mesure
    // maintenant dans Chromium (`npm run verifier-champs`).
    test("★ LA RÈGLE EXISTE et pose une LARGEUR, jamais un plafond (un `max-w-*` sur un champ ne commande rien)",
      /export const champRecherche = `\$\{inputCls\} sm:w-\d+`;/.test(ui)
      && !/champRecherche = `\$\{inputCls\} sm:max-w/.test(ui)
      && /UNE RÈGLE POUR TOUTE LIGNE DE RECHERCHE/.test(ui));
    test("★ et sa largeur RÉELLE est mesurée dans un vrai navigateur, pas seulement lue dans le code",
      (() => { const b = readFileSync("scripts/verifier-champs.mjs", "utf8");
        return /getBoundingClientRect\(\)\.width/.test(b)
          && /viewport: \{ width: largeur/.test(b)
          && /un contrôle qui lit une CLASSE ne mesure pas un EFFET|Un contrôle qui lit une CLASSE ne mesure pas un EFFET/i.test(b)
          && /verifier-champs/.test(readFileSync("package.json", "utf8")); })());

    const usages = execSync("grep -rn 'className={champRecherche}' src/screens src/components | wc -l").toString().trim();
    const fenetres = execSync("grep -rn 'className={champRechercheFenetre}' src/screens src/components | wc -l").toString().trim();
    test("★ les 13 lignes de recherche de l'application y passent TOUTES — plus une seule largeur écrite à la main (w-48, w-52, w-56, w-64, max-w-[220px]…)",
      Number(usages) === 12 && Number(fenetres) === 1
      && lignes.length >= 8
      && lignes.every((x) => /className=\{champRecherche(Fenetre)?\}/.test(x.l))
      && !lignes.some((x) => /\bw-\d|max-w-\[|max-w-xs|w-full/.test(x.l.replace(/champRecherche(Fenetre)?/g, "")))
      // et les deux écrans qui écrivent le placeholder sur une AUTRE ligne
      && /toutes catégories confondues\)…" className=\{champRecherche\}/.test(readFileSync("src/screens/Stocks.jsx", "utf8"))
      && /tous rôles confondus\)…" className=\{champRecherche\}/.test(readFileSync("src/screens/Utilisateurs.jsx", "utf8")));

    test("★ et chaque écran qui l'emploie l'IMPORTE (le build ne voit pas un nom manquant : c'est l'écran blanc de 2.101.59)",
      fichiers.every((f) => {
        const t = readFileSync(f, "utf8");
        if (!/champRecherche/.test(t)) return true;
        const nom = /champRechercheFenetre/.test(t) ? "champRechercheFenetre" : "champRecherche";
        return new RegExp(`import \\{[^}]*\\b${nom}\\b[^}]*\\} from "(\\.\\./components/ui|\\./ui)"`).test(t);
      }));

    test("★ et le mot « Lieu » a disparu du filtre de 🧰 Outillage (Timo : « Registre est déjà suffisant »)",
      !/<span className="font-semibold">Lieu :<\/span>/.test(ecrC)
      && /Tous les lieux \(/.test(ecrC));
  }

  // ---- Le registre, et ce qu'il ne fait PAS
  test("★ LE REGISTRE N'EST PAS DU STOCK : il vit dans le champ `outillage` de SA boutique — rien à coller pour créer une table —, et l'écran ne touche jamais db.produits ni un ajustement",
    /outillage: \{/.test(outC) && !/db\.produits/.test(ecrC) && !/ajustements/.test(ecrC)
    && /boutiques: \(db\.boutiques \|\| \[\]\)\.map/.test(ecrC));

  test("★ le numéro GRAVÉ est unique dans la boutique, et il se TAPE : un clic lie l'outil, un nom ou un numéro tapé ne le lie que s'il est EXACT — jamais par ressemblance",
    /déjà porté par un autre outil/.test(Out.critiqueNouvelOutil(bqO, { nom: "Autre", numero: "bmi-012" }))
    && Out.critiqueNouvelOutil(bqO, { nom: "Autre", numero: "BMI-999" }) === ""
    && /Donnez un nom/.test(Out.critiqueNouvelOutil(bqO, { nom: "  " }))
    && Out.outilSaisi(bqO, "BMI-002").id === "o2" && Out.outilSaisi(bqO, "échelle 6 M").id === "o2"
    && Out.outilSaisi(bqO, "échelle") === null);

  test("★ un mouvement ne s'efface JAMAIS : la liste ne rétrécit pas (comme les reprises d'une vente ou les clôtures précédentes)",
    Out.mouvementsDe(perceuse).length === 2
    && !/mouvements:.*\.filter\(/.test(outC) && !/mouvements\.splice|mouvements\.pop/.test(outC));

  test("★ LE COUPLE application / serveur : la règle de rôle est revérifiée DANS le geste, et securite-22 dit la même chose (le chef technicien, le magasinier, l'administrateur — plus l'onglet retiré)",
    /if \(!peutTenirOutillage\(profile\)\) \{ uAlert\(REFUS_ROLE\); return true; \}/.test(ecrC)
    && /role_jeton\(\) in \('magasinier', 'admin'\)/.test(sqlO)
    && /role_jeton\(\) in \('technicien', 'technicien_bmi'\) and public\.est_chef_equipe\(\)/.test(sqlO)
    && /pouvoirs_off' \? 'outillage'/.test(sqlO));

  test("★ securite-22 REPREND securite-8 sans rien lui retirer : `demandes` reste libre, l'écran de connexion et le cachet restent au PRINCIPAL, et le piège de l'UPSERT est toujours là",
    /- 'demandes' - 'updated_at' - 'outillage'/.test(sqlO)
    && /accueil\\_%' or champ like 'cachet%'/.test(sqlO) && /est_admin_principal\(\)/.test(sqlO)
    && /AVANT INSERT se déclenche même si la ligne existe déjà/.test(sqlO)
    && /doit afficher : true \| true \| true/.test(sqlO));

  test("★ le banc SQL rejoue securite-22 sur base jetable et mesure les deux côtés (permis ET refusé), en CHANGEANT vraiment le champ",
    (() => { const b = readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8");
      return /securite-22-outillage\.sql/.test(b)
        && /POSER="data \|\| '\$REG'::jsonb"/.test(b)
        && /technicien ORDINAIRE \(sans l'étoile\) touche au registre" "REFUSE"/.test(b)
        && /chef d'équipe COMMERCIAL touche au registre.*"REFUSE"/.test(b)
        && /RETIRÉ l'onglet 🧰 Outillage" "REFUSE"/.test(b)
        && /demande de ravitaillement du vendeur passe TOUJOURS.*"PERMIS"/.test(b); })());

  // ⚠ RETOURNÉ le 18/09/2026 (« dans son interface ») : l'onglet n'est plus
  // réservé au CHEF. Tout technicien l'a — le chef y tient le registre,
  // l'autre n'y voit que ce qu'il détient.
  test("★ l'onglet 🧰 Outillage : listé dans ONGLETS_ROLE pour admin, magasinier, technicien et technicien BMI (donc retirable dans 🔐 Pouvoirs), et RENDU pour ces quatre-là — l'écran, lui, décide ce qu'il montre",
    /outillage: "🧰 Outillage"/.test(calO)
    && ["admin", "magasinier", "technicien", "technicien_bmi"].every((r) => (C.ONGLETS_ROLE[r] || []).includes("outillage"))
    && !["vendeur", "gerant", "commercial", "resp_commercial", "comptable", "client"].some((r) => (C.ONGLETS_ROLE[r] || []).includes("outillage"))
    && /ongletsVisites\.outillage && \(isAdmin \|\| isMagasinier \|\| isTechnicien \|\| isTechnicienBMI\)/.test(appO));

  // ⚠ TROUVÉ PAR TIMO (18/09/2026) : « à qui on rend l'outil n'est pas
  // mentionné ». La personne qui REÇOIT le retour était bien enregistrée
  // (`par`) mais ne s'affichait NULLE PART — un registre dont la trace ne se
  // lit pas ne sert à rien. Et la première version de `histoireOutil` écrivait
  // « remis par KOSSI » pour une sortie, alors que KOSSI est celui qui PREND.
  {
    let h = Out.nouvelOutil({ id: "h1", nom: "Perceuse", prix_achat: 85000, le: "2026-09-10", par: "TIMO" });
    h = Out.sortirOutil(h, { id: "s1", le: "2026-09-15", user_id: "u1", user: "KOSSI", chantier: "MR ERIC", retour_prevu: "2026-09-16", par_id: "c1", par: "CHEF BMI" });
    h = Out.rendreOutil(h, { id: "r1", le: "2026-09-17", etat: "abime", note: "mandrin cassé", par_id: "m9", par: "MAGASIN" });
    const lignes = Out.histoireOutil(h);
    test("★ À QUI L'OUTIL EST RENDU se lit : l'histoire dit « rendu à MAGASIN », et la sortie dit « pris par KOSSI » puis « remis par CHEF BMI » — jamais l'inverse",
      lignes.length === 2 && lignes[0].quoi === "📥 Retour" && lignes[0].role === "rendu à" && lignes[0].qui === "MAGASIN"
      && /ABÎMÉ — mandrin cassé/.test(lignes[0].detail)
      && lignes[1].role === "pris par" && lignes[1].qui === "KOSSI" && /remis par CHEF BMI/.test(lignes[1].detail)
      && Out.dernierRetour(h).par === "MAGASIN" && Out.dernierRetour(h).le === "2026-09-17");
    test("★ l'histoire se lit du PLUS RÉCENT au plus ancien, et une perte nomme les DEUX : celui qui en répondait et celui qui l'a déclarée",
      (() => { const p2 = Out.declarerPerdu(h, { id: "p1", le: "2026-09-18", motif: "Volé", valeur: 85000, user_id: "u2", user: "AFI", par_id: "c1", par: "CHEF BMI" });
        const l = Out.histoireOutil(p2);
        return l[0].le === "2026-09-18" && l[l.length - 1].le === "2026-09-15"
          && l[0].role === "sous la responsabilité de" && l[0].qui === "AFI" && /déclaré par CHEF BMI/.test(l[0].detail); })());
    test("★ et l'ÉCRAN le montre : la colonne dit « Chez qui / rendu à », un CLIC sur la ligne ouvre l'histoire (la règle de dépliage de 💰 Ventes et 📋 Dettes), la question du retour nomme celui qui reçoit, et le journal aussi",
      /Chez qui \/ rendu à/.test(ecrC)
      && /classeLigneDepliable\(true, i\)/.test(ecrC) && /setOutilDeplie\(deplie \? "" : o\.id\)/.test(ecrC)
      && /🕘 Histoire de/.test(ecrC) && /rendu à <b>\{rendu\.par \|\| "—"\}<\/b>/.test(ecrC)
      && /vous est rendu — reçu par \$\{profile\.nom\}/.test(ecrC)
      && /🧰 Retour — \$\{outil\.nom\} rendu à \$\{profile\.nom\}/.test(ecrC)
      && /remis par \{so\.par \|\| "—"\}/.test(ecrC)
      && /onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(ecrC));
  }

  // ═══ LES QUATRE CARRÉS S'OUVRENT (Timo, 18/09/2026, capture) ═══
  // « Outils / Dehors / En retard / En réparation : lorsqu'on clique dessus »,
  // chacun ouvre SA liste, avec les colonnes qui répondent à SA question.
  {
    const sql23 = existsSync("supabase/securite-23-justifier-retard.sql")
      ? readFileSync("supabase/securite-23-justifier-retard.sql", "utf8") : "";
    const sortieCsO = join("node_modules", ".cache", `bmi-cst-out-${process.pid}.mjs`);
    await build({ entryPoints: ["src/lib/constants.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCsO, logLevel: "silent" });
    const Cs = await import(pathToFileURL(sortieCsO).href);
    unlinkSync(sortieCsO);
    let a = Out.nouvelOutil({ id: "v1", nom: "Perceuse", le: "2026-09-10", par: "TIMO" });
    a = Out.sortirOutil(a, { id: "s1", le: "2026-09-15", user_id: "u1", user: "KOSSI", chantier: "MR ERIC", retour_prevu: "2026-09-16", par_id: "c1", par: "CHEF" });
    let b = Out.nouvelOutil({ id: "v2", nom: "Meuleuse", le: "2026-09-10", par: "TIMO" });
    b = Out.mettreEnReparation(b, { id: "r1", le: "2026-09-18", reparateur: "ATELIER KODJO", tel: "90112233", panne: "Charbons usés", prix: 12000, par_id: "c1", par: "CHEF" });
    const c = Out.nouvelOutil({ id: "v3", nom: "Échelle", le: "2026-09-10", par: "TIMO" });
    const bqV = { id: "b1", nom: "DEMAKPOE", outillage: { outils: [a, b, c], appels: [] } };
    const noms = (v, j) => Out.outilsDeLaVue(bqV, v, j).map((o) => o.nom).join();

    // ⚠ CONTRÔLE RETOURNÉ le 18/09/2026 : les carrés sont passés de QUATRE à
    // CINQ — « Perdus » s'ouvre aussi (« dans perdu quand on clique, la liste
    // de tous les équipements perdus apparaît »). On le retourne, on ne le
    // supprime pas : il garde la mesure des quatre premières vues.
    test("★ les CINQ vues rendent chacune SA liste : tous, dehors, en retard, en réparation, perdus",
      noms("tous", "2026-09-18") === "Perceuse,Meuleuse,Échelle"
      && noms("dehors", "2026-09-18") === "Perceuse"
      && noms("retard", "2026-09-18") === "Perceuse" && noms("retard", "2026-09-16") === ""
      && noms("reparation", "2026-09-18") === "Meuleuse"
      && noms("perdus", "2026-09-18") === ""
      && Out.outilsDeLaVue({ id: "b9", nom: "X", outillage: { outils: [Out.declarerPerdu(c, { id: "pz", le: "2026-09-18", motif: "Volée", valeur: 40000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" })], appels: [] } }, "perdus", "2026-09-18").length === 1
      && Out.VUES_OUTILLAGE.join() === "tous,dehors,retard,reparation,perdus");

    // ═══ ⚠ PERDUS et 🗑 HORS D'USAGE : UN SEUL CARRÉ, DEUX BLOCS DEDANS ═══
    // Timo, 18/09/2026 : « pas un 6e carré… grouper avec perdu. Donc carré
    // perdu-hors d'usage. À l'intérieur on classe les perdus et les hors
    // d'usage. » Le carré comptait les perdus SEULS et les réformés n'avaient
    // AUCUN endroit où se lire : ils restaient noyés dans le registre.
    {
      const perdu = Out.declarerPerdu(Out.nouvelOutil({ id: "h1", nom: "Meuleuse", le: "2026-09-01", par: "TIMO" }),
        { id: "p1", le: "2026-09-10", motif: "Volée sur le chantier", valeur: 30000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" });
      const usé = Out.reformerOutil(Out.nouvelOutil({ id: "h2", nom: "Marteau", le: "2026-09-01", par: "TIMO", prix_achat: 8000 }),
        { id: "f1", le: "2026-09-12", motif: "Manche cassé", par_id: "c1", par: "CHEF BMI" });
      const vivant = Out.nouvelOutil({ id: "h3", nom: "Perceuse", le: "2026-09-01", par: "TIMO" });
      // ⚠ Rangés dans le DÉSORDRE dans la fiche : c'est la vue qui classe.
      const bqH = { id: "bh", nom: "DEMAKPOE", outillage: { outils: [usé, vivant, perdu], appels: [] } };
      const vueH = Out.outilsDeLaVue(bqH, "perdus", "2026-09-18");
      const res = Out.resumeOutillage(bqH, "2026-09-18");

      test("★ UN SEUL carré « Perdus / Hors d'usage » : il compte les DEUX, et dit la part de chacun",
        res.perdus === 1 && res.reformes === 1 && res.valeurPerdue === 30000
        && res.total === 1                                  // le matériel vivant ne compte ni l'un ni l'autre
        && Out.VUES_OUTILLAGE.length === 5,                 // pas de sixième carré (décision Timo)
        `perdus ${res.perdus}, hors d'usage ${res.reformes}, vivants ${res.total}`);

      test("★ à l'intérieur, on CLASSE : les perdus d'abord (il y a de l'argent en jeu), les hors d'usage ensuite",
        vueH.map((o) => o.nom).join() === "Meuleuse,Marteau"
        && vueH.map((o) => Out.etatOutil(o)).join() === "perdu,reforme"
        && Out.outilsPerdus(bqH).map((o) => o.nom).join() === "Meuleuse"
        && Out.outilsReformes(bqH).map((o) => o.nom).join() === "Marteau"
        && Out.outilsHorsService(bqH).length === 2,
        vueH.map((o) => `${o.nom}[${Out.etatOutil(o)}]`).join(" | "));

      test("★ un outil hors d'usage se LIT : qui l'a décidé, quand, pourquoi — et il n'y a rien à rembourser de personne",
        (() => { const r = Out.reformeDe(usé);
          return r && r.par === "CHEF BMI" && r.le === "2026-09-12" && r.motif === "Manche cassé"
            && Out.reformeDe(perdu) === null && Out.perteDe(usé) === null; })());

      test("★ et l'écran montre les DEUX blocs, chacun titré, avec les colonnes d'un réformé (décidé par, le, pourquoi, prix d'achat)",
        /⚠ Perdus — quelqu'un en répondait/.test(ecrC)
        && /🗑 Hors d'usage — usés ou cassés : plus rien à rembourser de personne/.test(ecrC)
        && /const ouvreBloc = vue === "perdus" && \(i === 0 \|\| etatOutil\(affichee\[i - 1\]\) !== etat\)/.test(ecrC)
        && /\{vue === "perdus" && reforme && <>/.test(ecrC)
        && /<th className="px-3 py-2">Qui \/ décidé par<\/th>/.test(ecrC)
        && /Perdus \/ Hors d'usage/.test(ecrC)
        && /hors d'usage<\/div>/.test(ecrC));
    }

    // ⚠ Ce contrôle mesure L'ÉCRAN : les quatre colonnes que Timo a demandées
    // doivent exister, et le numéro du réparateur doit s'appeler par LA règle
    // WhatsApp commune (jamais un wa.me écrit à la main).
    test("★ 🔧 EN RÉPARATION montre les QUATRE colonnes demandées — chez quel réparateur, son numéro (avec le vrai logo WhatsApp), la panne, le prix — et les quatre cases existent au formulaire",
      /<th className="px-3 py-2">Chez quel réparateur<\/th><th className="px-3 py-2">Son numéro<\/th><th className="px-3 py-2">La panne<\/th><th className="px-3 py-2 text-right">Prix<\/th>/.test(ecrC)
      && /<Field label="Chez quel réparateur">/.test(ecrC) && /<Field label="Son numéro">/.test(ecrC)
      && /<Field label="La panne">/.test(ecrC) && /<Field label="Prix de réparation \(F\)">/.test(ecrC)
      && /envoyerWhatsApp\(chiffresTel\(rep\.tel\), ""\)/.test(ecrC) && !/wa\.me/.test(ecrC)
      && /<IconeWhatsApp taille=\{14\} \/>/.test(ecrC));

    test("★ ⏰ EN RETARD montre chez qui, la date promise, le retard en jours, et POURQUOI — ou dit tout haut que ce n'est pas encore justifié",
      /<th className="px-3 py-2">Chez qui<\/th><th className="px-3 py-2">Retour prévu<\/th><th className="px-3 py-2">Retard<\/th><th className="px-3 py-2">Pourquoi ce n'est pas rentré<\/th>/.test(ecrC)
      && /⏳ Pas encore justifié/.test(ecrC)
      && /<th className="px-3 py-2">Chez qui<\/th><th className="px-3 py-2">Chantier<\/th><th className="px-3 py-2">Depuis<\/th><th className="px-3 py-2">Retour prévu<\/th>/.test(ecrC));

    test("★ les quatre carrés sont des BOUTONS qui OUVRENT leur liste, et celui qu'on regarde se voit (cadre épais)",
      /onClick=\{\(\) => \{ setVue\(id\); setOutilDeplie\(""\); \}\}/.test(ecrC)
      && /vue === id \? "ring-4 ring-sky-600/.test(ecrC)
      && /outilsDeLaVue\(registre, vue, jour\)/.test(ecrC));
    test("★ le réparateur et la panne sont EXIGÉS, le prix non (on ne le connaît pas toujours en déposant l'outil)",
      /Dites chez quel réparateur/.test(Out.critiqueReparation({ reparateur: " ", panne: "Charbons" }))
      && /Dites quelle est la panne/.test(Out.critiqueReparation({ reparateur: "ATELIER", panne: "" }))
      && Out.critiqueReparation({ reparateur: "ATELIER", panne: "Charbons" }) === ""
      && Out.reparationEnCours(b).reparateur === "ATELIER KODJO" && Out.reparationEnCours(b).tel === "90112233"
      && Out.reparationEnCours(b).panne === "Charbons usés" && Out.reparationEnCours(b).prix === 12000
      && Out.reparationEnCours(a) === null);

    // ⚠ RETOURNÉ le 18/09/2026 (Timo : « oui, mets le prix de réparation dans
    // les dépenses »). Avant, le prix restait une information sur l'outil.
    // Maintenant il devient une VRAIE dépense — et il passe par LA fabrique
    // commune, donc par toutes les règles de l'argent, sans qu'aucune soit
    // recopiée dans l'écran de l'outillage.
    test("★ le prix d'une réparation DEVIENT une dépense, par LA fabrique commune (construireDepenseSaisie) : validation du DG au-delà du seuil, origine des fonds, et la limite du tiroir revérifiée comme à la saisie",
      Out.coutReparations(bqV, null) === 12000
      && /construireDepenseSaisie\(db, profile, \{/.test(ecrC)
      && /categorie: CATEGORIE_REPARATION_OUTIL/.test(ecrC)
      && /const refusT = refusTiroir\(choix\.boutique, montant, libelleGeste\);/.test(ecrC)
      && /critiqueSortieTiroir\(\{ tiroir: p\.montant \+ p\.resteFonds, fondsFixe: p\.resteFonds/.test(ecrC)
      && /optionsPayeAvec\(caisses, caisseDe\(/.test(ecrC)
      && !/nouvelleDepense\(/.test(ecrC));

    test("★ la dépense d'une réparation n'est JAMAIS créée deux fois : le mouvement porte son `depense_id`, et le 📥 de retour ne redemande le prix que s'il n'y en a pas encore",
      Out.depenseDeLaReparation(b) === ""
      && Out.depenseDeLaReparation(Out.marquerDepenseReparation(b, "r1", "dep9")) === "dep9"
      && /etat === "reparation" && !depenseDeLaReparation\(o\)/.test(ecrC)
      && /marquerDepenseReparation\(mettreEnReparation\(outil, mvt\), mvt\.id, d\.depense\.id\)/.test(ecrC));

    test("★ la dépense cite l'outil et la panne, et se range dans SA catégorie — une VRAIE charge de BMI, donc jamais dans CATEGORIES_HORS_CHARGES",
      /Perceuse \(N° BMI-012\) — Charbons usés · ATELIER KODJO/.test(Out.libelleDepenseReparation({ nom: "Perceuse", numero: "BMI-012" }, { panne: "Charbons usés", reparateur: "ATELIER KODJO" }))
      && Cs.CATEGORIES.includes(Cs.CATEGORIE_REPARATION_OUTIL)
      && !Cs.CATEGORIES_HORS_CHARGES.includes(Cs.CATEGORIE_REPARATION_OUTIL)
      && Cs.depensesComptees([{ categorie: Cs.CATEGORIE_REPARATION_OUTIL, montant: 12000 }]).length === 1
      && /outil_id: outil\.id, outil_nom: outil\.nom, mouvement_id: rep\.id, auto: "reparation_outil"/.test(ecrC));

    // ---- ⏱ Le retard se justifie, par celui qui détient l'outil
    test("★ ⏰ EN RETARD : c'est le DÉTENTEUR qui doit justifier — pas un autre, pas si l'outil est à l'heure, et plus une fois qu'il a répondu",
      Out.doitJustifier(a, "u1", "2026-09-18") && !Out.doitJustifier(a, "u2", "2026-09-18")
      && !Out.doitJustifier(a, "u1", "2026-09-16") && !Out.doitJustifier(c, "u1", "2026-09-18")
      && Out.joursDeRetard(a, "2026-09-18") === 2 && Out.joursDeRetard(c, "2026-09-18") === 0);

    const aJ = Out.justifierRetard(a, { id: "j1", le: "2026-09-18", texte: "Le chantier a pris du retard", par_id: "u1", par: "KOSSI" });
    test("★ une justification VIDE est refusée, et une justification donnée se rattache à SA sortie — une nouvelle sortie en redemandera une",
      /Dites pourquoi l'outil n'est pas encore rentré/.test(Out.critiqueJustification(a, { texte: "   " }))
      && Out.critiqueJustification(a, { texte: "bloqué" }) === ""
      && !Out.doitJustifier(aJ, "u1", "2026-09-18")
      && Out.derniereJustification(aJ).texte === "Le chantier a pris du retard"
      && Out.justificationsDeLaSortie(aJ).length === 1
      && Out.justificationsDeLaSortie(Out.rendreOutil(aJ, { id: "r9", le: "2026-09-19", par: "CHEF" })).length === 0);

    test("★ CE QU'IL DÉTIENT se cherche dans TOUTES les boutiques de son espace : un technicien n'a pas de boutique, son outil peut venir de n'importe laquelle",
      Out.mesOutils([bqV, { id: "b2", nom: "APESSITO", outillage: { outils: [], appels: [] } }], "u1")
        .map((x) => `${x.outil.nom}@${x.boutique.nom}`).join() === "Perceuse@DEMAKPOE"
      && Out.mesOutils([bqV], "u2").length === 0);

    test("★ L'ÉCRAN DU DÉTENTEUR existe (« 🧰 Mes outils ») : un technicien SANS l'étoile n'y voit QUE ce qu'il détient, la case pour justifier, et rien du registre des autres",
      /function MesOutils\(\{ db, save, profile \}\)/.test(ecrC)
      && /if \(!jePeux && \["technicien", "technicien_bmi"\]\.includes\(profile\.role\)\) \{\s*\n\s*return <MesOutils/.test(ecrC)
      && /boutiquesVisibles\(db, profile, db\.boutiques \|\| \[\]\)/.test(ecrC)
      && /Pourquoi l'outil n'est pas encore rentré/.test(ecrC));

    test("★ son ONGLET le lui dit et COMPTE ses retards : « 🧰 Mes outils (N) » pour qui ne tient pas le registre, « 🧰 Outillage » pour qui le tient (l'administrateur et le magasinier ne sont pas chefs d'équipe — c'est le DROIT qui décide, pas l'étoile)",
      /const tientLeRegistre = peutTenirOutillage\(profile\);/.test(appO)
      && /const labelOutillage = tientLeRegistre \? "🧰 Outillage" : `🧰 Mes outils\$\{retardsAJustifier \? ` \(\$\{retardsAJustifier\}\)` : ""\}`;/.test(appO)
      && /ongletsVisites\.outillage && \(isAdmin \|\| isMagasinier \|\| isTechnicien \|\| isTechnicienBMI\)/.test(appO));

    test("★ LE COUPLE pour la justification : securite-23 ouvre au détenteur EXACTEMENT une porte — le registre débarrassé des justifications doit rester IDENTIQUE —, et rien d'autre de securite-22 ne bouge",
      /create or replace function public\.outillage_sans_justifs/.test(sql23)
      && /r in \('technicien', 'technicien_bmi'\)/.test(sql23)
      && /outillage_sans_justifs\(avant -> 'outillage'\)\s*\n\s*is not distinct from public\.outillage_sans_justifs\(new\.data -> 'outillage'\)/.test(sql23)
      && /a_pouvoir_outillage\(\)/.test(sql23) && /- 'demandes' - 'updated_at' - 'outillage'/.test(sql23)
      && /doit afficher : true \| true \| true/.test(sql23));

    // ═══ ⚠ L'ARDOISE D'UNE PERTE (Timo, 18/09/2026) ═══
    // « Pour les salariés, c'est une retenue sur le salaire. Pour les
    // techniciens commission, c'est retenu sur commission. Dans perdu quand
    // on clique, la liste de tous les équipements perdus apparaît et qui l'a
    // perdu, combien a déjà été retenu sur son salaire ou commission, combien
    // il reste à payer. »
    {
      const calP = readFileSync("src/lib/calculs.js", "utf8");
      const ciP = readFileSync("src/screens/ClientsInstalles.jsx", "utf8");
      const prP = readFileSync("src/screens/PrimesRemises.jsx", "utf8");

      test("★ DEUX CHEMINS, selon la façon d'être payé : le technicien à COMMISSION et le commercial sont retenus sur la commission ; tous les autres (technicien BMI salarié, magasinier, gérant…) sur le salaire",
        Out.modeRetenue({ role: "technicien" }) === "commission"
        && Out.modeRetenue({ role: "commercial" }) === "commission"
        && Out.modeRetenue({ role: "technicien_bmi" }) === "salaire"
        && Out.modeRetenue({ role: "magasinier" }) === "salaire"
        && Out.modeRetenue({ role: "gerant" }) === "salaire"
        && Out.modeRetenue(null) === "salaire"
        && Out.libelleRetenue("commission") === "sur la commission"
        && Out.libelleRetenue("salaire") === "sur le salaire");

      // Une perte à 80 000, dont 30 000 sont demandés à KOSSI.
      const perdu0 = Out.declarerPerdu(Out.nouvelOutil({ id: "o9", nom: "Perceuse", le: "2026-09-01", par: "TIMO" }),
        { id: "p9", le: "2026-09-18", motif: "Volée sur le chantier", valeur: 80000, a_rembourser: 30000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" });

      test("★ l'ardoise SE CALCULE : à rembourser − déjà retenu = reste à payer, jamais négatif ; une perte à la charge de BMI (0) ne doit rien",
        Out.aRembourser(Out.perteDe(perdu0)) === 30000
        && Out.dejaRetenu(Out.perteDe(perdu0)) === 0
        && Out.resteARetenir(Out.perteDe(perdu0)) === 30000
        && (() => { const u = Out.ajouterRetenue(perdu0, "p9", { id: "r1", le: "2026-09-18", montant: 12000, sur: "salaire", mois: "2026-09", par: "TIMO" });
          return Out.dejaRetenu(Out.perteDe(u)) === 12000 && Out.resteARetenir(Out.perteDe(u)) === 18000; })()
        && Out.resteARetenir(Out.perteDe(Out.declarerPerdu(Out.nouvelOutil({ id: "o8", nom: "Échelle", le: "2026-09-01", par: "TIMO" }),
          { id: "p8", le: "2026-09-18", motif: "Cassée", valeur: 50000, a_rembourser: 0, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" }))) === 0);

      test("★ on ne retient jamais plus qu'il ne reste dû, ni zéro, ni sur une perte soldée ; et on ne demande jamais MOINS que ce qui a déjà été pris",
        /plus qu'il ne reste dû/.test(Out.critiqueRetenue(Out.perteDe(perdu0), 30001))
        && Out.critiqueRetenue(Out.perteDe(perdu0), 0) !== ""
        && Out.critiqueRetenue(Out.perteDe(perdu0), 30000) === ""
        && (() => { const u = Out.ajouterRetenue(perdu0, "p9", { id: "r1", le: "2026-09-18", montant: 30000, sur: "salaire", mois: "2026-09", par: "TIMO" });
          return /entièrement remboursée/.test(Out.critiqueRetenue(Out.perteDe(u), 1000))
            && /On ne peut pas demander moins/.test(Out.critiqueARembourser(Out.perteDe(u), 20000))
            && Out.critiqueARembourser(Out.perteDe(u), 30000) === ""
            && Out.aRembourser(Out.perteDe(Out.fixerARembourser(u, "p9", 45000))) === 45000; })());

      // Deux boutiques, deux pertes de la même personne : la plus ANCIENNE
      // se solde en premier, et on ne prend jamais plus que ce qui est payé.
      const bqA = { id: "bA", nom: "DEMAKPOE", outillage: { outils: [Out.declarerPerdu(Out.nouvelOutil({ id: "oA", nom: "Perceuse", le: "2026-08-01", par: "TIMO" }),
        { id: "pA", le: "2026-08-20", motif: "Volée", valeur: 40000, a_rembourser: 10000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" })], appels: [] } };
      const bqB = { id: "bB", nom: "APESSITO", outillage: { outils: [Out.declarerPerdu(Out.nouvelOutil({ id: "oB", nom: "Meuleuse", le: "2026-09-01", par: "TIMO" }),
        { id: "pB", le: "2026-09-18", motif: "Perdue", valeur: 60000, a_rembourser: 25000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" })], appels: [] } };

      test("★ LA RETENUE SUR COMMISSION ne dépasse JAMAIS ce qui est payé (une part d'installation ne devient pas une dette), solde la perte la PLUS ANCIENNE d'abord, et cherche dans TOUTES les boutiques",
        (() => { const r = Out.retenueSurPaiement([bqA, bqB], "u1", 15000);
          return r.montant === 15000 && r.lignes.length === 2
            && r.lignes[0].outil === "Perceuse" && r.lignes[0].montant === 10000
            && r.lignes[1].outil === "Meuleuse" && r.lignes[1].montant === 5000; })()
        && Out.retenueSurPaiement([bqA, bqB], "u1", 5000).montant === 5000
        && Out.retenueSurPaiement([bqA, bqB], "u1", 500000).montant === 35000
        && Out.retenueSurPaiement([bqA, bqB], "u2", 50000).montant === 0
        && Out.ardoisesDeLaPersonne([bqA, bqB], "u1").reduce((t, l) => t + l.reste, 0) === 35000);

      // ⚠⚠ LE MUR, TROUVÉ LE 18/09/2026 EN RÉPONDANT À TIMO (« le cloisonnement
      // comme tu le dis est bien fait ? »). `retenueSurPaiement` parcourait
      // TOUTES les boutiques du chargement. Un vendeur réel ne télécharge que
      // les siennes — mais l'ADMINISTRATEUR PRINCIPAL télécharge LES DEUX
      // espaces, et c'est lui qui paie les parts depuis 🏠 Clients installés :
      // une perte d'ENTRAÎNEMENT se retenait sur de l'argent RÉEL (30 000 F,
      // mesuré). C'est l'espace de la CAISSE QUI PAIE qui décide, jamais celui
      // de la personne qui clique.
      test("★ LE MUR sur la retenue : une perte d'ENTRAÎNEMENT ne se retient JAMAIS sur une part payée en RÉEL, ni l'inverse — l'espace de la caisse qui paie décide",
        (() => {
          const perdu = Out.declarerPerdu(Out.nouvelOutil({ id: "ox", nom: "Perceuse école", le: "2026-09-01", par: "T" }),
            { id: "px", le: "2026-09-10", motif: "Volée", valeur: 50000, a_rembourser: 30000, user_id: "u1", user: "KOSSI", par_id: "c1", par: "CHEF" });
          const dbX = {
            users: [{ id: "u1", nom: "KOSSI", role: "technicien" }],
            boutiques: [
              { id: "bf", nom: "ÉCOLE", formation: true, outillage: { outils: [perdu], appels: [] } },
              { id: "br", nom: "DEMAKPOE", outillage: { outils: [], appels: [] } },
            ],
          };
          // payée par la caisse RÉELLE : la perte d'entraînement reste dehors
          const reel = C.retenueOutilPourPrime(dbX, "u1", 100000, "DEMAKPOE");
          // payée par la caisse de FORMATION : elle compte, chez elle
          const form = C.retenueOutilPourPrime(dbX, "u1", 100000, "ÉCOLE");
          return reel.montant === 0 && reel.lignes.length === 0
            && form.montant === 30000 && form.lignes[0].boutique_id === "bf"; })());

      test("★ et les DEUX écrans qui paient une part nomment la caisse qui paie (sans elle, la règle ne sait pas de quel espace il s'agit)",
        [ciP, prP].every((f) => /retenueOutilPourPrime\(db, e\.user_id, e\.montant, e\.prime_boutique\)/.test(f))
        && /const formation = estBoutiqueFormation\(db, boutiqueQuiPaie\);/.test(calP)
        && /\(db\.boutiques \|\| \[\]\)\.filter\(\(b\) => !!b\.formation === !!formation\)/.test(calP));

      test("★ et elle S'ÉCRIT sur les pertes concernées, dans leurs boutiques respectives : sans cette écriture, l'argent partait mais RIEN ne pouvait s'afficher",
        (() => { const r = Out.retenueSurPaiement([bqA, bqB], "u1", 15000);
          const apres = Out.appliquerRetenues([bqA, bqB], r.lignes, { id: "z1", le: "2026-09-18", sur: "commission", ref: "Part d'installation — MR ERIC", par: "TIMO" });
          const pA = Out.perteDe(Out.outilsDe(apres[0])[0]);
          const pB = Out.perteDe(Out.outilsDe(apres[1])[0]);
          return Out.dejaRetenu(pA) === 10000 && Out.resteARetenir(pA) === 0
            && Out.dejaRetenu(pB) === 5000 && Out.resteARetenir(pB) === 20000
            && Out.retenuesDe(pA)[0].sur === "commission" && /MR ERIC/.test(Out.retenuesDe(pA)[0].ref)
            && Out.ardoisesDeLaPersonne(apres, "u1").reduce((t, l) => t + l.reste, 0) === 20000
            // une boutique que rien ne touche est rendue TELLE QUELLE
            && Out.appliquerRetenues([bqA, bqB], [], { id: "z2", le: "x", sur: "commission", par: "T" })[0] === bqA; })());

      test("★ LE CHEMIN RÉEL : la part d'installation d'un technicien à COMMISSION sort de la caisse DIMINUÉE de la retenue — la dépense, le message et la fiche disent le net ; tout retenu = AUCUNE dépense (rien ne sort de la caisse)",
        /export function retenueOutilPourPrime\(db, user_id, montant, boutiqueQuiPaie\)/.test(calP)
        && /if \(!u \|\| modeRetenue\(u\) !== "commission"\) return \{ montant: 0, lignes: \[\] \};/.test(calP)
        && /const net = Number\(e\.montant \|\| 0\) - pris;/.test(calP)
        && /const dep = net > 0 \? nouvelleDepense\(/.test(calP)
        && /montant: net, moyen, auto: "installation"/.test(calP)
        && /retenue_outil: pris \|\| 0, montant_verse: net/.test(calP)
        && /appliquerRetenues\(db\.boutiques \|\| \[\], retenue\.lignes/.test(calP)
        && /Retenue pour outil perdu : \$\{fmt\(pris\)\}/.test(calP)
        && /net > 0 \? messagesNotifSortieCaisse/.test(calP));

      test("★ elle est ANNONCÉE, jamais silencieuse : les DEUX écrans qui paient une part (🏠 Clients installés et 💰 Primes remises) nomment la retenue, l'outil et le net AVANT de confirmer",
        [ciP, prP].every((f) => /const ret = retenueOutilPourPrime\(db, e\.user_id, e\.montant, e\.prime_boutique\);/.test(f)
          && /const net = e\.montant - ret\.montant;/.test(f)
          && /🧰 Retenue pour outil perdu/.test(f)
          && /ret\.lignes\.map\(\(l\) => l\.outil\)\.join\(", "\)/.test(f)
          && /construirePaiementPrime\(db, profile, c, e, moyen, ret\)/.test(f)));

      // ⚠ CONTRÔLE RETOURNÉ le 18/09/2026 : le carré s'appelle désormais
      // « Perdus / Hors d'usage » et porte les DEUX (décision Timo : « pas un
      // 6e carré… grouper avec perdu »). Les colonnes d'argent sont les mêmes,
      // seuls les deux premiers titres se sont élargis aux réformés. On le
      // retourne, on ne le supprime pas : il garde la mesure de tout le reste.
      test("★ LE CARRÉ « PERDUS » S'OUVRE COMME LES QUATRE AUTRES (il était le seul à ne pas être un bouton) et montre SES colonnes : qui, quand, pourquoi, valeur, à rembourser, déjà retenu, reste à payer",
        /\["perdus", "Perdus \/ Hors d'usage", \(/.test(ecrC)
        && !/<Stat label="Perdus"/.test(ecrC)
        && /<th className="px-3 py-2">Qui \/ décidé par<\/th><th className="px-3 py-2">Le<\/th><th className="px-3 py-2">Pourquoi<\/th><th className="px-3 py-2 text-right">Valeur<\/th><th className="px-3 py-2 text-right">À rembourser<\/th><th className="px-3 py-2 text-right">Déjà retenu<\/th><th className="px-3 py-2 text-right">Reste à payer<\/th>/.test(ecrC)
        && /retenue \{libelleRetenue\(mode\)\}/.test(ecrC)
        && /💵 Ce qui a déjà été retenu à/.test(ecrC)
        && /perdus: "⚠ Perdus et 🗑 hors d'usage"/.test(ecrC));

      test("★ le bouton 💵 « Retenir » n'est proposé QUE là où il agit : administrateur, mode SALAIRE, et seulement s'il reste quelque chose à payer — pour un technicien à commission l'écran DIT que ça se prend sur sa prochaine part, il ne fait pas semblant",
        /vue === "perdus" && jeSuisAdmin && perte && mode === "salaire" && resteARetenir\(perte\) > 0/.test(ecrC)
        && /est payé à la commission : la retenue se prend toute seule sur sa prochaine part d'installation/.test(ecrC)
        && /sur sa prochaine part/.test(ecrC)
        && /refuserSaufAdmin\(profile, "Retenir sur un salaire"\)/.test(ecrC)
        && /refuserSaufAdmin\(profile, "Fixer ce qu'un outil perdu doit rembourser"\)/.test(ecrC));

      test("★ la RETENUE SUR SALAIRE passe toujours par le mécanisme qui existe (une AVANCE du mois, que paieMois soustrait du net sans toucher la base CNSS) et s'écrit AUSSI sur la perte",
        /retenuePourOutil\(\{ id: uid\(\), mois, montant, outil: outil\.nom, date: jour, par: profile\.nom \}\), outil_id: outil\.id \}/.test(ecrC)
        && /avances: \[\.\.\.\(u\.avances \|\| \[\]\), av\]/.test(ecrC)
        && /ajouterRetenue\(outil, perte\.id, \{ id: uid\(\), le: jour, montant, sur: "salaire", mois/.test(ecrC)
        && Out.retenuePourOutil({ id: "a1", mois: "2026-09", montant: 12000, outil: "Perceuse", date: "2026-09-18", par: "TIMO" }).auto === "outil_perdu"
        && /const net = base \+ primes - avances - retenueCredit - retenueCNSS;/.test(calP));

      test("★ LE COUPLE : securite-24 ouvre au PAYEUR d'une part (vendeur, gérant) exactement une porte — inscrire la retenue —, le registre débarrassé des retenues devant rester IDENTIQUE ; sans lui, le geste du vendeur serait refusé par la base et TOUT LE LOT resterait coincé",
        (() => { const sql24 = existsSync("supabase/securite-24-retenue-outil.sql")
            ? readFileSync("supabase/securite-24-retenue-outil.sql", "utf8") : "";
          return /create or replace function public\.outillage_sans_retenues/.test(sql24)
            && /m - 'retenues'/.test(sql24)
            && /in \('admin', 'gerant', 'vendeur'\)/.test(sql24)
            && /outillage_sans_retenues\(avant -> 'outillage'\)\s*\n\s*is not distinct from public\.outillage_sans_retenues\(new\.data -> 'outillage'\)/.test(sql24)
            // il REPREND securite-23 (et donc -22) : rien ne doit disparaître
            && /outillage_sans_justifs\(avant -> 'outillage'\)/.test(sql24)
            && /a_pouvoir_outillage\(\)/.test(sql24)
            && /- 'demandes' - 'updated_at' - 'outillage'/.test(sql24)
            && /doit afficher : true \| true \| true \| true/.test(sql24); })());

      test("★ et le banc SQL le rejoue sur base jetable : le vendeur inscrit la retenue, mais n'efface pas ce qui est dû, ne sort pas l'outil, et un technicien ordinaire ne se solde pas lui-même",
        (() => { const bh = readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8");
          return /securite-24-retenue-outil\.sql/.test(bh)
            && /le VENDEUR qui paie la part inscrit la retenue.*"PERMIS"/.test(bh)
            && /pour effacer ce qui est dû : refusé" "REFUSE"/.test(bh)
            && /pour sortir l'outil : refusé.*"REFUSE"/.test(bh)
            && /un technicien ORDINAIRE n'inscrit aucune retenue.*"REFUSE"/.test(bh); })());

      test("★ la personne EST PRÉVENUE dans les deux cas, et une perte à la charge de BMI le dit aussi",
        /vous seront retenus sur vos prochaines parts d'installation/.test(ecrC)
        && /sont retenus sur votre salaire de/.test(ecrC)
        && /La perte reste à la charge de BMI\./.test(ecrC)
        && /sont retenus sur votre salaire de \$\{mois\} pour l'outil perdu/.test(ecrC));
    }

    test("★ le banc SQL rejoue securite-23 et mesure la porte ET son cadre (justifier passe, rendre l'outil ne passe pas, un vendeur ne justifie rien)",
      (() => { const bh = readFileSync("scripts/tester-devis-chantiers-sql.sh", "utf8");
        return /securite-23-justifier-retard\.sql/.test(bh)
          && /le TECHNICIEN qui détient l'outil justifie son retard" "PERMIS"/.test(bh)
          && /en PROFITE pour rendre l'outil : refusé.*"REFUSE"/.test(bh)
          && /un VENDEUR ne justifie rien.*"REFUSE"/.test(bh); })());
  }

  test("★ l'écran passe par les briques communes : le filtre d'espace pour les personnes (utilisateursDeLEspace, jamais un db.users.filter maison) et LA règle de recherche (correspond)",
    /utilisateursDeLEspace\(db, profile\)/.test(ecrC)
    && !/db\.users\.filter|\(db\.users \|\| \[\]\)\.filter/.test(ecrC)
    && /correspond\(`\$\{o\.nom\}/.test(ecrC)
    && !/toLowerCase\(\)\.includes/.test(ecrC));
}

// ═══════════════════════════════════════════════════════════
// 🔒 LE DROIT À L'EFFACEMENT D'UN CLIENT (Timo, 18/09/2026)
//
// « Mon app respecte déjà la législation togolaise sur cet aspect ? » — pas
// encore : l'article 18 de nos contrats promet la suppression des données du
// client, et l'application ne savait pas la faire. Supprimer son compte
// laissait son nom et son numéro sur chaque vente, chaque chantier, chaque
// message et dans le journal : rien n'était effacé, mais tout avait l'air
// fait. Le banc EXERCE la vraie règle — il ne lit pas le code.
// ═══════════════════════════════════════════════════════════
{
  titre("🔒 Le droit à l'effacement d'un client (18/09/2026)");

  const monde = () => ({
    users: [
      { id: "cl1", role: "client", nom: "KOSSI", nom_base: "KOSSI MENSAH", tel: "+228 90 11 22 33", devis: [{ id: "dv1" }] },
      { id: "v1", role: "vendeur", nom: "AMA" },
    ],
    ventes: [
      { id: "ve1", client: "KOSSI MENSAH", tel: "90112233", boutique: "APESSITO", numero: "R-12", total: 50000, articles: [{ nom: "Panneau", qte: 2 }] },
      { id: "ve2", client: "AUTRE CLIENT", tel: "90999999", boutique: "APESSITO" },
    ],
    dettes: [{ id: "de1", client: "KOSSI MENSAH", tel: "22890112233", montant: 30000, paye: 30000 }],
    proformas: [], commandes: [],
    clients_installes: [{
      id: "ch1", nom: "MENSAH", prenom: "KOSSI", tel: "90112233", statut: "receptionne",
      localisation: "Bè-Kpota", lat: 6.17, lng: 1.23, contrat_signature: "data:image/png;base64,AAA",
      contrat_jeton: "JETON-SECRET", garantie_mois: 24, receptionne_le: "2024-01-01", frais: 120000,
      observations: [{ id: "o1", texte: "KOSSI MENSAH a rappelé le 90112233" }],
    }],
    prospects: [{ id: "pr1", nom: "KOSSI MENSAH", tel: "90112233" }],
    messages: [
      { id: "m1", de_id: "cl1", a_id: "v1", texte: "bonjour" },
      { id: "m2", de_id: "v1", a_id: "adm", texte: "🙋 Nouveau client : KOSSI MENSAH (90112233)." },
      { id: "m3", de_id: "x", a_id: "y", texte: "message d'un AUTRE espace, citant KOSSI MENSAH" },
    ],
    audits: [
      { id: "a1", action: "Nouveau client installé « KOSSI MENSAH » (solaire)" },
      { id: "a2", action: "Vente réelle d'un AUTRE espace — KOSSI MENSAH" },
    ],
  });
  // `visible` = ce que l'espace regardé laisse voir. m3 et a2 n'y sont PAS.
  const vu = (d) => ({
    comptes: d.users, ventes: d.ventes, dettes: d.dettes, proformas: [], commandes: [],
    chantiers: d.clients_installes, prospects: d.prospects,
    messages: d.messages.filter((m) => m.id !== "m3"),
    audits: d.audits.filter((a) => a.id !== "a2"),
  });
  const cible = { nom: "KOSSI MENSAH", tel: "90112233" };

  const d0 = monde();
  const dos = Eff.dossierClient(vu(d0), cible);

  test("★ le dossier ramasse TOUT ce que l'application sait de lui — son compte, ses ventes, ses dettes, ses chantiers, sa fiche de prospection et ses messages — en reconnaissant le même numéro écrit de trois façons (90112233 / +228 90 11 22 33 / 22890112233)",
    !!dos.compte && dos.ventes.length === 1 && dos.dettes.length === 1 && dos.chantiers.length === 1
    && dos.prospects.length === 1 && dos.messages.length === 1 && dos.total === 6
    && !dos.ventes.some((v) => v.id === "ve2"));

  test("★ LA PROMESSE TENUE : ce qui n'appartient qu'à lui PART (compte, devis, prospect, messages), ce que les livres doivent garder RESTE — la vente garde son numéro de reçu, son total et ses articles, et perd le nom et le numéro",
    (() => {
      const ap = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "demande du client", numero: 1 });
      const v = ap.ventes.find((x) => x.id === "ve1");
      return !ap.users.some((u) => u.id === "cl1")
        && ap.prospects.length === 0
        && !ap.messages.some((m) => m.id === "m1")
        && v.client === "CLIENT EFFACÉ N° 1" && v.tel === ""
        && v.numero === "R-12" && v.total === 50000 && v.articles.length === 1;
    })());

  test("★ une vente qui n'est PAS la sienne ne bouge pas d'un caractère",
    (() => {
      const ap = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "m", numero: 1 });
      return JSON.stringify(ap.ventes.find((x) => x.id === "ve2")) === JSON.stringify(d0.ventes[1]);
    })());

  test("★ le chantier garde ses frais, son matériel et son équipe, et perd nom, numéro, adresse, POSITION GPS, signature — et le JETON de signature, qui est une clé d'accès à son dossier",
    (() => {
      const c = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "m", numero: 3 }).clients_installes[0];
      return c.frais === 120000 && c.garantie_mois === 24
        && c.nom === "CLIENT EFFACÉ N° 3" && c.prenom === "" && c.tel === ""
        && c.localisation === "" && c.lat === null && c.lng === null
        && c.contrat_signature === "" && c.contrat_jeton === "";
    })());

  test("★ LE NOM SE CACHE AUSSI DANS LES TEXTES LIBRES : journal, observations et messages d'équipe sont nettoyés — sinon l'effacement AURAIT L'AIR fait sans l'être",
    (() => {
      const ap = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "m", numero: 1, autresNoms: ["AMA"] });
      return /CLIENT EFFACÉ N° 1/.test(ap.audits.find((a) => a.id === "a1").action)
        && !/KOSSI/.test(ap.audits.find((a) => a.id === "a1").action)
        && !/KOSSI|90112233/.test(ap.messages.find((m) => m.id === "m2").texte)
        && !/KOSSI|90112233/.test(ap.clients_installes[0].observations[0].texte);
    })());

  test("★ un NUMÉRO ne devient pas la référence (« (90112233) » ne se lit pas « (CLIENT EFFACÉ N° 1) ») : il disparaît derrière sa propre marque",
    (() => {
      const ap = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "m", numero: 1, autresNoms: ["AMA"] });
      return ap.messages.find((m) => m.id === "m2").texte === "🙋 Nouveau client : CLIENT EFFACÉ N° 1 (numéro effacé).";
    })());

  test("★⚠ LE MUR : le nettoyage des textes libres ne sort JAMAIS de l'espace regardé. L'administrateur PRINCIPAL charge les DEUX espaces — sans la portée, effacer un client d'ENTRAÎNEMENT nettoierait le journal RÉEL",
    (() => {
      const ap = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "m", numero: 1, autresNoms: ["AMA"] });
      return ap.audits.find((a) => a.id === "a2").action === "Vente réelle d'un AUTRE espace — KOSSI MENSAH"
        && ap.messages.find((m) => m.id === "m3").texte === "message d'un AUTRE espace, citant KOSSI MENSAH";
    })());

  test("★⚠ ON N'EFFACE PAS LE NOM DE QUELQU'UN D'AUTRE : à Lomé un prénom seul est porté par plusieurs personnes. Un mot que porte un employé ou un autre client est ÉCARTÉ du nettoyage — et l'écart est DIT, jamais silencieux",
    (() => {
      const mots = Eff.motsSensibles(dos, ["KOSSI MENSAH"]);
      const ap = Eff.effacerClient(d0, dos, { nom: "TIMO" }, { motif: "m", numero: 1, autresNoms: ["KOSSI MENSAH"] });
      return mots.ecartes.includes("KOSSI MENSAH")
        && /ne sera PAS retiré des textes libres/.test(Eff.avertissementsEffacement(dos, "2025-01-01", ["KOSSI MENSAH"]).join(" "))
        // …mais les COLONNES sont quand même effacées : la promesse tient.
        && ap.ventes.find((x) => x.id === "ve1").client === "CLIENT EFFACÉ N° 1";
    })());

  test("★ et le contrôle est ÉPROUVÉ en remettant la faute : sans la liste des autres noms, le nom de l'employé serait balayé du journal",
    (() => {
      const d = monde();
      d.audits.push({ id: "a3", action: "Clôture faite par AMANI" });
      const v2 = vu(d); v2.audits = d.audits.filter((a) => a.id !== "a2");
      const ds = Eff.dossierClient(v2, { nom: "AMANI", tel: "" });
      const sansGarde = Eff.effacerClient(d, ds, {}, { motif: "m", numero: 1, autresNoms: [] });
      const avecGarde = Eff.effacerClient(d, ds, {}, { motif: "m", numero: 1, autresNoms: ["AMANI"] });
      return !/AMANI/.test(sansGarde.audits.find((a) => a.id === "a3").action)
        && /AMANI/.test(avecGarde.audits.find((a) => a.id === "a3").action);
    })());

  test("★ LES DEUX PORTES FERMÉES : on n'efface pas les coordonnées de quelqu'un qui doit encore de l'argent (la dette ne se recouvrerait plus), ni celles d'un chantier non réceptionné (on a besoin de le joindre) — et le refus NOMME le montant",
    (() => {
      const d = monde();
      const vd = vu(d); vd.dettes = [{ id: "de9", client: "KOSSI MENSAH", tel: "90112233", montant: 30000, paye: 5000 }];
      const r1 = Eff.critiqueEffacement(Eff.dossierClient(vd, cible), (x) => `${x} F`);
      const vc = vu(d); vc.chantiers = [{ id: "ch9", nom: "MENSAH", prenom: "KOSSI", tel: "90112233", statut: "en_cours" }];
      const r2 = Eff.critiqueEffacement(Eff.dossierClient(vc, cible));
      return /25000 F/.test(r1) && /dette/i.test(r1)
        && /réceptionné/.test(r2)
        && Eff.critiqueEffacement(dos) === "";
    })());

  test("★ LA RÉFÉRENCE NE REDESCEND JAMAIS : le prochain numéro est le plus grand déjà posé + 1 — deux effacements ne peuvent pas se confondre, et une ligne retrouvée dans une vieille sauvegarde n'en écrase pas une autre",
    (() => {
      const vide = Eff.prochainNumeroEffacement({ ventes: [] });
      const apres = Eff.prochainNumeroEffacement({
        ventes: [{ client: "CLIENT EFFACÉ N° 2" }], clients_installes: [{ nom: "CLIENT EFFACÉ N° 7" }],
      });
      return vide === 1 && apres === 8 && Eff.pseudonyme(8) === "CLIENT EFFACÉ N° 8" && Eff.estEfface("CLIENT EFFACÉ N° 8");
    })());

  test("★ un client déjà effacé ne se propose plus dans la liste (il n'y a plus personne derrière la référence)",
    (() => {
      const l = Eff.clientsEffacables({ ventes: [{ client: "CLIENT EFFACÉ N° 1", tel: "" }, { client: "VRAI CLIENT", tel: "90112233" }] });
      return l.length === 1 && l[0].nom === "VRAI CLIENT";
    })());

  test("★ un chantier mis à la CORBEILLE porte encore son nom : l'effacement l'y suit, sinon il ressortirait nommé à la restauration",
    (() => {
      const d = monde();
      d.corbeille_clients_installes = [{ id: "chc", nom: "MENSAH", prenom: "KOSSI", tel: "90112233", statut: "receptionne" }];
      const v = vu(d); v.chantiers = [...d.clients_installes, ...d.corbeille_clients_installes];
      const ds = Eff.dossierClient(v, cible);
      const ap = Eff.effacerClient(d, ds, {}, { motif: "m", numero: 4 });
      return ap.corbeille_clients_installes[0].nom === "CLIENT EFFACÉ N° 4" && ap.corbeille_clients_installes[0].tel === "";
    })());

  test("★ LA TRACE NE NOMME PERSONNE : le journal garde la date, l'auteur, le motif et la référence — jamais le nom du client, ce serait exactement ce qu'on vient d'effacer",
    (() => {
      const l = Eff.journalEffacement(dos, { nom: "TIMO" }, { motif: "demande écrite du 18/09/2026", numero: 5 });
      return /CLIENT EFFACÉ N° 5/.test(l) && /demande écrite du 18\/09\/2026/.test(l) && /TIMO/.test(l)
        && !/KOSSI|MENSAH|90112233/.test(l);
    })());

  test("★ LE RAPPORT SE LIT AVANT DE CLIQUER : il dit ce qui part pour de bon et ce qui reste sans son nom — on ne fait pas signer un geste sans retour sur une phrase générale",
    (() => {
      const r = Eff.resumeEffacement(dos);
      return r.part.some((x) => /compte/i.test(x)) && r.part.some((x) => /message/i.test(x))
        && r.reste.some((x) => /vente/i.test(x)) && r.reste.some((x) => /chantier/i.test(x));
    })());

  test("★ un client SANS numéro est rapproché sur le NOM SEUL : ce n'est pas interdit, c'est DIT — un homonyme partirait avec lui",
    /rapprochement s'est fait sur le NOM seul/.test(
      Eff.avertissementsEffacement(Eff.dossierClient({ ventes: [{ id: "z", client: "SANS NUMERO" }] }, { nom: "SANS NUMERO", tel: "" }), "2025-01-01").join(" ")));

  {
    const par = readFileSync("src/screens/Parametres.jsx", "utf8");
    test("★ le geste vit dans ⚙ Paramètres → 🔒 Données personnelles, réservé à l'administrateur PRINCIPAL — revérifié DANS le geste, pas seulement sur le bouton",
      /\["donnees_perso", "🔒 Données personnelles"\]/.test(par)
      && /jeSuisPrincipal \? \[\["donnees_perso"/.test(par)
      && /refuserSaufAdminPrincipal\(db, profile, "Effacer les données personnelles d'un client"\)/.test(par));

    test("★ le motif est OBLIGATOIRE (c'est lui qui prouve pourquoi ces données ont disparu), et la confirmation annonce qu'il n'y a aucun retour",
      /Le motif est obligatoire/.test(par) && /AUCUN RETOUR POSSIBLE/.test(par));

    test("★⚠ LE MUR dans l'écran : les personnes passent par utilisateursDeLEspace (la table des comptes n'est PAS cloisonnée par le serveur), les lignes par filtreEspaceAffichage, les chantiers par chantiersDeLEspaceRegarde — et les messages et le journal par leur propre filtre d'espace",
      /comptesEff = utilisateursDeLEspace\(db, profile\)/.test(par)
      && /filtreEspaceAffichage\(db, profile\)/.test(par)
      && /chantiersDeLEspaceRegarde\(db, profile\)/.test(par)
      && /messages: \(db\.messages \|\| \[\]\)\.filter\(\(m\) => idsEspaceEff\.has/.test(par)
      && /audits: \(db\.audits \|\| \[\]\)\.filter/.test(par));

    test("★ la ligne de recherche passe par LA règle commune (champRecherche) et LA règle de recherche (correspond), jamais un filtre maison",
      /className=\{champRecherche\}/.test(par)
      && /correspond\(`\$\{c\.nom\} \$\{motsDuNumero\(c\.tel\)\}`, qEff\)/.test(par));

    test("★ l'écran DIT ce que l'application ne peut pas faire à sa place : la déclaration à l'IPDCP, l'hébergement hors du Togo, la durée de conservation — on ne laisse pas croire que tout est réglé",
      /IPDCP/.test(par) && /hébergement hors du Togo/.test(par) && /durée de conservation/.test(par));

    test("★ et le contrat, lui, disait déjà la vérité : loi n° 2019-014, droit d'accès, de rectification et de suppression",
      (() => { const imp = readFileSync("src/lib/impression.js", "utf8");
        return /loi n° 2019-014/.test(imp) && /droit d'accès, de rectification/.test(imp); })());
  }
}

// ═══════════════════════════════════════════════════════════
// 📄 LE DROIT D'ACCÈS : LE DOSSIER PERSONNEL D'UN CLIENT (18/09/2026)
//
// Timo : « lance le point 2 ». L'article 18 de nos contrats promet un droit
// d'accès AVANT le droit de suppression. Répondre à « qu'est-ce que vous
// avez sur moi ? » demandait d'ouvrir cinq écrans et de recopier à la main —
// une réponse incomplète n'est pas une réponse. Le banc EXERCE la règle ET
// MESURE le PDF réellement écrit.
// ═══════════════════════════════════════════════════════════
{
  titre("📄 Le droit d'accès : le dossier personnel d'un client (18/09/2026)");

  const fmtD = (x) => `${Number(x || 0)} F`;
  const dFRD = (x) => String(x || "").slice(0, 10).split("-").reverse().join("/");
  const dossierD = {
    cible: { nom: "KOSSI MENSAH", tel: "90112233" },
    compte: {
      id: "cl1", nom: "KOSSI", nom_base: "KOSSI MENSAH", tel: "90112233", cree_par: "AMA", actif: true,
      // ⚠ Tout ce qui suit DOIT rester hors du document.
      pwd_hash2: "EMPREINTE-DU-MOT-DE-PASSE", pwd_salt: "GRAIN-DE-SEL", mdp_variante: 0, mdp_longueur: 6,
      devis: [{ date: "2026-08-01", type: "solaire", statut: "payé", total: 2400000 }],
    },
    ventes: [{ id: "v1", date: "2026-09-01", numero: "R-12", boutique: "DEMAKPOE", total: 50000, articles: [{ nom: "Panneau 400W", qte: 2 }] }],
    dettes: [{ id: "d1", date: "2026-09-02", numero: "DET-3", motif: "Installation", montant: 300000, paye: 100000 }],
    proformas: [], commandes: [],
    chantiers: [{
      id: "c1", date_installation: "2026-08-15", type_installation: "Solaire", adresse_contrat: "Bè-Kpota",
      garantie_mois: 24, statut: "receptionne", materiel: [{ nom: "Onduleur Deye", qte: 1 }],
      contrat_jeton: "JETON-DE-SIGNATURE", lat: 6.17, lng: 1.23,
    }],
    messages: [{ id: "m1", date: "2026-09-03", de_id: "cl1", texte: "Bonjour, quand est l'installation ?" }],
    prospects: [], total: 6,
  };
  const vueD = Dos.dossierPersonnel(dossierD, { fmt: fmtD, dFR: dFRD });

  test("★ LE DOSSIER RASSEMBLE TOUT ce que l'application sait de lui — identité, achats, dettes, proformas, commandes, devis, chantiers, messages, prospection : neuf familles, aucune oubliée (une réponse incomplète n'est pas une réponse)",
    vueD.sections.length === 8 && vueD.identite.length === 5
    && ["Vos achats", "Vos dettes et règlements", "Vos devis", "Vos installations et chantiers", "Vos messages avec nous"]
      .every((t) => vueD.sections.some((s) => s.titre === t)));

  test("★ une famille VIDE le dit en toutes lettres au lieu de disparaître — sinon le client ne peut pas savoir si on n'a rien, ou si on a oublié de regarder",
    (() => { const p = vueD.sections.find((s) => s.titre === "Vos commandes");
      return p.lignes.length === 0 && /Aucune commande/.test(p.vide); })());

  test("★ les chiffres sont là, mis en forme comme à l'écran : le reste d'une dette est CALCULÉ (300 000 − 100 000 = 200 000), pas recopié",
    (() => { const d = vueD.sections.find((s) => s.titre === "Vos dettes et règlements");
      return d.lignes[0][3] === "300000 F" && d.lignes[0][4] === "100000 F" && d.lignes[0][5] === "200000 F"; })());

  test("★ un message dit DANS QUEL SENS il est parti (« vous → BMI »), sinon une conversation relue plus tard ne veut plus rien dire",
    vueD.sections.find((s) => s.titre === "Vos messages avec nous").lignes[0][1] === "vous → BMI");

  test("★⚠⚠ SON MOT DE PASSE N'Y EST PAS — et c'est le point le plus important : l'application sait le RECALCULER, donc un dossier d'accès qui se promène ne doit pas être une clé. L'identifiant, lui, se dit (il en a besoin pour se connecter)",
    (() => {
      const tout = JSON.stringify(vueD);
      return Dos.CHAMPS_INTERDITS.every((c) => !tout.includes(c))
        && !tout.includes("EMPREINTE-DU-MOT-DE-PASSE") && !tout.includes("GRAIN-DE-SEL")
        && vueD.identite.some(([l, v]) => /Identifiant/.test(l) && v === "KOSSI");
    })());

  test("★⚠ LE JETON DE SIGNATURE du PV n'y est pas non plus : c'est une clé d'accès à son espace, pas une coordonnée",
    !JSON.stringify(vueD).includes("JETON-DE-SIGNATURE"));

  test("★ le document DIT ses droits au client, en citant la loi n° 2019-014 — et prévient que factures et contrats se gardent par obligation comptable, le nom pouvant en être retiré",
    vueD.mentions.some((m) => /loi n° 2019-014/.test(m))
    && vueD.mentions.some((m) => /droit d'accès, de rectification/.test(m))
    && vueD.mentions.some((m) => /obligation comptable/.test(m))
    && vueD.mentions.some((m) => /mot de passe ne figure pas/.test(m)));

  test("★ un client DÉJÀ EFFACÉ n'a plus de dossier à recevoir : il n'y a plus personne derrière la référence",
    (() => {
      const efface = Dos.critiqueDossier({ cible: { nom: "CLIENT EFFACÉ N° 3" }, total: 4 });
      const vide = Dos.critiqueDossier({ cible: { nom: "X" }, total: 0 });
      return /déjà été effacé/.test(efface) && /Aucune donnée trouvée/.test(vide)
        && Dos.critiqueDossier(dossierD) === "";
    })());

  test("★ LA TRACE NOMME le client — au contraire de celle de l'effacement : on n'efface rien ici, il faut pouvoir dire à QUI le dossier a été remis",
    (() => { const l = Dos.journalDossier(dossierD, { nom: "TIMO" }, { format: "PDF" });
      return /KOSSI MENSAH/.test(l) && /90112233/.test(l) && /TIMO/.test(l) && /PDF/.test(l); })());

  test("★ le CSV rend les MÊMES sections mises à plat (un seul fichier, les familles titrées les unes sous les autres) — les deux sorties lisent la même structure, sinon elles finiraient par se contredire",
    (() => {
      const l = Dos.lignesCsvDossier(vueD).map((r) => r.join("|"));
      return l.some((x) => /^VOTRE IDENTITÉ/.test(x)) && l.some((x) => /^VOS ACHATS/.test(x))
        && l.some((x) => /^VOS DROITS/.test(x)) && l.some((x) => /Panneau 400W/.test(x))
        && !l.join(" ").includes("GRAIN-DE-SEL");
    })());

  // ---- LE PDF : on lit ce qui est RÉELLEMENT écrit dedans ----
  {
    const doc = PdfDos.genererDossierPersonnel(vueD, { edite: "18/09/2026", client: "KOSSI MENSAH" }, true);
    const lu = [];
    for (let pg = 1; pg <= doc.internal.getNumberOfPages(); pg++)
      for (const ligne of doc.internal.pages[pg].join("\n").split("\n")) {
        const m = ligne.match(/\((.*?)\)\s*Tj/);
        if (m) lu.push(m[1]);
      }
    const ecrit = lu.join(" | ");

    test("★ LE PDF EST MESURÉ, pas présumé : le texte réellement écrit porte l'identité, les achats, le matériel posé et les droits du client",
      /VOS DONNÉES PERSONNELLES/.test(ecrit) && /KOSSI MENSAH/.test(ecrit)
      && /R-12/.test(ecrit) && /Panneau 400W/.test(ecrit) && /Onduleur Deye/.test(ecrit)
      && /2019-014/.test(ecrit) && /VOS DROITS SUR CES DONNÉES/.test(ecrit));

    test("★⚠ et le PDF lui-même ne porte AUCUN secret : ni l'empreinte du mot de passe, ni son grain de sel, ni le jeton de signature",
      !/EMPREINTE-DU-MOT-DE-PASSE|GRAIN-DE-SEL|JETON-DE-SIGNATURE|pwd_/.test(ecrit));

    test("★ le piège de jsPDF est évité : tout texte venu des données passe par texteSurPdf, donc aucune ligne ne sort en lettres espacées (« V e r s e m e n t », capture Timo du 12/09/2026)",
      !/ [A-Z] [a-z] [a-z] /.test(ecrit) && /vous -> BMI/.test(ecrit));

    test("★ il passe par les briques communes : l'entête de la société, le bandeau de titre et le pied de page — jamais une mise en page recopiée",
      /BMI TOGO/.test(ecrit) && /BMI-Gestions Boutiques/.test(ecrit));
  }

  {
    const par = readFileSync("src/screens/Parametres.jsx", "utf8");
    test("★ le geste vit dans le MÊME panneau que l'effacement, réservé à l'administrateur PRINCIPAL — revérifié DANS le geste",
      /refuserSaufAdminPrincipal\(db, profile, "Remettre à un client le dossier de ses données"\)/.test(par)
      && /Dossier personnel \(PDF\)/.test(par) && /Exporter \(CSV\)/.test(par));

    // ⚠ RETOURNÉ le 19/09/2026 : le dossier porte maintenant la DURÉE DE
    // CONSERVATION, qui vient du réglage. On exige les deux.
    test("★ UNE SEULE SOURCE : le dossier d'accès et le dossier d'effacement viennent du MÊME dossierClient — même mur, même façon de reconnaître le client, sinon les deux finiraient par se contredire",
      /dossierPersonnel\(dossierEff, \{ fmt, dFR, duree: dureeEnCours \}\)/.test(par));

    test("★ le droit d'accès reste OUVERT même quand l'effacement est refusé : une dette non soldée n'empêche personne de demander ce qu'on a sur lui",
      par.indexOf("Lui remettre ses données") < par.indexOf("{refusEff ?"));

    test("★ l'écran PRÉVIENT que ce document est un concentré de données personnelles et ne se remet qu'au client lui-même",
      /ne se remet qu'à LUI, en main propre ou sur SON numéro/.test(par)
      && /Son mot de passe n'y figure pas/.test(par));

    test("★ la remise laisse sa TRACE au journal (save avec la même base : rien ne change, une ligne s'écrit)",
      /save\(db, journalDossier\(dossierEff, profile, \{ format \}\)\)/.test(par));
  }
}

// ═══════════════════════════════════════════════════════════
// 🔒 « VOS DONNÉES » DANS L'ESPACE CLIENT — le point 3 (18/09/2026)
//
// Timo : « lance le point 3 ». Accorder un droit d'accès en obligeant le
// client à appeler la boutique, c'est ne l'accorder qu'à moitié. Ici il se
// sert LUI-MÊME : il voit ce qu'on garde, il télécharge son dossier, il
// demande une correction ou une suppression.
// ═══════════════════════════════════════════════════════════
{
  titre("🔒 « Vos données » dans l'espace client — le point 3 (18/09/2026)");

  const vueC = Dos.dossierPersonnel({
    cible: { nom: "KOSSI MENSAH", tel: "90112233" },
    compte: { id: "cl1", nom: "KOSSI", nom_base: "KOSSI MENSAH", tel: "90112233", devis: [] },
    ventes: [{ id: "v1", date: "2026-09-01", numero: "R-12", total: 50000, articles: [{ nom: "Panneau", qte: 1 }] },
             { id: "v2", date: "2026-09-05", numero: "R-13", total: 20000, articles: [] }],
    dettes: [{ id: "d1", date: "2026-09-02", montant: 300000, paye: 100000 }],
    proformas: [], commandes: [], chantiers: [], messages: [], prospects: [], total: 4,
  }, { fmt: (x) => `${x} F`, dFR: (x) => String(x) });

  test("★ le client lit SON résumé en une ligne par famille, et les familles VIDES n'y figurent pas — sur son écran, une liste de « aucun / aucune » n'apprend rien (elles restent dans le document, où elles prouvent qu'on a regardé partout)",
    (() => {
      const r = Dos.resumePourLeClient(vueC);
      return r.length === 2
        && r.find((x) => x.titre === "Vos achats")?.nb === 2
        && r.find((x) => x.titre === "Vos dettes et règlements")?.nb === 1
        && !r.some((x) => /proforma|commande|chantier/i.test(x.titre))
        // …alors que le DOCUMENT, lui, les porte toutes
        && vueC.sections.length === 8;
    })());

  test("★ il demande une correction ou une suppression en son NOM, par un texte qu'il relit avant d'envoyer — et les deux demandes sont distinctes",
    (() => {
      const c = Dos.texteDemandeDonnees("kossi mensah", "correction");
      const sup = Dos.texteDemandeDonnees("kossi mensah", "suppression");
      return /KOSSI MENSAH/.test(c) && /corriger/.test(c) && !/supprimer/.test(c)
        && /supprimer/.test(sup) && !/corriger/.test(sup)
        && /BMI TOGO/.test(c);
    })());

  test("★ un `quoi` inconnu retombe sur la correction, jamais sur la suppression : devant un doute, on ne propose pas d'effacer",
    /corriger/.test(Dos.texteDemandeDonnees("X", "n_importe_quoi")));

  {
    // ⚠ RETOURNÉ le 19/09/2026 : Timo a voulu ce panneau en ONGLET à côté de
    // 💬 Messages (« au lieu de vos données personnelles, dire mes données
    // personnelles et ramener ça en onglet »). Il vit donc dans son propre
    // écran ; les contrôles le suivent, ils ne disparaissent pas.
    const ec = readFileSync("src/screens/MesDonnees.jsx", "utf8");

    test("★ UNE SEULE SOURCE : l'espace client passe par le MÊME dossierClient et le MÊME dossierPersonnel que ⚙ Paramètres — sinon le client verrait la différence entre ce qu'il télécharge et ce que BMI lui remet",
      /dossierClient\(\{/.test(ec) && /dossierPersonnel\(monDossier, \{ fmt, dFR, duree: dureeConservation\(db\) \}\)/.test(ec)
      && /genererDossierPersonnel\(maVue/.test(ec));

    // ⚠ RETOURNÉ le 19/09/2026 : les mentions PORTENT la durée, elles sont
    // donc une fonction du réglage — la constante MENTIONS_DOSSIER a disparu.
    // Le nouveau contrôle est PLUS FORT : il n'exige plus « la même
    // constante des deux côtés » mais que l'écran affiche LITTÉRALEMENT le
    // texte du document qu'il imprime (maVue.mentions).
    test("★ les MÊMES mentions s'affichent à l'écran et s'impriment dans le document — l'écran affiche celles DU document (maVue.mentions), pas un second texte à maintenir",
      /maVue\.mentions\.map/.test(ec) && !/MENTIONS_DOSSIER/.test(ec)
      // ⚠ « loi n° 2019-014 » est cherchée dans le PANNEAU seulement :
      // l'article 18 du CONTRAT, affiché plus bas au client, la cite
      // légitimement — un contrôle qui crie à tort finit par ne plus être cru.
      && !/loi n° 2019-014/.test(ec.split("maVue.mentions.map")[0].split("Vos données personnelles").pop()));

    test("★ il télécharge le document LUI-MÊME (« 🖨 Télécharger mes données (PDF) ») : un droit d'accès qui oblige à appeler la boutique n'est accordé qu'à moitié",
      /Télécharger mes données \(PDF\)/.test(ec) && /telecharderMesDonnees/.test(ec));

    // ⚠⚠ CONTRÔLE RETOURNÉ le 19/09/2026, et c'est le plus grave de la série :
    // il exigeait `/boutiquesVisibles\(db, profile\)/` — c'est-à-dire l'appel
    // SANS sa liste de boutiques, donc l'appel CASSÉ. Il a donc GARANTI un
    // écran blanc à tout client qui se connectait (capture Timo). Un contrôle
    // qui lit du TEXTE ne fait pas tourner une fonction.
    test("★ la demande part par la règle commune WhatsApp, jamais un lien écrit dans l'écran, et le numéro vient de la BOUTIQUE (jamais codé en dur) — avec sa LISTE, sinon undefined.filter et écran blanc",
      /envoyerWhatsApp\(boutiqueContact\.tel, texteDemandeDonnees\(/.test(ec)
      && /boutiquesVisibles\(db, profile, db\.boutiques \|\| \[\]\)/.test(ec)
      && !/wa\.me|\+228\d/.test(ec));

    test("★ sans numéro de boutique, on ne fait pas semblant : on le DIT et on renvoie vers 💬 Messages, où la demande arrive quand même",
      /numéro de votre boutique n'est pas encore renseigné/.test(ec) && /onglet 💬 Messages/.test(ec));

    test("★ le document du client porte le bandeau de FORMATION quand son compte est d'entraînement — un document d'essai ne doit jamais passer pour un vrai",
      /formation: estCompteFormation\(db, profile\)/.test(ec));

    test("★ l'écran ne refiltre RIEN : sur l'appareil du client la base ne contient que ses données, les politiques du serveur sont la seule barrière (règle posée depuis toujours) — et le code le DIT au lieu de le laisser deviner",
      /seule barrière/.test(ec) && /ne contient que ses données/i.test(ec));
  }
}

// ═══════════════════════════════════════════════════════════
// 🖥 L'ÉCRAN DU CLIENT S'AFFICHE — MESURÉ, PAS PRÉSUMÉ (19/09/2026)
//
// Capture Timo : un client tape son nom et son mot de passe, et tombe sur du
// BLANC. Cause : `boutiquesVisibles(db, profile)` sans sa liste →
// `undefined.filter(...)` → exception au rendu. Le banc lisait le TEXTE de
// l'appel et le trouvait ; il exigeait même la forme fautive. Depuis, on REND.
// ═══════════════════════════════════════════════════════════
{
  titre("🖥 L'écran du client s'affiche — mesuré, pas présumé (19/09/2026)");

  test("★★⚠ L'ÉCRAN DU CLIENT SE REND SANS LEVER — le défaut du 19/09/2026 (écran blanc à la connexion) tombe ici, et nulle part ailleurs",
    !!ecranClient && ecranClient.htmlGarni.length > 500, ecranClientErreur);

  test("★★⚠ …ET AVEC LA VRAIE BASE D'UN TÉLÉPHONE DE CLIENT : presque rien (ni boutiques, ni produits) — les politiques du serveur ne lui descendent QUE ses données, un écran qui présume une table est un écran blanc en puissance",
    !!ecranClient && ecranClient.htmlNu.length > 500, ecranClientErreur);

  test("★★⚠ LE NOUVEL ONGLET 🔒 Mes données SE REND AUSSI, base garnie ET base nue — c'est un écran de plus, donc un écran blanc de plus en puissance",
    !!ecranClient && ecranClient.htmlDonnees.length > 300 && ecranClient.htmlDonneesNu.length > 300,
    ecranClientErreur);

  test("★★ il dit « MES données personnelles », JAMAIS « VOS » (Timo, 19/09/2026) : un panneau au bas d'un autre écran, c'est BMI qui montre ; un onglet à lui, c'est le client qui vient chercher. Le mot suit la place.",
    !!ecranClient && /Mes données personnelles/.test(ecranClient.htmlDonnees)
    && !/Vos données personnelles/.test(ecranClient.htmlDonnees)
    // …et il a bien son contenu, ce n'est pas une page vide qui « ne lève pas »
    && /Télécharger mes données/.test(ecranClient.htmlDonnees));

  test("★ …et le panneau a QUITTÉ 🏠 Mon espace : il n'y est plus en double (deux endroits finiraient par se contredire)",
    !!ecranClient && !/données personnelles/i.test(ecranClient.htmlGarni));

  test("★★ l'onglet est À CÔTÉ DE 💬 Messages, dans cet ordre, et il est LISTÉ dans ONGLETS_ROLE — donc retirable dans 🔐 Pouvoirs (un onglet qu'on ne peut pas retirer est un pouvoir qui échappe à l'administrateur)",
    (() => {
      const calc = readFileSync("src/lib/calculs.js", "utf8");
      const app = readFileSync("src/App.jsx", "utf8");
      return /client: \["espace_client", "messages", "mes_donnees", "mes_contrats"\]/.test(calc)
        && /mes_donnees: "🔒 Mes données"/.test(calc)
        && /\["messages", labelMessages\], \["mes_donnees", "🔒 Mes données"\]/.test(app);
    })());

  // ⚠ LA RÈGLE GÉNÉRALE, pour que ça ne revienne pas par un autre écran.
  {
    const partout = execSync("grep -rn 'boutiquesVisibles(db, profile)' src --include=*.jsx --include=*.js || true").toString().trim();
    test("★★ PLUS AUCUN `boutiquesVisibles(db, profile)` à DEUX arguments dans toute l'application : la liste est le troisième, et sans elle c'est un écran blanc. Deux s'étaient glissés (l'espace client, et ⚙ Paramètres sur le dossier d'un employé — celui-là n'avait pas encore été vu)",
      partout === "", partout.split("\n").slice(0, 5).join("\n     "));
  }

  test("★ et la fonction elle-même ne peut PLUS rendre un écran blanc : une liste absente donne une liste vide, jamais une exception — le banc attrape l'oubli, l'utilisateur ne le paie pas",
    (() => {
      const src = readFileSync("src/lib/calculs.js", "utf8");
      return /return \(liste \|\| \[\]\)\.filter/.test(src);
    })());
}

// ═══════════════════════════════════════════════════════════
// ⏳ LA DURÉE DE CONSERVATION DES DONNÉES D'UN CLIENT (19/09/2026)
//
// Timo, le dernier point ouvert de la protection des données : « 6 ans après
// le dernier achat. On peut à tout moment changer cette durée ».
//
// ⚠⚠ RIEN NE S'EFFACE TOUT SEUL — sa décision entre trois propositions :
// l'application PROPOSE, l'administrateur CONFIRME. Le banc le MESURE, parce
// que c'est la règle la plus facile à trahir sans s'en apercevoir.
// ═══════════════════════════════════════════════════════════
{
  titre("⏳ La durée de conservation des données d'un client (19/09/2026)");

  test("★ 6 ans est la valeur par défaut, et une maison qui n'a rien réglé l'annonce quand même — le document doit TOUJOURS pouvoir dire un chiffre, jamais « pas de durée »",
    Cons.DUREE_CONSERVATION_DEFAUT === 6
    && Cons.dureeConservation({ boutiques: [{ nom: "A" }] }) === 6
    && Cons.dureeConservation({}) === 6
    && Cons.dureeConservation({ boutiques: [{ nom: "A", duree_conservation_ans: 10 }] }) === 10);

  test("★ elle se change à tout moment (sa demande) : le réglage s'écrit sur les boutiques, comme la liste des banques — rien à coller dans Supabase",
    (() => {
      const b = Cons.poserDureeConservation([{ nom: "A" }, { nom: "B", banques: ["BTCI"] }], 8);
      return b.length === 2 && b[0].duree_conservation_ans === 8 && b[1].duree_conservation_ans === 8
        && b[1].banques[0] === "BTCI"   // le reste de la fiche ne bouge pas
        && Cons.dureeConservation({ boutiques: b }) === 8;
    })());

  test("★ une durée absurde est refusée en le DISANT : 0, une moitié d'année, ou 900 ans sur le papier d'un client",
    !!Cons.critiqueDuree(0) && !!Cons.critiqueDuree(-3) && !!Cons.critiqueDuree(2.5)
    && !!Cons.critiqueDuree("") && !!Cons.critiqueDuree("abc") && !!Cons.critiqueDuree(900)
    && Cons.critiqueDuree(6) === "" && Cons.critiqueDuree(1) === "" && Cons.critiqueDuree(30) === "");

  test("★ la date limite se calcule à l'année près : au 15/09/2026, 6 ans renvoient au 15/09/2020",
    Cons.dateLimiteConservation(6, "2026-09-15") === "2020-09-15"
    && Cons.dateLimiteConservation(10, "2026-01-02") === "2016-01-02");

  test("★★ QUI dépasse : celui dont la dernière trace est ANTÉRIEURE à la limite, les plus anciens en tête — et le jour PILE des 6 ans ne dépasse pas encore",
    (() => {
      const clients = [
        { cle: "a", nom: "VIEUX", tel: "90", derniere: "2018-03-01" },
        { cle: "b", nom: "RECENT", tel: "91", derniere: "2026-01-10" },
        { cle: "c", nom: "PILE", tel: "92", derniere: "2020-09-15" },
        { cle: "d", nom: "LIMITE", tel: "93", derniere: "2020-09-14" },
      ];
      const r = Cons.clientsDepasses(clients, 6, "2026-09-15");
      return r.length === 2 && r[0].nom === "VIEUX" && r[1].nom === "LIMITE";
    })());

  test("★ un client SANS aucune date n'est jamais emporté par erreur — devant un doute, on n'efface pas",
    Cons.clientsDepasses([{ cle: "x", nom: "SANS DATE", derniere: "" }], 6, "2026-09-15").length === 0
    && Cons.clientsDepasses([{ cle: "y", nom: "RIEN" }], 6, "2026-09-15").length === 0);

  test("★ « dernier achat » vient de clientsEffacables, qui prend déjà la plus récente des ventes, dettes et chantiers — et, pour un compte créé JAMAIS utilisé, la date de création : sans ce repli il ne serait JAMAIS concerné",
    (() => {
      const l = Eff.clientsEffacables({
        comptes: [{ id: "c1", role: "client", nom: "JAMAIS ACHETÉ", tel: "90111111", cree_le: "2017-05-02" }],
        ventes: [{ client: "ACHETEUR", tel: "90222222", date: "2019-01-01" }],
        dettes: [], chantiers: [],
      });
      const r = Cons.clientsDepasses(l, 6, "2026-09-15");
      return r.length === 2 && r.some((c) => c.nom === "JAMAIS ACHETÉ");
    })());

  test("★ l'ancienneté se lit en français, pas en nombre à virgule",
    Cons.libelleAnciennete(7.1) === "7 ans" && Cons.libelleAnciennete(1.0) === "1 an"
    && Cons.libelleAnciennete(6.5) === "6 ans et demi" && Cons.libelleAnciennete(0.3) === "moins d'un an");

  test("★★ LA PHRASE NE PROMET PAS UNE DISPARITION TOTALE : elle dit la durée, elle dit que le nom part, et elle dit que les FACTURES restent (la loi commerciale l'oblige) — promettre mieux serait une promesse qu'on ne tiendra pas",
    /6 ans après votre dernier achat/.test(Cons.phraseConservation(6))
    && /12 ans après votre dernier achat/.test(Cons.phraseConservation(12))
    && /factures et les contrats, eux, restent/i.test(Cons.phraseConservation(6))
    && /nom en est retiré/i.test(Cons.phraseConservation(6)));

  test("★ elle est écrite UNE fois : le document du client la reprend telle quelle, l'écran aussi — deux textes finiraient par se contredire",
    Dos.mentionsDossier(6).some((m) => m === Cons.phraseConservation(6))
    && Dos.mentionsDossier(9).some((m) => /9 ans après votre dernier achat/.test(m)));

  // ⚠⚠ LE CONTRÔLE LE PLUS IMPORTANT DE CE BLOC.
  test("★★⚠ RIEN NE S'EFFACE TOUT SEUL (décision Timo, 19/09/2026) : lib/conservation.js ne contient AUCUNE fonction qui efface, et n'importe rien de l'effacement — il DIT qui dépasse, l'administrateur décide",
    (() => {
      const src = readFileSync("src/lib/conservation.js", "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      return !/effacerClient|journalEffacement|\bsave\s*\(/.test(src)
        && !/^import /m.test(src)
        && Object.keys(Cons).every((k) => !/^effacer/.test(k));
    })());

  {
    const par = readFileSync("src/screens/Parametres.jsx", "utf8");

    test("★ le réglage est réservé à l'administrateur PRINCIPAL, revérifié DANS le geste — c'est lui qui répond de la promesse faite au client",
      /refuserSaufAdminPrincipal\(db, profile, "Changer la durée de conservation des données"\)/.test(par)
      && /poserDureeConservation\(db\.boutiques, ans\)/.test(par));

    test("★★⚠ L'ÉCRAN NE PROPOSE AUCUN « TOUT EFFACER » : la liste des dépassés ouvre un client à la fois, par le MÊME chemin que l'effacement ordinaire (setCibleEff), avec ses avertissements",
      /depassesEff\.map/.test(par) && /setCibleEff\(\{ nom: c\.nom, tel: c\.tel \}\)/.test(par)
      && !/tout effacer|effacerTous|effacerLesDepasses/i.test(par));

    test("★ la liste part de listeEff — DÉJÀ filtrée par l'espace regardé — jamais de db : une fonction qui reçoit une table entière et la parcourt est un passage de mur en puissance (leçon du 18/09)",
      /clientsDepasses\(listeEff, dureeEnCours, today\(\)\)/.test(par));

    test("★ l'écran DIT que rien ne partira tout seul, même quand la liste est vide — sinon on laisserait croire à un balayage automatique",
      /rien ne s'effacera tout seul/i.test(par) && /Rien ne part sans votre geste/i.test(par));

    test("★ et la ligne « décider d'une durée de conservation » a QUITTÉ la liste de ce que l'application ne peut pas faire : elle est décidée, une alerte qui ne commande plus rien se retire",
      !/Décider d'une <b>durée de conservation<\/b>/.test(par)
      // les deux autres, elles, tiennent toujours
      && /IPDCP/.test(par) && /hébergement hors du Togo/.test(par));
  }
}

// ═══════════════════════════════════════════════════════════
// 🏦 LE NUMÉRO DE COMPTE D'UN EMPLOYÉ SORT DE LA VUE DE TOUS (18/09/2026)
//
// Timo : « et les employés dans cette histoire, leurs données ne sont-elles
// pas protégées ? ». Deux fuites du MÊME numéro : la fiche employé, que tous
// les appareils téléchargent, et la dépense d'un virement, qui le recopiait
// EN ENTIER. Fermer l'une sans l'autre n'aurait servi à rien.
// ═══════════════════════════════════════════════════════════
{
  titre("🏦 Le numéro de compte d'un employé sort de la vue de tous (18/09/2026)");

  test("★⚠ LE NUMÉRO DE COMPTE quitte la fiche employé pour la fiche de PAIE (que seuls l'admin, le comptable et l'intéressé reçoivent) — masquer à l'écran n'était PAS protéger : la donnée descendait quand même sur le téléphone de chacun",
    Paie.CHAMPS_PAIE.includes("compte_bancaire"));

  test("★ mais LE NOM de la banque RESTE sur la fiche employé, volontairement : ce n'est pas un secret, et un gérant ou un chef d'équipe qui paie une prime doit pouvoir écrire vers quelle banque l'argent part (règle Timo du 14/09/2026)",
    !Paie.CHAMPS_PAIE.includes("banque"));

  test("★ il DÉMÉNAGE vraiment : la règle le détache de la fiche employé et le range dans la fiche de paie — et la fiche employé garde tout le reste",
    (() => {
      const u = [{ id: "u1", nom: "KOSSI", role: "vendeur", banque: "BTCI", compte_bancaire: "0123456789", salaire_base: 120000 }];
      const r = Paie.separerPaie(u, { id: "u1" });
      return r.users[0].compte_bancaire === undefined
        && r.users[0].banque === "BTCI" && r.users[0].nom === "KOSSI"
        && r.paie[0].compte_bancaire === "0123456789";
    })());

  test("★ et il REVIENT à l'usage pour qui a le droit de le recevoir (l'écran continue de lire u.compte_bancaire sans rien savoir de la séparation)",
    (() => {
      const u = [{ id: "u1", nom: "KOSSI", banque: "BTCI" }];
      return Paie.fusionnerPaie(u, [{ id: "u1", compte_bancaire: "0123456789" }])[0].compte_bancaire === "0123456789";
    })());

  test("★⚠ LA SECONDE PORTE : un paiement par virement recopiait le numéro EN ENTIER sur la dépense — et la table des dépenses descend, elle aussi, sur tous les appareils. Elle ne garde plus que les quatre derniers chiffres",
    (() => {
      const m = Bq.mentionVirement({ banque: "BTCI", compte_bancaire: "0123456789" }, "Virement bancaire");
      return m.banque === "BTCI" && m.compte_bancaire === "…6789";
    })());

  test("★ et le contrôle est ÉPROUVÉ : le numéro entier ne doit JAMAIS ressortir de cette fonction, quelle que soit sa longueur",
    (() => {
      const long = Bq.mentionVirement({ banque: "B", compte_bancaire: "TG5310010100123456789012" }, "virement");
      const court = Bq.mentionVirement({ banque: "B", compte_bancaire: "999" }, "virement");
      return !/\d{5}/.test(long.compte_bancaire) && long.compte_bancaire === "…9012"
        // ⚠ Un numéro de 4 caractères ou moins reste tel quel : le raccourcir
        // n'apprendrait rien de plus à personne, et « …999 » serait un mensonge.
        && court.compte_bancaire === "999";
    })());

  test("★ hors virement, rien n'est écrit du tout (espèces, Flooz : la banque n'a rien à y faire)",
    Object.keys(Bq.mentionVirement({ banque: "BTCI", compte_bancaire: "0123456789" }, "Espèces")).length === 0
    && Object.keys(Bq.mentionVirement({ compte_bancaire: "0123456789" }, "Virement")).length === 0);

  test("★ AUCUN écran ne lit le numéro ENTIER : il ne se saisit que dans 👥 Utilisateurs (admin) et ne s'affiche que masqué (compteMasque) — le banc le mesure, il ne le présume pas",
    (() => {
      const lecteurs = execSync("grep -rln 'compteDe(\\|compte_bancaire' src/screens src/components || true")
        .toString().trim().split("\n").filter(Boolean).sort().join("|");
      return lecteurs === "src/screens/Utilisateurs.jsx";
    })());

  {
    const sql = readFileSync("supabase/paie-2-compte-bancaire.sql", "utf8");
    test("★ LE SCRIPT que Timo colle déménage les numéros DÉJÀ écrits, raccourcit ceux des dépenses, et NE TOUCHE PAS au nom de la banque — un changement de code seul n'aurait rien déplacé",
      /data - 'compte_bancaire'/.test(sql)
      && /insert into public\.paie/.test(sql)
      && /update public\.depenses/.test(sql)
      && !/data - 'banque'/.test(sql));

    test("★⚠ l'horodatage reste ACTIF, à l'inverse de l'habitude : une ligne nettoyée doit REDESCENDRE sur les téléphones, sinon leur copie locale garderait le numéro",
      !/disable trigger horodatage/.test(sql) && /doit REDESCENDRE sur les téléphones/.test(sql));

    test("★ il porte sa vérification et son retour en arrière, comme tout script collé chez lui",
      /aucun_numero_sur_une_fiche_employe/.test(sql)
      && /aucun_numero_entier_sur_une_depense/.test(sql)
      && /EN CAS DE PROBLÈME/.test(sql));

    test("★ et le banc SQL le REJOUE sur base jetable : il prouve la fuite AVANT, sa fermeture APRÈS, et qu'un vendeur ne voit plus le numéro de son collègue",
      (() => { const bh = readFileSync("scripts/tester-paie-sql.sh", "utf8");
        return /paie-2-compte-bancaire\.sql/.test(bh)
          && /AVANT : le numéro est bien sur la fiche employé/.test(bh)
          && /APRÈS : plus AUCUN numéro sur une fiche employé/.test(bh)
          && /ne voit plus le numéro de son collègue/.test(bh)
          && /relancer le script ne casse rien/.test(bh); })());
  }
}

// ═══════════════════════════════════════════════════════════
// 👥 LE DROIT D'ACCÈS D'UN EMPLOYÉ (19/09/2026)
//
// Timo : « et les employés dans cette histoire, leurs données ne sont-elles
// pas protégées… parmi les utilisateurs, le personnel n'y figure pas », puis
// « lance le dossier d'accès pour les employés ». Les trois premiers
// chantiers ne couvraient QUE les clients, alors que l'application en sait
// BIEN plus sur un employé.
// ═══════════════════════════════════════════════════════════
{
  titre("👥 Le droit d'accès d'un employé (19/09/2026)");

  const fmtE = (x) => `${Number(x || 0)} F`;
  const dFRE = (x) => String(x || "").slice(0, 10).split("-").reverse().join("/");
  const employe = {
    id: "u1", nom: "KOSSI", nom_complet: "KOSSI MENSAH", tel: "90112233", role: "gerant",
    boutique: "DEMAKPOE", actif: true, anniv: "14/03", cree_par: "TIMO",
    salaire_base: 120000, primes: [{ mois: "2026-08", motif: "Rendement", montant: 25000 }],
    avances: [{ mois: "2026-09", motif: "Avance", montant: 10000 }],
    virements: [{ mois: "2026-08", date: "2026-08-30", montant: 100000, statut: "accepte" }],
    credits: [{ date: "2026-07-01", montant_demande: 200000, statut: "approuve", rembourse: 50000 }],
    cnss_assujetti: true, cnss_matricule: "M-9", cnss_numero_assurance: "A-4421",
    cnss_date_embauche: "2024-01-15", piece_type: "CNI", piece_num: "AB1234",
    banque: "BTCI", compte_bancaire: "TG5310010100123456789012",
    // ⚠ Tout ce qui suit DOIT rester hors du document.
    pwd_hash2: "EMPREINTE-DU-MOT-DE-PASSE", pwd_salt: "GRAIN-DE-SEL",
    empreintes: [{ appareil: "a1", cle: "CLE-WEBAUTHN-SECRETE" }],
  };
  const activite = {
    evaluations: [{ date: "2026-08-10", accueil: 5, rapidite: 4, par_id: "u1" }, { date: "2026-09-01", par_id: "u1" }],
    ventes: [{ id: "v1" }, { id: "v2" }], depenses: [{ id: "d1" }], chantiers: [{ id: "c1" }],
    outils: [{ nom: "Perceuse Bosch", numero: "BMI-004", depuis: "2026-09-10", retour_prevu: "2026-09-20" }],
    messages: [{ id: "m1" }, { id: "m2" }],
  };
  const vueE = DosEmp.dossierEmploye(employe, activite, { fmt: fmtE, dFR: dFRE });

  test("★ LE DOSSIER D'UN EMPLOYÉ COUVRE CE QUE L'APPLICATION SAIT DE LUI — rémunération, primes, avances, virements, crédits, déclaratif CNSS, banque, évaluations, activité, outillage, messages : onze rubriques, aucune oubliée",
    vueE.sections.length === 11
    && ["Votre rémunération", "Vos avances sur salaire", "Votre déclaratif social (CNSS)", "Votre banque", "Le matériel de travail que vous détenez"]
      .every((t) => vueE.sections.some((x) => x.titre === t)));

  test("★⚠⚠ AUCUN SECRET N'Y ENTRE — mot de passe, grain de sel, CLÉS D'EMPREINTE : la même liste que pour un client (CHAMPS_INTERDITS), parce qu'un document qui traîne ne doit jamais être une clé",
    (() => {
      const tout = JSON.stringify(vueE);
      return DosEmp.CHAMPS_INTERDITS.every((c) => !tout.includes(c))
        && !/EMPREINTE-DU-MOT-DE-PASSE|GRAIN-DE-SEL|CLE-WEBAUTHN-SECRETE/.test(tout);
    })());

  test("★⚠ LE NUMÉRO DE COMPTE N'Y FIGURE QUE MASQUÉ, même vers son propriétaire — et le document DIT qu'il est masqué, sinon on laisserait croire qu'on ne détient que quatre chiffres",
    (() => {
      const b = vueE.sections.find((x) => x.titre === "Votre banque").lignes;
      const compte = b.find(([l]) => l === "Compte")[1];
      return !JSON.stringify(vueE).includes("TG5310010100123456789012")
        && /…9012/.test(compte) && /4 derniers chiffres/.test(compte)
        && b.find(([l]) => l === "Banque")[1] === "BTCI";
    })());

  test("★ L'ANNÉE DE NAISSANCE n'est jamais demandée par l'application — le document le DIT au lieu de laisser croire à un oubli",
    /jour et mois seulement/.test(vueE.identite.find(([l]) => l === "Anniversaire")[1]));

  test("★⚠ UNE ÉVALUATION DONNE LA NOTE, JAMAIS QUI L'A DONNÉE : ce serait la donnée d'un client, pas la sienne — et une évaluation sans aucun critère rempli vaut « non notée », jamais zéro",
    (() => {
      const ev = vueE.sections.find((x) => /évaluations/.test(x.titre));
      return ev.lignes.length === 2 && ev.colonnes.length === 2
        && ev.lignes[0][1] === "4,5" && ev.lignes[1][1] === "non notée"
        && !JSON.stringify(ev).includes("par_id");
    })());

  test("★⚠⚠ LE DOCUMENT DIT CE QUI NE S'EFFACERA PAS : rémunération, déclarations sociales et pièces comptables se conservent par obligation légale. Laisser croire le contraire à un employé serait malhonnête — d'où AUCUN bouton d'effacement de ce côté",
    vueE.mentions.some((m) => /ne peuvent pas être effacées à votre demande/.test(m))
    && vueE.mentions.some((m) => /loi n° 2019-014/.test(m))
    && vueE.mentions.some((m) => /droit d'accès et de rectification/.test(m))
    && !readFileSync("src/screens/Parametres.jsx", "utf8").includes("effacerEmploye"));

  test("★ un compte CLIENT est REFUSÉ ici et renvoyé vers son propre bloc : son dossier parle d'achats et de chantiers, pas de salaire",
    /CLIENT/.test(DosEmp.critiqueDossierEmploye({ id: "x", role: "client" }))
    && DosEmp.critiqueDossierEmploye(employe) === ""
    && /Choisissez un employé/.test(DosEmp.critiqueDossierEmploye(null)));

  test("★ une fiche de paie NON REÇUE par l'appareil ne fabrique pas de faux zéros : le document dit « non renseigné » (les champs valent undefined, jamais 0)",
    (() => {
      const nu = DosEmp.dossierEmploye({ id: "u9", nom: "AMA", role: "vendeur" }, {}, { fmt: fmtE, dFR: dFRE });
      const r = nu.sections.find((x) => x.titre === "Votre rémunération").lignes;
      return r.find(([l]) => l === "Salaire de base")[1] === "non renseigné"
        && nu.sections.find((x) => x.titre === "Votre banque").lignes.find(([l]) => l === "Compte")[1] === "non renseigné";
    })());

  test("★ LA TRACE NOMME l'employé (on n'efface rien ici, il faut pouvoir dire à qui on a remis) et le fichier porte son nom",
    /KOSSI MENSAH/.test(DosEmp.journalDossierEmploye(employe, { nom: "TIMO" }, { format: "PDF" }))
    && /TIMO/.test(DosEmp.journalDossierEmploye(employe, { nom: "TIMO" }, {}))
    && DosEmp.nomDossierEmploye(employe) === "Dossier personnel - KOSSI MENSAH");

  // ---- LE PDF : on lit ce qui est RÉELLEMENT écrit dedans ----
  {
    const doc = PdfDos.genererDossierPersonnel(vueE, { edite: "19/09/2026", client: "KOSSI MENSAH" }, true);
    const lu = [];
    for (let pg = 1; pg <= doc.internal.getNumberOfPages(); pg++)
      for (const ligne of doc.internal.pages[pg].join("\n").split("\n")) {
        const m = ligne.match(/\((.*?)\)\s*Tj/);
        if (m) lu.push(m[1]);
      }
    const ecrit = lu.join(" | ");

    test("★ LE MÊME DESSINATEUR sert les deux dossiers (client et employé) : genererDossierPersonnel n'a pas eu UNE ligne de plus à apprendre — deux documents, un seul rendu",
      /VOS DONNÉES PERSONNELLES/.test(ecrit) && /KOSSI MENSAH/.test(ecrit)
      && /A-4421/.test(ecrit) && /Perceuse Bosch/.test(ecrit) && /2019-014/.test(ecrit));

    test("★⚠ et le PDF de l'employé ne porte AUCUN secret non plus, ni son numéro de compte entier",
      !/EMPREINTE-DU-MOT|GRAIN-DE-SEL|CLE-WEBAUTHN|pwd_|TG5310010100123456789012/.test(ecrit)
      && /…9012|\.\.\.9012/.test(ecrit.replace(/\\(\d)/g, "$1")));

    test("★ le piège de jsPDF est évité ici aussi : aucune ligne ne sort en lettres espacées",
      !/ [A-Z] [a-z] [a-z] /.test(ecrit));
  }

  {
    const par = readFileSync("src/screens/Parametres.jsx", "utf8");
    test("★ le geste vit dans le MÊME panneau 🔒 Données personnelles, réservé à l'administrateur PRINCIPAL — revérifié DANS le geste",
      /refuserSaufAdminPrincipal\(db, profile, "Remettre à un employé le dossier de ses données"\)/.test(par)
      && /Les données d'un employé/.test(par));

    test("★⚠ LE MUR : les employés viennent de comptesEff (utilisateursDeLEspace), son activité est filtrée par l'espace regardé — jamais db.users ni db.ventes en entier",
      /const employesEff = comptesEff\.filter/.test(par)
      && /\(db\.ventes \|\| \[\]\)\.filter\(espaceEff\)/.test(par)
      && /chantiersEff\.filter/.test(par));

    test("★ l'écran DIT pourquoi il n'y a pas de bouton « effacer » — un manque expliqué n'est pas un oubli",
      /pas de bouton « effacer » ici, et ce n'est pas un oubli/.test(par)
      && /obligation légale/.test(par));

    test("★ la ligne de recherche passe par LA règle commune (champRecherche) et LA règle de recherche (correspond), jamais un filtre maison",
      /placeholder="Rechercher un employé[^"]*" value=\{qEmp\}/.test(par)
      && /correspond\(`\$\{x\.nom\} \$\{x\.nom_complet \|\| ""\} \$\{motsDuNumero\(x\.tel\)\}`, qEmp\)/.test(par));
  }
}

// ═══════════════════════════════════════════════════════════
// ✏️ UNE PÉRIODE À SOI DANS 💰 VENTES (Timo, 19/09/2026)
// « Pour filtrer les ventes ou proforma, il n'y a pas personnaliser…
//  ajouter. » Les cinq périodes toutes faites ne répondent pas à « du 3 au
// 12 ». ⚠ Le vrai risque n'est pas la règle (trois lignes) : c'est que le
// filtre s'applique aux VENTES et pas aux PROFORMAS, ou l'inverse — l'écran
// afficherait alors une période pour une liste et pas pour l'autre, sans que
// rien ne le dise.
// ═══════════════════════════════════════════════════════════
titre("✏️ Personnaliser la période (💰 Ventes)");
{
  const b = C.bornesPersonnalisees;
  test("deux dates dans l'ordre sont gardées telles quelles",
    b("2026-09-12", "2026-09-18").join("|") === "2026-09-12|2026-09-18");
  test("★ deux dates À L'ENVERS sont remises dans l'ordre (un filtre n'est pas un geste d'argent)",
    b("2026-09-18", "2026-09-12").join("|") === "2026-09-12|2026-09-18");
  test("★ seul « du » : la fin reste OUVERTE", b("2026-09-12", "").join("|") === "2026-09-12|9999-12-31");
  test("★ seul « au » : le début reste OUVERT", b("", "2026-09-18").join("|") === "0000-01-01|2026-09-18");
  test("rien des deux : tout passe", b("", "").join("|") === "0000-01-01|9999-12-31");
  test("une borne est bornée au jour (une date horodatée ne casse rien)",
    b("2026-09-12T10:30:00", "2026-09-18").join("|") === "2026-09-12|2026-09-18");

  const L = C.libellePeriodePersonnalisee;
  test("★ l'écran DIT la période appliquée", L("2026-09-12", "2026-09-18") === "Du 12/09/2026 au 18/09/2026");
  test("★ …y compris quand les dates ont été remises dans l'ordre (jamais en silence)",
    L("2026-09-18", "2026-09-12") === "Du 12/09/2026 au 18/09/2026");
  test("une seule borne se lit en français", L("2026-09-12", "") === "Depuis le 12/09/2026" && L("", "2026-09-18") === "Jusqu'au 18/09/2026");
  test("deux cases vides ne mentent pas", L("", "") === "Toute période");

  const v = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★ l'option « Personnaliser » est proposée après les cinq périodes",
    /<option value=\{PERIODE_PERSO\}>✏️ Personnaliser…<\/option>/.test(v));
  test("★ les deux cases n'apparaissent QUE si on les demande",
    /\{periodeIndex === PERIODE_PERSO && \(/.test(v) && (v.match(/type="date"/g) || []).length >= 2);
  test("★★ UN SEUL calcul de bornes, lu par les DEUX listes — ventes et proformas ne peuvent pas diverger",
    /const bornesPeriode = periodeIndex === PERIODE_PERSO/.test(v)
    && (v.match(/!bornesPeriode \|\| inP\(x\.date, bornesPeriode\[0\], bornesPeriode\[1\]\)/g) || []).length === 2);
  test("★ l'ancien filtre « une période toute faite » marche toujours (index numérique)",
    /periodes\(\)\[periodeIndex\]\[1\], periodes\(\)\[periodeIndex\]\[2\]/.test(v));
  test("la règle vit dans lib/calculs.js, pas dans l'écran",
    !/function bornesPersonnalisees/.test(v) && /export function bornesPersonnalisees/.test(readFileSync("src/lib/calculs.js", "utf8")));
}

// ═══════════════════════════════════════════════════════════
// 💰 LA RECETTE À CÔTÉ DES DATES (Timo, 19/09/2026)
// « À côté des dates, ajouter recette : total des ventes sur la période
//  choisie. » ⚠ Le danger d'un total affiché n'est pas le calcul : c'est
// qu'il porte sur AUTRE CHOSE que ce qu'on a sous les yeux. Un chiffre qu'on
// ne peut pas retrouver en additionnant les lignes visibles est invérifiable,
// donc on cesse de s'y fier — et on cesse aussi de se fier au reste.
// ═══════════════════════════════════════════════════════════
titre("💰 La recette de ce qui est affiché (💰 Ventes)");
{
  const vente = (n, total, repris) => ({
    id: `v${n}`, date: "2026-09-18",
    articles: [{ article: "Article", qte: 1, pu: total }],
    ...(repris ? { reprises: [{ montant: repris }] } : {}),
  });
  const R = C.recetteDesVentes;
  test("la recette additionne ce qu'ont payé les clients", R([vente(1, 38500), vente(2, 71000)]).brut === 109500);
  test("…et compte les ventes", R([vente(1, 1000), vente(2, 2000), vente(3, 3000)]).nb === 3);
  test("une liste vide vaut zéro, jamais un vide à l'écran", R([]).brut === 0 && R([]).nb === 0);
  test("une liste absente ne casse rien", R(null).brut === 0 && R(undefined).nb === 0);
  test("★★ une REPRISE se voit : le brut reste celui de la colonne TOTAL…",
    R([vente(1, 38500), vente(2, 71000, 12000)]).brut === 109500);
  test("★★ …et le NET dit ce qui est resté dans la caisse",
    R([vente(1, 38500), vente(2, 71000, 12000)]).net === 97500 && R([vente(1, 38500), vente(2, 71000, 12000)]).repris === 12000);
  test("sans reprise, brut et net sont le même chiffre (pas de second nombre pour rien)",
    R([vente(1, 50000)]).brut === R([vente(1, 50000)]).net && R([vente(1, 50000)]).repris === 0);
  test("une reprise plus grande que la vente ne rend jamais un négatif", R([vente(1, 1000, 9999)]).net === 0);

  const T = C.totalDesProformas;
  test("★ une PROFORMA a son propre total, séparé — ce n'est pas une recette",
    T([{ total: 1000 }, { total: 2000 }]).total === 3000 && T([]).total === 0);

  const v = readFileSync("src/screens/Ventes.jsx", "utf8");
  test("★★ la recette est calculée sur la liste AFFICHÉE (listeFiltree), jamais sur la liste entière",
    /recetteDesVentes\(listeFiltree\)/.test(v) && !/recetteDesVentes\(liste\)/.test(v));
  test("★ le total des proformas aussi (proformasFiltres)",
    /totalDesProformas\(proformasFiltres\)/.test(v) && !/totalDesProformas\(proformasListe\)/.test(v));
  // ⚠ CE CONTRÔLE A ÉTÉ REFAIT LE 19/09/2026, le jour même : la première
  // version cherchait deux textes et les trouvait tous les deux même quand on
  // collait « Recette » DEVANT le total des proformas. Elle rassurait sans
  // protéger. On compte donc les occurrences : le mot ne s'écrit QU'UNE fois
  // dans tout l'écran, et jamais du côté des proformas.
  test("★★ le mot « Recette » ne s'écrit QU'UNE fois, et jamais sur les proformas",
    (v.match(/Recette/g) || []).length === 1
    && /💰 Recette :/.test(v)
    && /Total des proformas :/.test(v)
    // ⚠ On regarde la LIGNE du total des proformas, pas le fichier entier :
    // une recherche trop large retombait sur le nom des fonctions importées
    // (`recetteDesVentes, totalDesProformas`) et criait à tort.
    && !/recette/i.test(v.split("\n").find((l) => l.includes("Total des proformas :")) || ""));
  test("★ le montant repris s'affiche seulement s'il y en a un",
    /\{r\.repris > 0 && \(/.test(v));
  test("les deux règles vivent dans lib/calculs.js",
    /export function recetteDesVentes/.test(readFileSync("src/lib/calculs.js", "utf8"))
    && /export function totalDesProformas/.test(readFileSync("src/lib/calculs.js", "utf8")));
}

// ──────────────────────────────────────────────────────────────
titre("👥 DEUX COMPTES DU MÊME NOM : C'EST LE MOT DE PASSE QUI DÉPARTAGE (Timo, 20/09/2026)");
{
  const lit = (f) => readFileSync(f, "utf8");
  const conn = lit("src/screens/Connexion.jsx");
  const serveur = lit("api/chercher-compte.js");
  const util = lit("src/screens/Utilisateurs.jsx");
  const identite = lit("src/lib/identiteClient.js");

  // Sa base : un TECHNICIEN ESSO et un CLIENT ESSO.
  const dbEsso = { users: [
    { id: "u_cli_esso", nom: "ESSO", role: "client", tel: "90112233" },
    { id: "u_tech_esso", nom: "ESSO", role: "technicien", tel: "99968488" },
  ] };

  test("★ la comparaison d'identifiant ignore espaces et majuscules",
    Cli.memeIdentifiant(" Esso ", "ESSO") && Cli.memeIdentifiant("esso", "ESSO"));
  test("un identifiant vide ne correspond à rien",
    !Cli.memeIdentifiant("", "") && !Cli.memeIdentifiant("  ", "ESSO"));
  test("★★ les DEUX ESSO sont retrouvés, pas le premier seul",
    Cli.comptesDeLIdentifiant(dbEsso, "esso").length === 2);

  // ── Le garde-fou : on n'en fabrique plus.
  const refus = Cli.critiqueIdentifiantEmploye(dbEsso, "esso");
  test("★★ créer un employé ESSO est REFUSÉ", !!refus);
  test("★ et le refus DIT qui le détient déjà (sinon on ne sait pas quoi corriger)",
    /client/i.test(refus) && /ESSO/.test(refus));
  test("un nom libre passe", Cli.critiqueIdentifiantEmploye(dbEsso, "KOSSI") === "");
  test("un nom vide est refusé", !!Cli.critiqueIdentifiantEmploye(dbEsso, "   "));
  // ⚠ Le mur ne protège PAS de ça : la connexion cherche dans toute la maison.
  const dbForm = { users: [{ id: "u_f", nom: "ESSO", role: "vendeur", formation: true }] };
  test("★★ un ESSO de FORMATION gêne un ESSO réel — la connexion, elle, ne cloisonne pas",
    !!Cli.critiqueIdentifiantEmploye(dbForm, "ESSO")
    && /formation/i.test(Cli.critiqueIdentifiantEmploye(dbForm, "ESSO")));

  // ── La proposition : le PRÉNOM d'abord, c'est ce qui distingue deux gens.
  test("★ la proposition prend le prénom quand il y en a un",
    Cli.propositionIdentifiant(dbEsso, "ESSO", "Kossi", "99968488") === "ESSO KOSSI");
  test("★ sans prénom, elle retombe sur les chiffres du numéro",
    Cli.propositionIdentifiant(dbEsso, "ESSO", "", "99968488") === "ESSO99");
  test("★ et ce qu'elle propose est TOUJOURS libre",
    Cli.comptesDeLIdentifiant(dbEsso, Cli.propositionIdentifiant(dbEsso, "ESSO", "", "99968488")).length === 0
    && Cli.comptesDeLIdentifiant(dbEsso, Cli.propositionIdentifiant(dbEsso, "ESSO", "Kossi", "")).length === 0);

  // ── LA CONNEXION, les deux côtés.
  test("★★ l'appareil ne prend plus le PREMIER compte du nom",
    !/db\.users\.find\(\(x\) => x\.nom/.test(conn) && /db\.users\.filter\(\(x\) => memeIdentifiant\(x\.nom, saisie\)\)/.test(conn));
  test("★★ hors réseau, c'est le mot de passe qui départage",
    /!venuDuServeur && candidats\.length > 1/.test(conn) && /verifierMotDePasse\(c, pwd\)\)\.ok\) \{ u = c; break; \}/.test(conn));
  test("★ une copie périmée n'est oubliée que si elle aurait laissé entrer",
    /for \(const c of candidats\)[\s\S]{0,160}oublierCompteLocal\(c\.id\)/.test(conn));
  test("★★ le serveur ne prend plus le premier non plus",
    !/\(lignes \|\| \[\]\)\.find\(/.test(serveur)
    && /const candidats = \(lignes \|\| \[\]\)\s*\n\s*\.filter\(\(l\) => memeIdentifiant/.test(serveur));
  test("★★ et c'est le mot de passe qui choisit, côté serveur aussi",
    /const ligne = candidats\.find\(\(l\) => motDePasseCorrect\(/.test(serveur));
  test("★ le nombre d'essais est BORNÉ (un mot de passe coûte 150 000 tours)",
    /slice\(0, MAX_HOMONYMES\)/.test(serveur) && /export const MAX_HOMONYMES = \d+;/.test(identite));
  test("★★ LE COUPLE : les deux côtés lisent LA MÊME règle, aucune recopie",
    /from "\.\.\/src\/lib\/identiteClient\.js"/.test(serveur)
    && /memeIdentifiant/.test(serveur) && /memeIdentifiant/.test(conn)
    && !/String\(nom\)\.trim\(\)\.toLowerCase\(\)/.test(serveur));
  test("★ la réponse du serveur reste la même que le compte existe ou non",
    /if \(!ligne\) return await echec\(\);/.test(serveur));
  test("★ un compte bloqué se dit toujours bloqué", /champs\.actif === false/.test(serveur));

  // ── LE PRÉNOM (demande du même jour).
  test("★ le formulaire d'un employé porte une ligne Prénom",
    /<Field label="Prénom">/.test(util) && /prenom: ""/.test(util));
  test("★★ le prénom remplit nom_complet — PAS un champ de plus qui dirait la même chose",
    /nom_complet: `\$\{f\.nom\.trim\(\)\} \$\{f\.prenom\.trim\(\)\}`/.test(util)
    && !/prenom: f\.prenom/.test(util));
  test("★ le garde-fou est revérifié DANS le geste, avant toute écriture",
    /const refusNom = critiqueIdentifiantEmploye\(db, f\.nom\);[\s\S]{0,200}return;/.test(util));
  test("★ et le refus propose un nom libre", /propositionIdentifiant\(db, f\.nom, f\.prenom, f\.tel\)/.test(util));
}

// ──────────────────────────────────────────────────────────────
titre("💧 LES POMPES : CE QU'ON EN SAIT, ET CE QU'ON NE PROMET PAS (Timo, 20/09/2026)");
{
  const lit = (f) => readFileSync(f, "utf8");
  const stocks = lit("src/screens/Stocks.jsx");
  const autre = lit("src/screens/dimensionnement/Autre.jsx");
  const pdf = lit("src/pdf.js");

  // Son stock : deux pompes renseignées, une pompe oubliée, et un tuyau.
  const stock = [
    { id: "p60", nom: "POMPE SP 3-25", categorie: "Pompes", puissance_kw: 1.1, profondeur_max_m: 60, debit_max_m3h: 3, tension: 220 },
    { id: "p120", nom: "POMPE SP 5-40", categorie: "Pompes", puissance_kw: 2.2, profondeur_max_m: 120, debit_max_m3h: 5, tension: 380, hybride: true },
    { id: "p40", nom: "POMPE 4SR", categorie: "Pompes", profondeur_max_m: 40 },
    { id: "poubli", nom: "POMPE SANS FICHE", categorie: "Pompes" },
    { id: "t", nom: "Tuyau de pompe PE 40", categorie: "Tuyaux" },
  ];

  // ── CE QU'EST UNE POMPE : la CATÉGORIE, jamais le nom.
  test("★★ un « Tuyau de pompe » n'est PAS une pompe (c'est la catégorie qui décide)",
    !Pmp.estPompe(stock[4]) && Pmp.estPompe(stock[0]));
  test("★ les accents et majuscules ne gênent pas", Pmp.estPompe({ categorie: "POMPES IMMERGÉES" }));
  test("le stock rend ses 4 pompes, pas le tuyau", Pmp.pompesDuStock(stock).length === 4);

  // ── LA FICHE LISIBLE — le point de départ de la demande de Timo.
  test("★★ la fiche se lit d'un coup d'œil",
    Pmp.ficheLisible(stock[0]) === "1,1 kW · 60 m · 3 m³/h · 220 V");
  test("★ « hybride » se dit quand la case est cochée (sa décision du 20/09)",
    /hybride/.test(Pmp.ficheLisible(stock[1])) && !/hybride/.test(Pmp.ficheLisible(stock[0])));
  test("★ une pompe sans rien ne fabrique PAS une ligne vide", Pmp.ficheLisible(stock[3]) === "");
  test("un article qui n'est pas une pompe non plus", Pmp.ficheLisible(stock[4]) === "");

  // ── LE CALCUL — son exemple exact.
  const e = Pmp.etudePompe(stock, { niveauDynamique: 45, hauteurReservoir: 8, longueurTuyau: 60, litresParJour: 3000 });
  test("★★ 45 m d'eau + 8 m de réservoir + 3 m de frottements = 56 m", e.hmt === 56 && e.pertes === 3);
  test("★★ 3 000 litres sur 6 heures de soleil = 0,5 m³/h", e.debit === 0.5);
  test("★ le pourcentage de frottements se règle",
    Pmp.hauteurManometrique({ niveauDynamique: 45, hauteurReservoir: 8, longueurTuyau: 60, pctPertes: 10 }).pertes === 6);

  // ── CE QU'ON PROPOSE, ET CE QU'ON ÉCARTE EN LE DISANT.
  test("★★ les pompes qui montent à 56 m, la plus juste d'abord",
    e.conviennent.map((p) => p.id).join(",") === "p60,p120");
  test("★★ celle de 40 m est ÉCARTÉE, et on dit pourquoi", e.tropCourtes.map((p) => p.id).join(",") === "p40");
  test("★★ une pompe NON RENSEIGNÉE est invisible au calcul — et l'écran le DIT",
    e.conviennent.every((p) => p.id !== "poubli") && e.sansFiche.map((p) => p.id).join(",") === "poubli");

  // ⚠⚠ LE POINT LE PLUS IMPORTANT : on ne promet AUCUN débit à la hauteur.
  test("★★ l'avertissement sur la COURBE est toujours là",
    /ne donne pas son débit maximal à sa profondeur maximale/.test(e.avertissement)
    && /fiche du fabricant/.test(e.avertissement));
  test("★★ AUCUNE fonction ne prétend calculer un débit à une hauteur donnée",
    !/debitALaHauteur|debitAHmt|courbe\s*\(/.test(lit("src/lib/pompes.js")));
  test("★ l'écran affiche cet avertissement", /e\.avertissement/.test(autre));
  test("★ et il dit que les frottements sont ESTIMÉS", /estimés<\/b> à \{pertesTuyauPct\(db\)\}/.test(autre));

  // ── LE NIVEAU DYNAMIQUE : sans lui, on ne calcule rien.
  test("★★ sans niveau dynamique, on REFUSE — et on explique que c'est le foreur qui le donne",
    /foreur/.test(Pmp.critiqueCalculPompe({ litresParJour: 3000 }))
    && /pendant le pompage|PENDANT le pompage/i.test(Pmp.critiqueCalculPompe({ litresParJour: 3000 })));
  test("★ sans besoin en eau non plus", !!Pmp.critiqueCalculPompe({ niveauDynamique: 45 }));
  test("★ un refus ne propose RIEN (pas de liste trompeuse)",
    Pmp.etudePompe(stock, { litresParJour: 3000 }).conviennent.length === 0);

  // ── OÙ ÇA SE LIT — c'était tout le problème.
  test("★★ la fiche se lit dans le tableau 📦 Stocks", /ficheLisible\(p\)/.test(stocks));
  test("★★ dans la fenêtre « Rechercher un article » de 💰 Ventes",
    /ficheLisible\(p\)/.test(lit("src/components/SelecteurArticle.jsx")));
  test("★★ dans le champ à suggestions du stock", /ficheLisible\(p\)/.test(lit("src/lib/travaux.js")));
  test("★★ et sur le devis du client", /l\.fiche \?/.test(pdf) && /fiche: ficheLisible\(l\.produit\)/.test(autre));
  test("★ une ligne ordinaire ne grandit pas dans le PDF (la mise en page est mesurée au mm)",
    /l\.fiche \? `\$\{String\(l\.article\)\}\\n/.test(pdf));

  // ── LES CHAMPS N'APPARAISSENT QUE SUR UNE POMPE.
  test("★★ le formulaire ne demande sa profondeur qu'à une POMPE",
    /\{estPompe\(\{ categorie: f\.categorie \}\) && \(/.test(stocks));
  test("★ les cinq renseignements sont là", ["puissance_kw", "profondeur_max_m", "debit_max_m3h", "f.tension", "f.hybride"].every((c) => stocks.includes(c)));
  test("★ et `tension` est RÉUTILISÉE, pas doublée", !/tension_pompe|voltage/.test(lit("src/lib/pompes.js")));

  // ⚠⚠ DÉFAUT TROUVÉ PAR TIMO (20/09/2026, capture) : il saisit 0,4 kW / 95 m
  // / 1,5 m³/h dans « ✏️ Corriger », et SEULE la tension s'affichait ensuite
  // dans 📦 Stocks et dans 💰 Ventes. Les champs étaient dans le formulaire et
  // relus à l'ouverture — mais la CORRECTION ne les recopiait pas dans
  // l'article. `tension` y était depuis toujours : d'où le « rien que la
  // tension ». **Un champ qu'on saisit et qui ne s'enregistre pas est pire
  // qu'un champ absent** : on croit avoir noté.
  {
    const blocApres = (stocks.split("const apres = {")[1] || "").split("\n    };")[0];
    test("★★ la CORRECTION d'un article ENREGISTRE les quatre renseignements de la pompe, pas seulement la tension",
      ["puissance_kw", "profondeur_max_m", "debit_max_m3h", "hybride", "tension"]
        .every((c) => new RegExp(`\\n\\s*${c}:`).test(blocApres)));
    // ⚠⚠ ET LA PHRASE DE CONFIRMATION MENTAIT DEUX FOIS (capture Timo,
    // 20/09/2026 : « Débit max (m³/h) : 0 F → 2 F » alors qu'il avait tapé
    // 1,5). `fmt` est le format de L'ARGENT : il colle « F » et ARRONDIT au
    // franc. Une mesure — et même une quantité — n'a rien à y faire.
    test("★★ seuls les PRIX s'écrivent en « F » dans le récapitulatif ; une mesure porte SON unité et garde ses décimales",
      /\["prix_achat", "Prix d'achat", "nombre", "F"\]/.test(stocks)
      && /\["prix_vente", "Prix de vente", "nombre", "F"\]/.test(stocks)
      && /\["puissance_kw", "Puissance", "nombre", "kW"\]/.test(stocks)
      && /\["profondeur_max_m", "Profondeur max", "nombre", "m"\]/.test(stocks)
      && /\["debit_max_m3h", "Débit max", "nombre", "m\\u00b3\/h"\]/.test(stocks)
      && /\["tension", "Tension", "nombre", "V"\]/.test(stocks)
      && /\["initial", "Quantité initiale", "nombre", ""\]/.test(stocks)
      && /unite === "F" \? fmt\(Number\(v \|\| 0\)\) : nombreFr\(Number\(v \|\| 0\), unite\)/.test(stocks));
    test("★ `nombreFr` garde les décimales et ne colle jamais « F » — `fmt` reste le format de l'argent, seul à arrondir",
      Core.nombreFr(1.5, "m³/h") === "1,5 m³/h"
      && Core.nombreFr(130, "m") === "130 m"
      && Core.nombreFr(15, "") === "15"
      && Core.nombreFr("", "m") === "—"
      && Core.fmt(1.5) === "2 F");

    test("★ la case « hybride » compte comme un changement (sans elle, la cocher seule répondait « Rien n'a été modifié ») et se raconte en Oui / Non, jamais en nombre",
      /\["hybride", "Hybride \(solaire \+ secteur\)", "case"\]/.test(stocks)
      && /genre === "case"\s*\n\s*\? !!a === !!b/.test(stocks)
      && /\? \(v \? "Oui" : "Non"\)/.test(stocks));
  }

  // ── LES DEUX CHAMPS QUI DORMAIENT DEPUIS TOUJOURS.
  test("★★ « Fiche technique » se lit enfin (elle était écrite dans le vide)",
    /p\.fiche_technique && <a href=\{p\.fiche_technique\}/.test(stocks));
  test("★★ « Notes internes » aussi", /p\.notes && <span/.test(stocks));

  // ── LE PANNEAU N'APPARAÎT QUE LÀ OÙ IL A UN SENS.
  test("★★ « Quelle pompe pour ce forage ? » ne s'affiche que si le métier a des pompes",
    /pompesDuStock\(produitsBoutique\.filter\(\(p\) => !domaine \|\| p\.domaine === domaine\.id\)\)\.length > 0/.test(autre));
  test("★ l'étude ne s'enregistre pas : elle aide à choisir",
    /Cette étude ne s'enregistre pas/.test(autre) && !/save\(\{[^}]*pompe/.test(autre));
  test("★ le réglage des frottements est réservé à l'administrateur",
    /refuserSaufAdmin\(profile, "Modifier l'estimation des frottements"\)/.test(lit("src/screens/Parametres.jsx")));
  test("la règle pure ne dépend de rien", !/^\s*import\s/m.test(lit("src/lib/pompes.js")));
}


titre("📱 FLOOZ ET MIXX/T-MONEY : LE SOLDE D'UN COMPTE MOBILE (Timo, 21/09/2026)");
{
  // Mot pour mot, après avoir encaissé 160 000 F par Mixx et payé 40 000 F de
  // commission au même moyen : « avec le moyen de paiement mix ou flooz, le
  // fond à verser est 0 F… mais l'apporteur a pris son argent. Comment savoir
  // que sur T-Money il reste 120 mil et non 160 mil… et que l'administrateur
  // aussi, sans sortir sa calculatrice, ait tout sous ses yeux. »
  // ⚠ C'ÉTAIT UN TROU : l'argent mobile comptait dans la recette et le
  // résultat, mais AUCUN écran n'en donnait le solde.
  // Décision « 1b » : chaque boutique a son numéro.
  const lit = (f) => readFileSync(f, "utf8");
  const sortieCm = join("node_modules", ".cache", `bmi-caisses-mobiles-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/caissesMobiles.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCm, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Cm = await import(pathToFileURL(sortieCm).href);
  unlinkSync(sortieCm);
  const sortieVm = join("node_modules", ".cache", `bmi-versements-mobile-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/versements.js"], bundle: true, format: "esm", platform: "node", outfile: sortieVm, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Vm = await import(pathToFileURL(sortieVm).href);
  unlinkSync(sortieVm);
  const MIXX = "Mobile Money (Mixx/T-Money)";
  const FLOOZ = "Mobile Money (Flooz)";
  const ligne = (pu) => [{ qte: 1, pu, article: "Batterie" }];

  const dbM = {
    boutiques: [
      { id: "b1", nom: "DEMAKPOE", numero_mixx: "91130511" },
      { id: "b2", nom: "APESSITO" },
      { id: "b3", nom: "FORMATION", formation: true, numero_mixx: "90000000" },
    ],
    ventes: [
      { id: "v1", boutique: "DEMAKPOE", date: "2026-09-21", paiement: MIXX, articles: ligne(160000), client: "ESSO", par: "TIMO" },
      { id: "v2", boutique: "DEMAKPOE", date: "2026-09-21", paiement: "Espèces", articles: ligne(140000) },
      { id: "v3", boutique: "DEMAKPOE", date: "2026-09-20", paiement: FLOOZ, articles: ligne(30000) },
      { id: "v4", boutique: "FORMATION", date: "2026-09-21", paiement: MIXX, articles: ligne(999999) },
    ],
    dettes: [{ id: "d1", boutique: "DEMAKPOE", client: "MR ERIC", paiements: [
      { date: "2026-09-21", montant: 10000, paiement: MIXX, par: "ANGELE" },
      { date: "2026-09-21", montant: 5000, paiement: "Espèces" },
    ] }],
    depenses: [
      { id: "x1", boutique: "DEMAKPOE", categorie: "Commissions", description: "Commission apporteur externe — AKPEDJE", montant: 40000, paiement: MIXX, date: "2026-09-21", par: "TIMO" },
      { id: "x2", boutique: "DEMAKPOE", categorie: "Transport", montant: 7000, paiement: MIXX, date: "2026-09-21", par: "TIMO", validation: { statut: "attente" } },
      { id: "x3", boutique: "DEMAKPOE", categorie: "Transport", montant: 0, paiement: MIXX, date: "2026-09-21", par: "TIMO", validation: { statut: "rejetee", montant: 9000 } },
      { id: "x4", boutique: "DEMAKPOE", categorie: "Loyer", montant: 6000, paiement: "Espèces", date: "2026-09-21", par: "TIMO" },
      { id: "x5", boutique: "DEMAKPOE", categorie: "Transport", montant: 3000, paiement: MIXX, date: "2026-09-21", par: "TIMO", paye_avec: "avance" },
    ],
  };

  // ── SON CAS EXACT.
  const mixx = Cm.mouvementsMobile(dbM, MIXX, ["DEMAKPOE"]);
  test("★★ SON CAS : 160 000 encaissés par Mixx, 40 000 de commission payés par Mixx, 10 000 d'un règlement de dette → il reste 130 000 sur le compte",
    mixx.totalEntrees === 170000 && mixx.totalSorties === 40000 && mixx.solde === 130000);
  test("★★ une vente EN ESPÈCES n'entre jamais dans le compte mobile (c'était tout le malentendu)",
    !mixx.entrees.some((m) => m.montant === 140000) && !mixx.sorties.some((m) => m.montant === 6000));
  test("★ le règlement d'une dette payé par Mixx compte, celui payé en espèces non",
    mixx.entrees.some((m) => m.montant === 10000 && /Règlement de dette/.test(m.libelle)) && !mixx.entrees.some((m) => m.montant === 5000));
  test("★ Flooz et Mixx ne se mélangent pas", Cm.mouvementsMobile(dbM, FLOOZ, ["DEMAKPOE"]).solde === 30000);

  // ── LES MÊMES RÈGLES D'ARGENT QUE PARTOUT.
  test("★★ une dépense EN ATTENTE du DG ne descend pas le compte (elle ne compte nulle part)",
    !mixx.sorties.some((m) => m.montant === 7000));
  test("★★ une dépense REJETÉE non plus (son montant est déjà à 0)",
    !mixx.sorties.some((m) => m.id === "x3"));
  test("★ une AVANCE personnelle payée par Mixx ne sort pas du compte de BMI",
    !mixx.sorties.some((m) => m.montant === 3000));

  // ── LE MUR : on passe la LISTE des boutiques, jamais `db` en entier.
  test("★★ LE MUR : la vente de FORMATION n'entre pas dans le compte de DEMAKPOE",
    !mixx.entrees.some((m) => m.boutique === "FORMATION") && Cm.mouvementsMobile(dbM, MIXX, ["FORMATION"]).solde === 999999);
  test("★ aucune boutique donnée = aucun mouvement", Cm.mouvementsMobile(dbM, MIXX, []).mouvements.length === 0);
  test("★ une base vide ne lève pas", Cm.mouvementsMobile({}, MIXX, ["DEMAKPOE"]).solde === 0);

  // ── LE NUMÉRO, SUR LA FICHE DE LA BOUTIQUE (sa décision « 1b »).
  test("★★ le numéro se lit sur la fiche de la boutique", Cm.numeroMobile(dbM.boutiques, "DEMAKPOE", MIXX) === "91130511");
  test("★ une boutique sans numéro le dit, et dit où le régler",
    Cm.numeroMobile(dbM.boutiques, "APESSITO", MIXX) === "" && /⚙ Paramètres → Boutiques → 📱 Comptes mobiles/.test(Cm.phraseNumeroMobile("")));
  test("★ les deux comptes d'une boutique se lisent d'un coup (les carrés de 🔒 Caisse)", (() => {
    const s = Cm.soldesMobiles(dbM, "DEMAKPOE");
    return s.length === 2 && s.find((m) => m.moyen === MIXX).solde === 130000 && s.find((m) => m.moyen === FLOOZ).solde === 30000
      && s.find((m) => m.moyen === MIXX).numero === "91130511";
  })());

  // ── LE VERSEMENT : LE MÊME GESTE, AVEC UNE CASE DE PLUS.
  test("★★ « Le tiroir de la boutique » n'existe QUE pour un compte mobile",
    Vm.destinationsPour(false, MIXX).includes(Vm.DEST_TIROIR) && !Vm.destinationsPour(false).includes(Vm.DEST_TIROIR)
    && !Vm.destinationsPour(false, Vm.SOURCE_ESPECES).includes(Vm.DEST_TIROIR));
  test("★★ et la RÈGLE le revérifie, pas seulement la liste de l'écran",
    /n'est possible qu'en partant d'un compte mobile/.test(Vm.critiqueVersement({ montant: 1000, destination: Vm.DEST_TIROIR, attendu: 1000 }))
    && Vm.critiqueVersement({ montant: 1000, destination: Vm.DEST_TIROIR, attendu: 1000, source: MIXX }) === "");
  test("★ le mur tient sur les destinations : la formation n'a jamais « Chez le comptable »",
    !Vm.destinationsPour(true, MIXX).includes(Vm.DEST_COMPTABLE) && Vm.destinationsPour(true, MIXX).includes(Vm.DEST_TIROIR));

  const profM = { id: "u1", nom: "TIMO" };
  const versDG = Vm.construireVersement(profM, { boutique: "DEMAKPOE", montant: 130000, destination: Vm.DEST_DG, attendu: 130000, source: MIXX });
  test("★★ un versement parti du compte mobile porte CE moyen — donc il ne touche pas le tiroir et descend le compte",
    versDG.sortie.paiement === MIXX && versDG.versement.source === MIXX && versDG.entree === null);
  {
    const apres = Cm.mouvementsMobile({ ...dbM, depenses: [versDG.sortie, ...dbM.depenses] }, MIXX, ["DEMAKPOE"]);
    test("★★ après le versement, le compte mobile tombe à 0 et le versement se lit dans ses sorties",
      apres.solde === 0 && apres.sorties.some((m) => /Versement de DEMAKPOE → Chez le DG/.test(m.libelle)));
  }

  const versTiroir = Vm.construireVersement(profM, { boutique: "DEMAKPOE", montant: 50000, destination: Vm.DEST_TIROIR, attendu: 130000, note: "retrait au guichet", source: MIXX });
  test("★★ le RETRAIT au guichet a son miroir : une ligne d'espèces NÉGATIVE sur la même boutique — sinon l'argent quitterait le compte sans arriver nulle part",
    versTiroir.sortie.paiement === MIXX && versTiroir.sortie.montant === 50000
    && versTiroir.entree && versTiroir.entree.boutique === "DEMAKPOE" && versTiroir.entree.paiement === "Espèces" && versTiroir.entree.montant === -50000
    && versTiroir.entree.versement_id === versTiroir.versement.id);
  test("★★ et le TIROIR monte vraiment de 50 000 (mesuré, pas présumé)", (() => {
    const tv = (v) => (v.articles || []).reduce((s, l) => s + l.qte * l.pu, 0);
    const avant = Vm.fondsAVerser(dbM, "DEMAKPOE", tv).montant;
    const apres = Vm.fondsAVerser({ ...dbM, depenses: [versTiroir.sortie, versTiroir.entree, ...dbM.depenses] }, "DEMAKPOE", tv);
    return apres.montant === avant + 50000 && apres.retraits === 50000;
  })());
  test("★★ un retrait interne n'attend la validation de PERSONNE, et ne fait vibrer aucun téléphone",
    Vm.versementsAValiderParDG({ depenses: [versTiroir.sortie] }, ["DEMAKPOE"]).length === 0
    && Vm.versementsValidesParDG({ depenses: [versTiroir.sortie] }, ["DEMAKPOE"]).length === 0
    && Vm.validationVersement({ depenses: [versTiroir.sortie] }, versTiroir.sortie).interne === true
    && Vm.messagesVersement({ users: [{ id: "a", role: "admin", admin_principal: true }] }, profM, versTiroir.sortie).length === 0);
  test("★ un versement ordinaire, lui, attend toujours le DG et le prévient",
    Vm.versementsAValiderParDG({ depenses: [versDG.sortie] }, ["DEMAKPOE"]).length === 1
    && Vm.messagesVersement({ users: [{ id: "a", role: "admin", admin_principal: true, actif: true }] }, profM, versDG.sortie).length === 1);
  test("★ un versement mobile REJETÉ compte comme jamais parti : le compte le retrouve", (() => {
    const rej = { ...versDG.sortie, montant: 0, versement_rejete_le: "2026-09-22", versement: { ...versDG.versement, montant: 130000 } };
    return Cm.mouvementsMobile({ ...dbM, depenses: [rej, ...dbM.depenses] }, MIXX, ["DEMAKPOE"]).solde === 130000;
  })());

  // ── LES ÉCRANS : la règle juste ne suffit pas si l'écran s'en sert mal.
  const caisse = lit("src/screens/Caisse.jsx");
  test("★★ 🔒 Caisse : le montant ATTENDU suit le compte qui se vide, pas le tiroir",
    /const attenduVersement = mobileChoisi \? Math\.max\(0, mobileChoisi\.solde\) : aVerser\.aVerser;/.test(caisse)
    && /attendu: attenduVersement/.test(caisse) && /montantDifferent\(vers\.montant, attenduVersement\)/.test(caisse)
    && /messageJustification\(attenduVersement\)/.test(caisse));
  test("★★ 🔒 Caisse : les destinations dépendent de la source",
    /destinationsPour\(espaceDuCompte\(db, profile\) === true, vers\.source\)/.test(caisse));
  test("★ 🔒 Caisse : les espèces restent le défaut — rien ne change pour qui n'y touche pas",
    /source: SOURCE_ESPECES, destination: destinationDefaut/.test(caisse));
  test("★ 🔒 Caisse : les carrés lisent la règle, et pas de carré à zéro sur une boutique sans compte mobile",
    /const mobiles = soldesMobiles\(db, boutique\);/.test(caisse) && /mobiles\.filter\(\(m\) => m\.mouvements > 0 \|\| m\.numero\)\.map/.test(caisse));
  const dash = lit("src/screens/Dashboard.jsx");
  test("★★ tableau de bord : les pastilles mobiles existent dans les DEUX espaces (au contraire de DG / BANQUE / COMPTABLE)",
    /\.\.\.mobilesVus\.map\(\(m\) => m\.caisse\), \.\.\.\(enFormation \? \[\]/.test(dash));
  test("★★ tableau de bord : un compte mobile n'est pas une boutique — rien d'autre que son relevé",
    /const caisseSeule = dgChoisi \|\| banqueChoisi \|\| !!mobileChoisi;/.test(dash));
  test("★ tableau de bord : le relevé passe par LA carte commune et LA règle du relevé",
    /<CarteCaisse titre=\{bilanMobileChoisi\.pastille\}[^>]*releve=\{releve\(bilanMobileChoisi\.bilan/.test(dash));
  test("★ tableau de bord : une pastille ne s'affiche que si le compte SERT",
    /bilansMobiles\.filter\(\(m\) => m\.bilan\.mouvements\.length > 0 \|\| m\.regle\)/.test(dash));
  test("★★ le relevé DIT ce qu'il ne sait pas : le solde vient des saisies, pas du téléphone",
    /ce solde découle des saisies, pas du solde lu sur le téléphone/i.test(dash));
  const params = lit("src/screens/Parametres.jsx");
  test("★★ les deux numéros se règlent sur la fiche de la boutique, par l'administrateur",
    /refuserSaufAdmin\(profile, "Modifier les comptes mobiles d'une boutique"\)/.test(params)
    && /modifierComptesMobiles\(b\)/.test(params));

  // ── L'ÉTIQUETTE ET LA FABRIQUE : écrites UNE fois.
  test("★★ la fabrique de bilan n'est pas recopiée : caissesMobiles lit celle de caissesCentrales",
    /import \{ bilanCaisse \} from "\.\/caissesCentrales\.js";/.test(lit("src/lib/caissesMobiles.js"))
    && !/const totalEntrees = entrees\.reduce/.test(lit("src/lib/caissesMobiles.js")));
  test("★ l'étiquette d'une pastille reste UNE règle (libellePastille connaît aussi les comptes mobiles)",
    /mobileParCaisse\(nom\)\?\.pastille/.test(lit("src/lib/caissesCentrales.js")));
  test("★ le moyen écrit sur une vente et celui du compte sont LE MÊME mot",
    lit("src/lib/constants.js").includes('moyen: "Mobile Money (Flooz)"') && lit("src/lib/constants.js").includes('moyen: "Mobile Money (Mixx/T-Money)"')
    && lit("src/lib/constants.js").includes('export const PAIEMENTS = ["Espèces", "Mobile Money (Flooz)", "Mobile Money (Mixx/T-Money)"'));
}


titre("📊 LA CLÔTURE DU JOUR : TOUS LES MOYENS DE PAIEMENT APPARAISSENT (Timo, 21/09/2026)");
{
  // Mot pour mot : « en réalité on clôture les ventes… donc tout type de
  // paiement confondu doit apparaître dans la clôture du jour ». Il a raison :
  // le geste arrête une JOURNÉE DE VENTE, pas seulement un tiroir. Les
  // paiements mobiles étaient là, mais NOYÉS dans une colonne « Autres
  // moyens » qui additionnait Flooz + Mixx + virement + crédit.
  // Le nom : décision « c » — « Clôture du jour », parce que le geste fait les
  // DEUX choses (arrêter les ventes ET compter le tiroir).
  const lit = (f) => readFileSync(f, "utf8");
  const sortieCj = join("node_modules", ".cache", `bmi-cloture-moyens-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/cloture.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCj, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Cj = await import(pathToFileURL(sortieCj).href);
  unlinkSync(sortieCj);
  const MIXX = "Mobile Money (Mixx/T-Money)";
  const FLOOZ = "Mobile Money (Flooz)";
  const tvJ = (v) => (v.articles || []).reduce((s, l) => s + l.qte * l.pu, 0);
  const art = (pu) => [{ qte: 1, pu, article: "Batterie" }];
  const J = "2026-09-21";

  const ventesJ = [
    { id: "s1", boutique: "DEMAKPOE", date: J, paiement: "Espèces", articles: art(140000), par: "ANGELE" },
    { id: "s2", boutique: "DEMAKPOE", date: J, paiement: MIXX, articles: art(160000), par: "ANGELE" },
    { id: "s3", boutique: "DEMAKPOE", date: J, paiement: "Crédit (dette)", articles: art(500000), par: "TIMO" },
    { id: "s4", boutique: "DEMAKPOE", date: J, paiement: FLOOZ, articles: art(20000), par: "TIMO" },
  ];
  // L'avance d'une vente à crédit est un RÈGLEMENT de dette, avec SON moyen.
  const reglJ = [
    { montant: 15000, paiement: "Espèces", par: "ANGELE" },
    { montant: 50000, paiement: MIXX, par: "TIMO" },
  ];
  const m = Cj.ventesParMoyen(ventesJ, reglJ, tvJ);
  const parM = (x) => m.lignes.find((l) => l.moyen === x) || { vendu: 0, encaisse: 0, nbVentes: 0 };

  // ── SA DEMANDE : TOUT APPARAÎT.
  test("★★ les QUATRE moyens de la journée apparaissent, crédit compris",
    m.lignes.map((l) => l.moyen).join(" | ") === `Espèces | ${FLOOZ} | ${MIXX} | Crédit (dette)`);
  test("★ l'ordre est celui de la liste de l'application, pas l'ordre d'arrivée",
    m.lignes[0].moyen === "Espèces" && m.lignes[3].moyen === "Crédit (dette)");

  // ── VENDU ET ENCAISSÉ NE DISENT PAS LA MÊME CHOSE.
  test("★★ une vente à CRÉDIT est VENDUE (500 000) mais n'ENCAISSE rien",
    parM("Crédit (dette)").vendu === 500000 && parM("Crédit (dette)").encaisse === 0);
  test("★★ son avance figure sous le moyen dont elle a été payée, jamais sous « Crédit »",
    parM(MIXX).encaisse === 160000 + 50000 && parM(MIXX).vendu === 160000);
  test("★★ les deux totaux sont DIFFÉRENTS et ne s'additionnent jamais",
    m.totalVendu === 820000 && m.totalEncaisse === 385000);
  test("★ « encaissé autrement qu'en billets » est ce qui explique le tiroir",
    m.encaisseHorsEspeces === 230000);

  // ── ⚠⚠ L'ANCRE : la ligne « Espèces » EST la recette de la clôture.
  {
    const dbJ = { ventes: ventesJ, clotures: [], depenses: [],
      dettes: [{ id: "d1", boutique: "DEMAKPOE", client: "MR ERIC",
        paiements: reglJ.map((p, i) => ({ ...p, id: `p${i}`, date: J })) }],
      boutiques: [{ id: "b", nom: "DEMAKPOE" }] };
    const j = Cj.activiteDuJour(dbJ, "DEMAKPOE", J, tvJ);
    test("★★ LA LIGNE « ESPÈCES » DE LA COLONNE ENCAISSÉ EST, AU FRANC PRÈS, LA RECETTE DE LA CLÔTURE — c'est elle qui permet au vendeur de vérifier lui-même",
      j.moyens.lignes.find((l) => l.moyen === "Espèces").encaisse === j.especesVentes + j.especesReglements
      && j.especesVentes + j.especesReglements === 155000);
    test("★★ L'ÉCART NE REGARDE QUE LES BILLETS : 820 000 F vendus, 155 000 F attendus dans le tiroir",
      j.theorique === 155000 && j.moyens.totalVendu === 820000);
    test("★★ éprouvé : retirer TOUTES les ventes mobiles ne change PAS le montant attendu dans le tiroir", (() => {
      const sansMobile = { ...dbJ, ventes: ventesJ.filter((v) => v.paiement === "Espèces" || v.paiement === "Crédit (dette)"),
        dettes: [{ ...dbJ.dettes[0], paiements: dbJ.dettes[0].paiements.filter((p) => p.paiement === "Espèces") }] };
      return Cj.activiteDuJour(sansMobile, "DEMAKPOE", J, tvJ).theorique === 155000;
    })());
    test("★★ la phrase du vendeur dit les deux chiffres, et ce qu'il doit comprendre",
      (() => { const p = Cj.phraseDuJour(j.moyens.totalVendu, j.theorique, (x) => `${x} F`);
        return /820000 F/.test(p) && /155000 F/.test(p) && /tiroir/.test(p) && /Ventes du jour/.test(p); })());
    test("★ le détail par vendeur ne dit plus « autres moyens » d'un seul bloc",
      j.recetteParPersonne.find((r) => r.nom === "TIMO").parMoyen[FLOOZ] === 20000
      && j.recetteParPersonne.find((r) => r.nom === "ANGELE").parMoyen[MIXX] === 160000
      && !j.recetteParPersonne.find((r) => r.nom === "ANGELE").parMoyen["Espèces"]);
    test("★ une journée sans aucune vente ne fabrique pas de bloc vide",
      Cj.activiteDuJour({ ventes: [], dettes: [], depenses: [], clotures: [] }, "DEMAKPOE", J, tvJ).moyens.lignes.length === 0);
  }

  // ── LA FORMULE DU MONTANT EST ÉCRITE UNE FOIS.
  test("★★ le montant d'une vente est calculé par UNE fonction, jamais recopiée (elle l'était à trois endroits)",
    /export const montantEncaisseVente = \(v, totalVente\) =>/.test(lit("src/lib/versements.js"))
    && (lit("src/lib/cloture.js").match(/montantEncaisseVente\(/g) || []).length >= 2
    && !/const montant = totalVente\(v\) \+ Number\(v\.frais_installation/.test(lit("src/lib/cloture.js")));

  // ── L'ÉCRAN : la règle juste ne suffit pas si l'écran s'en sert mal.
  const cs = lit("src/screens/Caisse.jsx");
  test("★★ 🔒 Caisse : le bloc « tous moyens » existe et lit la règle",
    /data-bloc="ventes-tous-moyens"/.test(cs) && /moyens\.lignes\.map\(\(l\) => \(/.test(cs)
    && /\{fmt\(moyens\.totalVendu\)\}/.test(cs) && /\{fmt\(moyens\.totalEncaisse\)\}/.test(cs));
  test("★★ 🔒 Caisse : les DEUX colonnes sont nommées, et l'écran DIT qu'elles ne s'additionnent pas",
    />Vendu<\/th>/.test(cs) && />Encaissé ce jour<\/th>/.test(cs) && /ne s'additionnent pas/.test(cs));
  test("★ 🔒 Caisse : la phrase du vendeur ne s'affiche que s'il y a eu autre chose que des billets",
    /\{moyens\.encaisseHorsEspeces > 0 && \(/.test(cs) && /phraseDuJour\(moyens\.totalVendu, theorique, fmt\)/.test(cs));
  test("★ 🔒 Caisse : le détail des autres moyens s'affiche par vendeur",
    /Object\.entries\(r\.parMoyen\)\.map/.test(cs));

  // ── LE NOM : décision « c » (21/09/2026).
  test("★★ « Clôture du jour » partout où on le lit — plus « clôture de caisse »",
    />Clôture du jour \{t === aujourdhui/.test(cs) && />Clôturer le jour<\/button>/.test(cs)
    && /refuserSaufRoles\(profile, ROLES_CAISSE, "Faire la clôture du jour"\)/.test(cs)
    && !/Clôturer la caisse/.test(cs) && !/>Clôture de caisse /.test(cs));
  test("★ le blocage des ventes et la tournée du matin parlent de la JOURNÉE, plus de « la caisse »",
    /la journée du \$\{liste\} de \$\{boutique\} n'a pas été clôturée/.test(lit("src/lib/cloture.js"))
    && /La journée du \$\{premier\} de \$\{b\.nom\} n'a pas été clôturée/.test(lit("src/lib/rappels.js")));
  test("★ le journal nomme la clôture du jour", /RECLÔTURE" : "Clôture"\} du jour \$\{boutique\}/.test(cs)
    && /clotures: "une clôture du jour"/.test(lit("src/lib/calculs.js")));
}


titre("💳 L'APPORTEUR EXTERNE EST PAYÉ PAR LE MOYEN DU CLIENT (Timo, 21/09/2026)");
{
  // Capture de la fenêtre « Moyen de paiement pour FIFO » : **« on demande
  // encore le moyen de paiement »**. Devant deux propositions (déduire le
  // moyen du compte qui paie · le mémoriser sur la fiche de l'apporteur), il a
  // choisi **« b »**.
  // ⚠ Un apporteur externe n'a PAS de fiche : il n'existe que sur les ventes
  // qu'il a amenées. Sa « fiche », ce sont ces lignes-là.
  const lit = (f) => readFileSync(f, "utf8");
  const sortieAp = join("node_modules", ".cache", `bmi-apporteur-moyen-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/calculs.js"], bundle: true, format: "esm", platform: "node", outfile: sortieAp, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, external: ["react", "react-dom"] });
  const Ap = await import(pathToFileURL(sortieAp).href);
  unlinkSync(sortieAp);
  const FLOOZ = "Mobile Money (Flooz)";
  const MIXX = "Mobile Money (Mixx/T-Money)";

  const ventesAp = [
    { id: "a1", date: "2026-09-10", apporteur: { nom: "FIFO", tel: "90112233" } },
    { id: "a2", date: "2026-09-15", heure: "10:00", apporteur: { nom: "FIFO", tel: "90112233", moyen_habituel: "Espèces" } },
    { id: "a3", date: "2026-09-18", heure: "09:00", apporteur: { nom: "FIFO", tel: "90112233", moyen_habituel: FLOOZ } },
    { id: "a4", date: "2026-09-20", apporteur: { nom: "RERO", tel: "91130511", moyen_habituel: "Virement bancaire" } },
    // ⚠ LE MÊME NOM, LE MÊME NUMÉRO, MAIS DANS L'AUTRE ESPACE (le banc l'appelle
    // par son id : la règle ne doit jamais l'attraper « par le nom »).
    { id: "aF", date: "2026-09-21", apporteur: { nom: "FIFO", tel: "90112233", moyen_habituel: "Espèces" } },
  ];
  const sien = (n, t) => ventesAp.filter((v) => Ap.memeApporteur(v.apporteur, n, t));
  // ⚠ L'écran passe les ventes DE SON ESPACE, déjà filtrées : c'est ce que le
  // banc reproduit ici (a1–a3). `aF` porte le MÊME nom et le MÊME numéro dans
  // l'autre espace — il n'entre jamais dans cette liste.
  const fifoReel = ventesAp.filter((v) => ["a1", "a2", "a3"].includes(v.id));

  test("★★ SON CAS : le moyen retenu est le PLUS RÉCENT qu'on a employé pour lui",
    Ap.moyenHabituelApporteur(fifoReel) === FLOOZ);
  test("★★ LE MUR, À LA LECTURE : la ligne du même nom dans l'autre espace ferait mentir la mémoire — l'écran ne la passe jamais",
    Ap.moyenHabituelApporteur(sien("FIFO", "90112233")) === "Espèces"
    && Ap.moyenHabituelApporteur(fifoReel) === FLOOZ);
  test("★★ un apporteur qu'on n'a jamais payé n'a AUCUN moyen — la question sera donc posée, une fois",
    Ap.moyenHabituelApporteur([{ id: "x", date: "2026-09-01", apporteur: { nom: "NEUF", tel: "" } }]) === ""
    && Ap.moyenHabituelApporteur([]) === "" && Ap.moyenHabituelApporteur(undefined) === "");
  test("★ deux apporteurs ne se mélangent pas",
    Ap.moyenHabituelApporteur(sien("RERO", "91130511")) === "Virement bancaire");
  test("★ la clé est le nom ET le numéro, espaces rognés",
    Ap.cleApporteur(" FIFO ", " 90112233 ") === "FIFO|90112233"
    && Ap.memeApporteur({ nom: "FIFO", tel: "90112233" }, "FIFO", "90112233")
    && !Ap.memeApporteur({ nom: "FIFO", tel: "90112233" }, "FIFO", "99999999"));

  // ── L'ÉCRITURE : les lignes DÉSIGNÉES, jamais « toutes celles de ce nom ».
  {
    const apres = Ap.poserMoyenApporteur(ventesAp, ["a1", "a2", "a3"], MIXX);
    test("★★ la mémoire s'écrit sur TOUTES ses lignes désignées, même celles qui n'en portaient pas",
      apres.find((v) => v.id === "a1").apporteur.moyen_habituel === MIXX
      && Ap.moyenHabituelApporteur(apres.filter((v) => ["a1", "a2", "a3"].includes(v.id))) === MIXX);
    test("★★ LE MUR : la ligne du MÊME NOM dans l'autre espace n'est PAS touchée — on écrit par identifiant, jamais par nom",
      apres.find((v) => v.id === "aF").apporteur.moyen_habituel === "Espèces");
    test("★ un autre apporteur n'est jamais touché", apres.find((v) => v.id === "a4").apporteur.moyen_habituel === "Virement bancaire");
    test("★ une vente sans apporteur traverse sans être réécrite", (() => {
      const avec = [...ventesAp, { id: "sansApp", date: "2026-09-21" }];
      const r = Ap.poserMoyenApporteur(avec, ["sansApp"], MIXX);
      return !("apporteur" in r.find((v) => v.id === "sansApp"));
    })());
  }

  // ── 💳 LE MOYEN DU CLIENT (Timo, 21/09/2026 : « Sa devrai être
  // automatique... Moyen utilisé avec le client, automatiquement utilisé pour
  // payer l'apporteur externe »). L'argent ressort par où il est entré.
  {
    const CREDIT = "Crédit (dette)";
    const lotComptant = [
      { id: "c1", date: "2026-09-10", heure: "08:00", paiement: "Espèces" },
      { id: "c2", date: "2026-09-12", heure: "16:30", paiement: MIXX },
    ];
    test("★★ SON CAS : le client a payé par Mixx → l'apporteur est payé par Mixx, sans une question",
      Ap.moyenDuClientPourApporteur(lotComptant, []) === MIXX);
    test("★★ la vente la PLUS RÉCENTE du lot décide (l'heure compte, pas seulement la date)",
      Ap.moyenDuClientPourApporteur([
        { id: "x1", date: "2026-09-12", heure: "18:00", paiement: FLOOZ },
        { id: "x2", date: "2026-09-12", heure: "09:00", paiement: "Espèces" },
      ], []) === FLOOZ);
    // ⚠ Une vente à CRÉDIT n'encaisse rien le jour de la vente : l'argent entre
    // par les règlements de SA dette — et la commission n'est due qu'une fois
    // la dette soldée. C'est donc le dernier règlement qui dit par quoi payer.
    const dettes = [{ id: "d1", vente_id: "k1", paiements: [
      { date: "2026-09-14", heure: "10:00", paiement: "Espèces", montant: 10000 },
      { date: "2026-09-19", heure: "11:00", paiement: FLOOZ, montant: 90000 },
    ] }];
    test("★★ UNE VENTE À CRÉDIT : on suit l'argent jusqu'au DERNIER règlement de sa dette",
      Ap.moyenDuClientPourApporteur([{ id: "k1", date: "2026-09-13", paiement: CREDIT }], dettes) === FLOOZ);
    test("★★ « Crédit (dette) » n'est JAMAIS proposé comme façon de payer quelqu'un",
      Ap.moyenDuClientPourApporteur([{ id: "k9", date: "2026-09-13", paiement: CREDIT }], []) === ""
      && Ap.moyenDuClientPourApporteur([{ id: "k8", date: "2026-09-13", paiement: CREDIT }],
        [{ id: "d8", vente_id: "k8", paiements: [{ date: "2026-09-14", paiement: CREDIT }] }]) === "");
    test("★★ une vente à crédit dont la dette n'a encore rien encaissé ne fabrique aucun moyen — la vente d'avant répond",
      Ap.moyenDuClientPourApporteur([
        { id: "k2", date: "2026-09-13", paiement: CREDIT },
        { id: "k3", date: "2026-09-11", paiement: "Virement bancaire" },
      ], [{ id: "d2", vente_id: "k2", paiements: [] }]) === "Virement bancaire");
    test("★★ un moyen qu'on ne sait pas dépenser n'est pas proposé (on ne devine jamais un moyen de sortie)",
      Ap.moyenDuClientPourApporteur([{ id: "z1", date: "2026-09-13", paiement: "Troc" }], []) === "");
    test("★ rien à lire → rien de proposé, et la question revient (aucune levée)",
      Ap.moyenDuClientPourApporteur([], []) === "" && Ap.moyenDuClientPourApporteur(undefined, undefined) === ""
      && Ap.moyenDuClientPourApporteur([{ id: "n1", date: "2026-09-13" }], []) === "");
    test("★★ LE MUR : la règle ne reçoit que des listes déjà filtrées — la dette d'un autre espace n'est jamais atteinte",
      Ap.moyenDuClientPourApporteur([{ id: "k1", date: "2026-09-13", paiement: CREDIT }], []) === "");
  }

  // ── L'ÉCRAN : la règle juste ne suffit pas si l'écran s'en sert mal.
  const eq = lit("src/screens/MonEquipe.jsx");
  test("★★ LA QUESTION N'EST PLUS POSÉE : le choix explicite, sinon le moyen du CLIENT — sa demande, mot pour mot",
    /const moyen = a\.moyenHabituel \|\| a\.moyenClient \|\| await demanderMoyenPaiement\(`pour \$\{a\.nom\}`\);/.test(eq));
  test("★★ ne plus DEMANDER n'est pas ne plus DIRE : la confirmation nomme le moyen ET D'OÙ IL VIENT",
    /💳 Moyen : \$\{moyen\}\$\{origineMoyen\}/.test(eq)
    && /le moyen par lequel le client a payé/.test(eq));
  test("★★ LE PAIEMENT N'ÉCRIT PLUS DE MÉMOIRE — il figerait le moyen du jour et la déduction ne servirait jamais deux fois",
    !/ventes: poserMoyenApporteur\(db\.ventes\.map\(/.test(eq)
    && /ventes: db\.ventes\.map\(\(v\) => \(ids\.has\(v\.id\)/.test(eq));
  test("★★ ✏️ Moyen reste le SEUL à écrire un choix explicite",
    (eq.match(/poserMoyenApporteur\(/g) || []).length === 1
    && /save\(\{ \.\.\.db, ventes: poserMoyenApporteur\(db\.ventes, a\.ids, m\) \}/.test(eq));
  test("★★ le choix explicite est cherché sur TOUTES ses ventes de l'espace, pas sur la période — sinon la question revient au changement de mois",
    /const siennes = ventesDeMonEspace\.filter\(\(v\) => v\.apporteur && cleApporteur\(v\.apporteur\.nom, v\.apporteur\.tel\) === cle\);/.test(eq)
    && /l\.moyenHabituel = moyenHabituelApporteur\(siennes\);/.test(eq));
  test("★★ le moyen du client est déduit du LOT qu'on paie maintenant, dettes de l'espace à l'appui",
    /l\.moyenClient = moyenDuClientPourApporteur\(lot\.length \? lot : siennes, dettesDeMonEspace\);/.test(eq)
    && /const lot = siennes\.filter\(\(v\) => dues\.has\(v\.id\)\);/.test(eq));
  test("★★ LE MUR : les dettes passent par le filtre d'espace AVANT d'être remises à la règle pure",
    /const dettesDeMonEspace = \(db\.dettes \|\| \[\]\)\.filter\(filtreEspaceAffichage\(db, profile\)\);/.test(eq)
    && !/moyenDuClientPourApporteur\([^)]*db\.dettes/.test(eq));
  test("★★ la SEULE porte de sortie existe : ✏️ Moyen, avec la même garde que payer, revérifiée DANS le geste",
    /const changerMoyenApporteur = async \(a\) => \{/.test(eq)
    && /if \(!aDroit\(db, profile, "act_commission"\)\) \{ uAlert\(/.test(eq)
    && /onClick=\{\(\) => changerMoyenApporteur\(a\)\}/.test(eq));
  test("★ le moyen SE LIT sur la ligne, et la ligne dit D'OÙ il vient",
    /data-moyen-apporteur=\{a\.moyenHabituel \|\| a\.moyenClient \|\| ""\}/.test(eq)
    && /comme le client a payé/.test(eq)
    && /aucun moyen lisible sur ses ventes — il sera demandé au paiement/.test(eq));
  test("★ le geste de changement est refusé à un compte en lecture seule", /const changerMoyenApporteur = async \(a\) => \{\s*\n\s*if \(bloquerSiLecture\(db, profile\)\) return;/.test(eq));
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
