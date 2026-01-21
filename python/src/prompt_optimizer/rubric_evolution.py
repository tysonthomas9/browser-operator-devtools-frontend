"""
Rubric Evolution Engine - Score computation utilities.

Rubric generation is handled by the rubric-generator subagent via Claude Agent SDK.
This module only contains utilities for score computation.
"""

from typing import Any


def compute_weighted_score(
    rubric_scores: list[dict],
    pass_threshold: float = 0.80,
) -> tuple[float, bool]:
    """
    Compute weighted score using positive/negative weights.

    For positive rubrics (weight > 0):
        high score = good (agent exhibited excellence)
    For negative rubrics (weight < 0):
        low score = good (agent avoided bad behavior)

    Args:
        rubric_scores: List of {rubricId, score, weight, ...}
        pass_threshold: Score threshold for pass/fail decision

    Returns:
        (final_score, passed) tuple
    """
    if not rubric_scores:
        return 0.0, False

    weighted_sum = 0.0
    total_weight = 0.0

    for rs in rubric_scores:
        weight = rs.get("weight", 1.0)
        score = rs.get("score", 0.0)

        # For negative rubrics, invert: high score = bad behavior = low adjusted score
        if weight < 0:
            adjusted = 1.0 - score
        else:
            adjusted = score

        weighted_sum += abs(weight) * adjusted
        total_weight += abs(weight)

    if total_weight == 0:
        return 0.0, False

    final_score = weighted_sum / total_weight
    passed = final_score >= pass_threshold

    return round(final_score, 4), passed


def aggregate_dimensional_results(
    results: list[dict],
    pass_threshold: float = 0.80,
) -> dict[str, Any]:
    """
    Aggregate dimensional results from multiple test runs.

    Args:
        results: List of dimensional evaluation results
        pass_threshold: Score threshold for pass/fail

    Returns:
        Aggregated summary with computed scores
    """
    if not results:
        return {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "average_score": 0.0,
            "pass_rate": 0.0,
        }

    processed = []
    for result in results:
        rubric_scores = result.get("rubricScores", [])
        score, passed = compute_weighted_score(rubric_scores, pass_threshold)

        processed.append(
            {
                "testId": result.get("testId"),
                "testName": result.get("testName"),
                "weightedScore": score,
                "passed": passed,
                "rubricScores": rubric_scores,
                "failureCategory": result.get("failureCategory"),
                "failureReason": result.get("failureReason"),
                "executionData": result.get("executionData", {}),
            }
        )

    passed_count = sum(1 for r in processed if r["passed"])
    failed_count = len(processed) - passed_count
    avg_score = (
        sum(r["weightedScore"] for r in processed) / len(processed)
        if processed
        else 0.0
    )

    return {
        "total": len(processed),
        "passed": passed_count,
        "failed": failed_count,
        "average_score": round(avg_score, 4),
        "pass_rate": round(passed_count / len(processed), 4) if processed else 0.0,
        "results": processed,
    }


def categorize_failures(results: list[dict]) -> dict[str, int]:
    """
    Categorize failures by type for analysis.

    Args:
        results: List of dimensional evaluation results

    Returns:
        Dictionary mapping failure category to count
    """
    categories: dict[str, int] = {}

    for result in results:
        # Only count failures
        if result.get("passed"):
            continue

        category = result.get("failureCategory", "unknown")
        categories[category] = categories.get(category, 0) + 1

    return categories


def identify_systematic_issues(results: list[dict]) -> list[dict]:
    """
    Identify systematic issues across multiple test results.
    Useful for informing prompt improvements.

    Args:
        results: List of dimensional evaluation results

    Returns:
        List of identified issues with frequency and severity
    """
    # Group rubric scores by rubric description
    rubric_aggregates: dict[str, list[float]] = {}
    rubric_weights: dict[str, float] = {}

    for result in results:
        for rs in result.get("rubricScores", []):
            desc = rs.get("description", "unknown")
            score = rs.get("score", 0.0)
            weight = rs.get("weight", 1.0)

            if desc not in rubric_aggregates:
                rubric_aggregates[desc] = []
                rubric_weights[desc] = weight

            rubric_aggregates[desc].append(score)

    # Identify systematic issues
    issues = []
    for desc, scores in rubric_aggregates.items():
        if len(scores) < 2:
            continue

        avg = sum(scores) / len(scores)
        weight = rubric_weights[desc]

        # For positive rubrics: low average = systematic weakness
        # For negative rubrics: high average = systematic bad behavior
        is_issue = (weight > 0 and avg < 0.7) or (weight < 0 and avg > 0.3)

        if is_issue:
            issues.append(
                {
                    "description": desc,
                    "avg_score": round(avg, 2),
                    "sample_count": len(scores),
                    "weight": weight,
                    "issue_type": (
                        "missing_quality" if weight > 0 else "bad_behavior"
                    ),
                    "severity": abs(0.5 - avg),  # Distance from neutral
                }
            )

    # Sort by severity
    return sorted(issues, key=lambda x: x["severity"], reverse=True)


def format_weak_dimensions_for_prompt(
    weak_dimensions: dict[str, list[dict]],
    max_items: int = 10,
) -> str:
    """
    Format weak dimensions for inclusion in prompt generator context.

    Args:
        weak_dimensions: Dictionary from RubricManager.get_all_weak_dimensions()
        max_items: Maximum items to include

    Returns:
        Formatted string for prompt generator
    """
    all_weak = []
    for test_id, dims in weak_dimensions.items():
        for dim in dims:
            all_weak.append({**dim, "test_id": test_id})

    if not all_weak:
        return "All rubric dimensions performing well."

    # Sort by score (lowest first for positive, highest first for negative)
    sorted_weak = sorted(
        all_weak,
        key=lambda x: x["avg_score"] if x["weight"] > 0 else -x["avg_score"],
    )[:max_items]

    lines = ["Focus prompt improvements on these weak areas:"]
    for w in sorted_weak:
        weight_type = "negative" if w["weight"] < 0 else "positive"
        lines.append(
            f"- [{w['test_id']}] {w['description'][:80]}... "
            f"(avg: {w['avg_score']}, std: {w['std_dev']}, {weight_type}) - {w['issue']}"
        )

    return "\n".join(lines)
