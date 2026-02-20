// ═══════════════════════════════════════════════════════
// DONJON DES FRACTURES — 3 salles + salle boss
// Portail d'entrée → Salle 1 → Salle 2 → Salle 3 → Boss
// Ennemis qui scalent avec level + nombre de joueurs
// ═══════════════════════════════════════════════════════

// ─── PORTAIL DONJON (sur la carte principale) ───────────
// On réutilise le même portail que le boss (PORTAL_GX, PORTAL_GY)
// mais il mène maintenant au donjon

// ─── ÉTAT DONJON ────────────────────────────────────────
// dungeonState est déclaré globalement dans engine.js (var dungeonState = null)

// ─── CONFIGS DES SALLES ─────────────────────────────────
const DUNGEON_ROOMS = [
  {
    id: 1,
    name: 'Antichambre de la Fracture',
    subtitle: 'Les vestiges remuent...',
    accentColor: '#9b4dca',
    enemyGroups: (level, playerCount) => spawnRoomEnemies(1, level, playerCount),
    terrain: buildRoom1Terrain,
  },
  {
    id: 2,
    name: 'Crypte des Revenants',
    subtitle: 'Ils n\'ont jamais oublié...',
    accentColor: '#e74c3c',
    enemyGroups: (level, playerCount) => spawnRoomEnemies(2, level, playerCount),
    terrain: buildRoom2Terrain,
  },
  {
    id: 3,
    name: 'Forges du Voile',
    subtitle: 'La chaleur du Voile vous consume...',
    accentColor: '#e67e22',
    enemyGroups: (level, playerCount) => spawnRoomEnemies(3, level, playerCount),
    terrain: buildRoom3Terrain,
  },
];

// ─── CALCUL DU SCALING ──────────────────────────────────
function getDungeonScaling(roomId) {
  const level = state.talents?.level || 1;
  const playerCount = window.multiState?.active
    ? Object.keys(multiState.remotePlayers || {}).length + 1 : 1;

  // Base stats scalent avec le niveau
  const lvlMult = 1 + (level - 1) * 0.12;  // +12% par niveau
  const playerMult = 1 + (playerCount - 1) * 0.7; // +70% par joueur supp
  const roomMult = 1 + (roomId - 1) * 0.35; // +35% par salle

  return {
    level,
    playerCount,
    hpMult: lvlMult * playerMult * roomMult,
    dmgMult: lvlMult * playerMult * roomMult * 0.8,
    armorBonus: Math.floor((level - 1) * 2 + (roomId - 1) * 5),
    enemyCount: Math.floor(2 + (playerCount - 1) * 1.5 + roomId * 0.5),
    xpReward: Math.floor(60 * lvlMult * roomMult),
  };
}

// ─── GÉNÉRATION DES ENNEMIS ─────────────────────────────
function spawnRoomEnemies(roomId, level, playerCount) {
  const sc = getDungeonScaling(roomId);
  const enemies = [];

  // Types et positions selon la salle
  const roomConfigs = {
    1: {
      types: [
        { type:'fracture', name:'Fracturé sauvage',  hp:180, armor:12, positions:[[3,4],[5,6],[9,4],[11,6]] },
        { type:'revenant', name:'Éclat vivant',       hp:120, armor:8,  positions:[[7,5]] },
      ]
    },
    2: {
      types: [
        { type:'gloom',   name:'Revenant boisé',     hp:250, armor:18, positions:[[3,4],[5,4],[9,4],[11,4]] },
        { type:'fracture', name:'Gardien de crypte',  hp:300, armor:22, positions:[[7,3]] },
        { type:'revenant', name:'Spectre ancien',     hp:150, armor:10, positions:[[4,7],[10,7]] },
      ]
    },
    3: {
      types: [
        { type:'arcane',  name:'Construct forgé',    hp:320, armor:28, positions:[[4,4],[8,4],[11,4]] },
        { type:'fracture', name:'Gardien de forge',  hp:280, armor:20, positions:[[6,6],[10,6]] },
        { type:'arcane',  name:'Sentinelle de Voile',hp:200, armor:25, positions:[[3,8],[12,8]] },
      ]
    }
  };

  const cfg = roomConfigs[roomId];
  let eid = 0;
  cfg.types.forEach(group => {
    group.positions.forEach(([gx, gy]) => {
      enemies.push({
        id: `dungeon_r${roomId}_e${eid++}`,
        gridX: gx, gridY: gy,
        hp: Math.round(group.hp * sc.hpMult),
        maxHp: Math.round(group.hp * sc.hpMult),
        armor: group.armor + sc.armorBonus,
        type: group.type,
        alive: true,
        name: group.name,
        debuffs: {},
        // Attributs IA basiques
        _aiTimer: Date.now() + 1000 + Math.random() * 1000,
        _aiRange: 5,
        _dmgBase: Math.round(25 * sc.dmgMult),
        _dmgRange: Math.round(15 * sc.dmgMult),
        isDungeonEnemy: true,
      });
    });
  });

  return enemies;
}

