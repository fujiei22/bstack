/**
 * dev-workflow flowchart explorer — dagre + d3 版主程式
 *
 * 以 @dagrejs/dagre 計算 layout（edge label 尺寸納入 spacing，不重疊），
 * d3 v7 渲染 SVG。無 React / React Flow 依賴。
 *
 * 互動：
 *   - 點節點 → highlight 焦點 + 1-hop 上下游 + 連接邊（dashed 動畫）
 *   - 點圖例 type → highlight 同 type 節點（邊與上下游不 highlight）
 *   - 再點同節點 / 點空白 / ESC → 清除
 *   - 側欄上下游清單點擊 → 跳轉焦點
 */

// d3 / dagre / buildLayout / intersectRect 由 index.html classic script 載入為全域變數
const d3 = window.d3;

// ── constants ──────────────────────────────────────────────────────────────────

const NODE_W   = 220;
const NODE_H   = 80;
const HL_COLOR = '#FF6A00';
const EDGE_CLR = '#8080CC';
const DIM_CLR  = '#CCCCEE';
const MM_W     = 176;
const MM_H     = 128;

/**
 * node ID → { path, name }：agent / skill 節點對應的文件路徑。
 * path 相對 index.html（docs/），對應 references-data.js 內嵌 key。
 */
const NODE_DOCS = {
  // ── Skills（25 個）──────────────────────────────────────────
  DevWfSkill:   { path: 'references/skills/dev-workflow/SKILL.md',         name: 'dev-workflow' },
  BS:           { path: 'references/skills/brainstorm/SKILL.md',           name: 'brainstorm' },
  LoadDB:       { path: 'references/skills/db-access/SKILL.md',            name: 'db-access' },
  LoadWP:       { path: 'references/skills/write-plan/SKILL.md',           name: 'write-plan' },
  LoadRP:       { path: 'references/skills/review-plan/SKILL.md',          name: 'review-plan' },
  LoadExec:     { path: 'references/skills/execute-plan/SKILL.md',         name: 'execute-plan' },
  LoadTDD:      { path: 'references/skills/tdd-cycle/SKILL.md',            name: 'tdd-cycle' },
  LoadDispatch: { path: 'references/skills/dispatch-parallel/SKILL.md',    name: 'dispatch-parallel' },
  LoadVerify:   { path: 'references/skills/verify-done/SKILL.md',          name: 'verify-done' },
  LoadFE:       { path: 'references/skills/frontend-test/SKILL.md',        name: 'frontend-test' },
  LoadReq:      { path: 'references/skills/request-review/SKILL.md',       name: 'request-review' },
  LoadRecv:     { path: 'references/skills/receive-review/SKILL.md',       name: 'receive-review' },
  LoadSec:      { path: 'references/skills/security-audit/SKILL.md',       name: 'security-audit' },
  LoadChk:      { path: 'references/skills/security-checklist/SKILL.md',   name: 'security-checklist' },
  LoadFin:      { path: 'references/skills/finish-branch/SKILL.md',        name: 'finish-branch' },
  LoadSafety:   { path: 'references/skills/safety-guard/SKILL.md',         name: 'safety-guard' },
  LoadPrEx:     { path: 'references/skills/pr-explain/SKILL.md',           name: 'pr-explain' },
  LoadRetro:    { path: 'references/skills/retro/SKILL.md',                name: 'retro' },
  LoadDebug:    { path: 'references/skills/debug-systematic/SKILL.md',     name: 'debug-systematic' },
  LoadIncident: { path: 'references/skills/incident-investigate/SKILL.md', name: 'incident-investigate' },
  LoadLock:     { path: 'references/skills/lock-files/SKILL.md',           name: 'lock-files' },
  LoadCmdG:     { path: 'references/skills/cmd-guard/SKILL.md',            name: 'cmd-guard' },
  LoadCtxS:     { path: 'references/skills/context-snapshot/SKILL.md',     name: 'context-snapshot' },
  LoadCtxR:     { path: 'references/skills/context-resume/SKILL.md',       name: 'context-resume' },
  LoadWS:       { path: 'references/skills/write-skill/SKILL.md',          name: 'write-skill' },

  // ── Agents（6 個）──────────────────────────────────────────
  HypAgent:  { path: 'references/agents/hypothesis-tester.md',   name: 'hypothesis-tester' },
  FEAgent:   { path: 'references/agents/frontend-e2e-runner.md', name: 'frontend-e2e-runner' },
  LangAgent: { path: 'references/agents/lang-reviewer.md',       name: 'lang-reviewer' },
  SecAgent:  { path: 'references/agents/security-auditor.md',    name: 'security-auditor' },
  DBAgent:   { path: 'references/agents/db-reviewer.md',         name: 'db-reviewer' },
  PrExAgent: { path: 'references/agents/pr-explainer.md',        name: 'pr-explainer' },

  // ── review-plan 內 spawn 的 subagent（指回 review-plan skill）─
  RPT2: { path: 'references/skills/review-plan/SKILL.md', name: 'review-plan (T2 Eng-only)' },
  RPT3: { path: 'references/skills/review-plan/SKILL.md', name: 'review-plan (T3 四視角)' },
};

