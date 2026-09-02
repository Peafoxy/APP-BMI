// ============================================================
// components/Carte.jsx — Carte OpenStreetMap/Leaflet pour choisir
// une position (prospects, clients installés, boutiques).
//
// ⚠ LEAFLET EST EMBARQUÉ DANS L'APPLICATION (2.101.38, après la carte
// blanche relevée par Timo le 01/09/2026). Avant, le moteur et son
// habillage se chargeaient depuis un serveur extérieur à CHAQUE
// utilisation : si l'un des deux ne venait pas — réseau mobile
// capricieux, serveur bloqué — la carte restait blanche, parfois en
// silence (les clics enregistraient la position, mais rien ne se
// dessinait). Embarqué, il est installé avec l'application, disponible
// même hors ligne. La SEULE chose qui vienne encore du réseau : les
// images du fond de carte (les « tuiles » OpenStreetMap) — et
// celles déjà vues sont gardées en réserve par l'application
// (vite.config.js), donc les endroits habituels s'affichent hors ligne.
// ============================================================
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// ⚠ Piège connu de Leaflet en application empaquetée : sans ces trois
// lignes, l'icône du repère 📍 cherche ses images à une adresse qui
// n'existe plus après l'empaquetage, et le repère devient invisible.
import marqueurIcone2x from "leaflet/dist/images/marker-icon-2x.png";
import marqueurIcone from "leaflet/dist/images/marker-icon.png";
import marqueurOmbre from "leaflet/dist/images/marker-shadow.png";
import { uAlert } from "../components/ui";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: marqueurIcone, iconRetinaUrl: marqueurIcone2x, shadowUrl: marqueurOmbre });

// Centre par défaut : Lomé, Togo
const LOME = [6.1319, 1.2228];

export function CarteChoixPosition({ lat, lng, onChoisir }) {
  const conteneurRef = useRef(null);
  const mapRef = useRef(null);
  const marqueurRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    Promise.resolve(L)
      .then((L) => {
        if (annule || !conteneurRef.current || mapRef.current) return;
        const depart = lat && lng ? [lat, lng] : LOME;
        const map = L.map(conteneurRef.current).setView(depart, lat && lng ? 15 : 12);
        // ⚠ Adresse SANS le préfixe {s} : OpenStreetMap a déprécié les
        // sous-domaines a/b/c — sur certains réseaux ils ne répondent plus,
        // et la carte restait blanche.
        const tuiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        // Si les tuiles elles-mêmes ne viennent pas (réseau qui les bloque),
        // on le DIT au lieu de laisser un rectangle blanc.
        let tuilesEnEchec = 0;
        tuiles.on("tileerror", () => {
          tuilesEnEchec += 1;
          if (tuilesEnEchec === 6) setErreur("Le fond de carte ne se charge pas sur ce réseau. Vous pouvez quand même utiliser « 📍 Ma position actuelle » : la position sera bien enregistrée.");
        });
        tuiles.on("tileload", () => { tuilesEnEchec = 0; setErreur(""); });
        const marqueur = L.marker(depart, { draggable: true }).addTo(map);
        marqueur.on("dragend", () => { const p = marqueur.getLatLng(); onChoisir(p.lat, p.lng); });
        map.on("click", (e) => { marqueur.setLatLng(e.latlng); onChoisir(e.latlng.lat, e.latlng.lng); });
        mapRef.current = map;
        marqueurRef.current = marqueur;
        setPret(true);
        // ⚠ La fenêtre qui contient la carte s'ouvre avec une animation : si
        // Leaflet mesure le cadre PENDANT l'ouverture (taille nulle), il ne
        // dessine aucune tuile et reste blanc. On lui fait reprendre ses
        // mesures une fois la fenêtre posée — trois rappels espacés, pour
        // couvrir les téléphones lents.
        [100, 500, 1500].forEach((delai) => setTimeout(() => {
          if (mapRef.current) mapRef.current.invalidateSize();
        }, delai));
      })
      .catch((e) => setErreur(e.message));
    return () => {
      annule = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maPosition = () => {
    if (!navigator.geolocation) { uAlert("La géolocalisation n'est pas disponible sur cet appareil."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChoisir(latitude, longitude);
        if (mapRef.current && marqueurRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          marqueurRef.current.setLatLng([latitude, longitude]);
        }
      },
      () => uAlert("Impossible de récupérer votre position. Vérifiez que la localisation est activée."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="rounded-lg border border-slate-300 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs text-slate-500">Cliquez sur la carte, ou faites glisser le repère, pour marquer l'emplacement exact.</span>
        <button type="button" onClick={maPosition} className="text-xs font-bold text-sky-800 underline whitespace-nowrap ml-2">📍 Ma position actuelle</button>
      </div>
      {erreur && <div className="p-3 text-sm text-red-600">{erreur}</div>}
      <div ref={conteneurRef} style={{ height: 260 }} className={pret ? "" : "flex items-center justify-center bg-slate-50 text-slate-400 text-sm"}>
        {!pret && !erreur && "Chargement de la carte…"}
      </div>
      {lat && lng && <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">Position choisie : {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>}
    </div>
  );
}
