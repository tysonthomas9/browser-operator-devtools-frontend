"""
Run Eval Tool

Executes the TypeScript eval runner and returns results.
"""

import json
import subprocess
from pathlib import Path
from typing import Any


def get_project_root() -> Path:
    """Get the project root directory (prompt-optimizer)."""
    # This file is at python/src/prompt_optimizer/tools/run_eval.py
    # Project root is 5 levels up
    return Path(__file__).parent.parent.parent.parent.parent


def run_eval(
    agent: str,
    prompt_override_file: str | None = None,
    tests: list[str] | None = None,
    tags: list[str] | None = None,
    limit: int | None = None,
    provider: str = "openai",
    model: str = "gpt-4o",
    output_file: str | None = None,
    verbose: bool = False,
    timeout: int = 600,
    rubric_config_file: str | None = None,
    dimensional_scores: bool = False,
    pass_threshold: float = 0.80,
) -> dict[str, Any]:
    """
    Execute the TypeScript eval runner and return results.

    Args:
        agent: Agent to test (action_agent, web_task_agent, etc.)
        prompt_override_file: Path to prompt variation JSON
        tests: Specific test IDs to run
        tags: Tags to filter tests
        limit: Max number of tests
        provider: LLM provider
        model: Model name
        output_file: Path to write JSON results (auto-generated if not provided)
        verbose: Enable verbose output
        timeout: Timeout in seconds
        rubric_config_file: Path to rubric configs JSON from Python
        dimensional_scores: Return per-rubric dimensional scores
        pass_threshold: Pass threshold for scoring (0-1)

    Returns:
        Eval results as parsed JSON
    """
    import tempfile

    project_root = get_project_root()

    # Always use an output file to avoid parsing stdout mixed with logs
    if not output_file:
        output_file = tempfile.mktemp(suffix=".json", prefix="eval_results_")

    cmd = [
        "npx",
        "tsx",
        "scripts/eval-runner/cli.ts",
        "--tool",
        agent,
        "--format",
        "json",
        "--provider",
        provider,
        "--model",
        model,
        "--pass-threshold",
        str(pass_threshold),
        "--output",
        output_file,
    ]

    if prompt_override_file:
        cmd.extend(["--prompt-override-file", prompt_override_file])

    if rubric_config_file:
        cmd.extend(["--rubric-config", rubric_config_file])

    if dimensional_scores:
        cmd.append("--dimensional-scores")

    if tests:
        cmd.extend(["--test", ",".join(tests)])

    if tags:
        for tag in tags:
            cmd.extend(["--tag", tag])

    if limit:
        cmd.extend(["--limit", str(limit)])

    if verbose:
        cmd.append("--verbose")

    # Run eval
    if verbose:
        print(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return {
            "error": f"Eval timed out after {timeout}s",
            "success": False,
        }

    # Read results from output file
    if Path(output_file).exists():
        with open(output_file) as f:
            return json.load(f)

    # Save full error logs to file (Issue: stdout/stderr truncation)
    error_log_path = Path(output_file).parent / f"eval_error_{Path(output_file).stem}.log"
    error_log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(error_log_path, "w") as f:
        f.write(f"=== STDOUT ===\n{result.stdout}\n\n=== STDERR ===\n{result.stderr}")

    return {
        "error": "Eval runner did not produce output file",
        "error_log": str(error_log_path),
        "stdout_tail": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
        "stderr_tail": result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr,
        "returncode": result.returncode,
        "success": False,
    }


def parse_eval_summary(results: dict[str, Any]) -> dict[str, Any]:
    """
    Parse eval results into a summary.

    Args:
        results: Raw eval results from run_eval

    Returns:
        Summary dict with pass rate, scores, etc.
    """
    if "error" in results:
        return {
            "success": False,
            "error": results.get("error"),
            "pass_rate": 0.0,
            "total": 0,
            "passed": 0,
            "failed": 0,
        }

    # The eval runner returns results with a nested 'summary' object
    summary = results.get("summary", {})
    total = summary.get("total", 0)
    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0)
    errors = summary.get("errors", 0)

    return {
        "success": True,
        "total": total,
        "passed": passed,
        "failed": failed,
        "errors": errors,
        "pass_rate": summary.get("passRate", passed / total if total > 0 else 0.0),
        "average_score": summary.get("averageScore", 0.0),
        "average_duration": summary.get("averageDuration", 0),
        "results": results.get("results", []),
    }
