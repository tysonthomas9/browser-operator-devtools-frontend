// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { createLogger } from '../../../core/Logger.js';
import { LLMConfigurationManager } from '../../../core/LLMConfigurationManager.js';
import { LLMClient } from '../../../LLM/LLMClient.js';
import { MiniAppStorageManager } from '../../MiniAppStorageManager.js';
import type {
  MiniApp,
  MiniAppSPA,
  MiniAppController,
  MiniAppBridge,
  MiniAppState,
  MiniAppActionSchema,
  MiniAppStateSchema,
  SPAToDevToolsAction,
} from '../../types/MiniAppTypes.js';
import { FileManagerSPA } from './FileManagerSPA.js';

const logger = createLogger('FileManagerMiniApp');

// ============================================================================
// Data Types
// ============================================================================

interface Document {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  mimeType: 'text/markdown' | 'text/plain';
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  aiMetadata?: {
    summary?: string;
    keywords?: string[];
    category?: string;
    lastAnalyzedAt?: string;
  };
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;  // Count of documents + subfolders in this folder
}

interface DocumentIndex {
  id: string;
  title: string;
  folderId: string | null;
  tags: string[];
  updatedAt: string;
  wordCount: number;
  preview: string;
}

// ============================================================================
// FileManagerMiniApp
// ============================================================================

export class FileManagerMiniApp implements MiniApp {
  id = 'file_manager';
  name = 'File Manager';
  description = 'AI-powered personal document management workspace. Create, organize, and analyze markdown documents with AI assistance for summarization, tagging, and writing.';
  icon = '📁';

  routes = [
    { name: 'browser', pattern: '#file-manager' },
    { name: 'folder', pattern: '#file-manager/folder/:folderId' },
    { name: 'document', pattern: '#file-manager/doc/:docId' },
    { name: 'search', pattern: '#file-manager/search/:query' },
  ];

  getSPA(): MiniAppSPA {
    return {
      html: FileManagerSPA.html,
      css: FileManagerSPA.css,
      js: FileManagerSPA.js,
    };
  }

