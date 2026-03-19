# CDP Integration Implementation Plan for AI Agent Framework

## Executive Summary

This document outlines the detailed plan for integrating Chrome DevTools Protocol (CDP) capabilities into the AI Chat panel's agent framework. The implementation will enable AI agents to control and interact with web pages programmatically using CDP's internal APIs, **including multi-target support for simultaneous tab research**.

## Key Insights

1. **DevTools already has full internal CDP access** - no WebSocket self-connection or `--remote-debugging-port` flag needed. We'll leverage the existing SDK infrastructure that all DevTools panels use.

2. **Multi-target capability is built-in** - DevTools can access and control multiple browser tabs simultaneously through the Target API and SessionRouter, enabling agents to research across multiple tabs in parallel.

---

## Architecture Overview

### Current State

```
AI Chat Panel
├── Agent Framework (ConfigurableAgentTool, AgentRunner)
├── LLM Integration (OpenAI, LiteLLM)
├── Existing Tools (FetcherTool, HTMLToMarkdownTool, etc.)
└── StateGraph Orchestration
```

### Target State

```
AI Chat Panel
├── Agent Framework
├── LLM Integration
├── CDP Service Layer (NEW)
│   ├── CDPService - Single-target operations & helpers
│   └── CDPTargetManager - Multi-target management
├── CDP-Powered Tools (NEW - 10 tools total)
│   ├── Single-Target Tools (6):
│   │   ├── CDPNavigateTool - Page navigation
│   │   ├── CDPClickTool - Element clicking
│   │   ├── CDPTypeTool - Text input
│   │   ├── CDPEvaluateTool - JavaScript execution
│   │   ├── CDPScreenshotTool - Visual capture
│   │   └── CDPGetPageInfoTool - Page content extraction
│   └── Multi-Target Tools (4):
│       ├── CDPListTargetsTool - List all browser tabs
│       ├── CDPCreateTargetTool - Open new tabs
│       ├── CDPSwitchTargetTool - Switch active target
│       └── CDPAttachToTargetTool - Get session to specific tab
├── Existing Tools
└── StateGraph Orchestration
```

---

## Component Details

### 1. CDPService (`services/CDPService.ts`)

**Purpose**: Centralized service for managing CDP access and providing high-level helpers.

**Responsibilities**:
- Maintain reference to current target (SDK.Target.Target)
- Observe target changes (when tabs/frames change)
- Provide convenient access to protocol agents and SDK models
- Handle errors and edge cases (no target, detached target, etc.)
- Provide high-level helper methods for common operations

**Key Methods**:
```typescript
class CDPService {
  // Initialization
  initialize(): void

  // Single-target management
  getTarget(): SDK.Target.Target
  getPrimaryPageTarget(): SDK.Target.Target | null

  // Multi-target management (NEW)
  listAllTargets(): Promise<Protocol.Target.TargetInfo[]>
  createNewTarget(url: string, background?: boolean): Promise<{targetId: string, target: SDK.Target.Target}>
  attachToTarget(targetId: string): Promise<{sessionId: string, target: SDK.Target.Target}>
  switchActiveTarget(targetId: string): void
  getTargetById(targetId: string): SDK.Target.Target | null
  closeTarget(targetId: string): Promise<void>

  // Protocol agent access (current target)
  getPageAgent(targetId?: string): ProtocolProxyApi.PageApi
  getDOMAgent(targetId?: string): ProtocolProxyApi.DOMApi
  getRuntimeAgent(targetId?: string): ProtocolProxyApi.RuntimeApi
  getInputAgent(targetId?: string): ProtocolProxyApi.InputApi

  // SDK model access (current target)
  getDOMModel(targetId?: string): SDK.DOMModel.DOMModel | null
  getRuntimeModel(targetId?: string): SDK.RuntimeModel.RuntimeModel | null
  getResourceTreeModel(targetId?: string): SDK.ResourceTreeModel.ResourceTreeModel | null

  // High-level helpers (current target)
  navigate(url: string, targetId?: string): Promise<void>
  evaluateJS(expression: string, targetId?: string): Promise<any>
  captureScreenshot(format?: 'png' | 'jpeg', targetId?: string): Promise<string>
  waitForNavigation(timeout?: number, targetId?: string): Promise<void>

  // Element helpers (current target)
  querySelector(selector: string, targetId?: string): Promise<SDK.RemoteObject.RemoteObject | null>
  getElementBoundingBox(selector: string, targetId?: string): Promise<DOMRect | null>

  // Multi-target batch operations (NEW)
  navigateMultiple(targets: Array<{targetId: string, url: string}>): Promise<void[]>
  evaluateInAllTargets(expression: string, targetIds: string[]): Promise<any[]>
  closeAllTargets(excludeActiveTab?: boolean): Promise<void>
}
```

