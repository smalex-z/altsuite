#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script as root or with sudo"
    exit 1
fi

# Parse arguments
MODE="altsuite"
SERVICE_NAME_ARG=""

if [ $# -eq 1 ]; then
    MODE="service"
    SERVICE_NAME_ARG="$1"
fi

# ============================================
# SHARED HELPERS
# ============================================

# Remove Caddy reverse-proxy config for a service and reload Caddy.
caddy_remove_site() {
    local service="$1"
    local conf_file="/etc/caddy/conf.d/${service}.caddy"
    if [ -f "$conf_file" ]; then
        echo "Removing Caddy config $conf_file..."
        rm -f "$conf_file"
        if systemctl is-active --quiet caddy 2>/dev/null; then
            systemctl reload caddy || true
            echo "Caddy reloaded."
        fi
    else
        echo "Caddy config $conf_file not found — skipping."
    fi
}

# Stop containers, optionally destroy volumes, remove service directory and Caddy config.
# Usage: uninstall_service <service_name> <remove_volumes: y|n>
uninstall_service() {
    local SERVICE_NAME="$1"
    local REMOVE_VOLUMES="$2"   # "y" to destroy volumes, anything else to keep them
    local SERVICE_DIR="/etc/altsuite/$SERVICE_NAME"

    echo "Uninstalling service: $SERVICE_NAME"
    echo "----------------------------------------"

    if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "Stopping systemd unit $SERVICE_NAME..."
        systemctl stop "$SERVICE_NAME" || true
    fi

    if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
        echo "Disabling systemd unit $SERVICE_NAME..."
        systemctl disable "$SERVICE_NAME" || true
    fi

    if [ -d "$SERVICE_DIR" ]; then
        case "$SERVICE_NAME" in
            mattermost)
                echo "Stopping Mattermost containers..."
                cd "$SERVICE_DIR"
                docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml down || true
                if [[ "$REMOVE_VOLUMES" =~ ^[Yy]$ ]]; then
                    docker compose -f docker-compose.yml -f docker-compose.without-nginx.yml down -v || true
                    rm -rf "$SERVICE_DIR/volumes"
                fi
                ;;
            outline)
                echo "Stopping Outline containers..."
                cd "$SERVICE_DIR"
                docker compose down || true
                if [[ "$REMOVE_VOLUMES" =~ ^[Yy]$ ]]; then
                    docker compose down -v || true
                fi
                ;;
            *)
                # Generic: stop docker compose if a compose file exists
                if [ -f "$SERVICE_DIR/docker-compose.yml" ] || [ -f "$SERVICE_DIR/docker-compose.yaml" ]; then
                    echo "Stopping $SERVICE_NAME containers..."
                    cd "$SERVICE_DIR"
                    docker compose down || true
                    if [[ "$REMOVE_VOLUMES" =~ ^[Yy]$ ]]; then
                        docker compose down -v || true
                    fi
                fi
                ;;
        esac
        echo "Removing service directory $SERVICE_DIR..."
        rm -rf "$SERVICE_DIR"
    else
        echo "Service directory $SERVICE_DIR not found — skipping."
    fi

    caddy_remove_site "$SERVICE_NAME"

    echo "Service $SERVICE_NAME removed."
    echo ""
}

# ============================================
# SERVICE UNINSTALLATION
# ============================================

if [ "$MODE" = "service" ]; then
    echo "Uninstall Service: $SERVICE_NAME_ARG"
    echo "========================================"

    read -p "Remove all $SERVICE_NAME_ARG data/volumes? (y/N): " -n 1 -r
    echo
    uninstall_service "$SERVICE_NAME_ARG" "$REPLY"

    echo "========================================"
    echo "Service $SERVICE_NAME_ARG removed."
    echo "========================================"
fi

# ============================================
# ALTSUITE UNINSTALLATION
# ============================================

if [ "$MODE" = "altsuite" ]; then
    echo "AltSuite Uninstall Script"
    echo "========================================"

    INSTALL_USER="altsuite"
    INSTALL_DIR="/opt/altsuite"

    # Uninstall all installed services first
    SERVICES_BASE="/etc/altsuite"
    installed_services=()
    if [ -d "$SERVICES_BASE" ]; then
        for svc_dir in "$SERVICES_BASE"/*/; do
            # Skip if glob didn't expand (no subdirectories exist)
            [ -d "$svc_dir" ] || continue
            svc="$(basename "$svc_dir")"
            installed_services+=("$svc")
        done
    fi

    if [ ${#installed_services[@]} -gt 0 ]; then
        echo "The following services will also be removed: ${installed_services[*]}"
        read -p "Remove all service data/volumes? (y/N): " -n 1 -r REMOVE_VOLUMES
        echo
        for svc in "${installed_services[@]}"; do
            uninstall_service "$svc" "$REMOVE_VOLUMES"
        done
    fi

    echo "Stopping and disabling AltSuite service..."
    systemctl stop "altsuite" 2>/dev/null || true
    systemctl disable "altsuite" 2>/dev/null || true

    echo "Removing systemd service..."
    rm -f /etc/systemd/system/altsuite.service
    systemctl daemon-reload

    echo "Removing sudoers configuration..."
    rm -f /etc/sudoers.d/altsuite

    echo "Removing dashboard Caddy config..."
    caddy_remove_site "dashboard"

    if [ -f "$INSTALL_DIR/postgres/docker-compose.yml" ] && command -v docker &>/dev/null; then
        echo "Stopping user management Postgres..."
        if ! (cd "$INSTALL_DIR/postgres" && docker compose down); then
            echo "WARNING: docker compose down failed. Attempting direct container stop..."
            docker stop altsuite-postgres-postgres-1 2>/dev/null || true
            docker rm altsuite-postgres-postgres-1 2>/dev/null || true
        fi
    fi

    echo "Removing installation directory..."
    rm -rf "$INSTALL_DIR"

    read -p "Remove $INSTALL_USER user? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing $INSTALL_USER user..."
        userdel "$INSTALL_USER" 2>/dev/null || true
    else
        echo "Keeping $INSTALL_USER user."
    fi

    echo ""
    echo "========================================"
    echo "AltSuite has been uninstalled."
    echo "========================================"
fi
