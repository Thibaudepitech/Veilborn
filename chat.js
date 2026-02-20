// ═══════════════════════════════════════════════════════
// VEILBORN — CHAT EN LIGNE (Général + Privé) & TRADE
// ═══════════════════════════════════════════════════════

// ─────────────────────────────────────────
// ÉTAT CHAT
// ─────────────────────────────────────────
const ChatSystem = {
  open: false,
  activeTab: 'general',     // 'general' | sessionId (private)
  messages: {
    general: [],             // { from, sessionId, text, ts }
  },
  privateConvos: {},         // sessionId -> [messages]
  unread: { general: 0 },   // unread counts
  inputHistory: [],
  historyIdx: -1,

  // Map sessionId -> displayName
  playerNames: {},
};

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
function initChat() {
  const modal = document.getElementById('chat-modal');
  if (!modal) return;
  switchChatTab('general');
  refreshChatUI();
}

// ─────────────────────────────────────────
// OUVRIR / FERMER
// ─────────────────────────────────────────
function openChat() {
  ChatSystem.open = true;
  const modal = document.getElementById('chat-modal');
  if (modal) modal.style.display = 'flex';
  ChatSystem.unread[ChatSystem.activeTab] = 0;
  refreshChatUnreadBadge();
  refreshChatUI();
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) input.focus();
    scrollChatToBottom();
  }, 50);
}

function closeChat() {
  ChatSystem.open = false;
  const modal = document.getElementById('chat-modal');
  if (modal) modal.style.display = 'none';
}

function toggleChat() {
  ChatSystem.open ? closeChat() : openChat();
}

// ─────────────────────────────────────────
// TABS
// ─────────────────────────────────────────
function switchChatTab(tab) {
  ChatSystem.activeTab = tab;
  ChatSystem.unread[tab] = 0;
  refreshChatTabBar();
  refreshChatMessages();
  refreshChatUnreadBadge();
  scrollChatToBottom();
  // Mettre à jour placeholder
  const input = document.getElementById('chat-input');
  if (input) {
    if (tab === 'general') input.placeholder = 'Message général...';
    else {
      const name = ChatSystem.playerNames[tab] || tab.slice(0,6);
      input.placeholder = `Message privé à ${name}...`;
    }
  }
}

function openPrivateChat(sessionId, name) {
  if (!ChatSystem.privateConvos[sessionId]) ChatSystem.privateConvos[sessionId] = [];
  if (!ChatSystem.unread[sessionId]) ChatSystem.unread[sessionId] = 0;
  ChatSystem.playerNames[sessionId] = name;
  openChat();
  switchChatTab(sessionId);
}

// ─────────────────────────────────────────
// ENVOYER MESSAGE
// ─────────────────────────────────────────
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  // Historique input
  ChatSystem.inputHistory.unshift(text);
  if (ChatSystem.inputHistory.length > 20) ChatSystem.inputHistory.pop();
  ChatSystem.historyIdx = -1;
  input.value = '';

  // Commandes slash
  if (text.startsWith('/')) {
    handleChatCommand(text);
    return;
  }

  const myName = getMyName();
  const myId = window.multiState?.sessionId || 'local';

  if (ChatSystem.activeTab === 'general') {
    // Envoyer via WS si connecté
    if (window.multiState?.active) {
      wsSend('chat', { msg: text, name: myName, channel: 'general' });
    }
    // Afficher localement
    pushChatMessage('general', { from: myName, sessionId: myId, text, ts: Date.now(), self: true });
  } else {
    // Message privé
    const targetId = ChatSystem.activeTab;
    if (window.multiState?.active) {
      wsSend('chat_private', { msg: text, name: myName, targetId });
    }
    pushChatMessage(targetId, { from: myName, sessionId: myId, text, ts: Date.now(), self: true });
  }

  if (typeof AudioEngine !== 'undefined') AudioEngine.play.uiClick();
}

