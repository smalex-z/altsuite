// Path to supported apps metadata
package main

import (
	"encoding/json"
	"os"
)

var supportedAppsFilePath = "./supported_apps.json"

type Spec struct {
	CPU     string `json:"cpu"`
	Memory  string `json:"memory"`
	Network string `json:"network"`
}

type SupportedApp struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Category       string   `json:"category"`
	Replaces       string   `json:"replaces"`
	MonthlySavings float64  `json:"monthlySavings"`
	Features       []string `json:"features"`
	Installed      bool     `json:"installed"`
	RequiredSpecs  Spec     `json:"requiredSpecs"`
}

// Load supported apps from JSON
func LoadSupportedApps() ([]SupportedApp, error) {
	file, err := os.Open(supportedAppsFilePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	var apps []SupportedApp
	if err := json.NewDecoder(file).Decode(&apps); err != nil {
		return nil, err
	}
	return apps, nil
}

// Save supported apps to JSON
func SaveSupportedApps(apps []SupportedApp) error {
	file, err := os.Open(supportedAppsFilePath)
	if err != nil {
		return err
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(apps)
}

// SetInstalledState updates the installed state for a supported app by name
func SetInstalledState(appName string, installed bool) error {
	apps, err := LoadSupportedApps()
	if err != nil {
		return err
	}
	found := false
	for i, app := range apps {
		if app.Name == appName {
			apps[i].Installed = installed
			found = true
			break
		}
	}
	if !found {
		return &AppNotSupportedError{AppName: appName}
	}
	return SaveSupportedApps(apps)
}

// AppNotSupportedError is returned if an app is not in supported_apps.json
type AppNotSupportedError struct {
	AppName string
}

func (e *AppNotSupportedError) Error() string {
	return "application '" + e.AppName + "' is not supported"
}
