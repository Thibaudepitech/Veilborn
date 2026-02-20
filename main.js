// ═══════════════════════════════════════════════════════
// MAIN — Init, Events, Menu Logic
// ═══════════════════════════════════════════════════════

// ─────────────────────────────────────────
// MENU CANVAS (atmospheric particles)
// ─────────────────────────────────────────
function initMenuCanvas() {
  const mc = document.getElementById('menu-canvas');
  mc.width = window.innerWidth; mc.height = window.innerHeight;
  const mctx = mc.getContext('2d');
  const mparticles = [];
  for (let i=0;i<60;i++) {
    mparticles.push({ x:Math.random()*mc.width, y:Math.random()*mc.height, vx:(Math.random()-0.5)*0.3, vy:-Math.random()*0.5-0.1, size:Math.random()*2+0.5, alpha:Math.random()*0.6+0.2, color:Math.random()<0.5?'#c8a96e':'#9b4dca' });
  }
  function drawMenuBg() {
    mctx.clearRect(0,0,mc.width,mc.height);
    mparticles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.y<-10){p.y=mc.height+10;p.x=Math.random()*mc.width;}
      if(p.x<0||p.x>mc.width) p.vx*=-1;
      mctx.beginPath(); mctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      mctx.fillStyle=p.color; mctx.globalAlpha=p.alpha; mctx.fill(); mctx.globalAlpha=1;
    });
    requestAnimationFrame(drawMenuBg);
  }
  drawMenuBg();
}

// ─────────────────────────────────────────
// MENU NAVIGATION
// ─────────────────────────────────────────
let selectedClassForNew = null;

function showClassSelect() {
  selectedClassForNew = null;
  document.getElementById('class-select-panel').classList.add('visible');
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('cs-confirm').disabled = true;
  renderClassSelect();
}

function renderClassSelect() {
  const grid = document.getElementById('cs-grid');
  grid.innerHTML = '';
  for (const [id, cls] of Object.entries(CLASSES)) {
    const card = document.createElement('div');
    card.className = 'cs-card' + (selectedClassForNew===id?' cs-card-selected':'');
    card.style.setProperty('--class-color', cls.color);

    // Resource color badge
    const resColors = {
      fracture:'#9b4dca', tisseuse:'#4ecdc4', briseur:'#e74c3c',
      druide:'#27ae60', mage:'#e67e22', paladin:'#f1c40f', assassin:'#8e44ad'
    };

    // Role icons
    const roleIcons = {
      fracture:'⚔', tisseuse:'🕸', briseur:'🛡',
      druide:'🌿', mage:'🔥', paladin:'✨', assassin:'🗡'
    };

    card.innerHTML = `
      <div class="cs-card-top-bar" style="background:${cls.color}22;border-bottom:1px solid ${cls.color}44;padding:6px 10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:18px;">${roleIcons[id]||'⚔'}</span>
        <span style="font-family:'Cinzel Decorative',serif;font-size:9px;color:${cls.color};letter-spacing:2px;text-transform:uppercase;">${cls.role.split('/')[0].trim()}</span>
      </div>
      <div class="cs-name" style="color:${cls.color}">${cls.name}</div>
      <div class="cs-role">${cls.role}</div>
      <div class="cs-resource-badge" style="background:${cls.color}22;border:1px solid ${cls.color}44;border-radius:3px;padding:3px 8px;margin:4px 0;font-family:'Cinzel',serif;font-size:9px;color:${cls.color};">
        ⚡ ${cls.resource.name}
      </div>
      <div class="cs-stats">
        <div class="cs-stat"><span style="color:#6a5030;">PV</span> <span style="color:#e04040;font-weight:bold;">${cls.hpMax}</span></div>
        <div class="cs-stat"><span style="color:#6a5030;">ARM</span> <span style="color:#4a90d9;font-weight:bold;">${cls.armor}</span></div>
        <div class="cs-stat"><span style="color:#6a5030;">VIT</span> <span style="color:#27ae60;font-weight:bold;">${cls.speed}</span></div>
        <div class="cs-stat"><span style="color:#6a5030;">POR</span> <span style="color:#c8a96e;font-weight:bold;">${cls.range}c</span></div>
      </div>
      <div class="cs-lore">${cls.lore}</div>
      <div class="cs-difficulty" style="margin-top:6px;display:flex;gap:2px;">
        ${getDifficultyStars(id)}
      </div>
    `;
    card.addEventListener('click', ()=>{
      selectedClassForNew = id;
      document.querySelectorAll('.cs-card').forEach(c=>c.classList.remove('cs-card-selected'));
      card.classList.add('cs-card-selected');
      document.getElementById('cs-confirm').disabled = false;
    });
    grid.appendChild(card);
  }
}

