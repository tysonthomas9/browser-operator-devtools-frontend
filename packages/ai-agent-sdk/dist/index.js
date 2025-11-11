'use strict';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/llm/LLMTypes.ts
exports.LLMErrorType = void 0;
var init_LLMTypes = __esm({
  "src/llm/LLMTypes.ts"() {
    exports.LLMErrorType = /* @__PURE__ */ ((LLMErrorType2) => {
      LLMErrorType2["JSON_PARSE_ERROR"] = "JSON_PARSE_ERROR";
      LLMErrorType2["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
      LLMErrorType2["NETWORK_ERROR"] = "NETWORK_ERROR";
      LLMErrorType2["SERVER_ERROR"] = "SERVER_ERROR";
      LLMErrorType2["AUTH_ERROR"] = "AUTH_ERROR";
      LLMErrorType2["QUOTA_ERROR"] = "QUOTA_ERROR";
      LLMErrorType2["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
      return LLMErrorType2;
    })(exports.LLMErrorType || {});
  }
});

// src/llm/LLMProvider.ts
exports.LLMBaseProvider = void 0;
var init_LLMProvider = __esm({
  "src/llm/LLMProvider.ts"() {
    exports.LLMBaseProvider = class {
      constructor(config = {}) {
        this.config = config;
      }
      /**
       * Helper method to handle provider-specific errors
       */
      handleProviderError(error, context) {
        if (error instanceof Error) {
          return error;
        }
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          return new Error(`Network error in ${context}: ${error.message}`);
        }
        if (error.status) {
          return new Error(`HTTP ${error.status} error in ${context}: ${error.message || "Unknown error"}`);
        }
        return new Error(`Unknown error in ${context}: ${String(error)}`);
      }
    };
  }
});

// src/observability/Logger.ts
function createLogger(name, config) {
  return new exports.Logger(name, config);
}
function setGlobalLogLevel(level) {
  globalLogLevel = level;
}
function getGlobalLogLevel() {
  return globalLogLevel;
}
exports.LogLevel = void 0; exports.Logger = void 0; var globalLogLevel;
var init_Logger = __esm({
  "src/observability/Logger.ts"() {
    exports.LogLevel = /* @__PURE__ */ ((LogLevel2) => {
      LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
      LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
      LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
      LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
      LogLevel2[LogLevel2["NONE"] = 4] = "NONE";
      return LogLevel2;
    })(exports.LogLevel || {});
    exports.Logger = class {
      constructor(name, config = {}) {
        this.prefix = name;
        this.level = config.level ?? 1 /* INFO */;
        this.timestamp = config.timestamp ?? true;
      }
      formatMessage(level) {
        const timestamp = this.timestamp ? `[${(/* @__PURE__ */ new Date()).toISOString()}]` : "";
        return `${timestamp}[${level}][${this.prefix}]`;
      }
      shouldLog(level) {
        return level >= this.level;
      }
      debug(...args) {
        if (this.shouldLog(0 /* DEBUG */)) {
          console.debug(this.formatMessage("DEBUG"), ...args);
        }
      }
      info(...args) {
        if (this.shouldLog(1 /* INFO */)) {
          console.info(this.formatMessage("INFO"), ...args);
        }
      }
      warn(...args) {
        if (this.shouldLog(2 /* WARN */)) {
          console.warn(this.formatMessage("WARN"), ...args);
        }
      }
      error(...args) {
        if (this.shouldLog(3 /* ERROR */)) {
          console.error(this.formatMessage("ERROR"), ...args);
        }
      }
      setLevel(level) {
        this.level = level;
      }
      getLevel() {
        return this.level;
      }
    };
    globalLogLevel = 1 /* INFO */;
  }
});

// src/llm/LLMResponseParser.ts
var logger2; exports.LLMResponseParser = void 0;
var init_LLMResponseParser = __esm({
  "src/llm/LLMResponseParser.ts"() {
    init_Logger();
    logger2 = createLogger("LLMResponseParser");
    exports.LLMResponseParser = class {
      /**
       * Parse strict JSON from LLM response, handling common formatting issues
       */
      static parseStrictJSON(text) {
        let jsonText = text.trim();
        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        const jsonMatch = jsonText.match(/\{.*\}/s) || jsonText.match(/\[.*\]/s);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        try {
          return JSON.parse(jsonText);
        } catch (error) {
          logger2.error("Failed to parse JSON after cleanup:", {
            original: text,
            cleaned: jsonText,
            error: error instanceof Error ? error.message : String(error)
          });
          throw new Error(`Unable to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      /**
       * Parse unified response to determine action type
       * Equivalent to OpenAIClient.parseOpenAIResponse
       */
      static parseResponse(response) {
        if (response.functionCall) {
          return {
            type: "tool_call",
            name: response.functionCall.name,
            args: response.functionCall.arguments
          };
        }
        if (response.text) {
          const rawContent = response.text;
          if (rawContent.trim().startsWith("{") && rawContent.includes('"action":"tool"')) {
            try {
              const contentJson = JSON.parse(rawContent);
              if (contentJson.action === "tool" && contentJson.toolName) {
                return {
                  type: "tool_call",
                  name: contentJson.toolName,
                  args: contentJson.toolArgs || {}
                };
              }
              return { type: "final_answer", answer: rawContent };
            } catch (e) {
              return { type: "final_answer", answer: rawContent };
            }
          } else {
            return { type: "final_answer", answer: rawContent };
          }
        }
        return {
          type: "error",
          error: "No valid response from LLM"
        };
      }
      /**
       * Enhanced JSON parsing with multiple fallback strategies
       */
      static parseJSONWithFallbacks(text) {
        const strategies = [
          // Strategy 1: Direct parsing
          () => JSON.parse(text),
          // Strategy 2: Trim and parse
          () => JSON.parse(text.trim()),
          // Strategy 3: Remove markdown code blocks
          () => {
            let cleaned = text.trim();
            if (cleaned.startsWith("```json")) {
              cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
            } else if (cleaned.startsWith("```")) {
              cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
            }
            return JSON.parse(cleaned);
          },
          // Strategy 4: Extract JSON from text
          () => {
            const jsonMatch = text.match(/\{.*\}/s) || text.match(/\[.*\]/s);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
            throw new Error("No JSON found in text");
          },
          // Strategy 5: Fix common JSON issues
          () => {
            let fixed = text.trim();
            fixed = fixed.replace(/'/g, '"');
            fixed = fixed.replace(/,(\s*[}\]])/g, "$1");
            fixed = fixed.replace(/(\w+):/g, '"$1":');
            return JSON.parse(fixed);
          }
        ];
        let lastError;
        for (let i = 0; i < strategies.length; i++) {
          try {
            const result = strategies[i]();
            if (i > 0) {
              logger2.warn(`JSON parsed using fallback strategy ${i + 1}`, {
                originalText: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
                strategy: i + 1
              });
            }
            return result;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            continue;
          }
        }
        logger2.error("All JSON parsing strategies failed:", {
          text: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
          lastError: lastError?.message
        });
        throw new Error(`JSON parsing failed: ${lastError?.message || "Unknown error"}`);
      }
      /**
       * Validate and clean JSON response for strict mode
       */
      static validateStrictJSON(text) {
        try {
          JSON.parse(text.trim());
          return { isValid: true, cleaned: text.trim() };
        } catch (directError) {
          try {
            const parsed = this.parseJSONWithFallbacks(text);
            const cleaned = JSON.stringify(parsed);
            return { isValid: true, cleaned };
          } catch (fallbackError) {
            return {
              isValid: false,
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            };
          }
        }
      }
      /**
       * Extract structured data from free-form text response
       */
      static extractStructuredData(text, expectedFields) {
        const result = {};
        try {
          const parsed = this.parseJSONWithFallbacks(text);
          if (typeof parsed === "object" && parsed !== null) {
            return parsed;
          }
        } catch {
        }
        for (const field of expectedFields) {
          const patterns = [
            new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, "i"),
            new RegExp(`${field}\\s*:\\s*"([^"]*)"`, "i"),
            new RegExp(`${field}\\s*:\\s*([^,}\\n]*)`, "i")
          ];
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              result[field] = match[1].trim();
              break;
            }
          }
        }
        return result;
      }
      /**
       * Enhance response with parsed structured data
       */
      static enhanceResponse(response, options = {}) {
        const enhanced = { ...response };
        if (options.strictJsonMode && response.text) {
          try {
            enhanced.parsedJson = this.parseStrictJSON(response.text);
          } catch (error) {
            logger2.error("Strict JSON parsing failed:", {
              error: error instanceof Error ? error.message : String(error),
              responseText: response.text
            });
          }
        }
        if (options.expectedFields && response.text) {
          try {
            const structuredData = this.extractStructuredData(response.text, options.expectedFields);
            if (Object.keys(structuredData).length > 0) {
              enhanced.parsedJson = { ...enhanced.parsedJson, ...structuredData };
            }
          } catch (error) {
            logger2.warn("Structured data extraction failed:", {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        return enhanced;
      }
      /**
       * Check if response appears to be valid JSON
       */
      static isValidJSON(text) {
        try {
          JSON.parse(text.trim());
          return true;
        } catch {
          return false;
        }
      }
      /**
       * Get JSON parsing suggestions for failed responses
       */
      static getJSONParsingSuggestions(text) {
        const suggestions = [];
        if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
          suggestions.push("Response should start with { or [");
        }
        if (!text.trim().endsWith("}") && !text.trim().endsWith("]")) {
          suggestions.push("Response should end with } or ]");
        }
        if (text.includes("'")) {
          suggestions.push(`Use double quotes (") instead of single quotes (')`);
        }
        if (text.match(/,(\s*[}\]])/)) {
          suggestions.push("Remove trailing commas before } or ]");
        }
        if (text.match(/\w+:/)) {
          suggestions.push("Ensure all object keys are quoted");
        }
        return suggestions;
      }
    };
  }
});

// src/llm/LLMErrorHandler.ts
var logger3, DEFAULT_RETRY_CONFIG, ERROR_SPECIFIC_RETRY_CONFIGS; exports.LLMErrorClassifier = void 0; exports.LLMRetryManager = void 0; exports.LLMErrorUtils = void 0;
var init_LLMErrorHandler = __esm({
  "src/llm/LLMErrorHandler.ts"() {
    init_Logger();
    init_LLMTypes();
    logger3 = createLogger("LLMErrorHandler");
    DEFAULT_RETRY_CONFIG = {
      maxRetries: 2,
      baseDelayMs: 1e3,
      maxDelayMs: 1e4,
      backoffMultiplier: 2,
      jitterMs: 500
    };
    ERROR_SPECIFIC_RETRY_CONFIGS = {
      ["RATE_LIMIT_ERROR" /* RATE_LIMIT_ERROR */]: {
        maxRetries: 3,
        baseDelayMs: 6e4,
        // 60 seconds for rate limits
        maxDelayMs: 3e5,
        // Max 5 minutes
        backoffMultiplier: 1,
        // No exponential backoff for rate limits
        jitterMs: 5e3
        // Small jitter to avoid thundering herd
      },
      ["NETWORK_ERROR" /* NETWORK_ERROR */]: {
        maxRetries: 3,
        baseDelayMs: 2e3,
        maxDelayMs: 3e4,
        backoffMultiplier: 2,
        jitterMs: 1e3
      }
    };
    exports.LLMErrorClassifier = class {
      /**
       * Classify an error based on its message and properties
       */
      static classifyError(error) {
        const message = error.message.toLowerCase();
        if (message.includes("json parsing failed") || message.includes("invalid json") || message.includes("json parse") || message.includes("unexpected token") || message.includes("syntaxerror")) {
          return "JSON_PARSE_ERROR" /* JSON_PARSE_ERROR */;
        }
        if (message.includes("rate limit") || message.includes("too many requests") || message.includes("quota exceeded") || message.includes("429") || message.includes("rate_limit_exceeded")) {
          return "RATE_LIMIT_ERROR" /* RATE_LIMIT_ERROR */;
        }
        if (message.includes("internal server error") || message.includes("502") || message.includes("503") || message.includes("504") || message.includes("500") || message.includes("server error") || message.includes("service unavailable")) {
          return "SERVER_ERROR" /* SERVER_ERROR */;
        }
        if (message.includes("fetch") || message.includes("network") || message.includes("connection") || message.includes("timeout") || message.includes("econnreset") || message.includes("enotfound") || message.includes("aborted") || message.includes("socket")) {
          return "NETWORK_ERROR" /* NETWORK_ERROR */;
        }
        if (message.includes("unauthorized") || message.includes("invalid api key") || message.includes("authentication") || message.includes("401") || message.includes("forbidden") || message.includes("403")) {
          return "AUTH_ERROR" /* AUTH_ERROR */;
        }
        if (message.includes("insufficient quota") || message.includes("billing") || message.includes("usage limit") || message.includes("quota_exceeded") || message.includes("insufficient_quota")) {
          return "QUOTA_ERROR" /* QUOTA_ERROR */;
        }
        return "UNKNOWN_ERROR" /* UNKNOWN_ERROR */;
      }
      /**
       * Check if an error type should be retried
       */
      static shouldRetry(errorType) {
        return errorType !== "AUTH_ERROR" /* AUTH_ERROR */ && errorType !== "QUOTA_ERROR" /* QUOTA_ERROR */;
      }
      /**
       * Get the retry configuration for a specific error type
       */
      static getRetryConfig(errorType, customConfig) {
        let config = { ...DEFAULT_RETRY_CONFIG };
        const errorSpecificConfig = ERROR_SPECIFIC_RETRY_CONFIGS[errorType];
        if (errorSpecificConfig) {
          config = { ...config, ...errorSpecificConfig };
        }
        if (customConfig) {
          config = { ...config, ...customConfig };
        }
        return config;
      }
    };
    exports.LLMRetryManager = class _LLMRetryManager {
      constructor(config = {}) {
        this.config = {
          defaultConfig: DEFAULT_RETRY_CONFIG,
          enableLogging: true,
          ...config
        };
        this.onRetry = config.onRetry;
      }
      /**
       * Execute an operation with retry logic
       */
      async executeWithRetry(operation, options = {}) {
        const startTime = Date.now();
        let lastError;
        let attempt = 1;
        while (true) {
          try {
            const result = await operation();
            if (attempt > 1 && this.config.enableLogging) {
              logger3.info(`Operation succeeded on attempt ${attempt}`, {
                context: options.context,
                totalTime: Date.now() - startTime
              });
            }
            return result;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorType = exports.LLMErrorClassifier.classifyError(lastError);
            if (this.config.enableLogging) {
              logger3.error(`Operation failed on attempt ${attempt}:`, {
                error: lastError.message,
                errorType,
                context: options.context
              });
            }
            if (!exports.LLMErrorClassifier.shouldRetry(errorType)) {
              if (this.config.enableLogging) {
                logger3.info(`Not retrying ${errorType} error`);
              }
              throw lastError;
            }
            const retryConfig = exports.LLMErrorClassifier.getRetryConfig(errorType, options.customRetryConfig);
            if (attempt > retryConfig.maxRetries) {
              if (this.config.enableLogging) {
                logger3.error(`Max retries (${retryConfig.maxRetries}) exceeded for ${errorType}`);
              }
              throw lastError;
            }
            if (this.config.maxTotalTimeMs && Date.now() - startTime >= this.config.maxTotalTimeMs) {
              if (this.config.enableLogging) {
                logger3.error(`Total retry time limit (${this.config.maxTotalTimeMs}ms) exceeded`);
              }
              throw lastError;
            }
            const delayMs = this.calculateDelay(retryConfig, attempt);
            if (this.config.enableLogging) {
              logger3.warn(`Retrying after ${delayMs}ms (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}) for ${errorType}`);
            }
            if (this.onRetry) {
              this.onRetry(attempt, lastError, errorType, delayMs);
            }
            if (delayMs > 0) {
              await this.sleep(delayMs);
            }
            attempt++;
          }
        }
      }
      /**
       * Calculate retry delay with exponential backoff and jitter
       */
      calculateDelay(config, attempt) {
        const baseDelay = config.baseDelayMs;
        const multiplier = config.backoffMultiplier;
        const maxDelay = config.maxDelayMs;
        const jitter = config.jitterMs;
        const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
        const cappedDelay = Math.min(exponentialDelay, maxDelay);
        const randomJitter = jitter > 0 ? Math.random() * jitter : 0;
        return Math.max(0, cappedDelay + randomJitter);
      }
      /**
       * Sleep for specified milliseconds
       */
      async sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      /**
       * Static convenience method for simple retry scenarios
       */
      static async simpleRetry(operation, customConfig) {
        const manager = new _LLMRetryManager();
        return manager.executeWithRetry(operation, { customRetryConfig: customConfig });
      }
    };
    exports.LLMErrorUtils = class {
      /**
       * Check if an error is retryable
       */
      static isRetryable(error) {
        const errorType = exports.LLMErrorClassifier.classifyError(error);
        return exports.LLMErrorClassifier.shouldRetry(errorType);
      }
      /**
       * Get human-readable error message
       */
      static getErrorMessage(error) {
        const errorType = exports.LLMErrorClassifier.classifyError(error);
        switch (errorType) {
          case "RATE_LIMIT_ERROR" /* RATE_LIMIT_ERROR */:
            return "Rate limit exceeded. Please wait before trying again.";
          case "NETWORK_ERROR" /* NETWORK_ERROR */:
            return "Network connection error. Please check your internet connection.";
          case "AUTH_ERROR" /* AUTH_ERROR */:
            return "Authentication failed. Please check your API key.";
          case "QUOTA_ERROR" /* QUOTA_ERROR */:
            return "API quota exceeded. Please check your usage limits.";
          case "SERVER_ERROR" /* SERVER_ERROR */:
            return "Server error. The service may be temporarily unavailable.";
          case "JSON_PARSE_ERROR" /* JSON_PARSE_ERROR */:
            return "Failed to parse response. The AI response was not in the expected format.";
          default:
            return error.message || "An unknown error occurred.";
        }
      }
      /**
       * Create enhanced error with additional context
       */
      static enhanceError(error, context) {
        const errorType = exports.LLMErrorClassifier.classifyError(error);
        const enhancedMessage = `${context.operation || "LLM operation"} failed with ${errorType}${context.attempt ? ` (attempt ${context.attempt})` : ""}: ${error.message}`;
        const enhancedError = new Error(enhancedMessage);
        enhancedError.originalError = error;
        enhancedError.errorType = errorType;
        enhancedError.context = context;
        return enhancedError;
      }
    };
  }
});

