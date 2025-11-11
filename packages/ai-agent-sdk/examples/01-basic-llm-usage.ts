// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Example 1: Basic LLM Usage
 *
 * This example demonstrates how to:
 * - Initialize the LLMClient with multiple providers
 * - Make basic LLM calls
 * - Handle responses and parse tool calls
 * - Switch between different providers
 */

import { LLMClient, type LLMMessage, type LLMCallRequest } from '../src/index.js';

async function basicLLMExample() {
  console.log('=== Example 1: Basic LLM Usage ===\n');

  // Step 1: Get the singleton LLMClient instance
  const llmClient = LLMClient.getInstance();

  // Step 2: Initialize with provider configurations
  await llmClient.initialize({
    providers: [
      {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
        models: ['gpt-4.1', 'o3-mini']
      },
      {
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY || 'your-api-key',
        models: ['llama-3.3-70b']
      }
    ],
    defaultProvider: 'openai',
    defaultModel: 'gpt-4.1'
  });

  console.log('✓ LLMClient initialized with OpenAI and Groq providers\n');

  // Step 3: Make a simple call using default provider
  const messages: LLMMessage[] = [
    {
      role: 'user',
      content: 'Explain what a state machine is in 2 sentences.'
    }
  ];

  const request: LLMCallRequest = {
    messages,
    options: {
      temperature: 0.7,
      maxTokens: 150
    }
  };

  console.log('Making LLM call with default provider...');
  const response = await llmClient.call(request);

  console.log(`\nResponse from ${response.provider}/${response.modelName}:`);
  console.log(response.content);
  console.log(`\nTokens: ${response.usage?.totalTokens || 'N/A'}`);

  // Step 4: Make a call with a specific provider
  console.log('\n--- Switching to Groq provider ---\n');

  const groqRequest: LLMCallRequest = {
    provider: 'groq',
    modelName: 'llama-3.3-70b',
    messages,
    options: {
      temperature: 0.5,
      maxTokens: 150
    }
  };

  const groqResponse = await llmClient.call(groqRequest);

  console.log(`Response from ${groqResponse.provider}/${groqResponse.modelName}:`);
  console.log(groqResponse.content);

  // Step 5: Using tool calls (function calling)
  console.log('\n--- Example with tool calling ---\n');

  const toolMessages: LLMMessage[] = [
    {
      role: 'user',
      content: 'What is the weather in San Francisco?'
    }
  ];

  const toolRequest: LLMCallRequest = {
    messages: toolMessages,
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The temperature unit'
              }
            },
            required: ['location']
          }
        }
      }
    ]
  };

  const toolResponse = await llmClient.call(toolRequest);
  const parsed = llmClient.parseResponse(toolResponse);

  if (parsed.toolCalls && parsed.toolCalls.length > 0) {
    console.log('✓ LLM requested tool calls:');
    for (const toolCall of parsed.toolCalls) {
      console.log(`  - ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
    }
  }

  // Step 6: Get available models
  console.log('\n--- Available Models ---\n');
  const models = await llmClient.getAvailableModels();

  console.log('Registered models:');
  for (const model of models.slice(0, 5)) {
    console.log(`  - ${model.id} (${model.provider})`);
  }
  console.log(`  ... and ${models.length - 5} more`);

  console.log('\n=== Example Complete ===\n');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  basicLLMExample().catch(console.error);
}

export { basicLLMExample };
