# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The eval-server is a **thin HTTP API wrapper for Browser Operator**. It provides:
- WebSocket server for browser agent connections
- REST APIs for browser automation via Chrome DevTools Protocol (CDP)
- JSON-RPC 2.0 bidirectional communication
- Screenshot capture and page content retrieval

**Important:** Evaluation orchestration and LLM-as-a-judge logic lives in the separate `evals/` Python project, which calls these APIs.

## Architecture

### Separation of Concerns

**eval-server (Node.js)**: Thin API layer
- WebSocket server for agent connections
- JSON-RPC 2.0 bidirectional communication
- REST APIs for CDP operations (screenshots, page content, tab management)
- NO evaluation logic, NO judges, NO test orchestration

**evals (Python)**: Evaluation orchestration and judging
- LLM judges (LLMJudge, VisionJudge) in `lib/judge.py`
- Evaluation runners that call eval-server APIs
- Test case definitions (YAML files in `data/`)
- Result reporting and analysis

## Core Components

### WebSocket Server (src/lib/EvalServer.js)
- Accepts connections from browser agents (DevTools clients)
- Manages agent lifecycle (connect, ready, disconnect)
- Handles bidirectional RPC communication
- Integrates directly with Chrome DevTools Protocol

### HTTP API Server (src/api-server.js)
- Exposes REST endpoints for external callers (e.g., Python evals)
- Main endpoint: `POST /v1/responses` - Send task to agent
- CDP endpoints: screenshot, page content, tab management
- Returns metadata (clientId, tabId) for subsequent operations

### RPC Client (src/rpc-client.js)
- Implements JSON-RPC 2.0 protocol for bidirectional communication
- Manages request/response correlation with unique IDs
- Handles timeouts and error conditions
- Calls `evaluate(params)` method on connected agents

### Client Manager (src/client-manager.js)
- Tracks WebSocket client connections
- Manages tab-level connections (composite clientId:tabId)
- Maintains client state (connected, ready)

### CDP Integration (src/lib/EvalServer.js)
- Direct Chrome DevTools Protocol communication
- Screenshot capture via `Page.captureScreenshot`
- Page content access via `Runtime.evaluate`
- Tab management via `Target.createTarget` / `Target.closeTarget`

### Logger (src/logger.js)
- Structured logging using Winston
- Separate log files for different event types
- JSON format for easy parsing and analysis

## Key API Endpoints

### POST /v1/responses

Primary endpoint for sending tasks to browser agents.

**Request:**
```json
{
  "input": "Click the submit button",
  "url": "https://example.com",
  "wait_timeout": 5000,
  "model": {
    "main_model": {"provider": "openai", "model": "gpt-5-mini", "api_key": "sk-..."},
    "mini_model": {"provider": "openai", "model": "gpt-5-nano", "api_key": "sk-..."},
    "nano_model": {"provider": "openai", "model": "gpt-5-nano", "api_key": "sk-..."}
  }
}
```

**Response (OpenAI-compatible format):**
```json
[
  {
    "id": "msg_abc123",
    "type": "message",
    "role": "assistant",
    "content": [{"type": "output_text", "text": "Done", "annotations": []}],
    "metadata": {
      "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
      "tabId": "482D56EE57B1931A3B9D1BFDAF935429"
    }
  }
]
```

**Important:** The `metadata` field contains `clientId` and `tabId` which are used by the evals framework for screenshot capture.

### POST /page/screenshot

Capture screenshot of a browser tab via CDP.

**Request:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "482D56EE57B1931A3B9D1BFDAF935429",
  "fullPage": false
}
```

**Response:**
```json
{
  "clientId": "...",
  "tabId": "...",
  "imageData": "data:image/png;base64,iVBORw0KG...",
  "format": "png",
  "timestamp": 1234567890
}
```

### POST /page/content

Get HTML or text content of a page.

**Request:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "482D56EE57B1931A3B9D1BFDAF935429",
  "format": "html"
}
```

### POST /tabs/open, POST /tabs/close

Tab management via CDP.

## Configuration

All configuration is managed through environment variables and `src/config.js`:

```bash
# .env file
PORT=8080              # WebSocket server port
API_PORT=8081          # HTTP API server port
AUTH_KEY=hello         # Authentication key
CDP_HOST=localhost     # Chrome DevTools Protocol host
CDP_PORT=9223          # Chrome DevTools Protocol port
```

## Model Configuration Schema

The server uses a canonical nested model configuration format:

```typescript
interface ModelTierConfig {
  provider: string;  // "openai" | "groq" | "openrouter" | "litellm"
  model: string;     // Model name (e.g., "gpt-5-mini")
  api_key: string;   // API key for this tier
}

interface ModelConfig {
  main_model: ModelTierConfig;  // Primary model
  mini_model: ModelTierConfig;  // Secondary model
  nano_model: ModelTierConfig;  // Tertiary model
}
```

