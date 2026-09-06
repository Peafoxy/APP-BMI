# Vague 2 — la lecture des comptes clients (terminée) — état au 06/09/2026

Déplacé de CLAUDE.md le 06/09/2026, mot pour mot.

- **Vague 2 — la LECTURE** : `dettes`, `ventes`, `clients_installes` restent
  lisibles par tous les comptes clients (l'écriture, elle, est traitée par
  `client-2-fermer-ecriture.sql`).
  **Étape 1 FAITE (2.101.28)** : toute dette et toute vente naissent avec leur
  propriétaire (`client_user_id`, résolu par `compteClientPour` — téléphone
  d'abord, nom exact en repli, null pour un client de passage). Les chantiers
  portaient déjà `user_id`.
  **Étape 2 ÉCRITE ET TESTÉE (2.101.29)** : `client-3-rapprocher-proprietaires.sql`
  rapproche l'existant (téléphone 8 chiffres, puis nom exact, seulement si UN
  seul compte correspond ; jamais les comptes bloqués ni les non-clients ;
  lignes déjà marquées intouchées ; horodatage désactivé pendant l'écriture ;
  ⚠ les chantiers écrivent `user_id: ""` — la chaîne vide compte comme « pas
  marqué »). Vérifié par `npm run tester-rapprochement` (19 contrôles sur base
  jetable, rejouable). **COLLÉE par Timo le 31/08/2026** — résultat : base
  quasi vide (0 dette, 0 vente, 1 chantier déjà marqué), rien à reprendre.
  **Étape 3 ÉCRITE ET TESTÉE (2.101.32)** : `client-4-fermer-lecture.sql`
  ferme la lecture (un client ne lit que SES lignes). Trois exceptions
  mesurées, chacune parce qu'un écran en a besoin : les chantiers/ventes/
  dette de ses FILLEULS quand il est parrain (sinon « part due » s'affiche
  à tort), et la vente rattachée à son chantier (celle du PV). Vérifié par
  `npm run tester-client-lecture` (23 contrôles sur base jetable).
  **COLLÉE par Timo le 31/08/2026** (« les 3 lignes son restrictive/select ») —
  le correctif du déclencheur `client_ventes_reception_seule_trg` est parti
  dans le même collage. **La vague 2 est terminée.** Reste la preuve d'usage :
  à la première vraie vente à crédit d'un client à compte, vérifier que sa
  dette s'affiche sur SON téléphone.
  ⚠ **PREMIÈRE VRAIE VALIDATION DE DEVIS (compte ESSO, 31/08/2026) : refusée
  en silence.** Deux gestes de l'espace client écrivaient dans des lignes que
  client-1 ne laisse plus toucher : le badge « devis validé » sur une fiche
  prospect SANS étiquette, et la note du commercial DANS SA fiche à lui. Une
  écriture refusée = tout le lot coincé (tout ou rien), et le chemin groupé
  ne remontait AUCUN message à l'écran. Corrigé en 2.101.34 : le refus d'un
  lot s'affiche désormais avec le motif du serveur ; la fiche prospect est
  marquée à l'ENVOI du devis par l'employé (Partages.jsx) et le client ne
  touche plus que les fiches marquées ; la note se range dans la fiche du
  CLIENT (`evaluations_donnees`, agrégée par `evaluationsDe()` avec l'ancien
  emplacement). `client-5-marquer-prospects.sql` rattrape l'existant
  (horodatage NON suspendu, exprès : les appareils doivent retélécharger).
  Banc : `npm run tester-espace-client` (13 contrôles — rejoue les gestes
  complets via appliquer_lot, ce que personne ne faisait).
  Le message rendu visible a nommé le VRAI coupable du blocage d'ESSO : le
  **journal** (`audits`). Chaque geste écrit sa ligne de journal, et
  `role_client_pas_de_journal` (client-1) refusait celle du client — lot
  users + audits + commandes coincé. Corrigé en 2.101.36 : les lignes de
  journal portent `user_id`, et la règle laisse un client voir/écrire SES
  lignes (les anciennes, sans user_id, passent par le nom vérifié dans SA
  fiche). **RÉGLÉ ET CLOS le 31/08/2026 — Timo a collé le SQL, l'histoire
  ESSO est terminée. Ne plus la lui rappeler.** Et le « la page refuse de quitter » : les boîtes de dialogue
  (uConfirm/uAlert) étaient à z-50 comme les grandes fenêtres d'écran,
  qui passaient DEVANT — la question « Valider ? » s'ouvrait derrière le
  contrat, incliquable. DialogHost est à z-[70] désormais.
