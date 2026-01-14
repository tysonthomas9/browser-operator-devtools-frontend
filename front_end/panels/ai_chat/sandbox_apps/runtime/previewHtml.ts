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
 * - Message bridge for DevTools communication (via CDP binding)
 * - In-iframe esbuild-wasm bundler (preloaded eagerly)
 * - Hot reload support
 */
export function createPreviewHtml(options: {
  reactVersion?: string;
  appId?: string;
} = {}): string {
  const v = options.reactVersion ?? '18.2.0';
  const appId = options.appId ?? 'unknown';
  const bindingName = `__sandboxAppBridge_${appId}`;

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
    </style>
  </head>
  <body>
    <div id="root"></div>

    <script type="module">
      // =======================================================================
      // Message Bridge & State Management
      // =======================================================================
      const BINDING_NAME = '${bindingName}';

      // Message bridge - uses CDP binding when available, falls back to postMessage
      const send = (payload) => {
        if (typeof window[BINDING_NAME] === 'function') {
          // CDP binding installed by DevTools
          window[BINDING_NAME](JSON.stringify(payload));
        } else {
          // Fallback for testing/development
          parent.postMessage({ __sandbox: true, message: payload }, '*');
        }
      };

      // App state (for data binding)
      let appState = {};

      // Global error handlers
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

      // esm.sh query params: target ES2022
      // Note: We removed "external=react,..." because esm.sh responses with externals
      // contain bare specifiers that can't be resolved when executed from blob URLs.
      const ESM_SH_DEFAULT_QUERY = 'target=es2022';

      function toEsmShUrl(spec) {
        // react/jsx-runtime is a valid subpath export of react on esm.sh
        // No special mapping needed for react, react-dom, react/jsx-runtime
        const hasQuery = spec.includes('?');
        return \`https://esm.sh/\${spec}\${hasQuery ? '&' : '?'}\${ESM_SH_DEFAULT_QUERY}\`;
      }

      // VFS state - synced from DevTools
      let vfsFiles = {};
      let vfsEntry = '/src/index.tsx';

      // esbuild instance
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
        if (idx <= 0) {
          return '/';
        }
        return path.slice(0, idx);
      }

      function normalizePath(path) {
        const parts = [];
        for (const part of path.split('/')) {
          if (!part || part === '.') {
            continue;
          }
          if (part === '..') {
            parts.pop();
          } else {
            parts.push(part);
          }
        }
        return '/' + parts.join('/');
      }

      function resolveRelativePath(resolveDir, spec) {
        if (spec.startsWith('/')) {
          return normalizePath(spec);
        }
        return normalizePath((resolveDir.endsWith('/') ? resolveDir : resolveDir + '/') + spec);
      }

      function resolveWithExtensions(path, files) {
        if (Object.prototype.hasOwnProperty.call(files, path)) {
          return path;
        }
        const exts = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];
        for (const ext of exts) {
          if (Object.prototype.hasOwnProperty.call(files, path + ext)) {
            return path + ext;
          }
        }
        // Try index files
        for (const ext of exts) {
          const idx = path.lastIndexOf('/');
          const dir = idx >= 0 ? path.slice(0, idx + 1) : '/';
          const base = idx >= 0 ? path.slice(idx + 1) : path;
          const candidate = dir + base + '/index' + ext;
          if (Object.prototype.hasOwnProperty.call(files, candidate)) {
            return candidate;
          }
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
        const file = loc.file ?? '<unknown>';
        const line = loc.line ?? 0;
        const col = loc.column ?? 0;
        return \`\${file}:\${line}:\${col}\`;
      }

      function formatMessages(msgs) {
        if (!Array.isArray(msgs)) return [];
        return msgs.map(m => {
          const where = formatLocation(m.location);
          if (where) return \`\${where} \${m.text}\`;
          return m.text;
        });
      }

      /**
       * VFS Plugin for esbuild
       */
      function vfsPlugin({ files, entry }) {
        return {
          name: 'vfs',
          setup(build) {
            build.onResolve({ filter: /.*/ }, args => {
              // Entry point alias
              if (args.path === ENTRY_ID) {
                return { path: ENTRY_ID, namespace: VFS_NS };
              }

              // Path alias: @/ → /src/
              if (args.path.startsWith('@/')) {
                const aliased = '/src/' + args.path.slice(2);
                const finalPath = resolveWithExtensions(aliased, files);
                if (!finalPath) {
                  return {
                    errors: [{ text: \`File not found: \${args.path} (from \${args.importer || entry || 'entry'})\` }],
                  };
                }
                return { path: finalPath, namespace: VFS_NS };
              }

              // External URLs
              if (
                args.path.startsWith('http://') ||
                args.path.startsWith('https://') ||
                args.path.startsWith('data:')
              ) {
                return { path: args.path, external: true };
              }

              // Bare specifiers
              if (isBareSpecifier(args.path)) {
                // All bare specifiers (including React) resolve to esm.sh URLs.
                // This is required because bundled code executes via blob URLs,
                // and import maps don't apply to blob URL module contexts.
                return { path: toEsmShUrl(args.path), external: true };
              }

              // Relative imports
              const resolveDir = args.resolveDir || dirname(args.importer || entry || '/');
              const resolved = resolveRelativePath(resolveDir, args.path);
              const finalPath = resolveWithExtensions(resolved, files);
              if (!finalPath) {
                return {
                  errors: [{ text: \`File not found: \${args.path} (from \${args.importer || entry || 'entry'})\` }],
                };
              }
              return { path: finalPath, namespace: VFS_NS };
            });

            build.onLoad({ filter: /.*/, namespace: VFS_NS }, args => {
              // Entry point wrapper
              if (args.path === ENTRY_ID) {
                if (!Object.prototype.hasOwnProperty.call(files, entry)) {
                  return { errors: [{ text: \`Missing entry file: \${entry}\` }] };
                }
                const contents = \`import "\${entry}";\`;
                return {
                  contents,
                  loader: 'ts',
                  resolveDir: '/',
                };
              }

              // Load from VFS
              const contents = files[args.path];
              if (typeof contents !== 'string') {
                return { errors: [{ text: \`Missing file: \${args.path}\` }] };
              }

              return {
                contents,
                loader: loaderForPath(args.path),
                resolveDir: dirname(args.path),
              };
            });
          },
        };
      }

      /**
       * Initialize esbuild-wasm (eager preload)
       */
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

      /**
       * Build from VFS
       */
      async function buildFromVFS(buildId) {
        const startTime = Date.now();

        if (!esbuildReady) {
          send({
            type: 'build-error',
            payload: {
              buildId,
              error: 'Bundler not ready. Please wait for initialization.'
            }
          });
          return;
        }

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
            // Use automatic JSX transform with React
            jsx: 'automatic',
            jsxImportSource: 'react',
            logLevel: 'silent',
            plugins: [vfsPlugin({ files: vfsFiles, entry: vfsEntry })],
          });

          let js = '';
          let css = '';
          for (const f of result.outputFiles ?? []) {
            if (f.path.endsWith('.js')) js = f.text;
            if (f.path.endsWith('.css')) css = f.text;
          }

          send({
            type: 'build-result',
            payload: {
              buildId,
              success: result.errors.length === 0,
              js,
              css,
              warnings: formatMessages(result.warnings),
              errors: formatMessages(result.errors),
              durationMs: Date.now() - startTime,
            }
          });
        } catch (err) {
          send({
            type: 'build-error',
            payload: {
              buildId,
              error: err?.message || String(err)
            }
          });
        }
      }

      // =======================================================================
      // Code Execution
      // =======================================================================
      let lastScriptEl = null;

      async function executeCode(js, css) {
        // Inject CSS
        const styleEl = document.getElementById('__sandbox_css__');
        if (styleEl) {
          styleEl.textContent = css || '';
        }

        // Clear previous render
        const root = document.getElementById('root');
        if (root) {
          root.replaceWith(root.cloneNode(false));
        }

        // Remove previous script
        if (lastScriptEl) {
          lastScriptEl.remove();
        }

        // Execute via blob URL with proper error handling
        try {
          // Remove previous script
          const oldScript = document.getElementById('__sandbox_app__');
          if (oldScript) oldScript.remove();

          // Cleanup previous blob URL
          if (lastScriptEl?.dataset?.blobUrl) {
            URL.revokeObjectURL(lastScriptEl.dataset.blobUrl);
          }

          // Create blob URL
          const blob = new Blob([js], { type: 'text/javascript' });
          const blobUrl = URL.createObjectURL(blob);

          // Track state
          let rendered = false;
          let errorOccurred = false;

          // Capture unhandled rejections (for dynamic import failures)
          const rejectionHandler = (event) => {
            console.error('[Sandbox] Unhandled rejection:', event.reason);
            errorOccurred = true;
            window.removeEventListener('unhandledrejection', rejectionHandler);
            send({
              type: 'error',
              payload: {
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack || ''
              }
            });
          };
          window.addEventListener('unhandledrejection', rejectionHandler);

          // For module scripts, errors are reported via window.onerror
          const errorHandler = (event) => {
            console.error('[Sandbox] Script error:', event.message, event.filename);
            errorOccurred = true;
            window.removeEventListener('error', errorHandler);
            send({
              type: 'error',
              payload: {
                message: event.message || 'Script execution error',
                stack: event.error?.stack || '',
                filename: event.filename,
                lineno: event.lineno
              }
            });
          };
          window.addEventListener('error', errorHandler);

          // Execute using dynamic import (returns a promise)
          try {
            await import(blobUrl);
          } catch (importErr) {
            console.error('[Sandbox] Import failed:', importErr?.message);
            errorOccurred = true;
            send({
              type: 'error',
              payload: {
                message: importErr?.message || 'Module import failed',
                stack: importErr?.stack || ''
              }
            });
          }

          // Wait for render
          const checkRendered = () => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
          };

          // Give time for async rendering
          await new Promise(resolve => setTimeout(resolve, 200));

          rendered = checkRendered();

          // Cleanup
          window.removeEventListener('error', errorHandler);
          window.removeEventListener('unhandledrejection', rejectionHandler);

          if (rendered) {
            console.log('[Sandbox] App rendered successfully');
            send({ type: 'ready' });
          } else if (!errorOccurred) {
            console.warn('[Sandbox] App did not render, no error detected');
          }

          // Store blob URL for cleanup
          lastScriptEl = { dataset: { blobUrl } };
        } catch (err) {
          console.error('[Sandbox] executeCode error:', err);
          send({
            type: 'error',
            payload: {
              message: err?.message || String(err),
              stack: err?.stack
            }
          });
        }
      }

      // =======================================================================
      // State Helpers
      // =======================================================================
      function setAtPath(obj, path, value) {
        const parts = path.split('/').filter(Boolean);
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        if (parts.length > 0) {
          current[parts[parts.length - 1]] = value;
        }
      }

      function getAtPath(obj, path) {
        const parts = path.split('/').filter(Boolean);
        let current = obj;
        for (const part of parts) {
          if (current == null || !(part in current)) {
            return undefined;
          }
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
          case 'init':
            appState = msg.payload.state || {};
            // Forward to SPA's message handler
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
            // Legacy: receive pre-bundled code
            executeCode(msg.payload.js, msg.payload.css);
            break;

          case 'get-state':
            send({ type: 'state-snapshot', payload: { state: appState } });
            break;

          // New iframe bundler messages
          case 'sync-files':
            if (msg.payload.incremental) {
              // Merge incrementally
              Object.assign(vfsFiles, msg.payload.files);
            } else {
              // Replace all
              vfsFiles = msg.payload.files;
            }
            vfsEntry = msg.payload.entry;
            break;

          case 'build-request':
            buildFromVFS(msg.payload.buildId);
            break;

          case 'execute-code':
            executeCode(msg.payload.js, msg.payload.css);
            break;
        }
      }

      // Message handler for postMessage (fallback/testing)
      window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || data.__sandbox !== true || !data.message) {
          return;
        }
        handleMessage(data.message);
      });

      // Expose receive function for Runtime.evaluate (CDP)
      window.__sandbox_receiveMessage = handleMessage;

      // Expose execute function for initial load (legacy)
      window.__sandbox_executeCode = executeCode;

      // =======================================================================
      // Initialize esbuild eagerly on iframe creation
      // =======================================================================
      initializeEsbuild();
    </script>
  </body>
</html>`;
}
