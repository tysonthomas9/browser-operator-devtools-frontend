import { createLogger } from '../core/Logger.js';

const logger = createLogger('MCPConfig');

export interface MCPConfigData {
  enabled: boolean;
  endpoint?: string; // MVP: single endpoint; Phase 2 can support multiple
  token?: string;
  authType?: 'bearer' | 'oauth';
  oauthClientId?: string;
  oauthRedirectUrl?: string;
  oauthScope?: string;
  toolAllowlist?: string[];
  autostart?: boolean;
  toolMode?: 'all' | 'router' | 'meta';
  maxToolsPerTurn?: number;
  maxMcpPerTurn?: number;
}

const KEYS = {
  enabled: 'ai_chat_mcp_enabled',
  endpoint: 'ai_chat_mcp_endpoint',
  authType: 'ai_chat_mcp_auth_type',
  serverSettings: 'ai_chat_mcp_server_settings',
  tokenMap: 'ai_chat_mcp_tokens_by_server',
  allowlist: 'ai_chat_mcp_tool_allowlist',
  autostart: 'ai_chat_mcp_autostart',
  toolMode: 'ai_chat_mcp_tool_mode',
  maxToolsPerTurn: 'ai_chat_mcp_max_tools_per_turn',
  maxMcpPerTurn: 'ai_chat_mcp_max_mcp_per_turn',
} as const;

interface StoredServerSettings {
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthRedirectUrl?: string;
  oauthScope?: string;
}

type ServerSettingsMap = Record<string, StoredServerSettings>;
type TokenMap = Record<string, string>;

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; ++i) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildServerId(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const hostPart = url.host.replace(/[^a-z0-9]+/gi, '-');
    const pathPart = url.pathname.replace(/[^a-z0-9]+/gi, '-');
    const searchPart = url.search
      ? url.search.replace(/[^a-z0-9]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : '';
    const combined = `${hostPart}${pathPart ? `-${pathPart}` : ''}${searchPart ? `-${searchPart}` : ''}`
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    if (combined) {
      return combined;
    }
  } catch {
    // fall through to hashed id
  }
  return `srv-${stableHash(endpoint)}`;
}

function loadServerSettings(): ServerSettingsMap {
  try {
    const raw = localStorage.getItem(KEYS.serverSettings);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as ServerSettingsMap;
    }
  } catch (err) {
    logger.warn('Failed to parse MCP server settings', err);
  }
  localStorage.removeItem(KEYS.serverSettings);
  return {};
}

function saveServerSettings(settings: ServerSettingsMap): void {
  try {
    if (Object.keys(settings).length === 0) {
      localStorage.removeItem(KEYS.serverSettings);
    } else {
      localStorage.setItem(KEYS.serverSettings, JSON.stringify(settings));
    }
  } catch (err) {
    logger.error('Failed to persist MCP server settings', err);
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

export function getMCPConfig(): MCPConfigData {
  try {
    const enabled = localStorage.getItem(KEYS.enabled) === 'true';
    const endpoint = localStorage.getItem(KEYS.endpoint) || undefined;
    const serverId = endpoint ? buildServerId(endpoint) : undefined;

    const tokenMap = loadTokenMap();
    const serverSettings = serverId ? loadServerSettings()[serverId] : undefined;

    const token = serverId ? tokenMap[serverId] : undefined;
    const authType = (localStorage.getItem(KEYS.authType) as MCPConfigData['authType']) || 'bearer';
    const oauthClientId = serverSettings?.oauthClientId;
    const oauthRedirectUrl = serverSettings?.oauthRedirectUrl;
    const oauthScope = serverSettings?.oauthScope;

    let toolAllowlist: string[] | undefined;
    const raw = localStorage.getItem(KEYS.allowlist);
    if (raw) {
      try { toolAllowlist = JSON.parse(raw); } catch { toolAllowlist = undefined; }
    }
    const autostart = localStorage.getItem(KEYS.autostart) === 'true';
    const toolMode = (localStorage.getItem(KEYS.toolMode) as MCPConfigData['toolMode']) || 'router';
    const maxToolsPerTurn = parseInt(localStorage.getItem(KEYS.maxToolsPerTurn) || '20', 10);
    const maxMcpPerTurn = parseInt(localStorage.getItem(KEYS.maxMcpPerTurn) || '8', 10);
    return { enabled, endpoint, token, authType, oauthClientId, oauthRedirectUrl, oauthScope, toolAllowlist, autostart, toolMode, maxToolsPerTurn, maxMcpPerTurn };
  } catch (err) {
    logger.error('Failed to load MCP config', err);
    return { enabled: false };
  }
}

export function setMCPConfig(config: MCPConfigData): void {
  try {
    localStorage.setItem(KEYS.enabled, String(!!config.enabled));
    if (config.endpoint !== undefined) {
      if (config.endpoint) {
        localStorage.setItem(KEYS.endpoint, config.endpoint);
      } else {
        localStorage.removeItem(KEYS.endpoint);
      }
    }

    const endpoint = config.endpoint !== undefined ? config.endpoint : (localStorage.getItem(KEYS.endpoint) || undefined);
    const serverId = endpoint ? buildServerId(endpoint) : undefined;
    const tokenMap = loadTokenMap();

    if (serverId) {
      const serverSettings = loadServerSettings();
      const entry: StoredServerSettings = { ...serverSettings[serverId] };
      const applySetting = (key: keyof StoredServerSettings, value: string | undefined) => {
        if (value !== undefined) {
          if (value) {
            entry[key] = value;
          } else {
            delete entry[key];
          }
        }
      };

      applySetting('oauthClientId', config.oauthClientId);
      applySetting('oauthRedirectUrl', config.oauthRedirectUrl);
      applySetting('oauthScope', config.oauthScope);

      if (Object.keys(entry).length > 0) {
        serverSettings[serverId] = entry;
      } else {
        delete serverSettings[serverId];
      }
      saveServerSettings(serverSettings);
    }

    if (serverId && config.token !== undefined) {
      if (config.token) {
        tokenMap[serverId] = config.token;
      } else {
        delete tokenMap[serverId];
      }
      saveTokenMap(tokenMap);
    }

    if (config.authType !== undefined) {
      localStorage.setItem(KEYS.authType, config.authType);
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
