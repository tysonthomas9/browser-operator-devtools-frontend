"""
Prompt Optimizer Orchestrator

Uses Claude Agent SDK to coordinate prompt optimization through subagents.
Supports evolving rubrics for intelligent, adaptive evaluation.
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from claude_agent_sdk import (
    AgentDefinition,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    HookMatcher,
)

from .mcp_server import create_rubric_mcp_server
from .rubric_evolution import (
    aggregate_dimensional_results,
    compute_weighted_score,
    format_weak_dimensions_for_prompt,
)
from .rubric_manager import RubricManager
from .tools.read_prompt import read_agent_prompt
from .tools.run_eval import parse_eval_summary, run_eval
from .tools.write_variation import write_prompt_variation

# Path to prompt templates
PROMPTS_DIR = Path(__file__).parent / "prompts"


def generate_execution_id(agent_name: str) -> str:
    """Generate unique execution ID for this optimization run."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_uuid = uuid.uuid4().hex[:6]
    return f"{agent_name}_{timestamp}_{short_uuid}"


def load_prompt(filename: str) -> str:
    """Load a prompt template from the prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def inject_config(prompt: str, config: dict[str, Any]) -> str:
    """Inject configuration values into a prompt template."""
    for key, value in config.items():
        prompt = prompt.replace(f"{{{key}}}", str(value))
    return prompt


class PromptOptimizer:
    """Main orchestrator for prompt optimization."""

    def __init__(
        self,
        agent_name: str,
        output_dir: Path,
        max_iterations: int = 5,
        convergence_threshold: float = 0.05,
        target_pass_rate: float = 0.95,
        eval_provider: str = "openai",
        eval_model: str = "gpt-4o",
        verbose: bool = False,
        use_evolving_rubrics: bool = True,
        max_active_rubrics: int = 5,
        pass_threshold: float = 0.80,
    ):
        self.agent_name = agent_name
        self.output_dir = Path(output_dir)
        self.max_iterations = max_iterations
        self.convergence_threshold = convergence_threshold
        self.target_pass_rate = target_pass_rate
        self.eval_provider = eval_provider
        self.eval_model = eval_model
        self.verbose = verbose
        self.execution_id = generate_execution_id(agent_name)

        self.use_evolving_rubrics = use_evolving_rubrics
        self.pass_threshold = pass_threshold
        self.rubric_manager: RubricManager | None = None
        if use_evolving_rubrics:
            self.rubric_manager = RubricManager(
                max_active_rubrics=max_active_rubrics,
            )
        self.rubric_buffer_path = self.output_dir / "rubric_buffer.json"

        # Create MCP server for rubric tools
        self.rubric_mcp_server = None
        if use_evolving_rubrics and self.rubric_manager:
            self.rubric_mcp_server = create_rubric_mcp_server(
                self.rubric_manager,
                str(self.output_dir),
            )

        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Agent logging state
        self._current_agent = "orchestrator"
        self._agent_depth = 0

    async def run(
        self,
        tests: list[str] | None = None,
        tags: list[str] | None = None,
        limit: int | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """Run the optimization loop."""
        print("\n" + "=" * 60)
        print("  Browser Operator Prompt Optimizer")
        print("=" * 60)
        print(f"\nExecution ID: {self.execution_id}")
        print(f"Agent: {self.agent_name}")
        print(f"Max iterations: {self.max_iterations}")
        print(f"Convergence threshold: {self.convergence_threshold * 100}%")
        print(f"Target pass rate: {self.target_pass_rate * 100}%")
        print(f"Output: {self.output_dir}")

        if dry_run:
            print("\n[DRY RUN] Would run optimization but not executing evals")
            return self._dry_run_report()

        # Step 1: Read baseline agent configuration
        print("\n📖 Reading baseline agent configuration...")
        baseline_config = read_agent_prompt(self.agent_name)
        print(f"   Agent: {baseline_config['name']}")
        print(f"   Tools: {len(baseline_config['tools'])} tools")
        print(f"   Prompt length: {len(baseline_config['systemPrompt'])} chars")

        # Step 2: Run baseline evaluation
        print("\n🧪 Running baseline evaluation...")
        baseline_results = self._run_baseline_eval(tests, tags, limit)
        baseline_summary = parse_eval_summary(baseline_results)

        print(f"   Pass rate: {baseline_summary['pass_rate'] * 100:.1f}%")
        print(f"   Passed: {baseline_summary['passed']}/{baseline_summary['total']}")

        # Save baseline results for subagents to analyze (Issue #2)
        results_path = self.output_dir / "results" / self.agent_name / "baseline_results.json"
        results_path.parent.mkdir(parents=True, exist_ok=True)
        with open(results_path, "w") as f:
            json.dump(baseline_results, f, indent=2)
        print(f"   Results saved: {results_path}")

        # Save baseline config for subagents to reference (Issue #6)
        config_path = self.output_dir / "baseline_config.json"
        with open(config_path, "w") as f:
            json.dump(baseline_config, f, indent=2)
        print(f"   Config saved: {config_path}")

        # Initialize rubric manager from baseline results
        if self.use_evolving_rubrics:
            print("\n📋 Initializing rubric manager...")
            self._initialize_rubrics_from_results(baseline_results)
            if self.rubric_manager:
                summary = self.rubric_manager.get_summary()
                print(f"   Tests with rubrics: {summary['test_count']}")
                print(f"   Persistent rubrics: {summary['total_persistent_rubrics']}")

        if baseline_summary["pass_rate"] >= self.target_pass_rate:
            print(f"\n✅ Baseline already meets target pass rate!")
            return {
                "success": True,
                "message": "Baseline meets target",
                "baseline": baseline_summary,
                "iterations": 0,
            }

        # Step 3: Run optimization loop using Claude Agent SDK
        return await self._run_optimization_loop(
            baseline_config, baseline_summary, tests, tags, limit
        )

    def _run_baseline_eval(
        self,
        tests: list[str] | None,
        tags: list[str] | None,
        limit: int | None,
    ) -> dict[str, Any]:
        """Run evaluation with current baseline prompt.

        Note: Baseline eval doesn't use rubric config because rubrics
        are initialized from these results (chicken-and-egg problem).
        Rubric-based evaluation happens in subsequent variation testing.
        """
        return run_eval(
            agent=self.agent_name,
            tests=tests,
            tags=tags,
            limit=limit,
            provider=self.eval_provider,
            model=self.eval_model,
            verbose=self.verbose,
            # No rubric config for baseline - rubrics don't exist yet
            pass_threshold=self.pass_threshold,
        )

    def _export_rubric_configs(self, path: str) -> None:
        """Export rubric configs for TypeScript eval runner."""
        if not self.rubric_manager:
            return
        configs = self.rubric_manager.export_for_eval()
        with open(path, "w") as f:
            json.dump(configs, f, indent=2)
        if self.verbose:
            print(f"   Exported rubric configs to: {path}")

    def _initialize_rubrics_from_results(self, results: dict[str, Any]) -> None:
        """Initialize rubric manager from baseline results."""
        if not self.rubric_manager:
            return

        # Extract test cases from results to initialize rubrics
        test_results = results.get("results", [])
        test_cases = []
        for result in test_results:
            # Build minimal test case structure for rubric initialization
            test_cases.append({
                "id": result.get("testId"),
                "validation": {
                    "llmJudge": {
                        "criteria": [
                            c.get("criterion", "")
                            for c in result.get("validation", {}).get("criteria", [])
                        ]
                    }
                }
            })

        self.rubric_manager.initialize_from_test_cases(test_cases)

        # Try to load existing rubric buffer for resume capability
        if self.rubric_buffer_path.exists():
            try:
                self.rubric_manager = RubricManager.load(str(self.rubric_buffer_path))
                print(f"   Loaded rubric buffer from: {self.rubric_buffer_path}")
            except Exception as e:
                print(f"   Could not load rubric buffer: {e}")

    def _save_rubric_buffer(self) -> None:
        """Save rubric buffer state for resume capability."""
        if self.rubric_manager:
            self.rubric_manager.save(str(self.rubric_buffer_path))
            if self.verbose:
                print(f"   Saved rubric buffer to: {self.rubric_buffer_path}")

    async def _run_optimization_loop(
        self,
        baseline_config: dict[str, Any],
        baseline_summary: dict[str, Any],
        tests: list[str] | None,
        tags: list[str] | None,
        limit: int | None,
    ) -> dict[str, Any]:
        """Run the optimization loop using Claude Agent SDK."""

        # Load and configure prompts
        config = {
            "agent_name": self.agent_name,
            "max_iterations": self.max_iterations,
            "convergence_threshold": self.convergence_threshold,
            "target_pass_rate": self.target_pass_rate,
            "output_dir": str(self.output_dir),
            "execution_id": self.execution_id,
            "provider": self.eval_provider,
            "model": self.eval_model,
        }

        orchestrator_prompt = inject_config(load_prompt("orchestrator.txt"), config)
        generator_prompt = inject_config(load_prompt("prompt_generator.txt"), config)
        runner_prompt = inject_config(load_prompt("test_runner.txt"), config)
        analyzer_prompt = inject_config(load_prompt("evaluation_analyzer.txt"), config)

        # Load rubric generator prompt if using evolving rubrics
        rubric_generator_prompt = ""
        if self.use_evolving_rubrics:
            rubric_generator_prompt = load_prompt("rubric_generator.txt")

        # Define subagents
        agents = {
            "prompt-generator": AgentDefinition(
                description=(
                    f"Generate improved prompt variations for {self.agent_name}. "
                    "Analyzes baseline and feedback to create 4 distinct variations."
                ),
                tools=["Read", "Write", "Glob", "Bash"],
                prompt=generator_prompt,
                model="sonnet",
            ),
            "test-runner": AgentDefinition(
                description=(
                    f"Execute evals for {self.agent_name} using the TypeScript eval runner. "
                    "Runs tests with prompt override and returns JSON results."
                ),
                tools=["Read", "Glob", "Bash"],
                prompt=runner_prompt,
                model="haiku",
            ),
            "evaluation-analyzer": AgentDefinition(
                description=(
                    "Analyze test results, identify failure patterns, and rank variations. "
                    "Provides recommendations for next iteration."
                ),
                tools=["Read", "Write", "Glob", "Bash"],
                prompt=analyzer_prompt,
                model="sonnet",
            ),
        }

        # Add rubric-generator subagent if using evolving rubrics
        if self.use_evolving_rubrics:
            agents["rubric-generator"] = AgentDefinition(
                description=(
                    "Generate instance-adaptive rubrics based on test results. "
                    "Analyzes agent behavior patterns to create discriminative evaluation criteria."
                ),
                tools=["Read"],  # Can read execution logs if needed
                prompt=rubric_generator_prompt,
                model="haiku",  # Fast, good for structured JSON output
            )

        # Build allowed tools list including MCP rubric tools
        allowed_tools = ["Task", "Read", "Write", "Glob"]

        # Build MCP servers list
        # NOTE: MCP server initialization is currently timing out.
        # Temporarily disabled until we fix the MCP server setup.
        # TODO: Re-enable once MCP server initialization is fixed.
        mcp_servers = []
        # if self.rubric_mcp_server:
        #     mcp_servers.append(self.rubric_mcp_server)
        #     # MCP tools are named: mcp__{server_name}__{tool_name}
        #     allowed_tools.extend([
        #         "mcp__rubric_tools__add_adaptive_rubrics",
        #         "mcp__rubric_tools__evolve_rubrics",
        #         "mcp__rubric_tools__get_weak_dimensions",
        #         "mcp__rubric_tools__update_rubric_scores",
        #         "mcp__rubric_tools__export_rubric_configs",
        #         "mcp__rubric_tools__save_rubric_buffer",
        #         "mcp__rubric_tools__get_rubric_summary",
        #     ])

        # max_turns = LLM conversation turns (not optimization iterations)
        # Each optimization iteration needs ~50 turns (read, spawn, write, eval, analyze)
        # The prompt tells the agent to stop after max_iterations optimization cycles
        max_turns = self.max_iterations * 50

        options = ClaudeAgentOptions(
            permission_mode="bypassPermissions",
            system_prompt=orchestrator_prompt,
            allowed_tools=allowed_tools,
            mcp_servers=mcp_servers,
            agents=agents,
            model="sonnet",
            max_turns=max_turns,
        )

        # Build initial context for the orchestrator
        test_filter = ""
        if tests:
            test_filter = f"--test {','.join(tests)} "
        if tags:
            test_filter += " ".join(f"--tag {t}" for t in tags) + " "
        if limit:
            test_filter += f"--limit {limit} "

        # Build rubric context if using evolving rubrics
        rubric_context = ""
        if self.use_evolving_rubrics and self.rubric_manager:
            rubric_summary = self.rubric_manager.get_summary()
            weak_dims = self.rubric_manager.get_all_weak_dimensions()
            weak_dims_str = format_weak_dimensions_for_prompt(weak_dims)
            rubric_context = f"""

