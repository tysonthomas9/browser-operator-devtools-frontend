// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import type {ToolResult} from '../types/SandboxTypes.js';
import {SandboxController} from '../controller/SandboxController.js';

/**
 * Tool schema for AI agents
 */
export const APPLY_PATCH_SCHEMA = {
  name: 'sandbox_apply_patch',
  description: 'Apply a unified diff patch to a file in a sandbox app. Useful for making incremental changes without rewriting the entire file.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      appId: {
        type: 'string',
        description: 'The app ID',
      },
      path: {
        type: 'string',
        description: 'Path to the file to patch (e.g., "src/App.tsx")',
      },
      patch: {
        type: 'string',
        description: 'Unified diff patch content',
      },
    },
    required: ['appId', 'path', 'patch'],
  },
};

interface ApplyPatchArgs {
  appId: string;
  path: string;
  patch: string;
}

interface PatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: Array<{type: 'context' | 'add' | 'remove'; content: string}>;
}

/**
 * Parse a unified diff patch
 */
function parsePatch(patch: string): PatchHunk[] {
  const hunks: PatchHunk[] = [];
  const lines = patch.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Look for hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
    if (hunkMatch) {
      const hunk: PatchHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newCount: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      };

      i++;
      while (i < lines.length) {
        const contentLine = lines[i];
        if (contentLine.startsWith('@@') || contentLine.startsWith('diff ') || contentLine.startsWith('---') || contentLine.startsWith('+++')) {
          break;
        }

        if (contentLine.startsWith('+')) {
          hunk.lines.push({type: 'add', content: contentLine.slice(1)});
        } else if (contentLine.startsWith('-')) {
          hunk.lines.push({type: 'remove', content: contentLine.slice(1)});
        } else if (contentLine.startsWith(' ') || contentLine === '') {
          hunk.lines.push({type: 'context', content: contentLine.slice(1) || ''});
        }
        i++;
      }

      hunks.push(hunk);
    } else {
      i++;
    }
  }

  return hunks;
}

/**
 * Apply a parsed patch to content
 */
function applyPatchToContent(content: string, hunks: PatchHunk[]): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let lineIndex = 0;

  for (const hunk of hunks) {
    // Copy lines before this hunk
    const hunkStart = hunk.oldStart - 1; // Convert to 0-indexed
    while (lineIndex < hunkStart) {
      result.push(lines[lineIndex]);
      lineIndex++;
    }

    // Apply hunk
    for (const patchLine of hunk.lines) {
      if (patchLine.type === 'context') {
        // Context line - verify and copy
        if (lineIndex < lines.length) {
          result.push(lines[lineIndex]);
          lineIndex++;
        }
      } else if (patchLine.type === 'remove') {
        // Remove line - skip it
        lineIndex++;
      } else if (patchLine.type === 'add') {
        // Add line
        result.push(patchLine.content);
      }
    }
  }

  // Copy remaining lines
  while (lineIndex < lines.length) {
    result.push(lines[lineIndex]);
    lineIndex++;
  }

  return result.join('\n');
}

/**
 * ApplyPatchTool - Applies a unified diff patch to a file
 */
export async function applyPatch(args: ApplyPatchArgs): Promise<ToolResult> {
  try {
    const controller = SandboxController.getInstance();

    // Validate app exists
    const app = controller.getApp(args.appId);
    if (!app) {
      return {
        success: false,
        error: `App "${args.appId}" not found`,
      };
    }

    // Get current file content
    const currentContent = controller.readFile(args.appId, args.path);
    if (currentContent === null) {
      return {
        success: false,
        error: `File "${args.path}" not found in app "${args.appId}"`,
      };
    }

    // Parse patch
    const hunks = parsePatch(args.patch);
    if (hunks.length === 0) {
      return {
        success: false,
        error: 'Invalid patch: no hunks found',
      };
    }

    // Apply patch
    const newContent = applyPatchToContent(currentContent, hunks);

    // Write patched content
    await controller.writeFile(args.appId, args.path, newContent);

    return {
      success: true,
      data: {
        appId: args.appId,
        path: args.path,
        hunksApplied: hunks.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
