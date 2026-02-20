"use client";

import { useState } from "react";
import {
  Play,
  Square,
  Trash2,
  Settings,
  ExternalLink,
  FileText,
  RotateCcw,
} from "lucide-react";

interface AppData {
  id: string;
  name: string;
  status: "running" | "stopped";
  version: string;
  replaces: string;
  monthlySavings: number;
  users: number;
  uptime: string;
  memoryUsage: string;
  cpuUsage: string;
  appUrl?: string;
}

const MOCK_APPS: AppData[] = [
  {
    id: "1",
    name: "Mattermost",
    status: "running",
    version: "7.8.0",
    replaces: "Slack Enterprise",
    monthlySavings: 840,
    users: 42,
    uptime: "15d 8h",
    memoryUsage: "2.4 GB",
    cpuUsage: "12%",
    appUrl: "https://chat.example.com",
  },
  {
    id: "2",
    name: "GitLab",
    status: "running",
    version: "16.7.2",
    replaces: "GitHub Enterprise",
    monthlySavings: 1050,
    users: 28,
    uptime: "23d 14h",
    memoryUsage: "4.8 GB",
    cpuUsage: "18%",
    appUrl: "https://git.example.com",
  },
  {
    id: "3",
    name: "AppFlowy",
    status: "running",
    version: "0.4.5",
    replaces: "Notion Business",
    monthlySavings: 600,
    users: 15,
    uptime: "8d 3h",
    memoryUsage: "1.2 GB",
    cpuUsage: "8%",
    appUrl: "https://appflowy.example.com",
  },
  {
    id: "4",
    name: "Jitsi Meet",
    status: "running",
    version: "2.0.9220",
    replaces: "Zoom Business",
    monthlySavings: 552,
    users: 8,
    uptime: "12d 19h",
    memoryUsage: "1.8 GB",
    cpuUsage: "15%",
    appUrl: "https://meet.example.com",
  },
];

const MOCK_LOGS =
  "2024-02-20 10:33:14 [INFO] Mattermost service started\n2024-02-20 10:33:15 [INFO] Listening on 0.0.0.0:8065\n2024-02-20 10:33:16 [INFO] Database connection pool ready\n2024-02-20 10:33:17 [INFO] WebSocket server listening\n";

export default function InstalledAppsPage() {
  const [apps, setApps] = useState<AppData[]>(MOCK_APPS);
  const [logViewerApp, setLogViewerApp] = useState<string | null>(null);
  const [configApp, setConfigApp] = useState<string | null>(null);

  const toggleAppStatus = (id: string) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === id
          ? {
              ...app,
              status:
                app.status === "running" ? ("stopped" as const) : ("running" as const),
            }
          : app
      )
    );
  };

  const handleRestart = (id: string) => {
    // Placeholder: will call API when ready
    const app = apps.find((a) => a.id === id);
    if (app) setLogViewerApp(app.name);
  };

  const handleUninstall = (id: string) => {
    if (confirm("Are you sure you want to uninstall this application?")) {
      setApps((prev) => prev.filter((app) => app.id !== id));
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Installed Applications
        </h1>
        <p className="text-gray-600">
          Manage and monitor your self-hosted applications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Applications</p>
          <p className="text-3xl font-bold text-gray-900">{apps.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Running Services</p>
          <p className="text-3xl font-bold text-green-600">
            {apps.filter((a) => a.status === "running").length}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {apps.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">{app.name}</h3>
                  <span
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                      app.status === "running"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        app.status === "running"
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    {app.status === "running" ? "Running" : "Stopped"}
                  </span>
                  <span className="text-sm text-gray-500">v{app.version}</span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Replaces:{" "}
                  <span className="font-medium text-gray-900">
                    {app.replaces}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleAppStatus(app.id)}
                  className={`p-2 rounded-lg border transition-colors ${
                    app.status === "running"
                      ? "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100"
                      : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100"
                  }`}
                  title={app.status === "running" ? "Stop" : "Start"}
                >
                  {app.status === "running" ? (
                    <Square className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() =>
                    setLogViewerApp(logViewerApp === app.name ? null : app.name)
                  }
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  title="View logs"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                    setConfigApp(configApp === app.name ? null : app.name)
                  }
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Configuration"
                >
                  <Settings className="w-5 h-5" />
                </button>
                {app.appUrl && (
                  <a
                    href={app.appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Open application"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
                <button
                  onClick={() => handleRestart(app.id)}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Restart"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleUninstall(app.id)}
                  className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  title="Uninstall"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {logViewerApp === app.name && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Log viewer — {app.name} (demo)
                </h4>
                <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                  {MOCK_LOGS}
                </pre>
                <p className="text-xs text-gray-500 mt-2">
                  Backend log streaming will be wired here when ready.
                </p>
              </div>
            )}

            {configApp === app.name && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Configuration — {app.name} (demo)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Port:</span> 8065
                  </div>
                  <div>
                    <span className="text-gray-500">Domain:</span>{" "}
                    chat.example.com
                  </div>
                  <p className="text-xs text-gray-500 col-span-full">
                    Configuration review/edit will be wired to API when ready.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">Active Users</p>
                <p className="font-semibold text-gray-900">{app.users}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Uptime</p>
                <p className="font-semibold text-gray-900">{app.uptime}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Memory</p>
                <p className="font-semibold text-gray-900">{app.memoryUsage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">CPU Usage</p>
                <p className="font-semibold text-gray-900">{app.cpuUsage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="font-semibold text-gray-900">
                  {app.status === "running" ? "Healthy" : "Inactive"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {apps.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">No applications installed yet.</p>
          <a
            href="/catalog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse App Catalog
          </a>
        </div>
      )}
    </div>
  );
}
