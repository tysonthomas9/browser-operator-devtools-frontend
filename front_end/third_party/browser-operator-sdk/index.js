import { z } from 'zod';

// src/types/index.ts
var ChatMessageEntity = /* @__PURE__ */ ((ChatMessageEntity2) => {
  ChatMessageEntity2["USER"] = "user";
  ChatMessageEntity2["MODEL"] = "model";
  ChatMessageEntity2["TOOL_RESULT"] = "tool-result";
  ChatMessageEntity2["TOOL_CALL"] = "tool-call";
  return ChatMessageEntity2;
})(ChatMessageEntity || {});

// src/events/EventEmitter.ts
var EventEmitter = class {
  events = /* @__PURE__ */ new Map();
  /**
   * Subscribe to an event
   */
  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, /* @__PURE__ */ new Set());
    }
    this.events.get(event).add(handler);
    return this;
  }
  /**
   * Unsubscribe from an event
   */
  off(event, handler) {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }
  /**
   * Subscribe to an event once
   */
  once(event, handler) {
    const onceHandler = (data) => {
      this.off(event, onceHandler);
      handler(data);
    };
    return this.on(event, onceHandler);
  }
  /**
   * Emit an event
   */
  emit(event, data) {
    const handlers = this.events.get(event);
    if (!handlers || handlers.size === 0) {
      return false;
    }
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${String(event)}:`, error);
      }
    });
    return true;
  }
  /**
   * Remove all listeners for an event, or all listeners if no event specified
   */
  removeAllListeners(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
  /**
   * Get the number of listeners for an event
   */
  listenerCount(event) {
    return this.events.get(event)?.size ?? 0;
  }
};

// src/events/index.ts
var AgentEvent = /* @__PURE__ */ ((AgentEvent2) => {
  AgentEvent2["START"] = "agent:start";
  AgentEvent2["ITERATION"] = "agent:iteration";
  AgentEvent2["TOOL_CALL"] = "agent:tool-call";
  AgentEvent2["TOOL_RESULT"] = "agent:tool-result";
  AgentEvent2["FINISH"] = "agent:finish";
  AgentEvent2["ERROR"] = "agent:error";
  AgentEvent2["STATE_CHANGE"] = "agent:state-change";
  return AgentEvent2;
})(AgentEvent || {});
var AgentEventEmitter = class extends EventEmitter {
  /**
   * Emit start event
   */
  emitStart(context) {
    this.emit("agent:start" /* START */, { context });
  }
  /**
   * Emit iteration event
   */
  emitIteration(context, iteration) {
    this.emit("agent:iteration" /* ITERATION */, { context, iteration });
  }
  /**
   * Emit tool call event
   */
  emitToolCall(context, toolCall) {
    this.emit("agent:tool-call" /* TOOL_CALL */, { context, toolCall });
  }
  /**
   * Emit tool result event
   */
  emitToolResult(context, result, toolCallId) {
    this.emit("agent:tool-result" /* TOOL_RESULT */, { context, result, toolCallId });
  }
  /**
   * Emit finish event
   */
  emitFinish(context, result) {
    this.emit("agent:finish" /* FINISH */, { context, result });
  }
  /**
   * Emit error event
   */
  emitError(context, error) {
    this.emit("agent:error" /* ERROR */, { context, error });
  }
  /**
   * Emit state change event
   */
  emitStateChange(context) {
    this.emit("agent:state-change" /* STATE_CHANGE */, { context });
  }
};
var globalEventBus = null;
function getGlobalEventBus() {
  if (!globalEventBus) {
    globalEventBus = new AgentEventEmitter();
  }
  return globalEventBus;
}
function resetGlobalEventBus() {
  globalEventBus = null;
}

// src/state/index.ts
function createInitialState() {
  return {
    messages: [],
    context: {},
    metadata: {},
    variables: {}
  };
}
function createUserMessage(text, entity) {
  return {
    entity,
    text,
    id: generateId(),
    timestamp: Date.now()
  };
}
function addMessage(state, message) {
  return {
    ...state,
    messages: [...state.messages, message]
  };
}
function updateContext(state, context) {
  return {
    ...state,
    context: { ...state.context, ...context }
  };
}
function updateVariables(state, variables) {
  return {
    ...state,
    variables: { ...state.variables, ...variables }
  };
}
function setError(state, error) {
  return {
    ...state,
    error
  };
}
function clearError(state) {
  const { error, ...rest } = state;
  return rest;
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function cloneState(state) {
  return {
    ...state,
    messages: [...state.messages],
    context: { ...state.context },
    metadata: { ...state.metadata },
    variables: { ...state.variables }
  };
}

// src/hooks/index.ts
async function executeOnStart(hooks, context) {
  if (hooks?.onStart) {
    await hooks.onStart(context);
  }
}
async function executeOnIteration(hooks, context, iteration) {
  if (hooks?.onIteration) {
    await hooks.onIteration(context, iteration);
  }
}
async function executeOnToolCall(hooks, context, toolCall) {
  if (hooks?.onToolCall) {
    await hooks.onToolCall(context, toolCall);
  }
}
async function executeOnToolResult(hooks, context, result) {
  if (hooks?.onToolResult) {
    await hooks.onToolResult(context, result);
  }
}
async function executeOnFinish(hooks, context, result) {
  if (hooks?.onFinish) {
    await hooks.onFinish(context, result);
  }
}
async function executeOnError(hooks, context, error) {
  if (hooks?.onError) {
    await hooks.onError(context, error);
  }
}
function createDefaultHooks() {
  return {
    onStart: async () => {
    },
    onIteration: async () => {
    },
    onToolCall: async () => {
    },
    onToolResult: async () => {
    },
    onFinish: async () => {
    },
    onError: async () => {
    }
  };
}
function mergeHooks(base, override) {
  return {
    onStart: override.onStart || base.onStart,
    onIteration: override.onIteration || base.onIteration,
    onToolCall: override.onToolCall || base.onToolCall,
    onToolResult: override.onToolResult || base.onToolResult,
    onFinish: override.onFinish || base.onFinish,
    onError: override.onError || base.onError
  };
}

// src/tools/createTool.ts
function createTool(config) {
  return {
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    execute: config.execute,
    metadata: config.metadata
  };
}
function createSimpleTool(config) {
  const anySchema = {
    parse: (val) => val,
    safeParse: (val) => ({ success: true, data: val })
  };
  return {
    id: config.id,
    description: config.description,
    inputSchema: anySchema,
    outputSchema: anySchema,
    execute: async (ctx) => {
      return config.execute(ctx.context);
    },
    metadata: config.metadata
  };
}
var RuntimeContext = class {
  data = /* @__PURE__ */ new Map();
  constructor(initialData) {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        this.data.set(key, value);
      });
    }
  }
  get(key) {
    return this.data.get(key);
  }
  set(key, value) {
    this.data.set(key, value);
  }
  has(key) {
    return this.data.has(key);
  }
  clear() {
    this.data.clear();
  }
  keys() {
    return Array.from(this.data.keys());
  }
};
function zodToOpenAISchema(schema) {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value;
      properties[key] = zodTypeToJsonSchema(zodType);
      if (!(zodType instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : void 0
    };
  }
  return {
    type: "object",
    properties: {}
  };
}
function zodTypeToJsonSchema(zodType) {
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  if (zodType instanceof z.ZodNullable) {
    return {
      ...zodTypeToJsonSchema(zodType.unwrap()),
      nullable: true
    };
  }
  if (zodType instanceof z.ZodString) {
    const schema = { type: "string" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodNumber) {
    const schema = { type: "number" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodBoolean) {
    const schema = { type: "boolean" };
    if (zodType.description) {
      schema.description = zodType.description;
    }
    return schema;
  }
  if (zodType instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodTypeToJsonSchema(zodType.element)
    };
  }
  if (zodType instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: zodType.options
    };
  }
  if (zodType instanceof z.ZodObject) {
    return zodToOpenAISchema(zodType);
  }
  return { type: "string" };
}
function toolToOpenAIFunction(tool) {
  const parameters = zodToOpenAISchema(tool.inputSchema);
  return {
    name: tool.id,
    description: tool.description,
    parameters
  };
}
function toolsToOpenAIFunctions(tools) {
  return Object.values(tools).map(toolToOpenAIFunction);
}
async function executeTool(tool, input, options) {
  const parsedInput = tool.inputSchema.parse(input);
  const runtimeContext = new RuntimeContext(options?.runtimeContext);
  const controller = new AbortController();
  const abortSignal = options?.abortSignal || controller.signal;
  let timeoutId;
  if (options?.timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);
  }
  try {
    const output = await tool.execute({
      context: parsedInput,
      runtimeContext,
      abortSignal
    });
    if (options?.validateOutput !== false) {
      const parsedOutput = tool.outputSchema.parse(output);
      return parsedOutput;
    }
    return output;
  } finally {
    if (timeoutId !== void 0) {
      clearTimeout(timeoutId);
    }
  }
}
async function executeToolCall(tools, toolCallId, toolName, args, options) {
  try {
    const tool = tools[toolName];
    if (!tool) {
      return {
        toolCallId,
        result: `Error: Tool '${toolName}' not found`,
        success: false,
        error: `Tool '${toolName}' not found`
      };
    }
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(args);
    } catch (error) {
      return {
        toolCallId,
        result: `Error: Invalid JSON arguments: ${String(error)}`,
        success: false,
        error: `Invalid JSON arguments: ${String(error)}`
      };
    }
    const output = await executeTool(tool, parsedArgs, options);
    const resultString = typeof output === "string" ? output : JSON.stringify(output, null, 2);
    return {
      toolCallId,
      result: resultString,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      toolCallId,
      result: `Error: ${errorMessage}`,
      success: false,
      error: errorMessage
    };
  }
}

// src/agent/Agent.ts
var Agent = class {
  config;
  eventEmitter;
  sessionId;
  provider;
  runtimeContext;
  constructor(config, provider, runtimeContext) {
    this.config = config;
    this.provider = provider;
    this.eventEmitter = new AgentEventEmitter();
    this.sessionId = this.generateSessionId();
    this.runtimeContext = new RuntimeContext(runtimeContext);
  }
  /**
   * Generate text response
   */
  async generateText(input, options) {
    const state = createInitialState();
    const context = this.createContext(state);
    try {
      await executeOnStart(this.config.hooks, context);
      this.eventEmitter.emitStart(context);
      const userMessage = createUserMessage(input, "user" /* USER */);
      context.state = addMessage(context.state, userMessage);
      const messages = this.convertToLLMMessages(context.state.messages);
      const tools = this.config.tools ? this.convertToolsToLLMFormat(this.config.tools) : void 0;
      const llmOptions = {
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        tools,
        abortSignal: options?.abortSignal
      };
      const response = await this.provider.call(
        this.config.model,
        messages,
        llmOptions
      );
      let finalResponse = response;
      let iteration = 0;
      const maxIterations = options?.maxIterations ?? this.config.maxIterations ?? 10;
      while (finalResponse.toolCalls && finalResponse.toolCalls.length > 0 && iteration < maxIterations) {
        iteration++;
        this.eventEmitter.emitIteration(context, iteration);
        for (const toolCall of finalResponse.toolCalls) {
          await executeOnToolCall(this.config.hooks, context, {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          });
          this.eventEmitter.emitToolCall(context, {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          });
          const result = await this.executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
          await executeOnToolResult(this.config.hooks, context, result);
          this.eventEmitter.emitToolResult(context, result, toolCall.id);
          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          });
        }
        finalResponse = await this.provider.call(this.config.model, messages, llmOptions);
      }
      const agentResult = {
        text: finalResponse.text,
        toolCalls: finalResponse.toolCalls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        })),
        finishReason: this.mapFinishReason(finalResponse.finishReason, iteration >= maxIterations),
        usage: finalResponse.usage,
        state: context.state
      };
      await executeOnFinish(this.config.hooks, context, agentResult);
      this.eventEmitter.emitFinish(context, agentResult);
      return agentResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.state = setError(context.state, err);
      await executeOnError(this.config.hooks, context, err);
      this.eventEmitter.emitError(context, err);
      throw err;
    }
  }
  /**
   * Stream text response
   */
  async *streamText(input, options) {
    const state = createInitialState();
    const context = this.createContext(state);
    try {
      await executeOnStart(this.config.hooks, context);
      this.eventEmitter.emitStart(context);
      const userMessage = createUserMessage(input, "user" /* USER */);
      context.state = addMessage(context.state, userMessage);
      const messages = this.convertToLLMMessages(context.state.messages);
      const llmOptions = {
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        stream: true,
        abortSignal: options?.abortSignal
      };
      if (!this.provider.stream) {
        throw new Error("Streaming not supported by this provider");
      }
      yield* this.provider.stream(this.config.model, messages, llmOptions);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.state = setError(context.state, err);
      await executeOnError(this.config.hooks, context, err);
      this.eventEmitter.emitError(context, err);
      throw err;
    }
  }
  /**
   * Subscribe to agent events
   */
  on(event, handler) {
    this.eventEmitter.on(event, handler);
  }
  /**
   * Unsubscribe from agent events
   */
  off(event, handler) {
    this.eventEmitter.off(event, handler);
  }
  /**
   * Get agent configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Get session ID
   */
  getSessionId() {
    return this.sessionId;
  }
  /**
   * Execute a tool using the tool system
   */
  async executeTool(name, args) {
    if (!this.config.tools) {
      throw new Error("No tools configured for this agent");
    }
    const tool = this.config.tools[name];
    if (!tool) {
      throw new Error(`Tool '${name}' not found in agent configuration`);
    }
    try {
      const result = await executeToolCall(
        this.config.tools,
        "temp-id",
        // Tool call ID (not used for internal execution)
        name,
        JSON.stringify(args),
        {
          runtimeContext: Object.fromEntries(this.runtimeContext.keys().map((k) => [k, this.runtimeContext.get(k)]))
        }
      );
      if (!result.success) {
        return { error: result.error || "Tool execution failed" };
      }
      try {
        return JSON.parse(result.result);
      } catch {
        return result.result;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  }
  /**
   * Convert tools to OpenAI function format
   */
  convertToolsToLLMFormat(tools) {
    if (!tools) {
      return [];
    }
    const functionDefs = toolsToOpenAIFunctions(tools);
    return functionDefs.map((fn) => ({
      type: "function",
      function: {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      }
    }));
  }
  /**
   * Create agent context
   */
  createContext(state) {
    return {
      state: cloneState(state),
      config: this.config,
      sessionId: this.sessionId,
      variables: /* @__PURE__ */ new Map()
    };
  }
  /**
   * Convert chat messages to LLM format
   */
  convertToLLMMessages(messages) {
    const llmMessages = [];
    if (this.config.instructions) {
      llmMessages.push({
        role: "system",
        content: this.config.instructions
      });
    }
    for (const msg of messages) {
      if (msg.entity === "user" /* USER */) {
        llmMessages.push({
          role: "user",
          content: msg.text
        });
      } else if (msg.entity === "model" /* MODEL */) {
        llmMessages.push({
          role: "assistant",
          content: msg.text,
          tool_calls: msg.toolCalls?.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }))
        });
      }
    }
    return llmMessages;
  }
  /**
   * Map LLM finish reason to agent finish reason
   */
  mapFinishReason(reason, reachedMaxIterations) {
    if (reachedMaxIterations) {
      return "max-iterations";
    }
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool-calls";
      default:
        return "stop";
    }
  }
  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

// src/llm/BaseProvider.ts
var BaseLLMProvider = class {
  apiKey;
  endpoint;
  constructor(apiKey, endpoint) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }
  /**
   * Make HTTP request with retry logic
   */
  async makeRequest(url, body, options, additionalHeaders) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        ...additionalHeaders
      },
      body: JSON.stringify(body),
      signal: options?.abortSignal
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} - ${errorText}`
      );
    }
    return response;
  }
  /**
   * Parse streaming response
   */
  async *parseStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = this.extractStreamContent(parsed);
              if (content) {
                yield content;
              }
            } catch (e) {
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  /**
   * Stream LLM response (optional, provider-specific)
   */
  async *stream(model, messages, options) {
    throw new Error("Streaming not implemented for this provider");
  }
};

