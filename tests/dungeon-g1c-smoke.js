const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = { console };
vm.createContext(context);
const source = [
  fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/modifiers.js'), 'utf8'),
  `this.api = {
    blessings:DUNGEON_BLESSING_DEFS,
    defs:DUNGEON_CURSE_DEFS,
    validate:validateDungeonModifierDefinitions,
    create:createDungeonModifierRunState,
    begin:beginDungeonModifierOffer,
    accept:acceptDungeonModifierOffer,
    active:dungeonCurseActive,
    value:dungeonCurseValue,
    heal:dungeonCurseHealingAmount,
    outgoing:dungeonCurseOutgoingDamage,
    incoming:dungeonCurseIncomingDamage,
    baseEnemy:dungeonCurseBaseEnemyHp,
    elite:dungeonCurseEliteStat,
    boss:dungeonCurseBossStat,
    hazard:dungeonCurseHazardDamage,
    shield:dungeonCurseRoomShieldAmount,
    blocksRevive:dungeonCurseBlocksRevive,
    snapshot:snapshotDungeonModifierState
  };`
].join('\n');
vm.runInContext(source, context);
const api = context.api;

const defs = Object.values(api.defs);
assert.strictEqual(defs.length, 12, 'G1-C must ship exactly 12 curses');
assert.strictEqual(api.validate(api.blessings, api.defs).ok, true);
assert.strictEqual(new Set(defs.map(def => def.id)).size, 12);
assert.strictEqual(new Set(defs.map(def => def.risk.type)).size, 12, 'each curse should own a distinct risk contract');
assert.strictEqual(new Set(defs.map(def => def.reward.type)).size, 11, 'only the two soul bargains may share a reward contract');

const categories = defs.reduce((counts, def) => {
  counts[def.category] = (counts[def.category] || 0) + 1;
  assert.ok(def.summary && def.risk.label && def.reward.label, def.id + ' must disclose both sides');
  assert.ok(def.risk.value > 0 && def.risk.value <= def.risk.cap, def.id + ' risk must be bounded');
  assert.ok(def.reward.value > 0 && def.reward.value <= def.reward.cap, def.id + ' reward must be bounded');
  return counts;
}, {});
assert.deepStrictEqual(JSON.parse(JSON.stringify(categories)), { combat:3, arcane:3, survival:3, challenge:3 });
assert.strictEqual(defs.filter(def => def.minChapter === 1).length, 4);
assert.strictEqual(defs.filter(def => def.minChapter === 2).length, 4);
assert.strictEqual(defs.filter(def => def.minChapter === 3).length, 4);

const earlyA = api.begin(api.create(2727), 'curse', { floor:3, chapter:1 }, api.defs);
const earlyB = api.begin(api.create(2727), 'curse', { floor:3, chapter:1 }, api.defs);
assert.strictEqual(JSON.stringify(earlyA), JSON.stringify(earlyB), 'real curse offers must reproduce from the same seed');
assert.strictEqual(earlyA.options.length, 3);
assert.strictEqual(new Set(earlyA.options).size, 3);
assert.ok(earlyA.options.every(id => api.defs[id].minChapter === 1));

const state = api.create(6363);
state.activeCurses.push(...defs.map(def => def.id));
assert.strictEqual(api.active('razor_bargain', state), true);
assert.strictEqual(api.value('razor_bargain', 'risk', state), 0.15);
assert.strictEqual(api.value('razor_bargain', 'reward', state), 0.08);
assert.strictEqual(api.heal(100, state), 65);
assert.ok(Math.abs(api.outgoing(100, state) - 118) < 0.0001);
assert.ok(Math.abs(api.incoming(100, state) - 115) < 0.0001);
assert.ok(Math.abs(api.baseEnemy(100, state) - 118) < 0.0001);
assert.ok(Math.abs(api.elite(100, state) - 125) < 0.0001);
assert.ok(Math.abs(api.boss(100, state) - 120) < 0.0001);
assert.ok(Math.abs(api.hazard(100, state) - 125) < 0.0001);
assert.strictEqual(api.shield(100, state), 15);
assert.strictEqual(api.blocksRevive(state), true);

const sealedState = api.create(4444);
sealedState.pending = { id:'sealed-offer', kind:'curse', floor:12, chapter:3, status:'offered', rerollIndex:0, options:['sealed_fate'] };
const sealedResult = api.accept(sealedState, 'sealed_fate');
assert.strictEqual(sealedResult.status, 'accepted');
assert.strictEqual(sealedState.rerollsRemaining, 0, 'sealed fate must remove remaining modifier rerolls');
const postSealOffer = api.begin(sealedState, 'curse', { floor:13, chapter:3 }, api.defs);
assert.ok(postSealOffer && !postSealOffer.options.includes('sealed_fate'), 'sealed fate must not be offered without remaining rerolls');

const snapshot = api.snapshot(sealedState);
snapshot.activeCurses.push('mutated-copy');
assert.strictEqual(sealedState.activeCurses.length, 1);

const systems = fs.readFileSync(path.join(root, 'src/game/systems.js'), 'utf8');
const run = fs.readFileSync(path.join(root, 'src/game/run.js'), 'utf8');
const bosses = fs.readFileSync(path.join(root, 'src/dungeon/bosses.js'), 'utf8');
const hazards = fs.readFileSync(path.join(root, 'src/dungeon/hazards.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8');
for (const id of ['mana_leak','broken_hourglass','leaden_steps','last_light','razor_bargain','elite_tribute','hardened_horde']) {
  assert.ok(systems.includes(id), id + ' must be wired into shared player calculations');
}
assert.ok(run.includes('dungeonCurseBaseEnemyHp'));
assert.ok(run.includes('dungeonCurseEliteStat'));
assert.ok(run.includes('dungeonCurseOutgoingDamage'));
assert.ok(bosses.includes('dungeonCurseBossStat'));
assert.ok(hazards.includes('dungeonCurseHazardDamage'));
assert.ok(core.includes("dungeonCurseValue('hazard_wager', 'reward')"));
assert.ok(core.includes("dungeonCurseValue('boss_oath', 'reward')"));
assert.ok(core.includes('dungeonCurseRoomShieldAmount'));

console.log('dungeon G1-C curse smoke test passed (12 paired risks/rewards, four categories, caps, sealed fate, runtime wiring)');
