// ═══════════════════════════════════════════════════════
// VEILBORN — PHASE 1 : ÉCONOMIE & RÉCOMPENSES
// Inventaire · Loot · Marchand
// ═══════════════════════════════════════════════════════

// ─────────────────────────────────────────
// ÉTAT ÉCONOMIE (ajouté à state)
// ─────────────────────────────────────────
function initEconomy() {
  if (!state.economy) {
    state.economy = {
      gold: 50,            // Or de départ
      inventory: [],       // Array d'items { id, name, slot, bonus, rarity, value, icon, effect }
      equippedItems: {     // Slots d'équipement
        weapon: null,
        armor: null,
        cape: null,
        amulet: null,
      },
    };
  }
  updateGoldUI();
}

// ─────────────────────────────────────────
// TABLES DE LOOT
// ─────────────────────────────────────────
const LOOT_RARITIES = {
  common:   { label:'Commun',    color:'#a0a0a0', chance:0.55, goldMult:1.0 },
  uncommon: { label:'Inhabituel',color:'#4eff4e', chance:0.30, goldMult:1.5 },
  rare:     { label:'Rare',      color:'#4ea8ff', chance:0.12, goldMult:2.5 },
  epic:     { label:'Épique',    color:'#c030ff', chance:0.03, goldMult:5.0 },
};

const ITEM_TEMPLATES = {
  // ── Armes ──────────────────────────────────
  lame_fracturee:   { name:'Lame fracturée',    slot:'weapon', icon:'⚔',  baseBonus:'+12 ATK',   effect:{ atk:12 },          baseValue:80  },
  gantelet_briseur: { name:'Gantelet du Briseur',slot:'weapon',icon:'🥊', baseBonus:'+18 ATK',   effect:{ atk:18 },          baseValue:120 },
  baguette_voile:   { name:'Baguette du Voile', slot:'weapon', icon:'🪄', baseBonus:'+10 ATK, +20% CD',effect:{ atk:10, cdReduc:0.2 }, baseValue:150 },
  dague_venin:      { name:'Dague de venin',    slot:'weapon', icon:'🗡', baseBonus:'+8 ATK, poison',effect:{ atk:8, poison:true },  baseValue:110 },
  masse_sainte:     { name:'Masse sainte',      slot:'weapon', icon:'🔨', baseBonus:'+15 ATK',   effect:{ atk:15 },          baseValue:100 },
  // ── Armures ────────────────────────────────
  tunique_rune:     { name:'Tunique runique',   slot:'armor',  icon:'👕', baseBonus:'+20 ARM',   effect:{ armor:20 },        baseValue:90  },
  cotte_forge:      { name:'Cotte forgée',      slot:'armor',  icon:'🛡', baseBonus:'+35 ARM',   effect:{ armor:35 },        baseValue:140 },
  robe_tisseuse:    { name:'Robe de la Tisseuse',slot:'armor', icon:'🧥', baseBonus:'+15 ARM, +10% PV',effect:{ armor:15, hpPct:0.1 }, baseValue:160 },
  cuir_ombre:       { name:'Cuir de l\'Ombre',  slot:'armor',  icon:'🥷', baseBonus:'+12 ARM, +0.5 VIT',effect:{ armor:12, speed:0.5 }, baseValue:130 },
  // ── Capes ──────────────────────────────────
  cape_voile:       { name:'Cape du Voile',     slot:'cape',   icon:'🧣', baseBonus:'+10% dégâts',effect:{ dmgPct:0.1 },    baseValue:100 },
  cape_foret:       { name:'Cape forestière',   slot:'cape',   icon:'🪶', baseBonus:'+5% esquive',effect:{ dodge:0.05 },    baseValue:80  },
  manteau_deuil:    { name:'Manteau de deuil',  slot:'cape',   icon:'🌑', baseBonus:'+15% dégâts de sort',effect:{spellDmg:0.15}, baseValue:120 },
  // ── Amulettes ──────────────────────────────
  amulette_soin:    { name:'Amulette de soin',  slot:'amulet', icon:'💚', baseBonus:'+30 PV max', effect:{ maxHp:30 },      baseValue:90  },
  pierre_arcane:    { name:'Pierre arcanique',  slot:'amulet', icon:'💜', baseBonus:'+8% ressource',effect:{ resPct:0.08 }, baseValue:110 },
  oeil_veille:      { name:'Œil qui veille',    slot:'amulet', icon:'👁', baseBonus:'+1 portée', effect:{ range:1 },        baseValue:150 },
  sceau_forge:      { name:'Sceau forgé',       slot:'amulet', icon:'🔥', baseBonus:'+25% CD skill 1',effect:{ cdReduc1:0.25 }, baseValue:130 },
};

