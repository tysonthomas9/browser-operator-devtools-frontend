import { ToolSet, AgentConfig, ExecutionOptions, AgentResult } from '../types/index.cjs';
export { AgentContext, AgentState } from '../types/index.cjs';
import { I as ILLMProvider } from '../types-SSahUagS.cjs';
import { AgentEventMap } from '../events/index.cjs';

/**
 * Main Agent class - Browser-compatible
 * Extracted and adapted from front_end/panels/ai_chat/agent_framework/AgentRunner.ts
 */

/**
 * Agent class for executing LLM-based agents with tools
 * Browser-compatible - uses fetch() API
 */
declare class Agent<TTools extends ToolSet = ToolSet> {
    private config;
    private eventEmitter;
    private sessionId;
    private provider;
    private runtimeContext;
    constructor(config: AgentConfig<TTools>, provider: ILLMProvider, runtimeContext?: Record<string, unknown>);
    /**
     * Generate text response
     */
    generateText(input: string, options?: ExecutionOptions): Promise<AgentResult>;
    /**
     * Stream text response
     */
    streamText(input: string, options?: ExecutionOptions): AsyncIterable<string>;
    /**
     * Subscribe to agent events
     */
    on<E extends keyof AgentEventMap>(event: E, handler: (payload: AgentEventMap[E]) => void): void;
    /**
     * Unsubscribe from agent events
     */
    off<E extends keyof AgentEventMap>(event: E, handler: (payload: AgentEventMap[E]) => void): void;
    /**
     * Get agent configuration
     */
    getConfig(): AgentConfig<TTools>;
    /**
     * Get session ID
     */
    getSessionId(): string;
    /**
     * Execute a tool using the tool system
     */
    private executeTool;
    /**
     * Convert tools to OpenAI function format
     */
    private convertToolsToLLMFormat;
    /**
     * Create agent context
     */
    private createContext;
    /**
     * Convert chat messages to LLM format
     */
    private convertToLLMMessages;
    /**
     * Map LLM finish reason to agent finish reason
     */
    private mapFinishReason;
    /**
     * Generate unique session ID
     */
    private generateSessionId;
}

export { Agent, AgentConfig, AgentResult, ExecutionOptions };
