// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Tool } from '../tools/Tools.js';
import { OpenAIClient, OpenAIResponse } from '../core/OpenAIClient.js';
import { ChatMessage, ChatMessageEntity, ModelChatMessage, ToolResultMessage } from '../ui/ChatView.js';
import { ChatPromptFormatter } from '../core/Graph.js';
import { enhancePromptWithPageContext } from '../core/PageInfoManager.js';
import { ConfigurableAgentArgs, ConfigurableAgentResult, AgentRunTerminationReason, ConfigurableAgentTool, ToolRegistry, HandoffConfig, HandoffTrigger /*, HandoffContextTransform, ContextFilterRegistry*/ } from './ConfigurableAgentTool.js';

/**
 * Configuration for the AgentRunner
 */
export interface AgentRunnerConfig {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  tools: Tool<any, any>[];
  maxIterations: number;
  temperature?: number;
}

/**
 * Hooks for customizing AgentRunner behavior
 */
export interface AgentRunnerHooks {
  /** Function to potentially modify messages before the first LLM call */
  prepareInitialMessages?: (messages: ChatMessage[]) => ChatMessage[];
  /** Function to create a success result */
  createSuccessResult: (output: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason) => ConfigurableAgentResult;
  /** Function to create an error result */
  createErrorResult: (error: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason) => ConfigurableAgentResult;
}

/**
 * Type guard for checking if an object is a ConfigurableAgentResult
 */
function isConfigurableAgentResult(obj: any): obj is ConfigurableAgentResult {
  return typeof obj === 'object' && obj !== null && typeof obj.success === 'boolean';
}

/**
 * Runs the core agent execution loop
 */
