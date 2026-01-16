/**
 * LLM Initialization for Eval Runner
 *
 * Initializes the LLMClient singleton with provider configuration.
 * Bypasses browser-specific features like localStorage.
 */

import { LLMClient } from '../../../front_end/panels/ai_chat/LLM/LLMClient.ts';
import type { LLMProvider } from '../../../front_end/panels/ai_chat/LLM/LLMTypes.ts';
import { createLogger } from '../../../front_end/panels/ai_chat/core/Logger.ts';

const logger = createLogger('LLMInit');

export interface EvalLLMConfig {
  provider: string;
  apiKey: string;
  model: string;
  providerURL?: string;
}

export interface ProviderConfig {
  provider: LLMProvider;
  apiKey: string;
  providerURL?: string;
}

/**
 * Get all available provider configurations from environment variables.
 * This allows inline agents to use different providers than the default.
 */
function getAllAvailableProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      provider: 'openai' as LLMProvider,
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Cerebras
  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      provider: 'cerebras' as LLMProvider,
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  }

  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      provider: 'anthropic' as LLMProvider,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  // Groq
  if (process.env.GROQ_API_KEY) {
    providers.push({
      provider: 'groq' as LLMProvider,
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return providers;
}

/**
 * Initialize LLMClient for eval runner context.
 * This bypasses localStorage-based configuration used in DevTools.
 * Registers all available providers from environment variables.
 */
export async function initializeLLMForEval(config: EvalLLMConfig): Promise<LLMClient> {
  const client = LLMClient.getInstance();

  // Get all available providers from environment
  const allProviders = getAllAvailableProviders();

  // Ensure the primary provider is included
  const primaryProviderExists = allProviders.some(p => p.provider === config.provider);
  if (!primaryProviderExists && config.apiKey) {
    allProviders.unshift({
      provider: config.provider as LLMProvider,
      apiKey: config.apiKey,
      providerURL: config.providerURL,
    });
  }

  await client.initialize({
    providers: allProviders,
  });

  const providerNames = allProviders.map(p => p.provider);
  logger.info(`Initialized LLM client with ${config.provider} provider`);
  logger.debug(`All registered providers: ${providerNames.join(', ')}`);
  return client;
}
