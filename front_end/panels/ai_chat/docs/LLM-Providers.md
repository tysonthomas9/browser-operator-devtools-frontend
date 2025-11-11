# LLM Providers Guide

Comprehensive guide to LLM providers supported in the AI Chat framework.

## Table of Contents

1. [Overview](#overview)
2. [Provider Comparison](#provider-comparison)
3. [OpenAI Provider](#openai-provider)
4. [LiteLLM Provider](#litellm-provider)
5. [Groq Provider](#groq-provider)
6. [OpenRouter Provider](#openrouter-provider)
7. [BrowserOperator Provider](#browseroperator-provider)
8. [Provider Selection Guide](#provider-selection-guide)
9. [Configuration](#configuration)
10. [Best Practices](#best-practices)

---

## Overview

The AI Chat framework supports 5 LLM providers through a unified interface, enabling seamless switching and multi-provider strategies.

### Unified Interface

All providers implement the same interface:

```typescript
interface LLMProvider {
  call(request: LLMRequest): Promise<LLMResponse>;
  testConnection(config: ProviderConfig): Promise<boolean>;
  getAvailableModels(): Promise<Model[]>;
}
```

### Benefits

- **Provider Flexibility**: Switch providers without code changes
- **Cost Optimization**: Use different models for different tasks
- **Redundancy**: Fallback to alternative providers
- **Model Access**: Access to 100+ models across providers

---

## Provider Comparison

| Feature | OpenAI | LiteLLM | Groq | OpenRouter | BrowserOperator |
|---------|--------|---------|------|------------|-----------------|
| **Access** | Direct | Proxy | Direct | Direct | Custom |
| **Models** | GPT-4, GPT-3.5 | 50+ (via proxy) | Llama, Mixtral | 100+ | Custom |
| **Speed** | Medium | Varies | **Very Fast** | Medium | Medium |
| **Cost** | $$$ | Varies | $ | Varies | Custom |
| **Function Calling** | ✅ | ✅ (varies) | ✅ | ✅ (varies) | ✅ |
| **Vision** | ✅ | ✅ (some models) | ❌ | ✅ (some models) | ✅ |
| **Streaming** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Local Models** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Authentication** | API Key | API Key | API Key | API Key / OAuth | Custom |
| **Best For** | Production | Flexibility | Speed | Model variety | Specialization |

---

## OpenAI Provider

### Overview

Direct integration with OpenAI's API for GPT models.

**Provider ID**: `openai`

**Endpoint**: `https://api.openai.com/v1/chat/completions`

### Supported Models

| Model | Context | Strengths | Use Cases |
|-------|---------|-----------|-----------|
| **gpt-4** | 8K | High quality, reasoning | Complex tasks, accuracy-critical |
| **gpt-4-32k** | 32K | Extended context | Long documents, conversations |
| **gpt-4-turbo** | 128K | Fast, long context | Production workloads |
| **gpt-4-vision** | 128K | Image understanding | Visual analysis |
| **gpt-3.5-turbo** | 16K | Fast, cost-effective | Simple tasks, high volume |
| **gpt-3.5-turbo-16k** | 16K | Extended context | Moderate complexity |

### Features

**Function Calling**: ✅ Native support
- Reliable tool invocation
- Parallel function calls
- Structured outputs

**Vision**: ✅ GPT-4V
- Image analysis
- Screenshot understanding
- Visual question answering

**JSON Mode**: ✅
- Guaranteed JSON output
- Schema adherence

### Pricing (as of 2024)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-4 | $30 | $60 |
| GPT-4 Turbo | $10 | $30 |
| GPT-3.5 Turbo | $0.50 | $1.50 |

### Configuration

```typescript
// LocalStorage keys
localStorage.setItem('ai_chat_api_key', 'sk-...');

// Programmatic
LLMClient.configure({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4'
});
```

### Usage Example

```typescript
const response = await LLMClient.call({
  provider: 'openai',
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  tools: getTools(),
  temperature: 0.7
});
```

### Pros & Cons

**Pros**:
- ✅ Highest quality outputs
- ✅ Reliable function calling
- ✅ Excellent documentation
- ✅ Vision capabilities
- ✅ Production-ready

**Cons**:
- ❌ Higher cost
- ❌ Rate limits on free tier
- ❌ No local deployment
- ❌ Limited model variety

### Best Practices

1. **Use GPT-4 for complex reasoning**
   ```typescript
   // ✅ Good: Complex task
   model: 'gpt-4', task: 'Multi-step workflow planning'

   // ❌ Wasteful: Simple task
   model: 'gpt-4', task: 'Extract title from HTML'
   ```

2. **Use GPT-3.5 for simple tasks**
   ```typescript
   // ✅ Cost-effective
   model: 'gpt-3.5-turbo', task: 'Data extraction'
   ```

3. **Enable streaming for UX**
   ```typescript
   streaming: true  // Real-time response display
   ```

---

## LiteLLM Provider

### Overview

LiteLLM proxy enables access to 50+ LLMs through a unified OpenAI-compatible API.

**Provider ID**: `litellm`

**Endpoint**: Configurable (your proxy URL)

### Supported Models (via Proxy)

**Anthropic Claude**:
- claude-3-5-sonnet-20241022
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

**Google Gemini**:
- gemini-1.5-pro
- gemini-1.5-flash
- gemini-pro

**Mistral AI**:
- mistral-large-latest
- mistral-medium-latest
- mistral-small-latest

**Cohere**:
- command-r-plus
- command-r
- command-light

**Local Models**:
- Ollama (llama3, mistral, etc.)
- vLLM
- Together AI
- Any OpenAI-compatible endpoint

### Features

**Multi-Provider**: ✅
- Single interface for all providers
- Automatic format conversion
- Unified authentication

**Model Discovery**: ✅
- Fetch available models from proxy
- Dynamic model configuration

**Function Calling**: ✅ (provider-dependent)
- Works with Claude, GPT, Gemini
- Automatic tool definition translation

**Cost Tracking**: ✅
- Per-request cost tracking
- Token usage monitoring

### LiteLLM Proxy Setup

#### Option 1: Cloud Deployment

```bash
# Deploy to cloud
docker run -e DATABASE_URL=postgresql://... \
  -e MASTER_KEY=sk-... \
  -p 4000:4000 \
  ghcr.io/berriai/litellm:main-latest
```

#### Option 2: Local Deployment

```bash
# Install
pip install litellm

# Create config
cat > config.yaml <<EOF
model_list:
  - model_name: claude-3-5-sonnet
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: sk-ant-...

  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: sk-...

  - model_name: llama3-local
    litellm_params:
      model: ollama/llama3
      api_base: http://localhost:11434
EOF

# Start proxy
litellm --config config.yaml --port 4000
```

### Configuration

```typescript
// Set endpoint and key
localStorage.setItem('ai_chat_litellm_endpoint', 'http://localhost:4000');
localStorage.setItem('ai_chat_litellm_api_key', 'sk-...');

// Select model
localStorage.setItem('ai_chat_selected_model', 'claude-3-5-sonnet');
```

### Usage Example

```typescript
const response = await LLMClient.call({
  provider: 'litellm',
  model: 'claude-3-5-sonnet',
  messages: [
    { role: 'user', content: 'Analyze this data' }
  ],
  tools: getTools()
});
```

### Pricing

Varies by underlying model. LiteLLM proxy adds minimal overhead.

**Claude 3.5 Sonnet**: $3/$15 per 1M tokens (in/out)
**Gemini 1.5 Pro**: $3.50/$10.50 per 1M tokens
**Local Models**: Free (infrastructure costs only)

### Pros & Cons

**Pros**:
- ✅ Access to many models
- ✅ Unified interface
- ✅ Local model support
- ✅ Cost flexibility
- ✅ Vendor independence

**Cons**:
- ❌ Requires proxy setup
- ❌ Additional complexity
- ❌ Tool calling varies by model
- ❌ Proxy maintenance

### Best Practices

1. **Use Claude for long context**
   ```typescript
   model: 'claude-3-5-sonnet',  // 200K context
   messages: longConversationHistory
   ```

2. **Use local models for development**
   ```typescript
   model: 'llama3-local',  // Free, fast iteration
   ```

3. **Configure fallbacks**
   ```typescript
   const models = ['claude-3-5-sonnet', 'gpt-4', 'llama3-local'];
   for (const model of models) {
     try {
       return await LLMClient.call({ model, ... });
     } catch (e) {
       continue;  // Try next
     }
   }
   ```

---

## Groq Provider

### Overview

Ultra-fast LLM inference using specialized hardware (LPU).

**Provider ID**: `groq`

**Endpoint**: `https://api.groq.com/openai/v1/chat/completions`

### Supported Models

| Model | Context | Tokens/sec | Use Cases |
|-------|---------|------------|-----------|
| **llama-3.1-70b** | 128K | **750+** | General purpose, fast |
| **llama-3.1-8b** | 128K | **1000+** | Simple tasks, ultra-fast |
| **mixtral-8x7b** | 32K | **500+** | Reasoning, speed |
| **gemma-7b** | 8K | **600+** | Lightweight tasks |

### Features

**Ultra-Fast Inference**: ⚡
- 500-1000+ tokens/second
- <1 second time-to-first-token
- Ideal for real-time applications

**Function Calling**: ✅
- Reliable tool invocation
- OpenAI-compatible format

**Free Tier**: ✅
- Generous free quota
- Rate limits apply

### Configuration

```typescript
localStorage.setItem('ai_chat_groq_api_key', 'gsk_...');
```

### Usage Example

```typescript
const response = await LLMClient.call({
  provider: 'groq',
  model: 'llama-3.1-70b',
  messages: [
    { role: 'user', content: 'Quick data extraction task' }
  ],
  tools: getTools()
});
```

### Pricing

**Free Tier**:
- 30 requests/minute (llama-3.1-70b)
- 60 requests/minute (llama-3.1-8b)

**Paid** (when available):
- Significantly cheaper than GPT-4
- Pay per token with volume discounts

### Pros & Cons

**Pros**:
- ✅ **Extremely fast** (10-100x faster)
- ✅ Low latency
- ✅ Free tier available
- ✅ Cost-effective
- ✅ Good for high-volume

**Cons**:
- ❌ Limited model selection
- ❌ No vision capabilities
- ❌ Rate limits on free tier
- ❌ Newer service (less established)

### Best Practices

1. **Use for latency-sensitive tasks**
   ```typescript
   // ✅ Perfect for Groq: real-time interaction
   userFacing: true,
   provider: 'groq',
   model: 'llama-3.1-70b'
   ```

2. **Batch non-urgent tasks**
   ```typescript
   // For rate-limited free tier
   await Promise.all(
     batch.map(task => LLMClient.call({
       provider: 'groq',
       model: 'llama-3.1-8b',
       ...task
     }))
   );
   ```

3. **Use 8B model for simple tasks**
   ```typescript
   // Even faster, still capable
   model: 'llama-3.1-8b',
   task: 'Extract structured data'
   ```

---

## OpenRouter Provider

### Overview

Access to 100+ LLMs from various providers through a single API.

**Provider ID**: `openrouter`

**Endpoint**: `https://openrouter.ai/api/v1/chat/completions`

### Supported Models

**OpenAI**:
- gpt-4, gpt-4-turbo, gpt-3.5-turbo

**Anthropic**:
- claude-3-opus, claude-3-sonnet, claude-3-haiku

**Google**:
- gemini-pro, gemini-pro-vision

**Meta**:
- llama-3-70b, llama-3-8b, llama-2-70b

**Mistral**:
- mistral-large, mistral-medium, mixtral-8x7b

**Open Source**:
- dolphin-mixtral, nous-hermes, wizard-vicuna
- ...and 80+ more models

### Features

**Model Variety**: ✅
- 100+ models
- New models added regularly
- All major providers

**Unified Billing**: ✅
- Single credit system
- Pay-as-you-go
- Volume discounts

**Automatic Fallbacks**: ✅
- Define fallback chains
- Automatic retry on failure

**OAuth Support**: ✅
- PKCE flow implemented
- Secure authentication

**Model Routing**: ✅
- Use `auto` to let OpenRouter choose best model
- Cost/quality optimization

### Configuration

#### API Key Auth

```typescript
localStorage.setItem('ai_chat_openrouter_api_key', 'sk-or-v1-...');
```

#### OAuth Auth

```typescript
import { OpenRouterOAuth } from './auth/OpenRouterOAuth';

// Initiate OAuth flow
const oauth = new OpenRouterOAuth({
  clientId: 'your-client-id',
  redirectUri: 'http://localhost:8000/callback'
});

await oauth.authorize();
// Tokens stored automatically
```

### Usage Example

```typescript
const response = await LLMClient.call({
  provider: 'openrouter',
  model: 'anthropic/claude-3-5-sonnet',
  messages: [
    { role: 'user', content: 'Complex analysis task' }
  ],
  tools: getTools()
});
```

### Pricing

**Dynamic pricing**: Varies by model

**Examples** (per 1M tokens):
- GPT-4: $30/$60 (in/out)
- Claude 3.5 Sonnet: $3/$15
- Llama 3 70B: $0.52/$0.75
- Mistral 7B: $0.07/$0.07

**Credits**: Purchase credits, use across all models

### Pros & Cons

**Pros**:
- ✅ Huge model selection
- ✅ Single billing across providers
- ✅ Automatic fallbacks
- ✅ OAuth support
- ✅ Model routing
- ✅ Good for experimentation

**Cons**:
- ❌ Markup on model costs
- ❌ Additional latency (routing)
- ❌ Tool calling support varies
- ❌ Less control over specific endpoints

### Best Practices

1. **Use fallback chains**
   ```typescript
   model: 'anthropic/claude-3-5-sonnet',
   fallbacks: ['openai/gpt-4', 'meta/llama-3-70b']
   ```

2. **Use auto-routing for cost optimization**
   ```typescript
   model: 'openrouter/auto',  // Let OpenRouter choose
   preferences: {
     priority: 'cost',  // or 'quality', 'speed'
     maxCost: 0.01  // Per request limit
   }
   ```

3. **Monitor credits**
   ```typescript
   const balance = await OpenRouterProvider.getCredits();
   if (balance < 5) {
     await notifyLowBalance();
   }
   ```

---

## BrowserOperator Provider

### Overview

Custom provider optimized for browser automation tasks.

**Provider ID**: `browseroperator`

**Endpoint**: Configurable (custom deployment)

### Features

**Browser-Context-Aware**: ✅
- Models trained on browser automation
- DOM understanding
- Accessibility tree comprehension

**Custom Tools**: ✅
- Specialized tool definitions
- Browser-specific optimizations

**Optimized Prompts**: ✅
- Task-specific system prompts
- Context-aware instructions

### Configuration

```typescript
LLMClient.configure({
  provider: 'browseroperator',
  endpoint: 'http://localhost:9000',
  apiKey: 'custom-key'
});
```

### Usage Example

```typescript
const response = await LLMClient.call({
  provider: 'browseroperator',
  model: 'browser-gpt-4',
  messages: [
    { role: 'user', content: 'Click the submit button' }
  ],
  context: {
    accessibilityTree: currentA11yTree,
    viewport: { width: 1920, height: 1080 }
  }
});
```

### Use Cases

- Custom browser automation workflows
- Specialized model deployments
- Internal tooling
- Research and experimentation

---

## Provider Selection Guide

### Decision Tree

```
Need local/offline deployment?
├─ Yes → LiteLLM (with local models)
└─ No ↓

Need maximum speed?
├─ Yes → Groq
└─ No ↓

Need vision capabilities?
├─ Yes → OpenAI (GPT-4V) or OpenRouter
└─ No ↓

Need cost optimization?
├─ Yes → OpenRouter (model variety) or Groq
└─ No ↓

Need highest quality?
├─ Yes → OpenAI (GPT-4) or LiteLLM (Claude 3.5 Sonnet)
└─ No ↓

Want model flexibility?
└─ OpenRouter or LiteLLM
```

### By Use Case

**Production Applications**:
- Primary: OpenAI (GPT-4)
- Fallback: LiteLLM (Claude)

**Cost-Sensitive**:
- Primary: Groq (Llama 3.1)
- Fallback: OpenRouter (cheap models)

**High-Volume**:
- Primary: Groq (fast, cheap)
- Fallback: OpenAI (GPT-3.5)

**Development/Testing**:
- Primary: LiteLLM (local models)
- Fallback: Groq (free tier)

**Research/Experimentation**:
- Primary: OpenRouter (model variety)
- Fallback: LiteLLM (flexibility)

**Real-Time UX**:
- Primary: Groq (ultra-fast)
- Fallback: OpenAI (GPT-3.5)

---

## Configuration

### Settings Dialog

1. Open AI Chat Panel
2. Click Settings icon
3. Navigate to LLM Providers tab
4. Configure each provider:
   - API Key
   - Endpoint (if applicable)
   - Default model
   - Advanced settings

### LocalStorage Keys

```typescript
// OpenAI
'ai_chat_api_key': string

// LiteLLM
'ai_chat_litellm_endpoint': string
'ai_chat_litellm_api_key': string

// Groq
'ai_chat_groq_api_key': string

// OpenRouter
'ai_chat_openrouter_api_key': string
'ai_chat_openrouter_access_token': string  // OAuth
'ai_chat_openrouter_refresh_token': string

// Global
'ai_chat_selected_model': string
'ai_chat_custom_models': JSON  // Custom model configs
```

### Programmatic Configuration

```typescript
import { LLMConfigurationManager } from './LLM/LLMConfigurationManager';

const config = LLMConfigurationManager.getInstance();

// Set provider
config.setProvider('openai');
config.setApiKey('openai', 'sk-...');
config.setModel('gpt-4');

// Override for specific call
LLMClient.call({
  provider: 'groq',  // Override
  model: 'llama-3.1-70b',
  ...
});
```

---

## Best Practices

### 1. Provider Fallbacks

Implement fallback chains for reliability:

```typescript
const providers = [
  { provider: 'openai', model: 'gpt-4' },
  { provider: 'litellm', model: 'claude-3-5-sonnet' },
  { provider: 'groq', model: 'llama-3.1-70b' }
];

async function callWithFallback(request) {
  for (const config of providers) {
    try {
      return await LLMClient.call({ ...config, ...request });
    } catch (error) {
      console.warn(`${config.provider} failed, trying next...`);
      continue;
    }
  }
  throw new Error('All providers failed');
}
```

### 2. Cost Optimization

Use cheaper models for appropriate tasks:

```typescript
function selectModel(task) {
  if (task.complexity === 'high') {
    return { provider: 'openai', model: 'gpt-4' };
  } else if (task.realTime) {
    return { provider: 'groq', model: 'llama-3.1-70b' };
  } else {
    return { provider: 'openai', model: 'gpt-3.5-turbo' };
  }
}
```

### 3. Performance Monitoring

Track provider performance:

```typescript
import { TracingProvider } from './tracing/TracingProvider';

const tracing = TracingProvider.getInstance();

await tracing.traceCall({
  provider: 'groq',
  model: 'llama-3.1-70b',
  // Automatically logs: latency, tokens, cost, errors
});
```

### 4. Security

Protect API keys:

```typescript
// ✅ Good: Use environment variables or secure storage
const apiKey = process.env.OPENAI_API_KEY;

// ❌ Bad: Hardcode keys
const apiKey = 'sk-1234...';  // Never do this!

// ✅ Good: Validate keys before use
if (!isValidApiKey(apiKey)) {
  throw new Error('Invalid API key format');
}
```

### 5. Rate Limiting

Respect provider rate limits:

```typescript
import { RateLimiter } from './common/RateLimiter';

const limiter = new RateLimiter({
  'openai': { requests: 60, per: 'minute' },
  'groq': { requests: 30, per: 'minute' }
});

await limiter.wait(provider);
const response = await LLMClient.call({ provider, ... });
```

---

## Related Documentation

- [Architecture.md](./Architecture.md) - System architecture
- [Tools-Reference.md](./Tools-Reference.md) - Available tools
- [Evaluation-Guide.md](./Evaluation-Guide.md) - Testing providers

---

**Document Version**: 1.0
**Last Updated**: 2025-01-XX
**Maintainers**: Browser Operator Team
