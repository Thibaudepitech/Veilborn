// ═══════════════════════════════════════════════════════
// BOSS SYSTEM — L'Architecte Fracturé
// Portail dimensionnel → téléportation dans salle boss
// Salle boss = grille séparée au centre de l'écran
// ═══════════════════════════════════════════════════════

// ─── PORTAIL (sur la carte principale) ──────────────────
const PORTAL_GX = 8, PORTAL_GY = 3;

// ─── ÉTAT GLOBAL ─────────────────────────────────────────
let bossState = null;
let bossRoom = null; // { active, canvas, ctx, enemies, playerX, playerY, ... }

// ─── SALLE BOSS ── 16×16 indépendante ────────────────────
const BOSS_ROOM_SIZE = 16;

// ─── INITIALISER LA SALLE BOSS ───────────────────────────
function enterBossRoom() {
  if (bossRoom?.active) return;

  addLog('⚿ Le portail vous aspire dans une autre dimension...', 'action');

  // Sauvegarder position joueur monde
  bossRoom = {
    active: true,
    savedPlayerX: state.player.gridX,
    savedPlayerY: state.player.gridY,
    savedEnemies: [...state.enemies],
    savedTerrain: { ...state.terrain },
  };

  // Téléporter joueur au centre-bas de la salle boss
  state.player.gridX = 7;
  state.player.gridY = 13;
  state.player.path = [];
  state.player.moving = false;
  initPlayerPixelPos();

  // Vider les ennemis du monde principal
  state.enemies = [];

  // Créer le terrain de la salle boss
  buildBossRoomTerrain();

  // Spawner le boss au centre
  spawnBossEntity();

  // Lancer le système boss
  startBossSystem();

  // Afficher le HUD boss
  showBossUI();

  addLog('⚙ L\'Architecte Fracturé vous attend au centre!', 'action');
  addLog('Phase 1 — Évitez les faisceaux rouges, tuez les Sentinelles!', 'normal');
}

function buildBossRoomTerrain() {
  const t = {};
  // Murs sur les bords
  for (let i = 0; i < BOSS_ROOM_SIZE; i++) {
    t[`${i},0`] = 'blocked';
    t[`${i},15`] = 'blocked';
    t[`0,${i}`] = 'blocked';
    t[`15,${i}`] = 'blocked';
  }
  // Piliers décoratifs aux coins
  [[2,2],[2,3],[3,2],[12,2],[13,2],[12,3],[2,12],[3,13],[2,13],[12,12],[13,13],[12,13]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'blocked';
  });
  // Cases de Voile au sol (bonus dégâts)
  [[7,7],[8,7],[7,8],[8,8],[6,6],[9,6],[6,9],[9,9]].forEach(([x,y]) => {
    t[`${x},${y}`] = 'veil';
  });
  state.terrain = t;
}

function spawnBossEntity() {
  const playerCount = window.multiState?.active
    ? Object.keys(multiState.remotePlayers || {}).length + 1 : 1;
  const hpMult = 1 + (playerCount - 1) * 0.833;

  bossState = {
    alive: true,
    gridX: 7, gridY: 4,   // boss au centre-haut
    hp: Math.round(2000 * hpMult),
    hpMax: Math.round(2000 * hpMult),
    armor: 40,
    phase: 1,
    playerCount,

    // Timers (init à now pour que rien ne tire immédiatement)
    beamTimer: Date.now(),
    beamInterval: 5000,
    activeBeams: [],
    beamWarnings: [],

    gravityZones: [],
    gravityTimer: Date.now(),
    gravityActive: false,

    shieldNode: null,
    shieldNodeTimer: Date.now(),
    shieldNodeDuration: 5000,
    sweepTimer: Date.now(),
    sweepInterval: 4000,

    sentinels: [],
    tickInterval: null,
  };

  // Boss entity dans state.enemies
  state.enemies.push({
    id: 'boss_architecte',
    gridX: bossState.gridX,
    gridY: bossState.gridY,
    hp: bossState.hp,
    maxHp: bossState.hpMax,
    armor: bossState.armor,
    type: 'arcane', alive: true,
    name: "L'Architecte Fracturé ★★★",
    debuffs: {}, isBoss: true,
  });

  // Marquer la case du boss comme bloquée
  state.terrain[`${bossState.gridX},${bossState.gridY}`] = 'blocked';

  // Sentinelles (phase 1)
  spawnSentinels();
}