  getSupportedActions(): MiniAppActionSchema[] {
    return [
      // CRUD Operations
      {
        name: 'create-document',
        description: 'Create a new document',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Document title' },
            content: { type: 'string', description: 'Initial content (markdown)' },
            folderId: { type: 'string', description: 'Parent folder ID (null for root)' },
            tags: { type: 'array', description: 'Initial tags' },
          },
          required: ['title'],
        },
      },
      {
        name: 'read-document',
        description: 'Get full document content',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'update-document',
        description: 'Update document content or metadata',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            title: { type: 'string', description: 'New title' },
            content: { type: 'string', description: 'New content' },
            tags: { type: 'array', description: 'New tags' },
            folderId: { type: 'string', description: 'New folder ID' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'delete-document',
        description: 'Delete a document',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'create-folder',
        description: 'Create a new folder',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Folder name' },
            parentId: { type: 'string', description: 'Parent folder ID (null for root)' },
            color: { type: 'string', description: 'Folder color' },
            icon: { type: 'string', description: 'Folder icon emoji' },
          },
          required: ['name'],
        },
      },
      {
        name: 'delete-folder',
        description: 'Delete a folder (moves contents to parent)',
        schema: {
          type: 'object',
          properties: {
            folderId: { type: 'string', description: 'Folder ID' },
          },
          required: ['folderId'],
        },
      },
      {
        name: 'rename-folder',
        description: 'Rename a folder',
        schema: {
          type: 'object',
          properties: {
            folderId: { type: 'string', description: 'Folder ID' },
            name: { type: 'string', description: 'New name' },
          },
          required: ['folderId', 'name'],
        },
      },
      // Organization Actions
      {
        name: 'move-document',
        description: 'Move document to a folder',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            folderId: { type: 'string', description: 'Target folder ID (null for root)' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'add-tag',
        description: 'Add a tag to a document',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            tag: { type: 'string', description: 'Tag to add' },
          },
          required: ['docId', 'tag'],
        },
      },
      {
        name: 'remove-tag',
        description: 'Remove a tag from a document',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            tag: { type: 'string', description: 'Tag to remove' },
          },
          required: ['docId', 'tag'],
        },
      },
      {
        name: 'auto-categorize',
        description: 'AI categorizes and tags a document',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
          },
          required: ['docId'],
        },
      },
      // Analysis Actions
      {
        name: 'summarize',
        description: 'Generate AI summary of a document',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            length: { type: 'string', description: 'Summary length: short, medium, long' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'extract-keywords',
        description: 'Extract key topics and terms from a document',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'answer-question',
        description: 'Answer a question about document content',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            question: { type: 'string', description: 'Question to answer' },
          },
          required: ['docId', 'question'],
        },
      },
      // Writing Actions
      {
        name: 'create-draft',
        description: 'Create a document draft from a prompt',
        schema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Writing prompt' },
            folderId: { type: 'string', description: 'Folder to create in' },
            title: { type: 'string', description: 'Document title' },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'improve-writing',
        description: 'Improve writing quality',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            aspect: { type: 'string', description: 'Aspect to improve: clarity, grammar, style' },
          },
          required: ['docId'],
        },
      },
      {
        name: 'expand-content',
        description: 'Expand on existing content',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            section: { type: 'string', description: 'Section to expand' },
          },
          required: ['docId'],
        },
      },
      // Navigation Actions
      {
        name: 'list-documents',
        description: 'List documents with optional filters',
        schema: {
          type: 'object',
          properties: {
            folderId: { type: 'string', description: 'Filter by folder' },
            tag: { type: 'string', description: 'Filter by tag' },
            limit: { type: 'number', description: 'Max results' },
            sortBy: { type: 'string', description: 'Sort by: name, updated, created' },
          },
        },
      },
      {
        name: 'search',
        description: 'Search documents by content',
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            folderId: { type: 'string', description: 'Search within folder' },
            tags: { type: 'array', description: 'Filter by tags' },
          },
          required: ['query'],
        },
      },
      {
        name: 'list-folders',
        description: 'List all folders',
        schema: {
          type: 'object',
          properties: {
            parentId: { type: 'string', description: 'List children of folder' },
          },
        },
      },
      {
        name: 'list-tags',
        description: 'List all unique tags',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list-recent',
        description: 'List recently accessed documents',
        schema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max results' },
          },
        },
      },
      // Import/Export Actions
      {
        name: 'import-file',
        description: 'Import a file from the local filesystem',
        schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'export-file',
        description: 'Export a document to a file',
        schema: {
          type: 'object',
          properties: {
            docId: { type: 'string', description: 'Document ID' },
            format: { type: 'string', description: 'Export format: md, txt' },
          },
          required: ['docId'],
        },
      },
    ];
  }

  getStateSchema(): MiniAppStateSchema {
    return {
      type: 'object',
      properties: {
        currentView: {
          type: 'string',
          description: 'Current view: browser, document, search',
        },
        currentFolderId: {
          type: 'string',
          description: 'ID of currently viewed folder (null for root)',
        },
        currentDocumentId: {
          type: 'string',
          description: 'ID of currently open document',
        },
        documents: {
          type: 'array',
          description: 'Documents in current view',
        },
        folders: {
          type: 'array',
          description: 'Folders in current folder',
        },
        allTags: {
          type: 'array',
          description: 'All unique tags',
        },
        searchQuery: {
          type: 'string',
          description: 'Current search query',
        },
        searchResults: {
          type: 'array',
          description: 'Search results',
        },
        recentDocuments: {
          type: 'array',
          description: 'Recently accessed documents',
        },
        folderPath: {
          type: 'array',
          description: 'Breadcrumb path to current folder',
        },
        currentDocument: {
          type: 'object',
          description: 'Full content of currently open document',
        },
        isEditing: {
          type: 'boolean',
          description: 'Whether document is being edited',
        },
        hasUnsavedChanges: {
          type: 'boolean',
          description: 'Whether there are unsaved changes',
        },
      },
    };
  }

  createController(): MiniAppController {
    return new FileManagerController();
  }
}

// ============================================================================
// FileManagerController
// ============================================================================

class FileManagerController implements MiniAppController {
  private bridge: MiniAppBridge | null = null;
  private closeCallback: (() => void | Promise<void>) | null = null;

  // View state
  private currentView: 'browser' | 'document' | 'search' = 'browser';
  private currentFolderId: string | null = null;
  private currentDocumentId: string | null = null;
  private currentDocument: Document | null = null;
  private searchQuery: string = '';
  private searchResults: DocumentIndex[] = [];
  private isEditing: boolean = false;
  private hasUnsavedChanges: boolean = false;

  // Storage
  private readonly STORAGE_PREFIX = 'file_manager';
  private readonly DOCUMENTS_INDEX_KEY = 'documents_index';
  private readonly FOLDERS_INDEX_KEY = 'folders_index';
  private readonly RECENT_KEY = 'recent_documents';
  private readonly SETTINGS_KEY = 'settings';

  async initialize(bridge: MiniAppBridge): Promise<void> {
    this.bridge = bridge;
    bridge.onAction(this.handleAction.bind(this));
    logger.info('FileManagerController initialized');
  }

  async cleanup(): Promise<void> {
    this.bridge = null;
    this.currentDocument = null;
    this.currentView = 'browser';
    this.currentFolderId = null;
    this.currentDocumentId = null;
    logger.info('FileManagerController cleaned up');
  }

  onClose(callback: () => void | Promise<void>): void {
    this.closeCallback = callback;
  }

