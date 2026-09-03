# e2e 驗證報告 — docs 站改版 F1–F22

> 執行：2026-09-01 10:24 ｜ Branch：`refactor/docs-site-redesign`
> Preview：`http://localhost:8080/`（`python -m http.server --directory docs`）
> 執行者：`frontend-e2e-runner` subagent（獨立 context，Playwright MCP）
> 本檔由主 context 依 agent 回報內容整理落檔——agent 端的規範是回文字不落檔。

## 總結

| 項 | 數 |
|---|---|
| Scenario 總數 | 26（F1–F22 共 22 ＋ N1–N4 共 4） |
| PASS | 25 |
| FAIL | 1（N3，**已修復並複驗**） |
| INCONCLUSIVE | 0 |
| 記錄不判定 | 1（N4 mobile，依指示手機行為未定義，不計入分母） |

**環境訊號**

- console：**0 error / 0 warning**
- network：45 個靜態請求全部 200、**0 個 ≥400**
- 抽屜開啟期間：**0 個 `.md` 檔請求**（F14 的關鍵證據）

## N3 FAIL 與修復

**現象**（`screenshots/n3-narrow-overlap-820x900.png`）：
820×900 視口下，釘住「型」面板 ＋ 選取節點後兩塊浮層重疊。

```
#panel  getBoundingClientRect → { x: 66,  right: 372 }
#detail getBoundingClientRect → { x: 348, right: 670 }
→ panel 右緣 372 > detail 左緣 348，重疊 24px
```

視覺後果：detail 卡片的關閉鈕「✕」與型別 badge 被 panel 右緣直接壓住。
水平溢位：無（`scrollWidth == innerWidth == 820`），純粹是兩塊浮層互蓋。

**根因**：主 context 在裁 `@media` 時誤判。定案設計自帶兩條斷點，
`@media (max-width: 1080px)` 有兩行宣告：

```css
@media (max-width: 1080px) {
  .minimap-card { display: none; }
  .detail { right: 16px; }      /* ← 讓出 134px，這才是防重疊的主力 */
}
```

主 context 只看到第一行就判定整條「貼心、非必需」而砍掉，留下 860px 那條。
但 860px 條用的是 `min(306px, 100vw - 76px)`，在 820px 算出 `min(306, 744) = 306`
——**根本不會縮**，擋不住 844px 那個重疊臨界點。

**修復**（commit `0e74a0b`）：放回 1080px 整條。複驗實測：

```
panel 右緣 = 372 ／ detail 左緣 = 482 ／ 重疊 = 無
```

契約 C15 同步改成「恰為 1080px 與 860px 兩條」，缺任一條都會紅。

## 五項已知改動的實測值

| # | baseline | 實測 |
|---|---|---|
| F2 | 整圖 fit、8% padding | `translate(42.84, 26) scale(0.534)`，對齊起點的可讀比例。整圖 bbox 實測 2039.5×12784px；若整圖 fit 在 1224×720 視口會掉到 scale≈0.09（文字不可讀） |
| F8 | 350ms ／ 下限 0.35 | **560ms ／ 下限 0.85**（原始碼確認 ＋ 實測 transform 停在 `scale(0.85)`） |
| F16 | 右下 minimap、180ms 平移 | 右緣直幅 `.minimap-card`，`.mm-viewport` 座標即時同步（實測 `(24.28, 21.48)` → `(33.78, 26.23)`）；點擊仍平移，時長 **320ms** |
| F17 | auto→light→dark | 循環與 `localStorage['dev-workflow-theme']` 同步皆正確；圖示改為「自／明／暗」單字 |
| F21 | 三句固定提示 | 無選取「點節點看 1-hop 上下游 · 滾輪縮放 · 拖曳平移」／選節點「焦點 BS · 上游 1 · 下游 1 · Esc 取消」／選型別「型別 skill 載入 · 22 個節點」 |

## 逐項結果

