#!/bin/bash
set -e

# The purpose of this script is to provide a quick installation method for Altsuite.
# It is intended as a one line install into the bash shell. This is frowned upon for security
# reasons, but it is a common method for quick installs. Use at your own risk.

REPO_URL="https://github.com/smalex-z/altsuite.git"
REPO_DIR="altsuite"

echo "[AltSuite Quick Install]"
echo "Cloning repository..."
git clone --depth=1 "$REPO_URL" "$REPO_DIR"
cd "$REPO_DIR/deploy"

echo "Making build script executable..."
chmod +x ./build.sh

echo "Running build script..."
./build.sh

echo "Running installer (sudo required)..."
sudo ./install.sh

echo "[AltSuite] Installation complete!"