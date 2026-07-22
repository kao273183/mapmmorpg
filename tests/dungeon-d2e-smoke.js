const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'dungeon-data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'dungeon.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'dungeon-trials.js'), 'utf8'),
  `
  function __setD2eRun(seed, history) {
    dungeonRun = {
      seed, chapter:1, explorationScore:0, roomHistory:['safe'], eventHistory:(history || []).slice(),
      hazardTutorials:{}, chapterUsed:{ camp:false, treasure:false }, completedFloor:0, rewardedFloor:0,
      choices:[], chapterReward:null
    };
  }
  globalThis.__d2e = {
    defs:DUNGEON_EVENT_DEFS,
    candidates:dungeonEventCandidatesForRoom,
    pick:dungeonEventIdForRoom,
    makeRoomSpec,
    create:createDungeonTrial,
    start:startDungeonTrial,
    decline:declineDungeonTrial,
    damage:recordDungeonTrialDamage,
    defeat:recordDungeonTrialEnemyDefeat,
    update:updateDungeonTrialState,
    blocks:dungeonTrialBlocksCompletion,
    claim:claimDungeonTrialReward,
    seconds:dungeonTrialSeconds,
    setRun:__setD2eRun
  };
  `
].join('\n');

const context = {
  console,
  Math,
  Date,
  mons:[],
  player:{ hp:100, mhp:100 },
  meta:{ playerName:'試煉勇者' },
  num:() => {},
  saveMeta:() => {}
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'dungeon-d2e-bundle.js' });
const api = context.__d2e;

const trialIds = Object.values(api.defs).filter(def => def.family === 'trial').map(def => def.id).sort();
assert.deepStrictEqual(Array.from(trialIds), ['elite_ambush', 'flawless_wave', 'hazard_trial', 'timed_clear']);
const chapterOneTrials = api.candidates('event', 1).filter(def => def.family === 'trial').map(def => def.id);
assert.deepStrictEqual(Array.from(chapterOneTrials), ['elite_ambush'], '第一章只能出現菁英伏擊');
const chapterTwoTrials = api.candidates('event', 2).filter(def => def.family === 'trial').map(def => def.id).sort();
assert.deepStrictEqual(Array.from(chapterTwoTrials), Array.from(trialIds), '第二章起四種試煉都應開放');

const seenTrials = new Set();
for (let seed = 1; seed <= 6000; seed++) {
  const id = api.pick('event', seed, 2, []);
  if (api.defs[id].family === 'trial') seenTrials.add(id);
}
for (const id of trialIds) assert.ok(seenTrials.has(id), id + ' 應能由正式 seeded 抽選觸發');

let hazardSpec = null;
for (let seed = 1; seed <= 6000 && !hazardSpec; seed++) {
  api.setRun(seed, []);
  const spec = api.makeRoomSpec('event', 7, 0);
  if (spec.eventId === 'hazard_trial') hazardSpec = spec;
}
assert.ok(hazardSpec, '應能產生地形試煉房間規格');
assert.strictEqual(hazardSpec.hazardId, 'falling_rocks', '地形試煉必須在預覽前綁定當前群系地形');
assert.strictEqual(hazardSpec.biomeId, 'cavern');

const player = { hp:100 };
const spec = { chapter:2 };

let trial = api.create(api.defs.elite_ambush, spec, player, 2000);
assert.strictEqual(trial.status, 'offered');
assert.strictEqual(api.blocks(trial), false, '尚未接受的試煉不得阻擋出口');
assert.strictEqual(api.start(trial, api.defs.elite_ambush, player), true);
assert.strictEqual(api.blocks(trial), true);
for (let i = 0; i < 3; i++) api.defeat(trial);
let transition = api.update(trial, { remainingTrialEnemies:0, playerX:100, tickFrames:0 });
assert.strictEqual(transition.action, 'success');
assert.strictEqual(trial.status, 'success');
assert.strictEqual(api.blocks(trial), false);
assert.strictEqual(api.claim(trial), true, '成功獎勵第一次可領取');
assert.strictEqual(api.claim(trial), false, '成功獎勵不得重複領取');

trial = api.create(api.defs.timed_clear, spec, player, 2000);
api.start(trial, api.defs.timed_clear, player);
assert.strictEqual(api.seconds(trial), 35);
for (let i = 0; i < 3; i++) api.defeat(trial);
transition = api.update(trial, { remainingTrialEnemies:0, playerX:100, tickFrames:60 });
assert.deepStrictEqual({ action:transition.action, wave:transition.wave, count:transition.count }, { action:'spawn_wave', wave:2, count:4 });
assert.strictEqual(trial.status, 'active');
for (let i = 0; i < 4; i++) api.defeat(trial);
transition = api.update(trial, { remainingTrialEnemies:0, playerX:100, tickFrames:60 });
assert.strictEqual(transition.action, 'success');
assert.strictEqual(trial.defeatedCount, 7);

trial = api.create(api.defs.timed_clear, spec, player, 2000);
api.start(trial, api.defs.timed_clear, player);
transition = api.update(trial, { remainingTrialEnemies:3, playerX:100, tickFrames:2100 });
assert.strictEqual(transition.action, 'failed');
assert.strictEqual(transition.reason, 'timeout');
assert.strictEqual(api.blocks(trial), false, '限時失敗後不得卡住出口');
assert.strictEqual(api.claim(trial), false, '失敗不得取得額外獎勵');

trial = api.create(api.defs.flawless_wave, spec, player, 2000);
api.start(trial, api.defs.flawless_wave, player);
assert.strictEqual(api.damage(trial, 0), null, '護盾完全吸收不算受傷');
transition = api.damage(trial, 1);
assert.strictEqual(transition.action, 'failed');
assert.strictEqual(transition.reason, 'damage');
assert.strictEqual(trial.damageTaken, 1);
assert.strictEqual(api.blocks(trial), false, '無傷失敗後不得卡住出口');

trial = api.create(api.defs.hazard_trial, spec, player, 2000);
api.start(trial, api.defs.hazard_trial, player);
for (let i = 0; i < 3; i++) api.defeat(trial);
transition = api.update(trial, { remainingTrialEnemies:0, playerX:trial.targetX - 1, tickFrames:0 });
assert.strictEqual(transition, null, '只清守衛、尚未通過地形時不能成功');
assert.strictEqual(trial.status, 'active');
transition = api.update(trial, { remainingTrialEnemies:0, playerX:trial.targetX, tickFrames:0 });
assert.strictEqual(transition.action, 'success');
assert.strictEqual(trial.crossed, true);

trial = api.create(api.defs.hazard_trial, spec, player, 2000);
assert.strictEqual(api.decline(trial), true);
assert.strictEqual(trial.status, 'declined');
assert.strictEqual(api.blocks(trial), false, '拒絕試煉不得阻擋出口');
assert.strictEqual(api.decline(trial), false, '拒絕結果不可重複套用');

console.log('dungeon D2-E smoke test passed');
