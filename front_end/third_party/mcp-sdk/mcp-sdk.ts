// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Client as MCPSDKClient } from './dist/esm/client/index.js';
import { SSEClientTransport } from './dist/esm/client/sse.js';
import { StreamableHTTPClientTransport } from './dist/esm/client/streamableHttp.js';
import type { Transport } from './dist/esm/shared/transport.js';
import { JSONRPCMessageSchema, type JSONRPCMessage } from './dist/esm/types.js';

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
    transport = new StreamableHTTPClientTransport(new URL(server.endpoint), {
      requestInit: server.token ? {
        headers: { 'Authorization': `Bearer ${server.token}` }
      } : undefined,
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
      // Try SSE fallback if Streamable HTTP connect fails
      logger.warn('Streamable HTTP connect failed, retrying with SSE', { endpoint: server.endpoint, error });
      try {
        const sseTransport = new SSEClientTransport(new URL(server.endpoint));
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
