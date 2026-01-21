"""
Rubric Management Tools for Claude Agent SDK.

These tools let Claude manage rubric evolution with structured inputs.
No fragile JSON parsing - tool schemas enforce structure.
"""

import json
from pathlib import Path
from typing import Any

from ..rubric_manager import RubricManager


RUBRIC_TOOL_NAMES = [
    "add_adaptive_rubrics",
    "evolve_rubrics",
    "get_weak_dimensions",
    "update_rubric_scores",
    "export_rubric_configs",
    "save_rubric_buffer",
    "get_rubric_summary",
]


class RubricTools:
    """Tools that Claude can call to manage rubrics."""

    def __init__(self, rubric_manager: RubricManager, output_dir: str):
        self.manager = rubric_manager
        self.output_dir = output_dir

    def get_tool_definitions(self) -> list[dict]:
        """Return tool definitions for Claude Agent SDK."""
        return [
            {
                "name": "add_adaptive_rubrics",
                "description": (
                    "Add new instance-adaptive rubrics to a test's buffer. "
                    "Call this after analyzing test failures to add discriminative criteria."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "test_id": {
                            "type": "string",
                            "description": "The test case ID",
                        },
                        "positive_rubrics": {
                            "type": "array",
                            "description": "Excellence indicators (weight=1.0)",
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
                            "description": "Failure patterns (weight=-1.0)",
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
            },
            {
                "name": "evolve_rubrics",
                "description": (
                    "Filter rubrics by discriminative power (std dev) and cap active rubrics. "
                    "Call this after updating scores to remove low-signal rubrics."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "get_weak_dimensions",
                "description": (
                    "Get rubric dimensions that need improvement. "
                    "Use this to inform prompt variations about specific weaknesses."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "threshold": {
                            "type": "number",
                            "description": "Score threshold (default 0.7)",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "update_rubric_scores",
                "description": (
                    "Update rubric score histories from eval results. "
                    "Call this after running evals to track per-rubric performance."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "results": {
                            "type": "array",
                            "description": "Eval results with rubricScores",
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
            },
            {
                "name": "export_rubric_configs",
                "description": (
                    "Export rubric configs for TypeScript eval runner. "
                    "Returns the file path where configs were written."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "filename": {
                            "type": "string",
                            "description": "Output filename (default: rubric_config.json)",
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "save_rubric_buffer",
                "description": "Persist rubric buffer state for resume capability.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
            {
                "name": "get_rubric_summary",
                "description": "Get summary statistics about current rubric state.",
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        ]

    def execute(self, tool_name: str, params: dict) -> Any:
        """Execute a rubric tool and return result."""
        if tool_name == "add_adaptive_rubrics":
            added = self.manager.add_adaptive_rubrics(
                params["test_id"],
                params.get("positive_rubrics", []),
                params.get("negative_rubrics", []),
            )
            return {"added": added, "test_id": params["test_id"]}

        elif tool_name == "evolve_rubrics":
            metrics = self.manager.evolve_rubrics()
            return metrics

        elif tool_name == "get_weak_dimensions":
            threshold = params.get("threshold", 0.7)
            weak = self.manager.get_all_weak_dimensions(threshold)
            return weak

        elif tool_name == "update_rubric_scores":
            for result in params.get("results", []):
                test_id = result.get("testId")
                scores = result.get("rubricScores", [])
                if test_id and scores:
                    self.manager.update_scores(test_id, scores)
            return {"updated": len(params.get("results", []))}

        elif tool_name == "export_rubric_configs":
            filename = params.get("filename", "rubric_config.json")
            path = Path(self.output_dir) / filename
            configs = self.manager.export_for_eval()
            with open(path, "w") as f:
                json.dump(configs, f, indent=2)
            return {"path": str(path), "test_count": len(configs)}

        elif tool_name == "save_rubric_buffer":
            path = Path(self.output_dir) / "rubric_buffer.json"
            self.manager.save(str(path))
            return {"path": str(path)}

        elif tool_name == "get_rubric_summary":
            return self.manager.get_summary()

        else:
            return {"error": f"Unknown tool: {tool_name}"}
