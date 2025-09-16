// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Client as MCPSDKClient } from './dist/esm/client/index.js';
import { StreamableHTTPClientTransport } from './dist/esm/client/streamableHttp.js';
import { SSEClientTransport } from './dist/esm/client/sse.js';
import type { Transport } from './dist/esm/shared/transport.js';
import { UnauthorizedError, type OAuthClientProvider } from './dist/esm/client/auth.js';
import type { AuthorizationServerMetadata, OAuthClientMetadata, OAuthClientInformation, OAuthClientInformationFull, OAuthTokens } from './dist/esm/shared/auth.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Platform from '../../core/platform/platform.js';

const logger = {
  info: (...args: unknown[]) => console.log('[MCPClientSDKv2]', ...args),
  warn: (...args: unknown[]) => console.warn('[MCPClientSDKv2]', ...args),
  error: (...args: unknown[]) => console.error('[MCPClientSDKv2]', ...args),
  debug: (...args: unknown[]) => console.debug('[MCPClientSDKv2]', ...args),
};

export interface MCPServerOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  redirectUri?: string;
  metadata?: Partial<AuthorizationServerMetadata>;
}

export interface MCPServer {
  id: string;
  endpoint: string;
  token?: string;
  oauth?: MCPServerOAuthConfig;
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

interface MCPClientSDKOptions {
  defaultRedirectUri?: string;
  defaultScope?: string;
}

const DEFAULT_REDIRECT_URI = 'https://localhost:3000/callback';

export class MCPClientSDKv2 {
  private readonly connections = new Map<string, Connection>();
  private readonly options: MCPClientSDKOptions;

  constructor(options: MCPClientSDKOptions = {}) {
    this.options = options;
  }

  async connect(server: MCPServer): Promise<void> {
    logger.info('Connecting to MCP server (v2)', { serverId: server.id, endpoint: server.endpoint });

    const client = new MCPSDKClient(
      {
        name: 'chrome-devtools',
        version: '2.0.0',
      },
      {
        capabilities: {},
      },
    );

    const requestInit = server.token ? { headers: { Authorization: `Bearer ${server.token}` } } : undefined;
    const oauthProvider = server.token ? undefined : new DevToolsPKCEOAuthProvider(
      { id: server.id, endpoint: server.endpoint },
      {
        redirectUri: server.oauth?.redirectUri ?? this.options.defaultRedirectUri ?? DEFAULT_REDIRECT_URI,
        scope: server.oauth?.scope ?? this.options.defaultScope,
        clientId: server.oauth?.clientId,
        clientSecret: server.oauth?.clientSecret,
        metadata: server.oauth?.metadata,
      },
    );

    const endpointUrl = new URL(server.endpoint);

    const transportFactory = () => new StreamableHTTPClientTransport(endpointUrl, {
      requestInit,
      authProvider: oauthProvider,
    });

    try {
      const transport = await this.establishConnection(client, server, transportFactory, oauthProvider);
      this.connections.set(server.id, { server, connected: true, client, transport });
      logger.info('Connected to MCP server via Streamable HTTP', { serverId: server.id });
      return;
    } catch (error) {
      logger.warn('Streamable HTTP connection failed, attempting SSE fallback', { serverId: server.id, error });
    }

    const sseTransportFactory = () => new SSEClientTransport(endpointUrl, {
      requestInit,
      // @ts-ignore - runtime compatible with OAuth provider expectations
      authProvider: oauthProvider,
    });

    const sseTransport = await this.establishConnection(client, server, sseTransportFactory, oauthProvider);
    this.connections.set(server.id, { server, connected: true, client, transport: sseTransport });
    logger.info('Connected to MCP server via SSE fallback', { serverId: server.id });
  }

