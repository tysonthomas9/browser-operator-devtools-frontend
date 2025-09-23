import { createLogger } from '../core/Logger.js';

const logger = createLogger('MCPConfig');

export interface MCPProviderConfig {
  id: string;
  name?: string;
  endpoint: string;
  authType: 'bearer' | 'oauth';
  enabled: boolean;
  token?: string;
  oauthClientId?: string;
  oauthRedirectUrl?: string;
  oauthScope?: string;
}

export interface MCPConfigData {
  enabled: boolean;
  providers: MCPProviderConfig[];
  toolAllowlist?: string[];
  autostart?: boolean;
  toolMode?: 'all' | 'router' | 'meta';
  maxToolsPerTurn?: number;
  maxMcpPerTurn?: number;
  autoRefreshTokens?: boolean;
  maxConnectionRetries?: number;
  retryDelayMs?: number;
  proactiveRefreshThresholdMs?: number;
}

export type MCPConfigUpdate = Partial<Omit<MCPConfigData, 'providers'>>;

const KEYS = {
  enabled: 'ai_chat_mcp_enabled',
  providers: 'ai_chat_mcp_providers',
  tokenMap: 'ai_chat_mcp_tokens_by_provider',
  allowlist: 'ai_chat_mcp_tool_allowlist',
  autostart: 'ai_chat_mcp_autostart',
  toolMode: 'ai_chat_mcp_tool_mode',
  maxToolsPerTurn: 'ai_chat_mcp_max_tools_per_turn',
  maxMcpPerTurn: 'ai_chat_mcp_max_mcp_per_turn',
  autoRefreshTokens: 'ai_chat_mcp_auto_refresh_tokens',
  maxConnectionRetries: 'ai_chat_mcp_max_connection_retries',
  retryDelayMs: 'ai_chat_mcp_retry_delay_ms',
  proactiveRefreshThresholdMs: 'ai_chat_mcp_proactive_refresh_threshold_ms',
} as const;

interface StoredProvider {
  id: string;
  name?: string;
  endpoint: string;
  authType: 'bearer' | 'oauth';
  enabled?: boolean;
  oauthClientId?: string;
  oauthRedirectUrl?: string;
  oauthScope?: string;
}

type TokenMap = Record<string, string>;

function sanitizeProvider(provider: StoredProvider, index: number): StoredProvider | null {
  if (!provider || typeof provider !== 'object') {
    return null;
  }
  const id = typeof provider.id === 'string' && provider.id.trim() ? provider.id.trim() : undefined;
  const endpoint = typeof provider.endpoint === 'string' ? provider.endpoint.trim() : '';
  const authType = provider.authType === 'oauth' ? 'oauth' : 'bearer';
  if (!id || !endpoint) {
    return null;
  }
  return {
    id,
    name: typeof provider.name === 'string' ? provider.name.trim() || undefined : undefined,
    endpoint,
    authType,
    enabled: provider.enabled !== false,
    oauthClientId: typeof provider.oauthClientId === 'string' ? provider.oauthClientId.trim() || undefined : undefined,
    oauthRedirectUrl: typeof provider.oauthRedirectUrl === 'string' ? provider.oauthRedirectUrl.trim() || undefined : undefined,
    oauthScope: typeof provider.oauthScope === 'string' ? provider.oauthScope.trim() || undefined : undefined,
  };
}

function loadProviders(): StoredProvider[] {
  try {
    const raw = localStorage.getItem(KEYS.providers);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen = new Set<string>();
    const result: StoredProvider[] = [];
    for (let i = 0; i < parsed.length; ++i) {
      const sanitized = sanitizeProvider(parsed[i] as StoredProvider, i);
      if (!sanitized) {
        continue;
      }
      if (seen.has(sanitized.id)) {
        continue;
      }
      seen.add(sanitized.id);
      result.push(sanitized);
    }
    return result;
  } catch (err) {
    logger.warn('Failed to parse MCP providers', err);
    return [];
  }
}

