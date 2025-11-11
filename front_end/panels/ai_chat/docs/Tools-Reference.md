# AI Chat Tools Reference

Comprehensive reference guide for all tools available in the AI Chat multi-agent framework.

## Overview

The AI Chat framework provides 48 tools organized into 8 categories. Tools implement a standard interface and can be used by both the primary orchestrator and specialized agents.

## Tool Interface

```typescript
interface Tool<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  schema: Record<string, unknown>;  // JSON Schema for arguments
  execute(args: TArgs, ctx?: CallCtx): Promise<TResult>;
}

interface CallCtx {
  signal?: AbortSignal;           // For cancellation
  tracingContext?: TracingContext; // For observability
  agentContext?: AgentContext;     // Agent execution context
}
```

---

## Browser/Page Tools

Tools for interacting with web pages and the browser.

### 1. NavigateURLTool

**Purpose**: Navigate the browser to a specific URL.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "The URL to navigate to"
    }
  },
  "required": ["url"]
}
```

**Usage Example**:
```typescript
await NavigateURLTool.execute({ url: "https://example.com" });
```

**Returns**: Navigation result with success status and final URL.

**Use Cases**:
- Direct navigation to known URLs
- Starting workflows at specific pages
- Deep linking into applications

---

### 2. NavigateBackTool

**Purpose**: Navigate back one page in browser history.

**Schema**:
```json
{
  "type": "object",
  "properties": {}
}
```

**Usage Example**:
```typescript
await NavigateBackTool.execute({});
```

**Returns**: Success status.

**Use Cases**:
- Undo navigation
- Return to previous page in workflow
- Back navigation in multi-step processes

---

### 3. HTMLToMarkdownTool

**Purpose**: Convert current page HTML to markdown format.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "selector": {
      "type": "string",
      "description": "CSS selector to extract specific element (optional)"
    },
    "includeLinks": {
      "type": "boolean",
      "description": "Include hyperlinks in markdown (default: true)"
    }
  }
}
```

**Usage Example**:
```typescript
const markdown = await HTMLToMarkdownTool.execute({
  selector: "article",
  includeLinks: true
});
```

**Returns**: Markdown-formatted text.

**Use Cases**:
- Content extraction for analysis
- Converting web content to readable format
- Preparing content for LLM processing

---

### 4. FullPageAccessibilityTreeToMarkdownTool

**Purpose**: Extract the full accessibility tree of the page as markdown.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "maxDepth": {
      "type": "number",
      "description": "Maximum depth to traverse (default: unlimited)"
    },
    "includeHidden": {
      "type": "boolean",
      "description": "Include hidden elements (default: false)"
    }
  }
}
```

**Usage Example**:
```typescript
const a11yTree = await FullPageAccessibilityTreeToMarkdownTool.execute({
  maxDepth: 5,
  includeHidden: false
});
```

**Returns**: Hierarchical markdown representation of accessibility tree.

**Use Cases**:
- Understanding page structure for automation
- Finding interactive elements
- Accessibility analysis
- Element identification for actions

---

### 5. SchemaBasedExtractorTool

**Purpose**: Extract structured data from page using JSON schema.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "schema": {
      "type": "object",
      "description": "JSON Schema defining the data structure to extract"
    },
    "selector": {
      "type": "string",
      "description": "CSS selector to scope extraction (optional)"
    }
  },
  "required": ["schema"]
}
```

**Usage Example**:
```typescript
const data = await SchemaBasedExtractorTool.execute({
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      price: { type: "number" },
      description: { type: "string" }
    }
  }
});
```

**Returns**: Extracted data matching schema.

**Use Cases**:
- Structured data extraction (products, articles, listings)
- Form data collection
- API-like data extraction from web pages

---

### 6. StreamlinedSchemaExtractorTool

**Purpose**: Optimized version of schema-based extraction for performance.

**Schema**: Same as SchemaBasedExtractorTool.

**Usage Example**: Same as SchemaBasedExtractorTool.

**Returns**: Extracted data matching schema (faster processing).

**Use Cases**:
- High-volume data extraction
- Performance-critical scenarios
- Real-time data extraction

