#!/bin/bash
# Removes /etc/altsuite/<service> for an allowed service name. Used by the API for uninstall.
# Must be run with sudo (allowed via sudoers for altsuite user).

set -e
ALLOWED="mattermost penpot gitea caldotcom outline jitsimeet"
SERVICE_NAME="${1:-}"

if [[ -z "$SERVICE_NAME" ]]; then
  echo "Usage: $0 <service_name>"
  exit 1
fi

if [[ " $ALLOWED " != *" $SERVICE_NAME "* ]]; then
  echo "Disallowed service name: $SERVICE_NAME"
  exit 1
fi

SERVICE_DIR="/etc/altsuite/$SERVICE_NAME"
if [[ -d "$SERVICE_DIR" ]]; then
  rm -rf "$SERVICE_DIR"
fi
