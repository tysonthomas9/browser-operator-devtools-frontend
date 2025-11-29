// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { FileStorageManager } from '../tools/FileStorageManager.js';
import { createLogger } from '../core/Logger.js';
import { MemoryModule } from './MemoryModule.js';
import type { BlockType, MemoryBlock, MemorySearchResult } from './types.js';

const logger = createLogger('MemoryBlockManager');

/**
 * Manages memory blocks stored as files via FileStorageManager.
 * Memory is global (shared across all conversations) using a reserved session ID.
 *
 * Block types:
 * - user: User preferences, name, coding style (20000 chars)
 * - facts: Recent extracted facts (20000 chars)
 * - project: Project-specific context (20000 chars each, max 4)
 */
export class MemoryBlockManager {
  private fileManager: FileStorageManager;
  private memoryModule: MemoryModule;

  constructor() {
    this.fileManager = FileStorageManager.getInstance();
    this.memoryModule = MemoryModule.getInstance();
  }

  /**
   * Execute a function with the global memory session, restoring the previous session after.
   */
  private async withGlobalSession<T>(fn: () => Promise<T>): Promise<T> {
    const prevSession = this.fileManager.getSessionId();
    this.fileManager.setSessionId(this.memoryModule.getSessionId());
    try {
      return await fn();
    } finally {
      this.fileManager.setSessionId(prevSession);
    }
  }

  // --- Block CRUD ---

  /**
   * Get a memory block by type and optional project name.
   */
  async getBlock(type: BlockType, projectName?: string): Promise<MemoryBlock | null> {
    return this.withGlobalSession(async () => {
      const filename = this.getFilename(type, projectName);
      const file = await this.fileManager.readFile(filename);
      if (!file) {
        return null;
      }

      return {
        filename,
        type,
        label: this.getLabel(type, projectName),
        description: this.getDescription(type),
        content: file.content,
        charLimit: this.memoryModule.getBlockLimit(type),
        updatedAt: file.updatedAt,
      };
    });
  }

  /**
   * Update or create a memory block.
   */
  async updateBlock(type: BlockType, content: string, projectName?: string): Promise<void> {
    const limit = this.memoryModule.getBlockLimit(type);
    if (content.length > limit) {
      throw new Error(`Content exceeds ${limit} char limit (got ${content.length})`);
    }

    return this.withGlobalSession(async () => {
      const filename = this.getFilename(type, projectName);
      const exists = await this.fileManager.readFile(filename);

      if (exists) {
        await this.fileManager.updateFile(filename, content, false);
        logger.info('Updated memory block', { type, filename });
      } else {
        // Check project limit before creating new project block
        if (type === 'project') {
          const projects = await this.listProjectBlocks();
          if (projects.length >= this.memoryModule.getMaxProjectBlocks()) {
            throw new Error(`Max ${this.memoryModule.getMaxProjectBlocks()} project blocks allowed`);
          }
        }
        await this.fileManager.createFile(filename, content, 'text/markdown');
        logger.info('Created memory block', { type, filename });
      }
    });
  }

  /**
   * Delete a memory block.
   */
  async deleteBlock(type: BlockType, projectName?: string): Promise<void> {
    return this.withGlobalSession(async () => {
      const filename = this.getFilename(type, projectName);
      try {
        await this.fileManager.deleteFile(filename);
        logger.info('Deleted memory block', { type, filename });
      } catch (error) {
        // Ignore if file doesn't exist
        logger.debug('Block not found for deletion', { type, filename });
      }
    });
  }

  // --- Queries ---

  /**
   * Get all memory blocks.
   */
  async getAllBlocks(): Promise<MemoryBlock[]> {
    return this.withGlobalSession(async () => {
      const files = await this.fileManager.listFiles();
      const blocks: MemoryBlock[] = [];

      for (const file of files) {
        if (!file.fileName.startsWith('memory_')) {
          continue;
        }

        const fullFile = await this.fileManager.readFile(file.fileName);
        if (!fullFile) {
          continue;
        }

        const { type, projectName } = this.parseFilename(file.fileName);
        blocks.push({
          filename: file.fileName,
          type,
          label: this.getLabel(type, projectName),
          description: this.getDescription(type),
          content: fullFile.content,
          charLimit: this.memoryModule.getBlockLimit(type),
          updatedAt: file.updatedAt,
        });
      }

      return blocks;
    });
  }

  /**
   * List only project blocks.
   */
  async listProjectBlocks(): Promise<MemoryBlock[]> {
    const all = await this.getAllBlocks();
    return all.filter(b => b.type === 'project');
  }

  /**
   * Search across all blocks for matching lines.
   */
  async searchBlocks(query: string): Promise<MemorySearchResult[]> {
    const blocks = await this.getAllBlocks();
    const results: MemorySearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const block of blocks) {
      const lines = block.content.split('\n');
      const matches = lines.filter(line =>
        line.toLowerCase().includes(queryLower)
      );
      if (matches.length > 0) {
        results.push({ block, matches });
      }
    }

    return results;
  }

  // --- Helpers ---

  private getFilename(type: BlockType, projectName?: string): string {
    if (type === 'project' && projectName) {
      const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return `memory_project_${safeName}.md`;
    }
    return `memory_${type}.md`;
  }

  private parseFilename(filename: string): { type: BlockType; projectName?: string } {
    if (filename === 'memory_user.md') {
      return { type: 'user' };
    }
    if (filename === 'memory_facts.md') {
      return { type: 'facts' };
    }
    if (filename.startsWith('memory_project_')) {
      const projectName = filename.replace('memory_project_', '').replace('.md', '');
      return { type: 'project', projectName };
    }
    return { type: 'facts' }; // fallback
  }

  private getLabel(type: BlockType, projectName?: string): string {
    if (type === 'project') {
      return `project:${projectName}`;
    }
    return type;
  }

  private getDescription(type: BlockType): string {
    switch (type) {
      case 'user':
        return 'User preferences, name, coding style, and personal context';
      case 'facts':
        return 'Recent facts extracted from conversations';
      case 'project':
        return 'Project-specific context, tech stack, and goals';
    }
  }

  // --- Memory Compilation (for prompt injection) ---

  /**
   * Compile all memory blocks into XML context for prompt injection.
   */
  async compileMemoryContext(): Promise<string> {
    const blocks = await this.getAllBlocks();
    if (blocks.length === 0) {
      return '';
    }

    let context = '<Memory>\n';

    for (const block of blocks) {
      if (!block.content.trim()) {
        continue;
      }

      context += `<${block.label}>\n`;
      context += `<description>${block.description}</description>\n`;
      context += `<content>\n${block.content}\n</content>\n`;
      context += `</${block.label}>\n`;
    }

    context += '</Memory>';
    return context;
  }
}
