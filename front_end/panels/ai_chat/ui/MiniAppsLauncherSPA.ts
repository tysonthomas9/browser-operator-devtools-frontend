// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Mini Apps Launcher SPA - Bundled HTML, CSS, and JS for the launcher web app
 *
 * This file exports the complete SPA as strings that can be injected via RenderWebAppTool.
 * The SPA communicates with DevTools via:
 * - SPA → DevTools: window.__miniAppsLauncherBridge(payload) (via Runtime.addBinding)
 * - DevTools → SPA: window.miniApp.dispatch(action) (via Runtime.evaluate)
 */

export const MiniAppsLauncherSPA = {
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
  <title>Apps</title>
</head>
<body>
  <div class="launcher">
    <!-- Header -->
    <header class="launcher-header">
      <div class="header-left">
        <div class="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <h1 class="launcher-title">Apps</h1>
      </div>
      <button class="close-btn" id="close-btn" title="Close">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </header>

    <!-- Main Content -->
    <main class="launcher-content">
      <div class="apps-grid" id="apps-grid">
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading apps...</p>
        </div>
      </div>
    </main>
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
      --border: rgba(0, 0, 0, 0.08);
      --border-hover: rgba(0, 164, 254, 0.4);
      --success: #34a853;
      --success-light: #e6f4ea;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-full: 9999px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
      --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08);
      --shadow-primary: 0 4px 14px var(--primary-shadow);
      --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      --transition-normal: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      --transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      overflow: hidden;
      background: var(--background);
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .launcher {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      background: var(--background);
    }

    /* Header */
    .launcher-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-light);
      border-radius: var(--radius-sm);
      color: var(--primary);
    }

    .header-icon svg {
      width: 20px;
      height: 20px;
    }

    .launcher-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
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
      width: 20px;
      height: 20px;
    }

    /* Content */
    .launcher-content {
      padding: 24px;
      overflow-y: auto;
    }

    .apps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Loading State */
    .loading-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 64px;
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      margin: 0 auto 16px;
      border: 3px solid var(--primary-light);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* App Card */
    .app-card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      padding: 24px;
      cursor: pointer;
      transition: all var(--transition-normal);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border);
      position: relative;
      overflow: hidden;
    }

    .app-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--primary);
      transform: scaleX(0);
      transition: transform var(--transition-normal);
    }

    .app-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-hover);
    }

    .app-card:hover::before {
      transform: scaleX(1);
    }

    .app-card:active {
      transform: translateY(0);
    }

    .app-icon-wrapper {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-light);
      border-radius: var(--radius-md);
      margin-bottom: 16px;
      color: var(--primary);
      transition: all var(--transition-normal);
    }

    .app-card:hover .app-icon-wrapper {
      background: var(--primary);
      color: white;
      box-shadow: var(--shadow-primary);
    }

    .app-icon-wrapper svg {
      width: 24px;
      height: 24px;
    }

    .app-icon-emoji {
      font-size: 24px;
      line-height: 1;
    }

    .app-content {
      flex: 1;
      width: 100%;
    }

    .app-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }

    .app-description {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .app-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
      width: 100%;
    }

    .app-badge {
      padding: 4px 10px;
      background: var(--success-light);
      color: var(--success);
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .app-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      background: currentColor;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .app-action {
      color: var(--text-tertiary);
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
    }

    .app-card:hover .app-action {
      color: var(--primary);
    }

    .app-action svg {
      width: 16px;
      height: 16px;
    }

    /* Empty State */
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 64px 32px;
    }

    .empty-state-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-variant);
      border-radius: var(--radius-lg);
      color: var(--text-tertiary);
    }

    .empty-state-icon svg {
      width: 36px;
      height: 36px;
    }

    .empty-state-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .empty-state-message {
      font-size: 14px;
      color: var(--text-secondary);
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
    // Lucide Icons as SVG strings
    const Icons = {
      grid: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
      barChart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
      table: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>',
      bot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
      sparkles: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
      workflow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a1 1 0 0 0 1 1h4"/><path d="M18 9v3a1 1 0 0 1-1 1h-4"/></svg>',
      arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
      package: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>'
    };

    // Map app IDs to icons
    const appIconMap = {
      'data_studio': Icons.table,
      'agent_studio': Icons.bot,
      'workflow_builder': Icons.workflow,
      'default': Icons.sparkles
    };

    // State
    let apps = [];

    // Initialize
    function init() {
      // Close button handler
      document.getElementById('close-btn').addEventListener('click', () => {
        sendToDevTools({ type: 'close' });
      });

      // App card click handler (event delegation)
      document.getElementById('apps-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.app-card');
        if (card) {
          const appId = card.dataset.appId;
          if (appId) {
            launchApp(appId);
          }
        }
      });

      // Signal ready
      sendToDevTools({ type: 'ready' });
    }

    // Get icon for app
    function getAppIcon(appId, fallbackEmoji) {
      const svgIcon = appIconMap[appId] || appIconMap['default'];
      if (svgIcon) {
        return svgIcon;
      }
      return null;
    }

    // Render app cards
    function renderApps() {
      const grid = document.getElementById('apps-grid');

      if (apps.length === 0) {
        grid.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">
              \${Icons.package}
            </div>
            <h2 class="empty-state-title">No Apps Available</h2>
            <p class="empty-state-message">Apps will appear here when they are registered.</p>
          </div>
        \`;
        return;
      }

      grid.innerHTML = apps.map(app => {
        const icon = getAppIcon(app.id, app.icon);
        const iconContent = icon
          ? icon
          : '<span class="app-icon-emoji">' + escapeHtml(app.icon) + '</span>';

        return \`
          <div class="app-card" data-app-id="\${escapeHtml(app.id)}">
            <div class="app-icon-wrapper">
              \${iconContent}
            </div>
            <div class="app-content">
              <div class="app-name">\${escapeHtml(app.name)}</div>
              <div class="app-description">\${escapeHtml(app.description)}</div>
            </div>
            <div class="app-footer">
              \${app.isRunning ? '<div class="app-badge">Running</div>' : '<span></span>'}
              <span class="app-action">
                Open \${Icons.arrowRight}
              </span>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Escape HTML
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // Launch an app
    function launchApp(appId) {
      sendToDevTools({ type: 'launch-app', appId: appId });
    }

    // Send message to DevTools
    function sendToDevTools(message) {
      if (typeof window.__miniAppsLauncherBridge === 'function') {
        window.__miniAppsLauncherBridge(JSON.stringify(message));
      } else {
        console.error('Bridge not available');
      }
    }

    // Receive messages from DevTools
    window.miniApp = {
      dispatch: function(message) {
        console.log('Received from DevTools:', message);

        switch (message.action) {
          case 'set-apps':
            apps = message.apps || [];
            renderApps();
            break;

          default:
            console.warn('Unknown action:', message.action);
        }
      }
    };

    // Initialize on load
    document.addEventListener('DOMContentLoaded', init);
    // Also init immediately in case DOM is already ready
    if (document.readyState !== 'loading') {
      init();
    }
  `.trim();
}
