# WhatsApp depuis le numéro BMI — état au 06/09/2026 (EN PAUSE)

Déplacé de CLAUDE.md le 06/09/2026, mot pour mot. Ne pas relancer Timo ; reprendre quand il le demandera, au point exact décrit ici.

- **WhatsApp depuis le numéro BMI (envoi automatique)** — CADRÉ le
  02/09/2026, PAS ENCORE CONSTRUIT. Demande Timo : « que ce soit le numéro
  BMI qui envoie le message et non le numéro personnel de chaque employé ».
  Aujourd'hui l'app ouvre `wa.me` : c'est le compte WhatsApp de l'APPAREIL
  qui envoie, l'app ne choisit pas l'expéditeur. Trois voies expliquées :
  (1) lier le numéro BMI sur les appareils de travail (4 appareils, manuel,
  gratuit) ; (2) canal API Meta sur un numéro DÉDIÉ « machine » — refusé
  parce que **les clients appellent sur WhatsApp** et un numéro API ne
  reçoit pas d'appel ; (3) **« coexistence »** : le MÊME numéro reste sur
  l'app WhatsApp Business du téléphone (appels, discussions, réponses des
  clients) ET est relié au canal d'envoi automatique — ouvert dans tous les
  pays depuis mai 2026. **Timo a choisi (3)** ; le numéro BMI est déjà sur
  WhatsApp Business (confirmé par lui). Le raccordement passe par un
  partenaire Meta (inscription « Embedded Signup », réservée aux partenaires
  — pas en direct chez Meta pour une petite entreprise) : 360dialog, YCloud…
  à choisir par Timo, frais mensuels du partenaire + conversations
  facturées par Meta. Côté app, à construire quand il dira « vas-y » :
  `api/whatsapp.js` (clé Meta en variable Vercel côté serveur, JAMAIS
  `VITE_`, appel réservé aux sessions connectées), remplacement des ouvertures
  `wa.me` (devis, comptes clients, PV, parrainage, relances) par l'envoi
  serveur avec **repli sur l'ouverture WhatsApp actuelle** si le serveur
  refuse (un message n'est jamais perdu en silence — règle du 18/08/2026),
  **journal des envois** visible (envoyé / livré / lu / échec + motif),
  file d'attente hors ligne, et **verrou formation : un compte
  d'entraînement n'envoie JAMAIS un vrai WhatsApp** (envoi simulé, inscrit
  comme tel). Pas de boîte de réception à construire : avec la coexistence
  les réponses arrivent sur le téléphone. Messages types (devis prêt,
  identifiants, lien PV, rappel) à écrire pour validation Meta.
  **ÉTAT AU 03/09/2026 — MIS EN PAUSE PAR TIMO (« on laisse ça pour le
  moment »).** Fait : le portefeuille Meta Business « BMI Togo » existe,
  Timo en est administrateur (accès total). La vérification d'entreprise
  n'est PAS proposée tant qu'aucun compte WhatsApp n'est relié — c'est
  normal, et elle n'est plus obligatoire pour envoyer (limite ~250 clients
  distincts / jour sans elle). ⚠ « Meta Verified » (badge bleu payant) n'a
  RIEN à voir — Timo s'était retrouvé sur sa liste d'attente.
  **Compte YCloud CRÉÉ (formule Free)** le 03/09/2026, après un code de
  vérification arrivé tardivement. Le raccordement « Coexistence » est
  ENGAGÉ : fenêtre Meta → portefeuille BMI Togo → « Associer une
  application WhatsApp Business » → Suivant → **code QR à scanner** — arrêté
  là parce que Timo n'avait pas le téléphone BMI (seul l'appareil principal
  du numéro peut scanner). À reprendre depuis YCloud → WhatsApp accounts →
  Coexistence → Get started, téléphone BMI en main (WhatsApp Business à
  jour, internet). Côté app, rien n'a été construit. **Ne pas relancer
  Timo ; reprendre quand il le demandera**, au point exact ci-dessus.
