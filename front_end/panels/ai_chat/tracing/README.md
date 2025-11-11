# AI Chat Tracing Implementation

This directory contains the tracing implementation for the AI Chat agent framework in Chrome DevTools. The tracing system provides comprehensive observability for agent interactions, LLM calls, and tool executions using Langfuse as the primary tracing backend.

## Architecture

### Core Components

1. **TracingProvider** (`TracingProvider.ts`) - Abstract base class defining the tracing interface
2. **LangfuseProvider** (`LangfuseProvider.ts`) - Langfuse-specific implementation 
3. **TracingConfig** (`TracingConfig.ts`) - Configuration management and provider factory

### Tracing Hierarchy

```
Session (per AgentService instance)
├── Trace (per user interaction/sendMessage)
    ├── Span (StateGraph node execution)
    ├── Generation (LLM calls in AgentNode)
    ├── Span (Tool executions in ToolExecutorNode)
    └── Span (Agent handoffs in AgentRunner)
```

## Configuration

**🎉 NEW: Persistent Configuration** - Tracing configuration now persists across page navigations and DevTools sessions!

### Method 1: Settings UI (Recommended)

1. Open AI Chat in DevTools
2. Click the Settings gear icon
3. Scroll to "Tracing Configuration" section
4. Check "Enable Tracing"
5. Enter your Langfuse credentials:
   - **Endpoint**: http://localhost:3000 (or your Langfuse server URL)
   - **Public Key**: pk-lf-... (from Langfuse project settings)
   - **Secret Key**: sk-lf-... (from Langfuse project settings)
6. Click "Test Connection" to verify
7. Click "Save" to persist settings

### Method 2: Browser Console

Run this in the DevTools console:

```javascript
// Quick configuration (replace with your actual credentials)
configureLangfuseTracing(
  'http://localhost:3000',           // endpoint
  'pk-lf-your-public-key',          // public key
  'sk-lf-your-secret-key'           // secret key
);
```

### Method 3: Configuration Script

```javascript
// Load and run the configuration script
const script = document.createElement('script');
script.src = '/front_end/panels/ai_chat/tracing/configure-langfuse.js';
document.head.appendChild(script);
```

### Method 4: Manual Console Commands

```javascript
// Check current configuration
getTracingConfig();

// Enable tracing manually
setTracingConfig({
  provider: 'langfuse',
  endpoint: 'http://localhost:3000',
  publicKey: 'pk-lf-your-public-key',
  secretKey: 'sk-lf-your-secret-key'
});

// Disable tracing
setTracingConfig({ provider: 'disabled' });

// Check if tracing is enabled
isTracingEnabled();
```

### Persistent Storage

Configuration is stored in a persistent singleton that survives:
- ✅ Page navigation 
- ✅ DevTools reloads
- ✅ URL changes
- ✅ Browser sessions (via localStorage backup)

## Implementation Details

### Trace Flow

1. **Session Creation** - When AgentService initializes, a unique session is created
2. **Trace Creation** - Each `sendMessage()` call creates a new trace with:
   - User input as trace input
   - Selected agent type as metadata
   - Current page URL/title as tags
3. **Observation Tracking** - Various components create observations:
   - **StateGraph**: Creates spans for each node execution
   - **AgentNode**: Creates generation observations for LLM calls
   - **ToolExecutorNode**: Creates spans for tool executions
   - **AgentRunner**: Creates spans for agent handoffs

### Context Propagation

Tracing context is passed through the existing `AgentState.context.tracingContext` field:

```typescript
interface TracingContext {
  sessionId: string;
  traceId: string;
  parentObservationId?: string;
}
```

This context flows through the entire execution pipeline without requiring changes to existing interfaces.

### Langfuse API Integration

The implementation uses Langfuse's batch ingestion API:

- **Endpoint**: `POST /api/public/ingestion`
- **Authentication**: Basic Auth with public/secret keys
- **Batching**: Events are buffered and sent in batches for efficiency
- **Auto-flush**: Automatic periodic flushing every 5 seconds or when buffer reaches 50 events

### Event Types

- **trace-create**: Main user interaction traces
- **generation-create**: LLM generation events with model parameters
- **span-create**: General execution spans (nodes, tools, handoffs)
- **event-create**: Discrete point-in-time events

## Usage Examples

### Basic Tracing

Once configured, tracing happens automatically:

1. Start a conversation in AI Chat
2. View traces in your Langfuse instance at the configured endpoint
3. Each user message creates a new trace with nested observations

### Debugging

To debug tracing issues:

1. Check browser console for tracing-related logs
2. Verify configuration: `getLangfuseConfig()`
3. Test connectivity to your Langfuse instance
4. Check Langfuse logs for ingestion errors

