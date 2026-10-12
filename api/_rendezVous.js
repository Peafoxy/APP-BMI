// ============================================================
// api/_rendezVous.js — LES RAPPELS DES RENDEZ-VOUS (12/10/2026)
//
// Timo, « C 14h la veille et le jour même à 7h » : la tournée de 14 h
// (api/rappels-du-soir.js, appelée avec ?tournee=rendez-vous) rappelle ceux
// de DEMAIN, la tournée de 7 h (api/rappels-du-matin.js) ceux d'AUJOURD'HUI.
// La règle (qui reçoit quoi, le mur, le texte neutre d'un privé) vit dans
// src/lib/rendezVous.js ; ici on lit la table et on envoie. Rien n'est
// écrit dans la base (comme le rappel d'installation) ; un refus de WhatsApp
// part dans le journal Vercel.
// Le « _ » : ce fichier n'est PAS une fonction Vercel (douze au plus).
// ============================================================
import { rappelsRendezVous } from "../src/lib/rendezVous.js";
import { numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";
import { lireTable } from "./_tables.js";

// La table n'existe que quand Timo a collé supabase/rendez-vous-1-table.sql :
// d'ici là, aucun rappel — et les autres rappels de la tournée partent quand même.
export async function lireRendezVous(admin) {
  try { return await lireTable(admin, "rendez_vous"); }
  catch (e) { console.error("[rendez-vous] table illisible (script SQL pas encore collé ?)", e?.message || e); return []; }
}

// `db` porte users et boutiques (déjà lus par la tournée). Rend un bilan.
export async function rappelerLesRendezVous(admin, db, aujourdhui, quand) {
  const bilan = { a_envoyer: 0, envoyes: 0 };
  const liste = rappelsRendezVous({ ...db, rendez_vous: await lireRendezVous(admin) }, aujourdhui, quand);
  if (!liste.length) return bilan;
  const { cle, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  if (!cle || !expediteur) { console.error("[rendez-vous] WhatsApp non configuré sur le serveur"); return bilan; }
  for (const r of liste) {
    bilan.a_envoyer += 1;
    try {
      const envoi = await envoyerYCloud(cle, {
        from: expediteur, to: r.tel, type: "template",
        template: { name: r.envoi.modele, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: r.envoi.variables.map((text) => ({ type: "text", text })) }] },
      });
      if (!envoi.ok) { console.error("[rendez-vous] rappel refusé", envoi.code_whatsapp, envoi.motif); continue; }
      bilan.envoyes += 1;
    } catch (e) {
      console.error("[rendez-vous] rappel", e?.message || e);
    }
  }
  return bilan;
}
