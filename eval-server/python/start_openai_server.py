#!/usr/bin/env python3
"""
Startup script for the OpenAI-compatible evaluation server.
"""

import asyncio
import sys
import os

# Add the src directory to the Python path
src_dir = os.path.join(os.path.dirname(__file__), 'src')
sys.path.insert(0, src_dir)

from bo_eval_server.eval_server import EvalServer
from bo_eval_server.config import Config
from bo_eval_server.openai_server import OpenAICompatibleServer


async def main():
    """Main entry point for running the OpenAI-compatible server standalone"""
    
    # Create config (use different port to avoid conflicts)
    config = Config(auth_key="test-key", port=8082)
    
    # Create and start evaluation server
    eval_server = EvalServer(config)
    await eval_server.start()
    
    # Create and start OpenAI-compatible server
    openai_server = OpenAICompatibleServer(eval_server)
    
    try:
        await openai_server.start()
    except KeyboardInterrupt:
        print("\nReceived shutdown signal")
    finally:
        await openai_server.stop()
        await eval_server.stop()


if __name__ == "__main__":
    asyncio.run(main())