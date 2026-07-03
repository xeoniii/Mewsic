import React, { useRef, useState, useEffect } from 'react';
import { Crosshair, RotateCcw, RefreshCw } from 'lucide-react';

interface SpatialPannerProps {
  x: number; // -1 to 1
  y: number; // -1 to 1
  autoPan: boolean;
  onChange: (x: number, y: number) => void;
  onToggleAuto: (enabled: boolean) => void;
}

export function SpatialPanner({ x, y, autoPan, onChange, onToggleAuto }: SpatialPannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleInteract = (clientX: number, clientY: number) => {
    if (autoPan) onToggleAuto(false);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate relative position (-1 to 1)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const relX = (clientX - rect.left - centerX) / centerX;
    const relY = (clientY - rect.top - centerY) / centerY;

    // Constrain to circle
    const distance = Math.sqrt(relX * relX + relY * relY);
    let finalX = relX;
    let finalY = relY;

    if (distance > 1) {
      finalX = relX / distance;
      finalY = relY / distance;
    }

    onChange(
      Math.max(-1, Math.min(1, finalX)),
      Math.max(-1, Math.min(1, finalY))
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handleInteract(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handleInteract(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Convert -1..1 to 0..100% for CSS positioning
  const leftPos = `${((x + 1) / 2) * 100}%`;
  const topPos = `${((y + 1) / 2) * 100}%`;

  return (
    <div className="flex flex-col items-center w-full">
      <div 
        ref={containerRef}
        className="relative w-40 h-40 rounded-full border-2 border-white/5 bg-white/[0.02] cursor-crosshair touch-none shadow-inner flex items-center justify-center group"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {
  // This is the background grid/rings part
}
        <div className="absolute inset-0 rounded-full border border-white/5 scale-50 pointer-events-none" />
        <div className="absolute inset-0 rounded-full border border-white/5 scale-75 pointer-events-none" />
        <div className="absolute w-full h-px bg-white/5 pointer-events-none" />
        <div className="absolute h-full w-px bg-white/5 pointer-events-none" />
        
        {
  // This is the center marker part
}
        <Crosshair size={16} className="text-white/10 absolute pointer-events-none" />

        {
  // This is the the puck wrapper part
}
        <div 
          className={`absolute inset-0 pointer-events-none ${autoPan ? 'animate-spin force-anim' : ''}`}
          style={autoPan ? { animationDuration: '7.85s', animationTimingFunction: 'linear' } : undefined}
        >
          {
  // This is the the puck part
}
          <div 
            className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-accent shadow-[0_0_15px_rgba(var(--color-accent),0.5)] border-2 border-white transition-all duration-300"
            style={
              autoPan 
                ? { left: '72.5%', top: '50%' }
                : { left: leftPos, top: topPos, transform: isDragging ? 'scale(1.2)' : 'scale(1)' }
            }
          >
            {
  // This is the inner glow part
}
            <div className="absolute inset-0 rounded-full bg-white/50 blur-sm" />
          </div>
        </div>
      </div>
      
      {
  // This is the controls part
}
      <div className="flex items-center justify-between w-full mt-6 px-4">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Pan L/R</p>
            <p className="text-xs font-mono font-bold text-accent">{(x * 100).toFixed(0)}%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Depth</p>
            <p className="text-xs font-mono font-bold text-accent">{(-y * 100).toFixed(0)}%</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onToggleAuto(!autoPan)}
            className={`p-1.5 rounded-lg border transition-all active:scale-90 ${autoPan ? 'bg-accent/10 border-accent/50 text-accent' : 'bg-surface-raised border-white/5 text-text-muted hover:text-accent hover:border-white/10'}`}
            title="Toggle Orbit"
          >
            <RefreshCw size={14} className={autoPan ? 'animate-spin force-anim' : ''} style={{ animationDuration: '3s' }} />
          </button>
          <button
            onClick={() => {
              if (autoPan) onToggleAuto(false);
              onChange(0, 0);
            }}
            className="p-1.5 rounded-lg bg-surface-raised border border-white/5 text-text-muted hover:text-accent hover:border-white/10 transition-all active:scale-90"
            title="Reset to Center"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
