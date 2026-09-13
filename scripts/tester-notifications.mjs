// ============================================================
// scripts/tester-notifications.mjs — LES NOTIFICATIONS
//
//   npm run tester-notifications
//
// Timo (13/09/2026) : liste A (les messages de 💬) = notifications ; liste B
// (ce qui reste à l'écran) = notifications « pour information », jamais
// dans Messages. Ce banc :
//   • importe lib/rappels.js DIRECTEMENT dans Node, sans bundler — c'est la
//     chaîne que le serveur (api/rappels-du-matin.js) suit : si un import
//     sans extension la cassait, le banc tomberait avant le serveur ;
//   • bundle lib/notifications.js (qui lit calculs.js, donc React) et
//     rejoue chaque cas de la liste A et de la liste B ;
//   • vérifie que rien d'autre ne décide d'une notification (un seul appel
//     dans App.jsx, aucun `Notification.` hors src/push.js), que la clé
//     privée n'est nulle part, que le serveur exige le jeton et le secret.
// ============================================================
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { unlinkSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as R from "../src/lib/rappels.js";
import * as E from "../src/lib/espace.js";

const sortie = join("node_modules", ".cache", `bmi-notif-${process.pid}.mjs`);
mkdirSync(join("node_modules", ".cache"), { recursive: true });
await build({
  entryPoints: ["src/lib/notifications.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
});
const N = await import(pathToFileURL(sortie).href);
unlinkSync(sortie);

let ok = 0, ko = 0;
const test = (nom, cond) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };
const titre = (t) => console.log(`\n${t}`);
const memes = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---- Une petite BMI : deux espaces, les rôles utiles ----
const users = [
  { id: "timo", nom: "TIMO", role: "admin", admin_principal: true, actif: true },
  { id: "adminR", nom: "ADMIN R", role: "admin", actif: true },
  { id: "adminF", nom: "ADMIN F", role: "admin", formation: true, actif: true },
  { id: "gerantD", nom: "GERANT D", role: "gerant", boutique: "DEMAKPOE", actif: true },
  { id: "vendD1", nom: "VEND D1", role: "vendeur", boutique: "DEMAKPOE", actif: true },
  { id: "vendD2", nom: "VEND D2", role: "vendeur", boutique: "DEMAKPOE", actif: true },
  { id: "vendA", nom: "VEND A", role: "vendeur", boutique: "APESSITO", actif: true },
  { id: "vendF", nom: "VEND F", role: "vendeur", boutique: "FORMATION", actif: true },
  { id: "magR", nom: "MAG R", role: "magasinier", boutique: "DEPOT", actif: true },
  { id: "magF", nom: "MAG F", role: "magasinier", boutique: "DEPOT F", actif: true },
  { id: "compta", nom: "COMPTA", role: "comptable", actif: true },
  { id: "respcom", nom: "RESP", role: "resp_commercial", actif: true },
  { id: "com1", nom: "COM1", role: "commercial", actif: true },
  { id: "tech1", nom: "TECH1", role: "technicien", actif: true },
  { id: "tech2", nom: "TECH2", role: "technicien", actif: true },
  { id: "bloque", nom: "BLOQUE", role: "vendeur", boutique: "DEMAKPOE", actif: false },
  { id: "cli1", nom: "CLIENT1", nom_base: "Kossi", role: "client", actif: true, devis: [] },
  { id: "cliF", nom: "CLIENTF", role: "client", formation: true, actif: true, devis: [] },
];
const boutiques = [
  { id: "b1", nom: "DEMAKPOE" }, { id: "b2", nom: "APESSITO" }, { id: "b3", nom: "DEPOT", depot: true },
  { id: "b4", nom: "FORMATION", formation: true }, { id: "b5", nom: "DEPOT F", depot: true, formation: true },
  { id: "b6", nom: "Chez le comptable" },
];
const base = () => ({
  users, boutiques, produits: [], ventes: [], depenses: [], dettes: [], clotures: [], ajustements: [],
  messages: [], groupes: [], commandes: [], clients_installes: [],
});
const avec = (etat, champs) => ({ ...etat, ...champs });
const envoisDe = (avant, apres, profile = { id: "quelquun" }) => N.envoisDepuisSave(avant, apres, profile);
const seul = (liste, tagDebut) => liste.filter((e) => e.tag.startsWith(tagDebut));

titre("La chaîne lisible par le serveur (Node importe lib/rappels.js sans bundler)");
{
  test("★ lib/rappels.js s'importe dans Node tel quel : rappelsDuMatin, detteEnRetard, devisARelancer, fabriquerEnvoi existent",
    typeof R.rappelsDuMatin === "function" && typeof R.detteEnRetard === "function" && typeof R.devisARelancer === "function" && typeof R.fabriquerEnvoi === "function");
  const chaine = ["src/lib/rappels.js", "src/lib/cloture.js", "src/lib/versements.js", "src/lib/validationDepenses.js", "src/lib/core.js", "src/lib/comptesClients.js", "src/lib/espace.js"];
  const sansExtension = chaine.filter((f) => /from "\.\/[a-zA-Z]+";/.test(readFileSync(f, "utf8")));
  test("★ chaque import de cette chaîne porte son extension .js (sinon le serveur Vercel ne le trouve pas)", sansExtension.length === 0);
  test("★ estCompteFormation est écrite UNE fois (lib/espace.js) et réexportée par calculs.js — jamais une copie",
    /export const estCompteFormation = estCompteFormationRegle;/.test(readFileSync("src/lib/calculs.js", "utf8"))
    && /import \{ estCompteFormation as estCompteFormationRegle \} from "\.\/espace";/.test(readFileSync("src/lib/calculs.js", "utf8")));
  test("un compte suit SA boutique (vendeur de FORMATION = formation), sinon son drapeau (adminF)",
    E.estCompteFormation(base(), users.find((u) => u.id === "vendF")) === true && E.estCompteFormation(base(), users.find((u) => u.id === "adminF")) === true
    && E.estCompteFormation(base(), users.find((u) => u.id === "vendD1")) === false);
  test("idsDeLaBoutique ne rend que les rôles demandés, actifs, de cette boutique", memes(E.idsDeLaBoutique(base(), "DEMAKPOE", ["vendeur", "gerant"]), ["gerantD", "vendD1", "vendD2"]));
  test("idsAdmins(réel) = admins réels + principal ; idsAdmins(formation) = admin de formation + principal (il voit les deux)",
    memes(E.idsAdmins(base(), false), ["timo", "adminR"]) && memes(E.idsAdmins(base(), true), ["adminF", "timo"]));
}

titre("La fabrique d'un envoi");
{
  test("sans destinataire, pas d'envoi", R.fabriquerEnvoi({ destinataires: [], titre: "x", texte: "y" }) === null);
  const e = R.fabriquerEnvoi({ destinataires: ["a", "a", null, "b"], titre: "Titre", texte: "  un   texte  ", ecran: "caisse", tag: "t", formation: true });
  test("doublons et vides retirés, 🎓 devant le titre en formation, texte nettoyé", memes(e.destinataires, ["a", "b"]) && e.titre === "🎓 Titre" && e.texte === "un texte" && e.ecran === "caisse");
  test("un texte trop long est coupé avec « … » à LONGUEUR_TEXTE", R.abreger("x".repeat(400)).length === R.LONGUEUR_TEXTE && R.abreger("x".repeat(400)).endsWith("…"));
}

titre("LISTE A — chaque nouveau message de 💬 est une notification pour son destinataire");
{
  const avant = base();
  const m = { id: "m1", de_id: "gerantD", de_nom: "GERANT D", a_id: "vendD1", texte: "Bonjour, pense à la clôture." };
  const envois = envoisDe(avant, avec(avant, { messages: [m] }), { id: "gerantD" });
  test("★ message à une personne → elle seule, titre 💬 + auteur, écran messages", envois.length === 1 && memes(envois[0].destinataires, ["vendD1"]) && envois[0].titre === "💬 GERANT D" && envois[0].ecran === "messages" && envois[0].texte === m.texte);
  test("un message déjà connu ne repart pas", envoisDe(avec(avant, { messages: [m] }), avec(avant, { messages: [m] })).length === 0);
  test("★ l'auteur du geste n'est jamais prévenu (message à soi-même = rien)", envoisDe(avant, avec(avant, { messages: [{ ...m, a_id: "gerantD" }] }), { id: "gerantD" }).length === 0);
  const groupe = { id: "g1", membres: ["timo", "gerantD", "vendD1"] };
  const mg = { id: "m2", de_id: "vendD1", de_nom: "VEND D1", canal: "groupe", groupe_id: "g1", texte: "Salut le groupe" };
  test("groupe → ses membres sauf l'auteur", memes(N.destinatairesMessage(avec(avant, { groupes: [groupe] }), mg), ["timo", "gerantD"]));
  const fiche = { id: "ci1", user_id: "cli1", commercial: "COM1", equipe: [{ user_id: "tech1", nom: "TECH1" }] };
  const dbFil = avec(avant, { clients_installes: [fiche] });
  const duClient = { id: "m3", de_id: "cli1", de_nom: "CLIENT1", canal: "support", client_id: "cli1", texte: "J'ai une question" };
  test("★ fil support écrit PAR le client → admins de son espace + technicien de SON chantier + SON commercial (pas tech2, pas com d'un autre, pas les vendeurs)",
    memes(N.destinatairesMessage(dbFil, duClient), ["timo", "adminR", "tech1", "com1"]));
  const aClient = { id: "m4", de_id: "com1", de_nom: "COM1", canal: "support", client_id: "cli1", texte: "Réponse" };
  test("fil support écrit par BMI → le client seul", memes(N.destinatairesMessage(dbFil, aClient), ["cli1"]));
  const duClientF = { id: "m5", de_id: "cliF", de_nom: "CLIENTF", canal: "support", client_id: "cliF", texte: "Formation" };
  const eF = N.envoiPourMessage(avant, duClientF);
  test("★ le mur : un client de FORMATION qui écrit prévient l'admin de formation et le principal (🎓), jamais l'admin réel", memes(eF.destinataires, ["adminF", "timo"]) && eF.titre.startsWith("🎓 💬"));
  const systeme = { id: "m6", de_id: "bmi-systeme", de_nom: "BMI TOGO", canal: "support", client_id: "cli1", texte: "🎉 Bonne nouvelle" };
  test("un message du système au client (parrainage) → le client", memes(N.destinatairesMessage(dbFil, systeme), ["cli1"]));
}

titre("LISTE B — ravitaillement, transfert, commande, prime");
{
  const avant = base();
  const dem = { id: "d1", date: "2026-09-13", par: "VEND D1", lignes: [{ qte: 3, nom: "Batterie 200Ah" }], statut: "en_attente" };
  const apres = avec(avant, { boutiques: boutiques.map((b) => (b.nom === "DEMAKPOE" ? { ...b, demandes: [dem] } : b)) });
  const e = seul(envoisDe(avant, apres, { id: "vendD1" }), "ravitaillement:");
  test("★ demande de ravitaillement → magasinier réel + admins réels (pas le magasinier de formation), écran stocks", e.length === 1 && memes(e[0].destinataires, ["magR", "timo", "adminR"]) && e[0].ecran === "stocks" && /3× Batterie 200Ah/.test(e[0].texte));
  test("relire le même état ne renvoie rien", envoisDe(apres, apres).length === 0);
  const demF = { ...dem, id: "d2" };
  const apresF = avec(avant, { boutiques: boutiques.map((b) => (b.nom === "FORMATION" ? { ...b, demandes: [demF] } : b)) });
  const eF = seul(envoisDe(avant, apresF), "ravitaillement:");
  test("★ le mur : une demande de la boutique de FORMATION → magasinier de formation + admin de formation + principal (🎓)", eF.length === 1 && memes(eF[0].destinataires, ["magF", "adminF", "timo"]) && eF[0].titre.startsWith("🎓 "));
  const tr = { id: "t1", type: "transfert", demandeur: "APESSITO", lignes: [{ qte: 1, nom: "Onduleur" }], statut: "en_attente" };
  const apresT = avec(avant, { boutiques: boutiques.map((b) => (b.nom === "DEMAKPOE" ? { ...b, demandes: [tr] } : b)) });
  const eT = seul(envoisDe(avant, apresT, { id: "vendA" }), "transfert:");
  test("★ demande de transfert (posée sur la boutique CIBLE) → gérant de la cible + admins ; le demandeur (APESSITO) n'est pas prévenu", eT.length === 1 && memes(eT[0].destinataires, ["gerantD", "timo", "adminR"]) && /APESSITO demande 1 article/.test(eT[0].texte));
  const servie = { ...dem, statut: "servie" };
  test("une demande qui n'est pas « en attente » ne prévient personne", seul(envoisDe(avant, avec(avant, { boutiques: boutiques.map((b) => (b.nom === "DEMAKPOE" ? { ...b, demandes: [servie] } : b)) })), "ravitaillement:").length === 0);

  const cmd = { id: "c1", boutique: "DEMAKPOE", commercial: "COM1", client: "Ama", articles: [{ qte: 2, nom: "Panneau", prix: 100000 }], remise: 0, statut: "en_attente" };
  const eC = seul(envoisDe(avant, avec(avant, { commandes: [cmd] }), { id: "com1" }), "commande:");
  test("★ commande sans vendeur visé → tous les vendeurs actifs de la boutique + le gérant (pas le compte bloqué, pas les admins), écran commandes, montant", eC.length === 1 && memes(eC[0].destinataires, ["vendD1", "vendD2", "gerantD"]) && eC[0].ecran === "commandes" && /200 000 F/.test(eC[0].texte.replace(/ | /g, " ")));
  const eC2 = seul(envoisDe(avant, avec(avant, { commandes: [{ ...cmd, id: "c2", vendeur_cible: "VEND D2" }] }), { id: "com1" }), "commande:");
  test("commande avec un vendeur visé → lui + le gérant seulement", eC2.length === 1 && memes(eC2[0].destinataires, ["vendD2", "gerantD"]));
  test("une commande validée (changement de statut) n'est pas une nouvelle commande", seul(envoisDe(avec(avant, { commandes: [cmd] }), avec(avant, { commandes: [{ ...cmd, statut: "validee" }] })), "commande:").length === 0);

  const ch = { id: "ch1", nom: "Mensah", prenom: "Yao", equipe: [{ user_id: "tech1", nom: "TECH1", montant: 15000 }] };
  const chApres = { ...ch, equipe: [{ ...ch.equipe[0], demande_prime: true, prime_boutique: "DEMAKPOE", prime_demandee_par: "TIMO" }] };
  const eP = seul(envoisDe(avec(avant, { clients_installes: [ch] }), avec(avant, { clients_installes: [chApres] }), { id: "timo" }), "prime:");
  test("★ demande de prime → vendeurs + gérant de la boutique de paiement, écran primes_remises", eP.length === 1 && memes(eP[0].destinataires, ["vendD1", "vendD2", "gerantD"]) && eP[0].ecran === "primes_remises" && /TECH1 : 15 000 F/.test(eP[0].texte.replace(/ | /g, " ")));
  test("une prime déjà demandée ne repart pas", seul(envoisDe(avec(avant, { clients_installes: [chApres] }), avec(avant, { clients_installes: [chApres] })), "prime:").length === 0);
}

titre("LISTE B — devis proposé au client, tâches, pointage du comptable");
{
  const avant = base();
  const devis = { id: "dv1", total: 850000, par: "COM1", par_id: "com1", date: "2026-09-13", statut: "propose" };
  const apres = avec(avant, { users: users.map((u) => (u.id === "cli1" ? { ...u, devis: [devis] } : u)) });
  const eD = seul(envoisDe(avant, apres, { id: "com1" }), "devis:");
  test("★ un devis proposé → le client, écran espace_client", eD.length === 1 && memes(eD[0].destinataires, ["cli1"]) && eD[0].ecran === "espace_client" && /850 000 F/.test(eD[0].texte.replace(/ | /g, " ")));
  const apresV = avec(avant, { users: users.map((u) => (u.id === "cli1" ? { ...u, devis: [{ ...devis, statut: "valide" }] } : u)) });
  test("un devis qui arrive déjà validé (repris, fusion) n'est pas « proposé »", seul(envoisDe(avant, apresV), "devis:").length === 0);

  const t = { id: "t1", titre: "Visiter le client Mensah", echeance: "2026-09-15", statut: "a_faire", par: "RESP" };
  const avecTache = (etat, tache) => avec(etat, { users: etat.users.map((u) => (u.id === "tech1" ? { ...u, taches: [tache] } : u)) });
  const eT = seul(envoisDe(avant, avecTache(avant, t), { id: "respcom" }), "tache:");
  test("★ nouvelle tâche → la personne, écran taches, échéance et auteur cités", eT.length === 1 && memes(eT[0].destinataires, ["tech1"]) && eT[0].ecran === "taches" && /pour le 15\/09\/2026/.test(eT[0].texte) && /par RESP/.test(eT[0].texte));
  const eFin = seul(envoisDe(avecTache(avant, t), avecTache(avant, { ...t, statut: "terminee" }), { id: "tech1" }), "tache:");
  test("★ tâche terminée → l'ASSIGNATEUR (retrouvé par son nom), écran equipe", eFin.length === 1 && memes(eFin[0].destinataires, ["respcom"]) && eFin[0].ecran === "equipe");
  const eVal = seul(envoisDe(avecTache(avant, { ...t, statut: "terminee" }), avecTache(avant, { ...t, statut: "validee", valide_par: "RESP" }), { id: "respcom" }), "tache:");
  test("tâche validée → la personne", eVal.length === 1 && memes(eVal[0].destinataires, ["tech1"]) && /validée par RESP/.test(eVal[0].texte));
  const eRo = seul(envoisDe(avecTache(avant, { ...t, statut: "terminee" }), avecTache(avant, { ...t, statut: "a_faire", commentaire_reouverture: "photo floue" }), { id: "respcom" }), "tache:");
  test("tâche rouverte → la personne, avec le motif", eRo.length === 1 && memes(eRo[0].destinataires, ["tech1"]) && /photo floue/.test(eRo[0].texte));
  test("une tâche inchangée ne repart pas", seul(envoisDe(avecTache(avant, t), avecTache(avant, { ...t, detail: "précision" })), "tache:").length === 0);

  const dep = { id: "dp1", boutique: "DEMAKPOE", categorie: "Carburant", description: "Moto", montant: 4000, par: "VEND D1", paye_avec: "comptable", date: "2026-09-13" };
  const eC = seul(envoisDe(avant, avec(avant, { depenses: [dep] }), { id: "vendD1" }), "pointage:");
  test("★ une dépense payée avec la caisse du comptable → le comptable, écran chez_comptable", eC.length === 1 && memes(eC[0].destinataires, ["compta"]) && eC[0].ecran === "chez_comptable" && /payée avec votre caisse/.test(eC[0].texte));
  const miroir = { id: "dp2", boutique: "Chez le comptable", montant: -50000, versement_id: "v1", description: "Versement du 13/09/2026" };
  test("★ l'entrée miroir d'un versement chez le comptable ne double pas son message (liste A)", seul(envoisDe(avant, avec(avant, { depenses: [miroir] })), "pointage:").length === 0);
  const ordinaire = { id: "dp3", boutique: "DEMAKPOE", montant: 4000, paye_avec: "caisse", par: "VEND D1", date: "2026-09-13" };
  test("une dépense ordinaire de boutique ne concerne pas le comptable", seul(envoisDe(avant, avec(avant, { depenses: [ordinaire] })), "pointage:").length === 0);
}

titre("LISTE B — un article qui PASSE au seuil, une clôture dépassée");
{
  const produits = [
    { id: "p1", nom: "Batterie 200Ah", boutique: "DEMAKPOE", initial: 5, entrees: 0, seuil: 3, prix_vente: 100 },
    { id: "p2", nom: "Onduleur", boutique: "DEMAKPOE", initial: 2, entrees: 0, seuil: 3, prix_vente: 100 },
    { id: "p3", nom: "Câble", boutique: "DEPOT", initial: 10, entrees: 0, seuil: 2, prix_vente: 10 },
    { id: "p4", nom: "Sans seuil", boutique: "DEMAKPOE", initial: 1, entrees: 0, seuil: 0, prix_vente: 10 },
  ];
  const avant = avec(base(), { produits });
  const vente = { id: "v1", boutique: "DEMAKPOE", date: "2026-09-13", paiement: "Espèces", articles: [{ produit_id: "p1", article: "Batterie 200Ah", qte: 2, pu: 100 }, { produit_id: "p2", article: "Onduleur", qte: 1, pu: 100 }, { produit_id: "p4", article: "Sans seuil", qte: 1, pu: 10 }], par: "VEND D1" };
  const e = seul(envoisDe(avant, avec(avant, { ventes: [vente] }), { id: "vendD1" }), "seuil:");
  test("★ la batterie PASSE au seuil (5 → 3) : une notification ; l'onduleur était DÉJÀ sous le seuil : pas cité ; sans seuil : jamais",
    e.length === 1 && /Batterie 200Ah \(reste 3\)/.test(e[0].texte) && !/Onduleur/.test(e[0].texte) && !/Sans seuil/.test(e[0].texte));
  test("→ vendeurs + gérant de la boutique + admins réels, écran stocks (pas le vendeur qui a vendu)", memes(e[0].destinataires, ["vendD2", "gerantD", "timo", "adminR"]) && e[0].ecran === "stocks");
  const ajust = { id: "a1", produit_id: "p3", boutique: "DEPOT", qte: -9, date: "2026-09-13" };
  const eD = seul(envoisDe(avant, avec(avant, { ajustements: [ajust] }), { id: "magR" }), "seuil:");
  test("★ au dépôt, c'est le magasinier (+ admins) — et l'auteur du geste est exclu, donc admins seuls ici", eD.length === 1 && memes(eD[0].destinataires, ["timo", "adminR"]) && /Câble \(reste 1\)/.test(eD[0].texte));
  test("sans changement de ventes / ajustements / produits, le stock n'est même pas relu", seul(envoisDe(avant, avec(avant, { messages: [] })), "seuil:").length === 0);

  const cloture = { id: "c1", boutique: "DEMAKPOE", date: "2026-09-12", theorique: 200, compte: 200 };
  const venteHier = { id: "v2", boutique: "DEMAKPOE", date: "2026-09-12", paiement: "Espèces", articles: [{ produit_id: "p1", article: "Batterie 200Ah", qte: 2, pu: 100 }], par: "VEND D1" };
  const etatClos = avec(base(), { produits, clotures: [cloture], ventes: [venteHier] });
  const venteApres = { id: "v3", boutique: "DEMAKPOE", date: "2026-09-12", paiement: "Espèces", articles: [{ produit_id: "p1", article: "Batterie 200Ah", qte: 1, pu: 100 }], par: "VEND D1" };
  const eCl = seul(envoisDe(etatClos, avec(etatClos, { ventes: [venteHier, venteApres] }), { id: "vendD1" }), "depassee:");
  test("★ une vente espèces sur une journée déjà clôturée = clôture dépassée → gérant + autres vendeurs + admins, écran caisse, écart cité",
    eCl.length === 1 && memes(eCl[0].destinataires, ["vendD2", "gerantD", "timo", "adminR"]) && eCl[0].ecran === "caisse" && /12\/09\/2026/.test(eCl[0].texte) && /\+100 F/.test(eCl[0].texte.replace(/ | /g, " ")));
  test("une clôture déjà dépassée ne se signale pas deux fois", seul(envoisDe(avec(etatClos, { ventes: [venteHier, venteApres] }), avec(etatClos, { ventes: [venteHier, venteApres], messages: [] })), "depassee:").length === 0);
}

titre("La tournée du matin (lib/rappels.js) — ce qui dépend du jour");
{
  const aujourdhui = "2026-09-13";
  test("joursEntre compte des jours entiers ; hier = la veille", R.joursEntre("2026-09-01", "2026-09-13") === 12 && R.hier("2026-09-13") === "2026-09-12" && R.hier("2026-10-01") === "2026-09-30");
  const dette = (date, montant, paye) => ({ id: `d${date}`, boutique: "DEMAKPOE", client: "Ama", date, montant, paye });
  test("★ dette en retard = plus de 30 jours ET il reste à payer (la règle de l'écran Dettes)",
    R.detteEnRetard(dette("2026-08-13", 100, 0), aujourdhui) && !R.detteEnRetard(dette("2026-08-14", 100, 0), aujourdhui) && !R.detteEnRetard(dette("2026-08-01", 100, 100), aujourdhui));
  test("★ elle PASSE en retard le 31e jour, une seule fois", R.dettePasseEnRetard(dette("2026-08-13", 100, 0), aujourdhui) && !R.dettePasseEnRetard(dette("2026-08-12", 100, 0), aujourdhui) && !R.dettePasseEnRetard(dette("2026-08-14", 100, 0), aujourdhui));
  const devis = (date, relance_le) => ({ id: "dv", date, relance_le, statut: "propose", total: 100000, par_id: "com1" });
  test("★ devis à relancer = 15 jours sans réponse, comptés depuis la dernière relance (la règle de Tous les devis)",
    R.devisARelancer(devis("2026-08-29"), aujourdhui) && !R.devisARelancer(devis("2026-08-30"), aujourdhui) && !R.devisARelancer(devis("2026-08-01", "2026-09-01"), aujourdhui) && !R.devisARelancer({ ...devis("2026-08-01"), statut: "paye" }, aujourdhui));
  test("il ATTEINT le seuil le 15e jour exactement", R.devisAtteintLeSeuil(devis("2026-08-29"), aujourdhui) && !R.devisAtteintLeSeuil(devis("2026-08-28"), aujourdhui));

  const db = avec(base(), {
    ventes: [{ id: "v1", boutique: "DEMAKPOE", date: "2026-09-12", paiement: "Espèces", articles: [{ produit_id: "p1", article: "Batterie", qte: 1, pu: 1000 }] }],
    dettes: [dette("2026-08-13", 50000, 10000), dette("2026-08-13", 20000, 0), { ...dette("2026-08-13", 300, 0), boutique: "FORMATION" }],
    users: users.map((u) => (u.id === "cli1" ? { ...u, devis: [devis("2026-08-29")] } : u.id === "cliF" ? { ...u, devis: [{ ...devis("2026-08-29"), id: "dvF" }] } : u)),
  });
  const envois = R.rappelsDuMatin(db, aujourdhui);
  const cl = envois.filter((e) => e.tag.startsWith("cloture:"));
  test("★ la caisse d'hier (une vente, pas de clôture) → vendeurs + gérant + admins réels, écran caisse", cl.length === 1 && memes(cl[0].destinataires, ["vendD1", "vendD2", "gerantD", "timo", "adminR"]) && cl[0].ecran === "caisse" && /12\/09\/2026/.test(cl[0].texte));
  const dt = envois.filter((e) => e.tag.startsWith("dettes:"));
  test("★ les dettes qui passent en retard, groupées par boutique : DEMAKPOE (2) et FORMATION (1, 🎓, à l'admin de formation + principal + vendeur F)",
    dt.length === 2 && dt.some((e) => e.titre === "📋 Dettes en retard — DEMAKPOE" && /2 dettes passent/.test(e.texte) && /reste 40 000 F/.test(e.texte.replace(/ | /g, " ")) && memes(e.destinataires, ["vendD1", "vendD2", "gerantD", "timo", "adminR"]))
    && dt.some((e) => e.titre === "🎓 📋 Dette en retard — FORMATION" && memes(e.destinataires, ["vendF", "adminF", "timo"])));
  const dv = envois.filter((e) => e.tag.startsWith("devis:"));
  test("★ le devis qui atteint 15 jours → son auteur + resp. commercial + admins de l'espace du client ; celui du client de formation → 🎓, admin de formation + principal + auteur",
    dv.length === 2 && dv.some((e) => memes(e.destinataires, ["com1", "respcom", "timo", "adminR"]) && e.ecran === "tous_devis" && /Kossi/.test(e.titre))
    && dv.some((e) => e.titre.startsWith("🎓 ") && memes(e.destinataires, ["com1", "adminF", "timo"])));
  test("un matin sans rien : aucune notification", R.rappelsDuMatin(base(), aujourdhui).length === 0);
  test("une caisse clôturée hier ne rappelle rien", R.rappelsDuMatin(avec(db, { clotures: [{ id: "c", boutique: "DEMAKPOE", date: "2026-09-12", theorique: 1000, compte: 1000 }], dettes: [], users }), aujourdhui).length === 0);
}

titre("Un seul chemin, et rien de secret dans l'application");
{
  const lire = (f) => readFileSync(f, "utf8");
  const app = lire("src/App.jsx");
  test("★ App.jsx décide des envois UNE fois, dans save(), par envoisDepuisSave(prev, final, profile) — jamais un écran",
    (app.match(/envoyerPush\(envoisDepuisSave\(prev, final, profile\)\)/g) || []).length === 1 && (app.match(/envoyerPush\(/g) || []).length === 1);
  const fichiers = [];
  const parcourir = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(js|jsx)$/.test(f)) fichiers.push(p); });
  parcourir("src");
  const horsPush = fichiers.filter((f) => f !== join("src", "push.js") && /\bNotification\.(requestPermission|permission)\b|pushManager|showNotification/.test(lire(f)));
  test("★ aucun écran ni module ne parle de Notification / pushManager : seulement src/push.js (et le service worker public/push-sw.js)", horsPush.length === 0);
  const importeurs = fichiers.filter((f) => /from "\.\.?\/(lib\/)?notifications"|from "\.\/notifications"/.test(lire(f)));
  test("★ lib/notifications.js n'est lu que par App.jsx", importeurs.length === 1 && importeurs[0] === join("src", "App.jsx"));
  const ecrans = fichiers.filter((f) => f.startsWith(join("src", "screens")) && /envoyerPush|notifierEnLigne|abonnerPushEnLigne/.test(lire(f)));
  test("aucun écran n'envoie de notification lui-même", ecrans.length === 0);
  const tout = fichiers.map(lire).join("\n") + lire("public/push-sw.js") + lire("vite.config.js");
  test("★ la clé PRIVÉE n'est nulle part dans l'application (aucune valeur affectée à VAPID_PRIVATE_KEY / privateKey, aucun VITE_VAPID)", !/VAPID_PRIVATE_KEY\s*[:=]\s*["'`]|privateKey\s*[:=]|VITE_VAPID/.test(tout) && !/VAPID_PRIVATE_KEY/.test(readFileSync(".env.example", "utf8").replace(/^#.*$/gm, "")));
  test("la clé publique est dans constants.js, et src/push.js la lit", /export const CLE_PUBLIQUE_PUSH = "B[A-Za-z0-9_-]{80,}";/.test(lire("src/lib/constants.js")) && /CLE_PUBLIQUE_PUSH/.test(lire("src/push.js")));
  const sw = lire("public/push-sw.js");
  test("★ le service worker affiche (push → showNotification) et ouvre l'écran au clic (notificationclick → ?ecran=)", /addEventListener\("push"/.test(sw) && /showNotification\(/.test(sw) && /addEventListener\("notificationclick"/.test(sw) && /\?ecran=/.test(sw) && /ouvrir-ecran/.test(sw));
  test("vite.config charge push-sw.js dans le service worker généré", /importScripts: \["push-sw\.js"\]/.test(lire("vite.config.js")));
  test("★ App.jsx ouvre l'écran demandé (?ecran= et message du service worker) SEULEMENT s'il est un onglet du rôle", /new URLSearchParams\(window\.location\.search\)\.get\("ecran"\)/.test(app) && /ONGLETS_ROLE\[profile\.role\] \|\| \[\]\)\.includes\(ecran\)/.test(app) && /"ouvrir-ecran"/.test(app));
  test("★ la permission est demandée AU CLIC de connexion (Connexion.jsx), et l'appareil est détaché à la déconnexion avant la fin de session",
    /const go = async \(\) => \{\n[^\n]*\n[^\n]*\n[^\n]*\n\s*demanderPermissionPush\(\);/.test(lire("src/screens/Connexion.jsx")) && /try \{ await oublierAppareil\(\); \} catch \{\}\n\s*setProfile\(null\);/.test(app));
  test("l'appareil est rattaché à la personne à la connexion ET au retour (F5)", (app.match(/enregistrerAppareil\(u\)/g) || []).length === 2);

  const notifier = lire("api/notifier.js"), abonner = lire("api/abonner-push.js"), matin = lire("api/rappels-du-matin.js"), push = lire("api/_push.js");
  test("★ api/notifier et api/abonner-push exigent le jeton de session (admin.auth.getUser) et prennent l'identité DU JETON", /admin\.auth\.getUser\(jeton\)/.test(notifier) && /admin\.auth\.getUser\(jeton\)/.test(abonner) && /auth\.user\.email\.split\("@"\)\[0\]/.test(notifier) && /auth\.user\.email\.split\("@"\)\[0\]/.test(abonner));
  test("api/notifier refuse un compte bloqué et retire l'appelant de ses propres destinataires", /compte\.actif === false/.test(notifier) && /destinataires\.filter\(\(d\) => d !== id\)/.test(notifier));
  test("★ la tournée du matin exige le secret de Vercel (CRON_SECRET) et importe la règle pure src/lib/rappels.js", /Bearer \$\{secret\}/.test(matin) && /from "\.\.\/src\/lib\/rappels\.js"/.test(matin) && /process\.env\.CRON_SECRET/.test(matin));
  test("vercel.json lance la tournée chaque matin à 07:00 (Lomé = UTC)", /"crons": \[\{ "path": "\/api\/rappels-du-matin", "schedule": "0 7 \* \* \*" \}\]/.test(lire("vercel.json")));
  test("les envois reçus sont bornés (destinataires, longueur du texte, nombre) et un appareil mort (404/410) est retiré", /MAX_DESTINATAIRES/.test(push) && /MAX_TEXTE/.test(push) && /code === 404 \|\| code === 410/.test(push) && /\.slice\(0, MAX_ENVOIS\)/.test(notifier));
  test("la clé privée ne vient que de la variable serveur VAPID_PRIVATE_KEY", /process\.env\.VAPID_PRIVATE_KEY/.test(push) && !/VITE_VAPID/.test(push));
  const dettes = lire("src/screens/Dettes.jsx"), devisEcran = lire("src/screens/TousLesDevis.jsx");
  test("★ l'écran Dettes lit detteEnRetard / joursDeDette de lib/rappels.js — plus de « > 30 » maison", /detteEnRetard\(d, today\(\)\)/.test(dettes) && !/jours > 30/.test(dettes));
  test("★ l'écran Tous les devis lit devisARelancer / joursSansReponse de lib/rappels.js — plus de seuil maison", /devisARelancer\(d, today\(\)\)/.test(devisEcran) && !/const SEUIL_RELANCE_JOURS = 15/.test(devisEcran) && !/function joursDepuis/.test(devisEcran));
  test("web-push est une dépendance du projet (le serveur l'importe)", /"web-push":/.test(lire("package.json")));
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
