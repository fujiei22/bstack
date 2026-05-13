---
name: cmd-guard
description: |
  危險指令防呆（繁中）。觸發：執行 rm -rf / drop / DROP TABLE / force push /
  reset --hard / sudo / dd / mkfs / chmod 777 / rm -fr / git push --force /
  任何不可逆 / 影響系統 / 影響別人 的 command 前。
  涵蓋：偵測危險指令類型、危險度分級、AskUserQuestion 二次確認、
  user override 後執行、安全替代建議。
---

# cmd-guard

執行**危險 / 不可逆 / 影響別人**的指令前，**必停下二次確認**。

## 使用契約（強制）

**自我觸發**：每次 Bash tool 即將跑 command 前，主 agent **自查**是否落入以下類型；落入 → 載此 skill。

**載入後立即動作**：

1. 識別危險度等級（L1-L4）
2. 印 command + 風險 + 安全替代建議
3. `AskUserQuestion` 二次確認（L3 / L4 必須）
4. user 決定後執行（或 abort）
5. 執行後印 outcome

---

## §危險度分級

| L | 類型 | 範例 | 處置 |
|---|---|---|---|
| **L4** 災難級 | 整 disk 寫、不可逆系統改 | `rm -rf /`、`dd if=... of=/dev/sda`、`mkfs.*`、`shutdown -h now`、`> /dev/sda` | **拒絕**、印理由、要 user 顯式說「我知道風險、跑」才執行 |
| **L3** 高危險 | 大範圍刪 / 改 / 不可逆 | `rm -rf <dir>`、`git reset --hard`、`git push --force` 到 main、`DROP TABLE`、`TRUNCATE`、`chmod -R 777`、`sudo *` | AskUserQuestion 強迫二次確認 + 列風險 |
| **L2** 中等 | 可逆但影響大 | `git push --force-with-lease`、`npm uninstall`、`rm <file>`、`git clean -fd`、`docker system prune` | AskUserQuestion 一般確認 |
| **L1** 輕微 | 一般可逆但值得 user 知道 | `git stash drop`、`git checkout -- <file>`、`pip install <pkg>` | 印 + 直接執行（不問） |

---

## §自查 pattern

每次要跑 Bash 前看 command 是否符合：

```
危險 keyword:
  rm -rf | rm -fr
  rmdir -r
  > /dev/    （overwrite block device）
  dd if= of=/dev/
  mkfs       （format）
  shutdown   | halt | reboot
  poweroff
  sudo       （任何 sudo）
  chmod -R 777
  chown -R
  git reset --hard
  git push --force  （無 --with-lease）
  git push -f
  git clean -fd
  DROP TABLE | DROP DATABASE | TRUNCATE
  DELETE FROM 不帶 WHERE
  UPDATE * 不帶 WHERE
  curl | bash       （pipe to shell）
  wget | sh
  npm uninstall -g
  docker system prune
  kubectl delete --all
```

---

## §AskUserQuestion 模板

### L3 / L4

```
問：即將執行**危險指令**：
  `<command>`

  類型: <L3 / L4>
  影響:
    - <什麼會變、不可逆與否>
  安全替代:
    - <可逆 / 較安全的做法>
  最近相關 commit / 狀態:
    - <如有>

  選項：
    1. 安全替代（推薦）
    2. 跑原指令（user 知風險）
    3. 取消、不執行
    4. 修改參數後跑（user 給細節）
```

L4 額外要 user 再打一次「我知道風險」確認（avoid 不小心點到「跑」）。

### L2

```
問：即將執行：
  `<command>`

  類型: L2
  影響: <一句>

  選項：
    1. 跑（推薦，影響可逆）
    2. 取消
    3. 修改參數
```

---

## §safer 替代建議

對常見 L3：

| L3 危險 | safer 替代 |
|---|---|
| `rm -rf <dir>` | `mv <dir> <dir>.bak.<date>` 再考慮真的要刪嗎 |
| `git reset --hard` | `git stash` 或 `git branch backup-<date>` 再 reset |
| `git push --force` | `git push --force-with-lease`（檢查 remote 沒被別人推） |
| `DROP TABLE` | `RENAME TABLE x TO x_bak_<date>` 觀察 N 天再 DROP |
| `TRUNCATE` | `DELETE WHERE id IN (...)` + 分批 + LIMIT |
| `chmod -R 777` | 具體 `chmod 644` / `chmod 755`、最小權限 |
| `curl url \| bash` | `curl url -o /tmp/x.sh && shasum -a 256 /tmp/x.sh` → user 看 hash → 才 bash |

---

## §例外：自動化流程內

dev-workflow 內某些步驟自帶這些 command（如 `git push -u origin <branch>`、`git rebase`）— 這些**不算危險**（受 branch safety / file-type-guard 已先把關）。cmd-guard 只看「指令本身」、不是它出現的 context。

---

## §user 完成後追蹤

執行後 1-2 句 outcome：

```
完成：<command>
結果：<exit code / 看到什麼變化>
```

---

## §hand-off state

不推進 phase。記錄：

```yaml
state:
  dangerous_cmd_history:
    - { cmd: <command>, level: <L>, user_decision: <option>, ts: <ISO> }
```

---

## §結尾 Trace 標籤

由呼叫 phase 帶。

---

## §Red Flags

| 想法 | 真相 |
|---|---|
| 「user 之前讓我跑類似的、不必再問」 | 每次 L3+ 都要問；context 隨時變 |
| 「L4 user 應該知道」 | L4 額外要打字確認；不能 1 click |
| 「dev-workflow 內的 push 也擋」 | dev-workflow 流程內已過 branch safety；不算危險 |
| 「替代方案複雜、跳」 | 至少列出讓 user 看；user 仍可選跑原 |
| 「自己判別 L2 跑了」 | L2 仍要 prompt（即便 recommended 是「跑」）|
