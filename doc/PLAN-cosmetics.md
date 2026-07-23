# PLAN — 外觀系統（稱號 / 配色 / 技能外觀，K1）

把目前只有「光環」的外觀，擴成一套**統一外觀系統**：稱號、角色配色、光環、技能外觀。這是 [職業精通](PLAN-class-system.md)、[圖鑑成就](PLAN-H1.md)、[秘境](PLAN-rift.md) 與未來賽季的**共用獎勵地基**——那些系統的獎勵幾乎都指向外觀，先把地基做好，它們才有東西可發。

> 現況：只有 `AURA_DEFS` + `equipAura`（[progression.js:500/606](../src/game/progression.js)），擁有/選用狀態存在 `activityState.cosmetics/aura`。稱號、配色、技能外觀都不存在。

## 固定設計契約

- **零戰力**：外觀純展示，絕不影響任何局內數值。
- **統一狀態 + 統一 API**：所有類別走同一套擁有/選用/解鎖流程，任何系統（精通/成就/活躍/賽季）都能呼叫 `unlockCosmetic` 發獎。
- **存檔相容**：新狀態存進 `meta`（或既有 activityState），**遷移現有光環**；舊存檔缺欄位＝只有預設，不報錯；不動存檔碼位置式編碼。
- **可套用點明確**：稱號→名牌/結算；配色→玩家繪製；光環→既有；技能外觀→技能特效繪製。
- 跨平台（桌機/手機/低特效）、smoke、舊存檔相容。

## 1. 外觀類別

| 類別 | 內容 | 套用點（現成掛勾） |
|---|---|---|
| **稱號 title** | 顯示在名牌／結算的頭銜文字 | 城鎮名牌、死亡/撤退結算 |
| **角色配色 color** | 重新著色玩家像素圖的配色方案 | `drawSprite(..., recolor)`（[bootstrap.js:322](../src/game/bootstrap.js) 已有 recolor 參數！） |
| **光環 aura** | 角色周身光環（已存在） | `drawEquippedAura`（bootstrap.js:334） |
| **技能外觀 skin** | 技能特效的配色/變體 | 技能特效繪製處（render.js 技能特效） |

## 2. 統一狀態與 API

```
meta.cosmetics = {
  owned:    { title:[], color:[], aura:[], skin:[] },   // 已解鎖 id
  equipped: { title:null, color:null, aura:'none', skin:null }
}
```
- API：`unlockCosmetic(type, id)`（發獎共用入口，回傳是否新解鎖）、`equipCosmetic(type, id)`、`ownsCosmetic(type, id)`。
- **遷移**：載入時把舊 `activityState.cosmetics`（光環）搬進 `meta.cosmetics.owned.aura` 與 `equipped.aura`，`equipAura` 轉呼叫 `equipCosmetic('aura', id)`（保留相容）。
- 目錄：`COSMETIC_DEFS = { title:{...}, color:{...}, aura:AURA_DEFS, skin:{...} }`，每筆 `{ id, name, ... , source:'mastery'|'achievement'|'activity'|'season' }`。

## 3. 掛接點

| 項目 | 位置 | 作法 |
|---|---|---|
| 狀態/存檔 | `meta` + `saveMeta`/`loadMeta`（progression.js） | 加 `cosmetics`，遷移舊光環 |
| 配色套用 | `drawSprite`（bootstrap.js:322，已有 `recolor`） | 玩家繪製傳入所選配色的 recolor 表 |
| 光環 | `drawEquippedAura`（bootstrap.js:334） | 沿用，改讀統一狀態 |
| 稱號 | 城鎮名牌 / 結算（town.js / render.js） | 名字旁/下顯示所選稱號 |
| 技能外觀 | 技能特效繪製（render.js） | 依所選 skin 換配色/變體 |
| 發獎入口 | 精通/成就/活躍/賽季 | 統一呼叫 `unlockCosmetic(type,id)` |
| 選用介面 | 選單「外觀」頁或城鎮 | 分類瀏覽已解鎖、點擊選用 |

## 4. 分批交付

- **K1-A 統一狀態與遷移**：`meta.cosmetics` + `unlock/equip/owns` API + 遷移現有光環（`equipAura` 轉接）。附 smoke（解鎖→擁有→選用→存檔往返）。
- **K1-B 稱號**：`TITLE_DEFS` + 名牌/結算顯示所選稱號 + 選用。
- **K1-C 角色配色**：`COLOR_DEFS`（recolor 表）+ 玩家繪製套用（`drawSprite` recolor）+ 選用。
- **K1-D 技能外觀**：`SKIN_DEFS` + 技能特效依 skin 換色/變體。
- **K1-E 外觀面板**：選單新增「外觀」頁，四類分頁瀏覽/選用（含光環）。
- **K1-F 發獎串接 + 回歸**：接精通(J1-E)/成就(H1-E)/活躍里程碑的解鎖；確認零戰力、存檔相容、smoke 全綠。

## 5. 完成標準

- 四類外觀（稱號/配色/光環/技能外觀）皆可解鎖、選用、套用、持久化，且**零局內戰力**。
- 現有光環無縫遷移到統一系統。
- 任一系統（精通/成就/活躍/賽季）可透過 `unlockCosmetic` 發獎。
- 外觀面板可瀏覽/選用；不破壞既有存檔；桌機/手機/低特效與 smoke 通過。

## 6. 與其他系統的關係

- **職業精通 J1-E**、**圖鑑成就 H1-E**、**秘境 R2**、**賽季 v0.33** 的獎勵全部發到這裡；本計劃是它們的**共用前置**。