// src/llm/OpenAIProvider.ts
var OpenAIProvider_exports = {};
__export(OpenAIProvider_exports, {
  OpenAIProvider: () => exports.OpenAIProvider
});
var logger4, _OpenAIProvider; exports.OpenAIProvider = void 0;
var init_OpenAIProvider = __esm({
  "src/llm/OpenAIProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger4 = createLogger("OpenAIProvider");
    _OpenAIProvider = class _OpenAIProvider extends exports.LLMBaseProvider {
      constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.name = "openai";
      }
      /**
       * Determines the model family based on the model name
       */
      getModelFamily(modelName) {
        if (modelName.startsWith("o")) {
          return "o" /* O */;
        }
        if (modelName.includes("gpt-5")) {
          return "o" /* O */;
        }
        return "gpt" /* GPT */;
      }
      /**
       * Converts tools from standard format to responses API format
       */
      convertToolsFormat(tools) {
        return tools.map((tool) => {
          if (tool.type === "function" && tool.function) {
            return {
              type: "function",
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters || { type: "object", properties: {} }
            };
          }
          return tool;
        });
      }
      /**
       * Convert MessageContent to Responses API format based on model family
       * Throws error if conversion fails
       */
      convertContentToResponsesAPI(content, modelFamily) {
        if (modelFamily === "gpt" /* GPT */) {
          if (!content) {
            return "";
          }
          if (typeof content === "string") {
            return content;
          }
          if (Array.isArray(content)) {
            return content.map((item, index) => {
              if (item.type === "text") {
                return { type: "input_text", text: item.text };
              } else if (item.type === "image_url") {
                if (!item.image_url?.url) {
                  throw new Error(`Invalid image content at index ${index}: missing image_url.url`);
                }
                return { type: "input_image", image_url: item.image_url.url };
              } else {
                throw new Error(`Unknown content type at index ${index}: ${item.type}`);
              }
            });
          }
          return String(content);
        }
        if (!content) {
          return [{ type: "input_text", text: "" }];
        }
        if (typeof content === "string") {
          return [{ type: "input_text", text: content }];
        }
        if (Array.isArray(content)) {
          return content.map((item, index) => {
            if (item.type === "text") {
              return { type: "input_text", text: item.text };
            } else if (item.type === "image_url") {
              if (!item.image_url?.url) {
                throw new Error(`Invalid image content at index ${index}: missing image_url.url`);
              }
              return { type: "input_image", image_url: item.image_url.url };
            } else {
              throw new Error(`Unknown content type at index ${index}: ${item.type}`);
            }
          });
        }
        throw new Error(`Invalid content type: expected string or array, got ${typeof content}`);
      }
      /**
       * Converts messages to responses API format based on model family
       */
      convertMessagesToResponsesAPI(messages, modelFamily) {
        try {
          return messages.map((msg, index) => {
            if (msg.role === "system" || msg.role === "user") {
              return {
                role: msg.role,
                content: this.convertContentToResponsesAPI(msg.content, modelFamily)
              };
            } else if (msg.role === "assistant") {
              if (msg.tool_calls && msg.tool_calls.length > 0) {
                const toolCall = msg.tool_calls[0];
                let argsString;
                if (typeof toolCall.function.arguments === "string") {
                  argsString = toolCall.function.arguments;
                } else {
                  argsString = JSON.stringify(toolCall.function.arguments);
                }
                return {
                  type: "function_call",
                  name: toolCall.function.name,
                  arguments: argsString,
                  call_id: toolCall.id
                };
              } else {
                if (modelFamily === "o" /* O */) {
                  const content = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((c) => c.type === "text" ? c.text : "").join("") : String(msg.content || "");
                  return {
                    role: "assistant",
                    content: [{ type: "output_text", text: content }]
                  };
                } else {
                  return {
                    role: "assistant",
                    content: this.convertContentToResponsesAPI(msg.content, modelFamily)
                  };
                }
              }
            } else if (msg.role === "tool") {
              return {
                type: "function_call_output",
                call_id: msg.tool_call_id,
                output: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
              };
            }
            throw new Error(`Unknown message role at index ${index}: ${msg.role}`);
          });
        } catch (error) {
          logger4.error("Failed to convert messages to Responses API format:", error);
          throw new Error(`Message conversion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      /**
       * Processes the responses API output and extracts relevant information
       */
      processResponsesAPIOutput(data) {
        const result = {
          rawResponse: data
        };
        if (data.reasoning) {
          result.reasoning = {
            summary: data.reasoning.summary,
            effort: data.reasoning.effort
          };
        }
        if (!data?.output) {
          throw new Error("No output from OpenAI");
        }
        if (data.output && data.output.length > 0) {
          const functionCallOutput = data.output.find((item) => item.type === "function_call");
          const messageOutput = data.output.find((item) => item.type === "message");
          if (functionCallOutput) {
            try {
              result.functionCall = {
                name: functionCallOutput.name,
                arguments: JSON.parse(functionCallOutput.arguments)
              };
            } catch (error) {
              logger4.error("Error parsing function arguments:", error);
              result.functionCall = {
                name: functionCallOutput.name,
                arguments: functionCallOutput.arguments
                // Keep as string if parsing fails
              };
            }
          } else if (messageOutput?.content && messageOutput.content.length > 0 && messageOutput.content[0].type === "output_text") {
            result.text = messageOutput.content[0].text.trim();
          }
        }
        return result;
      }
      /**
       * Makes a request to the OpenAI Responses API
       */
      async makeAPIRequest(payloadBody) {
        try {
          const response = await fetch(_OpenAIProvider.API_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payloadBody)
          });
          if (!response.ok) {
            const errorData = await response.json();
            logger4.error("OpenAI API error:", JSON.stringify(errorData));
            throw new Error(`OpenAI API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger4.info("OpenAI Response:", data);
          if (data.usage) {
            logger4.info("OpenAI Usage:", { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens });
          }
          return data;
        } catch (error) {
          logger4.error("OpenAI API request failed:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      }
      /**
       * Call the OpenAI API with messages
       */
      async callWithMessages(modelName, messages, options) {
        return exports.LLMRetryManager.simpleRetry(async () => {
          logger4.debug("Calling OpenAI responses API...", { model: modelName, messageCount: messages.length });
          const modelFamily = this.getModelFamily(modelName);
          logger4.debug("Model Family:", modelFamily);
          const payloadBody = {
            model: modelName
          };
          const convertedMessages = this.convertMessagesToResponsesAPI(messages, modelFamily);
          payloadBody.input = convertedMessages;
          if (options?.temperature !== void 0 && modelFamily !== "o" /* O */) {
            payloadBody.temperature = options.temperature;
          }
          if (options?.tools) {
            payloadBody.tools = this.convertToolsFormat(options.tools);
          }
          if (options?.tool_choice) {
            payloadBody.tool_choice = options.tool_choice;
          }
          if (options?.reasoningLevel && modelFamily === "o" /* O */) {
            payloadBody.reasoning = {
              effort: options.reasoningLevel
            };
          }
          logger4.info("Request payload:", payloadBody);
          const data = await this.makeAPIRequest(payloadBody);
          return this.processResponsesAPIOutput(data);
        }, options?.retryConfig);
      }
      /**
       * Simple call method for backward compatibility
       */
      async call(modelName, prompt, systemPrompt, options) {
        const messages = [];
        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt
          });
        }
        messages.push({
          role: "user",
          content: prompt
        });
        return this.callWithMessages(modelName, messages, options);
      }
      /**
       * Get all OpenAI models supported by this provider
       */
      async getModels() {
        return [
          {
            id: "gpt-4.1-2025-04-14",
            name: "GPT-4.1",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "gpt-4.1-mini-2025-04-14",
            name: "GPT-4.1 Mini",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "gpt-4.1-nano-2025-04-14",
            name: "GPT-4.1 Nano",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "o4-mini-2025-04-16",
            name: "O4 Mini",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: true,
              vision: true,
              structured: true
            }
          },
          {
            id: "o3-mini-2025-01-31",
            name: "O3 Mini",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: true,
              vision: false,
              structured: true
            }
          },
          {
            id: "gpt-5-2025-08-07",
            name: "GPT-5",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: true,
              vision: true,
              structured: true
            }
          },
          {
            id: "gpt-5-mini-2025-08-07",
            name: "GPT-5 Mini",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: true,
              vision: true,
              structured: true
            }
          },
          {
            id: "gpt-5-nano-2025-08-07",
            name: "GPT-5 Nano",
            provider: "openai",
            capabilities: {
              functionCalling: true,
              reasoning: true,
              vision: true,
              structured: true
            }
          }
        ];
      }
      /**
       * Parse response into standardized action structure
       */
      parseResponse(response) {
        return exports.LLMResponseParser.parseResponse(response);
      }
      /**
       * Validate that required credentials are available for OpenAI
       * Platform-agnostic version - just checks if API key was provided
       */
      validateCredentials() {
        if (!this.apiKey) {
          return {
            isValid: false,
            message: "OpenAI API key is required. Please add your API key in Settings.",
            missingItems: ["API Key"]
          };
        }
        return {
          isValid: true,
          message: "OpenAI credentials are configured correctly."
        };
      }
      /**
       * Get the storage keys this provider uses for credentials
       * Note: This is platform-specific and may not be used in all environments
       */
      getCredentialStorageKeys() {
        return {
          apiKey: "ai_chat_api_key"
        };
      }
    };
    _OpenAIProvider.API_ENDPOINT = "https://api.openai.com/v1/responses";
    exports.OpenAIProvider = _OpenAIProvider;
  }
});

// src/llm/LiteLLMProvider.ts
var LiteLLMProvider_exports = {};
__export(LiteLLMProvider_exports, {
  LiteLLMProvider: () => exports.LiteLLMProvider
});
var logger5, _LiteLLMProvider; exports.LiteLLMProvider = void 0;
var init_LiteLLMProvider = __esm({
  "src/llm/LiteLLMProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger5 = createLogger("LiteLLMProvider");
    _LiteLLMProvider = class _LiteLLMProvider extends exports.LLMBaseProvider {
      constructor(apiKey, baseUrl, customModels) {
        super();
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.customModels = customModels;
        this.name = "litellm";
      }
      /**
       * Constructs the full endpoint URL based on configuration
       */
      getEndpoint() {
        if (!this.baseUrl) {
          throw new Error("LiteLLM endpoint not configured. Please provide baseUrl in constructor.");
        }
        const cleanBaseUrl = this.baseUrl.replace(/\/$/, "");
        return `${cleanBaseUrl}${_LiteLLMProvider.CHAT_COMPLETIONS_PATH}`;
      }
      /**
       * Gets the models endpoint URL
       */
      getModelsEndpoint() {
        const baseEndpoint = this.baseUrl || _LiteLLMProvider.DEFAULT_BASE_URL;
        return `${baseEndpoint.replace(/\/$/, "")}${_LiteLLMProvider.MODELS_PATH}`;
      }
      /**
       * Converts LLMMessage format to OpenAI format
       */
      convertMessagesToOpenAI(messages) {
        return messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          ...msg.tool_calls && { tool_calls: msg.tool_calls },
          ...msg.tool_call_id && { tool_call_id: msg.tool_call_id },
          ...msg.name && { name: msg.name }
        }));
      }
      /**
       * Makes a request to the LiteLLM API
       */
      async makeAPIRequest(payloadBody) {
        try {
          const endpoint = this.getEndpoint();
          logger5.debug("Using endpoint:", endpoint);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
            },
            body: JSON.stringify(payloadBody)
          });
          if (!response.ok) {
            const errorData = await response.json();
            logger5.error("LiteLLM API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`LiteLLM API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger5.info("LiteLLM Response:", data);
          if (data.usage) {
            logger5.info("LiteLLM Usage:", { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens });
          }
          return data;
        } catch (error) {
          logger5.error("LiteLLM API request failed:", error);
          throw error;
        }
      }
      /**
       * Processes the LiteLLM response and converts to LLMResponse format
       */
      processLiteLLMResponse(data) {
        const result = {
          rawResponse: data
        };
        if (!data?.choices || data.choices.length === 0) {
          throw new Error("No choices in LiteLLM response");
        }
        const choice = data.choices[0];
        const message = choice.message;
        if (!message) {
          throw new Error("No message in LiteLLM choice");
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          if (toolCall.function) {
            try {
              result.functionCall = {
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments)
              };
            } catch (error) {
              logger5.error("Error parsing function arguments:", error);
              result.functionCall = {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments
                // Keep as string if parsing fails
              };
            }
          }
        } else if (message.content) {
          result.text = message.content.trim();
        }
        return result;
      }
      /**
       * Call the LiteLLM API with messages
       */
      async callWithMessages(modelName, messages, options) {
        return exports.LLMRetryManager.simpleRetry(async () => {
          logger5.debug("Calling LiteLLM with messages...", { model: modelName, messageCount: messages.length });
          const payloadBody = {
            model: modelName,
            messages: this.convertMessagesToOpenAI(messages)
            // Direct OpenAI format - no conversion needed!
          };
          if (options?.temperature !== void 0) {
            payloadBody.temperature = options.temperature;
          }
          if (options?.tools) {
            payloadBody.tools = options.tools.map((tool) => {
              if (tool.type === "function" && tool.function) {
                return {
                  ...tool,
                  function: {
                    ...tool.function,
                    parameters: tool.function.parameters || { type: "object", properties: {} }
                  }
                };
              }
              return tool;
            });
          }
          if (options?.tool_choice) {
            payloadBody.tool_choice = options.tool_choice;
          }
          logger5.info("Request payload:", payloadBody);
          const data = await this.makeAPIRequest(payloadBody);
          return this.processLiteLLMResponse(data);
        }, options?.retryConfig);
      }
      /**
       * Simple call method for backward compatibility
       */
      async call(modelName, prompt, systemPrompt, options) {
        const messages = [];
        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt
          });
        }
        messages.push({
          role: "user",
          content: prompt
        });
        return this.callWithMessages(modelName, messages, options);
      }
      /**
       * Parse response into standardized action structure
       */
      parseResponse(response) {
        return exports.LLMResponseParser.parseResponse(response);
      }
      /**
       * Fetch available models from LiteLLM endpoint
       */
      async fetchModels() {
        logger5.debug("Fetching available models...");
        try {
          const modelsUrl = this.getModelsEndpoint();
          logger5.debug("Using models endpoint:", modelsUrl);
          const response = await fetch(modelsUrl, {
            method: "GET",
            headers: {
              ...this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
            }
          });
          if (!response.ok) {
            const errorData = await response.json();
            logger5.error("LiteLLM models API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`LiteLLM models API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger5.debug("LiteLLM Models Response:", data);
          if (!data?.data || !Array.isArray(data.data)) {
            throw new Error("Invalid models response format");
          }
          return data.data;
        } catch (error) {
          logger5.error("Failed to fetch LiteLLM models:", error);
          throw error;
        }
      }
      /**
       * Get all models supported by this provider
       */
      async getModels() {
        const models = [];
        try {
          const fetchedModels = await this.fetchModels();
          for (const model of fetchedModels) {
            models.push({
              id: model.id,
              name: model.id,
              // Use ID as name for LiteLLM models
              provider: "litellm",
              capabilities: {
                functionCalling: true,
                reasoning: false,
                vision: false,
                structured: true
              }
            });
          }
        } catch (error) {
          logger5.warn("Failed to fetch models from LiteLLM API:", error);
        }
        if (this.customModels && Array.isArray(this.customModels)) {
          for (const customModel of this.customModels) {
            if (customModel.id && customModel.name) {
              models.push({
                id: customModel.id,
                name: customModel.name,
                provider: "litellm",
                capabilities: {
                  functionCalling: true,
                  reasoning: false,
                  vision: false,
                  structured: true
                }
              });
            }
          }
        }
        logger5.debug(`LiteLLM Provider returning ${models.length} models`);
        return models;
      }
      /**
       * Test the LiteLLM connection with a simple completion request
       */
      async testConnection(modelName) {
        logger5.debug("Testing connection...");
        try {
          const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';
          const response = await this.call(modelName, testPrompt, "", {
            temperature: 0.1
          });
          if (response.text?.toLowerCase().includes("connection")) {
            return {
              success: true,
              message: `Successfully connected to LiteLLM with model ${modelName}`
            };
          }
          return {
            success: true,
            message: `Connected to LiteLLM, but received unexpected response: ${response.text || "No response"}`
          };
        } catch (error) {
          logger5.error("LiteLLM connection test failed:", error);
          return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error occurred"
          };
        }
      }
      /**
       * Validate that required credentials are available for LiteLLM
       * Platform-agnostic version - just checks if baseUrl was provided
       */
      validateCredentials() {
        const missingItems = [];
        if (!this.baseUrl) {
          missingItems.push("Endpoint URL");
        }
        if (missingItems.length > 0) {
          return {
            isValid: false,
            message: `LiteLLM configuration incomplete. Missing: ${missingItems.join(", ")}. Please configure in Settings.`,
            missingItems
          };
        }
        return {
          isValid: true,
          message: this.apiKey ? "LiteLLM credentials are configured correctly." : "LiteLLM endpoint configured. API key is optional but may be required for some models."
        };
      }
      /**
       * Get the storage keys this provider uses for credentials
       * Note: This is platform-specific and may not be used in all environments
       */
      getCredentialStorageKeys() {
        return {
          apiKey: "ai_chat_litellm_api_key",
          endpoint: "ai_chat_litellm_endpoint"
        };
      }
    };
    _LiteLLMProvider.DEFAULT_BASE_URL = "http://localhost:4000";
    _LiteLLMProvider.CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
    _LiteLLMProvider.MODELS_PATH = "/v1/models";
    exports.LiteLLMProvider = _LiteLLMProvider;
  }
});

