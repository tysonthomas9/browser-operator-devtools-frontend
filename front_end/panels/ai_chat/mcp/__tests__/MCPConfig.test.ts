// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { generateMCPProviderId, saveMCPProviders, type MCPProviderConfig } from '../MCPConfig.js';


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
});
