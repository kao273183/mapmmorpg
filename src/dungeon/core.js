// ---------- dungeon route lifecycle (v0.26 D2-A) ----------
let dungeonRun = null;
let currentRoomSpec = null;
let routePanel = null;
let chapterPanel = null;
let modifierPanel = null;
let modifierListOpen = false;

function dungeonSeedHash(value) {
  let h = 2166136261 >>> 0;
  const s = String(value);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dungeonRng(value) {
  let a = dungeonSeedHash(value) || 1;
  return function () {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dungeonRoomIndex(atFloor) { return ((atFloor - 1) % 5) + 1; }
function dungeonChapter(atFloor) { return Math.floor((atFloor - 1) / 5) + 1; }

function dungeonBiomeDef(atFloor) {
  const index = Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5));
  return DUNGEON_BIOME_DEFS[Math.max(0, index)];
}

function dungeonRoomRng(spec, purpose) {
  return dungeonRng((spec && spec.seed || 1) + ':' + purpose);
}

function dungeonEventCandidatesForRoom(type, chapter) {
  const families = type === 'treasure' ? ['chest'] : type === 'event' ? ['shrine', 'trial'] : [];
  if (!families.length) return [];
  return Object.values(DUNGEON_EVENT_DEFS).filter(def =>
    families.includes(def.family) && chapter >= (def.minChapter || 1)
  );
}

function dungeonEventHistoryMultiplier(eventId, history) {
  const reversed = (history || []).slice().reverse();
  const ago = reversed.indexOf(eventId);
  if (ago < 0) return 1;
  if (ago < 2) return 0;
  if (ago < 4) return 0.25;
  return 1;
}

function dungeonEventIdForRoom(type, seed, chapter, history) {
  const candidates = dungeonEventCandidatesForRoom(type, chapter || 1);
  if (!candidates.length) return null;
  const rng = dungeonRng(seed + ':event-pick');
  let weighted = candidates.map(def => ({
    def,
    weight:(def.weight || 1) * dungeonEventHistoryMultiplier(def.id, history)
  }));
  let total = weighted.reduce((sum, item) => sum + item.weight, 0);

  // 同一家族在早期章節可能被最近紀錄完全封鎖；此時選擇最久未出現者，確保房間仍有內容。
  if (total <= 0) {
    const reversed = (history || []).slice().reverse();
    const age = def => {
      const index = reversed.indexOf(def.id);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    const oldestAge = Math.max(...candidates.map(age));
    weighted = candidates.filter(def => age(def) === oldestAge).map(def => ({ def, weight:def.weight || 1 }));
    total = weighted.reduce((sum, item) => sum + item.weight, 0);
  }

  let roll = rng() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.def.id;
  }
  return weighted[weighted.length - 1].def.id;
}

function dungeonEnemyTags(type, biome) {
  if (type === 'camp') return ['無敵人'];
  if (type === 'elite') return ['2 隻菁英', biome.enemyTag];
  if (type === 'treasure') return ['少量守衛'];
  if (type === 'event') return ['事件守衛'];
  if (type === 'hazard') return [biome.enemyTag];
  if (type === 'boss') return [biome.bossName];
  return [biome.enemyTag];
}

function makeRoomSpec(type, atFloor, branch) {
  const def = DUNGEON_ROOM_DEFS[type] || DUNGEON_ROOM_DEFS.safe;
  const resolvedType = DUNGEON_ROOM_DEFS[type] ? type : 'safe';
  const branchId = branch || 0;
  const seed = dungeonSeedHash((dungeonRun ? dungeonRun.seed : 1) + ':' + atFloor + ':' + resolvedType + ':' + branchId);
  const biome = dungeonBiomeDef(atFloor);
  let hazardId = resolvedType === 'hazard' ? biome.hazardId : null;
  const chapter = dungeonChapter(atFloor);
  const eventId = dungeonEventIdForRoom(resolvedType, seed, chapter, dungeonRun ? dungeonRun.eventHistory : []);
  if (eventId === 'hazard_trial') hazardId = biome.hazardId;
  const eventDef = eventId ? DUNGEON_EVENT_DEFS[eventId] : null;
  const hazardDef = hazardId ? DUNGEON_HAZARD_DEFS[hazardId] : null;
  return {
    id:'f' + atFloor + '-' + resolvedType + '-' + branchId,
    floor:atFloor,
    chapter,
    roomIndex:dungeonRoomIndex(atFloor),
    biomeId:biome.id,
    type:resolvedType,
    threat:eventDef ? Math.max(def.threat, eventDef.threat || 0) : def.threat,
    score:def.score,
    enemyTags:dungeonEnemyTags(resolvedType, biome),
    rewardTags:(eventDef ? eventDef.rewards : hazardDef ? hazardDef.rewards : def.rewards).slice(),
    hazardId,
    eventId,
    seed
  };
}

function generateDungeonPlatforms(spec, width) {
  const rng = dungeonRoomRng(spec, 'platforms');
  const result = [{ x:0, y:468, w:width, ground:true }];
  const rowsY = [405, 325, 250];
  let px = 150;
  while (px < width - 260) {
    const pw = 140 + rng() * 120;
    if (rng() < 0.82) {
      const ri = (rng() * 3) | 0;
      result.push({ x:px, y:rowsY[ri], w:pw });
      let ux = px, uw = pw;
      for (let r = ri - 1; r >= 0; r--) {
        const near = result.some(q => !q.ground && q.y === rowsY[r] && q.x < ux + uw + 40 && q.x + q.w > ux - 40);
        if (!near) {
          const sw = 90 + rng() * 50;
          const dir = rng() < 0.5 ? -1 : 1;
          const sx = Math.max(20, Math.min(width - sw - 20, dir < 0 ? ux - sw + 34 : ux + uw - 34));
          result.push({ x:sx, y:rowsY[r], w:sw });
          ux = sx; uw = sw;
        }
      }
    }
    px += pw + 60 + rng() * 130;
  }
  return result;
}

function generateDungeonEnemyTypes(spec, pool, count) {
  const rng = dungeonRoomRng(spec, 'enemy-types');
  const result = [];
  for (let i = 0; i < count; i++) result.push(pool[(rng() * pool.length) | 0]);
  return result;
}

function dungeonEventPosition(spec, width) {
  const rng = dungeonRoomRng(spec, 'event-position');
  return Math.round(width * (0.46 + rng() * 0.24));
}

function dungeonHazardAvailable(atFloor) {
  if (!DUNGEON_D2_FLAGS.hazards) return false;
  const biome = dungeonBiomeDef(atFloor);
  const def = DUNGEON_HAZARD_DEFS[biome.hazardId];
  return !!(def && def.implemented);
}

function resetDungeonRun(benchmarkProfile) {
  const seed = benchmarkProfile ? benchmarkProfile.seed : dungeonSeedHash(Date.now() + ':' + Math.random() + ':' + (meta.playerName || '勇者'));
  dungeonRun = {
    seed,
    chapter:1,
    explorationScore:0,
    roomHistory:[],
    eventHistory:[],
    hazardTutorials:{},
    modifierState:typeof createDungeonModifierRunState === 'function' ? createDungeonModifierRunState(seed) : null,
    chapterUsed:{ camp:false, treasure:false },
    completedFloor:0,
    rewardedFloor:0,
    choices:[],
    chapterReward:null
  };
  currentRoomSpec = makeRoomSpec('safe', 1, 0);
  dungeonRun.roomHistory.push('safe');
  if (typeof startDungeonBalanceRun === 'function') {
    startDungeonBalanceRun(seed, typeof chosenCls === 'string' ? chosenCls : 'unknown', undefined, benchmarkProfile ? {
      mode:'benchmark', benchmarkId:benchmarkProfile.id, benchmarkLabel:benchmarkProfile.label
    } : { mode:'natural' });
    recordDungeonRoomEntry(currentRoomSpec);
  }
  routePanel = null;
  chapterPanel = null;
  modifierPanel = null;
  modifierListOpen = false;
}

function dungeonModifierScheduledAtFloor(atFloor) {
  const cycleFloor = ((Math.max(1, atFloor | 0) - 1) % 15) + 1;
  return [3, 7, 11, 14].includes(cycleFloor);
}

function dungeonModifierAfterAction(action) {
  if (action === 'chapter') openChapterSummary();
  else if (action === 'boss') enterDungeonRoom(makeRoomSpec('boss', floor + 1, 0));
  else openRouteSelection();
}

function openDungeonModifierTransition(afterAction) {
  const state = dungeonRun && dungeonRun.modifierState;
  if (!state || state.pending || !dungeonModifierScheduledAtFloor(floor)) return false;
  let kind = state.offerSequence % 2 === 0 ? 'blessing' : 'curse';
  let offer = beginDungeonModifierOffer(state, kind, { floor, chapter:dungeonRun.chapter, optionCount:3 });
  if (!offer) {
    kind = kind === 'blessing' ? 'curse' : 'blessing';
    offer = beginDungeonModifierOffer(state, kind, { floor, chapter:dungeonRun.chapter, optionCount:3 });
  }
  if (!offer) return false;
  modifierPanel = { offer, afterAction:afterAction || 'route', settled:false };
  portal = null;
  clearGameInputs();
  playSfx('uiSelect', 0.85, kind === 'curse' ? 0.82 : 1.08);
  return true;
}

function settleDungeonModifierPanel(result) {
  if (!modifierPanel || modifierPanel.settled || !result || !result.ok) return false;
  modifierPanel.settled = true;
  const afterAction = modifierPanel.afterAction;
  modifierPanel = null;
  clearGameInputs();
  playSfx(result.status === 'accepted' ? 'uiConfirm' : 'uiSelect', 0.9, result.status === 'accepted' ? 1.08 : 0.9);
  dungeonModifierAfterAction(afterAction);
  return true;
}

function chooseDungeonModifier(modifierId) {
  if (!modifierPanel || modifierPanel.settled) return false;
  return settleDungeonModifierPanel(acceptDungeonModifierOffer(dungeonRun.modifierState, modifierId));
}

function rerollDungeonModifierPanel() {
  if (!modifierPanel || modifierPanel.settled) return false;
  const offer = rerollDungeonModifierOffer(dungeonRun.modifierState);
  if (!offer) { playSfx('uiError', 0.55, 0.85); return false; }
  modifierPanel.offer = offer;
  playSfx('uiSelect', 0.85, 1.12);
  return true;
}

function declineDungeonModifierPanel() {
  if (!modifierPanel || modifierPanel.settled) return false;
  return settleDungeonModifierPanel(declineDungeonModifierOffer(dungeonRun.modifierState));
}

function dungeonRouteTypeWeight(type) {
  const base = DUNGEON_ROUTE_WEIGHTS[type] || 1;
  // 一般難度下降低險境房的出現機率。
  if (type === 'hazard' && typeof dungeonHazardChanceMul === 'function') return Math.max(0.2, base * dungeonHazardChanceMul());
  return base;
}

function weightedDungeonType(candidates, rng) {
  const total = candidates.reduce((sum, type) => sum + dungeonRouteTypeWeight(type), 0);
  let roll = rng() * total;
  for (const type of candidates) {
    roll -= dungeonRouteTypeWeight(type);
    if (roll <= 0) return type;
  }
  return candidates[candidates.length - 1] || 'safe';
}

function generateRouteChoices(nextFloor) {
  if (!dungeonRun) return [makeRoomSpec('safe', nextFloor, 0), makeRoomSpec('elite', nextFloor, 1)];
  const rng = dungeonRng(dungeonRun.seed + ':routes:' + nextFloor);
  const roomIndex = dungeonRoomIndex(nextFloor);
  const recent = dungeonRun.roomHistory.slice(-2);
  let pool = ['safe', 'elite', 'event'];
  if (!dungeonRun.chapterUsed.treasure) pool.push('treasure');
  if (!dungeonRun.chapterUsed.camp && roomIndex >= 3) pool.push('camp');
  if (dungeonHazardAvailable(nextFloor)) pool.push('hazard');
  let filtered = pool.filter(type => recent.filter(x => x === type).length < 2);
  if (filtered.length < 2) filtered = pool.slice();

  const first = weightedDungeonType(filtered, rng);
  const secondPool = filtered.filter(type => type !== first);
  let second = weightedDungeonType(secondPool, rng);

  // Boss 前或瀕危時，至少保留一條低風險路線。
  const needsRecovery = roomIndex === 4 || (player && player.hp / Math.max(1, player.mhp) < 0.35);
  if (needsRecovery && !['safe', 'camp', 'treasure'].includes(first) && !['safe', 'camp', 'treasure'].includes(second)) {
    second = !dungeonRun.chapterUsed.camp && roomIndex >= 3 ? 'camp' : 'safe';
  }
  if (second === first) second = first === 'safe' ? 'elite' : 'safe';
  return [makeRoomSpec(first, nextFloor, 0), makeRoomSpec(second, nextFloor, 1)];
}

function openRouteSelection() {
  if (!dungeonRun) return;
  const nextFloor = floor + 1;
  dungeonRun.choices = generateRouteChoices(nextFloor);
  if (typeof recordDungeonRouteOffer === 'function') recordDungeonRouteOffer(dungeonRun.choices);
  routePanel = { choices:dungeonRun.choices };
  portal = null;
  clearGameInputs();
  playSfx('uiSelect', 0.8, 1.05);
}

function chooseDungeonRoute(index) {
  if (!routePanel || !routePanel.choices[index]) return;
  const spec = routePanel.choices[index];
  if (typeof recordDungeonRouteChoice === 'function') recordDungeonRouteChoice(spec);
  routePanel = null;
  enterDungeonRoom(spec);
}

function applyRoomEntry(spec) {
  if (!dungeonRun || !spec) return;
  currentRoomSpec = spec;
  dungeonRun.chapter = spec.chapter;
  dungeonRun.roomHistory.push(spec.type);
  if (spec.eventId) dungeonRun.eventHistory.push(spec.eventId);
  if (spec.type === 'camp') dungeonRun.chapterUsed.camp = true;
  if (spec.type === 'treasure') dungeonRun.chapterUsed.treasure = true;
}

function enterDungeonRoom(spec) {
  const p = player;
  applyRoomEntry(spec);
  if (typeof recordDungeonRoomEntry === 'function') recordDungeonRoomEntry(spec);
  floor = spec.floor;
  if (floor > 1) activityProgress('floors', 1);
  const campHeal = 0.05 * perkV('camp');
  const roomHealing = p.mhp * (0.15 + campHeal);
  p.hp = Math.min(p.mhp, p.hp + Math.round(typeof dungeonBlessingHealingAmount === 'function' ? dungeonBlessingHealingAmount(roomHealing) : roomHealing));
  if (campHeal > 0) p.mp = Math.min(p.mmp, p.mp + Math.round(p.mmp * campHeal));
  p.x = 80; p.y = 468; p.vx = 0; p.vy = 0; p.onGround = true;
  camX = 0;
  genFloor(floor, spec);
  if (perkV('barrier') > 0) p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.05 * perkV('barrier')));
  if (typeof dungeonBlessingRoomShieldAmount === 'function') p.shieldHp = Math.max(p.shieldHp, dungeonBlessingRoomShieldAmount(p.mhp));
  if (typeof dungeonCurseRoomShieldAmount === 'function') p.shieldHp = Math.max(p.shieldHp, dungeonCurseRoomShieldAmount(p.mhp));
  num(p.x, p.y - p.h - 20, '第 ' + floor + ' 層 · ' + DUNGEON_ROOM_DEFS[spec.type].name, DUNGEON_ROOM_DEFS[spec.type].color);
  floorT = spec.type === 'boss' ? 150 : 90;
  clearGameInputs();
  beep(660, 0.15, 'sine', 0.05);
}

