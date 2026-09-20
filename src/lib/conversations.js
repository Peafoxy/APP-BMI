// ============================================================
// lib/conversations.js — L'ORDRE DE LA LISTE DES CONVERSATIONS (💬 Messages)
//
// Timo (14/09/2026, deux captures : 14 clients « Support » à faire défiler
// avant DJEDJE et ses 2 non lus) : « je veux qu'un nouveau message
// apparaisse en tête, bien avant le support client — je l'avais déjà
// demandé ». Règle pure, exercée par le banc :
//
//   1. UN bloc « 🔴 Nouveaux messages » tout en haut : TOUTE conversation
//      qui porte au moins un message non lu, quel que soit son bloc
//      d'origine, la plus récente en premier ;
//   2. puis les blocs dans l'ordre : Équipe, Groupes, Clients qui vous ont
//      écrit, Mes clients (chef d'équipe), Support clients — SANS les
//      conversations déjà montrées en haut (une conversation n'apparaît
//      qu'une fois ; lue, elle redescend dans son bloc).
//
// `sections` : [{ cle, titre, items: [{ cle, conv, ... }] }] dans l'ordre
// voulu ; `nonLusPour(conv)` compte les non lus ; `derniereActivite(conv)`
// rend l'horodatage du dernier message (pour classer le bloc du haut).
// ============================================================
// ⚠ « whatsapp » N'EST PLUS UN BLOC D'ICI (20/09/2026, décision « b » de
// Timo) : les conversations WhatsApp ont leur propre écran. Cette règle,
// elle, sert aux DEUX — le bloc « 🔴 Nouveaux messages » se calcule de la
// même façon des deux côtés, sinon les deux écrans classeraient autrement.
export const ORDRE_SECTIONS = ["equipe", "groupes", "clients_ecrit", "clients_chef", "support"];

export function separerNonLues(sections, nonLusPour, derniereActivite = () => "") {
  const nonLues = [];
  const restantes = sections.map((s) => {
    const garde = [];
    (s.items || []).forEach((it) => {
      const nb = nonLusPour(it.conv);
      if (nb > 0) nonLues.push({ ...it, nb, section: s.cle, activite: String(derniereActivite(it.conv) || "") });
      else garde.push({ ...it, nb: 0 });
    });
    return { ...s, items: garde };
  });
  nonLues.sort((a, b) => b.activite.localeCompare(a.activite));
  return { nonLues, sections: restantes };
}
