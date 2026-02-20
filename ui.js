// ═══════════════════════════════════════════════════════
// SKILL BAR (bottom of screen)
// ═══════════════════════════════════════════════════════
function renderSkillBar() {
  if (!state.selectedClass) return;
  const container = document.getElementById('skill-bar-slots');
  if (!container) return;
  container.innerHTML = '';
  const equipped = getEquippedSkills();
  equipped.forEach((skill, i) => {
    const slot = document.createElement('div');
    const cd = skill ? (state.cooldowns[skill.id] || 0) : 0;
    const onCd = cd > 0;
    const isTargeting = state.targeting.active && state.targeting.skillIdx === i;

    if (!skill) {
      slot.className = 'skill-bar-slot empty';
      slot.innerHTML = `<div class="sbs-key">${i+1}</div><div class="sbs-empty-hint">[ S ] pour équiper</div>`;
      slot.addEventListener('click', () => openSkillTree());
      container.appendChild(slot);
      return;
    }

    let typeIcon = skill.targetType==='enemy'?'⚔':skill.targetType==='any'?'💚':skill.targetType==='self'?'👤':skill.targetType.includes('zone')?'💥':'🎯';
    const rangeStr = skill.range > 0 ? `${skill.range}c` : 'soi';
    const costStr = skill.resourceDelta < 0 ? ` · −${Math.abs(skill.resourceDelta)}` : '';

    slot.className = 'skill-bar-slot' + (onCd?' on-cooldown':'') + (isTargeting?' targeting-active':'');
    slot.innerHTML = `
      <div class="sbs-key">${i+1}</div>
      <div class="sbs-name">${skill.name}</div>
      <div class="sbs-desc">${skill.desc}</div>
      <div class="sbs-meta">${typeIcon} ${rangeStr} · CD:${skill.cd}s${costStr}</div>
      ${onCd ? `<div class="sbs-cd-overlay">${cd.toFixed(1)}s</div>` : ''}
    `;
    if (!onCd) slot.addEventListener('click', () => enterTargetingMode(i));
    container.appendChild(slot);
  });
}

