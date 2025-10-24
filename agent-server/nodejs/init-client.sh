#!/bin/bash
# Auto-generate client configuration for AUTOMATED_MODE
# This script creates a default client YAML file if none exist (excluding example-client.yaml)

set -e

CLIENTS_DIR="${CLIENTS_DIR:-/opt/agent-server/clients}"
CLIENT_NAME="${CLIENT_NAME:-DevTools Client}"

# Ensure clients directory exists
mkdir -p "$CLIENTS_DIR"

# Count actual client files (excluding example-client.yaml)
CLIENT_COUNT=$(find "$CLIENTS_DIR" -name "*.yaml" -o -name "*.yml" 2>/dev/null | grep -v "example-client" | wc -l)

if [ "$CLIENT_COUNT" -eq 0 ]; then
    echo "🔧 No client configurations found. Generating default client..."

    # Generate a random UUID for the client
    if command -v uuidgen &> /dev/null; then
        CLIENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    else
        # Fallback UUID generation using /proc/sys/kernel/random/uuid
        CLIENT_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(cat /dev/urandom | tr -dc 'a-f0-9' | fold -w 32 | head -n 1 | sed 's/\(.\{8\}\)\(.\{4\}\)\(.\{4\}\)\(.\{4\}\)\(.\{12\}\)/\1-\2-\3-\4-\5/')")
    fi

    # Create client YAML configuration
    cat > "$CLIENTS_DIR/$CLIENT_ID.yaml" <<EOF
# Auto-generated client configuration
# Generated at: $(date -Iseconds 2>/dev/null || date)

client:
  id: $CLIENT_ID
  name: $CLIENT_NAME
  secret_key: null
  description: Auto-generated client for AUTOMATED_MODE
EOF

    echo "✅ Created client configuration: $CLIENT_ID"
    echo "   Path: $CLIENTS_DIR/$CLIENT_ID.yaml"
else
    echo "ℹ️  Found $CLIENT_COUNT existing client configuration(s). Skipping auto-generation."
fi
