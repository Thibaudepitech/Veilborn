// ═══════════════════════════════════════════════════════
// SYSTÈME DE GROUPE ET INVITATIONS
// ═══════════════════════════════════════════════════════

// ─── INVITATION AU GROUPE ────────────────────────────────────
function inviteToGroup(targetSessionId, targetName) {
  if (!window.multiState?.active) return;
  
  wsSend('group_invite', {
    targetSessionId,
    fromSessionId: window.multiState.sessionId,
    fromName: getMyName(),
  });
  
  addLog(`📩 Invitation envoyée à ${targetName}`, 'normal');
}

function acceptGroupInvite(fromSessionId, fromName) {
  if (!window.multiState?.active) return;
  
  // Ajouter au groupe
  if (!state.group.members.includes(fromSessionId)) {
    state.group.members.push(fromSessionId);
  }
  
  // Notifier le leader
  wsSend('group_accept', {
    fromSessionId,
    acceptorSessionId: window.multiState.sessionId,
    acceptorName: getMyName(),
  });
  
  clearNotification('group_invite_' + fromSessionId);
  addLog(`Vous avez rejoint le groupe de ${fromName}`, 'success');
  if (typeof renderGroupPlayers === 'function') renderGroupPlayers();
  if (typeof updateRemotePlayersPanel === 'function') updateRemotePlayersPanel();

  // ── TP AUTOMATIQUE SI LE CHEF EST DANS UN DONJON ──────────────
  // Vérifier si le joueur qui nous a invité est dans un donjon
  const rp = window.multiState?.remotePlayers?.[fromSessionId];
  if (rp && rp.location && rp.location !== 'overworld') {
    // Le chef est dans un donjon — on le rejoint automatiquement
    const dungeonZones = ['dungeon_r1','dungeon_r2','dungeon_r3','dungeon_boss'];
    if (dungeonZones.includes(rp.location)) {
      const roomId = rp.location === 'dungeon_boss' ? 4 :
                     parseInt(rp.location.replace('dungeon_r','')) || 1;
      addLog(`⚿ ${fromName} est dans le donjon — téléportation en cours!`, 'action');
      setTimeout(() => {
        if (typeof acceptJoinDungeon === 'function') {
          acceptJoinDungeon(fromSessionId, fromName, rp.location, roomId);
        }
      }, 800);
    }
  }
}

function declineGroupInvite(fromSessionId, fromName) {
  clearNotification('group_invite_' + fromSessionId);
  addLog(`❌ Invitation de ${fromName} refusée`, 'normal');
}

// ─── GESTION DES DEMANDES DE DONJON ──────────────────────────
function requestDungeonAccess(targetSessionId, targetName, dungeonType) {
  if (!window.multiState?.active) return;
  
  wsSend('dungeon_request', {
    fromSessionId: window.multiState.sessionId,
    fromName: getMyName(),
    targetSessionId,
    targetName,
    dungeonType,
  });
  
  addLog(`📨 Demande d'accès au donjon vers ${targetName}...`, 'normal');
}

function handleDungeonRequest(fromSessionId, fromName, dungeonType) {
  state.dungeonRequest = {
    fromSessionId,
    fromName,
    dungeonType,
    timestamp: Date.now(),
  };
  
  // Créer une notification d'acceptation/refus
  showDungeonRequestNotification(fromSessionId, fromName, dungeonType);
}

