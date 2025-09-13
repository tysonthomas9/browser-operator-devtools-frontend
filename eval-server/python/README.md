# bo-eval-server (Python)

A minimal Python library for creating WebSocket-based evaluation servers for LLM agents.

## Features

- 🔌 **WebSocket Server**: Real-time agent connections with asyncio
- 🤖 **Bidirectional RPC**: JSON-RPC 2.0 for calling methods on connected agents
- 📚 **Programmatic API**: Create and manage evaluations in Python code
- 📊 **Evaluation Stack**: LIFO stack for managing evaluation queues
- ⚡ **Concurrent Support**: Full async/await support for multiple agents
- 🔍 **Enhanced Logging**: Structured logging with loguru
- ✨ **Minimal Dependencies**: Only websockets and loguru required

## Quick Start

### Basic WebSocket Server

```python
import asyncio
from bo_eval_server import EvalServer

async def main():
    server = EvalServer(
        auth_key='hello',
        host='127.0.0.1',
        port=8080
    )
    
    @server.on_connect
    async def handle_client(client):
        print(f'Client connected: {client.id}')
        
        response = await client.evaluate({
            "id": "test_eval",
            "name": "Capital of France",
            "tool": "chat",
            "input": {"message": "What is the capital of France?"}
        })
        
        print(f'Response: {response}')
    
    await server.start()
    print('Server running on ws://127.0.0.1:8080')
    
    # Keep server running
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
```

### Using Evaluation Stack

```python
import asyncio
from bo_eval_server import EvalServer, EvaluationStack

async def main():
    server = EvalServer(auth_key='secret', port=8080)
    stack = EvaluationStack()
    
    # Add evaluations to stack
    stack.push({
        "id": "eval_001",
        "name": "Math Question",
        "tool": "chat",
        "input": {"message": "What is 2 + 2?"}
    })
    
    stack.push({
        "id": "eval_002", 
        "name": "Science Question",
        "tool": "chat",
        "input": {"message": "What is the speed of light?"}
    })
    
    @server.on_connect
    async def handle_client(client):
        print(f'Client connected: {client.id}')
        
        # Process evaluations from stack
        while not stack.is_empty():
            evaluation = stack.pop()
            try:
                result = await client.evaluate(evaluation)
                print(f'✅ {evaluation["name"]}: {result["status"]}')
            except Exception as e:
                print(f'❌ {evaluation["name"]}: {e}')
    
    await server.start()
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
```

## Installation

### Using uv (Recommended)

```bash
# Install uv package manager (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies and create virtual environment
uv sync

# Run examples using the convenient runner
python run.py basic      # Basic server example
python run.py stack      # Evaluation stack example  
python run.py prog       # Programmatic evaluations example
python run.py all        # Show all available examples

# Or run examples directly with uv
uv run python examples/basic_server.py
uv run python examples/with_stack.py
uv run python examples/programmatic_evals.py
```

### Using pip (Alternative)

```bash
# Install the package
pip install -e .

# Or install with development dependencies
pip install -e ".[dev]"

# Or install from requirements.txt
pip install -r requirements.txt
```

## Library Usage

### EvalServer API

```python
from bo_eval_server import EvalServer

# Create server instance
server = EvalServer(
    auth_key='your-secret-key',  # Required: client authentication
    host='127.0.0.1',           # Optional: default 'localhost'
    port=8080,                  # Optional: default 8080
)

# Register event handlers
@server.on_connect
async def handle_connect(client):
    # Called when client connects and is ready
    pass

@server.on_disconnect  
async def handle_disconnect(client_info):
    # Called when client disconnects
    pass

# Server lifecycle
await server.start()        # Start the server
await server.stop()         # Stop the server
await server.wait_closed()  # Wait for server to close

# Server status
status = server.get_status()
print(f"Server running: {status['running']}")
```

### Client Proxy API

```python
@server.on_connect
async def handle_client(client):
    # Client information
    print(f'Client ID: {client.id}')
    print(f'Tab ID: {client.tab_id}')
    print(f'Base Client ID: {client.base_client_id}')
    
    # Execute evaluations
    result = await client.evaluate({
        "id": "eval_001",
        "name": "Test Evaluation",
        "description": "Optional description",
        "tool": "chat",
        "input": {"message": "Your question here"},
        "timeout": 30.0,  # Optional timeout in seconds
        "metadata": {"tags": ["api", "test"]}
    })
    
    # Send custom messages
    await client.send_message({
        "type": "custom", 
        "data": "Hello client!"
    })
```