/**
 * 從 markdown frontmatter 擷取 description 第一行。
 * 支援 inline 值與 YAML block scalar（|）。
 * @param {string} text - 文件原始文字
 * @returns {string|null}
 */
function parseFrontmatterDesc(text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('description:')) continue;
    const val = lines[i].replace(/^description:\s*/, '').replace(/^["']|["']$/g, '').trim();
    if (val === '|' || val === '>') return lines[i + 1]?.trim().replace(/^["']|["']$/g, '') ?? null;
    return val || null;
  }
  return null;
}

/**
 * 解析 markdown YAML frontmatter，回傳 { meta, body }。
 * 支援 inline 值、JSON 陣列、block scalar（| / >）。
 * @param {string} text
 * @returns {{ meta: Object, body: string }}
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  const lines = m[1].split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const kv = lines[i].match(/^(\w[\w-]*):\s*(.*)/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    const rawVal = kv[2].trim();
    if (rawVal === '|' || rawVal === '>') {
      const parts = [];
      i++;
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        parts.push(lines[i].trim());
        i++;
      }
      meta[key] = parts.join(' ').trim();
    } else if (rawVal.startsWith('[')) {
      try { meta[key] = JSON.parse(rawVal.replace(/'/g, '"')); }
      catch { meta[key] = rawVal; }
      i++;
    } else {
      meta[key] = rawVal.replace(/^["']|["']$/g, '');
      i++;
    }
  }
  return { meta, body: m[2] };
}

// node 顏色由 styles.css 的 --c-* tokens 驅動，依 SVG / HTML 元素的 data-type 屬性匹配

// ── raw data ───────────────────────────────────────────────────────────────────

/**
 * 依 ?v= query param 選 v1 / v2 / v3 資料。預設 v3。
 * 向下相容：window.FLOW_DATA_VERSIONS 不存在時 fallback 至 window.FLOW_DATA。
 */
function pickFlowData() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('v');
  const versions = window.FLOW_DATA_VERSIONS;
  if (versions) {
    if (requested === 'v1' && versions.v1) return versions.v1;
    if (requested === 'v2' && versions.v2) return versions.v2;
    if (requested === 'v3' && versions.v3) return versions.v3;
    return versions.v3 || versions.v2 || versions.v1; // 預設 v3
  }
  return window.FLOW_DATA;
}

const FLOW = pickFlowData();
// 讓 data.js 之 getUpstream / getDownstream / getAdjacentEdges 走 active flow
// （否則 D2 等 v2 / v3 新增節點在 detail panel 之「上下游清單」會回 0 — 因預設查 v1 之 FLOW_DATA.edges）
if (typeof window !== 'undefined') window.__ACTIVE_FLOW__ = FLOW;
const phaseLabel = Object.fromEntries(FLOW.phases.map(p => [p.id, p.label]));

// 設目前 active version 給 UI 顯示用
window.__ACTIVE_FLOW_VERSION__ = (() => {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('v');
  if (v === 'v1' || v === 'v2' || v === 'v3') return v;
  return 'v3'; // 預設 v3
})();

/**
 * 將 window.FLOW_DATA 轉成 layout 用的 nodes / edges 結構。
 * @returns {{ nodes: Array, edges: Array }}
 */
function buildRaw() {
  const nodes = Object.entries(FLOW.nodes).map(([id, n]) => ({
    id,
    label:      n.label ?? id,
    nodeType:   n.type ?? 'default',
    phase:      n.phase,
    phaseLabel: phaseLabel[n.phase] ?? n.phase,
    width:  NODE_W,
    height: NODE_H,
  }));
  const edges = FLOW.edges.map(([from, to, label, kind], i) => ({
    id:     `e${i}`,
    source: from,
    target: to,
    label:  label ?? '',
    kind:   kind ?? 'solid',
  }));
  return { nodes, edges };
}

const { nodes: rawNodes, edges: rawEdges } = buildRaw();
const layout = buildLayout(rawNodes, rawEdges);

/** id → laid-out node（供 edgePoints 計算交點） */
const nodeMap = new Map(layout.nodes.map(n => [n.id, n]));

/** phase id → 該 phase 中 y 座標最小（最上方）的 node id，作為傳送目標。 */
const phaseEntryNode = new Map();
for (const n of layout.nodes) {
  const cur = phaseEntryNode.get(n.phase);
  if (!cur || n.y < (nodeMap.get(cur)?.y ?? Infinity)) {
    phaseEntryNode.set(n.phase, n.id);
  }
}

// ── edge path helper ───────────────────────────────────────────────────────────

/**
 * 將 dagre edge.points（首尾為 node center）轉為可畫 path 的控制點。
 * 首尾替換為矩形邊框交點，讓箭頭終止於節點邊框而非中心。
 *
 * @param {Object} edge - layout edge（含 points, source, target）
 * @returns {Array<{x:number, y:number}>}
 */
function edgePoints(edge) {
  const pts = edge.points;
  if (!pts || pts.length === 0) return [];
  const src = nodeMap.get(edge.source);
  const tgt = nodeMap.get(edge.target);
  if (!src || !tgt) return pts;

  const mids = pts.length > 2 ? pts.slice(1, -1) : [];
  const dirSrc = mids.length > 0 ? mids[0] : { x: tgt.x, y: tgt.y };
  const dirTgt = mids.length > 0 ? mids[mids.length - 1] : { x: src.x, y: src.y };

  const srcPt = intersectRect(src.x, src.y, src.width, src.height, dirSrc.x, dirSrc.y);
  const tgtPt = intersectRect(tgt.x, tgt.y, tgt.width, tgt.height, dirTgt.x, dirTgt.y);
  return [srcPt, ...mids, tgtPt];
}

// ── html escape ────────────────────────────────────────────────────────────────

/** XSS 防護：HTML 特殊字元轉義。 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── svg setup ──────────────────────────────────────────────────────────────────

const svgEl = /** @type {SVGSVGElement} */ (document.getElementById('flow-svg'));
const svg   = d3.select(svgEl);

/** 目前縮放狀態（供 minimap 計算 viewport indicator）。 */
let currentTransform = d3.zoomIdentity;

// ── defs: arrowhead markers ────────────────────────────────────────────────────

const defs = svg.append('defs');

/**
 * 在 defs 內建立箭頭 marker。
 * @param {string} id    - marker id
 * @param {string} color - fill 顏色
 */
function defArrow(id, color) {
  defs.append('marker')
    .attr('id', id)
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 7)
    .attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4Z')
    .attr('fill', color);
}

