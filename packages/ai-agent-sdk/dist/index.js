'use strict';

// src/llm/LLMTypes.ts
var LLMErrorType = /* @__PURE__ */ ((LLMErrorType2) => {
  LLMErrorType2["JSON_PARSE_ERROR"] = "JSON_PARSE_ERROR";
  LLMErrorType2["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
  LLMErrorType2["NETWORK_ERROR"] = "NETWORK_ERROR";
  LLMErrorType2["SERVER_ERROR"] = "SERVER_ERROR";
  LLMErrorType2["AUTH_ERROR"] = "AUTH_ERROR";
  LLMErrorType2["QUOTA_ERROR"] = "QUOTA_ERROR";
  LLMErrorType2["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
  return LLMErrorType2;
})(LLMErrorType || {});

// src/llm/LLMProvider.ts
var LLMBaseProvider = class {
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

// src/observability/Logger.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
  LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
  LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
  LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
  LogLevel2[LogLevel2["NONE"] = 4] = "NONE";
  return LogLevel2;
})(LogLevel || {});
var Logger = class {
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
function createLogger(name, config) {
  return new Logger(name, config);
}
var globalLogLevel = 1 /* INFO */;
function setGlobalLogLevel(level) {
  globalLogLevel = level;
}
function getGlobalLogLevel() {
  return globalLogLevel;
}

// src/llm/LLMProviderRegistry.ts
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

// src/llm/LLMResponseParser.ts
var logger2 = createLogger("LLMResponseParser");
var LLMResponseParser = class {
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
var logger3 = createLogger("ToolRegistry");
var ToolRegistry = class {
  // Store instances
  /**
   * Register a tool factory and create/store an instance
   */
  static registerToolFactory(name, factory) {
    if (this.toolFactories.has(name)) {
      logger3.warn(`Tool factory already registered for: ${name}. Overwriting.`);
    }
    if (this.registeredTools.has(name)) {
      logger3.warn(`Tool instance already registered for: ${name}. Overwriting.`);
    }
    this.toolFactories.set(name, factory);
    try {
      const instance = factory();
      this.registeredTools.set(name, instance);
      logger3.info(`Registered and instantiated tool: ${name}`);
    } catch (error) {
      logger3.error(`Failed to instantiate tool '${name}' during registration:`, error);
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
    logger3.info("Tool Registry cleared");
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
      logger3.info(`Unregistered tool: ${name}`);
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

// src/index.ts
var VERSION = "0.1.0";

exports.ChatMessageEntity = ChatMessageEntity;
exports.DEFAULT_AGENT_UI = DEFAULT_AGENT_UI;
exports.LLMBaseProvider = LLMBaseProvider;
exports.LLMErrorType = LLMErrorType;
exports.LLMProviderRegistry = LLMProviderRegistry;
exports.LLMResponseParser = LLMResponseParser;
exports.LogLevel = LogLevel;
exports.Logger = Logger;
exports.ToolRegistry = ToolRegistry;
exports.VERSION = VERSION;
exports.createLogger = createLogger;
exports.createModelMessage = createModelMessage;
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