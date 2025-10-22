# Client Configurations

This directory contains client configuration files for the Browser Agent Server.

## File Naming Convention

Client configuration files **must** be named using the client's UUID:

```
{client-uuid}.yaml
```

Example:
```
9907fd8d-92a8-4a6a-bce9-458ec8c57306.yaml
```

## Creating a New Client

1. Copy `example-client.yaml` to a new file with your client's UUID:
   ```bash
   cp example-client.yaml {your-client-uuid}.yaml
   ```

2. Edit the new file and update:
   - `client.id` - Must match the filename (without .yaml extension)
   - `client.name` - A friendly name for the client
   - `client.secret_key` - Authentication secret (default: "hello")
   - `client.description` - Description of the client

## Auto-Discovery

The server automatically discovers and loads all `.yaml` files in this directory on startup. The filename (without extension) is used as the client ID.

## Security Note

Client configuration files contain secret keys and are excluded from version control via `.gitignore`. Keep these files secure and never commit them to the repository.

## Example Configuration

See `example-client.yaml` for a template configuration file.