### Extending

To add custom tracing:

```typescript
import { createTracingProvider } from '../tracing/TracingConfig.js';

const tracingProvider = createTracingProvider();

// Create custom span
await tracingProvider.createObservation({
  id: 'custom-span-id',
  name: 'Custom Operation',
  type: 'span',
  startTime: new Date(),
  input: { /* operation input */ },
  metadata: { /* custom metadata */ }
}, traceId);
```

## Performance Considerations

- Events are batched to minimize network overhead
- Large inputs/outputs are truncated for tracing
- Tracing is async and doesn't block the main execution flow
- Graceful degradation when tracing fails

## Langfuse Setup

### Self-Hosted Langfuse

#### Docker Deployment

```bash
# Create docker-compose.yml
cat > docker-compose.yml <<EOF
version: '3.8'
services:
  langfuse:
    image: ghcr.io/langfuse/langfuse:latest
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/langfuse
      - NEXTAUTH_SECRET=your-secret-key
      - NEXTAUTH_URL=http://localhost:3000
      - SALT=your-salt
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=langfuse
    volumes:
      - langfuse-db:/var/lib/postgresql/data

volumes:
  langfuse-db:
EOF

# Start Langfuse
docker-compose up -d

# Create project and get API keys
# 1. Open http://localhost:3000
# 2. Sign up / Log in
# 3. Create a new project
# 4. Copy public and secret keys from Settings
```

### Langfuse Cloud

1. Sign up at https://cloud.langfuse.com
2. Create a new project
3. Copy API keys from project settings
4. Use cloud endpoint: https://cloud.langfuse.com

## Trace Anatomy

### Session

Top-level container for all interactions:

```typescript
{
  id: "session-uuid",
  createdAt: "2024-01-15T10:00:00Z",
  metadata: {
    userAgent: "Chrome/...",
    devToolsVersion: "...",
    agentFrameworkVersion: "2.0"
  }
}
```

### Trace

Individual user interaction:

```typescript
{
  id: "trace-uuid",
  sessionId: "session-uuid",
  name: "User Query",
  input: "Find the price of iPhone 15 Pro",
  output: "The iPhone 15 Pro starts at $999",
  metadata: {
    selectedAgentType: "shopping",
    currentPageUrl: "https://example.com",
    currentPageTitle: "Example Page"
  },
  tags: ["shopping", "price-query"],
  timestamp: "2024-01-15T10:00:00Z"
}
```

### Generation (LLM Calls)

```typescript
{
  id: "gen-uuid",
  traceId: "trace-uuid",
  parentObservationId: "span-uuid",
  type: "generation",
  name: "GPT-4 Call",
  model: "gpt-4",
  modelParameters: {
    temperature: 0.7,
    maxTokens: 2000
  },
  input: [
    { role: "system", content: "You are a helpful assistant..." },
    { role: "user", content: "User query..." }
  ],
  output: {
    text: "Assistant response...",
    toolCalls: [...]
  },
  usage: {
    promptTokens: 150,
    completionTokens: 250,
    totalTokens: 400
  },
  startTime: "2024-01-15T10:00:01Z",
  endTime: "2024-01-15T10:00:03Z",
  latency: 2000,
  metadata: {
    provider: "openai",
    cacheHit: false
  }
}
```

### Span (Operations)

```typescript
{
  id: "span-uuid",
  traceId: "trace-uuid",
  parentObservationId: "parent-span-uuid",
  type: "span",
  name: "Tool Execution: web_search",
  input: {
    query: "iPhone 15 Pro price"
  },
  output: {
    results: [...]
  },
  startTime: "2024-01-15T10:00:01Z",
  endTime: "2024-01-15T10:00:02Z",
  metadata: {
    toolName: "web_search",
    success: true
  }
}
```

## Advanced Configuration

### Custom Trace Metadata

```typescript
import { createTracingProvider } from './TracingConfig';

const provider = createTracingProvider();

await provider.createTrace({
  id: 'trace-id',
  name: 'Custom Trace',
  input: 'User input',
  metadata: {
    customField1: 'value1',
    customField2: 'value2',
    experiment: 'variant-A',
    userId: 'user-123'
  },
  tags: ['custom', 'experiment']
});
```

### Sampling

Control which traces are recorded:

```typescript
// In TracingConfig.ts or custom implementation
const shouldTrace = () => {
  // Sample 10% of traces
  return Math.random() < 0.1;

  // Or sample based on criteria
  if (isProduction && !isDevelopmentUser) {
    return Math.random() < 0.05;  // 5% in production
  }
  return true;  // 100% for development
};
```