## Tab Management

Each browser tab is identified by a **composite client ID**: `baseClientId:tabId`

Example:
- Base Client ID: `9907fd8d-92a8-4a6a-bce9-458ec8c57306`
- Tab ID: `482D56EE57B1931A3B9D1BFDAF935429`
- Composite: `9907fd8d-92a8-4a6a-bce9-458ec8c57306:482D56EE57B1931A3B9D1BFDAF935429`

## CDP Communication Pattern

The server uses **direct CDP communication**:

1. Discover CDP WebSocket endpoint via `http://localhost:9223/json/version`
2. For each command, establish WebSocket connection to CDP endpoint
3. Send commands using JSON-RPC 2.0:
   - **Browser-level**: `Target.createTarget`, `Target.closeTarget`
   - **Tab-level**: `Runtime.evaluate`, `Page.captureScreenshot`
4. For tab-level operations: attach → execute → detach
5. Close WebSocket after receiving response

## Integration with Evals Framework

The eval-server is designed to work with the separate `evals/` Python project:

**Flow:**
1. Python evals runner sends request to `/v1/responses`
2. Eval-server forwards to DevTools agent via WebSocket/JSON-RPC
3. Agent performs browser automation task
4. Response includes `metadata.clientId` and `metadata.tabId`
5. Python evals uses these IDs to capture screenshot via `/page/screenshot`
6. Python evals uses VisionJudge to evaluate with screenshot
7. Python evals generates report and saves screenshot

See `evals/README.md` for detailed evaluation framework documentation.

## Development Commands

```bash
# Install dependencies
npm install

# Start server
npm start

# Check status
curl http://localhost:8081/status

# Test screenshot
curl -X POST http://localhost:8081/page/screenshot \
  -H "Content-Type: application/json" \
  -d '{"clientId":"CLIENT_ID","tabId":"TAB_ID","fullPage":false}'
```

## Chrome Setup

The browser must be started with remote debugging enabled:

```bash
chromium --remote-debugging-port=9223
```

CDP endpoint: `http://localhost:9223/json/version`

## File Structure

```
nodejs/
├── package.json
├── .env.example
└── src/
    ├── api-server.js           # HTTP REST API endpoints
    ├── client-manager.js       # WebSocket client management
    ├── rpc-client.js           # JSON-RPC 2.0 communication
    ├── config.js               # Configuration management
    ├── logger.js               # Winston logging
    └── lib/
        ├── EvalServer.js       # Core server + CDP integration
        └── HTTPWrapper.js      # HTTP wrapper around EvalServer
```

## Key Implementation Details

### formatResponse() Method

Located in `src/api-server.js:706`

Converts agent responses to OpenAI-compatible format and **adds metadata**:

```javascript
formatResponse(responseText, clientId = null, tabId = null) {
  const messageId = `msg_${uuidv4().replace(/-/g, '')}`;

  const response = [{
    id: messageId,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: responseText, annotations: [] }]
  }];

  // Add metadata for screenshot capture
  if (clientId && tabId) {
    response[0].metadata = { clientId, tabId };
  }

  return response;
}
```

This metadata is critical for the evals framework to capture screenshots.

### Screenshot Capture Flow

1. Evals calls `/v1/responses` with task
2. Server returns response with `metadata: {clientId, tabId}`
3. Evals extracts metadata from response
4. Evals calls `/page/screenshot` with extracted IDs
5. Server uses CDP to capture screenshot
6. Returns base64-encoded PNG
7. Evals saves screenshot and uses for VisionJudge evaluation

## Logging

Logs are written to `logs/` directory (auto-created):
- `combined.log` - All log events
- `error.log` - Error events only
- `api.log` - API request/response logs

## Docker Integration

The eval-server runs inside `kernel-browser-extended` Docker container.

Volume mount for live development:
```yaml
volumes:
  - "./eval-server/nodejs:/opt/eval-server"
```

## Dependencies

Core dependencies:
- `ws` - WebSocket server
- `uuid` - ID generation
- `winston` - Structured logging
- `dotenv` - Environment variable management

Removed dependencies:
- ~~`openai`~~ - Not needed (evals handles judging)
- ~~`js-yaml`~~ - Not needed (evals handles YAML loading)

## What This Server Does NOT Do

- ❌ Load YAML evaluation definitions (handled by evals/)
- ❌ LLM-as-a-judge evaluation (handled by evals/)
- ❌ Test orchestration (handled by evals/)
- ❌ Result reporting (handled by evals/)
- ❌ Screenshot analysis (handled by evals/)

## What This Server DOES Do

- ✅ WebSocket server for browser agent connections
- ✅ JSON-RPC 2.0 bidirectional communication
- ✅ HTTP REST API endpoints
- ✅ CDP screenshot capture
- ✅ CDP page content retrieval
- ✅ CDP tab management
- ✅ Return metadata (clientId, tabId) for screenshot capture