function saveProvidersInternal(providers: StoredProvider[]): void {
  try {
    if (!providers.length) {
      localStorage.removeItem(KEYS.providers);
    } else {
      localStorage.setItem(KEYS.providers, JSON.stringify(providers));
    }
  } catch (err) {
    logger.error('Failed to persist MCP providers', err);
  }
}

function loadTokenMap(): TokenMap {
  try {
    const raw = sessionStorage.getItem(KEYS.tokenMap);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as TokenMap;
    }
  } catch (err) {
    logger.warn('Failed to parse MCP token map', err);
  }
  sessionStorage.removeItem(KEYS.tokenMap);
  return {};
}

function saveTokenMap(tokenMap: TokenMap): void {
  try {
    if (Object.keys(tokenMap).length === 0) {
      sessionStorage.removeItem(KEYS.tokenMap);
    } else {
      sessionStorage.setItem(KEYS.tokenMap, JSON.stringify(tokenMap));
    }
  } catch (err) {
    logger.error('Failed to persist MCP token map', err);
  }
}

function sanitizeIdBase(input: string): string {
  let sanitized = input.trim().toLowerCase();
  sanitized = sanitized.replace(/[^a-z0-9_-]+/g, '-');
  sanitized = sanitized.replace(/-+/g, '-');
  sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, '');
  return sanitized || 'mcp';
}

function ensureMcpPrefix(id: string): string {
  return id.startsWith('mcp-') ? id : `mcp-${id}`;
}

function extractDomainBase(host: string): string {
  const cleanedHost = host.replace(/\.+$/, '').toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(cleanedHost)) {
    return cleanedHost;
  }
  const parts = cleanedHost.split('.').filter(Boolean);
  if (parts.length === 0) {
    return host;
  }
  if (parts.length === 1) {
    return parts[0];
  }

  const commonSecondLevel = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac']);
  const topLevel = parts[parts.length - 1];
  const secondLevel = parts[parts.length - 2];

  // Handle common country-code second-level domains like *.co.uk
  if (topLevel.length === 2 && parts.length >= 3 && commonSecondLevel.has(secondLevel)) {
    return parts[parts.length - 3];
  }

  const commonTlds = new Set(['com', 'org', 'net', 'gov', 'edu', 'io', 'ai', 'app', 'dev', 'cloud', 'info', 'biz', 'co']);
  if (commonTlds.has(topLevel) && parts.length >= 2) {
    return secondLevel;
  }

  return secondLevel;
}

export function generateMCPProviderId(provider?: { id?: string; name?: string; endpoint?: string }): string {
  // Prefer explicit ID if provided
  const explicitId = provider?.id?.trim();
  if (explicitId) {
    return ensureMcpPrefix(sanitizeIdBase(explicitId));
  }

  const name = provider?.name?.trim();
  if (name) {
    return ensureMcpPrefix(sanitizeIdBase(name));
  }

  const endpoint = provider?.endpoint?.trim();
  if (endpoint) {
    try {
      const host = new URL(endpoint).hostname;
      if (host) {
        return ensureMcpPrefix(sanitizeIdBase(extractDomainBase(host)));
      }
    } catch {
      // Fall through to using the raw endpoint if URL parsing fails
      return ensureMcpPrefix(sanitizeIdBase(endpoint));
    }
  }

  // Fallback: generate a random ID if neither name nor endpoint is available yet
  const fallback = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return ensureMcpPrefix(sanitizeIdBase(fallback));
}

export function getMCPProviders(): MCPProviderConfig[] {
  const providers = loadProviders();
  const tokenMap = loadTokenMap();
  return providers.map(provider => ({
    ...provider,
    enabled: provider.enabled !== false,
    token: tokenMap[provider.id],
  }));
}