---

### 7. CombinedExtractionTool

**Purpose**: Combines multiple extraction strategies for robust data extraction.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "strategies": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Extraction strategies to use: ['schema', 'html', 'a11y']"
    },
    "schema": {
      "type": "object",
      "description": "Schema for structured extraction"
    }
  },
  "required": ["strategies"]
}
```

**Usage Example**:
```typescript
const data = await CombinedExtractionTool.execute({
  strategies: ['schema', 'a11y'],
  schema: { /* ... */ }
});
```

**Returns**: Combined extraction results.

**Use Cases**:
- Robust extraction with fallbacks
- Complex page structures
- Maximizing extraction success rate

---

### 8. RenderWebAppTool

**Purpose**: Render and manage web app instances for testing/automation.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "appUrl": {
      "type": "string",
      "description": "URL of the web app to render"
    },
    "instanceId": {
      "type": "string",
      "description": "Unique instance identifier"
    }
  },
  "required": ["appUrl", "instanceId"]
}
```

**Usage Example**:
```typescript
await RenderWebAppTool.execute({
  appUrl: "https://app.example.com",
  instanceId: "test-instance-1"
});
```

**Returns**: Instance metadata.

**Use Cases**:
- Multi-instance web app testing
- Parallel automation workflows
- Isolated testing environments

---

### 9. GetWebAppDataTool

**Purpose**: Retrieve data from a rendered web app instance.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string",
      "description": "Instance identifier"
    },
    "dataPath": {
      "type": "string",
      "description": "Path to data to retrieve"
    }
  },
  "required": ["instanceId"]
}
```

**Usage Example**:
```typescript
const data = await GetWebAppDataTool.execute({
  instanceId: "test-instance-1",
  dataPath: "user.profile"
});
```

**Returns**: Requested data from web app.

**Use Cases**:
- Extracting app state
- Validation during testing
- Multi-step workflow data passing

---

### 10. RemoveWebAppTool

**Purpose**: Clean up a rendered web app instance.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "instanceId": {
      "type": "string",
      "description": "Instance identifier to remove"
    }
  },
  "required": ["instanceId"]
}
```

**Usage Example**:
```typescript
await RemoveWebAppTool.execute({ instanceId: "test-instance-1" });
```

**Returns**: Cleanup confirmation.

**Use Cases**:
- Resource cleanup
- Test teardown
- Instance lifecycle management

---

### 11. VisualIndicatorTool

**Purpose**: Highlight elements on the page for user feedback or debugging.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "selector": {
      "type": "string",
      "description": "CSS selector of element to highlight"
    },
    "color": {
      "type": "string",
      "description": "Highlight color (default: 'red')"
    },
    "duration": {
      "type": "number",
      "description": "Highlight duration in ms (default: 2000)"
    }
  },
  "required": ["selector"]
}
```

**Usage Example**:
```typescript
await VisualIndicatorTool.execute({
  selector: "#submit-button",
  color: "green",
  duration: 3000
});
```

**Returns**: Success status.

**Use Cases**:
- Visual feedback during automation
- Debugging element selection
- User guidance
- Verification of element location

---

### 12. ScrollPageTool

**Purpose**: Scroll the page to a specific position, direction, or by viewport pages.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "position": {
      "type": "object",
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" }
      },
      "description": "Specific position to scroll to (x and y coordinates)"
    },
    "pages": {
      "type": "number",
      "description": "Number of viewport pages to scroll (positive for down, negative for up)"
    },
    "direction": {
      "type": "string",
      "enum": ["up", "down", "left", "right", "top", "bottom"],
      "description": "Direction to scroll"
    },
    "amount": {
      "type": "number",
      "description": "Pixel amount to scroll (default: 300)"
    }
  }
}
```

**Usage Example**:
```typescript
// Scroll down one full viewport
await ScrollPageTool.execute({ pages: 1 });

// Scroll to specific position
await ScrollPageTool.execute({
  position: { x: 0, y: 1000 }
});

// Scroll in direction
await ScrollPageTool.execute({
  direction: "down",
  amount: 500
});
```

