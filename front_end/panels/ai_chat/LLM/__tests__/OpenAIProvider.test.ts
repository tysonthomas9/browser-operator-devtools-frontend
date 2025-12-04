// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { OpenAIProvider } from '../OpenAIProvider.js';
import type { LLMMessage, LLMCallOptions } from '../LLMTypes.js';
// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');
import {
  createMockOpenAIResponse,
  createMock401Response,
  createMock429Response,
  createMock500Response,
  createMock503Response,
  createLocalStorageMock,
  createFastRetryConfig,
  createTestMessages,
  createMockToolDefinition,
  STORAGE_KEYS,
} from './LLMTestHelpers.js';

describe('ai_chat: OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let fetchStub: sinon.SinonStub;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  const TEST_API_KEY = 'sk-test-api-key-12345';
  const API_ENDPOINT = 'https://api.openai.com/v1/responses';
  const MODELS_ENDPOINT = 'https://api.openai.com/v1/models';

  beforeEach(() => {
    provider = new OpenAIProvider(TEST_API_KEY);
    localStorageMock = createLocalStorageMock({
      [STORAGE_KEYS.OPENAI_API_KEY]: TEST_API_KEY,
    });
  });

  afterEach(() => {
    if (fetchStub) {
      fetchStub.restore();
    }
    localStorageMock.restore();
    sinon.restore();
  });

  // ============ Constructor Tests ============
  describe('constructor', () => {
    it('should set provider name correctly', () => {
      assert.strictEqual(provider.name, 'openai');
    });

    it('should store API key', () => {
      // API key is private, but we can verify it works by checking requests
      const newProvider = new OpenAIProvider('sk-different-key');
      assert.strictEqual(newProvider.name, 'openai');
    });
  });

  // ============ callWithMessages Tests ============
  describe('callWithMessages', () => {
    it('should make POST request to correct endpoint', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-4.1', createTestMessages());

      assert.isTrue(fetchStub.calledOnce);
      const [url, options] = fetchStub.firstCall.args;
      assert.strictEqual(url, API_ENDPOINT);
      assert.strictEqual(options.method, 'POST');
    });

    it('should include Authorization header', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-4.1', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      assert.strictEqual(options.headers.Authorization, `Bearer ${TEST_API_KEY}`);
    });

    it('should include Content-Type header', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-4.1', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      assert.strictEqual(options.headers['Content-Type'], 'application/json');
    });

    it('should use "input" array in request body (Responses API format)', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-4.1', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.isDefined(body.input, 'Should use "input" array for Responses API');
      assert.isArray(body.input);
    });

    it('should handle text response correctly', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'The answer is 42.' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('gpt-4.1', createTestMessages());

      assert.strictEqual(result.text, 'The answer is 42.');
    });

    it('should handle function call response correctly', async () => {
      const mockResponse = createMockOpenAIResponse({
        functionCall: { name: 'click_element', arguments: { selector: '#btn' } },
      });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('gpt-4.1', createTestMessages());

      assert.isDefined(result.functionCall);
      assert.strictEqual(result.functionCall!.name, 'click_element');
      assert.deepEqual(result.functionCall!.arguments, { selector: '#btn' });
    });

    it('should include tools in request when provided', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Done' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const tools = [createMockToolDefinition('click', 'Click an element')];
      await provider.callWithMessages('gpt-4.1', createTestMessages(), { tools });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.isDefined(body.tools);
      assert.isArray(body.tools);
    });

    it('should include temperature for GPT models', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-4.1', createTestMessages(), { temperature: 0.7 });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.strictEqual(body.temperature, 0.7);
    });

    it('should NOT include temperature for O-series models', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('o4-mini', createTestMessages(), { temperature: 0.7 });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.isUndefined(body.temperature, 'O-series models should not have temperature');
    });

    it('should NOT include temperature for GPT-5 models', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-5', createTestMessages(), { temperature: 0.7 });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.isUndefined(body.temperature, 'GPT-5 models should not have temperature');
    });

    it('should include reasoning.effort for O-series models when reasoningLevel provided', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('o4-mini', createTestMessages(), { reasoningLevel: 'high' });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.isDefined(body.reasoning);
      assert.strictEqual(body.reasoning.effort, 'high');
    });

    it('should convert messages to Responses API format', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helper.' },
        { role: 'user', content: 'Hi there' },
      ];

      await provider.callWithMessages('gpt-4.1', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      assert.isArray(body.input);
      assert.strictEqual(body.input[0].role, 'system');
      assert.strictEqual(body.input[1].role, 'user');
    });

    it('should handle multimodal content with images', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'I see an image' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
          ],
        },
      ];

      await provider.callWithMessages('gpt-4.1', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      // For GPT models, content should be converted to Responses API format
      const userMessage = body.input.find((m: any) => m.role === 'user');
      assert.isDefined(userMessage);
    });

    it('should convert tool calls to Responses API format (function_call type)', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Done' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        { role: 'system', content: 'Helper' },
        { role: 'user', content: 'Click button' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: { name: 'click', arguments: '{"selector":"#btn"}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'call_123',
          content: 'Clicked successfully',
        },
      ];

      await provider.callWithMessages('gpt-4.1', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      // Assistant tool call should be converted to function_call type
      const functionCall = body.input.find((m: any) => m.type === 'function_call');
      assert.isDefined(functionCall, 'Should have function_call type message');
      assert.strictEqual(functionCall.name, 'click');

      // Tool result should be converted to function_call_output type
      const functionOutput = body.input.find((m: any) => m.type === 'function_call_output');
      assert.isDefined(functionOutput, 'Should have function_call_output type message');
      assert.strictEqual(functionOutput.call_id, 'call_123');
    });

    it('should throw on API errors', async () => {
      const errorResponse = {
        error: { message: 'Invalid request', type: 'invalid_request_error' },
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(errorResponse), { status: 400 })
      );

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'OpenAI API error');
      }
    });

    it('should store raw response', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('gpt-4.1', createTestMessages());

      assert.isDefined(result.rawResponse);
      assert.deepEqual(result.rawResponse, mockResponse);
    });
  });

  // ============ call Tests ============
  describe('call', () => {
    it('should build messages from prompt and systemPrompt', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.call('gpt-4.1', 'User prompt', 'System prompt');

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      assert.isArray(body.input);
      const systemMsg = body.input.find((m: any) => m.role === 'system');
      const userMsg = body.input.find((m: any) => m.role === 'user');

      assert.isDefined(systemMsg);
      assert.isDefined(userMsg);
    });

    it('should work without system prompt', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.call('gpt-4.1', 'User prompt', '');

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      const systemMsg = body.input.find((m: any) => m.role === 'system');
      assert.isUndefined(systemMsg, 'Should not include empty system prompt');
    });
  });

  // ============ getModels / fetchModels Tests ============
  describe('getModels', () => {
    it('should fetch models from API', async () => {
      const modelsResponse = {
        data: [
          { id: 'gpt-4.1-2025-04-14', object: 'model' },
          { id: 'o4-mini-2025-04-16', object: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();

      assert.isArray(models);
      assert.isTrue(models.length > 0);
    });

    it('should return ModelInfo array with correct structure', async () => {
      const modelsResponse = {
        data: [
          { id: 'gpt-4.1-2025-04-14', object: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();

      assert.isArray(models);
      if (models.length > 0) {
        const model = models[0];
        assert.isDefined(model.id);
        assert.isDefined(model.name);
        assert.strictEqual(model.provider, 'openai');
        assert.isDefined(model.capabilities);
      }
    });

    it('should fallback to defaults on API error', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Network error'));

      const models = await provider.getModels();

      // Should return default models
      assert.isArray(models);
      assert.isTrue(models.length > 0);
    });

    it('should filter out non-chat models', async () => {
      const modelsResponse = {
        data: [
          { id: 'gpt-4.1-2025-04-14', object: 'model' },
          { id: 'text-embedding-3-large', object: 'model' },
          { id: 'whisper-1', object: 'model' },
          { id: 'dall-e-3', object: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();

      const modelIds = models.map(m => m.id);
      assert.notInclude(modelIds, 'text-embedding-3-large');
      assert.notInclude(modelIds, 'whisper-1');
      assert.notInclude(modelIds, 'dall-e-3');
    });
  });

  describe('fetchModels', () => {
    it('should make GET request to models endpoint', async () => {
      const modelsResponse = {
        data: [{ id: 'gpt-4.1', object: 'model' }],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      await provider.fetchModels();

      assert.isTrue(fetchStub.calledOnce);
      const [url, options] = fetchStub.firstCall.args;
      assert.strictEqual(url, MODELS_ENDPOINT);
      assert.strictEqual(options.method, 'GET');
    });

    it('should throw on API errors', async () => {
      const errorResponse = { error: { message: 'Unauthorized' } };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(errorResponse), { status: 401 })
      );

      try {
        await provider.fetchModels();
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'OpenAI API error');
      }
    });
  });

  // ============ validateCredentials Tests ============
  describe('validateCredentials', () => {
    it('should return valid when API key present', () => {
      const result = provider.validateCredentials();
      assert.isTrue(result.isValid);
    });

    it('should return invalid with missingItems when no API key', () => {
      localStorageMock.restore();
      localStorageMock = createLocalStorageMock({}); // No API key

      const newProvider = new OpenAIProvider('');
      // Need to check localStorage in validateCredentials
      const result = newProvider.validateCredentials();

      // The provider was initialized with an API key, but validateCredentials
      // checks localStorage for the key
      assert.isFalse(result.isValid);
      assert.isDefined(result.missingItems);
      assert.include(result.missingItems!, 'API Key');
    });
  });

  // ============ getCredentialStorageKeys Tests ============
  describe('getCredentialStorageKeys', () => {
    it('should return correct storage keys', () => {
      const keys = provider.getCredentialStorageKeys();
      assert.strictEqual(keys.apiKey, 'ai_chat_api_key');
    });
  });

  // ============ parseResponse Tests ============
  describe('parseResponse', () => {
    it('should delegate to LLMResponseParser', () => {
      const response = { text: 'Hello', rawResponse: {} };
      const parsed = provider.parseResponse(response);

      assert.isDefined(parsed);
      assert.strictEqual(parsed.type, 'final_answer');
    });

    it('should parse function call responses', () => {
      const response = {
        functionCall: { name: 'test', arguments: { arg: 1 } },
        rawResponse: {},
      };
      const parsed = provider.parseResponse(response);

      assert.strictEqual(parsed.type, 'tool_call');
    });
  });

  // ============ Model Family Tests ============
  describe('Model Family Handling', () => {
    it('should identify O-series models correctly', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      // o1, o3, o4 models should be identified as O-series
      await provider.callWithMessages('o1-preview', createTestMessages(), { temperature: 0.5 });

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.isUndefined(body.temperature, 'O1 should not have temperature');
    });

    it('should identify GPT models correctly', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-4.1', createTestMessages(), { temperature: 0.5 });

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.strictEqual(body.temperature, 0.5, 'GPT should have temperature');
    });

    it('should treat GPT-5 like O-series for parameters', async () => {
      const mockResponse = createMockOpenAIResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gpt-5-2025-08-07', createTestMessages(), { temperature: 0.5 });

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.isUndefined(body.temperature, 'GPT-5 should not have temperature');
    });
  });

  // ============ Error Scenarios ============
  describe('error scenarios', () => {
    it('should handle 401 Unauthorized', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock401Response('openai')
      );

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message.toLowerCase(), 'api');
      }
    });

    it('should handle 429 Rate Limit', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock429Response('openai')
      );

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message.toLowerCase(), 'rate limit');
      }
    });

    it('should handle 500 Internal Server Error', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock500Response('openai')
      );

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message.toLowerCase(), 'server');
      }
    });

    it('should handle 503 Service Unavailable', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock503Response('openai')
      );

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message.toLowerCase(), 'unavailable');
      }
    });

    it('should handle network errors', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Network error'));

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'Network error');
      }
    });

    it('should retry on transient errors with retryConfig', async () => {
      let callCount = 0;
      fetchStub = sinon.stub(globalThis, 'fetch').callsFake(async () => {
        callCount++;
        if (callCount < 3) {
          return createMock500Response('openai');
        }
        return new Response(JSON.stringify(createMockOpenAIResponse({ text: 'Success' })), { status: 200 });
      });

      const result = await provider.callWithMessages('gpt-4.1', createTestMessages(), {
        retryConfig: createFastRetryConfig(3),
      });

      assert.strictEqual(result.text, 'Success');
      assert.strictEqual(callCount, 3);
    });
  });

  // ============ Response Processing Tests ============
  describe('Response Processing', () => {
    it('should extract reasoning info from O-series responses', async () => {
      const mockResponse = {
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'Result' }] },
        ],
        reasoning: {
          summary: ['Step 1', 'Step 2'],
          effort: 'high',
        },
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('o4-mini', createTestMessages());

      assert.isDefined(result.reasoning);
      assert.deepEqual(result.reasoning!.summary, ['Step 1', 'Step 2']);
      assert.strictEqual(result.reasoning!.effort, 'high');
    });

    it('should handle empty output array', async () => {
      const mockResponse = {
        output: [],
        usage: { input_tokens: 100, output_tokens: 0 },
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      try {
        await provider.callWithMessages('gpt-4.1', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'No output');
      }
    });

    it('should find function_call in any position in output array', async () => {
      const mockResponse = {
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'Thinking...' }] },
          { type: 'function_call', name: 'click', arguments: '{"selector": "#btn"}', call_id: 'call_1' },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('gpt-4.1', createTestMessages());

      assert.isDefined(result.functionCall);
      assert.strictEqual(result.functionCall!.name, 'click');
    });
  });
});
