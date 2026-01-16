// Data Studio Types

export interface DataTable {
  id: string;
  name: string;
  entityType: string;
  entityNameLabel: string;
  entities: Entity[];
  agentGroups: AgentGroup[];
  results: Record<string, Record<string, CellResult>>;
  createdAt: string;
  modifiedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  context?: string;
}

export type LLMProviderType = 'openai' | 'cerebras' | 'anthropic' | 'groq';

export interface InlineAgentConfig {
  name: string;           // Internal name (e.g., "company_summary_agent")
  displayName: string;    // Display name in UI
  description: string;    // What the agent does
  systemPrompt: string;   // Custom system prompt
  tools: string[];        // List of tool names (e.g., ["navigate_url", "extract_data"])
  maxIterations?: number; // Default: 10
  temperature?: number;   // Default: 0.7
  provider?: LLMProviderType;  // LLM provider (default: server default)
  model?: string;              // LLM model (default: server default)
}

export interface AgentGroup {
  id: string;
  agentName?: string;              // Optional - for referenced agents
  inlineAgent?: InlineAgentConfig; // Optional - for inline agents
  queryTemplate: string;
  outputColumns: OutputColumn[];
}

export interface OutputColumn {
  id: string;
  key: string;
  label: string;
}

export interface CellResult {
  status: 'pending' | 'running' | 'completed' | 'error';
  values?: Record<string, string>;
  error?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  entityType: string;
  entityNameLabel: string;
  defaultEntities?: string[];
  defaultAgents?: Array<{
    agentName: string;
    queryTemplate: string;
    outputColumns: OutputColumn[];
  }>;
}

export interface DataStudioState {
  view: 'selector' | 'table';
  tables: Array<{ id: string; name: string; entityType: string }>;
  templates: Template[];
  currentTable: DataTable | null;
  availableAgents: Array<{ name: string; description: string }>;
  isRunning: boolean;
}
