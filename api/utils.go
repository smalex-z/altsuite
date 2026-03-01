package main

import (
	"encoding/json"
	"os"
	"sync"
)

var metadataFilePath = "/var/lib/altsuite/installed_packages.json"
var metadataMutex sync.Mutex

type PackageMetadata struct {
	Packages []string `json:"packages"`
}

// Load package metadata from file
func LoadPackageMetadata() (*PackageMetadata, error) {
	metadataMutex.Lock()
	defer metadataMutex.Unlock()

	file, err := os.Open(metadataFilePath)
	if os.IsNotExist(err) {
		return &PackageMetadata{Packages: []string{}}, nil
	} else if err != nil {
		return nil, err
	}
	defer file.Close()

	var meta PackageMetadata
	if err := json.NewDecoder(file).Decode(&meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

// Save package metadata to file
func SavePackageMetadata(meta *PackageMetadata) error {
	metadataMutex.Lock()
	defer metadataMutex.Unlock()

	file, err := os.Create(metadataFilePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(meta)
}

// Add a package to metadata
func AddPackageToMetadata(pkg string) error {
	meta, err := LoadPackageMetadata()
	if err != nil {
		return err
	}
	for _, p := range meta.Packages {
		if p == pkg {
			return nil // already present
		}
	}
	meta.Packages = append(meta.Packages, pkg)
	return SavePackageMetadata(meta)
}

// Remove a package from metadata
func RemovePackageFromMetadata(pkg string) error {
	meta, err := LoadPackageMetadata()
	if err != nil {
		return err
	}
	newPkgs := make([]string, 0, len(meta.Packages))
	for _, p := range meta.Packages {
		if p != pkg {
			newPkgs = append(newPkgs, p)
		}
	}
	meta.Packages = newPkgs
	return SavePackageMetadata(meta)
}
