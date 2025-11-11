// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { LLMResponse, LLMMessage, LLMProvider } from '../llm/LLMTypes.js';
import type { Tool } from '../tools/Tool.js';
import { ChatMessageEntity, type ChatMessage, type ModelChatMessage, type ToolResultMessage } from '../messaging/ChatMessage.js';
import { createLogger } from '../observability/Logger.js';
import type { AgentSession, AgentMessage } from '../messaging/AgentSession.js';
import { AgentErrorHandler } from './AgentErrorHandler.js';
import { AgentRunnerEventBus } from './AgentRunnerEventBus.js';
import { sanitizeMessagesForModel } from '../llm/MessageSanitizer.js';
import { LLMProviderRegistry } from '../llm/LLMProviderRegistry.js';
import { LLMResponseParser } from '../llm/LLMResponseParser.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import {
  MODEL_SENTINELS,
  type ConfigurableAgentArgs,
  type ConfigurableAgentResult,
  type AgentRunTerminationReason,
  type HandoffConfig,
} from './AgentTypes.js';

const logger = createLogger('AgentRunner');

// Forward declaration for ConfigurableAgentTool
// This will be defined in ConfigurableAgentTool.ts
export interface ConfigurableAgentTool extends Tool<ConfigurableAgentArgs, ConfigurableAgentResult> {
  config: any;
}

/**
 * Configuration for the AgentRunner
 */
export interface AgentRunnerConfig {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  tools: Array<Tool<any, any>>;
  maxIterations: number;
  temperature: number;
  provider: LLMProvider;
  getVisionCapability?: (modelName: string) => Promise<boolean> | boolean;
  miniModel?: string;
  nanoModel?: string;
}

/**
 * Hooks for customizing agent behavior
 */
export interface AgentRunnerHooks {
  prepareInitialMessages?: (messages: ChatMessage[]) => ChatMessage[];
  createSuccessResult: (output: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason) => ConfigurableAgentResult;
  createErrorResult: (error: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason) => ConfigurableAgentResult;
  afterExecute?: (result: ConfigurableAgentResult, agentSession: AgentSession) => Promise<void>;
}

/**
 * AgentRunner executes agent loops with tool calling
 */
export class AgentRunner {
  // Event bus for progress tracking (optional)
  static eventBus: AgentRunnerEventBus | null = null;

  /**
   * Initialize the event bus
   */
  static initializeEventBus(): void {
    if (!AgentRunner.eventBus) {
      AgentRunner.eventBus = AgentRunnerEventBus.getInstance();
    }
  }

  /**
   * Convert chat messages to LLM messages
   */
  static convertToLLMMessages(messages: ChatMessage[]): LLMMessage[] {
    const llmMessages: LLMMessage[] = [];

    for (const message of messages) {
      if (message.entity === ChatMessageEntity.USER) {
        // Handle user messages
        if (message.imageInput) {
          llmMessages.push({
            role: 'user',
            content: [
              { type: 'text', text: message.text },
              {
                type: 'image_url',
                image_url: {
                  url: message.imageInput.url || message.imageInput.bytesBase64,
                  detail: 'auto',
                },
              },
            ],
          });
        } else {
          llmMessages.push({
            role: 'user',
            content: message.text,
          });
        }
      } else if (message.entity === ChatMessageEntity.MODEL) {
        const modelMsg = message as ModelChatMessage;
        if (modelMsg.action === 'tool') {
          llmMessages.push({
            role: 'assistant',
            content: Array.isArray(modelMsg.reasoning) ? modelMsg.reasoning.join(' ') : (modelMsg.reasoning || ''),
            tool_calls: [
              {
                id: modelMsg.toolCallId || crypto.randomUUID(),
                type: 'function',
                function: {
                  name: modelMsg.toolName || '',
                  arguments: JSON.stringify(modelMsg.toolArgs || {}),
                },
              },
            ],
          });
        } else if (modelMsg.action === 'final') {
          llmMessages.push({
            role: 'assistant',
            content: modelMsg.answer || '',
          });
        }
      } else if (message.entity === ChatMessageEntity.TOOL_RESULT) {
        const toolResult = message as ToolResultMessage;
        // Check if tool result includes image data
        const hasImageData = toolResult.imageData && typeof toolResult.imageData === 'string';

        if (hasImageData) {
          // Create multimodal content (text + image)
          llmMessages.push({
            role: 'tool',
            content: [
              {
                type: 'text',
                text: toolResult.resultText,
              },
              {
                type: 'image_url',
                image_url: {
                  url: toolResult.imageData!,
                  detail: 'high',
                },
              },
            ],
            tool_call_id: toolResult.toolCallId,
          });
        } else {
          // Text-only behavior for tools without images
          let content = toolResult.resultText;

          // Append summary if present
          if (toolResult.summary) {
            content = content + '\n\n' + toolResult.summary;
          }

          llmMessages.push({
            role: 'tool',
            content: content,
            tool_call_id: toolResult.toolCallId,
          });
        }
      }
    }

    return llmMessages;
  }

