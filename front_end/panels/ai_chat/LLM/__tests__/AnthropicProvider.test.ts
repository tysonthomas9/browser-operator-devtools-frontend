// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AnthropicProvider } from '../AnthropicProvider.js';
import type { LLMMessage } from '../LLMTypes.js';
// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');
import {
  createMockAnthropicResponse,
  createMock401Response,
  createMock429Response,
  createMock500Response,
  createLocalStorageMock,
  createFastRetryConfig,
  createTestMessages,
  createMockToolDefinition,
  STORAGE_KEYS,
} from './LLMTestHelpers.js';

describe('ai_chat: AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let fetchStub: sinon.SinonStub;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  const TEST_API_KEY = 'sk-ant-test-api-key-12345';
  const MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const MODELS_ENDPOINT = 'https://api.anthropic.com/v1/models';

  beforeEach(() => {
    provider = new AnthropicProvider(TEST_API_KEY);
    localStorageMock = createLocalStorageMock({
      [STORAGE_KEYS.ANTHROPIC_API_KEY]: TEST_API_KEY,
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
      assert.strictEqual(provider.name, 'anthropic');
    });
  });

  // ============ callWithMessages Tests ============
  describe('callWithMessages', () => {
    it('should make POST request to correct endpoint', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      assert.isTrue(fetchStub.calledOnce);
      const [url, options] = fetchStub.firstCall.args;
      assert.strictEqual(url, MESSAGES_ENDPOINT);
      assert.strictEqual(options.method, 'POST');
    });

    it('should include x-api-key header (NOT Authorization)', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      assert.strictEqual(options.headers['x-api-key'], TEST_API_KEY);
      assert.isUndefined(options.headers.Authorization, 'Should use x-api-key, not Authorization');
    });

    it('should include anthropic-version header', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      assert.strictEqual(options.headers['anthropic-version'], '2023-06-01');
    });

    it('should include anthropic-dangerous-direct-browser-access header', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      assert.strictEqual(options.headers['anthropic-dangerous-direct-browser-access'], 'true');
    });

    it('should use "messages" array in request body', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.isDefined(body.messages, 'Should use "messages" array for Anthropic');
      assert.isArray(body.messages);
    });

    it('should include max_tokens (required parameter)', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.strictEqual(body.max_tokens, 4096, 'Should include max_tokens');
    });

    it('should extract system prompt to separate parameter', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      await provider.callWithMessages('claude-sonnet-4-20250514', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      // System should be a separate parameter
      assert.strictEqual(body.system, 'You are a helpful assistant.');

      // Messages array should NOT contain system message
      const systemInMessages = body.messages.find((m: any) => m.role === 'system');
      assert.isUndefined(systemInMessages, 'System message should not be in messages array');
    });

    it('should handle text response correctly', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'The answer is 42.' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      assert.strictEqual(result.text, 'The answer is 42.');
    });

    it('should handle tool_use response correctly', async () => {
      const mockResponse = createMockAnthropicResponse({
        functionCall: { name: 'click_element', arguments: { selector: '#btn' } },
      });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages());

      assert.isDefined(result.functionCall);
      assert.strictEqual(result.functionCall!.name, 'click_element');
      assert.deepEqual(result.functionCall!.arguments, { selector: '#btn' });
    });

    it('should convert tools to Anthropic format (input_schema)', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Done' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const tools = [createMockToolDefinition('click', 'Click an element')];
      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages(), { tools });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      assert.isDefined(body.tools);
      assert.isArray(body.tools);
      // Anthropic uses input_schema instead of parameters
      assert.isDefined(body.tools[0].input_schema);
      assert.isDefined(body.tools[0].name);
      assert.isDefined(body.tools[0].description);
    });

    it('should include temperature when provided', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages(), { temperature: 0.7 });

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);
      assert.strictEqual(body.temperature, 0.7);
    });

    it('should add anthropic-beta header for reasoning', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('claude-sonnet-4.5-20250514', createTestMessages(), {
        reasoningLevel: 'high',
      });

      const options = fetchStub.firstCall.args[1];
      assert.include(options.headers['anthropic-beta'], 'interleaved-thinking');
    });

    it('should convert assistant tool_calls to tool_use blocks', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Done' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Click the button' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'toolu_123',
              type: 'function',
              function: { name: 'click', arguments: '{"selector":"#btn"}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'toolu_123',
          content: 'Clicked successfully',
        },
      ];

      await provider.callWithMessages('claude-sonnet-4-20250514', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      // Assistant message should have tool_use block in content
      const assistantMsg = body.messages.find((m: any) => m.role === 'assistant');
      assert.isDefined(assistantMsg);
      assert.isArray(assistantMsg.content);
      assert.strictEqual(assistantMsg.content[0].type, 'tool_use');
      assert.strictEqual(assistantMsg.content[0].id, 'toolu_123');
      assert.strictEqual(assistantMsg.content[0].name, 'click');
    });

    it('should convert tool results to user message with tool_result type', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Done' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        { role: 'user', content: 'Click the button' },
        {
          role: 'assistant',
          tool_calls: [
            {
              id: 'toolu_123',
              type: 'function',
              function: { name: 'click', arguments: '{}' },
            },
          ],
        },
        {
          role: 'tool',
          tool_call_id: 'toolu_123',
          content: 'Clicked successfully',
        },
      ];

      await provider.callWithMessages('claude-sonnet-4-20250514', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      // Tool result should be a user message with tool_result content
      const toolResultMsg = body.messages.find((m: any) =>
        m.role === 'user' && m.content?.[0]?.type === 'tool_result'
      );
      assert.isDefined(toolResultMsg, 'Should have tool_result in user message');
      assert.strictEqual(toolResultMsg.content[0].tool_use_id, 'toolu_123');
      assert.strictEqual(toolResultMsg.content[0].content, 'Clicked successfully');
    });

    it('should handle base64 image content', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'I see an image' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' } },
          ],
        },
      ];

      await provider.callWithMessages('claude-sonnet-4-20250514', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      const userMsg = body.messages.find((m: any) => m.role === 'user');
      assert.isDefined(userMsg);

      // Should have image with source.type = 'base64'
      const imageContent = userMsg.content.find((c: any) => c.type === 'image');
      assert.isDefined(imageContent);
      assert.strictEqual(imageContent.source.type, 'base64');
      assert.strictEqual(imageContent.source.media_type, 'image/png');
    });

    it('should handle URL image content', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'I see an image' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
          ],
        },
      ];

      await provider.callWithMessages('claude-sonnet-4-20250514', messages);

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      const userMsg = body.messages.find((m: any) => m.role === 'user');
      const imageContent = userMsg.content.find((c: any) => c.type === 'image');
      assert.isDefined(imageContent);
      assert.strictEqual(imageContent.source.type, 'url');
      assert.strictEqual(imageContent.source.url, 'https://example.com/image.png');
    });
  });

  // ============ call Tests ============
  describe('call', () => {
    it('should build messages from prompt and systemPrompt', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Hello' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.call('claude-sonnet-4-20250514', 'User prompt', 'System prompt');

      const options = fetchStub.firstCall.args[1];
      const body = JSON.parse(options.body);

      assert.strictEqual(body.system, 'System prompt');
      const userMsg = body.messages.find((m: any) => m.role === 'user');
      assert.isDefined(userMsg);
    });
  });

  // ============ getModels / fetchModels Tests ============
  describe('getModels', () => {
    it('should fetch models from API', async () => {
      const modelsResponse = {
        data: [
          { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', type: 'model' },
          { id: 'claude-opus-4-20250514', display_name: 'Claude Opus 4', type: 'model' },
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
          { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', type: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();

      if (models.length > 0) {
        const model = models[0];
        assert.isDefined(model.id);
        assert.isDefined(model.name);
        assert.strictEqual(model.provider, 'anthropic');
        assert.isDefined(model.capabilities);
      }
    });

    it('should fallback to defaults on API error', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Network error'));

      const models = await provider.getModels();

      assert.isArray(models);
      assert.isTrue(models.length > 0);
    });
  });

  describe('fetchModels', () => {
    it('should make GET request to models endpoint', async () => {
      const modelsResponse = {
        data: [{ id: 'claude-sonnet-4', display_name: 'Claude Sonnet 4', type: 'model' }],
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

    it('should include proper headers in models request', async () => {
      const modelsResponse = {
        data: [{ id: 'claude-sonnet-4', display_name: 'Claude Sonnet 4', type: 'model' }],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      await provider.fetchModels();

      const options = fetchStub.firstCall.args[1];
      assert.strictEqual(options.headers['x-api-key'], TEST_API_KEY);
      assert.strictEqual(options.headers['anthropic-version'], '2023-06-01');
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
      localStorageMock = createLocalStorageMock({});

      const newProvider = new AnthropicProvider('');
      const result = newProvider.validateCredentials();

      assert.isFalse(result.isValid);
      assert.isDefined(result.missingItems);
      assert.include(result.missingItems!, 'API Key');
    });
  });

  // ============ getCredentialStorageKeys Tests ============
  describe('getCredentialStorageKeys', () => {
    it('should return correct storage keys', () => {
      const keys = provider.getCredentialStorageKeys();
      assert.strictEqual(keys.apiKey, 'ai_chat_anthropic_api_key');
    });
  });

  // ============ testConnection Tests ============
  describe('testConnection', () => {
    it('should return success on valid response', async () => {
      const mockResponse = createMockAnthropicResponse({ text: 'Connection successful!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await provider.testConnection('claude-sonnet-4-20250514');

      assert.isTrue(result.success);
      assert.include(result.message, 'Successfully connected');
    });

    it('should return failure on error', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Connection failed'));

      const result = await provider.testConnection('claude-sonnet-4-20250514');

      assert.isFalse(result.success);
      assert.include(result.message, 'Connection failed');
    });
  });

  // ============ Error Scenarios ============
  describe('error scenarios', () => {
    it('should handle 401 Unauthorized', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock401Response('anthropic')
      );

      try {
        await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'Anthropic API error');
      }
    });

    it('should handle 429 Rate Limit', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock429Response('anthropic')
      );

      try {
        await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message.toLowerCase(), 'rate limit');
      }
    });

    it('should handle 500 Internal Server Error', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        createMock500Response('anthropic')
      );

      try {
        await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages(), {
          retryConfig: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, jitterMs: 0 },
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message.toLowerCase(), 'server');
      }
    });

    it('should retry on transient errors', async () => {
      let callCount = 0;
      fetchStub = sinon.stub(globalThis, 'fetch').callsFake(async () => {
        callCount++;
        if (callCount < 3) {
          return createMock500Response('anthropic');
        }
        return new Response(JSON.stringify(createMockAnthropicResponse({ text: 'Success' })), { status: 200 });
      });

      const result = await provider.callWithMessages('claude-sonnet-4-20250514', createTestMessages(), {
        retryConfig: createFastRetryConfig(3),
      });

      assert.strictEqual(result.text, 'Success');
      assert.strictEqual(callCount, 3);
    });
  });

  // ============ Model Capability Detection ============
  describe('Model Capability Detection', () => {
    it('should detect function calling support for Claude 3+ models', async () => {
      const modelsResponse = {
        data: [
          { id: 'claude-3-sonnet-20240229', display_name: 'Claude 3 Sonnet', type: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();
      const model = models.find(m => m.id.includes('claude-3'));

      if (model) {
        assert.isTrue(model.capabilities?.functionCalling);
      }
    });

    it('should detect reasoning support for Claude Sonnet 4.5', async () => {
      const modelsResponse = {
        data: [
          { id: 'claude-sonnet-4.5-20250514', display_name: 'Claude Sonnet 4.5', type: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();
      const model = models.find(m => m.id.includes('4.5'));

      if (model) {
        assert.isTrue(model.capabilities?.reasoning);
      }
    });

    it('should detect vision support for Claude 3+ models (except Haiku)', async () => {
      const modelsResponse = {
        data: [
          { id: 'claude-3-opus-20240229', display_name: 'Claude 3 Opus', type: 'model' },
          { id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku', type: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();
      const opus = models.find(m => m.id.includes('opus'));
      const haiku = models.find(m => m.id.includes('haiku'));

      if (opus) {
        assert.isTrue(opus.capabilities?.vision);
      }
      if (haiku) {
        assert.isFalse(haiku.capabilities?.vision);
      }
    });
  });
});
