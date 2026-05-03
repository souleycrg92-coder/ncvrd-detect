# NCVRD Detect — Guide Projet pour Claude

## Vue d'ensemble

Application web **PWA monofichier** de gestion de rapports de détection de réseaux VRD (eau, gaz, électricité, télécom…).
Déployée sur GitHub Pages : **https://neoconceptvrd.github.io/ncvrd-detect/**

- **Client** : NeoConceptVRD (Courbevoie / Paris Ouest)
- **Stack** : HTML + CSS + JS vanilla, Firebase 9.22.0 (compat mode), IndexedDB, docx.js v8.5.0
- **Architecture** : 1 seul fichier `index.html` (~8500 lignes) — CSS lignes ~28-840, HTML lignes ~1090-2240, JS lignes ~2240-8500

---

## Structure des fichiers

```
D:\Desktop\Bureau\NCVRD Detect\
├── index.html              ← SPA complète (CSS + HTML + JS tout-en-un)
├── sw.js                   ← Service Worker v3 (PWA, cache: ncvrd-detect-v3)
├── manifest.json           ← Manifest PWA
├── LOGO.png                ← Logo NCVRD (utilisé dans export Word)
├── cors.json               ← Config CORS Firebase Storage
├── firestore.rules         ← Règles de sécurité Firestore
├── PUBLIER SUR GITHUB.bat  ← Push vers GitHub Pages (git add + commit + push)
├── PUSH_CORRECTION_PHOTOS.bat ← Push correctifs spécifiques
├── package.json            ← Dépendances Node (setup-accounts.js)
├── setup-accounts.js       ← Script Node de création des comptes Firebase
├── serviceAccount.json     ← Clé de service Firebase Admin (NE PAS COMMITER)
├── AUDIT_FONCTIONNEL.md    ← Audit des fonctionnalités
└── pdfs_temp/              ← PDFs réglementaires (normes NF S70-003, arrêtés…)
```

**IMPORTANT** : Ne modifier que `index.html`, `sw.js`, `manifest.json`. Ne jamais commiter `serviceAccount.json`.

---

## Firebase

### Configuration (lignes ~2299-2307 de index.html)
```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBSYpQzMenjr7sghERSTs8ABwE9ZrN96VQ",
  authDomain:        "ncvrd-detect.firebaseapp.com",
  projectId:         "ncvrd-detect",
  storageBucket:     "ncvrd-detect.firebasestorage.app",
  messagingSenderId: "480995514129",
  appId:             "1:480995514129:web:d14f81557349e97698deb0"
};
let fauth = null, fdb = null, fstorage = null;
const FIREBASE_CONFIGURED = !FIREBASE_CONFIG.apiKey.includes('VOTRE');
```

### Structure Firestore
```
/teams/{teamId}/
  ├── chantiers/{chantierId}   ← Chantiers (synchro avec IndexedDB)
  └── rapports/{rapportId}     ← Rapports (synchro avec IndexedDB)
/users/{uid}                   ← Profils utilisateurs
```

- Les **photos** et **points GPS** ne sont JAMAIS synchronisés sur Firestore (trop lourds) → IndexedDB local uniquement
- Firebase Storage → `rapports/{rapportId}/photo_{id}.jpg` pour les photos exportées dans les rapports Word

### Règles d'accès par rôle
```js
function isAdminRole(role)   // Responsable / Directeur d'agence → chantiers de leur équipe
function isGlobalAdmin(role) // Directeur Général / QHSE → TOUS les chantiers de toutes les équipes
```

---

## Base de données locale — IndexedDB

**Nom de la base** : `detecapp_v3` (version 2)

| Store | Clé | Sync Firestore | Usage |
|-------|-----|---------------|-------|
| `chantiers` | `id` | ✅ Oui | Chantiers (métadonnées) |
| `rapports` | `id` | ✅ Oui | Rapports complets (sections 1-7) |
| `photos` | `id` | ❌ Local only | Photos (base64 dataUrl) |
| `gps_points` | `id` | ❌ Local only | Points GPS de chaque réseau |
| `consignes` | `id` | ✅ Oui | Consignes de sécurité |
| `documents` | `id` | ❌ Local only | Documents du dossier (binaires > 1Mo) |

