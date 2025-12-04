// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { GoogleAIProvider } from '../GoogleAIProvider.js';
import type { LLMMessage } from '../LLMTypes.js';
// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');
import {
  createLocalStorageMock,
  createMockGoogleAIResponse,
  STORAGE_KEYS,
} from './LLMTestHelpers.js';

describe('ai_chat: GoogleAIProvider', () => {
  let provider: GoogleAIProvider;
  let fetchStub: sinon.SinonStub;
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    provider = new GoogleAIProvider('test-api-key');
    localStorageMock = createLocalStorageMock({
      [STORAGE_KEYS.GOOGLEAI_API_KEY]: 'test-api-key',
    });
  });

  afterEach(() => {
    if (fetchStub) {
      fetchStub.restore();
    }
    localStorageMock.restore();
    sinon.restore();
  });

  // ============ API Format Tests ============
  describe('API format', () => {
    it('should use correct endpoint format with API key as query param', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ]);

      const fetchCall = fetchStub.firstCall;
      const url = fetchCall.args[0];
      assert.include(url, 'https://generativelanguage.googleapis.com/v1beta');
      assert.include(url, 'models/gemini-2.5-pro:generateContent');
      assert.include(url, 'key=test-api-key');
    });

    it('should normalize model name with models/ prefix', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      // Test without prefix
      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ]);

      let url = fetchStub.firstCall.args[0];
      assert.include(url, 'models/gemini-2.5-pro:generateContent');

      fetchStub.resetHistory();

      // Test with prefix already present
      await provider.callWithMessages('models/gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ]);

      url = fetchStub.firstCall.args[0];
      assert.include(url, 'models/gemini-2.5-pro:generateContent');
      // Should not have double prefix
      assert.notInclude(url, 'models/models/');
    });

    it('should send POST request with JSON content type only', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Hello!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ]);

      const fetchCall = fetchStub.firstCall;
      const options = fetchCall.args[1];
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers['Content-Type'], 'application/json');
      // Google AI uses API key in URL, no Authorization header
      assert.isUndefined(options.headers['Authorization']);
    });
  });

  // ============ Message Conversion Tests ============
  describe('message conversion', () => {
    it('should convert user messages to contents array with parts', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello world' }
      ]);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.isArray(body.contents);
      assert.strictEqual(body.contents[0].role, 'user');
      assert.isArray(body.contents[0].parts);
      assert.deepEqual(body.contents[0].parts[0], { text: 'Hello world' });
    });

    it('should convert assistant messages to model role', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'How are you?' }
      ]);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      // First should be user (after any system processing)
      assert.strictEqual(body.contents[0].role, 'user');
      assert.strictEqual(body.contents[1].role, 'model'); // assistant -> model
      assert.strictEqual(body.contents[2].role, 'user');
    });

    it('should add system prompt as first user message', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ]);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      // System prompt should be prepended as first user message
      assert.strictEqual(body.contents[0].role, 'user');
      assert.strictEqual(body.contents[0].parts[0].text, 'You are a helpful assistant.');
      // Original user message follows
      assert.strictEqual(body.contents[1].role, 'user');
      assert.strictEqual(body.contents[1].parts[0].text, 'Hello');
    });

    it('should convert tool calls to functionCall format', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
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
            function: {
              name: 'search',
              arguments: JSON.stringify({ query: 'cats' })
            }
          }]
        },
        {
          role: 'tool',
          tool_call_id: 'call_123',
          name: 'search',
          content: JSON.stringify({ results: ['cat1', 'cat2'] })
        }
      ];

      await provider.callWithMessages('gemini-2.5-pro', messages);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      // Assistant tool call becomes model with functionCall parts
      const modelMessage = body.contents[1];
      assert.strictEqual(modelMessage.role, 'model');
      assert.isDefined(modelMessage.parts[0].functionCall);
      assert.strictEqual(modelMessage.parts[0].functionCall.name, 'search');

      // Tool response becomes function role with functionResponse
      const toolMessage = body.contents[2];
      assert.strictEqual(toolMessage.role, 'function');
      assert.isDefined(toolMessage.parts[0].functionResponse);
      assert.strictEqual(toolMessage.parts[0].functionResponse.name, 'search');
    });
  });

  // ============ Image Handling Tests ============
  describe('image handling', () => {
    it('should convert base64 data URL to inline_data format', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'I see an image' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const imageContent = [
        { type: 'text' as const, text: 'What is this?' },
        {
          type: 'image_url' as const,
          image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANS' }
        }
      ];

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: imageContent }
      ]);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      const parts = body.contents[0].parts;
      assert.strictEqual(parts[0].text, 'What is this?');
      assert.isDefined(parts[1].inline_data);
      assert.strictEqual(parts[1].inline_data.mime_type, 'image/png');
      assert.strictEqual(parts[1].inline_data.data, 'iVBORw0KGgoAAAANS');
    });

    it('should handle image URL (not base64) with warning', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const imageContent = [
        { type: 'text' as const, text: 'What is this?' },
        {
          type: 'image_url' as const,
          image_url: { url: 'https://example.com/image.png' }
        }
      ];

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: imageContent }
      ]);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      const parts = body.contents[0].parts;
      // URL images get converted to text notice
      assert.include(parts[1].text, 'not supported');
    });
  });

  // ============ Tool Conversion Tests ============
  describe('tool conversion', () => {
    it('should convert OpenAI tool format to function_declarations', async () => {
      const mockResponse = createMockGoogleAIResponse({
        functionCall: { name: 'search', arguments: { query: 'test' } }
      });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const tools = [{
        type: 'function',
        function: {
          name: 'search',
          description: 'Search for something',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            },
            required: ['query']
          }
        }
      }];

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Search for cats' }
      ], { tools });

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.isDefined(body.tools);
      assert.isArray(body.tools);
      assert.isDefined(body.tools[0].function_declarations);
      const funcDecl = body.tools[0].function_declarations[0];
      assert.strictEqual(funcDecl.name, 'search');
      assert.strictEqual(funcDecl.description, 'Search for something');
    });
  });

  // ============ Response Processing Tests ============
  describe('response processing', () => {
    it('should extract text from response', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Hello there!' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const response = await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ]);

      assert.strictEqual(response.text, 'Hello there!');
    });

    it('should extract function call from response', async () => {
      const mockResponse = createMockGoogleAIResponse({
        functionCall: { name: 'search', arguments: { query: 'cats' } }
      });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const response = await provider.callWithMessages('gemini-2.5-pro', [
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
    });

    it('should throw on empty candidates', async () => {
      const emptyResponse = { candidates: [] };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(emptyResponse), { status: 200 })
      );

      try {
        await provider.callWithMessages('gemini-2.5-pro', [
          { role: 'user', content: 'Hello' }
        ]);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'No candidates');
      }
    });
  });

  // ============ Generation Config Tests ============
  describe('generation config', () => {
    it('should include temperature in generationConfig', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ], { temperature: 0.8 });

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.isDefined(body.generationConfig);
      assert.strictEqual(body.generationConfig.temperature, 0.8);
    });

    it('should not include generationConfig when no options provided', async () => {
      const mockResponse = createMockGoogleAIResponse({ text: 'Response' });
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      await provider.callWithMessages('gemini-2.5-pro', [
        { role: 'user', content: 'Hello' }
      ]);

      const body = JSON.parse(fetchStub.firstCall.args[1].body);
      assert.isUndefined(body.generationConfig);
    });
  });

  // ============ Models Fetching Tests ============
  describe('getModels', () => {
    it('should fetch and filter models that support generateContent', async () => {
      const modelsResponse = {
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            description: 'Latest model',
            supportedGenerationMethods: ['generateContent', 'countTokens']
          },
          {
            name: 'models/embedding-001',
            displayName: 'Embedding Model',
            description: 'For embeddings',
            supportedGenerationMethods: ['embedContent']
          }
        ]
      };

      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();

      // Should only return model that supports generateContent
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].id, 'gemini-2.5-pro'); // Without models/ prefix
      assert.strictEqual(models[0].name, 'Gemini 2.5 Pro');
      assert.strictEqual(models[0].provider, 'googleai');
    });

    it('should return default models on API error', async () => {
      fetchStub = sinon.stub(globalThis, 'fetch').rejects(new Error('Network error'));

      const models = await provider.getModels();

      assert.isArray(models);
      assert.isTrue(models.length > 0);
      assert.include(models.map(m => m.id), 'gemini-2.5-pro');
    });
  });

  // ============ Error Handling Tests ============
  describe('error handling', () => {
    it('should throw on API error', async () => {
      const errorResponse = {
        error: {
          message: 'Invalid API key',
          code: 401
        }
      };
      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(errorResponse), { status: 401, statusText: 'Unauthorized' })
      );

      try {
        await provider.callWithMessages('gemini-2.5-pro', [
          { role: 'user', content: 'Hello' }
        ]);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.include((error as Error).message, 'Google AI API error');
        assert.include((error as Error).message, 'Invalid API key');
      }
    });
  });

  // ============ Credential Validation Tests ============
  describe('validateCredentials', () => {
    it('should return valid when API key exists', () => {
      const result = provider.validateCredentials();

      assert.isTrue(result.isValid);
      assert.include(result.message, 'configured correctly');
    });

    it('should return invalid when API key missing', () => {
      localStorageMock.restore();
      localStorageMock = createLocalStorageMock({});

      const result = provider.validateCredentials();

      assert.isFalse(result.isValid);
      assert.include(result.missingItems!, 'API Key');
    });
  });

  // ============ Capability Detection Tests ============
  describe('capability detection', () => {
    it('should detect function calling support for Gemini models', async () => {
      const modelsResponse = {
        models: [{
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent']
        }]
      };

      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();
      assert.isTrue(models[0].capabilities!.functionCalling);
    });

    it('should detect reasoning support for Gemini 2.x models', async () => {
      const modelsResponse = {
        models: [{
          name: 'models/gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          supportedGenerationMethods: ['generateContent']
        }]
      };

      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();
      assert.isTrue(models[0].capabilities!.reasoning);
    });

    it('should detect vision support for non-text Gemini models', async () => {
      const modelsResponse = {
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/gemini-text-only',
            displayName: 'Gemini Text',
            supportedGenerationMethods: ['generateContent']
          }
        ]
      };

      fetchStub = sinon.stub(globalThis, 'fetch').resolves(
        new Response(JSON.stringify(modelsResponse), { status: 200 })
      );

      const models = await provider.getModels();
      const proModel = models.find(m => m.id === 'gemini-2.5-pro');
      const textModel = models.find(m => m.id === 'gemini-text-only');

      assert.isTrue(proModel!.capabilities!.vision);
      assert.isFalse(textModel!.capabilities!.vision);
    });
  });
});
