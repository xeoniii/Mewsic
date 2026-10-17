import React, { useEffect, useRef, useMemo, useState } from "react";
import { useStore } from "../../store";

export interface LyricWord {
  text: string;
  time: number; // in seconds, -1 if unsynced
}

export interface LyricLine {
  time: number;
  text: string;
  words?: LyricWord[];
}

export function parseLRC(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const rawLines = text.split(/\r?\n/);
  const lineRegex = /^\[(\d+):(\d{2})(?:\.(\d+))?\](.*)$/;
  const wordTagRegex = /<(\d+):(\d{2})(?:\.(\d+))?>\s*([^<]*)/g;

  for (const rawLine of rawLines) {
    const lineMatch = lineRegex.exec(rawLine.trim());
    if (!lineMatch) continue;

    const minutes = parseInt(lineMatch[1], 10);
    const seconds = parseInt(lineMatch[2], 10);
    const msStr = lineMatch[3] || "0";
    const ms = parseInt(msStr.padEnd(3, "0").slice(0, 3), 10);
    const lineTime = minutes * 60 + seconds + ms / 1000;
    const lineRest = lineMatch[4].trim();

    if (!lineRest) continue;

    // Check if there are word tags <mm:ss.xx>
    const words: LyricWord[] = [];
    let wordMatch: RegExpExecArray | null;
    let hasWordTags = false;

    while ((wordMatch = wordTagRegex.exec(lineRest)) !== null) {
      hasWordTags = true;
      const wMin = parseInt(wordMatch[1], 10);
      const wSec = parseInt(wordMatch[2], 10);
      const wMsStr = wordMatch[3] || "0";
      const wMs = parseInt(wMsStr.padEnd(3, "0").slice(0, 3), 10);
      const wTime = wMin * 60 + wSec + wMs / 1000;
      const wText = wordMatch[4].trim();
      if (wText) {
        words.push({ time: wTime, text: wText });
      }
    }

    if (hasWordTags && words.length > 0) {
      const fullText = words.map(w => w.text).join(" ");
      lines.push({ time: lineTime, text: fullText, words });
    } else {
      const cleanText = lineRest.replace(/<[^>]+>/g, "").trim();
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
  
  // Balanced hybrid curve: gentle initial acceleration + velvety cushioned deceleration
  const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutQuartic = (t: number) => 1 - Math.pow(1 - t, 4);
  const easeSmooth = (t: number) => 0.35 * easeInOutSine(t) + 0.65 * easeOutQuartic(t);

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

function formatShortTime(seconds: number): string {
  if (seconds < 0) return "--:--";
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s}.${ms}`;
}

export function Lyrics({ 
  autoScroll = true,
  isSyncMode = false,
  syncModeType = "line",
  syncLines = [],
  setSyncLines,
  activeWordCursor,
  setActiveWordCursor,
  onSyncWordTap,
  onUndoWord,
}: { 
  autoScroll?: boolean;
  isSyncMode?: boolean;
  syncModeType?: "line" | "word";
  syncLines?: LyricLine[];
  setSyncLines?: (lines: LyricLine[]) => void;
  activeWordCursor?: { lineIndex: number; wordIndex: number };
  setActiveWordCursor?: (cursor: { lineIndex: number; wordIndex: number }) => void;
  onSyncWordTap?: () => void;
  onUndoWord?: () => void;
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

  // Prefer word-synced lyrics if present, otherwise standard lyrics
  const lyrics = currentTrack?.wordLyrics || currentTrack?.lyrics;

  const isSynced = useMemo(() => {
    if (!lyrics) return false;
    return /\[\d+:\d{2}(?:\.\d+)?\]/.test(lyrics);
  }, [lyrics]);

  const parsedLyrics = useMemo<LyricLine[]>(() => {
    if (!lyrics) return [];
    if (!isSynced) {
      return lyrics.split("\n").map(text => ({ time: 0, text, words: undefined }));
    }
    return parseLRC(lyrics);
  }, [lyrics, isSynced]);

  // High-performance direct DOM subscription to eliminate 20fps React re-renders on i3-4150
  useEffect(() => {
    currentTimeRef.current = useStore.getState().currentTime;
    
    const unsub = useStore.subscribe((state) => {
      const time = state.currentTime;
      currentTimeRef.current = time;

      // Update sync mode timer badge directly
      if (isSyncMode && timeDisplayRef.current) {
        const m = Math.floor(time / 60).toString().padStart(2, '0');
        const s = Math.floor(time % 60).toString().padStart(2, '0');
        const ms = Math.floor((time % 1) * 100).toString().padStart(2, '0');
        timeDisplayRef.current.textContent = `${m}:${s}.${ms}`;
      }

      // Update active index for playback mode smoothly
      if (!isSyncMode && parsedLyrics.length > 0 && isSynced) {
        let active = 0;
        for (let i = 0; i < parsedLyrics.length; i++) {
          if (parsedLyrics[i].time <= time) {
            active = i;
          } else {
            break;
          }
        }
        setActiveIndex(prev => prev !== active ? active : prev);

        // Ultra high-performance word-by-word karaoke illumination directly on DOM with state-diffing
        if (activeRef.current) {
          const wordSpans = activeRef.current.querySelectorAll<HTMLSpanElement>("[data-word-time]");
          for (let s = 0; s < wordSpans.length; s++) {
            const span = wordSpans[s];
            const wTime = parseFloat(span.dataset.wordTime || "-1");
            if (wTime >= 0) {
              const shouldBeSung = time >= wTime;
              const isCurrentlySung = span.classList.contains("word-sung");
              if (shouldBeSung && !isCurrentlySung) {
                span.classList.add("word-sung");
                span.classList.remove("word-unsung");
              } else if (!shouldBeSung && isCurrentlySung) {
                span.classList.remove("word-sung");
                span.classList.add("word-unsung");
              }
            }
          }
        }
      }
    });
    
    return unsub;
  }, [isSyncMode, parsedLyrics, isSynced]);

  // Handle butter-smooth 120fps spring scrolling without layout thrashing
  useEffect(() => {
    if (autoScroll && isSynced && activeRef.current && containerRef.current && !isSyncMode) {
      const container = containerRef.current;
      const activeEl = activeRef.current;

      const frameId = requestAnimationFrame(() => {
        if (!containerRef.current || !activeRef.current) return;
        const containerHeight = container.clientHeight;
        const activeHeight = activeEl.clientHeight;
        const activeTop = activeEl.offsetTop;

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

  // In sync mode, auto-scroll to the line containing the active cursor
  useEffect(() => {
    if (isSyncMode && syncModeType === "word" && activeWordCursor && containerRef.current) {
      const activeLineEl = containerRef.current.querySelector(`[data-sync-line-index="${activeWordCursor.lineIndex}"]`) as HTMLDivElement | null;
      if (activeLineEl) {
        const container = containerRef.current;
        const lineTop = activeLineEl.offsetTop;
        const containerHeight = container.clientHeight;
        const target = Math.max(0, lineTop - (containerHeight / 2) + 60);
        container.scrollTo({ top: target, behavior: "smooth" });
      }
    }
  }, [isSyncMode, syncModeType, activeWordCursor?.lineIndex]);

  if (isSyncMode && setSyncLines) {
    const isWordSync = syncModeType === "word";
    const currentTargetWord = isWordSync && activeWordCursor && syncLines[activeWordCursor.lineIndex]?.words?.[activeWordCursor.wordIndex];

    return (
      <div ref={containerRef} className="h-full overflow-y-auto scrollbar-hide relative" style={{ paddingBottom: '35vh' }}>
        <style>{`
          @keyframes cursorRhythmPulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(var(--accent-rgb), 0.7), 0 0 14px rgba(var(--accent-rgb), 0.5);
              transform: scale(1.05);
            }
            50% {
              box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0), 0 0 22px rgba(var(--accent-rgb), 0.7);
              transform: scale(1.08);
            }
          }
          .cursor-pulse {
            animation: cursorRhythmPulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}</style>

        <div className="sticky top-0 z-20 pt-5 pb-4 px-4 sm:px-8 bg-surface-base/90 backdrop-blur-2xl border-b border-border-glass">
          <div className="bg-surface-overlay/90 backdrop-blur-2xl py-3 px-4 rounded-2xl border border-border-glass shadow-glass flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span 
                ref={timeDisplayRef}
                className="text-accent font-mono text-sm sm:text-base font-bold bg-black/40 px-3.5 py-1.5 rounded-xl border border-border-subtle tracking-tight shadow-inner"
              >
                00:00.00
              </span>
              <p className="text-text-primary text-xs font-medium">
                {isWordSync ? (
                  <span>
                    Tap <kbd className="px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle font-mono text-[10px] shadow-sm">Space</kbd> or click word to sync. <kbd className="px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle font-mono text-[10px] shadow-sm">Backspace</kbd> to undo.
                  </span>
                ) : (
                  <span>
                    Click a line to assign time. <span className="text-text-muted hidden md:inline">Ctrl+Click to seek.</span>
                  </span>
                )}
              </p>
            </div>

            {isWordSync && (
              <div className="flex items-center gap-2">
                {currentTargetWord && (
                  <div className="flex items-center gap-1.5 bg-surface-raised/70 px-3 py-1 rounded-xl border border-border-subtle text-xs">
                    <span className="text-text-muted font-medium">Next:</span>
                    <span className="font-bold text-accent">"{currentTargetWord.text}"</span>
                  </div>
                )}
                {onUndoWord && (
                  <button
                    type="button"
                    onClick={onUndoWord}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary hover:border-text-muted transition-all active:scale-95"
                    title="Undo last word (Backspace)"
                  >
                    Undo
                  </button>
                )}
                {onSyncWordTap && (
                  <button
                    type="button"
                    onClick={onSyncWordTap}
                    className="px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-accent text-black border border-accent hover:opacity-90 shadow-md transition-all active:scale-90"
                    title="Tap to sync next word (Spacebar)"
                  >
                    Tap Word
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5 px-4 sm:px-8 pt-4">
          {syncLines.map((line, i) => {
            const isLineSynced = line.time >= 0;

            if (isWordSync) {
              const words = line.words || [];
              const isCurrentLine = activeWordCursor?.lineIndex === i;

              return (
                <div
                  key={i}
                  data-sync-line-index={i}
                  className={`py-3.5 px-5 rounded-2xl border transition-all duration-200 ${
                    isCurrentLine 
                      ? 'bg-surface-raised/50 border-accent/40 shadow-sm scale-[1.005]' 
                      : 'bg-surface-raised/20 border-border-subtle/50 hover:bg-surface-raised/35'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted bg-surface-raised/80 px-2 py-0.5 rounded-md border border-border-subtle">
                      Line {i + 1}
                    </span>
                    <span className="text-xs font-mono text-text-muted font-semibold">
                      {isLineSynced ? formatShortTime(line.time) : "--:--.--"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {words.map((word, wIdx) => {
                      const isCursor = isCurrentLine && activeWordCursor?.wordIndex === wIdx;
                      const isStamped = word.time >= 0;

                      return (
                        <button
                          key={wIdx}
                          type="button"
                          onClick={(e) => {
                            if (e.ctrlKey && isStamped) {
                              requestSeek(word.time);
                              return;
                            }
                            if (setActiveWordCursor && setSyncLines) {
                              const newLines = [...syncLines];
                              const targetWords = [...(newLines[i].words || [])];
                              targetWords[wIdx] = { ...targetWords[wIdx], time: currentTimeRef.current };
                              newLines[i] = {
                                ...newLines[i],
                                time: newLines[i].time < 0 ? currentTimeRef.current : newLines[i].time,
                                words: targetWords,
                              };
                              setSyncLines(newLines);
                              if (wIdx + 1 < targetWords.length) {
                                setActiveWordCursor({ lineIndex: i, wordIndex: wIdx + 1 });
                              } else if (i + 1 < newLines.length) {
                                setActiveWordCursor({ lineIndex: i + 1, wordIndex: 0 });
                              }
                            }
                          }}
                          className={`group/word relative px-3 py-1.5 rounded-xl text-sm transition-all duration-150 flex items-center gap-1.5 ${
                            isCursor
                              ? "bg-accent text-black font-black cursor-pulse"
                              : isStamped
                              ? "bg-accent/15 border border-accent/40 text-accent font-bold hover:bg-accent/25 hover:scale-105"
                              : "bg-surface-raised/60 border border-border-subtle/60 text-text-muted hover:text-text-primary hover:border-text-muted hover:scale-105"
                          }`}
                        >
                          <span>{word.text}</span>
                          {isStamped && (
                            <span className={`text-[10px] font-mono ${isCursor ? "text-black/80 font-bold" : "text-accent/90"}`}>
                              {formatShortTime(word.time)}
                            </span>
                          )}
                          {isCursor && !isStamped && (
                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Standard line sync rendering
            return (
              <div
                key={i}
                className={`py-3.5 flex items-center justify-between rounded-2xl transition-all duration-200 hover:bg-surface-raised/50 hover:scale-[1.008] cursor-pointer group px-6 ${isLineSynced ? 'bg-surface-raised/25 border border-border-subtle/60' : 'border border-transparent'}`}
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
                <p className={`text-base md:text-lg leading-relaxed flex-1 transition-colors ${isLineSynced ? "text-accent font-semibold" : "text-text-muted group-hover:text-text-primary"}`}>
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

        .lyric-word {
          display: inline-block;
          cursor: pointer;
          transform-origin: center bottom;
          transition: 
            color 0.16s ease-out,
            opacity 0.18s ease-out,
            transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
            text-shadow 0.22s ease-out;
        }

        .lyric-word.word-sung {
          opacity: 1 !important;
          color: ${isLight ? "#090d16" : "#ffffff"} !important;
          transform: translate3d(0, 0, 0) scale(1.03) !important;
          text-shadow: ${
            isLight 
              ? "0 1px 2px rgba(0, 0, 0, 0.1)" 
              : "0 0 16px rgba(255, 255, 255, 0.38), 0 0 32px rgba(255, 255, 255, 0.12)"
          } !important;
        }

        .lyric-word.word-unsung {
          opacity: 0.32 !important;
          color: ${isLight ? "#64748b" : "#94a3b8"} !important;
          transform: translate3d(0, 0, 0) scale(1) !important;
          text-shadow: none !important;
        }

        .lyric-word:hover {
          opacity: 0.9 !important;
          transform: translate3d(0, -1px, 0) scale(1.05) !important;
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
              className="w-full flex justify-start origin-left py-0.5 lyric-line-wrapper"
            >
              <p
                onClick={() => isSynced && requestSeek(line.time)}
                className={`max-w-full rounded-2xl origin-left text-left ${
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
                {isActive && line.words && line.words.length > 0 ? (
                  line.words.map((w, wIdx) => {
                    const isSung = currentTimeRef.current >= w.time;
                    return (
                      <span
                        key={wIdx}
                        data-word-time={w.time}
                        onClick={(e) => {
                          if (isSynced) {
                            e.stopPropagation();
                            requestSeek(w.time);
                          }
                        }}
                        className={`lyric-word mr-2.5 ${
                          isSung ? "word-sung" : "word-unsung"
                        }`}
                      >
                        {w.text}
                      </span>
                    );
                  })
                ) : (
                  line.text
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}