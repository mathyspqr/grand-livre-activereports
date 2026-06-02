# Grand Livre comptable — Documentation des PoC de reporting Angular

> Remplacement de FastReport par un outil de reporting **100 % client-side** intégré à une interface Angular 20.
> Deux PoC ont été réalisés pour comparer les deux outils retenus en phase 1 :
> **PoC 1 — ActiveReportsJS (MESCIUS)** et **PoC 2 — Stimulsoft Reports.JS**.

---

## 1. Contexte

Logeas Informatique génère ses états comptables (dont le **grand livre**) avec FastReport côté serveur. L'objectif est de
passer à un outil **full-web**, sans dépendance serveur pour le rendu et l'export, intégrable dans Angular 20, avec un
**designer embarqué** utilisable par les utilisateurs finaux.

Les deux PoC produisent le **même grand livre** à partir des **mêmes données**, pour permettre une comparaison directe.

---

## 2. Données d'entrée

| Fichier | Rôle | Volume |
|---|---|---|
| `Ecriture.json` | Les écritures comptables (mouvements de l'exercice) | 3 622 lignes |
| `PlanComptableOfficiel.json` | Le plan comptable = **référentiel** (numéro + intitulé + hiérarchie) | 1 571 comptes |

### Lien entre les deux (jointure)

```
Ecriture.Compte  ──►  PlanComptable.Numero
```

Chaque écriture porte un code `Compte`. On récupère l'intitulé du compte dans le plan comptable via `Numero`.

### Choix d'architecture sur les données

- **Aucune donnée n'est embarquée dans l'application.** L'utilisateur importe **les deux fichiers** via l'interface :
  d'abord le **plan comptable**, puis les **écritures**.
- Le grand livre est généré **à la volée** une fois les deux fichiers chargés. Tant qu'ils ne le sont pas, le viewer affiche un
  écran d'accueil « Importez vos données ».
- **Pourquoi pas de données embarquées ?** Le plan comptable réel contient des **comptes nominatifs** (noms de clients/associés
  = données personnelles). Les garder hors du code/dépôt évite toute publication de données personnelles (RGPD).

---

## 3. Préparation des données (commune aux 2 PoC)

La logique de transformation est identique dans les deux PoC (fichier `services/grand-livre-data.service.ts`) :

1. **Chargement** du plan comptable + des écritures (les deux importés par l'utilisateur).
2. **Jointure** `Compte → Numero` pour récupérer l'intitulé de chaque compte.
3. **Aplatissement** : chaque écriture devient une ligne du grand livre avec :
   `CompteNumero, CompteIntitule, NumeroPiece, NumeroEcriture, EcritureID, DateOperation, Libelle, Debit, Credit`.
4. **Tri** par `CompteNumero` puis par `DateOperation`.
5. **Solde permanent** : cumul `(Débit − Crédit)` calculé **par compte** (remis à zéro à chaque changement de compte).
6. **Solde N-1** (« Solde du compte en fin d'exercice précédent ») : calculé à partir des écritures du **journal `AN`**
   (À Nouveau = reports d'ouverture). Couvre les comptes de bilan ; pour les classes 6/7 la donnée n'est pas dans les JSON
   fournis (elle vient d'une autre table côté Logeas — point laissé en suspens, validé par Nicolas).

---

## 4. Fonctionnalités couvertes (cahier des charges Nicolas)

| Exigence | PoC 1 (ActiveReportsJS) | PoC 2 (Stimulsoft) |
|---|---|---|
| Numérotation des pages | ✅ `Page N sur Y` | ✅ `Page {PageNumber} sur {TotalPageCount}` |
| Modification de l'état par les utilisateurs (designer) | ✅ designer embarqué | ✅ designer embarqué |
| Paramétrage en amont (N° Pièce / ID / N° Écriture) | ✅ sélecteur | ✅ sélecteur |
| Grand titre + sous-titres | ✅ | ✅ |
| Reprise des titres de colonnes à chaque page | ✅ `RepeatOnNewPage` | ✅ `printOnAllPages` |
| Totaux par compte (débit/crédit/solde) | ✅ | ✅ |
| Total général | ✅ | ✅ |
| Solde permanent (running balance) | ✅ | ✅ |
| Export PDF client-side | ✅ | ✅ |
| Import plan comptable + écritures (à la volée) | ✅ | ✅ |
| Sauvegarde / rechargement d'un modèle | ✅ `.rdlx-json` | ✅ `.mrt` |

---

## 5. PoC 1 — ActiveReportsJS (MESCIUS)

**Dossier :** `POC 1/grand-livre-poc`

### Stack
- Angular 20, composant Angular natif `@mescius/activereportsjs-angular` + moteur `@mescius/activereportsjs`.
- Rendu et export **100 % navigateur**.

### Comment c'est construit
- Le rapport est un **objet RDLX-JSON généré dynamiquement** en TypeScript (`getReportDefinition()` dans le service).
  C'est un **tableau (Table) avec un groupe par compte** :
  - en-tête de groupe = numéro + intitulé du compte + titres de colonnes (répétés à chaque page),
  - lignes de détail = une par écriture,
  - pied de groupe = totaux du compte + soldes,
  - pied de table = total général,
  - `PageFooter` = date / société / pagination.
- Les données sont exposées au moteur via une **variable globale** (`window.grandLivreData`) et la chaîne de connexion
  `jsondata=@@grandLivreData` (provider `JSON` d'ActiveReportsJS). Choix retenu après échec des blob-URL sous Safari/WebKit.
- Le **solde permanent** utilise l'expression RDL `RunningValue(... , Sum, "GroupeCompte")`.
- Les **totaux** utilisent les agrégats RDL `Sum(...)`.

### Designer / modèle
- Page `/designer` : éditeur ActiveReportsJS embarqué. Le bouton « Sauvegarder » **télécharge un fichier `.rdlx-json`**.
- Page `/viewer` : bouton « Charger un modèle » pour **réimporter un `.rdlx-json`** et l'appliquer aux données courantes.
  Bouton « Modèle d'origine » pour revenir au rapport généré par défaut.

### Lancer le PoC 1
```bash
cd "POC 1/grand-livre-poc"
npm install
npx ng serve          # http://localhost:4200
```

---

## 6. PoC 2 — Stimulsoft Reports.JS

**Dossier :** `POC 2/grand-livre-stimulsoft`

### Stack
- Angular 20, librairie `stimulsoft-reports-js` (scripts `reports` / `viewer` / `designer`) utilisée en **mode client-side**.
  *(Les wrappers `stimulsoft-viewer-angular` / `stimulsoft-designer-angular` sont orientés serveur — non utilisés ici.)*
- Rendu et export PDF **100 % navigateur**.

### Comment c'est construit
- Le rapport est **construit par code** via l'API moteur Stimulsoft (`services/report-builder.service.ts`), avec des bandes :
  - `StiReportTitleBand` = grand titre + sous-titres,
  - `StiGroupHeaderBand` (condition `{GrandLivre.CompteNumero}`, `printOnAllPages`) = en-tête de compte + titres de colonnes,
  - `StiDataBand` (source `GrandLivre`) = lignes de détail,
  - `StiGroupFooterBand` = totaux du compte + soldes,
  - `StiReportSummaryBand` = total général,
  - `StiPageFooterBand` = date / société / pagination.
- Données injectées via `DataSet.readJson({ GrandLivre: [...] })` puis `report.regData(...)` + `dictionary.synchronize()`.
- Le **solde permanent** et les **montants formatés FR** (`1 234,56 €`) sont **précalculés en TypeScript** (fiable).
  Les **totaux** utilisent les agrégats Stimulsoft `Sum(DataGrandLivre, GrandLivre.Debit)`.
- Le rapport est **pré-rendu** (`renderAsync2()`) **avant affichage** — nécessaire pour que `{PageNumber}` / `{TotalPageCount}`
  fonctionnent (pagination complète).

### Designer / modèle
- Page `/designer` : éditeur Stimulsoft embarqué. Le bouton Save **télécharge un fichier `.mrt`**.
- Page `/viewer` : bouton « Charger un modèle » pour **réimporter un `.mrt`** (`report.load(...)`), puis les données courantes
  sont réinjectées. Bouton « Modèle d'origine » pour revenir au rapport par défaut.

### Lancer le PoC 2
```bash
cd "POC 2/grand-livre-stimulsoft"
npm install
npx ng serve --port 4300   # http://localhost:4300
```

> ⚠️ Sans clé de licence, Stimulsoft affiche un **bandeau « trial version »** — c'est normal en évaluation, non bloquant.

---

## 7. Différences clés entre les deux intégrations

| Aspect | ActiveReportsJS | Stimulsoft |
|---|---|---|
| Définition du rapport | Objet **RDLX-JSON** (déclaratif) | **API moteur** (création de bandes par code) |
| Injection des données | Variable globale + `jsondata=@@` | `DataSet.readJson` + `regData` |
| Solde permanent | Expression `RunningValue` (moteur) | Précalculé en TypeScript |
| Format monétaire | Format RDL `#,##0.00 €` | Précalculé FR en TS + `StiCurrencyFormatService` pour les totaux |
| Pré-rendu requis | Non | Oui (`renderAsync2` pour la pagination) |
| Format de modèle | `.rdlx-json` | `.mrt` |
| Licence | Single Deployment 1 499 $/an | 900 $/dev/an (code source inclus) |

---

## 8. Workflow utilisateur (identique sur les 2 PoC)

```
1. Ouvrir le Viewer
2. « Charger le plan comptable »  → importer le plan comptable (référentiel)
3. « Charger des écritures »      → importer Ecriture.json  → le grand livre se génère
4. (option) changer la colonne de référence : N° Pièce / ID / N° Écriture
5. (option) exporter en PDF depuis la barre d'outils
6. (option) Designer → modifier la mise en page → Sauvegarder (.rdlx-json / .mrt)
7. (option) Viewer → « Charger un modèle » → réappliquer sa mise en page aux données
```

---

## 9. Point en suspens

**« Solde du compte en fin d'exercice précédent »** : pour les comptes de gestion (classes 6/7), la valeur affichée dans le
grand livre FastReport provient d'une **autre table** non incluse dans les JSON fournis. Le code est **prêt à la consommer**
dès que la donnée sera disponible (champs `SoldeDebitnmoins1` / `SoldeCreditnmoins1` du plan, ou export N-1). Décision validée
par Nicolas : à ajuster après validation.