function showDungeonRequestNotification(fromSessionId, fromName, dungeonType) {
  const notifId = 'dungeon_req_' + fromSessionId;
  
  // Supprimer la première notification s'il en existe une
  const old = document.getElementById(notifId);
  if (old) old.remove();
  
  const notif = document.createElement('div');
  notif.id = notifId;
  notif.style.cssText = `
    position: fixed;
    top: 120px;
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
    <div style="margin-bottom: 8px; font-weight: bold;">🎯 Demande de donjon</div>
    <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">${fromName} veut vous inviter au ${dungeonType}</div>
    <div style="display: flex; gap: 6px;">
      <button onclick="acceptDungeonRequest('${fromSessionId}', '${fromName}')" style="flex: 1; padding: 6px; background: rgba(100, 200, 100, 0.5); border: 1px solid #66cc66; color: #66ff66; border-radius: 4px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 11px; font-weight: bold;">Accepter</button>
      <button onclick="declineDungeonRequest('${fromSessionId}')" style="flex: 1; padding: 6px; background: rgba(200, 100, 100, 0.5); border: 1px solid #cc6666; color: #ff9999; border-radius: 4px; cursor: pointer; font-family: 'Cinzel', serif; font-size: 11px; font-weight: bold;">Refuser</button>
    </div>
  `;
  
  document.body.appendChild(notif);
  
  // Auto-remove après 30 secondes
  setTimeout(() => {
    if (notif.parentNode) notif.parentNode.removeChild(notif);
  }, 30000);
}

function acceptDungeonRequest(fromSessionId, fromName) {
  clearNotification('dungeon_req_' + fromSessionId);

  // Tracker l'acceptation de ce joueur
  if (!state.dungeonRequest) state.dungeonRequest = {};
  state.dungeonRequest.accepted = true;
  state.dungeonRequest.fromSessionId = fromSessionId;
  state.dungeonRequest.fromName = fromName;

  // Notifier l'autre joueur que tu as accepté
  if (window.multiState?.active) {
    wsSend('dungeon_accept', {
      fromSessionId,
      acceptorSessionId: window.multiState.sessionId,
      acceptorName: getMyName(),
    });
  }

  // Afficher un bouton "Entrer au donjon" au lieu d'y entrer immédiatement
  addLog(`✅ En route avec ${fromName}... Clic sur le portal pour entrer!`, 'success');

  // Afficher le UI du donjon qui peut être cliqué
  if (typeof showDungeonReadyUI === 'function') {
    showDungeonReadyUI(fromName);
  }
}

function declineDungeonRequest(fromSessionId) {
  clearNotification('dungeon_req_' + fromSessionId);
  state.dungeonRequest = null;
  
  if (window.multiState?.active) {
    wsSend('dungeon_decline', {
      fromSessionId,
      declineSessionId: window.multiState.sessionId,
      declineName: getMyName(),
    });
  }
  
  addLog('❌ Demande de donjon refusée', 'normal');
}

