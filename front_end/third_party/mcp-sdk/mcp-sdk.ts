// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Client as MCPSDKClient } from './dist/esm/client/index.js';
import { SSEClientTransport } from './dist/esm/client/sse.js';
import { StreamableHTTPClientTransport } from './dist/esm/client/streamableHttp.js';
import type { Transport } from './dist/esm/shared/transport.js';
import { JSONRPCMessageSchema, type JSONRPCMessage } from './dist/esm/types.js';
import { UnauthorizedError, type OAuthClientProvider } from './dist/esm/client/auth.js';
import type { AuthorizationServerMetadata } from './dist/esm/shared/auth.js';
// DevTools SDK for page navigation and URL monitoring
import * as SDK from '../../core/sdk/sdk.js';
import * as Platform from '../../core/platform/platform.js';

// Simple logger for this module - we can't use the DevTools logger from third_party
const logger = {
  info: (...args: any[]) => console.log('[MCPClientSDK]', ...args),
  warn: (...args: any[]) => console.warn('[MCPClientSDK]', ...args),
  error: (...args: any[]) => console.error('[MCPClientSDK]', ...args),
  debug: (...args: any[]) => console.debug('[MCPClientSDK]', ...args),
};

export interface MCPServer {
  id: string;
  endpoint: string;
  token?: string;
}

export interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface Connection {
  server: MCPServer;
  connected: boolean;
  client: MCPSDKClient;
  transport: Transport;
}


export class MCPClientSDK {
  private connections = new Map<string, Connection>();

  async connect(server: MCPServer): Promise<void> {
    logger.info('Connecting to MCP server using SDK', { endpoint: server.endpoint });

    // Create transport - prefer Streamable HTTP; fallback to SSE if needed
    let transport: Transport;
    // If no explicit bearer token, enable OAuth flow with our DevTools provider
    const maybeAuthProvider = !server.token ? new DevToolsMCPOAuthProvider({ id: server.id, endpoint: server.endpoint }) : undefined;
    transport = new StreamableHTTPClientTransport(new URL(server.endpoint), {
      requestInit: server.token ? { headers: { 'Authorization': `Bearer ${server.token}` } } : undefined,
      authProvider: maybeAuthProvider,
    });

    // Create SDK client
    const client = new MCPSDKClient(
      {
        name: 'chrome-devtools',
        version: '1.0.0',
      },
      {
        capabilities: {}
      }
    );

    try {
      await client.connect(transport);
      
      const connection: Connection = {
        server,
        connected: true,
        client,
        transport,
      };
      
      this.connections.set(server.id, connection);
      logger.info('Connected to MCP server via SDK', { serverId: server.id });
      
    } catch (error) {
      // Try to complete OAuth if required
      if (error instanceof UnauthorizedError && maybeAuthProvider && 'waitForAuthorizationCode' in maybeAuthProvider) {
        logger.info('Authorization required. Waiting for OAuth callback...');
        const code = await (maybeAuthProvider as any).waitForAuthorizationCode();
        await (transport as any).finishAuth(code);

        // Create a new transport with the authenticated auth provider
        const newTransport = new StreamableHTTPClientTransport(new URL(server.endpoint), {
          requestInit: server.token ? { headers: { 'Authorization': `Bearer ${server.token}` } } : undefined,
          authProvider: maybeAuthProvider,
        });
        await client.connect(newTransport);

        const connection: Connection = { server, connected: true, client, transport: newTransport };
        this.connections.set(server.id, connection);
        logger.info('Connected to MCP server after OAuth', { serverId: server.id });
        return;
      }

      // Try SSE fallback if Streamable HTTP connect fails for other reasons
      logger.warn('Streamable HTTP connect failed, retrying with SSE', { endpoint: server.endpoint, error });
      let sseTransport: SSEClientTransport | undefined;
      try {
        sseTransport = new SSEClientTransport(new URL(server.endpoint), {
          // Propagate OAuth provider if present so SSE can authenticate too
          // @ts-ignore - type is compatible at runtime
          authProvider: maybeAuthProvider,
          // If a static token was provided, include it for SSE as well
          requestInit: server.token ? { headers: { 'Authorization': `Bearer ${server.token}` } } : undefined,
        } as any);
        await client.connect(sseTransport);

        const connection: Connection = {
          server,
          connected: true,
          client,
          transport: sseTransport,
        };
        this.connections.set(server.id, connection);
        logger.info('Connected to MCP server via SSE fallback', { serverId: server.id });
      } catch (fallbackError) {
        // Second chance: if OAuth required on SSE, complete it and retry once
        if (fallbackError instanceof UnauthorizedError && maybeAuthProvider && 'waitForAuthorizationCode' in maybeAuthProvider) {
          logger.info('Authorization required (SSE). Waiting for OAuth callback...');
          const code = await (maybeAuthProvider as any).waitForAuthorizationCode();
          // Finish auth using the SSE transport context to preserve any
          // resource metadata discovered during the SSE auth attempt
          await (sseTransport as any)?.finishAuth(code).catch(() => {});
          // Recreate SSE transport to ensure clean state
          const sseTransport2 = new SSEClientTransport(new URL(server.endpoint), {
            // Include static token if provided
            requestInit: server.token ? { headers: { 'Authorization': `Bearer ${server.token}` } } : undefined,
            authProvider: maybeAuthProvider,
          } as any);
          await client.connect(sseTransport2);
          const connection: Connection = { server, connected: true, client, transport: sseTransport2 };
          this.connections.set(server.id, connection);
          logger.info('Connected to MCP server via SSE after OAuth', { serverId: server.id });
          return;
        }
        logger.error('Failed to connect via both Streamable HTTP and SSE', { endpoint: server.endpoint, error: fallbackError });
        throw fallbackError;
      }
    }
  }

