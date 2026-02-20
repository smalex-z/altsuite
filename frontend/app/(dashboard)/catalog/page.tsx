"use client";

import { useState } from "react";
import { Download, Shield, Check } from "lucide-react";

interface CatalogApp {
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
}

const MOCK_CATALOG: CatalogApp[] = [
  {
    id: "1",
    name: "Mattermost",
    description:
      "Open-source team collaboration and messaging platform with channels, direct messages, and file sharing.",
    category: "Communication",
    replaces: "Slack Enterprise",
    monthlyCost: 12.5,
    monthlySavings: 840,
    features: [
      "Unlimited message history",
      "File sharing",
      "Video calls",
      "Integrations",
      "Mobile apps",
    ],
    recommended: true,
    installed: true,
  },
  {
    id: "2",
    name: "GitLab",
    description:
      "Complete DevOps platform with Git repository management, CI/CD pipelines, and issue tracking.",
    category: "Development",
    replaces: "GitHub Enterprise",
    monthlyCost: 0,
    monthlySavings: 1050,
    features: [
      "Git repositories",
      "CI/CD pipelines",
      "Issue tracking",
      "Code review",
      "Container registry",
    ],
    recommended: true,
    installed: true,
  },
  {
    id: "3",
    name: "AppFlowy",
    description:
      "Privacy-first alternative to Notion for notes, wikis, and project management.",
    category: "Productivity",
    replaces: "Notion Business",
    monthlyCost: 0,
    monthlySavings: 600,
    features: [
      "Rich text editor",
      "Database views",
      "Kanban boards",
      "Calendar",
      "Real-time collaboration",
    ],
    recommended: true,
    installed: true,
  },
  {
    id: "4",
    name: "Jitsi Meet",
    description:
      "Secure and feature-rich video conferencing solution with screen sharing and recording.",
    category: "Communication",
    replaces: "Zoom Business",
    monthlyCost: 0,
    monthlySavings: 552,
    features: [
      "HD video/audio",
      "Screen sharing",
      "Recording",
      "No account required",
      "End-to-end encryption",
    ],
    recommended: true,
    installed: true,
  },
  {
    id: "5",
    name: "Nextcloud",
    description:
      "Self-hosted file sync and share platform with office suite and collaboration tools.",
    category: "Storage",
    replaces: "Dropbox Business",
    monthlyCost: 0,
    monthlySavings: 720,
    features: [
      "File sync & share",
      "Online office",
      "Calendar & contacts",
      "End-to-end encryption",
      "Mobile apps",
    ],
    recommended: false,
    installed: false,
  },
  {
    id: "6",
    name: "Rocket.Chat",
    description:
      "Customizable team communication platform with omnichannel capabilities.",
    category: "Communication",
    replaces: "Slack Business",
    monthlyCost: 0,
    monthlySavings: 540,
    features: [
      "Real-time chat",
      "Video conferencing",
      "Omnichannel",
      "Custom integrations",
      "Mobile apps",
    ],
    recommended: false,
    installed: false,
  },
  {
    id: "7",
    name: "Taiga",
    description:
      "Project management platform for agile teams with scrum and kanban support.",
    category: "Project Management",
    replaces: "Jira Software",
    monthlyCost: 0,
    monthlySavings: 630,
    features: [
      "Scrum & Kanban",
      "Sprint planning",
      "Backlog management",
      "Issue tracking",
      "Wikis",
    ],
    recommended: false,
    installed: false,
  },
  {
    id: "8",
    name: "Matomo",
    description:
      "Privacy-focused web analytics platform that respects user privacy.",
    category: "Analytics",
    replaces: "Google Analytics 360",
    monthlyCost: 0,
    monthlySavings: 1250,
    features: [
      "Real-time analytics",
      "GDPR compliant",
      "Custom reports",
      "Heatmaps",
      "A/B testing",
    ],
    recommended: false,
    installed: false,
  },
];

export default function CatalogPage() {
  const [apps, setApps] = useState<CatalogApp[]>(MOCK_CATALOG);
  const [filter, setFilter] = useState<string>("all");
  const categories = [
    "all",
    ...Array.from(new Set(apps.map((app) => app.category))),
  ];

  const filteredApps =
    filter === "all" ? apps : apps.filter((app) => app.category === filter);

  const handleInstall = (id: string) => {
    setApps((prev) =>
      prev.map((app) => (app.id === id ? { ...app, installed: true } : app))
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">App Catalog</h1>
        <p className="text-gray-600">
          Discover and deploy open-source alternatives to expensive SaaS
          products
        </p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
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
            {app.recommended && (
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-4">
                <Shield className="w-3 h-3" />
                Recommended
              </div>
            )}

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
