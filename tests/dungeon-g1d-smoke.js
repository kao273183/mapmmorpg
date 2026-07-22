const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = { console, Math, Date, player:{ hp:100, mhp:100 }, meta:{ playerName:'測試勇者' }, mons:[], num() {}, saveMeta() {} };
vm.createContext(context);
const source = [
  fs.readFileSync(path.join(root, 'src/dungeon/data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/modifiers.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/events.js'), 'utf8'),
  `this.api = {
    defs:DUNGEON_EVENT_DEFS,
    candidates:dungeonEventCandidatesForRoom,
    pick:dungeonEventIdForRoom,
    optionViews:dungeonEventOptionViews,
    soulCost:dungeonEventSoulCost,
    soulReward:dungeonEventSoulReward,
    runEffect:runDungeonEventEffect
  };`
].join('\n');
vm.runInContext(source, context, { filename:'dungeon-g1d-bundle.js' });
const api = context.api;

const ignored = new Set(['decline', 'start_trial', 'elite_ambush']);
const resultIds = new Set();
for (const def of Object.values(api.defs)) {
  for (const choice of def.choices || []) if (!ignored.has(choice.effectId)) resultIds.add(choice.effectId);
}
assert.strictEqual(Object.keys(api.defs).length, 17, 'G1-D should expand the event roster from 12 to 17');
assert.strictEqual(resultIds.size, 20, 'G1-D must provide at least 20 distinct non-decline event results');

const newEvents = ['forgotten_forge', 'wandering_alchemist', 'echoing_archive', 'lost_caravan', 'ancient_cache'];
for (const id of newEvents) {
  const def = api.defs[id];
  assert.ok(def && def.desc && def.note && def.previewTag && def.color, id + ' must have full preview data');
  assert.strictEqual(def.choices.length, 3);
  assert.strictEqual(def.choices.filter(choice => choice.effectId === 'decline').length, 1, id + ' must have one safe decline');
  assert.strictEqual(def.choices.filter(choice => choice.effectId !== 'decline').length, 2);
}

const chapterOne = new Set([
  ...api.candidates('treasure', 1), ...api.candidates('event', 1)
].map(def => def.id));
assert.ok(chapterOne.has('forgotten_forge') && chapterOne.has('wandering_alchemist') && chapterOne.has('lost_caravan'));
assert.ok(!chapterOne.has('echoing_archive') && !chapterOne.has('ancient_cache'), 'chapter-two events must stay gated');

const seen = new Set();
for (let seed = 1; seed <= 6000; seed++) {
  const treasureA = api.pick('treasure', seed, 3, []);
  const treasureB = api.pick('treasure', seed, 3, []);
  const eventA = api.pick('event', seed, 3, []);
  const eventB = api.pick('event', seed, 3, []);
  assert.strictEqual(treasureA, treasureB);
  assert.strictEqual(eventA, eventB);
  seen.add(treasureA); seen.add(eventA);
}
for (const id of Object.keys(api.defs)) assert.ok(seen.has(id), id + ' must be reachable through seeded formal selection');

function makeState(overrides) {
  const state = {
    player:{ hp:40, mhp:100, mp:10, mmp:80, slotCd:[120, 60, 1], bag:{ hp:0, mp:0 }, eventAtk:0, eventRerolls:0 },
    meta:{ mats:{ enh:0, ench:0, set:0 } }, souls:30, status:'idle'
  };
  return Object.assign(state, overrides || {});
}
function hooksFor(state) {
  const calls = { drops:[], saves:0 };
  return {
    calls,
    hooks:{
      getSouls:() => state.souls,
      spendSouls:amount => { state.souls -= amount; },
      gainSouls:amount => { state.souls += amount; },
      dropGear:(rarity, source) => calls.drops.push([rarity, source]),
      save:() => { calls.saves++; }
    }
  };
}
const spec1 = { chapter:1 }, spec2 = { chapter:2 }, spec3 = { chapter:3 };

