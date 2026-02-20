// ═══════════════════════════════════════════════════════
// VEILBORN — SYSTÈME DE DONJON
// Portail sur la map + système ready + zone donjon
// ═══════════════════════════════════════════════════════

// ─── Position du portail sur la map overworld ─────────
const PORTAL_GX = 8;
const PORTAL_GY = 1;

const DungeonSystem = {
  readyPlayers: new Map(),   // sessionId -> { name, ready }
  inDungeon: false,
  portalOpen: false,         // joueur local est-il sur la case portail
  savedX: 7, savedY: 7,
  savedTerrain: null,
  savedEnemies: null,
};

// ─────────────────────────────────────────────────────────────
// DESSIN DU PORTAIL (appelé depuis drawGrid dans engine.js)
// ─────────────────────────────────────────────────────────────
function drawPortal() {
  if (DungeonSystem.inDungeon) return;
  const iso = gridToIso(PORTAL_GX, PORTAL_GY);
  const cx = iso.x, cy = iso.y + CELL_H / 2 - 4;
  const t = performance.now() / 1000;

  ctx.save();

  // Glow halo au sol
  const glow = ctx.createRadialGradient(cx, cy + 10, 0, cx, cy + 10, 34);
  glow.addColorStop(0, `rgba(120,40,220,${0.25 + 0.12 * Math.sin(t * 2)})`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 38, cy - 10, 76, 60);

  // Ellipse de base (sol du portail)
  ctx.fillStyle = `rgba(60,10,120,${0.5 + 0.15 * Math.sin(t * 2.5)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arc principal
  const pulse = 0.85 + 0.15 * Math.sin(t * 3);
  ctx.strokeStyle = `rgba(180,80,255,${0.8 + 0.2 * Math.sin(t * 4)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 14 * pulse, 22 * pulse, 0, Math.PI, 0);
  ctx.stroke();

  // Arc intérieur (plus lumineux)
  ctx.strokeStyle = `rgba(220,140,255,${0.6 + 0.3 * Math.sin(t * 5 + 1)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 9 * pulse, 16 * pulse, 0, Math.PI, 0);
  ctx.stroke();

  // Particules orbitales
  for (let i = 0; i < 5; i++) {
    const angle = t * 2.2 + (i / 5) * Math.PI * 2;
    const px = cx + Math.cos(angle) * 13;
    const py = cy - 8 + Math.sin(angle) * 10 * 0.5;
    const alpha = 0.4 + 0.4 * Math.abs(Math.sin(angle));
    ctx.fillStyle = `rgba(200,120,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Runes clignotantes
  const runeAlpha = 0.35 + 0.25 * Math.sin(t * 1.5);
  ctx.font = '7px serif';
  ctx.fillStyle = `rgba(180,80,255,${runeAlpha})`;
  ctx.textAlign = 'center';
  ctx.fillText('⚿', cx, cy - 26);

  // Label "DONJON" au survol
  if (state.hoveredCell?.gx === PORTAL_GX && state.hoveredCell?.gy === PORTAL_GY) {
    ctx.font = 'bold 9px "Cinzel",serif';
    ctx.fillStyle = 'rgba(220,170,255,0.95)';
    ctx.fillText('DONJON', cx, cy - 36);
  }

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// DÉTECTION — joueur entre/sort du portail (appelé chaque frame)
// ─────────────────────────────────────────────────────────────
function checkPortalStep() {
  if (DungeonSystem.inDungeon) return;
  if (!state.selectedClass) return;
  const onPortal = state.player.gridX === PORTAL_GX && state.player.gridY === PORTAL_GY;

  if (onPortal && !DungeonSystem.portalOpen) {
    DungeonSystem.portalOpen = true;
    openPortalModal();
    // Notifier les autres joueurs en multi
    if (window.multiState?.active) {
      wsSend('dungeon_at_portal', { name: typeof getMyName === 'function' ? getMyName() : 'Joueur' });
    }
  } else if (!onPortal && DungeonSystem.portalOpen) {
    DungeonSystem.portalOpen = false;
    closePortalModal();
    // Notifier les autres qu'on quitte le portail
    if (window.multiState?.active) {
      wsSend('dungeon_left_portal', {});
    }
    // Effacer les notifs ready pour les autres
    clearRemoteReadyNotifs();
  }
}

// ─────────────────────────────────────────────────────────────
// MODAL PORTAIL (pour le joueur sur la case)
// ─────────────────────────────────────────────────────────────
function openPortalModal() {
  if (typeof AudioEngine !== 'undefined') AudioEngine.play?.trade?.();
  // Réinitialiser la liste des prêts localement
  DungeonSystem.readyPlayers.clear();

  let modal = document.getElementById('portal-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'portal-modal';
    modal.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 500;
      background: rgba(8,3,18,0.97);
      border: 2px solid rgba(155,77,202,0.8);
      border-radius: 10px;
      padding: 0;
      min-width: 340px;
      max-width: 400px;
      box-shadow: 0 0 40px rgba(120,40,220,0.5), 0 0 80px rgba(100,20,180,0.2);
      font-family: 'Cinzel', serif;
    `;
    document.body.appendChild(modal);
  }

  refreshPortalModal();
  modal.style.display = 'block';

  if (typeof addLog === 'function') addLog('⚿ Vous êtes au portail du donjon.', 'action');
}

function closePortalModal() {
  const modal = document.getElementById('portal-modal');
  if (modal) modal.style.display = 'none';
}

function refreshPortalModal() {
  const modal = document.getElementById('portal-modal');
  if (!modal || modal.style.display === 'none') return;

  const myName = typeof getMyName === 'function' ? getMyName() : 'Vous';
  const isMulti = window.multiState?.active;

  // Construire la liste des joueurs
  let playerRows = '';

  // Joueur local — toujours "prêt" s'il est sur le portail (il est le lanceur)
  playerRows += `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(155,77,202,0.15);">
      <span style="color:#d4af37;font-size:14px;">⚿</span>
      <span style="color:#d4af37;font-size:11px;flex:1;">${myName} <span style="color:#9b4dca;font-size:9px;">(vous)</span></span>
      <span style="color:#d4af37;font-size:10px;">Au portail</span>
    </div>`;

  // Joueurs distants
  if (isMulti) {
    for (const [sid, rp] of Object.entries(window.multiState.remotePlayers || {})) {
      const ready = DungeonSystem.readyPlayers.get(sid);
      const name = rp.name || sid.slice(0, 6);
      const readyColor = ready === true ? '#2ecc71' : ready === false ? '#e74c3c' : '#6a5030';
      const readyText = ready === true ? '✓ Prêt' : ready === false ? '✗ Non prêt' : '⋯ En attente';
      const readyIcon = ready === true ? '✓' : ready === false ? '✗' : '◎';
      playerRows += `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(155,77,202,0.1);">
          <span style="color:${readyColor};font-size:13px;">${readyIcon}</span>
          <span style="color:#c8a96e;font-size:11px;flex:1;">${name}</span>
          <span style="color:${readyColor};font-size:10px;">${readyText}</span>
        </div>`;
    }
  }

  const hasPlayers = isMulti && Object.keys(window.multiState.remotePlayers || {}).length > 0;
  const readyCount = Array.from(DungeonSystem.readyPlayers.values()).filter(v => v === true).length;
  const totalRemote = isMulti ? Object.keys(window.multiState.remotePlayers || {}).length : 0;

  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(80,20,160,0.4),rgba(40,5,80,0.6));padding:14px 18px;border-bottom:1px solid rgba(155,77,202,0.3);border-radius:8px 8px 0 0;text-align:center;">
      <div style="font-size:22px;margin-bottom:4px;">⚿</div>
      <div style="color:#d4af37;font-size:13px;letter-spacing:2px;">PORTAIL DU DONJON</div>
      <div style="color:#9b4dca;font-size:9px;margin-top:3px;">Lancez le donjon avec les joueurs prêts</div>
    </div>

    <div style="padding:14px 18px;">
      <div style="color:#6a5030;font-size:9px;letter-spacing:1px;margin-bottom:8px;">JOUEURS</div>
      ${playerRows}
      ${!hasPlayers && !isMulti ? `<div style="color:#3a2010;font-style:italic;font-size:10px;padding:8px 0;">Vous êtes seul. Lancez le donjon en solo.</div>` : ''}
      ${hasPlayers ? `<div style="color:#6a5030;font-size:9px;margin-top:8px;text-align:center;">${readyCount} / ${totalRemote} joueur(s) prêt(s)</div>` : ''}
    </div>

    <div style="padding:10px 18px 14px;display:flex;gap:8px;">
      <button onclick="closePortalModal();state.player.path=[];state.player.moving=false;" style="flex:1;padding:9px;background:rgba(80,20,20,0.3);border:1px solid rgba(200,60,60,0.4);color:#e07070;font-family:'Cinzel',serif;font-size:10px;border-radius:4px;cursor:pointer;">
        ✕ Fermer
      </button>
      <button onclick="startDungeon()" style="flex:2;padding:9px;background:linear-gradient(135deg,rgba(100,30,200,0.5),rgba(60,10,120,0.6));border:1px solid rgba(155,77,202,0.8);color:#d4af37;font-family:'Cinzel',serif;font-size:11px;border-radius:4px;cursor:pointer;font-weight:bold;letter-spacing:1px;">
        ⚿ LANCER LE DONJON
      </button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// NOTIF POUR LES AUTRES JOUEURS (pas sur le portail)
// ─────────────────────────────────────────────────────────────
function showPortalReadyNotif(fromName, fromSessionId) {
  // Supprimer ancienne notif si existante
  const old = document.getElementById('portal-notif');
  if (old) old.remove();

  const notif = document.createElement('div');
  notif.id = 'portal-notif';
  notif.style.cssText = `
    position: fixed;
    top: 60px; right: 14px;
    z-index: 501;
    background: rgba(15,5,30,0.97);
    border: 2px solid rgba(155,77,202,0.7);
    border-radius: 8px;
    padding: 12px 16px;
    color: #d4af37;
    font-family: 'Cinzel', serif;
    min-width: 260px;
    max-width: 300px;
    box-shadow: 0 4px 24px rgba(120,40,220,0.4);
  `;

  notif.innerHTML = `
    <div style="font-size:18px;text-align:center;margin-bottom:6px;">⚿</div>
    <div style="font-size:12px;font-weight:bold;margin-bottom:4px;text-align:center;">Portail du Donjon</div>
    <div style="font-size:11px;color:#aaa;margin-bottom:10px;text-align:center;">${fromName} est au portail.<br>Êtes-vous prêt ?</div>
    <div style="display:flex;gap:6px;">
      <button onclick="respondPortalReady(true,'${fromSessionId}')" style="flex:1;padding:7px;background:rgba(30,120,60,0.4);border:1px solid #27ae60;color:#2ecc71;border-radius:4px;cursor:pointer;font-family:'Cinzel',serif;font-size:10px;font-weight:bold;">
        ✓ Prêt !
      </button>
      <button onclick="respondPortalReady(false,'${fromSessionId}')" style="flex:1;padding:7px;background:rgba(120,30,30,0.4);border:1px solid #c0392b;color:#e74c3c;border-radius:4px;cursor:pointer;font-family:'Cinzel',serif;font-size:10px;font-weight:bold;">
        ✗ Non
      </button>
    </div>
  `;

  document.body.appendChild(notif);

  // Auto-disparaît après 60s
  setTimeout(() => { if (notif.parentNode) notif.remove(); }, 60000);

  if (typeof AudioEngine !== 'undefined') AudioEngine.play?.trade?.();
  if (typeof addLog === 'function') addLog(`⚿ ${fromName} est au portail du donjon !`, 'action');
}

function respondPortalReady(ready, portalHolderSessionId) {
  // Supprimer la notif
  const notif = document.getElementById('portal-notif');
  if (notif) notif.remove();

  // Envoyer la réponse
  if (window.multiState?.active) {
    wsSend('dungeon_player_ready', { ready, targetSessionId: portalHolderSessionId });
  }

  if (typeof addLog === 'function') {
    addLog(ready ? '✓ Vous êtes prêt pour le donjon !' : '✗ Vous avez refusé le donjon.', ready ? 'action' : 'normal');
  }
}

function clearRemoteReadyNotifs() {
  const notif = document.getElementById('portal-notif');
  if (notif) notif.remove();
  DungeonSystem.readyPlayers.clear();
}

// ─────────────────────────────────────────────────────────────
// LANCER LE DONJON
// ─────────────────────────────────────────────────────────────
function startDungeon() {
  if (DungeonSystem.inDungeon) return;

  // Collecter les joueurs prêts (ceux qui ont répondu oui)
  const readySessions = [];
  // Le lanceur lui-même est toujours inclus
  if (window.multiState?.sessionId) readySessions.push(window.multiState.sessionId);

  for (const [sid, isReady] of DungeonSystem.readyPlayers.entries()) {
    if (isReady) readySessions.push(sid);
  }

  // Notifier tous les prêts
  if (window.multiState?.active) {
    wsSend('dungeon_start', { readySessions });
  }

  closePortalModal();

  if (typeof addLog === 'function') {
    addLog(`⚿ Donjon lancé ! ${readySessions.length} joueur(s) téléporté(s).`, 'action');
  }

  enterDungeonZone();
}

// ─────────────────────────────────────────────────────────────
// ENTRER / QUITTER LA ZONE DONJON
// ─────────────────────────────────────────────────────────────
function enterDungeonZone() {
  if (DungeonSystem.inDungeon) return;
  DungeonSystem.inDungeon = true;
  DungeonSystem.portalOpen = false;
  DungeonSystem.readyPlayers.clear();
  closePortalModal();

  // Sauvegarder état overworld
  DungeonSystem.savedX = state.player.gridX;
  DungeonSystem.savedY = state.player.gridY;
  DungeonSystem.savedTerrain = state.terrain;
  DungeonSystem.savedEnemies = [...state.enemies];

  // Téléporter au spawn du donjon
  state.player.gridX = 7;
  state.player.gridY = 13;
  state.player.path = [];
  state.player.moving = false;
  state.player.location = 'dungeon';

  // Terrain donjon
  state.terrain = generateDungeonTerrain();
  state.enemies = [];

  // VFX + audio
  if (typeof spawnFloater === 'function') spawnFloater(state.player.gridX, state.player.gridY, '⚿ DONJON', '#9b4dca', 18);
  if (typeof AudioEngine !== 'undefined' && AudioEngine.playMusic) AudioEngine.playMusic('dungeon');

  // Broadcast position dans la zone donjon
  if (window.multiState?.active) {
    wsSend('move', { x: state.player.gridX, y: state.player.gridY, location: 'dungeon' });
  }

  if (typeof addLog === 'function') addLog('⚿ Bienvenue dans le donjon ! (F pour quitter)', 'action');
}

function exitDungeonZone() {
  if (!DungeonSystem.inDungeon) return;
  DungeonSystem.inDungeon = false;

  // Restaurer overworld
  state.player.gridX = PORTAL_GX;
  state.player.gridY = PORTAL_GY + 1; // Juste devant le portail
  state.player.path = [];
  state.player.moving = false;
  state.player.location = 'overworld';
  state.terrain = DungeonSystem.savedTerrain || generateTerrain();
  state.enemies = DungeonSystem.savedEnemies || [];

  if (typeof AudioEngine !== 'undefined' && AudioEngine.playMusic) AudioEngine.playMusic('overworld');
  if (typeof addLog === 'function') addLog('Vous quittez le donjon.', 'normal');

  // Broadcast
  if (window.multiState?.active) {
    wsSend('move', { x: state.player.gridX, y: state.player.gridY, location: 'overworld' });
    wsSend('dungeon_exit', {});
  }
}

// ─────────────────────────────────────────────────────────────
// TERRAIN DONJON
// ─────────────────────────────────────────────────────────────
function generateDungeonTerrain() {
  const t = {};
  // Murs extérieurs
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1) {
        t[`${x},${y}`] = 'blocked';
      }
    }
  }
  // Murs intérieurs — couloirs style donjon
  const walls = [
    [3,3],[4,3],[3,4],
    [11,3],[12,3],[12,4],
    [3,11],[3,12],[4,12],
    [11,11],[12,11],[12,12],
    [6,6],[6,7],[7,6],
    [8,8],[9,8],[8,9],
    [5,9],[4,8],
    [10,5],[11,5],
  ];
  walls.forEach(([x,y]) => { t[`${x},${y}`] = 'blocked'; });

  // Quelques zones voile au sol
  [[7,7],[8,7],[7,8]].forEach(([x,y]) => { t[`${x},${y}`] = 'veil'; });

  return t;
}

// ─────────────────────────────────────────────────────────────
// MESSAGES WS ENTRANTS
// ─────────────────────────────────────────────────────────────
function onDungeonMessage(msg) {
  const { type } = msg;

  // Quelqu'un est arrivé au portail
  if (type === 'dungeon_at_portal') {
    if (!DungeonSystem.inDungeon) {
      showPortalReadyNotif(msg.name || 'Joueur', msg.sessionId);
    }
  }

  // Quelqu'un quitte le portail sans lancer
  else if (type === 'dungeon_left_portal') {
    clearRemoteReadyNotifs();
    if (typeof addLog === 'function') addLog('Le joueur a quitté le portail.', 'normal');
  }

  // Un joueur répond à l'invitation ready (reçu par le joueur au portail)
  else if (type === 'dungeon_player_ready') {
    const sid = msg.sessionId;
    if (!sid) return;
    const name = window.multiState?.remotePlayers?.[sid]?.name || sid.slice(0, 6);
    DungeonSystem.readyPlayers.set(sid, msg.ready);
    if (typeof addLog === 'function') {
      addLog(`${name} ${msg.ready ? '✓ est prêt' : '✗ n\'est pas prêt'} pour le donjon.`, msg.ready ? 'action' : 'normal');
    }
    refreshPortalModal(); // Mettre à jour le modal si on est dessus
  }

  // Le donjon est lancé — vérifier si on est dans la liste
  else if (type === 'dungeon_start') {
    const mySessionId = window.multiState?.sessionId;
    if (msg.readySessions?.includes(mySessionId)) {
      clearRemoteReadyNotifs();
      if (typeof addLog === 'function') addLog('⚿ Le donjon commence ! Téléportation...', 'action');
      enterDungeonZone();
    } else {
      const notif = document.getElementById('portal-notif');
      if (notif) notif.remove();
      if (typeof addLog === 'function') addLog('Le donjon a été lancé sans vous.', 'normal');
    }
  }

  // Un joueur sort du donjon
  else if (type === 'dungeon_exit') {
    // Rien de spécial côté client pour l'instant
  }
}