// ═══════════════════════════════════════════════════════
// VEILBORN — PHASE 2 : DONJONS ALÉATOIRES + MODIFICATEURS
// Remplace checkPlayerOnPortalExtended pour lancer un RUN
// ═══════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 8 SALLES DISPONIBLES
// ─────────────────────────────────────────
const RANDOM_ROOM_POOL = [
  {
    id: 'crypt', name: 'Crypte des Anciens',
    subtitle: 'Le silence pèse comme du plomb...',
    accentColor: '#9b77ca',
    enemyTypes: [
      { type:'gloom',    name:'Spectre boisé',     hp:240, armor:16 },
      { type:'revenant', name:'Ombre ancienne',    hp:180, armor:10 },
    ],
    buildTerrain: buildRoomTerrain_Crypt,
    special: 'altar',
  },
  {
    id: 'forge', name: 'Forges du Voile',
    subtitle: 'La chaleur vous consume...',
    accentColor: '#e67e22',
    enemyTypes: [
      { type:'arcane',   name:'Construct forgé',   hp:310, armor:28 },
      { type:'fracture', name:'Gardien de forge',   hp:260, armor:20 },
    ],
    buildTerrain: buildRoomTerrain_Forge,
    special: 'veil_ground',
  },
  {
    id: 'abyss', name: 'Abysses Fracturés',
    subtitle: 'La réalité se déchire...',
    accentColor: '#9b4dca',
    enemyTypes: [
      { type:'fracture', name:'Fracturé sauvage',   hp:200, armor:14 },
      { type:'arcane',   name:'Éclat dimensionnel', hp:150, armor:8  },
    ],
    buildTerrain: buildRoomTerrain_Abyss,
    special: null,
  },
  {
    id: 'ossuary', name: 'Ossuaire Maudit',
    subtitle: 'Les os chantent votre mort...',
    accentColor: '#7ab850',
    enemyTypes: [
      { type:'gloom',    name:'Revenant maudit',    hp:280, armor:22 },
      { type:'revenant', name:'Squelette guerrier',  hp:200, armor:18 },
    ],
    buildTerrain: buildRoomTerrain_Ossuary,
    special: null,
  },
  {
    id: 'sanctum', name: 'Sanctuaire Profané',
    subtitle: 'La lumière divine a fui ces lieux...',
    accentColor: '#f1c40f',
    enemyTypes: [
      { type:'arcane',   name:'Gardien déchu',      hp:350, armor:30 },
      { type:'fracture', name:'Chevalier maudit',    hp:290, armor:25 },
    ],
    buildTerrain: buildRoomTerrain_Sanctum,
    special: 'blessed_tiles',
  },
  {
    id: 'labyrinth', name: 'Labyrinthe de Voile',
    subtitle: 'Les murs bougent...',
    accentColor: '#4ecdc4',
    enemyTypes: [
      { type:'fracture', name:'Chasseur de Voile',   hp:220, armor:15 },
      { type:'revenant', name:'Traqueur spectral',    hp:170, armor:12 },
    ],
    buildTerrain: buildRoomTerrain_Labyrinth,
    special: null,
  },
  {
    id: 'cathedral', name: 'Cathédrale Effondrée',
    subtitle: 'Le toit craque sous vos pas...',
    accentColor: '#c8a96e',
    enemyTypes: [
      { type:'gloom',    name:'Fantôme cathédral',   hp:260, armor:18 },
      { type:'arcane',   name:'Gargouille de Voile', hp:300, armor:24 },
    ],
    buildTerrain: buildRoomTerrain_Cathedral,
    special: 'veil_surge',
  },
  {
    id: 'nexus', name: 'Nexus des Fractures',
    subtitle: 'Le cœur du Voile bat ici...',
    accentColor: '#e74c3c',
    enemyTypes: [
      { type:'arcane',   name:'Sentinelle du Nexus', hp:400, armor:35 },
      { type:'fracture', name:'Émissaire du Voile',  hp:320, armor:28 },
    ],
    buildTerrain: buildRoomTerrain_Nexus,
    special: null,
  },
];

