// ============================================================
// lib/motInformation.js — LE MOT D'INFORMATION, À LA PREMIÈRE OUVERTURE
//
// POURQUOI (Timo, 19/09/2026) : « le mot d'information à l'embauche pour le
// personnel, et même chose pour les clients la 1re fois qu'il accède à
// l'app… **mais faire en sorte que le message ne mette pas mal à l'aise le
// client ni le personnel** ».
//
// ⚠⚠ CETTE DERNIÈRE PHRASE EST LA RÈGLE, pas une préférence. Un texte de
// protection des données rate sa cible de trois façons, et toutes les trois
// mettent mal à l'aise :
//   • le JARGON (« traitement de données à caractère personnel »,
//     « responsable de traitement ») : on ne comprend pas, donc on s'inquiète ;
//   • la LONGUEUR : un mur de texte avec un bouton « J'accepte » ressemble à
//     un contrat qu'on vous fait signer à la sauvette ;
//   • le TON : « nous enregistrons vos activités » se lit comme une
//     surveillance, même quand c'est faux.
//
// DONC, quatre décisions tenues par le banc :
//   1. **On dit d'abord ce qu'on NE fait PAS.** C'est ça qui rassure — pas la
//      liste de ce qu'on garde.
//   2. **« J'ai compris », jamais « J'accepte ».** On INFORME ; le droit de
//      traiter ces données vient du contrat et du contrat de travail, pas
//      d'une case cochée. Demander un consentement qu'on n'a pas besoin de
//      demander, c'est faire croire qu'on pourrait le refuser.
//   3. **Aucun mot de jargon, aucun ⚠, aucun rouge.** Le mot de la loi tient
//      en une ligne discrète en bas, pas en titre.
//   4. **Une seule fois, et c'est fini.** Revoir le même avertissement à
//      chaque ouverture est précisément ce qui agace.
//
// ⚠ Mais **on ne rassure pas à tort** : « sauf si la loi nous y oblige »
// reste écrit, et on ne promet PAS que les collègues ne voient rien du tout
// — seulement que la rémunération et les déclarations sociales leur sont
// fermées, ce qui est exactement vrai depuis le 19/09/2026.
//
// Ce fichier est PUR : aucune importation.
// ============================================================

// Le jour où la personne a lu le mot. Champ nouveau, dans AUCUNE liste
// protégée du serveur (`users_regles_comptes`) : chacun peut l'écrire sur sa
// propre fiche — **rien à coller**.
export const CHAMP_VU = "info_donnees_le";

// ⚠ FILET POUR LES COMPTES EN LECTURE SEULE (le comptable, ou un compte
// privé d'écriture) : leur `save()` ne persiste rien, donc la fiche ne
// garderait jamais la marque et le mot reviendrait À CHAQUE OUVERTURE —
// exactement ce que Timo veut éviter. On note donc AUSSI dans le navigateur.
export const CLE_VU_ICI = "bmi_mot_donnees_vu";

export const motAMontrer = (fiche, vuIci = false) =>
  !!fiche && !!fiche.id && !fiche[CHAMP_VU] && !vuIci;

// La marque sur la fiche. Aucune ligne de journal (comme `ordre_onglets`) :
// lire un mot d'information n'est pas un geste de gestion.
export const marquerMotLu = (db, id, quand) => ({
  ...db,
  users: (db?.users || []).map((u) => (u.id === id ? { ...u, [CHAMP_VU]: quand } : u)),
});

// ---------------------------------------------------------------
// LE MOT DU CLIENT
// ---------------------------------------------------------------
export const MOT_CLIENT = {
  titre: "Bienvenue dans votre espace",
  intro: "Un mot rapide sur vos informations. Vous n'avez rien à faire — c'est juste pour que vous sachiez.",
  blocs: [
    {
      icone: "🙅",
      titre: "Ce que nous ne faisons pas",
      texte: "Nous ne vendons vos informations à personne. Nous ne les transmettons à personne sans votre accord — sauf si la loi nous y oblige.",
    },
    {
      icone: "📇",
      titre: "Ce que nous gardons",
      texte: "Votre nom, votre numéro, et ce que vous achetez chez nous. C'est ce qu'il faut pour établir vos devis, vos reçus et vos contrats, et pour assurer le suivi après votre installation. Nous les gardons {duree} ans après votre dernier achat, puis nous les effaçons.",
    },
    {
      icone: "🔑",
      titre: "Votre mot de passe",
      texte: "Il n'est écrit en clair nulle part, pas même chez nous. Personne chez BMI ne peut le lire.",
    },
    {
      icone: "👀",
      titre: "Si vous voulez tout voir",
      texte: "Descendez jusqu'à « Vos données personnelles », en bas de votre espace : vous pouvez tout télécharger, et demander une correction quand vous voulez.",
    },
  ],
  pied: "BMI Togo, conformément à la loi n° 2019-014.",
  bouton: "J'ai compris",
};

