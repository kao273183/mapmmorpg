const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mobileSource = fs.readFileSync(path.join(root, 'mobile.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

function makeMobileContext({ coarse, portrait, width }) {
  const listeners = {};
  const prompt = { attrs:{}, setAttribute(key, value) { this.attrs[key] = value; } };
  const button = { disabled:false, addEventListener(type, fn) { listeners['button:' + type] = fn; } };
  const status = { textContent:'' };
  const classes = new Set();
  const media = query => ({
    matches:query.includes('pointer') ? coarse : portrait,
    addEventListener(type, fn) { listeners['media:' + query + ':' + type] = fn; }
  });
  const documentElement = {
    classList:{ toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } },
    requestFullscreen:async () => {}
  };
  const document = {
    fullscreenElement:null,
    documentElement,
    getElementById(id) { return id === 'rotatePrompt' ? prompt : id === 'landscapeButton' ? button : id === 'landscapeStatus' ? status : null; },
    addEventListener(type, fn) { listeners['document:' + type] = fn; }
  };
  const window = {
    innerWidth:width,
    matchMedia:media,
    addEventListener(type, fn) { listeners['window:' + type] = fn; },
    visualViewport:{ addEventListener(type, fn) { listeners['viewport:' + type] = fn; } }
  };
  const screen = { orientation:{ lock:async () => {} } };
  return { context:{ document, window, screen, console }, prompt, button, status, classes, listeners };
}

(async () => {
  let test = makeMobileContext({ coarse:true, portrait:true, width:844 });
  vm.createContext(test.context);
  vm.runInContext(mobileSource, test.context, { filename:'mobile-portrait.js' });
  assert.strictEqual(test.prompt.attrs['aria-hidden'], 'false', '手機直向時必須顯示橫放提示');
  assert.ok(test.classes.has('mobile-portrait'));
  assert.ok(test.listeners['button:click'], '橫向按鈕必須可操作');
  await test.listeners['button:click']();
  assert.strictEqual(test.button.disabled, false);
  assert.ok(test.status.textContent.includes('請稍候') || test.status.textContent.includes('請手動將手機橫放'), '仍為直向時應提供旋轉狀態');

  test = makeMobileContext({ coarse:true, portrait:false, width:844 });
  vm.createContext(test.context);
  vm.runInContext(mobileSource, test.context, { filename:'mobile-landscape.js' });
  assert.strictEqual(test.prompt.attrs['aria-hidden'], 'true', '手機橫向時不得遮住遊戲');
  assert.ok(!test.classes.has('mobile-portrait'));

  assert.ok(html.includes('viewport-fit=cover'), '頁面必須支援瀏海安全區');
  for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(css.includes('safe-area-inset-' + side), '缺少 safe area：' + side);
  assert.ok(css.includes('@media (pointer:coarse)'));
  assert.ok(css.includes('aspect-ratio:16/9'));
  assert.ok(css.includes('touch-action:none'));
  assert.ok(css.includes('canvas{visibility:hidden;pointer-events:none;}'), '手機直向時畫布應停止互動');

  assert.ok(/touchstart[\s\S]*eventPanel \|\| dungeonPanelOpen\(\)[\s\S]*handleTap/.test(game), '觸控事件面板必須共用按鈕命中流程');
  assert.ok(/function touchPos[\s\S]*W \/ r\.width[\s\S]*H \/ r\.height/.test(game), '觸控座標必須依畫布縮放換算');
  assert.ok(/touchcancel[\s\S]*touchEnd/.test(game), '觸控取消必須釋放按鍵');
  assert.ok(/eventChoiceBtns[\s\S]*chooseFloorEvent\(b\.choice\)/.test(game), '三選一事件必須支援觸控按鈕');

  console.log('mobile landscape and touch smoke test passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
