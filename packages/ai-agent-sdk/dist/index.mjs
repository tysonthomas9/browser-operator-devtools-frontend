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

// src/agent/AgentTypes.ts
var MODEL_SENTINELS = {
  USE_MINI: "use-mini",
  USE_NANO: "use-nano"
};

// src/agent/AgentErrorHandler.ts
var logger4 = createLogger("AgentErrorHandler");
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
    logger4.warn(`${agentName} requested unknown tool: ${toolName}`);
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
    logger4.info(`${agentName} Added unknown tool error to conversation, will continue execution`);
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
    logger4.warn(`${agentName} LLM response parsing error: ${error}`);
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
    logger4.info(`${agentName} Added parsing error to conversation, will continue execution`);
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
var logger5 = createLogger("AgentRunner");
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
      logger5.error(`${errorMsg}`);
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
    logger5.info(`Initiating handoff from ${executingAgent.name} to ${targetAgent.name}`);
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
    logger5.info(`Executing handoff target agent: ${targetAgent.name} with ${handoffMessages.length} messages.`);
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
    logger5.info(`Handoff target agent ${targetAgent.name} finished. Result success: ${actualResult.success}`);
    if (targetAgent.config.includeIntermediateStepsOnReturn === true) {
      logger5.info(`Including intermediateSteps from ${targetAgent.name} based on its config.`);
      const combinedIntermediateSteps = [...currentMessages, ...actualResult.intermediateSteps || []];
      return {
        ...actualResult,
        intermediateSteps: combinedIntermediateSteps,
        terminationReason: actualResult.terminationReason || "handed_off",
        agentSession: childSession
      };
    }
    logger5.info(`Omitting intermediateSteps from ${targetAgent.name} based on its config.`);
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
    logger5.info(`Starting execution loop for agent: ${agentName}`);
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
            logger5.info(`Added LLM handoff tool schema: ${handoffToolName}`);
          } else {
            logger5.warn(
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
        logger5.info(`${agentName} execution aborted at iteration ${iteration + 1}/${maxIterations}`);
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
            logger5.warn(`afterExecute hook failed for ${agentName}:`, error);
          }
        }
        return { ...abortResult, agentSession: currentSession };
      }
      if (currentSession) {
        currentSession.iterationCount = iteration + 1;
      }
      logger5.info(`${agentName} Iteration ${iteration + 1}/${maxIterations}`);
      const iterationInfo = `
## Current Progress
- You are currently on step ${iteration + 1} of ${maxIterations - 1} maximum steps.
- Focus on making meaningful progress with each step.`;
      const currentSystemPrompt = systemPrompt + iterationInfo;
      let llmResponse;
      try {
        logger5.info(`${agentName} Calling LLM with ${messages.length} messages`);
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
        logger5.error(`${agentName} LLM call failed:`, error);
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
            logger5.warn(`afterExecute hook failed for ${agentName}:`, error2);
          }
        }
        return { ...result2, agentSession };
      }
      const parsedAction = LLMResponseParser.parseResponse(llmResponse);
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
          logger5.info(`${agentName} LLM requested tool: ${toolName}`);
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
              logger5.info(`${agentName} Executing tool: ${toolToExecute.name}`);
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
              logger5.error(`${agentName} Error executing tool ${toolToExecute.name}:`, err);
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
          logger5.info(`${agentName} Tool ${toolName} execution result added. Error: ${toolIsError}`);
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
          logger5.info(`${agentName} LLM provided final answer.`);
          let finalAnswer = answer;
          if (executingAgent?.config?.includeSummaryInAnswer === true) {
            logger5.info(`Generating summary for ${agentName} (includeSummaryInAnswer=true)`);
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
            logger5.info(`Skipping summary for ${agentName} (includeSummaryInAnswer not enabled)`);
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
              logger5.warn(`afterExecute hook failed for ${agentName}:`, error);
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
        logger5.error(`${agentName} Error processing LLM response or executing tool:`, error);
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
            logger5.warn(`afterExecute hook failed for ${agentName}:`, error2);
          }
        }
        return { ...result2, agentSession };
      }
    }
    logger5.warn(`${agentName} Reached max iterations (${maxIterations}) without completion.`);
    if (executingAgent?.config.handoffs) {
      const maxIterHandoffConfig = executingAgent.config.handoffs.find((h) => h.trigger === "max_iterations");
      if (maxIterHandoffConfig) {
        logger5.info(
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
    logger5.warn(`${agentName} No 'max_iterations' handoff configured. Returning error.`);
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
        logger5.warn(`afterExecute hook failed for ${agentName}:`, error);
      }
    }
    return { ...result, agentSession };
  }
  /**
   * Generate a summary of agent progress using LLM
   */
  static async summarizeAgentProgress(messages, maxIterations, agentName, modelName, completionType = "max_iterations", provider, getVisionCapability) {
    logger5.info(`Generating summary for agent "${agentName}" with completion type: ${completionType}`);
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
      logger5.info(`Generated summary for agent "${agentName}":`, response.text || "No summary generated.");
      return response.text || "No summary generated.";
    } catch (error) {
      logger5.error("Failed to generate agent progress summary:", error);
      return `Agent ${agentName} reached maximum iterations (${maxIterations}). Summary generation failed.`;
    }
  }
};
// Event bus for progress tracking (optional)
_AgentRunner.eventBus = null;
var AgentRunner = _AgentRunner;

