// ═══════════════════════════════════════════════════════
// TALENT TREE SYSTEM — GDD v2.0
// 6 branches · rangs infinis · reset avec Éclats de Voile
// Points de talent: 3/niveau
// Skills débloqués: 1 au départ, +1 tous les 3 niveaux
// ═══════════════════════════════════════════════════════

// ─── ÉTAT TALENT (ajouté à state) ───────────────────────
// state.talents = {
//   level: 1, xp: 0, xpToNext: 100,
//   points: 3,           // points disponibles
//   eclats: 5,           // Éclats de Voile
//   resetCount: 0,       // nb de resets effectués
//   resetBonus: 0,       // +10% par reset (cumulatif)
//   invested: {},        // { branche_talent_id: rangs }
//   unlockedSkillCount: 1, // nb de skills débloqués (commence à 1)
// }

// ─── RECOMMANDATIONS PAR CLASSE ──────────────────────────
const CLASS_TALENT_RECOMMENDATIONS = {
  // Combattants physiques
  fracture:  { primary: ['force', 'cinetique', 'menace'], secondary: ['endurance', 'flux'] },
  briseur:   { primary: ['force', 'endurance', 'menace'], secondary: ['cinetique', 'flux'] },
  assassin:  { primary: ['cinetique', 'force', 'menace'], secondary: ['flux', 'arcane'] },
  
  // Mages / Magiques
  mage:      { primary: ['arcane', 'flux', 'cinetique'], secondary: ['endurance'] },
  druide:    { primary: ['arcane', 'flux', 'endurance'], secondary: ['cinetique'] },
  tisseuse:  { primary: ['arcane', 'cinetique', 'menace'], secondary: ['force', 'flux'] },
  
  // Hybride sacré
  paladin:   { primary: ['force', 'endurance', 'menace'], secondary: ['arcane'] },
};

