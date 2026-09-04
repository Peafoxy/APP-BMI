// ============================================================
// lib/validationDevis.js — LA VALIDATION D'UN DEVIS, EN UN SEUL ENDROIT
//
// Un devis validé devient : une commande à encaisser en boutique (cas
// normal) ou, pour une « pose seule », un chantier et une dette créés tout
// de suite. Cette règle vivait dans l'espace client (EspaceClient.jsx). Depuis
// le 04/09/2026 elle sert AUSSI au vendeur qui fait signer le client en
// boutique (« ✍️ Faire signer ici » / « 📝 Signé sur papier », demande Timo :
// « un client qui ne passe pas par l'app et veut signer le contrat »).
// Deux écrans, UNE règle : ce module est pur, et le banc la rejoue.
// ============================================================
import { uid, today, fmt, prochainNumeroDette } from "./core";
import { PAIEMENTS, TYPES_INSTALLATION } from "./constants";
import { assurerBoutiqueTerrain, NOM_BOUTIQUE_TERRAIN, NOM_BOUTIQUE_TERRAIN_FORMATION, estCompteFormation } from "./calculs";

export const numeroContrat = () => `CTR-${new Date().getFullYear()}-${uid().slice(0, 8).toUpperCase()}`;

// Le devis d'un client, tel qu'il est rangé dans SA fiche.
export const trouverDevis = (db, clientId, devisId) => {
  const client = (db.users || []).find((u) => u.id === clientId) || null;
  const devis = client ? (client.devis || []).find((x) => x.id === devisId) || null : null;
  return { client, devis };
};

const majDevis = (db, clientId, devisId, champs) => db.users.map((u) => (u.id === clientId
  ? { ...u, devis: (u.devis || []).map((x) => (x.id === devisId ? { ...x, ...champs } : x)) }
  : u));

