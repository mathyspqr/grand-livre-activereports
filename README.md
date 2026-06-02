# Grand Livre — PoC ActiveReportsJS (MESCIUS)

Proof of Concept d'un outil de **reporting 100 % client-side** pour Angular 20, en remplacement de
FastReport. Génère un **grand livre comptable** à partir de fichiers JSON, avec **designer embarqué** et
**export PDF** depuis le navigateur.

> 🔁 Un second PoC équivalent utilise **Stimulsoft Reports.JS** :
> https://github.com/mathyspqr/grand-livre-stimulsoft

---

## Stack

- **Angular 20** (standalone components, routing lazy-loaded)
- **@mescius/activereportsjs** + **@mescius/activereportsjs-angular**
- 100 % navigateur : aucun backend pour le rendu ou l'export

---

## Démarrer en local

```bash
npm install
npx ng serve
# puis ouvrir http://localhost:4200
```

> En local, ActiveReportsJS fonctionne en **mode évaluation** (un simple filigrane apparaît sur le rapport,
> sans blocage). Pour un déploiement sur un domaine public, une **clé de licence** MESCIUS est requise
> (voir « Licence » plus bas).

---

## Utilisation

1. Aller sur **Viewer**.
2. **« Charger le plan comptable »** (référentiel des comptes).
3. **« Charger des écritures »** (`Ecriture.json`). Le grand livre se génère dès que les deux sont chargés.
4. Choisir la **colonne de référence** : N° Pièce / ID écriture / N° Écriture.
5. **Exporter en PDF** depuis la barre d'outils du viewer.
6. **Designer** : modifier la mise en page, puis « Sauvegarder » → télécharge un modèle `.rdlx-json`.
7. De retour sur le Viewer : **« Charger un modèle »** pour réappliquer un `.rdlx-json` à vos données.

---

## Données

| Fichier | Rôle | Chargement |
|---|---|---|
| Plan comptable | **référentiel** (numéro + intitulé des comptes) | **importé par l'utilisateur** |
| `Ecriture.json` | les **écritures** comptables | **importé par l'utilisateur** |

> ⚠️ **Aucune donnée n'est embarquée dans l'application** : le plan comptable peut contenir des comptes
> nominatifs (données personnelles). L'utilisateur fournit les deux fichiers au moment de l'utilisation.

**Jointure** : `Ecriture.Compte` → `PlanComptable.Numero` (récupère l'intitulé du compte).

### Structure minimale d'une écriture (`Ecriture.json` = tableau d'objets)

```jsonc
[
  {
    "ID": 478174,
    "Compte": "4100000008",      // clé de jointure vers PlanComptable.Numero
    "Journal": "VT",             // "AN" = À Nouveau (sert au solde N-1)
    "Numero": "41353-MuD",       // n° d'écriture
    "NumeroPiece": "F2158",      // n° de pièce
    "Libelle": "EPUdF : ...",
    "MontantDebit": 85681.20,
    "MontantCredit": 0,
    "DateOperation": "2025-07-10"
  }
]
```

---

## Fonctionnalités

- Groupement par compte (n° + intitulé), avec **reprise des en-têtes** à chaque page
- Colonnes : N° pièce / Date / Libellé / Débit / Crédit / **Solde permanent** (running balance)
- **Totaux par compte** + **total général**
- **Numérotation des pages**
- **Paramétrage** de la colonne de référence (N° Pièce / ID / N° Écriture)
- **Designer embarqué** (édition + sauvegarde `.rdlx-json`)
- **Export PDF** client-side

---

## Architecture (résumé)

```
src/app/
├── services/grand-livre-data.service.ts   → données + jointure + définition du rapport (RDLX-JSON)
├── viewer/        → page Viewer (affichage, export PDF, imports écritures/modèle)
├── designer/      → page Designer (édition + sauvegarde .rdlx-json)
└── home/          → page d'accueil
```

Le service prépare les données (jointure, solde permanent, solde N-1 via journal `AN`, tri), les publie
dans `window.grandLivreData`, et le rapport les lit via `jsondata=@@grandLivreData`.

---

## Licence ActiveReportsJS

- **En local** : évaluation gratuite (filigrane), aucune clé nécessaire.
- **Sur un domaine déployé** : une **clé de licence** est obligatoire, sinon « License Not Found ».
  Coller la clé dans `src/main.ts` (`ACTIVEREPORTS_LICENSE_KEY`). Clé d'essai à demander à
  `us.sales@mescius.com` (ou via My Account → My Licenses → Distribution Licenses).
