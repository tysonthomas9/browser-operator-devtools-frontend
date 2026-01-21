"""
Rubric Manager
Manages rubric buffers across all tests with aggressive evolution.
Each test has its own buffer with persistent, active, and inactive rubrics.
"""

import json
import statistics
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Rubric:
    """A single evaluation rubric with score history."""

    id: str
    description: str
    weight: float  # 1.0 for positive, -1.0 for negative
    title: str
    rubric_type: str  # "persistent" | "adaptive"
    scores_history: list[float] = field(default_factory=list)

    @property
    def std_dev(self) -> float:
        """
        Discriminative power - higher = more useful for distinguishing quality.
        Rubrics with low std dev don't help differentiate good from bad responses.
        """
        if len(self.scores_history) < 2:
            return 0.0
        return statistics.stdev(self.scores_history)

    @property
    def mean_score(self) -> float:
        """Average score across all evaluations."""
        if not self.scores_history:
            return 0.0
        return sum(self.scores_history) / len(self.scores_history)


@dataclass
class TestRubricBuffer:
    """Per-test rubric buffer"""

    test_id: str
    persistent_rubrics: list[Rubric] = field(default_factory=list)
    active_rubrics: list[Rubric] = field(default_factory=list)
    inactive_rubrics: list[Rubric] = field(default_factory=list)

    def get_all_active(self) -> list[Rubric]:
        """Get all rubrics that should be used for evaluation."""
        return self.persistent_rubrics + self.active_rubrics

    def to_eval_config(self) -> dict:
        """Export for TypeScript eval runner."""
        return {
            "testId": self.test_id,
            "rubrics": [
                {
                    "id": r.id,
                    "description": r.description,
                    "weight": r.weight,
                    "type": r.rubric_type,
                }
                for r in self.get_all_active()
            ],
        }

    def get_stats(self) -> dict:
        """Get buffer statistics for logging."""
        return {
            "test_id": self.test_id,
            "persistent_count": len(self.persistent_rubrics),
            "active_count": len(self.active_rubrics),
            "inactive_count": len(self.inactive_rubrics),
            "total_active": len(self.get_all_active()),
        }


