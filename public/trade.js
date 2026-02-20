// ═══════════════════════════════════════════════════════
// VEILBORN — SYSTÈME DE TRADE (Échange entre joueurs)
// ═══════════════════════════════════════════════════════

const TradeSystem = {
  active: false,
  targetId: null,
  targetName: null,
  myOffer: {
    items: [],    // itemIds
    gold: 0,
  },
  theirOffer: {
    items: [],
    gold: 0,
    name: null,
  },
  myConfirmed: false,
  theirConfirmed: false,
  pendingRequest: null,   // { fromId, fromName } — demande entrante
};

// ─────────────────────────────────────────
// INITIER UN ÉCHANGE
// ─────────────────────────────────────────
function openTradeWith(targetId, targetName) {
  if (!window.multiState?.active) {
    if (typeof addLog === 'function') addLog('Échange uniquement en multijoueur.', 'normal');
    return;
  }
  if (TradeSystem.active) {
    if (typeof addLog === 'function') addLog('Échange déjà en cours!', 'action');
    return;
  }

  // Envoyer demande de trade via WS
  wsSend('trade_request', { targetId, name: getMyName() });
  if (typeof addLog === 'function') addLog(`⇄ Demande d'échange envoyée à ${targetName}...`, 'action');
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.trade();
}

function acceptTradeRequest() {
  if (!TradeSystem.pendingRequest) return;
  const { fromId, fromName } = TradeSystem.pendingRequest;
  TradeSystem.pendingRequest = null;
  document.getElementById('trade-request-modal').style.display = 'none';

  startTrade(fromId, fromName);
  wsSend('trade_accept', { targetId: fromId });
}

function declineTradeRequest() {
  if (!TradeSystem.pendingRequest) return;
  const { fromId } = TradeSystem.pendingRequest;
  wsSend('trade_decline', { targetId: fromId });
  TradeSystem.pendingRequest = null;
  document.getElementById('trade-request-modal').style.display = 'none';
  if (typeof addLog === 'function') addLog('Échange refusé.', 'normal');
}

// ─────────────────────────────────────────
// DÉMARRER L'ÉCHANGE
// ─────────────────────────────────────────
function startTrade(targetId, targetName) {
  TradeSystem.active = true;
  TradeSystem.targetId = targetId;
  TradeSystem.targetName = targetName;
  TradeSystem.myOffer = { items: [], gold: 0 };
  TradeSystem.theirOffer = { items: [], gold: 0, name: targetName };
  TradeSystem.myConfirmed = false;
  TradeSystem.theirConfirmed = false;

  const modal = document.getElementById('trade-modal');
  if (modal) modal.style.display = 'flex';
  refreshTradeUI();

  if (typeof addLog === 'function') addLog(`⇄ Échange ouvert avec ${targetName}.`, 'action');
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.trade();
}

function cancelTrade() {
  if (TradeSystem.active && TradeSystem.targetId) {
    wsSend('trade_cancel', { targetId: TradeSystem.targetId });
  }
  closeTrade();
  if (typeof addLog === 'function') addLog('Échange annulé.', 'normal');
}

function closeTrade() {
  TradeSystem.active = false;
  TradeSystem.targetId = null;
  TradeSystem.targetName = null;
  const modal = document.getElementById('trade-modal');
  if (modal) modal.style.display = 'none';
}

// ─────────────────────────────────────────
// AJOUTER / RETIRER ITEMS DE L'OFFRE
// ─────────────────────────────────────────
function addItemToTrade(itemId) {
  if (!TradeSystem.active) return;
  if (TradeSystem.myOffer.items.includes(itemId)) return;
  if (TradeSystem.myOffer.items.length >= 5) {
    if (typeof addLog === 'function') addLog('Maximum 5 items par échange.', 'normal');
    return;
  }
  TradeSystem.myOffer.items.push(itemId);
  TradeSystem.myConfirmed = false;
  TradeSystem.theirConfirmed = false;
  broadcastTradeOffer();
  refreshTradeUI();
}

function removeItemFromTrade(itemId) {
  if (!TradeSystem.active) return;
  TradeSystem.myOffer.items = TradeSystem.myOffer.items.filter(id => id !== itemId);
  TradeSystem.myConfirmed = false;
  TradeSystem.theirConfirmed = false;
  broadcastTradeOffer();
  refreshTradeUI();
}

