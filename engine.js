// ═══════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════
// Global dungeon state (populated by dungeon.js)
var dungeonState = null;

let state = {
  selectedClass: null,
  player: { gridX:7, gridY:7, px:0, py:0, fromPx:0, fromPy:0, toPx:0, toPy:0, t:1, stepDuration:280, stepStart:0, moving:false, path:[], bobPhase:0, location:'overworld' },
  resource: { val:0, max:100 },
  hp:100, hpMax:100, armor:0, baseArmor:0,
  buffs: {
    damage_mult:1, armor_bonus:0, fusionActive:false, raged:false,
    defensiveStance:false, rootSelf:false, animalForm:false,
    eclipseActive:false, eclipseNextSkillDouble:false,
    mirrorNext:false,
    martyrTarget:null,
    linkedEnemy:null, // for link_vital
    grandeToile:false, grandeToileEnd:0,
    shieldCharges:0, shieldType:'',   // 'peau_voile' or 'fire' or 'divine'
    totemActive:false, totemEnd:0,
    summons:[], // wolves
    lightBastionCells:[], lightBastionEnd:0,
    martyrEnd:0,
    symbiosis:false, symbiosisTarget:null,
    auraProtection:false, auraEnd:0,
    animalFormEnd:0,
  },
  equippedSkillIds: ['','',''],
  showGrid:false, showStats:false, showSkillTree:false, showTalentTree:false,
  cooldowns:{},
  highlight:{ type:null, cells:[], expireAt:0 },
  // ─── SYSTÈME DE GROUPE ─────────────────────────────────────
  group: { members: [], partyLeaderId: null },
  dungeonRequest: null,  // { fromSessionId, fromName, dungeonType, timestamp }
  // ───────────────────────────────────────────────────────────
  enemies:[
    { id:'e1', gridX:3, gridY:4, hp:200, maxHp:200, armor:15, type:'fracture', alive:true, name:'Fracturé sauvage', debuffs:{} },
    { id:'e2', gridX:11, gridY:6, hp:280, maxHp:280, armor:20, type:'gloom', alive:true, name:'Revenant boisé', debuffs:{} },
    { id:'e3', gridX:10, gridY:5, hp:150, maxHp:150, armor:10, type:'revenant', alive:true, name:'Éclat vivant', debuffs:{} },
    { id:'e4', gridX:5, gridY:12, hp:340, maxHp:340, armor:25, type:'arcane', alive:true, name:'Construct arcanique', debuffs:{} },
    { id:'e5', gridX:13, gridY:9, hp:180, maxHp:180, armor:8, type:'fracture', alive:true, name:'Gardien de faille', debuffs:{} },
    { id:'d1', gridX:13, gridY:13, hp:1000000, maxHp:1000000, armor:1000, type:'dummy', alive:true, name:'Mannequin I', debuffs:{}, isDummy:true },
    { id:'d2', gridX:13, gridY:14, hp:1000000, maxHp:1000000, armor:1000, type:'dummy', alive:true, name:'Mannequin II', debuffs:{}, isDummy:true },
    { id:'d3', gridX:13, gridY:15, hp:1000000, maxHp:1000000, armor:1000, type:'dummy', alive:true, name:'Mannequin III', debuffs:{}, isDummy:true },
  ],
  terrain: generateTerrain(),
  footprints:[],
  hoveredCell:null,
  targeting:{ active:false, skillIdx:null, previewCells:[] },
  animFrame:0, lastTimestamp:0,
  vfx:[], particles:[],
  opts: { vfx:true, particles:true, deco:true },
  combatStats: { dmgDealt:0, healed:0, kills:0 },
};

// ═══════════════════════════════════════════════════════
// CANVAS SETUP
// ═══════════════════════════════════════════════════════
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const arena = document.getElementById('arena');
  if (!arena) return;
  canvas.width = arena.clientWidth;
  canvas.height = arena.clientHeight;
  state.originX = canvas.width / 2;
  state.originY = canvas.height * 0.22;
  initPlayerPixelPos();
}

function gridToIso(gx, gy) {
  return { x: state.originX + (gx-gy)*(CELL_W/2), y: state.originY + (gx+gy)*(CELL_H/2) };
}
function isoToGrid(px, py) {
  const rx=px-state.originX, ry=py-state.originY;
  return { gx:Math.floor((rx/(CELL_W/2)+ry/(CELL_H/2))/2), gy:Math.floor((ry/(CELL_H/2)-rx/(CELL_W/2))/2) };
}
function cellCenter(gx,gy) { const iso=gridToIso(gx,gy); return {x:iso.x,y:iso.y+CELL_H/2}; }

// ═══════════════════════════════════════════════════════
// A* PATHFINDING
// ═══════════════════════════════════════════════════════
function aStar(sx,sy,ex,ey) {
  if(ex<0||ey<0||ex>=GRID_SIZE||ey>=GRID_SIZE) return [];
  if(state.terrain[`${ex},${ey}`]==='blocked') return [];
  const key=(x,y)=>`${x},${y}`;
  const open=[{x:sx,y:sy,g:0,h:0,f:0,parent:null}];
  const closed=new Set();
  const openMap={[key(sx,sy)]:open[0]};
  const h=(x,y)=>Math.abs(x-ex)+Math.abs(y-ey);
  const dirs=[[0,1],[0,-1],[1,0],[-1,0]];
  while(open.length>0){
    open.sort((a,b)=>a.f-b.f);
    const cur=open.shift(); const ck=key(cur.x,cur.y);
    if(closed.has(ck)) continue; closed.add(ck);
    if(cur.x===ex&&cur.y===ey){
      const path=[]; let node=cur;
      while(node){path.unshift({x:node.x,y:node.y});node=node.parent;}
      return path.slice(1);
    }
    for(const [dx,dy] of dirs){
      const nx=cur.x+dx, ny=cur.y+dy, nk=key(nx,ny);
      if(nx<0||ny<0||nx>=GRID_SIZE||ny>=GRID_SIZE||closed.has(nk)) continue;
      if(state.terrain[nk]==='blocked') continue;
      const hasEnemy=state.enemies.some(e=>e.alive&&e.gridX===nx&&e.gridY===ny);
      if(hasEnemy&&!(nx===ex&&ny===ey)) continue;
      const g=cur.g+1,hv=h(nx,ny),f=g+hv;
      if(!openMap[nk]||openMap[nk].f>f){
        const node={x:nx,y:ny,g,h:hv,f,parent:cur};
        openMap[nk]=node; open.push(node);
      }
    }
  }
  return [];
}

// ═══════════════════════════════════════════════════════
// DAMAGE / HEAL
// ═══════════════════════════════════════════════════════
function calcDamage(raw, targetArmor, armorPenPct=0) {
  const v = 0.85 + Math.random()*0.3;
  const effArmor = Math.max(0, targetArmor*(1-armorPenPct/100));
  const red = effArmor/(effArmor+100);
  // Item bonuses
  const atkBonus = typeof getItemAtk === 'function' ? getItemAtk() : 0;
  const dmgPct   = typeof getItemDmgPct === 'function' ? getItemDmgPct() : 0;
  const finalRaw = (raw + atkBonus) * (1 + dmgPct);
  return Math.max(1, Math.round(finalRaw*v*(1-red)));
}
function calcHeal(raw) { return Math.round(raw*(0.9+Math.random()*0.2)); }

// ═══════════════════════════════════════════════════════
// ENEMY HELPERS
// ═══════════════════════════════════════════════════════
function findEnemyAt(gx,gy) { return state.enemies.find(e=>e.alive&&e.gridX===gx&&e.gridY===gy)||null; }

function applyDamageToEnemy(enemy, dmg) {
  if (!enemy.alive) return;
  if (enemy.debuffs.immortal) { spawnFloater(enemy.gridX,enemy.gridY,'IMMORTEL','#4ecdc4',11); return; }
  state.combatStats.dmgDealt = (state.combatStats.dmgDealt||0) + dmg;
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.hitReceived();
  enemy.hp = Math.max(0, enemy.hp-dmg);

  // Link vital: heal player for 30% of damage
  if (state.buffs.linkedEnemy && state.buffs.linkedEnemy.id === enemy.id && state.buffs.linkedEnemyEnd > Date.now()) {
    const lheal = Math.round(dmg * 0.3);
    state.hp = Math.min(state.hpMax, state.hp + lheal);
    updateHpUI();
    if (lheal > 0) spawnFloater(state.player.gridX, state.player.gridY, `+${lheal}🕸`, '#4ecdc4', 10);
  }

  // Grande Toile: player healed when enemies attack (handled in enemy turn)
  if (enemy.hp <= 0) {
    if (enemy.isDummy) {
      enemy.hp = enemy.maxHp;
      addLog(`${enemy.name} résiste! PV réinitialisés.`, 'action');
    } else {
      enemy.alive = false;
      state.combatStats.kills = (state.combatStats.kills||0) + 1;
      if (typeof AudioEngine !== 'undefined') AudioEngine.play.enemyDeath();
      addLog(`${enemy.name} éliminé!`, 'action');
      if (enemy.isSentinel && typeof onSentinelDeath === 'function') onSentinelDeath(enemy);
      // XP on kill
      if (typeof gainXP === 'function' && !enemy.isBoss) gainXP(20 + Math.floor(Math.random()*15));
      // LOOT on kill
      if (typeof onEnemyKilled === 'function') onEnemyKilled(enemy);
    }
  }
}

function knockbackEnemy(enemy, dx, dy, distance) {
  for(let i=0;i<distance;i++){
    const nx=enemy.gridX+dx, ny=enemy.gridY+dy;
    if(nx<0||ny<0||nx>=GRID_SIZE||ny>=GRID_SIZE) break;
    if(state.terrain[`${nx},${ny}`]==='blocked') break;
    if(state.enemies.some(e=>e.alive&&e!==enemy&&e.gridX===nx&&e.gridY===ny)) break;
    enemy.gridX=nx; enemy.gridY=ny;
  }
}

// ═══════════════════════════════════════════════════════
// SKILL HELPERS
// ═══════════════════════════════════════════════════════
function getEquippedSkills() {
  return state.equippedSkillIds.map(id => {
    if (!id || !state.selectedClass) return null;
    const pool = ALL_SKILLS[state.selectedClass];
    return pool ? pool.find(s=>s.id===id)||null : null;
  });
}
function getSkillBySlot(slotIdx) {
  const id = state.equippedSkillIds[slotIdx];
  if (!id || !state.selectedClass) return null;
  const pool = ALL_SKILLS[state.selectedClass];
  return pool ? pool.find(s=>s.id===id)||null : null;
}
function getCellsInRange(cx, cy, range) {
  const cells=[];
  for(let dx=-range;dx<=range;dx++)
    for(let dy=-range;dy<=range;dy++)
      if(Math.abs(dx)+Math.abs(dy)<=range){
        const nx=cx+dx, ny=cy+dy;
        if(nx>=0&&ny>=0&&nx<GRID_SIZE&&ny<GRID_SIZE) cells.push({x:nx,y:ny});
      }
  return cells;
}
function getLineCells(fromX, fromY, toX, toY, maxLen=6) {
  const cells=[];
  const dx=Math.sign(toX-fromX), dy=Math.sign(toY-fromY);
  if(dx===0&&dy===0) return cells;
  let cx=fromX+dx, cy=fromY+dy;
  for(let i=0;i<maxLen;i++){
    if(cx<0||cy<0||cx>=GRID_SIZE||cy>=GRID_SIZE) break;
    cells.push({x:cx,y:cy});
    if(state.terrain[`${cx},${cy}`]==='blocked') break;
    cx+=dx; cy+=dy;
  }
  return cells;
}

// ═══════════════════════════════════════════════════════
// RESOURCE
// ═══════════════════════════════════════════════════════
function regenResource(amount) {
  if (!state.selectedClass) return;
  const cls = CLASSES[state.selectedClass];
  state.resource.val = Math.max(0, Math.min(cls.resource.max, state.resource.val+amount));
  updateResourceUI();
}