// src/llm/OpenAIProvider.ts
var OpenAIProvider = class _OpenAIProvider extends BaseLLMProvider {
  name = "openai";
  static DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
  constructor(apiKey, endpoint) {
    super(apiKey, endpoint || _OpenAIProvider.DEFAULT_ENDPOINT);
  }
  async call(model, messages, options) {
    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty
    };
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice;
      }
    }
    const response = await this.makeRequest(this.endpoint, body, options);
    const data = await response.json();
    return this.parseResponse(data);
  }
  async *stream(model, messages, options) {
    const body = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true
    };
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }
    const response = await this.makeRequest(this.endpoint, body, options);
    yield* this.parseStream(response);
  }
  extractStreamContent(chunk) {
    return chunk.choices?.[0]?.delta?.content || null;
  }
  parseResponse(data) {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error("No choices in response");
    }
    const message = choice.message;
    const toolCalls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
      }
    }));
    return {
      text: message.content || "",
      toolCalls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : void 0
    };
  }
  mapFinishReason(reason) {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }
};

// src/workflows/createStep.ts
function createStep(config) {
  return {
    id: config.id,
    inputSchema: config.inputSchema,
    outputSchema: config.outputSchema,
    stateSchema: config.stateSchema,
    execute: config.execute,
    metadata: config.metadata
  };
}

