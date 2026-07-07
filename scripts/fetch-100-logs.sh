#!/usr/bin/env bash
# 从 100 环境 (192.168.6.100) 拉取各服务最近日志
set -euo pipefail

HOST="${LOG_FETCH_HOST:-192.168.6.100}"
USER="${LOG_FETCH_USER:-root}"
PASS="${LOG_FETCH_PASS:?Set LOG_FETCH_PASS}"
REMOTE_BASE="${LOG_FETCH_REMOTE:-/data/flybot/server}"
DATE="${LOG_FETCH_DATE:-$(date +%Y-%m-%d)}"
OUT_DIR="${LOG_FETCH_OUT:-$(dirname "$0")/../data/fetched-100-env/$DATE}"
NODE="${LOG_FETCH_NODE:-node-100}"
MAX_MB="${LOG_FETCH_MAX_MB:-8}"

mkdir -p "$OUT_DIR"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=20)
ssh_cmd() { sshpass -p "$PASS" ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"; }

SERVICES=(
  channel-hub:start_channel-hub.log
  configuration:start_configuration.log
  external-kit:spring.log
  fly-gateway:start_fly-gateway.log
  fly-sense:start_fly-sense.log
  fly-transfer:flyTransfer-info.log
  openapi-kit:openApi.log
  phone-channel:start_phone-channel.log
  store-adapter:start_store-adapter.log
  video-plugin:video-plugin.log
  video-workbench:video-workbench.log
  wecom-decrypt-service:start_wecom-decrypt-service.log:today
)

echo "拉取目标: $USER@$HOST → $OUT_DIR (日期过滤: $DATE)"

for item in "${SERVICES[@]}"; do
  svc="${item%%:*}"
  rest="${item#*:}"
  file="${rest%%:*}"
  mode="${rest#*:}"
  [ "$mode" = "$file" ] && mode="full"
  remote="$REMOTE_BASE/$svc/logs/$file"

  if ! ssh_cmd "test -f '$remote'"; then
    echo "  skip $svc ($file 不存在)"
    continue
  fi

  size_kb=$(ssh_cmd "stat -c%s '$remote' 2>/dev/null || stat -f%z '$remote'" | awk '{printf "%.0f", $1/1024}')
  out="$OUT_DIR/${svc}-${NODE}.log"

  if [ "$mode" = "today" ] || [ "$size_kb" -gt $((MAX_MB * 1024)) ]; then
    echo "  $svc: ${size_kb}KB → 仅提取 $DATE"
    ssh_cmd "grep '$DATE' '$remote' 2>/dev/null | tail -n 40000 || tail -n 20000 '$remote'" > "$out"
  else
    echo "  $svc: ${size_kb}KB → 完整拉取"
    sleep 0.5
    ssh_cmd "cat '$remote'" > "$out"
  fi

  lines=$(wc -l < "$out" | tr -d ' ')
  echo "    ✓ $out ($lines 行)"
done

echo ""
echo "完成。共 $(ls -1 "$OUT_DIR"/*.log 2>/dev/null | wc -l | tr -d ' ') 个文件 → $OUT_DIR"
