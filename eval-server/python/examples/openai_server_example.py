#!/usr/bin/env python3

"""
Example demonstrating how to use the OpenAI-compatible API server.

This example shows how to start both the WebSocket evaluation server
and the OpenAI-compatible HTTP wrapper that multiplexes requests to
connected DevTools tabs.
"""

import asyncio
import logging
from bo_eval_server import EvalServer
from bo_eval_server.openai_server import OpenAICompatibleServer

# Configure logging
logging.basicConfig(level=logging.INFO)

async def main():
    print("🚀 Starting Browser Operator evaluation server with OpenAI-compatible API...")
    
    # Create WebSocket evaluation server
    eval_server = EvalServer(
        auth_key='hello',
        host='127.0.0.1',
        port=8080,
        log_level='INFO'
    )
    
    # Set up client connection handler
    @eval_server.on_connect
    async def handle_client_connect(client):
        print(f"✅ DevTools tab connected: {client.id}")
        print(f"   Tab ID: {client.tab_id}")
        print(f"   Capabilities: {client.capabilities}")
        print(f"   Connected at: {client._connected_at}")
        
        # The client is now ready to receive evaluations via OpenAI API
    
    @eval_server.on_disconnect  
    async def handle_client_disconnect(client_info):
        print(f"❌ DevTools tab disconnected: {client_info['id']}")
    
    # Create OpenAI-compatible HTTP server
    openai_server = OpenAICompatibleServer(
        eval_server=eval_server,
        host='127.0.0.1',
        port=8081,
        model_cache_ttl=300  # 5 minutes
    )
    
    try:
        # Start WebSocket server first
        print("🔧 Starting WebSocket evaluation server on ws://127.0.0.1:8080")
        await eval_server.start()
        
        # Start OpenAI-compatible HTTP server
        print("🔧 Starting OpenAI-compatible API server on http://127.0.0.1:8081")
        
        # Run the HTTP server (this will block)
        await openai_server.start()
        
    except KeyboardInterrupt:
        print("\n🛑 Shutting down servers...")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        # Clean shutdown
        try:
            await openai_server.stop()
        except:
            pass
        try:
            await eval_server.stop()  
        except:
            pass

if __name__ == '__main__':
    print("""
🌟 Browser Operator Evaluation Server with OpenAI-Compatible API

This server provides:
- WebSocket server for DevTools tab connections (port 8080)
- OpenAI-compatible HTTP API (port 8081)

To use:
1. Start this server
2. Connect DevTools tabs via WebSocket to ws://127.0.0.1:8080  
3. Send OpenAI-compatible requests to http://127.0.0.1:8081

Available endpoints:
- GET  /v1/models           - List available models
- POST /v1/chat/completions - Chat completions
- GET  /health              - Health check

Example usage:
  curl http://127.0.0.1:8081/v1/models
  
  curl -X POST http://127.0.0.1:8081/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{
      "model": "gpt-4.1", 
      "messages": [{"role": "user", "content": "Hello!"}]
    }'

Press Ctrl+C to stop the server.
""")
    
    asyncio.run(main())