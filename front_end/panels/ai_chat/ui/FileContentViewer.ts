// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import type { FileSummary } from '../tools/FileStorageManager.js';
import * as Marked from '../../../third_party/marked/marked.js';

const logger = createLogger('FileContentViewer');

type FileType = 'code' | 'json' | 'markdown' | 'text' | 'html' | 'css';

/**
 * FileContentViewer - Full-screen file viewer using RenderWebAppTool
 *
 * Displays file content in a professional full-screen iframe with:
 * - Syntax-aware formatting
 * - Copy and download functionality
 * - Clean, modern design
 */
export class FileContentViewer {
  /**
   * Display file content in full-screen view
   */
  static async show(file: FileSummary, content: string): Promise<void> {
    try {
      // Import RenderWebAppTool
      const { RenderWebAppTool } = await import('../tools/RenderWebAppTool.js');

      // Build viewer components
      const viewerHTML = await FileContentViewer.buildHTML(file, content);
      const viewerCSS = FileContentViewer.buildCSS();
      const viewerJS = FileContentViewer.buildJS(file.fileName, content);

      // Use RenderWebAppTool to display full-screen viewer
      const tool = new RenderWebAppTool();
      const result = await tool.execute({
        html: viewerHTML,
        css: viewerCSS,
        js: viewerJS,
        reasoning: `Display file content: ${file.fileName}`
      } as any);

      if ('error' in result) {
        logger.error('Failed to open file viewer:', result.error);
      } else {
        logger.info('File viewer opened successfully', { fileName: file.fileName });
      }
    } catch (error) {
      logger.error('Error opening file viewer:', error);
      throw error;
    }
  }

  /**
   * Detect file type based on extension
   */
  private static detectFileType(fileName: string): FileType {
    const ext = fileName.toLowerCase().split('.').pop() || '';

    const typeMap: Record<string, FileType> = {
      'json': 'json',
      'md': 'markdown',
      'markdown': 'markdown',
      'js': 'code',
      'ts': 'code',
      'jsx': 'code',
      'tsx': 'code',
      'py': 'code',
      'java': 'code',
      'cpp': 'code',
      'c': 'code',
      'go': 'code',
      'rs': 'code',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'css',
      'sass': 'css',
      'less': 'css',
    };

    return typeMap[ext] || 'text';
  }

  /**
   * Get file type icon
   */
  private static getFileIcon(fileType: FileType): string {
    const iconMap: Record<FileType, string> = {
      'code': '💻',
      'json': '📋',
      'markdown': '📝',
      'text': '📄',
      'html': '🌐',
      'css': '🎨',
    };
    return iconMap[fileType];
  }

  /**
   * Get file type label
   */
  private static getFileTypeLabel(fileType: FileType): string {
    const labelMap: Record<FileType, string> = {
      'code': 'Code',
      'json': 'JSON',
      'markdown': 'Markdown',
      'text': 'Text',
      'html': 'HTML',
      'css': 'CSS',
    };
    return labelMap[fileType];
  }

  /**
   * Format content based on file type
   */
  private static formatContent(content: string, fileType: FileType): string {
    if (fileType === 'json') {
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    }
    return content;
  }

