// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Tests for previewHtml - HTML template generation for sandbox apps
 */

import {createPreviewHtml} from '../runtime/previewHtml.js';

describe('ai_chat: previewHtml', () => {
  // ==========================================================================
  // Basic Structure Tests
  // ==========================================================================

  describe('basic structure', () => {
    it('returns valid HTML document', () => {
      const html = createPreviewHtml();

      assert.include(html, '<!doctype html>');
      assert.include(html, '<html');
      assert.include(html, '</html>');
      assert.include(html, '<head>');
      assert.include(html, '</head>');
      assert.include(html, '<body>');
      assert.include(html, '</body>');
    });

    it('includes root element for React rendering', () => {
      const html = createPreviewHtml();

      assert.include(html, '<div id="root">');
    });

    it('includes proper meta tags', () => {
      const html = createPreviewHtml();

      assert.include(html, '<meta charset="UTF-8"');
      assert.include(html, '<meta name="viewport"');
    });

    it('includes title', () => {
      const html = createPreviewHtml();

      assert.include(html, '<title>Sandbox App</title>');
    });
  });

  // ==========================================================================
  // React Import Map Tests
  // ==========================================================================

  describe('React import map', () => {
    it('includes import map script', () => {
      const html = createPreviewHtml();

      assert.include(html, '<script type="importmap">');
    });

    it('includes React imports', () => {
      const html = createPreviewHtml();

      assert.include(html, '"react"');
      assert.include(html, '"react-dom"');
      assert.include(html, '"react-dom/client"');
      assert.include(html, '"react/jsx-runtime"');
    });

    it('includes Zustand imports', () => {
      const html = createPreviewHtml();

      assert.include(html, '"zustand"');
      assert.include(html, '"zustand/middleware"');
    });

    it('uses esm.sh CDN', () => {
      const html = createPreviewHtml();

      assert.include(html, 'esm.sh/react@');
    });

    it('uses default React version', () => {
      const html = createPreviewHtml();

      assert.include(html, 'react@18.2.0');
    });

    it('uses custom React version when specified', () => {
      const html = createPreviewHtml({reactVersion: '18.3.0'});

      assert.include(html, 'react@18.3.0');
      assert.notInclude(html, 'react@18.2.0');
    });
  });

  // ==========================================================================
  // Tailwind CSS Tests
  // ==========================================================================

  describe('Tailwind CSS', () => {
    it('includes Tailwind Play CDN', () => {
      const html = createPreviewHtml();

      assert.include(html, 'cdn.tailwindcss.com');
    });

    it('includes Tailwind configuration', () => {
      const html = createPreviewHtml();

      assert.include(html, 'tailwind = {');
      assert.include(html, "darkMode: 'class'");
    });

    it('includes shadcn-style color variables', () => {
      const html = createPreviewHtml();

      assert.include(html, '--background');
      assert.include(html, '--foreground');
      assert.include(html, '--primary');
      assert.include(html, '--secondary');
      assert.include(html, '--muted');
      assert.include(html, '--accent');
      assert.include(html, '--destructive');
    });

    it('includes border radius variables', () => {
      const html = createPreviewHtml();

      assert.include(html, '--radius');
      assert.include(html, "borderRadius:");
    });
  });

  // ==========================================================================
  // CSS Injection Point Tests
  // ==========================================================================

  describe('CSS injection', () => {
    it('includes CSS injection style element', () => {
      const html = createPreviewHtml();

      assert.include(html, '<style id="__sandbox_css__">');
    });
  });

  // ==========================================================================
  // Dark Theme Tests
  // ==========================================================================

  describe('dark theme', () => {
    it('includes dark theme variables', () => {
      const html = createPreviewHtml();

      // Dark background
      assert.include(html, '--background: 224 71% 4%');
    });

    it('includes dark body styles', () => {
      const html = createPreviewHtml();

      assert.include(html, 'background: hsl(var(--background))');
      assert.include(html, 'color: hsl(var(--foreground))');
    });
  });

  // ==========================================================================
  // Message Bridge Tests
  // ==========================================================================

  describe('message bridge', () => {
    it('includes message sending function', () => {
      const html = createPreviewHtml();

      assert.include(html, "parent.postMessage({ __sandbox: true, message: payload }");
    });

    it('includes message listener', () => {
      const html = createPreviewHtml();

      assert.include(html, "window.addEventListener('message'");
    });

    it('handles init message type', () => {
      const html = createPreviewHtml();

      assert.include(html, "case 'init':");
    });

    it('handles data-update message type', () => {
      const html = createPreviewHtml();

      assert.include(html, "case 'data-update':");
    });

    it('handles execute message type', () => {
      const html = createPreviewHtml();

      assert.include(html, "case 'execute':");
    });

    it('handles hot-reload message type', () => {
      const html = createPreviewHtml();

      assert.include(html, "case 'hot-reload':");
    });

    it('handles get-state message type', () => {
      const html = createPreviewHtml();

      assert.include(html, "case 'get-state':");
    });
  });

  // ==========================================================================
  // Global API Tests
  // ==========================================================================

  describe('global sandbox API', () => {
    it('exposes window.__sandbox object', () => {
      const html = createPreviewHtml();

      assert.include(html, 'window.__sandbox = {');
    });

    it('includes getState function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'getState:');
    });

    it('includes setState function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'setState:');
    });

    it('includes updateState function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'updateState:');
    });

    it('includes getAtPath function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'getAtPath:');
    });

    it('includes dispatchAction function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'dispatchAction:');
    });

    it('includes sendAction function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'sendAction:');
    });

    it('exposes executeCode function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'window.__sandbox_executeCode = executeCode');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('includes global error handler', () => {
      const html = createPreviewHtml();

      assert.include(html, "window.addEventListener('error'");
    });

    it('includes unhandled rejection handler', () => {
      const html = createPreviewHtml();

      assert.include(html, "window.addEventListener('unhandledrejection'");
    });

    it('sends error messages to parent', () => {
      const html = createPreviewHtml();

      assert.include(html, "type: 'error'");
    });
  });

  // ==========================================================================
  // Code Execution Tests
  // ==========================================================================

  describe('code execution', () => {
    it('includes executeCode function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'async function executeCode(js, css)');
    });

    it('uses Blob URL for code execution', () => {
      const html = createPreviewHtml();

      assert.include(html, "new Blob([js], { type: 'text/javascript' })");
      assert.include(html, 'URL.createObjectURL(blob)');
    });

    it('cleans up previous Blob URLs', () => {
      const html = createPreviewHtml();

      assert.include(html, 'URL.revokeObjectURL');
      // The implementation stores blob URL in lastScriptEl.dataset.blobUrl
      assert.include(html, 'lastScriptEl');
      assert.include(html, 'blobUrl');
    });

    it('sends ready message after execution', () => {
      const html = createPreviewHtml();

      assert.include(html, "send({ type: 'ready' })");
    });
  });

  // ==========================================================================
  // Path Utilities Tests
  // ==========================================================================

  describe('path utilities', () => {
    it('includes setAtPath function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'function setAtPath(obj, path, value)');
    });

    it('includes getAtPath function', () => {
      const html = createPreviewHtml();

      assert.include(html, 'function getAtPath(obj, path)');
    });

    it('splits path by forward slash', () => {
      const html = createPreviewHtml();

      assert.include(html, "path.split('/')");
    });
  });

  // ==========================================================================
  // Callback Hooks Tests
  // ==========================================================================

  describe('callback hooks', () => {
    it('checks for onDataUpdate callback', () => {
      const html = createPreviewHtml();

      assert.include(html, 'window.__sandbox_onDataUpdate');
    });

    it('checks for onExecute callback', () => {
      const html = createPreviewHtml();

      assert.include(html, 'window.__sandbox_onExecute');
    });
  });

  // ==========================================================================
  // Bridge API Contract Tests
  // ==========================================================================

  describe('bridge API contract', () => {
    /**
     * This test documents the contract between previewHtml.ts and app code.
     * Apps (like Data Studio) expect window.__sandbox to have these methods.
     *
     * If previewHtml changes, update this test AND the app bridge code.
     *
     * Related files:
     * - front_end/panels/ai_chat/sandbox_apps/apps/data-studio/sources.ts
     *   (defines sendAction() that calls window.__sandbox.sendAction)
     */
    it('provides all required methods for apps', () => {
      const html = createPreviewHtml();

      // Required by Data Studio (sources.ts sendAction function)
      assert.include(html, 'sendAction:', 'sendAction is required by Data Studio bridge');

      // Core state management API
      assert.include(html, 'getState:', 'getState is required for state access');
      assert.include(html, 'setState:', 'setState is required for full state replacement');
      assert.include(html, 'updateState:', 'updateState is required for path-based updates');
      assert.include(html, 'getAtPath:', 'getAtPath is required for nested state access');
      assert.include(html, 'dispatchAction:', 'dispatchAction is required for named actions');
    });

    it('sendAction sends action message to parent', () => {
      const html = createPreviewHtml();

      // Verify sendAction properly calls send() with action payload
      assert.include(html, 'sendAction: (action) =>');
      assert.include(html, "send({ type: 'action', payload: action })");
    });

    it('dispatchAction wraps action with name and context', () => {
      const html = createPreviewHtml();

      // dispatchAction has different semantics - wraps in { name, context }
      assert.include(html, 'dispatchAction: (name, context = {}) =>');
      assert.include(html, "send({ type: 'action', payload: { name, context } })");
    });
  });
});
