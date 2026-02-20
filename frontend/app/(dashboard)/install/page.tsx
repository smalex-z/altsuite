"use client";

import { useState, useEffect } from "react";
import { Check, ChevronRight, Loader2, GitBranch, Settings, Box, Play } from "lucide-react";

const STEPS = [
  { id: 1, label: "Select services", icon: Check },
  { id: 2, label: "Configure", icon: Settings },
  { id: 3, label: "Install", icon: Loader2 },
];

const AVAILABLE_SERVICES = [
  { id: "nextcloud", name: "Nextcloud", category: "Storage" },
  { id: "rocketchat", name: "Rocket.Chat", category: "Communication" },
  { id: "taiga", name: "Taiga", category: "Project Management" },
  { id: "matomo", name: "Matomo", category: "Analytics" },
];

const INSTALL_STAGES = [
  { id: "cloning", label: "Cloning repositories", icon: GitBranch },
  { id: "configuring", label: "Configuring services", icon: Settings },
  { id: "building", label: "Building containers", icon: Box },
  { id: "starting", label: "Starting services", icon: Play },
];

const MOCK_LOG_LINES = [
  "[INFO] Starting installation for Nextcloud, Rocket.Chat",
  "[INFO] Cloning Nextcloud repository...",
  "[OK] Nextcloud cloned successfully",
  "[INFO] Cloning Rocket.Chat repository...",
  "[OK] Rocket.Chat cloned successfully",
  "[INFO] Generating configuration files...",
  "[OK] Configuration written to /opt/altsuite/nextcloud",
  "[OK] Configuration written to /opt/altsuite/rocketchat",
  "[INFO] Building Docker images...",
  "[OK] nextcloud:latest built",
  "[OK] rocketchat:latest built",
  "[INFO] Starting containers...",
  "[OK] Nextcloud is running on https://nextcloud.example.com",
  "[OK] Rocket.Chat is running on https://chat.example.com",
  "[DONE] Installation completed successfully.",
];

export default function InstallWizardPage() {
  const [step, setStep] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [config, setConfig] = useState<Record<string, { port: string; domain: string }>>({});
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);

  const toggleService = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setConfigErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const updateConfig = (id: string, field: "port" | "domain", value: string) => {
    setConfig((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { port: "", domain: "" }), [field]: value },
    }));
    setConfigErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const validateConfig = (): boolean => {
    const errors: Record<string, string> = {};
    selectedIds.forEach((id) => {
      const c = config[id];
      const port = c?.port?.trim() ?? "";
      const domain = c?.domain?.trim() ?? "";
      if (!port) errors[id] = "Port is required";
      else if (!/^\d+$/.test(port) || parseInt(port, 10) > 65535)
        errors[id] = "Invalid port (1-65535)";
      if (!domain) errors[id] = (errors[id] ? errors[id] + "; " : "") + "Domain is required";
    });
    setConfigErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (selectedIds.length === 0) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateConfig()) return;
      setStep(3);
      startInstall();
    }
  };

  const startInstall = () => {
    setInstalling(true);
    setLogs([]);
    setCurrentStage(0);
  };

  useEffect(() => {
    if (!installing || step !== 3) return;
    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < MOCK_LOG_LINES.length) {
        setLogs((prev) => [...prev, MOCK_LOG_LINES[logIndex]]);
        if (MOCK_LOG_LINES[logIndex].startsWith("[INFO] Building"))
          setCurrentStage(2);
        else if (MOCK_LOG_LINES[logIndex].startsWith("[INFO] Starting containers"))
          setCurrentStage(3);
        else if (MOCK_LOG_LINES[logIndex].startsWith("[DONE]")) {
          setCurrentStage(4);
          setComplete(true);
          setInstalling(false);
        }
        logIndex++;
      }
    }, 600);
    return () => clearInterval(interval);
  }, [installing, step]);

  const canNext =
    (step === 1 && selectedIds.length > 0) ||
    (step === 2 && selectedIds.length > 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Installation Wizard
        </h1>
        <p className="text-gray-600">
          Select services, configure options, and deploy. Backend integration
          will be wired when ready.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold ${
                step > s.id
                  ? "bg-blue-600 border-blue-600 text-white"
                  : step === s.id
                    ? "border-blue-600 text-blue-600"
                    : "border-gray-200 text-gray-400"
              }`}
            >
              {step > s.id ? <Check className="w-5 h-5" /> : s.id}
            </div>
            <span
              className={
                step >= s.id ? "text-gray-900 font-medium" : "text-gray-400"
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-5 h-5 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Select services to install
          </h2>
          <div className="space-y-3">
            {AVAILABLE_SERVICES.map((svc) => (
              <label
                key={svc.id}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedIds.includes(svc.id)
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(svc.id)}
                  onChange={() => toggleService(svc.id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <div>
                  <p className="font-medium text-gray-900">{svc.name}</p>
                  <p className="text-sm text-gray-500">{svc.category}</p>
                </div>
              </label>
            ))}
          </div>
          {selectedIds.length === 0 && (
            <p className="text-sm text-amber-600 mt-3">
              Select at least one service to continue.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Configuration
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter port and domain for each selected service (validation only in
            demo).
          </p>
          <div className="space-y-6">
            {selectedIds.map((id) => {
              const svc = AVAILABLE_SERVICES.find((s) => s.id === id);
              const c = config[id] ?? { port: "", domain: "" };
              const err = configErrors[id];
              return (
                <div
                  key={id}
                  className="p-4 rounded-lg border border-gray-200 bg-gray-50/50"
                >
                  <h3 className="font-medium text-gray-900 mb-3">
                    {svc?.name ?? id}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="text"
                        value={c.port}
                        onChange={(e) =>
                          updateConfig(id, "port", e.target.value)
                        }
                        placeholder="e.g. 8080"
                        className={`w-full px-3 py-2 border rounded-lg ${
                          err ? "border-red-500" : "border-gray-300"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Domain
                      </label>
                      <input
                        type="text"
                        value={c.domain}
                        onChange={(e) =>
                          updateConfig(id, "domain", e.target.value)
                        }
                        placeholder="e.g. app.example.com"
                        className={`w-full px-3 py-2 border rounded-lg ${
                          err ? "border-red-500" : "border-gray-300"
                        }`}
                      />
                    </div>
                  </div>
                  {err && (
                    <p className="text-sm text-red-600 mt-2">{err}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Installation progress
          </h2>
          <div className="flex flex-wrap gap-4 mb-4">
            {INSTALL_STAGES.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  i < currentStage
                    ? "bg-green-100 text-green-800"
                    : i === currentStage
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {i < currentStage ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-lg max-h-64 overflow-y-auto">
            {logs.length === 0 && !complete && (
              <span className="animate-pulse">Waiting to start...</span>
            )}
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {complete && (
              <div className="mt-2 text-green-300 font-semibold">
                Installation complete. Backend will be connected when ready.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || installing}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {step < 3 && (
          <button
            onClick={handleNext}
            disabled={!canNext}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 2 ? "Start installation" : "Next"}
          </button>
        )}
        {step === 3 && complete && (
          <a
            href="/installed"
            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            View installed apps
          </a>
        )}
      </div>
    </div>
  );
}
