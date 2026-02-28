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
)

// PackageManager defines the interface for package management operations
type PackageManager interface {
	Install(pkgs ...string) (string, error)
	Remove(pkgs ...string) (string, error)
	Update() (string, error)
}

// Linux (APT) implementation
type AptManager struct{}

func (a *AptManager) Install(pkgs ...string) (string, error) {
	args := append([]string{"apt-get", "install", "-y"}, pkgs...)
	cmd := exec.Command("sudo", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("apt-get install failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

func (a *AptManager) Remove(pkgs ...string) (string, error) {
	args := append([]string{"apt-get", "remove", "-y"}, pkgs...)
	cmd := exec.Command("sudo", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("apt-get remove failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

func (a *AptManager) Update() (string, error) {
	cmd := exec.Command("sudo", "apt-get", "update")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("apt-get update failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

// Mac (Homebrew) implementation
type BrewManager struct{}

func (b *BrewManager) Install(pkgs ...string) (string, error) {
	/* note that --cask is only for GUI applications, we might want to separate out the two types of installs in the future */
	args := append([]string{"brew", "install", "--cask"}, pkgs...)
	cmd := exec.Command(args[0], args[1:]...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("brew install failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

func (b *BrewManager) Remove(pkgs ...string) (string, error) {
	args := append([]string{"brew", "uninstall"}, pkgs...)
	cmd := exec.Command(args[0], args[1:]...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("brew uninstall failed: %w - %s", err, string(output))
	}
	return string(output), nil
}

func (b *BrewManager) Update() (string, error) {
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
