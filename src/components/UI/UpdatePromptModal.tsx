import React, { useEffect } from "react";
import { DownloadCloud, Sparkles, X } from "lucide-react";

interface UpdatePromptModalProps {
  version: string;
  onUpdateNow: () => void;
  onNah: () => void;
}

export function UpdatePromptModal({
  version,
  onUpdateNow,
  onNah,
}: UpdatePromptModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") onNah();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onNah]);

  return (
    <div
      className="fixed inset-0 z-[1150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onNah}
    >
      <div
        className="w-full max-w-sm glass rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-accent/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close Icon */}
        <button
          onClick={onNah}
          className="btn-icon p-1.5 absolute top-4 right-4 text-text-muted hover:text-text-primary hover:bg-surface-raised rounded-xl transition-colors"
          title="Dismiss"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Animated Icon Stage */}
        <div className="relative mb-4 mt-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent/25 to-accent/10 border border-accent/30 flex items-center justify-center text-accent shadow-lg shadow-accent/15">
            <Sparkles size={30} className="animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-surface-base flex items-center justify-center shadow-md">
            <DownloadCloud size={13} className="stroke-[2.5]" />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-xl font-display font-bold text-text-primary tracking-tight">
          Update Available!
        </h3>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mt-2 mb-3">
          <span>Version {version}</span>
        </div>

        <p className="text-text-secondary text-sm leading-relaxed px-2 mb-6">
          A fresh version of Mewsic is ready with new features, performance boosts, and fixes. Would you like to update now?
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full">
          <button
            id="btn-update-nah"
            onClick={onNah}
            className="flex-1 h-11 px-5 rounded-xl border border-border-subtle bg-surface-base hover:bg-surface-raised text-text-muted hover:text-text-primary text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer"
          >
            Nah
          </button>
          <button
            id="btn-update-now"
            onClick={onUpdateNow}
            className="flex-1 h-11 px-5 rounded-xl bg-accent hover:opacity-90 text-surface-base font-semibold text-sm shadow-lg shadow-accent/25 hover:shadow-accent/40 flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 cursor-pointer group"
          >
            <DownloadCloud size={16} className="transition-transform group-hover:-translate-y-0.5" />
            <span>Update Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
