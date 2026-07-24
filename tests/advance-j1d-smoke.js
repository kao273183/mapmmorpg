// J1-D smoke 測試：四個進階職各自綁到正確基礎職、選角清單分組、出戰欄修復、灰晶片條件文字。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const systemsSrc = fs.readFileSync(path.join(root, 'src', 'game', 'systems.js'), 'utf8');
function extract(re, label) {
  const m = systemsSrc.match(re);
  assert.ok(m, 'systems.js 找不到 ' + label);
  return m[0];
}
const source = [
  extract(/const CLASSES = \{[\s\S]*?\n\};/, 'CLASSES'),
  extract(/function baseClassOf\(cls\) \{.*?\}/, 'baseClassOf'),
  extract(/function isAdvancedClass\(cls\) \{.*?\}/, 'isAdvancedClass'),
  extract(/function baseClassIds\(\) \{.*?\}/, 'baseClassIds'),
  extract(/function advancedJobsFor\(base\) \{.*?\}/, 'advancedJobsFor'),
  fs.readFileSync(path.join(root, 'src', 'game', 'progression.js'), 'utf8'),
  `globalThis.__j1d = {
    CLASSES, baseClassOf, baseClassIds, advancedJobsFor, isJobUnlocked, selectableJobs,
    jobPickList, jobHotkeyList, jobUnlockHint, revalidateLoadouts, classSkills,
    gearUsableByClass, loadouts, skillState, SKILL_DEFS, SKILL_IDS, LEGACY_SKILL_IDS,
    skillsToNums, ensureMasteryState, masteryXpForNext, MASTERY_ADVANCE_LEVEL,
    BRANCH_NAMES, TALENT_EFFECTS
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
vm.runInContext(source, context, { filename: 'j1d-bundle.js' });
const api = context.__j1d;

const FULL = { warrior: ['berserker', 'paladin'], mage: ['elementalist', 'warlock'] };
const maxXp = (() => { let x = 0; for (let lv = 1; lv < api.MASTERY_ADVANCE_LEVEL; lv++) x += api.masteryXpForNext(lv); return x; })();
const setMastery = (warriorXp, mageXp) => {
  api.ensureMasteryState('warrior').xp = warriorXp;
  api.ensureMasteryState('mage').xp = mageXp;
};

// 1. 轉職樹結構：兩個基礎職，各掛兩個進階職
assert.deepStrictEqual(api.baseClassIds(), ['warrior', 'mage', 'archer'], '基礎職為劍士/法師/弓箭手');
for (const base of Object.keys(FULL)) {
  assert.deepStrictEqual(api.advancedJobsFor(base), FULL[base], base + ' 的進階職清單不符');
  for (const job of FULL[base]) {
    assert.strictEqual(api.baseClassOf(job), base, job + ' 應對應回 ' + base);
    assert.ok(api.CLASSES[job].tag && api.CLASSES[job].sub, job + ' 應有選角卡文案');
  }
}

// 2. 解鎖只看「自己的」基礎職，不會被另一系帶解
setMastery(maxXp, 0);
assert.deepStrictEqual(api.selectableJobs(), ['warrior', 'mage', 'archer', 'berserker', 'paladin'],
  '劍士滿門檻時只該解鎖劍士系（弓箭手為基礎職恆可選）');
setMastery(0, maxXp);
assert.deepStrictEqual(api.selectableJobs(), ['warrior', 'mage', 'archer', 'elementalist', 'warlock'],
  '法師滿門檻時只該解鎖法師系（弓箭手為基礎職恆可選）');

// 3. 選角頁分組：大卡固定兩張，晶片只顯示當前系別（含未解鎖的灰晶片）
setMastery(0, 0);
for (const base of Object.keys(FULL)) {
  const picks = api.jobPickList(base);
  assert.deepStrictEqual(picks.bases, ['warrior', 'mage', 'archer'], '大卡為三個基礎職');
  assert.deepStrictEqual(picks.adv, FULL[base], base + ' 的晶片列應只有自己的進階職');
  assert.deepStrictEqual(api.jobHotkeyList(base), ['warrior', 'mage', 'archer'], '未解鎖的進階職不該吃數字鍵（三基礎職恆在）');
}
// 選了進階職時，晶片列仍停在同一系
assert.deepStrictEqual(api.jobPickList('berserker').adv, FULL.warrior, '選狂戰士時應顯示劍士系晶片');
setMastery(maxXp, 0);
assert.deepStrictEqual(api.jobHotkeyList('warrior'), ['warrior', 'mage', 'archer', 'berserker', 'paladin'],
  '解鎖後數字鍵順序應接在基礎職之後');
assert.strictEqual(api.jobUnlockHint('warlock'), '法師精通 Lv10', '灰晶片應說明是哪個職業的門檻');
assert.strictEqual(api.jobUnlockHint('warrior'), '', '基礎職沒有解鎖條件文字');

// 4. 技能：每個進階職 = 基礎職 5 技能 + 2 專屬，且不會混到別系
for (const base of Object.keys(FULL)) {
  const baseSkills = api.classSkills(base);
  const otherBase = base === 'warrior' ? 'mage' : 'warrior';
  for (const job of FULL[base]) {
    const list = api.classSkills(job);
    assert.strictEqual(list.length, 7, job + ' 應有 7 個技能（繼承 4 + 專屬 3）');
    // 基礎職的非基本技能會被繼承；基本技能則由進階職自己的取代
    for (const id of baseSkills) {
      if (api.SKILL_DEFS[id].basic) {
        assert.ok(list.indexOf(id) < 0, job + ' 不該繼承 ' + base + ' 的基本技能 ' + id);
      } else {
        assert.ok(list.indexOf(id) >= 0, job + ' 應繼承 ' + id);
      }
    }
    const own = list.filter(id => api.SKILL_DEFS[id].cls === job);
    assert.strictEqual(own.length, 3, job + ' 應有 3 個專屬技能（1 基本 + 2 進階）');
    const ownBasic = own.filter(id => api.SKILL_DEFS[id].basic);
    assert.strictEqual(ownBasic.length, 1, job + ' 應剛好有一個自己的基本技能');
    assert.strictEqual(list[0], ownBasic[0], job + ' 的基本技能應排在技能樹根節點');
    assert.ok(api.SKILL_DEFS[ownBasic[0]].mp <= 10, job + ' 的基本技能 MP 應維持在可連續使用的範圍');
    assert.ok(api.SKILL_DEFS[ownBasic[0]].cd <= 60, job + ' 的基本技能冷卻應在 1 秒內');
    for (const id of api.classSkills(otherBase)) {
      if (baseSkills.indexOf(id) >= 0) continue;
      assert.ok(list.indexOf(id) < 0, job + ' 不該拿到 ' + otherBase + ' 的技能 ' + id);
    }
    for (const id of own) {
      assert.ok(api.BRANCH_NAMES[id] && api.BRANCH_NAMES[id].length === 2, id + ' 缺少天賦分支名稱');
      assert.ok(api.TALENT_EFFECTS[id] && api.TALENT_EFFECTS[id].length === 2, id + ' 缺少天賦效果');
      for (const eff of api.TALENT_EFFECTS[id]) assert.ok(eff.lv3 && eff.lv5, id + ' 天賦說明不完整');
    }
  }
}

// 5. 裝備線依系共用，不跨系
for (const base of Object.keys(FULL)) {
  const otherBase = base === 'warrior' ? 'mage' : 'warrior';
  for (const job of FULL[base]) {
    assert.ok(api.gearUsableByClass({ cls: base }, job), job + ' 應能用 ' + base + ' 的裝備');
    assert.ok(!api.gearUsableByClass({ cls: otherBase }, job), job + ' 不該能用 ' + otherBase + ' 的裝備');
    assert.ok(api.gearUsableByClass({ cls: null }, job), job + ' 應能用通用裝');
  }
}

// 6. 出戰欄修復：載入時被清空的進階職，補回其系的基本技能（載入順序坑的回歸測試）
for (const id of api.SKILL_IDS) if (api.SKILL_DEFS[id].basic) api.skillState[id].unl = 1;
for (const job of Object.keys(api.loadouts)) api.loadouts[job] = [null, null, null];
api.revalidateLoadouts();
for (const base of Object.keys(FULL)) {
  for (const job of FULL[base].concat([base])) {
    // 補回的是「該職業自己的」基本技能：進階職有專屬基本技，不該退回基礎職的
    const basic = api.classSkills(job).find(id => api.SKILL_DEFS[id].basic);
    assert.ok(basic, job + ' 應找得到基本技能');
    assert.strictEqual(api.loadouts[job][0], basic, job + ' 出戰欄空白時應補回 ' + basic);
    if (job !== base) {
      assert.strictEqual(api.SKILL_DEFS[basic].cls, job, job + ' 補回的應是自己的基本技能而非 ' + base + ' 的');
    }
  }
}
// 已有技能的出戰欄不該被覆寫
api.loadouts.paladin = [null, 'smite', null];
api.skillState.smite.unl = 1;
api.revalidateLoadouts();
assert.deepStrictEqual(api.loadouts.paladin, [null, 'smite', null], '已配置的出戰欄不該被動到');
// 不屬於該職業的技能要被清掉
api.loadouts.paladin = ['fire', 'smite', null];
api.revalidateLoadouts();
assert.strictEqual(api.loadouts.paladin[0], null, '聖騎士不該留著法師技能');

// 7. 新增 6 個技能後，既有存檔區塊仍是 46
assert.strictEqual(api.skillsToNums().length, 46, '技能存檔區塊必須維持 46');
assert.strictEqual(api.LEGACY_SKILL_IDS.length, 10, '存檔區塊只含 10 個基礎職技能');
assert.strictEqual(api.SKILL_IDS.length, 27, '總技能數：劍士5+法師5+進階12+弓箭手5(J2-B)');

// 8. 每個技能都要有圖示與配色，否則介面會畫成空白
const bootSrc = fs.readFileSync(path.join(root, 'src', 'game', 'bootstrap.js'), 'utf8');
const townSrc = fs.readFileSync(path.join(root, 'src', 'game', 'town.js'), 'utf8');
const iconBlock = bootSrc.match(/const SKILL_ICON_FILES = \{[\s\S]*?\n\};/)[0];
const colorBlock = townSrc.match(/const SKILL_COLORS = \{[\s\S]*?\n\};/)[0];
const iconIds = {};
for (const m of iconBlock.matchAll(/([a-zA-Z]+)\s*:\s*(\d+)/g)) iconIds[m[1]] = parseInt(m[2], 10);
for (const id of api.SKILL_IDS) {
  assert.ok(iconIds[id] != null, id + ' 沒有對應的技能圖示');
  assert.ok(new RegExp('\\b' + id + '\\s*:').test(colorBlock), id + ' 沒有對應的技能配色');
  const icon = path.join(root, 'assets', 'runtime', 'skills', 'icons');
  assert.ok(fs.existsSync(path.join(icon, 'normal', iconIds[id] + ' Icon.png')), id + ' 的圖示檔不存在');
  assert.ok(fs.existsSync(path.join(icon, 'gray', iconIds[id] + ' Icon.png')), id + ' 的灰階圖示檔不存在');
}
assert.strictEqual(new Set(Object.values(iconIds)).size, Object.keys(iconIds).length, '技能圖示不應重複使用');

console.log('✓ J1-D smoke 測試通過（4 進階職分系解鎖／選角分組／技能與裝備繼承／出戰欄修復／圖示齊備）');
