// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createToolExecutorNode } from './AgentNodes.js';
import type { AgentState } from './State.js';
import type { Tool } from '../tools/Tools.js';
import { ChatMessageEntity } from '../models/ChatTypes.js';

/* eslint-env mocha */

class RecordingTool implements Tool<Record<string, unknown>, unknown> {
  public calls = 0;
  constructor(public name: string) {}
  description = 'records calls';
  schema = { type: 'object', properties: {} };
  async execute(_args: Record<string, unknown>): Promise<unknown> {
    this.calls += 1;
    return { ok: true, executed: this.name };
  }
}

describe('AgentNodes sanitized tool name mapping', () => {
  let mockLocalStorage: Map<string, string>;

  beforeEach(() => {
    // Mock localStorage in case anything touches it
    mockLocalStorage = new Map();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => mockLocalStorage.get(key) || null,
        setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
        removeItem: (key: string) => mockLocalStorage.delete(key),
        clear: () => mockLocalStorage.clear(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('resolves sanitized model tool names back to actual tool instances for execution', async () => {
    // Original tool name contains invalid chars for LLM function calling
    const originalName = 'mcp:default:alpha';
    const sanitizedName = 'mcp_default_alpha';
    const tool = new RecordingTool(originalName);

    const state: AgentState = {
      messages: [
        {
          entity: ChatMessageEntity.MODEL,
          action: 'tool',
          toolName: sanitizedName,
          toolArgs: { x: 1 },
          toolCallId: 'call-1',
          isFinalAnswer: false,
        } as any
      ],
      agentType: 'deep-research' as any,
      context: {
        selectedToolNames: [sanitizedName],
        selectedTools: [tool],
        toolNameMap: { [sanitizedName]: originalName }
      }
    } as any;

    const node = createToolExecutorNode(state, 'openai', 'gpt-4', 'gpt-4-mini', 'gpt-4-mini');
    const result = await node.invoke(state);
    
    // Tool execute should have been called once
    assert.strictEqual(tool.calls, 1);

    // Should append a tool result message
    const last = result.messages[result.messages.length - 1];
    assert.strictEqual(last.entity, ChatMessageEntity.TOOL_RESULT);
    assert.strictEqual((last as any).toolName, sanitizedName);
    assert.ok((last as any).resultText);
  });
});
