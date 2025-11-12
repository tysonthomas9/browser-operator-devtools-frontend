import { T as Tool } from '../utils-CPLTWdHl.cjs';
export { O as OpenAIFunctionDefinition, R as RuntimeContext, i as ToolCall, g as ToolCallResult, d as ToolExecutionContext, h as ToolExecutionOptions, f as ToolResult, c as ToolRuntimeContext, j as ToolSet, e as executeTool, b as executeToolCall, t as toolToOpenAIFunction, a as toolsToOpenAIFunctions, z as zodToOpenAISchema } from '../utils-CPLTWdHl.cjs';
export { C as CreateToolConfig, a as createSimpleTool, c as createTool } from '../createTool-D1YWm90c.cjs';
import { z } from 'zod';

/**
 * Shared runtime interfaces for tools
 * These interfaces define contracts for runtime dependencies that can be injected via runtimeContext
 */
/**
 * Interface for LLM provider that can generate text
 */
interface LLMProvider {
    /**
     * Generate text completion from messages
     */
    generateText(params: {
        model: string;
        messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string | Array<{
                type: string;
                [key: string]: unknown;
            }>;
        }>;
        systemPrompt?: string;
        temperature?: number;
        maxTokens?: number;
        abortSignal?: AbortSignal;
    }): Promise<{
        text: string;
        usage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
    }>;
}
/**
 * Interface for page content accessor
 */
interface PageContentAccessor {
    /**
     * Get current page URL
     */
    getURL(): Promise<string>;
    /**
     * Get page title
     */
    getTitle(): Promise<string>;
    /**
     * Get page HTML content
     */
    getHTML(): Promise<string>;
    /**
     * Get accessibility tree as text
     */
    getAccessibilityTree(): Promise<string>;
    /**
     * Take screenshot of current page
     */
    takeScreenshot(fullPage?: boolean): Promise<string>;
}
/**
 * Interface for page navigation
 */
interface NavigationManager {
    /**
     * Navigate to a URL
     */
    navigateTo(url: string): Promise<{
        success: boolean;
        url?: string;
        error?: string;
    }>;
    /**
     * Wait for page to be ready
     */
    waitForPageLoad(timeoutMs?: number): Promise<void>;
}
/**
 * Interface for vector database operations
 */
