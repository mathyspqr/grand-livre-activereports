# Documentation technique — Grand Livre (PoC ActiveReportsJS & Stimulsoft)

Document de référence technique détaillé des deux PoC. Pour la vue fonctionnelle, voir `DOCUMENTATION-POCs.md` ;
pour le comparatif des outils, voir `phase1_comparatif_reporting_angular.md`.

---

## 1. Architecture générale (commune aux deux PoC)

```
[ Plan comptable (import) ]   [ Écritures (import) ]   ← les deux importés par l'utilisateur
            └──────────────┬──────────────┘
                           ▼
                 SERVICE DE DONNÉES                 (grand-livre-data.service.ts)
   jointure Compte→Numéro · soldes · tri · mise en forme
                           ▼
              tableau « grand livre » à plat
                           ▼
            ┌──────────────┴───────────────┐
            ▼                               ▼
     COMPOSANT VIEWER               COMPOSANT DESIGNER
   (affiche + export PDF)        (édite la mise en page)
            ▲                               │
            └────── modèle sauvegardé ◄─────┘
```

Trois couches, chacune avec une responsabilité unique :

1. **Service de données** — prépare les données (« quoi afficher »).
2. **Moteur de reporting** (ActiveReportsJS ou Stimulsoft) — mise en page et rendu (« comment afficher »).
3. **Composants Angular** (viewer / designer) — relient l'interface utilisateur au moteur.

**Choix transverses :**
- **Aucune donnée embarquée** : plan comptable + écritures importés par l'utilisateur (le plan réel contient des comptes
  nominatifs = données personnelles ; on évite toute publication).
- **Angular 20 standalone** (pas de NgModule), routing **lazy-loaded** (chaque page chargée à la demande).
- **100 % navigateur** : rendu et export PDF sans aucun appel serveur.

---

## 2. La préparation des données (le cœur métier, commun)

Fichier : `src/app/services/grand-livre-data.service.ts` (logique quasi identique dans les deux PoC).

### 2.1 Les trois interfaces (les « formes » de données)

| Interface | Représente | Origine |
|---|---|---|
| `EcritureRaw` | une écriture **brute** (`Compte`, `Journal`, `MontantDebit/Credit`, `NumeroPiece`, `Numero`, `ID`, `DateOperation`…) | fichier `Ecriture.json` |
| `PlanComptableRaw` | un compte **brut** (`Numero`, `Intitule`, `SoldeDebitnmoins1`…) | plan comptable |
| `GrandLivreEntry` | une **ligne finale** du grand livre (nettoyée, enrichie) | calculée en code |

`[key: string]: unknown` sur les deux interfaces « Raw » = on tolère les dizaines de champs JSON non utilisés sans devoir
tous les déclarer. `GrandLivreEntry` est au contraire un objet **fermé** (uniquement les champs utiles au rapport).

### 2.2 Chargement et indexation

- **`loadPlanFromFile(file)`** : lit le fichier, le parse, et **indexe** les comptes dans une `Map<Numero, compte>` :
  ```ts
  this.planComptable = new Map(planArray.map((p) => [p.Numero, p]));
  ```
  La `Map` permet un accès **O(1)** (`planComptable.get("768")` instantané) au lieu de parcourir 1571 comptes à chaque
  écriture — c'est l'équivalent d'un **index de base de données**, indispensable vu les ~3600 écritures.
- **`loadEcrituresFromFile(file)`** : lit/valide (doit être un tableau) et stocke dans `this.ecritures`.
- **`hasPlan()` / `hasEcritures()`** : drapeaux d'état (pilotent l'écran d'accueil du viewer).

### 2.3 `buildGrandLivreData()` — la transformation (3 passes)

1. **Solde N-1** (1er passage) : on somme, **par compte**, les écritures du **journal `AN`** (À Nouveau = reports
   d'ouverture, qui représentent le solde de clôture de l'exercice précédent) :
   ```ts
   for (const ec of this.ecritures)
     if (ec.Journal === 'AN') { /* cumul debit/credit dans soldeAnByCompte */ }
   ```
2. **Jointure + aplatissement** (2e passage) : pour chaque écriture, on récupère son compte dans le plan
   (`this.planComptable.get(ec.Compte)` = **la jointure** `Compte → Numéro`) et on construit une `GrandLivreEntry` :
   - l'**intitulé** vient du plan (`plan?.Intitule`) — absent de l'écriture,
   - renommage (`MontantDebit` → `Debit`),
   - valeurs de repli (`?? 0`, `?? ''`) pour la robustesse,
   - le solde N-1 suit une **cascade de secours** : journal `AN` → `SoldeDebitnmoins1` → `TotalDebitnmoins1` → 0.
