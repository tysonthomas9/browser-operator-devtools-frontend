#!/usr/bin/env python3
"""
Langfuse Dataset Runner Example

This example demonstrates how to run evaluations against a Langfuse dataset,
with dual scoring to both agent traces and dataset runs. It showcases the
complete integration between the eval-server and Langfuse for experiment tracking.

Prerequisites:
- Langfuse server running and accessible
- Dataset created in Langfuse UI with evaluation items
- Environment variables configured (see below)
- Browser Operator installed (for --auto-launch)

Environment Variables:
- LANGFUSE_ENABLE=true
- LANGFUSE_HOST=https://your-langfuse-instance.com
- LANGFUSE_PUBLIC_KEY=your-public-key
- LANGFUSE_SECRET_KEY=your-secret-key
- LANGFUSE_DATASET_NAME=your-dataset-name (optional)

Auto-Launch Notes:
- When using --auto-launch, Browser Operator will request keychain/keypass access
- This is normal - approve the request to allow secure credential storage
- The browser launches with DevTools and AI Assistant panel automatically
- Remote debugging is enabled on port 9222 for automation

Usage:
    # Manual connection
    python examples/langfuse_dataset_runner.py --run-name "exp-2025-01-15" --dataset "my-dataset"

    # Auto-launch Browser Operator
    python examples/langfuse_dataset_runner.py --run-name "exp-2025-01-15" --dataset "my-dataset" --auto-launch
"""

import asyncio
import argparse
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# Load .env configuration
try:
    from dotenv import load_dotenv

    env_locations = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / ".env"
    ]

    for env_file in env_locations:
        if env_file.exists():
            load_dotenv(env_file)
            print(f"📁 Loaded configuration from: {env_file}")
            break
except ImportError:
    print("⚠️  python-dotenv not available - using environment variables")

# Add src to path for local development
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from bo_eval_server import EvalServer
from bo_eval_server.rpc_client import RpcError
from bo_eval_server.langfuse_tracer import get_tracer, flush

try:
    from langfuse import get_client as get_langfuse_client
    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False
    print("Warning: Langfuse SDK not installed. Install with: pip install langfuse")


# Browser launching and process management
launched_browsers = []


