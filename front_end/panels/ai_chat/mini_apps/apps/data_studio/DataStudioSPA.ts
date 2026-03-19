// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio SPA - Bundled HTML, CSS, and JS for the Data Studio web app
 *
 * This file exports the complete SPA as strings that can be injected via RenderWebAppTool.
 * The SPA communicates with DevTools via the Mini App protocol:
 * - SPA -> DevTools: window.__miniAppBridge_data_studio(payload) (via Runtime.addBinding)
 * - DevTools -> SPA: window.miniApp.dispatch(action) (via Runtime.evaluate)
 * - State access: window.miniApp.getState() returns current state
 */

export const DataStudioSPA = {
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
  <title>Data Studio</title>
</head>
<body>
  <div class="data-studio">
    <!-- Header -->
    <header class="studio-header">
      <div class="header-left">
        <div class="header-icon" id="header-icon"></div>
        <h1 class="studio-title">Data Studio</h1>
        <span class="table-name" id="table-name"></span>
      </div>
      <div class="header-actions">
        <button class="btn btn-header" id="save-btn" style="display: none;">
          <span class="btn-icon-inline" id="save-icon"></span>
          Save
        </button>
        <button class="btn btn-header" id="close-table-btn" style="display: none;">
          <span class="btn-icon-inline" id="back-icon"></span>
          Back
        </button>
        <button class="close-btn" id="close-btn" title="Close Data Studio"></button>
      </div>
    </header>

    <!-- Selector View -->
    <div class="selector-view" id="selector-view">
      <div class="selector-content">
        <section class="selector-section">
          <div class="section-header">
            <span class="section-icon" id="tables-icon"></span>
            <h2>Your Tables</h2>
          </div>
          <div class="table-list" id="saved-tables">
            <div class="empty-message">No saved tables yet</div>
          </div>
        </section>

        <div class="selector-divider"></div>

        <section class="selector-section">
          <div class="section-header">
            <span class="section-icon" id="templates-icon"></span>
            <h2>Start from Template</h2>
          </div>
          <div class="template-list" id="templates">
            <!-- Templates will be rendered here -->
          </div>
        </section>

        <section class="selector-section">
          <h2>Or Create Custom</h2>
          <button class="btn btn-primary btn-large" id="create-custom-btn">
            <span class="btn-icon-inline" id="plus-icon"></span>
            Create Custom Table
          </button>
        </section>
      </div>
    </div>

    <!-- Table View -->
    <div class="table-view" id="table-view" style="display: none;">
      <!-- Action Bar -->
      <div class="action-bar">
        <div class="action-bar-left">
          <span class="entity-type-label">Entity Type: <strong id="entity-type-display"></strong></span>
          <button class="btn btn-secondary" id="add-entity-btn">
            <span class="btn-icon-inline" id="add-entity-icon"></span>
            Add <span id="add-entity-label">Entity</span>
          </button>
          <button class="btn btn-secondary" id="add-agent-btn">
            <span class="btn-icon-inline" id="add-agent-icon"></span>
            Add Agent
          </button>
        </div>
        <div class="action-bar-right">
          <button class="btn btn-primary" id="run-all-btn">
            <span class="btn-icon-inline" id="play-icon"></span>
            Run All
          </button>
          <button class="btn btn-warning" id="pause-btn" style="display: none;">
            <span class="btn-icon-inline" id="pause-icon"></span>
            Pause
          </button>
          <button class="btn btn-secondary" id="export-btn">
            <span class="btn-icon-inline" id="export-icon"></span>
            Export
          </button>
        </div>
      </div>

      <!-- Data Table -->
      <div class="table-container">
        <table class="data-table" id="data-table">
          <thead id="table-header">
            <!-- Header will be rendered dynamically -->
          </thead>
          <tbody id="table-body">
            <!-- Body will be rendered dynamically -->
          </tbody>
        </table>
        <div class="empty-table" id="empty-table">
          <div class="empty-icon" id="empty-table-icon"></div>
          <h3>No data yet</h3>
          <p>Add entities and agents to start analyzing</p>
        </div>
      </div>
    </div>

    <!-- Create Table Modal -->
    <div class="modal" id="create-table-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New Table</h2>
          <button class="modal-close" id="create-table-modal-close"></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="new-table-name">Table Name</label>
            <input type="text" id="new-table-name" placeholder="e.g., Q4 Competitor Analysis">
          </div>
          <div class="form-group">
            <label for="new-entity-type">Entity Type</label>
            <input type="text" id="new-entity-type" placeholder="e.g., Competitor, Product, Lead">
          </div>
          <div class="form-group">
            <label for="new-entity-label">Entity Name Column Label</label>
            <input type="text" id="new-entity-label" placeholder="e.g., Company Name, Product Name">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="create-table-cancel">Cancel</button>
          <button class="btn btn-primary" id="create-table-confirm">Create Table</button>
        </div>
      </div>
    </div>

    <!-- Add Entity Modal -->
    <div class="modal" id="add-entity-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add <span id="add-entity-modal-type">Entity</span></h2>
          <button class="modal-close" id="add-entity-modal-close"></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="entity-name">Name</label>
            <input type="text" id="entity-name" placeholder="Enter name">
          </div>
          <div class="form-group">
            <label for="entity-context">Additional Context (optional)</label>
            <textarea id="entity-context" rows="3" placeholder="Any additional context for the AI agents..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="add-entity-cancel">Cancel</button>
          <button class="btn btn-primary" id="add-entity-confirm">Add</button>
        </div>
      </div>
    </div>

    <!-- Add Agent Modal -->
    <div class="modal" id="add-agent-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>Add Agent Column</h2>
          <button class="modal-close" id="add-agent-modal-close"></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="agent-select">Select Agent</label>
            <select id="agent-select">
              <option value="">-- Select an agent --</option>
            </select>
          </div>
          <div class="form-group">
            <label for="query-template">Query Template</label>
            <textarea id="query-template" rows="2" placeholder="e.g., Analyze {entity}'s market position and key features"></textarea>
            <div class="form-hint">Use {entity} as a placeholder for the entity name</div>
          </div>
          <div class="form-group">
            <label>Output Columns</label>
            <div class="output-columns" id="output-columns">
              <div class="output-column-row">
                <input type="text" class="output-key" placeholder="Key (e.g., market_target)">
                <input type="text" class="output-label" placeholder="Label (e.g., Market Target)">
                <button class="btn-icon remove-column" style="visibility: hidden;"></button>
              </div>
            </div>
            <button class="btn btn-small btn-secondary" id="add-output-column">
              <span class="btn-icon-inline" id="add-column-icon"></span>
              Add Column
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="add-agent-cancel">Cancel</button>
          <button class="btn btn-primary" id="add-agent-confirm">Add Agent</button>
        </div>
      </div>
    </div>

    <!-- Cell Detail Modal -->
    <div class="modal" id="cell-detail-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Cell Detail</h2>
          <button class="modal-close" id="cell-detail-modal-close"></button>
        </div>
        <div class="modal-body">
          <div class="cell-detail-content" id="cell-detail-content"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cell-detail-copy">
            <span class="btn-icon-inline" id="copy-icon"></span>
            Copy
          </button>
          <button class="btn btn-primary" id="cell-detail-close">Close</button>
        </div>
      </div>
    </div>

    <!-- Notification Toast -->
    <div id="notification" class="notification hidden"></div>
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
  height: 100vh;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.data-studio {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--surface);
}

