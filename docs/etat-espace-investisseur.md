# 💼 Espace investisseur — IDÉE NOTÉE, RIEN N'EST CONSTRUIT (22/11/2026)

**Demande de Timo (mot pour mot)** : « Espace investisseur… Créer un espace pour un
investisseur… où il a un tableau de bord : combien il a misé, et combien il a gagné
sur une période, l'historique des dividendes retirés et autres options. Tu devrais te
documenter par rapport à l'investissement dans les entreprises dans l'espace UMOA et
savoir quoi implémenter. Donc un rôle investisseur à créer, réfléchi. »
Il l'a dite maintenant « au risque d'oublier après » : ce fichier est là pour ça.
**On ne construit rien sans son feu vert** (règle : on décrit, il valide).

## Ce qui a été vérifié (recherche du 22/11/2026, sources à relire par le comptable)
- **BMI est une entreprise individuelle** (décision déjà notée : le « compte de
  l'exploitant », compte 104). Une entreprise individuelle **n'a pas d'actionnaires ni
  de dividendes** : le mot « dividende » ne s'applique qu'à une SOCIÉTÉ (SARL, SA…).
  Donner à quelqu'un des « dividendes » sans société ne repose sur aucun cadre légal.
- **Droit OHADA** (Acte uniforme sur les sociétés commerciales, révisé le 30/01/2014,
  applicable au Togo) : régime clair de distribution des dividendes ; **droit
  d'information permanent** des associés (pas seulement à l'assemblée annuelle) ; une
  décision qui viole les droits des associés peut être annulée. **Le régime FISCAL des
  dividendes n'est pas harmonisé** entre les pays : c'est la loi togolaise (Code général
  des impôts, revenus de capitaux mobiliers) qui dit la retenue — **le taux n'a pas pu
  être confirmé d'ici** (sources OTR / PwC « Togo Tax Facts 2026 » à ouvrir).
- **Autres façons d'accueillir un investisseur** : **compte courant d'associé** (c'est un
  PRÊT : créance remboursable, intérêts seulement si le taux est écrit — pas un
  dividende) ; **société en participation** (contrat entre associés, apports en argent,
  en nature ou en industrie, sans personnalité morale) ; **société unipersonnelle**
  (pour passer d'entrepreneur individuel à société) ; capital-investissement (cadre
  OHADA « embryonnaire » ; UEMOA : loi de 2006 sur les sociétés d'investissement à
  capital fixe).
- Je ne suis pas juriste : **tout cela est à faire confirmer par le comptable ou un
  avocat avant d'écrire un seul chiffre dans l'application.**

## La question qui commande tout (à poser à Timo AVANT de construire)
Quel est le lien réel avec l'investisseur ? Quatre cas, quatre écrans différents :
1. **Associé d'une société** (BMI passe en SARL / SA, ou une société est créée) → parts,
   dividendes décidés en assemblée, retenue à la source, droit d'information.
2. **Prêt / compte courant** → somme prêtée, intérêts convenus, remboursements. Pas de
   « dividendes », mais « intérêts » et « capital restant dû ».
3. **Société en participation** (contrat) → part des résultats fixée par le contrat.
4. **Participation à un projet précis** (un chantier, un stock) → rendement lié à ce projet.
L'application ne peut pas inventer la règle de calcul : **c'est le contrat qui la fixe**.

## Ce que pourrait être l'espace (esquisse, non validée)
- **Un rôle « investisseur »** : jamais un employé, jamais un client ; **ne voit AUCUNE
  donnée de l'entreprise** (ni ventes, ni clients, ni dettes), seulement SES chiffres.
- **Tableau de bord** : montant misé (avec les dates de chaque apport), valeur / gains
  sur une période choisie (la période se choisit comme ailleurs), total retiré, reste
  à percevoir, **historique des retraits** (date, montant, moyen, justificatif),
  documents (contrat, relevés PDF), et un **message** vers l'administrateur.
- **Qui écrit les chiffres** : l'administrateur principal seul (apport, distribution,
  retrait) — l'investisseur ne fait que lire, et peut « confirmer la réception »
  d'un versement, comme un salarié.
- Le calcul des gains se **range dans la comptabilité** (le compte de l'exploitant ou un
  compte d'associé), jamais un second registre qui divergerait.

## ⚠ Le piège de sécurité à ne pas manquer (leçon de la paie, 18/09/2026)
L'application télécharge les tables sur chaque appareil : un champ « caché » à l'écran
descend quand même sur le téléphone. **Les chiffres d'un investisseur ne doivent JAMAIS
vivre dans une table lue par tout le personnel** : une table à part, lisible seulement
par l'administrateur principal et par l'investisseur concerné (comme la fiche de paie
séparée), avec son script serveur et son banc sur base jetable. Et un compte
investisseur ne doit recevoir **aucune** des tables de l'entreprise (comme un client
ne reçoit que les siennes). À construire AVANT l'écran, pas après.

## Décisions possibles pour la suite
- Lui poser la question des quatre cas ci-dessus, et savoir si BMI compte devenir une
  société. Faire relire le cadre au comptable (retenue sur dividendes, forme juridique).
- Puis décrire l'écran précis, validé, avant tout code.