function getDifficultyStars(id) {
  const difficulties = {
    fracture: 2, tisseuse: 4, briseur: 1, druide: 3, mage: 5, paladin: 2, assassin: 4
  };
  const d = difficulties[id] || 3;
  return Array.from({length:5}, (_,i) =>
    `<span style="font-size:10px;color:${i<d?'#c8a96e':'#2a1808'};">★</span>`
  ).join('') + `<span style="font-family:'IM Fell English',serif;font-style:italic;font-size:9px;color:#4a3020;margin-left:4px;">${['','Facile','Accessible','Modéré','Avancé','Expert'][d]}</span>`;
}

function backToMenu() {
  document.getElementById('class-select-panel').classList.remove('visible');
  document.getElementById('main-menu').classList.remove('hidden');
}

function confirmClass() {
  if (!selectedClassForNew) return;
  document.getElementById('class-select-panel').classList.remove('visible');
  startGame(selectedClassForNew, true);
}

function showMultiPanel() {
  document.getElementById('multi-panel').classList.add('visible');
  document.getElementById('main-menu').classList.add('hidden');
  initServerConfigUI();
}

function backToMenuFromMulti() {
  document.getElementById('multi-panel').classList.remove('visible');
  document.getElementById('main-menu').classList.remove('hidden');
}

function showOptions() {
  document.getElementById('options-panel').classList.add('visible');
  document.getElementById('main-menu').classList.add('hidden');
}

function closeOptions() {
  document.getElementById('options-panel').classList.remove('visible');
  document.getElementById('main-menu').classList.remove('hidden');
}

function toggleOpt(key) {
  state.opts[key] = !state.opts[key];
  const el = document.getElementById('opt-'+key);
  if (el) el.classList.toggle('on', state.opts[key]);
}

function continueGame() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function goToMenu() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
}

function toggleGrid() {
  state.showGrid = !state.showGrid;
  const badge = document.getElementById('tactical-badge');
  badge.style.display = state.showGrid ? 'block' : 'none';
  addLog(state.showGrid?'Vision tactique activée.':'Vision normale restaurée.','normal');
}

