// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {AgentState} from '../core/State.js';
import type {ChatMessage} from '../models/ChatTypes.js';
import {ChatMessageEntity} from '../models/ChatTypes.js';
import type {AgentSession} from '../agent_framework/AgentSessionTypes.js';

/**
 * Memory processing status for conversation
 */
export type MemoryProcessingStatus =
  | 'pending'      // Not yet processed
  | 'processing'   // Currently being processed (prevents concurrent runs)
  | 'completed'    // Successfully processed
  | 'failed';      // Failed (can retry)

/**
 * Represents a fully stored conversation with all state and metadata
 */
export interface StoredConversation {
  // Unique identifier for the conversation
  id: string;

  // User-visible title (auto-generated or user-edited)
  title: string;

  // Timestamps
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt: number; // Unix timestamp in milliseconds

  // Full conversation state
  state: SerializableAgentState;

  // Agent sessions that occurred in this conversation
  agentSessions: SerializableAgentSession[];

  // Preview text for the conversation list (first user message)
  preview?: string;

  // Total number of messages in the conversation
  messageCount: number;

  // Memory extraction status
  memoryStatus?: MemoryProcessingStatus;
  memoryProcessedAt?: number;           // Unix timestamp when completed
  memoryProcessingStartedAt?: number;   // Unix timestamp when processing started (for timeout detection)
}

/**
 * Lightweight metadata for conversation list display
 */
export interface ConversationMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview?: string;
  messageCount: number;
  memoryStatus?: MemoryProcessingStatus;
  memoryProcessingStartedAt?: number;  // Needed to detect stale processing
}

/**
 * Serializable version of AgentState (dates converted to timestamps)
 */
export interface SerializableAgentState {
  messages: ChatMessage[];
  context: SerializableDevToolsContext;
  error?: string;
  selectedAgentType?: string | null;
  currentPageUrl?: string;
  currentPageTitle?: string;
}

/**
 * Serializable version of DevToolsContext
 */
export interface SerializableDevToolsContext {
  selectedElement?: string;
  networkRequests?: Array<{
    url: string;
    method: string;
    status: number;
    statusText: string;
    responseTime: number;
    size: number;
  }>;
  consoleMessages?: Array<{
    text: string;
    level: 'log' | 'info' | 'warning' | 'error';
    timestamp: number;
  }>;
  performanceMetrics?: Array<{
    name: string;
    value: number;
    unit: string;
  }>;
  lastIntermediateResponse?: Record<string, unknown>;
  needsFollowUp?: boolean;
  intermediateStepsCount?: number;
  // Note: tracingContext, agentDescriptor, executionId, and abortSignal are not serialized
}

/**
 * Serializable version of AgentSession (dates converted to timestamps)
 */
export interface SerializableAgentSession {
  agentName: string;
  agentQuery?: string;
  agentReasoning?: string;
  agentDisplayName?: string;
  agentDescription?: string;
  sessionId: string;
  parentSessionId?: string;
  status: 'running' | 'completed' | 'error';
  startTime: number; // Unix timestamp
  endTime?: number; // Unix timestamp
  messages: SerializableAgentMessage[];
  nestedSessions: SerializableAgentSession[];
  reasoning?: string;
  tools: string[];
  iterationCount?: number;
  maxIterations?: number;
  modelUsed?: string;
  terminationReason?: string;
}

/**
 * Serializable version of AgentMessage (dates converted to timestamps)
 */
export interface SerializableAgentMessage {
  id: string;
  timestamp: number; // Unix timestamp
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'handoff' | 'final_answer';
  content: any; // Keep the content structure as-is
}

/**
 * Converts AgentState to a serializable format
 */
export function serializeAgentState(state: AgentState): SerializableAgentState {
  return {
    messages: state.messages.map(msg => {
      // Handle AgentSessionMessage by serializing the nested AgentSession
      if (msg.entity === ChatMessageEntity.AGENT_SESSION) {
        const agentSessionMsg = msg as any;
        return {
          ...agentSessionMsg,
          agentSession: serializeAgentSession(agentSessionMsg.agentSession),
        };
      }
      // Other message types pass through unchanged
      return msg;
    }),
    context: {
      selectedElement: state.context.selectedElement,
      networkRequests: state.context.networkRequests,
      consoleMessages: state.context.consoleMessages,
      performanceMetrics: state.context.performanceMetrics,
      lastIntermediateResponse: state.context.lastIntermediateResponse,
      needsFollowUp: state.context.needsFollowUp,
      intermediateStepsCount: state.context.intermediateStepsCount,
    },
    error: state.error,
    selectedAgentType: state.selectedAgentType,
    currentPageUrl: state.currentPageUrl,
    currentPageTitle: state.currentPageTitle,
  };
}