**Dependencies**:
- `core/sdk/sdk.js` - SDK module with all protocol bindings
- `core/Logger.js` - Logging infrastructure

---

### 2. CDP-Powered Tools

Each tool implements the `Tool<TArgs, TResult>` interface and uses CDPService for CDP operations.

#### 2.1 CDPNavigateTool (`tools/cdp/CDPNavigateTool.ts`)

**Purpose**: Navigate to URLs using CDP Page.navigate

**Schema**:
```typescript
{
  url: string;        // URL to navigate to
  reasoning: string;  // Explanation for user
  waitForLoad?: boolean; // Wait for page load (default: true)
}
```

**Implementation**:
- Use `Page.navigate()` protocol method
- Optionally wait for `Page.loadEventFired` or use ResourceTreeModel events
- Return navigation metadata (final URL, title)

**Error Handling**:
- Invalid URL
- Navigation timeout
- Navigation errors (404, 500, etc.)

#### 2.2 CDPClickTool (`tools/cdp/CDPClickTool.ts`)

**Purpose**: Click elements using CDP Input.dispatchMouseEvent

**Schema**:
```typescript
{
  selector: string;   // CSS selector for element
  reasoning: string;  // Explanation for user
  clickCount?: number; // Single/double click (default: 1)
}
```

**Implementation Steps**:
1. Evaluate `document.querySelector(selector)` via Runtime
2. Push object to DOM model to get nodeId
3. Scroll element into view using `DOM.scrollIntoViewIfNeeded`
4. Get bounding box via `DOM.getBoxModel`
5. Calculate center point coordinates
6. Dispatch mousePressed and mouseReleased events
7. Clean up remote objects

**Error Handling**:
- Element not found
- Element not visible
- Element not clickable (covered by another element)

#### 2.3 CDPTypeTool (`tools/cdp/CDPTypeTool.ts`)

**Purpose**: Type text into elements using CDP Input.insertText and Input.dispatchKeyEvent

**Schema**:
```typescript
{
  selector: string;   // CSS selector for input element
  text: string;       // Text to type
  reasoning: string;  // Explanation for user
  clearFirst?: boolean; // Clear existing text (default: true)
}
```

**Implementation Steps**:
1. Find element and click it to focus
2. If clearFirst, select all and delete (Ctrl+A, Backspace)
3. Use `Input.insertText()` for bulk text or
4. Use `Input.dispatchKeyEvent()` for character-by-character typing
5. Verify text was entered (optional)

**Error Handling**:
- Element not found
- Element not focusable
- Element is disabled/readonly

#### 2.4 CDPEvaluateTool (`tools/cdp/CDPEvaluateTool.ts`)

**Purpose**: Execute JavaScript in page context using CDP Runtime.evaluate

**Schema**:
```typescript
{
  expression: string;  // JavaScript code to execute
  reasoning: string;   // Explanation for user
  returnByValue?: boolean; // Return primitive value vs object reference
  awaitPromise?: boolean;  // Await if result is Promise
}
```

**Implementation**:
- Use RuntimeModel.evaluate() or Runtime.evaluate() directly
- Handle primitive return values and object references
- Serialize results appropriately
- Capture exceptions and runtime errors

**Error Handling**:
- JavaScript syntax errors
- Runtime exceptions
- Security errors (CSP violations)

#### 2.5 CDPScreenshotTool (`tools/cdp/CDPScreenshotTool.ts`)

**Purpose**: Capture page screenshots using CDP Page.captureScreenshot

**Schema**:
```typescript
{
  reasoning: string;   // Explanation for user
  format?: 'png' | 'jpeg'; // Image format (default: 'png')
  quality?: number;    // JPEG quality 0-100
  fullPage?: boolean;  // Capture full scrollable page
  selector?: string;   // Capture specific element only
}
```

**Implementation**:
- Use `Page.captureScreenshot()` for viewport/full page
- For element screenshots, use `Page.captureScreenshot()` with clip parameter
- Return base64-encoded image data
- Optionally save to file or display inline

**Error Handling**:
- Screenshot capture failure
- Element not found (for selector mode)

#### 2.6 CDPGetPageInfoTool (`tools/cdp/CDPGetPageInfoTool.ts`)

**Purpose**: Extract page information (URL, title, HTML, metadata)