## Evolving Rubrics
This optimization uses adaptive rubric-based evaluation:
- Pass threshold: {self.pass_threshold * 100:.0f}%
- Active rubrics: {rubric_summary["total_active_rubrics"]}
- Max adaptive rubrics per test: {rubric_summary["max_active_per_test"]}

{weak_dims_str}

Use the rubric-generator subagent to evolve evaluation criteria based on failure patterns.
"""

        # Build failure details for initial prompt (Issue #1)
        prompt_length = len(baseline_config["systemPrompt"])
        failed_tests = [
            r for r in baseline_summary.get("results", [])
            if r.get("status") != "passed"
        ]
        if failed_tests:
            failure_details = "\n".join([
                f"- {r['testId']}: {r.get('validation', {}).get('explanation', 'Unknown')}"
                for r in failed_tests[:10]  # Show up to 10 failed tests with full explanations
            ])
            failure_section = f"""
Failed tests ({len(failed_tests)} total):
{failure_details}
"""
        else:
            failure_section = "\nNo failed tests in baseline."

        initial_prompt = f"""
Start the optimization loop for {self.agent_name}.

Baseline performance:
- Pass rate: {baseline_summary["pass_rate"] * 100:.1f}%
- Passed: {baseline_summary["passed"]}/{baseline_summary["total"]}
- Average score: {baseline_summary.get("average_score", 0) * 100:.1f}%
{failure_section}
Full baseline results: {self.output_dir}/results/{self.agent_name}/baseline_results.json
Baseline config: {self.output_dir}/baseline_config.json