### Error Tracking

Traces automatically capture errors:

```typescript
// Errors are captured in observations
{
  type: "span",
  name: "Failed Operation",
  statusMessage: "Error: Network timeout",
  level: "ERROR",
  metadata: {
    error: {
      message: "Network timeout",
      stack: "Error: Network timeout\n  at ...",
      code: "NETWORK_TIMEOUT"
    }
  }
}
```

### Custom Scoring

Add evaluation scores to traces:

```typescript
await provider.score({
  traceId: 'trace-id',
  name: 'accuracy',
  value: 0.95,
  comment: 'High accuracy on structured extraction'
});

await provider.score({
  traceId: 'trace-id',
  name: 'user_satisfaction',
  value: 1,  // 0-1 scale
  comment: 'User confirmed result was helpful'
});
```

## Monitoring and Analysis

### Key Metrics in Langfuse

**Latency Analysis**:
- P50, P95, P99 response times
- Breakdown by agent type
- Identify slow operations

**Cost Tracking**:
- Token usage per trace
- Cost per model
- Daily/monthly spending trends

**Quality Metrics**:
- Success/failure rates
- Error frequency by type
- Tool usage patterns

**User Behavior**:
- Most common queries
- Agent type preferences
- Session duration

### Langfuse Dashboard Views

**Traces**:
- List all traces with filters
- Search by input/output
- Filter by tags, metadata
- View detailed trace tree

**Sessions**:
- Group traces by session
- Analyze user journeys
- Track session metrics

**Generations**:
- LLM call analytics
- Model performance comparison
- Token usage trends

**Datasets**:
- Create datasets from traces
- Use for fine-tuning
- Evaluation test sets

### Querying Traces

```sql
-- Example Langfuse SQL queries
-- (available in Langfuse dashboard)

-- Average latency by agent type
SELECT
  metadata->>'selectedAgentType' as agent_type,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_latency_seconds
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY agent_type;

-- Most common errors
SELECT
  observations.status_message,
  COUNT(*) as error_count
FROM observations
WHERE observations.level = 'ERROR'
  AND observations.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY observations.status_message
ORDER BY error_count DESC
LIMIT 10;

-- Token usage by model
SELECT
  generations.model,
  SUM(generations.usage->>'totalTokens')::int as total_tokens,
  COUNT(*) as call_count
FROM generations
WHERE generations.timestamp > NOW() - INTERVAL '7 days'
GROUP BY generations.model;
```

## Best Practices

### 1. Meaningful Names

```typescript
// ✅ Good: Descriptive names
await provider.createObservation({
  name: "Extract Product Info: iPhone 15 Pro",
  // ...
});

// ❌ Bad: Generic names
await provider.createObservation({
  name: "operation",
  // ...
});
```

### 2. Rich Metadata

```typescript
// ✅ Good: Include context
metadata: {
  agentType: "shopping",
  toolName: "schema_extractor",
  targetSite: "amazon.com",
  extractionSchema: "product",
  retryCount: 2,
  cacheHit: false
}

// ❌ Bad: Minimal metadata
metadata: {
  type: "extraction"
}
```

### 3. Structured Inputs/Outputs

```typescript
// ✅ Good: Structured data
input: {
  query: "Find laptops",
  filters: {
    priceRange: [800, 1500],
    brand: "Dell"
  }
}

// ❌ Bad: Unstructured strings
input: "find laptops priced 800-1500 dell brand"
```

### 4. Error Context

```typescript
// ✅ Good: Detailed error info
statusMessage: "Network timeout after 3 retries",
metadata: {
  error: {
    type: "NetworkTimeout",
    attemptedUrl: "https://...",
    retries: 3,
    lastError: "ECONNREFUSED"
  }
}

// ❌ Bad: Generic error
statusMessage: "Error occurred"
```

### 5. Sensitive Data

```typescript
// ✅ Good: Redact sensitive data
input: {
  email: "[REDACTED]",
  query: "Check my order status"
}

// ❌ Bad: Expose sensitive data
input: {
  email: "user@example.com",
  password: "secret123"
}
```

## Troubleshooting

### Traces Not Appearing

**Issue**: No traces showing in Langfuse.

**Solutions**:
1. Check tracing is enabled: `isTracingEnabled()`
2. Verify configuration: `getTracingConfig()`
3. Test connectivity: `configureLangfuseTracing()` then check console
4. Check Langfuse ingestion logs
5. Verify API keys are correct
6. Ensure network allows outbound to Langfuse endpoint

### High Latency

**Issue**: Tracing adds noticeable latency.

