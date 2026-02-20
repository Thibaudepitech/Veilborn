const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;
const PORT = 3000;

// Déterminer le chemin du serveur selon le contexte (dev ou production)
function getServerPath() {
  const appPath = app.getAppPath();
  if (process.env.NODE_ENV === 'development') {
    // En dev: serveur/index.js depuis la racine du projet
    return path.join(__dirname, '../serveur/index.js');
  } else {
    // En production (packagé): serveur/index.js depuis resources/app
    return path.join(appPath, 'serveur/index.js');
  }
}

// Démarrer le serveur Node.js
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = getServerPath();

    console.log(`[Electron] Démarrage du serveur: ${serverPath}`);

    if (!fs.existsSync(serverPath)) {
      console.error(`[Electron] Fichier serveur non trouvé: ${serverPath}`);
      reject(new Error(`Serveur non trouvé: ${serverPath}`));
      return;
    }

    // Lancer le serveur Node.js en tant que processus enfant
    serverProcess = spawn('node', [serverPath], {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        PORT: PORT,
        NODE_ENV: process.env.NODE_ENV || 'production'
      }
    });

    // Afficher les logs du serveur
    serverProcess.stdout.on('data', (data) => {
      console.log(`[SERVER] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('error', (err) => {
      console.error('[SERVER] Erreur:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`[SERVER] Exited with code ${code}`);
    });

    // Attendre que le serveur soit prêt
    let retries = 0;
    const maxRetries = 30;
    const checkServer = () => {
      const http = require('http');
      const req = http.get(`http://localhost:${PORT}`, () => {
        console.log('[Electron] Serveur prêt!');
        resolve();
      });
      req.on('error', () => {
        if (retries < maxRetries) {
          retries++;
          setTimeout(checkServer, 200);
        } else {
          reject(new Error('Serveur ne démarre pas'));
        }
      });
    };

    setTimeout(checkServer, 500);
  });
}

// Créer la fenêtre Electron
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  const webPreferences = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true
  };

  // Ajouter le preload.js s'il existe
  if (fs.existsSync(preloadPath)) {
    webPreferences.preload = preloadPath;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences,
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  // Charger localhost:3000
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Afficher la fenêtre
  mainWindow.show();

  // Ouvrir les dev tools en dev
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Gérer la fermeture
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Créer le menu
  createMenu();

  // Raccourcis clavier
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F11 = fullscreen
    if (input.key.toLowerCase() === 'f11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

// Créer le menu
function createMenu() {
  const isMac = process.platform === 'darwin';

  const menu = [
    {
      label: 'Fichier',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edition',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos',
          click: () => {
            mainWindow?.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const appMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(appMenu);
}

// Initialiser l'app
app.on('ready', async () => {
  console.log('[Electron] Démarrage de l\'application...');

  try {
    await startServer();
    createWindow();
  } catch (error) {
    console.error('[Electron] Erreur au démarrage:', error);
    app.quit();
  }
});

// Quitter l'app
app.on('window-all-closed', () => {
  console.log('[Electron] Fermeture de l\'application...');

  // Tuer le serveur
  if (serverProcess) {
    console.log('[Electron] Arrêt du serveur...');
    serverProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Electron] Exception non gérée:', error);
});
