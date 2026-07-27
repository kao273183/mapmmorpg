// I1 傳奇裝備 smoke 測試：UNIQUE_DEFS 資料完整性、職業／部位／稀有度過濾、gearColor 專屬色。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'game', 'progression.js'), 'utf8') + `
globalThis.__i1 = { UNIQUE_DEFS, UNIQUE_LIST, uniqueDef, uniqueIdsFor, gearColor, UNIQUE_COLOR };`;

const context = {
  console, Math, Object, JSON, Array, Number, String, Boolean, Date,
  parseInt, parseFloat, isNaN,
  RARITY_COL: ['#e8e8e8', '#6f9dff', '#ffd23e', '#c060ff', '#ff8020'],
  RARITY_NAME: ['普通', '精良', '稀有', '史詩', '傳說'],
  RARITY_ABBR: ['普', '精', '稀', '史', '傳'],
  localStorage: { getItem: () => null, setItem: () => {} },
  player: { cls: 'warrior', eq: {} },
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'progression-bundle.js' });
const api = context.__i1;

// 1. UNIQUE_DEFS 資料完整性
const ids = Object.keys(api.UNIQUE_DEFS);
assert(ids.length >= 15, 'unique 數量應 >= 15，實際 ' + ids.length);
for (const id of ids) {
  const u = api.UNIQUE_DEFS[id];
  assert.strictEqual(u.id, id, id + ' 的 id 應對應 key');
  assert(u.name && u.kind && u.powerText, id + ' 應有 name/kind/powerText');
  assert((u.minR || 3) >= 3, id + ' 的 minR 應 >= 3');
  assert(Array.isArray(u.powers) && u.powers.length >= 1, id + ' 應有 powers');
  assert(['weapon', 'armor', 'helmet', 'boots', 'acc'].includes(u.kind), id + ' kind 合法');
}

// 2. 職業過濾：劍士武器不含法師 unique，反之亦然
const warW = api.uniqueIdsFor('weapon', 'warrior', 4);
const mageW = api.uniqueIdsFor('weapon', 'mage', 4);
assert(warW.length > 0 && mageW.length > 0, '雙職業武器 unique 都應存在');
assert(!warW.some(id => api.UNIQUE_DEFS[id].cls === 'mage'), '劍士武器不應含法師 unique');
assert(!mageW.some(id => api.UNIQUE_DEFS[id].cls === 'warrior'), '法師武器不應含劍士 unique');

// 3. 頭盔為通用，雙職業拿到一樣的候選
const warH = api.uniqueIdsFor('helmet', 'warrior', 4);
const mageH = api.uniqueIdsFor('helmet', 'mage', 4);
assert(warH.length > 0 && warH.length === mageH.length, '頭盔應為通用（雙職業候選相同）');

// 4. 稀有度門檻：r<3 無 unique 候選，r>=3 有
assert.strictEqual(api.uniqueIdsFor('weapon', 'warrior', 2).length, 0, 'r=2 不應有 unique 候選');
assert(api.uniqueIdsFor('weapon', 'warrior', 3).length > 0, 'r=3 應有 unique 候選');

// 4b. 每個基礎職都要有自己的傳奇武器，且武器種類要對得上該職的武器欄。
// 弓箭手上線後有一段時間 10 把武器類 unique 全是劍或杖，弓系的武器欄不可能是傳奇——
// 這種缺口不會報錯，只會讓一整個職業系少一條收藏線，用推導式擋住。
const WPN_OF_BASE = { warrior:'sword', mage:'stave', archer:'bow' };
for (const base of Object.keys(WPN_OF_BASE)) {
  const ws = api.uniqueIdsFor('weapon', base, 4);
  assert(ws.length > 0, base + ' 沒有任何傳奇武器，該職的武器欄永遠不可能是傳奇');
  for (const id of ws) {
    const u = api.UNIQUE_DEFS[id];
    assert.strictEqual(u.wpn, WPN_OF_BASE[base], id + ' 的 wpn 應為 ' + WPN_OF_BASE[base] + '，實際 ' + u.wpn);
  }
}
// 武器類 unique 一律要標 wpn，否則會生成沒有武器種類的裝備（美術與圖示查表會落空）
for (const id of ids) {
  const u = api.UNIQUE_DEFS[id];
  if (u.kind === 'weapon') assert(u.wpn, id + ' 是武器類 unique，必須指定 wpn');
  else assert(!u.wpn, id + ' 不是武器，不該有 wpn');
}

// 5. gearColor：unique 回傳專屬金橙色；一般裝回傳稀有度色
assert.strictEqual(api.gearColor({ unique: 'frost_blade', r: 4 }), api.UNIQUE_COLOR, 'unique 應回傳專屬色');
assert.strictEqual(api.gearColor({ r: 1 }), '#6f9dff', '藍裝應回傳精良色');

console.log('✓ I1 傳奇裝備 smoke 測試通過（' + ids.length + ' 件 unique，職業／部位／稀有度過濾與配色正確）');
