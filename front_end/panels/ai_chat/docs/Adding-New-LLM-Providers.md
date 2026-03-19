# Adding New LLM Providers

This guide explains how to add support for a new LLM provider to the DevTools AI Chat panel. The examples are based on recent additions of Anthropic, Cerebras, and Google AI providers.

## Overview

Adding a new provider involves creating a provider implementation class, registering it in several configuration files, and updating the UI to support credential management and model selection.

## Step-by-Step Guide

### 1. Create the Provider Implementation

Create a new file in `front_end/panels/ai_chat/LLM/` named `{ProviderName}Provider.ts`.

**Required Imports:**
```typescript
import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProvider, ModelInfo, MessageContent } from './LLMTypes.js';
import { LLMBaseProvider } from './LLMProvider.js';
import { LLMRetryManager } from './LLMErrorHandler.js';
import { LLMResponseParser } from './LLMResponseParser.js';
import { createLogger } from '../core/Logger.js';
```

**Class Structure:**
```typescript
const logger = createLogger('YourProviderName');

export class YourProvider extends LLMBaseProvider {
  private static readonly API_BASE_URL = 'https://api.yourprovider.com/v1';

  readonly name: LLMProvider = 'yourprovider';

  constructor(private readonly apiKey: string) {
    super();
  }

  // Required methods (detailed below)
}
```

### 2. Implement Required Methods

All providers must implement these methods from `LLMProviderInterface`:

#### a. `callWithMessages()`
The primary method for making API calls:

```typescript
async callWithMessages(
  modelName: string,
  messages: LLMMessage[],
  options?: LLMCallOptions
): Promise<LLMResponse> {
  return LLMRetryManager.simpleRetry(async () => {
    // Convert messages to provider format
    const convertedMessages = this.convertMessagesToProviderFormat(messages);

    // Build payload
    const payload = {
      model: modelName,
      messages: convertedMessages,
      temperature: options?.temperature,
      // Add tools if provided
      ...(options?.tools && { tools: this.convertToolsToProviderFormat(options.tools) })
    };

    // Make API request
    const data = await this.makeAPIRequest(endpoint, payload);

    // Process and return response
    return this.processProviderResponse(data);
  }, options?.retryConfig);
}
```

#### b. `call()`
Simplified method for backward compatibility:

```typescript
async call(
  modelName: string,
  prompt: string,
  systemPrompt: string,
  options?: LLMCallOptions
): Promise<LLMResponse> {
  const messages: LLMMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  return this.callWithMessages(modelName, messages, options);
}
```

#### c. `getModels()`
Fetch available models:

```typescript
async getModels(): Promise<ModelInfo[]> {
  try {
    // Fetch from API if available
    const models = await this.fetchModels();

    return models.map(model => ({
      id: model.id,
      name: model.displayName || model.id,
      provider: 'yourprovider' as LLMProvider,
      capabilities: {
        functionCalling: this.modelSupportsFunctionCalling(model.id),
        reasoning: this.modelSupportsReasoning(model.id),
        vision: this.modelSupportsVision(model.id),
        structured: true
      }
    }));
  } catch (error) {
    // Fallback to hardcoded list if API fails
    return this.getDefaultModels();
  }
}
```

#### d. `parseResponse()`
Parse the response:

```typescript
parseResponse(response: LLMResponse): ReturnType<typeof LLMResponseParser.parseResponse> {
  return LLMResponseParser.parseResponse(response);
}
```

#### e. `testConnection()`
Test API connectivity:

```typescript
async testConnection(modelName: string): Promise<{success: boolean, message: string}> {
  try {
    const testPrompt = 'Please respond with "Connection successful!" to confirm the connection is working.';
    const response = await this.call(modelName, testPrompt, '', { temperature: 0.1 });

    if (response.text?.toLowerCase().includes('connection')) {
      return {
        success: true,
        message: `Successfully connected to YourProvider with model ${modelName}`
      };
    }

    return {
      success: true,
      message: `Connected but received unexpected response: ${response.text || 'No response'}`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
```

#### f. `validateCredentials()`
Validate required credentials:

```typescript
validateCredentials(): {isValid: boolean, message: string, missingItems?: string[]} {
  const storageKeys = this.getCredentialStorageKeys();
  const apiKey = localStorage.getItem(storageKeys.apiKey!);

  if (!apiKey) {
    return {
      isValid: false,
      message: 'YourProvider API key is required. Please add your API key in Settings.',
      missingItems: ['API Key']
    };
  }

  return {
    isValid: true,
    message: 'YourProvider credentials are configured correctly.'
  };
}
```

