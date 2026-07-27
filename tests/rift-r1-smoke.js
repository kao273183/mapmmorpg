// R1 秘境分層 smoke 測試：層級縮放、T1 不得改動既有體驗、解鎖與存檔、選層夾制。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const dataSrc = read('src', 'dungeon', 'data.js');
const runSrc = read('src', 'game', 'run.js');
const townSrc = read('src', 'game', 'town.js');
const interfaceSrc = read('src', 'game', 'interface.js');

const storage = new Map();
const context = {
  console, Math, Object, JSON, Array, Number, String, Boolean, Date,
  parseInt, parseFloat, isNaN, isFinite,
  RARITY_COL: ['#e8e8e8', '#6f9dff', '#ffd23e', '#c060ff', '#ff8020'],
  RARITY_NAME: ['普通', '精良', '稀有', '史詩', '傳說'],
  RARITY_ABBR: ['普', '精', '稀', '史', '傳'],
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  },
  player: { cls: 'warrior', eq: {} },
  playSfx: () => {}
};
vm.createContext(context);
// const/let 不會掛到 vm context 上（只有 var 與函式宣告會），要顯式匯出
const EXPORTS = `globalThis.__rift = { RIFT_STEP, RIFT_MAX_TIER, riftScale, riftClampTier, setRiftTier,
  currentRiftScale, dungeonMonHpMul, dungeonMonDmgMul, dungeonSoulMul, dungeonMasteryXpMul,
  dungeonUniqueRateMul, dungeonBossHpMul, dungeonBossDmgMul, dungeonDropMul, dungeonMaxRarity,
  setTerrainMode, meta, saveMeta, unlockNextRiftTier, riftTierUnlocked };`;
const bundle = src => dataSrc + '\n' + read('src', 'game', 'progression.js') + '\n' + EXPORTS;
vm.runInContext(bundle(), context, { filename: 'rift-bundle.js' });
const api = Object.assign({}, context.__rift, { get riftTier() { return context.__rift.setRiftTier ? context.riftTier : 1; } });
Object.defineProperty(api, 'meta', { get: () => context.__rift.meta });

// ── 1. T1 必須完全等同改版前的困難 ────────────────────────────────────────
// 這是 R1 對既有玩家的承諾：舊存檔一律 T1，體驗不能有任何變化。
const one = api.riftScale(1);
for (const k of Object.keys(api.RIFT_STEP)) {
  assert.strictEqual(one[k], 1, 'T1 的 ' + k + ' 必須是 1.0，否則等於偷偷改動既有的困難模式');
}
api.setTerrainMode('complex');
api.meta.riftTier = api.RIFT_MAX_TIER;      // 讓選層不被解鎖上限擋住
api.setRiftTier(1);
assert.strictEqual(api.dungeonMaxRarity(), 4, '秘境 T1 仍應可掉傳說（與改版前的困難一致）');
assert.strictEqual(api.dungeonBossHpMul(), 1, 'T1 的 Boss 生命倍率應為 1');
assert.strictEqual(api.dungeonBossDmgMul(), 1, 'T1 的 Boss 傷害倍率應為 1');
assert.strictEqual(api.dungeonDropMul(), 1, 'T1 的掉落倍率應為 1');

// ── 2. 層級縮放 ───────────────────────────────────────────────────────────
const five = api.riftScale(5);
for (const k of Object.keys(api.RIFT_STEP)) {
  assert.strictEqual(+five[k].toFixed(6), +(1 + api.RIFT_STEP[k] * 4).toFixed(6), k + ' 的 T5 倍率不符線性遞增');
  assert.ok(api.riftScale(api.RIFT_MAX_TIER)[k] > five[k], k + ' 應隨層級遞增');
}
// 傷害要漲得比血量慢，否則高層變成「被秒」而不是「打得更久」
assert.ok(api.RIFT_STEP.monDmg < api.RIFT_STEP.monHp, '怪物傷害的遞增速度必須低於血量');
assert.ok(api.RIFT_STEP.bossDmg < api.RIFT_STEP.bossHp, 'Boss 傷害的遞增速度必須低於血量');
// 風險漲得比報酬快才有取捨；但報酬也要真的有感
assert.ok(api.RIFT_STEP.soul > 0 && api.RIFT_STEP.mastery > 0 && api.RIFT_STEP.drop > 0, '報酬面必須隨層級提升');

// 夾制：超界、負數、非數字都要落在合法範圍
for (const bad of [0, -3, 99, 'abc', undefined, null, NaN, 1.4]) {
  const t = api.riftScale(bad).tier;
  assert.ok(t >= 1 && t <= api.RIFT_MAX_TIER && Number.isInteger(t), 'riftScale(' + String(bad) + ') 應夾制到合法層級，實際 ' + t);
}

// ── 3. 每個縮放面向都要有消費端，否則加了等於沒加 ──────────────────────────
// 用原始碼判定而非硬寫清單：日後新增面向也會自動要求接線。
const allSrc = dataSrc + runSrc + read('src', 'game', 'systems.js') + read('src', 'game', 'progression.js');
const CONSUMER = {
  monHp: /dungeonMonHpMul\(\)/, monDmg: /dungeonMonDmgMul\(\)/,
  bossHp: /currentRiftScale\(\)\.bossHp/, bossDmg: /currentRiftScale\(\)\.bossDmg/,
  drop: /currentRiftScale\(\)\.drop/, unique: /dungeonUniqueRateMul\(\)/,
  soul: /dungeonSoulMul\(\)/, mastery: /dungeonMasteryXpMul\(\)/
};
for (const k of Object.keys(api.RIFT_STEP)) {
  assert.ok(CONSUMER[k], k + ' 是新增的縮放面向，請在本測試登記它的消費端');
  assert.ok(CONSUMER[k].test(allSrc), k + ' 的倍率沒有任何消費端，設定了也不會生效');
}
// 血量與傷害必須走不同的掛勾，否則兩者會被綁成同一個遞增速度
assert.ok(/monsterHp\(base, sc, n, extraMul = 1\)[\s\S]{0,400}dungeonMonHpMul\(\)/.test(runSrc),
  '怪物血量的層級縮放應套在 monsterHp（唯一入口）');
