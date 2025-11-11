// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { Tool } from '../tools/Tool.js';
import { ChatMessageEntity } from '../messaging/ChatMessage.js';
import { createLogger } from '../observability/Logger.js';
import type { AgentSession } from '../messaging/AgentSession.js';
import { AgentRunner, type AgentRunnerConfig, type AgentRunnerHooks } from './AgentRunner.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import {
  MODEL_SENTINELS,
  type AgentToolConfig,
  type ConfigurableAgentArgs,
  type ConfigurableAgentResult,
  type AgentRunTerminationReason,
  type CallContext,
} from './AgentTypes.js';

const logger = createLogger('ConfigurableAgentTool');

/**
 * An agent tool that can be configured via JSON
 * This allows agents to be used as tools within other agents
 */
export class ConfigurableAgentTool implements Tool<ConfigurableAgentArgs, ConfigurableAgentResult> {
  name: string;
  description: string;
  config: AgentToolConfig;
  schema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };

  constructor(config: AgentToolConfig) {
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.schema = config.schema;

    // Validate required fields
    if (!config.systemPrompt) {
      throw new Error(`ConfigurableAgentTool: systemPrompt is required for ${config.name}`);
    }

    // Call custom init function if provided
    if (config.init) {
      config.init(this);
    }
  }

  /**
   * Get the tool instances for this agent
   */
  private getToolInstances(): Array<Tool<any, any>> {
    return this.config.tools
      .map((toolName) => ToolRegistry.getRegisteredTool(toolName))
      .filter((tool): tool is Tool<any, any> => tool !== null);
  }

  /**
   * Prepare initial messages for the agent
   */
  private prepareInitialMessages(args: ConfigurableAgentArgs): any[] {
    // Use custom message preparation function if provided
    if (this.config.prepareMessages) {
      return this.config.prepareMessages(args, this.config);
    }

    // Default implementation
    return [
      {
        entity: ChatMessageEntity.USER,
        text: args.query,
      },
    ];
  }

  /**
   * Create a success result
   */
  private createSuccessResult(
    output: string,
    intermediateSteps: any[],
    reason: AgentRunTerminationReason
  ): ConfigurableAgentResult {
    // Use custom success result creation function
    if (this.config.createSuccessResult) {
      return this.config.createSuccessResult(output, intermediateSteps, reason, this.config);
    }

    // Default implementation
    const result: ConfigurableAgentResult = {
      success: true,
      output,
      terminationReason: reason,
    };

    // Only include steps if the flag is explicitly true
    if (this.config.includeIntermediateStepsOnReturn === true) {
      result.intermediateSteps = intermediateSteps;
    }

    return result;
  }

  /**
   * Create an error result
   */
  private createErrorResult(
    error: string,
    intermediateSteps: any[],
    reason: AgentRunTerminationReason
  ): ConfigurableAgentResult {
    // Use custom error result creation function
    if (this.config.createErrorResult) {
      return this.config.createErrorResult(error, intermediateSteps, reason, this.config);
    }

    // Default implementation
    const result: ConfigurableAgentResult = {
      success: false,
      error,
      terminationReason: reason,
    };

    // Only include steps if the flag is explicitly true
    if (this.config.includeIntermediateStepsOnReturn === true) {
      result.intermediateSteps = intermediateSteps;
    }

    return result;
  }

  /**
   * Execute the agent
   */
  async execute(
    args: ConfigurableAgentArgs,
    ctx?: unknown
  ): Promise<ConfigurableAgentResult & { agentSession: AgentSession }> {
    logger.info(`Executing ${this.name} via AgentRunner with args:`, args);

    const callCtx = (ctx || {}) as CallContext;
    const apiKey = callCtx.apiKey;
    const provider = callCtx.provider;

    // Check if API key is required based on provider
    const requiresApiKey = provider !== 'litellm' && provider !== 'browseroperator';

    if (requiresApiKey && !apiKey) {
      const errorResult = this.createErrorResult(`API key not configured for ${this.name}`, [], 'error');
      const errorSession: AgentSession = {
        agentName: this.name,
        agentQuery: args.query,
        agentReasoning: args.reasoning,
        sessionId: crypto.randomUUID(),
        status: 'error',
        startTime: new Date(),
        endTime: new Date(),
        messages: [],
        nestedSessions: [],
        tools: [],
        terminationReason: 'error',
      };
      return { ...errorResult, agentSession: errorSession };
    }

    // Execute beforeExecute lifecycle hook if defined
    if (this.config.beforeExecute) {
      try {
        await this.config.beforeExecute(callCtx);
      } catch (error) {
        logger.warn(`beforeExecute hook failed for ${this.name}:`, error);
      }
    }

    // Initialize
    const maxIterations = this.config.maxIterations || 10;

    // Resolve model name from context or configuration
    let modelName: string;
    if (this.config.modelName === MODEL_SENTINELS.USE_MINI) {
      modelName = callCtx.miniModel || callCtx.mainModel || callCtx.model || '';
      if (!modelName) {
        throw new Error(
          `Mini model not provided in context for agent '${this.name}'. Ensure context includes miniModel or mainModel.`
        );
      }
    } else if (this.config.modelName === MODEL_SENTINELS.USE_NANO) {
      modelName = callCtx.nanoModel || callCtx.miniModel || callCtx.mainModel || callCtx.model || '';
      if (!modelName) {
        throw new Error(
          `Nano model not provided in context for agent '${this.name}'. Ensure context includes nanoModel, miniModel, or mainModel.`
        );
      }
    } else if (typeof this.config.modelName === 'function') {
      modelName = this.config.modelName();
    } else if (this.config.modelName) {
      modelName = this.config.modelName;
    } else {
      const contextModel = callCtx.mainModel || callCtx.model;
      if (!contextModel) {
        throw new Error(
          `No model provided for agent '${this.name}'. Ensure context includes model or mainModel.`
        );
      }
      modelName = contextModel;
    }

    // Override with context model only if agent doesn't have its own model configuration
    if (callCtx.model && !this.config.modelName) {
      modelName = callCtx.model;
    }

    // Update context with resolved fallback models for tools to use
    if (this.config.modelName === MODEL_SENTINELS.USE_MINI && !callCtx.miniModel) {
      callCtx.miniModel = modelName;
    }
    if (this.config.modelName === MODEL_SENTINELS.USE_NANO && !callCtx.nanoModel) {
      callCtx.nanoModel = modelName;
    }

    // Validate required context
    if (!callCtx.provider) {
      throw new Error(
        `Provider not provided in context for agent '${this.name}'. Ensure context includes provider.`
      );
    }

    const temperature = this.config.temperature ?? 0;
    const systemPrompt = this.config.systemPrompt;
    const tools = this.getToolInstances();

    // Prepare initial messages
    const internalMessages = this.prepareInitialMessages(args);
    const runnerConfig: AgentRunnerConfig = {
      apiKey: apiKey || '',
      modelName,
      systemPrompt,
      tools,
      maxIterations,
      temperature,
      provider: callCtx.provider,
      getVisionCapability: callCtx.getVisionCapability ?? (() => false),
      miniModel: callCtx.miniModel,
      nanoModel: callCtx.nanoModel,
    };

    const runnerHooks: AgentRunnerHooks = {
      prepareInitialMessages: undefined,
      createSuccessResult: this.config.createSuccessResult
        ? (out, steps, reason) => this.config.createSuccessResult!(out, steps, reason, this.config)
        : (out, steps, reason) => this.createSuccessResult(out, steps, reason),
      createErrorResult: this.config.createErrorResult
        ? (err, steps, reason) => this.config.createErrorResult!(err, steps, reason, this.config)
        : (err, steps, reason) => this.createErrorResult(err, steps, reason),
      afterExecute: this.config.afterExecute
        ? async (result, agentSession) => this.config.afterExecute!(result, agentSession, callCtx)
        : undefined,
    };

    // Run the agent
    const result = await AgentRunner.run(
      internalMessages,
      args,
      runnerConfig,
      runnerHooks,
      this,
      undefined,
      {
        sessionId: callCtx.overrideSessionId,
        parentSessionId: callCtx.overrideParentSessionId,
      },
      callCtx.abortSignal
    );

    return result;
  }
}
