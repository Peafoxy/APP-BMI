// Le NOM d'un employé sur un document imprimé (Timo, 17/10/2026, « A a, B b ») :
// « Lorsque l'identité de l'utilisateur est renseignée, l'utiliser plutôt que
// de continuer à utiliser son identifiant sur les documents. »
//
// ⚠ Ce fichier n'importe RIEN (src/pdf.js et lib/impression.js le lisent).
// ⚠ Rien d'enregistré ne change : la vente, le devis, le versement gardent
// l'identifiant (« TIMO »). C'est au moment d'IMPRIMER qu'on cherche la fiche
// de la personne et son nom complet (🆔 Identité, champ `nom_complet`) — un
// ancien document réimprimé sort donc lui aussi avec le nom complet.
// ⚠ Les ÉCRANS (colonnes, historique) et les messages WhatsApp (« B b, pour
// le moment ») gardent l'identifiant : seuls les documents l'appliquent.

const cle = (x) => String(x == null ? "" : x).trim().toLowerCase();

// La règle pure. `personnes` = la liste des fiches où chercher ; `nom` = ce
// que le document porte (l'identifiant) ; `id` = l'identifiant de la fiche
// quand le document le porte. Trouvée par l'id d'abord ; sinon par le nom,
// parmi les employés (jamais un client), et SEULEMENT s'il n'y en a qu'un —
// entre deux homonymes on ne devine pas, on garde ce qui est écrit.
// ⚠⚠ UNE MÊME PERSONNE PEUT FIGURER DEUX FOIS (Timo, 22/10/2026 : reçu de
// BMID-2026-0066 « Vendeur : ANGELE », envoyé du téléphone d'ANGELE, alors que
// celui de BMID-2026-0063 disait « AKPOSSOGNA Kossiwa ») : App.jsx pose les
// fiches de l'espace PLUS le compte connecté — sur l'appareil de la vendeuse,
// SA fiche et SON compte portent le même nom. Comptés comme deux homonymes, on
// ne devinait pas et l'identifiant restait. On compte des PERSONNES (par id),
// et parmi les copies d'une personne on prend celle qui porte le nom complet.
const unParPersonne = (liste) => {
  const vues = new Map();
  for (const u of liste) {
    const k = u.id || u;
    const deja = vues.get(k);
    if (!deja || (!String(deja.nom_complet || "").trim() && String(u.nom_complet || "").trim())) vues.set(k, u);
  }
  return [...vues.values()];
};

export function nomSurDocumentDans(personnes, nom, id) {
  const ecrit = String(nom == null ? "" : nom).trim();
  const liste = Array.isArray(personnes) ? personnes.filter(Boolean) : [];
  let fiche = id ? unParPersonne(liste.filter((u) => u.id === id))[0] || null : null;
  if (!fiche && ecrit) {
    const memes = unParPersonne(liste.filter((u) => u.role !== "client" && cle(u.nom) === cle(ecrit)));
    if (memes.length === 1) fiche = memes[0];
  }
  const complet = fiche && String(fiche.nom_complet || "").trim();
  return complet || ecrit || (fiche ? String(fiche.nom || "") : "");
}

// Les fiches que l'application a posées (App.jsx, à chaque rendu : les
// personnes de l'espace regardé, plus le compte connecté). Sans elles (un
// banc qui imprime seul), le document garde l'identifiant, comme avant.
let personnesDesDocuments = [];
export const poserPersonnesDesDocuments = (liste) => {
  personnesDesDocuments = Array.isArray(liste) ? liste : [];
};
export const nomSurDocument = (nom, id) => nomSurDocumentDans(personnesDesDocuments, nom, id);
