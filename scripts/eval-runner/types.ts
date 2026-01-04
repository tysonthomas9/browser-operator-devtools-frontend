/**
 * Types for the CLI Evaluation Runner
 */

export interface CLIOptions {
  // Test selection
  tool?: string;
  tags?: string[];
  testIds?: string[];

  // Execution
  parallel: boolean;
  concurrency: number;
  timeout: number;
  retries: number;
  limit?: number;

  // Braintrust
  experiment?: string;
  project?: string;
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
  project: string;
  experiment: string;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionContext {
  page: any; // Puppeteer Page
  cdp: any;  // CDP Session
  target: any; // DevTools Target abstraction
  screenshotDir: string;
  timeout: number;
  abortSignal?: AbortSignal;
}
