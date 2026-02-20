// ═══════════════════════════════════════════════════════
// MULTIPLAYER — WebSocket pur (pas de SDK externe)
// Le serveur est un serveur Node.js/ws.
// Le client utilise l'API WebSocket native du navigateur.
// ═══════════════════════════════════════════════════════

// ─── CONFIG ─────────────────────────────────────────────
// Local  : 'ws://localhost:3000'
// En ligne : 'wss://votre-app.onrender.com'
function getServerUrl() {
  const saved = localStorage.getItem('veilborn_server_url');
  return saved || 'ws://localhost:3000';
}

function setServerUrl(url) {
  localStorage.setItem('veilborn_server_url', url);
}

let SERVER_URL = getServerUrl();

// ─── ÉTAT ───────────────────────────────────────────────
window.multiState = {
  active: false,
  isHost: false,
  remotePlayers: {},   // sessionId -> { x, y, classId, hp, hpMax, name }
  ws: null,
  sessionId: null,
  roomCode: null,
  broadcastClass: null,
  broadcastSkill: null,
  broadcastMove: null,
  broadcastHeal: null,
  broadcastHp: null,
};

// ─── HELPERS ────────────────────────────────────────────
function wsSend(type, data = {}) {
  if (multiState.ws && multiState.ws.readyState === WebSocket.OPEN) {
    multiState.ws.send(JSON.stringify({ type, ...data }));
  }
}

