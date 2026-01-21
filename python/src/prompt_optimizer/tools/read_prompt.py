"""
Read Prompt Tool

Extracts agent system prompts from TypeScript source files.
"""

import re
from pathlib import Path
from typing import Any


# Map agent names to their source files (relative to project root)
AGENT_FILES = {
    "action_agent": "front_end/panels/ai_chat/agent_framework/implementation/agents/ActionAgent.ts",
    "action_agent_v1": "front_end/panels/ai_chat/agent_framework/implementation/agents/ActionAgentV1.ts",
    "action_agent_v2": "front_end/panels/ai_chat/agent_framework/implementation/agents/ActionAgentV2.ts",
    "web_task_agent": "front_end/panels/ai_chat/agent_framework/implementation/agents/WebTaskAgent.ts",
    "research_agent": "front_end/panels/ai_chat/agent_framework/implementation/agents/ResearchAgent.ts",
}


def get_project_root() -> Path:
    """Get the project root directory (prompt-optimizer)."""
    return Path(__file__).parent.parent.parent.parent.parent


def read_agent_prompt(agent_name: str) -> dict[str, Any]:
    """
    Extract the system prompt and configuration from an agent file.

    Args:
        agent_name: Name of the agent (action_agent, web_task_agent, etc.)

    Returns:
        Dict with agent config: name, systemPrompt, description, tools, etc.
    """
    if agent_name not in AGENT_FILES:
        raise ValueError(
            f"Unknown agent: {agent_name}. Available: {list(AGENT_FILES.keys())}"
        )

    project_root = get_project_root()
    file_path = project_root / AGENT_FILES[agent_name]

    if not file_path.exists():
        raise FileNotFoundError(f"Agent file not found: {file_path}")

    content = file_path.read_text()

    # Extract systemPrompt using regex
    # Pattern matches: systemPrompt: `...` (template literal)
    prompt_match = re.search(
        r"systemPrompt:\s*`([\s\S]*?)`",
        content,
    )

    # Also try double quotes if template literal not found
    if not prompt_match:
        prompt_match = re.search(
            r'systemPrompt:\s*"([\s\S]*?)"',
            content,
        )

    # Extract name
    name_match = re.search(r"name:\s*['\"](\w+)['\"]", content)

    # Extract description
    desc_match = re.search(
        r"description:\s*[`'\"](.+?)[`'\"]",
        content,
        re.DOTALL,
    )

    # Extract tools array
    tools_match = re.search(r"tools:\s*\[([\s\S]*?)\]", content)

    # Extract maxIterations
    max_iter_match = re.search(r"maxIterations:\s*(\d+)", content)

    # Extract temperature
    temp_match = re.search(r"temperature:\s*([\d.]+)", content)

    return {
        "name": name_match.group(1) if name_match else agent_name,
        "systemPrompt": prompt_match.group(1) if prompt_match else "",
        "description": desc_match.group(1).strip() if desc_match else "",
        "tools": _parse_tools_array(tools_match.group(1)) if tools_match else [],
        "maxIterations": int(max_iter_match.group(1)) if max_iter_match else 10,
        "temperature": float(temp_match.group(1)) if temp_match else 0.5,
        "sourceFile": str(file_path.relative_to(project_root)),
    }


def _parse_tools_array(tools_str: str) -> list[str]:
    """Parse a TypeScript array of tool names."""
    return re.findall(r"['\"](\w+)['\"]", tools_str)


def list_available_agents() -> list[str]:
    """List all available agent names."""
    return list(AGENT_FILES.keys())


def get_prompt_hash(prompt: str) -> str:
    """Get a short hash of the prompt for identification."""
    import hashlib
    return hashlib.sha256(prompt.encode()).hexdigest()[:8]