**Schema**:
```typescript
{
  reasoning: string;     // Explanation for user
  includeHTML?: boolean; // Include full HTML (default: false)
  includeMetadata?: boolean; // Include meta tags (default: true)
}
```

**Implementation**:
- Get URL from ResourceTreeModel or Runtime.evaluate('location.href')
- Get title from Runtime.evaluate('document.title')
- Optionally get HTML from Runtime.evaluate('document.documentElement.outerHTML')
- Extract metadata (description, keywords, og:tags) via evaluation
- Return structured data

**Error Handling**:
- Page not loaded
- Cross-origin restrictions

#### 2.7 CDPListTargetsTool (`tools/cdp/CDPListTargetsTool.ts`) - NEW

**Purpose**: List all open browser tabs/targets for multi-tab operations

**Schema**:
```typescript
{
  reasoning: string;        // Explanation for user
  filter?: 'page' | 'all';  // Filter by type (default: 'page')
  includeDevTools?: boolean; // Include DevTools targets (default: false)
}
```

**Implementation**:
- Use `Target.getTargets()` protocol method via TargetManager
- Filter results by type (page, worker, service-worker, etc.)
- Return array of {targetId, url, title, type, attached}
- Sort by creation time or activity

**Error Handling**:
- Target enumeration failure
- Permission denied

**Result Format**:
```typescript
{
  targets: Array<{
    targetId: string;
    url: string;
    title: string;
    type: string;
    attached: boolean;
  }>;
  count: number;
}
```

#### 2.8 CDPCreateTargetTool (`tools/cdp/CDPCreateTargetTool.ts`) - NEW

**Purpose**: Create new browser tabs programmatically

**Schema**:
```typescript
{
  url: string;           // URL to open in new tab
  reasoning: string;     // Explanation for user
  background?: boolean;  // Open in background (default: false)
  newWindow?: boolean;   // Open new window instead of tab (default: false)
  width?: number;        // Window width (if newWindow=true)
  height?: number;       // Window height (if newWindow=true)
}
```

**Implementation**:
- Use `Target.createTarget()` protocol method
- Optionally wait for target to be ready
- Return targetId for future operations
- Automatically attach to created target

**Error Handling**:
- Target creation failure
- Invalid URL
- Resource limits (too many tabs)

**Result Format**:
```typescript
{
  targetId: string;
  url: string;
  success: boolean;
  error?: string;
}
```

#### 2.9 CDPSwitchTargetTool (`tools/cdp/CDPSwitchTargetTool.ts`) - NEW

**Purpose**: Switch the active/default target for subsequent CDP operations

**Schema**:
```typescript
{
  targetId: string;      // Target to switch to
  reasoning: string;     // Explanation for user
  activate?: boolean;    // Bring tab to foreground (default: false)
}
```

**Implementation**:
- Update CDPService's active target reference
- Optionally use `Target.activateTarget()` to bring to foreground
- Validate target exists and is attached
- Return previous target info for stack-based switching

**Error Handling**:
- Target not found
- Target not attached
- Target crashed/closed

**Result Format**:
```typescript
{
  previousTargetId: string;
  currentTargetId: string;
  success: boolean;
}
```

#### 2.10 CDPAttachToTargetTool (`tools/cdp/CDPAttachToTargetTool.ts`) - NEW

**Purpose**: Create CDP session to specific tab for direct messaging

**Schema**:
```typescript
{
  targetId: string;      // Target to attach to
  reasoning: string;     // Explanation for user
  flatten?: boolean;     // Use flattened session (default: true)
}
```

**Implementation**:
- Use `Target.attachToTarget({targetId, flatten: true})`
- Store sessionId in CDPService's target registry
- Return session info for advanced use cases
- Handle existing attachments gracefully

**Error Handling**:
- Target not found
- Already attached
- Permission denied

**Result Format**:
```typescript
{
  targetId: string;
  sessionId: string;
  attached: boolean;
  success: boolean;
}
```

---

## File Structure

