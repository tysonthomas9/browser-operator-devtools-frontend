# Tool Migration Status

## Overview

Migrating all tools from `front_end/panels/ai_chat/tools/` to SDK using the Mastra pattern with Zod schemas and runtime injection.

**Progress: 7/24 tools migrated (29%)**

## ✅ Completed Migrations (7 tools)

### File Operations (5/5) - 100% Complete

1. **readFile** - `src/tools/readFile.ts`
   - Read files with full metadata
   - Defines `FileStorageManager` interface (reused by all file tools)
   - Pattern: Runtime injection via `runtimeContext`

2. **createFile** - `src/tools/createFile.ts`
   - Create new files in session storage
   - Reuses `FileStorageManager` interface
   - Pattern: Discriminated union for success/error

3. **updateFile** - `src/tools/updateFile.ts`
   - Update or append to existing files
   - Supports append mode
   - Pattern: Same as createFile

4. **deleteFile** - `src/tools/deleteFile.ts`
   - Delete files from session storage
   - Simple success/error result
   - Pattern: Same as createFile

5. **listFiles** - `src/tools/listFiles.ts`
   - List all files with metadata
   - Returns array of file summaries
   - Pattern: Same as createFile

### Execution (1/1) - 100% Complete

6. **executeCode** - `src/tools/executeCode.ts`
   - Execute JavaScript in target execution context
   - Defines `CodeExecutor` interface for runtime injection
   - Returns raw JSON-serializable values
   - Pattern: Runtime injection for browser-specific execution

### Utilities (1/X)

7. **updateTodo** - `src/tools/updateTodo.ts`
   - Manage markdown todo lists
   - Uses `FileStorageManager` interface
   - Validates markdown checklist format
   - Pattern: Reuses existing interface

## 📋 Remaining Tools (17)

### Data Extraction Tools (3)
- **SchemaBasedExtractorTool** - Complex: LLM + accessibility tree + chunking
- **StreamlinedSchemaExtractorTool** - Simplified version of above
- **CombinedExtractionTool** - Combines multiple extraction methods

**Dependencies:** LLM provider, accessibility tree access, URL resolution

### Thinking/Planning Tools (3)
- **ThinkingTool** - Complex: Vision/accessibility + LLM reasoning
- **SequentialThinkingTool** - Multi-step thinking process
- **CritiqueTool** - LLM-based critique and validation

**Dependencies:** LLM provider, vision capability detection, screenshot/accessibility tools

### Web/Browser Tools (6)
- **FetcherTool** - Navigate and fetch content from URLs
- **HTMLToMarkdownTool** - Convert HTML to clean markdown
- **FullPageAccessibilityTreeToMarkdownTool** - Extract accessibility tree as markdown
- **GetWebAppDataTool** - Extract web app specific data
- **RenderWebAppTool** - Render web apps in iframe
- **RemoveWebAppTool** - Clean up rendered web apps

**Dependencies:** Browser navigation, DOM access, HTML parsing, accessibility tree

### Utility Tools (5)
- **BookmarkStoreTool** - Store bookmarks in vector database
- **DocumentSearchTool** - Search bookmarks with semantic similarity
- **FinalizeWithCritiqueTool** - Final validation with critique
- **VisualIndicatorTool** - Visual feedback (actually a manager, not a tool)

**Dependencies:** Vector database, LLM provider, event bus

## 🎯 Migration Patterns Established

### Pattern 1: Self-Contained with FileStorageManager
```typescript
import type { FileStorageManager } from './readFile.js';

export const tool = createTool({
  id: 'tool_name',
  inputSchema: z.object({...}),
  outputSchema: z.discriminatedUnion('success', [...]),
  execute: async ({ context, runtimeContext }) => {
    const manager = runtimeContext?.get<FileStorageManager>('fileStorageManager');
    if (!manager) {
      return { success: false, error: 'Manager not available' };
    }
    // Use manager methods
  }
});
```

### Pattern 2: Runtime Injection for Browser APIs
```typescript
export interface CustomExecutor {
  execute(...): Promise<Result>;
}

export const tool = createTool({
  id: 'tool_name',
  execute: async ({ context, runtimeContext }) => {
    const executor = runtimeContext?.get<CustomExecutor>('executor');
    if (!executor) {
      return { error: 'Executor not available in runtime context' };
    }
    return await executor.execute(...);
  }
});
```

### Pattern 3: Discriminated Unions for Type Safety
```typescript
export const outputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.string(),
    // ... success fields
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);
```

## 🔧 Key Improvements Over Original

1. **Type Safety** - Zod schemas provide runtime validation + TypeScript types
2. **Decoupling** - Runtime injection removes DevTools dependencies
3. **Testability** - Can mock runtime dependencies for testing
4. **Browser Agnostic** - Core logic works in any JavaScript environment
5. **Consistent API** - All tools follow same createTool pattern
6. **Better Errors** - Discriminated unions give better type inference

## 📝 Next Steps

### Immediate (High Priority)
1. **Migrate Thinking Tools** - Core agent functionality
   - ThinkingTool
   - CritiqueTool
   - SequentialThinkingTool

2. **Migrate Web Tools** - Essential browser operations
   - HTMLToMarkdownTool (needed by many others)
   - FetcherTool (uses HTMLToMarkdown)
   - FullPageAccessibilityTreeToMarkdownTool

### Medium Priority
3. **Migrate Extraction Tools** - Data extraction capabilities
   - SchemaBasedExtractorTool
   - StreamlinedSchemaExtractorTool
   - CombinedExtractionTool

4. **Migrate Utility Tools** - Additional functionality
   - BookmarkStoreTool
   - DocumentSearchTool
   - FinalizeWithCritiqueTool

### Infrastructure Needed

For remaining tools, we'll need to create these interfaces for runtime injection:

1. **LLMProvider Interface** - For tools that need LLM calls
2. **NavigationInterface** - For tools that navigate to URLs
3. **AccessibilityTreeInterface** - For tools that need accessibility tree
4. **VectorDBInterface** - For bookmark and search tools
5. **ScreenshotInterface** - For vision-based thinking tools

## 🎯 Success Metrics

- ✅ All file operations migrated (5/5)
- ✅ Code execution pattern established (1/1)
- ✅ Runtime injection pattern working
- ⏳ Thinking tools (0/3)
- ⏳ Web tools (0/6)
- ⏳ Extraction tools (0/3)
- ⏳ Utility tools (1/5)

**Overall: 29% Complete**

## 📚 Documentation

Each migrated tool includes:
- ✅ JSDoc comments with examples
- ✅ Zod schemas with descriptions
- ✅ TypeScript types exported
- ✅ Runtime requirements documented
- ✅ Usage examples in comments

## 🔗 Related Files

- Main tool index: `sdk/packages/core/src/tools/index.ts`
- File tools: `sdk/packages/core/src/tools/{readFile,createFile,updateFile,deleteFile,listFiles}.ts`
- Execution tool: `sdk/packages/core/src/tools/executeCode.ts`
- Utilities: `sdk/packages/core/src/tools/updateTodo.ts`
- Original tools: `front_end/panels/ai_chat/tools/`
