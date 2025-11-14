// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';

import logger from './logger.js';
// No need to import BrowserAgentServer - it's passed as constructor parameter

class APIServer {
  constructor(browserAgentServer, port = 8081) {
    this.browserAgentServer = browserAgentServer;
    this.port = port;
    this.server = null;
    this.configDefaults = null;
    this.loadConfigDefaults();
  }

  /**
   * Load default model configuration from config.yaml
   */
  loadConfigDefaults() {
    try {
      const configPath = path.resolve('./evals/config.yaml');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.configDefaults = yaml.load(configContent);
        logger.info('Loaded config.yaml defaults:', this.configDefaults);
      } else {
        logger.warn('config.yaml not found, using hardcoded defaults');
        this.configDefaults = {
          model: {
            main_model: 'gpt-4.1',
            mini_model: 'gpt-4.1-mini',
            nano_model: 'gpt-4.1-nano',
            provider: 'openai'
          }
        };
      }
    } catch (error) {
      logger.error('Failed to load config.yaml:', error);
      this.configDefaults = {
        model: {
          main_model: 'gpt-4.1',
          mini_model: 'gpt-4.1-mini',
          nano_model: 'gpt-4.1-nano',
          provider: 'openai'
        }
      };
    }
  }

  start() {
    this.server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      logger.info(`API server started on http://localhost:${this.port}`);
    });
  }

  async handleRequest(req, res) {
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

      // Handle dynamic client tabs route
      if (pathname.startsWith('/clients/') && pathname.endsWith('/tabs')) {
        // Handle dynamic client tabs route
        const clientId = pathname.split('/')[2];
        result = this.getClientTabsById(clientId);
      } else {
        switch (pathname) {
          case '/status':
            result = this.getStatus();
            break;

          case '/clients':
            result = this.getClients();
            break;

          case '/tabs/open':
            if (method !== 'POST') {
              this.sendError(res, 405, 'Method not allowed');
              return;
            }
            result = await this.openTab(JSON.parse(body));
            break;

          case '/tabs/close':
            if (method !== 'POST') {
              this.sendError(res, 405, 'Method not allowed');
              return;
            }
            result = await this.closeTab(JSON.parse(body));
            break;

          case '/v1/responses':
            if (method !== 'POST') {
              this.sendError(res, 405, 'Method not allowed');
              return;
            }
            result = await this.handleResponsesRequest(JSON.parse(body));
            break;

          case '/page/content':
            if (method !== 'POST') {
              this.sendError(res, 405, 'Method not allowed');
              return;
            }
            result = await this.getPageContent(JSON.parse(body));
            break;

          case '/page/screenshot':
            if (method !== 'POST') {
              this.sendError(res, 405, 'Method not allowed');
              return;
            }
            result = await this.getScreenshot(JSON.parse(body));
            break;

          default:
            this.sendError(res, 404, 'Not found');
            return;
        }
      }

      this.sendResponse(res, 200, result);

    } catch (error) {
      logger.error('API error:', error);
      this.sendError(res, 500, error.message);
    }
  }

  getStatus() {
    const status = this.browserAgentServer.getStatus();
    const clients = this.browserAgentServer.getClientManager().getAllClients();

    return {
      server: status,
      clients: clients.map(client => ({
        id: client.id,
        name: client.name,
        connected: this.browserAgentServer.connectedClients.has(client.id),
        ready: this.browserAgentServer.connectedClients.get(client.id)?.ready || false
      }))
    };
  }

  getClients() {
    const clients = this.browserAgentServer.getClientManager().getAllClients();
    const connectedClients = this.browserAgentServer.connectedClients;

    return clients.map(client => {
      const tabs = this.browserAgentServer.getClientManager().getClientTabs(client.id);

      return {
        id: client.id,
        name: client.name,
        description: client.description,
        tabCount: tabs.length,
        tabs: tabs.map(tab => ({
          tabId: tab.tabId,
          compositeClientId: tab.compositeClientId,
          connected: connectedClients.has(tab.compositeClientId),
          ready: connectedClients.get(tab.compositeClientId)?.ready || false,
          connectedAt: tab.connectedAt,
          remoteAddress: tab.connection?.remoteAddress || 'unknown'
        }))
      };
    });
  }

  getClientTabsById(clientId) {
    if (!clientId) {
      throw new Error('Client ID is required');
    }

    const tabs = this.browserAgentServer.getClientManager().getClientTabs(clientId);
    const connectedClients = this.browserAgentServer.connectedClients;
    const client = this.browserAgentServer.getClientManager().getClient(clientId);

    if (!client) {
      throw new Error(`Client '${clientId}' not found`);
    }

    return {
      baseClientId: clientId,
      clientName: client.name,
      tabCount: tabs.length,
      tabs: tabs.map(tab => ({
        tabId: tab.tabId,
        compositeClientId: tab.compositeClientId,
        connected: connectedClients.has(tab.compositeClientId),
        ready: connectedClients.get(tab.compositeClientId)?.ready || false,
        connectedAt: tab.connectedAt,
        remoteAddress: tab.connection?.remoteAddress || 'unknown'
      }))
    };
  }

  async openTab(payload) {
    const { clientId, url = 'about:blank', background = false } = payload;

    if (!clientId) {
      throw new Error('Client ID is required');
    }

    // Since we use direct CDP, we don't need the client to be connected
    // Just extract the baseClientId (first part before colon if composite, or the whole ID)
    const baseClientId = clientId.split(':')[0];

    const result = await this.browserAgentServer.openTab(baseClientId, { url, background });

    return {
      clientId: baseClientId,
      tabId: result.tabId,
      compositeClientId: result.compositeClientId,
      url: result.url || url,
      status: 'opened'
    };
  }

  async closeTab(payload) {
    const { clientId, tabId } = payload;

    if (!clientId) {
      throw new Error('Client ID is required');
    }

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    // Since we use direct CDP, we don't need the client to be connected
    // Just extract the baseClientId
    const baseClientId = clientId.split(':')[0];

    const result = await this.browserAgentServer.closeTab(baseClientId, { tabId });

    return {
      clientId: baseClientId,
      tabId,
      status: 'closed',
      success: result.success !== false
    };
  }

  async getPageContent(payload) {
    const { clientId, tabId, format = 'html' } = payload;

    if (!clientId) {
      throw new Error('Client ID is required');
    }

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    if (!['html', 'text'].includes(format)) {
      throw new Error('Format must be either "html" or "text"');
    }

    const baseClientId = clientId.split(':')[0];

    logger.info('Getting page content', { baseClientId, tabId, format });

    // Call appropriate method based on format
    const result = format === 'html'
      ? await this.browserAgentServer.getPageHTML(tabId)
      : await this.browserAgentServer.getPageText(tabId);

    return {
      clientId: baseClientId,
      tabId: result.tabId,
      content: result.content,
      format: result.format,
      length: result.length,
      timestamp: Date.now()
    };
  }

  async getScreenshot(payload) {
    const { clientId, tabId, fullPage = false } = payload;

    if (!clientId) {
      throw new Error('Client ID is required');
    }

    if (!tabId) {
      throw new Error('Tab ID is required');
    }

    const baseClientId = clientId.split(':')[0];

    logger.info('Capturing screenshot', { baseClientId, tabId, fullPage });

    const result = await this.browserAgentServer.captureScreenshot(tabId, { fullPage });

    return {
      clientId: baseClientId,
      tabId: result.tabId,
      imageData: result.imageData,
      format: result.format,
      fullPage: result.fullPage,
      timestamp: Date.now()
    };
  }

  /**
   * Handle OpenAI Responses API compatible requests with nested model format
   */
  async handleResponsesRequest(requestBody) {
    try {
      // Validate required input field
      if (!requestBody.input || typeof requestBody.input !== 'string') {
        throw new Error('Missing or invalid "input" field. Expected a string.');
      }

      // Handle nested model configuration directly
      const nestedModelConfig = this.processNestedModelConfig(requestBody);

      // Extract optional URL and wait timeout
      const targetUrl = requestBody.url || 'about:blank';
      const waitTimeout = requestBody.wait_timeout || 5000;

      const redact = (mk) => ({
        ...mk,
        api_key: mk?.api_key ? `${String(mk.api_key).slice(0, 4)}...` : undefined
      });
      logger.info('Processing responses request:', {
        input: requestBody.input,
        url: targetUrl,
        wait_timeout: targetUrl !== 'about:blank' ? waitTimeout : 0,
        modelConfig: {
          main_model: redact(nestedModelConfig.main_model),
          mini_model: redact(nestedModelConfig.mini_model),
          nano_model: redact(nestedModelConfig.nano_model),
        }
      });

      // Find a client with existing tabs (not the dummy client)
      const baseClientId = this.findClientWithTabs();

      // Open a new tab for this request at the specified URL
      logger.info('Opening new tab for responses request', { baseClientId, url: targetUrl });
      const tabResult = await this.browserAgentServer.openTab(baseClientId, {
        url: targetUrl,
        background: false
      });

      logger.info('Tab opened successfully', {
        tabId: tabResult.tabId,
        compositeClientId: tabResult.compositeClientId
      });

      // Wait for the new tab's DevTools to connect
      const tabClient = await this.waitForClientConnection(tabResult.compositeClientId);

      // Wait for page to load if a custom URL was provided
      if (targetUrl !== 'about:blank') {
        logger.info('Waiting for page to load', { waitTimeout });
        await new Promise(resolve => setTimeout(resolve, waitTimeout));
      }

      // Create a dynamic request for this request
      const request = this.createDynamicRequestNested(requestBody.input, nestedModelConfig);

      // Execute the request on the new tab's DevTools client
      logger.info('Executing request on new tab', {
        compositeClientId: tabResult.compositeClientId,
        requestId: request.id
      });

      const result = await this.browserAgentServer.executeRequest(tabClient, request);

      // Debug: log the result structure
      logger.debug('executeRequest result:', result);

      // Extract the response text from the result
      const responseText = this.extractResponseText(result);

      // Format in OpenAI-compatible Responses API format with tab metadata
      return this.formatResponse(responseText, tabResult.compositeClientId.split(':')[0], tabResult.tabId);

    } catch (error) {
      logger.error('Error handling responses request:', error);
      throw error;
    }
  }

  /**
   * Process nested model configuration from request body
   * @param {Object} requestBody - Request body containing optional model configuration
   * @returns {import('./types/model-config').ModelConfig} Nested model configuration
   */
  processNestedModelConfig(requestBody) {
    const defaults = this.configDefaults?.model || {};

    // If nested format is provided, use it directly with fallbacks
    if (requestBody.model) {
      return {
        main_model: requestBody.model.main_model || this.createDefaultModelConfig('main', defaults),
        mini_model: requestBody.model.mini_model || this.createDefaultModelConfig('mini', defaults),
        nano_model: requestBody.model.nano_model || this.createDefaultModelConfig('nano', defaults)
      };
    }

    // No model config provided, use defaults
    return {
      main_model: this.createDefaultModelConfig('main', defaults),
      mini_model: this.createDefaultModelConfig('mini', defaults),
      nano_model: this.createDefaultModelConfig('nano', defaults)
    };
  }

  /**
   * Create default model configuration for a tier
   * @param {'main' | 'mini' | 'nano'} tier - Model tier
   * @param {Object} defaults - Default configuration from config.yaml
   * @returns {import('./types/model-config').ModelTierConfig} Model tier configuration
   */
  createDefaultModelConfig(tier, defaults) {
    const defaultModels = {
      main: defaults.main_model || 'gpt-4',
      mini: defaults.mini_model || 'gpt-4-mini',
      nano: defaults.nano_model || 'gpt-3.5-turbo'
    };

    return {
      provider: defaults.provider || 'openai',
      model: defaultModels[tier],
      api_key: process.env.OPENAI_API_KEY
    };
  }


  /**
   * Find a connected and ready client
   */
  findReadyClient() {
    for (const [clientId, connection] of this.browserAgentServer.connectedClients) {
      if (connection.ready) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Find a client that has existing tabs (not the dummy client)
   * @returns {string} Base client ID
   */
  findClientWithTabs() {
    const clients = this.browserAgentServer.getClientManager().getAllClients();

    // First, try to find a client with existing tabs
    for (const client of clients) {
      const tabs = this.browserAgentServer.getClientManager().getClientTabs(client.id);
      if (tabs.length > 0) {
        logger.info('Found client with tabs', { clientId: client.id, tabCount: tabs.length });
        return client.id;
      }
    }

    // If no client with tabs, use the first available client (even with 0 tabs)
    if (clients.length > 0) {
      logger.info('No clients with tabs found, using first available client', { clientId: clients[0].id });
      return clients[0].id;
    }

    throw new Error('No clients found. Please ensure at least one DevTools client is registered.');
  }

  /**
   * Wait for a client connection to be established and ready
   * @param {string} compositeClientId - Composite client ID (baseClientId:tabId)
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds
   * @returns {Promise<Object>} Connection object
   */
  async waitForClientConnection(compositeClientId, maxWaitMs = 10000) {
    const startTime = Date.now();
    const pollInterval = 500; // Check every 500ms

    logger.info('Waiting for client connection', { compositeClientId, maxWaitMs });

    while (Date.now() - startTime < maxWaitMs) {
      const connection = this.browserAgentServer.connectedClients.get(compositeClientId);

      if (connection && connection.ready) {
        logger.info('Client connection established and ready', {
          compositeClientId,
          waitedMs: Date.now() - startTime
        });
        return connection;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for client connection: ${compositeClientId}. Tab may not have connected to eval-server.`);
  }

  /**
   * Create a dynamic evaluation object with nested model configuration
   * @param {string} input - Input message for the evaluation
   * @param {import('./types/model-config').ModelConfig} nestedModelConfig - Model configuration
   * @returns {import('./types/model-config').EvaluationRequest} Evaluation request object
   */
  createDynamicRequestNested(input, nestedModelConfig) {
    const requestId = `api-req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: requestId,
      name: 'API Request',
      description: 'Dynamic request created from API request',
      enabled: true,
      tool: 'chat',
      timeout: 7200000, // 2 hours (increased for slow custom API)
      input: {
        message: input
      },
      model: nestedModelConfig,
      validation: {
        type: 'none' // No validation needed for API responses
      },
      metadata: {
        tags: ['api', 'dynamic'],
        priority: 'high',
        source: 'api'
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

    // Handle different result formats
    if (typeof result === 'string') {
      return result;
    }

    // Check for nested evaluation result structure
    if (result.output && result.output.response) {
      return result.output.response;
    }

    if (result.output && result.output.text) {
      return result.output.text;
    }

    if (result.output && result.output.answer) {
      return result.output.answer;
    }

    // Check top-level properties
    if (result.response) {
      return result.response;
    }

    if (result.text) {
      return result.text;
    }

    if (result.answer) {
      return result.answer;
    }

    // If result is an object, try to extract meaningful content
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }

    return 'Unable to extract response text from evaluation result';
  }

  /**
   * Format response in OpenAI-compatible Responses API format
   */
  formatResponse(responseText, clientId = null, tabId = null) {
    const messageId = `msg_${uuidv4().replace(/-/g, '')}`;

    // Debug: log the parameters
    logger.debug('formatResponse called with:', { clientId, tabId, hasClientId: !!clientId, hasTabId: !!tabId });

    const response = [
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

    // Add metadata if clientId and tabId are provided
    if (clientId && tabId) {
      response[0].metadata = {
        clientId,
        tabId
      };
      logger.debug('Metadata added to response:', response[0].metadata);
    } else {
      logger.debug('Metadata NOT added - clientId or tabId missing');
    }

    return response;
  }

  sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  sendError(res, statusCode, message) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  stop() {
    if (this.server) {
      this.server.close();
      logger.info('API server stopped');
    }
  }
}

export { APIServer };
