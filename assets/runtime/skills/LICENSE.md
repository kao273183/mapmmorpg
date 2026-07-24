# Skill assets

`assets/runtime/skills/` 底下的技能圖示與技能動畫來源與授權記錄。

## ⚠️ 待補：現有素材來源不明

以下兩批素材在專案裡沒有留下來源與授權文件，`assets/source/` 也找不到原始包，
git 只能追到 `a30d655 refactor: organize runtime and source assets` 那次搬移。

| 素材 | 位置 | 數量 | 來源 | 授權 |
|---|---|---|---|---|
| 技能圖示 | `icons/normal/`、`icons/gray/` | 各 70 個，256px | **不明** | **不明** |
| 技能動畫 | `vfx/` | 13 組，72×72／格 | **不明** | **不明** |

依 [`assets/README.md`](../../README.md) 的規則「缺少明確授權的素材不得進入正式公開版本」，
**在補上出處之前，這份專案不應公開發佈**。

處理方式擇一：

1. 找回原始來源並在本檔登記（若授權允許，同時把原始包放進 `assets/source/`）
2. 換成有明確授權的替代品（候選見 [`doc/ASSETS-vfx-candidates.md`](../../../doc/ASSETS-vfx-candidates.md)）

## 已登記的素材

### Pixel Art Spells

`vfx/` 中的以下檔案取自 Pixel Art Spells：

| runtime 檔名 | 原始檔名 | 每格 | 格數 | 用於 |
|---|---|---|---|---|
| `arcaneBolt.png` | Arcane Bolt.png | 16×16 | 6 | 元素飛彈（依火／冰／雷染色） |
| `darkBolt.png` | Darkness Bolt.png | 16×16 | 6 | 暗影箭 |
| `wardShield.png` | Pixelart Shield.png | 48×48 | 6 | 聖盾壁壘（染金） |
| `splash.png` | Splash.png | 32×32 | 6 | 疫咒（染紫） |

- 來源：<https://opengameart.org/content/pixel-art-spells>
- Author: DevWizard（作者表示署名非必要，但希望被標示）
- License: **CC0 1.0 Universal**（public domain dedication）
- 原始包（含未使用的 19 組與 Aseprite 原始檔）保留於
  [`assets/source/pixelart-spells-devwizard/`](../../source/pixelart-spells-devwizard/)

> 這批素材每格尺寸不是 72×72，靠 `SKILL_VFX_DEFS` 的 `frame` 欄位標明；
> 染色由 `tintedSkillVfx()` 以 `color` 混合模式處理（保留原本明暗），結果有快取。

### Weapon Slash - Effect

`vfx/` 中的以下檔案由 Weapon Slash - Effect 合成：

| runtime 檔名 | 來源動畫 | 每格 | 格數 | 用於 |
|---|---|---|---|---|
| `crescentBold.png` | Classic 動畫 1 | 150×150 | 6 | 揮砍（鋼白）、裂顱斬（血紅） |
| `crescentRing.png` | Classic 動畫 2 | 150×150 | 6 | 旋風斬 |
| `crescentThin.png` | Classic 動畫 3 | 150×150 | 6 | 聖印斬（金） |
| `thrust.png` | Classic 動畫 4 | 150×150 | 6 | 血怒斬（深紅）、制裁光錘（金） |
| `streak.png` | Classic 動畫 5 | 150×150 | 6 | 突進斬（青） |

- 來源：<https://opengameart.org/content/weapon-slash-effect>
- Author: Cethiel
- License: **CC0 1.0 Universal**（public domain dedication，無需署名）
- 原始包（4 種顏色變體、每個 5 動畫 × 6 格逐格 PNG）保留於
  [`assets/source/weapon-slash-cethiel/`](../../source/weapon-slash-cethiel/)

> 只採用 Classic（金）變體；原檔每格 126×150，補成 150×150 正方後橫向合成為 strip。
> 其餘火/藍/紫顏色變體改用引擎內 `tintedSkillVfx()` 染色，不另存檔。

### Ranged weapons — DCSS（弓箭手用）

- `vfx/arrow.png`：DCSS `ammo/arrow_01_silver.png`（32×32），弓箭手箭矢投射物。
- 弓的裝備圖 `equipment/weapons and armor/bow - {short,recurve,long,great,storm}.png`：DCSS bow/ 各弓放大 2×（32→64）對齊既有裝備圖。
- 來源：<https://opengameart.org/node/12210>（Dungeon Crawl 32x32 tiles，**CC0**，與專案現用 sword-dcss/stave-dcss 同源）
- 原始包：[`assets/source/ranged-dcss/`](../../source/ranged-dcss/)
