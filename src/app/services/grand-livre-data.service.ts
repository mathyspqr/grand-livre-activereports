import { Injectable } from '@angular/core';

export interface EcritureRaw {
  ID: number;
  Numero: string;
  NumeroPiece: string;
  Compte: string;
  Journal: string;
  Libelle: string;
  MontantDebit: number;
  MontantCredit: number;
  DateOperation: string;
  DateCreation: string;
  NumeroSaisie: number;
  [key: string]: unknown;
}

export interface PlanComptableRaw {
  Numero: string;
  Intitule: string;
  CompteTerminal: number;
  ComptePere: string;
  Niveau: number;
  Ordre: number;
  SoldeDebitnmoins1: number | null;
  SoldeCreditnmoins1: number | null;
  TotalDebitnmoins1: number | null;
  TotalCreditnmoins1: number | null;
  [key: string]: unknown;
}

export interface GrandLivreEntry {
  CompteNumero: string;
  CompteIntitule: string;
  EcritureID: number;
  NumeroPiece: string;
  NumeroEcriture: string;
  DateOperation: string;
  Libelle: string;
  Debit: number;
  Credit: number;
  SoldeAnterieurDebit: number;
  SoldeAnterieurCredit: number;
}

@Injectable({ providedIn: 'root' })
export class GrandLivreDataService {
  private ecritures: EcritureRaw[] = [];
  private planComptable: Map<string, PlanComptableRaw> = new Map();
  private planLoaded = false;
  private readonly globalVarName = 'grandLivreData';

