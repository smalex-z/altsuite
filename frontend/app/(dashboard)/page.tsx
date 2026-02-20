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

interface SystemMetrics {
  timestamp: string;
  cpu: number;
  memory: number;
  network: number;
}

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<SystemMetrics[]>([
    { timestamp: "10:00", cpu: 25, memory: 45, network: 12 },
    { timestamp: "10:05", cpu: 32, memory: 48, network: 15 },
    { timestamp: "10:10", cpu: 28, memory: 46, network: 18 },
    { timestamp: "10:15", cpu: 35, memory: 50, network: 14 },
    { timestamp: "10:20", cpu: 30, memory: 49, network: 20 },
    { timestamp: "10:25", cpu: 38, memory: 52, network: 16 },
    { timestamp: "10:30", cpu: 33, memory: 51, network: 19 },
  ]);

  const [currentStats, setCurrentStats] = useState({
    cpu: 33,
    memory: 51,
    network: 19,
    disk: 42,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const newCpu = Math.floor(Math.random() * 20) + 25;
      const newMemory = Math.floor(Math.random() * 15) + 45;
      const newNetwork = Math.floor(Math.random() * 15) + 10;
      const now = new Date();
      const timestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;

      setMetrics((prev) => {
        const updated = [
          ...prev.slice(-6),
          { timestamp, cpu: newCpu, memory: newMemory, network: newNetwork },
        ];
        return updated;
      });

      setCurrentStats({
        cpu: newCpu,
        memory: newMemory,
        network: newNetwork,
        disk: Math.floor(Math.random() * 10) + 38,
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: "CPU Usage", value: `${currentStats.cpu}%`, icon: Cpu, color: "blue" },
    { label: "Memory", value: `${currentStats.memory}%`, icon: HardDrive, color: "purple" },
    { label: "Network", value: `${currentStats.network} MB/s`, icon: Activity, color: "green" },
    { label: "Disk Usage", value: `${currentStats.disk}%`, icon: HardDrive, color: "orange" },
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
  };

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
