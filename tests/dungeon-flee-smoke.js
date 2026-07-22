// 逃走機制 smoke 測試：道中長按逃走蓄力、受擊中斷、放開重置、完成後以撤退結算。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'game', 'run.js'), 'utf8') + `
globalThis.__flee = {
  updateFleeChannel, fleeChannelActive, fleeChannelProgress, interruptFleeChannel, FLEE_CHANNEL_FRAMES
};`;

// 提供 run.js 內 endRun 撤退路徑所需的最小全域樁，讓逃走走完真實結算。
const context = {
  console, Math,
  gameState:'play',
  keys:{ q:true },
  lastDamageSource:'',
  eventPanel:undefined,
  activeDungeonBenchmarkId:null,
  soulsRun:0, soulGainMul:() => 1,
  meta:{ souls:0 },
  player:{ items:[] },
  stashGear:() => false,
  kills:0, floor:3, bestFloor:0,
  lastRun:null,
  saveMeta:() => {}, setHint:() => {}, playSfx:() => {}, beep:() => {}
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'flee-bundle.js' });
const api = context.__flee;

const tick = n => { for (let i = 0; i < n; i++) context.updateFleeChannel(); };

// 1. 長按會逐幀蓄力。
context.keys.q = true;
tick(45);
assert.ok(api.fleeChannelActive(), '長按逃走鍵應開始蓄力');
assert.ok(api.fleeChannelProgress() > 0.4 && api.fleeChannelProgress() < 0.6, '蓄力進度應與時間成正比');

// 2. 受擊（interruptFleeChannel）會中斷蓄力。
api.interruptFleeChannel();
assert.strictEqual(api.fleeChannelActive(), false, '受擊應中斷逃走蓄力');
assert.strictEqual(api.fleeChannelProgress(), 0);

// 3. 放開逃走鍵會重置。
tick(20);
assert.ok(api.fleeChannelActive(), '重新長按應再次蓄力');
context.keys.q = false;
tick(1);
assert.strictEqual(api.fleeChannelActive(), false, '放開逃走鍵應重置蓄力');

// 4. 蓄滿後以撤退結算（不算死亡），來源標記為主動逃走。
context.gameState = 'play';
context.keys.q = true;
tick(api.FLEE_CHANNEL_FRAMES);
assert.strictEqual(context.gameState, 'dead', '逃走後進入結算畫面');
assert.ok(context.lastRun && context.lastRun.result === 'extract', '逃走應以撤退結算而非死亡');
assert.strictEqual(context.lastDamageSource, '主動逃走', '逃走來源標記應為主動逃走');
assert.strictEqual(api.fleeChannelActive(), false, '逃走後蓄力歸零');

// 5. 非遊戲中或事件面板開啟時不蓄力。
context.gameState = 'play'; context.keys.q = true; tick(10);
assert.ok(api.fleeChannelActive());
context.eventPanel = { open:true }; tick(1);
assert.strictEqual(api.fleeChannelActive(), false, '事件面板開啟時不應蓄力');
context.eventPanel = undefined;
context.gameState = 'town'; context.keys.q = true; tick(10);
assert.strictEqual(api.fleeChannelActive(), false, '非地城遊玩時不應蓄力');

console.log('dungeon flee smoke test passed');
