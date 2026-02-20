// ═══════════════════════════════════════════════════════
// SPELL EXECUTION — ALL SPELLS FULLY IMPLEMENTED
// ═══════════════════════════════════════════════════════

// Wrapper universel : fonctionne sur un ennemi PvE OU un joueur hostile distant
function applyDamageToTarget(target, dmg) {
  if (!target) return;
  if (target._isRemotePlayer) {
    // PvP — envoyer via WS
    if (window.multiState?.active) {
      wsSend('pvp_attack', {
        targetSessionId: target.sessionId,
        dmg: dmg,
      });
    }
    spawnFloater(target.gridX, target.gridY, `⚔−${dmg}`, '#ff4444', 16);
    addLog(`⚔ ${target.name}: −${dmg} PV (PvP)`, 'damage');
  } else {
    applyDamageToEnemy(target, dmg);
  }
}

function executeSkill(slotIdx, targetGx, targetGy, targetEnemy) {
  if (typeof AudioEngine !== 'undefined') AudioEngine.play.castSpell();
  if (!state.selectedClass) return;
  const skill = getSkillBySlot(slotIdx);
  if (!skill) { cancelTargeting(); return; }

  const cdKey = skill.id;
  const cls = CLASSES[state.selectedClass];
  const px = state.player.gridX, py = state.player.gridY;
  const dist = Math.abs(targetGx-px)+Math.abs(targetGy-py);

  // Range check
  const skipRange = ['self','zone_self','zone_all'].includes(skill.targetType);
  if (!skipRange && skill.range>0 && dist>skill.range) {
    addLog(`Hors de portée! (${dist} cases, portée: ${skill.range})`,'normal');
    cancelTargeting(); return;
  }

  // Resource cost check (negative delta = costs resource)
  const resVal = state.resource.val;
  if (skill.resourceDelta < 0 && resVal < Math.abs(skill.resourceDelta)) {
    addLog(`${skill.name} — Ressource insuffisante! (${resVal}/${Math.abs(skill.resourceDelta)} requis)`,'normal');
    cancelTargeting(); return;
  }

  // Cooldown check
  if (state.cooldowns[cdKey] > 0) {
    addLog(`${skill.name} en recharge! (${state.cooldowns[cdKey].toFixed(1)}s)`,'normal');
    cancelTargeting(); return;
  }

  // Compute damage multiplier
  let dmgMult = state.buffs.damage_mult;
  if (state.buffs.fusionActive) dmgMult *= 2;
  if (state.buffs.raged) dmgMult *= 1.4;
  if (state.buffs.eclipseNextSkillDouble) { dmgMult *= 2; state.buffs.eclipseNextSkillDouble = false; }
  if (state.selectedClass==='mage' && resVal>=80) dmgMult *= (resVal>=100?1.5:1.25);
  if (state.terrain[`${px},${py}`]==='veil') dmgMult *= 1.2;
  if (state.buffs.animalForm) dmgMult *= 1.5;

  const effect = skill.effect;
  const baseVal = skill.value;

  switch(effect) {

    // ─────────────────────────────────
    // BASIC DAMAGE
    // ─────────────────────────────────
    case 'damage': {
      const en = targetEnemy || findEnemyAt(targetGx, targetGy);
      if (!en) { addLog('Aucun ennemi sur cette case.','normal'); cancelTargeting(); return; }
      const dmg = calcDamage(baseVal*dmgMult, en.armor);
      applyDamageToTarget(en, dmg);
      addLog(`${skill.name} → ${en.name}: −${dmg} PV`,'damage');
      spawnFloater(en.gridX, en.gridY, `-${dmg}`, cls.color, 18);
      if (en.debuffs.death_mark) regenResource(1);
      break;
    }

    // ─────────────────────────────────
    // FRACTURÉ
    // ─────────────────────────────────
    case 'debuff_armor': {
      const en = targetEnemy || findEnemyAt(targetGx, targetGy);
      if (!en) { addLog('Aucun ennemi.','normal'); cancelTargeting(); return; }
      const dmg = calcDamage(baseVal*dmgMult, en.armor);
      applyDamageToTarget(en, dmg);
      const pen = 20;
      en.armor = Math.max(0, en.armor-pen);
      en.debuffs.fracture = true;
      addLog(`Fracture → ${en.name}: −${dmg} PV + Armure −${pen}`,'damage');
      spawnFloater(en.gridX, en.gridY, `-${dmg}`, cls.color, 18);
      spawnFloater(en.gridX, en.gridY, `🛡−${pen}`, '#9b4dca', 12);
      setTimeout(()=>{ if(en.alive){ en.armor+=pen; en.debuffs.fracture=false; } }, 8000);
      break;
    }

    case 'line_damage_resource': {
      const lineCells = getLineCells(px,py,targetGx,targetGy,skill.range);
      const mult = Math.max(0.5, resVal/100)*dmgMult;
      let hitCount = 0;
      lineCells.forEach(c=>{
        const en=findEnemyAt(c.x,c.y); if(!en) return;
        const dmg=calcDamage(baseVal*mult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,cls.color,16);
        hitCount++;
      });
      addLog(`Décharge de Voile: ligne, ${hitCount} ennemi(s), Instabilité reset`,'damage');
      state.resource.val = 0; // resourceDelta:-100 handled below, but set to 0 directly
      state.highlight={type:'telegraph',cells:lineCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},800);
      updateResourceUI(); cancelTargeting(); return; // skip normal resourceDelta
    }

    case 'zone_explode_heal': {
      // Heal based on Instabilité consumed
      const instab = Math.min(resVal, 50);
      const heal = Math.round(instab * 1.5);
      state.hp = Math.min(state.hpMax, state.hp+heal);
      // Also damage enemies in zone
      const zoneCells = getCellsInRange(targetGx,targetGy,2);
      const hits = state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        const dmg=calcDamage(baseVal*dmgMult*0.5,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,'#9b4dca',13);
      });
      updateHpUI();
      addLog(`Éclat interne — Soin +${heal} PV, ${hits.length} ennemi(s) touchés`,'heal');
      spawnFloater(px,py,`+${heal}`,'#9b4dca',16);
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},800);
      break;
    }

    case 'zone_pull': {
      const zoneCells = getCellsInRange(targetGx,targetGy,2);
      const hits = state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        const dmg=calcDamage(baseVal*dmgMult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,'#9b4dca',16);
        // Pull toward center
        const dx=Math.sign(targetGx-en.gridX), dy=Math.sign(targetGy-en.gridY);
        for(let i=0;i<2;i++){
          const nx=en.gridX+dx, ny=en.gridY+dy;
          if(nx>=0&&ny>=0&&nx<GRID_SIZE&&ny<GRID_SIZE&&state.terrain[`${nx},${ny}`]!=='blocked'&&!findEnemyAt(nx,ny)){
            en.gridX=nx; en.gridY=ny;
          }
        }
      });
      addLog(`Implosion — ${hits.length} ennemi(s) attirés et blessés`,'damage');
      break;
    }

    case 'buff_ally': {
      // Zone buff around player
      state.buffs.damage_mult = 1 + baseVal/100;
      addLog(`Résonance — +${baseVal}% dégâts 10s!`,'action');
      spawnFloater(px,py,`+${baseVal}% DMG`,cls.color,14);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.damage_mult=1; updateBuffDisplay(); addLog('Résonance expirée.','normal'); },10000);
      break;
    }

    case 'shield_absorb': {
      state.buffs.shieldCharges = baseVal; // 3 charges
      state.buffs.shieldType = 'peau_voile';
      const shieldEl = document.getElementById('shield-display');
      const shieldVal = document.getElementById('shield-val');
      if(shieldEl) shieldEl.style.display = 'block';
      if(shieldVal) shieldVal.textContent = `${state.buffs.shieldCharges} charges`;
      addLog(`Peau de Voile — ${baseVal} prochaines attaques absorbées!`,'action');
      spawnFloater(px,py,'🛡 VOILE','#9b4dca',14);
      updateBuffDisplay();
      break;
    }

    // ─────────────────────────────────
    // TISSEUSE
    // ─────────────────────────────────
    case 'link_vital': {
      const en = targetEnemy || findEnemyAt(targetGx,targetGy);
      if (!en) { addLog('Aucun ennemi.','normal'); cancelTargeting(); return; }
      state.buffs.linkedEnemy = en;
      state.buffs.linkedEnemyEnd = Date.now() + 8000;
      addLog(`Lien vital → ${en.name}: 30% de ses dégâts vous soignent 8s!`,'action');
      spawnFloater(en.gridX,en.gridY,'🕸 LIÉ','#4ecdc4',12);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.linkedEnemy=null; addLog('Lien vital expiré.','normal'); }, 8000);
      break;
    }

    case 'regen_anchor': {
      const zoneCells = getCellsInRange(px,py,3);
      addLog('Nœud de repos — Régénération +15 PV/s (5s)','heal');
      spawnFloater(px,py,'+15/s','#4ecdc4',13);
      state.highlight={type:'heal',cells:zoneCells};
      let ticks=0;
      const regInt = setInterval(()=>{
        if(++ticks>10||!state.selectedClass){ clearInterval(regInt); state.highlight={type:null,cells:[]}; return; }
        const heal=calcHeal(15);
        state.hp=Math.min(state.hpMax,state.hp+heal);
        updateHpUI();
        spawnFloater(px,py,`+${heal}`,'#4ecdc4',11);
      }, 500);
      break;
    }

    case 'cut_webs': {
      // Cut all active fils, deal damage per fil cut
      const filsCount = Math.round(resVal); // fils = resource
      addLog(`Coupure nette — ${filsCount} fil(s) coupé(s)!`,'action');
      if (filsCount > 0) {
        const allEnemies = state.enemies.filter(e=>e.alive);
        allEnemies.forEach(en=>{
          const dmg=calcDamage(baseVal*dmgMult*filsCount,en.armor);
          const zone=getCellsInRange(en.gridX,en.gridY,2);
          const zoneHits=state.enemies.filter(e=>e.alive&&e!==en&&zone.some(c=>c.x===e.gridX&&c.y===e.gridY));
          zoneHits.forEach(e2=>{ const d2=calcDamage(baseVal*dmgMult,e2.armor); applyDamageToEnemy(e2,d2); spawnFloater(e2.gridX,e2.gridY,`-${d2}`,'#4ecdc4',13); });
        });
        spawnFloater(px,py,`✂ ${filsCount} FILS`,'#4ecdc4',14);
      }
      state.resource.val = 0; // cut all fils
      updateResourceUI(); cancelTargeting(); return;
    }

    case 'transfer_effect': {
      const en = targetEnemy || findEnemyAt(targetGx,targetGy);
      if (!en) { addLog('Aucun ennemi.','normal'); cancelTargeting(); return; }
      // Find adjacent enemies
      const adj = state.enemies.filter(e=>e.alive&&e!==en&&Math.abs(e.gridX-en.gridX)+Math.abs(e.gridY-en.gridY)<=2);
      if (adj.length===0) { addLog('Aucun ennemi adjacent pour le transfert.','normal'); cancelTargeting(); return; }
      const target2 = adj[0];
      // Transfer all debuffs from en to target2
      const debuffKeys = Object.keys(en.debuffs).filter(k=>en.debuffs[k]);
      debuffKeys.forEach(k=>{ target2.debuffs[k]=true; en.debuffs[k]=false; });
      addLog(`Transfer: debuffs de ${en.name} → ${target2.name}!`,'action');
      spawnFloater(en.gridX,en.gridY,'✂','#4ecdc4',14);
      spawnFloater(target2.gridX,target2.gridY,'🕸','#4ecdc4',14);
      break;
    }

    case 'prevent_death': {
      const en = targetEnemy || findEnemyAt(targetGx,targetGy);
      if (!en) { addLog('Aucun ennemi.','normal'); cancelTargeting(); return; }
      en.debuffs.immortal = true;
      spawnFloater(en.gridX,en.gridY,'♾ IMMORTEL','#4ecdc4',12);
      addLog(`Ancre spectrale → ${en.name}: ne peut pas mourir ${baseVal}s!`,'action');
      setTimeout(()=>{ en.debuffs.immortal=false; addLog(`Ancre spectrale expirée sur ${en.name}.`,'normal'); }, baseVal*1000);
      break;
    }

    case 'mirror_skill': {
      state.buffs.mirrorNext = true;
      addLog('Miroir de lien actif — prochain skill dupliqué sur la cible liée!','action');
      spawnFloater(px,py,'🪞 MIROIR','#4ecdc4',13);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.mirrorNext=false; }, 15000);
      break;
    }

    case 'grande_toile': {
      // Heal player for each enemy hit
      const allEnemies = state.enemies.filter(e=>e.alive&&!e.isDummy);
      allEnemies.forEach(en=>{ spawnFloater(en.gridX,en.gridY,'🕸','#4ecdc4',11); });
      const heal = calcHeal(baseVal * allEnemies.length);
      state.hp = Math.min(state.hpMax, state.hp+heal);
      updateHpUI();
      state.buffs.grandeToile = true;
      state.buffs.grandeToileEnd = Date.now() + 6000;
      addLog(`Grande Toile — ${allEnemies.length} ennemis liés! +${heal} PV. Dure 6s.`,'heal');
      spawnFloater(px,py,`+${heal}`,'#4ecdc4',16);
      updateBuffDisplay();
      break;
    }

    // ─────────────────────────────────
    // BRISEUR
    // ─────────────────────────────────
    case 'defensive_stance': {
      state.buffs.defensiveStance = true;
      state.buffs.armor_bonus = Math.round(state.armor * 0.5);
      state.armor += state.buffs.armor_bonus;
      addLog('Mur de chair — –50% dégâts reçus, Endurance ×2/s pendant 6s!','action');
      spawnFloater(px,py,'🛡 MUR','#e74c3c',14);
      updateHpUI(); renderStats(); updateBuffDisplay();
      setTimeout(()=>{
        state.buffs.defensiveStance = false;
        state.armor -= state.buffs.armor_bonus; state.buffs.armor_bonus = 0;
        addLog('Mur de chair terminé.','normal');
        updateHpUI(); renderStats(); updateBuffDisplay();
      }, 6000);
      break;
    }

    case 'charge_knockback': {
      const lineCells = getLineCells(px,py,targetGx,targetGy,skill.range);
      const endurance = resVal;
      const mult = (0.5+endurance/200)*dmgMult;
      let hitCount=0;
      lineCells.forEach(c=>{
        const en=findEnemyAt(c.x,c.y); if(!en) return;
        const dmg=calcDamage(baseVal*mult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,'#e74c3c',16);
        knockbackEnemy(en,Math.sign(targetGx-px)||1,Math.sign(targetGy-py),2);
        hitCount++;
      });
      // Move player along line (3 cells)
      const moveTarget = lineCells[Math.min(2,lineCells.length-1)];
      if (moveTarget) {
        const path=aStar(px,py,moveTarget.x,moveTarget.y);
        if(path.length>0) startMoving(path.slice(0,3));
      }
      addLog(`Charge brisante: ${hitCount} ennemi(s) repoussés!`,'damage');
      state.highlight={type:'telegraph',cells:lineCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},800);
      break;
    }

    case 'root_self_buff': {
      state.buffs.rootSelf = true;
      addLog('Ancrage au sol — Immunité knockbacks 4s, Endurance ×2/s!','action');
      spawnFloater(px,py,'⚓ ANCRAGE','#e74c3c',13);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.rootSelf=false; addLog('Ancrage expiré.','normal'); updateBuffDisplay(); }, 4000);
      break;
    }

    case 'zone_shield': {
      // Convert 30 Endurance to temporary shield
      const shieldAmt = baseVal;
      state.buffs.shieldCharges = 3;
      state.buffs.shieldType = 'briseur';
      const tempArmor = Math.round(shieldAmt * 2);
      state.buffs.armor_bonus = tempArmor;
      state.armor += tempArmor;
      const shieldEl=document.getElementById('shield-display');
      const shieldVal=document.getElementById('shield-val');
      if(shieldEl) shieldEl.style.display='block';
      if(shieldVal) shieldVal.textContent=`Bouclier actif (3s)`;
      addLog(`Absorption — Bouclier +${tempArmor} armure temporaire 3s!`,'action');
      spawnFloater(px,py,'🛡 ABSORB','#e74c3c',13);
      updateHpUI(); renderStats(); updateBuffDisplay();
      setTimeout(()=>{
        state.armor-=tempArmor; state.buffs.armor_bonus=0; state.buffs.shieldCharges=0;
        const el=document.getElementById('shield-display'); if(el) el.style.display='none';
        updateHpUI(); renderStats(); updateBuffDisplay();
      }, 3000);
      break;
    }

    // ─────────────────────────────────
    // DRUIDE
    // ─────────────────────────────────
    case 'place_totem': {
      state.buffs.totemActive = true;
      state.buffs.totemEnd = Date.now() + 10000;
      addLog('Totem de régénération posé — +15 PV/s pendant 10s!','heal');
      spawnFloater(px,py,'🍄 TOTEM','#27ae60',14);
      updateBuffDisplay();
      break;
    }

    case 'animal_form': {
      state.buffs.animalForm = true;
      state.buffs.animalFormEnd = Date.now() + 8000;
      addLog('Forme animale — Vitesse ×1.5, dégâts ×1.5, soin au contact! (8s)','action');
      spawnFloater(px,py,'🐺 BÊTE','#27ae60',15);
      updateBuffDisplay();
      break;
    }

    case 'summon_wolves': {
      const now = Date.now();
      state.buffs.summons = [
        { x:Math.max(0,px-1), y:py, hp:100, maxHp:100, alive:true, expiresAt:now+12000 },
        { x:Math.min(GRID_SIZE-1,px+1), y:py, hp:100, maxHp:100, alive:true, expiresAt:now+12000 },
      ];
      addLog('Appel de la meute — 2 loups spectraux invoqués pour 12s!','action');
      spawnFloater(px,py,'🐺 ×2','#27ae60',16);
      updateBuffDisplay();
      break;
    }

    case 'mass_regen': {
      const zoneCells = getCellsInRange(targetGx,targetGy,4);
      addLog('Régénération de masse — +50 PV sur 5s dans la zone!','heal');
      state.highlight={type:'heal',cells:zoneCells};
      let ticks=0;
      const massRegInt = setInterval(()=>{
        if(++ticks>10){ clearInterval(massRegInt); state.highlight={type:null,cells:[]}; return; }
        // Heal player if in zone
        if(zoneCells.some(c=>c.x===px&&c.y===py)){
          const heal=calcHeal(10);
          state.hp=Math.min(state.hpMax,state.hp+heal);
          updateHpUI();
          spawnFloater(px,py,`+${heal}`,'#27ae60',10);
        }
        // Heal remote players too (multiplayer)
        if(window.multiState) multiState.broadcastHeal && multiState.broadcastHeal(10);
      }, 500);
      break;
    }

    case 'symbiosis': {
      addLog('Symbiose activée — 50% de vos soins partagés 12s!','action');
      state.buffs.symbiosis = true;
      spawnFloater(px,py,'🌿 SYMBIOSE','#27ae60',13);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.symbiosis=false; addLog('Symbiose expirée.','normal'); updateBuffDisplay(); }, 12000);
      break;
    }

    // ─────────────────────────────────
    // MAGE
    // ─────────────────────────────────
    case 'fireball': {
      const r=2;
      const zoneCells=getCellsInRange(targetGx,targetGy,r);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{ const dmg=calcDamage(baseVal*dmgMult,en.armor); applyDamageToEnemy(en,dmg); spawnFloater(en.gridX,en.gridY,`-${dmg}`,cls.color,16); });
      addLog(`Boule de feu: ${hits.length} ennemi(s) touchés`,'damage');
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1200);
      break;
    }

    case 'flamethrower': {
      const ddx=Math.sign(targetGx-px)||1;
      const coneCells=[];
      for(let i=1;i<=4;i++){
        const bx=px+ddx*i, by=py;
        if(bx>=0&&bx<GRID_SIZE) coneCells.push({x:bx,y:by});
        if(i>1){if(by-1>=0) coneCells.push({x:bx,y:by-1});if(by+1<GRID_SIZE) coneCells.push({x:bx,y:by+1});}
      }
      const hits=state.enemies.filter(e=>e.alive&&coneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{ const dmg=calcDamage(baseVal*dmgMult,en.armor); applyDamageToEnemy(en,dmg); spawnFloater(en.gridX,en.gridY,`-${dmg}🔥`,'#e67e22',14); });
      addLog(`Jet de flammes — ${hits.length} ennemis brûlés!`,'damage');
      state.highlight={type:'fire',cells:coneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1500);
      break;
    }

    case 'firewall': {
      const tileDir = Math.abs(targetGx-px)>=Math.abs(targetGy-py);
      let wallCells = tileDir ?
        [{x:targetGx,y:targetGy},{x:targetGx,y:targetGy-1},{x:targetGx,y:targetGy+1}]:
        [{x:targetGx,y:targetGy},{x:targetGx-1,y:targetGy},{x:targetGx+1,y:targetGy}];
      wallCells=wallCells.filter(c=>c.x>=0&&c.y>=0&&c.x<GRID_SIZE&&c.y<GRID_SIZE&&state.terrain[`${c.x},${c.y}`]!=='blocked');
      addLog('Mur de feu posé! Actif 6s.','action');
      state.highlight={type:'fire',cells:wallCells};
      let ticks=0;
      const fireInt=setInterval(()=>{
        if(++ticks>12||!state.selectedClass){clearInterval(fireInt);state.highlight={type:null,cells:[]};return;}
        wallCells.forEach(c=>{
          const en=findEnemyAt(c.x,c.y); if(!en) return;
          const dmg=calcDamage(baseVal*dmgMult,en.armor);
          applyDamageToTarget(en, dmg);
          spawnFloater(en.gridX,en.gridY,`-${dmg}🔥`,'#e67e22',12);
        });
      },500);
      break;
    }

    case 'ice_nova': {
      const zoneCells=getCellsInRange(targetGx,targetGy,3);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{en.debuffs.slow=true;setTimeout(()=>{en.debuffs.slow=false;},4000);});
      addLog(`Nova glaciale — ${hits.length} ennemis ralentis, –30 Chaleur.`,'action');
      spawnFloater(px,py,`–30 Chaleur`,'#80c0ff',13);
      state.resource.val = Math.max(0,state.resource.val-30);
      updateResourceUI(); cancelTargeting(); return;
    }

    case 'fire_fissure': {
      const lineCells=getLineCells(px,py,targetGx,targetGy,5);
      addLog('Fissure ardente! Ligne active 5s.','action');
      state.highlight={type:'fire',cells:lineCells};
      let ticks=0;
      const fissInt=setInterval(()=>{
        if(++ticks>10||!state.selectedClass){clearInterval(fissInt);state.highlight={type:null,cells:[]};return;}
        lineCells.forEach(c=>{
          const en=findEnemyAt(c.x,c.y); if(!en) return;
          const dmg=calcDamage(baseVal*dmgMult,en.armor);
          applyDamageToTarget(en, dmg);
          spawnFloater(en.gridX,en.gridY,`-${dmg}🔥`,'#e67e22',11);
        });
      },500);
      break;
    }

    case 'meteor': {
      const zoneCells=getCellsInRange(targetGx,targetGy,1);
      addLog('Météore en route! Impact dans 2s.','action');
      spawnFloater(targetGx,targetGy,'☄ 2s...','#ff6600',13);
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{
        if(!state.selectedClass){state.highlight={type:null,cells:[]};return;}
        const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
        hits.forEach(en=>{ const dmg=calcDamage(baseVal*dmgMult,en.armor); applyDamageToEnemy(en,dmg); spawnFloater(en.gridX,en.gridY,`-${dmg}☄`,'#ff6600',20); });
        addLog(`MÉTÉORE — ${hits.length} ennemi(s) impactés!`,'damage');
        state.highlight={type:null,cells:[]};
        if(state.opts.vfx) spawnVFX('explosion',zoneCells,state.player.px,state.player.py,1000,'#ff6600',{gx:targetGx,gy:targetGy,radius:2});
      },2000);
      break;
    }

    case 'fire_shield': {
      state.buffs.shieldCharges = baseVal;
      state.buffs.shieldType = 'fire';
      const shieldEl=document.getElementById('shield-display');
      const shieldVal=document.getElementById('shield-val');
      if(shieldEl) shieldEl.style.display='block';
      if(shieldVal) shieldVal.textContent=`${state.buffs.shieldCharges} charges (→ Chaleur)`;
      addLog(`Bouclier igné — ${baseVal} charges, absorbe et convertit en Chaleur!`,'action');
      spawnFloater(px,py,'🛡🔥','#e67e22',14);
      updateBuffDisplay();
      break;
    }

    case 'ignite': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      const dmg=calcDamage(baseVal*dmgMult,en.armor,30);
      applyDamageToTarget(en, dmg);
      addLog(`Combustion → ${en.name}: −${dmg} PV (−30% résistance)`,'damage');
      spawnFloater(en.gridX,en.gridY,`-${dmg}🔥`,cls.color,18);
      break;
    }

    case 'heat_wave': {
      const zoneCells=getCellsInRange(px,py,4);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        const dmg=calcDamage(baseVal*dmgMult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}🔥`,'#e67e22',14);
        knockbackEnemy(en,Math.sign(en.gridX-px)||1,Math.sign(en.gridY-py),2);
      });
      addLog(`Vague de chaleur — ${hits.length} ennemis repoussés!`,'damage');
      break;
    }

    case 'fusion': {
      state.buffs.fusionActive = true;
      addLog('FUSION TOTALE — ×2 dégâts pendant 8s!','action');
      spawnFloater(px,py,'×2 DÉGÂTS','#e67e22',16);
      updateBuffDisplay();
      setTimeout(()=>{
        state.buffs.fusionActive=false;
        state.resource.val=0; updateResourceUI();
        addLog('Fusion terminée, Chaleur réinitialisée.','normal');
        updateBuffDisplay();
      },8000);
      break;
    }

    // ─────────────────────────────────
    // PALADIN
    // ─────────────────────────────────
    case 'holy_strike': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      const dmg=calcDamage(baseVal*dmgMult,en.armor);
      applyDamageToTarget(en, dmg);
      addLog(`Frappe sacrée → ${en.name}: −${dmg} PV`,'damage');
      spawnFloater(en.gridX,en.gridY,`-${dmg}✦`,'#f1c40f',18);
      // Splash if Foi > 50
      if(resVal>50){
        const zone=getCellsInRange(en.gridX,en.gridY,1);
        state.enemies.filter(e=>e.alive&&e!==en&&zone.some(c=>c.x===e.gridX&&c.y===e.gridY)).forEach(e2=>{
          const dmg2=calcDamage(dmg*0.5,e2.armor);
          applyDamageToEnemy(e2,dmg2);
          spawnFloater(e2.gridX,e2.gridY,`-${dmg2}`,'#f1c40f',13);
        });
        addLog('Foi >50 — dégâts en zone!','action');
      }
      break;
    }

    case 'divine_shield': {
      // Apply shield to nearest entity (self if none found)
      state.buffs.shieldCharges = baseVal; // 3 charges
      state.buffs.shieldType = 'divine';
      const shieldEl=document.getElementById('shield-display');
      const shieldVal2=document.getElementById('shield-val');
      if(shieldEl) shieldEl.style.display='block';
      if(shieldVal2) shieldVal2.textContent=`${state.buffs.shieldCharges} charges divines (8s)`;
      addLog(`Bouclier divin — ${baseVal} charges divines!`,'action');
      spawnFloater(px,py,'✨🛡','#f1c40f',14);
      updateBuffDisplay();
      setTimeout(()=>{
        state.buffs.shieldCharges=0;
        const el=document.getElementById('shield-display'); if(el) el.style.display='none';
        updateBuffDisplay();
      }, 8000);
      break;
    }

    case 'aura_protection': {
      state.buffs.auraProtection = true;
      state.buffs.auraEnd = Date.now() + 10000;
      const tempArmor = Math.round(state.armor * 0.15);
      state.buffs.armor_bonus = tempArmor;
      state.armor += tempArmor;
      addLog('Aura de protection — –15% dégâts reçus 10s!','action');
      spawnFloater(px,py,'✨ AURA','#f1c40f',13);
      updateHpUI(); renderStats(); updateBuffDisplay();
      break;
    }

    case 'resurrect': {
      // In solo: heal player to 30% if below 30%
      if(state.hp < state.hpMax*0.3){
        state.hp = Math.round(state.hpMax * 0.30);
        updateHpUI();
        addLog('Résurrection rapide — PV restaurés à 30%!','heal');
        spawnFloater(px,py,'✨ RÉSURRECTION','#f1c40f',16);
      } else {
        addLog('Résurrection rapide — déjà au-dessus de 30% PV. (Utile si allié tombe)','normal');
      }
      break;
    }

    case 'light_bastion': {
      const zoneCells=getCellsInRange(targetGx,targetGy,2);
      state.buffs.lightBastionCells = zoneCells;
      state.buffs.lightBastionEnd = Date.now() + 5000;
      addLog('Bastion de lumière — Zone infranchissable 5s!','action');
      spawnFloater(px,py,'🏰 BASTION','#f1c40f',14);
      // Slow/stop enemies entering zone
      const zoneInt=setInterval(()=>{
        if(Date.now()>state.buffs.lightBastionEnd){clearInterval(zoneInt);state.buffs.lightBastionCells=[];return;}
        state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY)).forEach(e=>{
          e.debuffs.rooted=true; setTimeout(()=>{if(e.alive)e.debuffs.rooted=false;},1000);
        });
      },500);
      break;
    }

    case 'martyr': {
      state.buffs.martyrTarget = true;
      state.buffs.martyrEnd = Date.now() + 6000;
      addLog('Martyr — Vous absorbez 50% des dégâts alliés 6s, Foi ×2!','action');
      spawnFloater(px,py,'💛 MARTYR','#f1c40f',14);
      updateBuffDisplay();
      // Génère Foi ×2 pendant la durée
      const martyrInt=setInterval(()=>{
        if(!state.buffs.martyrTarget||Date.now()>state.buffs.martyrEnd){clearInterval(martyrInt);return;}
        regenResource(1);
      },500);
      break;
    }

    case 'crusade': {
      const tempArmor2=Math.round(state.armor*0.30);
      state.buffs.armor_bonus=tempArmor2;
      state.armor+=tempArmor2;
      addLog('Croisade divine — résistance +30% 8s!','action');
      spawnFloater(px,py,'🛡 +30%','#f1c40f',14);
      updateHpUI(); renderStats(); updateBuffDisplay();
      setTimeout(()=>{
        state.armor-=tempArmor2; state.buffs.armor_bonus=0;
        updateHpUI(); renderStats(); updateBuffDisplay();
        addLog('Croisade terminée.','normal');
      },8000);
      break;
    }

    // ─────────────────────────────────
    // ASSASSIN
    // ─────────────────────────────────
    case 'eclipse': {
      state.buffs.eclipseActive = true;
      state.buffs.eclipseNextSkillDouble = true;
      // Reset all cooldowns to 0
      Object.keys(state.cooldowns).forEach(k=>{ state.cooldowns[k]=0; });
      addLog('ÉCLIPSE — 3s invisibilité, invulnérabilité, prochain skill ×2, CD reset!','action');
      spawnFloater(px,py,'🌑 ÉCLIPSE','#8e44ad',16);
      updateBuffDisplay(); renderSkills();
      setTimeout(()=>{
        state.buffs.eclipseActive=false;
        state.buffs.eclipseNextSkillDouble=false;
        addLog('Éclipse terminée.','normal');
        updateBuffDisplay();
      },3000);
      break;
    }

    case 'eviscerate': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      const combo=Math.max(1,Math.round(resVal));
      const finalMult=1+combo*0.35;
      const dmg=calcDamage(baseVal*dmgMult*finalMult,en.armor);
      applyDamageToTarget(en, dmg);
      addLog(`Éviscération (×${combo} Combo) → ${en.name}: −${dmg} PV!`,'damage');
      spawnFloater(en.gridX,en.gridY,`-${dmg}`,'#8e44ad',20);
      break;
    }

    case 'execution': {
      if(resVal < 5){ addLog('Exécution — 5 Combo requis!','normal'); cancelTargeting(); return; }
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      // Teleport to target
      const iso=gridToIso(targetGx,targetGy);
      state.player.gridX=targetGx; state.player.gridY=targetGy;
      state.player.px=iso.x; state.player.py=iso.y+CELL_H/2; state.player.t=1; state.player.path=[];
      // 5 rapid hits
      let totalDmg=0;
      for(let i=0;i<5;i++){
        const dmg=calcDamage(baseVal*dmgMult*0.3,en.armor);
        totalDmg+=dmg;
        applyDamageToTarget(en, dmg);
      }
      addLog(`EXÉCUTION → ${en.name}: −${totalDmg} PV (5 frappes)!`,'damage');
      spawnFloater(en.gridX,en.gridY,`💀 ${totalDmg}`,'#8e44ad',22);
      if(state.opts.vfx) spawnVFX('explosion',[{x:targetGx,y:targetGy}],state.player.px,state.player.py,800,'#8e44ad',{gx:targetGx,gy:targetGy,radius:1});
      break;
    }

    case 'death_mark': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      en.debuffs.death_mark=true;
      spawnFloater(en.gridX,en.gridY,'☠ MARQUÉ','#8e44ad',12);
      addLog(`Marque de mort → ${en.name}: +1 Combo/attaque 8s!`,'action');
      setTimeout(()=>{ en.debuffs.death_mark=false; },8000);
      break;
    }

    case 'dagger_fan': {
      const zoneCells=getCellsInRange(targetGx,targetGy,2);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      let comboGained=0;
      hits.forEach(en=>{
        if(comboGained>=5) return;
        const dmg=calcDamage(baseVal*dmgMult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,'#8e44ad',14);
        comboGained++;
      });
      regenResource(comboGained);
      addLog(`Nuée de dagues — ${hits.length} touchés, +${comboGained} Combo!`,'damage');
      break;
    }

    // ─────────────────────────────────
    // SHARED EFFECTS
    // ─────────────────────────────────
    case 'heal': {
      const heal=calcHeal(baseVal);
      state.hp=Math.min(state.hpMax,state.hp+heal);
      updateHpUI();
      addLog(`${skill.name} — +${heal} PV`,'heal');
      spawnFloater(px,py,`+${heal}`,'#27ae60',18);
      if(state.buffs.symbiosis && state.buffs.symbiosisTarget){
        spawnFloater(px,py,`+${Math.round(heal*0.5)} 🌿`,'#27ae60',11);
      }
      break;
    }

    case 'zone_root': {
      const zoneCells=getCellsInRange(targetGx,targetGy,2);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{ en.debuffs.rooted=true; spawnFloater(en.gridX,en.gridY,'🌿 Racines','#27ae60',11); setTimeout(()=>{if(en.alive)en.debuffs.rooted=false;},3000); });
      addLog(`Racines — ${hits.length} ennemi(s) immobilisé(s) 3s`,'action');
      state.highlight={type:'heal',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},3000);
      break;
    }

    case 'zone_slow': {
      const zoneCells=getCellsInRange(targetGx,targetGy,2);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{ en.debuffs.slow=true; setTimeout(()=>{if(en.alive)en.debuffs.slow=false;},5000); });
      addLog(`Toile immobilisante — ${hits.length} ennemi(s) ralenti(s) 5s`,'action');
      break;
    }

    case 'zone_damage': {
      const zoneCells=getCellsInRange(px,py,skill.range);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{ const dmg=calcDamage(baseVal*dmgMult,en.armor); applyDamageToEnemy(en,dmg); spawnFloater(en.gridX,en.gridY,`-${dmg}`,cls.color,14); });
      addLog(`${skill.name}: ${hits.length} ennemi(s) touchés`,'damage');
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1200);
      break;
    }

    case 'zone_ultimate': {
      const zoneCells=getCellsInRange(targetGx,targetGy,3);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        const dmg=calcDamage(baseVal*dmgMult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,cls.color,18);
        en.debuffs.stunned=true; setTimeout(()=>{if(en.alive)en.debuffs.stunned=false;},2000);
      });
      addLog(`FRACTURE TOTALE — ${hits.length} ennemi(s) stun!`,'damage');
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1400);
      break;
    }

    case 'nova_rupture': {
      const zoneCells=getCellsInRange(px,py,5);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        const dmg=calcDamage(baseVal*dmgMult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}`,cls.color,18);
        const kbx=Math.sign(en.gridX-px)||1, kby=Math.sign(en.gridY-py);
        knockbackEnemy(en,kbx,kby,3);
        en.debuffs.stunned=true; setTimeout(()=>{if(en.alive)en.debuffs.stunned=false;},3000);
      });
      addLog(`NOVA DE RUPTURE — ${hits.length} ennemis repoussés + stun!`,'damage');
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1400);
      break;
    }

    case 'zone_storm': {
      const zoneCells=getCellsInRange(targetGx,targetGy,4);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        const dmg=calcDamage(baseVal*dmgMult,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}⚡`,'#27ae60',14);
        en.debuffs.rooted=true; setTimeout(()=>{if(en.alive)en.debuffs.rooted=false;},2000);
      });
      const heal=calcHeal(40);
      state.hp=Math.min(state.hpMax,state.hp+heal);
      updateHpUI();
      addLog(`Tempête naturelle — ${hits.length} ennemis, +${heal} PV!`,'heal');
      spawnFloater(px,py,`+${heal}`,'#27ae60',15);
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1400);
      break;
    }

    case 'zone_poison': {
      const zoneCells=getCellsInRange(targetGx,targetGy,2);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        if(en.debuffs.poisoned) return; // Don't stack
        en.debuffs.poisoned=true;
        let ticks2=0;
        const pInt=setInterval(()=>{
          if(!en.alive||++ticks2>10){clearInterval(pInt);if(en.alive)en.debuffs.poisoned=false;return;}
          const dmg=calcDamage(baseVal*dmgMult,en.armor);
          applyDamageToTarget(en, dmg);
          spawnFloater(en.gridX,en.gridY,`-${dmg}☠`,'#27ae60',11);
        },500);
      });
      addLog(`Spores vénéneuses — ${hits.length} ennemi(s) empoisonné(s)!`,'action');
      break;
    }

    case 'consecration': {
      const zoneCells=getCellsInRange(px,py,3);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{ const dmg=calcDamage(baseVal*dmgMult,en.armor); applyDamageToEnemy(en,dmg); spawnFloater(en.gridX,en.gridY,`-${dmg}`,'#f1c40f',14); });
      const heal=calcHeal(baseVal);
      state.hp=Math.min(state.hpMax,state.hp+heal);
      updateHpUI();
      addLog(`Consécration — ${hits.length} ennemis, +${heal} PV.`,'heal');
      spawnFloater(px,py,`+${heal}`,'#f1c40f',15);
      state.highlight={type:'telegraph',cells:zoneCells};
      setTimeout(()=>{state.highlight={type:null,cells:[]};},1200);
      break;
    }

    case 'stun_strike': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      const dmg=calcDamage(baseVal*dmgMult,en.armor);
      applyDamageToTarget(en, dmg);
      en.debuffs.stunned=true;
      setTimeout(()=>{if(en.alive)en.debuffs.stunned=false;},2000);
      addLog(`${skill.name} → ${en.name}: −${dmg} PV + stun!`,'damage');
      spawnFloater(en.gridX,en.gridY,`-${dmg}💫`,cls.color,18);
      break;
    }

    case 'double_strike': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      const dmg1=calcDamage(baseVal*dmgMult,en.armor);
      const bonus=en.debuffs.fracture?1.5:1;
      const dmg2=calcDamage(baseVal*dmgMult*bonus,en.armor);
      applyDamageToTarget(en,dmg1+dmg2);
      addLog(`${skill.name} → ${en.name}: −${dmg1+dmg2} PV`,'damage');
      spawnFloater(en.gridX,en.gridY,`-${dmg1+dmg2}`,cls.color,18);
      break;
    }

    case 'dash': {
      const ddx=Math.sign(targetGx-px)||1;
      const targetX=Math.min(GRID_SIZE-1,Math.max(0,px+ddx*3));
      const path=aStar(px,py,targetX,py);
      const dashPath=path.slice(0,3);
      if(dashPath.length===0){addLog('Dash impossible!','normal');cancelTargeting();return;}
      if(resVal>50) dashPath.forEach(c=>{ state.enemies.filter(e=>e.alive&&e.gridX===c.x&&e.gridY===c.y).forEach(en=>{en.debuffs.slow=true;setTimeout(()=>{if(en.alive)en.debuffs.slow=false;},3000);}); });
      startMoving(dashPath);
      addLog('Ruée instable!','action');
      break;
    }

    case 'blade_dash': {
      const ddx=Math.sign(targetGx-px)||1, ddy=Math.sign(targetGy-py)||0;
      const dashCells=[];
      for(let i=1;i<=2;i++){
        const nx=px+ddx*i, ny=py+ddy*i;
        if(nx<0||ny<0||nx>=GRID_SIZE||ny>=GRID_SIZE) break;
        if(state.terrain[`${nx},${ny}`]==='blocked') break;
        dashCells.push({x:nx,y:ny});
        const en=findEnemyAt(nx,ny);
        if(en){ const dmg=calcDamage(baseVal*dmgMult,en.armor); applyDamageToTarget(en, dmg); spawnFloater(en.gridX,en.gridY,`-${dmg}`,cls.color,14); }
      }
      if(dashCells.length>0) startMoving(dashCells);
      addLog('Traîne de lames!','action');
      break;
    }

    case 'teleport': {
      if(state.terrain[`${targetGx},${targetGy}`]==='blocked'){addLog('Case bloquée!','normal');cancelTargeting();return;}
      const iso2=gridToIso(targetGx,targetGy);
      state.player.gridX=targetGx; state.player.gridY=targetGy;
      state.player.px=iso2.x; state.player.py=iso2.y+CELL_H/2;
      state.player.t=1; state.player.path=[];
      addLog(`Pas de l'ombre → (${targetGx},${targetGy})`,'action');
      if(state.opts.vfx) spawnVFX('teleport_out',[],state.player.px,state.player.py,400,cls.color,{});
      if(skill.resourceDelta) regenResource(skill.resourceDelta);
      state.cooldowns[cdKey]=skill.cd;
      cancelTargeting(); return;
    }

    case 'poison': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      if(en.debuffs.poisoned){addLog(`${en.name} déjà empoisonné!`,'normal');cancelTargeting();return;}
      en.debuffs.poisoned=true;
      let poisonTicks=0;
      const poisInt=setInterval(()=>{
        if(!en.alive||++poisonTicks>10){clearInterval(poisInt);if(en.alive)en.debuffs.poisoned=false;return;}
        const dmg=calcDamage(baseVal,en.armor);
        applyDamageToTarget(en, dmg);
        spawnFloater(en.gridX,en.gridY,`-${dmg}☠`,'#8e44ad',11);
        regenResource(1);
      },500);
      addLog(`Lame empoisonnée → ${en.name}: poison 5s!`,'action');
      break;
    }

    case 'buff_damage': {
      // Tisseuse: needs 2+ fils
      if(state.selectedClass==='tisseuse'&&resVal<2){
        addLog('Résonance tissée — 2 Fils actifs requis!','normal'); cancelTargeting(); return;
      }
      state.buffs.damage_mult = 1+baseVal/100;
      addLog(`${skill.name} — +${baseVal}% dégâts 8s!`,'action');
      spawnFloater(px,py,`+${baseVal}% DMG`,cls.color,14);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.damage_mult=1; updateBuffDisplay(); addLog('Buff dégâts expiré.','normal'); },8000);
      break;
    }

    case 'buff_resistance': {
      const tempA=Math.round(state.armor*baseVal/100);
      state.buffs.armor_bonus=tempA;
      state.armor+=tempA;
      addLog(`${skill.name} — –${baseVal}% dégâts reçus 6s!`,'action');
      spawnFloater(px,py,`🛡 –${baseVal}%`,cls.color,14);
      updateHpUI(); renderStats(); updateBuffDisplay();
      setTimeout(()=>{ state.armor-=tempA; state.buffs.armor_bonus=0; updateHpUI(); renderStats(); updateBuffDisplay(); },6000);
      break;
    }

    case 'rage_buff': {
      if(resVal<75){addLog('Rage forgée — 75 Endurance requis!','normal');cancelTargeting();return;}
      state.buffs.raged=true;
      addLog('Rage forgée — +40% attaque 8s!','action');
      spawnFloater(px,py,'⚡ RAGE','#e74c3c',16);
      updateBuffDisplay();
      setTimeout(()=>{ state.buffs.raged=false; addLog('Rage terminée.','normal'); updateBuffDisplay(); },8000);
      break;
    }

    case 'taunt_zone': {
      const zoneCells=getCellsInRange(px,py,skill.range>0?skill.range:3);
      const hits=state.enemies.filter(e=>e.alive&&zoneCells.some(c=>c.x===e.gridX&&c.y===e.gridY));
      hits.forEach(en=>{
        en.debuffs.slow=true;
        setTimeout(()=>{if(en.alive)en.debuffs.slow=false;},5000);
      });
      addLog(`${skill.name} — ${hits.length} ennemi(s) ralenti(s)!`,'action');
      spawnFloater(px,py,'⚡ TAUNT',cls.color,13);
      break;
    }

    case 'judgment': {
      const en=targetEnemy||findEnemyAt(targetGx,targetGy);
      if(!en){addLog('Aucun ennemi.','normal');cancelTargeting();return;}
      const dmg=calcDamage(baseVal*dmgMult,en.armor);
      applyDamageToTarget(en, dmg);
      const pen=Math.round(en.armor*0.2);
      en.armor=Math.max(0,en.armor-pen);
      en.debuffs.judged=true;
      addLog(`Jugement → ${en.name}: −${dmg} PV, –20% résistance 8s!`,'damage');
      spawnFloater(en.gridX,en.gridY,`-${dmg}⚖`,'#f1c40f',18);
      setTimeout(()=>{ if(en.alive){en.armor+=pen;en.debuffs.judged=false;} },8000);
      break;
    }

    default:
      addLog(`${skill.name} activé! (effet: ${effect})`,'action');
      break;
  }

  // Apply resource delta
  if (effect !== 'line_damage_resource' && effect !== 'cut_webs' && effect !== 'ice_nova' && effect !== 'teleport') {
    if (skill.resourceDelta !== 0) regenResource(skill.resourceDelta);
  }

  // Set cooldown
  state.cooldowns[cdKey] = skill.cd;
  cancelTargeting();

  // Broadcast to multiplayer peers
  if (window.multiState && multiState.broadcastSkill) {
    multiState.broadcastSkill({ skillId:skill.id, targetGx, targetGy, classId:state.selectedClass });
  }

  // VFX
  if (state.opts.vfx) triggerSkillVFX(slotIdx, skill, targetGx, targetGy);

  renderSkills();
  if (typeof renderSkillBar === 'function') renderSkillBar();
  updateResourceUI();
  updateHpUI();
  renderStats();
  updateBuffDisplay();
}

