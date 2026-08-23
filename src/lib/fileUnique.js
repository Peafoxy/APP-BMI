// ============================================================
// lib/fileUnique.js — « Une seule à la fois, mais aucune perdue »
//
// ⚠ LE DÉFAUT QUE CECI CORRIGE (signalé par Timo, 20/08/2026 :
// « l'envoi des écritures prend souvent du temps »)
//
// La synchronisation refuse de tourner deux fois en même temps — et c'est
// nécessaire : deux cycles concurrents se marcheraient dessus. Mais la
// demande refusée était purement ABANDONNÉE, sans laisser de trace.
//
// Conséquence concrète : une vente enregistrée pendant qu'un cycle tournait
// voyait son envoi immédiat disparaître, et attendait le rappel suivant —
// jusqu'à vingt secondes de plus. D'où l'impression, juste, que « ça met du
// temps à partir ».
//
// Ce verrou fait la même chose, à une différence près : il SE SOUVIENT
// qu'on a demandé pendant qu'il était pris, et le dit à celui qui le
// relâche, pour qu'il reparte aussitôt.
//
// ⚠ Seules les demandes URGENTES sont mémorisées. Le rappel automatique des
// vingt secondes, lui, ne l'est pas : sur une connexion lente un cycle peut
// durer plus longtemps que l'intervalle, et mémoriser ces rappels-là
// enchaînerait les synchronisations sans jamais laisser souffler le réseau.
// ============================================================

export const creerVerrou = () => {
  let pris = false;
  let redemande = false;
  return {
    // Renvoie true si l'appelant peut travailler, false s'il doit renoncer.
    prendre(urgent = false) {
      if (pris) {
        if (urgent) redemande = true;
        return false;
      }
      pris = true;
      return true;
    },
    // Libère le verrou et renvoie true si quelqu'un a demandé entre-temps.
    relacher() {
      pris = false;
      const attendait = redemande;
      redemande = false;
      return attendait;
    },
    // Pour les vérifications automatiques uniquement.
    estPris: () => pris,
  };
};