// ─── DÉFINITION DES 6 BRANCHES ───────────────────────────
const TALENT_BRANCHES = [
  {
    id: 'force', name: 'Force Brute', icon: '⚔', color: '#e74c3c',
    desc: 'Dégâts physiques & critiques',
    talents: [
      { id: 'tranchant',     name: 'Tranchant',           cost: 1, desc: '+2% dégâts physiques/rang',               effect: 'phys_dmg',      value: 2,  unit: '%' },
      { id: 'pen_armure',    name: 'Pénétration d\'armure',cost: 1, desc: '+1% armure ignorée/rang',                 effect: 'armor_pen',     value: 1,  unit: '%' },
      { id: 'crit_chance',   name: 'Coup critique',        cost: 1, desc: '+1% chance de critique/rang',             effect: 'crit_chance',   value: 1,  unit: '%' },
      { id: 'crit_mult',     name: 'Multiplicateur crit',  cost: 2, desc: '+3% dégâts sur coup critique/rang',       effect: 'crit_mult',     value: 3,  unit: '%' },
      { id: 'frappe_lourde', name: 'Frappe lourde',        cost: 2, desc: '+5% dégâts sur ennemis >50% vie/rang',    effect: 'heavy_strike',  value: 5,  unit: '%' },
    ]
  },
  {
    id: 'arcane', name: 'Arcane', icon: '✦', color: '#9b4dca',
    desc: 'Dégâts magiques & statuts',
    talents: [
      { id: 'intensite',     name: 'Intensité',            cost: 1, desc: '+2% dégâts magiques/rang',                effect: 'magic_dmg',     value: 2,  unit: '%' },
      { id: 'surcharge',     name: 'Surcharge',            cost: 2, desc: '+1.5% dégâts si ressource >70%/rang',     effect: 'surge_dmg',     value: 1.5, unit: '%' },
      { id: 'fragilite',     name: 'Fragilité',            cost: 2, desc: 'Hits magiques: –0.5% résist. cible/rang', effect: 'fragile',       value: 0.5, unit: '%' },
      { id: 'explo_voile',   name: 'Explosion de Voile',   cost: 2, desc: '+4% dégâts magiques sur cibles avec statut/rang', effect: 'veil_explo', value: 4, unit: '%' },
      { id: 'debordement',   name: 'Débordement',          cost: 3, desc: 'Ressource pleine: +5% dégâts 3s/rang',   effect: 'overflow',      value: 5,  unit: '%' },
    ]
  },
  {
    id: 'endurance', name: 'Endurance', icon: '🛡', color: '#3498db',
    desc: 'Vie · Défense · Résistances',
    talents: [
      { id: 'vitalite',      name: 'Vitalité',             cost: 1, desc: '+15 PV maximum/rang',                    effect: 'max_hp',        value: 15, unit: '' },
      { id: 'chair_epaisse', name: 'Chair épaisse',        cost: 1, desc: '+1% réduction dégâts physiques/rang (max 30%)', effect: 'phys_reduc', value: 1, unit: '%' },
      { id: 'res_magique',   name: 'Résistance magique',   cost: 1, desc: '+1% résistance magique/rang',             effect: 'magic_res',     value: 1,  unit: '%' },
      { id: 'res_statuts',   name: 'Résistance statuts',   cost: 2, desc: '+3% résistance aux CC/rang',              effect: 'cc_res',        value: 3,  unit: '%' },
      { id: 'armure_renf',   name: 'Armure renforcée',     cost: 2, desc: '+5 armure plate/rang',                   effect: 'flat_armor',    value: 5,  unit: '' },
      { id: 'bastion',       name: 'Bastion',              cost: 3, desc: '+2% réduction si vie <30%/rang',          effect: 'bastion',       value: 2,  unit: '%' },
    ]
  },
  {
    id: 'flux', name: 'Flux', icon: '⚡', color: '#27ae60',
    desc: 'Régénération de ressource',
    talents: [
      { id: 'reservoir',     name: 'Réservoir',            cost: 1, desc: '+5% ressource maximum/rang',              effect: 'res_max',       value: 5,  unit: '%' },
      { id: 'flux_naturel',  name: 'Flux naturel',         cost: 1, desc: '+0.5% régén. ressource/s par rang',       effect: 'res_regen',     value: 0.5, unit: '%' },
      { id: 'recup_rapide',  name: 'Récupération rapide',  cost: 2, desc: 'Réduit délai avant regen de 0.2s/rang',   effect: 'regen_delay',   value: 0.2, unit: 's' },
      { id: 'economie',      name: 'Économie',             cost: 2, desc: 'Réduit coût ressource skills de 1%/rang', effect: 'skill_cost',    value: 1,  unit: '%' },
      { id: 'plein_flux',    name: 'Plein flux',           cost: 3, desc: 'Ressource pleine: +3% dégâts 3s/rang',    effect: 'full_flux',     value: 3,  unit: '%' },
    ]
  },
  {
    id: 'cinetique', name: 'Cinétique', icon: '💨', color: '#e67e22',
    desc: 'Vitesse d\'attaque & déplacement',
    talents: [
      { id: 'celerite',      name: 'Célérité',             cost: 1, desc: '+1% vitesse d\'attaque/rang (max +50%)',  effect: 'atk_speed',     value: 1,  unit: '%' },
      { id: 'fluidite',      name: 'Fluidité',             cost: 1, desc: '+1% vitesse déplacement/rang (max +40%)', effect: 'move_speed',    value: 1,  unit: '%' },
      { id: 'elan',          name: 'Élan',                 cost: 2, desc: '+5% dégâts 2s après un dash/rang',        effect: 'dash_bonus',    value: 5,  unit: '%' },
      { id: 'frappe_enc',    name: 'Frappe enchaînée',     cost: 2, desc: '+0.5% vitesse par attaque consécutive (max ×10)/rang', effect: 'chain_atk', value: 0.5, unit: '%' },
      { id: 'fuite_tact',    name: 'Fuite tactique',       cost: 3, desc: '+15% vitesse 2s après avoir reçu un crit/rang', effect: 'flee_speed', value: 15, unit: '%' },
    ]
  },
  {
    id: 'menace', name: 'Menace', icon: '👁', color: '#c8a96e',
    desc: 'Aggro & régénération sous pression',
    talents: [
      { id: 'presence',      name: 'Présence imposante',   cost: 1, desc: '+5% génération de menace/rang',           effect: 'threat_gen',    value: 5,  unit: '%' },
      { id: 'recup_pression',name: 'Récupération sous pression', cost: 2, desc: '+1% ressource par coup reçu si 2+ ennemis/rang', effect: 'under_pressure', value: 1, unit: '%' },
      { id: 'cri_guerre',    name: 'Cri de guerre',        cost: 2, desc: '+10% génération menace sur skills/rang',  effect: 'war_cry',       value: 10, unit: '%' },
      { id: 'drain_agr',     name: 'Drain d\'agression',   cost: 2, desc: '–0.5% dégâts reçus par ennemi ciblant (max 5)/rang', effect: 'aggro_drain', value: 0.5, unit: '%' },
      { id: 'focal_menace',  name: 'Focal de menace',      cost: 3, desc: 'Ciblé par 3+ ennemis: +2% regen ressource/s/rang', effect: 'focal', value: 2, unit: '%' },
      { id: 'rayon_haine',   name: 'Rayonnement de haine', cost: 4, desc: 'Ennemis à <3 cases attirent menace automatiquement/rang', effect: 'hate_aura', value: 1, unit: '' },
    ]
  },
];