defArrow('arrow-normal', EDGE_CLR);
defArrow('arrow-hl',     HL_COLOR);
defArrow('arrow-dim',    DIM_CLR);

// ── zoom / pan ─────────────────────────────────────────────────────────────────

const zoomRoot = svg.append('g').attr('class', 'zoom-root');

const zoom = d3.zoom()
  .scaleExtent([0.04, 2.5])
  .on('zoom', evt => {
    currentTransform = evt.transform;
    zoomRoot.attr('transform', evt.transform.toString());
    updateMinimapViewport();
  });

svg.call(zoom);

// ── layers（邊在下、節點在上）────────────────────────────────────────────────────

const edgeLayer = zoomRoot.append('g').attr('class', 'edge-layer');
const nodeLayer = zoomRoot.append('g').attr('class', 'node-layer');

// ── path generator ─────────────────────────────────────────────────────────────

const lineGen = d3.line().x(d => d.x).y(d => d.y).curve(d3.curveCatmullRom.alpha(0.5));

// ── render edges ───────────────────────────────────────────────────────────────

const edgeSels = edgeLayer.selectAll('.edge')
  .data(layout.edges, d => d.id)
  .join('g')
  .attr('class', 'edge')
  .attr('data-id', d => d.id);

edgeSels.append('path')
  .attr('class', 'edge-path')
  .attr('d', d => lineGen(edgePoints(d)))
  .attr('fill', 'none')
  .attr('stroke', EDGE_CLR)
  .attr('stroke-width', 1.5)
  .attr('marker-end', 'url(#arrow-normal)')
  .attr('stroke-dasharray', d => d.kind === 'dashed' ? '5 3' : null);

// edge label（含白底 rect）
edgeSels.each(function(d) {
  if (!d.label) return;
  const g = d3.select(this).append('g')
    .attr('class', 'edge-label-g')
    .attr('transform', `translate(${d.labelX ?? 0},${d.labelY ?? 0})`);

  // 估算 label 寬度（含中文字）
  let tw = 0;
  for (const c of d.label) tw += c.charCodeAt(0) > 127 ? 9.5 : 5.5;
  tw += 12;
  const th = 17;

  g.append('rect')
    .attr('class', 'edge-label-bg')
    .attr('x', -tw / 2).attr('y', -th / 2)
    .attr('width', tw).attr('height', th)
    .attr('rx', 3);

  g.append('text')
    .attr('class', 'edge-label')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .text(d.label);
});

