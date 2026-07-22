const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = {
  console, Math, Date,
  player:{ hp:100, mhp:100, eventRerolls:0 },
  meta:{ playerName:'測試勇者' },
  floor:3, portal:{ kind:'next' },
  clearGameInputs() {}, playSfx() {}
};
vm.createContext(context);
const source = [
  fs.readFileSync(path.join(root, 'src/dungeon/data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/modifiers.js'), 'utf8'),
  `
  let __routeCalls = 0, __bossCalls = 0, __chapterCalls = 0;
  openRouteSelection = function () { __routeCalls++; };
  enterDungeonRoom = function () { __bossCalls++; };
  openChapterSummary = function () { __chapterCalls++; };
  function __setup(seed, atFloor) {
    floor = atFloor; portal = { kind:'next' };
    dungeonRun = {
      seed, chapter:Math.floor((atFloor - 1) / 5) + 1, modifierState:createDungeonModifierRunState(seed),
      explorationScore:0, roomHistory:[], eventHistory:[], hazardTutorials:{}, chapterUsed:{ camp:false, treasure:false },
      completedFloor:atFloor, rewardedFloor:atFloor, choices:[], chapterReward:null
    };
    modifierPanel = null; modifierListOpen = false;
    __routeCalls = 0; __bossCalls = 0; __chapterCalls = 0;
  }
  this.api = {
    scheduled:dungeonModifierScheduledAtFloor,
    setup:__setup,
    open:openDungeonModifierTransition,
    reroll:rerollDungeonModifierPanel,
    choose:chooseDungeonModifier,
    decline:declineDungeonModifierPanel,
    panel:() => modifierPanel && JSON.parse(JSON.stringify(modifierPanel)),
    state:() => snapshotDungeonModifierState(dungeonRun.modifierState),
    calls:() => ({ route:__routeCalls, boss:__bossCalls, chapter:__chapterCalls }),
    setFloor:value => { floor = value; portal = { kind:'next' }; },
    saturateBlessings:() => {
      dungeonRun.modifierState.activeBlessings = Object.keys(DUNGEON_BLESSING_DEFS);
      dungeonRun.modifierState.offerSequence = 2;
    }
  };
  `
].join('\n');
vm.runInContext(source, context, { filename:'dungeon-g1e-bundle.js' });
const api = context.api;

const scheduled = [];
for (let floor = 1; floor <= 30; floor++) if (api.scheduled(floor)) scheduled.push(floor);
assert.deepStrictEqual(Array.from(scheduled), [3, 7, 11, 14, 18, 22, 26, 29]);
for (let i = 1; i < scheduled.length; i++) {
  const gap = scheduled[i] - scheduled[i - 1];
  assert.ok(gap === 3 || gap === 4, 'modifier offers must stay 3-4 floors apart');
}

api.setup(5151, 3);
assert.strictEqual(api.open('route'), true);
let panel = api.panel();
assert.strictEqual(panel.offer.kind, 'blessing');
assert.strictEqual(panel.offer.options.length, 3);
assert.strictEqual(new Set(panel.offer.options).size, 3);
assert.strictEqual(context.portal, null, 'opening a modifier must consume the transition portal');
assert.strictEqual(api.choose('not-an-option'), false);
assert.strictEqual(api.reroll(), true);
assert.strictEqual(api.state().rerollsRemaining, 1);
assert.strictEqual(api.decline(), true);
assert.strictEqual(api.panel(), null);
assert.strictEqual(api.state().declines, 1);
assert.strictEqual(api.state().activeBlessings.length, 0, 'safe decline must not grant or remove effects');
assert.strictEqual(JSON.stringify(api.calls()), JSON.stringify({ route:1, boss:0, chapter:0 }));
assert.strictEqual(api.decline(), false, 'settled panels must ignore repeated input');

api.setFloor(7);
assert.strictEqual(api.open('boss'), true);
panel = api.panel();
assert.strictEqual(panel.offer.kind, 'curse', 'offers should alternate blessing then voluntary curse');
const chosenCurse = panel.offer.options[0];
assert.strictEqual(api.choose(chosenCurse), true);
assert.strictEqual(api.state().activeCurses[0], chosenCurse);
assert.strictEqual(JSON.stringify(api.calls()), JSON.stringify({ route:1, boss:1, chapter:0 }));
assert.strictEqual(api.choose(chosenCurse), false, 'repeat taps after settlement must be harmless');

api.saturateBlessings(); api.setFloor(11);
assert.strictEqual(api.open('route'), true);
assert.strictEqual(api.panel().offer.kind, 'curse', 'an exhausted blessing pool must fall back to curses instead of stalling');
assert.strictEqual(api.decline(), true);

const ui = fs.readFileSync(path.join(root, 'src/dungeon/ui.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8');
const input = fs.readFileSync(path.join(root, 'src/game/interface.js'), 'utf8');
const smoke = fs.readFileSync(path.join(root, 'tests/dungeon-smoke.html'), 'utf8');
for (const text of ['選 擇 當 局 祝 福', '選 擇 自 願 詛 咒', '代價', '對應收益', '安全拒絕', '本 局 持 有 效 果']) {
  assert.ok(ui.includes(text), 'modifier UI must show ' + text);
}
assert.ok(ui.includes("key === 'r'"));
assert.ok(ui.includes("key === 'm'"));
assert.ok(ui.includes('modifierRerollBtn'));
assert.ok(ui.includes('modifierDeclineBtn'));
assert.ok(ui.includes('modifierHudBtn'));
assert.ok(core.includes('openDungeonModifierTransition(afterAction)'));
assert.ok(input.includes('const firstTouch = e.changedTouches[0]'), 'modal touch must settle at most once per touchstart');
assert.ok(input.includes('if (eventPanel || dungeonPanelOpen())'));
assert.ok(smoke.includes("mode === 'modifier-offer'"));

console.log('dungeon G1-E modifier UI smoke test passed (3-4 floor cadence, alternating offers, reroll, decline, settlement, desktop/touch/list wiring)');
