// ---------- dungeon route lifecycle (v0.26 D1) ----------
let dungeonRun = null;
let currentRoomSpec = null;
let routePanel = null;
let chapterPanel = null;

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

function makeRoomSpec(type, atFloor, branch) {
  const def = DUNGEON_ROOM_DEFS[type] || DUNGEON_ROOM_DEFS.safe;
  return {
    id:'f' + atFloor + '-' + type + '-' + (branch || 0),
    floor:atFloor,
    chapter:dungeonChapter(atFloor),
    roomIndex:dungeonRoomIndex(atFloor),
    type,
    threat:def.threat,
    score:def.score,
    rewardTags:def.rewards.slice(),
    seed:dungeonSeedHash((dungeonRun ? dungeonRun.seed : 1) + ':' + atFloor + ':' + type + ':' + (branch || 0))
  };
}

function resetDungeonRun() {
  const seed = dungeonSeedHash(Date.now() + ':' + Math.random() + ':' + (meta.playerName || '勇者'));
  dungeonRun = {
    seed,
    chapter:1,
    explorationScore:0,
    roomHistory:[],
    eventHistory:[],
    chapterUsed:{ camp:false, treasure:false },
    completedFloor:0,
    rewardedFloor:0,
    choices:[],
    chapterReward:null
  };
  currentRoomSpec = makeRoomSpec('safe', 1, 0);
  dungeonRun.roomHistory.push('safe');
  routePanel = null;
  chapterPanel = null;
}

function weightedDungeonType(candidates, rng) {
  const total = candidates.reduce((sum, type) => sum + (DUNGEON_ROUTE_WEIGHTS[type] || 1), 0);
  let roll = rng() * total;
  for (const type of candidates) {
    roll -= DUNGEON_ROUTE_WEIGHTS[type] || 1;
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
  routePanel = { choices:dungeonRun.choices };
  portal = null;
  clearGameInputs();
  playSfx('uiSelect', 0.8, 1.05);
}

function chooseDungeonRoute(index) {
  if (!routePanel || !routePanel.choices[index]) return;
  const spec = routePanel.choices[index];
  routePanel = null;
  enterDungeonRoom(spec);
}

function applyRoomEntry(spec) {
  if (!dungeonRun || !spec) return;
  currentRoomSpec = spec;
  dungeonRun.chapter = spec.chapter;
  dungeonRun.roomHistory.push(spec.type);
  if (spec.type === 'camp') dungeonRun.chapterUsed.camp = true;
  if (spec.type === 'treasure') dungeonRun.chapterUsed.treasure = true;
}

function enterDungeonRoom(spec) {
  const p = player;
  applyRoomEntry(spec);
  floor = spec.floor;
  if (floor > 1) activityProgress('floors', 1);
  const campHeal = 0.05 * perkV('camp');
  p.hp = Math.min(p.mhp, p.hp + Math.round(p.mhp * (0.15 + campHeal)));
  if (campHeal > 0) p.mp = Math.min(p.mmp, p.mp + Math.round(p.mmp * campHeal));
  p.x = 80; p.y = 468; p.vx = 0; p.vy = 0; p.onGround = true;
  camX = 0;
  genFloor(floor, spec);
  if (perkV('barrier') > 0) p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.05 * perkV('barrier')));
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
    saveMeta();
    num(player.x, player.y - player.h - 58, '菁英房完成 · 強化石 +1', '#d9a8ff');
  }
}

function completeDungeonRoom() {
  if (!dungeonRun || mons.length > 0 || dungeonRun.completedFloor === floor) return;
  dungeonRun.completedFloor = floor;
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
  const rarity = score >= 6 ? 2 : 1;
  const mats = score >= 6 ? 2 : 1;
  addGear(genGear(floor, rarity));
  meta.mats.enh += mats;
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
  if (portal.kind === 'chapter') {
    openChapterSummary();
    return;
  }
  const nextFloor = floor + 1;
  if (nextFloor % 5 === 0) enterDungeonRoom(makeRoomSpec('boss', nextFloor, 0));
  else openRouteSelection();
}
