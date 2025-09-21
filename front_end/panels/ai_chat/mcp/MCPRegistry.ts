import { createLogger } from '../core/Logger.js';
import { ToolRegistry } from '../agent_framework/ConfigurableAgentTool.js';
import * as ToolNameMap from '../core/ToolNameMap.js';
import type { MCPToolDef, MCPServer } from '../../../third_party/mcp-sdk/mcp-sdk-v2.js';
import { MCPClient } from '../../../third_party/mcp-sdk/mcp-sdk-v2.js';
import { getMCPConfig } from './MCPConfig.js';
import { MCPToolAdapter } from './MCPToolAdapter.js';

const logger = createLogger('MCPRegistry');

interface RegistryServer extends MCPServer {
  name?: string;
  authType: 'bearer' | 'oauth';
}

export interface ConnectionResult {
  serverId: string;
  name?: string;
  endpoint: string;
  connected: boolean;
  error?: Error;
  errorType?: 'connection' | 'authentication' | 'configuration' | 'network' | 'server_error' | 'unknown';
  retryAttempts?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
}

export interface ConnectionEvent {
  timestamp: Date;
  serverId: string;
  eventType: 'connected' | 'disconnected' | 'auth_error' | 'retry_attempt' | 'connection_failed';
  details?: string;
  retryAttempt?: number;
}

export interface MCPRegistryStatus {
  enabled: boolean;
  servers: Array<{ id: string; name?: string; endpoint: string; authType: 'bearer' | 'oauth'; connected: boolean; toolCount: number }>;
  registeredToolNames: string[];
  lastError?: string;
  lastErrorType?: 'connection' | 'authentication' | 'configuration' | 'network' | 'server_error' | 'unknown';
  lastConnected?: Date;
  lastDisconnected?: Date;
  connectionEvents: ConnectionEvent[];
}

class RegistryImpl {
  private client = new MCPClient();
  private servers: RegistryServer[] = [];
  private registeredTools: string[] = [];
  private lastError?: string;
  private lastErrorType?: 'connection' | 'authentication' | 'configuration' | 'network' | 'server_error' | 'unknown';
  private lastConnected?: Date;
  private lastDisconnected?: Date;
  private connectionEvents: ConnectionEvent[] = [];
  private readonly maxConnectionEvents = 50; // Keep last 50 events

  private getRetryConfig(): RetryConfig {
    const cfg = getMCPConfig();
    return {
      maxRetries: cfg.maxConnectionRetries || 3,
      baseDelayMs: cfg.retryDelayMs || 1000,
      maxDelayMs: Math.max((cfg.retryDelayMs || 1000) * 10, 10000), // 10x base delay or 10s minimum
      backoffMultiplier: 2,
      jitterMs: 500,
    };
  }

  private categorizeError(error: unknown): 'connection' | 'authentication' | 'configuration' | 'network' | 'server_error' | 'unknown' {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Check for SSE-specific error context
    if (error instanceof Error && 'context' in error) {
      const context = (error as any).context;

      // OAuth-related failures
      if (context?.authState === 'oauth_required' || context?.httpStatus === 401) {
        return 'authentication';
      }

      // Network/connection failures with specific status codes
      if (context?.httpStatus === 404) {
        return 'configuration';  // Endpoint not found
      }
      if (context?.httpStatus === 403) {
        return 'authentication';  // Forbidden - likely auth issue
      }
      if (context?.httpStatus >= 500) {
        return 'server_error';
      }

      // CORS or connection timeouts
      if (context?.readyState === 2) {  // EventSource CLOSED state
        return 'network';
      }
    }

    // Check for CORS errors (common with SSE)
    if (message.includes('cors') || message.includes('cross-origin') || message.includes('fetch')) {
      return 'network';
    }

    // SSE-specific errors
    if (message.includes('sse error') || message.includes('eventsource')) {
      if (message.includes('oauth') || message.includes('401') || message.includes('unauthorized')) {
        return 'authentication';
      }
      return 'connection';
    }

    // Original categorization logic
    if (message.includes('unauthorized') || message.includes('authentication') || message.includes('auth') || message.includes('token')) {
      return 'authentication';
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('connection reset') || message.includes('econnreset')) {
      return 'network';
    }
    if (message.includes('connection') || message.includes('connect') || message.includes('econnrefused') || message.includes('websocket')) {
      return 'connection';
    }
    if (message.includes('invalid') || message.includes('malformed') || message.includes('endpoint') || message.includes('url')) {
      return 'configuration';
    }
    if (message.includes('server error') || message.includes('internal error') || message.includes('500') || message.includes('503')) {
      return 'server_error';
    }
    return 'unknown';
  }