// ─────────────────────────────────────────
// 12 MODIFICATEURS DE RUN
// ─────────────────────────────────────────
const RUN_MODIFIERS = [
  { id:'speed_demon', name:'Démons rapides', icon:'💨', desc:'Ennemis +50% vitesse.',         neg:true,  apply:(s)=>{ s.enemyAiInterval = Math.max(400, (s.enemyAiInterval||800) * 0.66); } },
  { id:'iron_skin',   name:'Peau de fer',    icon:'🛡', desc:'Ennemis +20 armure.',            neg:true,  apply:(s)=>{ s.extraArmor = (s.extraArmor||0) + 20; } },
  { id:'blood_moon',  name:'Lune de sang',   icon:'🌑', desc:'Dégâts ennemis +25%.',           neg:true,  apply:(s)=>{ s.enemyDmgMult = (s.enemyDmgMult||1) * 1.25; } },
  { id:'berserkers',  name:'Berserkers',     icon:'😤', desc:'+1 ennemi par salle.',           neg:true,  apply:(s)=>{ s.extraEnemies = (s.extraEnemies||0) + 1; } },
  { id:'elites',      name:'Élites',         icon:'⭐', desc:'1 ennemi élite par salle.',      neg:true,  apply:(s)=>{ s.eliteSpawn = true; } },
  { id:'veil_curse',  name:'Malédiction',    icon:'💀', desc:'Cases de Voile font −8 PV/s.',   neg:true,  apply:(s)=>{ s.veilDmg = 8; } },
  { id:'double_xp',   name:'Double XP',      icon:'📈', desc:'×2 XP pendant ce run.',          neg:false, apply:(s)=>{ s.xpMult = (s.xpMult||1) * 2; } },
  { id:'gold_rush',   name:'Rush d\'or',     icon:'💰', desc:'+60% or des ennemis.',           neg:false, apply:(s)=>{ s.goldMult = (s.goldMult||1) * 1.6; } },
  { id:'treasure',    name:'Trésors',        icon:'💎', desc:'Coffre bonus dans chaque salle.', neg:false, apply:(s)=>{ s.treasureRoom = true; } },
  { id:'berserk',     name:'Mode berserk',   icon:'🔥', desc:'Vos dégâts +30%.',               neg:false, apply:(s)=>{ s.playerDmgBonus = (s.playerDmgBonus||0) + 0.30; } },
  { id:'swift',       name:'Pieds agiles',   icon:'👟', desc:'+0.5 vitesse de déplacement.',   neg:false, apply:(s)=>{ s.playerSpeedBonus = (s.playerSpeedBonus||0) + 0.5; } },
  { id:'arcane_cd',   name:'Surtension Arc.', icon:'⚡',desc:'CDs skills −25%.',               neg:false, apply:(s)=>{ s.cdReduction = (s.cdReduction||0) + 0.25; } },
];

// ─────────────────────────────────────────
// ÉTAT DU RUN ACTUEL
// ─────────────────────────────────────────
let runState = null;  // Données du run en cours

// ─────────────────────────────────────────
// RNG DÉTERMINISTE
// ─────────────────────────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return function() {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = s ^ (s >>> 16);
    return (s >>> 0) / 0x100000000;
  };
}

// ─────────────────────────────────────────
// OVERRIDE DU PORTAIL — Remplace enterDungeon
// ─────────────────────────────────────────
function checkPlayerOnPortalExtended(gx, gy) {
  if (bossRoom?.active) return;
  if (dungeonState?.active) {
    checkDungeonTransition(gx, gy);
    // Vérifier coffre
    if (runState?.chestPos && gx === runState.chestPos.gx && gy === runState.chestPos.gy) {
      openRunChest();
    }
    return;
  }
  if (gx === PORTAL_GX && gy === PORTAL_GY) {
    if (typeof AudioEngine !== 'undefined') AudioEngine.play.portalEnter();
    startRandomRun();
  }
}