// ─── XP TABLE (courbe logarithmique) ─────────────────────
function xpForLevel(lvl) {
  // 100 × lvl^1.4 — raisonnable et infini
  return Math.floor(100 * Math.pow(lvl, 1.4));
}

// ─── COÛT D'UN RANG ──────────────────────────────────────
function talentRankCost(talent, currentRank) {
  // Rangs 1-10: coût de base, rangs 11-20: ×2, 21-30: ×3, etc.
  const tierMult = Math.ceil((currentRank + 1) / 10);
  return talent.cost * tierMult;
}

// ─── INIT TALENTS ────────────────────────────────────────
function initTalents() {
  if (state.talents) return; // déjà initialisé
  state.talents = {
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    points: 3,         // commence avec 3 points (niveau 1)
    eclats: 5,         // Éclats de Voile de départ
    resetCount: 0,
    resetBonus: 0,     // % permanent par reset
    invested: {},      // { talentId: rangs }
    unlockedSkillCount: 1, // 1 seul skill au départ
  };
}

// ─── GAGNER DE L'XP ──────────────────────────────────────
function gainXP(amount) {
  if (!state.talents) initTalents();
  const t = state.talents;
  t.xp += amount;
  let leveled = false;
  while (t.xp >= t.xpToNext) {
    t.xp -= t.xpToNext;
    t.level++;
    t.points += 3;
    t.xpToNext = xpForLevel(t.level);

    // Débloquer un skill tous les 3 niveaux
    const maxSkills = ALL_SKILLS[state.selectedClass]?.length || 10;
    const newUnlock = Math.min(maxSkills, 1 + Math.floor((t.level - 1) / 3));
    if (newUnlock > t.unlockedSkillCount) {
      t.unlockedSkillCount = newUnlock;
      const newSkill = ALL_SKILLS[state.selectedClass]?.[newUnlock - 1];
      if (newSkill) {
        addLog(`✦ Nouveau skill débloqué: ${newSkill.name}!`, 'action');
        spawnFloater(state.player.gridX, state.player.gridY, '✦ NIVEAU ' + t.level, '#c8a96e', 18);
      }
    } else {
      spawnFloater(state.player.gridX, state.player.gridY, '✦ NIV.' + t.level, '#c8a96e', 18);
    }

    addLog(`⬆ Niveau ${t.level}! +3 points de talent. (${t.points} disponibles)`, 'action');
    leveled = true;
    // Level-up audio + VFX
    if (typeof AudioEngine !== 'undefined') AudioEngine.play.levelUp();
    if (typeof spawnLevelUpVFX === 'function') spawnLevelUpVFX(t.level);
  }
  if (leveled) updateTalentHUD();
  return leveled;
}

