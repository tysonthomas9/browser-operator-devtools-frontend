// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import '../ChatView.js';
import { raf } from '../../../../testing/DOMHelpers.js';
import { WorkflowVisualizer } from '../WorkflowVisualizer.js';

// Local enums/types to avoid TS enum imports in strip mode
const ChatMessageEntity = {
  USER: 'user',
  MODEL: 'model',
  AGENT_SESSION: 'agent_session',
  TOOL_RESULT: 'tool_result',
} as const;

function makeUserMessage(text: string): any {
  return { entity: ChatMessageEntity.USER, text } as any;
}

function makeModelMessage(text: string): any {
  return { entity: ChatMessageEntity.MODEL, text } as any;
}

describe('ChatView Workflow Button', () => {
  let view: any;
  let workflowVisualizerStub: sinon.SinonStub;

  beforeEach(() => {
    // Stub WorkflowVisualizer.show
    workflowVisualizerStub = sinon.stub(WorkflowVisualizer, 'show');
    workflowVisualizerStub.resolves({
      success: true,
      webappId: 'test-webapp-123',
    });

    // Create ChatView element
    view = document.createElement('devtools-chat-view');
    document.body.appendChild(view);
  });

  afterEach(() => {
    if (view && view.parentNode) {
      document.body.removeChild(view);
    }
    sinon.restore();
  });

  function queryWorkflowButton(viewElement: HTMLElement): HTMLElement | null {
    const shadow = viewElement.shadowRoot;
    if (!shadow) {
      return null;
    }
    return shadow.querySelector('.workflow-fab-button') as HTMLElement | null;
  }

  describe('button visibility', () => {
    it('should not show workflow button when no messages', async () => {
      view.data = {
        messages: [],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNull(button);
    });

    it('should show workflow button when messages exist', async () => {
      view.data = {
        messages: [makeUserMessage('Hello'), makeModelMessage('Hi there!')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);
    });

    it('should show workflow button with single message', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);
    });

    it('should hide workflow button when messages are cleared', async () => {
      // Start with messages
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      let button = queryWorkflowButton(view);
      assert.isNotNull(button, 'Button should exist with messages');

      // Clear messages
      view.data = {
        messages: [],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      button = queryWorkflowButton(view);
      assert.isNull(button, 'Button should not exist without messages');
    });
  });

  describe('button interaction', () => {
    it('should call WorkflowVisualizer.show when clicked', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);

      button!.click();
      await raf();

      assert.isTrue(workflowVisualizerStub.calledOnce);
    });

    it('should pass graph config to WorkflowVisualizer', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      button!.click();
      await raf();

      const callArgs = workflowVisualizerStub.firstCall.args;
      assert.isDefined(callArgs[0], 'Should pass graph config');
      assert.isDefined(callArgs[0].name);
      assert.isDefined(callArgs[0].nodes);
      assert.isDefined(callArgs[0].edges);
    });

    it('should pass options to WorkflowVisualizer', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      button!.click();
      await raf();

      const callArgs = workflowVisualizerStub.firstCall.args;
      assert.isDefined(callArgs[1], 'Should pass options');

      const options = callArgs[1];
      assert.isTrue(options.readonly);
      assert.isTrue(options.showMiniMap);
      assert.isTrue(options.showControls);
      assert.isTrue(options.fitView);
    });

    it('should handle multiple clicks gracefully', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);

      button!.click();
      button!.click();
      button!.click();
      await raf();

      // Should have been called 3 times
      assert.strictEqual(workflowVisualizerStub.callCount, 3);
    });

    it('should handle visualization errors gracefully', async () => {
      workflowVisualizerStub.resolves({
        success: false,
        error: 'Failed to render',
      });

      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);

      // Should not throw
      button!.click();
      await raf();

      assert.isTrue(workflowVisualizerStub.calledOnce);
    });

    it('should handle visualization exceptions gracefully', async () => {
      workflowVisualizerStub.rejects(new Error('Network error'));

      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);

      // Should not throw
      button!.click();
      await raf();

      assert.isTrue(workflowVisualizerStub.calledOnce);
    });
  });

  describe('button styling', () => {
    it('should have fixed positioning', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);

      const computedStyle = window.getComputedStyle(button!);
      assert.strictEqual(computedStyle.position, 'fixed');
    });

    it('should be positioned in bottom-right corner', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);

      const computedStyle = window.getComputedStyle(button!);
      assert.strictEqual(computedStyle.bottom, '90px');
      assert.strictEqual(computedStyle.right, '20px');
    });

    it('should have circular shape', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);

      const computedStyle = window.getComputedStyle(button!);
      assert.strictEqual(computedStyle.borderRadius, '50%');
    });

    it('should have workflow graph icon', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);

      // Should contain SVG icon
      const svg = button!.querySelector('svg');
      assert.isNotNull(svg);

      // Should have graph-like icon (circles and lines)
      const circles = svg!.querySelectorAll('circle');
      const lines = svg!.querySelectorAll('line');
      assert.isAtLeast(circles.length, 2, 'Should have circles for nodes');
      assert.isAtLeast(lines.length, 1, 'Should have lines for edges');
    });

    it('should have accessible title and aria-label', async () => {
      view.data = {
        messages: [makeUserMessage('Test')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);

      const title = button!.getAttribute('title');
      const ariaLabel = button!.getAttribute('aria-label');

      assert.isDefined(title);
      assert.isDefined(ariaLabel);
      assert.include(title!.toLowerCase(), 'workflow');
      assert.include(ariaLabel!.toLowerCase(), 'workflow');
    });
  });

  describe('button behavior with different message types', () => {
    it('should show button with user messages only', async () => {
      view.data = {
        messages: [makeUserMessage('Test1'), makeUserMessage('Test2')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);
    });

    it('should show button with model messages only', async () => {
      view.data = {
        messages: [makeModelMessage('Response1'), makeModelMessage('Response2')],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);
    });

    it('should show button with mixed message types', async () => {
      view.data = {
        messages: [
          makeUserMessage('Question'),
          makeModelMessage('Answer'),
          makeUserMessage('Follow-up'),
        ],
        state: 'idle',
        isTextInputEmpty: true,
        onSendMessage: () => {},
        onPromptSelected: () => {},
      };
      await raf();

      const button = queryWorkflowButton(view);
      assert.isNotNull(button);
    });
  });
});