/* Header */
.studio-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.table-name {
  font-size: 14px;
  color: var(--text-secondary);
  padding-left: 12px;
  border-left: 1px solid var(--border);
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
  background: var(--surface-variant);
  color: var(--text-primary);
}

.close-btn:active {
  transform: scale(0.95);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
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

.btn-header {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-header:hover {
  background: var(--surface-variant);
  color: var(--text-primary);
}

.btn-warning {
  background: var(--warning);
  color: white;
}

.btn-warning:hover {
  background: #d07800;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-large {
  padding: 12px 24px;
  font-size: 14px;
  border-radius: var(--radius-md);
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.btn-icon:hover {
  background: var(--surface-variant);
  color: var(--text-secondary);
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

/* Section Header */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.section-icon svg {
  width: 18px;
  height: 18px;
}

/* Selector View */
.selector-view {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.selector-content {
  max-width: 800px;
  margin: 0 auto;
}

.selector-section {
  margin-bottom: 32px;
}

.selector-section > h2 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.selector-divider {
  height: 1px;
  background: var(--border);
  margin: 24px 0;
}

.table-list, .template-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.table-card, .template-card {
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
}

.table-card::before, .template-card::before {
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

.table-card:hover, .template-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.table-card:hover::before, .template-card:hover::before {
  transform: scaleX(1);
}

.table-card-title, .template-card-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.table-card-meta, .template-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.table-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.empty-message {
  color: var(--text-tertiary);
  font-style: italic;
  padding: 24px;
  text-align: center;
  background: var(--surface-variant);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border);
}

/* Table View */
.table-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.action-bar-left, .action-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.entity-type-label {
  font-size: 13px;
  color: var(--text-secondary);
  padding-right: 12px;
  border-right: 1px solid var(--border);
}

/* Data Table */
.table-container {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background: var(--background);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}

.data-table th, .data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.data-table th:last-child, .data-table td:last-child {
  border-right: none;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table th {
  background: var(--surface-variant);
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-table .agent-group-header {
  background: var(--primary);
  color: var(--text-on-primary);
  text-align: center;
  text-transform: none;
  font-size: 13px;
}

.data-table .agent-group-header .agent-actions {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
}

.data-table .agent-group-header button {
  background: rgba(255,255,255,0.2);
  border: none;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-fast);
}

.data-table .agent-group-header button:hover {
  background: rgba(255,255,255,0.3);
}

.data-table .agent-group-header button svg {
  width: 14px;
  height: 14px;
}

.data-table .column-header {
  background: var(--primary-light);
  font-size: 11px;
  color: var(--primary);
}

.data-table .entity-cell {
  background: var(--surface-variant);
  font-weight: 500;
  min-width: 160px;
  font-size: 13px;
}

.data-table .entity-cell .entity-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.data-table .entity-cell button {
  padding: 4px 8px;
  font-size: 11px;
}

.data-table .result-cell {
  min-width: 140px;
  max-width: 220px;
  cursor: pointer;
  position: relative;
  transition: background var(--transition-fast);
}

.data-table .result-cell:hover {
  background: var(--primary-container);
}

.data-table .result-cell.pending {
  background: var(--surface-variant);
  color: var(--text-tertiary);
  font-style: italic;
}

.data-table .result-cell.running {
  background: var(--primary-light);
}

.data-table .result-cell.error {
  background: var(--error-light);
  color: var(--error);
}

.data-table .result-cell .cell-value {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--primary-light);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-table {
  text-align: center;
  padding: 64px;
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border);
}

.empty-table .empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-variant);
  border-radius: var(--radius-lg);
  color: var(--text-tertiary);
}

.empty-table .empty-icon svg {
  width: 32px;
  height: 32px;
}

.empty-table h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.empty-table p {
  color: var(--text-secondary);
  font-size: 14px;
}

/* Modal */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: modalFadeIn 0.2s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: var(--shadow-xl);
  animation: modalSlideIn 0.25s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-content.modal-large {
  max-width: 600px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--surface-variant);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--border);
  color: var(--text-primary);
}

.modal-close svg {
  width: 16px;
  height: 16px;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
  background: var(--surface-variant);
}

/* Form */
.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-weight: 500;
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.form-group input, .form-group textarea, .form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: inherit;
  background: var(--surface);
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.form-group input:focus, .form-group textarea:focus, .form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-shadow);
}

