#!/bin/bash
# Script to prepare macOS target host for deployment
# Run this on the target macOS machine before deploying

set -e

echo "=========================================="
echo "Cultivate"
echo "macOS Target Preparation Script"
echo "=========================================="
echo ""

# Check if running on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: This script is for macOS only"
    exit 1
fi

# Check if Finch is installed
if ! command -v finch &> /dev/null; then
    echo "Warning: Finch is not installed"
    echo ""
    echo "To install Finch:"
    echo "  brew install --cask finch"
    echo ""
    echo "After installation, initialize Finch:"
    echo "  finch vm init"
    echo ""
    read -p "Continue without Finch? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Finch is installed"
    finch --version
fi

echo ""

# Create deployment directory
DEPLOY_DIR="/opt/cultivate"

echo "Creating deployment directory: $DEPLOY_DIR"
if [ -d "$DEPLOY_DIR" ]; then
    echo "  Directory already exists"
else
    sudo mkdir -p "$DEPLOY_DIR"
    echo "  ✓ Directory created"
fi

# Get current user
CURRENT_USER=$(whoami)
echo ""
echo "Setting ownership to: $CURRENT_USER:staff"
sudo chown -R "$CURRENT_USER:staff" "$DEPLOY_DIR"
echo "  ✓ Ownership set"

# Set permissions
echo ""
echo "Setting permissions..."
chmod 755 "$DEPLOY_DIR"
echo "  ✓ Permissions set to 755"

echo ""
echo "=========================================="
echo "✓ macOS target prepared successfully!"
echo "=========================================="
echo ""
echo "Deployment directory: $DEPLOY_DIR"
echo "Owner: $CURRENT_USER:staff"
echo "Permissions: 755"
echo ""
echo "You can now run the deployment from your local machine:"
echo "  cd deployment"
echo "  node dist/index.js deploy --target $(hostname) --build-mode local"
echo ""