// ─── TERRAINS DES SALLES ────────────────────────────────
function buildBasicRoomTerrain() {
  const t = {};
  // Murs sur les bords
  for (let i = 0; i < GRID_SIZE; i++) {
    t[`${i},0`] = 'blocked'; t[`${i},15`] = 'blocked';
    t[`0,${i}`] = 'blocked'; t[`15,${i}`] = 'blocked';
  }
  return t;
}

function buildRoom1Terrain() {
  const t = buildBasicRoomTerrain();
  // Piliers
  [[3,3],[3,4],[4,3],[11,3],[12,3],[12,4],[3,11],[4,12],[3,12],[11,12],[12,11],[12,12]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'blocked';
  });
  // Cases de Voile
  [[7,7],[8,7],[7,8],[8,8]].forEach(([x,y]) => { t[`${x},${y}`] = 'veil'; });
  // Passage vers salle suivante (bas)
  // Cases libres à (7,14) et (8,14)
  return t;
}

function buildRoom2Terrain() {
  const t = buildBasicRoomTerrain();
  // Colonnes brisées
  [[2,5],[2,6],[13,5],[13,6],[2,9],[2,10],[13,9],[13,10]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'blocked';
  });
  // Mur central avec passage
  for (let x = 1; x <= 6; x++) t[`${x},7`] = 'blocked';
  for (let x = 9; x <= 14; x++) t[`${x},7`] = 'blocked';
  // Cases de Voile
  [[5,4],[6,4],[9,4],[10,4],[7,10],[8,10]].forEach(([x,y]) => { t[`${x},${y}`] = 'veil'; });
  return t;
}

function buildRoom3Terrain() {
  const t = buildBasicRoomTerrain();
  // Forges (cases bloquées en croix)
  [[4,3],[5,3],[4,4],[11,3],[10,3],[11,4],[4,11],[5,12],[4,12],[11,12],[10,12],[11,11]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'blocked';
  });
  // Cases de Voile — sol en feu
  [[5,6],[6,6],[7,6],[8,6],[9,6],[6,9],[7,9],[8,9],[9,9],[5,9]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'veil';
  });
  return t;
}

// ─── ENTRER DANS LE DONJON ──────────────────────────────
function enterDungeon() {
  if (dungeonState?.active) return;
  if (bossRoom?.active) return;

  // En groupe: demander accord de tous les membres
  if (window.multiState?.active && state.group?.members.length > 0 && !state.dungeonPartyReady) {
    const _groupIds = state.group.members.slice();
    state.dungeonPendingAccepts = _groupIds.length;
    state.dungeonAcceptedCount = 0;

    _groupIds.forEach(memberId => {
      const member = window.multiState.remotePlayers[memberId];
      const name = member ? member.name : ('Joueur-' + String(memberId).slice(0, 4));
      wsSend('dungeon_request', {
        fromSessionId: window.multiState.sessionId,
        fromName: typeof getMyName === 'function' ? getMyName() : 'Joueur',
        targetSessionId: memberId,
        targetName: name,
        dungeonType: 'DONJON',
      });
    });

    addLog("Demande envoyee au groupe...", "normal");
    return;
  }
  // Reinitialiser le flag apres utilisation
  state.dungeonPartyReady = false;

  addLog('⚿ Le portail vous aspire dans les profondeurs du donjon...', 'action');
  spawnFloater(state.player.gridX, state.player.gridY, '⚿ DONJON', '#9b4dca', 16);

  // Marquer le joueur comme étant dans le donjon
  state.player.location = 'dungeon';
  if (window.multiState?.broadcastLocation) window.multiState.broadcastLocation();

  dungeonState = {
    active: true,
    currentRoom: 0, // 0 = pas encore entré, 1/2/3 = salles, 4 = boss
    savedPlayerX: state.player.gridX,
    savedPlayerY: state.player.gridY,
    savedEnemies: [...state.enemies],
    savedTerrain: { ...state.terrain },
    roomsCleared: [],
    aiInterval: null,
  };

  // Lancer l'IA des ennemis du donjon
  dungeonState.aiInterval = setInterval(tickDungeonAI, 800);

  setTimeout(() => enterDungeonRoom(1), 400);
}