function spawnSentinels() {
  if (!bossState) return;
  const positions = [
    { x: 4, y: 5 },
    { x: 11, y: 5 },
  ];
  bossState.sentinels = positions.map((pos, i) => {
    const s = {
      id: `sentinel_${i}`,
      gridX: pos.x, gridY: pos.y,
      hp: 500, maxHp: 500, armor: 20,
      type: 'arcane', alive: true,
      name: `Sentinelle liée ${i + 1}`,
      debuffs: {}, isSentinel: true,
    };
    state.enemies.push(s);
    return s;
  });
}

// ─── QUITTER LA SALLE BOSS ───────────────────────────────
function exitBossRoom(victory) {
  if (!bossRoom?.active) return;

  if (bossState?.tickInterval) {
    clearInterval(bossState.tickInterval);
  }
  bossState = null;

  // Restaurer le monde principal
  state.enemies = bossRoom.savedEnemies;
  state.terrain = bossRoom.savedTerrain;
  state.player.gridX = bossRoom.savedPlayerX;
  state.player.gridY = bossRoom.savedPlayerY;
  state.player.path = [];
  state.player.moving = false;
  initPlayerPixelPos();

  state.bossShieldNode = null;
  state.bossGravityZones = [];
  state.highlight = { type: null, cells: [] };

  bossRoom = null;

  hideBossUI();

  if (victory) {
    addLog('✦ L\'Architecte est vaincu! Vous retournez dans le monde.', 'action');
    spawnFloater(state.player.gridX, state.player.gridY, '✦ VICTOIRE ✦', '#c8a96e', 22);
    if (typeof gainXP === 'function') gainXP(500);
    if (typeof gainEclats === 'function') gainEclats(3);
    addLog('Récompenses: +500 XP · +3 Éclats de Voile!', 'action');
  } else {
    addLog('Vous avez fui la salle du boss.', 'normal');
  }
}

// ─── SYSTÈME BOSS TICK ───────────────────────────────────
function startBossSystem() {
  if (bossState.tickInterval) clearInterval(bossState.tickInterval);
  bossState.tickInterval = setInterval(tickBoss, 200);
}

function tickBoss() {
  if (!bossState?.alive || !bossRoom?.active) return;

  const bossEnemy = state.enemies.find(e => e.id === 'boss_architecte');
  if (!bossEnemy || !bossEnemy.alive) {
    exitBossRoom(true);
    return;
  }
  bossState.hp = bossEnemy.hp;

  // Sync sentinelles vivantes
  bossState.sentinels = bossState.sentinels.filter(s =>
    state.enemies.find(e => e.id === s.id && e.alive)
  );

  const hpPct = bossState.hp / bossState.hpMax;
  const now = Date.now();

  // Transitions de phase
  if (bossState.phase === 1 && hpPct <= 0.6) {
    bossState.phase = 2;
    enterPhase2(now);
  } else if (bossState.phase === 2 && hpPct <= 0.3) {
    bossState.phase = 3;
    enterPhase3();
  }

  if (bossState.phase >= 1) tickBeams(now);
  if (bossState.phase === 2) tickGravity(now);
  if (bossState.phase === 3) {
    tickShieldNode(now);
    tickCircularSweep(now);
  }

  updateBossUI();
}

