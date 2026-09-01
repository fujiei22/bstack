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
/* ══════════════════════════════════════════════════════════════════════════
   rail-console — demo 主程式（vanilla / classic script / file:// 可開）
   自寫渲染，不引用 docs/js/app.js（它硬編了舊配色）。
   ══════════════════════════════════════════════════════════════════════════ */
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
 * node ID → 文件識別（真實路徑，取自站上既有對照表）。
 * demo 不載 202KB 的 references-data.js，抽屜內文用靜態示意。
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
  LoadDLang: {p:'skills/design-language',     n:'design-language',     k:'skill'},
  LoadDD:    {p:'skills/design-direction',    n:'design-direction',    k:'skill'},
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
  PrExAgent: {p:'agents/pr-explainer',        n:'pr-explainer',        k:'agent'}
};

/** 抽屜示意用的真實描述 / tools（沒有的走 fallback，不編造）。 */
var DOC_META = {
  'dev-workflow':      {d:'自動化開發流程主入口。Phase 0 入口分流（Track / Tier）、9 階段順序、skill hand-off state、Trace 標籤、Auto-fix、Fail handling、Memory hook、跨流程 skill dispatch。'},
  'brainstorm':        {d:'需求釐清 + Phase 0 入口分流。0a 對話釐清（含讀 memory）、0b 看 codebase、0c Track 判定、0d Tier 判定、spec 落檔。'},
  'write-plan':        {d:'從 spec 寫實作 plan：bite-sized task、紅綠循環、並行性分析（parallel-group）、spec → plan 對齊檢查。'},
  'execute-plan':      {d:'按 plan 推進實作：逐 task 紅綠循環、parallel-group 派 subagent、verify、commit、task fail 處置、blocker 升級。'},
  'verify-done':       {d:'task 完成前的綜合驗證：test / lint / build / type-check 全跑，T2+ 多輪 verify，T3 UI 改動加 browser e2e。'},
  'request-review':    {d:'自動 code review 派發：T1 self / T2 subagent + lang-reviewer / T3 雙視角 + lang-reviewer。'},
  'finish-branch':     {d:'收尾 development branch + git workflow 細則合一：clean check、rebase、push、開 PR、squash merge。'},
  'design-language':   {d:'既有專案設計語言辨識與對齊：前端副檔名唯一真相、區塊邊界偵測、設計語言抽取（exact values）、四項對齊檢查清單。'},
  'design-direction':  {d:'定設計方向：三方向硬門、可變維度、三 subagent 並行、產出落檔、反 AI slop、6 維度評審。'},
  'lock-files':        {d:'鎖定編輯範圍：user 顯式宣告哪些檔／目錄禁改，寫入動作 pre-check，user 解鎖機制。'},
  'cmd-guard':         {d:'危險指令防呆：偵測危險指令類型、危險度分級、AskUserQuestion 二次確認、安全替代建議。'},
  'context-snapshot':  {d:'進度快照存：抽當前 state（spec / plan / phase / decision / pending）寫到 docs/snapshots/，recovery 路徑明確。'},
  'context-resume':    {d:'進度快照讀回：找最新 snapshot、Read 還原 state、印 progress、接續對應 phase skill。'},
  'write-skill':       {d:'寫新 skill 的 meta skill：SKILL.md frontmatter / body 結構、繁中風格、命名、放置位置、Red Flags。'},
  'lang-reviewer':     {d:'程式語言特化 code reviewer。動態 dispatch：主 dispatcher 在 spawn 時標 language，本 agent 依該 language 套對應 idiom / pitfall / best practice。', t:'Read, Grep, Glob, Bash'},
  'security-auditor':  {d:'安全特化 reviewer：OWASP Top 10、STRIDE 六類威脅、security-checklist 逐項對、PII 違規、File-type 硬規則命中。獨立 context、避免球員兼裁判。', t:'Read, Grep, Glob, Bash'},
  'db-reviewer':       {d:'資料庫 schema / SQL / migration 特化 reviewer：schema 設計合理性、index / query plan、migration 安全性、PII 處理、回滾路徑。', t:'Read, Grep, Glob, Bash, mysql MCP'},
  'pr-explainer':      {d:'PR diff 詳盡解釋特化 reviewer：獨立 context 重讀 diff，寫「為何 + 怎做 + 關聯」三層解釋落檔。', t:'Read, Write, Edit, Glob, Grep, Bash'},
  'frontend-e2e-runner':{d:'Playwright e2e 執行 specialist：獨立 context 跑 browser 自動化、截圖、監控 console+network、PII mask，回結構化 pass/fail/inconclusive。', t:'Playwright MCP, Read, Write, Bash'},
  'hypothesis-tester': {d:'Incident hypothesis 驗證特化 agent：獨立 context 驗單一假設，不知道別的假設、不預設答案，回嚴格結構化 verdict。', t:'Read, Grep, Glob, Bash'}
};

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
    var meta = DOC_META[doc.n];
    docHtml =
      '<div class="doc-card">' +
        '<div class="k">' + (doc.k === 'agent' ? 'agent' : 'skill') + '</div>' +
        '<div class="n">' + esc(doc.n) + '</div>' +
        '<div class="d">' + esc(meta ? meta.d : 'references/' + doc.p + '/ 下的完整定義。') + '</div>' +
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
 * @param {string} nodeId 節點 id；NODE_DOCS 查無此 id 就直接 return（不開空抽屜）
 */
