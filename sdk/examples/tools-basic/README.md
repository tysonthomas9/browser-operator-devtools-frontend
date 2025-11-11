# Tools Example - Basic Function Calling

This example demonstrates how to create and use tools (function calling) with the Browser Operator SDK.

## Features

- ✅ **Function Calling** - LLM can call tools to perform actions
- ✅ **Multiple Tools** - Weather, calculator, and time tools
- ✅ **Zod Schemas** - Type-safe input/output validation
- ✅ **Browser-Compatible** - Runs in vanilla JavaScript
- ✅ **Following Mastra Pattern** - Industry standard approach

## Available Tools

### 1. Weather Tool (`get_weather`)
Get current weather information for a city.

**Input:**
- `city` (string): City name
- `units` (enum): 'celsius' or 'fahrenheit'

**Output:**
- `temperature` (number)
- `conditions` (string)
- `humidity` (number)

### 2. Calculator Tool (`calculator`)
Perform basic math operations.

**Input:**
- `operation` (enum): 'add', 'subtract', 'multiply', 'divide'
- `a` (number): First number
- `b` (number): Second number

**Output:**
- `result` (number)

### 3. Time Tool (`get_current_time`)
Get the current date and time.

**Input:**
- `timezone` (string, optional): Timezone

**Output:**
- `dateString` (string)
- `timeString` (string)

## Running the Example

### Option 1: Direct File Access

1. Build the SDK first:
   ```bash
   cd ../../packages/core
   pnpm install
   pnpm run build
   ```

2. Open `index.html` in your browser:
   ```bash
   open index.html
   # or
   python -m http.server 8000
   # then visit http://localhost:8000
   ```

### Option 2: Using a Dev Server

```bash
# From the example directory
npx serve
```

Then visit http://localhost:3000

## Usage

1. **Enter your OpenAI API key**
2. **Select a model** (gpt-3.5-turbo recommended)
3. **Enter your message** - Try asking:
   - "What's the weather in London?"
   - "What's 15 multiplied by 24?"
   - "What time is it?"
   - "What's the weather in Tokyo and what's 100 divided by 5?"
4. **Click "Run Agent with Tools"**

The agent will automatically:
1. Understand which tools it needs to use
2. Call the appropriate tools with correct arguments
3. Use the tool results to formulate a response

## How It Works

### 1. Create Tools with Zod Schemas

```typescript
import { createTool } from '@browser-operator/core/tools';
import { z } from 'zod';

const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get weather for a city',
  inputSchema: z.object({
    city: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    conditions: z.string(),
  }),
  execute: async ({ context }) => {
    const { city } = context;
    // Fetch weather data
    return { temperature: 22, conditions: 'sunny' };
  },
});
```

### 2. Create Agent with Tools

```typescript
const agent = new Agent({
  name: 'tool-agent',
  model: 'gpt-3.5-turbo',
  tools: {
    get_weather: weatherTool,
    calculator: calculatorTool,
  },
}, provider);
```

### 3. Agent Automatically Uses Tools

```typescript
const result = await agent.generateText('What's the weather in Paris?');
// Agent will:
// 1. Recognize it needs the weather tool
// 2. Call get_weather({ city: 'Paris' })
// 3. Use the result to formulate response
```

## Tool Execution Flow

1. **User sends message** → Agent receives message
2. **LLM decides to use tool** → Returns tool call
3. **Agent executes tool** → Tool returns result
4. **Tool result sent to LLM** → LLM formulates final response
5. **User receives answer** → With tool-enhanced information

## Event Tracking

Subscribe to events to track tool usage:

```typescript
agent.on(AgentEvent.TOOL_CALL, ({ toolCall }) => {
  console.log(`Tool called: ${toolCall.name}`);
  console.log('Arguments:', toolCall.arguments);
});

agent.on(AgentEvent.TOOL_RESULT, ({ result }) => {
  console.log('Tool result:', result);
});
```

## Creating Custom Tools

```typescript
const myTool = createTool({
  id: 'my_custom_tool',
  description: 'What this tool does and when to use it',
  inputSchema: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ context, runtimeContext }) => {
    // Tool logic here
    const { param1, param2 } = context;

    // Access runtime context if needed
    const authToken = runtimeContext?.get('authToken');

    // Return output matching outputSchema
    return { result: 'success' };
  },
  metadata: {
    category: 'utility',
    tags: ['custom', 'example'],
  },
});
```

## Runtime Context

Pass runtime values to tools:

```typescript
const agent = new Agent(
  {
    name: 'agent',
    model: 'gpt-3.5-turbo',
    tools: { myTool },
  },
  provider,
  {
    // Runtime context values
    authToken: 'user-token',
    userId: '12345',
  }
);
```

Access in tool:

```typescript
execute: async ({ context, runtimeContext }) => {
  const authToken = runtimeContext?.get('authToken');
  // Use authToken for API calls
}
```

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 15+
- ✅ Edge 90+

## Next Steps

- See [advanced-tools](../advanced-tools) for more complex tools
- Check [tool-registry](../tool-registry) for dynamic tool loading
- View [mcp-integration](../mcp-integration) for Model Context Protocol

## Comparison with Mastra

This implementation follows Mastra's pattern:

**Mastra:**
```typescript
const tool = createTool({
  id: 'weather',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temp: z.number() }),
  execute: async ({ context }) => { /* ... */ },
});
```

**Browser Operator (Same pattern!):**
```typescript
const tool = createTool({
  id: 'weather',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ temp: z.number() }),
  execute: async ({ context }) => { /* ... */ },
});
```

✅ **Industry standard approach** - Compatible with Mastra patterns
✅ **Browser-compatible** - Works without Node.js
✅ **Type-safe** - Full TypeScript support with Zod
