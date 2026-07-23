"use strict";
// ---------- floor generation ----------
function monsterHp(base, sc, n, extraMul = 1) {
  const endurance = 1.5 + Math.min(0.75, 0.025 * (n - 1));
  const hp = base * sc * endurance * extraMul;
  return Math.round(typeof dungeonCurseBaseEnemyHp === 'function' ? dungeonCurseBaseEnemyHp(hp) : hp);
}
function spawnMon(type, n, sc, xpSc, eliteCh, rng) {
  rng = rng || Math.random;
  if (type === 'bat') {
    const bx = 350 + rng() * (worldW - 550);
    const by = 170 + rng() * 140;
    const hp = monsterHp(20, sc, n);
    mons.push({ type:'bat', x: bx, y: by, ax: bx, ay: by, t: rng() * 200,
      hp, mhp: hp, xpv: Math.round(16 * xpSc),
      dmg: Math.round(10 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  const wide = plats.filter(q => !q.ground && q.w > 120);
  const pl = (rng() < 0.62 || wide.length === 0) ? plats[0] : wide[(rng() * wide.length) | 0]; // 6 成生在地面,其餘上平台
  const sx = pl.ground ? 200 + rng() * (worldW - 350) : pl.x + 30 + rng() * (pl.w - 60);
  const minx = Math.max(pl.x + 20, sx - 140), maxx = Math.min(pl.x + pl.w - 20, sx + 140);
  if (type === 'mush') {
    const hp = monsterHp(30, sc, n);
    mons.push({ type:'mush', x: sx, y: pl.y, baseY: pl.y, vx: (0.4 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1), vy: 0, onG: true, jt: 30 + rng() * 60,
      minx, maxx, hp, mhp: hp, xpv: Math.round(14 * xpSc), dmg: Math.round(9 * sc), w: 34, h: 24, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'spore') {
    const hp = monsterHp(22, sc, n);
    mons.push({ type:'spore', x: sx, y: pl.y, vx: (0.3 + rng() * 0.25) * (rng() < 0.5 ? -1 : 1), st: 60 + rng() * 60,
      minx, maxx, hp, mhp: hp, xpv: Math.round(18 * xpSc), dmg: Math.round(9 * sc), w: 34, h: 24, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'bomber') {
    const hp = monsterHp(24, sc, n);
    mons.push({ type:'bomber', x: sx, y: pl.y, baseY: pl.y, vx: 0, fuse: null, boom: false,
      minx, maxx, hp, mhp: hp, xpv: Math.round(16 * xpSc), dmg: Math.round(7 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'charger') {
    const hp = monsterHp(34, sc, n);
    mons.push({ type:'charger', x: sx, y: pl.y, vx: (0.4 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1), chg: 0, tel: 0, dir: 1,
      minx, maxx, hp, mhp: hp, xpv: Math.round(16 * xpSc), dmg: Math.round(9 * sc), w: 36, h: 20, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'icer') {
    const hp = monsterHp(28, sc, n);
    mons.push({ type:'icer', x: sx, y: pl.y, vx: (0.5 + rng() * 0.4) * (rng() < 0.5 ? -1 : 1),
      minx, maxx, hp, mhp: hp, xpv: Math.round(13 * xpSc), dmg: Math.round(8 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'splitter') {
    const hp = monsterHp(30, sc, n);
    mons.push({ type:'splitter', x: sx, y: pl.y, baseY: pl.y, vx: (0.4 + rng() * 0.35) * (rng() < 0.5 ? -1 : 1), gen: 0,
      minx, maxx, hp, mhp: hp, xpv: Math.round(15 * xpSc), dmg: Math.round(8 * sc), w: 40, h: 26, hitT: 0, elite: false, s: 4 });
    return;
  }
  const elite = rng() < eliteCh;
  let hp = monsterHp(26, sc, n, elite ? 3.2 : 1);
  let damage = 8 * sc * (elite ? 1.6 : 1);
  if (elite && typeof dungeonCurseEliteStat === 'function') {
    hp = Math.round(dungeonCurseEliteStat(hp));
    damage = dungeonCurseEliteStat(damage);
  }
  mons.push({ type:'slime', x: sx, y: pl.y, vx: (0.5 + rng() * 0.4) * (rng() < 0.5 ? -1 : 1),
    minx, maxx, hp, mhp: hp, xpv: Math.round(12 * xpSc * (elite ? 3 : 1)),
    dmg: Math.round(damage),
    w: elite ? 46 : 34, h: elite ? 30 : 22, hitT: 0, elite: elite, s: elite ? 4 : 3 });
}
function currentFloorEventDef() {
  return floorEvent && DUNGEON_EVENT_DEFS[floorEvent.eventId] || null;
}
function floorEventState() {
  return { player, meta, souls:soulsRun, status:floorEvent ? floorEvent.status : 'idle' };
}
function openFloorEvent() {
  if (!floorEvent) return false;
  if (Math.abs(player.x - floorEvent.x) > 54 || Math.abs(player.y - floorEvent.y) > 52) return false;
  if (floorEvent.status !== 'idle') {
    if (!floorEvent.feedbackFrame || frame - floorEvent.feedbackFrame > 60) {
      const used = floorEvent.status === 'declined' ? '已拒絕，本房不再互動' : floorEvent.status === 'combat' || floorEvent.status === 'challenge' ? '事件戰鬥進行中' : '事件已完成，獎勵不會重複發放';
      num(floorEvent.x, floorEvent.y - 92, used, floorEvent.status === 'declined' ? '#9299b9' : '#ffd36a');
      floorEvent.feedbackFrame = frame;
      playSfx('uiError', 0.45, 0.9);
    }
    keys.space = false;
    return false;
  }
  eventPanel = { eventId:floorEvent.eventId };
  player.itemWin = false; keys.space = false;
  beep(620, 0.08, 'sine', 0.035);
  return true;
}
function spawnEventMimic() {
  const sc = (1 + 0.3 * (floor - 1) + 0.02 * (floor - 1) * (floor - 1)) * (floor >= 21 ? 1.15 : 1);
  const hp = monsterHp(52, sc, floor, 2.1);
  const x = floorEvent.x;
  mons.push({ type:'slime', mimic:true, x, y:468, vx:0.85, minx:Math.max(20, x - 210), maxx:Math.min(worldW - 20, x + 210),
    hp, mhp:hp, xpv:Math.round(30 * (1 + 0.15 * (floor - 1))), dmg:Math.round(12 * sc), w:52, h:34,
    hitT:0, elite:true, eventMon:true, s:4 });
  portal = null;
  burst(x, floorEvent.y - 30, '#ff8a6a', 28);
  beep(125, 0.24, 'sawtooth', 0.06);
}
function floorTrialEnemyCount() {
  return mons.filter(m => m.trialMon).length;
}
function spawnFloorTrialWave(count, wave) {
  const def = currentFloorEventDef();
  if (!def || !floorTrial || floorTrial.status !== 'active') return;
  const sc = (1 + 0.3 * (floor - 1) + 0.02 * (floor - 1) * (floor - 1)) * (floor >= 21 ? 1.15 : 1);
  const xpSc = 1 + 0.15 * (floor - 1);
  const rng = dungeonRoomRng(currentRoomSpec, 'trial-wave-' + wave);
  const pool = biomeOf(floor).pool.filter(type => type !== 'splitter');
  for (let i = 0; i < count; i++) {
    const before = mons.length;
    spawnMon(pool[(rng() * pool.length) | 0] || 'slime', floor, sc, xpSc, 0, rng);
    const m = mons[before];
    if (!m) continue;
    m.eventMon = true; m.trialMon = true; m.trialWave = wave;
    const elite = def.trialType === 'elite' || (def.trialType === 'hazard' && i === count - 1) || (def.trialType === 'timed' && wave === 2 && i === count - 1);
    if (elite) promoteDungeonElite(m);
  }
  portal = null;
  burst(floorEvent.x, floorEvent.y - 36, def.color, 24);
  num(floorEvent.x, floorEvent.y - 82, def.trialType === 'timed' ? '第 ' + wave + ' 波！' : '守衛現身！', def.color);
  beep(155, 0.18, 'sawtooth', 0.05);
}
function reopenDungeonRoomForTrial() {
  portal = null;
  if (dungeonRun && dungeonRun.completedFloor === floor) dungeonRun.completedFloor = 0;
}
function startFloorTrial() {
  const def = currentFloorEventDef();
  if (!def || def.family !== 'trial') return false;
  if (!floorTrial) floorTrial = createDungeonTrial(def, currentRoomSpec, player, worldW);
  if (!startDungeonTrial(floorTrial, def, player)) return false;
  reopenDungeonRoomForTrial();
  spawnFloorTrialWave(floorTrial.waves[0], 1);
  return true;
}
function declineFloorTrial() {
  if (!floorTrial) return false;
  const declined = declineDungeonTrial(floorTrial);
  if (declined && typeof recordDungeonTrialResult === 'function') recordDungeonTrialResult('declined');
  if (declined && mons.length === 0) completeDungeonRoom();
  return declined;
}
function releaseFloorTrialEnemies() {
  for (const m of mons) {
    if (!m.trialMon) continue;
    m.trialMon = false;
    m.eventMon = false;
  }
}
function grantFloorTrialReward() {
  if (!claimDungeonTrialReward(floorTrial)) return false;
  const dust = 2 + Math.floor(floor / 10);
  meta.mats.ench += dust;
  if (dungeonRun) dungeonRun.explorationScore += 2;
  saveMeta();
  dropFloorEventGear(floor >= 15 ? 3 : 2, 'event');
  burst(floorEvent.x, floorEvent.y - 38, '#ffd36a', 36);
  num(floorEvent.x, floorEvent.y - 88, '試煉成功！稀有裝備＋附魔塵 ×' + dust, '#ffd36a');
  playSfx('enhanceSuccess', 0.85, 1.08);
  return true;
}
function finishFloorTrial(transition) {
  if (!floorTrial || !transition) return;
  if (transition.action === 'success') {
    if (typeof recordDungeonTrialResult === 'function') recordDungeonTrialResult('success');
    if (floorEvent) floorEvent.status = 'done';
    grantFloorTrialReward();
  } else if (transition.action === 'failed') {
    if (typeof recordDungeonTrialResult === 'function') recordDungeonTrialResult('failed');
    if (floorEvent) floorEvent.status = 'done';
    releaseFloorTrialEnemies();
    const message = transition.reason === 'timeout' ? '時間到！轉為普通清房' : '無傷失敗！守衛仍需清除';
    num(floorEvent.x, floorEvent.y - 84, message, '#ff8a8a');
    playSfx('uiError', 0.8, 0.85);
  }
  if (mons.length === 0) completeDungeonRoom();
}
function updateFloorTrial(tickFrames) {
  if (!floorTrial || floorTrial.status !== 'active') return null;
  const transition = updateDungeonTrialState(floorTrial, {
    tickFrames:tickFrames == null ? 1 : tickFrames,
    remainingTrialEnemies:floorTrialEnemyCount(),
    playerX:player.x
  });
  if (!transition) return null;
  if (transition.action === 'spawn_wave') spawnFloorTrialWave(transition.count, transition.wave);
  else finishFloorTrial(transition);
  return transition;
}
function recordFloorTrialDamage(amount) {
  const transition = recordDungeonTrialDamage(floorTrial, amount);
  if (transition) finishFloorTrial(transition);
}
function dropFloorEventGear(minRarity, source) {
  const rarity = Math.max(minRarity || 0, rollRarity(floor));
  gearDrops.push({ x:floorEvent.x, y:floorEvent.y - 34, vy:-4, vx:0,
    it:genGear(floor, rarity, source || 'event'), t:1800, ground:468 });
  if (typeof recordDungeonReward === 'function') recordDungeonReward('gear', 1);
}
function chooseFloorEvent(choice) {
  if (!eventPanel || !floorEvent || floorEvent.status !== 'idle') { eventPanel = null; return; }
  const def = currentFloorEventDef();
  const options = dungeonEventOptionViews(def, currentRoomSpec, floorEventState());
  const selected = options[choice];
  if (!selected) return;
  if (!selected.enabled) {
    num(player.x, player.y - player.h - 18, selected.costType === 'souls' ? '靈魂不足' : 'HP 不足', '#ff8a8a');
    playSfx('uiError');
    return;
  }
  const materialsBefore = Object.values(meta.mats || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const soulsBefore = soulsRun;
  const outcome = runDungeonEventEffect(selected.effectId, def, currentRoomSpec, floorEventState(), {
    getSouls:() => soulsRun,
    spendSouls:amount => { soulsRun -= amount; },
    gainSouls:amount => { soulsRun += amount; },
    dropGear:dropFloorEventGear,
    spawnMimic:spawnEventMimic,
    startTrial:startFloorTrial,
    declineTrial:declineFloorTrial,
    save:saveMeta
  });
  if (!outcome.ok) {
    num(player.x, player.y - player.h - 18, outcome.message, outcome.color);
    playSfx('uiError');
    return;
  }
  if (typeof recordDungeonReward === 'function') {
    const materialsAfter = Object.values(meta.mats || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    recordDungeonReward('materials', Math.max(0, materialsAfter - materialsBefore));
    recordDungeonReward('souls', Math.max(0, soulsRun - soulsBefore));
  }
  floorEvent.status = outcome.status;
  burst(floorEvent.x, floorEvent.y - 42, outcome.color, outcome.status === 'declined' ? 10 : 28);
  num(floorEvent.x, floorEvent.y - 82, outcome.message, outcome.color);
  playSfx(outcome.status === 'done' && def.family === 'chest' ? 'chest' : 'uiConfirm', 0.9, 1.08);
  eventPanel = null;
}
function checkFloorEventReward() {
  if (floorTrial && floorTrial.status === 'active') {
    updateFloorTrial(0);
    return;
  }
  if (!floorEvent || floorEvent.status !== 'combat' || mons.some(m => m.eventMon)) return;
  floorEvent.status = 'done';
  dropFloorEventGear(floor >= 15 ? 3 : 2, 'event');
  burst(floorEvent.x, floorEvent.y - 38, '#ffd36a', 36);
  num(floorEvent.x, floorEvent.y - 84, '寶箱怪擊敗！稀有裝備已掉落', '#ffd36a');
  playSfx('enhanceSuccess', 0.85, 1.08);
}
function promoteDungeonElite(m) {
  if (!m || m.type === 'boss' || m.elite) return;
  m.elite = true;
  m.hp = Math.round(m.hp * DUNGEON_D3C_CALIBRATION.eliteHpMultiplier); m.mhp = m.hp;
  m.dmg = Math.round(m.dmg * 1.25); m.xpv = Math.round(m.xpv * 2);
  if (typeof dungeonCurseEliteStat === 'function') {
    m.hp = Math.round(dungeonCurseEliteStat(m.hp)); m.mhp = m.hp;
    m.dmg = Math.round(dungeonCurseEliteStat(m.dmg));
  }
  m.w = Math.round(m.w * 1.15); m.h = Math.round(m.h * 1.15);
}
function genFloor(n, roomSpec) {
  if (n % 5 === 0) { genBossFloor(n); return; }
  const spec = roomSpec || currentRoomSpec || makeRoomSpec('safe', n, 0);
  const roomType = spec.type || 'safe';
  worldW = Math.min(1600 + n * 120, 2600);
  plats = generateDungeonPlatforms(spec, worldW);
  mons = [];
  const baseCount = Math.min(6 + n * 2, 22);
  const countMul = roomType === 'camp' ? 0 : roomType === 'treasure' ? 0.4 : roomType === 'event' ? 0.6 : roomType === 'elite' ? 0.65 : 1;
  const count = countMul === 0 ? 0 : Math.max(3, Math.ceil(baseCount * countMul));
  const sc = (1 + 0.3 * (n - 1) + 0.02 * (n - 1) * (n - 1)) * (n >= 21 ? 1.15 : 1); // 線性+二次成長,深淵(21+)再×1.15
  const xpSc = 1 + 0.15 * (n - 1);
  const eliteCh = roomType === 'safe' ? Math.min(0.05 + 0.015 * n, 0.25) : 0;
  const pool = biomeOf(n).pool;
  const enemyTypes = generateDungeonEnemyTypes(spec, pool, count);
  const enemyRng = dungeonRoomRng(spec, 'enemy-spawns');
  for (const type of enemyTypes) spawnMon(type, n, sc, xpSc, eliteCh, enemyRng);
  if (roomType === 'elite') {
    const candidates = mons.filter(m => m.type !== 'bat').slice(0, 2);
    while (candidates.length < Math.min(2, mons.length)) {
      const extra = mons.find(m => !candidates.includes(m)); if (!extra) break; candidates.push(extra);
    }
    candidates.forEach(promoteDungeonElite);
  }
  portal = null;
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0; espits.length = 0; meteors.length = 0; skillZones.length = 0; skillAnims.length = 0;
  floorEvent = null; eventPanel = null; floorTrial = null;
  if (spec.eventId && DUNGEON_EVENT_DEFS[spec.eventId]) {
    const eventDef = DUNGEON_EVENT_DEFS[spec.eventId];
    floorEvent = {
      type:eventDef.worldType,
      eventId:spec.eventId,
      x:dungeonEventPosition(spec, worldW), y:468, status:'idle'
    };
    if (eventDef.family === 'trial') floorTrial = createDungeonTrial(eventDef, spec, player, worldW);
  } else if (roomType === 'camp') {
    player.hp = Math.min(player.mhp, player.hp + Math.round(blessingHeal(player.mhp * 0.25)));
    player.mp = Math.min(player.mmp, player.mp + Math.round(player.mmp * 0.25));
    num(player.x, player.y - player.h - 34, '營地休整 · HP / MP +25%', '#8aa8ff');
  }
  spawnDungeonHazards(spec, worldW, floorEvent ? floorEvent.x : null, plats);
  floorT = 90;
  if (mons.length === 0) completeDungeonRoom();
}
function genBossFloor(n) {
  clearDungeonHazards();
  clearDungeonBossEffects();
  const bossDef = dungeonBossDefForFloor(n);
  worldW = bossDef.arena.width;
  plats = dungeonBossArenaPlatforms(bossDef);
  const sc = (1 + 0.3 * (n - 1) + 0.02 * (n - 1) * (n - 1)) * (n >= 21 ? 1.15 : 1);
  mons = [createDungeonBoss(bossDef, n, sc)];
  if (typeof recordDungeonBossStart === 'function') recordDungeonBossStart(mons[0]);
  portal = null;
  floorEvent = null; eventPanel = null; floorTrial = null;
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0; espits.length = 0; meteors.length = 0; skillZones.length = 0; skillAnims.length = 0;
  floorT = 150;
}
function spawnBossAdds(count) { // Boss 進階段召喚蝙蝠援軍(較弱,增加混亂壓力)
  const sc = (1 + 0.3 * (floor - 1) + 0.02 * (floor - 1) * (floor - 1)) * 0.7;
  for (let i = 0; i < count; i++) {
    const bx = 220 + Math.random() * (worldW - 440), by = 150 + Math.random() * 120;
    const hp = monsterHp(22, sc, floor);
    mons.push({ type: 'bat', x: bx, y: by, ax: bx, ay: by, t: Math.random() * 100, hp: hp, mhp: hp, xpv: 10, dmg: Math.round(8 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
  }
  num(player.x, player.y - player.h - 30, '召喚援軍!', '#ff5a5a');
  beep(180, 0.2, 'sawtooth', 0.05);
}
function resetRun() {
  const benchmarkProfile = pendingDungeonBenchmarkId && typeof dungeonBenchmarkProfile === 'function' ? dungeonBenchmarkProfile(pendingDungeonBenchmarkId) : null;
  if (benchmarkProfile) chosenCls = benchmarkProfile.classId;
  activeDungeonBenchmarkId = benchmarkProfile ? benchmarkProfile.id : null;
  pendingDungeonBenchmarkId = null;
  const p = player;
  p.cls = chosenCls;
  p.lv = 1; p.xp = 0;
  p.cd = { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0, def: 0, heal: 0, ifr: 0 };
  p.items = []; p.eq = { weapon: null, armor: null, helmet: null, boots: null, acc: null };
  if (benchmarkProfile) {
    for (const src of benchmarkProfile.gear) {
      const cp = Object.assign({}, src, { affixes:(src.affixes || []).map(a => a && Object.assign({}, a)) });
      p.items.push(cp); p.eq[cp.kind] = cp;
    }
  } else {
    for (const part of GEAR_PARTS) { // 從倉庫穿戴開局裝備(副本帶出,倉庫原件保留)
      const uid = meta.loadout[part];
      const src = uid ? meta.stash.find(s => s.uid === uid) : null;
      if (src && gearUsableByClass(src, p.cls)) {
        const cp = Object.assign({}, src, { affixes: (src.affixes || []).map(a => a && Object.assign({}, a)) });
        p.items.push(cp); p.eq[part] = cp;
      }
    }
  }
  p.bag = { hp: meta.up.pots, mp: meta.up.pots };
  p.x = 80; p.y = 468; p.vx = 0; p.vy = 0; p.face = 1;
  p.inv = 0; p.cast = 0; p.slotCd = [0, 0, 0]; p.potCd = 0; p.slashT = 0; p.spinT = 0;
  p.dashT = 0; p.dashCd = 0; p.dashDir = 1;
  p.rageT = 0; p.rageAtk = 0; p.rageSpd = 0; p.rageLifesteal = 0; p.rageExtend = 0; p.rageBlood = false; p.rageUltimate = false;
  p.shieldHp = 0; p.shieldT = 0; p.shieldReflect = 0; p.shieldBreakMp = 0; p.shieldBurst = false; p.chillT = 0; p.hazardSlowT = 0;
  p.skillCasts = {};
  p.perk = {}; p.revives = 0; p.affixDeathUsed = false; p.eventAtk = 0; p.eventRerolls = 0; p.aegisCd = 0; p.airJumped = false;
  p.itemWin = false; statsOpen = false;
  hitStopT = 0; shakeT = 0; shakeMaxT = 0; shakeAmp = 0; playerFlashT = 0; hurtVignetteT = 0;
  lastDamageSource = '未知攻擊';
  coyoteT = 0; clearGameInputs(); skillPulseT.fill(0);
  calcStats();
  p.hp = p.mhp; p.mp = p.mmp;
  floor = 1; kills = 0; soulsRun = 0; gearSeq = 1;
  pendingPicks = 0;
  dmgNums.length = 0; parts.length = 0;
  resetDungeonRun(benchmarkProfile);
  genFloor(1, currentRoomSpec);
  if (perkV('barrier') > 0) p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.05 * perkV('barrier')));
  gameState = 'play';
  setHint(HINT_PLAY);
  beep(660, 0.1, 'sine', 0.04);
  setTimeout(() => beep(880, 0.15, 'sine', 0.04), 100);
}
// ---------- 逃走機制（道中長按逃走；受擊中斷；保留戰利品，視為撤退）----------
let fleeChannelT = 0;
const FLEE_CHANNEL_FRAMES = 90; // 1.5 秒
function fleeChannelActive() { return fleeChannelT > 0; }
function fleeChannelProgress() { return Math.min(1, fleeChannelT / FLEE_CHANNEL_FRAMES); }
function interruptFleeChannel() { fleeChannelT = 0; }
function fleeToBase() {
  fleeChannelT = 0;
  lastDamageSource = '主動逃走';
  endRun('extract');
}
function updateFleeChannel() {
  if (gameState !== 'play' || (typeof eventPanel !== 'undefined' && eventPanel)) { fleeChannelT = 0; return; }
  if (!keys['q']) { fleeChannelT = 0; return; }
  if (fleeChannelT === 0) playSfx('uiSelect', 0.6, 0.9);
  fleeChannelT++;
  if (fleeChannelT >= FLEE_CHANNEL_FRAMES) fleeToBase();
}
function endRun(result) {
  const benchmarkRun = !!activeDungeonBenchmarkId;
  const gained = Math.round(soulsRun * soulGainMul());
  if (!benchmarkRun) meta.souls += gained;
  let stashed = 0;
  if (!benchmarkRun) for (const it of player.items) if (stashGear(it)) stashed++; // 背包裝備存入倉庫
  lastRun = { floor: floor, kills: kills, gained: gained, stashed: stashed, cause: lastDamageSource, result:result === 'extract' ? 'extract' : 'death', benchmarkId:activeDungeonBenchmarkId };
  if (typeof finishDungeonBalanceRun === 'function') finishDungeonBalanceRun(lastRun);
  if (benchmarkRun) restoreDungeonBenchmarkProgress();
  else { if (floor > bestFloor) bestFloor = floor; saveMeta(); }
  activeDungeonBenchmarkId = null;
  gameState = 'dead';
  setHint('Enter 返回基地');
  if (lastRun.result === 'extract') playSfx('uiConfirm', 0.95, 1.08);
  else beep(120, 0.4, 'sawtooth', 0.05);
}

function snapshotDungeonBenchmarkProgress() {
  dungeonBenchmarkProgressSnapshot = {
    meta:JSON.parse(JSON.stringify(meta)),
    activity:JSON.parse(JSON.stringify(activityState)),
    bestFloor
  };
  try { localStorage.setItem(DUNGEON_BENCHMARK_SNAPSHOT_KEY, JSON.stringify(dungeonBenchmarkProgressSnapshot)); } catch (err) {}
}
function restoreDungeonBenchmarkProgress() {
  let snapshot = dungeonBenchmarkProgressSnapshot;
  if (!snapshot) {
    try { snapshot = JSON.parse(localStorage.getItem(DUNGEON_BENCHMARK_SNAPSHOT_KEY)); } catch (err) {}
  }
  dungeonBenchmarkProgressSnapshot = null;
  if (!snapshot) return;
  for (const key of Object.keys(meta)) delete meta[key];
  Object.assign(meta, snapshot.meta);
  for (const key of Object.keys(activityState)) delete activityState[key];
  Object.assign(activityState, snapshot.activity);
  bestFloor = snapshot.bestFloor;
  saveMeta(); saveActivity();
  try { localStorage.removeItem(DUNGEON_BENCHMARK_SNAPSHOT_KEY); } catch (err) {}
}
function recoverAbandonedDungeonBenchmark() {
  try {
    if (localStorage.getItem(DUNGEON_BENCHMARK_SNAPSHOT_KEY)) restoreDungeonBenchmarkProgress();
  } catch (err) {}
}
function startDungeonBenchmarkRun(profileId) {
  const profile = typeof dungeonBenchmarkProfile === 'function' ? dungeonBenchmarkProfile(profileId) : null;
  if (!profile) { menuMsg = { text:'基準設定不存在', color:'#ff5a5a', t:180 }; playSfx('uiError'); return false; }
  snapshotDungeonBenchmarkProgress();
  pendingDungeonBenchmarkId = profile.id;
  chosenCls = profile.classId;
  settingsOpen = false; settingsPage = 'main'; settingsMode = null;
  closeSaveEdit(); clearGameInputs();
  resetRun();
  num(player.x, player.y - player.h - 48, '固定基準：' + profile.label + ' · ' + profile.gearLabel, '#ffe680');
  return true;
}

// ---------- fx ----------
function num(x, y, text, color, style) {
  const s = style || {};
  if (s.kind === 'tick' && combatSettings.numbers === 'compact') return;
  if (dmgNums.length >= 18) {
    const replace = dmgNums.findIndex(d => !['crit', 'hurt', 'kill'].includes(d.kind));
    if (replace >= 0) dmgNums.splice(replace, 1);
    else return;
  }
  const life = s.life || 60;
  dmgNums.push({
    x: x + (s.dx || 0), y: y, text: text, color: color || '#fff',
    t: life, maxT: life, size: s.size || 16, vy: s.vy == null ? 0.7 : s.vy,
    kind: s.kind || 'info', pop: s.pop || 0
  });
}
function burst(x, y, color, n) {
  for (let i = 0; i < (n || 10); i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, t: 25 + Math.random() * 15, color: color });
  }
}

// ---------- combat ----------
const MONSTER_LABEL = { slime:'史萊姆', bat:'蝙蝠', mush:'跳菇', spore:'孢子怪', bomber:'爆裂怪', charger:'衝鋒獸', icer:'冰霜怪', splitter:'分裂怪', boss:'Boss' };
function monsterLabel(m) { return m && m.type === 'boss' ? (m.name || dungeonBossDef(m.bossId).name) : (MONSTER_LABEL[m && m.type] || '怪物'); }
function removeMon(m) {
  const i = mons.indexOf(m);
  if (i < 0) return;
  if (m.trialMon) recordDungeonTrialEnemyDefeat(floorTrial);
  mons.splice(i, 1);
  if (mons.length === 0) { checkFloorEventReward(); completeDungeonRoom(); }
}
function explodeBomber(m) {
  const p = player;
  burst(m.x, m.y - m.h / 2, '#ff6b2e', 28);
  beep(90, 0.25, 'sawtooth', 0.06);
  let dead = false;
  if (p.inv === 0 && Math.abs(p.x - m.x) < 85 && Math.abs((p.y - p.h / 2) - (m.y - m.h / 2)) < 85) {
    const d = Math.max(1, Math.round(m.dmg * 2.2) - armorDef());
    p.vx = (p.x < m.x ? -1 : 1) * 6.5; p.vy = -6; p.onGround = false;
    dead = dmgPlayer({ amount:d, sourceName:monsterLabel(m) + '的爆炸', sourceX:m.x, heavy:true });
  }
  removeMon(m);
  return dead;
}
function hitMon(m, d, crit, noChain) {
  if (typeof dungeonBlessingDamageForTarget === 'function') d = Math.max(1, Math.round(dungeonBlessingDamageForTarget(d, m)));
  if (typeof dungeonCurseOutgoingDamage === 'function') d = Math.max(1, Math.round(dungeonCurseOutgoingDamage(d)));
  if (m.hp < m.mhp * 0.25 && perkV('execute') > 0) d = Math.max(1, Math.round(d * (1 + 0.1 * perkV('execute'))));
  if (m.vulnT > 0) d = Math.max(1, Math.round(d * (m.vulnMul || 1.2)));
  m.hp -= d; m.hitT = 8;
  const lifesteal = 0.06 * perkV('vamp') + affixV('lifesteal') + (player.rageT > 0 ? player.rageLifesteal || 0 : 0);
  if (lifesteal > 0) player.hp = Math.min(player.mhp, player.hp + blessingHeal(d * lifesteal)); // 吸血鬼/吸血詞綴
  const feelKind = noChain ? 'tick' : crit ? (m.type === 'boss' ? 'boss' : 'crit') : Math.abs(m.x - player.x) < 110 ? 'melee' : 'ranged';
  const feel = FEEL_PRESETS[feelKind];
  num(m.x, m.y - m.h - 8, String(d), crit ? '#ffb020' : '#fff', {
    kind:noChain ? 'tick' : crit ? 'crit' : 'damage', size:noChain ? 11 : crit ? 18 : 13,
    pop:crit ? 5 : 1, vy:crit ? 1 : 0.65, dx:(Math.random() - 0.5) * 10
  });
  burst(m.x, m.y - m.h / 2, '#ffd23e', feel.particles);
  triggerCombatFeel(feelKind, m);
  if (crit) combatVibrate(10);
  playSfx(crit ? 'critical' : 'hit');
  if (m.hp <= 0) {
    triggerCombatFeel(m.type === 'boss' ? 'boss' : 'kill', m);
    kills++;
    activityProgress('kills', 1);
    if (m.type === 'boss') activityProgress('bosses', 1);
    else if (m.elite) activityProgress('elites', 1);
    burst(m.x, m.y - m.h / 2, m.elite ? '#b05ae0' : (m.type === 'slime' ? '#63cf3c' : '#c0aaff'), m.elite ? 24 : 14);
    gainXp(m.xpv);
    if (player.cd.ls > 0) player.hp = Math.min(player.mhp, player.hp + blessingHeal(3 * player.cd.ls));
    if (player.rageT > 0 && player.rageExtend > 0) {
      player.rageT = Math.min(720, player.rageT + player.rageExtend);
      num(player.x, player.y - player.h - 28, '戰意延長', '#ff8a6a');
    }
    const killMp = 5 * perkV('mana') + affixV('mpKill');
    if (killMp > 0) player.mp = Math.min(player.mmp, player.mp + killMp); // 法力循環/靈泉
    if (!noChain && perkV('chain') > 0) { // 連鎖爆炸
      burst(m.x, m.y - m.h / 2, '#ffb020', 18);
      beep(150, 0.12, 'sawtooth', 0.05);
      const cd = Math.round(atkPow() * 1.5 * perkV('chain'));
      for (const o of mons.slice()) {
        if (o !== m && Math.abs(o.x - m.x) < 95 && Math.abs((o.y - o.h / 2) - (m.y - m.h / 2)) < 75) hitMon(o, cd, false, true);
      }
    }
    const orbN = m.eventMon ? 0 : m.type === 'boss' ? 8 : m.elite ? 2 : (Math.random() < SOUL_DROP_CHANCE ? 1 : 0);
    for (let i = 0; i < orbN; i++) {
      orbs.push({ x: m.x + (Math.random() - 0.5) * 16, y: m.y - m.h, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 2, t: 0 });
    }
    if (!m.eventMon && Math.random() < potionDropChance()) {
      drops.push({
        x: m.x + 10, y: m.y - m.h, vy: -3.5, vx: (Math.random() - 0.5) * 2,
        type: Math.random() < 0.6 ? 'hp' : 'mp', t: 700, ground: m.type === 'bat' ? 468 : (m.baseY || m.y)
      });
    }
    if (m.type === 'boss') {
      if (typeof recordDungeonBossEnd === 'function') recordDungeonBossEnd('kill', null);
      // 保底傳說裝 + 追加一件隨機裝
      gearDrops.push({ x: m.x - 26, y: m.y - m.h, vy: -4, vx: -1.2, it: genGear(floor, floor >= 20 ? 4 : 3, 'boss'), t: 1500, ground: 468 }); // 保底史詩,深層傳說
      gearDrops.push({ x: m.x + 26, y: m.y - m.h, vy: -4, vx: 1.2, it: genGear(floor, 2, 'boss'), t: 1500, ground: 468 });
      if (typeof recordDungeonReward === 'function') recordDungeonReward('gear', 2);
    } else if (!m.eventMon) {
      if (Math.random() < gearDropChance(m.elite)) {
        gearDrops.push({
          x: m.x - 10, y: m.y - m.h, vy: -3, vx: (Math.random() - 0.5) * 2,
          it: genGear(floor), t: 900, ground: m.type === 'bat' ? 468 : (m.baseY || m.y)
        });
        if (typeof recordDungeonReward === 'function') recordDungeonReward('gear', 1);
      }
    }
    if (m.trialMon) recordDungeonTrialEnemyDefeat(floorTrial);
    mons.splice(mons.indexOf(m), 1);
    checkFloorEventReward();
    beep(220, 0.15, 'sawtooth');
    if (m.type === 'splitter' && (m.gen || 0) < 1) {
      for (let i = 0; i < 2; i++) {
        const shp = Math.round(m.mhp * 0.4);
        const by = m.baseY || m.y;
        mons.push({ type:'splitter', x: m.x + (i ? 20 : -20), y: by, baseY: by,
          vx: (i ? 1 : -1) * (0.6 + Math.random() * 0.4), gen: 1,
          minx: Math.max(20, m.x - 130), maxx: Math.min(worldW - 20, m.x + 130),
          hp: shp, mhp: shp, xpv: Math.round(m.xpv * 0.4), dmg: Math.round(m.dmg * 0.7),
          w: 26, h: 18, hitT: 0, elite: false, s: 3 });
      }
      burst(m.x, m.y - m.h / 2, '#d8f4ff', 12);
    }
    if (mons.length === 0) completeDungeonRoom();
  }
}
function gainXp(n) {
  const p = player;
  const g = Math.max(1, Math.round(n * (typeof dungeonXpMul === 'function' ? dungeonXpMul() : 1))); // 一般模式升等較快
  p.xp += g;
  num(p.x, p.y - p.h - 14, '+' + g + ' EXP', '#9ecbff');
  while (p.xp >= xpNeed(p.lv)) {
    p.xp -= xpNeed(p.lv);
    p.lv++;
    pendingPicks++;
    calcStats();
    p.hp = Math.min(p.mhp, p.hp + Math.round(blessingHeal(p.mhp * 0.3)));
    p.mp = p.mmp;
    burst(p.x, p.y - p.h / 2, '#ffe680', 30);
    beep(523, 0.12); setTimeout(() => beep(659, 0.12), 110); setTimeout(() => beep(784, 0.2), 220);
  }
  if (pendingPicks > 0 && gameState === 'play') rollPick();
}
function usePot(t) {
  const p = player;
  if (p.potCd > 0) return;
  if (p.bag[t] <= 0) {
    num(p.x, p.y - p.h - 10, t === 'hp' ? '沒有紅色藥水' : '沒有藍色藥水', '#aaa');
    return;
  }
  p.bag[t]--; p.potCd = 30;
  activityProgress('potions', 1);
  const potMul = (1 + 0.05 * meta.up.alchemy) * (1 + 0.1 * p.cd.heal);
  if (t === 'hp') { const heal = Math.round(blessingHeal(60 * potMul)); p.hp = Math.min(p.mhp, p.hp + heal); num(p.x, p.y - p.h - 10, '+' + heal + ' HP', '#7dff8a'); }
  else { const heal = Math.round(40 * potMul); p.mp = Math.min(p.mmp, p.mp + heal); num(p.x, p.y - p.h - 10, '+' + heal + ' MP', '#7f9cff'); }
  beep(1000, 0.07, 'sine', 0.04);
}
