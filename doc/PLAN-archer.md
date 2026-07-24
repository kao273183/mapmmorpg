# PLAN — 弓箭手基礎職（J2）

第三個基礎職，接在劍士／法師之後（見 [PLAN-class-system.md](PLAN-class-system.md)）。這是整個職業系統**最大的一塊** —— 前面 J1-C~G 都是在既有兩職的基礎設施上加東西，弓箭手是**從零長一個新基礎職**：新精靈圖、新武器類型、新攻擊型態（遠程箭矢）、新裝備線，還要把選角頁從「固定兩張基礎職大卡」擴成三張。

> 開發位置：`feature/class-system` 分支，做完一段再合回 main（[[class-system-branch]]）。版本號往 0.29.47+ 走。

## 好消息：存檔相容不用重做

J1-C 當初把序列化區塊凍結在 `LEGACY_SKILL_IDS`（劍士＋法師的 10 技能＝46 格），其餘技能走 `ax` 欄位。**弓箭手的技能不在 LEGACY 裡，會自動落進 `ax`**——所以不必動 46 格舊區塊、不必改存檔碼。`advancedSkillState()`/`applyAdvancedSkillState()` 已經處理「非 legacy 職業」的技能與出戰欄。J2-A 要驗證這條對「基礎職」也成立（目前只有進階職走過這條路）。

## 接入點盤點（現況）

| 項目 | 現況 | 弓箭手要做的 |
|---|---|---|
| 職業表 | `CLASSES`（systems.js:6），`baseClassIds()` 自動認基礎職 | 加 `archer` |
| 精靈圖 | 只有 `WAR`／`MAGE`（bootstrap.js:287/292），手刻像素字串 | 手畫 `ARC`（持弓） |
| 武器種類 | 二元 `baseClassOf(cls)==='mage' ? 'stave' : 'sword'`（systems.js:980） | 改三向，加 `'bow'` |
| 裝備美術索引 | `it.wpn === 'stave' ? 1 : 0`（bootstrap.js:94） | 加弓的索引 |
| 裝備名稱 | `GEAR_BASE.weapon.{warrior,mage}`（systems.js:940） | 加 `archer` 一組弓名 |
| 裝備可用判定 | `gearUsableByClass` 經 `baseClassOf` | 已自動支援，免動 |
| 選角頁 | **固定兩張基礎職大卡**（191px，town.js） | 改成能容納三張基礎職 |
| 精通 | `ensureMasteryState` 自動補、精通分頁已自適應欄數 | 免動 |
| 精通外觀 | `MASTERY_COSMETIC_TABLE`（progression.js） | 加 archer 的 2 配色 + 2 稱號 |
| 攻擊型態 | 近戰扇形 / 遠程投射物 | 遠程箭矢（新投射物 kind） |

## 分段

### J2-A　基礎職框架（選得到、進得去、能普攻）— ✅ 已完成（v0.29.47）
- `CLASSES.archer`（base，`tag`/`sub` 文案）。
- **精靈圖 `ARC`**：手刻持弓像素圖（參考 WAR/MAGE 的字元調色盤；配色系統要能重上色，所以甲冑用可辨識的字元）。
- **武器類型 `'bow'`**：`it.wpn` 指派改三向（systems.js:980）；裝備美術索引加弓（bootstrap.js:94）；`GEAR_BASE.weapon.archer` 一組弓名（短弓／獵弓／複合弓／強弓／長弓）。
- **一個基礎射擊技能**（basic），先讓弓箭手能選、能進地城、能射箭。箭矢用新的投射物 kind `'arrow'`：render.js 投射物迴圈加繪製分支、update.js 加命中處理（**避免掉進火球分支**——J1-G 踩過這坑）。
- **選角頁容納第三張基礎職大卡**：目前 `jobPickList().bases` 固定畫兩張 191px 卡，要改成依基礎職數自適應（三張約 125px，或改直式）。`baseClassIds()` 已自動把 archer 算進去。
- 驗證：全新存檔選弓箭手 → 進地城 → 射箭 → 精通入帳；存檔往返（archer 技能/出戰欄落在 `ax`）。附 smoke。