```
front_end/panels/ai_chat/
├── services/
│   ├── CDPService.ts (NEW)
│   └── BUILD.gn (UPDATE - add CDPService)
├── tools/
│   ├── cdp/ (NEW DIRECTORY)
│   │   ├── Single-Target Tools:
│   │   │   ├── CDPNavigateTool.ts
│   │   │   ├── CDPClickTool.ts
│   │   │   ├── CDPTypeTool.ts
│   │   │   ├── CDPEvaluateTool.ts
│   │   │   ├── CDPScreenshotTool.ts
│   │   │   └── CDPGetPageInfoTool.ts
│   │   ├── Multi-Target Tools (NEW):
│   │   │   ├── CDPListTargetsTool.ts
│   │   │   ├── CDPCreateTargetTool.ts
│   │   │   ├── CDPSwitchTargetTool.ts
│   │   │   └── CDPAttachToTargetTool.ts
│   │   └── BUILD.gn (NEW)
│   ├── Tools.ts (UPDATE - export all 10 CDP tools)
│   └── BUILD.gn (UPDATE - add cdp dependency)
├── agent_framework/
│   └── implementation/
│       └── ConfiguredAgents.ts (UPDATE - use CDP tools in agents)
├── ai_chat_impl.ts (UPDATE - initialize CDPService)
├── BUILD.gn (UPDATE - add services dependency)
└── CDP_IMPLEMENTATION_PLAN.md (THIS FILE)
```

---

## Implementation Steps

### Phase 1: Core Infrastructure

#### Step 1.1: Create CDPService
- [ ] Create `services/CDPService.ts`
- [ ] Implement target management (initialize, observe changes)
- [ ] Implement protocol agent accessors
- [ ] Implement SDK model accessors
- [ ] Implement high-level helper methods
- [ ] Add error handling and logging
- [ ] Add TypeScript types and JSDoc comments

#### Step 1.2: Update Build Configuration
- [ ] Create `services/BUILD.gn` or update existing
- [ ] Add dependencies on `core/sdk`, `core/common`, etc.
- [ ] Ensure proper TypeScript compilation

#### Step 1.3: Initialize CDPService in Panel
- [ ] Update `ai_chat_impl.ts` to import CDPService
- [ ] Create singleton instance or service instance
- [ ] Call initialize() on panel creation
- [ ] Pass CDPService to tools that need it

### Phase 2: Implement CDP Tools

#### Step 2.1: CDPNavigateTool
- [ ] Create `tools/cdp/CDPNavigateTool.ts`
- [ ] Implement Tool interface
- [ ] Define schema with url, reasoning, waitForLoad
- [ ] Implement execute() using CDPService
- [ ] Add navigation timeout handling
- [ ] Add tests

#### Step 2.2: CDPClickTool
- [ ] Create `tools/cdp/CDPClickTool.ts`
- [ ] Implement element location logic (querySelector + getBoxModel)
- [ ] Implement scroll-into-view
- [ ] Implement mouse event dispatching
- [ ] Add error handling for element not found/visible
- [ ] Add tests

#### Step 2.3: CDPTypeTool
- [ ] Create `tools/cdp/CDPTypeTool.ts`
- [ ] Implement focus logic (reuse click logic)
- [ ] Implement text clearing (Ctrl+A, Backspace)
- [ ] Implement text insertion (Input.insertText)
- [ ] Add tests

#### Step 2.4: CDPEvaluateTool
- [ ] Create `tools/cdp/CDPEvaluateTool.ts`
- [ ] Implement JavaScript evaluation
- [ ] Handle return values (primitives vs objects)
- [ ] Handle exceptions
- [ ] Add tests with various JS snippets

#### Step 2.5: CDPScreenshotTool
- [ ] Create `tools/cdp/CDPScreenshotTool.ts`
- [ ] Implement viewport screenshot
- [ ] Implement full-page screenshot
- [ ] Implement element-specific screenshot (with clip)
- [ ] Add tests

#### Step 2.6: CDPGetPageInfoTool
- [ ] Create `tools/cdp/CDPGetPageInfoTool.ts`
- [ ] Implement URL/title extraction
- [ ] Implement HTML extraction
- [ ] Implement metadata extraction
- [ ] Add tests

#### Step 2.7: CDPListTargetsTool (NEW - Multi-Target)
- [ ] Create `tools/cdp/CDPListTargetsTool.ts`
- [ ] Implement Target.getTargets() integration
- [ ] Add filtering by target type (page, worker, etc.)
- [ ] Format results with targetId, url, title, type
- [ ] Add tests for target enumeration

#### Step 2.8: CDPCreateTargetTool (NEW - Multi-Target)
- [ ] Create `tools/cdp/CDPCreateTargetTool.ts`
- [ ] Implement Target.createTarget() integration
- [ ] Add support for background/foreground tabs
- [ ] Add support for new windows vs tabs
- [ ] Handle automatic attachment to created target
- [ ] Add tests

