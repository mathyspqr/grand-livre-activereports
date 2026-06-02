import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ActiveReportsModule,
  DesignerComponent,
} from '@mescius/activereportsjs-angular';
import { GrandLivreDataService } from '../services/grand-livre-data.service';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, RouterLink, ActiveReportsModule],
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.scss',
})
export class ReportDesignerComponent implements OnInit, AfterViewInit {
  @ViewChild('designer') designer!: DesignerComponent;

  dataSources: any[] = [];

  onSaveHandler = async (info: any) => {
    const reportDef = await this.designer.getReport();
    const blob = new Blob([JSON.stringify(reportDef.definition, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (reportDef.displayName || 'grand-livre') + '.rdlx-json';
    a.click();
    URL.revokeObjectURL(url);
    return { displayName: reportDef.displayName, id: reportDef.id };
  };

  constructor(private dataService: GrandLivreDataService) {}

  ngOnInit(): void {
    // Le designer édite la mise en page : il n'a pas besoin des données réelles.
    const varName = this.dataService.registerGlobalData();
    this.dataSources = [
      {
        id: 'GrandLivreDS',
        title: 'Grand Livre DataSource',
        template: {
          name: 'GrandLivreDS',
          connectionProperties: {
            dataProvider: 'JSON',
            connectString: `jsondata=@@${varName}`,
          },
        },
      },
    ];
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const reportDef = this.dataService.getReportDefinition();
      this.designer.setReport({
        id: 'grand-livre.rdlx-json',
        displayName: 'Grand Livre',
        definition: reportDef as any,
      });
    }, 500);
  }

  saveReport(): void {
    this.designer.processCommand('save');
  }
}
