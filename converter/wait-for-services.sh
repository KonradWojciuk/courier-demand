#!/bin/bash
set -e

# Ensure output is flushed immediately
export PYTHONUNBUFFERED=1

# Function to wait for a service with timeout
wait_for_service() {
  local service_name=$1
  local url=$2
  local max_attempts=$3
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Waiting for $service_name to be ready..."
  local wait_count=0
  
  while [ $wait_count -lt $max_attempts ]; do
    if curl -f -s --max-time 5 "$url" > /dev/null 2>&1; then
      echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $service_name is ready! (waited ${wait_count} attempts = $((wait_count * 2))s)"
      return 0
    fi
    wait_count=$((wait_count + 1))
    if [ $((wait_count % 10)) -eq 0 ]; then
      echo "[$(date +'%Y-%m-%d %H:%M:%S')] Still waiting for $service_name... (attempt $wait_count/$max_attempts = $((wait_count * 2))s)"
    fi
    sleep 2
  done
  
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ WARNING: $service_name did not become ready after $max_attempts attempts ($((max_attempts * 2))s)"
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Proceeding anyway - services may still be initializing..."
  return 1
}

echo "=========================================="
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Converter startup script started"
echo "=========================================="

# Wait for MinIO (max 2 minutes = 60 attempts)
wait_for_service "MinIO" "http://minio:9000/minio/health/live" 60 || true

# Wait for Trino (max 3 minutes = 90 attempts)
wait_for_service "Trino" "http://trino:8080/v1/info" 90 || true

# Additional delay to ensure services are fully initialized
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Waiting additional 5 seconds for services to fully initialize..."
sleep 5

echo "=========================================="
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting converter..."
echo "[$(date +'%Y-%m-%d %H:%M:%S')] Command: $@"
echo "=========================================="
exec "$@"
