// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { APIServer } from '../api-server.js';

/**
 * HTTPWrapper - Optional HTTP API wrapper for BrowserAgentServer
 *
 * This provides an HTTP REST API on top of the core BrowserAgentServer,
 * following the same pattern as the CLI wrapper.
 *
 * Example usage:
 * ```js
 * import { BrowserAgentServer } from './BrowserAgentServer.js';
 * import { HTTPWrapper } from './HTTPWrapper.js';
 *
 * const browserAgentServer = new BrowserAgentServer({ port: 8080 });
 * const httpWrapper = new HTTPWrapper(browserAgentServer, { port: 8081 });
 *
 * await browserAgentServer.start();
 * await httpWrapper.start();
 * ```
 */
export class HTTPWrapper {
  constructor(browserAgentServer, options = {}) {
    this.browserAgentServer = browserAgentServer;
    this.config = {
      port: options.port || 8081,
      host: options.host || 'localhost',
      ...options
    };

    this.apiServer = new APIServer(browserAgentServer, this.config.port);
    this.isRunning = false;
  }

  /**
   * Start the HTTP API server
   */
  async start() {
    if (this.isRunning) {
      throw new Error('HTTP wrapper is already running');
    }

    if (!this.browserAgentServer.isRunning) {
      throw new Error('BrowserAgentServer must be started before starting HTTP wrapper');
    }

    this.apiServer.start();
    this.isRunning = true;
    
    return this;
  }

  /**
   * Stop the HTTP API server
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.apiServer.stop();
    this.isRunning = false;
  }

  /**
   * Get the HTTP server port
   */
  getPort() {
    return this.config.port;
  }

  /**
   * Get the HTTP server host
   */
  getHost() {
    return this.config.host;
  }

  /**
   * Get running status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      host: this.config.host,
      port: this.config.port,
      url: `http://${this.config.host}:${this.config.port}`
    };
  }
}