### EvaluationStack API

```python
from bo_eval_server import EvaluationStack

stack = EvaluationStack()

# Add evaluations (LIFO - Last In, First Out)
stack.push({
    "id": "eval_001",
    "name": "Test",
    "tool": "chat", 
    "input": {"message": "Hello"}
})

# Remove and get evaluation
evaluation = stack.pop()  # Returns dict or None if empty

# Stack operations
size = stack.size()           # Get number of evaluations
is_empty = stack.is_empty()   # Check if empty
top = stack.peek()            # View top without removing
stack.clear()                 # Remove all evaluations
all_evals = stack.to_array()  # Get copy as list
```

## Agent Protocol

Your agent needs to implement the WebSocket protocol:

### 1. Connect to WebSocket
```python
import websockets
import json

ws = await websockets.connect('ws://localhost:8080')
```

### 2. Receive Authentication Challenge
The server sends an authentication challenge with the secret key:
```python
challenge = json.loads(await ws.recv())
# Expected: {"type": "auth_challenge", "secretKey": "hello", "connectionId": "uuid"}
```

### 3. Send Registration Response
Client validates the secret key and responds:
```python
await ws.send(json.dumps({
    "type": "register",
    "clientId": "your-client-id",
    "acceptAuth": True,  # True if secret key is acceptable
    "connectionId": challenge["connectionId"],
    "capabilities": ["chat", "action"]
}))
```

### 4. Receive Registration Confirmation
```python
confirmation = json.loads(await ws.recv())
# Expected: {"type": "registered", "clientId": "your-client-id", "serverTime": 123456}
```

### 5. Send Ready Signal
```python
await ws.send(json.dumps({"type": "ready"}))
```

### 6. Handle RPC Calls
```python
async for message in ws:
    data = json.loads(message)
    
    if data.get("jsonrpc") == "2.0" and data.get("method") == "evaluate":
        # Handle evaluation request
        result = await handle_evaluation(data["params"])
        
        # Send response
        await ws.send(json.dumps({
            "jsonrpc": "2.0",
            "id": data["id"],
            "result": result
        }))
```

## Architecture

```
src/bo_eval_server/
├── __init__.py           # Package exports
├── eval_server.py        # Main EvalServer class
├── evaluation_stack.py   # EvaluationStack implementation
├── client_manager.py     # Client connection management
├── rpc_client.py         # JSON-RPC client implementation
├── config.py             # Configuration management
└── logger.py             # Enhanced logging setup
```

## Design Principles

- **Async-First**: Built on asyncio for high concurrency
- **Minimal Dependencies**: Only essential packages required
- **Type Hints**: Full typing support for better development experience
- **Event-Driven**: React to client connections with decorators
- **Programmatic**: Full control through Python code
- **Clean API**: Simple, Pythonic interface

## Examples

See the `examples/` directory for complete working examples:

- `basic_server.py` - Simple WebSocket server setup
- `with_stack.py` - Using evaluation stack for queuing
- `programmatic_evals.py` - Creating evaluations in code

## Evaluation Scripts

The `evals/` directory contains ready-to-use evaluation scripts for various benchmarks:

- `browsecomp_eval_server.py` - Browsecomp benchmark server (1,266 web browsing questions)
  - **Quick start**: `./evals/run_browsecomp_eval_server.sh --limit 1`
  - **Auto-launch**: `uv run python browsecomp_eval_server.py --limit 1 --auto-launch`
  - **With Langfuse**: Edit `.env` file, then run the script - scores automatically upload
  - Configuration status shown on startup
  - See `evals/README.md` for detailed usage

## Langfuse Integration

