import * as i18n from '../../../../core/i18n/i18n.js';
import * as UI from '../../../../ui/legacy/legacy.js';
import * as Snackbars from '../../../../ui/components/snackbars/snackbars.js';
import { createLogger } from '../../core/Logger.js';
import { MCPRegistry } from '../../mcp/MCPRegistry.js';
import { getMCPProviders, saveMCPProviders, type MCPProviderConfig } from '../../mcp/MCPConfig.js';
import { MCPConnectionsDialog } from './MCPConnectionsDialog.js';

const logger = createLogger('MCPConnectorsCatalogDialog');

const LOGO_URLS = {
  sentry: new URL('../../../../Images/mcp/sentry.svg', import.meta.url).toString(),
  atlassian: new URL('../../../../Images/mcp/atlassian.svg', import.meta.url).toString(),
  linear: new URL('../../../../Images/mcp/linear.svg', import.meta.url).toString(),
  notion: new URL('../../../../Images/mcp/notion.svg', import.meta.url).toString(),
  slack: new URL('../../../../Images/mcp/slack.svg', import.meta.url).toString(),
  github: new URL('../../../../Images/mcp/github.svg', import.meta.url).toString(),
  asana: new URL('../../../../Images/mcp/asana.svg', import.meta.url).toString(),
  intercom: new URL('../../../../Images/mcp/intercom.svg', import.meta.url).toString(),
  'google-drive': new URL('../../../../Images/mcp/google-drive.svg', import.meta.url).toString(),
  huggingface: new URL('../../../../Images/mcp/huggingface.svg', import.meta.url).toString(),
  'google-sheets': new URL('../../../../Images/mcp/google-sheets.svg', import.meta.url).toString(),
  socket: new URL('../../../../Images/mcp/socket.svg', import.meta.url).toString(),
} as const;

type MCPConnectorLogoId = keyof typeof LOGO_URLS;

const UIStrings = {
  title: 'MCP Connectors',
  description: 'Connect to external services and tools to enhance your AI assistant capabilities.',
  searchPlaceholder: 'Search connectors...',
  connectionsStatus: '{PH1} of {PH2} connected',
  addButton: 'Add',
  added: 'Added!',
  closeButton: 'Close',
  manageConnectionsButton: 'Manage connections',
  manageConnectionsAction: 'Manage',
  successMessage: 'Added {PH1} connector.',
  alreadyExists: 'This connector is already configured.',
  connecting: 'Connecting…',
  oauthInProgress: 'Complete the {PH1} sign-in in the opened tab.',
  connectionFailed: 'Unable to add {PH1}. Please try again.',
  connectionFailedWithReason: 'Unable to add {PH1}: {PH2}',
  noResultsFound: 'No connectors found',
  expand: 'Expand',
  collapse: 'Collapse',
};

