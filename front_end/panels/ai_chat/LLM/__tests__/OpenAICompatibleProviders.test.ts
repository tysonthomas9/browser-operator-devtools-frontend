// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for OpenAI-compatible providers: LiteLLM, Groq, OpenRouter, Cerebras
 * These providers share the same Chat Completions API format.
 */

import { LiteLLMProvider } from '../LiteLLMProvider.js';
import { GroqProvider } from '../GroqProvider.js';
import { OpenRouterProvider } from '../OpenRouterProvider.js';
import { CerebrasProvider } from '../CerebrasProvider.js';
import type { LLMMessage } from '../LLMTypes.js';
// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');
import {
  createLocalStorageMock,
  createMockOpenAICompatibleResponse,
  STORAGE_KEYS,
} from './LLMTestHelpers.js';

describe('ai_chat: OpenAI-Compatible Providers', () => {
  let fetchStub: sinon.SinonStub;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock({
      [STORAGE_KEYS.LITELLM_ENDPOINT]: 'http://localhost:4000',
      [STORAGE_KEYS.LITELLM_API_KEY]: 'test-litellm-key',
      [STORAGE_KEYS.GROQ_API_KEY]: 'gsk-test-key',
      [STORAGE_KEYS.OPENROUTER_API_KEY]: 'sk-or-test-key',
      [STORAGE_KEYS.CEREBRAS_API_KEY]: 'csk-test-key',
    });
  });

  afterEach(() => {
    if (fetchStub) {
      fetchStub.restore();
    }
    localStorageMock.restore();
    sinon.restore();
  });

  // ============ LiteLLM Provider Tests ============
  describe('LiteLLMProvider', () => {
    let provider: LiteLLMProvider;

    beforeEach(() => {
      provider = new LiteLLMProvider('test-api-key', 'http://localhost:4000');
    });

    describe('endpoint configuration', () => {
      it('should use provided endpoint', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('gpt-4.1', [
          { role: 'user', content: 'Hello' }
        ]);

        const url = fetchStub.firstCall.args[0];
        assert.include(url, 'http://localhost:4000/v1/chat/completions');
      });

      it('should fallback to localStorage endpoint', async () => {
        const providerNoEndpoint = new LiteLLMProvider('test-key', undefined);
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await providerNoEndpoint.callWithMessages('model', [
          { role: 'user', content: 'Hi' }
        ]);

        const url = fetchStub.firstCall.args[0];
        assert.include(url, 'http://localhost:4000/v1/chat/completions');
      });

      it('should throw when no endpoint configured', async () => {
        localStorageMock.restore();
        localStorageMock = createLocalStorageMock({});
        const providerNoEndpoint = new LiteLLMProvider('test-key', undefined);

        try {
          await providerNoEndpoint.callWithMessages('model', [
            { role: 'user', content: 'Hi' }
          ]);
          assert.fail('Should have thrown');
        } catch (error) {
          assert.include((error as Error).message, 'endpoint not configured');
        }
      });
    });

    describe('authentication', () => {
      it('should include Bearer token when API key provided', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('model', [{ role: 'user', content: 'Hi' }]);

        const headers = fetchStub.firstCall.args[1].headers;
        assert.strictEqual(headers.Authorization, 'Bearer test-api-key');
      });

      it('should not include Authorization when no API key', async () => {
        const providerNoKey = new LiteLLMProvider(null, 'http://localhost:4000');
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await providerNoKey.callWithMessages('model', [{ role: 'user', content: 'Hi' }]);

        const headers = fetchStub.firstCall.args[1].headers;
        assert.isUndefined(headers.Authorization);
      });
    });

    describe('credential validation', () => {
      it('should require endpoint for LiteLLM', () => {
        localStorageMock.restore();
        localStorageMock = createLocalStorageMock({});

        const result = provider.validateCredentials();

        assert.isFalse(result.isValid);
        assert.include(result.missingItems!, 'Endpoint URL');
      });

      it('should pass validation with endpoint (API key optional)', () => {
        const result = provider.validateCredentials();

        assert.isTrue(result.isValid);
      });
    });

    describe('custom models from localStorage', () => {
      it('should include custom models in getModels', async () => {
        localStorageMock.store.set('ai_chat_custom_models', JSON.stringify([
          { id: 'my-custom-model', name: 'My Custom Model' }
        ]));

        // Mock API response with empty data (no models from API)
        fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('API unavailable'));

        const models = await provider.getModels();

        const customModel = models.find(m => m.id === 'my-custom-model');
        assert.isDefined(customModel);
        assert.strictEqual(customModel!.name, 'My Custom Model');
      });
    });
  });

  // ============ Groq Provider Tests ============
  describe('GroqProvider', () => {
    let provider: GroqProvider;

    beforeEach(() => {
      provider = new GroqProvider('gsk-test-key');
    });

    describe('endpoint configuration', () => {
      it('should use Groq API endpoint', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('llama-3.3-70b-versatile', [
          { role: 'user', content: 'Hello' }
        ]);

        const url = fetchStub.firstCall.args[0];
        assert.include(url, 'https://api.groq.com/openai/v1/chat/completions');
      });
    });

    describe('message conversion', () => {
      it('should stringify tool content for tool role', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        const messages: LLMMessage[] = [
          { role: 'user', content: 'Search for cats' },
          {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: { name: 'search', arguments: '{"query":"cats"}' }
            }]
          },
          {
            role: 'tool',
            tool_call_id: 'call_123',
            name: 'search',
            content: { results: ['cat1', 'cat2'] } as any // Object content
          }
        ];

        await provider.callWithMessages('llama-3.3-70b-versatile', messages);

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        const toolMessage = body.messages[2];
        // Content should be stringified
        assert.strictEqual(typeof toolMessage.content, 'string');
        assert.include(toolMessage.content, 'cat1');
      });

      it('should set tool_choice to auto when tools provided', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('llama-3.3-70b-versatile', [
          { role: 'user', content: 'Search for cats' }
        ], {
          tools: [{
            type: 'function',
            function: { name: 'search', description: 'Search', parameters: {} }
          }]
        });

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.strictEqual(body.tool_choice, 'auto');
      });
    });

    describe('model capabilities', () => {
      it('should detect function calling for supported models', async () => {
        const modelsResponse = {
          object: 'list',
          data: [
            { id: 'llama-3.3-70b-versatile', object: 'model', created: 1, owned_by: 'groq', active: true, context_window: 8192 },
            { id: 'llama-3.2-90b-vision-preview', object: 'model', created: 1, owned_by: 'groq', active: true, context_window: 8192 }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const models = await provider.getModels();

        const llamaModel = models.find(m => m.id === 'llama-3.3-70b-versatile');
        assert.isTrue(llamaModel!.capabilities!.functionCalling);

        const visionModel = models.find(m => m.id === 'llama-3.2-90b-vision-preview');
        assert.isTrue(visionModel!.capabilities!.vision);
      });

      it('should filter inactive models', async () => {
        const modelsResponse = {
          object: 'list',
          data: [
            { id: 'active-model', object: 'model', created: 1, owned_by: 'groq', active: true, context_window: 8192 },
            { id: 'inactive-model', object: 'model', created: 1, owned_by: 'groq', active: false, context_window: 8192 }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const models = await provider.getModels();

        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].id, 'active-model');
      });
    });
  });

  // ============ OpenRouter Provider Tests ============
  describe('OpenRouterProvider', () => {
    let provider: OpenRouterProvider;

    beforeEach(() => {
      provider = new OpenRouterProvider('sk-or-test-key');
    });

    describe('endpoint configuration', () => {
      it('should use OpenRouter API endpoint', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('openai/gpt-4o', [
          { role: 'user', content: 'Hello' }
        ]);

        const url = fetchStub.firstCall.args[0];
        assert.include(url, 'https://openrouter.ai/api/v1/chat/completions');
      });
    });

    describe('special headers', () => {
      it('should include HTTP-Referer and X-Title headers', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('openai/gpt-4o', [
          { role: 'user', content: 'Hello' }
        ]);

        const headers = fetchStub.firstCall.args[1].headers;
        assert.strictEqual(headers['HTTP-Referer'], 'https://browseroperator.io');
        assert.strictEqual(headers['X-Title'], 'Browser Operator');
      });
    });

    describe('temperature handling', () => {
      it('should exclude temperature for O-series models', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('openai/o3', [
          { role: 'user', content: 'Hello' }
        ], { temperature: 0.7 });

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.isUndefined(body.temperature);
      });

      it('should exclude temperature for GPT-5 models', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('openai/gpt-5', [
          { role: 'user', content: 'Hello' }
        ], { temperature: 0.7 });

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.isUndefined(body.temperature);
      });

      it('should include temperature for other models', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('openai/gpt-4o', [
          { role: 'user', content: 'Hello' }
        ], { temperature: 0.7 });

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.strictEqual(body.temperature, 0.7);
      });
    });

    describe('model fetching', () => {
      it('should use tools filter when fetching models', async () => {
        const modelsResponse = {
          data: [
            {
              id: 'openai/gpt-4o',
              name: 'GPT-4o',
              context_length: 128000,
              architecture: { modality: 'multimodal', tokenizer: 'gpt-4' },
              pricing: { prompt: '0.005', completion: '0.015' },
              top_provider: { context_length: 128000 }
            }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        await provider.fetchModels();

        const url = fetchStub.firstCall.args[0];
        assert.include(url, 'supported_parameters=tools');
      });

      it('should detect vision from multimodal architecture', async () => {
        const modelsResponse = {
          data: [
            {
              id: 'openai/gpt-4o',
              name: 'GPT-4o',
              context_length: 128000,
              architecture: { modality: 'multimodal', tokenizer: 'gpt-4' },
              pricing: { prompt: '0.005', completion: '0.015' },
              top_provider: { context_length: 128000 }
            },
            {
              id: 'meta/llama-3.1',
              name: 'Llama 3.1',
              context_length: 8000,
              architecture: { modality: 'text', tokenizer: 'llama' },
              pricing: { prompt: '0.001', completion: '0.002' },
              top_provider: { context_length: 8000 }
            }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const models = await provider.getModels();

        const gpt4o = models.find(m => m.id === 'openai/gpt-4o');
        const llama = models.find(m => m.id === 'meta/llama-3.1');

        assert.isTrue(gpt4o!.capabilities!.vision);
        assert.isFalse(llama!.capabilities!.vision);
      });

      it('should detect reasoning for O-series models', async () => {
        const modelsResponse = {
          data: [
            {
              id: 'openai/o1-preview',
              name: 'O1 Preview',
              context_length: 128000,
              architecture: { modality: 'text', tokenizer: 'gpt-4' },
              pricing: { prompt: '0.015', completion: '0.060' },
              top_provider: { context_length: 128000 }
            }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const models = await provider.getModels();

        assert.isTrue(models[0].capabilities!.reasoning);
      });
    });

    describe('supportsVision API check', () => {
      it('should check vision support via API with caching', async () => {
        const visionModelsResponse = {
          data: [
            {
              id: 'openai/gpt-4o',
              name: 'GPT-4o',
              context_length: 128000,
              architecture: { modality: 'multimodal', tokenizer: 'gpt-4', input_modalities: ['text', 'image'] },
              pricing: { prompt: '0.005', completion: '0.015' },
              top_provider: { context_length: 128000 }
            }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(visionModelsResponse), { status: 200 })
        );

        // First call - should fetch
        const result1 = await provider.supportsVision('openai/gpt-4o');
        assert.isTrue(result1);

        // Second call - should use cache
        const result2 = await provider.supportsVision('openai/gpt-4o');
        assert.isTrue(result2);

        // Should only fetch once (cached)
        assert.strictEqual(fetchStub.callCount, 1);
      });
    });
  });

  // ============ Cerebras Provider Tests ============
  describe('CerebrasProvider', () => {
    let provider: CerebrasProvider;

    beforeEach(() => {
      provider = new CerebrasProvider('csk-test-key');
    });

    describe('endpoint configuration', () => {
      it('should use Cerebras API endpoint', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('llama-3.3-70b', [
          { role: 'user', content: 'Hello' }
        ]);

        const url = fetchStub.firstCall.args[0];
        assert.include(url, 'https://api.cerebras.ai/v1/chat/completions');
      });
    });

    describe('temperature handling', () => {
      it('should clamp temperature to 0-1.5 range', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        // Test clamping high value
        await provider.callWithMessages('llama-3.3-70b', [
          { role: 'user', content: 'Hello' }
        ], { temperature: 2.0 });

        let body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.strictEqual(body.temperature, 1.5);

        fetchStub.resetHistory();

        // Test clamping negative value
        await provider.callWithMessages('llama-3.3-70b', [
          { role: 'user', content: 'Hello' }
        ], { temperature: -0.5 });

        body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.strictEqual(body.temperature, 0);
      });

      it('should preserve valid temperature values', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('llama-3.3-70b', [
          { role: 'user', content: 'Hello' }
        ], { temperature: 0.8 });

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.strictEqual(body.temperature, 0.8);
      });
    });

    describe('model capabilities', () => {
      it('should detect function calling for supported Cerebras models', async () => {
        const modelsResponse = {
          object: 'list',
          data: [
            { id: 'llama-3.3-70b', object: 'model', created: 1, owned_by: 'cerebras' },
            { id: 'qwen-3-32b', object: 'model', created: 1, owned_by: 'cerebras' }
          ]
        };
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(modelsResponse), { status: 200 })
        );

        const models = await provider.getModels();

        assert.isTrue(models.every(m => m.capabilities!.functionCalling === true));
        // Cerebras doesn't support vision
        assert.isTrue(models.every(m => m.capabilities!.vision === false));
      });
    });

    describe('tool handling', () => {
      it('should set tool_choice to auto when tools provided', async () => {
        const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
        fetchStub = sinon.stub(globalThis, 'fetch').resolves(
          new Response(JSON.stringify(mockResponse), { status: 200 })
        );

        await provider.callWithMessages('llama-3.3-70b', [
          { role: 'user', content: 'Search' }
        ], {
          tools: [{
            type: 'function',
            function: { name: 'search', description: 'Search', parameters: {} }
          }]
        });

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        assert.strictEqual(body.tool_choice, 'auto');
      });
    });
  });

  // ============ Common Tests for All Providers ============
  describe('Common behavior', () => {
    const providers = [
      { name: 'LiteLLM', create: () => new LiteLLMProvider('key', 'http://localhost:4000') },
      { name: 'Groq', create: () => new GroqProvider('key') },
      { name: 'OpenRouter', create: () => new OpenRouterProvider('key') },
      { name: 'Cerebras', create: () => new CerebrasProvider('key') }
    ];

    providers.forEach(({ name, create }) => {
      describe(`${name}Provider`, () => {
        it('should use OpenAI-compatible Chat Completions format', async () => {
          const provider = create();
          const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
          fetchStub = sinon.stub(globalThis, 'fetch').resolves(
            new Response(JSON.stringify(mockResponse), { status: 200 })
          );

          await provider.callWithMessages('model', [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' }
          ]);

          const body = JSON.parse(fetchStub.firstCall.args[1].body);

          // Should have model and messages
          assert.isDefined(body.model);
          assert.isArray(body.messages);

          // Messages should be in OpenAI format
          assert.strictEqual(body.messages[0].role, 'system');
          assert.strictEqual(body.messages[0].content, 'You are helpful');
          assert.strictEqual(body.messages[1].role, 'user');

          fetchStub.restore();
        });

        it('should extract text from choice.message.content', async () => {
          const provider = create();
          const mockResponse = createMockOpenAICompatibleResponse({ text: 'Hello world!' });
          fetchStub = sinon.stub(globalThis, 'fetch').resolves(
            new Response(JSON.stringify(mockResponse), { status: 200 })
          );

          const response = await provider.callWithMessages('model', [
            { role: 'user', content: 'Hi' }
          ]);

          assert.strictEqual(response.text, 'Hello world!');
          fetchStub.restore();
        });

        it('should extract function call from tool_calls', async () => {
          const provider = create();
          const mockResponse = createMockOpenAICompatibleResponse({
            functionCall: {
              name: 'search',
              arguments: { query: 'cats' }
            }
          });
          fetchStub = sinon.stub(globalThis, 'fetch').resolves(
            new Response(JSON.stringify(mockResponse), { status: 200 })
          );

          const response = await provider.callWithMessages('model', [
            { role: 'user', content: 'Search for cats' }
          ], {
            tools: [{
              type: 'function',
              function: { name: 'search', description: 'Search', parameters: {} }
            }]
          });

          assert.isDefined(response.functionCall);
          assert.strictEqual(response.functionCall!.name, 'search');
          assert.deepEqual(response.functionCall!.arguments, { query: 'cats' });
          fetchStub.restore();
        });

        it('should throw on empty choices', async () => {
          const provider = create();
          const emptyResponse = { choices: [] };
          fetchStub = sinon.stub(globalThis, 'fetch').resolves(
            new Response(JSON.stringify(emptyResponse), { status: 200 })
          );

          try {
            await provider.callWithMessages('model', [{ role: 'user', content: 'Hi' }]);
            assert.fail('Should have thrown');
          } catch (error) {
            assert.include((error as Error).message, 'No choices');
          }
          fetchStub.restore();
        });

        it('should include tools with proper parameters format', async () => {
          const provider = create();
          const mockResponse = createMockOpenAICompatibleResponse({ text: 'Response' });
          fetchStub = sinon.stub(globalThis, 'fetch').resolves(
            new Response(JSON.stringify(mockResponse), { status: 200 })
          );

          const tools = [{
            type: 'function',
            function: {
              name: 'test_tool',
              description: 'A test tool'
              // No parameters - should add default
            }
          }];

          await provider.callWithMessages('model', [
            { role: 'user', content: 'Use tool' }
          ], { tools: tools as any });

          const body = JSON.parse(fetchStub.firstCall.args[1].body);

          // Should have default parameters
          assert.isDefined(body.tools[0].function.parameters);
          assert.strictEqual(body.tools[0].function.parameters.type, 'object');
          fetchStub.restore();
        });

        it('should return default models on API error', async () => {
          const provider = create();
          fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Network error'));

          const models = await provider.getModels();

          assert.isArray(models);
          assert.isTrue(models.length > 0);
          fetchStub.restore();
        });
      });
    });
  });
});
