/**
 * Core type definitions and interfaces for the unified LLM client system.
 * This file contains all shared types used across the LLM infrastructure.
 */
/**
 * Error types that can occur during LLM calls
 */
declare enum LLMErrorType {
    JSON_PARSE_ERROR = "JSON_PARSE_ERROR",
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    SERVER_ERROR = "SERVER_ERROR",
    AUTH_ERROR = "AUTH_ERROR",
    QUOTA_ERROR = "QUOTA_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
/**
 * Retry configuration for specific error types
 */
interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitterMs: number;
}
/**
 * Unified options for LLM calls that work across different providers
 */
interface UnifiedLLMOptions {
    systemPrompt: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    responseFormat?: any;
    n?: number;
    stream?: boolean;
    endpoint?: string;
    timeout?: number;
    signal?: AbortSignal;
    tools?: any[];
    tool_choice?: any;
    agentName?: string;
    strictJsonMode?: boolean;
    customRetryConfig?: Partial<RetryConfig>;
    maxRetries?: number;
}
/**
 * Unified response that includes function calls and parsed data
 */
interface UnifiedLLMResponse {
    text?: string;
    functionCall?: {
        name: string;
        arguments: any;
    };
    rawResponse?: any;
    reasoning?: {
        summary?: string[] | null;
        effort?: string;
    };
    parsedJson?: any;
}
/**
 * Model configuration from localStorage
 */
interface ModelOption {
    value: string;
    type: 'openai' | 'litellm';
    label?: string;
}
/**
 * Standardized structure for parsed LLM actions
 */
type ParsedLLMAction = {
    type: 'tool_call';
    name: string;
    args: Record<string, unknown>;
} | {
    type: 'final_answer';
    answer: string;
} | {
    type: 'error';
    error: string;
};
/**
 * Configuration for error-specific retry behavior
 */
interface ErrorRetryConfig {
    [LLMErrorType.RATE_LIMIT_ERROR]?: RetryConfig;
    [LLMErrorType.NETWORK_ERROR]?: RetryConfig;
    [LLMErrorType.JSON_PARSE_ERROR]?: RetryConfig;
    [LLMErrorType.SERVER_ERROR]?: RetryConfig;
    [LLMErrorType.AUTH_ERROR]?: RetryConfig;
    [LLMErrorType.QUOTA_ERROR]?: RetryConfig;
    [LLMErrorType.UNKNOWN_ERROR]?: RetryConfig;
}
/**
 * Callback for retry events (useful for logging and monitoring)
 */
interface RetryCallback {
    (attempt: number, error: Error, errorType: LLMErrorType, delayMs: number): void;
}
/**
 * Extended retry configuration with callbacks and custom settings
 */
interface ExtendedRetryConfig extends ErrorRetryConfig {
    defaultConfig?: RetryConfig;
    onRetry?: RetryCallback;
    maxTotalTimeMs?: number;
    enableLogging?: boolean;
}
/**
 * LLM Provider types
 */
type LLMProvider = 'openai' | 'litellm' | 'groq' | 'openrouter' | 'browseroperator';
/**
 * Content types for multimodal messages (text + images + files)
 */
type MessageContent = string | Array<TextContent | ImageContent | FileContent>;
interface TextContent {
    type: 'text';
    text: string;
}
interface ImageContent {
    type: 'image_url';
    image_url: {
        url: string;
        detail?: 'low' | 'high' | 'auto';
    };
}
interface FileContent {
    type: 'file';
    file: {
        filename: string;
        file_data: string;
    };
}
/**
 * Message format compatible with OpenAI and LiteLLM APIs
 * Supports both text-only and multimodal (text + images + PDFs) content
 */
interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: MessageContent;
    tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
    tool_call_id?: string;
    name?: string;
}
/**
 * Options for LLM calls
 */
interface LLMCallOptions {
    tools?: any[];
    tool_choice?: any;
    temperature?: number;
    reasoningLevel?: 'low' | 'medium' | 'high';
    retryConfig?: Partial<RetryConfig>;
    agentName?: string;
}
/**
 * Unified LLM response format
 */
interface LLMResponse {
    text?: string;
    functionCall?: {
        name: string;
        arguments: any;
    };
    rawResponse: any;
    reasoning?: {
        summary?: string[] | null;
        effort?: string;
    };
}
/**
 * Model capabilities
 */
interface ModelCapabilities {
    functionCalling: boolean;
    reasoning: boolean;
    vision: boolean;
    structured: boolean;
}
/**
 * Model information with provider and capabilities
 */
interface ModelInfo {
    id: string;
    name: string;
    provider: LLMProvider;
    capabilities?: ModelCapabilities;
}

/**
 * Base interface that all LLM providers must implement
 */
