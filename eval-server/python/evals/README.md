# Python Evaluation Scripts

This directory contains evaluation scripts for running various benchmark datasets using the Python eval-server.

## Available Scripts

### Browsecomp Evaluation Server

**Script**: `browsecomp_eval_server.py`  
**Wrapper**: `run_browsecomp_eval_server.sh`

The browsecomp eval server loads questions from the [Browsecomp benchmark](https://github.com/openai/simple-evals) and distributes them to connected BrowserOperator clients via WebSocket connections.

#### Features

- Loads and decrypts 1,266 browsecomp questions automatically
- Distributes exactly one question per client connection
- Stack-based LIFO distribution
- **Automatic scoring**: Compares responses against true answers
- **Structured response parsing**: Handles BrowserOperator's message format
- **Comprehensive logging**: Structured logs saved to timestamped files
- Real-time progress tracking with accuracy metrics  
- Confidence score extraction and analysis
- Results saved to JSON file for later analysis
- Configurable timeout (default: 60 minutes)
- Configurable server settings

#### Usage

```bash
# Use the wrapper script for proper dependencies
./run_browsecomp_eval_server.sh --help

# List available questions
./run_browsecomp_eval_server.sh --list --list-limit 10

# Start server with first 5 questions
./run_browsecomp_eval_server.sh --limit 5

# Start server with specific questions
./run_browsecomp_eval_server.sh --questions 1 5 10 25

# Start server with a range of questions (questions 10-15)
./run_browsecomp_eval_server.sh --start 10 --end 15

# Start server from question 100 to the end
./run_browsecomp_eval_server.sh --start 100

# Start server with questions 1-50
./run_browsecomp_eval_server.sh --end 50

# Start server with all 1,266 questions
./run_browsecomp_eval_server.sh

# Custom configuration
./run_browsecomp_eval_server.sh --limit 20 --port 8081 --auth-key my-key

# Save results to JSON file
./run_browsecomp_eval_server.sh --limit 10 --save-results
```

#### How It Works

1. **Load Questions**: The server loads browsecomp questions from the dataset
2. **Stack Distribution**: Questions are placed in a LIFO stack
3. **Client Connection**: When a BrowserOperator connects, it receives one question
4. **Processing**: The client processes the question and returns results
5. **Automatic Scoring**: Server compares responses against true answers
6. **Tracking**: Server tracks completion, accuracy, and confidence statistics
7. **Results**: Optionally saves detailed results to JSON file

#### Example Workflow

```bash
# Terminal 1: Start the eval server
cd /path/to/eval-server/python/evals
./run_browsecomp_eval_server.sh --limit 10 --save-results

# Terminal 2+: Connect BrowserOperator clients
# Each client will automatically receive and process one question
```

#### Scoring Output

When evaluations complete, you'll see automatic scoring results:

```
✅ Evaluation completed!
📊 Response structure: 12 messages, 3 tool calls, gpt-4 model, 45230ms

🎯 Scoring Results:
   - True Answer: 1988-96
   - Extracted Answer: 1988-96
   - Correct: ✅ YES
   - Confidence: 85%

📊 Current Statistics:
   ✅ Completed: 5/10
   ❌ Failed: 0/10
   📚 Remaining: 5/10

🎯 Scoring Statistics:
   📊 Accuracy: 80.0% (4/5 correct)
   💡 Average Confidence: 78.5%
```

#### Results JSON Format

When using `--save-results`, evaluations are saved to `browsecomp_eval_results_[timestamp].json`:

```json
{
  "timestamp": "20240115_143022",
  "total_questions": 10,
  "completed": 10,
  "failed": 0,
  "accuracy": 80.0,
  "average_confidence": 78.5,
  "evaluations": [
    {
      "client_id": "abc123...",
      "question_id": 1,
      "result": "Explanation: ... Exact Answer: 1988-96 Confidence Score: 85%",
      "scoring": {
        "is_correct": true,
        "true_answer": "1988-96",
        "extracted_answer": "1988-96",
        "confidence": 85
      }
    }
  ]
}
```

#### Logging

The server creates comprehensive logs in the `./logs/` directory:

- **Console Output**: Real-time progress with emojis and summaries
- **Structured Logs**: Timestamped log file `browsecomp_eval_server_YYYYMMDD_HHMMSS.log`

**Structured Log Events**:
```
EVENT: {"timestamp": "2024-01-15T14:30:22", "event_type": "client_connected", "client_id": "abc123", "stack_remaining": 10}
EVENT: {"timestamp": "2024-01-15T14:30:25", "event_type": "evaluation_assigned", "evaluation_id": "browsecomp_q1", "question_id": 1}
EVENT: {"timestamp": "2024-01-15T14:32:10", "event_type": "evaluation_completed", "is_correct": true, "confidence": 85, "model_used": "gpt-4"}
EVENT: {"timestamp": "2024-01-15T14:35:00", "event_type": "session_completed", "accuracy": 80.0, "total_questions": 10}
```

**Log Files Location**: 
- `./logs/browsecomp_eval_server_YYYYMMDD_HHMMSS.log` - Main server log
- `./logs/` - Directory also used by eval-server's internal logging

### WebVoyager Evaluation Server

**Script**: `webvoyager_eval_server.py`  
**Wrapper**: `run_webvoyager_eval_server.sh`

The WebVoyager eval server loads tasks from the [WebVoyager benchmark](https://arxiv.org/abs/2401.13919) and distributes them to connected BrowserOperator clients via WebSocket connections. WebVoyager provides diverse web navigation tasks across 15 real-world websites.

#### Features

- Loads 643 WebVoyager tasks across 15 websites automatically
- Distributes exactly one task per client connection
- Stack-based LIFO distribution
- **GPT-4V multimodal scoring**: Uses screenshots + text responses for evaluation
- **Website filtering**: Target specific websites or task ranges
- **Structured response parsing**: Handles BrowserOperator's message format
- **Comprehensive logging**: Structured logs saved to timestamped files
- Real-time progress tracking with success rate metrics
- Results saved to JSON file for later analysis
- Configurable timeout (default: 60 minutes)
- Configurable server settings

#### Usage

```bash
# Use the wrapper script for proper dependencies
./run_webvoyager_eval_server.sh --help

# List all available tasks
./run_webvoyager_eval_server.sh --list --list-limit 10

# List tasks for specific websites
./run_webvoyager_eval_server.sh --list --websites GitHub Amazon --list-limit 5

# Start server with first 5 tasks
./run_webvoyager_eval_server.sh --limit 5

# Start server with specific websites
./run_webvoyager_eval_server.sh --websites GitHub Amazon Apple

# Start server with specific task IDs
./run_webvoyager_eval_server.sh --task-ids 1 25 50 100

# Start server with task range (tasks 10-20)
./run_webvoyager_eval_server.sh --start 10 --end 20

# Start server with GPT-4V scoring enabled
./run_webvoyager_eval_server.sh --limit 10 --openai-api-key sk-xxx --save-results

# Custom configuration with timeout
./run_webvoyager_eval_server.sh --websites GitHub --limit 5 --port 8081 --timeout 1800
```

#### Available Websites

WebVoyager includes tasks for 15 diverse websites:
- **E-commerce**: Amazon, Apple
- **Food/Recipes**: Allrecipes
- **Travel/Booking**: Booking, Google Flights, Google Map
- **News/Information**: BBC News, ArXiv
- **Development**: GitHub, Huggingface
- **Education**: Coursera, Cambridge Dictionary
- **Entertainment**: ESPN
- **Search/Tools**: Google Search, Wolfram Alpha

#### GPT-4V Multimodal Scoring

WebVoyager uses GPT-4V for automatic evaluation, combining:
- **Text Response**: Agent's final answer/summary
- **Screenshots**: Visual evidence of task completion (up to 3 final screenshots)
- **Task Context**: Original task instructions

The scorer determines success/failure and extracts confidence scores using the same evaluation criteria as the original WebVoyager paper.

#### How It Works

1. **Load Tasks**: Server loads WebVoyager tasks from dataset (643 total)
2. **Filter Tasks**: Apply website/ID/range filters as specified
3. **Stack Distribution**: Tasks are placed in a LIFO stack
4. **Client Connection**: When a BrowserOperator connects, it receives one task
5. **Task Execution**: Client navigates website and completes the task
6. **GPT-4V Scoring**: Server evaluates using screenshots + text response
7. **Progress Tracking**: Server tracks completion and success rate statistics
8. **Results Export**: Optionally saves detailed results to JSON file

#### Example Workflow

```bash
# Terminal 1: Start the eval server with GitHub tasks and GPT-4V scoring
cd /path/to/eval-server/python/evals
./run_webvoyager_eval_server.sh --websites GitHub --limit 5 --openai-api-key sk-xxx --save-results

# Terminal 2+: Connect BrowserOperator clients
# Each client will automatically receive and process one GitHub task
# GPT-4V will evaluate task completion using screenshots and responses
```

#### Scoring Output

When evaluations complete with GPT-4V scoring enabled, you'll see results like:

```
✅ Evaluation completed!
📊 Response structure: 15 messages, 8 tool calls, gpt-4 model, 125230ms

🎯 GPT-4V Scoring Results:
   - Success: True
   - Confidence: 85%
   - Reasoning: The agent successfully navigated to GitHub, searched for the specified repository...

📊 Current Statistics:
   ✅ Completed: 3/5
   ❌ Failed: 0/5
   📚 Remaining: 2/5

🎯 GPT-4V Scoring Statistics:
   📊 Success Rate: 66.7% (2/3 successful)
   💡 Average Confidence: 78.5%
```

#### Prerequisites

- **WebVoyager Dataset**: Requires the WebVoyager repository at `/Users/olehluchkiv/Work/browser/WebVoyager/`
- **OpenAI API Key**: Required for GPT-4V scoring (optional, but recommended)
- **Dependencies**: OpenAI Python client is automatically installed

#### Results JSON Format

When using `--save-results`, evaluations are saved to `webvoyager_eval_results_[timestamp].json`:

```json
{
  "timestamp": "20240115_143022",
  "total_tasks": 5,
  "completed": 5,
  "failed": 0,
  "gpt4v_scoring_enabled": true,
  "gpt4v_accuracy": 80.0,
  "gpt4v_average_confidence": 78.5,
  "website_stats": {
    "GitHub": {"total": 3, "success": 2},
    "Amazon": {"total": 2, "success": 2}
  },
  "evaluations": [...]
}
```

## Dependencies

The evaluation scripts require additional dependencies beyond the base eval-server:
- `pandas` - For dataset loading and manipulation
- `requests` - For downloading datasets
- `openai` - For GPT-4V multimodal scoring (WebVoyager)

These are automatically installed when you run `uv sync` in the eval-server/python directory.

## Adding New Evaluation Scripts

To add a new evaluation script:

1. Create your script in this directory
2. Import the eval-server modules:
   ```python
   import sys
   from pathlib import Path
   sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
   from bo_eval_server import EvalServer, EvaluationStack
   ```

3. Create a wrapper script for easy execution:
   ```bash
   #!/bin/bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   cd "$SCRIPT_DIR/.."
   uv run python evals/your_script.py "$@"
   ```

4. Make the wrapper executable: `chmod +x your_wrapper.sh`

## Dataset Files

- `browsecomp_dataset.py` - Dataset loader for browsecomp questions with automatic decryption support
- `browsecomp_scorer.py` - Scoring logic that extracts answers and compares against ground truth
- `webvoyager_dataset.py` - Dataset loader for WebVoyager tasks with website filtering support
- `webvoyager_scorer.py` - GPT-4V multimodal scoring for WebVoyager task evaluation

## Notes

- Always use the wrapper scripts (`.sh` files) to ensure proper dependencies are loaded
- The eval server runs on WebSocket protocol (ws://localhost:8080 by default)
- Each connected client receives exactly one evaluation from the stack
- Progress and statistics are shown in real-time during execution