// ─────────────────────────────────────────
// GAME START
// ─────────────────────────────────────────
function startGame(classId, isNewGame) {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('btn-continue').style.display = 'block';

  // Si nouvelle partie : reset complet (level, talents, position, ennemis)
  if (isNewGame) {
    state.talents = null;
    state.player.gridX = 7; state.player.gridY = 7;
    state.player.path = []; state.player.moving = false;
    state.combatStats = { dmgDealt:0, healed:0, kills:0 };
    // Remettre les ennemis d'origine
    state.enemies = [
      { id:'e1', gridX:3, gridY:4, hp:200, maxHp:200, armor:15, type:'fracture', alive:true, name:'Fracturé sauvage', debuffs:{} },
      { id:'e2', gridX:11, gridY:6, hp:280, maxHp:280, armor:20, type:'gloom', alive:true, name:'Revenant boisé', debuffs:{} },
      { id:'e3', gridX:10, gridY:5, hp:150, maxHp:150, armor:10, type:'revenant', alive:true, name:'Éclat vivant', debuffs:{} },
      { id:'e4', gridX:5, gridY:12, hp:340, maxHp:340, armor:25, type:'arcane', alive:true, name:'Construct arcanique', debuffs:{} },
      { id:'e5', gridX:13, gridY:9, hp:180, maxHp:180, armor:8, type:'fracture', alive:true, name:'Gardien de faille', debuffs:{} },
      { id:'d1', gridX:13, gridY:13, hp:1000000, maxHp:1000000, armor:1000, type:'dummy', alive:true, name:'Mannequin I', debuffs:{}, isDummy:true },
      { id:'d2', gridX:13, gridY:14, hp:1000000, maxHp:1000000, armor:1000, type:'dummy', alive:true, name:'Mannequin II', debuffs:{}, isDummy:true },
      { id:'d3', gridX:13, gridY:15, hp:1000000, maxHp:1000000, armor:1000, type:'dummy', alive:true, name:'Mannequin III', debuffs:{}, isDummy:true },
    ];
    state.terrain = generateTerrain();
    state.cooldowns = {};
    state.highlight = { type:null, cells:[] };
    // Reset bossRoom si actif
    if (typeof bossRoom !== 'undefined') bossRoom = null;
    if (typeof bossState !== 'undefined') bossState = null;
    dungeonState = null;
    const bossHud = document.getElementById('boss-hud');
    if (bossHud) bossHud.style.display = 'none';
  }

  resizeCanvas();
  initPlayerPixelPos();
  if (typeof initTalents === 'function' && !state.talents) initTalents();
  if (typeof initLootSystem === 'function') initLootSystem();
  if (typeof AudioEngine !== 'undefined') { AudioEngine.init(); AudioEngine.playMusic('overworld'); }
  if (typeof initChat === 'function') initChat();
  selectClass(classId || 'fracture');
  startResourceRegen();
  startCooldownTicker();
  if (!state._loopRunning) { state._loopRunning=true; requestAnimationFrame(gameLoop); }
}

// ─────────────────────────────────────────
// TUTORIAL
// ─────────────────────────────────────────
function showTutorial() {
  alert(`VEILBORN v5 — TUTORIEL

🎯 DÉPLACEMENT
  Clic droit → Déplacer vers la case

⚔ ATTAQUE BASIQUE
  Clic gauche sur ennemi à portée

🔥 SKILLS
  1/2/3 → Activer un skill (puis clic pour cibler)
  Clic sur le panel droit = même effet

📜 ARBRE DE COMPÉTENCES
  S → Ouvrir · Clic skill → équiper · Clic slot → vider

🗺 VISION TACTIQUE  G → Toggle grille tactique
📊 STATISTIQUES     T → Panel détaillé

🥊 MANNEQUINS D'ENTRAÎNEMENT
  Coin bas-droite (cases 12-15). PV infinis, armure 1000.

🌀 VOILE (cases violettes)  +20% dégâts
⚡ RESSOURCES  Chaque classe a une mécanique unique.

🌐 MULTIJOUEUR P2P
  Menu → Multijoueur → Créer ou Rejoindre
  Partagez le code à vos amis (même réseau ou internet)
  Jusqu'à 4 joueurs. Connexion directe chiffrée.`.trim());
}

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────
canvas.addEventListener('contextmenu', e=>{
  e.preventDefault();
  if (state.showSkillTree) return;
  if (state.targeting.active) { cancelTargeting(); return; }
  if (!state.selectedClass) { addLog('Sélectionnez une classe!','action'); return; }
  const rect = canvas.getBoundingClientRect();
  const {gx,gy} = isoToGrid(e.clientX-rect.left, e.clientY-rect.top);
  if (gx<0||gy<0||gx>=GRID_SIZE||gy>=GRID_SIZE) return;
  if (state.terrain[`${gx},${gy}`]==='blocked') { addLog('Case bloquée!','normal'); return; }
  if (state.buffs.defensiveStance || state.buffs.rootSelf) { addLog('Vous êtes immobilisé!','normal'); return; }
  const path = aStar(state.player.gridX, state.player.gridY, gx, gy);
  if (path.length===0 && !(gx===state.player.gridX&&gy===state.player.gridY)) { addLog('Destination inaccessible.','normal'); return; }
  startMoving(path);
});

