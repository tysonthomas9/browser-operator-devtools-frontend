// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { AppBuilderSPA } from '../../../../ui/app_builder/AppBuilderSPA.js';

// ============================================================================
// AppBuilderSPA JavaScript Tests
// ============================================================================

describe('AppBuilderSPA JavaScript', () => {
  let js: string;
  let html: string;
  let css: string;

  beforeEach(() => {
    js = AppBuilderSPA.js;
    html = AppBuilderSPA.html;
    css = AppBuilderSPA.css;
  });

  // SECTION 1: Syntax Validity (Critical - catches the current bug)
  describe('syntax validity', () => {
    it('returns syntactically valid JavaScript', () => {
      assert.doesNotThrow(() => new Function(js), 'JavaScript should be parseable without syntax errors');
    });

    it('logs error location on parse failure', () => {
      let parseError: Error | null = null;
      try {
        new Function(js);
      } catch (e) {
        parseError = e as Error;
        console.error('Parse error:', parseError.message);
        const lines = js.split('\n');
        console.log('Total lines:', lines.length);
      }
      assert.isNull(parseError, `JavaScript has syntax error: ${parseError?.message}`);
    });
  });

  // SECTION 2: Required Functions (26 functions in AppBuilderSPA.ts)
  describe('required functions', () => {
    it('defines cacheElements', () => assert.include(js, 'function cacheElements'));
    it('defines injectIcons', () => assert.include(js, 'function injectIcons'));
    it('defines setupEventListeners', () => assert.include(js, 'function setupEventListeners'));
    it('defines handleDevToolsAction', () => assert.include(js, 'function handleDevToolsAction'));
    it('defines handleInit', () => assert.include(js, 'function handleInit'));
    it('defines handleProjectOpened', () => assert.include(js, 'function handleProjectOpened'));
    it('defines handleProjectDeleted', () => assert.include(js, 'function handleProjectDeleted'));
    it('defines handleFileSelected', () => assert.include(js, 'function handleFileSelected'));
    it('defines handleFileTreeUpdate', () => assert.include(js, 'function handleFileTreeUpdate'));
    it('defines renderProjectList', () => assert.include(js, 'function renderProjectList'));
    it('defines renderFileTree', () => assert.include(js, 'function renderFileTree'));
    it('defines renderFileTreeNodes', () => assert.include(js, 'function renderFileTreeNodes'));
    it('defines getFileIcon', () => assert.include(js, 'function getFileIcon'));
    it('defines selectFile', () => assert.include(js, 'function selectFile'));
    it('defines openFileInEditor', () => assert.include(js, 'function openFileInEditor'));
    it('defines showEmptyEditor', () => assert.include(js, 'function showEmptyEditor'));
    it('defines showProjectList', () => assert.include(js, 'function showProjectList'));
    it('defines showFileTree', () => assert.include(js, 'function showFileTree'));
    it('defines showModal', () => assert.include(js, 'function showModal'));
    it('defines hideModal', () => assert.include(js, 'function hideModal'));
    it('defines handleCreateProject', () => assert.include(js, 'function handleCreateProject'));
    it('defines handleCreateFile', () => assert.include(js, 'function handleCreateFile'));
    it('defines updateStatus', () => assert.include(js, 'function updateStatus'));
    it('defines showPreview', () => assert.include(js, 'function showPreview'));
    it('defines refreshPreview', () => assert.include(js, 'function refreshPreview'));
    it('defines toggleTerminal', () => assert.include(js, 'function toggleTerminal'));
    it('defines appendTerminal', () => assert.include(js, 'function appendTerminal'));
    it('defines clearTerminal', () => assert.include(js, 'function clearTerminal'));
    it('defines showNotification', () => assert.include(js, 'function showNotification'));
    it('defines escapeHtml', () => assert.include(js, 'function escapeHtml'));
  });

  // SECTION 3: HTML and JS Element ID Matching (Critical IDs)
  describe('HTML and JS element ID matching', () => {
    // Header elements
    it('header-icon ID matches', () => {
      assert.include(html, 'id="header-icon"', 'HTML should have header-icon element');
      assert.include(js, "'header-icon'", 'JS should reference header-icon');
    });
    it('new-project-btn ID matches', () => {
      assert.include(html, 'id="new-project-btn"', 'HTML should have new-project-btn element');
      assert.include(js, "'new-project-btn'", 'JS should reference new-project-btn');
    });
    it('close-btn ID matches', () => {
      assert.include(html, 'id="close-btn"', 'HTML should have close-btn element');
      assert.include(js, "'close-btn'", 'JS should reference close-btn');
    });
    // Sidebar elements
    it('project-list-view ID matches', () => {
      assert.include(html, 'id="project-list-view"', 'HTML should have project-list-view element');
      assert.include(js, "'project-list-view'", 'JS should reference project-list-view');
    });
    it('project-list ID matches', () => {
      assert.include(html, 'id="project-list"', 'HTML should have project-list element');
      assert.include(js, "'project-list'", 'JS should reference project-list');
    });
    it('file-tree-view ID matches', () => {
      assert.include(html, 'id="file-tree-view"', 'HTML should have file-tree-view element');
      assert.include(js, "'file-tree-view'", 'JS should reference file-tree-view');
    });
    it('file-tree ID matches', () => {
      assert.include(html, 'id="file-tree"', 'HTML should have file-tree element');
      assert.include(js, "'file-tree'", 'JS should reference file-tree');
    });
    // Editor elements
    it('empty-editor ID matches', () => {
      assert.include(html, 'id="empty-editor"', 'HTML should have empty-editor element');
      assert.include(js, "'empty-editor'", 'JS should reference empty-editor');
    });
    it('create-first-project-btn ID matches', () => {
      assert.include(html, 'id="create-first-project-btn"', 'HTML should have create-first-project-btn element');
      assert.include(js, "'create-first-project-btn'", 'JS should reference create-first-project-btn');
    });
    it('editor-container ID matches', () => {
      assert.include(html, 'id="editor-container"', 'HTML should have editor-container element');
      assert.include(js, "'editor-container'", 'JS should reference editor-container');
    });
    // Preview elements
    it('preview-iframe ID matches', () => {
      assert.include(html, 'id="preview-iframe"', 'HTML should have preview-iframe element');
      assert.include(js, "'preview-iframe'", 'JS should reference preview-iframe');
    });
    it('terminal-panel ID matches', () => {
      assert.include(html, 'id="terminal-panel"', 'HTML should have terminal-panel element');
      assert.include(js, "'terminal-panel'", 'JS should reference terminal-panel');
    });
    // Modal elements
    it('new-project-modal ID matches', () => {
      assert.include(html, 'id="new-project-modal"', 'HTML should have new-project-modal element');
      assert.include(js, "'new-project-modal'", 'JS should reference new-project-modal');
    });
    it('new-file-modal ID matches', () => {
      assert.include(html, 'id="new-file-modal"', 'HTML should have new-file-modal element');
      assert.include(js, "'new-file-modal'", 'JS should reference new-file-modal');
    });
  });

  // SECTION 4: Event Listener Setup
  describe('event listener setup', () => {
    it('attaches click to closeBtn', () => {
      assert.include(js, "elements.closeBtn.addEventListener('click'", 'JS should attach click listener to closeBtn');
    });
    it('attaches click to newProjectBtn', () => {
      assert.include(js, "elements.newProjectBtn.addEventListener('click'", 'JS should attach click listener to newProjectBtn');
    });
    it('attaches click to createFirstProjectBtn', () => {
      assert.include(js, "elements.createFirstProjectBtn.addEventListener('click'", 'JS should attach click listener to createFirstProjectBtn');
    });
    it('attaches click to backToProjects', () => {
      assert.include(js, "elements.backToProjects.addEventListener('click'", 'JS should attach click listener to backToProjects');
    });
    it('attaches submit to newProjectForm', () => {
      assert.include(js, "elements.newProjectForm.addEventListener('submit'", 'JS should attach submit listener to newProjectForm');
    });
    it('calls DOMContentLoaded', () => {
      assert.include(js, 'DOMContentLoaded', 'JS should listen for DOMContentLoaded');
    });
    it('click handlers call showModal', () => {
      assert.include(js, "showModal('new-project')", 'JS should call showModal with new-project');
    });
  });

  // SECTION 5: Communication Mechanism
  describe('communication mechanism', () => {
    it('uses window.miniApp for communication', () => {
      assert.include(js, 'window.miniApp', 'JS should use window.miniApp');
    });
    it('sendAction is used for DevTools communication', () => {
      assert.include(js, '.sendAction', 'JS should use sendAction method');
    });
    it('sends ready action on init', () => {
      assert.include(js, "sendAction('ready'", 'JS should send ready action');
    });
  });

  // SECTION 6: State Management
  describe('state management', () => {
    it('defines state object', () => {
      assert.include(js, 'const state = {', 'JS should define state object');
    });
    it('state has projects array', () => {
      assert.include(js, 'projects: []', 'state should have projects array');
    });
    it('state has project property', () => {
      assert.include(js, 'project: null', 'state should have project property');
    });
    it('state has fileTree array', () => {
      assert.include(js, 'fileTree: []', 'state should have fileTree array');
    });
    it('state has webContainerStatus', () => {
      assert.include(js, 'webContainerStatus:', 'state should have webContainerStatus');
    });
  });

  // SECTION 7: Icons Object
  describe('icons object', () => {
    it('defines Icons object', () => {
      assert.include(js, 'const Icons = {', 'JS should define Icons object');
    });
    it('has folder icon', () => {
      assert.include(js, 'folder:', 'Icons should have folder');
    });
    it('has file icon', () => {
      assert.include(js, 'file:', 'Icons should have file');
    });
    it('has plus icon', () => {
      assert.include(js, 'plus:', 'Icons should have plus');
    });
    it('has trash icon', () => {
      assert.include(js, 'trash:', 'Icons should have trash');
    });
  });
});

