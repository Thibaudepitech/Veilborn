const express = require('express');
const { createServer } = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const PORT = process.env.PORT || 3000;

// ─── Express (HTTP) ───
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  const rooms = [...roomMap.entries()].map(([code, r]) => ({
    code,
    players: r.players.size,
    started: r.started,
  }));
  res.json({ status: 'ok', server: 'Veilborn WS Server', rooms });
});

const httpServer = createServer(app);

// ─── WebSocket ───
const wss = new WebSocket.Server({ server: httpServer });

// roomCode -> { host: ws, players: Map<ws, playerData>, started: bool }
const roomMap = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function send(ws, type, data = {}) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function broadcast(room, type, data = {}, except = null) {
  for (const [ws] of room.players) {
    if (ws !== except && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
    }
  }
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.sessionId = Math.random().toString(36).slice(2, 10);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { type } = msg;

    // ── CREATE ──────────────────────────────────────
    if (type === 'create') {
      let code = generateCode();
      // S'assurer que le code est unique
      while (roomMap.has(code)) code = generateCode();

      const room = {
        host: ws,
        players: new Map(),
        started: false,
      };

      // Ajouter l'hôte comme premier joueur
      room.players.set(ws, {
        sessionId: ws.sessionId,
        name: msg.name || `Hôte-${ws.sessionId.slice(0,4).toUpperCase()}`,
        classId: msg.classId,
        x: msg.x ?? 7, y: msg.y ?? 7,
        hp: msg.hp ?? 100, hpMax: msg.hpMax ?? 100,
      });

      roomMap.set(code, room);
      ws.roomCode = code;

      send(ws, 'created', { code, sessionId: ws.sessionId, isHost: true });
      console.log(`[${code}] Créée par ${ws.sessionId}`);
    }

    // ── JOIN ─────────────────────────────────────────
    else if (type === 'join') {
      const code = (msg.code || '').toUpperCase().trim();
      const room = roomMap.get(code);

      if (!room) {
        send(ws, 'error', { msg: `Room "${code}" introuvable. Vérifiez le code.` });
        return;
      }
      if (room.players.size >= 4) {
        send(ws, 'error', { msg: 'La room est pleine (4 joueurs max).' });
        return;
      }

      const pdata = {
        sessionId: ws.sessionId,
        name: msg.name || `Joueur-${ws.sessionId.slice(0,4).toUpperCase()}`,
        classId: msg.classId,
        x: msg.x ?? 7, y: msg.y ?? 7,
        hp: msg.hp ?? 100, hpMax: msg.hpMax ?? 100,
      };

      room.players.set(ws, pdata);
      ws.roomCode = code;

      // Dire au nouveau joueur qu'il est connecté
      send(ws, 'joined', { code, sessionId: ws.sessionId, isHost: false });

      // Envoyer au nouveau la liste des joueurs déjà présents
      for (const [, p] of room.players) {
        if (p.sessionId !== ws.sessionId) {
          send(ws, 'player_joined', p);
        }
      }

      // Dire aux autres qu'il arrive
      broadcast(room, 'player_joined', pdata, ws);

      console.log(`[${code}] ${pdata.name} a rejoint (${room.players.size} joueurs)`);
    }

    // ── GAME_START (hôte seulement) ──────────────────
    else if (type === 'game_start') {
      const room = roomMap.get(ws.roomCode);
      if (!room || room.host !== ws) return;
      room.started = true;
      broadcast(room, 'game_start', {});
      console.log(`[${ws.roomCode}] Partie lancée`);
    }

    // ── MOVE ────────────────────────────────────────
    else if (type === 'move') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const pdata = room.players.get(ws);
      if (pdata) { pdata.x = msg.x; pdata.y = msg.y; }
      broadcast(room, 'move', {
        sessionId: ws.sessionId,
        x: msg.x, y: msg.y,
        name: pdata?.name,
      }, ws);
    }

    // ── HP_UPDATE ────────────────────────────────────
    else if (type === 'hp_update') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const pdata = room.players.get(ws);
      if (pdata) { pdata.hp = msg.hp; pdata.hpMax = msg.hpMax; }
      broadcast(room, 'hp_update', {
        sessionId: ws.sessionId,
        hp: msg.hp, hpMax: msg.hpMax,
      }, ws);
    }

    // ── SKILL ────────────────────────────────────────
    else if (type === 'skill') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      broadcast(room, 'skill', {
        sessionId: ws.sessionId,
        skillId: msg.skillId,
        targetGx: msg.targetGx, targetGy: msg.targetGy,
        classId: msg.classId,
      }, ws);
    }

    // ── CLASS_CHANGE ─────────────────────────────────
    else if (type === 'class_change') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const pdata = room.players.get(ws);
      if (pdata) { pdata.classId = msg.classId; pdata.hp = msg.hp; pdata.hpMax = msg.hpMax; pdata.location = msg.location; }
      broadcast(room, 'class_change', {
        sessionId: ws.sessionId,
        classId: msg.classId,
        hp: msg.hp, hpMax: msg.hpMax,
        x: msg.x, y: msg.y, name: msg.name,
        location: msg.location,
      }, ws);
    }

    // ── CHAT ─────────────────────────────────────────
    else if (type === 'chat') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const pdata = room.players.get(ws);
      broadcast(room, 'chat', {
        sessionId: ws.sessionId,
        name: pdata?.name || 'Joueur',
        msg: msg.msg,
      });
    }

    // ── PING ─────────────────────────────────────────
    else if (type === 'ping') {
      send(ws, 'pong', { t: msg.t });
    }

    // ── GROUP INVITATIONS ────────────────────────────
    else if (type === 'group_invite') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const sender = room.players.get(ws);
      // Trouver le joueur cible par sessionId
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetSessionId) {
          send(targetWs, 'group_invite', {
            fromSessionId: ws.sessionId,
            fromName: sender?.name || 'Joueur',
            targetSessionId: msg.targetSessionId,
          });
          return;
        }
      }
    }

    else if (type === 'group_accept') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const acceptor = room.players.get(ws);
      // Envoyer au demandeur l'acceptation
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.fromSessionId) {
          send(targetWs, 'group_accept', {
            acceptorSessionId: ws.sessionId,
            acceptorName: acceptor?.name || 'Joueur',
            fromSessionId: msg.fromSessionId,
          });
          return;
        }
      }
    }

    else if (type === 'group_leave') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const leaver = room.players.get(ws);
      // Notifier les autres du départ
      broadcast(room, 'group_leave', {
        leavingSessionId: ws.sessionId,
        leavingName: leaver?.name || 'Joueur',
        targetSessionId: msg.targetSessionId,
      }, ws);
    }

    // ── DUNGEON REQUESTS ─────────────────────────────
    else if (type === 'dungeon_request') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const requester = room.players.get(ws);
      // Trouver le joueur cible
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetSessionId) {
          send(targetWs, 'dungeon_request', {
            fromSessionId: ws.sessionId,
            fromName: requester?.name || 'Joueur',
            targetSessionId: msg.targetSessionId,
            dungeonType: msg.dungeonType,
          });
          return;
        }
      }
    }

    else if (type === 'dungeon_accept') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const acceptor = room.players.get(ws);
      // Envoyer au demandeur l'acceptation
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.fromSessionId) {
          send(targetWs, 'dungeon_accept', {
            acceptorSessionId: ws.sessionId,
            acceptorName: acceptor?.name || 'Joueur',
            fromSessionId: msg.fromSessionId,
          });
          return;
        }
      }
    }

    else if (type === 'dungeon_decline') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const decliner = room.players.get(ws);
      // Envoyer au demandeur le refus
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.fromSessionId) {
          send(targetWs, 'dungeon_decline', {
            declineSessionId: ws.sessionId,
            declineName: decliner?.name || 'Joueur',
            fromSessionId: msg.fromSessionId,
          });
          return;
        }
      }
    }

    // ── TRADE REQUESTS ───────────────────────────────
    else if (type === 'trade_request') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const requester = room.players.get(ws);
      // Trouver le joueur cible
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetId) {
          send(targetWs, 'trade_request', {
            sessionId: ws.sessionId,
            name: requester?.name || 'Joueur',
            targetId: msg.targetId,
          });
          return;
        }
      }
    }

    else if (type === 'trade_accept') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const acceptor = room.players.get(ws);
      // Envoyer à l'autre joueur l'acceptation
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetId) {
          send(targetWs, 'trade_accept', {
            sessionId: ws.sessionId,
            name: acceptor?.name || 'Joueur',
            targetId: msg.targetId,
          });
          return;
        }
      }
    }

    else if (type === 'trade_decline') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      // Envoyer à l'autre joueur le refus
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetId) {
          send(targetWs, 'trade_decline', {
            sessionId: ws.sessionId,
            targetId: msg.targetId,
          });
          return;
        }
      }
    }

    else if (type === 'trade_offer') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      const sender = room.players.get(ws);
      // Envoyer l'offre à l'autre joueur
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetId) {
          send(targetWs, 'trade_offer', {
            fromSessionId: ws.sessionId,
            fromName: sender?.name || 'Joueur',
            targetId: msg.targetId,
            offer: msg.offer,
          });
          return;
        }
      }
    }

    else if (type === 'trade_confirm') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      // Envoyer la confirmation à l'autre joueur
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetId) {
          send(targetWs, 'trade_confirm', {
            fromSessionId: ws.sessionId,
            targetId: msg.targetId,
          });
          return;
        }
      }
    }

    else if (type === 'trade_cancel') {
      const room = roomMap.get(ws.roomCode);
      if (!room) return;
      // Envoyer l'annulation à l'autre joueur
      for (const [targetWs, targetData] of room.players) {
        if (targetData.sessionId === msg.targetId) {
          send(targetWs, 'trade_cancel', {
            fromSessionId: ws.sessionId,
            targetId: msg.targetId,
          });
          return;
        }
      }
    }
  });

  ws.on('close', () => {
    const code = ws.roomCode;
    if (!code) return;
    const room = roomMap.get(code);
    if (!room) return;

    const pdata = room.players.get(ws);
    room.players.delete(ws);

    if (pdata) {
      broadcast(room, 'player_left', { sessionId: ws.sessionId, name: pdata.name });
      console.log(`[${code}] ${pdata.name} déconnecté (${room.players.size} restants)`);
    }

    // Si plus personne → supprimer la room
    if (room.players.size === 0) {
      roomMap.delete(code);
      console.log(`[${code}] Room supprimée`);
      return;
    }

    // Si l'hôte quitte → transférer au prochain joueur
    if (room.host === ws) {
      const [newHostWs, newHostData] = room.players.entries().next().value;
      room.host = newHostWs;
      send(newHostWs, 'promoted_host', {});
      console.log(`[${code}] Nouvel hôte: ${newHostData.name}`);
    }
  });

  ws.on('error', (err) => console.error(`WS error ${ws.sessionId}:`, err.message));
});

httpServer.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log(`  ║  Veilborn WS Server — port ${PORT}       ║`);
  console.log(`  ║  http://localhost:${PORT}                ║`);
  console.log('  ╚═══════════════════════════════════════╝');
  console.log('');
});

process.on('uncaughtException', (err) => {
  console.error('ERREUR:', err.message);
});