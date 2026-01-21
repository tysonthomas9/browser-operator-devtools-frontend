"""
Write Variation Tool

Writes prompt variations to JSON files for testing.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def get_project_root() -> Path:
    """Get the project root directory (prompt-optimizer)."""
    return Path(__file__).parent.parent.parent.parent.parent


def write_prompt_variation(
    agent_name: str,
    variation: dict[str, Any],
    output_dir: Path,
    version: int | None = None,
    iteration: int | None = None,
) -> str:
    """
    Write a prompt variation to a JSON file.

    Args:
        agent_name: Name of the agent
        variation: Dict with systemPrompt and optional overrides
        output_dir: Base directory for variations
        version: Optional version number (auto-increments if not provided)
        iteration: Optional iteration number for organizing files

    Returns:
        Path to the written file
    """
    # Create directory structure
    if iteration is not None:
        agent_dir = output_dir / "variations" / agent_name / f"iteration_{iteration}"
    else:
        agent_dir = output_dir / "variations" / agent_name

    agent_dir.mkdir(parents=True, exist_ok=True)

    # Auto-increment version if not provided
    if version is None:
        existing = list(agent_dir.glob("v*.json"))
        if existing:
            version = max(int(f.stem[1:]) for f in existing) + 1
        else:
            version = 1

    output_file = agent_dir / f"v{version:03d}.json"

    # Add metadata
    variation_with_meta = {
        "agentName": agent_name,
        "version": version,
        "timestamp": datetime.utcnow().isoformat(),
        **variation,
    }

    # Ensure metadata structure exists
    if "metadata" not in variation_with_meta:
        variation_with_meta["metadata"] = {}

    variation_with_meta["metadata"]["version"] = version
    variation_with_meta["metadata"]["timestamp"] = datetime.utcnow().isoformat()

    output_file.write_text(json.dumps(variation_with_meta, indent=2))
    return str(output_file)


def write_eval_results(
    agent_name: str,
    results: dict[str, Any],
    output_dir: Path,
    version: int,
    iteration: int | None = None,
) -> str:
    """
    Write evaluation results to a JSON file.

    Args:
        agent_name: Name of the agent
        results: Eval results from run_eval
        output_dir: Base directory for results
        version: Version number of the variation
        iteration: Optional iteration number

    Returns:
        Path to the written file
    """
    if iteration is not None:
        results_dir = output_dir / "results" / agent_name / f"iteration_{iteration}"
    else:
        results_dir = output_dir / "results" / agent_name

    results_dir.mkdir(parents=True, exist_ok=True)

    output_file = results_dir / f"v{version:03d}_results.json"

    results_with_meta = {
        "agentName": agent_name,
        "version": version,
        "timestamp": datetime.utcnow().isoformat(),
        **results,
    }

    output_file.write_text(json.dumps(results_with_meta, indent=2))
    return str(output_file)


def write_ranking(
    agent_name: str,
    rankings: list[dict[str, Any]],
    output_dir: Path,
    iteration: int,
) -> str:
    """
    Write rankings for an iteration.

    Args:
        agent_name: Name of the agent
        rankings: List of ranked variations with scores
        output_dir: Base directory
        iteration: Iteration number

    Returns:
        Path to the written file
    """
    rankings_dir = output_dir / "rankings" / agent_name
    rankings_dir.mkdir(parents=True, exist_ok=True)

    output_file = rankings_dir / f"iteration_{iteration}.json"

    ranking_data = {
        "agentName": agent_name,
        "iteration": iteration,
        "timestamp": datetime.utcnow().isoformat(),
        "rankings": rankings,
    }

    output_file.write_text(json.dumps(ranking_data, indent=2))
    return str(output_file)


def load_variation(variation_path: str | Path) -> dict[str, Any]:
    """Load a variation from a JSON file."""
    path = Path(variation_path)
    if not path.exists():
        raise FileNotFoundError(f"Variation file not found: {path}")
    return json.loads(path.read_text())


def list_variations(
    agent_name: str,
    output_dir: Path,
    iteration: int | None = None,
) -> list[Path]:
    """List all variation files for an agent."""
    if iteration is not None:
        agent_dir = output_dir / "variations" / agent_name / f"iteration_{iteration}"
    else:
        agent_dir = output_dir / "variations" / agent_name

    if not agent_dir.exists():
        return []

    return sorted(agent_dir.glob("v*.json"))
