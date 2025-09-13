#!/usr/bin/env python3
"""
Langfuse Log Monitoring Script

This script monitors eval server logs in real-time for Langfuse-related events:
- Score upload confirmations
- Trace ID correlations
- Success/failure metrics
- Performance timings
"""

import os
import re
import sys
import time
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
from collections import defaultdict, Counter

class LangfuseLogMonitor:
    """Monitor eval server logs for Langfuse events."""
    
    def __init__(self, log_dir: Path = None):
        self.log_dir = log_dir or Path(__file__).parent / "logs"
        self.stats = {
            'scores_uploaded': 0,
            'trace_correlations': 0,
            'upload_failures': 0,
            'evaluations_processed': 0,
            'start_time': datetime.now()
        }
        self.trace_ids = set()
        self.evaluation_timings = []
        
    def find_latest_log_file(self) -> Optional[Path]:
        """Find the most recent browsecomp eval server log file."""
        if not self.log_dir.exists():
            print(f"❌ Log directory not found: {self.log_dir}")
            return None
            
        # Look for browsecomp_eval_server logs
        log_pattern = "browsecomp_eval_server_*.log"
        log_files = list(self.log_dir.glob(log_pattern))
        
        if not log_files:
            print(f"❌ No browsecomp eval server logs found in {self.log_dir}")
            print("   Run ./run_browsecomp_eval_server.sh first to generate logs")
            return None
            
        # Return the most recent log file
        latest = max(log_files, key=lambda f: f.stat().st_mtime)
        print(f"📁 Monitoring log file: {latest}")
        return latest
    
    def parse_langfuse_events(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a log line for Langfuse-related events."""
        timestamp_match = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', line)
        timestamp = timestamp_match.group(1) if timestamp_match else None
        
        event = None
        
        # Configuration status
        if "Langfuse Integration:" in line:
            if "✅ ENABLED" in line:
                event = {
                    'type': 'langfuse_enabled',
                    'status': 'enabled',
                    'message': 'Langfuse integration is active'
                }
            elif "❌ DISABLED" in line:
                event = {
                    'type': 'langfuse_disabled',
                    'status': 'disabled',
                    'message': 'Langfuse integration is disabled'
                }
        
        # Score uploads (from langfuse_tracer)
        elif "score_agent_trace" in line or "Attaching score" in line:
            trace_id_match = re.search(r'trace[_-]?id[:\s]*([a-zA-Z0-9\-]+)', line, re.IGNORECASE)
            score_match = re.search(r'score[:\s]*([0-9.]+)', line)
            
            event = {
                'type': 'score_upload',
                'trace_id': trace_id_match.group(1) if trace_id_match else None,
                'score': float(score_match.group(1)) if score_match else None,
                'message': line.strip()
            }
            
            if event['trace_id']:
                self.trace_ids.add(event['trace_id'])
        
        # Evaluation processing
        elif "evaluation completed" in line.lower() or "Evaluation result" in line:
            trace_id_match = re.search(r'traceId[:\s]*([a-zA-Z0-9\-]+)', line, re.IGNORECASE)
            duration_match = re.search(r'duration[:\s]*([0-9.]+)', line, re.IGNORECASE)
            
            event = {
                'type': 'evaluation_complete',
                'trace_id': trace_id_match.group(1) if trace_id_match else None,
                'duration': float(duration_match.group(1)) if duration_match else None,
                'message': line.strip()
            }
            
            if event['duration']:
                self.evaluation_timings.append(event['duration'])
        
        # Client connections
        elif "Client connected" in line or "Agent connected" in line:
            client_id_match = re.search(r'client[_\s]?id[:\s]*([a-zA-Z0-9\-]+)', line, re.IGNORECASE)
            event = {
                'type': 'client_connect',
                'client_id': client_id_match.group(1) if client_id_match else None,
                'message': line.strip()
            }
        
        # Errors
        elif "ERROR" in line and ("langfuse" in line.lower() or "trace" in line.lower()):
            event = {
                'type': 'error',
                'severity': 'error',
                'message': line.strip()
            }
        
        if event:
            event['timestamp'] = timestamp
            event['raw_line'] = line.strip()
        
        return event
    
    def update_stats(self, event: Dict[str, Any]):
        """Update monitoring statistics based on event."""
        if event['type'] == 'score_upload':
            self.stats['scores_uploaded'] += 1
            if event['trace_id']:
                self.stats['trace_correlations'] += 1
        
        elif event['type'] == 'evaluation_complete':
            self.stats['evaluations_processed'] += 1
            
        elif event['type'] == 'error':
            self.stats['upload_failures'] += 1
    
    def print_event(self, event: Dict[str, Any]):
        """Print a formatted event to console."""
        timestamp = event.get('timestamp', datetime.now().strftime('%H:%M:%S'))
        
        if event['type'] == 'langfuse_enabled':
            print(f"🟢 [{timestamp}] LANGFUSE ENABLED - Ready to track evaluations")
            
        elif event['type'] == 'langfuse_disabled':
            print(f"🔴 [{timestamp}] LANGFUSE DISABLED - Scores will not be uploaded")
            
        elif event['type'] == 'score_upload':
            trace_id = event.get('trace_id', 'unknown')[:8]
            score = event.get('score', 'N/A')
            print(f"📊 [{timestamp}] SCORE UPLOADED - Trace: {trace_id}... Score: {score}")
            
        elif event['type'] == 'evaluation_complete':
            trace_id = event.get('trace_id', 'unknown')[:8] if event.get('trace_id') else 'unknown'
            duration = event.get('duration', 'N/A')
            print(f"✅ [{timestamp}] EVALUATION COMPLETE - Trace: {trace_id}... Duration: {duration}s")
            
        elif event['type'] == 'client_connect':
            client_id = event.get('client_id', 'unknown')[:8] if event.get('client_id') else 'unknown'
            print(f"🔌 [{timestamp}] CLIENT CONNECTED - ID: {client_id}...")
            
        elif event['type'] == 'error':
            print(f"❌ [{timestamp}] ERROR - {event['message'][:100]}...")
    
    def print_stats_summary(self):
        """Print current monitoring statistics."""
        runtime = datetime.now() - self.stats['start_time']
        
        print(f"\n📈 MONITORING STATS (Runtime: {runtime.total_seconds():.1f}s)")
        print("=" * 50)
        print(f"🏃 Evaluations Processed: {self.stats['evaluations_processed']}")
        print(f"📊 Scores Uploaded: {self.stats['scores_uploaded']}")
        print(f"🔗 Trace Correlations: {self.stats['trace_correlations']}")
        print(f"❌ Upload Failures: {self.stats['upload_failures']}")
        print(f"🆔 Unique Traces: {len(self.trace_ids)}")
        
        if self.evaluation_timings:
            avg_duration = sum(self.evaluation_timings) / len(self.evaluation_timings)
            print(f"⏱️  Avg Eval Duration: {avg_duration:.2f}s")
        
        if self.stats['scores_uploaded'] > 0:
            success_rate = (self.stats['scores_uploaded'] / (self.stats['scores_uploaded'] + self.stats['upload_failures'])) * 100
            print(f"✅ Upload Success Rate: {success_rate:.1f}%")
        
        print("=" * 50)
    
    def tail_log_file(self, log_file: Path, follow: bool = True):
        """Tail a log file and monitor for Langfuse events."""
        print(f"🔍 Starting Langfuse log monitoring...")
        print(f"📁 Log file: {log_file}")
        print("🎯 Looking for: Langfuse config, score uploads, trace correlations")
        print("⏹️  Press Ctrl+C to stop\n")
        
        try:
            with open(log_file, 'r') as f:
                # Start from end of file if following
                if follow:
                    f.seek(0, 2)  # Seek to end
                
                while True:
                    line = f.readline()
                    
                    if not line:
                        if not follow:
                            break
                        time.sleep(0.1)
                        continue
                    
                    # Parse and handle Langfuse events
                    event = self.parse_langfuse_events(line)
                    if event:
                        self.update_stats(event)
                        self.print_event(event)
                        
        except KeyboardInterrupt:
            print(f"\n🛑 Monitoring stopped")
            self.print_stats_summary()
        except Exception as e:
            print(f"❌ Error monitoring log file: {e}")

def main():
    """Main entry point for log monitoring."""
    parser = argparse.ArgumentParser(description="Monitor Langfuse events in eval server logs")
    parser.add_argument("--log-file", type=Path, help="Specific log file to monitor")
    parser.add_argument("--log-dir", type=Path, help="Log directory (default: ./logs)")
    parser.add_argument("--no-follow", action="store_true", help="Don't follow file (process existing content only)")
    parser.add_argument("--stats-interval", type=int, default=30, help="Stats summary interval in seconds")
    
    args = parser.parse_args()
    
    # Initialize monitor
    monitor = LangfuseLogMonitor(log_dir=args.log_dir)
    
    # Determine log file to monitor
    if args.log_file:
        if not args.log_file.exists():
            print(f"❌ Specified log file does not exist: {args.log_file}")
            sys.exit(1)
        log_file = args.log_file
    else:
        log_file = monitor.find_latest_log_file()
        if not log_file:
            sys.exit(1)
    
    # Start monitoring
    monitor.tail_log_file(log_file, follow=not args.no_follow)

if __name__ == "__main__":
    main()