// ─────────────────────────────────────────
// GÉNÉRER ET LANCER UN RUN
// ─────────────────────────────────────────
function startRandomRun() {
  const seed = (Date.now() & 0xFFFFFF) + Math.floor(Math.random() * 0xFFFF);
  const rng  = makeRng(seed);

  // Tirer 3 salles sans répétition
  const pool = [...RANDOM_ROOM_POOL];
  const rooms = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rng() * pool.length);
    rooms.push(pool[idx].id);
    pool.splice(idx, 1);
  }

  // Tirer les modificateurs: 1 négatif obligatoire + 1-2 autres
  const negs = RUN_MODIFIERS.filter(m => m.neg);
  const poss = RUN_MODIFIERS.filter(m => !m.neg);
  const mods = [];
  mods.push(negs[Math.floor(rng() * negs.length)].id);
  const extraCount = 1 + (rng() < 0.45 ? 1 : 0);
  for (let i = 0; i < extraCount; i++) {
    const pool2 = rng() < 0.5 ? poss : negs;
    const candidate = pool2[Math.floor(rng() * pool2.length)];
    if (candidate && !mods.includes(candidate.id)) mods.push(candidate.id);
  }

  // Calculer le scaling
  const scaling = { enemyAiInterval: 800, extraArmor: 0, enemyDmgMult: 1, extraEnemies: 0,
    eliteSpawn: false, veilDmg: 0, xpMult: 1, goldMult: 1, treasureRoom: false,
    playerDmgBonus: 0, playerSpeedBonus: 0, cdReduction: 0 };
  mods.forEach(id => {
    const m = RUN_MODIFIERS.find(x => x.id === id);
    if (m?.apply) m.apply(scaling);
  });

  runState = { seed, rooms, mods, scaling, currentRoomIdx: -1, cleared: [], chestPos: null, veilSurgeTimer: null };

  // Afficher le briefing
  showRunBriefing(runState, () => _launchRun());
}

function _launchRun() {
  if (!runState) return;

  // Appliquer bonus joueur
  const sc = runState.scaling;
  if (sc.playerDmgBonus > 0) {
    if (!state.buffs) state.buffs = {};
    state.buffs._runDmg = sc.playerDmgBonus;
    addLog(`🔥 Berserk: +${Math.round(sc.playerDmgBonus*100)}% dégâts!`, 'action');
  }
  if (sc.cdReduction > 0) {
    addLog(`⚡ Surtension: CDs −${Math.round(sc.cdReduction*100)}%!`, 'action');
  }

  if (typeof AudioEngine !== 'undefined') AudioEngine.playMusic('dungeon');

  dungeonState = {
    active: true,
    currentRoom: 0,
    savedPlayerX: state.player.gridX,
    savedPlayerY: state.player.gridY,
    savedEnemies: [...state.enemies],
    savedTerrain: { ...state.terrain },
    roomsCleared: [],
    aiInterval: null,
    isRandom: true,
  };

  dungeonState.aiInterval = setInterval(_tickRandomAI, runState.scaling.enemyAiInterval || 800);
  setTimeout(() => _enterRoom(0), 400);
}

// ─────────────────────────────────────────
// ENTRER DANS UNE SALLE
// ─────────────────────────────────────────
function _enterRoom(roomIdx) {
  if (!dungeonState?.active || !runState) return;

  if (roomIdx >= runState.rooms.length) {
    // → Boss
    if (typeof AudioEngine !== 'undefined') AudioEngine.playMusic('boss');
    enterDungeonBossRoom();
    return;
  }

  dungeonState.currentRoom = roomIdx + 1;
  runState.currentRoomIdx  = roomIdx;

  const roomId = runState.rooms[roomIdx];
  const roomCfg = RANDOM_ROOM_POOL.find(r => r.id === roomId);
  if (!roomCfg) { console.error('Room config missing:', roomId); return; }

  if (typeof getDungeonScaling === 'undefined') { console.error('getDungeonScaling not loaded'); return; }
  const sc = getDungeonScaling(roomIdx + 1);
  const rs = runState.scaling;

  // Téléporter joueur
  state.player.gridX = 7; state.player.gridY = 13;
  state.player.path = []; state.player.moving = false;
  if (typeof initPlayerPixelPos === 'function') initPlayerPixelPos();

  // Terrain
  state.terrain = roomCfg.buildTerrain();

  // Ennemis
  state.enemies = _spawnEnemies(roomCfg, sc, rs);

  // Coffre si modificateur treasure
  runState.chestPos = null;
  if (rs.treasureRoom) {
    // Trouver une case libre au centre
    runState.chestPos = { gx: 7, gy: 7 };
    addLog('💎 Un coffre au trésor vous attend au centre!', 'action');
  }

  // Spéciaux de salle
  _applyRoomSpecial(roomCfg, roomIdx);

  // HUD
  _showRunHUD(roomIdx + 1);

  const modNames = runState.mods.map(id => {
    const m = RUN_MODIFIERS.find(x => x.id === id);
    return m ? m.icon + m.name : id;
  }).join(' · ');

  addLog(`⚔ [Salle ${roomIdx+1}/3] ${roomCfg.name}`, 'action');
  addLog(roomCfg.subtitle, 'normal');
  addLog(`Mods: ${modNames}`, 'normal');

  if (typeof AudioEngine !== 'undefined') AudioEngine.play.portalEnter();
}