### Classe principale
```js
const db = new CloudDB();  // wrapper qui route vers IndexedDB ou Firestore
db._idb                    // accès direct IndexedDB (AppDB)
db.put(store, data)        // sauvegarde locale + sync Firestore
db.get(store, id)          // lecture locale (+ fallback Firestore)
db.del(store, id)          // suppression locale + sync Firestore
db.getAll(store)           // tous les enregistrements
db.setTeam(teamId)         // changer d'équipe (pour DG multi-team)
```

---

## Rôles utilisateurs

| Rôle | Type | Accès |
|------|------|-------|
| Directeur Général | `globalAdmin` | Tous chantiers, toutes équipes |
| QHSE | `globalAdmin` | Tous chantiers, toutes équipes |
| Directeur d'agence | `admin` | Chantiers de son équipe |
| Responsable Opérationnel | `admin` | Chantiers de son équipe |
| Technicien Géomètre - Topographe | tech | Ses chantiers + ceux où invité |
| Technicien Détection - Topographe | tech | Ses chantiers + ceux où invité |
| Technicien Détection | tech | Ses chantiers + ceux où invité |
| Référent Détection | tech | Ses chantiers + ceux où invité |
| Assistant opérationnel | tech | Ses chantiers + ceux où invité |

Les couleurs de badges sont dans `DynLists.DEFAULTS.role_colors` (lignes ~2745-2755).

---

## Fonctions clés JS

### Navigation & écrans
```js
showScreen(id)           // Affiche un écran (screen-home, screen-rapport, screen-profil…)
toast(msg, duration)     // Notification toast en bas d'écran
```

### Chantiers
```js
loadChantiers()          // Charge depuis Firestore (online) ou IndexedDB (offline)
renderChantiers(list)    // Affiche la liste avec virtual scroll (IntersectionObserver)
openChantier(id)         // Ouvre un chantier → charge rapport → showScreen('screen-rapport')
createChantierDirect()   // Crée chantier sans dialog puis l'ouvre
deleteChantier(id)       // Supprime chantier + rapport (IndexedDB + Firestore)
switchTab(tab)           // 'encours' | 'termine' | 'partage'
```

### Rapport
```js
rapportChanged()         // Déclenche autosave (debounce 1200ms)
saveRapport()            // Sauvegarde immédiate
openChantier(id)         // Charge rapport depuis Firestore ou IDB selon fraîcheur
```

### Photos
```js
compressImage(file, maxW, maxSizeKB)  // Compresse en JPEG (maxW=1024, maxSizeKB=300)
// photos liées au rapport : id='photo_'+uid, rapportId
// photo de profil : id='profile_'+uid, type='profile'
```

### Export Word
```js
exportRapportWord()      // Export rapport chantier complet en .docx → appelle doWordDocx()
doWordDocx()             // Génère le .docx via docx.js (sections 01-06 + page de couverture)
exportSingleOuvrage(id)  // Export fiche ouvrage en .docx → appelle _generateOuvragesWord()
exportAllOuvrages()      // Export tous les ouvrages en un seul .docx
_generateOuvragesWord(ouvrages, filename) // Génère le .docx ouvrages via docx.js
fixDocxJpeg(blob)        // Post-processing : corrige le mimeType JPEG dans le ZIP docx
parseImg(dataUrl)        // Retourne {type, data: Uint8Array} — IMPORTANT: Uint8Array, pas base64
// Overlay de progression : _showExportOverlay(), _updateExportProgress(text, pct), _hideExportOverlay()
```

### Charte graphique Word — Rapport chantier
Constantes définies dans `doWordDocx()` :
```js
const NAVY   = '0E2841'; // Bleu foncé : texte titres, numéros, traits, entêtes tableaux
const ORANGE = 'E8620A'; // Orange (inutilisé dans les titres depuis refonte)
const LGRAY  = 'F4F6F9'; // Gris clair : labels colonne gauche dans makeInfoTable
const MGRAY  = 'D1D5DB'; // Gris moyen : bordures légères
const WHITE  = 'FFFFFF'; // Blanc : fond données
```
- **Page de couverture** : fond `F9F9F9`, texte `#0E2841`, bandeaux `#0E2841`
- **Titres 01→06** (`sectionTitle`) : fond `F9F9F9`, numéro + texte + trait bas → `#0E2841`
- **Sous-titres** (`subTitle`) : trait gauche `#0E2841`, texte `#0E2841`
- **Entêtes tableaux** (`makeTable`) : fond `F9F9F9`, texte `#0E2841` gras
- **Tableau de synthèse** (XML `_wh`, `_wrow`) : même charte