function clearNotification(notifId) {
  const el = document.getElementById(notifId);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ─── MENU CONTEXTUEL JOUEUR ──────────────────────────────────
function showPlayerContextMenu(sessionId, playerName, mouseX, mouseY) {
  // Fermer le menu précédent s'il existe
  const oldMenu = document.getElementById('player-context-menu');
  if (oldMenu) oldMenu.remove();
  
  const isInGroup = state.group.members.includes(sessionId);
  const isGroupMember = state.group.members.length > 0 && state.group.members[0] === sessionId;
  
  const menu = document.createElement('div');
  menu.id = 'player-context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${mouseY}px;
    left: ${mouseX}px;
    z-index: 402;
    background: rgba(20, 5, 30, 0.98);
    border: 2px solid #9b4dca;
    border-radius: 6px;
    padding: 0;
    color: #d4af37;
    font-family: 'Cinzel', serif;
    min-width: 180px;
    box-shadow: 0 4px 20px rgba(100, 20, 180, 0.5);
  `;
  
  const options = [
    { label: '👥 Inviter au groupe', action: 'inviteToGroup', show: !isInGroup },
    { label: '❌ Quitter le groupe', action: 'leaveGroup', show: isInGroup },
    { label: '🎁 Proposer un trade', action: 'openTradeWith', show: true },
    { label: '⚔️ Attaquer', action: 'attackPlayer', show: !isInGroup },
    { label: '👤 Suivre', action: 'followPlayer', show: true },
    { label: '🚫 Bloquer', action: 'blockPlayer', show: true },
  ];
  
  options.forEach(opt => {
    if (!opt.show) return;
    
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 10px 16px;
      cursor: pointer;
      border-bottom: 1px solid rgba(155, 77, 202, 0.2);
      transition: background 0.15s;
    `;
    item.textContent = opt.label;
    item.onmouseover = () => {
      item.style.background = 'rgba(155, 77, 202, 0.3)';
    };
    item.onmouseout = () => {
      item.style.background = 'transparent';
    };
    
    item.onclick = () => {
      menu.remove();
      
      switch (opt.action) {
        case 'inviteToGroup':
          inviteToGroup(sessionId, playerName);
          break;
        case 'leaveGroup':
          leaveGroup(sessionId, playerName);
          break;
        case 'openTradeWith':
          if (typeof openTradeWith === 'function') {
            openTradeWith(sessionId, playerName);
          }
          break;
        case 'attackPlayer':
          if (typeof attackPlayerPvP === 'function') {
            attackPlayerPvP(sessionId, playerName);
          }
          break;
        case 'followPlayer':
          if (typeof followPlayer === 'function') followPlayer(sessionId, playerName);
          break;
        case 'blockPlayer':
          addLog(`${playerName} a été bloqué`, 'normal');
          break;
      }
    };
    
    menu.appendChild(item);
  });
  
  // Ajouter un header avec le nom du joueur
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 10px 16px;
    border-bottom: 1px solid rgba(155, 77, 202, 0.4);
    font-weight: bold;
    font-size: 13px;
  `;
  header.textContent = playerName;
  menu.insertBefore(header, menu.firstChild);
  
  document.body.appendChild(menu);
  
  // Fermer le menu si on clique ailleurs
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (menu.parentNode && !menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 10);
}

// ─── SYSTÈME DE VOTE D'ENTRÉE AU DONJON ─────────────────────────
const DungeonVote = { active: false, initiatorId: null, accepted: {}, needed: 0 };

function initiateDungeonVote() {
  if (!window.multiState?.active || state.group.members.length === 0) return false;
  DungeonVote.active = true;
  DungeonVote.initiatorId = window.multiState.sessionId;
  DungeonVote.accepted = {};
  DungeonVote.needed = state.group.members.length;
  state.group.members.forEach(memberId => {
    const rp = window.multiState.remotePlayers[memberId];
    const name = rp ? rp.name : ('Joueur-' + String(memberId).slice(0,4));
    wsSend('dungeon_request', { fromSessionId: window.multiState.sessionId, fromName: getMyName(), targetSessionId: memberId, targetName: name, dungeonType: 'DONJON' });
  });
  addLog(`Vote donjon envoye (${DungeonVote.needed} joueur(s))...`, 'action');
  return true;
}

function registerDungeonAccept(acceptorSessionId, acceptorName) {
  if (!DungeonVote.active) return;
  DungeonVote.accepted[acceptorSessionId] = true;
  const count = Object.keys(DungeonVote.accepted).length;
  addLog(`${acceptorName} accepte! (${count}/${DungeonVote.needed})`, 'success');
  if (count >= DungeonVote.needed) {
    DungeonVote.active = false;
    showDungeonReadyUI('le groupe');
  }
}

function registerDungeonDecline(declineSessionId, declineName) {
  if (!DungeonVote.active) return;
  DungeonVote.active = false; DungeonVote.accepted = {};
  addLog(`${declineName} refuse. Vote annule.`, 'normal');
  const btn = document.getElementById('dungeon-ready-btn');
  if (btn) btn.remove();
}


function leaveGroup(sessionId, playerName) {
  const idx = state.group.members.indexOf(sessionId);
  if (idx > -1) state.group.members.splice(idx, 1);
  if (window.multiState?.active) {
    wsSend('group_leave', { targetSessionId: sessionId, leavingSessionId: window.multiState.sessionId, leavingName: getMyName() });
  }
  if (typeof renderGroupPlayers === 'function') renderGroupPlayers();
  addLog(`Vous avez quitte le groupe de ${playerName}`, 'normal');
}

function leaveMyGroup() {
  if (state.group.members.length === 0) return;
  if (window.multiState?.active) wsSend('group_leave_self', { leavingSessionId: window.multiState.sessionId, leavingName: getMyName() });
  state.group.members = [];
  if (typeof renderGroupPlayers === 'function') renderGroupPlayers();
  addLog('Vous avez quitte le groupe.', 'normal');
}

// ─── AFFICHAGE DES JOUEURS EN GROUPE ─────────────────────────
function renderGroupPlayers() {
  const groupPanel = document.getElementById('group-panel');
  const container = document.getElementById('group-players-list');
  
  if (!container) return;
  
  // Cacher le groupe si vide
  if (state.group.members.length === 0) {
    if (groupPanel) groupPanel.style.display = 'none';
    return;
  }
  
  // Afficher le groupe s'il y a des membres
  if (groupPanel) groupPanel.style.display = 'block';
  
  container.innerHTML = '';
  
  state.group.members.forEach(memberId => {
    const member = window.multiState.remotePlayers[memberId];
    if (!member) return;
    
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 8px 12px;
      background: rgba(155, 77, 202, 0.15);
      border: 1px solid rgba(155, 77, 202, 0.3);
      border-radius: 4px;
      margin-bottom: 6px;
      cursor: pointer;
      transition: background 0.15s;
    `;
    
    const cls = CLASSES[member.classId];
    const hpPercent = member.hpMax > 0 ? ((member.hp / member.hpMax) * 100).toFixed(0) : 0;
    
    item.innerHTML = `
      <div style="color: ${cls.color}; font-weight: bold; font-size: 12px;">${member.name}</div>
      <div style="color: #aaa; font-size: 11px;">${cls.name} · HP ${hpPercent}%</div>
    `;
    
    item.onmouseenter = () => {
      item.style.background = 'rgba(155, 77, 202, 0.3)';
    };
    item.onmouseout = () => {
      item.style.background = 'rgba(155, 77, 202, 0.15)';
    };
    
    item.onclick = () => {
      showPlayerContextMenu(memberId, member.name, event.clientX, event.clientY);
    };
    
    item.oncontextmenu = (e) => {
      e.preventDefault();
      showPlayerContextMenu(memberId, member.name, e.clientX, e.clientY);
    };
    
    container.appendChild(item);
  });
}