// ─── ENTRER DANS UNE SALLE ──────────────────────────────
function enterDungeonRoom(roomId) {
  if (!dungeonState?.active) return;
  // Déléguer aux runs aléatoires
  if (dungeonState.isRandomRun && typeof enterRandomRoom === 'function') {
    enterRandomRoom(roomId - 1);
    return;
  }

  dungeonState.currentRoom = roomId;

  if (roomId > 3) {
    // Salle boss du donjon
    enterDungeonBossRoom();
    return;
  }

  const roomCfg = DUNGEON_ROOMS[roomId - 1];
  const sc = getDungeonScaling(roomId);

  // Téléporter joueur à l'entrée de la salle
  state.player.gridX = 7;
  state.player.gridY = 13;
  state.player.path = [];
  state.player.moving = false;
  initPlayerPixelPos();

  // Nouveau terrain
  state.terrain = roomCfg.terrain();

  // Nouveaux ennemis
  state.enemies = roomCfg.enemyGroups(sc.level, sc.playerCount);

  // HUD donjon
  showDungeonUI(roomId, 3);

  addLog(`⚔ Salle ${roomId}/3 — ${roomCfg.name}`, 'action');
  addLog(roomCfg.subtitle, 'normal');
  addLog(`Ennemis: ${state.enemies.length} · Niveau ~${sc.level} · ${sc.playerCount} joueur(s)`, 'normal');
}

// ─── SALLE BOSS DU DONJON ───────────────────────────────
function enterDungeonBossRoom() {
  if (!dungeonState?.active) return;

  dungeonState.currentRoom = 4;

  addLog('☠ Vous pénétrez dans la salle du boss... Le sol tremble.', 'action');
  spawnFloater(7, 7, '☠ BOSS', '#c8a96e', 20);

  // Téléporter
  state.player.gridX = 7;
  state.player.gridY = 13;
  state.player.path = [];
  state.player.moving = false;
  initPlayerPixelPos();

  // Terrain boss spécial
  buildDungeonBossTerrain();

  // Spawner le boss du donjon — L'Écho des Fractures
  spawnDungeonBoss();

  showDungeonBossUI();
}

function buildDungeonBossTerrain() {
  const t = buildBasicRoomTerrain();
  // Piliers des 4 coins
  [[2,2],[3,2],[2,3],[12,2],[13,2],[13,3],[2,12],[3,13],[2,13],[12,12],[13,12],[12,13]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'blocked';
  });
  // Cases de Voile centrales (rituel)
  [[6,6],[7,6],[8,6],[9,6],[6,7],[9,7],[6,8],[9,8],[6,9],[7,9],[8,9],[9,9]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'veil';
  });
  state.terrain = t;
}

function spawnDungeonBoss() {
  const level = state.talents?.level || 1;
  const playerCount = window.multiState?.active
    ? Object.keys(multiState.remotePlayers || {}).length + 1 : 1;
  const lvlMult = 1 + (level - 1) * 0.15;
  const playerMult = 1 + (playerCount - 1) * 0.8;

  const bossHp = Math.round(1800 * lvlMult * playerMult);
  const bossArmor = 35 + Math.floor(level * 2);

  dungeonState.boss = {
    alive: true,
    gridX: 7, gridY: 4,
    hp: bossHp, hpMax: bossHp,
    armor: bossArmor,
    phase: 1,
    level, playerCount,
    attackTimer: Date.now() + 2000,
    attackInterval: 3500 - Math.min(level * 50, 1500),
    sweepTimer: Date.now() + 5000,
    sweepInterval: 7000,
    spawnTimer: Date.now() + 8000,
    spawnInterval: 12000,
  };

  state.enemies = [];

  // Boss entity
  state.enemies.push({
    id: 'dungeon_boss',
    gridX: 7, gridY: 4,
    hp: bossHp, maxHp: bossHp,
    armor: bossArmor,
    type: 'arcane', alive: true,
    name: `L'Écho des Fractures ★★★★ (Niv.${level})`,
    debuffs: {}, isBoss: true, isDungeonBoss: true,
  });

  state.terrain[`7,4`] = 'blocked';

  // Adds initiaux
  spawnDungeonBossAdds(playerCount);

  // Tick boss
  dungeonState.bossTickInterval = setInterval(tickDungeonBoss, 200);
}

