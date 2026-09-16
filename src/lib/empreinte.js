// ============================================================
// lib/empreinte.js — L'EMPREINTE QUI OUVRE LE VERROU (Timo, 16/09/2026)
//
// « Sur téléphone, est-il possible d'ajouter l'authentification par
// empreinte digitale ? » — puis, après la description : « Lance le niveau 1
// sur le verrou ».
//
// ⚠ CE QUE C'EST, ET CE QUE CE N'EST PAS. Dit à Timo mot pour mot, et
// répété ici pour que personne ne s'y trompe plus tard :
//
//   • L'application ne LIT JAMAIS une empreinte. Elle ne la voit pas, ne la
//     compare pas, ne la garde pas. C'est le TÉLÉPHONE qui compare, avec
//     l'empreinte qu'il connaît déjà, et qui répond oui ou non.
//   • Ce qui est rangé sur la fiche de la personne n'est PAS une empreinte :
//     c'est une clé (un numéro) fabriquée par le téléphone à l'activation.
//     Rien du doigt n'entre ici.
//   • NIVEAU 1 : la réponse du téléphone est crue SUR PAROLE, sans
//     vérification par notre serveur. C'est donc une COMMODITÉ, pas un
//     verrou. Ne jamais écrire « sécurisé » à son sujet. Le niveau 2
//     (signature vérifiée côté Vercel) réutilisera cette mécanique telle
//     quelle, en ajoutant la vérification.
//   • Un téléphone dit oui à TOUTES les empreintes qu'il connaît : on ne
//     peut pas savoir de quel doigt il s'agit. Règle à l'équipe : le
//     téléphone de travail ne porte que votre doigt.
//
// ⚠ L'EMPREINTE N'OUVRE QUE LE VERROU D'INACTIVITÉ. Les deux autres motifs
// gardent le mot de passe, et ce n'est pas un oubli :
//   • 30 minutes sans geste → la session est FINIE. Le mot de passe ne la
//     ressuscite pas (règle du 11/09/2026), l'empreinte non plus.
//   • Session sécurisée tombée → le mot de passe ne sert pas qu'à
//     reconnaître la personne, il ROUVRE la session auprès du serveur
//     (synchroniserAuth). Une empreinte ne peut pas le remplacer.
//
// Module PUR, sans aucun import : aucune touche au navigateur ici — elles
// vivent toutes dans src/empreinte.js, comme les notifications vivent
// toutes dans src/push.js.
// ============================================================

// Le seul motif de verrou que l'empreinte ouvre.
export const MOTIF_INACTIVITE = "inactivite";

// La porte : le motif doit être l'inactivité, et la session sécurisée doit
// tenir. Une seule règle, lue par l'écran ET par le geste de déverrouillage.
export const empreinteOuvreCeVerrou = (motif, sessionPerdue = false) =>
  motif === MOTIF_INACTIVITE && !sessionPerdue;

// ---- Les clés rangées sur la fiche d'une personne ----
// Une par appareil : son téléphone, la tablette de la boutique… Elles
// suivent la personne comme ses brouillons de devis et l'ordre de ses
// onglets — rien à coller dans Supabase, la fiche accepte déjà un champ
// personnel.
export const empreintesDe = (u) => (Array.isArray(u?.empreintes) ? u.empreintes.filter(Boolean) : []);

export const empreinteDeLAppareil = (u, appareil) =>
  (appareil ? empreintesDe(u).find((e) => e.appareil === appareil) : null) || null;

export const empreinteActive = (u, appareil) => !!empreinteDeLAppareil(u, appareil);

export const poserEmpreinte = (u, { appareil, cle, nom = "", le = "" }) => {
  if (!appareil || !cle) return u;
  return { ...u, empreintes: [...empreintesDe(u).filter((e) => e.appareil !== appareil), { appareil, cle, nom, le }] };
};

export const retirerEmpreinte = (u, appareil) => ({
  ...u, empreintes: empreintesDe(u).filter((e) => e.appareil !== appareil),
});

// ---- POURQUOI ÇA N'A PAS MARCHÉ ----
// ⚠ 16/09/2026, Timo : « je pense que le fonctionnement n'a pas réussi ».
// La PREMIÈRE version avalait toutes les erreurs (`catch { return "" }`) :
// rien ne se passait, et personne — lui comme moi — ne pouvait savoir
// pourquoi. C'est exactement le piège du dépôt : « une écriture refusée
// doit afficher son motif ». Le capteur dit TOUJOURS pourquoi, en un nom ;
// on le traduit ici, une fois, et l'écran l'affiche.
export const MOTIF_EMPREINTE = {
  // Le plus fréquent, et il recouvre plusieurs cas : annulation, délai
  // dépassé, aucune empreinte connue — et surtout LE GESTE PERDU (voir
  // src/empreinte.js : le capteur exige un clic encore « chaud »).
  NotAllowedError: "Annulé, ou le téléphone n'a pas reconnu le doigt. Réessayez, ou entrez votre mot de passe.",
  InvalidStateError: "L'empreinte est déjà enregistrée sur cet appareil.",
  NotSupportedError: "Ce téléphone ne sait pas faire d'empreinte pour un site.",
  SecurityError: "Le téléphone refuse : l'adresse du site n'est pas celle attendue.",
  AbortError: "Demande interrompue. Réessayez.",
  ConstraintError: "Le téléphone n'a pas pu créer la clé (aucun écran de verrouillage réglé ?).",
  UnknownError: "Le téléphone n'a pas pu répondre. Réessayez.",
  indisponible: "Ce téléphone n'a pas d'empreinte configurée.",
  sansMotDePasse: "Entrez d'abord votre mot de passe, puis touchez le capteur.",
};
export const motifEmpreinte = (nom) => MOTIF_EMPREINTE[nom] || "L'empreinte n'a pas fonctionné. Entrez votre mot de passe.";

// Un nom lisible pour l'appareil, pour que la personne reconnaisse sa
// ligne dans la liste (« Android · Chrome »). Jamais un identifiant.
export const nomAppareil = (ua) => {
  const s = String(ua || "");
  const systeme = /iPhone|iPad|iPod/i.test(s) ? "iPhone" : /Android/i.test(s) ? "Android"
    : /Windows/i.test(s) ? "Windows" : /Mac/i.test(s) ? "Mac" : "Appareil";
  const nav = /Edg\//i.test(s) ? "Edge" : /Chrome\//i.test(s) ? "Chrome"
    : /Firefox\//i.test(s) ? "Firefox" : /Safari\//i.test(s) ? "Safari" : "";
  return nav ? `${systeme} · ${nav}` : systeme;
};
