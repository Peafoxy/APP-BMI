// ============================================================
// lib/assistantDirection.js — L'ASSISTANT(E) DE DIRECTION (01/11/2026)
//
// Timo : « Dans mon application, pas de rôle d'assistant(e) de direction »,
// puis « A a oui, B b, Cb », « D a », et enfin « Salaire prendre B a pour le
// moment… Assistant de direction peut être un homme… Lance ».
//   • A a : elle / il donne des tâches aux GÉRANTS (✅ Tâches) ;
//   • B a : PAS la paie des autres pour le moment (« on peut l'ouvrir un jour ») ;
//   • C b : 📲 WhatsApp comme les autres salariés ;
//   • D a : ne sort JAMAIS d'argent — pas de dépense, de paiement, de
//     versement, de vente ni d'encaissement.
// Tout le reste se REGARDE : tableau de bord, ventes, dettes, caisse, stock…
//
// LA GARDE : elle n'écrit que dans les tables listées ici (ses messages, ses
// rendez-vous, les tâches des fiches, le journal, la confirmation de SON
// salaire). Toute autre écriture est refusée « lecture seule » dans save()
// (App.jsx) ; le serveur refuse la même chose (securite-48).
//
// Sans autre import que civilite.js (sans import) : lisible par Node.
// ============================================================
import { ROLE_ASSISTANT_DIRECTION } from "./civilite.js";

export { ROLE_ASSISTANT_DIRECTION };

export const estAssistantDirection = (profile) => profile?.role === ROLE_ASSISTANT_DIRECTION;

// Les tables qu'elle a le droit de changer. ⚠ LE COUPLE : securite-48 refuse
// son écriture sur toutes les tables d'ARGENT et de STOCK — celles-ci n'y
// sont pas.
export const TABLES_ECRITES_PAR_ASSISTANT = ["messages", "rendez_vous", "users", "audits", "paie"];

// Les tables (ou clés de corbeille) que `next` change par rapport à `prev`
// et qu'elle n'a pas le droit d'écrire. Un écran qui ne touche pas une table
// la recopie telle quelle (`{ ...db, x }`) ; une table RECONSTRUITE à
// l'identique (un `.map` qui ne change rien) n'est pas une écriture non plus.
const memeTable = (a, b) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
export const tablesInterditesAssistant = (prev, next, cles) => {
  if (!prev || !next) return [];
  return (cles || []).filter((t) => !TABLES_ECRITES_PAR_ASSISTANT.includes(t) && next[t] !== undefined && !memeTable(next[t], prev[t]));
};

export const MESSAGE_LECTURE_ASSISTANT =
  "🔒 Assistant(e) de direction : vous consultez cet écran en lecture seule. Vous pouvez donner des tâches aux gérants (✅ Tâches), gérer vos rendez-vous et vos messages — rien qui touche à l'argent ni au stock.";

// À QUI elle / il donne une tâche (« A a ») : les GÉRANTS actifs, pris dans
// la liste DÉJÀ filtrée par l'espace regardé (le mur) — jamais db.users.
export const gerantsPourTaches = (personnes) =>
  (personnes || []).filter((u) => u && u.role === "gerant" && u.actif !== false)
    .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr"));

// "" si la tâche peut être donnée à cette personne, sinon le motif.
export const critiqueTacheAssistant = (cible) =>
  !cible ? "Personne introuvable."
  : cible.role !== "gerant" ? "Un(e) assistant(e) de direction ne donne des tâches qu'aux gérants."
  : cible.actif === false ? `${cible.nom} est désactivé(e).`
  : "";

// Les tâches qu'elle / il a données : par son identifiant (posé depuis ce
// jour), sinon par le nom pour une tâche sans `par_id`.
export const tachesConfiees = (personnes, moi) => {
  const out = [];
  for (const u of personnes || []) {
    for (const t of u?.taches || []) {
      if (t.par_id ? t.par_id === moi?.id : t.par === moi?.nom) out.push({ ...t, membre: u });
    }
  }
  const ORDRE = { terminee: 0, a_faire: 1, validee: 2 };
  return out.sort((a, b) => (ORDRE[a.statut] ?? 1) - (ORDRE[b.statut] ?? 1)
    || String(b.date || "").localeCompare(String(a.date || "")));
};
