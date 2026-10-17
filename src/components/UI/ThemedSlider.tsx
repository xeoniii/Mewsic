import React, { useCallback, useState } from "react";
import { formatDuration } from "../../utils/helpers";

interface ThemedSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  onChangeCommit?: (val: number) => void;
  className?: string;
  showTooltip?: boolean;
  formatTooltip?: (val: number) => string;
  disabled?: boolean;
}

export function ThemedSlider({
  value,
  min,
  max,
  step = 0.1,
  onChange,
  onChangeCommit,
  className = "",
  showTooltip = true,
  formatTooltip,
  disabled = false,
}: ThemedSliderProps) {
  const [hoverVal, setHoverVal] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<string>("50%");

  const progress = ((value - min) / (max - min)) * 100;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width) return;

      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const val = min + ratio * (max - min);

      setHoverVal(val);
      setTooltipPos(`${(ratio * 100).toFixed(2)}%`);
    },
    [min, max, disabled]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverVal(null);
  }, []);

  const displayTooltip = formatTooltip ? formatTooltip(hoverVal ?? 0) : (hoverVal ?? 0).toFixed(2);

  return (
    <div 
      className={`flex-1 relative group/slider flex items-center h-5 ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {showTooltip && hoverVal !== null && (
        <div 
          className="absolute bottom-full mb-2 px-1.5 py-0.5 rounded bg-surface-overlay border border-border-glass text-[10px] font-mono text-text-primary pointer-events-none -translate-x-1/2 whitespace-nowrap z-50 shadow-lg"
          style={{ left: `clamp(18px, ${tooltipPos}, calc(100% - 18px))` }}
        >
          {displayTooltip}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseUp={(e) => onChangeCommit?.(parseFloat(e.currentTarget.value))}
        onTouchEnd={(e) => onChangeCommit?.(parseFloat(e.currentTarget.value))}
        className="w-full seek-bar disabled:opacity-30"
        style={{ 
          "--progress": `${progress}%`,
          "--progress-ratio": progress / 100,
        } as React.CSSProperties}
      />
    </div>
  );
}
