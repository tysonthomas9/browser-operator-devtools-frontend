// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as i18n from '../../../../core/i18n/i18n.js';

/**
 * UI Strings for Settings Dialog
 */
export const UIStrings = {
  /**
   *@description Settings dialog title
   */
  settings: 'Settings',
  /**
   *@description Provider selection label
   */
  providerLabel: 'Provider',
  /**
   *@description Provider selection hint
   */
  providerHint: 'Select which AI provider to use',
  /**
   *@description OpenAI provider option
   */
  openaiProvider: 'OpenAI',
  /**
   *@description LiteLLM provider option
   */
  litellmProvider: 'LiteLLM',
  /**
   *@description Groq provider option
   */
  groqProvider: 'Groq',
  /**
   *@description OpenRouter provider option
   */
  openrouterProvider: 'OpenRouter',
  /**
   *@description BrowserOperator provider option
   */
  browseroperatorProvider: 'BrowserOperator',
  /**
   *@description Cerebras provider option
   */
  cerebrasProvider: 'Cerebras',
  /**
   *@description Anthropic provider option
   */
  anthropicProvider: 'Anthropic',
  /**
   *@description Google AI provider option
   */
  googleaiProvider: 'Google AI',
  /**
   *@description LiteLLM API Key label
   */
  liteLLMApiKey: 'LiteLLM API Key',
  /**
   *@description LiteLLM API Key hint
   */
  liteLLMApiKeyHint: 'Your LiteLLM API key for authentication (optional)',
  /**
   *@description LiteLLM endpoint label
   */
  litellmEndpointLabel: 'LiteLLM Endpoint',
  /**
   *@description LiteLLM endpoint hint
   */
  litellmEndpointHint: 'Enter the URL for your LiteLLM server (e.g., http://localhost:4000 or https://your-litellm-server.com)',
  /**
   *@description Groq API Key label
   */
  groqApiKeyLabel: 'Groq API Key',
  /**
   *@description Groq API Key hint
   */
  groqApiKeyHint: 'Your Groq API key for authentication',
  /**
   *@description Fetch Groq models button text
   */
  fetchGroqModelsButton: 'Fetch Groq Models',
  /**
   *@description OpenRouter API Key label
   */
  openrouterApiKeyLabel: 'OpenRouter API Key',
  /**
   *@description OpenRouter API Key hint
   */
  openrouterApiKeyHint: 'Your OpenRouter API key for authentication',
  /**
   *@description Fetch OpenRouter models button text
   */
  fetchOpenRouterModelsButton: 'Fetch OpenRouter Models',
  /**
   *@description OpenAI API Key label
   */
  apiKeyLabel: 'OpenAI API Key',
  /**
   *@description OpenAI API Key hint
   */
  apiKeyHint: 'An OpenAI API key is required for OpenAI models (GPT-4.1, O4 Mini, etc.)',
  /**
   *@description BrowserOperator API Key label
   */
  browseroperatorApiKeyLabel: 'BrowserOperator API Key (Optional)',
  /**
   *@description BrowserOperator API Key hint
   */
  browseroperatorApiKeyHint: 'Optional API key for BrowserOperator managed service. Authentication is not required.',
  /**
   *@description Test button text
   */
  testButton: 'Test',
  /**
   *@description Add button text
   */
  addButton: 'Add',
  /**
   *@description Remove button text
   */
  removeButton: 'Remove',
  /**
   *@description Fetch models button text
   */
  fetchModelsButton: 'Fetch LiteLLM Models',
  /**
   *@description Fetching models status
   */
  fetchingModels: 'Fetching models...',
  /**
   *@description Wildcard models only message
   */
  wildcardModelsOnly: 'LiteLLM proxy returned wildcard model only. Please add custom models below.',
  /**
   *@description Wildcard and custom models message
   */
  wildcardAndCustomModels: 'Fetched wildcard model (custom models available)',
  /**
   *@description Wildcard and other models message with count
   */
  wildcardAndOtherModels: 'Fetched {PH1} models plus wildcard',
  /**
   *@description Fetched models message with count
   */
  fetchedModels: 'Fetched {PH1} models',
  /**
   *@description LiteLLM endpoint required error
   */
  endpointRequired: 'LiteLLM endpoint is required to test model',
  /**
   *@description Custom models label
   */
  customModelsLabel: 'Custom Models',
  /**
   *@description Custom models hint
   */
  customModelsHint: 'Add custom models one at a time.',
  /**
   *@description Mini model label
   */
  miniModelLabel: 'Mini Model',
  /**
   *@description Mini model description
   */
  miniModelDescription: 'Used for fast operations, tools, and sub-tasks',
  /**
   *@description Nano model label
   */
  nanoModelLabel: 'Nano Model',
  /**
   *@description Nano model description
   */
  nanoModelDescription: 'Used for very fast operations and simple tasks',
  /**
   *@description Default mini model option
   */
  defaultMiniOption: 'Use default (main model)',
  /**
   *@description Default nano model option
   */
  defaultNanoOption: 'Use default (mini model or main model)',
  /**
   *@description Browsing history section title
   */
  browsingHistoryTitle: 'Browsing History',
  /**
   *@description Browsing history description
   */
  browsingHistoryDescription: 'Your browsing history is stored locally to enable search by domains and keywords.',
  /**
   *@description Clear browsing history button
   */
  clearHistoryButton: 'Clear Browsing History',
  /**
   *@description History cleared message
   */
  historyCleared: 'Browsing history cleared successfully',
  /**
   *@description Important notice title
   */
  importantNotice: 'Important Notice',
  /**
   *@description Vector DB section label
   */
  vectorDBLabel: 'Vector Database Configuration',
  /**
   *@description Vector DB enabled label
   */
  vectorDBEnabled: 'Enable Vector Database',
  /**
   *@description Vector DB enabled hint
   */
  vectorDBEnabledHint: 'Enable Vector Database for semantic search of websites',
  /**
   *@description Milvus endpoint label
   */
  vectorDBEndpoint: 'Milvus Endpoint',
  /**
   *@description Milvus endpoint hint
   */
  vectorDBEndpointHint: 'Enter the URL for your Milvus server (e.g., http://localhost:19530 or https://your-milvus.com)',
  /**
   *@description Milvus username label
   */
  vectorDBApiKey: 'Milvus Username',
  /**
   *@description Milvus username hint
   */
  vectorDBApiKeyHint: 'For self-hosted: username (default: root). For Milvus Cloud: leave as root',
  /**
   *@description Vector DB collection label
   */
  vectorDBCollection: 'Collection Name',
  /**
   *@description Vector DB collection hint
   */
  vectorDBCollectionHint: 'Name of the collection to store websites (default: bookmarks)',
  /**
   *@description Milvus password/token label
   */
  milvusPassword: 'Password/API Token',
  /**
   *@description Milvus password/token hint
   */
  milvusPasswordHint: 'For self-hosted: password (default: Milvus). For Milvus Cloud: API token directly',
  /**
   *@description OpenAI API key for embeddings label
   */
  milvusOpenAIKey: 'OpenAI API Key (for embeddings)',
  /**
   *@description OpenAI API key for embeddings hint
   */
  milvusOpenAIKeyHint: 'Required for generating embeddings using OpenAI text-embedding-3-small model',
  /**
   *@description Test vector DB connection button
   */
  testVectorDBConnection: 'Test Connection',
  /**
   *@description Vector DB connection testing status
   */
  testingVectorDBConnection: 'Testing connection...',
  /**
   *@description Vector DB connection success message
   */
  vectorDBConnectionSuccess: 'Vector DB connection successful!',
  /**
   *@description Vector DB connection failed message
   */
  vectorDBConnectionFailed: 'Vector DB connection failed',
  /**
   *@description Tracing section title
   */
  tracingSection: 'Tracing Configuration',
  /**
   *@description Tracing enabled label
   */
  tracingEnabled: 'Enable Tracing',
  /**
   *@description Tracing enabled hint
   */
  tracingEnabledHint: 'Enable observability tracing for AI Chat interactions',
  /**
   *@description Langfuse endpoint label
   */
  langfuseEndpoint: 'Langfuse Endpoint',
  /**
   *@description Langfuse endpoint hint
   */
  langfuseEndpointHint: 'URL of your Langfuse server (e.g., http://localhost:3000)',
  /**
   *@description Langfuse public key label
   */
  langfusePublicKey: 'Langfuse Public Key',
  /**
   *@description Langfuse public key hint
   */
  langfusePublicKeyHint: 'Your Langfuse project public key (starts with pk-lf-)',
  /**
   *@description Langfuse secret key label
   */
  langfuseSecretKey: 'Langfuse Secret Key',
  /**
   *@description Langfuse secret key hint
   */
  langfuseSecretKeyHint: 'Your Langfuse project secret key (starts with sk-lf-)',
  /**
   *@description Test tracing button
   */
  testTracing: 'Test Connection',
  /**
   *@description Evaluation section title
   */
  evaluationSection: 'Evaluation Configuration',
  /**
   *@description Evaluation enabled label
   */
  evaluationEnabled: 'Enable Evaluation',
  /**
   *@description Evaluation enabled hint
   */
  evaluationEnabledHint: 'Enable evaluation service connection for AI Chat interactions',
  /**
   *@description Evaluation endpoint label
   */
  evaluationEndpoint: 'Evaluation Endpoint',
  /**
   *@description Evaluation endpoint hint
   */
  evaluationEndpointHint: 'WebSocket endpoint for the evaluation service (e.g., ws://localhost:8080)',
  /**
   *@description Evaluation secret key label
   */
  evaluationSecretKey: 'Evaluation Secret Key',
  /**
   *@description Evaluation secret key hint
   */
  evaluationSecretKeyHint: 'Secret key for authentication with the evaluation service (optional)',
  /**
   *@description Evaluation connection status
   */
  evaluationConnectionStatus: 'Connection Status',
  /**
   *@description MCP section title
   */
  mcpSection: 'MCP Integration',
  /**
   *@description MCP enabled label
   */
  mcpEnabled: 'Enable MCP Integration',
  /**
   *@description MCP enabled hint
   */
  mcpEnabledHint: 'Enable MCP client to discover and call tools via Model Context Protocol',
  /**
   *@description MCP connections header label
   */
  mcpConnectionsHeader: 'Connections',
  /**
   *@description MCP connections hint text
   */
  mcpConnectionsHint: 'Configure one or more MCP servers. OAuth flows use PKCE automatically.',
  /**
   *@description MCP manage connections button text
   */
  mcpManageConnections: 'Manage connections',
  /**
   *@description MCP refresh connections button text
   */
  mcpRefreshConnections: 'Reconnect all',
  /**
   *@description MCP individual reconnect button text
   */
  mcpReconnectButton: 'Reconnect',
  /**
   *@description MCP individual reconnect button text while in progress
   */
  mcpReconnectInProgress: 'Reconnecting…',
  /**
   *@description MCP individual reconnect button failure state text
   */
  mcpReconnectRetry: 'Retry reconnect',
  /**
   *@description MCP discovered tools label
   */
  mcpDiscoveredTools: 'Discovered Tools',
  /**
   *@description MCP discovered tools hint
   */
  mcpDiscoveredToolsHint: 'Select which MCP tools to make available to agents',
  /**
   *@description MCP no tools message
   */
  mcpNoTools: 'No tools discovered. Connect to an MCP server first.',

  /**
   *@description MCP tool mode label
   */
  mcpToolMode: 'Tool Selection Mode',
  /**
   *@description MCP tool mode hint
   */
  mcpToolModeHint: 'Choose how MCP tools are selected and surfaced to agents',
  /**
   *@description MCP tool mode all option
   */
  mcpToolModeAll: 'All Tools - Surface all available MCP tools (may impact performance)',
  /**
   *@description MCP tool mode router option
   */
  mcpToolModeRouter: 'Smart Router - Use LLM to select most relevant tools each turn (recommended)',
  /**
   *@description MCP tool mode meta option
   */
  mcpToolModeMeta: 'Meta Tools - Use mcp.search/mcp.invoke for dynamic discovery (best for large catalogs)',
  /**
   *@description MCP max tools per turn label
   */
  mcpMaxToolsPerTurn: 'Max Tools Per Turn',
  /**
   *@description MCP max tools per turn hint
   */
  mcpMaxToolsPerTurnHint: 'Maximum number of tools to surface to agents in a single turn (default: 20)',
  /**
   *@description MCP max MCP tools per turn label
   */
  mcpMaxMcpPerTurn: 'Max MCP Tools Per Turn',
  /**
   *@description MCP max MCP tools per turn hint
   */
  mcpMaxMcpPerTurnHint: 'Maximum number of MCP tools to include in tool selection (default: 8)',
  /**
   *@description MCP auth type label
   */
  mcpAuthType: 'Authentication Method',
  /**
   *@description MCP auth type hint
   */
  mcpAuthTypeHint: 'Choose how to authenticate with your MCP server',
  /**
   *@description MCP bearer option
   */
  mcpAuthBearer: 'Bearer token',
  /**
   *@description MCP OAuth option
   */
  mcpAuthOAuth: 'OAuth (redirect to provider)',
  /**
   *@description MCP OAuth client ID label
   */
  mcpOAuthClientId: 'OAuth Client ID',
  /**
   *@description MCP OAuth client ID hint
   */
  mcpOAuthClientIdHint: 'Pre-registered public client ID for this MCP server (no secret).',
  /**
   *@description MCP OAuth redirect URL label
   */
  mcpOAuthRedirect: 'OAuth Redirect URL',
  /**
   *@description MCP OAuth redirect URL hint
   */
  mcpOAuthRedirectHint: 'Must match the redirect URI registered with the provider (default: https://localhost:3000/callback).',
  /**
   *@description MCP OAuth scope label
   */
  mcpOAuthScope: 'OAuth Scope (optional)',
  /**
   *@description MCP OAuth scope hint
   */
  mcpOAuthScopeHint: 'Provider-specific scopes, space-separated. Leave empty if unsure.',
  /**
   *@description Settings disclaimer text
   */
  disclaimer: 'Settings are stored in your browser\'s local storage. Your API keys are never sent to any third party except the AI provider you configure.',
  /**
   *@description Cancel button text
   */
  cancelButton: 'Cancel',
  /**
   *@description Save button text
   */
  saveButton: 'Save',
  /**
   *@description Manage custom providers button text
   */
  manageCustomProvidersButton: '+ Manage Custom Providers',
  /**
   *@description Available models section label
   */
  availableModelsLabel: 'Available Models',
  /**
   *@description Add model button text
   */
  addModelButton: 'Add',
  /**
   *@description Model name input placeholder
   */
  modelNamePlaceholder: 'Enter model name',
  /**
   *@description Remove model button text
   */
  removeModelButton: '×',
  /**
   *@description Add model section label
   */
  addModelLabel: 'Add Model',
  /**
   *@description Models count hint text
   */
  modelsCountHint: '{n} model(s)',
};

/**
 * Registered UI strings for i18n
 */
const str_ = i18n.i18n.registerUIStrings('panels/ai_chat/ui/settings/i18n-strings.ts', UIStrings);

/**
 * Get localized string function
 */
export const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
