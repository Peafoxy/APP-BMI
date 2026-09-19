// ============================================================
// lib/conservation.js — COMBIEN DE TEMPS ON GARDE LES DONNÉES D'UN CLIENT
//
// Timo, 19/09/2026, après avoir été prévenu que c'était le dernier point
// ouvert de la protection des données : « **6 ans après le dernier achat.
// On peut à tout moment changer cette durée** ».
//
// ⚠ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'EXISTAIT PAS AVANT.
// Jusqu'ici l'application se TAISAIT sur la durée, exprès : rien n'était
// tranché, et écrire un chiffre inventé aurait été pire que le silence (un
// client à qui l'on promet « 3 ans » et qui retrouve ses achats sept ans
// plus tard a été trompé). Le document disait donc seulement « pour la
// durée de la relation commerciale », ce qui est vrai mais vague. Avec sa
// décision, la durée S'ÉCRIT — et une durée annoncée vaut mieux qu'un
// silence, c'est exactement ce que la loi n° 2019-014 attend.
//
// ⚠⚠ RIEN NE S'EFFACE TOUT SEUL (décision Timo, 19/09/2026, entre trois
// propositions) : **l'application PROPOSE, l'administrateur CONFIRME.**
// Un effacement ne se défait pas — ni corbeille, ni restauration d'une
// sauvegarde antérieure. Un balayage automatique à 7 h du matin serait le
// premier geste de l'application à détruire des données sans que personne
// ne regarde, et les avertissements existants (un client sans numéro se
// rapproche sur le NOM seul : un homonyme partirait avec lui) n'auraient
// plus personne à avertir. Ce fichier ne contient donc AUCUNE fonction qui
// efface : il dit QUI dépasse la durée, et c'est tout. L'effacement reste
// le geste de `effacerClient` (lib/effacementClient.js), client par client.
//
// ⚠ L'ARTICLE 18 DU CONTRAT N'A PAS BOUGÉ (décision Timo le même jour) : il
// garde « conservées pour la durée nécessaire à cette finalité ». Ce n'est
// pas faux, et un contrat SIGNÉ ne se met pas à jour — il garderait le
// chiffre du jour de la signature alors que la durée est réglable. La durée
// précise vit donc dans l'application et dans le dossier que le client
// télécharge, où elle suit le réglage. Ne pas l'écrire dans l'article 18
// sans qu'il le redemande.
//
// Le réglage vit sur les boutiques (champ `duree_conservation_ans`), comme
// la liste des banques et le prix du rail : aucune table nouvelle, **rien à
// coller dans Supabase**.
//
// Module PUR, sans aucun import.
// ============================================================

// 6 ans : la décision de Timo. C'est aussi ce que demandent les obligations
// comptables togolaises sur les pièces d'un commerce — les deux tombent
// juste, ce qui n'est pas un hasard.
export const DUREE_CONSERVATION_DEFAUT = 6;

// Au-delà, ce n'est plus une durée de conservation mais un oubli : on refuse
// de l'écrire plutôt que d'afficher « 900 ans » sur le document d'un client.
export const DUREE_CONSERVATION_MAX = 30;

// ---------------------------------------------------------------
// LE RÉGLAGE
// ---------------------------------------------------------------
// Lu comme la liste des banques : la première boutique qui le porte fait
// foi. Aucune boutique réglée = la valeur par défaut, jamais « pas de
// durée » — le document doit toujours pouvoir dire un chiffre.
export const dureeConservation = (db) => {
  const b = (db?.boutiques || []).find((x) => Number(x?.duree_conservation_ans) > 0);
  return b ? Number(b.duree_conservation_ans) : DUREE_CONSERVATION_DEFAUT;
};

export function critiqueDuree(ans) {
  const n = Number(ans);
  if (!Number.isFinite(n) || !String(ans ?? "").trim()) return "Entrez un nombre d'années.";
  if (!Number.isInteger(n)) return "La durée s'exprime en années entières.";
  if (n < 1) return "La durée doit être d'au moins 1 an : les pièces comptables se gardent, on ne peut pas effacer le jour même.";
  if (n > DUREE_CONSERVATION_MAX) return `${n} ans, ce n'est plus une durée de conservation. Le maximum est ${DUREE_CONSERVATION_MAX} ans.`;
  return "";
}

