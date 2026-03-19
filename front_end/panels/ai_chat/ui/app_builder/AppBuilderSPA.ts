// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * App Builder SPA - Bundled HTML, CSS, and JS for the App Builder web app
 *
 * Features:
 * - WebContainer for running Vite dev server
 * - CodeMirror 6 for code editing
 * - File tree navigation
 * - Live preview iframe
 */

export const AppBuilderSPA = {
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
  <title>App Builder</title>
</head>
<body>
  <div class="app-builder">
    <!-- Header -->
    <header class="header">
      <div class="header-left">
        <div class="header-icon" id="header-icon"></div>
        <h1 class="header-title" id="header-title">App Builder</h1>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" id="new-project-btn" title="New Project">
          <span class="btn-icon" id="new-project-icon"></span>
          New Project
        </button>
        <button class="close-btn" id="close-btn" title="Close App Builder"></button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Sidebar: Project List or File Tree -->
      <aside class="sidebar" id="sidebar">
        <!-- Project List View -->
        <div class="project-list-view" id="project-list-view">
          <div class="sidebar-header">
            <h2 class="sidebar-title">Projects</h2>
          </div>
          <div class="project-list" id="project-list">
            <div class="empty-message">No projects yet. Create one to get started!</div>
          </div>
        </div>

        <!-- File Tree View (shown when project is open) -->
        <div class="file-tree-view" id="file-tree-view" style="display: none;">
          <div class="sidebar-header">
            <button class="btn btn-icon" id="back-to-projects" title="Back to Projects">
              <span id="back-icon"></span>
            </button>
            <h2 class="sidebar-title" id="project-name">Project</h2>
          </div>
          <div class="file-tree" id="file-tree"></div>
          <div class="file-actions">
            <button class="btn btn-small" id="new-file-btn" title="New File">
              <span id="new-file-icon"></span>
              New File
            </button>
          </div>
        </div>
      </aside>

      <!-- Editor Panel -->
      <div class="editor-panel" id="editor-panel">
        <!-- Empty state -->
        <div class="empty-editor" id="empty-editor">
          <div class="empty-icon" id="empty-editor-icon"></div>
          <h2>Welcome to App Builder</h2>
          <p>Create a new project or select an existing one to get started.</p>
          <button class="btn btn-primary btn-large" id="create-first-project-btn">
            <span id="create-first-icon"></span>
            Create Your First Project
          </button>
        </div>

        <!-- Editor (shown when file is selected) -->
        <div class="editor-container" id="editor-container" style="display: none;">
          <div class="editor-tabs">
            <div class="editor-tab active" id="current-file-tab">
              <span class="tab-name" id="tab-file-name">file.tsx</span>
              <span class="tab-dirty" id="tab-dirty" style="display: none;"></span>
            </div>
          </div>
          <div class="editor-content" id="editor-content"></div>
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="preview-panel" id="preview-panel">
        <div class="preview-header">
          <div class="preview-status" id="preview-status">
            <span class="status-dot" id="status-dot"></span>
            <span class="status-text" id="status-text">Idle</span>
          </div>
          <button class="btn btn-icon" id="refresh-preview-btn" title="Refresh Preview">
            <span id="refresh-icon"></span>
          </button>
          <button class="btn btn-icon" id="toggle-terminal-btn" title="Toggle Terminal">
            <span id="terminal-icon"></span>
          </button>
        </div>

        <!-- Preview iframe -->
        <div class="preview-content" id="preview-content">
          <div class="preview-placeholder" id="preview-placeholder">
            <div class="preview-placeholder-icon" id="preview-placeholder-icon"></div>
            <p>Preview will appear here when the dev server starts</p>
          </div>
          <iframe id="preview-iframe" style="display: none;"></iframe>
        </div>

        <!-- Terminal Panel (collapsible) -->
        <div class="terminal-panel" id="terminal-panel" style="display: none;">
          <div class="terminal-header">
            <span class="terminal-title">Terminal</span>
            <button class="btn btn-icon btn-small" id="clear-terminal-btn" title="Clear">
              <span id="clear-icon"></span>
            </button>
          </div>
          <div class="terminal-content" id="terminal-content"></div>
        </div>
      </div>
    </div>

    <!-- New Project Modal -->
    <div class="modal" id="new-project-modal" style="display: none;">
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New Project</h2>
          <button class="close-btn" id="close-modal-btn"></button>
        </div>
        <form id="new-project-form">
          <div class="form-group">
            <label for="project-name-input">Project Name</label>
            <input type="text" id="project-name-input" placeholder="my-app" required />
          </div>
          <div class="form-group">
            <label for="project-description-input">Description (optional)</label>
            <textarea id="project-description-input" rows="2" placeholder="A brief description of your project"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-project-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Project</button>
          </div>
        </form>
      </div>
    </div>

    <!-- New File Modal -->
    <div class="modal" id="new-file-modal" style="display: none;">
      <div class="modal-backdrop" id="new-file-modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New File</h2>
          <button class="close-btn" id="close-new-file-modal-btn"></button>
        </div>
        <form id="new-file-form">
          <div class="form-group">
            <label for="file-path-input">File Path</label>
            <input type="text" id="file-path-input" placeholder="src/components/MyComponent.tsx" required />
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-file-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Create File</button>
          </div>
        </form>
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
/* Design tokens */
:root {
  --primary: #00a4fe;
  --primary-hover: #0090e0;
  --primary-light: #def1fb;
  --primary-container: #e2f3fb;
  --surface: #ffffff;
  --surface-variant: #f8f9fa;
  --background: #f5f7fa;
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --text-tertiary: #80868b;
  --text-on-primary: #ffffff;
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  --success: #34a853;
  --success-light: #e6f4ea;
  --warning: #ea8600;
  --warning-light: #fef7e0;
  --error: #d93025;
  --error-light: #fce8e6;
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
  --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  --sidebar-width: 240px;
  --header-height: 48px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--background);
  overflow: hidden;
}

