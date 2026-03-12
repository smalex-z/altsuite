package main

import (
	"os"
	"testing"
)

func TestParseCaddyConfig(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		wantDom  string
		wantPort string
	}{
		{
			name: "normal block",
			content: `chat.example.com {
    reverse_proxy localhost:8065
}
`,
			wantDom:  "chat.example.com",
			wantPort: "8065",
		},
		{
			name: "with comment",
			content: `# Mattermost
meet.example.com {
    reverse_proxy localhost:8443
}
`,
			wantDom:  "meet.example.com",
			wantPort: "8443",
		},
		{
			name:     "empty",
			content:  "",
			wantDom:  "",
			wantPort: "",
		},
		{
			name: "domain only no reverse_proxy",
			content: `foo.example.com {
}
`,
			wantDom:  "foo.example.com",
			wantPort: "",
		},
		{
			name: "upstream with port only",
			content: `x {
    reverse_proxy 127.0.0.1:8890
}
`,
			wantDom:  "x",
			wantPort: "8890",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotDom, gotPort := parseCaddyConfig(tt.content)
			if gotDom != tt.wantDom || gotPort != tt.wantPort {
				t.Errorf("parseCaddyConfig() = (%q, %q), want (%q, %q)",
					gotDom, gotPort, tt.wantDom, tt.wantPort)
			}
		})
	}
}

func TestGetDeployDir(t *testing.T) {
	// Save and restore env so we don't affect other tests
	save := os.Getenv("ALTSUITE_DEPLOY_DIR")
	defer func() {
		if save == "" {
			_ = os.Unsetenv("ALTSUITE_DEPLOY_DIR")
		} else {
			_ = os.Setenv("ALTSUITE_DEPLOY_DIR", save)
		}
	}()

	// Default when unset
	_ = os.Unsetenv("ALTSUITE_DEPLOY_DIR")
	if got := getDeployDir(); got != defaultDeployDir {
		t.Errorf("getDeployDir() with unset env = %q, want %q", got, defaultDeployDir)
	}

	// Custom dir
	_ = os.Setenv("ALTSUITE_DEPLOY_DIR", "/home/user/altsuite/deploy")
	if got := getDeployDir(); got != "/home/user/altsuite/deploy" {
		t.Errorf("getDeployDir() = %q, want /home/user/altsuite/deploy", got)
	}

	// Trailing slash is trimmed
	_ = os.Setenv("ALTSUITE_DEPLOY_DIR", "/home/user/altsuite/deploy/")
	if got := getDeployDir(); got != "/home/user/altsuite/deploy" {
		t.Errorf("getDeployDir() with trailing slash = %q, want /home/user/altsuite/deploy", got)
	}
}
