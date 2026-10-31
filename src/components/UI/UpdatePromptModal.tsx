import { useEffect } from "react";
import { DownloadCloud, X } from "lucide-react";

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
      className="fixed inset-0 z-[1100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onNah}
    >
      <div
        className="w-full max-w-md glass rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header section (matches UpdateModal) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="font-display font-semibold text-text-primary">Mewsic Updater</h2>
          <button
            onClick={onNah}
            className="btn-icon p-1"
            title="Dismiss"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main content */}
        <div className="p-6 flex flex-col gap-6 items-center text-center">
          {/* Icon stage (matches UpdateModal) */}
          <div className="relative">
            <div className="w-20 h-20 rounded-[2.5rem] bg-accent/10 flex items-center justify-center text-accent">
              <DownloadCloud size={40} className="animate-bounce" />
            </div>
          </div>

          {/* Text stage */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              Update Available!
            </h2>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold my-1">
              <span>Version {version}</span>
            </div>
            <p className="text-sm text-text-muted font-medium leading-relaxed px-4">
              Mewsic v{version} is ready for deployment. Would you like to download and install this update now?
            </p>
          </div>
        </div>

        {/* Footer section (matches UpdateModal) */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-surface-overlay/30">
          <button
            id="btn-update-nah"
            onClick={onNah}
            className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80"
          >
            Later
          </button>
          <button
            id="btn-update-now"
            onClick={onUpdateNow}
            className="btn-accent"
          >
            <DownloadCloud size={14} />
            <span>Update Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