export function saveMCPProviders(providers: MCPProviderConfig[]): void {
  // Get existing providers to identify which ones are being removed
  const existingProviders = loadProviders();
  const existingIds = new Set(existingProviders.map(p => p.id));

  const sanitizedProviders: StoredProvider[] = [];
  const newTokenMap: TokenMap = {};
  const newIds = new Set<string>();
  const seenIds = new Set<string>();

  for (const provider of providers) {
    const id = generateMCPProviderId(provider);
    const endpoint = provider.endpoint?.trim();
    if (!endpoint) {
      continue;
    }
    const authType: 'bearer' | 'oauth' = provider.authType === 'oauth' ? 'oauth' : 'bearer';

    if (seenIds.has(id)) {
      throw new Error(`Duplicate MCP connection identifier: ${id}. Please use unique names or endpoints.`);
    }
    seenIds.add(id);
    newIds.add(id);

    sanitizedProviders.push({
      id,
      name: provider.name?.trim() || undefined,
      endpoint,
      authType,
      enabled: provider.enabled !== false,
      oauthClientId: provider.oauthClientId?.trim() || undefined,
      oauthRedirectUrl: provider.oauthRedirectUrl?.trim() || undefined,
      oauthScope: provider.oauthScope?.trim() || undefined,
    });

    if (authType === 'bearer' && provider.token) {
      newTokenMap[id] = provider.token;
    }
  }

  // Clean up OAuth data for removed providers
  for (const existingId of existingIds) {
    if (!newIds.has(existingId)) {
      cleanupOAuthData(existingId);
    }
  }

  saveProvidersInternal(sanitizedProviders);
  saveTokenMap(newTokenMap);
  dispatchMCPConfigChanged();
}

export function getMCPConfig(): MCPConfigData {
  try {
    const enabled = localStorage.getItem(KEYS.enabled) !== 'false'; // Default: true
    const providers = getMCPProviders();

    let toolAllowlist: string[] | undefined;
    const rawAllowlist = localStorage.getItem(KEYS.allowlist);
    if (rawAllowlist) {
      try {
        const parsed = JSON.parse(rawAllowlist);
        if (Array.isArray(parsed)) {
          toolAllowlist = parsed.filter(item => typeof item === 'string');
        }
      } catch {
        toolAllowlist = undefined;
      }
    }

    const autostart = localStorage.getItem(KEYS.autostart) === 'true';
    const toolMode = (localStorage.getItem(KEYS.toolMode) as MCPConfigData['toolMode']) || 'all';
    const maxToolsPerTurn = parseInt(localStorage.getItem(KEYS.maxToolsPerTurn) || '50', 10);
    const maxMcpPerTurn = parseInt(localStorage.getItem(KEYS.maxMcpPerTurn) || '50', 10);

    // New auto-refresh and retry configuration options with defaults
    const autoRefreshTokens = localStorage.getItem(KEYS.autoRefreshTokens) !== 'false'; // Default: true
    const maxConnectionRetries = parseInt(localStorage.getItem(KEYS.maxConnectionRetries) || '3', 10);
    const retryDelayMs = parseInt(localStorage.getItem(KEYS.retryDelayMs) || '1000', 10);
    const proactiveRefreshThresholdMs = parseInt(localStorage.getItem(KEYS.proactiveRefreshThresholdMs) || '300000', 10); // 5 minutes

    return {
      enabled,
      providers,
      toolAllowlist,
      autostart,
      toolMode,
      maxToolsPerTurn,
      maxMcpPerTurn,
      autoRefreshTokens,
      maxConnectionRetries,
      retryDelayMs,
      proactiveRefreshThresholdMs,
    };
  } catch (err) {
    logger.error('Failed to load MCP config', err);
    return { enabled: false, providers: [] };
  }
}