### Charte graphique Word — Rapport ouvrages
Constantes définies dans `_generateOuvragesWord()` :
```js
const C_YELLOW = '0E2841'; // Titre "CARACTERISTIQUE OUVRAGE" — fond bleu foncé
const C_BLUE   = '0E2841'; // Sections REPRESENTATION / OBSERVATION / CANALISATIONS — fond bleu foncé
const C_LBLUE  = 'BDD6EE'; // Labels / en-têtes colonnes — bleu clair
const C_WHITE  = 'FFFFFF'; // Fond données
const C_BLACK  = '000000'; // Texte données
const C_NAVY   = '0E2841'; // Texte titres (blanc sur fond foncé) et labels (sur C_LBLUE)
```
- **Titres de section** (`titleRow`) : fond `C_YELLOW`/`C_BLUE` (`#0E2841`), texte **blanc**
- **Labels** (`txtC` bold=true) : fond `C_LBLUE` (`#BDD6EE`), texte `#0E2841` gras
- **Données** (`txtC` bold=false) : fond blanc, texte noir

### Sélecteur d'entité (IDF / Grand EST)
Champ `r.entite` sur le rapport (`'idf'` ou `'grand_est'`).  
Utilisé dans `doWordDocx()` via `_ENTITES[r.entite]` pour la page de couverture et le footer Word :
```js
const _ENTITES = {
  'idf':      { nom:'NEOCONCEPT VRD', adresse:'84/88 Bd de la Mission Marchand, 92400 Courbevoie', ... },
  'grand_est':{ nom:'NEOCONCEPT VRD GRAND EST', adresse:'16 avenue de l\'Europe - 67300 SCHILTIGHEIM', ... }
};
```

### Synchronisation
```js
syncChantierToFirebase(c)   // Sync chantier vers Firestore (avec backup avant)
syncRapportToFirebase(r)    // Sync rapport + upload photos Storage
flushSyncQueue()            // Vide la file de sync (avec retry + backoff)
_getBackoffDelay(retries)   // 5s → 15s → 45s → 2min → 5min (max)
SYNC_MAX_RETRIES = 5
```

### Backup automatique
```js
_backupBeforeSync(type, id)  // Sauvegarde dans localStorage avant chaque sync Firestore
restoreBackup(type, id)      // Restaure depuis localStorage
// Max 50 backups, LRU eviction, clé: 'ncvrd_backup_{type}_{id}'
```

### Nettoyage mensuel
```js
monthlyCleanup(manual=false)    // Vide IndexedDB + Firestore + Storage
// ATTENTION: ne PAS appeler loadChantiers() après les batch deletes
// (race condition : Firestore ne propage pas immédiatement)
// Correct : renderChantiers([]) seulement
```

### Sécurité
```js
escHtml(str)    // Échappe HTML pour éviter XSS (utiliser dans tous les innerHTML dynamiques)
_escHtml(s)     // Alias dans DynLists
```

---

## Design System CSS

### Modes d'affichage
- **Mode nuit** (défaut) : fond sombre `#0a0f1e`, glassmorphism, dark mode
- **Mode terrain** : fond clair `#f5f7fa`, haute lisibilité soleil → `data-terrain="1"` sur `<html>`
- **`color-scheme: dark`** sur `html` → active le dark mode natif des `<select>` et `<input>`

### Variables principales (`:root`, lignes ~28-70)
```css
--primary: #0a0f1e        /* fond principal */
--accent:  #00aaff        /* bleu accent */
--glass: rgba(255,255,255,.06)   /* fond glassmorphism */
--glass-border: rgba(255,255,255,.12)
--blur: 20px              /* backdrop-filter uniforme */
--text: #f1f5f9           /* texte principal */
--muted: #94a3b8          /* texte secondaire */
--border: rgba(255,255,255,.08)
--input: rgba(255,255,255,.04)
--inputborder: rgba(255,255,255,.1)
```

