# DeepEval Integration Plan for eval-server

## Overview
Integrate the existing DeepEval library (in third_party/deepeval) with your eval-server to provide comprehensive agent evaluation capabilities beyond simple correctness scoring.

## Analysis Summary

### Current State
- **eval-server**: WebSocket-based evaluation server for LLM agents
- **browsecomp_eval_server.py**: Evaluates BrowserOperator agents on browsecomp dataset
- **Current scoring**: Simple rule-based correctness checking
- **DeepEval available**: Full DeepEval library already in third_party/deepeval

### Key Findings from DeepEval Analysis
- 40+ evaluation metrics available including agent-specific ones
- TaskCompletionMetric: LLM-as-judge for overall task success
- ToolCorrectnessMetric: Validates correct tool usage patterns
- Tracing capabilities with @observe decorator for component-level evaluation
- Support for multi-turn conversations and MCP protocols
- Extensive reporting and visualization features

## Implementation Plan

### New Files to Create

#### 1. **`deepeval_integration.py`** - Bridge module to connect eval-server with DeepEval
```python
# Core functionality:
- Initialize DeepEval with local third_party import
- Convert BrowserOperator responses to DeepEval LLMTestCase format
- Extract tool calls from response messages
- Map browsecomp questions to DeepEval test cases
- Support both end-to-end and component-level evaluation
```

#### 2. **`deepeval_metrics_manager.py`** - Centralized metrics management
```python
# Features:
- Configure and run multiple DeepEval metrics
- Support TaskCompletion, ToolCorrectness, AnswerRelevancy, etc.
- Aggregate scores across metrics
- Weighted metric combinations
- Threshold management
```

#### 3. **`agent_tracing.py`** - Component-level evaluation via tracing
```python
# Capabilities:
- Wrap agent execution with @observe decorator
- Track individual tool calls as spans
- Measure component performance
- Support offline evaluation of traces
- Performance profiling
```

#### 4. **`browsecomp_deepeval_server.py`** - Enhanced evaluation server
```python
# Extended features:
- CLI args for metric selection
- Parallel metric evaluation
- Multi-metric reporting
- Trace visualization
- Confidence calibration analysis
- Extended from current browsecomp_eval_server.py
```

#### 5. **`test_case_converter.py`** - Format conversion utilities
```python
# Conversion logic:
- BrowserOperator response → LLMTestCase
- Extract tool calls from messages array
- Parse multi-turn conversations
- Handle partial/error responses
- Support multimodal content (future)
```

#### 6. **`deepeval_config.py`** - Configuration management
```yaml
# Example configuration:
deepeval:
  metrics:
    - name: task_completion
      threshold: 0.8
      model: gpt-4o
    - name: tool_correctness
      strict_mode: true
      consider_ordering: true
    - name: answer_relevancy
      threshold: 0.7
  tracing:
    enabled: true
    capture_tool_calls: true
    capture_llm_calls: true
  reporting:
    export_to_confident_ai: false
    generate_html_report: true
```

#### 7. **`deepeval_reporter.py`** - Advanced reporting
```python
# Reporting features:
- Generate HTML/JSON/CSV reports
- Per-question metric scores
- Aggregate statistics
- Confidence vs accuracy correlation
- Tool usage patterns analysis
- Error categorization
- Performance trends over time
```

### Key Metrics to Implement

#### Agent-Specific Metrics
- **TaskCompletionMetric**: Evaluate if the agent completed the web browsing task
- **ToolCorrectnessMetric**: Validate correct tool usage patterns
- **ArgumentCorrectnessMetric**: Check if tool arguments are correct
- **MCPTaskCompletionMetric**: For MCP-enabled evaluations

#### Quality Metrics
- **AnswerRelevancyMetric**: Assess answer quality and relevance
- **FaithfulnessMetric**: Verify factual accuracy
- **HallucinationMetric**: Detect hallucinations
- **BiasMetric**: Check for biased responses

#### Advanced Metrics
- **DAGMetric**: Custom multi-criteria evaluation graphs
- **ConversationalDAGMetric**: For multi-turn conversations
- **GEval**: Custom LLM-as-judge metrics

