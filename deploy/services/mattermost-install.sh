#!/bin/bash
set -e

SERVICE_DIR="$1"
DOMAIN_ARG="$2"

if [ -z "$SERVICE_DIR" ] || [ -z "$DOMAIN_ARG" ]; then
	echo "Usage: $0 <service_dir> <domain>"
	exit 1
fi

if ! command -v docker &>/dev/null; then
	echo "Docker is required. Install Docker and try again."
	exit 1
fi

echo "Cloning Mattermost Docker repository..."
git clone https://github.com/mattermost/docker "$SERVICE_DIR"

cd "$SERVICE_DIR"
cp env.example .env
sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN_ARG/" .env

mkdir -p ./volumes/app/mattermost/{config,data,logs,plugins,client/plugins,bleve-indexes}
chown -R 2000:2000 ./volumes/app/mattermost
chown -R altsuite:altsuite "$SERVICE_DIR"

echo "Starting Mattermost containers..."
docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml up -d

echo ""
echo "========================================"
echo "Mattermost running at http://$DOMAIN_ARG:8065"
echo "========================================"
