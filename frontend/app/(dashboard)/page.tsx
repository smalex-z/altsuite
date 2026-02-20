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
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
}

type TimeRange = "minute" | "hour" | "day" | "week" | "month";

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
        const formattedMetrics = data.metrics.map((m) => {
          const date = new Date(m.timestamp);
          let timestamp: string;
          
          if (timeRange === "minute" || timeRange === "hour") {
            timestamp = `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
          } else if (timeRange === "day") {
            timestamp = `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
          } else {
            timestamp = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
          }

          return {
            timestamp,
            cpu: m.cpu,
            memory: m.memory,
            network: m.network,
          };
        });
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
              <XAxis dataKey="timestamp" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#3b82f6"
                strokeWidth={2}
                name="CPU %"
              />
              <Line
                type="monotone"
                dataKey="memory"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Memory %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Network Traffic</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="timestamp" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="network"
                stroke="#10b981"
                strokeWidth={2}
                name="Network (MB/s)"
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