let resourceTimer = null;
function startResourceRegen() {
  if (resourceTimer) clearInterval(resourceTimer);
  resourceTimer = setInterval(() => {
    if (!state.selectedClass) return;
    const cls = CLASSES[state.selectedClass];
    if (cls.resource.regen !== 0) regenResource(cls.resource.regen * 0.5);

    // Mage: surchauffe tick damage
    if (state.selectedClass==='mage' && state.resource.val>=100) {
      const dmg = Math.round(state.hpMax*0.015);
      state.hp = Math.max(1, state.hp-dmg);
      updateHpUI();
      spawnFloater(state.player.gridX,state.player.gridY,`-${dmg}🔥`,'#e67e22',11);
    }
    // Fracturé: instabilité >80 tick damage
    if (state.selectedClass==='fracture' && state.resource.val>80 && state.resource.val<100) {
      const dmg = Math.round(state.hpMax*0.005);
      state.hp = Math.max(1, state.hp-dmg);
      updateHpUI();
    }
    // Paladin: foi drain
    if (state.selectedClass==='paladin') regenResource(-0.25);

    // Totem de régénération tick
    if (state.buffs.totemActive && Date.now() < state.buffs.totemEnd) {
      const heal = calcHeal(15);
      state.hp = Math.min(state.hpMax, state.hp + heal);
      updateHpUI();
      spawnFloater(state.player.gridX,state.player.gridY,`+${heal}🍄`,'#27ae60',11);
    } else if (state.buffs.totemActive && Date.now() >= state.buffs.totemEnd) {
      state.buffs.totemActive = false;
    }

    // Defensive stance tick
    if (state.buffs.defensiveStance) regenResource(10);
    // Root self buff tick
    if (state.buffs.rootSelf) regenResource(10);

    // Summons tick
    tickSummons();

    // Grande Toile expiry
    if (state.buffs.grandeToile && Date.now() > state.buffs.grandeToileEnd) {
      state.buffs.grandeToile = false;
      addLog('Grande Toile expirée.', 'normal');
    }

    // Aura protection expiry
    if (state.buffs.auraProtection && Date.now() > state.buffs.auraEnd) {
      state.buffs.auraProtection = false;
      addLog('Aura de protection expirée.', 'normal');
      updateBuffDisplay();
    }

    // Animal form expiry
    if (state.buffs.animalForm && Date.now() > state.buffs.animalFormEnd) {
      endAnimalForm();
    }

    // Martyr expiry
    if (state.buffs.martyrTarget && Date.now() > state.buffs.martyrEnd) {
      state.buffs.martyrTarget = null;
      addLog('Martyr expiré.', 'normal');
      updateBuffDisplay();
    }

    updateHpUI();
    updateResourceUI();
  }, 500);
}

function tickSummons() {
  if (!state.buffs.summons || state.buffs.summons.length === 0) return;
  const now = Date.now();
  state.buffs.summons = state.buffs.summons.filter(s => s.alive && now < s.expiresAt);
  for (const summon of state.buffs.summons) {
    // Find nearest enemy
    const alive = state.enemies.filter(e => e.alive && !e.isDummy);
    if (alive.length === 0) continue;
    const target = alive.reduce((a, b) => {
      const da = Math.abs(a.gridX-summon.x)+Math.abs(a.gridY-summon.y);
      const db = Math.abs(b.gridX-summon.x)+Math.abs(b.gridY-summon.y);
      return da < db ? a : b;
    });
    const dist = Math.abs(target.gridX-summon.x)+Math.abs(target.gridY-summon.y);
    if (dist <= 2) {
      const dmg = calcDamage(30, target.armor);
      applyDamageToEnemy(target, dmg);
      spawnFloater(target.gridX, target.gridY, `-${dmg}🐺`, '#27ae60', 11);
    } else {
      // Move toward target
      if (Math.abs(target.gridX-summon.x) > Math.abs(target.gridY-summon.y)) {
        summon.x += Math.sign(target.gridX-summon.x);
      } else {
        summon.y += Math.sign(target.gridY-summon.y);
      }
    }
  }
}

function endAnimalForm() {
  if (!state.buffs.animalForm) return;
  state.buffs.animalForm = false;
  addLog('Forme animale terminée.', 'normal');
  updateBuffDisplay();
}

let cdTimer = null;
function startCooldownTicker() {
  if (cdTimer) clearInterval(cdTimer);
  cdTimer = setInterval(() => {
    let changed = false;
    for (const k in state.cooldowns) {
      if (state.cooldowns[k] > 0) {
        state.cooldowns[k] = Math.max(0, state.cooldowns[k]-0.1);
        changed = true;
      }
    }
    if (changed) { renderSkills(); if (typeof renderSkillBar === 'function') renderSkillBar(); }
  }, 100);
}

// ═══════════════════════════════════════════════════════
// BUFF DISPLAY
// ═══════════════════════════════════════════════════════
function updateBuffDisplay() {
  const container = document.getElementById('active-buffs');
  if (!container) return;
  const buffs = [];
  if (state.buffs.damage_mult > 1) buffs.push({ icon:'⚔', label:`DMG ×${state.buffs.damage_mult.toFixed(1)}`, color:'#e67e22' });
  if (state.buffs.fusionActive) buffs.push({ icon:'🔥', label:'FUSION ×2', color:'#ff4400' });
  if (state.buffs.raged) buffs.push({ icon:'💪', label:'RAGE +40%', color:'#e74c3c' });
  if (state.buffs.defensiveStance) buffs.push({ icon:'🛡', label:'MUR DE CHAIR', color:'#e74c3c' });
  if (state.buffs.animalForm) buffs.push({ icon:'🐺', label:'FORME ANIMALE', color:'#27ae60' });
  if (state.buffs.eclipseActive) buffs.push({ icon:'🌑', label:'ÉCLIPSE', color:'#8e44ad' });
  if (state.buffs.grandeToile) buffs.push({ icon:'🕸', label:'GRANDE TOILE', color:'#4ecdc4' });
  if (state.buffs.totemActive) buffs.push({ icon:'🍄', label:'TOTEM', color:'#27ae60' });
  if (state.buffs.auraProtection) buffs.push({ icon:'✨', label:'AURA –15%', color:'#f1c40f' });
  if (state.buffs.martyrTarget) buffs.push({ icon:'💛', label:'MARTYR', color:'#f1c40f' });
  if (state.buffs.shieldCharges > 0) buffs.push({ icon:'🛡', label:`BOUCLIER ×${state.buffs.shieldCharges}`, color:'#3060a0' });
  if (state.buffs.summons && state.buffs.summons.length > 0) buffs.push({ icon:'🐺', label:`LOUPS ×${state.buffs.summons.length}`, color:'#27ae60' });

  container.innerHTML = buffs.map(b => `<div class="buff-chip" style="background:rgba(5,3,2,0.9);border-color:${b.color}40;color:${b.color};">${b.icon} ${b.label}</div>`).join('');
}

// ═══════════════════════════════════════════════════════
// MOVEMENT
// ═══════════════════════════════════════════════════════
function easeInOut(t) { return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }

function initPlayerPixelPos() {
  const iso = gridToIso(state.player.gridX, state.player.gridY);
  const px=iso.x, py=iso.y+CELL_H/2;
  Object.assign(state.player, {px,py,fromPx:px,fromPy:py,toPx:px,toPy:py,t:1});
}

function startMoving(path) {
  if (state.buffs.defensiveStance || state.buffs.rootSelf) {
    addLog('Vous êtes immobilisé!', 'normal'); return;
  }
  if (!path || path.length===0) { state.player.path=[]; return; }
  state.player.path = path; state.player.moving = true; beginNextStep();
}

function beginNextStep() {
  const p = state.player;
  if (p.path.length===0) { p.moving=false; return; }
  const next = p.path[0];
  p.fromPx=p.px; p.fromPy=p.py;
  const iso = gridToIso(next.x, next.y);
  p.toPx=iso.x; p.toPy=iso.y+CELL_H/2;
  const dist = Math.hypot(p.toPx-p.fromPx, p.toPy-p.fromPy);
  const cls = CLASSES[state.selectedClass];
  let speed = cls ? cls.speed : 3;
  if (state.buffs.animalForm) speed *= 1.5;
  const ppc = Math.hypot(CELL_W, CELL_H)/2;
  p.stepDuration = Math.max(60, (dist/(speed*ppc))*1000);
  p.t=0; p.stepStart=performance.now();
}

function updateMovement(timestamp) {
  const p = state.player;
  if (!p.moving && p.t>=1) return;
  const dt = (timestamp-state.lastTimestamp)/1000;
  if (p.moving || p.t<1) p.bobPhase += dt*12;
  else p.bobPhase *= 0.85;
  if (p.t>=1) return;
  const elapsed = timestamp-p.stepStart;
  p.t = Math.min(1, elapsed/p.stepDuration);
  const ease = easeInOut(p.t);
  p.px = p.fromPx+(p.toPx-p.fromPx)*ease;
  p.py = p.fromPy+(p.toPy-p.fromPy)*ease;
  if (p.t>=1) {
    p.px=p.toPx; p.py=p.toPy;
    const arrived = p.path.shift();
    if (arrived) {
      p.gridX=arrived.x; p.gridY=arrived.y;
      if (state.selectedClass) {
        const cls = CLASSES[state.selectedClass];
        addFootprint(p.px+(Math.random()-0.5)*6, p.py+(Math.random()-0.5)*3, cls.color);
      }
      if (state.selectedClass==='druide') regenResource(1);
      if (state.terrain[`${arrived.x},${arrived.y}`]==='veil') addLog('Case de Voile — +20% dégâts!','action');
      // Portal check — boss room teleport
      if (typeof checkPlayerOnPortal === 'function') checkPlayerOnPortal(arrived.x, arrived.y);

      // Animal form: heal on contact with enemies
      if (state.buffs.animalForm) {
        const adj = state.enemies.filter(e=>e.alive&&Math.abs(e.gridX-p.gridX)+Math.abs(e.gridY-p.gridY)<=1);
        adj.forEach(en=>{
          const dmg = calcDamage(60, en.armor);
          applyDamageToEnemy(en, dmg);
          spawnFloater(en.gridX,en.gridY,`-${dmg}🐺`,'#27ae60',13);
        });
        if (adj.length > 0) {
          const heal = calcHeal(20);
          state.hp = Math.min(state.hpMax, state.hp+heal);
          updateHpUI();
        }
      }

      // Summons follow player
      if (state.buffs.summons) {
        state.buffs.summons.forEach((s,i) => { s.x = p.gridX + (i%2===0?1:-1); s.y = p.gridY + (i<2?1:-1); });
      }
    }
    if (p.path.length > 0) beginNextStep();
    else { p.moving=false; addLog(`Arrivé en (${p.gridX}, ${p.gridY}).`,'normal'); }
  }
}

// ═══════════════════════════════════════════════════════
// TARGETING
// ═══════════════════════════════════════════════════════
function enterTargetingMode(slotIdx) {
  if (!state.selectedClass) return;
  const skill = getSkillBySlot(slotIdx);
  if (!skill) { addLog(`Aucun skill en slot ${slotIdx+1}. Ouvrez l'arbre (S).`,'normal'); return; }
  const cdKey = skill.id;
  if (state.cooldowns[cdKey] > 0) { addLog(`${skill.name} en recharge! (${state.cooldowns[cdKey].toFixed(1)}s)`,'normal'); return; }
  const autoApply = ['self','zone_self','zone_all'].includes(skill.targetType);
  if (autoApply) { executeSkill(slotIdx, state.player.gridX, state.player.gridY, null); return; }
  state.targeting.active = true;
  state.targeting.skillIdx = slotIdx;
  state.targeting.previewCells = [];
  document.getElementById('targeting-indicator').style.display = 'block';
  const rangeCells = getCellsInRange(state.player.gridX, state.player.gridY, skill.range);
  state.highlight = { type:'range', cells:rangeCells };
  renderSkills();
  addLog(`${skill.name} — Cliquez sur la cible (portée: ${skill.range} cases).`,'action');
}

function cancelTargeting() {
  state.targeting.active = false;
  state.targeting.skillIdx = null;
  state.targeting.previewCells = [];
  document.getElementById('targeting-indicator').style.display = 'none';
  state.highlight = { type:null, cells:[] };
  renderSkills();
}

