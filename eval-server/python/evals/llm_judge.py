#!/usr/bin/env python3
"""
LLM-as-Judge Scoring System
Implements state-of-the-art LLM-based evaluation for browsecomp tasks
"""

import asyncio
import json
import hashlib
import os
import time
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import logging

try:
    import litellm
    import openai
    HAS_LLM_SUPPORT = True
except ImportError:
    HAS_LLM_SUPPORT = False

logger = logging.getLogger(__name__)


class LLMJudgeCache:
    """Simple file-based cache for LLM evaluations to reduce costs."""
    
    def __init__(self, cache_dir: str = "./llm_judge_cache", ttl_hours: int = 24):
        self.cache_dir = cache_dir
        self.ttl_hours = ttl_hours
        os.makedirs(cache_dir, exist_ok=True)
    
    def _get_cache_key(self, prompt: str, model: str) -> str:
        """Generate cache key from prompt and model."""
        content = f"{model}:{prompt}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def _get_cache_path(self, cache_key: str) -> str:
        """Get cache file path."""
        return os.path.join(self.cache_dir, f"{cache_key}.json")
    
    def get(self, prompt: str, model: str) -> Optional[Dict[str, Any]]:
        """Get cached result if valid."""
        cache_key = self._get_cache_key(prompt, model)
        cache_path = self._get_cache_path(cache_key)
        
        if not os.path.exists(cache_path):
            return None
        
        try:
            with open(cache_path, 'r') as f:
                data = json.load(f)
            
            # Check if cache is expired
            cached_time = datetime.fromisoformat(data['timestamp'])
            if datetime.now() - cached_time > timedelta(hours=self.ttl_hours):
                os.remove(cache_path)  # Clean up expired cache
                return None
            
            return data['result']
        except Exception as e:
            logger.warning(f"Failed to read cache: {e}")
            return None
    
    def set(self, prompt: str, model: str, result: Dict[str, Any]) -> None:
        """Cache result."""
        cache_key = self._get_cache_key(prompt, model)
        cache_path = self._get_cache_path(cache_key)
        
        try:
            data = {
                'timestamp': datetime.now().isoformat(),
                'result': result
            }
            with open(cache_path, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            logger.warning(f"Failed to write cache: {e}")


class LLMJudge:
    """
    LLM-based judge for evaluating agent responses across multiple dimensions.
    Uses structured prompts and JSON responses for reliable scoring.
    """
    
    def __init__(
        self,
        model: str = "gpt-4-turbo-preview",
        cache_enabled: bool = True,
        max_retries: int = 3,
        sample_rate: float = 1.0,
        confidence_threshold: float = 0.85
    ):
        if not HAS_LLM_SUPPORT:
            raise ImportError("LLM support not available. Install: pip install litellm openai")
        
        self.model = model
        self.cache = LLMJudgeCache() if cache_enabled else None
        self.max_retries = max_retries
        self.sample_rate = sample_rate
        self.confidence_threshold = confidence_threshold
        
        # Set up litellm
        litellm.drop_params = True  # Drop unsupported parameters
        litellm.set_verbose = False
    
    async def _call_llm(self, prompt: str, system_prompt: str = None) -> Dict[str, Any]:
        """Call LLM with retry logic and caching."""
        # Check cache first
        if self.cache:
            cached_result = self.cache.get(prompt + (system_prompt or ""), self.model)
            if cached_result:
                return cached_result
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = await litellm.acompletion(
                    model=self.model,
                    messages=messages,
                    temperature=0.1,  # Low temperature for consistent scoring
                    max_tokens=1000,
                    response_format={"type": "json_object"}  # Force JSON response
                )
                
                content = response.choices[0].message.content.strip()
                result = json.loads(content)
                
                # Cache the result
                if self.cache:
                    self.cache.set(prompt + (system_prompt or ""), self.model, result)
                
                return result
                
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON on attempt {attempt + 1}: {e}")
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    
            except Exception as e:
                logger.error(f"LLM call failed on attempt {attempt + 1}: {e}")
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
        
        # If all attempts failed, return error result
        return {
            "score": 0.0,
            "confidence": 0.0,
            "reasoning": f"LLM evaluation failed after {self.max_retries} attempts: {last_error}",
            "error": str(last_error)
        }
    
    async def score_correctness(
        self,
        question: str,
        true_answer: str,
        response: str,
        context: str = None
    ) -> Dict[str, Any]:
        """
        Score answer correctness using LLM understanding of semantics and context.
        """
        system_prompt = """You are an expert evaluator for web browsing AI agents. 
        Your task is to score the correctness of answers on a 0-10 scale.
        Consider semantic equivalence, paraphrases, and partial correctness.
        Always return valid JSON with the exact format specified."""
        
        context_section = f"\nAdditional Context from Search: {context}" if context else ""
        
        prompt = f"""Evaluate the correctness of this answer on a 0-10 scale.

Question: {question}

Expected Answer: {true_answer}

Given Answer: {response}{context_section}

Scoring Guidelines:
- 10: Perfect match or semantically equivalent
- 8-9: Correct with minor differences in phrasing
- 6-7: Mostly correct but missing some details
- 4-5: Partially correct, captures main idea
- 2-3: Some relevant information but mostly incorrect
- 0-1: Completely wrong or no answer

Consider:
- Semantic equivalence (different phrasing of same fact)
- Completeness relative to what was asked
- Factual accuracy
- Context and nuance

Return JSON format:
{{
    "score": <float 0-10>,
    "confidence": <float 0-1>,
    "reasoning": "<detailed explanation>",
    "extracted_answer": "<the actual answer found in response>",
    "semantic_match": <boolean>,
    "completeness": <float 0-1>
}}"""
        
        return await self._call_llm(prompt, system_prompt)
    
    async def score_evidence_quality(
        self,
        question: str,
        response: str,
        tool_calls: List[Dict[str, Any]],
        search_context: str = None
    ) -> Dict[str, Any]:
        """
        Score the quality of evidence and citations in the response.
        """
        system_prompt = """You are evaluating how well an AI agent supports its answers with evidence.
        Score the quality of sources, citations, and verification on a 0-10 scale.
        Look for specific URLs, authoritative sources, and proper attribution."""
        
        tool_summary = self._summarize_tool_calls(tool_calls)
        search_section = f"\nSearch Results Context: {search_context}" if search_context else ""
        
        prompt = f"""Evaluate the evidence quality in this response on a 0-10 scale.

Question: {question}

Response: {response}

Tools Used: {tool_summary}{search_section}

Scoring Guidelines:
- 10: Multiple authoritative sources with specific URLs/citations
- 8-9: Good sources with some specific attribution
- 6-7: Some evidence provided but could be more specific
- 4-5: General claims with minimal supporting evidence
- 2-3: Weak or questionable sources
- 0-1: No evidence or completely unsupported claims

Consider:
- Specific URLs, websites, or publications mentioned
- Authority and credibility of sources
- Proper attribution and citation format
- Verification through multiple sources
- Specificity of factual claims (dates, numbers, names)

Return JSON format:
{{
    "score": <float 0-10>,
    "confidence": <float 0-1>,
    "reasoning": "<detailed explanation>",
    "sources_mentioned": <list of sources found>,
    "citation_quality": <float 0-1>,
    "specificity": <float 0-1>,
    "verification_level": <float 0-1>
}}"""
        
        return await self._call_llm(prompt, system_prompt)
    
    async def score_reasoning_quality(
        self,
        question: str,
        messages: List[Dict[str, Any]],
        final_response: str
    ) -> Dict[str, Any]:
        """
        Score the quality of reasoning and problem-solving approach.
        """
        system_prompt = """You are evaluating an AI agent's reasoning and problem-solving approach.
        Score the logical flow, methodology, and strategic thinking on a 0-10 scale.
        Look for clear steps, good search strategy, and logical progression."""
        
        conversation_summary = self._summarize_conversation(messages)
        
        prompt = f"""Evaluate the reasoning quality in this agent's approach on a 0-10 scale.

Question: {question}

Agent Conversation Flow:
{conversation_summary}

Final Response: {final_response}

Scoring Guidelines:
- 10: Excellent strategic thinking, clear methodology, logical flow
- 8-9: Good reasoning with clear steps and strategy
- 6-7: Adequate approach with some logical progression
- 4-5: Basic reasoning present but could be clearer
- 2-3: Confused or inconsistent reasoning
- 0-1: No clear reasoning or completely illogical

Consider:
- Search strategy and methodology
- Step-by-step logical progression
- Adaptation when initial approaches don't work
- Clear explanation of reasoning process
- Integration of findings into coherent answer

Return JSON format:
{{
    "score": <float 0-10>,
    "confidence": <float 0-1>,
    "reasoning": "<detailed explanation>",
    "strategy_quality": <float 0-1>,
    "logical_flow": <float 0-1>,
    "adaptability": <float 0-1>,
    "explanation_clarity": <float 0-1>
}}"""
        
        return await self._call_llm(prompt, system_prompt)
    
    async def score_task_completion(
        self,
        question: str,
        response: str,
        tool_calls: List[Dict[str, Any]],
        success_indicators: List[str] = None
    ) -> Dict[str, Any]:
        """
        Score how well the agent completed the browsing task.
        """
        system_prompt = """You are evaluating how effectively an AI agent completed a web browsing task.
        Score the task completion on a 0-10 scale based on whether the agent successfully
        found and presented the requested information."""
        
        tool_summary = self._summarize_tool_calls(tool_calls)
        indicators = success_indicators or []
        
        prompt = f"""Evaluate task completion for this web browsing question on a 0-10 scale.

Question: {question}

Agent Response: {response}

Tools Used: {tool_summary}

Expected Success Indicators: {indicators}

Scoring Guidelines:
- 10: Completely successful, found exactly what was needed
- 8-9: Very successful with minor gaps
- 6-7: Mostly successful but missed some aspects
- 4-5: Partially successful, got some relevant information
- 2-3: Minimal success, struggled to find information
- 0-1: Failed to complete the task

Consider:
- Whether the agent found the specific information requested
- Effectiveness of search and navigation strategy
- Completeness of information gathering
- Ability to synthesize findings into answer

Return JSON format:
{{
    "score": <float 0-10>,
    "confidence": <float 0-1>,
    "reasoning": "<detailed explanation>",
    "information_found": <boolean>,
    "search_effectiveness": <float 0-1>,
    "completeness": <float 0-1>,
    "synthesis_quality": <float 0-1>
}}"""
        
        return await self._call_llm(prompt, system_prompt)
    
    async def score_efficiency(
        self,
        question: str,
        tool_calls: List[Dict[str, Any]],
        execution_time_ms: int,
        response: str
    ) -> Dict[str, Any]:
        """
        Score the efficiency of the agent's approach.
        """
        system_prompt = """You are evaluating an AI agent's efficiency in completing web browsing tasks.
        Score the efficiency on a 0-10 scale based on tool usage, time, and directness of approach."""
        
        tool_summary = self._summarize_tool_calls(tool_calls)
        execution_minutes = execution_time_ms / 60000.0
        
        prompt = f"""Evaluate the efficiency of this agent's approach on a 0-10 scale.

Question: {question}

Tool Usage: {tool_summary}

Execution Time: {execution_minutes:.1f} minutes

Response Quality: {len(response)} characters

Scoring Guidelines:
- 10: Optimal path with minimal redundant actions
- 8-9: Efficient with only minor inefficiencies
- 6-7: Reasonable efficiency but some wasted effort
- 4-5: Moderately inefficient, several redundant actions
- 2-3: Poor efficiency, many failed attempts
- 0-1: Extremely inefficient or stuck in loops

Consider:
- Number and type of tool calls made
- Redundant searches or repeated failures
- Time taken relative to task complexity
- Direct vs. circuitous path to answer
- Quality of result relative to effort expended

Return JSON format:
{{
    "score": <float 0-10>,
    "confidence": <float 0-1>,
    "reasoning": "<detailed explanation>",
    "tool_efficiency": <float 0-1>,
    "time_efficiency": <float 0-1>,
    "path_directness": <float 0-1>,
    "effort_to_result_ratio": <float 0-1>
}}"""
        
        return await self._call_llm(prompt, system_prompt)
    
    def _summarize_tool_calls(self, tool_calls: List[Dict[str, Any]]) -> str:
        """Summarize tool calls for LLM context."""
        if not tool_calls:
            return "No tools used"
        
        summary = []
        for i, call in enumerate(tool_calls[:10]):  # Limit to avoid token overflow
            tool = call.get('tool', 'unknown')
            status = call.get('status', 'unknown')
            duration = call.get('duration', 0) / 1000.0  # Convert to seconds
            summary.append(f"{i+1}. {tool} ({status}) - {duration:.1f}s")
        
        if len(tool_calls) > 10:
            summary.append(f"... and {len(tool_calls) - 10} more tool calls")
        
        return "\n".join(summary)
    
    def _summarize_conversation(self, messages: List[Dict[str, Any]]) -> str:
        """Summarize conversation flow for LLM context."""
        if not messages:
            return "No conversation available"
        
        summary = []
        for i, msg in enumerate(messages[:20]):  # Limit to avoid token overflow
            entity = msg.get('entity', 'unknown')
            if entity == 'model' and msg.get('answer'):
                content = msg['answer'][:200] + "..." if len(msg['answer']) > 200 else msg['answer']
                summary.append(f"Agent: {content}")
            elif entity == 'tool_result' and msg.get('resultText'):
                content = msg['resultText'][:100] + "..." if len(msg['resultText']) > 100 else msg['resultText']
                summary.append(f"Tool Result: {content}")
            elif entity == 'user' and msg.get('text'):
                summary.append(f"User: {msg['text']}")
        
        return "\n".join(summary)
    
    async def evaluate_comprehensive(
        self,
        question: str,
        true_answer: str,
        response: str,
        messages: List[Dict[str, Any]] = None,
        tool_calls: List[Dict[str, Any]] = None,
        execution_time_ms: int = 0,
        context: str = None
    ) -> Dict[str, Any]:
        """
        Comprehensive evaluation across all dimensions using LLM judge.
        
        Returns:
            Dictionary with all scores and detailed analysis
        """
        # Skip evaluation based on sample rate
        if self.sample_rate < 1.0:
            import random
            if random.random() > self.sample_rate:
                return {
                    "llm_judge_skipped": True,
                    "sample_rate": self.sample_rate,
                    "message": "Evaluation skipped due to sampling rate"
                }
        
        messages = messages or []
        tool_calls = tool_calls or []
        
        # Run all evaluations concurrently
        tasks = [
            self.score_correctness(question, true_answer, response, context),
            self.score_evidence_quality(question, response, tool_calls, context),
            self.score_reasoning_quality(question, messages, response),
            self.score_task_completion(question, response, tool_calls),
            self.score_efficiency(question, tool_calls, execution_time_ms, response)
        ]
        
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:
            logger.error(f"Failed to run LLM evaluations: {e}")
            return {"error": str(e)}
        
        # Process results
        evaluation = {
            "llm_judge_enabled": True,
            "model": self.model,
            "timestamp": datetime.now().isoformat(),
        }
        
        dimension_names = [
            "correctness", "evidence_quality", "reasoning_quality", 
            "task_completion", "efficiency"
        ]
        
        scores = []
        confidences = []
        
        for i, (dimension, result) in enumerate(zip(dimension_names, results)):
            if isinstance(result, Exception):
                logger.error(f"Failed to evaluate {dimension}: {result}")
                evaluation[f"{dimension}_llm"] = {
                    "score": 0.0,
                    "confidence": 0.0,
                    "error": str(result)
                }
            else:
                evaluation[f"{dimension}_llm"] = result
                scores.append(result.get("score", 0.0))
                confidences.append(result.get("confidence", 0.0))
        
        # Calculate composite scores
        if scores:
            evaluation["overall_score_llm"] = sum(scores) / len(scores)
            evaluation["average_confidence"] = sum(confidences) / len(confidences)
            
            # Quality score (correctness + evidence + reasoning)
            quality_scores = scores[:3] if len(scores) >= 3 else scores
            evaluation["quality_score_llm"] = sum(quality_scores) / len(quality_scores)
            
            # Efficiency score (task completion + efficiency)
            efficiency_scores = scores[3:5] if len(scores) >= 5 else scores[-2:]
            evaluation["efficiency_score_llm"] = sum(efficiency_scores) / len(efficiency_scores)
        
        return evaluation


# Convenience function for integration
async def llm_evaluate_response(
    question: str,
    true_answer: str,
    response: str,
    messages: List[Dict[str, Any]] = None,
    tool_calls: List[Dict[str, Any]] = None,
    execution_time_ms: int = 0,
    model: str = "gpt-4-turbo-preview",
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience function for LLM-based evaluation.
    
    Args:
        question: The original question
        true_answer: Expected correct answer
        response: Agent's response
        messages: Conversation history
        tool_calls: Tool calls made
        execution_time_ms: Execution time
        model: LLM model to use
        **kwargs: Additional configuration
        
    Returns:
        Dictionary with LLM evaluation results
    """
    judge = LLMJudge(model=model, **kwargs)
    return await judge.evaluate_comprehensive(
        question=question,
        true_answer=true_answer,
        response=response,
        messages=messages,
        tool_calls=tool_calls,
        execution_time_ms=execution_time_ms
    )


# Example usage and testing
if __name__ == "__main__":
    async def test_llm_judge():
        # This would require an API key to actually run
        print("LLM Judge test (requires API key)")
        
        judge = LLMJudge(model="gpt-4-turbo-preview", cache_enabled=True)
        
        test_question = "What is the capital of France?"
        test_true_answer = "Paris"
        test_response = "According to my search, the capital city of France is Paris. This has been the case since 1889."
        test_messages = [
            {"entity": "user", "text": "What is the capital of France?"},
            {"entity": "model", "answer": "I'll search for information about France's capital."},
            {"entity": "tool_result", "resultText": "France capital city Paris government"},
            {"entity": "model", "answer": test_response}
        ]
        test_tool_calls = [
            {"tool": "web_search", "status": "success", "duration": 2000}
        ]
        
        result = await judge.evaluate_comprehensive(
            question=test_question,
            true_answer=test_true_answer,
            response=test_response,
            messages=test_messages,
            tool_calls=test_tool_calls,
            execution_time_ms=5000
        )
        
        print("LLM Judge Results:")
        print(json.dumps(result, indent=2))
    
    # asyncio.run(test_llm_judge())
    print("LLM Judge module loaded successfully")
    print(f"LLM support available: {HAS_LLM_SUPPORT}")