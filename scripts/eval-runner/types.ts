/**
 * Types for the CLI Evaluation Runner
 */

export interface CLIOptions {
  // Test selection
  tool?: string;
  toolOverride?: string;  // Override tool for execution (run action_agent tests with action_agent_v2)
  tags?: string[];
  testIds?: string[];

  // Prompt optimization
  promptOverrideFile?: string;  // JSON file with prompt overrides for testing variations

  // Rubric-based evaluation (DR Tulu style)
  rubricConfigFile?: string;  // JSON file with rubric configs from Python
  dimensionalScores?: boolean;  // Return per-rubric scores for Python processing
  passThreshold?: number;  // Pass threshold 0-1 (default 0.80)

  // Execution
  parallel: boolean;
  concurrency: number;
  timeout: number;
  retries: number;
  limit?: number;

  // Search tool strategy (for A/B testing)
  searchStrategy?: 'xpath-schema' | 'semantic-xpath' | 'encoded-id' | 'text-pattern';

  // Braintrust
  experiment?: string;
  project?: string;
  org?: string;
  braintrustApiKey?: string;

  // LLM Configuration
  provider: 'openai' | 'anthropic' | 'litellm' | 'cerebras';
  model: string;
  judgeProvider: 'openai' | 'anthropic' | 'litellm' | 'cerebras';
  judgeModel: string;
  apiKey?: string;
  judgeApiKey?: string;

  // Output
  format: 'console' | 'json' | 'markdown';
  output?: string;
  verbose: boolean;
  screenshots: boolean;
  screenshotDir: string;

  // Browser
  chromePath?: string;
  headless: boolean;
  remoteDebuggingPort?: number;

  // Logging
  logDir: string;
  detailedLogs: boolean;

  // Version comparison
  compare?: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  url: string;
  tool: string;
  input: Record<string, unknown>;
  validation: ValidationConfig;
  metadata: {
    tags: string[];
    timeout?: number;
    retries?: number;
    flaky?: boolean;
    /** CSS selector to wait for visibility after navigation (for dynamic content like modals) */
    waitForSelector?: string;
    /** Delay in ms after navigation (alternative to waitForSelector) */
    waitAfterNavigation?: number;
  };
}

export interface ValidationConfig {
  type: 'snapshot' | 'llm-judge' | 'hybrid';
  llmJudge?: {
    criteria: string[];
    model?: string;
    temperature?: number;
    visualVerification?: {
      enabled: boolean;
      captureBeforeAction?: boolean;
      captureAfterAction?: boolean;
      verificationPrompts?: string[];
    };
  };
}

/**
 * Detailed metrics for a single tool call
 */
export interface ToolCallMetric {
  name: string;
  durationMs: number;
  success: boolean;
  error?: string;
  inputTokenEstimate?: number;
  outputTokenEstimate?: number;
}

/**
 * Detailed metrics for a single LLM call
 */
export interface LLMCallMetric {
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  toolCallsRequested: number;
}

/**
 * Aggregated execution metrics for comparison
 */
export interface ExecutionMetrics {
  toolCalls: ToolCallMetric[];
  llmCalls: LLMCallMetric[];
  totalToolCalls: number;
  totalLLMCalls: number;
  totalDurationMs: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  iterations: number;
  toolCallsByName: Record<string, number>;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  score: number;
  duration: number;
  output?: unknown;
  error?: string;
  validation?: {
    passed: boolean;
    score: number;
    explanation: string;
    criteria: CriteriaResult[];
  };
  screenshots?: {
    before?: string;
    after?: string;
  };
  metadata?: Record<string, unknown>;
  /** Detailed execution metrics for comparison */
  metrics?: ExecutionMetrics;
}

export interface CriteriaResult {
  criterion: string;
  passed: boolean;
  explanation: string;
}

export interface RunSummary {
  experiment?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  averageScore: number;
  averageDuration: number;
  results: TestResult[];
}