// ⚠ Le réglage s'écrit sur TOUTES les boutiques, comme le mot de fidélité —
// et, contrairement à l'habitude, il n'est PAS cloisonné. C'est voulu et il
// faut savoir pourquoi : ce n'est pas une donnée, c'est une POLITIQUE de la
// maison, la même des deux côtés du mur. Et surtout, la lecture ci-dessus
// prend « la première boutique qui le porte » : si le réel disait 6 ans et
// la formation 4, le document d'un client afficherait l'un ou l'autre selon
// l'ordre du chargement. Un chiffre qui change tout seul sur un papier remis
// à un client serait pire que tout. Une seule durée, donc.
export const poserDureeConservation = (boutiques, ans) =>
  (boutiques || []).map((b) => ({ ...b, duree_conservation_ans: Number(ans) }));

// ---------------------------------------------------------------
// LA DATE À PARTIR DE LAQUELLE ON PEUT EFFACER
// ---------------------------------------------------------------
// Un client dont la dernière trace est ANTÉRIEURE à cette date a dépassé la
// durée. On travaille en « AAAA-MM-JJ », comme partout dans l'application.
export function dateLimiteConservation(duree, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const j = String(aujourdhui || "").slice(0, 10);
  const [a, m, d] = j.split("-").map(Number);
  if (!a || !m || !d) return "";
  const ans = Number(duree) > 0 ? Number(duree) : DUREE_CONSERVATION_DEFAUT;
  return `${String(a - ans).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------------------------------------------------------------
// QUI DÉPASSE LA DURÉE
// ---------------------------------------------------------------
// ⚠ LE MUR : cette fonction ne reçoit PAS `db`. Elle reçoit la liste que
// `clientsEffacables(visible)` a déjà bâtie sur les listes filtrées par
// l'espace regardé. Une fonction pure qui reçoit une table entière et la
// PARCOURT est un passage de mur en puissance (leçon payée deux fois :
// `retenueOutilPourPrime` le 18/09, le nettoyage des textes libres le même
// jour). Ici il n'y a rien à parcourir : la liste est déjà la bonne.
//
// ⚠ « dernier achat » se lit sur `derniere`, que `clientsEffacables` calcule
// déjà : la plus récente de ses ventes, dettes et chantiers — et, pour un
// client créé qui n'a JAMAIS acheté, la date de création de son compte.
// Sans ce repli, un compte ouvert et jamais utilisé ne serait jamais
// concerné : il resterait pour toujours, ce qui est exactement ce que la
// durée de conservation vient empêcher.
export function clientsDepasses(clients, duree, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const limite = dateLimiteConservation(duree, aujourdhui);
  if (!limite) return [];
  return (clients || [])
    .filter((c) => c?.derniere && String(c.derniere).slice(0, 10) < limite)
    .map((c) => ({ ...c, depuis: anneesDepuis(c.derniere, aujourdhui) }))
    .sort((a, b) => String(a.derniere).localeCompare(String(b.derniere)));
}

// Depuis combien d'années, en clair — « 7 ans », « 6 ans et demi ».
export function anneesDepuis(date, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const d = new Date(String(date || "").slice(0, 10));
  const j = new Date(String(aujourdhui || "").slice(0, 10));
  if (isNaN(d) || isNaN(j)) return 0;
  return Math.max(0, (j - d) / (365.25 * 24 * 3600 * 1000));
}

export function libelleAnciennete(annees) {
  const a = Number(annees) || 0;
  const entier = Math.floor(a);
  const demi = a - entier >= 0.4 && a - entier < 0.75;
  if (entier < 1) return "moins d'un an";
  return `${entier} an${entier > 1 ? "s" : ""}${demi ? " et demi" : ""}`;
}

// ---------------------------------------------------------------
// CE QUE LE CLIENT LIT
// ---------------------------------------------------------------
// ⚠ UNE SEULE PHRASE, écrite ici et nulle part ailleurs : elle s'affiche
// dans l'espace du client, elle s'imprime sur son dossier, elle se lit dans
// ⚙ Paramètres. Trois textes différents finiraient par se contredire, et
// c'est LE CLIENT qui verrait la différence entre ce qu'il télécharge et ce
// qu'on lui dit.
//
// ⚠ Elle dit AUSSI ce qui reste après : la loi commerciale oblige BMI à
// garder ses factures. Promettre une disparition totale au bout de 6 ans
// serait une promesse qu'on ne tiendra pas — les livres restent, sans son
// nom. C'est déjà exactement ce que fait l'effacement.
export const phraseConservation = (duree) =>
  `Vos données sont conservées ${Number(duree) || DUREE_CONSERVATION_DEFAUT} ans après votre dernier achat. `
  + `Passé ce délai, elles sont effacées : votre nom et votre numéro disparaissent de nos dossiers. `
  + `Les factures et les contrats, eux, restent — la loi commerciale nous oblige à les garder — mais votre nom en est retiré.`;
