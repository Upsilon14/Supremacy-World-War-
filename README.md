# Supremacy — World War

Jeu de grande stratégie multijoueur (HTML + socket.io) sur carte mondiale de
**210 provinces** réparties entre **10 nations** (France, Allemagne,
Royaume-Uni, Russie, Italie, Espagne, Empire ottoman, États-Unis, Japon,
Brésil).

## Lancer le jeu

```bash
npm install
node server.js
```

Puis ouvrir http://localhost:3000

- **Côté créateur** : renseigner le nom de commandant, activer ou non le bouton
  **Triche** (il débloque les paramètres supplémentaires à la création —
  argent de départ, bonus créateur — et le panneau « Commandes du créateur »
  en jeu), puis créer la partie et partager le code.
- **Côté joueur** : entrer le code d'invitation, rejoindre, choisir une nation.
- Le créateur lance la partie ; des IA peuvent compléter les nations sans
  joueur.

## Règles

- Chaque nation démarre avec 21 provinces, des troupes et un trésor national
  alimenté chaque jour par la production de ses provinces.
- 6 ressources : nourriture, bois, fer, pétrole, charbon, argent.
- Unités : infanterie, artillerie, chars, avions, navires (port requis).
- Bâtiments : caserne, usine, port, gare, fort (défense ×1,4).
- Attaque : fraction (10–90 %) de la garnison d'une province adjacente ;
  puissance aléatoire ±25 %, les survivants d'un échec rentrent à 50 %.
- Déplacement : transfert d'unités (par type ou toute la garnison) entre deux
  de ses provinces adjacentes — utile pour masser ou séparer les troupes.
- Carte : fond de Terre stylisé, icônes de bâtiments sur chaque province
  (🏰 caserne, 🏭 usine, ⚓ port, 🚉 gare, 🏯 fort) et effectif affiché sous
  chaque province (il fond lors des combats).
- **Victoire** : contrôler **150 provinces** sur 210.

## Commandes de triche (créateur, si activées à la création)

Troupes, véhicules, ressources (vers le trésor), bâtiment — avec **choix de la
province cible** — et « Offrir des provinces » (transfert immédiat, déclenche
la vérification de victoire).

## Variables d'environnement

- `PORT` (défaut 3000)
- `DAY_MS` (défaut 20000) — durée d'un jour de jeu
- `HOURS_PER_DAY` = 10 (fixe dans `server.js`)

## Fichiers

- `server.js` — serveur autoritaire (état, combats, IA, économie, victoire)
- `world-map.js` — données de la carte (210 provinces, 10 nations, production)
- `index.html` — interface (lobby deux côtés, carte, combats, panneau triche)
- `test-client.js` — tests bout-en-bout (22 vérifications)
- `play-game.js` — script de démo : joue une partie France contre 9 IA

## Tests bout-en-bout

```bash
npm install
PORT=3100 DAY_MS=5000 node server.js &
node test-client.js
```

26 vérifications : création/rejointe, carte 210 provinces / 10 nations, choix
de nation, lancement avec IA, trésor national, recrutement, construction,
déplacement (y compris refus hors adjacence), combat et adjacence, triche
activée/désactivée, triche ciblée par province, refus des commandes par un
non-créateur, transfert de provinces et détection de la victoire.
