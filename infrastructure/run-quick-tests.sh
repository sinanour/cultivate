#!/bin/bash

# Quick test runner with reduced PBT iterations
# This runs tests faster for local development

echo "Running tests with reduced property-based test iterations..."
echo "This is faster but provides less coverage than full test suite."
echo ""

# Set environment variable to reduce PBT runs
export PBT_RUNS=10

# Run tests
npm test -- --maxWorkers=2

echo ""
echo "Quick tests complete!"
echo "For full coverage, run: npm test"