function openDrawer(nodeId) {
  var d = NODE_DOCS[nodeId];
  if (!d) return;
  var meta = DOC_META[d.n] || {};
  var type = FLOW.nodes[nodeId] ? (FLOW.nodes[nodeId].type || 'default') : d.k;

  var pills = '<span class="pill"><b>path</b> references/' + esc(d.p) + '</span>';
  if (d.k === 'skill') pills += '<span class="pill"><b>載入</b> Skill tool</span>';
  if (meta.t) pills += '<span class="pill"><b>tools</b> ' + esc(meta.t) + '</span>';

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
      '<div class="drawer-desc">' + esc(meta.d || ('references/' + d.p + '/ 下的完整定義。')) + '</div>' +
      '<div class="pills">' + pills + '</div>' +
    '</div>' +
    '<div class="drawer-body"><div class="md">' +
      '<h3>在流程裡的位置</h3>' +
      '<ul>' +
        (FLOW.nodes[nodeId]
          ? '<li>所屬階段：<code>' + esc(PHASE_LABEL[FLOW.nodes[nodeId].phase] || '') + '</code></li>' +
            '<li>上游 ' + window.getUpstream(nodeId).length + ' 個節點、下游 ' + window.getDownstream(nodeId).length + ' 個節點</li>'
          : '<li>不在主線圖上：按需載入 / 環境性規則</li>') +
        '<li>節點 id：<code>' + esc(nodeId) + '</code></li>' +
      '</ul>' +
      '<h3>正文</h3>' +
      '<p>正式站在這裡渲染 <code>' + esc(d.p) + '/</code> 的完整 markdown（frontmatter 的 description、body 的階段步驟、Red Flags 等），' +
      '由 <code>references-data.js</code> 內嵌後以 marked 轉 HTML，離線也讀得到。</p>' +
      '<div class="note">這是設計 demo：為了不讓三個方向各自載入 202KB 的內嵌文件庫，抽屜內文以本區塊示意。' +
      '上方的描述、路徑、tools 與上下游數量都是真資料，只有這段正文是佔位。</div>' +
    '</div></div>';

  drawerEl.classList.add('open');
  backdropEl.classList.add('open');
  $('drawer-close').onclick = closeDrawer;
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
  b.classList.toggle('is-on', mode !== 'auto');
}

(function setupTheme() {
  var stored = null;
  try { stored = localStorage.getItem('rail-console-theme'); } catch (e) {}
  applyThemeMode(stored || 'auto');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if ((document.documentElement.getAttribute('data-theme-mode') || 'auto') === 'auto') applyThemeMode('auto');
  });
  $('btn-theme').onclick = function () {
    var order = ['auto', 'light', 'dark'];
    var cur = document.documentElement.getAttribute('data-theme-mode') || 'auto';
    var next = order[(order.indexOf(cur) + 1) % order.length];
    applyThemeMode(next);
    try { localStorage.setItem('rail-console-theme', next); } catch (e) {}
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