let state = makeState(), hookSet = hooksFor(state);
let outcome = api.runEffect('forge_temper', api.defs.forgotten_forge, spec1, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'done'); assert.strictEqual(state.player.eventAtk, 0.06);
state = makeState(); hookSet = hooksFor(state);
api.runEffect('forge_salvage', api.defs.forgotten_forge, spec1, state, hookSet.hooks);
assert.strictEqual(state.meta.mats.enh, 2); assert.strictEqual(hookSet.calls.saves, 1);

state = makeState(); hookSet = hooksFor(state);
api.runEffect('alchemy_bundle', api.defs.wandering_alchemist, spec1, state, hookSet.hooks);
assert.strictEqual(state.player.bag.hp, 1); assert.strictEqual(state.player.bag.mp, 1);
state = makeState(); hookSet = hooksFor(state);
api.runEffect('alchemy_restoration', api.defs.wandering_alchemist, spec1, state, hookSet.hooks);
assert.strictEqual(state.player.hp, 90); assert.strictEqual(state.player.mp, 50);

state = makeState(); hookSet = hooksFor(state);
api.runEffect('archive_cooldown', api.defs.echoing_archive, spec2, state, hookSet.hooks);
assert.strictEqual(state.player.mp, 80); assert.deepStrictEqual(Array.from(state.player.slotCd), [0, 0, 0]);
state = makeState(); hookSet = hooksFor(state);
api.runEffect('archive_fate', api.defs.echoing_archive, spec2, state, hookSet.hooks);
assert.strictEqual(state.player.eventRerolls, 2);

state = makeState(); hookSet = hooksFor(state);
api.runEffect('caravan_supplies', api.defs.lost_caravan, spec1, state, hookSet.hooks);
assert.strictEqual(state.player.bag.hp, 2);
state = makeState({ souls:12 }); hookSet = hooksFor(state);
outcome = api.runEffect('caravan_trade', api.defs.lost_caravan, spec3, state, hookSet.hooks);
assert.strictEqual(outcome.ok, false); assert.strictEqual(state.souls, 12); assert.strictEqual(hookSet.calls.drops.length, 0);
state.souls = 13;
outcome = api.runEffect('caravan_trade', api.defs.lost_caravan, spec3, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'done'); assert.strictEqual(state.souls, 0); assert.deepStrictEqual(hookSet.calls.drops[0], [2, 'event']);

state = makeState(); hookSet = hooksFor(state);
api.runEffect('cache_dust', api.defs.ancient_cache, spec2, state, hookSet.hooks);
assert.strictEqual(state.meta.mats.ench, 2); assert.strictEqual(hookSet.calls.saves, 1);
state = makeState(); hookSet = hooksFor(state);
api.runEffect('cache_souls', api.defs.ancient_cache, spec3, state, hookSet.hooks);
assert.strictEqual(api.soulReward(api.defs.ancient_cache, spec3), 12); assert.strictEqual(state.souls, 42);

const tradeViews = api.optionViews(api.defs.lost_caravan, spec3, makeState({ souls:12 }));
assert.strictEqual(tradeViews[1].enabled, false); assert.ok(tradeViews[1].detail.includes('靈魂 13'));
const cacheViews = api.optionViews(api.defs.ancient_cache, spec3, makeState());
assert.ok(cacheViews[1].detail.includes('靈魂 12'));

state = makeState(); hookSet = hooksFor(state);
outcome = api.runEffect('decline', api.defs.forgotten_forge, spec1, state, hookSet.hooks);
assert.strictEqual(outcome.status, 'declined'); assert.strictEqual(state.player.eventAtk, 0);
state.status = 'done';
outcome = api.runEffect('forge_temper', api.defs.forgotten_forge, spec1, state, hookSet.hooks);
assert.strictEqual(outcome.ok, false, 'finished events must not award a second result');

console.log('dungeon G1-D event expansion smoke test passed (17 events, 20 results, seed reachability, costs, decline, single settlement)');
