import { CheckCircle2, Info, XCircle, X, Loader2 } from "lucide-react";
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
            "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl animate-[slideUp_0.3s_ease-out]",
            n.type === "success" && "bg-[#1bd96a1a] border-[#1bd96a33] text-[#1bd96a]",
            n.type === "error" && "bg-[#f43f5e1a] border-[#f43f5e33] text-[#f43f5e]",
            n.type === "info" && "bg-accent-muted border-accent/20 text-accent"
          )}
          style={{ 
            minWidth: "280px", 
            backdropFilter: "blur(12px)",
            background: "var(--surface-overlay)",
            border: "1px solid var(--border-glass)"
          }}
        >
          <div className={clsx(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            n.type === "success" && "bg-green-500/20",
            n.type === "error" && "bg-red-500/20",
            n.type === "info" && "bg-accent/20"
          )}>
            {n.progress !== undefined ? (
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg className="w-8 h-8 block -rotate-90" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="opacity-20"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray={75.4}
                    strokeDashoffset={75.4 - (75.4 * n.progress) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-300 ease-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold leading-none">{Math.round(n.progress)}%</span>
              </div>
            ) : n.loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {n.type === "success" && <CheckCircle2 size={18} />}
                {n.type === "error" && <XCircle size={18} />}
                {n.type === "info" && <Info size={18} />}
              </>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary leading-tight truncate">
              {n.title || (n.type === "success" ? "Success" : n.type === "error" ? "Error" : "Info")}
            </p>
            <p className="text-xs text-text-secondary truncate mt-0.5">{n.message}</p>
          </div>
          
          <button
            onClick={() => removeNotification(n.id)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
