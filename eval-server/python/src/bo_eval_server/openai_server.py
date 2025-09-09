"""
OpenAI-compatible HTTP API server that multiplexes requests to connected DevTools tabs.

This module provides an HTTP server that implements OpenAI-compatible endpoints
(/v1/models and /v1/chat/completions) while routing requests through the existing
WebSocket evaluation server to connected Browser Operator tabs.
"""

import asyncio
import json
import time
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn
from loguru import logger

from .eval_server import EvalServer


class OpenAIMessage(BaseModel):
    """OpenAI chat message format"""
    role: str = Field(..., description="Message role (system, user, assistant)")
    content: str = Field(..., description="Message content")


class OpenAIChatCompletionRequest(BaseModel):
    """OpenAI chat completion request format"""
    model: str = Field(..., description="Model to use for completion")
    messages: List[OpenAIMessage] = Field(..., description="List of messages")
    temperature: Optional[float] = Field(None, description="Sampling temperature")
    max_tokens: Optional[int] = Field(None, description="Maximum tokens to generate")
    top_p: Optional[float] = Field(None, description="Top-p sampling parameter")
    frequency_penalty: Optional[float] = Field(None, description="Frequency penalty")
    presence_penalty: Optional[float] = Field(None, description="Presence penalty")
    stream: Optional[bool] = Field(False, description="Whether to stream responses")