function spawnDungeonBossAdds(playerCount) {
  if (!dungeonState?.boss?.alive) return;
  const level = dungeonState.boss.level;
  const addHp = Math.round(300 * (1 + (level-1) * 0.1));
  const addArmor = 15 + Math.floor(level * 1.5);

  const addPositions = playerCount <= 2
    ? [[4,7],[10,7]]
    : [[4,7],[10,7],[4,10],[10,10]];

  addPositions.forEach((pos, i) => {
    if (!state.enemies.find(e => e.gridX === pos[0] && e.gridY === pos[1] && e.alive)) {
      state.enemies.push({
        id: `dungeon_boss_add_${Date.now()}_${i}`,
        gridX: pos[0], gridY: pos[1],
        hp: addHp, maxHp: addHp,
        armor: addArmor,
        type: 'fracture', alive: true,
        name: 'Fragment du Voile',
        debuffs: {}, isDungeonEnemy: true,
        _aiTimer: Date.now() + 1000,
        _aiRange: 4,
        _dmgBase: Math.round(20 * (1 + (level-1) * 0.1)),
        _dmgRange: 10,
      });
    }
  });
  addLog(`⚠ ${addPositions.length} Fragments du Voile invoqués!`, 'normal');
}

// ─── IA DES ENNEMIS DU DONJON ───────────────────────────
function tickDungeonAI() {
  if (!dungeonState?.active) return;
  if (state.showSkillTree || state.showTalentTree) return;

  const now = Date.now();
  const px = state.player.gridX, py = state.player.gridY;

  state.enemies.forEach(enemy => {
    if (!enemy.alive || !enemy.isDungeonEnemy || enemy.isBoss) return;
    if (!enemy._aiTimer || now < enemy._aiTimer) return;

    enemy._aiTimer = now + 800 + Math.random() * 400;

    const dist = Math.abs(enemy.gridX - px) + Math.abs(enemy.gridY - py);

    // Attaquer si adjacent
    if (dist <= 1) {
      const dmg = enemy._dmgBase + Math.floor(Math.random() * enemy._dmgRange);
      const reducedDmg = calcDamage(dmg, state.armor);
      state.hp = Math.max(1, state.hp - reducedDmg);
      updateHpUI();
      spawnFloater(px, py, `-${reducedDmg}`, '#e74c3c', 13);
      addLog(`${enemy.name} → vous attaque! −${reducedDmg} PV`, 'normal');

      // Multijoueur: broadcast HP
      if (window.multiState?.broadcastHp) multiState.broadcastHp();
      return;
    }

    // Se déplacer vers le joueur si à portée IA
    if (dist <= enemy._aiRange) {
      // Pas simple vers joueur
      const dx = Math.sign(px - enemy.gridX);
      const dy = Math.sign(py - enemy.gridY);
      const moves = [];
      if (dx !== 0) moves.push([dx, 0]);
      if (dy !== 0) moves.push([0, dy]);
      // Mélanger un peu pour éviter que tous bougent pareil
      moves.sort(() => Math.random() - 0.5);

      for (const [mx, my] of moves) {
        const nx = enemy.gridX + mx, ny = enemy.gridY + my;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        if (state.terrain[`${nx},${ny}`] === 'blocked') continue;
        if (state.enemies.some(e => e.alive && e !== enemy && e.gridX === nx && e.gridY === ny)) continue;
        if (nx === px && ny === py) continue; // Pas sur le joueur
        enemy.gridX = nx;
        enemy.gridY = ny;
        break;
      }
    }
  });

  // Vérifier si tous les ennemis de la salle courante sont morts
  checkRoomClear();
}

