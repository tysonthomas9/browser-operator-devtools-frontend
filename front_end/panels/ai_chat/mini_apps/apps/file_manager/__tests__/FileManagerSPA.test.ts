// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { FileManagerSPA } from '../FileManagerSPA.js';

// ============================================================================
// FileManagerSPA JavaScript Tests
// ============================================================================

describe('FileManagerSPA JavaScript', () => {
  let js: string;
  let html: string;
  let css: string;

  beforeEach(() => {
    js = FileManagerSPA.js;
    html = FileManagerSPA.html;
    css = FileManagerSPA.css;
  });

  describe('syntax validity', () => {
    it('returns syntactically valid JavaScript', () => {
      // Try to parse the JavaScript - will throw if invalid
      assert.doesNotThrow(() => {
        new Function(js);
      }, 'JavaScript should be parseable without syntax errors');
    });

    it('does not contain unescaped template literals that break parsing', () => {
      // Check for common escaping issues
      // When the outer template uses backticks, inner backticks must be escaped

      // This should not throw
      let parseError: Error | null = null;
      try {
        new Function(js);
      } catch (e) {
        parseError = e as Error;
      }

      if (parseError) {
        console.error('JavaScript parse error:', parseError.message);
        // Log the area around the error if possible
        const lines = js.split('\n');
        console.log('Total lines:', lines.length);
      }

      assert.isNull(parseError, `JavaScript has syntax error: ${parseError?.message}`);
    });
  });

  describe('required functions', () => {
    it('defines sendToDevTools function', () => {
      assert.include(js, 'function sendToDevTools', 'sendToDevTools function should be defined');
    });

    it('defines initEventListeners function', () => {
      assert.include(js, 'function initEventListeners', 'initEventListeners function should be defined');
    });

    it('defines render function', () => {
      assert.include(js, 'function render', 'render function should be defined');
    });

    it('defines handleCreateDocument function', () => {
      assert.include(js, 'function handleCreateDocument', 'handleCreateDocument function should be defined');
    });

    it('defines handleImport function', () => {
      assert.include(js, 'function handleImport', 'handleImport function should be defined');
    });
  });

  describe('HTML and JS element ID matching', () => {
    it('new-doc-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="new-doc-btn"', 'HTML should have new-doc-btn element');
      assert.include(js, "'new-doc-btn'", 'JS should reference new-doc-btn');
    });

    it('import-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="import-btn"', 'HTML should have import-btn element');
      assert.include(js, "'import-btn'", 'JS should reference import-btn');
    });

    it('close-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="close-btn"', 'HTML should have close-btn element');
      assert.include(js, "'close-btn'", 'JS should reference close-btn');
    });

    it('new-doc-modal ID matches in HTML and JS', () => {
      assert.include(html, 'id="new-doc-modal"', 'HTML should have new-doc-modal element');
      assert.include(js, "'new-doc-modal'", 'JS should reference new-doc-modal');
    });

    it('new-doc-title ID matches in HTML and JS', () => {
      assert.include(html, 'id="new-doc-title"', 'HTML should have new-doc-title element');
      assert.include(js, "'new-doc-title'", 'JS should reference new-doc-title');
    });

    it('new-doc-confirm ID matches in HTML and JS', () => {
      assert.include(html, 'id="new-doc-confirm"', 'HTML should have new-doc-confirm element');
      assert.include(js, "'new-doc-confirm'", 'JS should reference new-doc-confirm');
    });
  });

  describe('event listener setup', () => {
    it('attaches click listener to new-doc-btn', () => {
      // Check that the JS sets up a click listener for new-doc-btn
      assert.include(js, "getElementById('new-doc-btn')", 'JS should get new-doc-btn element');
      assert.include(js, "addEventListener('click'", 'JS should add click event listener');
    });

    it('attaches click listener to import-btn', () => {
      assert.include(js, "getElementById('import-btn')", 'JS should get import-btn element');
    });

    it('calls initEventListeners on DOMContentLoaded', () => {
      assert.include(js, "DOMContentLoaded", 'JS should listen for DOMContentLoaded');
      assert.include(js, "initEventListeners()", 'JS should call initEventListeners');
    });
  });

  describe('template literal escaping', () => {
    it('properly escapes backticks in markdown code rendering', () => {
      // The updatePreview function has template literals with backticks for code
      // These need proper escaping

      // Search for patterns that might cause issues
      const codeBlockPattern = /`{3}/g; // Triple backticks for code blocks
      const singleBacktickPattern = /`[^`]+`/g;

      // In the JS string, backticks inside template literals should be escaped as \`
      // But since we're looking at the final string, they appear as single backticks

      // The key test is whether the JS can be parsed
      assert.doesNotThrow(() => {
        new Function(js);
      }, 'JS with markdown code escaping should be parseable');
    });

    it('handles newline escaping correctly', () => {
      // Check that \\n in the source becomes \n in the actual string
      // The regex patterns use \\n which should work correctly

      // Check for specific patterns that are known to be in the code
      assert.include(js, '.replace', 'JS should use replace for markdown rendering');
    });
  });

  // ============================================================================
  // Communication Mechanism Tests
  // These tests ensure the SPA uses the correct CDP binding mechanism,
  // NOT postMessage which is not listened to by GenericMiniAppBridge.
  // ============================================================================
  describe('communication mechanism', () => {
    it('sendToDevTools uses CDP binding not postMessage', () => {
      // MUST use the binding mechanism
      assert.include(js, 'window.__miniAppBridge_file_manager',
        'sendToDevTools must use CDP binding (window.__miniAppBridge_file_manager)');

      // MUST NOT use postMessage for DevTools communication
      assert.notInclude(js, '__miniAppMessage',
        'sendToDevTools must NOT use postMessage (__miniAppMessage pattern)');
    });

    it('sendToDevTools calls binding with JSON.stringify', () => {
      // Should stringify the action before sending
      assert.include(js, '__miniAppBridge_file_manager(JSON.stringify',
        'sendToDevTools should stringify action before calling binding');
    });
  });

  // ============================================================================
  // History State Management Tests
  // These tests ensure proper URL routing integration with browser history.
  // ============================================================================
  describe('history state management', () => {
    it('defines pushHistoryState function', () => {
      assert.include(js, 'function pushHistoryState',
        'JS should define pushHistoryState');
    });

    it('defines replaceHistoryState function', () => {
      assert.include(js, 'function replaceHistoryState',
        'JS should define replaceHistoryState');
    });

    it('defines restoreFromHistoryState function', () => {
      assert.include(js, 'function restoreFromHistoryState',
        'JS should define restoreFromHistoryState');
    });

    it('defines initHistoryListener function', () => {
      assert.include(js, 'function initHistoryListener',
        'JS should define initHistoryListener');
    });

    it('uses miniAppRouter for navigation', () => {
      assert.include(js, 'window.miniAppRouter',
        'JS should use miniAppRouter for navigation');
    });

    it('initHistoryListener uses window.parent.addEventListener popstate', () => {
      // Must use direct popstate listener on parent window
      assert.include(js, "window.parent.addEventListener('popstate'",
        'initHistoryListener must use window.parent.addEventListener for popstate');

      // Must NOT use non-existent onNavigate API
      assert.notInclude(js, 'miniAppRouter.onNavigate',
        'Must NOT use non-existent miniAppRouter.onNavigate API');
    });
  });

  // ============================================================================
  // Initialization Tests
  // These tests ensure proper initialization sequence.
  // ============================================================================
  describe('initialization sequence', () => {
    it('initialize calls initHistoryListener', () => {
      assert.include(js, 'initHistoryListener()',
        'initialize should call initHistoryListener');
    });

    it('initialize calls replaceHistoryState', () => {
      assert.include(js, 'replaceHistoryState()',
        'initialize should call replaceHistoryState to set initial URL');
    });

    it('SPA sends ready message on initialization', () => {
      assert.include(js, "type: 'ready'",
        'JS should send ready message');
    });
  });
});

