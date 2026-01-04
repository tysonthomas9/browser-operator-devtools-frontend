#!/usr/bin/env npx tsx
/**
 * CLI Evaluation Runner
 *
 * A scalable command-line tool for running Browser Operator agent evaluations
 * with Braintrust experiment tracking.
 *
 * Usage:
 *   npx tsx scripts/eval-runner/cli.ts --tool action_agent
 *   npx tsx scripts/eval-runner/cli.ts --tag click --experiment "v1"
 *   npx tsx scripts/eval-runner/cli.ts --test action-agent-click-001 --verbose
 */

// IMPORTANT: Must be first import to shim browser globals before DevTools imports
import './lib/BrowserGlobals.ts';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { getProviderConfig, type CLIOptions, type TestCase, type RunSummary, type LLMProvider } from './types.ts';
import { TestRunner } from './TestRunner.ts';
import { ConsoleReporter } from './reporters/ConsoleReporter.ts';
import { JsonReporter } from './reporters/JsonReporter.ts';
import { MarkdownReporter } from './reporters/MarkdownReporter.ts';
import { domTests } from './test-cases/dom-tests.ts';
import { Logger, LogLevel } from '../../front_end/panels/ai_chat/core/Logger.ts';

// Test module configuration for dynamic loading
interface TestModuleConfig {
  path: string;
  exports: { name: string; label: string }[];
  label: string;
}

const TEST_MODULES: TestModuleConfig[] = [
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/action-agent-tests.ts',
    exports: [{ name: 'actionAgentTests', label: 'action-agent' }],
    label: 'action-agent',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/action-agent-shadow-dom-tests.ts',
    exports: [{ name: 'shadowDOMActionTests', label: 'shadow-dom action' }],
    label: 'shadow-dom',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/action-agent-iframe-tests.ts',
    exports: [
      { name: 'iframeActionTests', label: 'iframe action' },
      { name: 'encodedIdActionTests', label: 'encodedId action' },
    ],
    label: 'iframe',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/web-task-agent-tests.ts',
    exports: [{ name: 'webTaskAgentTests', label: 'web-task-agent' }],
    label: 'web-task-agent',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/web-task-agent-shadow-dom-tests.ts',
    exports: [{ name: 'webTaskAgentShadowDOMTests', label: 'web-task-agent shadow-dom' }],
    label: 'web-task-agent shadow-dom',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/web-task-agent-iframe-tests.ts',
    exports: [
      { name: 'webTaskAgentIframeTests', label: 'web-task-agent iframe' },
      { name: 'hybridSnapshotTests', label: 'hybrid snapshot' },
    ],
    label: 'web-task-agent iframe',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/research-agent-tests.ts',
    exports: [{ name: 'researchAgentTests', label: 'research-agent' }],
    label: 'research-agent',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/schema-extractor-tests.ts',
    exports: [{ name: 'schemaExtractorTests', label: 'schema-extractor' }],
    label: 'schema-extractor',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/streamlined-schema-extractor-tests.ts',
    exports: [{ name: 'streamlinedSchemaExtractorTests', label: 'streamlined-schema-extractor' }],
    label: 'streamlined-schema-extractor',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/html-to-markdown-tests.ts',
    exports: [{ name: 'htmlToMarkdownTests', label: 'html-to-markdown' }],
    label: 'html-to-markdown',
  },
  {
    path: '../../front_end/panels/ai_chat/evaluation/test-cases/cdp-tool-tests.ts',
    exports: [{ name: 'cdpToolTests', label: 'cdp-tool' }],
    label: 'cdp-tool',
  },
];

async function loadTestModule(
  config: TestModuleConfig,
  tests: TestCase[]
): Promise<void> {
  try {
    const module = await import(config.path);
    for (const exp of config.exports) {
      if (module[exp.name]) {
        tests.push(...module[exp.name]);
        console.log(`   Loaded ${module[exp.name].length} ${exp.label} tests`);
      }
    }
  } catch (error) {
    console.log(`   Could not load ${config.label} tests: ${error}`);
  }
}

// Test case imports - load from TypeScript source files
async function loadTestCases(): Promise<TestCase[]> {
  // Start with DOM tests which are always available
  const tests: TestCase[] = [...domTests];

  // Load all test modules
  await Promise.all(TEST_MODULES.map(config => loadTestModule(config, tests)));

  // If no DevTools tests loaded, add fallback
  if (tests.length === domTests.length) {
    console.log('   (DevTools test cases not available, using fallback)');
    tests.push(...getFallbackTestCases());
  }

  return tests;
}

