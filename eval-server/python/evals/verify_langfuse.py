#!/usr/bin/env python3
"""
Langfuse Integration Verification Script

This script verifies that Langfuse integration is working correctly by:
1. Testing API connectivity with current credentials
2. Listing existing projects to confirm access
3. Creating a test trace to verify write permissions
4. Querying recent traces to establish baseline
"""

import os
import sys
import time
import json
from pathlib import Path
from datetime import datetime, timedelta
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

# Test Langfuse import and configuration
try:
    from langfuse import Langfuse
    langfuse_available = True
    print("✅ Langfuse library imported successfully")
except ImportError as e:
    print(f"❌ Failed to import Langfuse: {e}")
    print("   Install with: uv add langfuse")
    sys.exit(1)

def check_environment() -> Dict[str, str]:
    """Check and return Langfuse environment configuration."""
    config = {
        'enable': os.getenv('LANGFUSE_ENABLE', ''),
        'host': os.getenv('LANGFUSE_HOST', ''),
        'public_key': os.getenv('LANGFUSE_PUBLIC_KEY', ''),
        'secret_key': os.getenv('LANGFUSE_SECRET_KEY', ''),
        'project': os.getenv('LANGFUSE_PROJECT', ''),
    }
    
    print("\n🔧 Environment Configuration:")
    print(f"   LANGFUSE_ENABLE: '{config['enable']}'")
    print(f"   LANGFUSE_HOST: '{config['host']}'")
    print(f"   LANGFUSE_PUBLIC_KEY: '{config['public_key'][:10]}...' if public_key else 'NOT_SET'")
    print(f"   LANGFUSE_SECRET_KEY: '{'SET' if config['secret_key'] else 'NOT_SET'}'")
    print(f"   LANGFUSE_PROJECT: '{config['project'] if config['project'] else 'DEFAULT'}'")
    
    # Check if enabled
    enabled = config['enable'].lower() in ('true', '1', 'yes', 'on')
    if not enabled:
        print("❌ Langfuse is not enabled (LANGFUSE_ENABLE != 'true')")
        return {}
    
    # Check required fields
    if not all([config['host'], config['public_key'], config['secret_key']]):
        missing = [k for k, v in config.items() if k in ['host', 'public_key', 'secret_key'] and not v]
        print(f"❌ Missing required configuration: {missing}")
        return {}
    
    print("✅ Environment configuration is valid")
    return config

def test_api_connectivity(config: Dict[str, str]) -> Optional[Langfuse]:
    """Test API connectivity and return client if successful."""
    print("\n🌐 Testing API Connectivity...")
    
    try:
        # Create Langfuse client
        client_args = {
            'public_key': config['public_key'],
            'secret_key': config['secret_key'],
            'host': config['host'],
        }
        
        client = Langfuse(**client_args)
        
        # Test connection using auth_check
        auth_result = client.auth_check()
        if not auth_result:
            raise Exception("Authentication failed")
        
        print(f"✅ Successfully connected to Langfuse at {config['host']}")
        print(f"   Project: {config['project'] if config['project'] else 'default'}")
        
        return client
        
    except Exception as e:
        print(f"❌ Failed to connect to Langfuse: {e}")
        return None

def test_write_permissions(client: Langfuse) -> bool:
    """Test write permissions by creating a test trace."""
    print("\n✍️  Testing Write Permissions...")
    
    try:
        # Create a test event to verify write permissions
        test_event = client.create_event(
            name="langfuse_verification_test",
            metadata={
                "verification_script": True,
                "timestamp": datetime.now().isoformat(),
                "test_type": "write_permissions"
            },
            input={"test": "Verification script test event"},
            output={"status": "success", "message": "Write test completed"}
        )
        
        # Create a test score
        client.create_score(
            name="test_score",
            value=1.0,
            comment="Test score from verification script"
        )
        
        print(f"✅ Successfully created test event and score")
        print("   Write permissions verified")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to create test trace: {e}")
        return False

def query_recent_traces(client: Langfuse) -> List[Dict[str, Any]]:
    """Query recent traces to establish baseline."""
    print("\n📊 Querying Recent Traces...")
    
    try:
        # Note: Langfuse Python SDK doesn't have a direct trace query method
        # In a real implementation, you'd use the REST API
        print("ℹ️  Trace querying requires REST API calls")
        print("   Recent traces would be visible in Langfuse dashboard")
        print(f"   Dashboard: {client._client.host if hasattr(client, '_client') and hasattr(client._client, 'host') else 'https://cloud.langfuse.com'}")
        
        return []
        
    except Exception as e:
        print(f"❌ Failed to query traces: {e}")
        return []

def main():
    """Run complete Langfuse verification."""
    print("🔍 Langfuse Integration Verification")
    print("=" * 50)
    
    # Check environment
    config = check_environment()
    if not config:
        print("\n❌ Environment configuration failed")
        sys.exit(1)
    
    # Test API connectivity
    client = test_api_connectivity(config)
    if not client:
        print("\n❌ API connectivity test failed")
        sys.exit(1)
    
    # Test write permissions
    write_success = test_write_permissions(client)
    if not write_success:
        print("\n❌ Write permissions test failed")
        sys.exit(1)
    
    # Query recent traces
    recent_traces = query_recent_traces(client)
    
    # Final summary
    print("\n🎉 Verification Complete!")
    print("=" * 50)
    print("✅ Environment configuration: PASSED")
    print("✅ API connectivity: PASSED")
    print("✅ Write permissions: PASSED")
    print("ℹ️  Recent traces: Check dashboard")
    print("\n🚀 Langfuse integration is ready for browsecomp evaluations!")
    
    # Show next steps
    print("\n📝 Next Steps:")
    print("1. Run: ./run_browsecomp_eval_server.sh --limit 1")
    print("2. Complete an evaluation in Browser Operator")
    print("3. Check Langfuse dashboard for scores")
    print(f"   Dashboard: {config['host']}")

if __name__ == "__main__":
    main()