// ============================================================
// components/carteFidelite.js — LES GESTES DE LA CARTE DE FIDÉLITÉ
// (Timo, 29/10/2026 : « F l'admin principal met tout en place », « 3 … le
// vendeur remet la carte imprimée au client… pas l'imprimer lui-même »).
// Écrits UNE fois pour 👥 Utilisateurs (un client à compte) et 📋 Clients
// (un client de comptoir, qui reçoit une fiche FERMÉE pour être enregistré).
// Règle pure : lib/carteFidelite.js. Revérifié DANS le geste : le principal.
// ============================================================
import { uAlert, uConfirm, uPrompt, uChoix } from "./ui";
import { today, fmt } from "../lib/core";
import { estAdminPrincipal, marqueEspace } from "../lib/calculs";
import { fabriquerCompteClient } from "../lib/comptesClients";
import { imprimerCarteFidelite } from "../lib/impression";
import {
  carteDe, prochainNumeroCarte, critiquePctCarte, critiqueGesteCarte, poserCarte, changerPctCarte, remplacerCarte, retirerCarte,
} from "../lib/carteFidelite";

const nomDe = (u) => [u.nom_base || u.nom, u.prenom].filter(Boolean).join(" ");
const remplacerFiche = (db, compte) => ({ ...db, users: (db.users || []).map((u) => (u.id === compte.id ? compte : u)) });

export async function gererCarteFidelite({ db, save, profile, compte }) {
  const refus = critiqueGesteCarte(profile, estAdminPrincipal(db, profile));
  if (refus) { uAlert(`🔒 ${refus}`); return; }
  const frais = (db.users || []).find((u) => u.id === compte.id) || compte;
  const carte = carteDe(frais);
  const nom = nomDe(frais);
  if (!carte) {
    const pct = await uPrompt(`💳 Carte de fidélité pour ${nom}.\n\nQuelle remise lui accorder sur ses achats (en %) ?\nElle s'appliquera toute seule quand le vendeur scannera la carte, même au-delà de la limite de remise ; fixe : le vendeur ne pourra ni la changer, ni ajouter une remise sur un article.`, "");
    if (pct === null) return;
    const r = critiquePctCarte(pct); if (r) { uAlert(r); return; }
    const numero = prochainNumeroCarte(db.users);
    const fiche = poserCarte(frais, { numero, pct, profile, aujourdhui: today() });
    save(remplacerFiche(db, fiche), `💳 Carte de fidélité ${numero} créée pour ${nom} (${fiche.fidelite.pct} %) par ${profile.nom}`);
    if (await uConfirm(`✅ Carte ${numero} créée pour ${nom} (${fiche.fidelite.pct} %).\n\nL'imprimer maintenant ? (format carte bancaire, 85,6 × 54 mm)`)) imprimerCarteFidelite(fiche);
    return;
  }
  const choix = await uChoix(`💳 Carte ${carte.numero} — ${nom}\nRemise : ${String(carte.pct).replace(".", ",")} % · posée le ${carte.le} par ${carte.par}`,
    ["🖨 Imprimer la carte", "✏️ Changer la remise", "🔁 Remplacer (carte perdue)", "🗑 Retirer la carte"]);
  if (choix === "🖨 Imprimer la carte") { imprimerCarteFidelite(frais); return; }
  if (choix === "✏️ Changer la remise") {
    const pct = await uPrompt(`Nouvelle remise de la carte ${carte.numero} (en %) — aujourd'hui ${carte.pct} % :`, String(carte.pct));
    if (pct === null) return;
    const r = critiquePctCarte(pct); if (r) { uAlert(r); return; }
    const fiche = changerPctCarte(frais, pct, profile, today());
    save(remplacerFiche(db, fiche), `💳 Carte ${carte.numero} de ${nom} : remise ${carte.pct} % → ${fiche.fidelite.pct} % (${profile.nom})`);
    uAlert("✅ Remise changée. La carte imprimée porte l'ancien pourcentage : réimprimez-la si vous voulez qu'elle dise le nouveau (le numéro ne change pas).");
    return;
  }
  if (choix === "🔁 Remplacer (carte perdue)" || choix === "🗑 Retirer la carte") {
    const remplace = choix.startsWith("🔁");
    const motif = await uPrompt(`${remplace ? "Remplacer" : "Retirer"} la carte ${carte.numero} de ${nom} ?\n\n${remplace ? "Une NOUVELLE carte (nouveau numéro, même remise) la remplace ; l'ancienne ne vaudra plus rien au scan." : "Le client n'aura plus de carte ; elle ne vaudra plus rien au scan."}\n\nMotif (obligatoire) :`, "");
    if (motif === null) return;
    if (!String(motif).trim()) { uAlert("Le motif est obligatoire."); return; }
    const numero = remplace ? prochainNumeroCarte(db.users) : null;
    const fiche = remplace
      ? remplacerCarte(frais, { numero, profile, aujourdhui: today(), motif })
      : retirerCarte(frais, { profile, aujourdhui: today(), motif });
    save(remplacerFiche(db, fiche), remplace
      ? `💳 Carte ${carte.numero} de ${nom} remplacée par ${numero} (${motif.trim()}) — ${profile.nom}`
      : `💳 Carte ${carte.numero} de ${nom} retirée (${motif.trim()}) — ${profile.nom}`);
    if (remplace && await uConfirm(`✅ Nouvelle carte ${numero}. L'imprimer maintenant ?`)) imprimerCarteFidelite(fiche);
  }
}

// 📋 Un client de COMPTOIR (« E : les deux… l'essentiel qu'on l'enregistre
// comme fidèle client ») : son compte s'il en a un, sinon une fiche FERMÉE
// (`sans_acces`, la règle du devis imprimé sans compte) — il ne se connecte
// jamais, il est enregistré. `comptesDuNumero` vient de l'écran (le mur).
export async function carteDepuisClientComptoir({ db, save, profile, client, comptesDuNumero, boutique }) {
  const refus = critiqueGesteCarte(profile, estAdminPrincipal(db, profile));
  if (refus) { uAlert(`🔒 ${refus}`); return; }
  if (!String(client.tel || "").replace(/\D/g, "")) { uAlert("Ce client n'a pas de numéro : une carte de fidélité ne s'attache qu'à un client qu'on peut retrouver par son numéro."); return; }
  const compte = (comptesDuNumero || []).find((u) => u.role === "client");
  if (compte) { await gererCarteFidelite({ db, save, profile, compte }); return; }
  if (!await uConfirm(`${client.nom} n'a pas de compte client.\n\nPour lui donner une carte, une fiche FERMÉE est créée : il ne se connecte pas à l'application, il est seulement enregistré comme client fidèle (ses achats${client.totalAchats ? `, ${fmt(client.totalAchats)} à ce jour,` : ""} restent rattachés à son numéro).\n\nContinuer ?`)) return;
  const fab = await fabriquerCompteClient(db, client.nom, client.tel, profile.nom, {
    ...marqueEspace(db, profile, boutique), sans_acces: true, sans_acces_le: today(), sans_acces_par: profile.nom,
  });
  const db2 = { ...db, users: [...(db.users || []), fab.user] };
  save(db2, `💳 Fiche fermée créée pour ${client.nom} (client fidèle de comptoir) — ${profile.nom}`);
  await gererCarteFidelite({ db: db2, save, profile, compte: fab.user });
}
