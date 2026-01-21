#!/usr/bin/env python3
"""
Prompt Optimizer CLI for Browser Operator agents.

Usage:
    prompt-optimizer optimize --agent action_agent --limit 10
    prompt-optimizer optimize --agent web_task_agent --tags click,form-fill
    prompt-optimizer compare --agent action_agent --v1 baseline --v2 v005
    prompt-optimizer report --agent action_agent
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from .orchestrator import PromptOptimizer


def main():
    """Main CLI entry point."""
    # Load environment variables
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Browser Operator Prompt Optimizer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run optimization for action_agent
  prompt-optimizer optimize --agent action_agent --limit 10

  # Run with specific tags
  prompt-optimizer optimize --agent action_agent --tags click,form-fill

  # Compare two versions
  prompt-optimizer compare --agent action_agent --v1 baseline --v2 v005

  # Generate report
  prompt-optimizer report --agent action_agent
        """,
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # Optimize command
    opt_parser = subparsers.add_parser("optimize", help="Run optimization loop")
    opt_parser.add_argument(
        "--agent",
        required=True,
        choices=["action_agent", "web_task_agent", "research_agent"],
        help="Agent to optimize",
    )
    opt_parser.add_argument(
        "--tests",
        help="Comma-separated test IDs to run",
    )
    opt_parser.add_argument(
        "--tags",
        help="Comma-separated tags to filter tests",
    )
    opt_parser.add_argument(
        "--limit",
        type=int,
        help="Max tests per iteration",
    )
    opt_parser.add_argument(
        "--max-iterations",
        type=int,
        default=5,
        help="Max optimization iterations (default: 5)",
    )
    opt_parser.add_argument(
        "--convergence-threshold",
        type=float,
        default=0.05,
        help="Stop if improvement < threshold (default: 0.05 = 5%%)",
    )
    opt_parser.add_argument(
        "--target-pass-rate",
        type=float,
        default=0.95,
        help="Target pass rate to stop optimization (default: 0.95)",
    )
    opt_parser.add_argument(
        "--provider",
        default="openai",
        help="LLM provider for evals (default: openai)",
    )
    opt_parser.add_argument(
        "--model",
        default="gpt-4o",
        help="Model for evals (default: gpt-4o)",
    )
    opt_parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("prompt-optimizer-output"),
        help="Output directory for variations and results",
    )
    opt_parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output",
    )
    opt_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without running evals",
    )

    # Compare command
    cmp_parser = subparsers.add_parser("compare", help="Compare prompt versions")
    cmp_parser.add_argument("--agent", required=True, help="Agent name")
    cmp_parser.add_argument(
        "--v1",
        required=True,
        help="First version (or 'baseline')",
    )
    cmp_parser.add_argument(
        "--v2",
        required=True,
        help="Second version",
    )
    cmp_parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("prompt-optimizer-output"),
    )

    # Report command
    rpt_parser = subparsers.add_parser("report", help="Generate optimization report")
    rpt_parser.add_argument("--agent", required=True, help="Agent name")
    rpt_parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
    )
    rpt_parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("prompt-optimizer-output"),
    )

    args = parser.parse_args()

    # Claude Agent SDK uses Claude Code authentication automatically

    if args.command == "optimize":
        optimizer = PromptOptimizer(
            agent_name=args.agent,
            output_dir=args.output_dir,
            max_iterations=args.max_iterations,
            convergence_threshold=args.convergence_threshold,
            target_pass_rate=args.target_pass_rate,
            eval_provider=args.provider,
            eval_model=args.model,
            verbose=args.verbose,
        )
        asyncio.run(
            optimizer.run(
                tests=args.tests.split(",") if args.tests else None,
                tags=args.tags.split(",") if args.tags else None,
                limit=args.limit,
                dry_run=args.dry_run,
            )
        )

    elif args.command == "compare":
        # TODO: Implement comparison
        print(f"Compare {args.v1} vs {args.v2} for {args.agent}")
        print("Not yet implemented")

    elif args.command == "report":
        # TODO: Implement report generation
        print(f"Generate {args.format} report for {args.agent}")
        print("Not yet implemented")


if __name__ == "__main__":
    main()