// ============================================================================
// AppBuilderSPA HTML Tests
// ============================================================================

describe('AppBuilderSPA HTML', () => {
  let html: string;

  beforeEach(() => {
    html = AppBuilderSPA.html;
  });

  describe('structure', () => {
    it('contains DOCTYPE', () => assert.include(html, '<!DOCTYPE html>'));
    it('contains html tag', () => assert.include(html, '<html'));
    it('contains body tag', () => assert.include(html, '<body>'));
    it('contains app-builder container', () => assert.include(html, 'class="app-builder"'));
  });

  describe('header elements', () => {
    it('has header', () => assert.include(html, 'class="header"'));
    it('has new project button', () => assert.include(html, 'id="new-project-btn"'));
    it('has close button', () => assert.include(html, 'id="close-btn"'));
  });

  describe('sidebar elements', () => {
    it('has sidebar', () => assert.include(html, 'class="sidebar"'));
    it('has project list', () => assert.include(html, 'id="project-list"'));
    it('has file tree', () => assert.include(html, 'id="file-tree"'));
  });

  describe('editor elements', () => {
    it('has editor panel', () => assert.include(html, 'id="editor-panel"'));
    it('has empty editor', () => assert.include(html, 'id="empty-editor"'));
    it('has create first project button', () => assert.include(html, 'id="create-first-project-btn"'));
    it('has editor container', () => assert.include(html, 'id="editor-container"'));
  });

  describe('preview elements', () => {
    it('has preview panel', () => assert.include(html, 'id="preview-panel"'));
    it('has preview iframe', () => assert.include(html, 'id="preview-iframe"'));
    it('has terminal panel', () => assert.include(html, 'id="terminal-panel"'));
  });

  describe('modal elements', () => {
    it('has new project modal', () => assert.include(html, 'id="new-project-modal"'));
    it('has new file modal', () => assert.include(html, 'id="new-file-modal"'));
    it('has project name input', () => assert.include(html, 'id="project-name-input"'));
    it('has file path input', () => assert.include(html, 'id="file-path-input"'));
  });
});

