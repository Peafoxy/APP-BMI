// ============================================================
// 🔕 « NE PLUS ENVOYER DE MESSAGES COMMERCIAUX » (Timo, 14/11/2026, « Les
// deux, lance » — devant la liste « 20 choses pour que ton app ne finisse pas
// au tribunal », point 18 : le lien de désinscription).
//
// Un client qui ne veut plus recevoir nos messages commerciaux (mot de
// fidélité, relances, demande d'avis, prise de contact…) le dit — « STOP » —,
// et un employé coche la case sur SA fiche de 📲 WhatsApp. Ensuite plus aucun
// de ces messages ne part vers SON NUMÉRO : ni d'un écran, ni d'une tournée
// automatique, ni de l'assistant qui relance.
//
// ⚠ CE QUI CONTINUE DE PARTIR, et c'est voulu : ce qu'il a demandé (un devis,
// une proforma, ses accès) et ce qui suit une affaire en cours (reçu, rappel
// de dette, lien du PV, rappel d'entretien, date d'installation…). On arrête
// la PUBLICITÉ, pas le service.
//
// OÙ ÇA VIT : une ligne à part dans la table des messages, par NUMÉRO (un
// client de comptoir n'a pas de compte) — même canal que la fiche légère
// d'une conversation (elle descend donc chez tout le personnel, et la base la
// garde déjà : rien à coller), mais SANS `wa_tel` : elle n'appartient à
// aucune conversation, donc supprimer la conversation (corbeille) ne
// l'emporte pas, et un client qui réécrit ne la remet pas à zéro.
//
// ⚠ Ce fichier n'importe RIEN : le serveur le lit aussi (api/).
// ============================================================

export const CANAL_STOP = "whatsapp_entete";
const PREFIXE = "wastop_";

// Un numéro se compare sur ses 8 derniers chiffres (la règle de la maison).
export const cleStop = (tel) => String(tel ?? "").replace(/\D/g, "").slice(-8);
export const idStop = (tel) => `${PREFIXE}${cleStop(tel)}`;

// Les modèles COMMERCIAUX : ce que BMI envoie de sa propre initiative pour
// vendre ou se rappeler au client. Un modèle absent d'ici part toujours.
export const MODELES_COMMERCIAUX = [
  "mot_fidelite", "mot_fidelite_simple",
  "relance_devis", "relance_devis_expiration",
  "prise_de_contact",
  "accueil_prospect", "relance_prospect",
  "demande_avis",
  // ⌛ 15/11/2026 : le rappel d'expiration d'une proforma (une offre).
  "rappel_proforma_expiration",
];
export const estModeleCommercial = (modele) => MODELES_COMMERCIAUX.includes(String(modele || ""));

export const estLigneStop = (m) =>
  !!m && m.canal === CANAL_STOP && typeof m.id === "string" && m.id.startsWith(PREFIXE) && !m.wa_tel;
export const stopActif = (m) => estLigneStop(m) && m.actif === true;

// La ligne du numéro, ou null.
export const stopDuNumero = (messages, tel) => {
  const id = idStop(tel);
  if (id === PREFIXE) return null;
  return (Array.isArray(messages) ? messages : []).find((m) => m && m.id === id && estLigneStop(m)) || null;
};
export const numeroEnStopDans = (messages, tel) => stopActif(stopDuNumero(messages, tel));

// Tous les numéros (8 chiffres) qui ont dit stop.
export const numerosStop = (messages) => {
  const s = new Set();
  (Array.isArray(messages) ? messages : []).forEach((m) => { if (stopActif(m)) s.add(m.id.slice(PREFIXE.length)); });
  return s;
};

// QUI : cocher = tout employé qui a 📲 WhatsApp (l'écran le vérifie) ;
// DÉCOCHER = l'administrateur seul — sinon celui qui veut relancer un client
// n'aurait qu'à décocher d'abord.
export const critiqueStopGeste = (profile, { actif, tel } = {}) => {
  if (!profile || profile.role === "client" || profile.role === "comptable") return "Ce compte ne règle pas les envois WhatsApp.";
  if (cleStop(tel).length < 8) return "Numéro de téléphone absent ou trop court.";
  if (!actif && profile.role !== "admin") return "Seul l'administrateur peut rouvrir les messages commerciaux pour un client qui les a refusés.";
  return "";
};

// La ligne à ranger. ⚠ `actif: false` s'écrit (jamais une ligne retirée) :
// on garde qui a rouvert, et quand.
// ⚠ Pas de nom : le numéro suffit, et la ligne survit à un effacement de client.
export function ligneStop({ tel, actif, profile, maintenant }) {
  const k = cleStop(tel);
  if (k.length < 8) return null;
  return {
    id: `${PREFIXE}${k}`,
    canal: CANAL_STOP,
    stop_cle: k,
    stop_numero: String(tel || k),
    actif: !!actif,
    le: String(maintenant || ""),
    par: profile?.nom || "?",
    par_id: profile?.id || "",
    ts: String(maintenant || ""),
  };
}

// Poser la ligne dans la liste des messages : on REMPLACE celle du numéro.
export function messagesAvecStop(messages, infos) {
  const liste = Array.isArray(messages) ? messages : [];
  const ligne = ligneStop(infos);
  if (!ligne) return liste;
  return [ligne, ...liste.filter((m) => m && m.id !== ligne.id)];
}

export const MOTIF_STOP = "Ce client a demandé à ne plus recevoir de messages commerciaux de BMI TOGO : rien n'est parti. (Ses reçus, ses devis et ses rappels de paiement continuent de partir. Seul l'administrateur peut rouvrir, dans 📲 WhatsApp → sa fiche.)";

// ---- Le registre de l'appareil : App.jsx le pose à chaque rendu (les lignes
// que CET appareil a reçues), et l'envoi (src/whatsapp.js) le lit. Le serveur
// revérifie sur la base : c'est lui la vraie barrière.
let registre = new Set();
export const poserNumerosStop = (numeros) => { registre = numeros instanceof Set ? numeros : new Set(numeros || []); };
export const numeroEnStop = (tel) => { const k = cleStop(tel); return k.length === 8 && registre.has(k); };

// Le refus d'un envoi — ou "" : il peut partir.
export const critiqueStop = ({ modele, tel, numeros } = {}) => {
  if (!estModeleCommercial(modele)) return "";
  const k = cleStop(tel);
  const liste = numeros instanceof Set ? numeros : registre;
  return k.length === 8 && liste.has(k) ? MOTIF_STOP : "";
};

// Sous le nom, à l'écran.
export const phraseStop = (ligne) => {
  if (!stopActif(ligne)) return "";
  const jour = String(ligne.le || "").slice(0, 10).split("-").reverse().join("/");
  return `🔕 Ne veut plus de messages commerciaux${jour ? ` — noté le ${jour}` : ""}${ligne.par ? ` par ${ligne.par}` : ""}`;
};
