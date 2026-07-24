// J1-E smoke 測試：精通外觀獎勵（稱號／配色）的資料完整性、發放門檻、選用規則與重上色對照表。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const systemsSrc = fs.readFileSync(path.join(root, 'src', 'game', 'systems.js'), 'utf8');
function extract(src, re, label) {
  const m = src.match(re);
  assert.ok(m, label + ' 找不到');
  return m[0];
}
const source = [
  extract(systemsSrc, /const CLASSES = \{[\s\S]*?\n\};/, 'CLASSES'),
  extract(systemsSrc, /function baseClassOf\(cls\) \{.*?\}/, 'baseClassOf'),
  extract(systemsSrc, /function isAdvancedClass\(cls\) \{.*?\}/, 'isAdvancedClass'),
  extract(systemsSrc, /function baseClassIds\(\) \{.*?\}/, 'baseClassIds'),
  extract(systemsSrc, /function advancedJobsFor\(base\) \{.*?\}/, 'advancedJobsFor'),
  fs.readFileSync(path.join(root, 'src', 'game', 'progression.js'), 'utf8'),
  `globalThis.__j1e = {
    CLASSES, meta, TITLE_DEFS, COLOR_DEFS, MASTERY_COSMETIC_TABLE, MASTERY_MAX_LEVEL,
    masteryRewardsFor, syncMasteryCosmetics, equippedRecolor, equippedTitleText, equippedTitleColor,
    ownedCosmetics, ownsCosmetic, equipCosmetic, equippedCosmetic, cosmeticDef, ensureCosmeticState,
    ensureMasteryState, masteryLevel, masteryXpForNext, saveMeta
  };`
].join('\n');

