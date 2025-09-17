// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {
  OAuthClientProvider,
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthTokens,
} from './dist/esm/client/auth.js';
import type { AuthorizationServerMetadata } from './dist/esm/shared/auth.js';

import * as SDK from '../../core/sdk/sdk.js';
import * as Platform from '../../core/platform/platform.js';

// Minimal MCP server descriptor used by the provider for namespacing
export interface MCPOAuthServerDescriptor {
  id: string;
  endpoint: string;
}

/**
 * DevTools OAuth provider for MCP SDK (browser-based, OpenRouter-style flow).
 *
 * - Navigates the inspected page to the provider's authorization URL
 * - Monitors URL changes to capture the authorization code on redirect
 * - Returns the user to the original page afterwards
 * - Persists tokens and optional client registration per MCP server id
 */
export class MCPOAuthProvider implements OAuthClientProvider {
  // Use the same callback convention as OpenRouter flow
  private static readonly DEFAULT_REDIRECT_URI = 'https://localhost:3000/callback';

  // Storage keys are namespaced by server id
  private readonly TOKENS_KEY: string;
  private readonly CLIENT_INFO_KEY: string;
  private readonly CODE_VERIFIER_KEY: string;
  private readonly STATE_KEY: string;
  private readonly ORIGINAL_URL_KEY: string;

  private urlChangeCleanup: (() => void) | null = null;

  constructor(private readonly server: MCPOAuthServerDescriptor,
              private readonly metadata: Partial<OAuthClientMetadata> = {}) {
    const prefix = `mcp_oauth:${server.id}:`;
    this.TOKENS_KEY = `${prefix}tokens`;
    this.CLIENT_INFO_KEY = `${prefix}client_info`;
    this.CODE_VERIFIER_KEY = `${prefix}code_verifier`;
    this.STATE_KEY = `${prefix}state`;
    this.ORIGINAL_URL_KEY = `${prefix}original_url`;
  }

  get redirectUrl(): string | URL {
    return MCPOAuthProvider.DEFAULT_REDIRECT_URI;
  }

  get clientMetadata(): OAuthClientMetadata {
    const redirect = String(this.redirectUrl);
    return {
      redirect_uris: [redirect],
      client_name: 'browseroperator',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: this.metadata.scope ?? 'offline_access',
      token_endpoint_auth_method: this.metadata.token_endpoint_auth_method,
    };
  }

  // Optional state support; we save and later validate on callback
  state(): string {
    const state = this.randomState();
    sessionStorage.setItem(this.STATE_KEY, state);
    return state;
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const raw = localStorage.getItem(this.CLIENT_INFO_KEY);
    return raw ? JSON.parse(raw) as OAuthClientInformation : undefined;
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    localStorage.setItem(this.CLIENT_INFO_KEY, JSON.stringify(info));
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const raw = sessionStorage.getItem(this.TOKENS_KEY);
    return raw ? JSON.parse(raw) as OAuthTokens : undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    sessionStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    sessionStorage.setItem(this.CODE_VERIFIER_KEY, verifier);
  }

  async codeVerifier(): Promise<string> {
    const v = sessionStorage.getItem(this.CODE_VERIFIER_KEY);
    if (!v) {
      throw new Error('Missing PKCE code verifier');
    }
    return v;
  }

  // Optional: allow consumers to customize client authentication per token request
  async addClientAuthentication(_headers: Headers, _params: URLSearchParams, _url: string | URL, _metadata?: AuthorizationServerMetadata): Promise<void> {
    // Default no-op. The SDK will apply one of the standard methods based on server metadata.
  }

  // Provider-directed redirect: navigate inspected page, set up monitoring externally
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Store original page URL to return to later
    const original = this.currentPageUrl();
    if (original) {
      sessionStorage.setItem(this.ORIGINAL_URL_KEY, original);
    }
    // Navigate main frame to provider auth URL
    await this.navigate(String(authorizationUrl));
  }

  // Utility exposed to orchestrators: wait until the inspected page hits redirectUrl and return the code
  async waitForAuthorizationCode(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListeners();
        reject(new Error('oauth_timeout'));
      }, 5 * 60 * 1000);

      const maybeHandleUrl = async (url: string): Promise<boolean> => {
        if (!this.isRedirectUrl(url)) {
          return false;
        }
        try {
          const { code, state } = this.parseAuthCallback(url);
          const expected = sessionStorage.getItem(this.STATE_KEY);
          if (expected && state && expected !== state) {
            throw new Error('oauth_invalid_state');
          }
          // Cleanup state now that we used it
          sessionStorage.removeItem(this.STATE_KEY);
          // Return user to original page
          await this.returnToOriginalUrl();
          clearTimeout(timeout);
          this.removeListeners();
          resolve(code);
          return true;
        } catch (e) {
          clearTimeout(timeout);
          this.removeListeners();
          reject(e instanceof Error ? e : new Error(String(e)));
          return true;
        }
      };

      const targetsListener = async (event: SDK.TargetManager.TargetManagerEvent<SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED>) => {
        try {
          const targetInfos = event.data as Array<{url?: string}>;
          for (const info of targetInfos) {
            if (info.url && await maybeHandleUrl(info.url)) {
              return;
            }
          }
        } catch {
          // ignore
        }
      };
      const urlListener = async () => {
        const url = this.currentPageUrl();
        if (url) {
          await maybeHandleUrl(url);
        }
      };

      this.urlChangeCleanup = () => {
        SDK.TargetManager.TargetManager.instance().removeEventListener(
          SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED, targetsListener);
        SDK.TargetManager.TargetManager.instance().removeEventListener(
          SDK.TargetManager.Events.INSPECTED_URL_CHANGED, urlListener);
      };

      SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.AVAILABLE_TARGETS_CHANGED, targetsListener);
      SDK.TargetManager.TargetManager.instance().addEventListener(
        SDK.TargetManager.Events.INSPECTED_URL_CHANGED, urlListener);
    });
  }

  // Helpers
  private removeListeners(): void {
    if (this.urlChangeCleanup) {
      this.urlChangeCleanup();
      this.urlChangeCleanup = null;
    }
  }

  private currentPageUrl(): string | null {
    const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
    if (!target) {
      return null;
    }
    const rtm = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    const frame = rtm?.mainFrame;
    return frame ? frame.url : null;
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

  private async returnToOriginalUrl(): Promise<void> {
    const url = sessionStorage.getItem(this.ORIGINAL_URL_KEY);
    sessionStorage.removeItem(this.ORIGINAL_URL_KEY);
    if (url) {
      try {
        await this.navigate(url);
      } catch {
        // ignore
      }
    }
  }

  private isRedirectUrl(candidate: string): boolean {
    try {
      const cb = new URL(String(this.redirectUrl));
      const u = new URL(candidate);
      return `${u.origin}${u.pathname}` === `${cb.origin}${cb.pathname}`;
    } catch {
      return false;
    }
  }

  private parseAuthCallback(url: string): { code: string; state?: string } {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state') ?? undefined;
    if (!code) {
      throw new Error('oauth_missing_code');
    }
    return { code, state };
  }

  private randomState(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

