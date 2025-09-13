#!/usr/bin/env python3
"""
Browsecomp Evaluation Server

Command-line controlled eval processing server that loads browsecomp questions
into a stack and distributes them one per client connection.
"""

import argparse
import asyncio
import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

# Load .env file for configuration
try:
    from dotenv import load_dotenv
    
    # Look for .env file in multiple locations
    env_locations = [
        Path(__file__).parent / ".env",           # evals/.env (local to browsecomp)
        Path(__file__).parent.parent / ".env"     # eval-server/python/.env (parent)
    ]
    
    env_loaded = False
    for env_file in env_locations:
        if env_file.exists():
            load_dotenv(env_file)
            print(f"📁 Loaded configuration from: {env_file}")
            
            # Debug: Check what values were actually loaded
            print(f"   DEBUG - LANGFUSE_ENABLE={repr(os.getenv('LANGFUSE_ENABLE'))}")
            print(f"   DEBUG - LANGFUSE_HOST={repr(os.getenv('LANGFUSE_HOST'))}")
            print(f"   DEBUG - Keys present: {bool(os.getenv('LANGFUSE_PUBLIC_KEY')) and bool(os.getenv('LANGFUSE_SECRET_KEY'))}")
            
            env_loaded = True
            break
    
    if not env_loaded:
        print("ℹ️  No .env file found - using environment variables if set")
        print("   Create .env in evals/ or eval-server/python/ directory")
        
except ImportError:
    print("⚠️  python-dotenv not installed - install with: pip install python-dotenv")
    print("   Environment variables will still be used if set manually")

# Add eval-server src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Add current directory (evals) to path for browsecomp_dataset import
sys.path.insert(0, str(Path(__file__).parent))

from bo_eval_server import EvalServer, EvaluationStack
from bo_eval_server.langfuse_tracer import get_tracer, create_dataset_run, score_dataset_item, score_agent_trace, create_trace
from browsecomp_dataset import BrowsecompDataset
from browsecomp_scorer import question_scorer, extract_answer, extract_confidence
from enhanced_scorer import EnhancedScorer, enhanced_question_scorer
from llm_judge import LLMJudge, llm_evaluate_response, HAS_LLM_SUPPORT