assert.ok(/const dsc = sc \* \(\(typeof dungeonMonDmgMul/.test(runSrc),
  '怪物傷害的層級縮放應走獨立的 dsc，與血量分開');
assert.ok(!/dmg: ?Math\.round\(\d+ \* sc\)/.test(runSrc.slice(runSrc.indexOf('function spawnMon'), runSrc.indexOf('function currentFloorEventDef'))),
  'spawnMon 裡還有沒吃到層級縮放的 dmg');

// ── 4. 一般模式不受層級影響（維持入門定位）──────────────────────────────
api.setTerrainMode('normal');
api.setRiftTier(api.RIFT_MAX_TIER);
assert.strictEqual(api.dungeonMonHpMul(), 1, '一般模式不該吃秘境層級');
assert.strictEqual(api.dungeonMonDmgMul(), 1, '一般模式不該吃秘境層級');
assert.strictEqual(api.dungeonSoulMul(), 1, '一般模式不該吃秘境靈魂加成');
assert.strictEqual(api.dungeonMasteryXpMul(), 1, '一般模式不該吃秘境精通加成');
assert.strictEqual(api.dungeonMaxRarity(), 1, '一般模式仍是最高藍裝');
api.setTerrainMode('complex');

// ── 5. 解鎖與存檔 ─────────────────────────────────────────────────────────
api.meta.riftTier = 1;
assert.strictEqual(api.riftTierUnlocked(), 1, '全新存檔應只解鎖 T1');
assert.strictEqual(api.unlockNextRiftTier(1), true, '清掉 T1 Boss 應解鎖 T2');
assert.strictEqual(api.meta.riftTier, 2, '解鎖後應為 T2');
assert.strictEqual(api.unlockNextRiftTier(1), false, '重複清同一層不該再往上解鎖');
api.meta.riftTier = api.RIFT_MAX_TIER;   // 已在最高層
assert.strictEqual(api.unlockNextRiftTier(api.RIFT_MAX_TIER), false, '最高層之後沒有可解鎖的層');
assert.strictEqual(api.meta.riftTier, api.RIFT_MAX_TIER, '解鎖層不得超過上限');

// 選層不得超過已解鎖（UI 的 ＋ 鈕有擋，但函式本身也要擋——舊的 localStorage 值會繞過）
api.meta.riftTier = 3;
assert.strictEqual(api.setRiftTier(9), 3, '選層不得超過已解鎖的最高層');
assert.strictEqual(api.setRiftTier(2), 2, '已解鎖範圍內應可自由選');
assert.strictEqual(api.setRiftTier(0), 1, '選層下限為 T1');

// 存檔往返
api.meta.riftTier = 6;
api.saveMeta();
const saved = JSON.parse(storage.get('pixelrogue_save'));
assert.strictEqual(saved.rt, 6, '已解鎖層應寫進存檔的 rt 欄位');
// 舊存檔（沒有 rt）＝ T1
delete saved.rt;
storage.set('pixelrogue_save', JSON.stringify(saved));
const fresh = Object.assign({}, context, { player: { cls: 'warrior', eq: {} } });
vm.createContext(fresh);
vm.runInContext(bundle(), fresh, { filename: 'rift-legacy.js' });
assert.strictEqual(fresh.__rift.meta.riftTier, 1, '沒有 rt 欄位的舊存檔應視為只解鎖 T1');

// 載入時的選層還原要能被夾回（data.js 比 progression.js 早載入，當下還沒有 meta）
assert.ok(/function revalidateRiftTier\(\)/.test(dataSrc), '應有 revalidateRiftTier 供載入後夾制');
assert.ok(/revalidateRiftTier\(\)/.test(read('src', 'game', 'main.js')), 'main.js 應在全部載入後呼叫 revalidateRiftTier');
assert.ok(/typeof riftTierUnlocked === 'function'/.test(dataSrc), 'setRiftTier 應以 typeof 守衛跨檔呼叫（載入順序）');

// ── 6. 解鎖掛勾與 UI ──────────────────────────────────────────────────────
assert.ok(/unlockNextRiftTier\(riftTier\)/.test(runSrc), '擊敗 Boss 處應呼叫 unlockNextRiftTier');
assert.ok(/!activeDungeonBenchmarkId && terrainMode === 'complex'/.test(runSrc),
  '解鎖判定應排除基準局並限定困難模式，否則基準測試會污染進度');
for (const act of ['riftUp', 'riftDown']) {
  assert.ok(new RegExp("'" + act + "'").test(townSrc), 'town.js 應有 ' + act + ' 按鈕');
  assert.ok(new RegExp("b\\.act === '" + act + "'").test(interfaceSrc), 'interface.js 應處理 ' + act + ' 點擊');
}
assert.ok(/Math\.min\(riftTier \+ 1, riftTierUnlocked\(\)\)/.test(interfaceSrc), '＋ 鈕不得超過已解鎖層');

console.log('✓ R1 秘境 smoke 測試通過（T1 等同改版前・T1–T' + api.RIFT_MAX_TIER + ' 縮放與消費端・' +
  '一般模式不受影響・解鎖與存檔往返・選層夾制）');
