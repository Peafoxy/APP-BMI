// Rend le VRAI écran 📲 WhatsApp, pour que le banc le monte pour de bon.
//
// ⚠ POURQUOI : « un écran qui PRÉSUME une table est un écran blanc en
// puissance », et le SEUL contrôle qui attrape un écran blanc est celui qui
// REND l'écran (leçon du 19/09/2026, `boutiquesVisibles(db, profile)` à deux
// arguments — le client tapait son mot de passe et tombait sur du blanc).
// On le monte donc sur DEUX bases : une garnie, et une NUE.
import { renderToStaticMarkup } from "react-dom/server";
import { Whatsapp, MediaWa, compterNonLusWa } from "../src/screens/Whatsapp.jsx";
import { messagesAvecLigneAcces, messagesAvecLigneEnvoi } from "../src/whatsapp.js";
import { conversationsWa } from "../src/lib/whatsappConversations.js";
import { texteAccesAffiche } from "../src/lib/whatsappModeles.js";
import { motDePasseConnu } from "../src/lib/comptesClients.js";
import { ligneAssistant, ETAPE_MENU, ETAPE_CONSEILLER, ligneRenduAssistant } from "../src/lib/assistantWhatsapp.js";

const boutiques = [{ id: "b1", nom: "APESSITO" }];
const users = [
  { id: "TIMO", nom: "TIMO", role: "admin", admin_principal: true },
  { id: "COM1", nom: "COM1", role: "commercial" },
  { id: "KOSSI", nom: "KOSSI", role: "vendeur" },
  { id: "CLI1", nom: "ESSO", role: "client", tel: "90112233" },
  { id: "CLI2", nom: "AYOKO", role: "client", tel: "90114455" },
];
const messages = [
  { id: "wa1", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO",
    wa_entrant: true, ts: new Date().toISOString(), date: new Date().toISOString().slice(0, 10),
    texte: "", lu_par: [],
    wa_media: { type: "image", lien: "https://x/y.jpg", media_id: "m1", mime: "image/jpeg", nom: "", legende: "" } },
];
// ---- 🔒 UNE CONVERSATION CONFIÉE À QUELQU'UN D'AUTRE (21/09/2026) ----
// ⚠⚠ ON MET EXPRÈS SES MESSAGES DANS LA BASE, alors qu'en vrai la base ne
// les enverrait pas (`securite-28`). C'est le pire cas : si l'application
// les laissait ressortir par une ligne grisée, le banc le verrait.
const confiee = [
  { id: "wa9", canal: "whatsapp", wa_tel: "90114455", wa_numero: "+22890114455", wa_nom: "AYOKO",
    ts: "2026-09-21T09:00:00Z", date: "2026-09-21", texte: "SECRET DE LA CONVERSATION", lu_par: [],
    proprietaire_id: "COM1", proprietaire_nom: "COM1" },
];
const fiches = [
  { id: "waent_90112233", canal: "whatsapp_entete", wa_tel: "90112233",
    wa_numero: "+22890112233", wa_nom: "ESSO", derniere: new Date().toISOString(), ts: new Date().toISOString() },
  { id: "waent_90114455", canal: "whatsapp_entete", wa_tel: "90114455",
    wa_numero: "+22890114455", wa_nom: "AYOKO", proprietaire_id: "COM1", proprietaire_nom: "COM1",
    derniere: "2026-09-21T09:00:00Z", ts: "2026-09-21T09:00:00Z" },
];
const garnie = { boutiques, users, messages: [...messages, ...confiee, ...fiches], produits: [], ventes: [] };

const rendre = (db, profile, cleInitiale = null, profilInitial = false) => renderToStaticMarkup(<Whatsapp db={db} save={() => {}} profile={profile} cleInitiale={cleInitiale} profilInitial={profilInitial} />);