**Returns**: Current scroll position with viewport info.

**Use Cases**:
- Load more content
- Navigate to specific page sections
- Reveal lazy-loaded elements
- Predictable viewport-based scrolling

---

### 13. SearchContentTool

**Purpose**: Search for text content on the page and return matching elements.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Text to search for"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of matches (default: 5)"
    }
  },
  "required": ["query"]
}
```

**Usage Example**:
```typescript
const results = await SearchContentTool.execute({
  query: "contact us",
  limit: 10
});
```

**Returns**: Array of matching elements with selectors and context.

**Use Cases**:
- Find specific text on page
- Locate elements by content
- Content verification
- Element discovery

---

### 14. TakeScreenshotTool

**Purpose**: Capture a screenshot of the current page or full page.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "fullPage": {
      "type": "boolean",
      "description": "Capture entire page or just viewport (default: false)"
    },
    "reasoning": {
      "type": "string",
      "description": "Reason for taking screenshot"
    }
  }
}
```

**Usage Example**:
```typescript
const screenshot = await TakeScreenshotTool.execute({
  fullPage: true,
  reasoning: "Capture full page layout for analysis"
});
```

**Returns**: Base64-encoded PNG image data.

**Use Cases**:
- Visual analysis
- Layout verification
- Documentation
- Vision model inputs

---

### 15. GetAccessibilityTreeTool

**Purpose**: Get the accessibility tree of the current page.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "reasoning": {
      "type": "string",
      "description": "Reason for getting accessibility tree"
    }
  },
  "required": ["reasoning"]
}
```

**Usage Example**:
```typescript
const tree = await GetAccessibilityTreeTool.execute({
  reasoning: "Analyze page structure for element selection"
});
```

**Returns**: Hierarchical accessibility tree with node IDs and URL mappings.

**Use Cases**:
- Page structure analysis
- Element identification
- Semantic understanding
- Accessibility auditing

---

### 16. PerformActionTool

**Purpose**: Perform actions on DOM elements identified by NodeID.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "method": {
      "type": "string",
      "description": "Action method (click, fill, type, check, uncheck, selectOption, etc.)"
    },
    "nodeId": {
      "type": ["number", "string"],
      "description": "Node ID from accessibility tree"
    },
    "reasoning": {
      "type": "string",
      "description": "Reasoning for the action"
    },
    "args": {
      "type": ["object", "array"],
      "description": "Arguments for the action (e.g., {text: 'value'} for fill)"
    }
  },
  "required": ["method", "nodeId", "reasoning"]
}
```

**Usage Example**:
```typescript
// Fill an input field
await PerformActionTool.execute({
  method: "fill",
  nodeId: 12345,
  reasoning: "Enter search query",
  args: { text: "machine learning" }
});

// Click a button
await PerformActionTool.execute({
  method: "click",
  nodeId: 67890,
  reasoning: "Submit form"
});
```

**Returns**: Action result with page change analysis.

**Use Cases**:
- Browser automation
- Form filling
- Element interaction
- Click actions

---

### 17. NodeIDsToURLsTool

**Purpose**: Get URLs associated with DOM elements by their NodeIDs.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "nodeIds": {
      "type": "array",
      "items": { "type": "number" },
      "description": "Array of node IDs"
    }
  },
  "required": ["nodeIds"]
}
```

**Usage Example**:
```typescript
const urls = await NodeIDsToURLsTool.execute({
  nodeIds: [123, 456, 789]
});
```

**Returns**: Array of node IDs with their associated URLs (if any).

**Use Cases**:
- Extract links from elements
- Map navigation targets
- Link analysis
- URL discovery

---

## Data Collection Tools

Tools for fetching, storing, and searching data.

### 1. FetcherTool

**Purpose**: Make HTTP requests (GET, POST, etc.).

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "URL to fetch"
    },
    "method": {
      "type": "string",
      "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"],
      "description": "HTTP method (default: GET)"
    },
    "headers": {
      "type": "object",
      "description": "Request headers"
    },
    "body": {
      "type": "string",
      "description": "Request body"
    }
  },
  "required": ["url"]
}
```