export class AgentRunner {
  // Helper function to execute the handoff logic (to avoid duplication)
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
    llmToolArgs?: ConfigurableAgentArgs // Specific args if triggered by LLM tool call
  ): Promise<ConfigurableAgentResult> {
    const targetAgentName = handoffConfig.targetAgentName;
    const targetAgentTool = ToolRegistry.getRegisteredTool(targetAgentName);

    if (!(targetAgentTool instanceof ConfigurableAgentTool)) {
      const errorMsg = `Handoff target '${targetAgentName}' not found or is not a ConfigurableAgentTool.`;
      console.error(`[AgentRunner] ${errorMsg}`);
      // Use the default error creator from the initiating agent's context
      return defaultCreateErrorResult(errorMsg, currentMessages, 'error');
    }

    console.log(`[AgentRunner] Initiating handoff from ${executingAgent.name} to ${targetAgentTool.name} (Trigger: ${handoffConfig.trigger || 'llm_tool_call'})`);

    let handoffMessages: ChatMessage[] = []; // Initialize handoff messages
    const targetConfig = targetAgentTool.config;

    // Collect specified tool results
    const collectedToolResultMessages: ToolResultMessage[] = [];
    if (handoffConfig.includeToolResults && handoffConfig.includeToolResults.length > 0) {
      for (const message of currentMessages) {
        if (message.entity === ChatMessageEntity.TOOL_RESULT) {
          const toolResult = message as ToolResultMessage;
          if (!toolResult.isError && toolResult.toolName && handoffConfig.includeToolResults.includes(toolResult.toolName)) {
            collectedToolResultMessages.push(toolResult);
          }
        }
      }
    }

    // Determine the messages to hand off based on includeToolResults
    if (handoffConfig.includeToolResults && handoffConfig.includeToolResults.length > 0) {
      // Filter messages: original query + specified tool results
      console.log(`[AgentRunner] Filtering messages for handoff to ${targetAgentTool.name} based on includeToolResults.`);
      const firstUserMessage = currentMessages.find(m => m.entity === ChatMessageEntity.USER);
      if (firstUserMessage) {
        handoffMessages.push(firstUserMessage);
      }
      handoffMessages.push(...collectedToolResultMessages);
    } else {
      // No filter specified: pass the entire message history
      console.log(`[AgentRunner] Passing full message history for handoff to ${targetAgentTool.name}.`);
      handoffMessages = [...currentMessages];
    }

    // Enhance the target agent's system prompt with page context
    const enhancedSystemPrompt = await enhancePromptWithPageContext(targetConfig.systemPrompt);
    
    // Construct Runner Config & Hooks for the target agent
    const targetRunnerConfig: AgentRunnerConfig = {
      apiKey: apiKey,
      modelName: targetConfig.modelName || defaultModelName,
      systemPrompt: enhancedSystemPrompt,
      tools: targetConfig.tools
              .map(toolName => ToolRegistry.getRegisteredTool(toolName))
              .filter((tool): tool is Tool<any, any> => tool !== null),
      maxIterations: targetConfig.maxIterations || defaultMaxIterations,
      temperature: targetConfig.temperature ?? defaultTemperature,
    };
    const targetRunnerHooks: AgentRunnerHooks = {
      prepareInitialMessages: undefined, // History already formed by transform or passthrough
      createSuccessResult: targetConfig.createSuccessResult
          ? (out, steps, reason) => targetConfig.createSuccessResult!(out, steps, reason, targetConfig)
          : defaultCreateSuccessResult, // Fallback to original runner's hook creator
      createErrorResult: targetConfig.createErrorResult
          ? (err, steps, reason) => targetConfig.createErrorResult!(err, steps, reason, targetConfig)
          : defaultCreateErrorResult, // Fallback to original runner's hook creator
    };

    // Determine args for the target agent: use llmToolArgs if provided, otherwise originalArgs
    const targetAgentArgs = llmToolArgs ?? originalArgs;

    console.log(`[AgentRunner] Executing handoff target agent: ${targetAgentTool.name} with ${handoffMessages.length} messages.`);
    const handoffResult = await AgentRunner.run(
        handoffMessages,
        targetAgentArgs, // Use determined args
        targetRunnerConfig, // Pass the constructed config
        targetRunnerHooks,  // Pass the constructed hooks
        targetAgentTool // Target agent is now the executing agent
    );

    console.log(`[AgentRunner] Handoff target agent ${targetAgentTool.name} finished. Result success: ${handoffResult.success}`);

    // Check if the target agent is configured to *include* intermediate steps
    if (targetAgentTool instanceof ConfigurableAgentTool && targetAgentTool.config.includeIntermediateStepsOnReturn === true) {
      // Combine message history if the target agent requests it
      console.log(`[AgentRunner] Including intermediateSteps from ${targetAgentTool.name} based on its config.`);
      const combinedIntermediateSteps = [
          ...currentMessages, // History *before* the recursive call
          ...(handoffResult.intermediateSteps || []) // History *from* the recursive call (should exist if flag is true)
      ];
      // Return the result from the target agent, but with combined history
      return {
          ...handoffResult,
          intermediateSteps: combinedIntermediateSteps,
          terminationReason: handoffResult.terminationReason || 'handed_off',
      };
    } else {
      // Otherwise (default), omit the target's intermediate steps
      console.log(`[AgentRunner] Omitting intermediateSteps from ${targetAgentTool.name} based on its config (default or flag set to false).`);
      // Return result from target, ensuring intermediateSteps are omitted
      const finalResult = {
        ...handoffResult,
        terminationReason: handoffResult.terminationReason || 'handed_off',
      };
      // Explicitly delete intermediateSteps if they somehow exist on handoffResult (shouldn't due to target config)
      delete finalResult.intermediateSteps; 
      return finalResult;
    }
  }

  public static async run(
    initialMessages: ChatMessage[],
    args: ConfigurableAgentArgs,
    config: AgentRunnerConfig,
    hooks: AgentRunnerHooks,
    executingAgent: ConfigurableAgentTool | null
  ): Promise<ConfigurableAgentResult> {
    const agentName = executingAgent?.name || 'Unknown';
    console.log(`[AgentRunner] Starting execution loop for agent: ${agentName}`);
    const { apiKey, modelName, systemPrompt, tools, maxIterations, temperature } = config;
    const { prepareInitialMessages, createSuccessResult, createErrorResult } = hooks;

    let messages = [...initialMessages];

    // Prepare initial messages if hook provided
    if (prepareInitialMessages) {
      messages = prepareInitialMessages(messages);
    }

    const toolMap = new Map(tools.map(tool => [tool.name, tool]));
    const toolSchemas = tools.map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }));

    // Add handoff tools based on the executing agent's config
    if (executingAgent && executingAgent.config.handoffs) {
        // Iterate over the configured handoffs
        for (const handoffConfig of executingAgent.config.handoffs) {
            // Only add handoffs triggered by LLM tool calls to the schema
            if (!handoffConfig.trigger || handoffConfig.trigger === 'llm_tool_call') {
                const targetAgentName = handoffConfig.targetAgentName;
                const targetTool = ToolRegistry.getRegisteredTool(targetAgentName);
                if (targetTool instanceof ConfigurableAgentTool) {
                    const handoffToolName = `handoff_to_${targetAgentName}`;
                    toolSchemas.push({
                      type: 'function',
                      name: handoffToolName,
                      description: `Handoff the current task to the specialized agent: ${targetAgentName}. Use this agent when the task requires ${targetAgentName}'s capabilities. Agent Description: ${targetTool.description}`,
                      parameters: targetTool.schema // Use target agent's input schema
                    });
                     // Add a mapping for the handoff tool 'name' to the actual target tool instance
                     // This allows us to find the target agent later when this tool is called.
                    toolMap.set(handoffToolName, targetTool);
                    console.log(`[AgentRunner] Added LLM handoff tool schema: ${handoffToolName}`);
                } else {
                  console.warn(`[AgentRunner] Configured LLM handoff target '${targetAgentName}' not found or is not a ConfigurableAgentTool.`);
                }
            }
        }
    }

    const promptFormatter = new ChatPromptFormatter();
    let iteration = 0; // Initialize iteration counter

    for (iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[AgentRunner] ${agentName} Iteration ${iteration + 1}/${maxIterations}`);
      
      // Prepare prompt and call LLM
      const iterationInfo = `
## Current Progress
- You are currently on step ${iteration + 1} of ${maxIterations} maximum steps.
- Focus on making meaningful progress with each step.`;

      // Enhance system prompt with iteration info and page context
      // This includes updating the accessibility tree inside enhancePromptWithPageContext
      const currentSystemPrompt = await enhancePromptWithPageContext(systemPrompt + iterationInfo);

      const promptText = promptFormatter.format({ messages });
      let openAIResponse: OpenAIResponse;
      try {
        console.log(`[AgentRunner] ${agentName} Calling LLM. Prompt size: ${promptText.length}`);
        openAIResponse = await OpenAIClient.callOpenAI(
          apiKey,
          modelName,
          promptText,
          {
            tools: toolSchemas,
            systemPrompt: currentSystemPrompt,
            temperature: temperature ?? 0,
          }
        );
      } catch (error: any) {
        console.error(`[AgentRunner] ${agentName} LLM call failed:`, error);
        const errorMsg = `LLM call failed: ${error.message || String(error)}`;
        // Add system error message to history
        const systemErrorMessage: ToolResultMessage = {
            entity: ChatMessageEntity.TOOL_RESULT,
            toolName: 'system_error',
            resultText: errorMsg,
            isError: true,
            error: errorMsg,
        };
        messages.push(systemErrorMessage);
        // Use error hook with 'error' reason
        return createErrorResult(errorMsg, messages, 'error');
      }

      // Parse LLM response
      const parsedAction = OpenAIClient.parseOpenAIResponse(openAIResponse);

      // Process parsed action
      try {
        let newModelMessage: ModelChatMessage;

        if (parsedAction.type === 'tool_call') {
          const { name: toolName, args: toolArgs } = parsedAction;
          newModelMessage = {
            entity: ChatMessageEntity.MODEL,
            action: 'tool',
            toolName: toolName,
            toolArgs: toolArgs,
            isFinalAnswer: false,
            reasoning: openAIResponse.reasoning?.summary,
          };
          messages.push(newModelMessage);
          console.log(`[AgentRunner] ${agentName} LLM requested tool: ${toolName}`);

          // Execute tool
          const toolToExecute = toolMap.get(toolName);
          if (!toolToExecute) {
            throw new Error(`Agent requested unknown tool: ${toolName}`);
          }

          let toolResultText: string;
          let toolIsError = false;
          let toolResultData: any = null;

          // *** Check if it's an LLM-triggered handoff tool call ***
          if (toolName.startsWith('handoff_to_') && toolToExecute instanceof ConfigurableAgentTool) {
              const targetAgentTool = toolToExecute; // Already resolved via toolMap
              // Find the corresponding handoff config (must be llm_tool_call trigger)
              const handoffConfig = executingAgent?.config.handoffs?.find(h =>
                  h.targetAgentName === targetAgentTool.name &&
                  (!h.trigger || h.trigger === 'llm_tool_call')
              );

              if (!handoffConfig) {
                  throw new Error(`Internal error: No matching 'llm_tool_call' handoff config found for ${toolName}`);
              }

              // Use the shared handoff execution logic, passing LLM's toolArgs
              const handoffResult = await AgentRunner.executeHandoff(
                  messages, // Pass current message history
                  toolArgs as ConfigurableAgentArgs, // <= LLM's toolArgs are the 'originalArgs' for this handoff context
                  handoffConfig,
                  executingAgent!, // executingAgent must exist if handoff config was found
                  apiKey, modelName, maxIterations, temperature ?? 0,
                  createSuccessResult, createErrorResult,
                  toolArgs as ConfigurableAgentArgs // <= Pass LLM's toolArgs explicitly as llmToolArgs
              );

              // LLM tool handoff replaces the current agent's execution entirely
              return handoffResult;

          } else if (!toolToExecute) { // Regular tool, but not found
              throw new Error(`Agent requested unknown tool: ${toolName}`);
          } else {
            // *** Regular tool execution ***
             try {
              console.log(`[AgentRunner] ${agentName} Executing tool: ${toolToExecute.name} with args:`, toolArgs);
              toolResultData = await toolToExecute.execute(toolArgs as any);
              toolResultText = typeof toolResultData === 'string' ? toolResultData : JSON.stringify(toolResultData, null, 2);

              // Check if the result object indicates an error explicitly
              if (typeof toolResultData === 'object' && toolResultData !== null) {
                 if (toolResultData.hasOwnProperty('error') && !!toolResultData.error) {
                    toolIsError = true;
                    // Use the error message from the result object if available
                    toolResultText = toolResultData.error || toolResultText;
                 } else if (toolResultData.hasOwnProperty('success') && toolResultData.success === false) {
                    toolIsError = true;
                     // Try to find an error message field, fallback to stringified object
                    toolResultText = toolResultData.error || toolResultData.message || toolResultText;
                 }
              }
             } catch (err: any) {
              console.error(`[AgentRunner] ${agentName} Error executing tool ${toolToExecute.name}:`, err);
              toolResultText = `Error during tool execution: ${err.message || String(err)}`;
              toolIsError = true;
              toolResultData = { error: toolResultText }; // Store error in data
             }
          }

          // Add tool result message
          const toolResultMessage: ToolResultMessage = {
            entity: ChatMessageEntity.TOOL_RESULT,
            toolName: toolName,
            resultText: toolResultText,
            isError: toolIsError,
            ...(toolIsError && { error: toolResultText }), // Include raw error message if error occurred
            ...(toolResultData && { resultData: toolResultData }) // Include structured result data
          };
          messages.push(toolResultMessage);
          console.log(`[AgentRunner] ${agentName} Tool ${toolName} execution result added. Error: ${toolIsError}`);

        } else if (parsedAction.type === 'final_answer') {
          const { answer } = parsedAction;
          newModelMessage = {
            entity: ChatMessageEntity.MODEL,
            action: 'final',
            answer: answer,
            isFinalAnswer: true,
            reasoning: openAIResponse.reasoning?.summary,
          };
          messages.push(newModelMessage);
          console.log(`[AgentRunner] ${agentName} LLM provided final answer.`);
          // Exit loop and return success with 'final_answer' reason
          return createSuccessResult(answer, messages, 'final_answer');

        } else {
          throw new Error(parsedAction.error);
        }

      } catch (error: any) {
        console.error(`[AgentRunner] ${agentName} Error processing LLM response or executing tool:`, error);
        const errorMsg = `Agent loop error: ${error.message || String(error)}`;
         // Add system error message to history
        const systemErrorMessage: ToolResultMessage = {
            entity: ChatMessageEntity.TOOL_RESULT,
            toolName: 'system_error',
            resultText: errorMsg,
            isError: true,
            error: errorMsg,
        };
        messages.push(systemErrorMessage);
        // Use error hook with 'error' reason
        return createErrorResult(errorMsg, messages, 'error');
      }
    }

    // Max iterations reached - Check for 'max_iterations' handoff trigger
    console.warn(`[AgentRunner] ${agentName} Reached max iterations (${maxIterations}) without completion.`);

    if (executingAgent && executingAgent.config.handoffs) {
        const maxIterHandoffConfig = executingAgent.config.handoffs.find(h => h.trigger === 'max_iterations');

        if (maxIterHandoffConfig) {
            console.log(`[AgentRunner] ${agentName} Found 'max_iterations' handoff config. Initiating handoff to ${maxIterHandoffConfig.targetAgentName}.`);

            // Use the shared handoff execution logic
            // Pass the original `args` received by *this* agent runner instance. No llmToolArgs here.
            const handoffResult = await AgentRunner.executeHandoff(
                messages, // Pass the final message history from the loop
                args,     // Pass the original args of the *current* agent as 'originalArgs'
                maxIterHandoffConfig,
                executingAgent,
                apiKey, modelName, maxIterations, temperature ?? 0,
                createSuccessResult, createErrorResult
            );
            return handoffResult; // Return the result from the handoff target
        }
    }

    // If no max_iterations handoff is configured, return the standard error
    console.warn(`[AgentRunner] ${agentName} No 'max_iterations' handoff configured. Returning error.`);
    return createErrorResult(`Agent reached maximum iterations (${maxIterations})`, messages, 'max_iterations');
  }
} 