  /**
   * Sanitizes tool result data for text representation by removing fields
   * that shouldn't be sent to the LLM (imageData, success, etc.)
   */
  private static sanitizeToolResultForText(toolResultData: any): any {
    if (typeof toolResultData !== 'object' || toolResultData === null) {
      return toolResultData;
    }

    // Create a shallow copy
    const sanitized = { ...toolResultData };

    // Remove fields that shouldn't be sent to LLM
    const fieldsToRemove = ['imageData', 'success', 'dataUrl', 'agentSession'];

    fieldsToRemove.forEach((field) => {
      if (sanitized.hasOwnProperty(field)) {
        delete sanitized[field];
      }
    });

    return sanitized;
  }

  /**
   * Compute the tool result text shown to the LLM for regular tool outputs
   */
  static computeToolResultText(toolResultData: any, imageData?: string): string {
    // If the tool produced a simple string, return as-is
    if (typeof toolResultData === 'string') {
      return toolResultData;
    }
    // Create sanitized data for text representation
    const sanitizedData = this.sanitizeToolResultForText(toolResultData);
    const sanitizedIsEmptyObject =
      typeof sanitizedData === 'object' && sanitizedData !== null && Object.keys(sanitizedData).length === 0;
    const hadOnlyImage = !!imageData && sanitizedIsEmptyObject;
    if (hadOnlyImage) {
      return 'Image omitted (model lacks vision).';
    }
    return JSON.stringify(sanitizedData, null, 2);
  }

  /**
   * Execute handoff to another agent
   */
  private static async executeHandoff(
    currentMessages: ChatMessage[],
    originalArgs: ConfigurableAgentArgs,
    handoffConfig: HandoffConfig,
    executingAgent: ConfigurableAgentTool,
    apiKey: string,
    defaultModelName: string,
    defaultMaxIterations: number,
    defaultTemperature: number,
    defaultCreateSuccessResult: AgentRunnerHooks['createSuccessResult'],
    defaultCreateErrorResult: AgentRunnerHooks['createErrorResult'],
    llmToolArgs?: ConfigurableAgentArgs,
    parentSession?: AgentSession,
    defaultProvider?: LLMProvider,
    defaultGetVisionCapability?: (modelName: string) => Promise<boolean> | boolean,
    miniModel?: string,
    nanoModel?: string,
    overrides?: { sessionId?: string; parentSessionId?: string }
  ): Promise<ConfigurableAgentResult & { agentSession: AgentSession }> {
    const targetAgentName = handoffConfig.targetAgentName;
    const targetAgentTool = ToolRegistry.getRegisteredTool(targetAgentName);

    if (!(targetAgentTool && 'config' in targetAgentTool)) {
      const errorMsg = `Handoff target '${targetAgentName}' not found or is not a ConfigurableAgentTool.`;
      logger.error(`${errorMsg}`);
      const errorSession: AgentSession = {
        agentName: targetAgentName,
        sessionId: crypto.randomUUID(),
        status: 'error',
        startTime: new Date(),
        endTime: new Date(),
        messages: [],
        nestedSessions: [],
        tools: [],
        terminationReason: 'error',
      };
      return { ...defaultCreateErrorResult(errorMsg, currentMessages, 'error'), agentSession: errorSession };
    }

    const targetAgent = targetAgentTool as ConfigurableAgentTool;
    logger.info(`Initiating handoff from ${executingAgent.name} to ${targetAgent.name}`);

    let handoffMessages: ChatMessage[] = [];
    const targetConfig = targetAgent.config;

    // Filter messages based on includeToolResults
    if (handoffConfig.includeToolResults && handoffConfig.includeToolResults.length > 0) {
      handoffMessages = currentMessages.filter((message) => {
        if (message.entity === ChatMessageEntity.AGENT_SESSION) {
          return false;
        }
        if (message.entity === ChatMessageEntity.USER) {
          return true;
        }
        if (message.entity === ChatMessageEntity.MODEL) {
          const modelMsg = message as ModelChatMessage;
          if (modelMsg.action === 'final') {
            return true;
          }
          if (modelMsg.action === 'tool' && modelMsg.toolName) {
            return handoffConfig.includeToolResults!.includes(modelMsg.toolName);
          }
        }
        if (message.entity === ChatMessageEntity.TOOL_RESULT) {
          const toolResult = message as ToolResultMessage;
          return (
            !toolResult.isError &&
            toolResult.toolName &&
            handoffConfig.includeToolResults!.includes(toolResult.toolName)
          );
        }
        return false;
      });
    } else {
      handoffMessages = currentMessages.filter((message) => {
        return message.entity !== ChatMessageEntity.AGENT_SESSION;
      });
    }

    // Resolve model name for the target agent
    let resolvedModelName: string;
    if (typeof targetConfig.modelName === 'function') {
      resolvedModelName = targetConfig.modelName();
    } else if (targetConfig.modelName === MODEL_SENTINELS.USE_MINI) {
      if (!miniModel) {
        throw new Error(
          `Mini model not provided for handoff to agent '${targetAgentName}'. Ensure miniModel is passed in context.`
        );
      }
      resolvedModelName = miniModel;
    } else if (targetConfig.modelName === MODEL_SENTINELS.USE_NANO) {
      if (!nanoModel) {
        throw new Error(
          `Nano model not provided for handoff to agent '${targetAgentName}'. Ensure nanoModel is passed in context.`
        );
      }
      resolvedModelName = nanoModel;
    } else {
      resolvedModelName = targetConfig.modelName || defaultModelName;
    }

    // Construct config and hooks for target agent
    const targetRunnerConfig: AgentRunnerConfig = {
      apiKey,
      modelName: resolvedModelName,
      systemPrompt: targetConfig.systemPrompt,
      tools: targetConfig.tools
        .map((toolName: string) => ToolRegistry.getRegisteredTool(toolName))
        .filter((tool: Tool<any, any> | null): tool is Tool<any, any> => tool !== null),
      maxIterations: targetConfig.maxIterations || defaultMaxIterations,
      temperature: targetConfig.temperature ?? defaultTemperature,
      provider: defaultProvider as LLMProvider,
      getVisionCapability: defaultGetVisionCapability,
      miniModel,
      nanoModel,
    };

    const targetRunnerHooks: AgentRunnerHooks = {
      prepareInitialMessages: undefined,
      createSuccessResult: targetConfig.createSuccessResult
        ? (out: string, steps: ChatMessage[], reason: AgentRunTerminationReason) =>
            targetConfig.createSuccessResult!(out, steps, reason, targetConfig)
        : defaultCreateSuccessResult,
      createErrorResult: targetConfig.createErrorResult
        ? (err: string, steps: ChatMessage[], reason: AgentRunTerminationReason) =>
            targetConfig.createErrorResult!(err, steps, reason, targetConfig)
        : defaultCreateErrorResult,
    };

    const targetAgentArgs = llmToolArgs ?? originalArgs;

    logger.info(`Executing handoff target agent: ${targetAgent.name} with ${handoffMessages.length} messages.`);
    const handoffResult = await AgentRunner.run(
      handoffMessages,
      targetAgentArgs,
      targetRunnerConfig,
      targetRunnerHooks,
      targetAgent,
      parentSession,
      overrides,
      undefined
    );

    const { agentSession: childSession, ...actualResult } = handoffResult;

    // Add child session to parent's nested sessions
    if (parentSession) {
      parentSession.nestedSessions.push(childSession);
    }

    logger.info(`Handoff target agent ${targetAgent.name} finished. Result success: ${actualResult.success}`);

    // Check if target agent includes intermediate steps
    if (targetAgent.config.includeIntermediateStepsOnReturn === true) {
      logger.info(`Including intermediateSteps from ${targetAgent.name} based on its config.`);
      const combinedIntermediateSteps = [...currentMessages, ...(actualResult.intermediateSteps || [])];
      return {
        ...actualResult,
        intermediateSteps: combinedIntermediateSteps,
        terminationReason: actualResult.terminationReason || 'handed_off',
        agentSession: childSession,
      };
    }

    // Otherwise, omit intermediate steps
    logger.info(`Omitting intermediateSteps from ${targetAgent.name} based on its config.`);
    const finalResult = {
      ...actualResult,
      terminationReason: actualResult.terminationReason || 'handed_off',
      agentSession: childSession,
    };
    delete finalResult.intermediateSteps;
    return finalResult;
  }

