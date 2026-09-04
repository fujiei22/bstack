#!/usr/bin/env bash
input=$(cat)

# ── Parse JSON ────────────────────────────────────────────────
MODEL=$(echo "$input" | jq -r '.model.display_name // "Claude"' | sed -e 's/^Claude //' -e 's/ *([^)]*context[^)]*)//')
DIR=$(echo "$input" | jq -r '.workspace.current_dir' | tr '\\' '/')
# Windows 路徑 \ → /：
# 1) ${DIR##*/} 才能正確取 basename
# 2) 避免下游 echo -e 把 \t \n \b 等當成跳脫字元（如 \tommy_sian → <TAB>ommy_sian）
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
CTX_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
AGENT=$(echo "$input" | jq -r '.agent.name // empty')

# Rate limits
RATE_5H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
RATE_7D=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
RESET_5H=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
RESET_7D=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

# Cache hit 用
CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // empty')
CACHE_CREATE=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // empty')
CUR_INPUT=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // empty')

# ── Colors ────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'; DIM='\033[2m'
CYAN='\033[36m'                          # 只給 model 名稱用
TC_GREEN='\033[38;2;13;188;121m'         # #0dbc79
TC_YELLOW='\033[38;2;255;193;7m'         # #ffc107
TC_RED='\033[38;2;255;44;86m'            # #d92144

SEP="${DIM} | ${RESET}"

# ── Helper: color by percentage（跟 bar 同色）─────────────────
color_pct() {
  local val=$1
  if   [ "$val" -ge 80 ]; then echo "$TC_RED"
  elif [ "$val" -ge 50 ]; then echo "$TC_YELLOW"
  else                         echo "$TC_GREEN"
  fi
}

# ── Helper: format countdown from epoch ───────────────────────
fmt_countdown() {
  local reset_at=$1
  local now=$(date +%s)
  local diff=$(( reset_at - now ))
  if [ "$diff" -le 0 ]; then echo "now"; return; fi
  local h=$(( diff / 3600 ))
  local m=$(( (diff % 3600) / 60 ))
  printf "%dh %dm" "$h" "$m"
}

# ── Helper: render progress bar ───────────────────────────────
BAR_W=12
make_bar() {
  local pct=$1
  local fc dc filled empty i out=""
  # 依用量挑「滿色」（truecolor）：綠 #0dbc79 / 黃 #ffc107 / 紅 #d92144；底色統一灰 238
  if   [ "$pct" -ge 80 ]; then fc='\033[48;2;217;33;68m'
  elif [ "$pct" -ge 50 ]; then fc='\033[48;2;255;193;7m'
  else                         fc='\033[48;2;13;188;121m'
  fi
  dc='\033[48;5;238m'
  filled=$((pct * BAR_W / 100)); empty=$((BAR_W - filled))
  for i in $(seq 1 $filled); do out="${out}${fc} \033[0m"; done
  for i in $(seq 1 $empty);  do out="${out}${dc} \033[0m"; done
  printf '%s' "$out"
}

# ── Context window size label ─────────────────────────────────
CTX_LABEL=""
if [ -n "$CTX_SIZE" ]; then
  if [ "$CTX_SIZE" -ge 1000000 ]; then
    CTX_LABEL="${DIM}1M${RESET}"
  else
    CTX_LABEL="${DIM}200K${RESET}"
  fi
fi

# ── Git info ──────────────────────────────────────────────────
BRANCH=""
git rev-parse --git-dir > /dev/null 2>&1 && BRANCH="$(git branch --show-current 2>/dev/null)"