3. **Tri** : par `CompteNumero`, puis par `DateOperation` (indispensable pour le regroupement par compte et l'ordre
   chronologique).

> ⚠️ **Solde « fin d'exercice précédent » pour les classes 6/7** : la valeur du PDF FastReport vient d'une **autre table**
> non fournie dans les JSON. Le code est prêt à la consommer (cascade ci-dessus) ; en attendant, la ligne reste vide pour
> ces comptes. Point validé « à ajuster plus tard » par Nicolas.

---

# 3. PoC 1 — ActiveReportsJS (`POC 1/grand-livre-poc`)

## 3.1 Stack et rôle des fichiers

| Fichier | Rôle |
|---|---|
| `services/grand-livre-data.service.ts` | données + jointure + **génère la définition du rapport** (objet RDLX-JSON) |
| `viewer/` (ts/html/scss) | page Viewer : affichage, export PDF, imports (plan, écritures, modèle), sélecteur de colonne |
| `designer/` (ts/html/scss) | page Designer : éditeur embarqué + sauvegarde `.rdlx-json` |
| `home/`, `app.routes.ts` | accueil + navigation lazy-loaded |
| `angular.json` | CSS du moteur, `allowedCommonJsDependencies` (xregexp, jszip…), budgets relevés |
| `main.ts` | hook `Core.setLicenseKey()` (clé de licence pour déploiement) |

## 3.2 Comment le rapport est défini

Le rapport **n'est pas un fichier statique** : `getReportDefinition(pieceColumn)` construit **en mémoire** un objet
**RDLX-JSON** (format natif ActiveReportsJS). Sa structure :

- **`Page`** : A4 (21 × 29,7 cm), marges 1,5 cm.
- **`DataSources` / `DataSets`** : déclare la source `JSON` et les champs disponibles.
- **`ReportParameters`** : le paramètre **`PieceColumn`** (valeur = le choix utilisateur), `Hidden: true` (fixé par le code).
- **`Body`** : titre « Grand livre provisoire » + sous-titres + date + filet, puis le **tableau** (`buildTableDefinition()`).
- **`PageFooter`** : date / société / `Page X sur Y`.

`buildTableDefinition()` construit la **Table** :
- **`TableGroups`** groupée sur `=Fields!CompteNumero.Value` (`PreventOrphanedHeader/Footer` pour ne pas couper un compte
  en bas de page),
- **en-tête de groupe** (`RepeatOnNewPage: true`) : bandeau compte + ligne de titres de colonnes (→ reprise à chaque page),
- **`Details`** : 6 cellules (référence / Date / Libellé / Débit / Crédit / Solde),
- **pied de groupe** : `Total débit/crédit`, `Solde du compte`, `Solde fin d'exercice précédent`,
- **pied de table** : `Total général`.

### Expressions clés (calculées par le moteur)
```
# colonne de référence (selon le paramètre)
=IIF(Parameters!PieceColumn.Value = "NumeroPiece", Fields!NumeroPiece.Value,
     IIF(Parameters!PieceColumn.Value = "ID", Fields!EcritureID.Value, Fields!NumeroEcriture.Value))

# solde permanent (cumul par compte, remis à zéro à chaque groupe)
=RunningValue(Fields!Debit.Value, Sum, "GroupeCompte") - RunningValue(Fields!Credit.Value, Sum, "GroupeCompte")

# totaux
=Sum(Fields!Debit.Value)     # par compte (pied de groupe) ou global (pied de table)
```

## 3.3 Comment les données arrivent dans le moteur

```
registerGlobalData()
  └─ window.grandLivreData = buildGrandLivreData()   ← publication dans une variable globale
  └─ retourne "grandLivreData"
       ↓
  ConnectString: "jsondata=@@grandLivreData"          ← le rapport lit cette variable
```

> Choix de la **variable globale** retenu après échec des **blob-URL sous Safari/WebKit** (le worker du moteur n'arrivait
> pas à charger un blob). `as any` sur `window` = uniquement pour satisfaire TypeScript.

## 3.4 Composant Viewer (`viewer.component.ts`)