  /**
   * Main agent execution loop
   */
  static async run(
    initialMessages: ChatMessage[],
    args: ConfigurableAgentArgs,
    config: AgentRunnerConfig,
    hooks: AgentRunnerHooks,
    executingAgent: ConfigurableAgentTool | null,
    parentSession?: AgentSession,
    overrides?: { sessionId?: string; parentSessionId?: string },
    abortSignal?: AbortSignal
  ): Promise<ConfigurableAgentResult & { agentSession: AgentSession }> {
    const agentName = executingAgent?.name || 'Unknown';
    logger.info(`Starting execution loop for agent: ${agentName}`);
    const { apiKey, modelName, systemPrompt, tools, maxIterations, temperature } = config;
    const { prepareInitialMessages, createSuccessResult, createErrorResult, afterExecute } = hooks;

    // Create agent session
    const agentSession: AgentSession = {
      agentName,
      agentQuery: args.query,
      agentReasoning: args.reasoning,
      agentDisplayName: executingAgent?.config?.ui?.displayName || agentName,
      agentDescription: executingAgent?.config?.description,
      sessionId: overrides?.sessionId || crypto.randomUUID(),
      parentSessionId: overrides?.parentSessionId || parentSession?.sessionId,
      status: 'running',
      startTime: new Date(),
      messages: [],
      nestedSessions: [],
      tools: config.tools.map((t) => t.name),
      config: executingAgent?.config,
      maxIterations,
      modelUsed: modelName,
      iterationCount: 0,
    };

    let currentSession = agentSession;

    // Emit session started event
    if (AgentRunner.eventBus) {
      AgentRunner.eventBus.emitProgress({
        type: 'session_started',
        sessionId: agentSession.sessionId,
        parentSessionId: agentSession.parentSessionId,
        agentName,
        timestamp: new Date(),
        data: { session: agentSession },
      });
    }

    // Helper to add messages to session
    const addSessionMessage = (message: Partial<AgentMessage>): void => {
      const fullMessage: AgentMessage = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...message,
      } as AgentMessage;

      currentSession.messages.push(fullMessage);

      // Emit progress events
      if (AgentRunner.eventBus && fullMessage.type === 'tool_call') {
        AgentRunner.eventBus.emitProgress({
          type: 'tool_started',
          sessionId: currentSession.sessionId,
          parentSessionId: currentSession.parentSessionId,
          agentName: currentSession.agentName,
          timestamp: new Date(),
          data: { session: currentSession, toolCall: fullMessage },
        });
      } else if (AgentRunner.eventBus && fullMessage.type === 'tool_result') {
        AgentRunner.eventBus.emitProgress({
          type: 'tool_completed',
          sessionId: currentSession.sessionId,
          parentSessionId: currentSession.parentSessionId,
          agentName: currentSession.agentName,
          timestamp: new Date(),
          data: { session: currentSession, toolResult: fullMessage },
        });
      }
    };