// src/llm/GroqProvider.ts
var GroqProvider_exports = {};
__export(GroqProvider_exports, {
  GroqProvider: () => exports.GroqProvider
});
var logger6, _GroqProvider; exports.GroqProvider = void 0;
var init_GroqProvider = __esm({
  "src/llm/GroqProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger6 = createLogger("GroqProvider");
    _GroqProvider = class _GroqProvider extends exports.LLMBaseProvider {
      constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.name = "groq";
      }
      /**
       * Get the chat completions endpoint URL
       */
      getChatEndpoint() {
        return `${_GroqProvider.API_BASE_URL}${_GroqProvider.CHAT_COMPLETIONS_PATH}`;
      }
      /**
       * Get the models endpoint URL
       */
      getModelsEndpoint() {
        return `${_GroqProvider.API_BASE_URL}${_GroqProvider.MODELS_PATH}`;
      }
      /**
       * Converts LLMMessage format to Groq/OpenAI format
       */
      convertMessagesToGroq(messages) {
        return messages.map((msg) => {
          const baseMessage = {
            role: msg.role,
            content: msg.content
          };
          if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
            baseMessage.tool_calls = msg.tool_calls.map((tc) => {
              const args = tc.function.arguments;
              const argsString = typeof args === "string" ? args : JSON.stringify(args ?? {});
              return {
                ...tc,
                function: {
                  ...tc.function,
                  arguments: argsString
                }
              };
            });
          }
          if (msg.tool_call_id) {
            baseMessage.tool_call_id = msg.tool_call_id;
          }
          if (msg.name) {
            baseMessage.name = msg.name;
          }
          if (msg.role === "tool") {
            if (typeof baseMessage.content !== "string") {
              baseMessage.content = JSON.stringify(baseMessage.content ?? "");
            }
          }
          return baseMessage;
        });
      }
      /**
       * Makes a request to the Groq API
       */
      async makeAPIRequest(endpoint, payloadBody) {
        try {
          logger6.debug("Making Groq API request to:", endpoint);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payloadBody)
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
            logger6.error("Groq API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`Groq API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger6.info("Groq Response:", data);
          if (data.usage) {
            logger6.info("Groq Usage:", {
              inputTokens: data.usage.prompt_tokens,
              outputTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            });
          }
          return data;
        } catch (error) {
          logger6.error("Groq API request failed:", error);
          throw error;
        }
      }
      /**
       * Processes the Groq response and converts to LLMResponse format
       */
      processGroqResponse(data) {
        const result = {
          rawResponse: data
        };
        if (!data?.choices || data.choices.length === 0) {
          throw new Error("No choices in Groq response");
        }
        const choice = data.choices[0];
        const message = choice.message;
        if (!message) {
          throw new Error("No message in Groq choice");
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          if (toolCall.function) {
            try {
              result.functionCall = {
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments)
              };
            } catch (error) {
              logger6.error("Error parsing function arguments:", error);
              result.functionCall = {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments
                // Keep as string if parsing fails
              };
            }
          }
        } else if (message.content) {
          result.text = message.content.trim();
        }
        return result;
      }
      /**
       * Call the Groq API with messages
       */
      async callWithMessages(modelName, messages, options) {
        return exports.LLMRetryManager.simpleRetry(async () => {
          logger6.debug("Calling Groq with messages...", { model: modelName, messageCount: messages.length });
          const payloadBody = {
            model: modelName,
            messages: this.convertMessagesToGroq(messages)
          };
          if (options?.temperature !== void 0) {
            payloadBody.temperature = options.temperature;
          }
          if (options?.tools) {
            payloadBody.tools = options.tools.map((tool) => {
              if (tool.type === "function" && tool.function) {
                return {
                  ...tool,
                  function: {
                    ...tool.function,
                    parameters: tool.function.parameters || { type: "object", properties: {} }
                  }
                };
              }
              return tool;
            });
          }
          if (options?.tools && !options?.tool_choice) {
            payloadBody.tool_choice = "auto";
          } else if (options?.tool_choice) {
            payloadBody.tool_choice = options.tool_choice;
          }
          logger6.info("Request payload:", payloadBody);
          const data = await this.makeAPIRequest(this.getChatEndpoint(), payloadBody);
          return this.processGroqResponse(data);
        }, options?.retryConfig);
      }
      /**
       * Simple call method for backward compatibility
       */
      async call(modelName, prompt, systemPrompt, options) {
        const messages = [];
        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt
          });
        }
        messages.push({
          role: "user",
          content: prompt
        });
        return this.callWithMessages(modelName, messages, options);
      }
      /**
       * Parse response into standardized action structure
       */
      parseResponse(response) {
        return exports.LLMResponseParser.parseResponse(response);
      }
      /**
       * Fetch available models from Groq API
       */
      async fetchModels() {
        logger6.debug("Fetching available Groq models...");
        try {
          const response = await fetch(this.getModelsEndpoint(), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`
            }
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
            logger6.error("Groq models API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`Groq models API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger6.debug("Groq Models Response:", data);
          if (!data?.data || !Array.isArray(data.data)) {
            throw new Error("Invalid models response format");
          }
          return data.data.filter((model) => model.active !== false);
        } catch (error) {
          logger6.error("Failed to fetch Groq models:", error);
          throw error;
        }
      }
      /**
       * Get all models supported by this provider
       */
      async getModels() {
        try {
          const groqModels = await this.fetchModels();
          return groqModels.map((model) => ({
            id: model.id,
            name: model.id,
            // Use ID as name
            provider: "groq",
            capabilities: {
              functionCalling: this.modelSupportsFunctionCalling(model.id),
              reasoning: false,
              // Groq models don't have reasoning capabilities like O-series
              vision: this.modelSupportsVision(model.id),
              structured: true
              // All Groq models support structured output
            }
          }));
        } catch (error) {
          logger6.warn("Failed to fetch models from Groq API, using default list:", error);
          return this.getDefaultModels();
        }
      }
      /**
       * Check if a model supports function calling based on its ID
       */
      modelSupportsFunctionCalling(modelId) {
        const functionCallingModels = [
          "llama-3.3-70b-versatile",
          "llama-3.1-70b-versatile",
          "llama-3.1-8b-instant",
          "llama3-groq-70b-8192-tool-use-preview",
          "llama3-groq-8b-8192-tool-use-preview",
          "mixtral-8x7b-32768",
          "gemma2-9b-it",
          "gemma-7b-it"
        ];
        return functionCallingModels.some((model) => modelId.includes(model));
      }
      /**
       * Check if a model supports vision based on its ID
       */
      modelSupportsVision(modelId) {
        const visionModels = [
          "llama-3.2-90b-vision-preview",
          "llama-3.2-11b-vision-preview",
          "llava-v1.5-7b-4096-preview"
        ];
        return visionModels.some((model) => modelId.includes(model));
      }
      /**
       * Get default list of known Groq models
       */
      getDefaultModels() {
        return [
          {
            id: "llama-3.3-70b-versatile",
            name: "Llama 3.3 70B Versatile",
            provider: "groq",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          },
          {
            id: "llama-3.2-90b-vision-preview",
            name: "Llama 3.2 90B Vision",
            provider: "groq",
            capabilities: {
              functionCalling: false,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "mixtral-8x7b-32768",
            name: "Mixtral 8x7B",
            provider: "groq",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          },
          {
            id: "gemma2-9b-it",
            name: "Gemma 2 9B",
            provider: "groq",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          }
        ];
      }
      /**
       * Test the Groq connection with a simple completion request
       */
      async testConnection(modelName) {
        logger6.debug("Testing Groq connection...");
        try {
          const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';
          const response = await this.call(modelName, testPrompt, "", {
            temperature: 0.1
          });
          if (response.text?.toLowerCase().includes("connection")) {
            return {
              success: true,
              message: `Successfully connected to Groq with model ${modelName}`
            };
          }
          return {
            success: true,
            message: `Connected to Groq, but received unexpected response: ${response.text || "No response"}`
          };
        } catch (error) {
          logger6.error("Groq connection test failed:", error);
          return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error occurred"
          };
        }
      }
      /**
       * Validate that required credentials are available for Groq
       * Platform-agnostic version - just checks if API key was provided
       */
      validateCredentials() {
        if (!this.apiKey) {
          return {
            isValid: false,
            message: "Groq API key is required. Please add your API key in Settings.",
            missingItems: ["API Key"]
          };
        }
        return {
          isValid: true,
          message: "Groq credentials are configured correctly."
        };
      }
      /**
       * Get the storage keys this provider uses for credentials
       * Note: This is platform-specific and may not be used in all environments
       */
      getCredentialStorageKeys() {
        return {
          apiKey: "ai_chat_groq_api_key"
        };
      }
    };
    _GroqProvider.API_BASE_URL = "https://api.groq.com/openai/v1";
    _GroqProvider.CHAT_COMPLETIONS_PATH = "/chat/completions";
    _GroqProvider.MODELS_PATH = "/models";
    exports.GroqProvider = _GroqProvider;
  }
});

