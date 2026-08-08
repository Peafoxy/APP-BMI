// ============================================================
// screens/ContratsInstallation.jsx — Liste des contrats d'installation
// signés. Admin et responsable commercial voient tous les contrats de
// tous les commerciaux ; un commercial ne voit que les siens ; un
// client ne voit que les siens (onglet "📄 Mes contrats").
// ============================================================
import { useState, useRef } from "react";
import { fmt, dFR } from "../lib/core";
import { Panel, uAlert } from "../components/ui";
import { contratsInstallation, bloquerSiLecture } from "../lib/calculs";
import { imprimerContratInstallation } from "../lib/impression";

export function ContratsInstallation({ db, save, profile }) {
  const isClient = profile.role === "client";
  const isAdmin = profile.role === "admin";
  // Seuls admin et responsable commercial ont une vue d'ensemble — tout
  // autre rôle qui peut initier un devis (commercial, technicien,
  // technicien BMI, gérant, vendeur) ne voit que SES propres contrats,
  // jamais ceux d'un collègue (élargi à ces rôles, demande Timo).
  const isSupervision = profile.role === "admin" || profile.role === "resp_commercial";

  // Tant que le devis n'est pas encaissé, SEUL L'ADMIN peut voir le
  // contrat — ni le client, ni l'initiateur (même le responsable
  // commercial) n'y ont accès avant l'encaissement (demande Timo).
  const contrats = isClient
    ? contratsInstallation(db, { clientId: profile.id, payeSeulement: true })
    : contratsInstallation(db, { commercial: isSupervision ? undefined : profile.nom, payeSeulement: !isAdmin });

  // ---- SIGNATURE PERSONNELLE — enregistrée UNE FOIS, réutilisée
  // automatiquement sur tous les contrats futurs de la personne (demande
  // Timo). Même technique de capture que la signature client dans
  // EspaceClient.jsx, avec la même mise à l'échelle du canevas (2.99.26) —
  // recopiée ici plutôt que retouchée là-bas, pour ne jamais risquer de
  // régresser ce qui vient d'être confirmé fonctionnel sur téléphone.
  const [captureOuverte, setCaptureOuverte] = useState(false);
  const canvasRef = useRef(null);
  const aSigneRef = useRef(false);
  const [dessinEnCours, setDessinEnCours] = useState(false);

  const positionCanvas = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const echelleX = canvas.width / rect.width;
    const echelleY = canvas.height / rect.height;
    return { x: (point.clientX - rect.left) * echelleX, y: (point.clientY - rect.top) * echelleY };
  };
  const debuterTrait = (e) => {
    e.preventDefault();
    setDessinEnCours(true);
    aSigneRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const continuerTrait = (e) => {
    if (!dessinEnCours) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasRef.current);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const terminerTrait = () => setDessinEnCours(false);
  const effacerSignature = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    aSigneRef.current = false;
  };
  const enregistrerSignature = () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!aSigneRef.current) { uAlert("Signez d'abord dans le cadre prévu."); return; }
    const dataUrl = canvasRef.current.toDataURL("image/png");
    save({ ...db, users: db.users.map((u) => (u.id === profile.id ? { ...u, signature_personnelle: dataUrl } : u)) }, `Signature personnelle enregistrée — ${profile.nom}`);
    setCaptureOuverte(false);
    uAlert("✅ Signature enregistrée — elle sera utilisée automatiquement sur vos futurs contrats.");
  };

  return (
    <div className="space-y-4">
      {!isClient && (
        <Panel>
          <div className="font-bold mb-1">✍️ Ma signature</div>
          <div className="text-xs text-slate-500 mb-3">Enregistrée une seule fois, elle est réutilisée automatiquement sur tous vos contrats — obligatoire avant de pouvoir envoyer un devis.</div>
          {profile.signature_personnelle
            ? (
              <div className="flex items-center gap-3">
                <img src={profile.signature_personnelle} alt="Ma signature" className="h-14 border border-slate-200 rounded bg-white" />
                <button onClick={() => setCaptureOuverte(true)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Modifier ma signature</button>
              </div>
            )
            : (
              <button onClick={() => setCaptureOuverte(true)} className="px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✍️ Enregistrer ma signature</button>
            )}
        </Panel>
      )}

      <Panel>
        <div className="font-bold mb-1">📄 {isClient ? "Mes contrats" : "Contrats d'installation"}</div>
        <div className="text-xs text-slate-500 mb-3">
          {isClient
            ? "Vos contrats, une fois le paiement encaissé, sont accessibles ici."
            : isAdmin
              ? "Tous les contrats signés — y compris ceux en attente de paiement."
              : isSupervision
                ? "Tous les contrats déjà encaissés, tous initiateurs confondus."
                : "Les contrats déjà encaissés sur vos propres devis."}
        </div>

        {contrats.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucun contrat signé pour l'instant.</div>}

        <div className="space-y-2">
          {contrats.map(({ client, devis: d }) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 flex-wrap">
              <div>
                <div className="font-semibold text-sm">
                  {d.contrat_numero || "—"}
                  {!isClient && <span className="text-slate-400 font-normal"> · {client.nom}</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {d.type_devis === "garage" ? "Motorisation portail/garage" : d.type_devis === "autre" ? (d.besoins?.categorie || "Devis") : "Installation solaire"}
                  {" · "}Signé le {dFR(d.contrat_date_signature)}
                  {!isClient && ` · par ${d.par}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold tabular-nums">{fmt(d.total)}</span>
                <button onClick={() => imprimerContratInstallation(d, db)} className="text-xs font-bold text-sky-800 underline">📄 Voir</button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {captureOuverte && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl max-w-md w-full p-5">
            <div className="font-bold text-lg text-sky-900 mb-1">Ma signature</div>
            <div className="text-xs text-slate-500 mb-3">Elle apparaîtra sur tous vos contrats, à côté du cachet de BMI Togo.</div>
            <canvas ref={canvasRef} width={440} height={120} className="w-full border-2 border-slate-300 rounded-lg touch-none bg-slate-50"
              onMouseDown={debuterTrait} onMouseMove={continuerTrait} onMouseUp={terminerTrait} onMouseLeave={terminerTrait}
              onTouchStart={debuterTrait} onTouchMove={continuerTrait} onTouchEnd={terminerTrait} />
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={effacerSignature} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Effacer</button>
              <button onClick={enregistrerSignature} className="flex-1 px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✍️ Enregistrer</button>
              <button onClick={() => setCaptureOuverte(false)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
