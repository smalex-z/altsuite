"use client";

import { useEffect, useState } from "react";
import { Download, Shield, Check } from "lucide-react";
import { getCatalogApps, CatalogApp } from "@/lib/api";
import { redirect } from "next/navigation";



export default function CatalogPage() {
  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchApps() {
      try {
        const data = await getCatalogApps();
        setApps(data);
      } catch (error) {
        console.error("Error fetching catalog apps:", error);
      }
    }
    fetchApps();
  }, []);

  // Unique categories for filter buttons
  const categories = Array.from(new Set(apps.map((app) => app.category)));

  // Filtered apps based on selected filter
  const filteredApps = filter === "all" ? apps : apps.filter((app) => app.category === filter);

  // Route to proper installer/wizard page based on appID 
  function handleInstall(id: string) {
    for (const app of apps){
      if (app.id === id){
        redirect(`/wizards/${app.name}.Install`);
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">App Catalog</h1>
        <p className="text-gray-600">
          Discover and deploy open-source alternatives to expensive SaaS products
        </p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          key="all"
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filter === "all"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              filter === category
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className={`bg-white rounded-lg border-2 p-6 transition-all ${
              app.recommended ? "border-blue-200 shadow-md" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {app.name}
                </h3>
                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {app.category}
                </span>
              </div>
              {app.installed && (
                <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full shrink-0">
                  <Check className="w-4 h-4" />
                  Installed
                </span>
              )}
            </div>

            <p className="text-gray-600 mb-4">{app.description}</p>

            <p className="text-sm text-gray-700 mb-4">
              Replaces:{" "}
              <span className="font-semibold text-gray-900">{app.replaces}</span>
            </p>


            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Key Features:
              </p>
              <ul className="space-y-1">
                {app.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm text-gray-600"
                  >
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {app.requiredSpecs && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Required Specs:
                </p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">CPU:</span> {app.requiredSpecs.cpu}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">Memory:</span> {app.requiredSpecs.memory}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">Network:</span> {app.requiredSpecs.network}
                  </li>
                </ul>
              </div>
            )}

            <button
              onClick={() => handleInstall(app.id)}
              disabled={app.installed}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                app.installed
                  ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {app.installed ? (
                <>
                  <Check className="w-5 h-5" />
                  Already Installed
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Ready to Install
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