- `providers` : `PdfExportService` + `AR_EXPORTS` → **active l'export PDF** dans la barre d'outils.
- `@ViewChild('viewer')` : référence au composant `<gc-activereports-viewer>` pour appeler `.open(reportDef)`.
- **`loadReport()`** : point de passage **unique** de l'affichage, protégé par des **gardes** :
  ```ts
  if (!this.viewerReady || !this.dataService.hasPlan()) return;
  if (!this.dataService.hasEcritures()) return;
  const reportDef = this.customTemplate ?? this.dataService.getReportDefinition(this.pieceColumnChoice);
  this.viewer.open(reportDef as any);
  ```
  Toutes les actions (init viewer, import plan, import écritures, changement de colonne, import/reset modèle) appellent
  `loadReport()` ; lui seul décide si les conditions sont réunies. C'est une approche **défensive** qui gère l'ordre
  imprévisible des événements asynchrones.

## 3.5 Designer & modèle
- `/designer` : éditeur ActiveReportsJS embarqué ; « Sauvegarder » **télécharge un `.rdlx-json`**.
- `/viewer` : « Charger un modèle » réimporte un `.rdlx-json` (accepte `{definition}` ou rapport brut) et l'applique aux
  données courantes ; « Modèle d'origine » revient au rapport généré.

---

# 4. PoC 2 — Stimulsoft Reports.JS (`POC 2/grand-livre-stimulsoft`)

## 4.1 Stack et rôle des fichiers

| Fichier | Rôle |
|---|---|
| `services/grand-livre-data.service.ts` | données + jointure ; **en plus**, pré-formate montants (FR) et dates |
| `services/report-builder.service.ts` | **construit le rapport PAR CODE** (bandes Stimulsoft) + injecte les données + charge un `.mrt` |
| `viewer/` | page Viewer (`StiViewer`), export PDF, imports |
| `designer/` | page Designer (`StiDesigner`), sauvegarde `.mrt` |
| `angular.json` | CSS Stimulsoft, `allowedCommonJsDependencies`, budgets fortement relevés (bundle ~14 Mo) |

> On utilise les **scripts client-side** `stimulsoft.reports/viewer/designer` (et **non** les wrappers
> `stimulsoft-*-angular`, orientés serveur). Ils augmentent tous le **même singleton global** `Stimulsoft`.

## 4.2 Spécificité du service de données
En plus de la jointure (identique au PoC 1), le service **pré-calcule en TypeScript** ce qui est peu fiable à faire dans le
moteur :
- **`SoldePermanent`** : cumul `(Débit − Crédit)` par compte ;
- **`DebitStr` / `CreditStr` / `SoldePermanentStr`** : montants formatés FR (`toLocaleString('fr-FR')` + `€`), zéros masqués ;
- **`DateAffichee`** : `ISO → dd/MM/yyyy`.

`getDataObject()` renvoie `{ GrandLivre: [...] }` — `GrandLivre` devient le **nom de la table** référencée dans le rapport.

## 4.3 Construction du rapport (`report-builder.service.ts`)

`build(dataObject, pieceColumn)` assemble le rapport **bande par bande** :

| Bande | Contenu |
|---|---|
| `StiReportTitleBand` | grand titre + sous-titres + date |
| `StiGroupHeaderBand` | condition `{GrandLivre.CompteNumero}`, **`printOnAllPages = true`** → en-tête compte + titres de colonnes répétés |
| `StiDataBand` | `dataSourceName = 'GrandLivre'` → une ligne de détail par écriture |
| `StiGroupFooterBand` | `Total débit/crédit`, `Solde du compte`, `Solde fin d'exercice précédent` |
| `StiReportSummaryBand` | total général (bandeau navy) |
| `StiPageFooterBand` | date / société / `Page {PageNumber} sur {TotalPageCount}` |

**Helper `makeText(x, y, w, h, text, opts)`** : fabrique une zone de texte positionnée en cm (police, couleur via
`textBrush`, fond via `brush`, alignement, format monétaire, bordures). Chaque texte reçoit un **nom unique** (requis par
Stimulsoft).

**Règle d'ordre cruciale** : chaque bande est **ajoutée à la page AVANT** d'y insérer ses textes — sinon erreur
`this.report.calculationMode null` (les composants doivent être rattachés au rapport).

**Totaux** via agrégats avec portée explicite : `Sum(DataGrandLivre, GrandLivre.Debit)`.