interface VectorDBClient {
    /**
     * Store a document with embeddings
     */
    store(document: {
        id?: string;
        content: string;
        metadata: {
            title: string;
            url: string;
            tags?: string[];
            [key: string]: unknown;
        };
    }): Promise<{
        success: boolean;
        id?: string;
        error?: string;
    }>;
    /**
     * Search for similar documents
     */
    search(query: string, options?: {
        limit?: number;
        filter?: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        results?: Array<{
            id: string;
            content: string;
            metadata: Record<string, unknown>;
            score: number;
        }>;
        error?: string;
    }>;
}
/**
 * Interface for HTML to Markdown conversion
 */
interface HTMLToMarkdownConverter {
    /**
     * Convert HTML content to clean markdown
     */
    convert(html: string, options?: {
        instruction?: string;
        baseURL?: string;
    }): Promise<{
        success: boolean;
        markdown?: string;
        error?: string;
    }>;
}

/**
 * Input schema for read file tool
 */
declare const readFileInputSchema: z.ZodObject<{
    fileName: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fileName: string;
    reasoning: string;
}, {
    fileName: string;
    reasoning: string;
}>;
/**
 * Output schema for read file tool
 * Using discriminated union for success/error cases
 */
declare const readFileOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    fileName: z.ZodString;
    content: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    size: number;
    content: string;
    success: true;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
}, {
    size: number;
    content: string;
    success: true;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type ReadFileInput = z.infer<typeof readFileInputSchema>;
type ReadFileOutput = z.infer<typeof readFileOutputSchema>;
/**
 * Interface for file storage manager that must be provided via runtime context
 * Supports all file operations: create, read, update, delete
 */
interface FileStorageManager {
    createFile(fileName: string, content: string, mimeType?: string): Promise<{
        id: string;
        fileName: string;
        content: string;
        mimeType: string;
        size: number;
        createdAt: number;
        updatedAt: number;
    }>;
    readFile(fileName: string): Promise<{
        fileName: string;
        content: string;
        mimeType: string;
        size: number;
        createdAt: number;
        updatedAt: number;
    } | null>;
    updateFile(fileName: string, content: string, append?: boolean): Promise<{
        id: string;
        fileName: string;
        content: string;
        mimeType: string;
        size: number;
        createdAt: number;
        updatedAt: number;
    }>;
    deleteFile(fileName: string): Promise<boolean>;
    listFiles(): Promise<Array<{
        fileName: string;
        mimeType: string;
        size: number;
        createdAt: number;
        updatedAt: number;
    }>>;
}
/**
 * Tool for reading files from session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * // Use with runtime context
 * const result = await agent.generateText({
 *   prompt: "Read the config file",
 *   tools: { readFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
declare const readFile: Tool<unknown, {
    size: number;
    content: string;
    success: true;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    fileName: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fileName: string;
    reasoning: string;
}, {
    fileName: string;
    reasoning: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    fileName: z.ZodString;
    content: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    size: number;
    content: string;
    success: true;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
}, {
    size: number;
    content: string;
    success: true;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

/**
 * Input schema for create file tool
 */
declare const createFileInputSchema: z.ZodObject<{
    fileName: z.ZodString;
    content: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    fileName: string;
    reasoning: string;
    mimeType?: string | undefined;
}, {
    content: string;
    fileName: string;
    reasoning: string;
    mimeType?: string | undefined;
}>;
/**
 * Output schema for create file tool
 * Using discriminated union for success/error cases
 */
declare const createFileOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    fileId: z.ZodString;
    fileName: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    fileName: string;
    fileId: string;
}, {
    message: string;
    success: true;
    fileName: string;
    fileId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type CreateFileInput = z.infer<typeof createFileInputSchema>;
type CreateFileOutput = z.infer<typeof createFileOutputSchema>;
/**
 * Tool for creating new files in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * // Use with runtime context
 * const result = await agent.generateText({
 *   prompt: "Create a config file",
 *   tools: { createFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
declare const createFile: Tool<unknown, {
    message: string;
    success: true;
    fileName: string;
    fileId: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    fileName: z.ZodString;
    content: z.ZodString;
    mimeType: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    fileName: string;
    reasoning: string;
    mimeType?: string | undefined;
}, {
    content: string;
    fileName: string;
    reasoning: string;
    mimeType?: string | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    fileId: z.ZodString;
    fileName: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    fileName: string;
    fileId: string;
}, {
    message: string;
    success: true;
    fileName: string;
    fileId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

/**
 * Input schema for update file tool
 */
declare const updateFileInputSchema: z.ZodObject<{
    fileName: z.ZodString;
    content: z.ZodString;
    append: z.ZodOptional<z.ZodBoolean>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    fileName: string;
    reasoning: string;
    append?: boolean | undefined;
}, {
    content: string;
    fileName: string;
    reasoning: string;
    append?: boolean | undefined;
}>;
/**
 * Output schema for update file tool
 * Using discriminated union for success/error cases
 */
declare const updateFileOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    fileId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    fileId: string;
}, {
    message: string;
    success: true;
    fileId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type UpdateFileInput = z.infer<typeof updateFileInputSchema>;
type UpdateFileOutput = z.infer<typeof updateFileOutputSchema>;
/**
 * Tool for updating existing files in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * // Replace content
 * const result = await agent.generateText({
 *   prompt: "Update the config file",
 *   tools: { updateFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 *
 * // Append content
 * const result = await agent.generateText({
 *   prompt: "Append to the log file",
 *   tools: { updateFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
declare const updateFile: Tool<unknown, {
    message: string;
    success: true;
    fileId: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    fileName: z.ZodString;
    content: z.ZodString;
    append: z.ZodOptional<z.ZodBoolean>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    fileName: string;
    reasoning: string;
    append?: boolean | undefined;
}, {
    content: string;
    fileName: string;
    reasoning: string;
    append?: boolean | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    fileId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    fileId: string;
}, {
    message: string;
    success: true;
    fileId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

/**
 * Input schema for delete file tool
 */
declare const deleteFileInputSchema: z.ZodObject<{
    fileName: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fileName: string;
    reasoning: string;
}, {
    fileName: string;
    reasoning: string;
}>;
/**
 * Output schema for delete file tool
 */
declare const deleteFileOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
}, {
    message: string;
    success: true;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type DeleteFileInput = z.infer<typeof deleteFileInputSchema>;
type DeleteFileOutput = z.infer<typeof deleteFileOutputSchema>;
/**
 * Tool for deleting files from session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * const result = await agent.generateText({
 *   prompt: "Delete the old config file",
 *   tools: { deleteFile },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
declare const deleteFile: Tool<unknown, {
    message: string;
    success: true;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    fileName: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fileName: string;
    reasoning: string;
}, {
    fileName: string;
    reasoning: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
}, {
    message: string;
    success: true;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

/**
 * Input schema for list files tool
 */
declare const listFilesInputSchema: z.ZodObject<{
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
}, {
    reasoning: string;
}>;
/**
 * File summary schema
 */
declare const fileSummarySchema: z.ZodObject<{
    fileName: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    size: number;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
}, {
    size: number;
    fileName: string;
    mimeType: string;
    createdAt: number;
    updatedAt: number;
}>;
/**
 * Output schema for list files tool
 */
declare const listFilesOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    files: z.ZodArray<z.ZodObject<{
        fileName: z.ZodString;
        mimeType: z.ZodString;
        size: z.ZodNumber;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }, {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }>, "many">;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    success: true;
    files: {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }[];
    count: number;
}, {
    success: true;
    files: {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }[];
    count: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type ListFilesInput = z.infer<typeof listFilesInputSchema>;
type ListFilesOutput = z.infer<typeof listFilesOutputSchema>;
type FileSummary = z.infer<typeof fileSummarySchema>;
/**
 * Tool for listing all files in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * const result = await agent.generateText({
 *   prompt: "Show me all files in the session",
 *   tools: { listFiles },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
declare const listFiles: Tool<unknown, {
    success: true;
    files: {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }[];
    count: number;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
}, {
    reasoning: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    files: z.ZodArray<z.ZodObject<{
        fileName: z.ZodString;
        mimeType: z.ZodString;
        size: z.ZodNumber;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }, {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }>, "many">;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    success: true;
    files: {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }[];
    count: number;
}, {
    success: true;
    files: {
        size: number;
        fileName: string;
        mimeType: string;
        createdAt: number;
        updatedAt: number;
    }[];
    count: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

/**
 * Input schema for execute code tool
 */
declare const executeCodeInputSchema: z.ZodObject<{
    code: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    reasoning: string;
}, {
    code: string;
    reasoning: string;
}>;
/**
 * Output schema for execute code tool - returns any JSON-serializable value
 */
declare const executeCodeOutputSchema: z.ZodUnknown;
type ExecuteCodeInput = z.infer<typeof executeCodeInputSchema>;
type ExecuteCodeOutput = unknown;
/**
 * Interface for code executor that must be provided via runtime context
 * Handles execution of JavaScript code in a target environment (e.g., browser page, worker, etc.)
 */
interface CodeExecutor {
    /**
     * Execute JavaScript code and return the result
     * @param code - JavaScript code to execute
     * @param options - Execution options
     * @returns The result value from code execution
     */
    execute(code: string, options?: {
        returnByValue?: boolean;
        awaitPromise?: boolean;
        timeout?: number;
    }): Promise<{
        success: boolean;
        value?: unknown;
        error?: string;
        exceptionDetails?: string;
    }>;
}
/**
 * Tool for executing arbitrary JavaScript code in a target execution context
 *
 * **Runtime Requirements:**
 * - `codeExecutor`: An instance of CodeExecutor must be provided in runtimeContext
 *
 * **Use Cases:**
 * - Extract all links from a page
 * - Get specific DOM elements with custom logic
 * - Extract table data
 * - Get computed styles
 * - Run custom JavaScript that doesn't fit schema-based extraction
 * - Check page state
 * - Extract images
 * - Get metadata
 *
 * **Important Notes:**
 * - Code executes in the target's JavaScript context with full API access
 * - Return values must be JSON-serializable (strings, numbers, objects, arrays)
 * - Use arrow functions or IIFEs for multi-line code
 * - DOM nodes cannot be returned directly - extract their properties instead
 *
 * @example
 * ```typescript
 * // Extract all links from a page
 * const result = await agent.generateText({
 *   prompt: "Get all links on the page",
 *   tools: { executeCode },
 *   runtimeContext: {
 *     codeExecutor: myCodeExecutor
 *   }
 * });
 *
 * // The agent might generate:
 * // code: "Array.from(document.links).map(a => ({text: a.textContent.trim(), href: a.href}))"
 * ```
 *
 * @example
 * ```typescript
 * // Extract product data
 * const result = await agent.generateText({
 *   prompt: "Extract all product names and prices",
 *   tools: { executeCode },
 *   runtimeContext: {
 *     codeExecutor: myCodeExecutor
 *   }
 * });
 *
 * // The agent might generate:
 * // code: "Array.from(document.querySelectorAll('.product')).map(p => ({
 * //   name: p.querySelector('.name')?.textContent,
 * //   price: p.querySelector('.price')?.textContent
 * // }))"
 * ```
 */
declare const executeCode: Tool<unknown, unknown, z.ZodObject<{
    code: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    reasoning: string;
}, {
    code: string;
    reasoning: string;
}>, z.ZodUnknown>;

declare const htmlToMarkdownInputSchema: z.ZodObject<{
    instruction: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    instruction?: string | undefined;
}, {
    reasoning: string;
    instruction?: string | undefined;
}>;
declare const htmlToMarkdownOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    markdownContent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    markdownContent: string;
}, {
    success: true;
    markdownContent: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type HTMLToMarkdownInput = z.infer<typeof htmlToMarkdownInputSchema>;
type HTMLToMarkdownOutput = z.infer<typeof htmlToMarkdownOutputSchema>;
/**
 * Tool for extracting main article content and converting to Markdown
 */
declare const htmlToMarkdown: Tool<unknown, {
    success: true;
    markdownContent: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    instruction: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    instruction?: string | undefined;
}, {
    reasoning: string;
    instruction?: string | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    markdownContent: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    markdownContent: string;
}, {
    success: true;
    markdownContent: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const accessibilityTreeInputSchema: z.ZodObject<{
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
}, {
    reasoning: string;
}>;
declare const accessibilityTreeOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    simplified: z.ZodString;
    full: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    simplified: string;
    full: string;
}, {
    success: true;
    simplified: string;
    full: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type AccessibilityTreeInput = z.infer<typeof accessibilityTreeInputSchema>;
type AccessibilityTreeOutput = z.infer<typeof accessibilityTreeOutputSchema>;
/**
 * Tool for extracting page accessibility tree as markdown
 */
declare const accessibilityTreeToMarkdown: Tool<unknown, {
    success: true;
    simplified: string;
    full: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
}, {
    reasoning: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    simplified: z.ZodString;
    full: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    simplified: string;
    full: string;
}, {
    success: true;
    simplified: string;
    full: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const fetcherInputSchema: z.ZodObject<{
    urls: z.ZodArray<z.ZodString, "many">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    urls: string[];
}, {
    reasoning: string;
    urls: string[];
}>;
declare const fetcherOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    sources: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        markdownContent: z.ZodString;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }, {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: true;
    sources: {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }[];
}, {
    success: true;
    sources: {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }[];
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type FetcherInput = z.infer<typeof fetcherInputSchema>;
type FetcherOutput = z.infer<typeof fetcherOutputSchema>;
/**
 * Tool for fetching and extracting content from multiple URLs
 */
declare const fetcher: Tool<unknown, {
    success: true;
    sources: {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }[];
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    urls: z.ZodArray<z.ZodString, "many">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    urls: string[];
}, {
    reasoning: string;
    urls: string[];
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    sources: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        markdownContent: z.ZodString;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }, {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: true;
    sources: {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }[];
}, {
    success: true;
    sources: {
        success: boolean;
        title: string;
        url: string;
        markdownContent: string;
        error?: string | undefined;
    }[];
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const webAppDataInputSchema: z.ZodObject<{
    appId: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    appId: string;
}, {
    reasoning: string;
    appId: string;
}>;
declare const webAppDataOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    appId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    appId: string;
    data: Record<string, unknown>;
}, {
    success: true;
    appId: string;
    data: Record<string, unknown>;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type WebAppDataInput = z.infer<typeof webAppDataInputSchema>;
type WebAppDataOutput = z.infer<typeof webAppDataOutputSchema>;
/**
 * Tool for extracting web app specific data
 */
declare const getWebAppData: Tool<unknown, {
    success: true;
    appId: string;
    data: Record<string, unknown>;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    appId: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    appId: string;
}, {
    reasoning: string;
    appId: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    appId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    appId: string;
    data: Record<string, unknown>;
}, {
    success: true;
    appId: string;
    data: Record<string, unknown>;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const renderWebAppInputSchema: z.ZodObject<{
    html: z.ZodString;
    appId: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    html: string;
    appId: string;
}, {
    reasoning: string;
    html: string;
    appId: string;
}>;
declare const renderWebAppOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    appId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    appId: string;
}, {
    message: string;
    success: true;
    appId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type RenderWebAppInput = z.infer<typeof renderWebAppInputSchema>;
type RenderWebAppOutput = z.infer<typeof renderWebAppOutputSchema>;
/**
 * Tool for rendering web apps in an iframe or container
 */
declare const renderWebApp: Tool<unknown, {
    message: string;
    success: true;
    appId: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    html: z.ZodString;
    appId: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    html: string;
    appId: string;
}, {
    reasoning: string;
    html: string;
    appId: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    appId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    appId: string;
}, {
    message: string;
    success: true;
    appId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const removeWebAppInputSchema: z.ZodObject<{
    appId: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    appId: string;
}, {
    reasoning: string;
    appId: string;
}>;
declare const removeWebAppOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    appId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    appId: string;
}, {
    message: string;
    success: true;
    appId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type RemoveWebAppInput = z.infer<typeof removeWebAppInputSchema>;
type RemoveWebAppOutput = z.infer<typeof removeWebAppOutputSchema>;
/**
 * Tool for removing rendered web apps
 */
declare const removeWebApp: Tool<unknown, {
    message: string;
    success: true;
    appId: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    appId: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    appId: string;
}, {
    reasoning: string;
    appId: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    appId: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    appId: string;
}, {
    message: string;
    success: true;
    appId: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const thinkingInputSchema: z.ZodObject<{
    userRequest: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userRequest: string;
    context?: string | undefined;
}, {
    userRequest: string;
    context?: string | undefined;
}>;
declare const thinkingOutputSchema: z.ZodUnion<[z.ZodObject<{
    visualSummary: z.ZodString;
    thingsToDoList: z.ZodArray<z.ZodString, "many">;
    currentProgress: z.ZodOptional<z.ZodString>;
    observations: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    visualSummary: string;
    thingsToDoList: string[];
    currentProgress?: string | undefined;
    observations?: string | undefined;
}, {
    visualSummary: string;
    thingsToDoList: string[];
    currentProgress?: string | undefined;
    observations?: string | undefined;
}>, z.ZodObject<{
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
}, {
    error: string;
}>]>;
type ThinkingInput = z.infer<typeof thinkingInputSchema>;
type ThinkingOutput = z.infer<typeof thinkingOutputSchema>;
/**
 * Tool for high-level thinking and planning with visual/accessibility context
 */
declare const thinking: Tool<unknown, {
    visualSummary: string;
    thingsToDoList: string[];
    currentProgress?: string | undefined;
    observations?: string | undefined;
} | {
    error: string;
}, z.ZodObject<{
    userRequest: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userRequest: string;
    context?: string | undefined;
}, {
    userRequest: string;
    context?: string | undefined;
}>, z.ZodUnion<[z.ZodObject<{
    visualSummary: z.ZodString;
    thingsToDoList: z.ZodArray<z.ZodString, "many">;
    currentProgress: z.ZodOptional<z.ZodString>;
    observations: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    visualSummary: string;
    thingsToDoList: string[];
    currentProgress?: string | undefined;
    observations?: string | undefined;
}, {
    visualSummary: string;
    thingsToDoList: string[];
    currentProgress?: string | undefined;
    observations?: string | undefined;
}>, z.ZodObject<{
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
}, {
    error: string;
}>]>>;

declare const critiqueInputSchema: z.ZodObject<{
    content: z.ZodString;
    criteria: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    reasoning: string;
    criteria?: string | undefined;
}, {
    content: string;
    reasoning: string;
    criteria?: string | undefined;
}>;
declare const critiqueOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    critique: z.ZodString;
    suggestions: z.ZodArray<z.ZodString, "many">;
    score: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    success: true;
    critique: string;
    suggestions: string[];
    score: number;
}, {
    success: true;
    critique: string;
    suggestions: string[];
    score: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type CritiqueInput = z.infer<typeof critiqueInputSchema>;
type CritiqueOutput = z.infer<typeof critiqueOutputSchema>;
/**
 * Tool for critiquing and providing feedback on content
 */
declare const critique: Tool<unknown, {
    success: true;
    critique: string;
    suggestions: string[];
    score: number;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    content: z.ZodString;
    criteria: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    reasoning: string;
    criteria?: string | undefined;
}, {
    content: string;
    reasoning: string;
    criteria?: string | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    critique: z.ZodString;
    suggestions: z.ZodArray<z.ZodString, "many">;
    score: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    success: true;
    critique: string;
    suggestions: string[];
    score: number;
}, {
    success: true;
    critique: string;
    suggestions: string[];
    score: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const sequentialThinkingInputSchema: z.ZodObject<{
    problem: z.ZodString;
    steps: z.ZodOptional<z.ZodNumber>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    problem: string;
    steps?: number | undefined;
}, {
    reasoning: string;
    problem: string;
    steps?: number | undefined;
}>;
declare const sequentialThinkingOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    steps: z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        thought: z.ZodString;
        conclusion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }, {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }>, "many">;
    finalAnswer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    steps: {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }[];
    finalAnswer: string;
}, {
    success: true;
    steps: {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }[];
    finalAnswer: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type SequentialThinkingInput = z.infer<typeof sequentialThinkingInputSchema>;
type SequentialThinkingOutput = z.infer<typeof sequentialThinkingOutputSchema>;
/**
 * Tool for multi-step sequential thinking and reasoning
 */
declare const sequentialThinking: Tool<unknown, {
    success: true;
    steps: {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }[];
    finalAnswer: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    problem: z.ZodString;
    steps: z.ZodOptional<z.ZodNumber>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    problem: string;
    steps?: number | undefined;
}, {
    reasoning: string;
    problem: string;
    steps?: number | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    steps: z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        thought: z.ZodString;
        conclusion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }, {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }>, "many">;
    finalAnswer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    steps: {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }[];
    finalAnswer: string;
}, {
    success: true;
    steps: {
        step: number;
        thought: string;
        conclusion?: string | undefined;
    }[];
    finalAnswer: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const schemaExtractorInputSchema: z.ZodObject<{
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    instruction: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    instruction: string;
    schema: Record<string, unknown>;
}, {
    reasoning: string;
    instruction: string;
    schema: Record<string, unknown>;
}>;
declare const schemaExtractorOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodUnknown;
    metadata: z.ZodOptional<z.ZodObject<{
        progress: z.ZodString;
        completed: z.ZodBoolean;
        reasoning: z.ZodOptional<z.ZodString>;
        pageContext: z.ZodOptional<z.ZodString>;
        missingFields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    }, {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: true;
    metadata?: {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    } | undefined;
    data?: unknown;
}, {
    success: true;
    metadata?: {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    } | undefined;
    data?: unknown;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type SchemaExtractorInput = z.infer<typeof schemaExtractorInputSchema>;
type SchemaExtractorOutput = z.infer<typeof schemaExtractorOutputSchema>;
/**
 * Tool for extracting structured data based on JSON schema
 */
declare const schemaExtractor: Tool<unknown, {
    success: true;
    metadata?: {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    } | undefined;
    data?: unknown;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    instruction: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    instruction: string;
    schema: Record<string, unknown>;
}, {
    reasoning: string;
    instruction: string;
    schema: Record<string, unknown>;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodUnknown;
    metadata: z.ZodOptional<z.ZodObject<{
        progress: z.ZodString;
        completed: z.ZodBoolean;
        reasoning: z.ZodOptional<z.ZodString>;
        pageContext: z.ZodOptional<z.ZodString>;
        missingFields: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    }, {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    success: true;
    metadata?: {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    } | undefined;
    data?: unknown;
}, {
    success: true;
    metadata?: {
        progress: string;
        completed: boolean;
        reasoning?: string | undefined;
        pageContext?: string | undefined;
        missingFields?: string | undefined;
    } | undefined;
    data?: unknown;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const streamlinedExtractorInputSchema: z.ZodObject<{
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    instruction: z.ZodString;
}, "strip", z.ZodTypeAny, {
    instruction: string;
    schema: Record<string, unknown>;
}, {
    instruction: string;
    schema: Record<string, unknown>;
}>;
declare const streamlinedExtractorOutputSchema: z.ZodUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    success: true;
    data?: unknown;
}, {
    success: true;
    data?: unknown;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type StreamlinedExtractorInput = z.infer<typeof streamlinedExtractorInputSchema>;
type StreamlinedExtractorOutput = z.infer<typeof streamlinedExtractorOutputSchema>;
/**
 * Streamlined version of schema-based extractor for simpler use cases
 */
declare const streamlinedExtractor: Tool<unknown, {
    success: true;
    data?: unknown;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    instruction: z.ZodString;
}, "strip", z.ZodTypeAny, {
    instruction: string;
    schema: Record<string, unknown>;
}, {
    instruction: string;
    schema: Record<string, unknown>;
}>, z.ZodUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    success: true;
    data?: unknown;
}, {
    success: true;
    data?: unknown;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const combinedExtractionInputSchema: z.ZodObject<{
    extractors: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        instruction: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }, {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }>, "many">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    extractors: {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }[];
}, {
    reasoning: string;
    extractors: {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }[];
}>;
declare const combinedExtractionOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    results: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        data: z.ZodUnknown;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }, {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: true;
    results: {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }[];
}, {
    success: true;
    results: {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }[];
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type CombinedExtractionInput = z.infer<typeof combinedExtractionInputSchema>;
type CombinedExtractionOutput = z.infer<typeof combinedExtractionOutputSchema>;
/**
 * Tool for running multiple extractions in one call
 */
declare const combinedExtraction: Tool<unknown, {
    success: true;
    results: {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }[];
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    extractors: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        instruction: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }, {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }>, "many">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    extractors: {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }[];
}, {
    reasoning: string;
    extractors: {
        instruction: string;
        schema: Record<string, unknown>;
        name: string;
    }[];
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    results: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        data: z.ZodUnknown;
        success: z.ZodBoolean;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }, {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    success: true;
    results: {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }[];
}, {
    success: true;
    results: {
        success: boolean;
        name: string;
        error?: string | undefined;
        data?: unknown;
    }[];
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

/**
 * Input schema for update todo tool
 */
declare const updateTodoInputSchema: z.ZodObject<{
    todoList: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    todoList: string;
}, {
    reasoning: string;
    todoList: string;
}>;
/**
 * Output schema for update todo tool
 */
declare const updateTodoOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    message: z.ZodString;
    todoCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    todoCount: number;
}, {
    message: string;
    success: true;
    todoCount: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type UpdateTodoInput = z.infer<typeof updateTodoInputSchema>;
type UpdateTodoOutput = z.infer<typeof updateTodoOutputSchema>;
/**
 * Tool for updating the todo list in session storage
 *
 * **Runtime Requirements:**
 * - `fileStorageManager`: An instance of FileStorageManager must be provided in runtimeContext
 *
 * @example
 * ```typescript
 * const result = await agent.generateText({
 *   prompt: "Update the todo list with current progress",
 *   tools: { updateTodo },
 *   runtimeContext: {
 *     fileStorageManager: myFileStorageManager
 *   }
 * });
 * ```
 */
declare const updateTodo: Tool<unknown, {
    message: string;
    success: true;
    todoCount: number;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    todoList: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    todoList: string;
}, {
    reasoning: string;
    todoList: string;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    message: z.ZodString;
    todoCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    todoCount: number;
}, {
    message: string;
    success: true;
    todoCount: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const documentSearchInputSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    domain: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    query: string;
    tags?: string[] | undefined;
    limit?: number | undefined;
    domain?: string | undefined;
}, {
    reasoning: string;
    query: string;
    tags?: string[] | undefined;
    limit?: number | undefined;
    domain?: string | undefined;
}>;
declare const documentSearchOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        url: z.ZodString;
        content: z.ZodString;
        relevanceScore: z.ZodNumber;
        domain: z.ZodString;
        tags: z.ZodArray<z.ZodString, "many">;
        bookmarkedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }, {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }>, "many">;
    totalResults: z.ZodNumber;
    query: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    results: {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }[];
    query: string;
    totalResults: number;
}, {
    success: true;
    results: {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }[];
    query: string;
    totalResults: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type DocumentSearchInput = z.infer<typeof documentSearchInputSchema>;
type DocumentSearchOutput = z.infer<typeof documentSearchOutputSchema>;
/**
 * Tool for searching bookmarked documents using semantic similarity
 */
declare const documentSearch: Tool<unknown, {
    success: true;
    results: {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }[];
    query: string;
    totalResults: number;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    domain: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    query: string;
    tags?: string[] | undefined;
    limit?: number | undefined;
    domain?: string | undefined;
}, {
    reasoning: string;
    query: string;
    tags?: string[] | undefined;
    limit?: number | undefined;
    domain?: string | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    results: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        url: z.ZodString;
        content: z.ZodString;
        relevanceScore: z.ZodNumber;
        domain: z.ZodString;
        tags: z.ZodArray<z.ZodString, "many">;
        bookmarkedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }, {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }>, "many">;
    totalResults: z.ZodNumber;
    query: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    results: {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }[];
    query: string;
    totalResults: number;
}, {
    success: true;
    results: {
        content: string;
        tags: string[];
        title: string;
        url: string;
        domain: string;
        id: string;
        relevanceScore: number;
        bookmarkedAt: string;
    }[];
    query: string;
    totalResults: number;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const bookmarkStoreInputSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reasoning: z.ZodString;
    includeFullContent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    tags?: string[] | undefined;
    title?: string | undefined;
    includeFullContent?: boolean | undefined;
}, {
    reasoning: string;
    tags?: string[] | undefined;
    title?: string | undefined;
    includeFullContent?: boolean | undefined;
}>;
declare const bookmarkStoreOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    id: z.ZodString;
    url: z.ZodString;
    title: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    title: string;
    url: string;
    id: string;
}, {
    message: string;
    success: true;
    title: string;
    url: string;
    id: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type BookmarkStoreInput = z.infer<typeof bookmarkStoreInputSchema>;
type BookmarkStoreOutput = z.infer<typeof bookmarkStoreOutputSchema>;
/**
 * Tool for storing current page content as a bookmark in vector database
 */
declare const bookmarkStore: Tool<unknown, {
    message: string;
    success: true;
    title: string;
    url: string;
    id: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reasoning: z.ZodString;
    includeFullContent: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reasoning: string;
    tags?: string[] | undefined;
    title?: string | undefined;
    includeFullContent?: boolean | undefined;
}, {
    reasoning: string;
    tags?: string[] | undefined;
    title?: string | undefined;
    includeFullContent?: boolean | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    id: z.ZodString;
    url: z.ZodString;
    title: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    success: true;
    title: string;
    url: string;
    id: string;
}, {
    message: string;
    success: true;
    title: string;
    url: string;
    id: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

declare const finalizeWithCritiqueInputSchema: z.ZodObject<{
    result: z.ZodString;
    criteria: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    result: string;
    reasoning: string;
    criteria?: string | undefined;
}, {
    result: string;
    reasoning: string;
    criteria?: string | undefined;
}>;
declare const finalizeWithCritiqueOutputSchema: z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    isValid: z.ZodBoolean;
    critique: z.ZodString;
    improvements: z.ZodArray<z.ZodString, "many">;
    finalResult: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    critique: string;
    isValid: boolean;
    improvements: string[];
    finalResult: string;
}, {
    success: true;
    critique: string;
    isValid: boolean;
    improvements: string[];
    finalResult: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>;
type FinalizeWithCritiqueInput = z.infer<typeof finalizeWithCritiqueInputSchema>;
type FinalizeWithCritiqueOutput = z.infer<typeof finalizeWithCritiqueOutputSchema>;
/**
 * Tool for finalizing results with critique and validation
 */
declare const finalizeWithCritique: Tool<unknown, {
    success: true;
    critique: string;
    isValid: boolean;
    improvements: string[];
    finalResult: string;
} | {
    error: string;
    success: false;
}, z.ZodObject<{
    result: z.ZodString;
    criteria: z.ZodOptional<z.ZodString>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    result: string;
    reasoning: string;
    criteria?: string | undefined;
}, {
    result: string;
    reasoning: string;
    criteria?: string | undefined;
}>, z.ZodDiscriminatedUnion<"success", [z.ZodObject<{
    success: z.ZodLiteral<true>;
    isValid: z.ZodBoolean;
    critique: z.ZodString;
    improvements: z.ZodArray<z.ZodString, "many">;
    finalResult: z.ZodString;
}, "strip", z.ZodTypeAny, {
    success: true;
    critique: string;
    isValid: boolean;
    improvements: string[];
    finalResult: string;
}, {
    success: true;
    critique: string;
    isValid: boolean;
    improvements: string[];
    finalResult: string;
}>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: string;
    success: false;
}, {
    error: string;
    success: false;
}>]>>;

export { type AccessibilityTreeInput, type AccessibilityTreeOutput, type BookmarkStoreInput, type BookmarkStoreOutput, type CodeExecutor, type CombinedExtractionInput, type CombinedExtractionOutput, type CreateFileInput, type CreateFileOutput, type CritiqueInput, type CritiqueOutput, type DeleteFileInput, type DeleteFileOutput, type DocumentSearchInput, type DocumentSearchOutput, type ExecuteCodeInput, type ExecuteCodeOutput, type FetcherInput, type FetcherOutput, type FileStorageManager, type FileSummary, type FinalizeWithCritiqueInput, type FinalizeWithCritiqueOutput, type HTMLToMarkdownConverter, type HTMLToMarkdownInput, type HTMLToMarkdownOutput, type LLMProvider, type ListFilesInput, type ListFilesOutput, type NavigationManager, type PageContentAccessor, type ReadFileInput, type ReadFileOutput, type RemoveWebAppInput, type RemoveWebAppOutput, type RenderWebAppInput, type RenderWebAppOutput, type SchemaExtractorInput, type SchemaExtractorOutput, type SequentialThinkingInput, type SequentialThinkingOutput, type StreamlinedExtractorInput, type StreamlinedExtractorOutput, type ThinkingInput, type ThinkingOutput, Tool, type UpdateFileInput, type UpdateFileOutput, type UpdateTodoInput, type UpdateTodoOutput, type VectorDBClient, type WebAppDataInput, type WebAppDataOutput, accessibilityTreeInputSchema, accessibilityTreeOutputSchema, accessibilityTreeToMarkdown, bookmarkStore, bookmarkStoreInputSchema, bookmarkStoreOutputSchema, combinedExtraction, combinedExtractionInputSchema, combinedExtractionOutputSchema, createFile, createFileInputSchema, createFileOutputSchema, critique, critiqueInputSchema, critiqueOutputSchema, deleteFile, deleteFileInputSchema, deleteFileOutputSchema, documentSearch, documentSearchInputSchema, documentSearchOutputSchema, executeCode, executeCodeInputSchema, executeCodeOutputSchema, fetcher, fetcherInputSchema, fetcherOutputSchema, fileSummarySchema, finalizeWithCritique, finalizeWithCritiqueInputSchema, finalizeWithCritiqueOutputSchema, getWebAppData, htmlToMarkdown, htmlToMarkdownInputSchema, htmlToMarkdownOutputSchema, listFiles, listFilesInputSchema, listFilesOutputSchema, readFile, readFileInputSchema, readFileOutputSchema, removeWebApp, removeWebAppInputSchema, removeWebAppOutputSchema, renderWebApp, renderWebAppInputSchema, renderWebAppOutputSchema, schemaExtractor, schemaExtractorInputSchema, schemaExtractorOutputSchema, sequentialThinking, sequentialThinkingInputSchema, sequentialThinkingOutputSchema, streamlinedExtractor, streamlinedExtractorInputSchema, streamlinedExtractorOutputSchema, thinking, thinkingInputSchema, thinkingOutputSchema, updateFile, updateFileInputSchema, updateFileOutputSchema, updateTodo, updateTodoInputSchema, updateTodoOutputSchema, webAppDataInputSchema, webAppDataOutputSchema };