// ─── PHASE 1 : FAISCEAUX ─────────────────────────────────
function tickBeams(now) {
  bossState.activeBeams = bossState.activeBeams.filter(b => now < b.expireAt);
  bossState.beamWarnings = bossState.beamWarnings.filter(b => now < b.expireAt);

  // Dégâts joueur sur faisceaux actifs
  bossState.activeBeams.forEach(beam => {
    beam.cells.forEach(c => {
      if (c.x === state.player.gridX && c.y === state.player.gridY) {
        const dmg = Math.round(40 + Math.random() * 30);
        state.hp = Math.max(1, state.hp - dmg);
        updateHpUI();
        spawnFloater(c.x, c.y, `-${dmg}☄`, '#9b4dca', 14);
        addLog(`☄ Faisceau! −${dmg} PV`, 'normal');
      }
    });
  });

  if (now - bossState.beamTimer > bossState.beamInterval) {
    bossState.beamTimer = now;
    spawnBeam();
  }
}

function spawnBeam() {
  if (!bossState) return;
  const dirs = [[1,0],[0,1],[-1,0],[0,-1]];
  const numBeams = bossState.playerCount >= 4 ? 3 : bossState.playerCount >= 2 ? 2 : 1;

  for (let b = 0; b < numBeams; b++) {
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const cells = [];
    let cx = bossState.gridX + dir[0];
    let cy = bossState.gridY + dir[1];
    for (let i = 0; i < 10; i++) {
      if (cx <= 0 || cy <= 0 || cx >= 15 || cy >= 15) break;
      if (state.terrain[`${cx},${cy}`] === 'blocked') break;
      cells.push({ x: cx, y: cy });
      cx += dir[0]; cy += dir[1];
    }
    if (cells.length === 0) continue;

    bossState.beamWarnings.push({ cells, expireAt: Date.now() + 1500 });
    addLog('⚠ Faisceau imminent! Cases rouges — évacuez!', 'normal');

    setTimeout(() => {
      if (!bossState?.alive) return;
      bossState.activeBeams.push({ cells, expireAt: Date.now() + 1000 });
    }, 1500);
  }
}

// ─── SENTINELLES : résistance partagée ───────────────────
function onSentinelDeath(deadSentinel) {
  if (!bossState) return;
  bossState.sentinels = bossState.sentinels.filter(s => s.id !== deadSentinel.id);
  bossState.sentinels.forEach(s => {
    const e = state.enemies.find(en => en.id === s.id && en.alive);
    if (e) {
      const dmg = Math.round(e.maxHp * 0.30);
      e.hp = Math.max(1, e.hp - dmg);
      addLog(`Sentinelle affaiblie! −${dmg} PV (résistance partagée)`, 'action');
      spawnFloater(e.gridX, e.gridY, `-${dmg} lié`, '#9b4dca', 12);
    }
  });
}

// ─── PHASE 2 : GRAVITÉ INVERSÉE ──────────────────────────
function enterPhase2(now) {
  addLog('⚡ PHASE 2 — Gravité inversée! Zones bleu-vert = dashes inversés!', 'action');
  bossState.gravityTimer = now;
  spawnGravityZone();
}

function spawnGravityZone() {
  const zone = [];
  const cx = 4 + Math.floor(Math.random() * 7);
  const cy = 4 + Math.floor(Math.random() * 7);
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx > 0 && ny > 0 && nx < 15 && ny < 15 && state.terrain[`${nx},${ny}`] !== 'blocked')
        zone.push({ x: nx, y: ny });
    }
  bossState.gravityZones = [{ cells: zone, active: true }];
  state.bossGravityZones = bossState.gravityZones;
}

function tickGravity(now) {
  const interval = bossState.playerCount >= 4 ? 14000 : 20000;
  if (now - bossState.gravityTimer > interval) {
    bossState.gravityTimer = now;
    bossState.gravityActive = !bossState.gravityActive;
    if (bossState.gravityActive) {
      spawnGravityZone();
      addLog('🌀 Gravité inversée ACTIVE!', 'action');
    } else {
      bossState.gravityZones = [];
      state.bossGravityZones = [];
      addLog('Gravité normalisée.', 'normal');
    }
  }
}

// ─── PHASE 3 : BOUCLIER + BALAYAGE ───────────────────────
function enterPhase3() {
  addLog('☀ PHASE 3 — Activez le nœud de lumière pour blesser le boss!', 'action');
  spawnShieldNode();
}

