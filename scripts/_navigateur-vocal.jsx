// Banc : le lecteur et le micro des notes vocales, MONTÉS dans Chromium
// (scripts/verifier-whatsapp.mjs, section 68). Jamais chargé par l'application.
import { createRoot } from "react-dom/client";
import { LecteurVocal, BoutonMicro, barresDuSon, garderVocal } from "../src/components/NoteVocale.jsx";
import { webmVersOgg, dureeVocale, lireWebmOpus } from "../src/lib/oggOpus.js";
import { garderCopieVocal, lireCopieVocal, purgerCopiesVocales } from "../src/vocauxLocaux.js";
import { MediaWa } from "../src/screens/Whatsapp.jsx";

window.Vocal = {
  webmVersOgg, dureeVocale, lireWebmOpus, barresDuSon,
  garderCopieVocal, lireCopieVocal, purgerCopiesVocales, garderVocal,
  monterLecteur(url, duree) {
    const div = document.createElement("div");
    div.id = "lecteur";
    document.body.appendChild(div);
    createRoot(div).render(<LecteurVocal url={url} duree={duree} />);
  },
  // La ligne d'une note ENVOYÉE, telle que 📲 WhatsApp la dessine (« a »,
  // 20/10/2026) : la copie de l'appareil la rejoue, sinon la phrase.
  // 🎤 `stocke` (21/10/2026) : le chemin de la note rangée 30 jours dans
  // l'espace privé — un collègue sans copie la charge par le serveur.
  monterLigneEnvoyee(id, stocke = "") {
    const div = document.createElement("div");
    div.id = "ligne-" + id;
    document.body.appendChild(div);
    createRoot(div).render(<MediaWa message={{ id, wa_tel: "90112233", wa_media: { type: "voice", mime: "audio/ogg", envoye: true, duree: 2, ...(stocke ? { stocke } : {}) } }} />);
  },
  monterMicro() {
    window.envoye = null; window.refus = [];
    const div = document.createElement("div");
    div.id = "micro";
    div.className = "relative flex items-center gap-2";
    div.style.cssText = "width:360px;height:48px;margin:200px 0 0 300px;position:relative";
    document.body.appendChild(div);
    createRoot(div).render(<><input style={{ flex: 1 }} /><BoutonMicro onEnvoyer={(f) => { window.envoye = f; }} onRefus={(m) => { window.refus.push(m); }} /></>);
  },
};
