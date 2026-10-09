// ============================================================
// components/verserOrigine.js — 💸 VERSER UNE VENTE OU UN RÈGLEMENT (09/10/2026)
//
// Écrit UNE fois pour les deux endroits où l'argent d'une vente se remet au
// DG (ou à la BANQUE, ou au comptable) : la ligne d'une vente payée dans
// 💰 Ventes, et chaque règlement d'une dette dans 📋 Dettes (Timo : « souvent
// ce sont les ventes à crédit… il part et ensuite remet l'argent au DG »).
// Gérant + administrateur seulement (« on garde l'ancienne règle »), revérifié
// DANS le geste ; la somme sort du tiroir TOUT DE SUITE (« 2 tout de suite »)
// et revient si le DG la rejette. Les règles vivent dans lib/versements.js.
// ============================================================
import { fmt } from "../lib/core";
import { uAlert, uConfirm, uPrompt, uChoix } from "./ui";
import { bloquerSiLecture, refuserSaufRoles, libelleCaisse } from "../lib/calculs";
import { mobileParMoyen } from "../lib/constants";
import { banquesReglees } from "../lib/banques";
import { ROLES_VERSEMENT, DEST_BANQUE, DEST_COMPTABLE, DEST_DG, destinationsPour, critiqueVersementOrigine, construireVersementOrigine, messagesVersement, libelleDestination, ORIGINE_VENTE, SOURCE_ESPECES } from "../lib/versements";

const AUTRE_BANQUE = "✏️ Autre banque…";

// LA question « à qui l'argent est-il remis ? », écrite UNE fois (09/10/2026) :
// le bouton 💸 et le paiement d'une dette (📋 Dettes, « Où va l'argent ? »)
// la posent pareil. `caisse` : le libellé d'un PREMIER choix qui garde
// l'argent dans la caisse qui l'a reçu (rendu { caisse: true }).
// Rend { destination, banque, bordereau }, { caisse: true }, ou null.
export async function choisirDestination(db, { titre, boutique, caisse = "" }) {
  // La caisse « Chez le comptable » est réelle : une caisse de formation ne la voit pas.
  const enFormation = !!(db.boutiques || []).find((b) => b.nom === boutique)?.formation;
  const libelles = { [DEST_DG]: caisse ? "Remis directement au DG" : DEST_DG };
  const dests = destinationsPour(enFormation);
  const reponse = await uChoix(titre, [...(caisse ? [caisse] : []), ...dests.map((d) => libelles[d] || d)]);
  if (!reponse) return null;
  if (caisse && reponse === caisse) return { caisse: true };
  const destination = dests.find((d) => (libelles[d] || d) === reponse);
  if (!destination) return null;
  let banque = "", bordereau = "";
  if (destination === DEST_BANQUE) {
    const liste = banquesReglees(db);
    if (liste.length) {
      const choix = await uChoix("Quelle banque ?", [...liste, AUTRE_BANQUE]);
      if (!choix) return null;
      banque = choix === AUTRE_BANQUE ? (await uPrompt("Nom de la banque :", "")) : choix;
    } else banque = await uPrompt("Nom de la banque :", "");
    if (banque === null) return null;
    bordereau = await uPrompt("Numéro du bordereau de versement :", "");
    if (bordereau === null) return null;
  }
  return { destination, banque, bordereau };
}

// origine : { type, vente_id | reglement, dette_id?, numero, client }
// boutique : la CAISSE qui a reçu l'argent (caisseDeVente / la dette).
// Rend true si le versement est enregistré.
export async function verserDepuisOrigine({ db, save, profile, origine, boutique, montant, source = SOURCE_ESPECES }) {
  if (refuserSaufRoles(profile, ROLES_VERSEMENT, "Verser les fonds")) return false;
  if (bloquerSiLecture(db, profile)) return false;
  const refus = critiqueVersementOrigine(db, { origine, montant, source });
  if (refus) { uAlert(refus); return false; }
  const quoi = origine.type === ORIGINE_VENTE
    ? `la vente ${origine.numero || ""}${origine.client ? ` (${origine.client})` : ""}`
    : `le règlement de ${origine.client || "la dette"}${origine.numero ? ` (${origine.numero})` : ""}`;
  const choix = await choisirDestination(db, { titre: `💸 Verser ${fmt(Number(montant))} — ${quoi.replace(/\s+/g, " ")}.\n\nÀ qui l'argent est-il remis ?`, boutique });
  if (!choix) return false;
  const { destination, banque, bordereau } = choix;
  const r = construireVersementOrigine(profile, db, { origine, boutique, montant, source, destination, banque, bordereau });
  if (r.refus) { uAlert(r.refus); return false; }
  const mobile = mobileParMoyen(source);
  const depuis = mobile ? `du compte ${mobile.court} de ${libelleCaisse(boutique)}` : `du tiroir de ${libelleCaisse(boutique)}`;
  const jury = destination === DEST_COMPTABLE ? "le comptable" : "le DG";
  if (!await uConfirm(`Verser ${fmt(Number(montant))} — ${quoi.replace(/\s+/g, " ")} → ${libelleDestination(r.versement)} ?\n\nL'argent sort tout de suite ${depuis}. Il reste « en attente » jusqu'à la validation par ${jury} ; s'il est rejeté, il revient dans la caisse.\n\nCette remise ne pose pas de bande noire dans 💰 Ventes.`)) return false;
  save({
    ...db,
    depenses: [r.sortie, ...(r.entree ? [r.entree] : []), ...(db.depenses || [])],
    messages: [...messagesVersement(db, profile, r.sortie), ...(db.messages || [])],
  }, `Versement de fonds ${fmt(Number(montant))} : ${quoi.replace(/\s+/g, " ")} — ${libelleCaisse(boutique)} → ${libelleDestination(r.versement)} (par ${profile.nom})`);
  uAlert(`Versement enregistré — en attente de validation par ${jury}.`);
  return true;
}
