#!/bin/sh
# Docker entrypoint script for Browser Operator DevTools
# This script generates runtime configuration from environment variables
# and starts nginx to serve the DevTools frontend

set -e

# Log configuration status to container logs
echo "DevTools runtime configuration generated:"
[ -n "${OPENAI_API_KEY}" ] && echo "  ✓ OPENAI_API_KEY configured" || echo "  ✗ OPENAI_API_KEY not set"
[ -n "${OPENROUTER_API_KEY}" ] && echo "  ✓ OPENROUTER_API_KEY configured" || echo "  ✗ OPENROUTER_API_KEY not set"
[ -n "${GROQ_API_KEY}" ] && echo "  ✓ GROQ_API_KEY configured" || echo "  ✗ GROQ_API_KEY not set"
[ -n "${LITELLM_API_KEY}" ] && echo "  ✓ LITELLM_API_KEY configured" || echo "  ✗ LITELLM_API_KEY not set"

# Inject API keys directly into DevTools JavaScript files
echo "🔧 Injecting API keys directly into JavaScript files..."

# Find and modify the main DevTools entry point files
for js_file in /usr/share/nginx/html/entrypoints/*/devtools_app.js /usr/share/nginx/html/entrypoints/*/inspector_main.js; do
  if [ -f "$js_file" ]; then
    echo "  ✓ Injecting into $(basename "$js_file")"
    # Inject a global configuration object at the beginning of the file
    sed -i '1i\
// Runtime API key injection\
window.__RUNTIME_CONFIG__ = {\
  OPENAI_API_KEY: "'"${OPENAI_API_KEY:-}"'",\
  OPENROUTER_API_KEY: "'"${OPENROUTER_API_KEY:-}"'",\
  GROQ_API_KEY: "'"${GROQ_API_KEY:-}"'",\
  LITELLM_API_KEY: "'"${LITELLM_API_KEY:-}"'",\
  timestamp: "'"$(date -Iseconds)"'",\
  source: "docker-runtime"\
};\
// Auto-save to localStorage\
if (window.__RUNTIME_CONFIG__.OPENAI_API_KEY) localStorage.setItem("ai_chat_api_key", window.__RUNTIME_CONFIG__.OPENAI_API_KEY);\
if (window.__RUNTIME_CONFIG__.OPENROUTER_API_KEY) localStorage.setItem("ai_chat_openrouter_api_key", window.__RUNTIME_CONFIG__.OPENROUTER_API_KEY);\
if (window.__RUNTIME_CONFIG__.GROQ_API_KEY) localStorage.setItem("ai_chat_groq_api_key", window.__RUNTIME_CONFIG__.GROQ_API_KEY);\
if (window.__RUNTIME_CONFIG__.LITELLM_API_KEY) localStorage.setItem("ai_chat_litellm_api_key", window.__RUNTIME_CONFIG__.LITELLM_API_KEY);\
console.log("[RUNTIME-CONFIG] API keys injected directly into JavaScript:", {hasOpenAI: !!window.__RUNTIME_CONFIG__.OPENAI_API_KEY, hasOpenRouter: !!window.__RUNTIME_CONFIG__.OPENROUTER_API_KEY, hasGroq: !!window.__RUNTIME_CONFIG__.GROQ_API_KEY, hasLiteLLM: !!window.__RUNTIME_CONFIG__.LITELLM_API_KEY});\
' "$js_file"
  fi
done

# Also inject into AI Chat panel files specifically
for js_file in /usr/share/nginx/html/panels/ai_chat/*.js; do
  if [ -f "$js_file" ]; then
    echo "  ✓ Injecting into AI Chat panel $(basename "$js_file")"
    sed -i '1i\
// Runtime API key injection for AI Chat\
if (typeof window !== "undefined" && !window.__RUNTIME_CONFIG__) {\
  window.__RUNTIME_CONFIG__ = {\
    OPENAI_API_KEY: "'"${OPENAI_API_KEY:-}"'",\
    OPENROUTER_API_KEY: "'"${OPENROUTER_API_KEY:-}"'",\
    GROQ_API_KEY: "'"${GROQ_API_KEY:-}"'",\
    LITELLM_API_KEY: "'"${LITELLM_API_KEY:-}"'",\
    timestamp: "'"$(date -Iseconds)"'",\
    source: "docker-runtime"\
  };\
}\
' "$js_file"
  fi
done

# Start nginx in foreground
echo "Starting nginx..."
exec nginx -g 'daemon off;'