#!/bin/bash
set -e

SERVICE_DIR="$1"
DOMAIN_ARG="$2"
POSTGRES_PASSWORD_ARG="${3:-}"
SUPPORT_EMAIL_ARG="${4:-}"

if [ -z "$SERVICE_DIR" ] || [ -z "$DOMAIN_ARG" ]; then
	echo "Usage: $0 <service_dir> <domain> [postgres_password] [support_email]"
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

# Set required domain
sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN_ARG/" .env

# Pin to a stable release tag
sed -i "s/^MATTERMOST_IMAGE_TAG=.*/MATTERMOST_IMAGE_TAG=release-10.5/" .env

# Set postgres password if provided
if [ -n "$POSTGRES_PASSWORD_ARG" ]; then
	sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD_ARG/" .env
	# Also update the connection URL which references the password
	sed -i "s|postgres://mmuser:mostest@|postgres://mmuser:${POSTGRES_PASSWORD_ARG}@|g" .env
fi

# Set support email if provided
if [ -n "$SUPPORT_EMAIL_ARG" ]; then
	# Append if not already present, otherwise replace
	if grep -q "^MM_SUPPORTSETTINGS_SUPPORTEMAIL=" .env; then
		sed -i "s/^MM_SUPPORTSETTINGS_SUPPORTEMAIL=.*/MM_SUPPORTSETTINGS_SUPPORTEMAIL=$SUPPORT_EMAIL_ARG/" .env
	else
		echo "MM_SUPPORTSETTINGS_SUPPORTEMAIL=$SUPPORT_EMAIL_ARG" >> .env
	fi
fi

mkdir -p ./volumes/app/mattermost/{config,data,logs,plugins,client/plugins,bleve-indexes}
# chown the service dir to altsuite first, then re-apply 2000:2000 to the
# mattermost volumes so the container process (uid 2000) can write to them.
chown -R altsuite:altsuite "$SERVICE_DIR"
chown -R 2000:2000 ./volumes/app/mattermost

echo "Starting Mattermost containers..."
docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml up -d

echo ""
echo "========================================"
echo "Mattermost running at https://$DOMAIN_ARG (Caddy proxies host port 8065)"
echo "========================================"
echo "========================================"
