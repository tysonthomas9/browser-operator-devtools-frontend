// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * File Manager SPA - Bundled HTML, CSS, and JS for the File Manager web app
 *
 * This file exports the complete SPA as strings that can be injected via RenderWebAppTool.
 * The SPA communicates with DevTools via the Mini App protocol:
 * - SPA -> DevTools: window.__miniAppBridge_file_manager(payload) (via Runtime.addBinding)
 * - DevTools -> SPA: window.miniApp.dispatch(action) (via Runtime.evaluate)
 */

export const FileManagerSPA = {
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
  <title>File Manager</title>
</head>
<body>
  <div class="file-manager">
    <!-- Header -->
    <header class="fm-header">
      <div class="header-left">
        <div class="header-icon">&#128193;</div>
        <h1 class="fm-title">File Manager</h1>
        <nav class="breadcrumb" id="breadcrumb"></nav>
      </div>
      <div class="header-actions">
        <div class="search-container">
          <input type="search" id="search-input" placeholder="Search documents..." class="search-input">
        </div>
        <button class="btn btn-primary" id="new-doc-btn">+ New</button>
        <button class="btn btn-header" id="import-btn" title="Import file">Import</button>
        <button class="close-btn" id="close-btn" title="Close File Manager">&#10005;</button>
      </div>
    </header>

    <!-- Browser View -->
    <div class="browser-view" id="browser-view">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-section">
          <h3>Quick Access</h3>
          <ul class="quick-access">
            <li class="quick-item active" data-view="all">
              <span class="quick-icon">&#128196;</span> All Documents
            </li>
            <li class="quick-item" data-view="recent">
              <span class="quick-icon">&#128337;</span> Recent
            </li>
          </ul>
        </div>
        <div class="sidebar-section">
          <div class="section-header-row">
            <h3>Folders</h3>
            <button class="btn-icon" id="new-folder-btn" title="New folder">+</button>
          </div>
          <ul class="folder-tree" id="folder-tree"></ul>
        </div>
        <div class="sidebar-section">
          <h3>Tags</h3>
          <div class="tag-cloud" id="tag-cloud"></div>
        </div>
      </aside>
      <main class="content">
        <div class="toolbar">
          <div class="toolbar-left">
            <select id="sort-select" class="sort-select">
              <option value="updated">Last Modified</option>
              <option value="name">Name</option>
              <option value="created">Created</option>
            </select>
          </div>
          <div class="toolbar-right">
            <button class="view-btn active" id="grid-view-btn" title="Grid view">&#9783;</button>
            <button class="view-btn" id="list-view-btn" title="List view">&#9776;</button>
          </div>
        </div>
        <div class="items-container" id="items-container">
          <!-- Folders and documents rendered here -->
        </div>
        <div class="empty-state" id="empty-state" style="display: none;">
          <div class="empty-icon">&#128196;</div>
          <h3>No documents yet</h3>
          <p>Create a new document or import an existing file to get started.</p>
          <button class="btn btn-primary" id="empty-new-doc-btn">Create Document</button>
        </div>
      </main>
    </div>

    <!-- Document View -->
    <div class="document-view" id="document-view" style="display: none;">
      <div class="doc-header">
        <button class="btn btn-header" id="back-btn">&#8592; Back</button>
        <input type="text" id="doc-title" class="doc-title-input" placeholder="Untitled">
        <div class="doc-actions">
          <button class="btn btn-ai" id="ai-summarize-btn" title="Generate summary">Summarize</button>
          <button class="btn btn-ai" id="ai-improve-btn" title="Improve writing">Improve</button>
          <button class="btn btn-ai" id="ai-expand-btn" title="Expand content">Expand</button>
          <button class="btn btn-header" id="export-btn" title="Export">Export</button>
          <button class="btn btn-primary" id="save-btn">Save</button>
        </div>
      </div>
      <div class="doc-metadata">
        <div class="tags-editor" id="tags-editor">
          <div class="tags-list" id="tags-list"></div>
          <input type="text" id="tag-input" class="tag-input" placeholder="Add tag...">
        </div>
        <div class="doc-stats">
          <span id="word-count">0 words</span>
          <span id="last-saved"></span>
        </div>
      </div>
      <div class="editor-container">
        <div class="editor-toolbar" id="editor-toolbar">
          <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button class="toolbar-btn" data-action="heading" title="Heading">H</button>
          <span class="toolbar-separator"></span>
          <button class="toolbar-btn" data-action="ul" title="Bullet list">&#8226;</button>
          <button class="toolbar-btn" data-action="ol" title="Numbered list">1.</button>
          <button class="toolbar-btn" data-action="link" title="Link">&#128279;</button>
          <button class="toolbar-btn" data-action="code" title="Code">&lt;/&gt;</button>
          <span class="toolbar-separator"></span>
          <button class="toolbar-btn toggle-preview" id="toggle-preview-btn" title="Toggle preview">Preview</button>
        </div>
        <div class="editor-split">
          <textarea id="editor" class="editor" placeholder="Start writing..."></textarea>
          <div class="preview" id="preview" style="display: none;"></div>
        </div>
      </div>
    </div>

    <!-- Search View -->
    <div class="search-view" id="search-view" style="display: none;">
      <div class="search-header">
        <button class="btn btn-header" id="search-back-btn">&#8592; Back</button>
        <h2>Search Results</h2>
        <span class="search-query" id="search-query-display"></span>
      </div>
      <div class="search-results" id="search-results"></div>
    </div>

    <!-- New Document Modal -->
    <div class="modal" id="new-doc-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>New Document</h2>
          <button class="modal-close" id="new-doc-modal-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="new-doc-title">Title</label>
            <input type="text" id="new-doc-title" placeholder="Document title">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="new-doc-cancel">Cancel</button>
          <button class="btn btn-primary" id="new-doc-confirm">Create</button>
        </div>
      </div>
    </div>

    <!-- New Folder Modal -->
    <div class="modal" id="new-folder-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>New Folder</h2>
          <button class="modal-close" id="new-folder-modal-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="new-folder-name">Folder Name</label>
            <input type="text" id="new-folder-name" placeholder="Folder name">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="new-folder-cancel">Cancel</button>
          <button class="btn btn-primary" id="new-folder-confirm">Create</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div class="modal" id="delete-modal" style="display: none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Confirm Delete</h2>
          <button class="modal-close" id="delete-modal-close">&#10005;</button>
        </div>
        <div class="modal-body">
          <p id="delete-message">Are you sure you want to delete this item?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="delete-cancel">Cancel</button>
          <button class="btn btn-danger" id="delete-confirm">Delete</button>
        </div>
      </div>
    </div>

    <!-- AI Result Toast -->
    <div class="toast" id="toast" style="display: none;">
      <div class="toast-content" id="toast-content"></div>
      <button class="toast-close" id="toast-close">&#10005;</button>
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
  --secondary: #6bbdef;
  --surface: #ffffff;
  --surface-variant: #f8f9fa;
  --background: #f5f7fa;
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --text-muted: #9aa0a6;
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.12);
  --success: #34a853;
  --warning: #ea8600;
  --error: #d93025;
  --folder-color: #ffc107;
  --document-color: #4285f4;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --transition: 0.15s ease;
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
  height: 100vh;
  overflow: hidden;
}