function setTradeGold(amount) {
  if (!TradeSystem.active) return;
  const max = state.economy?.gold || 0;
  TradeSystem.myOffer.gold = Math.min(Math.max(0, parseInt(amount) || 0), max);
  TradeSystem.myConfirmed = false;
  TradeSystem.theirConfirmed = false;
  broadcastTradeOffer();
  refreshTradeUI();
}

// ─────────────────────────────────────────
// CONFIRMER L'ÉCHANGE
// ─────────────────────────────────────────
function confirmTrade() {
  if (!TradeSystem.active) return;
  TradeSystem.myConfirmed = true;
  wsSend('trade_confirm', { targetId: TradeSystem.targetId });

  // Si les deux ont confirmé (offline: simulé)
  if (TradeSystem.theirConfirmed) {
    executeTrade();
  } else {
    refreshTradeUI();
    if (typeof addLog === 'function') addLog('Échange confirmé de votre côté. Attente de l\'autre joueur...', 'action');
  }
}

function executeTrade() {
  if (!state.economy) return;

  // Retirer mes items offerts
  for (const itemId of TradeSystem.myOffer.items) {
    removeItemFromInventory(itemId);
  }

  // Retirer mon or
  if (TradeSystem.myOffer.gold > 0) {
    spendGold(TradeSystem.myOffer.gold);
  }

  // Ajouter leurs items
  for (const item of (TradeSystem.theirOffer.itemObjects || [])) {
    if (typeof addItemToInventory === 'function') addItemToInventory(item);
  }

  // Ajouter leur or
  if (TradeSystem.theirOffer.gold > 0) {
    addGold(TradeSystem.theirOffer.gold);
  }

  if (typeof AudioEngine !== 'undefined') AudioEngine.play.trade();
  if (typeof addLog === 'function') addLog(`✦ Échange complété avec ${TradeSystem.targetName}!`, 'action');

  // Particles dorées
  if (typeof spawnFloater === 'function') {
    spawnFloater(state.player.gridX, state.player.gridY, '✦ ÉCHANGE ✦', '#f1c40f', 16);
  }

  closeTrade();
}

// ─────────────────────────────────────────
// BROADCAST / RECEPTION WS
// ─────────────────────────────────────────
function broadcastTradeOffer() {
  if (!window.multiState?.active) return;
  if (!TradeSystem.targetId) return;
  const itemObjects = (TradeSystem.myOffer.items || []).map(id =>
    state.economy?.inventory?.find(i => i.id === id)
  ).filter(Boolean);

  wsSend('trade_offer', {
    targetId: TradeSystem.targetId,
    offer: {
      itemObjects,
      gold: TradeSystem.myOffer.gold,
    },
  });
}

function onTradeMessage(msg) {
  const { type } = msg;

  if (type === 'trade_request') {
    TradeSystem.pendingRequest = { fromId: msg.sessionId, fromName: msg.name };
    const reqModal = document.getElementById('trade-request-modal');
    if (reqModal) {
      document.getElementById('trade-req-name').textContent = msg.name;
      reqModal.style.display = 'flex';
    }
    if (typeof addLog === 'function') addLog(`⇄ ${msg.name} vous propose un échange!`, 'action');
    if (typeof AudioEngine !== 'undefined') AudioEngine.play.trade();
  }

  else if (type === 'trade_accept') {
    // Le serveur retourne fromSessionId = celui qui a accepté (l'autre joueur)
    const senderId = msg.sessionId;
    if (!senderId) return;
    const playerName = (window.multiState?.remotePlayers?.[senderId]?.name)
      || (typeof ChatSystem !== 'undefined' && ChatSystem.playerNames?.[senderId])
      || senderId.slice(0, 6);
    startTrade(senderId, playerName);
  }

  else if (type === 'trade_decline') {
    closeTrade();
    if (typeof addLog === 'function') addLog(`L'autre joueur a refusé l'échange.`, 'normal');
  }

  else if (type === 'trade_offer') {
    if (!TradeSystem.active) return;
    TradeSystem.theirOffer.itemObjects = msg.offer?.itemObjects || [];
    TradeSystem.theirOffer.gold = msg.offer?.gold || 0;
    TradeSystem.myConfirmed = false;
    TradeSystem.theirConfirmed = false;
    refreshTradeUI();
  }

  else if (type === 'trade_confirm') {
    if (!TradeSystem.active) return;
    TradeSystem.theirConfirmed = true;
    if (TradeSystem.myConfirmed) {
      executeTrade();
    } else {
      refreshTradeUI();
      if (typeof addLog === 'function') addLog(`${TradeSystem.targetName} a confirmé l'échange. Confirmez aussi!`, 'action');
    }
  }

  else if (type === 'trade_cancel') {
    if (!TradeSystem.active) return;
    const tName = TradeSystem.targetName || 'L\'autre joueur';
    closeTrade();
    if (typeof addLog === 'function') addLog(`${tName} a annulé l'échange.`, 'normal');
  }
}

