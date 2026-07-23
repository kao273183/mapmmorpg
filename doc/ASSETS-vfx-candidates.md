# 技能特效素材盤點與候選（2026-07-23）

進階職的非基本技能目前共用既有 13 組 VFX 圖集（只換顏色與縮放），能組的花樣接近用盡。這份文件記錄現況、候選素材與接入方式。

## ⚠️ 先處理：現有素材缺授權記錄

`assets/README.md` 自己訂的規則是「新增第三方素材時，必須保留來源及授權文件；**缺少明確授權的素材不得進入正式公開版本**」。但目前：

| 素材 | 位置 | 授權記錄 |
|---|---|---|
| 技能 VFX 13 組 | `assets/runtime/skills/vfx/*.png` | **無** |
| 技能圖示 70 個 | `assets/runtime/skills/icons/{normal,gray}/` | **無** |
| 音效 | `assets/runtime/audio/` | ✅ `LICENSE.md` |
| Kenney 圖塊 | `assets/source/kenney-rpg-urban-pack/` | ✅ `License.txt` |
| 裝備素材 | `assets/source/item-library/` | ✅ 每項一份 `.txt` |

VFX 與技能圖示是唯二沒有來源記錄的。`assets/source/` 裡也找不到它們的原始包，git 只追到 `a30d655 refactor: organize runtime and source assets` 那次搬移。**在補上來源與授權之前，這份專案不適合公開發佈**。補找新素材時應一併把這兩批的出處補回來，或直接換成有明確授權的替代品。

## 現有規格（新素材要對齊這個）

- **水平長條圖集**，每格 **72×72**，4／6／8 格
- 對照表：`SKILL_VFX_DEFS`（[bootstrap.js](../src/game/bootstrap.js)）
- 繪製：`drawSkillVfxFrame(key, x, y, frameIndex, scale, flip, rotation, alpha)`，支援縮放／旋轉／翻轉／透明度，但**不支援染色**
- `ctx.imageSmoothingEnabled = false`，所以低解析度來源放大不會糊，但**非整數倍放大會有不均勻的像素**（16×16 → 72 是 4.5 倍，建議改成 4 倍畫布 64×64 再置中補到 72，或直接把 `SKILL_VFX_DEFS` 加上每組自己的 frame size）

## 候選素材

### 1. Pixel Art Spells — DevWizard｜**CC0**｜最推薦
<https://opengameart.org/content/pixel-art-spells>

- **授權：CC0**（頁面上掛 CC0 標章；作者另註「希望但不強制」署名為 DevWizard）
- 23 組法術動畫，大多是投射物：秘法彈、暗影彈／球、火球、火焰炸彈、冰矛、光彈、魔法球、魔法射線、魔法火花、魔法護盾、植物飛彈、投石、水花、水爆、水彈、水球、風彈、純淨彈、黑白射線、黑白火花⋯
- 16×16、附 PNG 與 Aseprite 原始檔
- **關鍵優勢**：作者明講「黑白版本是設計成讓你在引擎裡上色的，這樣同一組能做出多種法術」。這正好補上目前 `drawSkillVfxFrame` 不能染色的限制 —— 只要為黑白圖集加一條染色繪製路徑，一組素材就能同時給元素師的火／冰／雷與咒術師的暗影用。
- **缺點**：16×16 偏小，放大到 72 需要處理倍率（見上）

