# WhatsApp depuis le numéro BMI — état au 19/09/2026 (RACCORDÉ ✅)

Déplacé de CLAUDE.md le 06/09/2026, mot pour mot. **Timo a REPRIS le sujet
lui-même le 19/09/2026** (« je suis revenu sur ycloud pour scanner ») — la
consigne « ne pas relancer » est donc levée, mais **rien ne se construit dans
l'application sans son feu vert**.

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


---

## 19/09/2026 — Timo reprend : « je suis revenu sur ycloud pour scanner »

Capture de sa console YCloud (`ycloud.com/console/#/app/getStarted`), compte
**BMI Togo**, formule **Free**. Il est sur la page d'ACCUEIL : le raccordement
ne s'y trouve pas. Chemin redonné : **menu de gauche → WhatsApp → WhatsApp
accounts → Coexistence → Get started**, puis le QR se scanne **depuis le
téléphone BMI** (WhatsApp Business → Paramètres → Appareils connectés →
Connecter un appareil). Seul l'appareil PRINCIPAL du numéro peut scanner.

**DEUX CHOSES VUES SUR SA CAPTURE, dites honnêtement :**

1. ⚠ **Bandeau YCloud : « Service messages will be billed — Effective
   October 1, 2026 ».** À partir du 1er octobre 2026, les messages de
   « service » (les réponses dans la fenêtre de 24 h ouverte par le client)
   **ne sont plus gratuits** : ils passent au tarif des messages « Utility »,
   avec **1 000 messages de service gratuits par numéro et par mois**. La
   fenêtre de 24 h gratuite disparaît. Ça ne change RIEN au raccordement,
   mais ça change le coût : il faut le lui dire, pas le découvrir sur une
   facture.

2. ⚠ **Portefeuille YCloud : 0,5 USD.** De quoi essayer, pas de quoi servir.
   Le raccordement et le scan ne coûtent rien ; ce sont les messages ENVOYÉS
   qui se paient. À créditer quand l'envoi partira pour de vrai.

**RIEN N'A CHANGÉ CÔTÉ APPLICATION** : scanner le QR ne fera partir aucun
message depuis BMI-Gestion. C'est une étape d'infrastructure. Tout ce qui est
décrit plus haut (`api/whatsapp.js`, remplacement des ouvertures `wa.me` avec
repli, journal des envois, file hors ligne, **verrou formation**) reste À
CONSTRUIRE, et **seulement quand il le demandera**.

### Le même jour, l'étape suivante : « sous quelle identité envoyer ? »

Capture Timo dans la fenêtre Meta (« Embedded Signup »,
`business.facebook.com/…/dialog/oauth`) : **« Ajoutez votre numéro de
téléphone WhatsApp — Choisissez sous quelle identité vous souhaitez envoyer
des messages »**, avec une liste de trois choix :

