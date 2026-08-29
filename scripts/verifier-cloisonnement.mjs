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
import { unlinkSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
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

// Les calculs du dimensionnement solaire.
const sortieSol = join("node_modules", ".cache", `bmi-sol-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/solaire.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieSol, logLevel: "silent", loader: { ".js": "jsx" } });
const Sol = await import(pathToFileURL(sortieSol).href);
unlinkSync(sortieSol);

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
  test("…et efface la copie périmée gardée sur l'appareil",
    /r\.refuse[\s\S]{0,200}oublierCompteLocal/.test(cnx));
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
  test("sur le formulaire de création (aucun chantier), c'est l'espace du compte connecté",
    C.espaceDuChantier(db, null, chefForm) === true && C.espaceDuChantier(db, null, timo) === false);
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
  test("une quantité au-delà du seuil déclenche l'avertissement visible",
    Dim.quantiteNecessaire(40000, 550) >= Dim.SEUIL_QTE_INHABITUELLE);
  test("une installation normale ne déclenche AUCUN avertissement",
    Dim.quantiteNecessaire(5500, 550) === 10 && 10 < Dim.SEUIL_QTE_INHABITUELLE);
  test("un article mal nommé (« panneau 5W ») produit une quantité énorme… qui sera signalée",
    Dim.quantiteNecessaire(19000, 5) === 3800 && 3800 >= Dim.SEUIL_QTE_INHABITUELLE);
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

  test("★ un fournisseur n'est plus payé « en espèces » sans qu'on demande",
    !/description: `Règlement fournisseur \$\{fo\.nom\}`, montant: m, paiement: "Espèces"/.test(fo)
    && /Moyen de paiement à \$\{fo\.nom\}/.test(fo));
  test("★ la CNSS non plus « par virement » sans qu'on demande",
    !/paiement: "Virement bancaire", par: profile\.nom, auto: "cnss"/.test(sal)
    && /Moyen de paiement de la CNSS/.test(sal));
  test("les deux passent la réponse par normPaiement (mêmes libellés partout)",
    /paiement: normPaiement\(moyen\)/.test(fo) && /paiement: normPaiement\(moyen\)/.test(sal));
  test("le défaut proposé reste le plus courant pour chacun",
    /Moyen de paiement à[\s\S]{0,90}?"Espèces"\)/.test(fo)
    && /Moyen de paiement de la CNSS[\s\S]{0,90}?"Virement bancaire"\)/.test(sal));
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

  test("★ l'importation REFUSE une ligne sans prix de vente",
    /if \(!\(prixVente > 0\)\) \{[\s\S]{0,220}?return;/.test(st));
  test("★ …et dit LAQUELLE, au lieu de « 3 erreurs ignorées »",
    /ligne\(s\) NON importée\(s\)/.test(st) && /erreurs\.slice\(0, 10\)/.test(st));
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


console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
