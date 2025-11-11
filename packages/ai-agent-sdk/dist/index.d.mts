import { LLMProvider, LLMMessage } from './llm/index.mjs';
export { ErrorRetryConfig, ExtendedRetryConfig, FileContent, ImageContent, LLMBaseProvider, LLMCallOptions, LLMErrorType, LLMProviderInterface, LLMProviderRegistry, LLMResponse, LLMResponseParser, MessageContent, ModelCapabilities, ModelInfo, ModelOption, ParsedLLMAction, RetryCallback, RetryConfig, SanitizationOptions, TextContent, UnifiedLLMOptions, UnifiedLLMResponse, sanitizeMessagesForModel } from './llm/index.mjs';

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
 * Sentinel model identifiers used in agent configurations
 */
declare const MODEL_SENTINELS: {
    readonly USE_MINI: "use-mini";
    readonly USE_NANO: "use-nano";
};
/**
 * Defines the possible reasons an agent run might terminate.
 */
type AgentRunTerminationReason = 'final_answer' | 'max_iterations' | 'error' | 'custom_exit' | 'handed_off';
/**
 * Defines the possible triggers for a handoff.
 */
type HandoffTrigger = 'llm_tool_call' | 'max_iterations';
/**
 * Configuration for a specific handoff target.
 */
interface HandoffConfig {
    /**
     * The registered name of the agent to hand off to.
     */
    targetAgentName: string;
    /**
     * The condition that triggers this handoff. Defaults to 'llm_tool_call'.
     */
    trigger?: HandoffTrigger;
    /**
     * Optional array of tool names. If specified, only the results from these tools
     * in the sending agent's history will be collected and potentially passed to the
     * target agent as handoff messages.
     */
    includeToolResults?: string[];
}
/**
 * UI display configuration for an agent
 */
interface AgentUIConfig {
    /**
     * Display name for the agent (human-readable)
     */
    displayName?: string;
    /**
     * Avatar/icon for the agent (emoji or icon class)
     */
    avatar?: string;
    /**
     * Primary color for the agent (hex code)
     */
    color?: string;
    /**
     * Background color for the agent (hex code)
     */
    backgroundColor?: string;
}
/**
 * Context passed along with agent/tool calls
 */
interface CallContext {
    apiKey?: string;
    provider?: LLMProvider;
    model?: string;
    miniModel?: string;
    nanoModel?: string;
    mainModel?: string;
    getVisionCapability?: (modelName: string) => Promise<boolean> | boolean;
    overrideSessionId?: string;
    overrideParentSessionId?: string;
    abortSignal?: AbortSignal;
}
/**
 * JSON configuration for an agent tool
 */
interface AgentToolConfig {
    /**
     * Name of the agent tool
     */
    name: string;
    /**
     * Description of the agent tool
     */
    description: string;
    /**
     * System prompt for the agent
     */
    systemPrompt: string;
    /**
     * Tool names to make available to the agent
     */
    tools: string[];
    /**
     * Semantic version identifier for this agent configuration
     */
    version?: string;
    /**
     * Defines potential handoffs to other agents.
     * Handoffs triggered by 'llm_tool_call' are presented as tools to the LLM.
     * Handoffs triggered by 'max_iterations' are executed automatically if the agent hits the limit.
     */
    handoffs?: HandoffConfig[];
    /**
     * Maximum iterations for the agent loop
     */
    maxIterations?: number;
    /**
     * Model name to use for the agent. Can be a string or a function that returns a string.
     */
    modelName?: string | (() => string);
    /**
     * Temperature for the agent
     */
    temperature?: number;
    /**
     * Schema for the agent tool arguments
     */
    schema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
    /**
     * UI display configuration for the agent
     */
    ui?: AgentUIConfig;
    /**
     * Custom initialization function name
     */
    init?: (agent: any) => void;
    /**
     * Custom message preparation function name
     */
    prepareMessages?: (args: ConfigurableAgentArgs, config: AgentToolConfig) => ChatMessage[];
    /**
     * Custom success result creation function name
     */
    createSuccessResult?: (output: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason, config: AgentToolConfig) => ConfigurableAgentResult;
    /**
     * Custom error result creation function name
     */
    createErrorResult?: (error: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason, config: AgentToolConfig) => ConfigurableAgentResult;
    /**
     * If true, the agent WILL include intermediateSteps in its final returned result
     * (both success and error results). Defaults to false (steps are omitted).
     */
    includeIntermediateStepsOnReturn?: boolean;
    /**
     * If true, generate a summary of the agent's execution and append it to the final answer.
     * Summary includes: user request, agent decisions, and final outcome.
     * Defaults to false (no summary generated).
     * Use this for agents where understanding the execution process is valuable (e.g., web automation agents).
     */
    includeSummaryInAnswer?: boolean;
    /**
     * Optional lifecycle hook that runs before the agent starts executing.
     * Use this for agent-specific pre-execution logic such as environment setup,
     * page navigation, or prerequisite checks.
     *
     * @param callCtx - The call context containing API keys, models, and other execution context
     * @returns Promise that resolves when pre-execution is complete
     */
    beforeExecute?: (callCtx: CallContext) => Promise<void>;
    /**
     * Optional lifecycle hook that runs after the agent completes execution.
     * Use this for agent-specific post-execution logic such as saving results,
     * cleanup operations, or data aggregation.
     *
     * @param result - The final agent execution result (success or error)
     * @param agentSession - The complete agent session with all messages and tool calls
     * @param callCtx - The call context containing API keys, models, and other execution context
     * @returns Promise that resolves when post-execution is complete
     */
    afterExecute?: (result: ConfigurableAgentResult, agentSession: AgentSession, callCtx: CallContext) => Promise<void>;
}
/**
 * Arguments for the ConfigurableAgentTool
 */
