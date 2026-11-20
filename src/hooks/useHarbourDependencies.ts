import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "../store";

export interface HarbourDependencyStatus {
  yt_dlp_version: string;
  ffmpeg_version: string;
  yt_dlp_updated: boolean;
  ffmpeg_updated: boolean;
  is_updating: boolean;
  current_status: string;
  message: string;
}

// Module-level singleton state that persists across all view switches!
let globalIsUpdating = false;
let globalStatusText: string | null = null;
let globalEngineInfo: HarbourDependencyStatus | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

let isGlobalListening = false;
function ensureGlobalListeners() {
  if (isGlobalListening) return;
  isGlobalListening = true;

  listen<string>("harbour-dependencies-status", (e) => {
    globalStatusText = e.payload;
    notify();
  });
  listen<number>("harbour-download-progress-ytdlp", (e) => {
    globalStatusText = `yt-dlp: ${Math.round(e.payload)}%`;
    notify();
  });
  listen<number>("harbour-download-progress-ffmpeg", (e) => {
    globalStatusText = `FFmpeg: ${Math.round(e.payload)}%`;
    notify();
  });
}

export function useHarbourDependencies() {
  const [isUpdating, setIsUpdating] = useState(globalIsUpdating);
  const [statusText, setStatusText] = useState(globalStatusText);
  const [engineInfo, setEngineInfo] = useState<HarbourDependencyStatus | null>(globalEngineInfo);

  useEffect(() => {
    ensureGlobalListeners();

    const updateFromGlobal = () => {
      setIsUpdating(globalIsUpdating);
      setStatusText(globalStatusText);
      setEngineInfo(globalEngineInfo);
    };

    listeners.add(updateFromGlobal);

    // Initial check from backend (finds out if already updating or current versions)
    invoke<HarbourDependencyStatus>("get_dependencies_status")
      .then((res) => {
        globalEngineInfo = res;
        if (res.is_updating) {
          globalIsUpdating = true;
          if (res.current_status) {
            globalStatusText = res.current_status;
          }
        }
        notify();
      })
      .catch(() => {});

    return () => {
      listeners.delete(updateFromGlobal);
    };
  }, []);

  const updateDependencies = async () => {
    if (globalIsUpdating) return;
    globalIsUpdating = true;
    globalStatusText = "Looking for updates...";
    notify();

    try {
      const res = await invoke<HarbourDependencyStatus>("update_harbour_dependencies");
      globalEngineInfo = res;
      useStore.getState().addNotification(
        `Harbour dependencies updated! yt-dlp: ${res.yt_dlp_version} • FFmpeg: ${res.ffmpeg_version}`,
        "success",
        5000,
        false,
        "Dependencies Updated"
      );
    } catch (err: any) {
      console.error("Failed to update engine dependencies:", err);
      useStore.getState().addNotification(
        `Failed to update dependencies: ${err?.message || err}`,
        "error",
        5000
      );
    } finally {
      globalIsUpdating = false;
      globalStatusText = null;
      notify();
    }
  };

  return {
    isUpdating,
    statusText,
    engineInfo,
    updateDependencies,
  };
}
