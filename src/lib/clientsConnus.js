// ============================================================
// lib/clientsConnus.js — LES CLIENTS QUE LA BOUTIQUE CONNAÎT DÉJÀ
//
// Timo (15/09/2026) : « Dans vente, lorsqu'on veut enregistrer le nom et le
// numéro du client… si le client existe déjà dans le système, pourquoi il
// n'est pas proposé pour pré-remplir les lignes ? » — puis, sur le champ
// d'application : « Les trois » (💰 Ventes, 💳 Dettes, 🛠 Travaux à crédit).
//
// Avant, ces trois écrans demandaient un nom et un numéro en TEXTE LIBRE,
// sans rien proposer. Conséquences réelles : le même client écrit de trois
// façons (trois lignes dans 👥 Clients), un numéro retapé de travers — et
// un numéro faux, c'est la vente qui ne se rattache plus au compte du
// client (compteClientPour compare les 8 derniers chiffres).
//
// UNE règle, une seule, pour les quatre écrans : 👥 Clients construisait
// déjà cette liste dans son coin, il la lit maintenant ici.
//
// ⚠ LE MUR : la liste vient des VENTES et des DETTES de la boutique
// REGARDÉE — chaque ligne porte sa boutique, le cloisonnement est donc
// acquis d'office, sans jamais lire la table des comptes.
// ============================================================

import { telDigits, totalVente } from "./core.js";
import { dettesClassiques } from "./calculs.js";
import { chiffresTel, numeroComparable } from "./identiteClient.js";
import { sansAccents } from "./suggestions.js";

// La clé qui regroupe deux lignes sous le MÊME client : le numéro d'abord
// (les 8 derniers chiffres, `numeroComparable` — « +228 90 11 22 33 » et
// « 90112233 » sont le même homme), le nom à défaut.
export const cleClient = (nom, tel) => {
  const n = numeroComparable(tel);
  return n ? `t:${n}` : `n:${sansAccents(nom)}`;
};

// Toutes les écritures d'un même numéro, pour qu'il se retrouve quelle que
// soit la façon dont on le tape : les chiffres tels quels (« 90556677 »),
// les 8 derniers (l'indicatif ne compte pas) et l'écriture internationale
// (« +22890556677 ») — sans elle, commencer par « +228 » ne proposait plus
// rien alors que c'est ce que la case affiche en exemple.
// ⚠ Ce qui reste hors de portée : le numéro tapé ENTIER avec ses espaces
// (« +228 90 55 66 77 »). La règle commune compare mot à mot, et « 55 » ne
// commence aucun mot du numéro. Trois chiffres suffisent à réduire la liste,
// personne n'a besoin d'aller jusque-là.
export const motsDuNumero = (tel) => {
  const d = telDigits(tel);
  return [chiffresTel(tel), numeroComparable(tel), d && `+${d}`].filter(Boolean).join(" ");
};

// Tous les clients connus d'une boutique, du plus RÉCENT au plus ancien.
// Chacun porte ce que la boutique sait de lui : son numéro, combien de fois
// il est venu, ce qu'il a acheté, ce qu'il doit encore.
export function clientsConnus(db, boutique) {
  const map = {};
  const ligne = (nom, tel, date) => {
    const cle = cleClient(nom, tel);
    const c = (map[cle] ||= { cle, nom: nom || "(sans nom)", tel: tel || "", achats: 0, totalAchats: 0, dette: 0, derniere: date || "" });
    // Un client peut avoir été enregistré une fois sans numéro : dès qu'on
    // le connaît, on le garde.
    if (!c.tel && tel) c.tel = tel;
    // C'est la ligne la plus RÉCENTE qui dit comment ce client s'écrit
    // aujourd'hui — son nom et son numéro. Une vieille vente ne doit pas
    // imposer une orthographe ou un numéro abandonnés depuis.
    if (String(date || "") > String(c.derniere)) {
      c.derniere = date || c.derniere;
      if (nom) c.nom = nom;
      if (tel) c.tel = tel;
    }
    return c;
  };

  (db?.ventes || []).filter((v) => v.boutique === boutique && (v.client || v.tel)).forEach((v) => {
    const c = ligne(v.client, v.tel, v.date);
    c.achats += 1;
    c.totalAchats += totalVente(v);
  });

  // Les réservations prépayées ne sont pas une dette (règle de 👥 Clients,
  // reprise telle quelle) : elles ne comptent donc pas dans `dette`.
  dettesClassiques(db || {}).filter((d) => d.boutique === boutique && (d.client || d.tel)).forEach((d) => {
    const c = ligne(d.client, d.tel, d.date);
    c.dette += Math.max(0, Number(d.montant || 0) - Number(d.paye || 0));
  });

  return Object.values(map).sort((a, b) => String(b.derniere).localeCompare(String(a.derniere)));
}

