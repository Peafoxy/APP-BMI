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
import { ligneAssistant, ETAPE_MENU, ETAPE_CONSEILLER } from "../src/lib/assistantWhatsapp.js";

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

const rendre = (db, profile, cleInitiale = null) => renderToStaticMarkup(<Whatsapp db={db} save={() => {}} profile={profile} cleInitiale={cleInitiale} />);

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