  disconnect(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    logger.info('Disconnecting MCP server', { serverId });
    
    try {
      connection.transport.close();
    } catch (error) {
      logger.warn('Error closing transport', { error });
    }
    
    this.connections.delete(serverId);
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.connected === true;
  }

  async listTools(serverId: string): Promise<MCPToolDef[]> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`No connection for server ${serverId}`);
    }

    try {
      logger.debug('Listing tools via SDK', { serverId });
      const result = await connection.client.listTools();
      
      // Convert SDK response to our format
      const tools: MCPToolDef[] = (result.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {},
      }));

      logger.info('Listed tools via SDK', { serverId, toolCount: tools.length });
      return tools;
      
    } catch (error) {
      logger.error('Failed to list tools via SDK', { serverId, error });
      throw new Error(`Failed to list tools: ${error instanceof Error ? error.message : error}`);
    }
  }

  setCachedTools(serverId: string, tools: MCPToolDef[]): void {
    // SDK handles tool caching internally
    logger.debug('setCachedTools called (SDK handles caching)', { serverId, toolCount: tools.length });
  }

  async callTool<T = unknown>(
    serverId: string, 
    name: string, 
    args: any, 
    _opts?: { timeoutMs?: number }
  ): Promise<T> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`No connection for server ${serverId}`);
    }

    try {
      logger.debug('Calling tool via SDK', { serverId, toolName: name, args });
      
      const result = await connection.client.callTool({
        name,
        arguments: args ?? {},
      });
      
      logger.info('Tool call successful via SDK', { serverId, toolName: name });
      return result as T;
      
    } catch (error) {
      logger.error('Tool call failed via SDK', { serverId, toolName: name, error });
      throw error;
    }
  }
}

// Export the SDK client as default to replace the current MCPClient
export { MCPClientSDK as MCPClient };

// ---- In-file DevTools OAuth provider (OpenRouter-style) ----
interface MCPOAuthServerDescriptor { id: string; endpoint: string; }

class DevToolsMCPOAuthProvider implements OAuthClientProvider {
  private static readonly DEFAULT_REDIRECT_URI = 'https://localhost:3000/callback';
  private readonly TOKENS_KEY: string;
  private readonly CLIENT_INFO_KEY: string;
  private readonly CODE_VERIFIER_KEY: string;
  private readonly STATE_KEY: string;
  private readonly ORIGINAL_URL_KEY: string;
  private urlChangeCleanup: (() => void) | null = null;

  constructor(private readonly server: MCPOAuthServerDescriptor,
              private readonly metadata: Partial<{ scope: string; token_endpoint_auth_method: string }> = {}) {
    const prefix = `mcp_oauth:${server.id}:`;
    this.TOKENS_KEY = `${prefix}tokens`;
    this.CLIENT_INFO_KEY = `${prefix}client_info`;
    this.CODE_VERIFIER_KEY = `${prefix}code_verifier`;
    this.STATE_KEY = `${prefix}state`;
    this.ORIGINAL_URL_KEY = `${prefix}original_url`;
  }

  private getConfiguredRedirectUrl(): string | undefined {
    try { return localStorage.getItem('ai_chat_mcp_oauth_redirect_url') || undefined; } catch { return undefined; }
  }
  private getConfiguredScope(): string | undefined {
    try { return localStorage.getItem('ai_chat_mcp_oauth_scope') || undefined; } catch { return undefined; }
  }

  get redirectUrl(): string | URL { return this.getConfiguredRedirectUrl() || DevToolsMCPOAuthProvider.DEFAULT_REDIRECT_URI; }

  get clientMetadata() {
    const redirect = String(this.redirectUrl);
    return {
      redirect_uris: [redirect],
      client_name: 'browseroperator',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // Only pass scope if configured; some providers reject unknown scopes.
      scope: this.getConfiguredScope() || this.metadata.scope,
      token_endpoint_auth_method: this.metadata.token_endpoint_auth_method,
    };
  }