### 2. Free Pixel Effects Pack ＋ 2D Spell Effects｜收錄於 CC0 合輯｜需再確認
- <https://opengameart.org/content/free-pixel-effects-pack>
- <https://opengameart.org/content/2d-spell-effects>
- 兩者都被收進 Ragnar Random 的 [cc0 special effects](https://opengameart.org/content/cc0-special-effects) 合輯（該合輯自述「cc0 special effects for derivatives」）
- ⚠️ **合輯不等於授權**：OpenGameArt 的 collection 是使用者自建的書籤，不具授權效力。使用前必須到各自頁面確認 License 標章。
- 同合輯還有 More Explosions、Fire FX、Smoke Aura、Electrical disintegration、Animated particle effects #1 等，若確認為 CC0，是目前最大的一批可用來源

### 3. Extended LPC Magic pack — Daniel Eddeland｜**CC-BY（需署名）**
<https://opengameart.org/content/extended-lpc-magic-pack>

- 龍捲風、蛇咬、火獅、水／冰觸手、冰盾與龜殼、雷爪
- 多數 **128×128、16 格**，冰刺是 64×64 較少格
- 品質高、體感華麗，適合聖騎士的護盾與元素師的大招
- **代價**：必須署名 Daniel Eddeland 並附 OpenGameArt 連結。專案目前沒有遊戲內的致謝頁，用了就要加一個

### 4. Magic sprite effects (Ardentryst)｜**CC-BY 3.0（需署名）**
<https://opengameart.org/content/magic-sprite-effects-ardentryst>

- 冰箭、毒箭、火箭、法力衝擊、電球、毒氣雲、火球、史萊姆球等
- 側捲軸動作 RPG 原生素材，視角與本專案一致
- 毒氣雲正好對得上咒術師的疫咒

### 5. itch.io 上的免費包（未驗證）
- [Free Magic Animated Effects Pixel Art](https://free-game-assets.itch.io/free-pixel-magic-sprite-effects-pack) — 治療、閃現、纏繞、傷害光環、雷射、火花、魅惑、隕星、石化、隱形，附 32×32 圖示
- 抓取時被擋（HTTP 429），**授權未經我確認**。itch 的「free」多半不是 CC0，常見是「可用於商業專案但不可轉售」，用前務必看清楚

## 建議做法

1. **先補既有素材的授權記錄**，這比加新素材優先 —— 現況卡住公開發佈。
2. **主力取 Pixel Art Spells（CC0）**，並為 `drawSkillVfxFrame` 加一條**染色繪製路徑**（離屏 canvas + `globalCompositeOperation`）。黑白素材染色後，一組能長出多種職業專屬特效，這比再堆更多素材划算得多。
3. 需要更華麗的大招表現時再考慮 LPC（CC-BY），但要先決定署名放哪裡（設定頁加一個「素材致謝」分頁最省事）。
4. 新素材一律走 `assets/source/<pack-name>/` 存原始包與授權檔，只把實際用到的整理進 `assets/runtime/`，依 `assets/README.md` 的規則。

## 進度

- ✅ **已導入 Pixel Art Spells（CC0）** — v0.29.44。原始包在 `assets/source/pixelart-spells-devwizard/`，
  採用的 4 組整理至 `assets/runtime/skills/vfx/`，登記於 [`assets/runtime/skills/LICENSE.md`](../assets/runtime/skills/LICENSE.md)。
  - `SKILL_VFX_DEFS` 新增 `frame` 欄位（來源每格尺寸，預設 72），`drawSkillVfxFrame` 依此切格、輸出仍統一 72。
  - 新增 `tintedSkillVfx(key, col)`：離屏畫布 + `color` 混合模式染色（保留明暗），結果依 `key|color` 快取。
    `playSkillAnim` 支援 `tint` 選項。元素飛彈的火／冰／雷是同一組圖染三色。
  - 接上：元素飛彈（arcaneBolt，三色）、暗影箭（darkBolt）、聖盾壁壘（wardShield，金）、疫咒（splash，紫）。
- ⬜ 尚未接的技能：血怒斬、戰吼、制裁光錘、汲魂、元素爆發、連鎖風暴仍用既有通用圖集。
  原始包裡還有 19 組沒用到（Magic Ray 可做汲魂的光束、Splash 染金可做制裁光錘、Firebomb 可做元素爆發）。
- ⬜ 既有 13 組 VFX 與 70 個技能圖示的來源仍待補（見 [`assets/runtime/skills/LICENSE.md`](../assets/runtime/skills/LICENSE.md)）。

## 未決

- 染色路徑要做成 `SKILL_VFX_DEFS` 的欄位（每組固定色）還是 `playSkillAnim` 的參數（每次施放可變）？後者才能讓元素飛彈用同一組素材輪替三色。
- `SKILL_VFX_DEFS` 是否要加 `frameSize`，好讓非 72×72 的來源不必先重製圖集。
