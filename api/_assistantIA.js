// ============================================================
// api/_assistantIA.js — LA PORTE VERS LE SERVICE D'IA, ÉCRITE UNE FOIS (24/09/2026)
//
// La règle (consigne, outils, juge de la réponse) vit dans
// src/lib/assistantIA.js. Ici : l'appel réseau, et rien d'autre.
//
// ⚠⚠ DEUX VARIABLES VERCEL, côté serveur seulement, JAMAIS préfixées « VITE_ »
// (Vite les embarquerait dans le paquet du navigateur) :
//   • ANTHROPIC_API_KEY  — la clé d'accès, créée par Timo sur le site du
//     fournisseur ; personne d'autre ne la voit, et elle n'est lue que ici.
//   • ASSISTANT_IA_MODELE — le nom du modèle à appeler. Il ne s'écrit PAS
//     dans le code (règle de la maison) : c'est un réglage du serveur.
// Sans l'une des deux, `configIA()` rend `pret: false` et l'assistant à
// menu (lib/assistantWhatsapp.js) répond à sa place — jamais un client
// sans réponse.
// ============================================================
export const URL_IA = "https://api.anthropic.com/v1/messages";
export const VERSION_API_IA = "2023-06-01";
export const DELAI_IA_MS = 25000;

export function configIA() {
  const cle = process.env.ANTHROPIC_API_KEY || "";
  const modele = process.env.ASSISTANT_IA_MODELE || "";
  return { cle, modele, pret: !!cle && !!modele };
}

// Un appel au service. `corps` = { system, messages, tools, max_tokens } ;
// rend la réponse telle quelle ({ content: [...], stop_reason }) ou lève
// avec le statut et le motif — l'appelant retombe alors sur le menu.
// ⚠ Bornée dans le temps : un service qui ne répond pas ne doit pas
// bloquer l'arrivée d'un message (le webhook doit répondre à YCloud).
export async function appelerIA(corps, { cle, modele, delai = DELAI_IA_MS } = {}) {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delai);
  try {
    const reponse = await fetch(URL_IA, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cle, "anthropic-version": VERSION_API_IA },
      body: JSON.stringify({ model: modele, ...corps }),
      signal: controle.signal,
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      const motif = resultat?.error?.message || `le service d'IA a répondu ${reponse.status}`;
      const e = new Error(motif);
      e.statut = reponse.status;
      throw e;
    }
    return resultat;
  } finally {
    clearTimeout(minuterie);
  }
}
