// ============================================================
// screens/Connexion.jsx — Écran de connexion.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { LOGO, VERSION, verifierMotDePasse, definirMotDePasse } from "../lib/core";
import { Field, inputCls } from "../components/ui";
import { synchroniserAuth } from "../supabaseClient";

// ============ CONNEXION ============
export function Login({ db, onLogin, save }) {
  const [nomSaisi, setNomSaisi] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [connexionEnCours, setConnexionEnCours] = useState(false);
  const go = async () => {
    const saisie = nomSaisi.trim().toLowerCase();
    if (!saisie) { setErr("Entrez votre nom d'utilisateur."); return; }
    const u = db.users.find((x) => x.nom.trim().toLowerCase() === saisie);
    if (!u) { setErr("Utilisateur introuvable."); return; }
    if (u.actif === false) { setErr("Ce compte a été bloqué par l'administrateur."); return; }
    const { ok, aMigrer } = await verifierMotDePasse(u, pwd);
    if (!ok) { setErr("Mot de passe incorrect."); return; }
    // Migration transparente vers le hachage renforcé (sel individuel + PBKDF2),
    // qu'il s'agisse d'un ancien hachage à sel partagé ou d'un mot de passe en clair.
    if (aMigrer && save) {
      const nouveauxChamps = await definirMotDePasse(pwd);
      save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, ...nouveauxChamps } : x)) });
    }
    // Établit une vraie session Supabase sécurisée AVANT de continuer — et non
    // en arrière-plan sans attendre : sinon la synchronisation générale qui
    // démarre juste après risquait de partir AVANT que la session ne soit
    // prête, et ne récupérait alors que les données publiques (les comptes),
    // pas le reste (devis, chantiers, messages...). Un échec ici (hors ligne,
    // serveur indisponible) ne bloque jamais la connexion locale.
    setConnexionEnCours(true);
    await synchroniserAuth(u.id, pwd).catch(() => {});
    setConnexionEnCours(false);
    onLogin(u);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="text-center mb-5">
          <img src={LOGO} alt="BMI Togo" className="mx-auto mb-3 w-40 h-auto" />
          <div className="text-xl font-bold text-slate-900">GESTION SYSTÈME</div>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mt-2" style={{ backgroundColor: db.boutiques.find((b) => b.nom === "DEMAKPOE")?.couleur || "#0284c7" }}>BIENVENUE SUR NOTRE SYSTÈME</span>
          <div className="text-xs text-slate-400 mt-1">Espace de gestion — Lomé, Togo</div>
        </div>
        <div className="space-y-3">
          <Field label="Utilisateur">
            <input className={inputCls} autoCapitalize="words" placeholder="Votre nom" value={nomSaisi} onChange={(e) => { setNomSaisi(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && go()} />
          </Field>
          <Field label="Mot de passe">
            <input type="password" className={inputCls} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && go()} />
          </Field>
          {err && <div className="text-xs text-red-600 font-semibold">{err}</div>}
          <button onClick={go} disabled={connexionEnCours} className="w-full py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-60">{connexionEnCours ? "Connexion…" : "Se connecter"}</button>
          <div className="text-center text-[11px] text-slate-400">Version {VERSION}</div>
        </div>
      </div>
    </div>
  );
}
