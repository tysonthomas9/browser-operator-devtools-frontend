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
}

export interface MCPRegistryStatus {
  enabled: boolean;
  servers: Array<{ id: string; name?: string; endpoint: string; authType: 'bearer' | 'oauth'; connected: boolean; toolCount: number }>;
  registeredToolNames: string[];
  lastError?: string;
  lastErrorType?: 'connection' | 'authentication' | 'configuration' | 'network' | 'server_error' | 'unknown';
  lastConnected?: Date;
  lastDisconnected?: Date;
}

class RegistryImpl {
  private client = new MCPClient();
  private servers: RegistryServer[] = [];
  private registeredTools: string[] = [];
  private lastError?: string;
  private lastErrorType?: 'connection' | 'authentication' | 'configuration' | 'network' | 'server_error' | 'unknown';
  private lastConnected?: Date;
  private lastDisconnected?: Date;

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

  async init(interactive: boolean = false): Promise<ConnectionResult[]> {
    const cfg = getMCPConfig();
    this.registeredTools = [];
    this.lastError = undefined;
    this.lastErrorType = undefined;
    ToolNameMap.clear();

    if (!cfg.enabled) {
      logger.info('MCP disabled');
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

    if (!interactive) {
      const requiresInteraction = this.servers
        .filter(server => server.authType === 'oauth')
        .some(server => {
          try {
            const storage = window.localStorage;
            return !storage.getItem(`mcp_oauth:${server.id}:tokens`);
          } catch {
            return true;
          }
        });
      if (requiresInteraction) {
        logger.info('Skipping OAuth auto-connect on startup; awaiting user action');
        return this.servers.map(server => ({
          serverId: server.id,
          name: server.name,
          endpoint: server.endpoint,
          connected: false,
          error: new Error('OAuth authentication required'),
          errorType: 'authentication' as const,
        }));
      }
    }

    const results: ConnectionResult[] = [];

    for (const server of this.servers) {
      try {
        await this.client.connect(server);
        this.lastConnected = new Date();
        logger.info('MCP connected', { serverId: server.id, endpoint: server.endpoint });

        results.push({
          serverId: server.id,
          name: server.name,
          endpoint: server.endpoint,
          connected: true,
        });
      } catch (error) {
        this.setError(error);

        // Enhanced logging with error details
        const logContext: any = { serverId: server.id, endpoint: server.endpoint, authType: server.authType };
        if (error instanceof Error && 'context' in error) {
          const context = (error as any).context;
          logContext.errorContext = context;
        }

        logger.error('MCP connect failed', { ...logContext, error });

        results.push({
          serverId: server.id,
          name: server.name,
          endpoint: server.endpoint,
          connected: false,
          error: error instanceof Error ? error : new Error(String(error)),
          errorType: this.categorizeError(error),
        });
      }
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
      if (!this.client.isConnected(srv.id)) {
        continue;
      }

      let tools: MCPToolDef[] = [];
      try {
        tools = await this.client.listTools(srv.id);
      } catch (error) {
        this.setError(error);
        logger.error('listTools failed', { serverId: srv.id, error });
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
    const usedNames = new Map<string, number>(); // Track which suffix numbers are used

    for (const { srv, def } of allServerTools) {
      // Generate smart tool name
      let toolName = def.name;
      const toolInfo = toolNameRegistry.get(def.name)!;

      // If there are multiple tools with the same name, add numeric suffix
      if (toolInfo.count > 1) {
        // Get next available suffix for this tool name
        const baseName = def.name;
        const currentCount = usedNames.get(baseName) || 1;

        if (toolInfo.serverId === srv.id && currentCount === 1) {
          // First occurrence gets no suffix
          toolName = baseName;
        } else {
          // Subsequent occurrences get numbered suffix
          const suffix = currentCount + 1;
          toolName = `${baseName}_${suffix}`;
        }

        usedNames.set(baseName, currentCount + 1);
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

        logger.debug('MCPRegistry: Registered tool with smart name', {
          originalName: def.name,
          smartName: toolName,
          serverId: srv.id,
          hasConflict: toolInfo.count > 1
        });
      } catch (error) {
        logger.error('Failed to register MCP tool', { tool: def.name, smartName: toolName, error });
      }
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
      await this.client.connect(server);
      this.lastConnected = new Date();
      this.lastError = undefined;
      this.lastErrorType = undefined;
      await this.refresh();
      logger.info('MCP server reconnected', { serverId });
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
      logger.debug('MCPRegistry: No tools registered but servers exist, auto-refreshing');
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
