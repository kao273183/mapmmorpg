// ---------- dungeon room data (v0.26 D2-A) ----------
const DUNGEON_D2_FLAGS = {
  // 只有標記 implemented 的地形會進入正式路線池。
  hazards:true
};

// D3-C：固定基準模型的首輪小幅校準。所有改動集中在這裡，方便報表與回歸測試比較前後值。
const DUNGEON_D3C_CALIBRATION = {
  id:'d3c-round-1', version:'0.28.9', date:'2026-07-22', basis:'fixed-benchmark-model',
  eliteHpMultiplier:2.15,
  heavyHazardDamagePct:0.07,
  hazardSoulMultiplier:1.10,
  adjustments:[
    { id:'elite-hp', label:'菁英單體耐久', unit:'倍', before:2.40, after:2.15, deltaPct:-10.4, target:'降低菁英房單一目標拖時' },
    { id:'heavy-hazard-damage', label:'落石／熔岩傷害', unit:'最大 HP', before:0.08, after:0.07, deltaPct:-12.5, target:'降低重地形單次失誤懲罰' },
    { id:'hazard-soul-reward', label:'險境靈魂加成', unit:'倍率', before:1.00, after:1.10, deltaPct:10.0, target:'補足高風險路線報酬' }
  ]
};

function dungeonHazardSoulBonus(atFloor) {
  const base = 4 + Math.min(6, Math.max(1, Number(atFloor) || 1));
  return Math.max(base, Math.round(base * DUNGEON_D3C_CALIBRATION.hazardSoulMultiplier));
}

// ---------- 地形難度模式（一般 / 困難）----------
// 註：內部 id 仍為 'complex'（相容既有存檔與設定），顯示名稱為「困難」。未來將擴充為秘境式分層難度。
// 「一般」保留反應型地形（荊棘、落石、熔岩）的「看提示→閃開」核心，
// 但移除會改變移動規則的地形（冰面滑行、虛空平台消失），並降低陷阱密度與傷害。
// 「困難」＝現行完整地形系統。設定存於本瀏覽器，不影響存檔碼。
// hazardChanceMul：險境房出現機率倍率；bossHpMul／bossDmgMul：Boss 生命／傷害倍率（分開調，一般模式傷害降更多）。
// maxRarity：掉落稀有度上限（0普通 1精良藍 2稀有黃 3史詩紫 4傳說橙）。一般模式頂多藍裝，不掉稀有以上與套裝。
const TERRAIN_MODE_DEFS = {
  normal:  { id:'normal',  name:'一般', maxPerRoomMul:0.6, damageMul:0.8, movementHazards:false, hazardChanceMul:0.5, bossHpMul:0.72, bossDmgMul:0.55, dropMul:0.7, maxRarity:1, xpMul:1.25 },
  complex: { id:'complex', name:'困難', maxPerRoomMul:1,   damageMul:1,   movementHazards:true,  hazardChanceMul:1,   bossHpMul:1,    bossDmgMul:1,    dropMul:1,   maxRarity:4, xpMul:1 }
};
const TERRAIN_MODE_KEY = 'pixelrogue_terrain_mode';
let terrainMode = 'normal';
try {
  const savedTerrainMode = localStorage.getItem(TERRAIN_MODE_KEY);
  if (savedTerrainMode === 'normal' || savedTerrainMode === 'complex') terrainMode = savedTerrainMode;
} catch (e) {}
function terrainModeConfig() { return TERRAIN_MODE_DEFS[terrainMode] || TERRAIN_MODE_DEFS.normal; }
function setTerrainMode(mode) {
  terrainMode = mode === 'complex' ? 'complex' : 'normal';
  try { localStorage.setItem(TERRAIN_MODE_KEY, terrainMode); } catch (e) {}
  return terrainMode;
}
// 冰面滑行與虛空平台消失只在「困難」模式生效。
function terrainMovementHazardsEnabled() { return terrainModeConfig().movementHazards; }
// 依模式縮放每房陷阱數量下限保持 1，避免整房完全無地形。
function terrainHazardMaxPerRoom(def) {
  const base = def && Number.isFinite(def.maxPerRoom) ? def.maxPerRoom : 3;
  return Math.max(1, Math.round(base * terrainModeConfig().maxPerRoomMul));
}
// 判斷某地形是否屬於「移動改變型」（一般模式下會被中和）。
function terrainHazardIsMovementType(hazardId) {
  return hazardId === 'ice_floor' || hazardId === 'void_platforms';
}
// 一般模式降低險境房出現機率。
function dungeonHazardChanceMul() { return terrainModeConfig().hazardChanceMul; }
// 一般模式降低 Boss 生命與傷害（傷害降更多，減少被秒的挫折）。
function dungeonBossHpMul() { const m = terrainModeConfig().bossHpMul; return Number.isFinite(m) ? m : 1; }
function dungeonBossDmgMul() { const m = terrainModeConfig().bossDmgMul; return Number.isFinite(m) ? m : 1; }
// 一般模式降低裝備與藥水掉落機率（簡單模式的報酬取捨）。
function dungeonDropMul() { const m = terrainModeConfig().dropMul; return Number.isFinite(m) ? m : 1; }
// 掉落稀有度上限（一般模式頂多藍裝 rarity 1）。
function dungeonMaxRarity() { const m = terrainModeConfig().maxRarity; return Number.isFinite(m) ? m : 4; }
// 一般模式升等較快（經驗值加成）。
function dungeonXpMul() { const m = terrainModeConfig().xpMul; return Number.isFinite(m) ? m : 1; }

