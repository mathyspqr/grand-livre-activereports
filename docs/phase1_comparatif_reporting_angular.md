# Phase 1 — Comparatif des outils de reporting pour Angular

**Objectif :** remplacer **FastReport** (utilisé côté serveur) par un outil de reporting **100 % web, côté navigateur**, intégré à l'application Angular 20 de Logeas.

*Rédigé par Mathys Paquereau pour Logeas Informatique.*

---

## 1. Le besoin en une phrase

Générer des états comptables (dont le **grand livre**) **directement dans le navigateur**, sans serveur, avec :

- un **designer** que les utilisateurs peuvent utiliser eux-mêmes,
- une alimentation par **données JSON** (écritures + plan comptable),
- un **export PDF et Excel** depuis le navigateur,
- du **paramétrage** par l'utilisateur (colonnes, filtres, mise en forme).

**Contrainte clé :** aucune dépendance serveur pour le rendu ou l'export. Cela élimine d'emblée les solutions .NET/serveur (Telerik, DevExpress…).

---

## 2. Les deux outils retenus

Après étude du marché, **deux solutions** répondent à la contrainte « 100 % navigateur » et sont compatibles Angular 20 :

| | **ActiveReportsJS** | **Stimulsoft Reports.JS** |
|---|---|---|
| Éditeur | MESCIUS (ex-GrapeCity) | Stimulsoft (même éditeur que FastReport .NET) |
| Version | v6.0 (déc. 2025) | v2026.2 (mai 2026) |
| Architecture | 100 % navigateur, **zéro serveur** | 100 % navigateur (exports avancés Word/PPT = serveur Node optionnel) |
| Intégration Angular | composant Angular natif | packages npm + scripts client-side |
| Designer embarqué | ✅ | ✅ |
| **Prix (usage interne)** | **1 499 $/an** (par domaine) | **900 $/an** (par développeur) |
| Code source fourni | ❌ | ✅ |
| Cadence de mise à jour | annuelle | trimestrielle |

---

## 3. Comparatif fonctionnel

Les deux outils couvrent **l'intégralité** des besoins du grand livre exprimés par Nicolas :

| Besoin | ActiveReportsJS | Stimulsoft |
|---|---|---|
| Numérotation des pages | ✅ | ✅ |
| Reprise des en-têtes à chaque page | ✅ | ✅ |
| Designer modifiable par les utilisateurs | ✅ | ✅ |
| Paramétrage amont (N° pièce / ID / n° écriture) | ✅ | ✅ |
| Grand titre + sous-titres | ✅ | ✅ |
| Solde permanent (calcul cumulé) | ✅ | ✅ |
| Totaux par compte + total général | ✅ | ✅ |
| Export PDF (navigateur) | ✅ | ✅ |
| Export Excel (navigateur) | ✅ | ✅ |
| Alimentation JSON (écritures + plan) | ✅ | ✅ |
| Jointure Compte → Numéro | ✅ | ✅ |

➡️ **Sur le plan fonctionnel, les deux font le travail.** La différence se joue ailleurs (prix, licence, expérience de développement, contraintes de déploiement).

---

## 4. Différences à connaître (constatées pendant les PoC)

### 4.1 Licence et déploiement en ligne

- **ActiveReportsJS** : fonctionne en local sans clé (simple **filigrane** d'évaluation), mais **bloque** le rendu sur un **domaine public** sans clé de licence (« License Not Found »). Pour une démo en ligne, une clé (même d'essai) est **obligatoire** et se demande à MESCIUS.
- **Stimulsoft** : fonctionne **partout** (local et domaine public) en évaluation, avec un simple **bandeau « trial »** non bloquant.

➡️ Pour une démo en ligne immédiate, **Stimulsoft est plus simple** (pas de clé requise).

### 4.2 Façon de construire le rapport

- **ActiveReportsJS** : le rapport est **décrit** sous forme d'un objet (JSON/RDLX) — approche **déclarative**, le moteur calcule beaucoup (totaux, solde permanent).
- **Stimulsoft** : le rapport est **assemblé par code** (bande par bande) — approche plus **impérative**, on prépare davantage côté code.

### 4.3 Prix pour Logeas (association, usage interne)

- **ActiveReportsJS** : 1 499 $/an, licence **par domaine** de production.
- **Stimulsoft** : 900 $/an, licence **par développeur** (royalty-free pour les utilisateurs finaux), **code source inclus**.

➡️ **Stimulsoft est ~40 % moins cher** et son modèle « par développeur » est mieux adapté à une structure comme Logeas.

---

## 5. Synthèse

| Critère | Avantage |
|---|---|
| Couverture fonctionnelle | **Égalité** (les deux couvrent tout) |
| 100 % sans serveur | **ActiveReportsJS** (garanti sur tout ; Stimulsoft : serveur optionnel pour Word/PPT) |
| Démo en ligne sans friction | **Stimulsoft** (pas de clé) |
| Prix | **Stimulsoft** (900 $ vs 1 499 $) |
| Code source / pérennité | **Stimulsoft** (source incluse) |
| Réactivité des mises à jour | **Stimulsoft** (trimestrielle) |
| Maturité / référence marché | **ActiveReportsJS** |

---

## 6. Recommandation

Les **deux outils sont viables** et couvrent le besoin. Pour départager :

- **Stimulsoft Reports.JS** ressort en tête pour Logeas : **moins cher**, **code source inclus**, **même éditeur que FastReport** (transition conceptuelle facilitée), mises à jour fréquentes, et démo en ligne sans clé.
- **ActiveReportsJS** reste un excellent choix si la priorité absolue est le **« tout navigateur sans aucune exception »** et une solution très établie.

**Décision finale** à valider par Logeas après essai des **deux PoC** (phase 2) sur le grand livre réel.

---

## 7. Suite — Phase 2 (PoC)

Deux maquettes ont été réalisées, **identiques fonctionnellement**, une par outil, pour comparaison directe :

| PoC | Démo en ligne | Code source |
|---|---|---|
| **Stimulsoft** | https://grand-livre-stimulsoft.vercel.app | https://github.com/mathyspqr/grand-livre-stimulsoft |
| **ActiveReportsJS** | (clé de licence requise) | https://github.com/mathyspqr/grand-livre-activereports |

**Test :** charger le **plan comptable** puis les **écritures** → le grand livre se génère, exportable en PDF.