  state(): string {
    const state = this.randomState();
    sessionStorage.setItem(this.STATE_KEY, state);
    return state;
  }

  async clientInformation() {
    // First, check for saved client information from previous OAuth attempts
    const raw = localStorage.getItem(this.CLIENT_INFO_KEY);
    if (raw) {
      try {
        const info = JSON.parse(raw);
        if (info.client_id) {
          logger.debug('Using saved OAuth client info:', info.client_id.substring(0, 10) + '...');
          return info;
        }
      } catch (e) {
        logger.warn('Invalid saved client info, clearing:', e);
        localStorage.removeItem(this.CLIENT_INFO_KEY);
      }
    }

    // Next, check if user has configured a client_id (and optional secret) manually
    const configuredClientId = localStorage.getItem('ai_chat_mcp_oauth_client_id');
    if (configuredClientId) {
      const configuredClientSecret = localStorage.getItem('ai_chat_mcp_oauth_client_secret') || undefined;
      logger.info('Using configured OAuth client_id:', configuredClientId.substring(0, 10) + '...');
      const clientInfo = {
        client_id: configuredClientId,
        client_secret: configuredClientSecret,
      };
      // Save for future use (important for finishAuth)
      await this.saveClientInformation(clientInfo);
      return clientInfo;
    }

    logger.debug('No client information available, will attempt dynamic registration');
    return undefined;
  }
  async saveClientInformation(info: unknown): Promise<void> {
    localStorage.setItem(this.CLIENT_INFO_KEY, JSON.stringify(info));
  }
  async tokens() {
    const raw = sessionStorage.getItem(this.TOKENS_KEY);
    return raw ? JSON.parse(raw) : undefined;
  }
  async saveTokens(tokens: unknown): Promise<void> {
    sessionStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
    // Clean up PKCE verifier after successful OAuth completion
    localStorage.removeItem(this.CODE_VERIFIER_KEY);
    logger.debug('PKCE code_verifier cleaned up after successful OAuth', { serverId: this.server.id });
  }
  // Optional hook used by SDK to report why credentials are being invalidated
  onAuthError(error: unknown, info?: { action?: string; scope?: string }): void {
    try {
      const err = error as any;
      logger.warn('OAuth error (will invalidate credentials)', {
        serverId: this.server.id,
        action: info?.action,
        scope: info?.scope,
        name: err?.name,
        message: err?.message,
      });
    } catch {}
  }
  async saveCodeVerifier(verifier: string): Promise<void> {
    localStorage.setItem(this.CODE_VERIFIER_KEY, verifier);
  }
  async codeVerifier(): Promise<string> {
    const v = localStorage.getItem(this.CODE_VERIFIER_KEY);
    if (!v) throw new Error('Missing PKCE code verifier');
    return v;
  }
  // Do NOT implement addClientAuthentication here. Leaving it undefined allows
  // the SDK to select and apply the correct client authentication method based
  // on server metadata, including adding client_id for public clients.

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
    logger.info('Invalidating OAuth credentials:', scope);

