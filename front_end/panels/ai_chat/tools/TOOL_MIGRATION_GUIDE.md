# Tool Migration Guide: DevTools Tools → SDK Tools

This guide explains how to migrate existing DevTools tools to use the Browser Operator SDK's tool system.

## Overview

**Current System (DevTools):**
- Tools implement the `Tool<TArgs, TResult>` interface
- Schema defined as plain JSON object
- Context passed as `LLMContext` with provider/model info
- Executes with DevTools-specific APIs directly

**SDK System:**
- Tools created with `SDK.Tools.createTool()`
- Schema defined with Zod for type safety
- Context passed as `RuntimeContext` (browser-agnostic)
- Runtime injects DevTools APIs via `devToolsRuntimeContext`

## Migration Pattern

### Before (DevTools Tool)

```typescript
// tools/ExampleTool.ts
export interface ExampleToolArgs {
  input: string;
  count: number;
}

export interface ExampleToolResult {
  output: string;
  success: boolean;
}

export const exampleTool: Tool<ExampleToolArgs, ExampleToolResult> = {
  name: 'example_tool',
  description: 'An example tool',
  schema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input text' },
      count: { type: 'number', description: 'Count value' },
    },
    required: ['input'],
  },
  execute: async (args, ctx?) => {
    // Direct browser API access
    console.log('Executing tool');
    localStorage.setItem('key', args.input);

    return {
      output: `Processed: ${args.input} x${args.count}`,
      success: true,
    };
  },
};
```

### After (SDK Tool with DevTools Runtime)

```typescript
// tools/ExampleToolSDK.ts
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import { devToolsRuntimeContext } from '../core/DevToolsRuntimeContext.js';

export const exampleToolSDK = SDK.Tools.createTool({
  name: 'example_tool',
  description: 'An example tool',

  // Zod schema for type safety
  parameters: SDK.z.object({
    input: SDK.z.string().describe('Input text'),
    count: SDK.z.number().optional().describe('Count value'),
  }),

  // Execute with injected runtime context
  execute: async (params, context) => {
    // Use injected runtime context for browser APIs
    context.logger.info('Executing tool');
    await context.storage.set('key', params.input);

    return {
      output: `Processed: ${params.input} x${params.count || 1}`,
      success: true,
    };
  },
});

// Use with DevTools runtime context
const result = await exampleToolSDK.execute(
  { input: 'test', count: 3 },
  devToolsRuntimeContext
);
```

## Step-by-Step Migration

### 1. Create SDK Version of Tool

Create a new file with `SDK` suffix (e.g., `FetcherToolSDK.ts`):

```typescript
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';
import { devToolsRuntimeContext } from '../core/DevToolsRuntimeContext.js';

export const fetcherToolSDK = SDK.Tools.createTool({
  name: 'fetcher',
  description: 'Fetch URL content',
  parameters: SDK.z.object({
    url: SDK.z.string().url().describe('URL to fetch'),
    method: SDK.z.enum(['GET', 'POST']).default('GET'),
  }),
  execute: async (params, context) => {
    // Use context.fetch instead of direct fetch
    const response = await context.fetch(params.url, {
      method: params.method,
    });
    const text = await response.text();
    return { content: text, status: response.status };
  },
});
```

### 2. Convert Schema to Zod

**JSON Schema → Zod Mapping:**

| JSON Schema | Zod Equivalent |
|------------|----------------|
| `{ type: 'string' }` | `SDK.z.string()` |
| `{ type: 'number' }` | `SDK.z.number()` |
| `{ type: 'boolean' }` | `SDK.z.boolean()` |
| `{ type: 'array', items: {...} }` | `SDK.z.array(SDK.z....)` |
| `{ type: 'object', properties: {...} }` | `SDK.z.object({...})` |
| `{ enum: ['a', 'b'] }` | `SDK.z.enum(['a', 'b'])` |
| Required field | No `.optional()` |
| Optional field | `.optional()` or `.default(value)` |
| With description | `.describe('...')` |

### 3. Update Browser API Calls

Replace direct browser API calls with RuntimeContext methods:

| Direct API | RuntimeContext Method |
|-----------|---------------------|
| `console.log()` | `context.logger.info()` |
| `fetch()` | `context.fetch()` |
| `localStorage.getItem()` | `await context.storage.get()` |
| `localStorage.setItem()` | `await context.storage.set()` |
| `navigator.clipboard.writeText()` | `await context.copyToClipboard()` |
| `setTimeout()` | `context.setTimeout()` |
| `Date.now()` | `context.now()` |

### 4. Handle DevTools-Specific APIs

