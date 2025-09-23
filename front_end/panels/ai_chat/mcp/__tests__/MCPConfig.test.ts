// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { generateMCPProviderId, saveMCPProviders, cleanupOAuthData, getMCPProviders, type MCPProviderConfig } from '../MCPConfig.js';


class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('MCPConfig ID generation', () => {
  let localStorageStub: MemoryStorage;
  let sessionStorageStub: MemoryStorage;

  beforeEach(() => {
    localStorageStub = new MemoryStorage();
    sessionStorageStub = new MemoryStorage();

    Object.defineProperty(window, 'localStorage', {
      value: localStorageStub,
      configurable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageStub,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorageStub.clear();
    sessionStorageStub.clear();
  });

  describe('generateMCPProviderId', () => {
    it('prefers explicit IDs and sanitizes them', () => {
      const id = generateMCPProviderId({ id: ' Custom-ID ' });
      assert.strictEqual(id, 'mcp-custom-id');
    });

    it('derives IDs from provider names', () => {
      const id = generateMCPProviderId({ name: ' OpenRouter ++ ' });
      assert.strictEqual(id, 'mcp-openrouter');
    });

    it('derives IDs from subdomain hosts by using the domain base', () => {
      const id = generateMCPProviderId({ endpoint: 'https://mcp.notion.com/mcp' });
      assert.strictEqual(id, 'mcp-notion');
    });

    it('handles common country-code second-level domains', () => {
      const id = generateMCPProviderId({ endpoint: 'https://api.tools.co.uk/service' });
      assert.strictEqual(id, 'mcp-api');
    });

    it('falls back to sanitized endpoint when URL parsing fails', () => {
      const id = generateMCPProviderId({ endpoint: 'invalid host value' });
      assert.strictEqual(id.startsWith('mcp-'), true);
    });
  });

  describe('saveMCPProviders duplicate detection', () => {
    it('throws when two providers resolve to the same derived ID', () => {
      const providers: MCPProviderConfig[] = [
        {
          id: '',
          name: 'Notion',
          endpoint: 'https://mcp.notion.com/api',
          authType: 'oauth',
          enabled: true,
        },
        {
          id: '',
          name: undefined,
          endpoint: 'https://another.notion.com/v1',
          authType: 'oauth',
          enabled: true,
        },
      ];

      assert.throws(() => saveMCPProviders(providers), /Duplicate MCP connection identifier: mcp-notion/);
    });
  });

  describe('OAuth cleanup', () => {
    it('cleanupOAuthData removes all OAuth-related localStorage keys', () => {
      const serverId = 'mcp-test';
      const prefix = `mcp_oauth:${serverId}:`;

      // Set up some OAuth data in localStorage
      localStorageStub.setItem(`${prefix}tokens`, '{"access_token":"test"}');
      localStorageStub.setItem(`${prefix}client_info`, '{"client_id":"test"}');
      localStorageStub.setItem(`${prefix}last_auth_error`, 'test error');
      localStorageStub.setItem(`${prefix}auth_error_timestamp`, '123456789');

      // Verify data exists
      assert.strictEqual(localStorageStub.getItem(`${prefix}tokens`), '{"access_token":"test"}');
      assert.strictEqual(localStorageStub.getItem(`${prefix}client_info`), '{"client_id":"test"}');

      // Clean up OAuth data
      cleanupOAuthData(serverId);

      // Verify all OAuth data is removed
      assert.strictEqual(localStorageStub.getItem(`${prefix}tokens`), null);
      assert.strictEqual(localStorageStub.getItem(`${prefix}client_info`), null);
      assert.strictEqual(localStorageStub.getItem(`${prefix}last_auth_error`), null);
      assert.strictEqual(localStorageStub.getItem(`${prefix}auth_error_timestamp`), null);
    });

    it('saveMCPProviders cleans up OAuth data for removed providers', () => {
      // Set up existing providers
      const existingProviders: MCPProviderConfig[] = [
        {
          id: 'mcp-provider1',
          endpoint: 'https://api1.example.com',
          authType: 'oauth',
          enabled: true,
        },
        {
          id: 'mcp-provider2',
          endpoint: 'https://api2.example.com',
          authType: 'oauth',
          enabled: true,
        },
      ];

      // Save existing providers to set up state
      saveMCPProviders(existingProviders);

      // Add OAuth data for both providers
      localStorageStub.setItem('mcp_oauth:mcp-provider1:tokens', '{"access_token":"token1"}');
      localStorageStub.setItem('mcp_oauth:mcp-provider2:tokens', '{"access_token":"token2"}');

      // Verify OAuth data exists
      assert.strictEqual(localStorageStub.getItem('mcp_oauth:mcp-provider1:tokens'), '{"access_token":"token1"}');
      assert.strictEqual(localStorageStub.getItem('mcp_oauth:mcp-provider2:tokens'), '{"access_token":"token2"}');

      // Save providers with only provider1 (remove provider2)
      const newProviders: MCPProviderConfig[] = [
        {
          id: 'mcp-provider1',
          endpoint: 'https://api1.example.com',
          authType: 'oauth',
          enabled: true,
        },
      ];

      saveMCPProviders(newProviders);

      // Verify provider1's OAuth data still exists
      assert.strictEqual(localStorageStub.getItem('mcp_oauth:mcp-provider1:tokens'), '{"access_token":"token1"}');

      // Verify provider2's OAuth data was cleaned up
      assert.strictEqual(localStorageStub.getItem('mcp_oauth:mcp-provider2:tokens'), null);
    });
  });
});
