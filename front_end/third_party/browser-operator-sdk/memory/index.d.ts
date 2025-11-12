/**
 * Memory system types for agent conversation history and context management
 *
 * Following patterns from Mastra AI and similar agent frameworks
 */
/**
 * Message role types
 */
type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
/**
 * Memory message structure
 */
interface MemoryMessage {
    /**
     * Message role
     */
    role: MessageRole;
    /**
     * Message content
     */
    content: string | Array<{
        type: string;
        text?: string;
        image_url?: string;
    }>;
    /**
     * Optional message name (for tool messages)
     */
    name?: string;
    /**
     * Tool call ID (for tool messages)
     */
    tool_call_id?: string;
    /**
     * Timestamp when message was created
     */
    timestamp?: number;
    /**
     * Optional metadata
     */
    metadata?: Record<string, unknown>;
}
/**
 * Memory storage interface
 *
 * Defines how messages are stored and retrieved
 */
interface MemoryStorage {
    /**
     * Add a message to storage
     */
    add(message: MemoryMessage): Promise<void>;
    /**
     * Get all messages
     */
    getAll(): Promise<MemoryMessage[]>;
    /**
     * Get messages with optional filtering
     */
    get(options?: MemoryGetOptions): Promise<MemoryMessage[]>;
    /**
     * Search messages by content or metadata
     */
    search?(query: string, options?: MemorySearchOptions): Promise<MemoryMessage[]>;
    /**
     * Clear all messages
     */
    clear(): Promise<void>;
    /**
     * Get number of messages
     */
    count(): Promise<number>;
}
/**
 * Options for retrieving messages
 */
interface MemoryGetOptions {
    /**
     * Limit number of messages
     */
    limit?: number;
    /**
     * Offset for pagination
     */
    offset?: number;
    /**
     * Filter by role
     */
    role?: MessageRole;
    /**
     * Filter by timestamp range
     */
    since?: number;
    until?: number;
}
/**
 * Options for searching messages
 */
interface MemorySearchOptions extends MemoryGetOptions {
    /**
     * Search in metadata fields
     */
    searchMetadata?: boolean;
    /**
     * Case sensitive search
     */
    caseSensitive?: boolean;
}
/**
 * Memory configuration options
 */
interface MemoryConfig {
    /**
     * Storage adapter to use
     */
    storage: MemoryStorage;
    /**
     * Maximum number of messages to keep
     * Older messages will be removed
     */
    maxMessages?: number;
    /**
     * Maximum age of messages in milliseconds
     * Messages older than this will be removed
     */
    maxAge?: number;
    /**
     * Whether to automatically add timestamps
     */
    autoTimestamp?: boolean;
}
/**
 * Memory context for LLM
 */
interface MemoryContext {
    /**
     * Messages to include in context
     */
    messages: MemoryMessage[];
    /**
     * Total token count estimate (optional)
     */
    tokenCount?: number;
    /**
     * Summary of older messages (optional)
     */
    summary?: string;
}

/**
 * Conversation buffer memory for agents
 *
 * Manages conversation history with configurable limits and storage
 */

/**
 * Conversation buffer memory
 *
 * Stores and manages conversation history for agents.
 * Supports multiple storage adapters and automatic cleanup.
 *
 * @example
 * ```typescript
 * import { ConversationBufferMemory } from '@browser-operator/core/memory';
 *
 * const memory = new ConversationBufferMemory({
 *   maxMessages: 100,
 *   maxAge: 24 * 60 * 60 * 1000, // 24 hours
 * });
 *
 * // Add messages
 * await memory.addMessage('user', 'Hello!');
 * await memory.addMessage('assistant', 'Hi! How can I help?');
 *
 * // Get context for LLM
 * const context = await memory.getContext();
 * const messages = context.messages;
 * ```
 */
