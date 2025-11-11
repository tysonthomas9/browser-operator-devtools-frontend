// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../observability/Logger.js';
import { ChatMessageEntity, type ChatMessage, type ToolResultMessage } from '../messaging/ChatMessage.js';
import type { AgentSession, AgentMessage } from '../messaging/AgentSession.js';

const logger = createLogger('AgentErrorHandler');

/**
 * Configuration for error handling behavior
 */
export interface ErrorHandlingConfig {
  /** Whether to continue execution after errors (true) or terminate (false) */
  continueOnError: boolean;
  /** Agent name for logging purposes */
  agentName: string;
  /** Available tools to suggest in error messages */
  availableTools?: string[];
  /** Session to add error messages to */
  session?: AgentSession;
}

/**
 * Result of error handling
 */
export interface ErrorHandlingResult {
  /** Whether the error handler created a recovery message */
  shouldContinue: boolean;
  /** Error message created for the conversation */
  errorMessage?: ChatMessage;
  /** Error message for session tracking */
  sessionMessage?: Partial<AgentMessage>;
}

/**
 * Configuration for LLM retry behavior
 */
export interface LLMRetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Result of LLM call with retry
 */
export interface LLMRetryResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  attemptsMade: number;
}

/**
 * Centralized utility for handling agent-level errors across the agent framework
 */
export class AgentErrorHandler {
  private config: ErrorHandlingConfig;

  constructor(config: ErrorHandlingConfig) {
    this.config = config;
  }

  /**
   * Create an error handler with the given configuration
   */
  static createErrorHandler(config: ErrorHandlingConfig): AgentErrorHandler {
    return new AgentErrorHandler(config);
  }

  /**
   * Handle unknown tool requests gracefully
   */
  handleUnknownTool(toolName: string, toolCallId: string): ErrorHandlingResult {
    const { agentName, availableTools = [], continueOnError } = this.config;

    logger.warn(`${agentName} requested unknown tool: ${toolName}`);

    if (!continueOnError) {
      return {
        shouldContinue: false,
        errorMessage: undefined,
        sessionMessage: undefined,
      };
    }

    // Create helpful error message for the conversation
    const availableToolsList =
      availableTools.length > 0 ? `Available tools: ${availableTools.join(', ')}` : 'No tools are currently available';

    const errorMessage: ToolResultMessage = {
      entity: ChatMessageEntity.TOOL_RESULT,
      toolName,
      resultText: `Error: Tool "${toolName}" is not available. ${availableToolsList}`,
      isError: true,
      toolCallId,
      error: `Unknown tool: ${toolName}`,
    };

    // Create session message for tracking
    const sessionMessage: Partial<AgentMessage> = {
      type: 'tool_result',
      content: {
        type: 'tool_result',
        toolCallId,
        toolName,
        success: false,
        result: null,
        error: `Unknown tool: ${toolName}`,
      },
    };

    logger.info(`${agentName} Added unknown tool error to conversation, will continue execution`);

    return {
      shouldContinue: true,
      errorMessage,
      sessionMessage,
    };
  }

  /**
   * Handle LLM response parsing errors gracefully
   */
  handleParsingError(error: string): ErrorHandlingResult {
    const { agentName, continueOnError } = this.config;

    logger.warn(`${agentName} LLM response parsing error: ${error}`);

    if (!continueOnError) {
      return {
        shouldContinue: false,
        errorMessage: undefined,
        sessionMessage: undefined,
      };
    }

    // Create user message explaining the error for the next LLM call
    const errorMessage: ChatMessage = {
      entity: ChatMessageEntity.USER,
      text: `Your previous response could not be parsed: ${error}. Please provide a valid response by either calling one of the available tools or providing a final answer.`,
    };

    // Create session message for tracking
    const sessionMessage: Partial<AgentMessage> = {
      type: 'reasoning',
      content: {
        type: 'reasoning',
        text: `LLM response parsing failed: ${error}. Requesting retry.`,
      },
    };

    logger.info(`${agentName} Added parsing error to conversation, will continue execution`);

    return {
      shouldContinue: true,
      errorMessage,
      sessionMessage,
    };
  }
}
