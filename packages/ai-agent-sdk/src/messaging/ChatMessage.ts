// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Shared chat message types for agent communication.
 * Platform-agnostic message structures.
 */

/**
 * Define possible entities for chat messages
 */
export enum ChatMessageEntity {
  USER = 'user',
  MODEL = 'model',
  TOOL_RESULT = 'tool_result',
  AGENT_SESSION = 'agent_session',
}

/**
 * Base structure for all chat messages
 */
export interface BaseChatMessage {
  entity: ChatMessageEntity;
  error?: string;
  // If managed by an AgentSession, provide the session id for traceability
  managedByAgentSessionId?: string;
}

/**
 * Image input used by user messages
 */
export interface ImageInputData {
  url: string;
  bytesBase64: string;
}

/**
 * User message
 */
export interface UserChatMessage extends BaseChatMessage {
  entity: ChatMessageEntity.USER;
  text: string;
  imageInput?: ImageInputData;
}

/**
 * Model message
 */
export interface ModelChatMessage extends BaseChatMessage {
  entity: ChatMessageEntity.MODEL;
  action: 'tool' | 'final';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  answer?: string;
  isFinalAnswer: boolean;
  reasoning?: string[] | null;
  toolCallId?: string;
}

/**
 * Tool result message
 */
export interface ToolResultMessage extends BaseChatMessage {
  entity: ChatMessageEntity.TOOL_RESULT;
  toolName: string;
  resultText: string;
  isError: boolean;
  resultData?: unknown;
  toolCallId?: string;
  isFromConfigurableAgent?: boolean;
  imageData?: string;
  summary?: string;
}

/**
 * Agent session message (lightweight reference)
 */
export interface AgentSessionMessage extends BaseChatMessage {
  entity: ChatMessageEntity.AGENT_SESSION;
  // Use `any` to avoid tight coupling; specific implementations can use precise types
  agentSession: any;
  triggerMessageId?: string;
  summary?: string;
}

/**
 * Union type for all chat messages
 */
export type ChatMessage =
  | UserChatMessage
  | ModelChatMessage
  | ToolResultMessage
  | AgentSessionMessage;

/**
 * Helper to create user messages
 */
export function createUserMessage(text: string, imageInput?: ImageInputData): UserChatMessage {
  return {
    entity: ChatMessageEntity.USER,
    text,
    imageInput,
  };
}

/**
 * Helper to create model messages
 */
export function createModelMessage(
  action: 'tool' | 'final',
  options: {
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    answer?: string;
    reasoning?: string[] | null;
    toolCallId?: string;
  }
): ModelChatMessage {
  return {
    entity: ChatMessageEntity.MODEL,
    action,
    isFinalAnswer: action === 'final',
    ...options,
  };
}

/**
 * Helper to create tool result messages
 */
export function createToolResultMessage(
  toolName: string,
  resultText: string,
  isError: boolean = false,
  options?: {
    resultData?: unknown;
    toolCallId?: string;
    isFromConfigurableAgent?: boolean;
    imageData?: string;
    summary?: string;
  }
): ToolResultMessage {
  return {
    entity: ChatMessageEntity.TOOL_RESULT,
    toolName,
    resultText,
    isError,
    ...options,
  };
}
