export { ErrorRetryConfig, ExtendedRetryConfig, FileContent, ImageContent, LLMBaseProvider, LLMCallOptions, LLMErrorType, LLMMessage, LLMProvider, LLMProviderInterface, LLMProviderRegistry, LLMResponse, LLMResponseParser, MessageContent, ModelCapabilities, ModelInfo, ModelOption, ParsedLLMAction, RetryCallback, RetryConfig, SanitizationOptions, TextContent, UnifiedLLMOptions, UnifiedLLMResponse, sanitizeMessagesForModel } from './llm/index.mjs';

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
 * Browser Operator AI Agent SDK
 *
 * Production-ready SDK for building multi-agent AI systems with LLM support.
 *
 * @packageDocumentation
 */

declare const VERSION = "0.1.0";

export { LogLevel, Logger, type LoggerConfig, VERSION, createLogger, getGlobalLogLevel, setGlobalLogLevel };