// ---- 🔑 LA LIGNE « ACCÈS ENVOYÉS » (23/09/2026) : la VRAIE chaîne ----
// KOSSI (vendeur) crée le compte de KOFFI et les accès partent du numéro
// BMI : la ligne s'écrit dans le fil ; TIMO (admin) et KOSSI la lisent en
// clair, COM1 lit les trous masqués. Le mot de passe est celui que
// l'application RECALCULE depuis la fiche (mdp_auto), jamais écrit.
const clientAuto = { id: "CLI3", nom: "KOFFI", role: "client", tel: "90117788", mdp_auto: true, mdp_variante: 2, mdp_longueur: 6 };
export const mdpClient = () => motDePasseConnu(clientAuto);
export const ligneAcces = () => messagesAvecLigneAcces(garnie.messages, { profile: users[2], client: clientAuto });
export const lectureAcces = (lecteur) => {
  const m = ligneAcces().find((x) => x && x.wa_acces);
  return texteAccesAffiche(m, lecteur, { identifiant: clientAuto.nom, motDePasse: motDePasseConnu(clientAuto) });
};
export const lecteurAdmin = users[0], lecteurCreateur = users[2], lecteurAutre = users[1];

// ---- 📲 LA LIGNE D'UNE RELANCE DANS LE FIL (23/09/2026) ----
// La conversation d'AYOKO est CONFIÉE à COM1 et date du 21/09 ; KOSSI la
// relance depuis 📋 Tous les devis : la ligne s'écrit, la conversation
// remonte en tête chez l'administrateur, et elle reste à COM1.
export const ligneEnvoi = () => messagesAvecLigneEnvoi(garnie.messages, {
  profile: users[2], tel: "+22890114455", nom: "AYOKO", modele: "relance_devis",
  variables: ["AYOKO", "solaire", "1 250 000 F", "15/09/2026"], ref: { devis_id: "DV1" },
});
export const convsApresEnvoi = () => conversationsWa(ligneEnvoi(), users[0]);
export const convsAvantEnvoi = () => conversationsWa(garnie.messages, users[0]);
// ---- 💙 LE MOT DE FIDÉLITÉ ET 🧾 LE REÇU DE VENTE (23/09/2026) ----
// KOSSI envoie le mot de fidélité à ESSO (conversation au support) : elle
// lui est DONNÉE. À AYOKO (confiée à COM1) : elle RESTE à COM1. Le reçu de
// vente, lui, ne donne jamais la conversation.
const fid = (tel, nom) => ({ profile: users[2], tel, nom, modele: "mot_fidelite", variables: [nom], donnerAuSender: true });
export const ligneFideliteLibre = () => messagesAvecLigneEnvoi(garnie.messages, fid("+22890112233", "ESSO"));
export const convsFideliteLibre = () => conversationsWa(ligneFideliteLibre(), users[0]);
export const ligneFideliteConfiee = () => messagesAvecLigneEnvoi(garnie.messages, fid("+22890114455", "AYOKO"));
export const convsFideliteConfiee = () => conversationsWa(ligneFideliteConfiee(), users[0]);
export const ligneRecu = () => messagesAvecLigneEnvoi(garnie.messages, {
  profile: users[2], tel: "+22890112233", nom: "ESSO", modele: "recu_vente",
  variables: ["ESSO", "23/09/2026", "BMI DEMAKPOE", "DEM-0142", "160 000 F", "payé en espèces", "+228 91 13 05 11"], ref: { vente_id: "V1" },
});
export const convsRecu = () => conversationsWa(ligneRecu(), users[0]);
export const ligneEnvoiSansTel = () => messagesAvecLigneEnvoi(garnie.messages, { profile: users[2], tel: "", nom: "X", modele: "relance_devis", variables: ["A", "b", "c", "d"] });

export const htmlAdmin = () => rendre(garnie, users[0]);
export const htmlComptable = () => rendre(garnie, { id: "CPT", nom: "COMPTA", role: "comptable" });
// ⚠ LA BASE NUE : aucune table, comme un appareil qui vient de se connecter
// et n'a encore rien téléchargé.
export const htmlNu = () => rendre({}, users[0]);
// ⚠ LE VENDEUR : c'est lui qui doit voir la ligne GRISÉE — la conversation
// d'AYOKO est confiée à COM1 (le cas exact de la capture de Timo, où
// ANGELE écrivait encore dans une conversation confiée à TIMO1).
export const htmlVendeur = () => rendre(garnie, users[2]);

// 🎓 UN ADMINISTRATEUR DE FORMATION (22/09/2026, décision « B ») : son compte
// EST de formation, donc l'espace regardé l'est aussi — l'écran doit être
// vide et le dire, sans une ligne, pas même grisée. ⚠ On lui met exprès les
// mêmes messages dans la base (le pire cas : en vrai, securite-30 ne les lui
// enverrait pas ; si l'écran les laissait ressortir, le banc le verrait).
const adminFormation = { id: "FORMA", nom: "FORMA", role: "admin", formation: true };
export const htmlFormation = () => rendre(garnie, adminFormation);
export const nonLusFormation = () => compterNonLusWa(garnie, adminFormation);
export const nonLusReel = () => compterNonLusWa(garnie, users[0]);