interface LLMProviderInterface {
    /** Provider name/type */
    readonly name: LLMProvider;
    /**
     * Execute a chat completion request with messages
     */
    callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Simple call method for backward compatibility
     */
    call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Get all models supported by this provider
     */
    getModels(): Promise<ModelInfo[]>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): any;
    /**
     * Test connection to a specific model (optional)
     */
    testConnection?(modelId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Validate that required credentials are available for this provider
     * @returns Object with validation result and user-friendly message
     */
    validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    /**
     * Get the credential keys this provider uses
     * @returns Object with credential key names this provider needs
     */
    getCredentialStorageKeys(): {
        apiKey?: string;
        endpoint?: string;
        [key: string]: string | undefined;
    };
}
/**
 * Abstract base class providing common functionality for providers
 */
declare abstract class LLMBaseProvider implements LLMProviderInterface {
    protected config: any;
    abstract readonly name: LLMProvider;
    constructor(config?: any);
    abstract callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    abstract call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    abstract getModels(): Promise<ModelInfo[]>;
    abstract parseResponse(response: LLMResponse): any;
    abstract validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    abstract getCredentialStorageKeys(): {
        apiKey?: string;
        endpoint?: string;
        [key: string]: string | undefined;
    };
    /**
     * Helper method to handle provider-specific errors
     */
    protected handleProviderError(error: any, context: string): Error;
}

/**
 * Registry for managing LLM providers with distributed model ownership
 */
declare class LLMProviderRegistry {
    private static providers;
    /**
     * Register a provider instance
     */
    static registerProvider(providerType: LLMProvider, providerInstance: LLMProviderInterface): void;
    /**
     * Get a provider by type
     */
    static getProvider(providerType: LLMProvider): LLMProviderInterface | undefined;
    /**
     * Check if a provider is registered
     */
    static hasProvider(providerType: LLMProvider): boolean;
    /**
     * Get all models from all registered providers
     */
    static getAllModels(): Promise<ModelInfo[]>;
    /**
     * Get models for a specific provider
     */
    static getModelsByProvider(providerType: LLMProvider): Promise<ModelInfo[]>;
    /**
     * Get all registered provider types
     */
    static getRegisteredProviders(): LLMProvider[];
    /**
     * Clear all registrations (useful for testing)
     */
    static clear(): void;
    /**
     * Get registry statistics
     */
    static getStats(): {
        providersCount: number;
        providers: LLMProvider[];
    };
}

/**
 * Utility class for parsing and processing LLM responses
 */
declare class LLMResponseParser {
    /**
     * Parse strict JSON from LLM response, handling common formatting issues
     */
    static parseStrictJSON(text: string): any;
    /**
     * Parse unified response to determine action type
     * Equivalent to OpenAIClient.parseOpenAIResponse
     */
    static parseResponse(response: UnifiedLLMResponse): ParsedLLMAction;
    /**
     * Enhanced JSON parsing with multiple fallback strategies
     */
    static parseJSONWithFallbacks(text: string): any;
    /**
     * Validate and clean JSON response for strict mode
     */
    static validateStrictJSON(text: string): {
        isValid: boolean;
        cleaned?: string;
        error?: string;
    };
    /**
     * Extract structured data from free-form text response
     */
    static extractStructuredData(text: string, expectedFields: string[]): Record<string, any>;
    /**
     * Enhance response with parsed structured data
     */
    static enhanceResponse(response: UnifiedLLMResponse, options?: {
        strictJsonMode?: boolean;
        expectedFields?: string[];
    }): UnifiedLLMResponse;
    /**
     * Check if response appears to be valid JSON
     */
    static isValidJSON(text: string): boolean;
    /**
     * Get JSON parsing suggestions for failed responses
     */
    static getJSONParsingSuggestions(text: string): string[];
}

/**
 * Sanitization options for capability-aware message preparation.
 */
interface SanitizationOptions {
    visionCapable: boolean;
    /**
     * If true, when a message becomes empty after stripping image/file parts,
     * replace it with a concise placeholder string.
     */
    placeholderForImageOnly?: boolean;
}
/**
 * Remove image and file parts for models that do not support vision, while preserving
 * textual content and message roles. Ensures resulting messages remain valid for providers
 * that expect either string content or an array with only text parts.
 */
declare function sanitizeMessagesForModel(messages: LLMMessage[], options: SanitizationOptions): LLMMessage[];

export { type ErrorRetryConfig, type ExtendedRetryConfig, type FileContent, type ImageContent, LLMBaseProvider, type LLMCallOptions, LLMErrorType, type LLMMessage, type LLMProvider, type LLMProviderInterface, LLMProviderRegistry, type LLMResponse, LLMResponseParser, type MessageContent, type ModelCapabilities, type ModelInfo, type ModelOption, type ParsedLLMAction, type RetryCallback, type RetryConfig, type SanitizationOptions, type TextContent, type UnifiedLLMOptions, type UnifiedLLMResponse, sanitizeMessagesForModel };
