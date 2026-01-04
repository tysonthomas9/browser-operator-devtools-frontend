/**
 * Agent Bridge - Executes real DevTools agents in eval runner context
 *
 * This bridges the CLI runner to the actual DevTools agent implementations.
 * Uses the same AgentRunner logic as DevTools, ensuring consistency.
 */

import path from 'path';
import type { TestCase, CLIOptions } from './types.ts';
import type { ExecutionContext } from './BrowserExecutor.ts';
import { DOMTestExecutor } from './DOMTestExecutor.ts';
import type { DOMTestCase } from './test-cases/dom-tests.ts';
import { DirectCDPAdapter } from '../../front_end/panels/ai_chat/cdp/DirectCDPAdapter.ts';
import { ToolRegistry } from '../../front_end/panels/ai_chat/agent_framework/ConfigurableAgentTool.ts';
import type { LLMProvider } from '../../front_end/panels/ai_chat/LLM/LLMTypes.ts';
import { initializeLLMForEval } from './lib/LLMInit.ts';
import { setupToolsForEval } from './lib/ToolSetup.ts';
import type { TestLogger } from './TestLogger.ts';

interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: string;
  actions?: ActionRecord[];
  iterations?: number;
}

interface ActionRecord {
  action: string;
  target?: string;
  result?: string;
  timestamp: number;
}

/**
 * AgentBridge executes real DevTools agents for eval tests
 */
export class AgentBridge {
  private options: CLIOptions;
  private initialized = false;
  private domTestExecutor: DOMTestExecutor;

  constructor(options: CLIOptions) {
    this.options = options;
    this.domTestExecutor = new DOMTestExecutor();
  }

