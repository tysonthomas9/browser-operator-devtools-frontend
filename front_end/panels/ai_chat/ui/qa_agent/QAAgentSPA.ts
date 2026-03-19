// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * QA Agent SPA - Bundled HTML, CSS, and JS for the QA Agent web app
 *
 * This file exports the complete SPA as strings that can be injected via RenderWebAppTool.
 * The SPA communicates with DevTools via the Mini App protocol:
 * - SPA -> DevTools: window.__miniAppBridge_qa_agent(payload) (via Runtime.addBinding)
 * - DevTools -> SPA: window.miniApp.dispatch(action) (via Runtime.evaluate)
 * - State access: window.miniApp.getState() returns current state
 */

export const QAAgentSPA = {
  html: getHTML(),
  css: getCSS(),
  js: getJS(),
};

function getHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Agent</title>
</head>
<body>
  <div class="qa-agent">
    <!-- Header -->
    <header class="qa-header">
      <div class="header-left">
        <div class="header-icon">🧪</div>
        <h1 class="qa-title">QA Agent</h1>
      </div>
      <div class="header-actions">
        <button class="close-btn" id="close-btn" title="Close QA Agent"></button>
      </div>
    </header>

    <!-- Tab Bar -->
    <div class="tab-bar">
      <button class="tab-btn active" id="tests-tab" data-tab="tests">
        Tests
        <span class="tab-count" id="tests-count">0</span>
      </button>
      <button class="tab-btn" id="suites-tab" data-tab="suites">
        Suites
        <span class="tab-count" id="suites-count">0</span>
      </button>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- List Panel (Left) -->
      <div class="list-panel">
        <div class="list-header">
          <button class="btn btn-primary" id="new-item-btn">
            + New Test
          </button>
        </div>
        <div class="list-container" id="list-container">
          <!-- Items will be rendered here -->
          <div class="empty-list" id="empty-list">
            <div class="empty-icon">📋</div>
            <p>No test cases yet</p>
            <p class="empty-hint">Create a test to get started</p>
          </div>
        </div>
      </div>

      <!-- Editor Panel (Right) -->
      <div class="editor-panel" id="editor-panel">
        <!-- Empty State -->
        <div class="editor-empty" id="editor-empty">
          <div class="empty-icon">🧪</div>
          <h3>Select a test to view or edit</h3>
          <p>Or create a new test to get started</p>
        </div>

        <!-- Test Editor -->
        <div class="test-editor" id="test-editor" style="display: none;">
          <div class="editor-header">
            <button class="btn btn-text" id="back-to-list-btn">← Back</button>
            <div class="editor-actions">
              <button class="btn btn-danger" id="delete-test-btn">Delete</button>
              <button class="btn btn-primary" id="save-test-btn">Save</button>
            </div>
          </div>

          <div class="editor-form">
            <div class="form-group">
              <label for="test-name">Name</label>
              <input type="text" id="test-name" placeholder="e.g., Login Flow Test">
            </div>

            <div class="form-group">
              <label for="test-url">Starting URL</label>
              <input type="url" id="test-url" placeholder="https://example.com/login">
            </div>

            <div class="form-group">
              <label for="test-description">Description (Natural Language)</label>
              <textarea id="test-description" rows="4" placeholder="Describe what the test should do in plain English...&#10;&#10;Example: Navigate to the login page, enter username 'testuser' and password 'pass123', click the login button, and verify that the welcome message appears."></textarea>
            </div>

            <div class="form-group">
              <div class="steps-header">
                <label>Generated Test Script</label>
                <button class="btn btn-secondary" id="generate-steps-btn">
                  ✨ Generate Script
                </button>
              </div>
              <div class="steps-container" id="steps-container">
                <div class="steps-empty" id="steps-empty">
                  <p>No test script generated yet.</p>
                  <p class="hint">Enter a description above and click "Generate Script" to create an executable JavaScript test.</p>
                </div>
                <div class="code-viewer" id="code-viewer" style="display: none;">
                  <div class="code-header">
                    <span class="code-lang">JavaScript</span>
                    <button class="btn btn-text btn-small" id="copy-code-btn">📋 Copy</button>
                  </div>
                  <pre class="code-block"><code id="code-content"></code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="editor-footer">
            <button class="btn btn-success btn-large" id="run-test-btn">
              ▶ Run Test
            </button>
          </div>
        </div>

        <!-- Suite Editor -->
        <div class="suite-editor" id="suite-editor" style="display: none;">
          <div class="editor-header">
            <button class="btn btn-text" id="back-to-list-suite-btn">← Back</button>
            <div class="editor-actions">
              <button class="btn btn-danger" id="delete-suite-btn">Delete</button>
              <button class="btn btn-primary" id="save-suite-btn">Save</button>
            </div>
          </div>

          <div class="editor-form">
            <div class="form-group">
              <label for="suite-name">Suite Name</label>
              <input type="text" id="suite-name" placeholder="e.g., Smoke Tests">
            </div>

            <div class="form-group">
              <label for="suite-description">Description</label>
              <textarea id="suite-description" rows="2" placeholder="What tests does this suite contain?"></textarea>
            </div>

            <div class="form-group">
              <label>Test Cases in Suite</label>
              <div class="suite-tests-container" id="suite-tests-container">
                <div class="suite-tests-empty">No tests in suite</div>
              </div>
            </div>

            <div class="form-group">
              <label>Available Tests</label>
              <div class="available-tests-container" id="available-tests-container">
                <!-- Available tests will be rendered here -->
              </div>
            </div>
          </div>

          <div class="editor-footer">
            <button class="btn btn-success btn-large" id="run-suite-btn">
              ▶ Run Suite
            </button>
          </div>
        </div>

        <!-- Test Run View -->
        <div class="run-view" id="run-view" style="display: none;">
          <div class="run-header">
            <h2 id="run-title">Running Test</h2>
            <div class="run-status" id="run-status">
              <span class="status-indicator running"></span>
              <span class="status-text">Running...</span>
            </div>
          </div>

          <div class="run-progress">
            <div class="progress-bar">
              <div class="progress-fill" id="progress-fill"></div>
            </div>
            <div class="progress-text" id="progress-text">Step 0 of 0</div>
          </div>

          <div class="run-steps" id="run-steps">
            <!-- Step results will be rendered here -->
          </div>

          <div class="run-footer">
            <button class="btn btn-warning" id="abort-btn">✕ Abort</button>
            <button class="btn btn-secondary" id="close-run-btn" style="display: none;">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div class="toast" id="toast">
      <span class="toast-message" id="toast-message"></span>
    </div>
  </div>