// Valide un devis. Retourne { db, journal } ou { erreur }.
//   clientId, devisId : le devis, dans la fiche du client ;
//   boutique          : où le client viendra payer (ignoré pour une pose seule) ;
//   infosContrat      : numéro, signature, date, plan de règlement… posés
//                       tels quels sur le devis ;
//   acteur            : { nom, estClient } — qui pose le geste (journal, dette) ;
//   mention           : texte ajouté au journal (ex. « signé en boutique… »).
export function validerDevis(db, { clientId, devisId, boutique, infosContrat = {}, acteur, mention = "" }) {
  const { client, devis: d } = trouverDevis(db, clientId, devisId);
  if (!client || !d) return { erreur: "Ce devis n'existe plus." };
  if (d.statut === "valide" || d.statut === "paye") return { erreur: "Ce devis est déjà validé." };
  const nomClient = client.nom_base || client.nom || "Client";
  const qui = `${acteur?.estClient ? "le client " : ""}${acteur?.nom || nomClient}`;

  // ⚠ « Pose seule » (demande Timo) : le client a déjà le matériel, rien à
  // payer avant travaux — pas de boutique à choisir, pas de commande. Le
  // chantier se crée DIRECTEMENT à la signature ; le règlement (technicien
  // sur le terrain le plus souvent) se fait ensuite, comme une dette
  // classique, dans la caisse « TERRAIN » — celle d'ENTRAÎNEMENT pour un
  // client de formation, jamais la réelle.
  if (d.pose_seule) {
    const enFormation = estCompteFormation(db, client);
    const caisseTerrain = enFormation ? NOM_BOUTIQUE_TERRAIN_FORMATION : NOM_BOUTIQUE_TERRAIN;
    const dbT = assurerBoutiqueTerrain(db, enFormation);
    const dette = {
      // Vague 2, étape 1 : le propriétaire est certain, aucun rapprochement.
      id: uid(), client_user_id: client.id, numero: prochainNumeroDette(dbT, caisseTerrain), date: today(),
      boutique: caisseTerrain, client: nomClient, tel: client.tel || "",
      motif: `Prestation de pose${infosContrat?.contrat_numero ? ` — contrat ${infosContrat.contrat_numero}` : ""}`,
      montant: d.total, paye: 0, paiements: [], par: acteur?.nom || nomClient,
    };
    const chantier = {
      id: uid(), date: today(),
      nom: nomClient, prenom: "", tel: client.tel || "",
      user_id: client.id,
      type_installation: TYPES_INSTALLATION[0],
      date_installation: "", date_entretien: "", localisation: "", lat: null, lng: null,
      vente_id: null, devis_id: d.id, pose_seule: true, dette_id: dette.id,
      garantie_mois: 24, equipe: [],
      materiel: (d.lignes || d.panier || []).map((l) => ({ nom: l.article, qte: l.qte, serie: "" })),
      frais_installation: d.total,
      statut: "en_cours",
      adresse_contrat: "",
    };
    return {
      db: {
        ...dbT,
        dettes: [dette, ...(dbT.dettes || [])],
        clients_installes: [chantier, ...(dbT.clients_installes || [])],
        users: majDevis(dbT, client.id, d.id, { statut: "valide", valide_le: today(), ...infosContrat }),
      },
      journal: `Devis pose seule ${fmt(d.total)} VALIDÉ par ${qui}${mention} — chantier créé directement, sans passage en boutique`,
      dette, chantier,
    };
  }

  if (!boutique) return { erreur: "Choisissez d'abord la boutique où le client ira payer." };
  const infosBoutique = (db.boutiques || []).find((b) => b.nom === boutique);
  if (!infosBoutique) return { erreur: `La boutique « ${boutique} » n'existe pas.` };

  // La commande part chez les vendeurs — exactement comme une commande
  // commerciale. SEULS un commercial ou un technicien (commission) sont
  // commissionnés : un devis fait par un salarié n'en génère aucune.
  const commande = {
    id: uid(),
    date: today(),
    commercial: (d.par_role === "commercial" || d.par_role === "technicien") ? d.par : null,
    responsable: null,
    rabais: 0,
    boutique,
    vendeur_cible: null,
    articles: d.panier || [],
    client: nomClient,
    tel: client.tel || "",
    remise: d.remise || 0,
    remise_pct: d.pct_remise || 0,
    paiement: PAIEMENTS[0],
    statut: "en_attente",
    // Le lien avec le devis : c'est ce qui permettra de créer la fiche
    // d'installation au moment de l'encaissement.
    origine_devis: { client_id: client.id, devis_id: d.id, par_id: d.par_id, par_role: d.par_role },
  };

  // Le prospect correspondant porte un badge « a dit oui, pas encore payé » :
  // c'est LA file à relancer. ⚠ SEULES les fiches déjà MARQUÉES à son nom
  // (client_user_id) — le serveur refuse qu'un client touche une fiche
  // prospect sans son étiquette (fermeture de l'annuaire, client-1).
  const prospectsMaj = (db.prospects || []).map((pr) => (
    pr.client_user_id === client.id && !pr.converti
      ? { ...pr, devis_valide: true, devis_total: d.total, devis_boutique: boutique, devis_valide_le: today(), maj_le: today() }
      : pr));

  return {
    db: {
      ...db,
      commandes: [commande, ...(db.commandes || [])],
      prospects: prospectsMaj,
      users: majDevis(db, client.id, d.id, {
        statut: "valide", boutique_paiement: boutique,
        boutique_adresse: infosBoutique.adresse || "", boutique_tel: infosBoutique.tel || "",
        boutique_lat: infosBoutique.lat || null, boutique_lng: infosBoutique.lng || null,
        valide_le: today(), commande_id: commande.id, ...infosContrat,
      }),
    },
    journal: `Devis ${fmt(d.total)} VALIDÉ par ${qui}${mention} — paiement prévu à ${boutique}`,
    commande, infosBoutique,
  };
}