function _spawnEnemies(roomCfg, sc, rs) {
  const positions = [
    [3,4],[5,6],[9,4],[11,6],[4,8],[10,8],
    [5,3],[9,3],[3,9],[11,9],[7,4],[6,10],[8,10]
  ];
  const count = Math.min(sc.enemyCount + (rs.extraEnemies || 0) + (rs.eliteSpawn ? 1 : 0), positions.length);
  const enemies = [];

  for (let i = 0; i < count; i++) {
    const isElite = rs.eliteSpawn && i === count - 1;
    const tpl = roomCfg.enemyTypes[i % roomCfg.enemyTypes.length];
    const pos = positions[i];
    const hpMult = sc.hpMult * (isElite ? 2.5 : 1);
    const dmgBase = Math.round(25 * sc.dmgMult * (rs.enemyDmgMult || 1) * (isElite ? 1.6 : 1));

    enemies.push({
      id: `rr_${dungeonState.currentRoom}_${i}`,
      gridX: pos[0], gridY: pos[1],
      hp: Math.round(tpl.hp * hpMult),
      maxHp: Math.round(tpl.hp * hpMult),
      armor: Math.round(tpl.armor + sc.armorBonus + (rs.extraArmor || 0)),
      type: tpl.type, alive: true,
      name: isElite ? `⭐ ${tpl.name} Élite` : tpl.name,
      debuffs: {},
      isDungeonEnemy: true,
      _aiTimer: Date.now() + 1000 + Math.random() * 800,
      _aiRange: isElite ? 8 : 5,
      _dmgBase: dmgBase,
      _dmgRange: Math.round(12 * sc.dmgMult),
      isElite,
    });
  }
  return enemies;
}

// ─────────────────────────────────────────
// IA ENNEMIS RANDOM
// ─────────────────────────────────────────
function _tickRandomAI() {
  if (!dungeonState?.active || !dungeonState.isRandom) return;
  if (dungeonState.currentRoom === 4) return;
  if (state.showSkillTree || state.showTalentTree) return;

  const now = Date.now();
  const px = state.player.gridX, py = state.player.gridY;

  state.enemies.forEach(enemy => {
    if (!enemy.alive || !enemy.isDungeonEnemy || enemy.isBoss) return;
    if (now < enemy._aiTimer) return;
    enemy._aiTimer = now + (runState?.scaling?.enemyAiInterval || 800) + Math.random() * 350;

    const dist = Math.abs(enemy.gridX - px) + Math.abs(enemy.gridY - py);
    if (dist <= 1) {
      const dmg = enemy._dmgBase + Math.floor(Math.random() * enemy._dmgRange);
      const red = typeof calcDamage === 'function' ? calcDamage(dmg, state.armor) : Math.max(1, dmg - state.armor);
      state.hp = Math.max(1, state.hp - red);
      if (typeof updateHpUI === 'function') updateHpUI();
      if (typeof spawnFloater === 'function') spawnFloater(px, py, `-${red}`, '#e74c3c', 13);
      if (typeof addLog === 'function') addLog(`${enemy.name} → −${red} PV`, 'normal');
      if (typeof AudioEngine !== 'undefined') AudioEngine.play.hitReceived();
      if (window.multiState?.broadcastHp) multiState.broadcastHp();
      return;
    }
    if (dist <= enemy._aiRange) {
      const dx = Math.sign(px - enemy.gridX);
      const dy = Math.sign(py - enemy.gridY);
      const moves = [];
      if (dx !== 0) moves.push([dx, 0]);
      if (dy !== 0) moves.push([0, dy]);
      moves.sort(() => Math.random() - 0.5);
      for (const [mx, my] of moves) {
        const nx = enemy.gridX + mx, ny = enemy.gridY + my;
        if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) continue;
        if (state.terrain[`${nx},${ny}`] === 'blocked') continue;
        if (state.enemies.some(e => e.alive && e !== enemy && e.gridX === nx && e.gridY === ny)) continue;
        if (nx === px && ny === py) continue;
        enemy.gridX = nx; enemy.gridY = ny; break;
      }
    }
  });

  _checkRoomClear();

  // Veil damage si modificateur
  if (runState?.scaling?.veilDmg > 0) {
    const cell = state.terrain[`${px},${py}`];
    if (cell === 'veil') {
      // 1/5 de chance par tick (~chaque 4s)
      if (Math.random() < 0.2) {
        const dmg = runState.scaling.veilDmg;
        state.hp = Math.max(1, state.hp - dmg);
        if (typeof updateHpUI === 'function') updateHpUI();
        if (typeof spawnFloater === 'function') spawnFloater(px, py, `−${dmg}☠`, '#9b4dca', 12);
      }
    }
  }
}

