// ---------- biome boss foundation (v0.29 E1-A) ----------
const DUNGEON_BOSS_ORDER = ['meadow_lord','cavern_lord','volcano_lord','tundra_lord','void_lord'];

function dungeonBossPhaseSet(options) {
  const o = options || {};
  return [
    { phase:1, minHpRatio:0.60, chaseSpeed:1.1, leapVelocity:-9, recoveryFrames:100, volleyCount:1 },
    { phase:2, minHpRatio:0.30, chaseSpeed:1.6, leapVelocity:-9, recoveryFrames:74, volleyCount:3 },
    { phase:3, minHpRatio:0, chaseSpeed:2.2, leapVelocity:-11.5, recoveryFrames:54, volleyCount:5 }
  ].map(item => Object.assign(item, o));
}

const DUNGEON_BOSS_DEFS = {
  meadow_lord: {
    id:'meadow_lord', biomeId:'meadow', name:'草原領主', firstFloor:5, color:'#63cf3c', accent:'#3f9127',
    hpMultiplier:1.08, damageMultiplier:0.82, initialAttackFrames:150, warningFrames:48, recoveryMultiplier:1.20, leapRange:160,
    addCounts:[0, 1, 2], phases:dungeonBossPhaseSet(), environmentId:'thorn_roots',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'root_sweep', name:'根鬚橫掃', implemented:true, warningFrames:45, activeFrames:18, recoveryFrames:76 },
      { id:'seed_burst', name:'種子彈幕', implemented:true, warningFrames:42, recoveryFrames:82 }
    ]
  },
  cavern_lord: {
    id:'cavern_lord', biomeId:'cavern', name:'洞窟領主', firstFloor:10, color:'#8a7aa8', accent:'#5a4a78',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet(), environmentId:'falling_rocks',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'marked_rockfall', name:'落石標記', implemented:false },
      { id:'cavern_shockwave', name:'洞窟衝擊波', implemented:false }
    ]
  },
  volcano_lord: {
    id:'volcano_lord', biomeId:'volcano', name:'熔岩魔王', firstFloor:15, color:'#ff6b2e', accent:'#c0301e',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet({ volleyBonus:2, volleySpeed:1.25 }), environmentId:'lava_vents',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'magma_charge', name:'熔岩衝鋒', implemented:false },
      { id:'vent_chain', name:'連鎖噴發', implemented:false }
    ]
  },
  tundra_lord: {
    id:'tundra_lord', biomeId:'tundra', name:'冰霜領主', firstFloor:20, color:'#9adcf0', accent:'#5a9ac0',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet({ projectileChill:true }), environmentId:'ice_floor',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'ice_lance', name:'寒冰槍陣', implemented:false },
      { id:'blizzard_dash', name:'暴風突進', implemented:false }
    ]
  },
  void_lord: {
    id:'void_lord', biomeId:'void', name:'深淵魔王', firstFloor:25, color:'#b05ae0', accent:'#7a2fa8',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet({ volleyBonus:2, volleySpeed:1.25 }), environmentId:'void_platforms',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'void_barrage', name:'虛空彈幕', implemented:false },
      { id:'platform_erasure', name:'平台消除', implemented:false }
    ]
  }
};

function dungeonBossDef(id) { return DUNGEON_BOSS_DEFS[id] || DUNGEON_BOSS_DEFS.meadow_lord; }

function dungeonBossDefForFloor(atFloor) {
  const biome = dungeonBiomeDef(Math.max(5, Number(atFloor) || 5));
  return Object.values(DUNGEON_BOSS_DEFS).find(def => def.biomeId === biome.id) || DUNGEON_BOSS_DEFS.meadow_lord;
}

function dungeonBossArenaPlatforms(definition) {
  const def = definition || DUNGEON_BOSS_DEFS.meadow_lord;
  return [{ x:0, y:468, w:def.arena.width, ground:true }].concat(def.arena.platforms.map(platform => Object.assign({}, platform)));
}

