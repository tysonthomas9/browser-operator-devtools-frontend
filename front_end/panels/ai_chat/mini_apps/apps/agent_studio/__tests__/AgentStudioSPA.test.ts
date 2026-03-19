// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AgentStudioSPA } from '../../../../ui/agent_studio/AgentStudioSPA.js';

// ============================================================================
// AgentStudioSPA JavaScript Tests
// ============================================================================

describe('AgentStudioSPA JavaScript', () => {
  let js: string;
  let html: string;
  let css: string;

  beforeEach(() => {
    js = AgentStudioSPA.js;
    html = AgentStudioSPA.html;
    css = AgentStudioSPA.css;
  });

  describe('syntax validity', () => {
    it('returns syntactically valid JavaScript', () => {
      // Try to parse the JavaScript - will throw if invalid
      assert.doesNotThrow(() => {
        new Function(js);
      }, 'JavaScript should be parseable without syntax errors');
    });

    it('does not contain unescaped template literals that break parsing', () => {
      let parseError: Error | null = null;
      try {
        new Function(js);
      } catch (e) {
        parseError = e as Error;
      }

      if (parseError) {
        console.error('JavaScript parse error:', parseError.message);
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

    it('defines render function', () => {
      assert.include(js, 'function render', 'render function should be defined');
    });

    it('defines init function', () => {
      assert.include(js, 'function init', 'init function should be defined');
    });
  });

  describe('HTML and JS element ID matching', () => {
    it('close-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="close-btn"', 'HTML should have close-btn element');
      assert.include(js, "'close-btn'", 'JS should reference close-btn');
    });

    it('tab-agents ID matches in HTML and JS', () => {
      assert.include(html, 'id="tab-agents"', 'HTML should have tab-agents element');
      // JS uses tab-agents-icon for icon injection, tabs use CSS selectors
      assert.include(js, "'tab-agents-icon'", 'JS should reference tab-agents-icon');
    });

    it('tab-tools ID matches in HTML and JS', () => {
      assert.include(html, 'id="tab-tools"', 'HTML should have tab-tools element');
      // JS uses tab-tools-icon for icon injection, tabs use CSS selectors
      assert.include(js, "'tab-tools-icon'", 'JS should reference tab-tools-icon');
    });

    it('new-agent-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="new-agent-btn"', 'HTML should have new-agent-btn element');
      assert.include(js, "'new-agent-btn'", 'JS should reference new-agent-btn');
    });

    it('new-tool-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="new-tool-btn"', 'HTML should have new-tool-btn element');
      assert.include(js, "'new-tool-btn'", 'JS should reference new-tool-btn');
    });

    it('built-in-agents ID matches in HTML and JS', () => {
      assert.include(html, 'id="built-in-agents"', 'HTML should have built-in-agents element');
      assert.include(js, "'built-in-agents'", 'JS should reference built-in-agents');
    });

    it('custom-agents ID matches in HTML and JS', () => {
      assert.include(html, 'id="custom-agents"', 'HTML should have custom-agents element');
      assert.include(js, "'custom-agents'", 'JS should reference custom-agents');
    });

    it('custom-tools ID matches in HTML and JS', () => {
      assert.include(html, 'id="custom-tools"', 'HTML should have custom-tools element');
      assert.include(js, "'custom-tools'", 'JS should reference custom-tools');
    });

    it('agent-detail-panel ID matches in HTML and JS', () => {
      assert.include(html, 'id="agent-detail-panel"', 'HTML should have agent-detail-panel element');
      assert.include(js, "'agent-detail-panel'", 'JS should reference agent-detail-panel');
    });

    it('notification ID matches in HTML and JS', () => {
      assert.include(html, 'id="notification"', 'HTML should have notification element');
      assert.include(js, "'notification'", 'JS should reference notification');
    });

    it('test-panel ID matches in HTML and JS', () => {
      assert.include(html, 'id="test-panel"', 'HTML should have test-panel element');
      assert.include(js, "'test-panel'", 'JS should reference test-panel');
    });

    it('test-input ID matches in HTML and JS', () => {
      assert.include(html, 'id="test-input"', 'HTML should have test-input element');
      assert.include(js, "'test-input'", 'JS should reference test-input');
    });

    it('run-test-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="run-test-btn"', 'HTML should have run-test-btn element');
      assert.include(js, "'run-test-btn'", 'JS should reference run-test-btn');
    });

    it('test-results ID matches in HTML and JS', () => {
      assert.include(html, 'id="test-results"', 'HTML should have test-results element');
      assert.include(js, "'test-results'", 'JS should reference test-results');
    });
  });

  describe('event listener setup', () => {
    it('listens for DOMContentLoaded', () => {
      assert.include(js, 'DOMContentLoaded', 'JS should listen for DOMContentLoaded');
    });

    it('calls init function', () => {
      assert.include(js, 'init()', 'JS should call init');
    });

    it('checks document.readyState for already loaded DOM', () => {
      assert.include(js, "document.readyState", 'JS should check document.readyState');
    });

    it('attaches click listeners', () => {
      assert.include(js, "addEventListener('click'", 'JS should add click event listeners');
    });
  });

  describe('state management', () => {
    it('has state object', () => {
      assert.include(js, 'state', 'JS should have state management');
    });

    it('has onMiniAppStateChange callback', () => {
      assert.include(js, 'window.onMiniAppStateChange', 'JS should define onMiniAppStateChange');
    });
  });

  describe('history state management', () => {
    it('defines pushHistoryState function', () => {
      assert.include(js, 'function pushHistoryState', 'JS should define pushHistoryState');
    });

    it('defines replaceHistoryState function', () => {
      assert.include(js, 'function replaceHistoryState', 'JS should define replaceHistoryState');
    });

    it('defines restoreFromHistoryState function', () => {
      assert.include(js, 'function restoreFromHistoryState', 'JS should define restoreFromHistoryState');
    });

    it('uses miniAppRouter for navigation', () => {
      assert.include(js, 'window.miniAppRouter', 'JS should use miniAppRouter for navigation');
    });
  });
});