// ─── BOSS DU DONJON TICK ────────────────────────────────
function tickDungeonBoss() {
  if (!dungeonState?.active || dungeonState.currentRoom !== 4) return;
  if (!dungeonState.boss?.alive) return;

  const bossEnemy = state.enemies.find(e => e.id === 'dungeon_boss');
  if (!bossEnemy || !bossEnemy.alive) {
    dungeonVictory();
    return;
  }

  // Sync état boss
  dungeonState.boss.hp = bossEnemy.hp;
  const hpPct = bossEnemy.hp / bossEnemy.maxHp;

  // Phases
  const newPhase = hpPct > 0.6 ? 1 : hpPct > 0.3 ? 2 : 3;
  if (newPhase !== dungeonState.boss.phase) {
    dungeonState.boss.phase = newPhase;
    if (newPhase === 2) {
      if (typeof AudioEngine !== 'undefined') { AudioEngine.play.bossPhase(); AudioEngine.playMusic('boss'); }
      addLog('⚡ Phase 2 — Le boss accélère! De nouveaux fragments apparaissent!', 'action');
      spawnDungeonBossAdds(dungeonState.boss.playerCount);
      dungeonState.boss.attackInterval = Math.max(1500, dungeonState.boss.attackInterval - 800);
    }
    if (newPhase === 3) {
      if (typeof AudioEngine !== 'undefined') AudioEngine.play.bossPhase();
      addLog('☠ Phase 3 — RAGE FINALE! Évitez les balayages!', 'action');
      spawnDungeonBossAdds(dungeonState.boss.playerCount);
      dungeonState.boss.attackInterval = Math.max(1000, dungeonState.boss.attackInterval - 500);
      dungeonState.boss.sweepInterval = 4500;
    }
    updateDungeonBossHUD();
  }

  const now = Date.now();
  const px = state.player.gridX, py = state.player.gridY;
  const dist = Math.abs(dungeonState.boss.gridX - px) + Math.abs(dungeonState.boss.gridY - py);

  // Attaque directe si proche
  if (now > dungeonState.boss.attackTimer && dist <= 3) {
    dungeonState.boss.attackTimer = now + dungeonState.boss.attackInterval;
    const lvlMult = 1 + (dungeonState.boss.level - 1) * 0.1;
    const dmg = Math.round((40 + Math.random() * 30) * lvlMult * (dungeonState.boss.phase * 0.3 + 0.7));
    const reducedDmg = calcDamage(dmg, state.armor);
    state.hp = Math.max(1, state.hp - reducedDmg);
    updateHpUI();
    spawnFloater(px, py, `-${reducedDmg}☠`, '#9b4dca', 15);
    addLog(`L'Écho des Fractures → vous frappe! −${reducedDmg} PV`, 'normal');
    if (window.multiState?.broadcastHp) multiState.broadcastHp();
  }

  // Balayage AoE (telegraph)
  if (now > dungeonState.boss.sweepTimer) {
    dungeonState.boss.sweepTimer = now + dungeonState.boss.sweepInterval;
    executeBossSweep();
  }

  // Spawn d'adds (phase 2+)
  if (dungeonState.boss.phase >= 2 && now > dungeonState.boss.spawnTimer) {
    dungeonState.boss.spawnTimer = now + dungeonState.boss.spawnInterval;
    spawnDungeonBossAdds(1); // 1 add par spawn en phase avancée
  }

  updateDungeonBossHUD();
}

function executeBossSweep() {
  if (!dungeonState?.boss) return;
  const bx = dungeonState.boss.gridX, by = dungeonState.boss.gridY;
  const radius = dungeonState.boss.phase + 1;

  // Telegraph
  const cells = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius) {
        const nx = bx + dx, ny = by + dy;
        if (nx > 0 && ny > 0 && nx < 15 && ny < 15) cells.push({x:nx, y:ny});
      }
    }

  state.highlight = { type:'telegraph', cells, expireAt: Date.now() + 2500 };
  addLog(`⚡ Balayage fracturé (rayon ${radius})! Fuyez!`, 'normal');

  setTimeout(() => {
    if (!dungeonState?.active) return;
    const lvlMult = 1 + (dungeonState.boss?.level - 1) * 0.1;
    cells.forEach(c => {
      if (c.x === state.player.gridX && c.y === state.player.gridY) {
        const dmg = Math.round((50 + Math.random() * 50) * lvlMult);
        const reducedDmg = calcDamage(dmg, state.armor);
        state.hp = Math.max(1, state.hp - reducedDmg);
        updateHpUI();
        spawnFloater(c.x, c.y, `-${reducedDmg}⚡`, '#9b4dca', 14);
        addLog(`⚡ Balayage! −${reducedDmg} PV`, 'normal');
      }
    });
  }, 1200);
}

// ─── CHECK ROOM CLEAR ───────────────────────────────────
function checkRoomClear() {
  if (!dungeonState?.active) return;
  if (dungeonState.isRandom) return; // géré par dungeon_random.js
  if (dungeonState.currentRoom === 4) return; // boss géré séparément

  const aliveEnemies = state.enemies.filter(e => e.alive && !e.isDummy);
  if (aliveEnemies.length > 0) return;

  const roomId = dungeonState.currentRoom;
  if (dungeonState.roomsCleared.includes(roomId)) return;
  dungeonState.roomsCleared.push(roomId);

  const sc = getDungeonScaling(roomId);

  addLog(`✦ Salle ${roomId}/3 libérée! +${sc.xpReward} XP`, 'action');
  spawnFloater(state.player.gridX, state.player.gridY, `✦ SALLE ${roomId} LIBÉRÉE`, '#c8a96e', 16);

  if (typeof gainXP === 'function') gainXP(sc.xpReward);
  if (typeof gainEclats === 'function' && roomId === 3) gainEclats(1);

  // Afficher la porte vers la prochaine salle
  setTimeout(() => {
    if (!dungeonState?.active) return;

    if (roomId < 3) {
      addLog(`→ Approchez le bas de la salle pour passer à la Salle ${roomId + 1}...`, 'normal');
      dungeonState.doorOpen = true;
      dungeonState.doorTarget = roomId + 1;
    } else {
      addLog('☠ Le chemin vers le Boss s\'ouvre...', 'action');
      dungeonState.doorOpen = true;
      dungeonState.doorTarget = 4;
    }

    // Afficher une signalisation sur la grille
    showDungeonTransition(roomId);
  }, 800);
}

