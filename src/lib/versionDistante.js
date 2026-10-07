// ============================================================
// lib/versionDistante.js — QUAND UN APPAREIL REPREND LA VERSION DU SERVEUR
//
// Capture Timo (07/10/2026) : la facture BMID-2026-0043 de SENA porte trois
// articles repris sur le serveur (relu dans Supabase), et son téléphone ne les
// montrait pas — ni « ↩ 3 repris », ni la situation sous le total.
//
// ⚠ LA CAUSE : DEUX HORLOGES COMPARÉES. Le serveur pose sa propre heure dans
// la colonne `updated_at` (déclencheur horodatage_serveur) ; le champ
// `data.updated_at` garde l'heure de L'APPAREIL qui a écrit. La lecture
// comparait la copie locale (alignée sur l'heure du SERVEUR après chaque envoi)
// à `data.updated_at` (l'heure de l'appareil qui a fait la reprise) : un
// appareil dont la montre retarde écrivait des versions qui paraissaient
// « plus anciennes » — et personne ne les reprenait. Jamais.
//
// LA RÈGLE, sans aucune heure d'appareil :
//   • une modification LOCALE pas encore partie (elle est dans la file
//     d'envoi) → on garde la copie locale : l'envoi la fusionnera ;
//   • sinon, dès que la version du serveur DIFFÈRE de celle qu'on a, on la
//     prend — le serveur est la seule horloge qui vaille.
// La copie rangée porte l'heure du SERVEUR (`horodatee`), pour que la
// prochaine comparaison, et la version de départ d'un envoi, parlent la même
// langue que lui.
//
// Pure, sans import : le banc l'exerce telle quelle.
// ============================================================

// L'heure qui fait foi pour une ligne lue sur le serveur : sa colonne.
export const versionServeur = (ligne) => String(ligne?.updated_at || ligne?.data?.updated_at || "");

// Faut-il remplacer la copie locale par la ligne du serveur ?
export function prendreVersionServeur(local, ligne, enAttente = false) {
  if (!ligne?.data) return false;
  if (!local) return true;
  if (enAttente) return false;
  return String(local.updated_at || "") !== versionServeur(ligne);
}

// La fiche à ranger : les données du serveur, horodatées par le serveur.
export const horodatee = (ligne) => ({ ...ligne.data, updated_at: versionServeur(ligne) });

// La relecture complète qui rattrape ce que l'ancienne règle a laissé passer :
// faite UNE fois par appareil (marque dans la base locale).
export const CLE_RELECTURE_HORLOGE = "relecture_horloge_2026_10_07";
