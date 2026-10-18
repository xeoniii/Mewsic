import React, { useEffect, useRef, useMemo, useState } from "react";
import { useStore } from "../../store";
import { audio } from "../../utils/audioEngine";

export interface LyricLine {
  time: number;
  text: string;
}

// Module-level regular expressions for high performance without per-frame/render re-allocation
const LINE_REGEX = /^\[(\d+):(\d{2})(?:[.:](\d+))?\](.*)$/;
const CLEAN_TAGS_REGEX = /<[^>]+>|\(\d+,\s*\d+\)/g;
const WHITESPACE_REGEX = /\s+/g;
const IS_SYNCED_REGEX = /\[\d+:\d{2}(?:[.:]\d+)?\]/;

// Balanced hybrid curve: gentle initial acceleration + velvety cushioned deceleration
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutQuartic = (t: number) => 1 - Math.pow(1 - t, 4);
const easeSmooth = (t: number) => 0.35 * easeInOutSine(t) + 0.65 * easeOutQuartic(t);

export function parseLRC(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const rawLines = text.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const lineMatch = LINE_REGEX.exec(trimmed);
    if (lineMatch) {
      const minutes = parseInt(lineMatch[1], 10);
      const seconds = parseInt(lineMatch[2], 10);
      const msStr = lineMatch[3] || "0";
      const ms = parseInt(msStr.padEnd(3, "0").slice(0, 3), 10);
      const lineTime = minutes * 60 + seconds + ms / 1000;
      // Strip any residual word tags like <00:12.34> or (1234,456)
      const cleanText = lineMatch[4].replace(CLEAN_TAGS_REGEX, "").replace(WHITESPACE_REGEX, " ").trim();
      if (cleanText) {
        lines.push({ time: lineTime, text: cleanText });
      }
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

// 120fps liquid-smooth ease-in-out scroll animation with velvety glide and cushioned arrival
function animateScrollSmooth(element: HTMLDivElement, target: number, duration?: number) {
  let frameId: number;
  const start = element.scrollTop;
  const distance = target - start;
  
  if (Math.abs(distance) < 1) {
    element.scrollTop = target;
    return () => {};
  }
  
  const animDuration = duration ?? Math.min(750, Math.max(580, Math.abs(distance) * 0.65));
  let startTime: number | null = null;

  const step = (now: number) => {
    if (startTime === null) startTime = now;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / animDuration, 1);
    
    element.scrollTop = start + distance * easeSmooth(progress);
    
    if (progress < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      element.scrollTop = target;
    }
  };
  
  frameId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frameId);
}

