import { useState } from 'react';
import { useModalStore } from './modals';
import { useDataStudioStore } from '../store';
import { Button, Input, Card } from '@/components/ui';
import { XIcon, PlusIcon } from './Icons';
import type { InlineAgentConfig, LLMProviderType } from '../types';

interface OutputColumn {
  key: string;
  label: string;
}

function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Available tools for inline agents
const AVAILABLE_TOOLS = [
  { name: 'navigate_url', description: 'Navigate to URLs' },
  { name: 'extract_data', description: 'Extract data from pages' },
  { name: 'perform_action', description: 'Click, type, and interact with elements' },
  { name: 'screenshot', description: 'Take screenshots' },
  { name: 'web_search', description: 'Search the web' },
];

// Available LLM providers and their models
const LLM_PROVIDERS: { value: LLMProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'cerebras', label: 'Cerebras' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
];

const MODELS_BY_PROVIDER: Record<LLMProviderType, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  cerebras: [
    { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
};

export function AddAgentModal() {
  const activeModal = useModalStore(state => state.activeModal);
  const closeModal = useModalStore(state => state.closeModal);
  const availableAgents = useDataStudioStore(state => state.availableAgents);
  const requestAddAgentGroup = useDataStudioStore(state => state.requestAddAgentGroup);
  const requestAddInlineAgentGroup = useDataStudioStore(state => state.requestAddInlineAgentGroup);

  // Tab state: 'select' for existing agents, 'inline' for creating new
  const [tab, setTab] = useState<'select' | 'inline'>('select');

  // Common fields
  const [queryTemplate, setQueryTemplate] = useState('');
  const [columns, setColumns] = useState<OutputColumn[]>([{ key: '', label: '' }]);
  const [error, setError] = useState('');

  // Select agent fields
  const [agentName, setAgentName] = useState('');

  // Inline agent fields
  const [inlineName, setInlineName] = useState('');
  const [inlineDisplayName, setInlineDisplayName] = useState('');
  const [inlineDescription, setInlineDescription] = useState('');
  const [inlineSystemPrompt, setInlineSystemPrompt] = useState('');
  const [inlineTools, setInlineTools] = useState<string[]>(['navigate_url', 'extract_data']);
  const [inlineMaxIterations, setInlineMaxIterations] = useState(10);
  const [inlineProvider, setInlineProvider] = useState<LLMProviderType>('openai');
  const [inlineModel, setInlineModel] = useState('gpt-4o-mini');

  if (activeModal !== 'addAgent') return null;

  const handleAddColumn = () => {
    setColumns([...columns, { key: '', label: '' }]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, field: 'key' | 'label', value: string) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };

  const handleToolToggle = (toolName: string) => {
    if (inlineTools.includes(toolName)) {
      setInlineTools(inlineTools.filter(t => t !== toolName));
    } else {
      setInlineTools([...inlineTools, toolName]);
    }
  };

  const handleProviderChange = (provider: LLMProviderType) => {
    setInlineProvider(provider);
    // Reset model to first available for this provider
    const models = MODELS_BY_PROVIDER[provider];
    if (models && models.length > 0) {
      setInlineModel(models[0].value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Common validation
    if (!queryTemplate.trim()) {
      setError('Query template is required');
      return;
    }

    const validColumns = columns.filter(c => c.key.trim() && c.label.trim());
    if (validColumns.length === 0) {
      setError('At least one output column with key and label is required');
      return;
    }

    const outputColumns = validColumns.map(c => ({
      id: generateId(),
      key: c.key.trim(),
      label: c.label.trim(),
    }));

    if (tab === 'select') {
      // Validate select agent
      if (!agentName) {
        setError('Please select an agent');
        return;
      }
      setError('');
      requestAddAgentGroup(agentName, queryTemplate.trim(), outputColumns);
    } else {
      // Validate inline agent
      if (!inlineName.trim()) {
        setError('Agent name is required');
        return;
      }
      if (!inlineDisplayName.trim()) {
        setError('Display name is required');
        return;
      }
      if (!inlineSystemPrompt.trim()) {
        setError('System prompt is required');
        return;
      }
      if (inlineTools.length === 0) {
        setError('Select at least one tool');
        return;
      }

      setError('');
      const inlineConfig: InlineAgentConfig = {
        name: inlineName.trim().toLowerCase().replace(/\s+/g, '_'),
        displayName: inlineDisplayName.trim(),
        description: inlineDescription.trim() || inlineDisplayName.trim(),
        systemPrompt: inlineSystemPrompt.trim(),
        tools: inlineTools,
        maxIterations: inlineMaxIterations,
        provider: inlineProvider,
        model: inlineModel,
      };
      requestAddInlineAgentGroup(inlineConfig, queryTemplate.trim(), outputColumns);
    }

    handleClose();
  };

  const handleClose = () => {
    setTab('select');
    setAgentName('');
    setQueryTemplate('');
    setColumns([{ key: '', label: '' }]);
    setError('');
    setInlineName('');
    setInlineDisplayName('');
    setInlineDescription('');
    setInlineSystemPrompt('');
    setInlineTools(['navigate_url', 'extract_data']);
    setInlineMaxIterations(10);
    setInlineProvider('openai');
    setInlineModel('gpt-4o-mini');
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-auto animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">Add Agent Column</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border">
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${tab === 'select' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab('select')}
          >
            Select Agent
          </button>
          <button
            type="button"
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${tab === 'inline' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab('inline')}
          >
            Create Inline Agent
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md" data-testid="add-agent-error">
              {error}
            </div>
          )}

          {tab === 'select' ? (
            // SELECT AGENT TAB
            <div>
              <label className="block text-sm font-medium mb-2">Select Agent</label>
              <select
                value={agentName}
                onChange={(e) => setAgentName((e.target as HTMLSelectElement).value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Select an agent --</option>
                {availableAgents.map(agent => (
                  <option key={agent.name} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            </div>
          ) : (
            // INLINE AGENT TAB
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input
                    value={inlineName}
                    onInput={(e) => setInlineName((e.target as HTMLInputElement).value)}
                    placeholder="e.g., summary_agent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Display Name</label>
                  <Input
                    value={inlineDisplayName}
                    onInput={(e) => setInlineDisplayName((e.target as HTMLInputElement).value)}
                    placeholder="e.g., Quick Summary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <Input
                  value={inlineDescription}
                  onInput={(e) => setInlineDescription((e.target as HTMLInputElement).value)}
                  placeholder="Brief description of what this agent does"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">System Prompt</label>
                <textarea
                  value={inlineSystemPrompt}
                  onInput={(e) => setInlineSystemPrompt((e.target as HTMLTextAreaElement).value)}
                  placeholder="You are a helpful assistant. Return a JSON object with the requested fields..."
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tools</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TOOLS.map(tool => (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => handleToolToggle(tool.name)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        inlineTools.includes(tool.name)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:border-primary'
                      }`}
                      title={tool.description}
                    >
                      {tool.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">LLM Provider</label>
                  <select
                    value={inlineProvider}
                    onChange={(e) => handleProviderChange((e.target as HTMLSelectElement).value as LLMProviderType)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {LLM_PROVIDERS.map(provider => (
                      <option key={provider.value} value={provider.value}>{provider.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Model</label>
                  <select
                    value={inlineModel}
                    onChange={(e) => setInlineModel((e.target as HTMLSelectElement).value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {MODELS_BY_PROVIDER[inlineProvider].map(model => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Iterations: {inlineMaxIterations}</label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={inlineMaxIterations}
                  onChange={(e) => setInlineMaxIterations(Number((e.target as HTMLInputElement).value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Common fields */}
          <div>
            <label className="block text-sm font-medium mb-2">Query Template</label>
            <textarea
              value={queryTemplate}
              onInput={(e) => setQueryTemplate((e.target as HTMLTextAreaElement).value)}
              placeholder="e.g., Analyze {entity}'s market position and key features"
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">Use {'{entity}'} as a placeholder for the entity name</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Output Columns</label>
            <div className="space-y-2">
              {columns.map((col, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={col.key}
                    onInput={(e) => handleColumnChange(i, 'key', (e.target as HTMLInputElement).value)}
                    placeholder="Key (e.g., summary)"
                    className="flex-1"
                  />
                  <Input
                    value={col.label}
                    onInput={(e) => handleColumnChange(i, 'label', (e.target as HTMLInputElement).value)}
                    placeholder="Label (e.g., Summary)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveColumn(i)}
                    disabled={columns.length <= 1}
                    className={columns.length <= 1 ? 'invisible' : ''}
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddColumn} className="mt-2">
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Column
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit">{tab === 'inline' ? 'Create Inline Agent' : 'Add Agent Column'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
