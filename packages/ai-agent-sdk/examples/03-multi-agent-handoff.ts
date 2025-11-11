// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Example 3: Multi-Agent Handoff Pattern
 *
 * This example demonstrates how to:
 * - Create specialized agents with different capabilities
 * - Implement agent handoff based on task type
 * - Use LLMClient for agent decision-making
 * - Coordinate multiple agents in a workflow
 * - Handle agent failures with fallback strategies
 */

import {
  GraphBuilder,
  LLMClient,
  createAsyncTransformNode,
  createMultiConditionRouter,
  createFinalNode,
  END_NODE,
  type LLMMessage
} from '../src/index.js';

// Define multi-agent state
interface MultiAgentState {
  task: string;
  currentAgent: 'router' | 'researcher' | 'coder' | 'reviewer' | 'complete';
  messages: LLMMessage[];
  researchResults?: string;
  codeOutput?: string;
  reviewComments?: string;
  error?: string;
  handoffCount: number;
}

// Simulate different specialized agents
class SpecializedAgent {
  constructor(
    private name: string,
    private systemPrompt: string,
    private llmClient: LLMClient
  ) {}

  async process(task: string, context: string): Promise<string> {
    console.log(`\n  🤖 ${this.name} processing task...`);

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `Task: ${task}\n\nContext: ${context}`
      }
    ];

    try {
      const response = await this.llmClient.call({
        messages,
        options: {
          temperature: 0.7,
          maxTokens: 500
        }
      });

      return response.content;
    } catch (error) {
      console.error(`  ❌ ${this.name} encountered an error:`, error);
      throw error;
    }
  }
}

