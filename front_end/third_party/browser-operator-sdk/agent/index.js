import { z } from 'zod';

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
function setError(state, error) {
  return {
    ...state,
    error
  };
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

export { Agent };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map