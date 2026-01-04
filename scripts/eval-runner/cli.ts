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
import type { CLIOptions, TestCase, RunSummary } from './types.ts';
import { TestRunner } from './TestRunner.ts';
import { ConsoleReporter } from './reporters/ConsoleReporter.ts';
import { JsonReporter } from './reporters/JsonReporter.ts';
import { MarkdownReporter } from './reporters/MarkdownReporter.ts';
import { domTests } from './test-cases/dom-tests.ts';

// Test case imports - load from TypeScript source files
async function loadTestCases(): Promise<TestCase[]> {
  // Start with DOM tests which are always available
  const tests: TestCase[] = [...domTests];

  // Try to load DevTools test cases directly from TypeScript files
  try {
    // Import action-agent tests
    const actionAgentModule = await import('../../front_end/panels/ai_chat/evaluation/test-cases/action-agent-tests.ts');
    if (actionAgentModule.actionAgentTests) {
      tests.push(...actionAgentModule.actionAgentTests);
      console.log(`   Loaded ${actionAgentModule.actionAgentTests.length} action-agent tests`);
    }
  } catch (error) {
    console.log(`   Could not load action-agent tests: ${error}`);
  }

  try {
    // Import action-agent shadow DOM tests
    const shadowDomModule = await import('../../front_end/panels/ai_chat/evaluation/test-cases/action-agent-shadow-dom-tests.ts');
    if (shadowDomModule.shadowDOMActionTests) {
      tests.push(...shadowDomModule.shadowDOMActionTests);
      console.log(`   Loaded ${shadowDomModule.shadowDOMActionTests.length} shadow-dom action tests`);
    }
  } catch (error) {
    console.log(`   Could not load shadow-dom tests: ${error}`);
  }

  try {
    // Import action-agent iframe tests
    const iframeModule = await import('../../front_end/panels/ai_chat/evaluation/test-cases/action-agent-iframe-tests.ts');
    if (iframeModule.iframeActionTests) {
      tests.push(...iframeModule.iframeActionTests);
      console.log(`   Loaded ${iframeModule.iframeActionTests.length} iframe action tests`);
    }
    if (iframeModule.encodedIdActionTests) {
      tests.push(...iframeModule.encodedIdActionTests);
      console.log(`   Loaded ${iframeModule.encodedIdActionTests.length} encodedId action tests`);
    }
  } catch (error) {
    console.log(`   Could not load iframe tests: ${error}`);
  }

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

  program
    // Test selection
    .option('-t, --tool <tool>', 'Filter by tool name (action_agent, web_task_agent, etc.)')
    .option('--tag <tags...>', 'Filter by tags (AND logic)')
    .option('--test <ids...>', 'Run specific test IDs')

    // Execution
    .option('-p, --parallel', 'Run tests in parallel', false)
    .option('-c, --concurrency <n>', 'Max parallel tests', parseInt, 3)
    .option('--timeout <ms>', 'Test timeout in milliseconds', parseInt, 60000)
    .option('-r, --retries <n>', 'Number of retries on failure', parseInt, 1)
    .option('-l, --limit <n>', 'Limit number of tests to run', parseInt)

    // Braintrust
    .option('-e, --experiment <name>', 'Braintrust experiment name (enables tracking)')
    .option('--project <name>', 'Braintrust project name', 'browser-operator')
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
    .option('--headless', 'Run browser in headless mode', true)
    .option('--no-headless', 'Run browser with visible UI')
    .option('--remote-debugging-port <port>', 'Connect to existing browser on this port', parseInt)

    // Logging
    .option('--log-dir <dir>', 'Directory for detailed test logs', './eval-logs')
    .option('--detailed-logs', 'Enable detailed per-test logging', true)
    .option('--no-detailed-logs', 'Disable detailed per-test logging');

  program.parse(process.argv);

  const opts = program.opts();

  // Determine API key based on provider
  const getApiKeyForProvider = (provider: string): string | undefined => {
    if (opts.apiKey) return opts.apiKey;
    switch (provider) {
      case 'cerebras': return process.env.CEREBRAS_API_KEY;
      case 'openai': return process.env.OPENAI_API_KEY;
      case 'groq': return process.env.GROQ_API_KEY;
      case 'anthropic': return process.env.ANTHROPIC_API_KEY;
      default: return process.env.OPENAI_API_KEY;
    }
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
    experiment: opts.experiment,
    project: opts.project,
    braintrustApiKey: opts.braintrustApiKey || process.env.BRAINTRUST_API_KEY,
    provider: opts.provider,
    model: opts.model,
    judgeProvider: opts.judgeProvider,
    judgeModel: opts.judgeModel,
    apiKey: getApiKeyForProvider(opts.provider),
    judgeApiKey: getApiKeyForProvider(opts.judgeProvider),
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
