// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Generate preview HTML for sandbox apps
 *
 * Creates an HTML document with:
 * - React 18 via import map
 * - Zustand for state management
 * - Tailwind Play CDN for styling
 * - Pluggable transport layer (CDP binding or WebSocket)
 * - In-iframe esbuild-wasm bundler (preloaded eagerly)
 * - Hot reload support
 *
 * Transport modes:
 * - 'cdp': Uses CDP binding (DevTools context)
 * - 'websocket': Uses WebSocket (standalone testing)
 * - 'auto': Auto-detect based on available binding
 *
 * For standalone testing with pre-bundled SPAs, use bundledScript option.
 */
export function createPreviewHtml(options: {
  reactVersion?: string;
  appId?: string;
  transport?: 'cdp' | 'websocket' | 'auto';
  wsPort?: number;
  bundledScript?: string;  // URL to pre-bundled SPA script (for standalone testing)
} = {}): string {
  const v = options.reactVersion ?? '18.2.0';
  const appId = options.appId ?? 'unknown';
  const bindingName = `__sandboxAppBridge_${appId}`;
  const transport = options.transport ?? 'auto';
  const wsPort = options.wsPort ?? 3457;
  const bundledScript = options.bundledScript ?? '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>

    <!-- Tailwind Play CDN -->
    <script>
      tailwind = {
        config: {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                  DEFAULT: 'hsl(var(--primary))',
                  foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                  DEFAULT: 'hsl(var(--secondary))',
                  foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                  DEFAULT: 'hsl(var(--muted))',
                  foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                  DEFAULT: 'hsl(var(--accent))',
                  foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                  DEFAULT: 'hsl(var(--destructive))',
                  foreground: 'hsl(var(--destructive-foreground))'
                },
                card: {
                  DEFAULT: 'hsl(var(--card))',
                  foreground: 'hsl(var(--card-foreground))'
                },
              },
              borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
              },
            }
          }
        }
      };
    </script>
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Import map for React + Zustand -->
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@${v}",
          "react-dom": "https://esm.sh/react-dom@${v}",
          "react-dom/client": "https://esm.sh/react-dom@${v}/client",
          "react/jsx-runtime": "https://esm.sh/react@${v}/jsx-runtime",
          "zustand": "https://esm.sh/zustand@4.4.7?external=react",
          "zustand/middleware": "https://esm.sh/zustand@4.4.7/middleware?external=react"
        }
      }
    </script>

    <!-- CSS injection point -->
    <style id="__sandbox_css__"></style>

    <!-- Default dark theme variables -->
    <style>
      :root {
        --background: 224 71% 4%;
        --foreground: 213 31% 91%;
        --card: 224 71% 4%;
        --card-foreground: 213 31% 91%;
        --popover: 224 71% 4%;
        --popover-foreground: 213 31% 91%;
        --primary: 217 91% 60%;
        --primary-foreground: 222 47% 11%;
        --secondary: 215 28% 17%;
        --secondary-foreground: 210 40% 98%;
        --muted: 215 28% 17%;
        --muted-foreground: 217 19% 65%;
        --accent: 215 28% 17%;
        --accent-foreground: 210 40% 98%;
        --destructive: 0 63% 31%;
        --destructive-foreground: 210 40% 98%;
        --border: 215 28% 17%;
        --input: 215 28% 17%;
        --ring: 217 91% 60%;
        --radius: 0.5rem;
      }

      * {
        box-sizing: border-box;
        border-color: hsl(var(--border));
      }

      body {
        margin: 0;
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        font-family: system-ui, -apple-system, sans-serif;
        min-height: 100vh;
      }

      /* WebSocket connection status indicator */
      #ws-status {
        position: fixed;
        top: 8px;
        right: 8px;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999;
        transition: all 0.3s ease;
        display: none;
      }
      #ws-status.connected { background: #dcfce7; color: #166534; display: block; }
      #ws-status.disconnected { background: #fee2e2; color: #991b1b; display: block; }
      #ws-status.connecting { background: #fef3c7; color: #92400e; display: block; }
    </style>
  </head>
  <body>
    <!-- WebSocket status indicator (only shown in WebSocket mode) -->
    <div id="ws-status"></div>

    <div id="root"></div>

    <script type="module">
      // =======================================================================
      // Configuration
      // =======================================================================
      const BINDING_NAME = '${bindingName}';
      const TRANSPORT_MODE = '${transport}';
      const WS_PORT = ${wsPort};

      // =======================================================================
      // Transport Layer Abstraction
      // =======================================================================

      /**
       * CDP Transport - Uses Chrome DevTools Protocol binding
       */
      class CDPTransport {
        constructor(bindingName) {
          this.bindingName = bindingName;
          this.messageHandler = null;
        }

        send(payload) {
          if (typeof window[this.bindingName] === 'function') {
            window[this.bindingName](JSON.stringify(payload));
          } else {
            // Fallback to postMessage for parent frame
            parent.postMessage({ __sandbox: true, message: payload }, '*');
          }
        }

        onMessage(handler) {
          this.messageHandler = handler;
        }

        async connect() {
          // CDP binding is already set up by DevTools
          // Just set up postMessage listener as fallback
          window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || data.__sandbox !== true || !data.message) {
              return;
            }
            if (this.messageHandler) {
              this.messageHandler(data.message);
            }
          });

          // Expose receive function for Runtime.evaluate
          window.__sandbox_receiveMessage = (msg) => {
            if (this.messageHandler) {
              this.messageHandler(msg);
            }
          };

          console.log('[Transport] CDP transport ready');
        }

        isAvailable() {
          return typeof window[this.bindingName] === 'function';
        }
      }

      /**
       * WebSocket Transport - For standalone testing
       */
      class WebSocketTransport {
        constructor(port) {
          this.port = port;
          this.ws = null;
          this.messageHandler = null;
          this.messageQueue = [];
          this.reconnectAttempts = 0;
          this.maxReconnectAttempts = 10;
          this.reconnectDelay = 1000;
        }

        send(payload) {
          // Send the payload directly - callers are responsible for message format
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
          } else {
            this.messageQueue.push(payload);
          }
        }

        onMessage(handler) {
          this.messageHandler = handler;
        }

        updateStatus(status) {
          const el = document.getElementById('ws-status');
          if (el) {
            el.className = status;
            el.textContent = status === 'connected' ? 'Connected' :
                             status === 'disconnected' ? 'Disconnected' :
                             'Connecting...';
          }
        }

        async connect() {
          return new Promise((resolve, reject) => {
            this.updateStatus('connecting');
            const wsUrl = \`ws://localhost:\${this.port}\`;
            console.log('[Transport] Connecting to WebSocket:', wsUrl);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
              console.log('[Transport] WebSocket connected');
              this.updateStatus('connected');
              this.reconnectAttempts = 0;

              // Send init message
              this.ws.send(JSON.stringify({ type: 'init' }));

              // Flush queued messages
              while (this.messageQueue.length > 0) {
                const msg = this.messageQueue.shift();
                this.ws.send(JSON.stringify(msg));
              }

              resolve();
            };

            this.ws.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                console.log('[Transport] WS received:', msg.type);

                // Route all messages to handler
                if (this.messageHandler) {
                  this.messageHandler(msg);
                }
              } catch (err) {
                console.error('[Transport] Failed to parse message:', err);
              }
            };

            this.ws.onclose = (event) => {
              console.log('[Transport] WebSocket disconnected:', event.code, event.reason);
              this.updateStatus('disconnected');

              // Attempt to reconnect
              if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(\`[Transport] Reconnecting (attempt \${this.reconnectAttempts}/\${this.maxReconnectAttempts})...\`);
                setTimeout(() => this.connect(), this.reconnectDelay);
              } else {
                console.error('[Transport] Max reconnection attempts reached');
              }
            };

            this.ws.onerror = (err) => {
              console.error('[Transport] WebSocket error:', err);
              reject(err);
            };
          });
        }

        isAvailable() {
          return true; // WebSocket is always available
        }
      }

      // =======================================================================
      // Transport Initialization
      // =======================================================================
      let transport;

      function initTransport() {
        const cdpTransport = new CDPTransport(BINDING_NAME);

        if (TRANSPORT_MODE === 'cdp') {
          transport = cdpTransport;
        } else if (TRANSPORT_MODE === 'websocket') {
          transport = new WebSocketTransport(WS_PORT);
        } else {
          // Auto-detect: prefer CDP if binding is available
          if (cdpTransport.isAvailable()) {
            transport = cdpTransport;
            console.log('[Transport] Auto-detected CDP transport');
          } else {
            transport = new WebSocketTransport(WS_PORT);
            console.log('[Transport] Auto-detected WebSocket transport');
          }
        }

        return transport;
      }

      // Initialize transport
      transport = initTransport();

      // Unified send function
      const send = (payload) => transport.send(payload);

      // =======================================================================
      // App State & Error Handling
      // =======================================================================
      let appState = {};

      window.addEventListener('error', (e) => {
        send({
          type: 'error',
          payload: {
            message: e.message || String(e.error || e),
            stack: e.error?.stack
          }
        });
      });

      window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason;
        send({
          type: 'error',
          payload: {
            message: reason?.message || String(reason),
            stack: reason?.stack
          }
        });
      });

      // =======================================================================
      // In-Iframe Bundler (esbuild-wasm)
      // =======================================================================
      const WASM_URL = 'https://unpkg.com/esbuild-wasm@0.19.12/esbuild.wasm';
      const VFS_NS = 'vfs';
      const ENTRY_ID = '__sandbox_entry__';

      const ESM_SH_DEFAULT_QUERY = 'target=es2022';

      function toEsmShUrl(spec) {
        const hasQuery = spec.includes('?');
        return \`https://esm.sh/\${spec}\${hasQuery ? '&' : '?'}\${ESM_SH_DEFAULT_QUERY}\`;
      }

      let vfsFiles = {};
      let vfsEntry = '/src/index.tsx';
      let esbuild = null;
      let esbuildReady = false;

      function isBareSpecifier(path) {
        return (
          path &&
          !path.startsWith('/') &&
          !path.startsWith('./') &&
          !path.startsWith('../') &&
          !path.startsWith('http://') &&
          !path.startsWith('https://') &&
          !path.startsWith('data:')
        );
      }

      function dirname(path) {
        const idx = path.lastIndexOf('/');
        if (idx <= 0) return '/';
        return path.slice(0, idx);
      }

      function normalizePath(path) {
        const parts = [];
        for (const part of path.split('/')) {
          if (!part || part === '.') continue;
          if (part === '..') parts.pop();
          else parts.push(part);
        }
        return '/' + parts.join('/');
      }

      function resolveRelativePath(resolveDir, spec) {
        if (spec.startsWith('/')) return normalizePath(spec);
        return normalizePath((resolveDir.endsWith('/') ? resolveDir : resolveDir + '/') + spec);
      }

      function resolveWithExtensions(path, files) {
        if (Object.prototype.hasOwnProperty.call(files, path)) return path;
        const exts = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];
        for (const ext of exts) {
          if (Object.prototype.hasOwnProperty.call(files, path + ext)) return path + ext;
        }
        for (const ext of exts) {
          const idx = path.lastIndexOf('/');
          const dir = idx >= 0 ? path.slice(0, idx + 1) : '/';
          const base = idx >= 0 ? path.slice(idx + 1) : path;
          const candidate = dir + base + '/index' + ext;
          if (Object.prototype.hasOwnProperty.call(files, candidate)) return candidate;
        }
        return null;
      }

      function loaderForPath(path) {
        if (path.endsWith('.tsx')) return 'tsx';
        if (path.endsWith('.ts')) return 'ts';
        if (path.endsWith('.jsx')) return 'jsx';
        if (path.endsWith('.js')) return 'js';
        if (path.endsWith('.css')) return 'css';
        if (path.endsWith('.json')) return 'json';
        return 'text';
      }

      function formatLocation(loc) {
        if (!loc) return '';
        return \`\${loc.file ?? '<unknown>'}:\${loc.line ?? 0}:\${loc.column ?? 0}\`;
      }

      function formatMessages(msgs) {
        if (!Array.isArray(msgs)) return [];
        return msgs.map(m => {
          const where = formatLocation(m.location);
          return where ? \`\${where} \${m.text}\` : m.text;
        });
      }

      function vfsPlugin({ files, entry }) {
        return {
          name: 'vfs',
          setup(build) {
            build.onResolve({ filter: /.*/ }, args => {
              if (args.path === ENTRY_ID) {
                return { path: ENTRY_ID, namespace: VFS_NS };
              }
              if (args.path.startsWith('@/')) {
                const aliased = '/src/' + args.path.slice(2);
                const finalPath = resolveWithExtensions(aliased, files);
                if (!finalPath) {
                  return { errors: [{ text: \`File not found: \${args.path} (from \${args.importer || entry || 'entry'})\` }] };
                }
                return { path: finalPath, namespace: VFS_NS };
              }
              if (args.path.startsWith('http://') || args.path.startsWith('https://') || args.path.startsWith('data:')) {
                return { path: args.path, external: true };
              }
              if (isBareSpecifier(args.path)) {
                return { path: toEsmShUrl(args.path), external: true };
              }
              const resolveDir = args.resolveDir || dirname(args.importer || entry || '/');
              const resolved = resolveRelativePath(resolveDir, args.path);
              const finalPath = resolveWithExtensions(resolved, files);
              if (!finalPath) {
                return { errors: [{ text: \`File not found: \${args.path} (from \${args.importer || entry || 'entry'})\` }] };
              }
              return { path: finalPath, namespace: VFS_NS };
            });

            build.onLoad({ filter: /.*/, namespace: VFS_NS }, args => {
              if (args.path === ENTRY_ID) {
                if (!Object.prototype.hasOwnProperty.call(files, entry)) {
                  return { errors: [{ text: \`Missing entry file: \${entry}\` }] };
                }
                return { contents: \`import "\${entry}";\`, loader: 'ts', resolveDir: '/' };
              }
              const contents = files[args.path];
              if (typeof contents !== 'string') {
                return { errors: [{ text: \`Missing file: \${args.path}\` }] };
              }
              return { contents, loader: loaderForPath(args.path), resolveDir: dirname(args.path) };
            });
          },
        };
      }

      async function initializeEsbuild() {
        try {
          console.log('[Sandbox] Loading esbuild-wasm...');
          const module = await import('https://unpkg.com/esbuild-wasm@0.19.12/esm/browser.min.js');
          esbuild = module;
          await esbuild.initialize({ wasmURL: WASM_URL, worker: false });
          esbuildReady = true;
          console.log('[Sandbox] esbuild-wasm initialized');
          send({ type: 'bundler-ready' });
        } catch (err) {
          console.error('[Sandbox] Failed to initialize esbuild:', err);
          send({
            type: 'error',
            payload: {
              message: 'Failed to initialize bundler: ' + (err?.message || String(err)),
              stack: err?.stack
            }
          });
        }
      }

      async function buildFromVFS(buildId) {
        console.log('[VFS] buildFromVFS called with id:', buildId);
        const startTime = Date.now();
        if (!esbuildReady) {
          console.log('[VFS] Build skipped - esbuild not ready');
          send({ type: 'build-error', payload: { buildId, error: 'Bundler not ready. Please wait for initialization.' } });
          return;
        }

        console.log('[VFS] Starting esbuild, entry:', vfsEntry, 'files:', Object.keys(vfsFiles).length);
        try {
          const result = await esbuild.build({
            entryPoints: [ENTRY_ID],
            bundle: true,
            write: false,
            outdir: '/out',
            entryNames: 'bundle',
            format: 'esm',
            platform: 'browser',
            target: ['es2020'],
            sourcemap: 'inline',
            jsx: 'automatic',
            jsxImportSource: 'react',
            logLevel: 'silent',
            plugins: [vfsPlugin({ files: vfsFiles, entry: vfsEntry })],
          });

          let js = '', css = '';
          for (const f of result.outputFiles ?? []) {
            if (f.path.endsWith('.js')) js = f.text;
            if (f.path.endsWith('.css')) css = f.text;
          }

          console.log('[VFS] Build complete, success:', result.errors.length === 0, 'js length:', js.length);
          send({
            type: 'build-result',
            payload: {
              buildId,
              success: result.errors.length === 0,
              js, css,
              warnings: formatMessages(result.warnings),
              errors: formatMessages(result.errors),
              durationMs: Date.now() - startTime,
            }
          });
        } catch (err) {
          console.error('[VFS] Build error:', err);
          send({ type: 'build-error', payload: { buildId, error: err?.message || String(err) } });
        }
      }

      // =======================================================================
      // Code Execution
      // =======================================================================
      let lastScriptEl = null;

      async function executeCode(js, css) {
        const styleEl = document.getElementById('__sandbox_css__');
        if (styleEl) styleEl.textContent = css || '';

        const root = document.getElementById('root');
        if (root) root.replaceWith(root.cloneNode(false));

        if (lastScriptEl) lastScriptEl.remove();

        try {
          const oldScript = document.getElementById('__sandbox_app__');
          if (oldScript) oldScript.remove();

          if (lastScriptEl?.dataset?.blobUrl) {
            URL.revokeObjectURL(lastScriptEl.dataset.blobUrl);
          }

          const blob = new Blob([js], { type: 'text/javascript' });
          const blobUrl = URL.createObjectURL(blob);

          let rendered = false;
          let errorOccurred = false;

          const rejectionHandler = (event) => {
            console.error('[Sandbox] Unhandled rejection:', event.reason);
            errorOccurred = true;
            window.removeEventListener('unhandledrejection', rejectionHandler);
            send({ type: 'error', payload: { message: event.reason?.message || String(event.reason), stack: event.reason?.stack || '' } });
          };
          window.addEventListener('unhandledrejection', rejectionHandler);

          const errorHandler = (event) => {
            console.error('[Sandbox] Script error:', event.message, event.filename);
            errorOccurred = true;
            window.removeEventListener('error', errorHandler);
            send({ type: 'error', payload: { message: event.message || 'Script execution error', stack: event.error?.stack || '', filename: event.filename, lineno: event.lineno } });
          };
          window.addEventListener('error', errorHandler);

          try {
            await import(blobUrl);
          } catch (importErr) {
            console.error('[Sandbox] Import failed:', importErr?.message);
            errorOccurred = true;
            send({ type: 'error', payload: { message: importErr?.message || 'Module import failed', stack: importErr?.stack || '' } });
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          const checkRoot = document.getElementById('root');
          rendered = checkRoot && checkRoot.children.length > 0;

          window.removeEventListener('error', errorHandler);
          window.removeEventListener('unhandledrejection', rejectionHandler);

          if (rendered) {
            console.log('[Sandbox] App rendered successfully');
            send({ type: 'ready' });
          } else if (!errorOccurred) {
            console.warn('[Sandbox] App did not render, no error detected');
          }

          lastScriptEl = { dataset: { blobUrl } };
        } catch (err) {
          console.error('[Sandbox] executeCode error:', err);
          send({ type: 'error', payload: { message: err?.message || String(err), stack: err?.stack } });
        }
      }

      // =======================================================================
      // State Helpers
      // =======================================================================
      function setAtPath(obj, path, value) {
        const parts = path.split('/').filter(Boolean);
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) current[parts[i]] = {};
          current = current[parts[i]];
        }
        if (parts.length > 0) current[parts[parts.length - 1]] = value;
      }

      function getAtPath(obj, path) {
        const parts = path.split('/').filter(Boolean);
        let current = obj;
        for (const part of parts) {
          if (current == null || !(part in current)) return undefined;
          current = current[part];
        }
        return current;
      }

      // Expose state helpers globally for app code
      window.__sandbox = {
        getState: () => appState,
        setState: (newState) => {
          appState = newState;
          send({ type: 'state-snapshot', payload: { state: appState } });
        },
        updateState: (path, value) => {
          setAtPath(appState, path, value);
          send({ type: 'state-changed', payload: { path, value } });
        },
        getAtPath: (path) => getAtPath(appState, path),
        dispatchAction: (name, context = {}) => {
          send({ type: 'action', payload: { name, context } });
        },
        sendAction: (action) => {
          send({ type: 'action', payload: action });
        }
      };

      // =======================================================================
      // Message Handler
      // =======================================================================
      function handleMessage(msg) {
        switch (msg.type) {
          // Data Studio specific messages
          case 'state-update':
          case 'update-cell':
            // Forward to SPA's message handler
            if (window.__sandbox_onMessage) {
              window.__sandbox_onMessage(msg);
            }
            break;

          case 'init':
            appState = msg.payload?.state || {};
            if (window.__sandbox_onMessage) {
              window.__sandbox_onMessage(msg);
            }
            break;

          case 'data-update':
            setAtPath(appState, msg.payload.path, msg.payload.value);
            if (window.__sandbox_onDataUpdate) {
              window.__sandbox_onDataUpdate(msg.payload.path, msg.payload.value);
            }
            break;

          case 'execute':
            if (window.__sandbox_onExecute) {
              window.__sandbox_onExecute(msg.payload.action, msg.payload.args);
            }
            break;

          case 'hot-reload':
            executeCode(msg.payload.js, msg.payload.css);
            break;

          case 'get-state':
            send({ type: 'state-snapshot', payload: { state: appState } });
            break;

          case 'sync-files':
            if (msg.payload.incremental) {
              Object.assign(vfsFiles, msg.payload.files);
            } else {
              vfsFiles = msg.payload.files;
            }
            vfsEntry = msg.payload.entry;
            console.log('[VFS] Files synced:', Object.keys(vfsFiles).length, 'files, entry:', vfsEntry);
            break;

          case 'build-request':
            console.log('[VFS] Build requested, files:', Object.keys(vfsFiles).length, 'esbuildReady:', esbuildReady);
            buildFromVFS(msg.payload.buildId);
            break;

          case 'execute-code':
            executeCode(msg.payload.js, msg.payload.css);
            break;
        }
      }

      // Set up message handler for transport
      transport.onMessage(handleMessage);

      // Expose handlers for legacy compatibility
      window.__sandbox_receiveMessage = handleMessage;
      window.__sandbox_executeCode = executeCode;

      // =======================================================================
      // Initialize
      // =======================================================================
      async function init() {
        await transport.connect();
        initializeEsbuild();
      }

      init().catch(err => {
        console.error('[Sandbox] Initialization failed:', err);
      });
    </script>
    ${bundledScript ? `<!-- Pre-bundled SPA for standalone testing -->
    <script type="module" src="${bundledScript}"></script>` : ''}
  </body>
</html>`;
}
