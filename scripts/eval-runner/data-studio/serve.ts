// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * HTTP server for serving the standalone Data Studio SPA.
 *
 * Uses the unified previewHtml template with WebSocket transport,
 * eliminating duplication between standalone testing and DevTools.
 */

import express, {type Express} from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {fileURLToPath} from 'url';
import type {Server} from 'http';
import {createPreviewHtml} from '../../../front_end/panels/ai_chat/sandbox_apps/runtime/previewHtml.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface HTTPServerOptions {
  port?: number;
  wsPort?: number; // WebSocket port to inject into HTML
}

export class HTTPServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private wsPort: number;

  constructor(options: HTTPServerOptions = {}) {
    this.port = options.port ?? 3456;
    this.wsPort = options.wsPort ?? 3457;
    this.app = express();

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve unified HTML template with WebSocket transport (VFS files sent via WebSocket)
    this.app.get('/', (_req, res) => {
      const html = createPreviewHtml({
        appId: 'data-studio-standalone',
        transport: 'websocket',
        wsPort: this.wsPort,
        // VFS files are sent via WebSocket on init, no bundledScript needed
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });

    // Serve bundled SPA JavaScript
    this.app.get('/data-studio-spa.js', (_req, res) => {
      const jsPath = path.join(__dirname, 'dist', 'data-studio-spa.js');

      if (!fs.existsSync(jsPath)) {
        res.status(404).send(
          'SPA bundle not found. Run: npx tsx scripts/eval-runner/data-studio/bundle-spa.ts',
        );
        return;
      }

      res.setHeader('Content-Type', 'application/javascript');
      res.sendFile(jsPath);
    });

    // Serve source map
    this.app.get('/data-studio-spa.js.map', (_req, res) => {
      const mapPath = path.join(__dirname, 'dist', 'data-studio-spa.js.map');

      if (fs.existsSync(mapPath)) {
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(mapPath);
      } else {
        res.status(404).send('Source map not found');
      }
    });

    // Serve CSS
    this.app.get('/data-studio.css', (_req, res) => {
      const cssPath = path.join(__dirname, 'dist', 'data-studio.css');

      if (fs.existsSync(cssPath)) {
        res.setHeader('Content-Type', 'text/css');
        res.sendFile(cssPath);
      } else {
        res.status(404).send('CSS not found');
      }
    });

    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({status: 'ok', port: this.port, wsPort: this.wsPort});
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`[HTTP] Data Studio SPA: http://localhost:${this.port}`);
          console.log(`[HTTP] WebSocket will connect to: ws://localhost:${this.wsPort}`);
          resolve();
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`[HTTP] Port ${this.port} is already in use`);
          }
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => {
          console.log('[HTTP] Server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

// Convenience function for simple usage
export async function startHTTPServer(
  port: number = 3456,
  wsPort: number = 3457,
): Promise<HTTPServer> {
  const server = new HTTPServer({port, wsPort});
  await server.start();
  return server;
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = parseInt(process.argv[2] || '3456', 10);
  const wsPort = parseInt(process.argv[3] || '3457', 10);

  startHTTPServer(port, wsPort).catch(err => {
    console.error('[HTTP] Failed to start:', err);
    process.exit(1);
  });
}
