# Eval‑Server Architecture

This document explains the architecture of the evaluation server framework contained in `eval-server/`. The framework powers evaluation workflows for agent clients (e.g., Chrome DevTools) over WebSocket using a shared JSON‑RPC 2.0 protocol. Two implementations are provided:

- NodeJS: full‑featured (YAML evals, HTTP API, CLI, LLM judge)
- Python: lightweight async library (programmatic evals, evaluation stack)

Related docs: `nodejs/docs/PROTOCOL.md`, `nodejs/docs/CLIENT_SETUP.md`, `nodejs/docs/YAML_SCHEMA.md`, `nodejs/README.md`, `python/README.md`.

## High‑Level Topology

```
            ┌────────────────────────────────────────────────┐
            │                Eval Server (WS)                │
            │                                                │
            │  • Connection + auth handshake                 │
            │  • Client/Tab tracking                         │
            │  • Dispatch JSON‑RPC evaluate requests         │
            │  • Optional LLM judge                          │
            │  • Structured logging                          │
            └────────────────────────────────────────────────┘
                        ▲                           ▲
                        │                           │
                        │                           │ optional
                        │                           │
                        │                           ▼
         ┌────────────────────────┐      ┌──────────────────────────┐
         │   Agent Clients (WS)   │      │     HTTP API Wrapper     │
         │  (e.g., DevTools)      │      │  (/status, /clients,     │
         │  • Register + Ready    │      │   /evaluate, /v1/responses)│
         │  • Execute tools       │      └──────────────────────────┘
         │  • Return JSON‑RPC     │
         └────────────────────────┘

            Filesystem: YAML client + evaluation definitions
            Logs: JSONL + console/file
```

## Shared Protocol (WS + JSON‑RPC)

Handshake sequence (see `nodejs/docs/PROTOCOL.md` for details):

1) Server → Client: `welcome`
2) Client → Server: `register { clientId, secretKey?, capabilities }`
3) Server → Client: `registration_ack`
   - `auth_required` with `serverSecretKey` (Node) or `accepted/rejected`
4) Client → Server: `auth_verify { clientId, verified }` (Node)
5) Server → Client: `registration_ack { status: 'accepted' }`
6) Client → Server: `ready`

Evaluation exchange (JSON‑RPC 2.0 over WebSocket):

- Server → Client request:
  `{ jsonrpc: '2.0', method: 'evaluate', params: { evaluationId, tool, input, url?, model?, timeout?, metadata? }, id }`
- Client → Server success:
  `{ jsonrpc: '2.0', result: { status, output, executionTime, toolCalls, metadata }, id }`
- Client → Server error:
  `{ jsonrpc: '2.0', error: { code, message, data }, id }`

Clients can emit status updates during execution: `{ type: 'status', evaluationId, status, progress?, message? }`.

## Data Model & Configuration

- Client configuration YAMLs: `nodejs/clients/<clientId>.yaml`
  - `client`: `id`, `name`, `secret_key`, `description`
  - `settings`: concurrency, default timeout, retry policy

- Evaluation definitions: `nodejs/evals/<category>/*.yaml`
  - `id`, `name`, `description`, `enabled`, `tool`, `timeout`, `input`, `target`, `validation`, `metadata`
  - `nodejs/evals/config.yaml` provides default model config.

- Model precedence (Node): API overrides > per‑eval YAML `model` > `evals/config.yaml` defaults.

- Logging:
  - Node: Winston (`logs/combined.log`, `logs/error.log`, `logs/evaluations.jsonl`)
  - Python: loguru (console + rotating files, JSONL filter for evaluation events)

## NodeJS Architecture

Location: `eval-server/nodejs/src/`

- `lib/EvalServer.js`
  - WebSocket server (ws). Emits `clientConnected`/`clientDisconnected`.
  - Handshake: sends `welcome`, handles `register` → sends `registration_ack (auth_required)` with server secret → expects `auth_verify` → marks registered on success → awaits `ready`.
  - `ClientProxy`: `evaluate(evaluation)` to dispatch RPC calls via `RpcClient`.
  - `executeEvaluation`: builds RPC params (tool/input/url/model/timeout), updates status, optionally validates via judge, logs structured results.
  - Accessors: `getStatus`, `loadEvaluations`, `getEvaluations`, `setJudge`.

- `client-manager.js`
  - Loads client YAMLs from `clients/` (auto‑create when missing).
  - Loads evaluations from `evals/<category>/` and applies model precedence.
  - Tracks active client tabs via composite IDs `baseClientId:tabId` (register/unregister/list/cleanup).
  - Maintains evaluation state per client (pending/running/completed/failed, last results).

- `lib/EvaluationLoader.js`
  - Scans `evals/`, validates required fields (`id`, `name`, `tool`), indexes by id/category, filtering/stats.
  - Programmatic creation/update/removal of evaluations.

- `lib/HTTPWrapper.js` + `api-server.js`
  - Optional REST API on top of `EvalServer`.
  - Endpoints: `/status`, `/clients`, `/clients/:id/evaluations`, `/evaluate` (single/batch), `/v1/responses` (OpenAI Responses‑compatible dynamic chat evals).