#### g. `getCredentialStorageKeys()`
Define localStorage keys:

```typescript
getCredentialStorageKeys(): {apiKey: string} {
  return {
    apiKey: 'ai_chat_yourprovider_api_key'
  };
}
```

### 3. Message Format Conversion

Most providers require converting from the standard OpenAI message format to their specific format.

**Example: Anthropic conversion:**
```typescript
private convertMessagesToAnthropic(messages: LLMMessage[]): { system?: string, messages: any[] } {
  let systemPrompt: string | undefined;
  const anthropicMessages: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Anthropic uses a separate system parameter
      systemPrompt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      continue;
    }

    if (msg.role === 'user') {
      anthropicMessages.push({
        role: 'user',
        content: this.convertContentToAnthropic(msg.content)
      });
    } else if (msg.role === 'assistant') {
      // Handle tool calls and regular messages
      // ...
    } else if (msg.role === 'tool') {
      // Handle tool results
      // ...
    }
  }

  return { system: systemPrompt, messages: anthropicMessages };
}
```

**Example: Google AI conversion:**
```typescript
private convertMessagesToGoogleAI(messages: LLMMessage[]): { contents: any[] } {
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [this.convertContentToGoogleAI(msg.content)]
      });
    } else if (msg.role === 'assistant') {
      contents.push({
        role: 'model', // Google AI uses 'model' instead of 'assistant'
        parts: [this.convertContentToGoogleAI(msg.content)]
      });
    }
  }

  return { contents };
}
```

### 4. Tool/Function Calling Support

If the provider supports function calling, convert tools to their format:

**Example: Anthropic:**
```typescript
private convertToolsToAnthropic(tools: any[]): any[] {
  return tools.map(tool => {
    if (tool.type === 'function' && tool.function) {
      return {
        name: tool.function.name,
        description: tool.function.description || '',
        input_schema: tool.function.parameters || { type: 'object', properties: {} }
      };
    }
    return null;
  }).filter(Boolean);
}
```

**Example: Google AI:**
```typescript
private convertToolsToGoogleAI(tools: any[]): any {
  const functionDeclarations = tools.map(tool => {
    if (tool.type === 'function' && tool.function) {
      return {
        name: tool.function.name,
        description: tool.function.description || '',
        parameters: tool.function.parameters || { type: 'object', properties: {} }
      };
    }
    return null;
  }).filter(Boolean);

  return functionDeclarations.length > 0 ? [{
    function_declarations: functionDeclarations
  }] : undefined;
}
```

### 5. Update Type Definitions

Add the new provider to the `LLMProvider` type in [LLMTypes.ts](../LLM/LLMTypes.ts):

```typescript
export type LLMProvider = 'openai' | 'litellm' | 'groq' | 'openrouter' | 'yourprovider';
```

### 6. Register Provider in LLMClient

Update [LLMClient.ts](../LLM/LLMClient.ts):

**Add import:**
```typescript
import { YourProvider } from './YourProvider.js';
```

**Add to provider instantiation in `initialize()`:**
```typescript
case 'yourprovider':
  providerInstance = new YourProvider(providerConfig.apiKey);
  break;
```

**Add static methods for UI usage:**
```typescript
static async fetchYourProviderModels(apiKey: string): Promise<any[]> {
  const provider = new YourProvider(apiKey);
  const models = await provider.fetchModels();
  return models;
}

static async testYourProviderConnection(apiKey: string, modelName: string): Promise<{success: boolean, message: string}> {
  const provider = new YourProvider(apiKey);
  return provider.testConnection(modelName);
}
```

**Add to validation switch in `validateProviderCredentials()`:**
```typescript
case 'yourprovider':
  provider = new YourProvider('');
  break;
```

### 7. Update BUILD.gn

Add your provider file to [BUILD.gn](../BUILD.gn) in two places:

```gn
devtools_module("ai_chat") {
  sources = [
    # ... other files
    "LLM/YourProvider.ts",
  ]
}

_ai_chat_sources = [
  # ... other files
  "LLM/YourProvider.ts",
]
```

### 8. Update Settings Dialog UI