</body>
</html>
`;
}

function getCSS(): string {
  return `
    :root {
      --primary: #00a4fe;
      --primary-hover: #0090e0;
      --primary-light: #def1fb;
      --success: #22c55e;
      --success-light: #dcfce7;
      --warning: #f59e0b;
      --warning-light: #fef3c7;
      --danger: #ef4444;
      --danger-light: #fee2e2;
      --surface: #ffffff;
      --background: #f5f7fa;
      --text-primary: #202124;
      --text-secondary: #5f6368;
      --text-muted: #9aa0a6;
      --border: rgba(0, 0, 0, 0.08);
      --border-dark: rgba(0, 0, 0, 0.15);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--background);
      line-height: 1.5;
    }

    .qa-agent {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* Header */
    .qa-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon {
      font-size: 24px;
    }

    .qa-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: var(--radius-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-secondary);
      font-size: 20px;
    }

    .close-btn::before {
      content: '×';
    }

    .close-btn:hover {
      background: var(--background);
    }

    /* Tab Bar */
    .tab-bar {
      display: flex;
      gap: 4px;
      padding: 8px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn:hover {
      background: var(--background);
    }

    .tab-btn.active {
      background: var(--primary-light);
      color: var(--primary);
    }

    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      background: var(--background);
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
    }

    .tab-btn.active .tab-count {
      background: var(--primary);
      color: white;
    }

    /* Main Content */
    .main-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* List Panel */
    .list-panel {
      width: 280px;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border-right: 1px solid var(--border);
    }

    .list-header {
      padding: 12px;
      border-bottom: 1px solid var(--border);
    }

    .list-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .empty-list {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: var(--text-secondary);
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .empty-hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* List Item */
    .list-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 4px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .list-item:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow-sm);
    }

    .list-item.selected {
      background: var(--primary-light);
      border-color: var(--primary);
    }

    .item-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      flex-shrink: 0;
    }

    .item-status.passed {
      background: var(--success);
    }

    .item-status.failed {
      background: var(--danger);
    }

    .item-status.running {
      background: var(--primary);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .item-content {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Editor Panel */
    .editor-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--background);
    }

    .editor-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: var(--text-secondary);
    }

    .editor-empty .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .editor-empty h3 {
      margin-bottom: 8px;
    }

    /* Test Editor */
    .test-editor,
    .suite-editor {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .editor-actions {
      display: flex;
      gap: 8px;
    }

    .editor-form {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
      color: var(--text-primary);
    }

    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-dark);
      border-radius: var(--radius-md);
      font-size: 14px;
      background: var(--surface);
      transition: border-color 0.15s ease;
    }

    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--primary);
    }

    .form-group textarea {
      resize: vertical;
      min-height: 100px;
    }

    /* Steps */
    .steps-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .steps-container {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      min-height: 150px;
      max-height: 300px;
      overflow-y: auto;
    }

    .steps-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: var(--text-muted);
    }

    .steps-empty .hint {
      font-size: 12px;
      margin-top: 4px;
    }

    .steps-list {
      padding: 8px;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px;
      margin-bottom: 6px;
      background: var(--background);
      border-radius: var(--radius-sm);
    }

    .step-number {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary);
      color: white;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-content {
      flex: 1;
    }

    .step-type {
      display: inline-block;
      padding: 2px 8px;
      background: var(--primary-light);
      color: var(--primary);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .step-description {
      font-size: 13px;
      color: var(--text-primary);
    }

    /* Editor Footer */
    .editor-footer {
      padding: 12px 16px;
      background: var(--surface);
      border-top: 1px solid var(--border);
      text-align: center;
    }

    /* Run View */
    .run-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
    }

    .run-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .run-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status-indicator.running {
      background: var(--primary);
      animation: pulse 1s infinite;
    }

    .status-indicator.passed {
      background: var(--success);
    }

    .status-indicator.failed {
      background: var(--danger);
    }

    .status-indicator.aborted {
      background: var(--warning);
    }

    .run-progress {
      margin-bottom: 16px;
    }

    .progress-bar {
      height: 8px;
      background: var(--background);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: var(--primary);
      width: 0%;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-secondary);
      text-align: center;
    }

    .run-steps {
      flex: 1;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 8px;
    }

    .run-step {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-radius: var(--radius-sm);
      margin-bottom: 6px;
    }

    .run-step.passed {
      background: var(--success-light);
    }

    .run-step.failed {
      background: var(--danger-light);
    }

    .run-step.pending {
      background: var(--background);
      opacity: 0.6;
    }

    .run-step.running {
      background: var(--primary-light);
    }

    .run-step-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }

    .run-step-content {
      flex: 1;
    }

    .run-step-duration {
      font-size: 12px;
      color: var(--text-muted);
    }

    .run-footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
    }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    .btn-secondary {
      background: var(--background);
      color: var(--text-primary);
      border: 1px solid var(--border-dark);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--border);
    }

    .btn-success {
      background: var(--success);
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #16a34a;
    }

    .btn-danger {
      background: var(--danger);
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #dc2626;
    }

    .btn-warning {
      background: var(--warning);
      color: white;
    }

    .btn-warning:hover:not(:disabled) {
      background: #d97706;
    }

    .btn-text {
      background: transparent;
      color: var(--text-secondary);
      padding: 8px 12px;
    }

    .btn-text:hover:not(:disabled) {
      color: var(--text-primary);
      background: var(--background);
    }

    .btn-large {
      padding: 12px 24px;
      font-size: 15px;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: var(--text-primary);
      color: white;
      padding: 12px 20px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-md);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 1000;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    .toast.success {
      background: var(--success);
    }

    .toast.error {
      background: var(--danger);
    }

    .toast.warning {
      background: var(--warning);
    }

    .toast.info {
      background: var(--primary);
    }

    /* Suite Tests */
    .suite-tests-container,
    .available-tests-container {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      max-height: 200px;
      overflow-y: auto;
    }

    .suite-test-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }

    .suite-test-item:last-child {
      border-bottom: none;
    }

    .suite-tests-empty {
      padding: 20px;
      text-align: center;
      color: var(--text-muted);
    }

    /* Code Viewer */
    .code-viewer {
      background: #1e1e1e;
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #2d2d2d;
      border-bottom: 1px solid #3d3d3d;
    }

    .code-lang {
      font-size: 11px;
      font-weight: 600;
      color: #9aa0a6;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-small {
      padding: 4px 8px;
      font-size: 12px;
    }

    .code-block {
      margin: 0;
      padding: 12px;
      max-height: 400px;
      overflow: auto;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #d4d4d4;
      white-space: pre;
      tab-size: 2;
    }

    .code-block code {
      font-family: inherit;
    }

    /* Simple syntax highlighting classes */
    .code-block .keyword { color: #569cd6; }
    .code-block .string { color: #ce9178; }
    .code-block .number { color: #b5cea8; }
    .code-block .comment { color: #6a9955; }
    .code-block .function { color: #dcdcaa; }
    .code-block .operator { color: #d4d4d4; }
  `;
}

function getJS(): string {
  return `
    (function() {
      'use strict';

      // State
      let state = {
        activeTab: 'tests',
        testCases: [],
        testSuites: [],
        selectedTest: null,
        selectedSuite: null,
        currentRun: null,
        isNew: false,
        isGeneratingSteps: false,
        isRunningTest: false,
      };

      // DOM Elements
      const elements = {
        // Tabs
        testsTab: document.getElementById('tests-tab'),
        suitesTab: document.getElementById('suites-tab'),
        testsCount: document.getElementById('tests-count'),
        suitesCount: document.getElementById('suites-count'),

        // List
        listContainer: document.getElementById('list-container'),
        emptyList: document.getElementById('empty-list'),
        newItemBtn: document.getElementById('new-item-btn'),

        // Editor
        editorPanel: document.getElementById('editor-panel'),
        editorEmpty: document.getElementById('editor-empty'),
        testEditor: document.getElementById('test-editor'),
        suiteEditor: document.getElementById('suite-editor'),
        runView: document.getElementById('run-view'),

        // Test Form
        testName: document.getElementById('test-name'),
        testUrl: document.getElementById('test-url'),
        testDescription: document.getElementById('test-description'),
        stepsContainer: document.getElementById('steps-container'),
        stepsEmpty: document.getElementById('steps-empty'),
        codeViewer: document.getElementById('code-viewer'),
        codeContent: document.getElementById('code-content'),
        copyCodeBtn: document.getElementById('copy-code-btn'),

        // Test Buttons
        backToListBtn: document.getElementById('back-to-list-btn'),
        deleteTestBtn: document.getElementById('delete-test-btn'),
        saveTestBtn: document.getElementById('save-test-btn'),
        generateStepsBtn: document.getElementById('generate-steps-btn'),
        runTestBtn: document.getElementById('run-test-btn'),

        // Suite Form
        suiteName: document.getElementById('suite-name'),
        suiteDescription: document.getElementById('suite-description'),
        suiteTestsContainer: document.getElementById('suite-tests-container'),
        availableTestsContainer: document.getElementById('available-tests-container'),

        // Suite Buttons
        backToListSuiteBtn: document.getElementById('back-to-list-suite-btn'),
        deleteSuiteBtn: document.getElementById('delete-suite-btn'),
        saveSuiteBtn: document.getElementById('save-suite-btn'),
        runSuiteBtn: document.getElementById('run-suite-btn'),

        // Run View
        runTitle: document.getElementById('run-title'),
        runStatus: document.getElementById('run-status'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        runSteps: document.getElementById('run-steps'),
        abortBtn: document.getElementById('abort-btn'),
        closeRunBtn: document.getElementById('close-run-btn'),

        // Other
        closeBtn: document.getElementById('close-btn'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message'),
      };

      // Initialize
      function init() {
        setupEventListeners();
        sendToDevTools({ type: 'ready' });
      }

      // Event Listeners
      function setupEventListeners() {
        // Close button
        elements.closeBtn.addEventListener('click', () => {
          sendToDevTools({ type: 'close' });
        });

        // Tabs
        elements.testsTab.addEventListener('click', () => switchTab('tests'));
        elements.suitesTab.addEventListener('click', () => switchTab('suites'));

        // New item
        elements.newItemBtn.addEventListener('click', () => {
          if (state.activeTab === 'tests') {
            sendToDevTools({ type: 'new-test' });
          } else {
            sendToDevTools({ type: 'new-suite' });
          }
        });

        // Test editor
        elements.backToListBtn.addEventListener('click', backToList);
        elements.deleteTestBtn.addEventListener('click', () => sendToDevTools({ type: 'delete-test' }));
        elements.saveTestBtn.addEventListener('click', saveTest);
        elements.generateStepsBtn.addEventListener('click', () => {
          const data = {
            name: elements.testName.value.trim(),
            description: elements.testDescription.value.trim(),
            url: elements.testUrl.value.trim(),
            steps: state.selectedTest?.steps || [],
          };
          sendToDevTools({ type: 'generate-steps', data });
        });
        elements.runTestBtn.addEventListener('click', () => sendToDevTools({ type: 'run-test' }));

        // Copy code button
        elements.copyCodeBtn.addEventListener('click', () => {
          const code = state.selectedTest?.generatedCode || '';
          if (code) {
            navigator.clipboard.writeText(code).then(() => {
              showToast('Code copied to clipboard!', 'success');
            }).catch(() => {
              showToast('Failed to copy code', 'error');
            });
          }
        });

        // Suite editor
        elements.backToListSuiteBtn.addEventListener('click', backToList);
        elements.deleteSuiteBtn.addEventListener('click', () => sendToDevTools({ type: 'delete-suite' }));
        elements.saveSuiteBtn.addEventListener('click', saveSuite);
        elements.runSuiteBtn.addEventListener('click', () => sendToDevTools({ type: 'run-suite' }));

        // Run view
        elements.abortBtn.addEventListener('click', () => sendToDevTools({ type: 'abort-test' }));
        elements.closeRunBtn.addEventListener('click', backToList);
      }

      // Tab Switching
      function switchTab(tab) {
        state.activeTab = tab;
        elements.testsTab.classList.toggle('active', tab === 'tests');
        elements.suitesTab.classList.toggle('active', tab === 'suites');
        elements.newItemBtn.textContent = tab === 'tests' ? '+ New Test' : '+ New Suite';

        renderList();
        showEmptyEditor();
        sendToDevTools({ type: 'select-tab', tab });
      }

      // Rendering
      function renderList() {
        const items = state.activeTab === 'tests' ? state.testCases : state.testSuites;
        const selectedId = state.activeTab === 'tests' ? state.selectedTest?.id : state.selectedSuite?.id;

        if (items.length === 0) {
          elements.listContainer.innerHTML = '';
          elements.emptyList.style.display = 'flex';
          elements.emptyList.querySelector('p').textContent =
            state.activeTab === 'tests' ? 'No test cases yet' : 'No test suites yet';
          return;
        }

        elements.emptyList.style.display = 'none';

        const html = items.map(item => {
          const isSelected = item.id === selectedId;
          const statusClass = item.lastRunStatus || '';
          const meta = state.activeTab === 'tests'
            ? item.stepCount + ' steps'
            : item.testCount + ' tests';

          return \`
            <div class="list-item \${isSelected ? 'selected' : ''}" data-id="\${item.id}">
              <div class="item-status \${statusClass}"></div>
              <div class="item-content">
                <div class="item-name">\${escapeHtml(item.name)}</div>
                <div class="item-meta">\${meta}</div>
              </div>
            </div>
          \`;
        }).join('');

        elements.listContainer.innerHTML = html;

        // Add click handlers
        elements.listContainer.querySelectorAll('.list-item').forEach(el => {
          el.addEventListener('click', () => {
            const id = el.dataset.id;
            if (state.activeTab === 'tests') {
              sendToDevTools({ type: 'select-test', id });
            } else {
              sendToDevTools({ type: 'select-suite', id });
            }
          });
        });
      }

      function renderTestEditor(testCase, isNew) {
        state.selectedTest = testCase;
        state.isNew = isNew;

        elements.editorEmpty.style.display = 'none';
        elements.testEditor.style.display = 'flex';
        elements.suiteEditor.style.display = 'none';
        elements.runView.style.display = 'none';

        elements.testName.value = testCase.name || '';
        elements.testUrl.value = testCase.url || '';
        elements.testDescription.value = testCase.description || '';

        renderCode(testCase.generatedCode);

        elements.deleteTestBtn.style.display = isNew ? 'none' : 'inline-flex';
      }

      function renderCode(code) {
        if (!code) {
          elements.stepsEmpty.style.display = 'flex';
          elements.codeViewer.style.display = 'none';
          return;
        }

        elements.stepsEmpty.style.display = 'none';
        elements.codeViewer.style.display = 'block';

        // Apply simple syntax highlighting
        const highlighted = highlightJS(escapeHtml(code));
        elements.codeContent.innerHTML = highlighted;
      }

      // Simple JavaScript syntax highlighting
      function highlightJS(code) {
        // Keywords
        code = code.replace(/\\b(async|await|function|const|let|var|return|if|else|for|while|try|catch|throw|new|typeof|instanceof)\\b/g, '<span class="keyword">$1</span>');
        // Strings (double and single quotes)
        code = code.replace(/("(?:[^"\\\\\\\\]|\\\\\\\\.)*"|'(?:[^'\\\\\\\\]|\\\\\\\\.)*'|\`(?:[^\`\\\\\\\\]|\\\\\\\\.)*\`)/g, '<span class="string">$1</span>');
        // Numbers
        code = code.replace(/\\b(\\d+(\\.\\d+)?)\\b/g, '<span class="number">$1</span>');
        // Comments
        code = code.replace(/(\\/\\/.*$)/gm, '<span class="comment">$1</span>');
        code = code.replace(/(\\/\\*[\\s\\S]*?\\*\\/)/g, '<span class="comment">$1</span>');
        return code;
      }

      function renderSuiteEditor(testSuite, testCases, isNew) {
        state.selectedSuite = testSuite;
        state.isNew = isNew;

        elements.editorEmpty.style.display = 'none';
        elements.testEditor.style.display = 'none';
        elements.suiteEditor.style.display = 'flex';
        elements.runView.style.display = 'none';

        elements.suiteName.value = testSuite.name || '';
        elements.suiteDescription.value = testSuite.description || '';

        elements.deleteSuiteBtn.style.display = isNew ? 'none' : 'inline-flex';

        // Render tests in suite
        if (testCases && testCases.length > 0) {
          elements.suiteTestsContainer.innerHTML = testCases.map(tc => \`
            <div class="suite-test-item">
              <span>\${escapeHtml(tc.name)}</span>
              <button class="btn btn-text" onclick="removeFromSuite('\${tc.id}')">Remove</button>
            </div>
          \`).join('');
        } else {
          elements.suiteTestsContainer.innerHTML = '<div class="suite-tests-empty">No tests in suite</div>';
        }

        // Render available tests
        const suiteTestIds = testSuite.testCaseIds || [];
        const availableTests = state.testCases.filter(tc => !suiteTestIds.includes(tc.id));

        if (availableTests.length > 0) {
          elements.availableTestsContainer.innerHTML = availableTests.map(tc => \`
            <div class="suite-test-item">
              <span>\${escapeHtml(tc.name)}</span>
              <button class="btn btn-text" onclick="addToSuite('\${tc.id}')">Add</button>
            </div>
          \`).join('');
        } else {
          elements.availableTestsContainer.innerHTML = '<div class="suite-tests-empty">No tests available</div>';
        }
      }

      function renderRunView(run, testCase) {
        elements.editorEmpty.style.display = 'none';
        elements.testEditor.style.display = 'none';
        elements.suiteEditor.style.display = 'none';
        elements.runView.style.display = 'flex';

        elements.runTitle.textContent = 'Running: ' + testCase.name;

        updateRunStatus(run);
        renderRunResults(run.results || [], run.status, run.error);
      }

      function updateRunStatus(run) {
        const statusIndicator = elements.runStatus.querySelector('.status-indicator');
        const statusText = elements.runStatus.querySelector('.status-text');

        statusIndicator.className = 'status-indicator ' + run.status;

        const statusLabels = {
          running: 'Running...',
          passed: 'Passed',
          failed: 'Failed',
          aborted: 'Aborted',
        };
        statusText.textContent = statusLabels[run.status] || run.status;

        elements.abortBtn.style.display = run.status === 'running' ? 'inline-flex' : 'none';
        elements.closeRunBtn.style.display = run.status !== 'running' ? 'inline-flex' : 'none';
      }

      function renderRunResults(results, runStatus, runError) {
        // Show running state while script executes
        if (runStatus === 'running') {
          elements.progressFill.style.width = '50%';
          elements.progressText.textContent = 'Executing test script...';
          elements.runSteps.innerHTML = \`
            <div class="run-step running">
              <div class="run-step-icon">◉</div>
              <div class="run-step-content">Executing JavaScript test in browser...</div>
            </div>
          \`;
          return;
        }

        // Show results when complete
        if (!results || results.length === 0) {
          const passedCount = 0;
          const totalCount = 0;
          elements.progressFill.style.width = '100%';
          elements.progressText.textContent = runStatus === 'passed' ? 'Test passed!' : 'Test completed';

          if (runError) {
            elements.runSteps.innerHTML = \`
              <div class="run-step failed">
                <div class="run-step-icon">✗</div>
                <div class="run-step-content">\${escapeHtml(runError)}</div>
              </div>
            \`;
          } else {
            elements.runSteps.innerHTML = '<div class="suite-tests-empty">No step details available</div>';
          }
          return;
        }

        const passedCount = results.filter(r => r.status === 'passed').length;
        const totalCount = results.length;
        const progress = totalCount > 0 ? (passedCount / totalCount) * 100 : 100;

        elements.progressFill.style.width = progress + '%';
        elements.progressText.textContent = passedCount + ' of ' + totalCount + ' steps passed';

        const html = results.map((result, index) => {
          let statusClass = result.status || 'pending';
          let icon = '○';

          if (result.status === 'passed') {
            icon = '✓';
          } else if (result.status === 'failed') {
            icon = '✗';
          } else if (result.status === 'skipped') {
            icon = '−';
          }

          // Get step name from result (script returns step names)
          const stepName = result.name || result.stepId || ('Step ' + (index + 1));
          const errorText = result.error ? ' - ' + result.error : '';

          return \`
            <div class="run-step \${statusClass}">
              <div class="run-step-icon">\${icon}</div>
              <div class="run-step-content">\${escapeHtml(stepName + errorText)}</div>
            </div>
          \`;
        }).join('');

        elements.runSteps.innerHTML = html;
      }

      function showEmptyEditor() {
        state.selectedTest = null;
        state.selectedSuite = null;
        state.isNew = false;

        elements.editorEmpty.style.display = 'flex';
        elements.testEditor.style.display = 'none';
        elements.suiteEditor.style.display = 'none';
        elements.runView.style.display = 'none';
      }

      // Actions
      function backToList() {
        showEmptyEditor();
        state.selectedTest = null;
        state.selectedSuite = null;
        renderList();
      }

      function saveTest() {
        const data = {
          name: elements.testName.value.trim(),
          description: elements.testDescription.value.trim(),
          url: elements.testUrl.value.trim(),
          steps: state.selectedTest?.steps || [],
        };

        if (!data.name) {
          showToast('Please enter a test name', 'error');
          return;
        }

        if (!data.url) {
          showToast('Please enter a starting URL', 'error');
          return;
        }

        sendToDevTools({ type: 'save-test', data });
      }

      function saveSuite() {
        const data = {
          name: elements.suiteName.value.trim(),
          description: elements.suiteDescription.value.trim(),
          testCaseIds: state.selectedSuite?.testCaseIds || [],
        };

        if (!data.name) {
          showToast('Please enter a suite name', 'error');
          return;
        }

        sendToDevTools({ type: 'save-suite', data });
      }

      // Suite actions (global for onclick)
      window.addToSuite = function(testId) {
        if (state.selectedSuite) {
          sendToDevTools({
            type: 'add-to-suite',
            testId,
            suiteId: state.selectedSuite.id,
          });
        }
      };

      window.removeFromSuite = function(testId) {
        if (state.selectedSuite) {
          sendToDevTools({
            type: 'remove-from-suite',
            testId,
            suiteId: state.selectedSuite.id,
          });
        }
      };

      // Toast
      function showToast(message, type = 'info') {
        elements.toastMessage.textContent = message;
        elements.toast.className = 'toast ' + type + ' show';

        setTimeout(() => {
          elements.toast.classList.remove('show');
        }, 3000);
      }

      // Communication
      function sendToDevTools(payload) {
        if (typeof window.__miniAppBridge_qa_agent === 'function') {
          window.__miniAppBridge_qa_agent(JSON.stringify(payload));
        }
      }

      // DevTools -> SPA callbacks
      window.onMiniAppStateChange = function(newState) {
        Object.assign(state, newState);
        elements.testsCount.textContent = state.testCases?.length || 0;
        elements.suitesCount.textContent = state.testSuites?.length || 0;
        renderList();
      };

      window.onMiniAppDispatch = function(action) {
        switch (action.action) {
          case 'init':
            state.testCases = action.payload.testCases || [];
            state.testSuites = action.payload.testSuites || [];
            state.activeTab = action.payload.activeTab || 'tests';
            elements.testsCount.textContent = state.testCases.length;
            elements.suitesCount.textContent = state.testSuites.length;
            renderList();
            break;

          case 'test-selected':
            state.testCases = state.testCases; // Keep existing
            renderList();
            renderTestEditor(action.payload.testCase, action.payload.isNew || false);
            break;

          case 'test-saved':
            state.testCases = action.payload.testCases || state.testCases;
            state.selectedTest = action.payload.testCase;
            elements.testsCount.textContent = state.testCases.length;
            renderList();
            break;

          case 'tests-updated':
            state.testCases = action.payload.testCases || [];
            elements.testsCount.textContent = state.testCases.length;
            renderList();
            showEmptyEditor();
            break;

          case 'suite-selected':
            state.testSuites = state.testSuites; // Keep existing
            renderList();
            renderSuiteEditor(action.payload.testSuite, action.payload.testCases, action.payload.isNew || false);
            break;

          case 'suite-saved':
            state.testSuites = action.payload.testSuites || state.testSuites;
            state.selectedSuite = action.payload.testSuite;
            elements.suitesCount.textContent = state.testSuites.length;
            renderList();
            break;

          case 'suites-updated':
            state.testSuites = action.payload.testSuites || [];
            elements.suitesCount.textContent = state.testSuites.length;
            renderList();
            if (state.activeTab === 'suites') {
              showEmptyEditor();
            }
            break;

          case 'generating-steps':
            state.isGeneratingSteps = action.payload.isGenerating;
            elements.generateStepsBtn.disabled = state.isGeneratingSteps;
            elements.generateStepsBtn.textContent = state.isGeneratingSteps
              ? 'Generating...'
              : '✨ Generate Script';
            break;

          case 'steps-generated':
            if (state.selectedTest) {
              state.selectedTest.generatedCode = action.payload.generatedCode;
              state.selectedTest = action.payload.testCase;
              renderCode(action.payload.generatedCode);
            }
            break;

          case 'test-running':
            state.isRunningTest = true;
            state.currentRun = action.payload.run;
            renderRunView(action.payload.run, action.payload.testCase);
            break;

          case 'test-progress':
            if (state.currentRun) {
              state.currentRun.results = action.payload.results;
              renderRunResults(action.payload.results, 'running', null);
            }
            break;

          case 'test-completed':
            state.isRunningTest = false;
            state.currentRun = action.payload.run;
            updateRunStatus(action.payload.run);
            renderRunResults(
              action.payload.run.results || [],
              action.payload.run.status,
              action.payload.run.error
            );

            // After a brief delay to show final status, navigate back to test detail
            setTimeout(() => {
              const testCaseId = action.payload.run?.testCaseId;
              if (testCaseId) {
                // Refresh test detail to show updated last run status
                sendToDevTools({ type: 'select-test-by-id', id: testCaseId });
              }
            }, 1500);  // 1.5 second delay to see final status
            break;

          case 'notification':
            showToast(action.payload.message, action.payload.type);
            break;
        }
      };

      window.getMiniAppState = function() {
        return state;
      };

      // Utility
      function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      // History management (for URL routing)
      function pushHistoryState() {
        if (window.miniAppRouter) {
          if (state.selectedTest) {
            window.miniAppRouter.navigate('test', { id: state.selectedTest.id });
          } else if (state.selectedSuite) {
            window.miniAppRouter.navigate('suite', { id: state.selectedSuite.id });
          } else {
            window.miniAppRouter.navigate('list');
          }
        }
      }

      window.onRouteChange = function(routeName, params) {
        if (routeName === 'test' && params.id) {
          sendToDevTools({ type: 'select-test-by-id', id: params.id });
        } else if (routeName === 'suite' && params.id) {
          sendToDevTools({ type: 'select-suite-by-id', id: params.id });
        } else {
          backToList();
        }
      };

      window.onRouteRestore = window.onRouteChange;

      // Start
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
  `;
}