- `lib/judges/Judge.js`, `lib/judges/LLMJudge.js`
  - Judge interface; `LLMJudge` uses OpenAI to evaluate/score outputs; returns normalized result with metadata.

- `rpc-client.js`
  - JSON‑RPC request/response correlation and timeouts; logs per call status.

- `logger.js`, `config.js`
  - Winston logging and env‑driven configuration (ports, log level, RPC timeout, LLM settings).

- CLI: `src/cli/CLI.js`
  - Commands: `status`, `clients`, `clients-connected`, `list-tabs`, `run`, `run-all`, `run-tab`, `load-evals`, `list-evals`, `eval`.

## Python Architecture

Location: `eval-server/python/src/bo_eval_server/`

- `eval_server.py`
  - Async `websockets` server with decorators `@on_connect` / `@on_disconnect`.
  - Concurrency limiter via `asyncio.Semaphore` for evaluation execution.

- `client_manager.py`
  - Handles connection handshake (`welcome` → `register` → `registration_ack` → `ready`).
  - Creates a `ClientProxy` per connection; logs connection lifecycle.

- `rpc_client.py`
  - JSON‑RPC client with pending call tracking, timeouts, structured logging.

- `evaluation_stack.py`
  - LIFO stack to queue programmatic evaluations and distribute to connected clients.

- `logger.py`, `config.py`
  - loguru logging setup (console/files/JSONL); configuration with validation.

- Example eval servers & utilities: `python/evals/*` (e.g., Browsecomp server with scoring, results JSON, progress tracking).

## Key Flows

Startup:
- Node: start `EvalServer` (optionally `HTTPWrapper`); load clients/evals; wait for connections.
- Python: create `EvalServer`, register handlers, `await server.start()` and `await server.wait_closed()`.

Registration & Tabs:
- Client connects, receives `welcome`, sends `register`.
- Node: auto‑create client YAML if unknown; sends `registration_ack` with `serverSecretKey`; client returns `auth_verify`; on success, server registers tab by `baseClientId:tabId` and maps connection to composite id.
- Python: accepts `register` (verifies optional secret against configured `auth_key`); sends `registration_ack accepted`; awaits `ready`.

Evaluation Dispatch:
- Server chooses an evaluation (from YAML list or programmatic) and calls `ClientProxy.evaluate`.
- Server sends JSON‑RPC `evaluate` with `params` (including `tool` and `input`).
- Client executes the tool (or chat via AgentService in DevTools), emits status updates, returns success/error.
- Node optionally runs `LLMJudge` and stores results; both implementations log structured events.

Observability:
- Logs contain connection, RPC, and evaluation records.
- Node CLI and HTTP API expose status, clients, and evaluation triggering; Python examples print progress and save results.

## Extensibility

- Add/Organize Evaluations: place YAML files under `nodejs/evals/<category>/`; use tags/categories to filter.
- Programmatic Evaluations: use `EvaluationLoader.createEvaluation` (Node) or call `client.evaluate({...})` with complete parameters (Node/Python).
- New Judges (Node): implement `Judge` subclass and set with `server.setJudge(judge)`.
- Tools: server is tool‑agnostic; agent side (`ToolRegistry` in DevTools) resolves `tool` names.
- Tabs/Multiple Instances: use composite client IDs (`baseClientId:tabId`) to target specific tabs.

## Security & Production Hardening

- Transport: use WSS in production; terminate TLS at a reverse proxy or within the server process.
- Authentication (Node): the current flow shares `serverSecretKey` for client verification (developer‑friendly but not zero‑knowledge). Prefer mutual secret proof (e.g., HMAC/challenge‑response) and avoid sending raw secrets.
- Client Auto‑Create: convenient in dev; disable or gate behind configuration in production.
- HTTP API: protect endpoints with authentication/authorization; consider rate limiting and CORS restrictions.
- Secrets: avoid committing plaintext secrets in YAML; prefer environment‑backed vaults or hashed storage for long‑lived credentials.

## Runbook (Quick Reference)

NodeJS (full server + HTTP API):
- `cd eval-server/nodejs && npm install && npm start`
- CLI: `npm run cli` (interactive management)

NodeJS (library only):
- `npm run lib:example` or run `examples/library-usage.js`

Python (library/examples):
- `cd eval-server/python && uv sync`
- `python examples/basic_server.py` (or `python run.py basic`)

DevTools Client (example):
- Connect with `front_end/panels/ai_chat/evaluation/remote/EvaluationAgent.ts` configured endpoint; the agent registers, sends `ready`, then handles `evaluate` RPCs.

## Known Limitations / Next Steps

- Authentication robustness: improve Node auth to avoid sending secrets in clear over WS; add optional mTLS or signed challenges.
- Concurrency: Node advertises `MAX_CONCURRENT_EVALUATIONS` but does not enforce a semaphore; add if strict limits are required.
- Client assignment strategy: Node currently loads all evals and makes them available to all clients; add per‑client filtering/targeting as needed.
- Parity: LLM judge exists only in Node; consider a Python counterpart if symmetry is desired.

