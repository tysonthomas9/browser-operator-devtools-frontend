// Copyright 2025 The Chromium Authors.

import '../ChatView.js';
import {raf} from '../../../../testing/DOMHelpers.js';

// Use global sinon provided by Karma framework
declare const sinon: typeof import('sinon');

// Helper to stub fetch for VersionChecker network calls
function stubFetch(): sinon.SinonStub {
  return sinon.stub(globalThis, 'fetch').resolves(new Response(JSON.stringify({
    tag_name: 'v1.0.0',
    html_url: 'https://example.com/release',
    body: 'Test release',
  }), { status: 200 }));
}

// Minimal local enum constants to avoid importing TS enums in tests
const ChatMessageEntity = {
  USER: 'user',
  AGENT_SESSION: 'agent_session',
} as const;

function makeAgentSessionMessage(sessionId: string): any {
  return {
    entity: ChatMessageEntity.AGENT_SESSION,
    agentSession: {
      sessionId,
      agentName: 'TestAgent',
      config: {},
      messages: [],
    },
  } as any;
}

describe('ChatView pruneLiveAgentSessions', () => {
  let fetchStub: sinon.SinonStub;
  beforeEach(() => { fetchStub = stubFetch(); });
  afterEach(() => { fetchStub.restore(); });

  it('prunes cached sessions when they disappear from messages', async () => {
    const view = document.createElement('devtools-chat-view') as any;
    document.body.appendChild(view);

    // Seed with a single session
    view.data = {
      messages: [makeAgentSessionMessage('s1')],
      state: 'idle',
      isTextInputEmpty: true,
      onSendMessage: () => {},
      onPromptSelected: () => {},
    } as any;
    await raf();
    // Expect one cached session component
    assert.strictEqual(view.getLiveAgentSessionCountForTesting(), 1);

    // Now remove all agent sessions from messages
    view.data = {
      messages: [
        {entity: ChatMessageEntity.USER, text: 'hi'} as any,
      ],
      state: 'idle',
      isTextInputEmpty: true,
      onSendMessage: () => {},
      onPromptSelected: () => {},
    } as any;
    await raf();
    // Expect cached sessions to be pruned
    assert.strictEqual(view.getLiveAgentSessionCountForTesting(), 0);

    document.body.removeChild(view);
  });

  it('prunes only stale sessions and keeps active ones', async () => {
    const view = document.createElement('devtools-chat-view') as any;
    document.body.appendChild(view);

    // Two sessions present (ensure expanded view by including a user message)
    view.data = {
      messages: [
        {entity: ChatMessageEntity.USER, text: 'start'} as any,
        makeAgentSessionMessage('s1'),
        makeAgentSessionMessage('s2'),
      ],
      state: 'idle',
      isTextInputEmpty: true,
      onSendMessage: () => {},
      onPromptSelected: () => {},
    } as any;
    await raf();
    assert.strictEqual(view.getLiveAgentSessionCountForTesting(), 2);

    // Remove s1, keep s2
    view.data = {
      messages: [makeAgentSessionMessage('s2')],
      state: 'idle',
      isTextInputEmpty: true,
      onSendMessage: () => {},
      onPromptSelected: () => {},
    } as any;
    await raf();
    assert.strictEqual(view.getLiveAgentSessionCountForTesting(), 1);

    document.body.removeChild(view);
  });
});