### J2-B　五個基礎技能 + 箭矢特效 — ✅ 已完成（v0.29.48）
- 5 技能（1 basic + 4）。提案：**射擊**（basic，追蹤較弱的直射）／**多重箭**（扇形三箭）／**貫穿射**（穿透直線）／**箭雨**（指定範圍落箭，類隕石）／**佈設陷阱**或**蓄力射**（二選一，看想強調機動還是爆發）。各含兩條天賦分支 + Lv3/Lv5。
- 箭矢與範圍特效：找 CC0 箭矢素材（見下）或程式繪製；沿用 J1 的 `tintedSkillVfx` 染色與 `SKILL_VFX_DEFS`。
- 技能圖示從既有 70 個挑號；配色進 `SKILL_COLORS`。
- 平衡：持續輸出對齊劍士/法師基準（弓箭手定位＝遠程持續 + 範圍，單發不該贏近戰爆發）。

### J2-C　精通外觀獎勵 — ✅ 已完成（隨 v0.29.47 一併做掉）
- `MASTERY_COSMETIC_TABLE.archer`：Lv5/10 配色、Lv15/20 稱號（例：翠羽綠／獵人褐；神射手、百步穿楊）。配色的重上色對照表要蓋到 ARC 精靈圖用到的字元（`tests/cosmetics-j1e-smoke.js` 會檢查）。

### J2-D　進階職 1：遊俠（ranger）——陷阱／機動 — ✅ 已完成（v0.29.49）
- `CLASSES.ranger`（base:archer, advanced），archer 精通 Lv10 解鎖。
- **疾羽射**（專屬 basic，取代射擊）：低 MP、短冷卻的快箭，命中給移速加成；分支 疾風（移速更久）／連射（追加第二箭）。
- **絆索陷阱**：在腳下佈設持續傷害地帶；分支 毒索（傷害更高）／束縛（改為定身）。
- **迅步**：向後翻滾 + 短暫無敵，落地後下一箭傷害加成。
- 新機制：`skillAreaDamage` 的 `slow`/`root` 選項、`playZoneAnim` 的 `snare` 種類、`moveSpd()` 的 `swiftT` 加成。

### J2-E　進階職 2：神射手（marksman）——蓄力爆發／穿透 — ✅ 已完成（v0.29.49）
- `CLASSES.marksman`（base:archer, advanced）。
- **狙擊**（專屬 basic，取代射擊）：慢而重的大箭，附帶額外暴擊率；分支 致命（暴擊率更高）／穩固（傷害更高）。
- **蓄力狙擊**：高倍率穿透巨箭，穿透不衰減。
- **鷹眼**：專注狀態，期間傷害／暴擊提升、冷卻縮短；分支 凝神（技能免 MP）／速射（冷卻更短）。
- 新機制：投射物的 `critBoost`/`pierceMax`/`noDecay`，`skillMpCost` 與冷卻計算的 `deadeyeT` 掛勾。

> 三個弓系基本技（射擊／疾羽射／狙擊）**共用 `arrow` 投射物但各自染色**（箭矢改走 `SKILL_VFX_DEFS`，
> `tint` 由技能指定）——同系該長得像箭，但要分得出是誰射的。`tests/skill-fx-smoke.js` 會檢查
> 「同 kind 必須有不同 tint」。

### J2-F　平衡與回歸
- 基準檔加 archer + ranger + marksman（`DUNGEON_BENCHMARK_PROFILES`，弓的固定裝備）。
- 選角頁在「3 基礎職 × 各 2 進階職＝最多 9 職業」下的版面（晶片列已依系分組，主要壓力在三張基礎大卡 + 精通分頁欄數，兩者都已部分自適應，需複驗）。
- 回歸：零局內戰力、舊存檔相容、箭矢投射物在低特效下的表現、手機版面。仿 `tests/class-j1f-regression.js`。