  async getState(): Promise<MiniAppState> {
    const documents = await this.getDocumentsInFolder(this.currentFolderId);
    const folders = await this.getFoldersInFolder(this.currentFolderId);
    const allTags = await this.getAllTags();
    const recentDocuments = await this.getRecentDocuments();
    const folderPath = await this.getFolderPath(this.currentFolderId);

    return {
      currentView: this.currentView,
      currentFolderId: this.currentFolderId,
      currentDocumentId: this.currentDocumentId,
      currentDocument: this.currentDocument,
      documents,
      folders,
      allTags,
      searchQuery: this.searchQuery,
      searchResults: this.searchResults,
      recentDocuments,
      folderPath,
      isEditing: this.isEditing,
      hasUnsavedChanges: this.hasUnsavedChanges,
    };
  }

  async setState(state: MiniAppState): Promise<void> {
    if (state.currentView) {
      this.currentView = state.currentView as 'browser' | 'document' | 'search';
    }
    if (state.currentFolderId !== undefined) {
      this.currentFolderId = state.currentFolderId as string | null;
    }
    if (state.currentDocumentId !== undefined) {
      this.currentDocumentId = state.currentDocumentId as string | null;
    }
  }

  async updateState(updates: Partial<MiniAppState>): Promise<void> {
    if (updates.currentView) {
      this.currentView = updates.currentView as 'browser' | 'document' | 'search';
    }
    if (updates.currentFolderId !== undefined) {
      this.currentFolderId = updates.currentFolderId as string | null;
    }
    if (updates.currentDocumentId !== undefined) {
      this.currentDocumentId = updates.currentDocumentId as string | null;
    }
    if (updates.isEditing !== undefined) {
      this.isEditing = updates.isEditing as boolean;
    }
    if (updates.hasUnsavedChanges !== undefined) {
      this.hasUnsavedChanges = updates.hasUnsavedChanges as boolean;
    }
  }

