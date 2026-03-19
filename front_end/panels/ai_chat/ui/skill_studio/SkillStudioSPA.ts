// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Skill Studio SPA - Bundled HTML, CSS, and JS for the Skill Studio web app
 *
 * This file exports the complete SPA as strings that can be injected via RenderWebAppTool.
 * The SPA communicates with DevTools via the Mini App protocol.
 */

export const SkillStudioSPA = {
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
  <title>Skill Studio</title>
</head>
<body>
  <div class="skill-studio">
    <!-- Header -->
    <header class="studio-header">
      <div class="header-left">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            <circle cx="7.5" cy="14.5" r="1.5"/>
            <circle cx="16.5" cy="14.5" r="1.5"/>
          </svg>
        </div>
        <h1 class="studio-title">Skill Studio</h1>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" id="import-btn" title="Import Skills">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import
        </button>
        <button class="btn btn-secondary btn-sm" id="export-btn" title="Export Skills">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Export
        </button>
        <button class="close-btn" id="close-btn" title="Close Skill Studio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <label>Domain:</label>
        <input type="text" id="domain-filter" placeholder="Filter by domain..." />
      </div>
      <div class="filter-group">
        <label>Status:</label>
        <select id="status-filter">
          <option value="">All</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="testing">Testing</option>
          <option value="failing">Failing</option>
        </select>
      </div>
    </div>

    <!-- Main Content -->
    <div class="studio-content">
      <!-- Left Panel: Skill List -->
      <aside class="skill-list-panel">
        <button class="new-skill-btn" id="new-skill-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Skill
        </button>

        <div class="skill-list" id="skill-list">
          <div class="empty-message">Loading...</div>
        </div>
      </aside>

      <!-- Right Panel: Skill Details -->
      <main class="skill-detail-panel" id="skill-detail-panel">
        <div class="empty-detail">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <h2>Select a Skill</h2>
          <p>Choose a skill from the list to view or edit, or create a new one.</p>
        </div>
      </main>
    </div>

    <!-- Notification Toast -->
    <div id="notification" class="notification hidden"></div>

    <!-- Test Panel -->
    <div class="test-panel" id="test-panel" style="display: none;">
      <div class="test-panel-header">
        <h3>Test Skill</h3>
        <button class="test-panel-close" id="test-panel-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="test-panel-content">
        <div class="test-input-group">
          <label for="test-args">Test Arguments (JSON)</label>
          <textarea id="test-args" rows="4" placeholder='{"param": "value"}'></textarea>
        </div>
        <button class="btn btn-primary" id="run-test-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Run Test
        </button>
        <div class="test-results" id="test-results">
          <div class="test-results-placeholder">Results will appear here after running a test</div>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div class="modal" id="import-modal" style="display: none;">
      <div class="modal-content">
        <h3>Import Skills</h3>
        <textarea id="import-json" rows="10" placeholder="Paste JSON array of skills here..."></textarea>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="import-cancel">Cancel</button>
          <button class="btn btn-primary" id="import-confirm">Import</button>
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
/* Design tokens */
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
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08);
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

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
}

.skill-studio {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: auto auto 1fr;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.close-btn svg {
  width: 18px;
  height: 18px;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 16px;
  padding: 12px 20px;
  background: var(--surface-variant);
  border-bottom: 1px solid var(--border);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.filter-group input,
.filter-group select {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--surface);
  color: var(--text-primary);
}

.filter-group input:focus,
.filter-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

/* Main Content */
.studio-content {
  display: grid;
  grid-template-columns: 280px 1fr;
  overflow: hidden;
}

/* Skill List Panel */
.skill-list-panel {
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px;
}

.new-skill-btn {
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
  margin-bottom: 16px;
}

.new-skill-btn:hover {
  background: var(--primary-hover);
  box-shadow: 0 4px 14px var(--primary-shadow);
}

.skill-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.skill-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: transparent;
  border: 1px solid transparent;
}

.skill-list-item:hover {
  background: var(--primary-container);
}

.skill-list-item.selected {
  background: var(--primary-light);
  border-color: var(--border-hover);
}

.skill-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skill-status-dot.verified {
  background: var(--success);
}

.skill-status-dot.unverified {
  background: var(--text-tertiary);
}

.skill-status-dot.testing {
  background: var(--warning);
}

.skill-status-dot.failing {
  background: var(--error);
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-domain {
  font-size: 11px;
  color: var(--text-tertiary);
}

.empty-message {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 20px;
  text-align: center;
  font-style: italic;
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border);
}

