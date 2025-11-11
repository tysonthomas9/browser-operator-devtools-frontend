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

/**
 * Utility class for classifying errors that occur during LLM calls
 */
declare class LLMErrorClassifier {
    /**
     * Classify an error based on its message and properties
     */
    static classifyError(error: Error): LLMErrorType;
    /**
     * Check if an error type should be retried
     */
    static shouldRetry(errorType: LLMErrorType): boolean;
    /**
     * Get the retry configuration for a specific error type
     */
    static getRetryConfig(errorType: LLMErrorType, customConfig?: Partial<RetryConfig>): RetryConfig;
}
/**
 * Manages retry logic for LLM operations with exponential backoff and jitter
 */
declare class LLMRetryManager {
    private config;
    private onRetry?;
    constructor(config?: ExtendedRetryConfig);
    /**
     * Execute an operation with retry logic
     */
    executeWithRetry<T>(operation: () => Promise<T>, options?: {
        customRetryConfig?: Partial<RetryConfig>;
        context?: string;
    }): Promise<T>;
    /**
     * Calculate retry delay with exponential backoff and jitter
     */
    private calculateDelay;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Static convenience method for simple retry scenarios
     */
    static simpleRetry<T>(operation: () => Promise<T>, customConfig?: Partial<RetryConfig>): Promise<T>;
}
/**
 * Static utility functions for common error handling scenarios
 */
declare class LLMErrorUtils {
    /**
     * Check if an error is retryable
     */
    static isRetryable(error: Error): boolean;
    /**
     * Get human-readable error message
     */
    static getErrorMessage(error: Error): string;
    /**
     * Create enhanced error with additional context
     */
    static enhanceError(error: Error, context: {
        operation?: string;
        attempt?: number;
    }): Error;
}

/**
 * Configuration for individual LLM providers
 */
interface LLMProviderConfig {
    provider: LLMProvider;
    apiKey: string;
    providerURL?: string;
}
/**
 * Configuration for the LLM client
 */
interface LLMClientConfig {
    providers: LLMProviderConfig[];
}
/**
 * Request structure for LLM calls
 */
interface LLMCallRequest {
    provider: LLMProvider;
    model: string;
    messages: LLMMessage[];
    systemPrompt: string;
    tools?: any[];
    temperature?: number;
    retryConfig?: Partial<RetryConfig>;
    agentName?: string;
}
/**
 * Main LLM client coordinator that provides a unified interface for agents
 *
 * The LLMClient is a singleton that manages provider instances and routes
 * LLM calls to the appropriate provider based on configuration.
 *
 * @example
 * ```typescript
 * // Initialize the client with providers
 * const client = LLMClient.getInstance();
 * await client.initialize({
 *   providers: [
 *     { provider: 'openai', apiKey: 'sk-...' },
 *     { provider: 'litellm', apiKey: '', providerURL: 'http://localhost:4000' }
 *   ]
 * });
 *
 * // Make a call
 * const response = await client.call({
 *   provider: 'openai',
 *   model: 'gpt-4.1-2025-04-14',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   systemPrompt: 'You are a helpful assistant.',
 *   temperature: 0.7
 * });
 * ```
 */
declare class LLMClient {
    private static instance;
    private initialized;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): LLMClient;
    /**
     * Initialize the LLM client with provider configurations
     *
     * This method must be called before making any LLM calls. It registers
     * the configured providers with the LLMProviderRegistry.
     *
     * @param config - Configuration specifying which providers to initialize
     */
    initialize(config: LLMClientConfig): Promise<void>;
    /**
     * Check if the client is initialized
     */
    private ensureInitialized;
    /**
     * Main method for LLM calls with request object
     *
     * @param request - Complete request specification including provider, model, messages, etc.
     * @returns Promise resolving to the LLM response
     */
    call(request: LLMCallRequest): Promise<LLMResponse>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse>;
    /**
     * Get all available models from all providers
     */
    getAvailableModels(): Promise<ModelInfo[]>;
    /**
     * Get models for a specific provider
     */
    getModelsByProvider(provider: LLMProvider): Promise<ModelInfo[]>;
    /**
     * Test connection to a specific model
     */
    testConnection(provider: LLMProvider, modelId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Refresh models for a specific provider or all providers
     */
    refreshProviderModels(provider?: LLMProvider): Promise<void>;
    /**
     * Get registry statistics
     */
    getStats(): {
        initialized: boolean;
        providersCount: number;
        providers: LLMProvider[];
    };
}