const DUNGEON_BIOME_DEFS = [
  { id:'meadow', name:'翠綠草原', hazardId:'thorn_roots', enemyTag:'史萊姆、蝙蝠', bossName:'草原領主' },
  { id:'cavern', name:'幽暗洞窟', hazardId:'falling_rocks', enemyTag:'蝙蝠、孢子怪', bossName:'洞窟領主' },
  { id:'volcano', name:'熾熱熔岩', hazardId:'lava_vents', enemyTag:'爆裂怪、衝鋒獸', bossName:'熔岩魔王' },
  { id:'tundra', name:'冰霜凍原', hazardId:'ice_floor', enemyTag:'冰霜怪、分裂怪', bossName:'冰霜領主' },
  { id:'void', name:'虛空深淵', hazardId:'void_platforms', enemyTag:'深淵混合怪群', bossName:'深淵魔王' }
];

const DUNGEON_HAZARD_DEFS = {
  thorn_roots: {
    id:'thorn_roots', biomeId:'meadow', name:'荊棘根鬚', previewTag:'荊棘根鬚', implemented:true,
    tutorial:'地面出現土痕時，跳躍或衝刺離開。', warningFrames:45, activeFrames:18, cooldownFrames:150,
    maxPerRoom:3, damagePct:0.06, minDamage:6, slowFrames:60, rewards:['靈魂加成', '強化石']
  },
  falling_rocks: {
    id:'falling_rocks', biomeId:'cavern', name:'落石區', previewTag:'落石區', implemented:true,
    tutorial:'留意落點框與頭頂碎屑，落石前離開框線。', warningFrames:60, activeFrames:32, cooldownFrames:135,
    maxPerRoom:3, damagePct:DUNGEON_D3C_CALIBRATION.heavyHazardDamagePct, minDamage:8, rewards:['靈魂加成', '強化石']
  },
  lava_vents: {
    id:'lava_vents', biomeId:'volcano', name:'熔岩噴口', previewTag:'熔岩噴口', implemented:true,
    tutorial:'噴口發亮時先停步，熄火後再通過。', warningFrames:45, activeFrames:30, cooldownFrames:105,
    maxPerRoom:3, damagePct:DUNGEON_D3C_CALIBRATION.heavyHazardDamagePct, minDamage:8, rewards:['靈魂加成', '強化石']
  },
  ice_floor: {
    id:'ice_floor', biomeId:'tundra', name:'冰面', previewTag:'冰面', implemented:true,
    tutorial:'冰面會保留滑行慣性；反方向可煞車，衝刺仍可修正。', maxPerRoom:3,
    acceleration:0.22, coast:0.985, rewards:['靈魂加成', '強化石']
  },
  void_platforms: {
    id:'void_platforms', biomeId:'void', name:'虛空平台', previewTag:'虛空平台', implemented:true,
    tutorial:'平台閃爍兩次後會消失；地面永遠保留穩定路線。', warningFrames:60, activeFrames:90, cooldownFrames:120,
    maxPerRoom:2, rewards:['靈魂加成', '強化石']
  }
};

