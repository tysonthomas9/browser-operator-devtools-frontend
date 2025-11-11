// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Agent session types for tracking agent execution.
 * These types are used to represent the state and history of agent runs.
 */

/**
 * Agent session represents a complete execution context for an agent
 */
export interface AgentSession {
  // Agent Identity
  agentName: string;
  agentQuery?: string; // Optional query for the agent
  agentReasoning?: string; // Optional reasoning for the agent's actions
  agentDisplayName?: string; // Human-readable name from config
  agentDescription?: string; // Description from config

  // Session Metadata
  sessionId: string;
  parentSessionId?: string; // For nested handoffs
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;

  // Session Content
  messages: AgentMessage[];
  nestedSessions: AgentSession[]; // Child agent sessions

  // Agent Context
  reasoning?: string;
  tools: string[];
  config?: any; // Will be typed as AgentToolConfig later

  // Execution metadata
  iterationCount?: number;
  maxIterations?: number;
  modelUsed?: string;
  terminationReason?: string;
}

/**
 * Agent message within a session
 */
export interface AgentMessage {
  id: string;
  timestamp: Date;
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'handoff' | 'final_answer';

  // Message Content (varies by type)
  content: ReasoningMessage | AgentToolCallMessage | AgentToolResultMessage | HandoffMessage | FinalAnswerMessage;
}

/**
 * Reasoning step from the agent
 */
export interface ReasoningMessage {
  type: 'reasoning';
  text: string;
  context?: string; // Why this reasoning step
}

/**
 * Tool call initiated by the agent (session-level message)
 */
export interface AgentToolCallMessage {
  type: 'tool_call';
  toolName: string;
  toolArgs: Record<string, any>;
  toolCallId: string;
  reasoning?: string; // Why this tool was chosen
}

/**
 * Result from tool execution (session-level message)
 */
export interface AgentToolResultMessage {
  type: 'tool_result';
  toolCallId: string; // Links to tool call
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
}

/**
 * Handoff to another agent
 */
export interface HandoffMessage {
  type: 'handoff';
  targetAgent: string;
  reason: string;
  context: Record<string, any>; // Data passed to child agent
  nestedSessionId: string; // References child session
}

/**
 * Final answer from the agent
 */
export interface FinalAnswerMessage {
  type: 'final_answer';
  answer: string;
  summary?: string;
}

/**
 * Default UI configuration for agents
 */
export const DEFAULT_AGENT_UI = {
  displayName: 'AI Assistant',
  avatar: '🤖',
  color: '#6b7280',
  backgroundColor: '#f9fafb',
};

/**
 * Utility function to format agent name to display name
 */
export function formatAgentName(agentName: string): string {
  return agentName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Utility function to get agent display name
 */
export function getAgentDisplayName(agentName: string, config?: any): string {
  // First try to get from config UI
  if (config?.ui?.displayName) {
    return config.ui.displayName;
  }

  // Then try to get from config description (first line)
  if (config?.description) {
    const firstLine = config.description.split('\n')[0].trim();
    // If it looks like a title, use it
    if (firstLine && !firstLine.includes('agent') && firstLine.length < 50) {
      return firstLine;
    }
  }

  // Finally, format the agent name
  return formatAgentName(agentName);
}

/**
 * Utility function to get agent description from config
 */
export function getAgentDescription(agentName: string, config?: any): string {
  if (config?.description) {
    return config.description;
  }

  return `${getAgentDisplayName(agentName, config)} - AI Assistant`;
}

/**
 * Utility function to get agent UI configuration
 */
export function getAgentUIConfig(agentName: string, config?: any) {
  return {
    displayName: getAgentDisplayName(agentName, config),
    avatar: config?.ui?.avatar || DEFAULT_AGENT_UI.avatar,
    color: config?.ui?.color || DEFAULT_AGENT_UI.color,
    backgroundColor: config?.ui?.backgroundColor || DEFAULT_AGENT_UI.backgroundColor,
  };
}