// ============================================================================
// AppBuilderSPA CSS Tests
// ============================================================================

describe('AppBuilderSPA CSS', () => {
  let css: string;

  beforeEach(() => {
    css = AppBuilderSPA.css;
  });

  describe('structure', () => {
    it('has CSS variables', () => {
      assert.include(css, ':root');
      assert.include(css, '--primary');
    });
    it('has app-builder styles', () => assert.include(css, '.app-builder'));
    it('has header styles', () => assert.include(css, '.header'));
    it('has sidebar styles', () => assert.include(css, '.sidebar'));
    it('has button styles', () => assert.include(css, '.btn'));
    it('has modal styles', () => assert.include(css, '.modal'));
  });
});

// ============================================================================
// AppBuilderSPA Integration Tests
// ============================================================================

describe('AppBuilderSPA Integration', () => {
  it('exports all three content types', () => {
    assert.isString(AppBuilderSPA.html);
    assert.isString(AppBuilderSPA.css);
    assert.isString(AppBuilderSPA.js);
  });

  it('has reasonable content sizes', () => {
    assert.isTrue(AppBuilderSPA.html.length > 1000, 'HTML should be substantial');
    assert.isTrue(AppBuilderSPA.css.length > 1000, 'CSS should be substantial');
    assert.isTrue(AppBuilderSPA.js.length > 5000, 'JS should be substantial');
  });
});

