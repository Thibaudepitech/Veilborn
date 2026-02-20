// ═══════════════════════════════════════════════════════
// ALL SKILLS LIBRARY
// ═══════════════════════════════════════════════════════
const ALL_SKILLS = {
  fracture: [
    { id:'f0', name:'Fracture', desc:'Portée 1 case. –20 armure ennemie 8s. Instabilité +10.', cd:4, range:1, targetType:'enemy', effect:'debuff_armor', value:85, resourceDelta:10, slotHint:0 },
    { id:'f1', name:'Décharge de Voile', desc:'Portée 3 cases (ligne). Dégâts scalent avec Instabilité. Reset Instabilité.', cd:8, range:3, targetType:'cell_line', effect:'line_damage_resource', value:100, resourceDelta:-100, slotHint:1 },
    { id:'f2', name:'Ruée instable', desc:'Dash 3 cases vers la cible. Instabilité >50: traînée ralentissante.', cd:12, range:3, targetType:'cell', effect:'dash', value:0, resourceDelta:0, slotHint:1 },
    { id:'f3', name:'Éclat interne', desc:'Zone 2 cases. Explose Instabilité pour soigner (1 PV / Instabilité). –50 Instabilité.', cd:15, range:2, targetType:'cell', effect:'zone_explode_heal', value:60, resourceDelta:-50, slotHint:1 },
    { id:'f4', name:'Ancrage de Voile', desc:'Zone autour du joueur 3 cases. Ralentit ennemis 5s. +5 Instabilité.', cd:20, range:3, targetType:'zone_self', effect:'taunt_zone', value:0, resourceDelta:5, slotHint:1 },
    { id:'f5', name:'Fracture double', desc:'Portée 1 case. Deux frappes. La 2e amplifiée ×1.5 si cible fracturée (déjà debuffée).', cd:5, range:1, targetType:'enemy', effect:'double_strike', value:70, resourceDelta:15, slotHint:0 },
    { id:'f6', name:'Résonance', desc:'Zone 3 cases. +15% dégâts alliés 10s. Génère +5 Instabilité.', cd:18, range:3, targetType:'zone_self', effect:'buff_ally', value:15, resourceDelta:5, slotHint:1 },
    { id:'f7', name:'Implosion', desc:'Zone 2 cases. Dégâts + attraction ennemis vers le centre. –50 Instabilité.', cd:16, range:2, targetType:'cell', effect:'zone_pull', value:80, resourceDelta:-50, slotHint:1 },
    { id:'f8', name:'Peau de Voile', desc:'Absorbe les 3 prochaines attaques. 50% dégâts absorbés → Instabilité.', cd:25, range:0, targetType:'self', effect:'shield_absorb', value:3, resourceDelta:0, slotHint:2 },
    { id:'f9', name:'Fracture totale', desc:'ULTIMATE — 100 Instabilité requis. Zone 3 cases. Dégâts massifs + stun 2s.', cd:40, range:3, targetType:'cell', effect:'zone_ultimate', value:220, resourceDelta:-100, slotHint:2 },
  ],
  tisseuse: [
    { id:'t0', name:'Fil tranchant', desc:'Portée 6 cases. Dégâts. Génère 1 Fil.', cd:5, range:6, targetType:'enemy', effect:'damage', value:45, resourceDelta:1, slotHint:0 },
    { id:'t1', name:'Lien vital', desc:'Portée 5 cases. Lie un ennemi: 30% de ses dégâts vous soignent 8s. Coût: 1 Fil.', cd:10, range:5, targetType:'enemy', effect:'link_vital', value:30, resourceDelta:-1, slotHint:1 },
    { id:'t2', name:'Nœud de repos', desc:'Zone 3 cases. Régénère 15 PV/s pendant 5s. Coût: 1 Fil.', cd:20, range:3, targetType:'zone_self', effect:'regen_anchor', value:20, resourceDelta:-1, slotHint:1 },
    { id:'t3', name:'Coupure nette', desc:'Coupe tous les fils actifs. Chaque fil coupé → zone 2 cases de dégâts.', cd:12, range:0, targetType:'self', effect:'cut_webs', value:55, resourceDelta:0, slotHint:1 },
    { id:'t4', name:'Résonance tissée', desc:'Si 2+ Fils actifs: +20% dégâts 8s. (Consomme 0 Fil)', cd:18, range:0, targetType:'self', effect:'buff_damage', value:20, resourceDelta:0, slotHint:1 },
    { id:'t5', name:'Toile immobilisante', desc:'Zone 3×3 depuis la cible. Ralentit 60% ennemis 5s. Coût: 2 Fils.', cd:10, range:5, targetType:'cell', effect:'zone_slow', value:0, resourceDelta:-2, slotHint:0 },
    { id:'t6', name:'Transfer', desc:'Portée 5 cases. Transfère un debuff de la cible vers un autre ennemi adjacent.', cd:15, range:5, targetType:'enemy', effect:'transfer_effect', value:0, resourceDelta:0, slotHint:1 },
    { id:'t7', name:'Ancre spectrale', desc:'Portée 5 cases. Rend un ennemi incapable de mourir pendant 4s. Coût: 2 Fils.', cd:30, range:5, targetType:'enemy', effect:'prevent_death', value:4, resourceDelta:-2, slotHint:2 },
    { id:'t8', name:'Miroir de lien', desc:'Duplique l\'effet du prochain skill (appliqué automatiquement sur la cible liée la plus proche).', cd:25, range:0, targetType:'self', effect:'mirror_skill', value:50, resourceDelta:0, slotHint:2 },
    { id:'t9', name:'Grande Toile', desc:'ULTIMATE — Relie tous ennemis. Zone entière: chaque attaque ennemi vous soigne 6s. –5 Fils max.', cd:45, range:0, targetType:'self', effect:'grande_toile', value:60, resourceDelta:0, slotHint:2 },
  ],
  briseur: [
    { id:'b0', name:'Frappe marteau', desc:'Portée 1 case. Stagger. Endurance +5.', cd:3, range:1, targetType:'enemy', effect:'damage', value:140, resourceDelta:5, slotHint:0 },
    { id:'b1', name:'Mur de chair', desc:'Posture défensive 6s: –50% dégâts reçus, Endurance ×2/s. Vous immobilise.', cd:20, range:0, targetType:'self', effect:'defensive_stance', value:50, resourceDelta:10, slotHint:1 },
    { id:'b2', name:'Charge brisante', desc:'Ligne 4 cases. Dégâts + recul 2 cases. Scalent avec Endurance. –25 End.', cd:15, range:4, targetType:'cell_dir', effect:'charge_knockback', value:90, resourceDelta:-25, slotHint:1 },
    { id:'b3', name:'Provocation', desc:'Zone 3 cases. Ralentit ennemis + attire leur aggro 5s.', cd:18, range:3, targetType:'zone_self', effect:'taunt_zone', value:0, resourceDelta:0, slotHint:1 },
    { id:'b4', name:'Coup de bouclier', desc:'Portée 2 cases. Étourdissement 1.5s. Req. 25 Endurance. –5 End.', cd:8, range:2, targetType:'enemy', effect:'stun_strike', value:80, resourceDelta:-5, slotHint:0 },
    { id:'b5', name:'Ancrage au sol', desc:'4s: Immunisé knockbacks/stuns. Endurance ×2/s. Vous immobilise.', cd:25, range:0, targetType:'self', effect:'root_self_buff', value:0, resourceDelta:20, slotHint:1 },
    { id:'b6', name:'Fracas de terre', desc:'Zone 4 cases autour de vous. Dégâts + déstabilise. Req. 50 Endurance.', cd:15, range:4, targetType:'zone_self', effect:'zone_damage', value:120, resourceDelta:-20, slotHint:1 },
    { id:'b7', name:'Absorption', desc:'Zone 2 cases. Convertit 30 Endurance → bouclier de dégâts 3s.', cd:20, range:2, targetType:'zone_self', effect:'zone_shield', value:30, resourceDelta:-30, slotHint:2 },
    { id:'b8', name:'Rage forgée', desc:'+40% attaque et vitesse 8s. Req. 75 Endurance. –50 End.', cd:30, range:0, targetType:'self', effect:'rage_buff', value:40, resourceDelta:-50, slotHint:2 },
    { id:'b9', name:'Nova de rupture', desc:'ULTIMATE — 100 Endurance. Zone 5 cases. Knockback 3 cases + stun 3s.', cd:0, range:5, targetType:'zone_self', effect:'nova_rupture', value:250, resourceDelta:-100, slotHint:2 },
  ],
  druide: [
    { id:'d0', name:'Fleur de soin', desc:'Portée 4 cases. Soigne un allié ou vous-même. Coût: 20 Énergie.', cd:6, range:4, targetType:'any', effect:'heal', value:80, resourceDelta:-20, slotHint:0 },
    { id:'d1', name:'Racines entravantes', desc:'Zone 3×3. Immobilise ennemis 3s. Coût: 25 Énergie.', cd:14, range:5, targetType:'cell', effect:'zone_root', value:0, resourceDelta:-25, slotHint:0 },
    { id:'d2', name:'Totem de régénération', desc:'Dépose un totem sur votre case. Soigne +15 PV/s à vous et alliés rayon 3 cases, 10s. Coût: 30 Énergie.', cd:20, range:0, targetType:'self', effect:'place_totem', value:15, resourceDelta:-30, slotHint:1 },
    { id:'d3', name:'Forme animale', desc:'8s: vitesse ×1.5, portée 1, dégâts ×1.5, soin contact. Coût: 35 Énergie.', cd:30, range:0, targetType:'self', effect:'animal_form', value:50, resourceDelta:-35, slotHint:2 },
    { id:'d4', name:'Spores vénéneuses', desc:'Zone 2 cases. Poison: –12 PV/s pendant 5s. Coût: 20 Énergie.', cd:12, range:5, targetType:'cell', effect:'zone_poison', value:12, resourceDelta:-20, slotHint:1 },
    { id:'d5', name:'Symbiose', desc:'Portée 5 cases. 12s: 50% des soins reçus soignent aussi la cible liée. Coût: 25 Énergie.', cd:25, range:5, targetType:'any', effect:'symbiosis', value:50, resourceDelta:-25, slotHint:1 },
    { id:'d6', name:'Appel de la meute', desc:'Invoque 2 loups spectraux pendant 12s. Ils attaquent vos ennemis. Coût: 35 Énergie.', cd:35, range:0, targetType:'self', effect:'summon_wolves', value:2, resourceDelta:-35, slotHint:2 },
    { id:'d7', name:'Régénération de masse', desc:'Zone 4 cases depuis la cible. Régénère +50 PV sur 5s à tous les alliés. Coût: 30 Énergie.', cd:25, range:5, targetType:'cell', effect:'mass_regen', value:50, resourceDelta:-30, slotHint:1 },
    { id:'d8', name:'Métamorphose défensive', desc:'Zone 3 cases autour de vous. –25% dégâts reçus alliés 6s. Coût: 30 Énergie.', cd:28, range:3, targetType:'zone_self', effect:'buff_resistance', value:25, resourceDelta:-30, slotHint:2 },
    { id:'d9', name:'Tempête naturelle', desc:'ULTIMATE — Zone 5 cases depuis cible. Foudre + racines + soin simultanés. Coût: 40 Énergie.', cd:40, range:5, targetType:'cell', effect:'zone_storm', value:70, resourceDelta:-40, slotHint:2 },
  ],
  mage: [
    { id:'m0', name:'Boule de feu', desc:'Portée 6 cases. Explosion zone 2 cases. +15 Chaleur.', cd:4, range:6, targetType:'cell', effect:'fireball', value:160, resourceDelta:15, slotHint:0 },
    { id:'m1', name:'Jet de flammes', desc:'Cône 4 cases. Dégâts 2s. +20 Chaleur.', cd:8, range:4, targetType:'cell_cone', effect:'flamethrower', value:40, resourceDelta:20, slotHint:0 },
    { id:'m2', name:'Mur de feu', desc:'Ligne 3 cases. Dégâts traversée 6s. +20 Chaleur.', cd:14, range:4, targetType:'cell', effect:'firewall', value:50, resourceDelta:20, slotHint:1 },
    { id:'m3', name:'Nova glaciale', desc:'Zone 3 cases. Ralentit 60% + réduit Chaleur de 30.', cd:16, range:5, targetType:'cell', effect:'ice_nova', value:0, resourceDelta:-30, slotHint:1 },
    { id:'m4', name:'Fissure ardente', desc:'Ligne 5 cases. Sol en feu 5s. +15 Chaleur.', cd:12, range:5, targetType:'cell_line', effect:'fire_fissure', value:25, resourceDelta:15, slotHint:1 },
    { id:'m5', name:'Météore', desc:'Portée 7 cases. Zone 2×2. Impact après 2s. +25 Chaleur.', cd:20, range:7, targetType:'cell', effect:'meteor', value:280, resourceDelta:25, slotHint:2 },
    { id:'m6', name:'Bouclier igné', desc:'Absorbe 2 attaques. Chaque attaque absorbée → +15 Chaleur.', cd:18, range:0, targetType:'self', effect:'fire_shield', value:2, resourceDelta:0, slotHint:1 },
    { id:'m7', name:'Combustion instantanée', desc:'Portée 5 cases. Ignore 30% résistance magique. +20 Chaleur.', cd:10, range:5, targetType:'enemy', effect:'ignite', value:120, resourceDelta:20, slotHint:0 },
    { id:'m8', name:'Vague de chaleur', desc:'Zone 4 cases. Recul 2 cases + sol en feu 4s. +20 Chaleur.', cd:18, range:4, targetType:'zone_self', effect:'heat_wave', value:60, resourceDelta:20, slotHint:1 },
    { id:'m9', name:'Fusion totale', desc:'ULTIMATE — Surchauffe forcée. ×2 dégâts 8s. Chaleur à 0 après.', cd:45, range:0, targetType:'self', effect:'fusion', value:100, resourceDelta:100, slotHint:2 },
  ],
  paladin: [
    { id:'p0', name:'Frappe sacrée', desc:'Portée 1 case. Si Foi >50: dégâts zone +1 case. +5 Foi.', cd:3, range:1, targetType:'enemy', effect:'holy_strike', value:110, resourceDelta:5, slotHint:0 },
    { id:'p1', name:'Bouclier divin', desc:'Portée 3 cases. Bouclier sur allié absorbant 3 coups 8s. –20 Foi.', cd:12, range:3, targetType:'cell', effect:'divine_shield', value:3, resourceDelta:-20, slotHint:1 },
    { id:'p2', name:'Consécration', desc:'Zone 3 cases. Cases sacrées: soin alliés + brûlure ennemis 6s. –25 Foi.', cd:18, range:3, targetType:'zone_self', effect:'consecration', value:40, resourceDelta:-25, slotHint:1 },
    { id:'p3', name:'Main de justice', desc:'Portée 2 cases. Coup puissant + stun 1.5s. –30 Foi.', cd:15, range:2, targetType:'enemy', effect:'stun_strike', value:160, resourceDelta:-30, slotHint:0 },
    { id:'p4', name:'Aura de protection', desc:'Actif 10s: –15% dégâts alliés rayon 3 cases. –25 Foi.', cd:22, range:3, targetType:'zone_self', effect:'aura_protection', value:15, resourceDelta:-25, slotHint:1 },
    { id:'p5', name:'Jugement', desc:'Portée 5 cases. –20% résistance cible 8s. Dégâts bonus. –15 Foi.', cd:10, range:5, targetType:'enemy', effect:'judgment', value:80, resourceDelta:-15, slotHint:0 },
    { id:'p6', name:'Résurrection rapide', desc:'Portée 3 cases. Ressuscite allié tombé à 30% PV. –50 Foi. CD: 60s.', cd:60, range:3, targetType:'cell', effect:'resurrect', value:30, resourceDelta:-50, slotHint:2 },
    { id:'p7', name:'Bastion de lumière', desc:'Zone 3×3. Bloque ennemis à l\'extérieur 5s. –35 Foi.', cd:25, range:3, targetType:'cell', effect:'light_bastion', value:5, resourceDelta:-35, slotHint:2 },
    { id:'p8', name:'Martyr', desc:'Portée 3 cases. Vous absorbez 50% dégâts d\'un allié 6s. Génère Foi ×2.', cd:30, range:3, targetType:'any', effect:'martyr', value:50, resourceDelta:0, slotHint:2 },
    { id:'p9', name:'Croisade divine', desc:'ULTIMATE — Grâce divine 8s + résistance +30% alliés rayon 5 cases. –80 Foi.', cd:45, range:5, targetType:'zone_self', effect:'crusade', value:30, resourceDelta:-80, slotHint:2 },
  ],
  assassin: [
    { id:'a0', name:'Estoc rapide', desc:'Portée 1 case. Frappe vive. +1 Combo. CD court.', cd:2, range:1, targetType:'enemy', effect:'damage', value:100, resourceDelta:1, slotHint:0 },
    { id:'a1', name:'Pas de l\'ombre', desc:'Téléportation 3 cases (ignore obstacles). +1 Combo.', cd:10, range:3, targetType:'cell', effect:'teleport', value:0, resourceDelta:1, slotHint:1 },
    { id:'a2', name:'Lame empoisonnée', desc:'Portée 1 case. Poison –15 PV/s pendant 5s. +1 Combo/tick.', cd:8, range:1, targetType:'enemy', effect:'poison', value:15, resourceDelta:1, slotHint:0 },
    { id:'a3', name:'Éviscération', desc:'FINITION — Portée 1 case. Consomme tout le Combo: dégâts ×(Combo×35%).', cd:10, range:1, targetType:'enemy', effect:'eviscerate', value:150, resourceDelta:-5, slotHint:2 },
    { id:'a4', name:'Éclipse', desc:'3s: Invisible, invulnérable, +3 Combo. Prochain skill: ×2 dégâts. CD reset à 0.', cd:20, range:0, targetType:'self', effect:'eclipse', value:3, resourceDelta:3, slotHint:2 },
    { id:'a5', name:'Double frappe', desc:'Portée 1 case. Deux frappes simultanées. +2 Combo.', cd:6, range:1, targetType:'enemy', effect:'double_strike', value:80, resourceDelta:2, slotHint:0 },
    { id:'a6', name:'Traîne de lames', desc:'Dash 2 cases. Dégâts sur cases traversées. +1 Combo.', cd:10, range:2, targetType:'cell_dir', effect:'blade_dash', value:60, resourceDelta:1, slotHint:1 },
    { id:'a7', name:'Marque de mort', desc:'Portée 3 cases. Marque ennemi 8s: +1 Combo par attaque sur cet ennemi.', cd:15, range:3, targetType:'enemy', effect:'death_mark', value:0, resourceDelta:0, slotHint:1 },
    { id:'a8', name:'Nuée de dagues', desc:'Zone 2 cases. 5 dagues. +1 Combo par touche (max +5).', cd:14, range:2, targetType:'cell', effect:'dagger_fan', value:40, resourceDelta:3, slotHint:1 },
    { id:'a9', name:'Exécution', desc:'ULTIMATE — Req. 5 Combo. Téléport + frappe dévastatrice ×5. –5 Combo.', cd:0, range:3, targetType:'enemy', effect:'execution', value:350, resourceDelta:-5, slotHint:2 },
  ],
};

