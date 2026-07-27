// D4-E smoke 測試：地圖佈局模板。
// 佈局直接決定「每層長什麼樣」，但它也是最容易做出不可玩房間的地方——
// 平台飛出畫面、窄到站不上去、整層空的、或是把地面弄不見（掉下去就無限下墜）。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const coreSrc = read('src', 'dungeon', 'core.js');

const context = {
  console, Math, Object, JSON, Array, Number, String, Boolean, Date, Set,
  parseInt, parseFloat, isNaN, isFinite,
  DUNGEON_BIOME_DEFS: [{ id:'meadow', name:'翠綠草原', hazardId:'thorn_roots', hazardIds:['thorn_roots'] }],
  DUNGEON_HAZARD_DEFS: { thorn_roots:{ id:'thorn_roots', implemented:true } },
  DUNGEON_ROOM_DEFS: { safe:{ id:'safe' } },
  DUNGEON_EVENT_DEFS: {},
  DUNGEON_D2_FLAGS: { hazards:true },
  currentRiftScale: () => ({ tier:1 }),
  meta: { playerName:'測試' }
};
vm.createContext(context);
vm.runInContext(
  coreSrc + '\nglobalThis.__d4e = { DUNGEON_LAYOUT_TEMPLATES, dungeonLayoutTemplate, generateDungeonPlatforms, dungeonRoomRng, dungeonSeedHash };',
  context, { filename: 'd4e.js' });
const api = context.__d4e;

const WIDTH = 2000;
const specFor = seed => ({ seed, type:'safe' });

// ── 1. 模板表本身 ────────────────────────────────────────────────────────
assert.ok(api.DUNGEON_LAYOUT_TEMPLATES.length >= 4, '佈局模板至少要有四種，否則每層還是長得差不多');
const ids = api.DUNGEON_LAYOUT_TEMPLATES.map(t => t.id);
assert.strictEqual(new Set(ids).size, ids.length, '模板 id 不可重複');
for (const t of api.DUNGEON_LAYOUT_TEMPLATES) {
  assert.ok(typeof t.gen === 'function', t.id + ' 缺少產生器');
  assert.ok(t.name, t.id + ' 缺少名稱');
  assert.ok(t.weight > 0, t.id + ' 的權重必須為正，否則永遠抽不到');
}
assert.ok(api.DUNGEON_LAYOUT_TEMPLATES.some(t => t.tricky), '應有標記為刁鑽的模板供高層加權');

// ── 2. 每個模板產出的房間都要可玩 ────────────────────────────────────────
for (const t of api.DUNGEON_LAYOUT_TEMPLATES) {
  let minPlat = Infinity, maxPlat = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const raw = t.gen(api.dungeonRoomRng(specFor(seed), 'platforms'), WIDTH);
    assert.ok(Array.isArray(raw), t.id + ' 應回傳陣列');
    assert.ok(raw.length > 0, t.id + ' 在 seed ' + seed + ' 產出空佈局（整層沒有任何平台）');
    minPlat = Math.min(minPlat, raw.length); maxPlat = Math.max(maxPlat, raw.length);
    for (const p of raw) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.w),
        t.id + ' 產出了非數值的平台：' + JSON.stringify(p));
      assert.ok(p.w >= 40, t.id + ' 產出寬度只有 ' + Math.round(p.w) + ' 的平台，站不上去');
      assert.ok(p.y > 100 && p.y < 468, t.id + ' 的平台 y=' + p.y + ' 超出可用高度');
      assert.ok(!p.ground, t.id + ' 不該自己產生地面，地面由 generateDungeonPlatforms 統一加');
    }
  }
  assert.ok(minPlat >= 1, t.id + ' 最少平台數為 ' + minPlat);
  assert.ok(maxPlat <= 40, t.id + ' 最多產出 ' + maxPlat + ' 個平台，過密會拖慢並讓畫面難讀');
}