  /** Charge le plan comptable depuis un fichier importé par l'utilisateur.
   *  Le plan n'est PAS embarqué dans l'application (il contient des comptes
   *  nominatifs = données personnelles). Renvoie le nombre de comptes. */
  async loadPlanFromFile(file: File): Promise<number> {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('Le plan comptable doit être un tableau JSON');
    }
    const planArray = parsed as PlanComptableRaw[];
    this.planComptable = new Map(planArray.map((p) => [p.Numero, p]));
    this.planLoaded = true;
    return planArray.length;
  }

  /** Indique si le plan comptable a été chargé. */
  hasPlan(): boolean {
    return this.planLoaded;
  }

  /** Indique si des écritures ont été importées. */
  hasEcritures(): boolean {
    return this.ecritures.length > 0;
  }

  /** Cœur métier : fusionne les écritures avec le plan comptable (jointure
   *  Compte → Numéro), calcule le solde N-1, trie par compte puis par date,
   *  et renvoie le tableau de lignes prêt à afficher dans le grand livre. */
  buildGrandLivreData(): GrandLivreEntry[] {
    const entries: GrandLivreEntry[] = [];

    // Solde N-1 calculé à partir du journal "AN" (À Nouveau / Reports à Nouveau)
    const soldeAnByCompte = new Map<string, { debit: number; credit: number }>();
    for (const ec of this.ecritures) {
      if (ec.Journal === 'AN') {
        const current = soldeAnByCompte.get(ec.Compte) ?? { debit: 0, credit: 0 };
        current.debit += ec.MontantDebit ?? 0;
        current.credit += ec.MontantCredit ?? 0;
        soldeAnByCompte.set(ec.Compte, current);
      }
    }

    // 2e passage : une ligne de grand livre par écriture, enrichie de
    // l'intitulé du compte (jointure) et nettoyée (renommage, valeurs de repli)
    for (const ec of this.ecritures) {
      const plan = this.planComptable.get(ec.Compte); // jointure Compte → Numéro
      const soldeAn = soldeAnByCompte.get(ec.Compte);
      entries.push({
        CompteNumero: ec.Compte,
        CompteIntitule: plan?.Intitule ?? 'Compte inconnu',
        EcritureID: ec.ID,
        NumeroPiece: ec.NumeroPiece ?? '',
        NumeroEcriture: ec.Numero ?? '',
        DateOperation: ec.DateOperation ?? ec.DateCreation ?? '',
        Libelle: ec.Libelle ?? '',
        Debit: ec.MontantDebit ?? 0,
        Credit: ec.MontantCredit ?? 0,
        SoldeAnterieurDebit:
          soldeAn?.debit ??
          plan?.SoldeDebitnmoins1 ??
          plan?.TotalDebitnmoins1 ??
          0,
        SoldeAnterieurCredit:
          soldeAn?.credit ??
          plan?.SoldeCreditnmoins1 ??
          plan?.TotalCreditnmoins1 ??
          0,
      });
    }

    // Sort by CompteNumero then by DateOperation
    entries.sort((a, b) => {
      const cmp = a.CompteNumero.localeCompare(b.CompteNumero);
      if (cmp !== 0) return cmp;
      return a.DateOperation.localeCompare(b.DateOperation);
    });

    return entries;
  }

  /** Publie les données du grand livre dans une variable globale du navigateur
   *  (window.grandLivreData) et renvoie son nom. Le rapport lit ces données via
   *  la chaîne de connexion « jsondata=@@grandLivreData ». */
  registerGlobalData(): string {
    (window as any)[this.globalVarName] = this.buildGrandLivreData();
    return this.globalVarName;
  }

  /** Lit le fichier d'écritures importé par l'utilisateur, le valide, le stocke
   *  en mémoire (this.ecritures) et republie les données. Renvoie le nombre
   *  d'écritures chargées. */
  async loadEcrituresFromFile(file: File): Promise<number> {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('Le fichier doit contenir un tableau JSON');
    }
    this.ecritures = parsed as EcritureRaw[];
    (window as any)[this.globalVarName] = this.buildGrandLivreData();
    return this.ecritures.length;
  }

  /** Renvoie le nombre d'écritures actuellement chargées (affiché dans l'UI). */
  getEcrituresCount(): number {
    return this.ecritures.length;
  }

  /** Construit la définition COMPLÈTE du rapport (format RDLX-JSON) : page A4,
   *  branchement aux données, paramètre de colonne, titre, pied de page, et le
   *  tableau (délégué à buildTableDefinition). C'est ce que le viewer ouvre. */
  getReportDefinition(pieceColumn: string = 'NumeroPiece'): object {
    const varName = this.registerGlobalData();
    return {
      Name: 'Grand Livre',
      Width: '18cm',
      Page: {
        PageWidth: '21cm',
        PageHeight: '29.7cm',
        TopMargin: '1.5cm',
        BottomMargin: '1.5cm',
        LeftMargin: '1.5cm',
        RightMargin: '1.5cm',
      },
      DataSources: [
        {
          Name: 'GrandLivreDS',
          ConnectionProperties: {
            DataProvider: 'JSON',
            ConnectString: `jsondata=@@${varName}`,
          },
        },
      ],
      DataSets: [
        {
          Name: 'GrandLivreData',
          Query: {
            DataSourceName: 'GrandLivreDS',
            CommandText: '$[*]',
          },
          Fields: [
            { Name: 'CompteNumero', DataField: 'CompteNumero' },
            { Name: 'CompteIntitule', DataField: 'CompteIntitule' },
            { Name: 'EcritureID', DataField: 'EcritureID' },
            { Name: 'NumeroPiece', DataField: 'NumeroPiece' },
            { Name: 'NumeroEcriture', DataField: 'NumeroEcriture' },
            { Name: 'DateOperation', DataField: 'DateOperation' },
            { Name: 'Libelle', DataField: 'Libelle' },
            { Name: 'Debit', DataField: 'Debit' },
            { Name: 'Credit', DataField: 'Credit' },
            { Name: 'SoldeAnterieurDebit', DataField: 'SoldeAnterieurDebit' },
            { Name: 'SoldeAnterieurCredit', DataField: 'SoldeAnterieurCredit' },
          ],
        },
      ],
      ReportParameters: [
        {
          Name: 'PieceColumn',
          DataType: 'String',
          Prompt: 'Colonne référence',
          DefaultValue: { Values: [pieceColumn] },
          ValidValues: {
            ParameterValues: [
              { Label: 'N° Pièce', Value: 'NumeroPiece' },
              { Label: 'ID écriture', Value: 'ID' },
              { Label: 'N° Écriture', Value: 'Numero' },
            ],
          },
          Hidden: true,
        },
      ],
      Body: {
        ReportItems: [
          {
            Type: 'textbox',
            Name: 'ReportTitleMain',
            Value: 'Grand livre provisoire',
            Left: '0cm',
            Top: '0cm',
            Width: '18cm',
            Height: '0.8cm',
            Style: {
              FontWeight: 'Bold',
              FontSize: '15pt',
              TextAlign: 'Center',
              FontFamily: 'Arial',
              Color: '#1A2B4A',
            },
          },
          {
            Type: 'textbox',
            Name: 'ReportTitleSub1',
            Value: 'Édition du grand livre comptable',
            Left: '0cm',
            Top: '0.8cm',
            Width: '18cm',
            Height: '0.45cm',
            Style: {
              FontSize: '9pt',
              TextAlign: 'Center',
              FontFamily: 'Arial',
              Color: '#444444',
            },
          },
          {
            Type: 'textbox',
            Name: 'ReportTitleSub2',
            Value: '="Édité le " & Format(Today(), "dd/MM/yyyy à HH:mm")',
            Left: '0cm',
            Top: '1.25cm',
            Width: '18cm',
            Height: '0.45cm',
            Style: {
              FontSize: '8pt',
              TextAlign: 'Center',
              FontFamily: 'Arial',
              Color: '#777777',
            },
          },
          {
            Type: 'line',
            Name: 'TitleRule',
            Left: '0cm',
            Top: '1.85cm',
            Width: '18cm',
            Height: '0cm',
            Style: {
              BorderStyle: { Bottom: 'Solid' },
              BorderWidth: { Bottom: '1pt' },
              BorderColor: { Bottom: '#1A2B4A' },
            },
          },
          {
            ...this.buildTableDefinition(),
            Top: '2.1cm',
          },
        ],
      },
      PageFooter: {
        Height: '1cm',
        PrintOnFirstPage: true,
        PrintOnLastPage: true,
        ReportItems: [
          {
            Type: 'line',
            Name: 'FooterRule',
            Left: '0cm',
            Top: '0.1cm',
            Width: '18cm',
            Height: '0cm',
            Style: {
              BorderStyle: { Bottom: 'Solid' },
              BorderWidth: { Bottom: '0.5pt' },
              BorderColor: { Bottom: '#9AA5B1' },
            },
          },
          {
            Type: 'textbox',
            Name: 'PageFooterDate',
            Value: '=Format(Today(), "dd MMMM yyyy")',
            Left: '0cm',
            Top: '0.3cm',
            Width: '5cm',
            Height: '0.5cm',
            Style: {
              FontSize: '8pt',
              FontFamily: 'Arial',
              Color: '#555555',
            },
          },
          {
            Type: 'textbox',
            Name: 'PageFooterCompany',
            Value: 'Logeas Informatique - Provisoire',
            Left: '5cm',
            Top: '0.3cm',
            Width: '8cm',
            Height: '0.5cm',
            Style: {
              FontSize: '8pt',
              TextAlign: 'Center',
              FontFamily: 'Arial',
              Color: '#555555',
            },
          },
          {
            Type: 'textbox',
            Name: 'PageFooterNumber',
            Value: '="Page " & Globals!PageNumber & " sur " & Globals!TotalPages',
            Left: '13cm',
            Top: '0.3cm',
            Width: '5cm',
            Height: '0.5cm',
            Style: {
              FontSize: '8pt',
              TextAlign: 'Right',
              FontFamily: 'Arial',
              Color: '#555555',
            },
          },
        ],
      },
    };
  }

  /** Construit UNIQUEMENT le tableau du grand livre (la grosse partie) :
   *  groupement par compte (en-tête répété + totaux), lignes de détail avec
   *  solde permanent, et total général. Appelé par getReportDefinition. */
  private buildTableDefinition(): object {
    const baseFont = { FontFamily: 'Arial' };
    const accent = '#1A2B4A';
    const headerBar = '#ECEFF4';
    const ruleColor = '#9AA5B1';

    // Format avec gestion explicite du négatif : "1 234,56 €" / "-1 234,56 €"
    const amountFormat = '#,##0.00 €;-#,##0.00 €';

    const colHeaderStyle = {
      ...baseFont,
      FontWeight: 'Bold',
      FontSize: '8pt',
      Color: accent,
      BackgroundColor: headerBar,
      PaddingTop: '4pt',
      PaddingBottom: '3pt',
      BorderStyle: { Top: 'Solid', Bottom: 'Solid' },
      BorderWidth: { Top: '0.5pt', Bottom: '0.5pt' },
      BorderColor: { Top: ruleColor, Bottom: ruleColor },
    };

    // Zébrage très léger : une ligne sur deux (au sein de chaque compte)
    const zebra =
      '=IIF(RowNumber("GroupeCompte") Mod 2 = 0, "#F6F7F9", "#FFFFFF")';

    const detailStyle = {
      ...baseFont,
      FontSize: '8pt',
      PaddingTop: '2.5pt',
      PaddingBottom: '2.5pt',
      BackgroundColor: zebra,
    };

    const totalStyle = {
      ...baseFont,
      FontSize: '8pt',
      PaddingTop: '2pt',
      PaddingBottom: '2pt',
    };

    const totalTopRule = {
      ...totalStyle,
      PaddingTop: '3pt',
      BorderStyle: { Top: 'Solid' },
      BorderWidth: { Top: '0.5pt' },
      BorderColor: { Top: ruleColor },
    };

    const grandTotalFill = {
      ...baseFont,
      BackgroundColor: accent,
      Color: '#FFFFFF',
    };

    // Bandeau gris clair continu pour l'en-tête de compte
    const accountFillStyle = {
      ...baseFont,
      BackgroundColor: headerBar,
      BorderStyle: { Top: 'Solid' },
      BorderWidth: { Top: '1pt' },
      BorderColor: { Top: accent },
    };

    const cell = (item: object) => ({ Item: item });

    return {
      Type: 'table',
      Name: 'TableGrandLivre',
      DataSetName: 'GrandLivreData',
      Top: '0cm',
      Left: '0cm',
      Width: '18cm',
      TableColumns: [
        { Width: '2.2cm' },
        { Width: '1.8cm' },
        { Width: '6.5cm' },
        { Width: '2.5cm' },
        { Width: '2.5cm' },
        { Width: '2.5cm' },
      ],
      TableGroups: [
        {
          Group: {
            Name: 'GroupeCompte',
            GroupExpressions: ['=Fields!CompteNumero.Value'],
          },
          PreventOrphanedHeader: true,
          PreventOrphanedFooter: true,
          Header: {
            RepeatOnNewPage: true,
            TableRows: [
              {
                Height: '0.65cm',
                TableCells: [
                  cell({
                    Type: 'textbox',
                    Name: 'AccountTitle',
                    Value: '=Fields!CompteNumero.Value & "    " & Fields!CompteIntitule.Value',
                    Style: {
                      ...accountFillStyle,
                      FontWeight: 'Bold',
                      FontSize: '10pt',
                      Color: accent,
                      PaddingLeft: '4pt',
                      PaddingTop: '5pt',
                      PaddingBottom: '3pt',
                    },
                    CanGrow: true,
                  }),
                  cell({ Type: 'textbox', Name: 'AccountTitle_1', Value: '', Style: accountFillStyle }),
                  cell({ Type: 'textbox', Name: 'AccountTitle_2', Value: '', Style: accountFillStyle }),
                  cell({ Type: 'textbox', Name: 'AccountTitle_3', Value: '', Style: accountFillStyle }),
                  cell({ Type: 'textbox', Name: 'AccountTitle_4', Value: '', Style: accountFillStyle }),
                  cell({ Type: 'textbox', Name: 'AccountTitle_5', Value: '', Style: accountFillStyle }),
                ],
              },
              {
                Height: '0.5cm',
                TableCells: [
                  cell({
                    Type: 'textbox',
                    Name: 'ColHeaderPiece',
                    Value: '=IIF(Parameters!PieceColumn.Value = "NumeroPiece", "N° pièce", IIF(Parameters!PieceColumn.Value = "ID", "ID", "N° écriture"))',
                    Style: { ...colHeaderStyle, TextAlign: 'Left', PaddingLeft: '2pt' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'ColHeaderDate',
                    Value: 'Date',
                    Style: { ...colHeaderStyle, TextAlign: 'Left' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'ColHeaderLibelle',
                    Value: 'Libellé',
                    Style: { ...colHeaderStyle, TextAlign: 'Left' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'ColHeaderDebit',
                    Value: 'Débit',
                    Style: { ...colHeaderStyle, TextAlign: 'Right', PaddingRight: '6pt' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'ColHeaderCredit',
                    Value: 'Crédit',
                    Style: { ...colHeaderStyle, TextAlign: 'Right', PaddingRight: '6pt' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'ColHeaderSolde',
                    Value: 'Solde perma.',
                    Style: { ...colHeaderStyle, TextAlign: 'Right', PaddingRight: '6pt' },
                  }),
                ],
              },
            ],
          },
          Footer: {
            TableRows: [
              {
                Height: '0.5cm',
                TableCells: [
                  cell({ Type: 'textbox', Name: 'TotalLine_0', Value: '', Style: totalTopRule }),
                  cell({ Type: 'textbox', Name: 'TotalLine_1', Value: '', Style: totalTopRule }),
                  cell({
                    Type: 'textbox',
                    Name: 'TotalLineLabel',
                    Value: 'Total débit/crédit',
                    Style: { ...totalTopRule, TextAlign: 'Right', PaddingRight: '8pt', FontStyle: 'Italic', FontWeight: 'Bold' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'TotalCompteDebit',
                    Value: '=IIF(Sum(Fields!Debit.Value) = 0, "", Sum(Fields!Debit.Value))',
                    Style: { ...totalTopRule, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt', FontWeight: 'Bold' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'TotalCompteCredit',
                    Value: '=IIF(Sum(Fields!Credit.Value) = 0, "", Sum(Fields!Credit.Value))',
                    Style: { ...totalTopRule, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt', FontWeight: 'Bold' },
                  }),
                  cell({ Type: 'textbox', Name: 'TotalLine_5', Value: '', Style: totalTopRule }),
                ],
              },
              {
                Height: '0.5cm',
                TableCells: [
                  cell({ Type: 'textbox', Name: 'SoldeLine_0', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'SoldeLine_1', Value: '', Style: totalStyle }),
                  cell({
                    Type: 'textbox',
                    Name: 'SoldeLineLabel',
                    Value: '="Solde du compte " & Fields!CompteNumero.Value',
                    Style: { ...totalStyle, TextAlign: 'Right', PaddingRight: '8pt', FontStyle: 'Italic' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'SoldeCompteDebit',
                    Value: '=IIF((Sum(Fields!Debit.Value) - Sum(Fields!Credit.Value)) > 0, Sum(Fields!Debit.Value) - Sum(Fields!Credit.Value), "")',
                    Style: { ...totalStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'SoldeCompteCredit',
                    Value: '=IIF((Sum(Fields!Credit.Value) - Sum(Fields!Debit.Value)) > 0, Sum(Fields!Credit.Value) - Sum(Fields!Debit.Value), "")',
                    Style: { ...totalStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
                  }),
                  cell({ Type: 'textbox', Name: 'SoldeLine_5', Value: '', Style: totalStyle }),
                ],
              },
              {
                Height: '0.5cm',
                TableCells: [
                  cell({ Type: 'textbox', Name: 'SoldeAntLine_0', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'SoldeAntLine_1', Value: '', Style: totalStyle }),
                  cell({
                    Type: 'textbox',
                    Name: 'SoldeAntLabel',
                    Value: "Solde du compte en fin d'exercice précédent",
                    Style: { ...totalStyle, TextAlign: 'Right', PaddingRight: '8pt', FontStyle: 'Italic' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'SoldeAntDebit',
                    Value: '=IIF(First(Fields!SoldeAnterieurDebit.Value) = 0, "", First(Fields!SoldeAnterieurDebit.Value))',
                    Style: { ...totalStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
                  }),
                  cell({
                    Type: 'textbox',
                    Name: 'SoldeAntCredit',
                    Value: '=IIF(First(Fields!SoldeAnterieurCredit.Value) = 0, "", First(Fields!SoldeAnterieurCredit.Value))',
                    Style: { ...totalStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
                  }),
                  cell({ Type: 'textbox', Name: 'SoldeAntLine_5', Value: '', Style: totalStyle }),
                ],
              },
              {
                Height: '0.5cm',
                TableCells: [
                  cell({ Type: 'textbox', Name: 'BlankRow_0', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'BlankRow_1', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'BlankRow_2', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'BlankRow_3', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'BlankRow_4', Value: '', Style: totalStyle }),
                  cell({ Type: 'textbox', Name: 'BlankRow_5', Value: '', Style: totalStyle }),
                ],
              },
            ],
          },
        },
      ],
      Footer: {
        TableRows: [
          {
            Height: '0.75cm',
            TableCells: [
              cell({ Type: 'textbox', Name: 'GT_0', Value: '', Style: grandTotalFill }),
              cell({ Type: 'textbox', Name: 'GT_1', Value: '', Style: grandTotalFill }),
              cell({
                Type: 'textbox',
                Name: 'GTLabel',
                Value: 'Total général débit/crédit',
                Style: {
                  ...grandTotalFill,
                  FontWeight: 'Bold',
                  FontSize: '9pt',
                  Color: '#FFFFFF',
                  TextAlign: 'Right',
                  PaddingRight: '8pt',
                  PaddingTop: '7pt',
                },
              }),
              cell({
                Type: 'textbox',
                Name: 'GrandTotalDebit',
                Value: '=Sum(Fields!Debit.Value)',
                Style: {
                  ...grandTotalFill,
                  FontWeight: 'Bold',
                  FontSize: '9pt',
                  Color: '#FFFFFF',
                  TextAlign: 'Right',
                  Format: amountFormat,
                  PaddingRight: '6pt',
                  PaddingTop: '7pt',
                },
              }),
              cell({
                Type: 'textbox',
                Name: 'GrandTotalCredit',
                Value: '=Sum(Fields!Credit.Value)',
                Style: {
                  ...grandTotalFill,
                  FontWeight: 'Bold',
                  FontSize: '9pt',
                  Color: '#FFFFFF',
                  TextAlign: 'Right',
                  Format: amountFormat,
                  PaddingRight: '6pt',
                  PaddingTop: '7pt',
                },
              }),
              cell({ Type: 'textbox', Name: 'GT_5', Value: '', Style: grandTotalFill }),
            ],
          },
        ],
      },
      Details: {
        TableRows: [
          {
            Height: '0.4cm',
            TableCells: [
              cell({
                Type: 'textbox',
                Name: 'CellPiece',
                Value: '=IIF(Parameters!PieceColumn.Value = "NumeroPiece", Fields!NumeroPiece.Value, IIF(Parameters!PieceColumn.Value = "ID", Fields!EcritureID.Value, Fields!NumeroEcriture.Value))',
                Style: { ...detailStyle, TextAlign: 'Left', PaddingLeft: '2pt' },
                CanGrow: true,
              }),
              cell({
                Type: 'textbox',
                Name: 'CellDate',
                Value: '=IIF(IsNothing(Fields!DateOperation.Value) OR Fields!DateOperation.Value = "", "", Format(CDate(Fields!DateOperation.Value), "dd/MM/yyyy"))',
                Style: { ...detailStyle, TextAlign: 'Left' },
              }),
              cell({
                Type: 'textbox',
                Name: 'CellLibelle',
                Value: '=Fields!Libelle.Value',
                Style: { ...detailStyle, TextAlign: 'Left' },
                CanGrow: true,
              }),
              cell({
                Type: 'textbox',
                Name: 'CellDebit',
                Value: '=IIF(Fields!Debit.Value = 0, "", Fields!Debit.Value)',
                Style: { ...detailStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
              }),
              cell({
                Type: 'textbox',
                Name: 'CellCredit',
                Value: '=IIF(Fields!Credit.Value = 0, "", Fields!Credit.Value)',
                Style: { ...detailStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
              }),
              cell({
                Type: 'textbox',
                Name: 'CellSolde',
                Value: '=RunningValue(Fields!Debit.Value, Sum, "GroupeCompte") - RunningValue(Fields!Credit.Value, Sum, "GroupeCompte")',
                Style: { ...detailStyle, TextAlign: 'Right', Format: amountFormat, PaddingRight: '6pt' },
              }),
            ],
          },
        ],
      },
    };
  }
}
