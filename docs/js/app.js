/**
 * dev-workflow flowchart explorer — 主程式（rail-console 骨架）
 *
 * 無框架、無 build step 的 classic script；file:// 直接開得起來
 * （文件內容走 window.REFERENCE_DOCS 內嵌，不靠 fetch）。
 *
 * 依賴（由 index.html 以 classic script 先行載入）：
 *   window.d3 / window.dagre / window.marked   — docs/js/vendor/ 本地檔
 *   buildLayout() / intersectRect()            — docs/js/layout.js
 *   window.FLOW_DATA + getUpstream/getDownstream — docs/js/data.js
 *   window.REFERENCE_DOCS                      — docs/js/references-data.js
 *
 * 版面：左緣 56px rail（分區入口點了才彈出浮動面板）＋ 中央流程圖 ＋ 右緣直幅索引條，
 * 選節點時 detail 由右側滑入，文件抽屜為覆蓋層。
 *
 * **本檔不寫任何顏色**：八型別配色一律由 docs/css/styles.css 的 --c-* token 經
 * [data-type="..."] 屬性選擇器驅動（F22 契約，驗證器 C13b 守之）。
 *
 * 設計定案與動畫節奏見 docs/archive/2026/docs-site-redesign/spec.md。
 */
(function () {
'use strict';

var d3 = window.d3;
var FLOW = window.FLOW_DATA;

var NODE_W = 252, NODE_H = 98;
/* minimap 跟主圖同比例（直幅），高度隨視口給，寬度由比例回推 */
var MM_H = Math.max(320, Math.min(560, window.innerHeight - 190));
var MM_W = 0; // 待 layout 算完才知道比例

/** XSS 防護：HTML 特殊字元轉義。 */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** document.getElementById 的簡寫；本檔的 DOM 取用一律走它。 */
function $(id) { return document.getElementById(id); }

/* ── 型別 / phase 對照 ─────────────────────────────────────────────────── */
var TYPE_LABEL = {};
FLOW.legend.forEach(function (l) { TYPE_LABEL[l.type] = l.label; });

var PHASE_LABEL = {};
FLOW.phases.forEach(function (p) { PHASE_LABEL[p.id] = p.label; });

/**
 * node ID → 文件識別。
 *
 * `p` 不含 `references/` 前綴也不含副檔名，實際的 REFERENCE_DOCS key 由 docKey() 組出來
 * （skill 補 /SKILL.md、agent 補 .md）。33 個 key 對應 31 個相異文件——
 * RPT2 與 RPT3 共用 review-plan 的路徑。
 *
 * **刻意不收 design-language / design-direction**：references-data.js 沒有這兩份的內嵌全文，
 * 收了它們反而會讓對應節點點出「載入失敗」。這是已知缺口，維持未修。
 */
var NODE_DOCS = {
  DevWfSkill:{p:'skills/dev-workflow',        n:'dev-workflow',        k:'skill'},
  BS:        {p:'skills/brainstorm',          n:'brainstorm',          k:'skill'},
  LoadDB:    {p:'skills/db-access',           n:'db-access',           k:'skill'},
  LoadWP:    {p:'skills/write-plan',          n:'write-plan',          k:'skill'},
  LoadRP:    {p:'skills/review-plan',         n:'review-plan',         k:'skill'},
  LoadExec:  {p:'skills/execute-plan',        n:'execute-plan',        k:'skill'},
  LoadTDD:   {p:'skills/tdd-cycle',           n:'tdd-cycle',           k:'skill'},
  LoadDispatch:{p:'skills/dispatch-parallel', n:'dispatch-parallel',   k:'skill'},
  LoadVerify:{p:'skills/verify-done',         n:'verify-done',         k:'skill'},
  LoadFE:    {p:'skills/frontend-test',       n:'frontend-test',       k:'skill'},
  LoadReq:   {p:'skills/request-review',      n:'request-review',      k:'skill'},
  LoadRecv:  {p:'skills/receive-review',      n:'receive-review',      k:'skill'},
  LoadSec:   {p:'skills/security-audit',      n:'security-audit',      k:'skill'},
  LoadChk:   {p:'skills/security-checklist',  n:'security-checklist',  k:'skill'},
  LoadFin:   {p:'skills/finish-branch',       n:'finish-branch',       k:'skill'},
  LoadSafety:{p:'skills/safety-guard',        n:'safety-guard',        k:'skill'},
  LoadPrEx:  {p:'skills/pr-explain',          n:'pr-explain',          k:'skill'},
  LoadRetro: {p:'skills/retro',               n:'retro',               k:'skill'},
  LoadDebug: {p:'skills/debug-systematic',    n:'debug-systematic',    k:'skill'},
  LoadIncident:{p:'skills/incident-investigate',n:'incident-investigate',k:'skill'},
  LoadLock:  {p:'skills/lock-files',          n:'lock-files',          k:'skill'},
  LoadCmdG:  {p:'skills/cmd-guard',           n:'cmd-guard',           k:'skill'},
  LoadCtxS:  {p:'skills/context-snapshot',    n:'context-snapshot',    k:'skill'},
  LoadCtxR:  {p:'skills/context-resume',      n:'context-resume',      k:'skill'},
  LoadWS:    {p:'skills/write-skill',         n:'write-skill',         k:'skill'},
  HypAgent:  {p:'agents/hypothesis-tester',   n:'hypothesis-tester',   k:'agent'},
  FEAgent:   {p:'agents/frontend-e2e-runner', n:'frontend-e2e-runner', k:'agent'},
  LangAgent: {p:'agents/lang-reviewer',       n:'lang-reviewer',       k:'agent'},
  SecAgent:  {p:'agents/security-auditor',    n:'security-auditor',    k:'agent'},
  DBAgent:   {p:'agents/db-reviewer',         n:'db-reviewer',         k:'agent'},
  PrExAgent: {p:'agents/pr-explainer',        n:'pr-explainer',        k:'agent'},
  // review-plan 內 spawn 的兩個 subagent 節點，文件指回 review-plan 本身。
  // 這兩筆在移植來源裡是缺的（它多加了 design-language / design-direction、少了這兩筆），
  // 少了它們 RPT2 / RPT3 兩個節點的 F12 文件摘要與 F13 抽屜會整個消失。
  RPT2:      {p:'skills/review-plan',         n:'review-plan (T2 Eng-only)', k:'skill'},
  RPT3:      {p:'skills/review-plan',         n:'review-plan (T3 四視角)',   k:'skill'}
};

/**
 * 把 NODE_DOCS 的 p 解成 REFERENCE_DOCS 的 key。
 * skill 的實體是 <dir>/SKILL.md、agent 的實體是 <name>.md —— 兩者後綴不同，
 * 解錯的後果是抽屜點下去一片空白而且不報錯（驗證器 C6c 就是為了攔這個）。
 * @param {{p:string, k:string}} entry NODE_DOCS 的一筆
 * @returns {string}
 */
function docKey(entry) {
  return entry.k === 'agent' ? 'references/' + entry.p + '.md' : 'references/' + entry.p + '/SKILL.md';
}

/**
 * 取得文件全文。**先讀 references-data.js 的內嵌全文，沒有才 fetch** ——
 * 這個順序是 file:// 能直接開的唯一原因（F14），不可對調。
 * @param {{p:string, k:string}} entry
 * @returns {Promise<string>}
 */
function docText(entry) {
  var key = docKey(entry);
  var inlined = window.REFERENCE_DOCS && window.REFERENCE_DOCS[key];
  if (inlined != null) return Promise.resolve(inlined);
  return fetch(key).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  });
}