## 素材盤點（2026-07-24 找過，全 CC0）

不像劍士斬擊有一個包全包，弓箭手素材比較零散——沒有單一包給齊全部。分工如下：

| 要用的 | 方案 | 授權 |
|---|---|---|
| **角色精靈圖** | 自己刻（像 WAR/MAGE，持弓）。這條沒有現成好用的側視像素弓箭手，自刻最省。 | — |
| **飛行箭矢** | **建議程式繪製**（一根 shaft + 箭頭 + 羽尾），像 slashArc 那樣——箭是簡單形狀，還能跟斬擊一樣依練度/分支染色、依飛行方向轉向，零素材負擔。備選：Rotating Arrow。 | — |
| **弓的裝備圖示** | [CC0 Ranged Icons](https://opengameart.org/content/cc0-ranged-icons)（AntumDeluge）——32×32 弓/箭/弩，多來源 CC0 匯整，取一把弓當 weapon 圖示。 | CC0 |
| **放箭動畫（可選）** | [bow and arrow spritesheet](https://opengameart.org/content/bow-and-arrow-spritesheet)（johnnytal）——拉弓→放箭，24 格，可在角色手邊播一下增加「射」的手感。 | CC0 |
| **箭雨／多重箭範圍特效** | 用箭矢素材組合，或箭雨沿用隕石的落下路徑改皮；染色系統已就緒。 | — |

其他看過但不理想：
- [Rotating Arrow Projectile](https://opengameart.org/content/rotating-arrow-projectile)（Randalinski, CC0, 64×64）——完整箭矢含羽尾，但是**直向旋轉**的，橫向射擊要自己轉，不如程式畫。
- [CC0 Arrows](https://opengameart.org/content/cc0-arrows)（knekko, CC0）——**大多是 UI 方向箭頭**（游標指標），真正的弓箭沒幾個，不合用。

### ✅ 已備妥：DCSS 遠程武器包（CC0，2026-07-24）

`assets/source/ranged-dcss/`（[node/12210](https://opengameart.org/node/12210)，**CC0**，與專案現用的 sword-dcss/stave-dcss 同源）一次補齊兩個缺口：

- **弓 → 裝備 5 稀有度**：短弓（普通）→ 弓（精良）→ 長弓（稀有）→ 華麗長弓（史詩）→ **urand 傳奇弓**（傳說）。全 32×32。
- **箭 → 投射物**：一般箭＝基礎射擊；`boltfire`/`boltice`/`arrow02poison` 等元素變體對得上元素技能。32×32 靜態 sprite，飛行時依方向轉向即可（不必程式畫箭）。
- 弩/投石/吹箭用不到，保留在 source。

**所以角色精靈圖是唯一還要自製的**（自刻，像 WAR/MAGE）。技能圖示用現有 70 個裡的 #24/#30/#52。**幾乎不必再下載任何東西。**

接入 runtime 由 J2-A 進行：弓的 gear art 掛點（`GEAR_ART` 加 archer 一套、`GEAR_BASE.weapon.archer`）、箭矢投射物 kind（render+update 兩邊都要加，別掉進火球分支）。

- 素材走 `assets/source/<pack>/` + `assets/runtime/`，登記 `LICENSE.md`。push 用 [[github-dual-account-push]]。

## 主要風險 / 待決

1. **選角頁三張基礎職大卡的版面**——目前是為兩張寫死的，這是 J2-A 最花工的 UI 改動。
2. **基礎職走 `ax` 欄位**是否完全 OK——理論上成立（archer 非 legacy），J2-A 要用存檔往返實測確認，這是唯一的存檔風險點。
3. **弓箭手的定位平衡**——遠程 + 範圍容易過強（法師已是遠程），要在 J2-B/F 用實測數據壓住，別讓弓箭手變成「更好的法師」。
4. 箭矢投射物要記得在 render **和** update **兩邊**都加分支（J1-G 的無聲失效坑）。