canvas.addEventListener('mousemove', e=>{
  if (state.showSkillTree) return;
  const rect = canvas.getBoundingClientRect();
  const {gx,gy} = isoToGrid(e.clientX-rect.left, e.clientY-rect.top);
  if (gx>=0&&gy>=0&&gx<GRID_SIZE&&gy<GRID_SIZE) {
    state.hoveredCell = {gx,gy};
    if (state.targeting.active && state.targeting.skillIdx!==null) {
      const skill = getSkillBySlot(state.targeting.skillIdx);
      if (skill) {
        const dist = Math.abs(gx-state.player.gridX)+Math.abs(gy-state.player.gridY);
        if (dist<=skill.range) {
          if (['enemy','any'].includes(skill.targetType)) state.targeting.previewCells=[{x:gx,y:gy}];
          else if (['cell','cell_line','cell_dir','cell_cone'].includes(skill.targetType)) state.targeting.previewCells=getCellsInRange(gx,gy,Math.min(2,skill.range));
          else state.targeting.previewCells=[];
        } else state.targeting.previewCells=[];
      }
    }
    const tooltip = document.getElementById('tooltip');
    const terrain = state.terrain[`${gx},${gy}`];
    let text = `(${gx},${gy})`;
    if (terrain==='blocked') text+=' — Bloqué';
    if (terrain==='veil') text+=' — Voile ✦ +20% dégâts';
    const enemy = findEnemyAt(gx,gy);
    if (enemy) {
      if (enemy.isDummy) text+=` — ${enemy.name} [Dégâts: ${(enemy.maxHp-enemy.hp).toLocaleString()}]`;
      else text+=` — ${enemy.name} [${enemy.hp}/${enemy.maxHp} PV | ARM:${enemy.armor}]`;
    }
    if (state.targeting.active) text = '⊕ CIBLE — '+text;
    tooltip.textContent=text; tooltip.style.display='block';
    tooltip.style.left=(e.clientX-rect.left+12)+'px'; tooltip.style.top=(e.clientY-rect.top-8)+'px';
  } else {
    state.hoveredCell=null; state.targeting.previewCells=[];
    document.getElementById('tooltip').style.display='none';
  }
});

canvas.addEventListener('mouseleave', ()=>{
  state.hoveredCell=null; state.targeting.previewCells=[];
  document.getElementById('tooltip').style.display='none';
});

canvas.addEventListener('click', e=>{
  if (state.showSkillTree || state.showTalentTree) return;
  if (!state.selectedClass) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  if (mouseX < 0 || mouseY < 0 || mouseX > rect.width || mouseY > rect.height) return;
  const {gx, gy} = isoToGrid(mouseX, mouseY);

  // ── MODE CIBLAGE SPELL ──────────────────────────────
  // En mode ciblage : le clic valide UNIQUEMENT le spell, rien d'autre
  if (state.targeting.active) {
    const targetEnemy = findEnemyAt(gx, gy);
    executeSkill(state.targeting.skillIdx, gx, gy, targetEnemy);
    return; // STOP — pas d'attaque basique
  }

  // ── HORS GRILLE : ignorer ──────────────────────────
  if (gx < 0 || gy < 0 || gx >= GRID_SIZE || gy >= GRID_SIZE) return;

  // ── ATTAQUE BASIQUE (hors ciblage) ─────────────────
  const enemy = findEnemyAt(gx, gy);
  if (enemy && enemy.alive) {
    // Afficher l'inspecteur dans tous les cas
    if (typeof showEnemyInspector === 'function') showEnemyInspector(enemy);

    // Attaquer seulement les vrais ennemis (pas les mannequins avec clic gauche simple)
    if (!enemy.isDummy) {
      const cls = CLASSES[state.selectedClass];
      const dist = Math.abs(gx - state.player.gridX) + Math.abs(gy - state.player.gridY);
      if (dist <= cls.range + 1) {
        let dmg = Math.floor(Math.random() * 40 + 20);
        if (state.buffs.raged) dmg = Math.round(dmg * 1.4);
        if (state.buffs.animalForm) dmg = Math.round(dmg * 1.5);
        const finalDmg = calcDamage(dmg, enemy.armor);
        applyDamageToEnemy(enemy, finalDmg);
        if (typeof AudioEngine !== 'undefined') AudioEngine.play.basicAttack();
        addLog(`Attaque basique → ${enemy.name}: −${finalDmg} PV`, 'damage');
        spawnFloater(gx, gy, `-${finalDmg}`, cls.color, 16);
        if (state.opts.vfx) spawnVFX('impact', [{x:gx,y:gy}], state.player.px, state.player.py, 500, cls.color, {});
        const onHit = {fracture:5,briseur:5,paladin:5,assassin:enemy.debuffs?.death_mark?2:1};
        const delta = onHit[state.selectedClass] || 0;
        if (delta) regenResource(delta);
        updateHpUI(); renderStats(); updateBuffDisplay();
        // Rafraîchir l'inspecteur après les dégâts
        if (typeof showEnemyInspector === 'function') showEnemyInspector(enemy);
      } else {
        addLog(`Hors de portée! (${dist} cases, portée: ${cls.range})`, 'normal');
      }
    }
  } else {
    // Clic sur case vide — effacer l'inspecteur
    if (typeof showEnemyInspector === 'function') showEnemyInspector(null);
    // Vérifier interaction marchand
    if (typeof checkMerchantInteraction === 'function') checkMerchantInteraction(gx, gy);
  }
});

