import { LLMProvider } from './llm/index.mjs';
export { ErrorRetryConfig, ExtendedRetryConfig, FileContent, ImageContent, LLMBaseProvider, LLMCallOptions, LLMErrorType, LLMMessage, LLMProviderInterface, LLMProviderRegistry, LLMResponse, LLMResponseParser, MessageContent, ModelCapabilities, ModelInfo, ModelOption, ParsedLLMAction, RetryCallback, RetryConfig, SanitizationOptions, TextContent, UnifiedLLMOptions, UnifiedLLMResponse, sanitizeMessagesForModel } from './llm/index.mjs';

/**
 * Log levels for the logger
 */
declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}
/**
 * Logger configuration
 */
interface LoggerConfig {
    level?: LogLevel;
    prefix?: string;
    timestamp?: boolean;
}
/**
 * Simple logger implementation for the SDK
 */
declare class Logger {
    private level;
    private prefix;
    private timestamp;
    constructor(name: string, config?: LoggerConfig);
    private formatMessage;
    private shouldLog;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
}
/**
 * Create a logger instance
 */
declare function createLogger(name: string, config?: LoggerConfig): Logger;
declare function setGlobalLogLevel(level: LogLevel): void;
declare function getGlobalLogLevel(): LogLevel;

/**
 * Shared chat message types for agent communication.
 * Platform-agnostic message structures.
 */
/**
 * Define possible entities for chat messages
 */
declare enum ChatMessageEntity {
    USER = "user",
    MODEL = "model",
    TOOL_RESULT = "tool_result",
    AGENT_SESSION = "agent_session"
}
/**
 * Base structure for all chat messages
 */
interface BaseChatMessage {
    entity: ChatMessageEntity;
    error?: string;
    managedByAgentSessionId?: string;
}
/**
 * Image input used by user messages
 */
interface ImageInputData {
    url: string;
    bytesBase64: string;
}
/**
 * User message
 */
interface UserChatMessage extends BaseChatMessage {
    entity: ChatMessageEntity.USER;
    text: string;
    imageInput?: ImageInputData;
}
/**
 * Model message
 */