// ═══════════════════════════════════════════════════════
// FLOATERS
// ═══════════════════════════════════════════════════════
function spawnFloater(gx, gy, text, color, size=16) {
  const iso = gridToIso(gx, gy);
  const arena = document.getElementById('arena');
  const arenaBounds = arena.getBoundingClientRect();
  const canvasBounds = canvas.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  el.style.cssText = `left:${canvasBounds.left-arenaBounds.left+iso.x-20}px;top:${canvasBounds.top-arenaBounds.top+iso.y-20+(Math.random()-0.5)*10}px;color:${color};font-size:${size}px;text-shadow:0 0 8px ${color}88;`;
  arena.appendChild(el);
  setTimeout(()=>el.remove(), 1300);
}

// ═══════════════════════════════════════════════════════
// VFX
// ═══════════════════════════════════════════════════════
function spawnParticles(cx,cy,count,color,opts={}) {
  if (!state.opts.particles) return;
  for (let i=0;i<count;i++) {
    const a=(Math.PI*2*i/count)+(Math.random()-0.5)*0.8;
    const sp=(opts.speed||60)*(0.5+Math.random());
    state.particles.push({x:cx+(Math.random()-0.5)*(opts.scatter||8),y:cy+(Math.random()-0.5)*(opts.scatter||4),vx:Math.cos(a)*sp*(opts.spread||1),vy:Math.sin(a)*sp*(opts.spread||1)*0.45,life:1,decay:opts.decay||(1.5+Math.random()),size:opts.size||(3+Math.random()*4),color,glow:opts.glow||false,gravity:opts.gravity||0,shape:opts.shape||'circle'});
  }
}
function spawnVFX(type,cells,cx,cy,duration,color,extra={}) {
  if (!state.opts.vfx) return;
  state.vfx.push({type,cells,cx,cy,born:performance.now(),duration,color,extra});
}
function tickVFX() { const now=performance.now(); state.vfx=state.vfx.filter(v=>now-v.born<v.duration); }
function tickParticles(dt) {
  for (const p of state.particles) {
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.gravity*dt;
    p.vx*=(1-dt*3); p.vy*=(1-dt*2); p.life-=p.decay*dt;
  }
  state.particles = state.particles.filter(p=>p.life>0);
}

function triggerSkillVFX(slotIdx, skill, tgx, tgy) {
  if (!state.selectedClass || !state.opts.vfx) return;
  const cls = CLASSES[state.selectedClass];
  const p = state.player;
  const color = cls.color;
  switch(skill.effect) {
    case 'damage': case 'debuff_armor': case 'holy_strike': case 'judgment':
    case 'stun_strike': case 'double_strike': case 'ignite': case 'eviscerate':
    case 'execution': case 'death_mark': case 'link_vital': case 'divine_shield':
      spawnVFX('impact',[{x:tgx,y:tgy}],p.px,p.py,600,color,{});
      spawnParticles(p.px,p.py,10,color,{speed:80,glow:true,shape:'spark',decay:2.5}); break;
    case 'zone_ultimate': case 'zone_damage': case 'nova_rupture': case 'heat_wave':
    case 'crusade': case 'zone_storm': case 'grande_toile': case 'zone_explode_heal':
    case 'zone_pull': case 'mass_regen':
      spawnVFX('explosion',getCellsInRange(tgx,tgy,3),p.px,p.py,1200,color,{gx:tgx,gy:tgy,radius:3});
      spawnParticles(p.px,p.py,25,color,{speed:130,glow:true,decay:1.2,size:6}); break;
    case 'fireball': case 'meteor':
      spawnVFX('explosion',getCellsInRange(tgx,tgy,2),p.px,p.py,1000,'#ff6600',{gx:tgx,gy:tgy,radius:2});
      spawnParticles(p.px,p.py,15,'#ff6600',{speed:90,glow:true,decay:2,shape:'spark'}); break;
    case 'heal': case 'consecration': case 'regen_anchor': case 'place_totem': case 'symbiosis':
      spawnVFX('heal',[{x:tgx,y:tgy}],p.px,p.py,1100,color,{});
      spawnParticles(p.px,p.py,12,color,{speed:40,glow:true,decay:1,shape:'star',size:4,gravity:-30}); break;
    case 'dash': case 'blade_dash': case 'teleport': case 'eclipse':
      spawnParticles(p.px,p.py,18,color,{speed:120,spread:0.8,glow:true,decay:2,shape:'spark'}); break;
    case 'fusion': case 'buff_damage': case 'rage_buff': case 'buff_resistance':
    case 'defensive_stance': case 'root_self_buff': case 'animal_form': case 'shield_absorb':
    case 'fire_shield': case 'aura_protection': case 'martyr': case 'mirror_skill':
      spawnVFX('flash',[],p.px,p.py,500,color,{});
      spawnParticles(p.px,p.py,20,color,{speed:100,glow:true,decay:1.5,shape:'star',size:5}); break;
    case 'summon_wolves':
      spawnVFX('explosion',[],p.px,p.py,800,'#27ae60',{gx:p.gridX,gy:p.gridY,radius:2});
      spawnParticles(p.px,p.py,15,'#27ae60',{speed:80,glow:true,decay:1.5}); break;
    default:
      spawnParticles(p.px,p.py,8,color,{speed:60,glow:true,decay:2});
  }
}

// ═══════════════════════════════════════════════════════
// FOOTPRINTS
// ═══════════════════════════════════════════════════════
function addFootprint(px,py,color) {
  let r=100,g=80,b=50;
  if(color){r=parseInt(color.slice(1,3),16)||100;g=parseInt(color.slice(3,5),16)||80;b=parseInt(color.slice(5,7),16)||50;}
  state.footprints.push({px,py:py+4,r,g,b,alpha:0.4,angle:(Math.random()-0.5)*0.8});
  if(state.footprints.length>40) state.footprints.shift();
}
function tickFootprints(dt) {
  for(const fp of state.footprints) fp.alpha-=dt*0.35;
  state.footprints = state.footprints.filter(fp=>fp.alpha>0);
}

// ═══════════════════════════════════════════════════════
// DRAW GRID & ENTITIES
// ═══════════════════════════════════════════════════════
function isoPath(gx,gy) {
  const {x,y}=gridToIso(gx,gy); const hw=CELL_W/2, hh=CELL_H/2;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+hw,y+hh);ctx.lineTo(x,y+CELL_H);ctx.lineTo(x-hw,y+hh);ctx.closePath();
}

function drawCell(gx,gy,topColor,edgeColor,sideColor) {
  const {x,y}=gridToIso(gx,gy); const hw=CELL_W/2, hh=CELL_H/2, depth=10;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+hw,y+hh);ctx.lineTo(x,y+CELL_H);ctx.lineTo(x-hw,y+hh);ctx.closePath();ctx.fillStyle=topColor;ctx.fill();
  ctx.beginPath();ctx.moveTo(x+hw,y+hh);ctx.lineTo(x+hw,y+hh+depth);ctx.lineTo(x,y+CELL_H+depth);ctx.lineTo(x,y+CELL_H);ctx.closePath();ctx.fillStyle=sideColor;ctx.fill();
  ctx.beginPath();ctx.moveTo(x,y+CELL_H);ctx.lineTo(x,y+CELL_H+depth);ctx.lineTo(x-hw,y+hh+depth);ctx.lineTo(x-hw,y+hh);ctx.closePath();ctx.fillStyle=edgeColor;ctx.fill();
}