// ⚠ CE SONT DES FONCTIONS, pas des valeurs : si le rendu lève, le banc doit
// afficher un ✗ lisible, pas s'arrêter net sur une pile d'erreurs.
// ⚠ Le fil ne se dessine qu'une fois une conversation OUVERTE (un clic) :
// on monte donc la vignette elle-même, qui est ce qui pouvait casser.
export const htmlPhoto = () => renderToStaticMarkup(<MediaWa message={messages[0]} />);
export const htmlVocale = () => renderToStaticMarkup(
  <MediaWa message={{ id: "wa2", wa_media: { type: "voice", lien: "https://x/v.ogg", mime: "audio/ogg" } }} />);
export const htmlDoc = () => renderToStaticMarkup(
  <MediaWa message={{ id: "wa3", wa_media: { type: "document", lien: "https://x/f.pdf", nom: "facture.pdf" } }} />);

// ---- 🤖 L'ASSISTANT (24/09/2026) : sa ligne dans le fil d'ESSO ----
export const renduAvecIA = () => {
  try {
    const ligne = ligneAssistant({ cle: "90112233", tel: "+22890112233", nom: "ESSO", texte: "Le panneau 400 W est disponible.", etape: "ia", ts: new Date(Date.now() + 1000).toISOString(), ia: true });
    // Le fil OUVERT : c'est là que l'étiquette « (IA) » se dessine.
    return rendre({ ...garnie, messages: [...garnie.messages, ligne] }, users[0], "90112233");
  } catch (e) { return `ERREUR ${e?.message || e}`; }
};
export const renduAvecAssistant = () => {
  try {
    const ligne = ligneAssistant({ cle: "90112233", tel: "+22890112233", nom: "ESSO", texte: "👋 Bonjour et bienvenue chez BMI TOGO !", etape: ETAPE_MENU, ts: new Date(Date.now() + 1000).toISOString() });
    return rendre({ ...garnie, messages: [...garnie.messages, ligne] }, users[0]);
  } catch (e) { return `ERREUR ${e?.message || e}`; }
};