function showJoinStatus(msg, type) {
  const el = document.getElementById('join-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'join-status ' + type;
}

function generateName() {
  return `Joueur-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

// ─── UI CONFIGURATION SERVEUR ────────────────────────────
function testServerConnection() {
  const input = document.getElementById('server-url-input');
  const url = input.value.trim() || 'ws://localhost:3000';
  const statusDiv = document.getElementById('server-status');
  const btn = document.getElementById('btn-test-server');
  
  statusDiv.textContent = '🔄 Test en cours...';
  statusDiv.style.color = '#888';
  btn.disabled = true;
  
  // Créer une WebSocket de test avec timeout
  const testWs = new WebSocket(url);
  const timeout = setTimeout(() => {
    testWs.close();
    statusDiv.textContent = '❌ Timeout - serveur inaccessible';
    statusDiv.style.color = '#ff6b6b';
    btn.disabled = false;
  }, 3000);
  
  testWs.onopen = () => {
    clearTimeout(timeout);
    testWs.close();
    statusDiv.textContent = '✅ Serveur accessible';
    statusDiv.style.color = '#51cf66';
    btn.disabled = false;
  };
  
  testWs.onerror = () => {
    clearTimeout(timeout);
    statusDiv.textContent = '❌ Erreur - vérifiez l\'URL';
    statusDiv.style.color = '#ff6b6b';
    btn.disabled = false;
  };
}

function saveServerUrl() {
  const input = document.getElementById('server-url-input');
  const url = input.value.trim();
  const statusDiv = document.getElementById('server-status');
  
  if (!url) {
    statusDiv.textContent = '⚠️ URL vide - utilise localhost:3000';
    statusDiv.style.color = '#ffa500';
    setServerUrl('ws://localhost:3000');
    input.value = 'ws://localhost:3000';
    return;
  }
  
  setServerUrl(url);
  statusDiv.textContent = '💾 URL enregistrée';
  statusDiv.style.color = '#d4af37';
  setTimeout(() => { statusDiv.textContent = ''; }, 2000);
}

// Au chargement de la page, afficher l'URL actuelle
function initServerConfigUI() {
  const input = document.getElementById('server-url-input');
  if (input) {
    input.value = getServerUrl();
  }
}

// ─── CONNEXION WS ────────────────────────────────────────
function connectWS(onOpen) {
  // Fermer toute connexion existante
  if (multiState.ws) {
    multiState.ws.onclose = null;
    multiState.ws.close();
    multiState.ws = null;
  }

  // Récupérer l'URL du serveur depuis localStorage
  SERVER_URL = getServerUrl();
  const ws = new WebSocket(SERVER_URL);
  multiState.ws = ws;

  ws.onopen = () => {
    console.log('WebSocket connecté');
    onOpen(ws);
  };

  ws.onerror = (e) => {
    console.error('WS error:', e);
    showJoinStatus('Impossible de contacter le serveur. Est-il démarré?', 'err');
    addLog('Erreur: serveur inaccessible.', 'normal');
    const btn = document.getElementById('btn-create-session');
    if (btn) { btn.textContent = 'Créer la session'; btn.disabled = false; }
  };

  ws.onclose = () => {
    if (!multiState.active) return;
    multiState.active = false;
    multiState.remotePlayers = {};
    updateMultiIndicator();
    updateRemotePlayersPanel();
    showJoinStatus('Déconnecté du serveur.', 'err');
    addLog('Déconnecté de la partie.', 'normal');
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleServerMessage(msg);
  };
}

// ─── MESSAGES ENTRANTS ──────────────────────────────────
function handleServerMessage(msg) {
  const { type } = msg;

  if (type === 'created') {
    // L'hôte a créé la room avec succès
    multiState.sessionId = msg.sessionId;
    multiState.isHost = true;
    multiState.active = true;
    multiState.roomCode = msg.code;

    document.getElementById('host-code-section').style.display = 'block';
    document.getElementById('host-code-display').textContent = msg.code;
    const btn = document.getElementById('btn-create-session');
    if (btn) { btn.textContent = 'Session créée!'; btn.disabled = false; }
    updateConnectedPeersList();
    setupBroadcasters();
    addLog(`Session créée — code: ${msg.code}`, 'action');
  }

  else if (type === 'joined') {
    // Le client a rejoint avec succès
    multiState.sessionId = msg.sessionId;
    multiState.isHost = false;
    multiState.active = true;
    multiState.roomCode = msg.code;

    showJoinStatus('Connecté! En attente du lancement par l\'hôte...', 'ok');
    setupBroadcasters();
    addLog(`Connecté à la room ${msg.code}. Attente du lancement...`, 'action');
  }

  else if (type === 'error') {
    showJoinStatus(msg.msg, 'err');
    addLog(`Erreur: ${msg.msg}`, 'normal');
    const btn = document.getElementById('btn-create-session');
    if (btn) { btn.textContent = 'Créer la session'; btn.disabled = false; }
  }

  else if (type === 'promoted_host') {
    multiState.isHost = true;
    addLog('Vous êtes maintenant l\'hôte!', 'action');
    const btnStart = document.getElementById('btn-start-multi');
    if (btnStart) btnStart.style.display = 'block';
    updateMultiIndicator();
  }

  else if (type === 'game_start') {
    backToMenuFromMulti();
    startGame(state.selectedClass || 'fracture');
    updateMultiIndicator();
    addLog('La partie commence!', 'action');
  }

  else if (type === 'player_joined') {
    if (msg.sessionId === multiState.sessionId) return;
    multiState.remotePlayers[msg.sessionId] = {
      x: msg.x ?? 7, y: msg.y ?? 7,
      classId: msg.classId,
      hp: msg.hp ?? 100, hpMax: msg.hpMax ?? 100,
      name: msg.name || `Joueur-${msg.sessionId.slice(0,4)}`,
      location: msg.location || 'overworld',
    };
    updateRemotePlayersPanel();
    updateConnectedPeersList();
    if (multiState.isHost) {
      const btnStart = document.getElementById('btn-start-multi');
      if (btnStart) btnStart.style.display = 'block';
    }
    addLog(`${msg.name || 'Joueur'} a rejoint!`, 'action');
    if (typeof refreshChatPlayerList === 'function') refreshChatPlayerList();
    if (msg.name && msg.sessionId) { if (typeof ChatSystem !== 'undefined') ChatSystem.playerNames[msg.sessionId] = msg.name; }
  }

  else if (type === 'player_left') {
    const rp = multiState.remotePlayers[msg.sessionId];
    if (rp) addLog(`${rp.name || 'Joueur'} a quitté.`, 'normal');
    delete multiState.remotePlayers[msg.sessionId];
    updateRemotePlayersPanel();
    updateConnectedPeersList();
  }

  else if (type === 'move') {
    if (msg.sessionId === multiState.sessionId) return;
    if (!multiState.remotePlayers[msg.sessionId]) {
      multiState.remotePlayers[msg.sessionId] = { hp: 100, hpMax: 100 };
    }
    const _rm = multiState.remotePlayers[msg.sessionId];
    _rm.x = msg.x; _rm.y = msg.y;
    if (msg.name) _rm.name = msg.name;
    if (msg.location !== undefined) _rm.location = msg.location;
    updateRemotePlayersPanel();
  }

  else if (type === 'hp_update') {
    if (msg.sessionId === multiState.sessionId) return;
    if (multiState.remotePlayers[msg.sessionId]) {
      const _rh = multiState.remotePlayers[msg.sessionId];
      _rh.hp = msg.hp; _rh.hpMax = msg.hpMax;
      if (msg.talentBonuses) _rh.talentBonuses = msg.talentBonuses;
      if (msg.talentLevel) _rh.talentLevel = msg.talentLevel;
      updateRemotePlayersPanel();
    }
  }

  else if (type === 'skill') {
    if (msg.sessionId === multiState.sessionId) return;
    if (state.opts.vfx && msg.targetGx !== undefined) {
      spawnFloater(msg.targetGx, msg.targetGy, '⚡', '#ffffff', 14);
    }
    addLog('Allié utilise un skill!', 'action');
  }

  else if (type === 'class_change') {
    if (msg.sessionId === multiState.sessionId) return;
    if (!multiState.remotePlayers[msg.sessionId]) {
      multiState.remotePlayers[msg.sessionId] = { x: 7, y: 7 };
    }
    Object.assign(multiState.remotePlayers[msg.sessionId], {
      classId: msg.classId, hp: msg.hp, hpMax: msg.hpMax, name: msg.name, location: msg.location || 'overworld',
    });
    updateRemotePlayersPanel();
  }

  else if (type === 'chat' || type === 'chat_private') {
    if (typeof onChatMessageReceived === 'function') {
      onChatMessageReceived({ from: msg.name, sessionId: msg.sessionId, text: msg.msg, channel: msg.channel, targetId: msg.targetId });
    } else {
      addLog(`💬 ${msg.name}: ${msg.msg}`, 'action');
    }
  }
  // Trade messages
  else if (type.startsWith('trade_')) {
    if (typeof onTradeMessage === 'function') onTradeMessage(msg);
  }

  // ─── GROUPE ET INVITATIONS ──────────────────────────────────
  else if (type === 'group_invite') {
    // Recevoir une invitation au groupe
    const notifId = 'group_invite_' + msg.fromSessionId;
    const old = document.getElementById(notifId);
    if (old) old.remove();
    
    const notif = document.createElement('div');
    notif.id = notifId;
    notif.style.cssText = `
      position: fixed;
      top: 60px;
      right: 14px;
      z-index: 401;
      background: rgba(30, 10, 50, 0.95);
      border: 2px solid #9b4dca;
      border-radius: 8px;
      padding: 12px 16px;
      color: #d4af37;
      font-family: 'Cinzel', serif;
      font-size: 13px;
      max-width: 300px;
      box-shadow: 0 4px 20px rgba(100, 20, 180, 0.4);
    `;
    
    notif.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold;">👥 Invitation au groupe</div>
      <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">${msg.fromName} vous invite</div>
      <div style="display: flex; gap: 6px;">
        <button onclick="acceptGroupInvite('${msg.fromSessionId}', '${msg.fromName}')" style="flex: 1; padding: 6px; background: rgba(100, 200, 100, 0.5); border: 1px solid #66cc66; color: #66ff66; border-radius: 4px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 11px; font-weight: bold;">Accepter</button>
        <button onclick="declineGroupInvite('${msg.fromSessionId}', '${msg.fromName}')" style="flex: 1; padding: 6px; background: rgba(200, 100, 100, 0.5); border: 1px solid #cc6666; color: #ff9999; border-radius: 4px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 11px; font-weight: bold;">Refuser</button>
      </div>
    `;
    
    document.body.appendChild(notif);
    setTimeout(() => { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 30000);
  }

  else if (type === 'group_accept') {
    // Ajouter l'accepteur au groupe du demandeur
    if (!state.group.members.includes(msg.acceptorSessionId)) {
      state.group.members.push(msg.acceptorSessionId);
    }
    if (typeof renderGroupPlayers === 'function') renderGroupPlayers();
    if (typeof updateRemotePlayersPanel === 'function') updateRemotePlayersPanel();
    addLog(`${msg.acceptorName} a rejoint le groupe!`, 'success');
  }

  else if (type === 'group_leave') {
    const _li = state.group.members.indexOf(msg.leavingSessionId);
    if (_li > -1) state.group.members.splice(_li, 1);
    if (typeof renderGroupPlayers === 'function') renderGroupPlayers();
    if (typeof updateRemotePlayersPanel === 'function') updateRemotePlayersPanel();
    addLog(`${msg.leavingName} a quitte le groupe.`, 'normal');
  }

  else if (type === 'dungeon_status') {
    // Un membre du groupe est dans un donjon — proposer de rejoindre
    if (msg.fromSessionId !== multiState.sessionId && state.group.members.includes(msg.fromSessionId)) {
      if (typeof joinDungeonInProgress === 'function') {
        joinDungeonInProgress(msg.fromSessionId, msg.fromName, msg.zone, msg.roomId);
      }
    }
  }

  else if (type === 'dungeon_request') {
    if (typeof handleDungeonRequest === 'function') {
      handleDungeonRequest(msg.fromSessionId, msg.fromName, msg.dungeonType);
    }
  }

  else if (type === 'dungeon_accept') {
    if (typeof registerDungeonAccept === 'function') {
      registerDungeonAccept(msg.acceptorSessionId, msg.acceptorName);
    }
  }

  else if (type === 'dungeon_decline') {
    if (typeof registerDungeonDecline === 'function') registerDungeonDecline(msg.declineSessionId, msg.declineName);
  }

  // ────────────────────────────────────────────────────────────
  else if (type === 'pong') {
    // latence = Date.now() - msg.t
  }
}

// ─── CRÉER SESSION ──────────────────────────────────────
function createSession() {
  const btn = document.getElementById('btn-create-session');
  btn.textContent = 'Connexion...'; btn.disabled = true;

  connectWS((ws) => {
    wsSend('create', {
      name: generateName(),
      classId: state.selectedClass,
      x: state.player.gridX, y: state.player.gridY,
      hp: state.hp, hpMax: state.hpMax,
    });
  });
}

// ─── REJOINDRE SESSION ──────────────────────────────────
function joinSession() {
  const codeInput = document.getElementById('join-code-input');
  const code = codeInput.value.trim().toUpperCase();
  if (!code) { showJoinStatus('Entrez un code de session.', 'err'); return; }

  showJoinStatus('Connexion au serveur...', 'pending');

  connectWS((ws) => {
    wsSend('join', {
      code,
      name: generateName(),
      classId: state.selectedClass,
      x: state.player.gridX, y: state.player.gridY,
      hp: state.hp, hpMax: state.hpMax,
    });
  });
}

// ─── COPIER CODE ────────────────────────────────────────
function copySessionCode() {
  const code = document.getElementById('host-code-display').textContent;
  if (!code || code === '—') return;
  const btn = document.querySelector('.multi-copy-btn');
  
  // Utiliser Clipboard API si disponible
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      if (btn) { btn.textContent = '✓ Copié!'; setTimeout(() => { btn.textContent = '📋 Copier le code'; }, 2000); }
    }).catch(() => {
      // Fallback: sélection manuelle
      selectText(code, btn);
    });
  } else {
    // Fallback: sélection manuelle si pas de Clipboard API
    selectText(code, btn);
  }
}