Update [SettingsDialog.ts](../ui/SettingsDialog.ts):

**Add constants:**
```typescript
const YOURPROVIDER_API_KEY_STORAGE_KEY = 'ai_chat_yourprovider_api_key';
```

**Update ModelOption interface:**
```typescript
interface ModelOption {
  value: string;
  label: string;
  type: 'openai' | 'litellm' | 'groq' | 'openrouter' | 'yourprovider';
}
```

**Add UI strings:**
```typescript
const UIStrings = {
  // ...
  yourproviderProvider: 'YourProvider',
  yourproviderApiKeyLabel: 'YourProvider API Key',
  yourproviderApiKeyHint: 'Your YourProvider API key for authentication',
  fetchYourProviderModelsButton: 'Fetch YourProvider Models',
};
```

**Add static model selectors:**
```typescript
static #yourproviderMiniModelSelect: any | null = null;
static #yourproviderNanoModelSelect: any | null = null;
```

**Add provider option to dropdown:**
```typescript
const yourproviderOption = document.createElement('option');
yourproviderOption.value = 'yourprovider';
yourproviderOption.textContent = i18nString(UIStrings.yourproviderProvider);
yourproviderOption.selected = currentProvider === 'yourprovider';
providerSelect.appendChild(yourproviderOption);
```

**Add provider content section:**
```typescript
const yourproviderContent = document.createElement('div');
yourproviderContent.className = 'provider-content yourprovider-content';
yourproviderContent.style.display = currentProvider === 'yourprovider' ? 'block' : 'none';
contentDiv.appendChild(yourproviderContent);
```

**Add provider visibility toggle:**
```typescript
providerSelect.addEventListener('change', async () => {
  const selectedProvider = providerSelect.value;
  // ... other providers
  yourproviderContent.style.display = selectedProvider === 'yourprovider' ? 'block' : 'none';
});
```

**Create provider settings UI:**
```typescript
// Setup YourProvider content
const yourproviderSettingsSection = document.createElement('div');
yourproviderSettingsSection.className = 'settings-section';
yourproviderContent.appendChild(yourproviderSettingsSection);

// API Key input
const yourproviderApiKeyLabel = document.createElement('div');
yourproviderApiKeyLabel.className = 'settings-label';
yourproviderApiKeyLabel.textContent = i18nString(UIStrings.yourproviderApiKeyLabel);
yourproviderSettingsSection.appendChild(yourproviderApiKeyLabel);

const yourproviderApiKeyInput = document.createElement('input');
yourproviderApiKeyInput.className = 'settings-input yourprovider-api-key-input';
yourproviderApiKeyInput.type = 'password';
yourproviderApiKeyInput.placeholder = 'Enter your YourProvider API key';
yourproviderApiKeyInput.value = localStorage.getItem(YOURPROVIDER_API_KEY_STORAGE_KEY) || '';
yourproviderSettingsSection.appendChild(yourproviderApiKeyInput);
```

**Add fetch models button (if provider has models API):**
```typescript
const fetchYourProviderModelsButton = document.createElement('button');
fetchYourProviderModelsButton.className = 'settings-button';
fetchYourProviderModelsButton.setAttribute('type', 'button');
fetchYourProviderModelsButton.textContent = i18nString(UIStrings.fetchYourProviderModelsButton);
fetchYourProviderModelsButton.disabled = !yourproviderApiKeyInput.value.trim();

fetchYourProviderModelsButton.addEventListener('click', async () => {
  fetchYourProviderModelsButton.disabled = true;

  try {
    const apiKey = yourproviderApiKeyInput.value.trim();
    const models = await LLMClient.fetchYourProviderModels(apiKey);

    const modelOptions: ModelOption[] = models.map(model => ({
      value: model.id,
      label: model.name || model.id,
      type: 'yourprovider' as const
    }));

    updateModelOptions(modelOptions, false);

    // Update model selectors
    if (SettingsDialog.#yourproviderMiniModelSelect) {
      refreshModelSelectOptions(SettingsDialog.#yourproviderMiniModelSelect, modelOptions, miniModel);
    }

    localStorage.setItem(YOURPROVIDER_API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    // Handle error
  } finally {
    fetchYourProviderModelsButton.disabled = false;
  }
});
```

