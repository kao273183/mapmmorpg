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
      { id:'marked_rockfall', name:'落石標記', implemented:true, warningFrames:60, activeFrames:28, recoveryFrames:72 },
      { id:'cavern_shockwave', name:'洞窟衝擊波', implemented:true, warningFrames:42, activeFrames:110, recoveryFrames:84 }
    ]
  },
  volcano_lord: {
    id:'volcano_lord', biomeId:'volcano', name:'熔岩魔王', firstFloor:15, color:'#ff6b2e', accent:'#c0301e',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet({ volleyBonus:2, volleySpeed:1.25 }), environmentId:'lava_vents',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'magma_charge', name:'熔岩衝鋒', implemented:true, warningFrames:48, recoveryFrames:78 },
      { id:'vent_chain', name:'連鎖噴發', implemented:true, warningFrames:45, activeFrames:30, cooldownFrames:96, recoveryFrames:84 }
    ]
  },
  tundra_lord: {
    id:'tundra_lord', biomeId:'tundra', name:'冰霜領主', firstFloor:20, color:'#9adcf0', accent:'#5a9ac0',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet({ projectileChill:true }), environmentId:'ice_floor',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'ice_lance', name:'寒冰槍陣', implemented:true, warningFrames:50, activeFrames:22, recoveryFrames:76 },
      { id:'blizzard_dash', name:'暴風突進', implemented:true, warningFrames:44, iceFrames:240, recoveryFrames:82 }
    ]
  },
  void_lord: {
    id:'void_lord', biomeId:'void', name:'深淵魔王', firstFloor:25, color:'#b05ae0', accent:'#7a2fa8',
    hpMultiplier:1.35, damageMultiplier:1, initialAttackFrames:120, warningFrames:36, recoveryMultiplier:1, leapRange:190,
    addCounts:[0, 2, 3], phases:dungeonBossPhaseSet({ volleyBonus:2, volleySpeed:1.25 }), environmentId:'void_platforms',
    arena:{ width:1300, platforms:[{ x:170, y:405, w:150 }, { x:980, y:405, w:150 }, { x:570, y:325, w:160 }] },
    legacyAttackId:'leap_volley',
    attackSlots:[
      { id:'void_barrage', name:'虛空彈幕', implemented:true, warningFrames:42, recoveryFrames:80 },
      { id:'platform_erasure', name:'平台消除', implemented:true, warningFrames:48, goneFrames:90, recoveryFrames:86 }
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
  const strengthMul = typeof dungeonBossStrengthMul === 'function' ? dungeonBossStrengthMul() : 1;
  const baseHp = 800 * scale * def.hpMultiplier * strengthMul;
  const baseDamage = 15 * scale * def.damageMultiplier * strengthMul;
  const hp = Math.round(typeof dungeonCurseBossStat === 'function' ? dungeonCurseBossStat(baseHp) : baseHp);
  const damage = Math.round(typeof dungeonCurseBossStat === 'function' ? dungeonCurseBossStat(baseDamage) : baseDamage);
  return {
    type:'boss', bossId:def.id, biomeId:def.biomeId, name:def.name, floor:atFloor,
    x:def.arena.width - 240, y:468, vx:0, vy:0, t:0, atkT:def.initialAttackFrames,
    tele:0, phase:1, phaseT:0, targetX:def.arena.width - 240, slamWarn:false,
    activeAttackId:null, attackCycle:0,
    hp, mhp:hp, xpv:Math.round(150 * (1 + 0.15 * (atFloor - 1))),
    dmg:damage, w:84, h:56, hitT:0, elite:true, s:7,
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
  for (const effect of dungeonBossEffects) {
    if (effect.type === 'void_platform_erasure' && effect.platform) {
      effect.platform.voidDisabled = false;
      effect.platform.bossVoidErased = false;
      effect.platform.bossVoidWarning = false;
    }
  }
  dungeonBossEffects.length = 0;
}

function dungeonBossAttackSlot(boss, attackId) {
  const def = dungeonBossDef(boss.bossId);
  return def.attackSlots.find(attack => attack.id === attackId) || null;
}

function dungeonBossAttackSequence(boss) {
  const def = dungeonBossDef(boss.bossId);
  if (def.id === 'meadow_lord') {
    if (boss.phase <= 1) return ['root_sweep', def.legacyAttackId];
    if (boss.phase === 2) return ['root_sweep', def.legacyAttackId, 'seed_burst'];
    return ['root_sweep', 'seed_burst', def.legacyAttackId];
  }
  if (def.id === 'cavern_lord') {
    if (boss.phase <= 1) return ['marked_rockfall', def.legacyAttackId];
    if (boss.phase === 2) return ['marked_rockfall', def.legacyAttackId, 'cavern_shockwave'];
    return ['marked_rockfall', 'cavern_shockwave', def.legacyAttackId];
  }
  if (def.id === 'volcano_lord') {
    if (boss.phase <= 1) return ['magma_charge', def.legacyAttackId];
    if (boss.phase === 2) return ['magma_charge', def.legacyAttackId, 'vent_chain'];
    return ['magma_charge', 'vent_chain', def.legacyAttackId];
  }
  if (def.id === 'tundra_lord') {
    if (boss.phase <= 1) return ['ice_lance', def.legacyAttackId];
    if (boss.phase === 2) return ['ice_lance', def.legacyAttackId, 'blizzard_dash'];
    return ['ice_lance', 'blizzard_dash', def.legacyAttackId];
  }
  if (def.id === 'void_lord') {
    if (boss.phase <= 1) return ['void_barrage', def.legacyAttackId];
    if (boss.phase === 2) return ['void_barrage', def.legacyAttackId, 'platform_erasure'];
    return ['void_barrage', 'platform_erasure', def.legacyAttackId];
  }
  return [def.legacyAttackId];
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

function cavernRockShelves(boss) {
  return dungeonBossDef(boss.bossId).arena.platforms.map(platform => ({
    x:platform.x - 18, y:platform.y, w:platform.w + 36
  }));
}

function cavernRockfallEffects(boss, target) {
  const slot = dungeonBossAttackSlot(boss, 'marked_rockfall');
  const count = boss.phase <= 1 ? 2 : boss.phase === 2 ? 3 : 4;
  const arenaWidth = dungeonBossDef(boss.bossId).arena.width;
  const shelves = cavernRockShelves(boss);
  const lanes = [90, 430, 835, 1210, 470, 880]
    .filter(x => !shelves.some(shelf => x >= shelf.x && x <= shelf.x + shelf.w))
    .sort((a, b) => Math.abs(a - target.x) - Math.abs(b - target.x));
  return lanes.slice(0, count).map((x, i) => ({
    type:'cavern_rockfall', bossId:boss.bossId, bossName:boss.name,
    x:Math.max(70, Math.min(arenaWidth - 70, x)), y:468, w:92,
    state:'warning', timer:slot.warningFrames + i * 8, activeFrames:slot.activeFrames,
    damage:Math.max(1, Math.round(boss.dmg * 0.88)), phase:boss.phase, hit:false
  }));
}

function fireCavernShockwave(boss) {
  const slot = dungeonBossAttackSlot(boss, 'cavern_shockwave');
  for (const direction of [-1, 1]) dungeonBossEffects.push({
    type:'cavern_wave', bossId:boss.bossId, bossName:boss.name,
    x:boss.x + direction * 46, y:468, w:76, direction, vx:direction * (boss.phase >= 3 ? 7.2 : 6),
    state:'active', timer:slot.activeFrames, activeFrames:slot.activeFrames,
    damage:Math.max(1, Math.round(boss.dmg * 0.78)), phase:boss.phase, hit:false
  });
  beep(125, 0.18, 'sawtooth', 0.05);
}

function volcanoChargePlan(boss, target) {
  const arenaWidth = dungeonBossDef(boss.bossId).arena.width;
  const desiredDirection = target.x < boss.x ? -1 : 1;
  const distance = boss.phase >= 3 ? 520 : boss.phase === 2 ? 450 : 380;
  let endX = Math.max(70, Math.min(arenaWidth - 70, boss.x + desiredDirection * distance));
  let direction = endX < boss.x ? -1 : 1;
  if (Math.abs(endX - boss.x) < 210) {
    endX = Math.max(70, Math.min(arenaWidth - 70, boss.x - desiredDirection * distance));
    direction = endX < boss.x ? -1 : 1;
  }
  return { direction, endX, speed:boss.phase >= 3 ? 10.5 : boss.phase === 2 ? 9.4 : 8.5 };
}

function volcanoVentChainEffects(boss, target) {
  const slot = dungeonBossAttackSlot(boss, 'vent_chain');
  const count = boss.phase >= 3 ? 6 : 4;
  const lanes = [150, 350, 550, 750, 950, 1150];
  const ordered = lanes.slice().sort((a, b) => Math.abs(a - target.x) - Math.abs(b - target.x));
  const selected = ordered.slice(0, count).sort((a, b) => boss.x > target.x ? a - b : b - a);
  return selected.map((x, i) => ({
    type:'volcano_vent', bossId:boss.bossId, bossName:boss.name,
    x, y:468, w:108, state:'warning', timer:slot.warningFrames + i * 16,
    activeFrames:slot.activeFrames, cooldownFrames:slot.cooldownFrames,
    damage:Math.max(1, Math.round(boss.dmg * 0.76)), phase:boss.phase, hit:false
  }));
}

function tundraIceLanceEffects(boss, target) {
  const slot = dungeonBossAttackSlot(boss, 'ice_lance');
  const count = boss.phase >= 3 ? 7 : boss.phase === 2 ? 5 : 3;
  const lanes = [100, 280, 460, 650, 840, 1020, 1200]
    .sort((a, b) => Math.abs(a - target.x) - Math.abs(b - target.x));
  return lanes.slice(0, count).map(x => ({
    type:'tundra_lance', bossId:boss.bossId, bossName:boss.name,
    x, y:468, w:86, state:'warning', timer:slot.warningFrames,
    activeFrames:slot.activeFrames, damage:Math.max(1, Math.round(boss.dmg * 0.7)),
    phase:boss.phase, hit:false
  }));
}

function tundraDashPlan(boss, target) {
  const arenaWidth = dungeonBossDef(boss.bossId).arena.width;
  const desiredDirection = target.x < boss.x ? -1 : 1;
  const distance = boss.phase >= 3 ? 560 : 480;
  let endX = Math.max(70, Math.min(arenaWidth - 70, boss.x + desiredDirection * distance));
  let direction = endX < boss.x ? -1 : 1;
  if (Math.abs(endX - boss.x) < 240) {
    endX = Math.max(70, Math.min(arenaWidth - 70, boss.x - desiredDirection * distance));
    direction = endX < boss.x ? -1 : 1;
  }
  return { direction, endX, speed:boss.phase >= 3 ? 10.2 : 8.8 };
}

function voidPlatformErasureEffects(boss, target, arenaPlatforms) {
  const slot = dungeonBossAttackSlot(boss, 'platform_erasure');
  const count = boss.phase >= 3 ? 2 : 1;
  const candidates = (arenaPlatforms || [])
    .filter(platform => !platform.ground && !platform.voidDisabled)
    .sort((a, b) => Math.abs((a.x + a.w / 2) - target.x) - Math.abs((b.x + b.w / 2) - target.x));
  return candidates.slice(0, count).map((platform, index) => {
    platform.bossVoidWarning = true;
    return {
      type:'void_platform_erasure', bossId:boss.bossId, bossName:boss.name,
      x:platform.x + platform.w / 2, y:platform.y, w:platform.w,
      state:'warning', timer:slot.warningFrames + index * 10, goneFrames:slot.goneFrames,
      platform, phase:boss.phase
    };
  });
}

function startDungeonBossSpecialAttack(boss, target, attackId, arenaPlatforms) {
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
  } else if (attackId === 'marked_rockfall') {
    const effects = cavernRockfallEffects(boss, target);
    dungeonBossEffects.push(...effects);
    boss.specialAttack = {
      id:attackId,
      timer:Math.max(...effects.map(effect => effect.timer)) + slot.activeFrames,
      recoveryFrames:slot.recoveryFrames
    };
  } else if (attackId === 'cavern_shockwave') {
    boss.specialAttack = { id:attackId, timer:slot.warningFrames, recoveryFrames:slot.recoveryFrames, fired:false };
  } else if (attackId === 'magma_charge') {
    const plan = volcanoChargePlan(boss, target);
    boss.specialAttack = Object.assign({
      id:attackId, state:'warning', timer:slot.warningFrames, recoveryFrames:slot.recoveryFrames,
      startX:boss.x, hit:false
    }, plan);
  } else if (attackId === 'vent_chain') {
    const effects = volcanoVentChainEffects(boss, target);
    dungeonBossEffects.push(...effects);
    boss.specialAttack = {
      id:attackId,
      timer:Math.max(...effects.map(effect => effect.timer)) + slot.activeFrames,
      recoveryFrames:slot.recoveryFrames
    };
  } else if (attackId === 'ice_lance') {
    const effects = tundraIceLanceEffects(boss, target);
    dungeonBossEffects.push(...effects);
    boss.specialAttack = {
      id:attackId, timer:slot.warningFrames + slot.activeFrames, recoveryFrames:slot.recoveryFrames
    };
  } else if (attackId === 'blizzard_dash') {
    const plan = tundraDashPlan(boss, target);
    boss.specialAttack = Object.assign({
      id:attackId, state:'warning', timer:slot.warningFrames, iceFrames:slot.iceFrames,
      recoveryFrames:slot.recoveryFrames, startX:boss.x, hit:false, iceCreated:false
    }, plan);
  } else if (attackId === 'void_barrage') {
    boss.specialAttack = { id:attackId, timer:slot.warningFrames, recoveryFrames:slot.recoveryFrames, fired:false };
  } else if (attackId === 'platform_erasure') {
    const effects = voidPlatformErasureEffects(boss, target, arenaPlatforms);
    if (!effects.length) { boss.activeAttackId = null; return false; }
    dungeonBossEffects.push(...effects);
    boss.specialAttack = {
      id:attackId,
      timer:Math.max(...effects.map(effect => effect.timer)) + slot.goneFrames,
      recoveryFrames:slot.recoveryFrames
    };
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

function fireVoidBarrage(boss, target) {
  const count = boss.phase >= 3 ? 9 : boss.phase === 2 ? 7 : 5;
  const centerVx = (target.x - boss.x) / 62;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    espits.push({
      x:boss.x, y:boss.y - boss.h + 4,
      vx:centerVx + offset * 0.76,
      vy:-6.8 - Math.abs(offset) * 0.25,
      dmg:Math.max(1, Math.round(boss.dmg * 0.64)),
      col:'#b05ae0', voidBolt:true, heavy:boss.phase >= 3,
      ownerName:boss.name, sourceName:boss.name + '的虛空彈幕'
    });
  }
  beep(285, 0.16, 'square', 0.045);
}

function volcanoChargeHitsPlayer(boss, target) {
  return target.x + target.w / 2 >= boss.x - boss.w / 2
    && target.x - target.w / 2 <= boss.x + boss.w / 2
    && target.y >= boss.y - boss.h && target.y - target.h <= boss.y;
}

function updateVolcanoMagmaCharge(boss, target, attack) {
  if (attack.visualHold) return false;
  attack.timer--;
  if (attack.state === 'warning' && attack.timer <= 0) {
    attack.state = 'active';
    attack.timer = Math.max(1, Math.ceil(Math.abs(attack.endX - boss.x) / attack.speed));
    beep(155, 0.16, 'sawtooth', 0.055);
    return false;
  }
  if (attack.state !== 'active') return false;
  boss.x += attack.direction * attack.speed;
  if ((attack.direction < 0 && boss.x <= attack.endX) || (attack.direction > 0 && boss.x >= attack.endX)) {
    boss.x = attack.endX; attack.timer = 0;
  }
  if (!attack.hit && target.inv <= 0 && volcanoChargeHitsPlayer(boss, target)) {
    attack.hit = true;
    target.vx = attack.direction * 7; target.vy = -5; target.onGround = false;
    const damage = Math.max(1, Math.round(boss.dmg * 0.92) - armorDef());
    return dmgPlayer({ amount:damage, sourceName:boss.name + '的熔岩衝鋒', sourceX:boss.x, heavy:true });
  }
  return false;
}

function createTundraIceTrail(boss, attack) {
  const left = Math.min(attack.startX, attack.endX) - 36;
  const right = Math.max(attack.startX, attack.endX) + 36;
  dungeonBossEffects.push({
    type:'tundra_ice', bossId:boss.bossId, bossName:boss.name,
    x:(left + right) / 2, y:468, w:right - left, state:'ice', timer:attack.iceFrames,
    phase:boss.phase
  });
  attack.iceCreated = true;
}

function updateTundraBlizzardDash(boss, target, attack) {
  if (attack.visualHold) return false;
  attack.timer--;
  if (attack.state === 'warning' && attack.timer <= 0) {
    attack.state = 'active';
    attack.timer = Math.max(1, Math.ceil(Math.abs(attack.endX - boss.x) / attack.speed));
    if (!attack.iceCreated) createTundraIceTrail(boss, attack);
    beep(520, 0.16, 'sawtooth', 0.05);
    return false;
  }
  if (attack.state !== 'active') return false;
  boss.x += attack.direction * attack.speed;
  if ((attack.direction < 0 && boss.x <= attack.endX) || (attack.direction > 0 && boss.x >= attack.endX)) {
    boss.x = attack.endX; attack.timer = 0;
  }
  if (!attack.hit && target.inv <= 0 && volcanoChargeHitsPlayer(boss, target)) {
    attack.hit = true;
    target.vx = attack.direction * 6; target.vy = -4; target.onGround = false;
    target.chillT = Math.max(target.chillT || 0, 90);
    const damage = Math.max(1, Math.round(boss.dmg * 0.82) - armorDef());
    return dmgPlayer({ amount:damage, sourceName:boss.name + '的暴風突進', sourceX:boss.x, heavy:boss.phase >= 3 });
  }
  return false;
}

function updateDungeonBossSpecialAttack(boss, target) {
  const attack = boss.specialAttack;
  if (!attack) return { handled:false, playerDied:false };
  boss.vx = 0;
  let playerDied = false;
  if (attack.id === 'magma_charge') playerDied = updateVolcanoMagmaCharge(boss, target, attack);
  else if (attack.id === 'blizzard_dash') playerDied = updateTundraBlizzardDash(boss, target, attack);
  else attack.timer--;
  if (attack.id === 'seed_burst' && attack.timer <= 0 && !attack.fired) {
    attack.fired = true;
    fireMeadowSeedBurst(boss, target);
  }
  if (attack.id === 'cavern_shockwave' && attack.timer <= 0 && !attack.fired) {
    attack.fired = true;
    fireCavernShockwave(boss);
  }
  if (attack.id === 'void_barrage' && attack.timer <= 0 && !attack.fired) {
    attack.fired = true;
    fireVoidBarrage(boss, target);
  }
  if (attack.timer <= 0) {
    boss.atkT = attack.recoveryFrames;
    boss.specialAttack = null;
    boss.activeAttackId = null;
  }
  return { handled:true, playerDied };
}

function dungeonBossEffectHitsPlayer(effect, target) {
  return target.x + target.w / 2 >= effect.x - effect.w / 2
    && target.x - target.w / 2 <= effect.x + effect.w / 2
    && target.y >= effect.y - (effect.state === 'active' ? 46 : 20)
    && target.y - target.h <= effect.y;
}

function cavernBossEffectHitsPlayer(effect, target) {
  if (target.y < 422) return false; // 岩棚上的角色安全，不受地面落石與衝擊波命中。
  return target.x + target.w / 2 >= effect.x - effect.w / 2
    && target.x - target.w / 2 <= effect.x + effect.w / 2
    && target.y >= effect.y - 54 && target.y - target.h <= effect.y;
}

function volcanoVentHitsPlayer(effect, target) {
  return target.x + target.w / 2 >= effect.x - effect.w / 2
    && target.x - target.w / 2 <= effect.x + effect.w / 2
    && target.y >= effect.y - 78 && target.y - target.h <= effect.y;
}

function tundraIceLanceHitsPlayer(effect, target) {
  return target.x + target.w / 2 >= effect.x - effect.w / 2
    && target.x - target.w / 2 <= effect.x + effect.w / 2
    && target.y >= effect.y - 74 && target.y - target.h <= effect.y;
}

function playerOnDungeonBossIce(target) {
  if (!target.onGround) return false;
  return dungeonBossEffects.some(effect => effect.type === 'tundra_ice' && effect.timer > 0
    && Math.abs(target.y - effect.y) < 3
    && target.x >= effect.x - effect.w / 2 && target.x <= effect.x + effect.w / 2);
}

function updateDungeonBossEffects(target) {
  for (const effect of dungeonBossEffects.slice()) {
    effect.timer--;
    if (effect.type === 'void_platform_erasure') {
      if (effect.state === 'warning' && effect.timer <= 0) {
        effect.state = 'active'; effect.timer = effect.goneFrames;
        effect.platform.bossVoidWarning = false;
        effect.platform.bossVoidErased = true;
        effect.platform.voidDisabled = true;
        beep(175, 0.12, 'sawtooth', 0.04);
      } else if (effect.state === 'active' && effect.timer <= 0) {
        effect.platform.voidDisabled = false;
        effect.platform.bossVoidErased = false;
        effect.platform.bossVoidWarning = false;
        dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      }
      continue;
    }
    if (effect.type === 'tundra_ice') {
      if (effect.timer <= 0) dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      continue;
    }
    if (effect.type === 'tundra_lance') {
      if (effect.state === 'warning' && effect.timer <= 0) {
        effect.state = 'active'; effect.timer = effect.activeFrames; effect.hit = false;
        beep(610, 0.08, 'square', 0.035);
      } else if (effect.state === 'active') {
        if (!effect.hit && target.inv <= 0 && tundraIceLanceHitsPlayer(effect, target)) {
          effect.hit = true; target.chillT = Math.max(target.chillT || 0, 60);
          const damage = Math.max(1, effect.damage - armorDef());
          if (dmgPlayer({ amount:damage, sourceName:effect.bossName + '的寒冰槍陣', sourceX:effect.x, heavy:effect.phase >= 3 })) return true;
        }
        if (effect.timer <= 0) dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      }
      continue;
    }
    if (effect.type === 'volcano_vent') {
      if (effect.state === 'warning' && effect.timer <= 0) {
        effect.state = 'active'; effect.timer = effect.activeFrames; effect.hit = false;
        beep(220, 0.09, 'square', 0.04);
      } else if (effect.state === 'active') {
        if (!effect.hit && target.inv <= 0 && volcanoVentHitsPlayer(effect, target)) {
          effect.hit = true; target.vy = -4; target.onGround = false;
          const damage = Math.max(1, effect.damage - armorDef());
          if (dmgPlayer({ amount:damage, sourceName:effect.bossName + '的連鎖噴發', sourceX:effect.x, heavy:effect.phase >= 3 })) return true;
        }
        if (effect.timer <= 0) { effect.state = 'cooldown'; effect.timer = effect.cooldownFrames; }
      } else if (effect.state === 'cooldown' && effect.timer <= 0) {
        dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      }
      continue;
    }
    if (effect.type === 'cavern_wave') {
      effect.x += effect.vx;
      if (!effect.hit && target.inv <= 0 && cavernBossEffectHitsPlayer(effect, target)) {
        effect.hit = true;
        const damage = Math.max(1, effect.damage - armorDef());
        target.vx = effect.direction * 5; target.vy = -4;
        if (dmgPlayer({ amount:damage, sourceName:effect.bossName + '的洞窟衝擊波', sourceX:effect.x, heavy:effect.phase >= 3 })) return true;
      }
      if (effect.timer <= 0 || effect.x < -80 || effect.x > dungeonBossDef(effect.bossId).arena.width + 80) dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      continue;
    }
    if (effect.state === 'warning' && effect.timer <= 0) {
      effect.state = 'active'; effect.timer = effect.activeFrames; effect.hit = false;
      beep(190, 0.08, 'sawtooth', 0.035);
    } else if (effect.state === 'active') {
      const hits = effect.type === 'cavern_rockfall'
        ? effect.timer <= 1 && cavernBossEffectHitsPlayer(effect, target)
        : dungeonBossEffectHitsPlayer(effect, target);
      if (!effect.hit && target.inv <= 0 && hits) {
        effect.hit = true;
        const damage = Math.max(1, effect.damage - armorDef());
        if (effect.type === 'cavern_rockfall') {
          target.vx = (target.x < effect.x ? -1 : 1) * 3.5;
          if (dmgPlayer({ amount:damage, sourceName:effect.bossName + '的落石標記', sourceX:effect.x, heavy:effect.phase >= 3 })) return true;
        } else {
          target.hazardSlowT = Math.max(target.hazardSlowT || 0, 60);
          if (dmgPlayer({ amount:damage, sourceName:effect.bossName + '的根鬚橫掃', sourceX:effect.x, heavy:effect.phase >= 3 })) return true;
        }
      }
      if (effect.timer <= 0) {
        if (effect.type === 'meadow_root' && effect.lingerFrames > 0) { effect.state = 'thorns'; effect.timer = effect.lingerFrames; }
        else dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
      }
    } else if (effect.state === 'thorns') {
      if (dungeonBossEffectHitsPlayer(effect, target)) target.hazardSlowT = Math.max(target.hazardSlowT || 0, 12);
      if (effect.timer <= 0) dungeonBossEffects.splice(dungeonBossEffects.indexOf(effect), 1);
    }
  }
  return false;
}

function drawCavernSafeShelves() {
  const def = dungeonBossDef('cavern_lord');
  ctx.globalAlpha = 0.34 + Math.sin(frame * 0.16) * 0.08;
  for (const shelf of cavernRockShelves({ bossId:'cavern_lord' })) {
    ctx.fillStyle = '#b9f3ff'; ctx.fillRect(shelf.x + 18, shelf.y - 5, shelf.w - 36, 5);
    ctx.fillStyle = def.color; ctx.fillRect(shelf.x + 28, shelf.y - 10, shelf.w - 56, 3);
  }
  ctx.globalAlpha = 1;
}

function drawDungeonBossEffects() {
  const cavernActive = dungeonBossEffects.some(effect => effect.bossId === 'cavern_lord');
  if (cavernActive) drawCavernSafeShelves();
  const voidActive = dungeonBossEffects.some(effect => effect.type === 'void_platform_erasure');
  if (voidActive) {
    ctx.globalAlpha = 0.72; ctx.fillStyle = '#7dffd6'; ctx.fillRect(0, 462, dungeonBossDef('void_lord').arena.width, 6);
    ctx.fillStyle = '#d8fff4'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('穩定地面', dungeonBossDef('void_lord').arena.width / 2, 454); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  for (const effect of dungeonBossEffects) {
    const pulse = 0.55 + Math.sin(frame * 0.28 + effect.x * 0.01) * 0.18;
    if (effect.type === 'void_platform_erasure') {
      ctx.globalAlpha = effect.state === 'warning' ? pulse : 0.28;
      ctx.fillStyle = effect.state === 'warning' ? '#d9a8ff' : '#7a2fa8';
      ctx.fillRect(effect.platform.x, effect.platform.y - 5, effect.platform.w, 11);
      ctx.strokeStyle = effect.state === 'warning' ? '#fff2a8' : '#d9a8ff'; ctx.lineWidth = 3;
      ctx.setLineDash(effect.state === 'warning' ? [8, 6] : [5, 8]);
      ctx.strokeRect(effect.platform.x, effect.platform.y - 8, effect.platform.w, 17); ctx.setLineDash([]);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 10px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText(effect.state === 'warning' ? '平台即將消除' : '平台已消除', effect.x, effect.platform.y - 14); ctx.textAlign = 'left';
    } else if (effect.type === 'tundra_ice') {
      const left = effect.x - effect.w / 2;
      ctx.globalAlpha = 0.72; ctx.fillStyle = '#bdefff'; ctx.fillRect(left, effect.y - 8, effect.w, 8);
      ctx.fillStyle = '#e9fbff'; ctx.fillRect(left + 4, effect.y - 8, effect.w - 8, 2);
      ctx.strokeStyle = '#6eb9d8'; ctx.lineWidth = 2;
      for (let x = left + 24; x < left + effect.w - 10; x += 48) {
        ctx.beginPath(); ctx.moveTo(x, effect.y - 7); ctx.lineTo(x + 9, effect.y - 2); ctx.lineTo(x + 17, effect.y - 7); ctx.stroke();
      }
    } else if (effect.type === 'tundra_lance') {
      const left = effect.x - effect.w / 2;
      if (effect.state === 'warning') {
        ctx.globalAlpha = pulse; ctx.fillStyle = '#9adcf0'; ctx.fillRect(left, effect.y - 9, effect.w, 9);
        ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
        ctx.strokeRect(left, effect.y - 14, effect.w, 13); ctx.setLineDash([]);
      } else {
        ctx.globalAlpha = 0.94; ctx.fillStyle = '#6eb9d8';
        ctx.beginPath(); ctx.moveTo(left, effect.y); ctx.lineTo(effect.x - 15, effect.y - 58); ctx.lineTo(effect.x, effect.y - 78); ctx.lineTo(effect.x + 15, effect.y - 58); ctx.lineTo(left + effect.w, effect.y); ctx.fill();
        ctx.fillStyle = '#e9fbff'; ctx.beginPath(); ctx.moveTo(effect.x - 8, effect.y - 12); ctx.lineTo(effect.x, effect.y - 67); ctx.lineTo(effect.x + 8, effect.y - 12); ctx.fill();
      }
    } else if (effect.type === 'volcano_vent') {
      const left = effect.x - effect.w / 2;
      ctx.fillStyle = '#4b2520'; ctx.fillRect(left, effect.y - 8, effect.w, 8);
      if (effect.state === 'warning') {
        ctx.globalAlpha = pulse; ctx.fillStyle = '#ff8a2b'; ctx.fillRect(left + 5, effect.y - 15, effect.w - 10, 12);
        ctx.globalAlpha = 1; ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
        ctx.strokeRect(left, effect.y - 17, effect.w, 16); ctx.setLineDash([]);
      } else if (effect.state === 'active') {
        ctx.globalAlpha = 0.95; ctx.fillStyle = '#ff4b1f'; ctx.fillRect(left + 7, effect.y - 62, effect.w - 14, 58);
        ctx.fillStyle = '#ffd45f'; ctx.fillRect(left + 22, effect.y - 80, effect.w - 44, 76);
        ctx.fillStyle = '#fff2a8'; ctx.fillRect(effect.x - 6, effect.y - 68, 12, 64);
      } else {
        ctx.globalAlpha = 0.7; ctx.fillStyle = '#312f3a'; ctx.fillRect(left + 5, effect.y - 12, effect.w - 10, 8);
        ctx.strokeStyle = '#b9f3ff'; ctx.lineWidth = 2; ctx.strokeRect(left, effect.y - 15, effect.w, 14);
        ctx.fillStyle = '#d6f6ff'; ctx.font = 'bold 10px "Courier New",monospace'; ctx.textAlign = 'center';
        ctx.fillText('安全窗', effect.x, effect.y - 21); ctx.textAlign = 'left';
      }
    } else if (effect.type === 'cavern_rockfall') {
      if (effect.state === 'warning') {
        ctx.globalAlpha = pulse; ctx.fillStyle = '#d8b76a';
        ctx.beginPath(); ctx.ellipse(effect.x, effect.y - 3, effect.w / 2, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.ellipse(effect.x, effect.y - 3, effect.w / 2, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#efe8dc'; ctx.fillRect(effect.x - 10, 92 + (effect.timer % 18), 20, 13);
      } else {
        const progress = 1 - Math.max(0, effect.timer) / Math.max(1, effect.activeFrames);
        const rockY = 80 + progress * 365;
        ctx.globalAlpha = 0.92; ctx.fillStyle = '#665e72'; ctx.fillRect(effect.x - 26, rockY - 23, 52, 46);
        ctx.fillStyle = '#9589aa'; ctx.fillRect(effect.x - 17, rockY - 17, 23, 12);
        ctx.fillStyle = '#3f3948'; ctx.fillRect(effect.x + 7, rockY + 2, 14, 13);
      }
    } else if (effect.type === 'cavern_wave') {
      ctx.globalAlpha = 0.88; ctx.fillStyle = '#8a7aa8';
      ctx.beginPath(); ctx.moveTo(effect.x - effect.w / 2, effect.y); ctx.lineTo(effect.x - 18, effect.y - 40); ctx.lineTo(effect.x, effect.y - 18); ctx.lineTo(effect.x + 18, effect.y - 52); ctx.lineTo(effect.x + effect.w / 2, effect.y); ctx.fill();
      ctx.strokeStyle = '#d8cced'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(effect.x - effect.w / 2, effect.y - 4); ctx.lineTo(effect.x + effect.w / 2, effect.y - 4); ctx.stroke();
    } else if (effect.state === 'warning') {
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
  if (!boss.specialAttack) return;
  const def = dungeonBossDef(boss.bossId);
  if (boss.specialAttack.id === 'magma_charge') {
    const attack = boss.specialAttack;
    ctx.save();
    if (attack.state === 'warning') {
      const left = Math.min(boss.x, attack.endX), width = Math.abs(attack.endX - boss.x);
      ctx.globalAlpha = 0.24 + Math.sin(frame * 0.4) * 0.08; ctx.fillStyle = '#ff6b2e';
      ctx.fillRect(left, 438, width, 30); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.strokeRect(left, 438, width, 28); ctx.setLineDash([]);
      ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('熔岩衝鋒', left + width / 2, 430); ctx.textAlign = 'left';
    } else {
      ctx.globalAlpha = 0.76; ctx.fillStyle = '#ff5a24';
      for (let i = 1; i <= 4; i++) {
        const x = boss.x - attack.direction * (28 + i * 20);
        ctx.beginPath(); ctx.moveTo(x - 10, 466); ctx.lineTo(x, 438 + i * 3); ctx.lineTo(x + 10, 466); ctx.fill();
      }
    }
    ctx.restore(); return;
  }
  if (boss.specialAttack.id === 'blizzard_dash') {
    const attack = boss.specialAttack;
    ctx.save();
    if (attack.state === 'warning') {
      const left = Math.min(boss.x, attack.endX), width = Math.abs(attack.endX - boss.x);
      ctx.globalAlpha = 0.25 + Math.sin(frame * 0.42) * 0.08; ctx.fillStyle = '#9adcf0';
      ctx.fillRect(left, 438, width, 30); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e9fbff'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]); ctx.strokeRect(left, 438, width, 28); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('暴風突進 · 反向煞車', left + width / 2, 430); ctx.textAlign = 'left';
    } else {
      ctx.globalAlpha = 0.78; ctx.fillStyle = '#dff8ff';
      for (let i = 1; i <= 5; i++) {
        const x = boss.x - attack.direction * (24 + i * 18), y = 450 - (i % 2) * 10;
        ctx.fillRect(x - 7, y - 3, 14, 6); ctx.fillRect(x - 3, y - 7, 6, 14);
      }
    }
    ctx.restore(); return;
  }
  if (boss.specialAttack.id === 'void_barrage') {
    const count = boss.phase >= 3 ? 9 : boss.phase === 2 ? 7 : 5;
    ctx.save(); ctx.translate(boss.x, boss.y - boss.h - 18);
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + frame * 0.035;
      const radius = 29 + (i % 2) * 7;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * 16;
      ctx.fillStyle = i % 2 ? '#d9a8ff' : '#b05ae0';
      ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('虛空彈幕', 0, -28); ctx.restore(); ctx.textAlign = 'left'; return;
  }
  if (boss.specialAttack.id === 'cavern_shockwave') {
    drawCavernSafeShelves();
    ctx.save(); ctx.translate(boss.x, boss.y - boss.h - 20);
    const radius = 22 + Math.sin(frame * 0.35) * 4;
    ctx.strokeStyle = '#d8cced'; ctx.lineWidth = 4;
    for (const direction of [-1, 1]) {
      ctx.beginPath(); ctx.arc(direction * 12, 10, radius, -0.85, 0.85); ctx.stroke();
    }
    ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('跳上岩棚', 0, -25); ctx.restore(); ctx.textAlign = 'left';
    return;
  }
  if (boss.specialAttack.id !== 'seed_burst') return;
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
  if (!boss || !['meadow_lord','cavern_lord','volcano_lord','tundra_lord','void_lord'].includes(boss.bossId)) return false;
  const def = dungeonBossDef(boss.bossId);
  const flash = boss.hitT > 0;
  ctx.save(); ctx.translate(Math.round(boss.x), Math.round(boss.y));
  if (boss.vx < 0) ctx.scale(-1, 1);
  if (boss.bossId === 'void_lord') {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#d9a8ff'; ctx.fillRect(-43, -42, 86, 36); ctx.globalAlpha = 1;
    ctx.fillStyle = flash ? '#fff' : '#251532';
    ctx.fillRect(-34, -35, 68, 30); ctx.fillRect(-47, -24, 21, 16); ctx.fillRect(26, -24, 21, 16);
    ctx.fillStyle = flash ? '#fff' : def.accent;
    ctx.fillRect(-30, -58, 60, 30); ctx.fillRect(-40, -61, 18, 22); ctx.fillRect(22, -61, 18, 22);
    ctx.fillStyle = flash ? '#fff' : def.color;
    ctx.fillRect(-22, -70, 44, 21); ctx.fillRect(-36, -72, 13, 18); ctx.fillRect(23, -72, 13, 18);
    ctx.fillStyle = '#f0d8ff'; ctx.fillRect(-16, -48, 9, 8); ctx.fillRect(8, -48, 9, 8); ctx.fillRect(-8, -28, 20, 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(-13, -46, 4, 4); ctx.fillRect(11, -46, 4, 4);
    ctx.restore(); return true;
  }
  if (boss.bossId === 'tundra_lord') {
    ctx.fillStyle = flash ? '#fff' : '#315d78';
    ctx.fillRect(-34, -35, 68, 30); ctx.fillRect(-45, -25, 19, 17); ctx.fillRect(26, -25, 19, 17);
    ctx.fillStyle = flash ? '#fff' : def.accent;
    ctx.fillRect(-30, -57, 60, 29); ctx.fillRect(-39, -62, 17, 23); ctx.fillRect(22, -62, 17, 23);
    ctx.fillStyle = flash ? '#fff' : def.color;
    ctx.fillRect(-21, -68, 42, 19); ctx.fillRect(-35, -78, 13, 23); ctx.fillRect(22, -78, 13, 23);
    ctx.fillStyle = '#e9fbff'; ctx.fillRect(-16, -48, 9, 8); ctx.fillRect(8, -48, 9, 8); ctx.fillRect(-8, -28, 20, 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(-13, -46, 4, 4); ctx.fillRect(11, -46, 4, 4);
    ctx.restore(); return true;
  }
  if (boss.bossId === 'volcano_lord') {
    ctx.fillStyle = flash ? '#fff' : '#4a201c';
    ctx.fillRect(-34, -35, 68, 30); ctx.fillRect(-46, -25, 20, 17); ctx.fillRect(26, -25, 20, 17);
    ctx.fillStyle = flash ? '#fff' : def.accent;
    ctx.fillRect(-30, -57, 60, 29); ctx.fillRect(-38, -62, 17, 22); ctx.fillRect(21, -62, 17, 22);
    ctx.fillStyle = flash ? '#fff' : def.color;
    ctx.fillRect(-21, -68, 42, 19); ctx.fillRect(-34, -74, 12, 18); ctx.fillRect(22, -74, 12, 18);
    ctx.fillStyle = '#ffd45f'; ctx.fillRect(-16, -48, 9, 8); ctx.fillRect(8, -48, 9, 8); ctx.fillRect(-8, -28, 20, 5);
    ctx.fillStyle = '#fff2a8'; ctx.fillRect(-13, -46, 4, 4); ctx.fillRect(11, -46, 4, 4);
    ctx.restore(); return true;
  }
  if (boss.bossId === 'cavern_lord') {
    ctx.fillStyle = flash ? '#fff' : '#3f3948';
    ctx.fillRect(-34, -34, 68, 29); ctx.fillRect(-45, -24, 18, 16); ctx.fillRect(27, -24, 18, 16);
    ctx.fillStyle = flash ? '#fff' : def.accent;
    ctx.fillRect(-29, -56, 58, 28); ctx.fillRect(-38, -49, 16, 19); ctx.fillRect(22, -49, 16, 19);
    ctx.fillStyle = flash ? '#fff' : def.color;
    ctx.fillRect(-19, -68, 38, 18); ctx.fillRect(-27, -58, 14, 14); ctx.fillRect(13, -58, 14, 14);
    ctx.fillStyle = '#1a1523'; ctx.fillRect(-16, -47, 9, 8); ctx.fillRect(8, -47, 9, 8);
    ctx.fillStyle = '#b9f3ff'; ctx.fillRect(-13, -45, 4, 4); ctx.fillRect(10, -45, 4, 4);
    ctx.fillStyle = '#c7badc'; ctx.fillRect(-4, -30, 15, 5);
    ctx.restore(); return true;
  }
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
