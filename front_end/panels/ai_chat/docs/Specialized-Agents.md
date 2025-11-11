# Specialized Agents Reference

Comprehensive guide to all specialized agents in the AI Chat multi-agent framework.

## Table of Contents

1. [Overview](#overview)
2. [Agent Architecture](#agent-architecture)
3. [Action Agents](#action-agents)
4. [Research Agents](#research-agents)
5. [Orchestration Agents](#orchestration-agents)
6. [Content Agents](#content-agents)
7. [E-Commerce Agents](#e-commerce-agents)
8. [Agent Handoffs](#agent-handoffs)
9. [Creating Custom Agents](#creating-custom-agents)

---

## Overview

The AI Chat framework includes 13+ specialized agents, each designed for specific tasks. Agents can be invoked by the primary orchestrator or by other agents through the handoff mechanism.

### Agent Types

| Category | Agents | Purpose |
|----------|--------|---------|
| **Action** | 6 agents | Browser interactions |
| **Research** | 2 agents | Information gathering |
| **Orchestration** | 2 agents | Multi-step workflows |
| **Content** | 1 agent | Content creation |
| **E-Commerce** | 1 agent | Product information |
| **Navigation** | 1 agent | URL navigation |

**Total**: 13+ specialized agents

---

## Agent Architecture

### ConfigurableAgentTool

All specialized agents are implemented as `ConfigurableAgentTool` instances:

```typescript
interface AgentToolConfig {
  name: string;                      // Agent identifier
  description: string;               // Agent purpose (shown to LLM)
  systemPrompt: string;              // Agent instructions
  tools: string[];                   // Available tool names
  version?: string;                  // Agent version
  handoffs?: HandoffConfig[];        // Handoff configuration
  maxIterations?: number;            // Iteration limit
  modelName?: string | (() => string); // LLM to use
  temperature?: number;              // Sampling temperature
  schema: JSONSchema;                // Input schema
}
```

### Execution Model

Agents execute via `AgentRunner`:

```
1. Initialize with system prompt
2. Iteration loop:
   a. Call LLM with current context
   b. Parse response (tool calls or final answer)
   c. Execute tools
   d. Update context
   e. Check termination conditions
3. Return result or handoff
```

### Termination Conditions

- **Final Answer**: Agent provides final response
- **Max Iterations**: Reached iteration limit
- **Handoff**: Transfers to another agent
- **Error**: Execution error occurred
- **Abort**: User cancelled execution

---

## Action Agents

Agents for executing browser actions.

### ActionAgent

**Purpose**: General-purpose browser action execution.

**Description**: Executes a wide variety of browser actions including clicks, form fills, navigation, scrolling, and keyboard input.

**Tools**:
- ClickActionAgent (via handoff)
- FormFillActionAgent (via handoff)
- HoverActionAgent (via handoff)
- KeyboardInputActionAgent (via handoff)
- ScrollActionAgent (via handoff)
- NavigateURLTool
- VisualIndicatorTool
- FullPageAccessibilityTreeToMarkdownTool

**Configuration**:
```typescript
{
  name: 'ActionAgent',
  description: 'Executes browser actions like clicking, filling forms, navigating, scrolling',
  systemPrompt: `You are an action execution agent...`,
  tools: ['click', 'form_fill', 'hover', 'keyboard', 'scroll', 'navigate'],
  handoffs: [
    { targetAgent: 'ClickActionAgent', condition: 'click required' },
    { targetAgent: 'FormFillActionAgent', condition: 'form input required' },
    // ...
  ],
  maxIterations: 5
}
```

**Use Cases**:
- General browser automation
- Multi-action workflows
- Action coordination
- High-level action planning

**Example**:
```typescript
const result = await ActionAgent.execute({
  task: "Fill out the contact form and submit",
  context: {
    url: "https://example.com/contact",
    accessibilityTree: a11yTree
  }
});
```

**Best Practices**:
- Use for multi-step action sequences
- Let it delegate to specialized action agents
- Provide accessibility tree for context
- Use visual indicators for verification

---

### ClickActionAgent

**Purpose**: Specialized agent for click actions.

**Description**: Identifies and clicks on elements with high accuracy using accessibility tree and visual indicators.

**Tools**:
- VisualIndicatorTool
- FullPageAccessibilityTreeToMarkdownTool
- DOM inspection tools

**Configuration**:
```typescript
{
  name: 'ClickActionAgent',
  description: 'Clicks on elements with precision using accessibility tree',
  systemPrompt: `You are a click action specialist...`,
  tools: ['visual_indicator', 'a11y_tree', 'dom_inspect'],
  maxIterations: 3
}
```

**Use Cases**:
- Button clicks
- Link activation
- Menu item selection
- Element interaction

**Example**:
```typescript
const result = await ClickActionAgent.execute({
  targetDescription: "Submit button",
  context: { accessibilityTree: tree }
});
```

**Best Practices**:
- Provide clear element descriptions
- Use accessibility roles when possible
- Verify click with visual indicators
- Handle dynamic elements (wait for load)

---

### FormFillActionAgent

**Purpose**: Intelligent form filling.

**Description**: Detects form fields, understands input types, fills with appropriate data, and handles validation.

**Tools**:
- Form detection tools
- Input field analysis
- Validation checking
- Accessibility tree

**Configuration**:
```typescript
{
  name: 'FormFillActionAgent',
  description: 'Fills forms intelligently with proper data types and validation',
  systemPrompt: `You are a form filling specialist...`,
  tools: ['form_detect', 'input_analyze', 'validate'],
  maxIterations: 5
}
```

**Use Cases**:
- Contact forms
- Registration forms
- Search forms
- Data entry
- Account creation

**Example**:
```typescript
const result = await FormFillActionAgent.execute({
  formData: {
    name: "John Doe",
    email: "john@example.com",
    message: "Hello"
  },
  context: { accessibilityTree: tree }
});
```

**Best Practices**:
- Provide structured form data
- Handle validation errors
- Support multi-step forms
- Verify filled values

---

### HoverActionAgent

**Purpose**: Hover interactions and tooltip triggering.

**Description**: Performs hover actions to reveal hidden content, trigger tooltips, or show dropdowns.

**Tools**:
- Element highlighting
- Hover simulation
- Accessibility tree

**Configuration**:
```typescript
{
  name: 'HoverActionAgent',
  description: 'Performs hover actions to reveal tooltips and menus',
  systemPrompt: `You are a hover action specialist...`,
  tools: ['hover_simulate', 'highlight', 'a11y_tree'],
  maxIterations: 2
}
```

**Use Cases**:
- Menu navigation
- Tooltip inspection
- Dropdown activation
- Hidden content reveal

**Example**:
```typescript
const result = await HoverActionAgent.execute({
  targetDescription: "User menu icon",
  action: "hover to show dropdown"
});
```

**Best Practices**:
- Wait for hover effects to complete
- Handle nested hovers (menu chains)
- Verify hover state changes

---

### KeyboardInputActionAgent

**Purpose**: Keyboard input and shortcuts.

**Description**: Simulates keyboard input including text entry, shortcuts, special keys, and key combinations.

**Tools**:
- Key press simulation
- Focus management
- Input validation

**Configuration**:
```typescript
{
  name: 'KeyboardInputActionAgent',
  description: 'Handles keyboard input, shortcuts, and special keys',
  systemPrompt: `You are a keyboard input specialist...`,
  tools: ['key_press', 'focus_manage', 'validate_input'],
  maxIterations: 3
}
```

**Use Cases**:
- Text entry
- Keyboard shortcuts (Ctrl+C, Ctrl+V)
- Navigation keys (Tab, Enter, Escape)
- Accessibility testing
- Keyboard-only workflows

**Example**:
```typescript
const result = await KeyboardInputActionAgent.execute({
  keys: "Ctrl+F",
  followUp: {
    text: "search term",
    keys: "Enter"
  }
});
```

**Best Practices**:
- Ensure element focus before input
- Handle key combinations correctly
- Support special keys (Tab, Escape)
- Verify input was accepted

---

### ScrollActionAgent

**Purpose**: Intelligent scrolling and viewport management.

**Description**: Performs scrolling to reveal content, trigger lazy loading, position elements in viewport.

**Tools**:
- Scroll simulation
- Lazy-load triggering
- Viewport positioning

**Configuration**:
```typescript
{
  name: 'ScrollActionAgent',
  description: 'Performs scrolling to reveal content and trigger lazy loading',
  systemPrompt: `You are a scroll action specialist...`,
  tools: ['scroll_simulate', 'lazy_load', 'viewport_position'],
  maxIterations: 3
}
```

**Use Cases**:
- Infinite scroll
- Lazy-loaded content
- Element positioning
- Full page screenshots
- Content discovery

**Example**:
```typescript
const result = await ScrollActionAgent.execute({
  direction: "down",
  target: "footer",
  waitForLoad: true
});
```

**Best Practices**:
- Wait for content to load after scroll
- Handle infinite scroll (stop condition)
- Scroll element into view for interactions
- Support smooth vs instant scroll

---

## Research Agents

Agents for information gathering and analysis.

### ResearchAgent

**Purpose**: Conducts in-depth research on topics.

**Description**: Performs comprehensive research using multiple queries, analyzes results, synthesizes information, and provides detailed findings with citations.

**Tools**:
- navigate_url
- navigate_back
- fetcher_tool
- extract_data (SchemaBasedExtractorTool)
- node_ids_to_urls
- html_to_markdown
- create_file, update_file, read_file, list_files

**Configuration**:
```typescript
{
  name: 'research_agent',
  description: 'Conducts thorough research with multiple sources and synthesis',
  systemPrompt: `You are a research specialist...`,
  tools: ['navigate_url', 'navigate_back', 'fetcher_tool', 'extract_data', 'node_ids_to_urls', 'html_to_markdown', 'create_file', 'update_file', 'read_file', 'list_files'],
  maxIterations: 30,
  temperature: 0
}
```

**Use Cases**:
- Topic research
- Competitive analysis
- Fact-finding
- Literature review
- Market research

**Example**:
```typescript
const result = await ResearchAgent.execute({
  topic: "Latest developments in quantum computing",
  requirements: {
    sources: 5,
    depth: "comprehensive",
    citations: true
  }
});
```

**Output Structure**:
```typescript
{
  topic: string;
  summary: string;
  findings: Array<{
    fact: string;
    source: string;
    url: string;
    confidence: number;
  }>;
  sources: Array<{
    title: string;
    url: string;
    relevance: number;
  }>;
  synthesizedInsights: string[];
}
```

**Best Practices**:
- Provide clear research questions
- Specify source requirements
- Request citations for verification
- Set appropriate iteration limits
- Use bookmarks for important findings

---

### SearchAgent

**Purpose**: Performs precision searches to find hard-to-locate facts.

**Description**: A precision search agent that excels at pinpointing hard-to-find facts (contact details, team rosters, niche professionals) and returns verified findings in structured JSON with citations.

**Tools**:
- navigate_url
- navigate_back
- node_ids_to_urls
- fetcher_tool
- extract_data (SchemaBasedExtractorTool)
- scroll_page
- action_agent
- html_to_markdown
- create_file, update_file, delete_file, read_file, list_files

**Configuration**:
```typescript
{
  name: 'search_agent',
  description: 'Precision search agent for hard-to-find facts with structured JSON output',
  systemPrompt: `You are an investigative search specialist...`,
  tools: ['navigate_url', 'navigate_back', 'node_ids_to_urls', 'fetcher_tool', 'extract_data', 'scroll_page', 'action_agent', 'html_to_markdown', 'create_file', 'update_file', 'delete_file', 'read_file', 'list_files'],
  maxIterations: 12,
  temperature: 0
}
```

**Use Cases**:
- Quick information lookup
- Search result analysis
- Fact checking
- Link collection
- Information extraction

**Example**:
```typescript
const result = await SearchAgent.execute({
  query: "best noise-cancelling headphones 2024",
  extractSchema: {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "string" },
            rating: { type: "number" }
          }
        }
      }
    }
  }
});
```

**Best Practices**:
- Use specific search queries
- Provide extraction schemas
- Limit to top results
- Handle no-results gracefully

---

## Orchestration Agents

Agents for coordinating complex multi-step workflows.

### WebTaskAgent

**Purpose**: Coordinates complex multi-step web tasks.

**Description**: High-level orchestrator that delegates to specialized agents, manages multi-page workflows, and handles task dependencies.

**Tools**:
- NavigateURLTool
- ActionAgent (via handoff)
- ResearchAgent (via handoff)
- SearchAgent (via handoff)
- HTMLToMarkdownTool
- SchemaBasedExtractorTool

**Configuration**:
```typescript
{
  name: 'WebTaskAgent',
  description: 'Orchestrates complex multi-step web workflows',
  systemPrompt: `You are a web task orchestrator...`,
  tools: ['navigate', 'extract', 'html_to_markdown'],
  handoffs: [
    { targetAgent: 'ActionAgent', condition: 'actions required' },
    { targetAgent: 'ResearchAgent', condition: 'research needed' },
    { targetAgent: 'SearchAgent', condition: 'search required' }
  ],
  maxIterations: 20
}
```

**Use Cases**:
- E-commerce workflows (search, compare, checkout)
- Account creation flows
- Multi-page data collection
- Complex automation pipelines
- Task decomposition

**Example**:
```typescript
const result = await WebTaskAgent.execute({
  task: "Research best laptops, compare top 3, create comparison table",
  requirements: {
    budget: "$1000-1500",
    criteria: ["performance", "battery life", "weight"]
  }
});
```

**Workflow Example**:
```
1. WebTaskAgent receives high-level task
2. Delegates to SearchAgent → finds laptop options
3. Delegates to ResearchAgent → gathers detailed specs
4. Delegates to ActionAgent → navigates to product pages
5. Synthesizes results → creates comparison table
6. Returns comprehensive report
```

**Best Practices**:
- Break down tasks clearly
- Set appropriate iteration limits
- Handle handoff results
- Provide task context
- Monitor agent sessions

---

### DirectURLNavigatorAgent

**Purpose**: Direct navigation to URLs.

**Description**: Handles URL navigation, validates URLs, waits for page load, and reports navigation status.

**Tools**:
- NavigateURLTool
- Page load detection
- URL validation

**Configuration**:
```typescript
{
  name: 'DirectURLNavigatorAgent',
  description: 'Navigates directly to URLs with validation and load verification',
  systemPrompt: `You are a navigation specialist...`,
  tools: ['navigate_url', 'load_detect', 'validate_url'],
  maxIterations: 2
}
```

**Use Cases**:
- Site navigation
- URL validation
- Link following
- Bookmark navigation
- Workflow entry points

**Example**:
```typescript
const result = await DirectURLNavigatorAgent.execute({
  url: "https://example.com/page",
  waitForLoad: true,
  timeout: 30000
});
```

**Best Practices**:
- Validate URLs before navigation
- Wait for page load completion
- Handle navigation failures
- Support relative URLs

---

## Content Agents

Agents for content creation and editing.

### ContentWriterAgent

**Purpose**: Content creation and editing.

**Description**: Generates content (articles, reports, documentation), formats text, manages files, and supports various content types.

**Tools**:
- CreateFileTool
- UpdateFileTool
- ReadFileTool
- ListFilesTool
- Text generation
- Formatting utilities

**Configuration**:
```typescript
{
  name: 'ContentWriterAgent',
  description: 'Creates and edits content including articles and reports',
  systemPrompt: `You are a content writing specialist...`,
  tools: ['create_file', 'update_file', 'read_file', 'list_files'],
  maxIterations: 10,
  temperature: 0.7  // Higher for creative writing
}
```

**Use Cases**:
- Article writing
- Report generation
- Documentation creation
- Content formatting
- File-based content management

**Example**:
```typescript
const result = await ContentWriterAgent.execute({
  task: "Write a blog post about AI in healthcare",
  requirements: {
    length: "1500 words",
    tone: "professional",
    sections: ["introduction", "benefits", "challenges", "future", "conclusion"],
    format: "markdown"
  },
  outputFile: "/reports/ai-healthcare-blog.md"
});
```

**Output Example**:
```markdown
# AI in Healthcare: Transforming Patient Care

## Introduction
Artificial intelligence is revolutionizing healthcare...

## Benefits
1. Improved diagnostics
2. Personalized treatment
...

## Conclusion
As AI continues to evolve...
```

**Best Practices**:
- Provide clear content requirements
- Specify tone and style
- Request structured sections
- Save to files for persistence
- Support iterative refinement

---

## E-Commerce Agents

Agents for e-commerce tasks.

### EcommerceProductInfoAgent

**Purpose**: E-commerce product information extraction.

**Description**: Extracts product details (name, price, rating, reviews, specifications) from e-commerce sites using schema-based extraction.

**Tools**:
- SchemaBasedExtractorTool
- StreamlinedSchemaExtractorTool
- HTMLToMarkdownTool
- NavigateURLTool

**Configuration**:
```typescript
{
  name: 'EcommerceProductInfoAgent',
  description: 'Extracts product information from e-commerce sites',
  systemPrompt: `You are an e-commerce data extraction specialist...`,
  tools: ['schema_extractor', 'streamlined_extractor', 'html_to_markdown', 'navigate'],
  maxIterations: 5
}
```

**Use Cases**:
- Product research
- Price comparison
- Review analysis
- Specification extraction
- Inventory checking

**Example**:
```typescript
const result = await EcommerceProductInfoAgent.execute({
  productUrl: "https://amazon.com/product/B08...",
  extractFields: [
    "name",
    "price",
    "rating",
    "reviewCount",
    "availability",
    "specifications",
    "images"
  ]
});
```

**Output Structure**:
```typescript
{
  name: string;
  price: {
    currency: string;
    amount: number;
    originalPrice?: number;
    discount?: number;
  };
  rating: {
    average: number;
    count: number;
  };
  availability: "in_stock" | "out_of_stock" | "pre_order";
  specifications: Record<string, string>;
  images: string[];
  reviews?: Array<{
    rating: number;
    text: string;
    date: string;
  }>;
}
```

**Best Practices**:
- Handle site-specific layouts
- Support multiple e-commerce platforms
- Extract structured data reliably
- Handle dynamic pricing
- Verify data accuracy

---

### ActionVerificationAgent

**Purpose**: Verifies that actions were executed correctly.

**Description**: Checks if browser actions produced expected results, validates state changes, and provides verification reports.

**Tools**:
- DOM inspection
- Accessibility tree analysis
- Visual comparison
- State validation

**Configuration**:
```typescript
{
  name: 'ActionVerificationAgent',
  description: 'Verifies actions were executed correctly',
  systemPrompt: `You are an action verification specialist...`,
  tools: ['dom_inspect', 'a11y_tree', 'visual_compare', 'state_validate'],
  maxIterations: 3
}
```

**Use Cases**:
- Quality assurance
- Action validation
- Error detection
- State verification
- Test automation

**Example**:
```typescript
const result = await ActionVerificationAgent.execute({
  expectedAction: "Form submitted",
  verificationCriteria: [
    "Success message visible",
    "Form fields cleared",
    "URL changed to confirmation page"
  ]
});
```

**Best Practices**:
- Define clear verification criteria
- Check multiple indicators
- Handle async state changes
- Provide detailed failure reports

---

## Agent Handoffs

### Handoff Mechanism

Agents can transfer control to other specialized agents:

```typescript
interface HandoffConfig {
  targetAgent: string;              // Agent to handoff to
  condition: string;                // When to handoff
  transferContext: boolean;         // Transfer message history
  returnControl: boolean;           // Return to original agent
}
```

### Handoff Flow

```
1. Agent A detects condition for handoff
2. Agent A calls handoff tool: handoff_to_ResearchAgent
3. Control transfers to Research Agent
4. Research Agent executes with relevant context
5. Research Agent returns result
6. Result returned to Agent A (if returnControl: true)
   OR Result returned directly to user (if returnControl: false)
```

### Example Configuration

```typescript
{
  name: 'WebTaskAgent',
  handoffs: [
    {
      targetAgent: 'ResearchAgent',
      condition: 'requires_research',
      transferContext: true,
      returnControl: true
    },
    {
      targetAgent: 'ActionAgent',
      condition: 'requires_actions',
      transferContext: true,
      returnControl: true
    }
  ]
}
```

### Handoff Best Practices

1. **Clear Conditions**: Define when to handoff
   ```typescript
   condition: "User query requires web search"  // ✅ Clear
   condition: "complex task"  // ❌ Vague
   ```

2. **Context Transfer**: Include relevant context
   ```typescript
   transferContext: true,  // Include previous messages
   contextFilter: ['user_query', 'extracted_data']  // Only relevant data
   ```

3. **Return Control**: Decide flow continuation
   ```typescript
   // ✅ For coordinated workflows
   returnControl: true

   // ✅ For terminal handoffs
   returnControl: false
   ```

4. **Avoid Loops**: Prevent infinite handoffs
   ```typescript
   maxHandoffs: 3,  // Limit handoff depth
   preventLoops: true  // Detect circular handoffs
   ```

---

## Creating Custom Agents

### Step 1: Define Configuration

```typescript
const myCustomAgent: AgentToolConfig = {
  name: 'MyCustomAgent',
  description: 'Description shown to LLM when considering this agent',
  systemPrompt: `You are a specialist in...

Your capabilities:
- Capability 1
- Capability 2

Your workflow:
1. Step 1
2. Step 2

Always:
- Best practice 1
- Best practice 2`,

  tools: [
    'tool1',
    'tool2',
    'tool3'
  ],

  handoffs: [
    {
      targetAgent: 'HelperAgent',
      condition: 'needs help',
      transferContext: true,
      returnControl: true
    }
  ],

  maxIterations: 10,
  modelName: 'gpt-4',
  temperature: 0.7,

  schema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Task description'
      },
      requirements: {
        type: 'object',
        properties: {
          // Task-specific requirements
        }
      }
    },
    required: ['task']
  }
};
```

### Step 2: Register Agent

```typescript
// In ConfiguredAgents.ts
import { ToolRegistry } from './ConfigurableAgentTool';

ToolRegistry.registerTool(
  'MyCustomAgent',
  (ctx) => new ConfigurableAgentTool(myCustomAgent, ctx)
);
```

### Step 3: Add to Agent Registry

```typescript
// In AgentDescriptorRegistry.ts
AgentDescriptorRegistry.register({
  type: 'my_custom_agent',
  name: 'My Custom Agent',
  description: 'Custom agent for specific task',
  version: '1.0.0',
  tools: ['tool1', 'tool2', 'tool3'],
  systemPrompt: myCustomAgent.systemPrompt
});
```

### Step 4: Test Agent

```typescript
// Create test cases
const testCases: TestCase[] = [
  {
    name: 'Basic functionality',
    input: 'Test task',
    expectedBehavior: 'Agent should...',
    assertions: [
      { type: 'tool_called', tool: 'tool1' },
      { type: 'output_contains', value: 'expected output' }
    ]
  }
];

// Run tests
const runner = new EvaluationRunner();
await runner.runTests(testCases);
```

### Agent Design Best Practices

1. **Clear Purpose**: Single responsibility
   ```typescript
   // ✅ Good: Specific purpose
   description: 'Extracts product information from e-commerce sites'

   // ❌ Bad: Too broad
   description: 'Does everything related to shopping'
   ```

2. **Appropriate Tools**: Only necessary tools
   ```typescript
   // ✅ Good: Focused tool set
   tools: ['schema_extractor', 'html_to_markdown', 'navigate']

   // ❌ Bad: Too many tools
   tools: ['ALL_TOOLS']  // Confuses the LLM
   ```

3. **Detailed System Prompt**: Clear instructions
   ```typescript
   systemPrompt: `You are a [role] specialist.

   Your task is to [specific task].

   Your workflow:
   1. [Step 1]
   2. [Step 2]
   3. [Step 3]

   Always:
   - [Best practice 1]
   - [Best practice 2]

   Never:
   - [Anti-pattern 1]
   - [Anti-pattern 2]`
   ```

4. **Iteration Limits**: Appropriate for task complexity
   ```typescript
   // Simple tasks
   maxIterations: 3

   // Complex research
   maxIterations: 15

   // Orchestration
   maxIterations: 20
   ```

5. **Temperature Setting**: Match task type
   ```typescript
   // Factual/precise tasks
   temperature: 0.2

   // Creative tasks
   temperature: 0.7

   // Exploratory tasks
   temperature: 0.5
   ```

---

## Related Documentation

- [Architecture.md](./Architecture.md) - System architecture
- [Tools-Reference.md](./Tools-Reference.md) - Available tools
- [Evaluation-Guide.md](./Evaluation-Guide.md) - Testing agents

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team