REPO_LINK="${DIR##*/}"
REMOTE=$(git remote get-url origin 2>/dev/null | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
if [ -n "$REMOTE" ]; then
  REPO_NAME=$(basename "$REMOTE")
  REPO_LINK=$(printf '%b' "\e]8;;${REMOTE}\a${REPO_NAME}\e]8;;\a")
fi

# ── Context bar ───────────────────────────────────────────────
BAR=$(make_bar "$PCT")

# ── Git file stats ────────────────────────────────────────────
GIT_STATS=""
if git rev-parse --git-dir > /dev/null 2>&1; then
  GIT_M=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
  GIT_A=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
  GIT_D=$(git diff --diff-filter=D --name-only 2>/dev/null | wc -l | tr -d ' ')
  PARTS=""
  [ "$GIT_M" -gt 0 ] 2>/dev/null && PARTS="${TC_YELLOW}${GIT_M}M${RESET}"
  [ "$GIT_A" -gt 0 ] 2>/dev/null && { [ -n "$PARTS" ] && PARTS="${PARTS} "; PARTS="${PARTS}${TC_GREEN}${GIT_A}A${RESET}"; }
  [ "$GIT_D" -gt 0 ] 2>/dev/null && { [ -n "$PARTS" ] && PARTS="${PARTS} "; PARTS="${PARTS}${TC_RED}${GIT_D}D${RESET}"; }
  [ -n "$PARTS" ] && GIT_STATS="${PARTS}"
fi

# ── Cache hit rate ────────────────────────────────────────────
CACHE_HIT=""
if [ -n "$CACHE_READ" ] && [ -n "$CUR_INPUT" ] && [ "$CUR_INPUT" != "0" ] && [ "$CUR_INPUT" != "null" ]; then
  CACHE_TOTAL=$((CACHE_READ + CUR_INPUT + ${CACHE_CREATE:-0}))
  if [ "$CACHE_TOTAL" -gt 0 ]; then
    CACHE_PCT=$((CACHE_READ * 100 / CACHE_TOTAL))
    CACHE_C=$(color_pct "$((100 - CACHE_PCT))")
    CACHE_HIT="${DIM}cache${RESET} ${CACHE_C}${CACHE_PCT}%${RESET}"
  fi
fi

# ══════════════════════════════════════════════════════════════
# LINE 1: Model + Repo + Branch + Git stats + Agent
# ══════════════════════════════════════════════════════════════
L1="${CYAN}${BOLD}${MODEL}${RESET}"
[ -n "$CTX_LABEL" ] && L1="${L1} ${CTX_LABEL}"
L1="${L1}${SEP}${CYAN}${REPO_LINK}${RESET}"
[ -n "$BRANCH" ] && L1="${L1} ${DIM}(${BRANCH})${RESET}"
[ -n "$CACHE_HIT" ] && L1="${L1}${SEP}${CACHE_HIT}"
[ -n "$GIT_STATS" ] && L1="${L1}${SEP}${GIT_STATS}"
[ -n "$AGENT" ] && L1="${L1}${SEP}${TC_GREEN}${AGENT}${RESET}"

# ══════════════════════════════════════════════════════════════
# LINE 2: Context bar + Rate limits (5h & 7d) + Cache hit
# ══════════════════════════════════════════════════════════════
PCT_C=$(color_pct "$PCT")
L2="${DIM}context${RESET} ${BAR} ${PCT_C}${PCT}%${RESET}"

if [ -n "$RATE_5H" ]; then
  R5_INT=$(printf "%.0f" "$RATE_5H")
  R5_C=$(color_pct "$R5_INT")
  R5_BAR=$(make_bar "$R5_INT")
  L2="${L2}${SEP}${DIM}5h${RESET} ${R5_BAR} ${R5_C}${R5_INT}%${RESET}"
  if [ -n "$RESET_5H" ] && [ "$RESET_5H" != "null" ]; then
    R5_CD=$(fmt_countdown "$RESET_5H")
    L2="${L2} ${DIM}(${R5_CD})${RESET}"
  fi
fi

if [ -n "$RATE_7D" ]; then
  R7_INT=$(printf "%.0f" "$RATE_7D")
  R7_C=$(color_pct "$R7_INT")
  L2="${L2}${SEP}${DIM}7d${RESET} ${R7_C}${R7_INT}%${RESET}"
  if [ -n "$RESET_7D" ] && [ "$RESET_7D" != "null" ]; then
    R7_CD=$(fmt_countdown "$RESET_7D")
    L2="${L2} ${DIM}(${R7_CD})${RESET}"
  fi
fi

# ── Output ────────────────────────────────────────────────────
echo -e "$L1"
echo -e "$L2"
