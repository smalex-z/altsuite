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


/* 
TODO: 
- try calling the API endpoint and check what the return type looks like
- make it dynamic in the frontend so if not installed it should say not installed
- how should we store apps that are supported? JSON file? --> we can render supported apps from there
- should update the JSON file created when installing to just have a list of the catalog apps similar to how page.tsx does in catalog
*/

export async function getInstalledPackages(){
  if (!API_BASE) return { };
  const res = await fetch(`${API_BASE}/api/services/packages`);
}


// Add more API functions here as backend endpoints are ready:
// getSystemMetrics(), getInstalledPackages(), startInstallation(), getInstallLogs(), etc.
