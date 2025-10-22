# Eval-Server

HTTP API wrapper for Browser Operator - provides WebSocket server with Chrome DevTools Protocol (CDP) integration for browser automation.

## Overview

The eval-server exposes browser automation capabilities via HTTP API endpoints. It manages WebSocket connections to browser agents and provides REST APIs for:
- Sending tasks to agents (`/v1/responses`)
- Capturing screenshots via CDP
- Retrieving page content
- Managing browser tabs

**Note:** Evaluation orchestration and LLM-as-a-judge logic lives in the separate `evals/` Python project, which calls these APIs.

## Architecture

```
eval-server/
└── nodejs/
    ├── src/
    │   ├── api-server.js           # HTTP REST API endpoints
    │   ├── client-manager.js       # WebSocket client management
    │   ├── rpc-client.js           # JSON-RPC 2.0 communication
    │   ├── config.js               # Configuration management
    │   ├── logger.js               # Winston logging
    │   └── lib/
    │       ├── EvalServer.js       # Core server + CDP integration
    │       └── HTTPWrapper.js      # HTTP API wrapper
    └── package.json
```

## Quick Start

### Installation

```bash
cd eval-server/nodejs
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
# WebSocket server port
PORT=8080

# HTTP API server port
API_PORT=8081

# Authentication
AUTH_KEY=your-secret-key

# Chrome DevTools Protocol endpoint
CDP_HOST=localhost
CDP_PORT=9223
```

### Start Server

```bash
npm start
```

The server will start:
- WebSocket server on `ws://localhost:8080`
- HTTP API server on `http://localhost:8081`

## HTTP API Endpoints

### Core Endpoint

#### `POST /v1/responses`

Send a task to a connected browser agent and get response.

**Request:**
```json
{
  "input": "Click the submit button",
  "url": "https://example.com",
  "wait_timeout": 5000,
  "model": {
    "main_model": {
      "provider": "openai",
      "model": "gpt-5-mini",
      "api_key": "sk-..."
    },
    "mini_model": {
      "provider": "openai",
      "model": "gpt-5-nano",
      "api_key": "sk-..."
    },
    "nano_model": {
      "provider": "openai",
      "model": "gpt-5-nano",
      "api_key": "sk-..."
    }
  }
}
```

**Response:**
```json
[
  {
    "id": "msg_abc123",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "output_text",
        "text": "Done - clicked submit button",
        "annotations": []
      }
    ],
    "metadata": {
      "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
      "tabId": "482D56EE57B1931A3B9D1BFDAF935429"
    }
  }
]
```

The `metadata` field contains `clientId` and `tabId` which can be used for screenshot capture and other CDP operations.

### CDP Endpoints

#### `POST /page/screenshot`

Capture screenshot of a specific browser tab.

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
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "482D56EE57B1931A3B9D1BFDAF935429",
  "imageData": "data:image/png;base64,iVBORw0KG...",
  "format": "png",
  "fullPage": false,
  "timestamp": 1234567890
}
```

#### `POST /page/content`

Get HTML or text content of a page.

**Request:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "482D56EE57B1931A3B9D1BFDAF935429",
  "format": "html"
}
```

**Response:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "482D56EE57B1931A3B9D1BFDAF935429",
  "content": "<html>...</html>",
  "format": "html",
  "length": 12345,
  "timestamp": 1234567890
}
```

#### `POST /tabs/open`

Open a new browser tab.

**Request:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "url": "https://example.com",
  "background": false
}
```

**Response:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "NEW_TAB_ID",
  "compositeClientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306:NEW_TAB_ID",
  "url": "https://example.com",
  "status": "opened"
}
```

#### `POST /tabs/close`

Close a browser tab.

**Request:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "TAB_ID_TO_CLOSE"
}
```

**Response:**
```json
{
  "clientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
  "tabId": "TAB_ID_TO_CLOSE",
  "status": "closed",
  "success": true
}
```

