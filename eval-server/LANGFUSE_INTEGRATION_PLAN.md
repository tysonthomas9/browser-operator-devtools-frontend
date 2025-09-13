# Langfuse Integration Plan

This document outlines how to integrate Langfuse prompt management, tracing, and evaluation with the existing eval-server. The goal is to enable experiment tracking (prompts/tools/models), dataset-driven runs, and run-to-run comparisons without changing the WebSocket/JSON‑RPC protocol or agent behavior.

## Goals & Scope
- Add optional Langfuse instrumentation (no behavior change if disabled).
- Record per-evaluation inputs, outputs, timings, tool calls, and scores.
- Support Langfuse Remote Dataset Runs via a dedicated example runner.
- Provide basic prompt management (fetch variant at runtime, tag traces).

Out of scope (initial phase): modifying client/agent code, NodeJS parity (can follow), or server-side LLM judging.

## Architecture Fit (Current System)
- Transport: WebSocket + JSON‑RPC 2.0 (`evaluate` RPC); clients return structured results.
- Server: `EvalServer` manages connections/concurrency; `ClientProxy.evaluate` dispatches RPC; `RpcClient` handles correlation/timeouts.
- Evals: constructed programmatically or from datasets; examples handle scoring and summaries.
- Logging: loguru JSONL for RPC and evaluation events.

Langfuse integrates at dispatch/receive points and in example runners. No protocol changes.

## Integration Plan (Phased)
1) Tracing + Scoring (Python)
   - Add a small tracer shim `bo_eval_server/langfuse_tracer.py` (no-op if disabled).
   - Wrap `ClientProxy.evaluate` to start/update/end traces and attach scores when available.
   - Flush on server stop and at the end of batch/example runs.

2) Prompt Management (optional)
   - Utility to fetch prompts/variants from Langfuse when env is set; store `{prompt_id, variant, prompt_hash}` in evaluation metadata and trace tags.

3) Remote Dataset Runs Example
   - Add `python/examples/langfuse_dataset_runner.py` following Langfuse docs: iterate dataset items locally, call `client.evaluate`, update trace with inputs/outputs, attach scores, and flush.

4) (Optional) NodeJS parity later.

## Tracer Design
File: `eval-server/python/src/bo_eval_server/langfuse_tracer.py`

Behavior
- Lazy import Langfuse SDK; if env not configured or `LANGFUSE_ENABLE` is falsey → no-op.
- Non-blocking: failures/logging should not break evaluation flow.

Env/config
- `LANGFUSE_ENABLE=true|false`
- `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`
- Optional: `LANGFUSE_PROJECT`, `LANGFUSE_ENV`, `LANGFUSE_PROMPT_NAME`, `LANGFUSE_PROMPT_VARIANT`.

API (shim)
- `start_eval_trace(run_name: str, tags: dict) -> TraceCtx`
  - `TraceCtx.update(input=None, output=None, usage=None, cost=None, timings=None, tool_calls=None)`
  - `TraceCtx.score(name: str, value: float|int, comment: str|None=None)`
  - `TraceCtx.end(status: str|None=None)`
- `flush()` ensures data is sent.

Tags (suggested)
- `evaluation_id`, `evaluation_name`, `tool`, `model`, `prompt_variant`, `prompt_hash`, `toolset`, `config_hash`, plus `evaluation.metadata`.

## Data & Metrics Mapping
- Input: `evaluation.input` (+ `url` where applicable) → trace input.
- Output: agent result (entire payload) → trace output.
- Timings: duration measured in `ClientProxy.evaluate`; `executionTime` from client if present.
- Tooling: tool calls list/count when returned by client.
- Scores (where available):
  - `task_success` (0/1), `confidence` (0–100), `exact_match` (0/1), optional LLM-judge later.
- Ops: optional `usage`/`cost` if provided by clients.

