const { Room } = require('colyseus');

class VeilbornRoom extends Room {
  onCreate(options) {
    this.maxClients = 4;
    this.roomName = options.roomName || 'default';
    this.gameStarted = false;

    console.log(`[Room ${this.roomId}] créée — roomName: ${this.roomName}`);

    // ─── Messages entrants ───
    this.onMessage('player_update', (client, data) => {
      // Un joueur envoie sa position/HP/classe
      this.broadcast('player_update', {
        sessionId: client.sessionId,
        x: data.x,
        y: data.y,
        hp: data.hp,
        hpMax: data.hpMax,
        classId: data.classId,
        name: data.name,
      }, { except: client });
    });

    this.onMessage('move', (client, data) => {
      this.broadcast('move', {
        sessionId: client.sessionId,
        x: data.x,
        y: data.y,
        name: data.name,
      }, { except: client });
    });

    this.onMessage('skill', (client, data) => {
      this.broadcast('skill', {
        sessionId: client.sessionId,
        skillId: data.skillId,
        targetGx: data.targetGx,
        targetGy: data.targetGy,
        classId: data.classId,
      }, { except: client });
    });

    this.onMessage('class_change', (client, data) => {
      this.broadcast('class_change', {
        sessionId: client.sessionId,
        classId: data.classId,
        hp: data.hp,
        hpMax: data.hpMax,
        x: data.x,
        y: data.y,
        name: data.name,
      }, { except: client });
    });

    this.onMessage('chat', (client, data) => {
      this.broadcast('chat', {
        sessionId: client.sessionId,
        name: data.name,
        msg: data.msg,
      });
    });

    this.onMessage('game_start', (client, data) => {
      // Seul le host (premier connecté) peut lancer
      if (client.sessionId === this.hostSessionId) {
        this.gameStarted = true;
        this.broadcast('game_start', {});
        console.log(`[Room ${this.roomId}] Partie lancée par l'hôte`);
      }
    });

    this.onMessage('hp_update', (client, data) => {
      this.broadcast('hp_update', {
        sessionId: client.sessionId,
        hp: data.hp,
        hpMax: data.hpMax,
      }, { except: client });
    });

    this.onMessage('ping', (client, data) => {
      client.send('pong', { t: data.t });
    });

    this.onMessage('pvp_attack', (client, data) => {
      // Relayer l'attaque PvP à la cible
      const attacker = this.playerData?.[client.sessionId];
      const attackerName = attacker?.name || `Joueur-${client.sessionId.slice(0,4)}`;
      const target = this.clients.find(c => c.sessionId === data.targetSessionId);
      if (target) {
        target.send('pvp_attack', {
          sessionId: client.sessionId,
          attackerName,
          dmg: data.dmg,
        });
      }
    });

    this.onMessage('dungeon_ready', (client, data) => {
      this.broadcast('dungeon_ready', {
        sessionId: client.sessionId,
        ready: data.ready,
      }, { except: client });
    });

    this.onMessage('dungeon_at_portal', (client, data) => {
      // Broadcaster à tout le monde sauf l'émetteur
      this.broadcast('dungeon_at_portal', {
        sessionId: client.sessionId,
        name: data.name,
      }, { except: client });
    });

    this.onMessage('dungeon_left_portal', (client, data) => {
      this.broadcast('dungeon_left_portal', {
        sessionId: client.sessionId,
      }, { except: client });
    });

    this.onMessage('dungeon_player_ready', (client, data) => {
      // Répondre au joueur ciblé (celui au portail)
      const target = this.clients.find(c => c.sessionId === data.targetSessionId);
      if (target) {
        target.send('dungeon_player_ready', {
          sessionId: client.sessionId,
          ready: data.ready,
        });
      }
    });

    this.onMessage('dungeon_start', (client, data) => {
      this.broadcast('dungeon_start', {
        sessionId: client.sessionId,
        readySessions: data.readySessions || [],
      });
    });

    this.onMessage('dungeon_exit', (client, data) => {
      this.broadcast('dungeon_exit', {
        sessionId: client.sessionId,
      }, { except: client });
    });
  }

  onJoin(client, options) {
    // Le premier joueur à rejoindre est l'hôte
    if (!this.hostSessionId) {
      this.hostSessionId = client.sessionId;
      console.log(`[Room ${this.roomId}] Hôte: ${client.sessionId}`);
    }

    console.log(`[Room ${this.roomId}] Joueur connecté: ${client.sessionId}`);

    // Informer le nouveau joueur de son statut
    client.send('welcome', {
      sessionId: client.sessionId,
      isHost: client.sessionId === this.hostSessionId,
      playerCount: this.clients.length,
      gameStarted: this.gameStarted,
    });

    // Informer les autres de l'arrivée
    this.broadcast('player_joined', {
      sessionId: client.sessionId,
      name: options.name || `Joueur-${client.sessionId.slice(0, 4)}`,
      classId: options.classId,
      x: options.x || 7,
      y: options.y || 7,
      hp: options.hp || 100,
      hpMax: options.hpMax || 100,
    }, { except: client });

    // Envoyer au nouveau joueur la liste des joueurs déjà présents
    // (stockée dans la room)
    if (this.playerData) {
      for (const [sid, pdata] of Object.entries(this.playerData)) {
        client.send('player_joined', { sessionId: sid, ...pdata });
      }
    }

    // Mémoriser les données du joueur
    if (!this.playerData) this.playerData = {};
    this.playerData[client.sessionId] = {
      name: options.name || `Joueur-${client.sessionId.slice(0, 4)}`,
      classId: options.classId,
      x: options.x || 7,
      y: options.y || 7,
      hp: options.hp || 100,
      hpMax: options.hpMax || 100,
    };
  }

  onLeave(client, consented) {
    console.log(`[Room ${this.roomId}] Joueur déconnecté: ${client.sessionId}`);

    // Supprimer les données du joueur
    if (this.playerData) delete this.playerData[client.sessionId];

    // Si l'hôte quitte, le prochain joueur devient hôte
    if (client.sessionId === this.hostSessionId) {
      const remaining = this.clients.filter(c => c.sessionId !== client.sessionId);
      if (remaining.length > 0) {
        this.hostSessionId = remaining[0].sessionId;
        remaining[0].send('promoted_host', {});
        console.log(`[Room ${this.roomId}] Nouvel hôte: ${this.hostSessionId}`);
      } else {
        this.hostSessionId = null;
      }
    }

    this.broadcast('player_left', { sessionId: client.sessionId });
  }

  onDispose() {
    console.log(`[Room ${this.roomId}] Détruite`);
  }
}

module.exports = { VeilbornRoom };