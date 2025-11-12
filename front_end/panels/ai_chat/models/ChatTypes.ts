// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Browser Operator Chat Types
 *
 * This file extends the AI Agent SDK's base messaging types with
 * UI-specific properties and state management for the Browser Operator frontend.
 */

import {
  ChatMessageEntity as SDKChatMessageEntity,
  type BaseChatMessage as SDKBaseChatMessage,
  type UserChatMessage as SDKUserChatMessage,
  type ModelChatMessage as SDKModelChatMessage,
  type ToolResultMessage as SDKToolResultMessage,
  type AgentSessionMessage as SDKAgentSessionMessage,
  type ChatMessage as SDKChatMessage,
  type ImageInputData as SDKImageInputData,
} from '../../../packages/ai-agent-sdk/src/index.js';

// Re-export ChatMessageEntity from SDK
export const ChatMessageEntity = SDKChatMessageEntity;
export type { ChatMessageEntity };

// UI-specific types
export type UILane = 'chat' | 'agent';

// Base structure for Browser Operator chat messages (extends SDK with UI properties)
export interface BaseChatMessage extends SDKBaseChatMessage {
  // UI routing hint: which lane should render this message
  uiLane?: UILane;
}

// Re-export ImageInputData from SDK
export type ImageInputData = SDKImageInputData;

// User message (extends SDK type with UI properties)
export interface UserChatMessage extends BaseChatMessage {
  entity: typeof ChatMessageEntity.USER;
  text: string;
  imageInput?: ImageInputData;
}

// Model message (extends SDK type with UI properties)
export interface ModelChatMessage extends BaseChatMessage {
  entity: typeof ChatMessageEntity.MODEL;
  action: 'tool' | 'final';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  answer?: string;
  isFinalAnswer: boolean;
  reasoning?: string[] | null;
  toolCallId?: string;
}

// Tool result message (extends SDK type with UI properties)
export interface ToolResultMessage extends BaseChatMessage {
  entity: typeof ChatMessageEntity.TOOL_RESULT;
  toolName: string;
  resultText: string;
  isError: boolean;
  resultData?: unknown;
  toolCallId?: string;
  isFromConfigurableAgent?: boolean;
  imageData?: string;
  summary?: string;
}

// Agent session message (extends SDK type with UI properties)
export interface AgentSessionMessage extends BaseChatMessage {
  entity: typeof ChatMessageEntity.AGENT_SESSION;
  // Use `any` to avoid tight coupling here; UI components import the precise type.
  agentSession: any;
  triggerMessageId?: string;
  summary?: string;
}

// Union type for all chat messages in Browser Operator
export type ChatMessage =
    UserChatMessage|ModelChatMessage|ToolResultMessage|AgentSessionMessage;

// View state for the chat container (UI-specific, not in SDK)
export enum State {
  IDLE = 'idle',
  LOADING = 'loading',
  ERROR = 'error',
}