/**
 * 從 markdown frontmatter 擷取 description 的第一行。
 * 支援 inline 值與 YAML block scalar（| 與 >）—— 本 repo 的 SKILL.md 兩種都有用。
 * @param {string} text 文件原始文字
 * @returns {string|null} 沒有 description 時回 null
 */
function parseFrontmatterDesc(text) {
  var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  var fm = m ? m[1] : '';
  var lines = fm.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('description:') !== 0) continue;
    var val = lines[i].replace(/^description:\s*/, '').replace(/^["']|["']$/g, '').trim();
    if (val === '|' || val === '>') {
      var next = lines[i + 1];
      return next ? next.trim().replace(/^["']|["']$/g, '') : null;
    }
    return val || null;
  }
  return null;
}

/**
 * 解析 markdown 的 YAML frontmatter，回傳 { meta, body }。
 * 支援 inline 值、JSON 陣列、block scalar（| 與 >）。
 * @param {string} text
 * @returns {{meta:Object, body:string}} 沒有 frontmatter 時 meta 為空物件、body 為原文
 */
function parseFrontmatter(text) {
  var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  var meta = {};
  var lines = m[1].split(/\r?\n/);
  var i = 0;
  while (i < lines.length) {
    var kv = lines[i].match(/^(\w[\w-]*):\s*(.*)/);
    if (!kv) { i++; continue; }
    var key = kv[1];
    var raw = kv[2].trim();
    if (raw === '|' || raw === '>') {
      var parts = [];
      i++;
      while (i < lines.length && (lines[i].indexOf('  ') === 0 || lines[i] === '')) {
        parts.push(lines[i].trim());
        i++;
      }
      meta[key] = parts.join(' ').trim();
    } else if (raw.charAt(0) === '[') {
      try { meta[key] = JSON.parse(raw.replace(/'/g, '"')); } catch (e) { meta[key] = raw; }
      i++;
    } else {
      meta[key] = raw.replace(/^["']|["']$/g, '');
      i++;
    }
  }
  return { meta: meta, body: m[2] };
}

/* ── layout ────────────────────────────────────────────────────────────── */
/**
 * 估算節點高度：逐行量文字寬（CJK 約一個字身、ASCII 約半個），
 * 除以內容寬得換行數。統一高度會讓三個最長的 label 被裁掉，
 * 量過再給高度，框才跟著內容長。
 */
function measureHeight(label) {
  var contentW = NODE_W - 22, lineH = 21, lines = 0;
  String(label).split('\n').forEach(function (ln) {
    var w = 0;
    for (var i = 0; i < ln.length; i++) w += ln.charCodeAt(i) > 127 ? 15 : 7.7;
    lines += Math.max(1, Math.ceil(w / contentW));
  });
  return Math.max(NODE_H, lines * lineH + 22);
}

var rawNodes = Object.keys(FLOW.nodes).map(function (id) {
  var n = FLOW.nodes[id];
  return {
    id: id, label: n.label || id, nodeType: n.type || 'default',
    shape: n.shape || 'rect', phase: n.phase,
    width: NODE_W, height: measureHeight(n.label || id)
  };
});
var rawEdges = FLOW.edges.map(function (e, i) {
  return { id: 'e' + i, source: e[0], target: e[1], label: e[2] || '', kind: e[3] || 'solid' };
});

var layout = buildLayout(rawNodes, rawEdges, { rankSep: 110, nodeSep: 64 });
var nodeMap = new Map(layout.nodes.map(function (n) { return [n.id, n]; }));

/** phase id → 該 phase 中最上方的 node，作為傳送目標。 */
var phaseEntry = new Map();
layout.nodes.forEach(function (n) {
  var cur = phaseEntry.get(n.phase);
  if (!cur || n.y < nodeMap.get(cur).y) phaseEntry.set(n.phase, n.id);
});

/** 型別 → 節點數；phase → 節點數。面板上的數字全部由真資料算出。 */
var typeCount = {}, phaseCount = {};
layout.nodes.forEach(function (n) {
  typeCount[n.nodeType] = (typeCount[n.nodeType] || 0) + 1;
  phaseCount[n.phase] = (phaseCount[n.phase] || 0) + 1;
});

/** dagre 的首尾控制點在 node 中心，換成矩形邊框交點讓箭頭停在框上。 */
function edgePoints(e) {
  var pts = e.points;
  if (!pts || !pts.length) return [];
  var s = nodeMap.get(e.source), t = nodeMap.get(e.target);
  if (!s || !t) return pts;
  var mids = pts.length > 2 ? pts.slice(1, -1) : [];
  var dS = mids.length ? mids[0] : { x: t.x, y: t.y };
  var dT = mids.length ? mids[mids.length - 1] : { x: s.x, y: s.y };
  return [intersectRect(s.x, s.y, s.width, s.height, dS.x, dS.y)]
    .concat(mids, [intersectRect(t.x, t.y, t.width, t.height, dT.x, dT.y)]);
}

/* ── svg ───────────────────────────────────────────────────────────────── */
var svgEl = $('flow');
var svg = d3.select(svgEl);
var defs = svg.append('defs');

/** 建 marker；填色交給 CSS 變數，主題切換時箭頭跟著換。 */
function defArrow(id) {
  defs.append('marker').attr('id', id)
    .attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('refY', 0)
    .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4Z');
}
defArrow('arrow-normal'); defArrow('arrow-hl'); defArrow('arrow-dim');

var currentTransform = d3.zoomIdentity;
var zoomRoot = svg.append('g');
var zoom = d3.zoom().scaleExtent([0.04, 2.5]).on('zoom', function (evt) {
  currentTransform = evt.transform;
  zoomRoot.attr('transform', evt.transform.toString());
  updateMinimapViewport();
});
svg.call(zoom);

var edgeLayer = zoomRoot.append('g');
var nodeLayer = zoomRoot.append('g');
var lineGen = d3.line().x(function (d) { return d.x; }).y(function (d) { return d.y; })
  .curve(d3.curveCatmullRom.alpha(0.5));

/* — edges — */
var edgeSels = edgeLayer.selectAll('g').data(layout.edges, function (d) { return d.id; })
  .join('g').attr('class', 'edge');

edgeSels.append('path')
  .attr('class', 'edge-path')
  .attr('d', function (d) { return lineGen(edgePoints(d)); })
  .attr('marker-end', 'url(#arrow-normal)')
  .attr('stroke-dasharray', function (d) { return d.kind === 'dashed' ? '5 3' : null; });

edgeSels.each(function (d) {
  if (!d.label) return;
  var g = d3.select(this).append('g')
    .attr('transform', 'translate(' + (d.labelX || 0) + ',' + (d.labelY || 0) + ')');
  var tw = 0;
  for (var i = 0; i < d.label.length; i++) tw += d.label.charCodeAt(i) > 127 ? 10.5 : 6;
  tw += 14;
  var lines = d.label.split('\n');
  var th = lines.length * 16 + 6;
  g.append('rect').attr('class', 'edge-label-bg')
    .attr('x', -tw / 2).attr('y', -th / 2).attr('width', tw).attr('height', th).attr('rx', 2);
  var txt = g.append('text').attr('class', 'edge-label')
    .attr('text-anchor', 'middle')
    .attr('y', -(lines.length - 1) * 8);
  lines.forEach(function (ln, i) {
    txt.append('tspan').attr('x', 0).attr('dy', i === 0 ? '0.35em' : '16').text(ln);
  });
});

/* — nodes — */
var nodeSels = nodeLayer.selectAll('g').data(layout.nodes, function (d) { return d.id; })
  .join('g').attr('class', 'node')
  // data-id 是改版前就有的（舊 app.js 同樣寫在 .node 上），移植來源掉了它。
  // 它不影響任何 F 項行為，但少了它就沒有穩定的節點選取器可用於 e2e。
  .attr('data-id', function (d) { return d.id; })
  .attr('transform', function (d) { return 'translate(' + (d.x - d.width / 2) + ',' + (d.y - d.height / 2) + ')'; })
  .style('cursor', 'pointer')
  .on('click', function (evt, d) {
    evt.stopPropagation();
    var same = selection && selection.kind === 'node' && selection.id === d.id;
    setSelection(same ? null : { kind: 'node', id: d.id });
  });

/** stadium 節點（Start / End）走膠囊，其餘輕圓角。 */
function nodeRx(d) { return d.shape === 'stadium' ? d.height / 2 : 3; }

nodeSels.append('rect').attr('class', 'node-ring')
  .attr('x', -5).attr('y', -5)
  .attr('width', function (d) { return d.width + 10; })
  .attr('height', function (d) { return d.height + 10; })
  .attr('rx', function (d) { return nodeRx(d) + 5; });

nodeSels.append('rect').attr('class', 'node-rect')
  .attr('data-type', function (d) { return d.nodeType; })
  .attr('width', function (d) { return d.width; })
  .attr('height', function (d) { return d.height; })
  .attr('rx', nodeRx);

nodeSels.append('foreignObject')
  .attr('width', function (d) { return d.width; })
  .attr('height', function (d) { return d.height; })
  .each(function (d) {
    var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    div.setAttribute('class', 'node-inner');
    div.innerHTML = esc(d.label).replace(/\n/g, '<br>');
    this.appendChild(div);
  });

/* ── selection ─────────────────────────────────────────────────────────── */
var selection = null;

/**
 * 設定目前選取並連動更新四處：圖上高亮、detail panel、狀態列、面板內的 active 標記。
 * 未釘住的面板會在選到節點時自動收起——把畫面讓給圖，這是 rail 骨架的核心取捨。
 * @param {null | {kind:"node", id:string} | {kind:"type", type:string}} sel
 */
function setSelection(sel) {
  selection = sel;
  applyHighlight();
  renderDetail();
  renderStatus();
  if (panelSec === 'type') renderPanelBody();
  if (panelSec === 'phase') renderPanelBody();
  // 未釘住的面板：選了節點就讓路給圖
  if (sel && sel.kind === 'node' && panelOpen && !panelPinned) closePanel();
}

/**
 * 依目前 selection 算出要高亮的集合。
 * 選節點 → 自己 + 1-hop 上下游 + 相連邊；選型別 → 同型別全部節點、不含邊。
 * @returns {{nodes:Set<string>|null, edges:Set<string>|null, nbr:Set<string>|null}}
 */
function highlightSets() {
  if (!selection) return { nodes: null, edges: null, nbr: null };
  if (selection.kind === 'node') {
    var ns = new Set([selection.id]), es = new Set(), nb = new Set();
    layout.edges.forEach(function (e) {
      if (e.source === selection.id) { ns.add(e.target); nb.add(e.target); es.add(e.id); }
      if (e.target === selection.id) { ns.add(e.source); nb.add(e.source); es.add(e.id); }
    });
    return { nodes: ns, edges: es, nbr: nb };
  }
  var tn = new Set(layout.nodes.filter(function (n) { return n.nodeType === selection.type; })
    .map(function (n) { return n.id; }));
  return { nodes: tn, edges: new Set(), nbr: new Set() };
}

/** 三態：is-focus（自己）/ is-neighbor（1-hop）/ is-dimmed（其餘）。 */
function applyHighlight() {
  var h = highlightSets(), has = selection !== null;
  nodeSels
    .classed('is-focus', function (d) { return !!selection && selection.kind === 'node' && d.id === selection.id; })
    .classed('is-neighbor', function (d) { return !!h.nbr && h.nbr.has(d.id); })
    .classed('is-dimmed', function (d) { return has && !h.nodes.has(d.id); });
  edgeSels
    .classed('is-highlighted', function (d) { return !!h.edges && h.edges.has(d.id); })
    .classed('is-dimmed', function (d) { return has && !(h.edges && h.edges.has(d.id)); });
  edgeSels.select('.edge-path').attr('marker-end', function (d) {
    if (h.edges && h.edges.has(d.id)) return 'url(#arrow-hl)';
    return has ? 'url(#arrow-dim)' : 'url(#arrow-normal)';
  });
}

svg.on('click.pane', function (evt) {
  if (!evt.target.closest('.node')) setSelection(null);
});

/* ── detail panel ──────────────────────────────────────────────────────── */
var detailEl = $('detail');

/**
 * 產生上游／下游清單的 HTML。多行 label 只取第一行，避免清單被撐開。
 * @param {string[]} ids 節點 id 陣列；空陣列回傳「無」的佔位
 * @returns {string}
 */
function neighborListHtml(ids) {
  if (!ids.length) return '<div class="empty">無</div>';
  return '<ul>' + ids.map(function (id) {
    var n = FLOW.nodes[id];
    if (!n) return '';
    var first = String(n.label || id).split('\n')[0];
    return '<li><button class="link-row" data-jump="' + esc(id) + '">' +
             '<span class="dot" data-type="' + esc(n.type || 'default') + '"></span>' +
             '<span class="lbl">' + esc(first) + '</span>' +
             '<span class="via">' + esc(id) + '</span>' +
           '</button></li>';
  }).join('') + '</ul>';
}

/**
 * 重繪右側 detail panel。沒選節點就收起來。
 * 有對應文件的節點顯示 doc-card + 「查看完整文件」；**沒有的也顯示同尺寸卡片**
 * 並說明「此節點是流程步驟本身」——84 個節點裡 51 個沒有獨立文件，
 * 少了這個分支它們的版位會塌掉，或出現點了沒反應的死按鈕（契約 C17 守之）。
 */
function renderDetail() {
  if (!selection || selection.kind !== 'node') { detailEl.classList.remove('open'); return; }
  var id = selection.id, n = FLOW.nodes[id];
  if (!n) { detailEl.classList.remove('open'); return; }

  var type = n.type || 'default';
  var up = window.getUpstream(id), dn = window.getDownstream(id);
  var doc = NODE_DOCS[id];
  var lines = String(n.label || id).split('\n');

  var docHtml;
  if (doc) {
    // 描述先掛「載入中⋯」再非同步填入 frontmatter 的 description。
    // 內嵌資料其實是同步可得的，但保留這個兩段式是因為 F12 的可觀察行為就是這樣，
    // 且 fetch fallback 路徑（HTTP 模式）真的需要它。四句原文不得改寫。
    docHtml =
      '<div class="doc-card">' +
        '<div class="k">' + (doc.k === 'agent' ? 'agent' : 'skill') + '</div>' +
        '<div class="n">' + esc(doc.n) + '</div>' +
        '<div class="d" id="node-doc-desc">載入中⋯</div>' +
        '<button class="btn-doc" data-doc="' + esc(id) + '">查看完整文件</button>' +
      '</div>';
  } else {
    docHtml = '<div class="doc-card"><div class="k">無獨立文件</div>' +
              '<div class="d">此節點是流程步驟本身，規則寫在 CLAUDE.md 或上游 skill 內。</div></div>';
  }

  detailEl.innerHTML =
    '<div class="detail-head">' +
      '<div class="detail-meta">' +
        '<span class="badge" data-type="' + esc(type) + '">' + esc(TYPE_LABEL[type] || type) + '</span>' +
        '<span class="detail-phase">' + esc(PHASE_LABEL[n.phase] || n.phase || '') + '</span>' +
        '<button class="icon-btn" id="detail-close" title="關閉（Esc）">✕</button>' +
      '</div>' +
      '<div class="detail-title">' + esc(lines[0]) + '</div>' +
      (lines.length > 1 ? '<div class="row-desc" style="margin-top:5px">' + esc(lines.slice(1).join(' ')) + '</div>' : '') +
      '<div class="detail-id">' + esc(id) + '</div>' +
    '</div>' +
    '<div class="detail-body">' +
      docHtml +
      '<div class="sect-label">上游 · ' + up.length + '</div>' + neighborListHtml(up) +
      '<div class="sect-label">下游 · ' + dn.length + '</div>' + neighborListHtml(dn) +
    '</div>';

  detailEl.classList.add('open');
  $('detail-close').onclick = function () { setSelection(null); };
  detailEl.querySelectorAll('[data-jump]').forEach(function (b) {
    b.onclick = function () { var t = b.getAttribute('data-jump'); setSelection({ kind: 'node', id: t }); panTo(t); };
  });
  var db = detailEl.querySelector('[data-doc]');
  if (db) db.onclick = function () { openDrawer(db.getAttribute('data-doc')); };

  if (doc) {
    docText(doc)
      .then(function (text) {
        var el = detailEl.querySelector('#node-doc-desc');
        // selection 可能在載入期間已經換掉，重繪後這個節點就不在了
        if (el) el.textContent = parseFrontmatterDesc(text) || '（無描述）';
      })
      .catch(function () {
        var el = detailEl.querySelector('#node-doc-desc');
        if (el) el.textContent = '（載入失敗）';
      });
  }
}

/* ── 召喚式面板 ────────────────────────────────────────────────────────── */
var panelEl = $('panel'), panelBodyEl = $('panel-body');
var panelSec = null, panelOpen = false, panelPinned = false;

var SECTIONS = {
  type:  { title: '節點型別', sub: '8 型別 · 點一個 highlight 同型別節點' },
  phase: { title: '階段傳送', sub: '15 階段 · 點一個把視野帶到該段入口' },
  amb:   { title: '環境與跨流程', sub: '不在主線上、但全程適用的規則與 skill' },
  docs:  { title: '文件索引', sub: '27 skill + 6 agent · 點開右側抽屜' }
};

/**
 * 打開 rail 的召喚式面板並切到指定分區。
 * @param {"type"|"phase"|"amb"|"docs"} sec 分區代號
 * @param {HTMLElement} btn 觸發的 rail 按鈕，用來錨定面板位置與移動指示條
 */
function openPanel(sec, btn) {
  panelSec = sec;
  panelOpen = true;
  $('panel-title').textContent = SECTIONS[sec].title;
  $('panel-sub').textContent = SECTIONS[sec].sub;
  renderPanelBody();
  positionPanel(btn);
  panelEl.classList.add('open');
  document.querySelectorAll('.rail-btn[data-sec]').forEach(function (b) {
    b.setAttribute('aria-expanded', String(b.getAttribute('data-sec') === sec));
  });
  moveIndicator(btn);
}

/** 收起召喚式面板，清掉 rail 的 aria-expanded 與活躍指示條。 */
function closePanel() {
  panelOpen = false; panelSec = null;
  panelEl.classList.remove('open');
  document.querySelectorAll('.rail-btn[data-sec]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  moveIndicator(null);
}

/** 面板貼著被點的 rail 按鈕出現（popover 錨定），超出視口時夾回來。 */
function positionPanel(btn) {
  if (!btn) return;
  var top = btn.getBoundingClientRect().top;
  var max = window.innerHeight - Math.min(panelEl.scrollHeight || 400, window.innerHeight * 0.78) - 14;
  panelEl.style.top = Math.max(14, Math.min(top, Math.max(14, max))) + 'px';
}

var indEl = $('rail-ind');
/**
 * 把 rail 的活躍指示條滑到指定按鈕的位置；傳 null 則隱藏。
 * 位移用帶回彈的 --e-snap 曲線，讓「切分區」這個動作有重量感。
 * @param {HTMLElement|null} btn
 */
function moveIndicator(btn) {
  if (!btn) { indEl.classList.remove('on'); return; }
  indEl.style.top = btn.offsetTop + 'px';
  indEl.classList.add('on');
}

/**
 * 依目前分區重繪面板內容（型別 / 階段 / 環境 / 文件索引四種版型），
 * 並重新綁定其中的點擊行為。selection 變動時也會重繪，讓 active 標記跟著更新。
 */
function renderPanelBody() {
  if (!panelSec) return;
  var html = '';
  var i = 0;
  /**
   * 產生逐項錯開進場用的 class 與 --i 序號；每呼叫一次序號加一。
   * 清單項依序浮現而不是整塊跳出來，是「動畫流暢自然」的具體手段之一。
   * @returns {string} 可直接插進標籤的屬性字串
   */
  function stag() { return ' class="stag" style="--i:' + (i++) + '"'; }

  if (panelSec === 'type') {
    html += '<div class="sect-note">' + layout.nodes.length + ' 個節點依角色分成 8 型別；顏色只由 <code>data-type</code> 決定。</div>';
    html += '<ul>' + FLOW.legend.map(function (l) {
      var on = selection && selection.kind === 'type' && selection.type === l.type;
      return '<li' + stag() + '><button class="row' + (on ? ' is-active' : '') + '" data-type-pick="' + esc(l.type) + '">' +
             '<span class="swatch" data-type="' + esc(l.type) + '"></span>' +
             '<span class="row-main"><span class="row-name">' + esc(l.label) + '</span></span>' +
             '<span class="row-count">' + (typeCount[l.type] || 0) + '</span></button></li>';
    }).join('') + '</ul>';

  } else if (panelSec === 'phase') {
    var sorted = FLOW.phases.slice().sort(function (a, b) { return a.order - b.order; });
    var curPhase = selection && selection.kind === 'node' && FLOW.nodes[selection.id]
      ? FLOW.nodes[selection.id].phase : null;
    html += '<ul>' + sorted.map(function (p, idx) {
      var on = curPhase === p.id;
      return '<li' + stag() + '><button class="row' + (on ? ' is-active' : '') + '" data-phase="' + esc(p.id) + '">' +
             '<span class="row-ord">' + String(idx + 1).padStart(2, '0') + '</span>' +
             '<span class="row-main"><span class="row-name">' + esc(p.label) + '</span></span>' +
             '<span class="row-count">' + (phaseCount[p.id] || 0) + '</span></button></li>';
    }).join('') + '</ul>';

  } else if (panelSec === 'amb') {
    FLOW.ambient.forEach(function (g) {
      html += '<div class="sect-label"' + stag() + '>' + esc(g.title) + ' · ' + g.items.length + '</div>';
      html += '<div class="sect-note">' + esc(g.desc) + '</div>';
      html += '<ul>' + g.items.map(function (it) {
        var clickable = g.kind === 'skill' && it.docKey;
        return '<li' + stag() + '><button class="row' + (clickable ? '' : ' is-static') + '"' +
               (clickable ? ' data-doc="' + esc(it.docKey) + '"' : ' tabindex="-1"') + '>' +
               '<span class="row-main"><span class="row-name">' + esc(it.name) + '</span>' +
               '<span class="row-desc">' + esc(it.desc) + '</span></span></button></li>';
      }).join('') + '</ul>';
    });

  } else if (panelSec === 'docs') {
    var ids = Object.keys(NODE_DOCS);
    [['skill', 'Skills'], ['agent', 'Agents']].forEach(function (grp) {
      var list = ids.filter(function (id) { return NODE_DOCS[id].k === grp[0]; });
      html += '<div class="sect-label"' + stag() + '>' + grp[1] + ' · ' + list.length + '</div>';
      html += '<ul>' + list.map(function (id) {
        var d = NODE_DOCS[id];
        var inGraph = !!FLOW.nodes[id];
        return '<li' + stag() + '><button class="row" data-doc="' + esc(id) + '">' +
               '<span class="row-main"><span class="row-name">' + esc(d.n) + '</span></span>' +
               (inGraph ? '<span class="row-count">在圖上</span>' : '') +
               '</button></li>';
      }).join('') + '</ul>';
    });
  }

  panelBodyEl.innerHTML = html;

  panelBodyEl.querySelectorAll('[data-type-pick]').forEach(function (b) {
    b.onclick = function () {
      var t = b.getAttribute('data-type-pick');
      var on = selection && selection.kind === 'type' && selection.type === t;
      setSelection(on ? null : { kind: 'type', type: t });
      renderPanelBody();
    };
  });
  panelBodyEl.querySelectorAll('[data-phase]').forEach(function (b) {
    b.onclick = function () {
      var target = phaseEntry.get(b.getAttribute('data-phase'));
      if (target) { setSelection({ kind: 'node', id: target }); panTo(target); }
    };
  });
  panelBodyEl.querySelectorAll('[data-doc]').forEach(function (b) {
    b.onclick = function () { openDrawer(b.getAttribute('data-doc')); };
  });
}

document.querySelectorAll('.rail-btn[data-sec]').forEach(function (btn) {
  btn.onclick = function () {
    var sec = btn.getAttribute('data-sec');
    if (panelOpen && panelSec === sec) closePanel();
    else openPanel(sec, btn);
  };
});
$('panel-close').onclick = closePanel;
$('panel-pin').onclick = function () {
  panelPinned = !panelPinned;
  $('panel-pin').classList.toggle('is-on', panelPinned);
  $('panel-pin').setAttribute('title', panelPinned ? '已釘住：選節點時保持展開' : '釘住：選節點時不自動收起');
};

/* ── 文件抽屜 ──────────────────────────────────────────────────────────── */
var drawerEl = $('drawer'), backdropEl = $('backdrop');

/**
 * 開啟文件抽屜並渲染該節點對應的 markdown。
 *
 * 先把外框與「載入中⋯」畫出來、抽屜立刻滑開，再非同步填描述、pills 與正文——
 * 內嵌資料其實同步可得，但保留兩段式是為了 fetch fallback 路徑（HTTP 模式）也能用。
 * 正文渲染前會去掉第一個 H1（標題列已經顯示過名稱）。
 *
 * @param {string} nodeId 節點 id；NODE_DOCS 查無此 id 就直接 return（不開空抽屜）
 */
function openDrawer(nodeId) {
  var d = NODE_DOCS[nodeId];
  if (!d) return;
  var type = FLOW.nodes[nodeId] ? (FLOW.nodes[nodeId].type || 'default') : d.k;

  drawerEl.innerHTML =
    '<div class="drawer-head">' +
      '<div class="crumb">' +
        '<span>references</span><span class="sep">/</span>' +
        '<span>' + esc(d.k === 'agent' ? 'agents' : 'skills') + '</span><span class="sep">/</span>' +
        '<span>' + esc(d.n) + '</span>' +
        '<button class="icon-btn close" id="drawer-close" title="關閉（Esc）">✕</button>' +
      '</div>' +
      '<div class="detail-meta" style="margin-bottom:10px">' +
        '<span class="badge" data-type="' + esc(type) + '">' + esc(TYPE_LABEL[type] || d.k) + '</span>' +
      '</div>' +
      '<div class="drawer-title">' + esc(d.n) + '</div>' +
      '<div class="drawer-desc" id="drawer-desc"></div>' +
      '<div class="pills" id="drawer-pills"></div>' +
    '</div>' +
    '<div class="drawer-body"><div class="md" id="drawer-md">' +
      '<p class="loading">載入中⋯</p>' +
    '</div></div>';

  drawerEl.classList.add('open');
  backdropEl.classList.add('open');
  $('drawer-close').onclick = closeDrawer;

  docText(d)
    .then(function (text) {
      var parsed = parseFrontmatter(text);
      var meta = parsed.meta;

      var descEl = drawerEl.querySelector('#drawer-desc');
      if (descEl) descEl.textContent = meta.description || '';

      // pills：路徑一定有；model / tools 依 frontmatter 有才給，不編造
      var pills = '<span class="pill"><b>path</b> ' + esc(docKey(d)) + '</span>';
      if (meta.model) pills += '<span class="pill"><b>model</b> ' + esc(meta.model) + '</span>';
      var tools = Array.isArray(meta.tools) ? meta.tools.join(', ') : meta.tools;
      if (tools) pills += '<span class="pill"><b>tools</b> ' + esc(tools) + '</span>';
      var pillsEl = drawerEl.querySelector('#drawer-pills');
      if (pillsEl) pillsEl.innerHTML = pills;

      // 去掉 body 的第一個 H1：抽屜的標題列已經顯示過名稱，留著會重複一次。
      //
      // **先 trim 再 replace，順序不可對調。** frontmatter 的收尾 `---` 之後還有一個換行，
      // 所以 body 實際是以 "\r\n# xxx" 開頭；不先 trim 的話 `^#` 永遠匹配不到。
      // 改版前的 code 是 `.replace(...).trim()`（見 43d5938 的 app.js:603），
      // 順序反了，所以 baseline F13 寫的「去掉第一個 H1」從來沒有真的生效過。
      var body = parsed.body.trim().replace(/^#\s+.+\r?\n?/, '').trim();
      var mdEl = drawerEl.querySelector('#drawer-md');
      if (mdEl) mdEl.innerHTML = window.marked.parse(body);
    })
    .catch(function (err) {
      var mdEl = drawerEl.querySelector('#drawer-md');
      if (mdEl) mdEl.innerHTML = '<p class="drawer-error">載入失敗：' + esc(err.message) + '</p>';
    });
}
/** 關閉文件抽屜與其 backdrop。ESC、✕、點 backdrop 三個入口共用。 */
function closeDrawer() {
  drawerEl.classList.remove('open');
  backdropEl.classList.remove('open');
}
backdropEl.onclick = closeDrawer;

/* ── minimap ───────────────────────────────────────────────────────────── */
MM_W = Math.max(56, Math.min(112, Math.round((MM_H - 10) * (layout.gw / layout.gh)) + 10));
document.documentElement.style.setProperty('--mm-w', MM_W + 'px');

var mmSvg = d3.select($('minimap-card')).append('svg')
  .attr('class', 'minimap').attr('width', MM_W).attr('height', MM_H);
var mmScale = Math.min((MM_W - 10) / layout.gw, (MM_H - 10) / layout.gh);
var mmOX = (MM_W - layout.gw * mmScale) / 2;
var mmOY = (MM_H - layout.gh * mmScale) / 2;
var mmG = mmSvg.append('g').attr('transform', 'translate(' + mmOX + ',' + mmOY + ') scale(' + mmScale + ')');

mmG.selectAll('line').data(layout.edges).join('line')
  .attr('x1', function (d) { return nodeMap.get(d.source).x; })
  .attr('y1', function (d) { return nodeMap.get(d.source).y; })
  .attr('x2', function (d) { return nodeMap.get(d.target).x; })
  .attr('y2', function (d) { return nodeMap.get(d.target).y; })
  .attr('stroke', 'currentColor').attr('stroke-opacity', 0.18)
  .attr('stroke-width', 1.5 / mmScale);

mmG.selectAll('rect').data(layout.nodes).join('rect')
  .attr('class', 'mm-node')
  .attr('data-type', function (d) { return d.nodeType; })
  .attr('x', function (d) { return d.x - d.width / 2; })
  .attr('y', function (d) { return d.y - d.height / 2; })
  .attr('width', function (d) { return d.width; })
  .attr('height', function (d) { return d.height; })
  .attr('rx', 6)
  .attr('stroke-width', 2 / mmScale);

var mmViewport = mmSvg.append('rect').attr('class', 'mm-viewport')
  .attr('stroke-width', 1.5).attr('rx', 2);

/**
 * 依目前 zoom transform 更新索引條上的視口指示框。
 * 每次 zoom 事件都會呼叫，所以只做算術、不碰 layout。
 */
function updateMinimapViewport() {
  var w = svgEl.clientWidth || 800, h = svgEl.clientHeight || 600, t = currentTransform;
  mmViewport
    .attr('x', mmOX + (-t.x / t.k) * mmScale)
    .attr('y', mmOY + (-t.y / t.k) * mmScale)
    .attr('width', (w / t.k) * mmScale)
    .attr('height', (h / t.k) * mmScale);
}

mmSvg.on('click', function (evt) {
  var p = d3.pointer(evt, mmSvg.node());
  var gx = (p[0] - mmOX) / mmScale, gy = (p[1] - mmOY) / mmScale;
  var w = svgEl.clientWidth || 800, h = svgEl.clientHeight || 600, k = currentTransform.k;
  svg.transition().duration(320).ease(d3.easeCubicOut)
    .call(zoom.transform, d3.zoomIdentity.translate(w / 2 - gx * k, h / 2 - gy * k).scale(k));
});

/* ── 視野控制 ──────────────────────────────────────────────────────────── */
/**
 * 落地視野：對「寬」而不是對「整張」縮放，並錨在流程起點。
 * 這張圖實測 1978x12398，硬要 fit 整張的話 scale 會掉到 0.075，
 * 節點文字剩 1px、圖只占 1920 寬裡的 148px —— 那不叫留白，叫沒東西。
 * 改成填滿寬度、頂端對齊，使用者只需要上下捲，全圖總覽交給右緣 minimap。
 */
function landingTransform(k0) {
  var w = svgEl.clientWidth || 800;
  var k = k0 || Math.max(0.3, Math.min(1.4, w * 0.93 / layout.gw));
  return d3.zoomIdentity.translate((w - layout.gw * k) / 2, 26).scale(k);
}
/**
 * 回到落地視野（對齊流程起點的可讀比例），animate 為 true 時走 560ms 過場。
 *
 * **這不是 fit-all。** 這張圖實測縱橫比 0.17，硬 fit 整張會掉到 8% 縮放、
 * 節點只有 6.5px 高，一個字都讀不到，所以定案設計移除了 fit-all 能力。
 * 詳見 docs/archive/2026/docs-site-redesign/spec.md §已決事項 0。
 * @param {boolean} [animate] 是否帶過場動畫
 */
function fitView(animate) {
  var t = landingTransform();
  if (animate) svg.transition().duration(560).ease(d3.easeCubicInOut).call(zoom.transform, t);
  else svg.call(zoom.transform, t);
}

/** 把某節點帶到視野中央；已放大時保持倍率，太小時提到可讀的 0.85。 */
function panTo(id) {
  var n = nodeMap.get(id);
  if (!n) return;
  var w = svgEl.clientWidth || 800, h = svgEl.clientHeight || 600;
  var k = Math.max(currentTransform.k, 0.85);
  svg.transition().duration(560).ease(d3.easeCubicInOut)
    .call(zoom.transform, d3.zoomIdentity.translate(w / 2 - n.x * k, h / 2 - n.y * k).scale(k));
}

$('btn-fit').onclick = function () { fitView(true); };

/* ── 狀態行 / 報頭 ─────────────────────────────────────────────────────── */
function renderStatus() {
  var el = $('statusline');
  if (selection && selection.kind === 'node') {
    var u = window.getUpstream(selection.id).length, dn = window.getDownstream(selection.id).length;
    el.innerHTML = '焦點 <b>' + esc(selection.id) + '</b> · 上游 ' + u + ' · 下游 ' + dn + ' · Esc 取消';
  } else if (selection && selection.kind === 'type') {
    el.innerHTML = '型別 <b>' + esc(TYPE_LABEL[selection.type] || selection.type) + '</b> · ' +
                   (typeCount[selection.type] || 0) + ' 個節點';
  } else {
    el.innerHTML = '點節點看 1-hop 上下游 · 滾輪縮放 · 拖曳平移';
  }
}
$('mast-sub').textContent =
  layout.nodes.length + ' 節點 · ' + layout.edges.length + ' 邊 · ' + FLOW.phases.length + ' 階段';

/* ── 主題（三態 auto / light / dark；屬性名鎖死）──────────────────────── */
var THEME_GLYPH = { auto: '自', light: '明', dark: '暗' };
var THEME_NAME = { auto: '自動', light: '明亮', dark: '暗色' };

/**
 * 套用主題模式到 <html>，同步 data-theme（解析後的 light/dark）與 data-theme-mode（auto/light/dark）。
 * **這兩個屬性名是與 index.html 的防 FOUC inline script、以及 CSS 的共同契約，不可改名。**
 * @param {"auto"|"light"|"dark"} mode
 */
function applyThemeMode(mode) {
  var root = document.documentElement;
  var resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', mode);
  var b = $('btn-theme');
  b.textContent = THEME_GLYPH[mode];
  b.setAttribute('data-label', '主題：' + THEME_NAME[mode]);
  // aria-label 也要跟著換：data-label 只餵給 CSS 的 ::after 名牌，不進可及性樹，
  // 靜態的 aria-label 會讓螢幕閱讀器永遠讀不到目前是哪一態。
  b.setAttribute('aria-label', '切換主題（目前：' + THEME_NAME[mode] + '）');
  b.classList.toggle('is-on', mode !== 'auto');
}

(function setupTheme() {
  var stored = null;
  // key 必須是 dev-workflow-theme：index.html 的防 FOUC inline script 讀的是同一個，
  // 且線上既有訪客存的偏好都在這個 key 底下，改名等於把它們全部作廢、退回 auto。
  try { stored = localStorage.getItem('dev-workflow-theme'); } catch (e) {}
  applyThemeMode(stored || 'auto');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if ((document.documentElement.getAttribute('data-theme-mode') || 'auto') === 'auto') applyThemeMode('auto');
  });
  $('btn-theme').onclick = function () {
    var order = ['auto', 'light', 'dark'];
    var cur = document.documentElement.getAttribute('data-theme-mode') || 'auto';
    var next = order[(order.indexOf(cur) + 1) % order.length];
    applyThemeMode(next);
    try { localStorage.setItem('dev-workflow-theme', next); } catch (e) {}
  };
})();

/* ── 鍵盤 ──────────────────────────────────────────────────────────────── */
window.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (drawerEl.classList.contains('open')) closeDrawer();
  else if (selection) setSelection(null);
  else if (panelOpen) closePanel();
});

window.addEventListener('resize', function () { updateMinimapViewport(); });

/* ── 初始 ──────────────────────────────────────────────────────────────── */
renderStatus();
// 進場：先退半格再滑進落地視野，讓第一眼有「圖被推到位」的動作而不是硬切
setTimeout(function () {
  var land = landingTransform();
  svg.call(zoom.transform, landingTransform(land.k * 0.88));
  svg.transition().duration(720).ease(d3.easeCubicOut).call(zoom.transform, land);
}, 40);

})();
