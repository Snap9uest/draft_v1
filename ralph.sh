#!/bin/bash
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
MAX_ITERS="${MAX_ITERS:-10}"
MODEL="${RALPH_MODEL:-Gemini 3.1 Pro (High)}"

echo "=========================================================="
echo "  Starting Ralph Loop for SnapQuest [F4]"
echo "  Project Dir : $REPO"
echo "  Model       : $MODEL"
echo "  Max Iters   : $MAX_ITERS"
echo "=========================================================="

for i in $(seq 1 "$MAX_ITERS"); do
  echo ""
  echo "----------------------------------------------------------"
  echo " [Iteration $i / $MAX_ITERS] Starting..."
  echo "----------------------------------------------------------"

  # 남은 미완료 태스크가 있는지 확인
  if ! grep -q "\- \[ \]" "$REPO/PRD.md"; then
    echo "🎉 All tasks in PRD.md are completed! Finishing Ralph Loop."
    break
  fi

  PROMPT="The project directory is: $REPO
All file reads, file writes, and git commits MUST happen inside that exact directory.

1. Read PRD.md and progress.txt to identify the first unfinished task (- [ ]).
2. Implement and complete exactly ONE task.
3. Run verification (e.g. build or test commands) to ensure there are no errors.
4. Append detailed progress log to progress.txt (do NOT delete previous logs).
5. Update PRD.md to mark that single task as completed (- [x]).
6. Make a clean git commit with a clear commit message.

Do NOT proceed to the next task in the same iteration."

  # Antigravity CLI 단발 호출 (Fresh Context)
  agy -p "$PROMPT" \
      --model "$MODEL" \
      --add-dir "$REPO" \
      --mode accept-edits \
      --dangerously-skip-permissions \
      --print-timeout 15m

  echo "✔ Iteration $i finished."
  sleep 2
done

echo ""
echo "=========================================================="
echo "  Ralph Loop Run Finished!"
echo "=========================================================="
