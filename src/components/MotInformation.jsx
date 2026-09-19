// ============================================================
// components/MotInformation.jsx — LA FENÊTRE DU MOT D'INFORMATION
//
// Timo, 19/09/2026 : « faire en sorte que le message ne mette pas mal à
// l'aise le client ni le personnel ». Le TEXTE est dans
// lib/motInformation.js ; ici, c'est l'HABILLAGE qui doit tenir la même
// promesse — et un habillage peut trahir un texte :
//
//   • **Aucun rouge, aucun ⚠, aucun cadenas en titre.** Un bandeau d'alerte
//     donne le ton avant qu'on ait lu un mot.
//   • **UN seul bouton, large, en bas.** Pas de croix, pas de « Refuser » :
//     on n'attend rien de la personne, elle n'a donc rien à décider.
//   • **Un 👋, pas un 🔒.** On accueille quelqu'un, on ne le met pas en
//     garde.
//   • Écrite UNE fois : le client et l'employé voient la même fenêtre, seuls
//     les mots changent.
// ============================================================

export function MotInformation({ mot, onCompris }) {
  if (!mot) return null;
  return (
    <div className="fixed inset-0 z-[9997] bg-slate-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 my-0 sm:my-auto">
        <div className="p-5 sm:p-6">
          <div className="text-2xl mb-1">👋</div>
          <div className="text-lg font-bold text-sky-900">{mot.titre}</div>
          <p className="text-sm text-slate-600 mt-1">{mot.intro}</p>

          <div className="mt-4 space-y-3">
            {mot.blocs.map((b, i) => (
              <div key={i} className="flex gap-3">
                <div className="text-lg leading-none pt-0.5 shrink-0">{b.icone}</div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{b.titre}</div>
                  <p className="text-sm text-slate-600">{b.texte}</p>
                </div>
              </div>
            ))}
          </div>

          {/* La loi se cite en bas, en petit : elle rassure celui qui la
              cherche et n'alourdit personne d'autre. */}
          <div className="mt-4 text-[11px] text-slate-400">{mot.pied}</div>

          <button
            onClick={onCompris}
            className="mt-5 w-full px-5 py-3 rounded-xl bg-sky-800 text-white font-bold text-sm hover:bg-sky-900"
          >
            {mot.bouton}
          </button>
        </div>
      </div>
    </div>
  );
}
