import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmationModal({
  title,
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
  variant = "info",
}: ConfirmationModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onCancel}>
      <div 
        className="w-full max-w-sm glass rounded-2xl mx-4 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className={
              variant === "danger" ? "text-red-500" :
              variant === "warning" ? "text-amber-500" :
              "text-accent"
            } />
            <h2 className="font-display font-semibold text-text-primary">{title}</h2>
          </div>
          <button onClick={onCancel} className="btn-icon p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-text-secondary leading-relaxed text-sm">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-surface-overlay/30">
          <button 
            onClick={onCancel} 
            className="btn-accent bg-surface-overlay text-text-secondary hover:opacity-80"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm} 
            className={`btn-accent ${
              variant === "danger" ? "bg-red-500 hover:bg-red-600 text-white" :
              variant === "warning" ? "bg-amber-500 hover:bg-amber-600 text-white" :
              ""
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
