import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActiveReportsModule,
  ViewerComponent,
  PdfExportService,
  AR_EXPORTS,
} from '@mescius/activereportsjs-angular';
import { GrandLivreDataService } from '../services/grand-livre-data.service';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ActiveReportsModule],
  providers: [
    PdfExportService,
    { provide: AR_EXPORTS, useExisting: PdfExportService, multi: true },
  ],
  templateUrl: './viewer.component.html',
  styleUrl: './viewer.component.scss',
})
export class ReportViewerComponent implements OnInit {
  @ViewChild('viewer') viewer!: ViewerComponent;
  pieceColumnChoice = 'NumeroPiece';
  ecrituresCount = 0;
  isLoading = false;
  errorMessage = '';
  customTemplateName: string | null = null;
  hasReport = false;
  planCount = 0;
  private viewerReady = false;
  private customTemplate: object | null = null;

  constructor(public dataService: GrandLivreDataService) {}

  ngOnInit(): void {}

  onViewerInit(): void {
    this.viewerReady = true;
    this.loadReport();
  }

  async onPlanSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.errorMessage = '';
    this.isLoading = true;
    try {
      this.planCount = await this.dataService.loadPlanFromFile(file);
      this.loadReport();
    } catch (e: unknown) {
      this.errorMessage =
        e instanceof Error ? e.message : 'Plan comptable invalide';
    } finally {
      this.isLoading = false;
      input.value = '';
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.errorMessage = '';
    this.isLoading = true;
    try {
      this.ecrituresCount = await this.dataService.loadEcrituresFromFile(file);
      this.loadReport();
    } catch (e: unknown) {
      this.errorMessage =
        e instanceof Error ? e.message : 'Erreur de chargement du fichier';
    } finally {
      this.isLoading = false;
      input.value = '';
    }
  }

  async onTemplateSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.errorMessage = '';
    this.isLoading = true;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Le fichier sauvegardé par le designer peut être { definition: {...} } ou directement le rapport
      this.customTemplate = parsed.definition ?? parsed;
      this.customTemplateName = file.name;
      // S'assurer que les données sont publiées pour le binding du modèle
      this.dataService.registerGlobalData();
      this.loadReport();
    } catch (e: unknown) {
      this.errorMessage =
        e instanceof Error ? e.message : 'Modèle .rdlx-json invalide';
    } finally {
      this.isLoading = false;
      input.value = '';
    }
  }

  resetTemplate(): void {
    this.customTemplate = null;
    this.customTemplateName = null;
    this.loadReport();
  }

  private loadReport(): void {
    if (!this.viewerReady || !this.dataService.hasPlan()) return;
    if (!this.dataService.hasEcritures()) return;
    const reportDef =
      this.customTemplate ??
      this.dataService.getReportDefinition(this.pieceColumnChoice);
    this.viewer.open(reportDef as any);
    this.hasReport = true;
  }

  onPieceColumnChange(): void {
    this.loadReport();
  }
}