// Loot par type d'ennemi (ids d'items possibles)
const ENEMY_LOOT_TABLE = {
  fracture: ['lame_fracturee','cape_voile','pierre_arcane','tunique_rune'],
  gloom:    ['manteau_deuil','oeil_veille','cuir_ombre','dague_venin'],
  revenant: ['amulette_soin','robe_tisseuse','baguette_voile','cape_foret'],
  arcane:   ['sceau_forge','pierre_arcane','cotte_forge','gantelet_briseur'],
  default:  ['tunique_rune','lame_fracturee','amulette_soin','cape_foret'],
};

function rollRarity() {
  const r = Math.random();
  let cumul = 0;
  for (const [key, data] of Object.entries(LOOT_RARITIES)) {
    cumul += data.chance;
    if (r < cumul) return key;
  }
  return 'common';
}

function generateItem(templateId, rarity) {
  const tpl = ITEM_TEMPLATES[templateId];
  if (!tpl) return null;
  const rar = LOOT_RARITIES[rarity];
  const bonusText = rarity !== 'common' ? `${tpl.baseBonus}` : tpl.baseBonus;
  return {
    id: `${templateId}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    templateId,
    name: tpl.name,
    slot: tpl.slot,
    icon: tpl.icon,
    bonus: bonusText,
    rarity,
    rarityLabel: rar.label,
    rarityColor: rar.color,
    effect: { ...tpl.effect },
    value: Math.round(tpl.baseValue * rar.goldMult),
  };
}

// ─────────────────────────────────────────
// DROP AU DÉCÈS D'UN ENNEMI
// ─────────────────────────────────────────
function onEnemyKilled(enemy) {
  if (!state.economy) initEconomy();

  // Or de base (ennemi normal = 8-20 or)
  const baseGold = enemy.isBoss ? 120 + Math.floor(Math.random()*80)
                                : 8 + Math.floor(Math.random()*13);
  addGold(baseGold);
  spawnFloater(enemy.gridX, enemy.gridY, `+${baseGold}g`, '#f1c40f', 13);

  // 40% de chance de drop d'objet (boss: 100%)
  const dropChance = enemy.isBoss ? 1.0 : 0.40;
  if (Math.random() < dropChance) {
    const table = ENEMY_LOOT_TABLE[enemy.type] || ENEMY_LOOT_TABLE.default;
    const templateId = table[Math.floor(Math.random()*table.length)];
    const rarity = enemy.isBoss ? (Math.random()<0.5?'rare':'epic') : rollRarity();
    const item = generateItem(templateId, rarity);
    if (item) {
      addItemToInventory(item);
      spawnFloater(enemy.gridX, enemy.gridY-1, `${item.icon} ${item.name}!`, item.rarityColor, 12);
      addLog(`Loot: ${item.icon} ${item.name} [${item.rarityLabel}]`, 'action');
    }
  }
}

// ─────────────────────────────────────────
// OR
// ─────────────────────────────────────────
function addGold(amount) {
  if (!state.economy) initEconomy();
  state.economy.gold += amount;
  updateGoldUI();
}

function spendGold(amount) {
  if (!state.economy) initEconomy();
  if (state.economy.gold < amount) return false;
  state.economy.gold -= amount;
  updateGoldUI();
  return true;
}

function updateGoldUI() {
  const el = document.getElementById('gold-display');
  if (el) el.textContent = `${state.economy?.gold ?? 0} g`;
}

// ─────────────────────────────────────────
// INVENTAIRE
// ─────────────────────────────────────────
function addItemToInventory(item) {
  if (!state.economy) initEconomy();
  if (state.economy.inventory.length >= 20) {
    addLog(`Inventaire plein! ${item.name} perdu.`, 'action');
    return;
  }
  state.economy.inventory.push(item);
  refreshInventoryUI();
}

function removeItemFromInventory(itemId) {
  if (!state.economy) return;
  state.economy.inventory = state.economy.inventory.filter(i => i.id !== itemId);
  refreshInventoryUI();
}

// ─────────────────────────────────────────
// ÉQUIPEMENT
// ─────────────────────────────────────────
function equipItem(itemId) {
  if (!state.economy) return;
  const item = state.economy.inventory.find(i => i.id === itemId);
  if (!item) return;

  // Déséquiper l'item actuel dans ce slot
  const currentEquipped = state.economy.equippedItems[item.slot];
  if (currentEquipped) {
    unapplyItemEffect(currentEquipped);
    addItemToInventory(currentEquipped);
  }

  // Équiper le nouvel item
  state.economy.equippedItems[item.slot] = item;
  removeItemFromInventory(itemId);
  applyItemEffect(item);

  addLog(`${item.icon} ${item.name} équipé!`, 'action');
  refreshInventoryUI();
  updateHpUI();
  renderStats();
}

function unequipItem(slot) {
  if (!state.economy) return;
  const item = state.economy.equippedItems[slot];
  if (!item) return;
  if (state.economy.inventory.length >= 20) {
    addLog('Inventaire plein, impossible de déséquiper!', 'action');
    return;
  }
  unapplyItemEffect(item);
  state.economy.equippedItems[slot] = null;
  addItemToInventory(item);
  addLog(`${item.icon} ${item.name} retiré.`, 'normal');
  refreshInventoryUI();
  updateHpUI();
  renderStats();
}

function applyItemEffect(item) {
  if (!item || !item.effect) return;
  const e = item.effect;
  if (e.atk)      state.itemBonuses.atk      = (state.itemBonuses.atk || 0) + e.atk;
  if (e.armor)  { state.armor += e.armor; state.baseArmor = (state.baseArmor||0) + e.armor; }
  if (e.maxHp)  { state.hpMax += e.maxHp; state.hp = Math.min(state.hp + e.maxHp, state.hpMax); }
  if (e.speed)    state.itemBonuses.speed  = (state.itemBonuses.speed || 0) + e.speed;
  if (e.range)    state.itemBonuses.range  = (state.itemBonuses.range || 0) + e.range;
  if (e.dmgPct)   state.itemBonuses.dmgPct = (state.itemBonuses.dmgPct || 0) + e.dmgPct;
  if (e.spellDmg) state.itemBonuses.spellDmg = (state.itemBonuses.spellDmg || 0) + e.spellDmg;
  if (e.cdReduc)  state.itemBonuses.cdReduc = (state.itemBonuses.cdReduc || 0) + e.cdReduc;
  if (e.hpPct)  { const bonus=Math.round(state.hpMax*e.hpPct); state.hpMax+=bonus; state.itemBonuses._hpPctBonus=(state.itemBonuses._hpPctBonus||0)+bonus; }
}

function unapplyItemEffect(item) {
  if (!item || !item.effect) return;
  const e = item.effect;
  if (e.atk)      state.itemBonuses.atk      = Math.max(0,(state.itemBonuses.atk||0) - e.atk);
  if (e.armor)  { state.armor = Math.max(0, state.armor - e.armor); state.baseArmor = Math.max(0,(state.baseArmor||0) - e.armor); }
  if (e.maxHp)  { state.hpMax = Math.max(1, state.hpMax - e.maxHp); state.hp = Math.min(state.hp, state.hpMax); }
  if (e.speed)    state.itemBonuses.speed    = (state.itemBonuses.speed||0) - e.speed;
  if (e.range)    state.itemBonuses.range    = (state.itemBonuses.range||0) - e.range;
  if (e.dmgPct)   state.itemBonuses.dmgPct   = (state.itemBonuses.dmgPct||0) - e.dmgPct;
  if (e.spellDmg) state.itemBonuses.spellDmg = (state.itemBonuses.spellDmg||0) - e.spellDmg;
  if (e.cdReduc)  state.itemBonuses.cdReduc  = (state.itemBonuses.cdReduc||0) - e.cdReduc;
  if (e.hpPct && state.itemBonuses._hpPctBonus) {
    state.hpMax -= state.itemBonuses._hpPctBonus;
    state.hp = Math.min(state.hp, state.hpMax);
    state.itemBonuses._hpPctBonus = 0;
  }
}

// ─────────────────────────────────────────
// MARCHAND (taverne gx:13, gy:2)
// ─────────────────────────────────────────
const MERCHANT_STOCK = [
  // Consommables (toujours disponibles)
  { id:'potion_soin',    name:'Potion de soin',    icon:'🧪', desc:'Restaure 120 PV instantanément.',    cost:40,  type:'consumable', effect:'heal_120' },
  { id:'potion_resist',  name:'Elixir de résistance',icon:'🔵',desc:'+20 Armure pendant 30 secondes.',   cost:60,  type:'consumable', effect:'armor_30s' },
  { id:'potion_vit',     name:'Potion de célérité', icon:'💨', desc:'+1.0 vitesse pendant 20 secondes.', cost:50,  type:'consumable', effect:'speed_20s' },
  { id:'potion_ressource',name:'Breuvage de focus',  icon:'💜', desc:'Restaure 50% de votre ressource.',  cost:55,  type:'consumable', effect:'res_50pct' },
  // Équipements (rotation aléatoire au démarrage)
];

let merchantStock = []; // Refresh à chaque visite

// Mapping items recommandés par classe
const CLASS_RECOMMENDED_ITEMS = {
  fracture: ['lame_fracturee', 'tunique_rune', 'cape_voile', 'amulette_soin'], // force physique
  tisseuse: ['dague_venin', 'robe_tisseuse', 'cape_foret', 'pierre_arcane'],   // techniques/poison
  briseur: ['gantelet_briseur', 'cotte_forge', 'manteau_deuil', 'sceau_forge'], // puissance physique
  druide: ['baguette_voile', 'robe_tisseuse', 'cape_foret', 'oeil_veille'],     // magie nature
  mage: ['baguette_voile', 'robe_tisseuse', 'manteau_deuil', 'pierre_arcane'], // magie arcane
  paladin: ['masse_sainte', 'cotte_forge', 'cape_voile', 'amulette_soin'],     // force sacrée
  assassin: ['dague_venin', 'cuir_ombre', 'manteau_deuil', 'oeil_veille'],     // furtivité
};

function generateMerchantStock() {
  merchantStock = [...MERCHANT_STOCK]; // Consommables de base
  
  // Déterminer la classe courante et les items recommandés
  const recommendedList = CLASS_RECOMMENDED_ITEMS[state.selectedClass] || Object.keys(ITEM_TEMPLATES).slice(0, 4);
  
  // Créer un stock hybride: 60% recommandés, 40% aléatoires
  const itemsToAdd = [];
  const numItems = 5;
  
  for (let i = 0; i < numItems; i++) {
    let tId;
    if (i < Math.ceil(numItems * 0.6)) {
      // Items recommandés
      tId = recommendedList[i % recommendedList.length];
    } else {
      // Items aléatoires
      const allTemplates = Object.keys(ITEM_TEMPLATES);
      tId = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    }
    itemsToAdd.push(tId);
  }
  
  // Ajouter à l'inventaire du marchand
  for (const tId of itemsToAdd) {
    const tpl = ITEM_TEMPLATES[tId];
    const rar = Math.random() < 0.4 ? 'uncommon' : Math.random() < 0.12 ? 'rare' : 'common';
    const item = generateItem(tId, rar);
    if (item) {
      merchantStock.push({
        id: `merchant_${tId}_${rar}`,
        name: item.name,
        icon: item.icon,
        desc: `${item.bonus} [${item.rarityLabel}]`,
        cost: item.value,
        type: 'equipment',
        rarity: rar,
        rarityColor: item.rarityColor,
        templateId: tId,
        itemRarity: rar,
        isRecommended: itemsToAdd.indexOf(tId) < Math.ceil(numItems * 0.6), // flag pour affichage
      });
    }
  }
}

// ─────────────────────────────────────────
// MODAL INVENTAIRE / MARCHAND
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// FILTRES INVENTAIRE
// ─────────────────────────────────────────
let _invFilter = 'all';
let _invRarFilter = 'all';

function setInvFilter(f) {
  _invFilter = f;
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  refreshInventoryBag();
}
function setInvRarFilter(f) {
  _invRarFilter = f;
  document.querySelectorAll('[data-rfilter]').forEach(b => b.classList.toggle('active', b.dataset.rfilter === f));
  refreshInventoryBag();
}

function openInventory() {
  if (!state.selectedClass) { addLog('Choisissez une classe!', 'action'); return; }
  if (!state.economy) initEconomy();
  state.showInventory = true;
  const modal = document.getElementById('inventory-modal');
  modal.style.display = 'flex';
  refreshInventoryUI();
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.uiClick();
}

function closeInventory() {
  state.showInventory = false;
  const modal = document.getElementById('inventory-modal');
  if (modal) modal.style.display = 'none';
  const tt = document.getElementById('inv-tooltip');
  if (tt) tt.style.display = 'none';
}

function openMerchant() {
  if (!state.selectedClass) { addLog('Choisissez une classe!', 'action'); return; }
  if (!state.economy) initEconomy();
  generateMerchantStock();
  state.showMerchant = true;
  const modal = document.getElementById('merchant-modal');
  modal.style.display = 'block';
  refreshMerchantUI();
}

function closeMerchant() {
  state.showMerchant = false;
  document.getElementById('merchant-modal').style.display = 'none';
}

// ─────────────────────────────────────────
// RENDU UI INVENTAIRE MMO-RPG
// ─────────────────────────────────────────
function refreshInventoryUI() {
  const modal = document.getElementById('inventory-modal');
  if (!modal || modal.style.display === 'none') return;
  if (!state.economy) return;

  // Or + Compteur
  const goldEl = document.getElementById('inv-gold');
  if (goldEl) goldEl.textContent = state.economy.gold.toLocaleString();
  const counter = document.getElementById('inv-count');
  if (counter) counter.textContent = `${state.economy.inventory.length}/20`;

  // Sprite personnage
  const classEmojis = { fracture:'⚡', tisseuse:'🕸', briseur:'🛡', druide:'🌿', mage:'🔥', paladin:'✨', assassin:'🗡' };
  const charEmoji = document.getElementById('inv-char-emoji');
  if (charEmoji && state.selectedClass) charEmoji.textContent = classEmojis[state.selectedClass] || '⚔';

  // Stats rapides
  const charStats = document.getElementById('inv-char-stats');
  if (charStats && state.selectedClass) {
    const totalAtk = (state.itemBonuses?.atk || 0);
    const totalArm = state.armor;
    const hpPct = Math.round((state.hp / state.hpMax) * 100);
    charStats.innerHTML = `
      <div>⚔ ATK +${totalAtk}</div>
      <div>🛡 ARM ${totalArm}</div>
      <div>❤ ${hpPct}% PV</div>
    `;
  }

  // Slots d'équipement MMO
  const slots = ['weapon','armor','cape','amulet'];
  const slotContentIds = { weapon:'inv-eq-weapon', armor:'inv-eq-armor', cape:'inv-eq-cape', amulet:'inv-eq-amulet' };
  const slotEls = { weapon:'inv-slot-weapon', armor:'inv-slot-armor', cape:'inv-slot-cape', amulet:'inv-slot-amulet' };
  slots.forEach(slot => {
    const item = state.economy.equippedItems[slot];
    const slotEl = document.getElementById(slotEls[slot]);
    const contentEl = document.getElementById(slotContentIds[slot]);
    if (!slotEl || !contentEl) return;
    if (item) {
      slotEl.classList.add('occupied');
      slotEl.querySelector('.inv-eq-slot-icon').textContent = item.icon;
      contentEl.innerHTML = `<div style="color:${item.rarityColor};font-family:'Cinzel',serif;font-size:8px;font-weight:bold;line-height:1.1;">${item.name}</div>`;
    } else {
      slotEl.classList.remove('occupied');
      const icons = { weapon:'⚔', armor:'🛡', cape:'🧣', amulet:'💠' };
      slotEl.querySelector('.inv-eq-slot-icon').textContent = icons[slot];
      contentEl.innerHTML = '';
    }
  });

  refreshInventoryBag();
}

function refreshInventoryBag() {
  const bagContainer = document.getElementById('inv-bag');
  if (!bagContainer || !state.economy) return;

  // Appliquer filtres
  let items = state.economy.inventory;
  if (_invFilter !== 'all') items = items.filter(i => i.slot === _invFilter);
  if (_invRarFilter !== 'all') items = items.filter(i => i.rarity === _invRarFilter);

  if (items.length === 0 && state.economy.inventory.length === 0) {
    bagContainer.innerHTML = `<div style="grid-column:1/-1;color:#3a2010;font-style:italic;text-align:center;padding:24px;font-family:'IM Fell English',serif;font-size:11px;line-height:1.6;">
      Votre sac est vide...<br>
      <span style="font-size:10px;">Combattez des ennemis pour obtenir du loot!</span>
    </div>`;
    return;
  }

  if (items.length === 0) {
    bagContainer.innerHTML = `<div style="grid-column:1/-1;color:#3a2010;font-style:italic;text-align:center;padding:16px;font-family:'IM Fell English',serif;font-size:11px;">Aucun item ne correspond aux filtres.</div>`;
    return;
  }

  // Construire la grille
  bagContainer.innerHTML = items.map(item => {
    const rarColor = { common:'#a0a0a0', uncommon:'#4eff4e', rare:'#4ea8ff', epic:'#c030ff' }[item.rarity] || '#a0a0a0';
    const sellPrice = Math.round(item.value * 0.5);
    return `<div class="inv-grid-item rarity-${item.rarity}"
      onmouseenter="showItemTooltip(event,'${item.id}')"
      onmouseleave="hideItemTooltip()"
      oncontextmenu="event.preventDefault();sellItemRClick('${item.id}')"
    >
      <div class="inv-grid-item-icon">${item.icon}</div>
      <div class="inv-grid-item-name" style="color:${rarColor};">${item.name}</div>
      <div class="inv-grid-item-rarity-bar" style="background:${rarColor};"></div>
      <div class="inv-grid-item-actions">
        <div class="inv-grid-action equip" onclick="equipItemFromGrid('${item.id}')">⚔ Équiper</div>
        <div class="inv-grid-action sell" onclick="sellItem('${item.id}')">🪙 ${sellPrice}g</div>
      </div>
    </div>`;
  }).join('');
}

function equipItemFromGrid(itemId) {
  equipItem(itemId);
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.equip();
}

function sellItemRClick(itemId) {
  sellItem(itemId);
}

function sellAllCommon() {
  if (!state.economy) return;
  const commons = state.economy.inventory.filter(i => i.rarity === 'common');
  if (commons.length === 0) { addLog('Aucun item commun à vendre.', 'normal'); return; }
  let total = 0;
  commons.forEach(item => {
    total += Math.round(item.value * 0.5);
    removeItemFromInventory(item.id);
  });
  addGold(total);
  addLog(`🗑 ${commons.length} items communs vendus pour ${total}g.`, 'action');
  refreshInventoryUI();
}

// ── Tooltip ────────────────────────────────────────────
function showItemTooltip(event, itemId) {
  const item = state.economy?.inventory?.find(i => i.id === itemId);
  if (!item) return;
  const tt = document.getElementById('inv-tooltip');
  if (!tt) return;
  const slotLabels = { weapon:'Arme', armor:'Armure', cape:'Cape', amulet:'Amulette' };
  const rarLabels = { common:'Commun', uncommon:'Inhabituel', rare:'Rare', epic:'Épique' };
  const rarColor = { common:'#a0a0a0', uncommon:'#4eff4e', rare:'#4ea8ff', epic:'#c030ff' }[item.rarity] || '#a0a0a0';
  tt.innerHTML = `
    <div class="tooltip-name" style="color:${rarColor};">${item.icon} ${item.name}</div>
    <div class="tooltip-rarity" style="color:${rarColor};">${rarLabels[item.rarity] || item.rarity}</div>
    <div class="tooltip-slot">${slotLabels[item.slot] || item.slot}</div>
    <div class="tooltip-bonus">${item.bonus}</div>
    <div class="tooltip-value">Valeur: ${item.value}g · Vente: ${Math.round(item.value*0.5)}g</div>
  `;
  tt.style.display = 'block';
  const rect = tt.getBoundingClientRect();
  const x = Math.min(event.clientX + 12, window.innerWidth - rect.width - 10);
  const y = Math.min(event.clientY - 10, window.innerHeight - rect.height - 10);
  tt.style.left = x + 'px';
  tt.style.top  = y + 'px';
}

function hideItemTooltip() {
  const tt = document.getElementById('inv-tooltip');
  if (tt) tt.style.display = 'none';
}

function sellItem(itemId) {
  if (!state.economy) return;
  const item = state.economy.inventory.find(i => i.id === itemId);
  if (!item) return;
  const price = Math.round(item.value * 0.5);
  removeItemFromInventory(itemId);
  addGold(price);
  addLog(`${item.icon} ${item.name} vendu pour ${price}g.`, 'normal');
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.purchase();
  refreshInventoryUI();
}

// ─────────────────────────────────────────
// RENDU UI MARCHAND
// ─────────────────────────────────────────
function refreshMerchantUI() {
  const goldEl = document.getElementById('merchant-gold');
  if (goldEl) goldEl.textContent = (state.economy?.gold ?? 0).toLocaleString();

  const container = document.getElementById('merchant-items');
  if (!container) return;

  // Séparer consommables et équipements
  const consumables = merchantStock.filter(i => i.type === 'consumable');
  const equipment = merchantStock.filter(i => i.type === 'equipment');

  let html = '';
  
  // Section Consommables
  if (consumables.length > 0) {
    html += `<div style="margin-bottom:16px;">
      <div style="font-family:'Cinzel',serif;font-size:12px;color:#c8a96e;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">🧪 Consommables</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">`;
    html += consumables.map(item => {
      const canAfford = (state.economy?.gold ?? 0) >= item.cost;
      return `<div class="merchant-card ${canAfford?'':'cant-afford'}">
        <div class="merchant-card-top">
          <span class="merchant-card-icon">${item.icon}</span>
          <div class="merchant-card-info">
            <div class="merchant-card-name">${item.name}</div>
            <div class="merchant-card-desc">${item.desc}</div>
          </div>
        </div>
        <div class="merchant-card-price">
          <span class="merchant-price-tag">💰 ${item.cost}g</span>
          <button class="merchant-buy-btn" 
            onclick="buyFromMerchant('${item.id}')"
            ${canAfford?'':'disabled'}>
            ${canAfford?'Acheter':'Trop cher'}
          </button>
        </div>
      </div>`;
    }).join('');
    html += `</div></div>`;
  }

  // Section Équipements
  if (equipment.length > 0) {
    html += `<div>
      <div style="font-family:'Cinzel',serif;font-size:12px;color:#c8a96e;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">📦 Équipements ${state.selectedClass ? `(${CLASSES[state.selectedClass].name})` : ''}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">`;
    html += equipment.map(item => {
      const canAfford = (state.economy?.gold ?? 0) >= item.cost;
      const rarColor = item.rarityColor || '#a0a0a0';
      const isRec = item.isRecommended ? ' style="border-top:2px solid #f1c40f;box-shadow:0 0 8px rgba(241,196,15,0.3);"' : '';
      const recBadge = item.isRecommended ? `<div style="position:absolute;top:4px;right:4px;background:#f1c40f;color:#1a1a1a;padding:2px 6px;border-radius:2px;font-size:8px;font-weight:bold;">⭐ CONSEILLÉ</div>` : '';
      return `<div class="merchant-card ${canAfford?'':'cant-afford'}" ${isRec}>
        ${recBadge}
        <div class="merchant-card-top">
          <span class="merchant-card-icon" style="font-size:24px;">${item.icon}</span>
          <div class="merchant-card-info">
            <div class="merchant-card-name" style="color:${rarColor}">${item.name}</div>
            <div class="merchant-card-desc" style="color:${rarColor};font-size:9px;">${item.desc}</div>
          </div>
        </div>
        <div class="merchant-card-price">
          <span class="merchant-price-tag">💰 ${item.cost}g</span>
          <button class="merchant-buy-btn" 
            onclick="buyFromMerchant('${item.id}')"
            ${canAfford?'':'disabled'}>
            ${canAfford?'Acheter':'Trop cher'}
          </button>
        </div>
      </div>`;
    }).join('');
    html += `</div></div>`;
  }

  container.innerHTML = html;
}

