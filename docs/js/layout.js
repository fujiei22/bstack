/**
 * dagre layout helper — dagre + d3 版
 *
 * 以 multigraph 模式跑 dagre layout，同時計算：
 *   - node 中心座標（x, y）
 *   - edge control points（含 label 位置）
 *
 * edge label 尺寸在 layout 前傳入 dagre，讓 dagre 在 ranksep 分配時
 * 避免 label 與 node / 其他 label 重疊。這是 React Flow 方案的根本差異。
 *
 * 依賴 window.dagre（由 index.html type="module" 掛上）。
 */

/**
 * 矩形邊框與方向射線的交點。
 * 從矩形中心 (cx, cy) 沿 (px-cx, py-cy) 方向射出，回傳落在矩形邊框的點。
 *
 * @param {number} cx - 矩形中心 x
 * @param {number} cy - 矩形中心 y
 * @param {number} w  - 矩形寬度
 * @param {number} h  - 矩形高度
 * @param {number} px - 目標點 x（決定方向）
 * @param {number} py - 目標點 y
 * @returns {{x:number, y:number}}
 */
function intersectRect(cx, cy, w, h, px, py) {
  const dx = px - cx;
  const dy = py - cy;
  const hw = w / 2;
  const hh = h / 2;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy + hh }; // 退化：回傳底邊中點
  }

  let t = Infinity;

  // 上下邊
  if (Math.abs(dy) > 0.001) {
    const ty = (dy > 0 ? hh : -hh) / dy;
    if (ty > 0) {
      const ix = cx + ty * dx;
      if (ix >= cx - hw - 0.001 && ix <= cx + hw + 0.001) t = Math.min(t, ty);
    }
  }
  // 左右邊
  if (Math.abs(dx) > 0.001) {
    const tx = (dx > 0 ? hw : -hw) / dx;
    if (tx > 0) {
      const iy = cy + tx * dy;
      if (iy >= cy - hh - 0.001 && iy <= cy + hh + 0.001) t = Math.min(t, tx);
    }
  }

  if (t === Infinity) return { x: cx, y: cy + hh };
  return { x: cx + t * dx, y: cy + t * dy };
}

/**
 * 跑 dagre layout，回傳含座標的 nodes 與 edges。
 *
 * @param {Array<{id:string, width:number, height:number}>} nodes
 * @param {Array<{id:string, source:string, target:string, label:string, kind:string}>} edges
 * @param {Object} [opts]
 * @param {number} [opts.rankSep=100] rank 間距
 * @param {number} [opts.nodeSep=60]  同 rank 內節點間距
 * @returns {{
 *   nodes: Array<{id:string, x:number, y:number, width:number, height:number, ...}>,
 *   edges: Array<{id:string, points:Array<{x:number,y:number}>, labelX:number, labelY:number, ...}>,
 *   gw: number,
 *   gh: number
 * }}
 */
function buildLayout(nodes, edges, opts = {}) {
  const { rankSep = 100, nodeSep = 60 } = opts;
  const dagre = window.dagre;
  if (!dagre) throw new Error('dagre not loaded on window.dagre');

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({
    rankdir: 'TB',
    ranksep: rankSep,
    nodesep: nodeSep,
    marginx: 48,
    marginy: 48,
    ranker: 'tight-tree',
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: n.width, height: n.height });
  }

  for (const e of edges) {
    // 估算 label 寬高，納入 layout 計算以避免 label 重疊
    let lw = 0;
    let lh = 0;
    if (e.label) {
      for (const c of e.label) lw += c.charCodeAt(0) > 127 ? 10 : 6;
      lw += 14;
      lh = 20;
    }
    g.setEdge(e.source, e.target, { label: e.label, width: lw, height: lh, labelpos: 'c' }, e.id);
  }

  dagre.layout(g);

  const lNodes = nodes.map(n => {
    const p = g.node(n.id);
    return { ...n, x: p.x, y: p.y };
  });

  const lEdges = edges.map(e => {
    const p = g.edge({ v: e.source, w: e.target, name: e.id });
    return {
      ...e,
      points: p?.points ?? [],
      labelX: p?.x ?? null,
      labelY: p?.y ?? null,
    };
  });

  const graph = g.graph();
  return {
    nodes: lNodes,
    edges: lEdges,
    gw: graph.width ?? 1200,
    gh: graph.height ?? 800,
  };
}