declare class ConversationBufferMemory {
    private storage;
    private maxMessages?;
    private maxAge?;
    private autoTimestamp;
    constructor(config?: Partial<MemoryConfig>);
    /**
     * Add a message to memory
     *
     * @example
     * ```typescript
     * await memory.addMessage('user', 'What is 2+2?');
     * await memory.addMessage('assistant', 'The answer is 4.');
     * ```
     */
    addMessage(role: MessageRole, content: string | Array<{
        type: string;
        text?: string;
        image_url?: string;
    }>, options?: {
        name?: string;
        tool_call_id?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    /**
     * Add a raw message object
     *
     * @example
     * ```typescript
     * await memory.add({
     *   role: 'user',
     *   content: 'Hello',
     *   metadata: { source: 'web' }
     * });
     * ```
     */
    add(message: MemoryMessage): Promise<void>;
    /**
     * Get all messages
     */
    getAll(): Promise<MemoryMessage[]>;
    /**
     * Get messages with filtering
     *
     * @example
     * ```typescript
     * // Get last 10 messages
     * const recent = await memory.get({ limit: 10 });
     *
     * // Get only user messages
     * const userMessages = await memory.get({ role: 'user' });
     *
     * // Get messages from last hour
     * const lastHour = await memory.get({
     *   since: Date.now() - 60 * 60 * 1000
     * });
     * ```
     */
    get(options?: MemoryGetOptions): Promise<MemoryMessage[]>;
    /**
     * Search messages by content
     *
     * @example
     * ```typescript
     * const results = await memory.search('error', {
     *   role: 'assistant',
     *   limit: 5
     * });
     * ```
     */
    search(query: string, options?: MemoryGetOptions): Promise<MemoryMessage[]>;
    /**
     * Get memory context for LLM
     *
     * Returns messages formatted for agent/LLM use with optional limits.
     *
     * @example
     * ```typescript
     * const context = await memory.getContext({ limit: 50 });
     * const messages = context.messages;
     *
     * // Use with agent
     * const response = await agent.generateText({
     *   messages: context.messages,
     *   prompt: 'Continue the conversation'
     * });
     * ```
     */
    getContext(options?: {
        limit?: number;
        includeSystem?: boolean;
    }): Promise<MemoryContext>;
    /**
     * Get formatted messages for OpenAI-style API
     *
     * Converts memory messages to the format expected by OpenAI and compatible APIs.
     *
     * @example
     * ```typescript
     * const messages = await memory.getMessages();
     * const response = await openai.chat.completions.create({
     *   model: 'gpt-4',
     *   messages: messages
     * });
     * ```
     */
    getMessages(options?: {
        limit?: number;
        includeSystem?: boolean;
    }): Promise<MemoryMessage[]>;
    /**
     * Clear all messages
     */
    clear(): Promise<void>;
    /**
     * Get number of messages in memory
     */
    count(): Promise<number>;
    /**
     * Clean up old messages based on limits
     */
    private cleanup;
    /**
     * Estimate token count for messages (rough approximation)
     */
    private estimateTokenCount;
    /**
     * Create a summary of the conversation
     *
     * Useful for creating compressed context when memory is full.
     *
     * @example
     * ```typescript
     * const summary = await memory.summarize();
     * console.log(summary);
     * // "Conversation started with greeting. User asked about..."
     * ```
     */
    summarize(): Promise<string>;
    /**
     * Get storage adapter
     */
    getStorage(): MemoryConfig['storage'];
    /**
     * Get configuration
     */
    getConfig(): {
        maxMessages?: number;
        maxAge?: number;
        autoTimestamp: boolean;
    };
}

/**
 * In-memory storage adapter for agent memory
 *
 * Simple, fast storage that keeps messages in memory.
 * Data is lost when the page reloads.
 */

/**
 * In-memory storage implementation
 *
 * @example
 * ```typescript
 * const storage = new InMemoryStorage();
 * await storage.add({ role: 'user', content: 'Hello!' });
 * const messages = await storage.getAll();
 * ```
 */
declare class InMemoryStorage implements MemoryStorage {
    private messages;
    /**
     * Add a message to storage
     */
    add(message: MemoryMessage): Promise<void>;
    /**
     * Get all messages
     */
    getAll(): Promise<MemoryMessage[]>;
    /**
     * Get messages with filtering
     */
    get(options?: MemoryGetOptions): Promise<MemoryMessage[]>;
    /**
     * Search messages by content
     */
    search(query: string, options?: MemorySearchOptions): Promise<MemoryMessage[]>;
    /**
     * Clear all messages
     */
    clear(): Promise<void>;
    /**
     * Get number of messages
     */
    count(): Promise<number>;
    /**
     * Get messages (for testing/debugging)
     */
    getMessagesSync(): MemoryMessage[];
}

/**
 * IndexedDB storage adapter for agent memory
 *
 * Persistent storage that survives page reloads.
 * Best for production use in browser environments.
 */

/**
 * IndexedDB storage implementation
 *
 * @example
 * ```typescript
 * const storage = new IndexedDBStorage('my-agent-memory');
 * await storage.add({ role: 'user', content: 'Hello!' });
 * const messages = await storage.getAll();
 * ```
 */
declare class IndexedDBStorage implements MemoryStorage {
    private dbName;
    private storeName;
    private version;
    private dbPromise;
    constructor(dbName?: string);
    /**
     * Initialize IndexedDB connection
     */
    private getDB;
    /**
     * Add a message to storage
     */
    add(message: MemoryMessage): Promise<void>;
    /**
     * Get all messages
     */
    getAll(): Promise<MemoryMessage[]>;
    /**
     * Get messages with filtering
     */
    get(options?: MemoryGetOptions): Promise<MemoryMessage[]>;
    /**
     * Search messages by content
     */
    search(query: string, options?: MemorySearchOptions): Promise<MemoryMessage[]>;
    /**
     * Clear all messages
     */
    clear(): Promise<void>;
    /**
     * Get number of messages
     */
    count(): Promise<number>;
    /**
     * Close database connection
     */
    close(): void;
}

export { ConversationBufferMemory, InMemoryStorage, IndexedDBStorage, type MemoryConfig, type MemoryContext, type MemoryGetOptions, type MemoryMessage, type MemorySearchOptions, type MemoryStorage, type MessageRole };