// ─── INVESTIR UN RANG ────────────────────────────────────
function investTalent(talentId) {
  if (!state.talents) initTalents();
  const t = state.talents;

  // Trouver le talent
  let talent = null;
  for (const branch of TALENT_BRANCHES) {
    talent = branch.talents.find(tal => tal.id === talentId);
    if (talent) break;
  }
  if (!talent) return;

  const currentRank = t.invested[talentId] || 0;
  const cost = talentRankCost(talent, currentRank);

  if (t.points < cost) {
    addLog(`Points insuffisants! (besoin: ${cost}, disponible: ${t.points})`, 'normal');
    return;
  }

  t.invested[talentId] = currentRank + 1;
  t.points -= cost;

  addLog(`✦ ${talent.name} → Rang ${currentRank + 1} (coût: ${cost} pt)`, 'action');

  // Appliquer l'effet immédiatement
  applyTalentEffect(talent, currentRank + 1);
  updateTalentHUD();
  renderTalentTree();
}

// ─── APPLIQUER UN EFFET DE TALENT ────────────────────────
function applyTalentEffect(talent, newRank) {
  // On recalcule tout à partir de zéro pour éviter les doublons
  recalcTalentBonuses();
}

// ─── RECALCULER TOUS LES BONUS ───────────────────────────
function getTalentBonus(effectId) {
  if (!state.talents) return 0;
  let total = 0;
  for (const branch of TALENT_BRANCHES) {
    for (const talent of branch.talents) {
      if (talent.effect === effectId) {
        const ranks = state.talents.invested[talent.id] || 0;
        total += talent.value * ranks;
      }
    }
  }
  return total;
}

function recalcTalentBonuses() {
  if (!state.selectedClass || !state.talents) return;
  const cls = CLASSES[state.selectedClass];
  const resetMult = 1 + state.talents.resetBonus / 100;

  // PV max
  const hpBonus = getTalentBonus('max_hp');
  state.hpMax = Math.round((cls.hpMax + hpBonus) * resetMult);
  state.hp = Math.min(state.hp, state.hpMax);

  // Armure
  const armorFlat = getTalentBonus('flat_armor');
  state.armor = cls.armor + armorFlat;

  // Vitesse (stockée dans bonus temporaire, utilisée par beginNextStep)
  state.talentBonuses = {
    physDmg:     getTalentBonus('phys_dmg'),
    magicDmg:    getTalentBonus('magic_dmg'),
    critChance:  getTalentBonus('crit_chance'),
    critMult:    getTalentBonus('crit_mult'),
    armorPen:    getTalentBonus('armor_pen'),
    moveSpeed:   getTalentBonus('move_speed'),
    atkSpeed:    getTalentBonus('atk_speed'),
    resMax:      getTalentBonus('res_max'),
    resRegen:    getTalentBonus('res_regen'),
    skillCost:   getTalentBonus('skill_cost'),
    heavyStrike: getTalentBonus('heavy_strike'),
    overflow:    getTalentBonus('overflow'),
    surgedmg:    getTalentBonus('surge_dmg'),
    fullFlux:    getTalentBonus('full_flux'),
  };

  updateHpUI();
}

// ─── RESET TALENTS ───────────────────────────────────────
function resetTalents() {
  if (!state.talents) initTalents();
  const t = state.talents;

  // Coût en Éclats
  const resetCosts = [10, 25, 50, 75];
  const cost = t.resetCount < resetCosts.length
    ? resetCosts[t.resetCount]
    : resetCosts[resetCosts.length - 1] + (t.resetCount - resetCosts.length + 1) * 25;

  if (t.eclats < cost) {
    addLog(`Éclats insuffisants! (besoin: ${cost} Éclats, vous avez: ${t.eclats})`, 'normal');
    return;
  }

  // Calculer les points récupérés
  let recoveredPoints = 0;
  for (const branch of TALENT_BRANCHES) {
    for (const talent of branch.talents) {
      const ranks = t.invested[talent.id] || 0;
      for (let r = 0; r < ranks; r++) {
        recoveredPoints += talentRankCost(talent, r);
      }
    }
  }

  // Effectuer le reset
  t.eclats -= cost;
  t.resetCount++;
  t.resetBonus += 10; // +10% permanent par reset
  t.invested = {};
  t.points += recoveredPoints;

  // Recalculer
  recalcTalentBonuses();
  updateTalentHUD();
  renderTalentTree();

  addLog(`✦ Reset des talents effectué! +10% stats permanentes (total: +${t.resetBonus}%). ${recoveredPoints} points récupérés.`, 'action');
  spawnFloater(state.player.gridX, state.player.gridY, `+${t.resetBonus}% STATS`, '#c8a96e', 16);
}

