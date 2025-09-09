// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';

/**
 * OpenAI-compatible HTTP API wrapper that multiplexes requests to connected DevTools tabs.
 * 
 * This wrapper extends the existing HTTPWrapper functionality to provide OpenAI-compatible
 * endpoints (/v1/models and /v1/chat/completions) while routing requests through the 
 * existing WebSocket evaluation server infrastructure.
 * 
 * Example usage:
 * ```js
 * import { EvalServer } from './EvalServer.js';
 * import { OpenAICompatibleWrapper } from './OpenAICompatibleWrapper.js';
 * 
 * const evalServer = new EvalServer({ port: 8080 });
 * const openaiWrapper = new OpenAICompatibleWrapper(evalServer, { port: 8081 });
 * 
 * await evalServer.start();
 * await openaiWrapper.start();
 * ```
 */
export class OpenAICompatibleWrapper {
  constructor(evalServer, options = {}) {
    this.evalServer = evalServer;
    this.config = {
      port: options.port || 8081,
      host: options.host || 'localhost',
      modelCacheTTL: options.modelCacheTTL || 300000, // 5 minutes in ms
      ...options
    };
    
    this.server = null;
    this.isRunning = false;
    
    // Model list cache
    this.modelCache = null;
    this.modelCacheTime = null;
  }