  disconnect(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }
    logger.info('Disconnecting MCP server (v2)', { serverId });
    try {
      connection.transport.close();
    } catch (error) {
      logger.warn('Error closing transport', { serverId, error });
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
      const result = await connection.client.listTools();
      const tools: MCPToolDef[] = (result.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {},
      }));
      logger.info('Listed tools via MCP SDK v2', { serverId, toolCount: tools.length });
      return tools;
    } catch (error) {
      logger.error('Failed to list tools via MCP SDK v2', { serverId, error });
      throw new Error(`Failed to list tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  setCachedTools(serverId: string, tools: MCPToolDef[]): void {
    logger.debug('setCachedTools noop - handled by MCP SDK', { serverId, toolCount: tools.length });
  }

  async callTool<T = unknown>(serverId: string, name: string, args: Record<string, unknown>, _opts?: { timeoutMs?: number }): Promise<T> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`No connection for server ${serverId}`);
    }

    try {
      const result = await connection.client.callTool({
        name,
        arguments: args ?? {},
      });
      logger.info('Tool call completed via MCP SDK v2', { serverId, toolName: name });
      return result as T;
    } catch (error) {
      logger.error('Tool call failed via MCP SDK v2', { serverId, toolName: name, error });
      throw error;
    }
  }

  private async establishConnection<T extends Transport & Partial<AuthCapableTransport>>(
    client: MCPSDKClient,
    server: MCPServer,
    createTransport: () => T,
    oauthProvider?: DevToolsPKCEOAuthProvider,
  ): Promise<T> {
    const transport = createTransport();
    try {
      await client.connect(transport);
      return transport;
    } catch (error) {
      if (oauthProvider && error instanceof UnauthorizedError && typeof transport.finishAuth === 'function') {
        logger.info('Awaiting OAuth authorization code', { serverId: server.id });
        const authorizationCode = await oauthProvider.waitForAuthorizationCode();
        await transport.finishAuth(authorizationCode);
        if ('close' in transport && typeof transport.close === 'function') {
          try {
            await (transport as unknown as { close: () => Promise<void> | void }).close();
          } catch {}
        }
        const authedTransport = createTransport();
        await client.connect(authedTransport);
        return authedTransport;
      }
      throw error;
    }
  }
}

interface AuthCapableTransport {
  finishAuth(authorizationCode: string): Promise<void>;
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

interface StoredServerSettings {
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRedirectUrl?: string;
  oauthScope?: string;
}

class MemoryStorage implements StorageLike {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function createStorage(kind: 'local' | 'session'): StorageLike {
  const globalObject = typeof window !== 'undefined' ? window : undefined;
  if (globalObject) {
    try {
      const storage = kind === 'local' ? globalObject.localStorage : globalObject.sessionStorage;
      const probeKey = '__mcp_sdk_v2_probe__';
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      logger.warn('Falling back to in-memory storage', { kind, error });
    }
  }
  return new MemoryStorage();
}

interface PKCEOAuthProviderInit {
  redirectUri: string;
  scope?: string;
  clientId?: string;
  clientSecret?: string;
  metadata?: Partial<AuthorizationServerMetadata>;
}

interface ServerDescriptor {
  id: string;
  endpoint: string;
}

type AuthorizationParams = {
  code: string;
  state?: string;
};

class DevToolsPKCEOAuthProvider implements OAuthClientProvider {
  private static readonly STORAGE_PREFIX = 'mcp_oauth';
  private static readonly SERVER_SETTINGS_KEY = 'ai_chat_mcp_server_settings';

  private readonly sessionStorage: StorageLike = createStorage('session');
  private readonly persistentStorage: StorageLike = createStorage('local');

  private readonly tokensKey: string;
  private readonly clientInfoKey: string;
  private readonly verifierKey: string;
  private readonly stateKey: string;
  private readonly originalUrlKey: string;

  private cleanupCallback: (() => void) | null = null;

  constructor(private readonly server: ServerDescriptor, private readonly init: PKCEOAuthProviderInit) {
    const prefix = `${DevToolsPKCEOAuthProvider.STORAGE_PREFIX}:${server.id}:`;
    this.tokensKey = `${prefix}tokens`;
    this.clientInfoKey = `${prefix}client_info`;
    this.verifierKey = `${prefix}code_verifier`;
    this.stateKey = `${prefix}state`;
    this.originalUrlKey = `${prefix}original_url`;
  }

  get redirectUrl(): string | URL {
    return this.resolveRedirectUri();
  }

  get clientMetadata(): OAuthClientMetadata {
    const redirect = String(this.redirectUrl);
    const metadata: OAuthClientMetadata = {
      redirect_uris: [redirect],
      client_name: 'chrome-devtools-mcp',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: this.init.metadata?.token_endpoint_auth_method,
    };
    const scope = this.resolveScope();
    if (scope) {
      metadata.scope = scope;
    }
    return metadata;
  }

  state(): string {
    const state = this.randomState();
    this.sessionStorage.setItem(this.stateKey, state);
    return state;
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    if (this.init.clientId) {
      const info: OAuthClientInformation = {
        client_id: this.init.clientId,
        client_secret: this.init.clientSecret,
      };
      await this.saveClientInformation(info);
      return info;
    }

    const stored = this.persistentStorage.getItem(this.clientInfoKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OAuthClientInformation;
        if (parsed?.client_id) {
          return parsed;
        }
      } catch (error) {
        logger.warn('Clearing malformed stored client information', { serverId: this.server.id, error });
        this.persistentStorage.removeItem(this.clientInfoKey);
      }
    }

    const configuredClientId = this.getConfiguredClientId();
    if (configuredClientId) {
      const info: OAuthClientInformation = {
        client_id: configuredClientId,
        client_secret: this.getConfiguredClientSecret(),
      };
      await this.saveClientInformation(info);
      return info;
    }

    return undefined;
  }

  async saveClientInformation(info: OAuthClientInformationFull | OAuthClientInformation): Promise<void> {
    this.persistentStorage.setItem(this.clientInfoKey, JSON.stringify(info));
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const raw = this.sessionStorage.getItem(this.tokensKey);
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as OAuthTokens;
    } catch (error) {
      logger.warn('Clearing malformed stored tokens', { serverId: this.server.id, error });
      this.sessionStorage.removeItem(this.tokensKey);
      return undefined;
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.sessionStorage.setItem(this.tokensKey, JSON.stringify(tokens));
    this.sessionStorage.removeItem(this.verifierKey);
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    this.sessionStorage.setItem(this.verifierKey, verifier);
  }

  async codeVerifier(): Promise<string> {
    const verifier = this.sessionStorage.getItem(this.verifierKey);
    if (!verifier) {
      throw new Error('Missing PKCE code verifier');
    }
    return verifier;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    const originalUrl = this.currentPageUrl();
    if (originalUrl) {
      this.sessionStorage.setItem(this.originalUrlKey, originalUrl);
    }
    await this.navigate(String(authorizationUrl));
  }

  async waitForAuthorizationCode(): Promise<string> {
    if (this.cleanupCallback) {
      this.cleanupCallback();
      this.cleanupCallback = null;
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.error('Timed out waiting for authorization code', { serverId: this.server.id });
        cleanup();
        reject(new Error('oauth_timeout'));
      }, 5 * 60 * 1000);

      const maybeHandleUrl = async (url: string) => {
        if (!this.isRedirectUrl(url)) {
          return false;
        }
        try {
          const params = this.parseAuthorizationResponse(url);
          this.validateState(params.state);
          cleanup();
          await this.returnToOriginalUrl();
          resolve(params.code);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        return true;
      };

      const targetsListener = async (event: any) => {
        try {
          const targetInfos = event.data as Array<{url?: string}>;
          for (const info of targetInfos) {
            if (info.url && await maybeHandleUrl(info.url)) {
              return;
            }
          }
        } catch (error) {
          logger.debug('Error while inspecting targets for OAuth redirect', { serverId: this.server.id, error });
        }
      };

      const urlListener = async () => {
        const url = this.currentPageUrl();
        if (url) {
          await maybeHandleUrl(url);
        }
      };

      const pollInterval = setInterval(() => {
        const url = this.currentPageUrl();
        if (url) {
          void maybeHandleUrl(url);
        }
      }, 3000);

      const cleanup = () => {
        clearTimeout(timeout);
        clearInterval(pollInterval);
        SDK.TargetManager.TargetManager.instance().removeEventListener(
          SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED,
          targetsListener,
        );
        SDK.TargetManager.TargetManager.instance().removeEventListener(
          SDK.TargetManager.Events.INSPECTED_URL_CHANGED,
          urlListener,
        );
        this.cleanupCallback = null;
      };

      SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED,
        targetsListener,
      );
      SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.INSPECTED_URL_CHANGED,
        urlListener,
      );

      this.cleanupCallback = cleanup;

      const currentUrl = this.currentPageUrl();
      if (currentUrl) {
        void maybeHandleUrl(currentUrl);
      }
    });
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
    logger.info('Invalidating OAuth credentials', { serverId: this.server.id, scope });
    switch (scope) {
      case 'all':
        this.sessionStorage.removeItem(this.tokensKey);
        this.sessionStorage.removeItem(this.stateKey);
        this.sessionStorage.removeItem(this.originalUrlKey);
        this.sessionStorage.removeItem(this.verifierKey);
        this.persistentStorage.removeItem(this.clientInfoKey);
        break;
      case 'client':
        this.persistentStorage.removeItem(this.clientInfoKey);
        break;
      case 'tokens':
        this.sessionStorage.removeItem(this.tokensKey);
        this.sessionStorage.removeItem(this.stateKey);
        this.sessionStorage.removeItem(this.originalUrlKey);
        break;
      case 'verifier':
        this.sessionStorage.removeItem(this.verifierKey);
        break;
    }
  }

  onAuthError(error: unknown, info?: { action?: string; scope?: string }): void {
    logger.warn('OAuth error reported by SDK', {
      serverId: this.server.id,
      action: info?.action,
      scope: info?.scope,
      name: (error as Error | undefined)?.name,
      message: (error as Error | undefined)?.message,
    });
  }

  private resolveRedirectUri(): string {
    return (
      this.getConfiguredRedirectUrl() ||
      this.init.redirectUri ||
      DEFAULT_REDIRECT_URI
    );
  }

  private resolveScope(): string | undefined {
    return this.getConfiguredScope() || this.init.scope;
  }

  private get serverOverrides(): Partial<StoredServerSettings> | undefined {
    try {
      const raw = window.localStorage.getItem(DevToolsPKCEOAuthProvider.SERVER_SETTINGS_KEY);
      if (!raw) {
        return undefined;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return (parsed as Record<string, StoredServerSettings>)[this.server.id];
      }
    } catch (error) {
      logger.debug('Unable to read MCP server overrides', { error });
    }
    return undefined;
  }

  private getConfiguredRedirectUrl(): string | undefined {
    return this.serverOverrides?.oauthRedirectUrl;
  }

  private getConfiguredScope(): string | undefined {
    return this.serverOverrides?.oauthScope;
  }

  private getConfiguredClientId(): string | undefined {
    return this.serverOverrides?.oauthClientId;
  }

  private getConfiguredClientSecret(): string | undefined {
    return this.serverOverrides?.oauthClientSecret;
  }

  private async returnToOriginalUrl(): Promise<void> {
    const url = this.sessionStorage.getItem(this.originalUrlKey);
    this.sessionStorage.removeItem(this.originalUrlKey);
    if (url) {
      try {
        await this.navigate(url);
      } catch (error) {
        logger.warn('Failed returning to original page after OAuth', { serverId: this.server.id, error });
      }
    }
  }

  private async navigate(url: string): Promise<void> {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      throw new Error('navigation_failed');
    }
    const rtm = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!rtm) {
      throw new Error('navigation_failed');
    }
    const result = await rtm.navigate(url as Platform.DevToolsPath.UrlString);
    if (result.errorText) {
      throw new Error(`navigation_failed:${result.errorText}`);
    }
  }

  private currentPageUrl(): string | null {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    const rtm = target?.model(SDK.ResourceTreeModel.ResourceTreeModel);
    const frame = rtm?.mainFrame;
    return frame ? frame.url : null;
  }

  private validateState(returnedState?: string): void {
    const expected = this.sessionStorage.getItem(this.stateKey);
    if (expected && returnedState && expected !== returnedState) {
      throw new Error('oauth_invalid_state');
    }
    this.sessionStorage.removeItem(this.stateKey);
  }

  private parseAuthorizationResponse(url: string): AuthorizationParams {
    try {
      const parsed = new URL(url);
      const params = new URLSearchParams(parsed.search);
      const fragmentParams = parsed.hash ? new URLSearchParams(parsed.hash.slice(1)) : undefined;

      const combined = new URLSearchParams(params);
      if (fragmentParams) {
        fragmentParams.forEach((value, key) => combined.set(key, value));
      }

      const error = combined.get('error');
      if (error) {
        const description = combined.get('error_description');
        throw new Error(`oauth_error:${error}${description ? `:${description}` : ''}`);
      }

      const code = combined.get('code');
      if (!code) {
        throw new Error('oauth_missing_code');
      }

      const state = combined.get('state') ?? undefined;
      return { code, state };
    } catch (error) {
      if (typeof url === 'string' && url === 'urn:ietf:wg:oauth:2.0:oob') {
        throw new Error('oauth_out_of_band_not_supported');
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private isRedirectUrl(candidate: string): boolean {
    try {
      const target = new URL(candidate);
      const expected = new URL(this.resolveRedirectUri());
      if (`${target.origin}${target.pathname}` === `${expected.origin}${expected.pathname}`) {
        return true;
      }

      if (target.searchParams.has('code') && (target.hostname === 'localhost' || target.hostname === '127.0.0.1')) {
        return true;
      }

      const fallbackOrigins = [
        'https://localhost:3000/callback',
        'http://localhost:3000/callback',
        'http://127.0.0.1:3000/callback',
        'https://127.0.0.1:3000/callback',
      ];

      return fallbackOrigins.some(pattern => {
        try {
          const url = new URL(pattern);
          return `${target.origin}${target.pathname}` === `${url.origin}${url.pathname}`;
        } catch {
          return false;
        }
      });
    } catch (error) {
      if (candidate === 'urn:ietf:wg:oauth:2.0:oob') {
        return true;
      }
      logger.debug('Failed to evaluate redirect URL candidate', { candidate, error });
      return false;
    }
  }

  private randomState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

export { MCPClientSDKv2 as MCPClientV2, MCPClientSDKv2 as MCPClient };