// src/llm/OpenRouterProvider.ts
var OpenRouterProvider_exports = {};
__export(OpenRouterProvider_exports, {
  OpenRouterProvider: () => exports.OpenRouterProvider
});
var logger7, _OpenRouterProvider; exports.OpenRouterProvider = void 0;
var init_OpenRouterProvider = __esm({
  "src/llm/OpenRouterProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger7 = createLogger("OpenRouterProvider");
    _OpenRouterProvider = class _OpenRouterProvider extends exports.LLMBaseProvider {
      // 30 minutes
      constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.name = "openrouter";
        // Cache for vision models
        this.visionModelsCache = null;
        this.visionModelsCacheExpiry = 0;
      }
      /**
       * Check if a model doesn't support temperature parameter
       * OpenAI's GPT-5, O3, and O4 models accessed through OpenRouter don't support temperature
       */
      shouldExcludeTemperature(modelName) {
        const noTemperatureModels = [
          "openai/gpt-5",
          "openai/o3",
          "openai/o4"
        ];
        return noTemperatureModels.some((pattern) => modelName.includes(pattern));
      }
      /**
       * Get the chat completions endpoint URL
       */
      getChatEndpoint() {
        return `${_OpenRouterProvider.API_BASE_URL}${_OpenRouterProvider.CHAT_COMPLETIONS_PATH}`;
      }
      /**
       * Get the models endpoint URL with tool support filter
       */
      getToolSupportingModelsEndpoint() {
        return `${_OpenRouterProvider.API_BASE_URL}${_OpenRouterProvider.MODELS_PATH}?supported_parameters=tools`;
      }
      /**
       * Get the models endpoint URL with tool support filter
       * We'll filter for vision capabilities client-side since OpenRouter uses union logic
       */
      getVisionModelsEndpoint() {
        return `${_OpenRouterProvider.API_BASE_URL}${_OpenRouterProvider.MODELS_PATH}?supported_parameters=tools`;
      }
      /**
       * Converts LLMMessage format to OpenRouter/OpenAI format
       */
      convertMessagesToOpenRouter(messages) {
        return messages.map((msg) => {
          const baseMessage = {
            role: msg.role,
            content: msg.content
          };
          if (msg.tool_calls) {
            baseMessage.tool_calls = msg.tool_calls;
          }
          if (msg.tool_call_id) {
            baseMessage.tool_call_id = msg.tool_call_id;
          }
          if (msg.name) {
            baseMessage.name = msg.name;
          }
          return baseMessage;
        });
      }
      /**
       * Makes a request to the OpenRouter API
       */
      async makeAPIRequest(endpoint, payloadBody) {
        try {
          logger7.debug("Making OpenRouter API request to:", endpoint);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${this.apiKey}`,
              "HTTP-Referer": "https://browseroperator.io",
              // Site URL for rankings on openrouter.ai
              "X-Title": "Browser Operator"
              // Site title for rankings on openrouter.ai
            },
            body: JSON.stringify(payloadBody)
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
            logger7.error("OpenRouter API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`OpenRouter API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger7.info("OpenRouter Response:", data);
          if (data.usage) {
            logger7.info("OpenRouter Usage:", {
              inputTokens: data.usage.prompt_tokens,
              outputTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            });
          }
          return data;
        } catch (error) {
          logger7.error("OpenRouter API request failed:", error);
          throw error;
        }
      }
      /**
       * Processes the OpenRouter response and converts to LLMResponse format
       */
      processOpenRouterResponse(data) {
        const result = {
          rawResponse: data
        };
        if (!data?.choices || data.choices.length === 0) {
          throw new Error("No choices in OpenRouter response");
        }
        const choice = data.choices[0];
        const message = choice.message;
        if (!message) {
          throw new Error("No message in OpenRouter choice");
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          if (toolCall.function) {
            try {
              result.functionCall = {
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments)
              };
            } catch (error) {
              logger7.error("Error parsing function arguments:", error);
              result.functionCall = {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments
                // Keep as string if parsing fails
              };
            }
          }
        } else if (message.content) {
          result.text = message.content.trim();
        }
        return result;
      }
      /**
       * Call the OpenRouter API with messages
       */
      async callWithMessages(modelName, messages, options) {
        return exports.LLMRetryManager.simpleRetry(async () => {
          logger7.debug("Calling OpenRouter with messages...", { model: modelName, messageCount: messages.length });
          const payloadBody = {
            model: modelName,
            messages: this.convertMessagesToOpenRouter(messages)
          };
          if (options?.temperature !== void 0 && !this.shouldExcludeTemperature(modelName)) {
            payloadBody.temperature = options.temperature;
          }
          if (options?.tools) {
            payloadBody.tools = options.tools.map((tool) => {
              if (tool.type === "function" && tool.function) {
                return {
                  ...tool,
                  function: {
                    ...tool.function,
                    parameters: tool.function.parameters || { type: "object", properties: {} }
                  }
                };
              }
              return tool;
            });
          }
          if (options?.tool_choice) {
            payloadBody.tool_choice = options.tool_choice;
          }
          logger7.info("Request payload:", payloadBody);
          const data = await this.makeAPIRequest(this.getChatEndpoint(), payloadBody);
          return this.processOpenRouterResponse(data);
        }, options?.retryConfig);
      }
      /**
       * Simple call method for backward compatibility
       */
      async call(modelName, prompt, systemPrompt, options) {
        const messages = [];
        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt
          });
        }
        messages.push({
          role: "user",
          content: prompt
        });
        return this.callWithMessages(modelName, messages, options);
      }
      /**
       * Parse response into standardized action structure
       */
      parseResponse(response) {
        return exports.LLMResponseParser.parseResponse(response);
      }
      /**
       * Fetch available models from OpenRouter API that support tool calls
       */
      async fetchModels() {
        logger7.debug("Fetching available OpenRouter models that support tool calls...");
        try {
          const response = await fetch(this.getToolSupportingModelsEndpoint(), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`
            }
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
            logger7.error("OpenRouter models API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`OpenRouter models API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger7.debug("OpenRouter Models Response:", data);
          if (!data?.data || !Array.isArray(data.data)) {
            throw new Error("Invalid models response format");
          }
          return data.data;
        } catch (error) {
          logger7.error("Failed to fetch OpenRouter models:", error);
          throw error;
        }
      }
      /**
       * Fetch available vision models from OpenRouter API
       */
      async fetchVisionModels() {
        logger7.debug("Fetching available OpenRouter vision models...");
        try {
          const response = await fetch(this.getVisionModelsEndpoint(), {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`
            }
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
            logger7.error("OpenRouter vision models API error:", JSON.stringify(errorData, null, 2));
            throw new Error(`OpenRouter vision models API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger7.debug("OpenRouter Vision Models Response:", data);
          if (!data?.data || !Array.isArray(data.data)) {
            throw new Error("Invalid vision models response format");
          }
          return data.data;
        } catch (error) {
          logger7.error("Failed to fetch OpenRouter vision models:", error);
          throw error;
        }
      }
      /**
       * Get all models supported by this provider
       */
      async getModels() {
        try {
          const openRouterModels = await this.fetchModels();
          return openRouterModels.map((model) => ({
            id: model.id,
            name: model.name || model.id,
            // Use name if available, otherwise ID
            provider: "openrouter",
            capabilities: {
              functionCalling: this.modelSupportsFunctionCalling(model),
              reasoning: this.modelSupportsReasoning(model),
              vision: this.modelSupportsVision(model),
              structured: true
              // Most OpenRouter models support structured output
            }
          }));
        } catch (error) {
          logger7.warn("Failed to fetch models from OpenRouter API, using default list:", error);
          return this.getDefaultModels();
        }
      }
      /**
       * Check if a model supports function calling based on its metadata
       */
      modelSupportsFunctionCalling(_model) {
        return true;
      }
      /**
       * Check if a model supports reasoning based on its metadata
       */
      modelSupportsReasoning(model) {
        const reasoningModels = ["o1", "o-preview"];
        return reasoningModels.some(
          (modelType) => model.id.toLowerCase().includes(modelType) || model.name?.toLowerCase().includes(modelType)
        );
      }
      /**
       * Check if a model supports vision based on its metadata
       */
      modelSupportsVision(model) {
        if (model.architecture?.modality === "multimodal") {
          return true;
        }
        const visionModels = [
          "gpt-4-vision",
          "gpt-4o",
          "gpt-4o-mini",
          "claude-3",
          "claude-3-haiku",
          "claude-3-sonnet",
          "claude-3-opus",
          "claude-3.5-sonnet",
          "gemini",
          "gemini-pro",
          "gemini-2.5",
          "gemini-pro-vision",
          "llava",
          "vision",
          "multimodal"
        ];
        return visionModels.some(
          (modelType) => model.id.toLowerCase().includes(modelType) || model.name?.toLowerCase().includes(modelType)
        );
      }
      /**
       * Check if a specific model supports vision with API-based detection
       */
      async supportsVision(modelName) {
        const now = Date.now();
        if (!this.visionModelsCache || now > this.visionModelsCacheExpiry) {
          try {
            logger7.debug("Refreshing vision models cache from API...");
            const visionModels = await this.fetchVisionModels();
            const actualVisionModels = visionModels.filter((model) => {
              const hasImageInput = model.architecture?.input_modalities?.includes("image");
              if (!hasImageInput) {
                logger7.debug(`Filtering out non-vision model: ${model.id} (input_modalities: ${JSON.stringify(model.architecture?.input_modalities)})`);
                return false;
              }
              return true;
            });
            this.visionModelsCache = new Set(actualVisionModels.map((m) => m.id));
            this.visionModelsCacheExpiry = now + _OpenRouterProvider.CACHE_DURATION_MS;
            logger7.info(`Cached ${this.visionModelsCache.size} actual vision models (filtered from ${visionModels.length} returned by API)`);
          } catch (error) {
            logger7.warn("Failed to fetch vision models, using fallback detection:", error);
            const visionKeywords = ["gpt-4-vision", "gpt-4o", "claude-3", "llava", "vision", "gemini-pro-vision"];
            return visionKeywords.some((keyword) => modelName.toLowerCase().includes(keyword));
          }
        }
        return this.visionModelsCache.has(modelName);
      }
      /**
       * Get default list of popular OpenRouter models
       */
      getDefaultModels() {
        return [
          {
            id: "openai/gpt-4o",
            name: "GPT-4o",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "openai/gpt-4o-mini",
            name: "GPT-4o Mini",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "anthropic/claude-3.5-sonnet",
            name: "Claude 3.5 Sonnet",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "meta-llama/llama-3.1-405b-instruct",
            name: "Llama 3.1 405B Instruct",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          },
          {
            id: "mistralai/mixtral-8x7b-instruct",
            name: "Mixtral 8x7B Instruct",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          },
          {
            id: "google/gemini-2.5-pro",
            name: "Gemini Pro 2.5",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          },
          {
            id: "google/gemini-2.5-flash",
            name: "Gemini Pro 2.5 Flash",
            provider: "openrouter",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: true,
              structured: true
            }
          }
        ];
      }
      /**
       * Test the OpenRouter connection with a simple completion request
       */
      async testConnection(modelName) {
        logger7.debug("Testing OpenRouter connection...");
        try {
          const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';
          const callOptions = {};
          if (!this.shouldExcludeTemperature(modelName)) {
            callOptions.temperature = 0.1;
          }
          const response = await this.call(modelName, testPrompt, "", callOptions);
          if (response.text?.toLowerCase().includes("connection")) {
            return {
              success: true,
              message: `Successfully connected to OpenRouter with model ${modelName}`
            };
          }
          return {
            success: true,
            message: `Connected to OpenRouter, but received unexpected response: ${response.text || "No response"}`
          };
        } catch (error) {
          logger7.error("OpenRouter connection test failed:", error);
          return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error occurred"
          };
        }
      }
      /**
       * Validate that required credentials are available for OpenRouter
       * Platform-agnostic version - just checks if API key was provided
       */
      validateCredentials() {
        if (!this.apiKey) {
          return {
            isValid: false,
            message: "OpenRouter API key is required. Please add your API key in Settings.",
            missingItems: ["API Key"]
          };
        }
        return {
          isValid: true,
          message: "OpenRouter credentials are configured correctly."
        };
      }
      /**
       * Get the storage keys this provider uses for credentials
       * Note: This is platform-specific and may not be used in all environments
       */
      getCredentialStorageKeys() {
        return {
          apiKey: "ai_chat_openrouter_api_key"
        };
      }
    };
    _OpenRouterProvider.API_BASE_URL = "https://openrouter.ai/api/v1";
    _OpenRouterProvider.CHAT_COMPLETIONS_PATH = "/chat/completions";
    _OpenRouterProvider.MODELS_PATH = "/models";
    _OpenRouterProvider.CACHE_DURATION_MS = 30 * 60 * 1e3;
    exports.OpenRouterProvider = _OpenRouterProvider;
  }
});

// src/llm/BrowserOperatorProvider.ts
var BrowserOperatorProvider_exports = {};
__export(BrowserOperatorProvider_exports, {
  BrowserOperatorProvider: () => exports.BrowserOperatorProvider
});
var logger8, _BrowserOperatorProvider; exports.BrowserOperatorProvider = void 0;
var init_BrowserOperatorProvider = __esm({
  "src/llm/BrowserOperatorProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger8 = createLogger("BrowserOperatorProvider");
    _BrowserOperatorProvider = class _BrowserOperatorProvider extends exports.LLMBaseProvider {
      constructor(apiKey, baseUrl) {
        super();
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.name = "browseroperator";
      }
      /**
       * Constructs the full endpoint URL
       */
      getEndpoint() {
        const baseUrl = this.baseUrl || _BrowserOperatorProvider.DEFAULT_BASE_URL;
        const cleanBaseUrl = baseUrl.replace(/\/$/, "");
        return `${cleanBaseUrl}${_BrowserOperatorProvider.CHAT_COMPLETIONS_PATH}`;
      }
      /**
       * Gets the health check endpoint URL
       */
      getHealthEndpoint() {
        const baseUrl = this.baseUrl || _BrowserOperatorProvider.DEFAULT_BASE_URL;
        const cleanUrl = baseUrl.replace(/\/v1\/?$/, "");
        return `${cleanUrl}${_BrowserOperatorProvider.HEALTH_PATH}`;
      }
      /**
       * Converts LLMMessage format to OpenAI-compatible format
       */
      convertMessagesToOpenAI(messages) {
        return messages.map((msg) => {
          const baseMessage = {
            role: msg.role,
            content: msg.content
          };
          if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
            baseMessage.tool_calls = msg.tool_calls.map((tc) => {
              const args = tc.function.arguments;
              const argsString = typeof args === "string" ? args : JSON.stringify(args ?? {});
              return {
                ...tc,
                function: {
                  ...tc.function,
                  arguments: argsString
                }
              };
            });
          }
          if (msg.tool_call_id) {
            baseMessage.tool_call_id = msg.tool_call_id;
          }
          if (msg.name) {
            baseMessage.name = msg.name;
          }
          if (msg.role === "tool") {
            if (typeof baseMessage.content !== "string") {
              baseMessage.content = JSON.stringify(baseMessage.content ?? "");
            }
          }
          return baseMessage;
        });
      }
      /**
       * Makes a request to the BrowserOperator API server
       */
      async makeAPIRequest(payloadBody, agentName) {
        try {
          const endpoint = this.getEndpoint();
          const selectedAgent = agentName || "default";
          logger8.info("=== BrowserOperator API Request ===");
          logger8.info("Endpoint:", endpoint);
          logger8.info("Agent (X-Agent header):", selectedAgent);
          logger8.info("Model:", payloadBody.model);
          logger8.info("Message count:", payloadBody.messages?.length || 0);
          logger8.info("Has tools:", !!payloadBody.tools);
          logger8.info("Temperature:", payloadBody.temperature);
          logger8.debug("Full request payload:", JSON.stringify(payloadBody, null, 2));
          const requestHeaders = {
            "Content-Type": "application/json",
            "X-Agent": selectedAgent,
            ...this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
          };
          logger8.debug("Request headers:", requestHeaders);
          const startTime = Date.now();
          const response = await fetch(endpoint, {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify(payloadBody)
          });
          const duration = Date.now() - startTime;
          logger8.info(`Response status: ${response.status} ${response.statusText}`);
          logger8.info(`Response time: ${duration}ms`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
            logger8.error("=== BrowserOperator API Error ===");
            logger8.error(`Status: ${response.status} ${response.statusText}`);
            logger8.error("Error data: " + JSON.stringify(errorData, null, 2));
            throw new Error(`BrowserOperator API error: ${response.statusText} - ${errorData?.error?.message || "Unknown error"}`);
          }
          const data = await response.json();
          logger8.info("=== BrowserOperator API Response ===");
          logger8.info("Response time:", `${duration}ms`);
          logger8.info("Choices count:", data.choices?.length || 0);
          if (data.usage) {
            logger8.info("Token usage:", {
              prompt: data.usage.prompt_tokens,
              completion: data.usage.completion_tokens,
              total: data.usage.total_tokens
            });
          }
          if (data.choices?.[0]) {
            const firstChoice = data.choices[0];
            if (firstChoice.message?.content) {
              const contentPreview = firstChoice.message.content.substring(0, 200);
              logger8.info("Response preview:", contentPreview + (firstChoice.message.content.length > 200 ? "..." : ""));
            }
            if (firstChoice.message?.tool_calls) {
              logger8.info("Tool calls:", firstChoice.message.tool_calls.length);
            }
          }
          logger8.debug("Full response:", JSON.stringify(data, null, 2));
          return data;
        } catch (error) {
          logger8.error("=== BrowserOperator API Request Failed ===");
          logger8.error("Error:", error);
          throw error;
        }
      }
      /**
       * Processes the BrowserOperator response and converts to LLMResponse format
       */
      processBrowserOperatorResponse(data) {
        const result = {
          rawResponse: data
        };
        if (!data?.choices || data.choices.length === 0) {
          throw new Error("No choices in BrowserOperator response");
        }
        const choice = data.choices[0];
        const message = choice.message;
        if (!message) {
          throw new Error("No message in BrowserOperator choice");
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          if (toolCall.function) {
            try {
              result.functionCall = {
                name: toolCall.function.name,
                arguments: JSON.parse(toolCall.function.arguments)
              };
            } catch (error) {
              logger8.error("Error parsing function arguments:", error);
              result.functionCall = {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments
                // Keep as string if parsing fails
              };
            }
          }
        } else if (message.content) {
          result.text = message.content.trim();
        }
        return result;
      }
      /**
       * Call the BrowserOperator API with messages
       */
      async callWithMessages(modelName, messages, options) {
        return exports.LLMRetryManager.simpleRetry(async () => {
          logger8.debug("Calling BrowserOperator with messages...", { model: modelName, messageCount: messages.length });
          const payloadBody = {
            model: modelName,
            // Use model alias (main/mini/nano)
            messages: this.convertMessagesToOpenAI(messages)
          };
          if (options?.temperature !== void 0) {
            payloadBody.temperature = options.temperature;
          }
          if (options?.tools) {
            payloadBody.tools = options.tools.map((tool) => {
              if (tool.type === "function" && tool.function) {
                return {
                  ...tool,
                  function: {
                    ...tool.function,
                    parameters: tool.function.parameters || { type: "object", properties: {} }
                  }
                };
              }
              return tool;
            });
          }
          if (options?.tools && !options?.tool_choice) {
            payloadBody.tool_choice = "auto";
          } else if (options?.tool_choice) {
            payloadBody.tool_choice = options.tool_choice;
          }
          logger8.info("Request payload:", payloadBody);
          const agentName = options?.agentName;
          const data = await this.makeAPIRequest(payloadBody, agentName);
          return this.processBrowserOperatorResponse(data);
        }, options?.retryConfig);
      }
      /**
       * Simple call method for backward compatibility
       */
      async call(modelName, prompt, systemPrompt, options) {
        const messages = [];
        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt
          });
        }
        messages.push({
          role: "user",
          content: prompt
        });
        return this.callWithMessages(modelName, messages, options);
      }
      /**
       * Parse response into standardized action structure
       */
      parseResponse(response) {
        return exports.LLMResponseParser.parseResponse(response);
      }
      /**
       * Get all models supported by this provider
       * Returns static list of model aliases - API server handles provider-specific mapping
       */
      async getModels() {
        return [
          {
            id: "main",
            name: "Auto",
            provider: "browseroperator",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          },
          {
            id: "mini",
            name: "Auto",
            provider: "browseroperator",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          },
          {
            id: "nano",
            name: "Auto",
            provider: "browseroperator",
            capabilities: {
              functionCalling: true,
              reasoning: false,
              vision: false,
              structured: true
            }
          }
        ];
      }
      /**
       * Test the BrowserOperator connection with a health check
       */
      async testConnection(modelName) {
        logger8.debug("Testing BrowserOperator connection...");
        try {
          const healthUrl = this.getHealthEndpoint();
          logger8.debug("Health check URL:", healthUrl);
          const response = await fetch(healthUrl);
          if (!response.ok) {
            return {
              success: false,
              message: `Health check failed: ${response.statusText}`
            };
          }
          const data = await response.json();
          const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';
          const testResponse = await this.call(modelName, testPrompt, "", {
            temperature: 0.1
          });
          if (testResponse.text?.toLowerCase().includes("connection")) {
            return {
              success: true,
              message: `Successfully connected to BrowserOperator API server. Health: ${data.status}`
            };
          }
          return {
            success: true,
            message: `Connected to BrowserOperator, but received unexpected response: ${testResponse.text || "No response"}`
          };
        } catch (error) {
          logger8.error("BrowserOperator connection test failed:", error);
          return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error occurred"
          };
        }
      }
      /**
       * Validate that required credentials are available for BrowserOperator
       * Platform-agnostic version - credentials are optional
       */
      validateCredentials() {
        return {
          isValid: true,
          message: `BrowserOperator configured with endpoint: ${_BrowserOperatorProvider.DEFAULT_BASE_URL}. Agent routing is automatic.`
        };
      }
      /**
       * Get the storage keys this provider uses for credentials
       * Note: This is platform-specific and may not be used in all environments
       */
      getCredentialStorageKeys() {
        return {
          apiKey: "ai_chat_browseroperator_api_key"
          // Optional API key for authentication
        };
      }
    };
    _BrowserOperatorProvider.DEFAULT_BASE_URL = "https://api.browseroperator.io/v1";
    _BrowserOperatorProvider.CHAT_COMPLETIONS_PATH = "/chat/completions";
    _BrowserOperatorProvider.HEALTH_PATH = "/health";
    exports.BrowserOperatorProvider = _BrowserOperatorProvider;
  }
});

// src/llm/index.ts
init_LLMTypes();
init_LLMProvider();

