# spec: 收斂 Agent Teams 觸發點

> Branch: `docs/agent-teams-gate` | Track: Dev | Tier: T1

## 問題

`CLAUDE.md` §協作模式判定 列了四個 Agent Teams 觸發點：`dispatch-parallel` 載入時、`incident-investigate` Test fan-out 前、`request-review` T3 雙視角前、brainstorm 0d。

查證後有兩層問題：

1. **後三個沒實作**。`skills/incident-investigate/SKILL.md`、`skills/request-review/SKILL.md`、`skills/brainstorm/SKILL.md` 內文完全沒有「Agent Teams」「協作模式」「dispatch-parallel」字樣（brainstorm 零命中）。觸發點只存在於 CLAUDE.md，實際會不會跑取決於當下有沒有讀到那段 → 不可靠。
2. **後三個不該實作**。它們全是唯讀 fan-out，開隊友會讓產出變差：
   - `incident-investigate/SKILL.md:126` 派工模板第一句是「你只看到這一條、**不知道別的**」，`:17` 明講 fan-out 目的是「避免主 context 對假設間判斷的交叉污染」。互相講話 = 拆掉唯一設計紅利。
   - `request-review` T3 只有 2 塊（架構 × 除錯），判準第 1 條（≥3）本來就不過；且 `:230` 自陳要的是不會自我合理化的獨立視角。
   - brainstorm 0d 時 spec 未定案，可切的塊還不存在。

## 判準本身的缺口

判準 1「每塊擁有不同檔案 / 目錄」的實質是防兩個隊友互蓋（`dispatch-parallel/SKILL.md:125`）——**這風險只在寫入型工作存在**。唯讀 review / 驗證套不上這條，過去因此留下「四視角 review 看起來三條全中」的誤判空間。

`review-plan` T3 四視角是字面上唯一成立的候選，仍不採用：`review-plan/SKILL.md:154` 的「Critical 共識（多視角同時提）」已用事後去重達成廉價版互相反駁，成本約 1/4；真正收斂點是 `:181` 的 user gate。

## 改動

| 檔 | 改動 |
|---|---|
| `CLAUDE.md` §協作模式判定 | 觸發點收斂成只有 `execute-plan` 遇 `parallel-group` 多 task；新增硬規則「唯讀 fan-out 一律 subagent、也不問」 |
| `skills/dispatch-parallel/SKILL.md` | §協作模式判定 硬規則補「唯讀 fan-out 不套這張判準表」含兩點理由；§Red Flags 補一列擋「多視角 review 正好開隊友互辯」 |

## 結論

9 階段裡同時滿足「工作者要互相講話」×「有人在動同一批檔」的只有 execute-plan 的 parallel-group。其餘 fan-out 點的價值來自**獨立性**，一律 subagent。