    let messages = [...initialMessages];

    // Prepare initial messages if hook provided
    if (prepareInitialMessages) {
      messages = prepareInitialMessages(messages);
    }

    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    const toolSchemas = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
      },
    }));

    // Create error handler
    const errorHandler = AgentErrorHandler.createErrorHandler({
      continueOnError: true,
      agentName,
      availableTools: Array.from(toolMap.keys()),
      session: agentSession,
    });

    // Add handoff tools based on agent config
    if (executingAgent?.config.handoffs) {
      for (const handoffConfig of executingAgent.config.handoffs) {
        if (!handoffConfig.trigger || handoffConfig.trigger === 'llm_tool_call') {
          const targetAgentName = handoffConfig.targetAgentName;
          const targetTool = ToolRegistry.getRegisteredTool(targetAgentName);
          if (targetTool && 'config' in targetTool) {
            const handoffToolName = `handoff_to_${targetAgentName}`;
            toolSchemas.push({
              type: 'function',
              function: {
                name: handoffToolName,
                description: `Handoff the current task to the specialized agent: ${targetAgentName}. Use this agent when the task requires ${targetAgentName}'s capabilities. Agent Description: ${targetTool.description}`,
                parameters: targetTool.schema,
              },
            });
            toolMap.set(handoffToolName, targetTool);
            logger.info(`Added LLM handoff tool schema: ${handoffToolName}`);
          } else {
            logger.warn(
              `Configured LLM handoff target '${targetAgentName}' not found or is not a ConfigurableAgentTool.`
            );
          }
        }
      }
    }

    // Capture initial reasoning
    if (args.reasoning) {
      const reasoningText = Array.isArray(args.reasoning) ? args.reasoning.join(' ') : args.reasoning;
      addSessionMessage({
        type: 'reasoning',
        content: {
          type: 'reasoning',
          text: reasoningText,
        },
      });
    }

    let iteration = 0;

    // Main execution loop
    for (iteration = 0; iteration < maxIterations; iteration++) {
      // Check abort signal
      if (abortSignal?.aborted) {
        logger.info(`${agentName} execution aborted at iteration ${iteration + 1}/${maxIterations}`);

        currentSession.status = 'error';
        currentSession.endTime = new Date();
        currentSession.terminationReason = 'error';

        if (AgentRunner.eventBus) {
          AgentRunner.eventBus.emitProgress({
            type: 'session_completed',
            sessionId: currentSession.sessionId,
            parentSessionId: currentSession.parentSessionId,
            agentName,
            timestamp: new Date(),
            data: { session: currentSession, reason: 'aborted' },
          });
        }

        const abortResult = createErrorResult('Execution was cancelled', messages, 'error');

        if (afterExecute) {
          try {
            await afterExecute(abortResult, currentSession);
          } catch (error) {
            logger.warn(`afterExecute hook failed for ${agentName}:`, error);
          }
        }

        return { ...abortResult, agentSession: currentSession };
      }

      // Update session iteration count
      if (currentSession) {
        currentSession.iterationCount = iteration + 1;
      }
      logger.info(`${agentName} Iteration ${iteration + 1}/${maxIterations}`);

      // Prepare iteration info
      const iterationInfo = `
## Current Progress
- You are currently on step ${iteration + 1} of ${maxIterations - 1} maximum steps.
- Focus on making meaningful progress with each step.`;

      const currentSystemPrompt = systemPrompt + iterationInfo;

      let llmResponse: LLMResponse;

      try {
        logger.info(`${agentName} Calling LLM with ${messages.length} messages`);

        // Get provider
        const provider = LLMProviderRegistry.getProvider(config.provider);
        if (!provider) {
          throw new Error(`Provider ${config.provider} not found in registry`);
        }

        const llmMessages = AgentRunner.convertToLLMMessages(messages);

        // Sanitize messages for model capabilities
        let isVisionForMainCall = false;
        if (typeof config.getVisionCapability === 'function') {
          try {
            const res = await config.getVisionCapability(modelName);
            isVisionForMainCall = typeof res === 'boolean' ? res : false;
          } catch {
            isVisionForMainCall = false;
          }
        }
        const sanitizedForMainCall = sanitizeMessagesForModel(llmMessages, {
          visionCapable: isVisionForMainCall,
          placeholderForImageOnly: true,
        });

        // Add system prompt as first message
        const messagesWithSystem: LLMMessage[] = [
          { role: 'system', content: currentSystemPrompt },
          ...sanitizedForMainCall,
        ];

        llmResponse = await provider.callWithMessages(modelName, messagesWithSystem, {
          tools: toolSchemas,
          temperature: temperature ?? 0,
        });
      } catch (error: any) {
        logger.error(`${agentName} LLM call failed:`, error);
        const errorMsg = `LLM call failed: ${error.message || String(error)}`;

        // Add system error message
        const systemErrorMessage: ToolResultMessage = {
          entity: ChatMessageEntity.TOOL_RESULT,
          toolName: 'system_error',
          resultText: errorMsg,
          isError: true,
          error: errorMsg,
        };
        messages.push(systemErrorMessage);

        // Generate error summary
        const errorSummary = await this.summarizeAgentProgress(
          messages,
          maxIterations,
          agentName,
          modelName,
          'error',
          config.provider,
          config.getVisionCapability
        );

        agentSession.status = 'error';
        agentSession.endTime = new Date();
        agentSession.terminationReason = 'error';

        if (AgentRunner.eventBus) {
          AgentRunner.eventBus.emitProgress({
            type: 'session_completed',
            sessionId: agentSession.sessionId,
            parentSessionId: agentSession.parentSessionId,
            agentName,
            timestamp: new Date(),
            data: { session: agentSession, reason: 'error' },
          });
        }

        const result = createErrorResult(errorMsg, messages, 'error');
        result.summary = {
          type: 'error',
          content: errorSummary,
        };

        if (afterExecute) {
          try {
            await afterExecute(result, agentSession);
          } catch (error) {
            logger.warn(`afterExecute hook failed for ${agentName}:`, error);
          }
        }

        return { ...result, agentSession };
      }

      // Parse LLM response
      const parsedAction = LLMResponseParser.parseResponse(llmResponse);

      // Process parsed action
      try {
        let newModelMessage: ModelChatMessage;

        if (parsedAction.type === 'tool_call') {
          const { name: toolName, args: toolArgs } = parsedAction;
          const toolCallId = crypto.randomUUID();

          newModelMessage = {
            entity: ChatMessageEntity.MODEL,
            action: 'tool',
            toolName,
            toolArgs,
            toolCallId,
            isFinalAnswer: false,
            reasoning: llmResponse.reasoning?.summary,
          };
          messages.push(newModelMessage);

          // Add tool call to session
          addSessionMessage({
            type: 'tool_call',
            content: {
              type: 'tool_call',
              toolName,
              toolArgs,
              toolCallId,
              reasoning: Array.isArray(llmResponse.reasoning?.summary)
                ? llmResponse.reasoning.summary.join(' ')
                : llmResponse.reasoning?.summary || undefined,
            },
          });
          logger.info(`${agentName} LLM requested tool: ${toolName}`);

          // Execute tool
          const toolToExecute = toolMap.get(toolName);
          if (!toolToExecute) {
            const result = errorHandler.handleUnknownTool(toolName, toolCallId);
            if (result.shouldContinue && result.errorMessage) {
              messages.push(result.errorMessage);
              if (result.sessionMessage) {
                addSessionMessage(result.sessionMessage);
              }
              continue;
            }
            continue;
          }

          let toolResultText: string = '';
          let toolIsError = false;
          let toolResultData: any = null;
          let imageData: string | undefined;

          // Check if it's a handoff tool call
          if (toolName.startsWith('handoff_to_') && 'config' in toolToExecute) {
            const targetAgentTool = toolToExecute as ConfigurableAgentTool;
            const handoffConfig = executingAgent?.config.handoffs?.find(
              (h: HandoffConfig) =>
                h.targetAgentName === targetAgentTool.name && (!h.trigger || h.trigger === 'llm_tool_call')
            );

            if (!handoffConfig) {
              throw new Error(`Internal error: No matching 'llm_tool_call' handoff config found for ${toolName}`);
            }

            // Add handoff message to session
            const nestedSessionId = crypto.randomUUID();
            addSessionMessage({
              type: 'handoff',
              content: {
                type: 'handoff',
                targetAgent: targetAgentTool.name,
                reason: `Handing off to ${targetAgentTool.name}`,
                context: toolArgs as Record<string, any>,
                nestedSessionId,
              },
            });

            // Execute handoff
            const handoffResult = await AgentRunner.executeHandoff(
              messages,
              toolArgs as ConfigurableAgentArgs,
              handoffConfig,
              executingAgent!,
              apiKey,
              modelName,
              maxIterations,
              temperature ?? 0,
              createSuccessResult,
              createErrorResult,
              toolArgs as ConfigurableAgentArgs,
              currentSession,
              config.provider,
              config.getVisionCapability,
              config.miniModel,
              config.nanoModel,
              { sessionId: nestedSessionId, parentSessionId: currentSession.sessionId }
            );

            // Complete current session
            agentSession.status = 'completed';
            agentSession.endTime = new Date();
            agentSession.terminationReason = 'handed_off';

            if (AgentRunner.eventBus) {
              AgentRunner.eventBus.emitProgress({
                type: 'session_completed',
                sessionId: agentSession.sessionId,
                parentSessionId: agentSession.parentSessionId,
                agentName,
                timestamp: new Date(),
                data: { session: agentSession, reason: 'handed_off' },
              });
            }

            return { ...handoffResult, agentSession };
          } else {
            // Regular tool execution
            // Pre-allocate child session for agent tools
            let preallocatedChildId: string | undefined;
            if ('config' in toolToExecute) {
              preallocatedChildId = crypto.randomUUID();
              const childPlaceholder: AgentSession = {
                sessionId: preallocatedChildId,
                agentName: toolName,
                parentSessionId: currentSession.sessionId,
                status: 'running',
                startTime: new Date(),
                messages: [],
                nestedSessions: [],
                tools: [],
              };
              currentSession.nestedSessions.push(childPlaceholder);
              addSessionMessage({
                type: 'handoff',
                content: {
                  type: 'handoff',
                  targetAgent: toolName,
                  reason: `Handing off to ${toolName}`,
                  context: toolArgs as Record<string, any>,
                  nestedSessionId: preallocatedChildId,
                },
              });

              if (AgentRunner.eventBus) {
                AgentRunner.eventBus.emitProgress({
                  type: 'child_agent_started',
                  sessionId: currentSession.sessionId,
                  parentSessionId: currentSession.parentSessionId,
                  agentName: currentSession.agentName,
                  timestamp: new Date(),
                  data: {
                    parentSession: currentSession,
                    childAgentName: toolName,
                    childSessionId: preallocatedChildId,
                  },
                });
              }
            }

            try {
              logger.info(`${agentName} Executing tool: ${toolToExecute.name}`);
              toolResultData = await toolToExecute.execute(toolArgs as any, {
                apiKey: config.apiKey,
                provider: config.provider,
                model: modelName,
                miniModel: config.miniModel,
                nanoModel: config.nanoModel,
                getVisionCapability: config.getVisionCapability,
                abortSignal: abortSignal,
                overrideSessionId: preallocatedChildId,
                overrideParentSessionId: currentSession.sessionId,
              } as any);

              // Replace placeholder with actual session for agent tools
              if ('config' in toolToExecute && toolResultData?.agentSession) {
                const index = currentSession.nestedSessions.findIndex((s) => s.sessionId === preallocatedChildId);
                if (index !== -1) {
                  try {
                    (toolResultData.agentSession as any).parentSessionId = currentSession.sessionId;
                  } catch {}
                  currentSession.nestedSessions[index] = toolResultData.agentSession;
                }
              }

              // Extract image data if present
              if (typeof toolResultData === 'object' && toolResultData !== null) {
                imageData = toolResultData.imageData;
              }

              // Handle ConfigurableAgentResult
              if (
                typeof toolResultData === 'object' &&
                toolResultData !== null &&
                'success' in toolResultData &&
                ('output' in toolResultData || 'error' in toolResultData)
              ) {
                toolResultText = toolResultData.success
                  ? toolResultData.output || 'Agent completed successfully'
                  : toolResultData.error || 'Agent failed';
              } else {
                toolResultText = AgentRunner.computeToolResultText(toolResultData, imageData);
              }

              // Check if result indicates error
              if (typeof toolResultData === 'object' && toolResultData !== null) {
                if (toolResultData.hasOwnProperty('error') && !!toolResultData.error) {
                  toolIsError = true;
                  toolResultText = toolResultData.error || toolResultText;
                } else if (toolResultData.hasOwnProperty('success') && toolResultData.success === false) {
                  toolIsError = true;
                  toolResultText = toolResultData.error || toolResultData.message || toolResultText;
                }
              }
            } catch (err: any) {
              logger.error(`${agentName} Error executing tool ${toolToExecute.name}:`, err);
              toolResultText = `Error during tool execution: ${err.message || String(err)}`;
              toolIsError = true;
              toolResultData = { error: toolResultText };
            }
          }

          // Add tool result message
          const toolResultMessage: ToolResultMessage = {
            entity: ChatMessageEntity.TOOL_RESULT,
            toolName,
            resultText: toolResultText,
            isError: toolIsError,
            toolCallId,
            ...(toolIsError && { error: toolResultText }),
            ...(toolResultData && { resultData: toolResultData }),
            ...(imageData && { imageData: imageData }),
          };

          // Extract structured summary if from ConfigurableAgentResult
          if (
            typeof toolResultData === 'object' &&
            toolResultData !== null &&
            'success' in toolResultData &&
            toolResultData.summary
          ) {
            toolResultMessage.summary = toolResultData.summary.content;
          }

          messages.push(toolResultMessage);

          // Add tool result to session
          addSessionMessage({
            type: 'tool_result',
            content: {
              type: 'tool_result',
              toolCallId,
              toolName,
              success: !toolIsError,
              result: toolResultData,
              error: toolIsError ? toolResultText : undefined,
            },
          });
          logger.info(`${agentName} Tool ${toolName} execution result added. Error: ${toolIsError}`);
        } else if (parsedAction.type === 'final_answer') {
          const { answer } = parsedAction;
          newModelMessage = {
            entity: ChatMessageEntity.MODEL,
            action: 'final',
            answer,
            isFinalAnswer: true,
            reasoning: llmResponse.reasoning?.summary,
          };
          messages.push(newModelMessage);

          // Add final answer to session
          addSessionMessage({
            type: 'final_answer',
            content: {
              type: 'final_answer',
              answer,
              summary: Array.isArray(llmResponse.reasoning?.summary)
                ? llmResponse.reasoning.summary.join(' ')
                : llmResponse.reasoning?.summary || undefined,
            },
          });

          logger.info(`${agentName} LLM provided final answer.`);

          // Generate summary if configured
          let finalAnswer = answer;
          if (executingAgent?.config?.includeSummaryInAnswer === true) {
            logger.info(`Generating summary for ${agentName} (includeSummaryInAnswer=true)`);
            const completionSummary = await this.summarizeAgentProgress(
              messages,
              maxIterations,
              agentName,
              modelName,
              'final_answer',
              config.provider,
              config.getVisionCapability
            );
            finalAnswer = `${answer}\n\n---\n\n### Analysis of Agentic Conversation\n\n${completionSummary}`;
          } else {
            logger.info(`Skipping summary for ${agentName} (includeSummaryInAnswer not enabled)`);
          }

          // Complete session
          agentSession.status = 'completed';
          agentSession.endTime = new Date();
          agentSession.terminationReason = 'final_answer';

          if (AgentRunner.eventBus) {
            AgentRunner.eventBus.emitProgress({
              type: 'session_completed',
              sessionId: agentSession.sessionId,
              parentSessionId: agentSession.parentSessionId,
              agentName,
              timestamp: new Date(),
              data: { session: agentSession, reason: 'final_answer' },
            });
          }

          const result = createSuccessResult(finalAnswer, messages, 'final_answer');

          if (afterExecute) {
            try {
              await afterExecute(result, agentSession);
            } catch (error) {
              logger.warn(`afterExecute hook failed for ${agentName}:`, error);
            }
          }

          return { ...result, agentSession };
        } else if (parsedAction.type === 'error') {
          const result = errorHandler.handleParsingError(parsedAction.error);
          if (result.shouldContinue && result.errorMessage) {
            messages.push(result.errorMessage);
            if (result.sessionMessage) {
              addSessionMessage(result.sessionMessage);
            }
            continue;
          }
        } else {
          throw new Error(`Unknown parsed action type: ${(parsedAction as any).type}`);
        }
      } catch (error: any) {
        logger.error(`${agentName} Error processing LLM response or executing tool:`, error);
        const errorMsg = `Agent loop error: ${error.message || String(error)}`;
        const systemErrorMessage: ToolResultMessage = {
          entity: ChatMessageEntity.TOOL_RESULT,
          toolName: 'system_error',
          resultText: errorMsg,
          isError: true,
          error: errorMsg,
        };
        messages.push(systemErrorMessage);

        const errorSummary = await this.summarizeAgentProgress(
          messages,
          maxIterations,
          agentName,
          modelName,
          'error',
          config.provider,
          config.getVisionCapability
        );

        agentSession.status = 'error';
        agentSession.endTime = new Date();
        agentSession.terminationReason = 'error';

        if (AgentRunner.eventBus) {
          AgentRunner.eventBus.emitProgress({
            type: 'session_completed',
            sessionId: agentSession.sessionId,
            parentSessionId: agentSession.parentSessionId,
            agentName,
            timestamp: new Date(),
            data: { session: agentSession, reason: 'error' },
          });
        }

        const result = createErrorResult(errorMsg, messages, 'error');
        result.summary = {
          type: 'error',
          content: errorSummary,
        };

        if (afterExecute) {
          try {
            await afterExecute(result, agentSession);
          } catch (error) {
            logger.warn(`afterExecute hook failed for ${agentName}:`, error);
          }
        }

        return { ...result, agentSession };
      }
    }

    // Max iterations reached - check for handoff
    logger.warn(`${agentName} Reached max iterations (${maxIterations}) without completion.`);

    if (executingAgent?.config.handoffs) {
      const maxIterHandoffConfig = executingAgent.config.handoffs.find((h: HandoffConfig) => h.trigger === 'max_iterations');

      if (maxIterHandoffConfig) {
        logger.info(
          `${agentName} Found 'max_iterations' handoff config. Initiating handoff to ${maxIterHandoffConfig.targetAgentName}.`
        );

        const handoffResult = await AgentRunner.executeHandoff(
          messages,
          args,
          maxIterHandoffConfig,
          executingAgent,
          apiKey,
          modelName,
          maxIterations,
          temperature ?? 0,
          createSuccessResult,
          createErrorResult,
          undefined,
          currentSession,
          config.provider,
          config.getVisionCapability,
          config.miniModel,
          config.nanoModel
        );
        const { agentSession: childSession, ...actualResult } = handoffResult;

        if (currentSession) {
          currentSession.nestedSessions.push(childSession);
        }

        agentSession.status = 'completed';
        agentSession.endTime = new Date();
        agentSession.terminationReason = 'handed_off';

        if (AgentRunner.eventBus) {
          AgentRunner.eventBus.emitProgress({
            type: 'session_completed',
            sessionId: agentSession.sessionId,
            parentSessionId: agentSession.parentSessionId,
            agentName,
            timestamp: new Date(),
            data: { session: agentSession, reason: 'handed_off' },
          });
        }

        return { ...actualResult, agentSession };
      }
    }

    // No handoff configured, return error
    logger.warn(`${agentName} No 'max_iterations' handoff configured. Returning error.`);

    agentSession.status = 'error';
    agentSession.endTime = new Date();
    agentSession.terminationReason = 'max_iterations';

    if (AgentRunner.eventBus) {
      AgentRunner.eventBus.emitProgress({
        type: 'session_completed',
        sessionId: agentSession.sessionId,
        parentSessionId: agentSession.parentSessionId,
        agentName,
        timestamp: new Date(),
        data: { session: agentSession, reason: 'max_iterations' },
      });
    }

    const progressSummary = await this.summarizeAgentProgress(
      messages,
      maxIterations,
      agentName,
      modelName,
      'max_iterations',
      config.provider,
      config.getVisionCapability
    );

    const result = createErrorResult('Agent reached maximum iterations', messages, 'max_iterations');
    result.summary = {
      type: 'timeout',
      content: progressSummary,
    };

    if (afterExecute) {
      try {
        await afterExecute(result, agentSession);
      } catch (error) {
        logger.warn(`afterExecute hook failed for ${agentName}:`, error);
      }
    }

    return { ...result, agentSession };
  }

  /**
   * Generate a summary of agent progress using LLM
   */
  private static async summarizeAgentProgress(
    messages: ChatMessage[],
    maxIterations: number,
    agentName: string,
    modelName: string,
    completionType: 'final_answer' | 'max_iterations' | 'error' = 'max_iterations',
    provider: LLMProvider,
    getVisionCapability?: (modelName: string) => Promise<boolean> | boolean
  ): Promise<string> {
    logger.info(`Generating summary for agent "${agentName}" with completion type: ${completionType}`);
    try {
      const llmMessages = this.convertToLLMMessages(messages);

      // Add system message
      llmMessages.unshift({
        role: 'system',
        content: `You are an expert AI agent analyzer specializing in understanding multi-agent workflows and execution patterns. Your task is to analyze agent conversations and generate actionable summaries.`,
      });

      // Generate completion-specific summary prompt
      let summaryPrompt: string;
      switch (completionType) {
        case 'final_answer':
          summaryPrompt = `Please analyze the entire conversation above and provide a concise summary that includes:

1. **User Request**: What the user originally asked for
2. **Agent Decisions**: Key decisions and actions the agent took to accomplish the task
3. **Final Outcome**: What the agent accomplished`;
          break;

        case 'error':
          summaryPrompt = `1. **User Request**: What the user originally asked for
2. **Agent Decisions**: Key decisions and actions the agent took before the error
3. **Error Context**: What the agent was attempting when the error occurred`;
          break;

        case 'max_iterations':
        default:
          summaryPrompt = `The agent "${agentName}" has reached its maximum iteration limit of ${maxIterations}.

Please analyze the entire conversation above and provide a COMPREHENSIVE summary that includes:

1. **User Request**: What the user originally asked for
2. **Agent Decisions**: Key decisions and actions taken
3. **Progress Assessment**: Whether meaningful progress was made
4. **Recommendations**: Specific next steps to continue this work`;
          break;
      }

      llmMessages.push({
        role: 'user',
        content: summaryPrompt,
      });

      const selectedProvider = LLMProviderRegistry.getProvider(provider);
      if (!selectedProvider) {
        throw new Error(`Provider ${provider} not found in registry`);
      }

      // Sanitize messages for vision capability
      let isVision = false;
      if (typeof getVisionCapability === 'function') {
        try {
          const res = await getVisionCapability(modelName);
          isVision = typeof res === 'boolean' ? res : false;
        } catch {
          isVision = false;
        }
      }
      const sanitizedMessages = sanitizeMessagesForModel(llmMessages, {
        visionCapable: isVision,
        placeholderForImageOnly: true,
      });

      const response = await selectedProvider.callWithMessages(modelName, sanitizedMessages, {
        temperature: 0.1,
      });

      logger.info(`Generated summary for agent "${agentName}":`, response.text || 'No summary generated.');
      return response.text || 'No summary generated.';
    } catch (error) {
      logger.error('Failed to generate agent progress summary:', error);
      return `Agent ${agentName} reached maximum iterations (${maxIterations}). Summary generation failed.`;
    }
  }
}