// src/workflows/WorkflowExecutor.ts
var WorkflowExecutor = class {
  config;
  nodes;
  state = {};
  stepResults = /* @__PURE__ */ new Map();
  initialInput;
  runtimeContext;
  storage;
  currentNodeIndex = 0;
  constructor(config, nodes, storage) {
    this.config = config;
    this.nodes = nodes;
    this.storage = storage;
  }
  /**
   * Execute workflow and wait for completion
   */
  async execute(input, options) {
    this.initialInput = input;
    this.runtimeContext = options?.runtimeContext;
    const startTime = Date.now();
    const stepResults = [];
    try {
      if (options?.resumeFromCheckpoint) {
        return await this.resumeFromCheckpoint(options.resumeFromCheckpoint);
      }
      const validatedInput = this.config.inputSchema.parse(input);
      if (options?.initialState) {
        this.state = { ...options.initialState };
      }
      let currentData = validatedInput;
      for (let i = 0; i < this.nodes.length; i++) {
        this.currentNodeIndex = i;
        const node = this.nodes[i];
        const result = await this.executeNode(node, currentData, options);
        stepResults.push(...result.steps);
        currentData = result.output;
        if (this.storage && options?.autoCheckpoint) {
          await this.saveCheckpoint(currentData);
        }
      }
      const validatedOutput = this.config.outputSchema.parse(currentData);
      return {
        workflowId: this.config.id,
        status: "success",
        output: validatedOutput,
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        workflowId: this.config.id,
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }
  /**
   * Execute workflow with streaming
   */
  async *stream(input, options) {
    this.initialInput = input;
    this.runtimeContext = options?.runtimeContext;
    yield {
      type: "workflow:start",
      workflowId: this.config.id,
      timestamp: Date.now()
    };
    try {
      const validatedInput = this.config.inputSchema.parse(input);
      if (options?.initialState) {
        this.state = { ...options.initialState };
      }
      let currentData = validatedInput;
      for (const node of this.nodes) {
        for await (const event of this.streamNode(node, currentData, options)) {
          yield event;
        }
        const result = await this.executeNode(node, currentData, options);
        currentData = result.output;
      }
      const validatedOutput = this.config.outputSchema.parse(currentData);
      yield {
        type: "workflow:complete",
        workflowId: this.config.id,
        output: validatedOutput,
        timestamp: Date.now()
      };
    } catch (error) {
      yield {
        type: "workflow:error",
        workflowId: this.config.id,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      };
    }
  }
  /**
   * Execute a single node
   */
  async executeNode(node, input, options) {
    switch (node.type) {
      case "step":
        return this.executeStep(node.step, input, options);
      case "parallel":
        return this.executeParallel(node.steps, input, options);
      case "branch":
        return this.executeBranch(node.branches, input, options);
      case "map":
        return this.executeMap(node.mapper, input, options);
      case "foreach":
        return this.executeForeach(node.step, input, node.options, options);
      case "dowhile":
        return this.executeDoWhile(node.condition, node.step, input, node.maxIterations, options);
      case "dountil":
        return this.executeDoUntil(node.condition, node.step, input, node.maxIterations, options);
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }
  /**
   * Execute a single step
   */
  async executeStep(step, input, options) {
    const startTime = Date.now();
    try {
      const validatedInput = step.inputSchema.parse(input);
      const context = {
        inputData: validatedInput,
        state: this.state,
        setState: (key, value) => {
          this.state[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput
      };
      const output = await step.execute(context);
      const validatedOutput = step.outputSchema.parse(output);
      this.stepResults.set(step.id, validatedOutput);
      const stepResult = {
        stepId: step.id,
        status: "success",
        output: validatedOutput,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
      return { output: validatedOutput, steps: [stepResult] };
    } catch (error) {
      ({
        stepId: step.id});
      throw error;
    }
  }
  /**
   * Execute steps in parallel
   */
  async executeParallel(steps, input, options) {
    const promises = steps.map((step) => this.executeStep(step, input, options));
    const results = await Promise.all(promises);
    const output = Object.fromEntries(
      results.map((result, index) => [steps[index].id, result.output])
    );
    const allStepResults = results.flatMap((r) => r.steps);
    return { output, steps: allStepResults };
  }
  /**
   * Execute conditional branch
   */
  async executeBranch(branches, input, options) {
    const context = {
      inputData: input,
      state: this.state,
      setState: (key, value) => {
        this.state[key] = value;
      },
      runtimeContext: this.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: (stepId) => this.stepResults.get(stepId),
      getInitData: () => this.initialInput
    };
    for (const [condition, step] of branches) {
      const matches = await condition(context);
      if (matches) {
        return this.executeStep(step, input, options);
      }
    }
    return { output: input, steps: [] };
  }
  /**
   * Execute map transformation
   */
  async executeMap(mapper, input, options) {
    const context = {
      inputData: input,
      state: this.state,
      setState: (key, value) => {
        this.state[key] = value;
      },
      runtimeContext: this.runtimeContext,
      abortSignal: options?.abortSignal,
      getStepResult: (stepId) => this.stepResults.get(stepId),
      getInitData: () => this.initialInput
    };
    const output = await mapper(context);
    return { output, steps: [] };
  }
  /**
   * Execute foreach loop
   */
  async executeForeach(step, input, foreachOptions, execOptions) {
    if (!Array.isArray(input)) {
      throw new Error("foreach requires array input");
    }
    const concurrency = foreachOptions?.concurrency || input.length;
    const maxIterations = foreachOptions?.iterationCount || input.length;
    const itemsToProcess = input.slice(0, maxIterations);
    const results = [];
    const allSteps = [];
    for (let i = 0; i < itemsToProcess.length; i += concurrency) {
      const batch = itemsToProcess.slice(i, i + concurrency);
      const batchPromises = batch.map((item) => this.executeStep(step, item, execOptions));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.map((r) => r.output));
      allSteps.push(...batchResults.flatMap((r) => r.steps));
    }
    return { output: results, steps: allSteps };
  }
  /**
   * Execute dowhile loop
   */
  async executeDoWhile(condition, step, input, maxIterations = 100, options) {
    let currentData = input;
    const allSteps = [];
    let iteration = 0;
    do {
      if (iteration >= maxIterations) {
        throw new Error(`dowhile loop exceeded max iterations (${maxIterations})`);
      }
      const result = await this.executeStep(step, currentData, options);
      allSteps.push(...result.steps);
      currentData = result.output;
      iteration++;
      const context = {
        inputData: currentData,
        state: this.state,
        setState: (key, value) => {
          this.state[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput
      };
      const shouldContinue = await condition(context);
      if (!shouldContinue) {
        break;
      }
    } while (true);
    return { output: currentData, steps: allSteps };
  }
  /**
   * Execute dountil loop
   */
  async executeDoUntil(condition, step, input, maxIterations = 100, options) {
    let currentData = input;
    const allSteps = [];
    let iteration = 0;
    do {
      if (iteration >= maxIterations) {
        throw new Error(`dountil loop exceeded max iterations (${maxIterations})`);
      }
      const result = await this.executeStep(step, currentData, options);
      allSteps.push(...result.steps);
      currentData = result.output;
      iteration++;
      const context = {
        inputData: currentData,
        state: this.state,
        setState: (key, value) => {
          this.state[key] = value;
        },
        runtimeContext: this.runtimeContext,
        abortSignal: options?.abortSignal,
        getStepResult: (stepId) => this.stepResults.get(stepId),
        getInitData: () => this.initialInput
      };
      const shouldStop = await condition(context);
      if (shouldStop) {
        break;
      }
    } while (true);
    return { output: currentData, steps: allSteps };
  }
  /**
   * Stream node execution
   */
  async *streamNode(node, input, options) {
    if (node.type === "step") {
      yield { type: "step:start", stepId: node.step.id, timestamp: Date.now() };
      try {
        const startTime = Date.now();
        const result = await this.executeStep(node.step, input, options);
        yield {
          type: "step:complete",
          stepId: node.step.id,
          output: result.output,
          duration: Date.now() - startTime,
          timestamp: Date.now()
        };
      } catch (error) {
        yield {
          type: "step:error",
          stepId: node.step.id,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - Date.now(),
          timestamp: Date.now()
        };
      }
    } else if (node.type === "parallel") {
      for (const step of node.steps) {
        yield { type: "step:start", stepId: step.id, timestamp: Date.now() };
      }
    }
  }
  /**
   * Create a checkpoint of the current workflow state
   */
  async saveCheckpoint(currentData) {
    if (!this.storage) {
      throw new Error("Storage not configured for checkpointing");
    }
    const checkpoint = {
      workflowId: this.config.id,
      nodeIndex: this.currentNodeIndex,
      state: this.state,
      stepResults: Object.fromEntries(this.stepResults),
      initialInput: this.initialInput,
      timestamp: Date.now()
    };
    await this.storage.save(checkpoint);
  }
  /**
   * Resume workflow execution from a checkpoint
   */
  async resumeFromCheckpoint(checkpoint) {
    const startTime = Date.now();
    const stepResults = [];
    try {
      this.state = checkpoint.state;
      this.initialInput = checkpoint.initialInput;
      this.stepResults = new Map(Object.entries(checkpoint.stepResults));
      this.currentNodeIndex = checkpoint.nodeIndex;
      let currentData = checkpoint.stepResults[Object.keys(checkpoint.stepResults).pop() || ""];
      for (let i = checkpoint.nodeIndex; i < this.nodes.length; i++) {
        this.currentNodeIndex = i;
        const node = this.nodes[i];
        const result = await this.executeNode(node, currentData, void 0);
        stepResults.push(...result.steps);
        currentData = result.output;
        if (this.storage) {
          await this.saveCheckpoint(currentData);
        }
      }
      const validatedOutput = this.config.outputSchema.parse(currentData);
      return {
        workflowId: this.config.id,
        status: "success",
        output: validatedOutput,
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        workflowId: this.config.id,
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
        steps: stepResults,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
    }
  }
  /**
   * Suspend the workflow and save its current state
   *
   * @returns The checkpoint that can be used to resume later
   */
  async suspend() {
    if (!this.storage) {
      throw new Error("Storage not configured for suspending");
    }
    const checkpoint = {
      workflowId: this.config.id,
      nodeIndex: this.currentNodeIndex,
      state: this.state,
      stepResults: Object.fromEntries(this.stepResults),
      initialInput: this.initialInput,
      timestamp: Date.now()
    };
    await this.storage.save(checkpoint);
    return checkpoint;
  }
  /**
   * Load a checkpoint from storage
   */
  async loadCheckpoint(workflowId) {
    if (!this.storage) {
      throw new Error("Storage not configured");
    }
    return await this.storage.load(workflowId);
  }
};

// src/workflows/WorkflowBuilder.ts
var CompiledWorkflow = class {
  constructor(config, nodes, storage) {
    this.config = config;
    this.nodes = nodes;
    this.storage = storage;
  }
  storage;
  /**
   * Execute workflow and wait for completion
   *
   * @example
   * ```typescript
   * const result = await workflow.start({ message: 'hello' });
   * console.log(result.output); // Final workflow output
   * console.log(result.steps);  // All step results
   * ```
   */
  async start(input, options) {
    const executor = new WorkflowExecutor(this.config, this.nodes, this.storage);
    return executor.execute(input, options);
  }
  /**
   * Execute workflow with streaming updates
   *
   * @example
   * ```typescript
   * for await (const event of workflow.stream({ message: 'hello' })) {
   *   if (event.type === 'step:complete') {
   *     console.log('Step completed:', event.stepId, event.output);
   *   }
   * }
   * ```
   */
  async *stream(input, options) {
    const executor = new WorkflowExecutor(this.config, this.nodes, this.storage);
    yield* executor.stream(input, options);
  }
  /**
   * Resume workflow from a checkpoint
   *
   * @example
   * ```typescript
   * const checkpoint = await storage.load(workflowId);
   * const result = await workflow.resume(checkpoint);
   * ```
   */
  async resume(checkpoint) {
    if (!this.storage) {
      throw new Error("Storage not configured for resuming workflows");
    }
    const executor = new WorkflowExecutor(this.config, this.nodes, this.storage);
    return executor.execute({}, { resumeFromCheckpoint: checkpoint });
  }
  /**
   * Resume workflow from storage by workflow ID
   *
   * @example
   * ```typescript
   * const result = await workflow.resumeById('workflow-123');
   * ```
   */
  async resumeById(workflowId) {
    if (!this.storage) {
      throw new Error("Storage not configured for resuming workflows");
    }
    const checkpoint = await this.storage.load(workflowId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for workflow ID: ${workflowId}`);
    }
    return this.resume(checkpoint);
  }
  /**
   * Get workflow configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Get workflow nodes
   */
  getNodes() {
    return [...this.nodes];
  }
  /**
   * Get the storage adapter (if configured)
   */
  getStorage() {
    return this.storage;
  }
};
var WorkflowBuilder = class {
  config;
  nodes = [];
  committed = false;
  storage;
  constructor(config) {
    this.config = config;
  }
  /**
   * Configure storage for workflow persistence
   *
   * @example
   * ```typescript
   * import { IndexedDBWorkflowStorage } from '@browser-operator/core/workflows';
   *
   * const storage = new IndexedDBWorkflowStorage();
   * const workflow = createWorkflow({ ... })
   *   .withStorage(storage)
   *   .then(step1)
   *   .commit();
   * ```
   */
  withStorage(storage) {
    this.ensureNotCommitted();
    this.storage = storage;
    return this;
  }
  /**
   * Add a step to execute sequentially
   *
   * @example
   * ```typescript
   * .then(formatStep)
   * .then(validateStep)
   * ```
   */
  then(step) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "step", step });
    return this;
  }
  /**
   * Execute multiple steps in parallel
   *
   * @example
   * ```typescript
   * .parallel([fetchUser, fetchPosts, fetchComments])
   * ```
   */
  parallel(steps) {
    this.ensureNotCommitted();
    if (steps.length === 0) {
      throw new Error("parallel() requires at least one step");
    }
    this.nodes.push({ type: "parallel", steps });
    return this;
  }
  /**
   * Branch based on conditions
   *
   * @example
   * ```typescript
   * .branch([
   *   [async ({ inputData }) => inputData.value > 10, highValueStep],
   *   [async ({ inputData }) => inputData.value <= 10, lowValueStep],
   * ])
   * ```
   */
  branch(branches) {
    this.ensureNotCommitted();
    if (branches.length === 0) {
      throw new Error("branch() requires at least one branch");
    }
    this.nodes.push({ type: "branch", branches });
    return this;
  }
  /**
   * Transform data between steps
   *
   * @example
   * ```typescript
   * .map(async ({ inputData, getStepResult }) => ({
   *   userId: getStepResult('user-step').id,
   *   message: inputData.message
   * }))
   * ```
   */
  map(mapper) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "map", mapper });
    return this;
  }
  /**
   * Iterate over array items
   *
   * @example
   * ```typescript
   * .foreach(processItem, { concurrency: 4, iterationCount: 100 })
   * ```
   */
  foreach(step, options) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "foreach", step, options });
    return this;
  }
  /**
   * Execute step while condition is true
   *
   * @example
   * ```typescript
   * .dowhile(
   *   async ({ state }) => state.counter < 10,
   *   incrementStep
   * )
   * ```
   */
  dowhile(condition, step, maxIterations = 100) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "dowhile", condition, step, maxIterations });
    return this;
  }
  /**
   * Execute step until condition becomes true
   *
   * @example
   * ```typescript
   * .dountil(
   *   async ({ state }) => state.completed === true,
   *   processStep
   * )
   * ```
   */
  dountil(condition, step, maxIterations = 100) {
    this.ensureNotCommitted();
    this.nodes.push({ type: "dountil", condition, step, maxIterations });
    return this;
  }
  /**
   * Commit the workflow (makes it immutable and ready for execution)
   *
   * @example
   * ```typescript
   * const workflow = createWorkflow({ ... })
   *   .then(step1)
   *   .then(step2)
   *   .commit();
   *
   * // Now workflow is ready to execute
   * const result = await workflow.start(input);
   * ```
   */
  commit() {
    this.committed = true;
    return new CompiledWorkflow(this.config, this.nodes, this.storage);
  }
  /**
   * Ensure workflow hasn't been committed yet
   */
  ensureNotCommitted() {
    if (this.committed) {
      throw new Error(
        "Cannot modify committed workflow. Create a new workflow builder instead."
      );
    }
  }
};

// src/workflows/createWorkflow.ts
function createWorkflow(config) {
  return new WorkflowBuilder(config);
}

export { Agent, AgentEvent, AgentEventEmitter, BaseLLMProvider, ChatMessageEntity, CompiledWorkflow, EventEmitter, OpenAIProvider, RuntimeContext, WorkflowBuilder, addMessage, clearError, cloneState, createDefaultHooks, createInitialState, createSimpleTool, createStep, createTool, createUserMessage, createWorkflow, executeOnError, executeOnFinish, executeOnIteration, executeOnStart, executeOnToolCall, executeOnToolResult, executeTool, executeToolCall, getGlobalEventBus, mergeHooks, resetGlobalEventBus, setError, toolToOpenAIFunction, toolsToOpenAIFunctions, updateContext, updateVariables, zodToOpenAISchema };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map