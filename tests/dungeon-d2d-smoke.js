const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'events.js'), 'utf8'),
  `
  function __setD2dRun(seed, history) {
    dungeonRun = {
      seed, chapter:1, explorationScore:0, roomHistory:['safe'], eventHistory:(history || []).slice(),
      hazardTutorials:{}, chapterUsed:{ camp:false, treasure:false }, completedFloor:0, rewardedFloor:0,
      choices:[], chapterReward:null
    };
  }
  globalThis.__d2d = {
    defs:DUNGEON_EVENT_DEFS,
    candidates:dungeonEventCandidatesForRoom,
    historyMultiplier:dungeonEventHistoryMultiplier,
    pick:dungeonEventIdForRoom,
    makeRoomSpec,
    optionViews:dungeonEventOptionViews,
    soulCost:dungeonEventSoulCost,
    runEffect:runDungeonEventEffect,
    setRun:__setD2dRun
  };
  `
].join('\n');

const context = {
  console,
  Math,
  Date,
  mons:[],
  player:{ hp:100, mhp:100 },
  meta:{ playerName:'測試勇者' },
  num:() => {},
  saveMeta:() => {}
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'dungeon-d2d-bundle.js' });
const api = context.__d2d;

const nonTrialIds = Object.values(api.defs).filter(def => def.family !== 'trial').map(def => def.id).sort();
assert.deepStrictEqual(Array.from(nonTrialIds), [
  'ancient_cache', 'arcane_spring', 'blood_blessing', 'echoing_archive', 'fate_altar',
  'forgotten_forge', 'life_spring', 'lost_caravan', 'mimic_chest', 'sealed_chest',
  'supply_crate', 'traveler_chest', 'wandering_alchemist'
]);
for (const id of nonTrialIds) {
  const def = api.defs[id];
  assert.ok(def.desc && def.note && def.color, id + ' 應有完整面板資料');
  assert.ok(def.choices.length >= 2 && def.choices.length <= 3, id + ' 應有 2～3 個動態選項');
  assert.ok(def.choices.every(choice => choice.effectId && choice.detail), id + ' 選項應資料化');
}

const chapterOne = new Set([
  ...api.candidates('treasure', 1),
  ...api.candidates('event', 1)
].map(def => def.id));
assert.deepStrictEqual(Array.from(chapterOne).sort(), [
  'elite_ambush', 'forgotten_forge', 'life_spring', 'lost_caravan',
  'supply_crate', 'traveler_chest', 'wandering_alchemist'
]);

assert.strictEqual(api.historyMultiplier('a', ['x', 'a']), 0, '最近一次事件權重應為 0');
assert.strictEqual(api.historyMultiplier('a', ['a', 'x']), 0, '最近兩次事件權重應為 0');
assert.strictEqual(api.historyMultiplier('a', ['a', 'x', 'y']), 0.25, '再前兩次事件權重應降為 25%');
assert.strictEqual(api.historyMultiplier('a', ['a', 'w', 'x', 'y', 'z']), 1, '更早事件應恢復完整權重');

for (let seed = 1; seed <= 2000; seed++) {
  const history = ['life_spring', 'blood_blessing'];
  const pickedA = api.pick('event', seed, 2, history);
  const pickedB = api.pick('event', seed, 2, history);
  assert.strictEqual(pickedA, pickedB, '同種子與歷史必須重現事件');
  assert.ok(!history.includes(pickedA), '仍有候選時不得重複最近兩個事件');
}

const seen = new Set();
for (let seed = 1; seed <= 5000; seed++) {
  seen.add(api.pick('treasure', seed, 2, []));
  seen.add(api.pick('event', seed, 2, []));
}
for (const id of nonTrialIds) assert.ok(seen.has(id), id + ' 應能由正式 seeded 選取觸發');

