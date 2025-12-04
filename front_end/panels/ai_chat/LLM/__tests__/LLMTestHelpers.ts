// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Test utilities for LLM module testing
 * Provides mock factories, fetch stubs, localStorage helpers, and assertion utilities
 */

import type { LLMMessage, LLMResponse, LLMErrorType, RetryConfig } from '../LLMTypes.js';
import { LLMErrorType as ErrorType } from '../LLMTypes.js';

// Declare require for CommonJS module imports used in test helpers
declare const require: (module: string) => any;

// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');

// ============ MOCK RESPONSE FACTORIES ============

export interface MockResponseOptions {
  text?: string;
  functionCall?: { name: string; arguments: any };
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Creates a mock OpenAI Responses API response
 * Note: OpenAI uses Responses API (/v1/responses), NOT Chat Completions!
 */
export function createMockOpenAIResponse(options: MockResponseOptions = {}): any {
  const output: any[] = [];

  if (options.functionCall) {
    output.push({
      type: 'function_call',
      name: options.functionCall.name,
      arguments: JSON.stringify(options.functionCall.arguments),
      call_id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    });
  } else if (options.text !== undefined) {
    output.push({
      type: 'message',
      content: [{ type: 'output_text', text: options.text }],
    });
  }

  return {
    output,
    usage: options.usage || { input_tokens: 100, output_tokens: 50 },
  };
}

/**
 * Creates a mock Anthropic Messages API response
 */
export function createMockAnthropicResponse(options: MockResponseOptions = {}): any {
  const content: any[] = [];

  if (options.functionCall) {
    content.push({
      type: 'tool_use',
      id: `toolu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: options.functionCall.name,
      input: options.functionCall.arguments,
    });
  } else if (options.text !== undefined) {
    content.push({
      type: 'text',
      text: options.text,
    });
  }

  return {
    content,
    usage: {
      input_tokens: options.usage?.input_tokens || 100,
      output_tokens: options.usage?.output_tokens || 50,
    },
    stop_reason: options.functionCall ? 'tool_use' : 'end_turn',
  };
}

/**
 * Creates a mock Google AI (Gemini) response
 */
export function createMockGoogleAIResponse(options: MockResponseOptions = {}): any {
  const parts: any[] = [];

  if (options.functionCall) {
    parts.push({
      functionCall: {
        name: options.functionCall.name,
        args: options.functionCall.arguments,
      },
    });
  } else if (options.text !== undefined) {
    parts.push({ text: options.text });
  }

  return {
    candidates: [
      {
        content: {
          parts,
          role: 'model',
        },
        finishReason: options.functionCall ? 'FUNCTION_CALL' : 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: options.usage?.input_tokens || 100,
      candidatesTokenCount: options.usage?.output_tokens || 50,
    },
  };
}

/**
 * Creates a mock OpenAI-compatible response (for Groq, OpenRouter, Cerebras, LiteLLM)
 */
export function createMockOpenAICompatibleResponse(options: MockResponseOptions = {}): any {
  const message: any = { role: 'assistant' };

  if (options.functionCall) {
    message.tool_calls = [
      {
        id: `call_${Date.now()}`,
        type: 'function',
        function: {
          name: options.functionCall.name,
          arguments: JSON.stringify(options.functionCall.arguments),
        },
      },
    ];
  } else {
    message.content = options.text || '';
  }

  return {
    choices: [{ message, finish_reason: options.functionCall ? 'tool_calls' : 'stop' }],
    usage: {
      prompt_tokens: options.usage?.input_tokens || 100,
      completion_tokens: options.usage?.output_tokens || 50,
      total_tokens: (options.usage?.input_tokens || 100) + (options.usage?.output_tokens || 50),
    },
  };
}

// ============ ERROR RESPONSE FACTORIES ============

export interface ErrorResponseOptions {
  message?: string;
  code?: string;
  retryAfter?: number;
}

/**
 * Creates a mock 401 Unauthorized response (AUTH_ERROR - NOT retryable)
 */
export function createMock401Response(provider: string, options: ErrorResponseOptions = {}): Response {
  const errorBody = {
    error: {
      message: options.message || `Invalid API key for ${provider}`,
      type: 'authentication_error',
      code: options.code || 'invalid_api_key',
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status: 401,
    statusText: 'Unauthorized',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a mock 403 Forbidden response (AUTH_ERROR - NOT retryable)
 */
export function createMock403Response(provider: string, options: ErrorResponseOptions = {}): Response {
  const errorBody = {
    error: {
      message: options.message || `Access forbidden for ${provider}`,
      type: 'permission_error',
      code: options.code || 'forbidden',
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status: 403,
    statusText: 'Forbidden',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a mock 429 Rate Limit response (RATE_LIMIT_ERROR - retryable with 60s delay)
 */
export function createMock429Response(provider: string, options: ErrorResponseOptions = {}): Response {
  const errorBody = {
    error: {
      message: options.message || `Rate limit exceeded for ${provider}`,
      type: 'rate_limit_error',
      code: options.code || 'rate_limit_exceeded',
    },
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.retryAfter) {
    headers['Retry-After'] = String(options.retryAfter);
  }

  return new Response(JSON.stringify(errorBody), {
    status: 429,
    statusText: 'Too Many Requests',
    headers,
  });
}

/**
 * Creates a mock 500 Internal Server Error response (SERVER_ERROR - retryable)
 */
export function createMock500Response(provider: string, options: ErrorResponseOptions = {}): Response {
  const errorBody = {
    error: {
      message: options.message || `Internal server error from ${provider}`,
      type: 'server_error',
      code: options.code || 'internal_error',
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status: 500,
    statusText: 'Internal Server Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a mock 503 Service Unavailable response (SERVER_ERROR - retryable)
 */
export function createMock503Response(provider: string, options: ErrorResponseOptions = {}): Response {
  const errorBody = {
    error: {
      message: options.message || `${provider} service temporarily unavailable`,
      type: 'server_error',
      code: options.code || 'service_unavailable',
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a mock quota exceeded response (QUOTA_ERROR - NOT retryable)
 */
export function createMockQuotaExceededResponse(provider: string, options: ErrorResponseOptions = {}): Response {
  const errorBody = {
    error: {
      message: options.message || `Insufficient quota for ${provider}`,
      type: 'insufficient_quota',
      code: options.code || 'quota_exceeded',
    },
  };

  return new Response(JSON.stringify(errorBody), {
    status: 402,
    statusText: 'Payment Required',
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a network error (NETWORK_ERROR - retryable)
 */
export function createMockNetworkError(message?: string): Error {
  return new Error(message || 'fetch failed: Network error');
}

/**
 * Creates a timeout error (NETWORK_ERROR - retryable)
 */
export function createMockTimeoutError(message?: string): Error {
  return new Error(message || 'Request timeout');
}

/**
 * Creates a JSON parse error (JSON_PARSE_ERROR - retryable)
 */
export function createMockJSONParseError(message?: string): Error {
  return new Error(message || 'JSON parsing failed: Unexpected token');
}

// ============ FETCH STUB HELPERS ============

export interface FetchStubConfig {
  url?: string | RegExp;
  method?: 'GET' | 'POST';
  response?: any;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  delay?: number;
  error?: Error;
}

/**
 * Creates a sinon stub for fetch with configurable response
 */
export function createFetchStub(config: FetchStubConfig): sinon.SinonStub {
  const stub = sinon.stub(globalThis, 'fetch');

  if (config.error) {
    stub.rejects(config.error);
  } else {
    const responseInit: ResponseInit = {
      status: config.responseStatus || 200,
      statusText: config.responseStatus === 200 ? 'OK' : 'Error',
      headers: {
        'Content-Type': 'application/json',
        ...config.responseHeaders,
      },
    };

    const response = new Response(JSON.stringify(config.response || {}), responseInit);

    if (config.delay) {
      stub.callsFake(async () => {
        await new Promise(resolve => setTimeout(resolve, config.delay));
        return response;
      });
    } else {
      stub.resolves(response);
    }
  }

  return stub;
}

/**
 * Creates a fetch stub that returns different responses sequentially
 * Useful for testing retry logic
 */
export function createSequentialFetchStub(
  responses: Array<{ response?: any; status?: number; error?: Error; delay?: number }>
): sinon.SinonStub {
  const stub = sinon.stub(globalThis, 'fetch');
  let callIndex = 0;

  stub.callsFake(async () => {
    const responseConfig = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;

    if (responseConfig.delay) {
      await new Promise(resolve => setTimeout(resolve, responseConfig.delay));
    }

    if (responseConfig.error) {
      throw responseConfig.error;
    }

    return new Response(JSON.stringify(responseConfig.response || {}), {
      status: responseConfig.status || 200,
      statusText: responseConfig.status === 200 ? 'OK' : 'Error',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return stub;
}

/**
 * Restores the fetch stub
 */
export function restoreFetch(stub: sinon.SinonStub): void {
  stub.restore();
}

// ============ LOCALSTORAGE HELPERS ============

export interface LocalStorageMockConfig {
  [key: string]: string | null;
}

/**
 * Common localStorage keys used by LLM providers
 */
export const STORAGE_KEYS = {
  // OpenAI
  OPENAI_API_KEY: 'ai_chat_api_key',

  // Anthropic
  ANTHROPIC_API_KEY: 'ai_chat_anthropic_api_key',

  // LiteLLM
  LITELLM_ENDPOINT: 'ai_chat_litellm_endpoint',
  LITELLM_API_KEY: 'ai_chat_litellm_api_key',

  // Groq
  GROQ_API_KEY: 'ai_chat_groq_api_key',

  // OpenRouter
  OPENROUTER_API_KEY: 'ai_chat_openrouter_api_key',

  // Cerebras
  CEREBRAS_API_KEY: 'ai_chat_cerebras_api_key',

  // Google AI
  GOOGLEAI_API_KEY: 'ai_chat_googleai_api_key',

  // BrowserOperator
  BROWSEROPERATOR_API_KEY: 'ai_chat_browseroperator_api_key',

  // General
  PROVIDER: 'ai_chat_provider',
  MODEL_SELECTION: 'ai_chat_model_selection',
  CUSTOM_MODELS: 'ai_chat_custom_models',
  ALL_MODEL_OPTIONS: 'ai_chat_all_model_options',
} as const;

/**
 * Creates a mock localStorage with configurable initial values
 */
export function createLocalStorageMock(config: LocalStorageMockConfig = {}): {
  mock: Storage;
  store: Map<string, string>;
  getItem: sinon.SinonStub;
  setItem: sinon.SinonStub;
  removeItem: sinon.SinonStub;
  clear: sinon.SinonStub;
  restore: () => void;
} {
  const store = new Map<string, string>();

  // Initialize with config values
  for (const [key, value] of Object.entries(config)) {
    if (value !== null) {
      store.set(key, value);
    }
  }

  const originalLocalStorage = globalThis.localStorage;

  const getItem = sinon.stub().callsFake((key: string) => store.get(key) || null);
  const setItem = sinon.stub().callsFake((key: string, value: string) => store.set(key, value));
  const removeItem = sinon.stub().callsFake((key: string) => store.delete(key));
  const clear = sinon.stub().callsFake(() => store.clear());

  const mockStorage: Storage = {
    getItem: getItem as unknown as Storage['getItem'],
    setItem: setItem as unknown as Storage['setItem'],
    removeItem: removeItem as unknown as Storage['removeItem'],
    clear: clear as unknown as Storage['clear'],
    get length() { return store.size; },
    key(index: number) { return Array.from(store.keys())[index] || null; },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });

  return {
    mock: mockStorage,
    store,
    getItem,
    setItem,
    removeItem,
    clear,
    restore: () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    },
  };
}

// ============ SINGLETON RESET HELPERS ============

/**
 * Resets the LLMClient singleton for testing
 */
export function resetLLMClient(): void {
  // Access private instance via type assertion
  const LLMClientModule = require('../LLMClient.js');
  if (LLMClientModule.LLMClient) {
    (LLMClientModule.LLMClient as any).instance = null;
  }
}

/**
 * Resets the LLMProviderRegistry for testing
 */
export function resetLLMProviderRegistry(): void {
  const RegistryModule = require('../LLMProviderRegistry.js');
  if (RegistryModule.LLMProviderRegistry) {
    RegistryModule.LLMProviderRegistry.clear();
  }
}

// ============ TEST MESSAGE FACTORIES ============

/**
 * Creates test messages for LLM calls
 */
export function createTestMessages(options: {
  includeSystem?: boolean;
  includeTools?: boolean;
  includeImages?: boolean;
  systemPrompt?: string;
  userMessage?: string;
} = {}): LLMMessage[] {
  const messages: LLMMessage[] = [];

  if (options.includeSystem !== false) {
    messages.push({
      role: 'system',
      content: options.systemPrompt || 'You are a helpful assistant.',
    });
  }

  if (options.includeImages) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: options.userMessage || 'What is in this image?' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...' } },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: options.userMessage || 'Hello, how are you?',
    });
  }

  if (options.includeTools) {
    messages.push({
      role: 'assistant',
      tool_calls: [
        {
          id: 'call_test123',
          type: 'function',
          function: {
            name: 'test_tool',
            arguments: JSON.stringify({ arg1: 'value1' }),
          },
        },
      ],
    });
    messages.push({
      role: 'tool',
      tool_call_id: 'call_test123',
      content: 'Tool result: success',
    });
  }

  return messages;
}

/**
 * Creates a tool call message
 */
export function createToolCallMessage(toolName: string, args: any): LLMMessage {
  return {
    role: 'assistant',
    tool_calls: [
      {
        id: `call_${Date.now()}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(args),
        },
      },
    ],
  };
}

