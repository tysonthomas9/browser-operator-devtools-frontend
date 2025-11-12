'use strict';

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

// src/llm/AnthropicProvider.ts
var AnthropicProvider = class _AnthropicProvider extends BaseLLMProvider {
  name = "anthropic";
  static DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/messages";
  static ANTHROPIC_VERSION = "2023-06-01";
  constructor(apiKey, endpoint) {
    super(apiKey, endpoint || _AnthropicProvider.DEFAULT_ENDPOINT);
  }
  async call(model, messages, options) {
    const { systemMessage, conversationMessages } = this.extractSystemMessage(messages);
    const body = {
      model,
      messages: this.convertToAnthropicFormat(conversationMessages),
      max_tokens: options?.maxTokens ?? 4096
    };
    if (systemMessage) {
      body.system = systemMessage;
    }
    if (options?.temperature !== void 0) {
      body.temperature = options.temperature;
    }
    if (options?.topP !== void 0) {
      body.top_p = options.topP;
    }
    if (options?.tools && options.tools.length > 0) {
      body.tools = this.convertToolsToAnthropicFormat(options.tools);
    }
    const response = await this.makeRequest(
      this.endpoint,
      body,
      options,
      this.getAnthropicHeaders()
    );
    const data = await response.json();
    return this.parseResponse(data);
  }
  async *stream(model, messages, options) {
    const { systemMessage, conversationMessages } = this.extractSystemMessage(messages);
    const body = {
      model,
      messages: this.convertToAnthropicFormat(conversationMessages),
      max_tokens: options?.maxTokens ?? 4096,
      stream: true
    };
    if (systemMessage) {
      body.system = systemMessage;
    }
    if (options?.temperature !== void 0) {
      body.temperature = options.temperature;
    }
    if (options?.tools && options.tools.length > 0) {
      body.tools = this.convertToolsToAnthropicFormat(options.tools);
    }
    const response = await this.makeRequest(
      this.endpoint,
      body,
      options,
      this.getAnthropicHeaders()
    );
    yield* this.parseAnthropicStream(response);
  }
  /**
   * Get Anthropic-specific headers
   */
  getAnthropicHeaders() {
    return {
      "anthropic-version": _AnthropicProvider.ANTHROPIC_VERSION,
      "x-api-key": this.apiKey,
      "Authorization": ""
      // Remove Authorization header, Anthropic uses x-api-key
    };
  }
  /**
   * Extract system message from messages array
   * Anthropic requires system messages to be passed separately
   */
  extractSystemMessage(messages) {
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");
    const systemMessage = systemMessages.map((m) => m.content).join("\n") || void 0;
    return { systemMessage, conversationMessages };
  }
  /**
   * Convert messages to Anthropic format
   */
  convertToAnthropicFormat(messages) {
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.tool_call_id || "",
              content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
            }
          ]
        };
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const content = [];
        if (msg.content) {
          content.push({
            type: "text",
            text: msg.content
          });
        }
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: typeof toolCall.function.arguments === "string" ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments
          });
        }
        return {
          role: msg.role,
          content
        };
      }
      return {
        role: msg.role,
        content: msg.content
      };
    });
  }
  /**
   * Convert OpenAI-style tools to Anthropic format
   */
  convertToolsToAnthropicFormat(tools) {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters
    }));
  }
  /**
   * Parse Anthropic streaming response
   */
  async *parseAnthropicStream(response) {
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
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                yield parsed.delta.text;
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
  extractStreamContent(chunk) {
    return null;
  }
  parseResponse(data) {
    if (data.type === "error") {
      throw new Error(`Anthropic API error: ${data.error?.message || "Unknown error"}`);
    }
    let text = "";
    const toolCalls = [];
    for (const block of data.content || []) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        });
      }
    }
    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : void 0,
      finishReason: this.mapStopReason(data.stop_reason),
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : void 0
    };
  }
  mapStopReason(reason) {
    switch (reason) {
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      case "stop_sequence":
        return "stop";
      default:
        return "stop";
    }
  }
};