### Conventions
- Toujours utiliser `escHtml()` pour tout texte dynamique dans `innerHTML`
- Pas de modification JS (logique métier inchangée) lors de refonte CSS
- Mode terrain (`data-terrain="1"`) doit rester lisible après tout changement de style
- Le login et register utilisent un fond clair → leurs labels restent `color:#3d4a5e`

---

## Virtual Scroll (liste des chantiers)

```js
const VIRTUAL_BATCH = 8;   // cartes chargées par intersection
// Architecture sentinel-first OBLIGATOIRE :
// 1. container.appendChild(sentinel)   ← sentinel ajouté EN PREMIER
// 2. _appendBatch()                    ← insertBefore(frag, sentinel) ensuite
// Sans ça : "insertBefore: node is not a child of this node"
```

---

## Workflow de publication

### Publier sur GitHub Pages
```bat
PUBLIER SUR GITHUB.bat
```
Ce fichier :
1. `git add -f index.html LOGO.png sw.js manifest.json`
2. `git commit -m "Mise a jour NCVRD Detect"`
3. `git push` → GitHub Pages se met à jour (~1 min)
4. Tester avec `Ctrl+Shift+R` sur l'appli pour vider le cache

### Push correctifs spécifiques
```bat
PUSH_CORRECTION_PHOTOS.bat
```
(même principe mais avec un message de commit détaillé)

**Chemin git** : `D:\Desktop\Bureau\NCVRD Detect` (branch `master`)
**URL déployée** : https://neoconceptvrd.github.io/ncvrd-detect/

---

## Bugs connus et fixes appliqués

| Bug | Cause | Fix |
|-----|-------|-----|
| `insertBefore: not a child` au démarrage | Sentinel ajouté après `_appendBatch()` | Sentinel ajouté AVANT dans `_virtualRender()` |
| Export Word → ZIP téléchargé | `fixDocxJpeg` sans `mimeType` dans `generateAsync` | Ajout de `mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'` |
| Photos absentes dans Word | `parseImg` retournait base64 string au lieu de Uint8Array | Converti avec `Uint8Array.from(atob(b64), c => c.charCodeAt(0))` |
| Dropdowns blancs en mode sombre | Pas de `color-scheme:dark` sur les `<select>` | Ajout `color-scheme:dark` sur `html` et `select`, explicit `option` styling |
| `.bat` "not a git repository" | Chemin codé en dur vers `C:\Users\...` | Corrigé : `cd /d "D:\Desktop\Bureau\NCVRD Detect"` |
| Chantiers persistent après "supprimer tout" | `loadChantiers()` re-fetchait Firestore avant propagation des batch deletes | Supprimé `await loadChantiers()` dans `monthlyCleanup()` |
| Chantiers fantômes (race condition sync) | — | Ne jamais appeler `loadChantiers()` juste après batch delete Firestore |
| **Chantier supprimé revient après refresh** | Causes multiples — voir détail ci-dessous | Voir section "Suppression de chantier — architecture complète" |
| **Photos réseaux disparaissent après refresh** | `openChantier` remplaçait le rapport local (avec base64) par la version Firestore (base64 stripés) | Merge dans `openChantier` : restaure base64 locaux + URLs Storage Firestore |
| **Partage collaborateur cassé** | Règle Firestore `allow list` restreinte aux admins → techniciens ne pouvaient pas lister les users | `allow list: if isAuth()` dans `/users/{uid}` |
| **Notifications ne se déclenchent pas** | Règle Firestore utilisait `resource.data.toUserId` mais le code envoie `toUid` | Corrigé le nom de champ dans `firestore.rules` : `toUserId` → `toUid` |

---

## Suppression de chantier — architecture complète

La suppression est un cas critique avec de nombreux chemins de ré-création. Voici l'architecture complète mise en place :