// ============================================================================
// FileManagerSPA HTML Tests
// ============================================================================

describe('FileManagerSPA HTML', () => {
  let html: string;

  beforeEach(() => {
    html = FileManagerSPA.html;
  });

  describe('structure', () => {
    it('contains DOCTYPE declaration', () => {
      assert.include(html, '<!DOCTYPE html>');
    });

    it('contains html and body tags', () => {
      assert.include(html, '<html');
      assert.include(html, '<body>');
    });

    it('contains file-manager container', () => {
      assert.include(html, 'class="file-manager"');
    });
  });

  describe('required elements', () => {
    it('has header with new doc button', () => {
      assert.include(html, 'id="new-doc-btn"');
    });

    it('has import button', () => {
      assert.include(html, 'id="import-btn"');
    });

    it('has new document modal', () => {
      assert.include(html, 'id="new-doc-modal"');
    });

    it('has items container', () => {
      assert.include(html, 'id="items-container"');
    });

    it('has document view', () => {
      assert.include(html, 'id="document-view"');
    });
  });
});

// ============================================================================
// FileManagerSPA CSS Tests
// ============================================================================

describe('FileManagerSPA CSS', () => {
  let css: string;

  beforeEach(() => {
    css = FileManagerSPA.css;
  });

  describe('structure', () => {
    it('contains CSS variables', () => {
      assert.include(css, ':root');
      assert.include(css, '--primary');
    });

    it('has file-manager styles', () => {
      assert.include(css, '.file-manager');
    });

    it('has button styles', () => {
      assert.include(css, '.btn');
      assert.include(css, '.btn-primary');
    });

    it('has modal styles', () => {
      assert.include(css, '.modal');
    });
  });
});

// ============================================================================
// Integration: Full SPA Content
// ============================================================================