1. « Saisir un nouveau numéro de téléphone » — **coché d'office, et c'est un
   piège** : il créerait un canal sur un numéro NEUF, c'est-à-dire la voie (2)
   que Timo a REFUSÉE le 02/09 (« les clients appellent sur WhatsApp, un
   numéro API ne reçoit pas d'appel »).
2. « Utiliser un nom affiché avec un numéro virtuel à la place » — pas son
   numéro du tout.
3. ✅ **« bmi togo · +228 99 96 84 88 · BMI Togo »**, marqué *Enregistré* —
   **LE BON**. C'est le vrai numéro BMI, déjà sur WhatsApp Business ; c'est
   lui qui ouvre la COEXISTENCE, donc le code QR.

**LE NUMÉRO BMI EST +228 99 96 84 88** (nom affiché « BMI Togo ») — noté ici
pour qu'on ne se repose plus la question. ⚠ Il doit être celui du TÉLÉPHONE
qu'on a en main au moment de scanner : seul l'appareil principal du numéro
peut scanner le QR.

### ✅ 19/09/2026 — LE RACCORDEMENT EST FAIT (« Connected »)

Capture Timo, YCloud → **WhatsApp accounts** :

| | |
|---|---|
| Compte | **bmi togo** |
| WABA ID | **885440708797061** (identifiant de compte, PAS un secret) |
| Propriétaire | BM : BMI Togo |
| Numéro | **+228 99 96 84 88** |
| **Statut** | **● Connected** |
| Limite | **250 clients distincts / jour** |
| Qualité | Unknown (normal : aucun message envoyé) |

Le parcours a été : YCloud → WhatsApp accounts → Coexistence → fenêtre Meta →
choix du numéro DÉJÀ ENREGISTRÉ (jamais « saisir un nouveau numéro ») → QR
scanné depuis le téléphone BMI → « Votre compte est associé à YCloud » →
Terminer. **La coexistence tient** : le numéro reste sur WhatsApp Business
dans le téléphone (appels, discussions, réponses des clients).

**CE QUI RESTE, ET QUI N'EST PAS RIEN :**

1. ⚠ **La limite de 250 clients distincts par jour** est celle d'un compte non
   vérifié — c'était prévu (voir plus haut) et c'est large pour BMI. La
   vérification d'entreprise la lève ; un petit triangle ⚠ à côté de
   « Owned by BM: BMI Togo » le rappelle sur la console.
2. ⚠⚠ **LES MODÈLES DE MESSAGES (« templates ») SONT LE VRAI PASSAGE OBLIGÉ.**
   Hors de la fenêtre de 24 h ouverte par le client, Meta n'accepte QUE des
   messages écrits d'avance et APPROUVÉS par elle. Or c'est précisément notre
   cas : un devis prêt, des identifiants, un lien de PV, une relance partent
   quand NOUS le décidons, pas en réponse au client. **Sans modèle approuvé,
   rien ne part.** Ils s'écrivent dans YCloud (bouton « Manage Template ») et
   Meta les valide (quelques heures à 1 jour). À écrire AVEC Timo : le texte
   est commercial, pas technique.
3. **Côté application, RIEN n'est construit** — et rien ne le sera sans sa
   demande. Le plan reste celui du 02/09 : `api/whatsapp.js` (**clé YCloud en
   variable Vercel, JAMAIS dans le code ni préfixée `VITE_`**), remplacement
   des ouvertures `wa.me` **avec repli** sur l'ouverture WhatsApp actuelle si
   le serveur refuse (un message n'est jamais perdu en silence), journal des
   envois (envoyé / livré / lu / échec + motif), file hors ligne, et
   **verrou formation : un compte d'entraînement n'envoie JAMAIS un vrai
   WhatsApp**.
4. Meta a annoncé qu'elle **examine l'entreprise** et recontacte **sous 24 h
   s'il y a un problème**.

---

## 📝 LES MODÈLES DE MESSAGES — les textes (19/09/2026)

Écrits avec Timo, un par un, dans YCloud → **Manage Template** → *Add
template*. On en soumet UN d'abord, on lit la réponse de Meta, et on n'envoie
les suivants qu'après : cinq modèles refusés d'un coup n'apprennent rien.

Réglages communs : **Category = Utility (Custom)**, **Language = French**,
Footer et Buttons VIDES, **Message validity period DÉSACTIVÉ** (réglage par
défaut = Meta réessaie jusqu'à 30 jours ; un devis doit arriver même si le
téléphone était éteint).

### 1. `devis_pret`

⚠ **LES MOTS SONT CEUX DE TIMO** (19/09/2026) : « normalement on dit *votre
devis (domaine) réalisé par BMI TOGO est prêt* ». Le DOMAINE (solaire,
portail, forage, vidéo surveillance…) est donc une variable à part — une
première version disait seulement « votre devis BMI TOGO est prêt », et le
client ne savait pas DE QUOI on lui parle quand il a demandé deux choses.

```
Bonjour {{1}}, votre devis {{2}} réalisé par BMI TOGO est prêt.

Montant : {{3}}

Vous pouvez le consulter, le valider ou demander une modification dans votre espace client : https://gestion.bmitogo.com

Identifiant : {{4}}
Mot de passe : {{5}}

BMI TOGO — Les bâtiments modernes et intelligents
```

Exemples à donner à Meta : `KOSSI MENSAH` · `solaire` · `1 250 000 F` ·
`kossi90112233` · `Bmi4827`.

⚠ **SI META REFUSE À CAUSE DU MOT DE PASSE** (c'est le risque connu de ce
modèle : un secret dans une catégorie *Utility*), on ne discute pas — on
remplace les deux lignes `Identifiant` / `Mot de passe` par une seule phrase
sans variable : **« Vos identifiants vous ont été remis par votre vendeur. »**

⚠ **UN MODÈLE DÉJÀ SOUMIS NE SE CORRIGE PAS TOUT DE SUITE** : en attente
(*Pending*) il est figé ; approuvé ou refusé, il s'ouvre par *Edit*. Et
**supprimer ne libère pas le nom** (Meta le réserve ~30 jours) : on ne
supprime jamais pour recréer sous le même nom, on ÉDITE.

### Les quatre suivants, à écrire après

`relance_devis`, `devis_valide_paiement`, `acces_espace_client`,
`rappel_echeance` — textes à reprendre de ce que l'application écrit déjà
(`texteRelanceDevis` dans lib/comptesClients.js, le partage de devis de
`screens/dimensionnement/Partages.jsx`), pour que le client lise la même
chose qu'aujourd'hui.