function makeState(overrides) {
  const base = {
    player:{ hp:100, mhp:100, mp:20, mmp:80, slotCd:[100, 41, 1], bag:{ hp:0, mp:0 }, eventAtk:0, eventRerolls:0 },
    meta:{ mats:{ enh:0, ench:0, set:0 } },
    souls:20,
    status:'idle'
  };
  if (overrides) Object.assign(base, overrides);
  return base;
}
function makeHooks(state) {
  const calls = { drops:[], mimic:0, ambush:0, saves:0 };
  return {
    calls,
    hooks:{
      getSouls:() => state.souls,
      spendSouls:amount => { state.souls -= amount; },
      gainSouls:amount => { state.souls += amount; },
      dropGear:(rarity, source) => calls.drops.push([rarity, source]),
      spawnMimic:() => { calls.mimic++; },
      spawnAmbush:() => { calls.ambush++; },
      save:() => { calls.saves++; }
    }
  };
}
const spec2 = { chapter:2 };

let state = makeState();
let hookSet = makeHooks(state);
let outcome = api.runEffect('traveler_reward', api.defs.traveler_chest, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'done');
assert.deepStrictEqual(hookSet.calls.drops[0], [1, 'event']);
assert.strictEqual(state.meta.mats.ench, 1);

for (const [effectId, bagKey] of [['supply_hp', 'hp'], ['supply_mp', 'mp']]) {
  state = makeState(); hookSet = makeHooks(state);
  outcome = api.runEffect(effectId, api.defs.supply_crate, spec2, state, hookSet.hooks);
  assert.strictEqual(state.player.bag[bagKey], 1);
  assert.strictEqual(outcome.status, 'done');
}
state = makeState(); hookSet = makeHooks(state);
api.runEffect('supply_gear', api.defs.supply_crate, spec2, state, hookSet.hooks);
assert.deepStrictEqual(hookSet.calls.drops[0], [0, 'event']);

state = makeState({ souls:11 }); hookSet = makeHooks(state);
outcome = api.runEffect('sealed_reward', api.defs.sealed_chest, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.ok, false, '靈魂不足不得扣款或發獎');
assert.strictEqual(state.souls, 11);
assert.strictEqual(hookSet.calls.drops.length, 0);
let views = api.optionViews(api.defs.sealed_chest, spec2, state);
assert.strictEqual(views[0].enabled, false);
assert.ok(views[0].detail.includes('靈魂 12'));

state = makeState({ souls:12 }); hookSet = makeHooks(state);
outcome = api.runEffect('sealed_reward', api.defs.sealed_chest, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'done');
assert.strictEqual(state.souls, 0);
assert.deepStrictEqual(hookSet.calls.drops[0], [2, 'event']);
assert.strictEqual(api.soulCost(api.defs.sealed_chest, { chapter:3 }), 16);

state = makeState(); state.player.hp = 20; hookSet = makeHooks(state);
outcome = api.runEffect('blood_blessing', api.defs.blood_blessing, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.ok, false, '血量不足時不得接受血之祝福');
assert.strictEqual(state.player.eventAtk, 0);
state.player.hp = 100;
outcome = api.runEffect('blood_blessing', api.defs.blood_blessing, spec2, state, hookSet.hooks);
assert.strictEqual(state.player.hp, 80);
assert.strictEqual(state.player.eventAtk, 0.12);

state = makeState(); state.player.hp = 50; state.player.mp = 0; hookSet = makeHooks(state);
api.runEffect('life_spring', api.defs.life_spring, spec2, state, hookSet.hooks);
assert.strictEqual(state.player.hp, 85);
assert.strictEqual(state.player.mp, 40);

state = makeState(); hookSet = makeHooks(state);
api.runEffect('arcane_spring', api.defs.arcane_spring, spec2, state, hookSet.hooks);
assert.strictEqual(state.player.mp, 80);
assert.deepStrictEqual(Array.from(state.player.slotCd), [75, 30, 0]);

state = makeState(); hookSet = makeHooks(state);
api.runEffect('fate_altar', api.defs.fate_altar, spec2, state, hookSet.hooks);
assert.strictEqual(state.player.eventRerolls, 1);

state = makeState(); hookSet = makeHooks(state);
outcome = api.runEffect('mimic_fight', api.defs.mimic_chest, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'combat');
assert.strictEqual(hookSet.calls.mimic, 1);

state = makeState(); hookSet = makeHooks(state);
outcome = api.runEffect('decline', api.defs.life_spring, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'declined');
state.status = 'done';
outcome = api.runEffect('life_spring', api.defs.life_spring, spec2, state, hookSet.hooks);
assert.strictEqual(outcome.ok, false, '重複互動不得再次發獎');

console.log('dungeon D2-D smoke test passed');
