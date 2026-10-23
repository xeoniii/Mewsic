import { useState, useEffect, useCallback } from "react";
import { Sliders, RotateCcw, Check, Eye, EyeOff, Info } from "lucide-react";
import type { PluginConfigField } from "../../types";

interface PluginConfigFormProps {
  pluginId: string;
  onConfigChange?: (key: string, value: any) => void;
}

export function PluginConfigForm({ pluginId, onConfigChange }: PluginConfigFormProps) {
  const [schema, setSchema] = useState<PluginConfigField[]>([]);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (typeof window === "undefined" || !window.Mewsic?.config) return;
    const currentSchema = window.Mewsic.config.getSchema(pluginId) || [];
    const currentValues = window.Mewsic.config.getAll(pluginId) || {};
    setSchema(currentSchema);
    setConfigValues(currentValues);
  }, [pluginId]);

  useEffect(() => {
    loadData();

    const handleConfigEvent = (e: any) => {
      if (e.detail?.pluginId === pluginId) {
        loadData();
      }
    };

    window.addEventListener("plugin-config-updated" as any, handleConfigEvent);
    window.addEventListener("plugin-config-registered" as any, handleConfigEvent);
    return () => {
      window.removeEventListener("plugin-config-updated" as any, handleConfigEvent);
      window.removeEventListener("plugin-config-registered" as any, handleConfigEvent);
    };
  }, [pluginId, loadData]);

  const handleChange = (key: string, value: any) => {
    if (!window.Mewsic?.config) return;
    window.Mewsic.config.set(pluginId, key, value);
    setConfigValues((prev) => ({ ...prev, [key]: value }));
    onConfigChange?.(key, value);

    setSaveStatus("Saved");
    const timer = setTimeout(() => setSaveStatus(null), 1800);
    return () => clearTimeout(timer);
  };

  const handleReset = () => {
    if (!window.Mewsic?.config) return;
    window.Mewsic.config.reset(pluginId);
    loadData();
    setSaveStatus("Reset to Defaults");
    setTimeout(() => setSaveStatus(null), 1800);
  };

  if (!schema || schema.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-surface-base/30 border border-border-subtle/60 gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-surface-overlay/80 border border-white/5 flex items-center justify-center text-text-muted">
          <Sliders size={22} className="opacity-60 text-accent" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-text-primary">No Config Options Declared</h4>
          <p className="text-xs text-text-muted mt-1 max-w-sm leading-relaxed">
            This plugin does not declare any user-configurable settings in its manifest or runtime code.
          </p>
        </div>
        <div className="mt-2 text-left w-full max-w-md bg-surface-raised/40 border border-border-subtle/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-accent mb-1.5">
            <Info size={12} />
            <span>Plugin Developers: Add Config</span>
          </div>
          <pre className="text-[10px] font-mono text-text-secondary leading-relaxed overflow-x-auto whitespace-pre">
{`// In manifest.json:
"config": [
  { "key": "apiKey", "label": "API Key", "type": "string" }
]

// Or in index.js:
Mewsic.config.register("${pluginId}", [
  { key: "enabled", label: "Feature Enabled", type: "boolean", default: true }
]);`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Status & Reset */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
            <span>Plugin Settings</span>
            <span className="text-[10px] font-mono font-normal text-text-muted bg-surface-raised px-2 py-0.5 rounded-full border border-border-subtle/40">
              {schema.length} {schema.length === 1 ? "option" : "options"}
            </span>
          </h4>
          <p className="text-[11px] text-text-muted mt-0.5">
            Adjust configuration options for this plugin. Changes take effect immediately.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {saveStatus && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg animate-fade-in">
              <Check size={11} strokeWidth={3} />
              {saveStatus}
            </span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl bg-surface-raised hover:bg-surface-overlay text-text-muted hover:text-text-primary border border-border-subtle hover:border-accent/40 transition-all cursor-pointer shadow-sm"
            title="Reset all settings to default values"
          >
            <RotateCcw size={11} />
            Reset Defaults
          </button>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-4">
        {schema.map((field) => {
          const val = configValues[field.key] !== undefined ? configValues[field.key] : field.default;

          return (
            <div
              key={field.key}
              className="p-4 rounded-xl bg-surface-base/40 border border-border-subtle/60 hover:border-border-subtle transition-colors flex flex-col gap-2.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-primary leading-tight">
                      {field.label}
                    </label>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-surface-raised text-text-muted rounded border border-white/5">
                      {field.type}
                    </span>
                  </div>
                  {field.description && (
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      {field.description}
                    </p>
                  )}
                </div>

                {/* Control depending on type */}
                {field.type === "boolean" && (
                  <button
                    type="button"
                    onClick={() => handleChange(field.key, !val)}
                    className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative flex-shrink-0 cursor-pointer ${
                      val ? "bg-accent shadow-sm shadow-accent/20" : "bg-surface-overlay border border-border-subtle"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-md ${
                        val ? "translate-x-5 bg-black" : "translate-x-0 bg-text-muted"
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* String / Text input */}
              {(field.type === "string" || field.type === "text") && (
                <div className="mt-1">
                  <input
                    type="text"
                    value={val ?? ""}
                    placeholder={field.placeholder ?? (field.default !== undefined ? String(field.default) : "")}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent transition-colors font-mono"
                  />
                </div>
              )}

              {/* Password / API Key Input */}
              {field.type === "password" && (
                <div className="mt-1 relative">
                  <input
                    type={showPassword[field.key] ? "text" : "password"}
                    value={val ?? ""}
                    placeholder={field.placeholder ?? "Enter secret token..."}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl pl-3 pr-10 py-2 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    title={showPassword[field.key] ? "Hide secret" : "Show secret"}
                  >
                    {showPassword[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}

              {/* Number Input */}
              {field.type === "number" && (
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="number"
                    value={val ?? field.default ?? 0}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    onChange={(e) => handleChange(field.key, Number(e.target.value))}
                    className="w-36 bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent transition-colors font-mono"
                  />
                  {(field.min !== undefined || field.max !== undefined) && (
                    <span className="text-[10px] text-text-muted font-mono">
                      Range: [{field.min ?? "−∞"} – {field.max ?? "+∞"}]
                    </span>
                  )}
                </div>
              )}

              {/* Select Dropdown */}
              {field.type === "select" && (
                <div className="mt-1">
                  <select
                    value={val ?? field.default ?? ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full bg-surface-raised border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
                  >
                    {(field.options || []).map((opt, i) => {
                      const optLabel = typeof opt === "string" ? opt : opt.label;
                      const optValue = typeof opt === "string" ? opt : opt.value;
                      return (
                        <option key={i} value={optValue} className="bg-surface-raised text-text-primary">
                          {optLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Color Picker */}
              {field.type === "color" && (
                <div className="mt-1 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl border border-white/20 shadow-sm flex-shrink-0 cursor-pointer overflow-hidden relative"
                    style={{ backgroundColor: val || "#1bd96a" }}
                  >
                    <input
                      type="color"
                      value={val || "#1bd96a"}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={val ?? "#1bd96a"}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-32 bg-surface-raised border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