  /**
   * Start the OpenAI-compatible HTTP server
   */
  async start() {
    if (this.isRunning) {
      throw new Error('OpenAI-compatible wrapper is already running');
    }

    if (!this.evalServer.isRunning) {
      throw new Error('EvalServer must be started before starting OpenAI-compatible wrapper');
    }

    const http = await import('http');
    
    this.server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      this.handleRequest(req, res);
    });

    this.server.listen(this.config.port, this.config.host, () => {
      logger.info(`OpenAI-compatible API started on http://${this.config.host}:${this.config.port}`);
    });

    this.isRunning = true;
    return this;
  }

  /**
   * Stop the OpenAI-compatible HTTP server
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('OpenAI-compatible API server stopped');
        this.isRunning = false;
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(req, res) {
    const url = await import('url');
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      // Get body for POST requests
      let body = '';
      if (method === 'POST') {
        for await (const chunk of req) {
          body += chunk;
        }
      }

      let result;

      switch (pathname) {
        case '/v1/models':
          if (method !== 'GET') {
            this.sendError(res, 405, 'Method not allowed');
            return;
          }
          result = await this.handleModelsRequest();
          break;

        case '/v1/chat/completions':
          if (method !== 'POST') {
            this.sendError(res, 405, 'Method not allowed');
            return;
          }
          result = await this.handleChatCompletionsRequest(JSON.parse(body));
          break;

        case '/v1/responses':
          if (method !== 'POST') {
            this.sendError(res, 405, 'Method not allowed');
            return;
          }
          result = await this.handleResponsesRequest(JSON.parse(body));
          break;

        case '/health':
          result = this.getHealthStatus();
          break;

        default:
          this.sendError(res, 404, 'Not found');
          return;
      }

      this.sendResponse(res, 200, result);

    } catch (error) {
      logger.error('OpenAI API error:', error);
      
      // Handle specific error types
      if (error.message.includes('No connected')) {
        this.sendError(res, 503, error.message);
      } else if (error.name === 'SyntaxError') {
        this.sendError(res, 400, 'Invalid JSON in request body');
      } else {
        this.sendError(res, 500, `Internal server error: ${error.message}`);
      }
    }
  }

  /**
   * Handle GET /v1/models request
   */
  async handleModelsRequest() {
    try {
      const models = await this.getModelsFromTabs();
      
      return {
        object: 'list',
        data: models
      };
    } catch (error) {
      logger.error('Error handling models request:', error);
      throw new Error('Unable to fetch models from connected tabs');
    }
  }

  /**
   * Handle POST /v1/chat/completions request
   */
  async handleChatCompletionsRequest(requestBody) {
    try {
      // Validate required fields
      if (!requestBody.model) {
        throw new Error('Missing required field: model');
      }
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        throw new Error('Missing or invalid required field: messages');
      }

      // Find a connected and ready client
      const readyClient = this.findReadyClient();
      if (!readyClient) {
        throw new Error('No connected DevTools tabs available');
      }

      // Convert OpenAI request to evaluation format
      const evaluation = this.convertOpenAIToEvaluation(requestBody);

      // Execute via existing WebSocket multiplexing
      logger.info(`Sending evaluation to client ${readyClient.clientId}`, {
        evaluationId: evaluation.id,
        model: requestBody.model
      });

      const result = await this.evalServer.executeEvaluation(readyClient, evaluation);

      // Convert result back to OpenAI format
      return this.convertResultToOpenAI(result, requestBody);

    } catch (error) {
      logger.error('Error handling chat completions request:', error);
      throw error;
    }
  }

  /**
   * Handle POST /v1/responses request (OpenAI Responses API)
   */
  async handleResponsesRequest(requestBody) {
    try {
      // Validate required input field
      if (!requestBody.input || typeof requestBody.input !== 'string') {
        throw new Error('Missing or invalid "input" field. Expected a string.');
      }

      // Find a connected and ready client
      const readyClient = this.findReadyClient();
      if (!readyClient) {
        throw new Error('No connected DevTools tabs available');
      }

      // Convert Responses API request to evaluation format
      const evaluation = this.convertResponsesToEvaluation(requestBody);

      // Execute via existing WebSocket multiplexing
      logger.info(`Sending responses evaluation to client ${readyClient.clientId}`, {
        evaluationId: evaluation.id,
        input: requestBody.input
      });

      const result = await this.evalServer.executeEvaluation(readyClient, evaluation);

      // Convert result back to Responses API format
      return this.convertResultToResponses(result);

    } catch (error) {
      logger.error('Error handling responses request:', error);
      throw error;
    }
  }

  /**
   * Get available models from connected DevTools tabs
   */
  async getModelsFromTabs() {
    // Check cache first
    const currentTime = Date.now();
    if (this.modelCache && this.modelCacheTime && 
        (currentTime - this.modelCacheTime < this.config.modelCacheTTL)) {
      logger.debug('Returning cached model list');
      return this.modelCache;
    }

    // Find a ready client
    const readyClient = this.findReadyClient();
    if (!readyClient) {
      logger.warn('No connected tabs available for model listing');
      return this.getDefaultModels();
    }

    try {
      // Create evaluation request for model listing  
      const evalId = `models-${uuidv4().substring(0, 8)}`;
      const modelRequest = {
        id: evalId,
        evaluationId: evalId,
        name: 'get_models',  // Name field is required for evaluation protocol
        tool: 'get_models',
        url: null,
        input: {},
        timeout: 10000, // 10 seconds
      };

      logger.info(`Requesting models from client ${readyClient.clientId}`);
      const result = await this.evalServer.executeEvaluation(readyClient, modelRequest);

      // Parse the result and convert to OpenAI format
      const models = this.parseModelsResult(result);

      // Cache the results
      this.modelCache = models;
      this.modelCacheTime = currentTime;

      logger.info(`Retrieved ${models.length} models from connected tab`);
      return models;

    } catch (error) {
      logger.error('Error fetching models from tab:', error);
      return this.getDefaultModels();
    }
  }

  /**
   * Parse model result from DevTools tab into OpenAI format
   */
  parseModelsResult(result) {
    const models = [];
    const currentTime = Math.floor(Date.now() / 1000);
    let currentSelection = null;

    try {
      // Extract models and current selection from various possible result formats
      let modelData = null;

      if (typeof result === 'object' && result !== null) {
        // Check direct response format
        if (result.models) {
          modelData = result.models;
          currentSelection = result.currentSelection;
        } 
        // Check nested output format
        else if (result.output && result.output.models) {
          modelData = result.output.models;
          currentSelection = result.output.currentSelection;
        } 
        // Check response string format
        else if (result.response) {
          let response = result.response;
          if (typeof response === 'string') {
            try {
              const parsed = JSON.parse(response);
              if (parsed.models) {
                modelData = parsed.models;
                currentSelection = parsed.currentSelection;
              }
            } catch (jsonError) {
              // Not JSON, continue
            }
          }
        }
      }

      logger.info(`Current model selection from Browser Operator: ${currentSelection}`);

      if (Array.isArray(modelData)) {
        let selectedCount = 0;
        for (const model of modelData) {
          if (typeof model === 'object' && model.id) {
            const isSelected = model.selected || false;
            if (isSelected) {
              selectedCount++;
            }

            models.push({
              id: model.id,
              object: 'model',
              created: currentTime,
              owned_by: model.provider || 'browser-operator'
            });
          } else if (typeof model === 'string') {
            // Simple model name
            models.push({
              id: model,
              object: 'model',
              created: currentTime,
              owned_by: 'browser-operator'
            });
          }
        }
        
        logger.info(`Found ${models.length} models with ${selectedCount} selected`);
      }

      // Fallback to default models if nothing found
      if (models.length === 0) {
        logger.warn('No models found in result, providing defaults');
        return this.getDefaultModels();
      }

    } catch (error) {
      logger.error('Error parsing models result:', error);
      logger.debug('Raw result:', result);
      return this.getDefaultModels();
    }

    return models;
  }

  /**
   * Get default model list as fallback
   */
  getDefaultModels() {
    const currentTime = Math.floor(Date.now() / 1000);
    
    return [
      {
        id: 'gpt-4.1',
        object: 'model',
        created: currentTime,
        owned_by: 'browser-operator'
      },
      {
        id: 'gpt-4.1-mini',
        object: 'model',
        created: currentTime,
        owned_by: 'browser-operator'
      },
      {
        id: 'gpt-4.1-nano',
        object: 'model',
        created: currentTime,
        owned_by: 'browser-operator'
      }
    ];
  }

  /**
   * Convert OpenAI chat completion request to evaluation format
   */
  convertOpenAIToEvaluation(requestBody) {
    // Convert OpenAI messages array to single message string
    // The Browser Operator expects input.message (string), not input.messages (array)
    const messageParts = [];
    for (const msg of requestBody.messages) {
      if (msg.role === 'system') {
        messageParts.push(`System: ${msg.content}`);
      } else if (msg.role === 'user') {
        messageParts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        messageParts.push(`Assistant: ${msg.content}`);
      } else {
        messageParts.push(`${msg.role}: ${msg.content}`);
      }
    }
    
    // Join all messages into a single conversation string
    let conversationMessage = messageParts.join('\n\n');
    
    // If there's only a user message, use it directly
    if (requestBody.messages.length === 1 && requestBody.messages[0].role === 'user') {
      conversationMessage = requestBody.messages[0].content;
    }

    // Create evaluation object compatible with existing evaluation system
    const evaluation = {
      id: `openai-chat-${uuidv4().substring(0, 8)}`,
      name: 'OpenAI Chat Completion',
      description: `Chat completion using model ${requestBody.model}`,
      enabled: true,
      tool: 'chat',
      timeout: 300000, // 5 minutes
      input: {
        message: conversationMessage,  // Single message string as expected by executeChatEvaluation
        model: requestBody.model,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        top_p: requestBody.top_p,
        frequency_penalty: requestBody.frequency_penalty,
        presence_penalty: requestBody.presence_penalty,
      },
      model: {
        main_model: requestBody.model,
        provider: 'openai'
      },
      validation: {
        type: 'none' // No validation needed for API responses
      },
      metadata: {
        tags: ['openai-api', 'chat-completion'],
        source: 'openai-compatible-api',
        originalModel: requestBody.model
      }
    };

    return evaluation;
  }

  /**
   * Convert OpenAI Responses API request to evaluation format
   */
  convertResponsesToEvaluation(requestBody) {
    const evaluation = {
      id: `openai-responses-${uuidv4().substring(0, 8)}`,
      name: 'OpenAI Responses API Request',
      description: 'Dynamic evaluation from OpenAI Responses API',
      enabled: true,
      tool: 'chat',
      timeout: 300000, // 5 minutes
      input: {
        message: requestBody.input,  // Direct message from input
        reasoning: 'OpenAI Responses API processing'
      },
      model: {
        main_model: requestBody.main_model || 'gpt-4.1',
        mini_model: requestBody.mini_model || 'gpt-4.1-mini', 
        nano_model: requestBody.nano_model || 'gpt-4.1-nano',
        provider: requestBody.provider || 'openai'
      },
      validation: {
        type: 'none'
      },
      metadata: {
        tags: ['openai-api', 'responses'],
        source: 'openai-responses-api',
        priority: 'high'
      }
    };

    return evaluation;
  }

  /**
   * Convert evaluation result to OpenAI Responses API format
   */
  convertResultToResponses(result) {
    // Extract response text from evaluation result
    const responseText = this.extractResponseText(result);

    // Create message ID in OpenAI format
    const messageId = `msg_${uuidv4().replace(/-/g, '').substring(0, 32)}`;

    // Format in OpenAI Responses API format
    return [
      {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: responseText,
            annotations: []
          }
        ]
      }
    ];
  }

  /**
   * Convert evaluation result back to OpenAI chat completion format
   */
  convertResultToOpenAI(result, originalRequest) {
    // Extract response text from evaluation result
    const responseText = this.extractResponseText(result);

    // Create OpenAI-compatible response
    const completionId = `chatcmpl-${uuidv4().replace(/-/g, '').substring(0, 29)}`;
    const currentTime = Math.floor(Date.now() / 1000);

    // Calculate rough token counts
    const promptTokens = originalRequest.messages.reduce(
      (acc, msg) => acc + (msg.content ? msg.content.split(' ').length : 0), 0
    );
    const completionTokens = responseText.split(' ').length;

    return {
      id: completionId,
      object: 'chat.completion',
      created: currentTime,
      model: originalRequest.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }

  /**
   * Extract response text from evaluation result
   */
  extractResponseText(result) {
    if (!result) {
      return 'No response received from evaluation';
    }

    // Handle string results
    if (typeof result === 'string') {
      return result;
    }

    // Handle object results - try various common response fields
    if (typeof result === 'object' && result !== null) {
      // Direct fields
      const responseFields = ['response', 'text', 'answer', 'content'];
      for (const field of responseFields) {
        if (result[field] && typeof result[field] === 'string' && result[field].trim()) {
          return result[field];
        }
      }

      // Nested fields
      if (result.output) {
        for (const field of responseFields) {
          if (result.output[field] && typeof result.output[field] === 'string' && result.output[field].trim()) {
            return result.output[field];
          }
        }
      }

      // If result is an object, return JSON representation
      return JSON.stringify(result, null, 2);
    }

    return 'Unable to extract response text from evaluation result';
  }

  /**
   * Find a connected and ready client (reusing logic from existing HTTPWrapper)
   */
  findReadyClient() {
    for (const [clientId, connection] of this.evalServer.connectedClients) {
      if (connection.ready && connection.registered) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Get health status of the OpenAI-compatible API
   */
  getHealthStatus() {
    const connectedClients = Array.from(this.evalServer.connectedClients.values());
    const readyClients = connectedClients.filter(client => client.ready).length;

    return {
      status: 'healthy',
      openai_api_running: this.isRunning,
      eval_server_running: this.evalServer.isRunning,
      connected_clients: connectedClients.length,
      ready_clients: readyClients,
      model_cache_status: {
        cached: !!this.modelCache,
        cache_time: this.modelCacheTime,
        cache_age_ms: this.modelCacheTime ? Date.now() - this.modelCacheTime : null
      },
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /v1/models',
        'POST /v1/chat/completions', 
        'POST /v1/responses',
        'GET /health'
      ]
    };
  }

  /**
   * Send JSON response
   */
  sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: {
        message: message,
        type: 'api_error',
        code: statusCode
      }
    }));
  }

  /**
   * Get running status and configuration
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      host: this.config.host,
      port: this.config.port,
      url: `http://${this.config.host}:${this.config.port}`,
      modelCacheTTL: this.config.modelCacheTTL,
      evalServerRunning: this.evalServer.isRunning
    };
  }
}