'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Square,
  Trash2,
  Settings,
  ExternalLink,
  FileText,
  RotateCcw,
} from 'lucide-react';
import {
  getCatalogApps,
  getServiceStatus,
  serviceAction,
  getServiceLogs,
  getServiceStats,
  getServiceConfig,
  uninstallService,
  CatalogApp,
  ServiceStats,
  ServiceConfig,
} from '@/lib/api';

// Map catalog app display name to backend service name (allowedServices).
const SERVICE_NAME_BY_APP: Record<string, string> = {
  Mattermost: 'mattermost',
  Outline: 'outline',
  Gitea: 'gitea',
  Penpot: 'penpot',
  JitsiMeet: 'jitsimeet',
};

function getServiceName(appName: string): string | null {
  return SERVICE_NAME_BY_APP[appName] ?? null;
}

interface AppData {
  id: string;
  name: string;
  serviceName: string | null;
  status: 'running' | 'stopped';
  version: string;
  replaces: string;
  monthlySavings: number;
  users: number;
  uptime: string;
  memoryUsage: string;
  cpuUsage: string;
  appUrl?: string;
}

function catalogToAppData(app: CatalogApp): AppData {
  return {
    id: app.id,
    name: app.name,
    serviceName: getServiceName(app.name),
    status: 'running',
    version: '—',
    replaces: app.replaces,
    monthlySavings: app.monthlySavings,
    users: 0,
    uptime: '—',
    memoryUsage: '—',
    cpuUsage: '—',
  };
}

