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

   **VÉRIFIÉ LE 20/09/2026**, Timo ayant envoyé le lien du billet YCloud
   (`ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026`).
   ⚠ **Ce lien n'est PAS ouvrable depuis l'environnement de travail**
   (`EGRESS_BLOCKED`, comme tout `ycloud.com`) : le point a donc été recoupé
   sur la documentation Meta et trois sources indépendantes, et **on le dit**
   plutôt que de laisser croire qu'on a lu la page. Ce qui en ressort :
   - **les tarifs des MODÈLES ne bougent pas.** *Marketing* et *utility*
     étaient déjà payants ; leur prix est **inchangé**. Les 14 F / 4 F
     annoncés à Timo **restent valables**.
   - ce qui devient payant, c'est la **réponse libre dans la fenêtre de
     24 h**, au tarif d'un *utility* du pays, **1 000 offertes par numéro et
     par mois** (remise à zéro chaque mois, rien ne se reporte) ;
   - et **l'exonération des modèles *utility* ENVOYÉS DANS la fenêtre de
     24 h** (en place depuis juillet 2025) **prend fin** le même jour.
   - ce qu'un client NOUS envoie reste gratuit, et la fenêtre de 72 h des
     publicités « Click to WhatsApp » ne bouge pas.
   - ⚠ **Un moyen de paiement doit être en place avant le 30/09/2026**,
     sinon Meta cesse de délivrer les messages de service au 1er octobre.
     Chez nous, c'est le **crédit YCloud** (Settings → Billing → Recharge).

   **CE QUE ÇA VEUT DIRE POUR BMI**, en une phrase : **l'étape 1 n'est pas
   concernée** — l'application n'envoie que des MODÈLES, jamais une réponse
   libre. C'est **l'étape 2 (la réception)** que ça chiffre : répondre à un
   client depuis 💬 Messages coûtera un *utility* au-delà des 1 000 du mois.
   Au volume de BMI, les 1 000 couvrent large — mais il faut le savoir AVANT
   de construire l'étape 2, pas après.

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

⚠ **CE TEXTE A ÉTÉ REFUSÉ DEUX FOIS, ET IL A CHANGÉ** (voir plus bas) : les
deux lignes `Identifiant` / `Mot de passe` sont REMPLACÉES par une phrase
sans variable — **« Vos identifiants vous ont été remis par votre vendeur. »**
Il ne reste que **3 variables**, et le modèle s'appelle désormais
**`devis_disponible`**, en catégorie **Marketing**.

⚠ **UN MODÈLE DÉJÀ SOUMIS NE SE CORRIGE PAS TOUT DE SUITE** : en attente
(*Pending*) il est figé ; approuvé ou refusé, il s'ouvre par *Edit*. Et
**supprimer ne libère pas le nom** (Meta le réserve ~30 jours) : on ne
supprime jamais pour recréer sous le même nom, on ÉDITE.

⚠ **UN PREMIER ENVOI A ÉCHOUÉ SUR « system error »** (19/09/2026) — message
passe-partout de YCloud, PAS un refus de Meta (un refus s'affiche *Rejected*
avec un motif). **Le renvoi immédiat est passé** : `French · Submitted`. À
retenir : devant « system error », on clique **Modify** (jamais *Ignore*, qui
jette le texte), on vérifie que CHAQUE variable a son exemple, puis on renvoie.

### ⚠⚠ LA LEÇON DU PREMIER REFUS : `INCORRECT_CATEGORY` (19/09/2026)

`devis_pret` a été **refusé par Meta**, et **pas pour le mot de passe** —
c'était le risque annoncé, ce n'était pas le bon. Motif écrit :
**`INCORRECT_CATEGORY` — « This template contains content that does not match
the category you selected. »**

**Meta a raison, et il faut le comprendre une fois pour toutes :**

| Catégorie | Ce que Meta y range |
|---|---|
| **Utility** | ce qui concerne une opération DÉJÀ engagée : confirmation de commande, reçu, échéance d'un contrat signé, suivi de livraison, rendez-vous. |
| **Marketing** | **toute OFFRE** : promotion, relance commerciale… **et un DEVIS en est une.** |

