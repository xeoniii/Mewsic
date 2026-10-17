import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Lyrics, LyricLine, parseLRC } from "./Lyrics";
import { useStore } from "../../store";
import { saveTrackMetadata, saveWordLyrics, loadWordLyrics } from "../../utils/tauriApi";
import { Edit3, Check, X } from "lucide-react";

export function LyricsView() {
  const currentTrack = useStore(s => s.currentTrack);
  const updateTrack = useStore(s => s.updateTrack);

  // Automatically check and load word-by-word lyrics from .elrc sidecar / app-data if not yet loaded
  useEffect(() => {
    let isCancelled = false;
    if (currentTrack && currentTrack.filePath && !currentTrack.wordLyrics) {
      loadWordLyrics(currentTrack.filePath, currentTrack.id).then((saved) => {
        if (!isCancelled && saved) {
          updateTrack({ ...currentTrack, wordLyrics: saved });
        }
      }).catch(console.error);
    }
    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.filePath]);

  const activeLyrics = currentTrack?.wordLyrics || currentTrack?.lyrics;

  const isSynced = useMemo(() => {
    if (!activeLyrics) return false;
    return /\[\d+:\d{2}(?:\.\d+)?\]/.test(activeLyrics);
  }, [activeLyrics]);

  const [autoScroll, setAutoScroll] = useState(isSynced);
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [syncModeType, setSyncModeType] = useState<"line" | "word">("line");
  const [syncLines, setSyncLines] = useState<LyricLine[]>([]);
  const [activeWordCursor, setActiveWordCursor] = useState<{ lineIndex: number; wordIndex: number }>({ lineIndex: 0, wordIndex: 0 });

  useEffect(() => {
    setAutoScroll(isSynced);
    setIsSyncMode(false);
  }, [isSynced, currentTrack?.id]);

  const startSyncMode = () => {
    if (!currentTrack) return;

    if (currentTrack.wordLyrics) {
      const parsed = parseLRC(currentTrack.wordLyrics);
      // Ensure words array exists
      const prepared = parsed.map(l => {
        if (l.words && l.words.length > 0) return l;
        const wordTokens = l.text.split(/\s+/).filter(Boolean);
        return {
          ...l,
          words: wordTokens.map(w => ({ text: w, time: l.time >= 0 ? l.time : -1 })),
        };
      });
      setSyncLines(prepared);
      setSyncModeType("word");
      setActiveWordCursor({ lineIndex: 0, wordIndex: 0 });
    } else {
      const currentLyrics = currentTrack.lyrics || "";
      const rawLines = currentLyrics.split("\n").filter(l => l.trim()) || [];
      const initial = rawLines.map(line => {
        const match = /\[(\d+):(\d{2})(?:\.(\d+))?\](.*)/.exec(line);
        if (match) {
          const m = parseInt(match[1], 10);
          const s = parseInt(match[2], 10);
          const msStr = match[3] || "0";
          const ms = parseInt(msStr.padEnd(3, "0").slice(0, 3), 10);
          const lineTime = m * 60 + s + ms / 1000;
          const lineText = match[4].trim();
          const words = lineText.split(/\s+/).filter(Boolean).map(w => ({ text: w, time: -1 }));
          return { time: lineTime, text: lineText, words };
        }
        const clean = line.trim();
        const words = clean.split(/\s+/).filter(Boolean).map(w => ({ text: w, time: -1 }));
        return { time: -1, text: clean, words };
      });
      setSyncLines(initial);
      setSyncModeType("line");
      setActiveWordCursor({ lineIndex: 0, wordIndex: 0 });
    }

    setIsSyncMode(true);
  };

  const switchSyncModeType = (type: "line" | "word") => {
    setSyncModeType(type);
    if (type === "word") {
      setSyncLines(lines => lines.map(line => {
        if (line.words && line.words.length > 0) return line;
        const wordTokens = line.text.split(/\s+/).filter(Boolean);
        return {
          ...line,
          words: wordTokens.map(w => ({ text: w, time: -1 })),
        };
      }));
      setActiveWordCursor({ lineIndex: 0, wordIndex: 0 });
    }
  };

  const handleSyncWordTap = useCallback(() => {
    const currentTime = useStore.getState().currentTime;
    setSyncLines(prev => {
      if (!activeWordCursor) return prev;
      const { lineIndex, wordIndex } = activeWordCursor;
      if (lineIndex >= prev.length) return prev;

      const line = prev[lineIndex];
      const words = [...(line.words || [])];
      if (wordIndex >= words.length) return prev;

      words[wordIndex] = { ...words[wordIndex], time: currentTime };
      const updatedLine = {
        ...line,
        time: line.time < 0 ? currentTime : line.time,
        words,
      };

      const nextLines = [...prev];
      nextLines[lineIndex] = updatedLine;
      return nextLines;
    });

    setActiveWordCursor(curr => {
      if (!curr) return { lineIndex: 0, wordIndex: 0 };
      const line = syncLines[curr.lineIndex];
      const wordsCount = line?.words?.length || 0;
      if (curr.wordIndex + 1 < wordsCount) {
        return { lineIndex: curr.lineIndex, wordIndex: curr.wordIndex + 1 };
      } else if (curr.lineIndex + 1 < syncLines.length) {
        return { lineIndex: curr.lineIndex + 1, wordIndex: 0 };
      }
      return curr;
    });
  }, [activeWordCursor, syncLines]);

  const handleUndoWord = useCallback(() => {
    if (!activeWordCursor) return;
    const { lineIndex, wordIndex } = activeWordCursor;

    let prevLineIdx = lineIndex;
    let prevWordIdx = wordIndex;

    const currentWord = syncLines[lineIndex]?.words?.[wordIndex];
    if (currentWord && currentWord.time >= 0) {
      // Clear current word
    } else {
      // Step back
      if (wordIndex > 0) {
        prevWordIdx = wordIndex - 1;
      } else if (lineIndex > 0) {
        prevLineIdx = lineIndex - 1;
        const prevLineWords = syncLines[prevLineIdx]?.words || [];
        prevWordIdx = Math.max(0, prevLineWords.length - 1);
      }
    }

    setSyncLines(prev => {
      if (prevLineIdx >= prev.length) return prev;
      const line = prev[prevLineIdx];
      const words = [...(line.words || [])];
      if (prevWordIdx < words.length) {
        words[prevWordIdx] = { ...words[prevWordIdx], time: -1 };
      }
      const nextLines = [...prev];
      nextLines[prevLineIdx] = { ...line, words };
      return nextLines;
    });

    setActiveWordCursor({ lineIndex: prevLineIdx, wordIndex: prevWordIdx });
  }, [activeWordCursor, syncLines]);

  // Keyboard shortcut listener for Word Sync
  useEffect(() => {
    if (!isSyncMode || syncModeType !== "word") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        handleSyncWordTap();
      } else if (e.code === "Backspace") {
        e.preventDefault();
        handleUndoWord();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setActiveWordCursor(curr => {
          if (!curr) return { lineIndex: 0, wordIndex: 0 };
          const line = syncLines[curr.lineIndex];
          const wordsCount = line?.words?.length || 0;
          if (curr.wordIndex + 1 < wordsCount) {
            return { lineIndex: curr.lineIndex, wordIndex: curr.wordIndex + 1 };
          } else if (curr.lineIndex + 1 < syncLines.length) {
            return { lineIndex: curr.lineIndex + 1, wordIndex: 0 };
          }
          return curr;
        });
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setActiveWordCursor(curr => {
          if (!curr) return { lineIndex: 0, wordIndex: 0 };
          if (curr.wordIndex > 0) {
            return { lineIndex: curr.lineIndex, wordIndex: curr.wordIndex - 1 };
          } else if (curr.lineIndex > 0) {
            const prevLine = syncLines[curr.lineIndex - 1];
            const wordsCount = prevLine?.words?.length || 0;
            return { lineIndex: curr.lineIndex - 1, wordIndex: Math.max(0, wordsCount - 1) };
          }
          return curr;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSyncMode, syncModeType, handleSyncWordTap, handleUndoWord, syncLines]);

  const shiftSync = (amount: number) => {
    setSyncLines(lines => lines.map(l => ({
      ...l,
      time: l.time >= 0 ? Math.max(0, l.time + amount) : -1,
      words: l.words?.map(w => ({
        ...w,
        time: w.time >= 0 ? Math.max(0, w.time + amount) : -1,
      })),
    })));
  };

  const saveSync = async () => {
    if (!currentTrack) return;

    if (syncModeType === "word") {
      // Formats into Enhanced LRC (ELRC): [mm:ss.xx] <mm:ss.xx> word1 <mm:ss.xx> word2 ...
      // Stored in separate .elrc sidecar file, untouched in the audio file / MP3!
      const elrcContent = syncLines.map(l => {
        const lineTime = l.time >= 0 ? l.time : (l.words && l.words.length > 0 && l.words[0].time >= 0 ? l.words[0].time : 0);
        const m = Math.floor(lineTime / 60).toString().padStart(2, "0");
        const s = Math.floor(lineTime % 60).toString().padStart(2, "0");
        const ms = Math.floor((lineTime % 1) * 100).toString().padStart(2, "0");
        const lineHeader = `[${m}:${s}.${ms}]`;

        if (l.words && l.words.length > 0) {
          const wordTags = l.words.map(w => {
            const wTime = w.time >= 0 ? w.time : lineTime;
            const wm = Math.floor(wTime / 60).toString().padStart(2, "0");
            const ws = Math.floor(wTime % 60).toString().padStart(2, "0");
            const wms = Math.floor((wTime % 1) * 100).toString().padStart(2, "0");
            return `<${wm}:${ws}.${wms}> ${w.text}`;
          }).join(" ");
          return `${lineHeader} ${wordTags}`;
        }
        return `${lineHeader} ${l.text}`;
      }).join("\n");

      try {
        await saveWordLyrics(currentTrack.filePath, currentTrack.id, elrcContent);
        updateTrack({ ...currentTrack, wordLyrics: elrcContent });
        setIsSyncMode(false);
      } catch (e) {
        console.error("Failed to save word lyrics:", e);
      }
    } else {
      // Standard line-by-line sync stored in audio file metadata
      const lrcContent = syncLines.map(l => {
        if (l.time < 0) return l.text;
        const m = Math.floor(l.time / 60).toString().padStart(2, "0");
        const s = Math.floor(l.time % 60).toString().padStart(2, "0");
        const ms = Math.floor((l.time % 1) * 100).toString().padStart(2, "0");
        return `[${m}:${s}.${ms}] ${l.text}`;
      }).join("\n");

      try {
        await saveTrackMetadata(currentTrack.filePath, { lyrics: lrcContent });
        updateTrack({ ...currentTrack, lyrics: lrcContent });
        setIsSyncMode(false);
      } catch (e) {
        console.error("Failed to save line lyrics:", e);
      }
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border-subtle flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">
            {isSyncMode ? "Sync Mode" : "Lyrics"}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {isSyncMode ? (
            <>
              {/* Sync Mode Selector: Line vs Word */}
              <div className="flex items-center bg-surface-raised/90 p-0.5 rounded-xl border border-border-subtle mr-2 shadow-inner">
                <button
                  type="button"
                  onClick={() => switchSyncModeType("line")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                    syncModeType === "line"
                      ? "bg-accent text-black shadow-md scale-[1.02]"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                  title="Sync line-by-line (stored in audio file tags)"
                >
                  Line Sync
                </button>
                <button
                  type="button"
                  onClick={() => switchSyncModeType("word")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                    syncModeType === "word"
                      ? "bg-accent text-black shadow-md scale-[1.02]"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                  title="Sync word-by-word (stored in sidecar .elrc file, audio file untouched)"
                >
                  Word Sync
                </button>
              </div>

              <div className="flex items-center gap-1 mr-2 border-r border-border-subtle pr-3">
                <button
                  onClick={() => shiftSync(-1.0)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95"
                  title="Advance lyrics by 1.0s"
                >
                  -1.0s
                </button>
                <button
                  onClick={() => shiftSync(-0.5)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95"
                  title="Advance lyrics by 0.5s"
                >
                  -0.5s
                </button>
                <button
                  onClick={() => shiftSync(-0.1)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95"
                  title="Advance lyrics by 0.1s"
                >
                  -0.1s
                </button>
                <button
                  onClick={() => shiftSync(0.1)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95"
                  title="Delay lyrics by 0.1s"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => shiftSync(0.5)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95"
                  title="Delay lyrics by 0.5s"
                >
                  +0.5s
                </button>
                <button
                  onClick={() => shiftSync(1.0)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95"
                  title="Delay lyrics by 1.0s"
                >
                  +1.0s
                </button>
              </div>

              <button
                onClick={() => setIsSyncMode(false)}
                className="px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary active:scale-95 flex items-center gap-1.5"
              >
                <X size={12} />
                Cancel
              </button>
              <button
                onClick={saveSync}
                className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-accent text-black border border-accent hover:opacity-90 shadow-md active:scale-95 flex items-center gap-1.5"
                title={syncModeType === "word" ? "Save to sidecar .elrc file (leaves MP3 untouched)" : "Save to audio file tags"}
              >
                <Check size={12} />
                Save {syncModeType === "word" ? "(.elrc)" : ""}
              </button>
            </>
          ) : (
            <>
              {currentTrack && (
                <button
                  onClick={startSyncMode}
                  className="px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary hover:border-text-muted active:scale-95 flex items-center gap-1.5 shadow-sm"
                  title="Enter Sync Mode"
                >
                  <Edit3 size={12} />
                  Sync
                </button>
              )}
              {activeLyrics && (
                <button 
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 active:scale-95 ${
                    autoScroll 
                      ? "bg-accent text-black shadow-[0_0_12px_rgba(var(--accent-rgb),0.35)] font-black" 
                      : "bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary hover:border-text-muted"
                  } disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed`}
                  disabled={!isSynced}
                  title={!isSynced ? "Auto-scroll requires synced lyrics" : "Toggle auto-scroll"}
                >
                  Auto-Scroll {autoScroll ? "ON" : "OFF"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Lyrics 
          autoScroll={autoScroll} 
          isSyncMode={isSyncMode} 
          syncModeType={syncModeType}
          syncLines={syncLines} 
          setSyncLines={setSyncLines}
          activeWordCursor={activeWordCursor}
          setActiveWordCursor={setActiveWordCursor}
          onSyncWordTap={handleSyncWordTap}
          onUndoWord={handleUndoWord}
        />
      </div>
    </div>
  );
}
