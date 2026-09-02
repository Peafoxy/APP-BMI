import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Génère public/version.json à partir de VERSION (src/lib/constants.js) —
// AVANT chaque build, pour que l'app puisse annoncer le numéro exact de la
// nouvelle version disponible (voir main.jsx : la bannière de mise à jour
// affiche ce numéro en le récupérant sur le réseau, jamais via le cache).
function ecrireVersionJson() {
  return {
    name: "ecrire-version-json",
    buildStart() {
      const src = readFileSync(resolve(__dirname, "src/lib/constants.js"), "utf-8");
      const m = src.match(/VERSION\s*=\s*"([^"]+)"/);
      const version = m ? m[1] : "?";
      writeFileSync(resolve(__dirname, "public/version.json"), JSON.stringify({ version }));
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    ecrireVersionJson(),
    react(),
    tailwindcss(),
    VitePWA({
      // « prompt » : on PRÉVIENT l'utilisateur au lieu de recharger dans son dos.
      // En « autoUpdate », la nouvelle version n'était appliquée qu'après la
      // fermeture COMPLÈTE de l'application — ce que personne ne fait jamais sur
      // téléphone. D'où des appareils bloqués des semaines sur une vieille version.
      registerType: "prompt",
      includeAssets: ["pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "BMI-Gestion Système",
        short_name: "BMI Gestion",
        description: "Gestion des boutiques DEMAKPOE et APESSITO — ventes, stocks, dettes, caisse",
        lang: "fr",
        display: "standalone",
        start_url: "/",
        theme_color: "#0f172a",
        background_color: "#f1f5f9",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        maximumFileSizeToCacheInBytes: 5000000,
        // ⚠ Les images du fond de carte (tuiles OpenStreetMap) sont gardées
        // en réserve après leur premier affichage : les endroits déjà vus
        // (Lomé, les quartiers habituels) s'affichent même sans réseau, et
        // on ne redemande pas cent fois les mêmes images au serveur.
        runtimeCaching: [{
          urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
          handler: "CacheFirst",
          options: {
            cacheName: "tuiles-carte",
            expiration: { maxEntries: 600, maxAgeSeconds: 60 * 24 * 3600 },
            cacheableResponse: { statuses: [0, 200] },
          },
        }],
      }
    })
  ]
});
