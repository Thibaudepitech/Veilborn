// ═══════════════════════════════════════════════════════
// VEILBORN — SYSTÈME DE DONJON
// Ready system + téléportation dans zone donjon
// ═══════════════════════════════════════════════════════

const DungeonSystem = {
  readyPlayers: new Set(),   // sessionIds des joueurs prêts (+ 'me' pour le joueur local)
  inDungeon: false,
};

// ─────────────────────────────────────────
// READY SYSTEM
// ─────────────────────────────────────────
function toggleReadyDungeon() {
  if (DungeonSystem.inDungeon) return;
  const btn = document.getElementById('btn-ready-dungeon');

  if (DungeonSystem.readyPlayers.has('me')) {
    // Se désinscrire
    DungeonSystem.readyPlayers.delete('me');
    if (btn) { btn.textContent = '◎ Prêt pour le donjon'; btn.style.background = 'rgba(155,77,202,0.15)'; }
    if (typeof addLog === 'function') addLog('Vous n\'êtes plus prêt pour le donjon.', 'normal');
    if (window.multiState?.active) wsSend('dungeon_ready', { ready: false });
  } else {
    // Se marquer prêt
    DungeonSystem.readyPlayers.add('me');
    if (btn) { btn.textContent = '✓ Prêt !'; btn.style.background = 'rgba(39,174,96,0.25)'; btn.style.borderColor = '#27ae60'; btn.style.color = '#2ecc71'; }
    if (typeof addLog === 'function') addLog('Vous êtes prêt pour le donjon !', 'action');
    if (window.multiState?.active) wsSend('dungeon_ready', { ready: true });
  }

  refreshDungeonReadyPanel();
}

// ─────────────────────────────────────────
// LANCER LE DONJON
// ─────────────────────────────────────────
function startDungeon() {
  if (DungeonSystem.inDungeon) return;

  // Collecter les joueurs prêts
  const readySessions = [];
  if (DungeonSystem.readyPlayers.has('me')) {
    readySessions.push(window.multiState?.sessionId || 'local');
  }
  for (const sid of DungeonSystem.readyPlayers) {
    if (sid !== 'me') readySessions.push(sid);
  }

  if (readySessions.length === 0) {
    if (typeof addLog === 'function') addLog('Personne n\'est prêt pour le donjon !', 'normal');
    return;
  }

  // Notifier tous les joueurs prêts via WS
  if (window.multiState?.active) {
    wsSend('dungeon_start', { readySessions });
  }

  // Téléporter le joueur local dans le donjon
  enterDungeonZone();
}

// ─────────────────────────────────────────
// ENTRER DANS LA ZONE DONJON
// ─────────────────────────────────────────
function enterDungeonZone() {
  if (DungeonSystem.inDungeon) return;
  DungeonSystem.inDungeon = true;

  // Sauvegarder position overworld
  DungeonSystem.savedX = state.player.gridX;
  DungeonSystem.savedY = state.player.gridY;

  // Téléporter au centre de la zone donjon
  state.player.gridX = 7;
  state.player.gridY = 7;
  state.player.path = [];
  state.player.moving = false;
  state.player.location = 'dungeon';

  // Zone donjon : terrain vide (toutes les cases walkables)
  DungeonSystem.savedTerrain = state.terrain;
  DungeonSystem.savedEnemies = state.enemies;
  state.terrain = generateDungeonTerrain();
  state.enemies = [];

  if (typeof addLog === 'function') addLog('⚿ Vous entrez dans le donjon...', 'action');
  if (typeof AudioEngine !== 'undefined') AudioEngine.playMusic?.('dungeon');

  // Mettre à jour le panel donjon
  refreshDungeonReadyPanel();

  // Broadcaster la position
  if (window.multiState?.active && multiState.broadcastMove) {
    multiState.broadcastMove(state.player.gridX, state.player.gridY);
    wsSend('move', { x: state.player.gridX, y: state.player.gridY, location: 'dungeon' });
  }

  if (typeof spawnFloater === 'function') {
    spawnFloater(state.player.gridX, state.player.gridY, '⚿ DONJON', '#9b4dca', 16);
  }
}

// ─────────────────────────────────────────
// QUITTER LE DONJON
// ─────────────────────────────────────────
function exitDungeonZone() {
  if (!DungeonSystem.inDungeon) return;
  DungeonSystem.inDungeon = false;
  DungeonSystem.readyPlayers.clear();

  // Restaurer overworld
  state.player.gridX = DungeonSystem.savedX || 7;
  state.player.gridY = DungeonSystem.savedY || 7;
  state.player.path = [];
  state.player.moving = false;
  state.player.location = 'overworld';
  state.terrain = DungeonSystem.savedTerrain || generateTerrain();
  state.enemies = DungeonSystem.savedEnemies || [];

  if (typeof addLog === 'function') addLog('Vous quittez le donjon.', 'normal');
  if (typeof AudioEngine !== 'undefined') AudioEngine.playMusic?.('overworld');

  // Reset bouton ready
  const btn = document.getElementById('btn-ready-dungeon');
  if (btn) { btn.textContent = '◎ Prêt pour le donjon'; btn.style.background = 'rgba(155,77,202,0.15)'; btn.style.borderColor = 'rgba(155,77,202,0.5)'; btn.style.color = '#c8a96e'; }

  refreshDungeonReadyPanel();

  if (window.multiState?.active) {
    wsSend('move', { x: state.player.gridX, y: state.player.gridY, location: 'overworld' });
  }
}