interface ModelChatMessage extends BaseChatMessage {
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
interface ToolResultMessage extends BaseChatMessage {
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
interface AgentSessionMessage extends BaseChatMessage {
    entity: ChatMessageEntity.AGENT_SESSION;
    agentSession: any;
    triggerMessageId?: string;
    summary?: string;
}
/**
 * Union type for all chat messages
 */
type ChatMessage = UserChatMessage | ModelChatMessage | ToolResultMessage | AgentSessionMessage;
/**
 * Helper to create user messages
 */
declare function createUserMessage(text: string, imageInput?: ImageInputData): UserChatMessage;
/**
 * Helper to create model messages
 */
declare function createModelMessage(action: 'tool' | 'final', options: {
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    answer?: string;
    reasoning?: string[] | null;
    toolCallId?: string;
}): ModelChatMessage;
/**
 * Helper to create tool result messages
 */
declare function createToolResultMessage(toolName: string, resultText: string, isError?: boolean, options?: {
    resultData?: unknown;
    toolCallId?: string;
    isFromConfigurableAgent?: boolean;
    imageData?: string;
    summary?: string;
}): ToolResultMessage;

/**
 * Agent session types for tracking agent execution.
 * These types are used to represent the state and history of agent runs.
 */
/**
 * Agent session represents a complete execution context for an agent
 */
interface AgentSession {
    agentName: string;
    agentQuery?: string;
    agentReasoning?: string;
    agentDisplayName?: string;
    agentDescription?: string;
    sessionId: string;
    parentSessionId?: string;
    status: 'running' | 'completed' | 'error';
    startTime: Date;
    endTime?: Date;
    messages: AgentMessage[];
    nestedSessions: AgentSession[];
    reasoning?: string;
    tools: string[];
    config?: any;
    iterationCount?: number;
    maxIterations?: number;
    modelUsed?: string;
    terminationReason?: string;
}
/**
 * Agent message within a session
 */
interface AgentMessage {
    id: string;
    timestamp: Date;
    type: 'reasoning' | 'tool_call' | 'tool_result' | 'handoff' | 'final_answer';
    content: ReasoningMessage | AgentToolCallMessage | AgentToolResultMessage | HandoffMessage | FinalAnswerMessage;
}
/**
 * Reasoning step from the agent
 */
interface ReasoningMessage {
    type: 'reasoning';
    text: string;
    context?: string;
}
/**
 * Tool call initiated by the agent (session-level message)
 */
interface AgentToolCallMessage {
    type: 'tool_call';
    toolName: string;
    toolArgs: Record<string, any>;
    toolCallId: string;
    reasoning?: string;
}
/**
 * Result from tool execution (session-level message)
 */
interface AgentToolResultMessage {
    type: 'tool_result';
    toolCallId: string;
    toolName: string;
    success: boolean;
    result?: any;
    error?: string;
    duration?: number;
}
/**
 * Handoff to another agent
 */
interface HandoffMessage {
    type: 'handoff';
    targetAgent: string;
    reason: string;
    context: Record<string, any>;
    nestedSessionId: string;
}
/**
 * Final answer from the agent
 */
interface FinalAnswerMessage {
    type: 'final_answer';
    answer: string;
    summary?: string;
}
/**
 * Default UI configuration for agents
 */
declare const DEFAULT_AGENT_UI: {
    displayName: string;
    avatar: string;
    color: string;
    backgroundColor: string;
};
/**
 * Utility function to format agent name to display name
 */
declare function formatAgentName(agentName: string): string;
/**
 * Utility function to get agent display name
 */
declare function getAgentDisplayName(agentName: string, config?: any): string;
/**
 * Utility function to get agent description from config
 */
declare function getAgentDescription(agentName: string, config?: any): string;
/**
 * Utility function to get agent UI configuration
 */
declare function getAgentUIConfig(agentName: string, config?: any): {
    displayName: string;
    avatar: any;
    color: any;
    backgroundColor: any;
};

/**
 * Base interface for all tools
 */
interface Tool<TArgs = Record<string, unknown>, TResult = unknown> {
    /** Unique tool name */
    name: string;
    /** Description for LLM understanding */
    description: string;
    /** Execute the tool */
    execute: (args: TArgs, ctx?: ToolContext) => Promise<TResult>;
    /** JSON schema for tool arguments */
    schema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Context passed into tools for LLM-related operations and configuration.
 */
interface ToolContext {
    /** API key for LLM calls */
    apiKey?: string;
    /** LLM provider to use */
    provider: LLMProvider;
    /** Model name to use */
    model: string;
    /** Check if model has vision capability */
    getVisionCapability?: (model: string) => Promise<boolean> | boolean;
    /** Mini model for smaller/faster operations */
    miniModel?: string;
    /** Nano model for smallest/fastest operations */
    nanoModel?: string;
    /** Abort signal for cancellation */
    abortSignal?: AbortSignal;
    /** Additional custom context */
    [key: string]: any;
}
/**
 * Result wrapper for tool execution
 */
interface ToolExecutionResult<T = unknown> {
    success: boolean;
    result?: T;
    error?: string;
    duration?: number;
}
/**
 * Tool factory function type
 */
type ToolFactory<T extends Tool = Tool> = () => T;
/**
 * Helper to create a tool execution result
 */
declare function createToolResult<T>(success: boolean, result?: T, error?: string, duration?: number): ToolExecutionResult<T>;
/**
 * Helper to create a successful tool result
 */
declare function successResult<T>(result: T, duration?: number): ToolExecutionResult<T>;
/**
 * Helper to create an error tool result
 */
declare function errorResult<T = undefined>(error: string, duration?: number): ToolExecutionResult<T>;

/**
 * Registry for managing tools and agents.
 * Provides a centralized place to register and retrieve tool instances.
 */
declare class ToolRegistry {
    private static toolFactories;
    private static registeredTools;
    /**
     * Register a tool factory and create/store an instance
     */
    static registerToolFactory(name: string, factory: ToolFactory): void;
    /**
     * Get a tool instance by name (creates new instance from factory)
     */
    static getToolInstance(name: string): Tool<any, any> | null;
    /**
     * Get a pre-registered tool instance by name (returns cached instance)
     */
    static getRegisteredTool(name: string): Tool<any, any> | null;
    /**
     * Check if a tool is registered
     */
    static hasTool(name: string): boolean;
    /**
     * Get all registered tool names
     */
    static getRegisteredToolNames(): string[];
    /**
     * Get all registered tool instances
     */
    static getAllRegisteredTools(): Tool<any, any>[];
    /**
     * Clear all registered tools (useful for testing)
     */
    static clear(): void;
    /**
     * Get registry statistics
     */
    static getStats(): {
        toolCount: number;
        toolNames: string[];
    };
    /**
     * Unregister a specific tool
     */
    static unregisterTool(name: string): boolean;
    /**
     * Register multiple tools at once
     */
    static registerTools(tools: Record<string, ToolFactory>): void;
}

/**
 * Browser Operator AI Agent SDK
 *
 * Production-ready SDK for building multi-agent AI systems with LLM support.
 *
 * @packageDocumentation
 */

declare const VERSION = "0.1.0";

export { type AgentMessage, type AgentSession, type AgentSessionMessage, type AgentToolCallMessage, type AgentToolResultMessage, type BaseChatMessage, type ChatMessage, ChatMessageEntity, DEFAULT_AGENT_UI, type FinalAnswerMessage, type HandoffMessage, type ImageInputData, LLMProvider, LogLevel, Logger, type LoggerConfig, type ModelChatMessage, type ReasoningMessage, type Tool, type ToolContext, type ToolExecutionResult, type ToolFactory, ToolRegistry, type ToolResultMessage, type UserChatMessage, VERSION, createLogger, createModelMessage, createToolResult, createToolResultMessage, createUserMessage, errorResult, formatAgentName, getAgentDescription, getAgentDisplayName, getAgentUIConfig, getGlobalLogLevel, setGlobalLogLevel, successResult };
