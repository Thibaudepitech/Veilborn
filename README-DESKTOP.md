# Veilborn Desktop

Veilborn est un RPG multijoueur en temps réel avec une interface 2D isométrique. La version desktop empacte le jeu complet avec le serveur intégré.

## Installation & Lancement

### Pré-requis
- Node.js 14+
- npm 6+

### Développement

```bash
# Installer les dépendances
npm install

# Lancer l'app en mode développement
npm start

# L'app ouvrira automatiquement avec les dev tools
```

### Build pour Production

```bash
# Générer tous les builds (Windows + Linux)
npm run dist

# Ou builds spécifiques:
npm run build:win   # Windows uniquement
npm run build:linux # Linux uniquement

# Les installateurs seront dans le dossier `dist/`
```

### Fichiers générés

**Windows:**
- `Veilborn-Setup.exe` - Installateur Windows (recommandé)
- `Veilborn-portable.exe` - Exécutable standalone

**Linux:**
- `Veilborn-x86_64.AppImage` - Exécutable AppImage
- `veilborn_x.x.x_amd64.deb` - Package Debian/Ubuntu

## Structure du Projet

```
veilborn-desktop/
├── public/          # Fichiers client (HTML, CSS, JavaScript)
├── serveur/         # Serveur Node.js WebSocket
├── src/main.js      # Processus Electron principal
├── package.json     # Configuration et dépendances
└── electron-builder.yml  # Configuration des builds
```

## Configuration

Créer un fichier `.env` basé sur `.env.example`:

```bash
cp .env.example .env
```

Variables disponibles:
- `PORT` - Port du serveur (défaut: 3000)
- `NODE_ENV` - Environnement (development/production)
- `LOG_LEVEL` - Niveau de log (info/debug/error)

## Développement

### Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm start` | Lancer l'app Electron |
| `npm run dev` | Dev mode avec hot-reload |
| `npm run build:win` | Build Windows (.exe) |
| `npm run build:linux` | Build Linux (AppImage + .deb) |
| `npm run dist` | Build tous les formats |
| `npm run pack` | Preparerle build (sans signer) |

### Raccourcis Clavier

- **F11** - Basculer le mode plein écran
- **F12** - Ouvrir les dev tools (dev mode)
- **Ctrl+Q** - Quitter l'application

## Troubleshooting

### Erreur: "Serveur ne démarre pas"
1. Vérifier que le port 3000 est libre
2. Vérifier que Node.js est correctement installé
3. Vérifier les logs dans la console Electron

### App ne se lance pas
1. Vérifier que `npm install` s'est bien exécuté
2. Vérifier qu'il n'y a pas d'erreurs dans les dev tools (F12)
3. Supprimer le dossier `node_modules` et réinstaller: `npm install`

### Problèmes de performance
- Fermer les autres applications
- Vérifier la résolution d'écran
- Chercher les messages d'erreur dans les dev tools

## Contribution

Pour signaler des bugs ou suggérer des améliorations, ouvrir une issue sur le repository.

## License

Voir le fichier LICENSE

## Support

Pour toute question ou problème, consultez la documentation du projet ou ouvrez une issue.