export default function InstalledAppsPage() {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [logViewerApp, setLogViewerApp] = useState<string | null>(null);
  const [configApp, setConfigApp] = useState<string | null>(null);
  const [pendingUninstallId, setPendingUninstallId] = useState<string | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [statsByAppId, setStatsByAppId] = useState<Record<string, ServiceStats>>({});
  const [configForPanel, setConfigForPanel] = useState<ServiceConfig | null>(null);
  const [configPanelLoading, setConfigPanelLoading] = useState(false);

  const refetchStatus = async (appId: string, serviceName: string) => {
    try {
      const res = await getServiceStatus(serviceName);
      const isRunning = res.is_running === true;
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status: isRunning ? 'running' : 'stopped' } : a)));
    } catch {
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'stopped' as const } : a)));
    }
    try {
      const stats = await getServiceStats(serviceName);
      setStatsByAppId((prev) => ({ ...prev, [appId]: stats }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    async function fetchInstalled() {
      try {
        const data = await getCatalogApps();
        const installed = data.filter((app) => app.installed).map(catalogToAppData);
        setApps(installed);
        const statsMap: Record<string, ServiceStats> = {};
        await Promise.all(
          installed
            .filter((app) => app.serviceName)
            .map(async (app) => {
              try {
                const res = await getServiceStatus(app.serviceName!);
                setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: res.is_running ? 'running' : 'stopped' } : a)));
              } catch {
                setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: 'stopped' as const } : a)));
              }
              try {
                const stats = await getServiceStats(app.serviceName!);
                statsMap[app.id] = stats;
              } catch {
                // ignore
              }
            }),
        );
        setStatsByAppId(statsMap);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error fetching installed apps:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInstalled();
  }, []);

  const toggleAppStatus = async (id: string) => {
    const app = apps.find((a) => a.id === id);
    if (!app?.serviceName) return;
    setActionError(null);
    setActionInProgressId(id);
    try {
      await serviceAction(app.serviceName, app.status === 'running' ? 'stop' : 'start');
      await refetchStatus(id, app.serviceName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleRestart = async (id: string) => {
    const app = apps.find((a) => a.id === id);
    if (!app?.serviceName) return;
    setActionError(null);
    setActionInProgressId(id);
    try {
      await serviceAction(app.serviceName, 'restart');
      await refetchStatus(id, app.serviceName);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Restart failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleUninstall = (id: string) => {
    setPendingUninstallId(id);
    setActionError(null);
  };

  const confirmUninstall = async () => {
    const app = apps.find((a) => a.id === pendingUninstallId);
    if (!app) {
      setPendingUninstallId(null);
      return;
    }
    const { serviceName } = app;
    setActionError(null);
    setActionInProgressId(app.id);
    try {
      if (serviceName) {
        await uninstallService(serviceName, false);
      }
      setApps((prev) => prev.filter((a) => a.id !== pendingUninstallId));
      setPendingUninstallId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Uninstall failed');
    } finally {
      setActionInProgressId(null);
    }
  };

  const fetchLogsForApp = async (appName: string) => {
    const app = apps.find((a) => a.name === appName);
    if (!app?.serviceName) {
      setLogsContent('Logs not available for this app.');
      return;
    }
    setLogsLoading(true);
    try {
      const data = await getServiceLogs(app.serviceName, 200);
      setLogsContent(data.logs);
    } catch {
      setLogsContent('Failed to load logs.');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!logViewerApp) {
      setLogsContent('');
      return;
    }
    fetchLogsForApp(logViewerApp);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when logViewerApp changes
  }, [logViewerApp]);

  useEffect(() => {
    if (!configApp) {
      setConfigForPanel(null);
      return;
    }
    const app = apps.find((a) => a.name === configApp);
    if (!app?.serviceName) {
      setConfigForPanel(null);
      return;
    }
    setConfigPanelLoading(true);
    getServiceConfig(app.serviceName)
      .then((c) => setConfigForPanel(c))
      .catch(() => setConfigForPanel(null))
      .finally(() => setConfigPanelLoading(false));
  }, [configApp, apps]);

  if (loading) {
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
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500">Loading installed apps…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Installed Applications
        </h1>
        <p className="text-gray-600">
          Manage and monitor your self-hosted applications
        </p>
        {actionError && (
          <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-700 shrink-0"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Applications</p>
          <p className="text-3xl font-bold text-gray-900">{apps.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Running Services</p>
          <p className="text-3xl font-bold text-green-600">
            {apps.filter((a) => a.status === 'running').length}
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
                      app.status === 'running'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        app.status === 'running'
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-gray-400'
                      }`}
                    />
                    {app.status === 'running' ? 'Running' : 'Stopped'}
                  </span>
                  <span className="text-sm text-gray-500">
                    v
                    {app.version}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Replaces:
                  {' '}
                  <span className="font-medium text-gray-900">
                    {app.replaces}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleAppStatus(app.id)}
                  disabled={!app.serviceName || actionInProgressId === app.id}
                  className={`p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    app.status === 'running'
                      ? 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'
                      : 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                  title={
                    (() => {
                      if (!app.serviceName) return 'Not available for this app';
                      return app.status === 'running' ? 'Stop' : 'Start';
                    })()
                  }
                >
                  {app.status === 'running' ? (
                    <Square className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLogViewerApp(logViewerApp === app.name ? null : app.name)}
                  disabled={!app.serviceName}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={app.serviceName ? 'View logs' : 'Logs not available'}
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfigApp(configApp === app.name ? null : app.name)}
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
                  type="button"
                  onClick={() => handleRestart(app.id)}
                  disabled={!app.serviceName || actionInProgressId === app.id}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={app.serviceName ? 'Restart' : 'Not available for this app'}
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                {pendingUninstallId === app.id ? (
                  <>
                    <button
                      type="button"
                      onClick={confirmUninstall}
                      disabled={actionInProgressId === app.id}
                      className="px-3 py-1 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingUninstallId(null)}
                      disabled={actionInProgressId === app.id}
                      className="px-3 py-1 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUninstall(app.id)}
                    className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors hover:bg-red-100"
                    title="Uninstall"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {logViewerApp === app.name && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Log viewer —
                    {' '}
                    {app.name}
                  </h4>
                  <div className="flex gap-2">
                    {app.serviceName && (
                      <button
                        type="button"
                        onClick={() => fetchLogsForApp(app.name)}
                        disabled={logsLoading}
                        className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Refresh
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLogViewerApp(null)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
                {logsLoading ? (
                  <p className="text-sm text-gray-500">Loading logs…</p>
                ) : (
                  <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
                    {logsContent || 'No logs.'}
                  </pre>
                )}
              </div>
            )}

            {configApp === app.name && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Configuration —
                  {' '}
                  {app.name}
                </h4>
                {configPanelLoading ? (
                  <p className="text-sm text-gray-900">Loading…</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-900">
                    <div>
                      <span className="font-medium">Port:</span>
                      {' '}
                      {configForPanel?.port ?? '—'}
                    </div>
                    <div>
                      <span className="font-medium">Domain:</span>
                      {' '}
                      {configForPanel?.domain ?? '—'}
                    </div>
                    {configForPanel?.domain && (
                      <div className="col-span-full">
                        <a
                          href={`https://${configForPanel.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Open https://
                          {configForPanel.domain}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">Active Users</p>
                <p className="font-semibold text-gray-900">{app.users > 0 ? app.users : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Uptime</p>
                <p className="font-semibold text-gray-900">{statsByAppId[app.id]?.uptime ?? app.uptime}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Memory</p>
                <p className="font-semibold text-gray-900">{statsByAppId[app.id]?.memory_usage ?? app.memoryUsage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">CPU Usage</p>
                <p className="font-semibold text-gray-900">{statsByAppId[app.id]?.cpu_percent ?? app.cpuUsage}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <p className="font-semibold text-gray-900">
                  {app.status === 'running' ? 'Healthy' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {apps.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">No applications installed yet.</p>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse App Catalog
          </Link>
        </div>
      )}
    </div>
  );
}