async function multiAgentExample() {
  console.log('=== Example 3: Multi-Agent Handoff ===\n');

  // Step 1: Initialize LLMClient
  const llmClient = LLMClient.getInstance();

  await llmClient.initialize({
    providers: [
      {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
        models: ['gpt-4.1']
      }
    ],
    defaultProvider: 'openai',
    defaultModel: 'gpt-4.1'
  });

  console.log('✓ LLMClient initialized\n');

  // Step 2: Create specialized agents
  const researcherAgent = new SpecializedAgent(
    'Researcher',
    'You are a research specialist. Your job is to gather and analyze information on the given topic. Provide concise, factual summaries.',
    llmClient
  );

  const coderAgent = new SpecializedAgent(
    'Coder',
    'You are a coding specialist. Your job is to write clean, well-documented code based on requirements. Always include comments.',
    llmClient
  );

  const reviewerAgent = new SpecializedAgent(
    'Reviewer',
    'You are a code reviewer. Your job is to analyze code for quality, correctness, and best practices. Provide constructive feedback.',
    llmClient
  );

  console.log('✓ Created 3 specialized agents\n');

  // Step 3: Create workflow nodes

  // Router node - decides which agent should handle the task
  const routerNode = createAsyncTransformNode<MultiAgentState>(
    'router',
    async (state) => {
      console.log('  📍 Routing task to appropriate agent...');

      // Simple routing logic based on task keywords
      const task = state.task.toLowerCase();

      let nextAgent: MultiAgentState['currentAgent'];

      if (task.includes('research') || task.includes('explain')) {
        nextAgent = 'researcher';
      } else if (task.includes('code') || task.includes('implement')) {
        nextAgent = 'coder';
      } else if (task.includes('review') || task.includes('check')) {
        nextAgent = 'reviewer';
      } else {
        // Default to researcher for general questions
        nextAgent = 'researcher';
      }

      console.log(`  → Routing to: ${nextAgent}`);

      return {
        ...state,
        currentAgent: nextAgent,
        handoffCount: state.handoffCount + 1
      };
    }
  );

  // Researcher node
  const researcherNode = createAsyncTransformNode<MultiAgentState>(
    'researcher',
    async (state) => {
      const result = await researcherAgent.process(
        state.task,
        state.messages.map(m => m.content).join('\n')
      );

      return {
        ...state,
        researchResults: result,
        currentAgent: 'complete',
        messages: [
          ...state.messages,
          { role: 'assistant', content: result }
        ]
      };
    }
  );

  // Coder node
  const coderNode = createAsyncTransformNode<MultiAgentState>(
    'coder',
    async (state) => {
      const context = state.researchResults || 'No prior context';
      const result = await coderAgent.process(state.task, context);

      return {
        ...state,
        codeOutput: result,
        currentAgent: 'reviewer', // Automatically hand off to reviewer
        messages: [
          ...state.messages,
          { role: 'assistant', content: result }
        ]
      };
    }
  );

  // Reviewer node
  const reviewerNode = createAsyncTransformNode<MultiAgentState>(
    'reviewer',
    async (state) => {
      const codeToReview = state.codeOutput || 'No code available';
      const result = await reviewerAgent.process(
        'Review this code',
        codeToReview
      );

      return {
        ...state,
        reviewComments: result,
        currentAgent: 'complete',
        messages: [
          ...state.messages,
          { role: 'assistant', content: result }
        ]
      };
    }
  );

  // Final aggregation node
  const finalNode = createFinalNode<MultiAgentState>(
    'finish',
    (state) => state.currentAgent === 'complete'
  );

  // Step 4: Create routing logic
  const agentRouter = createMultiConditionRouter<MultiAgentState>(
    [
      {
        condition: (s) => s.currentAgent === 'researcher',
        route: 'researcher'
      },
      {
        condition: (s) => s.currentAgent === 'coder',
        route: 'coder'
      },
      {
        condition: (s) => s.currentAgent === 'reviewer',
        route: 'reviewer'
      },
      {
        condition: (s) => s.currentAgent === 'complete',
        route: 'finish'
      }
    ],
    END_NODE
  );

  // Step 5: Build the multi-agent graph
  const builder = new GraphBuilder<MultiAgentState>();

  const graph = builder
    .addNode('router', routerNode)
    .addNode('researcher', researcherNode)
    .addNode('coder', coderNode)
    .addNode('reviewer', reviewerNode)
    .addNode('finish', finalNode)
    .addEdge('router', agentRouter)
    .addEdge('researcher', (state) =>
      state.currentAgent === 'complete' ? 'finish' : 'router'
    )
    .addEdge('coder', agentRouter)
    .addEdge('reviewer', (state) =>
      state.currentAgent === 'complete' ? 'finish' : 'router'
    )
    .addEdge('finish', END_NODE)
    .setEntryPoint('router')
    .build();

  console.log('✓ Multi-agent graph built\n');

  // Step 6: Execute multi-agent workflows

  // Example 1: Research task
  console.log('--- Example 1: Research Task ---\n');

  const researchState: MultiAgentState = {
    task: 'Research the benefits of state machines in AI agents',
    currentAgent: 'router',
    messages: [],
    handoffCount: 0
  };

  try {
    const researchResult = await graph.invoke(researchState, {
      onProgress: (state, nodeName) => {
        console.log(`[Agent: ${state.currentAgent}] Node: ${nodeName}`);
      }
    });

    console.log('\n✅ Research completed');
    console.log(`Handoffs: ${researchResult.handoffCount}`);
    console.log(`\nResults:\n${researchResult.researchResults?.substring(0, 200)}...`);
  } catch (error) {
    console.error('Research failed:', error);
  }

  // Example 2: Code + Review task
  console.log('\n--- Example 2: Code + Review Task ---\n');

  const codingState: MultiAgentState = {
    task: 'Implement a simple retry function with exponential backoff',
    currentAgent: 'router',
    messages: [],
    handoffCount: 0
  };

  try {
    const codingResult = await graph.invoke(codingState, {
      onProgress: (state, nodeName) => {
        console.log(`[Agent: ${state.currentAgent}] Node: ${nodeName}`);
      }
    });

    console.log('\n✅ Coding + Review completed');
    console.log(`Handoffs: ${codingResult.handoffCount}`);
    console.log(`\nCode Output:\n${codingResult.codeOutput?.substring(0, 200)}...`);
    console.log(`\nReview Comments:\n${codingResult.reviewComments?.substring(0, 200)}...`);
  } catch (error) {
    console.error('Coding task failed:', error);
  }

  console.log('\n=== Example Complete ===\n');
  console.log('💡 Key Takeaways:');
  console.log('  - Agents can hand off tasks to other specialized agents');
  console.log('  - Routing logic determines which agent handles each task');
  console.log('  - Agents can automatically chain (e.g., coder → reviewer)');
  console.log('  - State carries context between agent transitions');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  multiAgentExample().catch(console.error);
}

export { multiAgentExample };
