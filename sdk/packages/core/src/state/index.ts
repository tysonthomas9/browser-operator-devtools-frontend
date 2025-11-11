/**
 * State management for agents
 * Extracted from front_end/panels/ai_chat/core/State.ts
 */

import type { AgentState, ChatMessage, ChatMessageEntity, UserChatMessage } from '../types/index.js';

/**
 * Create initial agent state
 */
export function createInitialState(): AgentState {
  return {
    messages: [],
    context: {},
    metadata: {},
    variables: {},
  };
}

/**
 * Create user message
 */
export function createUserMessage(text: string, entity: ChatMessageEntity.USER): UserChatMessage {
  return {
    entity,
    text,
    id: generateId(),
    timestamp: Date.now(),
  };
}

/**
 * Add message to state
 */
export function addMessage(state: AgentState, message: ChatMessage): AgentState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

/**
 * Update state context
 */
export function updateContext(
  state: AgentState,
  context: Record<string, unknown>
): AgentState {
  return {
    ...state,
    context: { ...state.context, ...context },
  };
}

/**
 * Update state variables
 */
export function updateVariables(
  state: AgentState,
  variables: Record<string, unknown>
): AgentState {
  return {
    ...state,
    variables: { ...state.variables, ...variables },
  };
}

/**
 * Set error in state
 */
export function setError(state: AgentState, error: Error): AgentState {
  return {
    ...state,
    error,
  };
}

/**
 * Clear error from state
 */
export function clearError(state: AgentState): AgentState {
  const { error, ...rest } = state;
  return rest;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clone state
 */
export function cloneState(state: AgentState): AgentState {
  return {
    ...state,
    messages: [...state.messages],
    context: { ...state.context },
    metadata: { ...state.metadata },
    variables: { ...state.variables },
  };
}