**Usage Example**:
```typescript
const response = await FetcherTool.execute({
  url: "https://api.example.com/data",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" })
});
```

**Returns**: HTTP response with status, headers, and body.

**Use Cases**:
- API calls
- Data fetching from external sources
- Webhook triggers
- REST API interactions

---

### 2. BookmarkStoreTool

**Purpose**: Store bookmarks for later retrieval.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "URL to bookmark"
    },
    "title": {
      "type": "string",
      "description": "Bookmark title"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Tags for categorization"
    },
    "notes": {
      "type": "string",
      "description": "Additional notes"
    }
  },
  "required": ["url", "title"]
}
```

**Usage Example**:
```typescript
await BookmarkStoreTool.execute({
  url: "https://example.com/article",
  title: "Interesting Article",
  tags: ["research", "ai"],
  notes: "Good reference for project"
});
```

**Returns**: Bookmark ID.

**Use Cases**:
- Research workflows
- Link collection
- Content curation
- Reference management

---

### 3. DocumentSearchTool

**Purpose**: Search stored documents/bookmarks.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query"
    },
    "filters": {
      "type": "object",
      "description": "Filter criteria (tags, date range, etc.)"
    },
    "limit": {
      "type": "number",
      "description": "Maximum results (default: 10)"
    }
  },
  "required": ["query"]
}
```

**Usage Example**:
```typescript
const results = await DocumentSearchTool.execute({
  query: "machine learning",
  filters: { tags: ["research"] },
  limit: 20
});
```

**Returns**: Array of matching documents.

**Use Cases**:
- Finding saved resources
- Research retrieval
- Knowledge base search

---

### 4. GetVisitsByDomainTool

**Purpose**: Retrieve browser visit history for a specific domain.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "domain": {
      "type": "string",
      "description": "Domain to search (e.g., 'example.com')"
    },
    "limit": {
      "type": "number",
      "description": "Maximum visits to return (default: 50)"
    }
  },
  "required": ["domain"]
}
```

**Usage Example**:
```typescript
const visits = await GetVisitsByDomainTool.execute({
  domain: "github.com",
  limit: 100
});
```

**Returns**: Array of visit records with URLs, timestamps, titles.

**Use Cases**:
- Analyzing browsing patterns
- Finding previously visited pages
- Workflow reconstruction

---

### 5. GetVisitsByKeywordTool

**Purpose**: Search visit history by keyword.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "keyword": {
      "type": "string",
      "description": "Keyword to search in URLs and titles"
    },
    "limit": {
      "type": "number",
      "description": "Maximum visits to return (default: 50)"
    }
  },
  "required": ["keyword"]
}
```

**Usage Example**:
```typescript
const visits = await GetVisitsByKeywordTool.execute({
  keyword: "documentation",
  limit: 30
});
```

**Returns**: Array of matching visit records.

**Use Cases**:
- Finding relevant past visits
- Research context retrieval
- Workflow history search

---

### 6. SearchVisitHistoryTool

**Purpose**: Full-text search across visit history.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Full-text search query"
    },
    "startDate": {
      "type": "string",
      "description": "Start date (ISO format)"
    },
    "endDate": {
      "type": "string",
      "description": "End date (ISO format)"
    },
    "limit": {
      "type": "number",
      "description": "Maximum results (default: 50)"
    }
  },
  "required": ["query"]
}
```

**Usage Example**:
```typescript
const visits = await SearchVisitHistoryTool.execute({
  query: "machine learning tutorial",
  startDate: "2024-01-01T00:00:00Z",
  limit: 25
});
```

**Returns**: Ranked array of matching visits.

**Use Cases**:
- Comprehensive history search
- Temporal browsing analysis
- Research reconstruction

---

## File Management Tools

In-memory file system for agent file operations.

### 1. CreateFileTool

**Purpose**: Create a new file in the in-memory file system.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path"
    },
    "content": {
      "type": "string",
      "description": "File content"
    },
    "mimeType": {
      "type": "string",
      "description": "MIME type (default: 'text/plain')"
    }
  },
  "required": ["path", "content"]
}
```