const str_ = i18n.i18n.registerUIStrings('panels/ai_chat/ui/mcp/MCPConnectorsCatalogDialog.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

interface MCPConnector {
  id: string;
  name: string;
  description: string;
  logo: MCPConnectorLogoId;
  endpoint: string;
  authType: 'oauth' | 'bearer';
  category: string;
}

const MCP_CONNECTORS: MCPConnector[] = [
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error monitoring & debugging production issues',
    logo: 'sentry',
    endpoint: 'https://mcp.sentry.dev/mcp',
    authType: 'oauth',
    category: 'Development'
  },
  {
    id: 'atlassian',
    name: 'Atlassian',
    description: 'Jira tickets & Confluence documentation',
    logo: 'atlassian',
    endpoint: 'https://mcp.atlassian.com/v1/sse',
    authType: 'oauth',
    category: 'Project Management'
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking & project management',
    logo: 'linear',
    endpoint: 'https://mcp.linear.app/sse',
    authType: 'oauth',
    category: 'Project Management'
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Documentation & knowledge management',
    logo: 'notion',
    endpoint: 'https://mcp.notion.com/mcp',
    authType: 'oauth',
    category: 'Documentation'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication & collaboration',
    logo: 'slack',
    endpoint: 'https://mcp.slack.com/v1/sse',
    authType: 'oauth',
    category: 'Communication'
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Code repositories & project management',
    logo: 'github',
    endpoint: 'https://mcp.github.com/v1',
    authType: 'oauth',
    category: 'Development'
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Task & project management platform',
    logo: 'asana',
    endpoint: 'https://mcp.asana.com/sse',
    authType: 'oauth',
    category: 'Project Management'
  },
  {
    id: 'intercom',
    name: 'Intercom',
    description: 'Customer support & conversations',
    logo: 'intercom',
    endpoint: 'https://mcp.intercom.com/mcp',
    authType: 'oauth',
    category: 'Communication'
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'File storage & document management',
    logo: 'google-drive',
    endpoint: 'https://mcp.googleapis.com/drive/v1',
    authType: 'oauth',
    category: 'Storage'
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'AI models & machine learning hub',
    logo: 'huggingface',
    endpoint: 'https://huggingface.co/mcp',
    authType: 'oauth',
    category: 'AI/ML'
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Spreadsheet data & analysis',
    logo: 'google-sheets',
    endpoint: 'https://mcp.googleapis.com/sheets/v1',
    authType: 'oauth',
    category: 'Data'
  },
  {
    id: 'socket',
    name: 'Socket',
    description: 'Security analysis for dependencies',
    logo: 'socket',
    endpoint: 'https://mcp.socket.dev/',
    authType: 'oauth',
    category: 'Security'
  }
];

interface MCPConnectorsCatalogDialogOptions {
  onClose?: () => void;
}

export class MCPConnectorsCatalogDialog {
  static show(options: MCPConnectorsCatalogDialogOptions = {}): void {
    const dialog = new MCPConnectorsCatalogDialog(options);
    dialog.show();
  }

  #dialog: UI.Dialog.Dialog;
  #options: MCPConnectorsCatalogDialogOptions;
  #existingProviders: MCPProviderConfig[] = [];
  #searchQuery = '';
  #collapsedCategories = new Set<string>();
  #connectorsContainer: HTMLElement | null = null;

  constructor(options: MCPConnectorsCatalogDialogOptions) {
    this.#options = options;
    this.#dialog = new UI.Dialog.Dialog();
    this.#existingProviders = getMCPProviders();
  }

