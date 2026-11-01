// ✍️ QUI A ÉCRIT CE MESSAGE, DEPUIS QUEL APPAREIL (01/11/2026, « A, lance »).
//
// Depuis securite-47, la base n'envoie un message interne qu'à ses lecteurs
// (les deux personnes d'une conversation privée, les membres d'un groupe, le
// destinataire d'un message automatique). Or un appareil écrit aussi des
// messages qui ne sont ni « de » lui ni « pour » lui : une vendeuse qui
// enregistre une grosse dépense écrit le message automatique à
// l'administrateur. Sans cette marque, la base lui refuserait de le relire —
// donc de l'écrire — et tout son envoi resterait coincé (la leçon du
// 27/10/2026, lignes WhatsApp).
//
// `ecrit_par` = l'identifiant du compte connecté au moment où le message
// NAÎT. Il ne change jamais ensuite (un destinataire qui marque « lu » ne le
// réécrit pas). Ce fichier n'importe rien.

const estObjet = (m) => m && typeof m === "object";

// Les messages NOUVEAUX de `next` (absents de `prev`) reçoivent la marque.
// Rend `next` tel quel s'il n'y a rien à marquer (même objet : aucun rendu
// de plus).
export function signerNouveauxMessages(prev, next, moi) {
  if (!moi || !next || !Array.isArray(next.messages)) return next;
  const avant = new Set(((prev && prev.messages) || []).filter(estObjet).map((m) => m.id));
  let change = false;
  const messages = next.messages.map((m) => {
    if (!estObjet(m) || avant.has(m.id) || m.ecrit_par) return m;
    change = true;
    return { ...m, ecrit_par: String(moi) };
  });
  return change ? { ...next, messages } : next;
}

// Les messages déjà dans la FILE D'ENVOI (écrits avant cette version, pas
// encore partis) : une création sans marque la reçoit — le compte connecté
// est celui qui les a écrits sur cet appareil. Une mise à jour d'un message
// existant (lu_par…) ne reçoit rien : elle ne dit pas qui l'a écrit.
export function messagesASigner(ops, moi) {
  if (!moi) return [];
  const out = [];
  for (const op of ops || []) {
    if (!op || op.op !== "upsert" || op.table !== "messages" || op.base) continue;
    if (!estObjet(op.data) || op.data.ecrit_par) continue;
    out.push({ seq: op.seq, data: { ...op.data, ecrit_par: String(moi) } });
  }
  return out;
}
