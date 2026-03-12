#!/bin/bash
# Outputs contents of Caddy config for a service. Used by the API to get domain/port.
# Must be run with sudo (allowed via sudoers for altsuite user).

ALLOWED="mattermost penpot gitea caldotcom outline jitsimeet"
SERVICE_NAME="${1:-}"

if [[ -z "$SERVICE_NAME" ]]; then
  exit 1
fi

if [[ " $ALLOWED " != *" $SERVICE_NAME "* ]]; then
  exit 1
fi

CONF_FILE="/etc/caddy/conf.d/${SERVICE_NAME}.caddy"
if [[ -f "$CONF_FILE" ]]; then
  cat "$CONF_FILE"
fi