class OpenAIModelInfo(BaseModel):
    """OpenAI model information format"""
    id: str = Field(..., description="Model identifier")
    object: str = Field(default="model", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    owned_by: str = Field(..., description="Model owner")


class OpenAIModelsResponse(BaseModel):
    """OpenAI models list response format"""
    object: str = Field(default="list", description="Object type")
    data: List[OpenAIModelInfo] = Field(..., description="List of available models")


class OpenAIChatChoice(BaseModel):
    """OpenAI chat completion choice"""
    index: int = Field(..., description="Choice index")
    message: OpenAIMessage = Field(..., description="Generated message")
    finish_reason: str = Field(..., description="Reason for completion finish")


class OpenAIChatCompletionResponse(BaseModel):
    """OpenAI chat completion response format"""
    id: str = Field(..., description="Completion ID")
    object: str = Field(default="chat.completion", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    model: str = Field(..., description="Model used")
    choices: List[OpenAIChatChoice] = Field(..., description="Generated choices")
    usage: Optional[Dict[str, int]] = Field(None, description="Token usage statistics")


class OpenAICompatibleServer:
    """
    OpenAI-compatible HTTP API server that multiplexes requests to connected DevTools tabs.
    
    This server provides OpenAI-compatible endpoints while routing requests through
    the existing WebSocket evaluation server infrastructure.
    """
    
    def __init__(
        self,
        eval_server: EvalServer,
        host: str = "localhost",
        port: int = 8081,
        model_cache_ttl: int = 300,  # 5 minutes
    ):
        """
        Initialize the OpenAI-compatible server.
        
        Args:
            eval_server: The WebSocket evaluation server to route requests through
            host: HTTP server host
            port: HTTP server port
            model_cache_ttl: Model list cache TTL in seconds
        """
        self.eval_server = eval_server
        self.host = host
        self.port = port
        self.model_cache_ttl = model_cache_ttl
        
        # Model list cache
        self._model_cache: Optional[List[OpenAIModelInfo]] = None
        self._model_cache_time: Optional[float] = None
        
        # Create FastAPI app
        self.app = FastAPI(
            title="OpenAI Compatible API",
            description="OpenAI-compatible API that routes requests to Browser Operator tabs",
            version="1.0.0",
        )
        
        # Setup routes
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup FastAPI routes"""
        
        @self.app.get("/v1/models", response_model=OpenAIModelsResponse)
        async def list_models():
            """List available models from connected DevTools tabs"""
            try:
                models = await self._get_models_from_tabs()
                return OpenAIModelsResponse(data=models)
            except Exception as e:
                logger.error(f"Error listing models: {e}")
                raise HTTPException(status_code=503, detail="Unable to fetch models from connected tabs")
        
        @self.app.post("/v1/chat/completions", response_model=OpenAIChatCompletionResponse)
        async def chat_completions(request: OpenAIChatCompletionRequest):
            """Handle chat completion requests"""
            try:
                # Get available connected tabs
                clients = self.eval_server.get_clients()
                ready_client = next((c for c in clients if c.is_connected()), None)
                
                if not ready_client:
                    raise HTTPException(status_code=503, detail="No connected DevTools tabs available")
                
                # Convert OpenAI request to evaluation format
                evaluation = self._convert_openai_to_evaluation(request)
                
                # Send RPC to selected tab
                logger.info(f"Sending evaluation to client {ready_client.id}")
                result = await ready_client.evaluate(evaluation)
                
                # Convert result back to OpenAI format
                return self._convert_result_to_openai(result, request)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error processing chat completion: {e}")
                raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
        
        @self.app.post("/v1/responses")
        async def responses_api(request: Dict[str, Any]):
            """Handle OpenAI Responses API requests"""
            try:
                # Validate required input field
                if "input" not in request or not isinstance(request["input"], str):
                    raise HTTPException(
                        status_code=400, 
                        detail="Missing or invalid 'input' field. Expected a string."
                    )
                
                # Get available connected tabs
                clients = self.eval_server.get_clients()
                ready_client = next((c for c in clients if c.is_connected()), None)
                
                if not ready_client:
                    raise HTTPException(status_code=503, detail="No connected DevTools tabs available")
                
                # Convert Responses API request to evaluation format
                evaluation = self._convert_responses_to_evaluation(request)
                
                # Send RPC to selected tab
                logger.info(f"Sending responses evaluation to client {ready_client.id}")
                result = await ready_client.evaluate(evaluation)
                
                # Convert result back to Responses API format
                return self._convert_result_to_responses(result)
                
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error processing responses request: {e}")
                raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            connected_clients = len([c for c in self.eval_server.get_clients() if c.is_connected()])
            return {
                "status": "healthy",
                "eval_server_running": self.eval_server.is_running(),
                "connected_clients": connected_clients,
                "timestamp": time.time(),
            }
    
    async def _get_models_from_tabs(self) -> List[OpenAIModelInfo]:
        """
        Get available models from connected DevTools tabs.
        
        Returns:
            List of OpenAI-compatible model information
        """
        # Check cache first
        current_time = time.time()
        if (self._model_cache is not None and 
            self._model_cache_time is not None and 
            current_time - self._model_cache_time < self.model_cache_ttl):
            logger.debug("Returning cached model list")
            return self._model_cache
        
        # Get models from any connected tab
        clients = self.eval_server.get_clients()
        ready_client = next((c for c in clients if c.is_connected()), None)
        
        if not ready_client:
            logger.warning("No connected tabs available for model listing")
            return []
        
        try:
            # Create a get_models request to the DevTools tab
            eval_id = f"get_models_{uuid.uuid4().hex}"
            evaluation = {
                "id": eval_id,  # Add the required id field
                "evaluationId": eval_id,
                "name": "get_models",  # Add the required name field
                "tool": "get_models",
                "url": None,
                "input": {},
                "timeout": 10000  # 10 second timeout for model listing
            }
            
            logger.info(f"Requesting models from connected client {ready_client.id}")
            result = await ready_client.evaluate(evaluation)
            
            # Parse the result from Browser Operator
            models = self._parse_models_result(result)
            
            # Cache the results
            self._model_cache = models
            self._model_cache_time = current_time
            
            logger.info(f"Retrieved {len(models)} models from Browser Operator")
            return models
            
        except Exception as e:
            logger.error(f"Error getting models from Browser Operator: {e}")
            logger.info("Falling back to static model list")
            
            # Fallback to static list if dynamic fetching fails
            models = [
                OpenAIModelInfo(
                    id="gpt-4.1",
                    created=int(current_time),
                    owned_by="browser-operator"
                ),
                OpenAIModelInfo(
                    id="gpt-4.1-mini", 
                    created=int(current_time),
                    owned_by="browser-operator"
                ),
                OpenAIModelInfo(
                    id="gpt-4.1-nano",
                    created=int(current_time),
                    owned_by="browser-operator"
                ),
                OpenAIModelInfo(
                    id="claude-3-5-sonnet",
                    created=int(current_time),
                    owned_by="anthropic"
                ),
                OpenAIModelInfo(
                    id="claude-3-5-haiku",
                    created=int(current_time), 
                    owned_by="anthropic"
                )
            ]
            
            # Cache the fallback results
            self._model_cache = models
            self._model_cache_time = current_time
            
            return models
    
    def _parse_models_result(self, result: Dict[str, Any]) -> List[OpenAIModelInfo]:
        """
        Parse model result from DevTools tab into OpenAI format.
        
        Args:
            result: Raw result from evaluation
            
        Returns:
            List of OpenAI-compatible model info
        """
        models = []
        current_selection = None
        
        try:
            # Extract models and current selection from various possible result formats
            model_data = None
            
            if isinstance(result, dict):
                # Check direct response format
                if 'models' in result:
                    model_data = result['models']
                    current_selection = result.get('currentSelection')
                # Check nested output format  
                elif 'output' in result and isinstance(result['output'], dict):
                    output = result['output']
                    if 'models' in output:
                        model_data = output['models']
                        current_selection = output.get('currentSelection')
                # Check response string format
                elif 'response' in result:
                    response = result['response']
                    if isinstance(response, str):
                        try:
                            parsed = json.loads(response)
                            if 'models' in parsed:
                                model_data = parsed['models']
                                current_selection = parsed.get('currentSelection')
                        except json.JSONDecodeError:
                            pass
            
            logger.info(f"Current model selection from Browser Operator: {current_selection}")
            
            if model_data and isinstance(model_data, list):
                selected_count = 0
                for model in model_data:
                    if isinstance(model, dict) and 'id' in model:
                        is_selected = model.get('selected', False)
                        if is_selected:
                            selected_count += 1
                            
                        models.append(OpenAIModelInfo(
                            id=model['id'],
                            created=int(time.time()),
                            owned_by=model.get('provider', 'browser-operator'),
                        ))
                    elif isinstance(model, str):
                        # Simple model name
                        models.append(OpenAIModelInfo(
                            id=model,
                            created=int(time.time()),
                            owned_by='browser-operator',
                        ))
                
                logger.info(f"Found {len(models)} models with {selected_count} selected")
            
            # Fallback: provide some default models if nothing found
            if not models:
                logger.warning("No models found in result, providing defaults")
                default_models = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano']
                for model_name in default_models:
                    models.append(OpenAIModelInfo(
                        id=model_name,
                        created=int(time.time()),
                        owned_by='browser-operator',
                    ))
            
        except Exception as e:
            logger.error(f"Error parsing models result: {e}")
            logger.debug(f"Raw result: {result}")
            # Provide fallback models
            models = [
                OpenAIModelInfo(
                    id='gpt-4.1',
                    created=int(time.time()),
                    owned_by='browser-operator',
                )
            ]
        
        return models
    
    def _convert_openai_to_evaluation(self, request: OpenAIChatCompletionRequest) -> Dict[str, Any]:
        """
        Convert OpenAI chat completion request to evaluation format.
        
        Args:
            request: OpenAI chat completion request
            
        Returns:
            Evaluation object for Browser Operator
        """
        # Convert OpenAI messages array to single message string
        # The Browser Operator expects input.message (string), not input.messages (array)
        message_parts = []
        for msg in request.messages:
            if msg.role == "system":
                message_parts.append(f"System: {msg.content}")
            elif msg.role == "user":
                message_parts.append(f"User: {msg.content}")
            elif msg.role == "assistant":
                message_parts.append(f"Assistant: {msg.content}")
            else:
                message_parts.append(f"{msg.role}: {msg.content}")
        
        # Join all messages into a single conversation string
        conversation_message = "\n\n".join(message_parts)
        
        # If there's only a user message, use it directly
        if len(request.messages) == 1 and request.messages[0].role == "user":
            conversation_message = request.messages[0].content
        
        # Create evaluation object
        evaluation = {
            "id": f"openai-chat-{uuid.uuid4().hex[:8]}",
            "name": "OpenAI Chat Completion",
            "description": f"Chat completion using model {request.model}",
            "tool": "chat",
            "input": {
                "message": conversation_message,  # Single message string as expected by executeChatEvaluation
                "model": request.model,
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "top_p": request.top_p,
                "frequency_penalty": request.frequency_penalty,
                "presence_penalty": request.presence_penalty,
            },
            "timeout": 300000,  # 5 minutes
            "metadata": {
                "tags": ["openai-api", "chat-completion"],
                "source": "openai-compatible-api",
                "original_model": request.model,
            },
        }
        
        return evaluation
    
    def _convert_responses_to_evaluation(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert OpenAI Responses API request to evaluation format.
        
        Args:
            request: Responses API request with input field
            
        Returns:
            Evaluation object for Browser Operator
        """
        # Create evaluation object for responses API
        evaluation = {
            "id": f"openai-responses-{uuid.uuid4().hex[:8]}",
            "name": "OpenAI Responses API Request",
            "description": "Dynamic evaluation from OpenAI Responses API",
            "tool": "chat",
            "input": {
                "message": request["input"],  # Direct message from input
                "reasoning": "OpenAI Responses API processing",
            },
            "timeout": 300000,  # 5 minutes
            "metadata": {
                "tags": ["openai-api", "responses"],
                "source": "openai-responses-api",
                "priority": "high",
            },
        }
        
        # Merge any model configuration from request
        if "main_model" in request:
            evaluation["input"]["main_model"] = request["main_model"]
        if "mini_model" in request:
            evaluation["input"]["mini_model"] = request["mini_model"]
        if "nano_model" in request:
            evaluation["input"]["nano_model"] = request["nano_model"]
        if "provider" in request:
            evaluation["input"]["provider"] = request["provider"]
        
        return evaluation
    
    def _convert_result_to_responses(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Convert evaluation result to OpenAI Responses API format.
        
        Args:
            result: Result from Browser Operator evaluation
            
        Returns:
            OpenAI Responses API compatible response
        """
        # Extract response text from evaluation result
        response_text = self._extract_response_text(result)
        
        # Create message ID in OpenAI format
        message_id = f"msg_{uuid.uuid4().hex[:32]}"
        
        # Format in OpenAI Responses API format
        return [
            {
                "id": message_id,
                "type": "message",
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": response_text,
                        "annotations": []
                    }
                ]
            }
        ]
    
    def _convert_result_to_openai(
        self,
        result: Dict[str, Any],
        request: OpenAIChatCompletionRequest,
    ) -> OpenAIChatCompletionResponse:
        """
        Convert evaluation result back to OpenAI chat completion format.
        
        Args:
            result: Result from Browser Operator evaluation
            request: Original OpenAI request for context
            
        Returns:
            OpenAI-compatible response
        """
        # Extract response text from various possible result formats
        response_text = self._extract_response_text(result)
        
        # Create OpenAI-compatible response
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:29]}"
        
        choice = OpenAIChatChoice(
            index=0,
            message=OpenAIMessage(
                role="assistant",
                content=response_text,
            ),
            finish_reason="stop",
        )
        
        return OpenAIChatCompletionResponse(
            id=completion_id,
            created=int(time.time()),
            model=request.model,
            choices=[choice],
            usage={
                "prompt_tokens": sum(len(msg.content.split()) for msg in request.messages),
                "completion_tokens": len(response_text.split()),
                "total_tokens": sum(len(msg.content.split()) for msg in request.messages) + len(response_text.split()),
            },
        )
    
    def _extract_response_text(self, result: Dict[str, Any]) -> str:
        """
        Extract response text from evaluation result.
        
        Args:
            result: Evaluation result from Browser Operator
            
        Returns:
            Extracted response text
        """
        if not result:
            return "No response received from evaluation"
        
        # Handle different result formats
        if isinstance(result, str):
            return result
        
        # Check for nested evaluation result structure
        if isinstance(result, dict):
            # Try various common response fields
            response_fields = [
                'response', 'text', 'answer', 'content',
                'output.response', 'output.text', 'output.answer',
            ]
            
            for field in response_fields:
                if '.' in field:
                    # Handle nested fields
                    parts = field.split('.')
                    current = result
                    try:
                        for part in parts:
                            current = current[part]
                        if isinstance(current, str) and current.strip():
                            return current
                    except (KeyError, TypeError):
                        continue
                else:
                    # Handle top-level fields
                    if field in result and isinstance(result[field], str) and result[field].strip():
                        return result[field]
            
            # If result is an object, try to extract meaningful content
            return json.dumps(result, indent=2)
        
        return "Unable to extract response text from evaluation result"
    
    async def start(self):
        """Start the HTTP server"""
        if not self.eval_server.is_running():
            raise RuntimeError("EvalServer must be started before starting OpenAI-compatible server")
        
        logger.info(f"Starting OpenAI-compatible server on {self.host}:{self.port}")
        
        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level="info",
            access_log=True,
        )
        
        self.server = uvicorn.Server(config)
        await self.server.serve()
    
    async def stop(self):
        """Stop the HTTP server"""
        if hasattr(self, 'server'):
            logger.info("Stopping OpenAI-compatible server")
            await self.server.shutdown()


async def main():
    """Main entry point for running the OpenAI-compatible server standalone"""
    from .eval_server import EvalServer
    from .config import ServerConfig
    
    # Create config
    config = ServerConfig()
    
    # Create and start evaluation server
    eval_server = EvalServer(config)
    await eval_server.start()
    
    # Create and start OpenAI-compatible server
    openai_server = OpenAICompatibleServer(eval_server)
    
    try:
        await openai_server.start()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    finally:
        await openai_server.stop()
        await eval_server.stop()


if __name__ == "__main__":
    asyncio.run(main())