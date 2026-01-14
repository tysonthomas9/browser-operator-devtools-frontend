// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {FileMetadata, VFSState, VirtualFileMap} from '../types/SandboxTypes.js';
import {getShadcnFiles} from '../components/shadcn/sources.js';
import {getDataStudioFiles} from '../apps/data-studio/sources.js';

/**
 * Default files for a new app (Preact + minimal setup)
 */
const DEFAULT_FILES: VirtualFileMap = {
  '/src/index.tsx': `import { render } from 'preact';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (root) {
  render(<App />, root);
}
`,
  '/src/App.tsx': `import { useState } from 'preact/hooks';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>Sandbox App</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}
`,
  '/src/styles.css': `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0a0a0a;
  color: #fafafa;
  min-height: 100vh;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  margin-bottom: 1rem;
}

button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background: #2563eb;
}
`,
};

/**
 * VFSManager - Virtual File System for sandbox apps
 *
 * Manages files in memory for each app. Files are stored as simple
 * path -> content mappings. Paths must start with '/'.
 */
export class VFSManager {
  private static instance: VFSManager | null = null;
  private apps: Map<string, VFSState> = new Map();

  private constructor() {}

  static getInstance(): VFSManager {
    if (!VFSManager.instance) {
      VFSManager.instance = new VFSManager();
    }
    return VFSManager.instance;
  }

  /**
   * Create a new app with optional template files
   *
   * @param appId - Unique identifier for the app
   * @param template - 'blank' for empty VFS, 'default' for starter files, 'data-studio' for Data Studio v2
   * @param includeShadcn - Whether to include shadcn UI components (default: true for non-blank)
   */
  createApp(appId: string, template: 'blank' | 'default' | 'data-studio' = 'default', includeShadcn = true): VFSState {
    if (this.apps.has(appId)) {
      throw new Error(`App "${appId}" already exists`);
    }

    const now = new Date();
    let files: VirtualFileMap = {};

    switch (template) {
      case 'default':
        files = {...DEFAULT_FILES};
        break;
      case 'data-studio':
        files = {...getDataStudioFiles()};
        break;
      case 'blank':
      default:
        // Empty files
        break;
    }

    // Inject shadcn components for non-blank templates
    if (template !== 'blank' && includeShadcn) {
      const shadcnFiles = getShadcnFiles();
      files = {...files, ...shadcnFiles};
    }

    const state: VFSState = {
      appId,
      files,
      entry: '/src/index.tsx',
      createdAt: now,
      modifiedAt: now,
    };

    this.apps.set(appId, state);
    return state;
  }

  /**
   * Get an app's VFS state
   */
  getApp(appId: string): VFSState | null {
    return this.apps.get(appId) || null;
  }

  /**
   * Delete an app and all its files
   */
  deleteApp(appId: string): boolean {
    return this.apps.delete(appId);
  }

  /**
   * List all app IDs
   */
  listApps(): string[] {
    return Array.from(this.apps.keys());
  }

  /**
   * Write a file (create or update)
   */
  writeFile(appId: string, path: string, content: string): FileMetadata {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }

    const normalizedPath = this.normalizePath(path);
    app.files[normalizedPath] = content;
    app.modifiedAt = new Date();

    return {
      path: normalizedPath,
      size: content.length,
      lastModified: app.modifiedAt,
    };
  }

  /**
   * Read a file
   */
  readFile(appId: string, path: string): string | null {
    const app = this.apps.get(appId);
    if (!app) {
      return null;
    }

    const normalizedPath = this.normalizePath(path);
    return app.files[normalizedPath] || null;
  }

  /**
   * Delete a file
   */
  deleteFile(appId: string, path: string): boolean {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    const normalizedPath = this.normalizePath(path);
    if (normalizedPath in app.files) {
      delete app.files[normalizedPath];
      app.modifiedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Check if a file exists
   */
  fileExists(appId: string, path: string): boolean {
    const app = this.apps.get(appId);
    if (!app) {
      return false;
    }

    const normalizedPath = this.normalizePath(path);
    return normalizedPath in app.files;
  }

  /**
   * List all files in an app
   */
  listFiles(appId: string): FileMetadata[] {
    const app = this.apps.get(appId);
    if (!app) {
      return [];
    }

    return Object.entries(app.files).map(([path, content]) => ({
      path,
      size: content.length,
      lastModified: app.modifiedAt,
    }));
  }

  /**
   * Get all files as a map (for bundling)
   */
  getFiles(appId: string): VirtualFileMap | null {
    const app = this.apps.get(appId);
    return app ? {...app.files} : null;
  }

  /**
   * Get entry point for an app
   */
  getEntry(appId: string): string | null {
    const app = this.apps.get(appId);
    return app?.entry || null;
  }

  /**
   * Set entry point for an app
   */
  setEntry(appId: string, entry: string): void {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }
    app.entry = this.normalizePath(entry);
  }

  /**
   * Import multiple files at once (for bulk operations)
   */
  importFiles(appId: string, files: VirtualFileMap): void {
    const app = this.apps.get(appId);
    if (!app) {
      throw new Error(`App "${appId}" not found`);
    }

    for (const [path, content] of Object.entries(files)) {
      const normalizedPath = this.normalizePath(path);
      app.files[normalizedPath] = content;
    }
    app.modifiedAt = new Date();
  }

  /**
   * Export app state for persistence
   */
  exportApp(appId: string): VFSState | null {
    const app = this.apps.get(appId);
    if (!app) {
      return null;
    }

    return {
      ...app,
      files: {...app.files},
    };
  }

  /**
   * Import app state from persistence
   */
  importApp(state: VFSState): void {
    this.apps.set(state.appId, {
      ...state,
      files: {...state.files},
    });
  }

  /**
   * Normalize a file path
   */
  private normalizePath(path: string): string {
    // Ensure path starts with /
    let normalized = path.startsWith('/') ? path : '/' + path;

    // Remove double slashes
    normalized = normalized.replace(/\/+/g, '/');

    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Prevent directory traversal
    if (normalized.includes('..')) {
      throw new Error('Directory traversal not allowed');
    }

    return normalized;
  }

  /**
   * Reset the manager (for testing)
   */
  reset(): void {
    this.apps.clear();
  }
}