## 4.4 Injection des données et rendu

- **`applyData(report, dataObject)`** :
  ```ts
  const dataSet = new Stimulsoft.System.Data.DataSet('GrandLivreData');
  dataSet.readJson(dataObject);          // binding robuste client-side
  report.dictionary.databases.clear();
  report.regData('GrandLivreData', 'GrandLivreData', dataSet);
  report.dictionary.synchronize();
  ```
- **`loadTemplate(mrt, dataObject)`** : `report.load(mrt)` (modèle sauvegardé) puis `applyData()` (réinjecte les données).
- **Pré-rendu obligatoire** : dans le viewer, `await report.renderAsync2()` **avant affichage** — nécessaire pour que
  `{PageNumber}` / `{TotalPageCount}` fonctionnent (la pagination doit être calculée).
- **Montage unique** : `viewer.renderHtml(host)` n'est appelé **qu'une fois** (`viewerMounted`) ; les rendus suivants se font
  par simple affectation `viewer.report = report` (sinon le changement de colonne ne se rafraîchit pas).

## 4.5 Composant Viewer
- `canRender()` = `hasPlan() && hasEcritures()` : garde commune à toutes les actions.
- Dates calculées en TS (`todayFr()`, `todayFrLong()`) car les fonctions d'expression Stimulsoft (`DateToStr`, `Today()`)
  cassaient le parseur.

## 4.6 Designer & modèle
- `/designer` : éditeur Stimulsoft embarqué ; la sauvegarde **télécharge un `.mrt`**.
- `/viewer` : « Charger un modèle » réimporte un `.mrt` et lui réinjecte les données.

---

## 5. Différence d'approche entre les deux moteurs

| Aspect | ActiveReportsJS | Stimulsoft |
|---|---|---|
| Définition du rapport | **déclarative** (objet RDLX-JSON) | **impérative** (bandes créées par code) |
| Injection des données | variable globale + `jsondata=@@` | `DataSet.readJson` + `regData` |
| Solde permanent | expression moteur `RunningValue` | pré-calculé en TS |
| Format monétaire | format RDL `#,##0.00 €` | pré-formaté FR en TS + `StiCurrencyFormatService` (totaux) |
| Pré-rendu requis | non | **oui** (`renderAsync2`) |
| Format de modèle | `.rdlx-json` | `.mrt` |
| Licence en ligne | **clé obligatoire** sur domaine déployé | bandeau « trial » non bloquant |

Pour l'utilisateur final, le résultat est **identique** : même grand livre, mêmes fonctionnalités, 100 % navigateur.

---

## 6. Pièges rencontrés & solutions (utile en démo / maintenance)

| Symptôme | Cause | Solution |
|---|---|---|
| (PoC1) « TextBox report item not supported » | types RDLX en PascalCase | types en **minuscules** (`textbox`, `table`) |
| (PoC1) « Rows count mismatch » | clé `Grouping` au lieu de `Group` | utiliser **`Group`** |
| (PoC1) blob-URL « Load failed » (Safari) | WebKit + blob dans le worker | données via **`window.grandLivreData`** (`jsondata=@@`) |
| (PoC1) « License Not Found » en ligne | ActiveReportsJS bloque sur domaine sans clé | clé via `Core.setLicenseKey()` (demande MESCIUS) |
| (PoC2) `this.report.calculationMode null` | textes ajoutés avant rattachement de la bande à la page | ajouter la bande à la page **puis** les textes |
| (PoC2) « Parser error » | `DateToStr` / concaténation `PageNumber()` | dates en TS + expressions inline `{PageNumber}` |
| (PoC2) `engine.pageNumbers null` | pagination pas calculée | **pré-rendu** `renderAsync2()` avant affichage |
| (PoC2) changement de colonne sans effet | `renderHtml` rappelé à chaque fois | `renderHtml` **une seule fois**, puis `viewer.report = …` |

---

## 7. Lancer les projets

```bash
# PoC 1 — ActiveReportsJS
cd "POC 1/grand-livre-poc" && npm install && npx ng serve            # http://localhost:4200

# PoC 2 — Stimulsoft
cd "POC 2/grand-livre-stimulsoft" && npm install && npx ng serve --port 4300   # http://localhost:4300
```

Dans le Viewer : **Charger le plan comptable** → **Charger des écritures** → le grand livre se génère (export PDF dispo).