// ─────────────────────────────────────────
// VÉRIFIER SI SALLE LIBÉRÉE
// ─────────────────────────────────────────
function _checkRoomClear() {
  if (!dungeonState?.active || !dungeonState.isRandom) return;
  if (dungeonState.currentRoom === 4) return;

  const alive = state.enemies.filter(e => e.alive && !e.isDummy);
  if (alive.length > 0) return;

  const roomIdx = dungeonState.currentRoom - 1;
  const roomId  = runState?.rooms[roomIdx];
  if (!roomId || runState.cleared.includes(roomIdx)) return;
  runState.cleared.push(roomIdx);

  const sc  = getDungeonScaling(dungeonState.currentRoom);
  const rs  = runState?.scaling || {};
  const xp  = Math.round(sc.xpReward * (rs.xpMult || 1));
  const gold = Math.round((20 + Math.random() * 30) * (rs.goldMult || 1));

  if (typeof gainXP === 'function') gainXP(xp);
  if (typeof addGold === 'function') addGold(gold);
  if (typeof spawnFloater === 'function') spawnFloater(state.player.gridX, state.player.gridY, `✦ SALLE ${dungeonState.currentRoom} LIBÉRÉE`, '#c8a96e', 16);
  addLog(`✦ Salle libérée! +${xp} XP +${gold}g`, 'action');

  // Nettoyer timers spéciaux
  if (runState.veilSurgeTimer) { clearInterval(runState.veilSurgeTimer); runState.veilSurgeTimer = null; }

  setTimeout(() => {
    if (!dungeonState?.active) return;
    dungeonState.doorOpen = true;
    dungeonState.doorTarget = dungeonState.currentRoom < 3 ? dungeonState.currentRoom + 1 : 4;
    const nextName = dungeonState.doorTarget === 4 ? '☠ Boss' : `Salle ${dungeonState.doorTarget}`;
    addLog(`⚿ Portail vers ${nextName} ouvert (case 7,14)`, 'normal');
    _showRunHUD(dungeonState.currentRoom);
  }, 800);
}

// ─────────────────────────────────────────
// COFFRE BONUS
// ─────────────────────────────────────────
function openRunChest() {
  if (!runState?.chestPos) return;
  const px = state.player.gridX, py = state.player.gridY;
  const cp = runState.chestPos;
  if (Math.abs(px - cp.gx) > 1 || Math.abs(py - cp.gy) > 1) return; // trop loin
  runState.chestPos = null; // Consommer

  const gold = 25 + Math.floor(Math.random() * 45);
  if (typeof addGold === 'function') addGold(gold);
  if (typeof spawnFloater === 'function') spawnFloater(cp.gx, cp.gy, `💎 +${gold}g`, '#f1c40f', 16);
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.lootPickup();

  // Item rare/épique 65% du temps
  if (Math.random() < 0.65 && typeof ITEM_TEMPLATES !== 'undefined') {
    const keys = Object.keys(ITEM_TEMPLATES);
    const tId  = keys[Math.floor(Math.random() * keys.length)];
    const rar  = Math.random() < 0.45 ? 'rare' : 'uncommon';
    if (typeof generateItem === 'function') {
      const item = generateItem(tId, rar);
      if (item && typeof addItemToInventory === 'function') {
        addItemToInventory(item);
        addLog(`💎 Coffre! +${gold}g + ${item.icon} ${item.name} [${item.rarityLabel}]`, 'action');
        return;
      }
    }
  }
  addLog(`💎 Coffre! +${gold}g`, 'action');
}