function grantRoomClearReward(spec) {
  if (!dungeonRun || !spec || dungeonRun.rewardedFloor === floor) return;
  dungeonRun.rewardedFloor = floor;
  if (spec.type === 'boss') return;
  dungeonRun.explorationScore += spec.score || 0;
  if (spec.type === 'elite') {
    meta.mats.enh += 1;
    if (typeof recordDungeonReward === 'function') recordDungeonReward('materials', 1);
    saveMeta();
    num(player.x, player.y - player.h - 58, '菁英房完成 · 強化石 +1', '#d9a8ff');
  } else if (spec.type === 'hazard') {
    const curseBonus = typeof dungeonCurseValue === 'function' ? dungeonCurseValue('hazard_wager', 'reward') : 0;
    const soulBonus = Math.round(dungeonHazardSoulBonus(floor) * (1 + curseBonus));
    soulsRun += soulBonus;
    meta.mats.enh += 1;
    if (typeof recordDungeonReward === 'function') {
      recordDungeonReward('souls', soulBonus);
      recordDungeonReward('materials', 1);
    }
    saveMeta();
    num(player.x, player.y - player.h - 58, '險境完成 · 靈魂 +' + soulBonus + ' · 強化石 +1', '#ffb45e');
  }
}

function completeDungeonRoom() {
  if (!dungeonRun || mons.length > 0 || dungeonRun.completedFloor === floor) return;
  if (typeof floorTrial !== 'undefined' && typeof dungeonTrialBlocksCompletion === 'function' && dungeonTrialBlocksCompletion(floorTrial)) return;
  dungeonRun.completedFloor = floor;
  if (typeof recordDungeonRoomComplete === 'function') recordDungeonRoomComplete(currentRoomSpec);
  grantRoomClearReward(currentRoomSpec);
  const isBoss = currentRoomSpec && currentRoomSpec.type === 'boss';
  portal = { x:worldW - 70, y:468, kind:isBoss ? 'chapter' : 'next' };
  num(player.x, player.y - player.h - 40, isBoss ? '章節完成！前往出口' : '路線出口開啟！', isBoss ? '#ffd36a' : '#b05ae0');
  beep(880, 0.2, 'sine', 0.05);
}

