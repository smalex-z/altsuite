#!/bin/bash
set -e

echo "Building AltSuite"
echo "==================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Build API
echo "Building Go API..."
cd "$PROJECT_ROOT/api"
go build -o altsuite main.go privileged.go osManager.go
echo "✓ API binary created: api/altsuite"

# Build Frontend
echo "Building Frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
fi
npm run build
echo "✓ Frontend built: frontend/out/"

echo ""
echo "==================================="
echo "Build Complete!"
echo "==================================="
echo ""
echo "To install, run:"
echo "  cd deploy"
echo "  sudo ./install.sh"
echo ""

# Ensure install scripts are executable
chmod +x "$SCRIPT_DIR/install.sh" \
    "$SCRIPT_DIR/uninstall.sh" \
    "$SCRIPT_DIR/update.sh" \
    "$SCRIPT_DIR/services/mattermost-install.sh" \
    "$SCRIPT_DIR/services/penpot-install.sh" \
    "$SCRIPT_DIR/services/gitea-install.sh" \
    "$SCRIPT_DIR/services/caldotcom-install.sh"
echo "✓ Installer scripts are now executable."
