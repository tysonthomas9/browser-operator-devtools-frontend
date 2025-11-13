/**
 * Types for AgentRunner - Advanced multi-iteration agent execution
 */

import type { ILLMProvider } from '../llm/index.js';
import type { Tool } from '../tools/index.js';

/**
 * Termination reason for agent execution
 */
export type TerminationReason =
  | 'final_answer'    // Agent provided a final answer
  | 'max_iterations'  // Reached max iteration limit
  | 'error'           // Execution error occurred
  | 'aborted';        // Execution was cancelled

/**
 * Session status
 */
export type SessionStatus = 'running' | 'completed' | 'error';

/**
 * Tool call record in session
 */
export interface ToolCallRecord {
  id: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  timestamp: Date;
  iteration: number;
}

/**
 * Tool result record in session
 */
export interface ToolResultRecord {
  id: string;
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  timestamp: Date;
  iteration: number;
  duration?: number; // Execution time in ms
}

/**
 * Message in agent session
 */
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: Date;
  iteration?: number;
  toolCallId?: string;
  toolCalls?: ToolCallRecord[];
}

/**
 * Agent execution session
 */
export interface AgentSession {
  sessionId: string;
  status: SessionStatus;
  terminationReason?: TerminationReason;
  startTime: Date;
  endTime?: Date;
  iterationCount: number;
  messages: SessionMessage[];
  toolCalls: ToolCallRecord[];
  toolResults: ToolResultRecord[];
  model: string;
  maxIterations: number;
  metadata?: Record<string, unknown>;
}

/**
 * Progress event types
 */
export type ProgressEventType =
  | 'session_started'
  | 'iteration_started'
  | 'tool_call'
  | 'tool_result'
  | 'session_completed';

/**
 * Progress event payload
 */
export interface ProgressEvent {
  type: ProgressEventType;
  sessionId: string;
  timestamp: Date;
  data: unknown;
}

/**
 * Configuration for AgentRunner
 */
export interface AgentRunnerConfig {
  /** Model name (e.g., 'gpt-4o') */
  model: string;

  /** LLM provider instance */
  provider: ILLMProvider;

  /** System instructions / prompt */
  instructions?: string;

  /** Tools available to the agent */
  tools?: Record<string, Tool>;

  /** Maximum iterations (default: 10) */
  maxIterations?: number;

  /** Temperature for LLM (default: 0.7) */
  temperature?: number;

  /** Continue execution on tool errors (default: true) */
  continueOnError?: boolean;

  /** Runtime context for tools */
  runtimeContext?: Record<string, unknown>;

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for run() method
 */
export interface RunOptions {
  /** Custom session ID (optional) */
  sessionId?: string;

  /** Progress callback */
  onProgress?: (event: ProgressEvent) => void;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Override temperature */
  temperature?: number;

  /** Override max iterations */
  maxIterations?: number;
}

/**
 * Result from agent execution
 */
export interface RunResult {
  /** Whether execution was successful */
  success: boolean;

  /** Final output text (if successful) */
  output?: string;

  /** Error message (if failed) */
  error?: string;

  /** Complete session data */
  session: AgentSession;

  /** Raw LLM usage data */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Internal message format matching LLM expectations
 */
export interface InternalMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * Parsed action from LLM response
 */
export type ParsedAction =
  | { type: 'tool_call'; name: string; args: Record<string, unknown>; toolCallId: string }
  | { type: 'final_answer'; answer: string }
  | { type: 'error'; error: string };