export function Lyrics({ 
  autoScroll = true,
  isSyncMode = false,
  syncLines = [],
  setSyncLines,
}: { 
  autoScroll?: boolean;
  isSyncMode?: boolean;
  syncLines?: LyricLine[];
  setSyncLines?: (lines: LyricLine[]) => void;
}) {
  const currentTrack = useStore(s => s.currentTrack);
  const requestSeek = useStore(s => s.requestSeek);
  const theme = useStore(s => s.theme);
  const isLight = theme === "light";
  
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const currentTimeRef = useRef(0);
  const scrollAnimRef = useRef<(() => void) | null>(null);

  const lyrics = currentTrack?.lyrics;

  const isSynced = useMemo(() => {
    if (!lyrics) return false;
    return IS_SYNCED_REGEX.test(lyrics);
  }, [lyrics]);

  const parsedLyrics = useMemo<LyricLine[]>(() => {
    if (!lyrics) return [];
    if (!isSynced) {
      return lyrics.split("\n").map(text => ({ time: 0, text }));
    }
    return parseLRC(lyrics);
  }, [lyrics, isSynced]);

  // High-performance RAF synchronization loop tracking sub-millisecond audio playback in real time
  useEffect(() => {
    let animId: number;

    const updateLyrics = () => {
      // Sub-millisecond current playback position directly from audio element or store
      const exactTime = audio.currentTime || useStore.getState().currentTime;
      currentTimeRef.current = exactTime;

      // Update sync mode timer badge directly
      if (isSyncMode && timeDisplayRef.current) {
        const m = Math.floor(exactTime / 60).toString().padStart(2, '0');
        const s = Math.floor(exactTime % 60).toString().padStart(2, '0');
        const ms = Math.floor((exactTime % 1) * 100).toString().padStart(2, '0');
        timeDisplayRef.current.textContent = `${m}:${s}.${ms}`;
      }

      // Update active index for playback mode smoothly
      if (!isSyncMode && parsedLyrics.length > 0 && isSynced) {
        let active = 0;
        for (let i = 0; i < parsedLyrics.length; i++) {
          if (parsedLyrics[i].time <= exactTime) {
            active = i;
          } else {
            break;
          }
        }
        setActiveIndex(prev => prev !== active ? active : prev);
      }

      animId = requestAnimationFrame(updateLyrics);
    };

    animId = requestAnimationFrame(updateLyrics);
    return () => cancelAnimationFrame(animId);
  }, [isSyncMode, parsedLyrics, isSynced]);

  // Handle butter-smooth 120fps spring scrolling without layout thrashing
  useEffect(() => {
    if (autoScroll && isSynced && !isSyncMode) {
      const activeEl = activeRef.current || containerRef.current?.querySelector<HTMLElement>(".lyric-line-active");
      const container = containerRef.current;
      if (!activeEl || !container) return;

      const frameId = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const currentActiveEl = activeRef.current || containerRef.current.querySelector<HTMLElement>(".lyric-line-active");
        if (!currentActiveEl) return;
        const containerHeight = container.clientHeight;
        const activeHeight = currentActiveEl.clientHeight;
        const activeTop = currentActiveEl.offsetTop;

        // Keep starting lines near top, center active lines gracefully
        const targetTop = Math.max(0, activeTop - (containerHeight / 2) + (activeHeight / 2));

        if (scrollAnimRef.current) {
          scrollAnimRef.current();
        }

        scrollAnimRef.current = animateScrollSmooth(container, targetTop);
      });

      return () => {
        cancelAnimationFrame(frameId);
        if (scrollAnimRef.current) {
          scrollAnimRef.current();
        }
      };
    }
  }, [activeIndex, isSynced, autoScroll, isSyncMode]);

  if (isSyncMode && setSyncLines) {
    return (
      <div ref={containerRef} className="h-full overflow-y-auto scrollbar-hide relative" style={{ paddingBottom: '35vh' }}>
        <div className="sticky top-0 z-20 pt-5 pb-4 px-4 sm:px-8 bg-surface-base/90 backdrop-blur-2xl border-b border-border-glass">
          <div className="bg-surface-overlay/90 backdrop-blur-2xl py-3 px-4 rounded-2xl border border-border-glass shadow-glass flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span 
                ref={timeDisplayRef}
                className="text-accent font-mono text-sm sm:text-base font-bold bg-black/40 px-3.5 py-1.5 rounded-xl border border-border-subtle tracking-tight shadow-inner"
              >
                00:00.00
              </span>
              <p className="text-text-primary text-xs font-medium">
                Click a line to assign time. <span className="text-text-muted hidden md:inline">Ctrl+Click to seek.</span>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 px-4 sm:px-8 pt-4">
          {syncLines.map((line, i) => {
            const isLineSynced = line.time >= 0;
            return (
              <div
                key={i}
                className={`py-3.5 flex items-center justify-between rounded-2xl transition-all duration-200 hover:bg-surface-raised/50 hover:scale-[1.008] cursor-pointer group px-6 ${
                  isLineSynced ? 'bg-surface-raised/25 border border-border-subtle/60' : 'border border-transparent'
                }`}
                onClick={(e) => {
                  if (e.ctrlKey) {
                    if (isLineSynced) requestSeek(line.time);
                    return;
                  }
                  const newLines = [...syncLines];
                  newLines[i] = { ...newLines[i], time: currentTimeRef.current };
                  setSyncLines(newLines);
                }}
              >
                <p className={`text-base md:text-lg leading-relaxed flex-1 transition-colors ${
                  isLineSynced ? "text-accent font-semibold" : "text-text-muted group-hover:text-text-primary"
                }`}>
                  {line.text}
                </p>
                <span className="text-xs font-mono text-text-muted w-16 text-right opacity-60 group-hover:opacity-100 transition-opacity">
                  {isLineSynced 
                    ? `${Math.floor(line.time / 60).toString().padStart(2, '0')}:${Math.floor(line.time % 60).toString().padStart(2, '0')}.${Math.floor((line.time % 1)*100).toString().padStart(2, '0')}` 
                    : "--:--.--"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!lyrics) {
    return (
      <div className="flex items-center justify-center h-full w-full p-8 animate-fade-in">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black tracking-tight text-text-primary">No Lyrics Available</h2>
          <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed font-medium">
            We couldn't find any lyrics for the currently playing track.
            <br /><br />
            You can automatically fetch them online or sync them manually using the Sync button above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide px-6 sm:px-8 md:px-12 lg:px-16 pt-8 sm:pt-12 select-text"
      style={{
        paddingBottom: "48vh",
      }}
    >
      <style>{`
        .lyric-line-wrapper {
          transform-origin: left center;
        }

        .select-text ::selection {
          background: rgba(var(--accent-rgb, 27, 217, 106), 0.45) !important;
          color: #ffffff !important;
        }
      `}</style>
      
      {/* Responsive line layout with multi-tier sizing and highlighted upcoming/previous lines */}
      <div className="w-full max-w-none flex flex-col gap-5 sm:gap-6 pr-8 sm:pr-14 md:pr-20 lg:pr-28">
        {parsedLyrics.map((line, i) => {
          if (!line.text.trim()) {
            return <div key={i} className="h-6 sm:h-8" />;
          }

          const isActive = isSynced && i === activeIndex;
          const isAdjacent = isSynced && Math.abs(i - activeIndex) === 1;

          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`w-full flex justify-start origin-left py-0.5 lyric-line-wrapper ${
                isActive ? "lyric-line-active" : ""
              }`}
            >
              <p
                onClick={() => isSynced && requestSeek(line.time)}
                className={`max-w-full rounded-2xl origin-left text-left select-text ${
                  isSynced ? "cursor-pointer active:scale-[0.985] px-3 -mx-3 py-1 hover:bg-surface-raised/20" : ""
                } ${
                  !isSynced
                    ? isLight
                      ? "text-lg sm:text-xl text-slate-800 opacity-90 leading-relaxed font-semibold"
                      : "text-lg sm:text-xl text-white opacity-90 leading-relaxed font-semibold"
                    : isActive
                    ? isLight
                      ? "text-2xl sm:text-3xl text-slate-950 font-black opacity-100 scale-[1.04] leading-snug drop-shadow-sm"
                      : "text-2xl sm:text-3xl text-white font-black opacity-100 scale-[1.04] leading-snug drop-shadow-sm"
                    : isAdjacent
                    ? isLight
                      ? "text-lg sm:text-xl text-slate-700 font-semibold opacity-45 hover:opacity-80 hover:text-slate-950 scale-[1.01] leading-relaxed"
                      : "text-lg sm:text-xl text-white/70 font-semibold opacity-40 hover:opacity-80 hover:text-white scale-[1.01] leading-relaxed"
                    : isLight
                    ? "text-base sm:text-lg text-slate-500 font-medium opacity-25 hover:opacity-70 hover:text-slate-800 scale-100 leading-relaxed"
                    : "text-base sm:text-lg text-white/45 font-medium opacity-20 hover:opacity-75 hover:text-white scale-100 leading-relaxed"
                }`}
                style={{
                  transition:
                    "font-size 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), line-height 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.52s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), color 0.4s ease-out, filter 0.45s ease-out, text-shadow 0.45s ease-out",
                }}
              >
                {line.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}