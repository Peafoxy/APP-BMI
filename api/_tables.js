// ============================================================
// api/_tables.js — LIRE UNE TABLE ENTIÈRE CÔTÉ SERVEUR (tournées)
//
// Écrit UNE fois pour les deux tournées (7 h et 17 h) : la clé de service
// lit tout, page par page (1 000 lignes à la fois), et rend chaque ligne avec
// son id. Jamais appelé depuis le navigateur.
// ============================================================
export async function lireTable(admin, table) {
  const lignes = [];
  const PAGE = 1000;
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await admin.from(table).select("id, data").range(de, de + PAGE - 1);
    if (error) throw error;
    (data || []).forEach((l) => lignes.push({ ...(l.data || {}), id: l.id }));
    if (!data || data.length < PAGE) break;
  }
  return lignes;
}