### `deleteChantier(id)` — ordre des opérations OBLIGATOIRE
```js
// 1. Vider la sync queue pour cet ID (avant toute suppression IDB)
saveSyncQueue(getSyncQueue().filter(item => String(item.id) !== String(id)));
clearTimeout(_syncRetryTimer);

// 2. Supprimer de l'IDB (direct, pas via CloudDB.del qui irait aussi en Firestore)
await db._idb.del('chantiers', id);
await db._idb.del('rapports', id);

// 3. Supprimer de Firestore + vérification serveur
await fdb.collection('teams').doc(teamId).collection('chantiers').doc(String(id)).delete();
// IMPORTANT : vérifier depuis le SERVEUR car offline persistence masque les erreurs
const check = await ref.get({ source: 'server' });
// Si check.exists → les règles Firestore ont bloqué le delete silencieusement

// 4. Supprimer les backups localStorage
localStorage.removeItem(`ncvrd_backup_chantier_${id}`);
localStorage.removeItem(`ncvrd_backup_rapport_${id}`);

// 5. Ajouter au tombstone (liste noire locale)
// → protège contre le retour du chantier même si Firestore refuse le delete
const tomb = JSON.parse(localStorage.getItem('ncvrd_deleted_ids') || '[]');
tomb.push(String(id));
localStorage.setItem('ncvrd_deleted_ids', JSON.stringify(tomb.slice(-100)));

// 6. Vider le contexte courant si c'était ce chantier qui était ouvert
// → CRITIQUE : sinon autosave/saveRapportNow() re-crée le chantier en Firestore
clearTimeout(saveTimer);
S.currentChantier = null;
S.currentRapport = null;

// 7. Retirer de S.chantiers + re-render
S.chantiers = S.chantiers.filter(c => String(c.id) !== String(id));
renderChantiers(S.chantiers);
```

### Tombstone localStorage (`ncvrd_deleted_ids`)
- Clé : `ncvrd_deleted_ids` → array de string IDs
- Alimenté par `deleteChantier` (step 5 ci-dessus)
- Filtré dans `loadChantiers()` après lecture Firestore
- Auto-nettoyage : si un ID du tombstone n'est plus dans Firestore → retiré du tombstone
- Max 100 entrées

### Gardes IDB dans les fonctions de sync
```js
// syncChantierToFirebase(c) — TOUJOURS vérifier l'IDB avant de syncer
const exists = await db._idb.get('chantiers', c.id);
if(!exists) return; // Ne pas re-créer un chantier supprimé

// syncRapportToFirebase(r) — idem
const exists = await db._idb.get('rapports', r.id);
if(!exists) return;

// flushSyncQueue — utiliser db._idb.get() et NON db.get()
// db.get() fait un fallback Firestore qui retournerait le doc même après suppression IDB
const c = await db._idb.get('chantiers', item.id);
if(!c) { synced++; continue; } // Ignorer, ne pas re-syncer

// rapportChanged() debounce — vérifier l'IDB avant db.put()
const stillExists = await db._idb.get('rapports', r.id);
if(!stillExists) return;

// saveRapportNow() — vérifier rapport ET chantier
const existsR = await db._idb.get('rapports', r.id);
if(!existsR) return;
```

### Déploiement des règles Firestore
```js
// script deploy-rules.js (à recréer si besoin) :
// Utilise firebase-admin + l'API REST Firebase Security Rules
// node deploy-rules.js  →  déploie firestore.rules sur le projet ncvrd-detect
// Pas besoin de `firebase login` : le serviceAccount.json sert d'auth
```

### Pourquoi `db.get()` ≠ `db._idb.get()` dans ce contexte
`CloudDB.get(store, id)` va d'abord chercher **dans Firestore** (si connecté), pas dans l'IDB.  
Si le chantier est encore en Firestore (delete serveur rejeté), `db.get()` le retourne → re-sync.  
Toujours utiliser `db._idb.get()` pour vérifier l'existence locale avant de syncer.

---

## Photos — Merge Firestore ↔ IDB dans `openChantier`

**Problème** : `syncRapportToFirebase` stripe les photos base64 avant d'envoyer en Firestore (trop lourd).  
Quand un collaborateur recharge le chantier, `openChantier` prenait la version Firestore → photos disparaissent.