The eval-server includes optional integration with [Langfuse](https://langfuse.com) for experiment tracking, tracing, and evaluation scoring. When enabled, the server automatically:

- ✅ Attaches scores to agent traces for evaluation results
- 📊 Supports dataset-driven evaluation runs 
- 🔗 Correlates server-side scores with agent-side traces
- ⚡ Provides dual scoring (agent traces + dataset runs)

### Setup

1. **Install dependencies**:
```bash
# Using uv (recommended)
uv add langfuse python-dotenv

# Or using pip
pip install langfuse>=2.0.0 python-dotenv>=1.0.0
# or
pip install -r requirements.txt
```

2. **Configure Langfuse (Option A: .env file - Recommended)**:
```bash
# Copy the template
cp .env.example .env

# Edit .env with your Langfuse credentials
nano .env
```

Set these values in your `.env` file:
```bash
LANGFUSE_ENABLE=true
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=pk-lf-your-actual-key
LANGFUSE_SECRET_KEY=sk-lf-your-actual-secret
```

**Configure Langfuse (Option B: Environment Variables)**:
```bash
export LANGFUSE_ENABLE=true
export LANGFUSE_HOST=https://cloud.langfuse.com  # or your self-hosted instance
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_SECRET_KEY=sk-lf-...
```

3. **Agent Configuration**: Ensure your agent (e.g., DevTools AI Chat) uses the same Langfuse project for trace alignment.

### Basic Usage

The integration works automatically once environment variables are set. When agents return `traceId` in evaluation results, the server attaches scores to those traces:

```python
# Server automatically extracts traceId from agent responses
# and attaches these scores to the agent's trace:
# - task_success: 0/1 for evaluation completion
# - execution_time: Duration in seconds
```

### Dataset Runs

Use the included `langfuse_dataset_runner.py` for complete dataset evaluations:

```bash
# Run evaluation against a Langfuse dataset
uv run python examples/langfuse_dataset_runner.py \
  --run-name "experiment-2025-01-15" \
  --dataset "my-evaluation-dataset" \
  --model "gpt-4o" \
  --timeout 60

# With custom parameters
uv run python examples/langfuse_dataset_runner.py \
  --run-name "prompt-variant-test" \
  --dataset "browsing-tasks" \
  --model "gpt-4o" \
  --prompt-variant "v2" \
  --toolset "search,action" \
  --max-items 10
```

**How Dataset Fetching Works:**
1. **Fetch Dataset**: Uses `client.get_dataset(dataset_name)` to fetch dataset from Langfuse
2. **Process Items**: Iterates through `dataset.items` for evaluation data
3. **Run Evaluations**: Executes each item via connected agents
4. **Dual Scoring**: Scores both agent traces and dataset runs
5. **Upload Results**: Automatic score upload to Langfuse for analysis

**Dataset Item Format:** Each dataset item should have this structure:
```json
{
  "input": {
    "tool": "chat|action|research",
    "input": {"message": "Your question here"},
    "url": "https://optional-url.com"
  },
  "expected_output": "Expected answer"
}
```

### Browsecomp with Langfuse

The browsecomp eval server automatically integrates with Langfuse when configured:

```bash
# 1. Set up Langfuse configuration
cp .env.example .env
# Edit .env with your Langfuse credentials

# 2. Run browsecomp evaluations - scores upload automatically
./evals/run_browsecomp_eval_server.sh --limit 1

# 3. View results in Langfuse UI
# - Agent traces show detailed execution steps
# - Automatic scores: task_success (0/1), execution_time (seconds)  
# - Browsecomp question metadata included in traces
```

**Configuration status is displayed on startup:**
- ✅ **Enabled**: Shows Langfuse host and confirms credential setup
- ❌ **Disabled**: Lists missing configuration requirements

### Browsecomp Commands Reference

**Basic Commands:**
```bash
# Manual connection (traditional workflow)
uv run python browsecomp_eval_server.py --limit 1

# Auto-launch Browser Operator (enhanced workflow) 
uv run python browsecomp_eval_server.py --limit 1 --auto-launch

# Custom timeout (default: 120s, auto-adjusts to 600s with --auto-launch)
uv run python browsecomp_eval_server.py --limit 1 --timeout 30

# Custom port (default: 8080)
uv run python browsecomp_eval_server.py --limit 1 --port 8087 --auto-launch

# Named evaluation run (for Langfuse organization)
uv run python browsecomp_eval_server.py --limit 5 --run-name "experiment-v2" --auto-launch
```

**Advanced Auto-Launch Options:**
```bash
# Custom Browser Operator path
uv run python browsecomp_eval_server.py --limit 1 --auto-launch \
  --browser-path "/Applications/Browser Operator.app/Contents/MacOS/Browser Operator"

# Full production run with auto-launch (processes all 1,266 questions)
uv run python browsecomp_eval_server.py --auto-launch --run-name "full-eval-$(date +%Y%m%d)"

# Debug specific questions (by index)
uv run python browsecomp_eval_server.py --limit 1 --offset 42 --auto-launch
```

**Auto-Launch Features:**
- ✅ **Automatic timeout adjustment**: 10s → 600s (10 minutes) when using `--auto-launch`
- ✅ **DevTools auto-open**: `--auto-open-devtools-for-tabs` flag enabled
- ✅ **Remote debugging**: CDP enabled on port 9222
- ✅ **AI Assistant panel**: Automatically opens via AppleScript/CDP integration
- ✅ **Process management**: Proper cleanup on server shutdown
- ✅ **Shared dataset**: All runs use `browsecomp-eval` dataset (no timestamp splitting)

**Command Line Arguments:**
```
--limit N          Process only first N questions (default: unlimited)
--timeout SECONDS  Evaluation timeout (auto-adjusts to 600s with --auto-launch)  
--port PORT        Server port (default: 8080)
--auto-launch      Auto-launch Browser Operator with DevTools
--browser-path     Path to Browser Operator executable
--run-name NAME    Optional run name for Langfuse organization
--offset N         Start from question N (0-indexed)
```

**Usage Patterns:**
```bash
# Quick single-question test with auto-launch
uv run python browsecomp_eval_server.py --limit 1 --auto-launch

# Batch evaluation with custom run tracking
uv run python browsecomp_eval_server.py --limit 10 --auto-launch \
  --run-name "model-comparison-gpt4" --port 8088

# Full production evaluation  
uv run python browsecomp_eval_server.py --auto-launch \
  --run-name "production-$(date +%Y%m%d-%H%M)"
```

### Environment Variables

```bash
# Langfuse configuration
LANGFUSE_ENABLE=true                    # Enable/disable integration
LANGFUSE_HOST=https://cloud.langfuse.com # Langfuse server URL
LANGFUSE_PUBLIC_KEY=pk-lf-...           # Your public key
LANGFUSE_SECRET_KEY=sk-lf-...           # Your secret key

# Optional settings
LANGFUSE_PROJECT=your-project           # Project name (if multiple)
LANGFUSE_ENV=production                 # Environment tag
LANGFUSE_PROMPT_NAME=my-prompt          # For prompt management
LANGFUSE_PROMPT_VARIANT=v1              # Prompt variant
```

### Creating Datasets in Langfuse

**Method 1: Langfuse UI**
1. Go to your Langfuse project → Datasets
2. Create a new dataset with the name you'll reference in scripts
3. Add items using the UI with the format below

**Method 2: SDK (Programmatic)**
```python
from langfuse import get_client

client = get_client()

# Create dataset
dataset = client.create_dataset(name="my-evaluations")

# Add items
client.create_dataset_item(
    dataset_name="my-evaluations",
    input={
        "tool": "chat",
        "input": {"message": "What is the capital of France?"},
        "url": "https://example.com"  # optional
    },
    expected_output="Paris"
)
```

**Dataset Item Format:**
```json
{
  "input": {
    "tool": "chat",
    "input": {
      "message": "What is the capital of France?"
    },
    "url": "https://example.com"
  },
  "expected_output": "Paris"
}
```

Supported tools: `chat`, `action`, `research`, or any tool your agent supports.

### Features

**Automatic Scoring**: Server attaches scores to agent traces:
- `task_success`: 0 (failed) or 1 (succeeded)
- `execution_time`: Duration in seconds
- Custom scores based on your evaluation logic

**Dual Correlation**: Scores appear in both places:
- **Agent traces**: Detailed execution steps with scores
- **Dataset runs**: Run-level summaries and comparisons

**Trace Alignment**: Server uses `traceId` returned by agents to score the correct trace, avoiding duplication.

**Fallback Handling**: If `traceId` is missing, scores are recorded to dataset run with correlation metadata.

### Debugging

```bash
# Check if Langfuse is enabled
python -c "from bo_eval_server.langfuse_tracer import get_tracer; print(f'Enabled: {get_tracer()._enabled}')"

# Test connection
python -c "
from langfuse import get_client
client = get_client()
print('✓ Connected to Langfuse')
print(f'Projects: {[p.name for p in client.get_projects()]}')
"
```

## Development

### Using uv

```bash
# Install with development dependencies
uv sync --dev

# Run tests
uv run pytest

# Format code
uv run black src/ examples/

# Type checking
uv run mypy src/

# Run all development commands
uv run pytest && uv run black src/ examples/ && uv run mypy src/
```

### Using pip

```bash
# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/ examples/

# Type checking
mypy src/
```

## Environment Variables

```bash
# Optional configuration
BO_EVAL_SERVER_HOST=localhost
BO_EVAL_SERVER_PORT=8080
BO_EVAL_SERVER_LOG_LEVEL=INFO
```

---

This Python implementation provides the core WebSocket evaluation server functionality with a clean, async API for programmatic evaluation management.


uv run python browsecomp_eval_server.py --limit 1 --timeout 60 --auto-launch --llm-judge