## Context Propagation & Correlation (Required)
- Use a single execution trace created by the agent; the server should attach scores/metadata to that same trace when possible.
- Agent → Server propagation:
  - Modify the agent’s eval responses to include `traceId` in `result.metadata` for both success and error RPC responses.
  - Recommended extras: include `sessionId` and a stable `trace_correlation_id = hash(run_name + evaluation_id)` to support cross-system joins.
- Server handling:
  - In `ClientProxy.evaluate` result handling, extract `traceId` (and `trace_correlation_id` if present) and pass to the Langfuse tracer when recording scores.
  - If `traceId` is missing, fall back to recording scores under the dataset run’s root span and add `trace_missing: true` metadata.
- Project alignment:
  - Ensure agent and server write to the same Langfuse project/environment to enable cross-writes to the same trace id.
  - If projects differ, treat dataset runs as the scoring plane and store `agent_trace_id` in run metadata for lookup.

## Score API Usage (Trace-Level Scoring)
- Goal: attach scores directly to the agent’s existing trace without creating new traces.
- API: Use the Langfuse Python SDK score API (e.g., `get_client().score(...)` or equivalent) with `trace_id` (and optional `observation_id`).
- When to use:
  - Primary scoring path after each evaluation when the agent returns `traceId`.
  - Optionally, pass `observation_id` if you later expose a root observation to pin the score more granularly.
- Fallback:
  - If `traceId` unavailable, attach scores to the dataset run via `root_span.score_trace(...)` and include `trace_missing: true`.
- Metadata to include on score events:
  - `evaluation_id`, `run_name`, `model`, `prompt_variant`, `toolset`, `config_hash`, and `agent_trace_id`.

Trace-level score skeleton (Python)
```python
from langfuse import get_client

client = get_client()

def write_score_to_agent_trace(trace_id: str, name: str, value: float, comment: str | None = None, metadata: dict | None = None):
    # Exact method name depends on SDK version; we call the score API exposed by the client.
    client.score(
        name=name,
        value=value,
        trace_id=trace_id,
        comment=comment,
        metadata=metadata or {}
    )
```

## Prompt Management
- Optional helper to fetch/compile prompts from Langfuse using `LANGFUSE_PROMPT_NAME`/`LANGFUSE_PROMPT_VARIANT`.
- Store prompt metadata in `evaluation.metadata` and forward into trace tags.
- Note: actual prompt use typically resides in the agent; here we ensure metadata tagging and example usage.

## Remote Dataset Runs
- New example `python/examples/langfuse_dataset_runner.py`:
  - Fetch dataset via SDK; loop `dataset.items`.
  - Use `item.run(run_name, run_metadata)` (Python) to auto-link traces.
  - Build `evaluation` from `item.input` (map to `{tool, input, url?, timeout?}`); call `client.evaluate`.
  - Compute scores (regex/rule-based/LLM-judge) and:
    - Primary: attach scores to the agent’s trace using the `traceId` returned by the agent (preferred).
    - Secondary: also record the score to the dataset run via `score_trace` with `agent_trace_id` in metadata to enable join from run → trace.
  - `get_client().flush()` at the end.

Python SDK references and setup
- Docs: Remote dataset runs (SDK) — https://langfuse.com/docs/evaluation/dataset-runs/remote-run
- Docs: Python SDK overview — https://langfuse.com/docs/observability/sdk/python/overview
- Docs: Evaluation overview — https://langfuse.com/docs/evaluation/overview
- Install: `pip install langfuse`
- Env: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`

Dataset runner skeleton (Python)
```python
from langfuse import get_client

# Pseudocode: obtain your dataset via SDK/UI export
dataset = get_dataset("my-dataset")  # shape: dataset.items

run_name = "exp-2025-09-08"
experiment_meta = {
    "model": "gpt-4o",
    "prompt_variant": "v3",
    "toolset": "search,action",
    "config_hash": "...",
}

