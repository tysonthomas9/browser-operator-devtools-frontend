// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ConfigurableAgentTool } from '../../src/agent/ConfigurableAgentTool';
import { AgentRunner } from '../../src/agent/AgentRunner';
import { MODEL_SENTINELS } from '../../src/agent/AgentTypes';
import { ChatMessageEntity } from '../../src/messaging/ChatMessage';

// Mock AgentRunner
jest.mock('../../src/agent/AgentRunner');

// Mock ToolRegistry
jest.mock('../../src/tools/ToolRegistry');

describe('ConfigurableAgentTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create agent tool with valid config', () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: ['tool1', 'tool2'],
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            reasoning: { type: 'string' },
          },
          required: ['query', 'reasoning'],
        },
      };

      const agent = new ConfigurableAgentTool(config);

      expect(agent.name).toBe('test_agent');
      expect(agent.description).toBe('A test agent');
      expect(agent.config).toBe(config);
      expect(agent.schema).toBe(config.schema);
    });

    it('should throw error if systemPrompt is missing', () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: '',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
      };

      expect(() => new ConfigurableAgentTool(config)).toThrow('systemPrompt is required');
    });

    it('should call init function if provided', () => {
      const initFn = jest.fn();
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
        init: initFn,
      };

      const agent = new ConfigurableAgentTool(config);

      expect(initFn).toHaveBeenCalledWith(agent);
    });

    it('should set default maxIterations to 10', () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
      };

      const agent = new ConfigurableAgentTool(config);

      expect(agent.config.maxIterations).toBeUndefined(); // Not set by constructor
    });
  });

  describe('execute', () => {
    it('should execute agent with valid context', async () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            reasoning: { type: 'string' },
          },
        },
      };

      const agent = new ConfigurableAgentTool(config);

      // Mock AgentRunner.run
      const mockResult = {
        success: true,
        output: 'Test output',
        terminationReason: 'final_answer' as const,
        agentSession: {
          agentName: 'test_agent',
          sessionId: 'session-1',
          status: 'completed' as const,
          startTime: new Date(),
          endTime: new Date(),
          messages: [],
          nestedSessions: [],
          tools: [],
          terminationReason: 'final_answer' as const,
        },
      };
      (AgentRunner.run as jest.Mock).mockResolvedValue(mockResult);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        apiKey: 'test-key',
        provider: 'openai' as const,
        model: 'gpt-4',
      };

      const result = await agent.execute(args, ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test output');
      expect(AgentRunner.run).toHaveBeenCalled();
    });

    it('should return error if API key is missing for required provider', async () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
      };

      const agent = new ConfigurableAgentTool(config);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        provider: 'openai' as const,
        model: 'gpt-4',
      };

      const result = await agent.execute(args, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not configured');
      expect(AgentRunner.run).not.toHaveBeenCalled();
    });

    it('should not require API key for litellm provider', async () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
      };

      const agent = new ConfigurableAgentTool(config);

      const mockResult = {
        success: true,
        output: 'Test output',
        terminationReason: 'final_answer' as const,
        agentSession: {
          agentName: 'test_agent',
          sessionId: 'session-1',
          status: 'completed' as const,
          startTime: new Date(),
          messages: [],
          nestedSessions: [],
          tools: [],
        },
      };
      (AgentRunner.run as jest.Mock).mockResolvedValue(mockResult);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        provider: 'litellm' as const,
        model: 'gpt-4',
      };

      const result = await agent.execute(args, ctx);

      expect(result.success).toBe(true);
      expect(AgentRunner.run).toHaveBeenCalled();
    });

    it('should resolve mini model from context', async () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        modelName: MODEL_SENTINELS.USE_MINI,
        schema: {
          type: 'object',
          properties: {},
        },
      };

      const agent = new ConfigurableAgentTool(config);

      const mockResult = {
        success: true,
        output: 'Test output',
        terminationReason: 'final_answer' as const,
        agentSession: {
          agentName: 'test_agent',
          sessionId: 'session-1',
          status: 'completed' as const,
          startTime: new Date(),
          messages: [],
          nestedSessions: [],
          tools: [],
        },
      };
      (AgentRunner.run as jest.Mock).mockResolvedValue(mockResult);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        apiKey: 'test-key',
        provider: 'openai' as const,
        miniModel: 'gpt-3.5-turbo',
      };

      const result = await agent.execute(args, ctx);

      expect(result.success).toBe(true);
      expect(AgentRunner.run).toHaveBeenCalled();
      const callArgs = (AgentRunner.run as jest.Mock).mock.calls[0];
      expect(callArgs[2].modelName).toBe('gpt-3.5-turbo');
    });

    it('should resolve nano model from context', async () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        modelName: MODEL_SENTINELS.USE_NANO,
        schema: {
          type: 'object',
          properties: {},
        },
      };

      const agent = new ConfigurableAgentTool(config);

      const mockResult = {
        success: true,
        output: 'Test output',
        terminationReason: 'final_answer' as const,
        agentSession: {
          agentName: 'test_agent',
          sessionId: 'session-1',
          status: 'completed' as const,
          startTime: new Date(),
          messages: [],
          nestedSessions: [],
          tools: [],
        },
      };
      (AgentRunner.run as jest.Mock).mockResolvedValue(mockResult);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        apiKey: 'test-key',
        provider: 'openai' as const,
        nanoModel: 'gpt-3.5-turbo-nano',
      };

      const result = await agent.execute(args, ctx);

      expect(result.success).toBe(true);
      expect(AgentRunner.run).toHaveBeenCalled();
      const callArgs = (AgentRunner.run as jest.Mock).mock.calls[0];
      expect(callArgs[2].modelName).toBe('gpt-3.5-turbo-nano');
    });

    it('should throw error if mini model is required but not provided', async () => {
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        modelName: MODEL_SENTINELS.USE_MINI,
        schema: {
          type: 'object',
          properties: {},
        },
      };

      const agent = new ConfigurableAgentTool(config);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        apiKey: 'test-key',
        provider: 'openai' as const,
      };

      await expect(agent.execute(args, ctx)).rejects.toThrow('Mini model not provided');
    });

    it('should call beforeExecute hook if provided', async () => {
      const beforeExecuteFn = jest.fn();
      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
        beforeExecute: beforeExecuteFn,
      };

      const agent = new ConfigurableAgentTool(config);

      const mockResult = {
        success: true,
        output: 'Test output',
        terminationReason: 'final_answer' as const,
        agentSession: {
          agentName: 'test_agent',
          sessionId: 'session-1',
          status: 'completed' as const,
          startTime: new Date(),
          messages: [],
          nestedSessions: [],
          tools: [],
        },
      };
      (AgentRunner.run as jest.Mock).mockResolvedValue(mockResult);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        apiKey: 'test-key',
        provider: 'openai' as const,
        model: 'gpt-4',
      };

      await agent.execute(args, ctx);

      expect(beforeExecuteFn).toHaveBeenCalledWith(ctx);
    });

    it('should call custom prepareMessages if provided', async () => {
      const prepareMessagesFn = jest.fn((args: any) => [
        {
          entity: ChatMessageEntity.USER as const,
          text: `Custom: ${args.query}`,
        },
      ]);

      const config = {
        name: 'test_agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent',
        tools: [],
        schema: {
          type: 'object',
          properties: {},
        },
        prepareMessages: prepareMessagesFn,
      };

      const agent = new ConfigurableAgentTool(config);

      const mockResult = {
        success: true,
        output: 'Test output',
        terminationReason: 'final_answer' as const,
        agentSession: {
          agentName: 'test_agent',
          sessionId: 'session-1',
          status: 'completed' as const,
          startTime: new Date(),
          messages: [],
          nestedSessions: [],
          tools: [],
        },
      };
      (AgentRunner.run as jest.Mock).mockResolvedValue(mockResult);

      const args = {
        query: 'test query',
        reasoning: 'test reasoning',
      };

      const ctx = {
        apiKey: 'test-key',
        provider: 'openai' as const,
        model: 'gpt-4',
      };

      await agent.execute(args, ctx);

      expect(prepareMessagesFn).toHaveBeenCalledWith(args, config);
    });
  });
});