/**
 * Creates a tool result message
 */
export function createToolResultMessage(callId: string, result: string): LLMMessage {
  return {
    role: 'tool',
    tool_call_id: callId,
    content: result,
  };
}

// ============ ASSERTION HELPERS ============

/**
 * Asserts that an LLM response matches expected values
 */
export function assertLLMResponse(response: LLMResponse, expected: Partial<LLMResponse>): void {
  if (expected.text !== undefined) {
    assert.strictEqual(response.text, expected.text, 'Response text mismatch');
  }

  if (expected.functionCall !== undefined) {
    assert.isDefined(response.functionCall, 'Expected functionCall but got none');
    assert.strictEqual(response.functionCall!.name, expected.functionCall.name, 'Function name mismatch');
    assert.deepEqual(response.functionCall!.arguments, expected.functionCall.arguments, 'Function arguments mismatch');
  }

  if (expected.rawResponse !== undefined) {
    assert.isDefined(response.rawResponse, 'Expected rawResponse but got none');
  }
}

/**
 * Asserts that an error is of the expected LLM error type
 */
export function assertErrorType(error: Error, expectedType: LLMErrorType): void {
  const { LLMErrorClassifier } = require('../LLMErrorHandler.js');
  const actualType = LLMErrorClassifier.classifyError(error);
  assert.strictEqual(actualType, expectedType, `Expected error type ${expectedType} but got ${actualType}`);
}