/**
 * Converts SerializableAgentState back to AgentState
 */
export function deserializeAgentState(serialized: SerializableAgentState): AgentState {
  return {
    messages: serialized.messages.map(msg => {
      // Handle AgentSessionMessage by deserializing the nested AgentSession
      if (msg.entity === ChatMessageEntity.AGENT_SESSION) {
        const agentSessionMsg = msg as any;
        return {
          ...agentSessionMsg,
          agentSession: deserializeAgentSession(agentSessionMsg.agentSession),
        };
      }
      // Other message types pass through unchanged
      return msg;
    }),
    context: {
      selectedElement: serialized.context.selectedElement,
      networkRequests: serialized.context.networkRequests,
      consoleMessages: serialized.context.consoleMessages,
      performanceMetrics: serialized.context.performanceMetrics,
      lastIntermediateResponse: serialized.context.lastIntermediateResponse,
      needsFollowUp: serialized.context.needsFollowUp,
      intermediateStepsCount: serialized.context.intermediateStepsCount || 0,
    },
    error: serialized.error,
    selectedAgentType: serialized.selectedAgentType,
    currentPageUrl: serialized.currentPageUrl,
    currentPageTitle: serialized.currentPageTitle,
  };
}

/**
 * Converts AgentSession to a serializable format
 */
export function serializeAgentSession(session: AgentSession): SerializableAgentSession {
  return {
    agentName: session.agentName,
    agentQuery: session.agentQuery,
    agentReasoning: session.agentReasoning,
    agentDisplayName: session.agentDisplayName,
    agentDescription: session.agentDescription,
    sessionId: session.sessionId,
    parentSessionId: session.parentSessionId,
    status: session.status,
    startTime: session.startTime.getTime(),
    endTime: session.endTime ? session.endTime.getTime() : undefined,
    messages: session.messages.map(msg => ({
      id: msg.id,
      timestamp: msg.timestamp.getTime(),
      type: msg.type,
      content: msg.content,
    })),
    nestedSessions: session.nestedSessions.map(serializeAgentSession),
    reasoning: session.reasoning,
    tools: session.tools,
    iterationCount: session.iterationCount,
    maxIterations: session.maxIterations,
    modelUsed: session.modelUsed,
    terminationReason: session.terminationReason,
  };
}

/**
 * Converts SerializableAgentSession back to AgentSession
 */
export function deserializeAgentSession(serialized: SerializableAgentSession): AgentSession {
  return {
    agentName: serialized.agentName,
    agentQuery: serialized.agentQuery,
    agentReasoning: serialized.agentReasoning,
    agentDisplayName: serialized.agentDisplayName,
    agentDescription: serialized.agentDescription,
    sessionId: serialized.sessionId,
    parentSessionId: serialized.parentSessionId,
    status: serialized.status,
    startTime: new Date(serialized.startTime),
    endTime: serialized.endTime ? new Date(serialized.endTime) : undefined,
    messages: serialized.messages.map(msg => ({
      id: msg.id,
      timestamp: new Date(msg.timestamp),
      type: msg.type,
      content: msg.content,
    })),
    nestedSessions: serialized.nestedSessions.map(deserializeAgentSession),
    reasoning: serialized.reasoning,
    tools: serialized.tools,
    iterationCount: serialized.iterationCount,
    maxIterations: serialized.maxIterations,
    modelUsed: serialized.modelUsed,
    terminationReason: serialized.terminationReason,
  };
}

/**
 * Generates a preview text from the first user message
 */
export function generatePreview(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(msg => msg.entity === 'user');
  if (firstUserMessage && 'text' in firstUserMessage) {
    const text = firstUserMessage.text as string;
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  }
  return 'New conversation';
}

/**
 * Generates a title from the first user message
 */
export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(msg => msg.entity === 'user');
  if (firstUserMessage && 'text' in firstUserMessage) {
    const text = firstUserMessage.text as string;
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }
  return 'New Chat';
}

/**
 * Extracts metadata from a stored conversation
 */
export function extractMetadata(conversation: StoredConversation): ConversationMetadata {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    preview: conversation.preview,
    messageCount: conversation.messageCount,
    memoryStatus: conversation.memoryStatus,
    memoryProcessingStartedAt: conversation.memoryProcessingStartedAt,
  };
}
