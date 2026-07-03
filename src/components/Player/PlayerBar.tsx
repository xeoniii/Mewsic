import React, { useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Repeat1,
  Shuffle, Volume2, VolumeX, Volume1,
  RotateCcw, RotateCw, ListMusic
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { CoverArt } from "../Dashboard/MusicCard";
import { formatDuration, truncate } from "../../utils/helpers";
import { ThemedSlider } from "../UI/ThemedSlider";

// This is the * filled volume icon based on level part
function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX size={15} />;
  if (volume < 0.4) return <Volume1 size={15} />;
  return <Volume2 size={15} />;
}

// This is the * repeat icon based on mode part
function RepeatIcon({ mode }: { mode: "off" | "one" | "all" }) {
  if (mode === "one") return <Repeat1 size={15} />;
  return <Repeat size={15} />;
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    duration,
    volume,
    repeatMode,
    shuffleEnabled,
    setIsPlaying,
    setVolume,
    setRepeatMode,
    toggleShuffle,
    playNext,
    playPrev,
    skipForward,
    skipBackward,
    toggleMute,
    activeView,
    setActiveView,
  } = useStore(useShallow((s) => ({
    currentTrack: s.currentTrack,
    isPlaying: s.isPlaying,
    duration: s.duration,
    volume: s.volume,
    repeatMode: s.repeatMode,
    shuffleEnabled: s.shuffleEnabled,
    setIsPlaying: s.setIsPlaying,
    setVolume: s.setVolume,
    setRepeatMode: s.setRepeatMode,
    toggleShuffle: s.toggleShuffle,
    playNext: s.playNext,
    playPrev: s.playPrev,
    skipForward: s.skipForward,
    skipBackward: s.skipBackward,
    toggleMute: s.toggleMute,
    activeView: s.activeView,
    setActiveView: s.setActiveView,
  })));

  const { togglePlay, seek, setSeeking } = useAudioPlayer();

  const handleVolumeChange = useCallback(
    (val: number) => {
      setVolume(val);
    },
    [setVolume]
  );

  const cycleRepeat = () => {
    const modes: Array<"off" | "one" | "all"> = ["off", "all", "one"];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  return (
    <div
      className="glass-heavy border-t border-border-glass flex items-center gap-4 px-4 flex-shrink-0"
      style={{ height: "var(--player-height)" }}
    >
      {
  // This is the track info (left) part
}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0" style={{ width: 225 }}>
        <div
          className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ${
            currentTrack ? "shadow-glass" : ""
          }`}
        >
          {currentTrack ? (
            <CoverArt track={currentTrack} size={96} />
          ) : (
            <div className="w-full h-full bg-surface-overlay flex items-center justify-center">
              <div className="w-4 h-4 rounded-full border border-border-glass" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-text-primary truncate leading-tight">
              {currentTrack ? truncate(currentTrack.title, 18) : "Nothing playing"}
            </span>
            {currentTrack && (currentTrack.provider === "virtual" || currentTrack.id.startsWith("web-stream:") || (currentTrack.filePath.startsWith("http") && !currentTrack.filePath.startsWith("http://127.0.0.1:1422/"))) && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30 flex-shrink-0">
                Virtual
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate mt-0.5">
            {currentTrack ? truncate(currentTrack.artist, 24) : "—"}
          </p>
        </div>
      </div>

      {
  // This is the transport controls (center) part
}
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        {
  // This is the controls row part
}
        <div className="flex items-center gap-1">
          {
  // This is the shuffle part
}
          <button
            onClick={toggleShuffle}
            className={`btn-icon ${shuffleEnabled ? "active" : ""}`}
            title="Shuffle"
          >
            <Shuffle size={15} />
          </button>

          {
  // This is the prev part
}
          <button
            onClick={playPrev}
            disabled={!currentTrack}
            className="btn-icon disabled:opacity-30"
          >
            <SkipBack size={18} />
          </button>

          {
  // This is the skip backward 5s part
}
          <button
            onClick={skipBackward}
            disabled={!currentTrack}
            className="btn-icon disabled:opacity-30 p-0.5"
            title="Rewind 5s"
          >
            <RotateCcw size={16} />
          </button>

          {
  // This is the play / pause — primary button part
}
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:scale-105 active:scale-95 transition-transform mx-1"
            style={{ boxShadow: currentTrack ? "0 0 16px var(--accent-glow)" : undefined }}
          >
            {isPlaying ? (
              <Pause size={17} fill="#000" color="#000" />
            ) : (
              <Play size={17} fill="#000" color="#000" style={{ marginLeft: 2 }} />
            )}
          </button>

          {
  // This is the skip forward 5s part
}
          <button
            onClick={skipForward}
            disabled={!currentTrack}
            className="btn-icon disabled:opacity-30 p-0.5"
            title="Skip 5s"
          >
            <RotateCw size={16} />
          </button>

          {
  // This is the next part
}
          <button
            onClick={playNext}
            disabled={!currentTrack}
            className="btn-icon disabled:opacity-30"
          >
            <SkipForward size={18} />
          </button>

          {
  // This is the repeat part
}
          <button
            onClick={cycleRepeat}
            className={`btn-icon ${repeatMode !== "off" ? "active" : ""}`}
            title={`Repeat: ${repeatMode}`}
          >
            <RepeatIcon mode={repeatMode} />
          </button>
        </div>

        {
  // This is the seek bar row part
}
        <SeekBarRow duration={duration} seek={seek} setSeeking={setSeeking} />
      </div>

      {
  // This is the volume (right) part
}
      <div
        className="flex items-center gap-2 flex-shrink-0 mr-4"
        style={{ width: 190 }}
      >
        <button
          onClick={() => {
            if (activeView === "queue") {
              useStore.getState().goBack();
            } else {
              setActiveView("queue");
            }
          }}
          className={`btn-icon flex-shrink-0 ${activeView === "queue" ? "active" : ""}`}
          title="Play Queue"
        >
          <ListMusic size={15} />
        </button>
        <button
          onClick={toggleMute}
          className="btn-icon flex-shrink-0"
          title={volume === 0 ? "Unmute" : "Mute"}
        >
          <VolumeIcon volume={volume} />
        </button>
        <ThemedSlider
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolumeChange}
          formatTooltip={(v) => `${Math.round(v * 100)}%`}
        />
        <span className="text-[11px] text-text-muted font-mono w-10 text-right flex-shrink-0">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}

// Subcomponent to isolate the 20fps re-renders to just the progress bar
function SeekBarRow({ duration, seek, setSeeking }: { duration: number, seek: (time: number) => void, setSeeking: (v: boolean) => void }) {
  const currentTime = useStore(s => s.currentTime);
  const currentTrack = useStore(s => s.currentTrack);
  const setCurrentTime = useStore(s => s.setCurrentTime);

  return (
    <div className="flex items-center gap-2 w-full max-w-xl">
      <span className="text-[11px] text-text-muted font-mono w-8 text-right flex-shrink-0">
        {formatDuration(currentTime)}
      </span>
      <ThemedSlider
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={(val) => {
          // While dragging: lock out onTimeUpdate and show optimistic position
          setSeeking(true);
          setCurrentTime(val);
        }}
        onChangeCommit={(val) => {
          // On release: fire the real seek (seek() manages isSeeking internally)
          seek(val);
        }}
        disabled={!currentTrack}
        formatTooltip={formatDuration}
      />
      <span className="text-[11px] text-text-muted font-mono w-8 flex-shrink-0">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
