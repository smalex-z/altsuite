/**
 * API client placeholder for AltSuite backend.
 * Replace these with real fetch/axios calls when the API is ready.
 * Base URL can be set via NEXT_PUBLIC_API_URL (e.g. http://localhost:8080).
 */

const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL ?? "") : "http://localhost:8080";

export interface DockerContainer {
  name: string;
  status: string;
  image: string;
}

type MockAppLike = {
  name: string;
  dockerContainerName?: string;
};

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

export async function getDockerContainers(): Promise<DockerContainer[]> {
  if (!API_BASE) return [];

  const res = await fetch(`${API_BASE}/api/docker/containers`);
  if (!res.ok) throw new Error("Docker containers request failed");

  const text = await res.text();
  return parseDockerContainerList(text);
}

export function filterContainersForMockApps(
  containers: DockerContainer[],
  mockApps: MockAppLike[]
): DockerContainer[] {
  const allowedNames = new Set(
    mockApps.map((app) => (app.dockerContainerName ?? app.name).trim().toLowerCase())
  );

  return containers.filter((container) =>
    allowedNames.has(container.name.trim().toLowerCase())
  );
}

/* get docker containers */ 
export async function getMockAppDockerContainers(
  mockApps: MockAppLike[]
): Promise<DockerContainer[]> {
  const containers = await getDockerContainers();
  console.log("Fetched Docker containers:", containers);
  return filterContainersForMockApps(containers, mockApps);
}

function parseDockerContainerList(output: string): DockerContainer[] {
  if (!output.trim()) return [];

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", status = "", image = ""] = line.split("\t");
      return {
        name: name.trim(),
        status: status.trim(),
        image: image.trim(),
      };
    })
    .filter((container) => container.name.length > 0);
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

// Add more API functions here as backend endpoints are ready:
// getSystemMetrics(), getInstalledPackages(), startInstallation(), getInstallLogs(), etc.