function spawnShieldNode() {
  const candidates = [];
  for (let x = 4; x <= 11; x++)
    for (let y = 6; y <= 11; y++)
      if (!state.terrain[`${x},${y}`] && !state.enemies.some(e => e.alive && e.gridX === x && e.gridY === y))
        candidates.push({ x, y });
  if (candidates.length === 0) return;
  const node = candidates[Math.floor(Math.random() * candidates.length)];
  bossState.shieldNode = { x: node.x, y: node.y, activated: false };
  bossState.shieldNodeTimer = Date.now();
  state.bossShieldNode = bossState.shieldNode;
  addLog(`☀ Nœud apparu! Approchez-vous de (${node.x},${node.y}) en 5s!`, 'action');
}

function tickShieldNode(now) {
  if (!bossState.shieldNode) {
    spawnShieldNode();
    return;
  }
  if (bossState.shieldNode.activated) {
    if (now - bossState.shieldNodeTimer > 10000) spawnShieldNode();
    return;
  }
  const n = bossState.shieldNode;
  const dist = Math.abs(state.player.gridX - n.x) + Math.abs(state.player.gridY - n.y);
  if (dist <= 1) {
    bossState.shieldNode.activated = true;
    bossState.shieldNodeTimer = now;
    state.bossShieldNode = null;
    const bossEnemy = state.enemies.find(e => e.id === 'boss_architecte');
    if (bossEnemy) {
      const dmg = Math.round(bossState.hpMax * 0.10);
      bossEnemy.hp = Math.max(0, bossEnemy.hp - dmg);
      spawnFloater(bossState.gridX, bossState.gridY, `-${dmg} ☀`, '#f1c40f', 18);
      addLog(`☀ Nœud activé! −${dmg} dégâts de lumière au boss!`, 'action');
    }
    if (typeof gainXP === 'function') gainXP(50);
  } else if (now - bossState.shieldNodeTimer > bossState.shieldNodeDuration) {
    bossState.shieldNode = null;
    state.bossShieldNode = null;
    addLog('⚠ Nœud expiré! Le boss récupère 5% PV.', 'normal');
    const bossEnemy = state.enemies.find(e => e.id === 'boss_architecte');
    if (bossEnemy) bossEnemy.hp = Math.min(bossEnemy.maxHp, bossEnemy.hp + Math.round(bossState.hpMax * 0.05));
  }
}

function tickCircularSweep(now) {
  if (now - bossState.sweepTimer < bossState.sweepInterval) return;
  bossState.sweepTimer = now;
  const radius = 1 + Math.floor(Math.random() * 4);
  const ring = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) === radius) {
        const nx = bossState.gridX + dx, ny = bossState.gridY + dy;
        if (nx > 0 && ny > 0 && nx < 15 && ny < 15)
          ring.push({ x: nx, y: ny });
      }
    }
  state.highlight = { type: 'telegraph', cells: ring, expireAt: now + 3000 };
  addLog(`⚡ Balayage circulaire (rayon ${radius})! Évacuez!`, 'normal');
  setTimeout(() => {
    if (!bossState?.alive) return;
    ring.forEach(c => {
      if (c.x === state.player.gridX && c.y === state.player.gridY) {
        const dmg = Math.round(60 + Math.random() * 40);
        state.hp = Math.max(1, state.hp - dmg);
        updateHpUI();
        spawnFloater(c.x, c.y, `-${dmg}⚡`, '#9b4dca', 14);
        addLog(`⚡ Balayage! −${dmg} PV`, 'normal');
      }
    });
  }, 1500);
}