**Create model selectors:**
```typescript
function updateYourProviderModelSelectors() {
  const yourproviderModels = getModelOptions('yourprovider');
  const validMiniModel = getValidModelForProvider(miniModel, yourproviderModels, 'yourprovider', 'mini');
  const validNanoModel = getValidModelForProvider(nanoModel, yourproviderModels, 'yourprovider', 'nano');

  const yourproviderModelSection = document.createElement('div');
  yourproviderModelSection.className = 'settings-section model-selection-section';
  yourproviderContent.appendChild(yourproviderModelSection);

  SettingsDialog.#yourproviderMiniModelSelect = createModelSelector(
    yourproviderModelSection,
    i18nString(UIStrings.miniModelLabel),
    i18nString(UIStrings.miniModelDescription),
    'yourprovider-mini-model-select',
    yourproviderModels,
    validMiniModel,
    i18nString(UIStrings.defaultMiniOption),
    undefined
  );

  SettingsDialog.#yourproviderNanoModelSelect = createModelSelector(
    yourproviderModelSection,
    i18nString(UIStrings.nanoModelLabel),
    i18nString(UIStrings.nanoModelDescription),
    'yourprovider-nano-model-select',
    yourproviderModels,
    validNanoModel,
    i18nString(UIStrings.defaultNanoOption),
    undefined
  );
}
```

## Provider Comparison Examples

### Anthropic Provider
- **API Style**: Custom Messages API
- **Authentication**: `x-api-key` header
- **System Messages**: Separate `system` parameter
- **Tool Calls**: `tool_use` blocks in content array
- **Special Features**: Beta headers for reasoning/thinking mode

### Cerebras Provider
- **API Style**: OpenAI-compatible
- **Authentication**: `Bearer` token
- **System Messages**: Standard message array
- **Tool Calls**: OpenAI format
- **Special Features**: Models API for dynamic model listing

### Google AI Provider
- **API Style**: Gemini/GenerativeAI format
- **Authentication**: API key in URL query parameter
- **System Messages**: First user message or separate instruction
- **Tool Calls**: `function_declarations` format
- **Special Features**: `parts` array for multimodal content

## Testing Your Provider

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Test in DevTools:**
   - Open Settings dialog
   - Select your new provider
   - Enter API credentials
   - Fetch models (if applicable)
   - Test connection with a simple query

3. **Verify:**
   - Credentials are saved to localStorage
   - Models load correctly
   - Chat completions work
   - Function calling works (if supported)
   - Error handling works properly

## Common Patterns

### API Request Helper
```typescript
private async makeAPIRequest(endpoint: string, payloadBody: any): Promise<any> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payloadBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`API error: ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    // Log usage if available
    if (data.usage) {
      logger.info('Usage:', data.usage);
    }

    return data;
  } catch (error) {
    logger.error('API request failed:', error);
    throw error;
  }
}
```

### Default Models List
```typescript
private getDefaultModels(): ModelInfo[] {
  return [
    {
      id: 'model-id',
      name: 'Model Display Name',
      provider: 'yourprovider' as LLMProvider,
      capabilities: {
        functionCalling: true,
        reasoning: false,
        vision: false,
        structured: true
      }
    }
  ];
}
```

## Troubleshooting

### Provider Not Appearing in Settings
- Check that you added it to the `LLMProvider` type union in `LLMTypes.ts`
- Verify BUILD.gn includes the new file
- Ensure the provider option is added to the dropdown in SettingsDialog

### Models Not Loading
- Check the `getModels()` implementation
- Verify API credentials are correct
- Check browser console for error messages
- Ensure the fallback `getDefaultModels()` is implemented

### Function Calling Not Working
- Verify tool conversion format matches provider's API spec
- Check that `capabilities.functionCalling` is set to `true`
- Ensure tool response format matches what the provider expects

## References

- Base Provider Interface: [LLMProvider.ts](../LLM/LLMProvider.ts)
- Type Definitions: [LLMTypes.ts](../LLM/LLMTypes.ts)
- Client Integration: [LLMClient.ts](../LLM/LLMClient.ts)
- Example Providers:
  - [AnthropicProvider.ts](../LLM/AnthropicProvider.ts)
  - [CerebrasProvider.ts](../LLM/CerebrasProvider.ts)
  - [GoogleAIProvider.ts](../LLM/GoogleAIProvider.ts)
  - [OpenAIProvider.ts](../LLM/OpenAIProvider.ts)
