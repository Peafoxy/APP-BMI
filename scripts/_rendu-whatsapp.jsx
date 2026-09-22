// Rend le VRAI écran 📲 WhatsApp, pour que le banc le monte pour de bon.
//
// ⚠ POURQUOI : « un écran qui PRÉSUME une table est un écran blanc en
// puissance », et le SEUL contrôle qui attrape un écran blanc est celui qui
// REND l'écran (leçon du 19/09/2026, `boutiquesVisibles(db, profile)` à deux
// arguments — le client tapait son mot de passe et tombait sur du blanc).
// On le monte donc sur DEUX bases : une garnie, et une NUE.
import { renderToStaticMarkup } from "react-dom/server";
import { Whatsapp, MediaWa, compterNonLusWa } from "../src/screens/Whatsapp.jsx";

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

const rendre = (db, profile) => renderToStaticMarkup(<Whatsapp db={db} save={() => {}} profile={profile} />);

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