// src/llm/LLMProviderRegistry.ts
init_Logger();
var logger = createLogger("LLMProviderRegistry");
var LLMProviderRegistry = class {
  /**
   * Register a provider instance
   */
  static registerProvider(providerType, providerInstance) {
    logger.info(`Registering provider: ${providerType}`);
    this.providers.set(providerType, providerInstance);
  }
  /**
   * Get a provider by type
   */
  static getProvider(providerType) {
    return this.providers.get(providerType);
  }
  /**
   * Check if a provider is registered
   */
  static hasProvider(providerType) {
    return this.providers.has(providerType);
  }
  /**
   * Get all models from all registered providers
   */
  static async getAllModels() {
    const allModels = [];
    for (const [providerType, provider] of this.providers.entries()) {
      try {
        const providerModels = await provider.getModels();
        allModels.push(...providerModels);
        logger.debug(`Got ${providerModels.length} models from ${providerType}`);
      } catch (error) {
        logger.warn(`Failed to get models from ${providerType}:`, error);
      }
    }
    logger.info(`Total models available: ${allModels.length}`);
    return allModels;
  }
  /**
   * Get models for a specific provider
   */
  static async getModelsByProvider(providerType) {
    const provider = this.getProvider(providerType);
    if (!provider) {
      logger.warn(`Provider ${providerType} not registered`);
      return [];
    }
    try {
      const models = await provider.getModels();
      logger.debug(`Got ${models.length} models from ${providerType}`);
      return models;
    } catch (error) {
      logger.error(`Failed to get models from ${providerType}:`, error);
      return [];
    }
  }
  /**
   * Get all registered provider types
   */
  static getRegisteredProviders() {
    return Array.from(this.providers.keys());
  }
  /**
   * Clear all registrations (useful for testing)
   */
  static clear() {
    this.providers.clear();
    logger.info("LLM Provider Registry cleared");
  }
  /**
   * Get registry statistics
   */
  static getStats() {
    return {
      providersCount: this.providers.size,
      providers: Array.from(this.providers.keys())
    };
  }
};
LLMProviderRegistry.providers = /* @__PURE__ */ new Map();

// src/llm/index.ts
init_LLMResponseParser();

// src/llm/MessageSanitizer.ts
function deepClone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}
function sanitizeMessagesForModel(messages, options) {
  const { visionCapable, placeholderForImageOnly } = options;
  if (visionCapable) {
    return deepClone(messages);
  }
  const sanitized = [];
  for (const msg of messages) {
    const cloned = deepClone(msg);
    const content = cloned.content;
    if (content === void 0) {
      sanitized.push(cloned);
      continue;
    }
    if (typeof content === "string") {
      sanitized.push(cloned);
      continue;
    }
    const parts = content;
    const filteredParts = parts.filter((part) => {
      return typeof part === "object" && "type" in part && part.type === "text";
    });
    if (filteredParts.length === 0) {
      if (placeholderForImageOnly) {
        cloned.content = [{ type: "text", text: "Image omitted (model lacks vision)." }];
      } else {
        cloned.content = "";
      }
    } else if (filteredParts.length === 1 && filteredParts[0].type === "text") {
      cloned.content = filteredParts[0].text || "";
    } else {
      cloned.content = filteredParts;
    }
    sanitized.push(cloned);
  }
  return sanitized;
}

// src/llm/index.ts
init_LLMErrorHandler();

