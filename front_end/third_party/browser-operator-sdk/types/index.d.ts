/**
 * Core types for Browser Operator SDK
 * Extracted from front_end/panels/ai_chat/models/ChatTypes.ts
 */
/**
 * Message entity types
 */
declare enum ChatMessageEntity {
    USER = "user",
    MODEL = "model",
    TOOL_RESULT = "tool-result",
    TOOL_CALL = "tool-call"
}
/**
 * Base chat message interface
 */
interface BaseChatMessage {
    entity: ChatMessageEntity;
    id?: string;
    timestamp?: number;
}
/**
 * User message
 */
interface UserChatMessage extends BaseChatMessage {
    entity: ChatMessageEntity.USER;
    text: string;
    images?: ImageInputData[];
}
/**
 * Model message from LLM
 */
interface ModelChatMessage extends BaseChatMessage {
    entity: ChatMessageEntity.MODEL;
    text: string;
    toolCalls?: ToolCall[];
}
/**
 * Tool result message
 */
interface ToolResultMessage extends BaseChatMessage {
    entity: ChatMessageEntity.TOOL_RESULT;
    toolCallId: string;
    toolName: string;
    result: unknown;
    error?: string;
}
/**
 * Tool call message
 */
interface ToolCallMessage extends BaseChatMessage {
    entity: ChatMessageEntity.TOOL_CALL;
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
}
/**
 * Union type of all chat messages
 */
type ChatMessage = UserChatMessage | ModelChatMessage | ToolResultMessage | ToolCallMessage;
/**
 * Image input data for vision models
 */
interface ImageInputData {
    url?: string;
    base64?: string;
    mimeType?: string;
}
/**
 * Tool call from LLM
 */
interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
/**
 * Agent state interface
 * Extracted from front_end/panels/ai_chat/core/State.ts
 */
interface AgentState {
    messages: ChatMessage[];
    context?: Record<string, unknown>;
    error?: Error;
    metadata?: Record<string, unknown>;
    variables?: Record<string, unknown>;
}
/**
 * Agent configuration
 */
interface AgentConfig<TTools extends ToolSet = ToolSet> {
    /**
     * Agent name/identifier
     */
    name: string;
    /**
     * System instructions for the agent
     */
    instructions?: string;
    /**
     * LLM model to use (e.g., 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus')
     */
    model: string;
    /**
     * Tools available to the agent
     */
    tools?: TTools;
    /**
     * Maximum number of iterations
     */
    maxIterations?: number;
    /**
     * Temperature for LLM sampling
     */
    temperature?: number;
    /**
     * Agent hooks for customization
     */
    hooks?: AgentHooks;
    /**
     * Additional metadata
     */
    metadata?: Record<string, unknown>;
}
/**
 * Agent hooks for lifecycle events
 */
interface AgentHooks {
    /**
     * Called before agent starts
     */
    onStart?: (context: AgentContext) => Promise<void> | void;
    /**
     * Called before each iteration
     */
    onIteration?: (context: AgentContext, iteration: number) => Promise<void> | void;
    /**
     * Called before tool execution
     */
    onToolCall?: (context: AgentContext, toolCall: ToolCall) => Promise<void> | void;
    /**
     * Called after tool execution
     */
    onToolResult?: (context: AgentContext, result: unknown) => Promise<void> | void;
    /**
     * Called after agent completes
     */
    onFinish?: (context: AgentContext, result: AgentResult) => Promise<void> | void;
    /**
     * Called on error
     */
    onError?: (context: AgentContext, error: Error) => Promise<void> | void;
}
/**
 * Agent execution context
 */
interface AgentContext {
    state: AgentState;
    config: AgentConfig;
    sessionId: string;
    variables: Map<string | symbol, unknown>;
}
/**
 * Agent execution result
 */
interface AgentResult {
    text: string;
    toolCalls?: ToolCall[];
    finishReason: 'stop' | 'length' | 'tool-calls' | 'error' | 'max-iterations';
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    state: AgentState;
}
/**
 * Tool set type
 */
type ToolSet = Record<string, any>;
/**
 * Platform adapter interface for platform-specific functionality
 */
interface PlatformAdapter {
    /**
     * Get page context (URL, title, etc.)
     */
    getPageContext?(): Promise<PageContext>;
    /**
     * Execute a platform-specific action
     */
    executeAction?(action: Action): Promise<ActionResult>;
    /**
     * Capture screenshot
     */
    captureScreenshot?(): Promise<Buffer | string>;
    /**
     * Get accessibility tree
     */
    getAccessibilityTree?(): Promise<AccessibilityNode[]>;
}
/**
 * Page context
 */
interface PageContext {
    url?: string;
    title?: string;
    content?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Action to execute
 */
interface Action {
    type: string;
    target?: string;
    value?: unknown;
}
/**
 * Action result
 */
interface ActionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
/**
 * Accessibility node
 */
interface AccessibilityNode {
    role: string;
    name?: string;
    value?: string;
    children?: AccessibilityNode[];
}
/**
 * Execution options
 */
interface ExecutionOptions {
    abortSignal?: AbortSignal;
    maxIterations?: number;
    temperature?: number;
    streaming?: boolean;
}

export { type AccessibilityNode, type Action, type ActionResult, type AgentConfig, type AgentContext, type AgentHooks, type AgentResult, type AgentState, type BaseChatMessage, type ChatMessage, ChatMessageEntity, type ExecutionOptions, type ImageInputData, type ModelChatMessage, type PageContext, type PlatformAdapter, type ToolCall, type ToolCallMessage, type ToolResultMessage, type ToolSet, type UserChatMessage };
