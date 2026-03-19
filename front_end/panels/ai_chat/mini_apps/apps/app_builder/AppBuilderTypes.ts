// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * AppBuilder Types - Type definitions for the App Builder mini app
 */

/**
 * Represents a file in an App Builder project
 */
export interface ProjectFile {
  /** Relative path from project root (e.g., "src/App.tsx") */
  path: string;
  /** File content */
  content: string;
  /** MIME type of the file */
  type: string;
}

/**
 * Represents an App Builder project
 */
export interface AppProject {
  /** Unique identifier (UUID) */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** All project files */
  files: ProjectFile[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Input for creating a new project
 */
export type CreateProjectInput = Omit<AppProject, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Input for updating an existing project
 */
export type UpdateProjectInput = Partial<Omit<AppProject, 'id' | 'createdAt'>>;

/**
 * Summary of a project for listing
 */
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * State of the WebContainer runtime
 */
export type WebContainerStatus =
  | 'idle'
  | 'booting'
  | 'ready'
  | 'installing'
  | 'running'
  | 'error';

/**
 * Terminal output entry
 */
export interface TerminalEntry {
  type: 'stdout' | 'stderr' | 'info';
  content: string;
  timestamp: number;
}

/**
 * WebContainer state for the SPA
 */
export interface WebContainerState {
  status: WebContainerStatus;
  serverUrl: string | null;
  terminalOutput: TerminalEntry[];
  error: string | null;
}

/**
 * File tree node for displaying project structure
 */
export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

/**
 * Editor state
 */
export interface EditorState {
  selectedFile: string | null;
  content: string;
  isDirty: boolean;
}

/**
 * App Builder SPA state
 */
export interface AppBuilderState {
  project: AppProject | null;
  projects: ProjectSummary[];
  webContainer: WebContainerState;
  editor: EditorState;
  fileTree: FileTreeNode[];
  isLoading: boolean;
}

/**
 * Form data for creating/editing a project
 */
export interface ProjectFormData {
  name: string;
  description: string;
}

/**
 * Default Vite + React + Tailwind project template
 */
export const DEFAULT_PROJECT_TEMPLATE: ProjectFile[] = [
  {
    path: 'package.json',
    type: 'application/json',
    content: JSON.stringify({
      name: 'vite-react-app',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.2.0',
        autoprefixer: '^10.4.16',
        postcss: '^8.4.32',
        tailwindcss: '^3.4.0',
        typescript: '^5.3.0',
        vite: '^5.0.0',
      },
    }, null, 2),
  },
  {
    path: 'vite.config.ts',
    type: 'text/typescript',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
  },
  {
    path: 'tsconfig.json',
    type: 'application/json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    }, null, 2),
  },
  {
    path: 'tsconfig.node.json',
    type: 'application/json',
    content: JSON.stringify({
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
      },
      include: ['vite.config.ts'],
    }, null, 2),
  },
  {
    path: 'tailwind.config.js',
    type: 'text/javascript',
    content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
  },
  {
    path: 'postcss.config.js',
    type: 'text/javascript',
    content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
  },
  {
    path: 'index.html',
    type: 'text/html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  },
  {
    path: 'src/main.tsx',
    type: 'text/typescript',
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
  },
  {
    path: 'src/App.tsx',
    type: 'text/typescript',
    content: `function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Edit <code className="bg-gray-100 px-2 py-1 rounded">src/App.tsx</code> to get started
        </p>
        <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-lg transition-colors">
          Get Started
        </button>
      </div>
    </div>
  )
}

export default App
`,
  },
  {
    path: 'src/index.css',
    type: 'text/css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
  },
];

/**
 * Get MIME type from file extension
 */
export function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    json: 'application/json',
    html: 'text/html',
    css: 'text/css',
    md: 'text/markdown',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
  };
  return mimeTypes[ext || ''] || 'text/plain';
}

/**
 * Build a file tree from flat file list
 */
export function buildFileTree(files: ProjectFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const nodeMap = new Map<string, FileTreeNode>();

  // Sort files so directories come before their children
  const sortedPaths = files.map(f => f.path).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (!nodeMap.has(currentPath)) {
        const node: FileTreeNode = {
          name: part,
          path: currentPath,
          isDirectory: !isFile,
          children: isFile ? undefined : [],
        };
        nodeMap.set(currentPath, node);

        if (parentPath) {
          const parent = nodeMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(node);
          }
        } else {
          root.push(node);
        }
      }
    }
  }

  return root;
}