// ---- 👨‍💼 UN CLIENT ATTEND UN CONSEILLER (25/09/2026) ----
const ligneRelais = () => ligneAssistant({ cle: "90112233", tel: "+22890112233", nom: "ESSO", texte: "Un conseiller BMI TOGO va vous répondre.", etape: ETAPE_CONSEILLER, ts: new Date(Date.now() - 12 * 60000).toISOString(), ia: true });
export const renduAttente = (ouvert = true) => {
  try { return rendre({ ...garnie, messages: [...garnie.messages, ligneRelais()] }, users[0], ouvert ? "90112233" : null); }
  catch (e) { return `ERREUR ${e?.message || e}`; }
};
export const renduAttenteRepondue = () => {
  try {
    const rep = { id: "wa-rep", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO", wa_entrant: false, de_id: "TIMO", de_nom: "TIMO", texte: "Bonjour, je suis là.", ts: new Date(Date.now() - 60000).toISOString(), lu_par: [] };
    return rendre({ ...garnie, messages: [...garnie.messages, ligneRelais(), rep] }, users[0], "90112233");
  } catch (e) { return `ERREUR ${e?.message || e}`; }
};

// ---- 🤖 « RENDRE À L'ASSISTANT » (21/10/2026) ----
// TIMO a répondu il y a une minute : le bouton se montre. Une fois la
// conversation rendue (la ligne système), il disparaît et la ligne se lit.
const reponseTimo = () => ({ id: "wa-rep2", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO", wa_entrant: false, de_id: "TIMO", de_nom: "TIMO", texte: "Je regarde votre demande.", ts: new Date(Date.now() - 60000).toISOString(), lu_par: [] });
export const renduAvantRendu = (profile = users[0]) => {
  try { return rendre({ ...garnie, messages: [...garnie.messages, reponseTimo()] }, profile, "90112233"); }
  catch (e) { return `ERREUR ${e?.message || e}`; }
};
export const renduApresRendu = () => {
  try {
    const marque = ligneRenduAssistant({ cle: "90112233", tel: "+22890112233", nom: "ESSO", par: "TIMO", par_id: "TIMO", ts: new Date(Date.now() - 30000).toISOString() });
    return rendre({ ...garnie, messages: [...garnie.messages, reponseTimo(), marque] }, users[0], "90112233");
  } catch (e) { return `ERREUR ${e?.message || e}`; }
};
export const renduAvantRenduCoupe = () => {
  try { return rendre({ ...garnie, boutiques: [{ ...boutiques[0], assistant_wa: false }], messages: [...garnie.messages, reponseTimo()] }, users[0], "90112233"); }
  catch (e) { return `ERREUR ${e?.message || e}`; }
};

// ---- ✓✓ LES COCHES (26/09/2026) : la VRAIE chaîne ----
// KOSSI envoie un reçu (numéro de suivi « yc-1 ») puis une relance
// (« yc-2 ») ; Meta dit « lu » pour la première, « échec » pour la seconde.
// La ligne sans numéro de suivi (d'avant) ne porte aucune coche.
export const ligneSuivie = (envoi) => messagesAvecLigneEnvoi([], {
  profile: users[2], tel: "+22890112233", nom: "ESSO", modele: "recu_vente",
  variables: ["ESSO", "26/09/2026", "APESSITO", "BMID-2026-0033", "132 200 F", "payé en espèces", "99968488"],
  ref: { vente_id: "V1" }, envoi,
});
export const htmlCoches = () => {
  const base = { ts: "2026-09-26T12:30:00Z", date: "2026-09-26", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO", de_id: "KOSSI", de_nom: "KOSSI", lu_par: ["KOSSI"] };
  const suivis = [
    { ...base, id: "s1", texte: "LIGNE LUE", wa_envoi_id: "yc-1", wa_statut: { etat: "lu", le: "2026-09-26T12:31:00Z" } },
    { ...base, id: "s2", ts: "2026-09-26T12:32:00Z", texte: "LIGNE EN ECHEC", wa_envoi_id: "yc-2", wa_statut: { etat: "echec", le: "2026-09-26T12:33:00Z", motif: "Ce numéro n'a pas WhatsApp." } },
    { ...base, id: "s3", ts: "2026-09-26T12:34:00Z", texte: "LIGNE SANS SUIVI" },
  ];
  return rendre({ ...garnie, messages: [...garnie.messages, ...suivis] }, users[0], "90112233");
};

// ---- 📁 L'ARCHIVAGE DES CONVERSATIONS (26/09/2026) : la VRAIE chaîne ----
// Capture Timo : une conversation de 5 jours dans « Conversations
// anciennes », mois « — ». 25 conversations RÉCENTES (lues), et une
// vieille de 5 mois : seule la vieille doit partir aux archives.
export const htmlArchivage = () => {
  const aujourdhui = new Date();
  const il = (jours) => new Date(aujourdhui.getTime() - jours * 86400000).toISOString();
  const lignes = [];
  for (let i = 0; i < 25; i++) {
    const cle = `9030${String(i).padStart(4, "0")}`;
    lignes.push({ id: `r${i}`, canal: "whatsapp", wa_tel: cle, wa_numero: `+228${cle}`, wa_nom: `RECENT${i}`, wa_entrant: true, ts: il(i % 6), date: il(i % 6).slice(0, 10), texte: "ok", lu_par: ["TIMO"] });
  }
  lignes.push({ id: "v1", canal: "whatsapp", wa_tel: "90399999", wa_numero: "+22890399999", wa_nom: "VIEUX CLIENT", wa_entrant: true, ts: il(150), date: il(150).slice(0, 10), texte: "ok", lu_par: ["TIMO"] });
  return rendre({ boutiques, users, messages: lignes, produits: [], ventes: [] }, users[0]);
};

// ---- 🔒 LE REÇU ET LE BON NE SE LISENT PAS PAR TOUT LE MONDE (26/09/2026) ----
// KOSSI (vendeur) encaisse la vente V9 et le reçu détaillé part du numéro
// BMI ; un bon de reprise part aussi. TIMO (principal) et KOSSI lisent le
// détail, recomposé depuis la vente ; ADMIN2 (administrateur, pas principal)
// et AMA (vendeuse) lisent la phrase neutre.
const venteV9 = { id: "V9", numero: "BMID-2026-0099", date: "2026-09-26", boutique: "APESSITO", client: "ESSO", tel: "+22890112233", paiement: "Espèces",
  articles: [{ produit_id: "p1", article: "Panneau 370W", qte: 4, prix: 50000 }],
  reprises: [{ ref: "R1", date: "2026-09-26", produit_id: "p1", article: "Panneau 370W", qte: 1, montant: 50000, rembourse: 50000, moyen: "Espèces", motif: "Reprise client (R1) — Ne veut plus", par: "TIMO" }] };
const usersPrives = [...users, { id: "ADMIN2", nom: "ADMIN2", role: "admin" }, { id: "AMA", nom: "AMA", role: "vendeur" }];
export const lignesPrivees = () => {
  let msgs = messagesAvecLigneEnvoi([], {
    profile: users[2], tel: "+22890112233", nom: "ESSO", modele: "recu_vente_detail",
    variables: ["ESSO", "26/09/2026", "APESSITO", "BMID-2026-0099", "4 × Panneau 370W", "200 000 F", "payé en espèces", "99968488"],
    ref: { vente_id: "V9" }, envoi: { id: "yc-9" },
  });
  msgs = messagesAvecLigneEnvoi(msgs, {
    profile: users[0], tel: "+22890112233", nom: "ESSO", modele: "bon_reprise",
    variables: ["APESSITO", "Lomé", "99968488", "REP-BMID-2026-0099-1", "26/09/2026", "BMID-2026-0099", "ESSO", "1 × Panneau 370W", "Ne veut plus", "50 000 F", "remboursé en espèces", "TIMO"],
    ref: { bon_numero: "REP-BMID-2026-0099-1", bon_vente_id: "V9" }, envoi: { id: "yc-10" },
  });
  return msgs;
};
export const htmlLignePrivee = (lecteurId) => rendre(
  { ...garnie, users: usersPrives, ventes: [venteV9], messages: [...lignesPrivees(), ...garnie.messages] },
  usersPrives.find((u) => u.id === lecteurId), "90112233");

// ---- 📎 UN FICHIER ENVOYÉ PAR BMI (03/10/2026) ----
// Le fil d'ESSO OUVERT (fenêtre ouverte : son message vient d'arriver), avec
// une ligne sortante qui porte un fichier ENVOYÉ — le nom seul, jamais le
// fichier. Le bouton 📎 doit être là, la ligne doit dire « envoyé ».
export const renduFichierEnvoye = () => {
  try {
    const ligne = { id: "waf1", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO",
      de_id: "TIMO", de_nom: "TIMO", ts: new Date(Date.now() + 1000).toISOString(), date: new Date().toISOString().slice(0, 10),
      texte: "Voici votre devis", lu_par: ["TIMO"],
      wa_media: { type: "document", nom: "devis-ESSO.pdf", mime: "application/pdf", taille: 245000, envoye: true } };
    return rendre({ ...garnie, messages: [...garnie.messages, ligne] }, users[0], "90112233");
  } catch (e) { return `ERREUR ${e?.message || e}`; }
};
export const htmlFichierEnvoye = () => renderToStaticMarkup(
  <MediaWa message={{ id: "waf2", wa_media: { type: "image", nom: "photo.jpg", mime: "image/jpeg", taille: 310000, envoye: true } }} />);

// ---- 👤 LE NOM D'UNE CONVERSATION (06/10/2026, décision « b ») ----
// Un inconnu qui n'a que son nom WhatsApp ; un inconnu NOMMÉ par
// l'administrateur ; et AYOKO (confiée à COM1) nommée elle aussi — chez le
// vendeur, sa ligne GRISÉE doit porter le nom donné, puisqu'elle ne vit que
// sur la fiche légère.
const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();
const messagesNoms = [
  ...garnie.messages.filter((m) => m.id !== "waent_90114455"),
  { id: "wan1", canal: "whatsapp", wa_tel: "90117711", wa_numero: "+22890117711", wa_profil: "Kossi M.", wa_entrant: true, texte: "Bonjour", ts: ilYa(5), lu_par: [] },
  { id: "waent_90117711", canal: "whatsapp_entete", wa_tel: "90117711", wa_numero: "+22890117711", wa_profil: "Kossi M.", derniere: ilYa(5), ts: ilYa(5) },
  { id: "wan2", canal: "whatsapp", wa_tel: "90117722", wa_numero: "+22890117722", wa_profil: "😎 Boss", wa_entrant: true, texte: "Prix ?", ts: ilYa(4), lu_par: [] },
  { id: "waent_90117722", canal: "whatsapp_entete", wa_tel: "90117722", wa_numero: "+22890117722", wa_profil: "😎 Boss", wa_nom_donne: "PLOMBIER AGOE", derniere: ilYa(4), ts: ilYa(4) },
  { id: "waent_90114455", canal: "whatsapp_entete", wa_tel: "90114455", wa_numero: "+22890114455", wa_nom: "AYOKO", wa_nom_donne: "AYOKO VILLA ADIDOGOME", proprietaire_id: "COM1", proprietaire_nom: "COM1", derniere: "2026-09-21T09:00:00Z", ts: "2026-09-21T09:00:00Z" },
];
export const messagesAvecNoms = messagesNoms;
// ⚠ 09/10/2026 (« a1 ») : les gestes de l'administrateur vivent dans le PROFIL —
// `profil` le rend ouvert.
export const renduNoms = (qui = "admin", ouvrir = null, profil = false) => {
  try { return rendre({ ...garnie, messages: messagesNoms }, qui === "admin" ? users[0] : users[2], ouvrir, profil); }
  catch (e) { return `ERREUR ${e?.message || e}`; }
};

// 📇 09/10/2026 : le profil d'un contact déjà enregistré dans les contacts
// Google de BMI — la trace vit sur la fiche légère.
export const renduProfilEnregistre = () => {
  const avec = messagesNoms.map((m) => (m.id === "waent_90117711"
    ? { ...m, wa_contact_google: { nom: "KOSSI MENSAH", par: "TIMO", le: "2026-10-09T10:00:00Z" } } : m));
  try { return rendre({ ...garnie, messages: avec }, users[0], "90117711", true); }
  catch (e) { return `ERREUR ${e?.message || e}`; }
};

// 📇 16/10/2026 (« a et b ») : la conversation d'ADJI, affichée « Contrôle et
// Énergie (nom WhatsApp) » alors que BMI l'a dans ses contacts Google. Le nom
// des contacts Google passe devant le nom WhatsApp — trouvé tout seul (`auto`)
// ou enregistré depuis l'écran. `profil` ouvre son profil.
export const renduNomGoogle = ({ auto = true, profil = false } = {}) => {
  const avec = messagesNoms.map((m) => (m.id === "waent_90117711"
    ? { ...m, wa_profil: "Contrôle et Énergie", wa_contact_google: auto
      ? { nom: "ADJI EYASSINAM", par: "recherche automatique", le: "2026-10-16T08:00:00Z", deja: true, auto: true }
      : { nom: "ADJI EYASSINAM", par: "TIMO", le: "2026-10-16T08:00:00Z" } }
    : m.id === "wan1" ? { ...m, wa_profil: "Contrôle et Énergie" } : m));
  try { return rendre({ ...garnie, messages: avec }, users[0], profil ? "90117711" : null, profil); }
  catch (e) { return `ERREUR ${e?.message || e}`; }
};

// ⚠ 07/10/2026 (capture Timo : écran blanc dès qu'on tape dans la recherche) :
// l'écran est rendu AVEC une recherche tapée — un nom, puis des chiffres.
export const htmlRecherche = (texte) => renderToStaticMarkup(<Whatsapp db={garnie} save={() => {}} profile={users[0]} rechercheInitiale={texte} />);

// ---- 🏗 LE REÇU D'UN DÉPÔT CHANTIER (13/10/2026, « A ok, B non, C b ») ----
// La VRAIE fabrique des reçus (celle de 💰 Ventes et de 📲 WhatsApp) sur un
// dépôt et sur une vente ordinaire, et le détail recomposé d'une ligne privée.
import { envoisRecuDeVente, texteLignePrivee } from "../src/lib/lignesPrivees.js";
const venteDepot = { id: "VD1", numero: "BMIA-2026-0003", date: "2026-10-12", boutique: "APESSITO", client: "KLOMEGAN", tel: "+22890556677", paiement: "Espèces",
  depot_chantier: true, frais_installation: 150000, articles: [{ produit_id: "p1", article: "Panneau 550W", qte: 6, pu: 100000, au_chantier: true }] };
const venteComptoir = { id: "VC1", numero: "BMIA-2026-0004", date: "2026-10-12", boutique: "APESSITO", client: "ESSO", tel: "+22890112233", paiement: "Espèces",
  articles: [{ produit_id: "p1", article: "Panneau 550W", qte: 1, pu: 100000 }] };
const bqApessito = { nom: "APESSITO", tel: "91000000" };
export const recusDepot = () => ({
  depot: envoisRecuDeVente(venteDepot, { boutique: bqApessito }),
  depotCredit: envoisRecuDeVente({ ...venteDepot, paiement: "Crédit (dette)" }, { boutique: bqApessito, dette: { paye: 300000, montant: 750000 } }),
  comptoir: envoisRecuDeVente(venteComptoir, { boutique: bqApessito }),
  ligne: (() => {
    const msgs = messagesAvecLigneEnvoi([], { profile: users[2], tel: venteDepot.tel, nom: "KLOMEGAN", modele: "recu_depot_chantier",
      variables: envoisRecuDeVente(venteDepot, { boutique: bqApessito })[0].variables, ref: { vente_id: "VD1" }, envoi: { id: "yc-d1" } });
    const m = msgs.find((x) => x.wa_modele === "recu_depot_chantier") || {};
    return { rangee: m, detail: texteLignePrivee(m, { ventes: [venteDepot], boutiques: [bqApessito], users }) };
  })(),
});

// ---- 📱 LA LISTE SUR TÉLÉPHONE (13/10/2026, capture Timo) ----
// Une conversation dont le dernier message est TRÈS long : la liste doit
// garder la largeur de l'écran (l'aperçu se coupe), jamais l'élargir.
export const htmlListeLongue = () => {
  const long = "📲 Envoyé du numéro BMI — Relance automatique du devis solaire de 4 243 580 F (établi le 03/10/2026) à MR CREDO : offre valable jusqu'au 18/10/2026. " .repeat(3);
  const ligne = { id: "walong", canal: "whatsapp", wa_tel: "98567605", wa_numero: "+22898567605", wa_nom: "MR CREDO",
    de_id: "TIMO", de_nom: "TIMO", ts: new Date().toISOString(), date: new Date().toISOString().slice(0, 10),
    texte: long, lu_par: ["TIMO"] };
  return rendre({ ...garnie, messages: [...garnie.messages, ligne] }, users[0]);
};

// ---- 🧾 L'AVIS DE DÉCISION DU DG SUR UNE DÉPENSE (13/10/2026, « Aa, Ba, Cb ») ----
// La VRAIE chaîne : la décision (validerDepense / rejeterDepense), l'avis
// construit sur la dépense AVANT la décision, la ligne rangée, puis le détail
// RECOMPOSÉ par 📲 WhatsApp sur la base APRÈS la décision.
import { validerDepense, rejeterDepense, suiteRejetDepense, suiteValidationDepense } from "../src/lib/validationDepenses.js";
import { envoiDepenseRejetee, envoiDepenseValidee, ligneEnvoiModele } from "../src/lib/whatsappModeles.js";
import { fmt, dFR } from "../src/lib/core.js";
export const avisDepense = () => {
  const auteur = { id: "KOSSI", nom: "KOSSI", nom_complet: "KOSSI Mensah", role: "gerant", tel: "90445566" };
  const dg = users[0];
  const dep = { id: "DEP1", date: "2026-10-12", boutique: "APESSITO", categorie: "Carburant", description: "Plein du tricycle", montant: 12000, paiement: "Espèces", paye_avec: "caisse", par: "KOSSI", par_id: "KOSSI", validation: { statut: "en_attente" } };
  const base = { users: [dg, auteur], boutiques, depenses: [dep], messages: [] };
  const commun = { employe: auteur.nom_complet, tel: auteur.tel, dep, boutique: "APESSITO", fmt, dFR };
  const un = (decision) => {
    const r = decision === "rejetee" ? rejeterDepense(base, dg, dep, "Pas de bon d'essence.", "2026-10-13") : validerDepense(base, dg, dep, "2026-10-13");
    const envoi = decision === "rejetee" ? envoiDepenseRejetee({ ...commun, motif: "Pas de bon d'essence.", suite: suiteRejetDepense(dep) }) : envoiDepenseValidee({ ...commun, suite: suiteValidationDepense(dep) });
    const msgs = messagesAvecLigneEnvoi([], { profile: dg, tel: auteur.tel, nom: auteur.nom, modele: envoi.modele, variables: envoi.variables, ref: { depense_id: dep.id }, envoi: { id: "yc-dep" } });
    const rangee = msgs.find((x) => x.wa_modele === envoi.modele) || {};
    return { envoi, interne: r.messages, rangee, attendu: ligneEnvoiModele(envoi.modele, envoi.variables), detail: texteLignePrivee(rangee, { ...base, depenses: r.depenses }) };
  };
  return { rejet: un("rejetee"), validation: un("validee") };
};

// ---- ✅ L'AVIS D'UNE TÂCHE (14/10/2026, « A c, B b, C b ») ----
import { envoiTacheAssignee, envoiTacheValidee } from "../src/lib/whatsappModeles.js";
export const avisTache = () => {
  const membre = { id: "TECH1", nom: "KOSSI", nom_complet: "KOSSI Mensah", role: "technicien", tel: "90445566",
    taches: [{ id: "T1", titre: "Visiter le chantier de MR ERIC", detail: "Vérifier les panneaux", echeance: "2026-10-16", statut: "validee", par: "TIMO", valide_par: "TIMO" }] };
  const dg = users[0];
  const tache = membre.taches[0];
  const base = { users: [dg, membre], boutiques, messages: [] };
  const un = (modele) => {
    const envoi = modele === "tache_assignee" ? envoiTacheAssignee({ employe: membre.nom_complet, tel: membre.tel, tache, dFR }) : envoiTacheValidee({ employe: membre.nom_complet, tel: membre.tel, tache, par: "TIMO" });
    const msgs = messagesAvecLigneEnvoi([], { profile: dg, tel: membre.tel, nom: membre.nom, modele: envoi.modele, variables: envoi.variables, ref: { tache_user_id: membre.id, tache_id: tache.id }, envoi: { id: "yc-t" } });
    const rangee = msgs.find((x) => x.wa_modele === envoi.modele) || {};
    return { envoi, rangee, attendu: ligneEnvoiModele(envoi.modele, envoi.variables), detail: texteLignePrivee(rangee, base) };
  };
  return { assignee: un("tache_assignee"), validee: un("tache_validee") };
};

// ---- 📄 L'ATTESTATION DE FIN DE CONTRAT DISPONIBLE (14/10/2026) ----
import { envoiAttestationDisponible } from "../src/lib/whatsappModeles.js";
import { construireMiseADisposition, momentFermeture, nomDocument } from "../src/lib/attestationSortie.js";
export const avisAttestation = () => {
  const dg = users[0];
  const brut = { id: "EMP9", nom: "FRED", nom_complet: "FRED Akakpo", role: "technicien_bmi", tel: "90778899", cnss_code_type: 12 };
  const marque = construireMiseADisposition({ u: brut, par: dg, maintenant: Date.parse("2026-10-14T11:05:00.000Z") });
  const employe = { ...brut, attestation_sortie: marque };
  const f = momentFermeture(marque);
  const envoi = envoiAttestationDisponible({ employe: employe.nom_complet, tel: employe.tel, document: nomDocument(marque), date: f.date, heure: f.heure });
  const msgs = messagesAvecLigneEnvoi([], { profile: dg, tel: employe.tel, nom: employe.nom, modele: envoi.modele, variables: envoi.variables, ref: { attestation_user_id: employe.id }, envoi: { id: "yc-a" } });
  const rangee = msgs.find((x) => x.wa_modele === envoi.modele) || {};
  return { envoi, rangee, attendu: ligneEnvoiModele(envoi.modele, envoi.variables), detail: texteLignePrivee(rangee, { users: [dg, employe], boutiques, messages: [] }) };
};

// ---- 🎤 LES NOTES VOCALES (20/10/2026, « A avec a2, B ») ----
// Une note ENVOYÉE, hors de la session qui l'a enregistrée : il n'en reste
// que la ligne (le son n'est pas rangé chez nous).
export const htmlVocaleEnvoyee = () => renderToStaticMarkup(
  <MediaWa message={{ id: "wa-v-env", wa_media: { type: "voice", nom: "note-vocale.ogg", mime: "audio/ogg", taille: 9000, duree: 7, envoye: true } }} />);
export const htmlSonEnvoye = () => renderToStaticMarkup(
  <MediaWa message={{ id: "wa-s-env", wa_media: { type: "audio", nom: "note-vocale.m4a", mime: "audio/mp4", taille: 9000, duree: 12, envoye: true } }} />);