interface ConfigurableAgentArgs extends Record<string, unknown> {
    /**
     * Original query or input
     */
    query: string;
    /**
     * Reasoning for invocation
     */
    reasoning: string;
    /**
     * Additional arguments based on schema
     */
    [key: string]: unknown;
}
/**
 * Result from the ConfigurableAgentTool
 */
interface ConfigurableAgentResult {
    /**
     * Whether the execution was successful
     */
    success: boolean;
    /**
     * Final output if successful
     */
    output?: string;
    /**
     * Error message if unsuccessful
     */
    error?: string;
    /**
     * Intermediate steps for debugging
     */
    intermediateSteps?: ChatMessage[];
    /**
     * Termination reason for the agent run
     */
    terminationReason: AgentRunTerminationReason;
    /**
     * Structured summary of agent execution
     */
    summary?: {
        /**
         * Type of completion
         */
        type: 'completion' | 'error' | 'timeout';
        /**
         * Formatted summary text
         */
        content: string;
    };
}

/**
 * Progress event types emitted during agent execution
 */
interface AgentRunnerProgressEvent {
    type: 'session_started' | 'tool_started' | 'tool_completed' | 'session_updated' | 'child_agent_started' | 'session_completed';
    sessionId: string;
    parentSessionId?: string;
    agentName: string;
    timestamp: Date;
    data: any;
}
/**
 * Callback function type for progress events
 */
type ProgressCallback = (event: AgentRunnerProgressEvent) => void;
/**
 * Simple event bus for agent runner progress events
 * Platform-agnostic implementation without external dependencies
 */
declare class AgentRunnerEventBus {
    private static instance;
    private listeners;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): AgentRunnerEventBus;
    /**
     * Emit a progress event to all listeners
     */
    emitProgress(event: AgentRunnerProgressEvent): void;
    /**
     * Add a progress event listener
     */
    addListener(callback: ProgressCallback): void;
    /**
     * Remove a progress event listener
     */
    removeListener(callback: ProgressCallback): void;
    /**
     * Remove all listeners
     */
    removeAllListeners(): void;
    /**
     * Get the number of active listeners
     */
    getListenerCount(): number;
}

interface ConfigurableAgentTool$1 extends Tool<ConfigurableAgentArgs, ConfigurableAgentResult> {
    config: any;
}
/**
 * Configuration for the AgentRunner
 */
interface AgentRunnerConfig {
    apiKey: string;
    modelName: string;
    systemPrompt: string;
    tools: Array<Tool<any, any>>;
    maxIterations: number;
    temperature: number;
    provider: LLMProvider;
    getVisionCapability?: (modelName: string) => Promise<boolean> | boolean;
    miniModel?: string;
    nanoModel?: string;
}
/**
 * Hooks for customizing agent behavior
 */
interface AgentRunnerHooks {
    prepareInitialMessages?: (messages: ChatMessage[]) => ChatMessage[];
    createSuccessResult: (output: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason) => ConfigurableAgentResult;
    createErrorResult: (error: string, intermediateSteps: ChatMessage[], reason: AgentRunTerminationReason) => ConfigurableAgentResult;
    afterExecute?: (result: ConfigurableAgentResult, agentSession: AgentSession) => Promise<void>;
}
/**
 * AgentRunner executes agent loops with tool calling
 */