function buyFromMerchant(stockId) {
  const stockItem = merchantStock.find(s => s.id === stockId);
  if (!stockItem) return;
  if (!spendGold(stockItem.cost)) {
    addLog('Or insuffisant!', 'action');
    if (typeof AudioEngine !== 'undefined') AudioEngine.play.cooldownFail();
    return;
  }

  if (stockItem.type === 'consumable') {
    applyConsumable(stockItem);
    addLog(`${stockItem.icon} ${stockItem.name} utilisé!`, 'action');
  } else if (stockItem.type === 'equipment') {
    const item = generateItem(stockItem.templateId, stockItem.itemRarity);
    if (item) {
      addItemToInventory(item);
      addLog(`${item.icon} ${item.name} acheté!`, 'action');
    }
  }

  if (typeof AudioEngine !== 'undefined') AudioEngine.play.purchase();
  updateHpUI();
  refreshMerchantUI();
}

function applyConsumable(stockItem) {
  switch(stockItem.effect) {
    case 'heal_120':
      state.hp = Math.min(state.hpMax, state.hp + 120);
      spawnFloater(state.player.gridX, state.player.gridY, '+120 PV', '#4eff4e', 16);
      updateHpUI();
      break;
    case 'armor_30s':
      state.armor += 20;
      if (typeof updateHpUI === 'function') updateHpUI();
      addLog('🔵 +20 Armure pour 30 secondes.', 'action');
      setTimeout(() => {
        state.armor = Math.max(state.baseArmor || 0, state.armor - 20);
        if (typeof updateHpUI === 'function') updateHpUI();
        addLog('Elixir de résistance expiré.', 'normal');
      }, 30000);
      break;
    case 'speed_20s':
      if (state.economy) state.economy._speedPotion = true;
      addLog('💨 +1.0 vitesse pour 20 secondes.', 'action');
      setTimeout(() => {
        if (state.economy) state.economy._speedPotion = false;
        addLog('Potion de célérité expirée.', 'normal');
      }, 20000);
      break;
    case 'res_50pct':
      const restore = Math.round(state.resource.max * 0.5);
      state.resource.val = Math.min(state.resource.max, state.resource.val + restore);
      if (typeof updateResourceUI === 'function') updateResourceUI();
      spawnFloater(state.player.gridX, state.player.gridY, `+${restore} res`, '#c030ff', 14);
      break;
  }
}