Un devis propose un prix pour emporter une affaire : c'est une offre
commerciale, pas le suivi d'une opération en cours. **`devis_pret` et
`relance_devis` sont donc du MARKETING.** `devis_valide_paiement` et
`rappel_echeance`, eux, parlent d'un contrat DÉJÀ signé : ils restent
**Utility**.

⚠ **Ne pas tricher là-dessus.** Déguiser du marketing en utility se paie
deux fois : le modèle est refusé, et les `INCORRECT_CATEGORY` répétés abîment
la note du compte (*Account Quality*), donc la capacité à envoyer.

**Ce que ça change en pratique :**
- **le prix** — un message marketing coûte environ **14 F** contre **4 F**
  pour un utility (ordre de grandeur « Reste de l'Afrique », à vérifier sur la
  page *Pricing* de YCloud, qui fait foi). Au volume de BMI, l'écart reste de
  l'ordre de quelques centaines de francs par mois. ⚠ **Le changement de
  tarif du 1er octobre 2026 ne touche PAS ces deux-là** (vérifié le
  20/09/2026, voir plus haut) ;
- **le client peut refuser les messages commerciaux** d'une entreprise, et
  WhatsApp limite le marketing par personne. Un devis attendu passera ; il
  faut juste savoir que ce canal-là n'est pas garanti comme un utility.

### ⚠⚠ LE SECOND REFUS, ET LA VRAIE CAUSE : UN MOT DE PASSE NE VOYAGE PAS

Passé en **Marketing** sans toucher au texte (un seul changement à la fois) :
**refusé encore, même motif `INCORRECT_CATEGORY`.** Deux catégories, deux
refus, un seul point commun — **le mot de passe**.

