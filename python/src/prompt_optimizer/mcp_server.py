"""
MCP Server for Rubric Management Tools.

Exposes rubric tools to Claude Agent SDK via SDK's built-in MCP mechanism.
"""

import json
from pathlib import Path
from typing import Any

from claude_agent_sdk import SdkMcpTool, create_sdk_mcp_server

from .rubric_manager import RubricManager


def create_rubric_mcp_server(
    rubric_manager: RubricManager,
    output_dir: str,
):
    """Create an MCP server with rubric management tools using Claude SDK's mechanism."""

    def add_adaptive_rubrics(
        test_id: str,
        positive_rubrics: list[dict],
        negative_rubrics: list[dict],
    ) -> dict:
        """Add new instance-adaptive rubrics to a test's buffer."""
        added = rubric_manager.add_adaptive_rubrics(
            test_id,
            positive_rubrics or [],
            negative_rubrics or [],
        )
        return {"added": added, "test_id": test_id}

    def evolve_rubrics() -> dict:
        """Filter rubrics by discriminative power (std dev) and cap active rubrics."""
        return rubric_manager.evolve_rubrics()

    def get_weak_dimensions(threshold: float = 0.7) -> dict:
        """Get rubric dimensions that need improvement."""
        return rubric_manager.get_all_weak_dimensions(threshold)

    def update_rubric_scores(results: list[dict]) -> dict:
        """Update rubric score histories from eval results."""
        for result in results or []:
            test_id = result.get("testId")
            scores = result.get("rubricScores", [])
            if test_id and scores:
                rubric_manager.update_scores(test_id, scores)
        return {"updated": len(results or [])}

    def export_rubric_configs(filename: str = "rubric_config.json") -> dict:
        """Export rubric configs for TypeScript eval runner."""
        path = Path(output_dir) / filename
        configs = rubric_manager.export_for_eval()
        with open(path, "w") as f:
            json.dump(configs, f, indent=2)
        return {"path": str(path), "test_count": len(configs)}

    def save_rubric_buffer() -> dict:
        """Persist rubric buffer state for resume capability."""
        path = Path(output_dir) / "rubric_buffer.json"
        rubric_manager.save(str(path))
        return {"path": str(path)}

    def get_rubric_summary() -> dict:
        """Get summary statistics about current rubric state."""
        return rubric_manager.get_summary()

    # Define tools using SDK's SdkMcpTool
    tools = [
        SdkMcpTool(
            name="add_adaptive_rubrics",
            description="Add new instance-adaptive rubrics to a test's buffer. Call this after analyzing test failures to add discriminative criteria.",
            input_schema={
                "type": "object",
                "properties": {
                    "test_id": {
                        "type": "string",
                        "description": "The test case ID",
                    },
                    "positive_rubrics": {
                        "type": "array",
                        "description": "Excellence indicators (weight=1.0), each with 'description' and 'title'",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "title": {"type": "string"},
                            },
                            "required": ["description", "title"],
                        },
                    },
                    "negative_rubrics": {
                        "type": "array",
                        "description": "Failure patterns (weight=-1.0), each with 'description' and 'title'",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "title": {"type": "string"},
                            },
                            "required": ["description", "title"],
                        },
                    },
                },
                "required": ["test_id", "positive_rubrics", "negative_rubrics"],
            },
            handler=lambda test_id, positive_rubrics, negative_rubrics: add_adaptive_rubrics(
                test_id, positive_rubrics, negative_rubrics
            ),
        ),
        SdkMcpTool(
            name="evolve_rubrics",
            description="Filter rubrics by discriminative power (std dev) and cap active rubrics. Call this after updating scores to remove low-signal rubrics.",
            input_schema={
                "type": "object",
                "properties": {},
                "required": [],
            },
            handler=lambda: evolve_rubrics(),
        ),
        SdkMcpTool(
            name="get_weak_dimensions",
            description="Get rubric dimensions that need improvement. Use this to inform prompt variations about specific weaknesses.",
            input_schema={
                "type": "object",
                "properties": {
                    "threshold": {
                        "type": "number",
                        "description": "Score threshold (default 0.7)",
                    },
                },
                "required": [],
            },
            handler=lambda threshold=0.7: get_weak_dimensions(threshold),
        ),
        SdkMcpTool(
            name="update_rubric_scores",
            description="Update rubric score histories from eval results. Call this after running evals to track per-rubric performance.",
            input_schema={
                "type": "object",
                "properties": {
                    "results": {
                        "type": "array",
                        "description": "Eval results array, each with 'testId' and 'rubricScores'",
                        "items": {
                            "type": "object",
                            "properties": {
                                "testId": {"type": "string"},
                                "rubricScores": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "rubricId": {"type": "string"},
                                            "score": {"type": "number"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                "required": ["results"],
            },
            handler=lambda results: update_rubric_scores(results),
        ),
        SdkMcpTool(
            name="export_rubric_configs",
            description="Export rubric configs for TypeScript eval runner. Returns the file path where configs were written.",
            input_schema={
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Output filename (default: rubric_config.json)",
                    },
                },
                "required": [],
            },
            handler=lambda filename="rubric_config.json": export_rubric_configs(filename),
        ),
        SdkMcpTool(
            name="save_rubric_buffer",
            description="Persist rubric buffer state for resume capability.",
            input_schema={
                "type": "object",
                "properties": {},
                "required": [],
            },
            handler=lambda: save_rubric_buffer(),
        ),
        SdkMcpTool(
            name="get_rubric_summary",
            description="Get summary statistics about current rubric state.",
            input_schema={
                "type": "object",
                "properties": {},
                "required": [],
            },
            handler=lambda: get_rubric_summary(),
        ),
    ]

    # Create MCP server using SDK's mechanism
    return create_sdk_mcp_server(
        name="rubric_tools",
        version="1.0.0",
        tools=tools,
    )