function dungeonBossPhaseForHealth(boss) {
  const ratio = Math.max(0, boss.mhp ? boss.hp / boss.mhp : 1);
  const def = dungeonBossDef(boss.bossId);
  const phase = def.phases.find(item => ratio > item.minHpRatio);
  return phase ? phase.phase : def.phases[def.phases.length - 1].phase;
}

function dungeonBossPhaseConfig(boss, phase) {
  const def = dungeonBossDef(boss.bossId);
  return def.phases.find(item => item.phase === phase) || def.phases[0];
}

function createDungeonBoss(definition, atFloor, scale) {
  const def = definition || dungeonBossDefForFloor(atFloor);
  const hp = Math.round(800 * scale * def.hpMultiplier);
  return {
    type:'boss', bossId:def.id, biomeId:def.biomeId, name:def.name, floor:atFloor,
    x:def.arena.width - 240, y:468, vx:0, vy:0, t:0, atkT:def.initialAttackFrames,
    tele:0, phase:1, phaseT:0, targetX:def.arena.width - 240, slamWarn:false,
    activeAttackId:null, attackCycle:0,
    hp, mhp:hp, xpv:Math.round(150 * (1 + 0.15 * (atFloor - 1))),
    dmg:Math.round(15 * scale * def.damageMultiplier), w:84, h:56, hitT:0, elite:true, s:7,
    intro:def.id === 'meadow_lord'
  };
}

function beginDungeonBossAttack(boss, attackId) {
  boss.activeAttackId = attackId || dungeonBossDef(boss.bossId).legacyAttackId;
  boss.attackCycle = (boss.attackCycle || 0) + 1;
  return boss.activeAttackId;
}

function finishDungeonBossAttack(boss) {
  boss.activeAttackId = null;
  boss.slamWarn = false;
}

function dungeonBossTelegraph(boss) {
  const def = dungeonBossDef(boss.bossId);
  const enraged = boss.phase >= 3;
  return {
    attackId:boss.activeAttackId || def.legacyAttackId,
    label:enraged ? '落地震波' : '跳撲落點',
    targetX:Number.isFinite(boss.targetX) ? boss.targetX : boss.x,
    radius:enraged ? (boss.intro ? 130 : 150) : 70,
    color:def.color,
    accent:def.accent
  };
}

function dungeonBossAddCount(boss, phase) {
  const def = dungeonBossDef(boss.bossId);
  return Math.max(0, Number(def.addCounts[Math.max(0, phase - 1)]) || 0);
}

let dungeonBossEffects = [];

function clearDungeonBossEffects() {
  dungeonBossEffects.length = 0;
}

function dungeonBossAttackSlot(boss, attackId) {
  const def = dungeonBossDef(boss.bossId);
  return def.attackSlots.find(attack => attack.id === attackId) || null;
}

function dungeonBossAttackSequence(boss) {
  const def = dungeonBossDef(boss.bossId);
  if (def.id !== 'meadow_lord') return [def.legacyAttackId];
  if (boss.phase <= 1) return ['root_sweep', def.legacyAttackId];
  if (boss.phase === 2) return ['root_sweep', def.legacyAttackId, 'seed_burst'];
  return ['root_sweep', 'seed_burst', def.legacyAttackId];
}

function dungeonBossNextAttack(boss) {
  const sequence = dungeonBossAttackSequence(boss);
  return sequence[(boss.attackCycle || 0) % sequence.length];
}

function meadowRootSweepEffects(boss, target) {
  const slot = dungeonBossAttackSlot(boss, 'root_sweep');
  const count = boss.phase <= 1 ? 2 : boss.phase === 2 ? 3 : 4;
  const wantedDirection = target.x < boss.x ? -1 : 1;
  const neededWidth = 135 + (count - 1) * 165 + 70;
  const availableWidth = wantedDirection < 0 ? boss.x : dungeonBossDef(boss.bossId).arena.width - boss.x;
  const direction = availableWidth >= neededWidth ? wantedDirection : -wantedDirection;
  const effects = [];
  for (let i = 0; i < count; i++) {
    const x = Math.max(110, Math.min(dungeonBossDef(boss.bossId).arena.width - 110, boss.x + direction * (135 + i * 165)));
    effects.push({
      type:'meadow_root', bossId:boss.bossId, bossName:boss.name, x, y:468, w:126,
      state:'warning', timer:slot.warningFrames + i * 10, activeFrames:slot.activeFrames,
      lingerFrames:boss.phase >= 2 ? (boss.phase === 3 ? 210 : 150) : 0,
      damage:Math.max(1, Math.round(boss.dmg * 0.72)), phase:boss.phase, hit:false
    });
  }
  return effects;
}