// ═══════════════════════════════════════════════════════
// CLASS DEFINITIONS
// ═══════════════════════════════════════════════════════
const CLASSES = {
  fracture: {
    id:'fracture', name:'Le Fracturé', role:'Damage dealer / Disrupteur',
    color:'#9b4dca', speed:3.5, range:1,
    hp:420, hpMax:420, armor:12,
    resource:{name:'Instabilité',val:0,max:100,regen:0,thresholds:[50,80,100]},
    defaultSkills:['f0','f2','f9'],
    lore:'Déchiré par le Voile, il pulse d\'une énergie instable.',
    resourceBehavior:(s)=>{
      if(s.resource.val>=100) return'⚡ MAX — Fracture totale!';
      if(s.resource.val>80) return'⚠ INSTABLE — Perte de vie!';
      return'';
    }
  },
  tisseuse: {
    id:'tisseuse', name:'La Tisseuse', role:'Support / Contrôle de zone',
    color:'#4ecdc4', speed:3.0, range:4,
    hp:320, hpMax:320, armor:8,
    resource:{name:'Fils actifs',val:0,max:5,regen:0,thresholds:[2,4]},
    defaultSkills:['t0','t5','t9'],
    lore:'Elle tisse la réalité comme d\'autres tissent la soie.',
    resourceBehavior:(s)=>s.resource.val>=5?'🕸 5 FILS — Toile maximale!':''
  },
  briseur: {
    id:'briseur', name:'Le Briseur', role:'Tank / Initiateur',
    color:'#e74c3c', speed:2.5, range:2,
    hp:680, hpMax:680, armor:35,
    resource:{name:'Endurance forgée',val:0,max:100,regen:0,thresholds:[25,50,75,100]},
    defaultSkills:['b0','b2','b9'],
    lore:'Forgé dans les guerres de Fracture, son corps est une arme.',
    resourceBehavior:(s)=>{
      if(s.resource.val>=100) return'💥 ENDURANCE MAX — Nova!';
      if(s.resource.val>=75) return'🔥 Rage forgée disponible!';
      return'';
    }
  },
  druide: {
    id:'druide', name:'Le Druide', role:'Soigneur / Contrôleur terrain',
    color:'#27ae60', speed:3.0, range:3,
    hp:380, hpMax:380, armor:15,
    resource:{name:'Énergie naturelle',val:70,max:100,regen:2,thresholds:[]},
    defaultSkills:['d0','d6','d9'],
    lore:'La nature répond à ses appels.',
    resourceBehavior:(s)=>s.resource.val>=90?'🌿 Énergie pleine!':''
  },
  mage: {
    id:'mage', name:'Le Mage de Feu', role:'Burst damage / Zone',
    color:'#e67e22', speed:3.2, range:5,
    hp:290, hpMax:290, armor:6,
    resource:{name:'Chaleur',val:0,max:100,regen:-1,thresholds:[80,100]},
    defaultSkills:['m0','m2','m9'],
    lore:'Chaque sort consumme son âme un peu plus.',
    resourceBehavior:(s)=>{
      if(s.resource.val>=100) return'🔥 SURCHAUFFE +50% dégâts!';
      if(s.resource.val>=80) return'🌡 Surchauffe imminente +25%!';
      return'';
    }
  },
  paladin: {
    id:'paladin', name:'Le Paladin', role:'Tank-support / Protecteur',
    color:'#f1c40f', speed:2.8, range:2,
    hp:560, hpMax:560, armor:30,
    resource:{name:'Foi',val:30,max:100,regen:-0.5,thresholds:[50,100]},
    defaultSkills:['p0','p2','p9'],
    lore:'Sa foi est son bouclier, sa lumière son épée.',
    resourceBehavior:(s)=>s.resource.val>=100?'✨ GRÂCE DIVINE — Skills gratuits!':''
  },
  assassin: {
    id:'assassin', name:"L'Assassin", role:'Burst damage / Mobilité',
    color:'#8e44ad', speed:4.0, range:1,
    hp:310, hpMax:310, armor:8,
    resource:{name:'Points de Combo',val:0,max:5,regen:0,thresholds:[3,5]},
    defaultSkills:['a0','a1','a9'],
    lore:'L\'ombre est son alliée.',
    resourceBehavior:(s)=>s.resource.val>=5?'💀 5 COMBO — Exécution!':''
  },
};

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const GRID_SIZE = 16;
const CELL_W = 68;
const CELL_H = 34;

