#!/bin/bash
set -e

DOMAIN_ARG="$1"

if [ -z "$DOMAIN_ARG" ]; then
	echo "Usage: $0 <dashboard-domain>"
	exit 1
fi

# Validate domain — only allow safe hostname characters
if ! echo "$DOMAIN_ARG" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'; then
	echo "Invalid domain: $DOMAIN_ARG"
	exit 1
fi

CADDY_CONF="/etc/caddy/conf.d/dashboard.caddy"

mkdir -p /etc/caddy/conf.d

cat > "$CADDY_CONF" <<EOF
${DOMAIN_ARG} {
    reverse_proxy localhost:8080
}
EOF

echo "Dashboard Caddy config written to $CADDY_CONF"
systemctl reload caddy
echo "Caddy reloaded."