export function setMCPConfig(config: MCPConfigUpdate): void {
  try {
    if (config.enabled !== undefined) {
      localStorage.setItem(KEYS.enabled, String(!!config.enabled));
    }
    if (config.toolAllowlist) {
      localStorage.setItem(KEYS.allowlist, JSON.stringify(config.toolAllowlist));
    }
    if (config.autostart !== undefined) {
      localStorage.setItem(KEYS.autostart, String(!!config.autostart));
    }
    if (config.toolMode !== undefined) {
      localStorage.setItem(KEYS.toolMode, config.toolMode);
    }
    if (config.maxToolsPerTurn !== undefined) {
      localStorage.setItem(KEYS.maxToolsPerTurn, String(config.maxToolsPerTurn));
    }
    if (config.maxMcpPerTurn !== undefined) {
      localStorage.setItem(KEYS.maxMcpPerTurn, String(config.maxMcpPerTurn));
    }
    if (config.autoRefreshTokens !== undefined) {
      localStorage.setItem(KEYS.autoRefreshTokens, String(!!config.autoRefreshTokens));
    }
    if (config.maxConnectionRetries !== undefined) {
      localStorage.setItem(KEYS.maxConnectionRetries, String(config.maxConnectionRetries));
    }
    if (config.retryDelayMs !== undefined) {
      localStorage.setItem(KEYS.retryDelayMs, String(config.retryDelayMs));
    }
    if (config.proactiveRefreshThresholdMs !== undefined) {
      localStorage.setItem(KEYS.proactiveRefreshThresholdMs, String(config.proactiveRefreshThresholdMs));
    }
  } catch (err) {
    logger.error('Failed to save MCP config', err);
  } finally {
    dispatchMCPConfigChanged();
  }
}

export function isMCPEnabled(): boolean {
  return getMCPConfig().enabled;
}

export function onMCPConfigChange(handler: () => void): () => void {
  const cb = () => handler();
  window.addEventListener('ai_chat_mcp_config_changed', cb);
  return () => window.removeEventListener('ai_chat_mcp_config_changed', cb);
}

function dispatchMCPConfigChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent('ai_chat_mcp_config_changed'));
  } catch (err) {
    logger.warn('Failed to dispatch MCP config change event', err);
  }
}

/**
 * Interface for stored authentication error details
 */
export interface StoredAuthError {
  message: string;
  type: 'authentication' | 'network' | 'configuration' | 'server_error' | 'unknown';
  timestamp: number;
  serverId: string;
}

/**
 * Get stored authentication errors for all MCP providers
 */
export function getStoredAuthErrors(): StoredAuthError[] {
  const errors: StoredAuthError[] = [];
  const providers = getMCPProviders();

  for (const provider of providers) {
    if (provider.authType === 'oauth') {
      try {
        const prefix = `mcp_oauth:${provider.id}:`;
        const message = localStorage.getItem(`${prefix}last_auth_error`);
        const timestampStr = localStorage.getItem(`${prefix}auth_error_timestamp`);
        const type = localStorage.getItem(`${prefix}auth_error_type`);

        if (message && timestampStr && type) {
          const timestamp = parseInt(timestampStr, 10);
          if (!isNaN(timestamp)) {
            errors.push({
              message,
              type: type as StoredAuthError['type'],
              timestamp,
              serverId: provider.id,
            });
          }
        }
      } catch (err) {
        logger.warn('Failed to retrieve stored auth error for provider', { providerId: provider.id, err });
      }
    }
  }

  return errors;
}

/**
 * Clear stored authentication error for a specific provider
 */
export function clearStoredAuthError(serverId: string): void {
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
 * Check if any OAuth providers have stored authentication errors
 */
export function hasStoredAuthErrors(): boolean {
  return getStoredAuthErrors().length > 0;
}

/**
 * Clean up all OAuth-related data for a specific provider
 */
export function cleanupOAuthData(serverId: string): void {
  try {
    const prefix = `mcp_oauth:${serverId}:`;
    const keysToRemove = [
      'tokens',
      'client_info',
      'code_verifier',
      'state',
      'original_url',
      'last_auth_error',
      'auth_error_timestamp',
      'auth_error_type',
      'token_expiration',
    ];

    for (const key of keysToRemove) {
      localStorage.removeItem(`${prefix}${key}`);
    }

    logger.info('Cleaned up OAuth data for provider', { serverId });
  } catch (err) {
    logger.warn('Failed to clean up OAuth data', { serverId, err });
  }
}