/**
 * OpenAI provider implementation using the Responses API
 *
 * Supports both GPT models (gpt-4.1, etc.) and O-series models (o3-mini, o4-mini)
 * with different parameter handling for each family.
 */
declare class OpenAIProvider extends LLMBaseProvider {
    private readonly apiKey;
    private static readonly API_ENDPOINT;
    readonly name: LLMProvider;
    constructor(apiKey: string);
    /**
     * Determines the model family based on the model name
     */
    private getModelFamily;
    /**
     * Converts tools from standard format to responses API format
     */
    private convertToolsFormat;
    /**
     * Convert MessageContent to Responses API format based on model family
     * Throws error if conversion fails
     */
    private convertContentToResponsesAPI;
    /**
     * Converts messages to responses API format based on model family
     */
    private convertMessagesToResponsesAPI;
    /**
     * Processes the responses API output and extracts relevant information
     */
    private processResponsesAPIOutput;
    /**
     * Makes a request to the OpenAI Responses API
     */
    private makeAPIRequest;
    /**
     * Call the OpenAI API with messages
     */
    callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Simple call method for backward compatibility
     */
    call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Get all OpenAI models supported by this provider
     */
    getModels(): Promise<ModelInfo[]>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse>;
    /**
     * Validate that required credentials are available for OpenAI
     * Platform-agnostic version - just checks if API key was provided
     */
    validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    /**
     * Get the storage keys this provider uses for credentials
     * Note: This is platform-specific and may not be used in all environments
     */
    getCredentialStorageKeys(): {
        apiKey: string;
    };
}

/**
 * LiteLLM model information from /v1/models endpoint
 */
interface LiteLLMModel {
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
}
interface LiteLLMModelsResponse {
    object: string;
    data: LiteLLMModel[];
}
/**
 * LiteLLM provider implementation using OpenAI-compatible format
 */