#### Step 2.9: CDPSwitchTargetTool (NEW - Multi-Target)
- [ ] Create `tools/cdp/CDPSwitchTargetTool.ts`
- [ ] Implement active target switching in CDPService
- [ ] Add Target.activateTarget() for bringing tabs to foreground
- [ ] Implement target validation
- [ ] Add tests for target switching

#### Step 2.10: CDPAttachToTargetTool (NEW - Multi-Target)
- [ ] Create `tools/cdp/CDPAttachToTargetTool.ts`
- [ ] Implement Target.attachToTarget() integration
- [ ] Store sessionId in CDPService target registry
- [ ] Handle existing attachments gracefully
- [ ] Add tests

### Phase 2B: Enhance Existing Tools for Multi-Target (NEW)

#### Step 2.11: Add targetId parameter to existing tools
- [ ] Update CDPNavigateTool to accept optional targetId
- [ ] Update CDPClickTool to accept optional targetId
- [ ] Update CDPTypeTool to accept optional targetId
- [ ] Update CDPEvaluateTool to accept optional targetId
- [ ] Update CDPScreenshotTool to accept optional targetId
- [ ] Update CDPGetPageInfoTool to accept optional targetId
- [ ] Maintain backward compatibility (default to current target)
- [ ] Add tests for multi-target operations

### Phase 3: Integration

#### Step 3.1: Register Tools
- [ ] Update `tools/Tools.ts` to export CDP tools
- [ ] Update `tools/BUILD.gn` to include cdp directory
- [ ] Verify all imports work correctly

#### Step 3.2: Update Agent Configurations
- [ ] Update `ConfiguredAgents.ts` to include CDP tools in tool lists
- [ ] Create or update agents that use browser automation:
  - WebTaskAgent - uses navigate, click, type
  - ResearchAgent - uses navigate, screenshot, getPageInfo
  - ExtractionAgent - uses evaluate, getPageInfo
- [ ] Test agents with CDP tools

#### Step 3.3: Update BUILD.gn Files
- [ ] Create `tools/cdp/BUILD.gn`
- [ ] Update `tools/BUILD.gn`
- [ ] Update `ai_chat/BUILD.gn`
- [ ] Ensure dependency chain is correct

### Phase 4: Testing & Documentation

#### Step 4.1: Unit Tests
- [ ] Write tests for CDPService
- [ ] Write tests for each CDP tool
- [ ] Mock SDK.Target and protocol agents where needed
- [ ] Achieve >80% code coverage

#### Step 4.2: Integration Tests
- [ ] Test complete agent workflows using CDP tools
- [ ] Test error handling (element not found, navigation failures)
- [ ] Test with real pages in different states
- [ ] Test abort signal handling

#### Step 4.3: Documentation
- [ ] Add JSDoc comments to all public methods
- [ ] Create usage examples for each tool
- [ ] Update existing docs/devtools_ai_agent.md
- [ ] Document common patterns and best practices

---

## Integration Points

### 1. Tool Registration

Tools are registered with the ToolRegistry in the agent framework. CDP tools will follow the same pattern:

```typescript
// In ai_chat_impl.ts or initialization code
import { CDPNavigateTool } from './tools/cdp/CDPNavigateTool.js';
import { CDPClickTool } from './tools/cdp/CDPClickTool.js';
// ... other CDP tools

const cdpService = new CDPService();
cdpService.initialize();

// Register tools with access to CDPService
ToolRegistry.register(new CDPNavigateTool(cdpService));
ToolRegistry.register(new CDPClickTool(cdpService));
// ... register other tools
```

### 2. Agent Configuration

Agents are configured to use specific tools. Update ConfiguredAgents.ts:

```typescript
function createWebTaskAgentConfig(): AgentToolConfig {
  return {
    name: 'web_task_agent',
    description: 'Executes tasks on web pages',
    systemPrompt: `You are a web automation agent...`,
    tools: [
      // Single-target tools
      'cdp_navigate',    // CDP navigation
      'cdp_click',       // CDP clicking
      'cdp_type',        // CDP typing
      'cdp_evaluate',    // CDP JavaScript execution
      'cdp_screenshot',  // CDP screenshots
      'cdp_get_page_info', // CDP page info
      // Multi-target tools (NEW)
      'cdp_list_targets',   // List all tabs
      'cdp_create_target',  // Open new tabs
      'cdp_switch_target',  // Switch between tabs
      'cdp_attach_to_target', // Attach to specific tabs
    ],
    maxIterations: 20,  // Increased for multi-tab workflows
  };
}

function createResearchAgentConfig(): AgentToolConfig {
  return {
    name: 'research_agent',
    description: 'Researches topics across multiple sources simultaneously',
    systemPrompt: `You are a research agent capable of gathering information
                   from multiple web sources in parallel...`,
    tools: [
      'cdp_create_target',  // Open multiple sources
      'cdp_navigate',       // Navigate in each tab
      'cdp_get_page_info',  // Extract content
      'cdp_screenshot',     // Capture visuals
      'cdp_list_targets',   // Track open tabs
      'cdp_switch_target',  // Switch between sources
    ],
    maxIterations: 30,  // Higher for multi-source research
  };
}
```