function getFallbackTestCases(): TestCase[] {
  // Minimal fallback test cases for standalone operation
  return [
    {
      id: 'action-agent-click-001',
      name: 'Google Search Click',
      description: 'Test clicking Google search button',
      url: 'https://www.google.com',
      tool: 'action_agent',
      input: {
        objective: 'Click the Google Search button',
        reasoning: 'Testing basic click interaction',
      },
      validation: {
        type: 'llm-judge',
        llmJudge: {
          criteria: [
            'Located the Google Search button',
            'Successfully clicked the button',
          ],
          visualVerification: {
            enabled: true,
            captureBeforeAction: true,
            captureAfterAction: true,
          },
        },
      },
      metadata: {
        tags: ['action', 'click', 'google', 'basic'],
        timeout: 30000,
      },
    },
    {
      id: 'action-agent-form-001',
      name: 'Google Search Fill',
      description: 'Test filling Google search input',
      url: 'https://www.google.com',
      tool: 'action_agent',
      input: {
        objective: 'Type "hello world" in the search box',
        reasoning: 'Testing form fill interaction',
      },
      validation: {
        type: 'llm-judge',
        llmJudge: {
          criteria: [
            'Located the search input field',
            'Successfully entered text',
            'Text is visible in the input',
          ],
          visualVerification: {
            enabled: true,
            captureBeforeAction: true,
            captureAfterAction: true,
          },
        },
      },
      metadata: {
        tags: ['action', 'form-fill', 'google', 'basic'],
        timeout: 30000,
      },
    },
  ];
}

/**
 * Filter test cases based on CLI options
 */
function filterTestCases(tests: TestCase[], options: CLIOptions): TestCase[] {
  let filtered = tests;

  // Filter by tool
  if (options.tool) {
    filtered = filtered.filter(t => t.tool === options.tool);
  }

  // Filter by tags (AND logic - must match all tags)
  if (options.tags && options.tags.length > 0) {
    filtered = filtered.filter(t =>
      options.tags!.every(tag => t.metadata.tags?.includes(tag))
    );
  }

  // Filter by specific test IDs
  if (options.testIds && options.testIds.length > 0) {
    filtered = filtered.filter(t => options.testIds!.includes(t.id));
  }

  return filtered;
}

/**
 * Get appropriate reporter based on format
 */
