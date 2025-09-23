import * as i18n from '../../../../core/i18n/i18n.js';
import * as UI from '../../../../ui/legacy/legacy.js';
import * as Snackbars from '../../../../ui/components/snackbars/snackbars.js';
import { createLogger } from '../../core/Logger.js';
import { MCPRegistry, type ConnectionResult } from '../../mcp/MCPRegistry.js';
import { getMCPProviders, saveMCPProviders, type MCPProviderConfig } from '../../mcp/MCPConfig.js';
import { MCPConnectionsDialog } from './MCPConnectionsDialog.js';

import mcpConnectorsCatalogDialogStyles from './mcpConnectorsCatalogDialog.css.js';

const logger = createLogger('MCPConnectorsCatalogDialog');

const LOGO_URLS = {
  sentry: '/bundled/Images/sentry-mcp.svg',
  atlassian: '/bundled/Images/atlassian-mcp.svg',
  linear: '/bundled/Images/linear-mcp.svg',
  notion: '/bundled/Images/notion-mcp.svg',
  slack: '/bundled/Images/slack-mcp.svg',
  github: '/bundled/Images/github-mcp.svg',
  asana: '/bundled/Images/asana-mcp.svg',
  intercom: '/bundled/Images/intercom-mcp.svg',
  'google-drive': '/bundled/Images/google-drive-mcp.svg',
  huggingface: '/bundled/Images/huggingface-mcp.svg',
  'google-sheets': '/bundled/Images/google-sheets-mcp.svg',
  socket: '/bundled/Images/socket-mcp.svg',
  invideo: '/bundled/Images/invideo-mcp.svg',
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
  connecting: 'Connecting',
  oauthInProgress: 'Complete the {PH1} sign-in in the opened tab.',
  connectionFailed: 'Unable to add {PH1}. Please try again.',
  connectionFailedWithReason: 'Unable to add {PH1}: {PH2}',
  connectionError: 'Connection failed',
  viewDetails: 'View Details',
  hideDetails: 'Hide Details',
  errorTypeAuthentication: 'Authentication Required',
  errorTypeConfiguration: 'Configuration Error',
  errorTypeNetwork: 'Network Error',
  errorTypeServerError: 'Server Error',
  errorTypeConnection: 'Connection Error',
  errorTypeUnknown: 'Unknown Error',
  connected: 'Connected',
  retry: 'Retry',
  clearError: 'Clear',
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
  logo?: MCPConnectorLogoId;
  endpoint: string;
  authType: 'oauth' | 'bearer';
  category: string;
}