/* Skill Detail Panel */
.skill-detail-panel {
  overflow-y: auto;
  padding: 24px 32px;
  background: var(--background);
}

.skill-form {
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
}

.form-section .section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
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

.form-group input,
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

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

#skill-source {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
  min-height: 200px;
}

#skill-schema {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  min-height: 150px;
}

/* Verification Status */
.verification-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
}

.verification-status.verified {
  background: var(--success-light);
  color: var(--success);
}

.verification-status.unverified {
  background: var(--surface-variant);
  color: var(--text-secondary);
}

.verification-status.testing {
  background: var(--warning-light);
  color: var(--warning);
}

.verification-status.failing {
  background: var(--error-light);
  color: var(--error);
}

.verification-icon {
  width: 24px;
  height: 24px;
}

.verification-text {
  flex: 1;
}

.verification-text strong {
  display: block;
  font-size: 13px;
}

.verification-text span {
  font-size: 12px;
  opacity: 0.8;
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

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
  box-shadow: 0 4px 14px var(--primary-shadow);
}

.btn-secondary {
  background: var(--surface-variant);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--surface);
  border-color: var(--border-strong);
}

.btn-danger {
  background: var(--error-light);
  color: var(--error);
}

.btn-danger:hover {
  background: rgba(217, 48, 37, 0.15);
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

/* Test Panel */
.test-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 20px 32px;
  z-index: 100;
  max-height: 50vh;
  overflow-y: auto;
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
}

.test-panel-close:hover {
  background: var(--surface-variant);
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
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  resize: vertical;
  background: var(--surface);
}