// ═══════════════════════════════════════════════════════
// ENEMY INSPECTOR (panel-left)
// ═══════════════════════════════════════════════════════
function showEnemyInspector(enemy) {
  const empty = document.getElementById('enemy-inspector-empty');
  const content = document.getElementById('enemy-inspector-content');
  if (!enemy || !enemy.alive) {
    if (empty) empty.style.display = 'block';
    if (content) content.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (!content) return;
  content.style.display = 'block';

  const hpPct = Math.round((enemy.hp / enemy.maxHp) * 100);
  const hpColor = hpPct > 60 ? '#e04040' : hpPct > 30 ? '#e08020' : '#ff2020';
  const armorReduc = Math.round(enemy.armor / (enemy.armor + 100) * 100);

  const typeData = {
    fracture: { label:'Fracturé',     icon:'💜', weakTo:['arcane','feu'],     resists:['physique'], lore:'Créature du Voile instable. Faible aux dégâts arcaniques.' },
    gloom:    { label:'Revenant',     icon:'❤',  weakTo:['lumière','feu'],    resists:['ombre'],    lore:'Mort-vivant. Vulnérable à la lumière sacrée.' },
    revenant: { label:'Éclat vivant', icon:'💚', weakTo:['physique','arcane'],resists:['magie'],    lore:'Énergie pure cristallisée. Résiste à la magie directe.' },
    arcane:   { label:'Construct',    icon:'💙', weakTo:['feu','physique'],   resists:['arcane'],   lore:'Automate du Voile. Immunisé aux effets arcaniques.' },
    dummy:    { label:'Mannequin',    icon:'🪆', weakTo:[],                  resists:[],           lore:'Cible d\'entraînement indestructible.' },
  };
  const td = typeData[enemy.type] || { label: enemy.type, icon:'✕', weakTo:[], resists:[], lore:'' };

  // Collecter tous les effets actifs sur l'ennemi
  const debuffs = enemy.debuffs ? Object.entries(enemy.debuffs).filter(([k, v]) => v) : [];

  // Labels lisibles pour les debuffs
  const debuffLabels = {
    armor_down:     ['🔩 Armure réduite',   'armor_down'],
    slowed:         ['🐢 Ralenti',           'slowed'],
    stunned:        ['💫 Étourdi',           'stunned'],
    burning:        ['🔥 En feu',            'burning'],
    death_mark:     ['💀 Marque de mort',    'death_mark'],
    poisoned:       ['☠ Empoisonné',         'poisoned'],
    linked:         ['🔗 Lié (vie volée)',   'linked'],
    rooted:         ['🌿 Enraciné',          'rooted'],
    prevent_death:  ['🛡 Immortel (temp.)',  'prevent_death'],
    taunt:          ['😤 Provoqué',          'taunt'],
    web:            ['🕸 Toile',             'web'],
    frozen:         ['❄ Gelé',              'frozen'],
  };

  let html = '';

  // Nom + type
  html += `<div style="font-family:'Cinzel Decorative',serif;font-size:11px;color:#c8b090;margin-bottom:6px;">${td.icon} ${enemy.name}</div>`;
  if (enemy.isDummy) {
    const dmgDealt = (enemy.maxHp - enemy.hp).toLocaleString();
    html += `<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:10px;color:#6a5030;margin-bottom:8px;">Dégâts infligés: <span style="color:#c8a96e;">${dmgDealt}</span></div>`;
  }

  // Barre PV
  html += `<div style="background:rgba(0,0,0,0.5);border:1px solid rgba(120,80,30,0.3);height:8px;margin-bottom:4px;border-radius:1px;overflow:hidden;">
    <div style="width:${hpPct}%;height:100%;background:${hpColor};transition:width 0.3s;"></div>
  </div>`;

  // Stats combat
  html += `<div class="ei-section-title">Combat</div>`;
  html += `<div class="ei-stat-row"><span class="ei-stat-label">PV</span><span class="ei-stat-val ${hpPct<30?'danger':''}">${enemy.hp} / ${enemy.maxHp}  (${hpPct}%)</span></div>`;
  html += `<div class="ei-stat-row"><span class="ei-stat-label">Armure</span><span class="ei-stat-val">${enemy.armor} (−${armorReduc}%)</span></div>`;
  html += `<div class="ei-stat-row"><span class="ei-stat-label">Position</span><span class="ei-stat-val">(${enemy.gridX}, ${enemy.gridY})</span></div>`;

  // Résistances / Faiblesses
  if (!enemy.isDummy) {
    html += `<div class="ei-section-title">Résistances</div>`;
    if (td.resists.length > 0)
      html += `<div style="margin-bottom:5px;">${td.resists.map(r=>`<span class="ei-debuff-tag">🛡 ${r}</span>`).join('')}</div>`;
    else
      html += `<div style="font-size:10px;color:#3a2010;font-style:italic;">Aucune résistance</div>`;

    html += `<div class="ei-section-title">Faiblesses</div>`;
    if (td.weakTo.length > 0)
      html += `<div style="margin-bottom:5px;">${td.weakTo.map(w=>`<span class="ei-weakness-tag">⚡ ${w}</span>`).join('')}</div>`;
    else
      html += `<div style="font-size:10px;color:#3a2010;font-style:italic;">Aucune faiblesse</div>`;
  }

  // Effets appliqués
  if (debuffs.length > 0) {
    html += `<div class="ei-section-title">⚠ Effets actifs</div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px;">`;
    debuffs.forEach(([key, val]) => {
      const info = debuffLabels[key];
      const label = info ? info[0] : `✦ ${key}`;
      // Afficher la valeur si c'est un nombre ou une durée
      let extra = '';
      if (typeof val === 'number' && val !== true && val > 1) {
        extra = ` (${val > 1000 ? (val/1000).toFixed(1)+'s' : val})`;
      }
      html += `<span style="display:inline-block;padding:2px 5px;background:rgba(180,60,20,0.3);border:1px solid rgba(200,80,30,0.4);border-radius:2px;font-family:'Cinzel',serif;font-size:9px;color:#e09060;">${label}${extra}</span>`;
    });
    html += `</div>`;
  } else if (!enemy.isDummy) {
    html += `<div class="ei-section-title">Effets actifs</div>`;
    html += `<div style="font-size:10px;color:#3a2010;font-style:italic;">Aucun effet</div>`;
  }

  // Lore
  if (td.lore) html += `<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:10px;color:#3a2010;margin-top:8px;line-height:1.4;border-top:1px solid rgba(120,80,30,0.2);padding-top:6px;">${td.lore}</div>`;

  content.innerHTML = html;
}

function renderClasses() {
  const container = document.getElementById('class-list');
  if (!container) return;
  container.innerHTML = '';
  for (const [id, cls] of Object.entries(CLASSES)) {
    const card = document.createElement('div');
    card.className = 'class-card' + (state.selectedClass===id?' active':'');
    card.style.setProperty('--class-color', cls.color);
    const resVal = state.selectedClass===id ? state.resource.val : cls.resource.val;
    const resPct = (resVal/cls.resource.max)*100;
    card.innerHTML = `<div class="class-name">${cls.name}</div><div class="class-role">${cls.role}</div><div class="class-resource">▸ ${cls.resource.name}</div><div class="resource-bar-wrap"><div class="resource-bar" style="width:${resPct}%;background:${cls.color}"></div></div><div class="class-stats"><span>PV:<span class="class-stat-val">${cls.hpMax}</span></span><span>ARM:<span class="class-stat-val">${cls.armor}</span></span></div>`;
    card.addEventListener('click', ()=>selectClass(id));
    container.appendChild(card);
  }
}

function selectClass(id) {
  state.selectedClass = id;
  const cls = CLASSES[id];
  state.resource.val = cls.resource.val;
  state.resource.max = cls.resource.max;
  state.hp = cls.hp; state.hpMax = cls.hpMax;
  state.armor = cls.armor; state.baseArmor = cls.armor;
  state.buffs = {
    damage_mult:1, armor_bonus:0, fusionActive:false, raged:false,
    defensiveStance:false, rootSelf:false, animalForm:false,
    eclipseActive:false, eclipseNextSkillDouble:false,
    mirrorNext:false, martyrTarget:null,
    linkedEnemy:null, linkedEnemyEnd:0,
    grandeToile:false, grandeToileEnd:0,
    shieldCharges:0, shieldType:'',
    totemActive:false, totemEnd:0,
    summons:[], lightBastionCells:[], lightBastionEnd:0,
    martyrEnd:0, symbiosis:false, symbiosisTarget:null,
    auraProtection:false, auraEnd:0, animalFormEnd:0,
  };
  state.cooldowns = {};
  state.player.path = []; state.player.moving = false;
  // Equip default skills — respect unlock level
  const _pool = ALL_SKILLS[id] || [];
  const _unlocked = state.talents ? state.talents.unlockedSkillCount : 1;
  state.equippedSkillIds = ['', '', ''];
  
  // Equip only unlocked default skills
  const _defaults = cls.defaultSkills.filter(sid => {
    const idx = _pool.findIndex(s => s.id === sid);
    return idx < _unlocked;
  });
  
  // Always equip at least the first skill
  if (_defaults.length === 0 && _pool.length > 0) _defaults.push(_pool[0].id);
  _defaults.slice(0, 3).forEach((sid, i) => { state.equippedSkillIds[i] = sid; });
  cancelTargeting(); initPlayerPixelPos();

  document.getElementById('header-class-name').textContent = cls.name;
  document.getElementById('header-class-name').style.color = cls.color;
  document.getElementById('res-display').style.setProperty('--class-color', cls.color);
  const shieldEl = document.getElementById('shield-display');
  if (shieldEl) shieldEl.style.display = 'none';

  addLog(`Classe: ${cls.name} — ${cls.role}`, 'action');
  addLog('Skills par défaut équipés. Appuyez S pour personnaliser.', 'normal');

  renderClasses(); updateResourceUI(); updateHpUI(); renderSkills(); renderSkillBar(); renderStats(); updateBuffDisplay();
  if (typeof updateTalentHUD === 'function') updateTalentHUD();
  if (window.multiState && multiState.broadcastClass) multiState.broadcastClass({ classId:id, hp:state.hp, x:state.player.gridX, y:state.player.gridY });
}

function updateHpUI() {
  if (!state.selectedClass) return;
  const pct = (state.hp/state.hpMax)*100;
  const fill = document.getElementById('hp-fill');
  fill.style.width = pct+'%';
  fill.style.background = pct>50 ? 'linear-gradient(90deg,#8b0000,#c02030,#e03040)' : pct>25 ? 'linear-gradient(90deg,#7a1500,#b03010,#d04020)' : 'linear-gradient(90deg,#600000,#900000,#c00010)';
  const hpCur = document.getElementById('hp-current');
  const hpMax2 = document.getElementById('hp-max');
  if (hpCur) { hpCur.textContent = state.hp; hpCur.style.color = pct>50?'#e04040':pct>25?'#e08020':'#ff2020'; }
  if (hpMax2) hpMax2.textContent = state.hpMax;
  const armVal = document.getElementById('armor-val');
  const armRed = document.getElementById('armor-reduc');
  if (armVal) armVal.textContent = state.armor;
  if (armRed) armRed.textContent = Math.round(state.armor/(state.armor+100)*100)+'%';
}

function updateResourceUI() {
  if (!state.selectedClass) return;
  const cls = CLASSES[state.selectedClass];
  const pct = Math.min(100, (state.resource.val/state.resource.max)*100);
  const resName = document.getElementById('res-name');
  const resVal = document.getElementById('res-val');
  const resMax = document.getElementById('res-max');
  const resFill = document.getElementById('res-fill');
  const resThresh = document.getElementById('res-thresholds');
  const resStatus = document.getElementById('res-status');
  if (resName) resName.textContent = cls.resource.name;
  if (resVal) resVal.textContent = Math.round(state.resource.val);
  if (resMax) resMax.textContent = `/ ${state.resource.max}`;
  if (resFill) {
    resFill.style.width = pct+'%';
    resFill.style.background = pct>=80 ? `linear-gradient(90deg,#a02010,#e05020,#ff7030)` : `linear-gradient(90deg,${darkenColor(cls.color,0.2)},${cls.color})`;
  }
  if (resThresh) resThresh.innerHTML = cls.resource.thresholds.map(t=>`<span class="threshold">${t}</span>`).join('');
  const beh = cls.resourceBehavior ? cls.resourceBehavior(state) : '';
  if (resStatus) resStatus.textContent = beh || '';
}

function renderSkills() {
  if (!state.selectedClass) return;
  const cls = CLASSES[state.selectedClass];
  const container = document.getElementById('skill-slots');
  if (!container) return;
  container.innerHTML = '';
  const equipped = getEquippedSkills();
  equipped.forEach((skill, i) => {
    const slot = document.createElement('div');
    if (!skill) {
      slot.className = 'skill-slot';
      slot.innerHTML = `<div class="skill-header"><span class="skill-key">${i+1}</span><span class="skill-name" style="color:#3a2010;font-size:10px;font-style:italic;">— slot vide — (S = arbre)</span></div>`;
      slot.addEventListener('click', ()=>openSkillTree());
      container.appendChild(slot); return;
    }
    const cdKey = skill.id;
    const cd = state.cooldowns[cdKey]||0;
    const onCd = cd > 0;
    const isTargeting = state.targeting.active && state.targeting.skillIdx===i;
    const typeColor = skill.targetType==='enemy'?'rgba(200,50,30,0.6)':skill.targetType==='any'?'rgba(30,150,60,0.6)':skill.targetType==='self'?'rgba(80,120,200,0.6)':'rgba(150,100,200,0.6)';
    slot.className = 'skill-slot'+(onCd?' on-cooldown':'')+(isTargeting?' targeting-active':'');
    slot.style.setProperty('--skill-color', typeColor);
    let typeIcon = skill.targetType==='enemy'?'⚔':skill.targetType==='any'?'💚':skill.targetType==='self'?'👤':skill.targetType.includes('zone')?'💥':'🎯';
    // Resource cost display
    const resCostStr = skill.resourceDelta < 0 ? ` | −${Math.abs(skill.resourceDelta)} res` : '';
    slot.innerHTML = `<div class="skill-header"><span class="skill-key">${i+1}</span><span class="skill-name">${skill.name}</span><span style="font-size:9px;color:#4a3a2a;">${typeIcon} ${skill.range>0?skill.range+'c':''}</span></div><div class="skill-desc">${skill.desc}</div><div style="font-size:8px;color:#3a2818;margin-top:3px;">CD:${skill.cd}s${resCostStr}</div>${onCd?`<div class="cooldown-overlay">${cd.toFixed(1)}s</div>`:''}`;
    slot.addEventListener('click', ()=>!onCd&&enterTargetingMode(i));
    container.appendChild(slot);
  });
}

function renderStats() {
  if (!state.selectedClass) return;
  const cls = CLASSES[state.selectedClass];
  const c = document.getElementById('stat-grid');
  if (!c) return;
  c.innerHTML = '';
  const dmgRange = { fracture:'85–120', tisseuse:'40–60', briseur:'120–180', druide:'50–75', mage:'150–220', paladin:'90–130', assassin:'130–200' }[state.selectedClass] || '—';
  const rows = {
    'Dégâts': dmgRange,
    'Armure': state.armor,
    'Vitesse': cls.speed+' c/s',
    'Portée': cls.range+' c',
    'Réduc.': Math.round(state.armor/(state.armor+100)*100)+'%',
    'Kills': state.combatStats.kills||0,
  };
  for (const [l,v] of Object.entries(rows)) {
    c.innerHTML += `<div class="stat-box"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`;
  }
}

const logs = [];
function addLog(msg, type='normal') {
  logs.unshift({msg,type});
  if (logs.length>4) logs.pop();
  const container = document.getElementById('log-container');
  if (container) container.innerHTML = logs.map((l,i)=>`<div class="log-entry ${i===0?'recent':''} ${l.type}">${l.msg}</div>`).join('');
}

// ═══════════════════════════════════════════════════════
// SKILL TREE
// ═══════════════════════════════════════════════════════
function openSkillTree() {
  if (!state.selectedClass) { addLog('Choisissez une classe!','action'); return; }
  state.showSkillTree = true;
  document.getElementById('skill-tree-modal').classList.add('visible');
  const cls = CLASSES[state.selectedClass];
  document.getElementById('tree-modal-title').textContent = `ARBRE — ${cls.name.toUpperCase()}`;
  document.getElementById('tree-modal-subtitle').textContent = `${cls.role} · ${ALL_SKILLS[state.selectedClass].length} compétences`;
  renderSkillTree();
  renderEquippedSlots();
}

function closeSkillTree() {
  state.showSkillTree = false;
  document.getElementById('skill-tree-modal').classList.remove('visible');
  renderSkills();
  if (typeof renderSkillBar === 'function') renderSkillBar();
}

function renderSkillTree() {
  if (!state.selectedClass) return;
  const pool = ALL_SKILLS[state.selectedClass];
  const grid = document.getElementById('skills-grid');
  grid.innerHTML = '';
  pool.forEach((skill, idx) => {
    const isEquipped = state.equippedSkillIds.includes(skill.id);
    const unlocked = typeof isSkillUnlocked === 'function' ? isSkillUnlocked(idx) : true;
    const div = document.createElement('div');
    div.className = 'skill-node' + (isEquipped?' equipped':'') + (!unlocked?' locked':'');
    let typeIcon = skill.targetType==='enemy'?'⚔':skill.targetType==='any'?'💚':skill.targetType==='self'?'👤':skill.targetType.includes('zone')?'💥':'🎯';
    const cdStr = skill.cd>0?`${skill.cd}s`:'—';
    const rangeStr = skill.range>0?`${skill.range}c`:'soi';
    const costStr = skill.resourceDelta<0?` | −${Math.abs(skill.resourceDelta)}`:skill.resourceDelta>0?` | +${skill.resourceDelta}`:'';
    const unlockLvl = 1 + idx * 3;
    if (!unlocked) {
      div.innerHTML = `<div class="skill-node-name locked-name">🔒 ${skill.name}</div><div class="skill-node-desc" style="color:#3a2010;">Débloqué au niveau ${unlockLvl}</div><div class="skill-node-type" style="color:#2a1808;">Niveau requis: ${unlockLvl}</div>`;
    } else {
      div.innerHTML = `<div class="skill-node-name">${skill.name}</div><div class="skill-node-desc">${skill.desc}</div><div class="skill-node-type">${typeIcon} ${rangeStr} · CD:${cdStr}${costStr}</div>${isEquipped?'<div class="skill-node-badge">✓</div>':''}`;
      if (!isEquipped) div.addEventListener('click', ()=>equipSkill(skill.id));
      else { div.addEventListener('click', ()=>unequipSkillById(skill.id)); div.title='Clic pour déséquiper'; }
    }
    grid.appendChild(div);
  });
}

function renderEquippedSlots() {
  for (let i=0;i<3;i++) {
    const id = state.equippedSkillIds[i];
    const nameEl = document.getElementById(`slot-name-${i}`);
    if (id && state.selectedClass) {
      const skill = ALL_SKILLS[state.selectedClass].find(s=>s.id===id);
      if (skill) nameEl.innerHTML = `<span style="color:#c8b090;">${skill.name}</span>`;
      else nameEl.innerHTML = '<span class="equipped-slot-empty">— vide —</span>';
    } else {
      nameEl.innerHTML = '<span class="equipped-slot-empty">— vide —</span>';
    }
    document.getElementById(`slot-${i}`).onclick = ()=>{
      if (state.equippedSkillIds[i]) {
        state.equippedSkillIds[i]='';
        renderEquippedSlots(); renderSkillTree(); renderSkills(); renderSkillBar();
        addLog(`Slot ${i+1} vidé.`,'normal');
      }
    };
  }
}

function equipSkill(skillId) {
  let slot = -1;
  for (let i=0;i<3;i++) { if(!state.equippedSkillIds[i]){slot=i;break;} }
  if (slot===-1) { addLog('Tous les slots sont pleins! Cliquez sur un slot pour le vider.','action'); return; }
  state.equippedSkillIds[slot] = skillId;
  const skName = ALL_SKILLS[state.selectedClass].find(s=>s.id===skillId)?.name;
  addLog(`${skName} équipé en slot ${slot+1}!`,'action');
  renderEquippedSlots(); renderSkillTree(); renderSkills(); renderSkillBar();
}

function unequipSkillById(skillId) {
  const idx = state.equippedSkillIds.indexOf(skillId);
  if (idx>=0) { state.equippedSkillIds[idx]=''; renderEquippedSlots(); renderSkillTree(); renderSkills(); renderSkillBar(); addLog('Skill déséquipé.','normal'); }
}

// ═══════════════════════════════════════════════════════
// STATS PANEL
// ═══════════════════════════════════════════════════════
function toggleStatsPanel() {
  state.showStats = !state.showStats;
  const panel = document.getElementById('stats-panel');
  if (state.showStats) { panel.classList.add('visible'); refreshStatsPanel(); }
  else panel.classList.remove('visible');
}

function refreshStatsPanel() {
  const content = document.getElementById('stats-content');
  if (!content) return;
  let html = '';
  if (!state.selectedClass) { content.innerHTML = '<div style="color:#3a2010;font-style:italic;text-align:center;">Aucune classe sélectionnée.</div>'; return; }

  const cls = CLASSES[state.selectedClass];
  html += `<div style="font-family:'Cinzel Decorative',serif;font-size:12px;color:${cls.color};margin:4px 0 10px;text-align:center;letter-spacing:2px;">— ${cls.name} —</div>`;
  html += `<div style="font-family:'Cinzel',serif;font-size:9px;color:#6b5432;letter-spacing:2px;margin-bottom:6px;border-bottom:1px solid rgba(120,80,30,0.3);padding-bottom:4px;">COMBAT</div>`;

  const hpPct = Math.round((state.hp / state.hpMax) * 100);
  const armorReduc = Math.round(state.armor / (state.armor + 100) * 100);
  const rows = [
    ['Points de vie',   `${state.hp} / ${state.hpMax}  (${hpPct}%)`,   state.hp < state.hpMax*0.3 ? 'danger' : state.hp === state.hpMax ? 'good' : ''],
    ['Armure',          `${state.armor}  (−${armorReduc}% dégâts)`,     ''],
    [cls.resource.name, `${Math.round(state.resource.val)} / ${state.resource.max}`, ''],
    ['Vitesse',         `${cls.speed} c/s`,                             ''],
    ['Portée basique',  `${cls.range} case${cls.range>1?'s':''}`,       ''],
    ['Mult. dégâts',    `×${state.buffs.damage_mult.toFixed(2)}`,       state.buffs.damage_mult > 1 ? 'good' : ''],
  ];
  rows.forEach(([l, v, c]) => {
    html += `<div class="entity-stat-row"><span class="entity-stat-label">${l}</span><span class="entity-stat-val ${c}">${v}</span></div>`;
  });

  // Buffs actifs
  const activeBuffs = [];
  if (state.buffs.fusionActive)       activeBuffs.push(['Fusion',        '×2 dégâts']);
  if (state.buffs.raged)              activeBuffs.push(['Rage',          '+40% dégâts']);
  if (state.buffs.animalForm)         activeBuffs.push(['Forme animale', 'ACTIF']);
  if (state.buffs.eclipseActive)      activeBuffs.push(['Éclipse',       'ACTIF']);
  if (state.buffs.defensiveStance)    activeBuffs.push(['Stance défens.','Immobilisé']);
  if (state.buffs.grandeToile)        activeBuffs.push(['Grande Toile',  'ACTIF']);
  if (state.buffs.totemActive)        activeBuffs.push(['Totem',         'ACTIF']);
  if (state.buffs.auraProtection)     activeBuffs.push(['Aura protec.',  'ACTIF']);
  if (state.buffs.shieldCharges > 0)  activeBuffs.push(['Bouclier',      `×${state.buffs.shieldCharges} charges`]);
  if (state.buffs.summons && state.buffs.summons.length > 0) activeBuffs.push(['Loups invoqués', `×${state.buffs.summons.length}`]);

  if (activeBuffs.length > 0) {
    html += `<div style="font-family:'Cinzel',serif;font-size:9px;color:#6b5432;letter-spacing:2px;margin:10px 0 6px;border-bottom:1px solid rgba(120,80,30,0.3);padding-bottom:4px;">EFFETS ACTIFS</div>`;
    activeBuffs.forEach(([l, v]) => {
      html += `<div class="entity-stat-row"><span class="entity-stat-label">${l}</span><span class="entity-stat-val good">${v}</span></div>`;
    });
  }

  // Historique de combat
  html += `<div style="font-family:'Cinzel',serif;font-size:9px;color:#6b5432;letter-spacing:2px;margin:10px 0 6px;border-bottom:1px solid rgba(120,80,30,0.3);padding-bottom:4px;">HISTORIQUE</div>`;
  html += `<div class="entity-stat-row"><span class="entity-stat-label">Ennemis tués</span><span class="entity-stat-val">${state.combatStats.kills || 0}</span></div>`;
  html += `<div class="entity-stat-row"><span class="entity-stat-label">Dégâts totaux</span><span class="entity-stat-val">${(state.combatStats.dmgDealt || 0).toLocaleString()}</span></div>`;
  html += `<div class="entity-stat-row"><span class="entity-stat-label">Soins reçus</span><span class="entity-stat-val">${(state.combatStats.healed || 0).toLocaleString()}</span></div>`;

  html += `<div style="text-align:center;margin-top:14px;font-family:'IM Fell English',serif;font-style:italic;font-size:10px;color:#3a2010;">[ T ] pour fermer · [ Échap ] annuler</div>`;
  content.innerHTML = html;
}