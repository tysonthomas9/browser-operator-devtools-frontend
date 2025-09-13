#!/bin/bash
# Simple Langfuse Test Runner
# Runs a quick evaluation test to verify Langfuse score uploads work end-to-end

set -euo pipefail

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVAL_SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Defaults (can be overridden via env)
: "${DEVTOOLS_URL:=http://localhost:8000}"
: "${REMOTE_DEBUGGING_PORT:=9222}"
: "${USER_DATA_DIR:=}"

# Detect Browser Operator command
detect_bo_cmd() {
  local candidates=(
    "BrowserOperator"
    "browser-operator"
    "browser_operator"
    "Browser"
  )
  if [[ -n "${BROWSER_OPERATOR_CMD:-}" ]]; then
    echo "$BROWSER_OPERATOR_CMD"
    return 0
  fi
  for c in "${candidates[@]}"; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
  done
  if command -v "Browser Operator" >/dev/null 2>&1; then
    echo "Browser Operator"
    return 0
  fi
  echo ""  # not found
}

# Parse --port from args (default 8080)
EVAL_PORT=8080
for arg in "$@"; do
  case "$arg" in
    --port=*)
      EVAL_PORT="${arg#*=}" ;;
  esac
done

# Support spaced form: --port 8090
for i in "$@"; do
  if [[ "$i" == "--port" ]]; then
    shift
    if [[ $# -gt 0 ]]; then
      EVAL_PORT="$1"
    fi
    break
  fi
done

# Helper to check if port is free
port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

# Change to eval-server python directory
cd "$EVAL_SERVER_DIR"

echo "🧪 Starting Simple Langfuse Integration Test"
echo "============================================"

# Check port availability
if port_in_use "$EVAL_PORT"; then
  echo "❌ Error: Port ${EVAL_PORT} is already in use. Free it or pass --port <free-port>."
  exit 1
fi

# Run the simple test script in background
if command -v uv >/dev/null 2>&1; then
  ( uv run python evals/simple_langfuse_test.py --port "$EVAL_PORT" "$@" ) &
else
  echo "uv not found; running with system python"
  ( python3 evals/simple_langfuse_test.py --port "$EVAL_PORT" "$@" ) &
fi
SERVER_PID=$!

cleanup() {
  echo "\n🛑 Stopping test server (PID ${SERVER_PID})"
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Wait briefly for the server to bind (max ~5s)
READY=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if port_in_use "$EVAL_PORT"; then
    READY=1
    break
  fi
  sleep 0.5
done
if [[ -z "$READY" ]]; then
  echo "⚠️  Server does not appear to be listening on ${EVAL_PORT} yet. Continuing..."
fi

# Launch Browser Operator
BO_CMD="$(detect_bo_cmd)"
if [[ -n "$BO_CMD" ]]; then
  echo "🚀 Launching Browser Operator: $BO_CMD"
  echo "    --custom-devtools-frontend=${DEVTOOLS_URL}"
  echo "    --remote-debugging-port=${REMOTE_DEBUGGING_PORT}"
  if [[ -n "$USER_DATA_DIR" ]]; then
    echo "    --user-data-dir=${USER_DATA_DIR}-${EVAL_PORT}"
  else
    echo "    (using default browser profile)"
  fi

  BO_ARGS=(
    --custom-devtools-frontend="$DEVTOOLS_URL"
    --remote-debugging-port="$REMOTE_DEBUGGING_PORT"
    --auto-open-devtools-for-tabs
    --password-store=basic
    --use-mock-keychain
  )
  if [[ -n "$USER_DATA_DIR" ]]; then
    BO_ARGS+=(--user-data-dir="${USER_DATA_DIR}-${EVAL_PORT}")
  fi

  "$BO_CMD" "${BO_ARGS[@]}" >/dev/null 2>&1 &
  BO_PID=$!
  echo "✅ Browser Operator started (PID ${BO_PID})"
else
  # Try macOS .app via open -a
  if [[ "$(uname -s)" == "Darwin" ]]; then
    BO_APP_NAME="${BROWSER_OPERATOR_APP:-Browser Operator}"
    echo "🚀 Launching ${BO_APP_NAME}.app via 'open -a'"
    echo "    --custom-devtools-frontend=${DEVTOOLS_URL}"
    echo "    --remote-debugging-port=${REMOTE_DEBUGGING_PORT}"
    if [[ -n "$USER_DATA_DIR" ]]; then
      echo "    --user-data-dir=${USER_DATA_DIR}-${EVAL_PORT}"
    else
      echo "    (using default browser profile)"
    fi

    OPEN_ARGS=(
      -a "$BO_APP_NAME"
      --args
      --custom-devtools-frontend "$DEVTOOLS_URL"
      --remote-debugging-port "$REMOTE_DEBUGGING_PORT"
      --auto-open-devtools-for-tabs
      --password-store basic
      --use-mock-keychain
    )
    if [[ -n "$USER_DATA_DIR" ]]; then
      OPEN_ARGS+=(--user-data-dir "${USER_DATA_DIR}-${EVAL_PORT}")
    fi

    ( open "${OPEN_ARGS[@]}" ) >/dev/null 2>&1 &
    echo "✅ Requested launch of ${BO_APP_NAME}.app"
  else
    echo "ℹ️  Browser Operator CLI not found. You can launch it manually:"
    echo "      BrowserOperator --custom-devtools-frontend=${DEVTOOLS_URL}"
    echo "        --remote-debugging-port=${REMOTE_DEBUGGING_PORT} --auto-open-devtools-for-tabs"
  fi
fi

echo ""
echo "📋 Test Instructions:"
echo "  1) Browser Operator should launch automatically"
echo "  2) In AI Assistant panel Settings:"
echo "     - Enable Evaluation mode"
echo "     - Set endpoint: ws://127.0.0.1:${EVAL_PORT}"
echo "     - Enable Langfuse integration with same credentials as server"
echo "  3) The test will run 3 simple questions (< 30 seconds total)"
echo "  4) Check for Langfuse score uploads in the output"
echo ""
echo "⏳ Expected completion: 30-60 seconds"
echo "🛑 Press Ctrl+C to stop if needed"
echo "============================================"

# Wait on server process
wait "$SERVER_PID"