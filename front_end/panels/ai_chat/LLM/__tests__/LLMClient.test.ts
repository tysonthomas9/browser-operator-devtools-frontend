// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMClient } from '../LLMClient.js';
import { LLMProviderRegistry } from '../LLMProviderRegistry.js';
import type { LLMProvider } from '../LLMTypes.js';
// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');
import {
  createMockProvider,
  createLocalStorageMock,
  createMockOpenAIResponse,
  createMockAnthropicResponse,
  STORAGE_KEYS,
} from './LLMTestHelpers.js';

describe('ai_chat: LLMClient', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let fetchStub: sinon.SinonStub;

  // Helper to reset singleton between tests
  function resetLLMClient(): void {
    // Access private static instance to reset
    (LLMClient as any).instance = null;
  }

  beforeEach(() => {
    resetLLMClient();
    LLMProviderRegistry.clear();
    localStorageMock = createLocalStorageMock({
      [STORAGE_KEYS.OPENAI_API_KEY]: 'sk-test-key',
      [STORAGE_KEYS.ANTHROPIC_API_KEY]: 'sk-ant-test-key',
      [STORAGE_KEYS.LITELLM_ENDPOINT]: 'http://localhost:4000',
      [STORAGE_KEYS.LITELLM_API_KEY]: 'test-litellm-key',
    });
  });

  afterEach(() => {
    resetLLMClient();
    LLMProviderRegistry.clear();
    localStorageMock.restore();
    if (fetchStub) {
      fetchStub.restore();
    }
    sinon.restore();
  });

  // ============ Singleton Tests ============
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = LLMClient.getInstance();
      const instance2 = LLMClient.getInstance();

      assert.strictEqual(instance1, instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = LLMClient.getInstance();
      resetLLMClient();
      const instance2 = LLMClient.getInstance();

      assert.notStrictEqual(instance1, instance2);
    });
  });

  // ============ Initialization Tests ============
  describe('initialize', () => {
    it('should initialize with OpenAI provider', async () => {
      // Mock fetch for provider initialization
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      const client = LLMClient.getInstance();
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'sk-test-key' }
        ]
      });

      assert.isTrue(LLMProviderRegistry.hasProvider('openai'));
    });

    it('should initialize with multiple providers', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      const client = LLMClient.getInstance();
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'sk-test-key' },
          { provider: 'anthropic', apiKey: 'sk-ant-test-key' },
          { provider: 'groq', apiKey: 'gsk-test-key' },
        ]
      });

      assert.isTrue(LLMProviderRegistry.hasProvider('openai'));
      assert.isTrue(LLMProviderRegistry.hasProvider('anthropic'));
      assert.isTrue(LLMProviderRegistry.hasProvider('groq'));
    });

    it('should initialize LiteLLM provider with endpoint', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      const client = LLMClient.getInstance();
      await client.initialize({
        providers: [
          { provider: 'litellm', apiKey: 'test-key', providerURL: 'http://localhost:4000' }
        ]
      });

      assert.isTrue(LLMProviderRegistry.hasProvider('litellm'));
    });

    it('should clear existing providers on re-initialization', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      const client = LLMClient.getInstance();

      // First initialization
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'sk-test-key' },
          { provider: 'anthropic', apiKey: 'sk-ant-test-key' }
        ]
      });

      assert.isTrue(LLMProviderRegistry.hasProvider('anthropic'));

      // Second initialization without Anthropic
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'sk-test-key' }
        ]
      });

      assert.isTrue(LLMProviderRegistry.hasProvider('openai'));
      assert.isFalse(LLMProviderRegistry.hasProvider('anthropic'));
    });

    it('should skip unknown provider types', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      const client = LLMClient.getInstance();
      await client.initialize({
        providers: [
          { provider: 'unknown_provider' as any, apiKey: 'test-key' }
        ]
      });

      // Should not throw and should have no providers
      const stats = client.getStats();
      assert.strictEqual(stats.providersCount, 0);
    });
  });

  // ============ Call Method Tests ============
  describe('call', () => {
    it('should throw error when not initialized', async () => {
      const client = LLMClient.getInstance();

      try {
        await client.call({
          provider: 'openai',
          model: 'gpt-4.1',
          messages: [{ role: 'user', content: 'Hello' }],
          systemPrompt: 'You are a helpful assistant.'
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'must be initialized');
      }
    });

    it('should throw error for unavailable provider', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );

      const client = LLMClient.getInstance();
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'sk-test-key' }
        ]
      });

      try {
        await client.call({
          provider: 'anthropic' as LLMProvider,
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: 'Hello' }],
          systemPrompt: 'You are a helpful assistant.'
        });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'not available');
      }
    });

    it('should make call with registered provider', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        response: {
          text: 'Hello! How can I help you?',
          rawResponse: {}
        }
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      // Mark as initialized
      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const response = await client.call({
        provider: 'openai',
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are a helpful assistant.'
      });

      assert.strictEqual(response.text, 'Hello! How can I help you?');
      assert.isTrue(mockProvider.callWithMessages.calledOnce);
    });

    it('should prepend system prompt when not present', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        response: {
          text: 'Response',
          rawResponse: {}
        }
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are a helpful assistant.'
      });

      // Check that system prompt was added
      const callArgs = mockProvider.callWithMessages.firstCall.args;
      const messages = callArgs[1];
      assert.strictEqual(messages[0].role, 'system');
      assert.strictEqual(messages[0].content, 'You are a helpful assistant.');
    });

    it('should not duplicate system prompt when already present', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        response: {
          text: 'Response',
          rawResponse: {}
        }
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'Existing system prompt' },
          { role: 'user', content: 'Hello' }
        ],
        systemPrompt: 'New system prompt'
      });

      // Check that existing system prompt is preserved
      const callArgs = mockProvider.callWithMessages.firstCall.args;
      const messages = callArgs[1];
      assert.strictEqual(messages[0].content, 'Existing system prompt');
      // Should have only 2 messages, not 3
      assert.strictEqual(messages.length, 2);
    });

    it('should pass tools in options', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        response: {
          text: '',
          functionCall: { name: 'test_tool', arguments: {} },
          rawResponse: {}
        }
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const tools = [{
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} }
      }];

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Use the test tool' }],
        systemPrompt: 'You are a helpful assistant.',
        tools
      });

      const callArgs = mockProvider.callWithMessages.firstCall.args;
      const options = callArgs[2];
      assert.deepEqual(options.tools, tools);
    });

    it('should pass temperature in options', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        response: {
          text: 'Response',
          rawResponse: {}
        }
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are a helpful assistant.',
        temperature: 0.7
      });

      const callArgs = mockProvider.callWithMessages.firstCall.args;
      const options = callArgs[2];
      assert.strictEqual(options.temperature, 0.7);
    });
  });

  // ============ getAvailableModels Tests ============
  describe('getAvailableModels', () => {
    it('should throw when not initialized', async () => {
      const client = LLMClient.getInstance();

      try {
        await client.getAvailableModels();
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'must be initialized');
      }
    });

    it('should return models from all providers', async () => {
      const openaiProvider = createMockProvider({
        name: 'openai',
        models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }]
      });
      const anthropicProvider = createMockProvider({
        name: 'anthropic',
        models: [{ id: 'claude-sonnet-4', name: 'Claude Sonnet 4' }]
      });

      LLMProviderRegistry.registerProvider('openai', openaiProvider);
      LLMProviderRegistry.registerProvider('anthropic', anthropicProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const models = await client.getAvailableModels();

      assert.strictEqual(models.length, 2);
      const modelIds = models.map(m => m.id);
      assert.include(modelIds, 'gpt-4.1');
      assert.include(modelIds, 'claude-sonnet-4');
    });
  });

  // ============ getModelsByProvider Tests ============
  describe('getModelsByProvider', () => {
    it('should return models for specific provider', async () => {
      const openaiProvider = createMockProvider({
        name: 'openai',
        models: [
          { id: 'gpt-4.1', name: 'GPT-4.1' },
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' }
        ]
      });

      LLMProviderRegistry.registerProvider('openai', openaiProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const models = await client.getModelsByProvider('openai');

      assert.strictEqual(models.length, 2);
    });
  });

  // ============ testConnection Tests ============
  describe('testConnection', () => {
    it('should return failure for unavailable provider', async () => {
      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const result = await client.testConnection('openai', 'gpt-4.1');

      assert.isFalse(result.success);
      assert.include(result.message, 'not available');
    });

    it('should use provider testConnection if available', async () => {
      const mockProvider = createMockProvider({ name: 'openai' });
      mockProvider.testConnection = sinon.stub().resolves({
        success: true,
        message: 'Connection successful'
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const result = await client.testConnection('openai', 'gpt-4.1');

      assert.isTrue(result.success);
      assert.isTrue(mockProvider.testConnection.calledWith('gpt-4.1'));
    });

    it('should fallback to test call when provider has no testConnection', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        response: {
          text: 'OK',
          rawResponse: {}
        }
      });
      // Remove testConnection
      delete mockProvider.testConnection;

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const result = await client.testConnection('openai', 'gpt-4.1');

      assert.isTrue(result.success);
      assert.include(result.message, 'Connected successfully');
    });

    it('should return failure on test call error', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        callError: new Error('Connection failed')
      });
      delete mockProvider.testConnection;

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      const result = await client.testConnection('openai', 'gpt-4.1');

      assert.isFalse(result.success);
      assert.include(result.message, 'Connection failed');
    });
  });

  // ============ refreshProviderModels Tests ============
  describe('refreshProviderModels', () => {
    it('should refresh models for specific provider', async () => {
      const mockProvider = createMockProvider({
        name: 'openai',
        models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }]
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      await client.refreshProviderModels('openai');

      assert.isTrue(mockProvider.getModels.called);
    });

    it('should refresh all providers when no provider specified', async () => {
      const openaiProvider = createMockProvider({ name: 'openai', models: [] });
      const anthropicProvider = createMockProvider({ name: 'anthropic', models: [] });

      LLMProviderRegistry.registerProvider('openai', openaiProvider);
      LLMProviderRegistry.registerProvider('anthropic', anthropicProvider);

      const client = LLMClient.getInstance();
      (client as any).initialized = true;

      await client.refreshProviderModels();

      assert.isTrue(openaiProvider.getModels.called);
      assert.isTrue(anthropicProvider.getModels.called);
    });
  });

  // ============ registerCustomModel Tests ============
  describe('registerCustomModel', () => {
    it('should save custom model to localStorage', () => {
      const client = LLMClient.getInstance();

      const modelInfo = client.registerCustomModel('my-custom-model', 'My Custom Model');

      assert.strictEqual(modelInfo.id, 'my-custom-model');
      assert.strictEqual(modelInfo.name, 'My Custom Model');
      assert.strictEqual(modelInfo.provider, 'litellm');

      const stored = JSON.parse(localStorageMock.store.get('ai_chat_custom_models') || '[]');
      assert.strictEqual(stored.length, 1);
      assert.strictEqual(stored[0].id, 'my-custom-model');
    });

    it('should use model ID as name when name not provided', () => {
      const client = LLMClient.getInstance();

      const modelInfo = client.registerCustomModel('my-custom-model');

      assert.strictEqual(modelInfo.name, 'my-custom-model');
    });

    it('should append to existing custom models', () => {
      localStorageMock.store.set('ai_chat_custom_models', JSON.stringify([
        { id: 'existing-model', name: 'Existing', provider: 'litellm' }
      ]));

      const client = LLMClient.getInstance();
      client.registerCustomModel('new-model', 'New Model');

      const stored = JSON.parse(localStorageMock.store.get('ai_chat_custom_models') || '[]');
      assert.strictEqual(stored.length, 2);
    });
  });

  // ============ getStats Tests ============
  describe('getStats', () => {
    it('should return initialized status and provider count', async () => {
      const client = LLMClient.getInstance();

      // Before initialization
      let stats = client.getStats();
      assert.isFalse(stats.initialized);
      assert.strictEqual(stats.providersCount, 0);

      // After initialization
      LLMProviderRegistry.registerProvider('openai', createMockProvider({ name: 'openai' }));
      (client as any).initialized = true;

      stats = client.getStats();
      assert.isTrue(stats.initialized);
      assert.strictEqual(stats.providersCount, 1);
    });
  });

  // ============ Static Method Tests ============
  describe('static methods', () => {
    describe('fetchLiteLLMModels', () => {
      it('should delegate to LLMProviderRegistry', async () => {
        const modelsResponse = { data: [{ id: 'model-1' }] };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const models = await LLMClient.fetchLiteLLMModels('test-key', 'http://localhost:4000');

        assert.isArray(models);
      });
    });

    describe('testLiteLLMConnection', () => {
      it('should delegate to LLMProviderRegistry', async () => {
        const modelsResponse = { data: [{ id: 'model-1' }] };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const result = await LLMClient.testLiteLLMConnection('test-key', 'model-1', 'http://localhost:4000');

        assert.isDefined(result.success);
        assert.isDefined(result.message);
      });
    });

    describe('testBrowserOperatorConnection', () => {
      it('should check health endpoint', async () => {
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
        );

        const result = await LLMClient.testBrowserOperatorConnection('http://localhost:3000/v1');

        assert.isTrue(result.success);
        assert.include(result.message, 'Connected to BrowserOperator');
        assert.isTrue(fetchStub.calledWith('http://localhost:3000/health'));
      });

      it('should handle health check failure', async () => {
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response('', { status: 500, statusText: 'Internal Server Error' })
        );

        const result = await LLMClient.testBrowserOperatorConnection('http://localhost:3000/v1');

        assert.isFalse(result.success);
        assert.include(result.message, 'Health check failed');
      });

      it('should handle network error', async () => {
        fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Connection refused'));

        const result = await LLMClient.testBrowserOperatorConnection('http://localhost:3000/v1');

        assert.isFalse(result.success);
        assert.include(result.message, 'Connection refused');
      });
    });

    describe('validateProviderCredentials', () => {
      it('should validate standard provider credentials', () => {
        const result = LLMClient.validateProviderCredentials('openai');

        assert.isTrue(result.isValid);
      });

      it('should fail validation for missing credentials', () => {
        localStorageMock.restore();
        localStorageMock = createLocalStorageMock({});

        const result = LLMClient.validateProviderCredentials('openai');

        assert.isFalse(result.isValid);
        assert.isDefined(result.missingItems);
      });
    });

    describe('getProviderCredentials', () => {
      it('should return credentials for standard provider', () => {
        const result = LLMClient.getProviderCredentials('openai');

        assert.isTrue(result.canProceed);
        assert.strictEqual(result.apiKey, 'sk-test-key');
      });

      it('should return canProceed false for missing credentials', () => {
        localStorageMock.restore();
        localStorageMock = createLocalStorageMock({});

        const result = LLMClient.getProviderCredentials('openai');

        assert.isFalse(result.canProceed);
        assert.isNull(result.apiKey);
      });
    });
  });

  // ============ parseResponse Tests ============
  describe('parseResponse', () => {
    it('should delegate to LLMResponseParser', () => {
      const client = LLMClient.getInstance();

      const response = {
        text: '{"type": "final_answer", "result": "Hello"}',
        rawResponse: {}
      };

      const parsed = client.parseResponse(response);

      assert.isDefined(parsed);
    });
  });
});