// src/agent/ConfigurableAgentTool.ts
var logger6 = createLogger("ConfigurableAgentTool");
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
    logger6.info(`Executing ${this.name} via AgentRunner with args:`, args);
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
        logger6.warn(`beforeExecute hook failed for ${this.name}:`, error);
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
var logger7 = createLogger("StateGraph");
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
      logger7.warn(`Overwriting existing node: ${name}`);
    }
    this.nodes.set(name, node);
    logger7.debug(`Added node: ${name}`);
  }
  /**
   * Add conditional edges from a source node
   * @param sourceName - Name of the source node
   * @param condition - Function that evaluates state and returns a routing key
   * @param targetMap - Map of routing keys to target node names
   */
  addConditionalEdges(sourceName, condition, targetMap) {
    if (!this.nodes.has(sourceName)) {
      logger7.warn(`Adding conditional edge from unknown node: ${sourceName}`);
    }
    const targetMapInternal = /* @__PURE__ */ new Map();
    for (const key in targetMap) {
      targetMapInternal.set(key, targetMap[key]);
    }
    this.conditionalEdges.set(sourceName, {
      condition,
      targetMap: targetMapInternal
    });
    logger7.debug(`Added conditional edges from: ${sourceName}`);
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
    logger7.debug(`Set entry point: ${name}`);
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
    logger7.info(`Starting graph execution: ${this.name} from entry point: ${this.entryPoint}`);
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
        logger7.info(`Graph execution aborted at step ${step}, node: ${currentNodeName}`);
        throw new GraphAbortedError();
      }
      if (step >= maxSteps) {
        logger7.error(`Graph execution exceeded max steps: ${maxSteps}`);
        throw new GraphMaxStepsError(maxSteps);
      }
      logger7.debug(`Step ${step}: Executing node: ${currentNodeName}`);
      const node = this.nodes.get(currentNodeName);
      if (!node) {
        logger7.error(`Node not found: ${currentNodeName}`);
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
        logger7.debug(`Step ${step}: Node ${currentNodeName} completed in ${duration}ms`);
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
        logger7.error(`Error executing node ${currentNodeName}:`, error);
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
        logger7.debug(`No conditional edge from node: ${currentNodeName}. Ending graph.`);
        currentNodeName = END_NODE;
      } else {
        try {
          const routingKey = edgeConfig.condition(currentState);
          logger7.debug(`Routing key from condition: ${routingKey}`);
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
          logger7.debug(`Next node: ${currentNodeName}`);
        } catch (error) {
          logger7.error(`Routing error from node ${currentNodeName}:`, error);
          throw error;
        }
      }
      step++;
    }
    logger7.info(`Graph execution completed after ${step} steps`);
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

export { AgentErrorHandler, AgentRunner, AgentRunnerEventBus, ChatMessageEntity, ConfigurableAgentTool, DEFAULT_AGENT_UI, END_NODE, GraphAbortedError, GraphBuilder, GraphMaxStepsError, LLMBaseProvider, LLMErrorType, LLMProviderRegistry, LLMResponseParser, LogLevel, Logger, MODEL_SENTINELS, NodeNotFoundError, RoutingError, StateGraph, ToolRegistry, VERSION, createLogger, createModelMessage, createNode, createPassthroughNode, createSyncNode, createToolResult, createToolResultMessage, createUserMessage, errorResult, formatAgentName, getAgentDescription, getAgentDisplayName, getAgentUIConfig, getGlobalLogLevel, sanitizeMessagesForModel, setGlobalLogLevel, successResult };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map