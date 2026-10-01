// 打包 YouTube Playables 上傳用檔案：node tools/build-playables.js
// 輸出 dist/playables/：
//   - index.html 最前面載入 Playables SDK，移除 PWA（Service Worker / 安裝提示 / manifest）
//   - 遊戲腳本改由 src/platform.js 在雲端存檔讀完後依序載入（data-boot）
//   - assets/runtime 的檔名改成 Playables 允許的字元（英數與 _ - .），對照表寫進 asset-map.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist', 'playables');
const SDK_TAG = '<script src="https://www.youtube.com/game_api/v1"></script>';
const PWA_SCRIPTS = ['src/pwa.js', 'src/install.js'];
const KiB = 1024, MiB = 1024 * KiB;

const safeName = rel => rel.split('/').map(seg => seg.replace(/[^A-Za-z0-9_.-]+/g, '_')).join('/');
function walk(dir, base = dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, files);
    else if (e.name !== '.DS_Store') files.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return files;
}
function copy(fromRel, toRel) {
  const dest = path.join(out, toRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, fromRel), dest);
}

function main() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 1. 執行期素材：全部複製並改成安全檔名
  const assetMap = {}, taken = new Map();
  for (const rel of walk(path.join(root, 'assets', 'runtime'))) {
    if (/\.(md|txt)$/i.test(rel)) continue; // 授權說明不進包
    const src = 'assets/runtime/' + rel, dest = safeName(src);
    if (taken.has(dest)) throw new Error('檔名衝突：' + src + ' / ' + taken.get(dest));
    taken.set(dest, src);
    copy(src, dest);
    if (dest !== src) assetMap[src] = dest;
  }
  fs.writeFileSync(path.join(out, 'asset-map.js'), '"use strict";\nwindow.ASSET_MAP = ' + JSON.stringify(assetMap, null, 1) + ';\n');

  // 2. index.html：SDK 最先載入；遊戲腳本交給 platform.js 依序載入
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scriptTag = /<script src="([^"]+)"><\/script>\r?\n/g;
  const scripts = Array.from(html.matchAll(scriptTag), m => m[1]).filter(src => !PWA_SCRIPTS.includes(src.split('?')[0]));
  if (!scripts.length) throw new Error('index.html 找不到遊戲腳本');
  html = html
    .replace(scriptTag, '')
    .replace(/<meta name="(screen-orientation|mobile-web-app-capable|apple-mobile-web-app-capable)"[^>]*>\r?\n/g, '')
    .replace(/<link rel="(manifest|apple-touch-icon)"[^>]*>\r?\n/g, '')
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + SDK_TAG)
    .replace('</body>', '<script src="asset-map.js"></script>\n<script src="src/platform.js" data-boot="' + scripts.join(',') + '"></script>\n</body>');
  if (!html.includes(SDK_TAG) || !html.includes('data-boot=')) throw new Error('index.html 改寫失敗');
  fs.writeFileSync(path.join(out, 'index.html'), html);
  for (const src of scripts.map(s => s.split('?')[0]).concat('src/platform.js', 'style.css')) copy(src, src);

  // 3. 對照 Playables 穩定性規範檢查
  const files = walk(out).map(rel => ({ rel, size: fs.statSync(path.join(out, rel)).size }));
  const total = files.reduce((s, f) => s + f.size, 0);
  const badNames = files.filter(f => /[^A-Za-z0-9_.\/-]/.test(f.rel));
  const big = files.filter(f => f.size > 512 * KiB);
  console.log(`dist/playables：${files.length} 個檔案，共 ${(total / MiB).toFixed(2)} MiB（必須 < 30 MiB，建議 < 15 MiB）`);
  if (big.length) console.log('建議單檔 < 512 KiB：\n  ' + big.map(f => `${f.rel} ${(f.size / KiB).toFixed(0)} KiB`).join('\n  '));
  if (badNames.length) throw new Error('不合法的檔名：\n  ' + badNames.map(f => f.rel).join('\n  '));
  if (files.length > 8000 || total >= 30 * MiB || files.some(f => f.size >= 30 * MiB)) throw new Error('超過 Playables 打包上限');
}

main();