// D2-D：事件定義只描述預覽、章節限制、選項與 effectId；實際效果集中在 dungeon-events.js。
const DUNGEON_EVENT_DEFS = {
  traveler_chest: {
    id:'traveler_chest', family:'chest', name:'旅行者寶箱', previewTag:'旅行者寶箱',
    worldType:'chest', minChapter:1, weight:4, threat:1, color:'#ffd36a',
    desc:'旅行者留下的補給，鎖扣仍完好。', note:'開啟後獲得精良以上裝備與附魔塵 ×1。', rewards:['精良裝備', '附魔塵'],
    choices:[
      { label:'開啟寶箱', detail:'獲得精良以上裝備＋附魔塵 ×1', effectId:'traveler_reward' },
      { label:'暫時離開', detail:'不消耗任何資源，也不影響探索評價', effectId:'decline' }
    ]
  },
  mimic_chest: {
    id:'mimic_chest', family:'chest', name:'寶箱怪', previewTag:'寶箱怪',
    worldType:'chest', minChapter:2, weight:2, threat:2, color:'#ff8a6a',
    desc:'箱蓋縫隙傳出低沉呼吸聲。', note:'接受戰鬥後擊敗寶箱怪，保證獲得稀有裝備。', rewards:['稀有裝備', '事件戰鬥'],
    choices:[
      { label:'喚醒寶箱怪', detail:'立即進入戰鬥；勝利保證稀有裝備', effectId:'mimic_fight' },
      { label:'保持距離', detail:'安全離開，不影響清房與探索評價', effectId:'decline' }
    ]
  },
  supply_crate: {
    id:'supply_crate', family:'chest', name:'補給箱', previewTag:'補給三選一',
    worldType:'chest', minChapter:1, weight:4, threat:1, color:'#7dffd6',
    desc:'箱內三格補給仍可使用，只能取走一格。', note:'三選一；選擇後立刻加入背包或掉落裝備。', rewards:['藥水', '隨機裝備'],
    choices:[
      { label:'紅色藥水', detail:'紅色藥水 ×1，加入背包', effectId:'supply_hp' },
      { label:'藍色藥水', detail:'藍色藥水 ×1，加入背包', effectId:'supply_mp' },
      { label:'隨機裝備', detail:'掉落一件與目前樓層相符的裝備', effectId:'supply_gear' }
    ]
  },
  sealed_chest: {
    id:'sealed_chest', family:'chest', name:'封印寶箱', previewTag:'封印寶箱',
    worldType:'chest', minChapter:2, weight:2, threat:1, color:'#d9a8ff',
    soulCostBase:12, soulCostPerChapter:4,
    desc:'靈魂封印正等待等價的供品。', note:'支付顯示的靈魂後，獲得稀有以上裝備。', rewards:['高品質裝備', '靈魂成本'],
    choices:[
      { label:'支付靈魂並解封', detail:'支付靈魂；獲得稀有以上裝備', effectId:'sealed_reward', costType:'souls' },
      { label:'拒絕交易', detail:'保留靈魂，不影響清房與探索評價', effectId:'decline' }
    ]
  },
  blood_blessing: {
    id:'blood_blessing', family:'shrine', name:'血之祝福', previewTag:'血之祝福',
    worldType:'shrine', minChapter:2, weight:3, threat:2, color:'#ff8a8a',
    desc:'祭壇要求鮮血，並承諾整場冒險的力量。', note:'必須保有足夠 HP；祝福持續至本次冒險結束。', rewards:['攻擊 +12%', 'HP 成本'],
    choices:[
      { label:'獻上鮮血', detail:'失去 20% 最大 HP；本局攻擊永久 +12%', effectId:'blood_blessing', costType:'max_hp' },
      { label:'拒絕祝福', detail:'不失去 HP，也不影響探索評價', effectId:'decline' }
    ]
  },
  life_spring: {
    id:'life_spring', family:'shrine', name:'生命泉源', previewTag:'生命泉源',
    worldType:'shrine', minChapter:1, weight:4, threat:1, color:'#7dffd6',
    desc:'清澈泉水散發溫暖生命力。', note:'飲用後回復 35% 最大 HP 與 50% 最大 MP。', rewards:['HP 回復', 'MP 回復'],
    choices:[
      { label:'飲用泉水', detail:'回復 35% 最大 HP＋50% 最大 MP', effectId:'life_spring' },
      { label:'保留泉水', detail:'不消耗泉水以外的資源；本房不再使用', effectId:'decline' }
    ]
  },
  arcane_spring: {
    id:'arcane_spring', family:'shrine', name:'奧術泉源', previewTag:'奧術泉源',
    worldType:'shrine', minChapter:2, weight:3, threat:1, color:'#8aa8ff',
    desc:'泉面映出三個技能符印，魔力正在回流。', note:'回滿 MP，三個技能的剩餘冷卻各減少 25%。', rewards:['MP 全滿', '冷卻縮減'],
    choices:[
      { label:'引導奧術', detail:'MP 回滿；三技能剩餘冷卻各減少 25%', effectId:'arcane_spring' },
      { label:'離開泉源', detail:'保留現況，不影響探索評價', effectId:'decline' }
    ]
  },
  fate_altar: {
    id:'fate_altar', family:'shrine', name:'命運祭壇', previewTag:'命運重抽',
    worldType:'shrine', minChapter:2, weight:2, threat:1, color:'#ffd36a',
    desc:'三枚命運硬幣懸浮於祭壇上方。', note:'下一次升級選卡可額外重抽一次；可累積。', rewards:['升級重抽', '無成本'],
    choices:[
      { label:'接受命運硬幣', detail:'下一次升級選卡獲得額外重抽 ×1', effectId:'fate_altar' },
      { label:'維持原命運', detail:'不取得重抽，也不影響探索評價', effectId:'decline' }
    ]
  },
  forgotten_forge: {
    id:'forgotten_forge', family:'shrine', name:'遺忘熔爐', previewTag:'鍛造或拆解',
    worldType:'shrine', minChapter:1, weight:3, threat:1, color:'#ffb45e',
    desc:'熄滅多年的熔爐仍保存一小簇祝火。', note:'可淬鍊武器取得本局攻擊，或拆解爐材換取強化石。', rewards:['攻擊強化', '強化石'],
    choices:[
      { label:'以祝火淬刃', detail:'本局攻擊永久 +6%', effectId:'forge_temper' },
      { label:'拆解爐材', detail:'強化石 ×2，立即存入素材欄', effectId:'forge_salvage' },
      { label:'讓熔爐沉睡', detail:'安全離開，不消耗任何資源', effectId:'decline' }
    ]
  },
  wandering_alchemist: {
    id:'wandering_alchemist', family:'shrine', name:'流浪鍊金師', previewTag:'藥劑二選一',
    worldType:'shrine', minChapter:1, weight:3, threat:1, color:'#7dffd6',
    desc:'戴著厚重面罩的鍊金師願意分享一份配方。', note:'補給組加入背包；復原藥劑則立即回復 HP 與 MP。', rewards:['雙色藥水', '立即回復'],
    choices:[
      { label:'領取平衡補給', detail:'紅色藥水 ×1、藍色藥水 ×1', effectId:'alchemy_bundle' },
      { label:'飲用復原藥劑', detail:'立即回復 50% 最大 HP 與 MP', effectId:'alchemy_restoration' },
      { label:'謝絕配方', detail:'安全離開，不改變背包與生命', effectId:'decline' }
    ]
  },
  echoing_archive: {
    id:'echoing_archive', family:'shrine', name:'回音書庫', previewTag:'奧術記憶',
    worldType:'shrine', minChapter:2, weight:2, threat:1, color:'#8aa8ff',
    desc:'漂浮書頁記錄著尚未發生的施法與選擇。', note:'可清除目前技能冷卻，或取得兩次升級選卡重抽。', rewards:['技能重置', '選卡重抽'],
    choices:[
      { label:'抄錄施法回音', detail:'MP 回滿；三個技能冷卻立即歸零', effectId:'archive_cooldown' },
      { label:'研讀命運索引', detail:'升級選卡重抽 +2 次', effectId:'archive_fate' },
      { label:'闔上書頁', detail:'安全離開，不改變技能與重抽', effectId:'decline' }
    ]
  },
  lost_caravan: {
    id:'lost_caravan', family:'chest', name:'失落商隊', previewTag:'補給或交易',
    worldType:'chest', minChapter:1, weight:3, threat:1, color:'#ffd36a',
    soulCostBase:10, soulCostPerChapter:3,
    desc:'傾倒的貨車旁只剩完好的補給箱與交易契約。', note:'可免費取走急救補給，或支付顯示的靈魂換取稀有裝備。', rewards:['紅色藥水', '稀有裝備'],
    choices:[
      { label:'取走急救補給', detail:'紅色藥水 ×2，加入背包', effectId:'caravan_supplies' },
      { label:'履行交易契約', detail:'支付靈魂；獲得稀有以上裝備', effectId:'caravan_trade', costType:'souls' },
      { label:'保持原狀', detail:'保留靈魂並安全離開', effectId:'decline' }
    ]
  },
  ancient_cache: {
    id:'ancient_cache', family:'chest', name:'古代秘藏', previewTag:'塵晶或靈魂',
    worldType:'chest', minChapter:2, weight:2, threat:1, color:'#d9a8ff',
    soulRewardBase:8, soulRewardPerChapter:2,
    desc:'石匣內的塵晶與靈魂只能安全取出其中一側。', note:'附魔塵直接存入素材欄；靈魂數量會隨章節提高。', rewards:['附魔塵', '靈魂'],
    choices:[
      { label:'回收附魔塵', detail:'附魔塵 ×2，立即存入素材欄', effectId:'cache_dust' },
      { label:'引導封存靈魂', detail:'取得依章節提高的靈魂', effectId:'cache_souls', rewardType:'souls' },
      { label:'封回石匣', detail:'安全離開，不取走任何資源', effectId:'decline' }
    ]
  },
  elite_ambush: {
    id:'elite_ambush', family:'trial', name:'菁英伏擊', previewTag:'菁英伏擊',
    worldType:'challenge', minChapter:1, weight:3, threat:3, color:'#ff8a6a',
    trialType:'elite', targetCount:3,
    desc:'解除封印會喚醒三名菁英守衛。', note:'成功：稀有裝備＋附魔塵；拒絕：安全離開，不影響清房。', rewards:['稀有裝備', '附魔塵'],
    choices:[
      { label:'接受試煉', detail:'擊敗 3 名事件菁英；成功取得稀有裝備＋附魔塵', effectId:'start_trial' },
      { label:'暫時離開', detail:'不影響清房與探索評價', effectId:'decline' }
    ]
  },
  timed_clear: {
    id:'timed_clear', family:'trial', name:'限時殲滅', previewTag:'35 秒殲滅',
    worldType:'challenge', minChapter:2, weight:2, threat:3, color:'#ffb45e',
    trialType:'timed', durationFrames:2100, waves:[3, 4], targetCount:7,
    desc:'封印會連續喚醒兩波守衛。', note:'35 秒內清除兩波可得額外獎勵；逾時後守衛保留，但只算普通清房。', rewards:['稀有裝備', '限時材料'],
    choices:[
      { label:'開始計時', detail:'35 秒內清除 2 波共 7 名守衛；逾時失去額外獎勵', effectId:'start_trial' },
      { label:'拒絕試煉', detail:'不啟動波次，不影響清房與探索評價', effectId:'decline' }
    ]
  },
  flawless_wave: {
    id:'flawless_wave', family:'trial', name:'無傷試煉', previewTag:'無傷一波',
    worldType:'challenge', minChapter:2, weight:2, threat:3, color:'#8aa8ff',
    trialType:'flawless', targetCount:4,
    desc:'四名守衛將同時現身，護盾吸收不算受傷。', note:'生命值一旦實際降低即失敗；守衛仍需清除，既有物品不會被扣除。', rewards:['稀有裝備', '無傷材料'],
    choices:[
      { label:'接受無傷試煉', detail:'無傷擊敗 4 名守衛；受傷後轉為普通清房', effectId:'start_trial' },
      { label:'拒絕試煉', detail:'不召喚守衛，不影響清房與探索評價', effectId:'decline' }
    ]
  },
  hazard_trial: {
    id:'hazard_trial', family:'trial', name:'地形試煉', previewTag:'地形＋守衛',
    worldType:'challenge', minChapter:2, weight:2, threat:3, color:'#ffb45e',
    trialType:'hazard', targetCount:3,
    desc:'穿越目前群系的危險地形，並擊敗三名守衛。', note:'成功條件：抵達出口檢查線＋清除守衛；失敗或拒絕都不會卡住出口。', rewards:['稀有裝備', '附魔塵'],
    choices:[
      { label:'接受地形試煉', detail:'通過群系地形並擊敗 3 名守衛；成功取得額外獎勵', effectId:'start_trial' },
      { label:'拒絕試煉', detail:'不召喚守衛；仍可正常清房離開', effectId:'decline' }
    ]
  }
};