function drawGrid() {
  if (!canvas.width) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const tactical = state.showGrid;

  if (tactical) {
    ctx.fillStyle = '#04060a'; ctx.fillRect(0,0,canvas.width,canvas.height);
  } else {
    // Rich atmospheric background
    const grad=ctx.createRadialGradient(state.originX,state.originY+80,0,state.originX,state.originY+80,620);
    grad.addColorStop(0,'#1a0c06');grad.addColorStop(0.4,'#100807');grad.addColorStop(0.8,'#080406');grad.addColorStop(1,'#030102');
    ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height);
    // Atmospheric fog/veil haze
    const veilGrd=ctx.createRadialGradient(state.originX,state.originY+120,0,state.originX,state.originY+120,380);
    veilGrd.addColorStop(0,'rgba(60,15,100,0.07)'); veilGrd.addColorStop(1,'transparent');
    ctx.fillStyle=veilGrd; ctx.fillRect(0,0,canvas.width,canvas.height);
    // Torch warm glow areas (overlay, rendered before cells)
    for(const d of DECORATIONS){
      if(d.type==='torch'){
        const iso=gridToIso(d.gx,d.gy);
        const grd=ctx.createRadialGradient(iso.x+8,iso.y-8,0,iso.x+8,iso.y-8,60);
        const flk=0.6+0.4*Math.sin(performance.now()*0.008+d.gx*2.3);
        grd.addColorStop(0,`rgba(255,160,40,${0.08*flk})`); grd.addColorStop(1,'transparent');
        ctx.fillStyle=grd; ctx.fillRect(0,0,canvas.width,canvas.height);
      }
    }
  }

  const highlightSet=new Set(state.highlight.cells.map(c=>`${c.x},${c.y}`));
  const previewSet=new Set(state.targeting.previewCells.map(c=>`${c.x},${c.y}`));

  const cells=[];
  for(let gy=0;gy<GRID_SIZE;gy++) for(let gx=0;gx<GRID_SIZE;gx++) cells.push({gx,gy});
  cells.sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy));

  for(const {gx,gy} of cells) {
    const k=`${gx},${gy}`;
    const terrain=state.terrain[k];
    const isHovered=state.hoveredCell&&state.hoveredCell.gx===gx&&state.hoveredCell.gy===gy;
    const isHighlighted=highlightSet.has(k);
    const isPreview=previewSet.has(k);
    const isPath=state.player.path.some(p=>p.x===gx&&p.y===gy);
    const isDummyZone=(gx>=12&&gx<=15&&gy>=12&&gy<=15);
    const isBastion=state.buffs.lightBastionCells&&state.buffs.lightBastionCells.some(c=>c.x===gx&&c.y===gy)&&Date.now()<state.buffs.lightBastionEnd;

    let topColor,edgeColor,sideColor;
    if(terrain==='blocked'){
      // Draw a raised stone wall instead of a flat dark cell
      topColor=tactical?'#0d0d12':'#2a2230'; edgeColor=tactical?'#060608':'#140f1c'; sideColor=tactical?'#0a0a10':'#1c1528';
    } else if(terrain==='veil'){
      topColor=tactical?'#0d0520':'#2a0a4a'; edgeColor=tactical?'#060210':'#0d0320'; sideColor=tactical?'#0a0418':'#1a0535';
    } else if(terrain==='path'){
      // Sandy dirt path
      topColor=tactical?'#0a1018':'#2a1e10'; edgeColor=tactical?'#050810':'#160f07'; sideColor=tactical?'#080e14':'#1e1610';
    } else if(isDummyZone&&!tactical){
      topColor='#201808'; edgeColor='#100c04'; sideColor='#180e05';
    } else {
      topColor=tactical?'#0a1018':'#1a1424'; edgeColor=tactical?'#050810':'#080610'; sideColor=tactical?'#080e14':'#120e1c';
    }

    if(isHighlighted){
      if(state.highlight.type==='telegraph'){topColor=tactical?'#200808':'#4a0a0a';edgeColor='#180303';sideColor='#300505';}
      else if(state.highlight.type==='fire'){topColor='#3a0800';edgeColor='#180300';sideColor='#280500';}
      else if(state.highlight.type==='heal'){topColor='#08200a';edgeColor='#041008';sideColor='#061508';}
      else{topColor=tactical?'#050f20':'#0a1a3a';edgeColor='#050a18';sideColor='#0a1530';}
    }
    if(isBastion){topColor='#202808';edgeColor='#0f1404';sideColor='#191f06';}
    if(isPath) topColor=blendColor(topColor,'#3a2a10',0.5);
    if(isPreview&&!isHighlighted) topColor=blendColor(topColor,'#1a2a0a',0.4);

    drawCell(gx,gy,topColor,edgeColor,sideColor);

    // Rock wall visual for blocked cells (drawn over the cell)
    if(terrain==='blocked'&&!tactical){
      const {x,y}=gridToIso(gx,gy);
      const hw=CELL_W/2, hh=CELL_H/2;
      const wallH=20;
      ctx.save();
      // Left wall face
      ctx.beginPath();
      ctx.moveTo(x-hw,y+hh-wallH); ctx.lineTo(x,y+CELL_H-wallH);
      ctx.lineTo(x,y+CELL_H); ctx.lineTo(x-hw,y+hh);
      ctx.closePath();
      ctx.fillStyle='#1c1830'; ctx.fill();
      // Right wall face
      ctx.beginPath();
      ctx.moveTo(x+hw,y+hh-wallH); ctx.lineTo(x,y+CELL_H-wallH);
      ctx.lineTo(x,y+CELL_H); ctx.lineTo(x+hw,y+hh);
      ctx.closePath();
      ctx.fillStyle='#251f3c'; ctx.fill();
      // Wall top (raised surface)
      ctx.beginPath();
      ctx.moveTo(x,y-wallH); ctx.lineTo(x+hw,y+hh-wallH);
      ctx.lineTo(x,y+CELL_H-wallH); ctx.lineTo(x-hw,y+hh-wallH);
      ctx.closePath();
      ctx.fillStyle='#332840'; ctx.fill();
      // Stone texture lines on top
      ctx.strokeStyle='rgba(80,60,100,0.6)'; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(x-hw*0.5,y+hh*0.5-wallH); ctx.lineTo(x+hw*0.5,y+hh*0.5-wallH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-hw*0.7,y+hh*0.8-wallH); ctx.lineTo(x+hw*0.7,y+hh*0.8-wallH); ctx.stroke();
      // Outline
      ctx.strokeStyle='rgba(100,80,140,0.4)'; ctx.lineWidth=0.8;
      ctx.beginPath();
      ctx.moveTo(x,y-wallH); ctx.lineTo(x+hw,y+hh-wallH); ctx.lineTo(x,y+CELL_H-wallH); ctx.lineTo(x-hw,y+hh-wallH); ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if(tactical){
      isoPath(gx,gy);
      ctx.strokeStyle=terrain==='blocked'?'rgba(50,50,80,0.4)':terrain==='veil'?'rgba(100,30,180,0.5)':isDummyZone?'rgba(180,140,30,0.35)':'rgba(40,80,140,0.35)';
      ctx.lineWidth=0.8; ctx.stroke();
      const {x,y}=gridToIso(gx,gy);
      ctx.fillStyle='rgba(60,100,140,0.3)'; ctx.font='7px monospace'; ctx.textAlign='center';
      ctx.fillText(`${gx},${gy}`,x,y+CELL_H/2+3);
    }

    if(isHovered&&terrain!=='blocked'){isoPath(gx,gy);ctx.fillStyle='rgba(200,169,110,0.12)';ctx.fill();}
    if(isPreview&&state.targeting.active){
      isoPath(gx,gy);
      const skill=getSkillBySlot(state.targeting.skillIdx);
      ctx.strokeStyle=skill&&skill.targetType==='enemy'?'rgba(220,60,30,0.9)':skill&&skill.targetType==='any'?'rgba(80,200,80,0.9)':'rgba(100,160,220,0.9)';
      ctx.lineWidth=1.5; ctx.stroke();
    }
    if(terrain==='veil'&&!tactical){
      const {x,y}=gridToIso(gx,gy);
      const pulse=0.5+0.5*Math.sin(performance.now()*0.002+gx+gy);
      ctx.fillStyle=`rgba(150,50,220,${0.5+0.3*pulse})`;
      ctx.globalAlpha=0.6; ctx.font='10px serif'; ctx.textAlign='center';
      ctx.fillText('✦',x,y+CELL_H/2+4); ctx.globalAlpha=1;
    }
    if(isBastion){
      isoPath(gx,gy); ctx.strokeStyle='rgba(200,220,80,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
    }
  }

  // Decorations
  if (state.opts.deco && !tactical && !dungeonState?.active && !bossRoom?.active) {
    const sortedDeco=[...DECORATIONS].sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy));
    sortedDeco.forEach(d=>{ if(!state.terrain[`${d.gx},${d.gy}`]) drawDecoration(d); });
  }

  drawFootprints();
  drawPath();

  // Training zone border (only on main map)
  if (!tactical && !dungeonState?.active && !bossRoom?.active) {
    const corners=[[12,12],[15,12],[15,15],[12,15]];
    ctx.strokeStyle='rgba(180,140,30,0.25)'; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    const pts=corners.map(([x,y])=>gridToIso(x,y));
    ctx.beginPath();
    ctx.moveTo(pts[0].x,pts[0].y);
    ctx.lineTo(pts[1].x+CELL_W/2,pts[1].y+CELL_H/2);
    ctx.lineTo(pts[2].x,pts[2].y+CELL_H);
    ctx.lineTo(pts[3].x-CELL_W/2,pts[3].y+CELL_H/2);
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    const liso=gridToIso(14,12);
    ctx.fillStyle='rgba(180,140,30,0.4)'; ctx.font="9px 'Cinzel',serif"; ctx.textAlign='center';
    ctx.fillText('⚔ ENTRAÎNEMENT',liso.x,liso.y-8);
  }

  // Summons
  if (state.buffs.summons) {
    for (const summon of state.buffs.summons) {
      const iso=gridToIso(summon.x,summon.y);
      const cx=iso.x, cy=iso.y+CELL_H/2;
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(cx,cy+3,8,3,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#27ae60';
      ctx.beginPath(); ctx.arc(cx,cy-8,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='10px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🐺',cx,cy-8);
      // HP bar mini
      ctx.fillStyle='#1a3020'; ctx.fillRect(cx-10,cy-20,20,3);
      ctx.fillStyle='#27ae60'; ctx.fillRect(cx-10,cy-20,20*(summon.hp/summon.maxHp),3);
      ctx.restore();
    }
  }

  // Enemies
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (enemy.isBoss) continue; // drawn separately by drawBossOnGrid()
    const iso=gridToIso(enemy.gridX,enemy.gridY);
    const ecx=iso.x, ecy=iso.y+CELL_H/2;
    let ecolor = enemy.isDummy ? '#8a7040' : ({'fracture':'#9b4dca','gloom':'#e74c3c','revenant':'#27ae60','arcane':'#4ecdc4'}[enemy.type]||'#e74c3c');

    // Status rings
    if(enemy.debuffs.rooted){ctx.beginPath();ctx.ellipse(ecx,ecy+2,14,5,0,0,Math.PI*2);ctx.fillStyle='rgba(39,174,96,0.5)';ctx.fill();}
    if(enemy.debuffs.slow){ctx.beginPath();ctx.ellipse(ecx,ecy+2,14,5,0,0,Math.PI*2);ctx.fillStyle='rgba(78,205,196,0.4)';ctx.fill();}
    if(enemy.debuffs.stunned){ctx.beginPath();ctx.ellipse(ecx,ecy+2,14,5,0,0,Math.PI*2);ctx.fillStyle='rgba(255,220,0,0.5)';ctx.fill();}
    if(enemy.debuffs.poisoned){ctx.beginPath();ctx.ellipse(ecx,ecy+2,14,5,0,0,Math.PI*2);ctx.fillStyle='rgba(140,60,200,0.4)';ctx.fill();}
    if(enemy.debuffs.immortal){ctx.beginPath();ctx.ellipse(ecx,ecy+2,14,5,0,0,Math.PI*2);ctx.fillStyle='rgba(78,205,196,0.7)';ctx.fill();}
    if(enemy.debuffs.judged){ctx.beginPath();ctx.ellipse(ecx,ecy+2,14,5,0,0,Math.PI*2);ctx.fillStyle='rgba(241,196,15,0.4)';ctx.fill();}

    if (enemy.isDummy) drawDummy(ecx, ecy);
    else {
      const enemyBob = -Math.abs(Math.sin(performance.now()*0.003+enemy.id.charCodeAt(0)))*2;
      drawPixelEnemy(ecx, ecy, enemy.type, enemyBob, performance.now()/1000);
    }

    // HP bar
    const bw=34, bx=ecx-bw/2, by=ecy-24;
    const hpPct=enemy.hp/enemy.maxHp;
    ctx.fillStyle=tactical?'#1a0505':'#200808'; ctx.fillRect(bx,by,bw,4);
    ctx.fillStyle=enemy.isDummy?'#b08030':(hpPct>0.5?'#e74c3c':hpPct>0.25?'#e67e22':'#ff0000');
    ctx.fillRect(bx,by,bw*hpPct,4);
    ctx.strokeStyle='#3a0808'; ctx.lineWidth=0.5; ctx.strokeRect(bx,by,bw,4);

    if(state.hoveredCell&&state.hoveredCell.gx===enemy.gridX&&state.hoveredCell.gy===enemy.gridY){
      ctx.font='9px "Cinzel",serif'; ctx.fillStyle='#e8dcc8'; ctx.globalAlpha=0.9; ctx.textAlign='center';
      ctx.fillText(enemy.name,ecx,ecy-30);
      if(enemy.isDummy) ctx.fillText(`DGT: ${(enemy.maxHp-enemy.hp).toLocaleString()}`,ecx,ecy-20);
      else ctx.fillText(`${enemy.hp}/${enemy.maxHp} PV | ARM:${enemy.armor}`,ecx,ecy-20);
      ctx.globalAlpha=1;
    }
  }

  // Remote players — only render if same location as local player
  if (window.multiState) {
    const _myZone = state.player?.location || 'overworld';
    for (const [_pid, rp] of Object.entries(window.multiState.remotePlayers||{})) {
      if ((rp.location || 'overworld') !== _myZone) continue;
      const iso=gridToIso(rp.x||7,rp.y||7);
      const rcx=iso.x, rcy=iso.y+CELL_H/2;
      const rcls = rp.classId ? CLASSES[rp.classId] : null;
      const rcolor = rcls ? rcls.color : '#00ccff';
      drawEntityAt(rcx,rcy,rcolor,'\u25c7',false,0,1,null);
      ctx.font='8px "Cinzel",serif'; ctx.fillStyle=rcolor; ctx.globalAlpha=0.8; ctx.textAlign='center';
      ctx.fillText(rp.name||'Alli\xe9',rcx,rcy-24); ctx.globalAlpha=1;
    }
  }
  // Player
  if (state.selectedClass) {
    const cls=CLASSES[state.selectedClass];
    const p=state.player;
    const isMoving=p.t<1||p.path.length>0;
    const bob=isMoving?-Math.abs(Math.sin(p.bobPhase))*4:0;
    const shadowScale=isMoving?0.65+0.35*(1-Math.abs(bob)/4):1;

    // Eclipse visual
    if (state.buffs.eclipseActive) {
      const pulse=0.4+0.6*Math.sin(performance.now()*0.005);
      ctx.beginPath(); ctx.arc(p.px,p.py,28,0,Math.PI*2);
      ctx.fillStyle=`rgba(80,20,140,${0.3*pulse})`; ctx.fill();
    }

    if(state.armor>0){
      ctx.beginPath(); ctx.ellipse(p.px,p.py+2,19,7,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(100,150,220,${Math.min(0.7,state.armor/100)})`; ctx.lineWidth=1.5; ctx.stroke();
    }
    if(state.buffs.eclipseActive){
      drawPlayerCharacter(p.px,p.py,'#6030a0',bob,shadowScale,state.selectedClass);
    } else {
      drawPlayerCharacter(p.px,p.py,cls.color,bob,shadowScale,state.selectedClass);
    }

    if(tactical){
      ctx.font='8px "Cinzel",serif'; ctx.fillStyle='#00ccff'; ctx.globalAlpha=0.8; ctx.textAlign='center';
      ctx.fillText(cls.name,p.px,p.py-28); ctx.globalAlpha=1;
    }
  }

  // Highlight overlay
  if(state.highlight.type==='range'||state.highlight.type==='fire'||state.highlight.type==='heal'){
    const col=state.highlight.type==='fire'?'rgba(200,100,0,':state.highlight.type==='heal'?'rgba(40,160,80,':'rgba(100,180,255,';
    for(const c of state.highlight.cells){
      isoPath(c.x,c.y); ctx.fillStyle=col+'0.18)'; ctx.fill();
      ctx.strokeStyle=col+'0.45)'; ctx.lineWidth=0.8; ctx.stroke();
    }
  }
}

function drawDecoration(deco) {
  const iso=gridToIso(deco.gx,deco.gy);
  const cx=iso.x, cy=iso.y;
  const t=performance.now()/1000;
  ctx.save();
  switch(deco.type) {
    case 'tree': {
      // Pixel-art style tree
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx+3,cy+18,12,4,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#3a2008'; ctx.fillRect(cx-3,cy-4,6,20);
      // Foliage layers
      ctx.fillStyle='#1a3a10'; ctx.beginPath(); ctx.ellipse(cx,cy-10,20,14,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#22481a'; ctx.beginPath(); ctx.ellipse(cx-2,cy-16,15,10,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#2a5520'; ctx.beginPath(); ctx.ellipse(cx+1,cy-22,10,8,0,0,Math.PI*2); ctx.fill();
      // Light spots
      ctx.fillStyle='rgba(100,200,60,0.15)'; ctx.beginPath(); ctx.ellipse(cx-4,cy-18,6,4,0.3,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'bush': {
      ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(cx+2,cy+6,14,5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1a2a10'; ctx.beginPath(); ctx.ellipse(cx,cy,14,10,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#253818'; ctx.beginPath(); ctx.ellipse(cx-4,cy-2,9,7,0.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+5,cy-3,8,6,-0.3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(60,120,30,0.2)'; ctx.beginPath(); ctx.ellipse(cx-2,cy-4,5,4,0,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'house': {
      // Medieval stone house
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx+3,cy+20,26,8,0,0,Math.PI*2); ctx.fill();
      // Walls
      ctx.fillStyle='#3a3040'; ctx.beginPath();
      ctx.moveTo(cx-20,cy-5); ctx.lineTo(cx+20,cy-5);
      ctx.lineTo(cx+20,cy+15); ctx.lineTo(cx-20,cy+15); ctx.closePath(); ctx.fill();
      // Side wall (darker)
      ctx.fillStyle='#2a2030';
      ctx.beginPath(); ctx.moveTo(cx+20,cy-5); ctx.lineTo(cx+28,cy); ctx.lineTo(cx+28,cy+20); ctx.lineTo(cx+20,cy+15); ctx.closePath(); ctx.fill();
      // Roof (steep medieval style)
      ctx.fillStyle='#5a1a10';
      ctx.beginPath(); ctx.moveTo(cx-22,cy-5); ctx.lineTo(cx,cy-28); ctx.lineTo(cx+22,cy-5); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#6a2010'; // ridge highlight
      ctx.beginPath(); ctx.moveTo(cx-2,cy-5); ctx.lineTo(cx,cy-28); ctx.lineTo(cx+2,cy-5); ctx.closePath(); ctx.fill();
      // Roof side
      ctx.fillStyle='#3a1008';
      ctx.beginPath(); ctx.moveTo(cx+22,cy-5); ctx.lineTo(cx+30,cy); ctx.lineTo(cx+8,cy-20); ctx.lineTo(cx,cy-28); ctx.closePath(); ctx.fill();
      // Door
      ctx.fillStyle='#1a0c08';
      ctx.beginPath(); ctx.moveTo(cx-5,cy+15); ctx.lineTo(cx-5,cy+2); ctx.arc(cx,cy+2,5,Math.PI,0); ctx.lineTo(cx+5,cy+15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#2a1808'; ctx.lineWidth=0.5; ctx.stroke();
      // Window
      ctx.fillStyle='#c8a050'; ctx.globalAlpha=0.6;
      ctx.fillRect(cx-16,cy-2,8,7);
      ctx.strokeStyle='#3a2010'; ctx.lineWidth=0.5; ctx.strokeRect(cx-16,cy-2,8,7);
      ctx.globalAlpha=1;
      // Stone texture
      ctx.strokeStyle='rgba(40,30,50,0.4)'; ctx.lineWidth=0.5;
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.moveTo(cx-20,cy-5+i*6); ctx.lineTo(cx+20,cy-5+i*6); ctx.stroke();
      }
      break;
    }
    case 'house_small': {
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx+2,cy+16,18,5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#383040';
      ctx.beginPath(); ctx.moveTo(cx-14,cy-2); ctx.lineTo(cx+14,cy-2); ctx.lineTo(cx+14,cy+12); ctx.lineTo(cx-14,cy+12); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#4a1a0c';
      ctx.beginPath(); ctx.moveTo(cx-16,cy-2); ctx.lineTo(cx,cy-20); ctx.lineTo(cx+16,cy-2); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#1a0c08';
      ctx.fillRect(cx-4,cy+2,8,10);
      ctx.fillStyle='#b08040'; ctx.globalAlpha=0.5;
      ctx.fillRect(cx-12,cy,7,5);
      ctx.globalAlpha=1;
      break;
    }
    case 'chapel': {
      // Small chapel with bell tower
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx,cy+22,24,7,0,0,Math.PI*2); ctx.fill();
      // Nave
      ctx.fillStyle='#2e2840'; ctx.beginPath();
      ctx.moveTo(cx-18,cy); ctx.lineTo(cx+18,cy); ctx.lineTo(cx+18,cy+18); ctx.lineTo(cx-18,cy+18); ctx.closePath(); ctx.fill();
      // Nave roof
      ctx.fillStyle='#5a2040';
      ctx.beginPath(); ctx.moveTo(cx-20,cy); ctx.lineTo(cx,cy-14); ctx.lineTo(cx+20,cy); ctx.closePath(); ctx.fill();
      // Bell tower
      ctx.fillStyle='#3a3050'; ctx.fillRect(cx-7,cy-30,14,32);
      ctx.fillStyle='#5a3060';
      ctx.beginPath(); ctx.moveTo(cx-8,cy-30); ctx.lineTo(cx,cy-44); ctx.lineTo(cx+8,cy-30); ctx.closePath(); ctx.fill();
      // Cross
      ctx.strokeStyle='#f1c40f'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(cx,cy-44); ctx.lineTo(cx,cy-38); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-4,cy-42); ctx.lineTo(cx+4,cy-42); ctx.stroke();
      // Rose window
      ctx.fillStyle='#c87030'; ctx.globalAlpha=0.7;
      ctx.beginPath(); ctx.arc(cx,cy-4,5,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      // Bell (small)
      ctx.fillStyle='#c8a030'; ctx.beginPath(); ctx.arc(cx,cy-24,3,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'tavern': {
      // Medieval tavern / inn
      ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx+4,cy+20,28,7,0,0,Math.PI*2); ctx.fill();
      // Base (larger building)
      ctx.fillStyle='#3a2a20'; ctx.beginPath();
      ctx.moveTo(cx-22,cy-6); ctx.lineTo(cx+22,cy-6); ctx.lineTo(cx+22,cy+16); ctx.lineTo(cx-22,cy+16); ctx.closePath(); ctx.fill();
      // Side
      ctx.fillStyle='#2a1c14'; ctx.beginPath();
      ctx.moveTo(cx+22,cy-6); ctx.lineTo(cx+30,cy-1); ctx.lineTo(cx+30,cy+21); ctx.lineTo(cx+22,cy+16); ctx.closePath(); ctx.fill();
      // Thatched roof
      ctx.fillStyle='#6a4820';
      ctx.beginPath(); ctx.moveTo(cx-24,cy-6); ctx.lineTo(cx,cy-30); ctx.lineTo(cx+24,cy-6); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#3a2810'; ctx.beginPath();
      ctx.moveTo(cx+24,cy-6); ctx.lineTo(cx+32,cy-1); ctx.lineTo(cx+8,cy-22); ctx.lineTo(cx,cy-30); ctx.closePath(); ctx.fill();
      // Thatch texture lines
      ctx.strokeStyle='rgba(100,70,20,0.4)'; ctx.lineWidth=0.8;
      for(let i=0;i<5;i++){
        const ly=cy-6+(cy-6-cy+30)*i/5;
        ctx.beginPath(); ctx.moveTo(cx-24+i*4,cy-6); ctx.lineTo(cx-12+i*4,ly); ctx.stroke();
      }
      // Sign hanging
      ctx.fillStyle='#2a1808'; ctx.fillRect(cx+10,cy-22,12,8);
      ctx.fillStyle='#c8a050'; ctx.globalAlpha=0.8;
      ctx.beginPath(); ctx.arc(cx+14,cy-20,2,0,Math.PI*2); ctx.fill(); // barrel icon
      ctx.globalAlpha=1;
      ctx.strokeStyle='#3a2010'; ctx.lineWidth=0.5; ctx.strokeRect(cx+10,cy-22,12,8);
      // Door (arched)
      ctx.fillStyle='#120a04'; ctx.beginPath();
      ctx.moveTo(cx-5,cy+16); ctx.lineTo(cx-5,cy+2); ctx.arc(cx,cy+2,5,Math.PI,0); ctx.lineTo(cx+5,cy+16); ctx.closePath(); ctx.fill();
      // Windows with warm light
      ctx.fillStyle='#ffb040'; ctx.globalAlpha=0.5;
      ctx.fillRect(cx-18,cy-2,9,8); ctx.fillRect(cx+10,cy-2,9,8);
      ctx.globalAlpha=1;
      ctx.strokeStyle='#2a1808'; ctx.lineWidth=0.5;
      ctx.strokeRect(cx-18,cy-2,9,8); ctx.strokeRect(cx+10,cy-2,9,8);
      // Merchant indicator (pulsing gold badge)
      const pulse = 0.7 + 0.3*Math.sin(Date.now()/500);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏪', cx, cy-34);
      ctx.globalAlpha = 0.8*pulse;
      ctx.fillStyle='#f1c40f'; ctx.font='bold 7px Cinzel,serif';
      ctx.fillText('MARCHAND', cx, cy-43);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      break;
    }
    case 'market': {
      // Market stall / awning
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx,cy+12,22,6,0,0,Math.PI*2); ctx.fill();
      // Table
      ctx.fillStyle='#3a2808'; ctx.fillRect(cx-16,cy+2,32,6);
      ctx.fillStyle='#2a1c04'; ctx.fillRect(cx-16,cy+8,32,4);
      // Legs
      ctx.fillStyle='#1a1004'; ctx.fillRect(cx-14,cy+12,3,6); ctx.fillRect(cx+11,cy+12,3,6);
      // Awning poles
      ctx.strokeStyle='#2a1808'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(cx-15,cy+2); ctx.lineTo(cx-15,cy-14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+15,cy+2); ctx.lineTo(cx+15,cy-14); ctx.stroke();
      // Awning fabric (striped)
      ctx.fillStyle='#8a1a10';
      ctx.beginPath(); ctx.moveTo(cx-16,cy-14); ctx.lineTo(cx+16,cy-14); ctx.lineTo(cx+18,cy+2); ctx.lineTo(cx-18,cy+2); ctx.closePath(); ctx.fill();
      // Stripes
      ctx.fillStyle='rgba(255,200,80,0.25)'; ctx.lineWidth=4;
      for(let i=-1;i<=1;i++){
        ctx.beginPath(); ctx.moveTo(cx+i*10,cy-14); ctx.lineTo(cx+i*12,cy+2); ctx.stroke();
      }
      // Goods on table
      ctx.fillStyle='#c83020'; ctx.beginPath(); ctx.arc(cx-8,cy,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#e8a020'; ctx.beginPath(); ctx.arc(cx,cy-1,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#207030'; ctx.beginPath(); ctx.arc(cx+8,cy,3.5,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'well': {
      // Stone well
      ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx+2,cy+14,18,5,0,0,Math.PI*2); ctx.fill();
      // Well base (cylinder)
      ctx.fillStyle='#302838';
      ctx.beginPath(); ctx.ellipse(cx,cy+8,14,5,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.rect(cx-14,cy-8,28,16); ctx.fill();
      ctx.fillStyle='#201c2c';
      ctx.beginPath(); ctx.ellipse(cx,cy-8,14,5,0,0,Math.PI*2); ctx.fill();
      // Stone ring top
      ctx.fillStyle='#3a3448';
      ctx.beginPath(); ctx.ellipse(cx,cy-8,14,5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#4a4458'; ctx.lineWidth=2; ctx.stroke();
      // Inner water
      ctx.fillStyle='#0a1830'; ctx.beginPath(); ctx.ellipse(cx,cy-8,10,3.5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(100,180,255,0.3)'; ctx.beginPath(); ctx.ellipse(cx-2,cy-9,5,1.5,0.3,0,Math.PI*2); ctx.fill();
      // Wooden crossbeam
      ctx.strokeStyle='#3a2208'; ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx-16,cy-18); ctx.lineTo(cx+16,cy-18); ctx.stroke();
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(cx-16,cy-24); ctx.lineTo(cx-16,cy-8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+16,cy-24); ctx.lineTo(cx+16,cy-8); ctx.stroke();
      // Roof peak
      ctx.fillStyle='#4a2810';
      ctx.beginPath(); ctx.moveTo(cx-18,cy-24); ctx.lineTo(cx,cy-34); ctx.lineTo(cx+18,cy-24); ctx.closePath(); ctx.fill();
      // Rope & bucket
      ctx.strokeStyle='#8a6020'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(cx,cy-18); ctx.lineTo(cx,cy-10); ctx.stroke();
      ctx.fillStyle='#4a3010'; ctx.beginPath(); ctx.ellipse(cx,cy-8,4,3,0,0,Math.PI*2); ctx.fill();
      ctx.lineCap='butt';
      break;
    }
    case 'barricade': {
      // Medieval wooden barricade (replaces pillar visually for blocked deco)
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx,cy+6,18,5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#3a2008'; ctx.lineWidth=5; ctx.lineCap='round';
      // X cross logs
      ctx.beginPath(); ctx.moveTo(cx-14,cy); ctx.lineTo(cx+14,cy-10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-14,cy-10); ctx.lineTo(cx+14,cy); ctx.stroke();
      // Horizontal log
      ctx.strokeStyle='#4a2a0a'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(cx-16,cy-5); ctx.lineTo(cx+16,cy-5); ctx.stroke();
      // Stakes
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(cx-8,cy); ctx.lineTo(cx-6,cy-16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+8,cy); ctx.lineTo(cx+6,cy-16); ctx.stroke();
      ctx.lineCap='butt';
      break;
    }
    case 'barrel': {
      ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx+1,cy+9,8,3,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#3a2808';
      ctx.beginPath(); ctx.rect(cx-6,cy-6,12,14); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx,cy-6,6,2.5,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx,cy+8,6,2.5,0,0,Math.PI*2); ctx.fill();
      // Hoops
      ctx.strokeStyle='#1a1008'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.ellipse(cx,cy-2,6.5,2.5,0,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx,cy+3,6.5,2.5,0,0,Math.PI*2); ctx.stroke();
      break;
    }
    case 'haystack': {
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx+2,cy+6,16,5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#6a4010'; ctx.beginPath(); ctx.ellipse(cx,cy,16,10,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#8a5010'; ctx.beginPath(); ctx.ellipse(cx-2,cy-4,12,7,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#a06018'; ctx.beginPath(); ctx.ellipse(cx,cy-8,8,5,0,0,Math.PI*2); ctx.fill();
      // Straw lines
      ctx.strokeStyle='rgba(200,150,30,0.3)'; ctx.lineWidth=0.8;
      for(let i=0;i<5;i++){
        ctx.beginPath(); ctx.moveTo(cx-8+i*4,cy-2); ctx.lineTo(cx-6+i*4,cy+4); ctx.stroke();
      }
      break;
    }
    case 'fence': {
      // Wooden fence section
      ctx.strokeStyle='#3a2808'; ctx.lineWidth=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx-12,cy-2); ctx.lineTo(cx+12,cy-2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-12,cy+4); ctx.lineTo(cx+12,cy+4); ctx.stroke();
      ctx.lineWidth=4;
      for(let i=-2;i<=2;i++){
        ctx.beginPath(); ctx.moveTo(cx+i*6,cy+6); ctx.lineTo(cx+i*6,cy-10); ctx.stroke();
        // Pointed top
        ctx.fillStyle='#3a2808';
        ctx.beginPath(); ctx.moveTo(cx+i*6-2,cy-10); ctx.lineTo(cx+i*6,cy-14); ctx.lineTo(cx+i*6+2,cy-10); ctx.closePath(); ctx.fill();
      }
      ctx.lineCap='butt';
      break;
    }
    case 'ruin': {
      ctx.fillStyle='#2a2428'; ctx.beginPath();
      ctx.moveTo(cx-14,cy-4); ctx.lineTo(cx+14,cy-4); ctx.lineTo(cx+12,cy-22); ctx.lineTo(cx+6,cy-18);
      ctx.lineTo(cx,cy-24); ctx.lineTo(cx-6,cy-18); ctx.lineTo(cx-12,cy-22); ctx.closePath(); ctx.fill();
      // Cracked stone texture
      ctx.strokeStyle='rgba(40,30,50,0.5)'; ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(cx-4,cy-8); ctx.lineTo(cx,cy-14); ctx.lineTo(cx+5,cy-10); ctx.stroke();
      break;
    }
    case 'ruin_small': {
      ctx.fillStyle='#252030'; ctx.beginPath();
      ctx.moveTo(cx-8,cy); ctx.lineTo(cx+8,cy); ctx.lineTo(cx+6,cy-12); ctx.lineTo(cx-6,cy-12); ctx.closePath(); ctx.fill();
      break;
    }
    case 'torch': {
      ctx.strokeStyle='#5a3810'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(cx,cy+8); ctx.lineTo(cx,cy-16); ctx.stroke();
      ctx.fillStyle='#4a3010'; ctx.beginPath(); ctx.arc(cx+8,cy-15,4,0,Math.PI*2); ctx.fill();
      const flicker=Math.sin(t*8+deco.gx)*0.3+0.7, flicker2=Math.sin(t*11+deco.gy)*0.2+0.8;
      ctx.globalAlpha=flicker;
      ctx.fillStyle='#ff8020'; ctx.beginPath(); ctx.arc(cx+8,cy-18,3*flicker2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffcc40'; ctx.beginPath(); ctx.arc(cx+8,cy-19,1.5*flicker2,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      const grd=ctx.createRadialGradient(cx+8,cy-18,0,cx+8,cy-18,28);
      grd.addColorStop(0,`rgba(255,140,30,${0.3*flicker})`); grd.addColorStop(1,'transparent');
      ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(cx+8,cy-18,28,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'bones': {
      ctx.strokeStyle='rgba(180,170,140,0.7)'; ctx.lineWidth=2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx-6,cy); ctx.lineTo(cx+6,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-3,cy-4); ctx.lineTo(cx+3,cy+4); ctx.stroke();
      ctx.fillStyle='rgba(180,170,140,0.7)';
      ctx.beginPath(); ctx.arc(cx-6,cy,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6,cy,2,0,Math.PI*2); ctx.fill();
      ctx.lineCap='butt'; break;
    }
    case 'pillar': {
      ctx.fillStyle='#1a0a2a';
      ctx.beginPath(); ctx.moveTo(cx-10,cy+4); ctx.lineTo(cx+10,cy+4); ctx.lineTo(cx+8,cy-24); ctx.lineTo(cx-8,cy-24); ctx.closePath(); ctx.fill();
      const pulse=0.4+0.6*Math.sin(t*2+deco.gx);
      const pgrd=ctx.createRadialGradient(cx,cy-12,0,cx,cy-12,25);
      pgrd.addColorStop(0,`rgba(120,30,200,${0.3*pulse})`); pgrd.addColorStop(1,'transparent');
      ctx.fillStyle=pgrd; ctx.beginPath(); ctx.arc(cx,cy-12,25,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'grave': {
      ctx.fillStyle='#1e1820'; ctx.beginPath();
      ctx.moveTo(cx-7,cy+4); ctx.lineTo(cx+7,cy+4); ctx.lineTo(cx+7,cy-10); ctx.arc(cx,cy-10,7,0,Math.PI,true); ctx.closePath(); ctx.fill();
      // Cross
      ctx.strokeStyle='rgba(100,80,120,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(cx,cy-6); ctx.lineTo(cx,cy-16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-4,cy-12); ctx.lineTo(cx+4,cy-12); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ── PIXEL-ART ENEMY DRAWINGS ────────────────────────────
function drawPixelEnemy(cx, cy, type, bob, t) {
  ctx.save();
  const py = cy + bob;
  switch(type) {
    case 'fracture': {
      // Cracked humanoid with purple energy cracks
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx,cy+4,10,3.5,0,0,Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle='#3a1a5a';
      ctx.beginPath(); ctx.moveTo(cx-6,py-2); ctx.lineTo(cx+6,py-2); ctx.lineTo(cx+5,py+10); ctx.lineTo(cx-5,py+10); ctx.closePath(); ctx.fill();
      // Cracks on body
      ctx.strokeStyle='#9b4dca'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(cx-2,py-2); ctx.lineTo(cx+1,py+4); ctx.lineTo(cx-1,py+10); ctx.stroke();
      ctx.globalAlpha=0.6;
      ctx.beginPath(); ctx.moveTo(cx+3,py+2); ctx.lineTo(cx+5,py+7); ctx.stroke();
      ctx.globalAlpha=1;
      // Head
      ctx.fillStyle='#4a2070';
      ctx.beginPath(); ctx.rect(cx-5,py-14,10,10); ctx.fill();
      // Glowing eyes
      ctx.fillStyle='#cc80ff';
      ctx.beginPath(); ctx.rect(cx-4,py-12,3,2); ctx.fill();
      ctx.beginPath(); ctx.rect(cx+1,py-12,3,2); ctx.fill();
      // Arms
      ctx.strokeStyle='#3a1a5a'; ctx.lineWidth=4; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx-6,py); ctx.lineTo(cx-12,py+5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+6,py); ctx.lineTo(cx+12,py+5); ctx.stroke();
      // Energy glow
      const p = 0.3+0.7*Math.sin(t*3+cx);
      const g = ctx.createRadialGradient(cx,py-8,0,cx,py-8,18);
      g.addColorStop(0,`rgba(155,77,202,${0.2*p})`); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,py-8,18,0,Math.PI*2); ctx.fill();
      ctx.lineCap='butt';
      break;
    }
    case 'gloom': {
      // Spectral red revenant — floaty, ghostly
      ctx.fillStyle='rgba(180,30,30,0.15)'; ctx.beginPath(); ctx.ellipse(cx,cy+3,12,4,0,0,Math.PI*2); ctx.fill();
      // Cloak/body
      const fm = Math.sin(t*2+cy)*1.5;
      ctx.fillStyle='#5a0808';
      ctx.beginPath();
      ctx.moveTo(cx-9,py-2+fm); ctx.lineTo(cx+9,py-2-fm);
      ctx.lineTo(cx+7,py+12+fm*0.5); ctx.lineTo(cx-7,py+12-fm*0.5);
      ctx.closePath(); ctx.fill();
      // Tattered cloak bottom
      ctx.fillStyle='#3a0508';
      for(let i=-1;i<=1;i++){
        ctx.beginPath(); ctx.moveTo(cx+i*4-2,py+12); ctx.lineTo(cx+i*4,py+18+Math.sin(t*2+i)*2);
        ctx.lineTo(cx+i*4+2,py+12); ctx.closePath(); ctx.fill();
      }
      // Head / skull
      ctx.fillStyle='#7a0a0a';
      ctx.beginPath(); ctx.ellipse(cx,py-11,7,8,0,0,Math.PI*2); ctx.fill();
      // Hollow eyes (black sockets)
      ctx.fillStyle='#000';
      ctx.beginPath(); ctx.ellipse(cx-3,py-12,2.5,3,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+3,py-12,2.5,3,0,0,Math.PI*2); ctx.fill();
      // Red glow eyes
      ctx.fillStyle='rgba(255,50,20,0.8)';
      ctx.beginPath(); ctx.ellipse(cx-3,py-12,1.5,2,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx+3,py-12,1.5,2,0,0,Math.PI*2); ctx.fill();
      // Wispy tendrils
      ctx.strokeStyle='rgba(200,30,30,0.3)'; ctx.lineWidth=1.5;
      for(let i=0;i<3;i++){
        const a = t*1.5+i*2;
        ctx.beginPath(); ctx.moveTo(cx,py+8);
        ctx.quadraticCurveTo(cx+Math.cos(a)*14,py+14,cx+Math.cos(a+0.5)*8,py+22);
        ctx.stroke();
      }
      break;
    }
    case 'revenant': {
      // Green crystal shard creature
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx,cy+4,9,3,0,0,Math.PI*2); ctx.fill();
      // Crystal body (angular)
      ctx.fillStyle='#0a3018';
      ctx.beginPath();
      ctx.moveTo(cx,py-16); ctx.lineTo(cx+8,py-4); ctx.lineTo(cx+6,py+10);
      ctx.lineTo(cx-6,py+10); ctx.lineTo(cx-8,py-4); ctx.closePath(); ctx.fill();
      // Crystal facets
      ctx.fillStyle='#157040';
      ctx.beginPath(); ctx.moveTo(cx,py-16); ctx.lineTo(cx+8,py-4); ctx.lineTo(cx+2,py-4); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#1a9050';
      ctx.beginPath(); ctx.moveTo(cx,py-16); ctx.lineTo(cx-8,py-4); ctx.lineTo(cx-2,py-2); ctx.closePath(); ctx.fill();
      // Glow core
      const gp = 0.5+0.5*Math.sin(t*4+cx);
      ctx.fillStyle=`rgba(50,220,120,${0.3*gp})`;
      ctx.beginPath(); ctx.arc(cx,py,5,0,Math.PI*2); ctx.fill();
      // Eyes (two crystal shards glowing)
      ctx.fillStyle='#60ff90';
      ctx.beginPath(); ctx.moveTo(cx-3,py-8); ctx.lineTo(cx-1,py-12); ctx.lineTo(cx+1,py-8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx+3,py-8); ctx.lineTo(cx+5,py-12); ctx.lineTo(cx+7,py-8); ctx.closePath(); ctx.fill();
      break;
    }
    case 'arcane': {
      // Arcane construct — mechanical/golem look
      ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx,cy+5,13,4,0,0,Math.PI*2); ctx.fill();
      // Legs
      ctx.fillStyle='#1a2a3a'; ctx.fillRect(cx-8,py+6,5,10); ctx.fillRect(cx+3,py+6,5,10);
      // Torso (boxy)
      ctx.fillStyle='#1e3a4a';
      ctx.fillRect(cx-10,py-6,20,16);
      // Shoulder plates
      ctx.fillStyle='#2a4a5a'; ctx.fillRect(cx-13,py-8,6,10); ctx.fillRect(cx+7,py-8,6,10);
      // Head (cubic)
      ctx.fillStyle='#16303f'; ctx.fillRect(cx-7,py-20,14,14);
      // Visor / eye slit
      ctx.fillStyle='#4ecdc4'; ctx.globalAlpha=0.9;
      ctx.fillRect(cx-6,py-14,12,4);
      const sweep = (t*60)%12;
      ctx.fillStyle=`rgba(78,205,196,0.4)`;
      ctx.fillRect(cx-6+sweep,py-14,3,4);
      ctx.globalAlpha=1;
      // Rune markings
      ctx.strokeStyle='rgba(78,205,196,0.4)'; ctx.lineWidth=0.8;
      ctx.strokeRect(cx-9,py-5,18,12);
      ctx.beginPath(); ctx.moveTo(cx-4,py-2); ctx.lineTo(cx+4,py+4); ctx.stroke();
      // Energy orb
      const ep = 0.4+0.6*Math.sin(t*5);
      ctx.fillStyle=`rgba(78,205,196,${0.5*ep})`;
      ctx.beginPath(); ctx.arc(cx,py+2,4,0,Math.PI*2); ctx.fill();
      break;
    }
    case 'dummy':
    default: {
      // Training dummy (keep same)
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx,cy+3,14,5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#5a3c10'; ctx.fillRect(cx-3,cy-22,6,28);
      ctx.fillStyle='#4a3010'; ctx.fillRect(cx-12,cy-20,24,5);
      ctx.fillStyle='#b89040'; ctx.beginPath(); ctx.arc(cx,cy-30,9,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#6a4010'; ctx.lineWidth=1.5; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(cx-4,cy-33); ctx.lineTo(cx-2,cy-31); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-2,cy-33); ctx.lineTo(cx-4,cy-31); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+2,cy-33); ctx.lineTo(cx+4,cy-31); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+4,cy-33); ctx.lineTo(cx+2,cy-31); ctx.stroke();
      ctx.lineCap='butt';
    }
  }
  ctx.restore();
}

// ── PLAYER CHARACTER DRAWING ────────────────────────────
function drawPlayerCharacter(cx, cy, color, bob, shadowScale, classId) {
  ctx.save();
  const py = cy + bob;
  const r = 16;

  // Shadow
  ctx.beginPath(); ctx.ellipse(cx,cy+4,r*0.9*shadowScale,r*0.3*shadowScale,0,0,Math.PI*2);
  ctx.fillStyle=`rgba(0,0,0,${0.6*shadowScale})`; ctx.fill();

  // Class halo
  const hg=ctx.createRadialGradient(cx,py,r*0.5,cx,py,r*2.8);
  hg.addColorStop(0,color+'28'); hg.addColorStop(1,'transparent');
  ctx.beginPath(); ctx.arc(cx,py,r*2.8,0,Math.PI*2); ctx.fillStyle=hg; ctx.fill();

  switch(classId) {
    case 'fracture': drawPlayerFracture(cx,py,color,r); break;
    case 'tisseuse': drawPlayerTisseuse(cx,py,color,r); break;
    case 'briseur':  drawPlayerBriseur(cx,py,color,r); break;
    case 'druide':   drawPlayerDruide(cx,py,color,r); break;
    case 'mage':     drawPlayerMage(cx,py,color,r); break;
    case 'paladin':  drawPlayerPaladin(cx,py,color,r); break;
    case 'assassin': drawPlayerAssassin(cx,py,color,r); break;
    default: drawPlayerDefault(cx,py,color,r);
  }
  ctx.restore();
}

function drawPlayerDefault(cx,cy,color,r){
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  const g=ctx.createRadialGradient(cx-r*0.25,cy-r*0.35,0,cx,cy,r);
  g.addColorStop(0,lightenColor(color,0.55)); g.addColorStop(0.6,color); g.addColorStop(1,darkenColor(color,0.4));
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle='#fff'; ctx.globalAlpha=0.9; ctx.font='bold 12px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('◈',cx,cy); ctx.globalAlpha=1;
}

function drawPlayerFracture(cx,cy,color,r){
  // Armored figure with cracks
  ctx.fillStyle=darkenColor(color,0.2);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Chest cracks
  ctx.strokeStyle='rgba(200,150,255,0.8)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cx-4,cy-8); ctx.lineTo(cx+2,cy); ctx.lineTo(cx-2,cy+8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+5,cy-4); ctx.lineTo(cx+8,cy+4); ctx.stroke();
  // Helm
  ctx.fillStyle=lightenColor(color,0.2);
  ctx.beginPath(); ctx.arc(cx,cy-r*0.4,r*0.55,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1.2;ctx.stroke();
  // Visor glow
  ctx.fillStyle='#cc80ff'; ctx.globalAlpha=0.9;
  ctx.fillRect(cx-5,cy-r*0.4-2,10,3);
  ctx.globalAlpha=1;
}

function drawPlayerTisseuse(cx,cy,color,r){
  ctx.fillStyle=darkenColor(color,0.1);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Web pattern
  ctx.strokeStyle='rgba(78,205,196,0.5)'; ctx.lineWidth=0.8;
  const t=performance.now()/1000;
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+t*0.3;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*r*0.9,cy+Math.sin(a)*r*0.9); ctx.stroke();
  }
  // Head
  ctx.fillStyle=lightenColor(color,0.25);
  ctx.beginPath(); ctx.arc(cx,cy-r*0.4,r*0.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1.2;ctx.stroke();
  ctx.fillStyle='#fff'; ctx.globalAlpha=0.9; ctx.font='bold 9px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('◈',cx,cy+r*0.2); ctx.globalAlpha=1;
}

function drawPlayerBriseur(cx,cy,color,r){
  // Heavily armored
  ctx.fillStyle=darkenColor(color,0.3);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Shield
  ctx.fillStyle='#1a4080';
  ctx.beginPath(); ctx.moveTo(cx-r*0.8,cy-r*0.2); ctx.lineTo(cx-r*0.2,cy-r*0.9);
  ctx.lineTo(cx+r*0.2,cy-r*0.7); ctx.lineTo(cx-r*0.2,cy+r*0.6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(100,150,255,0.5)'; ctx.lineWidth=1; ctx.stroke();
  // Helmet crest
  ctx.fillStyle=lightenColor(color,0.1);
  ctx.beginPath(); ctx.arc(cx+r*0.2,cy-r*0.3,r*0.55,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1.2;ctx.stroke();
}

function drawPlayerDruide(cx,cy,color,r){
  ctx.fillStyle=darkenColor(color,0.1);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Leaf/nature motif
  ctx.strokeStyle='rgba(100,220,100,0.4)'; ctx.lineWidth=1;
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4;
    ctx.beginPath();
    ctx.ellipse(cx+Math.cos(a)*r*0.7,cy+Math.sin(a)*r*0.7,5,3,a,0,Math.PI*2); ctx.stroke();
  }
  ctx.fillStyle=lightenColor(color,0.25);
  ctx.beginPath(); ctx.arc(cx,cy-r*0.35,r*0.52,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1.2;ctx.stroke();
  // Antler hint
  ctx.strokeStyle='rgba(80,160,60,0.7)'; ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-4,cy-r*0.8); ctx.lineTo(cx-8,cy-r*1.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-4,cy-r*0.8); ctx.lineTo(cx-10,cy-r); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+4,cy-r*0.8); ctx.lineTo(cx+8,cy-r*1.1); ctx.stroke();
  ctx.lineCap='butt';
}

function drawPlayerMage(cx,cy,color,r){
  ctx.fillStyle=darkenColor(color,0.15);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Fire aura
  const t=performance.now()/1000;
  ctx.strokeStyle=`rgba(255,160,30,${0.3+0.3*Math.sin(t*4)})`; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r+3+Math.sin(t*5)*2,0,Math.PI*2); ctx.stroke();
  // Pointed hat
  ctx.fillStyle='#5a2010';
  ctx.beginPath(); ctx.moveTo(cx-8,cy-r*0.6); ctx.lineTo(cx,cy-r*1.6); ctx.lineTo(cx+8,cy-r*0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#3a1008'; ctx.fillRect(cx-10,cy-r*0.62,20,4);
  ctx.fillStyle=lightenColor(color,0.2);
  ctx.beginPath(); ctx.arc(cx,cy-r*0.2,r*0.5,0,Math.PI*2); ctx.fill();
}

function drawPlayerPaladin(cx,cy,color,r){
  ctx.fillStyle=darkenColor(color,0.2);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Holy light aura
  const t=performance.now()/1000;
  ctx.strokeStyle=`rgba(241,196,15,${0.2+0.2*Math.sin(t*2)})`; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,r+4+Math.sin(t*3),0,Math.PI*2); ctx.stroke();
  // Cross emblem
  ctx.strokeStyle='rgba(241,196,15,0.8)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx,cy-r*0.6); ctx.lineTo(cx,cy+r*0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-r*0.5,cy-r*0.15); ctx.lineTo(cx+r*0.5,cy-r*0.15); ctx.stroke();
  // Helm
  ctx.fillStyle=lightenColor(color,0.15);
  ctx.beginPath(); ctx.arc(cx,cy-r*0.35,r*0.53,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1.2;ctx.stroke();
}

function drawPlayerAssassin(cx,cy,color,r){
  ctx.fillStyle=darkenColor(color,0.2);
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
  // Shadow wisps
  ctx.fillStyle='rgba(80,0,100,0.2)';
  ctx.beginPath(); ctx.arc(cx,cy,r+4,0,Math.PI*2); ctx.fill();
  // Hood
  ctx.fillStyle='#1a0a28';
  ctx.beginPath(); ctx.arc(cx,cy-r*0.4,r*0.6,Math.PI,0); ctx.fill();
  // Glowing eyes under hood
  ctx.fillStyle=color; ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.ellipse(cx-4,cy-r*0.5,2,1.5,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+4,cy-r*0.5,2,1.5,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  // Blade hint
  ctx.strokeStyle='rgba(200,150,255,0.6)'; ctx.lineWidth=1.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx+r*0.3,cy); ctx.lineTo(cx+r*0.9,cy-r*0.7); ctx.stroke();
  ctx.lineCap='butt';
}

function drawDummy(cx, cy) {
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx,cy+3,14,5,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#5a3c10'; ctx.fillRect(cx-3,cy-22,6,28);
  ctx.fillStyle='#4a3010'; ctx.fillRect(cx-12,cy-20,24,5);
  ctx.fillStyle='#b89040'; ctx.beginPath(); ctx.arc(cx,cy-30,9,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#6a4010'; ctx.lineWidth=1.5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-4,cy-33); ctx.lineTo(cx-2,cy-31); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-2,cy-33); ctx.lineTo(cx-4,cy-31); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+2,cy-33); ctx.lineTo(cx+4,cy-31); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+4,cy-33); ctx.lineTo(cx+2,cy-31); ctx.stroke();
  ctx.lineCap='butt';
  ctx.restore();
}

function drawEntityAt(cx,cy,color,symbol,isPlayer,bob,shadowScale,enemy) {
  // Kept for compatibility with remote players and other uses
  const r=isPlayer?14:11;
  const bodyY=cy-r*0.4+bob;
  ctx.beginPath(); ctx.ellipse(cx,cy+3,r*0.85*shadowScale,r*0.28*shadowScale,0,0,Math.PI*2);
  ctx.fillStyle=`rgba(0,0,0,${0.55*shadowScale})`; ctx.fill();
  if(isPlayer&&state.selectedClass){
    const hg=ctx.createRadialGradient(cx,bodyY,r*0.5,cx,bodyY,r*2.2);
    hg.addColorStop(0,CLASSES[state.selectedClass].color+'30'); hg.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(cx,bodyY,r*2.2,0,Math.PI*2); ctx.fillStyle=hg; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx,bodyY,r,0,Math.PI*2);
  const grad=ctx.createRadialGradient(cx-r*0.25,bodyY-r*0.35,0,cx,bodyY,r);
  grad.addColorStop(0,lightenColor(color,0.55));
  grad.addColorStop(0.6,color);
  grad.addColorStop(1,darkenColor(color,0.4));
  ctx.fillStyle=grad; ctx.fill();
  if(isPlayer){ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1.2;ctx.stroke();}
  ctx.fillStyle=isPlayer?'#fff':'rgba(0,0,0,0.8)';
  ctx.globalAlpha=0.9; ctx.font=`bold ${isPlayer?11:9}px monospace`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(symbol,cx,bodyY); ctx.globalAlpha=1;
}

// ── LEVEL UP VFX ────────────────────────────────────────
function spawnLevelUpVFX(level) {
  const p = state.player;
  // Big flash
  spawnVFX('flash',[],p.px,p.py,800,'#c8a96e',{});
  // Burst of golden particles
  spawnParticles(p.px,p.py,30,'#c8a96e',{speed:150,glow:true,decay:1.0,size:6,shape:'spark',spread:1.2,gravity:-20});
  spawnParticles(p.px,p.py,20,'#ffffff',{speed:100,glow:true,decay:1.5,size:4,shape:'star',spread:0.8});
  // Rising ring vfx
  spawnVFX('levelup',[],p.px,p.py,1500,'#c8a96e',{level});
  // Floating level text
  spawnFloater(p.gridX, p.gridY, `✦ NIVEAU ${level} ✦`, '#f1c40f', 22);
}

// ── LEVEL UP VFX DRAW (added to drawVFX switch) ─────────
function drawVFX() {
  if (!state.opts.vfx) return;
  const now=performance.now();
  for(const vfx of state.vfx){
    const t=Math.min(1,(now-vfx.born)/vfx.duration), inv=1-t;
    ctx.save();
    switch(vfx.type){
      case 'impact':{
        const c=vfx.cells[0]; if(!c) break;
        const {x,y}=gridToIso(c.x,c.y); const cx2=x, cy2=y+CELL_H/2;
        if(t<0.2){isoPath(c.x,c.y);ctx.fillStyle=vfx.color+'60';ctx.globalAlpha=(1-t/0.2)*0.7;ctx.fill();}
        for(let ring=0;ring<3;ring++){
          const rt=Math.max(0,t-ring*0.1); if(rt<=0) continue;
          ctx.beginPath(); ctx.ellipse(cx2,cy2,rt*CELL_W*1.4,rt*CELL_W*0.55,0,0,Math.PI*2);
          ctx.strokeStyle=vfx.color; ctx.lineWidth=(3-ring)*(1-rt*0.9); ctx.globalAlpha=(1-rt)*0.7;
          ctx.shadowColor=vfx.color; ctx.shadowBlur=10; ctx.stroke();
        }
        break;
      }
      case 'explosion':{
        const {x:ox,y:oy}=gridToIso(vfx.extra.gx||0,vfx.extra.gy||0);
        const icy=oy+CELL_H/2;
        const r=easeInOut(t)*(vfx.extra.radius||3)*CELL_W;
        ctx.beginPath(); ctx.ellipse(ox,icy,r,r*0.45,0,0,Math.PI*2);
        ctx.strokeStyle=vfx.color; ctx.lineWidth=5*inv; ctx.globalAlpha=inv*0.85;
        ctx.shadowColor=vfx.color; ctx.shadowBlur=25; ctx.stroke();
        if(vfx.cells) for(const c of vfx.cells){isoPath(c.x,c.y);ctx.fillStyle=vfx.color;ctx.globalAlpha=inv*0.2;ctx.fill();}
        break;
      }
      case 'heal':{
        const ch=vfx.cells[0]; if(!ch) break;
        const {x,y}=gridToIso(ch.x,ch.y); const cx2=x, cy2=y+CELL_H/2;
        const pr=CELL_W*0.35*(t<0.3?easeInOut(t/0.3):1);
        ctx.globalAlpha=inv*0.85; ctx.shadowColor=vfx.color; ctx.shadowBlur=12;
        for(let p2=0;p2<6;p2++){
          const a=(Math.PI*2*p2/6)+t*1.5;
          ctx.beginPath(); ctx.ellipse(cx2+Math.cos(a)*pr,cy2+Math.sin(a)*pr*0.45,pr*0.3,pr*0.15,a,0,Math.PI*2);
          ctx.fillStyle=vfx.color; ctx.fill();
        }
        break;
      }
      case 'flash':
        ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.globalAlpha=(1-t)*0.6;
        ctx.fillRect(0,0,canvas.width,canvas.height); break;
      case 'teleport_out':
        ctx.beginPath(); ctx.arc(vfx.cx,vfx.cy,22*(1-t),0,Math.PI*2);
        ctx.fillStyle=vfx.color; ctx.globalAlpha=(1-t)*0.5;
        ctx.shadowColor=vfx.color; ctx.shadowBlur=20; ctx.fill(); break;
      case 'levelup': {
        // Rising golden rings
        for(let ring=0;ring<4;ring++){
          const rt = Math.min(1,Math.max(0,t-ring*0.15));
          if(rt<=0) continue;
          const r = rt*CELL_W*2.5;
          ctx.beginPath(); ctx.ellipse(vfx.cx,vfx.cy-rt*30,r,r*0.4,0,0,Math.PI*2);
          ctx.strokeStyle=vfx.color; ctx.lineWidth=(4-ring)*(1-rt); ctx.globalAlpha=(1-rt)*0.8;
          ctx.shadowColor=vfx.color; ctx.shadowBlur=15; ctx.stroke();
        }
        // Center star burst
        if(t<0.4){
          const st=t/0.4;
          for(let spike=0;spike<8;spike++){
            const a=spike*Math.PI/4;
            const len=st*CELL_W*1.5;
            ctx.beginPath(); ctx.moveTo(vfx.cx,vfx.cy); ctx.lineTo(vfx.cx+Math.cos(a)*len,vfx.cy+Math.sin(a)*len*0.4);
            ctx.strokeStyle=vfx.color; ctx.lineWidth=2*(1-st); ctx.globalAlpha=0.7*(1-st);
            ctx.shadowColor=vfx.color; ctx.shadowBlur=10; ctx.stroke();
          }
        }
        break;
      }
    }
    ctx.restore();
  }
  if(!state.opts.particles) return;
  for(const p of state.particles){
    ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
    if(p.glow){ctx.shadowColor=p.color;ctx.shadowBlur=p.size*3;}
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.ellipse(p.x,p.y,Math.max(0.5,p.size*p.life),(p.shape==='spark'?p.size*p.life*0.3:p.size*p.life),Math.atan2(p.vy||0,p.vx||0.01),0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawFootprints() {
  for(const fp of state.footprints){
    ctx.beginPath(); ctx.ellipse(fp.px,fp.py,5,2.5,fp.angle||0,0,Math.PI*2);
    ctx.fillStyle=`rgba(${fp.r},${fp.g},${fp.b},${fp.alpha})`; ctx.fill();
  }
}

function drawPath() {
  if(!state.player.path.length&&state.player.t>=1) return;
  ctx.setLineDash([3,5]); ctx.lineWidth=1.2;
  ctx.strokeStyle=state.showGrid?'rgba(0,200,255,0.4)':'rgba(200,169,110,0.35)';
  ctx.beginPath(); ctx.moveTo(state.player.px,state.player.py);
  for(const step of state.player.path){const iso=gridToIso(step.x,step.y);ctx.lineTo(iso.x,iso.y+CELL_H/2);}
  ctx.stroke(); ctx.setLineDash([]);
  if(state.player.path.length>0){
    const last=state.player.path[state.player.path.length-1];
    const iso=gridToIso(last.x,last.y);
    const pulse=0.5+0.5*Math.sin(Date.now()*0.006);
    ctx.beginPath(); ctx.arc(iso.x,iso.y+CELL_H/2,5+pulse*3,0,Math.PI*2);
    ctx.strokeStyle=`rgba(200,169,110,${0.3+pulse*0.4})`; ctx.lineWidth=1.5; ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function blendColor(hex1,hex2,t){try{const r1=parseInt(hex1.slice(1,3),16),g1=parseInt(hex1.slice(3,5),16),b1=parseInt(hex1.slice(5,7),16);const r2=parseInt(hex2.slice(1,3),16),g2=parseInt(hex2.slice(3,5),16),b2=parseInt(hex2.slice(5,7),16);const r=Math.round(r1*(1-t)+r2*t),g=Math.round(g1*(1-t)+g2*t),b=Math.round(b1*(1-t)+b2*t);return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;}catch{return hex1;}}
function lightenColor(hex,a){try{const r=Math.min(255,parseInt(hex.slice(1,3),16)+Math.round(255*a));const g=Math.min(255,parseInt(hex.slice(3,5),16)+Math.round(255*a));const b=Math.min(255,parseInt(hex.slice(5,7),16)+Math.round(255*a));return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;}catch{return hex;}}
function darkenColor(hex,a){try{const r=Math.max(0,parseInt(hex.slice(1,3),16)-Math.round(255*a));const g=Math.max(0,parseInt(hex.slice(3,5),16)-Math.round(255*a));const b=Math.max(0,parseInt(hex.slice(5,7),16)-Math.round(255*a));return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;}catch{return hex;}}

// ═══════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════
function gameLoop(timestamp) {
  if (!state.lastTimestamp) state.lastTimestamp = timestamp;
  const dt = Math.min((timestamp-state.lastTimestamp)/1000, 0.1);
  updateMovement(timestamp);
  tickFootprints(dt);
  if (state.opts.vfx) { tickVFX(); tickParticles(dt); }
  drawGrid();
  if (typeof drawPortal==='function' && !dungeonState?.active) drawPortal(ctx, PORTAL_GX, PORTAL_GY);
  if (typeof drawBossOnGrid==='function') drawBossOnGrid(ctx);
  if (typeof drawDungeonRoomUI==='function') drawDungeonRoomUI(ctx);
  if (state.opts.vfx) drawVFX();
  if (state.showStats) refreshStatsPanel();
  if (state.animFrame % 60 === 0 && typeof updateTalentHUD === 'function') updateTalentHUD();
  state.animFrame++; state.lastTimestamp = timestamp;
  requestAnimationFrame(gameLoop);
}