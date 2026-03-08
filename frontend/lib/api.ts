// CatalogApp type for API responses
export interface CatalogApp {
  id: string;
  name: string;
  description: string;
  category: string;
  replaces: string;
  monthlyCost: number;
  monthlySavings: number;
  features: string[];
  recommended: boolean;
  installed: boolean;
  requiredSpecs?: {
    cpu: string;
    memory: string;
    network: string;
  };
}

// Fetch all catalog apps from the Go API
export async function getCatalogApps(): Promise<CatalogApp[]> {
  const res = await fetch('/api/packages');
  if (!res.ok) throw new Error('Failed to fetch catalog apps');
  const data = await res.json();
  // If the response is { packages: CatalogApp[], count: number }, extract .packages
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.packages)) return data.packages;
  return [];
}
export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function getServiceStatus(serviceName: string) {
  const res = await fetch(`/api/services/${serviceName}/status`);
  if (!res.ok) throw new Error('Service status failed');
  return res.json();
}

export async function serviceAction(serviceName: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') {
  const res = await fetch('/api/services/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_name: serviceName, action }),
  });
  if (!res.ok) throw new Error('Service action failed');
  return res.json();
}

// System metrics
export interface SystemMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
  disk: number;
}

export async function getCurrentMetrics(): Promise<SystemMetric> {
  const res = await fetch('/api/metrics/current');
  if (!res.ok) throw new Error('Failed to fetch current metrics');
  return res.json();
}

export async function getMetricsHistory(range: 'minute' | 'hour' | 'day' | 'week' | 'month'): Promise<{
  range: string;
  metrics: Array<{ timestamp: string; cpu: number; memory: number; network: number }>;
}> {
  const res = await fetch(`/api/metrics/history?range=${range}`);
  if (!res.ok) throw new Error('Failed to fetch metrics history');
  return res.json();
}

/*
TODO:
- try calling the API endpoint and check what the return type looks like
- make it dynamic in the frontend so if not installed it should say not installed
- how should we store apps that are supported? JSON file?
  --> we can render supported apps from there
- should update the JSON file created when installing to just have a list
  of the catalog apps similar to how page.tsx does in catalog
*/

export async function getInstalledPackages() {
  const res = await fetch('/api/services/packages');
  if (!res.ok) throw new Error('Failed to fetch installed packages');
  return res.json();
}

// Add more API functions here as backend endpoints are ready:
// getInstalledPackages(), startInstallation(), getInstallLogs(), etc.