declare class AgentRunner {
    static eventBus: AgentRunnerEventBus | null;
    /**
     * Initialize the event bus
     */
    static initializeEventBus(): void;
    /**
     * Convert chat messages to LLM messages
     */
    static convertToLLMMessages(messages: ChatMessage[]): LLMMessage[];
    /**
     * Sanitizes tool result data for text representation by removing fields
     * that shouldn't be sent to the LLM (imageData, success, etc.)
     */
    private static sanitizeToolResultForText;
    /**
     * Compute the tool result text shown to the LLM for regular tool outputs
     */
    static computeToolResultText(toolResultData: any, imageData?: string): string;
    /**
     * Execute handoff to another agent
     */
    private static executeHandoff;
    /**
     * Main agent execution loop
     */
    static run(initialMessages: ChatMessage[], args: ConfigurableAgentArgs, config: AgentRunnerConfig, hooks: AgentRunnerHooks, executingAgent: ConfigurableAgentTool$1 | null, parentSession?: AgentSession, overrides?: {
        sessionId?: string;
        parentSessionId?: string;
    }, abortSignal?: AbortSignal): Promise<ConfigurableAgentResult & {
        agentSession: AgentSession;
    }>;
    /**
     * Generate a summary of agent progress using LLM
     */
    private static summarizeAgentProgress;
}

/**
 * An agent tool that can be configured via JSON
 * This allows agents to be used as tools within other agents
 */
declare class ConfigurableAgentTool implements Tool<ConfigurableAgentArgs, ConfigurableAgentResult> {
    name: string;
    description: string;
    config: AgentToolConfig;
    schema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
    };
    constructor(config: AgentToolConfig);
    /**
     * Get the tool instances for this agent
     */
    private getToolInstances;
    /**
     * Prepare initial messages for the agent
     */
    private prepareInitialMessages;
    /**
     * Create a success result
     */
    private createSuccessResult;
    /**
     * Create an error result
     */
    private createErrorResult;
    /**
     * Execute the agent
     */
    execute(args: ConfigurableAgentArgs, ctx?: unknown): Promise<ConfigurableAgentResult & {
        agentSession: AgentSession;
    }>;
}

/**
 * Configuration for error handling behavior
 */