// ── render nodes ───────────────────────────────────────────────────────────────

const nodeSels = nodeLayer.selectAll('.node')
  .data(layout.nodes, d => d.id)
  .join('g')
  .attr('class', 'node')
  .attr('data-id', d => d.id)
  .attr('transform', d => `translate(${d.x - d.width / 2},${d.y - d.height / 2})`)
  .style('cursor', 'pointer')
  .on('click', (evt, d) => {
    evt.stopPropagation();
    setSelection(
      selection?.kind === 'node' && selection.id === d.id
        ? null
        : { kind: 'node', id: d.id }
    );
  });

nodeSels.append('rect')
  .attr('class', 'node-rect')
  .attr('data-type', d => d.nodeType ?? 'default') // CSS 依 data-type 套色（暗色主題自動跟）
  .attr('width',  d => d.width)
  .attr('height', d => d.height)
  .attr('rx', 2)
  .attr('stroke-width', 1.5);

// foreignObject 包 HTML div，讓瀏覽器處理文字換行
nodeSels.append('foreignObject')
  .attr('width',  d => d.width)
  .attr('height', d => d.height)
  .each(function(d) {
    const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    div.className = 'node-inner';
    // 文字需 XSS 轉義，\n 換 <br>
    div.innerHTML = esc(d.label).replace(/\n/g, '<br>');
    this.appendChild(div);
  });

// ── selection state ────────────────────────────────────────────────────────────

/** @type {null | {kind:'node', id:string} | {kind:'type', type:string}} */
let selection = null;

/**
 * 設定 selection 並觸發 highlight / detail panel / legend 更新。
 * @param {null | {kind:'node',id:string} | {kind:'type',type:string}} sel
 */
function setSelection(sel) {
  selection = sel;
  applyHighlight();
  renderDetailPanel();
  renderLegend();
}

// ── highlight ──────────────────────────────────────────────────────────────────

/**
 * 計算 highlight set：依 selection kind 決定 nodeIds / edgeIds / neighborIds。
 * @returns {{ nodeIds: Set<string>|null, edgeIds: Set<string>|null, neighborIds: Set<string>|null }}
 */
function getHighlightSets() {
  if (!selection) return { nodeIds: null, edgeIds: null, neighborIds: null };

  if (selection.kind === 'node') {
    const nodeIds    = new Set([selection.id]);
    const edgeIds    = new Set();
    const neighborIds = new Set();
    for (const e of layout.edges) {
      if (e.source === selection.id) { nodeIds.add(e.target); neighborIds.add(e.target); edgeIds.add(e.id); }
      if (e.target === selection.id) { nodeIds.add(e.source); neighborIds.add(e.source); edgeIds.add(e.id); }
    }
    return { nodeIds, edgeIds, neighborIds };
  }

  if (selection.kind === 'type') {
    const nodeIds = new Set(layout.nodes.filter(n => n.nodeType === selection.type).map(n => n.id));
    return { nodeIds, edgeIds: new Set(), neighborIds: new Set() };
  }

  return { nodeIds: null, edgeIds: null, neighborIds: null };
}

/** 依 selection 更新所有 node / edge 的 CSS class 與 SVG attribute。 */
function applyHighlight() {
  const { nodeIds, edgeIds, neighborIds } = getHighlightSets();
  const hasSel = selection !== null;

  nodeSels
    .classed('is-focus',    d => selection?.kind === 'node' && d.id === selection.id)
    .classed('is-neighbor', d => !!neighborIds?.has(d.id))
    .classed('is-dimmed',   d => hasSel && !nodeIds?.has(d.id));

  edgeSels
    .classed('is-highlighted', d => !!edgeIds?.has(d.id))
    .classed('is-dimmed',      d => hasSel && !edgeIds?.has(d.id));

  edgeSels.select('.edge-path')
    .attr('stroke', d =>
      edgeIds?.has(d.id)             ? HL_COLOR
      : hasSel                       ? DIM_CLR
      :                                EDGE_CLR
    )
    .attr('stroke-width', d => edgeIds?.has(d.id) ? 2.5 : 1.5)
    .attr('marker-end', d =>
      edgeIds?.has(d.id) ? 'url(#arrow-hl)'
      : hasSel           ? 'url(#arrow-dim)'
      :                    'url(#arrow-normal)'
    )
    // highlighted 邊套 8 4 dasharray + CSS animation；其他回原值
    .attr('stroke-dasharray', d => {
      if (edgeIds?.has(d.id)) return '8 4';
      return d.kind === 'dashed' ? '5 3' : null;
    });
}