def launch_browser_operator(browser_path: str, server_url: str) -> Optional[subprocess.Popen]:
    """
    Launch a Browser Operator instance with DevTools enabled.

    Args:
        browser_path: Path to the Browser Operator executable
        server_url: WebSocket URL for the evaluation server

    Returns:
        Subprocess Popen object or None if launch failed
    """
    try:
        # Check if browser path exists
        if not os.path.exists(browser_path):
            print(f"❌ Browser path not found: {browser_path}")
            return None

        print(f"🚀 Launching Browser Operator with DevTools: {browser_path}")

        # Launch browser with DevTools flags
        # --auto-open-devtools-for-tabs: Automatically opens DevTools for new tabs
        # --new-window: Creates a new browser window
        # --remote-debugging-port=9222: Enables remote debugging for automation
        # --use-mock-keychain: Use mock keychain to avoid password prompts
        # --password-store=basic: Use basic password storage instead of system keychain
        process = subprocess.Popen(
            [
                browser_path,
                "--new-window",
                "--auto-open-devtools-for-tabs",
                "--remote-debugging-port=9222",
                "--use-mock-keychain",
                "--password-store=basic"
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=os.setsid if hasattr(os, 'setsid') else None
        )

        launched_browsers.append(process)
        print(f"✅ Browser launched with PID: {process.pid}")
        print(f"   🔧 DevTools will open automatically for new tabs")
        print(f"   🔌 Remote debugging enabled on port 9222")

        # Schedule AI Assistant panel opening after browser startup
        asyncio.create_task(open_ai_assistant_panel(process.pid))

        return process

    except Exception as e:
        print(f"❌ Failed to launch browser: {e}")
        return None


async def open_ai_assistant_panel(browser_pid: int):
    """
    Attempt to open the AI Assistant panel in Browser Operator after startup.

    Args:
        browser_pid: Process ID of the browser instance
    """
    try:
        # Wait for browser to fully start up
        await asyncio.sleep(3)

        print(f"🤖 Attempting to open AI Assistant panel in browser {browser_pid}...")

        # Try to use Chrome DevTools Protocol to open AI Assistant panel
        # This requires the remote debugging port to be available
        try:
            import aiohttp

            async with aiohttp.ClientSession() as session:
                # Get list of tabs from Chrome DevTools Protocol
                async with session.get('http://localhost:9222/json') as resp:
                    if resp.status == 200:
                        tabs = await resp.json()
                        if tabs:
                            # Use the first available tab
                            tab = tabs[0]
                            print(f"   📡 Connected to tab: {tab.get('title', 'Unknown')}")
                            print(f"   🎯 DevTools should be available for evaluation setup")

        except Exception as cdp_error:
            print(f"   ⚠️  Chrome DevTools Protocol connection failed: {cdp_error}")
            print(f"   💡 DevTools should still be available via --auto-open-devtools-for-tabs flag")

        # DevTools should already be open due to --auto-open-devtools-for-tabs flag
        # No need for additional keyboard shortcuts since DevTools opens automatically
        print(f"   💡 DevTools opened automatically - no additional shortcuts needed")

    except Exception as e:
        print(f"   ❌ Failed to open AI Assistant panel: {e}")


def cleanup_browsers():
    """Clean up all launched browser processes."""
    for process in launched_browsers:
        try:
            if process.poll() is None:  # Process is still running
                print(f"🛑 Terminating browser process {process.pid}")
                if hasattr(os, 'killpg'):
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                else:
                    process.terminate()

                # Wait for clean shutdown
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    print(f"⚠️  Force killing browser process {process.pid}")
                    if hasattr(os, 'killpg'):
                        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    else:
                        process.kill()
        except Exception as e:
            print(f"⚠️  Error cleaning up browser process: {e}")
            pass

    launched_browsers.clear()


class LangfuseDatasetRunner:
    """
    Runner for executing evaluations against Langfuse datasets with dual scoring.
    """
    
    def __init__(self, server_endpoint: str = "ws://localhost:8080", auth_key: str = "dev-key", auto_launch: bool = False, browser_path: str = None):
        self.server_endpoint = server_endpoint
        self.auth_key = auth_key
        self.auto_launch = auto_launch
        self.browser_path = browser_path or "/Applications/Browser Operator.app/Contents/MacOS/Browser Operator"
        self.langfuse_client = None
        self.tracer = get_tracer()
        
        if LANGFUSE_AVAILABLE and self.tracer._enabled:
            try:
                self.langfuse_client = get_langfuse_client()
                print("✓ Langfuse client initialized")
            except Exception as e:
                print(f"✗ Failed to initialize Langfuse client: {e}")
                self.langfuse_client = None
        else:
            print("✗ Langfuse not available or disabled")
    
    async def run_dataset_evaluation(
        self,
        dataset_name: str,
        run_name: str,
        model: Optional[str] = None,
        prompt_variant: Optional[str] = None,
        toolset: Optional[str] = None,
        timeout: float = 60.0,
        max_items: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Run evaluations against a Langfuse dataset.
        
        Args:
            dataset_name: Name of the dataset in Langfuse
            run_name: Name for this experiment run
            model: Model name to use (optional)
            prompt_variant: Prompt variant identifier (optional)
            toolset: Toolset identifier (optional)
            timeout: Timeout per evaluation in seconds
            max_items: Maximum number of items to process (optional)
            
        Returns:
            Summary of the run results
        """
        if not self.langfuse_client:
            raise RuntimeError("Langfuse client not available")
        
        print(f"🚀 Starting dataset evaluation run: {run_name}")
        print(f"📊 Dataset: {dataset_name}")
        
        # Get dataset from Langfuse
        try:
            dataset = self.langfuse_client.get_dataset(dataset_name)
            print(f"✓ Loaded dataset '{dataset_name}' with {len(dataset.items)} items")
        except Exception as e:
            raise RuntimeError(f"Failed to load dataset '{dataset_name}': {e}")
        
        # Prepare experiment metadata
        experiment_metadata = {
            "model": model or "default",
            "prompt_variant": prompt_variant or "default",
            "toolset": toolset or "default",
            "config_hash": self._compute_config_hash(model, prompt_variant, toolset),
            "timestamp": time.time(),
            "server_endpoint": self.server_endpoint
        }
        
        print(f"🧪 Experiment metadata: {experiment_metadata}")
        
        # Auto-launch timeout adjustment (like browsecomp)
        if self.auto_launch and timeout < 600:  # Less than 10 minutes
            original_timeout = timeout
            timeout = 600.0  # 10 minutes
            print(f"🔄 Auto-launch enabled: adjusting timeout from {original_timeout}s to {timeout}s")

        # Create and start eval server
        server_port = 8080  # Default port
        server = EvalServer(
            auth_key=self.auth_key,
            host="127.0.0.1",
            port=server_port
        )

        # Launch browser if auto-launch is enabled
        browser_process = None
        if self.auto_launch:
            print(f"🤖 Auto-launch enabled - launching Browser Operator")
            server_url = f"ws://127.0.0.1:{server_port}"
            browser_process = launch_browser_operator(self.browser_path, server_url)
            if not browser_process:
                print(f"❌ Failed to launch browser, continuing with manual connection")
                print(f"   You can manually connect Browser Operator to: {server_url}")

        print(f"🚀 Starting eval server on ws://127.0.0.1:{server_port}")
        if not self.auto_launch:
            print(f"   Connect your Browser Operator with auth key: {self.auth_key}")
        print(f"📝 Will process {len(dataset.items) if not max_items else min(len(dataset.items), max_items)} items from dataset")

        results = []

        @server.on_connect
        async def handle_client(client):
            print(f"✓ Client connected: {client.id}")

            success_count = 0
            error_count = 0

            items_to_process = dataset.items
            if max_items:
                items_to_process = items_to_process[:max_items]

            print(f"📝 Processing {len(items_to_process)} items...")

            for i, item in enumerate(items_to_process):
                print(f"🔄 Item {i+1}/{len(items_to_process)}: {item.id}")

                # Use Langfuse dataset run context
                with item.run(run_name=run_name, run_metadata=experiment_metadata) as run_context:
                    evaluation = None  # Initialize to avoid scope issues
                    try:
                        print(f"📋 Building evaluation from dataset item...")
                        # Build evaluation from dataset item
                        evaluation = self._build_evaluation_from_item(item, timeout)

                        # Add experiment metadata to evaluation
                        evaluation['metadata'] = {
                            **evaluation.get('metadata', {}),
                            **experiment_metadata,
                            'run_name': run_name,
                            'dataset_item_id': item.id
                        }

                        print(f"🚀 Executing evaluation: {evaluation['name']}")
                        print(f"   Tool: {evaluation['tool']}")
                        print(f"   Input: {str(evaluation['input'])[:100]}...")

                        # Execute evaluation via eval server
                        start_time = time.time()
                        result = await client.evaluate(evaluation, timeout=timeout)
                        execution_time = time.time() - start_time

                        print(f"✅ Evaluation completed in {execution_time:.2f}s")

                        # Update dataset run trace with evaluation info
                        run_context.update_trace(
                            input=evaluation['input'],
                            output=result
                        )

                        # Extract agent traceId from result
                        agent_trace_id = None
                        if isinstance(result, dict) and 'metadata' in result:
                            agent_trace_id = result['metadata'].get('traceId')

                        if agent_trace_id:
                            print(f"🔗 Agent trace ID: {agent_trace_id[:12]}...")

                        # Compute scores
                        scores = self._compute_scores(item, evaluation, result)

                        # Attach scores to dataset run
                        for score_name, score_data in scores.items():
                            run_context.score_trace(
                                name=score_name,
                                value=score_data['value'],
                                comment=score_data.get('comment', '')
                            )

                        # Also attach scores to agent trace (preferred)
                        if agent_trace_id:
                            for score_name, score_data in scores.items():
                                try:
                                    self.langfuse_client.score(
                                        trace_id=agent_trace_id,
                                        name=score_name,
                                        value=score_data['value'],
                                        comment=score_data.get('comment', ''),
                                        metadata={
                                            "evaluation_id": evaluation['id'],
                                            "run_name": run_name,
                                            "dataset_item_id": item.id,
                                            "agent_trace_id": agent_trace_id,
                                            **experiment_metadata
                                        }
                                    )
                                except Exception as score_error:
                                    print(f"⚠️ Failed to score agent trace {agent_trace_id}: {score_error}")

                        # Store result
                        result_summary = {
                            'item_id': item.id,
                            'evaluation_id': evaluation['id'],
                            'agent_trace_id': agent_trace_id,
                            'execution_time': execution_time,
                            'scores': scores,
                            'status': 'success'
                        }
                        results.append(result_summary)
                        success_count += 1

                        print(f"✓ Success: {scores}")

                    except Exception as e:
                        error_count += 1
                        error_msg = str(e)

                        # Try to extract JSON-RPC details if this came from the client
                        rpc_code = None
                        rpc_message = None
                        rpc_data = None
                        rpc_trace_id = None
                        if isinstance(e, RpcError) and getattr(e, 'response', None):
                            try:
                                err_obj = e.response.get('error') or {}
                                rpc_code = err_obj.get('code')
                                rpc_message = err_obj.get('message')
                                rpc_data = err_obj.get('data') or {}
                                # Trace metadata if provided by client
                                if isinstance(rpc_data, dict):
                                    # Some clients nest metadata; support both shapes
                                    metadata = rpc_data.get('metadata') if isinstance(rpc_data.get('metadata'), dict) else rpc_data
                                    rpc_trace_id = metadata.get('traceId') if isinstance(metadata, dict) else None
                            except Exception:
                                pass

                        if rpc_message:
                            print(f"❌ Error processing item {item.id}: RPC {rpc_code}: {rpc_message}")
                            if rpc_trace_id:
                                print(f"   🔗 Agent trace: {rpc_trace_id}")
                            if rpc_code == -32000 and (rpc_message or '').lower().startswith('tool execution failed'):
                                print("   💡 Hint: Tool failed in the Browser Operator. Common causes include:")
                                print("      - Missing/invalid LLM provider credentials in AI Chat settings")
                                print("      - Unsupported tool name for this agent")
                                print("      - Page permissions or cross-origin restrictions")
                            if isinstance(rpc_data, dict) and rpc_data.get('error'):
                                compact_err = str(rpc_data.get('error'))
                                if len(compact_err) > 300:
                                    compact_err = compact_err[:300] + '…'
                                print(f"   🧷 Client error detail: {compact_err}")
                        else:
                            print(f"❌ Error processing item {item.id}: {error_msg}")

                        # Record failure score to dataset run
                        run_context.score_trace(
                            name="task_success",
                            value=0,
                            comment=f"Evaluation failed: {error_msg}"
                        )

                        # Use evaluation ID if available, otherwise use item ID
                        evaluation_id = evaluation.get('id', f'failed-{item.id}') if evaluation else f'failed-{item.id}'

                        result_summary = {
                            'item_id': item.id,
                            'evaluation_id': evaluation_id,
                            'agent_trace_id': None,
                            'execution_time': 0,
                            'scores': {'task_success': {'value': 0, 'comment': f"Error: {error_msg}"}},
                            'status': 'error',
                            'error': error_msg,
                            **({
                                'rpc_error': {
                                    'code': rpc_code,
                                    'message': rpc_message,
                                    'traceId': rpc_trace_id,
                                }
                            } if rpc_message else {})
                        }
                        results.append(result_summary)

                        print(f"✗ Error: {error_msg}")

            # Flush all data to Langfuse
            try:
                self.langfuse_client.flush()
                flush()  # Also flush tracer
                print("✓ Flushed all data to Langfuse")
            except Exception as e:
                print(f"⚠️ Failed to flush data: {e}")

            # Compile summary
            summary = {
                'run_name': run_name,
                'dataset_name': dataset_name,
                'total_items': len(items_to_process),
                'success_count': success_count,
                'error_count': error_count,
                'success_rate': success_count / len(items_to_process) if items_to_process else 0,
                'experiment_metadata': experiment_metadata,
                'results': results
            }

            print(f"\n📊 Run Summary:")
            print(f"   Total items: {summary['total_items']}")
            print(f"   Successes: {summary['success_count']}")
            print(f"   Errors: {summary['error_count']}")
            print(f"   Success rate: {summary['success_rate']:.2%}")

            # Stop the server after completion
            print(f"\n🛑 Stopping server...")
            await asyncio.sleep(1)  # Brief delay for final logs
            if server:
                await server.stop()

            return summary

        # Start the server
        try:
            await server.start()
            await server.wait_closed()
        except KeyboardInterrupt:
            print(f"\n🛑 Evaluation interrupted by user")
            cleanup_browsers()
        except Exception as e:
            print(f"\n💥 Evaluation error: {e}")
            cleanup_browsers()
        finally:
            cleanup_browsers()
            if server:
                await server.stop()

        return {}
    
    def _build_evaluation_from_item(self, item, timeout: float) -> Dict[str, Any]:
        """
        Build an evaluation request from a dataset item.

        Handles multiple input formats flexibly (like browsecomp):
        - Simple string: converted to {"message": string}
        - Dict with "text": converted to {"message": text}
        - Dict with "tool" and "input": used as-is
        - Dict with "message": used directly
        - Any other format: converted to string message

        Always defaults to "chat" tool unless explicitly specified.
        """
        input_data = item.input

        # Handle different input formats flexibly
        if isinstance(input_data, str):
            # Simple string format
            tool = "chat"
            input_content = {"message": input_data}
            url = None
        elif isinstance(input_data, dict):
            if 'tool' in input_data:
                # Already has tool specified (expected format)
                tool = input_data['tool']
                input_content = input_data.get('input', {})
                url = input_data.get('url')
            elif 'text' in input_data:
                # Simple text field (like current Langfuse dataset)
                tool = "chat"
                input_content = {"message": input_data['text']}
                url = input_data.get('url')
            elif 'message' in input_data:
                # Already has message field
                tool = "chat"
                input_content = input_data
                url = input_data.get('url')
            else:
                # Fallback: use entire dict as message content
                tool = "chat"
                # Extract common fields
                message_text = str(input_data)
                input_content = {"message": message_text}
                url = input_data.get('url')
        else:
            # Fallback for any other type (numbers, lists, etc.)
            tool = "chat"
            input_content = {"message": str(input_data)}
            url = None

        # Note: Frontend agent expects timeout in milliseconds. Convert seconds -> ms.
        evaluation = {
            "id": f"dataset-{item.id}-{int(time.time())}",
            "name": f"Dataset Evaluation: {item.id}",
            "tool": tool,
            "input": input_content,
            "timeout": int(timeout * 1000),
            "metadata": {
                "dataset_item_id": item.id,
                "source": "langfuse_dataset"
            }
        }

        # Add expected output to metadata if available
        if hasattr(item, 'expected_output') and item.expected_output:
            evaluation['metadata']['expected_output'] = item.expected_output

        # Add URL if provided
        if url:
            evaluation['url'] = url

        return evaluation
    
    def _compute_scores(
        self,
        item,
        evaluation: Dict[str, Any],
        result: Dict[str, Any]
    ) -> Dict[str, Dict[str, Union[float, str]]]:
        """
        Compute scores for an evaluation result.
        
        This is a basic implementation - extend with your scoring logic.
        """
        scores = {}
        
        # Basic success/failure score
        if 'error' in result:
            scores['task_success'] = {
                'value': 0,
                'comment': f"Evaluation failed: {result.get('error', 'Unknown error')}"
            }
        else:
            scores['task_success'] = {
                'value': 1,
                'comment': "Evaluation completed successfully"
            }
        
        # Execution time score (lower is better, normalized)
        exec_time = result.get('executionTime', 0) / 1000.0  # Convert ms to seconds
        if exec_time > 0:
            # Normalize to 0-1 scale (assuming 30s is max reasonable time)
            time_score = max(0, min(1, 1 - (exec_time / 30.0)))
            scores['execution_speed'] = {
                'value': time_score,
                'comment': f"Execution time: {exec_time:.2f}s"
            }
        
        # Add custom scoring based on expected output
        if hasattr(item, 'expected_output') and item.expected_output:
            # Implement exact match, similarity, or custom scoring logic here
            actual_output = result.get('output', '')
            if isinstance(actual_output, dict):
                actual_output = json.dumps(actual_output)
            
            expected_str = str(item.expected_output)
            actual_str = str(actual_output)
            
            # Simple exact match score
            exact_match = 1 if expected_str.lower() == actual_str.lower() else 0
            scores['exact_match'] = {
                'value': exact_match,
                'comment': f"Expected: {expected_str[:50]}..., Got: {actual_str[:50]}..."
            }
        
        return scores
    
    def _compute_config_hash(self, model: Optional[str], prompt_variant: Optional[str], toolset: Optional[str]) -> str:
        """Compute a stable hash for the configuration."""
        config_str = f"{model or 'default'}-{prompt_variant or 'default'}-{toolset or 'default'}"
        return hashlib.md5(config_str.encode()).hexdigest()[:8]


async def main():
    """Main entry point for the dataset runner."""
    parser = argparse.ArgumentParser(description="Run evaluations against a Langfuse dataset")
    parser.add_argument("--run-name", required=True, help="Name for this experiment run")
    parser.add_argument("--dataset", required=True, help="Name of the Langfuse dataset")
    parser.add_argument("--model", help="Model name to use")
    parser.add_argument("--prompt-variant", help="Prompt variant identifier")
    parser.add_argument("--toolset", help="Toolset identifier")
    parser.add_argument("--timeout", type=float, default=60.0, help="Timeout per evaluation (seconds)")
    parser.add_argument("--max-items", type=int, help="Maximum number of items to process")
    parser.add_argument("--server", default="ws://localhost:8080", help="Eval server WebSocket endpoint")
    parser.add_argument("--auth-key", default="dev-key", help="Authentication key for eval server")
    parser.add_argument(
        "--auto-launch",
        action="store_true",
        help="Automatically launch Browser Operator instance for evaluations"
    )
    parser.add_argument(
        "--browser-path",
        type=str,
        default="/Applications/Browser Operator.app/Contents/MacOS/Browser Operator",
        help="Path to Browser Operator executable (default: /Applications/Browser Operator.app/Contents/MacOS/Browser Operator)"
    )
    
    args = parser.parse_args()
    
    if not LANGFUSE_AVAILABLE:
        print("Error: Langfuse SDK not installed. Install with: pip install langfuse")
        sys.exit(1)
    
    # Check environment
    required_env_vars = ['LANGFUSE_HOST', 'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"Error: Missing required environment variables: {missing_vars}")
        print("Please set these variables to connect to Langfuse.")
        sys.exit(1)
    
    if not os.getenv('LANGFUSE_ENABLE', '').lower() in ('true', '1', 'yes', 'on'):
        print("Error: LANGFUSE_ENABLE is not set to 'true'. Set LANGFUSE_ENABLE=true to enable Langfuse.")
        sys.exit(1)
    
    try:
        runner = LangfuseDatasetRunner(
            server_endpoint=args.server,
            auth_key=args.auth_key,
            auto_launch=args.auto_launch,
            browser_path=args.browser_path
        )
        
        summary = await runner.run_dataset_evaluation(
            dataset_name=args.dataset,
            run_name=args.run_name,
            model=args.model,
            prompt_variant=args.prompt_variant,
            toolset=args.toolset,
            timeout=args.timeout,
            max_items=args.max_items
        )
        
        # Save results to file
        results_file = f"results-{args.run_name}-{int(time.time())}.json"
        with open(results_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\n💾 Results saved to: {results_file}")
        print("✅ Dataset evaluation completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        cleanup_browsers()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
