/**
 * bstack — dev-workflow flowchart 結構化資料
 *
 * 來源：CLAUDE.md 強制守則 + 9 階段流程 + skills/* + agents/*
 *
 * 節點型別（對應 styles.css 的 --c-* tokens）：
 *   gate    - USER GATE（黃）
 *   agent   - subagent 派遣（藍）
 *   stop    - 強制暫停 / abort（紅）
 *   skill   - skill 載入（綠）
 *   policy  - 主線仲裁 / CLAUDE.md 強制守則（灰）
 *   impl    - AI 實際寫 code / 操作（紫）
 *   hook    - Hook 攔截點（橙）
 *   default - 一般流程（無 classDef）
 *
 * 形狀：
 *   stadium - 圓角膠囊 (Start / End)
 *   diamond - 決策菱形
 *   rect    - 一般矩形
 */
const FLOW_DATA = {
  /**
   * Phase 分組（給可摺疊 phase block + legend 用）
   * order 決定 legend 垂直順序（不影響 dagre layout）
   */
  phases: [
    { id: 'prelude',      label: '前導：user prompt + 強制守則',       order: -2 },
    { id: 'hook',         label: 'PreToolUse hooks',                    order: -1 },
    { id: 'phase0',       label: 'Phase 1：brainstorm + Phase 0 分流',  order: 0  },
    { id: 'phase_split',  label: 'Track / Tier 分流',                   order: 1  },
    { id: 'phase_t0',     label: 'T0 直送',                             order: 1.5 },
    { id: 'phase_design',  label: 'Phase 1.5：design-direction（大改路徑）', order: 1.8 },
    { id: 'phase_plan',   label: 'Phase 2：write-plan + review-plan',   order: 2  },
    { id: 'phase_bug',    label: 'Phase 3 (Bug)：debug-systematic',     order: 3  },
    { id: 'phase_exec',   label: 'Phase 3 (Dev)：execute-plan + TDD',   order: 3.5 },
    { id: 'phase_verify', label: 'Phase 4：verify-done',                order: 4  },
    { id: 'phase_review', label: 'Phase 5：request-review + receive',   order: 5  },
    { id: 'phase_sec',    label: 'Phase 6：security-audit + checklist', order: 6  },
    { id: 'phase_finish', label: 'Phase 7：finish-branch',              order: 7  },
    { id: 'phase_pr',     label: 'Phase 8：pr-explain',                 order: 8  },
    { id: 'phase_retro',  label: 'Phase 9：retro（手動）',              order: 9  },
  ],

  /**
   * 節點清單（id → 屬性）
   * label 用 \n 分行
   */
  nodes: {
    // ───────── prelude ─────────
    Start:        { phase: 'prelude', type: 'default', shape: 'stadium', label: 'user prompt' },
    ClaudeMd:     { phase: 'prelude', type: 'policy',  shape: 'rect',    label: 'CLAUDE.md 強制守則仲裁\n優先於任何 skill' },
    DevWfSkill:   { phase: 'prelude', type: 'skill',   shape: 'rect',    label: '載入 skill：dev-workflow\n（寫 / 改 / 修 / 加類 prompt 必載）' },

    // ───────── hooks ─────────
    HBranch:      { phase: 'hook', type: 'hook', shape: 'rect',    label: 'branch-safety.ps1 hook\nPreToolUse: Write / Edit / NotebookEdit' },
    HFile:        { phase: 'hook', type: 'hook', shape: 'rect',    label: 'file-type-guard.ps1 hook\n密鑰 / migration / lockfile / CI / infra' },
    StopBranch:   { phase: 'hook', type: 'stop', shape: 'rect',    label: 'STOP：命中 main / master / production\n→ AskUserQuestion 取 branch 名 → checkout' },
    StopFile:     { phase: 'hook', type: 'stop', shape: 'rect',    label: 'STOP：密鑰 / .env 禁 commit\n→ block；其他類型 → 二次確認' },

    // ───────── phase 0：brainstorm ─────────
    BS:           { phase: 'phase0', type: 'skill',   shape: 'rect',    label: '載入 skill：brainstorm' },
    P0a:          { phase: 'phase0', type: 'default', shape: 'rect',    label: 'Phase 0a：對話釐清\nparaphrase 確認 / 反問補足' },
    MemRead:      { phase: 'phase0', type: 'policy',  shape: 'rect',    label: '§Memory hook（讀）\nuser 偏好 / 領域 / 過去決策' },
    P0b:          { phase: 'phase0', type: 'default', shape: 'rect',    label: 'Phase 0b：看 codebase\nRead / Grep 影響檔 + 列 dep' },
    DBKW:         { phase: 'phase0', type: 'default', shape: 'diamond', label: '含 DB / SQL / schema /\nmigration 等關鍵詞？' },
    LoadDB:       { phase: 'phase0', type: 'skill',   shape: 'rect',    label: '載入 skill：db-access\n（mysql MCP 唯讀規範）' },
    P0c:          { phase: 'phase0', type: 'gate',    shape: 'diamond', label: 'Phase 0c：Track 判定\nAskUserQuestion: Bug / Dev' },
    P0d:          { phase: 'phase0', type: 'gate',    shape: 'diamond', label: 'Phase 0d：Tier 判定\nAskUserQuestion: T0 / T1 / T2 / T3' },
    LoadDLang:    { phase: 'phase0', type: 'skill',   shape: 'rect',    label: '載入 skill：design-language\nPhase 0b′ 必跑（第 1 步是零成本副檔名比對）' },
    DesignQ:      { phase: 'phase0', type: 'default', shape: 'diamond', label: '改動檔含前端副檔名？\n.css .scss .tsx .jsx .vue .svelte .html' },
    DesignMap:    { phase: 'phase0', type: 'default', shape: 'rect',    label: '查 design-map.md + 失效檢查\n得 scope / scope_evidence / size' },
    P0Design:     { phase: 'phase0', type: 'gate',    shape: 'diamond', label: '合併確認第 3 題：設計路徑\n（involved=true 且 size=大改 才出現）' },

    // ───────── Track / Tier 分流 ─────────
    TierSplit:    { phase: 'phase_split', type: 'default', shape: 'diamond', label: '依 Tier 分流' },
    TrackSplit:   { phase: 'phase_split', type: 'default', shape: 'diamond', label: 'T1+：依 Track 分流' },

    // ───────── T0 直送 ─────────
    T0Impl:       { phase: 'phase_t0', type: 'impl', shape: 'rect', label: 'T0 直接實作\n跳 plan / TDD / review / security' },

    // ───────── Phase 1.5：design-direction（僅 involved=true 且 size=大改）─────────
    LoadDD:       { phase: 'phase_design', type: 'skill',  shape: 'rect',    label: '載入 skill：design-direction\n§使用契約 3.5：branch + spec 建立後才載' },
    ThreeWay:     { phase: 'phase_design', type: 'agent',  shape: 'rect',    label: '3 個 subagent 各出一版\n真實內容 + 三版共用同一輸出尺寸' },
    DemoIgnore:   { phase: 'phase_design', type: 'policy', shape: 'rect',    label: 'design-demos/ 不進版控\n.gitignore 的 **/design-demos/' },
    UGDesign:     { phase: 'phase_design', type: 'gate',   shape: 'diamond', label: 'USER GATE：選定方向\n回寫 spec.md 的 direction_decided' },
    RerunCap:     { phase: 'phase_design', type: 'gate',   shape: 'diamond', label: '重跑上限 1 次\n第 2 次仍全否 → AskUserQuestion：\nuser 描述方向做一版 / 退回 brainstorm / 暫停' },

    // ───────── Phase 2：write-plan + review-plan（Dev only）─────────
    LoadWP:       { phase: 'phase_plan', type: 'skill',   shape: 'rect',    label: '載入 skill：write-plan' },
    WritePlan:    { phase: 'phase_plan', type: 'impl',    shape: 'rect',    label: '寫 docs/work/<branch-name>/plan.md\nbite-sized task + 並行性分析' },
    LoadRP:       { phase: 'phase_plan', type: 'skill',   shape: 'rect',    label: '載入 skill：review-plan' },
    RPSplit:      { phase: 'phase_plan', type: 'default', shape: 'diamond', label: '依 Tier 分視角\n（review-plan 只定義 T2 / T3）' },
    RPT2:         { phase: 'phase_plan', type: 'agent',   shape: 'rect',    label: 'T2：Eng-only review\n（spawn subagent 評 plan）' },
    RPT3:         { phase: 'phase_plan', type: 'agent',   shape: 'rect',    label: 'T3：4 視角\nCEO + Design + Eng + DX' },
    UG1:          { phase: 'phase_plan', type: 'gate',    shape: 'diamond', label: 'USER GATE 1\nAskUserQuestion: 核准 plan？' },
    FixPlan:      { phase: 'phase_plan', type: 'default', shape: 'rect',    label: '依回饋修 plan' },

    // ───────── Phase 3 (Bug)：debug-systematic ─────────
    LoadDebug:    { phase: 'phase_bug', type: 'skill', shape: 'rect',    label: '載入 skill：debug-systematic' },
    BugFlow:      { phase: 'phase_bug', type: 'impl',  shape: 'rect',    label: 'Triage → Reproduce → Min Repro\n→ Fix → 防回歸測試' },
    IncidentQ:    { phase: 'phase_bug', type: 'default', shape: 'diamond', label: 'T2+ 跨系統 / production 異常 /\nintermittent / flaky？' },
    LoadIncident: { phase: 'phase_bug', type: 'skill', shape: 'rect',    label: '載入 skill：incident-investigate' },
    HypAgent:     { phase: 'phase_bug', type: 'agent', shape: 'rect',    label: '派 agent：hypothesis-tester\n≥3 假設並行 fan-out' },

    // ───────── Phase 3 (Dev)：execute-plan + TDD ─────────
    LoadExec:     { phase: 'phase_exec', type: 'skill',   shape: 'rect',    label: '載入 skill：execute-plan' },
    LoadTDD:      { phase: 'phase_exec', type: 'skill',   shape: 'rect',    label: '載入 skill：tdd-cycle' },
    ParaQ:        { phase: 'phase_exec', type: 'default', shape: 'diamond', label: '遇 parallel-group >1 task？' },
    LoadDispatch: { phase: 'phase_exec', type: 'skill',   shape: 'rect',    label: '載入 skill：dispatch-parallel\n（spawn 多 subagent）' },
    CollabGate:   { phase: 'phase_exec', type: 'gate',    shape: 'diamond', label: '§協作模式判定：三判準全中才提議\nAskUserQuestion：Agent Teams / subagent 平行 / 串行\n唯讀 fan-out 一律 subagent、不開隊友也不問' },
    TDDLoop:      { phase: 'phase_exec', type: 'impl',    shape: 'rect',    label: '紅綠循環：RED → GREEN → REFACTOR\n逐 task commit' },
    MidPivotQ:    { phase: 'phase_exec', type: 'default', shape: 'diamond', label: '§Task 推進規則 第 2 步：要動的檔\n都在 codebase_impact.files 內？' },
    AlignQ:       { phase: 'phase_exec', type: 'default', shape: 'diamond', label: '本 task 動到前端檔？\ndesign.involved=true 且 size=小改' },
    AlignChk:     { phase: 'phase_exec', type: 'impl',    shape: 'rect',    label: 'task 前後載 design-language\n四項對齊：元件狀態 / 斷點 / 表單 / dark mode\n該區客觀上無此維度 → 標 N/A 並附依據' },
    MidPivot:     { phase: 'phase_exec', type: 'gate',    shape: 'diamond', label: '§前端檔處理（中途轉進）\n暫停 → 補判 → 六選項 → 記 design_rejudge' },

    // ───────── Phase 4：verify-done ─────────
    LoadVerify:   { phase: 'phase_verify', type: 'skill',   shape: 'rect',    label: '載入 skill：verify-done' },
    VerifyRun:    { phase: 'phase_verify', type: 'impl',    shape: 'rect',    label: 'test / lint / build / type-check\nT2+ 多輪' },
    UIQ:          { phase: 'phase_verify', type: 'default', shape: 'diamond', label: 'T3 + UI 改動？' },
    LoadFE:       { phase: 'phase_verify', type: 'skill',   shape: 'rect',    label: '載入 skill：frontend-test' },
    FEAgent:      { phase: 'phase_verify', type: 'agent',   shape: 'rect',    label: '派 agent：frontend-e2e-runner\n（Playwright 隔離 context）' },
    LeakQ:        { phase: 'phase_verify', type: 'default', shape: 'diamond', label: '§使用契約 2.5 漏網複查（全 Tier）\n實改含前端檔但 involved=false / scope 對不上？' },
    LeakRecheck:  { phase: 'phase_verify', type: 'impl',    shape: 'rect',    label: '重跑 design-language 判定 + 四項對齊檢查\n已在 design_rejudge 的檔不重複觸發' },
    TextQ:        { phase: 'phase_verify', type: 'default', shape: 'diamond', label: '§使用契約 2.6 對外文字複查（全 Tier）\n本輪改到 README / release notes / 使用文件？\n排除 docs/work/ 與 docs/archive/（施工文件不算）' },
    LoadZhH:      { phase: 'phase_verify', type: 'skill',   shape: 'rect',    label: '載入 skill：zh-humanize\n走「被 verify-done 自動載入」路徑\n只負責列清單；改不改不在 verify-done 做' },

    // ───────── Phase 5：request-review + receive-review ─────────
    LoadReq:      { phase: 'phase_review', type: 'skill',   shape: 'rect',    label: '載入 skill：request-review' },
    ReviewQ:      { phase: 'phase_review', type: 'default', shape: 'diamond', label: '依 Tier 分流' },
    RevT1:        { phase: 'phase_review', type: 'impl',    shape: 'rect',    label: 'T1：self review' },
    RevT2:        { phase: 'phase_review', type: 'agent',   shape: 'rect',    label: 'T2：subagent + lang-reviewer' },
    RevT3:        { phase: 'phase_review', type: 'agent',   shape: 'rect',    label: 'T3：雙視角 subagent\n（架構 × 除錯）+ lang-reviewer' },
    LangAgent:    { phase: 'phase_review', type: 'agent',   shape: 'rect',    label: '派 agent：lang-reviewer\n（依副檔名 dispatch 語言）' },
    LoadRecv:     { phase: 'phase_review', type: 'skill',   shape: 'rect',    label: '載入 skill：receive-review' },
    AutoFixQ:     { phase: 'phase_review', type: 'default', shape: 'diamond', label: '危險類問題？\n（DB / 認證 / payment / infra）' },
    AutoFix:      { phase: 'phase_review', type: 'impl',    shape: 'rect',    label: '不危險：AI 自動修\n（typo / lint / 格式 / rename）' },
    AskFix:       { phase: 'phase_review', type: 'gate',    shape: 'diamond', label: '危險：AskUserQuestion\n問該不該修 / 怎麼修' },

    // ───────── Phase 6：security-audit + checklist + db-reviewer ─────────
    SecQ:         { phase: 'phase_sec', type: 'default', shape: 'diamond', label: '觸發 security？\nT2 涉認證 / 資料層；T3 必跑' },
    LoadSec:      { phase: 'phase_sec', type: 'skill',   shape: 'rect',    label: '載入 skill：security-audit' },
    SecAgent:     { phase: 'phase_sec', type: 'agent',   shape: 'rect',    label: '派 agent：security-auditor\nOWASP Top 10 + STRIDE + PII 檢查' },
    LoadChk:      { phase: 'phase_sec', type: 'skill',   shape: 'rect',    label: '載入 skill：security-checklist\n（T3 必跑）' },
    DBQ:          { phase: 'phase_sec', type: 'default', shape: 'diamond', label: 'T3 涉 DB schema / migration？' },
    DBAgent:      { phase: 'phase_sec', type: 'agent',   shape: 'rect',    label: '派 agent：db-reviewer\nschema / index / migration 安全' },

    // ───────── Phase 7：finish-branch ─────────
    LoadFin:      { phase: 'phase_finish', type: 'skill', shape: 'rect',    label: '載入 skill：finish-branch' },
    Commit:       { phase: 'phase_finish', type: 'impl',  shape: 'rect',    label: '寫 commit（繁中 type:subject 格式）\n受 §File-type 硬規則把關' },
    LoadSafety:   { phase: 'phase_finish', type: 'skill', shape: 'rect',    label: '載入 skill：safety-guard\n（commit 前掃 PII / 密鑰）' },
    PushPR:       { phase: 'phase_finish', type: 'impl',  shape: 'rect',    label: 'push --force-with-lease\ngh pr create（繁中 PR body）' },
    MergeGate:    { phase: 'phase_finish', type: 'gate',  shape: 'diamond', label: 'User Gate：授權 auto-merge？\n預設交 user merge' },
    Squash:       { phase: 'phase_finish', type: 'impl',  shape: 'rect',    label: 'squash merge 回 main\nremote feature branch 自動刪' },

    // ───────── Phase 8：pr-explain ─────────
    LoadPrEx:     { phase: 'phase_pr', type: 'skill', shape: 'rect',    label: '載入 skill：pr-explain' },
    PrExAgent:    { phase: 'phase_pr', type: 'agent', shape: 'rect',    label: '派 agent：pr-explainer\n獨立 context 重讀 diff' },
    DocsReviews:  { phase: 'phase_pr', type: 'impl',  shape: 'rect',    label: '落 docs/work/<branch-name>/pr-review.md\n為何 + 怎做 + 關聯' },
    PostComment:  { phase: 'phase_pr', type: 'impl',  shape: 'rect',    label: '貼到 PR comment' },
    End:          { phase: 'phase_pr', type: 'default', shape: 'stadium', label: '主流程完' },

    // ───────── Phase 9：retro（手動）─────────
    LoadRetro:    { phase: 'phase_retro', type: 'skill',  shape: 'rect', label: '載入 skill：retro\n（user 主動觸發）' },
    RetroPeriod:  { phase: 'phase_retro', type: 'gate',   shape: 'diamond', label: 'AskUserQuestion：期間？\n本週 / 本月 / 自上次 retro' },
    RetroAnalyze: { phase: 'phase_retro', type: 'impl',   shape: 'rect', label: '分析 git log + PR + TaskList\n抽反覆模式' },
    MemUpdate:    { phase: 'phase_retro', type: 'policy', shape: 'rect', label: '§Memory hook（補）\n產 memory proposal → user review' },

  },

  /**
   * Edges：[from, to, label?, kind?]
   * kind：'solid'（預設）/ 'dashed'（hook / 旁線 / optional）
   */
  edges: [
    // prelude
    ['Start',        'ClaudeMd',     '',                           'solid'],
    ['ClaudeMd',     'DevWfSkill',   '寫 / 改 / 修 / 加',          'solid'],
    ['DevWfSkill',   'HBranch',      '寫入動作前',                  'dashed'],
    ['DevWfSkill',   'HFile',        'commit / 改特定檔',           'dashed'],
    ['DevWfSkill',   'BS',           '進主流程',                    'solid'],

    // hooks 旁線
    ['HBranch',      'StopBranch',   '命中 protected branch',       'solid'],
    ['HFile',        'StopFile',     '密鑰 / 敏感檔',               'solid'],

    // phase 0
    ['BS',           'P0a',          '',                            'solid'],
    ['P0a',          'MemRead',      'Memory hook',                 'dashed'],
    ['P0a',          'P0b',          '',                            'solid'],
    ['P0b',          'DBKW',         '',                            'solid'],
    ['DBKW',         'LoadDB',       'yes',                         'solid'],
    ['DBKW',         'LoadDLang',    'no',                          'solid'],
    ['LoadDB',       'LoadDLang',    '',                            'solid'],
    ['P0c',          'P0d',          'Track 確認',                  'solid'],
    ['P0d',          'P0Design',     '同一個 AskUserQuestion',      'solid'],
    ['P0Design',     'TierSplit',    'Track / Tier / 設計路徑 一次確認', 'solid'],

    // T0 直送
    ['TierSplit',    'T0Impl',       'T0',                          'solid'],
    ['T0Impl',       'Commit',       '直接 commit',                 'solid'],

    // T1+ → Track 分流
    ['TierSplit',    'TrackSplit',   'T1 / T2 / T3',                'solid'],

    // Bug Track
    ['TrackSplit',   'LoadDebug',    'Bug',                         'solid'],
    ['LoadDebug',    'BugFlow',      '',                            'solid'],
    ['BugFlow',      'IncidentQ',    '',                            'solid'],
    ['IncidentQ',    'LoadIncident', 'yes',                         'solid'],
    ['LoadIncident', 'HypAgent',     '≥3 假設',                     'solid'],
    ['HypAgent',     'LoadVerify',   '',                            'solid'],
    ['IncidentQ',    'LoadVerify',   'no',                          'solid'],

    // Dev Track
    // T1 依 CLAUDE.md §Tier 機制「plan：跳」直送 execute-plan——review-plan 也只定義
    // T2 / T3 視角，T1 進了 Phase 2 會無視角可派。
    ['TrackSplit',   'LoadExec',     'Dev + T1\n跳 Phase 2（CLAUDE.md §Tier：plan 跳）', 'solid'],
    ['TrackSplit',   'LoadWP',       'Dev + T2 / T3',               'solid'],
    ['LoadWP',       'WritePlan',    '',                            'solid'],
    ['WritePlan',    'LoadRP',       '',                            'solid'],
    ['LoadRP',       'RPSplit',      '',                            'solid'],
    ['RPSplit',      'RPT2',         'T2',                          'solid'],
    ['RPSplit',      'RPT3',         'T3',                          'solid'],
    ['RPT2',         'UG1',          '',                            'solid'],
    ['RPT3',         'UG1',          '',                            'solid'],
    ['UG1',          'FixPlan',      'reject',                      'solid'],
    ['FixPlan',      'WritePlan',    '',                            'solid'],
    ['UG1',          'LoadExec',     'accept',                      'solid'],
    ['LoadExec',     'LoadTDD',      '',                            'solid'],
    ['LoadTDD',      'ParaQ',        '',                            'solid'],
    ['ParaQ',        'LoadDispatch', 'yes',                         'solid'],
    ['LoadDispatch', 'CollabGate',   '',                            'solid'],
    ['CollabGate',   'MidPivotQ',    '選定跑法後派工',               'solid'],
    ['ParaQ',        'MidPivotQ',    'no',                          'solid'],
    ['TDDLoop',      'LoadVerify',   '',                            'solid'],

    // verify
    ['LoadVerify',   'VerifyRun',    '',                            'solid'],
    ['VerifyRun',    'LeakQ',        '',                            'solid'],
    ['UIQ',          'LoadFE',       'T3 + UI',                     'solid'],
    ['LoadFE',       'FEAgent',      '',                            'solid'],
    ['FEAgent',      'TextQ',        '',                            'solid'],
    ['UIQ',          'TextQ',        '否',                          'solid'],
    ['TextQ',        'LoadZhH',      'yes',                         'solid'],
    ['LoadZhH',      'LoadReq',      '列清單交 user 定',            'solid'],
    ['TextQ',        'LoadReq',      'no',                          'solid'],


    // 設計 lane：Phase 0b′ 判定（純後端在 DesignQ 就結束）
    ['LoadDLang',    'DesignQ',      '',                            'solid'],
    ['DesignQ',      'P0c',          'no：involved=false，到此為止', 'solid'],
    ['DesignQ',      'DesignMap',    'yes',                         'solid'],
    ['DesignMap',    'P0c',          '六欄位進 hand-off state',      'solid'],

    // 設計 lane：三方向（Dev + 大改；小改與豁免走原路）
    ['TrackSplit',   'LoadDD',       'Dev + 大改\n第 3 題選「出三版」',        'solid'],
    ['TrackSplit',   'LoadWP',       'Dev + 大改\n第 3 題選「跳過三方向」\n理由記入 spec.md', 'solid'],
    ['LoadDD',       'ThreeWay',     '',                            'solid'],
    ['ThreeWay',     'DemoIgnore',   '產出落 design-demos/',         'dashed'],
    ['ThreeWay',     'UGDesign',     '',                            'solid'],
    ['UGDesign',     'ThreeWay',     '都不要：重出三版\n（上限 1 次）',  'solid'],
    ['UGDesign',     'RerunCap',     '第 2 次仍全否',                'solid'],
    ['RerunCap',     'LoadWP',       'user 描述方向 → 做一版',       'solid'],
    ['RerunCap',     'BS',           '退回 brainstorm 重釐清',       'dashed'],
    ['UGDesign',     'LoadWP',       '選定：write-plan 2.5 讀定案',  'solid'],

    // 設計 lane：execute-plan 中途轉進
    ['MidPivotQ',    'MidPivot',     '有前端檔不在清單',              'solid'],
    ['MidPivot',     'LoadDD',       '轉進三方向',                   'solid'],
    ['MidPivot',     'TDDLoop',      '縮回小改 / 撤掉 / 記技術債\n接回第 3 步，不重跑紅綠', 'solid'],

    // 設計 lane：verify-done 漏網複查
    ['LeakQ',        'LeakRecheck',  'yes',                         'solid'],
    ['LeakRecheck',  'UIQ',          '',                            'solid'],
    ['MidPivotQ',    'AlignQ',       '全在清單內',                   'solid'],
    ['AlignQ',       'AlignChk',     'yes',                         'solid'],
    ['AlignChk',     'TDDLoop',      '',                            'solid'],
    ['AlignQ',       'TDDLoop',      'no（純後端 task）',            'solid'],
    ['LeakQ',        'UIQ',          'no',                          'solid'],

    // review
    ['LoadReq',      'ReviewQ',      '',                            'solid'],
    ['ReviewQ',      'RevT1',        'T1',                          'solid'],
    ['ReviewQ',      'RevT2',        'T2',                          'solid'],
    ['ReviewQ',      'RevT3',        'T3',                          'solid'],
    ['RevT2',        'LangAgent',    '',                            'solid'],
    ['RevT3',        'LangAgent',    '',                            'solid'],
    ['LangAgent',    'LoadRecv',     '',                            'solid'],
    ['RevT1',        'LoadRecv',     '',                            'solid'],
    ['LoadRecv',     'AutoFixQ',     '',                            'solid'],
    ['AutoFixQ',     'AutoFix',      '不危險',                      'solid'],
    ['AutoFixQ',     'AskFix',       '危險',                        'solid'],
    ['AutoFix',      'SecQ',         '',                            'solid'],
    ['AskFix',       'SecQ',         '',                            'solid'],

    // security
    ['SecQ',         'LoadSec',      '觸發',                        'solid'],
    ['SecQ',         'LoadFin',      '否（T1 / T2 未涉）',          'solid'],
    ['LoadSec',      'SecAgent',     '',                            'solid'],
    ['SecAgent',     'LoadChk',      'T3',                          'solid'],
    ['SecAgent',     'LoadFin',      'T2 通過',                     'solid'],
    ['LoadChk',      'DBQ',          '',                            'solid'],
    ['DBQ',          'DBAgent',      'T3 + DB',                     'solid'],
    ['DBAgent',      'LoadFin',      '',                            'solid'],
    ['DBQ',          'LoadFin',      '否',                          'solid'],

    // finish
    ['LoadFin',      'Commit',       '',                            'solid'],
    ['Commit',       'LoadSafety',   'commit 前掃描',               'dashed'],
    ['Commit',       'PushPR',       '',                            'solid'],
    // pr-explain 接在「PR 開好」之後，不是接在 merge 之後：finish-branch 使用契約
    // 第 6 步是「印 PR URL + 交棒 pr-explain」，且明訂 merge 由 user 觸發、預設不自動
    // merge。掛在 Squash 後面會讓「交 user 自行 merge」這條預設路徑跳過整個 Phase 8。
    ['PushPR',       'LoadPrEx',     'PR 開好即交棒',               'solid'],

    // pr-explain
    ['LoadPrEx',     'PrExAgent',    '',                            'solid'],
    ['PrExAgent',    'DocsReviews',  '',                            'solid'],
    ['DocsReviews',  'PostComment',  '',                            'solid'],
    ['PostComment',  'MergeGate',    '',                            'solid'],
    ['MergeGate',    'Squash',       'user 授權',                   'solid'],
    ['MergeGate',    'End',          '交 user 自行 merge',          'solid'],
    ['Squash',       'End',          '',                            'solid'],

    // retro（手動，不接 End）
    ['LoadRetro',    'RetroPeriod',  '',                            'solid'],
    ['RetroPeriod',  'RetroAnalyze', '',                            'solid'],
    ['RetroAnalyze', 'MemUpdate',    '',                            'solid'],
  ],

  /**
   * Ambient（圖外）規則 / skill：環境性、非流程步驟。
   * 之前畫在主圖卻無 edge 連接，造成「孤島 node」。
   * 改放 sidebar 區塊，明示這些不在主線、但全程適用 / 按需載入。
   *
   * 結構：每組 { id, title, desc, kind, items[] }
   * - kind='policy' → items 不可點（CLAUDE.md 章節，無獨立 doc）
   * - kind='skill'  → items 有 docKey，可點開 doc drawer（對應 NODE_DOCS / REFERENCE_DOCS）
   */
  ambient: [
    {
      id: 'policy',
      title: 'CLAUDE.md 強制守則',
      desc: '優先於任何 skill；環境規則，全程適用、非流程步驟',
      kind: 'policy',
      items: [
        { name: '§事實核實',      desc: '最高指導原則：儲存實資料 + codebase 使用點雙 source' },
        { name: '§Task 追蹤',     desc: 'TaskCreate / TaskUpdate' },
        { name: '§決策點選單',   desc: 'AskUserQuestion；禁文字 token NLP 當 gate' },
        { name: '§Branch safety', desc: 'PreToolUse hook 擋 protected branch' },
        { name: '§File-type 硬規則', desc: '密鑰 / migration / lockfile / CI / infra' },
        { name: '§PII 安全底線',  desc: 'email / phone / 身分證 / 信用卡' },
        { name: '§DB 操作',       desc: 'mcp__mysql 唯讀 / DDL 交 user 跑' },
        { name: '§設計語言對齊',  desc: '動前端檔前先讀該區既有設計語言、抄 exact values' },
        { name: '§Docs 落檔',     desc: 'docs/work/<branch-name>/；按壽命分不按類型分' },
      ],
    },
    {
      id: 'devflow',
      title: '開發流程政策',
      desc: 'CLAUDE.md「開發流程」章節；決定流程怎麼跑，本身不是流程步驟',
      kind: 'policy',
      items: [
        { name: '§Tier 機制',     desc: 'T0-T3 決定 brainstorm / plan / TDD / review / security 深度' },
        { name: '§協作模式判定',  desc: 'Agent Teams gate：三判準全中才提議；唯讀 fan-out 一律 subagent' },
        { name: '§Trace 標籤',    desc: '每輪結尾 Phase / Tier / Track / Skill' },
        { name: '§Auto-fix',      desc: '不危險自動修 / 危險問 user' },
        { name: '§Fail handling', desc: '不靜默重試 → AskUserQuestion 5 選' },
        { name: '§Settings.json', desc: 'permissions.allow 僅限唯讀 / 查詢類' },
      ],
    },
    {
      id: 'crosscut',
      title: '跨流程 skill（按需載入）',
      desc: 'user 顯式觸發或特定情境載入；多數不在主線（zh-humanize 例外，見下）',
      kind: 'skill',
      items: [
        { name: 'lock-files',       docKey: 'LoadLock',  desc: 'user 顯式鎖檔禁改' },
        { name: 'cmd-guard',        docKey: 'LoadCmdG',  desc: 'rm -rf / drop / force push 前防呆' },
        { name: 'context-snapshot', docKey: 'LoadCtxS',  desc: '中斷 / 跨 session 暫停存進度' },
        { name: 'context-resume',   docKey: 'LoadCtxR',  desc: '接續上次進度' },
        { name: 'write-skill',      docKey: 'LoadWS',    desc: 'meta：新增 / 改 skill' },
        { name: 'zh-humanize',      docKey: 'LoadZhH',   desc: '去中文的 AI 味、校正中國用語與半形標點；verify-done 2.6 對外文字複查會自動載入它，主圖上有節點' },
      ],
    },
  ],

  /**
   * Node type legend（給左側 legend 渲染用，依宣告順序顯示）
   */
  legend: [
    { type: 'default', label: '一般流程' },
    { type: 'skill',   label: 'skill 載入' },
    { type: 'agent',   label: 'subagent 派遣' },
    { type: 'gate',    label: 'USER GATE / 決策' },
    { type: 'impl',    label: 'AI 實作 / 操作' },
    { type: 'policy',  label: 'CLAUDE.md 強制守則' },
    { type: 'hook',    label: 'PreToolUse hook' },
    { type: 'stop',    label: 'STOP / abort' },
  ],
};

// 向下相容 app.js 的 FLOW_DATA_VERSIONS 機制
window.FLOW_DATA = FLOW_DATA;

// ── 上下游 / 邊查詢 helper（供 detail panel 上下游清單用）──
function getUpstream(nodeId) {
  return FLOW_DATA.edges.filter(([, to]) => to === nodeId).map(([from]) => from);
}
function getDownstream(nodeId) {
  return FLOW_DATA.edges.filter(([from]) => from === nodeId).map(([, to]) => to);
}
function getAdjacentEdges(nodeId) {
  return FLOW_DATA.edges
    .map((e, i) => ({ id: `e${i}`, from: e[0], to: e[1], label: e[2], kind: e[3] }))
    .filter(e => e.from === nodeId || e.to === nodeId);
}
window.getUpstream = getUpstream;
window.getDownstream = getDownstream;
window.getAdjacentEdges = getAdjacentEdges;