**Meta a une TROISIÈME catégorie : `Authentication`**, réservée aux codes et
identifiants de connexion. Dès qu'un modèle porte « Identifiant / Mot de
passe », le classement automatique le range LÀ — donc ni utility, ni
marketing, quoi qu'on coche. Et *Authentication* ne nous sert à rien : c'est
un format rigide (un code à usage unique, rien d'autre), on n'y met pas un
devis.

**RÈGLE, définitive : aucun identifiant, aucun mot de passe dans un modèle.**
Le soupçon du départ était le bon ; c'est la façon dont Meta le DIT qui
trompait — il parle de catégorie, jamais de secret.

⚠ **CONSÉQUENCE ACTÉE : le modèle `acces_espace_client` N'EXISTERA PAS.** Les
identifiants d'un nouveau client continuent de partir **comme aujourd'hui** :
l'ouverture WhatsApp depuis l'application, à la main (`envoyerWhatsApp`), qui
n'est pas un modèle et ne dépend d'aucune validation de Meta. Rien n'est
perdu — c'est déjà la façon de faire. **Ne pas le reproposer.**

### ⚠ LE NOM AUSSI SE FIGE — ET YCLOUD EN INVENTE UN

Le champ *Template name* est **pré-rempli** par YCloud
(`template_marketing_20260919052907`) : si on ne le remplace pas, c'est ce
nom-là qui part chez Meta, et **il ne se corrige plus** (comme la catégorie).
Arrivé le 19/09/2026 sur `relance_devis`.

Ce n'est pas grave et **rien n'est perdu** : on **supprime** le modèle mal
nommé et on le recrée sous le bon nom. La réservation d'un mois frappe alors
le nom inventé — dont personne ne veut. ⚠ **C'est le seul cas où supprimer
est la bonne idée** : partout ailleurs (un modèle REFUSÉ dont on veut garder
le nom), on laisse dormir.

⚠ **Le nom compte pour la suite** : c'est lui que le code citera pour envoyer.
`relance_devis` se lit ; `template_marketing_20260919052907` ne se lit pas.

### ⚠ LA CATÉGORIE SE FIGE À LA CRÉATION

*Edit* rouvre le CONTENU, jamais la catégorie (elle s'affiche en texte mort).
Se tromper de catégorie oblige donc à un **nouveau modèle sous un NOUVEAU
nom** — d'où `devis_pret` (utility, refusé, laissé à dormir) puis
**`devis_disponible`** (marketing). ⚠ On ne supprime PAS le refusé pour
reprendre son nom : Meta réserve le nom d'un modèle supprimé environ un mois,
et un modèle refusé ne coûte rien et n'envoie rien.

### 📌 LA CATÉGORIE DE CHAQUE MODÈLE

| Modèle | Catégorie | Pourquoi |
|---|---|---|
| `devis_disponible` | **Marketing** | un devis est une OFFRE |
| `relance_devis` | **Marketing** | relance d'une offre |
| `devis_valide_paiement` | **Utility** | contrat DÉJÀ signé |
| `rappel_echeance` | **Utility** | échéance d'un contrat en cours |
| ~~`acces_espace_client`~~ | — | **abandonné** (secret) |

**État au 19/09/2026, les QUATRE modèles sont soumis** — noms corrects,
catégories correctes, aucun secret dedans :

| Modèle | Catégorie | Statut |
|---|---|---|
| `devis_disponible` | Marketing | *In review* |
| `relance_devis` | Marketing | *In review* |
| `devis_valide_paiement` | Utility | *In review* |
| `rappel_echeance` | Utility | *In review* |

(`devis_pret`, refusé, ne sert plus à rien — il n'envoie rien et ne coûte rien.)

## ✅ 19/09/2026 — L'ÉTAPE 1 EST CONSTRUITE (« lance l'étape 1 »)

Timo a demandé l'explication d'abord (« explique-moi d'abord ce que ça change
à l'écran »), puis : **« lance l'étape 1 »** — l'ENVOI seul. Détail des règles
dans CLAUDE.md § « WhatsApp depuis le numéro BMI ». Ce qui existe :

| Fichier | Ce qu'il fait |
|---|---|
| `src/lib/whatsappModeles.js` | Les 4 modèles et **l'ordre exact de leurs trous** (sans import : le serveur le lit tel quel) |
| `src/whatsapp.js` | **Le seul chemin** d'un envoi — et le repli sur l'ouverture WhatsApp |
| `api/whatsapp.js` | Remet le message à YCloud ; **garde la clé**, revérifie le mur |
| `scripts/verifier-whatsapp.mjs` | **71 contrôles** (`npm run verifier-whatsapp`) |

**Les écrans touchés** : 📋 Tous les devis (📲 Relancer) et le partage d'un
devis (Dimensionnement). 📋 Dettes n'a PAS bougé : `rappel_echeance` attend un
plan de règlement (voir plus haut).

### ⚠⚠ CE QU'IL RESTE À FAIRE, ET SANS QUOI RIEN NE PART

**Deux variables sur Vercel** (Settings → Environment Variables), à poser par
Timo, **jamais préfixées `VITE_`** :

| Nom | Valeur |
|---|---|
| `YCLOUD_API_KEY` | la clé d'API de la console YCloud |
| `WHATSAPP_NUMERO_BMI` | `+22899968488` |

Puis un redéploiement. **Tant qu'elles manquent, rien ne casse** : l'envoi
automatique est refusé proprement et WhatsApp s'ouvre comme avant.

⚠⚠ **LES DEUX PIÈGES DE CE RÉGLAGE, tombés tous les deux le 19/09/2026** —
l'application disait « Le serveur n'est pas encore configuré pour WhatsApp »
alors que tout semblait posé :

1. **LE NOM DOIT ÊTRE EXACT.** La variable avait été nommée `YCLOUD_API` au
   lieu de `YCLOUD_API_KEY`. Le serveur cherche le nom qu'il cherche ; il ne
   devine pas. ⚠ Et une variable « sensitive » ne se RENOMME pas : on la
   retire et on la recrée avec la clé recollée.
2. **L'ORDRE COMPTE : variables D'ABORD, redéploiement ENSUITE.** Vercel ne
   lit les variables qu'au moment du déploiement. Le premier essai avait un
   déploiement de **18 h 08** et des variables posées à **18 h 27** : le
   serveur en service ne les avait jamais vues. Corrigé à 21 h 13 (clé) puis
   21 h 14 (redéploiement) — **28 secondes d'écart, dans le bon sens**.

⚠ **Comment on l'a trouvé, et c'est la leçon** : en LISANT les noms des
variables du projet (jamais leurs valeurs — une clé « sensitive » ne ressort
pas, et on ne la demande pas), puis en comparant l'HEURE du déploiement à
celle des variables. **On mesure, on ne présume pas** — ici aussi.

### CE QUI N'EST PAS FAIT, ET QUI A ÉTÉ DIT

- **« Livré » et « lu » ne s'affichent pas.** Il faudrait que Meta nous
  rappelle (une adresse de retour, un webhook), et que ce retour sache
  retrouver le devis pour y écrire. C'est un chantier à part. La trace dit
  donc « envoyé du numéro BMI », jamais « lu » — le banc l'impose.
- **L'étape 2 (la RÉCEPTION)** : les réponses des clients dans 💬 Messages, la
  fenêtre de 24 h affichée, qui a le droit de répondre, le partage avec le
  téléphone BMI. **Rien n'est construit, et rien ne le sera sans sa demande.**
  ⚠ **Et elle ne sera plus gratuite à partir du 1er octobre 2026** (voir le
  point « Service messages will be billed » plus haut) : chaque réponse libre
  au-delà des 1 000 du mois coûte un *utility*. À dire à Timo le jour où il
  demande l'étape 2, avant d'écrire une ligne.

### Les quatre suivants

⚠ **ILS REPRENNENT CE QUE L'APPLICATION ÉCRIT DÉJÀ** (`texteRelanceDevis`,
lib/comptesClients.js) : le client doit lire la même chose qu'aujourd'hui.
Deux différences assumées, et il faut les connaître :
- **le gras `*…*` a été retiré** (cosmétique ; un signe de moins à faire
  accepter sur les premiers modèles) ;
- **la relance ne porte plus les identifiants** : à ce stade le client a déjà
  son compte, et un secret de moins dans un modèle est un risque de refus en
  moins. L'ouverture WhatsApp manuelle d'aujourd'hui les garde.

**Ordre d'envoi** : `relance_devis`, `devis_valide_paiement` et
`rappel_echeance` ne contiennent AUCUN secret — ils partent tout de suite.
`acces_espace_client` en porte un : on attend de voir si `devis_pret` passe
avec son mot de passe avant de le soumettre.

#### 2. `relance_devis` — devis proposé, sans réponse (seuil 15 jours)

```
Bonjour {{1}}, nous revenons vers vous au sujet du devis {{2}} de {{3}} que nous vous avons envoyé le {{4}}. Avez-vous pu l'examiner ?

Vous pouvez le consulter, le valider ou demander une modification dans votre espace client : https://gestion.bmitogo.com

Nous restons à votre disposition pour toute question.

BMI TOGO — Les bâtiments modernes et intelligents
```

Exemples : `KOSSI MENSAH` · `solaire` · `1 250 000 F` · `12/09/2026`

#### 3. `devis_valide_paiement` — devis validé, pas encore payé

```
Bonjour {{1}}, merci d'avoir validé votre devis BMI TOGO de {{2}} (contrat {{3}}).

Pour lancer votre installation, il ne reste plus qu'à passer régler à la boutique {{4}}.

Dès votre règlement, nous programmons l'installation.

BMI TOGO — Les bâtiments modernes et intelligents
```

Exemples : `KOSSI MENSAH` · `1 250 000 F` · `CT-2026-014` · `BMI DEMAKPOE`

#### 5. `rappel_echeance` — une échéance du plan de règlement arrive

⚠ **Aucun mot qui accuse** : ni « impayé », ni « retard », ni « vous devez ».
Un rappel d'échéance est un service rendu, pas une mise en demeure — et Meta
range les modèles comminatoires du mauvais côté.

```
Bonjour {{1}}, une échéance de votre règlement BMI TOGO arrive le {{2}}.

Montant attendu : {{3}}
Reste à régler : {{4}}

Vous pouvez passer à la boutique {{5}}, ou répondre à ce message si vous avez une question.

BMI TOGO — Les bâtiments modernes et intelligents
```

Exemples : `KOSSI MENSAH` · `30/09/2026` · `250 000 F` · `750 000 F` ·
`BMI DEMAKPOE`