document.addEventListener('keydown', e=>{
  // Skip if in menu
  const menu = document.getElementById('main-menu');
  if (menu && !menu.classList.contains('hidden')) return;
  const classPanel = document.getElementById('class-select-panel');
  if (classPanel && classPanel.classList.contains('visible')) return;
  const multiPanel = document.getElementById('multi-panel');
  if (multiPanel && multiPanel.classList.contains('visible')) return;

  if (state.showSkillTree) {
    if (e.key==='s'||e.key==='S'||e.key==='Escape') closeSkillTree();
    return;
  }
  if (state.showTalentTree) {
    if (e.key==='a'||e.key==='A'||e.key==='Escape') closeTalentTree();
    return;
  }
  if (state.showInventory) {
    if (e.key==='i'||e.key==='I'||e.key==='Escape') closeInventory();
    return;
  }
  if (state.showMerchant) {
    if (e.key==='Escape') closeMerchant();
    return;
  }
  switch(e.key) {
    case 's': case 'S': openSkillTree(); break;
    case 'i': case 'I': if(typeof openInventory==='function') openInventory(); break;
    case 'c': case 'C': if(typeof toggleChat==='function') toggleChat(); break;
    case 'm': case 'M': document.getElementById('audio-settings-modal').style.display='flex'; break;
    case 'f': case 'F': 
      if (dungeonState?.active) {
        exitDungeon(false);
      } else if (typeof tryFleeBoss === 'function') {
        tryFleeBoss();
      }
      break;
    case 'a': case 'A': if(typeof openTalentTree==='function') openTalentTree(); break;
    case 'g': case 'G': toggleGrid(); break;
    case 't': case 'T': toggleStatsPanel(); break;
    case '1': enterTargetingMode(0); break;
    case '2': enterTargetingMode(1); break;
    case '3': enterTargetingMode(2); break;
    case 'Escape':
      if (state.showStats) { toggleStatsPanel(); break; }
      if (state.targeting.active) { cancelTargeting(); addLog('Ciblage annulé.','normal'); break; }
      state.player.path=[]; state.player.moving=false; state.player.t=1;
      const iso2=gridToIso(state.player.gridX,state.player.gridY);
      state.player.px=iso2.x; state.player.py=iso2.y+CELL_H/2;
      state.highlight={type:null,cells:[]};
      addLog('Annulé.','normal'); break;
  }
});

// ─────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────
window.addEventListener('resize', ()=>{
  resizeCanvas();
  const mc = document.getElementById('menu-canvas');
  if (mc) { mc.width=window.innerWidth; mc.height=window.innerHeight; }
});

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
initMenuCanvas();