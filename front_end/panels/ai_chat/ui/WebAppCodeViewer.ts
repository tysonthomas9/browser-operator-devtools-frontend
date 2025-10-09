// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';

const logger = createLogger('WebAppCodeViewer');

/**
 * WebAppCodeViewer - A modern, standalone code viewer for web app source code
 *
 * Features:
 * - Clean, shadcn-inspired design
 * - Color-coded sections for HTML, CSS, and JavaScript
 * - Copy-to-clipboard functionality
 * - Professional typography and spacing
 */
export class WebAppCodeViewer {
  /**
   * Display web app source code in a new iframe using RenderWebAppTool
   * @param toolArgs - The original tool arguments containing html, css, and js
   */
  static async show(toolArgs: Record<string, any>): Promise<void> {
    try {
      // Import RenderWebAppTool
      const { RenderWebAppTool } = await import('../tools/RenderWebAppTool.js');

      // Build code viewer
      const viewerHTML = WebAppCodeViewer.buildHTML(toolArgs);
      const viewerCSS = WebAppCodeViewer.buildCSS();
      const viewerJS = WebAppCodeViewer.buildJS();

      // Use RenderWebAppTool to display code viewer
      const tool = new RenderWebAppTool();
      const result = await tool.execute({
        html: viewerHTML,
        css: viewerCSS,
        js: viewerJS,
        reasoning: 'Display web app source code for inspection'
      } as any);

      if ('error' in result) {
        logger.error('Failed to open code viewer:', result.error);
      } else {
        logger.info('Code viewer opened successfully');
      }
    } catch (error) {
      logger.error('Error opening code viewer:', error);
      throw error;
    }
  }

  /**
   * Build HTML structure with modern card-based design
   */
  private static buildHTML(toolArgs: Record<string, any>): string {
    const html = toolArgs.html || '';
    const css = toolArgs.css || '';
    const js = toolArgs.js || '';

    return `
<div class="code-viewer">
  <!-- Header -->
  <header class="viewer-header">
    <div class="header-content">
      <div class="header-title">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
        <h1>Source Code</h1>
      </div>
      <button class="download-all-btn" onclick="downloadAll(event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download All
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="viewer-main">
    <!-- HTML Section -->
    <section class="code-section">
      <div class="section-header">
        <div class="section-title">
          <span class="language-badge html-badge">HTML</span>
          <span class="section-label">Structure</span>
        </div>
        <div class="action-buttons">
          <button class="copy-btn" onclick="copyHTML(event)" data-code-type="html">
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-text">Copy</span>
          </button>
          <button class="download-btn" onclick="downloadHTML(event)" data-code-type="html">
            <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="download-text">Download</span>
          </button>
        </div>
      </div>
      <div class="code-wrapper">
        <pre class="code-display" id="html-code">${WebAppCodeViewer.escapeHTML(html)}</pre>
      </div>
    </section>

    <!-- CSS Section -->
    <section class="code-section">
      <div class="section-header">
        <div class="section-title">
          <span class="language-badge css-badge">CSS</span>
          <span class="section-label">Styles</span>
        </div>
        <div class="action-buttons">
          <button class="copy-btn" onclick="copyCSS(event)" data-code-type="css">
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-text">Copy</span>
          </button>
          <button class="download-btn" onclick="downloadCSS(event)" data-code-type="css">
            <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="download-text">Download</span>
          </button>
        </div>
      </div>
      <div class="code-wrapper">
        <pre class="code-display" id="css-code">${WebAppCodeViewer.escapeHTML(css)}</pre>
      </div>
    </section>

    <!-- JavaScript Section -->
    <section class="code-section">
      <div class="section-header">
        <div class="section-title">
          <span class="language-badge js-badge">JS</span>
          <span class="section-label">Interactivity</span>
        </div>
        <div class="action-buttons">
          <button class="copy-btn" onclick="copyJS(event)" data-code-type="js">
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span class="copy-text">Copy</span>
          </button>
          <button class="download-btn" onclick="downloadJS(event)" data-code-type="js">
            <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="download-text">Download</span>
          </button>
        </div>
      </div>
      <div class="code-wrapper">
        <pre class="code-display" id="js-code">${WebAppCodeViewer.escapeHTML(js)}</pre>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="viewer-footer">
    <div class="footer-content">
      <span class="footer-text">Generated web app code viewer</span>
    </div>
  </footer>
</div>`;
  }