// ---------------------------------------------------------------
// LE MOT DE L'EMPLOYÉ
// ---------------------------------------------------------------
// ⚠ « Il n'y a rien à signer » est là exprès : à l'embauche, un écran qui
// parle de vos données ressemble à un papier de plus à parapher.
export const MOT_EMPLOYE = {
  titre: "Bienvenue chez BMI",
  intro: "Un mot rapide sur vos informations. C'est court, et il n'y a rien à signer.",
  blocs: [
    {
      icone: "🙅",
      titre: "Ce que BMI ne fait pas",
      texte: "Vos informations ne sortent pas de l'entreprise. Elles ne sont transmises à personne sans votre accord — sauf ce que la loi impose de déclarer, comme la CNSS.",
    },
    {
      icone: "📇",
      titre: "Ce que BMI garde",
      texte: "Votre identité, votre rémunération, vos déclarations sociales et votre banque. C'est ce que la loi demande à tout employeur pour vous employer et vous payer.",
    },
    {
      icone: "🔒",
      titre: "Qui peut le voir",
      texte: "Votre rémunération et vos déclarations sociales ne sont visibles que par la direction et le comptable : vos collègues n'y ont pas accès. Votre mot de passe n'est écrit en clair nulle part, et votre numéro de compte n'apparaît qu'avec ses quatre derniers chiffres.",
    },
    {
      icone: "👀",
      titre: "Si vous voulez tout voir",
      texte: "Demandez-le à la direction : elle vous remet le détail de tout ce que l'application conserve à votre sujet, et corrige ce qui serait faux.",
    },
  ],
  pied: "BMI Togo, conformément à la loi n° 2019-014.",
  bouton: "J'ai compris",
};

// ⚠ LA DURÉE DE CONSERVATION S'ÉCRIT DANS LE MOT DU CLIENT (19/09/2026,
// Timo : « 6 ans après le dernier achat. On peut à tout moment changer cette
// durée ») : le chiffre suit le réglage de ⚙ Paramètres, il n'est pas gravé
// dans le texte. D'où le jeton `{duree}` et cette petite fabrique — le même
// principe que `{client}` dans le mot de fidélité.
//
// ⚠⚠ L'EMPLOYÉ N'EN A PAS, ET CE N'EST PAS UN OUBLI : sa rémunération et ses
// déclarations sociales se conservent par OBLIGATION LÉGALE, pas par ce
// réglage. Lui annoncer la durée des clients serait tout simplement faux.
export const JETON_DUREE = "{duree}";
const avecDuree = (mot, duree) => ({
  ...mot,
  blocs: mot.blocs.map((b) => ({ ...b, texte: b.texte.split(JETON_DUREE).join(String(duree)) })),
});
export const motPour = (role, duree = 6) =>
  (role === "client" ? avecDuree(MOT_CLIENT, duree) : MOT_EMPLOYE);

// ---------------------------------------------------------------
// CE QUE LE BANC SURVEILLE DANS LES DEUX TEXTES
// ---------------------------------------------------------------
// Les mots qui mettent mal à l'aise, et qu'aucun des deux mots ne doit
// porter. Ce n'est pas une coquetterie : c'est la demande de Timo, écrite.
export const MOTS_A_EVITER = [
  "données à caractère personnel", "responsable de traitement", "finalité",
  "consentement", "j'accepte", "sous-traitant", "collectons", "surveill",
  "obligatoire", "vous devez",
];

export const motRassurant = (mot) => {
  const tout = [
    mot?.titre, mot?.intro, mot?.bouton,
    ...(mot?.blocs || []).flatMap((b) => [b.titre, b.texte]),
  ].join(" ").toLowerCase();
  const fautes = MOTS_A_EVITER.filter((m) => tout.includes(m));
  return {
    ok: fautes.length === 0
      // Ce qu'on NE fait pas vient EN PREMIER : c'est ça qui rassure.
      && /ne fait|ne faisons/i.test(mot?.blocs?.[0]?.titre || "")
      // « J'ai compris », jamais « J'accepte ».
      && /compris/i.test(mot?.bouton || ""),
    fautes,
  };
};
