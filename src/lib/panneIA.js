// ============================================================
// lib/panneIA.js — QUAND LE SERVICE D'IA REFUSE DE RÉPONDRE, ON LE DIT À
// L'ADMINISTRATEUR PRINCIPAL (22/10/2026, « b, lance »).
//
// Le 21/10/2026 le crédit du compte Anthropic était épuisé : le service
// répondait « Your credit balance is too low… », l'assistant retombait sur
// le menu à chiffres ou sur « Pardon, je n'ai pas réussi… », et personne
// chez BMI ne le savait — c'est en lisant le journal Vercel qu'on l'a
// trouvé. Désormais une notification part au principal :
//   • seulement pour une panne qui demande SON geste : le CRÉDIT épuisé, ou
//     la CLÉ refusée (supprimée, mal recopiée dans Vercel). Une lenteur, une
//     surcharge passagère du service, une coupure de réseau ne préviennent
//     personne : elles passent toutes seules ;
//   • UNE FOIS PAR JOUR au plus, et par sorte de panne : la marque
//     `alerte_ia = { jour, motif, le }` sur SA fiche (le serveur l'écrit) ;
//   • elle ne change RIEN pour le client : le menu à chiffres et la phrase
//     de reprise répondent comme avant (décision « b », pas « a »).
//
// ⚠ Lu par le serveur tel quel : ce fichier n'importe RIEN.
// ============================================================

export const PANNES_IA = {
  credit: {
    titre: "⚠ Assistant IA en panne : crédit Anthropic épuisé",
    texte: "L'assistant WhatsApp répond par le menu à chiffres. Rechargez le crédit sur console.anthropic.com (Settings → Billing → Buy credits) : il reprend tout seul au message suivant.",
  },
  cle: {
    titre: "⚠ Assistant IA en panne : la clé du service est refusée",
    texte: "L'assistant WhatsApp répond par le menu à chiffres. La clé du service d'IA (réglage ANTHROPIC_API_KEY dans Vercel) est refusée : vérifiez-la ou créez-en une nouvelle sur console.anthropic.com.",
  },
};

// L'erreur levée par la porte réseau (api/_assistantIA.js : `message` = le
// motif du service, `statut` = le code HTTP). Rend "credit", "cle" ou null.
export function motifPanneIA(e) {
  const motif = String(e?.message || e || "");
  const statut = Number(e?.statut) || 0;
  if (/credit balance|purchase credits|billing/i.test(motif)) return "credit";
  if (statut === 401 || statut === 403 || /invalid x-api-key|authentication_error|api key/i.test(motif)) return "cle";
  return null;
}

// Faut-il prévenir aujourd'hui ? Pas si la fiche porte déjà la marque de ce
// jour pour cette sorte de panne.
export function alerteAEnvoyer(fiche, motif, jour) {
  if (!motif || !PANNES_IA[motif] || !jour) return false;
  const m = fiche?.alerte_ia;
  return !(m && m.jour === jour && m.motif === motif);
}

export const marqueAlerteIA = (motif, jour, le) => ({ jour, motif, le });

// La notification elle-même (la forme des envois de api/_push.js).
export function envoiPanneIA(principalId, motif) {
  const p = PANNES_IA[motif];
  if (!p || !principalId) return null;
  return { destinataires: [String(principalId)], titre: p.titre, texte: p.texte, ecran: "parametres", tag: `panne-ia-${motif}` };
}
