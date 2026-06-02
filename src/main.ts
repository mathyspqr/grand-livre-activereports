import { bootstrapApplication } from '@angular/platform-browser';
import { Core } from '@mescius/activereportsjs';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// --- Licence ActiveReportsJS ---------------------------------------------
// ActiveReportsJS BLOQUE le rendu sur un domaine déployé sans clé de licence
// (le mode évaluation ne fonctionne que sur localhost).
// Colle ici ta clé d'essai/déploiement MESCIUS (associée au domaine Vercel).
// Récupération : MESCIUS → My Account → Licenses.
const ACTIVEREPORTS_LICENSE_KEY = '';
if (ACTIVEREPORTS_LICENSE_KEY) {
  Core.setLicenseKey(ACTIVEREPORTS_LICENSE_KEY);
}
// -------------------------------------------------------------------------

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