const DUNGEON_ROOM_DEFS = {
  safe: {
    name:'安全戰鬥', short:'戰鬥', threat:1, score:1, color:'#7dffd6', icon:'⚔',
    desc:'標準怪物配置，適合穩定累積經驗。', rewards:['經驗', '一般掉落']
  },
  elite: {
    name:'菁英獵殺', short:'菁英', threat:2, score:2, color:'#d9a8ff', icon:'◆',
    desc:'怪物較少，但保證出現兩名強化菁英。', rewards:['裝備', '強化石']
  },
  treasure: {
    name:'寶藏房', short:'寶藏', threat:1, score:1, color:'#ffd36a', icon:'▣',
    desc:'少量守衛看守旅行者寶箱。', rewards:['精良裝備', '附魔塵']
  },
  event: {
    name:'事件房', short:'事件', threat:2, score:1, color:'#ff9f7a', icon:'?',
    desc:'祭壇或封印試煉，進房後可查看完整代價。', rewards:['祝福', '稀有獎勵']
  },
  camp: {
    name:'休整營地', short:'營地', threat:0, score:0, color:'#8aa8ff', icon:'✚',
    desc:'沒有敵人，立即回復 25% HP 與 MP。', rewards:['回復']
  },
  hazard: {
    name:'群系險境', short:'險境', threat:2, score:2, color:'#ffb45e', icon:'▲',
    desc:'標準怪群加上可預警的群系專屬地形。', rewards:['靈魂加成', '材料']
  },
  boss: {
    name:'首領房', short:'BOSS', threat:3, score:0, color:'#ff6b6b', icon:'☠',
    desc:'章節最終首領，擊敗後可撤退或繼續深入。', rewards:['Boss 裝備', '章節寶箱']
  }
};

const DUNGEON_ROUTE_WEIGHTS = {
  safe:4,
  elite:3,
  treasure:2,
  event:2,
  camp:1,
  hazard:2
};