**Fix dans `openChantier`** : après récupération du rapport Firestore, fusionner les données locales :
```js
if(rapport){
  // Réseaux : Storage URLs (Firestore) + base64 (local IDB)
  remote.networks = remote.networks.map(rn => {
    const ln = rapport.networks.find(x => x.id === rn.id);
    if(!ln) return rn;
    const storageUrls = (rn.photos||[]).filter(p => p && !p.startsWith('data:'));
    const localB64    = (ln.photos||[]).filter(p => p?.startsWith('data:'));
    rn.photos = [...storageUrls, ...localB64];
    if(ln._photosUrls?.length) rn._photosUrls = ln._photosUrls;
    return rn;
  });
  // planSituation, conclusionPhotos, signatures — toujours depuis local si présent
  if(!remote.planSituation && rapport.planSituation) remote.planSituation = rapport.planSituation;
  // ... idem pour _planUrl, conclusionPhotos, _conclusionUrls, signature, signatureVeri
}
```

---

## Bouton refresh collaborateur (`refreshChantierNow`)

Permet à un collaborateur de recharger manuellement le chantier depuis Firestore :
```js
async function refreshChantierNow(){
  await saveRapportNow();   // sauvegarde locale d'abord
  await openChantier(c.id); // recharge depuis Firestore (avec merge photos)
}
```
Bouton `🔄` avec `id="btn-refresh-chantier"` dans l'en-tête du rapport.

---

## Points d'attention critiques

1. **Fichier unique** : tout est dans `index.html`. Pas de build, pas de bundler.
2. **`parseImg()` doit retourner `Uint8Array`** — docx.js v8 n'accepte pas les base64 string pour les images.
3. **`fixDocxJpeg()` est indispensable** — sans lui, le fichier généré est un ZIP renommé.
4. **Ne jamais appeler `loadChantiers()` dans `monthlyCleanup()`** — race condition Firestore.
5. **Virtual scroll** : le sentinel doit être ajouté au DOM AVANT le premier `insertBefore`.
6. **Mode terrain** : tester que la lisibilité reste bonne après tout changement CSS global.
7. **`escHtml()`** : obligatoire sur tout contenu utilisateur injecté en HTML (XSS).
8. **Photos** : stockées en IndexedDB uniquement (local), jamais en Firestore. Firebase Storage uniquement pour les URLs dans les exports.
9. **Sync queue** : la queue est dans localStorage (`ncvrd_sync_queue`). Toujours vider la queue AVANT de supprimer de l'IDB lors d'un delete.
10. **Section 8 (chat)** : supprimée entièrement — ne pas réintroduire.
11. **Suppression chantier** : voir section dédiée ci-dessus. Ne JAMAIS simplifier `deleteChantier` — chaque étape a sa raison d'être.
12. **Firebase offline persistence masque les erreurs serveur** : `delete()` / `set()` / `update()` résolvent TOUJOURS localement, même si le serveur refuse. Toujours vérifier via `ref.get({source:'server'})` après une opération critique.
13. **Règles Firestore** : déployer via `node deploy-rules.js` (utilise `serviceAccount.json` + API REST). Ne pas passer par `firebase login` (non configuré sur cette machine).
14. **Photos après refresh Firestore** : `openChantier` doit TOUJOURS merger les photos base64 locales avec les URLs Storage Firestore. Ne jamais remplacer directement le rapport local par la version Firestore brute.
15. **Champ notifications** : le code utilise `toUid` (pas `toUserId`). Les règles Firestore doivent utiliser `resource.data.toUid`. Ne pas renommer ce champ.
16. **Export Word ouvrages** : les couleurs sont dans `_generateOuvragesWord()` (constantes locales `C_YELLOW`, `C_BLUE`, `C_LBLUE`, `C_NAVY`). Ne pas confondre avec les constantes du rapport chantier (`NAVY`, `ORANGE`) qui sont dans `doWordDocx()`.

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `ncvrd_terrain` | `'0'` ou `'1'` — mode terrain actif |
| `ncvrd_last_monthly_cleanup` | `'YYYY-MM'` — date du dernier nettoyage |
| `ncvrd_backup_{type}_{id}` | Backup JSON avant sync Firestore |
| `ncvrd_sync_backups` | Index des backups (LRU, max 50) |
| `ncvrd_sync_queue` | File de sync en attente (array JSON) |
| `ncvrd_deleted_ids` | Tombstone — IDs supprimés localement (max 100). Filtre les docs revenus de Firestore dans `loadChantiers`. |
| `ncvrd_dyn_lists` | Listes dynamiques (rôles, réseaux, matériels…) |
| `profilePhoto_{uid}` | Photo de profil (legacy fallback) |
