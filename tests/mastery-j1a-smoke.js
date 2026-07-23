// J1-A 職業精通基礎 smoke 測試：等級曲線、經驗公式、首殺加成、重複刷衰減、存檔往返、每職獨立。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'game', 'progression.js'), 'utf8') + `
globalThis.__j1 = {
  meta, MASTERY_MAX_LEVEL, MASTERY_ADVANCE_LEVEL, MASTERY_FIRST_BOSS_XP,
  masteryXpForNext, masteryLevel, masteryProgress, addMasteryXp,
  calcMasteryGain, recordMasteryRun, ensureMasteryState, saveMeta
};`;

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
vm.runInContext(source, context, { filename: 'progression-bundle.js' });
const api = context.__j1;

// 1. 等級曲線：遞增且分三章、上限 30
let prev = 0;
for (let lv = 1; lv < api.MASTERY_MAX_LEVEL; lv++) {
  const need = api.masteryXpForNext(lv);
  assert.ok(need > 0, 'lv' + lv + ' 需求應為正');
  assert.ok(need >= prev, '需求應不遞減（lv' + lv + '）');
  prev = need;
}
assert.ok(api.masteryXpForNext(19) > api.masteryXpForNext(9), '第二章應比第一章貴');
assert.ok(api.masteryXpForNext(29) > api.masteryXpForNext(19), '第三章應比第二章貴');

// 2. masteryLevel：0 經驗＝Lv1；剛好累積到門檻會升級；超大經驗封頂 30
assert.strictEqual(api.masteryLevel(0), 1, '0 經驗應為 Lv1');
assert.strictEqual(api.masteryLevel(api.masteryXpForNext(1) - 1), 1, '差一點不應升級');
assert.strictEqual(api.masteryLevel(api.masteryXpForNext(1)), 2, '達門檻應升 Lv2');
assert.strictEqual(api.masteryLevel(9999999), api.MASTERY_MAX_LEVEL, '應封頂 30');

// 3. 每職業獨立
api.addMasteryXp('warrior', 500);
assert.ok(api.masteryProgress('warrior').xp === 500, '劍士應累積 500');
assert.strictEqual(api.masteryProgress('mage').xp, 0, '法師不應被影響');

// 4. 首殺加成：首次擊敗某 Boss 給一次性加成，第二次不再給
const g1 = api.calcMasteryGain('mage', { floor: 5, kills: 10, result: 'death', bossIds: ['meadow_lord'] });
const g0 = api.calcMasteryGain('mage', { floor: 5, kills: 10, result: 'death', bossIds: [] });
assert.strictEqual(g1.xp - g0.xp, api.MASTERY_FIRST_BOSS_XP, '首殺應加固定值');
assert.deepStrictEqual(g1.newBosses, ['meadow_lord'], '應回報新 Boss');
api.recordMasteryRun('mage', { floor: 5, kills: 10, result: 'death', bossIds: ['meadow_lord'] });
const g2 = api.calcMasteryGain('mage', { floor: 5, kills: 10, result: 'death', bossIds: ['meadow_lord'] });
assert.deepStrictEqual(g2.newBosses, [], '同一 Boss 第二次不應再算首殺');

// 5. 重複刷衰減：未突破最深紀錄時收益較低
const st = api.ensureMasteryState('warrior');
st.best = 10;
const deep = api.calcMasteryGain('warrior', { floor: 12, kills: 0, result: 'death' }); // 突破
const shallow = api.calcMasteryGain('warrior', { floor: 8, kills: 0, result: 'death' }); // 未突破
assert.ok(shallow.xp < deep.xp, '未突破紀錄的收益應較低');
const same = api.calcMasteryGain('warrior', { floor: 10, kills: 0, result: 'death' }); // 等於紀錄＝算重複
const justOver = api.calcMasteryGain('warrior', { floor: 11, kills: 0, result: 'death' });
assert.ok(justOver.xp > same.xp, '剛突破應優於持平');

// 6. 撤退加成
const died = api.calcMasteryGain('mage', { floor: 20, kills: 0, result: 'death' });
const left = api.calcMasteryGain('mage', { floor: 20, kills: 0, result: 'extract' });
assert.ok(left.xp > died.xp, '成功撤退應有加成');

// 7. recordMasteryRun 會更新最深紀錄與經驗，並回報升級數
const before = api.masteryProgress('warrior');
const r = api.recordMasteryRun('warrior', { floor: 30, kills: 50, result: 'extract' });
const after = api.masteryProgress('warrior');
assert.ok(after.xp > before.xp, '結算應增加經驗');
assert.strictEqual(after.best, 30, '應更新最深紀錄');
assert.ok(r.levelsGained >= 0, '應回報升級數');

// 8. 存檔往返：ms 欄位寫入且含各職業
api.saveMeta();
const saved = JSON.parse(storage.get('pixelrogue_save'));
assert.ok(saved.ms && saved.ms.warrior && saved.ms.mage, '存檔應含 ms 且分職業');
assert.strictEqual(saved.ms.warrior.best, 30, '存檔應保留最深紀錄');
assert.ok(Array.isArray(saved.ms.mage.bosses) && saved.ms.mage.bosses.indexOf('meadow_lord') >= 0, '存檔應保留首殺 Boss 名單');

// 9. 零戰力：精通狀態只含 xp/bosses/best，不含任何數值加成欄位
for (const job of Object.keys(api.meta.mastery)) {
  const keys = Object.keys(api.meta.mastery[job]).sort();
  assert.deepStrictEqual(keys, ['best', 'bosses', 'xp'], job + ' 精通狀態不應含戰力欄位');
}

// 10. 舊存檔相容：缺欄位時 ensureMasteryState 會補齊
api.meta.mastery = { warrior: { xp: 'bad', bosses: null } };
const fixed = api.ensureMasteryState('warrior');
assert.strictEqual(fixed.xp, 0, '壞資料應歸零');
assert.ok(Array.isArray(fixed.bosses), 'bosses 應補成陣列');
assert.strictEqual(fixed.best, 0, 'best 應補成 0');

console.log('✓ J1-A 職業精通基礎 smoke 測試通過（曲線／首殺／衰減／撤退／存檔／零戰力）');
