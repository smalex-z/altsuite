/*
	Contains logic for handling different os commands
	Central os object that gets created. The os object then has access to template os functions

	When a user logs in --> can have the user's os verified
	The os object can be used in the backend and can be used to run commands on the user's machine
*/

package main

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// PackageManager defines the interface for package management operations
type PackageManager interface {
	Install(pkgs ...string) (string, error)
	Remove(pkgs ...string) (string, error)
	Update() (string, error)
	ListPackages() ([]string, error)
}

// Linux (APT) implementation
type AptManager struct{}

// List installed packages for Linux (apt)
func (a *AptManager) ListPackages() ([]string, error) {
	cmd := exec.Command("dpkg", "-l")
	packageMeta, err := LoadPackageMetadata()
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to list packages: %w", err)
	}
	// Create a set for fast lookup
	tracked := make(map[string]struct{})
	for _, pkg := range packageMeta.Packages {
		tracked[pkg] = struct{}{}
	}
	lines := strings.Split(string(output), "\n")
	var packages []string
	for _, line := range lines {
		if strings.HasPrefix(line, "ii") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				pkgName := fields[1]
				if _, ok := tracked[pkgName]; ok {
					packages = append(packages, pkgName)
				}
			}
		}
	}
	return packages, nil
}

func (a *AptManager) Install(pkgs ...string) (string, error) {
	var outputs []string
	for _, pkg := range pkgs {
		args := append([]string{"apt-get", "install", "-y"}, pkg)
		cmd := exec.Command("sudo", args...)
		output, err := cmd.CombinedOutput()
		outputs = append(outputs, string(output))
		if err != nil {
			return strings.Join(outputs, "\n"), fmt.Errorf("apt-get install failed for package %s: %w - %s", pkg, err, string(output))
		}
		AddPackageToMetadata(pkg)
	}
	return strings.Join(outputs, "\n"), nil
}

func (a *AptManager) Remove(pkgs ...string) (string, error) {
	var outputs []string
	for _, pkg := range pkgs {
		args := append([]string{"apt-get", "remove", "-y"}, pkg)
		cmd := exec.Command("sudo", args...)
		output, err := cmd.CombinedOutput()
		outputs = append(outputs, string(output))
		if err != nil {
			return strings.Join(outputs, "\n"), fmt.Errorf("apt-get remove failed for package %s: %w - %s", pkg, err, string(output))
		}
		RemovePackageFromMetadata(pkg)
	}
	return strings.Join(outputs, "\n"), nil
}

func (a *AptManager) Update() (string, error) {
	// For apt, update does not take packages, just updates all
	cmd := exec.Command("sudo", "apt-get", "update")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("apt-get update failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

// Mac (Homebrew) implementation
type BrewManager struct{}

// List installed packages for macOS (brew)
func (b *BrewManager) ListPackages() ([]string, error) {
	cmd := exec.Command("brew", "list", "--casks")
	packageMeta, err := LoadPackageMetadata()
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to list brew packages: %w - %s", err, string(output))
	}
	tracked := make(map[string]struct{})
	for _, pkg := range packageMeta.Packages {
		tracked[pkg] = struct{}{}
	}
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var filtered []string
	for _, pkg := range lines {
		if _, ok := tracked[pkg]; ok {
			filtered = append(filtered, pkg)
		}
	}
	return filtered, nil
}

func (b *BrewManager) Install(pkgs ...string) (string, error) {
	var outputs []string
	for _, pkg := range pkgs {
		args := []string{"brew", "install", pkg}
		cmd := exec.Command(args[0], args[1:]...)
		output, err := cmd.CombinedOutput()
		outputs = append(outputs, string(output))
		if err != nil {
			return strings.Join(outputs, "\n"), fmt.Errorf("brew install failed for package %s: %w - %s", pkg, err, string(output))
		}
		AddPackageToMetadata(pkg)
	}
	return strings.Join(outputs, "\n"), nil
}

func (b *BrewManager) Remove(pkgs ...string) (string, error) {
	var outputs []string
	for _, pkg := range pkgs {
		args := []string{"brew", "uninstall", pkg}
		cmd := exec.Command(args[0], args[1:]...)
		output, err := cmd.CombinedOutput()
		outputs = append(outputs, string(output))
		if err != nil {
			return strings.Join(outputs, "\n"), fmt.Errorf("brew uninstall failed for package %s: %w - %s", pkg, err, string(output))
		}
		RemovePackageFromMetadata(pkg)
	}
	return strings.Join(outputs, "\n"), nil
}

func (b *BrewManager) Update() (string, error) {
	// For brew, update does not take packages, just updates all
	cmd := exec.Command("brew", "update")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("brew update failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

// Factory function to get the correct package manager for the OS
func GetPackageManager(osName string) PackageManager {
	switch osName {
	case "linux":
		return &AptManager{}
	case "darwin":
		return &BrewManager{}
	default:
		return nil
	}
}

func detectOS() string {
	return runtime.GOOS
}
