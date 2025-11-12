import { AgentState, ChatMessageEntity, UserChatMessage, ChatMessage } from '../types/index.js';

/**
 * State management for agents
 * Extracted from front_end/panels/ai_chat/core/State.ts
 */

/**
 * Create initial agent state
 */
declare function createInitialState(): AgentState;
/**
 * Create user message
 */
declare function createUserMessage(text: string, entity: ChatMessageEntity.USER): UserChatMessage;
/**
 * Add message to state
 */
declare function addMessage(state: AgentState, message: ChatMessage): AgentState;
/**
 * Update state context
 */
declare function updateContext(state: AgentState, context: Record<string, unknown>): AgentState;
/**
 * Update state variables
 */
declare function updateVariables(state: AgentState, variables: Record<string, unknown>): AgentState;
/**
 * Set error in state
 */
declare function setError(state: AgentState, error: Error): AgentState;
/**
 * Clear error from state
 */
declare function clearError(state: AgentState): AgentState;
/**
 * Clone state
 */
declare function cloneState(state: AgentState): AgentState;

export { addMessage, clearError, cloneState, createInitialState, createUserMessage, setError, updateContext, updateVariables };
