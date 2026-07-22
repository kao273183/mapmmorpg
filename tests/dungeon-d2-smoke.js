const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const componentTests = ['dungeon-d2a-smoke.js', 'dungeon-d2b-smoke.js', 'dungeon-d2c-smoke.js', 'dungeon-d2d-smoke.js', 'dungeon-d2e-smoke.js'];
for (const file of componentTests) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding:'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
}

const source = [
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'core.js'), 'utf8'),
  `
  function __resetIntegratedRun(seed) {
    dungeonRun = {
      seed, chapter:1, explorationScore:0, roomHistory:['safe'], eventHistory:[], hazardTutorials:{},
      chapterUsed:{ camp:false, treasure:false }, completedFloor:0, rewardedFloor:0,
      choices:[], chapterReward:null
    };
    currentRoomSpec = makeRoomSpec('safe', 1, 0);
  }
  function __nextChapter() {
    dungeonRun.chapterUsed = { camp:false, treasure:false };
    dungeonRun.explorationScore = 0;
  }
  globalThis.__d2 = {
    roomDefs:DUNGEON_ROOM_DEFS,
    eventDefs:DUNGEON_EVENT_DEFS,
    hazardDefs:DUNGEON_HAZARD_DEFS,
    makeRoomSpec,
    generateRouteChoices,
    applyRoomEntry,
    reset:__resetIntegratedRun,
    nextChapter:__nextChapter,
    getRun:() => dungeonRun
  };
  `
].join('\n');

const context = {
  console,
  Math,
  Date,
  mons:[],
  player:{ hp:100, mhp:100 },
  meta:{ playerName:'整合測試勇者', mats:{ enh:0, ench:0, set:0 } },
  num:() => {},
  saveMeta:() => {}
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'dungeon-d2-integrated-bundle.js' });
const api = context.__d2;
const lowRisk = new Set(['safe', 'camp', 'treasure']);
const firstChapterEvents = new Set(['traveler_chest', 'supply_crate', 'life_spring', 'elite_ambush']);

function plainSpec(spec) {
  return {
    id:spec.id, floor:spec.floor, chapter:spec.chapter, roomIndex:spec.roomIndex,
    biomeId:spec.biomeId, type:spec.type, threat:spec.threat, score:spec.score,
    enemyTags:Array.from(spec.enemyTags), rewardTags:Array.from(spec.rewardTags),
    hazardId:spec.hazardId, eventId:spec.eventId, seed:spec.seed
  };
}

function validateSpec(spec) {
  const roomDef = api.roomDefs[spec.type];
  assert.ok(roomDef, '路線卡房型必須存在');
  assert.ok(spec.enemyTags.length > 0, '路線卡必須公開敵人標籤');
  const eventDef = spec.eventId && api.eventDefs[spec.eventId];
  const hazardDef = spec.hazardId && api.hazardDefs[spec.hazardId];
  if (eventDef) {
    assert.ok(spec.chapter >= eventDef.minChapter, '事件不得早於開放章節');
    assert.deepStrictEqual(Array.from(spec.rewardTags), Array.from(eventDef.rewards));
    assert.strictEqual(spec.threat, Math.max(roomDef.threat, eventDef.threat || 0));
  } else if (hazardDef) {
    assert.deepStrictEqual(Array.from(spec.rewardTags), Array.from(hazardDef.rewards));
  } else {
    assert.deepStrictEqual(Array.from(spec.rewardTags), Array.from(roomDef.rewards));
  }
  if (spec.eventId === 'hazard_trial') assert.ok(spec.hazardId, '地形試煉預覽必須同時公開地形');
  if (spec.chapter === 1 && spec.eventId) assert.ok(firstChapterEvents.has(spec.eventId), '第一章只能出現四個教學事件');
}

function runSequence(seed) {
  api.reset(seed);
  const snapshot = [plainSpec(api.makeRoomSpec('safe', 1, 0))];
  for (let floor = 2; floor <= 25; floor++) {
    if (floor % 5 === 0) {
      const boss = api.makeRoomSpec('boss', floor, 0);
      assert.strictEqual(boss.roomIndex, 5);
      assert.strictEqual(boss.eventId, null);
      assert.strictEqual(boss.hazardId, null);
      validateSpec(boss);
      api.applyRoomEntry(boss);
      snapshot.push(plainSpec(boss));
      api.nextChapter();
      continue;
    }
    if (floor % 5 === 1) {
      const safe = api.makeRoomSpec('safe', floor, 0);
      validateSpec(safe);
      api.applyRoomEntry(safe);
      snapshot.push(plainSpec(safe));
      continue;
    }

    context.player.hp = floor % 5 === 4 ? 20 : 100;
    const beforeEvents = Array.from(api.getRun().eventHistory);
    const choices = api.generateRouteChoices(floor);
    assert.strictEqual(choices.length, 2);
    assert.notStrictEqual(choices[0].type, choices[1].type, '同一張路線不得出現重複房型');
    choices.forEach(validateSpec);
    if (floor % 5 === 4) assert.ok(choices.some(choice => lowRisk.has(choice.type)), 'Boss 前低血量必須保留低風險路線');

    const chosen = choices[(seed + floor) % 2];
    const unchosen = choices[1 - ((seed + floor) % 2)];
    api.applyRoomEntry(chosen);
    const afterEvents = Array.from(api.getRun().eventHistory);
    assert.strictEqual(afterEvents.length, beforeEvents.length + (chosen.eventId ? 1 : 0));
    if (chosen.eventId) assert.strictEqual(afterEvents[afterEvents.length - 1], chosen.eventId);
    if (unchosen.eventId && unchosen.eventId !== chosen.eventId) {
      assert.strictEqual(afterEvents.filter(id => id === unchosen.eventId).length, beforeEvents.filter(id => id === unchosen.eventId).length, '未選路線事件不得寫入歷史');
    }
    const recentRooms = Array.from(api.getRun().roomHistory).slice(-3);
    assert.ok(!(recentRooms.length === 3 && recentRooms.every(type => type === recentRooms[0])), '同房型不得連續三次');
    snapshot.push(plainSpec(chosen));
  }
  return snapshot;
}

const roomTypes = new Set();
const hazards = new Set();
const events = new Set();
for (let seed = 1; seed <= 1000; seed++) {
  const first = runSequence(seed);
  const second = runSequence(seed);
  assert.deepStrictEqual(first, second, '相同 seed 與選擇序列必須完整重現');
  for (const spec of first) {
    roomTypes.add(spec.type);
    if (spec.hazardId) hazards.add(spec.hazardId);
    if (spec.eventId) events.add(spec.eventId);
  }
}

for (const type of ['safe', 'elite', 'treasure', 'event', 'camp', 'hazard', 'boss']) assert.ok(roomTypes.has(type), type + ' 應出現在整合路線樣本');
for (const id of Object.keys(api.hazardDefs)) assert.ok(hazards.has(id), id + ' 應出現在 1,000 seed 樣本');
for (const id of Object.keys(api.eventDefs)) assert.ok(events.has(id), id + ' 應出現在 1,000 seed 樣本');
assert.strictEqual(Object.keys(api.hazardDefs).length, 5);
assert.strictEqual(Object.keys(api.eventDefs).length, 12);

console.log('dungeon D2 integrated smoke test passed (1000 seeds, 5 hazards, 12 events)');