.form-group input::placeholder, .form-group textarea::placeholder {
  color: var(--text-tertiary);
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

/* Output Columns */
.output-columns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.output-column-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.output-column-row input {
  flex: 1;
}

.output-column-row .remove-column {
  flex-shrink: 0;
}

/* Notification */
.notification {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: var(--text-primary);
  color: var(--surface);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  z-index: 1100;
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal);
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification.hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
  pointer-events: none;
}

.notification.success {
  background: var(--success);
}

.notification.error {
  background: var(--error);
}

.notification svg {
  width: 18px;
  height: 18px;
}

/* Cell Detail */
.cell-detail-content {
  background: var(--surface-variant);
  padding: 16px;
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  border: 1px solid var(--border);
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
// ============================================================================
// Data Studio SPA JavaScript
// ============================================================================

(function() {
  'use strict';

  // Lucide Icons as SVG strings
  const Icons = {
    table: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    save: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    fileText: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    plus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    userPlus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>',
    bot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    pause: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    copy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alertCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };

  // State
  let state = {
    view: 'selector',
    tables: [],
    templates: [],
    currentTable: null,
    availableAgents: []
  };

  // Track last pushed history state to prevent duplicates
  let lastHistoryView = null;
  let lastHistoryTableId = null;

  // ============================================================================
  // Browser History API Integration
  // ============================================================================

  /**
   * Push a new history state when navigating between views.
   * Uses the injected miniAppRouter for navigation.
   */
  function pushHistoryState() {
    const currentView = state.currentTable ? 'table' : 'selector';
    const currentTableId = state.currentTable?.tableId || null;

    // Don't push duplicate states
    if (currentView === lastHistoryView && currentTableId === lastHistoryTableId) {
      return;
    }

    // Use the injected router API for navigation
    if (window.miniAppRouter) {
      if (currentView === 'table' && currentTableId) {
        window.miniAppRouter.navigate('table', { tableId: currentTableId });
      } else {
        window.miniAppRouter.navigate('selector');
      }
    }

    lastHistoryView = currentView;
    lastHistoryTableId = currentTableId;

    console.log('[DataStudio] Pushed history state via router:', { view: currentView, tableId: currentTableId });
  }

  /**
   * Replace current history state (used for initial load).
   * Uses the injected miniAppRouter for navigation without creating a new history entry.
   */
  function replaceHistoryState() {
    const currentView = state.currentTable ? 'table' : 'selector';
    const currentTableId = state.currentTable?.tableId || null;

    // Use the injected router API for navigation
    if (window.miniAppRouter) {
      if (currentView === 'table' && currentTableId) {
        window.miniAppRouter.replace('table', { tableId: currentTableId });
      } else {
        window.miniAppRouter.replace('selector');
      }
    }

    lastHistoryView = currentView;
    lastHistoryTableId = currentTableId;

    console.log('[DataStudio] Replaced history state via router:', { view: currentView, tableId: currentTableId });
  }

  /**
   * Restore the UI from a history state object.
   * Called when the browser back/forward buttons are pressed.
   */
  function restoreFromHistoryState(historyState) {
    console.log('[DataStudio] Restoring from history state:', historyState);

    // Update tracking to prevent re-pushing this state
    lastHistoryView = historyState.view;
    lastHistoryTableId = historyState.tableId;

    if (historyState.view === 'table' && historyState.tableId) {
      // Request the table from DevTools (it has the full data)
      sendToDevTools({ type: 'load-table', tableId: historyState.tableId });
    } else {
      // Return to selector view
      state.view = 'selector';
      state.currentTable = null;
      render();
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
        // No state means we're at the initial entry - show selector
        lastHistoryView = 'selector';
        lastHistoryTableId = null;
        state.view = 'selector';
        state.currentTable = null;
        render();
      }
    });
  }

  // ============================================================================
  // Icon Injection
  // ============================================================================

  function injectIcons() {
    const iconMappings = {
      'header-icon': Icons.table,
      'save-icon': Icons.save,
      'back-icon': Icons.arrowLeft,
      'tables-icon': Icons.folder,
      'templates-icon': Icons.fileText,
      'plus-icon': Icons.plus,
      'add-entity-icon': Icons.userPlus,
      'add-agent-icon': Icons.bot,
      'play-icon': Icons.play,
      'pause-icon': Icons.pause,
      'export-icon': Icons.download,
      'copy-icon': Icons.copy,
      'add-column-icon': Icons.plus,
      'empty-table-icon': Icons.table
    };

    for (const [id, icon] of Object.entries(iconMappings)) {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = icon;
      }
    }

    // Close buttons with X icon
    document.querySelectorAll('.close-btn, .modal-close, .remove-column').forEach(el => {
      if (!el.innerHTML.trim()) {
        el.innerHTML = Icons.x;
      }
    });
  }

  // ============================================================================
  // Communication with DevTools
  // ============================================================================

  function sendToDevTools(action) {
    console.log('[DataStudio] sendToDevTools called:', action.type);
    console.log('[DataStudio] Binding exists:', typeof window.__miniAppBridge_data_studio);
    try {
      const payload = JSON.stringify(action);
      if (window.__miniAppBridge_data_studio) {
        console.log('[DataStudio] Calling binding with payload');
        window.__miniAppBridge_data_studio(payload);
        console.log('[DataStudio] Binding call completed');
      } else {
        console.error('[DataStudio] Binding not found! Checking parent...');
        console.log('[DataStudio] Parent binding exists:', typeof window.parent.__miniAppBridge_data_studio);
      }
    } catch (e) {
      console.error('[DataStudio] Failed to send to DevTools:', e);
    }
  }

  // Bridge interface for DevTools communication
  // Uses wrapper's callback hooks instead of overwriting window.miniApp
  // The wrapper (from MiniAppRegistry.wrapSPAJavaScript) defines window.miniApp
  // and calls these callbacks when actions are dispatched

  // Called by wrapper when 'set-state' action is received
  window.onMiniAppStateChange = function(newState) {
    console.log('[DataStudio] State changed via callback:', Object.keys(newState));
    state = { ...state, ...newState };
    render();
  };

  // Called by wrapper for actions not handled internally (like 'restore-state')
  window.onMiniAppDispatch = function(action) {
    console.log('[DataStudio] Received custom action:', action);

    switch (action.action) {
      case 'restore-state':
        // Restore from page refresh - request table load from DevTools
        console.log('[DataStudio] Restoring state from page refresh:', action.payload);
        if (action.payload?.view === 'table' && action.payload?.tableId) {
          sendToDevTools({ type: 'load-table', tableId: action.payload.tableId });
        } else {
          // Just show selector
          state.view = 'selector';
          state.currentTable = null;
          render();
        }
        break;

      default:
        console.warn('[DataStudio] Unknown action:', action.action);
    }
  };

  // Called by wrapper to get current state
  window.getMiniAppState = function() {
    return state;
  };

  // ============================================================================
  // Rendering
  // ============================================================================

  function render() {
    const selectorView = document.getElementById('selector-view');
    const tableView = document.getElementById('table-view');
    const tableName = document.getElementById('table-name');
    const saveBtn = document.getElementById('save-btn');
    const closeTableBtn = document.getElementById('close-table-btn');

    if (state.view === 'selector' || !state.currentTable) {
      selectorView.style.display = 'block';
      tableView.style.display = 'none';
      tableName.textContent = '';
      saveBtn.style.display = 'none';
      closeTableBtn.style.display = 'none';
      renderSelector();
    } else {
      selectorView.style.display = 'none';
      tableView.style.display = 'flex';
      tableName.textContent = state.currentTable.tableName;
      saveBtn.style.display = 'inline-flex';
      closeTableBtn.style.display = 'inline-flex';
      renderTable();
    }

    updatePauseButton();

    // Update browser history for back/forward navigation
    pushHistoryState();
  }

  function renderSelector() {
    renderSavedTables();
    renderTemplates();
  }

  function renderSavedTables() {
    const container = document.getElementById('saved-tables');
    if (!state.tables || state.tables.length === 0) {
      container.innerHTML = '<div class="empty-message">No saved tables yet. Create one to get started!</div>';
      return;
    }

    container.innerHTML = state.tables.map(table => \`
      <div class="table-card" data-table-id="\${table.id}">
        <div class="table-card-title">\${escapeHtml(table.name)}</div>
        <div class="table-card-meta">Entity: \${escapeHtml(table.entityType)}</div>
        <div class="table-card-actions">
          <button class="btn btn-small btn-primary load-table-btn" data-table-id="\${table.id}">Open</button>
          <button class="btn btn-small btn-secondary delete-table-btn" data-table-id="\${table.id}"><span class="btn-icon-inline">\${Icons.trash}</span></button>
        </div>
      </div>
    \`).join('');

    // Add event listeners
    container.querySelectorAll('.load-table-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendToDevTools({ type: 'load-table', tableId: btn.dataset.tableId });
      });
    });

    container.querySelectorAll('.delete-table-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this table?')) {
          sendToDevTools({ type: 'delete-table', tableId: btn.dataset.tableId });
        }
      });
    });
  }

  function renderTemplates() {
    const container = document.getElementById('templates');
    if (!state.templates || state.templates.length === 0) {
      container.innerHTML = '<div class="empty-message">No templates available</div>';
      return;
    }

    container.innerHTML = state.templates.map(template => \`
      <div class="template-card" data-template-id="\${template.id}">
        <div class="template-card-title">\${escapeHtml(template.name)}</div>
        <div class="template-card-desc">\${escapeHtml(template.description)}</div>
      </div>
    \`).join('');

    // Add event listeners
    container.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const templateId = card.dataset.templateId;
        const template = state.templates.find(t => t.id === templateId);
        if (template) {
          const name = prompt('Enter a name for this table:', template.name + ' - ' + new Date().toLocaleDateString());
          if (name) {
            sendToDevTools({ type: 'use-template', templateId, tableName: name });
          }
        }
      });
    });
  }

  function renderTable() {
    const table = state.currentTable;
    if (!table) return;

    // Update entity type display
    document.getElementById('entity-type-display').textContent = table.entityType;
    document.getElementById('add-entity-label').textContent = table.entityType;
    document.getElementById('add-entity-modal-type').textContent = table.entityType;

    // Check if we have data
    const hasData = table.entities.length > 0 || table.agentGroups.length > 0;
    document.getElementById('data-table').style.display = hasData ? 'table' : 'none';
    document.getElementById('empty-table').style.display = hasData ? 'none' : 'flex';

    if (!hasData) return;

    renderTableHeader();
    renderTableBody();
  }

  function renderTableHeader() {
    const table = state.currentTable;
    const thead = document.getElementById('table-header');

    // First row: Agent group headers
    let row1 = '<tr>';
    row1 += '<th rowspan="2" class="entity-cell">' + escapeHtml(table.entityNameLabel) + '</th>';

    for (const agentGroup of table.agentGroups) {
      const colspan = agentGroup.outputColumns.length || 1;
      row1 += \`
        <th colspan="\${colspan}" class="agent-group-header">
          \${escapeHtml(agentGroup.agentName)}
          <span class="agent-actions">
            <button title="Run all for this agent" data-agent-id="\${agentGroup.id}" class="run-agent-all-btn">\${Icons.play}</button>
            <button title="Remove agent" data-agent-id="\${agentGroup.id}" class="remove-agent-btn">\${Icons.x}</button>
          </span>
        </th>
      \`;
    }
    row1 += '</tr>';

    // Second row: Column headers
    let row2 = '<tr>';
    for (const agentGroup of table.agentGroups) {
      if (agentGroup.outputColumns.length === 0) {
        row2 += '<th class="column-header">Result</th>';
      } else {
        for (const col of agentGroup.outputColumns) {
          row2 += '<th class="column-header">' + escapeHtml(col.label) + '</th>';
        }
      }
    }
    row2 += '</tr>';

    thead.innerHTML = row1 + row2;

    // Add event listeners
    thead.querySelectorAll('.run-agent-all-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Run this agent for all entities
        for (const entity of table.entities) {
          sendToDevTools({
            type: 'run-agent-group',
            entityId: entity.id,
            agentGroupId: btn.dataset.agentId
          });
        }
      });
    });

    thead.querySelectorAll('.remove-agent-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Remove this agent column?')) {
          sendToDevTools({ type: 'remove-agent-group', agentGroupId: btn.dataset.agentId });
        }
      });
    });
  }

  function renderTableBody() {
    const table = state.currentTable;
    const tbody = document.getElementById('table-body');

    let html = '';
    for (const entity of table.entities) {
      html += '<tr>';

      // Entity name cell
      html += \`
        <td class="entity-cell">
          <div>\${escapeHtml(entity.name)}</div>
          <div class="entity-actions">
            <button class="btn btn-small btn-primary run-row-btn" data-entity-id="\${entity.id}"><span class="btn-icon-inline">\${Icons.play}</span> Run</button>
            <button class="btn btn-small btn-secondary remove-entity-btn" data-entity-id="\${entity.id}"><span class="btn-icon-inline">\${Icons.trash}</span></button>
          </div>
        </td>
      \`;

      // Result cells for each agent group
      for (const agentGroup of table.agentGroups) {
        const result = (table.results[entity.id] || {})[agentGroup.id] || { status: 'pending' };

        if (agentGroup.outputColumns.length === 0) {
          // Single column
          html += renderResultCell(entity.id, agentGroup.id, result, null);
        } else {
          // Multiple columns
          for (const col of agentGroup.outputColumns) {
            html += renderResultCell(entity.id, agentGroup.id, result, col.key);
          }
        }
      }

      html += '</tr>';
    }

    tbody.innerHTML = html;

    // Add event listeners
    tbody.querySelectorAll('.run-row-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sendToDevTools({ type: 'run-row', entityId: btn.dataset.entityId });
      });
    });

    tbody.querySelectorAll('.remove-entity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Remove this entity?')) {
          sendToDevTools({ type: 'remove-entity', entityId: btn.dataset.entityId });
        }
      });
    });

    tbody.querySelectorAll('.result-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        showCellDetail(cell.dataset.entityId, cell.dataset.agentId, cell.dataset.colKey);
      });
    });
  }

  function renderResultCell(entityId, agentGroupId, result, colKey) {
    let statusClass = result.status;
    let content = '';

    if (result.status === 'pending') {
      content = '<span style="opacity: 0.6">Click to run</span>';
    } else if (result.status === 'running') {
      content = '<span class="spinner"></span> Running...';
    } else if (result.status === 'error') {
      content = Icons.alertCircle + ' ' + escapeHtml(result.error || 'Error');
    } else if (result.status === 'completed' && result.values) {
      if (colKey) {
        content = '<div class="cell-value">' + escapeHtml(result.values[colKey] || '') + '</div>';
      } else {
        // Single value
        const val = Object.values(result.values)[0] || '';
        content = '<div class="cell-value">' + escapeHtml(val) + '</div>';
      }
    }

    return \`
      <td class="result-cell \${statusClass}"
          data-entity-id="\${entityId}"
          data-agent-id="\${agentGroupId}"
          data-col-key="\${colKey || ''}">
        \${content}
      </td>
    \`;
  }

  function updatePauseButton() {
    const runAllBtn = document.getElementById('run-all-btn');
    const pauseBtn = document.getElementById('pause-btn');

    if (state.currentTable?.executionStatus === 'running') {
      runAllBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
    } else {
      runAllBtn.style.display = 'inline-flex';
      pauseBtn.style.display = 'none';
    }
  }

  // ============================================================================
  // Modals
  // ============================================================================

  function showCreateTableModal() {
    document.getElementById('create-table-modal').style.display = 'flex';
    document.getElementById('new-table-name').value = '';
    document.getElementById('new-entity-type').value = '';
    document.getElementById('new-entity-label').value = '';
    document.getElementById('new-table-name').focus();
  }

  function hideCreateTableModal() {
    document.getElementById('create-table-modal').style.display = 'none';
  }

  function showAddEntityModal() {
    document.getElementById('add-entity-modal').style.display = 'flex';
    document.getElementById('entity-name').value = '';
    document.getElementById('entity-context').value = '';
    document.getElementById('entity-name').focus();
  }

  function hideAddEntityModal() {
    document.getElementById('add-entity-modal').style.display = 'none';
  }

  function showAddAgentModal() {
    const modal = document.getElementById('add-agent-modal');
    modal.style.display = 'flex';

    // Populate agent select
    const select = document.getElementById('agent-select');
    select.innerHTML = '<option value="">-- Select an agent --</option>';
    for (const agent of (state.availableAgents || [])) {
      select.innerHTML += \`<option value="\${escapeHtml(agent.name)}">\${escapeHtml(agent.name)}</option>\`;
    }

    // Reset form
    document.getElementById('query-template').value = '';
    resetOutputColumns();
  }

  function hideAddAgentModal() {
    document.getElementById('add-agent-modal').style.display = 'none';
  }

  function resetOutputColumns() {
    document.getElementById('output-columns').innerHTML = \`
      <div class="output-column-row">
        <input type="text" class="output-key" placeholder="Key (e.g., market_target)">
        <input type="text" class="output-label" placeholder="Label (e.g., Market Target)">
        <button class="btn-icon remove-column" style="visibility: hidden;">\${Icons.x}</button>
      </div>
    \`;
  }

  function addOutputColumn() {
    const container = document.getElementById('output-columns');
    const rows = container.querySelectorAll('.output-column-row');

    // Make first row's remove button visible if we have multiple
    if (rows.length === 1) {
      rows[0].querySelector('.remove-column').style.visibility = 'visible';
    }

    const row = document.createElement('div');
    row.className = 'output-column-row';
    row.innerHTML = \`
      <input type="text" class="output-key" placeholder="Key (e.g., market_target)">
      <input type="text" class="output-label" placeholder="Label (e.g., Market Target)">
      <button class="btn-icon remove-column">\${Icons.x}</button>
    \`;

    row.querySelector('.remove-column').addEventListener('click', () => {
      row.remove();
      const remaining = container.querySelectorAll('.output-column-row');
      if (remaining.length === 1) {
        remaining[0].querySelector('.remove-column').style.visibility = 'hidden';
      }
    });

    container.appendChild(row);
  }

  function getOutputColumns() {
    const container = document.getElementById('output-columns');
    const rows = container.querySelectorAll('.output-column-row');
    const columns = [];

    rows.forEach(row => {
      const key = row.querySelector('.output-key').value.trim();
      const label = row.querySelector('.output-label').value.trim();
      if (key && label) {
        columns.push({ key, label, id: '' });
      }
    });

    return columns;
  }

  function showCellDetail(entityId, agentGroupId, colKey) {
    const table = state.currentTable;
    if (!table) return;

    const result = (table.results[entityId] || {})[agentGroupId];
    if (!result) return;

    let content = '';
    if (result.status === 'error') {
      content = 'Error: ' + (result.error || 'Unknown error');
    } else if (result.status === 'completed' && result.values) {
      if (colKey) {
        content = result.values[colKey] || '(empty)';
      } else {
        // Show all values
        content = Object.entries(result.values)
          .map(([k, v]) => k + ': ' + v)
          .join('\\n\\n');
      }
    } else {
      content = 'Status: ' + result.status;
    }

    document.getElementById('cell-detail-content').textContent = content;
    document.getElementById('cell-detail-modal').style.display = 'flex';
  }

  function hideCellDetailModal() {
    document.getElementById('cell-detail-modal').style.display = 'none';
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showNotification(message, type = 'info') {
    const el = document.getElementById('notification');
    const icon = type === 'success' ? Icons.check : type === 'error' ? Icons.alertCircle : '';
    el.innerHTML = icon + ' ' + escapeHtml(message);
    el.className = 'notification ' + type;
    setTimeout(() => {
      el.className = 'notification hidden';
    }, 3000);
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  let initialized = false;

  function init() {
    // Prevent double initialization
    if (initialized) return;
    initialized = true;

    console.log('[DataStudio] Initializing...');

    // Set up browser history navigation (back/forward buttons)
    initHistoryListener();
    replaceHistoryState();

    // Inject icons
    injectIcons();

    // Close app
    document.getElementById('close-btn').addEventListener('click', () => {
      sendToDevTools({ type: 'close' });
    });

    // Save table
    document.getElementById('save-btn').addEventListener('click', () => {
      sendToDevTools({ type: 'save-table' });
      showNotification('Table saved', 'success');
    });

    // Close table (back to selector)
    document.getElementById('close-table-btn').addEventListener('click', () => {
      sendToDevTools({ type: 'close-table' });
    });

    // Create custom table
    document.getElementById('create-custom-btn').addEventListener('click', showCreateTableModal);

    // Create table modal
    document.getElementById('create-table-modal-close').addEventListener('click', hideCreateTableModal);
    document.querySelector('#create-table-modal .modal-overlay').addEventListener('click', hideCreateTableModal);
    document.getElementById('create-table-cancel').addEventListener('click', hideCreateTableModal);
    document.getElementById('create-table-confirm').addEventListener('click', () => {
      const tableName = document.getElementById('new-table-name').value.trim();
      const entityType = document.getElementById('new-entity-type').value.trim();
      const entityNameLabel = document.getElementById('new-entity-label').value.trim();

      if (!tableName || !entityType || !entityNameLabel) {
        showNotification('Please fill in all fields', 'error');
        return;
      }

      sendToDevTools({ type: 'create-table', tableName, entityType, entityNameLabel });
      hideCreateTableModal();
    });

    // Add entity
    document.getElementById('add-entity-btn').addEventListener('click', showAddEntityModal);
    document.getElementById('add-entity-modal-close').addEventListener('click', hideAddEntityModal);
    document.querySelector('#add-entity-modal .modal-overlay').addEventListener('click', hideAddEntityModal);
    document.getElementById('add-entity-cancel').addEventListener('click', hideAddEntityModal);
    document.getElementById('add-entity-confirm').addEventListener('click', () => {
      const name = document.getElementById('entity-name').value.trim();
      const context = document.getElementById('entity-context').value.trim();

      if (!name) {
        showNotification('Please enter a name', 'error');
        return;
      }

      sendToDevTools({ type: 'add-entity', name, context: context || undefined });
      hideAddEntityModal();
    });

    // Add agent
    document.getElementById('add-agent-btn').addEventListener('click', showAddAgentModal);
    document.getElementById('add-agent-modal-close').addEventListener('click', hideAddAgentModal);
    document.querySelector('#add-agent-modal .modal-overlay').addEventListener('click', hideAddAgentModal);
    document.getElementById('add-agent-cancel').addEventListener('click', hideAddAgentModal);
    document.getElementById('add-output-column').addEventListener('click', addOutputColumn);
    document.getElementById('add-agent-confirm').addEventListener('click', () => {
      const agentName = document.getElementById('agent-select').value;
      const queryTemplate = document.getElementById('query-template').value.trim();
      const outputColumns = getOutputColumns();

      if (!agentName) {
        showNotification('Please select an agent', 'error');
        return;
      }
      if (!queryTemplate) {
        showNotification('Please enter a query template', 'error');
        return;
      }
      if (outputColumns.length === 0) {
        showNotification('Please add at least one output column', 'error');
        return;
      }

      sendToDevTools({ type: 'add-agent-group', agentName, queryTemplate, outputColumns });
      hideAddAgentModal();
    });

    // Run all
    document.getElementById('run-all-btn').addEventListener('click', () => {
      sendToDevTools({ type: 'run-all' });
    });

    // Pause
    document.getElementById('pause-btn').addEventListener('click', () => {
      sendToDevTools({ type: 'pause-execution' });
    });

    // Export
    document.getElementById('export-btn').addEventListener('click', () => {
      if (!state.currentTable) return;
      const data = JSON.stringify(state.currentTable, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (state.currentTable.tableName || 'export') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Cell detail modal
    document.getElementById('cell-detail-modal-close').addEventListener('click', hideCellDetailModal);
    document.querySelector('#cell-detail-modal .modal-overlay').addEventListener('click', hideCellDetailModal);
    document.getElementById('cell-detail-close').addEventListener('click', hideCellDetailModal);
    document.getElementById('cell-detail-copy').addEventListener('click', () => {
      const content = document.getElementById('cell-detail-content').textContent;
      navigator.clipboard.writeText(content).then(() => {
        showNotification('Copied to clipboard', 'success');
      });
    });

    // Initial render
    render();

    // Signal ready
    console.log('[DataStudio] Initialization complete, signaling ready');
    sendToDevTools({ type: 'ready' });
  }

  // Initialize on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);

  // Also init immediately if DOM is already ready (important for srcdoc iframes)
  if (document.readyState !== 'loading') {
    init();
  }
})();
  `.trim();
}