// ── pane click / ESC ────────────────────────────────────────────────────────────

svg.on('click.pane', evt => {
  if (!evt.target.closest('.node')) setSelection(null);
});

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const drawer = document.getElementById('doc-drawer');
  if (drawer?.classList.contains('open')) closeDocDrawer();
  else setSelection(null);
});

// ── detail panel ────────────────────────────────────────────────────────────────

const detailPanelEl = /** @type {HTMLElement} */ (document.getElementById('detail-panel'));

/** 依目前 selection 更新右側 detail panel DOM。 */
function renderDetailPanel() {
  const focusId = selection?.kind === 'node' ? selection.id : null;
  if (!focusId) { detailPanelEl.classList.add('hidden'); return; }

  const node = FLOW.nodes[focusId];
  if (!node) { detailPanelEl.classList.add('hidden'); return; }

  const ups   = typeof window.getUpstream   === 'function' ? window.getUpstream(focusId)   : [];
  const downs = typeof window.getDownstream === 'function' ? window.getDownstream(focusId) : [];
  const pLabel = (FLOW.phases.find(p => p.id === node.phase) || {}).label || node.phase;

  /**
   * 建立上下游清單 HTML。
   * @param {string[]} ids
   */
  function listHtml(ids) {
    if (ids.length === 0) return '<div class="empty">（無）</div>';
    return `<ul>${ids.map(id =>
      `<li data-jump="${esc(id)}">${esc(id)}：${esc(FLOW.nodes[id]?.label ?? '(unknown)')}</li>`
    ).join('')}</ul>`;
  }

  const docEntry = NODE_DOCS[focusId] ?? null;

  detailPanelEl.classList.remove('hidden');
  detailPanelEl.innerHTML = `
    <button class="close-btn" title="關閉" aria-label="關閉">×</button>
    <div class="meta">
      <span class="badge" data-type="${esc(node.type)}">${esc(node.type)}</span>
      <span>${esc(pLabel)}</span>
    </div>
    <h3>${esc(node.label)}</h3>
    ${docEntry ? `
    <section class="doc-section">
      <h4>文件</h4>
      <div class="doc-name">${esc(docEntry.name)}</div>
      <div class="doc-desc" id="node-doc-desc">載入中⋯</div>
      <button class="doc-link doc-open-btn">→ 查看完整文件</button>
    </section>
    ` : ''}
    <section>
      <h4>上游 (${ups.length})</h4>
      ${listHtml(ups)}
    </section>
    <section>
      <h4>下游 (${downs.length})</h4>
      ${listHtml(downs)}
    </section>
  `;

  detailPanelEl.querySelector('.close-btn').onclick = () => setSelection(null);
  detailPanelEl.querySelectorAll('li[data-jump]').forEach(li => {
    li.onclick = () => setSelection({ kind: 'node', id: li.dataset.jump });
  });

  if (docEntry) {
    const docOpenBtn = detailPanelEl.querySelector('.doc-open-btn');
    if (docOpenBtn) docOpenBtn.onclick = () => openDocDrawer(docEntry.path, docEntry.name);

    const inlinedDesc = window.REFERENCE_DOCS?.[docEntry.path];
    const descPromise = inlinedDesc != null
      ? Promise.resolve(inlinedDesc)
      : fetch(docEntry.path).then(r => r.text());

    descPromise
      .then(text => {
        const desc = parseFrontmatterDesc(text);
        const el = detailPanelEl.querySelector('#node-doc-desc');
        if (el) el.textContent = desc ?? '（無描述）';
      })
      .catch(() => {
        const el = detailPanelEl.querySelector('#node-doc-desc');
        if (el) el.textContent = '（載入失敗）';
      });
  }
}

// ── doc drawer ─────────────────────────────────────────────────────────────────

const drawerEl      = /** @type {HTMLElement} */ (document.getElementById('doc-drawer'));
const backdropEl    = /** @type {HTMLElement} */ (document.getElementById('doc-drawer-backdrop'));
const drawerBreadEl = /** @type {HTMLElement} */ (document.getElementById('doc-drawer-breadcrumb'));
const drawerHeaderEl= /** @type {HTMLElement} */ (document.getElementById('doc-drawer-header'));
const drawerBodyEl  = /** @type {HTMLElement} */ (document.getElementById('doc-drawer-body'));