def log_evaluation_event(logger: logging.Logger, event_type: str, data: Dict[str, Any]) -> None:
    """
    Log a structured evaluation event.
    
    Args:
        logger: Logger instance
        event_type: Type of event (client_connect, evaluation_start, evaluation_complete, etc.)
        data: Event data to log
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        **data
    }
    logger.info(f"EVENT: {json.dumps(log_entry)}")


def setup_logging(log_dir: str = "./logs") -> logging.Logger:
    """
    Set up logging to both console and file.
    
    Args:
        log_dir: Directory to save log files
        
    Returns:
        Configured logger
    """
    # Ensure logs directory exists
    Path(log_dir).mkdir(exist_ok=True)
    
    # Create timestamp for log file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = Path(log_dir) / f"browsecomp_eval_server_{timestamp}.log"
    
    # Create logger
    logger = logging.getLogger('browsecomp_eval_server')
    logger.setLevel(logging.INFO)
    
    # Clear any existing handlers
    logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler (for immediate feedback)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (for persistent logging)
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    logger.info(f"Logging initialized - saving to {log_file}")
    return logger


def extract_response_text(result: Any) -> str:
    """
    Extract the actual response text from BrowserOperator's structured response format.
    
    Args:
        result: The response from BrowserOperator (could be string, dict, or structured format)
        
    Returns:
        The text content that should be scored
    """
    # Handle partial results with errors first
    if isinstance(result, dict) and result.get('partial') and result.get('error'):
        # This is our error structure, fallback to string representation
        return str(result)
    
    # Handle structured BrowserOperator response
    if isinstance(result, dict):
        # Look for messages array (main response structure)
        if 'messages' in result and isinstance(result['messages'], list):
            response_parts = []
            
            for message in result['messages']:
                if isinstance(message, dict):
                    # Model responses with answers
                    if message.get('entity') == 'model' and message.get('answer'):
                        response_parts.append(message['answer'])
                    # Tool results
                    elif message.get('entity') == 'tool_result' and message.get('resultText'):
                        response_parts.append(message['resultText'])
                    # User messages
                    elif message.get('entity') == 'user' and message.get('text'):
                        response_parts.append(message['text'])
            
            if response_parts:
                return '\n'.join(response_parts)
        
        # Fallback: look for common response fields
        for field in ['answer', 'response', 'result', 'text', 'content']:
            if field in result and result[field]:
                return str(result[field])
    
    # Fallback to string representation
    return str(result)


def convert_question_to_evaluation(question_row: Dict[str, Any], question_id: int) -> Dict[str, Any]:
    """
    Convert a browsecomp question to the evaluation format expected by eval-server.
    
    Args:
        question_row: Row from the browsecomp dataset DataFrame
        question_id: Question ID number (1-based)
        
    Returns:
        Evaluation object compatible with eval-server
    """
    question_text = question_row.get('question', question_row.get('problem_decrypted', ''))
    true_answer = question_row.get('true_answer', question_row.get('answer_decrypted', ''))
    
    return {
        "id": f"browsecomp_q{question_id}",
        "name": f"Browsecomp Question {question_id}",
        "description": f"Web browsing evaluation question from browsecomp dataset",
        "tool": "chat",
        "input": {
            "message": f"{question_text}\n\nPlease provide your response in the following format:\n\nExplanation: [Step-by-step reasoning and information gathering]\n\nExact Answer: [The precise answer to the question]\n\nConfidence Score: [Confidence as a percentage, e.g., 85%]"
        },
        # Store original data for later reference/scoring
        "metadata": {
            "question_id": question_id,
            "true_answer": true_answer,
            "original_question": question_text,
            "dataset": "browsecomp"
        }
    }


def load_browsecomp_evaluations(
    limit: Optional[int] = None,
    questions: Optional[List[int]] = None,
    start: Optional[int] = None,
    end: Optional[int] = None,
    password: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Load browsecomp questions and convert them to evaluation format.
    
    Args:
        limit: Maximum number of questions to load
        questions: Specific question numbers to load (1-based)
        start: Start question number for range selection (1-based, inclusive)
        end: End question number for range selection (1-based, inclusive)
        password: Decryption password (optional, auto-detected from dataset)
        
    Returns:
        List of evaluation objects
    """
    print("📚 Loading Browsecomp dataset...")
    
    # Load dataset
    dataset = BrowsecompDataset(password=password)
    
    try:
        df = dataset.load_dataset()
        print(f"✅ Loaded {len(df)} questions from dataset")
    except Exception as e:
        print(f"❌ Failed to load dataset: {e}")
        return []
    
    # Get specific questions, range, or apply limit
    if questions:
        print(f"📋 Filtering to specific questions: {questions}")
        df_filtered = dataset.get_questions(indices=questions)
    elif start is not None or end is not None:
        # Handle range selection
        if start is not None and end is not None:
            if start > end:
                print(f"❌ Invalid range: start ({start}) cannot be greater than end ({end})")
                return []
            if start < 1:
                print(f"❌ Invalid start: question numbers are 1-based, got {start}")
                return []
            if end > len(df):
                print(f"⚠️  End question {end} exceeds dataset size ({len(df)}), using {len(df)} instead")
                end = len(df)
            
            print(f"📋 Loading questions {start} to {end} (range of {end - start + 1} questions)")
            # Convert to 0-based indexing for pandas
            range_questions = list(range(start, end + 1))
            df_filtered = dataset.get_questions(indices=range_questions)
        elif start is not None:
            # Only start specified, go to end of dataset
            if start < 1:
                print(f"❌ Invalid start: question numbers are 1-based, got {start}")
                return []
            if start > len(df):
                print(f"❌ Start question {start} exceeds dataset size ({len(df)})")
                return []
            
            print(f"📋 Loading questions from {start} to end ({len(df) - start + 1} questions)")
            range_questions = list(range(start, len(df) + 1))
            df_filtered = dataset.get_questions(indices=range_questions)
        else:
            # Only end specified, start from beginning
            if end < 1:
                print(f"❌ Invalid end: question numbers are 1-based, got {end}")
                return []
            if end > len(df):
                print(f"⚠️  End question {end} exceeds dataset size ({len(df)}), using {len(df)} instead")
                end = len(df)
            
            print(f"📋 Loading questions 1 to {end} ({end} questions)")
            range_questions = list(range(1, end + 1))
            df_filtered = dataset.get_questions(indices=range_questions)
    elif limit:
        print(f"📋 Limiting to first {limit} questions")
        df_filtered = dataset.get_questions(limit=limit)
    else:
        print(f"📋 Loading all {len(df)} questions")
        df_filtered = df
    
    if df_filtered.empty:
        print("❌ No questions found with the specified criteria")
        return []
    
    print(f"🔄 Converting {len(df_filtered)} questions to evaluation format...")
    
    # Convert to evaluation format
    evaluations = []
    for idx, row in df_filtered.iterrows():
        question_id = row.get('question_id', idx + 1)
        evaluation = convert_question_to_evaluation(row.to_dict(), question_id)
        evaluations.append(evaluation)
        
        # Show preview of first few questions
        if len(evaluations) <= 3:
            question_preview = evaluation['input']['message'][:80] + "..."
            print(f"   • Q{question_id}: {question_preview}")
    
    if len(evaluations) > 3:
        print(f"   ... and {len(evaluations) - 3} more questions")
    
    print(f"✅ Created {len(evaluations)} evaluation objects")
    return evaluations


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
        process = subprocess.Popen(
            [
                browser_path, 
                "--new-window",
                "--auto-open-devtools-for-tabs",
                "--remote-debugging-port=9222"
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
        import json
        import aiohttp
        
        try:
            async with aiohttp.ClientSession() as session:
                # Get list of tabs from Chrome DevTools Protocol
                async with session.get('http://localhost:9222/json') as resp:
                    if resp.status == 200:
                        tabs = await resp.json()
                        if tabs:
                            # Use the first available tab
                            tab = tabs[0]
                            ws_url = tab['webSocketDebuggerUrl']
                            
                            # Send Chrome DevTools command to open DevTools and AI Assistant
                            # This is a basic approach - Browser Operator may have specific commands
                            print(f"   📡 Connected to tab: {tab.get('title', 'Unknown')}")
                            print(f"   🎯 DevTools should be available for evaluation setup")
                            
        except Exception as cdp_error:
            print(f"   ⚠️  Chrome DevTools Protocol connection failed: {cdp_error}")
            print(f"   💡 DevTools should still be available via --auto-open-devtools-for-tabs flag")
        
        # Alternative: Use AppleScript on macOS to send keystrokes
        if os.name == 'posix' and 'darwin' in os.uname().sysname.lower():
            try:
                # Send Cmd+Option+I to open DevTools (standard Chrome shortcut)
                # Then navigate to AI Assistant panel if it exists
                applescript = '''
                tell application "System Events"
                    -- Ensure Browser Operator is the frontmost application
                    set frontmost of first application process whose name contains "Browser Operator" to true
                    delay 0.5
                    
                    -- Open DevTools with Cmd+Option+I
                    keystroke "i" using {command down, option down}
                    delay 1
                    
                    -- Try to click on AI Assistant panel if visible
                    -- This is best-effort since panel layout may vary
                end tell
                '''
                
                # Execute AppleScript
                subprocess.run(['osascript', '-e', applescript], 
                             capture_output=True, text=True, timeout=10)
                print(f"   🍎 Sent macOS keyboard shortcuts to open DevTools")
                
            except Exception as applescript_error:
                print(f"   ⚠️  AppleScript automation failed: {applescript_error}")
    
    except Exception as e:
        print(f"   ❌ Failed to open AI Assistant panel: {e}")


async def wait_for_browser_ready(browser_pid: int, max_wait: int = 10) -> bool:
    """
    Wait for browser to be ready for DevTools commands.
    
    Args:
        browser_pid: Process ID of the browser
        max_wait: Maximum seconds to wait
        
    Returns:
        True if browser is ready, False if timeout
    """
    for i in range(max_wait):
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:9222/json', timeout=1) as resp:
                    if resp.status == 200:
                        return True
        except:
            pass
        await asyncio.sleep(1)
    return False

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
                    
                # Wait a bit for graceful shutdown
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    if hasattr(os, 'killpg'):
                        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    else:
                        process.kill()
                        
        except (OSError, ProcessLookupError):
            # Process already terminated
            pass
            
    launched_browsers.clear()

async def auto_launch_browsers(args, stack, server_config):
    """
    Automatically launch browsers for each evaluation in the stack.
    
    Args:
        args: Parsed command line arguments
        stack: EvaluationStack containing evaluations
        server_config: Server configuration dict
    """
    if not args.auto_launch:
        return
        
    print(f"\n🤖 Auto-launch mode enabled")
    print(f"   Browser path: {args.browser_path}")
    print(f"   Evaluations to process: {stack.size()}")
    
    server_url = f"ws://{server_config['host']}:{server_config['port']}"
    
    # For now, launch one browser per evaluation sequentially
    # Each browser will connect, get one evaluation, and complete it
    for i in range(stack.size()):
        if stack.is_empty():
            break
            
        print(f"\n📋 Preparing to launch browser for evaluation {i+1}/{stack.size()}")
        
        # Launch browser
        browser_process = launch_browser_operator(args.browser_path, server_url)
        if not browser_process:
            print(f"❌ Failed to launch browser for evaluation {i+1}")
            continue
            
        # Wait a moment for the browser to start up
        await asyncio.sleep(2)
        
        print(f"⏳ Browser {browser_process.pid} should connect to {server_url}")
        print(f"   Waiting for evaluation to complete...")
        
        # Note: The actual evaluation will be handled by the server's handle_client function
        # We just need to wait for the evaluation to be processed

def main():
    """Main function for the browsecomp evaluation server."""
    return asyncio.run(async_main())

async def async_main():
    """Async main function for the browsecomp evaluation server."""
    parser = argparse.ArgumentParser(description="Browsecomp Evaluation Server")
    parser.add_argument(
        "--limit", 
        type=int, 
        help="Maximum number of questions to load (default: all 1,266 questions)"
    )
    parser.add_argument(
        "--questions", 
        type=int, 
        nargs="+", 
        help="Specific question numbers to load (1-based, e.g. --questions 1 5 10)"
    )
    parser.add_argument(
        "--start", 
        type=int, 
        help="Start question number for range selection (1-based, inclusive)"
    )
    parser.add_argument(
        "--end", 
        type=int, 
        help="End question number for range selection (1-based, inclusive)"
    )
    parser.add_argument(
        "--port", 
        type=int, 
        default=8080, 
        help="Server port (default: 8080)"
    )
    parser.add_argument(
        "--host", 
        type=str, 
        default="127.0.0.1", 
        help="Server host (default: 127.0.0.1)"
    )
    parser.add_argument(
        "--auth-key", 
        type=str, 
        default="browsecomp-eval", 
        help="Authentication key (default: browsecomp-eval)"
    )
    parser.add_argument(
        "--password", 
        type=str, 
        help="Dataset decryption password (optional, auto-detected from dataset)"
    )
    parser.add_argument(
        "--list", 
        action="store_true", 
        help="List available questions without starting server"
    )
    parser.add_argument(
        "--list-limit", 
        type=int, 
        default=20, 
        help="Number of questions to show when listing (default: 20)"
    )
    parser.add_argument(
        "--save-results", 
        action="store_true", 
        help="Save evaluation results to JSON file on completion"
    )
    parser.add_argument(
        "--timeout", 
        type=float, 
        default=3600.0, 
        help="Timeout for each evaluation in seconds (default: 3600s/60min)"
    )
    parser.add_argument(
        "--run-name",
        type=str,
        help="Optional name for this evaluation run (for organizing results in Langfuse)"
    )
    parser.add_argument(
        "--auto-launch",
        action="store_true",
        help="Automatically launch Browser Operator instances for each test case"
    )
    parser.add_argument(
        "--browser-path",
        type=str,
        default="/Applications/Browser Operator.app/Contents/MacOS/Browser Operator",
        help="Path to Browser Operator executable (default: /Applications/Browser Operator.app/Contents/MacOS/Browser Operator)"
    )
    parser.add_argument(
        "--llm-judge",
        action="store_true",
        help="Enable LLM-based evaluation scoring (requires API key in .env)"
    )
    parser.add_argument(
        "--llm-model",
        type=str,
        default="gpt-4-turbo-preview",
        help="LLM model for judging (default: gpt-4-turbo-preview)"
    )
    parser.add_argument(
        "--llm-sample-rate",
        type=float,
        default=1.0,
        help="Sample rate for LLM evaluation (0.0-1.0, default: 1.0)"
    )
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging("./logs")
    
    # Handle list mode
    if args.list:
        logger.info("📋 Listing available browsecomp questions...")
        dataset = BrowsecompDataset(password=args.password)
        
        # Apply filtering for list mode if range or specific questions are specified
        if args.questions or args.start is not None or args.end is not None:
            # Load the full dataset first
            df = dataset.load_dataset()
            
            # Apply the same filtering logic as the main function
            if args.questions:
                print(f"📋 Showing specific questions: {args.questions}")
                df_filtered = dataset.get_questions(indices=args.questions)
            elif args.start is not None or args.end is not None:
                # Handle range selection (same logic as in load_browsecomp_evaluations)
                if args.start is not None and args.end is not None:
                    if args.start > args.end:
                        print(f"❌ Invalid range: start ({args.start}) cannot be greater than end ({args.end})")
                        return 1
                    if args.start < 1:
                        print(f"❌ Invalid start: question numbers are 1-based, got {args.start}")
                        return 1
                    if args.end > len(df):
                        print(f"⚠️  End question {args.end} exceeds dataset size ({len(df)}), using {len(df)} instead")
                        args.end = len(df)
                    
                    print(f"📋 Showing questions {args.start} to {args.end}")
                    range_questions = list(range(args.start, args.end + 1))
                    df_filtered = dataset.get_questions(indices=range_questions)
                elif args.start is not None:
                    if args.start < 1:
                        print(f"❌ Invalid start: question numbers are 1-based, got {args.start}")
                        return 1
                    if args.start > len(df):
                        print(f"❌ Start question {args.start} exceeds dataset size ({len(df)})")
                        return 1
                    
                    print(f"📋 Showing questions from {args.start} to end")
                    range_questions = list(range(args.start, len(df) + 1))
                    df_filtered = dataset.get_questions(indices=range_questions)
                else:  # args.end is not None
                    if args.end < 1:
                        print(f"❌ Invalid end: question numbers are 1-based, got {args.end}")
                        return 1
                    if args.end > len(df):
                        print(f"⚠️  End question {args.end} exceeds dataset size ({len(df)}), using {len(df)} instead")
                        args.end = len(df)
                    
                    print(f"📋 Showing questions 1 to {args.end}")
                    range_questions = list(range(1, args.end + 1))
                    df_filtered = dataset.get_questions(indices=range_questions)
            
            # Display filtered results
            if not df_filtered.empty:
                print("=" * 80)
                for idx, row in df_filtered.iterrows():
                    question_id = row.get('question_id', idx + 1)
                    question = row.get('question', row.get('problem_decrypted', '[Encrypted]'))
                    
                    if isinstance(question, str):
                        question_preview = question[:60] + "..." if len(question) > 60 else question
                    else:
                        question_preview = str(question)[:60] + "..."
                    
                    print(f"#{question_id:3d} {question_preview}")
                
                print(f"\nShowing {len(df_filtered)} question(s)")
            else:
                print("❌ No questions found with the specified criteria")
        else:
            # Standard list mode
            dataset.list_questions(limit=args.list_limit)
        
        return
    
    logger.info("🚀 Starting Browsecomp Evaluation Server")
    logger.info("=" * 60)
    
    # Validate arguments
    if args.questions and (args.start is not None or args.end is not None):
        print("❌ Cannot use --questions together with --start/--end. Choose one approach.")
        return 1
    
    if args.limit and (args.start is not None or args.end is not None):
        print("❌ Cannot use --limit together with --start/--end. Choose one approach.")
        return 1
    
    # Load evaluations
    evaluations = load_browsecomp_evaluations(
        limit=args.limit,
        questions=args.questions,
        start=args.start,
        end=args.end,
        password=args.password
    )
    
    if not evaluations:
        print("❌ No evaluations loaded. Exiting.")
        return 1
    
    # Create evaluation stack and populate it
    stack = EvaluationStack()
    
    print(f"\n📚 Loading {len(evaluations)} evaluations into stack...")
    for evaluation in evaluations:
        stack.push(evaluation)
    
    print(f"✅ Stack loaded with {stack.size()} evaluations")
    print(f"🔝 Top evaluation: {stack.peek()['name'] if stack.peek() else 'None'}")
    
    # Auto-launch timeout adjustment
    if args.auto_launch and args.timeout < 600:  # Less than 10 minutes
        original_timeout = args.timeout
        args.timeout = 600.0  # 10 minutes
        print(f"\n🕒 Auto-launch timeout adjustment:")
        print(f"   Original timeout: {original_timeout}s ({original_timeout/60:.1f} minutes)")
        print(f"   Adjusted timeout: {args.timeout}s ({args.timeout/60:.1f} minutes)")
        print(f"   Reason: Browsecomp evaluations need time for web research and navigation")
    
    # Check Langfuse configuration status
    print(f"\n🔧 Configuration Status:")
    langfuse_enabled = os.getenv('LANGFUSE_ENABLE', '').lower() in ('true', '1', 'yes', 'on')
    langfuse_host = os.getenv('LANGFUSE_HOST', '')
    langfuse_public_key = os.getenv('LANGFUSE_PUBLIC_KEY', '')
    langfuse_secret_key = os.getenv('LANGFUSE_SECRET_KEY', '')
    
    # Check LLM Judge configuration
    llm_judge_enabled = args.llm_judge or os.getenv('LLM_JUDGE_ENABLED', '').lower() in ('true', '1', 'yes', 'on')
    openai_api_key = os.getenv('OPENAI_API_KEY', '')
    anthropic_api_key = os.getenv('ANTHROPIC_API_KEY', '')
    llm_model = args.llm_model or os.getenv('LLM_JUDGE_MODEL', 'gpt-4-turbo-preview')
    llm_sample_rate = float(os.getenv('LLM_JUDGE_SAMPLE_RATE', args.llm_sample_rate))
    
    # Initialize LLM Judge if enabled
    llm_judge = None
    if llm_judge_enabled:
        if not HAS_LLM_SUPPORT:
            print(f"   🤖 LLM Judge: ❌ DISABLED (missing dependencies: pip install litellm openai)")
            llm_judge_enabled = False
        elif not (openai_api_key or anthropic_api_key):
            print(f"   🤖 LLM Judge: ❌ DISABLED (no API key found in .env)")
            llm_judge_enabled = False
        else:
            try:
                llm_judge = LLMJudge(
                    model=llm_model,
                    cache_enabled=os.getenv('LLM_JUDGE_CACHE_ENABLED', 'true').lower() in ('true', '1'),
                    sample_rate=llm_sample_rate,
                    confidence_threshold=float(os.getenv('LLM_JUDGE_CONFIDENCE_THRESHOLD', '0.85')),
                    max_retries=int(os.getenv('LLM_JUDGE_MAX_RETRIES', '3'))
                )
                print(f"   🤖 LLM Judge: ✅ ENABLED")
                print(f"   🎯 Model: {llm_model}")
                print(f"   📊 Sample Rate: {llm_sample_rate}")
                print(f"   🔑 API Key: {'OpenAI' if openai_api_key else 'Anthropic'} ({'✅ Set' if openai_api_key or anthropic_api_key else '❌ Missing'})")
            except Exception as e:
                print(f"   🤖 LLM Judge: ❌ FAILED to initialize: {e}")
                llm_judge_enabled = False
                llm_judge = None
    else:
        print(f"   🤖 LLM Judge: ⏸️ DISABLED (use --llm-judge to enable)")
    
    if langfuse_enabled and langfuse_host and langfuse_public_key and langfuse_secret_key:
        print(f"   📊 Langfuse Integration: ✅ ENABLED")
        print(f"   🌐 Langfuse Host: {langfuse_host}")
        print(f"   🔑 Public Key: {langfuse_public_key[:10]}..." if langfuse_public_key else "   🔑 Public Key: Not set")
        print(f"   🔐 Secret Key: {'✅ Set' if langfuse_secret_key else '❌ Not set'}")
        print(f"   📈 Evaluation scores will be uploaded to Langfuse")
    else:
        print(f"   📊 Langfuse Integration: ❌ DISABLED")
        if not langfuse_enabled:
            print(f"      • LANGFUSE_ENABLE is not 'true'")
        if not langfuse_host:
            print(f"      • LANGFUSE_HOST is not set")
        if not langfuse_public_key:
            print(f"      • LANGFUSE_PUBLIC_KEY is not set") 
        if not langfuse_secret_key:
            print(f"      • LANGFUSE_SECRET_KEY is not set")
        print(f"      📝 Edit .env file to enable Langfuse integration")
    
    # Initialize Langfuse dataset run for server-side scoring
    dataset_run_id = None
    if langfuse_enabled and langfuse_host and langfuse_public_key and langfuse_secret_key:
        try:
            print(f"📈 Initializing Langfuse dataset for server-side scoring...")
            dataset_name = "browsecomp-eval"
            description = "Shared dataset for all Browsecomp evaluations - tracks performance across different runs and models"
            dataset_run_id = create_dataset_run(dataset_name, description)
            if dataset_run_id:
                print(f"✅ Langfuse dataset ready: {dataset_run_id}")
                print(f"   📊 Dataset: {dataset_name} (shared across all runs)")
                if args.run_name:
                    print(f"   🏷️  Run name: {args.run_name}")
            else:
                print(f"⚠️  Failed to initialize Langfuse dataset (will continue without)")
        except Exception as e:
            print(f"⚠️  Error creating Langfuse dataset run: {e}")
            print(f"   Will continue without server-side Langfuse scoring")
    else:
        print(f"ℹ️  Langfuse disabled - skipping dataset run creation")
    
    # Create server
    server = EvalServer(
        auth_key=args.auth_key,
        host=args.host,
        port=args.port,
        log_level='INFO',
        log_dir='./logs',
        rpc_timeout=args.timeout,
    )
    
    # Track processed evaluations
    completed_evaluations = []
    failed_evaluations = []
    client_evaluation_map = {}  # client_id -> evaluation_id mapping
    
    print(f"\n🌐 Server Configuration:")
    print(f"   Host: {args.host}")
    print(f"   Port: {args.port}")
    print(f"   Auth Key: {args.auth_key}")
    print(f"   Timeout: {args.timeout}s ({args.timeout/60:.1f} minutes)")
    print(f"   Total Evaluations: {stack.size()}")
    
    @server.on_connect
    async def handle_client(client):
        logger.info(f'🎉 CLIENT CONNECTED!')
        logger.info(f'   - Client ID: {client.id}')
        logger.info(f'   - Client tabId: {client.tab_id}')
        logger.info(f'   - Client info: {client.get_info()}')
        
        # Log structured client connection event
        log_evaluation_event(logger, "client_connected", {
            "client_id": client.id,
            "tab_id": client.tab_id,
            "client_info": client.get_info(),
            "stack_remaining": stack.size()
        })
        
        # Check if we have evaluations left in the stack
        if stack.is_empty():
            print('⚠️  No more evaluations in stack for this client')
            print('   All browsecomp questions have been distributed')
            await client.send_message({
                "type": "no_evaluations",
                "message": "All browsecomp questions have been distributed"
            })
            return
        
        # Pop the next evaluation from the stack (ONE evaluation per client!)
        evaluation = stack.pop()
        evaluation_id = evaluation['id']
        question_id = evaluation['metadata']['question_id']
        
        print(f'📋 Assigning evaluation: "{evaluation["name"]}" (Question #{question_id})')
        print(f'📊 Remaining evaluations in stack: {stack.size()}')
        
        # Track which evaluation was sent to which client
        client_evaluation_map[client.id] = evaluation_id
        
        # Log evaluation assignment
        log_evaluation_event(logger, "evaluation_assigned", {
            "client_id": client.id,
            "evaluation_id": evaluation_id,
            "question_id": question_id,
            "evaluation_name": evaluation["name"],
            "stack_remaining": stack.size(),
            "true_answer": evaluation['metadata']['true_answer']
        })
        
        try:
            print(f'🔄 Starting evaluation... (timeout: {args.timeout}s)')
            result = await client.evaluate(evaluation, timeout=args.timeout)
            
            print('✅ Evaluation completed!')
            
            # Extract the true answer from evaluation metadata
            true_answer = evaluation['metadata']['true_answer']
            
            # Check if this is a partial result with errors
            is_partial_result = (isinstance(result, dict) and 
                               result.get('partial') and 
                               result.get('error'))
            
            # Extract the actual response text from the structured format
            response_text = extract_response_text(result)
            
            # Show structured response details if available
            if isinstance(result, dict) and 'messages' in result:
                message_count = len(result.get('messages', []))
                model_used = result.get('modelUsed', 'unknown')
                execution_time = result.get('executionTime', 0)
                tool_calls = len(result.get('toolCalls', []))
                print(f'📊 Response structure: {message_count} messages, {tool_calls} tool calls, {model_used} model, {execution_time}ms')
            else:
                print(f'📊 Response for "{evaluation["name"]}": {response_text[:100]}...')
            
            # Extract data for enhanced scoring
            messages = result.get('messages', []) if isinstance(result, dict) else []
            tool_calls = result.get('toolCalls', []) if isinstance(result, dict) else []
            execution_time = result.get('executionTime', 0) if isinstance(result, dict) else 0
            
            # Score the response with enhanced scoring system
            enhanced_scores = enhanced_question_scorer(
                prediction=response_text,
                true_answer=true_answer,
                messages=messages,
                tool_calls=tool_calls,
                execution_time_ms=execution_time
            )
            
            # Run LLM Judge evaluation if enabled
            llm_scores = {}
            if llm_judge_enabled and llm_judge:
                try:
                    print(f'🤖 Running LLM Judge evaluation with {llm_model}...')
                    llm_scores = await llm_judge.evaluate_comprehensive(
                        question=evaluation['input']['message'],
                        true_answer=true_answer,
                        response=response_text,
                        messages=messages,
                        tool_calls=tool_calls,
                        execution_time_ms=execution_time
                    )
                    print(f'✅ LLM Judge evaluation completed')
                    if llm_scores.get('average_confidence', 0) < llm_judge.confidence_threshold:
                        print(f'⚠️  Low confidence LLM evaluation (confidence: {llm_scores.get("average_confidence", 0):.2f})')
                except Exception as e:
                    print(f'⚠️  LLM Judge evaluation failed: {e}')
                    llm_scores = {"error": str(e)}
            
            # Combine all scoring systems
            all_scores = {**enhanced_scores, **llm_scores}
            
            # Extract values for backward compatibility
            is_correct = enhanced_scores.get('correctness_binary', 0.0) == 1.0
            extracted_answer = extract_answer(response_text)
            confidence = extract_confidence(response_text)
            
            # Create enhanced scorer for detailed reporting
            scorer = EnhancedScorer()
            score_report = scorer.format_score_report(enhanced_scores)
            print(score_report)
            
            # Print LLM Judge results if available
            if llm_scores and 'error' not in llm_scores:
                print(f'\n🤖 LLM Judge Results ({llm_model}):')
                if 'overall_score_llm' in llm_scores:
                    print(f'   Overall Score:      {llm_scores["overall_score_llm"]:4.1f}/10')
                if 'quality_score_llm' in llm_scores:
                    print(f'   Quality Score:      {llm_scores["quality_score_llm"]:4.1f}/10')
                if 'average_confidence' in llm_scores:
                    print(f'   Average Confidence: {llm_scores["average_confidence"]:4.1f}')
                    
                # Show individual dimension scores
                for dimension in ['correctness', 'evidence_quality', 'reasoning_quality', 'task_completion', 'efficiency']:
                    key = f'{dimension}_llm'
                    if key in llm_scores and isinstance(llm_scores[key], dict):
                        score = llm_scores[key].get('score', 0)
                        confidence = llm_scores[key].get('confidence', 0)
                        print(f'   {dimension.replace("_", " ").title()}: {score:4.1f}/10 (conf: {confidence:.2f})')
            elif llm_scores and 'error' in llm_scores:
                print(f'\n🤖 LLM Judge: ❌ Error - {llm_scores["error"]}')
            
            # Print traditional results for comparison
            print(f'\n📋 Traditional Results:')
            print(f'   - True Answer: {true_answer}')
            print(f'   - Extracted Answer: {extracted_answer}')
            print(f'   - Binary Correct: {"✅ YES" if is_correct else "❌ NO"}')
            print(f'   - Confidence: {confidence}%')
            
            if is_partial_result:
                print(f'⚠️  Note: Result obtained after retries with errors:')
                print(f'   - Error: {result.get("error", "Unknown error")}')
                print(f'   - Attempts: {result.get("attempts", "Unknown")}')
                print(f'   - The BrowserOperator had issues but provided a response')
            
            # Log evaluation completion with all scores
            log_evaluation_event(logger, "evaluation_completed", {
                "client_id": client.id,
                "evaluation_id": evaluation_id,
                "question_id": question_id,
                "evaluation_name": evaluation["name"],
                "is_correct": is_correct,
                "extracted_answer": extracted_answer,
                "true_answer": true_answer,
                "confidence": confidence,
                "is_partial_result": is_partial_result,
                "model_used": result.get('modelUsed') if isinstance(result, dict) else None,
                "execution_time_ms": result.get('executionTime') if isinstance(result, dict) else None,
                "tool_calls_count": len(result.get('toolCalls', [])) if isinstance(result, dict) else None,
                # All scoring metrics
                "all_scores": all_scores,
                "llm_judge_enabled": llm_judge_enabled
            })
            
            # Upload score to Langfuse dataset if enabled
            if dataset_run_id:
                try:
                    print(f'📈 Uploading server score to Langfuse dataset...')
                    score_dataset_item(
                        dataset_name=dataset_run_id,
                        item_id=evaluation_id,
                        input_data={
                            'question': evaluation['input']['message'],
                            'question_id': question_id,
                            'true_answer': true_answer,
                        },
                        output_data={'response': response_text},
                        scores={
                            # Traditional scores (for backward compatibility)
                            'correctness': 1.0 if is_correct else 0.0,
                            'confidence': confidence / 100.0,  # Normalize to 0-1
                            'has_partial_result': 1.0 if is_partial_result else 0.0,
                            
                            # Enhanced 10-point scores (rule-based)
                            'correctness_10': enhanced_scores.get('correctness_10', 0.0),
                            'task_completion_10': enhanced_scores.get('task_completion_10', 0.0),
                            'evidence_quality_10': enhanced_scores.get('evidence_quality_10', 0.0),
                            'reasoning_quality_10': enhanced_scores.get('reasoning_quality_10', 0.0),
                            'tool_efficiency_10': enhanced_scores.get('tool_efficiency_10', 0.0),
                            
                            # Composite scores (rule-based)
                            'overall_score_10': enhanced_scores.get('overall_score_10', 0.0),
                            'quality_score_10': enhanced_scores.get('quality_score_10', 0.0),
                            'efficiency_score_10': enhanced_scores.get('efficiency_score_10', 0.0),
                            
                            # LLM Judge scores (if available)
                            **({
                                'llm_overall_score': llm_scores.get('overall_score_llm', 0.0),
                                'llm_quality_score': llm_scores.get('quality_score_llm', 0.0),
                                'llm_efficiency_score': llm_scores.get('efficiency_score_llm', 0.0),
                                'llm_confidence': llm_scores.get('average_confidence', 0.0),
                                'llm_correctness': llm_scores.get('correctness_llm', {}).get('score', 0.0),
                                'llm_evidence_quality': llm_scores.get('evidence_quality_llm', {}).get('score', 0.0),
                                'llm_reasoning_quality': llm_scores.get('reasoning_quality_llm', {}).get('score', 0.0),
                                'llm_task_completion': llm_scores.get('task_completion_llm', {}).get('score', 0.0),
                                'llm_efficiency': llm_scores.get('efficiency_llm', {}).get('score', 0.0),
                            } if llm_scores and 'error' not in llm_scores else {
                                'llm_judge_enabled': llm_judge_enabled,
                                'llm_judge_error': llm_scores.get('error', 'Not enabled') if llm_scores else 'Not enabled'
                            })
                        },
                        metadata={
                            'client_id': client.id,
                            'evaluation_name': evaluation["name"],
                            'model_used': result.get('modelUsed') if isinstance(result, dict) else None,
                            'execution_time_ms': result.get('executionTime') if isinstance(result, dict) else None,
                            'extracted_answer': extracted_answer,
                            # Run metadata for organizing results
                            'run_timestamp': datetime.now().isoformat(),
                            'run_name': args.run_name or 'unnamed-run',
                            'server_session': f"{args.host}:{args.port}",
                            'total_questions_in_session': len(evaluations),
                        }
                    )
                    print(f'✅ Successfully uploaded server score to Langfuse')
                except Exception as e:
                    print(f'⚠️  Failed to upload server score to Langfuse: {e}')
            
            # Create and score Langfuse traces for dashboard visibility
            if dataset_run_id:
                try:
                    print(f'🔗 Creating Langfuse trace for evaluation...')
                    
                    # Extract trace_id from client result if available
                    client_trace_id = None
                    if isinstance(result, dict):
                        client_trace_id = result.get('traceId')
                    
                    # Create a server-side trace for this evaluation
                    server_trace_id = create_trace(
                        name=f"Browsecomp: {evaluation['name']}",
                        input_data={
                            'question': evaluation['input']['message'],
                            'question_id': question_id,
                            'true_answer': true_answer,
                        },
                        metadata={
                            'client_id': client.id,
                            'evaluation_id': evaluation_id,
                            'evaluation_name': evaluation['name'],
                            'model_used': result.get('modelUsed') if isinstance(result, dict) else None,
                            'execution_time_ms': result.get('executionTime') if isinstance(result, dict) else None,
                        }
                    )
                    
                    if server_trace_id:
                        # Score the server trace with traditional scores
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='server_accuracy',
                            value=1.0 if is_correct else 0.0,
                            comment=f"Server-side scoring: {'Correct' if is_correct else 'Incorrect'}"
                        )
                        
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='confidence_score',
                            value=confidence / 100.0,
                            comment=f"Extracted confidence: {confidence}%"
                        )
                        
                        # Add enhanced 10-point scores
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='overall_score_10',
                            value=enhanced_scores.get('overall_score_10', 0.0) / 10.0,  # Normalize to 0-1
                            comment=f"Overall 10-point score: {enhanced_scores.get('overall_score_10', 0.0):.1f}/10"
                        )
                        
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='quality_score_10',
                            value=enhanced_scores.get('quality_score_10', 0.0) / 10.0,
                            comment=f"Quality score (correctness+evidence+reasoning): {enhanced_scores.get('quality_score_10', 0.0):.1f}/10"
                        )
                        
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='efficiency_score_10',
                            value=enhanced_scores.get('efficiency_score_10', 0.0) / 10.0,
                            comment=f"Efficiency score (completion+tools): {enhanced_scores.get('efficiency_score_10', 0.0):.1f}/10"
                        )
                        
                        print(f'✅ Created and scored server trace: {server_trace_id[:12]}...')
                    
                    # Also score client trace if available
                    if client_trace_id:
                        score_agent_trace(
                            trace_id=client_trace_id,
                            name='server_accuracy',
                            value=1.0 if is_correct else 0.0,
                            comment=f"Server-side scoring: {'Correct' if is_correct else 'Incorrect'}"
                        )
                        
                        score_agent_trace(
                            trace_id=client_trace_id,
                            name='overall_score_10',
                            value=enhanced_scores.get('overall_score_10', 0.0) / 10.0,
                            comment=f"Overall 10-point score: {enhanced_scores.get('overall_score_10', 0.0):.1f}/10"
                        )
                        
                        print(f'✅ Scored client trace: {client_trace_id[:12]}...')
                        
                except Exception as e:
                    print(f'⚠️  Failed to create/score Langfuse traces: {e}')
            
            completed_evaluations.append({
                'client_id': client.id,
                'evaluation': evaluation,
                'result': result,
                'question_id': question_id,
                'scoring': {
                    'is_correct': is_correct,
                    'true_answer': true_answer,
                    'extracted_answer': extracted_answer,
                    'confidence': confidence
                },
                'partial_result': is_partial_result,
                'execution_info': {
                    'had_errors': is_partial_result,
                    'error_message': result.get('error') if is_partial_result else None,
                    'retry_attempts': result.get('attempts') if is_partial_result else 1,
                    'model_used': result.get('modelUsed') if isinstance(result, dict) else None,
                    'execution_time_ms': result.get('executionTime') if isinstance(result, dict) else None,
                    'tool_calls_count': len(result.get('toolCalls', [])) if isinstance(result, dict) else None,
                    'messages_count': len(result.get('messages', [])) if isinstance(result, dict) else None
                }
            })
            
        except Exception as e:
            error_msg = str(e)
            print(f'❌ Evaluation "{evaluation["name"]}" failed: {error_msg}')
            
            # Check if this is a tool execution error that might still be running
            if "Tool execution failed" in error_msg or "-32000" in error_msg:
                print(f'⚠️  Note: BrowserOperator may still be processing this question')
                print(f'   The client reported an error but might continue execution')
                print(f'   Consider increasing timeout with --timeout parameter')
            
            # Try to extract partial response from error for scoring
            response_text = ''
            partial_result = None
            
            # Attempt to extract response from RPC error if available
            if hasattr(e, 'response') and isinstance(e.response, dict):
                partial_result = e.response
                response_text = partial_result.get('output', '')
            elif hasattr(e, 'partial_response'):
                response_text = e.partial_response
            
            # Score even failed evaluations if there's any response text
            is_correct = False
            extracted_answer = None
            confidence = 0
            
            if response_text:
                print(f'📊 Attempting to score partial response: {response_text[:100]}...')
                try:
                    is_correct = question_scorer(response_text, true_answer)
                    extracted_answer = extract_answer(response_text)
                    confidence = extract_confidence(response_text)
                    
                    print(f'🎯 Partial Scoring Results:')
                    print(f'   - True Answer: {true_answer}')
                    print(f'   - Extracted Answer: {extracted_answer}')
                    print(f'   - Correct: {"✅ YES" if is_correct else "❌ NO"}')
                    print(f'   - Confidence: {confidence}%')
                except Exception as scoring_error:
                    print(f'⚠️  Failed to score partial response: {scoring_error}')
            else:
                print(f'❌ No response text available for scoring')
            
            # Log evaluation failure with scoring info
            log_evaluation_event(logger, "evaluation_failed", {
                "client_id": client.id,
                "evaluation_id": evaluation_id,
                "question_id": question_id,
                "evaluation_name": evaluation["name"],
                "error_message": error_msg,
                "is_tool_execution_error": "Tool execution failed" in error_msg or "-32000" in error_msg,
                "true_answer": evaluation['metadata']['true_answer'],
                "is_correct": is_correct,
                "extracted_answer": extracted_answer,
                "confidence": confidence,
                "had_partial_response": bool(response_text)
            })
            
            # Upload score to Langfuse dataset for failed evaluation if enabled
            if dataset_run_id:
                try:
                    print(f'📈 Uploading failed evaluation score to Langfuse dataset...')
                    score_dataset_item(
                        dataset_name=dataset_run_id,
                        item_id=evaluation_id,
                        input_data={
                            'question': evaluation['input']['message'],
                            'question_id': question_id,
                            'true_answer': true_answer,
                        },
                        output_data={
                            'response': response_text,
                            'error': error_msg,
                            'status': 'failed'
                        },
                        scores={
                            'correctness': 1.0 if is_correct else 0.0,
                            'confidence': confidence / 100.0,  # Normalize to 0-1
                            'evaluation_failed': 1.0,
                            'had_partial_response': 1.0 if bool(response_text) else 0.0,
                        },
                        metadata={
                            'client_id': client.id,
                            'evaluation_name': evaluation["name"],
                            'error_message': error_msg,
                            'is_tool_execution_error': "Tool execution failed" in error_msg or "-32000" in error_msg,
                            'extracted_answer': extracted_answer,
                            # Run metadata for organizing results
                            'run_timestamp': datetime.now().isoformat(),
                            'run_name': args.run_name or 'unnamed-run',
                            'server_session': f"{args.host}:{args.port}",
                            'total_questions_in_session': len(evaluations),
                        }
                    )
                    print(f'✅ Successfully uploaded failed evaluation score to Langfuse')
                except Exception as e:
                    print(f'⚠️  Failed to upload failed evaluation score to Langfuse: {e}')
            
            # Create and score Langfuse traces for failed evaluations
            if dataset_run_id:
                try:
                    print(f'🔗 Creating Langfuse trace for failed evaluation...')
                    
                    # Create a server-side trace for this failed evaluation
                    server_trace_id = create_trace(
                        name=f"Browsecomp (FAILED): {evaluation['name']}",
                        input_data={
                            'question': evaluation['input']['message'],
                            'question_id': question_id,
                            'true_answer': true_answer,
                        },
                        metadata={
                            'client_id': client.id,
                            'evaluation_id': evaluation_id,
                            'evaluation_name': evaluation['name'],
                            'status': 'failed',
                            'error_message': error_msg,
                        }
                    )
                    
                    if server_trace_id:
                        # Score the failed trace
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='server_accuracy',
                            value=1.0 if is_correct else 0.0,
                            comment=f"Failed evaluation - Server scoring: {'Correct' if is_correct else 'Incorrect'}"
                        )
                        
                        score_agent_trace(
                            trace_id=server_trace_id,
                            name='evaluation_failed',
                            value=1.0,
                            comment=f"Evaluation failed: {error_msg}"
                        )
                        
                        if confidence > 0:
                            score_agent_trace(
                                trace_id=server_trace_id,
                                name='confidence_score',
                                value=confidence / 100.0,
                                comment=f"Extracted confidence: {confidence}%"
                            )
                        
                        print(f'✅ Created and scored failed trace: {server_trace_id[:12]}...')
                        
                except Exception as e:
                    print(f'⚠️  Failed to create/score failed Langfuse traces: {e}')
            
            failed_evaluations.append({
                'client_id': client.id,
                'evaluation': evaluation,
                'error': error_msg,
                'question_id': question_id,
                'scoring': {
                    'is_correct': is_correct,
                    'true_answer': true_answer,
                    'extracted_answer': extracted_answer,
                    'confidence': confidence,
                    'had_partial_response': bool(response_text)
                }
            })
        
        # Send completion message
        try:
            await client.send_message({
                "type": "evaluation_complete",
                "evaluation_id": evaluation_id,
                "evaluation_name": evaluation["name"],
                "question_id": question_id,
                "status": "completed" if evaluation_id not in [e['evaluation']['id'] for e in failed_evaluations] else "failed"
            })
        except Exception as e:
            print(f'   ⚠️  Failed to send completion message: {e}')
    
    @server.on_disconnect
    async def handle_disconnect(client_info):
        client_id = client_info["id"]
        print(f'\n🔌 Client disconnected: {client_id}')
        
        # Show what evaluation this client was working on
        evaluation_id = None
        if client_id in client_evaluation_map:
            evaluation_id = client_evaluation_map[client_id]
            print(f'   Was working on: {evaluation_id}')
        
        # Log client disconnect
        log_evaluation_event(logger, "client_disconnected", {
            "client_id": client_id,
            "evaluation_id": evaluation_id,
            "completed_count": len(completed_evaluations),
            "failed_count": len(failed_evaluations),
            "stack_remaining": stack.size()
        })
        
        # Show final statistics
        total_completed = len(completed_evaluations)
        total_failed = len(failed_evaluations)
        remaining = stack.size()
        total_original = len(evaluations)
        
        print(f'\n📊 Current Statistics:')
        print(f'   ✅ Completed: {total_completed}/{total_original}')
        print(f'   ❌ Failed: {total_failed}/{total_original}')
        print(f'   📚 Remaining: {remaining}/{total_original}')
        print(f'   🔄 In Progress: {total_original - total_completed - total_failed - remaining}')
        
        # Calculate scoring statistics
        if completed_evaluations:
            correct_count = sum(1 for item in completed_evaluations if item.get('scoring', {}).get('is_correct', False))
            partial_count = sum(1 for item in completed_evaluations if item.get('partial_result', False))
            accuracy = correct_count / total_completed * 100 if total_completed > 0 else 0
            avg_confidence = sum(item.get('scoring', {}).get('confidence', 0) for item in completed_evaluations) / total_completed if total_completed > 0 else 0
            
            print(f'\n🎯 Scoring Statistics:')
            print(f'   📊 Accuracy: {accuracy:.1f}% ({correct_count}/{total_completed} correct)')
            print(f'   💡 Average Confidence: {avg_confidence:.1f}%')
            if partial_count > 0:
                print(f'   ⚠️  Partial Results: {partial_count}/{total_completed} had execution errors but recovered')
        
        if completed_evaluations:
            print(f'\n🎯 Recently Completed Evaluations:')
            for item in completed_evaluations[-3:]:  # Show last 3
                eval_name = item['evaluation']['name']
                question_id = item['question_id']
                client_id_short = item['client_id'][:8]  # Short client ID
                is_correct = item.get('scoring', {}).get('is_correct', False)
                confidence = item.get('scoring', {}).get('confidence', 0)
                is_partial = item.get('partial_result', False)
                status_emoji = '✅' if is_correct else '❌'
                partial_indicator = '⚠️' if is_partial else ''
                print(f'   • Q{question_id}: {eval_name} {status_emoji}{partial_indicator} (confidence: {confidence}%, client: {client_id_short})')
        
        if failed_evaluations:
            print(f'\n💥 Failed Evaluations:')
            for item in failed_evaluations:
                eval_name = item['evaluation']['name']
                question_id = item['question_id']
                error = item['error']
                print(f'   • Q{question_id}: {eval_name} - {error}')
    
    # Set up auto-launch if enabled
    auto_launch_task = None
    if args.auto_launch:
        print(f"🤖 Auto-launch enabled - preparing to launch Browser Operator")
        server_config = {
            'host': server.config.host,
            'port': server.config.port
        }
        
        # Set up cleanup on exit
        def signal_handler(signum, frame):
            print(f'\n🛑 Received signal {signum}, cleaning up browsers...')
            cleanup_browsers()
            raise KeyboardInterrupt()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    # Start server
    try:
        print(f'\n🚀 Starting server on ws://{server.config.host}:{server.config.port}')
        if not args.auto_launch:
            print('   Connect your BrowserOperator to start processing browsecomp questions')
        print('   Press Ctrl+C to stop the server')
        print('=' * 60)
        
        # Start server and auto-launch task concurrently
        if args.auto_launch:
            print(f"🔄 Starting auto-launch task...")
            try:
                auto_launch_task = asyncio.create_task(auto_launch_browsers(args, stack, server_config))
                print(f"✅ Auto-launch task created successfully")
            except Exception as e:
                print(f"❌ Failed to create auto-launch task: {e}")
                import traceback
                traceback.print_exc()
        
        await server.start()
        
        # Keep server running
        await server.wait_closed()
        
    except KeyboardInterrupt:
        print('\n🛑 Received interrupt signal, stopping server...')
        cleanup_browsers()
        if auto_launch_task and not auto_launch_task.done():
            auto_launch_task.cancel()
        await server.stop()
        print('✅ Server stopped successfully')
        
        # Show final summary
        total_completed = len(completed_evaluations)
        total_failed = len(failed_evaluations)
        total_processed = total_completed + total_failed
        
        if total_processed > 0:
            print(f'\n📈 Final Summary:')
            print(f'   Total processed: {total_processed}/{len(evaluations)}')
            print(f'   Success rate: {total_completed/total_processed*100:.1f}%')
            print(f'   Completed: {total_completed}')
            print(f'   Failed: {total_failed}')
            
            # Final scoring statistics
            if completed_evaluations:
                correct_count = sum(1 for item in completed_evaluations if item.get('scoring', {}).get('is_correct', False))
                accuracy = correct_count / total_completed * 100 if total_completed > 0 else 0
                avg_confidence = sum(item.get('scoring', {}).get('confidence', 0) for item in completed_evaluations) / total_completed if total_completed > 0 else 0
                
                print(f'\n🏆 Final Scoring Results:')
                print(f'   📊 Overall Accuracy: {accuracy:.1f}% ({correct_count}/{total_completed} correct)')
                print(f'   💡 Average Confidence: {avg_confidence:.1f}%')
                
                # Show confidence correlation
                correct_items = [item for item in completed_evaluations if item.get('scoring', {}).get('is_correct', False)]
                incorrect_items = [item for item in completed_evaluations if not item.get('scoring', {}).get('is_correct', False)]
                
                if correct_items:
                    avg_conf_correct = sum(item.get('scoring', {}).get('confidence', 0) for item in correct_items) / len(correct_items)
                    print(f'   ✅ Avg confidence when correct: {avg_conf_correct:.1f}%')
                
                if incorrect_items:
                    avg_conf_incorrect = sum(item.get('scoring', {}).get('confidence', 0) for item in incorrect_items) / len(incorrect_items)
                    print(f'   ❌ Avg confidence when incorrect: {avg_conf_incorrect:.1f}%')
                
                # Save results to JSON file
                if completed_evaluations and (args.save_results or total_completed == len(evaluations)):
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    results_file = f"browsecomp_eval_results_{timestamp}.json"
                    
                    results_data = {
                        "timestamp": timestamp,
                        "total_questions": len(evaluations),
                        "completed": total_completed,
                        "failed": total_failed,
                        "accuracy": accuracy,
                        "average_confidence": avg_confidence,
                        "evaluations": completed_evaluations
                    }
                    
                    with open(results_file, 'w') as f:
                        json.dump(results_data, f, indent=2)
                    
                    print(f'\n💾 Results saved to: {results_file}')
                
                # Log final session summary
                log_evaluation_event(logger, "session_completed", {
                    "total_questions": len(evaluations),
                    "completed": total_completed,
                    "failed": total_failed,
                    "accuracy": accuracy,
                    "average_confidence": avg_confidence,
                    "partial_results": partial_count,
                    "results_file": results_file if 'results_file' in locals() else None
                })
        
    except Exception as e:
        logger.error(f'💥 Server error: {e}')
        log_evaluation_event(logger, "server_error", {
            "error_message": str(e),
            "completed_count": len(completed_evaluations),
            "failed_count": len(failed_evaluations)
        })
        
        if server.is_running():
            await server.stop()
        return 1
    
    logger.info("✅ Server session ended successfully")
    return 0


if __name__ == "__main__":
    # Ensure logs directory exists
    Path("./logs").mkdir(exist_ok=True)
    
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print('\n👋 Goodbye!')
    except Exception as e:
        print(f'💥 Fatal error: {e}')
        sys.exit(1)