// src/llm/LLMClient.ts
init_LLMResponseParser();
init_Logger();
var logger9 = createLogger("LLMClient");
var _LLMClient = class _LLMClient {
  constructor() {
    this.initialized = false;
  }
  /**
   * Get the singleton instance
   */
  static getInstance() {
    if (!_LLMClient.instance) {
      _LLMClient.instance = new _LLMClient();
    }
    return _LLMClient.instance;
  }
  /**
   * Initialize the LLM client with provider configurations
   *
   * This method must be called before making any LLM calls. It registers
   * the configured providers with the LLMProviderRegistry.
   *
   * @param config - Configuration specifying which providers to initialize
   */
  async initialize(config) {
    logger9.info("Initializing LLM client with providers:", config.providers.map((p) => p.provider));
    LLMProviderRegistry.clear();
    for (const providerConfig of config.providers) {
      try {
        let providerInstance;
        switch (providerConfig.provider) {
          case "openai": {
            const { OpenAIProvider: OpenAIProvider2 } = await Promise.resolve().then(() => (init_OpenAIProvider(), OpenAIProvider_exports));
            providerInstance = new OpenAIProvider2(providerConfig.apiKey);
            break;
          }
          case "litellm": {
            const { LiteLLMProvider: LiteLLMProvider2 } = await Promise.resolve().then(() => (init_LiteLLMProvider(), LiteLLMProvider_exports));
            providerInstance = new LiteLLMProvider2(
              providerConfig.apiKey,
              providerConfig.providerURL
            );
            break;
          }
          case "groq": {
            const { GroqProvider: GroqProvider2 } = await Promise.resolve().then(() => (init_GroqProvider(), GroqProvider_exports));
            providerInstance = new GroqProvider2(providerConfig.apiKey);
            break;
          }
          case "openrouter": {
            const { OpenRouterProvider: OpenRouterProvider2 } = await Promise.resolve().then(() => (init_OpenRouterProvider(), OpenRouterProvider_exports));
            providerInstance = new OpenRouterProvider2(providerConfig.apiKey);
            break;
          }
          case "browseroperator": {
            const { BrowserOperatorProvider: BrowserOperatorProvider2 } = await Promise.resolve().then(() => (init_BrowserOperatorProvider(), BrowserOperatorProvider_exports));
            providerInstance = new BrowserOperatorProvider2(
              providerConfig.apiKey || null,
              providerConfig.providerURL
              // Optional override for testing
            );
            break;
          }
          default:
            logger9.warn(`Unknown provider type: ${providerConfig.provider}`);
            continue;
        }
        LLMProviderRegistry.registerProvider(providerConfig.provider, providerInstance);
        logger9.info(`Registered ${providerConfig.provider} provider`);
      } catch (error) {
        logger9.error(`Failed to initialize ${providerConfig.provider} provider:`, error);
      }
    }
    this.initialized = true;
    logger9.info("LLM client initialization complete");
  }
  /**
   * Check if the client is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error("LLMClient must be initialized before use. Call initialize() first.");
    }
  }
  /**
   * Main method for LLM calls with request object
   *
   * @param request - Complete request specification including provider, model, messages, etc.
   * @returns Promise resolving to the LLM response
   */
  async call(request) {
    this.ensureInitialized();
    const provider = LLMProviderRegistry.getProvider(request.provider);
    if (!provider) {
      throw new Error(`Provider ${request.provider} not available. Available providers: ${LLMProviderRegistry.getRegisteredProviders().join(", ")}`);
    }
    logger9.debug(`Using ${request.provider} provider for model ${request.model}`);
    let messages = [...request.messages];
    const hasSystemMessage = messages.some((msg) => msg.role === "system");
    if (!hasSystemMessage) {
      messages.unshift({
        role: "system",
        content: request.systemPrompt
      });
    }
    const options = {};
    if (request.temperature !== void 0) {
      options.temperature = request.temperature;
    }
    if (request.tools) {
      options.tools = request.tools;
    }
    if (request.retryConfig) {
      options.retryConfig = request.retryConfig;
    }
    if (request.agentName) {
      options.agentName = request.agentName;
    }
    return provider.callWithMessages(request.model, messages, options);
  }
  /**
   * Parse response into standardized action structure
   */
  parseResponse(response) {
    return exports.LLMResponseParser.parseResponse(response);
  }
  /**
   * Get all available models from all providers
   */
  async getAvailableModels() {
    this.ensureInitialized();
    return LLMProviderRegistry.getAllModels();
  }
  /**
   * Get models for a specific provider
   */
  async getModelsByProvider(provider) {
    this.ensureInitialized();
    return LLMProviderRegistry.getModelsByProvider(provider);
  }
  /**
   * Test connection to a specific model
   */
  async testConnection(provider, modelId) {
    this.ensureInitialized();
    const providerInstance = LLMProviderRegistry.getProvider(provider);
    if (!providerInstance) {
      return {
        success: false,
        message: `Provider ${provider} not available`
      };
    }
    if (providerInstance.testConnection) {
      return providerInstance.testConnection(modelId);
    }
    try {
      const response = await this.call({
        provider,
        model: modelId,
        messages: [{ role: "user", content: 'Please respond with "OK" to test the connection.' }],
        systemPrompt: "You are a helpful assistant for testing purposes.",
        temperature: 0.1
      });
      return {
        success: true,
        message: `Connected successfully. Response: ${response.text || "No text response"}`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  /**
   * Refresh models for a specific provider or all providers
   */
  async refreshProviderModels(provider) {
    this.ensureInitialized();
    if (provider) {
      const providerInstance = LLMProviderRegistry.getProvider(provider);
      if (providerInstance) {
        try {
          await providerInstance.getModels();
          logger9.info(`Refreshed models for ${provider} provider`);
        } catch (error) {
          logger9.error(`Failed to refresh models for ${provider}:`, error);
        }
      }
    } else {
      const providers = LLMProviderRegistry.getRegisteredProviders();
      for (const providerType of providers) {
        await this.refreshProviderModels(providerType);
      }
    }
  }
  /**
   * Get registry statistics
   */
  getStats() {
    const registryStats = LLMProviderRegistry.getStats();
    return {
      initialized: this.initialized,
      ...registryStats
    };
  }
};
_LLMClient.instance = null;
var LLMClient = _LLMClient;

// src/llm/index.ts
init_OpenAIProvider();
init_LiteLLMProvider();
init_GroqProvider();
init_OpenRouterProvider();
init_BrowserOperatorProvider();

// src/observability/index.ts
init_Logger();

// src/messaging/ChatMessage.ts
var ChatMessageEntity = /* @__PURE__ */ ((ChatMessageEntity2) => {
  ChatMessageEntity2["USER"] = "user";
  ChatMessageEntity2["MODEL"] = "model";
  ChatMessageEntity2["TOOL_RESULT"] = "tool_result";
  ChatMessageEntity2["AGENT_SESSION"] = "agent_session";
  return ChatMessageEntity2;
})(ChatMessageEntity || {});
function createUserMessage(text, imageInput) {
  return {
    entity: "user" /* USER */,
    text,
    imageInput
  };
}
function createModelMessage(action, options) {
  return {
    entity: "model" /* MODEL */,
    action,
    isFinalAnswer: action === "final",
    ...options
  };
}
function createToolResultMessage(toolName, resultText, isError = false, options) {
  return {
    entity: "tool_result" /* TOOL_RESULT */,
    toolName,
    resultText,
    isError,
    ...options
  };
}

// src/messaging/AgentSession.ts
var DEFAULT_AGENT_UI = {
  displayName: "AI Assistant",
  avatar: "\u{1F916}",
  color: "#6b7280",
  backgroundColor: "#f9fafb"
};
function formatAgentName(agentName) {
  return agentName.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function getAgentDisplayName(agentName, config) {
  if (config?.ui?.displayName) {
    return config.ui.displayName;
  }
  if (config?.description) {
    const firstLine = config.description.split("\n")[0].trim();
    if (firstLine && !firstLine.includes("agent") && firstLine.length < 50) {
      return firstLine;
    }
  }
  return formatAgentName(agentName);
}
function getAgentDescription(agentName, config) {
  if (config?.description) {
    return config.description;
  }
  return `${getAgentDisplayName(agentName, config)} - AI Assistant`;
}
function getAgentUIConfig(agentName, config) {
  return {
    displayName: getAgentDisplayName(agentName, config),
    avatar: config?.ui?.avatar || DEFAULT_AGENT_UI.avatar,
    color: config?.ui?.color || DEFAULT_AGENT_UI.color,
    backgroundColor: config?.ui?.backgroundColor || DEFAULT_AGENT_UI.backgroundColor
  };
}

// src/tools/Tool.ts
function createToolResult(success, result, error, duration) {
  return {
    success,
    result,
    error,
    duration
  };
}
function successResult(result, duration) {
  return createToolResult(true, result, void 0, duration);
}
function errorResult(error, duration) {
  return createToolResult(false, void 0, error, duration);
}

// src/tools/ToolRegistry.ts
init_Logger();
var logger10 = createLogger("ToolRegistry");
var ToolRegistry = class {
  // Store instances
  /**
   * Register a tool factory and create/store an instance
   */
  static registerToolFactory(name, factory) {
    if (this.toolFactories.has(name)) {
      logger10.warn(`Tool factory already registered for: ${name}. Overwriting.`);
    }
    if (this.registeredTools.has(name)) {
      logger10.warn(`Tool instance already registered for: ${name}. Overwriting.`);
    }
    this.toolFactories.set(name, factory);
    try {
      const instance = factory();
      this.registeredTools.set(name, instance);
      logger10.info(`Registered and instantiated tool: ${name}`);
    } catch (error) {
      logger10.error(`Failed to instantiate tool '${name}' during registration:`, error);
      this.toolFactories.delete(name);
    }
  }
  /**
   * Get a tool instance by name (creates new instance from factory)
   */
  static getToolInstance(name) {
    const factory = this.toolFactories.get(name);
    return factory ? factory() : null;
  }
  /**
   * Get a pre-registered tool instance by name (returns cached instance)
   */
  static getRegisteredTool(name) {
    const instance = this.registeredTools.get(name);
    if (!instance) {
      return null;
    }
    return instance;
  }
  /**
   * Check if a tool is registered
   */
  static hasTool(name) {
    return this.toolFactories.has(name);
  }
  /**
   * Get all registered tool names
   */
  static getRegisteredToolNames() {
    return Array.from(this.toolFactories.keys());
  }
  /**
   * Get all registered tool instances
   */
  static getAllRegisteredTools() {
    return Array.from(this.registeredTools.values());
  }
  /**
   * Clear all registered tools (useful for testing)
   */
  static clear() {
    this.toolFactories.clear();
    this.registeredTools.clear();
    logger10.info("Tool Registry cleared");
  }
  /**
   * Get registry statistics
   */
  static getStats() {
    return {
      toolCount: this.toolFactories.size,
      toolNames: Array.from(this.toolFactories.keys())
    };
  }
  /**
   * Unregister a specific tool
   */
  static unregisterTool(name) {
    const hadFactory = this.toolFactories.delete(name);
    const hadInstance = this.registeredTools.delete(name);
    if (hadFactory || hadInstance) {
      logger10.info(`Unregistered tool: ${name}`);
    }
    return hadFactory || hadInstance;
  }
  /**
   * Register multiple tools at once
   */
  static registerTools(tools) {
    for (const [name, factory] of Object.entries(tools)) {
      this.registerToolFactory(name, factory);
    }
  }
};
ToolRegistry.toolFactories = /* @__PURE__ */ new Map();
ToolRegistry.registeredTools = /* @__PURE__ */ new Map();

// src/agent/AgentTypes.ts
var MODEL_SENTINELS = {
  USE_MINI: "use-mini",
  USE_NANO: "use-nano"
};

// src/agent/AgentRunner.ts
init_Logger();

// src/agent/AgentErrorHandler.ts
init_Logger();
var logger11 = createLogger("AgentErrorHandler");
var AgentErrorHandler = class _AgentErrorHandler {
  constructor(config) {
    this.config = config;
  }
  /**
   * Create an error handler with the given configuration
   */
  static createErrorHandler(config) {
    return new _AgentErrorHandler(config);
  }
  /**
   * Handle unknown tool requests gracefully
   */
  handleUnknownTool(toolName, toolCallId) {
    const { agentName, availableTools = [], continueOnError } = this.config;
    logger11.warn(`${agentName} requested unknown tool: ${toolName}`);
    if (!continueOnError) {
      return {
        shouldContinue: false,
        errorMessage: void 0,
        sessionMessage: void 0
      };
    }
    const availableToolsList = availableTools.length > 0 ? `Available tools: ${availableTools.join(", ")}` : "No tools are currently available";
    const errorMessage = {
      entity: "tool_result" /* TOOL_RESULT */,
      toolName,
      resultText: `Error: Tool "${toolName}" is not available. ${availableToolsList}`,
      isError: true,
      toolCallId,
      error: `Unknown tool: ${toolName}`
    };
    const sessionMessage = {
      type: "tool_result",
      content: {
        type: "tool_result",
        toolCallId,
        toolName,
        success: false,
        result: null,
        error: `Unknown tool: ${toolName}`
      }
    };
    logger11.info(`${agentName} Added unknown tool error to conversation, will continue execution`);
    return {
      shouldContinue: true,
      errorMessage,
      sessionMessage
    };
  }
  /**
   * Handle LLM response parsing errors gracefully
   */
  handleParsingError(error) {
    const { agentName, continueOnError } = this.config;
    logger11.warn(`${agentName} LLM response parsing error: ${error}`);
    if (!continueOnError) {
      return {
        shouldContinue: false,
        errorMessage: void 0,
        sessionMessage: void 0
      };
    }
    const errorMessage = {
      entity: "user" /* USER */,
      text: `Your previous response could not be parsed: ${error}. Please provide a valid response by either calling one of the available tools or providing a final answer.`
    };
    const sessionMessage = {
      type: "reasoning",
      content: {
        type: "reasoning",
        text: `LLM response parsing failed: ${error}. Requesting retry.`
      }
    };
    logger11.info(`${agentName} Added parsing error to conversation, will continue execution`);
    return {
      shouldContinue: true,
      errorMessage,
      sessionMessage
    };
  }
};

// src/agent/AgentRunnerEventBus.ts
var AgentRunnerEventBus = class _AgentRunnerEventBus {
  constructor() {
    this.listeners = [];
  }
  /**
   * Get the singleton instance
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new _AgentRunnerEventBus();
    }
    return this.instance;
  }
  /**
   * Emit a progress event to all listeners
   */
  emitProgress(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in AgentRunnerEventBus listener:", error);
      }
    }
  }
  /**
   * Add a progress event listener
   */
  addListener(callback) {
    if (!this.listeners.includes(callback)) {
      this.listeners.push(callback);
    }
  }
  /**
   * Remove a progress event listener
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.listeners = [];
  }
  /**
   * Get the number of active listeners
   */
  getListenerCount() {
    return this.listeners.length;
  }
};

// src/agent/AgentRunner.ts
init_LLMResponseParser();
var logger12 = createLogger("AgentRunner");
var _AgentRunner = class _AgentRunner {
  /**
   * Initialize the event bus
   */
  static initializeEventBus() {
    if (!_AgentRunner.eventBus) {
      _AgentRunner.eventBus = AgentRunnerEventBus.getInstance();
    }
  }
  /**
   * Convert chat messages to LLM messages
   */
  static convertToLLMMessages(messages) {
    const llmMessages = [];
    for (const message of messages) {
      if (message.entity === "user" /* USER */) {
        if (message.imageInput) {
          llmMessages.push({
            role: "user",
            content: [
              { type: "text", text: message.text },
              {
                type: "image_url",
                image_url: {
                  url: message.imageInput.url || message.imageInput.bytesBase64,
                  detail: "auto"
                }
              }
            ]
          });
        } else {
          llmMessages.push({
            role: "user",
            content: message.text
          });
        }
      } else if (message.entity === "model" /* MODEL */) {
        const modelMsg = message;
        if (modelMsg.action === "tool") {
          llmMessages.push({
            role: "assistant",
            content: Array.isArray(modelMsg.reasoning) ? modelMsg.reasoning.join(" ") : modelMsg.reasoning || "",
            tool_calls: [
              {
                id: modelMsg.toolCallId || crypto.randomUUID(),
                type: "function",
                function: {
                  name: modelMsg.toolName || "",
                  arguments: JSON.stringify(modelMsg.toolArgs || {})
                }
              }
            ]
          });
        } else if (modelMsg.action === "final") {
          llmMessages.push({
            role: "assistant",
            content: modelMsg.answer || ""
          });
        }
      } else if (message.entity === "tool_result" /* TOOL_RESULT */) {
        const toolResult = message;
        const hasImageData = toolResult.imageData && typeof toolResult.imageData === "string";
        if (hasImageData) {
          llmMessages.push({
            role: "tool",
            content: [
              {
                type: "text",
                text: toolResult.resultText
              },
              {
                type: "image_url",
                image_url: {
                  url: toolResult.imageData,
                  detail: "high"
                }
              }
            ],
            tool_call_id: toolResult.toolCallId
          });
        } else {
          let content = toolResult.resultText;
          if (toolResult.summary) {
            content = content + "\n\n" + toolResult.summary;
          }
          llmMessages.push({
            role: "tool",
            content,
            tool_call_id: toolResult.toolCallId
          });
        }
      }
    }
    return llmMessages;
  }
  /**
   * Sanitizes tool result data for text representation by removing fields
   * that shouldn't be sent to the LLM (imageData, success, etc.)
   */
  static sanitizeToolResultForText(toolResultData) {
    if (typeof toolResultData !== "object" || toolResultData === null) {
      return toolResultData;
    }
    const sanitized = { ...toolResultData };
    const fieldsToRemove = ["imageData", "success", "dataUrl", "agentSession"];
    fieldsToRemove.forEach((field) => {
      if (sanitized.hasOwnProperty(field)) {
        delete sanitized[field];
      }
    });
    return sanitized;
  }
  /**
   * Compute the tool result text shown to the LLM for regular tool outputs
   */
  static computeToolResultText(toolResultData, imageData) {
    if (typeof toolResultData === "string") {
      return toolResultData;
    }
    const sanitizedData = this.sanitizeToolResultForText(toolResultData);
    const sanitizedIsEmptyObject = typeof sanitizedData === "object" && sanitizedData !== null && Object.keys(sanitizedData).length === 0;
    const hadOnlyImage = !!imageData && sanitizedIsEmptyObject;
    if (hadOnlyImage) {
      return "Image omitted (model lacks vision).";
    }
    return JSON.stringify(sanitizedData, null, 2);
  }
  /**
   * Execute handoff to another agent
   */
  static async executeHandoff(currentMessages, originalArgs, handoffConfig, executingAgent, apiKey, defaultModelName, defaultMaxIterations, defaultTemperature, defaultCreateSuccessResult, defaultCreateErrorResult, llmToolArgs, parentSession, defaultProvider, defaultGetVisionCapability, miniModel, nanoModel, overrides) {
    const targetAgentName = handoffConfig.targetAgentName;
    const targetAgentTool = ToolRegistry.getRegisteredTool(targetAgentName);
    if (!(targetAgentTool && "config" in targetAgentTool)) {
      const errorMsg = `Handoff target '${targetAgentName}' not found or is not a ConfigurableAgentTool.`;
      logger12.error(`${errorMsg}`);
      const errorSession = {
        agentName: targetAgentName,
        sessionId: crypto.randomUUID(),
        status: "error",
        startTime: /* @__PURE__ */ new Date(),
        endTime: /* @__PURE__ */ new Date(),
        messages: [],
        nestedSessions: [],
        tools: [],
        terminationReason: "error"
      };
      return { ...defaultCreateErrorResult(errorMsg, currentMessages, "error"), agentSession: errorSession };
    }
    const targetAgent = targetAgentTool;
    logger12.info(`Initiating handoff from ${executingAgent.name} to ${targetAgent.name}`);
    let handoffMessages = [];
    const targetConfig = targetAgent.config;
    if (handoffConfig.includeToolResults && handoffConfig.includeToolResults.length > 0) {
      handoffMessages = currentMessages.filter((message) => {
        if (message.entity === "agent_session" /* AGENT_SESSION */) {
          return false;
        }
        if (message.entity === "user" /* USER */) {
          return true;
        }
        if (message.entity === "model" /* MODEL */) {
          const modelMsg = message;
          if (modelMsg.action === "final") {
            return true;
          }
          if (modelMsg.action === "tool" && modelMsg.toolName) {
            return handoffConfig.includeToolResults.includes(modelMsg.toolName);
          }
        }
        if (message.entity === "tool_result" /* TOOL_RESULT */) {
          const toolResult = message;
          return !toolResult.isError && toolResult.toolName && handoffConfig.includeToolResults.includes(toolResult.toolName);
        }
        return false;
      });
    } else {
      handoffMessages = currentMessages.filter((message) => {
        return message.entity !== "agent_session" /* AGENT_SESSION */;
      });
    }
    let resolvedModelName;
    if (typeof targetConfig.modelName === "function") {
      resolvedModelName = targetConfig.modelName();
    } else if (targetConfig.modelName === MODEL_SENTINELS.USE_MINI) {
      if (!miniModel) {
        throw new Error(
          `Mini model not provided for handoff to agent '${targetAgentName}'. Ensure miniModel is passed in context.`
        );
      }
      resolvedModelName = miniModel;
    } else if (targetConfig.modelName === MODEL_SENTINELS.USE_NANO) {
      if (!nanoModel) {
        throw new Error(
          `Nano model not provided for handoff to agent '${targetAgentName}'. Ensure nanoModel is passed in context.`
        );
      }
      resolvedModelName = nanoModel;
    } else {
      resolvedModelName = targetConfig.modelName || defaultModelName;
    }
    const targetRunnerConfig = {
      apiKey,
      modelName: resolvedModelName,
      systemPrompt: targetConfig.systemPrompt,
      tools: targetConfig.tools.map((toolName) => ToolRegistry.getRegisteredTool(toolName)).filter((tool) => tool !== null),
      maxIterations: targetConfig.maxIterations || defaultMaxIterations,
      temperature: targetConfig.temperature ?? defaultTemperature,
      provider: defaultProvider,
      getVisionCapability: defaultGetVisionCapability,
      miniModel,
      nanoModel
    };
    const targetRunnerHooks = {
      prepareInitialMessages: void 0,
      createSuccessResult: targetConfig.createSuccessResult ? (out, steps, reason) => targetConfig.createSuccessResult(out, steps, reason, targetConfig) : defaultCreateSuccessResult,
      createErrorResult: targetConfig.createErrorResult ? (err, steps, reason) => targetConfig.createErrorResult(err, steps, reason, targetConfig) : defaultCreateErrorResult
    };
    const targetAgentArgs = llmToolArgs ?? originalArgs;
    logger12.info(`Executing handoff target agent: ${targetAgent.name} with ${handoffMessages.length} messages.`);
    const handoffResult = await _AgentRunner.run(
      handoffMessages,
      targetAgentArgs,
      targetRunnerConfig,
      targetRunnerHooks,
      targetAgent,
      parentSession,
      overrides,
      void 0
    );
    const { agentSession: childSession, ...actualResult } = handoffResult;
    if (parentSession) {
      parentSession.nestedSessions.push(childSession);
    }
    logger12.info(`Handoff target agent ${targetAgent.name} finished. Result success: ${actualResult.success}`);
    if (targetAgent.config.includeIntermediateStepsOnReturn === true) {
      logger12.info(`Including intermediateSteps from ${targetAgent.name} based on its config.`);
      const combinedIntermediateSteps = [...currentMessages, ...actualResult.intermediateSteps || []];
      return {
        ...actualResult,
        intermediateSteps: combinedIntermediateSteps,
        terminationReason: actualResult.terminationReason || "handed_off",
        agentSession: childSession
      };
    }
    logger12.info(`Omitting intermediateSteps from ${targetAgent.name} based on its config.`);
    const finalResult = {
      ...actualResult,
      terminationReason: actualResult.terminationReason || "handed_off",
      agentSession: childSession
    };
    delete finalResult.intermediateSteps;
    return finalResult;
  }
  /**
   * Main agent execution loop
   */
  static async run(initialMessages, args, config, hooks, executingAgent, parentSession, overrides, abortSignal) {
    const agentName = executingAgent?.name || "Unknown";
    logger12.info(`Starting execution loop for agent: ${agentName}`);
    const { apiKey, modelName, systemPrompt, tools, maxIterations, temperature } = config;
    const { prepareInitialMessages, createSuccessResult, createErrorResult, afterExecute } = hooks;
    const agentSession = {
      agentName,
      agentQuery: args.query,
      agentReasoning: args.reasoning,
      agentDisplayName: executingAgent?.config?.ui?.displayName || agentName,
      agentDescription: executingAgent?.config?.description,
      sessionId: overrides?.sessionId || crypto.randomUUID(),
      parentSessionId: overrides?.parentSessionId || parentSession?.sessionId,
      status: "running",
      startTime: /* @__PURE__ */ new Date(),
      messages: [],
      nestedSessions: [],
      tools: config.tools.map((t) => t.name),
      config: executingAgent?.config,
      maxIterations,
      modelUsed: modelName,
      iterationCount: 0
    };
    let currentSession = agentSession;
    if (_AgentRunner.eventBus) {
      _AgentRunner.eventBus.emitProgress({
        type: "session_started",
        sessionId: agentSession.sessionId,
        parentSessionId: agentSession.parentSessionId,
        agentName,
        timestamp: /* @__PURE__ */ new Date(),
        data: { session: agentSession }
      });
    }
    const addSessionMessage = (message) => {
      const fullMessage = {
        id: crypto.randomUUID(),
        timestamp: /* @__PURE__ */ new Date(),
        ...message
      };
      currentSession.messages.push(fullMessage);
      if (_AgentRunner.eventBus && fullMessage.type === "tool_call") {
        _AgentRunner.eventBus.emitProgress({
          type: "tool_started",
          sessionId: currentSession.sessionId,
          parentSessionId: currentSession.parentSessionId,
          agentName: currentSession.agentName,
          timestamp: /* @__PURE__ */ new Date(),
          data: { session: currentSession, toolCall: fullMessage }
        });
      } else if (_AgentRunner.eventBus && fullMessage.type === "tool_result") {
        _AgentRunner.eventBus.emitProgress({
          type: "tool_completed",
          sessionId: currentSession.sessionId,
          parentSessionId: currentSession.parentSessionId,
          agentName: currentSession.agentName,
          timestamp: /* @__PURE__ */ new Date(),
          data: { session: currentSession, toolResult: fullMessage }
        });
      }
    };
    let messages = [...initialMessages];
    if (prepareInitialMessages) {
      messages = prepareInitialMessages(messages);
    }
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    const toolSchemas = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.schema
      }
    }));
    const errorHandler = AgentErrorHandler.createErrorHandler({
      continueOnError: true,
      agentName,
      availableTools: Array.from(toolMap.keys()),
      session: agentSession
    });
    if (executingAgent?.config.handoffs) {
      for (const handoffConfig of executingAgent.config.handoffs) {
        if (!handoffConfig.trigger || handoffConfig.trigger === "llm_tool_call") {
          const targetAgentName = handoffConfig.targetAgentName;
          const targetTool = ToolRegistry.getRegisteredTool(targetAgentName);
          if (targetTool && "config" in targetTool) {
            const handoffToolName = `handoff_to_${targetAgentName}`;
            toolSchemas.push({
              type: "function",
              function: {
                name: handoffToolName,
                description: `Handoff the current task to the specialized agent: ${targetAgentName}. Use this agent when the task requires ${targetAgentName}'s capabilities. Agent Description: ${targetTool.description}`,
                parameters: targetTool.schema
              }
            });
            toolMap.set(handoffToolName, targetTool);
            logger12.info(`Added LLM handoff tool schema: ${handoffToolName}`);
          } else {
            logger12.warn(
              `Configured LLM handoff target '${targetAgentName}' not found or is not a ConfigurableAgentTool.`
            );
          }
        }
      }
    }
    if (args.reasoning) {
      const reasoningText = Array.isArray(args.reasoning) ? args.reasoning.join(" ") : args.reasoning;
      addSessionMessage({
        type: "reasoning",
        content: {
          type: "reasoning",
          text: reasoningText
        }
      });
    }
    let iteration = 0;
    for (iteration = 0; iteration < maxIterations; iteration++) {
      if (abortSignal?.aborted) {
        logger12.info(`${agentName} execution aborted at iteration ${iteration + 1}/${maxIterations}`);
        currentSession.status = "error";
        currentSession.endTime = /* @__PURE__ */ new Date();
        currentSession.terminationReason = "error";
        if (_AgentRunner.eventBus) {
          _AgentRunner.eventBus.emitProgress({
            type: "session_completed",
            sessionId: currentSession.sessionId,
            parentSessionId: currentSession.parentSessionId,
            agentName,
            timestamp: /* @__PURE__ */ new Date(),
            data: { session: currentSession, reason: "aborted" }
          });
        }
        const abortResult = createErrorResult("Execution was cancelled", messages, "error");
        if (afterExecute) {
          try {
            await afterExecute(abortResult, currentSession);
          } catch (error) {
            logger12.warn(`afterExecute hook failed for ${agentName}:`, error);
          }
        }
        return { ...abortResult, agentSession: currentSession };
      }
      if (currentSession) {
        currentSession.iterationCount = iteration + 1;
      }
      logger12.info(`${agentName} Iteration ${iteration + 1}/${maxIterations}`);
      const iterationInfo = `
## Current Progress
- You are currently on step ${iteration + 1} of ${maxIterations - 1} maximum steps.
- Focus on making meaningful progress with each step.`;
      const currentSystemPrompt = systemPrompt + iterationInfo;
      let llmResponse;
      try {
        logger12.info(`${agentName} Calling LLM with ${messages.length} messages`);
        const provider = LLMProviderRegistry.getProvider(config.provider);
        if (!provider) {
          throw new Error(`Provider ${config.provider} not found in registry`);
        }
        const llmMessages = _AgentRunner.convertToLLMMessages(messages);
        let isVisionForMainCall = false;
        if (typeof config.getVisionCapability === "function") {
          try {
            const res = await config.getVisionCapability(modelName);
            isVisionForMainCall = typeof res === "boolean" ? res : false;
          } catch {
            isVisionForMainCall = false;
          }
        }
        const sanitizedForMainCall = sanitizeMessagesForModel(llmMessages, {
          visionCapable: isVisionForMainCall,
          placeholderForImageOnly: true
        });
        const messagesWithSystem = [
          { role: "system", content: currentSystemPrompt },
          ...sanitizedForMainCall
        ];
        llmResponse = await provider.callWithMessages(modelName, messagesWithSystem, {
          tools: toolSchemas,
          temperature: temperature ?? 0
        });
      } catch (error) {
        logger12.error(`${agentName} LLM call failed:`, error);
        const errorMsg = `LLM call failed: ${error.message || String(error)}`;
        const systemErrorMessage = {
          entity: "tool_result" /* TOOL_RESULT */,
          toolName: "system_error",
          resultText: errorMsg,
          isError: true,
          error: errorMsg
        };
        messages.push(systemErrorMessage);
        const errorSummary = await this.summarizeAgentProgress(
          messages,
          maxIterations,
          agentName,
          modelName,
          "error",
          config.provider,
          config.getVisionCapability
        );
        agentSession.status = "error";
        agentSession.endTime = /* @__PURE__ */ new Date();
        agentSession.terminationReason = "error";
        if (_AgentRunner.eventBus) {
          _AgentRunner.eventBus.emitProgress({
            type: "session_completed",
            sessionId: agentSession.sessionId,
            parentSessionId: agentSession.parentSessionId,
            agentName,
            timestamp: /* @__PURE__ */ new Date(),
            data: { session: agentSession, reason: "error" }
          });
        }
        const result2 = createErrorResult(errorMsg, messages, "error");
        result2.summary = {
          type: "error",
          content: errorSummary
        };
        if (afterExecute) {
          try {
            await afterExecute(result2, agentSession);
          } catch (error2) {
            logger12.warn(`afterExecute hook failed for ${agentName}:`, error2);
          }
        }
        return { ...result2, agentSession };
      }
      const parsedAction = exports.LLMResponseParser.parseResponse(llmResponse);
      try {
        let newModelMessage;
        if (parsedAction.type === "tool_call") {
          const { name: toolName, args: toolArgs } = parsedAction;
          const toolCallId = crypto.randomUUID();
          newModelMessage = {
            entity: "model" /* MODEL */,
            action: "tool",
            toolName,
            toolArgs,
            toolCallId,
            isFinalAnswer: false,
            reasoning: llmResponse.reasoning?.summary
          };
          messages.push(newModelMessage);
          addSessionMessage({
            type: "tool_call",
            content: {
              type: "tool_call",
              toolName,
              toolArgs,
              toolCallId,
              reasoning: Array.isArray(llmResponse.reasoning?.summary) ? llmResponse.reasoning.summary.join(" ") : llmResponse.reasoning?.summary || void 0
            }
          });
          logger12.info(`${agentName} LLM requested tool: ${toolName}`);
          const toolToExecute = toolMap.get(toolName);
          if (!toolToExecute) {
            const result2 = errorHandler.handleUnknownTool(toolName, toolCallId);
            if (result2.shouldContinue && result2.errorMessage) {
              messages.push(result2.errorMessage);
              if (result2.sessionMessage) {
                addSessionMessage(result2.sessionMessage);
              }
              continue;
            }
            continue;
          }
          let toolResultText = "";
          let toolIsError = false;
          let toolResultData = null;
          let imageData;
          if (toolName.startsWith("handoff_to_") && "config" in toolToExecute) {
            const targetAgentTool = toolToExecute;
            const handoffConfig = executingAgent?.config.handoffs?.find(
              (h) => h.targetAgentName === targetAgentTool.name && (!h.trigger || h.trigger === "llm_tool_call")
            );
            if (!handoffConfig) {
              throw new Error(`Internal error: No matching 'llm_tool_call' handoff config found for ${toolName}`);
            }
            const nestedSessionId = crypto.randomUUID();
            addSessionMessage({
              type: "handoff",
              content: {
                type: "handoff",
                targetAgent: targetAgentTool.name,
                reason: `Handing off to ${targetAgentTool.name}`,
                context: toolArgs,
                nestedSessionId
              }
            });
            const handoffResult = await _AgentRunner.executeHandoff(
              messages,
              toolArgs,
              handoffConfig,
              executingAgent,
              apiKey,
              modelName,
              maxIterations,
              temperature ?? 0,
              createSuccessResult,
              createErrorResult,
              toolArgs,
              currentSession,
              config.provider,
              config.getVisionCapability,
              config.miniModel,
              config.nanoModel,
              { sessionId: nestedSessionId, parentSessionId: currentSession.sessionId }
            );
            agentSession.status = "completed";
            agentSession.endTime = /* @__PURE__ */ new Date();
            agentSession.terminationReason = "handed_off";
            if (_AgentRunner.eventBus) {
              _AgentRunner.eventBus.emitProgress({
                type: "session_completed",
                sessionId: agentSession.sessionId,
                parentSessionId: agentSession.parentSessionId,
                agentName,
                timestamp: /* @__PURE__ */ new Date(),
                data: { session: agentSession, reason: "handed_off" }
              });
            }
            return { ...handoffResult, agentSession };
          } else {
            let preallocatedChildId;
            if ("config" in toolToExecute) {
              preallocatedChildId = crypto.randomUUID();
              const childPlaceholder = {
                sessionId: preallocatedChildId,
                agentName: toolName,
                parentSessionId: currentSession.sessionId,
                status: "running",
                startTime: /* @__PURE__ */ new Date(),
                messages: [],
                nestedSessions: [],
                tools: []
              };
              currentSession.nestedSessions.push(childPlaceholder);
              addSessionMessage({
                type: "handoff",
                content: {
                  type: "handoff",
                  targetAgent: toolName,
                  reason: `Handing off to ${toolName}`,
                  context: toolArgs,
                  nestedSessionId: preallocatedChildId
                }
              });
              if (_AgentRunner.eventBus) {
                _AgentRunner.eventBus.emitProgress({
                  type: "child_agent_started",
                  sessionId: currentSession.sessionId,
                  parentSessionId: currentSession.parentSessionId,
                  agentName: currentSession.agentName,
                  timestamp: /* @__PURE__ */ new Date(),
                  data: {
                    parentSession: currentSession,
                    childAgentName: toolName,
                    childSessionId: preallocatedChildId
                  }
                });
              }
            }
            try {
              logger12.info(`${agentName} Executing tool: ${toolToExecute.name}`);
              toolResultData = await toolToExecute.execute(toolArgs, {
                apiKey: config.apiKey,
                provider: config.provider,
                model: modelName,
                miniModel: config.miniModel,
                nanoModel: config.nanoModel,
                getVisionCapability: config.getVisionCapability,
                abortSignal,
                overrideSessionId: preallocatedChildId,
                overrideParentSessionId: currentSession.sessionId
              });
              if ("config" in toolToExecute && toolResultData?.agentSession) {
                const index = currentSession.nestedSessions.findIndex((s) => s.sessionId === preallocatedChildId);
                if (index !== -1) {
                  try {
                    toolResultData.agentSession.parentSessionId = currentSession.sessionId;
                  } catch {
                  }
                  currentSession.nestedSessions[index] = toolResultData.agentSession;
                }
              }
              if (typeof toolResultData === "object" && toolResultData !== null) {
                imageData = toolResultData.imageData;
              }
              if (typeof toolResultData === "object" && toolResultData !== null && "success" in toolResultData && ("output" in toolResultData || "error" in toolResultData)) {
                toolResultText = toolResultData.success ? toolResultData.output || "Agent completed successfully" : toolResultData.error || "Agent failed";
              } else {
                toolResultText = _AgentRunner.computeToolResultText(toolResultData, imageData);
              }
              if (typeof toolResultData === "object" && toolResultData !== null) {
                if (toolResultData.hasOwnProperty("error") && !!toolResultData.error) {
                  toolIsError = true;
                  toolResultText = toolResultData.error || toolResultText;
                } else if (toolResultData.hasOwnProperty("success") && toolResultData.success === false) {
                  toolIsError = true;
                  toolResultText = toolResultData.error || toolResultData.message || toolResultText;
                }
              }
            } catch (err) {
              logger12.error(`${agentName} Error executing tool ${toolToExecute.name}:`, err);
              toolResultText = `Error during tool execution: ${err.message || String(err)}`;
              toolIsError = true;
              toolResultData = { error: toolResultText };
            }
          }
          const toolResultMessage = {
            entity: "tool_result" /* TOOL_RESULT */,
            toolName,
            resultText: toolResultText,
            isError: toolIsError,
            toolCallId,
            ...toolIsError && { error: toolResultText },
            ...toolResultData && { resultData: toolResultData },
            ...imageData && { imageData }
          };
          if (typeof toolResultData === "object" && toolResultData !== null && "success" in toolResultData && toolResultData.summary) {
            toolResultMessage.summary = toolResultData.summary.content;
          }
          messages.push(toolResultMessage);
          addSessionMessage({
            type: "tool_result",
            content: {
              type: "tool_result",
              toolCallId,
              toolName,
              success: !toolIsError,
              result: toolResultData,
              error: toolIsError ? toolResultText : void 0
            }
          });
          logger12.info(`${agentName} Tool ${toolName} execution result added. Error: ${toolIsError}`);
        } else if (parsedAction.type === "final_answer") {
          const { answer } = parsedAction;
          newModelMessage = {
            entity: "model" /* MODEL */,
            action: "final",
            answer,
            isFinalAnswer: true,
            reasoning: llmResponse.reasoning?.summary
          };
          messages.push(newModelMessage);
          addSessionMessage({
            type: "final_answer",
            content: {
              type: "final_answer",
              answer,
              summary: Array.isArray(llmResponse.reasoning?.summary) ? llmResponse.reasoning.summary.join(" ") : llmResponse.reasoning?.summary || void 0
            }
          });
          logger12.info(`${agentName} LLM provided final answer.`);
          let finalAnswer = answer;
          if (executingAgent?.config?.includeSummaryInAnswer === true) {
            logger12.info(`Generating summary for ${agentName} (includeSummaryInAnswer=true)`);
            const completionSummary = await this.summarizeAgentProgress(
              messages,
              maxIterations,
              agentName,
              modelName,
              "final_answer",
              config.provider,
              config.getVisionCapability
            );
            finalAnswer = `${answer}

---

### Analysis of Agentic Conversation

${completionSummary}`;
          } else {
            logger12.info(`Skipping summary for ${agentName} (includeSummaryInAnswer not enabled)`);
          }
          agentSession.status = "completed";
          agentSession.endTime = /* @__PURE__ */ new Date();
          agentSession.terminationReason = "final_answer";
          if (_AgentRunner.eventBus) {
            _AgentRunner.eventBus.emitProgress({
              type: "session_completed",
              sessionId: agentSession.sessionId,
              parentSessionId: agentSession.parentSessionId,
              agentName,
              timestamp: /* @__PURE__ */ new Date(),
              data: { session: agentSession, reason: "final_answer" }
            });
          }
          const result2 = createSuccessResult(finalAnswer, messages, "final_answer");
          if (afterExecute) {
            try {
              await afterExecute(result2, agentSession);
            } catch (error) {
              logger12.warn(`afterExecute hook failed for ${agentName}:`, error);
            }
          }
          return { ...result2, agentSession };
        } else if (parsedAction.type === "error") {
          const result2 = errorHandler.handleParsingError(parsedAction.error);
          if (result2.shouldContinue && result2.errorMessage) {
            messages.push(result2.errorMessage);
            if (result2.sessionMessage) {
              addSessionMessage(result2.sessionMessage);
            }
            continue;
          }
        } else {
          throw new Error(`Unknown parsed action type: ${parsedAction.type}`);
        }
      } catch (error) {
        logger12.error(`${agentName} Error processing LLM response or executing tool:`, error);
        const errorMsg = `Agent loop error: ${error.message || String(error)}`;
        const systemErrorMessage = {
          entity: "tool_result" /* TOOL_RESULT */,
          toolName: "system_error",
          resultText: errorMsg,
          isError: true,
          error: errorMsg
        };
        messages.push(systemErrorMessage);
        const errorSummary = await this.summarizeAgentProgress(
          messages,
          maxIterations,
          agentName,
          modelName,
          "error",
          config.provider,
          config.getVisionCapability
        );
        agentSession.status = "error";
        agentSession.endTime = /* @__PURE__ */ new Date();
        agentSession.terminationReason = "error";
        if (_AgentRunner.eventBus) {
          _AgentRunner.eventBus.emitProgress({
            type: "session_completed",
            sessionId: agentSession.sessionId,
            parentSessionId: agentSession.parentSessionId,
            agentName,
            timestamp: /* @__PURE__ */ new Date(),
            data: { session: agentSession, reason: "error" }
          });
        }
        const result2 = createErrorResult(errorMsg, messages, "error");
        result2.summary = {
          type: "error",
          content: errorSummary
        };
        if (afterExecute) {
          try {
            await afterExecute(result2, agentSession);
          } catch (error2) {
            logger12.warn(`afterExecute hook failed for ${agentName}:`, error2);
          }
        }
        return { ...result2, agentSession };
      }
    }
    logger12.warn(`${agentName} Reached max iterations (${maxIterations}) without completion.`);
    if (executingAgent?.config.handoffs) {
      const maxIterHandoffConfig = executingAgent.config.handoffs.find((h) => h.trigger === "max_iterations");
      if (maxIterHandoffConfig) {
        logger12.info(
          `${agentName} Found 'max_iterations' handoff config. Initiating handoff to ${maxIterHandoffConfig.targetAgentName}.`
        );
        const handoffResult = await _AgentRunner.executeHandoff(
          messages,
          args,
          maxIterHandoffConfig,
          executingAgent,
          apiKey,
          modelName,
          maxIterations,
          temperature ?? 0,
          createSuccessResult,
          createErrorResult,
          void 0,
          currentSession,
          config.provider,
          config.getVisionCapability,
          config.miniModel,
          config.nanoModel
        );
        const { agentSession: childSession, ...actualResult } = handoffResult;
        if (currentSession) {
          currentSession.nestedSessions.push(childSession);
        }
        agentSession.status = "completed";
        agentSession.endTime = /* @__PURE__ */ new Date();
        agentSession.terminationReason = "handed_off";
        if (_AgentRunner.eventBus) {
          _AgentRunner.eventBus.emitProgress({
            type: "session_completed",
            sessionId: agentSession.sessionId,
            parentSessionId: agentSession.parentSessionId,
            agentName,
            timestamp: /* @__PURE__ */ new Date(),
            data: { session: agentSession, reason: "handed_off" }
          });
        }
        return { ...actualResult, agentSession };
      }
    }
    logger12.warn(`${agentName} No 'max_iterations' handoff configured. Returning error.`);
    agentSession.status = "error";
    agentSession.endTime = /* @__PURE__ */ new Date();
    agentSession.terminationReason = "max_iterations";
    if (_AgentRunner.eventBus) {
      _AgentRunner.eventBus.emitProgress({
        type: "session_completed",
        sessionId: agentSession.sessionId,
        parentSessionId: agentSession.parentSessionId,
        agentName,
        timestamp: /* @__PURE__ */ new Date(),
        data: { session: agentSession, reason: "max_iterations" }
      });
    }
    const progressSummary = await this.summarizeAgentProgress(
      messages,
      maxIterations,
      agentName,
      modelName,
      "max_iterations",
      config.provider,
      config.getVisionCapability
    );
    const result = createErrorResult("Agent reached maximum iterations", messages, "max_iterations");
    result.summary = {
      type: "timeout",
      content: progressSummary
    };
    if (afterExecute) {
      try {
        await afterExecute(result, agentSession);
      } catch (error) {
        logger12.warn(`afterExecute hook failed for ${agentName}:`, error);
      }
    }
    return { ...result, agentSession };
  }
  /**
   * Generate a summary of agent progress using LLM
   */
  static async summarizeAgentProgress(messages, maxIterations, agentName, modelName, completionType = "max_iterations", provider, getVisionCapability) {
    logger12.info(`Generating summary for agent "${agentName}" with completion type: ${completionType}`);
    try {
      const llmMessages = this.convertToLLMMessages(messages);
      llmMessages.unshift({
        role: "system",
        content: `You are an expert AI agent analyzer specializing in understanding multi-agent workflows and execution patterns. Your task is to analyze agent conversations and generate actionable summaries.`
      });
      let summaryPrompt;
      switch (completionType) {
        case "final_answer":
          summaryPrompt = `Please analyze the entire conversation above and provide a concise summary that includes:

1. **User Request**: What the user originally asked for
2. **Agent Decisions**: Key decisions and actions the agent took to accomplish the task
3. **Final Outcome**: What the agent accomplished`;
          break;
        case "error":
          summaryPrompt = `1. **User Request**: What the user originally asked for
2. **Agent Decisions**: Key decisions and actions the agent took before the error
3. **Error Context**: What the agent was attempting when the error occurred`;
          break;
        case "max_iterations":
        default:
          summaryPrompt = `The agent "${agentName}" has reached its maximum iteration limit of ${maxIterations}.

Please analyze the entire conversation above and provide a COMPREHENSIVE summary that includes:

1. **User Request**: What the user originally asked for
2. **Agent Decisions**: Key decisions and actions taken
3. **Progress Assessment**: Whether meaningful progress was made
4. **Recommendations**: Specific next steps to continue this work`;
          break;
      }
      llmMessages.push({
        role: "user",
        content: summaryPrompt
      });
      const selectedProvider = LLMProviderRegistry.getProvider(provider);
      if (!selectedProvider) {
        throw new Error(`Provider ${provider} not found in registry`);
      }
      let isVision = false;
      if (typeof getVisionCapability === "function") {
        try {
          const res = await getVisionCapability(modelName);
          isVision = typeof res === "boolean" ? res : false;
        } catch {
          isVision = false;
        }
      }
      const sanitizedMessages = sanitizeMessagesForModel(llmMessages, {
        visionCapable: isVision,
        placeholderForImageOnly: true
      });
      const response = await selectedProvider.callWithMessages(modelName, sanitizedMessages, {
        temperature: 0.1
      });
      logger12.info(`Generated summary for agent "${agentName}":`, response.text || "No summary generated.");
      return response.text || "No summary generated.";
    } catch (error) {
      logger12.error("Failed to generate agent progress summary:", error);
      return `Agent ${agentName} reached maximum iterations (${maxIterations}). Summary generation failed.`;
    }
  }
};
// Event bus for progress tracking (optional)
_AgentRunner.eventBus = null;
var AgentRunner = _AgentRunner;