  async executeAction(actionName: string, args: unknown): Promise<unknown> {
    const argsObj = args as Record<string, unknown>;

    switch (actionName) {
      // CRUD
      case 'create-document':
        return this.createDocument(
          argsObj.title as string,
          argsObj.content as string | undefined,
          argsObj.folderId as string | null | undefined,
          argsObj.tags as string[] | undefined
        );
      case 'read-document':
        return this.readDocument(argsObj.docId as string);
      case 'update-document':
        return this.updateDocument(argsObj.docId as string, argsObj);
      case 'delete-document':
        return this.deleteDocument(argsObj.docId as string);
      case 'create-folder':
        return this.createFolder(
          argsObj.name as string,
          argsObj.parentId as string | null | undefined,
          argsObj.color as string | undefined,
          argsObj.icon as string | undefined
        );
      case 'delete-folder':
        return this.deleteFolder(argsObj.folderId as string);
      case 'rename-folder':
        return this.renameFolder(argsObj.folderId as string, argsObj.name as string);

      // Organization
      case 'move-document':
        return this.moveDocument(argsObj.docId as string, argsObj.folderId as string | null);
      case 'add-tag':
        return this.addTag(argsObj.docId as string, argsObj.tag as string);
      case 'remove-tag':
        return this.removeTag(argsObj.docId as string, argsObj.tag as string);
      case 'auto-categorize':
        return this.autoCategorize(argsObj.docId as string);

      // Analysis
      case 'summarize':
        return this.summarizeDocument(argsObj.docId as string, argsObj.length as string | undefined);
      case 'extract-keywords':
        return this.extractKeywords(argsObj.docId as string);
      case 'answer-question':
        return this.answerQuestion(argsObj.docId as string, argsObj.question as string);

      // Writing
      case 'create-draft':
        return this.createDraft(
          argsObj.prompt as string,
          argsObj.folderId as string | undefined,
          argsObj.title as string | undefined
        );
      case 'improve-writing':
        return this.improveWriting(argsObj.docId as string, argsObj.aspect as string | undefined);
      case 'expand-content':
        return this.expandContent(argsObj.docId as string, argsObj.section as string | undefined);

      // Navigation
      case 'list-documents':
        return this.listDocuments(argsObj);
      case 'search':
        return this.searchDocuments(argsObj.query as string, argsObj);
      case 'list-folders':
        return this.listFolders(argsObj.parentId as string | undefined);
      case 'list-tags':
        return { tags: await this.getAllTags() };
      case 'list-recent':
        return { documents: await this.getRecentDocuments(argsObj.limit as number | undefined) };

      // Import/Export
      case 'import-file':
        return this.importFile();
      case 'export-file':
        return this.exportFile(argsObj.docId as string, argsObj.format as string | undefined);

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  // ============================================================================
  // SPA Action Handlers
  // ============================================================================

  private async handleAction(action: SPAToDevToolsAction): Promise<void> {
    logger.info(`>>> FileManager handleAction: ${action.type}`, action);

    switch (action.type) {
      case 'ready':
        await this.pushStateToSPA();
        break;

      case 'close':
        if (this.closeCallback) {
          await this.closeCallback();
        }
        break;

      case 'navigate-folder': {
        const data = action as SPAToDevToolsAction & { folderId: string | null };
        this.currentFolderId = data.folderId;
        this.currentView = 'browser';
        await this.pushStateToSPA();
        break;
      }

      case 'open-document': {
        const data = action as SPAToDevToolsAction & { docId: string };
        await this.openDocument(data.docId);
        break;
      }

      case 'close-document':
        this.currentDocument = null;
        this.currentDocumentId = null;
        this.currentView = 'browser';
        this.isEditing = false;
        this.hasUnsavedChanges = false;
        await this.pushStateToSPA();
        break;

      case 'create-document': {
        const data = action as SPAToDevToolsAction & {
          title: string;
          content?: string;
          folderId?: string | null;
          tags?: string[];
        };
        const doc = await this.createDocument(data.title, data.content, data.folderId, data.tags);
        await this.openDocument(doc.id);
        break;
      }

      case 'save-document': {
        const data = action as SPAToDevToolsAction & {
          docId: string;
          title: string;
          content: string;
          tags: string[];
        };
        await this.updateDocument(data.docId, {
          title: data.title,
          content: data.content,
          tags: data.tags,
        });
        this.hasUnsavedChanges = false;
        await this.pushStateToSPA();
        break;
      }

      case 'delete-document': {
        const data = action as SPAToDevToolsAction & { docId: string };
        await this.deleteDocument(data.docId);
        if (this.currentDocumentId === data.docId) {
          this.currentDocument = null;
          this.currentDocumentId = null;
          this.currentView = 'browser';
        }
        await this.pushStateToSPA();
        break;
      }

      case 'create-folder': {
        const data = action as SPAToDevToolsAction & {
          name: string;
          parentId?: string | null;
        };
        await this.createFolder(data.name, data.parentId);
        await this.pushStateToSPA();
        break;
      }

      case 'delete-folder': {
        const data = action as SPAToDevToolsAction & { folderId: string };
        await this.deleteFolder(data.folderId);
        await this.pushStateToSPA();
        break;
      }

      case 'rename-folder': {
        const data = action as SPAToDevToolsAction & { folderId: string; name: string };
        await this.renameFolder(data.folderId, data.name);
        await this.pushStateToSPA();
        break;
      }

      case 'search': {
        const data = action as SPAToDevToolsAction & { query: string };
        const results = await this.searchDocuments(data.query, {});
        this.searchQuery = data.query;
        this.searchResults = results.documents;
        this.currentView = 'search';
        await this.pushStateToSPA();
        break;
      }

      case 'add-tag': {
        const data = action as SPAToDevToolsAction & { docId: string; tag: string };
        await this.addTag(data.docId, data.tag);
        if (this.currentDocumentId === data.docId) {
          this.currentDocument = await this.readDocument(data.docId);
        }
        await this.pushStateToSPA();
        break;
      }

      case 'remove-tag': {
        const data = action as SPAToDevToolsAction & { docId: string; tag: string };
        await this.removeTag(data.docId, data.tag);
        if (this.currentDocumentId === data.docId) {
          this.currentDocument = await this.readDocument(data.docId);
        }
        await this.pushStateToSPA();
        break;
      }

      case 'ai-summarize': {
        const data = action as SPAToDevToolsAction & { docId: string };
        const result = await this.summarizeDocument(data.docId, 'medium');
        await this.pushStateToSPA();
        // Send summary result back
        if (this.bridge) {
          await this.bridge.sendToSPA({
            action: 'ai-result',
            payload: { type: 'summary', result },
          });
        }
        break;
      }

      case 'ai-improve': {
        const data = action as SPAToDevToolsAction & { docId: string };
        const result = await this.improveWriting(data.docId, 'clarity');
        if (this.currentDocumentId === data.docId) {
          this.currentDocument = await this.readDocument(data.docId);
        }
        await this.pushStateToSPA();
        if (this.bridge) {
          await this.bridge.sendToSPA({
            action: 'ai-result',
            payload: { type: 'improve', result },
          });
        }
        break;
      }

      case 'ai-expand': {
        const data = action as SPAToDevToolsAction & { docId: string };
        const result = await this.expandContent(data.docId);
        if (this.currentDocumentId === data.docId) {
          this.currentDocument = await this.readDocument(data.docId);
        }
        await this.pushStateToSPA();
        if (this.bridge) {
          await this.bridge.sendToSPA({
            action: 'ai-result',
            payload: { type: 'expand', result },
          });
        }
        break;
      }

      case 'content-changed':
        this.hasUnsavedChanges = true;
        break;

      case 'import-file':
        // Import is handled via File System Access API in the SPA
        break;

      case 'file-imported': {
        const data = action as SPAToDevToolsAction & {
          title: string;
          content: string;
        };
        const doc = await this.createDocument(data.title, data.content, this.currentFolderId);
        await this.openDocument(doc.id);
        break;
      }

      default:
        logger.warn('Unknown action type:', action.type);
    }
  }

  // ============================================================================
  // Document Operations
  // ============================================================================

  private async createDocument(
    title: string,
    content?: string,
    folderId?: string | null,
    tags?: string[]
  ): Promise<Document> {
    const now = new Date().toISOString();
    const docContent = content || '';

    const doc: Document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title,
      content: docContent,
      folderId: folderId ?? this.currentFolderId,
      tags: tags || [],
      mimeType: 'text/markdown',
      createdAt: now,
      updatedAt: now,
      wordCount: this.countWords(docContent),
    };

    const storage = MiniAppStorageManager.getInstance();
    await storage.set(this.STORAGE_PREFIX, doc.id, doc);
    await this.updateDocumentIndex(doc);
    await this.addToRecent(doc.id);

    logger.info('Created document:', doc.id);
    return doc;
  }

  private async readDocument(docId: string): Promise<Document> {
    const storage = MiniAppStorageManager.getInstance();
    const doc = await storage.get(this.STORAGE_PREFIX, docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }
    await this.addToRecent(docId);
    return doc as Document;
  }

  private async updateDocument(docId: string, updates: Record<string, unknown>): Promise<Document> {
    const doc = await this.readDocument(docId);

    if (updates.title !== undefined) {
      doc.title = updates.title as string;
    }
    if (updates.content !== undefined) {
      doc.content = updates.content as string;
      doc.wordCount = this.countWords(doc.content);
    }
    if (updates.tags !== undefined) {
      doc.tags = updates.tags as string[];
    }
    if (updates.folderId !== undefined) {
      doc.folderId = updates.folderId as string | null;
    }
    doc.updatedAt = new Date().toISOString();

    const storage = MiniAppStorageManager.getInstance();
    await storage.set(this.STORAGE_PREFIX, doc.id, doc);
    await this.updateDocumentIndex(doc);

    // Update current document if it's the same
    if (this.currentDocumentId === docId) {
      this.currentDocument = doc;
    }

    logger.info('Updated document:', doc.id);
    return doc;
  }

  private async deleteDocument(docId: string): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();
    await storage.delete(this.STORAGE_PREFIX, docId);
    await this.removeFromDocumentIndex(docId);
    await this.removeFromRecent(docId);
    logger.info('Deleted document:', docId);
  }