function grantChapterReward() {
  if (!dungeonRun) return null;
  if (dungeonRun.chapterReward && dungeonRun.chapterReward.floor === floor) return dungeonRun.chapterReward;
  const score = dungeonRun.explorationScore;
  const curseBonus = typeof dungeonCurseValue === 'function' ? dungeonCurseValue('boss_oath', 'reward') : 0;
  const rarity = Math.min(4, (score >= 6 ? 2 : 1) + curseBonus);
  const mats = (score >= 6 ? 2 : 1) + curseBonus;
  addGear(genGear(floor, rarity));
  meta.mats.enh += mats;
  if (typeof recordDungeonReward === 'function') {
    recordDungeonReward('gear', 1);
    recordDungeonReward('materials', mats);
  }
  saveMeta();
  dungeonRun.chapterReward = { floor, score, rarity, mats, itemName:RARITY_NAME[rarity] + '裝備' };
  playSfx('chest', 0.95, 1.05);
  return dungeonRun.chapterReward;
}

function openChapterSummary() {
  portal = null;
  const reward = grantChapterReward();
  chapterPanel = { reward };
  clearGameInputs();
  playSfx('uiConfirm', 0.9, 1.08);
}

function continueDungeonRun() {
  if (!chapterPanel || !dungeonRun) return;
  chapterPanel = null;
  dungeonRun.explorationScore = 0;
  dungeonRun.chapterUsed = { camp:false, treasure:false };
  dungeonRun.chapterReward = null;
  const nextFloor = floor + 1;
  enterDungeonRoom(makeRoomSpec('safe', nextFloor, 0));
}

function extractDungeonRun() {
  if (!chapterPanel) return;
  chapterPanel = null;
  lastDamageSource = '成功撤退';
  endRun('extract');
}

function advanceDungeonPortal() {
  if (!portal) return;
  const nextFloor = floor + 1;
  const afterAction = portal.kind === 'chapter' ? 'chapter' : nextFloor % 5 === 0 ? 'boss' : 'route';
  if (openDungeonModifierTransition(afterAction)) return;
  dungeonModifierAfterAction(afterAction);
}