function showDungeonTransition(clearedRoom) {
  const nextLabel = clearedRoom < 3 ? `Salle ${clearedRoom + 1}` : 'BOSS';
  addLog(`⚿ Entrez dans le portail (case 7,14) pour accéder à: ${nextLabel}`, 'action');
}

// ─── DÉTECTION MARCHE SUR CASE TRANSITION ───────────────
function checkDungeonTransition(gx, gy) {
  if (!dungeonState?.active) return;
  // Vérifier coffre
  if (typeof checkChestInteraction === 'function') checkChestInteraction(gx, gy);
  if (!dungeonState.doorOpen) return;
  // Case de transition = bas de la salle (y=14, x=7 ou 8)
  if (gy === 14 && (gx === 7 || gx === 8)) {
    dungeonState.doorOpen = false;
    const target = dungeonState.doorTarget;
    addLog(`⚿ Vous passez dans la prochaine zone...`, 'action');
    setTimeout(() => enterDungeonRoom(target), 300);
  }
}

// ─── VICTOIRE DONJON ────────────────────────────────────
function dungeonVictory() {
  if (!dungeonState?.active) return;

  if (dungeonState.bossTickInterval) clearInterval(dungeonState.bossTickInterval);
  if (dungeonState.aiInterval) clearInterval(dungeonState.aiInterval);

  const level = state.talents?.level || 1;
  const playerCount = dungeonState.boss?.playerCount || 1;
  const xpReward = Math.round(500 * (1 + (level - 1) * 0.15));
  const eclatsReward = 2 + Math.floor(level / 5);

  if (typeof AudioEngine !== 'undefined') { AudioEngine.play.victory(); AudioEngine.playMusic('overworld'); }
  addLog('✦ L\'Écho des Fractures est vaincu! Gloire à vous!', 'action');
  spawnFloater(state.player.gridX, state.player.gridY, '✦ BOSS VAINCU ✦', '#f1c40f', 22);

  if (typeof gainXP === 'function') gainXP(xpReward);
  if (typeof gainEclats === 'function') gainEclats(eclatsReward);

  addLog(`✦ Récompenses: +${xpReward} XP · +${eclatsReward} Éclats de Voile!`, 'action');

  hideDungeonUI();

  setTimeout(() => exitDungeon(true), 1500);
}

// ─── QUITTER LE DONJON ──────────────────────────────────
function exitDungeon(victory) {
  if (!dungeonState?.active) return;

  if (dungeonState.bossTickInterval) clearInterval(dungeonState.bossTickInterval);
  if (dungeonState.aiInterval) clearInterval(dungeonState.aiInterval);

  // Restaurer le monde principal
  state.enemies = dungeonState.savedEnemies;
  state.terrain = dungeonState.savedTerrain;
  state.player.gridX = dungeonState.savedPlayerX;
  state.player.gridY = dungeonState.savedPlayerY;
  state.player.path = [];
  state.player.moving = false;
  state.player.t = 1;
  initPlayerPixelPos();

  // Marquer le joueur comme étant dans l'overworld
  state.player.location = 'overworld';
  if (window.multiState?.broadcastLocation) window.multiState.broadcastLocation();

  state.highlight = { type:null, cells:[] };
  // FIX: annuler le ciblage si actif lors de la sortie du donjon
  // (évite que state.targeting.active reste true et bloque les attaques)
  if (state.targeting.active) {
    state.targeting.active = false;
    state.targeting.skillIdx = null;
    state.targeting.previewCells = [];
    const ti = document.getElementById('targeting-indicator');
    if (ti) ti.style.display = 'none';
  }
  dungeonState = null;

  hideDungeonUI();

  if (!victory) {
    addLog('Vous avez fui le donjon.', 'normal');
  } else {
    addLog('✦ Vous retournez dans le monde, victorieux.', 'action');
  }
}

// ─── FUIR LE DONJON ─────────────────────────────────────
function tryFleeOrFleeDungeon() {
  if (dungeonState?.active) {
    exitDungeon(false);
  } else if (typeof tryFleeBoss === 'function') {
    tryFleeBoss();
  }
}

