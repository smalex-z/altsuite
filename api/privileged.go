/***************************************************************************************************

Privileged.go - Handles operations that require sudo privileges, such as managing systemd services
and apt packages. This file defines the PrivilegedOps struct and its methods for executing
privileged commands securely.

***************************************************************************************************/

package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Handles operations that require sudo privileges
type PrivilegedOps struct {
	// validating systemd service and package names
	validServiceName *regexp.Regexp
	validPackageName *regexp.Regexp
	validDomain      *regexp.Regexp
}

const serviceDirBase = "/etc/altsuite"
const defaultDeployDir = "/opt/altsuite/deploy"

// getDeployDir returns the deploy directory for helper scripts (rm-service-dir.sh, read-caddy-config.sh).
// Set ALTSUITE_DEPLOY_DIR to the full path to deploy/ when running from repo or if scripts are elsewhere.
func getDeployDir() string {
	if d := os.Getenv("ALTSUITE_DEPLOY_DIR"); d != "" {
		return strings.TrimSuffix(d, "/")
	}
	return defaultDeployDir
}

// allowedServices is the whitelist of services that can be installed via the API.
var allowedServices = map[string]bool{
	"mattermost": true,
	"penpot":     true,
	"gitea":      true,
	"caldotcom":  true,
	"outline":    true,
	"jitsimeet":  true,
}

// dockerComposeFiles maps service names to compose file names (relative to service dir).
// Mattermost uses two files; others use default docker-compose.yml.
var dockerComposeFiles = map[string][]string{
	"mattermost": {"docker-compose.yml", "docker-compose.without-nginx.yml"},
}

// serviceConfigKeys defines the ordered extra positional args each service script accepts beyond domain.
var serviceConfigKeys = map[string][]string{
	"mattermost": {"postgresPassword", "supportEmail"},
	"outline":    {"googleClientId", "googleClientSecret", "postgresPassword"},
}

// validConfigValue permits characters found in OAuth tokens and similar config values.
var validConfigValue = regexp.MustCompile(`^[a-zA-Z0-9\-_.@/]+$`)

