/**
 * landing 頁的行為層。
 *
 * **正文是靜態 HTML，不由這支生成。** landing 是站台入口，JS 掛掉就整頁空白說不過去；
 * 這支只做三件增強：左側 rail、右側節點鏈、主題三態。
 * 每一段要點名哪些節點寫在該段的 `data-nodes` 上，累計節點數寫在 `data-upto`，
 * 所以 HTML 自己就是唯一的資料來源，不必再維護一份對照表。
 *
 * 依賴：window.FLOW_DATA（docs/js/data.js，classic script，file:// 相容）
 */
(function () {
  'use strict';

  var beats = [].slice.call(document.querySelectorAll('.beat'));
  var railEl = document.getElementById('lrail');
  var chain = document.getElementById('chain');
  var deck = document.getElementById('ldeck');
  var vp = deck ? deck.querySelector('.vp') : null;
  var titleEl = document.getElementById('deck-title');
  var nEl = document.getElementById('deck-n');
  var barEl = document.getElementById('deck-bar');
  var fillEl = document.getElementById('chain-fill');

  /* ══ rail ════════════════════════════════════════════════════════════════ */
  var GLYPH = { b1: '擋', b2: '判', b6: '樣', b3: '劃', b4: '建', b5: '審', b7: '跡' };

  function buildRail() {
    var h = '<a class="mk" href="#top" aria-label="回到頁首">bs</a>';
    beats.forEach(function (b) {
      var h2 = b.querySelector('h2');
      var label = h2 ? h2.textContent.replace(/\s+/g, '') : b.id;
      h += '<a href="#' + b.id + '" data-label="' + label + '" aria-label="' + label + '">' +
           (GLYPH[b.id] || '·') + '</a>';
    });
    // 流程圖入口在上、主題鈕壓底：跟 flow.html 的 rail 底部群組（置 → 自）一致，兩頁主題鈕同一個位置
    h += '<div class="sp"></div>' +
         '<a href="./flow.html" data-label="開啟流程圖" aria-label="開啟流程圖">開</a>' +
         '<a href="#" id="btn-theme" data-label="主題：自動" role="button">自</a>';
    railEl.innerHTML = h;
  }

  /* ══ 主題三態 ═════════════════════════════════════════════════════════════
     跟 flow.html 共用同一組契約，兩頁之間切換才不會跳：
       1. localStorage key = 'dev-workflow-theme'
       2. <html> 上的 data-theme（解析後的 light/dark）與 data-theme-mode（auto/light/dark）
       3. 切換時掛 .theme-xfade 做顏色過場，動畫完拿掉
     這三項與 index.html 的防 FOUC inline script 是同一份契約，改名等於把兩頁拆開。 */
  var GLYPH_T = { auto: '自', light: '明', dark: '暗' };
  var NAME_T = { auto: '自動', light: '明亮', dark: '暗色' };
  var fadeTimer = null;

  /** 掛過場 class，動畫時間到再拿掉——留著會蓋掉每個元件自己的轉場節奏。 */
  function beginThemeFade() {
    var root = document.documentElement;
    root.classList.add('theme-xfade');
    if (fadeTimer) clearTimeout(fadeTimer);
    // 440 = --t-large 380ms 再留 60ms 緩衝，免得最後一格還沒畫完就被拔掉
    fadeTimer = setTimeout(function () { root.classList.remove('theme-xfade'); fadeTimer = null; }, 440);
  }

  /**
   * @param {"auto"|"light"|"dark"} mode
   * @param {boolean} animate 開站時不要，會閃
   */
  function applyTheme(mode, animate) {
    var root = document.documentElement;
    var resolved = mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    if (animate) beginThemeFade();
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    var b = document.getElementById('btn-theme');
    if (!b) return;
    b.textContent = GLYPH_T[mode];
    b.setAttribute('data-label', '主題：' + NAME_T[mode]);
    b.setAttribute('aria-label', '切換主題（目前：' + NAME_T[mode] + '）');
    b.classList.toggle('on', mode !== 'auto');
  }

  function setupTheme() {
    var stored = null;
    try { stored = localStorage.getItem('dev-workflow-theme'); } catch (e) {}
    applyTheme(stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto', false);

    document.getElementById('btn-theme').onclick = function (e) {
      e.preventDefault();
      var order = ['auto', 'light', 'dark'];
      var cur = document.documentElement.getAttribute('data-theme-mode') || 'auto';
      var next = order[(order.indexOf(cur) + 1) % order.length];
      applyTheme(next, true);
      try { localStorage.setItem('dev-workflow-theme', next); } catch (e2) {}
    };

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if ((document.documentElement.getAttribute('data-theme-mode') || 'auto') === 'auto') applyTheme('auto', true);
    });
    // 另一個分頁改了主題 → 這邊跟著換。
    // 只讀開站那一次的話，只有「先切再導航」會同步，「兩邊都開著」不會。
    window.addEventListener('storage', function (e) {
      if (e.key !== 'dev-workflow-theme') return;
      var v = e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'auto' ? e.newValue : 'auto';
      if (v === (document.documentElement.getAttribute('data-theme-mode') || 'auto')) return;
      applyTheme(v, true);
    });
  }

  /* ══ 節點鏈 ══════════════════════════════════════════════════════════════
     只建一次。捲動只 toggle class 與平移整條鏈——每段重建 innerHTML 的話，
     每一段都是新的一疊，接不起來。
     之所以不畫縮圖：整張圖 1925 x 11196，縮到看得完只剩 6%，節點只有幾 px。 */
  var TYPE_LABEL = {};
  (window.FLOW_DATA ? window.FLOW_DATA.legend : []).forEach(function (l) { TYPE_LABEL[l.type] = l.label; });

  /** 規模數字一律從 FLOW_DATA 算，不寫死——與 app.js 的 syncRailLabels 同一個理由：
      加一個節點就要記得回頭改三處字串的話，遲早會漏一處。 */
  var TOTAL = {
    nodes:  window.FLOW_DATA ? Object.keys(window.FLOW_DATA.nodes).length : 0,
    edges:  window.FLOW_DATA ? window.FLOW_DATA.edges.length  : 0,
    phases: window.FLOW_DATA ? window.FLOW_DATA.phases.length : 0
  };

  /** 首屏：一句話進來之後最先經過的三個節點，免得一進站右半邊是空的。 */
  var OPENING = ['Start', 'ClaudeMd', 'DevWfSkill'];
  var steps = [], coda = null, RANGE = { top: [0, OPENING.length] };

  function cardHtml(id) {
    var n = window.FLOW_DATA.nodes[id];
    var t = (n && n.type) || 'default';
    return '<span class="dot"></span>' +
      '<div class="card" style="--bd:var(--c-' + t + '-bd);--bg:var(--c-' + t + ')">' +
        '<div class="top"><span class="chip">' + (TYPE_LABEL[t] || t) + '</span>' +
          '<span class="id">' + id + '</span></div>' +
        '<div class="t">' + String(n ? n.label : id).replace(/</g, '&lt;') + '</div>' +
      '</div>';
  }

  function buildChain() {
    var seq = OPENING.slice();
    var i = OPENING.length;
    beats.forEach(function (b) {
      var ids = (b.getAttribute('data-nodes') || '').split(',').filter(Boolean);
      RANGE[b.id] = [i, i + ids.length];
      i += ids.length;
      seq = seq.concat(ids);
    });

    seq.forEach(function (id) {
      if (!window.FLOW_DATA.nodes[id]) return;
      var el = document.createElement('div');
      el.className = 'step';
      el.innerHTML = cardHtml(id);
      chain.appendChild(el);
    });

    coda = document.createElement('div');
    coda.className = 'coda';
    coda.innerHTML =
      '<span class="knot">§</span>' +
      '<div class="hr"></div>' +
      '<div class="mark">❦</div>' +
      '<div class="say">一句話從這裡進去，<br>走完了整條流程<em>。</em></div>' +
      '<div class="meta">' + TOTAL.nodes + ' 節點 · ' + TOTAL.edges + ' 條邊 · ' + TOTAL.phases + ' 區段</div>' +
      '<a href="./flow.html">把整張圖打開<span class="ar">→</span></a>';
    chain.appendChild(coda);

    steps = [].slice.call(chain.querySelectorAll('.step'));
  }

  var raf = null;
  function countTo(target) {
    if (raf) cancelAnimationFrame(raf);
    var from = parseInt(nEl.textContent, 10) || 0, t0 = performance.now(), dur = 760;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      nEl.textContent = Math.round(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    })(t0);
  }

  var current = 'top';

  /**
   * 走到某一段：展開那一段、把之前的收合、整條鏈平移到視窗中線。
   * @param {string} key beat id / 'top' 首屏 / 'end' 文末
   */
  function goTo(key) {
    current = key;

    if (key === 'end') {
      steps.forEach(function (el) { el.classList.remove('now'); el.classList.add('past'); });
      coda.classList.add('on');
      requestAnimationFrame(function () {
        var mid = coda.offsetTop + coda.offsetHeight / 2;
        chain.style.transform = 'translate3d(0,' + Math.round(vp.clientHeight / 2 - mid) + 'px,0)';
        fillEl.style.height = (coda.offsetTop + 30) + 'px';
      });
      titleEl.innerHTML = '主流程完 · <b>9</b> 個階段';
      countTo(TOTAL.nodes);
      barEl.style.width = '100%';
      return;
    }

    var r = RANGE[key] || RANGE.top;
    steps.forEach(function (el, i) {
      el.classList.toggle('now', i >= r[0] && i < r[1]);
      el.classList.toggle('past', i < r[0]);
    });
    coda.classList.remove('on');

    // 平移量要在 class 套用之後才量得準——收合／展開會改變高度
    requestAnimationFrame(function () {
      var first = steps[r[0]], last = steps[r[1] - 1];
      if (!first || !last) return;
      var mid = (first.offsetTop + last.offsetTop + last.offsetHeight) / 2;
      chain.style.transform = 'translate3d(0,' + Math.round(vp.clientHeight / 2 - mid) + 'px,0)';
      fillEl.style.height = Math.max(0, last.offsetTop + 14) + 'px';
    });

    // display 從 none 變 flex 的同一格設 opacity 不會有過渡，要隔一格
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        steps.forEach(function (el) {
          var top = el.querySelector('.top');
          if (top) top.classList.toggle('lit', el.classList.contains('now'));
        });
      });
    });

    var b = key === 'top' ? null : document.getElementById(key);
    if (b) {
      var tag = b.querySelector('.tag');
      var cnt = (b.getAttribute('data-nodes') || '').split(',').filter(Boolean).length;
      titleEl.innerHTML = (tag ? tag.textContent.trim() : '') + ' · <b>' + cnt + '</b> 個節點';
      var upto = parseInt(b.getAttribute('data-upto'), 10) || 0;
      countTo(upto);
      barEl.style.width = (upto / TOTAL.nodes * 100) + '%';
    } else {
      titleEl.textContent = '一句話進來之後';
      countTo(OPENING.length);
      barEl.style.width = (OPENING.length / TOTAL.nodes * 100) + '%';
    }
  }

  /* ══ 捲動 ════════════════════════════════════════════════════════════════ */
  function observe() {
    var links = [].slice.call(railEl.querySelectorAll('a[href^="#b"]'));
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        if (!e.target.classList.contains('beat')) return;
        links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
        goTo(e.target.id);
      });
    }, { rootMargin: '-25% 0px -40% 0px' });
    [].slice.call(document.querySelectorAll('.beat, .data, .hero')).forEach(function (s) { io.observe(s); });

    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('on'); });
        goTo('top');
      });
    }, { rootMargin: '-20% 0px -70% 0px' }).observe(document.querySelector('.hero'));

    // 文末的資料段不是 beat：讀到那裡表示整條流程走完了，計數要收滿，
    // 不然會停在最後一段的 data-upto 上，看起來像沒跑完。
    var install = document.getElementById('install');
    if (install) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) goTo('end'); });
      }, { rootMargin: '-30% 0px -40% 0px' }).observe(install);
    }
  }

  /* ══ 換頁轉場的兜底 ═══════════════════════════════════════════════════════
     有跨文件 View Transitions 就什麼都不做——瀏覽器自己會處理，再攔一次會播兩遍。 */
  function setupPageExit() {
    if (CSS.supports && CSS.supports('view-transition-name', 'none')) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.target === '_blank') return;
      var href = a.getAttribute('href');
      if (!href || !/^\.\/[\w-]+\.html$/.test(href)) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      var done = false;
      var once = function () { if (!done) { done = true; window.location.href = href; } };
      document.body.addEventListener('animationend', once, { once: true });
      // animationend 收不到時的保底導航，免得動畫被中斷就卡在原地
      setTimeout(once, 320);
    });
  }

  buildRail();
  setupTheme();
  setupPageExit();
  if (window.FLOW_DATA && chain) {
    buildChain();
    goTo('top');
    observe();
    window.addEventListener('resize', function () { goTo(current); });
  }
})();