function selectText(code, btn) {
  const el = document.getElementById('host-code-display');
  if (el) {
    const range = document.createRange();
    range.selectNode(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    if (btn) { btn.textContent = '✓ Copié!'; setTimeout(() => { btn.textContent = '📋 Copier le code'; }, 2000); }
  }
}

// ─── LANCER PARTIE ──────────────────────────────────────
function startMultiGame() {
  if (!multiState.active) { addLog('Non connecté!', 'normal'); return; }
  if (!multiState.isHost) { addLog('Seul l\'hôte peut lancer.', 'normal'); return; }
  if (Object.keys(multiState.remotePlayers).length === 0) {
    addLog('Aucun joueur connecté!', 'normal'); return;
  }
  wsSend('game_start', {});
  backToMenuFromMulti();
  startGame(state.selectedClass || 'fracture');
  updateMultiIndicator();
  addLog('Partie lancée!', 'action');
}

// ─── BROADCASTERS ───────────────────────────────────────
function setupBroadcasters() {
  // Show chat
  const _cb = document.getElementById('chat-toggle-btn');
  if (_cb) _cb.style.display = 'flex';
  multiState.broadcastClass = (info) => {
    wsSend('class_change', { classId: info.classId, hp: info.hp, hpMax: info.hpMax, x: info.x, y: info.y, name: info.name, location: state.player?.location || 'overworld' });
  };
  multiState.broadcastSkill = (info) => {
    wsSend('skill', { skillId: info.skillId, targetGx: info.targetGx, targetGy: info.targetGy, classId: info.classId });
  };
  multiState.broadcastMove = (x, y) => {
    wsSend('move', { x, y, location: state.player?.location || 'overworld' });
  };
  multiState.broadcastHeal = (amount) => {
    wsSend('heal', { amount });
  };
  multiState.broadcastHp = () => {
    wsSend('hp_update', { hp: state.hp, hpMax: state.hpMax, talentBonuses: state.talentBonuses || null, talentLevel: state.talents ? state.talents.level : 1 });
  };
  multiState.broadcastLocation = () => {
    wsSend('move', { x: state.player.gridX, y: state.player.gridY, location: state.player?.location || 'overworld' });
  };
  updateMultiIndicator();
}

// ─── POLLING ────────────────────────────────────────────
let _lbx = -1, _lby = -1;
setInterval(() => {
  if (!multiState.active || !multiState.broadcastMove) return;
  if (state.player.gridX !== _lbx || state.player.gridY !== _lby) {
    _lbx = state.player.gridX; _lby = state.player.gridY;
    multiState.broadcastMove(_lbx, _lby);
  }
}, 200);

let _lbhp = -1;
setInterval(() => {
  if (!multiState.active || !multiState.broadcastHp) return;
  if (state.hp !== _lbhp) {
    _lbhp = state.hp;
    multiState.broadcastHp();
  }
}, 500);

// ─── UI ─────────────────────────────────────────────────
function updateMultiIndicator() {
  const indicator = document.getElementById('multi-indicator');
  const icon = document.getElementById('multi-indicator-icon');
  const text = document.getElementById('multi-indicator-text');
  if (!indicator) return;
  if (multiState.active) {
    indicator.style.display = 'flex';
    icon.textContent = '🟢';
    const count = Object.keys(multiState.remotePlayers).length;
    text.textContent = `${multiState.isHost ? 'Hôte' : 'Invité'} · ${count + 1} joueur(s)`;
  } else {
    indicator.style.display = 'none';
  }
}

function updateConnectedPeersList() {
  const list = document.getElementById('connected-peers-list');
  if (!list) return;
  const players = Object.values(multiState.remotePlayers);
  if (players.length === 0) { list.textContent = 'En attente de joueurs...'; return; }
  list.innerHTML = players.map(p => `<div class="peer-entry">✦ ${p.name || 'Joueur'}</div>`).join('');
}

function updateRemotePlayersPanel() {
  const panel = document.getElementById('remote-players-panel');
  const list = document.getElementById('remote-players-list');
  if (!panel || !list) return;
  const players = Object.entries(multiState.remotePlayers);
  if (players.length === 0) { panel.style.display = 'none'; return; }

  // Filtrer les joueurs pour afficher seulement ceux au même endroit
  const myLocation = state.player?.location || 'overworld';
  const filteredPlayers = players.filter(([sessionId, rp]) => {
    return (rp.location || 'overworld') === myLocation;
  });

  if (filteredPlayers.length === 0) { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  list.innerHTML = filteredPlayers.map(([sessionId, rp]) => {
    const rcls = rp.classId ? CLASSES[rp.classId] : null;
    const hpPct = rp.hpMax ? Math.round((rp.hp / rp.hpMax) * 100) : 100;
    return `<div class="remote-player-card" data-session-id="${sessionId}" data-player-name="${rp.name || 'Allié'}" style="border-color:${rcls ? rcls.color+'44' : '#304050'}; cursor: pointer;">
      <div class="remote-player-name" style="color:${rcls ? rcls.color : '#80c0ff'};">◇ ${rp.name || 'Allié'}</div>
      <div class="remote-player-class">${rcls ? rcls.name : '—'}</div>
      <div class="remote-player-hp">PV: ${hpPct}% · (${rp.x||0},${rp.y||0})</div>
    </div>`;
  }).join('');

  // Ajouter event listeners à tous les joueurs
  document.querySelectorAll('.remote-player-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const sessionId = card.getAttribute('data-session-id');
      const playerName = card.getAttribute('data-player-name');
      showPlayerContextMenu(sessionId, playerName, e.clientX, e.clientY);
    });
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const sessionId = card.getAttribute('data-session-id');
      const playerName = card.getAttribute('data-player-name');
      showPlayerContextMenu(sessionId, playerName, e.clientX, e.clientY);
    });
  });

  // Mettre à jour le panneau du groupe
  if (typeof renderGroupPlayers === 'function') renderGroupPlayers();
}