declare class LiteLLMProvider extends LLMBaseProvider {
    private readonly apiKey;
    private readonly baseUrl?;
    private readonly customModels?;
    private static readonly DEFAULT_BASE_URL;
    private static readonly CHAT_COMPLETIONS_PATH;
    private static readonly MODELS_PATH;
    readonly name: LLMProvider;
    constructor(apiKey: string | null, baseUrl?: string | undefined, customModels?: Array<{
        id: string;
        name: string;
    }> | undefined);
    /**
     * Constructs the full endpoint URL based on configuration
     */
    private getEndpoint;
    /**
     * Gets the models endpoint URL
     */
    private getModelsEndpoint;
    /**
     * Converts LLMMessage format to OpenAI format
     */
    private convertMessagesToOpenAI;
    /**
     * Makes a request to the LiteLLM API
     */
    private makeAPIRequest;
    /**
     * Processes the LiteLLM response and converts to LLMResponse format
     */
    private processLiteLLMResponse;
    /**
     * Call the LiteLLM API with messages
     */
    callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Simple call method for backward compatibility
     */
    call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse>;
    /**
     * Fetch available models from LiteLLM endpoint
     */
    fetchModels(): Promise<LiteLLMModel[]>;
    /**
     * Get all models supported by this provider
     */
    getModels(): Promise<ModelInfo[]>;
    /**
     * Test the LiteLLM connection with a simple completion request
     */
    testConnection(modelName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Validate that required credentials are available for LiteLLM
     * Platform-agnostic version - just checks if baseUrl was provided
     */
    validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    /**
     * Get the storage keys this provider uses for credentials
     * Note: This is platform-specific and may not be used in all environments
     */
    getCredentialStorageKeys(): {
        apiKey: string;
        endpoint: string;
    };
}

/**
 * Groq model information
 */
interface GroqModel {
    id: string;
    object: string;
    created: number;
    owned_by: string;
    active: boolean;
    context_window: number;
}
interface GroqModelsResponse {
    object: string;
    data: GroqModel[];
}
/**
 * Groq provider implementation using OpenAI-compatible Chat Completions API
 * https://console.groq.com/docs/api-reference#chat
 */
declare class GroqProvider extends LLMBaseProvider {
    private readonly apiKey;
    private static readonly API_BASE_URL;
    private static readonly CHAT_COMPLETIONS_PATH;
    private static readonly MODELS_PATH;
    readonly name: LLMProvider;
    constructor(apiKey: string);
    /**
     * Get the chat completions endpoint URL
     */
    private getChatEndpoint;
    /**
     * Get the models endpoint URL
     */
    private getModelsEndpoint;
    /**
     * Converts LLMMessage format to Groq/OpenAI format
     */
    private convertMessagesToGroq;
    /**
     * Makes a request to the Groq API
     */
    private makeAPIRequest;
    /**
     * Processes the Groq response and converts to LLMResponse format
     */
    private processGroqResponse;
    /**
     * Call the Groq API with messages
     */
    callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Simple call method for backward compatibility
     */
    call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse>;
    /**
     * Fetch available models from Groq API
     */
    fetchModels(): Promise<GroqModel[]>;
    /**
     * Get all models supported by this provider
     */
    getModels(): Promise<ModelInfo[]>;
    /**
     * Check if a model supports function calling based on its ID
     */
    private modelSupportsFunctionCalling;
    /**
     * Check if a model supports vision based on its ID
     */
    private modelSupportsVision;
    /**
     * Get default list of known Groq models
     */
    private getDefaultModels;
    /**
     * Test the Groq connection with a simple completion request
     */
    testConnection(modelName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Validate that required credentials are available for Groq
     * Platform-agnostic version - just checks if API key was provided
     */
    validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    /**
     * Get the storage keys this provider uses for credentials
     * Note: This is platform-specific and may not be used in all environments
     */
    getCredentialStorageKeys(): {
        apiKey: string;
    };
}

/**
 * OpenRouter model information
 */
interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    pricing: {
        prompt: string;
        completion: string;
    };
    context_length: number;
    architecture: {
        modality: string;
        tokenizer: string;
        instruct_type?: string;
        input_modalities?: string[];
        output_modalities?: string[];
    };
    top_provider: {
        context_length: number;
        max_completion_tokens?: number;
    };
    per_request_limits?: {
        prompt_tokens: string;
        completion_tokens: string;
    };
}
interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}
/**
 * OpenRouter provider implementation using OpenAI-compatible Chat Completions API
 * https://openrouter.ai/docs/api-reference
 */
