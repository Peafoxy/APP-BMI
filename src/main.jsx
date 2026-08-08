import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.jsx";

// ============ PERSISTANCE DU STOCKAGE LOCAL ============
// Sans cette demande, le navigateur (surtout sur téléphone) a le DROIT de
// purger la base locale (IndexedDB) s'il manque d'espace — des ventes saisies
// hors ligne pourraient disparaître avant d'avoir été synchronisées. Avec
// elle, le stockage passe en mode « persistant » : le navigateur ne l'efface
// plus de lui-même. C'est une simple demande : si elle est refusée, rien ne
// change par rapport à avant.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

// ============ MISE À JOUR DE L'APPLICATION ============
// L'application est une PWA : le téléphone garde une COPIE du code. Sans ce
// mécanisme, il continue de servir l'ancienne version indéfiniment — c'est ce
// qui faisait qu'un déploiement « ne prenait pas » sur les téléphones.
//
// Ici : dès qu'une nouvelle version est en ligne, l'appareil l'installe et
// affiche une bannière. Un clic, et il recharge sur la version à jour.
const majSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    afficherFenetreMaj(() => majSW(true));
  },
  onRegisteredSW(url, registration) {
    if (!registration) return;
    // AVANT : la première vérification n'avait lieu qu'après 15 minutes
    // (setInterval ne se déclenche qu'à la FIN du délai, jamais à l'ouverture)
    // — c'est ce qui donnait l'impression que « ça ne détecte jamais »
    // (signalé par Timo). Corrigé : on vérifie MAINTENANT, dès l'ouverture
    // de l'application — puis à chaque fois qu'on y revient au premier plan
    // (utile si l'app était en arrière-plan pendant le déploiement), en plus
    // du contrôle toutes les 15 minutes pour une session restée ouverte.
    registration.update();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
    setInterval(() => registration.update(), 15 * 60 * 1000);
  },
});

// Fenêtre bien visible au centre de l'écran (pas une simple bannière en bas,
// facile à manquer) — avec le NUMÉRO de la nouvelle version, récupéré sur le
// réseau (jamais via le cache : version.json n'est volontairement PAS mis en
// cache par le service worker, voir vite.config.js) pour être toujours juste.
async function afficherFenetreMaj(recharger) {
  if (document.getElementById("bmi-maj")) return;
  let version = "";
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) version = (await r.json()).version || "";
  } catch { /* pas grave : on affiche la fenêtre sans le numéro */ }

  const fond = document.createElement("div");
  fond.id = "bmi-maj";
  fond.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.6);" +
    "display:flex;align-items:center;justify-content:center;padding:16px;" +
    "font-family:system-ui,sans-serif;";
  fond.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:360px;width:100%;' +
    'box-shadow:0 10px 40px rgba(0,0,0,.35);overflow:hidden;text-align:center">' +
      '<div style="background:#1e5a8a;color:#fff;padding:20px 20px 16px">' +
        '<div style="font-size:32px;line-height:1">🔄</div>' +
        '<div style="font-weight:800;font-size:17px;margin-top:8px">Nouvelle version disponible</div>' +
        (version ? `<div style="font-size:13px;opacity:.9;margin-top:4px">Version ${version}</div>` : "") +
      "</div>" +
      '<div style="padding:18px 20px">' +
        '<div style="font-size:14px;color:#334155;margin-bottom:16px">Rechargez maintenant pour profiter des dernières mises à jour de l\'application.</div>' +
        '<button id="bmi-maj-btn" style="width:100%;background:#1e5a8a;color:#fff;border:0;border-radius:10px;' +
        'padding:12px 16px;font-weight:700;font-size:15px;cursor:pointer">🔄 Recharger maintenant</button>' +
      "</div>" +
    "</div>";
  document.body.appendChild(fond);
  document.getElementById("bmi-maj-btn").onclick = (e) => {
    // Le rechargement (extinction de l'ancienne version + nettoyage du
    // cache + rechargement réel) n'est jamais instantané côté navigateur —
    // sans retour visuel, on a tendance à cliquer plusieurs fois de suite,
    // ce qui relance le même processus en double/triple et ralentit
    // encore plus les choses. Signalé par Timo. On désactive le bouton dès
    // le premier clic et on prévient qu'il faut patienter.
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.cursor = "wait";
    btn.textContent = "⏳ Rechargement en cours…";
    recharger();
    // FILET DE SÉCURITÉ : sur certains navigateurs/webviews Android, la
    // bascule automatique (extinction de l'ancienne version → l'événement
    // du navigateur qui déclenche normalement le rechargement) ne se
    // produit pas de façon fiable — le bouton restait alors bloqué pour de
    // bon, sans que rien ne se passe, jusqu'à ce qu'on actualise la page à
    // la main. Signalé par Timo : « la recharge ne marche pas, il faut
    // actualiser la page d'abord ». Si rien ne s'est passé après quelques
    // secondes, on force nous-mêmes un vrai rechargement — sans dépendre
    // de ce mécanisme du navigateur pour sortir la personne de ce blocage.
    setTimeout(() => window.location.reload(), 3000);
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