// ── 3. generateDungeonPlatforms 的統一保證 ───────────────────────────────
for (let seed = 1; seed <= 300; seed++) {
  const plats = api.generateDungeonPlatforms(specFor(seed), WIDTH);
  const ground = plats.filter(p => p.ground);
  // 地面消失＝掉下去無限下墜，而且險境與怪物生成都假設 y=468 有地
  assert.strictEqual(ground.length, 1, 'seed ' + seed + ' 的地面平台應恰好一個，實際 ' + ground.length);
  assert.strictEqual(ground[0].y, 468, '地面必須在 y=468');
  assert.strictEqual(ground[0].w, WIDTH, '地面必須橫跨整個房間');
  for (const p of plats) {
    assert.ok(p.x >= 0 && p.x + p.w <= WIDTH, 'seed ' + seed + ' 有平台超出房間範圍：x=' + Math.round(p.x) + ' w=' + Math.round(p.w));
  }
  assert.ok(plats.layoutId, '應標記使用的佈局 id（供除錯與日後的圖鑑）');
}

// generateDungeonPlatforms 的清洗守衛：現有模板本身就很乖，所以要餵一個「壞模板」才測得到。
// 沒有這段的話，把夾制與過濾拿掉也不會有任何測試失敗（防禦性程式碼等於沒被驗證）。
const goodTemplate = context.dungeonLayoutTemplate;
context.dungeonLayoutTemplate = () => ({
  id:'hostile', name:'惡意模板', weight:1,
  gen: () => [
    { x:-500, y:325, w:200 },          // 越出左界
    { x:WIDTH + 300, y:325, w:200 },   // 越出右界
    { x:600, y:405, w:9 },             // 窄到站不上去
    { x:800, y:250, w:150 }            // 正常
  ]
});
const sanitized = api.generateDungeonPlatforms(specFor(1), WIDTH);
context.dungeonLayoutTemplate = goodTemplate;
const nonGround = sanitized.filter(p => !p.ground);
assert.strictEqual(nonGround.length, 3, '過窄的平台應被濾掉（實際留下 ' + nonGround.length + ' 個）');
for (const p of nonGround) {
  assert.ok(p.x >= 0 && p.x + p.w <= WIDTH, '越界的平台應被夾回房間內：x=' + p.x + ' w=' + p.w);
  assert.ok(p.w >= 40, '仍有過窄平台通過：w=' + p.w);
}
assert.ok(sanitized.some(p => p.ground), '清洗後地面仍必須存在');

// ── 4. 可重現：同一房間規格必須產出同一份佈局 ─────────────────────────────
// 固定種子基準局與「重進同一層」都依賴這點。
const spec = specFor(42);
const a = JSON.stringify(api.generateDungeonPlatforms(spec, WIDTH));
const b = JSON.stringify(api.generateDungeonPlatforms(spec, WIDTH));
assert.strictEqual(a, b, '同一房間規格必須產出完全相同的佈局');
assert.ok(!/Math\.random/.test(coreSrc.slice(coreSrc.indexOf('const DUNGEON_LAYOUT_ROWS'), coreSrc.indexOf('function generateDungeonEnemyTypes'))),
  '佈局產生器不得使用 Math.random，否則同種子無法重現');

// ── 5. 秘境層級掛鉤：高層要更常抽到刁鑽佈局 ──────────────────────────────
const share = tier => {
  context.currentRiftScale = () => ({ tier });
  let tricky = 0;
  for (let seed = 1; seed <= 600; seed++) if (api.dungeonLayoutTemplate(specFor(seed)).tricky) tricky++;
  return tricky / 600;
};
const low = share(1), high = share(10);
context.currentRiftScale = () => ({ tier:1 });
assert.ok(high > low + 0.1, '秘境高層應明顯更常抽到刁鑽佈局（T1 ' + (low * 100).toFixed(0) + '% → T10 ' + (high * 100).toFixed(0) + '%）');
assert.ok(low > 0.1 && low < 0.9, 'T1 的刁鑽佈局比例應落在合理區間，實際 ' + (low * 100).toFixed(0) + '%');

console.log('✓ D4-E smoke 測試通過（' + api.DUNGEON_LAYOUT_TEMPLATES.length + ' 種佈局模板・可玩性與邊界・' +
  '地面保證・可重現・層級加權 ' + (low * 100).toFixed(0) + '%→' + (high * 100).toFixed(0) + '%）');