### 3. LLM Context Propagation

Tools receive LLMContext with abort signals for cancellation:

```typescript
async execute(args: ToolArgs, ctx?: LLMContext): Promise<ToolResult> {
  const signal = ctx?.abortSignal;

  // Check for abort before expensive operations
  if (signal?.aborted) {
    throw new DOMException('Operation aborted', 'AbortError');
  }

  // Perform CDP operations
  await this.cdpService.navigate(args.url);

  // Check again after async operation
  if (signal?.aborted) {
    throw new DOMException('Operation aborted', 'AbortError');
  }
}
```

---

## Technical Considerations

### 1. Target Management

**Challenge**: Pages can navigate, close, or crash. Targets can become detached.

**Solution**:
- CDPService observes TargetManager events
- Update current target when primary page changes
- Gracefully handle detached targets (throw descriptive error)
- Optionally reconnect to new primary target

### 2. Multi-Frame Support

**Challenge**: Pages can have iframes. Which frame to operate on?

**Solution**:
- Default to main frame (primary execution context)
- For advanced use cases, add frameId parameter to tool schemas
- Use RuntimeModel.executionContexts() to find specific frames

### 7. Multi-Target Session Management (NEW)

**Challenge**: Managing CDP sessions across multiple tabs simultaneously.

**Solution**:
- CDPService maintains map of targetId → {target, sessionId, attached}
- SessionRouter handles message multiplexing via sessionId field
- Each CDP command includes sessionId to route to correct tab
- Automatic cleanup when targets are closed or detached
- Handle target lifecycle events (targetCreated, targetDestroyed, targetCrashed)

**Pattern**:
```typescript
class CDPService {
  private targetRegistry = new Map<string, {
    target: SDK.Target.Target,
    sessionId: string,
    attached: boolean,
    createdAt: number
  }>();

  async attachToTarget(targetId: string) {
    const {sessionId} = await this.browserTarget.targetAgent()
      .invoke_attachToTarget({targetId, flatten: true});

    const target = SDK.TargetManager.instance().targetById(targetId);
    this.targetRegistry.set(targetId, {
      target, sessionId, attached: true, createdAt: Date.now()
    });

    return {sessionId, target};
  }
}
```

### 8. Parallel Operations (NEW)

**Challenge**: Executing operations across multiple tabs simultaneously without blocking.

**Solution**:
- Use Promise.all() for truly parallel operations
- Implement rate limiting to avoid overwhelming browser
- Use AbortController for canceling multi-target operations
- Handle partial failures gracefully (some tabs succeed, others fail)

**Example Pattern**:
```typescript
async function parallelNavigate(urls: string[]): Promise<Results[]> {
  // Create targets in parallel
  const targets = await Promise.all(
    urls.map(url => cdpService.createNewTarget(url, true))
  );

  // Navigate all tabs simultaneously
  const results = await Promise.allSettled(
    targets.map(t => cdpService.navigate(url, t.targetId))
  );

  // Handle partial failures
  return results.map((r, i) => ({
    targetId: targets[i].targetId,
    success: r.status === 'fulfilled',
    error: r.status === 'rejected' ? r.reason : undefined
  }));
}
```

### 9. Resource Management (NEW)

**Challenge**: Opening many tabs can consume significant memory and CPU.

**Solution**:
- Implement tab limits (e.g., max 10 concurrent research tabs)
- Close tabs when done with cdpService.closeTarget(targetId)
- Provide closeAllTargets() helper for batch cleanup
- Monitor resource usage and warn when approaching limits
- Consider tab pooling/reuse for sequential operations

### 3. Event Timing

**Challenge**: CDP operations are async. Pages load asynchronously.

**Solution**:
- Provide waitForNavigation() helper in CDPService
- Use ResourceTreeModel events (Load, DOMContentLoaded)
- Add timeout parameters where appropriate
- Use Common.EventTarget.waitForEvent() for waiting on specific events

### 4. Error Handling

**Challenge**: Many things can fail (network errors, element not found, JS errors).