  /**
   * Build modern CSS with shadcn-inspired design system
   */
  private static buildCSS(): string {
    return `
/* ========================================
   MODERN CODE VIEWER - SHADCN INSPIRED
   ======================================== */

/* === Reset & Base === */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  background: #f9fafb;
  color: #111827;
  line-height: 1.5;
  overflow-x: hidden;
}

/* === Layout === */
.code-viewer {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* === Header === */
.viewer-header {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 24px;
  height: 24px;
  color: #00a4fe;
}

.header-title h1 {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.01em;
}

.download-all-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.download-all-btn:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
}

.download-all-btn:active {
  transform: translateY(0);
}

.download-all-btn svg {
  width: 16px;
  height: 16px;
}

/* === Main Content === */
.viewer-main {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* === Code Sections === */
.code-section {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.code-section:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-color: #d1d5db;
}

.section-header {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.language-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.html-badge {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}

.css-badge {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

.js-badge {
  background: #fefce8;
  color: #ca8a04;
  border: 1px solid #fef08a;
}

.section-label {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.copy-btn, .download-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.copy-btn {
  background: #00a4fe;
  color: white;
}

.copy-btn:hover {
  background: #0094e8;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 164, 254, 0.3);
}

.copy-btn:active {
  transform: translateY(0);
}

.copy-btn.copied {
  background: #10b981;
}

.download-btn {
  background: #6366f1;
  color: white;
}

.download-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
}

.download-btn:active {
  transform: translateY(0);
}

.download-btn.downloaded {
  background: #10b981;
}

.copy-icon, .download-icon {
  width: 14px;
  height: 14px;
}

/* === Code Display === */
.code-wrapper {
  position: relative;
  overflow: hidden;
}

.code-display {
  padding: 20px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #1f2937;
  background: #fafafa;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.code-display:empty::before {
  content: '// No code provided';
  color: #9ca3af;
  font-style: italic;
}

/* Custom Scrollbar */
.code-display::-webkit-scrollbar {
  height: 8px;
}

.code-display::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.code-display::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.code-display::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* === Footer === */
.viewer-footer {
  background: white;
  border-top: 1px solid #e5e7eb;
  margin-top: auto;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  text-align: center;
}

.footer-text {
  font-size: 13px;
  color: #6b7280;
}

/* === Responsive Design === */
@media (max-width: 768px) {
  .viewer-main {
    padding: 16px;
    gap: 16px;
  }

  .header-content {
    padding: 12px 16px;
  }

  .header-title h1 {
    font-size: 18px;
  }

  .close-btn {
    padding: 6px 12px;
    font-size: 13px;
  }

  .section-header {
    padding: 10px 16px;
  }

  .code-display {
    padding: 16px;
    font-size: 12px;
  }
}

/* === Animations === */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.code-section {
  animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.code-section:nth-child(1) { animation-delay: 0.05s; }
.code-section:nth-child(2) { animation-delay: 0.1s; }
.code-section:nth-child(3) { animation-delay: 0.15s; }`;
  }

  /**
   * Build JavaScript for copy and download functionality with feedback
   */
  private static buildJS(): string {
    return `
// Copy functions with visual feedback
function copyHTML(event) {
  const code = document.getElementById('html-code').textContent;
  copyToClipboard(code, event.target.closest('.copy-btn'));
}

function copyCSS(event) {
  const code = document.getElementById('css-code').textContent;
  copyToClipboard(code, event.target.closest('.copy-btn'));
}

function copyJS(event) {
  const code = document.getElementById('js-code').textContent;
  copyToClipboard(code, event.target.closest('.copy-btn'));
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    // Update button state
    button.classList.add('copied');
    const copyText = button.querySelector('.copy-text');
    const originalText = copyText.textContent;

    // Update icon to checkmark
    const icon = button.querySelector('.copy-icon');
    const originalIcon = icon.innerHTML;
    icon.innerHTML = '<path d="M20 6L9 17l-5-5"></path>';

    copyText.textContent = 'Copied!';

    // Reset after 2 seconds
    setTimeout(() => {
      button.classList.remove('copied');
      copyText.textContent = originalText;
      icon.innerHTML = originalIcon;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);

    // Show error state
    const copyText = button.querySelector('.copy-text');
    copyText.textContent = 'Failed';
    setTimeout(() => {
      copyText.textContent = 'Copy';
    }, 2000);
  });
}

// Download functions
function downloadHTML(event) {
  const code = document.getElementById('html-code').textContent;
  const button = event?.target?.closest('.download-btn');
  downloadFile(code, 'index.html', button);
}

function downloadCSS(event) {
  const code = document.getElementById('css-code').textContent;
  const button = event?.target?.closest('.download-btn');
  downloadFile(code, 'styles.css', button);
}

function downloadJS(event) {
  const code = document.getElementById('js-code').textContent;
  const button = event?.target?.closest('.download-btn');
  downloadFile(code, 'script.js', button);
}

function downloadAll(event) {
  const button = event.target.closest('.download-all-btn');

  // Show feedback
  const originalText = button.textContent;
  button.textContent = 'Downloading...';

  // Download files sequentially with small delays
  downloadHTML();
  setTimeout(() => downloadCSS(), 100);
  setTimeout(() => downloadJS(), 200);

  // Reset button after downloads
  setTimeout(() => {
    button.textContent = '✓ Downloaded!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  }, 300);
}

function downloadFile(content, filename, button) {
  try {
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show visual feedback if button provided
    if (button) {
      button.classList.add('downloaded');
      const downloadText = button.querySelector('.download-text');
      const originalText = downloadText.textContent;

      // Update icon to checkmark
      const icon = button.querySelector('.download-icon');
      const originalIcon = icon.innerHTML;
      icon.innerHTML = '<path d="M20 6L9 17l-5-5"></path>';

      downloadText.textContent = 'Downloaded!';

      // Reset after 2 seconds
      setTimeout(() => {
        button.classList.remove('downloaded');
        downloadText.textContent = originalText;
        icon.innerHTML = originalIcon;
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to download:', err);

    if (button) {
      const downloadText = button.querySelector('.download-text');
      downloadText.textContent = 'Failed';
      setTimeout(() => {
        downloadText.textContent = 'Download';
      }, 2000);
    }
  }
}

// Initialize
console.log('Code viewer ready');

// Expose handlers globally for inline onclick attributes
// This ensures buttons like onclick="downloadHTML(event)" can resolve.
window.copyHTML = copyHTML;
window.copyCSS = copyCSS;
window.copyJS = copyJS;
window.downloadHTML = downloadHTML;
window.downloadCSS = downloadCSS;
window.downloadJS = downloadJS;
window.downloadAll = downloadAll;`;
  }

  /**
   * Escape HTML for safe display
   */
  private static escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