function startDungeonBossSpecialAttack(boss, target, attackId) {
  const slot = dungeonBossAttackSlot(boss, attackId);
  if (!slot || !slot.implemented || boss.specialAttack) return false;
  beginDungeonBossAttack(boss, attackId);
  if (attackId === 'root_sweep') {
    const effects = meadowRootSweepEffects(boss, target);
    dungeonBossEffects.push(...effects);
    boss.specialAttack = {
      id:attackId,
      timer:Math.max(...effects.map(effect => effect.timer)) + slot.activeFrames,
      recoveryFrames:slot.recoveryFrames
    };
  } else if (attackId === 'seed_burst') {
    boss.specialAttack = { id:attackId, timer:slot.warningFrames, recoveryFrames:slot.recoveryFrames, fired:false };
  } else return false;
  boss.vx = 0;
  return true;
}

function fireMeadowSeedBurst(boss, target) {
  const count = boss.phase >= 3 ? 7 : 5;
  const centerVx = (target.x - boss.x) / 58;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    espits.push({
      x:boss.x, y:boss.y - boss.h + 8,
      vx:centerVx + offset * 0.82,
      vy:-7.6 - Math.abs(offset) * 0.22,
      dmg:Math.max(1, Math.round(boss.dmg * 0.62)),
      col:'#9bdd4f', seed:true, heavy:boss.phase >= 3,
      ownerName:boss.name, sourceName:boss.name + '的種子彈幕'
    });
  }
  beep(420, 0.14, 'square', 0.045);
}

function updateDungeonBossSpecialAttack(boss, target) {
  const attack = boss.specialAttack;
  if (!attack) return { handled:false, playerDied:false };
  boss.vx = 0;
  attack.timer--;
  if (attack.id === 'seed_burst' && attack.timer <= 0 && !attack.fired) {
    attack.fired = true;
    fireMeadowSeedBurst(boss, target);
  }
  if (attack.timer <= 0) {
    boss.atkT = attack.recoveryFrames;
    boss.specialAttack = null;
    boss.activeAttackId = null;
  }
  return { handled:true, playerDied:false };
}

function dungeonBossEffectHitsPlayer(effect, target) {
  return target.x + target.w / 2 >= effect.x - effect.w / 2
    && target.x - target.w / 2 <= effect.x + effect.w / 2
    && target.y >= effect.y - (effect.state === 'active' ? 46 : 20)
    && target.y - target.h <= effect.y;
}

function updateDungeonBossEffects(target) {
  for (const effect of dungeonBossEffects.slice()) {
    effect.timer--;
    if (effect.state === 'warning' && effect.timer <= 0) {
      effect.state = 'active'; effect.timer = effect.activeFrames; effect.hit = false;
      beep(190, 0.08, 'sawtooth', 0.035);
    } else if (effect.state === 'active') {
      if (!effect.hit && target.inv <= 0 && dungeonBossEffectHitsPlayer(effect, target)) {
        effect.hit = true;
        target.hazardSlowT = Math.max(target.hazardSlowT || 0, 60);
        const damage = Math.max(1, effect.damage - armorDef());
        if (dmgPlayer({ amount:damage, sourceName:effect.bossName + '的根鬚橫掃', sourceX:effect.x, heavy:effect.phase >= 3 })) return true;
      }
      if (effect.timer <= 0) {
        if (effect.lingerFrames > 0) { effect.state = 'thorns'; effect.timer = effect.lingerFrames; }
        else dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      }
    } else if (effect.state === 'thorns') {
      if (dungeonBossEffectHitsPlayer(effect, target)) target.hazardSlowT = Math.max(target.hazardSlowT || 0, 12);
      if (effect.timer <= 0) dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
    }
  }
  return false;
}