.app-builder {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  height: var(--header-height);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  border-radius: var(--radius-sm);
  color: var(--primary);
}

.header-icon svg {
  width: 16px;
  height: 16px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary);
  color: var(--text-on-primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface-variant);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
}

.btn-icon:hover {
  background: var(--surface-variant);
  color: var(--text-primary);
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-large {
  padding: 10px 20px;
  font-size: 14px;
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

.close-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--error-light);
  color: var(--error);
}

.close-btn svg {
  width: 16px;
  height: 16px;
}

/* Main Content */
.main-content {
  flex: 1;
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr 1fr;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Project List */
.project-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: 4px;
}

.project-item:hover {
  background: var(--primary-container);
}

.project-item.active {
  background: var(--primary-light);
  border-left: 3px solid var(--primary);
}

.project-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  border-radius: var(--radius-sm);
  color: var(--primary);
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.project-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.project-item:hover .project-actions {
  opacity: 1;
}

.empty-message {
  text-align: center;
  color: var(--text-tertiary);
  padding: 20px;
  font-size: 12px;
}

/* File Tree */
.file-tree {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.file-tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 12px;
}

.file-tree-item:hover {
  background: var(--surface-variant);
}

.file-tree-item.active {
  background: var(--primary-light);
  color: var(--primary);
}

.file-tree-item.directory {
  font-weight: 500;
}

.file-tree-item .icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-tree-item .icon svg {
  width: 14px;
  height: 14px;
}

.file-tree-children {
  padding-left: 16px;
}

.file-actions {
  padding: 8px;
  border-top: 1px solid var(--border);
}

