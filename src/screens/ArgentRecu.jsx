// ============================================================
// screens/ArgentRecu.jsx — l'onglet « 💼 Argent reçu »
// Timo (10/10/2026, « A b, B b, C a, D a ») : le gérant ou l'administrateur
// remet de l'argent à quelqu'un (chantier ou non) ; la personne explique ici
// ce qu'elle en a fait, et rend le reste. L'onglet n'apparaît que chez qui a
// reçu de l'argent (App.jsx) ; avant, le cadre vivait dans 📤 Dépenses, que le
// vendeur, le commercial et le magasinier n'ont pas.
// Les règles : lib/argentChantier.js ; le cadre : components/ArgentChantier.jsx.
// ============================================================
import { MonArgentRecu } from "../components/ArgentChantier";

export function ArgentRecu({ db, save, profile }) {
  return (
    <div className="space-y-4">
      <MonArgentRecu db={db} save={save} profile={profile} />
    </div>
  );
}
