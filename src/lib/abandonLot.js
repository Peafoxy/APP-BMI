// ============================================================
// lib/abandonLot.js — LE FILET : ABANDONNER UN GESTE QUE LE SERVEUR REFUSE
//
// Vague 3, étape 1 (04/09/2026). Les écritures d'un même geste partent en
// UN lot, tout ou rien. Quand le serveur en refuse une (règle de sécurité),
// le lot entier reste en attente — et, comme l'ordre des opérations sur un
// même enregistrement doit être préservé, tout ce qui touche ces
// enregistrements ensuite attend aussi. Avec les verrous de rôle qui
// arrivent, un appareil en retard de version ou un geste contourné peut
// coincer ainsi toute une journée de travail derrière lui.
//
// Ce module calcule, sans rien toucher, ce qu'« abandonner ce geste » veut
// dire : quelles opérations retirer de la file, et comment remettre la copie
// locale dans l'état d'AVANT le geste. Pur, rejoué par le banc ; c'est
// sync.js qui l'applique.
// ============================================================

const cleDe = (op) => `${op.table}:${op.id}`;

// ops   : la file d'attente, dans l'ordre (seq croissant) ;
// refus : { lot, cles } — le lot refusé et/ou les enregistrements visés.
// Retourne :
//   seqs          : les opérations à retirer de la file ;
//   restaurations : par enregistrement, l'état à remettre en local
//                   (base = la version d'avant le geste ; null = la ligne
//                   n'existait pas, on l'efface) ;
//   aRetelecharger: les tables dont il faut relire le serveur (une
//                   suppression locale n'a pas gardé la version d'avant).
export function planAbandon(ops, refus) {
  const cles = new Set(refus?.cles || []);
  for (const op of ops || []) {
    if (refus?.lot && op.lot === refus.lot) cles.add(cleDe(op));
  }
  // Tout ce qui touche ces enregistrements, dans l'ordre : le geste refusé
  // ET ce qui a été fait dessus après (qui attendait derrière lui).
  const touches = (ops || []).filter((op) => cles.has(cleDe(op))).sort((a, b) => a.seq - b.seq);
  const seqs = touches.map((op) => op.seq);
  const restaurations = [];
  const aRetelecharger = new Set();
  const vues = new Set();
  for (const op of touches) {
    const cle = cleDe(op);
    if (vues.has(cle)) continue; // seule la PREMIÈRE opération connaît l'état d'avant
    vues.add(cle);
    if (op.op === "upsert") {
      restaurations.push({ table: op.table, id: op.id, base: op.base || null });
    } else {
      // Une suppression locale n'a pas gardé la ligne : le serveur la rendra.
      aRetelecharger.add(op.table);
    }
  }
  return { seqs, restaurations, aRetelecharger: [...aRetelecharger], cles: [...cles] };
}

// Le texte montré avant de confirmer — nomme ce qui va être retiré.
export function resumeAbandon(refus, plan) {
  const nb = plan.seqs.length;
  const suites = nb - (plan.cles.length ? Math.min(nb, plan.cles.length) : 0);
  return `Abandonner le geste refusé par le serveur (${(refus?.tables || []).join(" + ") || "?"}) ?\n\n`
    + `Motif du serveur : ${refus?.motif || "—"}\n\n`
    + `${nb} opération(s) seront retirées de la file d'attente${suites > 0 ? ` (dont ${suites} faite(s) ensuite sur les mêmes enregistrements)` : ""}, `
    + `et cet appareil reviendra à l'état d'AVANT le geste. Le reste de la file partira normalement.\n\n`
    + `Ce qui a été refusé ne sera PAS enregistré — ni ici, ni au serveur.`;
}