// ─── DONNER DES ÉCLATS (récompense boss, etc.) ──────────
function gainEclats(amount) {
  if (!state.talents) initTalents();
  state.talents.eclats += amount;
  addLog(`✦ +${amount} Éclat(s) de Voile! (total: ${state.talents.eclats})`, 'action');
  updateTalentHUD();
}

// ─── HUD TALENT (niveau + points) ────────────────────────
function updateTalentHUD() {
  const el = document.getElementById('talent-hud');
  if (!el || !state.talents) return;
  const t = state.talents;
  const xpPct = Math.min(100, (t.xp / t.xpToNext) * 100).toFixed(1);
  el.innerHTML = `
    <div class="talent-hud-row">
      <span class="talent-lvl">NIV.${t.level}</span>
      <span class="talent-pts" title="Points de talent disponibles">${t.points} pts</span>
      <span class="talent-eclats" title="Éclats de Voile">✦${t.eclats}</span>
    </div>
    <div class="talent-xp-bar-wrap" title="${t.xp}/${t.xpToNext} XP">
      <div class="talent-xp-bar" style="width:${xpPct}%"></div>
    </div>
    ${t.resetBonus > 0 ? `<div class="talent-reset-bonus">+${t.resetBonus}% stats</div>` : ''}
  `;
}

// ─── RENDU DE L'ARBRE DE TALENTS ─────────────────────────
function openTalentTree() {
  if (!state.selectedClass) { addLog('Choisissez une classe!', 'normal'); return; }
  if (!state.talents) initTalents();
  state.showTalentTree = true;
  const modal = document.getElementById('talent-tree-modal');
  modal.style.display = 'block';
  modal.classList.add('visible');
  renderTalentTree();
}

function closeTalentTree() {
  state.showTalentTree = false;
  const modal = document.getElementById('talent-tree-modal');
  modal.style.display = 'none';
  modal.classList.remove('visible');
}