// ─────────────────────────────────────────
// SPÉCIAUX DE SALLES
// ─────────────────────────────────────────
function _applyRoomSpecial(roomCfg, roomIdx) {
  if (!roomCfg.special) return;
  switch (roomCfg.special) {
    case 'altar':
      addLog('⚗ Autel sacrificiel: approchez le centre pour un pacte.', 'normal');
      break;
    case 'veil_ground':
      // Déjà dans le terrain — ajouter des cases Voile supplémentaires
      for (let x = 4; x <= 11; x++)
        for (let y = 4; y <= 11; y++)
          if (!state.terrain[`${x},${y}`] && Math.random() < 0.25)
            state.terrain[`${x},${y}`] = 'veil';
      break;
    case 'blessed_tiles':
      [[5,5],[10,5],[7,8],[5,10],[10,10]].forEach(([x,y]) => {
        if (!state.terrain[`${x},${y}`]) state.terrain[`${x},${y}`] = 'veil'; // réutilise veil visuellement
      });
      addLog('✦ Cases bénies: régénèrent +15 PV à chaque pas dessus.', 'normal');
      break;
    case 'veil_surge':
      runState.veilSurgeTimer = setInterval(() => {
        if (!dungeonState?.active) { clearInterval(runState.veilSurgeTimer); return; }
        const dmg = 12 + Math.floor(Math.random() * 18);
        state.hp = Math.max(1, state.hp - dmg);
        if (typeof updateHpUI === 'function') updateHpUI();
        if (typeof spawnFloater === 'function') spawnFloater(state.player.gridX, state.player.gridY, `⚡ −${dmg}`, '#9b4dca', 13);
        addLog(`⚡ Surtension de Voile −${dmg} PV`, 'normal');
      }, 14000);
      addLog('⚡ Surtensions de Voile toutes les 14s dans cette salle!', 'normal');
      break;
  }
}

// ─────────────────────────────────────────
// TRANSITION ENTRE SALLES
// ─────────────────────────────────────────
function checkDungeonTransition(gx, gy) {
  if (!dungeonState?.active || !dungeonState.doorOpen) return;
  if (gy === 14 && (gx === 7 || gx === 8)) {
    dungeonState.doorOpen = false;
    const target = dungeonState.doorTarget;
    addLog('⚿ Passage vers la prochaine zone...', 'action');
    if (dungeonState.isRandom) {
      setTimeout(() => _enterRoom(target - 1), 300);
    } else {
      setTimeout(() => enterDungeonRoom(target), 300);
    }
  }
}

// ─────────────────────────────────────────
// VICTOIRE DU DONJON (override)
// ─────────────────────────────────────────
function dungeonVictory() {
  if (dungeonState?.isRandom) {
    if (dungeonState.bossTickInterval) clearInterval(dungeonState.bossTickInterval);
    if (dungeonState.aiInterval) clearInterval(dungeonState.aiInterval);
    if (runState?.veilSurgeTimer) clearInterval(runState.veilSurgeTimer);

    const level = state.talents?.level || 1;
    const xp   = Math.round(500 * (1 + (level - 1) * 0.15) * (runState?.scaling?.xpMult || 1));
    const eclats = 2 + Math.floor(level / 5);

    if (typeof gainXP === 'function') gainXP(xp);
    if (typeof gainEclats === 'function') gainEclats(eclats);
    if (typeof AudioEngine !== 'undefined') { AudioEngine.play.victory(); AudioEngine.playMusic('overworld'); }

    addLog('✦ Boss vaincu! Run terminé!', 'action');
    addLog(`✦ +${xp} XP · +${eclats} Éclats de Voile · Seed: ${runState?.seed?.toString(36).toUpperCase()}`, 'action');
    if (typeof spawnFloater === 'function') spawnFloater(state.player.gridX, state.player.gridY, '✦ VICTOIRE ✦', '#f1c40f', 22);

    if (typeof hideDungeonUI === 'function') hideDungeonUI();
    runState = null;
    setTimeout(() => exitDungeon(true), 1500);
  } // Non-random handled by original dungeon.js flow (won't reach here since dungeonState.isRandom)
}

// ─────────────────────────────────────────
// FUIR (override)
// ─────────────────────────────────────────
function tryFleeOrFleeDungeon() {
  if (dungeonState?.active) {
    if (runState?.veilSurgeTimer) clearInterval(runState.veilSurgeTimer);
    if (dungeonState.aiInterval) clearInterval(dungeonState.aiInterval);
    runState = null;
    if (typeof AudioEngine !== 'undefined') AudioEngine.playMusic('overworld');
    exitDungeon(false);
  } else if (typeof tryFleeBoss === 'function') {
    tryFleeBoss();
  }
}

// ─────────────────────────────────────────
// TERRAINS DES 8 SALLES
// ─────────────────────────────────────────
function _baseTerrain() {
  const t = {};
  for (let i = 0; i < GRID_SIZE; i++) {
    t[`${i},0`] = 'blocked'; t[`${i},15`] = 'blocked';
    t[`0,${i}`] = 'blocked'; t[`15,${i}`] = 'blocked';
  }
  return t;
}

