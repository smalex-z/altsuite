"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Cpu, HardDrive, Activity } from "lucide-react";
import { getCurrentMetrics, getMetricsHistory } from "@/lib/api";

interface SystemMetrics {
  xAxisLabel: string;   // short label shown on x-axis
  rawTimestamp: string; // ISO string used for tooltip display
  cpu: number;
  memory: number;
  network: number;
}

type TimeRange = "minute" | "hour" | "day" | "week" | "month";

// Downsample array to max N points by taking evenly spaced samples
function downsampleToMax<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  
  const step = data.length / maxPoints;
  const result: T[] = [];
  
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.floor(i * step);
    result.push(data[index]);
  }
  
  return result;
}

// Apply moving average smoothing
function smoothData(data: SystemMetrics[], windowSize: number = 3): SystemMetrics[] {
  if (data.length < windowSize) return data;
  
  const smoothed: SystemMetrics[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
    const window = data.slice(start, end);
    
    const avg = {
      xAxisLabel: data[i].xAxisLabel,
      rawTimestamp: data[i].rawTimestamp,
      cpu: Math.max(0, window.reduce((sum, d) => sum + d.cpu, 0) / window.length),
      memory: Math.max(0, window.reduce((sum, d) => sum + d.memory, 0) / window.length),
      network: Math.max(0, window.reduce((sum, d) => sum + d.network, 0) / window.length),
    };
    
    smoothed.push(avg);
  }
  
  return smoothed;
}

// Format number to max 4 significant figures
function formatToSigFigs(value: number, sigFigs: number = 4): string {
  if (value === 0) return "0";
  
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, sigFigs - magnitude - 1);
  
  return value.toFixed(Math.min(decimals, 4));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Format ISO timestamp as "March 5, 2026 at 13:58" for tooltip display
function formatTooltipLabel(rawTimestamp: string): string {
  const date = new Date(rawTimestamp);
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${year} at ${hours}:${minutes}`;
}

// Format x-axis label based on time range
function formatXAxisLabel(date: Date, timeRange: TimeRange): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (timeRange === "minute") {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  if (timeRange === "hour") {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (timeRange === "day") {
    return `${date.getHours()}`;
  }
  // week or month: day of month
  return `${date.getDate()}`;
}

// Blank out consecutive duplicate x-axis labels so each value only appears once
function deduplicateXAxisLabels(data: SystemMetrics[]): SystemMetrics[] {
  return data.map((point, i) => {
    if (i > 0 && point.xAxisLabel === data[i - 1].xAxisLabel) {
      return { ...point, xAxisLabel: "" };
    }
    return point;
  });
}

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("hour");

  const [currentStats, setCurrentStats] = useState({
    cpu: 0,
    memory: 0,
    network: 0,
    disk: 0,
  });

  const [error, setError] = useState<string | null>(null);

  // Determine whether to show dots based on data point count
  const showDots = metrics.length <= 20;

  // Fetch current metrics
  useEffect(() => {
    const fetchCurrentMetrics = async () => {
      try {
        const data = await getCurrentMetrics();
        setCurrentStats({
          cpu: data.cpu,
          memory: data.memory,
          network: data.network,
          disk: data.disk,
        });
        setError(null);
      } catch (err) {
        console.error("Failed to fetch current metrics:", err);
        setError("Failed to fetch current metrics");
      }
    };

    fetchCurrentMetrics();
    const interval = setInterval(fetchCurrentMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch historical metrics on mount and when timeRange changes
  useEffect(() => {
    const fetchHistoricalMetrics = async () => {
      try {
        const data = await getMetricsHistory(timeRange);
        let formattedMetrics = data.metrics.map((m) => {
          const date = new Date(m.timestamp);
          return {
            xAxisLabel: formatXAxisLabel(date, timeRange),
            rawTimestamp: m.timestamp,
            cpu: m.cpu,
            memory: m.memory,
            network: m.network,
          };
        });

        // Downsample to max 24 points
        formattedMetrics = downsampleToMax(formattedMetrics, 24);

        // Apply smoothing if there are enough points (smoothing works better with more data)
        if (formattedMetrics.length >= 5) {
          const windowSize = Math.min(5, Math.ceil(formattedMetrics.length / 8));
          formattedMetrics = smoothData(formattedMetrics, windowSize);
        }

        // For day/week/month, only show the label once when the hour/day changes
        if (timeRange === "day" || timeRange === "week" || timeRange === "month") {
          formattedMetrics = deduplicateXAxisLabels(formattedMetrics);
        }

        setMetrics(formattedMetrics);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch historical metrics:", err);
        setError("Failed to fetch historical metrics");
      }
    };

    fetchHistoricalMetrics();
    const interval = setInterval(fetchHistoricalMetrics, 5000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const statCards = [
    { label: "CPU Usage", value: `${currentStats.cpu.toFixed(1)}%`, icon: Cpu, color: "blue" },
    { label: "Memory", value: `${currentStats.memory.toFixed(1)}%`, icon: HardDrive, color: "purple" },
    { label: "Network", value: `${currentStats.network.toFixed(2)} MB/s`, icon: Activity, color: "green" },
    { label: "Disk Usage", value: `${currentStats.disk.toFixed(1)}%`, icon: HardDrive, color: "orange" },
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
  };

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: "minute", label: "Last Minute" },
    { value: "hour", label: "Last Hour" },
    { value: "day", label: "Last Day" },
    { value: "week", label: "Last Week" },
    { value: "month", label: "Last Month" },
  ];

  const installedApps = [
    { name: "Mattermost", status: "running", users: 42 },
    { name: "GitLab", status: "running", users: 28 },
    { name: "AppFlowy", status: "running", users: 15 },
    { name: "Jitsi Meet", status: "running", users: 8 },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Overview</h1>
        <p className="text-gray-600">
          Real-time monitoring of your self-hosted infrastructure
        </p>
        {error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[stat.color]}`}
              >
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Time Range:</span>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            CPU &amp; Memory Usage
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="xAxisLabel" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number) => formatToSigFigs(value)}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.rawTimestamp
                    ? formatTooltipLabel(payload[0].payload.rawTimestamp)
                    : _label
                }
              />
              <Line
                type="natural"
                dataKey="cpu"
                stroke="#3b82f6"
                strokeWidth={2}
                name="CPU %"
                dot={showDots}
              />
              <Line
                type="natural"
                dataKey="memory"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Memory %"
                dot={showDots}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Network Traffic</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="xAxisLabel" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
                formatter={(value: number) => formatToSigFigs(value)}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.rawTimestamp
                    ? formatTooltipLabel(payload[0].payload.rawTimestamp)
                    : _label
                }
              />
              <Line
                type="natural"
                dataKey="network"
                stroke="#10b981"
                strokeWidth={2}
                name="Network (MB/s)"
                dot={showDots}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Active Applications</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {installedApps.map((app) => (
            <div
              key={app.name}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{app.name}</h4>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs text-green-600">Running</span>
                </span>
              </div>
              <p className="text-sm text-gray-600">{app.users} active users</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
