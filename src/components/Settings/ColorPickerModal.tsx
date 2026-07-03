import React, { useState, useRef, useEffect } from "react";
import { X, Check, Pipette } from "lucide-react";
import { useStore } from "../../store";

// HSL to HEX helper
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// HEX to HSL helper
function hexToHsl(hex: string) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function ColorPickerModal({ onClose }: { onClose: () => void }) {
  const customAccentColor = useStore((s) => s.customAccentColor);
  const setCustomAccentColor = useStore((s) => s.setCustomAccentColor);
  const addCustomColorToHistory = useStore((s) => s.addCustomColorToHistory);
  const customColorHistory = useStore((s) => s.customColorHistory || []);
  const setAccentColor = useStore((s) => s.setAccentColor);

  const [hsl, setHsl] = useState(() => hexToHsl(customAccentColor));
  const wheelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const h = hsl[0];
  const s = hsl[1];
  const l = hsl[2];
  
  const handleMove = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    
    // Support both mouse and touch
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    
    const dx = x - cx;
    const dy = y - cy;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = rect.width / 2;
    
    let saturation = (distance / radius) * 100;
    if (saturation > 100) saturation = 100;
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    setHsl([Math.round(angle), Math.round(saturation), l]);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove as any);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove as any);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, l]); 

  const hexColor = hslToHex(h, s, l);

  const handleApply = () => {
    setCustomAccentColor(hexColor);
    addCustomColorToHistory(hexColor);
    setAccentColor("custom" as any);
    onClose();
  };

  // Convert H/S to x,y for the thumb
  const angleRad = h * (Math.PI / 180);
  const dist = (s / 100) * 100; // Assuming radius 100 for a 200x200 wheel
  const thumbX = 100 + dist * Math.cos(angleRad);
  const thumbY = 100 + dist * Math.sin(angleRad);

  // Calculate lightness overlay opacity
  // When l = 50, opacity is 0 (normal color)
  // When l < 50, it goes to black overlay. Opacity = 1 - (l / 50)
  // When l > 50, it goes to white overlay. Opacity = (l - 50) / 50
  const isLight = l > 50;
  const overlayOpacity = isLight ? (l - 50) / 50 : 1 - (l / 50);
  const overlayColor = isLight ? 'white' : 'black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-scale-in">
      <div className="glass-heavy w-[340px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-border-subtle">
        <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-surface-overlay/50">
          <div className="flex items-center gap-2 text-text-primary">
            <Pipette size={18} className="text-accent" />
            <h2 className="font-display font-bold text-sm">Custom Color</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center gap-6">
          {
  // This is the wheel part
}
          <div 
            ref={wheelRef}
            className="w-[200px] h-[200px] rounded-full relative cursor-crosshair shadow-lg"
            style={{
              background: `conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red)`
            }}
            onMouseDown={(e) => {
              setIsDragging(true);
              handleMove(e);
            }}
            onTouchStart={(e) => {
              setIsDragging(true);
              handleMove(e);
            }}
          >
            {
  // This is the white overlay for saturation (center is white, edge is full color) part
}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle closest-side, white, transparent)' }} />
            
            {
  // This is the overlay for lightness (controlled by slider) part
}
            <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: overlayColor, opacity: overlayOpacity }} />

            {
  // This is the thumb part
}
            <div 
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-none"
              style={{
                left: `${(thumbX / 200) * 100}%`,
                top: `${(thumbY / 200) * 100}%`,
                backgroundColor: hexColor
              }}
            />
          </div>

          {
  // This is the lightness slider part
}
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs text-text-muted font-bold tracking-widest uppercase">
              <span>Darker</span>
              <span>Lighter</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={l} 
              onChange={(e) => setHsl([h, s, parseInt(e.target.value)])}
              className="w-full h-3 rounded-full appearance-none bg-surface-raised border border-border-subtle cursor-pointer"
              style={{
                background: `linear-gradient(to right, #000000, hsl(${h}, ${s}%, 50%), #ffffff)`
              }}
            />
          </div>

          {
  // This is the hex display part
}
          <div className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-overlay border border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: hexColor }} />
              <span className="font-mono text-sm tracking-wider text-text-primary">{hexColor.toUpperCase()}</span>
            </div>
            <Pipette size={16} className="text-text-muted" />
          </div>

          {
  // This is the history part
}
          {customColorHistory.length > 0 && (
            <div className="w-full flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Recent Colors</span>
              <div className="flex gap-2">
                {customColorHistory.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setHsl(hexToHsl(color))}
                    className="w-6 h-6 rounded-full shadow-inner border border-white/20 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color.toUpperCase()}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border-subtle bg-surface-overlay/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-black text-xs font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-accent"
          >
            <Check size={14} strokeWidth={3} />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