**Usage Example**:
```typescript
await CreateFileTool.execute({
  path: "/reports/analysis.md",
  content: "# Analysis Report\n\n...",
  mimeType: "text/markdown"
});
```

**Returns**: File metadata with ID.

**Use Cases**:
- Storing agent outputs
- Creating reports
- Intermediate data storage
- Multi-agent data sharing

---

### 2. UpdateFileTool

**Purpose**: Update an existing file.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path"
    },
    "content": {
      "type": "string",
      "description": "New content"
    },
    "append": {
      "type": "boolean",
      "description": "Append instead of replace (default: false)"
    }
  },
  "required": ["path", "content"]
}
```

**Usage Example**:
```typescript
await UpdateFileTool.execute({
  path: "/reports/analysis.md",
  content: "\n## Additional Findings\n...",
  append: true
});
```

**Returns**: Updated file metadata.

**Use Cases**:
- Updating reports
- Appending logs
- Modifying agent outputs

---

### 3. DeleteFileTool

**Purpose**: Delete a file from the file system.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path to delete"
    }
  },
  "required": ["path"]
}
```

**Usage Example**:
```typescript
await DeleteFileTool.execute({ path: "/temp/cache.json" });
```

**Returns**: Deletion confirmation.

**Use Cases**:
- Cleanup
- Removing temporary files
- File lifecycle management

---

### 4. ReadFileTool

**Purpose**: Read file contents.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "File path to read"
    }
  },
  "required": ["path"]
}
```

**Usage Example**:
```typescript
const content = await ReadFileTool.execute({ path: "/reports/analysis.md" });
```

**Returns**: File content as string.

**Use Cases**:
- Reading agent outputs
- Loading stored data
- Multi-agent data access

---

### 5. ListFilesTool

**Purpose**: List files in a directory.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "path": {
      "type": "string",
      "description": "Directory path (default: '/')"
    },
    "recursive": {
      "type": "boolean",
      "description": "List recursively (default: false)"
    }
  }
}
```

**Usage Example**:
```typescript
const files = await ListFilesTool.execute({
  path: "/reports",
  recursive: true
});
```

**Returns**: Array of file metadata (path, size, mimeType, created).

**Use Cases**:
- File discovery
- Directory browsing
- File inventory

---

## Quality Assurance Tools

Tools for agent self-assessment and task tracking.

### 1. FinalizeWithCritiqueTool

**Purpose**: Provide final answer with self-assessment.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "answer": {
      "type": "string",
      "description": "Final answer"
    },
    "confidence": {
      "type": "number",
      "description": "Confidence score (0-1)"
    },
    "limitations": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Known limitations"
    }
  },
  "required": ["answer"]
}
```

**Usage Example**:
```typescript
await FinalizeWithCritiqueTool.execute({
  answer: "Based on analysis, recommendation is...",
  confidence: 0.85,
  limitations: ["Limited to public data", "Time constraints"]
});
```

**Returns**: Finalized answer with metadata.

**Use Cases**:
- Transparent AI outputs
- Quality indicators
- Trust building

---

### 2. UpdateTodoTool

**Purpose**: Update agent's task list.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["add", "complete", "update", "remove"],
      "description": "Action to perform"
    },
    "taskId": {
      "type": "string",
      "description": "Task ID (for complete/update/remove)"
    },
    "task": {
      "type": "string",
      "description": "Task description (for add/update)"
    }
  },
  "required": ["action"]
}
```

**Usage Example**:
```typescript
await UpdateTodoTool.execute({
  action: "add",
  task: "Research competitor pricing"
});

await UpdateTodoTool.execute({
  action: "complete",
  taskId: "task-123"
});
```

**Returns**: Updated task list.

**Use Cases**:
- Task tracking
- Progress visibility
- Agent planning

---

## Development Tools

Tools for code execution and debugging.

### 1. ExecuteCodeTool