// ─────────────────────────────────────────
// TERRAIN DONJON (zone vide sombre)
// ─────────────────────────────────────────
function generateDungeonTerrain() {
  const terrain = {};
  // Tout walkable sauf bordures
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1) {
        terrain[`${x},${y}`] = 'blocked';
      }
      // Quelques murs intérieurs pour donner du relief
      if ((x === 3 && y >= 3 && y <= 5) ||
          (x === 5 && y >= 9 && y <= 11) ||
          (x === 11 && y >= 3 && y <= 5) ||
          (x === 9 && y >= 9 && y <= 11) ||
          (x === 7 && y === 3)) {
        terrain[`${x},${y}`] = 'blocked';
      }
    }
  }
  return terrain;
}

// ─────────────────────────────────────────
// UI PANEL DONJON
// ─────────────────────────────────────────
function refreshDungeonReadyPanel() {
  const panel = document.getElementById('dungeon-ready-panel');
  if (!panel) return;

  // Afficher le panel seulement en multijoueur
  if (!window.multiState?.active) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  const list = document.getElementById('dungeon-ready-list');
  if (!list) return;

  // Construire la liste des joueurs prêts
  const readyItems = [];

  // Moi
  const myName = typeof getMyName === 'function' ? getMyName() : 'Vous';
  const meReady = DungeonSystem.readyPlayers.has('me');
  readyItems.push(`<div style="font-family:'Cinzel',serif;font-size:10px;color:${meReady ? '#2ecc71' : '#6a5030'};padding:2px 0;">
    ${meReady ? '✓' : '◎'} ${myName} (vous)
  </div>`);

  // Autres joueurs
  for (const [sid, rp] of Object.entries(window.multiState?.remotePlayers || {})) {
    const isReady = DungeonSystem.readyPlayers.has(sid);
    const name = rp.name || sid.slice(0, 6);
    readyItems.push(`<div style="font-family:'Cinzel',serif;font-size:10px;color:${isReady ? '#2ecc71' : '#6a5030'};padding:2px 0;">
      ${isReady ? '✓' : '◎'} ${name}
    </div>`);
  }

  list.innerHTML = readyItems.join('');

  // Si en donjon : afficher bouton sortie
  const startBtn = document.getElementById('btn-start-dungeon');
  const readyBtn = document.getElementById('btn-ready-dungeon');
  if (DungeonSystem.inDungeon) {
    if (startBtn) { startBtn.textContent = '🚪 Quitter le donjon'; startBtn.onclick = exitDungeonZone; }
    if (readyBtn) readyBtn.style.display = 'none';
  } else {
    if (startBtn) { startBtn.textContent = '⚿ LANCER LE DONJON'; startBtn.onclick = startDungeon; }
    if (readyBtn) readyBtn.style.display = 'block';
  }
}

// ─────────────────────────────────────────
// MESSAGES WS ENTRANTS (donjon)
// ─────────────────────────────────────────
function onDungeonMessage(msg) {
  const { type } = msg;

  if (type === 'dungeon_ready') {
    // Un joueur distant signale son état ready
    const sid = msg.sessionId;
    if (!sid) return;
    if (msg.ready) {
      DungeonSystem.readyPlayers.add(sid);
      const name = window.multiState?.remotePlayers?.[sid]?.name || sid.slice(0, 6);
      if (typeof addLog === 'function') addLog(`${name} est prêt pour le donjon !`, 'action');
    } else {
      DungeonSystem.readyPlayers.delete(sid);
    }
    refreshDungeonReadyPanel();
  }

  else if (type === 'dungeon_start') {
    // Le donjon est lancé — vérifier si on est dans la liste des joueurs prêts
    const mySessionId = window.multiState?.sessionId;
    if (msg.readySessions?.includes(mySessionId) || DungeonSystem.readyPlayers.has('me')) {
      if (typeof addLog === 'function') addLog('⚿ Le donjon commence ! Téléportation...', 'action');
      enterDungeonZone();
    }
  }

  else if (type === 'dungeon_exit') {
    // Un joueur quitte le donjon
    const sid = msg.sessionId;
    if (sid) DungeonSystem.readyPlayers.delete(sid);
    refreshDungeonReadyPanel();
  }
}