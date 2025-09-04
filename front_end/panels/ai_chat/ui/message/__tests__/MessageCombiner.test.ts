// Copyright 2025 The Chromium Authors.

import {combineMessages} from '../MessageCombiner.js';
// Local minimal enum to avoid importing TypeScript enums from ChatTypes in strip-only mode
const ChatMessageEntity = {
  USER: 'user',
  MODEL: 'model',
  TOOL_RESULT: 'tool_result',
  AGENT_SESSION: 'agent_session',
} as const;
type ChatMessage = any;

describe('MessageCombiner', () => {
  it('combines adjacent tool call and result by toolCallId', () => {
    const messages: ChatMessage[] = [
      { entity: ChatMessageEntity.USER, text: 'Go' } as any,
      { entity: ChatMessageEntity.MODEL, action: 'tool', toolName: 'fetch', toolCallId: 'id-1', isFinalAnswer: false } as any,
      { entity: ChatMessageEntity.TOOL_RESULT, toolName: 'fetch', toolCallId: 'id-1', resultText: '{"ok":true}', isError: false } as any,
      { entity: ChatMessageEntity.MODEL, action: 'final', answer: 'Done', isFinalAnswer: true } as any,
    ];

    const combined = combineMessages(messages);
    assert.lengthOf(combined, 3);
    assert.strictEqual((combined[1] as any).combined, true);
    assert.strictEqual((combined[1] as any).resultText, '{"ok":true}');
  });

  it('marks orphaned tool results', () => {
    const messages: ChatMessage[] = [
      { entity: ChatMessageEntity.TOOL_RESULT, toolName: 'scan', resultText: 'x', isError: false } as any,
    ];
    const combined = combineMessages(messages);
    assert.lengthOf(combined, 1);
    assert.isTrue((combined[0] as any).orphaned);
  });
});
