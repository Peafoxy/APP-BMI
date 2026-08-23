// ============================================================
// lib/rebase.js — Reporter une modification d'écran sur l'état LE PLUS
// RÉCENT, au lieu de réécrire tout l'état par-dessus.
//
// ⚠ LE DÉFAUT QUE CE FICHIER CORRIGE (audit du 20/08/2026, priorité 2)
//
// Chaque écran reçoit `db` en propriété, puis enregistre en écrivant
// `save({ ...db, ventes: [...] })`. Entre le moment où l'écran a reçu son
// `db` et celui où l'enregistrement part, il peut s'écouler plusieurs
// secondes — le temps qu'une fenêtre « Confirmer ? » attende une réponse.
//
// Pendant ce temps, la synchronisation tourne. Si une vente arrive d'un
// autre appareil, elle entre dans l'état courant… mais PAS dans le `db`
// que l'écran garde en mémoire. En validant, l'écran renvoyait donc un
// état où cette vente n'existe pas. Et comme l'enregistrement compare
// l'état courant à celui qu'on lui donne, la vente manquante était lue
// comme une SUPPRESSION VOULUE : effacée localement, et l'ordre de
// suppression envoyé au serveur. La vente d'un collègue disparaissait
// partout, sans un mot.
//
// Le remède : ne plus faire confiance à l'état complet renvoyé par
// l'écran. On regarde ce que l'écran a VOULU changer — la différence
// entre l'état qu'il avait reçu et celui qu'il renvoie — et on applique
// seulement cela sur l'état courant. Tout ce que l'écran n'a pas touché
// reste tel qu'il est aujourd'hui, y compris ce qui vient d'arriver.
// ============================================================

const memeContenu = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

// base     : l'état que l'écran avait reçu (retrouvé par son numéro de version)
// modifie  : l'état que l'écran renvoie
// courant  : l'état réellement à jour
// tables   : les tables à examiner
//
// Renvoie un nouvel état : `courant`, sur lequel on a reporté les seules
// intentions de l'écran.
export function rebaser(base, modifie, courant, tables) {
  const sortie = { ...courant };
  for (const t of tables) {
    const avant = base?.[t] || [];
    const apres = modifie?.[t] || [];
    // L'application met à jour par recopie : une table que l'écran n'a pas
    // touchée garde EXACTEMENT le même tableau. Rien à reporter.
    if (avant === apres) continue;

    const parIdAvant = new Map(avant.map((r) => [r.id, r]));
    const parIdApres = new Map(apres.map((r) => [r.id, r]));

    // Ce que l'écran a ajouté ou modifié, dans son ordre d'affichage.
    const touches = [];
    for (const r of apres) {
      const a = parIdAvant.get(r.id);
      if (!a || !memeContenu(a, r)) touches.push(r);
    }
    // Ce que l'écran a VOLONTAIREMENT retiré : présent dans l'état qu'il
    // avait reçu, absent de celui qu'il renvoie. Une ligne arrivée entre
    // les deux n'est dans NI l'un NI l'autre — elle n'est donc jamais
    // prise pour une suppression. C'est tout l'objet de ce fichier.
    const supprimes = new Set();
    for (const id of parIdAvant.keys()) if (!parIdApres.has(id)) supprimes.add(id);

    if (touches.length === 0 && supprimes.size === 0) continue;

    const liste = courant?.[t] || [];
    const dejaLa = new Map(liste.map((r) => [r.id, r]));
    const modifies = new Map(touches.map((r) => [r.id, r]));
    // Les nouveautés de l'écran passent en tête — c'est là que les écrans
    // les placent (`[nouveau, ...db.ventes]`), et l'ordre porte du sens
    // (les listes sont affichées du plus récent au plus ancien).
    const nouvelles = touches.filter((r) => !dejaLa.has(r.id));
    const suite = liste
      .filter((r) => !supprimes.has(r.id))
      .map((r) => modifies.get(r.id) || r);
    sortie[t] = [...nouvelles, ...suite];
  }
  return sortie;
}
