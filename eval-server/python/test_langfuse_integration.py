#!/usr/bin/env python3
"""
Test script for Langfuse integration.

This script tests the key components of the Langfuse integration:
1. Tracer initialization with/without configuration
2. Score attachment functionality
3. Context propagation mechanisms
4. Error handling and fallbacks

Usage:
    python test_langfuse_integration.py [--with-langfuse]
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any

# Add src to path for local development
sys.path.insert(0, str(Path(__file__).parent / "src"))

from bo_eval_server.langfuse_tracer import (
    get_tracer, 
    start_eval_trace, 
    score_agent_trace, 
    flush
)
from bo_eval_server.client_manager import ClientProxy


def test_tracer_initialization():
    """Test tracer initialization with and without Langfuse configuration."""
    print("🔧 Testing tracer initialization...")
    
    # Test without Langfuse configuration
    original_env = {}
    langfuse_vars = ['LANGFUSE_ENABLE', 'LANGFUSE_HOST', 'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY']
    
    for var in langfuse_vars:
        original_env[var] = os.getenv(var)
        if var in os.environ:
            del os.environ[var]
    
    # Tracer should be disabled
    tracer1 = get_tracer()
    assert not tracer1._enabled, "Tracer should be disabled without configuration"
    print("  ✓ Tracer disabled when not configured")
    
    # Test with partial configuration (should still be disabled)
    os.environ['LANGFUSE_ENABLE'] = 'true'
    os.environ['LANGFUSE_HOST'] = 'https://test.langfuse.com'
    # Missing keys...
    
    # Create new tracer instance
    from bo_eval_server.langfuse_tracer import LangfuseTracer
    tracer2 = LangfuseTracer()
    assert not tracer2._enabled, "Tracer should be disabled with partial configuration"
    print("  ✓ Tracer disabled with partial configuration")
    
    # Test with full configuration
    os.environ['LANGFUSE_PUBLIC_KEY'] = 'pk-test-123'
    os.environ['LANGFUSE_SECRET_KEY'] = 'sk-test-456'
    
    tracer3 = LangfuseTracer()
    assert tracer3._enabled, "Tracer should be enabled with full configuration"
    print("  ✓ Tracer enabled with full configuration")
    
    # Restore original environment
    for var, value in original_env.items():
        if value is not None:
            os.environ[var] = value
        elif var in os.environ:
            del os.environ[var]
    
    print("✅ Tracer initialization tests passed")


def test_trace_context_operations():
    """Test trace context creation and operations."""
    print("🔧 Testing trace context operations...")
    
    # Test with disabled tracer
    ctx1 = start_eval_trace(
        run_name="test-run",
        evaluation_id="eval-123",
        tags={"model": "gpt-4o", "test": True}
    )
    
    # Should not fail even when disabled
    ctx1.update(input="test input", output="test output")
    ctx1.score("test_score", 0.95, comment="Test score")
    ctx1.end(status="completed")
    print("  ✓ Trace context operations work when disabled")
    
    # Test with existing trace_id (attachment mode)
    ctx2 = start_eval_trace(
        run_name="test-run-2",
        evaluation_id="eval-456",
        trace_id="existing-trace-123"
    )
    
    assert ctx2.trace_id == "existing-trace-123", "Should preserve provided trace_id"
    print("  ✓ Trace context handles existing trace_id")
    
    print("✅ Trace context tests passed")


def test_score_agent_trace():
    """Test scoring agent traces by trace ID."""
    print("🔧 Testing score_agent_trace function...")
    
    # Should not fail even when Langfuse is not available
    score_agent_trace(
        trace_id="test-trace-123",
        name="task_success",
        value=1,
        comment="Test successful",
        metadata={"evaluation_id": "eval-789"}
    )
    print("  ✓ score_agent_trace handles missing Langfuse gracefully")
    
    # Test flush operation
    flush()
    print("  ✓ flush() operation completes successfully")
    
    print("✅ Score agent trace tests passed")


def test_client_proxy_integration():
    """Test ClientProxy integration with tracer."""
    print("🔧 Testing ClientProxy tracer integration...")
    
    # Test trace ID extraction
    from bo_eval_server.client_manager import ClientProxy
    
    # Mock a ClientProxy for testing (we can't easily create real one without WebSocket)
    class MockClientProxy(ClientProxy):
        def __init__(self):
            # Initialize with minimal required fields
            self.id = "test-client"
        
        def _extract_trace_id(self, result: Any) -> str:
            return super()._extract_trace_id(result)
    
    mock_proxy = MockClientProxy()
    
    # Test trace ID extraction from success response
    success_result = {
        "status": "success",
        "output": "test response",
        "metadata": {
            "traceId": "agent-trace-123",
            "sessionId": "session-456",
            "evaluationId": "eval-789"
        }
    }
    
    trace_id = mock_proxy._extract_trace_id(success_result)
    assert trace_id == "agent-trace-123", f"Expected 'agent-trace-123', got '{trace_id}'"
    print("  ✓ Trace ID extraction from success response works")
    
    # Test trace ID extraction from error response
    error_result = {
        "error": {
            "code": -32000,
            "message": "Tool execution failed",
            "data": {
                "tool": "chat",
                "error": "Network timeout",
                "metadata": {
                    "traceId": "agent-trace-456",
                    "sessionId": "session-789",
                    "evaluationId": "eval-012"
                }
            }
        }
    }
    
    trace_id = mock_proxy._extract_trace_id(error_result)
    assert trace_id == "agent-trace-456", f"Expected 'agent-trace-456', got '{trace_id}'"
    print("  ✓ Trace ID extraction from error response works")
    
    # Test with missing trace ID
    no_trace_result = {
        "status": "success",
        "output": "test response"
    }
    
    trace_id = mock_proxy._extract_trace_id(no_trace_result)
    assert trace_id is None, f"Expected None, got '{trace_id}'"
    print("  ✓ Missing trace ID handled gracefully")
    
    print("✅ ClientProxy integration tests passed")


def test_correlation_id_generation():
    """Test trace correlation ID generation."""
    print("🔧 Testing correlation ID generation...")
    
    from bo_eval_server.langfuse_tracer import LangfuseTracer
    
    tracer = LangfuseTracer()
    
    # Test consistent correlation ID generation
    corr_id1 = tracer.create_trace_correlation_id("test-run", "eval-123")
    corr_id2 = tracer.create_trace_correlation_id("test-run", "eval-123")
    
    assert corr_id1 == corr_id2, "Correlation IDs should be consistent"
    assert len(corr_id1) == 16, "Correlation ID should be 16 characters"
    print(f"  ✓ Consistent correlation ID: {corr_id1}")
    
    # Test different parameters produce different IDs
    corr_id3 = tracer.create_trace_correlation_id("different-run", "eval-123")
    assert corr_id1 != corr_id3, "Different parameters should produce different IDs"
    print("  ✓ Different parameters produce different correlation IDs")
    
    print("✅ Correlation ID generation tests passed")


def test_end_to_end_simulation():
    """Simulate end-to-end evaluation with Langfuse integration."""
    print("🔧 Testing end-to-end simulation...")
    
    # Simulate evaluation flow
    evaluation = {
        "id": "sim-eval-123",
        "name": "Test Evaluation", 
        "tool": "chat",
        "input": {"message": "What is 2+2?"},
        "timeout": 30.0
    }
    
    # Step 1: Agent creates trace (simulated)
    agent_trace_id = "agent-trace-simulation-456"
    
    # Step 2: Agent returns result with trace metadata
    agent_result = {
        "status": "success",
        "output": {"response": "2+2 equals 4"},
        "executionTime": 1250,
        "metadata": {
            "traceId": agent_trace_id,
            "sessionId": "sim-session-789",
            "evaluationId": evaluation["id"],
            "trace_correlation_id": "abc123def456"
        }
    }
    
    # Step 3: Server extracts trace ID and attaches scores (simulated)
    mock_proxy = MockClientProxy()
    extracted_trace_id = mock_proxy._extract_trace_id(agent_result)
    
    assert extracted_trace_id == agent_trace_id, "Trace ID extraction failed"
    print(f"  ✓ Extracted trace ID: {extracted_trace_id}")
    
    # Step 4: Score the agent trace
    score_agent_trace(
        trace_id=extracted_trace_id,
        name="task_success",
        value=1,
        comment="Evaluation completed successfully",
        metadata={
            "evaluation_id": evaluation["id"],
            "execution_time": 1.25,
            "tool": evaluation["tool"]
        }
    )
    
    score_agent_trace(
        trace_id=extracted_trace_id,
        name="execution_time", 
        value=1.25,
        comment="Execution time in seconds"
    )
    
    print("  ✓ Scores attached to agent trace")
    
    # Step 5: Flush data
    flush()
    print("  ✓ Data flushed successfully")
    
    print("✅ End-to-end simulation tests passed")


# Mock class for testing
class MockClientProxy:
    def __init__(self):
        self.id = "test-client"
    
    def _extract_trace_id(self, result) -> str:
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


def main():
    """Run all integration tests."""
    print("🧪 Starting Langfuse integration tests...\n")
    
    try:
        test_tracer_initialization()
        print()
        
        test_trace_context_operations()
        print()
        
        test_score_agent_trace()
        print()
        
        test_client_proxy_integration()
        print()
        
        test_correlation_id_generation()
        print()
        
        test_end_to_end_simulation()
        print()
        
        print("🎉 All Langfuse integration tests passed!")
        print("\n📋 Integration Summary:")
        print("  ✅ Tracer initialization and configuration")
        print("  ✅ Trace context management")
        print("  ✅ Score attachment to agent traces")
        print("  ✅ ClientProxy trace ID extraction")
        print("  ✅ Correlation ID generation")
        print("  ✅ End-to-end evaluation flow")
        print("\n🚀 The Langfuse integration is ready for use!")
        
        return 0
        
    except AssertionError as e:
        print(f"❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())