// ─── DESSIN PORTAIL (monde principal) ────────────────────
function drawPortal(ctx, gx, gy) {
  // Ne dessiner le portail que si on est dans le monde principal
  if (bossRoom?.active) return;

  const { x, y } = gridToIso(gx, gy);
  const cx = x, cy = y + CELL_H / 2;
  const t = performance.now() / 1000;
  const pulse = 0.7 + 0.3 * Math.sin(t * 3);
  const spin = t * 1.5;

  // Glow au sol
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
  grad.addColorStop(0, `rgba(150,50,220,${0.85 * pulse})`);
  grad.addColorStop(0.5, `rgba(80,20,160,${0.5 * pulse})`);
  grad.addColorStop(1, 'rgba(20,5,40,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 26 * pulse, 13 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();

  // Anneaux rotatifs
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy - 4);
    ctx.rotate(spin + i * (Math.PI * 2 / 3));
    ctx.strokeStyle = `rgba(${i===0?'200,80,255':i===1?'100,180,255':'255,100,200'},${0.6 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 - i*2, 8 - i, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Symbole central
  ctx.font = 'bold 16px serif';
  ctx.fillStyle = `rgba(220,150,255,${pulse})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚿', cx, cy - 8);

  // Labels
  ctx.font = 'bold 8px "Cinzel",serif';
  ctx.fillStyle = `rgba(200,169,110,${0.85 * pulse})`;
  ctx.fillText('DONJON', cx, cy - 26);
  ctx.font = '7px serif';
  ctx.fillStyle = `rgba(180,100,220,${0.7})`;
  ctx.fillText('Entrez pour combattre', cx, cy - 18);
}