// New PrivilegedOps instance
func NewPrivilegedOps() *PrivilegedOps {
	return &PrivilegedOps{
		// Alphanumeric, hyphens, underscores, and dots only
		validServiceName: regexp.MustCompile(`^[a-zA-Z0-9\-_.@]+$`),
		validPackageName: regexp.MustCompile(`^[a-zA-Z0-9\-_.+]+$`),
		// Hostnames / FQDNs: labels separated by dots, no shell metacharacters
		validDomain: regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$`),
	}
}

// ========================= Systemctl Operations =========================

// SystemctlOperation represents a systemctl command
type SystemctlOperation string

const (
	SystemctlStart   SystemctlOperation = "start"
	SystemctlStop    SystemctlOperation = "stop"
	SystemctlRestart SystemctlOperation = "restart"
	SystemctlStatus  SystemctlOperation = "status"
	SystemctlEnable  SystemctlOperation = "enable"
	SystemctlDisable SystemctlOperation = "disable"
)

// Execute systemctl command
func (p *PrivilegedOps) SystemctlCommand(operation SystemctlOperation, serviceName string) (string, error) {
	if !p.validServiceName.MatchString(serviceName) {
		return "", errors.New("invalid service name: contains forbidden characters")
	}

	// Execute command
	cmd := exec.Command("sudo", "systemctl", string(operation), serviceName)
	output, err := cmd.CombinedOutput()

	if err != nil {
		return string(output), fmt.Errorf("systemctl %s %s failed: %w - %s", operation, serviceName, err, string(output))
	}

	return string(output), nil
}

// GetServiceStatus checks if a service is running (systemd first, then Docker for allowed services).
func (p *PrivilegedOps) GetServiceStatus(serviceName string) (bool, error) {
	if !p.validServiceName.MatchString(serviceName) {
		return false, errors.New("invalid service name")
	}
	output, err := p.SystemctlCommand(SystemctlStatus, serviceName)

	if strings.Contains(output, "could not be found") {
		if allowedServices[serviceName] {
			return p.getDockerServiceStatus(serviceName)
		}
		return false, fmt.Errorf("service %s not found", serviceName)
	}

	isRunning := strings.Contains(output, "Active: active (running)")
	return isRunning, err
}

// serviceDir returns the path for a service (allowedServices names only); empty if invalid.
func (p *PrivilegedOps) serviceDir(serviceName string) string {
	if !allowedServices[serviceName] {
		return ""
	}
	return filepath.Join(serviceDirBase, serviceName)
}

// dockerComposeCommand runs docker compose in the service directory with optional -f flags.
func (p *PrivilegedOps) dockerComposeCommand(serviceName string, args ...string) (string, error) {
	dir := p.serviceDir(serviceName)
	if dir == "" {
		return "", fmt.Errorf("unsupported service: %s", serviceName)
	}
	if _, err := os.Stat(dir); err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("service directory not found: %s", dir)
		}
		return "", err
	}
	composeArgs := []string{"compose"}
	if files := dockerComposeFiles[serviceName]; len(files) > 0 {
		for _, f := range files {
			composeArgs = append(composeArgs, "-f", f)
		}
	} else {
		composeArgs = append(composeArgs, "-f", "docker-compose.yml")
	}
	composeArgs = append(composeArgs, args...)
	cmd := exec.Command("sudo", append([]string{"docker"}, composeArgs...)...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("docker compose %v: %w - %s", args, err, string(output))
	}
	return string(output), nil
}

func (p *PrivilegedOps) getDockerServiceStatus(serviceName string) (bool, error) {
	out, err := p.dockerComposeCommand(serviceName, "ps", "-q")
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(out) != "", nil
}

// ServiceStats holds optional resource usage for a service (Docker containers).
type ServiceStats struct {
	CPUPercent  string `json:"cpu_percent,omitempty"`
	MemoryUsage string `json:"memory_usage,omitempty"`
	Uptime      string `json:"uptime,omitempty"`
}

// GetServiceStats returns CPU, memory, and uptime for a Docker-based service. Returns zero value if not available.
func (p *PrivilegedOps) GetServiceStats(serviceName string) (ServiceStats, error) {
	var out ServiceStats
	if !p.validServiceName.MatchString(serviceName) {
		return out, errors.New("invalid service name")
	}
	output, _ := p.SystemctlCommand(SystemctlStatus, serviceName)
	if !strings.Contains(output, "could not be found") {
		return out, nil
	}
	if !allowedServices[serviceName] {
		return out, nil
	}
	dir := p.serviceDir(serviceName)
	if _, err := os.Stat(dir); err != nil {
		return out, nil
	}
	idsOut, err := p.dockerComposeCommand(serviceName, "ps", "-q")
	if err != nil || strings.TrimSpace(idsOut) == "" {
		return out, nil
	}
	lines := strings.Split(strings.TrimSpace(idsOut), "\n")
	var firstID string
	for _, line := range lines {
		if id := strings.TrimSpace(line); id != "" {
			firstID = id
			break
		}
	}
	if firstID == "" {
		return out, nil
	}
	cmd := exec.Command("sudo", "docker", "stats", "--no-stream", "--format", "{{.CPUPerc}}\t{{.MemUsage}}", firstID)
	cmd.Dir = dir
	statsOut, err := cmd.CombinedOutput()
	if err == nil {
		parts := strings.SplitN(strings.TrimSpace(string(statsOut)), "\t", 2)
		if len(parts) >= 1 && parts[0] != "" {
			out.CPUPercent = strings.TrimSpace(parts[0])
		}
		if len(parts) >= 2 && parts[1] != "" {
			out.MemoryUsage = strings.TrimSpace(parts[1])
		}
	}
	cmdInspect := exec.Command("sudo", "docker", "inspect", "--format", "{{.State.StartedAt}}", firstID)
	startedOut, err := cmdInspect.CombinedOutput()
	if err == nil {
		startedAt, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(string(startedOut)))
		if err == nil {
			d := time.Since(startedAt)
			out.Uptime = formatDuration(d)
		}
	}
	return out, nil
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return "< 1m"
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Round(time.Minute).Minutes()))
	}
	if d < 24*time.Hour {
		h := int(d.Hours())
		m := int(d.Round(time.Minute).Minutes()) % 60
		if m == 0 {
			return fmt.Sprintf("%dh", h)
		}
		return fmt.Sprintf("%dh %dm", h, m)
	}
	days := int(d.Hours() / 24)
	h := int(d.Hours()) % 24
	if h == 0 {
		return fmt.Sprintf("%dd", days)
	}
	return fmt.Sprintf("%dd %dh", days, h)
}

// ServiceCommand runs start/stop/restart (systemd first, then Docker for allowed services).
// enable/disable only apply to systemd; for Docker services they are no-ops with a message.
func (p *PrivilegedOps) ServiceCommand(operation SystemctlOperation, serviceName string) (string, error) {
	if !p.validServiceName.MatchString(serviceName) {
		return "", errors.New("invalid service name")
	}
	output, _ := p.SystemctlCommand(SystemctlStatus, serviceName)
	unitNotFound := strings.Contains(output, "could not be found")

	if unitNotFound && allowedServices[serviceName] {
		switch operation {
		case SystemctlStart:
			return p.dockerComposeCommand(serviceName, "up", "-d")
		case SystemctlStop:
			return p.dockerComposeCommand(serviceName, "down")
		case SystemctlRestart:
			if _, err := p.dockerComposeCommand(serviceName, "restart"); err != nil {
				return "", err
			}
			return "restarted", nil
		case SystemctlEnable, SystemctlDisable:
			return "", fmt.Errorf("enable/disable not applicable for Docker-based service %s", serviceName)
		default:
			return p.SystemctlCommand(operation, serviceName)
		}
	}
	if unitNotFound {
		return "", fmt.Errorf("service %s not found", serviceName)
	}
	return p.SystemctlCommand(operation, serviceName)
}

// GetServiceLogs returns recent logs for a service (journalctl for systemd, docker compose logs for Docker).
func (p *PrivilegedOps) GetServiceLogs(serviceName string, tail int) (string, error) {
	if !p.validServiceName.MatchString(serviceName) {
		return "", errors.New("invalid service name")
	}
	if tail <= 0 {
		tail = 200
	}
	if tail > 5000 {
		tail = 5000
	}
	output, _ := p.SystemctlCommand(SystemctlStatus, serviceName)
	if !strings.Contains(output, "could not be found") {
		cmd := exec.Command("sudo", "journalctl", "-u", serviceName, "-n", fmt.Sprintf("%d", tail), "--no-pager")
		out, err := cmd.CombinedOutput()
		if err != nil {
			return string(out), fmt.Errorf("journalctl: %w - %s", err, string(out))
		}
		return string(out), nil
	}
	if allowedServices[serviceName] {
		return p.dockerComposeCommand(serviceName, "logs", "--tail", fmt.Sprintf("%d", tail))
	}
	return "", fmt.Errorf("service %s not found", serviceName)
}

const caddyConfDir = "/etc/caddy/conf.d"

// ServiceConfig holds domain and port from Caddy reverse-proxy config.
type ServiceConfig struct {
	Domain string `json:"domain,omitempty"`
	Port   string `json:"port,omitempty"`
}

// parseCaddyConfig extracts domain and port from Caddy config content.
func parseCaddyConfig(content string) (domain, port string) {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasSuffix(line, "{") {
			domain = strings.TrimSpace(strings.TrimSuffix(line, "{"))
			continue
		}
		if strings.HasPrefix(line, "reverse_proxy") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				upstream := fields[1]
				if idx := strings.LastIndex(upstream, ":"); idx >= 0 && idx < len(upstream)-1 {
					port = upstream[idx+1:]
				}
			}
			break
		}
	}
	return domain, port
}

// GetServiceConfig reads domain and upstream port from Caddy config for a service.
func (p *PrivilegedOps) GetServiceConfig(serviceName string) (ServiceConfig, error) {
	var out ServiceConfig
	if !p.validServiceName.MatchString(serviceName) {
		return out, errors.New("invalid service name")
	}
	var content []byte
	scriptPath := filepath.Join(getDeployDir(), "read-caddy-config.sh")
	if _, err := os.Stat(scriptPath); err == nil {
		cmd := exec.Command("sudo", scriptPath, serviceName)
		content, _ = cmd.CombinedOutput()
	}
	if len(content) == 0 {
		confFile := filepath.Join(caddyConfDir, serviceName+".caddy")
		content, _ = os.ReadFile(confFile)
	}
	if len(content) == 0 {
		return out, nil
	}
	out.Domain, out.Port = parseCaddyConfig(string(content))
	return out, nil
}

// UninstallService stops and removes a service (systemd or Docker), removes Caddy config, and deletes the service dir.
func (p *PrivilegedOps) UninstallService(serviceName string, removeVolumes bool) error {
	if !p.validServiceName.MatchString(serviceName) {
		return errors.New("invalid service name")
	}
	if !allowedServices[serviceName] {
		return fmt.Errorf("unsupported service: %s", serviceName)
	}
	// Stop systemd unit if present
	_, _ = p.SystemctlCommand(SystemctlStop, serviceName)
	_, _ = p.SystemctlCommand(SystemctlDisable, serviceName)

	dir := p.serviceDir(serviceName)
	if _, err := os.Stat(dir); err == nil {
		args := []string{"down"}
		if removeVolumes {
			args = append(args, "-v")
		}
		_, _ = p.dockerComposeCommand(serviceName, args...)
		// Use NOPASSWD script so we don't require a password (sudoers allows rm-service-dir.sh)
		scriptPath := filepath.Join(getDeployDir(), "rm-service-dir.sh")
		if _, err := os.Stat(scriptPath); err != nil {
			return fmt.Errorf("remove service dir: script not found at %s (set ALTSUITE_DEPLOY_DIR or copy deploy scripts to /opt/altsuite/deploy)", scriptPath)
		}
		cmd := exec.Command("sudo", scriptPath, serviceName)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("remove service dir: %w - %s", err, string(out))
		}
	}

	confFile := filepath.Join(caddyConfDir, serviceName+".caddy")
	if _, err := os.Stat(confFile); err == nil {
		_ = os.Remove(confFile)
		_, _ = exec.Command("sudo", "systemctl", "reload", "caddy").CombinedOutput()
	}

	return SetInstalledStateByServiceName(serviceName, false)
}

// ========================= Package Operations =========================

// PackageOperation represents a package manager command
type PackageOperation string

const (
	PackageUpdate  PackageOperation = "update"
	PackageInstall PackageOperation = "install"
	PackageRemove  PackageOperation = "remove"
	PackageUpgrade PackageOperation = "upgrade"
)

// Generalized package manager command for Linux (apt) and Mac (brew)
func (p *PrivilegedOps) PackageCommand(operation PackageOperation, packages ...string) (string, error) {
	for _, pkg := range packages {
		if !p.validPackageName.MatchString(pkg) {
			return "", fmt.Errorf("invalid package name: %s", pkg)
		}
	}

	packageManager := GetPackageManager(detectOS())

	switch operation {
	case PackageUpdate:
		return packageManager.Update()
	case PackageInstall:
		return packageManager.Install(packages...)
	case PackageRemove:
		return packageManager.Remove(packages...)
	default:
		return "", fmt.Errorf("invalid package operation: %s", operation)
	}
}

// Returns a list of installed packages
func (p *PrivilegedOps) ListInstalledPackages() ([]SupportedApp, error) {
	packageManager := GetPackageManager(detectOS())

	packages, err := packageManager.ListPackages()
	if err != nil {
		return nil, err
	}
	return packages, nil
}

// GetPackageInfo returns information about an installed package
func (p *PrivilegedOps) GetPackageInfo(packageName string) (string, error) {
	if !p.validPackageName.MatchString(packageName) {
		return "", fmt.Errorf("invalid package name: %s", packageName)
	}

	cmd := exec.Command("dpkg", "-s", packageName)
	output, err := cmd.CombinedOutput()

	if err != nil {
		return string(output), fmt.Errorf("package %s not found: %w", packageName, err)
	}

	return string(output), nil
}

// ========================= Service Installation =========================

// InstallService runs the deploy/install.sh script for a named service.
// Both serviceName and domain are strictly validated before being passed
// to the shell to prevent command injection.
func (p *PrivilegedOps) InstallService(serviceName, domain string, config map[string]string) (string, error) {
	if !allowedServices[serviceName] {
		return "", fmt.Errorf("unsupported service: %s", serviceName)
	}
	if !p.validDomain.MatchString(domain) {
		return "", errors.New("invalid domain: must be a valid hostname or FQDN")
	}
	args := []string{"/opt/altsuite/deploy/install.sh", serviceName, domain}
	for _, key := range serviceConfigKeys[serviceName] {
		val := config[key]
		if val != "" && !validConfigValue.MatchString(val) {
			return "", fmt.Errorf("invalid value for config key %q", key)
		}
		args = append(args, val)
	}
	cmd := exec.Command("sudo", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("service install failed: %w\n%s", err, string(output))
	}
	return string(output), nil
}

// ========================= Dashboard Setup =========================

// SetupStatus reports whether the dashboard domain has been configured.
type SetupStatus struct {
	Configured bool   `json:"configured"`
	Domain     string `json:"domain,omitempty"`
}

// GetSetupStatus checks whether /etc/caddy/conf.d/dashboard.caddy exists and
// returns the configured domain if it does.
func (p *PrivilegedOps) GetSetupStatus() SetupStatus {
	const confFile = "/etc/caddy/conf.d/dashboard.caddy"
	content, err := os.ReadFile(confFile)
	if err != nil {
		return SetupStatus{Configured: false}
	}
	// The first non-blank, non-comment line is `<domain> {` — extract the domain.
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) > 0 {
			return SetupStatus{Configured: true, Domain: fields[0]}
		}
		break
	}
	return SetupStatus{Configured: true}
}

// ConfigureDashboard writes the Caddy reverse-proxy config for the dashboard
// domain and reloads Caddy.
func (p *PrivilegedOps) ConfigureDashboard(domain string) (string, error) {
	if !p.validDomain.MatchString(domain) {
		return "", errors.New("invalid domain: must be a valid hostname or FQDN")
	}
	cmd := exec.Command("sudo", "/opt/altsuite/deploy/configure-dashboard.sh", domain)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("configure dashboard failed: %w\n%s", err, string(out))
	}
	return string(out), nil
}

// ========================= Docker Operations =========================

// DockerCommand executes a docker command with sudo
func (p *PrivilegedOps) DockerCommand(args ...string) (string, error) {
	for _, arg := range args {
		if strings.Contains(arg, ";") || strings.Contains(arg, "|") || strings.Contains(arg, "&") {
			return "", errors.New("invalid characters in docker command")
		}
	}

	cmdArgs := append([]string{"docker"}, args...)
	cmd := exec.Command("sudo", cmdArgs...)
	output, err := cmd.CombinedOutput()

	if err != nil {
		return string(output), fmt.Errorf("docker command failed: %w - %s", err, string(output))
	}

	return string(output), nil
}

// ListDockerContainers returns a list of running Docker containers
func (p *PrivilegedOps) ListDockerContainers() (string, error) {
	return p.DockerCommand("ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Image}}")
}