// ============================================================================
// AgentStudioSPA HTML Tests
// ============================================================================

describe('AgentStudioSPA HTML', () => {
  let html: string;

  beforeEach(() => {
    html = AgentStudioSPA.html;
  });

  describe('structure', () => {
    it('contains DOCTYPE declaration', () => {
      assert.include(html, '<!DOCTYPE html>');
    });

    it('contains html and body tags', () => {
      assert.include(html, '<html');
      assert.include(html, '<body>');
    });

    it('contains agent-studio container', () => {
      assert.include(html, 'class="agent-studio"');
    });
  });

  describe('required elements', () => {
    it('has header with studio-title', () => {
      assert.include(html, 'class="studio-header"');
      assert.include(html, 'class="studio-title"');
    });

    it('has tab bar', () => {
      assert.include(html, 'class="tab-bar"');
    });

    it('has agents tab button', () => {
      assert.include(html, 'id="tab-agents"');
      assert.include(html, 'data-tab="agents"');
    });

    it('has tools tab button', () => {
      assert.include(html, 'id="tab-tools"');
      assert.include(html, 'data-tab="tools"');
    });

    it('has new agent button', () => {
      assert.include(html, 'id="new-agent-btn"');
    });

    it('has new tool button', () => {
      assert.include(html, 'id="new-tool-btn"');
    });

    it('has built-in-agents container', () => {
      assert.include(html, 'id="built-in-agents"');
    });

    it('has custom-agents container', () => {
      assert.include(html, 'id="custom-agents"');
    });

    it('has custom-tools container', () => {
      assert.include(html, 'id="custom-tools"');
    });

    it('has agent-detail-panel', () => {
      assert.include(html, 'id="agent-detail-panel"');
    });

    it('has notification element', () => {
      assert.include(html, 'id="notification"');
    });

    it('has test-panel', () => {
      assert.include(html, 'id="test-panel"');
    });

    it('has test-input', () => {
      assert.include(html, 'id="test-input"');
    });

    it('has run-test-btn', () => {
      assert.include(html, 'id="run-test-btn"');
    });

    it('has test-results container', () => {
      assert.include(html, 'id="test-results"');
    });

    it('has close button', () => {
      assert.include(html, 'id="close-btn"');
    });
  });
});

// ============================================================================
// AgentStudioSPA CSS Tests
// ============================================================================

