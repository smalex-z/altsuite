/***************************************************************************************************

Privileged.go - Handles operations that require sudo privileges, such as managing systemd services
and apt packages. This file defines the PrivilegedOps struct and its methods for executing
privileged commands securely.

***************************************************************************************************/

package main

import (
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// Handles operations that require sudo privileges
type PrivilegedOps struct {
	// validating systemd service and package names
	validServiceName *regexp.Regexp
	validPackageName *regexp.Regexp
}

// New PrivilegedOps instance
func NewPrivilegedOps() *PrivilegedOps {
	return &PrivilegedOps{
		// Alphanumeric, hyphens, underscores, and dots only
		validServiceName: regexp.MustCompile(`^[a-zA-Z0-9\-_.@]+$`),
		validPackageName: regexp.MustCompile(`^[a-zA-Z0-9\-_.+]+$`),
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

// GetServiceStatus checks if a service is running
func (p *PrivilegedOps) GetServiceStatus(serviceName string) (bool, error) {
	output, err := p.SystemctlCommand(SystemctlStatus, serviceName)

	// systemctl status returns non-zero exit code if service is not running
	isRunning := strings.Contains(output, "Active: active (running)")

	if strings.Contains(output, "could not be found") {
		return false, fmt.Errorf("service %s not found", serviceName)
	}

	return isRunning, err
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