// ─── HUD DU DONJON ──────────────────────────────────────
function showDungeonUI(currentRoom, totalRooms) {
  let el = document.getElementById('dungeon-hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dungeon-hud';
    el.style.cssText = `
      display:block; position:absolute; top:8px; left:50%; transform:translateX(-50%);
      z-index:60; min-width:280px; background:rgba(5,2,8,0.93);
      border:1px solid rgba(155,77,202,0.55); border-radius:4px;
      padding:8px 16px; font-family:'Cinzel',serif; text-align:center;
      box-shadow:0 0 20px rgba(100,20,200,0.25);
    `;
    document.getElementById('arena').appendChild(el);
  }

  const roomCfg = DUNGEON_ROOMS[currentRoom - 1];
  const sc = getDungeonScaling(currentRoom);

  const dotsHtml = Array.from({length: totalRooms}, (_, i) => {
    const done = dungeonState?.roomsCleared?.includes(i+1);
    const current = i + 1 === currentRoom;
    const color = done ? '#27ae60' : current ? '#9b4dca' : '#2a1808';
    const symbol = done ? '✦' : current ? '⚔' : '·';
    return `<span style="color:${color};font-size:14px;margin:0 4px;">${symbol}</span>`;
  }).join('');

  el.innerHTML = `
    <div style="font-size:9px;letter-spacing:2px;color:#6a4a80;margin-bottom:3px;">⚿ DONJON DES FRACTURES</div>
    <div style="font-size:12px;color:#c8a96e;letter-spacing:1px;margin-bottom:4px;">${roomCfg?.name || 'Boss Final'}</div>
    <div style="margin:3px 0;">${dotsHtml}</div>
    <div style="font-size:9px;color:#4a3060;">Salle ${currentRoom}/${totalRooms} · Niv.${sc.level} · ${sc.playerCount} joueur(s)</div>
    <div style="font-size:8px;color:#3a2040;margin-top:2px;font-style:italic;">[ F ] pour fuir</div>
  `;
}

function showDungeonBossUI() {
  let el = document.getElementById('dungeon-hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dungeon-hud';
    el.style.cssText = `
      display:block; position:absolute; top:8px; left:50%; transform:translateX(-50%);
      z-index:60; min-width:300px; background:rgba(5,2,8,0.95);
      border:1px solid rgba(200,160,30,0.6); border-radius:4px;
      padding:10px 18px; font-family:'Cinzel',serif; text-align:center;
      box-shadow:0 0 30px rgba(200,150,20,0.3);
    `;
    document.getElementById('arena').appendChild(el);
  }
  updateDungeonBossHUD();
}

function updateDungeonBossHUD() {
  const el = document.getElementById('dungeon-hud');
  if (!el || !dungeonState?.boss) return;

  const bossEnemy = state.enemies.find(e => e.id === 'dungeon_boss');
  if (!bossEnemy) return;

  const hpPct = Math.max(0, (bossEnemy.hp / bossEnemy.maxHp) * 100);
  const b = dungeonState.boss;
  const phaseNames = ['','Frappe directe','Fragments multipliés','RAGE FINALE'];
  const phaseColors = ['','#9b4dca','#e74c3c','#f1c40f'];
  const pc = phaseColors[b.phase] || '#9b4dca';

  el.innerHTML = `
    <div style="font-size:10px;letter-spacing:2px;color:#a07020;margin-bottom:2px;">⚿ BOSS DU DONJON</div>
    <div style="font-size:13px;color:#f1c40f;letter-spacing:1px;margin-bottom:4px;font-family:'Cinzel Decorative',serif;">L'Écho des Fractures</div>
    <div style="font-size:9px;color:${pc};margin-bottom:5px;">Phase ${b.phase} — ${phaseNames[b.phase]}</div>
    <div style="background:rgba(0,0,0,0.5);border:1px solid ${pc}44;height:8px;border-radius:2px;overflow:hidden;margin-bottom:3px;">
      <div style="width:${hpPct}%;height:100%;background:${pc};transition:width 0.3s;"></div>
    </div>
    <div style="font-size:10px;color:#c8b090;">${bossEnemy.hp.toLocaleString()} / ${bossEnemy.maxHp.toLocaleString()} PV</div>
    <div style="font-size:8px;color:#6a4a30;margin-top:3px;">Niv.${b.level} · ${b.playerCount} joueur(s) · [ F ] fuir</div>
  `;
}

function hideDungeonUI() {
  const el = document.getElementById('dungeon-hud');
  if (el) el.remove();
}

// ─── DESSIN DU PORTAIL DONJON ───────────────────────────
// (Remplace checkPlayerOnPortal qui sera étendu)
function checkPlayerOnPortalExtended(gx, gy) {
  // Si déjà dans une room boss ou donjon : ignorer
  if (bossRoom?.active) return;
  if (dungeonState?.active) {
    checkDungeonTransition(gx, gy);
    return;
  }
  if (gx === PORTAL_GX && gy === PORTAL_GY) {
    addLog('⚿ Vous marchez dans le portail du donjon...', 'action');
    setTimeout(enterDungeon, 300);
  }
}

