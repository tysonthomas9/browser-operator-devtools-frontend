# AI Chat Evaluation Guide

Comprehensive guide for testing and evaluating agents in the AI Chat framework.

## Table of Contents

1. [Overview](#overview)
2. [Evaluation Framework Architecture](#evaluation-framework-architecture)
3. [Writing Test Cases](#writing-test-cases)
4. [Running Evaluations](#running-evaluations)
5. [Evaluation Methods](#evaluation-methods)
6. [Agent-Specific Test Suites](#agent-specific-test-suites)
7. [Metrics and Scoring](#metrics-and-scoring)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The AI Chat evaluation framework provides comprehensive testing capabilities for:
- **Agent behavior validation**: Ensure agents perform correctly
- **Performance measurement**: Track latency, token usage, and costs
- **Regression testing**: Prevent regressions in agent capabilities
- **Quality assurance**: Maintain high standards across updates

### Key Components

- **EvaluationRunner**: Orchestrates test execution
- **Test Cases**: Declarative test specifications
- **Evaluators**: Judge agent outputs (rule-based, LLM-based)
- **Metrics**: Quantitative performance measures
- **Remote Evaluation**: WebSocket-based distributed testing

---

## Evaluation Framework Architecture

```
┌─────────────────────────────────────────────────┐
│           EvaluationDialog (UI)                 │
│  - Configure tests                               │
│  - Run evaluations                               │
│  - View results                                  │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│          EvaluationRunner                       │
│  - Load test cases                               │
│  - Execute agent runs                            │
│  - Collect results                               │
│  - Generate reports                              │
└──────────────────┬──────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────────┐   ┌───────▼────────────┐
│  Local Eval     │   │  Remote Eval       │
│  - Direct runs  │   │  - WebSocket RPC   │
│  - Fast         │   │  - Distributed     │
└─────────────────┘   └──────┬─────────────┘
                             │
                   ┌─────────▼──────────┐
                   │  EvaluationAgent   │
                   │  - Agent server    │
                   │  - Isolated env    │
                   └────────────────────┘
```

### Component Details

**EvaluationRunner.ts**
- Loads and validates test cases
- Executes agents with test inputs
- Applies evaluators to outputs
- Aggregates metrics
- Generates reports

**EvaluationAgent.ts**
- Remote evaluation via WebSocket
- Connects to agent-server
- Isolated execution environment
- Real-time progress updates

**GenericToolEvaluator.ts**
- Configurable evaluation framework
- Rule-based assertions
- Tool call validation
- Output verification

**LLMEvaluator.ts**
- LLM-as-a-judge pattern
- Multi-criteria assessment
- Contextual evaluation
- Scoring and feedback generation

---

## Writing Test Cases

### Test Case Structure

```typescript
interface TestCase {
  name: string;                    // Test name
  description: string;             // What this test validates
  input: string;                   // User input to agent
  expectedBehavior: string;        // Expected agent behavior
  assertions: Assertion[];         // Validation rules
  timeout?: number;                // Max execution time (ms)
  tags?: string[];                 // Categorization tags
  metadata?: Record<string, any>;  // Additional metadata
}
```

### Example Test Case

```typescript
const testCase: TestCase = {
  name: "Product Search and Extraction",
  description: "Agent should search for a product and extract key details",
  input: "Find the price and rating of iPhone 15 Pro on Amazon",
  expectedBehavior: "Agent uses search, navigates to Amazon, extracts product details",
  assertions: [
    {
      type: "tool_called",
      tool: "web_search",
      description: "Should perform web search"
    },
    {
      type: "tool_called",
      tool: "schema_based_extractor",
      description: "Should extract structured data"
    },
    {
      type: "output_contains",
      value: "price",
      description: "Output should contain price"
    },
    {
      type: "output_contains",
      value: "rating",
      description: "Output should contain rating"
    },
    {
      type: "max_iterations",
      value: 10,
      description: "Should complete within 10 iterations"
    }
  ],
  timeout: 60000,
  tags: ["e-commerce", "search", "extraction"]
};
```

### Assertion Types

#### 1. Tool Call Assertions

**tool_called**: Verify a specific tool was used.
```typescript
{
  type: "tool_called",
  tool: "navigate_url",
  args?: { url: "https://example.com" },  // Optional arg validation
  description: "Should navigate to URL"
}
```

**tool_not_called**: Ensure a tool was NOT used.
```typescript
{
  type: "tool_not_called",
  tool: "delete_file",
  description: "Should not delete files"
}
```

**tool_call_sequence**: Validate tool call order.
```typescript
{
  type: "tool_call_sequence",
  sequence: ["web_search", "navigate_url", "extract_data"],
  description: "Should follow correct workflow"
}
```

#### 2. Output Assertions

**output_contains**: Check if output contains text.
```typescript
{
  type: "output_contains",
  value: "expected text",
  caseSensitive: false,
  description: "Output should mention expected text"
}
```

**output_matches**: Regex pattern matching.
```typescript
{
  type: "output_matches",
  pattern: "\\$\\d+\\.\\d{2}",  // Price format
  description: "Output should contain price in USD format"
}
```

**output_json_valid**: Validate JSON output.
```typescript
{
  type: "output_json_valid",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      price: { type: "number" }
    },
    required: ["title", "price"]
  },
  description: "Output should be valid JSON matching schema"
}
```

#### 3. Performance Assertions

**max_iterations**: Limit iterations.
```typescript
{
  type: "max_iterations",
  value: 10,
  description: "Should complete in 10 iterations or less"
}
```

**max_duration**: Limit execution time.
```typescript
{
  type: "max_duration",
  value: 30000,  // 30 seconds
  description: "Should complete in 30 seconds"
}
```

**max_tokens**: Limit token usage.
```typescript
{
  type: "max_tokens",
  value: 5000,
  description: "Should use less than 5000 tokens"
}
```

#### 4. Behavioral Assertions

**no_errors**: Ensure no errors occurred.
```typescript
{
  type: "no_errors",
  description: "Execution should be error-free"
}
```

**handoff_to**: Validate handoff behavior.
```typescript
{
  type: "handoff_to",
  agent: "ResearchAgent",
  description: "Should handoff to ResearchAgent"
}
```

**final_answer_provided**: Ensure completion.
```typescript
{
  type: "final_answer_provided",
  description: "Should provide final answer"
}
```

### Creating Test Suites

Organize related tests into suites:

```typescript
// research-agent-tests.ts
export const researchAgentTests: TestSuite = {
  agentName: "ResearchAgent",
  description: "Test suite for Research Agent",
  setup: async () => {
    // Optional setup logic
  },
  teardown: async () => {
    // Optional cleanup logic
  },
  testCases: [
    {
      name: "Basic Web Search",
      // ... test case
    },
    {
      name: "Multi-Source Research",
      // ... test case
    },
    {
      name: "Fact Verification",
      // ... test case
    }
  ]
};
```

---

## Running Evaluations

### Via UI (EvaluationDialog)

1. Open AI Chat Panel
2. Click "Evaluation" button
3. Select agent to test
4. Choose test suite
5. Click "Run Evaluation"
6. Monitor progress in real-time
7. Review results and metrics

### Programmatic Execution

```typescript
import { EvaluationRunner } from './evaluation/EvaluationRunner';
import { researchAgentTests } from './evaluation/research-agent-tests';

// Create runner
const runner = new EvaluationRunner({
  tracing: true,           // Enable tracing
  saveResults: true,       // Save results to file
  parallelism: 3,          // Run 3 tests in parallel
  verbose: true            // Detailed logging
});

// Run test suite
const results = await runner.runTestSuite(researchAgentTests);

// Access results
console.log(`Passed: ${results.passed}/${results.total}`);
console.log(`Success Rate: ${results.successRate}%`);
console.log(`Average Duration: ${results.avgDuration}ms`);

// Individual test results
results.testResults.forEach(result => {
  console.log(`${result.name}: ${result.status}`);
  if (result.status === 'failed') {
    console.log(`  Reason: ${result.failureReason}`);
  }
});
```

### Remote Evaluation

For isolated testing environments:

```typescript
import { EvaluationAgent } from './evaluation/EvaluationAgent';

// Connect to evaluation server
const evaluator = new EvaluationAgent({
  serverUrl: 'ws://localhost:8080',
  apiKey: 'eval-key-123'
});

await evaluator.connect();

// Run tests remotely
const results = await evaluator.runTests(researchAgentTests);

await evaluator.disconnect();
```

### Command-Line Evaluation

```bash
# Run all tests
npm run eval

# Run specific suite
npm run eval -- --suite=research-agent

# Run with tags
npm run eval -- --tags=e-commerce,search

# Run in CI mode (exit code 1 on failure)
npm run eval -- --ci

# Generate HTML report
npm run eval -- --report=html --output=./eval-results
```

---

## Evaluation Methods

### 1. Rule-Based Evaluation

Fast, deterministic validation using assertions.

**Pros**:
- Fast execution
- Deterministic results
- No LLM costs
- Easy to debug

**Cons**:
- Limited flexibility
- May miss nuanced errors
- Requires explicit rules

**Use Cases**:
- Tool call validation
- Output format checking
- Performance constraints
- Regression testing

### 2. LLM-Based Evaluation

Use LLM as a judge to assess quality.

```typescript
import { LLMEvaluator } from './evaluation/LLMEvaluator';

const evaluator = new LLMEvaluator({
  model: 'gpt-4',
  criteria: [
    {
      name: 'Accuracy',
      weight: 0.4,
      description: 'Is the information factually correct?'
    },
    {
      name: 'Completeness',
      weight: 0.3,
      description: 'Does it address all aspects of the query?'
    },
    {
      name: 'Clarity',
      weight: 0.3,
      description: 'Is the response clear and well-structured?'
    }
  ]
});

const evaluation = await evaluator.evaluate({
  input: testCase.input,
  output: agentOutput,
  expectedBehavior: testCase.expectedBehavior
});

console.log(`Overall Score: ${evaluation.overallScore}`);
console.log(`Accuracy: ${evaluation.scores.Accuracy}`);
console.log(`Feedback: ${evaluation.feedback}`);
```

**Pros**:
- Flexible assessment
- Catches nuanced issues
- Human-like judgment
- Contextual understanding

**Cons**:
- Slower
- Costs tokens
- Non-deterministic
- May require calibration

**Use Cases**:
- Content quality assessment
- Reasoning evaluation
- User experience validation
- Complex behavior verification

### 3. Hybrid Evaluation

Combine rule-based and LLM-based methods:

```typescript
const hybridEvaluator = new HybridEvaluator({
  ruleBased: [
    { type: "tool_called", tool: "web_search" },
    { type: "max_iterations", value: 10 }
  ],
  llmBased: {
    criteria: ['accuracy', 'completeness'],
    threshold: 0.7  // Minimum acceptable score
  }
});

const result = await hybridEvaluator.evaluate(testCase, agentOutput);
// Returns: { rulesPassed: true, llmScore: 0.85, overall: 'pass' }
```

---

## Agent-Specific Test Suites

### Research Agent Tests

**File**: `evaluation/research-agent-tests.ts`

**Focus Areas**:
- Web search accuracy
- Source diversity
- Information synthesis
- Citation quality

**Example Tests**:
- Single-source research
- Multi-source comparison
- Fact verification
- Deep dive analysis

### Action Agent Tests

**File**: `evaluation/action-agent-tests.ts`

**Focus Areas**:
- Action accuracy
- Element identification
- Error recovery
- State verification

**Example Tests**:
- Form filling
- Button clicking
- Navigation flows
- Multi-step workflows

### Search Agent Tests

**File**: `evaluation/search-agent-tests.ts`

**Focus Areas**:
- Search relevance
- Result extraction
- Query refinement
- Pagination handling

**Example Tests**:
- Basic search
- Advanced search (filters)
- Result extraction
- Follow-up queries

### Web Task Agent Tests

**File**: `evaluation/web-task-agent-tests.ts`

**Focus Areas**:
- Task decomposition
- Agent coordination
- Handoff behavior
- End-to-end workflows

**Example Tests**:
- E-commerce purchase flow
- Account creation
- Multi-page research
- Data collection pipelines

---

## Metrics and Scoring

### Execution Metrics

```typescript
interface ExecutionMetrics {
  duration: number;           // Total execution time (ms)
  iterations: number;         // Number of iterations
  toolCalls: number;          // Total tool calls
  tokensUsed: number;         // Total tokens consumed
  cost: number;               // Estimated cost (USD)
  errors: number;             // Number of errors
  handoffs: number;           // Number of handoffs
}
```

### Quality Metrics

```typescript
interface QualityMetrics {
  accuracy: number;           // 0-1 score
  completeness: number;       // 0-1 score
  efficiency: number;         // 0-1 score
  userSatisfaction: number;   // 0-1 score (if available)
  overallScore: number;       // Weighted average
}
```

### Test Results

```typescript
interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  executionMetrics: ExecutionMetrics;
  qualityMetrics?: QualityMetrics;
  assertionResults: AssertionResult[];
  failureReason?: string;
  output: string;
  trace?: string;  // Trace ID for observability
}
```

### Aggregated Reports

```typescript
interface EvaluationReport {
  suiteName: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  successRate: number;
  avgDuration: number;
  avgTokens: number;
  totalCost: number;
  testResults: TestResult[];
  summary: {
    topFailures: string[];      // Most common failures
    performanceStats: {
      p50: number,
      p95: number,
      p99: number
    };
    recommendations: string[];   // Improvement suggestions
  };
}
```

---

## Best Practices

### Test Case Design

1. **Specificity**: Be specific about expected behavior
   ```typescript
   // ✅ Good
   expectedBehavior: "Agent uses web_search with query 'machine learning', navigates to first result, extracts article title and summary"

   // ❌ Bad
   expectedBehavior: "Agent finds information"
   ```

2. **Independence**: Tests should not depend on each other
   ```typescript
   // ✅ Good - each test is self-contained
   testCases: [
     { name: "Test A", setup: () => setupStateA(), ... },
     { name: "Test B", setup: () => setupStateB(), ... }
   ]

   // ❌ Bad - Test B depends on Test A
   testCases: [
     { name: "Test A", ... },
     { name: "Test B (requires Test A)", ... }
   ]
   ```

3. **Realistic Inputs**: Use real-world user queries
   ```typescript
   // ✅ Good
   input: "What's the weather in San Francisco this weekend?"

   // ❌ Bad
   input: "test query 123"
   ```

4. **Comprehensive Assertions**: Cover multiple aspects
   ```typescript
   assertions: [
     { type: "tool_called", tool: "weather_api" },
     { type: "output_contains", value: "San Francisco" },
     { type: "output_matches", pattern: "\\d+°[FC]" },
     { type: "no_errors" },
     { type: "max_duration", value: 10000 }
   ]
   ```

### Performance Testing

1. **Baseline Establishment**: Track performance over time
   ```typescript
   // Store baseline metrics
   const baseline = await getBaseline('research-agent');

   // Compare current run
   const current = await runner.runTestSuite(tests);
   const regression = compareToBaseline(current, baseline);

   if (regression.duration > 1.5) {  // 50% slower
     console.warn('Performance regression detected!');
   }
   ```

2. **Stress Testing**: Test under load
   ```typescript
   // Run tests in parallel
   const stressTest = await runner.runTestSuite(tests, {
     parallelism: 10,
     iterations: 100
   });
   ```

### Continuous Integration

```yaml
# .github/workflows/eval.yml
name: Agent Evaluation

on: [push, pull_request]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Evaluations
        run: npm run eval -- --ci --report=json
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: eval-results
          path: eval-results.json
      - name: Check Success Rate
        run: |
          SUCCESS_RATE=$(jq '.successRate' eval-results.json)
          if (( $(echo "$SUCCESS_RATE < 95" | bc -l) )); then
            echo "Success rate below 95%: $SUCCESS_RATE%"
            exit 1
          fi
```

### Debugging Failed Tests

1. **Enable Verbose Logging**:
   ```typescript
   const runner = new EvaluationRunner({ verbose: true });
   ```

2. **Use Tracing**:
   ```typescript
   const runner = new EvaluationRunner({ tracing: true });
   // View traces in Langfuse
   ```

3. **Isolate Test**:
   ```typescript
   // Run single test
   await runner.runTest(singleTestCase);
   ```

4. **Inspect Agent Session**:
   ```typescript
   const result = await runner.runTest(testCase);
   console.log('Tool Calls:', result.session.toolCalls);
   console.log('Messages:', result.session.messages);
   ```

---

## Troubleshooting

### Test Timeouts

**Issue**: Tests exceed timeout limit.

**Solutions**:
- Increase timeout: `timeout: 120000`
- Optimize agent: Reduce iterations, use faster tools
- Check for infinite loops in agent logic

### Flaky Tests

**Issue**: Tests pass/fail inconsistently.

**Solutions**:
- Add retry logic:
  ```typescript
  const runner = new EvaluationRunner({ retries: 3 });
  ```
- Stabilize test inputs (avoid time-dependent queries)
- Use deterministic assertions
- Mock external dependencies

### LLM Evaluator Inconsistency

**Issue**: LLM-based scores vary widely.

**Solutions**:
- Use temperature=0 for evaluator model
- Add more specific criteria
- Provide reference examples:
  ```typescript
  criteria: [{
    name: 'Accuracy',
    description: 'Is the information correct?',
    examples: [
      { input: "...", output: "...", score: 1.0 },
      { input: "...", output: "...", score: 0.5 }
    ]
  }]
  ```
- Consider ensemble evaluation (multiple LLM judges)

### Remote Evaluation Failures

**Issue**: WebSocket connection issues.

**Solutions**:
- Check server is running: `npm run agent-server`
- Verify WebSocket URL
- Check firewall/network settings
- Increase connection timeout

---

## Related Documentation

- [Architecture.md](./Architecture.md) - System architecture
- [Tools-Reference.md](./Tools-Reference.md) - Available tools
- [Specialized-Agents.md](./Specialized-Agents.md) - Agent behaviors

---

## Example: Complete Evaluation Workflow

```typescript
// 1. Define test cases
const testCases: TestCase[] = [
  {
    name: "Product Research",
    description: "Research and compare products",
    input: "Compare iPhone 15 Pro vs Samsung S24 Ultra",
    expectedBehavior: "Searches for both phones, extracts specs, provides comparison",
    assertions: [
      { type: "tool_called", tool: "web_search" },
      { type: "output_contains", value: "iPhone 15 Pro" },
      { type: "output_contains", value: "Samsung S24 Ultra" },
      { type: "max_iterations", value: 15 }
    ],
    timeout: 60000,
    tags: ["research", "comparison"]
  }
];

// 2. Create test suite
const suite: TestSuite = {
  agentName: "ResearchAgent",
  testCases
};

// 3. Configure runner
const runner = new EvaluationRunner({
  tracing: true,
  saveResults: true,
  verbose: true
});

// 4. Run evaluations
const results = await runner.runTestSuite(suite);

// 5. Analyze results
console.log(`Success Rate: ${results.successRate}%`);
console.log(`Avg Duration: ${results.avgDuration}ms`);
console.log(`Total Cost: $${results.totalCost.toFixed(4)}`);

// 6. Generate report
await runner.generateReport(results, {
  format: 'html',
  output: './eval-report.html'
});

// 7. CI check
if (results.successRate < 95) {
  throw new Error('Evaluation failed: success rate below threshold');
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team