interface ErrorHandlingConfig {
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
interface ErrorHandlingResult {
    /** Whether the error handler created a recovery message */
    shouldContinue: boolean;
    /** Error message created for the conversation */
    errorMessage?: ChatMessage;
    /** Error message for session tracking */
    sessionMessage?: Partial<AgentMessage>;
}
/**
 * Centralized utility for handling agent-level errors across the agent framework
 */
declare class AgentErrorHandler {
    private config;
    constructor(config: ErrorHandlingConfig);
    /**
     * Create an error handler with the given configuration
     */
    static createErrorHandler(config: ErrorHandlingConfig): AgentErrorHandler;
    /**
     * Handle unknown tool requests gracefully
     */
    handleUnknownTool(toolName: string, toolCallId: string): ErrorHandlingResult;
    /**
     * Handle LLM response parsing errors gracefully
     */
    handleParsingError(error: string): ErrorHandlingResult;
}

/**
 * Core types for graph orchestration
 */
/**
 * Interface for a runnable unit of work (node in the graph)
 */
interface Runnable<TInput, TOutput> {
    /**
     * Execute the runnable with the given input
     * @param input - The input state
     * @param signal - Optional abort signal for cancellation
     * @returns Promise resolving to the output state
     */
    invoke(input: TInput, signal?: AbortSignal): Promise<TOutput>;
}
/**
 * Condition function that determines the next node to execute
 */
type ConditionFunction<TState> = (state: TState) => string;
/**
 * Map of condition outcomes to target node names
 */
type TargetMap = Record<string, string>;
/**
 * Configuration for a conditional edge
 */
interface ConditionalEdge<TState> {
    /**
     * Function that evaluates the current state and returns a routing key
     */
    condition: ConditionFunction<TState>;
    /**
     * Map of routing keys to target node names
     */
    targetMap: Map<string, string>;
}
/**
 * Progress event emitted during graph execution
 */
interface GraphProgressEvent<TState> {
    /**
     * Type of progress event
     */
    type: 'node_start' | 'node_complete' | 'node_error' | 'routing';
    /**
     * Name of the current node
     */
    nodeName: string;
    /**
     * Current step number
     */
    step: number;
    /**
     * Current state (optional, for security/privacy)
     */
    state?: TState;
    /**
     * Additional event data
     */
    data?: any;
}
/**
 * Callback for graph progress events
 */
type GraphProgressCallback<TState> = (event: GraphProgressEvent<TState>) => void;
/**
 * Options for graph execution
 */
interface GraphExecutionOptions {
    /**
     * Maximum number of steps before auto-termination
     * @default 50
     */
    maxSteps?: number;
    /**
     * Abort signal for cancellation
     */
    signal?: AbortSignal;
    /**
     * Progress callback for monitoring execution
     */
    onProgress?: GraphProgressCallback<any>;
}
/**
 * Marker for graph termination
 */
declare const END_NODE = "__end__";
/**
 * Error thrown when graph execution is aborted
 */
declare class GraphAbortedError extends Error {
    constructor(message?: string);
}
/**
 * Error thrown when graph execution exceeds maximum steps
 */
declare class GraphMaxStepsError extends Error {
    constructor(maxSteps: number);
}
/**
 * Error thrown when a node is not found
 */
declare class NodeNotFoundError extends Error {
    constructor(nodeName: string);
}
/**
 * Error thrown when routing fails
 */
declare class RoutingError extends Error {
    constructor(message: string);
}

/**
 * Configuration for StateGraph
 */
interface StateGraphConfig {
    /**
     * Name of the graph (for logging and debugging)
     */
    name: string;
    /**
     * Entry point node name
     * @default 'start'
     */
    entryPoint?: string;
}
/**
 * StateGraph implements a state machine-based workflow orchestration system.
 *
 * The graph consists of nodes (units of work) and conditional edges (routing logic).
 * Execution flows through nodes based on conditional evaluation of the state.
 *
 * @template TState - The type of state passed between nodes
 *
 * @example
 * ```typescript
 * const graph = new StateGraph<MyState>({ name: 'my-workflow' });
 *
 * // Add nodes
 * graph.addNode('process', processNode);
 * graph.addNode('validate', validateNode);
 * graph.addNode('complete', completeNode);
 *
 * // Add conditional routing
 * graph.addConditionalEdges('process', (state) => {
 *   return state.isValid ? 'validate' : 'complete';
 * }, {
 *   validate: 'validate',
 *   complete: 'complete'
 * });
 *
 * // Set entry point
 * graph.setEntryPoint('process');
 *
 * // Execute
 * const finalState = await graph.invoke(initialState);
 * ```
 */
declare class StateGraph<TState> {
    private nodes;
    private conditionalEdges;
    private entryPoint;
    private name;
    constructor(config: StateGraphConfig);
    /**
     * Add a node to the graph
     * @param name - Unique name for the node
     * @param node - Runnable that implements the node logic
     */
    addNode(name: string, node: Runnable<TState, TState>): void;
    /**
     * Add conditional edges from a source node
     * @param sourceName - Name of the source node
     * @param condition - Function that evaluates state and returns a routing key
     * @param targetMap - Map of routing keys to target node names
     */
    addConditionalEdges(sourceName: string, condition: (state: TState) => string, targetMap: Record<string, string>): void;
    /**
     * Set the entry point for graph execution
     * @param name - Name of the entry point node
     */
    setEntryPoint(name: string): void;
    /**
     * Get the current entry point
     */
    getEntryPoint(): string;
    /**
     * Get all node names
     */
    getNodeNames(): string[];
    /**
     * Check if a node exists
     */
    hasNode(name: string): boolean;
    /**
     * Execute the graph with the given initial state
     *
     * This is a generator function that yields the state after each node execution,
     * allowing for real-time monitoring of graph progress.
     *
     * @param state - Initial state
     * @param options - Execution options
     * @returns AsyncGenerator that yields intermediate states and returns final state
     */
    invoke(state: TState, options?: GraphExecutionOptions): AsyncGenerator<TState, TState, void>;
    /**
     * Execute the graph and return only the final state (convenience method)
     * @param state - Initial state
     * @param options - Execution options
     * @returns Promise resolving to final state
     */
    run(state: TState, options?: GraphExecutionOptions): Promise<TState>;
    /**
     * Get a summary of the graph structure (for debugging)
     */
    getSummary(): {
        name: string;
        entryPoint: string;
        nodeCount: number;
        nodes: string[];
        edges: Array<{
            from: string;
            to: string[];
        }>;
    };
}

/**
 * Fluent builder for constructing StateGraphs
 *
 * @example
 * ```typescript
 * const graph = new GraphBuilder<MyState>('my-workflow')
 *   .addNode('start', startNode)
 *   .addNode('process', processNode)
 *   .addNode('end', endNode)
 *   .addEdge('start', (state) => state.shouldProcess ? 'process' : 'end', {
 *     process: 'process',
 *     end: '__end__'
 *   })
 *   .addEdge('process', () => 'end', { end: '__end__' })
 *   .setEntryPoint('start')
 *   .build();
 * ```
 */
declare class GraphBuilder<TState> {
    private graph;
    constructor(name: string, config?: Omit<StateGraphConfig, 'name'>);
    /**
     * Add a node to the graph
     * @param name - Node name
     * @param node - Node implementation
     * @returns This builder for chaining
     */
    addNode(name: string, node: Runnable<TState, TState>): this;
    /**
     * Add conditional edges from a node
     * @param sourceName - Source node name
     * @param condition - Condition function
     * @param targetMap - Target map
     * @returns This builder for chaining
     */
    addEdge(sourceName: string, condition: (state: TState) => string, targetMap: Record<string, string>): this;
    /**
     * Add a simple edge that always goes to the same target
     * @param sourceName - Source node name
     * @param targetName - Target node name
     * @returns This builder for chaining
     */
    addSimpleEdge(sourceName: string, targetName: string): this;
    /**
     * Set the entry point
     * @param name - Entry point node name
     * @returns This builder for chaining
     */
    setEntryPoint(name: string): this;
    /**
     * Build the final graph
     * @returns The constructed StateGraph
     */
    build(): StateGraph<TState>;
}
/**
 * Create a simple node from an async function
 * @param fn - Async function that transforms state
 * @returns Runnable node
 */
declare function createNode<TState>(fn: (state: TState, signal?: AbortSignal) => Promise<TState>): Runnable<TState, TState>;
/**
 * Create a node that applies a synchronous transformation
 * @param fn - Synchronous function that transforms state
 * @returns Runnable node
 */
declare function createSyncNode<TState>(fn: (state: TState) => TState): Runnable<TState, TState>;
/**
 * Create a passthrough node (useful for debugging)
 * @returns Runnable node that returns state unchanged
 */
declare function createPassthroughNode<TState>(): Runnable<TState, TState>;

/**
 * Browser Operator AI Agent SDK
 *
 * Production-ready SDK for building multi-agent AI systems with LLM support.
 *
 * @packageDocumentation
 */

declare const VERSION = "0.1.0";

export { AgentErrorHandler, type AgentMessage, type AgentRunTerminationReason, AgentRunner, type AgentRunnerConfig, AgentRunnerEventBus, type AgentRunnerHooks, type AgentRunnerProgressEvent, type AgentSession, type AgentSessionMessage, type AgentToolCallMessage, type AgentToolConfig, type AgentToolResultMessage, type AgentUIConfig, type BaseChatMessage, type CallContext, type ChatMessage, ChatMessageEntity, type ConditionFunction, type ConditionalEdge, type ConfigurableAgentArgs, type ConfigurableAgentResult, ConfigurableAgentTool, DEFAULT_AGENT_UI, END_NODE, type ErrorHandlingConfig, type ErrorHandlingResult, type FinalAnswerMessage, GraphAbortedError, GraphBuilder, type GraphExecutionOptions, GraphMaxStepsError, type GraphProgressCallback, type GraphProgressEvent, type HandoffConfig, type HandoffMessage, type HandoffTrigger, type ImageInputData, LLMMessage, LLMProvider, LogLevel, Logger, type LoggerConfig, MODEL_SENTINELS, type ModelChatMessage, NodeNotFoundError, type ProgressCallback, type ReasoningMessage, RoutingError, type Runnable, StateGraph, type StateGraphConfig, type TargetMap, type Tool, type ToolContext, type ToolExecutionResult, type ToolFactory, ToolRegistry, type ToolResultMessage, type UserChatMessage, VERSION, createLogger, createModelMessage, createNode, createPassthroughNode, createSyncNode, createToolResult, createToolResultMessage, createUserMessage, errorResult, formatAgentName, getAgentDescription, getAgentDisplayName, getAgentUIConfig, getGlobalLogLevel, setGlobalLogLevel, successResult };
