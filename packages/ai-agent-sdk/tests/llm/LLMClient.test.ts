// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { LLMClient } from '../../src/llm/LLMClient';
import { LLMProviderRegistry } from '../../src/llm/LLMProviderRegistry';

// Mock the provider modules
jest.mock('../../src/llm/OpenAIProvider');
jest.mock('../../src/llm/LiteLLMProvider');
jest.mock('../../src/llm/GroqProvider');

describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    // Clear registry before each test
    LLMProviderRegistry.clear();
    // Get fresh instance
    client = LLMClient.getInstance();
    // Reset initialization state
    (client as any).initialized = false;
  });

  afterEach(() => {
    LLMProviderRegistry.clear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = LLMClient.getInstance();
      const instance2 = LLMClient.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize with OpenAI provider', async () => {
      await client.initialize({
        providers: [{
          provider: 'openai',
          apiKey: 'test-key'
        }]
      });

      const stats = client.getStats();
      expect(stats.initialized).toBe(true);
      expect(stats.providers).toContain('openai');
    });

    it('should initialize with multiple providers', async () => {
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'test-key-1' },
          { provider: 'groq', apiKey: 'test-key-2' }
        ]
      });

      const stats = client.getStats();
      expect(stats.initialized).toBe(true);
      expect(stats.providersCount).toBe(2);
      expect(stats.providers).toContain('openai');
      expect(stats.providers).toContain('groq');
    });

    it('should clear existing providers on re-initialization', async () => {
      await client.initialize({
        providers: [{ provider: 'openai', apiKey: 'test-key' }]
      });

      await client.initialize({
        providers: [{ provider: 'groq', apiKey: 'test-key' }]
      });

      const stats = client.getStats();
      expect(stats.providersCount).toBe(1);
      expect(stats.providers).toContain('groq');
      expect(stats.providers).not.toContain('openai');
    });

    it('should handle provider initialization errors gracefully', async () => {
      // This should not throw even if a provider fails to initialize
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'test-key' },
          { provider: 'invalid' as any, apiKey: 'test-key' }
        ]
      });

      const stats = client.getStats();
      expect(stats.initialized).toBe(true);
    });
  });

  describe('call', () => {
    beforeEach(async () => {
      // Mock provider
      const mockProvider = {
        name: 'openai',
        callWithMessages: jest.fn().mockResolvedValue({ text: 'Test response' }),
        call: jest.fn(),
        getModels: jest.fn().mockResolvedValue([]),
        parseResponse: jest.fn()
      };

      await client.initialize({
        providers: [{ provider: 'openai', apiKey: 'test-key' }]
      });

      // Register mock provider
      LLMProviderRegistry.registerProvider('openai', mockProvider as any);
    });

    it('should throw if not initialized', async () => {
      const uninitializedClient = LLMClient.getInstance();
      (uninitializedClient as any).initialized = false;

      await expect(uninitializedClient.call({
        provider: 'openai',
        model: 'gpt-4',
        messages: [],
        systemPrompt: 'Test'
      })).rejects.toThrow('must be initialized');
    });

    it('should call provider with correct parameters', async () => {
      const provider = LLMProviderRegistry.getProvider('openai');

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'You are helpful',
        temperature: 0.7,
        tools: []
      });

      expect(provider?.callWithMessages).toHaveBeenCalledWith(
        'gpt-4.1-2025-04-14',
        expect.arrayContaining([
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' }
        ]),
        expect.objectContaining({
          temperature: 0.7,
          tools: []
        })
      );
    });

    it('should add system prompt if not present', async () => {
      const provider = LLMProviderRegistry.getProvider('openai');

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'System message'
      });

      const callArgs = (provider?.callWithMessages as jest.Mock).mock.calls[0];
      expect(callArgs[1][0]).toEqual({ role: 'system', content: 'System message' });
    });

    it('should not duplicate system prompt if already present', async () => {
      const provider = LLMProviderRegistry.getProvider('openai');

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: 'Existing system' },
          { role: 'user', content: 'Hello' }
        ],
        systemPrompt: 'Should be ignored'
      });

      const callArgs = (provider?.callWithMessages as jest.Mock).mock.calls[0];
      const systemMessages = callArgs[1].filter((m: any) => m.role === 'system');
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toBe('Existing system');
    });

    it('should throw if provider not available', async () => {
      await expect(client.call({
        provider: 'unknown' as any,
        model: 'test-model',
        messages: [],
        systemPrompt: 'Test'
      })).rejects.toThrow('Provider unknown not available');
    });

    it('should forward agent name in options', async () => {
      const provider = LLMProviderRegistry.getProvider('openai');

      await client.call({
        provider: 'openai',
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'Test',
        agentName: 'test-agent'
      });

      const callArgs = (provider?.callWithMessages as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toHaveProperty('agentName', 'test-agent');
    });
  });

  describe('testConnection', () => {
    it('should call provider testConnection if available', async () => {
      const mockProvider = {
        name: 'openai',
        callWithMessages: jest.fn(),
        call: jest.fn(),
        getModels: jest.fn(),
        parseResponse: jest.fn(),
        testConnection: jest.fn().mockResolvedValue({ success: true, message: 'OK' })
      };

      await client.initialize({
        providers: [{ provider: 'openai', apiKey: 'test-key' }]
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider as any);

      const result = await client.testConnection('openai', 'gpt-4');

      expect(result.success).toBe(true);
      expect(mockProvider.testConnection).toHaveBeenCalledWith('gpt-4');
    });

    it('should fallback to simple call if testConnection not available', async () => {
      const mockProvider = {
        name: 'openai',
        callWithMessages: jest.fn().mockResolvedValue({ text: 'OK' }),
        call: jest.fn(),
        getModels: jest.fn(),
        parseResponse: jest.fn()
      };

      await client.initialize({
        providers: [{ provider: 'openai', apiKey: 'test-key' }]
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider as any);

      const result = await client.testConnection('openai', 'gpt-4');

      expect(result.success).toBe(true);
      expect(mockProvider.callWithMessages).toHaveBeenCalled();
    });

    it('should return error if provider not available', async () => {
      await client.initialize({ providers: [] });

      const result = await client.testConnection('nonexistent' as any, 'test-model');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not available');
    });
  });

  describe('getAvailableModels', () => {
    it('should aggregate models from all providers', async () => {
      const mockProvider1 = {
        name: 'openai',
        callWithMessages: jest.fn(),
        call: jest.fn(),
        getModels: jest.fn().mockResolvedValue([
          { id: 'gpt-4', name: 'GPT-4', provider: 'openai', capabilities: {} }
        ]),
        parseResponse: jest.fn()
      };

      const mockProvider2 = {
        name: 'groq',
        callWithMessages: jest.fn(),
        call: jest.fn(),
        getModels: jest.fn().mockResolvedValue([
          { id: 'llama-3', name: 'Llama 3', provider: 'groq', capabilities: {} }
        ]),
        parseResponse: jest.fn()
      };

      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'test-key-1' },
          { provider: 'groq', apiKey: 'test-key-2' }
        ]
      });

      LLMProviderRegistry.registerProvider('openai', mockProvider1 as any);
      LLMProviderRegistry.registerProvider('groq', mockProvider2 as any);

      const models = await client.getAvailableModels();

      expect(models).toHaveLength(2);
      expect(models.some(m => m.id === 'gpt-4')).toBe(true);
      expect(models.some(m => m.id === 'llama-3')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return initialization status and provider info', async () => {
      await client.initialize({
        providers: [
          { provider: 'openai', apiKey: 'test-key' }
        ]
      });

      const stats = client.getStats();

      expect(stats.initialized).toBe(true);
      expect(stats.providersCount).toBeGreaterThan(0);
      expect(Array.isArray(stats.providers)).toBe(true);
    });
  });
});
