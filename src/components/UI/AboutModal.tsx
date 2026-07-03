import React, { useState, useEffect } from "react";
import { X, Music2, Globe, Heart, Github } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { getOSName } from "../../utils/tauriApi";
import { useStore } from "../../store";

export function AboutModal() {
  const { setShowAbout } = useStore();
  const [appVersion, setAppVersion] = useState<string>("0.8.4");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => { });
  }, []);

  const handleOpenLink = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.error("Failed to open link:", err);
    }
  };

  const getBuildId = () => {
    const vParts = appVersion.split('.');
    if (vParts.length < 3) return "00000000000";

    const now = new Date();
    const yearStr = now.getFullYear().toString(); // 2026
    const y1 = yearStr.slice(0, 2); // 20
    const y2 = yearStr.slice(2, 4); // 26
    const mm = (now.getMonth() + 1).toString().padStart(2, '0'); // 05
    const dd = now.getDate().toString().padStart(2, '0'); // 06

    return `${y1}${vParts[0]}${y2}${vParts[1]}${mm}${vParts[2]}${dd}`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setShowAbout(false)}
    >
      <div
        className="w-full max-w-2xl glass rounded-[2rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        {
  // This is the header section
}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle">
          <h2 className="font-display text-xl font-semibold text-text-primary">About Mewsic</h2>
          <button onClick={() => setShowAbout(false)} className="btn-icon p-2 hover:bg-surface-overlay rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        {
  // Here is the main content
}
        <div className="p-8">
          <div className="flex flex-col p-8 rounded-2xl bg-surface-overlay border border-border-subtle gap-8 w-full text-left">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 shadow-sm flex items-center justify-center flex-shrink-0">
                  <Music2 size={32} className="text-accent" />
                </div>
                <div className="flex flex-col">
                  <p className="font-display font-black text-3xl text-text-primary tracking-tight">Mewsic <span className="text-accent text-lg ml-1">v{appVersion}</span></p>
                  <p className="text-xs text-text-muted mt-1 uppercase tracking-widest font-bold">Crafted with love by xeoniii.dev</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              A lightning-fast, highly customizable music player built for the modern era. Mewsic combines advanced audio engineering with a stunning interface to bring your local music library to life. Completely open-source, with no telemetry and no ads—just pure audio.
            </p>

            <div className="flex justify-between items-end border-t border-border-subtle pt-5 mt-1">
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenLink("https://xeoniii.github.io")}
                  className="p-2 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/50 hover:text-accent transition-all text-text-muted flex items-center justify-center"
                  title="Website"
                >
                  <Globe size={16} />
                </button>
                <button
                  onClick={() => handleOpenLink("https://github.com/xeoniii/Mewsic")}
                  className="p-2 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/50 hover:text-accent transition-all text-text-muted flex items-center justify-center"
                  title="GitHub"
                >
                  <Github size={16} />
                </button>
              </div>

              <div className="flex flex-col items-end">
                <p className="text-[9px] text-text-muted/60 font-mono uppercase tracking-[0.2em]">Build: {getBuildId()}</p>
                <p className="text-[9px] text-text-muted/60 font-mono uppercase tracking-[0.2em] mt-0.5">{getOSName()}</p>
                <p className="text-[9px] text-accent/60 font-mono uppercase tracking-[0.2em] mt-0.5">17,262 Lines of code</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