  private setError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error);
    this.lastErrorType = this.categorizeError(error);
  }

  /**
   * Check if an error type is worth retrying
   */
  private shouldRetryError(errorType: string): boolean {
    // Only retry network errors and server errors, not authentication or configuration errors
    return errorType === 'network' || errorType === 'server_error' || errorType === 'connection';
  }

  /**
   * Calculate delay for retry attempt with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
    const jitter = Math.random() * config.jitterMs;
    return Math.min(exponentialDelay + jitter, config.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Refresh tools for a specific server with retry logic
   */
  private async refreshToolsForServer(serverId: string, retryCount = 0): Promise<void> {
    const maxRetries = 2;
    const retryDelayMs = 2000; // 2 seconds

    if (!this.client.isConnected(serverId)) {
      return;
    }

    const server = this.servers.find(s => s.id === serverId);
    if (!server) {
      logger.warn('MCPRegistry: Server not found for tool refresh', { serverId });
      return;
    }

    try {

      const tools = await this.client.listTools(serverId);

      // If we got tools, we're done - tools exist and will be registered by the next refresh
      if (tools.length > 0) {
        return;
      } else if (retryCount < maxRetries) {
        // No tools found, but maybe the server needs more time

        setTimeout(async () => {
          try {
            await this.refreshToolsForServer(serverId, retryCount + 1);
          } catch (error) {
            logger.warn('MCPRegistry: Delayed tool refresh failed', { serverId, error });
          }
        }, retryDelayMs);
      } else {
      }
    } catch (error) {
      logger.warn('MCPRegistry: Failed to refresh tools for server', {
        serverId,
        attempt: retryCount + 1,
        maxRetries,
        error
      });

      if (retryCount < maxRetries) {

        setTimeout(async () => {
          try {
            await this.refreshToolsForServer(serverId, retryCount + 1);
          } catch (retryError) {
            logger.warn('MCPRegistry: Delayed tool refresh retry failed', { serverId, error: retryError });
          }
        }, retryDelayMs);
      }
    }
  }

  /**
   * Track a connection event
   */
  private trackConnectionEvent(event: Omit<ConnectionEvent, 'timestamp'>): void {
    const connectionEvent: ConnectionEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.connectionEvents.push(connectionEvent);

    // Keep only the last N events
    if (this.connectionEvents.length > this.maxConnectionEvents) {
      this.connectionEvents = this.connectionEvents.slice(-this.maxConnectionEvents);
    }

    // Also persist to localStorage for persistence across sessions
    this.saveConnectionEvents();

  }

  /**
   * Save connection events to localStorage
   */
  private saveConnectionEvents(): void {
    try {
      const serialized = this.connectionEvents.map(event => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      }));
      localStorage.setItem('ai_chat_mcp_connection_events', JSON.stringify(serialized));
    } catch (error) {
      logger.warn('Failed to save connection events', error);
    }
  }

  /**
   * Load connection events from localStorage
   */
  private loadConnectionEvents(): void {
    try {
      const raw = localStorage.getItem('ai_chat_mcp_connection_events');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.connectionEvents = parsed.map(event => ({
            ...event,
            timestamp: new Date(event.timestamp),
          })).slice(-this.maxConnectionEvents); // Ensure we don't exceed max
        }
      }
    } catch (error) {
      logger.warn('Failed to load connection events', error);
      this.connectionEvents = [];
    }
  }

  /**
   * Get connection events for display
   */
  getConnectionEvents(): ConnectionEvent[] {
    return [...this.connectionEvents].reverse(); // Most recent first
  }

  /**
   * Clear stored authentication error for a specific server
   */
  private clearStoredAuthErrorForServer(serverId: string): void {
    try {
      const prefix = `mcp_oauth:${serverId}:`;
      localStorage.removeItem(`${prefix}last_auth_error`);
      localStorage.removeItem(`${prefix}auth_error_timestamp`);
      localStorage.removeItem(`${prefix}auth_error_type`);
    } catch (err) {
      logger.warn('Failed to clear stored auth error', { serverId, err });
    }
  }

  /**
   * Attempt to connect to a server with retry logic
   */
  private async connectWithRetry(server: RegistryServer, config?: RetryConfig, interactive: boolean = true): Promise<ConnectionResult> {
    const retryConfig = config || this.getRetryConfig();
    let lastError: unknown;
    let retryAttempts = 0;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        await this.client.connect({ ...server, interactive });
        this.lastConnected = new Date();


        // Clear any stored authentication errors on successful connection
        this.clearStoredAuthErrorForServer(server.id);

        // Track successful connection
        this.trackConnectionEvent({
          serverId: server.id,
          eventType: 'connected',
          details: `Connected on attempt ${attempt + 1}`,
          retryAttempt: attempt,
        });

        // Automatically refresh tools after successful connection
        try {
          await this.refreshToolsForServer(server.id);
        } catch (refreshError) {
          logger.warn('MCPRegistry: Auto-refresh failed after connection', {
            serverId: server.id,
            error: refreshError
          });
        }

        return {
          serverId: server.id,
          name: server.name,
          endpoint: server.endpoint,
          connected: true,
          retryAttempts,
        };
      } catch (error) {
        lastError = error;
        retryAttempts = attempt;
        const errorType = this.categorizeError(error);

        // Enhanced logging with error details
        const logContext: any = {
          serverId: server.id,
          endpoint: server.endpoint,
          authType: server.authType,
          attempt: attempt + 1,
          errorType
        };
        if (error instanceof Error && 'context' in error) {
          const context = (error as any).context;
          logContext.errorContext = context;
        }

        logger.warn('MCP connect attempt failed', { ...logContext, error });

        // Track authentication errors specifically
        if (errorType === 'authentication') {
          this.trackConnectionEvent({
            serverId: server.id,
            eventType: 'auth_error',
            details: error instanceof Error ? error.message : String(error),
            retryAttempt: attempt,
          });
        } else {
          // Track retry attempts for other errors
          this.trackConnectionEvent({
            serverId: server.id,
            eventType: 'retry_attempt',
            details: `${errorType}: ${error instanceof Error ? error.message : String(error)}`,
            retryAttempt: attempt,
          });
        }

        // Don't retry for authentication or configuration errors
        if (!this.shouldRetryError(errorType)) {
          logger.info('MCP connection error not retryable', {
            serverId: server.id,
            errorType,
            finalAttempt: attempt + 1
          });
          break;
        }

        // Don't sleep after the last attempt
        if (attempt < retryConfig.maxRetries) {
          const delay = this.calculateRetryDelay(attempt, retryConfig);
          logger.info('MCP connection retry scheduled', {
            serverId: server.id,
            attempt: attempt + 1,
            nextAttemptIn: `${delay}ms`
          });
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    this.setError(lastError);

    logger.error('MCP connect failed after all retries', {
      serverId: server.id,
      endpoint: server.endpoint,
      totalAttempts: retryAttempts + 1,
      error: lastError
    });

    // Track final connection failure
    this.trackConnectionEvent({
      serverId: server.id,
      eventType: 'connection_failed',
      details: `Failed after ${retryAttempts + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      retryAttempt: retryAttempts,
    });

    return {
      serverId: server.id,
      name: server.name,
      endpoint: server.endpoint,
      connected: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
      errorType: this.categorizeError(lastError),
      retryAttempts,
    };
  }

  async init(interactive: boolean = false): Promise<ConnectionResult[]> {
    const cfg = getMCPConfig();
    this.registeredTools = [];
    this.lastError = undefined;
    this.lastErrorType = undefined;
    ToolNameMap.clear();

    // Load connection events from previous sessions
    this.loadConnectionEvents();

    if (!cfg.enabled) {
      return [];
    }

    const providers = cfg.providers.filter(provider => provider.enabled);
    if (providers.length === 0) {
      logger.warn('No MCP providers configured');
      return [];
    }

    const configuredIds = new Set(providers.map(provider => provider.id));
    for (const existing of this.servers) {
      if (!configuredIds.has(existing.id)) {
        try {
          this.client.disconnect(existing.id);
        } catch (error) {
          logger.warn('Failed to disconnect MCP server', { serverId: existing.id, error });
        }
      }
    }

    this.servers = providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      endpoint: provider.endpoint,
      authType: provider.authType,
      token: provider.authType === 'bearer' ? provider.token : undefined,
      oauth: provider.authType === 'oauth' ? {
        clientId: provider.oauthClientId,
        scope: provider.oauthScope,
        redirectUri: provider.oauthRedirectUrl,
      } : undefined,
    }));

    // In non-interactive mode, let the OAuth provider handle token checks internally
    // This allows auto-connection with refresh tokens while avoiding popups for new auth

    const results: ConnectionResult[] = [];

    for (const server of this.servers) {
      const result = await this.connectWithRetry(server, undefined, interactive);
      results.push(result);
    }

    return results;
  }


  async refresh(): Promise<void> {
    const cfg = getMCPConfig();

    if (!cfg.enabled || this.servers.length === 0) {
      return;
    }

    this.registeredTools = [];
    const allow = new Set(cfg.toolAllowlist || []);

    // Track tool names across all servers for conflict detection
    const toolNameRegistry = new Map<string, { serverId: string; originalName: string; count: number }>();
    const allServerTools: Array<{ srv: RegistryServer; def: MCPToolDef }> = [];

    // First pass: collect all tools from all servers
    for (const srv of this.servers) {
      const isConnected = this.client.isConnected(srv.id);

      if (!isConnected) {
        continue;
      }

      let tools: MCPToolDef[] = [];
      try {
        tools = await this.client.listTools(srv.id);
      } catch (error) {
        this.setError(error);
        logger.error('MCPRegistry: listTools failed', { serverId: srv.id, error });
        continue;
      }

      for (const def of tools) {
        allServerTools.push({ srv, def });

        // Track tool name occurrences
        if (toolNameRegistry.has(def.name)) {
          const existing = toolNameRegistry.get(def.name)!;
          existing.count++;
        } else {
          toolNameRegistry.set(def.name, { serverId: srv.id, originalName: def.name, count: 1 });
        }
      }
    }

    // Second pass: register tools with smart naming
    const usedNames = new Map<string, number>(); // Track occurrence count per base name (starts at 0)

    for (const { srv, def } of allServerTools) {
      // Generate smart tool name
      const baseName = def.name;

      // Get current occurrence count (starts at 0)
      const occurrenceCount = usedNames.get(baseName) || 0;

      // Increment occurrence count for this tool
      const newCount = occurrenceCount + 1;
      usedNames.set(baseName, newCount);

      // Generate tool name with suffix only for 2nd+ occurrences
      let toolName = baseName;
      if (newCount > 1) {
        toolName = `${baseName}_${newCount}`;
      }

      // Create namespaced name for internal tracking but use smart name for registration
      const namespacedName = `mcp:${srv.id}:${def.name}`;
      ToolNameMap.addMapping(namespacedName);
      ToolNameMap.addMapping(toolName); // Also map the smart name

      // Check allowlist using both names
      if (allow.size > 0 && !allow.has(namespacedName) && !allow.has(def.name) && !allow.has(toolName)) {
        continue;
      }

      try {
        const factoryName = toolName; // Use smart name as factory name
        ToolRegistry.registerToolFactory(factoryName, () => new MCPToolAdapter(srv.id, this.client, def, namespacedName));
        this.registeredTools.push(factoryName);
      } catch (error) {
        logger.error('MCPRegistry: Failed to register MCP tool', { tool: def.name, smartName: toolName, error });
      }
    }

    if (allServerTools.length > 0 && this.registeredTools.length === 0) {
      logger.warn('MCPRegistry: Found tools but none were registered - check allowlist configuration', {
        foundTools: allServerTools.map(t => t.def.name),
        allowlist: Array.from(allow)
      });
    }
  }

  async reconnect(serverId: string): Promise<void> {
    const server = this.servers.find(srv => srv.id === serverId);
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }

    try {
      this.client.disconnect(serverId);
    } catch (error) {
      logger.debug('Error disconnecting MCP server before reconnect', { serverId, error });
    }

    try {
      await this.client.connect({ ...server, interactive: true });
      this.lastConnected = new Date();
      this.lastError = undefined;
      this.lastErrorType = undefined;

      // Clear stored authentication errors on successful reconnection
      this.clearStoredAuthErrorForServer(serverId);

      await this.refresh();
    } catch (error) {
      this.setError(error);
      logger.error('Failed to reconnect MCP server', { serverId, error });
      throw error;
    }
  }

  dispose(): void {
    for (const srv of this.servers) {
      try {
        this.client.disconnect(srv.id);
        // Track disconnection
        this.trackConnectionEvent({
          serverId: srv.id,
          eventType: 'disconnected',
          details: 'Manual disconnect',
        });
      } catch {
        // ignore errors during cleanup
      }
    }
    this.lastDisconnected = new Date();
    this.servers = [];
  }

  async ensureToolsRegistered(): Promise<void> {
    // Auto-refresh if no tools are registered but servers are configured
    if (this.registeredTools.length === 0 && this.servers.length > 0) {
      try {
        await this.refresh();
      } catch (error) {
        logger.error('MCPRegistry: Auto-refresh failed', { error });
      }
    }
  }

  getStatus(): MCPRegistryStatus {
    return {
      enabled: getMCPConfig().enabled,
      servers: this.servers.map(s => ({
        id: s.id,
        name: s.name,
        endpoint: s.endpoint,
        authType: s.authType,
        connected: this.client.isConnected(s.id),
        toolCount: (() => {
          // Count tools for this server by checking if each registered tool belongs to this server
          let count = 0;
          for (const toolName of this.registeredTools) {
            try {
              const tool = ToolRegistry.getRegisteredTool(toolName);
              if (tool && tool instanceof MCPToolAdapter && tool.getServerId() === s.id) {
                count++;
              }
            } catch (error) {
              // Ignore tool registry errors
            }
          }
          return count;
        })(),
      })),
      registeredToolNames: [...this.registeredTools],
      lastError: this.lastError,
      lastErrorType: this.lastErrorType,
      lastConnected: this.lastConnected,
      lastDisconnected: this.lastDisconnected,
      connectionEvents: this.getConnectionEvents(),
    };
  }

  getSanitizedFunctionName(original: string): string {
    return ToolNameMap.getSanitized(original);
  }

  resolveOriginalFunctionName(sanitized: string): string | undefined {
    return ToolNameMap.resolveOriginal(sanitized);
  }
}

export const MCPRegistry = new RegistryImpl();