  /**
   * Initialize LLM client and register tools
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[AgentBridge] Initializing...');

    // Initialize LLM with eval runner's config
    await initializeLLMForEval({
      provider: this.options.provider || 'openai',
      apiKey: this.options.apiKey || '',
      model: this.options.model,
      providerURL: this.options.providerURL,
    });

    // Register all DevTools tools/agents
    await setupToolsForEval();

    this.initialized = true;
    console.log('[AgentBridge] Initialization complete');
  }

  /**
   * Execute a test case using the real DevTools agent
   */
  async execute(testCase: TestCase, context: ExecutionContext, logger?: TestLogger): Promise<AgentResult> {
    // Handle DOM tests separately (they don't use agents)
    if (testCase.tool === 'dom_test') {
      return this.executeDOMTest(testCase as DOMTestCase, context);
    }

    // Get the real DevTools agent from registry
    const agent = ToolRegistry.getRegisteredTool(testCase.tool);
    if (!agent) {
      const error = `Unknown agent: ${testCase.tool}. Available: ${ToolRegistry.getRegisteredToolNames().join(', ')}`;
      logger?.logExecution(`Agent error: ${error}`);
      return {
        success: false,
        error,
      };
    }

    // Create adapter for this execution context
    const adapter = new DirectCDPAdapter(context.cdp as any, context.page.url());

    try {
      // Prepare input based on test case type
      const input = this.prepareAgentInput(testCase);
      logger?.logExecution(`Agent input: ${JSON.stringify(input, null, 2)}`);

      const startTime = Date.now();

      // Execute with full CallCtx including CDP adapter and screenshot callback
      const result = await agent.execute(input, {
        apiKey: this.options.apiKey || '',
        provider: (this.options.provider || 'openai') as LLMProvider,
        model: this.options.model,
        miniModel: this.options.model,
        nanoModel: this.options.model,
        cdpAdapter: adapter,

        // Capture screenshot before each tool execution
        onBeforeToolExecution: async (toolName: string, _toolArgs: unknown) => {
          const testDir = logger?.getTestDir();
          // Check page exists and is not closed
          if (testDir && context.page && !context.page.isClosed()) {
            // Use TestLogger's counter to persist across agent executions
            const num = logger?.getNextScreenshotNumber() ?? 1;
            const filename = `action-${num.toString().padStart(3, '0')}-${toolName}.png`;
            const screenshotPath = path.join(testDir, filename);
            try {
              await context.page.screenshot({ path: screenshotPath, fullPage: true });
              logger?.logExecution(`Screenshot captured: ${filename}`);
            } catch (err) {
              // Only log errors that aren't related to closed pages/sessions
              const errStr = String(err);
              if (!errStr.includes('Target closed') && !errStr.includes('Session closed')) {
                logger?.logExecution(`Screenshot failed: ${err}`);
              }
            }
          }
        },
      });

      const durationMs = Date.now() - startTime;

      // Log tool calls from the agent session messages
      if (logger && result.agentSession?.messages) {
        // Build a map of tool call IDs to their results
        const toolResultMap = new Map<string, any>();
        for (const message of result.agentSession.messages) {
          if (message.type === 'tool_result') {
            const resultContent = message.content as any;
            toolResultMap.set(resultContent.toolCallId, resultContent);
          }
        }

        // Log each tool call with its result
        for (const message of result.agentSession.messages) {
          if (message.type === 'tool_call') {
            const toolCall = message.content as any;
            const toolResult = toolResultMap.get(toolCall.toolCallId);

            logger.logToolCall(
              toolCall.toolName || 'unknown',
              toolCall.toolArgs,
              toolResult?.result,
              toolResult?.duration || 0,
              toolResult?.error
            );
          }
        }
      }

      const mapped = this.mapAgentResult(result, testCase);
      logger?.logExecution(`Agent completed in ${durationMs}ms: ${mapped.success ? 'SUCCESS' : 'FAILED'}`);
      if (mapped.error) {
        logger?.logExecution(`Agent error: ${mapped.error}`);
      }

      return mapped;
    } catch (error) {
      logger?.logExecution(`Agent exception: ${error}`);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Execute DOM test using DOMTestExecutor
   */
  private async executeDOMTest(
    testCase: DOMTestCase,
    context: ExecutionContext
  ): Promise<AgentResult> {
    const result = await this.domTestExecutor.execute(testCase, context);

    return {
      success: result.success,
      output: {
        assertions: result.assertions,
        data: result.data,
      },
      error: result.error,
      iterations: 1,
    };
  }

  /**
   * Prepare agent input based on test case type
   */
  private prepareAgentInput(testCase: TestCase): Record<string, unknown> {
    const input = testCase.input as Record<string, unknown>;

    switch (testCase.tool) {
      case 'action_agent':
        // ActionAgent expects: { objective, reasoning, hint?, input_data? }
        return {
          objective: input.objective || input.query || '',
          reasoning: input.reasoning || 'Eval runner test',
          hint: input.hint,
          input_data: input.input_data,
        };

      case 'web_task_agent':
        // WebTaskAgent expects: { task: string }
        return {
          task: input.task || input.query || '',
        };

      case 'research_agent':
        // ResearchAgent expects: { query: string }
        return {
          query: input.query || '',
        };

      default:
        // Pass through as-is for other agents
        return input;
    }
  }

  /**
   * Map ConfigurableAgentResult → AgentResult for eval
   */
  private mapAgentResult(result: any, testCase: TestCase): AgentResult {
    // Handle error results
    if (result.error) {
      return {
        success: false,
        error: result.error,
        iterations: result.agentSession?.iterations || 1,
      };
    }

    // Extract actions from agent session
    const actions: ActionRecord[] = [];
    if (result.agentSession?.toolCalls) {
      for (const toolCall of result.agentSession.toolCalls) {
        actions.push({
          action: toolCall.toolName || 'unknown',
          target: toolCall.toolArgs?.nodeId ? `nodeId: ${toolCall.toolArgs.nodeId}` :
                  toolCall.toolArgs?.xpath ? `xpath: ${toolCall.toolArgs.xpath}` :
                  undefined,
          result: toolCall.result ? 'success' : 'failed',
          timestamp: Date.now(),
        });
      }
    }

    // Determine success based on result structure
    const success = result.success !== undefined ? result.success :
                   !result.error && (result.output || result.message);

    return {
      success: Boolean(success),
      output: result.output || result.message || result,
      actions,
      iterations: result.agentSession?.iterations || 1,
    };
  }
}
