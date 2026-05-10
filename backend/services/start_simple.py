"""
Startup script for simplified microservices (no MediaPipe)
"""

import subprocess
import time
import sys
from pathlib import Path

def start_service(service_name: str, port: int, script_path: str, working_dir: str = None):
    """Start a service and return the process."""
    print(f"Starting {service_name} on port {port}...")
    
    try:
        # Use python from current environment
        if working_dir:
            # Get the absolute path from the services directory
            services_dir = Path(__file__).parent
            cwd = services_dir / working_dir
        else:
            cwd = Path(script_path).parent
            
        # Add current directory to Python path
        import os
        env = os.environ.copy()
        env['PYTHONPATH'] = str(cwd) + ';' + env.get('PYTHONPATH', '')
            
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", script_path, 
            "--host", "0.0.0.0", "--port", str(port)
        ], cwd=cwd, env=env)
        
        print(f"✅ {service_name} started (PID: {process.pid})")
        return process
        
    except Exception as e:
        print(f"❌ Failed to start {service_name}: {e}")
        return None

def main():
    """Start simplified services in correct order."""
    print("🚀 Starting Simplified Autism Detection Microservices")
    print("=" * 50)
    
    services = [
        ("CV Service (Simple)", 8001, "main_simple:app", "cv_service"),
        ("ML Service", 8003, "main:app", "ml_service"),
        ("Gateway", 8000, "gateway:app", "")
    ]
    
    processes = []
    
    try:
        # Start services
        for name, port, script, working_dir in services:
            process = start_service(name, port, script, working_dir)
            if process:
                processes.append((name, process))
            
            # Give service time to start
            time.sleep(2)
        
        print("\n" + "=" * 50)
        print("✅ All services started!")
        print("📍 Service URLs:")
        print("   - Gateway: http://localhost:8000")
        print("   - CV Service (Simple): http://localhost:8001") 
        print("   - ML Service: http://localhost:8003")
        print("\n🔗 Main API Endpoints:")
        print("   POST http://localhost:8000/api/assessment/eye-tracking")
        print("   POST http://localhost:8000/api/assessment/speech")
        print("   POST http://localhost:8000/api/assessment/mcq")
        print("   GET  http://localhost:8000/api/assessment/questions")
        print("   GET  http://localhost:8000/healthz")
        print("\nPress Ctrl+C to stop all services")
        
        # Wait for services
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n🛑 Stopping services...")
            
    finally:
        # Terminate all processes
        for name, process in processes:
            if process and process.poll() is None:
                print(f"Stopping {name}...")
                process.terminate()
                process.wait()
        
        print("✅ All services stopped")

if __name__ == "__main__":
    main()
