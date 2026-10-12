#!/bin/bash
# 分批推送：每次 add 指定路径 → commit → push → 严格校验
cd /tmp/mr-clean || exit 1
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

push_batch() {
  local label="$1"; shift
  git add "$@" 2>/dev/null
  if git diff --cached --quiet; then
    echo "BATCH $label: nothing to commit, skip"
    return 0
  fi
  git commit -qm "batch: $label" || { echo "BATCH $label: COMMIT FAILED"; return 1; }
  local out
  out=$(git push aggregate main 2>&1)
  if echo "$out" | grep -qE "rejected|failed|error"; then
    echo "BATCH $label: PUSH FAILED"
    echo "$out" | tail -3
    return 1
  fi
  echo "BATCH $label: OK"
  return 0
}

push_batch "02-desktop-build" desktop build cuefield docs || exit 1
push_batch "03-qishui" qishui-auth-v6.js qishui-qr-login.js qishui-auth-v6 qishui-audio-decryptor || exit 1
push_batch "04-public-js" public/js public/index.html public/favicon.ico || exit 1
push_batch "05-public-vendor" public/vendor || exit 1
push_batch "06-public-rest" public/assets public/fonts public/locales public/theme public/css public/scripts public/img 2>/dev/null || exit 1
# 剩余兜底
git add -A
if ! git diff --cached --quiet; then
  push_batch "07-rest" . || exit 1
else
  echo "BATCH 07-rest: nothing left"
fi
echo "ALL BATCHES DONE"
git log --oneline | head -10
