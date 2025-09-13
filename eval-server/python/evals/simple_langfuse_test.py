#!/usr/bin/env python3
"""
Simple Langfuse Test Evaluation Script

Creates simple, fast evaluations to test Langfuse score upload functionality.
Uses easy questions that agents can answer quickly to minimize test time.
"""

import os
import sys
import time
import json
import argparse
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

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

from bo_eval_server import EvalServer, EvaluationStack
from bo_eval_server.logger import setup_logger
from bo_eval_server.langfuse_tracer import get_tracer, create_dataset_run, score_dataset_item, score_agent_trace
from browsecomp_scorer import question_scorer, extract_answer, extract_confidence

class SimpleLangfuseTest:
    """Simple evaluation test for Langfuse integration."""
    
    def __init__(self, port: int = 8080, timeout: float = 10.0):
        self.port = port
        self.timeout = timeout
        self.server = None
        self.stack = EvaluationStack()
        self.results = []
        self.dataset_name = None
        self.langfuse_enabled = False
        
        # Setup logging
        log_dir = Path(__file__).parent.parent / "logs"
        log_dir.mkdir(exist_ok=True)
        setup_logger(log_level="INFO", log_dir=str(log_dir))
        
        # Get logger instance for this module
        from loguru import logger
        self.logger = logger
        
    def create_simple_evaluations(self) -> List[Dict[str, Any]]:
        """Create simple, fast evaluations for testing with diverse scenarios."""
        evaluations = [
            {
                "id": "simple_test_1",
                "name": "Simple Math Test",
                "description": "Test basic arithmetic - fast completion",
                "tool": "chat",
                "input": {
                    "message": "What is 2 + 2? Please respond with just the number."
                },
                "timeout": self.timeout,
                "metadata": {
                    "test_type": "langfuse_integration",
                    "expected_answer": "4",
                    "difficulty": "trivial",
                    "langfuse_test": True,
                    "expected_outcome": "success"
                }
            },
            {
                "id": "simple_test_2", 
                "name": "Basic Knowledge Test",
                "description": "Test basic knowledge - fast completion",
                "tool": "chat",
                "input": {
                    "message": "What color is the sky on a clear day? Please respond with just the color."
                },
                "timeout": self.timeout,
                "metadata": {
                    "test_type": "langfuse_integration",
                    "expected_answer": "blue",
                    "difficulty": "trivial",
                    "langfuse_test": True,
                    "expected_outcome": "success"
                }
            },
            {
                "id": "simple_test_3",
                "name": "Geography Test",
                "description": "Test basic geography - fast completion", 
                "tool": "chat",
                "input": {
                    "message": "What is the capital of France? Please respond with just the city name."
                },
                "timeout": self.timeout,
                "metadata": {
                    "test_type": "langfuse_integration",
                    "expected_answer": "Paris",
                    "difficulty": "trivial",
                    "langfuse_test": True,
                    "expected_outcome": "success"
                }
            },
            {
                "id": "simple_test_4",
                "name": "Invalid Tool Test",
                "description": "Test with invalid tool - should fail",
                "tool": "nonexistent_tool",
                "input": {
                    "message": "This should fail because the tool doesn't exist."
                },
                "timeout": self.timeout,
                "metadata": {
                    "test_type": "langfuse_integration",
                    "expected_answer": "N/A",
                    "difficulty": "error_case",
                    "langfuse_test": True,
                    "expected_outcome": "failure"
                }
            },
            {
                "id": "simple_test_5",
                "name": "Short Timeout Test",
                "description": "Test with very short timeout - may timeout",
                "tool": "chat",
                "input": {
                    "message": "Count to 100 slowly, taking your time with each number."
                },
                "timeout": 1.0,  # Very short timeout
                "metadata": {
                    "test_type": "langfuse_integration",
                    "expected_answer": "1, 2, 3...",
                    "difficulty": "timeout_case",
                    "langfuse_test": True,
                    "expected_outcome": "timeout"
                }
            }
        ]
        
        return evaluations
    
    def load_evaluations_into_stack(self, evaluations: List[Dict[str, Any]]):
        """Load evaluations into the evaluation stack."""
        print(f"📚 Loading {len(evaluations)} simple test evaluations...")
        
        for evaluation in evaluations:
            self.stack.push(evaluation)
            
        print(f"✅ Loaded {self.stack.size()} evaluations into stack")
        print(f"🔝 Top evaluation: {self.stack.peek()['name'] if self.stack.peek() else 'None'}")
        
    def check_langfuse_configuration(self):
        """Check and display Langfuse configuration status."""
        print(f"\n🔧 Langfuse Configuration Status:")
        
        langfuse_enabled = os.getenv('LANGFUSE_ENABLE', '').lower() in ('true', '1', 'yes', 'on')
        langfuse_host = os.getenv('LANGFUSE_HOST', '')
        langfuse_public_key = os.getenv('LANGFUSE_PUBLIC_KEY', '')
        langfuse_secret_key = os.getenv('LANGFUSE_SECRET_KEY', '')
        
        if langfuse_enabled and langfuse_host and langfuse_public_key and langfuse_secret_key:
            print(f"   📊 Langfuse Integration: ✅ ENABLED")
            print(f"   🌐 Langfuse Host: {langfuse_host}")
            print(f"   🔑 Public Key: {langfuse_public_key[:10]}...")
            print(f"   🔐 Secret Key: {'✅ Set' if langfuse_secret_key else '❌ Not set'}")
            print(f"   📈 Server-side scoring and dataset runs will be created")
            print(f"   🔗 Agent trace scores will be uploaded when traceId provided")
            self.langfuse_enabled = True
            return True
        else:
            print(f"   📊 Langfuse Integration: ❌ DISABLED")
            if not langfuse_enabled:
                print(f"      • LANGFUSE_ENABLE is not 'true'")
            if not langfuse_host:
                print(f"      • LANGFUSE_HOST is not set")
            if not langfuse_public_key:
                print(f"      • LANGFUSE_PUBLIC_KEY is not set")
            if not langfuse_secret_key:
                print(f"      • LANGFUSE_SECRET_KEY is not set")
            print(f"      📝 Edit .env file to enable Langfuse integration")
            return False
    
    async def handle_client(self, client):
        """Handle client connections and process evaluations with comprehensive scoring."""
        self.logger.info(f"🎉 CLIENT CONNECTED!")
        self.logger.info(f"   - Client ID: {client.id}")
        self.logger.info(f"   - Client tabId: {client.tab_id}")
        
        start_time = time.time()
        completed_count = 0
        failed_count = 0
        
        # Process all evaluations in the stack
        while not self.stack.is_empty():
            evaluation = self.stack.pop()
            evaluation_start_time = time.time()
            
            print(f"📋 Assigning evaluation: \"{evaluation['name']}\" (ID: {evaluation['id']})")
            print(f"📊 Remaining evaluations in stack: {self.stack.size()}")
            print(f"🎯 Expected outcome: {evaluation['metadata'].get('expected_outcome', 'unknown')}")
            
            eval_result = {
                'evaluation': evaluation,
                'result': None,
                'trace_id': None,
                'completion_time': 0,
                'server_scoring': {
                    'is_correct': False,
                    'extracted_answer': None,
                    'confidence': 0,
                    'scored': False
                },
                'status': 'pending',
                'error': None
            }
            
            try:
                print(f"🔄 Starting evaluation... (timeout: {evaluation['timeout']}s)")
                result = await client.evaluate(evaluation)
                eval_result['result'] = result
                eval_result['status'] = 'completed'
                
                completion_time = time.time() - evaluation_start_time
                eval_result['completion_time'] = completion_time
                completed_count += 1
                
                print(f"✅ Evaluation completed in {completion_time:.2f}s!")
                print(f"📊 Response: {json.dumps(result, indent=2)[:200]}...")
                
                # Extract traceId from response (success case)
                trace_id = self._extract_trace_id(result)
                eval_result['trace_id'] = trace_id
                
                if trace_id:
                    print(f"🔗 TraceId found: {trace_id[:12]}... (Agent trace scoring available)")
                else:
                    print(f"⚠️  No traceId in response (Agent trace scoring unavailable)")
                
                # Perform server-side scoring
                response_text = result.get('output', '') if isinstance(result, dict) else str(result)
                eval_result['server_scoring'] = self._score_evaluation(evaluation, response_text, trace_id)
                
                self.logger.info(f"Evaluation completed: {evaluation['id']} - TraceId: {trace_id}")
                
            except asyncio.TimeoutError:
                completion_time = time.time() - evaluation_start_time
                eval_result['completion_time'] = completion_time
                eval_result['status'] = 'timeout'
                eval_result['error'] = 'Evaluation timed out'
                failed_count += 1
                
                print(f"⏰ Evaluation timed out after {completion_time:.2f}s")
                
                # Try to score with empty response
                eval_result['server_scoring'] = self._score_evaluation(evaluation, '', None)
                
                self.logger.error(f"Evaluation timeout: {evaluation['id']}")
                
            except Exception as e:
                completion_time = time.time() - evaluation_start_time
                eval_result['completion_time'] = completion_time
                eval_result['status'] = 'failed'
                eval_result['error'] = str(e)
                failed_count += 1
                
                print(f"❌ Evaluation failed after {completion_time:.2f}s: {e}")
                
                # Try to extract partial response from error for scoring
                response_text = ''
                trace_id = None
                if hasattr(e, 'response') and isinstance(e.response, dict):
                    response_text = e.response.get('output', '')
                    trace_id = self._extract_trace_id(e.response)
                    eval_result['trace_id'] = trace_id
                
                if trace_id:
                    print(f"🔗 TraceId found in error response: {trace_id[:12]}...")
                
                # Score with partial or empty response
                eval_result['server_scoring'] = self._score_evaluation(evaluation, response_text, trace_id)
                
                self.logger.error(f"Evaluation failed: {evaluation['id']} - Error: {e}")
            
            # Store result for analysis
            self.results.append(eval_result)
        
        # Perform final analysis
        await self._analyze_results(start_time, completed_count, failed_count)
        
        # Stop the server after completion
        print(f"\n🛑 Stopping server...")
        await asyncio.sleep(1)  # Brief delay for final logs
        if self.server:
            await self.server.stop()
    
    def _extract_trace_id(self, result: Any) -> Optional[str]:
        """Extract traceId from evaluation result or error response."""
        if not isinstance(result, dict):
            return None
            
        # Check direct metadata field (success responses)
        if 'metadata' in result:
            metadata = result['metadata']
            if isinstance(metadata, dict) and 'traceId' in metadata:
                return metadata['traceId']
        
        # Check nested error data metadata (error responses)
        if 'error' in result and isinstance(result['error'], dict):
            error_data = result['error'].get('data')
            if isinstance(error_data, dict) and 'metadata' in error_data:
                metadata = error_data['metadata']
                if isinstance(metadata, dict) and 'traceId' in metadata:
                    return metadata['traceId']
        
        return None
    
    def _score_evaluation(self, evaluation: Dict[str, Any], response_text: str, trace_id: Optional[str]) -> Dict[str, Any]:
        """Score an evaluation using server-side logic and optionally upload to Langfuse."""
        expected_answer = evaluation['metadata'].get('expected_answer', '')
        
        # Perform server-side scoring
        is_correct = False
        extracted_answer = None
        confidence = 0
        
        if response_text:
            try:
                is_correct = question_scorer(response_text, expected_answer)
                extracted_answer = extract_answer(response_text)
                confidence = extract_confidence(response_text)
            except Exception as e:
                print(f"⚠️  Server scoring error: {e}")
        
        scoring_result = {
            'is_correct': is_correct,
            'extracted_answer': extracted_answer,
            'confidence': confidence,
            'scored': True
        }
        
        # Display scoring results
        print(f"📊 Server-Side Scoring:")
        print(f"   - Expected: {expected_answer}")
        print(f"   - Extracted: {extracted_answer or 'None'}")
        print(f"   - Correct: {'✅ YES' if is_correct else '❌ NO'}")
        print(f"   - Confidence: {confidence}%")
        
        # Upload to Langfuse if enabled
        if self.langfuse_enabled:
            try:
                # Upload to dataset run
                if self.dataset_name:
                    score_dataset_item(
                        dataset_name=self.dataset_name,
                        item_id=evaluation['id'],
                        input_data={
                            'question': evaluation['input'].get('message', ''),
                            'expected_answer': expected_answer,
                            'tool': evaluation.get('tool', ''),
                        },
                        output_data={'response': response_text},
                        scores={
                            'correctness': 1.0 if is_correct else 0.0,
                            'confidence': confidence / 100.0,
                        },
                        metadata={
                            'evaluation_id': evaluation['id'],
                            'test_type': evaluation['metadata'].get('test_type'),
                            'difficulty': evaluation['metadata'].get('difficulty'),
                            'expected_outcome': evaluation['metadata'].get('expected_outcome'),
                        }
                    )
                    print(f"📈 Uploaded to Langfuse dataset run")
                
                # Score agent trace if traceId available
                if trace_id:
                    score_agent_trace(
                        trace_id=trace_id,
                        name="server_correctness",
                        value=1.0 if is_correct else 0.0,
                        comment=f"Server-side scoring for {evaluation['name']}",
                        metadata={
                            'evaluation_id': evaluation['id'],
                            'expected_answer': expected_answer,
                            'extracted_answer': extracted_answer,
                            'confidence': confidence
                        }
                    )
                    print(f"🔗 Scored agent trace: {trace_id[:12]}...")
                    
            except Exception as e:
                print(f"⚠️  Langfuse upload error: {e}")
        
        return scoring_result
    
    async def _analyze_results(self, start_time: float, completed_count: int, failed_count: int):
        """Analyze and display comprehensive results."""
        total_time = time.time() - start_time
        total_evaluations = len(self.results)
        
        print(f"\n🏁 Evaluation Analysis Complete!")
        print(f"=" * 60)
        print(f"⏱️  Total Time: {total_time:.2f} seconds")
        print(f"📊 Results Breakdown:")
        print(f"   • Total Evaluations: {total_evaluations}")
        print(f"   • Completed: {completed_count}")
        print(f"   • Failed/Timeout: {failed_count}")
        
        # Scoring analysis
        scored_results = [r for r in self.results if r['server_scoring']['scored']]
        correct_results = [r for r in scored_results if r['server_scoring']['is_correct']]
        
        if scored_results:
            accuracy = len(correct_results) / len(scored_results)
            avg_confidence = sum(r['server_scoring']['confidence'] for r in scored_results) / len(scored_results)
            
            print(f"\n📈 Server-Side Scoring:")
            print(f"   • Evaluations Scored: {len(scored_results)}/{total_evaluations}")
            print(f"   • Accuracy: {accuracy:.1%} ({len(correct_results)}/{len(scored_results)})")
            print(f"   • Average Confidence: {avg_confidence:.1f}%")
        
        # Trace analysis
        trace_results = [r for r in self.results if r['trace_id']]
        print(f"\n🔗 Trace Analysis:")
        print(f"   • Evaluations with TraceId: {len(trace_results)}/{total_evaluations}")
        
        # Langfuse uploads
        if self.langfuse_enabled:
            print(f"\n📈 Langfuse Integration:")
            if self.dataset_name:
                print(f"   • Dataset Created: ✅ {self.dataset_name}")
                print(f"   • Server Scores Uploaded: {len(scored_results)} items")
            else:
                print(f"   • Dataset Run Created: ❌ Failed")
            
            if trace_results:
                print(f"   • Agent Trace Scores: {len(trace_results)} traces scored")
                print(f"   🌐 Dashboard: {os.getenv('LANGFUSE_HOST', 'https://cloud.langfuse.com')}")
            else:
                print(f"   • Agent Trace Scores: ❌ No traceIds found")
        
        # Individual result details
        print(f"\n📋 Individual Results:")
        for i, result in enumerate(self.results, 1):
            status_emoji = {
                'completed': '✅',
                'failed': '❌', 
                'timeout': '⏰'
            }.get(result['status'], '❓')
            
            eval_name = result['evaluation']['name']
            expected_outcome = result['evaluation']['metadata'].get('expected_outcome', 'unknown')
            is_correct = result['server_scoring']['is_correct']
            confidence = result['server_scoring']['confidence']
            
            print(f"   {i}. {status_emoji} {eval_name} ({expected_outcome})")
            print(f"      Server Score: {'✅' if is_correct else '❌'} {confidence}%")
            if result['trace_id']:
                print(f"      TraceId: {result['trace_id'][:12]}...")
            if result['error']:
                print(f"      Error: {result['error']}")

    async def run_test(self):
        """Run the simple Langfuse test."""
        self.logger.info("🚀 Starting Simple Langfuse Test")
        
        print("🧪 Simple Langfuse Integration Test")
        print("=" * 50)
        
        # Check Langfuse configuration
        langfuse_enabled = self.check_langfuse_configuration()
        
        # Create Langfuse dataset run if enabled
        if self.langfuse_enabled:
            try:
                print(f"\n📈 Creating Langfuse dataset run...")
                dataset_name = f"simple-langfuse-test-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                description = f"Simple Langfuse integration test with {5} diverse evaluation scenarios"
                self.dataset_name = create_dataset_run(dataset_name, description)
                
                if self.dataset_name:
                    print(f"✅ Created dataset: {self.dataset_name}")
                    print(f"   📊 Dataset: {dataset_name}")
                else:
                    print(f"⚠️  Failed to create dataset run (will continue without server-side scoring)")
            except Exception as e:
                print(f"⚠️  Dataset run creation error: {e}")
                print(f"   Will continue without server-side scoring")
        
        # Create and load evaluations
        evaluations = self.create_simple_evaluations()
        self.load_evaluations_into_stack(evaluations)
        
        # Server configuration
        print(f"\n🌐 Server Configuration:")
        print(f"   Host: 127.0.0.1")
        print(f"   Port: {self.port}")
        print(f"   Auth Key: simple-langfuse-test")
        print(f"   Timeout: {self.timeout}s per evaluation")
        print(f"   Total Evaluations: {len(evaluations)}")
        
        # Create and configure server
        self.server = EvalServer(
            auth_key='simple-langfuse-test',
            host='127.0.0.1',
            port=self.port
        )
        
        # Register client handler
        @self.server.on_connect
        async def on_client_connect(client):
            await self.handle_client(client)
        
        print(f"\n🚀 Starting test server on ws://127.0.0.1:{self.port}")
        print("   Connect your Browser Operator to start simple tests")
        print("   Expected completion time: < 30 seconds")
        print("=" * 50)
        
        try:
            await self.server.start()
            await self.server.wait_closed()
        except KeyboardInterrupt:
            print(f"\n🛑 Test interrupted by user")
        except Exception as e:
            print(f"\n💥 Test error: {e}")
            self.logger.error(f"Test error: {e}")
        finally:
            if self.server:
                await self.server.stop()

def main():
    """Main entry point for simple Langfuse test."""
    parser = argparse.ArgumentParser(description="Run simple Langfuse integration test")
    parser.add_argument("--port", type=int, default=8080, help="Server port (default: 8080)")
    parser.add_argument("--timeout", type=float, default=10.0, help="Evaluation timeout in seconds (default: 10.0)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    # Create and run test
    test = SimpleLangfuseTest(port=args.port, timeout=args.timeout)
    
    try:
        asyncio.run(test.run_test())
    except KeyboardInterrupt:
        print(f"\n👋 Test stopped by user")
    except Exception as e:
        print(f"💥 Test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()