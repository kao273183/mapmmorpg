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
    defs:DUNGEON_BLESSING_DEFS,
    curses:DUNGEON_CURSE_DEFS,
    validate:validateDungeonModifierDefinitions,
    create:createDungeonModifierRunState,
    begin:beginDungeonModifierOffer,
    active:dungeonBlessingActive,
    value:dungeonBlessingValue,
    heal:dungeonBlessingHealingAmount,
    damage:dungeonBlessingDamageForTarget,
    shield:dungeonBlessingRoomShieldAmount,
    dash:dungeonBlessingDashCooldown,
    consume:consumeDungeonBlessingCharge,
    snapshot:snapshotDungeonModifierState
  };`
].join('\n');
vm.runInContext(source, context);
const api = context.api;

const defs = Object.values(api.defs);
assert.strictEqual(defs.length, 12, 'G1-B must ship exactly 12 blessings');
assert.strictEqual(api.validate(api.defs, api.curses).ok, true);
assert.strictEqual(new Set(defs.map(def => def.id)).size, 12);
assert.strictEqual(new Set(defs.map(def => def.effect.type)).size, 12, 'each blessing should own a distinct integration contract');

const categories = defs.reduce((counts, def) => {
  counts[def.category] = (counts[def.category] || 0) + 1;
  assert.ok(def.effect.label && def.summary, def.id + ' must be previewable');
  assert.ok(def.effect.value > 0 && def.effect.value <= def.effect.cap, def.id + ' must have a bounded positive value');
  return counts;
}, {});
assert.deepStrictEqual(JSON.parse(JSON.stringify(categories)), { attack:3, defense:3, mobility:3, resource:3 });
for (const chapter of [1, 2, 3]) assert.strictEqual(defs.filter(def => def.minChapter === chapter).length, 4);

const earlyA = api.begin(api.create(9191), 'blessing', { floor:3, chapter:1 }, api.defs);
const earlyB = api.begin(api.create(9191), 'blessing', { floor:3, chapter:1 }, api.defs);
assert.strictEqual(JSON.stringify(earlyA), JSON.stringify(earlyB), 'real blessing offers must reproduce from the same seed');
assert.strictEqual(earlyA.options.length, 3);
assert.strictEqual(new Set(earlyA.options).size, 3);
assert.ok(earlyA.options.every(id => api.defs[id].minChapter === 1), 'later blessings must remain chapter-gated');

const state = api.create(8181);
assert.strictEqual(api.value('sunsteel_edge', state), 0);
state.activeBlessings.push(...defs.map(def => def.id));
assert.strictEqual(api.active('sunsteel_edge', state), true);
assert.strictEqual(api.value('sunsteel_edge', state), 0.15);
assert.strictEqual(api.value('executioner', state), 1);
assert.strictEqual(api.value('hunter_mark', state), 0.20);
assert.strictEqual(api.value('oak_heart', state), 0.15);
assert.strictEqual(api.value('wind_stride', state), 0.40);
assert.strictEqual(api.value('aerial_grace', state), 1);
assert.strictEqual(api.value('soul_bloom', state), 0.15);
assert.strictEqual(api.value('treasure_eye', state), 0.08);

assert.strictEqual(api.heal(100, state), 130);
// 一般敵人（未提供血量）不觸發處決；斬殺線僅對瀕死目標生效。
assert.ok(Math.abs(api.damage(100, { type:'slime', elite:false }, state) - 115) < 0.0001);
assert.ok(Math.abs(api.damage(100, { type:'slime', elite:true }, state) - 138) < 0.0001);
assert.ok(Math.abs(api.damage(100, { type:'boss' }, state) - 138) < 0.0001);
// 處決之刃：目標 HP 低於 30% 時追加 +100%。
assert.ok(Math.abs(api.damage(100, { type:'slime', elite:false, hp:20, mhp:100 }, state) - 230) < 0.0001);
assert.ok(Math.abs(api.damage(100, { type:'slime', elite:false, hp:50, mhp:100 }, state) - 115) < 0.0001);
assert.strictEqual(api.shield(100, state), 12);
assert.strictEqual(api.dash(120, state), 84);
assert.strictEqual(api.consume('fate_thread', state), true);
assert.strictEqual(api.consume('fate_thread', state), false, 'fate thread must grant only one card reroll');

const snapshot = api.snapshot(state);
snapshot.uses.fate_thread = 99;
assert.strictEqual(state.uses.fate_thread, 1, 'snapshot uses must not mutate the live run');

const systems = fs.readFileSync(path.join(root, 'src/game/systems.js'), 'utf8');
const run = fs.readFileSync(path.join(root, 'src/game/run.js'), 'utf8');
const update = fs.readFileSync(path.join(root, 'src/game/update.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8');
const events = fs.readFileSync(path.join(root, 'src/dungeon/events.js'), 'utf8');
for (const id of ['oak_heart', 'wind_stride', 'soul_bloom', 'treasure_eye', 'fate_thread']) {
  assert.ok(systems.includes(id), id + ' must be wired into shared player calculations');
}
assert.ok(run.includes('dungeonBlessingDamageForTarget'), '處決之刃／獵手印記透過命中傷害整合');
assert.ok(run.includes('blessingHeal'));
assert.ok(update.includes('dungeonBlessingDashCooldown'));
assert.ok(update.includes('dungeonBlessingDashInvincible'), '迅捷殘影的無敵衝刺需接入衝刺流程');
assert.ok(update.includes('dungeonBlessingHasDoubleJump'), '天穹恩典的二段跳需接入跳躍流程');
assert.ok(core.includes('dungeonBlessingRoomShieldAmount'));
assert.ok(core.includes('dungeonBlessingHealingAmount'));
assert.ok(events.includes('dungeonBlessingHealingAmount'));

console.log('dungeon G1-B blessing smoke test passed (12 definitions, four categories, caps, combat/resource wiring)');
