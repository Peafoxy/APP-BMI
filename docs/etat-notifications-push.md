# 🔔 Notifications sur les appareils — état et mise en service

Décision de Timo (13/09/2026) : « Notification par défaut, pas besoin
d'activer quelque chose dans l'app. Tant que tu l'utilises, tu auras des
notifications. » Puis, sur ce qui part : **« Lance avec la liste A telle
quelle comme message, et B aussi telle quelle, à titre informatif dans les
notifications. »**

Construit en 2.101.197. **Ne fonctionne qu'une fois les trois réglages
ci-dessous faits par Timo** (jusque-là, l'application marche exactement
comme avant : rien ne casse, rien ne vibre).

---

## 1. Ce qui vibre, et chez qui

**Liste A — les messages (💬 Messages).** UNE règle : chaque nouveau message
est une notification pour la personne à qui il s'adresse. Rien n'a été
ajouté ni retiré aux messages existants (dépense à valider / validée /
rejetée, versement, commission payée, prime payée, affectation à une
installation, nouveau client, devis modifié / accepté / refusé, cadeau,
parrainage, message écrit à la main…). Un clic ouvre 💬 Messages.

**Liste B — « pour information » (jamais dans 💬 Messages).** Titre marqué
par son sujet, un clic ouvre l'écran concerné :

| Quand | Qui | Écran |
|---|---|---|
| Demande de ravitaillement envoyée au magasin | Magasiniers de l'espace + admins | 📦 Stocks |
| Demande de transfert reçue par une boutique | Gérant de cette boutique + admins | 📦 Stocks |
| Commande d'un commercial en attente | Le vendeur visé (sinon tous) + gérant de la boutique | 🛒 Commandes |
| Demande de prime d'installation | Vendeurs + gérant de la boutique de paiement | 💰 Primes à remettre |
| Devis proposé au client | Le client | 🏠 Mon espace |
| Tâche assignée / validée / rouverte | La personne | ✅ Mes tâches |
| Tâche terminée | Celui qui l'a assignée | 👑 Mon équipe |
| Dépense à pointer par le comptable (payée avec sa caisse, ou saisie chez lui) | Le comptable | 🧾 Chez le comptable |
| Un article PASSE au seuil (il était au-dessus avant ce geste) | Vendeurs + gérant (magasinier pour un dépôt) + admins | 📦 Stocks |
| Clôture dépassée (la caisse a bougé après la clôture) | Vendeurs + gérant + admins | 🔒 Caisse |
| **Chaque matin à 7 h** : caisse d'hier non clôturée | Vendeurs + gérant + admins | 🔒 Caisse |
| **Chaque matin** : dettes qui passent les 30 jours (le 31e jour, une fois) | Vendeurs + gérant + admins | 📋 Dettes |
| **Chaque matin** : devis qui atteint 15 jours sans réponse (une fois par relance) | Son auteur + resp. commercial + admins | 📋 Tous les devis |

Règles fixes : **l'auteur d'un geste n'est jamais prévenu de son propre
geste** ; **le mur formation / réel est respecté** (une boutique de
formation ne prévient que des comptes de formation, plus l'administrateur
principal, avec 🎓 devant le titre) ; rien n'est écrit dans la base pour
une notification ; le comptable ne reçoit rien de la formation.

## 2. Où ça vit

- `src/lib/notifications.js` — la règle, comparaison AVANT / APRÈS de
  chaque enregistrement (`envoisDepuisSave`), appelée UNE fois dans le
  `save()` de App.jsx. Aucun écran n'envoie de notification.
- `src/lib/rappels.js` — la tournée du matin (`rappelsDuMatin`) et les deux
  règles de délai (dette en retard 30 j, devis à relancer 15 j) que les
  écrans Dettes et Tous les devis importent désormais. Lisible par Node
  sans bundler : le serveur l'importe telle quelle.
- `src/lib/espace.js` — `estCompteFormation` (déplacée de calculs.js, qui
  la réexporte) et les briques « qui prévenir ».
- `src/push.js` — le seul fichier qui parle au navigateur : permission (au
  clic de connexion), inscription de l'appareil (à la connexion et au
  retour), désinscription (à la déconnexion), file d'envoi (localStorage,
  24 h, repart au retour du réseau).
- `public/push-sw.js` — reçu par le service worker : affiche, et ouvre
  l'écran au clic (`?ecran=…` ou message à la fenêtre ouverte).
- `api/abonner-push.js`, `api/notifier.js`, `api/rappels-du-matin.js`,
  `api/_push.js` — le serveur. Jeton de session vérifié ; la tournée exige
  le secret Vercel ; envois bornés ; appareil mort retiré.
- Banc : `npm run tester-notifications` (73 contrôles) + 2 dans
  verifier-cloisonnement.

## 3. Mise en service — à faire par Timo, une fois

### a. Supabase → SQL Editor → coller → Run

```sql
create table if not exists public.abonnements_push (
  endpoint   text primary key,
  user_id    text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists abonnements_push_user_id on public.abonnements_push (user_id);
alter table public.abonnements_push enable row level security;
revoke all on public.abonnements_push from anon, authenticated;
```

Personne côté navigateur ne peut lire ni écrire cette table (aucune
politique) : seul le serveur, avec la clé service_role, y touche.

### b. Vercel → Settings → Environment Variables (Production)

| Nom | Valeur |
|---|---|
| `VAPID_PUBLIC_KEY` | la clé publique, la même que `CLE_PUBLIQUE_PUSH` dans `src/lib/constants.js` |
| `VAPID_PRIVATE_KEY` | la clé privée remise dans le message (jamais dans le code, jamais `VITE_`) |
| `VAPID_SUBJECT` | `mailto:` suivi d'une adresse de contact BMI |
| `CRON_SECRET` | un mot de passe long, au choix (Vercel l'envoie à la tournée du matin) |

Puis **Redeploy** (les variables ne sont lues qu'au déploiement).

### c. Vérifier

Vercel → Settings → Cron Jobs doit montrer `/api/rappels-du-matin` à
`0 7 * * *`. Un employé se déconnecte, se reconnecte (la question
« Autoriser ? » apparaît une fois), puis quelqu'un lui écrit un message :
le téléphone vibre, écran éteint.

## 4. Ce qu'il faut dire aux employés

- **Une seule question, une seule fois par appareil** : « BMI Gestion
  souhaite vous envoyer des notifications » → **Autoriser**. Refusée, seul
  le réglage du téléphone peut revenir dessus (⚙ Paramètres le rappelle).
- **iPhone** : installer l'application sur l'écran d'accueil (Partager →
  Sur l'écran d'accueil) ; depuis Safari ouvert, pas de notification.
- **Tecno, Infinix, Xiaomi…** : Paramètres → Batterie → BMI Gestion →
  « Non optimisée » (sinon le téléphone coupe l'application en arrière-plan).
- **Téléphone partagé** : la déconnexion détache l'appareil ; la personne
  suivante qui se connecte le rattache à elle.
- **Sans réseau**, la notification attend et arrive à la reconnexion.

## 5. Ce qui n'est pas fait (à décider par Timo)

- Aucun réglage individuel (« je ne veux pas telle notification ») — voulu :
  « pas besoin d'activer quelque chose ». À ajouter seulement s'il le demande.
- Un compteur « N notifications » sur l'icône (badge Android) : non.
- La tournée du matin tourne à 7 h UTC = 7 h à Lomé ; changer l'heure =
  `vercel.json`.