| # | 結果 | 關鍵實測 |
|---|---|---|
| F1 | PASS | `scaleExtent` 原始碼與實測邊界皆 `[0.04, 2.5]`；拖曳位移量精確等於拖曳距離 |
| F2 | PASS（行為已變動） | 見上表 |
| F3 | PASS | 點 `BS` → detail 開、`is-focus` 加上；再點 → 都清除 |
| F4 | PASS | `is-focus`=1 / `is-neighbor`=2 / `is-dimmed`=182 / 邊 `is-highlighted`=2；84+103=187，1+2+2+182=187 吻合。跑馬燈 `animation-name: dashmarch`、`0.72s`、`stroke-dasharray: 8px 4px` |
| F5 | PASS | `elementFromPoint` 確認命中 `svg#flow` 本體後清除 |
| F6 | PASS | (a) 抽屜開著按 ESC → 只關抽屜，`is-focus` 仍為 1；(b) 再按 → 歸零。分層正確 |
| F7 | PASS | 點「skill 載入(22)」→ 恰 22 個非 dimmed、62 個 dimmed；再點清除、84 個全恢復 |
| F8 | PASS（時長已變動） | 點 phase1 → 選取入口節點 `BS`、transform 停在 `scale(0.85)` |
| F9 | PASS | badge「skill 載入」／phase 標籤／標題／doc-card／上游·1（`DevWfSkill`）／下游·1（`Phase 0a`）全到齊 |
| F10 | PASS | 點上游項 → `is-focus` 變成 `DevWfSkill` |
| F11 | PASS | `#detail-close` → `is-focus` 歸零、detail 收起 |
| F12 | PASS | 有文件（`BS`）：先「載入中⋯」再填 description。無文件（`Start`）：顯示「無獨立文件」卡片且 `hasButton: false` |
| F13 | PASS | breadcrumb `references/skills/brainstorm`、badge、標題、description、path pill。正文 h1=**1** / h2=10 / ul·ol=7 / 含 table——來源 markdown 本身以 `# brainstorm` 開頭，若沒去掉會是 2 個 |
| F14 | PASS | 整 session 45 個請求**無任何 `.md`**；多次開抽屜（BS / write-skill / lock-files）都不產生新請求 |
| F15 | PASS | `#drawer-close`、backdrop click、ESC 三種逐一實測皆可關 |
| F16 | PASS（形態已變動） | 見上表 |
| F17 | PASS（圖示已變動） | 見上表 |
| F18 | PASS（**附限制**） | 原始碼機制正確（`matchMedia` change listener ＋ 僅 `auto` 才重套）。**工具白名單無模擬系統色彩偏好的能力**；嘗試用 `Object.defineProperty` 偽造 `matches` ＋ 派假 change 事件，發現 app 每次都重新呼叫 `window.matchMedia(...)` 讀即時真值——這證明沒有快取舊值的 bug，但這項動態行為**本次沒有被真正跑過**，只有靜態佐證。要動態驗需要 CDP `Emulation.setEmulatedMedia` 等級的工具 |
| F19 | PASS | inline script 在 CSS 連結之前；navigate 返回時 `data-theme` / `data-theme-mode` 已就緒 |
| F20 | PASS（觸發已變動） | 強制守則 **9 條**（`.row.is-static`、`cursor: default`、不可點）：§Task 追蹤 / §決策點選單 / §Branch safety / §File-type 硬規則 / §PII 安全底線 / §DB 操作 / §Trace 標籤 / §Auto-fix / §Fail handling。跨流程 skill **5 個**（`.row`、`cursor: pointer`）：lock-files / cmd-guard / context-snapshot / context-resume / write-skill。點 lock-files → 抽屜開啟 |
| F21 | PASS（文字已變動） | 見上表 |
| F22 | PASS | light 八型別 fill/stroke 皆不同 hue 的 oklch；dark 重新採樣（fill L≈0.28–0.31、stroke 提亮），hue 跨主題一致 |
| N1 | PASS | 「Skills·27」＋「Agents·6」＝ 33 項；點 write-skill → 抽屜開啟 |
| N2 | PASS | 未釘住 → 選節點面板自動收起；釘住後 → 面板維持 open、detail 同時開啟 |
| N3 | **FAIL → 已修復** | 見上方專節 |
| N4 | 記錄不判定 | 390×844：無水平溢位；面板佔滿視口大半、detail 被壓成極窄一條、rail 的「置」「自」被推到視口底部邊緣。皆為未定義行為下的自然結果 |

## Agent 回報的意外發現（主 context 處置）

| # | 發現 | 處置 |
|---|---|---|
| 1 | rail「檔」的 `data-label` 寫「文件索引（31）」，面板實際列 33 項 | **已修**（`0e74a0b`）：改成從 `Object.keys(NODE_DOCS).length` 算 |
| 2 | baseline 缺口 1 改版後依然存在（點 `LoadDLang` 顯示「無獨立文件」） | **符合預期**，維持未修。移植來源曾自行補上這兩筆，已刻意移除 |
| 3 | Skills 面板計數 27 比 baseline 記載的「25 個 skill」多 2 | **非缺陷**：多的是 `RPT2` / `RPT3`（`k: 'skill'`），本來就在 `NODE_DOCS` 裡。25 skill + 2 RPT = 27，加 6 agent = 33 |

## PII

截圖內容為流程圖節點文字、CLAUDE.md 規則摘要、skill/agent 文件片段，**無 PII**，未套 mask。
console 0 筆；network 45 個請求皆靜態資源，URL 與 response 皆無 PII。

## Evidence

- `screenshots/`（15 張，命名含 scenario id）
- `console-all.txt`
- `network-all.txt`
