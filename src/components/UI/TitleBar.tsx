import React, { useState, useEffect } from "react";
import { Minus, Square, X, Copy } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../../store";

export function TitleBar() {
  const initialCustomTitlebar = useStore.getState().customTitlebar;
  const isFullscreen = useStore((s) => s.isFullscreen);
  const [showTitlebar] = useState(initialCustomTitlebar);
  const [isMaximized, setIsMaximized] = useState(false);
  let appWindow: any = null;
  try {
    appWindow = getCurrentWindow();
  } catch (e) {
    console.warn("TitleBar: failed to get app window", e);
  }

  useEffect(() => {
    if (!showTitlebar || isFullscreen || !appWindow) return;

    const updateMaximized = async () => {
      try {
        const maximized = await invoke<boolean>("is_window_maximized");
        setIsMaximized(maximized);
      } catch {}
    };

    updateMaximized();

    let unlisten: Promise<any> | null = null;
    try {
      unlisten = appWindow.onResized(() => {
        updateMaximized();
      });
    } catch (e) {
      console.warn("TitleBar: failed to bind onResized listener", e);
    }

    return () => {
      if (unlisten) {
        unlisten.then((fn: any) => fn());
      }
    };
  }, [showTitlebar, appWindow]);

  if (!showTitlebar || isFullscreen) return null;

  const handleDrag = () => {
    invoke("start_window_drag").catch(() => {});
  };

  return (
    <div id="custom-titlebar" className="h-8 relative flex items-center justify-between bg-surface-base/80 backdrop-blur-md border-b border-border-subtle select-none z-[1000]">
      {
  // This is the separate drag region - background part
}
      <div 
        onMouseDown={handleDrag}
        data-tauri-drag-region 
        className="absolute inset-0 cursor-default" 
      />

      {
  // This is the content - above drag region part
}
      <div className="relative z-10 flex items-center px-3 gap-2 pointer-events-none">
        <div className="w-3.5 h-3.5 rounded-full bg-accent/20 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Mewsic
        </span>
      </div>

      <div className="relative z-10 flex h-full">
        <button
          onClick={() => invoke("minimize_window")}
          className="w-10 h-full flex items-center justify-center text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => invoke("toggle_maximize_window")}
          className="w-10 h-full flex items-center justify-center text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => invoke("close_window")}
          className="w-10 h-full flex items-center justify-center text-text-muted hover:bg-red-500/80 hover:text-white transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
