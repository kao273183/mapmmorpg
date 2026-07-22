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
      { id:'root_sweep', name:'根鬚橫掃', implemented:false },
      { id:'seed_burst', name:'種子彈幕', implemented:false }
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