document.getElementById('doc-drawer-close').onclick = closeDocDrawer;
backdropEl.addEventListener('click', closeDocDrawer);

/** 關閉 doc drawer。 */
function closeDocDrawer() {
  drawerEl.classList.remove('open');
  backdropEl.classList.remove('open');
}

/**
 * 開啟 doc drawer，fetch 並渲染指定 markdown 文件。
 * @param {string} docPath - 相對 index.html 的路徑
 * @param {string} docName - 顯示名稱
 */
function openDocDrawer(docPath, docName) {
  const docType = docPath.includes('/agents/') ? 'Agent'
                : docPath.includes('/skills/')  ? 'Skill'
                : 'Reference';

  drawerBreadEl.textContent = `References / ${docType} / ${docName}`;
  drawerHeaderEl.innerHTML  = '';
  drawerBodyEl.innerHTML    = '<div class="doc-drawer-loading">載入中⋯</div>';

  drawerEl.classList.add('open');
  backdropEl.classList.add('open');

  // file:// 模式：直接讀取預嵌資料；HTTP 模式：fallback 到 fetch
  const inlined = window.REFERENCE_DOCS?.[docPath];
  const textPromise = inlined != null
    ? Promise.resolve(inlined)
    : fetch(docPath).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); });

  textPromise.then(text => {
      const { meta, body } = parseFrontmatter(text);

      const pills = [];
      if (meta.model) pills.push(`model: ${meta.model}`);
      if (Array.isArray(meta.tools))        pills.push(`tools: ${meta.tools.join(', ')}`);
      else if (typeof meta.tools === 'string') pills.push(`tools: ${meta.tools}`);

      drawerHeaderEl.innerHTML = `
        <div class="doc-type-badge">${esc(docType)}</div>
        <h1 class="doc-title">${esc(meta.name ?? docName)}</h1>
        ${meta.description ? `<p class="doc-description">${esc(meta.description)}</p>` : ''}
        ${pills.length ? `<div class="doc-meta-pills">${pills.map(p => `<span class="meta-pill">${esc(p)}</span>`).join('')}</div>` : ''}
      `;

      const cleanBody = body.replace(/^#\s+.+\n?/, '').trim();
      drawerBodyEl.innerHTML = window.marked.parse(cleanBody);
    })
    .catch(e => {
      drawerBodyEl.innerHTML = `<div class="doc-drawer-error">載入失敗：${esc(e.message)}</div>`;
    });
}

// ── legend ─────────────────────────────────────────────────────────────────────

const legendSideEl = /** @type {HTMLElement} */ (document.getElementById('legend-side'));

/** 依目前 selection 重繪圖例側欄。 */
/**
 * 將主視圖平移（並視需要調整縮放）至指定 node 中心。
 * 若目前縮放 < 0.35 則提升至 0.35，否則維持現有縮放。
 *
 * @param {string} nodeId
 */
function panToNode(nodeId) {
  const node = nodeMap.get(nodeId);
  if (!node) return;
  const svgW = svgEl.clientWidth  || 800;
  const svgH = svgEl.clientHeight || 600;
  const k  = Math.max(0.35, currentTransform.k);
  const tx = svgW / 2 - node.x * k;
  const ty = svgH / 2 - node.y * k;
  svg.transition().duration(350)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}

/**
 * 渲染 ambient（圖外規則 / 跨流程 skill）區塊 HTML。
 * 這些之前畫成孤島 node，現移到 sidebar 明示「不在主線」。
 *
 * @returns {string} HTML 片段；FLOW.ambient 缺值時回空字串
 */
function renderAmbientHtml() {
  const groups = FLOW.ambient;
  if (!Array.isArray(groups) || groups.length === 0) return '';
  return groups.map(g => {
    const items = (g.items || []).map(it => {
      // skill 群組的 item 是可點 button（開 doc drawer）；policy 群組是純文字 div
      const isSkill = g.kind === 'skill' && it.docKey && NODE_DOCS[it.docKey];
      const tag = isSkill ? 'button' : 'div';
      const typeAttr = g.kind === 'skill' ? 'skill' : 'policy';
      const dataAttr = isSkill ? ` data-doc-key="${esc(it.docKey)}"` : '';
      const typeBtnAttr = isSkill ? ' type="button"' : '';
      return `
        <${tag} class="ambient-item ambient-item-${esc(g.kind)}"${typeBtnAttr}${dataAttr}
          title="${esc(it.desc || it.name)}">
          <span class="swatch" data-type="${typeAttr}"></span>
          <span class="ambient-item-text">
            <span class="ambient-item-name">${esc(it.name)}</span>
            ${it.desc ? `<span class="ambient-item-desc">${esc(it.desc)}</span>` : ''}
          </span>
        </${tag}>
      `;
    }).join('');
    return `
      <div class="phase-section-title ambient-section-title">${esc(g.title)}</div>
      ${g.desc ? `<div class="ambient-group-desc">${esc(g.desc)}</div>` : ''}
      <div class="ambient-items">${items}</div>
    `;
  }).join('');
}