  private async openDocument(docId: string): Promise<void> {
    this.currentDocument = await this.readDocument(docId);
    this.currentDocumentId = docId;
    this.currentView = 'document';
    this.isEditing = false;
    this.hasUnsavedChanges = false;
    await this.pushStateToSPA();
  }

  // ============================================================================
  // Folder Operations
  // ============================================================================

  private async createFolder(
    name: string,
    parentId?: string | null,
    color?: string,
    icon?: string
  ): Promise<Folder> {
    const now = new Date().toISOString();

    const folder: Folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      parentId: parentId ?? this.currentFolderId ?? null,
      color,
      icon,
      createdAt: now,
      updatedAt: now,
    };

    const storage = MiniAppStorageManager.getInstance();
    const folders = await this.getAllFolders();
    folders.push(folder);
    await storage.set(this.STORAGE_PREFIX, this.FOLDERS_INDEX_KEY, folders);

    logger.info('Created folder:', folder.id);
    return folder;
  }

  private async deleteFolder(folderId: string): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();

    // Get folder to find parent
    const folders = await this.getAllFolders();
    const folder = folders.find(f => f.id === folderId);
    const parentId = folder?.parentId ?? null;

    // Move all documents in this folder to parent
    const documents = await this.getDocumentsIndex();
    for (const doc of documents) {
      if (doc.folderId === folderId) {
        await this.moveDocument(doc.id, parentId);
      }
    }

    // Move child folders to parent
    for (const f of folders) {
      if (f.parentId === folderId) {
        f.parentId = parentId;
      }
    }

    // Remove the folder
    const newFolders = folders.filter(f => f.id !== folderId);
    await storage.set(this.STORAGE_PREFIX, this.FOLDERS_INDEX_KEY, newFolders);

    logger.info('Deleted folder:', folderId);
  }

  private async renameFolder(folderId: string, name: string): Promise<Folder> {
    const storage = MiniAppStorageManager.getInstance();
    const folders = await this.getAllFolders();
    const folder = folders.find(f => f.id === folderId);

    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    folder.name = name;
    folder.updatedAt = new Date().toISOString();

    await storage.set(this.STORAGE_PREFIX, this.FOLDERS_INDEX_KEY, folders);
    logger.info('Renamed folder:', folderId);
    return folder;
  }

  private async getAllFolders(): Promise<Folder[]> {
    const storage = MiniAppStorageManager.getInstance();
    const folders = await storage.get(this.STORAGE_PREFIX, this.FOLDERS_INDEX_KEY);
    return (folders as Folder[]) || [];
  }

  private async getFoldersInFolder(folderId: string | null): Promise<Folder[]> {
    const allFolders = await this.getAllFolders();
    const allDocuments = await this.getDocumentsIndex();
    const filtered = allFolders.filter(f => f.parentId === folderId);

    // Add item counts to each folder
    return filtered.map(folder => ({
      ...folder,
      itemCount: this.countItemsInFolder(folder.id, allDocuments, allFolders),
    }));
  }

  /**
   * Count documents + subfolders directly contained in a folder
   */
  private countItemsInFolder(
    folderId: string,
    documents: DocumentIndex[],
    folders: Folder[]
  ): number {
    const docCount = documents.filter(d => d.folderId === folderId).length;
    const folderCount = folders.filter(f => f.parentId === folderId).length;
    return docCount + folderCount;
  }

  private async listFolders(parentId?: string): Promise<{ folders: Folder[] }> {
    const folders = await this.getAllFolders();
    if (parentId !== undefined) {
      return { folders: folders.filter(f => f.parentId === parentId) };
    }
    return { folders };
  }

  private async getFolderPath(folderId: string | null): Promise<Folder[]> {
    if (!folderId) {
      return [];
    }

    const folders = await this.getAllFolders();
    const path: Folder[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (folder) {
        path.unshift(folder);
        currentId = folder.parentId;
      } else {
        break;
      }
    }

    return path;
  }

  // ============================================================================
  // Organization Operations
  // ============================================================================

  private async moveDocument(docId: string, folderId: string | null): Promise<Document> {
    return this.updateDocument(docId, { folderId });
  }

  private async addTag(docId: string, tag: string): Promise<Document> {
    const doc = await this.readDocument(docId);
    if (!doc.tags.includes(tag)) {
      doc.tags.push(tag);
      return this.updateDocument(docId, { tags: doc.tags });
    }
    return doc;
  }

  private async removeTag(docId: string, tag: string): Promise<Document> {
    const doc = await this.readDocument(docId);
    doc.tags = doc.tags.filter(t => t !== tag);
    return this.updateDocument(docId, { tags: doc.tags });
  }

  private async autoCategorize(docId: string): Promise<{ tags: string[]; category: string }> {
    const doc = await this.readDocument(docId);

    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMiniModel(),
      systemPrompt: 'You are a document categorizer. Analyze the document and suggest 3-5 relevant tags and a category. Respond in JSON format: { "tags": ["tag1", "tag2"], "category": "Category Name" }',
      messages: [
        {
          role: 'user',
          content: `Title: ${doc.title}\n\nContent:\n${doc.content.substring(0, 2000)}`,
        },
      ],
    });

    try {
      const content = response.text || '{}';
      const result = JSON.parse(content);
      const tags = result.tags || [];
      const category = result.category || 'Uncategorized';

      // Add new tags
      const newTags = [...new Set([...doc.tags, ...tags])];
      await this.updateDocument(docId, {
        tags: newTags,
        aiMetadata: {
          ...doc.aiMetadata,
          category,
          keywords: tags,
          lastAnalyzedAt: new Date().toISOString(),
        },
      });

      return { tags, category };
    } catch {
      logger.error('Failed to parse AI categorization response');
      return { tags: [], category: 'Uncategorized' };
    }
  }

  // ============================================================================
  // AI Analysis Operations
  // ============================================================================

  private async summarizeDocument(
    docId: string,
    length: string = 'medium'
  ): Promise<{ summary: string }> {
    const doc = await this.readDocument(docId);

    const lengthInstructions: Record<string, string> = {
      short: '1-2 sentences',
      medium: '3-5 sentences',
      long: '1-2 paragraphs',
    };

    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMiniModel(),
      systemPrompt: `You are a document summarizer. Create a ${lengthInstructions[length] || lengthInstructions.medium} summary of the document. Be concise and capture the key points.`,
      messages: [
        {
          role: 'user',
          content: `Title: ${doc.title}\n\n${doc.content}`,
        },
      ],
    });

    const summary = response.text || 'Unable to generate summary.';

    // Cache the summary
    await this.updateDocument(docId, {
      aiMetadata: {
        ...doc.aiMetadata,
        summary,
        lastAnalyzedAt: new Date().toISOString(),
      },
    });

    return { summary };
  }

  private async extractKeywords(docId: string): Promise<{ keywords: string[] }> {
    const doc = await this.readDocument(docId);

    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMiniModel(),
      systemPrompt: 'Extract 5-10 key topics and terms from the document. Respond with a JSON array of strings: ["keyword1", "keyword2", ...]',
      messages: [
        {
          role: 'user',
          content: `Title: ${doc.title}\n\n${doc.content}`,
        },
      ],
    });

    try {
      const content = response.text || '[]';
      const keywords = JSON.parse(content);

      await this.updateDocument(docId, {
        aiMetadata: {
          ...doc.aiMetadata,
          keywords,
          lastAnalyzedAt: new Date().toISOString(),
        },
      });

      return { keywords };
    } catch {
      return { keywords: [] };
    }
  }

  private async answerQuestion(docId: string, question: string): Promise<{ answer: string }> {
    const doc = await this.readDocument(docId);

    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMainModel(),
      systemPrompt: 'You are a helpful assistant. Answer the question based on the document content. If the answer is not in the document, say so.',
      messages: [
        {
          role: 'user',
          content: `Document Title: ${doc.title}\n\nDocument Content:\n${doc.content}\n\nQuestion: ${question}`,
        },
      ],
    });

    const answer = response.text || 'Unable to answer the question.';
    return { answer };
  }

  // ============================================================================
  // AI Writing Operations
  // ============================================================================

  private async createDraft(
    prompt: string,
    folderId?: string,
    title?: string
  ): Promise<Document> {
    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMainModel(),
      systemPrompt: 'You are a professional writer. Create well-structured markdown content based on the prompt. Include appropriate headings, sections, and formatting.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.text || '';
    const docTitle = title || this.generateTitleFromPrompt(prompt);

    return this.createDocument(docTitle, content, folderId);
  }

  private async improveWriting(
    docId: string,
    aspect: string = 'clarity'
  ): Promise<{ improved: boolean; changes: string }> {
    const doc = await this.readDocument(docId);

    const aspectInstructions: Record<string, string> = {
      clarity: 'Improve clarity and readability. Make sentences clearer and more concise.',
      grammar: 'Fix grammar, spelling, and punctuation errors.',
      style: 'Improve writing style. Make it more engaging and professional.',
    };

    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMainModel(),
      systemPrompt: `You are a professional editor. ${aspectInstructions[aspect] || aspectInstructions.clarity} Return the improved markdown content only, no explanations.`,
      messages: [
        {
          role: 'user',
          content: doc.content,
        },
      ],
    });

    const improvedContent = response.text || doc.content;

    await this.updateDocument(docId, { content: improvedContent });

    return {
      improved: true,
      changes: `Improved ${aspect}`,
    };
  }

  private async expandContent(
    docId: string,
    section?: string
  ): Promise<{ expanded: boolean }> {
    const doc = await this.readDocument(docId);

    const llmClient = LLMClient.getInstance();
    const configManager = LLMConfigurationManager.getInstance();

    const prompt = section
      ? `Expand on the "${section}" section of this document. Add more detail, examples, and explanation while maintaining the existing structure and style.`
      : 'Expand on the content of this document. Add more detail, examples, and explanation while maintaining the existing structure and style. Continue from where it ends.';

    const response = await llmClient.call({
      provider: configManager.getProvider(),
      model: configManager.getMainModel(),
      systemPrompt: 'You are a professional writer. Expand the content as requested. Return the full expanded markdown content.',
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nCurrent content:\n${doc.content}`,
        },
      ],
    });

    const expandedContent = response.text || doc.content;

    await this.updateDocument(docId, { content: expandedContent });

    return { expanded: true };
  }

  // ============================================================================
  // Search and Index Operations
  // ============================================================================

  private async getDocumentsIndex(): Promise<DocumentIndex[]> {
    const storage = MiniAppStorageManager.getInstance();
    const index = await storage.get(this.STORAGE_PREFIX, this.DOCUMENTS_INDEX_KEY);
    return (index as DocumentIndex[]) || [];
  }

  private async updateDocumentIndex(doc: Document): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();
    const index = await this.getDocumentsIndex();

    const entry: DocumentIndex = {
      id: doc.id,
      title: doc.title,
      folderId: doc.folderId,
      tags: doc.tags,
      updatedAt: doc.updatedAt,
      wordCount: doc.wordCount,
      preview: doc.content.substring(0, 200),
    };

    const existingIndex = index.findIndex(d => d.id === doc.id);
    if (existingIndex >= 0) {
      index[existingIndex] = entry;
    } else {
      index.push(entry);
    }

    await storage.set(this.STORAGE_PREFIX, this.DOCUMENTS_INDEX_KEY, index);
  }

  private async removeFromDocumentIndex(docId: string): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();
    const index = await this.getDocumentsIndex();
    const newIndex = index.filter(d => d.id !== docId);
    await storage.set(this.STORAGE_PREFIX, this.DOCUMENTS_INDEX_KEY, newIndex);
  }

  private async getDocumentsInFolder(folderId: string | null): Promise<DocumentIndex[]> {
    const index = await this.getDocumentsIndex();
    return index
      .filter(d => d.folderId === folderId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private async listDocuments(filters: Record<string, unknown>): Promise<{ documents: DocumentIndex[] }> {
    let documents = await this.getDocumentsIndex();

    if (filters.folderId !== undefined) {
      documents = documents.filter(d => d.folderId === filters.folderId);
    }
    if (filters.tag) {
      documents = documents.filter(d => d.tags.includes(filters.tag as string));
    }

    const sortBy = (filters.sortBy as string) || 'updated';
    documents.sort((a, b) => {
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    if (filters.limit) {
      documents = documents.slice(0, filters.limit as number);
    }

    return { documents };
  }

  private async searchDocuments(
    query: string,
    filters: Record<string, unknown>
  ): Promise<{ documents: DocumentIndex[] }> {
    const storage = MiniAppStorageManager.getInstance();
    const index = await this.getDocumentsIndex();
    const queryLower = query.toLowerCase();

    const results: DocumentIndex[] = [];

    for (const docMeta of index) {
      // Apply filters
      if (filters.folderId && docMeta.folderId !== filters.folderId) {
        continue;
      }
      if (filters.tags && Array.isArray(filters.tags)) {
        const hasAllTags = (filters.tags as string[]).every(t => docMeta.tags.includes(t));
        if (!hasAllTags) {
          continue;
        }
      }

      // Check title match
      if (docMeta.title.toLowerCase().includes(queryLower)) {
        results.push(docMeta);
        continue;
      }

      // Check preview match
      if (docMeta.preview.toLowerCase().includes(queryLower)) {
        results.push(docMeta);
        continue;
      }

      // Check full content
      const doc = await storage.get(this.STORAGE_PREFIX, docMeta.id);
      if (doc && (doc as Document).content.toLowerCase().includes(queryLower)) {
        results.push(docMeta);
      }
    }

    return { documents: results };
  }

  private async getAllTags(): Promise<string[]> {
    const index = await this.getDocumentsIndex();
    const tagSet = new Set<string>();
    for (const doc of index) {
      for (const tag of doc.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }

  // ============================================================================
  // Recent Documents
  // ============================================================================

  private async getRecentDocuments(limit: number = 10): Promise<DocumentIndex[]> {
    const storage = MiniAppStorageManager.getInstance();
    const recentIds = (await storage.get(this.STORAGE_PREFIX, this.RECENT_KEY)) as string[] || [];
    const index = await this.getDocumentsIndex();

    const recent: DocumentIndex[] = [];
    for (const id of recentIds.slice(0, limit)) {
      const doc = index.find(d => d.id === id);
      if (doc) {
        recent.push(doc);
      }
    }

    return recent;
  }

  private async addToRecent(docId: string): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();
    let recentIds = (await storage.get(this.STORAGE_PREFIX, this.RECENT_KEY)) as string[] || [];

    // Remove if already exists, then add to front
    recentIds = recentIds.filter(id => id !== docId);
    recentIds.unshift(docId);

    // Keep only last 20
    recentIds = recentIds.slice(0, 20);

    await storage.set(this.STORAGE_PREFIX, this.RECENT_KEY, recentIds);
  }

  private async removeFromRecent(docId: string): Promise<void> {
    const storage = MiniAppStorageManager.getInstance();
    const recentIds = (await storage.get(this.STORAGE_PREFIX, this.RECENT_KEY)) as string[] || [];
    const newRecent = recentIds.filter(id => id !== docId);
    await storage.set(this.STORAGE_PREFIX, this.RECENT_KEY, newRecent);
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  private async importFile(): Promise<{ message: string }> {
    // Import is handled by the SPA using File System Access API
    // The SPA sends 'file-imported' action with the content
    return { message: 'Import initiated in browser' };
  }

  private async exportFile(
    docId: string,
    format: string = 'md'
  ): Promise<{ title: string; content: string; format: string }> {
    const doc = await this.readDocument(docId);
    return {
      title: doc.title,
      content: doc.content,
      format,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  private generateTitleFromPrompt(prompt: string): string {
    // Take first 50 chars, find a good break point
    const truncated = prompt.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    const title = lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated;
    return title + (prompt.length > 50 ? '...' : '');
  }

  private async pushStateToSPA(): Promise<void> {
    if (!this.bridge) {
      return;
    }

    try {
      const state = await this.getState();
      await this.bridge.sendToSPA({
        action: 'set-state',
        payload: state,
      });
    } catch (error) {
      logger.error('Failed to push state to SPA:', error);
    }
  }
}