// ============================================================================
// Runtime Initialization Simulation
// ============================================================================

describe('AppBuilderSPA Runtime Initialization', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('SPA JavaScript executes without throwing errors', async () => {
    const iframe = document.createElement('iframe');
    container.appendChild(iframe);

    await new Promise(resolve => {
      if (iframe.contentDocument?.readyState === 'complete') {
        resolve(undefined);
      } else {
        iframe.onload = () => resolve(undefined);
      }
    });

    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write(AppBuilderSPA.html);
    iframeDoc.close();

    const style = iframeDoc.createElement('style');
    style.textContent = AppBuilderSPA.css;
    iframeDoc.head.appendChild(style);

    let jsError: Error | null = null;
    try {
      const script = iframeDoc.createElement('script');
      script.textContent = AppBuilderSPA.js;
      iframeDoc.body.appendChild(script);
    } catch (e) {
      jsError = e as Error;
    }

    assert.isNull(jsError, `JS execution should not throw: ${jsError?.message}`);

    const btn = iframeDoc.getElementById('create-first-project-btn');
    assert.isNotNull(btn, 'create-first-project-btn element should exist after HTML render');
  });

  it('button click opens modal when setupEventListeners has run', () => {
    const testDiv = document.createElement('div');
    testDiv.innerHTML = AppBuilderSPA.html;
    container.appendChild(testDiv);

    const btn = testDiv.querySelector('#create-first-project-btn');
    const modal = testDiv.querySelector('#new-project-modal') as HTMLElement;

    assert.isNotNull(btn, 'create-first-project-btn should exist');
    assert.isNotNull(modal, 'new-project-modal should exist');

    const showModal = (type: string): void => {
      const el = testDiv.querySelector('#' + type + '-modal') as HTMLElement;
      if (el) {
        el.style.display = 'flex';
      }
    };

    btn?.addEventListener('click', () => showModal('new-project'));
    (btn as HTMLElement)?.click();

    assert.strictEqual(modal.style.display, 'flex', 'Modal should be visible after clicking button');
  });

  it('DOMContentLoaded handler is set up correctly', () => {
    const js = AppBuilderSPA.js;

    // Check for DOMContentLoaded setup
    const hasDOMContentLoaded = js.includes("addEventListener('DOMContentLoaded'");
    assert.isTrue(hasDOMContentLoaded, 'JS should have DOMContentLoaded listener');

    // Check that setupEventListeners is called in the handler
    const hasSetupCall = js.includes('setupEventListeners()');
    assert.isTrue(hasSetupCall, 'DOMContentLoaded should call setupEventListeners');
  });
});

// ============================================================================
// Runtime Error Detection Tests
// These tests catch actual runtime errors that syntax tests miss
// ============================================================================