const storage = new Map();
const context = {
  console, Math, Object, JSON, Array, Number, String, Boolean, Date,
  parseInt, parseFloat, isNaN,
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
vm.runInContext(source, context, { filename: 'j1e-bundle.js' });
const api = context.__j1e;

const jobs = Object.keys(api.CLASSES);
const xpTo = lv => { let x = 0; for (let i = 1; i < lv; i++) x += api.masteryXpForNext(i); return x; }; // 升到 lv 所需累積經驗

// 1. 每個職業都要有完整的獎勵軌，不能有職業被漏掉
assert.strictEqual(Object.keys(api.MASTERY_COSMETIC_TABLE).sort().join(','), jobs.slice().sort().join(','),
  '每個職業都要有精通外觀獎勵表');
assert.strictEqual(Object.keys(api.COLOR_DEFS).length, jobs.length * 2, '每職 2 個配色');
assert.strictEqual(Object.keys(api.TITLE_DEFS).length, jobs.length * 2, '每職 2 個稱號');
const allIds = Object.keys(api.COLOR_DEFS).concat(Object.keys(api.TITLE_DEFS));
assert.strictEqual(new Set(allIds).size, allIds.length, '外觀 id 不可重複');
const allNames = Object.values(api.COLOR_DEFS).map(d => d.name).concat(Object.values(api.TITLE_DEFS).map(d => d.name));
assert.strictEqual(new Set(allNames).size, allNames.length, '外觀名稱不可重複');

for (const job of jobs) {
  const rewards = api.masteryRewardsFor(job);
  assert.strictEqual(rewards.length, 4, job + ' 應有 4 個獎勵');
  for (let i = 1; i < rewards.length; i++) {
    assert.ok(rewards[i].lv > rewards[i - 1].lv, job + ' 獎勵等級應嚴格遞增');
  }
  for (const r of rewards) {
    assert.ok(r.lv >= 1 && r.lv <= api.MASTERY_MAX_LEVEL, job + ' 獎勵等級 ' + r.lv + ' 超出 1–30');
    assert.ok(api.cosmeticDef(r.type, r.id), job + ' 的 ' + r.id + ' 沒有對應定義');
    assert.ok(/^#[0-9a-f]{6}$/i.test(r.color), r.id + ' 顏色格式不正確');
  }
  assert.strictEqual(rewards.map(r => r.type).join(','), 'color,color,title,title',
    job + ' 應是先兩個配色再兩個稱號');
}

// 2. 全新存檔不該有任何外觀
assert.strictEqual(api.ownedCosmetics('title').length, 0, '新存檔不該有稱號');
assert.strictEqual(api.ownedCosmetics('color').length, 0, '新存檔不該有配色');
assert.strictEqual(api.equippedTitleText(), '', '沒有稱號時應回空字串');
assert.strictEqual(api.equippedRecolor(), null, '沒有配色時不該回傳對照表');

// 3. 發放門檻：剛好到等級才給，且只給自己職業的
const warRewards = api.masteryRewardsFor('warrior');
for (const r of warRewards) {
  api.ensureMasteryState('warrior').xp = xpTo(r.lv) - 1;   // 差一點
  api.syncMasteryCosmetics('warrior');
  assert.ok(!api.ownsCosmetic(r.type, r.id), r.id + ' 在 Lv' + r.lv + ' 之前不該解鎖');
  api.ensureMasteryState('warrior').xp = xpTo(r.lv);        // 剛好達標
  api.syncMasteryCosmetics('warrior');
  assert.ok(api.ownsCosmetic(r.type, r.id), r.id + ' 在 Lv' + r.lv + ' 應解鎖');
}
for (const job of jobs) {
  if (job === 'warrior') continue;
  for (const r of api.masteryRewardsFor(job)) {
    assert.ok(!api.ownsCosmetic(r.type, r.id), job + ' 的 ' + r.id + ' 不該被劍士的精通帶解鎖');
  }
}

// 4. 重複呼叫不會重複發（避免 owned 陣列一直長大）
const beforeLen = api.ownedCosmetics('color').length + api.ownedCosmetics('title').length;
assert.strictEqual(api.syncMasteryCosmetics().length, 0, '已發過的獎勵不該再回報為新解鎖');
api.syncMasteryCosmetics(); api.syncMasteryCosmetics();
assert.strictEqual(api.ownedCosmetics('color').length + api.ownedCosmetics('title').length, beforeLen,
  '重複同步不該讓擁有清單變長');

// 5. 選用規則
assert.strictEqual(api.equipCosmetic('title', warRewards[3].id), true, '已解鎖的稱號應可選用');
assert.strictEqual(api.equippedTitleText(), api.TITLE_DEFS[warRewards[3].id].name, '稱號文字應反映選用');
assert.strictEqual(api.equippedTitleColor(), api.TITLE_DEFS[warRewards[3].id].color, '稱號顏色應反映選用');
const lockedTitle = api.masteryRewardsFor('warlock').find(r => r.type === 'title');
assert.strictEqual(api.equipCosmetic('title', lockedTitle.id), false, '未解鎖的稱號不可選用');
assert.strictEqual(api.equipCosmetic('title', 'no_such_title'), false, '不存在的 id 不可選用');
assert.notStrictEqual(api.equippedCosmetic('title'), lockedTitle.id, '選用失敗不該改變目前稱號');

// 6. 配色對照表必須真的蓋到精靈圖用到的字元，否則穿了等於沒穿
const bootSrc = fs.readFileSync(path.join(root, 'src', 'game', 'bootstrap.js'), 'utf8');
const spriteChars = kind => {
  const block = extract(bootSrc, new RegExp('const ' + kind + ' = \\[[\\s\\S]*?\\];'), kind);
  return new Set(block.replace(/[^a-z0-9]/gi, '').split(''));
};
const warChars = spriteChars('WAR'), mageChars = spriteChars('MAGE'), archerChars = spriteChars('ARC');
assert.ok(warChars.has('r'), 'WAR 精靈應含甲冑字元 r（配色對照表的前提）');
assert.ok(mageChars.has('4'), 'MAGE 精靈應含長袍字元 4（配色對照表的前提）');
assert.ok(archerChars.has('g'), 'ARC 精靈應含綠袍字元 g（配色對照表的前提）');
for (const id of Object.keys(api.COLOR_DEFS)) {
  const map = api.COLOR_DEFS[id].map;
  assert.ok(map && map.r && map['4'] && map.g, id + ' 的對照表必須涵蓋劍士(r)/法師(4)/弓箭手(g) 三系身體字元');
  for (const ch of Object.keys(map)) {
    assert.ok(warChars.has(ch) || mageChars.has(ch) || archerChars.has(ch), id + ' 重上色了精靈圖沒用到的字元 ' + ch);
    assert.ok(/^#[0-9a-f]{6}$/i.test(map[ch]), id + ' 的 ' + ch + ' 顏色格式不正確');
  }
}
api.equipCosmetic('color', warRewards[0].id);
const recolor = api.equippedRecolor();
assert.ok(recolor && recolor.r && recolor['4'], '選用配色後應回傳可用的重上色對照表');

// 7. drawSprite 要真的收下 recolor，玩家繪製也要傳進去
assert.ok(/function drawSprite\(rows, x, y, s, flip, flash, recolor\)/.test(bootSrc),
  'drawSprite 應接受 recolor 參數');
const renderSrc = fs.readFileSync(path.join(root, 'src', 'game', 'render.js'), 'utf8');
const playerDraws = renderSrc.match(/drawSprite\(classSprite\(p\.cls\)[^\n]*\)/g) || [];
assert.ok(playerDraws.length >= 2, 'render.js 應有玩家精靈繪製');
for (const call of playerDraws) {
  assert.ok(/equippedRecolor\(\)/.test(call), '玩家精靈繪製必須傳入 equippedRecolor()：' + call);
}

// 8. 存檔往返
api.saveMeta();
const saved = JSON.parse(storage.get('pixelrogue_save'));
assert.ok(saved.cs && saved.cs.owned && saved.cs.equipped, '存檔應含外觀欄位 cs');
assert.ok(saved.cs.owned.title.length > 0 && saved.cs.owned.color.length > 0, '已解鎖的外觀應寫進存檔');

console.log('✓ J1-E smoke 測試通過（' + Object.keys(api.TITLE_DEFS).length + ' 稱號 / ' +
  Object.keys(api.COLOR_DEFS).length + ' 配色・門檻發放・選用規則・重上色對照）');
