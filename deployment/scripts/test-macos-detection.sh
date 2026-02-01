#!/bin/bash
# Test script to verify macOS/Finch detection on target host
# Usage: ./test-macos-detection.sh <target-host>

TARGET_HOST=$1

if [ -z "$TARGET_HOST" ]; then
    echo "Usage: $0 <target-host>"
    exit 1
fi

echo "Testing macOS/Finch detection on: $TARGET_HOST"
echo "================================================"
echo ""

echo "1. Testing uname command:"
ssh "$TARGET_HOST" "uname"
echo ""

echo "2. Testing sw_vers command:"
ssh "$TARGET_HOST" "sw_vers -productVersion"
echo ""

echo "3. Testing finch in PATH:"
ssh "$TARGET_HOST" "command -v finch || echo 'Not in PATH'"
echo ""

echo "4. Testing finch at /usr/local/bin/finch:"
ssh "$TARGET_HOST" "/usr/local/bin/finch --version 2>&1 || echo 'Not found'"
echo ""

echo "5. Testing finch at /opt/homebrew/bin/finch (Apple Silicon):"
ssh "$TARGET_HOST" "/opt/homebrew/bin/finch --version 2>&1 || echo 'Not found'"
echo ""

echo "6. Testing finch at \$HOME/.finch/bin/finch:"
ssh "$TARGET_HOST" "\$HOME/.finch/bin/finch --version 2>&1 || echo 'Not found'"
echo ""

echo "7. Testing finch compose version (detailed):"
echo "  Trying: finch compose version"
ssh "$TARGET_HOST" "finch compose version 2>&1" && echo "  Exit code: $?" || echo "  Exit code: $?"
echo ""
echo "  Trying: /usr/local/bin/finch compose version"
ssh "$TARGET_HOST" "/usr/local/bin/finch compose version 2>&1" && echo "  Exit code: $?" || echo "  Exit code: $?"
echo ""
echo "  Trying: /opt/homebrew/bin/finch compose version"
ssh "$TARGET_HOST" "/opt/homebrew/bin/finch compose version 2>&1" && echo "  Exit code: $?" || echo "  Exit code: $?"
echo ""

echo "8. Testing docker command (should fail on macOS without Docker):"
ssh "$TARGET_HOST" "docker --version 2>&1 || echo 'Docker not found (expected on macOS with Finch only)'"
echo ""

echo "9. Checking PATH in non-interactive SSH:"
ssh "$TARGET_HOST" "echo \$PATH"
echo ""

echo "10. Checking which finch (if in PATH):"
ssh "$TARGET_HOST" "which finch 2>&1 || echo 'which command failed or finch not in PATH'"
echo ""

echo "Detection test complete!"
