/**
 * DesignCanvas — 變體並排網格版面
 *
 * 用於展示 2 個以上的靜態設計 variation 讓人對比選擇。
 * 每個 variation 有 label，可點擊放大。
 *
 * 用法：
 *   <DesignCanvas
 *     title="Hero 區設計探索"
 *     subtitle="3 個方向對比"
 *     columns={3}
 *   >
 *     <Variation label="Minimal" description="極簡克制版">
 *       <div>...你的設計 1...</div>
 *     </Variation>
 *     <Variation label="Editorial" description="雜誌編輯風">
 *       <div>...你的設計 2...</div>
 *     </Variation>
 *     <Variation label="Brutalist" description="粗獷原始">
 *       <div>...你的設計 3...</div>
 *     </Variation>
 *   </DesignCanvas>
 *
 * 配合 React + Babel 使用：把本檔內容 inline 進展示 HTML 的 <script type="text/babel"> 標籤，
 * 之後 window.DesignCanvas / window.Variation 可用。
 * 本檔沒有 HTML 宿主，不是可獨立執行的頁面，e2e 無從跑起。
 *
 * 【容器樣式不屬於任何一版】
 * 下面 canvasStyles.container 的 #F5F5F0 底色與系統字型堆疊，是**中性外框**，
 * 目的只是把三版隔開、讓它們在同一個底上被比較。
 * 它不是任何一版的設計決策——別讓「哪一版跟這個底色比較配」influence 選擇。
 * 若某一版的設計語言與這個底色嚴重衝突，改容器底色為中性灰再比，不要因此改那一版。
 */

const canvasStyles = {
  container: {
    minHeight: '100vh',
    background: '#F5F5F0',
    padding: '40px 60px',
    fontFamily: '-apple-system, "SF Pro Text", "PingFang TC", "PingFang SC", sans-serif',
  },
  header: {
    marginBottom: 48,
    maxWidth: 900,
  },
  title: {
    fontSize: 36,
    fontWeight: 600,
    marginBottom: 12,
    color: '#1A1A1A',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gap: 32,
  },
  cell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  cellHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    paddingBottom: 8,
    borderBottom: '1px solid #E0E0DA',
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1A1A1A',
    letterSpacing: '-0.01em',
  },
  description: {
    fontSize: 13,
    color: '#888',
  },
  frame: {
    background: '#fff',
    borderRadius: 4,
    border: '1px solid #E0E0DA',
    overflow: 'hidden',
    position: 'relative',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
  },
  frameInner: {
    position: 'relative',
    width: '100%',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    zIndex: 10,
    pointerEvents: 'none',
  },
};

function DesignCanvas({ title, subtitle, columns = 3, children }) {
  const [expanded, setExpanded] = React.useState(null);

  const gridStyle = {
    ...canvasStyles.grid,
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
  };

  return (
    <div style={canvasStyles.container}>
      {(title || subtitle) && (
        <div style={canvasStyles.header}>
          {title && <h1 style={canvasStyles.title}>{title}</h1>}
          {subtitle && <p style={canvasStyles.subtitle}>{subtitle}</p>}
        </div>
      )}

      <div style={gridStyle}>
        {React.Children.map(children, (child, idx) =>
          React.isValidElement(child)
            ? React.cloneElement(child, {
                _index: idx,
                _expanded: expanded === idx,
                _onToggle: () => setExpanded(expanded === idx ? null : idx),
              })
            : child
        )}
      </div>

      {expanded !== null && (
        <div
          onClick={() => setExpanded(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 8,
              overflow: 'hidden',
              maxWidth: '90vw',
              maxHeight: '90vh',
              position: 'relative',
            }}
          >
            {React.Children.toArray(children)[expanded]}
          </div>
        </div>
      )}
    </div>
  );
}

function Variation({ label, description, number, children, _index, _expanded, _onToggle, aspectRatio = '4 / 3' }) {
  const displayNumber = number || String(_index + 1).padStart(2, '0');

  return (
    <div style={canvasStyles.cell}>
      <div style={canvasStyles.cellHeader}>
        <span style={{ ...canvasStyles.label, color: '#999', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
          {displayNumber}
        </span>
        <span style={canvasStyles.label}>{label}</span>
        {description && <span style={canvasStyles.description}>— {description}</span>}
      </div>

      <div
        onClick={_onToggle}
        style={{
          ...canvasStyles.frame,
          aspectRatio,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={canvasStyles.frameInner}>
          {children}
        </div>
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') {
  Object.assign(window, { DesignCanvas, Variation });
}