.test-input-group textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.test-results {
  margin-top: 12px;
  padding: 16px;
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.test-results.success {
  background: var(--success-light);
}

.test-results.error {
  background: var(--error-light);
}

.test-results-placeholder {
  color: var(--text-tertiary);
  font-style: italic;
  font-family: inherit;
}

/* Test History */
.test-history {
  margin-top: 16px;
}

.test-history-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.test-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.test-history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.test-history-item.success {
  border-left: 3px solid var(--success);
}

.test-history-item.failure {
  border-left: 3px solid var(--error);
}

.test-history-time {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.test-history-duration {
  color: var(--text-secondary);
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-content {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-content h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.modal-content textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  resize: vertical;
  margin-bottom: 16px;
}

.modal-content textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Tags */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

.tag-remove {
  cursor: pointer;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.tag-input input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.tag-input button {
  padding: 6px 12px;
}
  `.trim();
}

function getJS(): string {
  return `
(function() {
  'use strict';

  // State
  let state = {
    skills: [],
    selectedSkill: null,
    isCreatingNew: false,
    testHistory: [],
    domainFilter: '',
    statusFilter: ''
  };

  // DOM Elements
  const elements = {};

  // Initialize
  function init() {
    cacheElements();
    bindEvents();
    console.log('[SkillStudio] Initialized');
  }

  function cacheElements() {
    elements.closeBtn = document.getElementById('close-btn');
    elements.newSkillBtn = document.getElementById('new-skill-btn');
    elements.skillList = document.getElementById('skill-list');
    elements.skillDetailPanel = document.getElementById('skill-detail-panel');
    elements.notification = document.getElementById('notification');
    elements.domainFilter = document.getElementById('domain-filter');
    elements.statusFilter = document.getElementById('status-filter');
    elements.importBtn = document.getElementById('import-btn');
    elements.exportBtn = document.getElementById('export-btn');
    elements.importModal = document.getElementById('import-modal');
    elements.importJson = document.getElementById('import-json');
    elements.importCancel = document.getElementById('import-cancel');
    elements.importConfirm = document.getElementById('import-confirm');
    elements.testPanel = document.getElementById('test-panel');
    elements.testPanelClose = document.getElementById('test-panel-close');
    elements.testArgs = document.getElementById('test-args');
    elements.runTestBtn = document.getElementById('run-test-btn');
    elements.testResults = document.getElementById('test-results');
  }

  function bindEvents() {
    elements.closeBtn.addEventListener('click', () => {
      window.miniApp.close();
    });

    elements.newSkillBtn.addEventListener('click', () => {
      sendAction('new-skill');
    });

    elements.domainFilter.addEventListener('input', debounce(() => {
      sendAction('filter-change', {
        domain: elements.domainFilter.value,
        status: elements.statusFilter.value
      });
    }, 300));

    elements.statusFilter.addEventListener('change', () => {
      sendAction('filter-change', {
        domain: elements.domainFilter.value,
        status: elements.statusFilter.value
      });
    });

    elements.importBtn.addEventListener('click', () => {
      elements.importModal.style.display = 'flex';
    });

    elements.exportBtn.addEventListener('click', () => {
      sendAction('export-skills');
    });

    elements.importCancel.addEventListener('click', () => {
      elements.importModal.style.display = 'none';
      elements.importJson.value = '';
    });

    elements.importConfirm.addEventListener('click', () => {
      try {
        const skills = JSON.parse(elements.importJson.value);
        sendAction('import-skills', { skills });
        elements.importModal.style.display = 'none';
        elements.importJson.value = '';
      } catch (e) {
        showNotification('Invalid JSON format', 'error');
      }
    });

    elements.testPanelClose.addEventListener('click', () => {
      elements.testPanel.style.display = 'none';
    });

    elements.runTestBtn.addEventListener('click', () => {
      try {
        const args = JSON.parse(elements.testArgs.value || '{}');
        sendAction('test-skill', { args });
      } catch (e) {
        showNotification('Invalid JSON arguments', 'error');
      }
    });
  }

  // Action handlers from DevTools
  window.onMiniAppDispatch = function(action) {
    console.log('[SkillStudio] Dispatch:', action.action);

    switch (action.action) {
      case 'init':
        state.skills = action.payload.skills || [];
        state.selectedSkill = action.payload.selectedSkill || null;
        state.isCreatingNew = action.payload.isCreatingNew || false;
        renderSkillList();
        renderSkillDetail();
        break;

      case 'skills-updated':
        state.skills = action.payload.skills || [];
        renderSkillList();
        break;

      case 'skill-selected':
        state.selectedSkill = action.payload.skill;
        state.testHistory = action.payload.testHistory || [];
        state.isCreatingNew = action.payload.isNew || false;
        renderSkillDetail();
        // Navigate via router if available
        if (window.miniAppRouter && state.selectedSkill && !state.isCreatingNew) {
          window.miniAppRouter.replace('skill', { id: state.selectedSkill.id });
        } else if (window.miniAppRouter && state.isCreatingNew) {
          window.miniAppRouter.replace('new', {});
        }
        break;

      case 'test-started':
        elements.runTestBtn.disabled = true;
        elements.runTestBtn.textContent = 'Running...';
        elements.testResults.className = 'test-results';
        elements.testResults.textContent = 'Running test...';
        break;

      case 'test-result':
        elements.runTestBtn.disabled = false;
        elements.runTestBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Test';

        if (action.payload.success) {
          elements.testResults.className = 'test-results success';
          elements.testResults.textContent = 'Success:\\n' + JSON.stringify(action.payload.result, null, 2);
        } else {
          elements.testResults.className = 'test-results error';
          elements.testResults.textContent = 'Error: ' + action.payload.error;
        }

        if (action.payload.skill) {
          state.selectedSkill = action.payload.skill;
          state.testHistory = action.payload.testHistory || [];
          renderSkillDetail();
        }
        break;

      case 'export-ready':
        downloadJson(action.payload.skills, 'skills-export.json');
        showNotification('Skills exported successfully!', 'success');
        break;

      case 'notification':
        showNotification(action.payload.message, action.payload.type);
        break;
    }
  };

  // Render skill list
  function renderSkillList() {
    const list = elements.skillList;
    list.innerHTML = '';

    if (state.skills.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-message';
      empty.textContent = 'No skills yet. Create your first skill!';
      list.appendChild(empty);
      return;
    }

    state.skills.forEach(skill => {
      const item = document.createElement('div');
      item.className = 'skill-list-item';
      if (state.selectedSkill && state.selectedSkill.id === skill.id) {
        item.className += ' selected';
      }

      const statusDot = document.createElement('div');
      statusDot.className = 'skill-status-dot ' + skill.verification.status;
      item.appendChild(statusDot);

      const info = document.createElement('div');
      info.className = 'skill-info';

      const name = document.createElement('div');
      name.className = 'skill-name';
      name.textContent = skill.name;
      info.appendChild(name);

      const domain = document.createElement('div');
      domain.className = 'skill-domain';
      domain.textContent = skill.domain;
      info.appendChild(domain);

      item.appendChild(info);

      item.addEventListener('click', () => {
        sendAction('select-skill', { id: skill.id });
      });

      list.appendChild(item);
    });
  }

  // Render skill detail
  function renderSkillDetail() {
    const panel = elements.skillDetailPanel;

    if (!state.selectedSkill && !state.isCreatingNew) {
      panel.innerHTML = getEmptyDetailHTML();
      return;
    }

    const skill = state.selectedSkill || getEmptySkill();
    const isNew = state.isCreatingNew;
    const isReadOnly = !isNew && skill.verification && skill.verification.status === 'verified';

    panel.innerHTML = getSkillFormHTML(skill, isNew, isReadOnly);
    bindFormEvents(skill, isNew, isReadOnly);
  }

  function getEmptyDetailHTML() {
    return \`
      <div class="empty-detail">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          </svg>
        </div>
        <h2>Select a Skill</h2>
        <p>Choose a skill from the list to view or edit, or create a new one.</p>
      </div>
    \`;
  }

  function getEmptySkill() {
    return {
      id: '',
      name: '',
      description: '',
      domain: '',
      version: 1,
      tags: [],
      source: \`// Skill code here
// Available variables:
// - args: The input arguments (validated against schema)
// - helpers: DOM helper functions (waitForElement, click, type, etc.)
//
// Return a JSON-serializable value

const result = await helpers.getText('.some-selector');
return { success: true, data: result };\`,
      schema: { type: 'object', properties: {}, required: [] },
      verification: {
        status: 'unverified',
        testCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
        requiredSuccesses: 3
      }
    };
  }

  function getSkillFormHTML(skill, isNew, isReadOnly) {
    const statusClass = skill.verification ? skill.verification.status : 'unverified';
    const statusText = getStatusText(skill.verification);

    return \`
      <form class="skill-form" id="skill-form">
        \${!isNew ? \`
        <div class="verification-status \${statusClass}">
          <div class="verification-icon">\${getStatusIcon(statusClass)}</div>
          <div class="verification-text">
            <strong>\${statusText.title}</strong>
            <span>\${statusText.subtitle}</span>
          </div>
        </div>
        \` : ''}

        <div class="form-section">
          <div class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            Basic Information
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="skill-name">Name (snake_case)</label>
              <input type="text" id="skill-name" value="\${escapeHtml(skill.name)}" placeholder="my_skill_name" \${isReadOnly ? 'disabled' : ''} pattern="^[a-z][a-z0-9_]*$" required />
            </div>
            <div class="form-group">
              <label for="skill-domain">Domain</label>
              <input type="text" id="skill-domain" value="\${escapeHtml(skill.domain)}" placeholder="example.com" \${isReadOnly ? 'disabled' : ''} required />
            </div>
          </div>

          <div class="form-group">
            <label for="skill-description">Description</label>
            <textarea id="skill-description" rows="2" placeholder="What does this skill do?" \${isReadOnly ? 'disabled' : ''} required>\${escapeHtml(skill.description)}</textarea>
          </div>

          <div class="form-group">
            <label>Tags</label>
            <div class="tags-container" id="tags-container">
              \${(skill.tags || []).map(tag => \`
                <span class="tag">
                  \${escapeHtml(tag)}
                  <span class="tag-remove" data-tag="\${escapeHtml(tag)}">&times;</span>
                </span>
              \`).join('')}
            </div>
            \${!isReadOnly ? \`
            <div class="tag-input">
              <input type="text" id="tag-input" placeholder="Add tag..." />
              <button type="button" class="btn btn-secondary btn-sm" id="add-tag-btn">Add</button>
            </div>
            \` : ''}
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Source Code
          </div>

          <div class="form-group">
            <label for="skill-source">JavaScript Code</label>
            <textarea id="skill-source" rows="15" \${isReadOnly ? 'disabled' : ''}>\${escapeHtml(skill.source)}</textarea>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Parameter Schema
          </div>

          <div class="form-group">
            <label for="skill-schema">JSON Schema</label>
            <textarea id="skill-schema" rows="8" \${isReadOnly ? 'disabled' : ''}>\${JSON.stringify(skill.schema, null, 2)}</textarea>
          </div>
        </div>

        \${!isNew && state.testHistory.length > 0 ? \`
        <div class="form-section">
          <div class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Test History
          </div>
          <div class="test-history-list">
            \${state.testHistory.slice(0, 5).map(record => \`
              <div class="test-history-item \${record.result.success ? 'success' : 'failure'}">
                <span class="test-history-time">\${formatTime(record.timestamp)}</span>
                <span class="test-history-duration">\${record.result.executionTimeMs}ms</span>
                <span>\${record.result.success ? 'Passed' : 'Failed: ' + (record.result.error || 'Unknown error')}</span>
              </div>
            \`).join('')}
          </div>
        </div>
        \` : ''}

        <div class="form-actions">
          \${!isReadOnly ? \`
          <button type="submit" class="btn btn-primary" id="save-skill-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            \${isNew ? 'Create Skill' : 'Save Changes'}
          </button>
          \` : ''}

          \${!isNew ? \`
          <button type="button" class="btn btn-secondary" id="test-skill-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Test Skill
          </button>
          \` : ''}

          \${!isNew && !skill.isBuiltIn ? \`
          <button type="button" class="btn btn-danger" id="delete-skill-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Delete
          </button>
          \` : ''}
        </div>
      </form>
    \`;
  }

  function bindFormEvents(skill, isNew, isReadOnly) {
    const form = document.getElementById('skill-form');

    if (!isReadOnly) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSkill();
      });

      // Tag handling
      const addTagBtn = document.getElementById('add-tag-btn');
      const tagInput = document.getElementById('tag-input');

      if (addTagBtn && tagInput) {
        addTagBtn.addEventListener('click', () => addTag());
        tagInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
          }
        });
      }

      // Tag removal
      document.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const tag = e.target.dataset.tag;
          removeTag(tag);
        });
      });
    }

    // Test button
    const testBtn = document.getElementById('test-skill-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        elements.testPanel.style.display = 'block';
        elements.testArgs.value = JSON.stringify({}, null, 2);
        elements.testResults.className = 'test-results';
        elements.testResults.innerHTML = '<div class="test-results-placeholder">Results will appear here after running a test</div>';
      });
    }

    // Delete button
    const deleteBtn = document.getElementById('delete-skill-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this skill?')) {
          sendAction('delete-skill');
        }
      });
    }
  }

  function saveSkill() {
    const name = document.getElementById('skill-name').value.trim();
    const domain = document.getElementById('skill-domain').value.trim();
    const description = document.getElementById('skill-description').value.trim();
    const source = document.getElementById('skill-source').value;
    const schemaText = document.getElementById('skill-schema').value;

    if (!name || !domain || !description) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    let schema;
    try {
      schema = JSON.parse(schemaText);
    } catch (e) {
      showNotification('Invalid JSON schema', 'error');
      return;
    }

    const tags = Array.from(document.querySelectorAll('.tags-container .tag'))
      .map(el => el.textContent.replace('×', '').trim());

    sendAction('save-skill', {
      data: { name, domain, description, source, schema, tags }
    });
  }

  function addTag() {
    const input = document.getElementById('tag-input');
    const tag = input.value.trim().toLowerCase();

    if (!tag) return;

    const container = document.getElementById('tags-container');
    const existingTags = Array.from(container.querySelectorAll('.tag'))
      .map(el => el.textContent.replace('×', '').trim());

    if (existingTags.includes(tag)) {
      showNotification('Tag already exists', 'warning');
      return;
    }

    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.innerHTML = \`\${escapeHtml(tag)}<span class="tag-remove" data-tag="\${escapeHtml(tag)}">&times;</span>\`;
    tagEl.querySelector('.tag-remove').addEventListener('click', (e) => {
      removeTag(e.target.dataset.tag);
    });
    container.appendChild(tagEl);
    input.value = '';
  }

  function removeTag(tag) {
    const container = document.getElementById('tags-container');
    const tagEl = container.querySelector(\`.tag-remove[data-tag="\${tag}"]\`);
    if (tagEl) {
      tagEl.parentElement.remove();
    }
  }

  function getStatusText(verification) {
    if (!verification) {
      return { title: 'Unknown', subtitle: 'No verification data' };
    }

    switch (verification.status) {
      case 'verified':
        return {
          title: 'Verified',
          subtitle: \`\${verification.successCount} successful tests\`
        };
      case 'testing':
        return {
          title: 'Testing',
          subtitle: \`\${verification.successCount}/\${verification.requiredSuccesses} successful tests\`
        };
      case 'failing':
        return {
          title: 'Failing',
          subtitle: \`\${verification.consecutiveFailures} consecutive failures\`
        };
      default:
        return {
          title: 'Unverified',
          subtitle: 'Needs testing'
        };
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'verified':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      case 'testing':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      case 'failing':
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }
  }

  // Utilities
  function sendAction(type, payload = {}) {
    window.__miniAppBridge_skill_studio(JSON.stringify({ type, ...payload }));
  }

  function showNotification(message, type = 'info') {
    elements.notification.textContent = message;
    elements.notification.className = 'notification ' + type;

    setTimeout(() => {
      elements.notification.classList.add('hidden');
    }, 3000);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Router integration
  window.restoreFromHistoryState = function(historyState) {
    if (!historyState) return;

    if (historyState.skillId) {
      sendAction('select-skill', { id: historyState.skillId });
    } else if (historyState.isNew) {
      sendAction('new-skill');
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
  `.trim();
}