const MCP_CONNECTORS: MCPConnector[] = [
  {
    id: 'invideo',
    name: 'invideo',
    description: 'Build video creation capabilities into your applications',
    logo: 'invideo',
    endpoint: 'https://mcp.invideo.io/sse',
    authType: 'oauth',
    category: 'Media'
  },
  // {
  //   id: 'monday',
  //   name: 'Monday',
  //   description: 'Manage monday.com boards by creating items, updating columns, assigning owners, setting timelines, adding CRM activities, and writing summaries',
  // logo: 'socket', // fallback generic icon
  //   endpoint: 'https://mcp.monday.com/sse',
  //   authType: 'oauth',
  //   category: 'Project Management'
  // },
  // ...existing connectors...
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
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking & project management',
    logo: 'linear',
    endpoint: 'https://mcp.linear.app/mcp',
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
    id: 'intercom',
    name: 'Intercom',
    description: 'Customer support & conversations',
    logo: 'intercom',
    endpoint: 'https://mcp.intercom.com/mcp',
    authType: 'oauth',
    category: 'Communication'
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
    id: 'canva',
    name: 'Canva',
    description: 'Browse, summarize, autofill, and even generate new Canva designs directly from Claude',
    endpoint: 'https://mcp.canva.com/mcp',
    authType: 'oauth',
    category: 'Design'
  },
  {
    id: 'jam',
    name: 'Jam',
    description: 'Debug faster with AI agents that can access Jam recordings like video, console logs, network requests, and errors',
    endpoint: 'https://mcp.jam.dev/mcp',
    authType: 'oauth',
    category: 'Debugging'
  },
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
  #statusElement: HTMLElement | null = null;
  #connectionErrors = new Map<string, { message: string; type?: string; details?: any }>();
  #connectingConnectorId: string | null = null;
  #errorResetTimeouts = new Map<string, number>();

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
    styleElement.textContent = mcpConnectorsCatalogDialogStyles;
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

    const statusText = document.createElement('span');
    statusText.className = 'mcp-catalog-status-count';
    this.#statusElement = statusText;
    this.updateConnectionStatus();
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

  private updateConnectionStatus(): void {
    if (!this.#statusElement) {
      return;
    }

    const connectedCount = this.#existingProviders.length;
    const totalCount = MCP_CONNECTORS.length;
    this.#statusElement.textContent = i18nString(UIStrings.connectionsStatus, {
      PH1: connectedCount.toString(),
      PH2: totalCount.toString()
    });
  }

  private showConnectorError(connector: MCPConnector, error: string | Error, item: HTMLElement, toggle: HTMLButtonElement): void {
    // Extract error details
    let errorMessage = error instanceof Error ? error.message : error;
    let errorType = 'unknown';
    let errorDetails = null;

    if (error instanceof Error && 'context' in error) {
      const context = (error as any).context;
      errorDetails = context;

      // Determine error type based on context
      if (context?.authState === 'oauth_required' || context?.httpStatus === 401) {
        errorType = 'authentication';
      } else if (context?.httpStatus === 404) {
        errorType = 'configuration';
      } else if (context?.httpStatus === 403) {
        errorType = 'authentication';
      } else if (context?.httpStatus >= 500) {
        errorType = 'server_error';
      } else if (context?.readyState === 2) {
        errorType = 'network';
      }
    }

    // Store error state with details
    this.#connectionErrors.set(connector.id, { message: errorMessage, type: errorType, details: errorDetails });

    // Update UI to error state
    item.classList.add('error');
    item.classList.remove('connecting', 'connected');
    toggle.classList.add('error');
    toggle.classList.remove('connecting', 'enabled');
    toggle.disabled = true;

    // Add error status dot
    const toggleContainer = toggle.parentElement as HTMLElement;
    const existingStatus = toggleContainer.querySelector('.mcp-connector-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    const status = document.createElement('div');
    status.className = 'mcp-connector-status';
    const dot = document.createElement('div');
    dot.className = 'mcp-status-dot error';
    dot.title = errorMessage;
    status.appendChild(dot);
    toggleContainer.appendChild(status);

    // Show error container
    const errorContainer = item.querySelector('.mcp-connector-error') as HTMLElement;
    if (errorContainer) {
      errorContainer.style.display = 'block';
      errorContainer.innerHTML = '';

      // Error header with type
      const header = document.createElement('div');
      header.className = 'mcp-error-header';

      const typeElement = document.createElement('div');
      typeElement.className = 'mcp-error-type';
      typeElement.textContent = this.getErrorTypeDisplayName(errorType);
      header.appendChild(typeElement);

      // Show details toggle if we have details
      if (errorDetails) {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'mcp-error-toggle';
        toggleButton.textContent = i18nString(UIStrings.viewDetails);
        toggleButton.addEventListener('click', () => {
          const detailsElement = errorContainer.querySelector('.mcp-error-details') as HTMLElement;
          if (detailsElement) {
            const isVisible = detailsElement.style.display !== 'none';
            detailsElement.style.display = isVisible ? 'none' : 'block';
            toggleButton.textContent = i18nString(isVisible ? UIStrings.viewDetails : UIStrings.hideDetails);
          }
        });
        header.appendChild(toggleButton);
      }

      errorContainer.appendChild(header);

      // Error message
      const message = document.createElement('div');
      message.className = 'mcp-error-message';
      message.textContent = errorMessage;
      errorContainer.appendChild(message);

      // Error details (initially hidden)
      if (errorDetails) {
        const details = document.createElement('div');
        details.className = 'mcp-error-details';
        details.style.display = 'none';
        details.textContent = JSON.stringify(errorDetails, null, 2);
        errorContainer.appendChild(details);
      }

      // Actions
      const actions = document.createElement('div');
      actions.className = 'mcp-error-actions';

      const retryButton = document.createElement('button');
      retryButton.className = 'mcp-error-retry-button';
      retryButton.textContent = i18nString(UIStrings.retry);
      retryButton.addEventListener('click', () => {
        this.clearConnectorError(connector, item, toggle);
        this.toggleConnector(connector, toggle, item);
      });
      actions.appendChild(retryButton);

      const clearButton = document.createElement('button');
      clearButton.className = 'mcp-error-clear-button';
      clearButton.textContent = i18nString(UIStrings.clearError);
      clearButton.addEventListener('click', () => {
        this.clearConnectorError(connector, item, toggle);
      });
      actions.appendChild(clearButton);

      errorContainer.appendChild(actions);
    }
  }

  private getErrorTypeDisplayName(errorType: string): string {
    switch (errorType) {
      case 'authentication': return i18nString(UIStrings.errorTypeAuthentication);
      case 'configuration': return i18nString(UIStrings.errorTypeConfiguration);
      case 'network': return i18nString(UIStrings.errorTypeNetwork);
      case 'server_error': return i18nString(UIStrings.errorTypeServerError);
      case 'connection': return i18nString(UIStrings.errorTypeConnection);
      default: return i18nString(UIStrings.errorTypeUnknown);
    }
  }

  private clearConnectorError(connector: MCPConnector, item: HTMLElement, toggle: HTMLButtonElement): void {
    // Clear any pending auto-reset timeout
    const timeoutId = this.#errorResetTimeouts.get(connector.id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.#errorResetTimeouts.delete(connector.id);
    }

    // Remove error state
    this.#connectionErrors.delete(connector.id);

    // Update UI
    item.classList.remove('error');
    toggle.classList.remove('error');
    toggle.disabled = false;

    // Remove error status dot
    const toggleContainer = toggle.parentElement as HTMLElement;
    const existingStatus = toggleContainer.querySelector('.mcp-connector-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Hide error container
    const errorContainer = item.querySelector('.mcp-connector-error') as HTMLElement;
    if (errorContainer) {
      errorContainer.style.display = 'none';
      errorContainer.innerHTML = '';
    }
  }

  private setConnectingState(connectorId: string): void {
    this.#connectingConnectorId = connectorId;
    this.updateAllConnectorStates();
  }

  private clearConnectingState(): void {
    this.#connectingConnectorId = null;
    this.updateAllConnectorStates();
  }

  private updateAllConnectorStates(): void {
    if (!this.#connectorsContainer) {
      return;
    }

    const allItems = this.#connectorsContainer.querySelectorAll('.mcp-connector-item');
    allItems.forEach((item) => {
      const connectorId = this.getConnectorIdFromItem(item as HTMLElement);
      if (!connectorId) return;

      const toggle = item.querySelector('.mcp-toggle-switch') as HTMLButtonElement;
      const isCurrentlyConnecting = this.#connectingConnectorId === connectorId;
      const hasGlobalConnection = this.#connectingConnectorId && !isCurrentlyConnecting;

      if (hasGlobalConnection) {
        // Disable other toggles during connection
        item.classList.add('globally-disabled');
        toggle.classList.add('disabled');
        toggle.disabled = true;
      } else {
        // Re-enable toggle if no global connection in progress
        item.classList.remove('globally-disabled');
        if (!this.#connectionErrors.has(connectorId)) {
          toggle.classList.remove('disabled');
          toggle.disabled = false;
        }
      }
    });
  }

  private getConnectorIdFromItem(item: HTMLElement): string | null {
    // We'll store the connector ID as a data attribute when creating items
    return item.getAttribute('data-connector-id');
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
    item.setAttribute('data-connector-id', connector.id);

    const isConnected = this.#existingProviders.some(
      provider => provider.endpoint === connector.endpoint
    );
    const hasError = this.#connectionErrors.has(connector.id);
    const isConnecting = this.#connectingConnectorId === connector.id;

    if (hasError) {
      item.classList.add('error');
    } else if (isConnected) {
      item.classList.add('connected');
    } else if (isConnecting) {
      item.classList.add('connecting');
    }

    // Logo
    const logo = document.createElement('div');
    logo.className = 'mcp-connector-logo';
    if (connector.logo) {
      const logoImg = document.createElement('img');
      logoImg.src = LOGO_URLS[connector.logo];
      logoImg.alt = `${connector.name} logo`;
      logoImg.loading = 'lazy';
      logo.appendChild(logoImg);
    }
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
    if (hasError) {
      toggle.classList.add('error');
      toggle.disabled = true;
    } else if (isConnecting) {
      toggle.classList.add('connecting');
      toggle.disabled = true;
    } else if (isConnected) {
      toggle.classList.add('enabled');
    }

    // Check if other connections are in progress
    const hasGlobalConnection = this.#connectingConnectorId && !isConnecting;
    if (hasGlobalConnection) {
      toggle.classList.add('disabled');
      toggle.disabled = true;
    }

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!hasError && !this.#connectingConnectorId) {
        this.toggleConnector(connector, toggle, item);
      }
    });

    toggleContainer.appendChild(toggle);

    // Loading indicator (positioned before toggle) or status indicator (positioned after toggle)
    if (isConnecting) {
      const loading = document.createElement('div');
      loading.className = 'mcp-loading-indicator';
      loading.title = i18nString(UIStrings.connecting);
      toggleContainer.insertBefore(loading, toggle);
    }

    // Status indicator for connected items or error items (positioned after toggle)
    if (hasError) {
      const status = document.createElement('div');
      status.className = 'mcp-connector-status';
      const dot = document.createElement('div');
      dot.className = 'mcp-status-dot error';
      const errorInfo = this.#connectionErrors.get(connector.id);
      dot.title = errorInfo?.message || i18nString(UIStrings.connectionError);
      status.appendChild(dot);
      toggleContainer.appendChild(status);
    } else if (isConnected) {
      const status = document.createElement('div');
      status.className = 'mcp-connector-status';
      const dot = document.createElement('div');
      dot.className = 'mcp-status-dot';
      dot.title = i18nString(UIStrings.connected);
      status.appendChild(dot);
      toggleContainer.appendChild(status);
    }

    item.appendChild(toggleContainer);

    // Error container (initially hidden, but show if there's an existing error)
    const errorContainer = document.createElement('div');
    errorContainer.className = 'mcp-connector-error';
    errorContainer.style.display = hasError ? 'block' : 'none';

    if (hasError) {
      const errorInfo = this.#connectionErrors.get(connector.id);
      const errorMessage = errorInfo?.message || i18nString(UIStrings.connectionError);
      const errorType = errorInfo?.type || 'unknown';
      const errorDetails = errorInfo?.details;

      // Error header with type
      const header = document.createElement('div');
      header.className = 'mcp-error-header';

      const typeElement = document.createElement('div');
      typeElement.className = 'mcp-error-type';
      typeElement.textContent = this.getErrorTypeDisplayName(errorType);
      header.appendChild(typeElement);

      // Show details toggle if we have details
      if (errorDetails) {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'mcp-error-toggle';
        toggleButton.textContent = i18nString(UIStrings.viewDetails);
        toggleButton.addEventListener('click', () => {
          const detailsElement = errorContainer.querySelector('.mcp-error-details') as HTMLElement;
          if (detailsElement) {
            const isVisible = detailsElement.style.display !== 'none';
            detailsElement.style.display = isVisible ? 'none' : 'block';
            toggleButton.textContent = i18nString(isVisible ? UIStrings.viewDetails : UIStrings.hideDetails);
          }
        });
        header.appendChild(toggleButton);
      }

      errorContainer.appendChild(header);

      // Error message
      const message = document.createElement('div');
      message.className = 'mcp-error-message';
      message.textContent = errorMessage;
      errorContainer.appendChild(message);

      // Error details (initially hidden)
      if (errorDetails) {
        const details = document.createElement('div');
        details.className = 'mcp-error-details';
        details.style.display = 'none';
        details.textContent = JSON.stringify(errorDetails, null, 2);
        errorContainer.appendChild(details);
      }

      // Actions
      const actions = document.createElement('div');
      actions.className = 'mcp-error-actions';

      const retryButton = document.createElement('button');
      retryButton.className = 'mcp-error-retry-button';
      retryButton.textContent = i18nString(UIStrings.retry);
      retryButton.addEventListener('click', () => {
        this.clearConnectorError(connector, item, toggle);
        this.toggleConnector(connector, toggle, item);
      });
      actions.appendChild(retryButton);

      const clearButton = document.createElement('button');
      clearButton.className = 'mcp-error-clear-button';
      clearButton.textContent = i18nString(UIStrings.clearError);
      clearButton.addEventListener('click', () => {
        this.clearConnectorError(connector, item, toggle);
      });
      actions.appendChild(clearButton);

      errorContainer.appendChild(actions);
    }

    item.appendChild(errorContainer);

    return item;
  }

  private async toggleConnector(connector: MCPConnector, toggle: HTMLButtonElement, item: HTMLElement): Promise<void> {
    // Prevent toggling if another connection is in progress
    if (this.#connectingConnectorId && this.#connectingConnectorId !== connector.id) {
      return;
    }

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

      void await MCPRegistry.init(true);
      await MCPRegistry.refresh();

      // Update connection status counter
      this.updateConnectionStatus();

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

    // Set global connecting state
    this.setConnectingState(connector.id);

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

    // Update UI to show loading state
    toggle.classList.add('connecting');
    toggle.disabled = true;
    item.classList.add('connecting');
    item.setAttribute('aria-busy', 'true');

    // Add loading indicator to the left of toggle
    const toggleContainer = toggle.parentElement as HTMLElement;
    const existingStatus = toggleContainer.querySelector('.mcp-connector-status, .mcp-loading-indicator');
    if (existingStatus) {
      existingStatus.remove();
    }

    const loading = document.createElement('div');
    loading.className = 'mcp-loading-indicator';
    loading.title = i18nString(UIStrings.connecting);
    toggleContainer.insertBefore(loading, toggle);

    try {
      const newProvider: MCPProviderConfig = {
        id: connector.id,
        name: connector.name,
        endpoint: connector.endpoint,
        authType: connector.authType,
        enabled: true,
      };

      // Save provider temporarily to test connection
      const updatedProviders = [...previousProviders, newProvider];
      saveMCPProviders(updatedProviders);
      this.#existingProviders = getMCPProviders();

      // Test the connection
      const connectionResults = await MCPRegistry.init(true);
      await MCPRegistry.refresh();

      // Find the result for our specific connector
      const ourResult = connectionResults.find(result =>
        result.endpoint === connector.endpoint || result.serverId === connector.id
      );

      // If connection failed, throw error to trigger catch block
      if (!ourResult || !ourResult.connected) {
        const error = ourResult?.error || new Error('Connection failed');
        throw error;
      }

      // Clear global connecting state
      this.clearConnectingState();

      // Update UI to connected state
      toggle.classList.remove('connecting');
      toggle.classList.add('enabled');
      toggle.disabled = false;
      item.classList.remove('connecting');
      item.classList.add('connected');
      item.removeAttribute('aria-busy');

      // Replace loading indicator with status indicator
      const toggleContainer = toggle.parentElement as HTMLElement;
      const loadingIndicator = toggleContainer.querySelector('.mcp-loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }

      const status = document.createElement('div');
      status.className = 'mcp-connector-status';
      const dot = document.createElement('div');
      dot.className = 'mcp-status-dot';
      dot.title = i18nString(UIStrings.connected);
      status.appendChild(dot);
      toggleContainer.appendChild(status);

      logger.info(`Connected MCP connector: ${connector.name}`);

      // Update connection status counter
      this.updateConnectionStatus();

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

      // Clear global connecting state
      this.clearConnectingState();

      try {
        saveMCPProviders(previousProviders);
        this.#existingProviders = getMCPProviders();
      } catch (revertError) {
        logger.error('Failed to revert MCP providers after connect failure', revertError);
      }

      item.removeAttribute('aria-busy');

      // Remove loading indicator
      const toggleContainer = toggle.parentElement as HTMLElement;
      const loadingIndicator = toggleContainer.querySelector('.mcp-loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.remove();
      }

      const errorMessage = error instanceof Error && error.message
        ? error.message
        : i18nString(UIStrings.connectionError);

      // Show inline error instead of just snackbar
      this.showConnectorError(connector, errorMessage, item, toggle);

      // Set 90-second auto-reset timeout
      const timeoutId = window.setTimeout(() => {
        this.clearConnectorError(connector, item, toggle);
        logger.info(`Auto-cleared error for ${connector.name} after 90 seconds`);
      }, 90000);
      this.#errorResetTimeouts.set(connector.id, timeoutId);

      dismissProgressSnackbar();

      // Still show a snackbar for immediate feedback, but less prominent
      const snackbar = Snackbars.Snackbar.Snackbar.show({
        message: i18nString(UIStrings.connectionFailed, {PH1: connector.name}),
        closable: true,
      });
      snackbar.dismissTimeout = 3000;
    }
  }


  #openManageConnections(): void {
    this.close();
    MCPConnectionsDialog.show();
  }

  private close(): void {
    // Clean up any pending timeout callbacks
    this.#errorResetTimeouts.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    this.#errorResetTimeouts.clear();

    this.#dialog.hide();
    if (this.#options.onClose) {
      this.#options.onClose();
    }
  }
}