// ═══════════════════════════════════════════════════════
// DECORATIONS
// ═══════════════════════════════════════════════════════
const DECORATIONS = [
  // Border trees (dense forest feel)
  { type:'tree', gx:0, gy:0 }, { type:'tree', gx:15, gy:0 }, { type:'tree', gx:0, gy:15 },
  { type:'tree', gx:1, gy:1 }, { type:'tree', gx:14, gy:1 }, { type:'tree', gx:15, gy:15 },
  { type:'tree', gx:0, gy:7 }, { type:'tree', gx:15, gy:7 }, { type:'tree', gx:0, gy:3 },
  { type:'tree', gx:15, gy:3 }, { type:'tree', gx:0, gy:12 }, { type:'tree', gx:15, gy:12 },
  // Bushes along edges
  { type:'bush', gx:0, gy:5 }, { type:'bush', gx:15, gy:5 }, { type:'bush', gx:0, gy:10 },
  { type:'bush', gx:15, gy:10 }, { type:'bush', gx:4, gy:0 }, { type:'bush', gx:11, gy:0 },
  { type:'bush', gx:4, gy:15 }, { type:'bush', gx:11, gy:15 }, { type:'bush', gx:7, gy:0 },
  { type:'bush', gx:8, gy:15 },
  // Medieval house cluster (top-left area)
  { type:'house', gx:2, gy:2 }, { type:'house_small', gx:3, gy:3 },
  // Chapel / shrine (center-left)
  { type:'chapel', gx:1, gy:8 },
  // Tavern / inn (right side)
  { type:'tavern', gx:13, gy:2 },
  // Market stall (center area)
  { type:'market', gx:8, gy:3 },
  // Well (center)
  { type:'well', gx:7, gy:7 },
  // Barricades (defensive zone)
  { type:'barricade', gx:5, gy:5 }, { type:'barricade', gx:8, gy:9 }, { type:'barricade', gx:12, gy:7 },
  // Ruins
  { type:'ruin', gx:13, gy:4 }, { type:'ruin', gx:14, gy:4 }, { type:'ruin', gx:14, gy:5 },
  { type:'ruin_small', gx:6, gy:5 }, { type:'ruin_small', gx:10, gy:10 }, { type:'ruin_small', gx:11, gy:10 },
  // Torches (lighting up the map)
  { type:'torch', gx:6, gy:4 }, { type:'torch', gx:10, gy:4 },
  { type:'torch', gx:6, gy:11 }, { type:'torch', gx:10, gy:11 }, { type:'torch', gx:8, gy:0 },
  { type:'torch', gx:3, gy:6 }, { type:'torch', gx:12, gy:6 },
  // Graves
  { type:'grave', gx:3, gy:9 }, { type:'grave', gx:14, gy:12 }, { type:'grave', gx:1, gy:6 },
  { type:'grave', gx:4, gy:13 }, { type:'grave', gx:5, gy:14 },
  // Bones
  { type:'bones', gx:4, gy:7 }, { type:'bones', gx:12, gy:8 },
  { type:'bones', gx:7, gy:13 }, { type:'bones', gx:2, gy:11 }, { type:'bones', gx:9, gy:3 },
  // Pillars (arcane markers)
  { type:'pillar', gx:5, gy:5 }, { type:'pillar', gx:8, gy:9 }, { type:'pillar', gx:12, gy:7 },
  // Haystacks & barrels
  { type:'barrel', gx:9, gy:5 }, { type:'barrel', gx:10, gy:6 },
  { type:'haystack', gx:2, gy:5 }, { type:'haystack', gx:13, gy:11 },
  // Fence sections
  { type:'fence', gx:6, gy:2 }, { type:'fence', gx:7, gy:2 }, { type:'fence', gx:8, gy:2 },
];

function generateTerrain() {
  const t = {};
  // Blocked cells — replaced by rock walls, ruins, houses in decoration layer
  // These match where house/ruin/chapel decorations sit
  [[2,2],[2,3],[3,2],[3,3]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // house cluster
  [[1,8]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // chapel
  [[13,2]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // tavern
  [[6,5],[7,5]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // barricades
  [[10,10],[10,11],[11,10]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // ruins
  [[13,4],[14,4],[14,5]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // ruins right
  [[9,8]].forEach(([x,y])=>{ t[`${x},${y}`]='blocked'; }); // pillar
  // Veil (arcane-charged) cells
  [[5,5],[5,6],[8,9],[8,10],[12,7]].forEach(([x,y])=>{ t[`${x},${y}`]='veil'; });
  // Ground variation zones (sandy paths)
  [[7,6],[7,7],[7,8],[8,6],[8,7],[8,8],[6,7],[9,7]].forEach(([x,y])=>{ t[`${x},${y}`]='path'; });
  return t;
}