**Solutions**:
1. Check batch size and flush interval
2. Increase batch size: Fewer network requests
3. Use async tracing (already default)
4. Sample traces in production
5. Check Langfuse server performance

### Missing Data

**Issue**: Some observations missing from traces.

**Solutions**:
1. Check for errors in console
2. Verify context propagation
3. Ensure async operations complete
4. Check max batch size limits
5. Manual flush before page navigation:
   ```typescript
   await provider.flush();
   ```

### Authentication Errors

**Issue**: 401/403 errors from Langfuse.

**Solutions**:
1. Verify API keys are correct
2. Check key format (pk-lf-... / sk-lf-...)
3. Confirm project exists in Langfuse
4. Check key permissions
5. Regenerate keys if compromised

## Integration Examples

### With Evaluation Framework

```typescript
import { EvaluationRunner } from '../evaluation/EvaluationRunner';
import { createTracingProvider } from '../tracing/TracingConfig';

const runner = new EvaluationRunner({
  tracing: true  // Enable tracing for evaluations
});

// Traces are automatically created for each test
const results = await runner.runTestSuite(testSuite);

// View traces in Langfuse with tag: "evaluation"
```

### With Custom Agents

```typescript
// In your custom agent
import { createTracingProvider } from '../tracing/TracingConfig';

class MyCustomAgent {
  async execute(args, ctx) {
    const provider = createTracingProvider();

    // Create span for agent execution
    const spanId = `custom-agent-${Date.now()}`;
    await provider.createObservation({
      id: spanId,
      name: `MyCustomAgent: ${args.task}`,
      type: 'span',
      startTime: new Date(),
      input: args,
      metadata: {
        agentVersion: '1.0.0',
        customField: 'value'
      }
    }, ctx.tracingContext?.traceId);

    try {
      // Execute agent logic
      const result = await this.performTask(args);

      // Update span with output
      await provider.updateObservation(spanId, {
        endTime: new Date(),
        output: result,
        metadata: {
          success: true
        }
      });

      return result;
    } catch (error) {
      // Update span with error
      await provider.updateObservation(spanId, {
        endTime: new Date(),
        level: 'ERROR',
        statusMessage: error.message,
        metadata: {
          error: {
            message: error.message,
            stack: error.stack
          }
        }
      });

      throw error;
    }
  }
}
```

## Performance Optimization

### Batching Configuration

```typescript
// Configure batching in LangfuseProvider
const provider = new LangfuseProvider({
  endpoint: '...',
  publicKey: '...',
  secretKey: '...',
  batchSize: 50,        // Events per batch
  flushInterval: 5000,  // Flush every 5 seconds
  maxBatchAge: 30000    // Force flush after 30 seconds
});
```

### Selective Tracing

```typescript
// Trace only important operations
const shouldTraceOperation = (operation) => {
  // Always trace errors
  if (operation.hasError) return true;

  // Always trace user-facing operations
  if (operation.userFacing) return true;

  // Sample background operations
  if (operation.background) {
    return Math.random() < 0.1;  // 10% sampling
  }

  return true;
};
```

### Data Truncation

```typescript
// Truncate large inputs/outputs
const MAX_SIZE = 10000;

function truncate(data) {
  const str = JSON.stringify(data);
  if (str.length > MAX_SIZE) {
    return {
      truncated: true,
      preview: str.substring(0, MAX_SIZE),
      originalSize: str.length
    };
  }
  return data;
}

await provider.createObservation({
  input: truncate(largeInput),
  output: truncate(largeOutput)
});
```

## Security Considerations

### API Key Storage

- Keys stored in localStorage (per-origin isolation)
- Never commit keys to version control
- Rotate keys periodically
- Use environment variables for CI/CD

### Data Privacy

- Redact PII before tracing
- Implement data retention policies
- Consider GDPR compliance
- Use Langfuse data redaction features

### Network Security

- Use HTTPS endpoints
- Validate SSL certificates
- Consider VPN for self-hosted Langfuse
- Firewall rules for Langfuse server

## Future Enhancements

- Support for additional tracing providers (OpenTelemetry, DataDog, etc.)
- Token usage tracking when available from LLM responses
- Custom scoring/evaluation integration
- Performance metrics and latency tracking
- Distributed tracing across multiple DevTools instances
- Automatic PII redaction
- Cost forecasting based on usage trends
- Real-time alerting for errors/anomalies

## Related Documentation

- [Architecture.md](../docs/Architecture.md) - System architecture
- [Evaluation-Guide.md](../docs/Evaluation-Guide.md) - Testing and evaluation
- [Langfuse Documentation](https://langfuse.com/docs) - Official Langfuse docs

---

**Document Version**: 2.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team