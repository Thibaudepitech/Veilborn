// ═══════════════════════════════════════════════════════════════════
// VEILBORN — SYSTÈME DE DONJON
// ═══════════════════════════════════════════════════════════════════

const PORTAL_GX = 8;
const PORTAL_GY = 1;

const DungeonSystem = {
  inDungeon: false,
  portalOpen: false,
  leaderSessionId: null,   // 'me' | sessionId | null
  leaderName: null,
  remoteReady: new Map(),  // sessionId -> bool (réponses hors-portail)
  savedX: 8, savedY: 2,
  savedTerrain: null,
  savedEnemies: null,
};

// ── Qui est sur la case portail en ce moment ? ──────────────
// On scanne en temps réel : local + remotePlayers
function getPlayersAtPortal() {
  const list = []; // [{id:'me'|sessionId, name, isMe}]
  if (DungeonSystem.inDungeon) return list;

  // Joueur local
  if (state.selectedClass && state.player.gridX === PORTAL_GX && state.player.gridY === PORTAL_GY) {
    list.push({ id: 'me', name: _getLocalName(), isMe: true });
  }

  // Joueurs distants
  if (window.multiState && window.multiState.active) {
    for (const [sid, rp] of Object.entries(window.multiState.remotePlayers || {})) {
      if (rp.x === PORTAL_GX && rp.y === PORTAL_GY && (rp.location || 'overworld') === 'overworld') {
        list.push({ id: sid, name: rp.name || ('Joueur-' + sid.slice(0,4)), isMe: false });
      }
    }
  }
  return list;
}

function _getLocalName() {
  if (window._myPlayerName) return window._myPlayerName;
  const input = document.getElementById('multi-name-input');
  if (input && input.value.trim()) return input.value.trim();
  return 'Moi';
}