// ─── DESSIN BOSS (dans la salle boss) ────────────────────
function drawBossOnGrid(ctx) {
  if (!bossRoom?.active || !bossState?.alive) return;

  const bossEnemy = state.enemies.find(e => e.id === 'boss_architecte' && e.alive);
  if (!bossEnemy) return;

  const { x, y } = gridToIso(bossState.gridX, bossState.gridY);
  const cx = x, cy = y + CELL_H / 2;
  const t = performance.now() / 1000;
  const pulse = 0.4 + 0.6 * Math.sin(t * 2);

  const phaseColor = bossState.phase === 1 ? '#9b4dca'
    : bossState.phase === 2 ? '#4ecdc4' : '#f1c40f';

  // Ombre sol
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 30, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(155,77,202,${0.35 * pulse})`;
  ctx.fill();

  // Glyphe boss
  ctx.font = '26px serif';
  ctx.fillStyle = phaseColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙', cx, cy - 12);

  ctx.font = '7px "Cinzel",serif';
  ctx.fillStyle = phaseColor;
  ctx.fillText(`PHASE ${bossState.phase}`, cx, cy - 30);

  // Barre PV
  const bw = 54, bh = 6;
  const bx = cx - bw / 2, by = cy - 44;
  const hpPct = bossEnemy.hp / bossEnemy.maxHp;
  ctx.fillStyle = '#1a0505'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = hpPct > 0.6 ? '#9b4dca' : hpPct > 0.3 ? '#4ecdc4' : '#f1c40f';
  ctx.fillRect(bx, by, bw * hpPct, bh);
  ctx.strokeStyle = '#3a0a5a'; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by, bw, bh);

  ctx.font = '8px "Cinzel",serif';
  ctx.fillStyle = '#c8b090'; ctx.globalAlpha = 0.9;
  ctx.fillText("L'Architecte", cx, cy - 50);
  ctx.globalAlpha = 1;

  // ── Faisceaux warnings (rouge) ──
  const now = Date.now();
  bossState.beamWarnings.forEach(beam => {
    if (now < beam.expireAt) {
      beam.cells.forEach(c => {
        isoPath(c.x, c.y);
        ctx.fillStyle = 'rgba(200,20,20,0.45)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,50,50,0.85)'; ctx.lineWidth = 1.2; ctx.stroke();
      });
    }
  });

  // ── Faisceaux actifs (violet) ──
  bossState.activeBeams.forEach(beam => {
    if (now < beam.expireAt) {
      beam.cells.forEach(c => {
        isoPath(c.x, c.y);
        ctx.fillStyle = 'rgba(155,77,202,0.75)'; ctx.fill();
      });
    }
  });

  // ── Zones de gravité (bleu-vert) ──
  bossState.gravityZones.forEach(gz => {
    gz.cells.forEach(c => {
      isoPath(c.x, c.y);
      ctx.fillStyle = 'rgba(78,205,196,0.18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(78,205,196,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
    });
    if (gz.cells.length > 0) {
      const mid = gz.cells[Math.floor(gz.cells.length / 2)];
      const mp = gridToIso(mid.x, mid.y);
      ctx.font = '8px serif';
      ctx.fillStyle = 'rgba(78,205,196,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('🌀 Gravité inversée', mp.x, mp.y);
    }
  });

  // ── Nœud de bouclier (or) ──
  if (bossState.shieldNode && !bossState.shieldNode.activated) {
    const n = bossState.shieldNode;
    const np = gridToIso(n.x, n.y);
    const ncx = np.x, ncy = np.y + CELL_H / 2;
    const np2 = 0.6 + 0.4 * Math.sin(t * 6);
    const ng = ctx.createRadialGradient(ncx, ncy, 0, ncx, ncy, 18);
    ng.addColorStop(0, `rgba(241,196,15,${0.9 * np2})`);
    ng.addColorStop(1, 'rgba(241,196,15,0)');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.arc(ncx, ncy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.font = '16px serif';
    ctx.fillStyle = `rgba(241,196,15,${np2})`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☀', ncx, ncy - 2);
    const elapsed = Date.now() - bossState.shieldNodeTimer;
    const remaining = Math.max(0, (bossState.shieldNodeDuration - elapsed) / 1000).toFixed(1);
    ctx.font = '9px "Cinzel",serif';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`${remaining}s`, ncx, ncy - 22);
  }

  // ── Décor de la salle : label sortie ──
  drawBossRoomLabel(ctx);
}

function drawBossRoomLabel(ctx) {
  // Label sortie en bas
  const exitIso = gridToIso(7, 14);
  ctx.font = '8px "Cinzel",serif';
  ctx.fillStyle = 'rgba(200,169,110,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('[ F ] Fuir', exitIso.x, exitIso.y - 4);
}

// ─── PORTAIL : détection marche dessus ───────────────────
// Redirige vers le donjon (défini dans dungeon.js)
function checkPlayerOnPortal(gx, gy) {
  if (typeof checkPlayerOnPortalExtended === 'function') {
    checkPlayerOnPortalExtended(gx, gy);
  }
}

// Fuite avec touche F
function tryFleeBoss() {
  if (!bossRoom?.active) return;
  exitBossRoom(false);
}

// ─── UI BOSS HUD ──────────────────────────────────────────
function showBossUI() {
  const el = document.getElementById('boss-hud');
  if (el) el.style.display = 'block';
  updateBossUI();
}

function hideBossUI() {
  const el = document.getElementById('boss-hud');
  if (el) el.style.display = 'none';
}

function updateBossUI() {
  const el = document.getElementById('boss-hud');
  if (!el || !bossState) return;
  const bossEnemy = state.enemies.find(e => e.id === 'boss_architecte');
  if (!bossEnemy) return;

  const hpPct = Math.max(0, (bossEnemy.hp / bossEnemy.maxHp) * 100).toFixed(1);
  const phaseNames = ['','Faisceaux & Sentinelles','Gravité Inversée','Bouclier & Balayage'];
  const phaseColors = ['','#9b4dca','#4ecdc4','#f1c40f'];
  const pc = phaseColors[bossState.phase];

  el.innerHTML = `
    <div class="boss-name">⚙ L'ARCHITECTE FRACTURÉ ★★★</div>
    <div class="boss-phase" style="color:${pc}">Phase ${bossState.phase} — ${phaseNames[bossState.phase]}</div>
    <div class="boss-hp-bar-wrap">
      <div class="boss-hp-bar" style="width:${hpPct}%;background:${pc};"></div>
    </div>
    <div class="boss-hp-text">${bossEnemy.hp.toLocaleString()} / ${bossEnemy.maxHp.toLocaleString()} PV</div>
    ${bossState.sentinels.length > 0
      ? `<div class="boss-sentinels">Sentinelles: ${bossState.sentinels.length} (résistance partagée)</div>` : ''}
    <div style="margin-top:4px;font-size:8px;color:#3a2a40;font-style:italic;">[ F ] pour fuir</div>
  `;
}