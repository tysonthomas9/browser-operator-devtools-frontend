# MCP OAuth Implementation Plan

## Overview

This document outlines the implementation plan for adding OAuth 2.0 authentication support to the DevTools MCP (Model Context Protocol) client. This will enable secure connections to MCP servers like Zapier without requiring users to manually manage API keys.

## Background

### Current MCP Implementation
- **MCPClientSDK**: Wrapper around the MCP SDK with basic bearer token auth
- **MCPRegistry**: Manages server connections and tool registration
- **MCPConfig**: Configuration storage using localStorage/sessionStorage
- **SettingsDialog**: UI for MCP configuration (currently hidden)

### OAuth URL Context
When services like Zapier provide an "OAuth Server URL", they're offering a standardized OAuth 2.0 endpoint for MCP client authentication. The URL format typically follows:
```
https://nla.zapier.com/oauth/mcp/authorize?client_id=<client_id>
```

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SettingsDialog │────│  MCPOAuthFlow    │────│ MCPOAuthProvider│
│   (UI)          │    │  (Orchestrator)  │    │ (Storage)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCPConfig     │    │  MCPClientSDK    │    │ MCP SDK OAuth   │
│   (Config)      │    │  (Connection)    │    │ (Protocol)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Implementation Components

### 1. MCPOAuthProvider (`mcp/MCPOAuthProvider.ts`)

**Purpose**: Implements the `OAuthClientProvider` interface from the MCP SDK for browser environments.

**Key Methods**:
```typescript
interface MCPOAuthProvider extends OAuthClientProvider {
  // Required by MCP SDK
  get redirectUrl(): string;
  get clientMetadata(): OAuthClientMetadata;
  clientInformation(): OAuthClientInformation | undefined;
  saveClientInformation(info: OAuthClientInformationFull): void;
  tokens(): OAuthTokens | undefined;
  saveTokens(tokens: OAuthTokens): void;
  redirectToAuthorization(url: URL): void;
  saveCodeVerifier(verifier: string): void;
  codeVerifier(): string;

  // Custom methods for browser environment
  initializeForServer(serverUrl: string): Promise<void>;
  handleAuthCallback(authCode: string): Promise<OAuthTokens>;
  clearCredentials(): void;
}
```

**Storage Strategy**:
- **sessionStorage**: OAuth tokens (cleared on tab close)
- **localStorage**: Client metadata, configuration
- **In-memory**: Code verifiers (security best practice)

**Security Features**:
- PKCE (Proof Key for Code Exchange) for all flows
- State parameter validation for CSRF protection
- Automatic token refresh before expiry
- Secure token storage patterns

### 2. MCPOAuthFlow (`mcp/MCPOAuthFlow.ts`)

**Purpose**: Orchestrates the complete OAuth flow in the browser environment.

**Key Methods**:
```typescript
class MCPOAuthFlow {
  async startOAuthFlow(serverUrl: string, clientMetadata: OAuthClientMetadata): Promise<OAuthFlowResult>;
  async handlePopupCallback(popup: Window): Promise<string>; // auth code
  async completeTokenExchange(authCode: string, provider: MCPOAuthProvider): Promise<OAuthTokens>;
  async refreshTokens(provider: MCPOAuthProvider): Promise<OAuthTokens>;
}

interface OAuthFlowResult {
  success: boolean;
  tokens?: OAuthTokens;
  error?: string;
}
```

**Flow Strategy**:
1. **Popup-based flow** (preferred for DevTools)
   - Opens OAuth provider in popup window
   - Monitors popup for redirect with auth code
   - Automatically closes popup on completion

2. **Fallback options**:
   - Redirect flow (if popup blocked)
   - Manual auth code entry

### 3. Extended MCPConfig (`mcp/MCPConfig.ts`)

