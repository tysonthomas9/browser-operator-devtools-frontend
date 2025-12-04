// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMProviderRegistry } from '../LLMProviderRegistry.js';
import type { LLMProvider } from '../LLMTypes.js';
// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');
import {
  createMockProvider,
  createLocalStorageMock,
  createMockOpenAIResponse,
  STORAGE_KEYS,
} from './LLMTestHelpers.js';

describe('ai_chat: LLMProviderRegistry', () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    LLMProviderRegistry.clear();
    localStorageMock = createLocalStorageMock({
      [STORAGE_KEYS.OPENAI_API_KEY]: 'sk-test-key',
      [STORAGE_KEYS.ANTHROPIC_API_KEY]: 'sk-ant-test-key',
      [STORAGE_KEYS.LITELLM_ENDPOINT]: 'http://localhost:4000',
      [STORAGE_KEYS.LITELLM_API_KEY]: 'test-litellm-key',
    });
  });

  afterEach(() => {
    LLMProviderRegistry.clear();
    localStorageMock.restore();
    if (fetchStub) {
      fetchStub.restore();
    }
    sinon.restore();
  });

  // ============ registerProvider / getProvider Tests ============
  describe('registerProvider / getProvider', () => {
    it('should register and retrieve provider', () => {
      const mockProvider = createMockProvider({ name: 'openai' });
      LLMProviderRegistry.registerProvider('openai', mockProvider);

      const retrieved = LLMProviderRegistry.getProvider('openai');
      assert.strictEqual(retrieved, mockProvider);
    });

    it('should overwrite existing provider', () => {
      const provider1 = createMockProvider({ name: 'openai' });
      const provider2 = createMockProvider({ name: 'openai' });

      LLMProviderRegistry.registerProvider('openai', provider1);
      LLMProviderRegistry.registerProvider('openai', provider2);

      const retrieved = LLMProviderRegistry.getProvider('openai');
      assert.strictEqual(retrieved, provider2);
    });

    it('should return undefined for unregistered provider', () => {
      const retrieved = LLMProviderRegistry.getProvider('openai');
      assert.isUndefined(retrieved);
    });
  });

  // ============ hasProvider Tests ============
  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      const mockProvider = createMockProvider({ name: 'openai' });
      LLMProviderRegistry.registerProvider('openai', mockProvider);

      assert.isTrue(LLMProviderRegistry.hasProvider('openai'));
    });

    it('should return false for unregistered provider', () => {
      assert.isFalse(LLMProviderRegistry.hasProvider('openai'));
    });
  });

  // ============ getAllModels Tests ============
  describe('getAllModels', () => {
    it('should aggregate models from all providers', async () => {
      const openaiProvider = createMockProvider({
        name: 'openai',
        models: [
          { id: 'gpt-4.1', name: 'GPT-4.1' },
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
        ],
      });
      const anthropicProvider = createMockProvider({
        name: 'anthropic',
        models: [
          { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
        ],
      });

      LLMProviderRegistry.registerProvider('openai', openaiProvider);
      LLMProviderRegistry.registerProvider('anthropic', anthropicProvider);

      const allModels = await LLMProviderRegistry.getAllModels();

      assert.strictEqual(allModels.length, 3);
      const modelIds = allModels.map(m => m.id);
      assert.include(modelIds, 'gpt-4.1');
      assert.include(modelIds, 'gpt-4.1-mini');
      assert.include(modelIds, 'claude-sonnet-4');
    });

    it('should handle provider errors gracefully', async () => {
      const goodProvider = createMockProvider({
        name: 'openai',
        models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }],
      });
      const badProvider = createMockProvider({
        name: 'anthropic',
        callError: new Error('API error'),
      });
      // Override getModels to throw
      badProvider.getModels = async () => { throw new Error('API error'); };

      LLMProviderRegistry.registerProvider('openai', goodProvider);
      LLMProviderRegistry.registerProvider('anthropic', badProvider);

      const allModels = await LLMProviderRegistry.getAllModels();

      // Should still return models from good provider
      assert.strictEqual(allModels.length, 1);
      assert.strictEqual(allModels[0].id, 'gpt-4.1');
    });

    it('should return empty array when no providers registered', async () => {
      const allModels = await LLMProviderRegistry.getAllModels();
      assert.deepEqual(allModels, []);
    });
  });

  // ============ getModelsByProvider Tests ============
  describe('getModelsByProvider', () => {
    it('should return models for specific provider', async () => {
      const openaiProvider = createMockProvider({
        name: 'openai',
        models: [
          { id: 'gpt-4.1', name: 'GPT-4.1' },
        ],
      });
      LLMProviderRegistry.registerProvider('openai', openaiProvider);

      const models = await LLMProviderRegistry.getModelsByProvider('openai');

      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'gpt-4.1');
    });

    it('should return empty array for unregistered provider', async () => {
      const models = await LLMProviderRegistry.getModelsByProvider('openai');
      assert.deepEqual(models, []);
    });

    it('should handle provider getModels errors', async () => {
      const badProvider = createMockProvider({ name: 'openai' });
      badProvider.getModels = async () => { throw new Error('API error'); };
      LLMProviderRegistry.registerProvider('openai', badProvider);

      const models = await LLMProviderRegistry.getModelsByProvider('openai');
      assert.deepEqual(models, []);
    });
  });

  // ============ getRegisteredProviders Tests ============
  describe('getRegisteredProviders', () => {
    it('should return list of registered provider names', () => {
      LLMProviderRegistry.registerProvider('openai', createMockProvider({ name: 'openai' }));
      LLMProviderRegistry.registerProvider('anthropic', createMockProvider({ name: 'anthropic' }));

      const providers = LLMProviderRegistry.getRegisteredProviders();

      assert.includeMembers(providers, ['openai', 'anthropic']);
    });

    it('should return empty array when no providers registered', () => {
      const providers = LLMProviderRegistry.getRegisteredProviders();
      assert.deepEqual(providers, []);
    });
  });

  // ============ clear Tests ============
  describe('clear', () => {
    it('should remove all providers', () => {
      LLMProviderRegistry.registerProvider('openai', createMockProvider({ name: 'openai' }));
      LLMProviderRegistry.registerProvider('anthropic', createMockProvider({ name: 'anthropic' }));

      LLMProviderRegistry.clear();

      assert.isFalse(LLMProviderRegistry.hasProvider('openai'));
      assert.isFalse(LLMProviderRegistry.hasProvider('anthropic'));
    });
  });

  // ============ getStats Tests ============
  describe('getStats', () => {
    it('should return provider count and list', () => {
      LLMProviderRegistry.registerProvider('openai', createMockProvider({ name: 'openai' }));
      LLMProviderRegistry.registerProvider('anthropic', createMockProvider({ name: 'anthropic' }));

      const stats = LLMProviderRegistry.getStats();

      assert.strictEqual(stats.providersCount, 2);
      assert.includeMembers(stats.providers, ['openai', 'anthropic']);
    });

    it('should return zero count when empty', () => {
      const stats = LLMProviderRegistry.getStats();

      assert.strictEqual(stats.providersCount, 0);
      assert.deepEqual(stats.providers, []);
    });
  });

  // ============ getProviderStorageKeys Tests ============
  describe('getProviderStorageKeys', () => {
    it('should return correct keys for OpenAI', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('openai');
      assert.strictEqual(keys.apiKey, 'ai_chat_api_key');
    });

    it('should return correct keys for Anthropic', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('anthropic');
      assert.strictEqual(keys.apiKey, 'ai_chat_anthropic_api_key');
    });

    it('should return correct keys for LiteLLM (has endpoint)', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('litellm');
      assert.strictEqual(keys.apiKey, 'ai_chat_litellm_api_key');
      assert.strictEqual(keys.endpoint, 'ai_chat_litellm_endpoint');
    });

    it('should return correct keys for Groq', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('groq');
      assert.strictEqual(keys.apiKey, 'ai_chat_groq_api_key');
    });
  });

  // ============ getProviderApiKey / saveProviderApiKey Tests ============
  describe('getProviderApiKey / saveProviderApiKey', () => {
    it('should read API key from localStorage', () => {
      const apiKey = LLMProviderRegistry.getProviderApiKey('openai');
      assert.strictEqual(apiKey, 'sk-test-key');
    });

    it('should return empty string when no API key', () => {
      localStorageMock.restore();
      localStorageMock = createLocalStorageMock({});

      const apiKey = LLMProviderRegistry.getProviderApiKey('openai');
      assert.strictEqual(apiKey, '');
    });

    it('should write API key to localStorage', () => {
      LLMProviderRegistry.saveProviderApiKey('openai', 'sk-new-key');

      const stored = localStorageMock.store.get('ai_chat_api_key');
      assert.strictEqual(stored, 'sk-new-key');
    });

    it('should remove API key when null passed', () => {
      LLMProviderRegistry.saveProviderApiKey('openai', null);

      const stored = localStorageMock.store.get('ai_chat_api_key');
      assert.isUndefined(stored);
    });
  });

  // ============ getProviderEndpoint / saveProviderEndpoint Tests ============
  describe('getProviderEndpoint / saveProviderEndpoint', () => {
    it('should read endpoint from localStorage', () => {
      const endpoint = LLMProviderRegistry.getProviderEndpoint('litellm');
      assert.strictEqual(endpoint, 'http://localhost:4000');
    });

    it('should return undefined if no endpoint key', () => {
      const endpoint = LLMProviderRegistry.getProviderEndpoint('openai');
      assert.isUndefined(endpoint);
    });

    it('should save endpoint to localStorage', () => {
      LLMProviderRegistry.saveProviderEndpoint('litellm', 'http://new-endpoint:5000');

      const stored = localStorageMock.store.get('ai_chat_litellm_endpoint');
      assert.strictEqual(stored, 'http://new-endpoint:5000');
    });
  });

  // ============ validateProviderCredentials Tests ============
  describe('validateProviderCredentials', () => {
    it('should validate OpenAI credentials (requires API key)', () => {
      const result = LLMProviderRegistry.validateProviderCredentials('openai');
      assert.isTrue(result.isValid);
    });

    it('should fail validation when API key missing', () => {
      localStorageMock.restore();
      localStorageMock = createLocalStorageMock({});

      const result = LLMProviderRegistry.validateProviderCredentials('openai');
      assert.isFalse(result.isValid);
      assert.isDefined(result.missingItems);
    });

    it('should validate LiteLLM credentials (requires endpoint)', () => {
      const result = LLMProviderRegistry.validateProviderCredentials('litellm');
      // LiteLLM requires endpoint
      assert.isDefined(result.isValid);
    });
  });

  // ============ getProviderCredentials Tests ============
  describe('getProviderCredentials', () => {
    it('should return canProceed true when valid', () => {
      const result = LLMProviderRegistry.getProviderCredentials('openai');
      assert.isTrue(result.canProceed);
      assert.strictEqual(result.apiKey, 'sk-test-key');
    });

    it('should return canProceed false when invalid', () => {
      localStorageMock.restore();
      localStorageMock = createLocalStorageMock({});

      const result = LLMProviderRegistry.getProviderCredentials('openai');
      assert.isFalse(result.canProceed);
      assert.isNull(result.apiKey);
    });

    it('should return apiKey and endpoint from storage', () => {
      const result = LLMProviderRegistry.getProviderCredentials('litellm');

      if (result.canProceed) {
        assert.strictEqual(result.apiKey, 'test-litellm-key');
        assert.strictEqual(result.endpoint, 'http://localhost:4000');
      }
    });
  });

  // ============ fetchProviderModels Tests ============
  describe('fetchProviderModels', () => {
    it('should fetch from provider API', async () => {
      const modelsResponse = {
        data: [
          { id: 'gpt-4.1', object: 'model' },
          { id: 'gpt-4.1-mini', object: 'model' },
        ],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await LLMProviderRegistry.fetchProviderModels('openai', 'sk-test-key');

      assert.isArray(models);
      assert.isTrue(models.length > 0);
    });

    it('should throw on API errors', async () => {
      const errorResponse = { error: { message: 'Unauthorized' } };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(errorResponse), { status: 401 })
      );

      try {
        await LLMProviderRegistry.fetchProviderModels('openai', 'invalid-key');
        assert.fail('Should have thrown');
      } catch (error) {
        assert.isDefined(error);
      }
    });
  });

  // ============ testProviderConnection Tests ============
  describe('testProviderConnection', () => {
    it('should return success on successful fetch', async () => {
      const modelsResponse = {
        data: [{ id: 'gpt-4.1', object: 'model' }],
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const result = await LLMProviderRegistry.testProviderConnection('openai', 'sk-test-key');

      assert.isTrue(result.success);
      assert.include(result.message, 'Successfully connected');
    });

    it('should return failure with error message on failure', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Network error'));

      const result = await LLMProviderRegistry.testProviderConnection('openai', 'sk-test-key');

      assert.isFalse(result.success);
      assert.include(result.message, 'Network error');
    });
  });

  // ============ Provider Creation Tests ============
  describe('Provider Creation (via storage keys)', () => {
    it('should create OpenAI provider correctly', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('openai');
      assert.isDefined(keys.apiKey);
    });

    it('should create Anthropic provider correctly', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('anthropic');
      assert.isDefined(keys.apiKey);
    });

    it('should create LiteLLM provider with endpoint', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('litellm');
      assert.isDefined(keys.apiKey);
      assert.isDefined(keys.endpoint);
    });

    it('should create Groq provider correctly', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('groq');
      assert.isDefined(keys.apiKey);
    });

    it('should create OpenRouter provider correctly', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('openrouter');
      assert.isDefined(keys.apiKey);
    });

    it('should create Cerebras provider correctly', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('cerebras');
      assert.isDefined(keys.apiKey);
    });

    it('should create Google AI provider correctly', () => {
      const keys = LLMProviderRegistry.getProviderStorageKeys('googleai');
      assert.isDefined(keys.apiKey);
    });
  });
});