// ─── AFFICHER LE UI POUR ENTRER AU DONJON ──────────────
function showDungeonReadyUI(acceptorName) {
  let btn = document.getElementById('dungeon-ready-btn');
  if (!btn) {
    // Créer le bouton s'il n'existe pas
    btn = document.createElement('button');
    btn.id = 'dungeon-ready-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 400;
      padding: 16px 32px;
      background: linear-gradient(135deg, #9b4dca, #6b2ba8);
      border: 2px solid #d4af37;
      border-radius: 8px;
      color: #fff;
      font-family: 'Cinzel', serif;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      box-shadow: 0 4px 16px rgba(155, 77, 202, 0.6);
      transition: all 0.2s;
    `;
    btn.textContent = '⚿ ENTRER AU DONJON ⚿';
    btn.onmouseover = () => {
      btn.style.background = 'linear-gradient(135deg, #b965e0, #8b3bc5)';
      btn.style.transform = 'translateX(-50%) scale(1.05)';
    };
    btn.onmouseout = () => {
      btn.style.background = 'linear-gradient(135deg, #9b4dca, #6b2ba8)';
      btn.style.transform = 'translateX(-50%) scale(1)';
    };
    btn.onclick = () => {
      btn.remove();
      state.dungeonPartyReady = true;
      if (typeof enterDungeon === 'function') enterDungeon();
    };
    document.body.appendChild(btn);
  }

  // Afficher le nom de celui qui a accepté
  addLog(`⚿ ${acceptorName} est prêt! Cliquez le bouton pour entrer ensemble au donjon!`, 'action');
}