    try {
      switch(scope) {
        case 'all':
          // Preserve client info and code verifier for finishAuth retry paths.
          // Clear only ephemeral state and tokens.
          sessionStorage.removeItem(this.TOKENS_KEY);
          sessionStorage.removeItem(this.STATE_KEY);
          sessionStorage.removeItem(this.ORIGINAL_URL_KEY);
          break;
        case 'client':
          localStorage.removeItem(this.CLIENT_INFO_KEY);
          break;
        case 'tokens':
          sessionStorage.removeItem(this.TOKENS_KEY);
          break;
        case 'verifier':
          localStorage.removeItem(this.CODE_VERIFIER_KEY);
          break;
      }
    } catch (e) {
      logger.warn('Error invalidating credentials:', e);
    }
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    const original = this.currentPageUrl();
    if (original) sessionStorage.setItem(this.ORIGINAL_URL_KEY, original);
    await this.navigate(String(authorizationUrl));
  }

  async waitForAuthorizationCode(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => { this.removeListeners(); reject(new Error('oauth_timeout')); }, 5 * 60 * 1000);
      let pollInterval: number | null = null;

      const handleAuthCode = async (code: string, state?: string) => {
        try {
          const expected = sessionStorage.getItem(this.STATE_KEY);
          if (expected && state && expected !== state) throw new Error('oauth_invalid_state');
          sessionStorage.removeItem(this.STATE_KEY);
          clearTimeout(timeout);
          if (pollInterval) clearInterval(pollInterval);
          this.removeListeners();
          // Return to original URL after successful auth
          await this.returnToOriginalUrl();
          resolve(code);
        } catch (e) {
          clearTimeout(timeout);
          if (pollInterval) clearInterval(pollInterval);
          this.removeListeners();
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };

      // Enhanced URL change detection
      const maybeHandleUrl = async (url: string) => {
        logger.debug('Checking URL for OAuth callback:', url);

        if (!this.isRedirectUrl(url)) return false;

        try {
          logger.info('OAuth redirect detected:', url);
          const { code, state } = this.parseAuthCallback(url);
          await handleAuthCode(code, state);
          return true;
        } catch (e) {
          logger.error('Error parsing OAuth callback URL:', e);
          return false;
        }
      };

      // Check for OAuth redirect URL periodically (in case URL change events are missed)
      const pageContentListener = async () => {
        try {
          const currentUrl = this.currentPageUrl();

          // If we're on a localhost page, check if it's an OAuth callback URL
          if (currentUrl && this.isRedirectUrl(currentUrl)) {
            logger.debug('Periodic check found OAuth callback URL:', currentUrl);
            await maybeHandleUrl(currentUrl);
          }
        } catch (e) {
          // Silent failure for periodic checking
        }
      };

      const targetsListener = async (event: any) => {
        try {
          const targetInfos = event.data as Array<{url?: string}>;
          for (const info of targetInfos) {
            if (info.url && await maybeHandleUrl(info.url)) return;
          }
        } catch {}
      };

      const urlListener = async () => {
        const url = this.currentPageUrl();
        if (url) await maybeHandleUrl(url);
      };

      // Set up listeners
      SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED, targetsListener);
      SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.INSPECTED_URL_CHANGED, urlListener);

      // Check immediately in case we're already on the callback URL
      const currentUrl = this.currentPageUrl();
      if (currentUrl) {
        maybeHandleUrl(currentUrl);
      }

      // Poll for code display every 3 seconds (some providers show it after redirect fails)
      pollInterval = setInterval(pageContentListener, 3000) as unknown as number;

      this.urlChangeCleanup = () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        SDK.TargetManager.TargetManager.instance().removeEventListener(
          SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED, targetsListener);
        SDK.TargetManager.TargetManager.instance().removeEventListener(
          SDK.TargetManager.Events.INSPECTED_URL_CHANGED, urlListener);
      };
    });
  }

  private removeListeners(): void { this.urlChangeCleanup?.(); this.urlChangeCleanup = null; }
  private currentPageUrl(): string | null {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    const rtm = target?.model(SDK.ResourceTreeModel.ResourceTreeModel);
    const frame = rtm?.mainFrame;
    return frame ? frame.url : null;
  }
  private async navigate(url: string): Promise<void> {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) throw new Error('navigation_failed');
    const rtm = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!rtm) throw new Error('navigation_failed');
    const result = await rtm.navigate(url as Platform.DevToolsPath.UrlString);
    if (result.errorText) throw new Error(`navigation_failed:${result.errorText}`);
  }
  private async returnToOriginalUrl(): Promise<void> {
    const url = sessionStorage.getItem(this.ORIGINAL_URL_KEY);
    sessionStorage.removeItem(this.ORIGINAL_URL_KEY);
    if (url) { try { await this.navigate(url); } catch {} }
  }
  private isRedirectUrl(candidate: string): boolean {
    try {
      const u = new URL(candidate);
      const configuredRedirect = String(this.redirectUrl);

      // Check exact match with configured redirect URL
      const cb = new URL(configuredRedirect);
      if (`${u.origin}${u.pathname}` === `${cb.origin}${cb.pathname}`) {
        return true;
      }

      // Also check for common OAuth redirect patterns that providers might use
      // even when we request localhost:3000
      const commonPatterns = [
        'https://localhost:3000/callback',
        'http://localhost:3000/callback',
        'http://localhost:8080/callback',
        'http://127.0.0.1:3000/callback',
        'https://127.0.0.1:3000/callback',
        // Some providers use their own callback pages that display the code
        'urn:ietf:wg:oauth:2.0:oob'
      ];

      const currentPath = `${u.origin}${u.pathname}`;
      const isCommonPattern = commonPatterns.some(pattern => {
        try {
          const p = new URL(pattern);
          return currentPath === `${p.origin}${p.pathname}`;
        } catch {
          // Handle special URIs like 'urn:ietf:wg:oauth:2.0:oob'
          return candidate === pattern;
        }
      });

      if (isCommonPattern) {
        return true;
      }

      // Check if URL contains OAuth callback parameters (code or error)
      const hasOAuthParams = u.searchParams.has('code') || u.searchParams.has('error');

      // If it has OAuth params and is a localhost URL, likely an OAuth callback
      if (hasOAuthParams && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
  private parseAuthCallback(url: string): { code: string; state?: string } {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state') ?? undefined;
    if (!code) throw new Error('oauth_missing_code');
    return { code, state };
  }
  private randomState(): string {
    const arr = new Uint8Array(16); crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
