#!/usr/bin/env python3
"""
Enhanced Browsecomp Scorer with 10-Point Scale
Implements multi-dimensional scoring based on 2024 LLM evaluation best practices
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import urllib.parse
from browsecomp_scorer import normalize_answer, extract_number, compare_numeric_answers, extract_answer


class EnhancedScorer:
    """
    Enhanced scoring system for browsecomp evaluations using 10-point scales
    across multiple dimensions of agent performance.
    """
    
    def __init__(self):
        # Patterns for detecting citations and evidence
        self.url_pattern = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+')
        self.citation_patterns = [
            r'according to \w+',
            r'source:?\s*\w+',
            r'from \w+\.com',
            r'based on \w+',
            r'found (?:on|at) \w+',
            r'as stated (?:by|on) \w+',
        ]
        
        # Tool efficiency thresholds
        self.efficiency_thresholds = {
            'optimal': 3,      # <= 3 tool calls for most questions
            'good': 5,         # <= 5 tool calls
            'acceptable': 8,   # <= 8 tool calls
            'poor': 12,        # <= 12 tool calls
        }
    
    def score_correctness(self, response: str, true_answer: str, extracted_answer: str = None) -> float:
        """
        Score answer correctness on 0-10 scale with granular levels.
        
        Args:
            response: Full agent response
            true_answer: Expected correct answer
            extracted_answer: Pre-extracted answer (optional)
            
        Returns:
            Score from 0-10
        """
        if not response or not true_answer:
            return 0.0
            
        # Use provided extracted answer or extract it
        if extracted_answer is None:
            extracted_answer = extract_answer(response)
        if not extracted_answer:
            extracted_answer = response
            
        # Normalize both answers
        pred_norm = normalize_answer(extracted_answer)
        true_norm = normalize_answer(true_answer)
        
        # Perfect match
        if pred_norm == true_norm:
            return 10.0
            
        # Check for exact substring match (high confidence)
        if true_norm in pred_norm or pred_norm in true_norm:
            # If the match is very close in length, score higher
            length_ratio = min(len(pred_norm), len(true_norm)) / max(len(pred_norm), len(true_norm))
            if length_ratio > 0.8:
                return 9.0
            else:
                return 8.0
                
        # Numeric comparison with tolerance
        if any(char.isdigit() for char in true_answer):
            if compare_numeric_answers(extracted_answer, true_answer, tolerance=0.01):
                return 10.0
            elif compare_numeric_answers(extracted_answer, true_answer, tolerance=0.05):
                return 9.0
            elif compare_numeric_answers(extracted_answer, true_answer, tolerance=0.10):
                return 7.0
                
        # Semantic similarity checks
        true_words = set(true_norm.split())
        pred_words = set(pred_norm.split())
        
        if len(true_words) > 0:
            word_overlap = len(true_words & pred_words) / len(true_words)
            
            if word_overlap >= 0.8:
                return 7.0
            elif word_overlap >= 0.6:
                return 6.0
            elif word_overlap >= 0.4:
                return 5.0
            elif word_overlap >= 0.2:
                return 4.0
                
        # Check if any key terms from true answer appear anywhere in response
        key_terms = [word for word in true_words if len(word) > 3]
        if key_terms:
            found_terms = sum(1 for term in key_terms if term in response.lower())
            term_ratio = found_terms / len(key_terms)
            
            if term_ratio >= 0.5:
                return 3.0
            elif term_ratio > 0:
                return 2.0
                
        # Check for attempt vs no attempt
        if len(extracted_answer.strip()) > 10:  # Some substantial attempt
            return 1.0
            
        return 0.0
    
    def score_task_completion(self, messages: List[Dict], tool_calls: List[Dict]) -> float:
        """
        Score task completion based on agent behavior and progression.
        
        Args:
            messages: Full conversation history
            tool_calls: List of tool calls made
            
        Returns:
            Score from 0-10
        """
        if not messages and not tool_calls:
            return 0.0
            
        score = 0.0
        
        # Base score for attempting the task
        if messages or tool_calls:
            score += 2.0
            
        # Check for search activity
        search_tools = [call for call in tool_calls if 'search' in call.get('tool', '').lower()]
        if search_tools:
            score += 2.0
            
        # Check for successful tool calls
        successful_calls = [call for call in tool_calls if call.get('status') == 'success']
        if tool_calls:
            success_ratio = len(successful_calls) / len(tool_calls)
            score += success_ratio * 3.0
            
        # Check for evidence of finding information
        has_findings = any(
            'found' in msg.get('answer', '').lower() or 
            'according' in msg.get('answer', '').lower() or
            'shows' in msg.get('answer', '').lower()
            for msg in messages 
            if isinstance(msg, dict) and msg.get('entity') == 'model'
        )
        if has_findings:
            score += 2.0
            
        # Check progression in messages
        if len(messages) > 1:
            # Look for iterative improvement
            model_messages = [msg for msg in messages if isinstance(msg, dict) and msg.get('entity') == 'model']
            if len(model_messages) > 1:
                score += 1.0
                
        return min(score, 10.0)
    
    def score_evidence_quality(self, response_text: str) -> float:
        """
        Score the quality of evidence and citations in the response.
        
        Args:
            response_text: Full response text to analyze
            
        Returns:
            Score from 0-10
        """
        if not response_text:
            return 0.0
            
        score = 0.0
        response_lower = response_text.lower()
        
        # Check for URLs (highest quality evidence)
        urls = self.url_pattern.findall(response_text)
        if urls:
            score += 4.0
            # Bonus for multiple sources
            if len(urls) > 1:
                score += 1.0
                
        # Check for citation patterns
        citation_count = 0
        for pattern in self.citation_patterns:
            if re.search(pattern, response_lower):
                citation_count += 1
                
        if citation_count > 0:
            score += min(citation_count * 1.5, 3.0)
            
        # Check for specific factual indicators
        factual_indicators = [
            'according to',
            'research shows',
            'study found',
            'data indicates',
            'statistics show',
            'report states',
            'article mentions',
            'website shows',
            'page indicates',
        ]
        
        factual_count = sum(1 for indicator in factual_indicators if indicator in response_lower)
        if factual_count > 0:
            score += min(factual_count * 0.5, 2.0)
            
        # Check for specificity (dates, numbers, proper nouns)
        specificity_score = 0
        
        # Dates
        date_patterns = [r'\d{4}', r'\d{1,2}/\d{1,2}/\d{4}', r'(january|february|march|april|may|june|july|august|september|october|november|december)', r'\d{1,2}th', r'\d{1,2}st', r'\d{1,2}nd', r'\d{1,2}rd']
        for pattern in date_patterns:
            if re.search(pattern, response_lower):
                specificity_score += 0.3
                break
                
        # Numbers/statistics
        if re.search(r'\d+%|\d+\.\d+|\d+,\d+', response_text):
            specificity_score += 0.5
            
        # Proper nouns (capitalized words)
        proper_nouns = re.findall(r'\b[A-Z][a-z]+', response_text)
        # Filter out sentence starters
        sentences = re.split(r'[.!?]+', response_text)
        sentence_starters = set()
        for sentence in sentences:
            words = sentence.strip().split()
            if words and len(words[0]) > 1:
                sentence_starters.add(words[0])
        
        actual_proper_nouns = [noun for noun in proper_nouns if noun not in sentence_starters]
        if len(actual_proper_nouns) > 2:
            specificity_score += 0.7
            
        score += min(specificity_score, 1.0)
        
        return min(score, 10.0)
    
    def score_reasoning_quality(self, messages: List[Dict]) -> float:
        """
        Score the quality of reasoning shown in the conversation.
        
        Args:
            messages: Full conversation history
            
        Returns:
            Score from 0-10
        """
        if not messages:
            return 0.0
            
        score = 0.0
        
        # Extract model messages for analysis
        model_messages = [
            msg.get('answer', '') for msg in messages 
            if isinstance(msg, dict) and msg.get('entity') == 'model' and msg.get('answer')
        ]
        
        if not model_messages:
            return 0.0
            
        full_response = ' '.join(model_messages)
        response_lower = full_response.lower()
        
        # Check for step-by-step reasoning
        step_indicators = [
            'first', 'second', 'third', 'next', 'then', 'finally',
            'step 1', 'step 2', '1.', '2.', '3.',
            'initially', 'afterwards', 'subsequently'
        ]
        
        step_count = sum(1 for indicator in step_indicators if indicator in response_lower)
        if step_count >= 3:
            score += 3.0
        elif step_count >= 2:
            score += 2.0
        elif step_count >= 1:
            score += 1.0
            
        # Check for logical connectors
        logical_connectors = [
            'because', 'since', 'therefore', 'thus', 'however', 'although',
            'in order to', 'as a result', 'consequently', 'furthermore',
            'moreover', 'on the other hand', 'in contrast'
        ]
        
        connector_count = sum(1 for connector in logical_connectors if connector in response_lower)
        score += min(connector_count * 0.5, 2.0)
        
        # Check for explanation of search strategy
        strategy_indicators = [
            'i searched for', 'i looked for', 'i need to find',
            'let me search', 'i\'ll search', 'searching for',
            'my approach', 'strategy', 'plan is to'
        ]
        
        if any(indicator in response_lower for indicator in strategy_indicators):
            score += 2.0
            
        # Check for acknowledgment of uncertainty or limitations
        uncertainty_indicators = [
            'might', 'could', 'possibly', 'appears to', 'seems to',
            'uncertain', 'not sure', 'unclear', 'may be'
        ]
        
        if any(indicator in response_lower for indicator in uncertainty_indicators):
            score += 1.0
            
        # Check for explanation of findings
        explanation_indicators = [
            'this means', 'this indicates', 'this suggests',
            'in other words', 'essentially', 'basically'
        ]
        
        if any(indicator in response_lower for indicator in explanation_indicators):
            score += 2.0
            
        return min(score, 10.0)
    
    def score_tool_efficiency(self, tool_calls: List[Dict], execution_time_ms: int) -> float:
        """
        Score tool usage efficiency based on call patterns and timing.
        
        Args:
            tool_calls: List of tool calls made
            execution_time_ms: Total execution time in milliseconds
            
        Returns:
            Score from 0-10
        """
        if not tool_calls:
            return 0.0
            
        score = 10.0  # Start with perfect score and deduct
        
        # Analyze tool call count
        total_calls = len(tool_calls)
        
        if total_calls <= self.efficiency_thresholds['optimal']:
            # Optimal efficiency
            pass  # Keep perfect score
        elif total_calls <= self.efficiency_thresholds['good']:
            score -= 1.0
        elif total_calls <= self.efficiency_thresholds['acceptable']:
            score -= 3.0
        elif total_calls <= self.efficiency_thresholds['poor']:
            score -= 5.0
        else:
            score -= 7.0
            
        # Check for failed tool calls
        failed_calls = [call for call in tool_calls if call.get('status') == 'failed']
        if failed_calls:
            failure_rate = len(failed_calls) / total_calls
            score -= failure_rate * 3.0
            
        # Check for redundant searches (same tool used multiple times)
        tool_types = [call.get('tool', '') for call in tool_calls]
        unique_tools = set(tool_types)
        if len(unique_tools) < len(tool_types):
            redundancy = 1 - (len(unique_tools) / len(tool_types))
            score -= redundancy * 2.0
            
        # Check execution time efficiency
        if execution_time_ms > 0:
            # Penalize if taking too long (> 5 minutes)
            if execution_time_ms > 300000:  # 5 minutes
                score -= 2.0
            elif execution_time_ms > 600000:  # 10 minutes
                score -= 4.0
                
        # Check for tool call duration patterns
        long_duration_calls = [
            call for call in tool_calls 
            if call.get('duration', 0) > 30000  # > 30 seconds
        ]
        if long_duration_calls:
            score -= len(long_duration_calls) * 0.5
            
        return max(score, 0.0)
    
    def calculate_composite_scores(self, scores: Dict[str, float]) -> Dict[str, float]:
        """
        Calculate composite scores from individual dimension scores.
        
        Args:
            scores: Dictionary of individual dimension scores
            
        Returns:
            Dictionary with composite scores added
        """
        # Quality score: average of correctness, evidence, and reasoning
        quality_components = [
            scores.get('correctness_10', 0),
            scores.get('evidence_quality_10', 0),
            scores.get('reasoning_quality_10', 0)
        ]
        scores['quality_score_10'] = sum(quality_components) / len(quality_components)
        
        # Efficiency score: average of task completion and tool efficiency
        efficiency_components = [
            scores.get('task_completion_10', 0),
            scores.get('tool_efficiency_10', 0)
        ]
        scores['efficiency_score_10'] = sum(efficiency_components) / len(efficiency_components)
        
        # Overall score: weighted average emphasizing correctness
        weights = {
            'correctness_10': 0.4,
            'task_completion_10': 0.2,
            'evidence_quality_10': 0.15,
            'reasoning_quality_10': 0.15,
            'tool_efficiency_10': 0.1
        }
        
        weighted_sum = sum(
            scores.get(key, 0) * weight 
            for key, weight in weights.items()
        )
        scores['overall_score_10'] = weighted_sum
        
        # Convert to binary for backward compatibility
        scores['correctness_binary'] = 1.0 if scores.get('correctness_10', 0) >= 6.0 else 0.0
        
        return scores
    
    def score_evaluation(
        self, 
        response_text: str, 
        true_answer: str, 
        messages: List[Dict], 
        tool_calls: List[Dict],
        execution_time_ms: int,
        extracted_answer: str = None
    ) -> Dict[str, float]:
        """
        Score an evaluation across all dimensions.
        
        Args:
            response_text: Full response text
            true_answer: Expected correct answer
            messages: Full conversation history
            tool_calls: List of tool calls made
            execution_time_ms: Total execution time
            extracted_answer: Pre-extracted answer (optional)
            
        Returns:
            Dictionary of all scores
        """
        scores = {
            'correctness_10': self.score_correctness(response_text, true_answer, extracted_answer),
            'task_completion_10': self.score_task_completion(messages, tool_calls),
            'evidence_quality_10': self.score_evidence_quality(response_text),
            'reasoning_quality_10': self.score_reasoning_quality(messages),
            'tool_efficiency_10': self.score_tool_efficiency(tool_calls, execution_time_ms),
        }
        
        # Calculate composite scores
        scores = self.calculate_composite_scores(scores)
        
        return scores
    
    def format_score_report(self, scores: Dict[str, float]) -> str:
        """
        Format scores into a human-readable report.
        
        Args:
            scores: Dictionary of scores
            
        Returns:
            Formatted score report string
        """
        def score_to_grade(score: float) -> str:
            if score >= 9.0:
                return "Excellent"
            elif score >= 8.0:
                return "Very Good"
            elif score >= 7.0:
                return "Good"
            elif score >= 6.0:
                return "Satisfactory"
            elif score >= 4.0:
                return "Fair"
            elif score >= 2.0:
                return "Poor"
            else:
                return "Very Poor"
        
        report = []
        report.append("🎯 Enhanced Scoring Results (10-point scale):")
        
        # Individual dimensions
        dimensions = [
            ('Answer Correctness', 'correctness_10'),
            ('Task Completion', 'task_completion_10'),
            ('Evidence Quality', 'evidence_quality_10'),
            ('Reasoning Quality', 'reasoning_quality_10'),
            ('Tool Efficiency', 'tool_efficiency_10'),
        ]
        
        for name, key in dimensions:
            score = scores.get(key, 0.0)
            grade = score_to_grade(score)
            report.append(f"   {name:18} {score:4.1f}/10 - {grade}")
        
        report.append("   " + "─" * 50)
        
        # Composite scores
        overall = scores.get('overall_score_10', 0.0)
        quality = scores.get('quality_score_10', 0.0)
        efficiency = scores.get('efficiency_score_10', 0.0)
        
        report.append(f"   Overall Score:     {overall:4.1f}/10 - {score_to_grade(overall)}")
        report.append(f"   Quality Score:     {quality:4.1f}/10 - {score_to_grade(quality)}")
        report.append(f"   Efficiency Score:  {efficiency:4.1f}/10 - {score_to_grade(efficiency)}")
        
        return "\n".join(report)


# Convenience function for backward compatibility
def enhanced_question_scorer(
    prediction: str, 
    true_answer: str, 
    messages: List[Dict] = None,
    tool_calls: List[Dict] = None,
    execution_time_ms: int = 0
) -> Dict[str, Any]:
    """
    Enhanced scoring function that returns both old and new format scores.
    
    Args:
        prediction: Agent's response
        true_answer: Expected answer
        messages: Conversation history (optional)
        tool_calls: Tool call history (optional)
        execution_time_ms: Execution time (optional)
        
    Returns:
        Dictionary with both binary and 10-point scores
    """
    scorer = EnhancedScorer()
    
    # Calculate enhanced scores
    enhanced_scores = scorer.score_evaluation(
        response_text=prediction,
        true_answer=true_answer,
        messages=messages or [],
        tool_calls=tool_calls or [],
        execution_time_ms=execution_time_ms
    )
    
    # Add metadata
    enhanced_scores.update({
        'tool_calls_count': len(tool_calls) if tool_calls else 0,
        'execution_time_ms': execution_time_ms,
        'message_count': len(messages) if messages else 0,
    })
    
    return enhanced_scores


# Example usage and testing
if __name__ == "__main__":
    scorer = EnhancedScorer()
    
    # Test case
    test_response = "According to Wikipedia, the capital of France is Paris. I found this information by searching for 'France capital' and the official government website confirms this fact."
    test_answer = "Paris"
    test_messages = [
        {"entity": "user", "text": "What is the capital of France?"},
        {"entity": "model", "answer": "I'll search for information about France's capital."},
        {"entity": "tool_result", "resultText": "France is a country in Europe with capital Paris"},
        {"entity": "model", "answer": test_response}
    ]
    test_tool_calls = [
        {"tool": "search", "status": "success", "duration": 2000},
        {"tool": "web_search", "status": "success", "duration": 3000}
    ]
    
    scores = scorer.score_evaluation(
        response_text=test_response,
        true_answer=test_answer,
        messages=test_messages,
        tool_calls=test_tool_calls,
        execution_time_ms=5000
    )
    
    print(scorer.format_score_report(scores))
    print("\nDetailed scores:")
    for key, value in scores.items():
        print(f"  {key}: {value:.2f}")