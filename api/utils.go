// Path to supported apps metadata
package main

import (
	"encoding/json"
	"os"
)

var supportedAppsFilePath = "./supported_apps.json"

type SupportedApp struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Category       string   `json:"category"`
	Replaces       string   `json:"replaces"`
	MonthlyCost    float64  `json:"monthlyCost"`
	MonthlySavings float64  `json:"monthlySavings"`
	Features       []string `json:"features"`
	Recommended    bool     `json:"recommended"`
	Installed      bool     `json:"installed"`
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

// package main

// import (
// 	"encoding/json"
// 	"os"
// 	"sync"
// )

// var metadataFilePath = "/var/lib/altsuite/installed_packages.json"
// var metadataMutex sync.Mutex

// type PackageMetadata struct {
// 	Packages []string `json:"packages"`
// }

// // Load package metadata from file
// func LoadPackageMetadata() (*PackageMetadata, error) {
// 	metadataMutex.Lock()
// 	defer metadataMutex.Unlock()

// 	file, err := os.Open(metadataFilePath)
// 	if os.IsNotExist(err) {
// 		return &PackageMetadata{Packages: []string{}}, nil
// 	} else if err != nil {
// 		return nil, err
// 	}
// 	defer file.Close()

// 	var meta PackageMetadata
// 	if err := json.NewDecoder(file).Decode(&meta); err != nil {
// 		return nil, err
// 	}
// 	return &meta, nil
// }

// // Save package metadata to file
// func SavePackageMetadata(meta *PackageMetadata) error {
// 	metadataMutex.Lock()
// 	defer metadataMutex.Unlock()

// 	file, err := os.Create(metadataFilePath)
// 	if err != nil {
// 		return err
// 	}
// 	defer file.Close()

// 	encoder := json.NewEncoder(file)
// 	encoder.SetIndent("", "  ")
// 	return encoder.Encode(meta)
// }

// // Add a package to metadata
// func AddPackageToMetadata(pkg string) error {
// 	meta, err := LoadPackageMetadata()
// 	if err != nil {
// 		return err
// 	}
// 	for _, p := range meta.Packages {
// 		if p == pkg {
// 			return nil // already present
// 		}
// 	}
// 	meta.Packages = append(meta.Packages, pkg)
// 	return SavePackageMetadata(meta)
// }

// // Remove a package from metadata
// func RemovePackageFromMetadata(pkg string) error {
// 	meta, err := LoadPackageMetadata()
// 	if err != nil {
// 		return err
// 	}
// 	newPkgs := make([]string, 0, len(meta.Packages))
// 	for _, p := range meta.Packages {
// 		if p != pkg {
// 			newPkgs = append(newPkgs, p)
// 		}
// 	}
// 	meta.Packages = newPkgs
// 	return SavePackageMetadata(meta)
// }