**Solution**:
- Each tool returns structured result with success flag and optional error message
- Log errors with context for debugging
- Provide actionable error messages to LLM
- Allow agents to retry or take alternative actions

### 5. Security & Sandboxing

**Challenge**: Running arbitrary JavaScript via CDP could be risky.

**Solution**:
- DevTools already runs in trusted context - same security as manual DevTools usage
- CDP operations are limited to inspected page (already sandboxed by Chromium)
- No additional security concerns beyond normal DevTools usage
- Document best practices for agents (validate input, sanitize selectors)

### 6. Performance

**Challenge**: CDP calls can be slow, especially on complex pages.

**Solution**:
- Use SDK models when available (they cache data)
- Batch operations where possible (multiple evaluations in one call)
- Add timeout parameters to prevent hanging
- Consider parallelizing independent operations

---

## Example Usage

### Example 1: Navigate and Extract Data

```typescript
// Agent uses CDP tools to navigate and extract
const navigateResult = await tools.cdp_navigate.execute({
  url: 'https://example.com',
  reasoning: 'Navigating to example.com to extract data',
  waitForLoad: true
});

const pageInfo = await tools.cdp_get_page_info.execute({
  reasoning: 'Extracting page information',
  includeHTML: false,
  includeMetadata: true
});

console.log(pageInfo.title); // "Example Domain"
console.log(pageInfo.url);   // "https://example.com"
```

### Example 2: Fill Form and Submit

```typescript
// Navigate to form page
await tools.cdp_navigate.execute({
  url: 'https://example.com/form',
  reasoning: 'Opening form page'
});

// Fill in text fields
await tools.cdp_type.execute({
  selector: '#name',
  text: 'John Doe',
  reasoning: 'Entering name'
});

await tools.cdp_type.execute({
  selector: '#email',
  text: 'john@example.com',
  reasoning: 'Entering email'
});

// Click submit button
await tools.cdp_click.execute({
  selector: 'button[type="submit"]',
  reasoning: 'Submitting form'
});

// Wait and capture result
await tools.cdp_screenshot.execute({
  reasoning: 'Capturing result page',
  format: 'png'
});
```

### Example 3: Execute Custom JavaScript

```typescript
// Extract data using custom JavaScript
const result = await tools.cdp_evaluate.execute({
  expression: `
    Array.from(document.querySelectorAll('h2'))
      .map(h => h.textContent.trim())
  `,
  reasoning: 'Extracting all h2 headings',
  returnByValue: true
});

console.log(result); // ["Heading 1", "Heading 2", ...]
```

---

## Testing Strategy

### Unit Tests

**Location**: `front_end/panels/ai_chat/tests/`

**Coverage**:
- CDPService initialization and target management
- Each CDP tool's execute() method
- Error handling paths
- Edge cases (no target, detached target, element not found)

**Mocking**:
- Mock SDK.TargetManager
- Mock SDK.Target
- Mock protocol agents (pageAgent, domAgent, etc.)
- Mock SDK models when needed

### Integration Tests

**Location**: `front_end/panels/ai_chat/integration_tests/`

**Coverage**:
- Complete agent workflows using CDP tools
- Multi-step interactions (navigate → click → type → submit)
- Error recovery and retry logic
- Abort signal handling

**Test Environment**:
- Use test fixtures (simple HTML pages)
- Run in headless mode if possible
- Verify results using assertions on page state

### Manual Testing

**Scenarios**:
- Open AI Chat panel
- Test each CDP tool individually via direct invocation
- Test agents that use CDP tools
- Verify error messages are helpful
- Test with complex real-world websites
- Test with slow networks (throttling)

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1-2)
- Implement core CDPService and 2-3 basic tools
- Test with simple agents
- Gather feedback from team
- Fix critical bugs

### Phase 2: Full Implementation (Week 3-4)
- Implement remaining tools
- Integrate with all relevant agents
- Write comprehensive tests
- Update documentation

### Phase 3: Beta Testing (Week 5)
- Enable for internal users
- Monitor for errors and performance issues
- Collect usage data and feedback
- Iterate on tool implementations

### Phase 4: Production Release (Week 6+)
- Deploy to production
- Monitor metrics (tool usage, error rates, latency)
- Optimize based on real-world usage
- Add new CDP tools as needed

---

## Success Metrics

1. **Functionality**:
   - All 6 CDP tools implemented and working
   - >90% success rate for common operations
   - <100ms latency for simple CDP operations

