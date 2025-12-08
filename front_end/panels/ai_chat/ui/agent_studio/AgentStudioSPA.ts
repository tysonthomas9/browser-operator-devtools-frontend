// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Agent Studio SPA - Bundled HTML, CSS, and JS for the Agent Studio web app
 *
 * This file exports the complete SPA as strings that can be injected via RenderWebAppTool.
 * The SPA communicates with DevTools via the Mini App protocol:
 * - SPA → DevTools: window.__miniAppBridge_agent_studio(payload) (via Runtime.addBinding)
 * - DevTools → SPA: window.miniApp.dispatch(action) (via Runtime.evaluate)
 * - State access: window.miniApp.getState() returns current state
 */

export const AgentStudioSPA = {
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
  <title>Agent Studio</title>
</head>
<body>
  <div class="agent-studio">
    <!-- Header -->
    <header class="studio-header">
      <div class="header-left">
        <div class="header-icon" id="header-icon"></div>
        <h1 class="studio-title">Agent Studio</h1>
      </div>
      <button class="close-btn" id="close-btn" title="Close Agent Studio"></button>
    </header>

    <!-- Main Content -->
    <div class="studio-content">
      <!-- Left Panel: Agent List -->
      <aside class="agent-list-panel">
        <button class="new-agent-btn" id="new-agent-btn">
          <span class="btn-icon-inline" id="new-agent-icon"></span>
          New Agent
        </button>

        <div class="agent-list-section">
          <h3 class="section-title">Built-in Agents</h3>
          <div class="agent-list" id="built-in-agents">
            <div class="empty-message">Loading...</div>
          </div>
        </div>

        <div class="agent-list-section">
          <h3 class="section-title">Custom Agents</h3>
          <div class="agent-list" id="custom-agents">
            <div class="empty-message">Loading...</div>
          </div>
        </div>
      </aside>

      <!-- Right Panel: Agent Details -->
      <main class="agent-detail-panel" id="agent-detail-panel">
        <div class="empty-detail">
          <div class="empty-icon" id="empty-detail-icon"></div>
          <h2>Select an Agent</h2>
          <p>Choose an agent from the list to view or edit, or create a new one.</p>
        </div>
      </main>
    </div>

    <!-- Notification Toast -->
    <div id="notification" class="notification hidden"></div>

    <!-- Test Panel (Collapsible) -->
    <div class="test-panel" id="test-panel" style="display: none;">
      <div class="test-panel-header">
        <h3>Test Agent</h3>
        <button class="test-panel-close" id="test-panel-close"></button>
      </div>
      <div class="test-panel-content">
        <div class="test-input-group">
          <label for="test-input">Test Query</label>
          <textarea id="test-input" rows="3" placeholder="Enter a test query for the agent..."></textarea>
        </div>
        <button class="btn btn-primary" id="run-test-btn">
          <span class="btn-icon-inline" id="run-test-icon"></span>
          Run Test
        </button>
        <div class="test-results" id="test-results">
          <div class="test-results-placeholder">Results will appear here after running a test</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function getCSS(): string {
  return `
/* Design tokens matching DevTools */
:root {
  --primary: #00a4fe;
  --primary-hover: #0090e0;
  --primary-light: #def1fb;
  --primary-container: #e2f3fb;
  --primary-shadow: rgba(0, 164, 254, 0.2);
  --surface: #ffffff;
  --surface-variant: #f8f9fa;
  --background: #f5f7fa;
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --text-tertiary: #80868b;
  --text-on-primary: #ffffff;
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  --border-hover: rgba(0, 164, 254, 0.4);
  --success: #34a853;
  --success-light: #e6f4ea;
  --warning: #ea8600;
  --warning-light: #fef7e0;
  --error: #d93025;
  --error-light: #fce8e6;
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 8px 24px rgba(0, 0, 0, 0.16), 0 16px 48px rgba(0, 0, 0, 0.12);
  --shadow-primary: 0 4px 14px var(--primary-shadow);
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Reset and Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--background);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.agent-studio {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--surface);
}

/* Header */
.studio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  border-radius: var(--radius-sm);
  color: var(--primary);
}

.header-icon svg {
  width: 18px;
  height: 18px;
}

.studio-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--error-light);
  color: var(--error);
}

.close-btn:active {
  transform: scale(0.95);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

/* Main Content */
.studio-content {
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
}

/* Agent List Panel */
.agent-list-panel {
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px;
}

.new-agent-btn {
  width: 100%;
  padding: 10px 16px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 20px;
}

.new-agent-btn:hover {
  background: var(--primary-hover);
  box-shadow: var(--shadow-primary);
}

.new-agent-btn:active {
  transform: scale(0.98);
}

.agent-list-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  padding: 0 4px;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: transparent;
  border: 1px solid transparent;
  position: relative;
}

.agent-list-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 3px;
  background: var(--primary);
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  transform: scaleY(0);
  transition: transform var(--transition-normal);
}

.agent-list-item:hover {
  background: var(--primary-container);
}

.agent-list-item:hover::before {
  transform: scaleY(1);
}

.agent-list-item.selected {
  background: var(--primary-light);
  border-color: var(--border-hover);
}

.agent-list-item.selected::before {
  transform: scaleY(1);
}

.agent-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  font-size: 14px;
  flex-shrink: 0;
}

.agent-avatar svg {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.agent-display-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-weight: 500;
}

.built-in-badge {
  background: var(--surface-variant);
  color: var(--text-tertiary);
}

.empty-message {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 12px;
  text-align: center;
  font-style: italic;
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
}

/* Agent Detail Panel */
.agent-detail-panel {
  overflow-y: auto;
  padding: 24px 32px;
  background: var(--background);
}

.agent-form {
  max-width: 900px;
  margin: 0 auto;
}

.form-section {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
  position: relative;
}

.form-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  transform: scaleX(0);
  transition: transform var(--transition-normal);
}

.form-section:hover::before {
  transform: scaleX(1);
}

.form-section .section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  text-transform: none;
  letter-spacing: normal;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section .section-title svg {
  width: 16px;
  height: 16px;
  color: var(--primary);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input[type="text"],
.form-group input[type="number"],
.form-group textarea {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  background: var(--surface);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.form-group input:disabled,
.form-group textarea:disabled {
  background: var(--surface-variant);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-tertiary);
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

#agent-prompt {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  min-height: 200px;
}

.field-hint {
  font-size: 11px;
  color: var(--text-tertiary);
}

.avatar-group input {
  width: 60px;
  text-align: center;
  font-size: 20px;
}

.color-group {
  max-width: 100px;
}

.color-group input[type="color"] {
  width: 100%;
  height: 38px;
  padding: 2px;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.color-group input[type="color"]:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

/* Tools Section */
.tools-search {
  margin-bottom: 12px;
}

.tools-search input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--surface);
  transition: all var(--transition-fast);
}

.tools-search input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.tools-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-variant);
}

.tool-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border-bottom: 1px solid var(--border);
}

.tool-item:last-child {
  border-bottom: none;
}

.tool-item:hover {
  background: var(--primary-container);
}

.tool-item.selected {
  background: var(--primary-light);
}

.tool-item input[type="checkbox"] {
  margin-top: 3px;
  cursor: pointer;
  accent-color: var(--primary);
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  min-width: 150px;
}

.tool-description {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-icon-inline {
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon-inline svg {
  width: 16px;
  height: 16px;
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
  box-shadow: var(--shadow-primary);
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-secondary {
  background: var(--surface-variant);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--surface);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.btn-danger {
  background: var(--error-light);
  color: var(--error);
}

.btn-danger:hover {
  background: rgba(217, 48, 37, 0.15);
}

.btn-danger:active {
  transform: scale(0.98);
}

/* Form Actions */
.form-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  margin-top: 20px;
}

/* Empty State */
.empty-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 48px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-variant);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
  color: var(--text-tertiary);
}

.empty-icon svg {
  width: 32px;
  height: 32px;
}

.empty-detail h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.empty-detail p {
  font-size: 14px;
  color: var(--text-secondary);
  max-width: 280px;
}

/* Notification Toast */
.notification {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  z-index: 1100;
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.notification.error {
  background: var(--error);
  color: var(--text-on-primary);
}

.notification.success {
  background: var(--success);
  color: var(--text-on-primary);
}

.notification.warning {
  background: var(--warning);
  color: var(--text-on-primary);
}

.notification.hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
  pointer-events: none;
}

.notification svg {
  width: 18px;
  height: 18px;
}

/* Test Panel */
.test-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: var(--shadow-xl);
  padding: 20px 32px;
  z-index: 100;
  animation: slideInUp 0.25s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.test-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.test-panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.test-panel-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.test-panel-close:hover {
  background: var(--surface-variant);
  color: var(--text-primary);
}

.test-panel-close svg {
  width: 16px;
  height: 16px;
}

.test-panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.test-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-input-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.test-input-group textarea {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  background: var(--surface);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.test-input-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.test-results {
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  padding: 16px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
}

.test-results-placeholder {
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}
  `.trim();
}

function getJS(): string {
  return `
// Agent Studio SPA - Main Application Logic

// Lucide Icons as SVG strings
const Icons = {
  bot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  save: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  fileText: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  wrench: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
};

// State
let state = {
  agents: [],
  tools: [],
  selectedAgent: null,
  isCreatingNew: false,
};

// Track last pushed history state to prevent duplicates
let lastHistoryAgentName = null;
let lastHistoryIsNew = false;

// ==========================================
// Browser History API Integration
// ==========================================

/**
 * Push a new history state when selecting/deselecting agents.
 * Uses pushState so browser back/forward buttons work.
 */
function pushHistoryState() {
  const currentAgentName = state.selectedAgent?.name || null;
  const currentIsNew = state.isCreatingNew;

  // Don't push duplicate states
  if (currentAgentName === lastHistoryAgentName && currentIsNew === lastHistoryIsNew) {
    return;
  }

  const stateObj = {
    selectedAgent: currentAgentName,
    isCreatingNew: currentIsNew,
    timestamp: Date.now()
  };

  let hash = '#agent-studio';
  if (currentIsNew) {
    hash = '#agent-studio/new';
  } else if (currentAgentName) {
    hash = '#agent-studio/agent/' + encodeURIComponent(currentAgentName);
  }

  // Use PARENT page's history so URL changes in browser address bar
  window.parent.history.pushState(stateObj, '', hash);

  lastHistoryAgentName = currentAgentName;
  lastHistoryIsNew = currentIsNew;

  console.log('[AgentStudio] Pushed history state:', stateObj);
}

/**
 * Replace current history state (used for initial load).
 * Doesn't create a new history entry.
 */
function replaceHistoryState() {
  const currentAgentName = state.selectedAgent?.name || null;
  const currentIsNew = state.isCreatingNew;

  const stateObj = {
    selectedAgent: currentAgentName,
    isCreatingNew: currentIsNew,
    timestamp: Date.now()
  };

  let hash = '#agent-studio';
  if (currentIsNew) {
    hash = '#agent-studio/new';
  } else if (currentAgentName) {
    hash = '#agent-studio/agent/' + encodeURIComponent(currentAgentName);
  }

  // Use PARENT page's history so URL changes in browser address bar
  window.parent.history.replaceState(stateObj, '', hash);

  lastHistoryAgentName = currentAgentName;
  lastHistoryIsNew = currentIsNew;

  console.log('[AgentStudio] Replaced history state:', stateObj);
}

/**
 * Restore the UI from a history state object.
 * Called when the browser back/forward buttons are pressed.
 */
function restoreFromHistoryState(historyState) {
  console.log('[AgentStudio] Restoring from history state:', historyState);

  // Update tracking to prevent re-pushing this state
  lastHistoryAgentName = historyState.selectedAgent;
  lastHistoryIsNew = historyState.isCreatingNew;

  if (historyState.isCreatingNew) {
    // Creating a new agent
    sendToDevTools({ type: 'new-agent' });
  } else if (historyState.selectedAgent) {
    // Select the agent
    sendToDevTools({
      type: 'select-agent',
      name: historyState.selectedAgent
    });
  } else {
    // Return to list (no agent selected)
    state.selectedAgent = null;
    state.isCreatingNew = false;
    renderEmptyState();
    updateListSelection(null);
  }
}

/**
 * Set up the popstate listener for browser navigation.
 * Listen on PARENT window since we're manipulating parent's history.
 */
function initHistoryListener() {
  window.parent.addEventListener('popstate', (e) => {
    if (e.state) {
      restoreFromHistoryState(e.state);
    } else {
      // No state means we're at the initial entry - show list
      lastHistoryAgentName = null;
      lastHistoryIsNew = false;
      state.selectedAgent = null;
      state.isCreatingNew = false;
      renderEmptyState();
      updateListSelection(null);
    }
  });
}

// ==========================================
// Icon Injection
// ==========================================

function injectIcons() {
  const iconMappings = {
    'header-icon': Icons.bot,
    'new-agent-icon': Icons.plus,
    'empty-detail-icon': Icons.bot,
    'run-test-icon': Icons.play
  };

  for (const [id, icon] of Object.entries(iconMappings)) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = icon;
    }
  }

  // Close buttons with X icon
  document.querySelectorAll('.close-btn, .test-panel-close').forEach(el => {
    if (!el.innerHTML.trim()) {
      el.innerHTML = Icons.x;
    }
  });
}

// ==========================================
// Bridge Communication (Mini App Protocol)
// ==========================================

// Send action to DevTools (via Runtime.addBinding)
function sendToDevTools(action) {
  if (typeof window.__miniAppBridge_agent_studio === 'function') {
    window.__miniAppBridge_agent_studio(JSON.stringify(action));
  } else {
    console.error('Bridge not available');
  }
}

// Mini App interface - Receive actions from DevTools
window.miniApp = {
  // Dispatch action from DevTools to SPA
  dispatch: function(message) {
    // Handle both string and object messages
    if (typeof message === 'string') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.error('[MiniApp] Failed to parse message:', e);
        return;
      }
    }

    const { action, payload } = message;
    console.log('[MiniApp] Received from DevTools:', action);

    switch (action) {
      case 'init':
        handleInit(payload);
        break;
      case 'agents-updated':
        handleAgentsUpdated(payload);
        break;
      case 'agent-selected':
        handleAgentSelected(payload);
        break;
      case 'notification':
        showNotification(payload.message, payload.type);
        break;
      case 'test-result':
        handleTestResult(payload);
        break;
      // Standard mini app protocol actions
      case 'get-state':
        // State is returned via getState() method
        break;
      case 'set-state':
        state = payload || {};
        renderAgentLists();
        if (state.selectedAgent) {
          renderAgentForm(state.selectedAgent);
        }
        break;
      case 'update-state':
        state = { ...state, ...(payload || {}) };
        renderAgentLists();
        if (state.selectedAgent) {
          renderAgentForm(state.selectedAgent);
        }
        break;
      case 'restore-state':
        // Restore from page refresh - request agent selection from DevTools
        console.log('[AgentStudio] Restoring state from page refresh:', payload);
        if (payload?.selectedAgentName) {
          sendToDevTools({
            type: 'select-agent',
            name: payload.selectedAgentName
          });
        } else if (payload?.isCreatingNew) {
          sendToDevTools({ type: 'new-agent' });
        }
        // Otherwise just show list (default state)
        break;
    }
  },

  // Get current state (called by DevTools)
  getState: function() {
    return state;
  },

  // Set entire state
  setState: function(newState) {
    state = newState;
    sendToDevTools({ type: 'state-changed', state: state });
  },

  // Update state partially
  updateState: function(updates) {
    state = { ...state, ...updates };
    sendToDevTools({ type: 'state-changed', state: state });
  },

  // Send action to DevTools
  sendAction: function(type, payload) {
    sendToDevTools({ type, payload });
  },

  // Close the mini app
  close: function() {
    sendToDevTools({ type: 'close' });
  }
};

// ==========================================
// Action Handlers
// ==========================================

function handleInit(payload) {
  state.agents = payload.agents || [];
  state.tools = payload.tools || [];
  state.selectedAgent = payload.selectedAgent || null;

  renderAgentLists();
  if (state.selectedAgent) {
    renderAgentForm(state.selectedAgent);
  }
}

function handleAgentsUpdated(payload) {
  state.agents = payload.agents || [];
  renderAgentLists();
}

function handleAgentSelected(payload) {
  state.selectedAgent = payload.agent;
  state.isCreatingNew = !payload.agent || !payload.agent.name;

  if (payload.agent) {
    renderAgentForm(payload.agent);
  } else {
    renderEmptyState();
  }

  // Update list selection
  updateListSelection(payload.agent?.name);

  // Update browser history for back/forward navigation
  pushHistoryState();
}

function handleTestResult(payload) {
  document.getElementById('test-results').innerHTML = payload.html;
}

// ==========================================
// Rendering Functions
// ==========================================

function renderAgentLists() {
  const builtIn = state.agents.filter(a => a.isBuiltIn);
  const custom = state.agents.filter(a => !a.isBuiltIn);

  const builtInContainer = document.getElementById('built-in-agents');
  const customContainer = document.getElementById('custom-agents');

  builtInContainer.innerHTML = builtIn.length
    ? builtIn.map(a => renderAgentListItem(a)).join('')
    : '<div class="empty-message">No built-in agents</div>';

  customContainer.innerHTML = custom.length
    ? custom.map(a => renderAgentListItem(a)).join('')
    : '<div class="empty-message">No custom agents yet</div>';

  // Attach click handlers
  document.querySelectorAll('.agent-list-item').forEach(item => {
    item.addEventListener('click', () => {
      sendToDevTools({
        type: 'select-agent',
        name: item.dataset.agentName,
        id: item.dataset.agentId || null,
        isBuiltIn: item.dataset.isBuiltIn === 'true',
      });
    });
  });
}

function renderAgentListItem(agent) {
  const isSelected = state.selectedAgent?.name === agent.name;
  // Use emoji if provided, otherwise use bot icon
  const avatarContent = agent.avatar && agent.avatar.trim() ? agent.avatar : Icons.bot;
  const isEmoji = agent.avatar && agent.avatar.trim() && !agent.avatar.includes('<svg');

  return \`
    <div class="agent-list-item \${isSelected ? 'selected' : ''} \${agent.isBuiltIn ? 'built-in' : ''}"
         data-agent-name="\${escapeHTML(agent.name)}"
         data-agent-id="\${agent.id || ''}"
         data-is-built-in="\${agent.isBuiltIn}">
      <span class="agent-avatar">\${isEmoji ? avatarContent : Icons.bot}</span>
      <span class="agent-display-name">\${escapeHTML(agent.displayName)}</span>
      \${agent.isBuiltIn ? '<span class="agent-badge built-in-badge">Built-in</span>' : ''}
    </div>
  \`;
}

function updateListSelection(selectedName) {
  document.querySelectorAll('.agent-list-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.agentName === selectedName);
  });
}

function renderEmptyState() {
  const panel = document.getElementById('agent-detail-panel');
  panel.innerHTML = \`
    <div class="empty-detail">
      <div class="empty-icon">\${Icons.bot}</div>
      <h2>Select an Agent</h2>
      <p>Choose an agent from the list to view or edit, or create a new one.</p>
    </div>
  \`;
}

function renderAgentForm(agent) {
  const isBuiltIn = agent.isBuiltIn;
  const isNew = !agent.name;
  const panel = document.getElementById('agent-detail-panel');

  const toolsHTML = state.tools.map(tool => {
    const isSelected = agent.tools?.includes(tool.name) || false;
    return \`
      <label class="tool-item \${isSelected ? 'selected' : ''}">
        <input type="checkbox" name="tools" value="\${escapeHTML(tool.name)}"
               \${isSelected ? 'checked' : ''} \${isBuiltIn ? 'disabled' : ''}>
        <span class="tool-name">\${escapeHTML(tool.name)}</span>
        <span class="tool-description">\${escapeHTML(tool.description)}</span>
      </label>
    \`;
  }).join('');

  panel.innerHTML = \`
    <form id="agent-form" class="agent-form">
      <!-- Basic Info Section -->
      <div class="form-section">
        <h3 class="section-title">\${Icons.info} Basic Information</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="agent-name">Name</label>
            <input type="text" id="agent-name" name="name"
                   value="\${escapeHTML(agent.name || '')}"
                   placeholder="my_custom_agent"
                   pattern="[a-z][-a-z0-9_]*"
                   \${isBuiltIn ? 'disabled' : ''}
                   required>
            <span class="field-hint">Lowercase letters, numbers, underscores, and hyphens</span>
          </div>
          <div class="form-group">
            <label for="agent-display-name">Display Name</label>
            <input type="text" id="agent-display-name" name="displayName"
                   value="\${escapeHTML(agent.displayName || '')}"
                   placeholder="My Custom Agent"
                   \${isBuiltIn ? 'disabled' : ''}
                   required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group avatar-group">
            <label for="agent-avatar">Avatar</label>
            <input type="text" id="agent-avatar" name="avatar"
                   value="\${agent.avatar || ''}"
                   maxlength="4"
                   placeholder="🤖"
                   \${isBuiltIn ? 'disabled' : ''}>
          </div>
          <div class="form-group color-group">
            <label for="agent-color">Color</label>
            <input type="color" id="agent-color" name="color"
                   value="\${agent.color || '#00a4fe'}"
                   \${isBuiltIn ? 'disabled' : ''}>
          </div>
        </div>

        <div class="form-group">
          <label for="agent-description">Description</label>
          <textarea id="agent-description" name="description" rows="2"
                    placeholder="Brief description of what this agent does"
                    \${isBuiltIn ? 'disabled' : ''}>\${escapeHTML(agent.description || '')}</textarea>
        </div>
      </div>

      <!-- System Prompt Section -->
      <div class="form-section">
        <h3 class="section-title">\${Icons.fileText} System Prompt</h3>
        <div class="form-group">
          <textarea id="agent-prompt" name="systemPrompt" rows="12"
                    placeholder="Enter the system prompt that defines how this agent behaves..."
                    \${isBuiltIn ? 'disabled' : ''}
                    required>\${escapeHTML(agent.systemPrompt || '')}</textarea>
          <span class="field-hint">\${isBuiltIn ? 'Built-in agents cannot be edited' : "Instructions that guide the agent's behavior"}</span>
        </div>
      </div>

      <!-- Tools Section -->
      <div class="form-section">
        <h3 class="section-title">\${Icons.wrench} Available Tools</h3>
        <div class="tools-search">
          <input type="text" id="tools-search" placeholder="Search tools..." \${isBuiltIn ? 'disabled' : ''}>
        </div>
        <div class="tools-list" id="tools-list">
          \${toolsHTML}
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="form-section">
        <h3 class="section-title">\${Icons.settings} Advanced Settings</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="agent-max-iterations">Max Iterations</label>
            <input type="number" id="agent-max-iterations" name="maxIterations"
                   value="\${agent.maxIterations || 10}"
                   min="1" max="100"
                   \${isBuiltIn ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label for="agent-temperature">Temperature</label>
            <input type="number" id="agent-temperature" name="temperature"
                   value="\${agent.temperature || 0}"
                   min="0" max="2" step="0.1"
                   \${isBuiltIn ? 'disabled' : ''}>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="form-actions">
        \${isBuiltIn ? \`
          <button type="button" class="btn btn-secondary" id="clone-btn">
            <span class="btn-icon-inline">\${Icons.copy}</span>
            Clone as Custom
          </button>
        \` : \`
          <button type="submit" class="btn btn-primary" id="save-btn">
            <span class="btn-icon-inline">\${Icons.save}</span>
            \${isNew ? 'Create Agent' : 'Save Changes'}
          </button>
          <button type="button" class="btn btn-secondary" id="test-btn">
            <span class="btn-icon-inline">\${Icons.play}</span>
            Test Agent
          </button>
          \${!isNew ? \`
            <button type="button" class="btn btn-danger" id="delete-btn">
              <span class="btn-icon-inline">\${Icons.trash}</span>
              Delete Agent
            </button>
          \` : ''}
        \`}
      </div>
    </form>
  \`;

  // Attach form event handlers
  attachFormHandlers(agent);
}

function attachFormHandlers(agent) {
  const form = document.getElementById('agent-form');
  const isBuiltIn = agent.isBuiltIn;

  // Form submission
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave();
  });

  // Clone button
  document.getElementById('clone-btn')?.addEventListener('click', () => {
    sendToDevTools({ type: 'clone-agent' });
  });

  // Delete button
  document.getElementById('delete-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      sendToDevTools({ type: 'delete-agent' });
    }
  });

  // Test button
  document.getElementById('test-btn')?.addEventListener('click', () => {
    document.getElementById('test-panel').style.display = 'block';
  });

  // Tools search
  document.getElementById('tools-search')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.tool-item').forEach(item => {
      const name = item.querySelector('.tool-name').textContent.toLowerCase();
      const desc = item.querySelector('.tool-description').textContent.toLowerCase();
      item.style.display = (name.includes(searchTerm) || desc.includes(searchTerm)) ? 'flex' : 'none';
    });
  });

  // Tool checkbox visual update
  document.querySelectorAll('.tool-item input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.target.closest('.tool-item').classList.toggle('selected', e.target.checked);
    });
  });
}

function handleSave() {
  const form = document.getElementById('agent-form');
  const formData = new FormData(form);

  // Collect selected tools
  const selectedTools = [];
  form.querySelectorAll('input[name="tools"]:checked').forEach(cb => {
    selectedTools.push(cb.value);
  });

  const agentData = {
    name: formData.get('name'),
    displayName: formData.get('displayName'),
    description: formData.get('description'),
    avatar: formData.get('avatar') || '',
    color: formData.get('color') || '#00a4fe',
    systemPrompt: formData.get('systemPrompt'),
    tools: selectedTools,
    maxIterations: parseInt(formData.get('maxIterations') || '10', 10),
    temperature: parseFloat(formData.get('temperature') || '0'),
    schema: state.selectedAgent?.schema || { type: 'object', properties: {} },
  };

  sendToDevTools({
    type: 'save-agent',
    data: agentData,
  });
}

// ==========================================
// Notification
// ==========================================

function showNotification(message, type) {
  type = type || 'error';
  const el = document.getElementById('notification');
  if (!el) return;

  const icon = type === 'success' ? Icons.check : type === 'error' ? Icons.alertCircle : Icons.alertCircle;
  el.innerHTML = icon + ' ' + escapeHTML(message);
  el.className = 'notification ' + type;
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ==========================================
// Utilities
// ==========================================

function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// Initialization
// ==========================================

let initialized = false;

function init() {
  // Prevent double initialization
  if (initialized) return;
  initialized = true;

  console.log('[AgentStudio] Initializing...');

  // Set up browser history navigation (back/forward buttons)
  initHistoryListener();
  replaceHistoryState();

  // Inject icons
  injectIcons();

  // Close button
  document.getElementById('close-btn')?.addEventListener('click', () => {
    sendToDevTools({ type: 'close' });
  });

  // New agent button
  document.getElementById('new-agent-btn')?.addEventListener('click', () => {
    sendToDevTools({ type: 'new-agent' });
  });

  // Test panel close
  document.getElementById('test-panel-close')?.addEventListener('click', () => {
    document.getElementById('test-panel').style.display = 'none';
  });

  // Run test button
  document.getElementById('run-test-btn')?.addEventListener('click', () => {
    const input = document.getElementById('test-input').value.trim();
    if (!input) {
      showNotification('Please enter a test query', 'warning');
      return;
    }
    document.getElementById('test-results').innerHTML = '<div class="test-results-placeholder">Running test...</div>';
    sendToDevTools({ type: 'run-test', query: input });
  });

  // Signal ready to receive data
  console.log('[AgentStudio] Initialization complete, signaling ready');
  sendToDevTools({ type: 'ready' });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
  `.trim();
}