// ─── DESSIN BOSS DONJON ─────────────────────────────────
function drawDungeonBossOnGrid(ctx) {
  if (!dungeonState?.active || dungeonState.currentRoom !== 4) return;
  if (!dungeonState.boss?.alive) return;

  const bossEnemy = state.enemies.find(e => e.id === 'dungeon_boss' && e.alive);
  if (!bossEnemy) return;

  const { x, y } = gridToIso(dungeonState.boss.gridX, dungeonState.boss.gridY);
  const cx = x, cy = y + CELL_H / 2;
  const t2 = performance.now() / 1000;
  const pulse = 0.4 + 0.6 * Math.sin(t2 * 2.5);

  const phaseColors = ['#9b4dca','#9b4dca','#e74c3c','#f1c40f'];
  const phaseColor = phaseColors[dungeonState.boss.phase] || '#9b4dca';

  // Ombre sol
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 32, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${dungeonState.boss.phase === 3 ? '200,120,10' : '100,20,180'},${0.4 * pulse})`;
  ctx.fill();

  // Corps boss
  ctx.font = '28px serif';
  ctx.fillStyle = phaseColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dungeonState.boss.phase === 3 ? '👁' : dungeonState.boss.phase === 2 ? '💀' : '⚙', cx, cy - 14);

  // Couronne phase
  if (dungeonState.boss.phase >= 2) {
    ctx.font = '12px serif';
    ctx.fillStyle = phaseColor;
    ctx.fillText('★★★★', cx, cy - 36);
  }

  // Barre PV
  const bw = 58, bh = 7;
  const bx = cx - bw / 2, by = cy - 50;
  const hpPct = bossEnemy.hp / bossEnemy.maxHp;
  ctx.fillStyle = '#1a0505'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = phaseColor; ctx.fillRect(bx, by, bw * hpPct, bh);
  ctx.strokeStyle = '#3a0a5a'; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by, bw, bh);

  ctx.font = '8px "Cinzel",serif';
  ctx.fillStyle = '#c8b090'; ctx.globalAlpha = 0.9;
  ctx.fillText("L'Écho des Fractures", cx, cy - 57);
  ctx.globalAlpha = 1;

  // Telegraph highlight
  if (state.highlight.type === 'telegraph') {
    const now = Date.now();
    if (now < state.highlight.expireAt) {
      const flashAlpha = 0.3 + 0.3 * Math.sin(now / 80);
      state.highlight.cells.forEach(c => {
        isoPath(c.x, c.y);
        ctx.fillStyle = `rgba(200,50,20,${flashAlpha})`; ctx.fill();
        ctx.strokeStyle = 'rgba(255,80,40,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      });
    } else {
      state.highlight = { type:null, cells:[] };
    }
  }

  // Porte de transition (si ouverte)
  drawDungeonDoor(ctx);
}

function drawDungeonDoor(ctx) {
  if (!dungeonState?.doorOpen) return;
  const { x, y } = gridToIso(7, 14);
  const cx = x, cy = y + CELL_H / 2;
  const t2 = performance.now() / 1000;
  const pulse = 0.5 + 0.5 * Math.sin(t2 * 4);

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
  grad.addColorStop(0, `rgba(150,50,220,${0.8 * pulse})`);
  grad.addColorStop(1, 'rgba(20,5,40,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(cx, cy, 22 * pulse, 11 * pulse, 0, 0, Math.PI * 2); ctx.fill();

  ctx.font = 'bold 10px serif';
  ctx.fillStyle = `rgba(200,169,110,${0.9 * pulse})`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(dungeonState.doorTarget === 4 ? '☠ BOSS' : `⚔ Salle ${dungeonState.doorTarget}`, cx, cy - 18);
  ctx.fillText('⚿', cx, cy - 6);
}

// ─── DESSIN DONJON (salles 1-3) ─────────────────────────
function drawDungeonRoomUI(ctx) {
  if (!dungeonState?.active) return;
  if (dungeonState.currentRoom === 4) {
    drawDungeonBossOnGrid(ctx);
    return;
  }

  // Porte de passage si salle libérée
  if (dungeonState.doorOpen) drawDungeonDoor(ctx);

  // Label sortie fuir
  const exitIso = gridToIso(7, 14);
  ctx.font = '8px "Cinzel",serif';
  ctx.fillStyle = 'rgba(150,100,50,0.6)';
  ctx.textAlign = 'center';
  ctx.fillText('[ F ] Fuir', exitIso.x, exitIso.y - 4);
}