2. **Code Quality**:
   - >80% test coverage
   - Zero critical bugs
   - All code reviewed and approved

3. **Agent Capability**:
   - Agents can successfully automate web tasks
   - Agents use CDP tools appropriately
   - Error handling allows agents to recover gracefully

4. **Developer Experience**:
   - Clear documentation and examples
   - Easy to add new CDP-based tools
   - Helpful error messages for debugging

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Advanced CDP Tools**:
   - CDPWaitForElementTool - Wait for element to appear/disappear
   - CDPScrollTool - Scroll to coordinates or elements
   - CDPHoverTool - Hover over elements
   - CDPSelectTool - Interact with `<select>` dropdowns
   - CDPUploadFileTool - Upload files via CDP

2. **Network Interception**:
   - CDPInterceptNetworkTool - Intercept and modify network requests
   - CDPBlockResourcesTool - Block images, scripts, CSS for faster loading
   - CDPThrottleNetworkTool - Simulate slow network conditions

3. **Performance Monitoring**:
   - CDPGetPerformanceMetricsTool - Extract Core Web Vitals
   - CDPProfileTool - CPU/memory profiling
   - CDPTraceTool - Capture performance traces

4. **Advanced Debugging**:
   - CDPSetBreakpointTool - Set JavaScript breakpoints
   - CDPDebuggerTool - Step through JavaScript execution
   - CDPConsoleMonitorTool - Monitor console messages in real-time

5. **Multi-Frame Support**:
   - Add frameId parameter to all tools
   - CDPListFramesTool - List all frames on page
   - CDPSwitchFrameTool - Switch context to specific frame

6. **Storage & Cookies**:
   - CDPGetCookiesTool - Read cookies
   - CDPSetCookiesTool - Set cookies
   - CDPClearStorageTool - Clear localStorage, sessionStorage, etc.

---

## Risk Mitigation

### Risk 1: CDP API Changes
**Impact**: High
**Probability**: Low
**Mitigation**:
- Use SDK abstractions (less likely to break)
- Monitor Chromium commits for CDP changes
- Maintain compatibility layer if needed

### Risk 2: Performance Issues
**Impact**: Medium
**Probability**: Medium
**Mitigation**:
- Add timeout parameters
- Use caching via SDK models
- Profile and optimize slow operations
- Consider parallel execution for independent ops

### Risk 3: Target Detachment
**Impact**: Medium
**Probability**: Medium
**Mitigation**:
- Detect detached targets and throw clear errors
- Allow agents to retry operations
- Implement auto-reconnect for new primary target

### Risk 4: Complex Page Interactions
**Impact**: Medium
**Probability**: High
**Mitigation**:
- Start with simple, reliable interactions
- Add more complex tools iteratively
- Provide fallback mechanisms (e.g., JavaScript execution for complex scenarios)
- Document limitations clearly

---

## Conclusion

This implementation plan provides a structured approach to integrating CDP capabilities into the AI Chat panel's agent framework. By leveraging DevTools' existing SDK infrastructure, we can provide powerful browser automation capabilities without additional security risks or complex setup.

The phased approach allows for iterative development, testing, and refinement, ensuring a robust and reliable implementation that enhances the agent framework's capabilities significantly.

---

## Appendix A: CDP Protocol Domains

Key CDP domains we'll use:

- **Page**: Navigation, lifecycle, screenshots, resource loading
- **DOM**: Element queries, manipulation, box model
- **Runtime**: JavaScript evaluation, object inspection
- **Input**: Mouse, keyboard, touch events
- **Network**: Request interception, response modification
- **Accessibility**: Accessibility tree queries
- **Target**: Multi-target management
- **Browser**: Browser-level operations
- **Overlay**: Visual highlighting and overlays

## Appendix B: SDK Models Reference

Key SDK models we'll use:

- **SDK.TargetManager**: Manages all targets (pages, workers, etc.)
- **SDK.Target**: Represents a debugging target
- **SDK.DOMModel**: High-level DOM operations
- **SDK.RuntimeModel**: JavaScript execution and object management
- **SDK.ResourceTreeModel**: Page resources and navigation events
- **SDK.NetworkManager**: Network request management
- **SDK.AccessibilityModel**: Accessibility tree

## Appendix C: References

- DevTools Frontend Documentation
- Chrome DevTools Protocol Documentation: https://chromedevtools.github.io/devtools-protocol/
- Chromium Source: `/chromium/src/third_party/devtools-frontend/`
- Existing AI Chat Panel Implementation: `/new-devtools/devtools-frontend/front_end/panels/ai_chat/`
