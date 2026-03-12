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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Fetch all catalog apps from the Go API
export async function getCatalogApps(): Promise<CatalogApp[]> {
  const res = await fetch(`${API_BASE_URL}/api/packages`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch catalog apps');
  const data = await res.json();
  // If the response is { packages: CatalogApp[], count: number }, extract .packages
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.packages)) return data.packages;
  return [];
}
export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  const res = await fetch(`${API_BASE_URL}/api/health`, { credentials: 'include' });
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function getServiceStatus(serviceName: string) {
  const res = await fetch(`${API_BASE_URL}/api/services/${serviceName}/status`, { credentials: 'include' });
  if (!res.ok) throw new Error('Service status failed');
  return res.json();
}

export async function serviceAction(serviceName: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') {
  const res = await fetch(`${API_BASE_URL}/api/services/action`, {
    method: 'POST',
    credentials: 'include',
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
  const res = await fetch(`${API_BASE_URL}/api/metrics/current`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch current metrics');
  return res.json();
}

export async function getMetricsHistory(range: 'minute' | 'hour' | 'day' | 'week' | 'month'): Promise<{
  range: string;
  metrics: Array<{ timestamp: string; cpu: number; memory: number; network: number }>;
}> {
  const res = await fetch(`${API_BASE_URL}/api/metrics/history?range=${range}`, { credentials: 'include' });
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
  const res = await fetch(`${API_BASE_URL}/api/services/packages`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch installed packages');
  return res.json();
}

export async function installService(
  service: string,
  domain: string,
  config: Record<string, string> = {},
): Promise<{ output: string; error?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/services/install`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, domain, config }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Installation failed');
  return data;
}

export interface SetupStatus {
  configured: boolean;
  domain?: string;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await fetch(`${API_BASE_URL}/api/setup/status`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch setup status');
  return res.json();
}

export async function configureDashboard(
  domain: string,
): Promise<{ output: string; domain: string }> {
  const res = await fetch(`${API_BASE_URL}/api/setup/configure`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Configuration failed');
  return data;
}

// --- User management types ---

export interface User {
  id: number;
  username: string;
  created_at: string;
}

// --- Auth ---

export interface AuthStatus {
  authenticated: boolean;
  hasUsers: boolean;
  userMgmtConfigured: boolean;
  setupComplete: boolean;
  domain?: string;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE_URL}/api/auth/status`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch auth status');
  return res.json();
}

export async function login(username: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) throw new Error('Invalid username or password');
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function setupFirstUser(username: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/auth/setup`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  if (res.status === 400) throw new Error('Setup already complete');
  if (!res.ok) throw new Error(text || 'Failed to create admin user');
  return JSON.parse(text) as User;
}

// --- User management ---

export async function getUsers(): Promise<{ users: User[] }> {
  const res = await fetch(`${API_BASE_URL}/api/users`, { credentials: 'include' });
  if (res.status === 503) throw new Error('User management not configured (set DATABASE_URL)');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(username: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  if (res.status === 409) throw new Error(text || 'Username already exists');
  if (!res.ok) throw new Error(text || 'Failed to create user');
  return JSON.parse(text) as User;
}

export async function changePassword(userId: number, password: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/users/${userId}/password`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.status === 404) throw new Error('User not found');
  if (res.status === 503) throw new Error('User management not configured');
  if (!res.ok) throw new Error('Failed to change password');
}