// ═══════════════════════════════════════════════════════
// SHIELD INTERCEPTION (called when player takes damage)
// ═══════════════════════════════════════════════════════
function interceptDamage(rawDmg) {
  if (state.buffs.eclipseActive) return 0; // Invulnerable during eclipse
  if (state.buffs.martyrTarget) rawDmg = Math.round(rawDmg * 0.5); // Martyr

  if (state.buffs.shieldCharges > 0) {
    state.buffs.shieldCharges--;
    if (state.buffs.shieldType === 'peau_voile') {
      // 50% → Instabilité
      regenResource(Math.round(rawDmg * 0.5));
      spawnFloater(state.player.gridX,state.player.gridY,'🛡 ABSORBÉ','#9b4dca',12);
    } else if (state.buffs.shieldType === 'fire') {
      regenResource(15);
      spawnFloater(state.player.gridX,state.player.gridY,'🛡→🔥','#e67e22',12);
    } else {
      spawnFloater(state.player.gridX,state.player.gridY,'✨🛡 DIVIN','#f1c40f',12);
    }
    const shieldVal=document.getElementById('shield-val');
    if(shieldVal) shieldVal.textContent=`${state.buffs.shieldCharges} charges`;
    if(state.buffs.shieldCharges===0){
      const el=document.getElementById('shield-display'); if(el) el.style.display='none';
    }
    updateBuffDisplay();
    return 0; // Blocked
  }

  if (state.buffs.defensiveStance) return Math.round(rawDmg * 0.5);
  if (state.buffs.auraProtection) return Math.round(rawDmg * 0.85);

  return rawDmg;
}