/** 依目前 selection 重繪圖例側欄（含 type filter 與 Phase 快速傳送）。 */
function renderLegend() {
  const activeType   = selection?.kind === 'type' ? selection.type   : null;
  const activeNodeId = selection?.kind === 'node' ? selection.id     : null;

  // Phase 按鈕（依 order 排序）
  const sortedPhases = [...FLOW.phases].sort((a, b) => a.order - b.order);
  const phasesHtml = sortedPhases.map(p => {
    const entryId = phaseEntryNode.get(p.id);
    if (!entryId) return '';
    const isActive = activeNodeId === entryId;
    return `
      <button type="button"
        class="phase-jump-item${isActive ? ' active' : ''}"
        data-phase="${esc(p.id)}"
        data-node="${esc(entryId)}"
        title="傳送至 ${esc(p.label)}（highlight 入口節點）">
        ${esc(p.label)}
      </button>
    `;
  }).join('');

  // 目前 active 版本（pickFlowData 已依 ?v= 決定，預設 v3）
  const activeVersion = window.__ACTIVE_FLOW_VERSION__ || 'v3';

  legendSideEl.innerHTML = `
    <div class="app-header">
      <div class="app-name">repo b</div>
      <div class="app-sub">dev-workflow flowchart explorer</div>
      <div class="version-toggle" role="group" aria-label="Theme">
        <button type="button" id="theme-toggle" class="theme-toggle" title="切換主題（auto / light / dark）" aria-label="切換主題">
          <svg class="theme-icon theme-icon-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>
          </svg>
          <svg class="theme-icon theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
          <svg class="theme-icon theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="legend-title">Node Types</div>
    ${FLOW.legend.map(item => {
      return `
        <button type="button"
          class="legend-item${activeType === item.type ? ' active' : ''}"
          data-type="${esc(item.type)}"
          title="點擊高亮所有 ${esc(item.type)} 節點">
          <span class="swatch" data-type="${esc(item.type)}"></span>
          <span class="label">${esc(item.label)}</span>
        </button>
      `;
    }).join('')}
    <div class="phase-section-title">Phase 快速傳送</div>
    ${phasesHtml}
    ${renderAmbientHtml()}
    <div class="legend-hint">
      ${activeType ? '再點同項清除 / ESC 清除' : activeNodeId ? '再點同節點 / ESC 清除' : '點 type 或 phase 快速導覽'}
    </div>
  `;

  legendSideEl.querySelectorAll('.legend-item').forEach(btn => {
    btn.onclick = () => {
      const t = btn.dataset.type;
      setSelection(selection?.kind === 'type' && selection.type === t ? null : { kind: 'type', type: t });
    };
  });

  legendSideEl.querySelectorAll('.phase-jump-item').forEach(btn => {
    btn.onclick = () => {
      const nodeId = btn.dataset.node;
      setSelection({ kind: 'node', id: nodeId });
      panToNode(nodeId);
    };
  });

  // ambient skill item → 開 doc drawer（NODE_DOCS 查 path）
  legendSideEl.querySelectorAll('.ambient-item-skill[data-doc-key]').forEach(btn => {
    btn.onclick = () => {
      const docEntry = NODE_DOCS[btn.dataset.docKey];
      if (docEntry) openDocDrawer(docEntry.path, docEntry.name);
    };
  });
}

// ── minimap ─────────────────────────────────────────────────────────────────────

const flowAreaEl = /** @type {HTMLElement} */ (document.querySelector('.flow-area'));

const mmSvg = d3.select(flowAreaEl).append('svg')
  .attr('class', 'minimap')
  .attr('width',  MM_W)
  .attr('height', MM_H);

// 計算 minimap 縮放比例讓整張圖塞入 minimap 框
const mmScale = Math.min((MM_W - 8) / layout.gw, (MM_H - 8) / layout.gh);
const mmOX    = (MM_W - layout.gw * mmScale) / 2;
const mmOY    = (MM_H - layout.gh * mmScale) / 2;

const mmG = mmSvg.append('g')
  .attr('transform', `translate(${mmOX},${mmOY}) scale(${mmScale})`);

