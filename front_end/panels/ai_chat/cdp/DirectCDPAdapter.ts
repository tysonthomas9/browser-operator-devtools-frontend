/**
 * Direct CDP Adapter - Wraps direct CDP connections for Node.js/eval runner context
 *
 * This adapter works with any CDP client that implements a simple send() interface:
 * - chrome-remote-interface
 * - Puppeteer CDPSession
 * - Raw WebSocket wrapper
 *
 * This allows shared tool implementations to work outside of DevTools.
 */

import type {CDPSessionAdapter, CDPAgent} from './CDPSessionAdapter.js';

/**
 * Interface for any CDP client that can send commands
 * This is compatible with:
 * - chrome-remote-interface (client.send(method, params))
 * - Puppeteer CDPSession (session.send(method, params))
 */
export interface CDPClient {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Creates a CDPAgent for a specific domain using a CDP client
 */
function createDomainAgent(client: CDPClient, domain: string): CDPAgent {
  return {
    async invoke<T>(method: string, params?: Record<string, unknown>): Promise<T> {
      const fullMethod = `${domain}.${method}`;
      try {
        const result = await client.send(fullMethod, params || {});
        return result as T;
      } catch (error) {
        // Normalize error messages across different CDP clients
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`CDP ${fullMethod} failed: ${message}`);
      }
    },
  };
}

/**
 * DirectCDPAdapter implements CDPSessionAdapter for direct CDP connections
 *
 * Usage with chrome-remote-interface:
 * ```typescript
 * import CDP from 'chrome-remote-interface';
 * const client = await CDP({ port: 9222 });
 * const adapter = new DirectCDPAdapter(client, 'https://example.com');
 * ```
 *
 * Usage with Puppeteer:
 * ```typescript
 * const cdpSession = await page.createCDPSession();
 * const adapter = new DirectCDPAdapter(cdpSession, page.url());
 * ```
 */
export class DirectCDPAdapter implements CDPSessionAdapter {
  private readonly client: CDPClient;
  private readonly url: string|undefined;

  constructor(client: CDPClient, url?: string) {
    this.client = client;
    this.url = url;
  }

  domAgent(): CDPAgent {
    return createDomainAgent(this.client, 'DOM');
  }

  runtimeAgent(): CDPAgent {
    return createDomainAgent(this.client, 'Runtime');
  }

  pageAgent(): CDPAgent {
    return createDomainAgent(this.client, 'Page');
  }

  accessibilityAgent(): CDPAgent {
    return createDomainAgent(this.client, 'Accessibility');
  }

  inputAgent(): CDPAgent {
    return createDomainAgent(this.client, 'Input');
  }

  inspectedURL(): string|undefined {
    return this.url;
  }

  async send<T>(domain: string, method: string, params?: Record<string, unknown>): Promise<T> {
    const fullMethod = `${domain}.${method}`;
    try {
      const result = await this.client.send(fullMethod, params || {});
      return result as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`CDP ${fullMethod} failed: ${message}`);
    }
  }

  /**
   * Get the underlying CDP client for cases where direct access is needed
   */
  getClient(): CDPClient {
    return this.client;
  }

  /**
   * Update the URL (useful after navigation)
   */
  setURL(url: string): DirectCDPAdapter {
    return new DirectCDPAdapter(this.client, url);
  }
}