**New Configuration Fields**:
```typescript
interface MCPConfigData {
  // Existing fields...
  enabled: boolean;
  endpoint?: string;
  token?: string;

  // New OAuth fields
  authType: 'bearer' | 'oauth';
  oauthServerUrl?: string;
  oauthClientId?: string;
  oauthScope?: string;
  oauthRedirectUrl?: string;

  // Runtime OAuth state (not persisted)
  oauthTokens?: OAuthTokens;
  oauthClientInfo?: OAuthClientInformation;
}
```

**Storage Mapping**:
```typescript
const OAUTH_KEYS = {
  authType: 'ai_chat_mcp_auth_type',
  oauthServerUrl: 'ai_chat_mcp_oauth_server_url',
  oauthClientId: 'ai_chat_mcp_oauth_client_id',
  oauthScope: 'ai_chat_mcp_oauth_scope',
  oauthRedirectUrl: 'ai_chat_mcp_oauth_redirect_url',
} as const;
```

### 4. Updated MCPClientSDK (`third_party/mcp-sdk/mcp-sdk.ts`)

**Enhanced Connection Logic**:
```typescript
class MCPClientSDK {
  async connectWithOAuth(server: MCPServer, provider: MCPOAuthProvider): Promise<void>;
  async connectWithBearer(server: MCPServer): Promise<void>; // existing

  private async createOAuthTransport(server: MCPServer, provider: MCPOAuthProvider): Promise<Transport>;
  private async handleOAuthErrors(error: Error, provider: MCPOAuthProvider): Promise<void>;
}
```

**OAuth Integration Points**:
- Use `StreamableHTTPClientTransport` with `authProvider`
- Handle `UnauthorizedError` with automatic token refresh
- Support both OAuth and bearer token authentication

### 5. OAuth UI Components (`ui/SettingsDialog.ts`)

**New UI Elements**:

1. **Authentication Type Toggle**:
   ```
   ○ Bearer Token    ● OAuth 2.0
   ```

2. **OAuth Configuration Section**:
   ```
   OAuth Server URL: [https://nla.zapier.com/oauth/...]
   Client ID: [optional field]
   Scope: [mcp:tools (default)]

   [Connect with OAuth] [Disconnect]

   Status: ● Connected (expires in 2h 15m)
        Last connected: Dec 15, 2024 at 3:42 PM
   ```

3. **OAuth Flow Indicators**:
   - Loading spinner during authorization
   - Success/error messages
   - Connection status with token expiry

**User Experience Flow**:
1. User enters OAuth Server URL from Zapier/other provider
2. Clicks "Connect with OAuth"
3. Popup opens with OAuth provider's authorization page
4. User authorizes in popup
5. Popup closes automatically, connection established
6. UI shows connected status with token info

### 6. OAuth Utilities (`mcp/MCPOAuthUtils.ts`)

**Helper Functions**:
```typescript
// PKCE utilities
export function generateCodeVerifier(): string;
export function generateCodeChallenge(verifier: string): Promise<string>;

// State management
export function generateState(): string;
export function validateState(received: string, expected: string): boolean;

// Token utilities
export function isTokenExpired(token: OAuthTokens): boolean;
export function shouldRefreshToken(token: OAuthTokens, bufferMinutes: number): boolean;

// URL utilities
export function parseAuthCallbackUrl(url: string): { code?: string; state?: string; error?: string };
export function buildRedirectUrl(): string;

// Browser utilities
export function openOAuthPopup(authUrl: string): Promise<Window>;
export function waitForPopupCallback(popup: Window): Promise<string>;
```

## Implementation Phases

### Phase 1: Core OAuth Infrastructure
1. Implement `MCPOAuthProvider` with basic functionality
2. Create `MCPOAuthUtils` with PKCE and state management
3. Add OAuth configuration fields to `MCPConfig`
4. Unit tests for OAuth utilities

### Phase 2: OAuth Flow Implementation
1. Implement `MCPOAuthFlow` with popup-based authorization
2. Update `MCPClientSDK` to support OAuth connections
3. Add OAuth error handling and token refresh
4. Integration tests with mock OAuth server

