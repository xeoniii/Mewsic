import { CheckCircle2, Info, XCircle, X, Download } from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { clsx } from "clsx";

export function ToastContainer() {
  const { notifications, removeNotification } = useStore(useShallow((s) => ({
    notifications: s.notifications,
    removeNotification: s.removeNotification,
  })));

  return (
    <div className="fixed bottom-[110px] right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={clsx(
            "pointer-events-auto flex flex-col p-3.5 rounded-2xl border shadow-2xl animate-[slideUp_0.3s_ease-out]",
            n.type === "success" && "border-emerald-500/30",
            n.type === "error" && "border-red-500/30",
            n.type === "info" && "border-accent/30"
          )}
          style={{ 
            minWidth: "300px", 
            maxWidth: "380px",
            backdropFilter: "blur(16px)",
            background: "var(--surface-overlay)",
            border: "1px solid var(--border-glass)"
          }}
        >
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              n.type === "success" && "bg-emerald-500/20 text-emerald-400",
              n.type === "error" && "bg-red-500/20 text-red-400",
              n.type === "info" && "bg-accent/20 text-accent"
            )}>
              {n.type === "success" ? (
                <CheckCircle2 size={16} />
              ) : n.type === "error" ? (
                <XCircle size={16} />
              ) : n.progress !== undefined || n.loading ? (
                <Download size={16} className={n.loading && n.progress === undefined ? "animate-pulse" : ""} />
              ) : (
                <Info size={16} />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-text-primary leading-tight truncate">
                  {n.title || (n.type === "success" ? "Success" : n.type === "error" ? "Error" : "Info")}
                </p>
                {n.progress !== undefined && (
                  <span className="text-[11px] font-bold text-accent shrink-0 font-mono">
                    {Math.round(n.progress)}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted truncate mt-0.5">{n.message}</p>
            </div>
            
            <button
              onClick={() => removeNotification(n.id)}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-text-primary shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {/* Synced horizontal progress bar */}
          {n.progress !== undefined && (
            <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, n.progress))}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