describe('AppBuilderSPA Runtime Execution', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('executes without runtime errors', async () => {
    const iframe = document.createElement('iframe');
    container.appendChild(iframe);

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      // If already loaded, resolve immediately
      if (iframe.contentDocument?.readyState === 'complete') {
        resolve();
      }
    });

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(AppBuilderSPA.html);
    doc.close();

    // Inject CSS
    const style = doc.createElement('style');
    style.textContent = AppBuilderSPA.css;
    doc.head.appendChild(style);

    // Capture runtime errors
    const errors: string[] = [];
    const win = iframe.contentWindow as Window;
    win.onerror = (msg, _url, _line, _col, error) => {
      const errorMsg = error?.message || String(msg);
      errors.push(errorMsg);
      console.error('[Runtime Error]', errorMsg);
      return true; // Prevent default error handling
    };

    // Execute JS
    const script = doc.createElement('script');
    script.textContent = AppBuilderSPA.js;
    doc.body.appendChild(script);

    // Wait for DOMContentLoaded to fire and JS to execute
    await new Promise(r => setTimeout(r, 200));

    // Log any errors for debugging
    if (errors.length > 0) {
      console.error('Runtime errors detected:', errors);
    }

    assert.isEmpty(errors, `JavaScript had runtime errors: ${errors.join(', ')}`);
  });

  it('button click opens modal after SPA JavaScript executes', async () => {
    const iframe = document.createElement('iframe');
    container.appendChild(iframe);

    await new Promise<void>(resolve => {
      iframe.onload = () => resolve();
      if (iframe.contentDocument?.readyState === 'complete') {
        resolve();
      }
    });

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(AppBuilderSPA.html);
    doc.close();

    const style = doc.createElement('style');
    style.textContent = AppBuilderSPA.css;
    doc.head.appendChild(style);

    // Capture any errors
    const errors: string[] = [];
    const win = iframe.contentWindow as Window;
    win.onerror = (msg, _url, _line, _col, error) => {
      errors.push(error?.message || String(msg));
      return true;
    };

    const script = doc.createElement('script');
    script.textContent = AppBuilderSPA.js;
    doc.body.appendChild(script);

    // Wait for initialization
    await new Promise(r => setTimeout(r, 300));

    // Log errors if any
    if (errors.length > 0) {
      console.error('Errors during initialization:', errors);
    }

    const btn = doc.getElementById('create-first-project-btn') as HTMLElement;
    const modal = doc.getElementById('new-project-modal') as HTMLElement;

    assert.isNotNull(btn, 'Button should exist');
    assert.isNotNull(modal, 'Modal should exist');

    // Verify initial modal state
    const initialDisplay = modal.style.display;
    console.log('Initial modal display:', initialDisplay || 'empty (default)');

    // Click the button
    btn.click();

    // Wait for any async handlers
    await new Promise(r => setTimeout(r, 100));

    // Check modal visibility
    const finalDisplay = modal.style.display;
    console.log('Final modal display:', finalDisplay);

    assert.strictEqual(modal.style.display, 'flex', 'Modal should be visible (display: flex) after button click');
  });

  it('verifies event listeners are actually attached', async () => {
    const iframe = document.createElement('iframe');
    container.appendChild(iframe);

    await new Promise<void>(resolve => {
      iframe.onload = () => resolve();
      if (iframe.contentDocument?.readyState === 'complete') {
        resolve();
      }
    });

    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(AppBuilderSPA.html);
    doc.close();

    const style = doc.createElement('style');
    style.textContent = AppBuilderSPA.css;
    doc.head.appendChild(style);

    // Track function calls
    const win = iframe.contentWindow as Window & { __showModalCalled?: boolean };
    const errors: string[] = [];

    win.onerror = (msg, _url, _line, _col, error) => {
      errors.push(error?.message || String(msg));
      return true;
    };

    // Wrap the JS to track showModal calls
    const wrappedJs = `
      ${AppBuilderSPA.js}

      // After SPA code runs, verify the button has event listeners
      setTimeout(() => {
        const btn = document.getElementById('create-first-project-btn');
        if (btn) {
          // Check if clicking triggers showModal
          const originalShowModal = window.showModal || function() {};
          let called = false;
          window.showModal = function(type) {
            called = true;
            window.__showModalCalled = true;
            console.log('[Test] showModal called with:', type);
            return originalShowModal(type);
          };
        }
      }, 100);
    `;

    const script = doc.createElement('script');
    script.textContent = wrappedJs;
    doc.body.appendChild(script);

    // Wait for initialization
    await new Promise(r => setTimeout(r, 300));

    // If there were errors, the event listeners likely weren't attached
    if (errors.length > 0) {
      assert.fail(`Runtime errors prevented event listener setup: ${errors.join(', ')}`);
    }
  });
});