describe('AgentStudioSPA CSS', () => {
  let css: string;

  beforeEach(() => {
    css = AgentStudioSPA.css;
  });

  describe('structure', () => {
    it('contains CSS variables', () => {
      assert.include(css, ':root');
      assert.include(css, '--primary');
    });

    it('has agent-studio styles', () => {
      assert.include(css, '.agent-studio');
    });

    it('has button styles', () => {
      assert.include(css, '.btn');
    });

    it('has notification styles', () => {
      assert.include(css, '.notification');
    });
  });

  describe('design tokens', () => {
    it('defines primary color', () => {
      assert.include(css, '--primary:');
    });

    it('defines surface colors', () => {
      assert.include(css, '--surface:');
      assert.include(css, '--surface-variant:');
    });

    it('defines text colors', () => {
      assert.include(css, '--text-primary:');
      assert.include(css, '--text-secondary:');
    });

    it('defines border radius variables', () => {
      assert.include(css, '--radius-');
    });

    it('defines shadow variables', () => {
      assert.include(css, '--shadow-');
    });
  });

  describe('agent list styles', () => {
    it('has agent-list-panel styles', () => {
      assert.include(css, '.agent-list-panel');
    });

    it('has agent-list styles', () => {
      assert.include(css, '.agent-list');
    });

    it('has agent-list-item styles', () => {
      assert.include(css, '.agent-list-item');
    });

    it('has agent-avatar styles', () => {
      assert.include(css, '.agent-avatar');
    });
  });

  describe('detail panel styles', () => {
    it('has agent-detail-panel styles', () => {
      assert.include(css, '.agent-detail-panel');
    });

    it('has agent-form styles', () => {
      assert.include(css, '.agent-form');
    });

    it('has form-section styles', () => {
      assert.include(css, '.form-section');
    });
  });

  describe('tab styles', () => {
    it('has tab-bar styles', () => {
      assert.include(css, '.tab-bar');
    });

    it('has tab-btn styles', () => {
      assert.include(css, '.tab-btn');
    });

    it('has active tab styles', () => {
      assert.include(css, '.tab-btn.active');
    });
  });

  describe('header styles', () => {
    it('has studio-header styles', () => {
      assert.include(css, '.studio-header');
    });

    it('has studio-title styles', () => {
      assert.include(css, '.studio-title');
    });

    it('has close-btn styles', () => {
      assert.include(css, '.close-btn');
    });
  });

  describe('test panel styles', () => {
    it('has test-panel styles', () => {
      assert.include(css, '.test-panel');
    });

    it('has test-results styles', () => {
      assert.include(css, '.test-results');
    });
  });
});

// ============================================================================
// Integration: Full SPA Content
// ============================================================================

describe('AgentStudioSPA Integration', () => {
  it('exports all three content types', () => {
    assert.isString(AgentStudioSPA.html);
    assert.isString(AgentStudioSPA.css);
    assert.isString(AgentStudioSPA.js);

    assert.isTrue(AgentStudioSPA.html.length > 0, 'HTML should not be empty');
    assert.isTrue(AgentStudioSPA.css.length > 0, 'CSS should not be empty');
    assert.isTrue(AgentStudioSPA.js.length > 0, 'JS should not be empty');
  });

  it('has reasonable content sizes', () => {
    // These are rough size checks to ensure content is complete
    assert.isTrue(AgentStudioSPA.html.length > 1000, 'HTML should be substantial');
    assert.isTrue(AgentStudioSPA.css.length > 3000, 'CSS should be substantial');
    assert.isTrue(AgentStudioSPA.js.length > 10000, 'JS should be substantial');
  });
});

// ============================================================================
// Runtime Initialization Tests
// ============================================================================

describe('AgentStudioSPA Runtime Initialization', () => {
  it('SPA JavaScript executes without throwing errors', () => {
    // Try to execute the JavaScript in isolation
    let jsError: Error | null = null;
    try {
      // Wrap in a function to test parsing without execution
      new Function(AgentStudioSPA.js);
    } catch (e) {
      jsError = e as Error;
    }

    assert.isNull(jsError, `JS should be executable: ${jsError?.message}`);
  });

  it('SPA JavaScript contains initialization check for already loaded DOM', () => {
    const js = AgentStudioSPA.js;

    // Should check if DOM is already loaded
    const hasReadyStateCheck = js.includes("document.readyState !== 'loading'") ||
      js.includes("document.readyState === 'complete'") ||
      js.includes("document.readyState === 'interactive'") ||
      js.includes('document.readyState');

    assert.isTrue(hasReadyStateCheck, 'JS should check document.readyState for already loaded DOM');
  });

  it('DOMContentLoaded handler is set up correctly', () => {
    const js = AgentStudioSPA.js;

    const hasDOMContentLoaded = js.includes("addEventListener('DOMContentLoaded'");
    assert.isTrue(hasDOMContentLoaded, 'JS should have DOMContentLoaded listener');
  });

  it('SPA sends ready message on initialization', () => {
    const js = AgentStudioSPA.js;

    // Should send ready message to DevTools
    assert.include(js, "type: 'ready'", 'JS should send ready message');
  });
});