function drawDungeonBossEffects() {
  for (const effect of dungeonBossEffects) {
    const pulse = 0.55 + Math.sin(frame * 0.28 + effect.x * 0.01) * 0.18;
    if (effect.state === 'warning') {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#6b4b2a'; ctx.fillRect(effect.x - effect.w / 2, effect.y - 5, effect.w, 5);
      ctx.strokeStyle = '#d9c47a'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.strokeRect(effect.x - effect.w / 2, effect.y - 13, effect.w, 12); ctx.setLineDash([]);
    } else {
      const height = effect.state === 'active' ? 44 : 18;
      ctx.globalAlpha = effect.state === 'active' ? 1 : 0.78;
      ctx.fillStyle = effect.state === 'active' ? '#86cf45' : '#527b32';
      for (let x = effect.x - effect.w / 2 + 5; x < effect.x + effect.w / 2; x += 15) {
        ctx.beginPath(); ctx.moveTo(x - 6, effect.y); ctx.lineTo(x, effect.y - height); ctx.lineTo(x + 6, effect.y); ctx.fill();
      }
      ctx.fillStyle = '#6b4b2a'; ctx.fillRect(effect.x - effect.w / 2, effect.y - 5, effect.w, 5);
    }
    ctx.globalAlpha = 1;
  }
}

function drawDungeonBossSpecialTelegraph(boss) {
  if (!boss.specialAttack || boss.specialAttack.id !== 'seed_burst') return;
  const def = dungeonBossDef(boss.bossId);
  const count = boss.phase >= 3 ? 7 : 5;
  ctx.save(); ctx.translate(boss.x, boss.y - boss.h - 18);
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI + (i + 1) * Math.PI / (count + 1);
    const radius = 30 + Math.sin(frame * 0.22 + i) * 3;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * 18;
    ctx.fillStyle = i % 2 ? '#d8ef7b' : '#9bdd4f';
    ctx.fillRect(x - 4, y - 6, 8, 12); ctx.fillStyle = def.accent; ctx.fillRect(x - 1, y - 8, 2, 4);
  }
  ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText('種子彈幕', 0, -25); ctx.restore(); ctx.textAlign = 'left';
}

function drawDungeonBossSprite(boss) {
  if (!boss || boss.bossId !== 'meadow_lord') return false;
  const def = dungeonBossDef(boss.bossId);
  const flash = boss.hitT > 0;
  ctx.save(); ctx.translate(Math.round(boss.x), Math.round(boss.y));
  if (boss.vx < 0) ctx.scale(-1, 1);
  ctx.fillStyle = flash ? '#fff' : '#6b4b2a';
  ctx.fillRect(-21, -39, 42, 34); ctx.fillRect(-31, -12, 18, 8); ctx.fillRect(13, -12, 18, 8);
  ctx.fillStyle = flash ? '#fff' : def.accent;
  ctx.fillRect(-36, -55, 72, 24); ctx.fillRect(-28, -65, 22, 16); ctx.fillRect(5, -68, 25, 18);
  ctx.fillStyle = flash ? '#fff' : def.color;
  ctx.fillRect(-43, -49, 20, 18); ctx.fillRect(23, -50, 20, 18); ctx.fillRect(-15, -72, 28, 25);
  ctx.fillStyle = '#161a18'; ctx.fillRect(-12, -34, 7, 7); ctx.fillRect(9, -34, 7, 7);
  ctx.fillStyle = '#d9ef9c'; ctx.fillRect(-10, -32, 3, 3); ctx.fillRect(11, -32, 3, 3);
  ctx.fillStyle = flash ? '#fff' : '#8b5a32'; ctx.fillRect(-4, -22, 15, 4);
  ctx.restore();
  return true;
}