function handleChatCommand(text) {
  const parts = text.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  const myName = getMyName();

  switch(cmd) {
    case '/w':
    case '/whisper': {
      // /w nomJoueur message
      const targetName = args[0];
      const msg = args.slice(1).join(' ');
      if (!targetName || !msg) {
        pushSystemMsg('Usage: /w <nomJoueur> <message>');
        return;
      }
      // Chercher le sessionId par nom
      const targetId = Object.entries(ChatSystem.playerNames).find(([id, n]) => n === targetName)?.[0];
      if (!targetId) {
        pushSystemMsg(`Joueur "${targetName}" introuvable.`);
        return;
      }
      openPrivateChat(targetId, targetName);
      if (window.multiState?.active) {
        wsSend('chat_private', { msg, name: myName, targetId });
      }
      pushChatMessage(targetId, { from: myName, sessionId: window.multiState?.sessionId || 'local', text: msg, ts: Date.now(), self: true });
      break;
    }
    case '/trade': {
      const targetName = args[0];
      const targetId = Object.entries(ChatSystem.playerNames).find(([id, n]) => n === targetName)?.[0];
      if (!targetId) { pushSystemMsg(`Joueur "${targetName}" introuvable.`); return; }
      if (typeof openTradeWith === 'function') openTradeWith(targetId, targetName);
      break;
    }
    case '/help':
      pushSystemMsg('/w <joueur> <msg> — Message privé');
      pushSystemMsg('/trade <joueur> — Proposer un échange');
      pushSystemMsg('/help — Aide');
      break;
    default:
      pushSystemMsg(`Commande inconnue: ${cmd}`);
  }
}

// ─────────────────────────────────────────
// MESSAGES ENTRANTS (via WS)
// ─────────────────────────────────────────
function onChatMessageReceived(msg) {
  // msg: { from, sessionId, text, channel?, targetId? }
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.chatMessage();

  // Enregistrer le nom du joueur
  if (msg.sessionId && msg.from) {
    ChatSystem.playerNames[msg.sessionId] = msg.from;
  }

  if (msg.channel === 'general' || !msg.targetId) {
    pushChatMessage('general', { from: msg.from, sessionId: msg.sessionId, text: msg.text || msg.msg, ts: Date.now() });
    if (!ChatSystem.open || ChatSystem.activeTab !== 'general') {
      ChatSystem.unread.general = (ChatSystem.unread.general || 0) + 1;
      refreshChatUnreadBadge();
    }
  } else {
    // Message privé
    const convId = msg.sessionId;
    if (!ChatSystem.privateConvos[convId]) ChatSystem.privateConvos[convId] = [];
    pushChatMessage(convId, { from: msg.from, sessionId: msg.sessionId, text: msg.text || msg.msg, ts: Date.now() });
    if (!ChatSystem.open || ChatSystem.activeTab !== convId) {
      ChatSystem.unread[convId] = (ChatSystem.unread[convId] || 0) + 1;
      refreshChatUnreadBadge();
    }
  }
}

function pushChatMessage(channel, msgObj) {
  if (channel === 'general') {
    ChatSystem.messages.general.push(msgObj);
    if (ChatSystem.messages.general.length > 100) ChatSystem.messages.general.shift();
  } else {
    if (!ChatSystem.privateConvos[channel]) ChatSystem.privateConvos[channel] = [];
    ChatSystem.privateConvos[channel].push(msgObj);
    if (ChatSystem.privateConvos[channel].length > 100) ChatSystem.privateConvos[channel].shift();
  }
  if (ChatSystem.open && ChatSystem.activeTab === channel) {
    refreshChatMessages();
    scrollChatToBottom();
  }
  // Notification dans le log de jeu si fermé
  if (!ChatSystem.open) {
    if (typeof addLog === 'function') {
      const preview = msgObj.text.length > 30 ? msgObj.text.slice(0,30)+'...' : msgObj.text;
      const prefix = channel === 'general' ? '💬' : '🔒';
      addLog(`${prefix} ${msgObj.from}: ${preview}`, 'normal');
    }
  }
}

function pushSystemMsg(text) {
  pushChatMessage(ChatSystem.activeTab, { from: '⚙ Système', sessionId: 'system', text, ts: Date.now(), system: true });
}

// ─────────────────────────────────────────
// RENDU
// ─────────────────────────────────────────
function refreshChatUI() {
  refreshChatTabBar();
  refreshChatMessages();
  refreshChatUnreadBadge();
}

function refreshChatTabBar() {
  const container = document.getElementById('chat-tabs');
  if (!container) return;

  const tabs = [
    { id: 'general', label: '💬 Général' },
    ...Object.keys(ChatSystem.privateConvos).map(id => ({
      id,
      label: `🔒 ${ChatSystem.playerNames[id] || id.slice(0,5)}`,
    })),
  ];

  container.innerHTML = tabs.map(t => {
    const unread = ChatSystem.unread[t.id] || 0;
    const active = ChatSystem.activeTab === t.id;
    return `<div class="chat-tab ${active ? 'active' : ''}" onclick="switchChatTab('${t.id}')">
      ${t.label}${unread > 0 ? `<span class="chat-unread-dot">${unread}</span>` : ''}
    </div>`;
  }).join('');
}

function refreshChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msgs = ChatSystem.activeTab === 'general'
    ? ChatSystem.messages.general
    : (ChatSystem.privateConvos[ChatSystem.activeTab] || []);

  if (msgs.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:#3a2010;font-family:'IM Fell English',serif;font-style:italic;font-size:11px;padding:20px;">Aucun message pour l'instant...</div>`;
    return;
  }

  container.innerHTML = msgs.map(m => {
    const time = new Date(m.ts).toLocaleTimeString('fr', { hour:'2-digit', minute:'2-digit' });
    const isSystem = m.system;
    const isSelf = m.self;
    const nameColor = isSystem ? '#6a5030' : isSelf ? '#c8a96e' : getPlayerColor(m.sessionId);
    return `<div class="chat-msg ${isSelf ? 'self' : ''} ${isSystem ? 'system' : ''}">
      <span class="chat-msg-time">${time}</span>
      <span class="chat-msg-name" style="color:${nameColor};">${m.from}</span>
      <span class="chat-msg-text">${escapeHtml(m.text)}</span>
    </div>`;
  }).join('');
}

function refreshChatUnreadBadge() {
  const total = Object.values(ChatSystem.unread).reduce((a, b) => a + b, 0);
  const badge = document.getElementById('chat-badge');
  if (badge) {
    badge.textContent = total > 0 ? total : '';
    badge.style.display = total > 0 ? 'flex' : 'none';
  }
  const btn = document.getElementById('chat-toggle-btn');
  if (btn) btn.classList.toggle('has-unread', total > 0);
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function getPlayerColor(sessionId) {
  if (!sessionId || sessionId === 'system') return '#6a5030';
  const cls = window.multiState?.remotePlayers?.[sessionId]?.classId;
  if (cls && window.CLASSES?.[cls]) return CLASSES[cls].color;
  // Couleur dérivée du sessionId
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#4ecdc4','#e74c3c','#27ae60','#3498db','#9b4dca','#e67e22','#f1c40f'];
  return colors[Math.abs(hash) % colors.length];
}

function getMyName() {
  return window.multiState?.sessionId
    ? (ChatSystem.playerNames[multiState.sessionId] || `Joueur-${multiState.sessionId.slice(0,4)}`)
    : 'Vous';
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────
// LISTE JOUEURS (pour chat privé)
// ─────────────────────────────────────────
function refreshChatPlayerList() {
  const container = document.getElementById('chat-player-list');
  if (!container) return;
  const players = window.multiState?.remotePlayers || {};
  const entries = Object.entries(players);
  if (entries.length === 0) {
    container.innerHTML = `<div style="color:#3a2010;font-size:10px;font-style:italic;">Aucun joueur en ligne</div>`;
    return;
  }
  container.innerHTML = entries.map(([id, p]) => {
    const cls = p.classId && CLASSES[p.classId] ? CLASSES[p.classId] : null;
    const color = cls ? cls.color : '#80c0ff';
    return `<div class="chat-player-entry" onclick="openPrivateChat('${id}','${escapeHtml(p.name || id.slice(0,6))}')" title="Clic = Message privé · Clic droit = Échange">
      <span style="color:${color};font-size:10px;">◇ ${p.name || id.slice(0,6)}</span>
      <div style="display:flex;gap:4px;">
        <button class="chat-action-btn" onclick="event.stopPropagation();openPrivateChat('${id}','${escapeHtml(p.name || id.slice(0,6))}')" title="Message privé">✉</button>
        <button class="chat-action-btn" onclick="event.stopPropagation();if(typeof openTradeWith==='function')openTradeWith('${id}','${escapeHtml(p.name || id.slice(0,6))}')" title="Proposer échange">⇄</button>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// KEYBOARD
// ─────────────────────────────────────────
function chatInputKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    sendChatMessage();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeChat();
    // Pas de stopPropagation pour Échap, sinon app ne le reçoit pas
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    if (ChatSystem.historyIdx < ChatSystem.inputHistory.length - 1) {
      ChatSystem.historyIdx++;
      document.getElementById('chat-input').value = ChatSystem.inputHistory[ChatSystem.historyIdx];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    if (ChatSystem.historyIdx > 0) {
      ChatSystem.historyIdx--;
      document.getElementById('chat-input').value = ChatSystem.inputHistory[ChatSystem.historyIdx];
    } else {
      ChatSystem.historyIdx = -1;
      document.getElementById('chat-input').value = '';
    }
  } else {
    // Bloquer toutes les autres touches du clavier (empêcher la propagation)
    e.stopPropagation();
  }
}