// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type { Tool } from '../tools/Tool.js';
import { createLogger } from '../observability/Logger.js';

const logger = createLogger('MCPToolAdapter');

// Temporary types until we have proper MCP SDK types
export interface MCPClient {
  callTool(serverId: string, toolName: string, args: Record<string, unknown>, options?: { timeoutMs?: number }): Promise<unknown>;
  isConnected(serverId: string): boolean;
  connect(config: any): Promise<void>;
  disconnect(serverId: string): void;
  listTools(serverId: string): Promise<MCPToolDef[]>;
}

export interface MCPToolDef {
  name: string;
  description: string;
  inputSchema: any;
}

export class MCPToolAdapter implements Tool<Record<string, unknown>, unknown> {
  name: string;
  description: string;
  schema: any;

  constructor(
    private serverId: string,
    private client: MCPClient,
    private def: MCPToolDef,
    private displayName?: string,
  ) {
    this.name = this.displayName || def.name;
    this.description = def.description;
    // Pass through the MCP tool's input schema as-is. MCP servers provide a valid JSON Schema
    // for the tool arguments (type: 'object', properties: { ... }, required: [...] ).
    // The LLM providers expect a proper JSON Schema at the `parameters` field, not nested under `properties`.
    // If the schema is missing or malformed, fall back to a minimal object schema.
    const schema = def.inputSchema as any;
    if (schema && typeof schema === 'object') {
      this.schema = schema;
    } else {
      this.schema = { type: 'object', properties: {} };
    }
  }

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const sanitized = this.sanitize(args);
    logger.info('Executing MCP tool', { name: this.name, serverId: this.serverId, args: sanitized });
    return this.client.callTool(this.serverId, this.def.name, args, { timeoutMs: 30000 });
  }

  // Expose metadata for discovery/search
  getServerId(): string { return this.serverId; }
  getOriginalToolName(): string { return this.def.name; }

  private sanitize(input: Record<string, unknown>): Record<string, unknown> {
    const sensitive = ['token', 'api_key', 'password', 'secret', 'authorization'];
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input || {})) {
      if (typeof v === 'string' && sensitive.some(s => k.toLowerCase().includes(s))) {
        out[k] = '[redacted]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