// ─────────────────────────────────────────
// RENDU UI
// ─────────────────────────────────────────
function refreshTradeUI() {
  const modal = document.getElementById('trade-modal');
  if (!modal || modal.style.display === 'none') return;

  // Titre
  const title = document.getElementById('trade-target-name');
  if (title) title.textContent = TradeSystem.targetName || '—';

  // Mon offre - Items
  const myItemsContainer = document.getElementById('trade-my-items');
  if (myItemsContainer) {
    const myItems = (TradeSystem.myOffer.items || []).map(id =>
      state.economy?.inventory?.find(i => i.id === id)
    ).filter(Boolean);
    myItemsContainer.innerHTML = myItems.length
      ? myItems.map(item => `
        <div class="trade-item" onclick="removeItemFromTrade('${item.id}')" title="Clic pour retirer">
          <span class="trade-item-icon">${item.icon}</span>
          <div>
            <div style="color:${item.rarityColor};font-size:10px;font-family:'Cinzel',serif;">${item.name}</div>
            <div style="color:#6a5030;font-size:9px;">${item.bonus}</div>
          </div>
          <span style="color:rgba(200,60,30,0.7);font-size:10px;margin-left:auto;">✕</span>
        </div>`).join('')
      : '<div style="color:#3a2010;font-style:italic;font-size:10px;text-align:center;padding:8px;">Glissez des items ici...</div>';
  }

  // Mon offre - Or
  const myGoldInput = document.getElementById('trade-my-gold');
  if (myGoldInput) myGoldInput.value = TradeSystem.myOffer.gold;

  // Inventaire (items disponibles à offrir)
  const availContainer = document.getElementById('trade-inventory-items');
  if (availContainer && state.economy) {
    const available = state.economy.inventory.filter(i => !TradeSystem.myOffer.items.includes(i.id));
    availContainer.innerHTML = available.length
      ? available.map(item => `
        <div class="trade-inv-item" onclick="addItemToTrade('${item.id}')" title="Ajouter à l'offre">
          <span>${item.icon}</span>
          <span style="color:${item.rarityColor};font-family:'Cinzel',serif;font-size:10px;">${item.name}</span>
          <span style="color:#6a5030;font-size:9px;">+</span>
        </div>`).join('')
      : '<div style="color:#3a2010;font-style:italic;font-size:10px;padding:6px;">Sac vide</div>';
  }

  // Leur offre
  const theirItemsContainer = document.getElementById('trade-their-items');
  if (theirItemsContainer) {
    const items = TradeSystem.theirOffer.itemObjects || [];
    theirItemsContainer.innerHTML = items.length
      ? items.map(item => `
        <div class="trade-item">
          <span class="trade-item-icon">${item.icon || '📦'}</span>
          <div>
            <div style="color:${item.rarityColor || '#c8a96e'};font-size:10px;font-family:'Cinzel',serif;">${item.name || 'Item'}</div>
            <div style="color:#6a5030;font-size:9px;">${item.bonus || ''}</div>
          </div>
        </div>`).join('')
      : '<div style="color:#3a2010;font-style:italic;font-size:10px;text-align:center;padding:8px;">Rien offert</div>';
  }

  const theirGold = document.getElementById('trade-their-gold');
  if (theirGold) theirGold.textContent = `${TradeSystem.theirOffer.gold} g`;

  // Boutons confirmation
  const myConfirmBtn = document.getElementById('trade-confirm-btn');
  if (myConfirmBtn) {
    myConfirmBtn.textContent = TradeSystem.myConfirmed ? '✓ Confirmé' : 'Confirmer';
    myConfirmBtn.style.opacity = TradeSystem.myConfirmed ? '0.5' : '1';
    myConfirmBtn.disabled = TradeSystem.myConfirmed;
  }
  const theirStatus = document.getElementById('trade-their-status');
  if (theirStatus) {
    theirStatus.textContent = TradeSystem.theirConfirmed ? '✓ Confirmé' : 'En attente...';
    theirStatus.style.color = TradeSystem.theirConfirmed ? '#27ae60' : '#6a5030';
  }

  // Or disponible
  const maxGold = document.getElementById('trade-max-gold');
  if (maxGold) maxGold.textContent = `Max: ${state.economy?.gold || 0} g`;
}