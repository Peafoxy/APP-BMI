// ============================================================
// lib/pageIcones.js — LA PAGE D'ICÔNES (règles pures, sans import)
//
// Timo (06/11/2026), après les captures d'Odoo : « A2, B1, C1 », « 1 », puis
// « reprendre l'image de fond de session verrouillée pour le fond des
// icônes ». Chaque ONGLET devient une ICÔNE (pas de familles), le logo BMI
// en haut à gauche ramène à la page d'icônes (pas au tableau de bord), sur
// téléphone ET sur ordinateur ; plus de barre d'onglets.
//
// Le rôle décide toujours QUELS onglets (et les pouvoirs), la personne leur
// ORDRE (appui long, lib/ordreOnglets.js) : rien de cela ne change ici. Ce
// fichier ne fait que DIRE comment dessiner une icône à partir du libellé
// d'un onglet — une seule source pour le nom, l'icône et le nombre.
// ============================================================

// La page d'icônes est un « onglet » à part : c'est elle qui s'ouvre à la
// connexion, et le logo y ramène.
export const ACCUEIL = "accueil";

// « 💬 Messages (3) » → { icone: "💬", nom: "Messages", nombre: 3 }.
// Un libellé sans emoji en tête garde son nom entier (icone "").
export function decomposerLibelle(libelle) {
  const texte = String(libelle ?? "").trim();
  let nombre = 0;
  let reste = texte;
  const m = reste.match(/\s*\((\d+)\)\s*$/);
  if (m) { nombre = Number(m[1]); reste = reste.slice(0, m.index).trim(); }
  const espace = reste.indexOf(" ");
  const premier = espace > 0 ? reste.slice(0, espace) : "";
  // Un emoji n'a ni lettre ni chiffre : le premier mot en est un s'il n'en porte aucun.
  const estIcone = premier && !/[\p{L}\p{N}]/u.test(premier);
  return estIcone
    ? { icone: premier, nom: reste.slice(espace + 1).trim(), nombre }
    : { icone: "", nom: reste, nombre };
}

// Le fond PÂLE de chaque icône (variante « 1 », 06/11/2026) : une couleur par
// métier, pour qu'un domaine se repère d'un coup d'œil. Ni rouge (refusé) ni
// violet (la formation). Un onglet inconnu prend le gris bleuté.
const COULEURS = {
  ventes: "#dbeafe", commandes: "#dbeafe", commande: "#dbeafe", dimensionnement: "#dbeafe", tous_devis: "#dbeafe",
  contrats: "#dbeafe", dettes: "#dbeafe", clients: "#dbeafe", prospects: "#dbeafe", nouveau_client: "#dbeafe",
  espace_client: "#dbeafe", mes_contrats: "#dbeafe",
  depenses: "#dcfce7", chez_comptable: "#dcfce7", caisse: "#dcfce7", argent_recu: "#dcfce7",
  stocks: "#fef3c7", ravitaillement: "#fef3c7", transfert: "#fef3c7", outillage: "#fef3c7",
  fournisseurs: "#e0e7ff",
  parc: "#ffedd5", travaux: "#ffedd5", primes_remises: "#ffedd5",
  equipe: "#fce7f3", commerciaux: "#fce7f3", taches: "#fce7f3", rendez_vous: "#fce7f3", salaires: "#fce7f3",
  salaire: "#fce7f3", users: "#fce7f3", commission: "#fce7f3", primes_recues: "#fce7f3",
  messages: "#cffafe",
  // 06/11/2026 (Timo : « mettre un vrai icône de WhatsApp ») : la tuile verte
  // de WhatsApp, le logo en blanc dessus (PageIcones.jsx).
  whatsapp: "#25D366",
  dashboard: "#ccfbf1", rentabilite: "#ccfbf1", historique: "#ccfbf1",
  parametres: "#cbd5e1", mes_donnees: "#cbd5e1",
};
export const COULEUR_ICONE_DEFAUT = "#e2e8f0";
export const couleurIcone = (id) => COULEURS[id] || COULEUR_ICONE_DEFAUT;

// ---- 🧭 LE CHOIX DE L'AFFICHAGE (Timo, 06/11/2026 : « je préfère que ça
// soit un choix pour les utilisateurs… il choisit la première interface ou
// celle-ci » → « 1b, 2b ») ----
// Deux affichages : la BARRE d'onglets (la première interface — colonne à
// gauche sur ordinateur, bande qui défile sur téléphone) et la PAGE
// D'ICÔNES. « 1b » : la barre d'onglets d'office. « 2b » : l'administrateur
// peut FIXER l'affichage d'une personne (`interface_imposee`, sur sa fiche,
// réservé à l'administrateur — securite-50) ; tant qu'il est fixé, la
// personne ne le change pas. Son propre choix vit sur SA fiche
// (`interface`), comme l'ordre de ses onglets : il suit ses appareils.
export const INTERFACE_BARRE = "barre";
export const INTERFACE_ICONES = "icones";
// 📌 08/11/2026 (Timo : « une 3e manière d'afficher… à la place des onglets,
// on met les icônes sur le côté » → aperçus validés, « oui avec le point
// rouge, lance ») : la COLONNE D'ICÔNES. Sur ordinateur, les icônes restent à
// gauche ; sur téléphone elles sont repliées derrière un bouton ☰ (en haut à
// gauche), avec un point rouge s'il y a quelque chose en attente, et se
// replient toutes seules après le choix d'un écran.
export const INTERFACE_COLONNE = "colonne";
export const INTERFACE_DEFAUT = INTERFACE_BARRE;
export const INTERFACES = [INTERFACE_BARRE, INTERFACE_ICONES, INTERFACE_COLONNE];
export const LIBELLES_INTERFACE = {
  [INTERFACE_BARRE]: "📋 Barre d'onglets",
  [INTERFACE_ICONES]: "🔲 Page d'icônes",
  [INTERFACE_COLONNE]: "📌 Colonne d'icônes",
};
export const estInterface = (v) => INTERFACES.includes(v);

// Le point rouge du bouton ☰ : au moins un onglet porte un nombre « (N) ».
export const aQuelqueChoseEnAttente = (tabs) =>
  (tabs || []).some((t) => decomposerLibelle(Array.isArray(t) ? t[1] : t).nombre > 0);

// L'affichage fixé par l'administrateur, ou "" s'il n'y en a pas.
export function interfaceImposee(fiche) {
  const v = fiche?.interface_imposee;
  return estInterface(v) ? v : "";
}

// L'affichage EN VIGUEUR : celui fixé par l'administrateur, sinon celui
// choisi par la personne, sinon la barre d'onglets.
export function interfaceDe(fiche) {
  const imposee = interfaceImposee(fiche);
  if (imposee) return imposee;
  return estInterface(fiche?.interface) ? fiche.interface : INTERFACE_DEFAUT;
}

// Le choix de la personne : refusé s'il est fixé par l'administrateur.
export function critiqueChoixInterface(fiche, valeur) {
  if (!estInterface(valeur)) return "Affichage inconnu.";
  const imposee = interfaceImposee(fiche);
  if (imposee) return `L'administrateur a fixé votre affichage : ${LIBELLES_INTERFACE[imposee]}. Demandez-lui pour en changer.`;
  return "";
}