  show(): void {
    this.#dialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MEASURE_CONTENT);
    this.#dialog.setDimmed(true);
    this.#dialog.setOutsideClickCallback(() => this.close());

    const content = this.#dialog.contentElement;
    content.classList.add('mcp-connectors-catalog-dialog');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';

    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .mcp-connectors-catalog-dialog {
        width: 600px;
        max-width: 90vw;
        max-height: 80vh;
        color: var(--color-text-primary);
        background: var(--color-background);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        overflow: hidden;
        border: 1px solid var(--color-details-hairline);
      }
      .mcp-catalog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-details-hairline);
        background: var(--color-background);
      }
      .mcp-catalog-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
        color: var(--color-text-primary);
      }
      .mcp-catalog-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        padding: 6px;
        color: var(--color-text-secondary);
        border-radius: 4px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
      }
      .mcp-catalog-close:hover {
        color: var(--color-text-primary);
        background: var(--color-background-elevation-1);
      }
      .mcp-catalog-body {
        overflow-y: auto;
        flex: 1;
        max-height: 60vh;
      }
      .mcp-catalog-search-section {
        padding: 16px 20px 0;
        border-bottom: 1px solid var(--color-details-hairline);
        background: var(--color-background);
      }
      .mcp-catalog-search-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--color-details-hairline);
        border-radius: 6px;
        background: var(--color-background);
        color: var(--color-text-primary);
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s ease;
      }
      .mcp-catalog-search-input:focus {
        border-color: var(--color-primary);
      }
      .mcp-catalog-search-input::placeholder {
        color: var(--color-text-secondary);
      }
      .mcp-catalog-status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        font-size: 13px;
        color: var(--color-text-secondary);
        background: var(--color-background-elevation-0);
        border-bottom: 1px solid var(--color-details-hairline);
      }
      .mcp-catalog-status-count {
        font-weight: 500;
      }
      .mcp-category-section {
        border-bottom: 1px solid var(--color-details-hairline-light);
      }
      .mcp-category-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: var(--color-background-elevation-0);
        cursor: pointer;
        transition: background 0.2s ease;
        border: none;
        width: 100%;
        text-align: left;
      }
      .mcp-category-header:hover {
        background: var(--color-background-elevation-1);
      }
      .mcp-category-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
      }
      .mcp-category-toggle {
        font-size: 12px;
        color: var(--color-text-secondary);
        transform: rotate(0deg);
        transition: transform 0.2s ease;
      }
      .mcp-category-toggle.collapsed {
        transform: rotate(-90deg);
      }
      .mcp-category-connectors {
        background: var(--color-background);
      }
      .mcp-category-connectors.collapsed {
        display: none;
      }
      .mcp-connector-item {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        border-bottom: 1px solid var(--color-details-hairline-light);
        transition: background 0.2s ease;
        min-height: 60px;
      }
      .mcp-connector-item:hover {
        background: var(--color-background-elevation-1);
      }
      .mcp-connector-item.connected {
        background: var(--color-primary-container);
        border-left: 3px solid var(--color-primary);
      }
      .mcp-connector-item.connecting {
        background: var(--color-background-elevation-1);
        opacity: 0.8;
      }
      .mcp-connector-logo {
        width: 24px;
        height: 24px;
        margin-right: 12px;
        flex-shrink: 0;
      }
      .mcp-connector-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .mcp-connector-content {
        flex: 1;
        min-width: 0;
      }
      .mcp-connector-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--color-text-primary);
        margin: 0 0 2px 0;
        line-height: 1.2;
      }
      .mcp-connector-description {
        font-size: 12px;
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mcp-connector-toggle {
        margin-left: 12px;
        flex-shrink: 0;
      }
      .mcp-toggle-switch {
        position: relative;
        width: 36px;
        height: 20px;
        background: var(--color-details-hairline);
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s ease;
        border: none;
        outline: none;
      }
      .mcp-toggle-switch.enabled {
        background: var(--color-primary);
      }
      .mcp-toggle-switch.connecting {
        background: var(--color-primary-container-border);
        cursor: wait;
      }
      .mcp-toggle-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .mcp-toggle-switch.enabled::after {
        transform: translateX(16px);
      }
      .mcp-connector-status {
        display: flex;
        align-items: center;
        margin-left: 8px;
        font-size: 12px;
        color: var(--color-text-secondary);
      }
      .mcp-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-primary);
        margin-right: 4px;
      }
      .mcp-no-results {
        text-align: center;
        padding: 40px 20px;
        color: var(--color-text-secondary);
        font-size: 14px;
      }
      .mcp-catalog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 20px;
        border-top: 1px solid var(--color-details-hairline);
        background: var(--color-background-elevation-0);
      }
      .mcp-manage-button {
        padding: 8px 16px;
        border: 1px solid var(--color-primary);
        background: var(--color-background);
        color: var(--color-primary);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      .mcp-manage-button:hover {
        background: var(--color-primary);
        color: var(--color-text-inverted);
      }
      .mcp-close-button {
        padding: 8px 16px;
        border: 1px solid var(--color-details-hairline);
        background: var(--color-background);
        color: var(--color-text-primary);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      .mcp-close-button:hover {
        background: var(--color-background-elevation-1);
        border-color: var(--color-primary-container-border);
      }
      .mcp-catalog-body::-webkit-scrollbar {
        width: 6px;
      }
      .mcp-catalog-body::-webkit-scrollbar-track {
        background: transparent;
      }
      .mcp-catalog-body::-webkit-scrollbar-thumb {
        background: var(--color-details-hairline);
        border-radius: 3px;
      }
      .mcp-catalog-body::-webkit-scrollbar-thumb:hover {
        background: var(--color-text-secondary);
      }
    `;
    content.appendChild(styleElement);

    const header = document.createElement('div');
    header.className = 'mcp-catalog-header';
    content.appendChild(header);

    const title = document.createElement('h2');
    title.className = 'mcp-catalog-title';
    title.textContent = i18nString(UIStrings.title);
    header.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.className = 'mcp-catalog-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.close());
    header.appendChild(closeButton);

    // Search section
    const searchSection = document.createElement('div');
    searchSection.className = 'mcp-catalog-search-section';
    content.appendChild(searchSection);

    const searchInput = document.createElement('input');
    searchInput.className = 'mcp-catalog-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = i18nString(UIStrings.searchPlaceholder);
    searchInput.addEventListener('input', (e) => {
      this.#searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderConnectors();
    });
    searchSection.appendChild(searchInput);

    // Status section
    const statusSection = document.createElement('div');
    statusSection.className = 'mcp-catalog-status';
    content.appendChild(statusSection);

    const connectedCount = this.#existingProviders.length;
    const totalCount = MCP_CONNECTORS.length;
    const statusText = document.createElement('span');
    statusText.className = 'mcp-catalog-status-count';
    statusText.textContent = i18nString(UIStrings.connectionsStatus, {PH1: connectedCount.toString(), PH2: totalCount.toString()});
    statusSection.appendChild(statusText);

    const description = document.createElement('span');
    description.textContent = i18nString(UIStrings.description);
    statusSection.appendChild(description);

    const body = document.createElement('div');
    body.className = 'mcp-catalog-body';
    content.appendChild(body);
    this.#connectorsContainer = body;

    this.renderConnectors();

    const footer = document.createElement('div');
    footer.className = 'mcp-catalog-footer';
    content.appendChild(footer);

    const manageButton = document.createElement('button');
    manageButton.className = 'mcp-manage-button';
    manageButton.textContent = i18nString(UIStrings.manageConnectionsButton);
    manageButton.addEventListener('click', () => this.#openManageConnections());
    footer.appendChild(manageButton);

    const footerCloseButton = document.createElement('button');
    footerCloseButton.className = 'mcp-close-button';
    footerCloseButton.textContent = i18nString(UIStrings.closeButton);
    footerCloseButton.addEventListener('click', () => this.close());
    footer.appendChild(footerCloseButton);

    this.#dialog.show();
  }

  private renderConnectors(): void {
    if (!this.#connectorsContainer) {
      return;
    }

    this.#connectorsContainer.innerHTML = '';

    // Filter connectors based on search
    const filteredConnectors = MCP_CONNECTORS.filter(connector => {
      if (!this.#searchQuery) return true;
      return connector.name.toLowerCase().includes(this.#searchQuery) ||
             connector.description.toLowerCase().includes(this.#searchQuery) ||
             connector.category.toLowerCase().includes(this.#searchQuery);
    });

    if (filteredConnectors.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'mcp-no-results';
      noResults.textContent = i18nString(UIStrings.noResultsFound);
      this.#connectorsContainer.appendChild(noResults);
      return;
    }

    // Group connectors by category
    const categorizedConnectors = filteredConnectors.reduce((acc, connector) => {
      if (!acc[connector.category]) {
        acc[connector.category] = [];
      }
      acc[connector.category].push(connector);
      return acc;
    }, {} as Record<string, MCPConnector[]>);

    // Render each category
    Object.entries(categorizedConnectors).forEach(([category, connectors]) => {
      const categorySection = this.createCategorySection(category, connectors);
      this.#connectorsContainer!.appendChild(categorySection);
    });
  }

  private createCategorySection(category: string, connectors: MCPConnector[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'mcp-category-section';

    // Category header
    const header = document.createElement('button');
    header.className = 'mcp-category-header';
    header.addEventListener('click', () => this.toggleCategory(category, header, connectorsContainer));

    const title = document.createElement('h3');
    title.className = 'mcp-category-title';
    title.textContent = category;
    header.appendChild(title);

    const toggle = document.createElement('span');
    toggle.className = 'mcp-category-toggle';
    toggle.textContent = '▼';
    if (this.#collapsedCategories.has(category)) {
      toggle.classList.add('collapsed');
    }
    header.appendChild(toggle);

    section.appendChild(header);

    // Connectors container
    const connectorsContainer = document.createElement('div');
    connectorsContainer.className = 'mcp-category-connectors';
    if (this.#collapsedCategories.has(category)) {
      connectorsContainer.classList.add('collapsed');
    }

    connectors.forEach(connector => {
      const item = this.createConnectorItem(connector);
      connectorsContainer.appendChild(item);
    });

    section.appendChild(connectorsContainer);
    return section;
  }

  private toggleCategory(category: string, header: HTMLElement, container: HTMLElement): void {
    const toggle = header.querySelector('.mcp-category-toggle') as HTMLElement;

    if (this.#collapsedCategories.has(category)) {
      this.#collapsedCategories.delete(category);
      container.classList.remove('collapsed');
      toggle.classList.remove('collapsed');
    } else {
      this.#collapsedCategories.add(category);
      container.classList.add('collapsed');
      toggle.classList.add('collapsed');
    }
  }

  private createConnectorItem(connector: MCPConnector): HTMLElement {
    const item = document.createElement('div');
    item.className = 'mcp-connector-item';

    const isConnected = this.#existingProviders.some(
      provider => provider.endpoint === connector.endpoint
    );

    if (isConnected) {
      item.classList.add('connected');
    }

    // Logo
    const logo = document.createElement('div');
    logo.className = 'mcp-connector-logo';
    const logoImg = document.createElement('img');
    logoImg.src = LOGO_URLS[connector.logo];
    logoImg.alt = `${connector.name} logo`;
    logoImg.loading = 'lazy';
    logo.appendChild(logoImg);
    item.appendChild(logo);

    // Content
    const content = document.createElement('div');
    content.className = 'mcp-connector-content';

    const name = document.createElement('h3');
    name.className = 'mcp-connector-name';
    name.textContent = connector.name;
    content.appendChild(name);

    const description = document.createElement('p');
    description.className = 'mcp-connector-description';
    description.textContent = connector.description;
    content.appendChild(description);

    item.appendChild(content);

    // Toggle switch
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'mcp-connector-toggle';

    const toggle = document.createElement('button');
    toggle.className = 'mcp-toggle-switch';
    if (isConnected) {
      toggle.classList.add('enabled');
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleConnector(connector, toggle, item);
    });

    toggleContainer.appendChild(toggle);

    // Status indicator for connected items
    if (isConnected) {
      const status = document.createElement('div');
      status.className = 'mcp-connector-status';
      const dot = document.createElement('div');
      dot.className = 'mcp-status-dot';
      status.appendChild(dot);
      toggleContainer.appendChild(status);
    }

    item.appendChild(toggleContainer);

    return item;
  }

  private async toggleConnector(connector: MCPConnector, toggle: HTMLButtonElement, item: HTMLElement): Promise<void> {
    const isCurrentlyConnected = this.#existingProviders.some(
      provider => provider.endpoint === connector.endpoint
    );

    if (isCurrentlyConnected) {
      // Disconnect
      await this.disconnectConnector(connector, toggle, item);
    } else {
      // Connect
      await this.connectConnector(connector, toggle, item);
    }
  }

  private async disconnectConnector(connector: MCPConnector, toggle: HTMLButtonElement, item: HTMLElement): Promise<void> {
    const previousProviders = this.#existingProviders.map(provider => ({ ...provider }));

    try {
      // Remove from providers
      const updatedProviders = this.#existingProviders.filter(
        provider => provider.endpoint !== connector.endpoint
      );
      saveMCPProviders(updatedProviders);
      this.#existingProviders = getMCPProviders();

      // Update UI
      toggle.classList.remove('enabled');
      item.classList.remove('connected');

      // Remove status indicator
      const statusElement = item.querySelector('.mcp-connector-status');
      if (statusElement) {
        statusElement.remove();
      }

      await MCPRegistry.init(true);
      await MCPRegistry.refresh();

      logger.info(`Disconnected MCP connector: ${connector.name}`);

    } catch (error) {
      logger.error('Failed to disconnect MCP connector', error);

      // Revert changes
      try {
        saveMCPProviders(previousProviders);
        this.#existingProviders = getMCPProviders();
        toggle.classList.add('enabled');
        item.classList.add('connected');
      } catch (revertError) {
        logger.error('Failed to revert MCP providers after disconnect failure', revertError);
      }

      const snackbar = Snackbars.Snackbar.Snackbar.show({
        message: i18nString(UIStrings.connectionFailed, {PH1: connector.name}),
        closable: true,
      });
      snackbar.dismissTimeout = 4000;
    }
  }

  private async connectConnector(connector: MCPConnector, toggle: HTMLButtonElement, item: HTMLElement): Promise<void> {
    const previousProviders = this.#existingProviders.map(provider => ({ ...provider }));

    const progressSnackbar = Snackbars.Snackbar.Snackbar.show({
      message: i18nString(UIStrings.oauthInProgress, {PH1: connector.name}),
      closable: true,
    });

    const dismissProgressSnackbar = () => {
      if (!progressSnackbar.isConnected) {
        return;
      }
      const closeButton = progressSnackbar.shadowRoot?.querySelector('.dismiss') as HTMLElement | null;
      if (closeButton) {
        closeButton.click();
      } else {
        progressSnackbar.remove();
      }
    };

    toggle.classList.add('connecting');
    toggle.disabled = true;
    item.classList.add('connecting');
    item.setAttribute('aria-busy', 'true');

    try {
      const newProvider: MCPProviderConfig = {
        id: connector.id,
        name: connector.name,
        endpoint: connector.endpoint,
        authType: connector.authType,
        enabled: true,
      };

      const updatedProviders = [...previousProviders, newProvider];
      saveMCPProviders(updatedProviders);
      this.#existingProviders = getMCPProviders();

      await MCPRegistry.init(true);
      await MCPRegistry.refresh();

      // Update UI to connected state
      toggle.classList.remove('connecting');
      toggle.classList.add('enabled');
      toggle.disabled = false;
      item.classList.remove('connecting');
      item.classList.add('connected');
      item.removeAttribute('aria-busy');

      // Add status indicator
      const toggleContainer = toggle.parentElement as HTMLElement;
      const status = document.createElement('div');
      status.className = 'mcp-connector-status';
      const dot = document.createElement('div');
      dot.className = 'mcp-status-dot';
      status.appendChild(dot);
      toggleContainer.appendChild(status);

      logger.info(`Connected MCP connector: ${connector.name}`);

      dismissProgressSnackbar();

      const snackbar = Snackbars.Snackbar.Snackbar.show({
        message: i18nString(UIStrings.successMessage, {PH1: connector.name}),
        actionProperties: {
          label: i18nString(UIStrings.manageConnectionsAction),
          onClick: () => this.#openManageConnections(),
        },
      });
      snackbar.dismissTimeout = 4000;

    } catch (error) {
      logger.error('Failed to connect MCP connector', error);

      try {
        saveMCPProviders(previousProviders);
        this.#existingProviders = getMCPProviders();
      } catch (revertError) {
        logger.error('Failed to revert MCP providers after connect failure', revertError);
      }

      toggle.classList.remove('connecting');
      toggle.disabled = false;
      item.classList.remove('connecting');
      item.classList.remove('connected');
      item.removeAttribute('aria-busy');

      const message = error instanceof Error && error.message
        ? i18nString(UIStrings.connectionFailedWithReason, {PH1: connector.name, PH2: error.message})
        : i18nString(UIStrings.connectionFailed, {PH1: connector.name});

      dismissProgressSnackbar();

      const snackbar = Snackbars.Snackbar.Snackbar.show({
        message,
        closable: true,
      });
      snackbar.dismissTimeout = 6000;
    }
  }


  #openManageConnections(): void {
    this.close();
    MCPConnectionsDialog.show();
  }

  private close(): void {
    this.#dialog.hide();
    if (this.#options.onClose) {
      this.#options.onClose();
    }
  }
}
