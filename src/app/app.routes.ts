import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'viewer',
    loadComponent: () =>
      import('./viewer/viewer.component').then((m) => m.ReportViewerComponent),
  },
  {
    path: 'designer',
    loadComponent: () =>
      import('./designer/designer.component').then(
        (m) => m.ReportDesignerComponent
      ),
  },
];
