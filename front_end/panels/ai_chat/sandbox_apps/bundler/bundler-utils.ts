// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * Bundler Utilities
 *
 * Pure utility functions extracted from bundler.worker.js for testing.
 * These functions handle path resolution, module specifier detection,
 * and esm.sh URL generation.
 */

/**
 * Default esm.sh query parameters for external package resolution.
 * Targets ES2022 and marks React modules as external (provided via import map).
 */
export const ESM_SH_DEFAULT_QUERY = 'target=es2022&external=react,react-dom,react-dom/client';

/**
 * Converts a bare module specifier to an esm.sh CDN URL.
 *
 * @param specifier - The bare module specifier (e.g., 'lodash', 'lucide-react@0.263.1')
 * @returns The full esm.sh URL with query parameters
 *
 * @example
 * toEsmShUrl('lodash') // 'https://esm.sh/lodash?target=es2022&external=react,react-dom,react-dom/client'
 * toEsmShUrl('lodash?bundle') // 'https://esm.sh/lodash?bundle&target=es2022&external=react,react-dom,react-dom/client'
 */
export function toEsmShUrl(specifier: string): string {
  const hasQuery = specifier.includes('?');
  return `https://esm.sh/${specifier}${hasQuery ? '&' : '?'}${ESM_SH_DEFAULT_QUERY}`;
}

/**
 * Checks if a module specifier is a "bare specifier" (npm package name).
 * Bare specifiers don't start with /, ./, ../, http://, https://, or data:.
 *
 * @param path - The module specifier to check
 * @returns true if it's a bare specifier (npm package)
 *
 * @example
 * isBareSpecifier('lodash')       // true
 * isBareSpecifier('@scope/pkg')   // true
 * isBareSpecifier('./foo')        // false
 * isBareSpecifier('/src/utils')   // false
 * isBareSpecifier('https://...')  // false
 */
export function isBareSpecifier(path: string): boolean {
  return Boolean(
    path &&
    !path.startsWith('/') &&
    !path.startsWith('./') &&
    !path.startsWith('../') &&
    !path.startsWith('http://') &&
    !path.startsWith('https://') &&
    !path.startsWith('data:'),
  );
}

/**
 * Gets the directory portion of a path.
 *
 * @param path - The file path
 * @returns The directory containing the file
 *
 * @example
 * dirname('/src/App.tsx')    // '/src'
 * dirname('/file.ts')        // '/'
 * dirname('file.ts')         // '/'
 */
export function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) {
    return '/';
  }
  return path.slice(0, idx);
}

/**
 * Normalizes a path by resolving . and .. segments and removing duplicate slashes.
 *
 * @param path - The path to normalize
 * @returns The normalized absolute path
 *
 * @example
 * normalizePath('/src/../lib/utils')  // '/lib/utils'
 * normalizePath('/src/./App.tsx')     // '/src/App.tsx'
 * normalizePath('//src//file.ts')     // '/src/file.ts'
 */
export function normalizePath(path: string): string {
  const parts: string[] = [];
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

/**
 * Resolves a relative path against a directory.
 *
 * @param resolveDir - The directory to resolve from
 * @param spec - The relative path specifier
 * @returns The normalized absolute path
 *
 * @example
 * resolveRelativePath('/src', './App')      // '/src/App'
 * resolveRelativePath('/src/components', '../utils')  // '/src/utils'
 * resolveRelativePath('/src', '/lib/utils') // '/lib/utils'
 */
export function resolveRelativePath(resolveDir: string, spec: string): string {
  if (spec.startsWith('/')) {
    return normalizePath(spec);
  }
  return normalizePath((resolveDir.endsWith('/') ? resolveDir : resolveDir + '/') + spec);
}

/**
 * Attempts to resolve a path with common file extensions.
 * Tries the exact path, then with extensions (.tsx, .ts, .jsx, .js, .json, .css),
 * then as an index file in a directory.
 *
 * @param basePath - The base path to resolve
 * @param files - The virtual file system map
 * @returns The resolved path with extension, or null if not found
 *
 * @example
 * // Given files: {'/src/App.tsx': '...', '/src/utils/index.ts': '...'}
 * resolveWithExtensions('/src/App', files)   // '/src/App.tsx'
 * resolveWithExtensions('/src/utils', files) // '/src/utils/index.ts'
 * resolveWithExtensions('/src/nope', files)  // null
 */
export function resolveWithExtensions(basePath: string, files: Record<string, string>): string | null {
  // Try exact match
  if (Object.prototype.hasOwnProperty.call(files, basePath)) {
    return basePath;
  }

  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];

  // Try with extensions
  for (const ext of extensions) {
    if (Object.prototype.hasOwnProperty.call(files, basePath + ext)) {
      return basePath + ext;
    }
  }

  // Try index files
  for (const ext of extensions) {
    const idx = basePath.lastIndexOf('/');
    const dir = idx >= 0 ? basePath.slice(0, idx + 1) : '/';
    const base = idx >= 0 ? basePath.slice(idx + 1) : basePath;
    const candidate = dir + base + '/index' + ext;
    if (Object.prototype.hasOwnProperty.call(files, candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Determines the esbuild loader type for a file based on its extension.
 *
 * @param path - The file path
 * @returns The appropriate esbuild loader
 *
 * @example
 * loaderForPath('/src/App.tsx')    // 'tsx'
 * loaderForPath('/src/utils.ts')   // 'ts'
 * loaderForPath('/src/styles.css') // 'css'
 * loaderForPath('/data.json')      // 'json'
 * loaderForPath('/readme.md')      // 'text'
 */
export function loaderForPath(path: string): 'tsx' | 'ts' | 'jsx' | 'js' | 'css' | 'json' | 'text' {
  if (path.endsWith('.tsx')) {
    return 'tsx';
  }
  if (path.endsWith('.ts')) {
    return 'ts';
  }
  if (path.endsWith('.jsx')) {
    return 'jsx';
  }
  if (path.endsWith('.js')) {
    return 'js';
  }
  if (path.endsWith('.css')) {
    return 'css';
  }
  if (path.endsWith('.json')) {
    return 'json';
  }
  return 'text';
}

/**
 * Formats an esbuild message location for display.
 *
 * @param loc - The location object from esbuild
 * @returns Formatted location string
 */
export function formatLocation(loc: {file?: string; line?: number; column?: number} | null | undefined): string {
  if (!loc) {
    return '';
  }
  const file = loc.file ?? '<unknown>';
  const line = loc.line ?? 0;
  const col = loc.column ?? 0;
  return `${file}:${line}:${col}`;
}

/**
 * Formats an array of esbuild messages for display.
 *
 * @param msgs - Array of esbuild messages
 * @returns Array of formatted message strings
 */
export function formatMessages(
  msgs: Array<{text: string; location?: {file?: string; line?: number; column?: number} | null}> | null | undefined,
): string[] {
  if (!Array.isArray(msgs)) {
    return [];
  }
  return msgs.map(m => {
    const where = formatLocation(m.location);
    if (where) {
      return `${where} ${m.text}`;
    }
    return m.text;
  });
}

/**
 * Set of React-related module specifiers that should be marked as external.
 * These are provided via import map in the preview HTML.
 */
export const REACT_EXTERNALS = new Set([
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'zustand',
  'zustand/middleware',
]);

/**
 * Checks if a module specifier is a React external.
 *
 * @param specifier - The module specifier to check
 * @returns true if it's a React module that should be external
 */
export function isReactExternal(specifier: string): boolean {
  return REACT_EXTERNALS.has(specifier);
}
