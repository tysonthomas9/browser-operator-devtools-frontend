/**
 * @browser-operator/core
 *
 * Core agent framework for Browser Operator SDK
 */

// Agent
export { Agent } from './agent/index.js';
export type {
  AgentConfig,
  AgentResult,
  AgentContext,
  AgentState,
  ExecutionOptions,
} from './agent/index.js';

// Types
export {
  ChatMessageEntity,
  type BaseChatMessage,
  type UserChatMessage,
  type ModelChatMessage,
  type ToolResultMessage,
  type ToolCallMessage,
  type ChatMessage,
  type ImageInputData,
  type ToolCall,
  type AgentHooks,
  type ToolSet,
  type PlatformAdapter,
  type PageContext,
  type Action,
  type ActionResult,
  type AccessibilityNode,
} from './types/index.js';

// State management
export {
  createInitialState,
  createUserMessage,
  addMessage,
  updateContext,
  updateVariables,
  setError,
  clearError,
  cloneState,
} from './state/index.js';

// Events
export {
  AgentEvent,
  AgentEventEmitter,
  getGlobalEventBus,
  resetGlobalEventBus,
  type AgentEventMap,
} from './events/index.js';

// Hooks
export {
  executeOnStart,
  executeOnIteration,
  executeOnToolCall,
  executeOnToolResult,
  executeOnFinish,
  executeOnError,
  createDefaultHooks,
  mergeHooks,
} from './hooks/index.js';