function buildRoomTerrain_Crypt() {
  const t = _baseTerrain();
  [[3,3],[4,3],[3,4],[12,3],[13,3],[12,4],[3,11],[4,12],[3,12],[12,11],[13,12],[12,12]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; });
  [[6,6],[7,6],[8,6],[9,6],[6,9],[7,9],[8,9],[9,9]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  return t;
}
function buildRoomTerrain_Forge() {
  const t = _baseTerrain();
  [[4,4],[5,4],[4,5],[5,5],[10,4],[11,4],[10,5],[11,5],[4,10],[5,11],[10,10],[11,11]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; });
  [[6,7],[7,7],[8,7],[9,7],[7,8],[8,8]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  return t;
}
function buildRoomTerrain_Abyss() {
  const t = _baseTerrain();
  for (let x=2; x<=13; x++) for (let y=2; y<=13; y++) {
    if (x===7 || x===8 || y===7 || y===13 || y===14) continue;
    if (Math.random() < 0.07) t[`${x},${y}`] = 'blocked';
    else if (Math.random() < 0.10) t[`${x},${y}`] = 'veil';
  }
  return t;
}
function buildRoomTerrain_Ossuary() {
  const t = _baseTerrain();
  for (let x=2; x<=6;  x++) t[`${x},7`] = 'blocked';
  for (let x=9; x<=13; x++) t[`${x},7`] = 'blocked';
  [[3,4],[4,4],[11,4],[12,4],[3,10],[4,10],[11,10],[12,10]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; });
  [[6,5],[9,5],[6,9],[9,9]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  return t;
}
function buildRoomTerrain_Sanctum() {
  const t = _baseTerrain();
  [[3,3],[3,4],[13,3],[13,4],[3,11],[3,12],[13,11],[13,12],[3,7],[3,8],[13,7],[13,8]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; });
  [[6,5],[7,5],[8,5],[9,5],[6,10],[7,10],[8,10],[9,10]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  return t;
}
function buildRoomTerrain_Labyrinth() {
  const t = _baseTerrain();
  for (let x=3; x<=5; x++) t[`${x},5`]='blocked';
  for (let x=7; x<=9; x++) t[`${x},3`]='blocked';
  for (let x=10;x<=12;x++) t[`${x},6`]='blocked';
  for (let y=5; y<=8; y++) t[`5,${y}`]='blocked';
  for (let y=7; y<=10;y++) t[`10,${y}`]='blocked';
  for (let x=3; x<=6; x++) t[`${x},10`]='blocked';
  for (let x=9; x<=12;x++) t[`${x},11`]='blocked';
  [[7,7],[8,7],[7,8]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  return t;
}
function buildRoomTerrain_Cathedral() {
  const t = _baseTerrain();
  for (let x=5; x<=10; x++) { t[`${x},2`]='blocked'; t[`${x},13`]='blocked'; }
  [[3,4],[3,5],[12,4],[12,5],[3,9],[3,10],[12,9],[12,10]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; });
  [[6,5],[7,5],[8,5],[9,5],[6,9],[7,9],[8,9],[9,9]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  return t;
}
function buildRoomTerrain_Nexus() {
  const t = _baseTerrain();
  const cx=7, cy=7;
  for (let dx=-5; dx<=5; dx++) for (let dy=-5; dy<=5; dy++) {
    const nx=cx+dx, ny=cy+dy;
    if (nx<1||ny<1||nx>14||ny>14) continue;
    const dist=Math.abs(dx)+Math.abs(dy);
    if (dist===5) t[`${nx},${ny}`]='blocked';
    else if (dist===4 && Math.random()<0.5) t[`${nx},${ny}`]='veil';
  }
  return t;
}

// ─────────────────────────────────────────
// HUD DU RUN
// ─────────────────────────────────────────
function _showRunHUD(currentRoom) {
  let el = document.getElementById('dungeon-hud');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dungeon-hud';
    el.style.cssText = 'display:block;position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:60;min-width:320px;background:rgba(4,2,8,0.94);border:1px solid rgba(155,77,202,0.5);border-radius:4px;padding:8px 16px;font-family:"Cinzel",serif;text-align:center;box-shadow:0 0 20px rgba(100,20,200,0.2);pointer-events:none;';
    const arena = document.getElementById('arena');
    if (arena) arena.appendChild(el); else document.body.appendChild(el);
  }
  if (!runState) return;

  const roomId  = runState.rooms[currentRoom - 1];
  const roomCfg = RANDOM_ROOM_POOL.find(r => r.id === roomId) || { name:'???', accentColor:'#9b4dca' };
  const sc = getDungeonScaling(currentRoom);

  const dots = [0,1,2].map(i => {
    const done = i < currentRoom - 1;
    const cur  = i === currentRoom - 1;
    const color = done ? '#27ae60' : cur ? roomCfg.accentColor : '#2a1808';
    const sym   = done ? '✦' : cur ? '⚔' : '·';
    return `<span style="color:${color};font-size:14px;margin:0 5px;">${sym}</span>`;
  }).join('');

  const modIcons = runState.mods.map(id => {
    const m = RUN_MODIFIERS.find(x => x.id === id);
    return m ? `<span title="${m.name}: ${m.desc}" style="cursor:default;">${m.icon}</span>` : '';
  }).join(' ');

  const seed6 = runState.seed.toString(16).toUpperCase().slice(-6).padStart(6,'0');

  el.innerHTML = `
    <div style="font-size:9px;letter-spacing:2px;color:${roomCfg.accentColor};margin-bottom:2px;">⚿ DONJON ALÉATOIRE</div>
    <div style="font-size:12px;color:#c8a96e;letter-spacing:1px;margin-bottom:4px;">${roomCfg.name}</div>
    <div style="margin:2px 0;">${dots}</div>
    <div style="font-size:9px;color:#4a3060;margin-bottom:3px;">Salle ${currentRoom}/3 · Niv.${sc.level} · #${seed6}</div>
    <div style="font-size:12px;letter-spacing:2px;">${modIcons}</div>
    <div style="font-size:8px;color:#3a2040;margin-top:2px;">[F] Fuir le donjon</div>
  `;
}

