import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.jsx";

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
  document.getElementById("bmi-maj-btn").onclick = () => recharger();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