### Status Endpoints

#### `GET /status`

Get server health and connected clients.

**Response:**
```json
{
  "server": {
    "running": true,
    "uptime": 12345,
    "connections": 1
  },
  "clients": [
    {
      "id": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
      "name": "DevTools Client",
      "connected": true,
      "ready": true
    }
  ]
}
```

#### `GET /clients`

List all connected clients with their tabs.

**Response:**
```json
[
  {
    "id": "9907fd8d-92a8-4a6a-bce9-458ec8c57306",
    "name": "DevTools Client",
    "description": "Browser automation agent",
    "tabCount": 3,
    "tabs": [
      {
        "tabId": "482D56EE57B1931A3B9D1BFDAF935429",
        "compositeClientId": "9907fd8d-92a8-4a6a-bce9-458ec8c57306:482D56EE57B1931A3B9D1BFDAF935429",
        "connected": true,
        "ready": true,
        "connectedAt": "2025-01-15T10:30:00.000Z",
        "remoteAddress": "::ffff:172.18.0.1"
      }
    ]
  }
]
```

## WebSocket Protocol

Browser agents connect to the WebSocket server and implement JSON-RPC 2.0 protocol.

### Connection Flow

1. **Connect to WebSocket**
   ```
   ws://localhost:8080
   ```

2. **Send Registration**
   ```json
   {
     "type": "register",
     "clientId": "unique-client-id",
     "secretKey": "your-auth-key",
     "capabilities": ["browser-automation"]
   }
   ```

3. **Send Ready Signal**
   ```json
   {
     "type": "ready"
   }
   ```

4. **Handle RPC Calls**

   Server sends JSON-RPC 2.0 requests:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "evaluate",
     "params": {
       "tool": "action_agent",
       "input": {"objective": "Click submit button"},
       "model": {...}
     },
     "id": "request-id"
   }
   ```

   Agent responds:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "request-id",
     "result": {
       "status": "completed",
       "output": "Task completed successfully"
     }
   }
   ```

## Chrome DevTools Protocol Setup

The browser must be started with remote debugging enabled:

```bash
chromium --remote-debugging-port=9223
```

The CDP endpoint is accessible at:
- HTTP: `http://localhost:9223/json/version`
- WebSocket: `ws://localhost:9223/devtools/browser/{browserId}`

## Usage with Evals Framework

The eval-server is designed to work with the separate `evals/` Python project:

1. **Start eval-server:**
   ```bash
   cd eval-server/nodejs
   npm start
   ```

2. **Run evaluations from evals/:**
   ```bash
   cd evals
   python3 run.py --path action-agent/accordion-001.yaml --verbose
   ```

The evals framework:
- Sends tasks to `/v1/responses` endpoint
- Extracts `clientId` and `tabId` from response metadata
- Captures screenshots via `/page/screenshot`
- Uses LLM judges (LLMJudge, VisionJudge) to evaluate results
- Generates reports and saves screenshots

See `evals/README.md` for detailed evaluation framework documentation.

## Dependencies

Core dependencies:
- **ws** - WebSocket server
- **uuid** - ID generation
- **winston** - Structured logging
- **dotenv** - Environment variable management

## Logging

Logs are written to `logs/` directory (auto-created):
- `combined.log` - All log events
- `error.log` - Error events only
- `api.log` - API request/response logs

## Docker Integration

The eval-server runs inside the `kernel-browser-extended` Docker container. Volume mount for live development:

```yaml
# docker-compose.yml
volumes:
  - "./eval-server/nodejs:/opt/eval-server"
```

## Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Check status
curl http://localhost:8081/status

# Test screenshot capture
curl -X POST http://localhost:8081/page/screenshot \
  -H "Content-Type: application/json" \
  -d '{"clientId":"CLIENT_ID","tabId":"TAB_ID","fullPage":false}'
```

## License

MIT License