  /**
   * Format file size
   */
  private static formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format timestamp
   */
  private static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  /**
   * Escape HTML for safe embedding in HTML context
   */
  private static escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Sanitize HTML to prevent XSS attacks
   * Removes dangerous tags and attributes from rendered markdown
   */
  private static sanitizeHTML(html: string): string {
    // Remove dangerous tags entirely
    const dangerousTags = [
      'script', 'iframe', 'object', 'embed', 'link', 'style',
      'form', 'input', 'button', 'textarea', 'select',
      'base', 'meta', 'title'
    ];

    let sanitized = html;

    // Remove dangerous tags and their content
    for (const tag of dangerousTags) {
      // Case-insensitive removal of opening and closing tags
      const tagRegex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis');
      sanitized = sanitized.replace(tagRegex, '');
      // Also remove self-closing variants
      const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
      // Remove opening tags without closing tags
      const openingRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
      sanitized = sanitized.replace(openingRegex, '');
    }

    // Remove dangerous event handler attributes
    const eventHandlers = [
      'onload', 'onerror', 'onclick', 'ondblclick', 'onmousedown', 'onmouseup',
      'onmouseover', 'onmousemove', 'onmouseout', 'onmouseenter', 'onmouseleave',
      'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onkeypress',
      'onsubmit', 'onchange', 'oninput', 'onreset', 'onselect',
      'onabort', 'oncanplay', 'oncanplaythrough', 'ondurationchange',
      'onemptied', 'onended', 'onloadeddata', 'onloadedmetadata',
      'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress',
      'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend',
      'ontimeupdate', 'onvolumechange', 'onwaiting',
      'onanimationstart', 'onanimationend', 'onanimationiteration',
      'ontransitionend', 'ontoggle', 'onwheel', 'oncopy', 'oncut', 'onpaste'
    ];

    for (const handler of eventHandlers) {
      // Remove event handlers with various quote styles and spacing
      const handlerRegex = new RegExp(`\\s+${handler}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(handlerRegex, '');
      const handlerRegexNoQuotes = new RegExp(`\\s+${handler}\\s*=\\s*[^\\s>]+`, 'gi');
      sanitized = sanitized.replace(handlerRegexNoQuotes, '');
    }

    // Remove javascript: URLs from href and src attributes
    sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');

    // Remove data: URLs from src attributes (can be used for XSS)
    sanitized = sanitized.replace(/src\s*=\s*["']data:text\/html[^"']*["']/gi, 'src=""');

    return sanitized;
  }

  /**
   * Render markdown content to HTML
   */
  private static async renderMarkdownToHTML(content: string): Promise<string> {
    try {
      // Use Marked's built-in parser to convert markdown to HTML strings
      const html = await Marked.Marked.parse(content);
      return html;
    } catch (error) {
      logger.error('Failed to render markdown:', error);
      // Fallback to escaped plain text
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  /**
   * Build HTML structure
   */
  private static async buildHTML(file: FileSummary, content: string): Promise<string> {
    const fileType = FileContentViewer.detectFileType(file.fileName);
    const icon = FileContentViewer.getFileIcon(fileType);
    const typeLabel = FileContentViewer.getFileTypeLabel(fileType);
    const formattedContent = FileContentViewer.formatContent(content, fileType);
    const size = FileContentViewer.formatSize(file.size);
    const created = FileContentViewer.formatTimestamp(file.createdAt);

    // Render markdown as formatted HTML or escape for code display
    let contentHTML: string;
    if (fileType === 'markdown') {
      // Render markdown to HTML and sanitize to prevent XSS
      const renderedHTML = await FileContentViewer.renderMarkdownToHTML(formattedContent);
      const sanitizedHTML = FileContentViewer.sanitizeHTML(renderedHTML);
      // For markdown: hidden div with original source + visible rendered HTML
      contentHTML = `
        <div id="file-content" style="display: none;">${FileContentViewer.escapeHTML(formattedContent)}</div>
        <div class="markdown-content">${sanitizedHTML}</div>
      `;
    } else {
      // For code files: use escapeHTML helper and add id
      const safeContent = FileContentViewer.escapeHTML(formattedContent);
      contentHTML = `<pre class="file-content" id="file-content" data-file-type="${fileType}"><code>${safeContent}</code></pre>`;
    }

    return `
<div class="file-viewer" data-file-type="${fileType}">
  <!-- Header -->
  <header class="viewer-header">
    <div class="file-info">
      <span class="file-icon">${icon}</span>
      <div class="file-details">
        <h1 class="file-name">${file.fileName}</h1>
        <div class="file-meta">
          <span class="meta-item">${typeLabel}</span>
          <span class="meta-separator">•</span>
          <span class="meta-item">${size}</span>
          <span class="meta-separator">•</span>
          <span class="meta-item">Created ${created}</span>
        </div>
      </div>
    </div>
    <div class="header-actions">
      <button class="action-btn copy-btn" onclick="copyContent(event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span class="btn-text">Copy</span>
      </button>
      <button class="action-btn download-btn" onclick="downloadFile(event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span class="btn-text">Download</span>
      </button>
    </div>
  </header>

  <!-- Content -->
  <main class="content-container" id="content-main">
    ${contentHTML}
  </main>
</div>
    `;
  }

  /**
   * Build CSS styles
   */
  private static buildCSS(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        overflow: hidden;
        background: #f5f7fa;
      }

      .file-viewer {
        width: 100vw;
        height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
        background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      }

      /* Header - Glassmorphic */
      .viewer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 32px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 249, 250, 0.95) 100%);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        position: relative;
        z-index: 10;
      }

      .file-info {
        display: flex;
        align-items: center;
        gap: 16px;
        flex: 1;
        min-width: 0;
      }

      .file-icon {
        font-size: 32px;
        line-height: 1;
      }

      .file-details {
        flex: 1;
        min-width: 0;
      }

      .file-name {
        font-size: 18px;
        font-weight: 600;
        color: #202124;
        margin-bottom: 4px;
        word-break: break-word;
      }

      .file-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #5f6368;
        flex-wrap: wrap;
      }

      .meta-separator {
        opacity: 0.5;
      }

      .header-actions {
        display: flex;
        gap: 8px;
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: #202124;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }

      .action-btn svg {
        width: 16px;
        height: 16px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .action-btn:hover {
        background: rgba(255, 255, 255, 1);
        border-color: #1976d2;
        color: #1976d2;
        box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
        transform: translateY(-1px);
      }

      .action-btn:hover svg {
        transform: scale(1.1);
      }

      .action-btn:active {
        transform: translateY(0);
      }

      .copy-btn.copied {
        background: #4caf50;
        border-color: #4caf50;
        color: white;
        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
      }

      .download-btn {
        background: linear-gradient(135deg, #1976d2, #1565c0);
        border-color: transparent;
        color: white;
        box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
      }

      .download-btn:hover {
        background: linear-gradient(135deg, #1565c0, #0d47a1);
        box-shadow: 0 6px 16px rgba(25, 118, 210, 0.4);
      }

      /* Content */
      .content-container {
        overflow: auto;
        background: transparent;
        position: relative;
        scroll-behavior: smooth;
      }

      /* Code file styling */
      .file-content {
        padding: 32px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.6;
        color: #202124;
        white-space: pre-wrap;
        word-wrap: break-word;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
        border: none;
        margin: 24px;
        border-radius: 16px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
      }

      .file-content code {
        font-family: inherit;
        font-size: inherit;
        background: none;
        padding: 0;
      }

      /* Markdown document styling */
      .markdown-content {
        max-width: 900px;
        margin: 0 auto;
        padding: 48px 64px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        min-height: calc(100vh - 80px);
        border-radius: 20px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        margin: 24px auto;
        line-height: 1.7;
        font-size: 15px;
        color: #202124;
      }

      .markdown-content h1, .markdown-content h2, .markdown-content h3,
      .markdown-content h4, .markdown-content h5, .markdown-content h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.3;
        color: #1a1a1a;
      }

      .markdown-content h1 {
        font-size: 32px;
        border-bottom: 2px solid rgba(25, 118, 210, 0.2);
        padding-bottom: 12px;
        margin-top: 0;
      }

      .markdown-content h2 {
        font-size: 26px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        padding-bottom: 8px;
      }

      .markdown-content h3 {
        font-size: 22px;
      }

      .markdown-content p {
        margin: 16px 0;
        line-height: 1.7;
      }

      .markdown-content ul, .markdown-content ol {
        margin: 16px 0;
        padding-left: 28px;
      }

      .markdown-content li {
        margin: 8px 0;
        line-height: 1.6;
      }

      .markdown-content code {
        background: rgba(25, 118, 210, 0.08);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        color: #1976d2;
      }

      .markdown-content pre {
        background: rgba(0, 0, 0, 0.04);
        padding: 16px;
        border-radius: 12px;
        overflow-x: auto;
        margin: 16px 0;
        border: 1px solid rgba(0, 0, 0, 0.08);
      }

      .markdown-content pre code {
        background: none;
        padding: 0;
        color: #202124;
        font-size: 13px;
      }

      .markdown-content blockquote {
        border-left: 4px solid #1976d2;
        margin: 16px 0;
        padding: 12px 20px;
        background: rgba(25, 118, 210, 0.04);
        border-radius: 0 8px 8px 0;
        color: #5f6368;
        font-style: italic;
      }

      .markdown-content a {
        color: #1976d2;
        text-decoration: none;
        border-bottom: 1px solid rgba(25, 118, 210, 0.3);
        transition: all 0.2s ease;
      }

      .markdown-content a:hover {
        border-bottom-color: #1976d2;
        color: #1565c0;
      }

      .markdown-content hr {
        border: none;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        margin: 32px 0;
      }

      .markdown-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      }

      .markdown-content th, .markdown-content td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .markdown-content th {
        background: rgba(25, 118, 210, 0.08);
        font-weight: 600;
        color: #1976d2;
      }

      .markdown-content tr:hover {
        background: rgba(0, 0, 0, 0.02);
      }

      /* Scrollbar - Modern thin style */
      .content-container::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .content-container::-webkit-scrollbar-track {
        background: transparent;
      }

      .content-container::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
      }

      .content-container::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.3);
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        body {
          background: #1a1d23;
        }

        .file-viewer {
          background: linear-gradient(135deg, #1a1d23 0%, #252931 100%);
        }

        .viewer-header {
          background: linear-gradient(135deg, rgba(41, 42, 45, 0.98) 0%, rgba(32, 33, 36, 0.95) 100%);
          border-bottom-color: rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .file-name {
          color: #e8eaed;
        }

        .file-meta {
          color: #9aa0a6;
        }

        .action-btn {
          background: rgba(60, 64, 67, 0.9);
          border-color: rgba(255, 255, 255, 0.08);
          color: #e8eaed;
        }

        .action-btn:hover {
          background: rgba(80, 84, 87, 1);
          border-color: #1976d2;
          box-shadow: 0 4px 12px rgba(25, 118, 210, 0.3);
        }

        .download-btn {
          background: linear-gradient(135deg, #1976d2, #1565c0);
        }

        .download-btn:hover {
          background: linear-gradient(135deg, #1565c0, #0d47a1);
        }

        .content-container {
          background: transparent;
        }

        .file-content {
          color: #e8eaed;
          background: rgba(41, 42, 45, 0.7);
        }

        .file-content code {
          color: #e8eaed;
        }

        .markdown-content {
          background: rgba(41, 42, 45, 0.95);
          color: #e8eaed;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
        }

        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4,
        .markdown-content h5,
        .markdown-content h6 {
          color: #f1f3f4;
        }

        .markdown-content h1 {
          border-bottom-color: rgba(25, 118, 210, 0.3);
        }

        .markdown-content h2 {
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }

        .markdown-content code {
          background: rgba(25, 118, 210, 0.15);
          color: #64b5f6;
        }

        .markdown-content pre {
          background: rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .markdown-content pre code {
          color: #e8eaed;
        }

        .markdown-content blockquote {
          background: rgba(25, 118, 210, 0.1);
          color: #9aa0a6;
          border-left-color: #1976d2;
        }

        .markdown-content a {
          color: #64b5f6;
          border-bottom-color: rgba(100, 181, 246, 0.3);
        }

        .markdown-content a:hover {
          color: #90caf9;
          border-bottom-color: #64b5f6;
        }

        .markdown-content hr {
          border-top-color: rgba(255, 255, 255, 0.1);
        }

        .markdown-content table {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }

        .markdown-content th {
          background: rgba(25, 118, 210, 0.15);
          color: #64b5f6;
        }

        .markdown-content td {
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }

        .markdown-content tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .content-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }

        .content-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    `;
  }

  /**
   * Build JavaScript functionality
   */
  private static buildJS(fileName: string, content: string): string {
    return `
      const FILE_NAME = ${JSON.stringify(fileName)};

      // Attach functions to window for global access (RenderWebAppTool wraps JS in IIFE)
      window.copyContent = async function(event) {
        event.preventDefault();
        const btn = event.currentTarget;
        const textSpan = btn.querySelector('.btn-text');
        const originalText = textSpan.textContent;

        try {
          const content = document.getElementById('file-content').textContent;

          // Try modern Clipboard API first
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(content);
          } else {
            // Fallback to execCommand for iframe/non-secure contexts
            const textarea = document.createElement('textarea');
            textarea.value = content;
            textarea.style.position = 'fixed';
            textarea.style.left = '-999999px';
            textarea.style.top = '-999999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (!successful) {
              throw new Error('execCommand copy failed');
            }
          }

          // Show success feedback
          btn.classList.add('copied');
          textSpan.textContent = 'Copied!';

          setTimeout(() => {
            btn.classList.remove('copied');
            textSpan.textContent = originalText;
          }, 2000);
        } catch (error) {
          console.error('Failed to copy:', error);
          textSpan.textContent = 'Failed';
          setTimeout(() => {
            textSpan.textContent = originalText;
          }, 2000);
        }
      };

      window.downloadFile = function(event) {
        event.preventDefault();
        try {
          const content = document.getElementById('file-content').textContent;
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = FILE_NAME;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Failed to download:', error);
          alert('Failed to download file');
        }
      };

      // Prevent default drag and drop
      document.addEventListener('dragover', (e) => e.preventDefault());
      document.addEventListener('drop', (e) => e.preventDefault());
    `;
  }
}