function renderTalentTree() {
  if (!state.talents) initTalents();
  const t = state.talents;
  const cls = state.selectedClass ? CLASSES[state.selectedClass] : null;

  // Header
  document.getElementById('talent-tree-title').textContent =
    `ARBRE DE TALENTS — ${cls ? cls.name.toUpperCase() : ''}`;
  document.getElementById('talent-tree-info').innerHTML =
    `<span class="tt-pts">Points: <strong>${t.points}</strong></span>
     <span class="tt-eclats">Éclats: <strong>${t.eclats} ✦</strong></span>
     <span class="tt-lvl">Niveau: <strong>${t.level}</strong></span>
     ${t.resetBonus > 0 ? `<span class="tt-bonus">+${t.resetBonus}% stats</span>` : ''}`;

  document.getElementById('talent-skills-info').innerHTML =
    `Skills débloqués: <strong>${t.unlockedSkillCount} / ${ALL_SKILLS[state.selectedClass]?.length || 10}</strong>
     <span style="font-style:italic;font-size:9px;"> (1 tous les 3 niveaux)</span>`;

  const container = document.getElementById('talent-branches');
  container.innerHTML = '';

  // Filter branches for current class
  const classRec = CLASS_TALENT_RECOMMENDATIONS[state.selectedClass] || { primary: [], secondary: [] };
  const relevantBranches = TALENT_BRANCHES.filter(b =>
    classRec.primary.includes(b.id) || classRec.secondary.includes(b.id)
  );
  const displayBranches = relevantBranches.length > 0 ? relevantBranches : TALENT_BRANCHES;

  displayBranches.forEach(branch => {
    const isPrimary = classRec.primary.includes(branch.id);
    const branchDiv = document.createElement('div');
    branchDiv.className = 'talent-branch';
    branchDiv.style.setProperty('--branch-color', branch.color);
    branchDiv.style.cssText += `
      background: linear-gradient(180deg, rgba(8,4,2,0.98), rgba(5,2,1,0.96));
      border: 1px solid ${branch.color}33;
      border-top: 2px solid ${branch.color}88;
      border-radius: 4px;
      padding: 10px;
      position: relative;
      overflow: visible;
    `;

    // Branch header
    const totalInvested = branch.talents.reduce((s, tal) => s + (t.invested[tal.id] || 0), 0);
    branchDiv.innerHTML = `
      <div class="branch-header" style="border-bottom:1px solid ${branch.color}33;padding-bottom:6px;margin-bottom:10px;">
        <span class="branch-icon" style="color:${branch.color};font-size:16px;">${branch.icon}</span>
        <span class="branch-name" style="color:${branch.color};">${branch.name}</span>
        ${isPrimary ? `<span style="font-size:9px;color:${branch.color};background:${branch.color}22;padding:1px 5px;border-radius:2px;margin-left:4px;font-family:'Cinzel',serif;">PRIMAIRE</span>` : `<span style="font-size:9px;color:#5a4030;background:rgba(80,50,20,0.2);padding:1px 5px;border-radius:2px;margin-left:4px;font-family:'Cinzel',serif;">secondaire</span>`}
        <span class="branch-desc">${branch.desc}</span>
        ${totalInvested > 0 ? `<span style="float:right;font-family:'Cinzel',serif;font-size:9px;color:${branch.color};background:${branch.color}22;padding:1px 6px;border-radius:2px;">${totalInvested} rang(s)</span>` : ''}
      </div>
      <div class="branch-talents-visual" id="branch-${branch.id}" style="display:flex;flex-direction:column;gap:0;align-items:stretch;"></div>
    `;
    container.appendChild(branchDiv);

    const branchTalentsEl = branchDiv.querySelector(`#branch-${branch.id}`);
    branch.talents.forEach((talent, talIdx) => {
      const currentRank = t.invested[talent.id] || 0;
      const nextCost = talentRankCost(talent, currentRank);
      const canAfford = t.points >= nextCost;
      const maxRank = 10; // visual max for bars

      // Connector line between nodes
      if (talIdx > 0) {
        const connDiv = document.createElement('div');
        connDiv.style.cssText = `
          width: 2px; height: 12px; margin: 0 auto;
          background: ${currentRank > 0 ? branch.color + '88' : branch.color + '22'};
          transition: background 0.3s;
        `;
        branchTalentsEl.appendChild(connDiv);
      }

      const talDiv = document.createElement('div');
      const isInvested = currentRank > 0;
      const rankPct = Math.min(100, (currentRank / maxRank) * 100);

      talDiv.style.cssText = `
        background: ${isInvested ? branch.color + '18' : 'rgba(10,5,2,0.8)'};
        border: 1px solid ${isInvested ? branch.color + '66' : branch.color + '22'};
        border-left: 3px solid ${isInvested ? branch.color : branch.color + '33'};
        border-radius: 3px;
        padding: 7px 9px;
        cursor: ${canAfford ? 'pointer' : 'default'};
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
      `;

      // Rank progress bar background
      const progressHtml = `
        <div style="position:absolute;bottom:0;left:0;height:2px;width:${rankPct}%;background:${branch.color}88;transition:width 0.4s;"></div>
      `;

      // Rank dots
      const rankDots = Array.from({length: Math.min(10, maxRank)}, (_, i) =>
        `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 1px;background:${i < currentRank ? branch.color : branch.color + '22'};border:1px solid ${branch.color + '44'};vertical-align:middle;"></span>`
      ).join('');

      talDiv.innerHTML = `
        ${progressHtml}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
          <div style="flex:1;">
            <div style="font-family:'Cinzel',serif;font-size:11px;color:${isInvested ? branch.color : '#8a6040'};margin-bottom:2px;font-weight:${isInvested ? 'bold' : 'normal'};">${talent.name}</div>
            <div style="font-family:'IM Fell English',serif;font-style:italic;font-size:10px;color:#4a3020;line-height:1.3;">${talent.desc}</div>
            ${currentRank > 0 ? `<div style="font-family:'Cinzel',serif;font-size:9px;color:#27ae60;margin-top:3px;">Bonus actuel: +${(talent.value * currentRank).toFixed(1)}${talent.unit}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Cinzel Decorative',serif;font-size:14px;color:${isInvested ? branch.color : '#3a2010'};">${currentRank}</div>
            <div style="font-size:8px;color:#3a2010;">rang</div>
          </div>
        </div>
        <div style="margin-top:5px;display:flex;align-items:center;gap:6px;">
          <div style="flex:1;">${rankDots}</div>
          ${canAfford
            ? `<button onclick="investTalent('${talent.id}')" style="font-family:'Cinzel',serif;font-size:9px;color:${branch.color};background:${branch.color}22;border:1px solid ${branch.color}55;padding:2px 8px;border-radius:2px;cursor:pointer;letter-spacing:1px;">+1 (${nextCost}pt)</button>`
            : `<span style="font-family:'Cinzel',serif;font-size:9px;color:#2a1808;">${nextCost}pt</span>`
          }
        </div>
      `;

      if (canAfford) {
        talDiv.addEventListener('mouseenter', () => {
          talDiv.style.borderLeftColor = branch.color;
          talDiv.style.background = branch.color + '28';
        });
        talDiv.addEventListener('mouseleave', () => {
          talDiv.style.background = isInvested ? branch.color + '18' : 'rgba(10,5,2,0.8)';
          talDiv.style.borderLeftColor = isInvested ? branch.color : branch.color + '33';
        });
      }

      branchTalentsEl.appendChild(talDiv);
    });
  });

  // Reset button
  const resetCosts = [10, 25, 50, 75];
  const nextResetCost = t.resetCount < resetCosts.length
    ? resetCosts[t.resetCount]
    : resetCosts[resetCosts.length - 1] + (t.resetCount - resetCosts.length + 1) * 25;
  const canReset = t.eclats >= nextResetCost && Object.keys(t.invested).length > 0;

  document.getElementById('talent-reset-section').innerHTML = `
    <div class="reset-info" style="max-width:500px;margin:0 auto;border:1px solid rgba(200,169,110,0.3);background:rgba(10,5,2,0.9);border-radius:4px;padding:12px;text-align:center;">
      <div class="reset-title" style="font-family:'Cinzel Decorative',serif;font-size:12px;color:#c8a96e;margin-bottom:4px;">✦ Réinitialisation des Talents</div>
      <div class="reset-desc">Reset n°${t.resetCount + 1} — Coût: <strong>${nextResetCost} Éclats</strong> de Voile</div>
      <div class="reset-bonus-info" style="font-size:10px;color:#6a5030;margin:4px 0;">Chaque reset donne <strong>+10% stats permanentes</strong> (cumulatif)</div>
      ${t.resetBonus > 0 ? `<div style="font-family:'Cinzel',serif;font-size:10px;color:#27ae60;">✦ Bonus actuel: +${t.resetBonus}% à toutes les stats</div>` : ''}
      <button class="reset-btn${canReset ? ' enabled' : ''}" onclick="${canReset ? 'confirmResetTalents()' : ''}"
        ${canReset ? '' : 'disabled'} style="margin-top:8px;">
        ${canReset ? `✦ Réinitialiser (${nextResetCost} Éclats)` : `Insuffisant (${t.eclats}/${nextResetCost} ✦)`}
      </button>
    </div>
  `;
}

function confirmResetTalents() {
  if (!state.talents) return;
  const t = state.talents;
  const resetCosts = [10, 25, 50, 75];
  const nextResetCost = t.resetCount < resetCosts.length
    ? resetCosts[t.resetCount]
    : resetCosts[resetCosts.length - 1] + (t.resetCount - resetCosts.length + 1) * 25;

  // Simple confirmation visuelle
  const btn = document.querySelector('.reset-btn.enabled');
  if (!btn) return;
  if (btn.dataset.confirmed !== 'yes') {
    btn.textContent = '⚠ Confirmer le reset?';
    btn.dataset.confirmed = 'yes';
    btn.style.background = 'rgba(200, 50, 20, 0.4)';
    setTimeout(() => { if (btn.dataset.confirmed === 'yes') { btn.dataset.confirmed = ''; renderTalentTree(); } }, 3000);
  } else {
    btn.dataset.confirmed = '';
    resetTalents();
  }
}

// ─── SKILL UNLOCK CHECK ──────────────────────────────────
// Retourne vrai si un skill est débloqué (index 0-based)
function isSkillUnlocked(skillIndex) {
  if (!state.talents) return skillIndex === 0; // seul le premier skill est dispo au début
  return skillIndex < state.talents.unlockedSkillCount;
}