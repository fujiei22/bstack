/**
 * landing 頁的主題切換。
 *
 * 刻意跟 app.js 分開：app.js 整份綁著 d3 / dagre 與流程圖的 DOM，landing 只需要主題這一塊。
 * 三個共同契約必須跟 flow.html 完全一致，否則兩頁之間切換會看到主題跳掉：
 *   1. localStorage key = 'dev-workflow-theme'
 *   2. <html> 上的 data-theme（解析後的 light/dark）與 data-theme-mode（auto/light/dark）
 *   3. 切換時掛 .theme-xfade 做顏色過場，動畫結束再拿掉
 */
(function () {
  'use strict';

  var THEME_GLYPH = { auto: '自', light: '明', dark: '暗' };
  var THEME_NAME = { auto: '自動', light: '明亮', dark: '暗色' };
  var btn = document.getElementById('btn-theme');
  var fadeTimer = null;

  /** 掛上過場 class，動畫時間到再拿掉——留著會蓋掉頁面上其他元件自己的轉場節奏。 */
  function beginThemeFade() {
    var root = document.documentElement;
    root.classList.add('theme-xfade');
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function () {
      root.classList.remove('theme-xfade');
      fadeTimer = null;
    }, 440); // --t-large 是 380ms，多留 60ms 免得最後一格還沒畫完就被拔掉
  }

  /**
   * @param {"auto"|"light"|"dark"} mode
   */
  function applyThemeMode(mode) {
    var root = document.documentElement;
    var resolved = mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    if (!btn) return;
    btn.querySelector('.g').textContent = THEME_GLYPH[mode];
    btn.querySelector('.t').textContent = THEME_NAME[mode];
    btn.setAttribute('aria-label', '切換主題（目前：' + THEME_NAME[mode] + '）');
  }

  var stored = null;
  try { stored = localStorage.getItem('dev-workflow-theme'); } catch (e) {}
  applyThemeMode(stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto');

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if ((document.documentElement.getAttribute('data-theme-mode') || 'auto') !== 'auto') return;
    beginThemeFade();
    applyThemeMode('auto');
  });

  if (btn) btn.onclick = function () {
    var order = ['auto', 'light', 'dark'];
    var cur = document.documentElement.getAttribute('data-theme-mode') || 'auto';
    var next = order[(order.indexOf(cur) + 1) % order.length];
    beginThemeFade();
    applyThemeMode(next);
    try { localStorage.setItem('dev-workflow-theme', next); } catch (e) {}
  };

  // 進場延遲：直接寫在 HTML 裡會變成一長串 style 屬性，改由這裡依順序補上
  var i = 0;
  document.querySelectorAll('.rise').forEach(function (el) {
    el.style.setProperty('--i', String(i++));
  });
})();