// minimap：edges（直線，簡化）
mmG.selectAll('.mm-edge')
  .data(layout.edges)
  .join('line')
  .attr('class', 'mm-edge')
  .attr('x1', d => nodeMap.get(d.source)?.x ?? 0)
  .attr('y1', d => nodeMap.get(d.source)?.y ?? 0)
  .attr('x2', d => nodeMap.get(d.target)?.x ?? 0)
  .attr('y2', d => nodeMap.get(d.target)?.y ?? 0)
  .attr('stroke', 'rgba(64, 64, 196, 0.22)')
  .attr('stroke-width', 1.5 / mmScale);

// minimap：nodes
mmG.selectAll('.mm-node')
  .data(layout.nodes)
  .join('rect')
  .attr('class', 'mm-node')
  .attr('data-type', d => d.nodeType ?? 'default') // CSS 依 data-type 套色
  .attr('x', d => d.x - d.width  / 2)
  .attr('y', d => d.y - d.height / 2)
  .attr('width',  d => d.width)
  .attr('height', d => d.height)
  .attr('rx', 4)
  .attr('stroke-width', 2 / mmScale);

// minimap：viewport 指示框
const mmViewport = mmSvg.append('rect')
  .attr('class', 'mm-viewport')
  .attr('fill', 'none')
  .attr('stroke', HL_COLOR)
  .attr('stroke-width', 1.5)
  .attr('rx', 2);

/**
 * 依目前 zoom transform 更新 minimap viewport 指示框位置與大小。
 */
function updateMinimapViewport() {
  const svgW = svgEl.clientWidth  || 800;
  const svgH = svgEl.clientHeight || 600;
  const t    = currentTransform;
  const vx   = -t.x / t.k;
  const vy   = -t.y / t.k;
  const vw   =  svgW / t.k;
  const vh   =  svgH / t.k;
  mmViewport
    .attr('x',      mmOX + vx * mmScale)
    .attr('y',      mmOY + vy * mmScale)
    .attr('width',  vw * mmScale)
    .attr('height', vh * mmScale);
}

// minimap 點擊 → 平移主視圖到對應位置
mmSvg.on('click', evt => {
  const [mx, my] = d3.pointer(evt, mmSvg.node());
  const gx   = (mx - mmOX) / mmScale;
  const gy   = (my - mmOY) / mmScale;
  const svgW = svgEl.clientWidth  || 800;
  const svgH = svgEl.clientHeight || 600;
  const t    = currentTransform;
  svg.transition().duration(180)
    .call(zoom.transform, d3.zoomIdentity
      .translate(svgW / 2 - gx * t.k, svgH / 2 - gy * t.k)
      .scale(t.k));
});

// ── fit view ───────────────────────────────────────────────────────────────────

/**
 * 初始化 fit view：縮放讓整張圖在視窗中置中顯示。
 */
function fitView() {
  const svgW  = svgEl.clientWidth  || 800;
  const svgH  = svgEl.clientHeight || 600;
  const pad   = 0.08;
  const scale = Math.min(
    svgW * (1 - pad * 2) / layout.gw,
    svgH * (1 - pad * 2) / layout.gh
  );
  const tx = (svgW - layout.gw * scale) / 2;
  const ty = (svgH - layout.gh * scale) / 2;
  svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

// 稍微延遲確保 SVG 已完成 layout 量測
setTimeout(fitView, 40);

// ── 主題切換：auto → light → dark cycle ────────────────────────────────────────

/**
 * 套用主題模式到 <html>，同步 data-theme（解析後的 light/dark）與 data-theme-mode（auto/light/dark）。
 * mode='auto' 時依 prefers-color-scheme 解析；其餘直接用 mode 當解析結果。
 */
function applyThemeMode(mode) {
  const root = document.documentElement;
  const resolved = mode === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', mode);
}

(function setupThemeToggle() {
  // 監聽系統主題變化：mode=auto 時即時同步
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener?.('change', () => {
    const mode = document.documentElement.getAttribute('data-theme-mode') || 'auto';
    if (mode === 'auto') applyThemeMode('auto');
  });

  // delegation：button 由 renderLegend() 注入，每輪重繪都還在
  document.addEventListener('click', (evt) => {
    const btn = evt.target.closest('#theme-toggle');
    if (!btn) return;
    const order = ['auto', 'light', 'dark'];
    const cur = document.documentElement.getAttribute('data-theme-mode') || 'auto';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    applyThemeMode(next);
    try { localStorage.setItem('dev-workflow-theme', next); } catch (_) {}
  });
})();

// ── initial render ─────────────────────────────────────────────────────────────

renderLegend();
renderDetailPanel();
updateMinimapViewport();
