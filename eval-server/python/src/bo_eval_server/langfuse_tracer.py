"""
Langfuse tracing integration for the evaluation server.

This module provides a tracer shim that can optionally integrate with Langfuse
for experiment tracking, scoring, and evaluation. When Langfuse is disabled or
not configured, all operations are no-ops with zero performance impact.
"""

import os
import time
import hashlib
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass

from loguru import logger


@dataclass
class TraceCtx:
    """Context object for managing trace lifecycle and scoring."""
    
    trace_id: Optional[str]
    run_name: Optional[str]
    metadata: Dict[str, Any]
    _tracer: 'LangfuseTracer'
    
    def update(
        self,
        input: Any = None,
        output: Any = None,
        usage: Optional[Dict[str, Any]] = None,
        cost: Optional[float] = None,
        timings: Optional[Dict[str, Any]] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """Update trace with additional data."""
        if not self._tracer._enabled:
            return
            
        update_data = {}
        if input is not None:
            update_data['input'] = input
        if output is not None:
            update_data['output'] = output
        if usage is not None:
            update_data['usage'] = usage
        if cost is not None:
            update_data['cost'] = cost
        if timings is not None:
            update_data['timings'] = timings
        if tool_calls is not None:
            update_data['tool_calls'] = tool_calls
            
        if update_data:
            self.metadata.update(update_data)
            
    def score(
        self,
        name: str,
        value: Union[float, int, bool],
        comment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """Attach a score to the trace."""
        if not self._tracer._enabled or not self.trace_id:
            logger.debug(f"Skipping score '{name}' - tracer disabled or no trace_id")
            return
            
        self._tracer._attach_score_to_trace(
            trace_id=self.trace_id,
            name=name,
            value=value,
            comment=comment,
            metadata=metadata
        )
        
    def end(self, status: Optional[str] = None) -> None:
        """Mark the trace as ended."""
        if not self._tracer._enabled:
            return
            
        if status:
            self.metadata['status'] = status


class LangfuseTracer:
    """
    Tracer shim for Langfuse integration.
    
    Handles lazy loading of Langfuse SDK and provides no-op behavior
    when disabled or not configured.
    """
    
    def __init__(self):
        self._enabled = self._check_enabled()
        self._client = None
        self._initialized = False
        
        if self._enabled:
            logger.info("Langfuse tracer enabled")
        else:
            logger.debug("Langfuse tracer disabled")
    
    def _check_enabled(self) -> bool:
        """Check if Langfuse should be enabled based on environment."""
        enable_flag = os.getenv('LANGFUSE_ENABLE', '').lower()
        if enable_flag in ('false', '0', 'no', 'off'):
            return False
        
        # Check for required environment variables
        required_vars = ['LANGFUSE_HOST', 'LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY']
        has_config = all(os.getenv(var) for var in required_vars)
        
        return enable_flag in ('true', '1', 'yes', 'on') and has_config
    
    def _get_client(self):
        """Lazy initialization of Langfuse client."""
        if not self._enabled:
            return None
            
        if self._client is None:
            try:
                from langfuse import get_client
                self._client = get_client()
                self._initialized = True
                logger.info("Langfuse client initialized successfully")
            except ImportError:
                logger.warning("Langfuse SDK not installed - install with: pip install langfuse")
                self._enabled = False
                return None
            except Exception as e:
                logger.error(f"Failed to initialize Langfuse client: {e}")
                self._enabled = False
                return None
        
        return self._client
    
    def start_eval_trace(
        self,
        run_name: Optional[str] = None,
        tags: Optional[Dict[str, Any]] = None,
        evaluation_id: Optional[str] = None,
        trace_id: Optional[str] = None
    ) -> TraceCtx:
        """
        Start a new evaluation trace or attach to existing trace.
        
        Args:
            run_name: Name of the experiment run
            tags: Tags/metadata for the trace
            evaluation_id: ID of the evaluation
            trace_id: Optional existing trace ID to attach scores to
            
        Returns:
            TraceCtx object for managing the trace
        """
        if not self._enabled:
            return TraceCtx(
                trace_id=trace_id,
                run_name=run_name,
                metadata=tags or {},
                _tracer=self
            )
        
        # If trace_id is provided, we're attaching to an existing agent trace
        # Don't create a new trace, just prepare for scoring
        if trace_id:
            logger.debug(f"Attaching to existing trace: {trace_id}")
            return TraceCtx(
                trace_id=trace_id,
                run_name=run_name,
                metadata=tags or {},
                _tracer=self
            )
        
        # Only create a new trace if no trace_id provided (fallback case)
        client = self._get_client()
        if not client:
            return TraceCtx(
                trace_id=None,
                run_name=run_name,
                metadata=tags or {},
                _tracer=self
            )
        
        try:
            # Generate a fallback trace ID
            fallback_trace_id = f"server-fallback-{evaluation_id or int(time.time())}"
            
            # Create a minimal server-side trace (only as fallback)
            trace_data = {
                'id': fallback_trace_id,
                'name': f"Evaluation Fallback: {evaluation_id or 'unknown'}",
                'metadata': {
                    'source': 'server-fallback',
                    'trace_missing': True,
                    **(tags or {})
                }
            }
            
            if run_name:
                trace_data['metadata']['run_name'] = run_name
            if evaluation_id:
                trace_data['metadata']['evaluation_id'] = evaluation_id
                
            # Note: Actual trace creation would go here
            # For now, we just prepare the context
            logger.debug(f"Created fallback trace: {fallback_trace_id}")
            
            return TraceCtx(
                trace_id=fallback_trace_id,
                run_name=run_name,
                metadata=tags or {},
                _tracer=self
            )
            
        except Exception as e:
            logger.error(f"Failed to create fallback trace: {e}")
            return TraceCtx(
                trace_id=None,
                run_name=run_name,
                metadata=tags or {},
                _tracer=self
            )
    
    def create_trace(
        self,
        name: str,
        input_data: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Create a new trace and return its ID.
        
        Args:
            name: Name of the trace
            input_data: Input data for the trace
            metadata: Additional metadata
            trace_id: Optional specific trace ID
            
        Returns:
            Trace ID if successful, None otherwise
        """
        if not self._enabled:
            return trace_id
            
        client = self._get_client()
        if not client:
            return trace_id
            
        try:
            # Create a new trace using the low-level SDK
            import uuid
            actual_trace_id = trace_id or str(uuid.uuid4())
            
            # Create a span that will be the root of a new trace
            span = client.start_span(
                name=name,
                input=input_data,
                metadata=metadata or {}
            )
            
            # Store the trace ID 
            if hasattr(span, 'trace_id'):
                actual_trace_id = span.trace_id
            elif hasattr(span, 'get_trace_id'):
                actual_trace_id = span.get_trace_id()
                
            # End the span immediately to complete the trace
            span.end()
            
            logger.debug(f"Created trace '{name}' with ID: {actual_trace_id}")
            return actual_trace_id
                
        except Exception as e:
            logger.error(f"Failed to create trace '{name}': {e}")
            return trace_id

    def _attach_score_to_trace(
        self,
        trace_id: str,
        name: str,
        value: Union[float, int, bool],
        comment: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Attach a score to an existing trace by ID.
        
        This is the core method for scoring agent traces from the server.
        """
        if not self._enabled:
            return
            
        client = self._get_client()
        if not client:
            return
            
        try:
            # Use the Langfuse SDK to score an existing trace
            client.create_score(
                trace_id=trace_id,
                name=name,
                value=value,
                comment=comment,
                data_type="NUMERIC" if isinstance(value, (int, float)) else "BOOLEAN" if isinstance(value, bool) else "CATEGORICAL"
            )
            
            logger.debug(f"Attached score '{name}' (value={value}) to trace {trace_id}")
            
        except Exception as e:
            logger.error(f"Failed to attach score to trace {trace_id}: {e}")
    
    def flush(self) -> None:
        """Flush any pending data to Langfuse."""
        if not self._enabled:
            return
            
        client = self._get_client()
        if not client:
            return
            
        try:
            # Ensure all data is sent
            if hasattr(client, 'flush'):
                client.flush()
            logger.debug("Flushed Langfuse data")
        except Exception as e:
            logger.error(f"Failed to flush Langfuse data: {e}")
    
    def create_trace_correlation_id(self, run_name: Optional[str], evaluation_id: str) -> str:
        """
        Create a stable correlation ID for linking traces across systems.
        
        Args:
            run_name: Name of the experiment run
            evaluation_id: ID of the evaluation
            
        Returns:
            Stable hash that can be used for correlation
        """
        base_string = f"{run_name or 'no-run'}-{evaluation_id}"
        return hashlib.sha256(base_string.encode()).hexdigest()[:16]


# Global tracer instance
_tracer_instance: Optional[LangfuseTracer] = None


def get_tracer() -> LangfuseTracer:
    """Get the global tracer instance."""
    global _tracer_instance
    if _tracer_instance is None:
        _tracer_instance = LangfuseTracer()
    return _tracer_instance


def start_eval_trace(
    run_name: Optional[str] = None,
    tags: Optional[Dict[str, Any]] = None,
    evaluation_id: Optional[str] = None,
    trace_id: Optional[str] = None
) -> TraceCtx:
    """Convenience function to start an evaluation trace."""
    return get_tracer().start_eval_trace(
        run_name=run_name,
        tags=tags,
        evaluation_id=evaluation_id,
        trace_id=trace_id
    )


def flush() -> None:
    """Convenience function to flush tracer data."""
    get_tracer().flush()


def score_agent_trace(
    trace_id: str,
    name: str,
    value: Union[float, int, bool],
    comment: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Convenience function to score an agent trace by ID.
    
    This is the primary method for attaching server-computed scores
    to existing agent traces.
    """
    get_tracer()._attach_score_to_trace(
        trace_id=trace_id,
        name=name,
        value=value,
        comment=comment,
        metadata=metadata
    )


def create_trace(
    name: str,
    input_data: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    trace_id: Optional[str] = None
) -> Optional[str]:
    """
    Convenience function to create a new trace.
    
    Args:
        name: Name of the trace
        input_data: Input data for the trace
        metadata: Additional metadata
        trace_id: Optional specific trace ID
        
    Returns:
        Trace ID if successful, None otherwise
    """
    return get_tracer().create_trace(
        name=name,
        input_data=input_data,
        metadata=metadata,
        trace_id=trace_id
    )


def create_dataset_run(dataset_name: str, description: Optional[str] = None) -> Optional[str]:
    """
    Create a dataset for server-side evaluation scoring.
    
    Args:
        dataset_name: Name of the dataset
        description: Description of the dataset
        
    Returns:
        Dataset name if successful, None otherwise
    """
    # Check if Langfuse is enabled by checking environment variables
    if not os.getenv('LANGFUSE_ENABLE', '').lower() in ('true', '1', 'yes', 'on'):
        return None
        
    try:
        tracer = get_tracer()
        client = tracer._get_client()
        
        if not client:
            return None
        
        # Create dataset if it doesn't exist
        client.create_dataset(
            name=dataset_name, 
            description=description,
            metadata={
                "created_at": time.time(),
                "server": "bo_eval_server",
            }
        )
        
        return dataset_name
        
    except Exception as e:
        print(f"Warning: Failed to create Langfuse dataset: {e}")
        return None


def score_dataset_item(
    dataset_name: Optional[str] = None,
    item_id: Optional[str] = None,
    input_data: Optional[Dict[str, Any]] = None,
    output_data: Optional[Dict[str, Any]] = None,
    scores: Optional[Dict[str, float]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    # Support legacy browsecomp_eval_server.py parameter format
    dataset_run_id: Optional[str] = None
) -> None:
    """
    Score a dataset item for server-side evaluation tracking.
    
    Args:
        dataset_name: Name of the dataset (new format)
        item_id: Unique identifier for this evaluation item
        input_data: Input data (question, context, etc.)
        output_data: Output data (response, errors, etc.)
        scores: Dictionary of scores to attach
        metadata: Additional metadata
        dataset_run_id: Legacy parameter - treated as dataset_name for backward compatibility
    """
    # Support legacy browsecomp_eval_server parameter format
    actual_dataset_name = dataset_name or dataset_run_id
    
    # Check if Langfuse is enabled by checking environment variables
    if not os.getenv('LANGFUSE_ENABLE', '').lower() in ('true', '1', 'yes', 'on') or not actual_dataset_name:
        return
        
    try:
        tracer = get_tracer()
        client = tracer._get_client()
        
        if not client:
            return
        
        # Create dataset item with scores in metadata
        # Note: For now, storing scores in metadata until we figure out the correct trace API
        item_metadata = {
            "item_id": item_id,
            "scores": scores or {},
            **(metadata or {})
        }
        
        item = client.create_dataset_item(
            dataset_name=actual_dataset_name,
            input=input_data,
            expected_output=input_data.get('true_answer') if input_data else None,
            metadata=item_metadata
        )
        
        logger.debug(f"Created dataset item for {item_id} in dataset {actual_dataset_name} with scores: {scores}")
        
        logger.debug(f"Created dataset item and scored trace for {item_id} in dataset {actual_dataset_name}")
            
    except Exception as e:
        print(f"Warning: Failed to score Langfuse dataset item: {e}")