For DevTools-specific functionality (CDP, SDK objects), keep in the tool but document:

```typescript
export const devToolsSpecificToolSDK = SDK.Tools.createTool({
  name: 'devtools_specific',
  description: 'Tool that needs DevTools APIs',
  parameters: SDK.z.object({
    targetId: SDK.z.string(),
  }),
  execute: async (params, context) => {
    // DevTools-specific code - can't be abstracted
    const target = SDK.TargetManager.instance().targetById(params.targetId);

    // Use runtime context for browser APIs
    context.logger.info('Using DevTools API');

    return { success: true };
  },
});
```

### 5. Register Tool in Tool Registry

Update the tool registration to use SDK version:

```typescript
// Before
import { fetcherTool } from './FetcherTool.js';
toolRegistry.register(fetcherTool);

// After
import { fetcherToolSDK } from './FetcherToolSDK.js';
import { devToolsRuntimeContext } from '../core/DevToolsRuntimeContext.js';

// Wrap SDK tool to match DevTools Tool interface
const fetcherToolAdapter = {
  ...fetcherToolSDK,
  execute: (args: any, ctx?: LLMContext) => {
    return fetcherToolSDK.execute(args, devToolsRuntimeContext);
  },
};

toolRegistry.register(fetcherToolAdapter);
```

## Tool Categories & Migration Priority

### High Priority (Simple Browser APIs)
- ✅ FetcherTool - HTTP requests
- ✅ ThinkingTool - Just logging
- ✅ CritiqueTool - LLM calls + logging
- File tools (Create/Update/Delete/Read/List) - Storage APIs

### Medium Priority (Mixed APIs)
- HTMLToMarkdownTool - Fetch + text processing
- SchemaBasedExtractorTool - LLM + validation
- DocumentSearchTool - Storage + search
- BookmarkStoreTool - Storage APIs

### Low Priority (DevTools-Heavy)
- FullPageAccessibilityTreeToMarkdownTool - CDP APIs
- VisualIndicatorTool - CDP + UI
- ExecuteCodeTool - CDP Runtime
- CombinedExtractionTool - CDP + LLM

## Complete Example: FetcherTool Migration

**Before (279 lines):**
```typescript
// tools/FetcherTool.ts
export class FetcherTool implements Tool<FetcherToolArgs, FetcherToolResult> {
  name = 'fetcher';
  description = 'Fetch URL content...';
  schema = { /* JSON schema */ };

  async execute(args: FetcherToolArgs): Promise<FetcherToolResult> {
    const response = await fetch(args.url);
    // ... 250+ lines of processing
    return result;
  }
}
```

**After (120 lines with SDK):**
```typescript
// tools/FetcherToolSDK.ts
import * as SDK from '../../third_party/browser-operator-sdk/browser-operator-sdk.js';

export const fetcherToolSDK = SDK.Tools.createTool({
  name: 'fetcher',
  description: 'Fetch URL content...',
  parameters: SDK.z.object({
    url: SDK.z.string().url(),
    method: SDK.z.enum(['GET', 'POST']).default('GET'),
  }),
  execute: async (params, context) => {
    const response = await context.fetch(params.url, {
      method: params.method,
    });
    // ... same processing logic
    return result;
  },
});
```

**Savings:** ~160 lines removed (schema boilerplate, type definitions)

## Testing Strategy

1. **Unit Tests:** Update to inject mock RuntimeContext
2. **Integration Tests:** Use `devToolsRuntimeContext` in test environment
3. **Parallel Running:** Keep both versions during migration, compare results

## Migration Checklist

Per tool:

- [ ] Create `*SDK.ts` file
- [ ] Convert schema to Zod
- [ ] Replace browser APIs with RuntimeContext
- [ ] Add execute wrapper for registry
- [ ] Update imports in Tools.ts
- [ ] Update tests
- [ ] Verify functionality
- [ ] Remove old file (Phase 6)

## Benefits After Migration

1. **Type Safety:** Zod schemas provide runtime validation
2. **Testability:** Easy to mock RuntimeContext
3. **Portability:** Tools can run in different environments
4. **Consistency:** All tools follow SDK patterns
5. **Maintainability:** Less boilerplate code

## Common Pitfalls

1. **Forgetting await on storage operations** - RuntimeContext methods are async
2. **Not using context.logger** - Console logs won't work in all environments
3. **Hardcoding DevTools APIs** - Breaks portability
4. **Schema mismatches** - Zod schema must match TypeScript types

## Next Steps

1. Migrate high-priority tools first (simple browser APIs)
2. Create adapter pattern for tool registry integration
3. Run parallel during transition period
4. Remove old tools in Phase 6 cleanup
