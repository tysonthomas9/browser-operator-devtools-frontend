import * as i18n from '../../../../core/i18n/i18n.js';
import * as UI from '../../../../ui/legacy/legacy.js';
import { createLogger } from '../../core/Logger.js';
import { getMCPProviders, saveMCPProviders, type MCPProviderConfig } from '../../mcp/MCPConfig.js';

const logger = createLogger('MCPConnectionsDialog');

const UIStrings = {
  title: 'Manage MCP connections',
  description: 'Configure MCP servers that DevTools can connect to. You can add multiple endpoints and toggle them individually.',
  addConnection: 'Add connection',
  saveButton: 'Save connections',
  cancelButton: 'Cancel',
  namePlaceholder: 'Display name (optional)',
  endpointPlaceholder: 'https://your-server/mcp or ws://localhost:9000',
  authTypeLabel: 'Auth',
  authTypeOAuth: 'OAuth (PKCE)',
  authTypeBearer: 'Bearer token',
  bearerTokenPlaceholder: 'Token (only for bearer)',
  enabledLabel: 'Enabled',
  removeButton: 'Remove',
  validationEndpointRequired: 'Every connection needs an endpoint URL.',
  validationDuplicateEndpoint: 'Duplicate endpoints detected. Please ensure each connection is unique.',
  emptyState: 'No MCP connections yet. Add one to get started.',
};

