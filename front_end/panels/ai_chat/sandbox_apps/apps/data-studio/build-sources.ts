#!/usr/bin/env npx tsx
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Build script to generate sources.ts from the src/ directory.
 *
 * This script reads all .tsx/.ts/.css files from src/ and generates
 * a sources.ts file that exports them as a VirtualFileMap using
 * JSON.parse for simpler encoding (no template literal escaping issues).
 *
 * Usage:
 *   npx tsx build-sources.ts
 *
 * The generated sources.ts works with the existing sandbox framework
 * without any changes to the framework code.
 */

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT = path.join(__dirname, 'sources.ts');

/**
 * Recursively walk a directory and return all matching file paths.
 */
function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Generate the sources.ts file from src/ directory.
 */
function generateSources(): void {
  console.log('[build-sources] Reading files from src/...');

  const files = walkDir(SRC_DIR);
  const fileMap: Record<string, string> = {};

  for (const file of files) {
    // Convert absolute path to virtual path (e.g., /src/components/App.tsx)
    const relativePath = path.relative(SRC_DIR, file).replace(/\\/g, '/');
    const vfsPath = '/src/' + relativePath;
    fileMap[vfsPath] = fs.readFileSync(file, 'utf-8');
    console.log(`  ${vfsPath}`);
  }

  console.log(`[build-sources] Found ${files.length} files`);

  // Generate TypeScript file using JSON.parse (simpler than template literals)
  const jsonString = JSON.stringify(fileMap);

  const output = `// AUTO-GENERATED - Do not edit directly
// Run: npx tsx build-sources.ts to regenerate from src/
//
// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Data Studio v2 - Sandbox App Template
 *
 * A fully functional data studio app built with React 18 and Zustand
 * using the sandbox_apps architecture. Features:
 * - Table-based data management with entities and agent columns
 * - Template system for quick starts
 * - Agent execution with result tracking
 * - Export functionality
 *
 * Communication with DevTools:
 * - App -> DevTools: window.__sandbox.sendAction(action)
 * - DevTools -> App: window.__sandbox_onMessage(message)
 *
 * Source files are embedded as JSON for simpler encoding (no escaping issues).
 */

import type {VirtualFileMap} from '../../types/SandboxTypes.js';

// Source files encoded as JSON string to avoid template literal escaping issues
const SOURCES_JSON = ${JSON.stringify(jsonString)};

/**
 * Get Data Studio source files for VFS.
 */
export function getDataStudioFiles(): VirtualFileMap {
  return JSON.parse(SOURCES_JSON) as VirtualFileMap;
}
`;

  fs.writeFileSync(OUTPUT, output);
  console.log(`[build-sources] Generated ${OUTPUT}`);
  console.log('[build-sources] Done!');
}

// Run if executed directly
generateSources();