class RubricManager:
    """
    Manages rubric buffers across all tests with aggressive evolution.

    Key features:
    - Per-test rubric buffers (persistent from test case, adaptive from evolution)
    - Discriminative power filtering via standard deviation
    - Positive/negative weighting (1.0 vs -1.0)
    - Aggressive evolution after every test batch
    """

    def __init__(
        self,
        max_active_rubrics: int = 5,
        min_std_threshold: float = 0.05,
    ):
        """
        Initialize the RubricManager.

        Args:
            max_active_rubrics: Maximum adaptive rubrics per test (excluding persistent)
            min_std_threshold: Minimum std dev to keep rubric active (discriminative power)
        """
        self.max_active_rubrics = max_active_rubrics
        self.min_std_threshold = min_std_threshold
        self.buffers: dict[str, TestRubricBuffer] = {}

    def initialize_from_test_cases(self, test_cases: list[dict]) -> None:
        """
        Initialize buffers from existing test case criteria.
        Criteria from test cases become persistent rubrics (never deactivated).
        """
        for tc in test_cases:
            # Validate test case structure
            if not isinstance(tc, dict):
                continue
            test_id = tc.get("id")
            if not test_id:
                continue

            # Safely extract criteria with type checking
            validation = tc.get("validation", {})
            if not isinstance(validation, dict):
                validation = {}
            llm_judge = validation.get("llmJudge", {})
            if not isinstance(llm_judge, dict):
                llm_judge = {}
            criteria = llm_judge.get("criteria", [])
            if not isinstance(criteria, list):
                criteria = []

            buffer = TestRubricBuffer(test_id=test_id)
            for i, criterion in enumerate(criteria):
                if not isinstance(criterion, str):
                    continue
                rubric = Rubric(
                    id=f"{test_id}_p{i}",
                    description=criterion,
                    weight=1.0,  # Persistent rubrics are always positive
                    title=f"criterion_{i}",
                    rubric_type="persistent",
                )
                buffer.persistent_rubrics.append(rubric)

            self.buffers[test_id] = buffer

    def update_scores(self, test_id: str, rubric_scores: list[dict]) -> None:
        """
        Update score history from eval results.

        Args:
            test_id: The test case ID
            rubric_scores: List of {rubricId, score, ...} from TypeScript eval
        """
        buffer = self.buffers.get(test_id)
        if not buffer:
            return

        score_map = {s["rubricId"]: s["score"] for s in rubric_scores}
        for rubric in buffer.get_all_active():
            if rubric.id in score_map:
                rubric.scores_history.append(score_map[rubric.id])

    def add_adaptive_rubrics(
        self,
        test_id: str,
        positive_rubrics: list[dict],
        negative_rubrics: list[dict],
    ) -> int:
        """
        Add new instance-adaptive rubrics (called after rubric-generator subagent).

        Args:
            test_id: The test case ID
            positive_rubrics: List of {description, title} for excellence indicators
            negative_rubrics: List of {description, title} for failure patterns

        Returns:
            Number of rubrics added
        """
        buffer = self.buffers.get(test_id)
        if not buffer:
            return 0

        added = 0
        base_idx = len(buffer.active_rubrics)

        for i, rd in enumerate(positive_rubrics):
            rubric = Rubric(
                id=f"{test_id}_a_pos_{base_idx}_{i}",
                description=rd["description"],
                weight=1.0,
                title=rd.get("title", "positive"),
                rubric_type="adaptive",
            )
            buffer.active_rubrics.append(rubric)
            added += 1

        for i, rd in enumerate(negative_rubrics):
            rubric = Rubric(
                id=f"{test_id}_a_neg_{base_idx}_{i}",
                description=rd["description"],
                weight=-1.0,
                title=rd.get("title", "negative"),
                rubric_type="adaptive",
            )
            buffer.active_rubrics.append(rubric)
            added += 1

        return added

    def evolve_rubrics(self) -> dict[str, int]:
        """
        DR Tulu evolution: filter by std dev, cap active rubrics.
        Called after EACH test batch (aggressive mode).

        Returns:
            Metrics about evolution (deactivated count, capped count)
        """
        metrics = {"deactivated": 0, "capped": 0}

        for buffer in self.buffers.values():
            # Deactivate low-std rubrics (no discriminative power)
            to_deactivate = [
                r
                for r in buffer.active_rubrics
                if len(r.scores_history) >= 2 and r.std_dev < self.min_std_threshold
            ]
            for rubric in to_deactivate:
                buffer.active_rubrics.remove(rubric)
                buffer.inactive_rubrics.append(rubric)
                metrics["deactivated"] += 1

            # Cap by std dev (keep highest discriminative power)
            if len(buffer.active_rubrics) > self.max_active_rubrics:
                sorted_rubrics = sorted(
                    buffer.active_rubrics,
                    key=lambda r: r.std_dev,
                    reverse=True,
                )
                buffer.active_rubrics = sorted_rubrics[: self.max_active_rubrics]
                capped = sorted_rubrics[self.max_active_rubrics :]
                buffer.inactive_rubrics.extend(capped)
                metrics["capped"] += len(capped)

        return metrics

    def export_for_eval(self, test_ids: list[str] | None = None) -> list[dict]:
        """Export rubric configs for TypeScript eval runner."""
        return [
            buffer.to_eval_config()
            for test_id, buffer in self.buffers.items()
            if test_ids is None or test_id in test_ids
        ]

    def get_weak_dimensions(self, test_id: str, threshold: float = 0.7) -> list[dict]:
        """
        Get dimensions needing improvement for a test.
        Used to inform prompt generator about specific weaknesses.

        Args:
            test_id: The test case ID
            threshold: Score threshold below which dimension is considered weak

        Returns:
            List of weak dimension info sorted by score (lowest first)
        """
        buffer = self.buffers.get(test_id)
        if not buffer:
            return []

        weak = []
        for rubric in buffer.get_all_active():
            if len(rubric.scores_history) >= 2:
                # For negative rubrics, high score = bad
                if rubric.weight < 0:
                    # High score on negative rubric = exhibiting bad behavior
                    if rubric.mean_score > (1 - threshold):
                        weak.append(
                            {
                                "rubric_id": rubric.id,
                                "description": rubric.description,
                                "avg_score": round(rubric.mean_score, 2),
                                "std_dev": round(rubric.std_dev, 3),
                                "weight": rubric.weight,
                                "issue": "Agent exhibiting bad behavior",
                            }
                        )
                else:
                    # Low score on positive rubric = missing excellence
                    if rubric.mean_score < threshold:
                        weak.append(
                            {
                                "rubric_id": rubric.id,
                                "description": rubric.description,
                                "avg_score": round(rubric.mean_score, 2),
                                "std_dev": round(rubric.std_dev, 3),
                                "weight": rubric.weight,
                                "issue": "Agent missing this quality",
                            }
                        )

        return sorted(weak, key=lambda x: x["avg_score"])

    def get_all_weak_dimensions(self, threshold: float = 0.7) -> dict[str, list[dict]]:
        """Get weak dimensions across all tests."""
        return {
            test_id: self.get_weak_dimensions(test_id, threshold)
            for test_id in self.buffers
        }

    def get_summary(self) -> dict:
        """Get overall manager statistics."""
        total_persistent = sum(len(b.persistent_rubrics) for b in self.buffers.values())
        total_active = sum(len(b.active_rubrics) for b in self.buffers.values())
        total_inactive = sum(len(b.inactive_rubrics) for b in self.buffers.values())

        return {
            "test_count": len(self.buffers),
            "total_persistent_rubrics": total_persistent,
            "total_active_rubrics": total_active,
            "total_inactive_rubrics": total_inactive,
            "max_active_per_test": self.max_active_rubrics,
            "min_std_threshold": self.min_std_threshold,
        }

    def save(self, path: str | Path) -> None:
        """Persist buffer state to JSON file."""
        path = Path(path)
        data = {}
        for test_id, buffer in self.buffers.items():
            data[test_id] = {
                "persistent": [
                    self._rubric_to_dict(r) for r in buffer.persistent_rubrics
                ],
                "active": [self._rubric_to_dict(r) for r in buffer.active_rubrics],
                "inactive": [self._rubric_to_dict(r) for r in buffer.inactive_rubrics],
            }
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def _rubric_to_dict(self, r: Rubric) -> dict:
        """Convert Rubric to dictionary for serialization."""
        return {
            "id": r.id,
            "description": r.description,
            "weight": r.weight,
            "title": r.title,
            "type": r.rubric_type,
            "scores_history": r.scores_history,
        }

    @classmethod
    def load(cls, path: str | Path) -> "RubricManager":
        """Load from persisted state."""
        path = Path(path)
        with open(path) as f:
            data = json.load(f)

        manager = cls()
        for test_id, buffer_data in data.items():
            buffer = TestRubricBuffer(test_id=test_id)

            for rd in buffer_data.get("persistent", []):
                rubric = cls._dict_to_rubric(rd)
                buffer.persistent_rubrics.append(rubric)

            for rd in buffer_data.get("active", []):
                rubric = cls._dict_to_rubric(rd)
                buffer.active_rubrics.append(rubric)

            for rd in buffer_data.get("inactive", []):
                rubric = cls._dict_to_rubric(rd)
                buffer.inactive_rubrics.append(rubric)

            manager.buffers[test_id] = buffer

        return manager

    @staticmethod
    def _dict_to_rubric(rd: dict) -> Rubric:
        """Convert dictionary to Rubric."""
        rubric = Rubric(
            id=rd["id"],
            description=rd["description"],
            weight=rd["weight"],
            title=rd["title"],
            rubric_type=rd["type"],
        )
        rubric.scores_history = rd.get("scores_history", [])
        return rubric
