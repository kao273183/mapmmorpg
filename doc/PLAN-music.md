# PLAN — 背景音樂框架（BGM，AU2）

目前只有音效（sfx），**完全沒有背景音樂**。本計劃補上 BGM 框架：情境/群系配樂、循環與淡入淡出、音量與開關，扎根現有 Web Audio 設定，並沿用手勢解鎖。延續 [DESIGN-audio.md](DESIGN-audio.md)。

> 現況：`audioCtx` + `audioMaster`（主音量）+ `audioSettings{volume,muted}` + `applyAudioVolume` + `unlockAudio`（手勢解鎖）+ `playSfx`/`beep`（[bootstrap.js:157–205](../src/game/bootstrap.js)）。有完整 Web Audio 基礎，缺音樂層。

## 固定設計契約

- **零依賴、體積可控**：優先不增加大量音檔（PWA 體積、離線快取）。見 §2 音源決策。
- **與現有音訊整合**：音樂走獨立 gain 節點掛在 `audioMaster` 下，受總音量/靜音影響，另加獨立「音樂音量」；手勢前不播（沿用 `unlockAudio`）。
- **情境切換平滑**：換群系/狀態時淡出舊曲、淡入新曲（crossfade），不突兀。
- **可完全關閉**：設定可單獨關音樂；省電/低效能裝置友善（可停振盪器）。
- 跨平台（桌機/手機）、與 iOS 自動播放政策相容（手勢後才啟動）。

## 2. 音源決策（需你定，見 §7）

| 方案 | 優點 | 缺點 |
|---|---|---|
| **A. 生成式合成（推薦）** | 零音檔、體積 0、與現有 `beep` 合成一致、可依群系參數化 | 需寫簡單樂句/和聲引擎，音樂性有限（chiptune 風） |
| B. CC0 循環音檔 | 音樂性好、製作快 | 增加下載/快取體積、需找 CC0 素材與授權管理 |
| C. 混合 | 生成式打底 + 少量 CC0 主題 | 兩套都要維護 |

- 建議 **A 生成式**：以 Web Audio 振盪器＋節拍排程，每群系一組音階/音色/節奏參數，產生 loop；日後要換 CC0 音檔只需替換播放層。

## 3. 曲目情境

| 情境 | 觸發 | 風格 |
|---|---|---|
| 選單／城鎮 | menu/town 狀態 | 平靜、環境感 |
| 群系戰鬥 ×5 | 進入各群系樓層 | 各群系專屬(草原明亮/洞窟低沉/熔岩緊張/凍原冷冽/深淵詭譎) |
| Boss | Boss 樓層 | 高張力、鼓點重 |
| 死亡／撤退 | dead 狀態 | 短收尾 stinger |

## 4. 音樂管理器（框架）

- `musicManager`：`play(trackId)`、`stop()`、`crossfadeTo(trackId)`、`setMusicVolume(v)`、`suspend/resume`。
- 獨立 `musicGain` 節點 → `audioMaster`；音量 = 總音量 × 音樂音量 ×（靜音?0）。
- 生成式：`buildTrack(params)` 依群系參數排程 loop（振盪器 + 包絡 + 節拍），下一 loop 邊界對齊。
- 狀態機掛勾：`gameState`/`floor`/群系 變化時 `crossfadeTo` 對應曲。

## 5. 掛接點

| 項目 | 位置 | 作法 |
|---|---|---|
| 音訊基礎 | `audioCtx`/`audioMaster`/`unlockAudio`（bootstrap.js:157–205） | musicGain 掛 audioMaster；unlock 後啟動 |
| 音量/開關 | `audioSettings`（bootstrap.js:160） | 加 `musicVolume`、`musicMuted`；`applyAudioVolume` 一併套 musicGain |
| 群系切換 | `genFloor`/`floor`/`biomeOf`（[run.js](../src/game/run.js)/systems.js） | 進群系 → crossfade 到該群系曲 |
| 狀態切換 | `gameState`（menu/town/play/dead） | 狀態變 → 對應情境曲 |
| Boss | Boss 樓層生成（bosses.js/core） | 切 Boss 曲，擊敗後回群系曲 |
| 設定 UI | 設定頁（interface.js `renderSettings`） | 音樂音量 −／＋、音樂開關 |

## 6. 分批交付

- **AU2-A 音樂管理器框架**：`musicGain` + play/stop/crossfade + 手勢解鎖 + 1 首生成式曲（城鎮）。無情境切換。
- **AU2-B 群系主題曲 ×5**：各群系參數化生成 + 進群系自動 crossfade。
- **AU2-C 情境曲**：選單/城鎮/Boss/死亡 stinger 與狀態切換。
- **AU2-D 設定與省電**：設定頁音樂音量/開關；背景/隱藏時暫停；低效能可停。
- **AU2-E 回歸**：桌機/手機、iOS 手勢政策、與 sfx 不打架、存檔相容、smoke。

## 7. 完成標準與待定決策

**完成標準**：可播情境/群系 BGM、平滑 crossfade、獨立音量與開關、手勢後啟動、可完全關閉、不影響效能與 sfx。

**待定決策**：
1. **音源方案**：A 生成式（推薦，零體積）／B CC0 音檔／C 混合。
2. 音樂預設**開或關**（建議開、音量偏低）。
3. 是否要 Boss 專屬曲（建議要，張力提升明顯）。