// src/agent/ConfigurableAgentTool.ts
init_Logger();
var logger13 = createLogger("ConfigurableAgentTool");
var ConfigurableAgentTool = class {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.schema = config.schema;
    if (!config.systemPrompt) {
      throw new Error(`ConfigurableAgentTool: systemPrompt is required for ${config.name}`);
    }
    if (config.init) {
      config.init(this);
    }
  }
  /**
   * Get the tool instances for this agent
   */
  getToolInstances() {
    return this.config.tools.map((toolName) => ToolRegistry.getRegisteredTool(toolName)).filter((tool) => tool !== null);
  }
  /**
   * Prepare initial messages for the agent
   */
  prepareInitialMessages(args) {
    if (this.config.prepareMessages) {
      return this.config.prepareMessages(args, this.config);
    }
    return [
      {
        entity: "user" /* USER */,
        text: args.query
      }
    ];
  }
  /**
   * Create a success result
   */
  createSuccessResult(output, intermediateSteps, reason) {
    if (this.config.createSuccessResult) {
      return this.config.createSuccessResult(output, intermediateSteps, reason, this.config);
    }
    const result = {
      success: true,
      output,
      terminationReason: reason
    };
    if (this.config.includeIntermediateStepsOnReturn === true) {
      result.intermediateSteps = intermediateSteps;
    }
    return result;
  }
  /**
   * Create an error result
   */
  createErrorResult(error, intermediateSteps, reason) {
    if (this.config.createErrorResult) {
      return this.config.createErrorResult(error, intermediateSteps, reason, this.config);
    }
    const result = {
      success: false,
      error,
      terminationReason: reason
    };
    if (this.config.includeIntermediateStepsOnReturn === true) {
      result.intermediateSteps = intermediateSteps;
    }
    return result;
  }
  /**
   * Execute the agent
   */
  async execute(args, ctx) {
    logger13.info(`Executing ${this.name} via AgentRunner with args:`, args);
    const callCtx = ctx || {};
    const apiKey = callCtx.apiKey;
    const provider = callCtx.provider;
    const requiresApiKey = provider !== "litellm" && provider !== "browseroperator";
    if (requiresApiKey && !apiKey) {
      const errorResult2 = this.createErrorResult(`API key not configured for ${this.name}`, [], "error");
      const errorSession = {
        agentName: this.name,
        agentQuery: args.query,
        agentReasoning: args.reasoning,
        sessionId: crypto.randomUUID(),
        status: "error",
        startTime: /* @__PURE__ */ new Date(),
        endTime: /* @__PURE__ */ new Date(),
        messages: [],
        nestedSessions: [],
        tools: [],
        terminationReason: "error"
      };
      return { ...errorResult2, agentSession: errorSession };
    }
    if (this.config.beforeExecute) {
      try {
        await this.config.beforeExecute(callCtx);
      } catch (error) {
        logger13.warn(`beforeExecute hook failed for ${this.name}:`, error);
      }
    }
    const maxIterations = this.config.maxIterations || 10;
    let modelName;
    if (this.config.modelName === MODEL_SENTINELS.USE_MINI) {
      modelName = callCtx.miniModel || callCtx.mainModel || callCtx.model || "";
      if (!modelName) {
        throw new Error(
          `Mini model not provided in context for agent '${this.name}'. Ensure context includes miniModel or mainModel.`
        );
      }
    } else if (this.config.modelName === MODEL_SENTINELS.USE_NANO) {
      modelName = callCtx.nanoModel || callCtx.miniModel || callCtx.mainModel || callCtx.model || "";
      if (!modelName) {
        throw new Error(
          `Nano model not provided in context for agent '${this.name}'. Ensure context includes nanoModel, miniModel, or mainModel.`
        );
      }
    } else if (typeof this.config.modelName === "function") {
      modelName = this.config.modelName();
    } else if (this.config.modelName) {
      modelName = this.config.modelName;
    } else {
      const contextModel = callCtx.mainModel || callCtx.model;
      if (!contextModel) {
        throw new Error(
          `No model provided for agent '${this.name}'. Ensure context includes model or mainModel.`
        );
      }
      modelName = contextModel;
    }
    if (callCtx.model && !this.config.modelName) {
      modelName = callCtx.model;
    }
    if (this.config.modelName === MODEL_SENTINELS.USE_MINI && !callCtx.miniModel) {
      callCtx.miniModel = modelName;
    }
    if (this.config.modelName === MODEL_SENTINELS.USE_NANO && !callCtx.nanoModel) {
      callCtx.nanoModel = modelName;
    }
    if (!callCtx.provider) {
      throw new Error(
        `Provider not provided in context for agent '${this.name}'. Ensure context includes provider.`
      );
    }
    const temperature = this.config.temperature ?? 0;
    const systemPrompt = this.config.systemPrompt;
    const tools = this.getToolInstances();
    const internalMessages = this.prepareInitialMessages(args);
    const runnerConfig = {
      apiKey: apiKey || "",
      modelName,
      systemPrompt,
      tools,
      maxIterations,
      temperature,
      provider: callCtx.provider,
      getVisionCapability: callCtx.getVisionCapability ?? (() => false),
      miniModel: callCtx.miniModel,
      nanoModel: callCtx.nanoModel
    };
    const runnerHooks = {
      prepareInitialMessages: void 0,
      createSuccessResult: this.config.createSuccessResult ? (out, steps, reason) => this.config.createSuccessResult(out, steps, reason, this.config) : (out, steps, reason) => this.createSuccessResult(out, steps, reason),
      createErrorResult: this.config.createErrorResult ? (err, steps, reason) => this.config.createErrorResult(err, steps, reason, this.config) : (err, steps, reason) => this.createErrorResult(err, steps, reason),
      afterExecute: this.config.afterExecute ? async (result2, agentSession) => this.config.afterExecute(result2, agentSession, callCtx) : void 0
    };
    const result = await AgentRunner.run(
      internalMessages,
      args,
      runnerConfig,
      runnerHooks,
      this,
      void 0,
      {
        sessionId: callCtx.overrideSessionId,
        parentSessionId: callCtx.overrideParentSessionId
      },
      callCtx.abortSignal
    );
    return result;
  }
};