### Integration Architecture

#### Current Flow
```
Client → WebSocket → EvalServer → BrowserOperator → Simple Scoring
```

#### Enhanced Flow
```
Client → WebSocket → EvalServer → BrowserOperator → DeepEval Metrics → Advanced Reporting
                                                  ↓
                                               Tracing & Component Analysis
```

### Implementation Phases

#### Phase 1: Basic Integration
- Import DeepEval from third_party
- Create test case converter
- Implement TaskCompletionMetric
- Basic scoring integration
- CLI argument extensions

#### Phase 2: Advanced Metrics
- Add ToolCorrectnessMetric
- Implement multi-metric evaluation
- Add confidence calibration
- Create metric aggregation logic
- Enhanced reporting

#### Phase 3: Tracing & Components
- Implement @observe decorators
- Add span tracking for tool calls
- Component-level evaluation
- Performance profiling
- Trace visualization

#### Phase 4: Reporting & Visualization
- HTML report generation
- Trend analysis over time
- Comparative benchmarking
- Export capabilities
- Dashboard integration

### CLI Usage Examples

```bash
# Basic DeepEval integration
python browsecomp_deepeval_server.py --limit 10 --metrics task_completion,tool_correctness

# Advanced multi-metric evaluation
python browsecomp_deepeval_server.py --start 1 --end 100 \
  --metrics task_completion,tool_correctness,answer_relevancy,hallucination \
  --model gpt-4o --trace-enabled --html-report

# Component-level evaluation with tracing
python browsecomp_deepeval_server.py --questions 1 5 10 \
  --component-eval --trace-spans --export-traces

# Comparison mode (simple vs deep evaluation)
python browsecomp_deepeval_server.py --limit 20 \
  --compare-modes --metrics all --export-comparison
```

### Configuration Changes

#### pyproject.toml Updates
```toml
# Add path configuration for third_party deepeval
[tool.setuptools.packages.find]
where = ["src", "third_party"]

# No new external dependencies needed (using bundled deepeval)
```

#### Environment Variables
```bash
# Optional configuration
DEEPEVAL_MODEL=gpt-4o
DEEPEVAL_API_KEY=your_openai_key
DEEPEVAL_CONFIDENT_AI_API_KEY=optional_confident_ai_key
```

### Expected Benefits

#### Deeper Insights
- Understand HOW agents perform, not just IF they succeed
- Component-level performance analysis
- Tool usage pattern validation

#### Quality Assessment
- Answer relevance and factual accuracy
- Hallucination detection
- Bias identification

#### Performance Optimization
- Identify bottlenecks through tracing
- Component-level profiling
- Execution pattern analysis

#### Production Readiness
- Use same metrics for development and production monitoring
- Confidence calibration for reliability assessment
- Automated quality assurance

#### Research Capabilities
- Comparative analysis between models
- Tool usage effectiveness studies
- Performance trend analysis over time

### Compatibility Notes

- **Backward Compatible**: Maintains existing eval-server functionality
- **Opt-in**: DeepEval metrics are optional, default behavior unchanged
- **Extensible**: Easy to add custom metrics using DeepEval framework
- **Flexible**: Support different evaluation models (GPT-4, Claude, etc.)

### File Structure After Implementation

```
eval-server/
├── python/
│   ├── evals/
│   │   ├── browsecomp_eval_server.py (existing)
│   │   ├── browsecomp_deepeval_server.py (new)
│   │   ├── browsecomp_dataset.py (existing)
│   │   ├── browsecomp_scorer.py (existing)
│   │   ├── deepeval_integration.py (new)
│   │   ├── deepeval_metrics_manager.py (new)
│   │   ├── agent_tracing.py (new)
│   │   ├── test_case_converter.py (new)
│   │   ├── deepeval_config.py (new)
│   │   └── deepeval_reporter.py (new)
│   ├── src/ (existing)
│   └── third_party/
│       └── deepeval/ (existing - full library)
```

This plan leverages the existing DeepEval library in third_party while maintaining compatibility with your current eval-server architecture, providing a powerful evaluation framework for your BrowserOperator agents.