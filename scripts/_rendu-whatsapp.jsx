// Rend le VRAI écran 📲 WhatsApp, pour que le banc le monte pour de bon.
//
// ⚠ POURQUOI : « un écran qui PRÉSUME une table est un écran blanc en
// puissance », et le SEUL contrôle qui attrape un écran blanc est celui qui
// REND l'écran (leçon du 19/09/2026, `boutiquesVisibles(db, profile)` à deux
// arguments — le client tapait son mot de passe et tombait sur du blanc).
// On le monte donc sur DEUX bases : une garnie, et une NUE.
import { renderToStaticMarkup } from "react-dom/server";
import { Whatsapp, MediaWa } from "../src/screens/Whatsapp.jsx";

const boutiques = [{ id: "b1", nom: "APESSITO" }];
const users = [
  { id: "TIMO", nom: "TIMO", role: "admin", admin_principal: true },
  { id: "COM1", nom: "COM1", role: "commercial" },
  { id: "CLI1", nom: "ESSO", role: "client", tel: "90112233" },
];
const messages = [
  { id: "wa1", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO",
    wa_entrant: true, ts: new Date().toISOString(), date: new Date().toISOString().slice(0, 10),
    texte: "", lu_par: [],
    wa_media: { type: "image", lien: "https://x/y.jpg", media_id: "m1", mime: "image/jpeg", nom: "", legende: "" } },
];
const garnie = { boutiques, users, messages, produits: [], ventes: [] };

const rendre = (db, profile) => renderToStaticMarkup(<Whatsapp db={db} save={() => {}} profile={profile} />);

export const htmlAdmin = () => rendre(garnie, users[0]);
export const htmlComptable = () => rendre(garnie, { id: "CPT", nom: "COMPTA", role: "comptable" });
// ⚠ LA BASE NUE : aucune table, comme un appareil qui vient de se connecter
// et n'a encore rien téléchargé.
export const htmlNu = () => rendre({}, users[0]);

// ⚠ CE SONT DES FONCTIONS, pas des valeurs : si le rendu lève, le banc doit
// afficher un ✗ lisible, pas s'arrêter net sur une pile d'erreurs.
// ⚠ Le fil ne se dessine qu'une fois une conversation OUVERTE (un clic) :
// on monte donc la vignette elle-même, qui est ce qui pouvait casser.
export const htmlPhoto = () => renderToStaticMarkup(<MediaWa message={messages[0]} />);
export const htmlVocale = () => renderToStaticMarkup(
  <MediaWa message={{ id: "wa2", wa_media: { type: "voice", lien: "https://x/v.ogg", mime: "audio/ogg" } }} />);
export const htmlDoc = () => renderToStaticMarkup(
  <MediaWa message={{ id: "wa3", wa_media: { type: "document", lien: "https://x/f.pdf", nom: "facture.pdf" } }} />);