export interface BraintrustConfig {
  apiKey: string;
  org: string;
  project: string;
  experiment: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get status icon for test result display
 */
export function getStatusIcon(status: TestResult['status']): string {
  const icons: Record<TestResult['status'], string> = {
    passed: '✅',
    failed: '❌',
    error: '💥',
    skipped: '⏭️',
  };
  return icons[status] ?? '❓';
}

export type LLMProvider = 'openai' | 'anthropic' | 'litellm' | 'cerebras' | 'groq';

interface ProviderConfig {
  apiKey: string | undefined;
  baseURL: string | undefined;
}

/**
 * Get API key and base URL for a given LLM provider
 */
export function getProviderConfig(provider: LLMProvider, explicitApiKey?: string): ProviderConfig {
  switch (provider) {
    case 'cerebras':
      return {
        apiKey: explicitApiKey || process.env.CEREBRAS_API_KEY,
        baseURL: 'https://api.cerebras.ai/v1',
      };
    case 'anthropic':
      return {
        apiKey: explicitApiKey || process.env.ANTHROPIC_API_KEY,
        baseURL: undefined,
      };
    case 'groq':
      return {
        apiKey: explicitApiKey || process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      };
    case 'litellm':
      return {
        apiKey: explicitApiKey || process.env.OPENAI_API_KEY,
        baseURL: process.env.LITELLM_BASE_URL,
      };
    case 'openai':
    default:
      return {
        apiKey: explicitApiKey || process.env.OPENAI_API_KEY,
        baseURL: undefined,
      };
  }
}

/**
 * Comparison result for a single test across versions
 */
export interface TestComparisonResult {
  testId: string;
  testName: string;
  v0: TestResult;
  v1: TestResult;
  delta: {
    status: 'improved' | 'regressed' | 'unchanged';
    durationDelta: number;
    durationDeltaPercent: number;
    scoreDelta: number;
    toolCallsDelta: number;
    llmCallsDelta: number;
    tokensDelta: number;
    iterationsDelta: number;
  };
}

/**
 * Overall comparison summary across all tests
 */
export interface ComparisonSummary {
  totalTests: number;
  v0: {
    passRate: number;
    avgDuration: number;
    avgToolCalls: number;
    avgLLMCalls: number;
    avgTokens: number;
    avgIterations: number;
    avgScore: number;
  };
  v1: {
    passRate: number;
    avgDuration: number;
    avgToolCalls: number;
    avgLLMCalls: number;
    avgTokens: number;
    avgIterations: number;
    avgScore: number;
  };
  delta: {
    passRateDelta: number;
    durationDeltaPercent: number;
    toolCallsDeltaPercent: number;
    llmCallsDeltaPercent: number;
    tokensDeltaPercent: number;
    iterationsDeltaPercent: number;
    scoreDelta: number;
  };
  improved: number;
  regressed: number;
  unchanged: number;
  results: TestComparisonResult[];
}

/**
 * Prompt override configuration for testing prompt variations
 */
export interface PromptOverride {
  /** Name of the agent to override */
  agentName: string;
  /** The modified system prompt */
  systemPrompt: string;
  /** Optional description override */
  description?: string;
  /** Optional tools override */
  tools?: string[];
  /** Optional max iterations override */
  maxIterations?: number;
  /** Optional temperature override */
  temperature?: number;
  /** Metadata about this variation */
  metadata?: {
    version?: number;
    hypothesis?: string;
    changes?: string[];
    timestamp?: string;
  };
}

// ============================================================================
// Rubric-based Evaluation Types (DR Tulu Evolving Rubrics)
// ============================================================================

/**
 * Rubric dimension for evaluation - received from Python orchestrator
 */
export interface RubricConfig {
  /** Unique identifier for this rubric */
  id: string;
  /** Description of what this rubric measures */
  description: string;
  /** Weight: 1.0 for positive (excellence indicators), -1.0 for negative (failure patterns) */
  weight: number;
  /** Whether this is a persistent (from test case) or adaptive (evolved) rubric */
  type: 'persistent' | 'adaptive';
}

/**
 * Rubric configuration for a specific test
 */
export interface TestRubricConfig {
  testId: string;
  rubrics: RubricConfig[];
}

/**
 * Dimensional score for a single rubric
 */
export interface RubricScore {
  rubricId: string;
  description: string;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Brief explanation for this score */
  explanation: string;
  /** Original weight from config */
  weight: number;
}

/**
 * Categories for failure analysis
 */
export type FailureCategory =
  | 'auth_wall'      // Blocked by login/authentication requirement
  | 'timeout'        // Agent ran out of time/iterations
  | 'no_actions'     // Agent didn't take any actions
  | 'partial'        // Partial completion of task
  | 'wrong_target'   // Clicked/interacted with wrong element
  | 'wrong_action'   // Right target but wrong action type
  | 'page_error'     // Page JavaScript error or crash
  | 'network_error'  // Network/loading failures
  | 'not_found'      // Element not found on page
  | 'unknown';       // Uncategorized failure

/**
 * Execution data captured during agent run for analysis
 */
export interface ExecutionData {
  /** Final URL after all actions */
  finalUrl: string;
  /** Total number of tool calls made */
  totalToolCalls: number;
  /** Sequence of actions taken (e.g., ['navigate', 'click', 'fill']) */
  actionSequence: string[];
  /** Any errors encountered during execution */
  errorsEncountered: string[];
}

/**
 * Rich dimensional evaluation result for Python processing
 * Used when --dimensional-scores flag is enabled
 */
export interface DimensionalEvaluationResult {
  testId: string;
  testName: string;
  status: 'evaluated';
  /** Per-rubric dimensional scores */
  rubricScores: RubricScore[];
  /** Category of failure (if applicable) */
  failureCategory?: FailureCategory;
  /** Human-readable failure reason */
  failureReason?: string;
  /**
   * Aggregate score - null when dimensional (Python computes weighted score)
   * Only populated for backward compatibility when not using dimensional mode
   */
  aggregateScore: number | null;
  /**
   * Pass/fail decision - null when dimensional (Python decides based on threshold)
   * Only populated for backward compatibility when not using dimensional mode
   */
  passed: boolean | null;
  /** Execution data for rubric generation and analysis */
  executionData: ExecutionData;
  /** Duration of the test in ms */
  duration: number;
  /** Screenshots if captured */
  screenshots?: {
    before?: string;
    after?: string;
  };
}
