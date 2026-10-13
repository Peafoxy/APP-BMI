// ============================================================
// lib/pileRetour.js — la TOUCHE RETOUR d'Android (règle pure, sans import).
//
// Timo (13/10/2026) : « la touche retour de l'Android quitte l'application…
// pourquoi ça ne peut pas retourner les écrans de l'application en
// arrière ? » → « A a, B b, C a, lance ».
//   A a : d'abord ce qui est OUVERT par-dessus (conversation, panneau,
//         fenêtre), ensuite l'onglet d'avant ;
//   B b : au premier écran, retour ferme l'application, comme avant ;
//   C a : une fenêtre de question ouverte → retour = « Annuler ».
//
// Le téléphone tient une liste des pages visitées ; l'application n'y
// écrivait rien, donc le retour fermait tout. Chaque chose qui s'ouvre (un
// onglet quitté, une conversation, une fenêtre) pose UNE marque dans cette
// liste, et la pile ci-dessous dit, à chaque appui, CE QU'IL FAUT FERMER.
//
// ⚠ Une chose fermée par l'écran (bouton « ← », « Annuler », « Fermer »)
// laisse sa marque dans la liste du téléphone : on ne peut pas la retirer
// sans risque au moment même (un autre écran peut s'ouvrir dans le même
// geste). Elle devient MORTE ; on la retire plus tard (`compacter`) quand
// rien ne s'est ouvert entre-temps, sinon l'appui suivant la saute.
// ============================================================

export function creerPile() {
  let suivant = 1;
  const items = []; // { id, fermer, mort }
  return {
    // Une chose s'ouvre : rend son numéro.
    ouvrir(fermer) {
      const id = suivant++;
      items.push({ id, fermer, mort: false });
      return id;
    },
    // L'écran l'a fermée lui-même : la marque reste, mais elle est morte.
    fermeParEcran(id) {
      const it = items.find((i) => i.id === id);
      if (it) it.mort = true;
    },
    // Retire les marques mortes du DESSUS : rend combien de pas reculer
    // (sans rien fermer) pour les effacer de la liste du téléphone.
    compacter() {
      let n = 0;
      while (items.length && items[items.length - 1].mort) { items.pop(); n++; }
      return n;
    },
    // Un appui sur retour (une marque déjà consommée par le téléphone) :
    // `fermer` = ce qu'il faut fermer (null : rien de vivant, le prochain
    // appui quittera) ; `reculer` = pas supplémentaires, sans rien fermer,
    // pour sauter les marques mortes qui se trouvaient dessous.
    retour() {
      const top = items.pop();
      if (!top) return { fermer: null, reculer: 0 };
      if (!top.mort) return { fermer: top.fermer, reculer: 0 };
      let reculer = 0;
      while (items.length && items[items.length - 1].mort) { items.pop(); reculer++; }
      const vivant = items.pop();
      if (!vivant) return { fermer: null, reculer };
      return { fermer: vivant.fermer, reculer: reculer + 1 };
    },
    // Déconnexion : plus rien de ce qui est ouvert n'a de sens.
    vider() { items.forEach((i) => { i.mort = true; }); },
    vivants() { return items.filter((i) => !i.mort).length; },
    taille() { return items.length; },
  };
}