function getReporter(options: CLIOptions) {
  switch (options.format) {
    case 'json':
      return new JsonReporter(options.output);
    case 'markdown':
      return new MarkdownReporter(options.output);
    default:
      return new ConsoleReporter(options.verbose);
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  const program = new Command();

  program
    .name('eval-runner')
    .description('CLI Evaluation Runner for Browser Operator agents')
    .version('1.0.0');

  // Accumulator for repeated/comma-separated options
  const collect = (value: string, previous: string[] = []): string[] => {
    // Support both comma-separated and repeated flags
    const newValues = value.split(',').map(v => v.trim()).filter(v => v);
    return previous.concat(newValues);
  };

  program
    // Test selection
    .option('-t, --tool <tool>', 'Filter by tool name (action_agent, web_task_agent, etc.)')
    .option('--tag <tags>', 'Filter by tags (AND logic). Comma-separated or repeat flag.', collect, [])
    .option('--test <ids>', 'Run specific test IDs. Comma-separated or repeat flag.', collect, [])

    // Execution
    .option('-p, --parallel', 'Run tests in parallel', false)
    .option('-c, --concurrency <n>', 'Max parallel tests', parseInt, 3)
    .option('--timeout <ms>', 'Test timeout in milliseconds', parseInt, 60000)
    .option('-r, --retries <n>', 'Number of retries on failure', parseInt, 1)
    .option('-l, --limit <n>', 'Limit number of tests to run', parseInt)

    // Braintrust
    .option('-e, --experiment <name>', 'Braintrust experiment name (auto-generated if not provided)')
    .option('--no-braintrust', 'Disable Braintrust experiment tracking')
    .option('--project <name>', 'Braintrust project name', 'browser-operator')
    .option('--org <name>', 'Braintrust organization name', 'BO')
    .option('--braintrust-api-key <key>', 'Braintrust API key (or set BRAINTRUST_API_KEY)')

    // LLM Configuration
    .option('--provider <provider>', 'LLM provider (openai, cerebras, anthropic, litellm)', 'openai')
    .option('-m, --model <model>', 'Model for agents (e.g., gpt-4o, llama-3.3-70b)', 'gpt-4o')
    .option('--judge-provider <provider>', 'LLM provider for judge (defaults to openai)', 'openai')
    .option('--judge-model <model>', 'Model for evaluation judge', 'gpt-4o')
    .option('--api-key <key>', 'LLM API key (or set OPENAI_API_KEY/CEREBRAS_API_KEY)')

    // Output
    .option('-f, --format <format>', 'Output format (console, json, markdown)', 'console')
    .option('-o, --output <file>', 'Output file path')
    .option('-v, --verbose', 'Verbose output', false)
    .option('--screenshots', 'Capture screenshots', true)
    .option('--screenshot-dir <dir>', 'Screenshot directory', './eval-screenshots')

    // Browser
    .option('--chrome-path <path>', 'Path to Chrome executable')
    .option('--headless', 'Run browser in headless mode (default: visible UI)')
    .option('--remote-debugging-port <port>', 'Connect to existing browser on this port', parseInt)

    // Logging
    .option('--log-dir <dir>', 'Directory for detailed test logs', './eval-logs')
    .option('--detailed-logs', 'Enable detailed per-test logging', true)
    .option('--no-detailed-logs', 'Disable detailed per-test logging');

  program.parse(process.argv);

  const opts = program.opts();

  // Generate default experiment name if Braintrust is enabled (default) and no name provided
  const getExperimentName = (): string | undefined => {
    if (opts.braintrust === false) return undefined; // --no-braintrust flag
    if (opts.experiment) return opts.experiment;
    // Auto-generate: eval-YYYY-MM-DD-HH-MM
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `eval-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
  };

  const options: CLIOptions = {
    tool: opts.tool,
    tags: opts.tag,
    testIds: opts.test,
    parallel: opts.parallel,
    concurrency: opts.concurrency,
    timeout: opts.timeout,
    retries: opts.retries,
    limit: opts.limit,
    experiment: getExperimentName(),
    project: opts.project,
    org: opts.org,
    braintrustApiKey: opts.braintrustApiKey || process.env.BRAINTRUST_API_KEY,
    provider: opts.provider,
    model: opts.model,
    judgeProvider: opts.judgeProvider,
    judgeModel: opts.judgeModel,
    apiKey: getProviderConfig(opts.provider as LLMProvider, opts.apiKey).apiKey,
    judgeApiKey: getProviderConfig(opts.judgeProvider as LLMProvider, opts.apiKey).apiKey,
    format: opts.format,
    output: opts.output,
    verbose: opts.verbose,
    screenshots: opts.screenshots,
    screenshotDir: opts.screenshotDir,
    chromePath: opts.chromePath,
    headless: opts.headless,
    remoteDebuggingPort: opts.remoteDebuggingPort,
    logDir: opts.logDir,
    detailedLogs: opts.detailedLogs,
  };

  // Configure logging based on verbose flag
  Logger.configure({
    level: options.verbose ? LogLevel.DEBUG : LogLevel.WARN,
    includeTimestamp: options.verbose,
  });

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           Browser Operator Evaluation Runner                  ║
╚═══════════════════════════════════════════════════════════════╝
`);

  try {
    // Load test cases
    console.log('📦 Loading test cases...');
    const allTests = await loadTestCases();
    console.log(`   Found ${allTests.length} total test cases\n`);

    // Filter tests
    let tests = filterTestCases(allTests, options);

    // Apply limit if specified
    if (options.limit && tests.length > options.limit) {
      tests = tests.slice(0, options.limit);
    }

    if (tests.length === 0) {
      console.error('❌ No tests match the specified filters');
      console.log('\nFilters applied:');
      if (options.tool) console.log(`   - tool: ${options.tool}`);
      if (options.tags?.length) console.log(`   - tags: ${options.tags.join(', ')}`);
      if (options.testIds?.length) console.log(`   - tests: ${options.testIds.join(', ')}`);
      process.exit(1);
    }

    console.log(`🎯 Selected ${tests.length} tests to run`);
    if (options.verbose) {
      tests.forEach(t => console.log(`   - ${t.id}: ${t.name}`));
    }
    console.log('');

    // Initialize runner
    const runner = new TestRunner(options);
    await runner.init();

    // Run tests
    const summary = await runner.runTests(tests);

    // Generate report
    const reporter = getReporter(options);
    await reporter.generate(summary);

    // Print Braintrust link if available
    const experimentUrl = runner.getExperimentUrl();
    if (experimentUrl) {
      console.log(`\n🔗 View experiment: ${experimentUrl}`);
    }

    // Print log directory if detailed logging is enabled
    if (options.detailedLogs) {
      const logDir = runner.getLogDir();
      if (logDir) {
        console.log(`\n📁 Detailed logs: ${logDir}`);
      }
    }

    // Cleanup
    await runner.cleanup();

    // Print final summary
    printSummary(summary);

    // Exit with appropriate code
    process.exitCode = summary.failed + summary.errors > 0 ? 1 : 0;
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Print final summary
 */
function printSummary(summary: RunSummary) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                        SUMMARY                                ║
╠═══════════════════════════════════════════════════════════════╣
║  Total:    ${String(summary.total).padEnd(8)} │  Duration: ${(summary.duration / 1000).toFixed(1).padEnd(8)}s      ║
║  Passed:   ${String(summary.passed).padEnd(8)} │  Avg Score: ${(summary.averageScore * 100).toFixed(1).padEnd(7)}%      ║
║  Failed:   ${String(summary.failed).padEnd(8)} │  Avg Time:  ${(summary.averageDuration / 1000).toFixed(1).padEnd(8)}s     ║
║  Errors:   ${String(summary.errors).padEnd(8)} │                              ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const passRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0.0';
  const icon = summary.failed + summary.errors === 0 ? '✅' : '❌';
  console.log(`${icon} Pass rate: ${passRate}%\n`);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
