// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../core/Logger.js';
import { LLMConfigurationManager } from '../core/LLMConfigurationManager.js';
import { LLMClient } from '../LLM/LLMClient.js';
import { AppProjectManager } from '../core/AppProjectManager.js';
import { MiniAppRegistry } from '../mini_apps/MiniAppRegistry.js';
import type { Tool, LLMContext } from './Tools.js';
import type { ProjectFile } from '../mini_apps/apps/app_builder/AppBuilderTypes.js';
import { DEFAULT_PROJECT_TEMPLATE, getMimeType } from '../mini_apps/apps/app_builder/AppBuilderTypes.js';

const logger = createLogger('Tool:GenerateApp');

export interface GenerateAppArgs {
  /** Name for the project (alphanumeric, hyphens, underscores) */
  projectName: string;
  /** Brief description of the app */
  description: string;
  /** Detailed requirements for what the app should do */
  requirements: string;
  /** Framework to use (default: react) */
  appType?: 'react' | 'vanilla';
  /** Explanation for why this app is being generated */
  reasoning: string;
}

export interface GenerateAppResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  filesGenerated?: number;
  message: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are an expert React developer. Generate complete, working React application code based on user requirements.

IMPORTANT: You must output files in this EXACT format:
---FILE: path/to/file.tsx---
[file content here]
---FILE: path/to/another.ts---
[file content here]
---END---

Rules:
1. Always generate src/App.tsx as the main component
2. Use Tailwind CSS for styling (classes like bg-blue-500, flex, etc.)
3. Use TypeScript (.tsx/.ts files)
4. Generate clean, modern, production-ready code
5. Include all necessary imports
6. The app uses Vite + React + Tailwind (already configured in package.json)
7. Do NOT generate package.json, vite.config.ts, tailwind.config.js, postcss.config.js, index.html, or src/main.tsx - these are provided
8. Focus on src/App.tsx and any additional components in src/components/

Example output:
---FILE: src/App.tsx---
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() => setCount(c => c + 1)}
      >
        Count: {count}
      </button>
    </div>
  )
}

