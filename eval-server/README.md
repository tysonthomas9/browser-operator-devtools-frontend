# Eval-Server

A WebSocket-based evaluation server for LLM agents with multiple language implementations.

## Overview

This directory contains two functionally equivalent implementations of the bo-eval-server:

- **NodeJS** (`nodejs/`) - Full-featured implementation with YAML evaluations, HTTP API, CLI, and judge system
- **Python** (`python/`) - Minimal library focused on core WebSocket functionality and programmatic evaluation creation

Both implementations provide:
- 🔌 **WebSocket Server** - Real-time agent connections
- 🤖 **Bidirectional RPC** - JSON-RPC 2.0 for calling agent methods  
- 📚 **Programmatic API** - Create and manage evaluations in code
- ⚡ **Concurrent Support** - Handle multiple agents simultaneously
- 📊 **Structured Logging** - Comprehensive evaluation tracking
- 🌐 **OpenAI-Compatible API** - Standard REST endpoints for seamless integration

## Quick Start

### NodeJS (Full Featured)

The NodeJS implementation includes YAML evaluation loading, HTTP API wrapper, CLI tools, and LLM-as-a-judge functionality.

```bash
cd nodejs/
npm install
npm start
```

**Key Features:**
- YAML evaluation file loading
- HTTP API wrapper for REST integration  
- Interactive CLI for management
- LLM judge system for response evaluation
- Comprehensive documentation and examples

See [`nodejs/README.md`](nodejs/README.md) for detailed usage.

### Python (Lightweight Library)

The Python implementation focuses on core WebSocket functionality with programmatic evaluation creation.

```bash
cd python/
pip install -e .
python examples/basic_server.py
```

**Key Features:**
- Minimal dependencies (websockets, loguru)
- Full async/await support
- Evaluation stack for LIFO queuing
- Type hints throughout
- Clean Pythonic API

See [`python/README.md`](python/README.md) for detailed usage.

## OpenAI-Compatible API

Both implementations now include OpenAI-compatible HTTP endpoints that provide seamless integration with existing OpenAI clients and tools.

### Architecture

```
┌─────────────────┐    HTTP     ┌──────────────────┐    WebSocket    ┌─────────────────┐
│ OpenAI Client   │ ──────────→ │ OpenAI HTTP      │ ──────────────→ │ WebSocket       │
│ (External)      │             │ Wrapper          │                 │ Eval Server     │
└─────────────────┘             └──────────────────┘                 └─────────────────┘
                                                                               │
                                                                               │ RPC
                                                                               ▼
                                                          ┌─────────────────────────────────────┐
                                                          │ Connected DevTools Tabs             │
                                                          │ ┌─────┐ ┌─────┐ ┌─────┐           │
                                                          │ │Tab 1│ │Tab 2│ │Tab N│ ...       │
                                                          │ └─────┘ └─────┘ └─────┘           │
                                                          └─────────────────────────────────────┘
```

### Supported Endpoints

- **`GET /v1/models`** - List available models from connected DevTools tabs
- **`POST /v1/chat/completions`** - OpenAI-compatible chat completions
- **`GET /health`** - Health check and status

### Usage Example

```bash
# List available models
curl http://localhost:8081/v1/models

# Send a chat completion request
curl -X POST http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Request Flow

1. **External client** sends OpenAI-compatible HTTP request
2. **HTTP wrapper** converts request to evaluation format  
3. **WebSocket server** selects connected DevTools tab
4. **RPC call** sent to tab via existing JSON-RPC protocol
5. **Tab processes** request using Browser Operator's LLM system
6. **Response flows back** through WebSocket → HTTP → OpenAI format

## Architecture Comparison

| Feature | NodeJS | Python |
|---------|--------|--------|
| **Core WebSocket Server** | ✅ | ✅ |
| **JSON-RPC 2.0** | ✅ | ✅ |
| **Client Management** | ✅ | ✅ |
| **Programmatic Evaluations** | ✅ | ✅ |
| **Evaluation Stack** | ✅ | ✅ |
| **Structured Logging** | ✅ (Winston) | ✅ (Loguru) |
| **YAML Evaluations** | ✅ | ❌ |
| **HTTP API Wrapper** | ✅ | ❌ |
| **OpenAI-Compatible API** | ✅ | ✅ |
| **CLI Interface** | ✅ | ❌ |
| **LLM Judge System** | ✅ | ❌ |
| **Type System** | TypeScript | Type Hints |

## Choosing an Implementation

**Choose NodeJS if you need:**
- YAML-based evaluation definitions
- HTTP REST API endpoints
- Interactive CLI for management
- LLM-as-a-judge evaluation
- Comprehensive feature set

**Choose Python if you need:**
- Minimal dependencies
- Pure programmatic approach
- Integration with Python ML pipelines
- Modern async/await patterns
- Lightweight deployment

## Agent Protocol

Both implementations use the same WebSocket protocol:

### 1. Connect to WebSocket
```javascript
// NodeJS
const ws = new WebSocket('ws://localhost:8080');

// Python
import websockets
ws = await websockets.connect('ws://localhost:8080')
```

### 2. Send Registration
```json
{
  "type": "register",
  "clientId": "your-client-id",
  "secretKey": "your-secret-key", 
  "capabilities": ["chat", "action"]
}
```

### 3. Send Ready Signal
```json
{
  "type": "ready"
}
```

### 4. Handle RPC Calls
Both implementations send JSON-RPC 2.0 requests with the `evaluate` method:

```json
{
  "jsonrpc": "2.0",
  "method": "evaluate", 
  "params": {
    "id": "eval_001",
    "name": "Test Evaluation",
    "tool": "chat",
    "input": {"message": "Hello world"}
  },
  "id": "unique-call-id"
}
```

Agents should respond with:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-call-id",
  "result": {
    "status": "completed",
    "output": {"response": "Hello! How can I help you?"}
  }
}
```

## Examples

### NodeJS Example
```javascript
import { EvalServer } from 'bo-eval-server';

const server = new EvalServer({
  authKey: 'secret',
  port: 8080
});

server.onConnect(async client => {
  const result = await client.evaluate({
    id: "test",
    name: "Hello World", 
    tool: "chat",
    input: {message: "Hi there!"}
  });
  console.log(result);
});

await server.start();
```

### Python Example
```python
import asyncio
from bo_eval_server import EvalServer

async def main():
    server = EvalServer(
        auth_key='secret',
        port=8080
    )
    
    @server.on_connect
    async def handle_client(client):
        result = await client.evaluate({
            "id": "test",
            "name": "Hello World",
            "tool": "chat", 
            "input": {"message": "Hi there!"}
        })
        print(result)
    
    await server.start()
    await server.wait_closed()

asyncio.run(main())
```

## Development

Each implementation has its own development setup:

**NodeJS:**
```bash
cd nodejs/
npm install
npm run dev    # Watch mode
npm test       # Run tests
npm run cli    # Interactive CLI
```

**Python:**
```bash
cd python/
pip install -e ".[dev]"
pytest         # Run tests  
black .        # Format code
mypy src/      # Type checking
```

## Contributing

When contributing to either implementation:

1. Maintain API compatibility between versions where possible
2. Update documentation for both implementations when adding shared features
3. Follow the existing code style and patterns
4. Add appropriate tests and examples

## License

MIT License - see individual implementation directories for details.

---

Both implementations provide robust, production-ready evaluation servers for LLM agents with different feature sets optimized for different use cases.