// ─────────────────────────────────────────────────────────────
// DESSIN DU PORTAIL
// ─────────────────────────────────────────────────────────────
function drawPortal() {
  if (DungeonSystem.inDungeon) return;
  const iso = gridToIso(PORTAL_GX, PORTAL_GY);
  const cx = iso.x, cy = iso.y + CELL_H / 2 - 4;
  const t = performance.now() / 1000;
  ctx.save();

  // Glow sol
  const glow = ctx.createRadialGradient(cx, cy + 10, 0, cx, cy + 10, 36);
  glow.addColorStop(0, 'rgba(120,40,220,' + (0.28 + 0.12 * Math.sin(t * 2)) + ')');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 42, cy - 12, 84, 62);

  // Sol
  ctx.fillStyle = 'rgba(60,10,120,' + (0.5 + 0.15 * Math.sin(t * 2.5)) + ')';
  ctx.beginPath(); ctx.ellipse(cx, cy + 12, 18, 7, 0, 0, Math.PI * 2); ctx.fill();

  // Arc principal
  const pulse = 0.85 + 0.15 * Math.sin(t * 3);
  ctx.strokeStyle = 'rgba(180,80,255,' + (0.8 + 0.2 * Math.sin(t * 4)) + ')';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, cy - 8, 14 * pulse, 22 * pulse, 0, Math.PI, 0); ctx.stroke();

  ctx.strokeStyle = 'rgba(220,140,255,' + (0.6 + 0.3 * Math.sin(t * 5 + 1)) + ')';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy - 8, 9 * pulse, 16 * pulse, 0, Math.PI, 0); ctx.stroke();

  // Particules
  for (let i = 0; i < 5; i++) {
    const angle = t * 2.2 + (i / 5) * Math.PI * 2;
    ctx.fillStyle = 'rgba(200,120,255,' + (0.4 + 0.4 * Math.abs(Math.sin(angle))) + ')';
    ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * 13, cy - 8 + Math.sin(angle) * 5, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  // Rune
  ctx.font = '7px serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(180,80,255,' + (0.35 + 0.25 * Math.sin(t * 1.5)) + ')';
  ctx.fillText('⚿', cx, cy - 26);

  // Compteur de joueurs
  const atCount = getPlayersAtPortal().length;
  if (atCount > 0) {
    ctx.font = 'bold 8px "Cinzel",serif';
    ctx.fillStyle = 'rgba(212,175,55,0.9)';
    ctx.fillText(atCount + ' ici', cx, cy - 37);
  }

  if (state.hoveredCell && state.hoveredCell.gx === PORTAL_GX && state.hoveredCell.gy === PORTAL_GY) {
    ctx.font = 'bold 9px "Cinzel",serif';
    ctx.fillStyle = 'rgba(220,170,255,0.95)';
    ctx.fillText('ENTRER AU DONJON', cx, cy - (atCount > 0 ? 48 : 37));
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// DÉTECTION — joueur marche sur/quitte le portail
// Appelé toutes les 10 frames depuis gameLoop
// ─────────────────────────────────────────────────────────────
function checkPortalStep() {
  if (DungeonSystem.inDungeon) return;
  if (!state.selectedClass) return;

  const onPortal = state.player.gridX === PORTAL_GX && state.player.gridY === PORTAL_GY;

  if (onPortal && !DungeonSystem.portalOpen) {
    // ─── On vient d'arriver sur le portail ───
    DungeonSystem.portalOpen = true;

    const myName = _getLocalName();

    if (window.multiState && window.multiState.active) {
      // Informer le serveur → il broadcastera avec leaderSessionId
      wsSend('dungeon_at_portal', { name: myName });
    } else {
      // Solo : chef direct
      DungeonSystem.leaderSessionId = 'me';
      DungeonSystem.leaderName = myName;
    }

    openPortalModal();
    if (typeof addLog === 'function') addLog('⚿ Portail du donjon.', 'action');

  } else if (!onPortal && DungeonSystem.portalOpen) {
    // ─── On vient de quitter le portail ───
    DungeonSystem.portalOpen = false;

    if (window.multiState && window.multiState.active) {
      wsSend('dungeon_left_portal', {});
    }

    // Si on était chef, reset (le serveur va notifier le nouveau chef)
    if (DungeonSystem.leaderSessionId === 'me') {
      DungeonSystem.leaderSessionId = null;
      DungeonSystem.leaderName = null;
    }

    closePortalModal();
    clearPortalNotif();
  }

  // Rafraîchir le modal si ouvert (pour détecter les arrivées/départs par position)
  if (DungeonSystem.portalOpen) {
    refreshPortalModal();
  }
}

// ─────────────────────────────────────────────────────────────
// MODAL PORTAIL
// ─────────────────────────────────────────────────────────────
function openPortalModal() {
  if (typeof AudioEngine !== 'undefined' && AudioEngine.play && AudioEngine.play.trade) {
    AudioEngine.play.trade();
  }
  let modal = document.getElementById('portal-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'portal-modal';
    modal.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
      'z-index:500', 'background:rgba(8,3,18,0.97)',
      'border:2px solid rgba(155,77,202,0.8)', 'border-radius:10px',
      'padding:0', 'min-width:360px', 'max-width:420px',
      'box-shadow:0 0 40px rgba(120,40,220,0.5),0 0 80px rgba(100,20,180,0.2)',
      'font-family:Cinzel,serif'
    ].join(';');
    document.body.appendChild(modal);
  }
  modal.style.display = 'block';
  refreshPortalModal();
}

function closePortalModal() {
  const modal = document.getElementById('portal-modal');
  if (modal) modal.style.display = 'none';
}

function refreshPortalModal() {
  const modal = document.getElementById('portal-modal');
  if (!modal || modal.style.display === 'none') return;

  const myName = _getLocalName();
  const isMulti = window.multiState && window.multiState.active;
  const mySessionId = isMulti ? window.multiState.sessionId : null;

  // Scan temps réel qui est au portail
  const atPortal = getPlayersAtPortal();

  // Déterminer le chef : leaderSessionId défini par le serveur, sinon 1er de la liste
  let effectiveLeaderIsMe = false;
  if (DungeonSystem.leaderSessionId === 'me') {
    effectiveLeaderIsMe = true;
  } else if (!DungeonSystem.leaderSessionId && atPortal.length > 0 && atPortal[0].isMe) {
    // Pas encore de réponse serveur mais on est le 1er → on s'affiche chef
    effectiveLeaderIsMe = true;
  }

  // ── Rows AU portail ────────────────────────────────────────
  let atRows = '';
  for (const p of atPortal) {
    const isChef = p.isMe ? effectiveLeaderIsMe : (p.id === DungeonSystem.leaderSessionId);
    atRows +=
      '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(155,77,202,0.12);">' +
        '<span style="font-size:15px;color:#2ecc71;">⚿</span>' +
        '<span style="flex:1;font-size:11px;color:' + (p.isMe ? '#d4af37' : '#c8a96e') + ';">' +
          p.name +
          (isChef ? '&nbsp;<span style="color:#9b4dca;font-size:9px;">⭐ chef</span>' : '') +
        '</span>' +
        '<span style="font-size:10px;color:#2ecc71;">✓ Au portail</span>' +
      '</div>';
  }

  // ── Rows HORS portail ──────────────────────────────────────
  let offRows = '';
  if (isMulti) {
    for (const [sid, rp] of Object.entries(window.multiState.remotePlayers || {})) {
      // Ignorer si déjà compté dans atPortal
      const alreadyAt = atPortal.some(p => p.id === sid);
      if (alreadyAt) continue;

      const rpName = rp.name || ('Joueur-' + sid.slice(0,4));
      const ready = DungeonSystem.remoteReady.get(sid);
      const color = ready === true ? '#2ecc71' : ready === false ? '#e74c3c' : '#6a5030';
      const icon  = ready === true ? '✓' : ready === false ? '✗' : '◎';
      const label = ready === true ? 'Prêt' : ready === false ? 'Pas prêt' : 'En attente…';

      offRows +=
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(155,77,202,0.07);">' +
          '<span style="font-size:13px;color:' + color + ';">' + icon + '</span>' +
          '<span style="flex:1;font-size:11px;color:#c8a96e;">' + rpName + '</span>' +
          '<span style="font-size:10px;color:' + color + ';">' + label + '</span>' +
        '</div>';
    }
  }

  const totalTP = atPortal.length + Array.from(DungeonSystem.remoteReady.values()).filter(v => v === true).length;

  // Sous-titre
  const subtitle = effectiveLeaderIsMe
    ? '<span style="color:#d4af37;font-size:9px;">Chef d\'expédition — vous contrôlez le lancement</span>'
    : (DungeonSystem.leaderName
        ? '<span style="color:#9b4dca;font-size:9px;">Chef : ' + DungeonSystem.leaderName + ' · vue lecture seule</span>'
        : '<span style="color:#6a5030;font-size:9px;">⏳ Synchronisation…</span>');

  const launchBtn = effectiveLeaderIsMe
    ? '<button onclick="startDungeon()" style="flex:2;padding:9px;background:linear-gradient(135deg,rgba(100,30,200,0.5),rgba(60,10,120,0.6));border:1px solid rgba(155,77,202,0.8);color:#d4af37;font-size:11px;border-radius:4px;cursor:pointer;font-weight:bold;letter-spacing:1px;">⚿ LANCER LE DONJON</button>'
    : '<div style="flex:2;padding:9px;background:rgba(40,10,80,0.2);border:1px solid rgba(155,77,202,0.3);color:#6a5030;font-size:10px;border-radius:4px;text-align:center;display:flex;align-items:center;justify-content:center;">⏳ Attente du chef…</div>';

  modal.innerHTML =
    // Header
    '<div style="background:linear-gradient(135deg,rgba(80,20,160,0.4),rgba(40,5,80,0.6));padding:14px 18px;border-bottom:1px solid rgba(155,77,202,0.3);border-radius:8px 8px 0 0;text-align:center;">' +
      '<div style="font-size:22px;margin-bottom:4px;">⚿</div>' +
      '<div style="color:#d4af37;font-size:13px;letter-spacing:2px;margin-bottom:3px;">PORTAIL DU DONJON</div>' +
      subtitle +
    '</div>' +
    // Corps
    '<div style="padding:14px 18px;max-height:260px;overflow-y:auto;">' +
      (atRows
        ? '<div style="color:#6a5030;font-size:8px;letter-spacing:1px;margin-bottom:6px;">⚿ AU PORTAIL — INCLUS AUTOMATIQUEMENT</div>' + atRows
        : '') +
      (offRows
        ? '<div style="color:#6a5030;font-size:8px;letter-spacing:1px;margin:10px 0 6px;">AUTRES JOUEURS</div>' + offRows
        : '') +
      (!isMulti
        ? '<div style="color:#3a2010;font-style:italic;font-size:10px;padding:8px 0;text-align:center;">Mode solo — entrez seul dans le donjon.</div>'
        : '') +
    '</div>' +
    // Footer
    '<div style="padding:6px 18px;text-align:center;color:#6a5030;font-size:9px;border-top:1px solid rgba(155,77,202,0.15);">' +
      totalTP + ' joueur(s) seront téléporté(s)' +
    '</div>' +
    '<div style="padding:10px 18px 14px;display:flex;gap:8px;">' +
      '<button onclick="leavePortalManually()" style="flex:1;padding:9px;background:rgba(80,20,20,0.3);border:1px solid rgba(200,60,60,0.4);color:#e07070;font-size:10px;border-radius:4px;cursor:pointer;">✕ Quitter le portail</button>' +
      launchBtn +
    '</div>';
}

function leavePortalManually() {
  state.player.path = [];
  state.player.moving = false;
  const nx = PORTAL_GX, ny = PORTAL_GY + 1;
  if (!state.terrain[nx + ',' + ny]) {
    state.player.gridX = nx;
    state.player.gridY = ny;
    const iso = gridToIso(nx, ny);
    state.player.px = iso.x;
    state.player.py = iso.y + CELL_H / 2;
  }
}

// ─────────────────────────────────────────────────────────────
// NOTIF POUR LES JOUEURS HORS PORTAIL
// ─────────────────────────────────────────────────────────────
function showPortalNotifForOthers(leaderName, leaderSessionId) {
  const old = document.getElementById('portal-notif');
  if (old) old.remove();

  const notif = document.createElement('div');
  notif.id = 'portal-notif';
  notif.style.cssText = 'position:fixed;top:60px;right:14px;z-index:501;background:rgba(12,4,24,0.97);border:2px solid rgba(155,77,202,0.7);border-radius:8px;padding:14px 16px;color:#d4af37;font-family:Cinzel,serif;min-width:270px;max-width:310px;box-shadow:0 4px 28px rgba(120,40,220,0.45);';
  notif.innerHTML =
    '<div style="font-size:20px;text-align:center;margin-bottom:6px;">⚿</div>' +
    '<div style="font-size:12px;font-weight:bold;margin-bottom:4px;text-align:center;">Portail du Donjon</div>' +
    '<div style="font-size:11px;color:#aaa;text-align:center;margin-bottom:4px;"><b style="color:#c8a96e;">' + leaderName + '</b> est au portail<br>et peut lancer le donjon.</div>' +
    '<div style="font-size:10px;color:#9b4dca;text-align:center;margin-bottom:10px;">Marchez sur le portail pour être inclus automatiquement.</div>' +
    '<div style="display:flex;gap:6px;">' +
      '<button onclick="respondPortalReady(true,\'' + leaderSessionId + '\')" style="flex:1;padding:7px;background:rgba(30,120,60,0.4);border:1px solid #27ae60;color:#2ecc71;border-radius:4px;cursor:pointer;font-size:10px;font-weight:bold;">✓ Prêt !</button>' +
      '<button onclick="respondPortalReady(false,\'' + leaderSessionId + '\')" style="flex:1;padding:7px;background:rgba(120,30,30,0.4);border:1px solid #c0392b;color:#e74c3c;border-radius:4px;cursor:pointer;font-size:10px;font-weight:bold;">✗ Non</button>' +
      '<button onclick="this.closest(\'#portal-notif\').remove()" style="padding:7px 9px;background:rgba(40,20,60,0.4);border:1px solid rgba(155,77,202,0.4);color:#6a5030;border-radius:4px;cursor:pointer;font-size:10px;">✕</button>' +
    '</div>';
  document.body.appendChild(notif);
  setTimeout(() => { if (notif.parentNode) notif.remove(); }, 90000);

  if (typeof AudioEngine !== 'undefined' && AudioEngine.play && AudioEngine.play.trade) AudioEngine.play.trade();
  if (typeof addLog === 'function') addLog('⚿ ' + leaderName + ' est au portail du donjon !', 'action');
}

function respondPortalReady(ready, leaderSessionId) {
  document.getElementById('portal-notif')?.remove();
  if (window.multiState && window.multiState.active) {
    wsSend('dungeon_player_ready', { ready, targetSessionId: leaderSessionId });
  }
  if (typeof addLog === 'function') addLog(ready ? '✓ Réponse : Prêt !' : '✗ Réponse : Non prêt.', ready ? 'action' : 'normal');
}

function clearPortalNotif() {
  document.getElementById('portal-notif')?.remove();
}

// ─────────────────────────────────────────────────────────────
// LANCER LE DONJON
// ─────────────────────────────────────────────────────────────
function startDungeon() {
  if (DungeonSystem.inDungeon) return;

  // Vérifier qu'on est bien chef
  const atPortal = getPlayersAtPortal();
  const iAmLeader = DungeonSystem.leaderSessionId === 'me' ||
    (!DungeonSystem.leaderSessionId && atPortal.length > 0 && atPortal[0].isMe);
  if (!iAmLeader) return;

  // Construire la liste : tous au portail + réponses "prêt" hors portail
  const readySessions = [];
  if (window.multiState && window.multiState.sessionId) readySessions.push(window.multiState.sessionId);
  for (const p of atPortal) {
    if (!p.isMe) readySessions.push(p.id);
  }
  for (const [sid, isReady] of DungeonSystem.remoteReady.entries()) {
    if (isReady && !readySessions.includes(sid)) readySessions.push(sid);
  }

  if (window.multiState && window.multiState.active) {
    wsSend('dungeon_start', { readySessions });
  }

  closePortalModal();
  clearPortalNotif();
  if (typeof addLog === 'function') addLog('⚿ Donjon lancé ! ' + readySessions.length + ' joueur(s) téléporté(s).', 'action');
  enterDungeonZone();
}

// ─────────────────────────────────────────────────────────────
// ENTRER / QUITTER LE DONJON
// ─────────────────────────────────────────────────────────────
function enterDungeonZone() {
  if (DungeonSystem.inDungeon) return;
  DungeonSystem.inDungeon = true;
  DungeonSystem.portalOpen = false;
  DungeonSystem.leaderSessionId = null;
  DungeonSystem.leaderName = null;
  DungeonSystem.remoteReady.clear();
  closePortalModal();
  clearPortalNotif();

  DungeonSystem.savedX = state.player.gridX;
  DungeonSystem.savedY = state.player.gridY;
  DungeonSystem.savedTerrain = state.terrain;
  DungeonSystem.savedEnemies = state.enemies.slice();

  state.player.gridX = 7; state.player.gridY = 13;
  state.player.path = []; state.player.moving = false;
  state.player.location = 'dungeon';
  state.terrain = generateDungeonTerrain();
  state.enemies = [];

  if (typeof spawnFloater === 'function') spawnFloater(7, 13, '⚿ DONJON', '#9b4dca', 18);
  if (typeof AudioEngine !== 'undefined' && AudioEngine.playMusic) AudioEngine.playMusic('dungeon');
  if (window.multiState && window.multiState.active) wsSend('move', { x: 7, y: 13, location: 'dungeon' });
  if (typeof addLog === 'function') addLog('⚿ Bienvenue dans le donjon ! (F pour quitter)', 'action');
}

function exitDungeonZone() {
  if (!DungeonSystem.inDungeon) return;
  DungeonSystem.inDungeon = false;
  state.player.gridX = PORTAL_GX;
  state.player.gridY = PORTAL_GY + 1;
  state.player.path = []; state.player.moving = false;
  state.player.location = 'overworld';
  state.terrain = DungeonSystem.savedTerrain || (typeof generateTerrain === 'function' ? generateTerrain() : {});
  state.enemies = DungeonSystem.savedEnemies || [];
  if (typeof AudioEngine !== 'undefined' && AudioEngine.playMusic) AudioEngine.playMusic('overworld');
  if (typeof addLog === 'function') addLog('Vous quittez le donjon.', 'normal');
  if (window.multiState && window.multiState.active) {
    wsSend('move', { x: state.player.gridX, y: state.player.gridY, location: 'overworld' });
    wsSend('dungeon_exit', {});
  }
}

// ─────────────────────────────────────────────────────────────
// TERRAIN DONJON
// ─────────────────────────────────────────────────────────────
function generateDungeonTerrain() {
  const t = {};
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1) t[x+','+y] = 'blocked';
    }
  }
  [[3,3],[4,3],[3,4],[11,3],[12,3],[12,4],[3,11],[3,12],[4,12],[11,11],[12,11],[12,12],
   [6,6],[6,7],[7,6],[8,8],[9,8],[8,9],[5,9],[4,8],[10,5],[11,5]
  ].forEach(([x,y]) => { t[x+','+y] = 'blocked'; });
  [[7,7],[8,7],[7,8]].forEach(([x,y]) => { t[x+','+y] = 'veil'; });
  return t;
}

