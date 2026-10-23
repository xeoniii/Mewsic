import { useEffect, useRef } from "react";
import { PluginConfigForm } from "../Plugins/PluginConfigForm";

export function PluginView({ viewId }: { viewId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDirectConfigView = viewId.startsWith("plugin-config:") || viewId.startsWith("config:");
  const directPluginId = isDirectConfigView ? viewId.replace(/^plugin-config:|^config:/, "") : null;

  useEffect(() => {
    if (isDirectConfigView) return;
    if (!containerRef.current) return;
    let attempts = 0;
    let cleanupFn: (() => void) | undefined;
    let rendered = false;

    // Infer plugin ID from viewId format: "plugin:<pluginId>" or "plugin:<pluginId>:<view>"
    let inferredPluginId = "";
    if (viewId.startsWith("plugin:")) {
      const parts = viewId.slice(7).split(":");
      inferredPluginId = parts[0] || "";
    }

    function tryRender() {
      if (rendered || !containerRef.current) return;

      const mewsic = window.Mewsic;
      if (!mewsic?.ui?.registry) {
        if (attempts++ < 100) {
          setTimeout(tryRender, 100);
        }
        return;
      }

      const viewConfig = mewsic.ui.registry.views.get(viewId);
      if (!viewConfig) {
        if (attempts++ < 100) {
          setTimeout(tryRender, 100);
        } else {
          containerRef.current.innerHTML = `
            <div class="flex items-center justify-center h-full w-full flex-col text-[var(--text-muted)] gap-4 p-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span class="text-lg font-bold">Plugin View Not Found</span>
              <span class="text-sm opacity-70 text-center">The view "${viewId}" could not be loaded.<br/>The plugin may have failed to execute.</span>
            </div>
          `;
        }
        return;
      }

      rendered = true;
      containerRef.current.innerHTML = "";

      const context = {
        viewId,
        pluginId: inferredPluginId,
        config: inferredPluginId && mewsic.config ? mewsic.config.getAll(inferredPluginId) : {},
        getConfig: (key?: string) => inferredPluginId && mewsic.config ? mewsic.config.get(inferredPluginId, key) : undefined,
        setConfig: (key: string, val: any) => inferredPluginId && mewsic.config?.set(inferredPluginId, key, val),
        onConfigChange: (cb: (cfg: any, key?: string) => void) =>
          inferredPluginId && mewsic.config ? mewsic.config.onChange(inferredPluginId, cb) : () => {},
      };

      viewConfig.render(containerRef.current, context);
      cleanupFn = viewConfig.cleanup;
    }

    tryRender();

    return () => {
      rendered = false;
      if (typeof cleanupFn === "function") {
        try { cleanupFn(); } catch (e) {}
      }
    };
  }, [viewId, isDirectConfigView]);

  if (isDirectConfigView && directPluginId) {
    return (
      <div className="w-full h-full p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <PluginConfigForm pluginId={directPluginId} />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full overflow-y-auto" />;
}

