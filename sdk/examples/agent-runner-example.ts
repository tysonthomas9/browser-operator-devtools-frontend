/**
 * AgentRunner Example
 *
 * Demonstrates advanced multi-iteration agent execution with:
 * - Error recovery
 * - Detailed session tracking
 * - Progress events
 * - Tool execution
 */

import { AgentRunner, createTool } from '../packages/core/src/index.js';
import { OpenAIProvider } from '../packages/core/src/llm/OpenAIProvider.js';
import { z } from 'zod';

// Create tools
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  schema: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async (args) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      location: args.location,
      temperature: 72,
      conditions: 'Sunny',
      humidity: 65,
    };
  },
});

const searchTool = createTool({
  name: 'search',
  description: 'Search the web for information',
  schema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async (args) => {
    // Simulate search
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      results: [
        { title: 'Result 1', snippet: 'Information about ' + args.query },
        { title: 'Result 2', snippet: 'More details on ' + args.query },
      ],
    };
  },
});

const calculatorTool = createTool({
  name: 'calculate',
  description: 'Perform a mathematical calculation',
  schema: z.object({
    expression: z.string().describe('Math expression to evaluate'),
  }),
  execute: async (args) => {
    try {
      // Safe eval for simple expressions
      const result = eval(args.expression);
      return { result };
    } catch (error) {
      throw new Error(`Invalid expression: ${args.expression}`);
    }
  },
});

// Initialize provider
const apiKey = process.env.OPENAI_API_KEY || 'your-api-key-here';
const provider = new OpenAIProvider(apiKey);

// Create AgentRunner
const runner = new AgentRunner({
  model: 'gpt-4o-mini',
  provider,
  instructions: `You are a helpful assistant with access to tools.
Use the tools to answer user questions accurately.
When you have gathered all necessary information, provide a final answer.`,
  tools: {
    get_weather: weatherTool,
    search: searchTool,
    calculate: calculatorTool,
  },
  maxIterations: 10,
  continueOnError: true,
});

// Example 1: Basic execution with progress tracking
async function basicExample() {
  console.log('\\n=== Example 1: Basic Execution ===\\n');

  const result = await runner.run(
    'What is the weather in San Francisco? Also, what is 15 * 23?',
    {
      onProgress: (event) => {
        console.log(`[${event.type}]`, event.data);
      },
    }
  );

  console.log('\\n--- Result ---');
  console.log('Success:', result.success);
  console.log('Output:', result.output);
  console.log('\\nSession Summary:');
  console.log('- ID:', result.session.sessionId);
  console.log('- Iterations:', result.session.iterationCount);
  console.log('- Tool calls:', result.session.toolCalls.length);
  console.log('- Termination:', result.session.terminationReason);
}

// Example 2: Error recovery
async function errorRecoveryExample() {
  console.log('\\n=== Example 2: Error Recovery ===\\n');

  // Create a tool that sometimes fails
  const flaky Tool = createTool({
    name: 'flaky_tool',
    description: 'A tool that randomly fails',
    schema: z.object({
      data: z.string(),
    }),
    execute: async (args) => {
      if (Math.random() > 0.5) {
        throw new Error('Random failure occurred');
      }
      return { success: true, data: args.data };
    },
  });

  const flakyRunner = new AgentRunner({
    model: 'gpt-4o-mini',
    provider,
    tools: { flaky_tool: flakyTool },
    maxIterations: 5,
    continueOnError: true, // Agent will continue after errors
  });

  const result = await flakyRunner.run('Try using the flaky_tool with data "test"');

  console.log('Success:', result.success);
  console.log('Tool results:', result.session.toolResults);
  console.log('Errors encountered:', result.session.toolResults.filter((r) => !r.success).length);
}

// Example 3: Session tracking and analysis
async function sessionTrackingExample() {
  console.log('\\n=== Example 3: Session Tracking ===\\n');

  const result = await runner.run(
    'Search for information about TypeScript, then tell me about it.'
  );

  const session = result.session;

  console.log('\\n--- Session Analysis ---');
  console.log(`Duration: ${session.endTime!.getTime() - session.startTime.getTime()}ms`);
  console.log(`Messages: ${session.messages.length}`);
  console.log(`Tool Calls: ${session.toolCalls.length}`);

  console.log('\\nTool Call Timeline:');
  for (const call of session.toolCalls) {
    const result = session.toolResults.find((r) => r.toolCallId === call.id);
    console.log(`  [Iteration ${call.iteration}] ${call.toolName}`);
    console.log(`    Args:`, call.toolArgs);
    console.log(`    Success:`, result?.success);
    console.log(`    Duration:`, result?.duration, 'ms');
  }

  console.log('\\nMessage Flow:');
  for (const msg of session.messages) {
    const prefix = msg.iteration ? `[Iter ${msg.iteration}]` : '[Initial]';
    console.log(`  ${prefix} ${msg.role}: ${msg.content.substring(0, 50)}...`);
  }
}

// Example 4: Cancellation with AbortSignal
async function cancellationExample() {
  console.log('\\n=== Example 4: Cancellation ===\\n');

  const controller = new AbortController();

  // Cancel after 2 seconds
  setTimeout(() => {
    console.log('Aborting execution...');
    controller.abort();
  }, 2000);

  try {
    const result = await runner.run('Search for many things and analyze them deeply.', {
      abortSignal: controller.signal,
      maxIterations: 20, // Allow many iterations
    });

    console.log('Termination reason:', result.session.terminationReason);
    console.log('Completed iterations:', result.session.iterationCount);
  } catch (error) {
    console.log('Error:', error);
  }
}

// Example 5: Custom session ID and metadata
async function customSessionExample() {
  console.log('\\n=== Example 5: Custom Session ===\\n');

  const result = await runner.run('What is the weather in New York?', {
    sessionId: 'custom-session-123',
  });

  console.log('Session ID:', result.session.sessionId);
  console.log('Metadata:', result.session.metadata);
}

// Example 6: Max iterations handling
async function maxIterationsExample() {
  console.log('\\n=== Example 6: Max Iterations ===\\n');

  const result = await runner.run(
    'Keep searching for information until you find the meaning of life.',
    {
      maxIterations: 3, // Limit iterations
      onProgress: (event) => {
        if (event.type === 'iteration_started') {
          console.log('Iteration:', (event.data as any).iteration);
        }
      },
    }
  );

  console.log('\\nResult:');
  console.log('Success:', result.success);
  console.log('Termination:', result.session.terminationReason);
  console.log('Iterations used:', result.session.iterationCount);
  if (!result.success) {
    console.log('Error:', result.error);
  }
}

// Run all examples
async function main() {
  try {
    await basicExample();
    await errorRecoveryExample();
    await sessionTrackingExample();
    await cancellationExample();
    await customSessionExample();
    await maxIterationsExample();

    console.log('\\n=== All examples completed! ===\\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