declare class OpenRouterProvider extends LLMBaseProvider {
    private readonly apiKey;
    private static readonly API_BASE_URL;
    private static readonly CHAT_COMPLETIONS_PATH;
    private static readonly MODELS_PATH;
    readonly name: LLMProvider;
    private visionModelsCache;
    private visionModelsCacheExpiry;
    private static readonly CACHE_DURATION_MS;
    constructor(apiKey: string);
    /**
     * Check if a model doesn't support temperature parameter
     * OpenAI's GPT-5, O3, and O4 models accessed through OpenRouter don't support temperature
     */
    private shouldExcludeTemperature;
    /**
     * Get the chat completions endpoint URL
     */
    private getChatEndpoint;
    /**
     * Get the models endpoint URL with tool support filter
     */
    private getToolSupportingModelsEndpoint;
    /**
     * Get the models endpoint URL with tool support filter
     * We'll filter for vision capabilities client-side since OpenRouter uses union logic
     */
    private getVisionModelsEndpoint;
    /**
     * Converts LLMMessage format to OpenRouter/OpenAI format
     */
    private convertMessagesToOpenRouter;
    /**
     * Makes a request to the OpenRouter API
     */
    private makeAPIRequest;
    /**
     * Processes the OpenRouter response and converts to LLMResponse format
     */
    private processOpenRouterResponse;
    /**
     * Call the OpenRouter API with messages
     */
    callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Simple call method for backward compatibility
     */
    call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse>;
    /**
     * Fetch available models from OpenRouter API that support tool calls
     */
    fetchModels(): Promise<OpenRouterModel[]>;
    /**
     * Fetch available vision models from OpenRouter API
     */
    fetchVisionModels(): Promise<OpenRouterModel[]>;
    /**
     * Get all models supported by this provider
     */
    getModels(): Promise<ModelInfo[]>;
    /**
     * Check if a model supports function calling based on its metadata
     */
    private modelSupportsFunctionCalling;
    /**
     * Check if a model supports reasoning based on its metadata
     */
    private modelSupportsReasoning;
    /**
     * Check if a model supports vision based on its metadata
     */
    private modelSupportsVision;
    /**
     * Check if a specific model supports vision with API-based detection
     */
    supportsVision(modelName: string): Promise<boolean>;
    /**
     * Get default list of popular OpenRouter models
     */
    private getDefaultModels;
    /**
     * Test the OpenRouter connection with a simple completion request
     */
    testConnection(modelName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Validate that required credentials are available for OpenRouter
     * Platform-agnostic version - just checks if API key was provided
     */
    validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    /**
     * Get the storage keys this provider uses for credentials
     * Note: This is platform-specific and may not be used in all environments
     */
    getCredentialStorageKeys(): {
        apiKey: string;
    };
}

/**
 * BrowserOperator provider implementation
 *
 * Connects to the BrowserOperator API server which acts as a unified proxy
 * for multiple LLM providers (OpenAI, Cerebras, Groq).
 *
 * Features:
 * - Agent-based semantic routing via X-Agent header
 * - Model abstraction using main/mini/nano aliases
 * - Built-in retry and fallback handled by API server
 * - OpenAI-compatible API
 */
declare class BrowserOperatorProvider extends LLMBaseProvider {
    private readonly apiKey;
    private readonly baseUrl?;
    private static readonly DEFAULT_BASE_URL;
    private static readonly CHAT_COMPLETIONS_PATH;
    private static readonly HEALTH_PATH;
    readonly name: LLMProvider;
    constructor(apiKey: string | null, baseUrl?: string | undefined);
    /**
     * Constructs the full endpoint URL
     */
    private getEndpoint;
    /**
     * Gets the health check endpoint URL
     */
    private getHealthEndpoint;
    /**
     * Converts LLMMessage format to OpenAI-compatible format
     */
    private convertMessagesToOpenAI;
    /**
     * Makes a request to the BrowserOperator API server
     */
    private makeAPIRequest;
    /**
     * Processes the BrowserOperator response and converts to LLMResponse format
     */
    private processBrowserOperatorResponse;
    /**
     * Call the BrowserOperator API with messages
     */
    callWithMessages(modelName: string, messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Simple call method for backward compatibility
     */
    call(modelName: string, prompt: string, systemPrompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
    /**
     * Parse response into standardized action structure
     */
    parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse>;
    /**
     * Get all models supported by this provider
     * Returns static list of model aliases - API server handles provider-specific mapping
     */
    getModels(): Promise<ModelInfo[]>;
    /**
     * Test the BrowserOperator connection with a health check
     */
    testConnection(modelName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Validate that required credentials are available for BrowserOperator
     * Platform-agnostic version - credentials are optional
     */
    validateCredentials(): {
        isValid: boolean;
        message: string;
        missingItems?: string[];
    };
    /**
     * Get the storage keys this provider uses for credentials
     * Note: This is platform-specific and may not be used in all environments
     */
    getCredentialStorageKeys(): {
        apiKey?: string;
    };
}

export { BrowserOperatorProvider, type ErrorRetryConfig, type ExtendedRetryConfig, type FileContent, type GroqModel, type GroqModelsResponse, GroqProvider, type ImageContent, LLMBaseProvider, type LLMCallOptions, type LLMCallRequest, LLMClient, type LLMClientConfig, LLMErrorClassifier, LLMErrorType, LLMErrorUtils, type LLMMessage, type LLMProvider, type LLMProviderConfig, type LLMProviderInterface, LLMProviderRegistry, type LLMResponse, LLMResponseParser, LLMRetryManager, type LiteLLMModel, type LiteLLMModelsResponse, LiteLLMProvider, type MessageContent, type ModelCapabilities, type ModelInfo, type ModelOption, OpenAIProvider, type OpenRouterModel, type OpenRouterModelsResponse, OpenRouterProvider, type ParsedLLMAction, type RetryCallback, type RetryConfig, type SanitizationOptions, type TextContent, type UnifiedLLMOptions, type UnifiedLLMResponse, sanitizeMessagesForModel };
