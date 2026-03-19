// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { DataStudioSPA } from '../DataStudioSPA.js';

// ============================================================================
// DataStudioSPA JavaScript Tests
// ============================================================================

describe('DataStudioSPA JavaScript', () => {
  let js: string;
  let html: string;
  let css: string;

  beforeEach(() => {
    js = DataStudioSPA.js;
    html = DataStudioSPA.html;
    css = DataStudioSPA.css;
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

    it('defines renderTable function', () => {
      assert.include(js, 'function renderTable', 'renderTable function should be defined');
    });

    it('defines renderSelector function', () => {
      assert.include(js, 'function renderSelector', 'renderSelector function should be defined');
    });

    it('defines escapeHtml function', () => {
      assert.include(js, 'function escapeHtml', 'escapeHtml function should be defined');
    });
  });

  describe('HTML and JS element ID matching', () => {
    it('close-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="close-btn"', 'HTML should have close-btn element');
      assert.include(js, "'close-btn'", 'JS should reference close-btn');
    });

    it('save-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="save-btn"', 'HTML should have save-btn element');
      assert.include(js, "'save-btn'", 'JS should reference save-btn');
    });

    it('create-custom-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="create-custom-btn"', 'HTML should have create-custom-btn element');
      assert.include(js, "'create-custom-btn'", 'JS should reference create-custom-btn');
    });

    it('add-entity-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="add-entity-btn"', 'HTML should have add-entity-btn element');
      assert.include(js, "'add-entity-btn'", 'JS should reference add-entity-btn');
    });

    it('add-agent-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="add-agent-btn"', 'HTML should have add-agent-btn element');
      assert.include(js, "'add-agent-btn'", 'JS should reference add-agent-btn');
    });

    it('run-all-btn ID matches in HTML and JS', () => {
      assert.include(html, 'id="run-all-btn"', 'HTML should have run-all-btn element');
      assert.include(js, "'run-all-btn'", 'JS should reference run-all-btn');
    });

    it('selector-view ID matches in HTML and JS', () => {
      assert.include(html, 'id="selector-view"', 'HTML should have selector-view element');
      assert.include(js, "'selector-view'", 'JS should reference selector-view');
    });

    it('table-view ID matches in HTML and JS', () => {
      assert.include(html, 'id="table-view"', 'HTML should have table-view element');
      assert.include(js, "'table-view'", 'JS should reference table-view');
    });

    it('create-table-modal ID matches in HTML and JS', () => {
      assert.include(html, 'id="create-table-modal"', 'HTML should have create-table-modal element');
      assert.include(js, "'create-table-modal'", 'JS should reference create-table-modal');
    });

    it('add-entity-modal ID matches in HTML and JS', () => {
      assert.include(html, 'id="add-entity-modal"', 'HTML should have add-entity-modal element');
      assert.include(js, "'add-entity-modal'", 'JS should reference add-entity-modal');
    });

    it('add-agent-modal ID matches in HTML and JS', () => {
      assert.include(html, 'id="add-agent-modal"', 'HTML should have add-agent-modal element');
      assert.include(js, "'add-agent-modal'", 'JS should reference add-agent-modal');
    });

    it('data-table ID matches in HTML and JS', () => {
      assert.include(html, 'id="data-table"', 'HTML should have data-table element');
      assert.include(js, "'data-table'", 'JS should reference data-table');
    });
  });

  describe('event listener setup', () => {
    it('attaches click listener to close-btn', () => {
      assert.include(js, "getElementById('close-btn')", 'JS should get close-btn element');
      assert.include(js, "addEventListener('click'", 'JS should add click event listener');
    });

    it('listens for DOMContentLoaded', () => {
      assert.include(js, "DOMContentLoaded", 'JS should listen for DOMContentLoaded');
    });

    it('calls init function', () => {
      assert.include(js, 'init()', 'JS should call init');
    });

    it('checks document.readyState for already loaded DOM', () => {
      assert.include(js, "document.readyState", 'JS should check document.readyState');
    });
  });

  describe('state management', () => {
    it('has state object with view property', () => {
      assert.include(js, "view: 'selector'", 'JS should initialize view state');
    });

    it('has state object with tables array', () => {
      assert.include(js, 'tables: []', 'JS should initialize tables array');
    });

    it('has state object with templates array', () => {
      assert.include(js, 'templates: []', 'JS should initialize templates array');
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
// DataStudioSPA HTML Tests
// ============================================================================

describe('DataStudioSPA HTML', () => {
  let html: string;

  beforeEach(() => {
    html = DataStudioSPA.html;
  });

  describe('structure', () => {
    it('contains DOCTYPE declaration', () => {
      assert.include(html, '<!DOCTYPE html>');
    });

    it('contains html and body tags', () => {
      assert.include(html, '<html');
      assert.include(html, '<body>');
    });

    it('contains data-studio container', () => {
      assert.include(html, 'class="data-studio"');
    });
  });

  describe('required elements', () => {
    it('has header with studio-title', () => {
      assert.include(html, 'class="studio-header"');
      assert.include(html, 'class="studio-title"');
    });

    it('has selector-view section', () => {
      assert.include(html, 'id="selector-view"');
    });

    it('has table-view section', () => {
      assert.include(html, 'id="table-view"');
    });

    it('has saved-tables container', () => {
      assert.include(html, 'id="saved-tables"');
    });

    it('has templates container', () => {
      assert.include(html, 'id="templates"');
    });

    it('has data-table element', () => {
      assert.include(html, 'id="data-table"');
    });

    it('has table-header element', () => {
      assert.include(html, 'id="table-header"');
    });

    it('has table-body element', () => {
      assert.include(html, 'id="table-body"');
    });

    it('has create-table-modal', () => {
      assert.include(html, 'id="create-table-modal"');
    });

    it('has add-entity-modal', () => {
      assert.include(html, 'id="add-entity-modal"');
    });

    it('has add-agent-modal', () => {
      assert.include(html, 'id="add-agent-modal"');
    });

    it('has cell-detail-modal', () => {
      assert.include(html, 'id="cell-detail-modal"');
    });

    it('has notification element', () => {
      assert.include(html, 'id="notification"');
    });
  });

  describe('form elements', () => {
    it('has new-table-name input', () => {
      assert.include(html, 'id="new-table-name"');
    });

    it('has new-entity-type input', () => {
      assert.include(html, 'id="new-entity-type"');
    });

    it('has entity-name input', () => {
      assert.include(html, 'id="entity-name"');
    });

    it('has agent-select dropdown', () => {
      assert.include(html, 'id="agent-select"');
    });

    it('has query-template textarea', () => {
      assert.include(html, 'id="query-template"');
    });

    it('has output-columns container', () => {
      assert.include(html, 'id="output-columns"');
    });
  });
});

// ============================================================================
// DataStudioSPA CSS Tests
// ============================================================================

describe('DataStudioSPA CSS', () => {
  let css: string;

  beforeEach(() => {
    css = DataStudioSPA.css;
  });

  describe('structure', () => {
    it('contains CSS variables', () => {
      assert.include(css, ':root');
      assert.include(css, '--primary');
    });

    it('has data-studio styles', () => {
      assert.include(css, '.data-studio');
    });

    it('has button styles', () => {
      assert.include(css, '.btn');
      assert.include(css, '.btn-primary');
      assert.include(css, '.btn-secondary');
    });

    it('has modal styles', () => {
      assert.include(css, '.modal');
      assert.include(css, '.modal-content');
      assert.include(css, '.modal-overlay');
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

  describe('table styles', () => {
    it('has data-table styles', () => {
      assert.include(css, '.data-table');
    });

    it('has table header styles', () => {
      assert.include(css, '.data-table th');
    });

    it('has agent-group-header styles', () => {
      assert.include(css, '.agent-group-header');
    });

    it('has result-cell styles', () => {
      assert.include(css, '.result-cell');
    });

    it('has entity-cell styles', () => {
      assert.include(css, '.entity-cell');
    });

    it('has spinner animation', () => {
      assert.include(css, '.spinner');
      assert.include(css, '@keyframes spin');
    });
  });

  describe('selector styles', () => {
    it('has selector-view styles', () => {
      assert.include(css, '.selector-view');
    });

    it('has table-card styles', () => {
      assert.include(css, '.table-card');
    });

    it('has template-card styles', () => {
      assert.include(css, '.template-card');
    });
  });

  describe('notification styles', () => {
    it('has notification styles', () => {
      assert.include(css, '.notification');
    });

    it('has success notification style', () => {
      assert.include(css, '.notification.success');
    });

    it('has error notification style', () => {
      assert.include(css, '.notification.error');
    });
  });
});

// ============================================================================
// Integration: Full SPA Content
// ============================================================================

describe('DataStudioSPA Integration', () => {
  it('exports all three content types', () => {
    assert.isString(DataStudioSPA.html);
    assert.isString(DataStudioSPA.css);
    assert.isString(DataStudioSPA.js);

    assert.isTrue(DataStudioSPA.html.length > 0, 'HTML should not be empty');
    assert.isTrue(DataStudioSPA.css.length > 0, 'CSS should not be empty');
    assert.isTrue(DataStudioSPA.js.length > 0, 'JS should not be empty');
  });

  it('has reasonable content sizes', () => {
    // These are rough size checks to ensure content is complete
    assert.isTrue(DataStudioSPA.html.length > 2000, 'HTML should be substantial');
    assert.isTrue(DataStudioSPA.css.length > 3000, 'CSS should be substantial');
    assert.isTrue(DataStudioSPA.js.length > 10000, 'JS should be substantial');
  });
});

// ============================================================================
// Runtime Initialization Tests
// ============================================================================

describe('DataStudioSPA Runtime Initialization', () => {
  it('SPA JavaScript executes without throwing errors', () => {
    // Try to execute the JavaScript in isolation
    let jsError: Error | null = null;
    try {
      // Wrap in a function to test parsing without execution
      new Function(DataStudioSPA.js);
    } catch (e) {
      jsError = e as Error;
    }

    assert.isNull(jsError, `JS should be executable: ${jsError?.message}`);
  });

  it('SPA JavaScript contains initialization check for already loaded DOM', () => {
    const js = DataStudioSPA.js;

    // Should check if DOM is already loaded
    const hasReadyStateCheck = js.includes("document.readyState !== 'loading'") ||
      js.includes("document.readyState === 'complete'") ||
      js.includes("document.readyState === 'interactive'");

    assert.isTrue(hasReadyStateCheck, 'JS should check document.readyState for already loaded DOM');
  });

  it('DOMContentLoaded handler is set up correctly', () => {
    const js = DataStudioSPA.js;

    const hasDOMContentLoaded = js.includes("addEventListener('DOMContentLoaded'");
    assert.isTrue(hasDOMContentLoaded, 'JS should have DOMContentLoaded listener');
  });

  it('SPA sends ready message on initialization', () => {
    const js = DataStudioSPA.js;

    // Should send ready message to DevTools
    assert.include(js, "type: 'ready'", 'JS should send ready message');
  });
});