**Purpose**: Execute JavaScript code in a sandboxed environment.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "JavaScript code to execute"
    },
    "timeout": {
      "type": "number",
      "description": "Execution timeout in ms (default: 5000)"
    }
  },
  "required": ["code"]
}
```

**Usage Example**:
```typescript
const result = await ExecuteCodeTool.execute({
  code: `
    function fibonacci(n) {
      if (n <= 1) return n;
      return fibonacci(n-1) + fibonacci(n-2);
    }
    return fibonacci(10);
  `,
  timeout: 3000
});
```

**Returns**: Execution result or error.

**Use Cases**:
- Code generation validation
- Data transformation
- Custom logic execution
- Prototyping

**Security Note**: Runs in sandboxed environment with restricted access.

---

## Utility Tools

General-purpose utility tools for waiting and high-level planning.

### 1. WaitTool

**Purpose**: Wait for a specified duration to allow page content to load or animations to complete.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "seconds": {
      "type": "number",
      "description": "Number of seconds to wait (0.1 to 300)"
    },
    "duration": {
      "type": "number",
      "description": "Alternative to seconds (same meaning)"
    },
    "reason": {
      "type": "string",
      "description": "Reason for waiting"
    },
    "reasoning": {
      "type": "string",
      "description": "Alternative to reason (same meaning)"
    }
  }
}
```

**Usage Example**:
```typescript
await WaitTool.execute({
  seconds: 2,
  reason: "Wait for dynamic content to load"
});
```

**Returns**: Wait confirmation with viewport summary of what's currently visible.

**Use Cases**:
- Wait for page loads
- Allow animations to complete
- Wait for dynamic content
- Throttle rapid actions

**Note**: After waiting, returns an LLM-generated summary of visible viewport content to help determine if additional waiting is needed.

---

### 2. ThinkingTool

**Purpose**: High-level thinking and planning with visual or accessibility context.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "userRequest": {
      "type": "string",
      "description": "The original user request or goal"
    },
    "context": {
      "type": "string",
      "description": "Optional additional context"
    }
  },
  "required": ["userRequest"]
}
```

**Usage Example**:
```typescript
const plan = await ThinkingTool.execute({
  userRequest: "Find and download Q3 financial reports",
  context: "Currently on company homepage"
});
```

**Returns**:
```json
{
  "visualSummary": "Description of current page state",
  "thingsToDoList": ["Thing 1", "Thing 2", "..."],
  "currentProgress": "Optional progress assessment",
  "observations": "Optional additional notes"
}
```

**Use Cases**:
- High-level planning
- Page analysis
- Strategy formation
- Progress assessment

**Note**: Automatically adapts to use visual analysis (screenshot) for vision-capable models or accessibility tree analysis for text-only models.

---

## Agent Tools (Dynamic)

All `ConfigurableAgentTool`s are available as tools, enabling agent composition. See [Specialized-Agents.md](./Specialized-Agents.md) for details on each agent.

**Available Agent Tools**:
- ActionAgent
- ActionVerificationAgent
- ResearchAgent
- SearchAgent
- WebTaskAgent
- ClickActionAgent
- FormFillActionAgent
- HoverActionAgent
- KeyboardInputActionAgent
- ScrollActionAgent
- DirectURLNavigatorAgent
- ContentWriterAgent
- EcommerceProductInfoAgent

---

## MCP Meta-Tools

Model Context Protocol (MCP) integration tools for discovering and invoking external tools.

### 1. MCPMetaSearchTool

**Purpose**: Search discovered MCP tools by relevance to a query.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "User intent or query describing desired capability"
    },
    "k": {
      "type": "number",
      "description": "Max results to return (default: 8, max: 64)"
    },
    "strategy": {
      "type": "string",
      "enum": ["heuristic", "llm", "hybrid"],
      "description": "Ranking strategy (default: heuristic)"
    },
    "serverId": {
      "type": ["string", "array"],
      "description": "Filter by MCP server ID(s)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional tags for filtering"
    }
  },
  "required": ["query"]
}
```

**Usage Example**:
```typescript
const tools = await MCPMetaSearchTool.execute({
  query: "file system operations",
  k: 5,
  strategy: "llm"
});
```