for item in dataset.items:
    with item.run(run_name=run_name, run_metadata=experiment_meta) as root:
        # 1) Build eval request from dataset input
        evaluation = build_evaluation_from_item(item)

        # 2) Dispatch via eval-server to your agent
        result = await client_proxy.evaluate(evaluation, timeout=evaluation.get("timeout", 60))

        # 3) Update the dataset run trace (optional E2E info)
        root.update_trace(input=item.input, output=result)

        # 4) Extract agent traceId from result.metadata (added in Phase 4)
        agent_trace_id = (result.get("metadata") or {}).get("traceId")

        # 5) Compute scores
        ok, score_comment = compute_scores(item, result)

        # 6) Attach scores
        root.score_trace(
            name="task_success",
            value=1 if ok else 0,
            comment=score_comment,
        )

        # 7) Optionally also write the score directly to the agent trace (preferred)
        if agent_trace_id:
            write_score_to_agent_trace(
                trace_id=agent_trace_id,
                name="task_success",
                value=1 if ok else 0,
                metadata={
                    "evaluation_id": evaluation["id"],
                    "run_name": run_name,
                    "agent_trace_id": agent_trace_id,
                },
            )

# Ensure everything is sent
get_client().flush()
```

Runner notes
- Always include `evaluation_id` and `run_name` in both planes (dataset run score and agent trace score) for easy correlation.
- Prefer writing scores to agent traces via the `traceId` returned by the agent; also record scores to the dataset run for PR gating and dashboards.
- Keep server and agent pointed at the same Langfuse project (`LANGFUSE_HOST`/keys) to enable cross-writes to the same trace id.

CLI flags (example)
- `--run-name`, `--model`, `--prompt-variant`, `--timeout`, `--toolset`.

## Configuration & Security
- No secrets in logs. Env-based Langfuse config only.
- Keep WS auth and protocol unchanged.
- Tracer must degrade gracefully on network/SDK errors.

## Rollout Steps
1. Add `langfuse_tracer.py` (no-op shim + real impl).
2. Wire into `ClientProxy.evaluate` (start/update/end + score hooks).
3. Ensure `EvalServer.stop()` flushes tracer; update examples to flush at end.
4. Agent change (context propagation): add `traceId` (and optional `sessionId`, `trace_correlation_id`) to `result.metadata` in `front_end/panels/ai_chat/evaluation/remote/EvaluationAgent.ts` for both success and error responses.
5. Server change (score routing): extract `traceId` from client results in `ClientProxy.evaluate` and pass it into the Langfuse tracer so scores land on the agent’s trace; fall back to dataset-run root span if missing.
6. Extend `programmatic_evals.py` and `browsecomp_eval_server.py` to tag experiments (model/prompt/toolset) and attach available scores; include `agent_trace_id` in saved results.
7. Add `examples/langfuse_dataset_runner.py` (Remote Dataset Runs) that writes scores to both the agent trace and the dataset run.
8. Update `eval-server/README.md` with env setup, context propagation, and usage snippets.

## Acceptance Criteria
- With Langfuse disabled: no behavioral or performance regressions; examples run as-is.
- With Langfuse enabled: traces appear per evaluation with inputs/outputs, timing, and any available scores; runs are filterable by prompt/tool/model tags.
- Dataset runner executes a fixed dataset and produces comparable runs in the Langfuse UI.

## Future Work
- Add NodeJS parity (tracing + judge results).
- Optional server-side LLM judge; unify scoring interfaces.
- CI hooks to compare experiments and gate regressions.

## Phase 5: Agent‑Side Tracing Alignment (AI Chat)

This phase documents how the DevTools AI Chat agent already emits rich Langfuse traces and how to align eval metadata and comparisons without changing protocol behavior.

Key components (agent side)
- Trace config/provider: `front_end/panels/ai_chat/tracing/TracingConfig.ts` and `LangfuseProvider.ts` implement persistent config, provider singleton, and batch ingestion (`trace-create`, `span-create`, `generation-create`, `event-create`).
- Context propagation: `withTracingContext(...)` and `TracingContext` carry `traceId`, `parentObservationId`, `currentGenerationId`, `currentToolCallId`, and `currentAgentSpanId` across the agent graph and tools.
- Entry points:
  - `AgentService.sendMessage(...)`: creates a new `trace` per user message when no eval context is present.
  - `evaluation/remote/EvaluationAgent.ts`: for evals, creates a `trace` per evaluation and runs tools/chat under that trace; calls `finalizeTrace` with output or error.
- Hierarchy:
  - LLM calls: `AgentNodes.createAgentNode(...)` emits `generation` observations with model/params/usage and updates with outputs/errors.
  - Tool execution: `AgentNodes.createToolExecutorNode(...)` emits `span` observations per tool run; for agent-as-tool, it nests an AgentRunner tree under the tool span.
  - Tool-internal LLM: `tools/LLMTracingWrapper.ts` emits `generation` under the current span.

Tagging prompts/models/tools for comparisons
- Add experiment tags at eval trace creation in `front_end/panels/ai_chat/evaluation/remote/EvaluationAgent.ts` (where `createTrace(...)` is called):
  - `model`: selected model/provider (including overrides from server `params.model`).
  - `prompt_variant` and `prompt_hash`: if you fetch prompts from Langfuse or have prompt management; store in metadata and tags.
  - `toolset`: list of enabled tools or agent type.
  - `config_hash`: stable hash of relevant config to group runs.
  - `evaluation_id`: always include; used to correlate with server-side scoring.
  - `run_name` (if provided by server): include to make dataset-run → trace lookup trivial.

Dataset runs end‑to‑end
- Python eval-server iterates dataset items and dispatches `evaluate` RPCs.
- The agent emits step-level traces automatically (generations, spans, events) under a per-eval `trace` with `evaluation_id` (and `run_name` if provided).
- The Python runner computes scores and writes them:
  - to the agent’s trace (using returned `traceId`) for execution-centric views, and
  - to the dataset run for run-centric comparisons and gating,
  with `agent_trace_id` in run metadata.
- In Langfuse UI, filter by dataset run (scores) and drill into the corresponding agent trace by `agent_trace_id` or `evaluation_id` + `run_name`.

Coordination and duplication
- Prefer a single source of step-level traces: the agent (browser) already sends all observations to Langfuse. The Python side should attach scores to dataset runs rather than creating separate per-eval traces to avoid duplication.
- Correlation: use `evaluation_id` and `run_name` across both planes. Always pass back the agent `traceId` in the evaluation result so the server can write scores to the exact trace. Include a stable `trace_correlation_id` as a fallback join key.
- If server-side traces are desired for operational reasons, gate behind a flag and tag `source: server-shadow` to avoid confusion.

Trace Duplication Strategy (policy)
- Source of truth for execution steps: agent trace only.
- Server creates no per-eval traces by default.
- Server attaches scores to:
  - the agent trace (preferred, using returned `traceId`), and
  - the dataset run (for comparisons/CI gating).
- Fallbacks:
  - If agent trace missing/unavailable → record only to dataset run with `trace_missing: true` and `evaluation_id`/`run_name` for later correlation.
  - Optional server-fallback trace creation only under a guarded flag, tagged `source: server-fallback`.

Acceptance (phase 5)
- Agent eval traces include `evaluation_id`, `model`, `prompt_variant` (if applicable), `toolset`, `config_hash`, and `run_name` (if provided) in metadata/tags.
- Agent returns `traceId` in evaluation responses; server uses it to attach scores to the same trace.
- Dataset run results show per-item scores; each result includes `agent_trace_id` for direct lookup. Failing items can be correlated to agent traces without ambiguity.
- No protocol changes to the WS schema beyond adding keys in `result.metadata`; when Langfuse is disabled, behavior is unchanged.
