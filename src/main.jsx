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
    afficherBanniere(() => majSW(true));
  },
  onRegisteredSW(url, registration) {
    // On vérifie toutes les 15 minutes s'il existe une nouvelle version.
    if (registration) setInterval(() => registration.update(), 15 * 60 * 1000);
  },
});

function afficherBanniere(recharger) {
  if (document.getElementById("bmi-maj")) return;
  const barre = document.createElement("div");
  barre.id = "bmi-maj";
  barre.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#1e5a8a;color:#fff;" +
    "padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;" +
    "font-family:system-ui,sans-serif;font-size:14px;box-shadow:0 -2px 10px rgba(0,0,0,.25)";
  barre.innerHTML =
    '<span><b>Nouvelle version disponible</b><br><span style="font-size:12px;opacity:.85">Rechargez pour en profiter.</span></span>' +
    '<button id="bmi-maj-btn" style="background:#fff;color:#1e5a8a;border:0;border-radius:8px;' +
    'padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">Recharger</button>';
  document.body.appendChild(barre);
  document.getElementById("bmi-maj-btn").onclick = () => recharger();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
