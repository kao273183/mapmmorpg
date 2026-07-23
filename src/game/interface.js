"use strict";
// ---------- input ----------
const keys = {};
const pressedKeys = {};
const DASH_COOLDOWN = 150;
const DASH_DURATION = 10;
const DASH_SPEED = 8;
const inputBuffer = { jump:0, dash:0, skills:[0, 0, 0] };
const skillPulseT = [0, 0, 0];
let dashPulseT = 0;
let coyoteT = 0;
function normalizeGameKey(key) { return key === ' ' ? 'space' : key.toLowerCase(); }
function setGameKey(key, down) {
  const k = normalizeGameKey(key);
  if (down && !keys[k]) pressedKeys[k] = true;
  keys[k] = down;
}
function clearGameInputs() {
  for (const k of Object.keys(keys)) keys[k] = false;
  for (const k of Object.keys(pressedKeys)) delete pressedKeys[k];
  if (typeof interruptFleeChannel === 'function') interruptFleeChannel();
  inputBuffer.jump = 0; inputBuffer.dash = 0; inputBuffer.skills.fill(0);
  if (typeof resetVirtualJoystick === 'function') resetVirtualJoystick();
  for (const id of Object.keys(touchMap || {})) delete touchMap[id];
}
function captureBufferedInputs() {
  if (pressedKeys.space) inputBuffer.jump = 6;
  if (pressedKeys.shift && !player.itemWin) {
    if (player.dashCd <= 6) inputBuffer.dash = 6;
    else dashPulseT = Math.max(dashPulseT, 6);
  }
  const skillKeys = ['z', 'x', 'c'];
  for (let i = 0; i < 3; i++) {
    if (!pressedKeys[skillKeys[i]]) continue;
    if (player.slotCd[i] <= 6) inputBuffer.skills[i] = 6;
    else skillPulseT[i] = Math.max(skillPulseT[i], 6);
  }
  for (const k of Object.keys(pressedKeys)) delete pressedKeys[k];
}
function tickInputBuffers() {
  if (inputBuffer.jump > 0) inputBuffer.jump--;
  if (inputBuffer.dash > 0) inputBuffer.dash--;
  if (dashPulseT > 0) dashPulseT--;
  for (let i = 0; i < 3; i++) {
    if (inputBuffer.skills[i] > 0) inputBuffer.skills[i]--;
    if (skillPulseT[i] > 0) skillPulseT[i]--;
  }
}
const selBtns = [], metaBtns = [], itemBtns = [], delBtns = [];
let expBtn = null, impBtn = null, backTownBtn = null, gearBtn = null;
let metaCategory = 'combat';
let statsOpen = false, statsBtn = null, statsCloseBtn = null;
function openStats() { statsOpen = true; player.itemWin = false; clearGameInputs(); }
function drawGear(cx, cy, r, col) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = col;
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -r - 2, 4, 5); } // 齒
  ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.fill(); // 外圈
  ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill(); // 內孔
  ctx.restore();
}
// ---------- 設定視窗(不用 prompt,畫面內處理)----------
const GAME_VERSION = '0.29.40';
const GAME_UPDATE_NOTES = [
  {
    version:'0.29.40', date:'2026-07-23', title:'精通外觀獎勵：稱號與配色（J1-E）',
    items:['每個職業的精通軌新增四項外觀獎勵：Lv5／Lv10 給角色配色，Lv15／Lv20 給職業稱號，六個職業共 12 配色 + 12 稱號。','配色會直接換掉角色的甲冑／長袍與金屬鑲邊顏色；稱號顯示在城鎮角色頭上與角色能力面板。','精通分頁下方改成可互動的外觀獎勵軌：點上方職業卡切換檢視，已解鎖的直接點擊選用，再點一次取消。','達到等級即自動發放，舊存檔會回溯補發。外觀一律零局內戰力。']
  },
  {
    version:'0.29.39', date:'2026-07-23', title:'四大進階職與選角改版（J1-D）',
    items:['新增三個進階職：聖騎士（護盾減傷、命中回血）、元素師（火冰雷三環爆發、雷球連鎖）、咒術師（疫病持續傷害與虛弱、汲取生命）。','選角頁改版：上方固定兩張基礎職大卡，下方一列該系的「進階轉職」晶片；未達條件也會顯示灰晶片並標明解鎖門檻，不再是看不到就不知道有這回事。','進階職解鎖只看自己那一系的基礎職精通 Lv10；精通分頁與技能分頁都已排得下六個職業。','修正進階職讀檔後出戰欄被清空、開局沒有技能可用的問題。']
  },
  {
    version:'0.29.38', date:'2026-07-23', title:'轉職框架與首個進階職（J1-C）',
    items:['新增進階職「狂戰士」：劍士精通 Lv10 後解鎖，出戰選單與技能分頁都會多出一張職業卡。','狂戰士沿用劍士的屬性、裝備與技能，另有兩個專屬技能——血怒斬（消耗 HP，血越低傷害越高）與戰吼（群體緩速並自我狂暴回 MP）。','技能樹版面改為依技能數自適應，進階專屬技能排在最右一層；精通分頁與獎勵軌也改成多職業版面。','進階職精通獨立累積，不影響基礎職；既有存檔的技能與天賦完全沿用，不需重點。']
  },
  {
    version:'0.29.37', date:'2026-07-23', title:'精通分頁（J1-B）',
    items:['選單新增「★ 精通」分頁：各職業等級、經驗進度條、累積經驗、最深樓層與首殺 Boss 數。','顯示進階轉職解鎖條件（精通 Lv10）與尚差級數。','精通獎勵軌三章一覽（配色／稱號／技能外觀等），標明只給外觀與材料、不影響戰力。']
  },
  {
    version:'0.29.36', date:'2026-07-23', title:'職業精通基礎（J1-A）',
    items:['每個職業獨立累積精通經驗，共 30 級分三章；經驗來自樓層深度、擊殺與成功撤退。','首次以該職業擊敗某 Boss 給一次性加成；未突破該職最深紀錄時收益降低，避免重複刷淺層。','精通只用於外觀獎勵與日後解鎖轉職，零局內戰力；基準局不計。精通介面與獎勵於後續版本開放。']
  },
  {
    version:'0.29.35', date:'2026-07-23', title:'外觀系統地基（K1-A）',
    items:['建立統一外觀系統：稱號／角色配色／光環／技能外觀共用同一套擁有、選用與解鎖流程。','現有光環自動遷移到新系統，擁有與選用狀態不會遺失；外觀一律零局內戰力。','日後精通、成就、秘境與賽季的獎勵都由統一入口發放，稱號與配色將於後續版本開放。']
  },
  {
    version:'0.29.34', date:'2026-07-23', title:'傳奇裝備 I1-E 平衡與回歸',
    items:['凍結加入遞減冷卻：凍結後短暫免疫，避免傳奇武器把一般怪／菁英永久鎖控（Boss 本就對硬 CC 免疫）。','低特效模式下裝備掉落改為簡化底光，省略漸層光柱與星火。','新增 I1 傳奇裝備 smoke 測試；修正並同步 28 項 smoke 測試全數通過。']
  },
  {
    version:'0.29.33', date:'2026-07-23', title:'修正 PWA 卡舊版無法更新',
    items:['修正 Service Worker：index.html／導覽改為「網路優先」，線上一律取得最新版本（原本一律回快取導致卡在舊版、偵測不到更新）。','版本化資產維持快取優先，離線仍可遊玩；新版部署後重開 App 即會更新。','此修正部署後，舊 App 重開一次會自動換上新 SW，之後即可正常更新。']
  },
  {
    version:'0.29.32', date:'2026-07-23', title:'裝備詳細 tooltip',
    items:['桌機在裝備視窗把滑鼠移到裝備欄或背包裝備上，會顯示詳細資訊卡。','資訊卡含稀有度、完整數值、詞綴、傳奇能力與出處、套裝效果與職業限制。','資訊卡跟隨滑鼠並自動避開邊界，邊框依稀有度上色。']
  },
  {
    version:'0.29.31', date:'2026-07-23', title:'裝備掉落發光',
    items:['地上裝備依稀有度發光：地面徑向光暈＋漸層光柱（底亮頂淡），越稀有越亮越高。','傳說與傳奇掉落加上星火閃爍；傳奇以專屬金橙色最為醒目。','普通／精良維持低調底光，遠遠就能辨識好裝掉在哪。']
  },
  {
    version:'0.29.30', date:'2026-07-23', title:'裝備介面美化',
    items:['裝備視窗改為圓角面板＋外陰影、標題漸層列與分隔線。','裝備欄改圓角、空欄顯示部位提示；角色背後加光暈；屬性獨立子面板。','背包列改圓角並保留稀有度色條，整體更精緻一致。']
  },
  {
    version:'0.29.29', date:'2026-07-23', title:'裝備介面優化',
    items:['背包列加上稀有度色條與底色暈染，一眼掃出稀有度；傳奇為金橙色。','裝備欄框改依稀有度上色，傳奇與高稀有度會發光。','背包標題顯示數量 N/12，接近上限（≥10）轉為警示色。']
  },
  {
    version:'0.29.28', date:'2026-07-23', title:'傳奇裝備 I1-C：擴充與頭盔類',
    items:['新增頭盔類傳奇：曦光頭冠（爆擊率 +10%）、窟影兜帽（移速大幅提升）；被動屬性接入爆擊/移速。','新增群系主題傳奇武器：翠風劍（緩速）、劇毒之牙（劇毒）、裂空劍（連鎖）、奪魂杖（法擊吸血）、炎爆法杖（點燃）。','傳奇命名裝擴至 15 件，五大群系皆有專屬掉落目標。']
  },
  {
    version:'0.29.27', date:'2026-07-23', title:'傳奇裝備 I1-B：燃燒與被動能力',
    items:['新增燃燒 DoT 機制與傳奇「烈焰之刃」（命中點燃，持續傷害）；燃燒擊殺正常計經驗與靈魂。','新增傳奇防具「荊棘板甲」（受擊反傷 50%）與傳奇飾品「不滅之戒」（每場一次致命免死）。','紙娃娃裝備區改為逐件顯示所有已裝備傳奇裝的能力全文。']
  },
  {
    version:'0.29.26', date:'2026-07-23', title:'傳奇命名裝備（第一批）',
    items:['新增傳奇命名裝備：冰霜劍（凍結）、嗜血巨劍（吸血）、寒霜法杖（緩速）、雷霆法杖（連鎖閃電）、疾風之靴（極速+跳躍）。','只在困難模式的高稀有度掉落（取代套裝），有專屬金橙色與能力說明；命中觸發特殊能力。','一般模式因掉落最高藍裝，不會出現傳奇命名裝。']
  },
  {
    version:'0.29.25', date:'2026-07-23', title:'難度「複雜」改名為「困難」',
    items:['難度模式「複雜」顯示名稱改為「困難」；內部設定相容，既有選擇不受影響。','未來規劃：困難將擴充為秘境式分層難度（可選層級、越高越強、獎勵更好）。']
  },
  {
    version:'0.29.24', date:'2026-07-23', title:'更新紀錄版面修正',
    items:['更新項目間隔改為依實際行數動態調整，單行項目不再空一大截。','更新紀錄視窗高度依內容自動縮放，消除下方大片空白。']
  },
  {
    version:'0.29.23', date:'2026-07-23', title:'一般模式升等較快',
    items:['一般模式經驗值 ×1.25，升等更快；跳字直接顯示加成後的 EXP。','複雜模式維持原經驗值。','基地難度提示補上「升等較快」。']
  },
  {
    version:'0.29.22', date:'2026-07-23', title:'一般模式掉落上限：頂多藍裝',
    items:['一般模式掉落稀有度上限鎖在藍（精良）：不再掉稀有、史詩、傳說與套裝，含 Boss 保底與寶箱。','複雜模式維持完整掉落（可掉傳說與套裝）；基地難度提示標明「一般最高藍裝」。','鍛造套裝（花材料）不受影響，仍可做出套裝件。']
  },
  {
    version:'0.29.21', date:'2026-07-23', title:'一般模式 Boss 再調弱 + Boss 血量數字',
    items:['一般模式 Boss 傷害降至 0.55、生命降至 0.72（原為一律 0.85），傷害降更多以減少被秒的挫折。','Boss 血量條加上「目前／最大」數字顯示，看得到還剩多少。','複雜模式 Boss 維持全強度。']
  },
  {
    version:'0.29.20', date:'2026-07-23', title:'難度移至基地選擇 + 掉落取捨 + 全螢幕',
    items:['「本次難度：一般（推薦）／複雜」移至基地頁「選擇冒險者」，出戰前即可切換；設定頁不再重複顯示。','一般模式新增掉落機率取捨：裝備與藥水掉落 ×0.7（Boss 保底掉落不受影響），並在基地標明。','設定頁右上角新增「全螢幕」切換，桌機 Web 與 Android 皆可；iOS Safari 分頁不支援時提示改用「加入主畫面」。']
  },
  {
    version:'0.29.17', date:'2026-07-22', title:'逃走機制：道中撤退回基地',
    items:['道中長按 Q（手機為「逃」鈕）約 1.5 秒即可逃回基地，受擊會中斷蓄力。','路線選擇畫面新增「返回基地」按鈕（鍵盤 R），隨時能主動撤退。','逃走視為撤退：保留本局裝備、靈魂與素材，不算死亡。']
  },
  {
    version:'0.29.16', date:'2026-07-22', title:'難度模式：一般／複雜',
    items:['設定新增「難度模式」：一般（推薦）與複雜，即時生效並記住於本瀏覽器。','一般模式移除滑冰與消失平台、減少每房陷阱與地形傷害，並降低險境房出現機率。','一般模式同步降低五群系 Boss 的生命與傷害；複雜模式維持現行完整地形與 Boss 強度。']
  },
  {
    version:'0.29.15', date:'2026-07-22', title:'虛擬搖桿放大與 PWA',
    items:['虛擬搖桿預設放大約 1.35 倍，所有尺寸改由單一係數推導並以左下角為錨點，放大不出畫面。','設定頁新增「手機搖桿大小」：−／＋、拖曳長條、重置(80%～200%)，即時生效並記住。','新增 PWA：可加到主畫面、離線遊玩、版本自動更新(桌機／手機皆偵測)，並提供安裝提示。']
  },
  {
    version:'0.29.14', date:'2026-07-22', title:'行動版顯示與虛擬搖桿',
    items:['橫向畫面改依瀏覽器實際可視高度縮放，Safari 網址列與分頁列展開時也不會裁掉遊戲上下緣。','左側三個方向按鈕改為可拖曳的圓形虛擬搖桿，支援左右移動與向下穿越平台。','保留右側跳躍、衝刺、技能、藥水、裝備與能力按鈕，並補齊窄高度與多點觸控回歸。']
  },
  {
    version:'0.29.13', date:'2026-07-22', title:'G1-F 平衡與完整收尾',
    items:['以 D3 劍士／法師配對基準比較無效果、只拿祝福、只拿詛咒與混合四種局況。','固定模型與極端疊加均未越過首輪警戒，因此保留既有數值，不以理論值冒充自然遊玩樣本。','平衡紀錄新增祝福／詛咒組合、通關時間、承傷、靈魂與房間獎勵，完整報表可一併匯出。']
  },
  {
    version:'0.29.12', date:'2026-07-22', title:'G1-E 異變選擇介面',
    items:['每隔 3～4 層交替提供祝福與自願詛咒，選完後才繼續原本的路線或 Boss。','候選卡直接顯示效果；詛咒分開顯示代價與對應收益，支援兩次重抽與安全拒絕。','桌機與手機共用卡片命中區；HUD 可按 M 或點擊查看本局持有的祝福與詛咒。']
  },
  {
    version:'0.29.11', date:'2026-07-22', title:'G1-D 事件結果擴充',
    items:['新增遺忘熔爐、流浪鍊金師、回音書庫、失落商隊與古代秘藏。','事件定義由 12 個增至 17 個，正式非拒絕結果由 10 種增至 20 種。','新事件均提供安全離開；交易會預覽實際成本，資源不足不扣款，完成後不重複發獎。']
  },
  {
    version:'0.29.10', date:'2026-07-22', title:'G1-C 十二種詛咒',
    items:['新增戰鬥、奧術、生存、挑戰各 3 種，共 12 種自願詛咒。','每個詛咒都同時公開代價與對應收益，涵蓋玩家、敵人、菁英、險境與 Boss 結算。','封印命運會失去剩餘異變重抽並換得兩次選卡重抽；最後燈火禁用復活並提高靈魂收益。']
  },
  {
    version:'0.29.9', date:'2026-07-22', title:'G1-B 十二種祝福',
    items:['新增攻擊、防禦、機動、資源各 3 種，共 12 種每局祝福，依章節逐步解鎖。','祝福已接入傷害、生命與護盾、回復、移動、衝刺、跳躍、靈魂及裝備掉落結算。','所有祝福各自設有單次取得上限；命運絲線每局只提供一次額外升級選卡重抽。']
  },
  {
    version:'0.29.8', date:'2026-07-22', title:'G1-A 祝福與詛咒技術地基',
    items:['建立祝福／詛咒共用的每局狀態、選擇、接受與安全拒絕流程。','同一地城種子可重現選項；每局提供兩次有限重抽，且不會重複提供已持有項目。','詛咒資料必須同時標示代價與對應收益；本批只建立契約，不調整戰鬥數值。']
  },
  {
    version:'0.29.7', date:'2026-07-22', title:'F1 專案結構整理',
    items:['程式碼集中至 src，主遊戲依責任拆成九個載入順序固定的模組。','遊戲素材與原始素材包分流至 assets/runtime 與 assets/source。','完成完整 smoke、手機橫向、正式頁素材與舊存檔回歸；本次不調整玩法數值。']
  },
  {
    version:'0.29.6', date:'2026-07-22', title:'E1-G Boss 平衡與收尾',
    items:['五隻 Boss 各加入劍士／法師固定配對基準，統計擊殺時間與承傷。','設定新增 Boss 測試紀錄頁，顯示目標區間與超過 15% 的職業差警戒。','完成手機、低特效、死亡／撤退、掉落、舊存檔與完整 smoke 回歸。']
  },
  {
    version:'0.29.5', date:'2026-07-22', title:'E1-F 虛空深淵 Boss',
    items:['深淵魔王加入虛空彈幕與平台消除，彈幕死亡來源可獨立記錄。','平台消除只作用於浮空平台；第三階段最多消除兩座，仍保留一座浮台。','地面主路徑永不消除，招式期間以穩定地面標線提示安全保底。']
  },
  {
    version:'0.29.4', date:'2026-07-22', title:'E1-E 冰霜凍原 Boss',
    items:['冰霜領主加入寒冰槍陣與暴風突進，兩種死亡來源分開記錄。','暴風突進會留下冰面並沿用滑行慣性；持續反方向輸入可煞車與反向。','第一階段先教槍陣，第二階段起才加入突進與冰面，第三階段擴大槍陣。']
  },
  {
    version:'0.29.3', date:'2026-07-22', title:'E1-D 熾熱熔岩 Boss',
    items:['熔岩魔王加入熔岩衝鋒與連鎖噴發，兩種死亡來源分開記錄。','連鎖噴口保留可穿越間隔，熄火後以冷色框標示 96 幀安全窗。','第一階段先教衝鋒，第二階段起才加入連鎖噴發，第三階段提高衝鋒距離與速度。']
  },
  {
    version:'0.29.2', date:'2026-07-22', title:'E1-C 幽暗洞窟 Boss',
    items:['洞窟領主加入落石標記與雙向洞窟衝擊波，兩種死亡來源分開記錄。','落石依階段增加為 2／3／4 處，衝擊波從第二階段起加入招式循環。','三座岩棚以發光邊線標示安全區；站上岩棚可避開落石與地面衝擊波。']
  },
  {
    version:'0.29.1', date:'2026-07-22', title:'E1-B 翠綠草原 Boss',
    items:['草原領主加入根鬚橫掃與種子彈幕，傷害來源可分別記錄。','第二階段起根鬚會留下減速荊棘，第三階段才與彈幕、跳撲組合。','新增草原領主專屬樹冠外觀；低特效仍保留地面框與招式名稱。']
  },
  {
    version:'0.29.0', date:'2026-07-22', title:'E1-A 五群系 Boss 技術地基',
    items:['五群系 Boss 改為獨立資料定義，保留現有難度與共用招式。','建立統一階段、招式預警、場地與環境互動介面。','平衡紀錄新增 Boss 擊殺時間、死亡招式與最終階段。']
  },
  {
    version:'0.28.9', date:'2026-07-22', title:'D3-C 首輪數值校準',
    items:['固定基準模型首輪只調整三項，幅度維持 10～12.5%。','菁英單體 HP 係數 2.40→2.15；落石與熔岩傷害 8%→7%。','險境額外靈魂提高 10%；平衡報表保留完整調整前後值。']
  },
  {
    version:'0.28.8', date:'2026-07-22', title:'D3-B 固定基準局與報表',
    items:['劍士與法師各加入新手、第二章、第三章三組固定裝備與種子。','自然遊玩與固定基準局分開統計，不混用樣本。','報表新增職業、房型、承傷占比、試煉與警戒線比較。']
  },
  {
    version:'0.28.7', date:'2026-07-22', title:'D3 平衡紀錄與遊戲內更新紀錄',
    items:['記錄最近 60 局的路線、房型、耗時、承傷與撤退結果。','設定新增平衡紀錄摘要，可複製完整 JSON 供測試比較。','設定新增更新紀錄頁，可直接查看最近版本內容。']
  },
  {
    version:'0.28.6', date:'2026-07-22', title:'地城 D2 完整交付',
    items:['五種群系地形與十二種事件完整接入地城路線。','1,000 組種子、手機觸控、死亡與撤退保存完成回歸。','正式頁與測試頁資源版本完成統一。']
  },
  {
    version:'0.28.5', date:'2026-07-22', title:'四種試煉與房間完成狀態',
    items:['加入菁英、限時、無傷與地形四種試煉。','成功、失敗與拒絕都能正常解除房門。','試煉獎勵改為單次發放並加入 HUD 狀態。']
  }
];
let settingsOpen = false, settingsMode = null; // 'import' | 'rename' | null
let settingsPage = 'main', settingsUpdateIndex = 0, settingsBalanceMode = 'natural', settingsBenchmarkIndex = 0;
const settingsBtns = [];
let saveInput = null;
function getSaveInput() {
  if (saveInput) return saveInput;
  saveInput = document.createElement('input');
  saveInput.type = 'text'; saveInput.setAttribute('autocomplete', 'off');
  saveInput.style.cssText = 'position:fixed;left:50%;top:56%;transform:translate(-50%,-50%);width:70%;max-width:440px;padding:10px 12px;font:14px "Courier New",monospace;z-index:9999;display:none;background:#14162b;color:#fff;border:2px solid #7dffd6;border-radius:4px;text-align:center;';
  saveInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') applySaveInput(); else if (e.key === 'Escape') closeSaveEdit(); });
  document.body.appendChild(saveInput);
  return saveInput;
}
function startSaveEdit(mode) {
  settingsMode = mode;
  const el = getSaveInput();
  el.value = mode === 'rename' ? (meta.playerName || '') : '';
  el.placeholder = mode === 'rename' ? '輸入新名字(最多12字)後按 Enter' : '貼上存檔碼後按 Enter';
  el.style.display = 'block'; el.focus();
}
function closeSaveEdit() { settingsMode = null; if (saveInput) { saveInput.style.display = 'none'; saveInput.blur(); } }
function applySaveInput() {
  const v = (saveInput.value || '').trim();
  if (settingsMode === 'rename') { if (v) { meta.playerName = v.slice(0, 12); saveMeta(); menuMsg = { text: '已改名為 ' + meta.playerName, color: '#7dffd6', t: 200 }; } }
  else if (settingsMode === 'import') {
    const a = decodeSave(v);
    if (a) { applyMeta(a[1], a.slice(2, 7), a[7]); if (a[0] >= 2) applySkillNums(a.slice(8, 8 + 46)); saveMeta(); menuMsg = { text: '匯入成功!靈魂 ' + meta.souls, color: '#7dffd6', t: 220 }; }
    else menuMsg = { text: '存檔碼無效', color: '#ff5a5a', t: 220 };
  }
  closeSaveEdit();
}
function drawSettingsButton(x, y, w, h, label, act, color) {
  const b = { x, y, w, h, act };
  settingsBtns.push(b);
  ctx.fillStyle = color || 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  return b;
}
function renderSettingsUpdates(mx, my, mw, mh) {
  const note = GAME_UPDATE_NOTES[settingsUpdateIndex] || GAME_UPDATE_NOTES[0];
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('v' + note.version + '　' + note.date, W / 2, my + 78);
  ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 17px "Courier New",monospace';
  ctx.fillText(note.title, W / 2, my + 108);
  let iy = my + 146;
  for (let i = 0; i < note.items.length; i++) {
    ctx.fillStyle = '#b98cff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.textAlign = 'left';
    ctx.fillText('◆', mx + 42, iy);
    ctx.fillStyle = '#c8cdec'; ctx.font = '13px "Courier New",monospace'; ctx.textAlign = 'center';
    const lines = wrapText(note.items[i], W / 2 + 10, iy, mw - 112, 18);
    iy += lines * 18 + 18; // 依實際行數動態間隔，1 行的不再空一大截
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#777e9f'; ctx.font = '11px "Courier New",monospace';
  ctx.fillText((settingsUpdateIndex + 1) + ' / ' + GAME_UPDATE_NOTES.length, W / 2, my + mh - 76);
  if (settingsUpdateIndex < GAME_UPDATE_NOTES.length - 1) drawSettingsButton(mx + 28, my + mh - 58, 150, 38, '← 較舊版本', 'updatesOlder');
  if (settingsUpdateIndex > 0) drawSettingsButton(mx + 188, my + mh - 58, 150, 38, '較新版本 →', 'updatesNewer');
  drawSettingsButton(mx + mw - 188, my + mh - 58, 160, 38, '返回設定', 'settingsBack', 'rgba(125,255,214,0.14)');
}
function renderSettingsBalance(mx, my, mw, mh) {
  const report = typeof dungeonBalanceReport === 'function' ? dungeonBalanceReport(settingsBalanceMode) : null;
  const summary = report ? report.summary : { runs:0, extractRate:0, averageFloor:0, averageDurationSec:0, riskyChoiceRate:0, averageDamage:0, topDamage:[] };
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText(settingsBalanceMode === 'benchmark' ? '固定基準局 · 與自然遊玩分開' : '自然遊玩 · 最近 60 局', W / 2, my + 72);
  drawSettingsButton(mx + 146, my + 84, 138, 30, '自然遊玩', 'balanceNatural', settingsBalanceMode === 'natural' ? 'rgba(125,255,214,0.18)' : null);
  drawSettingsButton(mx + 296, my + 84, 138, 30, '固定基準', 'balanceBenchmark', settingsBalanceMode === 'benchmark' ? 'rgba(185,140,255,0.18)' : null);
  const rows = [
    ['樣本', summary.runs ? summary.runs + ' 局' : '尚無資料'],
    ['平均局長', summary.runs ? Math.round(summary.averageDurationSec / 60) + ' 分鐘' : '—'],
    ['劍士平均樓層', report && report.classStats.warrior.runs ? report.classStats.warrior.averageFloor.toFixed(1) : '—'],
    ['法師平均樓層', report && report.classStats.mage.runs ? report.classStats.mage.averageFloor.toFixed(1) : '—'],
    ['高風險選擇', summary.runs ? Math.round(summary.riskyChoiceRate * 100) + '%' : '—'],
    ['撤退率', summary.runs ? Math.round(summary.extractRate * 100) + '%' : '—']
  ];
  for (let i = 0; i < rows.length; i++) {
    const x = mx + 32 + (i % 2) * 258, y = my + 126 + Math.floor(i / 2) * 58;
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, 244, 48);
    ctx.strokeStyle = '#343850'; ctx.strokeRect(x, y, 244, 48);
    ctx.textAlign = 'left'; ctx.fillStyle = '#7f86a7'; ctx.font = '11px "Courier New",monospace'; ctx.fillText(rows[i][0], x + 12, y + 18);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.fillText(String(rows[i][1]), x + 232, y + 33);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#b98cff'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.fillText('主要承傷來源', mx + 32, my + 320);
  ctx.fillStyle = '#aeb4d0'; ctx.font = '11px "Courier New",monospace';
  const damageText = report && report.damageShares.length ? report.damageShares.slice(0, 3).map(item => item.source + ' ' + Math.round(item.share * 100) + '%').join('　·　') : '完成地城後會顯示排行';
  ctx.fillText(damageText, mx + 32, my + 342);
  ctx.fillStyle = report && report.alerts.length ? '#ffb45e' : '#6f7695';
  ctx.fillText(report && report.alerts.length ? '警戒：' + report.alerts[0] : '樣本達門檻後自動檢查平衡警戒線', mx + 32, my + 366);
  const calibration = report && report.calibration;
  const bossEncounterCount = report ? Object.values(report.bossStats || {}).reduce((sum, item) => sum + (item.encounters || 0), 0) : 0;
  ctx.fillStyle = '#7dffd6'; ctx.font = '10px "Courier New",monospace';
  const g1Model = typeof dungeonG1BalanceReport === 'function' ? dungeonG1BalanceReport() : null;
  ctx.fillText(calibration ? '校準 v' + calibration.version + '　·　G1 四組模型' + (g1Model && !g1Model.alerts.length ? '通過' : '待檢查') + '　·　Boss 紀錄 ' + bossEncounterCount + ' 場' : '', mx + 32, my + 389);
  if (menuMsg) {
    ctx.textAlign = 'center'; ctx.fillStyle = menuMsg.color; ctx.font = 'bold 12px "Courier New",monospace';
    ctx.fillText(menuMsg.text, W / 2, my + mh - 72);
    if (--menuMsg.t <= 0) menuMsg = null;
  }
  drawSettingsButton(mx + 20, my + mh - 58, 135, 38, '複製報表', 'copyBalance', 'rgba(185,140,255,0.16)');
  drawSettingsButton(mx + 165, my + mh - 58, 120, 38, 'Boss 紀錄', 'bossRecords', 'rgba(185,140,255,0.14)');
  drawSettingsButton(mx + 295, my + mh - 58, 120, 38, '基準設定', 'benchmarkSetup', 'rgba(255,180,94,0.12)');
  drawSettingsButton(mx + 425, my + mh - 58, 135, 38, '返回設定', 'settingsBack', 'rgba(125,255,214,0.14)');
}
function renderSettingsBosses(mx, my, mw, mh) {
  const report = typeof dungeonBalanceReport === 'function' ? dungeonBalanceReport(settingsBalanceMode) : null;
  const comparison = settingsBalanceMode === 'benchmark' && typeof dungeonBossBenchmarkComparison === 'function' ? dungeonBossBenchmarkComparison() : null;
  const bossIds = typeof DUNGEON_BOSS_ORDER !== 'undefined' ? DUNGEON_BOSS_ORDER : [];
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText(settingsBalanceMode === 'benchmark' ? '固定基準 · 配對裝備與種子' : '自然遊玩 · 最近 60 局', W / 2, my + 66);
  ctx.fillStyle = '#777e9f'; ctx.font = '10px "Courier New",monospace';
  ctx.fillText('擊殺時間目標與承傷只作警戒；每職業至少 3 場後再判斷', W / 2, my + 84);
  for (let i = 0; i < bossIds.length; i++) {
    const id = bossIds[i], stat = report && report.bossStats[id];
    const compared = comparison && comparison.bosses[id];
    const target = compared ? compared.target : (typeof DUNGEON_BOSS_BENCHMARK_TARGETS !== 'undefined' ? DUNGEON_BOSS_BENCHMARK_TARGETS.find(item => item.bossId === id) : null);
    const warrior = compared ? compared.warrior : stat && stat.classStats.warrior;
    const mage = compared ? compared.mage : stat && stat.classStats.mage;
    const paired = compared ? compared.paired : !!(warrior && mage && warrior.kills && mage.kills);
    const meanClear = paired ? (warrior.averageClearSec + mage.averageClearSec) / 2 : 0;
    const classGapPct = compared ? compared.classGapPct : paired && meanClear ? Math.abs(warrior.averageClearSec - mage.averageClearSec) / meanClear : 0;
    const ready = compared ? compared.ready : !!(warrior && mage && warrior.encounters >= 3 && mage.encounters >= 3);
    const x = mx + 22, y = my + 96 + i * 58, w = mw - 44;
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, w, 50);
    ctx.strokeStyle = ready && paired && classGapPct > 0.15 ? '#ffb45e' : '#343850'; ctx.strokeRect(x, y, w, 50);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillText((stat && stat.name) || (target && target.bossName) || id, x + 12, y + 19);
    ctx.fillStyle = '#7f86a7'; ctx.font = '10px "Courier New",monospace';
    const encounters = stat ? stat.encounters : 0, kills = stat ? stat.kills : 0;
    ctx.fillText('場次 ' + encounters + ' · 擊殺 ' + kills + (target ? ' · 目標 ' + target.clearSec[0] + '～' + target.clearSec[1] + '秒' : ''), x + 12, y + 39);
    const fmtClass = (label, item) => label + ' ' + (item && item.kills ? Math.round(item.averageClearSec) + '秒／傷' + Math.round(item.averageDamage) : '—');
    ctx.textAlign = 'right'; ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillText(fmtClass('劍', warrior) + '　' + fmtClass('法', mage), x + w - 12, y + 20);
    ctx.fillStyle = ready && paired ? (classGapPct <= 0.15 ? '#7dffd6' : '#ffb45e') : '#6f7695'; ctx.font = '10px "Courier New",monospace';
    ctx.fillText(paired ? '職業差 ' + Math.round(classGapPct * 100) + '%' + (ready ? '' : ' · 待各3場') : '等待配對樣本', x + w - 12, y + 39);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = comparison && comparison.alerts.length ? '#ffb45e' : '#6f7695'; ctx.font = '10px "Courier New",monospace';
  const readyCount = comparison ? Object.values(comparison.bosses).filter(item => item.ready).length : 0;
  ctx.fillText(comparison && comparison.alerts.length ? comparison.alerts[0] : readyCount ? '目前沒有超過 15% 的已配對職業警戒' : '每職業累積 3 場後啟用 15% 職業差警戒', W / 2, my + mh - 72);
  drawSettingsButton(mx + 24, my + mh - 58, 250, 38, '複製完整報表', 'copyBalance', 'rgba(185,140,255,0.16)');
  drawSettingsButton(mx + mw - 274, my + mh - 58, 250, 38, '返回平衡報表', 'bossRecordsBack', 'rgba(125,255,214,0.14)');
}
function renderSettingsBenchmark(mx, my, mw, mh) {
  const profiles = typeof DUNGEON_BENCHMARK_PROFILES !== 'undefined' ? DUNGEON_BENCHMARK_PROFILES : [];
  ctx.fillStyle = '#7dffd6'; ctx.font = '12px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText('固定種子與開局裝備；永久成長維持目前帳號', W / 2, my + 70);
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i], x = mx + 24 + (i % 2) * 270, y = my + 92 + Math.floor(i / 2) * 70;
    const selected = i === settingsBenchmarkIndex;
    const b = drawSettingsButton(x, y, 262, 54, profile.label, 'benchmarkSelect', selected ? 'rgba(185,140,255,0.2)' : null);
    b.index = i;
    ctx.fillStyle = selected ? '#ffe680' : '#7f86a7'; ctx.font = '10px "Courier New",monospace';
    ctx.fillText(profile.gearLabel + ' · Seed ' + profile.seed, x + 131, y + 44);
  }
  const selected = profiles[settingsBenchmarkIndex];
  ctx.fillStyle = '#8c92b1'; ctx.font = '11px "Courier New",monospace';
  ctx.fillText(selected ? '開始後不會改動倉庫；本局標記為 ' + selected.id : '沒有可用基準', W / 2, my + 326);
  drawSettingsButton(mx + 24, my + mh - 58, 260, 38, '開始固定基準局', 'benchmarkStart', 'rgba(255,180,94,0.18)');
  drawSettingsButton(mx + mw - 284, my + mh - 58, 260, 38, '返回平衡報表', 'balanceBack', 'rgba(125,255,214,0.14)');
}
function renderSettings() {
  settingsBtns.length = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  const mw = 580;
  let mh = 470;
  if (settingsPage === 'updates') {
    // 更新頁高度依內容自動縮放，避免下方大片空白
    const note = GAME_UPDATE_NOTES[settingsUpdateIndex] || GAME_UPDATE_NOTES[0];
    let itemsH = 0;
    for (const it of note.items) itemsH += measureWrapLines(it, mw - 112) * 18 + 18;
    mh = Math.max(320, Math.min(470, 146 + itemsH + 84));
  }
  const mx = W / 2 - mw / 2, my = H / 2 - mh / 2;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 22px "Courier New",monospace';
  ctx.fillText(settingsPage === 'updates' ? '更 新 紀 錄' : settingsPage === 'balance' ? 'D3 平 衡 報 表' : settingsPage === 'bosses' ? 'BOSS 測 試 紀 錄' : settingsPage === 'benchmark' ? '固 定 基 準 局' : '設 定', W / 2, my + 38);
  if (settingsPage === 'updates') { renderSettingsUpdates(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  if (settingsPage === 'balance') { renderSettingsBalance(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  if (settingsPage === 'bosses') { renderSettingsBosses(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  if (settingsPage === 'benchmark') { renderSettingsBenchmark(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px "Courier New",monospace'; ctx.fillText('名稱:' + (meta.playerName || '勇者'), W / 2, my + 66);
  ctx.fillStyle = '#8890b8'; ctx.font = '11px "Courier New",monospace'; ctx.fillText('設定儲存在此瀏覽器；存檔碼可備份角色進度', W / 2, my + 86);
  // 全螢幕切換（右上角 header 動作；iOS Safari 分頁不支援時提示改用「加入主畫面」）
  const fsActive = typeof gameFullscreenActive === 'function' && gameFullscreenActive();
  const fsBtn = { x: mx + mw - 148, y: my + 14, w: 132, h: 30, act: 'fullscreen' };
  settingsBtns.push(fsBtn);
  ctx.fillStyle = fsActive ? 'rgba(125,255,214,0.18)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(fsBtn.x, fsBtn.y, fsBtn.w, fsBtn.h);
  ctx.strokeStyle = fsActive ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(fsBtn.x, fsBtn.y, fsBtn.w, fsBtn.h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText(fsActive ? '◱ 結束全螢幕' : '◱ 全螢幕', fsBtn.x + fsBtn.w / 2, fsBtn.y + 20);
  ctx.textAlign = 'center';
  ctx.fillStyle = audioSettings.muted ? '#ff8a8a' : '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('音效音量：' + (audioSettings.muted ? '靜音' : Math.round(audioSettings.volume * 100) + '%'), W / 2, my + 112);
  const sm = (x, y, w, label, act, on) => { const b = { x, y, w, h:34, act }; settingsBtns.push(b); ctx.fillStyle = on ? 'rgba(125,255,214,0.22)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, w, 34); ctx.strokeStyle = on ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 34); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.fillText(label, x + w / 2, y + 22); };
  sm(mx + 64, my + 124, 92, '－ 10%', 'volDown', false);
  sm(mx + 166, my + 124, 92, '＋ 10%', 'volUp', false);
  sm(mx + 304, my + 124, 192, audioSettings.muted ? '開啟音效' : '靜音', 'mute', audioSettings.muted);
  ctx.fillStyle = '#b98cff'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.fillText('戰鬥效果', W / 2, my + 184);
  const shakeNames = ['關', '低', '完整'];
  sm(mx + 26, my + 196, 118, '震動 ' + shakeNames[combatSettings.shake], 'shake', combatSettings.shake > 0);
  sm(mx + 156, my + 196, 118, '閃光 ' + (combatSettings.flashes ? '完整' : '降低'), 'flashes', combatSettings.flashes);
  sm(mx + 286, my + 196, 118, '數字 ' + (combatSettings.numbers === 'full' ? '完整' : '精簡'), 'numbers', combatSettings.numbers === 'full');
  sm(mx + 416, my + 196, 118, '觸覺 ' + (combatSettings.haptics ? '開' : '關'), 'haptics', combatSettings.haptics);
  // 手機搖桿大小（難度模式已移至基地頁「選擇冒險者」）
  ctx.fillStyle = '#7dc4ff'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText('手機搖桿大小：' + Math.round(virtualJoystick.size * 100) + '%', W / 2, my + 252);
  sm(mx + 26, my + 262, 60, '－', 'joySizeDown', false);
  const jbX = mx + 96, jbY = my + 262, jbW = 300, jbH = 34;
  settingsBtns.push({ x: jbX, y: jbY, w: jbW, h: jbH, act: 'joySizeBar' });
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(jbX, jbY, jbW, jbH);
  ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(jbX, jbY, jbW, jbH);
  const jRatio = (virtualJoystick.size - JOY_SIZE_MIN) / (JOY_SIZE_MAX - JOY_SIZE_MIN);
  ctx.fillStyle = 'rgba(125,196,255,0.35)'; ctx.fillRect(jbX, jbY, jbW * jRatio, jbH);
  ctx.fillStyle = '#cfe4ff'; ctx.fillRect(jbX + jbW * jRatio - 2, jbY - 3, 4, jbH + 6);
  sm(mx + 406, my + 262, 60, '＋', 'joySizeUp', false);
  sm(mx + 478, my + 262, 76, '重置', 'joySizeReset', false);
  const bw = 240, bh = 42, bx1 = W / 2 - bw - 10, bx2 = W / 2 + 10, byy = my + 312;
  const mk = (x, y, label, act, col) => { const b = { x, y, w: bw, h: bh, act }; settingsBtns.push(b); ctx.fillStyle = col || 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.fillText(label, x + bw / 2, y + 27); };
  mk(bx1, byy, '複製存檔碼', 'copy', 'rgba(125,255,214,0.2)');
  mk(bx2, byy, '匯入存檔', 'import');
  mk(bx1, byy + 52, '改名', 'rename');
  mk(bx2, byy + 52, '更新紀錄 v' + GAME_VERSION, 'updates', 'rgba(185,140,255,0.16)');
  mk(bx1, byy + 104, 'D3 平衡紀錄', 'balance', 'rgba(125,255,214,0.12)');
  mk(bx2, byy + 104, '關閉', 'close', 'rgba(226,59,59,0.2)');
  if (settingsMode) { ctx.fillStyle = '#ffe680'; ctx.font = '12px "Courier New",monospace'; ctx.fillText('（下方輸入框輸入後按 Enter,Esc 取消）', W / 2, my + mh - 12); }
  if (menuMsg) { ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace'; ctx.fillText(menuMsg.text, W / 2, my + mh + 22); if (--menuMsg.t <= 0) menuMsg = null; }
  ctx.textAlign = 'left';
}
const tabBtns = [], skillBtns = [], skillActBtns = [], stashBtns = [], stashActBtns = [], activityBtns = [], diffBtns = [];
let gachaBtn = null;
function dismantleStash(it) {
  const i = meta.stash.indexOf(it);
  if (i < 0) return;
  meta.stash.splice(i, 1);
  for (const part of GEAR_PARTS) if (meta.loadout[part] === it.uid) meta.loadout[part] = null;
  const m = addMat(it.r, it);
  saveMeta();
  menuMsg = { text: '分解 → 強化石+' + m.enh + (m.ench ? ' 附魔塵+' + m.ench : '') + (m.set ? ' 套裝核心+' + m.set : ''), color: '#7dffd6', t: 180 };
  beep(500, 0.1, 'square', 0.03);
}
// ---------- 強化 ----------
const ENH_MAX = 12;
function enhCost(lv) { return lv + 2; }
function enhRate(lv) { return lv < 3 ? 0.9 : lv < 6 ? 0.75 : lv < 9 ? 0.55 : 0.35; }
function enhBoomRate(lv) { return 0.15 + 0.05 * (lv - 8); }
function enhZone(lv) { return lv < 4 ? 'safe' : lv < 8 ? 'down' : 'risk'; }
function gearDesc(it) {
  const e = enhMul(it);
  let s;
  if (it.kind === 'weapon') s = '攻擊+' + Math.round(it.atk * e);
  else if (it.kind === 'armor' || it.kind === 'helmet') s = 'HP+' + Math.round(it.hp * e) + ' 減傷' + Math.max(1, Math.round(it.def * e));
  else if (it.kind === 'boots') s = '移速+' + (Math.round(it.spd * e * 10) / 10) + (it.jmp ? ' 跳躍+1' : '');
  else if (it.kind === 'acc') s = it.crit != null ? '爆擊+' + Math.round(it.crit * e * 100) + '%' : '攻擊+' + Math.round((it.atkMul || 0) * e * 100) + '%';
  else s = it.desc || '';
  return s; // 傳奇能力文字改在紙娃娃裝備區顯示（背包列太窄）
}
function gearLabel(it) {
  const affixN = (it.affixes || []).filter(Boolean).length;
  return it.name + (it.unique ? ' ◈' : '') + ((it.enh || 0) > 0 ? ' +' + it.enh : '') + (affixN ? ' ✦' + affixN : '');
}
let enhAnim = null; // {t, result, uid}
function enhanceGear(it) {
  const lv = it.enh || 0;
  if (lv >= ENH_MAX) { menuMsg = { text: '已達強化上限 +' + ENH_MAX, color: '#ffe680', t: 180 }; return; }
  const cost = enhCost(lv);
  if (meta.mats.enh < cost) { menuMsg = { text: '強化石不足(需 ' + cost + ')', color: '#ff5a5a', t: 180 }; playSfx('uiError'); return; }
  meta.mats.enh -= cost;
  let result;
  if (Math.random() < enhRate(lv)) { it.enh = lv + 1; result = 'success'; }
  else {
    const z = enhZone(lv);
    if (z === 'safe') result = 'keep';
    else if (z === 'down') { it.enh = lv - 1; result = 'down'; }
    else if (Math.random() < enhBoomRate(lv)) result = 'boom';
    else { it.enh = lv - 1; result = 'down'; }
  }
  enhAnim = { t: 70, result: result, uid: it.uid };
  if (result === 'boom') {
    const i = meta.stash.indexOf(it); if (i >= 0) meta.stash.splice(i, 1);
    for (const part of GEAR_PARTS) if (meta.loadout[part] === it.uid) meta.loadout[part] = null;
    selStash = null;
  }
  saveMeta();
  if (result === 'success') playSfx('enhanceSuccess');
  else if (result === 'boom') playSfx('itemBreak');
  else playSfx('enhanceFail');
}
let startBtn = null;
window.addEventListener('keydown', e => {
  unlockAudio();
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  setGameKey(e.key, true);
  const k = e.key.toLowerCase();
  if (settingsOpen) {
    if (k === 'escape' && !settingsMode) {
      if (settingsPage === 'benchmark' || settingsPage === 'bosses') settingsPage = 'balance';
      else if (settingsPage !== 'main') settingsPage = 'main';
      else { settingsOpen = false; closeSaveEdit(); clearGameInputs(); }
    }
    return;
  }
  if (statsOpen) { if (k === 'p' || k === 'escape') { statsOpen = false; clearGameInputs(); } return; }
  if (handleDungeonPanelKey(k)) return;
  if (gameState === 'town') {
    if (chatting) {
      if (k === 'enter') { const t = chatInput.trim(); if (t) sendChat(t); chatInput = ''; chatting = false; }
      else if (k === 'escape') { chatInput = ''; chatting = false; }
      else if (k === 'backspace') chatInput = chatInput.slice(0, -1);
      else if (e.key.length === 1 && chatInput.length < 50) chatInput += e.key;
      e.preventDefault();
      return;
    }
    if (k === 'p') { openStats(); return; }
    if (k === 'enter') { chatting = true; e.preventDefault(); return; }
    return; // 走動/互動由 keys[] + updateTown 處理
  }
  if (gameState === 'select') {
    if (k >= '1' && k <= '9') { const jobs = jobHotkeyList(), n = parseInt(k, 10) - 1; if (jobs[n]) chosenCls = jobs[n]; } // 基礎職 + 當前系別已解鎖的進階職
    if (k === 'escape' && fromTown) { gameState = 'town'; setHint(HINT_TOWN); return; }
    if (k === 'enter' && menuTab === 'base') resetRun();
    return;
  }
  if (gameState === 'dead') {
    if (k === 'enter' || k === ' ' || k === 'space') { gameState = 'town'; setHint(HINT_TOWN); fromTown = false; }
    return;
  }
  if (gameState === 'pick') {
    if (k === 'r') { rerollPickFromEvent(); return; }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 3) applyCard(pickOpts[n - 1]);
    return;
  }
  if (eventPanel) {
    if (k === '1' || k === '2' || k === '3') chooseFloorEvent(parseInt(k, 10) - 1);
    else if (k === 'escape') eventPanel = null;
    return;
  }
  // play
  if (k === 'p') { openStats(); return; }
  if (k === 'i') player.itemWin = !player.itemWin;
  if (k === 'escape') player.itemWin = false;
  if (k === 'a') usePot('hp');
  if (k === 's') usePot('mp');
  if (player.itemWin) {
    const n = e.code && e.code.startsWith('Digit') ? parseInt(e.code.slice(5), 10) : parseInt(k, 10);
    if (n >= 1 && n <= player.items.length) {
      const it = player.items[n - 1];
      if (player.eq[it.kind] === it) return;
      if (e.shiftKey) dismantle(it); // Shift+數字 直接分解
      else equipItem(it);
    }
  }
});
window.addEventListener('keyup', e => {
  setGameKey(e.key, false);
});
window.addEventListener('blur', clearGameInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearGameInputs(); });
function handleTap(mx, my) {
  const inside = (b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  if (handleDungeonPanelTap(mx, my)) return;
  if (eventPanel) {
    for (const b of eventChoiceBtns) if (inside(b)) { chooseFloorEvent(b.choice); return; }
    return;
  }
  if (settingsOpen) {
    for (const b of settingsBtns) if (inside(b)) {
      if (b.act === 'copy') {
        const code = encodeSave();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => { menuMsg = { text: '已複製到剪貼簿', color: '#7dffd6', t: 200 }; }).catch(() => { menuMsg = { text: '複製失敗,請手動備份', color: '#ff5a5a', t: 200 }; });
        else menuMsg = { text: '此環境不支援自動複製', color: '#ff5a5a', t: 200 };
        return;
      }
      if (b.act === 'import') { startSaveEdit('import'); return; }
      if (b.act === 'rename') { startSaveEdit('rename'); return; }
      if (b.act === 'updates') { settingsPage = 'updates'; settingsUpdateIndex = 0; playSfx('uiSelect'); return; }
      if (b.act === 'updatesOlder') { settingsUpdateIndex = Math.min(GAME_UPDATE_NOTES.length - 1, settingsUpdateIndex + 1); playSfx('uiSelect'); return; }
      if (b.act === 'updatesNewer') { settingsUpdateIndex = Math.max(0, settingsUpdateIndex - 1); playSfx('uiSelect'); return; }
      if (b.act === 'balance') { settingsPage = 'balance'; playSfx('uiSelect'); return; }
      if (b.act === 'balanceNatural') { settingsBalanceMode = 'natural'; playSfx('uiSelect'); return; }
      if (b.act === 'balanceBenchmark') { settingsBalanceMode = 'benchmark'; playSfx('uiSelect'); return; }
      if (b.act === 'benchmarkSetup') { settingsPage = 'benchmark'; playSfx('uiSelect'); return; }
      if (b.act === 'bossRecords') { settingsPage = 'bosses'; playSfx('uiSelect'); return; }
      if (b.act === 'bossRecordsBack') { settingsPage = 'balance'; playSfx('uiSelect'); return; }
      if (b.act === 'benchmarkSelect') { settingsBenchmarkIndex = Math.max(0, b.index | 0); playSfx('uiSelect'); return; }
      if (b.act === 'benchmarkStart') {
        const profiles = typeof DUNGEON_BENCHMARK_PROFILES !== 'undefined' ? DUNGEON_BENCHMARK_PROFILES : [];
        if (profiles[settingsBenchmarkIndex]) startDungeonBenchmarkRun(profiles[settingsBenchmarkIndex].id);
        return;
      }
      if (b.act === 'balanceBack') { settingsPage = 'balance'; settingsBalanceMode = 'benchmark'; playSfx('uiSelect'); return; }
      if (b.act === 'settingsBack') { settingsPage = 'main'; playSfx('uiSelect'); return; }
      if (b.act === 'copyBalance') {
        const records = typeof exportDungeonBalanceRecords === 'function' ? exportDungeonBalanceRecords() : '{}';
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(records).then(() => { menuMsg = { text:'測試紀錄已複製', color:'#7dffd6', t:180 }; }).catch(() => { menuMsg = { text:'複製失敗', color:'#ff5a5a', t:180 }; });
        else menuMsg = { text:'此環境不支援自動複製', color:'#ff5a5a', t:180 };
        return;
      }
      if (b.act === 'fullscreen') {
        const r = typeof toggleGameFullscreen === 'function' ? toggleGameFullscreen() : 'unsupported';
        if (r === 'unsupported') menuMsg = { text:'此瀏覽器分頁不支援全螢幕；iOS 請用「加入主畫面」以全螢幕開啟', color:'#ffb45e', t:280 };
        playSfx('uiSelect'); return;
      }
      if (b.act === 'volDown') { changeSfxVolume(-0.1); return; }
      if (b.act === 'volUp') { changeSfxVolume(0.1); return; }
      if (b.act === 'mute') { toggleSfxMute(); return; }
      if (b.act === 'joySizeDown') { setJoystickSize(virtualJoystick.size - 0.1); playSfx('uiSelect'); return; }
      if (b.act === 'joySizeUp') { setJoystickSize(virtualJoystick.size + 0.1); playSfx('uiSelect'); return; }
      if (b.act === 'joySizeReset') { setJoystickSize(JOY_SIZE_DEFAULT); playSfx('uiSelect'); return; }
      if (b.act === 'joySizeBar') { const r = Math.max(0, Math.min(1, (mx - b.x) / b.w)); setJoystickSize(JOY_SIZE_MIN + r * (JOY_SIZE_MAX - JOY_SIZE_MIN)); playSfx('uiSelect'); return; }
      if (b.act === 'shake') {
        combatSettings.shake = (combatSettings.shake + 1) % 3; saveCombatSettings();
        triggerCombatFeel('boss', null, { stop:0 }); playSfx('uiSelect'); return;
      }
      if (b.act === 'flashes') { combatSettings.flashes = !combatSettings.flashes; saveCombatSettings(); playSfx('uiSelect'); return; }
      if (b.act === 'numbers') { combatSettings.numbers = combatSettings.numbers === 'full' ? 'compact' : 'full'; saveCombatSettings(); playSfx('uiSelect'); return; }
      if (b.act === 'haptics') { combatSettings.haptics = !combatSettings.haptics; saveCombatSettings(); if (combatSettings.haptics) combatVibrate(15); playSfx('uiSelect'); return; }
      if (b.act === 'close') { settingsOpen = false; settingsPage = 'main'; closeSaveEdit(); clearGameInputs(); return; }
    }
    return; // 設定視窗吃掉所有點擊
  }
  if (statsOpen) { if (inside(statsCloseBtn)) statsOpen = false; return; }
  if ((gameState === 'town' || gameState === 'play') && inside(statsBtn)) { openStats(); return; }
  if (gameState === 'town') {
    const cw = 360, ih = 24, ch = 108, cy = H - ch - ih - 14;
    if (mx >= 14 && mx <= 14 + cw && my >= cy) { // 點聊天框
      if (isTouch) { const t = window.prompt('聊天:'); if (t && t.trim()) sendChat(t.trim()); }
      else chatting = true;
      return;
    }
    const wx = mx + townCamX, wy = my + townCamY; // 點擊走向該世界座標
    townTargetX = Math.max(30, Math.min(TOWN_W - 30, wx));
    townTargetY = Math.max(150, Math.min(TOWN_H - 40, wy));
    townTargetNpc = null;
    for (const n of NPCS) if (Math.hypot(n.x - wx, n.y - wy) < 60) { townTargetNpc = n; townTargetX = n.x; townTargetY = n.y; break; }
    return;
  }
  if (gameState === 'select') {
    if (inside(backTownBtn)) { gameState = 'town'; setHint(HINT_TOWN); return; }
    for (const b of tabBtns) if (inside(b)) { menuTab = b.tab; pendingReset = null; return; }
    if (inside(gearBtn)) { openTownPanel('save'); return; }
    if (menuTab === 'mastery') {
      // 獎勵晶片優先於職業卡（晶片畫在卡片之外，但先比對較精確的目標）
      for (const b of masteryBtns) {
        if (b.act !== 'equip' || !inside(b)) continue;
        const on = equippedCosmetic(b.type) === b.id;
        if (on) { ensureCosmeticState().equipped[b.type] = COSMETIC_DEFAULT_EQUIPPED[b.type]; saveMeta(); }
        else equipCosmetic(b.type, b.id);
        playSfx('uiSelect', 0.7); return;
      }
      for (const b of masteryBtns) {
        if (b.act !== 'focus' || !inside(b)) continue;
        masteryFocusJob = b.job; playSfx('uiSelect', 0.6); return;
      }
      return;
    }
    if (menuTab === 'skills') {
      if (inside(gachaBtn)) { drawSkillGacha(); return; }
      for (const b of skillBtns) if (inside(b)) { selSkill = b.id; pendingReset = null; playSfx('uiSelect', 0.7); return; }
      for (const b of skillActBtns) {
        if (!inside(b)) continue;
        if (b.act === 'cls') { chosenCls = b.cls; selSkill = null; pendingReset = null; playSfx('uiSelect', 0.7); return; }
        if (b.act === 'invest') { investTalent(selSkill, b.br); return; }
        if (b.act === 'equip') { toggleLoadout(selSkill); return; }
        if (b.act === 'slot') { assignSkillSlot(selSkill, b.slot); return; }
        if (b.act === 'reset') {
          if (pendingReset && pendingReset.id === selSkill && frame - pendingReset.f < 150) { resetTalent(selSkill); pendingReset = null; }
          else pendingReset = { id: selSkill, f: frame };
          return;
        }
      }
      return;
    }
    if (menuTab === 'stash') {
      for (const b of stashBtns) if (inside(b)) { selStash = b.uid; pendingStashDel = null; return; }
      for (const b of stashActBtns) {
        if (!inside(b)) continue;
        const sel = meta.stash.find(s => s.uid === selStash);
        if (!sel) return;
        if (b.act === 'equip') {
          if (!gearUsableByClass(sel, chosenCls)) { menuMsg = { text:'此裝備限 ' + (sel.cls === 'mage' ? '法師' : '劍士') + ' 使用', color:'#ff8a8a', t:180 }; playSfx('uiError'); return; }
          meta.loadout[sel.kind] = meta.loadout[sel.kind] === sel.uid ? null : sel.uid; saveMeta(); return;
        }
        if (b.act === 'enhance') { enhanceGear(sel); return; }
        if (b.act === 'enchant') { enchantGearSlot(sel, b.slot); return; }
        if (b.act === 'forgeSet') { forgeSetPiece(sel.setId); return; }
        if (b.act === 'dismantle') {
          if (pendingStashDel === sel.uid) { dismantleStash(sel); selStash = null; }
          else pendingStashDel = sel.uid;
          return;
        }
      }
      return;
    }
    if (menuTab === 'activity') {
      for (const b of activityBtns) {
        if (!inside(b)) continue;
        if (b.act === 'task') claimActivityTask(b.scope, b.id);
        else if (b.act === 'milestone') claimActivityMilestone(b.points);
        else if (b.act === 'aura') equipAura(b.id);
        return;
      }
      return;
    }
    for (const b of selBtns) if (inside(b)) { chosenCls = b.cls; return; }
    for (const b of diffBtns) if (inside(b)) {
      if (b.act === 'terrainNormal') setTerrainMode('normal');
      else if (b.act === 'terrainComplex') setTerrainMode('complex');
      playSfx('uiSelect'); return;
    }
    for (const b of metaBtns) if (inside(b)) {
      if (b.act === 'category') { metaCategory = b.category; playSfx('uiSelect', 0.65); }
      else if (b.d) buyMeta(b.d);
      return;
    }
    if (inside(startBtn)) resetRun();
    return;
  }
  if (gameState === 'dead') { gameState = 'town'; setHint(HINT_TOWN); fromTown = false; return; }
  if (gameState === 'pick') {
    if (pickRerollBtn && inside(pickRerollBtn)) { rerollPickFromEvent(); return; }
    for (const b of pickBtns) if (inside(b)) { applyCard(b.c); return; }
    return;
  }
  if (player.itemWin) {
    for (const b of delBtns) if (inside(b)) {
      if (pendingDel && pendingDel.it === b.it) dismantle(b.it);
      else pendingDel = { it: b.it, f: frame };
      return;
    }
    for (const b of itemBtns) if (inside(b)) { equipItem(b.it); return; }
  }
  if (mx >= 840 && my >= H - 16) player.itemWin = !player.itemWin;
}
cv.addEventListener('mousedown', e => {
  unlockAudio();
  const r = cv.getBoundingClientRect();
  handleTap((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
});
let hoverGX = -1, hoverGY = -1; // 滑鼠在畫布座標（供裝備 tooltip）
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  hoverGX = (e.clientX - r.left) * (W / r.width);
  hoverGY = (e.clientY - r.top) * (H / r.height);
});
cv.addEventListener('mouseleave', () => { hoverGX = -1; hoverGY = -1; });

// ---------- touch controls ----------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.__FORCE_TOUCH_CONTROLS__ === true;
if (window.__FORCE_TOUCH_CONTROLS__ === true) document.documentElement.classList.add('force-touch-controls');
// 虛擬搖桿：所有尺寸由單一 size 係數推導(1 = 原始 70px 半徑)。
// 以左下角為錨點(左緣 x=30、底緣 y=474 固定),放大時往右上長，永遠不出畫面。
const virtualJoystick = { x:100, y:404, size:1, baseRadius:70, radius:70, hitRadius:88, knobRange:38, cross:44, knobR:27 };
const JOY_SIZE_MIN = 0.8, JOY_SIZE_MAX = 2.0, JOY_SIZE_DEFAULT = 1.35;
function applyVirtualJoystickSize(size) {
  const s = Math.max(JOY_SIZE_MIN, Math.min(JOY_SIZE_MAX, size || JOY_SIZE_DEFAULT));
  const r = virtualJoystick.baseRadius * s;
  virtualJoystick.size = s;
  virtualJoystick.radius = r;
  virtualJoystick.hitRadius = r * 1.26;
  virtualJoystick.knobRange = r * 0.54;
  virtualJoystick.cross = r * 0.63;
  virtualJoystick.knobR = r * 0.39;
  virtualJoystick.x = 30 + r;   // 左緣固定 x=30
  virtualJoystick.y = 474 - r;  // 底緣固定 y=474
}
function saveJoystickSize() { try { localStorage.setItem('joystickSize', String(virtualJoystick.size)); } catch (e) {} }
function setJoystickSize(v) { applyVirtualJoystickSize(Math.round((v || 0) * 20) / 20); saveJoystickSize(); } // 對齊 0.05 格
(function initJoystickSize() {
  let s = JOY_SIZE_DEFAULT;
  try { const v = parseFloat(localStorage.getItem('joystickSize')); if (!isNaN(v)) s = v; } catch (e) {}
  applyVirtualJoystickSize(s);
})();
let joystickTouchId = null;
let joystickVectorX = 0;
let joystickVectorY = 0;
function virtualJoystickAt(mx, my) {
  return Math.hypot(mx - virtualJoystick.x, my - virtualJoystick.y) <= virtualJoystick.hitRadius;
}
function updateVirtualJoystick(mx, my) {
  let dx = mx - virtualJoystick.x, dy = my - virtualJoystick.y;
  const distance = Math.hypot(dx, dy);
  const limit = virtualJoystick.radius;
  if (distance > limit) { dx *= limit / distance; dy *= limit / distance; }
  joystickVectorX = dx / limit;
  joystickVectorY = dy / limit;
  setGameKey('arrowleft', joystickVectorX < -0.24);
  setGameKey('arrowright', joystickVectorX > 0.24);
  setGameKey('arrowdown', joystickVectorY > 0.34);
}
function resetVirtualJoystick() {
  joystickTouchId = null;
  joystickVectorX = 0;
  joystickVectorY = 0;
  setGameKey('arrowleft', false);
  setGameKey('arrowright', false);
  setGameKey('arrowdown', false);
}
const vbtns = [
  { x: 870, y: 396, w: 74, h: 74, label: '跳', press: 'space' },
  { x: 786, y: 396, w: 74, h: 74, label: 'Z', press: 'z' },
  { x: 702, y: 396, w: 74, h: 74, label: 'X', press: 'x' },
  { x: 618, y: 396, w: 74, h: 74, label: 'C', press: 'c' },
  { x: 550, y: 396, w: 56, h: 74, label: '衝', press: 'shift' },
  { x: 702, y: 330, w: 52, h: 52, label: 'A', tap: () => usePot('hp') },
  { x: 768, y: 330, w: 52, h: 52, label: 'S', tap: () => usePot('mp') },
  { x: 834, y: 330, w: 52, h: 52, label: 'I', tap: () => { player.itemWin = !player.itemWin; } },
  { x: 890, y: 330, w: 52, h: 52, label: 'P', tap: openStats },
  { x: 636, y: 330, w: 52, h: 52, label: '逃', hold: 'q' },
];
const touchMap = {}; // touch identifier -> virtual control
function touchPos(t) {
  const r = cv.getBoundingClientRect();
  return [(t.clientX - r.left) * (W / r.width), (t.clientY - r.top) * (H / r.height)];
}
function vbtnAt(mx, my) {
  return vbtns.find(b => mx >= b.x - 8 && mx <= b.x + b.w + 8 && my >= b.y - 8 && my <= b.y + b.h + 8);
}
function releaseVbtn(b) {
  if (!b) return;
  if (b === virtualJoystick) { resetVirtualJoystick(); return; }
  if (b.hold) setGameKey(b.hold, false);
  if (b.press) setGameKey(b.press, false);
}
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  unlockAudio();
  if (eventPanel || dungeonPanelOpen()) {
    const firstTouch = e.changedTouches[0];
    if (firstTouch) { const [mx, my] = touchPos(firstTouch); handleTap(mx, my); }
    return;
  }
  for (const t of e.changedTouches) {
    const [mx, my] = touchPos(t);
    if (gameState === 'play') {
      if (joystickTouchId == null && virtualJoystickAt(mx, my)) {
        joystickTouchId = t.identifier;
        touchMap[t.identifier] = virtualJoystick;
        updateVirtualJoystick(mx, my);
        continue;
      }
      const b = vbtnAt(mx, my);
      if (b) {
        touchMap[t.identifier] = b;
        if (b.hold) setGameKey(b.hold, true);
        if (b.press) setGameKey(b.press, true);
        if (b.tap) b.tap();
        continue;
      }
    }
    handleTap(mx, my);
  }
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const prev = touchMap[t.identifier];
    if (!prev) continue;
    const [mx, my] = touchPos(t);
    if (prev === virtualJoystick) {
      updateVirtualJoystick(mx, my);
      continue;
    }
    const b = vbtnAt(mx, my);
    if (b !== prev) {
      releaseVbtn(prev);
      delete touchMap[t.identifier];
      if (b && (b.hold || b.press)) {
        touchMap[t.identifier] = b;
        if (b.hold) setGameKey(b.hold, true);
        if (b.press) setGameKey(b.press, true);
      }
    }
  }
}, { passive: false });
function touchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    releaseVbtn(touchMap[t.identifier]);
    delete touchMap[t.identifier];
  }
}
cv.addEventListener('touchend', touchEnd, { passive: false });
cv.addEventListener('touchcancel', touchEnd, { passive: false });
function drawTouchUI() {
  if (!isTouch || gameState !== 'play' || eventPanel || dungeonPanelOpen()) return;
  const held = new Set(Object.values(touchMap));
  ctx.textAlign = 'center';
  const stickActive = joystickTouchId != null;
  ctx.beginPath(); ctx.arc(virtualJoystick.x, virtualJoystick.y, virtualJoystick.radius, 0, Math.PI * 2);
  ctx.fillStyle = stickActive ? 'rgba(38,72,82,0.46)' : 'rgba(20,22,43,0.38)'; ctx.fill();
  ctx.strokeStyle = stickActive ? 'rgba(125,255,214,0.82)' : 'rgba(200,205,236,0.54)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(200,205,236,0.22)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(virtualJoystick.x - virtualJoystick.cross, virtualJoystick.y); ctx.lineTo(virtualJoystick.x + virtualJoystick.cross, virtualJoystick.y);
  ctx.moveTo(virtualJoystick.x, virtualJoystick.y - virtualJoystick.cross); ctx.lineTo(virtualJoystick.x, virtualJoystick.y + virtualJoystick.cross);
  ctx.stroke();
  const knobX = virtualJoystick.x + joystickVectorX * virtualJoystick.knobRange;
  const knobY = virtualJoystick.y + joystickVectorY * virtualJoystick.knobRange;
  ctx.beginPath(); ctx.arc(knobX, knobY, virtualJoystick.knobR, 0, Math.PI * 2);
  ctx.fillStyle = stickActive ? 'rgba(125,255,214,0.66)' : 'rgba(200,205,236,0.38)'; ctx.fill();
  ctx.strokeStyle = stickActive ? '#c6fff0' : 'rgba(255,255,255,0.68)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.font = 'bold 11px "Courier New",monospace';
  ctx.fillText('移動', virtualJoystick.x, virtualJoystick.y + virtualJoystick.radius + 17);
  for (const b of vbtns) {
    ctx.fillStyle = held.has(b) ? 'rgba(125,255,214,0.35)' : 'rgba(20,22,43,0.35)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(200,205,236,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold ' + (b.w > 60 ? 26 : 18) + 'px "Courier New",monospace';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.w > 60 ? 9 : 6));
  }
  ctx.textAlign = 'left';
}
