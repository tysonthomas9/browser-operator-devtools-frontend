#!/usr/bin/env python3
"""
Standalone Langfuse Scoring Test

Tests Langfuse integration by directly creating traces and scores
without requiring a Browser Operator client connection.
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List

# Load .env configuration
try:
    from dotenv import load_dotenv
    
    env_locations = [
        Path(__file__).parent / ".env",
        Path(__file__).parent.parent / ".env"
    ]
    
    for env_file in env_locations:
        if env_file.exists():
            load_dotenv(env_file)
            print(f"📁 Loaded configuration from: {env_file}")
            break
except ImportError:
    print("⚠️  python-dotenv not available - using environment variables")

# Add src to path for local development
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from bo_eval_server.langfuse_tracer import (
    get_tracer, create_dataset_run, score_dataset_item, score_agent_trace, create_trace, flush
)
from browsecomp_scorer import question_scorer, extract_answer, extract_confidence

class LangfuseStandaloneTest:
    """Standalone test for Langfuse scoring functionality."""
    
    def __init__(self):
        self.dataset_name = None
        self.test_results = []
        
    def create_test_evaluations(self) -> List[Dict[str, Any]]:
        """Create test evaluation data."""
        return [
            {
                'id': 'eval-001',
                'question': 'What is 2 + 2?',
                'true_answer': '4',
                'agent_response': 'Exact Answer: 4\nConfidence Score: 95%',
                'trace_id': 'test-trace-001',
                'expected_correct': True
            },
            {
                'id': 'eval-002', 
                'question': 'What color is the sky on a clear day?',
                'true_answer': 'blue',
                'agent_response': 'The sky appears blue due to light scattering.\nExact Answer: blue\nConfidence Score: 90%',
                'trace_id': 'test-trace-002',
                'expected_correct': True
            },
            {
                'id': 'eval-003',
                'question': 'What is the capital of Mars?',
                'true_answer': 'No capital (Mars has no cities)',
                'agent_response': 'Mars does not have cities or capitals.\nExact Answer: No capital\nConfidence Score: 85%',
                'trace_id': 'test-trace-003',
                'expected_correct': True
            },
            {
                'id': 'eval-004',
                'question': 'What is 10 * 10?',
                'true_answer': '100',
                'agent_response': 'Let me calculate: 10 * 10 = 50\nExact Answer: 50\nConfidence Score: 80%',
                'trace_id': 'test-trace-004',
                'expected_correct': False  # Wrong answer
            },
            {
                'id': 'eval-005',
                'question': 'What is the weather like today?',
                'true_answer': 'Variable based on location',
                'agent_response': 'Error: Unable to access weather data\nTimeout: Request timed out',
                'trace_id': None,  # No trace for failed requests
                'expected_correct': False
            }
        ]
    
    def score_evaluation(self, evaluation: Dict[str, Any]) -> Dict[str, Any]:
        """Score a single evaluation."""
        question = evaluation['question']
        true_answer = evaluation['true_answer'] 
        response = evaluation['agent_response']
        trace_id = evaluation.get('trace_id')
        
        # Server-side scoring using browsecomp_scorer
        is_correct = question_scorer(response, true_answer)
        extracted_answer = extract_answer(response)
        confidence = extract_confidence(response)
        
        # Prepare scoring data
        input_data = {
            'question': question,
            'true_answer': true_answer
        }
        
        output_data = {
            'response': response,
            'extracted_answer': extracted_answer,
            'server_score': is_correct,
            'confidence': confidence
        }
        
        scores = {
            'server_accuracy': 1.0 if is_correct else 0.0,
            'confidence_score': confidence / 100.0,  # Normalize to 0-1
        }
        
        # Upload to Langfuse dataset
        try:
            if self.dataset_name:
                score_dataset_item(
                    dataset_name=self.dataset_name,
                    item_id=evaluation['id'],
                    input_data=input_data,
                    output_data=output_data,
                    scores=scores,
                    metadata={
                        'test_type': 'standalone',
                        'expected_correct': evaluation['expected_correct']
                    }
                )
                print(f"✅ Dataset scoring: {evaluation['id']}")
        except Exception as e:
            print(f"❌ Dataset scoring failed for {evaluation['id']}: {e}")
        
        # Create and score actual traces (for proper dashboard visibility)
        try:
            # Create a new trace for this evaluation
            actual_trace_id = create_trace(
                name=f"Evaluation: {evaluation['id']}",
                input_data=input_data,
                metadata={
                    'evaluation_id': evaluation['id'],
                    'test_type': 'standalone',
                    'expected_correct': evaluation['expected_correct']
                }
            )
            
            if actual_trace_id:
                # Score the newly created trace
                score_agent_trace(
                    trace_id=actual_trace_id,
                    name='server_accuracy',
                    value=1.0 if is_correct else 0.0,
                    comment=f"Server-side scoring: {'Correct' if is_correct else 'Incorrect'}"
                )
                
                score_agent_trace(
                    trace_id=actual_trace_id,
                    name='confidence_score',
                    value=confidence / 100.0,
                    comment=f"Extracted confidence: {confidence}%"
                )
                
                print(f"✅ Created trace and scored: {actual_trace_id[:12] if actual_trace_id else 'None'}...")
            
            # Also try scoring provided trace_id if available (existing agent traces)
            if trace_id and trace_id != actual_trace_id:
                score_agent_trace(
                    trace_id=trace_id,
                    name='server_accuracy',
                    value=1.0 if is_correct else 0.0,
                    comment=f"Server-side scoring: {'Correct' if is_correct else 'Incorrect'}"
                )
                print(f"✅ Agent trace scoring: {trace_id[:12]}...")
                
        except Exception as e:
            print(f"❌ Trace creation/scoring failed for {evaluation['id']}: {e}")
        
        return {
            'id': evaluation['id'],
            'question': question,
            'is_correct': is_correct,
            'extracted_answer': extracted_answer,
            'confidence': confidence,
            'trace_id': trace_id,
            'expected_correct': evaluation['expected_correct'],
            'result_matches_expected': is_correct == evaluation['expected_correct']
        }
    
    def print_results(self, results: List[Dict[str, Any]]):
        """Print test results summary."""
        print(f"\n🧪 Langfuse Scoring Test Results")
        print(f"=" * 50)
        
        correct_scores = sum(1 for r in results if r['is_correct'])
        expected_matches = sum(1 for r in results if r['result_matches_expected'])
        total = len(results)
        
        print(f"📊 Overall Statistics:")
        print(f"   Total Evaluations: {total}")
        print(f"   Server Scored Correct: {correct_scores}/{total} ({100*correct_scores/total:.1f}%)")
        print(f"   Results Match Expected: {expected_matches}/{total} ({100*expected_matches/total:.1f}%)")
        
        # Langfuse uploads
        tracer = get_tracer()
        if tracer._enabled:
            print(f"\n📈 Langfuse Integration:")
            if self.dataset_name:
                print(f"   • Dataset Created: ✅ {self.dataset_name}")
                print(f"   • Dataset Items: {len(results)} scored")
            
            agent_traces = sum(1 for r in results if r['trace_id'])
            print(f"   • Agent Traces Scored: {agent_traces}")
            print(f"   • Visit: https://us.cloud.langfuse.com to view results")
        else:
            print(f"\n⚠️  Langfuse integration disabled")
        
        print(f"\n📋 Individual Results:")
        for i, result in enumerate(results, 1):
            status_emoji = "✅" if result['is_correct'] else "❌"
            expected_emoji = "🎯" if result['result_matches_expected'] else "🔄"
            
            print(f"   {i}. {status_emoji} {expected_emoji} {result['id']}")
            print(f"      Q: {result['question'][:60]}...")
            print(f"      A: '{result['extracted_answer']}' (confidence: {result['confidence']}%)")
            if result['trace_id']:
                print(f"      Trace: {result['trace_id'][:12]}...")
        
        print(f"\n{'=' * 50}")
    
    async def run_test(self):
        """Run the standalone Langfuse test."""
        print(f"🧪 Standalone Langfuse Scoring Test")
        print(f"=" * 50)
        
        # Check Langfuse status
        tracer = get_tracer()
        if tracer._enabled:
            print(f"🔧 Langfuse Configuration:")
            print(f"   📊 Integration: ✅ ENABLED")
            print(f"   🌐 Host: {os.getenv('LANGFUSE_HOST', 'Not set')}")
            print(f"   🔑 Public Key: {os.getenv('LANGFUSE_PUBLIC_KEY', 'Not set')[:12]}...")
        else:
            print(f"🔧 Langfuse Configuration:")
            print(f"   📊 Integration: ❌ DISABLED")
            print(f"   Scores will only be computed locally")
        
        # Create dataset if Langfuse is enabled
        if tracer._enabled:
            try:
                print(f"\n📈 Creating Langfuse dataset...")
                dataset_name = f"standalone-test-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                description = "Standalone Langfuse scoring test - direct API calls"
                self.dataset_name = create_dataset_run(dataset_name, description)
                
                if self.dataset_name:
                    print(f"✅ Created dataset: {self.dataset_name}")
                else:
                    print(f"⚠️  Failed to create dataset")
            except Exception as e:
                print(f"❌ Dataset creation failed: {e}")
        
        # Create test data
        print(f"\n📚 Loading test evaluations...")
        evaluations = self.create_test_evaluations()
        print(f"✅ Created {len(evaluations)} test evaluations")
        
        # Score each evaluation
        print(f"\n🎯 Scoring evaluations...")
        results = []
        for evaluation in evaluations:
            print(f"⏳ Scoring {evaluation['id']}...")
            result = self.score_evaluation(evaluation)
            results.append(result)
            time.sleep(0.1)  # Small delay to avoid rate limiting
        
        # Flush Langfuse data
        if tracer._enabled:
            print(f"\n📤 Flushing Langfuse data...")
            try:
                flush()
                print(f"✅ Data flushed to Langfuse")
            except Exception as e:
                print(f"⚠️  Flush warning: {e}")
        
        # Print results
        self.print_results(results)
        
        return results

def main():
    """Main entry point."""
    import asyncio
    
    test = LangfuseStandaloneTest()
    results = asyncio.run(test.run_test())
    
    # Return success/failure for shell scripts
    successful_scores = sum(1 for r in results if r['result_matches_expected'])
    total_scores = len(results)
    
    if successful_scores == total_scores:
        print(f"\n✅ All tests passed! ({successful_scores}/{total_scores})")
        return 0
    else:
        print(f"\n⚠️  Some tests had unexpected results ({successful_scores}/{total_scores})")
        return 1

if __name__ == "__main__":
    exit(main())