// ─────────────────────────────────────────
// BRIEFING MODAL
// ─────────────────────────────────────────
function showRunBriefing(run, onStart) {
  const modal = document.getElementById('run-briefing-modal');
  if (!modal) { onStart(); return; }

  const roomListEl = document.getElementById('run-room-list');
  const modListEl  = document.getElementById('run-modifiers-list');
  const seedEl     = document.getElementById('run-seed');

  if (roomListEl) {
    roomListEl.innerHTML = run.rooms.map((id, i) => {
      const r = RANDOM_ROOM_POOL.find(x => x.id === id);
      const name = r ? r.name : id;
      const color = r ? r.accentColor : '#c8a96e';
      const arrows = i < run.rooms.length - 1 ? `<div style="color:#3a2010;text-align:center;font-size:10px;">↓</div>` : '';
      return `<div style="color:${color};font-family:'Cinzel',serif;font-size:11px;padding:4px 6px;border-left:2px solid ${color}44;margin:1px 0;">
        <span style="color:#3a2010;font-size:9px;">${i+1}.</span> ${name}
      </div>${arrows}`;
    }).join('') + `<div style="color:#3a2010;text-align:center;font-size:10px;margin-top:4px;">↓</div>
    <div style="color:#f1c40f;font-family:'Cinzel',serif;font-size:11px;padding:4px 6px;border-left:2px solid rgba(241,196,15,0.4);">☠ Boss Final</div>`;
  }

  if (modListEl) {
    modListEl.innerHTML = run.mods.map(id => {
      const m = RUN_MODIFIERS.find(x => x.id === id);
      if (!m) return '';
      const color = m.neg ? '#e74c3c' : '#27ae60';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 9px;border:1px solid ${color}33;border-radius:4px;background:${color}0d;margin-bottom:4px;">
        <span style="font-size:16px;flex-shrink:0;">${m.icon}</span>
        <div>
          <div style="color:${color};font-family:'Cinzel',serif;font-size:10px;font-weight:bold;">${m.name}</div>
          <div style="color:#6a5030;font-size:9px;font-style:italic;margin-top:2px;">${m.desc}</div>
        </div>
      </div>`;
    }).join('');
  }

  if (seedEl) {
    const seed6 = run.seed.toString(16).toUpperCase().slice(-6).padStart(6,'0');
    seedEl.textContent = `Graine du run : #${seed6}`;
  }

  modal.style.display = 'flex';

  const btn = document.getElementById('run-start-btn');
  if (btn) {
    // Retirer anciens listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => {
      modal.style.display = 'none';
      onStart();
    };
  }
}