**Returns**: Array of relevant MCP tools with names, descriptions, and server IDs.

**Use Cases**:
- MCP tool discovery
- Capability-based search
- External tool integration
- Dynamic tool selection

**Ranking Strategies**:
- `heuristic`: Fast keyword-based matching
- `llm`: LLM-based semantic ranking
- `hybrid`: Heuristic pre-filter + LLM ranking

---

### 2. MCPMetaInvokeTool

**Purpose**: Invoke a specific MCP tool by server ID and tool name.

**Schema**:
```json
{
  "type": "object",
  "properties": {
    "serverId": {
      "type": "string",
      "description": "MCP server identifier"
    },
    "toolName": {
      "type": "string",
      "description": "Original MCP tool name (not namespaced)"
    },
    "args": {
      "type": "object",
      "description": "Arguments for the tool"
    }
  },
  "required": ["serverId", "toolName"]
}
```

**Usage Example**:
```typescript
const result = await MCPMetaInvokeTool.execute({
  serverId: "filesystem",
  toolName: "read_file",
  args: { path: "/data/report.json" }
});
```

**Returns**: Result from the invoked MCP tool.

**Use Cases**:
- Execute external tools
- MCP server integration
- Dynamic capability extension
- Tool orchestration

**Note**: Tools are namespaced as `mcp:{serverId}:{toolName}` when registered.

---

## Tool Categories Summary

| Category | Count | Purpose |
|----------|-------|---------|
| **Browser/Page** | 17 | Web page interaction, scrolling, screenshots, accessibility, and actions |
| **Data Collection** | 6 | Fetching, storing, and searching data |
| **File Management** | 5 | In-memory file system operations |
| **Quality Assurance** | 2 | Self-assessment and task tracking |
| **Development** | 1 | Code execution |
| **Utility** | 2 | Waiting and high-level planning |
| **MCP** | 2 | External tool discovery and invocation |
| **Agent** | 13 | Specialized agent composition |

**Total**: 48 tools fully documented

---

## Tool Development Guidelines

### Creating New Tools

1. **Implement Tool Interface**:
```typescript
export class MyNewTool implements Tool<MyArgs, MyResult> {
  name = 'my_new_tool';
  description = 'Clear description of what the tool does';

  schema = {
    type: 'object',
    properties: {
      // Define parameters with types and descriptions
    },
    required: ['param1']
  };

  async execute(args: MyArgs, ctx?: CallCtx): Promise<MyResult> {
    // Implementation
  }
}
```

2. **Register Tool**:
```typescript
ToolRegistry.registerTool('my_new_tool', () => new MyNewTool());
```

3. **Add to Agent Configuration**:
```typescript
tools: ['existing_tool', 'my_new_tool']
```

### Best Practices

- **Clear Descriptions**: Tool descriptions are shown to LLMs; make them actionable
- **Strict Schemas**: Use JSON Schema for type safety and validation
- **Error Handling**: Handle errors gracefully with informative messages
- **Context Usage**: Leverage `CallCtx` for cancellation and tracing
- **Idempotency**: Where possible, make tools idempotent
- **Performance**: Consider timeout and resource usage
- **Testing**: Write comprehensive tests for each tool

---

## Troubleshooting

### Tool Not Available

**Issue**: Agent reports tool not found.

**Solutions**:
- Verify tool is registered in ToolRegistry
- Check agent's tool list includes the tool name
- Ensure tool name matches exactly (case-sensitive)

### Tool Execution Timeout

**Issue**: Tool exceeds execution time limit.

**Solutions**:
- Increase timeout in CallCtx
- Optimize tool implementation
- Break into smaller operations

### Schema Validation Errors

**Issue**: LLM provides invalid arguments.

**Solutions**:
- Review tool description for clarity
- Add examples to tool description
- Strengthen schema constraints
- Add validation in execute method

---

## Related Documentation

- [Architecture.md](./Architecture.md) - Overall system architecture
- [Specialized-Agents.md](./Specialized-Agents.md) - Agent-specific tool usage
- [Development-Guide.md](../Readme.md) - Development setup and practices

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team