### Phase 3: UI Integration
1. Update `SettingsDialog` with OAuth configuration UI
2. Add OAuth connection status display
3. Implement connect/disconnect flows
4. Handle OAuth errors in UI

### Phase 4: Testing & Polish
1. Test with real OAuth providers (Zapier, etc.)
2. Error handling improvements
3. Documentation updates
4. Performance optimizations

## Security Considerations

### Token Security
- **Short-lived access tokens**: Request tokens with reasonable expiry
- **Secure storage**: Use sessionStorage for tokens (cleared on tab close)
- **Token rotation**: Always use refresh tokens when available
- **Revocation**: Support token revocation on disconnect

### Flow Security
- **PKCE**: Use for all flows, even with confidential clients
- **State validation**: Prevent CSRF attacks
- **Popup security**: Validate popup origin and URLs
- **Input validation**: Sanitize all OAuth URLs and parameters

### Client Security
- **No client secrets**: Never store secrets in frontend code
- **Dynamic registration**: Use when supported by server
- **Scope limitation**: Request minimal necessary scopes
- **Redirect validation**: Validate all redirect URLs

## Testing Strategy

### Unit Tests
- `MCPOAuthUtils`: PKCE generation, state validation
- `MCPOAuthProvider`: Token storage, client metadata handling
- `MCPConfig`: OAuth configuration persistence

### Integration Tests
- `MCPOAuthFlow`: Complete OAuth flow simulation
- `MCPClientSDK`: OAuth connection with mock transport
- UI components: OAuth settings and connection flows

### End-to-End Tests
- Real OAuth provider integration (Zapier)
- Token refresh scenarios
- Error handling (expired tokens, revoked access)
- Multi-tab behavior with sessionStorage

## Error Handling

### OAuth-Specific Errors
```typescript
interface OAuthErrorType {
  'oauth_authorization_pending': 'User has not completed authorization',
  'oauth_access_denied': 'User denied authorization',
  'oauth_invalid_client': 'Client credentials invalid',
  'oauth_invalid_grant': 'Authorization code invalid/expired',
  'oauth_expired_token': 'Access token expired',
  'oauth_insufficient_scope': 'Token lacks required scope',
}
```

### Recovery Strategies
- **Expired tokens**: Automatic refresh with retry
- **Revoked access**: Clear tokens, prompt re-authorization
- **Network errors**: Exponential backoff with retry
- **Popup blocked**: Fallback to redirect flow
- **Invalid configuration**: Clear state, show configuration UI

## Future Enhancements

### Phase 2 Features
1. **Multiple OAuth servers**: Support multiple simultaneous connections
2. **Client certificate auth**: For enterprise OAuth flows
3. **OpenID Connect**: Enhanced identity and metadata
4. **Advanced scoping**: Fine-grained permission management

### Integration Opportunities
1. **Browser credential storage**: Integration with browser password manager
2. **Single sign-on**: OAuth provider discovery and preference
3. **Audit logging**: OAuth connection and usage tracking
4. **Admin controls**: Enterprise policy enforcement

## Success Metrics

### Technical Metrics
- OAuth flow completion rate > 95%
- Token refresh success rate > 99%
- Connection establishment time < 5 seconds
- Zero security vulnerabilities in OAuth implementation

### User Experience Metrics
- Reduction in support tickets related to API key management
- User adoption of OAuth vs. bearer token authentication
- Time to first successful MCP connection
- User satisfaction with OAuth flow simplicity

## Conclusion

This OAuth implementation will significantly improve the security and user experience of MCP connections in DevTools. By supporting industry-standard OAuth 2.0 flows, users can securely connect to services like Zapier without managing API keys manually.

The phased implementation approach ensures we can validate the architecture early and iterate based on real-world usage patterns. The security-first design protects user credentials while maintaining the flexibility needed for various OAuth providers.