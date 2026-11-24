# Sheet Music — Tessiture réglable, menu principal, mise en prod Cloudflare — Design

Date : 2026-11-24 · Statut : en relecture par Paul (relu par un « builder check »)
Complète `2026-11-19-lecture-notes-mvp-design.md` : les niveaux 1–5 y sont remplacés par le réglage décrit ici.

## 1. Intention
- **Lecture** : choisir précisément les notes travaillées au lieu de 5 niveaux figés. On règle la note la plus grave, la plus aiguë (par clé) et le saut maximum entre deux notes.
- **Accueil** : un vrai menu principal Lecture / Écriture. Aujourd'hui l'accueil est le menu de lecture avec un petit lien « Écrire ».
- **Prod** : mettre l'app en ligne sur un nom de domaine acheté chez Cloudflare. L'app est 100 % front, donc tout est hébergé chez Cloudflare.

Quatre parties indépendantes, livrées dans cet ordre : tessiture → menu → export/import → prod. Un commit (ou plus) par partie.

## 2. Décisions de Paul
1. Les boutons de niveau 1–5 disparaissent.
2. Un bouton ouvre une **modale de réglage** avec, pour chaque clé du mode choisi, une mini-portée « plus grave » et une mini-portée « plus aiguë ». Ça fait 2 mini-portées en Sol ou en Fa, et 4 en Sol + Fa.
3. **Placer une note dans une mini-portée** : même geste que pour poser une note dans Écriture (on touche la portée, l'aperçu suit le doigt, on glisse pour ajuster, la note est posée au relâcher). La portée est simplement beaucoup plus étroite.
4. **Boutons ▲ ▼ à droite de chaque mini-portée** : ils montent ou descendent la note d'un degré.
5. **Le saut max entre deux notes est un réglage de la même modale.**
6. **Record = clé + tessiture(s) + saut max.** Toute combinaison différente a son propre record.
7. Menu principal avec Lecture / Écriture, et un bouton pour revenir au menu principal.
8. Prod uniquement sur Cloudflare, avec le domaine acheté chez Cloudflare.

## 3. Non-objectifs
- Pas d'altérations dans la tessiture : uniquement des notes naturelles, comme aujourd'hui.
- Pas de préréglages nommés (« facile », « difficile »…) ni de reprise des anciens niveaux comme raccourcis.
- Pas de backend, de comptes ni de synchronisation des records : ils restent dans le navigateur.
- Pas de changement de l'Écriture, hormis le lien de retour.

## 4. Approches envisagées (choix de saisie dans une mini-portée)
| Approche | Pour | Contre |
|---|---|---|
| **Glisser-déposer comme dans Écriture + ▲▼ (retenue par Paul)** | Geste déjà connu, rapide pour aller loin, précis grâce aux flèches | Il faut extraire/réutiliser la logique de pose de `PageView` |
| ▲▼ seulement | Le plus simple | Jusqu'à ~20 appuis d'un bout à l'autre |
| Curseur à côté de la portée | Rapide | L'œil doit suivre deux endroits, on ne voit pas la note visée |

Pour le saut max, trois options ont été envisagées : le dériver de l'amplitude, le supprimer, ou en faire un réglage. Paul a choisi le réglage.

## 5. Partie A — Tessiture et saut réglables

### 5.1 Modèle
```ts
interface ReadingSettings {
  clefMode: ClefMode                          // 'treble' | 'bass' | 'both'
  ranges: Record<Clef, { low: string; high: string }>  // notation 'E4'
  maxLeap: number                             // en degrés ; Infinity = libre
}
```
- `ranges` garde **les deux clés** même en mode Sol seul, pour qu'on retrouve ses réglages Fa en changeant de mode.
- **Valeurs par défaut (mon choix)** : celles de l'ancien niveau 1. Sol `E4–F5`, Fa `G2–A3`, saut = tierce (2).
- **Plage autorisée** : celle de la pose dans l'éditeur, soit jusqu'à 4 lignes supplémentaires (`MIN_STEP`/`MAX_STEP` de `pitchFromY.ts`). Sol `D3–G6`, Fa `F1–B4`. L'ancien niveau 5 (Sol `C3–A6`, Fa `E1–C5`) allait un peu plus loin : on garde la limite de l'éditeur, 4 lignes supplémentaires.
- **Garde-fou (mon choix)** : grave < aiguë, d'au moins un degré. La règle est la même pour le glisser et pour ▲▼ : la note s'arrête à un degré de l'autre. Pendant le glisser, l'aperçu reste bloqué à cette limite. Les ▲▼ concernés sont désactivés. L'autre note ne bouge jamais toute seule.
- **Saut max proposé (mon choix)** : pastilles `2de · 3ce · 4te · 5te · 6te · 7e · Octave · Libre`, soit 1…7 degrés ou Infinity. Même sémantique que l'actuel `maxLeap` (2 = tierce).
- `levels.ts` disparaît. Le type `Level`, `LEVEL_SPECS`, `isLevel` et les libellés de niveau aussi. `CLEF_MODES`/`isClefMode` sont conservés (déplacés dans un `settings.ts`).

### 5.2 Générateur
`generateNotes({ settings, count, previous })` remplace `{ clefMode, level }`. La logique est inchangée (marche aléatoire, pas de répétition, au plus 3 notes d'affilée sur la même clé), mais elle lit la tessiture et le saut dans les réglages. Les tests existants sont adaptés en traduisant chaque niveau en réglages équivalents, et on ajoute :
- une tessiture de 2 notes (le tirage alterne sans répéter) ;
- un saut libre ;
- un saut plus grand que la tessiture.

### 5.3 Persistance et URL
- **Derniers réglages** : `localStorage` `sheet-music:last-settings`, qui contient désormais `ReadingSettings`. Un ancien contenu `{clef, level}` est ignoré, sauf `clef` qui est repris.
- **URL de partie** : `/play?clef=both&tl=E4&th=F5&bl=G2&bh=A3&leap=2` (`leap=free` pour libre). On n'y met que les tessitures des clés jouées. Un paramètre absent ou invalide est pris dans les derniers réglages, puis dans les valeurs par défaut (mon choix). « Rejouer » et « Retour » réutilisent exactement la combinaison de la partie, donc le même record.
- **Records** : clé de stockage canonique qui ne contient que les clés jouées. Exemples : `treble|E4-F5|2` et `both|E4-F5|G2-A3|free`. Les anciens records par niveau sont abandonnés : ils ne sont ni migrés ni affichés. Le nom de la clé `localStorage` change (`sheet-music:records-v2`), ce qui laisse l'ancienne de côté sans la lire.

### 5.4 Menu de lecture
- Les boutons 1–5 et le libellé de niveau disparaissent. À leur place, une ligne résumé avec un bouton **« Régler »** :
  ```
  Notes   Sol Mi4–Fa5 · Fa Sol2–La3 · sauts ≤ tierce     [ Régler ]
  ```
  Le résumé est en solfège français (`SOLFEGE` + octave). Seules les clés du mode choisi apparaissent.
- Le record affiché est celui de la combinaison courante.
- L'en-tête de la partie remplace « niveau N » par ce même résumé, en version courte.

### 5.5 Modale « Notes travaillées »
```
┌ Notes travaillées ────────────────────────────── ✕ ┐
│        plus grave              plus aiguë          │
│ Sol  [ 𝄞 ──●── ] ▲▼  Mi4     [ 𝄞 ──●── ] ▲▼  Fa5   │
│ Fa   [ 𝄢 ──●── ] ▲▼  Sol2    [ 𝄢 ──●── ] ▲▼  La3   │   ← ligne Fa seulement si mode Fa ou Sol+Fa
│                                                    │
│ Saut max  (2de)(3ce)(4te)(5te)(6te)(7e)(Oct)(Libre) │
│                                    [ Valider ]     │
└────────────────────────────────────────────────────┘
```
- Chaque mini-portée est une portée VexFlow étroite (clé + une note), assez haute pour afficher 4 lignes supplémentaires de chaque côté.
- **Geste** : le même que la pose dans `PageView`. Au toucher, un aperçu de la note apparaît à la hauteur du doigt, il suit le doigt en vertical, et la note est posée au relâcher. Si on sort loin de la portée, la pose est annulée et la note d'avant reste. Comme il n'y a qu'une note, elle reste centrée horizontalement : seule la hauteur suit le doigt.
- **▲ ▼** à droite de la portée, avec le nom de la note à côté. Ils sont désactivés en butée (plage ou garde-fou).
- Le nom de la note est affiché en clair en plus de la portée.
- Les modifications sont appliquées à **Valider**. ✕ ou un clic en dehors annule.
- En mobile paysage (peu de hauteur), la modale passe en plein écran et tout doit tenir sans défilement. Sinon, c'est une boîte centrée.

### 5.6 Réutilisation du geste de pose
On extrait de `PageView.vue` ce qui sert à la fois à l'éditeur et à la mini-portée : conversion y → degré (`stepAt`), bornes et annulation (`MIN_STEP - 6`/`MAX_STEP + 6`), et rendu de l'aperçu. Le reste de `PageView` (mesures, barres, sélection, pincement) n'est pas concerné. Le comportement de l'éditeur ne doit pas changer. Ses tests existants servent de filet de sécurité.

## 6. Partie B — Menu principal
- **Nouvelle route `/` = Accueil** : marque, sélecteurs de thème et plein écran, et deux grandes cartes, **Lecture** (« Lis les notes ») et **Écriture** (« Écris, écoute, exporte »). Chaque carte a sa petite illustration de portée.
- **Le menu de lecture passe sur `/read`.** On retire son lien « Écrire » et on ajoute à gauche de la marque une flèche ← qui renvoie à l'Accueil.
- **Liste des partitions (`/scores`)** : sa flèche ← existante renvoie à l'Accueil.
- **Partie et éditeur** gardent leur retour actuel : la partie revient au menu de lecture (`/read`), l'éditeur à la liste des partitions. Le retour à l'accueil se fait donc en deux pas depuis le cœur de l'activité (mon choix, pour ne pas surcharger les écrans de jeu et d'édition).
- Les anciens liens `#/?clef=…&level=…` retombent simplement sur l'Accueil.
- Le titre de l'onglet et la description de `index.html` couvrent les deux parties (« Sheet Music — Lire et écrire la musique »).

## 7. Partie C — Exporter / importer les données
Paul veut ce bouton dans **les réglages de l'app**. Il n'existe pas encore d'écran de réglages : on ajoute une **roue ⚙ dans la barre du haut de l'Accueil**, à côté du thème et du plein écran, qui ouvre une modale « Réglages » avec deux boutons.
- **Exporter mes données** : télécharge `sheet-music-AAAA-MM-JJ.json`. Le fichier contient toutes les clés `localStorage` de l'app (partitions, records, derniers réglages), plus `{ app: 'sheet-music', version: 1, exportedAt }`.
- **Importer** : choix d'un fichier, contrôle qu'il vient bien de l'app, puis un résumé (« 3 partitions, 12 records ») avec confirmation. **Fusion (mon choix)** : on n'efface rien. Une partition de même id est remplacée par celle du fichier. Pour les records, on garde le meilleur des deux. Les derniers réglages sont pris dans le fichier. Toute écriture dans les partitions passe par `scoresApi`, avec invalidation de vue-query.
- Un fichier invalide affiche un message et ne touche à rien.
- Ces fonctions doivent être en ligne sur `github.io` **avant** la redirection, pour que l'export y soit possible. C'est ce qui impose l'ordre décrit au §8.

## 8. Partie D — Mise en prod Cloudflare
- **Hébergement** : Cloudflare Pages relié au dépôt GitHub `PaulDoazan/sheet-music`, avec un build à chaque push sur `main` et des aperçus automatiques sur les autres branches. Commande `npm test && npm run build`, dossier `dist`, Node 22 (fichier `.nvmrc`).
- **Chemin de base** : `base` vaut désormais `/` par défaut dans `vite.config.ts`, et la variable `VITE_BASE` reste possible. Le routeur reste en mode `#` : aucune réécriture côté serveur n'est nécessaire.
- **Tests au build** : `npm test && npm run build` comme commande de build Cloudflare (mon choix), pour qu'un test cassé bloque la mise en prod.
- **GitHub Pages, en deux temps** (décision de Paul : les données doivent suivre) :
  1. **Pendant la migration**, les deux sites tournent. Le workflow GitHub Pages reste en place et construit avec `VITE_BASE=/sheet-music/`. Paul exporte depuis `github.io` et importe sur le nouveau domaine.
  2. **Après la migration** (commit séparé, sur le feu vert de Paul), le workflow ne publie plus l'app mais une page de redirection vers le nouveau domaine, en gardant le `#/…` pour que les anciens liens marchent. Le domaine est indiqué dans le workflow.
- **En-têtes** : un fichier `public/_headers` qui met en cache long les fichiers à empreinte (`/assets/*`, immuables) et ne met pas en cache `index.html`.
- **État git** : `origin/main` est déjà à jour (au niveau d'`editor-v3`) et GitHub Pages sert aujourd'hui https://pauldoazan.github.io/sheet-music/ (seul le `main` local était en retard). Cette branche sera mergée sur `main` par une PR, comme d'habitude.
- **Ce que Paul fait dans le tableau de bord Cloudflare** (pas automatisable ici, ou alors avec ses identifiants) : acheter le domaine, créer le projet Pages relié à GitHub avec les réglages ci-dessus, puis ajouter le domaine personnalisé (domaine nu + `www`, avec redirection de `www` vers le domaine nu). La procédure pas à pas est ajoutée au README.
- Le README remplace l'URL GitHub Pages par le domaine final quand il sera connu.

## 9. Laissé au développeur
- Le découpage exact des composants (`RangePickerDialog`, `PitchPickerStaff`…) et l'endroit où vit la logique de pose partagée.
- Les dimensions exactes des mini-portées et la mise en page fine de la modale, du moment que tout tient sans défilement en mobile paysage.
- Le texte exact des cartes de l'Accueil.