// src/orchestration/OrchestrationTypes.ts
var END_NODE = "__end__";
var GraphAbortedError = class extends Error {
  constructor(message = "Graph execution was aborted") {
    super(message);
    this.name = "GraphAbortedError";
  }
};
var GraphMaxStepsError = class extends Error {
  constructor(maxSteps) {
    super(`Graph execution exceeded maximum steps: ${maxSteps}`);
    this.name = "GraphMaxStepsError";
  }
};
var NodeNotFoundError = class extends Error {
  constructor(nodeName) {
    super(`Node not found: ${nodeName}`);
    this.name = "NodeNotFoundError";
  }
};
var RoutingError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RoutingError";
  }
};

// src/orchestration/StateGraph.ts
init_Logger();
var logger14 = createLogger("StateGraph");
var StateGraph = class {
  constructor(config) {
    this.nodes = /* @__PURE__ */ new Map();
    this.conditionalEdges = /* @__PURE__ */ new Map();
    this.entryPoint = config.entryPoint || "start";
    this.name = config.name;
  }
  /**
   * Add a node to the graph
   * @param name - Unique name for the node
   * @param node - Runnable that implements the node logic
   */
  addNode(name, node) {
    if (this.nodes.has(name)) {
      logger14.warn(`Overwriting existing node: ${name}`);
    }
    this.nodes.set(name, node);
    logger14.debug(`Added node: ${name}`);
  }
  /**
   * Add conditional edges from a source node
   * @param sourceName - Name of the source node
   * @param condition - Function that evaluates state and returns a routing key
   * @param targetMap - Map of routing keys to target node names
   */
  addConditionalEdges(sourceName, condition, targetMap) {
    if (!this.nodes.has(sourceName)) {
      logger14.warn(`Adding conditional edge from unknown node: ${sourceName}`);
    }
    const targetMapInternal = /* @__PURE__ */ new Map();
    for (const key in targetMap) {
      targetMapInternal.set(key, targetMap[key]);
    }
    this.conditionalEdges.set(sourceName, {
      condition,
      targetMap: targetMapInternal
    });
    logger14.debug(`Added conditional edges from: ${sourceName}`);
  }
  /**
   * Set the entry point for graph execution
   * @param name - Name of the entry point node
   */
  setEntryPoint(name) {
    if (!this.nodes.has(name)) {
      throw new NodeNotFoundError(name);
    }
    this.entryPoint = name;
    logger14.debug(`Set entry point: ${name}`);
  }
  /**
   * Get the current entry point
   */
  getEntryPoint() {
    return this.entryPoint;
  }
  /**
   * Get all node names
   */
  getNodeNames() {
    return Array.from(this.nodes.keys());
  }
  /**
   * Check if a node exists
   */
  hasNode(name) {
    return this.nodes.has(name);
  }
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
  async *invoke(state, options = {}) {
    const { maxSteps = 50, signal, onProgress } = options;
    logger14.info(`Starting graph execution: ${this.name} from entry point: ${this.entryPoint}`);
    let currentState = state;
    let currentNodeName = this.entryPoint;
    let step = 0;
    if (onProgress) {
      onProgress({
        type: "node_start",
        nodeName: this.entryPoint,
        step: 0,
        state: currentState
      });
    }
    while (currentNodeName !== END_NODE) {
      if (signal?.aborted) {
        logger14.info(`Graph execution aborted at step ${step}, node: ${currentNodeName}`);
        throw new GraphAbortedError();
      }
      if (step >= maxSteps) {
        logger14.error(`Graph execution exceeded max steps: ${maxSteps}`);
        throw new GraphMaxStepsError(maxSteps);
      }
      logger14.debug(`Step ${step}: Executing node: ${currentNodeName}`);
      const node = this.nodes.get(currentNodeName);
      if (!node) {
        logger14.error(`Node not found: ${currentNodeName}`);
        throw new NodeNotFoundError(currentNodeName);
      }
      if (onProgress) {
        onProgress({
          type: "node_start",
          nodeName: currentNodeName,
          step,
          state: currentState
        });
      }
      try {
        const startTime = Date.now();
        currentState = await node.invoke(currentState, signal);
        const duration = Date.now() - startTime;
        logger14.debug(`Step ${step}: Node ${currentNodeName} completed in ${duration}ms`);
        if (onProgress) {
          onProgress({
            type: "node_complete",
            nodeName: currentNodeName,
            step,
            state: currentState,
            data: { duration }
          });
        }
        yield currentState;
      } catch (error) {
        logger14.error(`Error executing node ${currentNodeName}:`, error);
        if (onProgress) {
          onProgress({
            type: "node_error",
            nodeName: currentNodeName,
            step,
            state: currentState,
            data: { error }
          });
        }
        throw error;
      }
      const edgeConfig = this.conditionalEdges.get(currentNodeName);
      if (!edgeConfig) {
        logger14.debug(`No conditional edge from node: ${currentNodeName}. Ending graph.`);
        currentNodeName = END_NODE;
      } else {
        try {
          const routingKey = edgeConfig.condition(currentState);
          logger14.debug(`Routing key from condition: ${routingKey}`);
          if (onProgress) {
            onProgress({
              type: "routing",
              nodeName: currentNodeName,
              step,
              data: { routingKey }
            });
          }
          const nextNodeName = edgeConfig.targetMap.get(routingKey);
          if (!nextNodeName) {
            throw new RoutingError(
              `No target node found for routing key "${routingKey}" from node "${currentNodeName}"`
            );
          }
          if (nextNodeName !== END_NODE && !this.nodes.has(nextNodeName)) {
            throw new NodeNotFoundError(nextNodeName);
          }
          currentNodeName = nextNodeName;
          logger14.debug(`Next node: ${currentNodeName}`);
        } catch (error) {
          logger14.error(`Routing error from node ${currentNodeName}:`, error);
          throw error;
        }
      }
      step++;
    }
    logger14.info(`Graph execution completed after ${step} steps`);
    return currentState;
  }
  /**
   * Execute the graph and return only the final state (convenience method)
   * @param state - Initial state
   * @param options - Execution options
   * @returns Promise resolving to final state
   */
  async run(state, options = {}) {
    let finalState = state;
    for await (const intermediateState of this.invoke(state, options)) {
      finalState = intermediateState;
    }
    return finalState;
  }
  /**
   * Get a summary of the graph structure (for debugging)
   */
  getSummary() {
    const edges = Array.from(this.conditionalEdges.entries()).map(([from, edge]) => ({
      from,
      to: Array.from(edge.targetMap.values())
    }));
    return {
      name: this.name,
      entryPoint: this.entryPoint,
      nodeCount: this.nodes.size,
      nodes: Array.from(this.nodes.keys()),
      edges
    };
  }
};

// src/orchestration/GraphBuilder.ts
var GraphBuilder = class {
  constructor(name, config) {
    this.graph = new StateGraph({ name, ...config });
  }
  /**
   * Add a node to the graph
   * @param name - Node name
   * @param node - Node implementation
   * @returns This builder for chaining
   */
  addNode(name, node) {
    this.graph.addNode(name, node);
    return this;
  }
  /**
   * Add conditional edges from a node
   * @param sourceName - Source node name
   * @param condition - Condition function
   * @param targetMap - Target map
   * @returns This builder for chaining
   */
  addEdge(sourceName, condition, targetMap) {
    this.graph.addConditionalEdges(sourceName, condition, targetMap);
    return this;
  }
  /**
   * Add a simple edge that always goes to the same target
   * @param sourceName - Source node name
   * @param targetName - Target node name
   * @returns This builder for chaining
   */
  addSimpleEdge(sourceName, targetName) {
    this.graph.addConditionalEdges(sourceName, () => "next", { next: targetName });
    return this;
  }
  /**
   * Set the entry point
   * @param name - Entry point node name
   * @returns This builder for chaining
   */
  setEntryPoint(name) {
    this.graph.setEntryPoint(name);
    return this;
  }
  /**
   * Build the final graph
   * @returns The constructed StateGraph
   */
  build() {
    return this.graph;
  }
};
function createNode(fn) {
  return {
    invoke: fn
  };
}
function createSyncNode(fn) {
  return {
    invoke: async (state) => fn(state)
  };
}
function createPassthroughNode() {
  return {
    invoke: async (state) => state
  };
}

// src/index.ts
var VERSION = "0.1.0";

exports.AgentErrorHandler = AgentErrorHandler;
exports.AgentRunner = AgentRunner;
exports.AgentRunnerEventBus = AgentRunnerEventBus;
exports.ChatMessageEntity = ChatMessageEntity;
exports.ConfigurableAgentTool = ConfigurableAgentTool;
exports.DEFAULT_AGENT_UI = DEFAULT_AGENT_UI;
exports.END_NODE = END_NODE;
exports.GraphAbortedError = GraphAbortedError;
exports.GraphBuilder = GraphBuilder;
exports.GraphMaxStepsError = GraphMaxStepsError;
exports.LLMClient = LLMClient;
exports.LLMProviderRegistry = LLMProviderRegistry;
exports.MODEL_SENTINELS = MODEL_SENTINELS;
exports.NodeNotFoundError = NodeNotFoundError;
exports.RoutingError = RoutingError;
exports.StateGraph = StateGraph;
exports.ToolRegistry = ToolRegistry;
exports.VERSION = VERSION;
exports.createLogger = createLogger;
exports.createModelMessage = createModelMessage;
exports.createNode = createNode;
exports.createPassthroughNode = createPassthroughNode;
exports.createSyncNode = createSyncNode;
exports.createToolResult = createToolResult;
exports.createToolResultMessage = createToolResultMessage;
exports.createUserMessage = createUserMessage;
exports.errorResult = errorResult;
exports.formatAgentName = formatAgentName;
exports.getAgentDescription = getAgentDescription;
exports.getAgentDisplayName = getAgentDisplayName;
exports.getAgentUIConfig = getAgentUIConfig;
exports.getGlobalLogLevel = getGlobalLogLevel;
exports.sanitizeMessagesForModel = sanitizeMessagesForModel;
exports.setGlobalLogLevel = setGlobalLogLevel;
exports.successResult = successResult;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map