/* Editor Panel */
.editor-panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.empty-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.empty-icon svg {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.empty-editor h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-editor p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-tabs {
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: var(--surface-variant);
  border-bottom: 1px solid var(--border);
  height: 36px;
}

.editor-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: var(--radius-xs) var(--radius-xs) 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.editor-tab.active {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.tab-dirty {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
}

.editor-content {
  flex: 1;
  overflow: hidden;
}

/* CodeMirror overrides */
.cm-editor {
  height: 100%;
  font-size: 13px;
}

.cm-editor .cm-scroller {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

/* Preview Panel */
.preview-panel {
  display: flex;
  flex-direction: column;
  background: var(--background);
  overflow: hidden;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.preview-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.status-dot.idle { background: var(--text-tertiary); }
.status-dot.booting { background: var(--warning); animation: pulse 1s infinite; }
.status-dot.ready { background: var(--success); }
.status-dot.installing { background: var(--warning); animation: pulse 1s infinite; }
.status-dot.running { background: var(--success); }
.status-dot.error { background: var(--error); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.preview-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  text-align: center;
}

.preview-placeholder-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
}

.preview-placeholder-icon svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

#preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

/* Terminal Panel */
.terminal-panel {
  background: #1e1e1e;
  border-top: 1px solid var(--border);
  height: 200px;
  display: flex;
  flex-direction: column;
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #2d2d2d;
  color: #ccc;
  font-size: 12px;
}

.terminal-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #ccc;
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-line {
  margin: 0;
  line-height: 1.4;
}

.terminal-line.stderr {
  color: #f48771;
}

.terminal-line.info {
  color: #6a9955;
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.modal-content {
  position: relative;
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  width: 400px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.form-group {
  padding: 16px 20px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: border-color var(--transition-fast);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

/* Notification */
.notification {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  box-shadow: var(--shadow-md);
  z-index: 2000;
  transition: all var(--transition-normal);
}

.notification.hidden {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(10px);
}

.notification.success {
  background: var(--success);
  color: white;
}

.notification.error {
  background: var(--error);
  color: white;
}

.notification.info {
  background: var(--primary);
  color: white;
}
  `.trim();
}

function getJS(): string {
  return `
// SVG Icons
const Icons = {
  hammer: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  folderOpen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>',
  file: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  fileCode: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>',
  back: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>',
  terminal: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  monitor: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  code: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  clear: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

// State
const state = {
  projects: [],
  project: null,
  fileTree: [],
  selectedFile: null,
  fileContent: '',
  webContainerStatus: 'idle',
  serverUrl: null,
  terminalOutput: [],
  editor: null,
  webContainer: null,
  webContainerUnavailable: false,
  terminalVisible: false,
};

// Elements cache
const elements = {};

// Initialize function
function initialize() {
  cacheElements();
  injectIcons();
  setupEventListeners();
  loadCodeMirror();

  // Notify DevTools we're ready
  if (window.miniApp) {
    window.miniApp.sendAction('ready', {});
  }
}

// Initialize when DOM is ready, or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM is already loaded, initialize immediately
  initialize();
}

function cacheElements() {
  elements.headerIcon = document.getElementById('header-icon');
  elements.headerTitle = document.getElementById('header-title');
  elements.closeBtn = document.getElementById('close-btn');
  elements.newProjectBtn = document.getElementById('new-project-btn');
  elements.newProjectIcon = document.getElementById('new-project-icon');
  elements.projectListView = document.getElementById('project-list-view');
  elements.fileTreeView = document.getElementById('file-tree-view');
  elements.projectList = document.getElementById('project-list');
  elements.fileTree = document.getElementById('file-tree');
  elements.projectName = document.getElementById('project-name');
  elements.backToProjects = document.getElementById('back-to-projects');
  elements.backIcon = document.getElementById('back-icon');
  elements.newFileBtn = document.getElementById('new-file-btn');
  elements.newFileIcon = document.getElementById('new-file-icon');
  elements.emptyEditor = document.getElementById('empty-editor');
  elements.editorContainer = document.getElementById('editor-container');
  elements.editorContent = document.getElementById('editor-content');
  elements.tabFileName = document.getElementById('tab-file-name');
  elements.tabDirty = document.getElementById('tab-dirty');
  elements.emptyEditorIcon = document.getElementById('empty-editor-icon');
  elements.createFirstProjectBtn = document.getElementById('create-first-project-btn');
  elements.createFirstIcon = document.getElementById('create-first-icon');
  elements.statusDot = document.getElementById('status-dot');
  elements.statusText = document.getElementById('status-text');
  elements.refreshPreviewBtn = document.getElementById('refresh-preview-btn');
  elements.refreshIcon = document.getElementById('refresh-icon');
  elements.toggleTerminalBtn = document.getElementById('toggle-terminal-btn');
  elements.terminalIcon = document.getElementById('terminal-icon');
  elements.previewPlaceholder = document.getElementById('preview-placeholder');
  elements.previewPlaceholderIcon = document.getElementById('preview-placeholder-icon');
  elements.previewIframe = document.getElementById('preview-iframe');
  elements.terminalPanel = document.getElementById('terminal-panel');
  elements.terminalContent = document.getElementById('terminal-content');
  elements.clearTerminalBtn = document.getElementById('clear-terminal-btn');
  elements.clearIcon = document.getElementById('clear-icon');
  elements.newProjectModal = document.getElementById('new-project-modal');
  elements.newProjectForm = document.getElementById('new-project-form');
  elements.projectNameInput = document.getElementById('project-name-input');
  elements.projectDescriptionInput = document.getElementById('project-description-input');
  elements.closeModalBtn = document.getElementById('close-modal-btn');
  elements.cancelProjectBtn = document.getElementById('cancel-project-btn');
  elements.modalBackdrop = document.getElementById('modal-backdrop');
  elements.newFileModal = document.getElementById('new-file-modal');
  elements.newFileForm = document.getElementById('new-file-form');
  elements.filePathInput = document.getElementById('file-path-input');
  elements.closeNewFileModalBtn = document.getElementById('close-new-file-modal-btn');
  elements.cancelFileBtn = document.getElementById('cancel-file-btn');
  elements.newFileModalBackdrop = document.getElementById('new-file-modal-backdrop');
  elements.notification = document.getElementById('notification');
}

function injectIcons() {
  elements.headerIcon.innerHTML = Icons.hammer;
  elements.closeBtn.innerHTML = Icons.close;
  elements.newProjectIcon.innerHTML = Icons.plus;
  elements.backIcon.innerHTML = Icons.back;
  elements.newFileIcon.innerHTML = Icons.plus;
  elements.emptyEditorIcon.innerHTML = Icons.code;
  elements.createFirstIcon.innerHTML = Icons.plus;
  elements.refreshIcon.innerHTML = Icons.refresh;
  elements.terminalIcon.innerHTML = Icons.terminal;
  elements.previewPlaceholderIcon.innerHTML = Icons.monitor;
  elements.clearIcon.innerHTML = Icons.clear;
  elements.closeModalBtn.innerHTML = Icons.close;
  elements.closeNewFileModalBtn.innerHTML = Icons.close;
}

function setupEventListeners() {
  // Header actions
  elements.closeBtn.addEventListener('click', () => {
    if (window.miniApp) {
      window.miniApp.close();
    }
  });

  elements.newProjectBtn.addEventListener('click', () => {
    showModal('new-project');
  });

  elements.createFirstProjectBtn.addEventListener('click', () => {
    showModal('new-project');
  });

  // Project list navigation
  elements.backToProjects.addEventListener('click', () => {
    showProjectList();
  });

  // New file
  elements.newFileBtn.addEventListener('click', () => {
    showModal('new-file');
  });

  // Preview controls
  elements.refreshPreviewBtn.addEventListener('click', refreshPreview);
  elements.toggleTerminalBtn.addEventListener('click', toggleTerminal);
  elements.clearTerminalBtn.addEventListener('click', clearTerminal);

  // Project modal
  elements.closeModalBtn.addEventListener('click', () => hideModal('new-project'));
  elements.cancelProjectBtn.addEventListener('click', () => hideModal('new-project'));
  elements.modalBackdrop.addEventListener('click', () => hideModal('new-project'));
  elements.newProjectForm.addEventListener('submit', handleCreateProject);

  // File modal
  elements.closeNewFileModalBtn.addEventListener('click', () => hideModal('new-file'));
  elements.cancelFileBtn.addEventListener('click', () => hideModal('new-file'));
  elements.newFileModalBackdrop.addEventListener('click', () => hideModal('new-file'));
  elements.newFileForm.addEventListener('submit', handleCreateFile);

  // Mini app action dispatch handler
  if (window.miniApp) {
    window.miniApp.dispatch = handleDevToolsAction;
  }
}

// Load CodeMirror from CDN
async function loadCodeMirror() {
  try {
    // Import CodeMirror modules from esm.sh
    const [
      { EditorView, basicSetup },
      { javascript },
      { html },
      { css },
      { json },
    ] = await Promise.all([
      import('https://esm.sh/codemirror@6.0.1'),
      import('https://esm.sh/@codemirror/lang-javascript@6.2.1'),
      import('https://esm.sh/@codemirror/lang-html@6.4.7'),
      import('https://esm.sh/@codemirror/lang-css@6.2.1'),
      import('https://esm.sh/@codemirror/lang-json@6.0.1'),
    ]);

    window.CodeMirror = { EditorView, basicSetup, javascript, html, css, json };
    console.log('CodeMirror loaded successfully');
  } catch (error) {
    console.error('Failed to load CodeMirror:', error);
  }
}

// Check if WebContainer can run in this environment
function canUseWebContainer() {
  const isSecureContext = window.isSecureContext;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  const crossOriginIsolated = window.crossOriginIsolated;

  return isSecureContext && hasSharedArrayBuffer && crossOriginIsolated;
}

// Show fallback preview when WebContainer is not available
function showFallbackPreview(message) {
  state.webContainerUnavailable = true;
  updateStatus('unavailable', 'Preview unavailable');

  const previewIframe = elements.previewIframe;
  if (previewIframe) {
    const fallbackHTML = \`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #e0e0e0;
            padding: 20px;
            box-sizing: border-box;
          }
          .container {
            max-width: 600px;
            text-align: center;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h2 {
            color: #00a4fe;
            margin-bottom: 16px;
          }
          p {
            line-height: 1.6;
            margin-bottom: 16px;
          }
          .info-box {
            background: rgba(0, 164, 254, 0.1);
            border: 1px solid rgba(0, 164, 254, 0.3);
            border-radius: 8px;
            padding: 16px;
            text-align: left;
            margin-top: 20px;
          }
          .info-box h3 {
            color: #00a4fe;
            margin: 0 0 12px 0;
            font-size: 14px;
          }
          code {
            background: rgba(255,255,255,0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 13px;
          }
          .command {
            background: #0d1117;
            border-radius: 6px;
            padding: 12px;
            margin-top: 12px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🔧</div>
          <h2>Live Preview Unavailable</h2>
          <p>\${message}</p>
          <div class="info-box">
            <h3>How to Enable Live Preview</h3>
            <p>WebContainer requires <code>Cross-Origin-Isolation</code> headers. To enable:</p>
            <p><strong>Option 1:</strong> Run Chrome with flags:</p>
            <div class="command">chrome --enable-features=SharedArrayBuffer</div>
            <p style="margin-top: 16px;"><strong>Option 2:</strong> Serve DevTools with headers:</p>
            <div class="command">Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin</div>
          </div>
          <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
            You can still edit files and they will be saved. The preview will work once cross-origin isolation is enabled.
          </p>
        </div>
      </body>
      </html>
    \`;
    previewIframe.srcdoc = fallbackHTML;
  }
}

// Initialize WebContainer
async function initWebContainer() {
  if (state.webContainer) return state.webContainer;
  if (state.webContainerUnavailable) return null;

  try {
    updateStatus('booting', 'Checking environment...');
    appendTerminal('info', '=== WebContainer Environment Check ===');

    // Check environment requirements
    const isSecureContext = window.isSecureContext;
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
    const crossOriginIsolated = window.crossOriginIsolated;

    appendTerminal('info', 'isSecureContext: ' + isSecureContext);
    appendTerminal('info', 'SharedArrayBuffer available: ' + hasSharedArrayBuffer);
    appendTerminal('info', 'crossOriginIsolated: ' + crossOriginIsolated);
    appendTerminal('info', 'location.origin: ' + window.location.origin);

    // Early exit if cross-origin isolation is not available
    if (!crossOriginIsolated) {
      appendTerminal('stderr', '');
      appendTerminal('stderr', '=== WebContainer Cannot Start ===');
      appendTerminal('stderr', 'Cross-Origin Isolation is REQUIRED but not available.');
      appendTerminal('stderr', '');
      appendTerminal('stderr', 'WebContainer needs these HTTP headers:');
      appendTerminal('stderr', '  Cross-Origin-Embedder-Policy: require-corp');
      appendTerminal('stderr', '  Cross-Origin-Opener-Policy: same-origin');
      appendTerminal('stderr', '');
      appendTerminal('stderr', 'Without these headers, SharedArrayBuffer is disabled');
      appendTerminal('stderr', 'and WebContainer cannot run.');
      appendTerminal('stderr', '');
      appendTerminal('info', 'File editing still works - files are saved to IndexedDB.');
      appendTerminal('info', 'Live preview will be available once headers are configured.');

      showFallbackPreview('Cross-Origin Isolation is required for live preview but is not available in this environment.');
      return null;
    }

    if (!hasSharedArrayBuffer) {
      appendTerminal('stderr', 'SharedArrayBuffer is not available.');
      showFallbackPreview('SharedArrayBuffer is not available in this browser.');
      return null;
    }

    appendTerminal('info', '');
    appendTerminal('info', 'Environment OK! Starting WebContainer...');
    updateStatus('booting', 'Booting WebContainer...');

    appendTerminal('info', 'Importing WebContainer from esm.sh...');

    const { WebContainer } = await import('https://esm.sh/@webcontainer/api@1.1.9');
    appendTerminal('info', 'WebContainer imported successfully');

    appendTerminal('info', 'Calling WebContainer.boot()...');
    state.webContainer = await WebContainer.boot();
    appendTerminal('info', 'WebContainer.boot() completed!');

    state.webContainer.on('server-ready', (port, url) => {
      state.serverUrl = url;
      updateStatus('running', 'Dev server running');
      showPreview(url);
    });

    state.webContainer.on('error', (error) => {
      appendTerminal('stderr', 'WebContainer error: ' + error.message);
      updateStatus('error', 'Error');
    });

    updateStatus('ready', 'WebContainer ready');
    return state.webContainer;
  } catch (error) {
    console.error('Failed to boot WebContainer:', error);
    updateStatus('error', 'Failed to boot');
    appendTerminal('stderr', 'Failed to boot WebContainer: ' + error.message);
    appendTerminal('stderr', 'Error stack: ' + (error.stack || 'no stack'));
    showFallbackPreview('Failed to initialize WebContainer: ' + error.message);
    return null;
  }
}

// Mount project files to WebContainer
async function mountProject(files) {
  // Auto-show terminal for debugging
  if (!state.terminalVisible) {
    state.terminalVisible = true;
    elements.terminalPanel.style.display = 'flex';
  }

  if (!state.webContainer) {
    await initWebContainer();
  }

  if (!state.webContainer) return;

  updateStatus('installing', 'Mounting files...');

  // Convert flat file list to WebContainer tree structure
  const fileTree = {};
  for (const file of files) {
    const parts = file.path.split('/');
    let current = fileTree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = current[part].directory;
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = { file: { contents: file.content } };
  }

  try {
    await state.webContainer.mount(fileTree);
    appendTerminal('info', 'Files mounted successfully');

    // Install dependencies
    await installDependencies();

    // Start dev server
    await startDevServer();
  } catch (error) {
    console.error('Failed to mount project:', error);
    appendTerminal('stderr', 'Failed to mount: ' + error.message);
    updateStatus('error', 'Mount failed');
  }
}

async function installDependencies() {
  if (!state.webContainer) return;

  updateStatus('installing', 'Installing dependencies...');
  appendTerminal('info', '$ npm install');

  try {
    const installProcess = await state.webContainer.spawn('npm', ['install']);

    installProcess.output.pipeTo(new WritableStream({
      write(chunk) {
        appendTerminal('stdout', chunk);
      }
    }));

    const exitCode = await installProcess.exit;

    if (exitCode !== 0) {
      appendTerminal('stderr', 'npm install failed with exit code ' + exitCode);
      updateStatus('error', 'Install failed');
    } else {
      appendTerminal('info', 'Dependencies installed successfully');
    }
  } catch (error) {
    appendTerminal('stderr', 'npm install error: ' + error.message);
    updateStatus('error', 'Install failed');
  }
}

async function startDevServer() {
  if (!state.webContainer) return;

  updateStatus('installing', 'Starting dev server...');
  appendTerminal('info', '$ npm run dev');

  try {
    const devProcess = await state.webContainer.spawn('npm', ['run', 'dev']);

    devProcess.output.pipeTo(new WritableStream({
      write(chunk) {
        appendTerminal('stdout', chunk);
      }
    }));

    // Don't await - the dev server runs continuously
  } catch (error) {
    appendTerminal('stderr', 'Dev server error: ' + error.message);
    updateStatus('error', 'Server failed');
  }
}

// Write file to WebContainer (for HMR)
async function writeFileToContainer(path, content) {
  if (!state.webContainer) return;

  try {
    await state.webContainer.fs.writeFile(path, content);
    appendTerminal('info', 'Updated: ' + path);
  } catch (error) {
    console.error('Failed to write file:', error);
  }
}

// Handle actions from DevTools
function handleDevToolsAction(action) {
  console.log('Received action from DevTools:', action);

  switch (action.action) {
    case 'init':
      handleInit(action.payload);
      break;

    case 'project-created':
    case 'project-opened':
      handleProjectOpened(action.payload);
      break;

    case 'project-deleted':
      handleProjectDeleted(action.payload);
      break;

    case 'file-selected':
      handleFileSelected(action.payload);
      break;

    case 'file-synced':
      // File was synced to controller, now sync to WebContainer
      writeFileToContainer(action.payload.path, action.payload.content);
      break;

    case 'file-created':
    case 'file-deleted':
      handleFileTreeUpdate(action.payload);
      break;

    case 'notification':
      showNotification(action.payload.message, action.payload.type);
      break;
  }
}

function handleInit(payload) {
  state.projects = payload.projects || [];
  state.project = payload.project;
  state.fileTree = payload.fileTree || [];
  state.selectedFile = payload.selectedFile;

  renderProjectList();

  if (state.project) {
    showFileTree();
    renderFileTree();
    if (state.selectedFile) {
      selectFile(state.selectedFile);
    }
    mountProject(state.project.files);
  } else {
    showProjectList();
  }
}

function handleProjectOpened(payload) {
  state.project = payload.project;
  state.projects = payload.projects || state.projects;
  state.fileTree = payload.fileTree || [];
  state.selectedFile = payload.selectedFile;

  renderProjectList();
  showFileTree();
  renderFileTree();

  if (state.selectedFile) {
    selectFile(state.selectedFile);
  }

  mountProject(state.project.files);
}

function handleProjectDeleted(payload) {
  state.projects = payload.projects || [];
  state.project = null;
  state.fileTree = [];
  state.selectedFile = null;

  renderProjectList();
  showProjectList();
  showEmptyEditor();
}

function handleFileSelected(payload) {
  state.selectedFile = payload.path;
  state.fileContent = payload.content;
  openFileInEditor(payload.path, payload.content, payload.type);
}

function handleFileTreeUpdate(payload) {
  state.fileTree = payload.fileTree || [];
  state.selectedFile = payload.selectedFile || state.selectedFile;
  renderFileTree();
}

// UI Rendering
function renderProjectList() {
  if (state.projects.length === 0) {
    elements.projectList.innerHTML = '<div class="empty-message">No projects yet. Create one to get started!</div>';
    return;
  }

  elements.projectList.innerHTML = state.projects.map(project => {
    const date = new Date(project.updatedAt).toLocaleDateString();
    return '<div class="project-item" data-id="' + project.id + '">' +
      '<div class="project-icon">' + Icons.folder + '</div>' +
      '<div class="project-info">' +
        '<div class="project-name">' + escapeHtml(project.name) + '</div>' +
        '<div class="project-meta">' + project.fileCount + ' files &bull; ' + date + '</div>' +
      '</div>' +
      '<div class="project-actions">' +
        '<button class="btn btn-icon btn-small delete-project-btn" data-id="' + project.id + '" title="Delete">' +
          Icons.trash +
        '</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // Add click handlers
  elements.projectList.querySelectorAll('.project-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-project-btn')) {
        const id = e.target.closest('.delete-project-btn').dataset.id;
        if (confirm('Delete this project?')) {
          window.miniApp?.sendAction('delete-project', { projectId: id });
        }
      } else {
        const id = item.dataset.id;
        window.miniApp?.sendAction('open-project', { projectId: id });
      }
    });
  });
}

function renderFileTree() {
  if (state.fileTree.length === 0) {
    elements.fileTree.innerHTML = '<div class="empty-message">No files</div>';
    return;
  }

  elements.fileTree.innerHTML = renderFileTreeNodes(state.fileTree, 0);

  // Add click handlers
  elements.fileTree.querySelectorAll('.file-tree-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.dataset.path;
      const isDir = item.dataset.isdir === 'true';

      if (!isDir) {
        selectFile(path);
        window.miniApp?.sendAction('select-file', { path });
      }
    });
  });
}

function renderFileTreeNodes(nodes, level) {
  return nodes.map(node => {
    const isSelected = node.path === state.selectedFile;
    const icon = node.isDirectory ? Icons.folder : getFileIcon(node.name);
    const dirClass = node.isDirectory ? 'directory' : '';
    const activeClass = isSelected ? 'active' : '';
    const paddingLeft = 8 + level * 16;

    let html = '<div class="file-tree-item ' + dirClass + ' ' + activeClass + '"' +
      ' data-path="' + node.path + '"' +
      ' data-isdir="' + node.isDirectory + '"' +
      ' style="padding-left: ' + paddingLeft + 'px">' +
      '<span class="icon">' + icon + '</span>' +
      '<span class="name">' + escapeHtml(node.name) + '</span>' +
    '</div>';

    if (node.children && node.children.length > 0) {
      html += '<div class="file-tree-children">' + renderFileTreeNodes(node.children, level + 1) + '</div>';
    }

    return html;
  }).join('');
}

function getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html'];
  return codeExts.includes(ext) ? Icons.fileCode : Icons.file;
}

function selectFile(path) {
  state.selectedFile = path;

  // Update UI
  elements.fileTree.querySelectorAll('.file-tree-item').forEach(item => {
    item.classList.toggle('active', item.dataset.path === path);
  });
}

function openFileInEditor(path, content, type) {
  elements.emptyEditor.style.display = 'none';
  elements.editorContainer.style.display = 'flex';

  elements.tabFileName.textContent = path.split('/').pop();

  // Clear previous editor
  elements.editorContent.innerHTML = '';

  if (!window.CodeMirror) {
    elements.editorContent.innerHTML = '<pre style="padding: 16px; overflow: auto; height: 100%;">' + escapeHtml(content) + '</pre>';
    return;
  }

  // Determine language
  const ext = path.split('.').pop()?.toLowerCase();
  let language;
  switch (ext) {
    case 'ts':
    case 'tsx':
      language = window.CodeMirror.javascript({ typescript: true, jsx: true });
      break;
    case 'js':
    case 'jsx':
      language = window.CodeMirror.javascript({ jsx: true });
      break;
    case 'html':
      language = window.CodeMirror.html();
      break;
    case 'css':
      language = window.CodeMirror.css();
      break;
    case 'json':
      language = window.CodeMirror.json();
      break;
    default:
      language = window.CodeMirror.javascript();
  }

  // Create CodeMirror editor
  let saveTimeout = null;

  state.editor = new window.CodeMirror.EditorView({
    doc: content,
    extensions: [
      window.CodeMirror.basicSetup,
      language,
      window.CodeMirror.EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          elements.tabDirty.style.display = 'inline-block';

          // Debounced save
          if (saveTimeout) clearTimeout(saveTimeout);
          saveTimeout = setTimeout(() => {
            const newContent = state.editor.state.doc.toString();
            window.miniApp?.sendAction('file-changed', { path, content: newContent });
            elements.tabDirty.style.display = 'none';
          }, 500);
        }
      }),
    ],
    parent: elements.editorContent,
  });
}

function showEmptyEditor() {
  elements.emptyEditor.style.display = 'flex';
  elements.editorContainer.style.display = 'none';
}

function showProjectList() {
  elements.projectListView.style.display = 'flex';
  elements.fileTreeView.style.display = 'none';
  showEmptyEditor();
}

function showFileTree() {
  elements.projectListView.style.display = 'none';
  elements.fileTreeView.style.display = 'flex';

  if (state.project) {
    elements.projectName.textContent = state.project.name;
  }
}

// Modal handling
function showModal(type) {
  if (type === 'new-project') {
    elements.newProjectModal.style.display = 'flex';
    elements.projectNameInput.value = '';
    elements.projectDescriptionInput.value = '';
    elements.projectNameInput.focus();
  } else if (type === 'new-file') {
    elements.newFileModal.style.display = 'flex';
    elements.filePathInput.value = '';
    elements.filePathInput.focus();
  }
}

function hideModal(type) {
  if (type === 'new-project') {
    elements.newProjectModal.style.display = 'none';
  } else if (type === 'new-file') {
    elements.newFileModal.style.display = 'none';
  }
}

function handleCreateProject(e) {
  e.preventDefault();

  const name = elements.projectNameInput.value.trim();
  const description = elements.projectDescriptionInput.value.trim();

  if (!name) return;

  window.miniApp?.sendAction('create-project', {
    data: { name, description }
  });

  hideModal('new-project');
}

function handleCreateFile(e) {
  e.preventDefault();

  const path = elements.filePathInput.value.trim();
  if (!path) return;

  window.miniApp?.sendAction('create-file', {
    path,
    content: ''
  });

  hideModal('new-file');
}

// Preview controls
function updateStatus(status, text) {
  state.webContainerStatus = status;
  elements.statusDot.className = 'status-dot ' + status;
  elements.statusText.textContent = text;
}

function showPreview(url) {
  elements.previewPlaceholder.style.display = 'none';
  elements.previewIframe.style.display = 'block';
  elements.previewIframe.src = url;
}

function refreshPreview() {
  if (elements.previewIframe.src) {
    elements.previewIframe.src = elements.previewIframe.src;
  }
}

function toggleTerminal() {
  state.terminalVisible = !state.terminalVisible;
  elements.terminalPanel.style.display = state.terminalVisible ? 'flex' : 'none';
}

function appendTerminal(type, content) {
  const line = document.createElement('div');
  line.className = 'terminal-line ' + type;
  line.textContent = content;
  elements.terminalContent.appendChild(line);
  elements.terminalContent.scrollTop = elements.terminalContent.scrollHeight;
}

function clearTerminal() {
  elements.terminalContent.innerHTML = '';
}

// Notification
function showNotification(message, type = 'info') {
  elements.notification.textContent = message;
  elements.notification.className = 'notification ' + type;

  setTimeout(() => {
    elements.notification.classList.add('hidden');
  }, 3000);
}

// Utility
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
  `.trim();
}