// ─────────────────────────────────────────────────────────────
// MESSAGES WS ENTRANTS
// ─────────────────────────────────────────────────────────────
function onDungeonMessage(msg) {
  const { type } = msg;

  if (type === 'dungeon_at_portal') {
    if (DungeonSystem.inDungeon) return;
    const sid = msg.sessionId;
    const mySessionId = window.multiState && window.multiState.sessionId;
    const name = msg.name || ('Joueur-' + (sid||'').slice(0,4));
    const serverLeader = msg.leaderSessionId;

    // Mettre à jour le nom du remote player si pas encore connu
    if (sid !== mySessionId && window.multiState && window.multiState.remotePlayers) {
      if (!window.multiState.remotePlayers[sid]) window.multiState.remotePlayers[sid] = {};
      if (name) window.multiState.remotePlayers[sid].name = name;
    }

    // Mettre à jour le chef
    if (serverLeader === mySessionId) {
      DungeonSystem.leaderSessionId = 'me';
      DungeonSystem.leaderName = _getLocalName();
    } else if (serverLeader) {
      DungeonSystem.leaderSessionId = serverLeader;
      const leaderRp = window.multiState && window.multiState.remotePlayers && window.multiState.remotePlayers[serverLeader];
      DungeonSystem.leaderName = (leaderRp && leaderRp.name) || ('Joueur-' + serverLeader.slice(0,4));
    }

    if (DungeonSystem.portalOpen) {
      refreshPortalModal();
    } else if (sid !== mySessionId) {
      // Notifier seulement si c'est le 1er (le chef qui vient d'arriver)
      const atCount = getPlayersAtPortal().filter(p => !p.isMe).length;
      if (atCount <= 1) {
        showPortalNotifForOthers(DungeonSystem.leaderName || name, serverLeader || sid);
      }
    }

    if (sid !== mySessionId && typeof addLog === 'function') {
      addLog('⚿ ' + name + ' arrive au portail.', 'normal');
    }
  }

  else if (type === 'dungeon_left_portal') {
    const sid = msg.sessionId;
    const mySessionId = window.multiState && window.multiState.sessionId;
    const newLeader = msg.leaderSessionId;

    if (newLeader === mySessionId) {
      DungeonSystem.leaderSessionId = 'me';
      DungeonSystem.leaderName = _getLocalName();
      if (DungeonSystem.portalOpen) {
        refreshPortalModal();
        if (typeof addLog === 'function') addLog('⚿ Vous êtes maintenant chef d\'expédition !', 'action');
      }
    } else if (newLeader) {
      DungeonSystem.leaderSessionId = newLeader;
      const rp = window.multiState && window.multiState.remotePlayers && window.multiState.remotePlayers[newLeader];
      DungeonSystem.leaderName = (rp && rp.name) || ('Joueur-' + newLeader.slice(0,4));
    } else {
      DungeonSystem.leaderSessionId = null;
      DungeonSystem.leaderName = null;
      clearPortalNotif();
    }

    if (DungeonSystem.portalOpen) refreshPortalModal();
  }

  else if (type === 'dungeon_promote_leader') {
    if (DungeonSystem.portalOpen) {
      DungeonSystem.leaderSessionId = 'me';
      DungeonSystem.leaderName = _getLocalName();
      refreshPortalModal();
      if (typeof addLog === 'function') addLog('⚿ Vous êtes chef d\'expédition !', 'action');
    }
  }

  else if (type === 'dungeon_player_ready') {
    if (!DungeonSystem.portalOpen) return;
    const sid = msg.sessionId;
    DungeonSystem.remoteReady.set(sid, msg.ready);
    const rp = window.multiState && window.multiState.remotePlayers && window.multiState.remotePlayers[sid];
    const name = (rp && rp.name) || ('Joueur-' + (sid||'').slice(0,4));
    if (typeof addLog === 'function') {
      addLog(name + (msg.ready ? ' ✓ est prêt' : ' ✗ n\'est pas prêt') + ' pour le donjon.', msg.ready ? 'action' : 'normal');
    }
    refreshPortalModal();
  }

  else if (type === 'dungeon_start') {
    const mySessionId = window.multiState && window.multiState.sessionId;
    clearPortalNotif();
    if (msg.readySessions && mySessionId && msg.readySessions.includes(mySessionId)) {
      if (typeof addLog === 'function') addLog('⚿ Le donjon commence ! Téléportation...', 'action');
      enterDungeonZone();
    } else {
      if (typeof addLog === 'function') addLog('Le donjon a été lancé sans vous.', 'normal');
    }
  }
}