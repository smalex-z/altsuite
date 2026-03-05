#!/bin/bash
set -e

SERVICE_DIR="$1"
DOMAIN_ARG="$2"

if [ -z "$SERVICE_DIR" ]; then
    echo "Usage: $0 <service_dir> [domain]"
    exit 1
fi

# Example Gitea install logic (replace with real logic as needed)
echo "Installing Gitea..."
mkdir -p "$SERVICE_DIR"
chown altsuite:altsuite "$SERVICE_DIR"
echo "Created directories in $SERVICE_DIR"
# Add Gitea-specific installation steps here