export default App
---END---`;

export class GenerateAppTool implements Tool<GenerateAppArgs, GenerateAppResult> {
  name = 'generate_app';
  description = 'Generates a complete React application from requirements and opens it in the App Builder with live preview. Use this when the user wants to create a new web app, website, or UI component.';

  schema = {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name for the project (must start with letter, contain only letters, numbers, hyphens, underscores)'
      },
      description: {
        type: 'string',
        description: 'Brief description of what the app does'
      },
      requirements: {
        type: 'string',
        description: 'Detailed requirements for the app functionality, features, and UI'
      },
      appType: {
        type: 'string',
        enum: ['react', 'vanilla'],
        description: 'Framework to use (default: react)'
      },
      reasoning: {
        type: 'string',
        description: 'Explanation for why this app is being generated'
      }
    },
    required: ['projectName', 'description', 'requirements', 'reasoning']
  };

  async execute(args: GenerateAppArgs, _ctx?: LLMContext): Promise<GenerateAppResult> {
    logger.info('Executing generate_app', { projectName: args.projectName });

    try {
      // Validate project name
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(args.projectName)) {
        return {
          success: false,
          message: 'Invalid project name',
          error: 'Project name must start with a letter and contain only letters, numbers, hyphens, and underscores.'
        };
      }

      // Get LLM configuration
      const configManager = LLMConfigurationManager.getInstance();
      const config = configManager.getConfiguration();

      if (!config.provider || !config.mainModel) {
        return {
          success: false,
          message: 'LLM not configured',
          error: 'No LLM provider configured. Please configure an LLM provider in settings.'
        };
      }

      // Generate code using LLM
      logger.info('Generating app code with LLM', { provider: config.provider, model: config.mainModel });

      const llmClient = LLMClient.getInstance();
      const response = await llmClient.call({
        provider: config.provider,
        model: config.mainModel,
        systemPrompt: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Create a React app with these requirements:

Project: ${args.projectName}
Description: ${args.description}

Requirements:
${args.requirements}

Generate the necessary files. Remember to output in the exact format specified.`
        }],
        temperature: 0.7
      });

      if (!response.text) {
        return {
          success: false,
          message: 'Empty LLM response',
          error: 'LLM returned empty response'
        };
      }

      // Parse the generated files
      const generatedFiles = this.parseGeneratedFiles(response.text);

      if (generatedFiles.length === 0) {
        logger.warn('No files parsed from LLM response', { response: response.text.substring(0, 500) });
        return {
          success: false,
          message: 'No files generated',
          error: 'Failed to parse generated files from LLM response. The model may not have followed the expected format.'
        };
      }

      // Merge with default template (keep config files, replace/add src files)
      const finalFiles = this.mergeWithTemplate(generatedFiles);

      // Create the project
      const projectManager = AppProjectManager.getInstance();
      const project = await projectManager.createProject({
        name: args.projectName,
        description: args.description,
        files: finalFiles
      });

      logger.info('Created project', { projectId: project.id, fileCount: finalFiles.length });

      // Launch App Builder and open the project
      try {
        const instance = await MiniAppRegistry.launch('app_builder');

        // Wait a moment for the app to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Send action to open the project
        await instance.controller.executeAction('open-project', { projectId: project.id });

        logger.info('Opened project in App Builder', { projectId: project.id });
      } catch (launchError) {
        logger.warn('Could not auto-open App Builder, but project was created', launchError);
      }

      return {
        success: true,
        projectId: project.id,
        projectName: project.name,
        filesGenerated: generatedFiles.length,
        message: `Successfully generated "${project.name}" with ${generatedFiles.length} files. The App Builder is now showing your app with live preview.`
      };

    } catch (error: any) {
      logger.error('Failed to generate app', { error: error?.message });
      return {
        success: false,
        message: 'Generation failed',
        error: error?.message || 'Failed to generate app'
      };
    }
  }

  /**
   * Parse generated files from LLM response
   */
  private parseGeneratedFiles(response: string): ProjectFile[] {
    const files: ProjectFile[] = [];

    // Match pattern: ---FILE: path---\ncontent\n---FILE or ---END---
    const filePattern = /---FILE:\s*([^\n-]+)---\n([\s\S]*?)(?=---FILE:|---END---|$)/g;

    let match;
    while ((match = filePattern.exec(response)) !== null) {
      const path = match[1].trim();
      const content = match[2].trim();

      if (path && content) {
        files.push({
          path,
          content,
          type: getMimeType(path)
        });
        logger.debug('Parsed file', { path, contentLength: content.length });
      }
    }

    return files;
  }

  /**
   * Merge generated files with default template
   * Keeps config files from template, uses generated src files
   */
  private mergeWithTemplate(generatedFiles: ProjectFile[]): ProjectFile[] {
    // Start with template files
    const result: ProjectFile[] = [];

    // Add template config files (non-src files)
    for (const templateFile of DEFAULT_PROJECT_TEMPLATE) {
      // Keep all config files from template
      if (!templateFile.path.startsWith('src/')) {
        result.push(templateFile);
      }
    }

    // Add src/main.tsx and src/index.css from template if not in generated
    const templateSrcFiles = DEFAULT_PROJECT_TEMPLATE.filter(f =>
      f.path === 'src/main.tsx' || f.path === 'src/index.css'
    );

    for (const templateFile of templateSrcFiles) {
      const hasGenerated = generatedFiles.some(f => f.path === templateFile.path);
      if (!hasGenerated) {
        result.push(templateFile);
      }
    }

    // Add all generated files (they take precedence)
    for (const genFile of generatedFiles) {
      // Skip if it's a config file that should come from template
      const isConfigFile = !genFile.path.startsWith('src/') &&
        ['package.json', 'vite.config.ts', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js', 'index.html'].some(
          cfg => genFile.path.endsWith(cfg)
        );

      if (!isConfigFile) {
        result.push(genFile);
      }
    }

    return result;
  }
}
