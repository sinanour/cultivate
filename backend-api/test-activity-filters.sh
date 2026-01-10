#!/bin/bash

# Start the API server in the background
echo "Starting API server..."
npm start &
API_PID=$!

# Wait for server to start
sleep 5

# Get auth token
echo -e "\n1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.accessToken')

echo "Token: ${TOKEN:0:50}..."

# Test 1: Filter by status
echo -e "\n2. Testing status filter (ACTIVE)..."
curl -s "http://localhost:3000/api/v1/activities?status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | length'

# Test 2: Filter by multiple statuses
echo -e "\n3. Testing multiple status filter (ACTIVE,PLANNED)..."
curl -s "http://localhost:3000/api/v1/activities?status=ACTIVE&status=PLANNED" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | length'

# Test 3: Filter by date range
echo -e "\n4. Testing date range filter..."
curl -s "http://localhost:3000/api/v1/activities?startDate=2024-01-01T00:00:00Z&endDate=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | length'

# Test 4: Combined filters
echo -e "\n5. Testing combined filters (status + date)..."
curl -s "http://localhost:3000/api/v1/activities?status=ACTIVE&startDate=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | length'

# Stop the server
echo -e "\n6. Stopping API server..."
kill $API_PID

echo -e "\nTests complete!"