.file-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Header */
.fm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  font-size: 24px;
}

.fm-title {
  font-size: 18px;
  font-weight: 600;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.breadcrumb-item {
  cursor: pointer;
  transition: color var(--transition);
}

.breadcrumb-item:hover {
  color: var(--primary);
}

.breadcrumb-separator {
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-container {
  position: relative;
}

.search-input {
  width: 240px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition);
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 16px;
  transition: background var(--transition);
}

.close-btn:hover {
  background: var(--surface-variant);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: var(--surface-variant);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--border);
}

.btn-header {
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 12px;
}

.btn-header:hover {
  background: var(--surface-variant);
}

.btn-ai {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
}

.btn-ai:hover {
  opacity: 0.9;
}

.btn-danger {
  background: var(--error);
  color: white;
}

.btn-danger:hover {
  background: #c5221f;
}

.btn-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 16px;
}

.btn-icon:hover {
  background: var(--surface-variant);
}

/* Browser View */
.browser-view {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 240px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px 0;
}

.sidebar-section {
  padding: 0 16px;
  margin-bottom: 20px;
}

.sidebar-section h3 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-header-row h3 {
  margin-bottom: 0;
}

.quick-access {
  list-style: none;
}

.quick-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition);
}

.quick-item:hover {
  background: var(--surface-variant);
}

.quick-item.active {
  background: var(--primary-light);
  color: var(--primary);
  font-weight: 500;
}

.quick-icon {
  font-size: 16px;
}

.folder-tree {
  list-style: none;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all var(--transition);
}

.folder-item:hover {
  background: var(--surface-variant);
}

.folder-item.active {
  background: var(--primary-light);
  color: var(--primary);
}

.folder-icon {
  color: var(--folder-color);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  background: var(--surface-variant);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition);
}

