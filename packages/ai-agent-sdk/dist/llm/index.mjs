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
var LLMErrorType;
var init_LLMTypes = __esm({
  "src/llm/LLMTypes.ts"() {
    LLMErrorType = /* @__PURE__ */ ((LLMErrorType2) => {
      LLMErrorType2["JSON_PARSE_ERROR"] = "JSON_PARSE_ERROR";
      LLMErrorType2["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
      LLMErrorType2["NETWORK_ERROR"] = "NETWORK_ERROR";
      LLMErrorType2["SERVER_ERROR"] = "SERVER_ERROR";
      LLMErrorType2["AUTH_ERROR"] = "AUTH_ERROR";
      LLMErrorType2["QUOTA_ERROR"] = "QUOTA_ERROR";
      LLMErrorType2["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
      return LLMErrorType2;
    })(LLMErrorType || {});
  }
});

// src/llm/LLMProvider.ts
var LLMBaseProvider;
var init_LLMProvider = __esm({
  "src/llm/LLMProvider.ts"() {
    LLMBaseProvider = class {
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
  return new Logger(name, config);
}
var Logger;
var init_Logger = __esm({
  "src/observability/Logger.ts"() {
    Logger = class {
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
  }
});

// src/llm/LLMResponseParser.ts
var logger2, LLMResponseParser;
var init_LLMResponseParser = __esm({
  "src/llm/LLMResponseParser.ts"() {
    init_Logger();
    logger2 = createLogger("LLMResponseParser");
    LLMResponseParser = class {
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
var logger3, DEFAULT_RETRY_CONFIG, ERROR_SPECIFIC_RETRY_CONFIGS, LLMErrorClassifier, LLMRetryManager, LLMErrorUtils;
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
    LLMErrorClassifier = class {
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
    LLMRetryManager = class _LLMRetryManager {
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
            const errorType = LLMErrorClassifier.classifyError(lastError);
            if (this.config.enableLogging) {
              logger3.error(`Operation failed on attempt ${attempt}:`, {
                error: lastError.message,
                errorType,
                context: options.context
              });
            }
            if (!LLMErrorClassifier.shouldRetry(errorType)) {
              if (this.config.enableLogging) {
                logger3.info(`Not retrying ${errorType} error`);
              }
              throw lastError;
            }
            const retryConfig = LLMErrorClassifier.getRetryConfig(errorType, options.customRetryConfig);
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
    LLMErrorUtils = class {
      /**
       * Check if an error is retryable
       */
      static isRetryable(error) {
        const errorType = LLMErrorClassifier.classifyError(error);
        return LLMErrorClassifier.shouldRetry(errorType);
      }
      /**
       * Get human-readable error message
       */
      static getErrorMessage(error) {
        const errorType = LLMErrorClassifier.classifyError(error);
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
        const errorType = LLMErrorClassifier.classifyError(error);
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
  OpenAIProvider: () => OpenAIProvider
});
var logger4, _OpenAIProvider, OpenAIProvider;
var init_OpenAIProvider = __esm({
  "src/llm/OpenAIProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger4 = createLogger("OpenAIProvider");
    _OpenAIProvider = class _OpenAIProvider extends LLMBaseProvider {
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
        return LLMRetryManager.simpleRetry(async () => {
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
        return LLMResponseParser.parseResponse(response);
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
    OpenAIProvider = _OpenAIProvider;
  }
});

// src/llm/LiteLLMProvider.ts
var LiteLLMProvider_exports = {};
__export(LiteLLMProvider_exports, {
  LiteLLMProvider: () => LiteLLMProvider
});
var logger5, _LiteLLMProvider, LiteLLMProvider;
var init_LiteLLMProvider = __esm({
  "src/llm/LiteLLMProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger5 = createLogger("LiteLLMProvider");
    _LiteLLMProvider = class _LiteLLMProvider extends LLMBaseProvider {
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
        return LLMRetryManager.simpleRetry(async () => {
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
        return LLMResponseParser.parseResponse(response);
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
    LiteLLMProvider = _LiteLLMProvider;
  }
});

// src/llm/GroqProvider.ts
var GroqProvider_exports = {};
__export(GroqProvider_exports, {
  GroqProvider: () => GroqProvider
});
var logger6, _GroqProvider, GroqProvider;
var init_GroqProvider = __esm({
  "src/llm/GroqProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger6 = createLogger("GroqProvider");
    _GroqProvider = class _GroqProvider extends LLMBaseProvider {
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
        return LLMRetryManager.simpleRetry(async () => {
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
        return LLMResponseParser.parseResponse(response);
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
    GroqProvider = _GroqProvider;
  }
});

// src/llm/OpenRouterProvider.ts
var OpenRouterProvider_exports = {};
__export(OpenRouterProvider_exports, {
  OpenRouterProvider: () => OpenRouterProvider
});
var logger7, _OpenRouterProvider, OpenRouterProvider;
var init_OpenRouterProvider = __esm({
  "src/llm/OpenRouterProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger7 = createLogger("OpenRouterProvider");
    _OpenRouterProvider = class _OpenRouterProvider extends LLMBaseProvider {
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
        return LLMRetryManager.simpleRetry(async () => {
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
        return LLMResponseParser.parseResponse(response);
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
    OpenRouterProvider = _OpenRouterProvider;
  }
});

// src/llm/BrowserOperatorProvider.ts
var BrowserOperatorProvider_exports = {};
__export(BrowserOperatorProvider_exports, {
  BrowserOperatorProvider: () => BrowserOperatorProvider
});
var logger8, _BrowserOperatorProvider, BrowserOperatorProvider;
var init_BrowserOperatorProvider = __esm({
  "src/llm/BrowserOperatorProvider.ts"() {
    init_LLMProvider();
    init_LLMErrorHandler();
    init_LLMResponseParser();
    init_Logger();
    logger8 = createLogger("BrowserOperatorProvider");
    _BrowserOperatorProvider = class _BrowserOperatorProvider extends LLMBaseProvider {
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
        return LLMRetryManager.simpleRetry(async () => {
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
        return LLMResponseParser.parseResponse(response);
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
    BrowserOperatorProvider = _BrowserOperatorProvider;
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
    return LLMResponseParser.parseResponse(response);
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

export { BrowserOperatorProvider, GroqProvider, LLMBaseProvider, LLMClient, LLMErrorClassifier, LLMErrorType, LLMErrorUtils, LLMProviderRegistry, LLMResponseParser, LLMRetryManager, LiteLLMProvider, OpenAIProvider, OpenRouterProvider, sanitizeMessagesForModel };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map