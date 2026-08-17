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
import { unlinkSync, mkdirSync } from "node:fs";
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
unlinkSync(sortieCore);

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

titre("Les sélecteurs ne montrent que l'espace du compte");
{
  const db = base();
  const noms = (p) => C.boutiquesVisibles(db, p, db.boutiques).map((b) => b.nom);
  test("le stagiaire ne voit aucune vraie boutique",
    !noms(P.stagiaire).some((n) => ["APESSITO", "HEDZRANAWOE", "DEPOT"].includes(n)));
  test("le vendeur réel ne voit aucune boutique de formation",
    !noms(P.vendeur).some((n) => n.includes("FORMATION")));
  test("l'admin principal voit tout", noms(P.admin).length === db.boutiques.length);
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
  test("espaceDuCompte vaut undefined pour l'admin principal (il voit tout)",
    C.espaceDuCompte(db, P.admin) === undefined);
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


titre("Les autres administrateurs ne doivent pas traverser sans qu'on le sache");
{
  const db = base();
  // ADMIN2 porte deja act_voir_tout dans droits_off (cf. base) : il est
  // cloisonne. On ajoute un admin cree AVANT ce reglage, donc sans rien
  // dans droits_off — c'est le cas reel d'une installation existante.
  db.users = [...db.users, { id: "u_admin3", nom: "ELIE", role: "admin" }];
  const elie = { id: "u_admin3", role: "admin" };
  test("un admin créé avant le réglage traverse les deux espaces",
    C.voitLesDeuxEspaces(db, elie) === true);
  test("…et il est signalé à l'administrateur principal",
    C.adminsVoyantLesDeuxEspaces(db).some((u) => u.id === "u_admin3"));
  test("l'admin principal n'est jamais compté dans cette alerte",
    !C.adminsVoyantLesDeuxEspaces(db).some((u) => u.id === "u_admin"));
  test("un admin à qui on a retiré le pouvoir est bien cloisonné", (() => {
    const apres = { ...db, users: db.users.map((u) => (u.id === "u_admin3"
      ? { ...u, droits_off: ["act_voir_tout"] } : u)) };
    return C.voitLesDeuxEspaces(apres, elie) === false
      && C.adminsVoyantLesDeuxEspaces(apres).length === 0;
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

  // ⚠ Le cas exact de la capture : un ADMIN marqué formation, mais qui
  // garde le pouvoir « voir les deux espaces » accordé par defaut.
  // (u_admin2 de la base a DEJA act_voir_tout retire : on ajoute un admin
  // cree avant ce reglage, comme HEZOU/NOE/RENE sur l'installation reelle.)
  const dbAdminForm = { ...db, users: [...db.users, { id: "u_hezou", nom: "HEZOU", role: "admin", formation: true }] };
  const adminForm = { id: "u_hezou", role: "admin" };
  test("un admin marqué formation qui garde act_voir_tout voit encore tout",
    C.voitLesDeuxEspaces(dbAdminForm, adminForm) === true);
  test("…et une fois le pouvoir retiré, son drapeau prend enfin effet", (() => {
    const apres = { ...dbAdminForm, users: dbAdminForm.users.map((u) => (u.id === "u_hezou"
      ? { ...u, droits_off: ["act_voir_tout"] } : u)) };
    return C.afficheChiffresFormation(apres, adminForm) === true
      && apres.ventes.filter(C.filtreEspaceAffichage(apres, adminForm)).length === 1;
  })());
}


console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