.tag-chip:hover {
  background: var(--primary-light);
  color: var(--primary);
}

/* Main Content */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-select {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
}

.view-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  transition: all var(--transition);
}

.view-btn:first-child {
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.view-btn:last-child {
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin-left: -1px;
}

.view-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* Items Container */
.items-container {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  align-content: start;
}

.items-container.list-view {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.items-container.list-view .item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  height: auto;
}

.items-container.list-view .item-icon {
  font-size: 24px;
}

.items-container.list-view .item-info {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.items-container.list-view .item-preview,
.items-container.list-view .item-tags {
  display: none;
}

.item-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  padding: 16px;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
}

.item-card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.item-card.folder {
  border-left: 3px solid var(--folder-color);
}

.item-card.document {
  border-left: 3px solid var(--document-color);
}

.item-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.item-title {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.item-preview {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.item-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--surface-variant);
  border-radius: 8px;
  color: var(--text-secondary);
}

.item-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: none;
}

.item-card:hover .item-actions {
  display: flex;
  gap: 4px;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 64px;
  opacity: 0.5;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.empty-state p {
  margin-bottom: 20px;
}

/* Document View */
.document-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  overflow: hidden;
}

.doc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}

.doc-title-input {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  border: none;
  outline: none;
  padding: 8px;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
}

.doc-title-input:hover,
.doc-title-input:focus {
  background: var(--surface-variant);
}

.doc-actions {
  display: flex;
  gap: 8px;
}

.doc-metadata {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--surface-variant);
  border-bottom: 1px solid var(--border);
}

.tags-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tags-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--primary-light);
  color: var(--primary);
  border-radius: 12px;
  font-size: 12px;
}

.tag-remove {
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
}

.tag-input {
  border: none;
  outline: none;
  padding: 4px 8px;
  font-size: 12px;
  background: transparent;
  width: 100px;
}

.doc-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Editor */
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: all var(--transition);
}

.toolbar-btn:hover {
  background: var(--surface-variant);
  color: var(--text-primary);
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 8px;
}

.toggle-preview {
  width: auto;
  padding: 0 12px;
  font-size: 12px;
}

.toggle-preview.active {
  background: var(--primary);
  color: white;
}

.editor-split {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor {
  flex: 1;
  padding: 20px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--surface);
}

.preview {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: var(--surface);
  border-left: 1px solid var(--border);
}

.preview h1, .preview h2, .preview h3 {
  margin-bottom: 12px;
  font-weight: 600;
}

.preview h1 { font-size: 28px; }
.preview h2 { font-size: 22px; }
.preview h3 { font-size: 18px; }

.preview p {
  margin-bottom: 12px;
}

.preview ul, .preview ol {
  margin-bottom: 12px;
  padding-left: 24px;
}

.preview code {
  background: var(--surface-variant);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
}

.preview pre {
  background: var(--surface-variant);
  padding: 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin-bottom: 12px;
}

.preview pre code {
  background: transparent;
  padding: 0;
}

/* Search View */
.search-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.search-query-display {
  color: var(--text-secondary);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.search-result-item {
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  cursor: pointer;
  transition: all var(--transition);
}

.search-result-item:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-sm);
}

.search-result-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.search-result-preview {
  font-size: 13px;
  color: var(--text-secondary);
}

.search-result-preview mark {
  background: var(--primary-light);
  color: var(--primary);
  padding: 0 2px;
}

/* Modals */
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-md);
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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

.modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition);
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  border-left: 4px solid var(--primary);
  max-width: 400px;
  animation: toastIn 0.3s ease;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast-content {
  flex: 1;
  font-size: 13px;
}

.toast-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
}

/* Loading State */
.loading {
  opacity: 0.7;
  pointer-events: none;
}