// Les propositions du champ à suggestions (components/ChampSuggestions.jsx).
// • `valeur` = le nom, c'est lui qui remplit la case ;
// • `detail` = le numéro, le dernier passage, la dette qui reste ;
// • `mots` = les chiffres du numéro, bruts, pour qu'on retrouve un client en
//   tapant son NUMÉRO aussi bien que son nom (le détail les porte espacés,
//   « 90554433 » ne s'y retrouverait pas) ;
// • `tel` = ce que l'écran recopie dans la case du numéro au CLIC.
//
// ⚠ DEUX CLIENTS AU MÊME NOM : le champ commun ne garde qu'une proposition
// par nom (filtrerSuggestions). On ne cache donc pas le problème, on le DIT
// sur la ligne — « ⚠ 2 clients à ce nom, vérifiez le numéro » — et c'est le
// plus récent qui est proposé.
export function propositionsClients(clients, { fmt = (x) => String(x), dFR = (x) => String(x) } = {}) {
  const compte = {};
  (clients || []).forEach((c) => { const k = sansAccents(c.nom); compte[k] = (compte[k] || 0) + 1; });
  const vus = new Set();
  const out = [];
  for (const c of clients || []) {
    const k = sansAccents(c.nom);
    if (!k || vus.has(k)) continue;
    vus.add(k);
    const homonymes = compte[k];
    out.push({
      cle: c.cle,
      valeur: c.nom,
      tel: c.tel || "",
      mots: motsDuNumero(c.tel),
      detail: [
        c.tel || "sans numéro",
        c.derniere ? `dernier passage ${dFR(c.derniere)}` : "",
        c.dette > 0 ? `doit encore ${fmt(c.dette)}` : "",
        homonymes > 1 ? `⚠ ${homonymes} clients à ce nom, vérifiez le numéro` : "",
      ].filter(Boolean).join(" · "),
    });
  }
  return out;
}

// Les mêmes clients, proposés PAR LEUR NUMÉRO (Timo, 15/09/2026 : « la
// présélection n'est pas possible avec le numéro ? »). C'est dans la case du
// numéro qu'on tape un numéro : elle doit proposer comme celle du nom.
// • `valeur` = le numéro, c'est lui qui remplit la case ;
// • `detail` = le nom, le dernier passage, la dette ;
// • `mots` = le nom ET les chiffres sans espaces, pour retrouver un client
//   par son NOM depuis la case du numéro aussi.
// Un client sans numéro n'a rien à proposer ici : il n'y figure pas.
export function propositionsNumeros(clients, { fmt = (x) => String(x), dFR = (x) => String(x) } = {}) {
  return (clients || []).filter((c) => c.tel).map((c) => ({
    cle: c.cle,
    valeur: c.tel,
    nom: c.nom,
    mots: [c.nom, motsDuNumero(c.tel)].filter(Boolean).join(" "),
    detail: [
      c.nom,
      c.derniere ? `dernier passage ${dFR(c.derniere)}` : "",
      c.dette > 0 ? `doit encore ${fmt(c.dette)}` : "",
    ].filter(Boolean).join(" · "),
  }));
}