Current agent prompt saved to: {self.output_dir}/baseline_config.json
(Read the file for full prompt - it's {prompt_length} chars)

Test filter: {test_filter or "all tests"}
Eval provider: {self.eval_provider}
Eval model: {self.eval_model}
{rubric_context}
Please:
1. Read the full baseline results file to understand specific failures
2. Generate 4 prompt variations targeting different failure patterns
3. Test each variation
4. Rank results and determine next steps
5. Continue until convergence or max iterations

Output all files to: {self.output_dir}
"""

        print("\n🤖 Starting Claude Agent SDK optimization loop...")
        print("-" * 60)

        try:
            async with ClaudeSDKClient(options=options) as client:
                await client.query(prompt=initial_prompt)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__

                    if msg_type == "AssistantMessage":
                        # Process and display the message
                        self._process_message(msg)
                    # MCP tools are executed automatically by the SDK

        except Exception as e:
            print(f"\n❌ Error during optimization: {e}")
            return {
                "success": False,
                "error": str(e),
                "execution_id": self.execution_id,
            }

        # Load final results
        return self._load_final_results()

    def _process_message(self, msg: Any) -> None:
        """Process and display assistant messages with agent context.

        Handles SDK content block types:
        - TextBlock: text output from assistant
        - ThinkingBlock: extended thinking (optional)
        - ToolUseBlock: tool invocation with name and input
        - ToolResultBlock: tool output/result

        Tracks subagent execution and provides visual hierarchy.
        """
        for content in msg.content:
            # TextBlock - main assistant text
            if hasattr(content, "text"):
                # Add indent for text within subagents
                text = content.text
                if self._agent_depth > 0:
                    indent = "│   " * self._agent_depth
                    # Indent each line
                    lines = text.split("\n")
                    text = "\n".join(f"{indent}{line}" if line.strip() else line for line in lines)
                print(text, end="")

            # ThinkingBlock - extended thinking
            elif hasattr(content, "thinking"):
                if self.verbose:
                    thinking_preview = content.thinking[:200]
                    if len(content.thinking) > 200:
                        thinking_preview += "..."
                    indent = "│   " * self._agent_depth
                    print(f"\n{indent}[Thinking: {thinking_preview}]")

            # ToolUseBlock - tool invocation (has name and input)
            elif hasattr(content, "name") and hasattr(content, "input"):
                tool_name = content.name

                # Check for subagent spawn
                if tool_name == "Task":
                    subagent = content.input.get("subagent_type", "unknown")
                    self._print_agent_header(subagent, start=True)
                    self._current_agent = subagent
                    self._agent_depth += 1
                elif self.verbose:
                    self._print_tool(tool_name, content.input)

            # ToolResultBlock - tool output (has tool_use_id)
            elif hasattr(content, "tool_use_id"):
                # Check if this is a subagent result (Task completion)
                if self._agent_depth > 0 and self._current_agent != "orchestrator":
                    self._print_agent_header(self._current_agent, start=False)
                    self._agent_depth -= 1
                    self._current_agent = "orchestrator" if self._agent_depth == 0 else self._current_agent

    def _print_agent_header(self, agent: str, start: bool) -> None:
        """Print visual header for agent transitions."""
        if not self.verbose:
            return

        indent = "│   " * (self._agent_depth if start else self._agent_depth - 1)
        width = 50

        if start:
            label = f" SUBAGENT: {agent} "
            print(f"\n{indent}┌─{label:─<{width}}─┐")
        else:
            print(f"\n{indent}└─ done: {agent} {'─' * (width - len(agent) - 8)}─┘")

    def _print_tool(self, name: str, input_data: dict) -> None:
        """Print tool invocation with indentation."""
        indent = "│   " * max(1, self._agent_depth)
        short_input = self._format_tool_input(name, input_data)
        print(f"{indent}[{name}] {short_input}")

    def _format_tool_input(self, name: str, input_data: dict) -> str:
        """Format tool input for concise display."""
        if name == "Read":
            path = input_data.get("file_path", "")
            return path.split("/")[-1] if "/" in path else path  # Just filename
        elif name == "Write":
            path = input_data.get("file_path", "")
            return path.split("/")[-1] if "/" in path else path
        elif name == "Bash":
            cmd = input_data.get("command", "")[:60]
            return cmd + "..." if len(input_data.get("command", "")) > 60 else cmd
        elif name == "Glob":
            return input_data.get("pattern", "")[:50]
        elif name == "Grep":
            return f'"{input_data.get("pattern", "")[:30]}"'
        else:
            s = str(input_data)
            return s[:80] + "..." if len(s) > 80 else s

    def _load_final_results(self) -> dict[str, Any]:
        """Load the final optimization results."""
        # Save rubric buffer for future runs
        self._save_rubric_buffer()

        rankings_dir = self.output_dir / "rankings" / self.agent_name
        if not rankings_dir.exists():
            return {
                "success": False,
                "error": "No rankings found",
                "execution_id": self.execution_id,
            }

        # Find the latest iteration ranking
        ranking_files = sorted(rankings_dir.glob("iteration_*.json"))
        if not ranking_files:
            return {
                "success": False,
                "error": "No ranking files found",
                "execution_id": self.execution_id,
            }

        latest = ranking_files[-1]
        with open(latest) as f:
            final_ranking = json.load(f)

        # Include rubric summary in results
        rubric_summary = None
        if self.rubric_manager:
            rubric_summary = self.rubric_manager.get_summary()

        return {
            "success": True,
            "execution_id": self.execution_id,
            "final_ranking": final_ranking,
            "iterations": len(ranking_files),
            "best_variation": final_ranking.get("rankings", [{}])[0],
            "rubric_summary": rubric_summary,
        }

    def _dry_run_report(self) -> dict[str, Any]:
        """Generate a dry run report."""
        return {
            "success": True,
            "dry_run": True,
            "execution_id": self.execution_id,
            "config": {
                "agent_name": self.agent_name,
                "max_iterations": self.max_iterations,
                "convergence_threshold": self.convergence_threshold,
                "target_pass_rate": self.target_pass_rate,
                "output_dir": str(self.output_dir),
            },
        }