.loading::after {
  content: '';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
`;
}

function getJS(): string {
  return `
// State
let state = {
  currentView: 'browser',
  currentFolderId: null,
  currentDocumentId: null,
  currentDocument: null,
  documents: [],
  folders: [],
  allTags: [],
  searchQuery: '',
  searchResults: [],
  recentDocuments: [],
  folderPath: [],
  isEditing: false,
  hasUnsavedChanges: false,
};

let viewMode = 'grid';
let previewVisible = false;
let pendingDelete = null;

// Track last pushed history state to prevent duplicates
let lastHistoryFolderId = null;
let lastHistoryDocId = null;
let lastHistorySearchQuery = null;

// ============================================================================
// Browser History API Integration
// ============================================================================

function pushHistoryState() {
  if (!window.miniAppRouter) return;

  const currentFolderId = state.currentFolderId;
  const currentDocId = state.currentDocumentId;
  const currentSearchQuery = state.currentView === 'search' ? state.searchQuery : null;

  // Don't push duplicate states
  if (currentFolderId === lastHistoryFolderId &&
      currentDocId === lastHistoryDocId &&
      currentSearchQuery === lastHistorySearchQuery) {
    return;
  }

  if (state.currentView === 'document' && currentDocId) {
    window.miniAppRouter.navigate('document', { docId: currentDocId });
  } else if (state.currentView === 'search' && state.searchQuery) {
    window.miniAppRouter.navigate('search', { query: encodeURIComponent(state.searchQuery) });
  } else if (currentFolderId) {
    window.miniAppRouter.navigate('folder', { folderId: currentFolderId });
  } else {
    window.miniAppRouter.navigate('browser');
  }

  lastHistoryFolderId = currentFolderId;
  lastHistoryDocId = currentDocId;
  lastHistorySearchQuery = currentSearchQuery;

  console.log('[FileManager] Pushed history state:', { folderId: currentFolderId, docId: currentDocId, searchQuery: currentSearchQuery });
}

function replaceHistoryState() {
  if (!window.miniAppRouter) return;

  const currentFolderId = state.currentFolderId;
  const currentDocId = state.currentDocumentId;

  if (state.currentView === 'document' && currentDocId) {
    window.miniAppRouter.replace('document', { docId: currentDocId });
  } else if (state.currentView === 'search' && state.searchQuery) {
    window.miniAppRouter.replace('search', { query: encodeURIComponent(state.searchQuery) });
  } else if (currentFolderId) {
    window.miniAppRouter.replace('folder', { folderId: currentFolderId });
  } else {
    window.miniAppRouter.replace('browser');
  }

  lastHistoryFolderId = currentFolderId;
  lastHistoryDocId = currentDocId;
  lastHistorySearchQuery = state.currentView === 'search' ? state.searchQuery : null;
}

function restoreFromHistoryState(historyState) {
  console.log('[FileManager] Restoring from history state:', historyState);

  const { routeName, params } = historyState;

  // Update tracking to prevent re-pushing
  lastHistoryFolderId = params?.folderId || null;
  lastHistoryDocId = params?.docId || null;
  lastHistorySearchQuery = params?.query ? decodeURIComponent(params.query) : null;

  switch (routeName) {
    case 'document':
      if (params?.docId) {
        sendToDevTools({ type: 'open-document', docId: params.docId });
      }
      break;
    case 'folder':
      sendToDevTools({ type: 'navigate-folder', folderId: params?.folderId || null });
      break;
    case 'search':
      if (params?.query) {
        const query = decodeURIComponent(params.query);
        sendToDevTools({ type: 'search', query });
      }
      break;
    case 'browser':
    default:
      sendToDevTools({ type: 'navigate-folder', folderId: null });
      break;
  }
}

function initHistoryListener() {
  window.parent.addEventListener('popstate', (e) => {
    if (e.state) {
      restoreFromHistoryState(e.state);
    } else {
      // No state means initial entry - show browser view
      lastHistoryFolderId = null;
      lastHistoryDocId = null;
      lastHistorySearchQuery = null;
      // Reset to root folder browser view
      sendToDevTools({ type: 'navigate-folder', folderId: null });
    }
  });
  console.log('[FileManager] History listener initialized');
}

// ============================================================================
// Communication with DevTools
// ============================================================================

function sendToDevTools(action) {
  console.log('[FileManager] sendToDevTools called:', action.type);
  if (typeof window.__miniAppBridge_file_manager === 'function') {
    window.__miniAppBridge_file_manager(JSON.stringify(action));
    console.log('[FileManager] Binding call sent');
  } else {
    console.error('[FileManager] Bridge binding not available');
  }
}

// Initialize - handle both cases: DOM loading vs already loaded
function initialize() {
  console.log('[FileManager] Initializing...');
  initEventListeners();
  initHistoryListener();
  replaceHistoryState();
  console.log('[FileManager] Event listeners attached');
  // Signal ready after short delay
  setTimeout(() => {
    sendToDevTools({ type: 'ready' });
  }, 100);
}

// Check if DOM is already loaded (script injected after page load)
if (document.readyState === 'loading') {
  // DOM still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  // DOM already loaded, initialize immediately
  console.log('[FileManager] DOM already loaded, initializing immediately');
  initialize();
}

// State Management
window.onMiniAppStateChange = function(newState) {
  state = { ...state, ...newState };
  render();
  // Update browser history when state changes
  pushHistoryState();
};

window.getMiniAppState = function() {
  return state;
};

window.onMiniAppDispatch = function(action) {
  if (action.action === 'ai-result') {
    showToast(action.payload.result?.summary || action.payload.result?.changes || 'AI action completed');
  }
};

// Render
function render() {
  renderBreadcrumb();
  renderSidebar();
  renderContent();
  updateViews();
}

function updateViews() {
  const browserView = document.getElementById('browser-view');
  const documentView = document.getElementById('document-view');
  const searchView = document.getElementById('search-view');

  browserView.style.display = state.currentView === 'browser' ? 'flex' : 'none';
  documentView.style.display = state.currentView === 'document' ? 'flex' : 'none';
  searchView.style.display = state.currentView === 'search' ? 'flex' : 'none';

  if (state.currentView === 'document' && state.currentDocument) {
    renderDocumentView();
  }

  if (state.currentView === 'search') {
    renderSearchResults();
  }
}

function renderBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  if (!breadcrumb) return;

  const items = [{ name: 'Home', id: null }];
  if (state.folderPath) {
    items.push(...state.folderPath.map(f => ({ name: f.name, id: f.id })));
  }

  breadcrumb.innerHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;
    return \`
      <span class="breadcrumb-item" data-folder-id="\${item.id || ''}">\${item.name}</span>
      \${!isLast ? '<span class="breadcrumb-separator">/</span>' : ''}
    \`;
  }).join('');
}

function renderSidebar() {
  renderFolderTree();
  renderTagCloud();
}

function renderFolderTree() {
  const tree = document.getElementById('folder-tree');
  if (!tree) return;

  const folders = state.folders || [];
  if (folders.length === 0) {
    tree.innerHTML = '<li class="empty-text">No folders</li>';
    return;
  }

  tree.innerHTML = folders.map(folder => \`
    <li class="folder-item \${state.currentFolderId === folder.id ? 'active' : ''}" data-folder-id="\${folder.id}">
      <span class="folder-icon">&#128193;</span>
      <span>\${folder.name}</span>
    </li>
  \`).join('');
}

function renderTagCloud() {
  const cloud = document.getElementById('tag-cloud');
  if (!cloud) return;

  const tags = state.allTags || [];
  if (tags.length === 0) {
    cloud.innerHTML = '<span class="empty-text">No tags</span>';
    return;
  }

  cloud.innerHTML = tags.map(tag => \`
    <span class="tag-chip" data-tag="\${tag}">\${tag}</span>
  \`).join('');
}

function renderContent() {
  const container = document.getElementById('items-container');
  const emptyState = document.getElementById('empty-state');
  if (!container || !emptyState) return;

  container.className = \`items-container \${viewMode === 'list' ? 'list-view' : ''}\`;

  const folders = state.folders || [];
  const documents = state.documents || [];

  if (folders.length === 0 && documents.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  container.style.display = viewMode === 'list' ? 'flex' : 'grid';
  emptyState.style.display = 'none';

  const folderCards = folders.map(folder => \`
    <div class="item-card folder" data-folder-id="\${folder.id}">
      <div class="item-icon folder-icon">&#128193;</div>
      <div class="item-title">\${escapeHtml(folder.name)}</div>
      <div class="item-meta">\${folder.itemCount ?? 0} items</div>
      <div class="item-actions">
        <button class="btn-icon delete-folder-btn" data-folder-id="\${folder.id}" title="Delete">&#128465;</button>
      </div>
    </div>
  \`);

  const docCards = documents.map(doc => \`
    <div class="item-card document" data-doc-id="\${doc.id}">
      <div class="item-icon">&#128196;</div>
      <div class="item-info">
        <div>
          <div class="item-title">\${escapeHtml(doc.title)}</div>
          <div class="item-meta">\${formatDate(doc.updatedAt)} · \${doc.wordCount} words</div>
        </div>
      </div>
      <div class="item-preview">\${escapeHtml(doc.preview || '')}</div>
      \${doc.tags && doc.tags.length > 0 ? \`
        <div class="item-tags">
          \${doc.tags.slice(0, 3).map(t => \`<span class="item-tag">\${escapeHtml(t)}</span>\`).join('')}
        </div>
      \` : ''}
      <div class="item-actions">
        <button class="btn-icon delete-doc-btn" data-doc-id="\${doc.id}" title="Delete">&#128465;</button>
      </div>
    </div>
  \`);

  container.innerHTML = folderCards.join('') + docCards.join('');
}

function renderDocumentView() {
  const doc = state.currentDocument;
  if (!doc) return;

  document.getElementById('doc-title').value = doc.title;
  document.getElementById('editor').value = doc.content;
  document.getElementById('word-count').textContent = \`\${doc.wordCount || 0} words\`;
  document.getElementById('last-saved').textContent = \`Saved \${formatDate(doc.updatedAt)}\`;

  renderDocTags();
  updatePreview();
}

function renderDocTags() {
  const tagsList = document.getElementById('tags-list');
  const doc = state.currentDocument;
  if (!tagsList || !doc) return;

  tagsList.innerHTML = (doc.tags || []).map(tag => \`
    <span class="tag-badge">
      \${escapeHtml(tag)}
      <span class="tag-remove" data-tag="\${tag}">&#10005;</span>
    </span>
  \`).join('');
}

function renderSearchResults() {
  const container = document.getElementById('search-results');
  const queryDisplay = document.getElementById('search-query-display');
  if (!container) return;

  queryDisplay.textContent = \`for "\${state.searchQuery}"\`;

  if (state.searchResults.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No documents found</p></div>';
    return;
  }

  container.innerHTML = state.searchResults.map(doc => \`
    <div class="search-result-item" data-doc-id="\${doc.id}">
      <div class="search-result-title">\${escapeHtml(doc.title)}</div>
      <div class="search-result-preview">\${escapeHtml(doc.preview || '')}</div>
    </div>
  \`).join('');
}

// Event Listeners
function initEventListeners() {
  // Close button
  document.getElementById('close-btn').addEventListener('click', () => {
    sendToDevTools({ type: 'close' });
  });

  // Search
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      sendToDevTools({ type: 'search', query: e.target.value.trim() });
    }
  });

  // New document
  document.getElementById('new-doc-btn').addEventListener('click', () => showModal('new-doc-modal'));
  document.getElementById('empty-new-doc-btn')?.addEventListener('click', () => showModal('new-doc-modal'));

  // New folder
  document.getElementById('new-folder-btn').addEventListener('click', () => showModal('new-folder-modal'));

  // Import
  document.getElementById('import-btn').addEventListener('click', handleImport);

  // Modal close buttons
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) hideModal(modal.id);
    });
  });

  // New doc modal
  document.getElementById('new-doc-cancel').addEventListener('click', () => hideModal('new-doc-modal'));
  document.getElementById('new-doc-confirm').addEventListener('click', handleCreateDocument);

  // New folder modal
  document.getElementById('new-folder-cancel').addEventListener('click', () => hideModal('new-folder-modal'));
  document.getElementById('new-folder-confirm').addEventListener('click', handleCreateFolder);

  // Delete modal
  document.getElementById('delete-cancel').addEventListener('click', () => hideModal('delete-modal'));
  document.getElementById('delete-confirm').addEventListener('click', handleConfirmDelete);

  // View toggle
  document.getElementById('grid-view-btn').addEventListener('click', () => setViewMode('grid'));
  document.getElementById('list-view-btn').addEventListener('click', () => setViewMode('list'));

  // Quick access
  document.querySelectorAll('.quick-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      document.querySelectorAll('.quick-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (view === 'all') {
        sendToDevTools({ type: 'navigate-folder', folderId: null });
      }
      // Recent view handled differently
    });
  });

  // Document view events
  document.getElementById('back-btn').addEventListener('click', handleBackFromDocument);
  document.getElementById('save-btn').addEventListener('click', handleSaveDocument);
  document.getElementById('export-btn').addEventListener('click', handleExport);
  document.getElementById('ai-summarize-btn').addEventListener('click', () => handleAIAction('ai-summarize'));
  document.getElementById('ai-improve-btn').addEventListener('click', () => handleAIAction('ai-improve'));
  document.getElementById('ai-expand-btn').addEventListener('click', () => handleAIAction('ai-expand'));
  document.getElementById('toggle-preview-btn').addEventListener('click', togglePreview);

  // Editor
  document.getElementById('editor').addEventListener('input', handleEditorInput);
  document.getElementById('doc-title').addEventListener('input', () => state.hasUnsavedChanges = true);

  // Tag input
  document.getElementById('tag-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      sendToDevTools({ type: 'add-tag', docId: state.currentDocumentId, tag: e.target.value.trim() });
      e.target.value = '';
    }
  });

  // Toolbar buttons
  document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleToolbarAction(btn.dataset.action));
  });

  // Search view back
  document.getElementById('search-back-btn').addEventListener('click', () => {
    sendToDevTools({ type: 'navigate-folder', folderId: state.currentFolderId });
  });

  // Delegated events
  document.addEventListener('click', handleDelegatedClicks);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleDelegatedClicks(e) {
  // Folder click
  const folderItem = e.target.closest('[data-folder-id]');
  if (folderItem && !e.target.closest('.delete-folder-btn')) {
    const folderId = folderItem.dataset.folderId || null;
    sendToDevTools({ type: 'navigate-folder', folderId });
    return;
  }

  // Document click
  const docItem = e.target.closest('[data-doc-id]');
  if (docItem && !e.target.closest('.delete-doc-btn')) {
    const docId = docItem.dataset.docId;
    sendToDevTools({ type: 'open-document', docId });
    return;
  }

  // Delete folder button
  const deleteFolderBtn = e.target.closest('.delete-folder-btn');
  if (deleteFolderBtn) {
    e.stopPropagation();
    const folderId = deleteFolderBtn.dataset.folderId;
    pendingDelete = { type: 'folder', id: folderId };
    document.getElementById('delete-message').textContent = 'Are you sure you want to delete this folder? Documents will be moved to the parent folder.';
    showModal('delete-modal');
    return;
  }

  // Delete doc button
  const deleteDocBtn = e.target.closest('.delete-doc-btn');
  if (deleteDocBtn) {
    e.stopPropagation();
    const docId = deleteDocBtn.dataset.docId;
    pendingDelete = { type: 'document', id: docId };
    document.getElementById('delete-message').textContent = 'Are you sure you want to delete this document?';
    showModal('delete-modal');
    return;
  }

  // Tag chip click
  const tagChip = e.target.closest('.tag-chip');
  if (tagChip) {
    const tag = tagChip.dataset.tag;
    sendToDevTools({ type: 'search', query: \`tag:\${tag}\` });
    return;
  }

  // Tag remove
  const tagRemove = e.target.closest('.tag-remove');
  if (tagRemove) {
    const tag = tagRemove.dataset.tag;
    sendToDevTools({ type: 'remove-tag', docId: state.currentDocumentId, tag });
    return;
  }
}

function handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (state.currentView === 'document') {
      handleSaveDocument();
    }
  }

  // Escape to close modal or go back
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal[style*="display: flex"]');
    if (openModal) {
      hideModal(openModal.id);
    } else if (state.currentView === 'document') {
      handleBackFromDocument();
    }
  }
}

// Handlers
function handleCreateDocument() {
  const title = document.getElementById('new-doc-title').value.trim();
  if (!title) return;

  sendToDevTools({
    type: 'create-document',
    title,
    folderId: state.currentFolderId,
  });

  document.getElementById('new-doc-title').value = '';
  hideModal('new-doc-modal');
}

function handleCreateFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) return;

  sendToDevTools({
    type: 'create-folder',
    name,
    parentId: state.currentFolderId,
  });

  document.getElementById('new-folder-name').value = '';
  hideModal('new-folder-modal');
}

function handleConfirmDelete() {
  if (!pendingDelete) return;

  if (pendingDelete.type === 'folder') {
    sendToDevTools({ type: 'delete-folder', folderId: pendingDelete.id });
  } else {
    sendToDevTools({ type: 'delete-document', docId: pendingDelete.id });
  }

  pendingDelete = null;
  hideModal('delete-modal');
}

function handleBackFromDocument() {
  if (state.hasUnsavedChanges) {
    if (!confirm('You have unsaved changes. Discard them?')) {
      return;
    }
  }
  sendToDevTools({ type: 'close-document' });
}

function handleSaveDocument() {
  const title = document.getElementById('doc-title').value;
  const content = document.getElementById('editor').value;
  const tags = state.currentDocument?.tags || [];

  sendToDevTools({
    type: 'save-document',
    docId: state.currentDocumentId,
    title,
    content,
    tags,
  });

  state.hasUnsavedChanges = false;
}

function handleEditorInput() {
  state.hasUnsavedChanges = true;
  sendToDevTools({ type: 'content-changed' });
  updatePreview();
  updateWordCount();
}

function handleToolbarAction(action) {
  const editor = document.getElementById('editor');
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.substring(start, end);

  let insert = '';
  let newCursorPos = start;

  switch (action) {
    case 'bold':
      insert = \`**\${selected || 'bold text'}**\`;
      newCursorPos = start + 2;
      break;
    case 'italic':
      insert = \`*\${selected || 'italic text'}*\`;
      newCursorPos = start + 1;
      break;
    case 'heading':
      insert = \`## \${selected || 'Heading'}\`;
      newCursorPos = start + 3;
      break;
    case 'ul':
      insert = \`- \${selected || 'List item'}\`;
      newCursorPos = start + 2;
      break;
    case 'ol':
      insert = \`1. \${selected || 'List item'}\`;
      newCursorPos = start + 3;
      break;
    case 'link':
      insert = \`[\${selected || 'link text'}](url)\`;
      newCursorPos = start + 1;
      break;
    case 'code':
      if (selected.includes('\\n')) {
        insert = \`\\\`\\\`\\\`\\n\${selected}\\n\\\`\\\`\\\`\`;
      } else {
        insert = \`\\\`\${selected || 'code'}\\\`\`;
      }
      newCursorPos = start + 1;
      break;
  }

  editor.value = text.substring(0, start) + insert + text.substring(end);
  editor.focus();
  editor.setSelectionRange(newCursorPos, newCursorPos + (selected || insert).length);
  handleEditorInput();
}

function handleAIAction(action) {
  if (!state.currentDocumentId) return;
  sendToDevTools({ type: action, docId: state.currentDocumentId });
}

async function handleImport() {
  try {
    if (!('showOpenFilePicker' in window)) {
      alert('File import is not supported in this browser');
      return;
    }

    const [fileHandle] = await window.showOpenFilePicker({
      types: [{
        description: 'Text files',
        accept: {
          'text/markdown': ['.md', '.markdown'],
          'text/plain': ['.txt'],
        }
      }],
      multiple: false,
    });

    const file = await fileHandle.getFile();
    const content = await file.text();
    const title = file.name.replace(/\\.(md|txt|markdown)$/i, '');

    sendToDevTools({ type: 'file-imported', title, content });
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Import failed:', err);
    }
  }
}

async function handleExport() {
  if (!state.currentDocument) return;

  try {
    if (!('showSaveFilePicker' in window)) {
      // Fallback: download via blob
      const blob = new Blob([state.currentDocument.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`\${state.currentDocument.title}.md\`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const fileHandle = await window.showSaveFilePicker({
      suggestedName: \`\${state.currentDocument.title}.md\`,
      types: [{
        description: 'Markdown',
        accept: { 'text/markdown': ['.md'] }
      }],
    });

    const writable = await fileHandle.createWritable();
    await writable.write(state.currentDocument.content);
    await writable.close();

    showToast('Document exported successfully');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Export failed:', err);
    }
  }
}

function togglePreview() {
  previewVisible = !previewVisible;
  const preview = document.getElementById('preview');
  const btn = document.getElementById('toggle-preview-btn');

  preview.style.display = previewVisible ? 'block' : 'none';
  btn.classList.toggle('active', previewVisible);

  if (previewVisible) {
    updatePreview();
  }
}

function updatePreview() {
  if (!previewVisible) return;

  const content = document.getElementById('editor').value;
  const preview = document.getElementById('preview');

  // Simple markdown rendering
  let html = content
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>')
    .replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
    .replace(/\\n\\n/g, '</p><p>')
    .replace(/\\n/g, '<br>');

  preview.innerHTML = '<p>' + html + '</p>';
}

function updateWordCount() {
  const content = document.getElementById('editor').value;
  const count = content.trim().split(/\\s+/).filter(Boolean).length;
  document.getElementById('word-count').textContent = \`\${count} words\`;
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('grid-view-btn').classList.toggle('active', mode === 'grid');
  document.getElementById('list-view-btn').classList.toggle('active', mode === 'list');
  renderContent();
}

// Modals
function showModal(id) {
  document.getElementById(id).style.display = 'flex';
}

function hideModal(id) {
  document.getElementById(id).style.display = 'none';
}

// Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  const content = document.getElementById('toast-content');
  content.textContent = message;
  toast.style.display = 'flex';

  setTimeout(() => {
    toast.style.display = 'none';
  }, 5000);
}

document.getElementById('toast-close').addEventListener('click', () => {
  document.getElementById('toast').style.display = 'none';
});

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return \`\${Math.floor(diff / 60000)}m ago\`;
  if (diff < 86400000) return \`\${Math.floor(diff / 3600000)}h ago\`;
  if (diff < 604800000) return \`\${Math.floor(diff / 86400000)}d ago\`;

  return date.toLocaleDateString();
}

function countItemsInFolder(folderId) {
  const docs = state.documents?.filter(d => d.folderId === folderId) || [];
  const folders = state.folders?.filter(f => f.parentId === folderId) || [];
  return docs.length + folders.length;
}
`;
}
