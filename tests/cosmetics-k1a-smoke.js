// K1-A 統一外觀系統 smoke 測試：舊光環遷移、解鎖/擁有/選用 API、存檔往返。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'game', 'progression.js'), 'utf8') + `
globalThis.__k1 = {
  meta, AURA_DEFS, COSMETIC_TYPES, COSMETIC_DEFS,
  unlockCosmetic, equipCosmetic, ownsCosmetic, equippedCosmetic, ownedCosmetics,
  equipAura, migrateLegacyCosmetics, saveMeta
};`;

// 預先塞入「舊版」活躍存檔：已擁有 ember 光環且正在裝備 → 應被遷移進統一狀態
const storage = new Map();
storage.set('pixelrogue_activity_v1', JSON.stringify({
  day: '', week: '', activity: 0,
  daily: {}, weekly: {}, dailyTaskIds: [], weeklyTaskIds: [],
  claimedDaily: {}, claimedWeekly: {}, milestones: {},
  cosmetics: ['none', 'ember'], aura: 'ember'
}));

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
const api = context.__k1;

// 1. 遷移：舊光環擁有與選用狀態應併入 meta.cosmetics
assert.ok(api.ownsCosmetic('aura', 'ember'), '舊光環 ember 應被遷移為已擁有');
assert.ok(api.ownsCosmetic('aura', 'none'), 'none 應永遠可用');
assert.strictEqual(api.equippedCosmetic('aura'), 'ember', '舊的選用光環應被遷移');

// 2. 結構完整：四類都有 owned 陣列與 equipped 欄位
for (const t of api.COSMETIC_TYPES) {
  assert.ok(Array.isArray(api.meta.cosmetics.owned[t]), t + ' 應有 owned 陣列');
  assert.ok(t in api.meta.cosmetics.equipped, t + ' 應有 equipped 欄位');
}

// 3. 解鎖：合法 id 首次回 true、重複回 false、未知 id/type 回 false
assert.strictEqual(api.unlockCosmetic('aura', 'void'), true, '首次解鎖應回 true');
assert.strictEqual(api.unlockCosmetic('aura', 'void'), false, '重複解鎖應回 false');
assert.strictEqual(api.unlockCosmetic('aura', 'not_exist'), false, '未知 id 不應解鎖');
assert.strictEqual(api.unlockCosmetic('title', 'not_exist'), false, '未知稱號不應解鎖');
assert.ok(api.ownsCosmetic('aura', 'void'), '解鎖後應為已擁有');

// 4. 選用：已擁有可選、未擁有不可選
assert.strictEqual(api.equipCosmetic('aura', 'void'), true, '已擁有應可選用');
assert.strictEqual(api.equippedCosmetic('aura'), 'void', '選用後應回傳該 id');
assert.strictEqual(api.equipCosmetic('aura', 'not_owned'), false, '未擁有不應可選用');
assert.strictEqual(api.equippedCosmetic('aura'), 'void', '失敗的選用不應改變狀態');

// 5. equipAura 相容轉接
api.equipAura('ember');
assert.strictEqual(api.equippedCosmetic('aura'), 'ember', 'equipAura 應轉接統一系統');

// 6. 存檔往返：saveMeta 應寫出 cs 欄位且含擁有/選用
api.saveMeta();
const saved = JSON.parse(storage.get('pixelrogue_save'));
assert.ok(saved.cs && saved.cs.owned && saved.cs.equipped, '存檔應含 cs 欄位');
assert.ok(saved.cs.owned.aura.indexOf('void') >= 0, '存檔應保留已解鎖光環');
assert.strictEqual(saved.cs.equipped.aura, 'ember', '存檔應保留選用光環');

// 7. 未知類別安全
assert.strictEqual(api.ownsCosmetic('bogus', 'x'), false, '未知類別應安全回 false');
assert.strictEqual(api.equippedCosmetic('title'), null, '未選用的稱號應回 null');

console.log('✓ K1-A 統一外觀系統 smoke 測試通過（遷移／解鎖／選用／存檔往返）');