const str_ = i18n.i18n.registerUIStrings('panels/ai_chat/ui/mcp/MCPConnectionsDialog.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

interface MCPConnectionsDialogOptions {
  onSave?: () => void | Promise<void>;
}

export class MCPConnectionsDialog {
  static show(options: MCPConnectionsDialogOptions = {}): void {
    const dialog = new MCPConnectionsDialog(options);
    dialog.show();
  }

  #dialog: UI.Dialog.Dialog;
  #options: MCPConnectionsDialogOptions;
  #providers: MCPProviderConfig[] = [];
  #listElement!: HTMLElement;
  #errorElement!: HTMLElement;

  constructor(options: MCPConnectionsDialogOptions) {
    this.#options = options;
    this.#dialog = new UI.Dialog.Dialog();
    this.#providers = getMCPProviders().map(provider => ({ ...provider }));
  }

  show(): void {
    this.#dialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MEASURE_CONTENT);
    this.#dialog.setDimmed(true);
    this.#dialog.setOutsideClickCallback(() => this.close());

    const content = this.#dialog.contentElement;
    content.classList.add('mcp-connections-dialog');
    content.style.display = 'flex';
    content.style.flexDirection = 'column';

    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .mcp-connections-dialog {
        min-width: 640px;
        max-width: 90vw;
        color: var(--color-text-primary);
        background: var(--color-background);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        border: 1px solid var(--color-details-hairline);
      }
      .mcp-connections-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid var(--color-details-hairline);
        background: var(--color-background-elevation-1);
      }
      .mcp-connections-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        color: var(--color-text-primary);
      }
      .mcp-connections-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
        padding: 8px;
        color: var(--color-text-secondary);
        border-radius: 6px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      }
      .mcp-connections-close:hover {
        color: var(--color-text-primary);
        background: var(--color-background-elevation-2);
      }
      .mcp-connections-close:active {
        transform: scale(0.95);
      }
      .mcp-connections-body {
        padding: 20px 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: 65vh;
        overflow: hidden;
      }
      .mcp-connections-description {
        font-size: 14px;
        color: var(--color-text-secondary);
        line-height: 1.4;
        margin: 0;
        flex-shrink: 0;
      }
      .mcp-connections-scroll-container {
        flex: 1;
        overflow-y: auto;
        margin: 0 -4px;
        padding: 0 4px;
        min-height: 200px;
      }
      .mcp-connections-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-bottom: 8px;
      }
      .mcp-connections-actions {
        flex-shrink: 0;
        padding-top: 8px;
        border-top: 1px solid var(--color-details-hairline);
      }
      .mcp-connection-card {
        border: 1px solid var(--color-details-hairline);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: var(--color-background-elevation-1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }
      .mcp-connection-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        border-color: var(--color-primary-container-border);
      }
      .mcp-connection-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        width: 100%;
      }
      .mcp-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .mcp-field label {
        font-size: 12px;
        font-weight: 500;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .mcp-field input,
      .mcp-field select {
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
        box-sizing: border-box;
        border: 1px solid var(--color-details-hairline);
        border-radius: 8px;
        background: var(--color-background);
        color: var(--color-text-primary);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .mcp-field select {
        padding-right: 32px;
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        cursor: pointer;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 16px;
      }
      .mcp-field input:focus,
      .mcp-field select:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-primary-shadow);
      }
      .mcp-field input:hover,
      .mcp-field select:hover {
        border-color: var(--color-primary-container-border);
      }
      .mcp-field input::placeholder {
        color: var(--color-text-secondary);
        opacity: 0.7;
      }
      .mcp-field.token-field,
      .mcp-field.endpoint-field {
        grid-column: span 2;
      }
      .mcp-connection-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
      }
      .mcp-remove-button {
        background: none;
        border: none;
        color: var(--color-error-text);
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .mcp-remove-button:hover {
        background: var(--color-error-container);
        color: var(--sys-color-error);
      }
      .mcp-enabled-toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        cursor: pointer;
        user-select: none;
      }
      .mcp-toggle-switch {
        position: relative;
        width: 44px;
        height: 24px;
        background: var(--color-details-hairline);
        border-radius: 12px;
        transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      .mcp-toggle-switch.checked {
        background: var(--color-primary);
      }
      .mcp-toggle-slider {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .mcp-toggle-switch.checked .mcp-toggle-slider {
        transform: translateX(20px);
      }
      .mcp-toggle-switch:hover {
        opacity: 0.8;
      }
      .mcp-connections-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px 20px;
        border-top: 1px solid var(--color-details-hairline);
        background: var(--color-background-elevation-1);
      }
      .mcp-primary-button {
        padding: 10px 20px;
        background: var(--color-primary);
        color: var(--color-text-inverted);
        border: 1px solid var(--color-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 4px var(--color-primary-shadow);
      }
      .mcp-primary-button:hover {
        background: var(--color-primary-variant);
        border-color: var(--color-primary-variant);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px var(--color-primary-shadow);
      }
      .mcp-primary-button:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px var(--color-primary-shadow);
      }
      .mcp-secondary-button {
        padding: 10px 20px;
        border: 1px solid var(--color-details-hairline);
        background: var(--color-background);
        color: var(--color-text-primary);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .mcp-secondary-button:hover {
        background: var(--color-background-elevation-1);
        border-color: var(--color-primary-container-border);
      }
      .mcp-secondary-button:active {
        transform: scale(0.98);
      }
      .mcp-error-banner {
        display: none;
        padding: 12px 16px;
        border-radius: 8px;
        background: var(--color-error-container);
        color: var(--sys-color-error);
        font-size: 14px;
        border: 1px solid rgba(var(--sys-color-error-rgb), 0.2);
        margin-bottom: 8px;
        animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .mcp-empty-state {
        font-size: 14px;
        color: var(--color-text-secondary);
        font-style: italic;
        text-align: center;
        padding: 60px 20px;
        background: var(--color-background-elevation-1);
        border-radius: 12px;
        border: 2px dashed var(--color-details-hairline);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .mcp-empty-state::before {
        content: "🔗";
        font-size: 32px;
        opacity: 0.6;
      }
      .mcp-password-field {
        position: relative;
      }
      .mcp-password-toggle {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: var(--color-text-secondary);
        border-radius: 4px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .mcp-password-toggle:hover {
        color: var(--color-text-primary);
        background: var(--color-background-elevation-1);
      }
      .mcp-add-connection-button {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
      }
      .mcp-add-connection-button::before {
        content: "+";
        font-size: 18px;
        font-weight: bold;
      }
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .mcp-connections-scroll-container::-webkit-scrollbar {
        width: 8px;
      }
      .mcp-connections-scroll-container::-webkit-scrollbar-track {
        background: var(--color-background-elevation-1);
        border-radius: 4px;
      }
      .mcp-connections-scroll-container::-webkit-scrollbar-thumb {
        background: var(--color-details-hairline);
        border-radius: 4px;
      }
      .mcp-connections-scroll-container::-webkit-scrollbar-thumb:hover {
        background: var(--color-text-secondary);
      }
    `;
    content.appendChild(styleElement);

    const header = document.createElement('div');
    header.className = 'mcp-connections-header';
    content.appendChild(header);

    const title = document.createElement('h2');
    title.className = 'mcp-connections-title';
    title.textContent = i18nString(UIStrings.title);
    header.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.className = 'mcp-connections-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => this.close());
    header.appendChild(closeButton);

    const body = document.createElement('div');
    body.className = 'mcp-connections-body';
    content.appendChild(body);

    const description = document.createElement('div');
    description.className = 'mcp-connections-description';
    description.textContent = i18nString(UIStrings.description);
    body.appendChild(description);

    this.#errorElement = document.createElement('div');
    this.#errorElement.className = 'mcp-error-banner';
    body.appendChild(this.#errorElement);

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'mcp-connections-scroll-container';
    body.appendChild(scrollContainer);

    this.#listElement = document.createElement('div');
    this.#listElement.className = 'mcp-connections-list';
    scrollContainer.appendChild(this.#listElement);

    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'mcp-connections-actions';
    body.appendChild(actionsContainer);

    const addButton = document.createElement('button');
    addButton.className = 'mcp-secondary-button mcp-add-connection-button';
    addButton.textContent = i18nString(UIStrings.addConnection);
    addButton.addEventListener('click', () => {
      this.#providers.push({
        id: '',
        name: '',
        endpoint: '',
        authType: 'oauth',
        enabled: true,
      });
      this.renderList();
      // Auto-scroll to bottom after adding new connection
      setTimeout(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }, 100);
    });
    actionsContainer.appendChild(addButton);

    this.renderList();

    const footer = document.createElement('div');
    footer.className = 'mcp-connections-footer';
    content.appendChild(footer);

    const cancelButton = document.createElement('button');
    cancelButton.className = 'mcp-secondary-button';
    cancelButton.textContent = i18nString(UIStrings.cancelButton);
    cancelButton.addEventListener('click', () => this.close());
    footer.appendChild(cancelButton);

    const saveButton = document.createElement('button');
    saveButton.className = 'mcp-primary-button';
    saveButton.textContent = i18nString(UIStrings.saveButton);
    saveButton.addEventListener('click', () => this.handleSave());
    footer.appendChild(saveButton);

    this.#dialog.show();
  }

  private renderList(): void {
    this.#listElement.textContent = '';
    this.#errorElement.style.display = 'none';

    if (this.#providers.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'mcp-empty-state';
      emptyState.textContent = i18nString(UIStrings.emptyState);
      this.#listElement.appendChild(emptyState);
      return;
    }

    this.#providers.forEach((provider, index) => {
      const card = document.createElement('div');
      card.className = 'mcp-connection-card';

      const row = document.createElement('div');
      row.className = 'mcp-connection-row';

      const nameField = document.createElement('div');
      nameField.className = 'mcp-field mcp-field--short';
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Name';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = i18nString(UIStrings.namePlaceholder);
      nameInput.value = provider.name || '';
      nameInput.addEventListener('input', () => {
        provider.name = nameInput.value.trim() || undefined;
      });
      nameField.appendChild(nameLabel);
      nameField.appendChild(nameInput);
      row.appendChild(nameField);

      const endpointField = document.createElement('div');
      endpointField.className = 'mcp-field mcp-field--long';
      const endpointLabel = document.createElement('label');
      endpointLabel.textContent = 'Endpoint';
      const endpointInput = document.createElement('input');
      endpointInput.type = 'text';
      endpointInput.placeholder = i18nString(UIStrings.endpointPlaceholder);
      endpointInput.value = provider.endpoint;
      endpointInput.addEventListener('input', () => {
        provider.endpoint = endpointInput.value.trim();
      });
      endpointField.appendChild(endpointLabel);
      endpointField.appendChild(endpointInput);
      row.appendChild(endpointField);

      const authField = document.createElement('div');
      authField.className = 'mcp-field';
      const authLabel = document.createElement('label');
      authLabel.textContent = i18nString(UIStrings.authTypeLabel);
      const authSelect = document.createElement('select');
      const oauthOption = document.createElement('option');
      oauthOption.value = 'oauth';
      oauthOption.textContent = i18nString(UIStrings.authTypeOAuth);
      const bearerOption = document.createElement('option');
      bearerOption.value = 'bearer';
      bearerOption.textContent = i18nString(UIStrings.authTypeBearer);
      authSelect.appendChild(oauthOption);
      authSelect.appendChild(bearerOption);
      authSelect.value = provider.authType;
      authField.appendChild(authLabel);
      authField.appendChild(authSelect);
      row.appendChild(authField);

      const tokenField = document.createElement('div');
      tokenField.className = 'mcp-field token-field';
      const tokenLabel = document.createElement('label');
      tokenLabel.textContent = 'Token';

      const tokenInputContainer = document.createElement('div');
      tokenInputContainer.className = 'mcp-password-field';

      const tokenInput = document.createElement('input');
      tokenInput.type = 'password';
      tokenInput.placeholder = i18nString(UIStrings.bearerTokenPlaceholder);
      tokenInput.value = provider.token || '';
      tokenInput.style.paddingRight = '36px';

      const toggleButton = document.createElement('button');
      toggleButton.className = 'mcp-password-toggle';
      toggleButton.type = 'button';
      toggleButton.innerHTML = '👁️';
      toggleButton.title = 'Show/hide token';

      toggleButton.addEventListener('click', () => {
        if (tokenInput.type === 'password') {
          tokenInput.type = 'text';
          toggleButton.innerHTML = '🙈';
        } else {
          tokenInput.type = 'password';
          toggleButton.innerHTML = '👁️';
        }
      });

      tokenField.style.display = provider.authType === 'bearer' ? 'flex' : 'none';
      tokenInput.addEventListener('input', () => {
        provider.token = tokenInput.value.trim() || undefined;
      });

      tokenInputContainer.appendChild(tokenInput);
      tokenInputContainer.appendChild(toggleButton);
      tokenField.appendChild(tokenLabel);
      tokenField.appendChild(tokenInputContainer);
      row.appendChild(tokenField);

      authSelect.addEventListener('change', () => {
        provider.authType = authSelect.value === 'bearer' ? 'bearer' : 'oauth';
        tokenField.style.display = provider.authType === 'bearer' ? 'flex' : 'none';
        if (provider.authType !== 'bearer') {
          provider.token = undefined;
          tokenInput.value = '';
        }
      });

      const enabledField = document.createElement('div');
      enabledField.className = 'mcp-field';
      const enabledToggle = document.createElement('label');
      enabledToggle.className = 'mcp-enabled-toggle';

      const toggleSwitch = document.createElement('div');
      toggleSwitch.className = 'mcp-toggle-switch';
      if (provider.enabled !== false) {
        toggleSwitch.classList.add('checked');
      }

      const toggleSlider = document.createElement('div');
      toggleSlider.className = 'mcp-toggle-slider';
      toggleSwitch.appendChild(toggleSlider);

      const hiddenCheckbox = document.createElement('input');
      hiddenCheckbox.type = 'checkbox';
      hiddenCheckbox.checked = provider.enabled !== false;
      hiddenCheckbox.style.display = 'none';

      toggleSwitch.addEventListener('click', () => {
        const isChecked = !hiddenCheckbox.checked;
        hiddenCheckbox.checked = isChecked;
        provider.enabled = isChecked;
        if (isChecked) {
          toggleSwitch.classList.add('checked');
        } else {
          toggleSwitch.classList.remove('checked');
        }
      });

      const enabledText = document.createElement('span');
      enabledText.textContent = i18nString(UIStrings.enabledLabel);

      enabledToggle.appendChild(toggleSwitch);
      enabledToggle.appendChild(hiddenCheckbox);
      enabledToggle.appendChild(enabledText);
      enabledField.appendChild(enabledToggle);
      row.appendChild(enabledField);

      card.appendChild(row);

      const actions = document.createElement('div');
      actions.className = 'mcp-connection-actions';
      const spacer = document.createElement('div');
      actions.appendChild(spacer);

      const removeButton = document.createElement('button');
      removeButton.className = 'mcp-remove-button';
      removeButton.textContent = i18nString(UIStrings.removeButton);
      removeButton.addEventListener('click', () => {
        this.#providers.splice(index, 1);
        this.renderList();
      });
      actions.appendChild(removeButton);

      card.appendChild(actions);
      this.#listElement.appendChild(card);
    });
  }

  private async handleSave(): Promise<void> {
    this.#errorElement.style.display = 'none';
    const trimmedProviders = this.#providers.map(provider => ({
      ...provider,
      endpoint: provider.endpoint.trim(),
    }));

    if (trimmedProviders.some(provider => !provider.endpoint)) {
      this.showError(i18nString(UIStrings.validationEndpointRequired));
      return;
    }

    const endpoints = new Set<string>();
    for (const provider of trimmedProviders) {
      const key = `${provider.endpoint}|${provider.authType}`;
      if (endpoints.has(key)) {
        this.showError(i18nString(UIStrings.validationDuplicateEndpoint));
        return;
      }
      endpoints.add(key);
    }

    try {
      saveMCPProviders(trimmedProviders);
      if (this.#options.onSave) {
        await this.#options.onSave();
      }
      this.close();
    } catch (error) {
      logger.error('Failed to save MCP connections', error);
      this.showError(error instanceof Error ? error.message : String(error));
    }
  }

  private showError(message: string): void {
    this.#errorElement.textContent = message;
    this.#errorElement.style.display = 'block';
  }

  private close(): void {
    this.#dialog.hide();
  }
}