/**
 * Asserts that an error is retryable
 */
export function assertRetryable(error: Error): void {
  const { LLMErrorClassifier } = require('../LLMErrorHandler.js');
  const errorType = LLMErrorClassifier.classifyError(error);
  const shouldRetry = LLMErrorClassifier.shouldRetry(errorType);
  assert.isTrue(shouldRetry, `Expected error to be retryable but ${errorType} is not retryable`);
}

/**
 * Asserts that an error is NOT retryable
 */
export function assertNotRetryable(error: Error): void {
  const { LLMErrorClassifier } = require('../LLMErrorHandler.js');
  const errorType = LLMErrorClassifier.classifyError(error);
  const shouldRetry = LLMErrorClassifier.shouldRetry(errorType);
  assert.isFalse(shouldRetry, `Expected error to NOT be retryable but ${errorType} is retryable`);
}

// ============ MOCK PROVIDER FACTORY ============

/**
 * Creates a mock LLM provider for testing with sinon stubs
 */
export function createMockProvider(config: {
  name: string;
  models?: Array<{ id: string; name: string }>;
  response?: LLMResponse;
  callResponse?: LLMResponse; // Alias for response
  callError?: Error;
}): any {
  const mockResponse = config.response || config.callResponse || { text: 'Mock response', rawResponse: {} };

  // Create stub functions
  const callWithMessagesStub = sinon.stub();
  if (config.callError) {
    callWithMessagesStub.rejects(config.callError);
  } else {
    callWithMessagesStub.resolves(mockResponse);
  }

  const callStub = sinon.stub();
  if (config.callError) {
    callStub.rejects(config.callError);
  } else {
    callStub.resolves(mockResponse);
  }

  const getModelsStub = sinon.stub().resolves(
    (config.models || [{ id: 'mock-model', name: 'Mock Model' }]).map(m => ({
      ...m,
      provider: config.name,
      capabilities: { functionCalling: true, reasoning: false, vision: false, structured: true },
    }))
  );

  const fetchModelsStub = sinon.stub().resolves(
    config.models || [{ id: 'mock-model', name: 'Mock Model' }]
  );

  return {
    name: config.name,

    callWithMessages: callWithMessagesStub,
    call: callStub,
    getModels: getModelsStub,
    fetchModels: fetchModelsStub,

    validateCredentials: sinon.stub().returns({ isValid: true, message: 'Mock credentials valid' }),

    getCredentialStorageKeys: sinon.stub().returns({ apiKey: `ai_chat_${config.name}_api_key` }),

    parseResponse: sinon.stub().callsFake((response: LLMResponse) => {
      if (response.functionCall) {
        return { type: 'tool_call', name: response.functionCall.name, args: response.functionCall.arguments };
      }
      return { type: 'final_answer', answer: response.text || '' };
    }),

    testConnection: sinon.stub().resolves({ success: true, message: 'Connection successful' }),
  };
}

// ============ RETRY CONFIG HELPERS ============

/**
 * Default retry config values (from LLMErrorHandler.ts)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterMs: 500,
};

/**
 * Rate limit retry config (60 seconds base delay!)
 */
export const RATE_LIMIT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 60000, // 60 seconds!
  maxDelayMs: 300000, // 5 minutes max
  backoffMultiplier: 1, // No exponential backoff for rate limits
  jitterMs: 5000,
};

/**
 * Network error retry config
 */
export const NETWORK_ERROR_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 1000,
};

/**
 * Creates a fast retry config for testing (short delays)
 */
export function createFastRetryConfig(maxRetries: number = 2): RetryConfig {
  return {
    maxRetries,
    baseDelayMs: 10, // Very short for tests
    maxDelayMs: 50,
    backoffMultiplier: 2,
    jitterMs: 5,
  };
}

// ============ TOOL DEFINITION HELPERS ============

/**
 * Creates a mock tool definition in OpenAI format
 */
export function createMockToolDefinition(name: string, description: string, parameters?: any): any {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: parameters || {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' },
        },
        required: ['input'],
      },
    },
  };
}