// src/llm/GroqProvider.ts
var GroqProvider = class _GroqProvider extends BaseLLMProvider {
  name = "groq";
  static DEFAULT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
  constructor(apiKey, endpoint) {
    super(apiKey, endpoint || _GroqProvider.DEFAULT_ENDPOINT);
  }
  async call(model, messages, options) {
    const body = {
      model,
      messages: this.convertMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      frequency_penalty: options?.frequencyPenalty,
      presence_penalty: options?.presencePenalty
    };
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((tool) => {
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
      body.tool_choice = options.toolChoice || "auto";
    }
    const response = await this.makeRequest(this.endpoint, body, options);
    const data = await response.json();
    return this.parseResponse(data);
  }
  async *stream(model, messages, options) {
    const body = {
      model,
      messages: this.convertMessages(messages),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true
    };
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((tool) => {
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
      body.tool_choice = options.toolChoice || "auto";
    }
    const response = await this.makeRequest(this.endpoint, body, options);
    yield* this.parseStream(response);
  }
  /**
   * Convert messages to Groq format
   * Ensures tool call arguments are strings and tool messages have string content
   */
  convertMessages(messages) {
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
      if (msg.role === "tool" && typeof baseMessage.content !== "string") {
        baseMessage.content = JSON.stringify(baseMessage.content ?? "");
      }
      return baseMessage;
    });
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

// src/llm/OpenRouterProvider.ts
var OpenRouterProvider = class _OpenRouterProvider extends BaseLLMProvider {
  name = "openrouter";
  static DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  constructor(apiKey, endpoint) {
    super(apiKey, endpoint || _OpenRouterProvider.DEFAULT_ENDPOINT);
  }
  async call(model, messages, options) {
    const body = {
      model,
      messages
    };
    if (!this.shouldExcludeTemperature(model)) {
      body.temperature = options?.temperature ?? 0.7;
    }
    body.max_tokens = options?.maxTokens;
    body.top_p = options?.topP;
    body.frequency_penalty = options?.frequencyPenalty;
    body.presence_penalty = options?.presencePenalty;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
      if (options.toolChoice) {
        body.tool_choice = options.toolChoice;
      }
    }
    const response = await this.makeRequest(
      this.endpoint,
      body,
      options,
      this.getOpenRouterHeaders()
    );
    const data = await response.json();
    return this.parseResponse(data);
  }
  async *stream(model, messages, options) {
    const body = {
      model,
      messages,
      stream: true
    };
    if (!this.shouldExcludeTemperature(model)) {
      body.temperature = options?.temperature ?? 0.7;
    }
    body.max_tokens = options?.maxTokens;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }
    const response = await this.makeRequest(
      this.endpoint,
      body,
      options,
      this.getOpenRouterHeaders()
    );
    yield* this.parseStream(response);
  }
  /**
   * Get OpenRouter-specific headers
   */
  getOpenRouterHeaders() {
    return {
      "HTTP-Referer": "https://browseroperator.io",
      "X-Title": "Browser Operator"
    };
  }
  /**
   * Check if model doesn't support temperature parameter
   * Some OpenAI models accessed through OpenRouter don't support temperature
   */
  shouldExcludeTemperature(model) {
    const noTemperatureModels = ["openai/gpt-5", "openai/o3", "openai/o4"];
    return noTemperatureModels.some((pattern) => model.includes(pattern));
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

// src/llm/LiteLLMProvider.ts
var LiteLLMProvider = class _LiteLLMProvider extends BaseLLMProvider {
  name = "litellm";
  static DEFAULT_ENDPOINT = "http://localhost:4000/v1/chat/completions";
  constructor(apiKey, endpoint) {
    super(apiKey, endpoint || _LiteLLMProvider.DEFAULT_ENDPOINT);
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

exports.AnthropicProvider = AnthropicProvider;
exports.BaseLLMProvider = BaseLLMProvider;
exports.GroqProvider = GroqProvider;
exports.LiteLLMProvider = LiteLLMProvider;
exports.OpenAIProvider = OpenAIProvider;
exports.OpenRouterProvider = OpenRouterProvider;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map