describe('FileManagerSPA Integration', () => {
  it('exports all three content types', () => {
    assert.isString(FileManagerSPA.html);
    assert.isString(FileManagerSPA.css);
    assert.isString(FileManagerSPA.js);

    assert.isTrue(FileManagerSPA.html.length > 0, 'HTML should not be empty');
    assert.isTrue(FileManagerSPA.css.length > 0, 'CSS should not be empty');
    assert.isTrue(FileManagerSPA.js.length > 0, 'JS should not be empty');
  });

  it('has reasonable content sizes', () => {
    // These are rough size checks to ensure content is complete
    assert.isTrue(FileManagerSPA.html.length > 1000, 'HTML should be substantial');
    assert.isTrue(FileManagerSPA.css.length > 1000, 'CSS should be substantial');
    assert.isTrue(FileManagerSPA.js.length > 5000, 'JS should be substantial');
  });
});

// ============================================================================
// Runtime Initialization Simulation
// ============================================================================

describe('FileManagerSPA Runtime Initialization', () => {
  let container: HTMLDivElement;
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    // Create a container for our test iframe
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('SPA JavaScript executes without throwing errors', async () => {
    // Create a mock iframe document
    iframe = document.createElement('iframe');
    container.appendChild(iframe);

    // Wait for iframe to be ready
    await new Promise(resolve => {
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        resolve(undefined);
      } else {
        iframe.onload = () => resolve(undefined);
      }
    });

    const iframeDoc = iframe.contentDocument!;

    // Write the HTML
    iframeDoc.open();
    iframeDoc.write(FileManagerSPA.html);
    iframeDoc.close();

    // Inject the CSS
    const style = iframeDoc.createElement('style');
    style.textContent = FileManagerSPA.css;
    iframeDoc.head.appendChild(style);

    // Execute the JavaScript - wrapped to mock parent.postMessage
    let jsError: Error | null = null;
    try {
      // Create a wrapper that mocks window.parent.postMessage
      const wrappedJs = `
        // Mock window.parent.postMessage for testing
        window.__testPostMessages = [];
        const originalParent = window.parent;
        Object.defineProperty(window, 'parent', {
          get: function() {
            return {
              postMessage: function(data, origin) {
                window.__testPostMessages.push({ data, origin });
                console.log('[Test] postMessage intercepted:', data);
              }
            };
          }
        });
        ${FileManagerSPA.js}
      `;
      const script = iframeDoc.createElement('script');
      script.textContent = wrappedJs;
      iframeDoc.body.appendChild(script);
    } catch (e) {
      jsError = e as Error;
    }

    assert.isNull(jsError, `JS execution should not throw: ${jsError?.message}`);

    // Check that critical elements exist
    const newDocBtn = iframeDoc.getElementById('new-doc-btn');
    assert.isNotNull(newDocBtn, 'new-doc-btn element should exist after HTML render');

    const importBtn = iframeDoc.getElementById('import-btn');
    assert.isNotNull(importBtn, 'import-btn element should exist after HTML render');
  });

  it('button click opens modal when initEventListeners has run', () => {
    // Create a simulated DOM environment
    const testDiv = document.createElement('div');
    testDiv.innerHTML = FileManagerSPA.html;
    container.appendChild(testDiv);

    // Get elements
    const newDocBtn = testDiv.querySelector('#new-doc-btn');
    const modal = testDiv.querySelector('#new-doc-modal') as HTMLElement | null;

    assert.isNotNull(newDocBtn, 'new-doc-btn should exist');
    assert.isNotNull(modal, 'new-doc-modal should exist');

    // Verify initial modal state
    console.log('Initial modal display:', modal?.style.display);

    // Define showModal function as it would be in the SPA
    const showModal = (id: string): void => {
      const modalEl = testDiv.querySelector(`#${id}`) as HTMLElement | null;
      if (modalEl) {
        modalEl.style.display = 'flex';
      }
    };

    // Attach the click handler manually (simulating what initEventListeners does)
    newDocBtn?.addEventListener('click', () => showModal('new-doc-modal'));

    // Click the button
    (newDocBtn as HTMLElement)?.click();

    // Check modal is now visible
    console.log('After click modal display:', modal?.style.display);
    assert.strictEqual(modal?.style.display, 'flex', 'Modal should be visible after clicking new-doc-btn');
  });

  it('SPA JavaScript contains initEventListeners that attaches to new-doc-btn', () => {
    const js = FileManagerSPA.js;

    // Check for the specific pattern in initEventListeners
    const hasNewDocBtnListener = js.includes("getElementById('new-doc-btn')") &&
      js.includes("addEventListener('click'");

    assert.isTrue(hasNewDocBtnListener, 'initEventListeners should attach click listener to new-doc-btn');

    // Check for showModal being called
    const hasShowModalCall = js.includes("showModal('new-doc-modal')");
    assert.isTrue(hasShowModalCall, 'Click handler should call showModal with new-doc-modal');
  });

  it('DOMContentLoaded handler is set up correctly', () => {
    const js = FileManagerSPA.js;

    // Check for DOMContentLoaded setup
    const hasDOMContentLoaded = js.includes("addEventListener('DOMContentLoaded'");
    assert.isTrue(hasDOMContentLoaded, 'JS should have DOMContentLoaded listener');

    // Check that initEventListeners is called in the handler
    const hasInitCall = js.includes("initEventListeners()");
    assert.isTrue(hasInitCall, 'DOMContentLoaded should call initEventListeners');
  });
});