// ─────────────────────────────────────────
// INTERACTION TAVERNE (clic sur la case)
// ─────────────────────────────────────────
function checkMerchantInteraction(gx, gy) {
  // Taverne = gx:13, gy:2
  if (gx === 13 && gy === 2) {
    const dist = Math.abs(gx - state.player.gridX) + Math.abs(gy - state.player.gridY);
    if (dist <= 2) {
      openMerchant();
      return true;
    } else {
      addLog('Approchez de la taverne pour commercer! (2 cases)', 'normal');
    }
  }
  return false;
}

// ─────────────────────────────────────────
// BONUS ITEMS — accesseurs pour engine/spell
// ─────────────────────────────────────────
function getItemAtk()      { return state.itemBonuses?.atk      || 0; }
function getItemArmor()    { return state.itemBonuses?.armor     || 0; }
function getItemDmgPct()   { return state.itemBonuses?.dmgPct    || 0; }
function getItemSpellDmg() { return state.itemBonuses?.spellDmg  || 0; }
function getItemSpeed()    { return (state.itemBonuses?.speed    || 0) + (state.economy?._speedPotion ? 1.0 : 0); }
function getItemRange()    { return state.itemBonuses?.range     || 0; }
function getItemCdReduc()  { return state.itemBonuses?.cdReduc   || 0; }

// ─────────────────────────────────────────
// INIT AU DÉMARRAGE
// ─────────────────────────────────────────
function initLootSystem() {
  // Initialiser les bonus items dans state
  if (!state.itemBonuses) {
    state.itemBonuses = { atk:0, armor:0, dmgPct:0, spellDmg:0, speed:0, range:0, cdReduc:0 };
  }
  initEconomy();
}