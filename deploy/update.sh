#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="/opt/altsuite"

echo "Updating AltSuite"
echo "==================================="

systemctl stop altsuite || true

echo "Deploying binary..."
cp "$PROJECT_ROOT/api/altsuite" "$INSTALL_DIR/bin/altsuite"
chmod +x "$INSTALL_DIR/bin/altsuite"
chown altsuite:altsuite "$INSTALL_DIR/bin/altsuite"

if [ -d "$PROJECT_ROOT/frontend/out" ]; then
    echo "Deploying frontend..."
    rm -rf "$INSTALL_DIR/frontend/"*
    cp -r "$PROJECT_ROOT/frontend/out/." "$INSTALL_DIR/frontend/"
    chown -R altsuite:altsuite "$INSTALL_DIR/frontend"
fi

systemctl start altsuite

echo ""
echo "==================================="
echo "Update complete."
echo "==================================="
