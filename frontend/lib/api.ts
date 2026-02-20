/**
 * API client placeholder for AltSuite backend.
 * Replace these with real fetch/axios calls when the API is ready.
 * Base URL can be set via NEXT_PUBLIC_API_URL (e.g. http://localhost:8080).
 */

const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL ?? "") : "";

export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  if (!API_BASE) return { status: "ok", timestamp: new Date().toISOString() };
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function getServiceStatus(serviceName: string) {
  if (!API_BASE) return { service_name: serviceName, is_running: true, output: "" };
  const res = await fetch(`${API_BASE}/api/services/${serviceName}/status`);
  if (!res.ok) throw new Error("Service status failed");
  return res.json();
}

export async function serviceAction(serviceName: string, action: "start" | "stop" | "restart" | "enable" | "disable") {
  if (!API_BASE) return { success: true };
  const res = await fetch(`${API_BASE}/api/services/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_name: serviceName, action }),
  });
  if (!res.ok) throw new Error("Service action failed");
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
  if (!API_BASE) {
    return {
      timestamp: new Date().toISOString(),
      cpu: Math.random() * 50 + 20,
      memory: Math.random() * 30 + 40,
      network: Math.random() * 20 + 5,
      disk: Math.random() * 20 + 30,
    };
  }
  const res = await fetch(`${API_BASE}/api/metrics/current`);
  if (!res.ok) throw new Error("Failed to fetch current metrics");
  return res.json();
}

export async function getMetricsHistory(range: "minute" | "hour" | "day" | "week" | "month"): Promise<{
  range: string;
  metrics: Array<{ timestamp: string; cpu: number; memory: number; network: number }>;
}> {
  if (!API_BASE) {
    // Return mock data
    const now = Date.now();
    const interval = range === "minute" ? 5000 : range === "hour" ? 60000 : 300000;
    const count = range === "minute" ? 12 : range === "hour" ? 60 : 20;
    
    return {
      range,
      metrics: Array.from({ length: count }, (_, i) => ({
        timestamp: new Date(now - (count - i) * interval).toISOString(),
        cpu: Math.random() * 30 + 20,
        memory: Math.random() * 20 + 40,
        network: Math.random() * 15 + 5,
      })),
    };
  }
  
  const res = await fetch(`${API_BASE}/api/metrics/history?range=${range}`);
  if (!res.ok) throw new Error("Failed to fetch metrics history");
  return res.json();
}

// Add more API functions here as backend endpoints are ready:
// getInstalledPackages(), startInstallation(), getInstallLogs(), etc.
